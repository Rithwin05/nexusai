import random
import time
import uuid

from core.db import db, now_iso
from services.embeddings import embed_texts
from services.llm import complete_json
from services.prompts import DOC_SYSTEM
from services.retrieval import retrieve
from services.usage import log_activity, record_usage

METRIC_NOTES = {
    "recall_at_k": "Share of questions whose ground-truth passage (or expected document+keywords for manual items) appears in the top-K. Only one labelled relevant passage per question, so it behaves like Hit-Rate@K.",
    "precision_at_k": "Share of the K retrieved passages judged relevant (the source chunk, its direct neighbours, or keyword matches in the expected document). Underestimates when other relevant passages exist but are unlabelled.",
    "mrr": "Mean reciprocal rank of the first relevant passage. Sensitive only to the first hit.",
    "context_coverage": "For manual items: share of expected keywords present in the retrieved context. Lexical proxy, not semantic.",
    "latency": "Wall-clock retrieval time per question (excludes the batched query embedding).",
}
LIMITATIONS = ("Synthetic questions are generated from a single passage by the LLM and may share wording with it, which can "
               "inflate keyword and semantic scores. Answer faithfulness is not judged in this lightweight lab; treat "
               "results as a relative comparison between retrieval configurations, not absolute accuracy.")


async def generate_items(ws: dict, count: int, doc_ids: list[str] | None) -> tuple[list[dict], dict]:
    filt = {"workspace_id": ws["id"]}
    if doc_ids:
        filt["document_id"] = {"$in": doc_ids}
    chunks = await db.chunks.aggregate([{"$match": filt}, {"$match": {"$expr": {"$gte": [{"$strLenCP": "$text"}, 300]}}},
                                        {"$sample": {"size": count}}, {"$project": {"_id": 0, "embedding": 0}}]).to_list(count)
    if not chunks:
        return [], {}
    listing = "\n".join(f'<source id="{i}">{c["text"][:1500]}</source>' for i, c in enumerate(chunks))
    data, tokens = await complete_json(DOC_SYSTEM, "For each source passage write ONE specific question a researcher might ask that this "
                                       "passage answers. Paraphrase; avoid copying exact phrases.\n" + listing +
                                       '\nJSON schema: {"questions": [{"index": int, "question": str}]}', ws["settings"].get("llm_model"))
    items = []
    for q in data.get("questions", []):
        i = q.get("index")
        if isinstance(i, int) and 0 <= i < len(chunks) and q.get("question"):
            c = chunks[i]
            items.append({"id": str(uuid.uuid4()), "workspace_id": ws["id"], "kind": "synthetic", "question": q["question"][:500],
                          "source_chunk_id": c["id"], "document_id": c["document_id"], "source_ordinal": c["ordinal"],
                          "source_page": c.get("page_start"), "expected_keywords": [], "created_at": now_iso()})
    if items:
        await db.eval_items.insert_many([dict(x) for x in items])
    for x in items:
        x.pop("_id", None)
    await record_usage(ws["id"], "eval_generate", **tokens)
    return items, tokens


def _relevant(item: dict, r: dict) -> bool:
    if r["document_id"] != item["document_id"]:
        return False
    if item["kind"] == "synthetic":
        return r["chunk_id"] == item["source_chunk_id"] or abs(r["ordinal"] - item["source_ordinal"]) <= 1
    kws = [k.lower() for k in item.get("expected_keywords") or []]
    return not kws or any(k in r["text"].lower() for k in kws)


def _is_hit(item: dict, r: dict) -> bool:
    return r["chunk_id"] == item["source_chunk_id"] if item["kind"] == "synthetic" else _relevant(item, r)


async def run(ws: dict, mode: str, top_k: int, threshold: float, label: str | None) -> dict:
    items = await db.eval_items.find({"workspace_id": ws["id"]}, {"_id": 0}).to_list(500)
    if not items:
        raise ValueError("Add or generate benchmark questions first.")
    t0 = time.perf_counter()
    vectors = [None] * len(items)
    embed_tokens = 0
    if mode != "keyword":
        vectors, embed_tokens = await embed_texts([i["question"] for i in items])
    per, hits, precs, rrs, covs, lats = [], [], [], [], [], []
    for item, vec in zip(items, vectors):
        ret = await retrieve(ws["id"], item["question"], mode, top_k, threshold, None, vec)
        res = ret["results"]
        rel = [_relevant(item, r) for r in res]
        first = next((r["rank"] for r in res if _is_hit(item, r)), None)
        hit = first is not None
        prec = sum(rel) / top_k
        rr = 1 / first if first else 0.0
        cov = None
        if item["kind"] == "manual" and item.get("expected_keywords"):
            ctx = " ".join(r["text"].lower() for r in res)
            cov = sum(1 for k in item["expected_keywords"] if k.lower() in ctx) / len(item["expected_keywords"])
            covs.append(cov)
        hits.append(hit); precs.append(prec); rrs.append(rr); lats.append(ret["retrieval_ms"])
        per.append({"item_id": item["id"], "question": item["question"], "hit": hit, "first_relevant_rank": first,
                    "precision": round(prec, 3), "coverage": cov, "retrieval_ms": ret["retrieval_ms"],
                    "top_similarity": res[0]["similarity"] if res else None, "retrieved": len(res)})
    n = len(items)
    metrics = {"recall_at_k": round(sum(hits) / n, 4), "precision_at_k": round(sum(precs) / n, 4), "mrr": round(sum(rrs) / n, 4),
               "context_coverage": round(sum(covs) / len(covs), 4) if covs else None,
               "avg_latency_ms": round(sum(lats) / n, 1), "p95_latency_ms": round(sorted(lats)[int(0.95 * (n - 1))], 1)}
    doc = {"id": str(uuid.uuid4()), "workspace_id": ws["id"], "label": label or f"{mode} · k={top_k} · t={threshold}",
           "config": {"mode": mode, "top_k": top_k, "threshold": threshold}, "metrics": metrics, "questions": n,
           "results": per, "embed_tokens": embed_tokens, "duration_ms": round((time.perf_counter() - t0) * 1000), "created_at": now_iso()}
    await db.eval_runs.insert_one(dict(doc))
    await record_usage(ws["id"], "evaluation", embed_tokens=embed_tokens, total_ms=doc["duration_ms"])
    await log_activity(ws["id"], "evaluation", f"Evaluation run: Recall@{top_k} {metrics['recall_at_k']:.2f}", doc["id"])
    doc.pop("_id", None)
    return doc
