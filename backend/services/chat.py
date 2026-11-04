import json
import time
import uuid

from core.db import db, now_iso
from services.embeddings import EmbeddingConfigError
from services.llm import stream_llm
from services.prompts import INSUFFICIENT_ANSWER, RAG_SYSTEM, source_block
from services.retrieval import retrieve
from services.usage import log_activity, record_usage


def sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def _history(conversation_id: str, limit: int = 6) -> str:
    rows = await db.messages.find({"conversation_id": conversation_id}, {"_id": 0, "role": 1, "content": 1}) \
        .sort("created_at", -1).limit(limit).to_list(limit)
    return "\n".join(f"{r['role'].upper()}: {r['content'][:800]}" for r in reversed(rows))


async def answer_stream(ws: dict, conversation: dict, question: str, document_ids: list[str] | None):
    """Full RAG turn: retrieve -> build controlled context -> stream grounded answer -> persist."""
    settings, ws_id, conv_id = ws["settings"], ws["id"], conversation["id"]
    t0 = time.perf_counter()
    history = await _history(conv_id)
    await db.messages.insert_one({"id": str(uuid.uuid4()), "conversation_id": conv_id, "workspace_id": ws_id,
                                  "role": "user", "content": question, "created_at": now_iso()})
    yield sse({"type": "meta", "conversation_id": conv_id, "title": conversation["title"]})

    try:
        ret = await retrieve(ws_id, question, settings["mode"], settings["top_k"], settings["threshold"], document_ids)
    except EmbeddingConfigError as exc:
        await record_usage(ws_id, "chat", success=False, error=str(exc))
        yield sse({"type": "error", "message": str(exc)})
        return
    except Exception:
        await record_usage(ws_id, "chat", success=False, error="retrieval_failed")
        yield sse({"type": "error", "message": "Retrieval failed. Please try again."})
        return

    citations = [{**r, "tag": f"S{i}", "text": r["text"]} for i, r in enumerate(ret["results"], start=1)]
    yield sse({"type": "sources", "citations": citations, "best_similarity": ret["best_similarity"]})

    answer, usage, gen_ms, grounded = "", None, 0.0, bool(citations)
    if not citations:
        answer = INSUFFICIENT_ANSWER
        yield sse({"type": "delta", "content": answer})
    else:
        context = "\n\n".join(source_block(c["tag"], c["document_name"], c["page_start"], c["page_end"], c["text"]) for c in citations)
        prompt = (f"Conversation so far (for context only):\n{history or '(none)'}\n\n"
                  f"SOURCES:\n{context}\n\nQUESTION: {question}\n\nAnswer using only the sources, with [S#] citations.")
        g0 = time.perf_counter()
        try:
            async for kind, value in stream_llm(RAG_SYSTEM, prompt, settings.get("llm_model")):
                if kind == "delta":
                    answer += value
                    yield sse({"type": "delta", "content": value})
                else:
                    usage = value
        except Exception:
            gen_ms = (time.perf_counter() - g0) * 1000
            await record_usage(ws_id, "chat", success=False, error="generation_failed", retrieval_ms=ret["retrieval_ms"])
            yield sse({"type": "error", "message": "The AI model failed to respond. Please regenerate."})
            return
        gen_ms = (time.perf_counter() - g0) * 1000

    metrics = {"retrieval_ms": ret["retrieval_ms"], "generation_ms": round(gen_ms, 1),
               "total_ms": round((time.perf_counter() - t0) * 1000, 1),
               "input_tokens": getattr(usage, "input_tokens", 0) or 0, "output_tokens": getattr(usage, "output_tokens", 0) or 0,
               "embed_tokens": ret["embed_tokens"], "chunks_used": len(citations), "mode": ret["mode"], "grounded": grounded,
               "best_similarity": ret["best_similarity"]}
    msg = {"id": str(uuid.uuid4()), "conversation_id": conv_id, "workspace_id": ws_id, "role": "assistant",
           "content": answer, "citations": citations, "metrics": metrics, "feedback": None, "created_at": now_iso()}
    await db.messages.insert_one(dict(msg))
    count = await db.messages.count_documents({"conversation_id": conv_id})
    await db.conversations.update_one({"id": conv_id}, {"$set": {"updated_at": now_iso(), "message_count": count}})
    await record_usage(ws_id, "chat", model=settings.get("llm_model"), **{k: metrics[k] for k in
                       ("retrieval_ms", "generation_ms", "total_ms", "input_tokens", "output_tokens", "embed_tokens")},
                       insufficient=not grounded)
    await db.search_logs.insert_one({"id": str(uuid.uuid4()), "workspace_id": ws_id, "source": "chat", "query": question,
                                     "mode": ret["mode"], "results": len(citations), "created_at": now_iso()})
    if conversation.get("message_count", 0) == 0:
        await log_activity(ws_id, "conversation", f"Asked: {question[:80]}", conv_id)
    msg.pop("_id", None)
    yield sse({"type": "done", "message": msg})
