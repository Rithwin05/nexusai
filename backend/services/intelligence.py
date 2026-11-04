import re
import time
import uuid

from core.db import db, now_iso
from services.doc_context import document_context, resolve_evidence
from services.llm import complete, complete_json
from services.prompts import DOC_SYSTEM, RAG_SYSTEM, source_block
from services.retrieval import retrieve
from services.usage import log_activity, record_usage

SUMMARY_SCHEMA = """{"executive_summary": str, "detailed_summary": str (markdown, 3-6 paragraphs),
"key_concepts": [{"name": str, "description": str, "evidence": [tags]}], "terminology": [{"term": str, "definition": str}],
"main_findings": [{"finding": str, "evidence": [tags]}], "conclusions": [str], "future_scope": [str]}"""

SENTIMENT_SCHEMA = """{"overall": {"label": "positive"|"negative"|"neutral", "confidence": number 0-1, "explanation": str},
"distribution": {"positive": int, "negative": int, "neutral": int},
"sentences": [{"index": int, "label": "positive"|"negative"|"neutral", "confidence": number 0-1, "reason": str}]}"""

COMPARE_SCHEMA = """{"overview": str, "common_themes": [{"theme": str, "detail": str, "evidence": [tags from A and B]}],
"differences": [{"aspect": str, "document_a": str, "document_b": str, "evidence": [tags]}],
"methodology_comparison": {"document_a": str, "document_b": str, "assessment": str},
"conflicts": [{"statement_a": str, "statement_b": str, "explanation": str, "evidence": [tags]}]}"""

RESEARCH_SCHEMA = """{"title": str, "research_domain": str, "objectives": [{"text": str, "evidence": [tags]}],
"research_questions": [str], "methodology": {"approach": str, "data": str, "techniques": [str], "evaluation": str, "evidence": [tags]},
"key_findings": [{"text": str, "evidence": [tags]}], "contributions": [str],
"limitations": [{"text": str, "stated_by_authors": bool, "evidence": [tags]}],
"future_scope": [{"text": str, "evidence": [tags]}],
"research_gaps": [{"gap": str, "type": "methodological"|"empirical"|"theoretical"|"practical"|"population"|"evaluation",
  "rationale": str, "opportunity": str, "priority": "high"|"medium"|"low", "evidence": [tags]}],
"follow_up_questions": [str]}"""


async def _save(ws_id: str, kind: str, key: str, params: dict, result: dict, tokens: dict, ms: float, label: str) -> dict:
    doc = {"id": str(uuid.uuid4()), "workspace_id": ws_id, "kind": kind, "key": key, "params": params,
           "result": result, "tokens": tokens, "latency_ms": round(ms), "created_at": now_iso()}
    await db.insights.delete_many({"workspace_id": ws_id, "kind": kind, "key": key})
    await db.insights.insert_one(dict(doc))
    await record_usage(ws_id, kind, generation_ms=round(ms), total_ms=round(ms), **tokens)
    await log_activity(ws_id, kind, label, doc["id"])
    doc.pop("_id", None)
    return doc


async def summarize(ws: dict, doc: dict) -> dict:
    t0 = time.perf_counter()
    ctx, info = await document_context(ws["id"], doc)
    data, tokens = await complete_json(DOC_SYSTEM, f"Document: {doc['filename']}\n{ctx}\n\nProduce a structured summary. JSON schema:\n{SUMMARY_SCHEMA}",
                                       ws["settings"].get("llm_model"))
    result = {**resolve_evidence(data, info["refs"]), "coverage": info}
    result["coverage"].pop("refs", None)
    return await _save(ws["id"], "summary", doc["id"], {"document_id": doc["id"]}, result, tokens,
                       (time.perf_counter() - t0) * 1000, f"Summarised {doc['filename']}")


def split_sentences(text: str, limit: int = 30) -> list[str]:
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if 30 <= len(s.strip()) <= 400]
    if len(sents) <= limit:
        return sents
    step = len(sents) / limit
    return [sents[int(i * step)] for i in range(limit)]


async def sentiment(ws: dict, doc: dict | None, text: str | None) -> dict:
    t0 = time.perf_counter()
    if doc:
        chunks = await db.chunks.find({"workspace_id": ws["id"], "document_id": doc["id"]}, {"_id": 0, "text": 1}) \
            .sort("ordinal", 1).to_list(None)
        text = " ".join(c["text"] for c in chunks)
    sentences = split_sentences(text or "")
    if not sentences:
        sentences = [(text or "").strip()[:400]]
    listing = "\n".join(f"<source id=\"{i}\">{s}</source>" for i, s in enumerate(sentences))
    data, tokens = await complete_json(DOC_SYSTEM, "Classify the sentiment of each sentence (zero-shot) and the overall tone. "
                                       "Confidence is your self-assessed certainty.\n" + listing + f"\nJSON schema:\n{SENTIMENT_SCHEMA}",
                                       ws["settings"].get("llm_model"))
    by_idx = {s.get("index"): s for s in data.get("sentences", [])}
    data["sentences"] = [{"text": s, **{k: by_idx.get(i, {}).get(k) for k in ("label", "confidence", "reason")}}
                         for i, s in enumerate(sentences)]
    data["distribution"] = {lbl: sum(1 for s in data["sentences"] if s["label"] == lbl) for lbl in ("positive", "negative", "neutral")}
    data["method"] = f"LLM-based zero-shot classification ({ws['settings'].get('llm_model')}); no model was trained or fine-tuned. Confidence values are model self-reported."
    data["sampled_sentences"] = len(sentences)
    key = doc["id"] if doc else f"text:{hash(text) & 0xffffffff}"
    return await _save(ws["id"], "sentiment", key, {"document_id": doc["id"] if doc else None}, data, tokens,
                       (time.perf_counter() - t0) * 1000, f"Sentiment analysis: {doc['filename'] if doc else 'custom text'}")


async def compare(ws: dict, doc_a: dict, doc_b: dict) -> dict:
    t0 = time.perf_counter()
    ctx_a, info_a = await document_context(ws["id"], doc_a, "A", 20000)
    ctx_b, info_b = await document_context(ws["id"], doc_b, "B", 20000)
    prompt = (f"DOCUMENT A: {doc_a['filename']}\n{ctx_a}\n\nDOCUMENT B: {doc_b['filename']}\n{ctx_b}\n\n"
              f"Compare the two documents. Cite A# and B# tags as evidence. JSON schema:\n{COMPARE_SCHEMA}")
    data, tokens = await complete_json(DOC_SYSTEM, prompt, ws["settings"].get("llm_model"))
    result = resolve_evidence(data, {**info_a["refs"], **info_b["refs"]})
    result["documents"] = {"a": {"id": doc_a["id"], "name": doc_a["filename"]}, "b": {"id": doc_b["id"], "name": doc_b["filename"]}}
    return await _save(ws["id"], "compare", f"{doc_a['id']}:{doc_b['id']}", {"a": doc_a["id"], "b": doc_b["id"]}, result,
                       tokens, (time.perf_counter() - t0) * 1000, f"Compared {doc_a['filename']} vs {doc_b['filename']}")


async def explain(ws: dict, concept: str, level: str, doc_ids: list[str] | None) -> dict:
    t0 = time.perf_counter()
    s = ws["settings"]
    ret = await retrieve(ws["id"], concept, s["mode"], s["top_k"], s["threshold"], doc_ids)
    citations = [{**r, "tag": f"S{i}"} for i, r in enumerate(ret["results"], start=1)]
    grounded = bool(citations)
    ctx = "\n\n".join(source_block(c["tag"], c["document_name"], c["page_start"], c["page_end"], c["text"]) for c in citations)
    instruction = (f"Explain the concept '{concept}' for a {level} audience. Structure: ## Simple explanation, ## Analogy or example, "
                   "## Key terminology (table), ## Learning notes (bullets), ## Check your understanding (3 questions).")
    if grounded:
        prompt = f"SOURCES:\n{ctx}\n\n{instruction}\nGround the explanation in the sources with [S#] citations."
    else:
        prompt = (f"{instruction}\nNo relevant passages exist in the user's knowledge base. Begin with the line "
                  "'> General AI-assisted explanation — not sourced from your documents.' and do not cite sources.")
    text, tokens = await complete(RAG_SYSTEM, prompt, s.get("llm_model"))
    result = {"markdown": text, "grounded": grounded, "citations": citations, "concept": concept, "level": level}
    return await _save(ws["id"], "explain", f"{concept.lower()}:{level}", {"concept": concept, "level": level}, result,
                       tokens, (time.perf_counter() - t0) * 1000, f"Explained: {concept[:60]}")


async def research(ws: dict, doc: dict) -> dict:
    t0 = time.perf_counter()
    ctx, info = await document_context(ws["id"], doc, "C", 45000)
    prompt = (f"Document: {doc['filename']}\n{ctx}\n\nAct as a senior research reviewer. Extract structured research intelligence. "
              "For research_gaps, identify 4-7 genuine gaps: weaknesses, unexplored conditions, missing evaluations or open problems "
              "that the document implies or explicitly acknowledges; each must be justified by evidence tags. "
              f"Use 'Not stated in the document' where applicable. JSON schema:\n{RESEARCH_SCHEMA}")
    data, tokens = await complete_json(DOC_SYSTEM, prompt, ws["settings"].get("llm_model"))
    result = {**resolve_evidence(data, info["refs"]), "coverage": {k: v for k, v in info.items() if k != "refs"}}
    return await _save(ws["id"], "research", doc["id"], {"document_id": doc["id"]}, result, tokens,
                       (time.perf_counter() - t0) * 1000, f"Research intelligence: {doc['filename']}")
