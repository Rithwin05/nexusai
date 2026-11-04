import time

import numpy as np

from core.db import db
from services.embeddings import embed_query

RRF_K = 60
_cache: dict[str, dict] = {}


def invalidate(workspace_id: str) -> None:
    _cache.pop(workspace_id, None)


async def _index(workspace_id: str) -> dict:
    if workspace_id not in _cache:
        rows = await db.chunks.find({"workspace_id": workspace_id},
                                    {"_id": 0, "id": 1, "document_id": 1, "embedding": 1}).to_list(None)
        ids = [r["id"] for r in rows]
        mat = np.array([r["embedding"] for r in rows], dtype=np.float32) if rows else np.zeros((0, 1536), np.float32)
        if len(mat):
            mat /= np.linalg.norm(mat, axis=1, keepdims=True) + 1e-12
        _cache[workspace_id] = {"ids": ids, "doc_ids": np.array([r["document_id"] for r in rows]),
                                "pos": {cid: i for i, cid in enumerate(ids)}, "mat": mat}
    return _cache[workspace_id]


def _mask(idx: dict, doc_ids: list[str] | None):
    if not doc_ids:
        return np.ones(len(idx["ids"]), dtype=bool)
    return np.isin(idx["doc_ids"], doc_ids)


def _cosines(idx: dict, qvec: list[float]) -> np.ndarray:
    q = np.asarray(qvec, dtype=np.float32)
    q /= np.linalg.norm(q) + 1e-12
    return idx["mat"] @ q if len(idx["mat"]) else np.zeros(0, np.float32)


async def _keyword(workspace_id: str, query: str, k: int, doc_ids: list[str] | None) -> list[tuple[str, float]]:
    filt = {"workspace_id": workspace_id, "$text": {"$search": query}}
    if doc_ids:
        filt["document_id"] = {"$in": doc_ids}
    rows = await db.chunks.find(filt, {"_id": 0, "id": 1, "score": {"$meta": "textScore"}}) \
        .sort([("score", {"$meta": "textScore"})]).limit(k).to_list(k)
    return [(r["id"], float(r["score"])) for r in rows]


async def retrieve(workspace_id: str, query: str, mode: str = "hybrid", top_k: int = 6, threshold: float = 0.25,
                   doc_ids: list[str] | None = None, qvec: list[float] | None = None) -> dict:
    """Workspace-scoped retrieval. Similarity = cosine similarity (higher is closer, range -1..1)."""
    t0, embed_tokens = time.perf_counter(), 0
    idx = await _index(workspace_id)
    sims = None
    if mode in ("semantic", "hybrid"):
        if qvec is None:
            qvec, embed_tokens = await embed_query(query)
        sims = _cosines(idx, qvec)
    embed_ms = (time.perf_counter() - t0) * 1000

    candidates: dict[str, dict] = {}
    pool = max(top_k * 4, 20)
    if sims is not None and len(sims):
        masked = np.where(_mask(idx, doc_ids), sims, -np.inf)
        order = np.argsort(-masked)[:pool]
        for rank, i in enumerate(order):
            if np.isfinite(masked[i]):
                candidates[idx["ids"][i]] = {"semantic_rank": rank + 1}
    if mode in ("keyword", "hybrid"):
        for rank, (cid, score) in enumerate(await _keyword(workspace_id, query, pool, doc_ids)):
            candidates.setdefault(cid, {}).update(keyword_rank=rank + 1, keyword_score=round(score, 4))

    for cid, c in candidates.items():
        c["similarity"] = float(sims[idx["pos"][cid]]) if sims is not None and cid in idx["pos"] else None
        c["fused_score"] = sum(1 / (RRF_K + c[r]) for r in ("semantic_rank", "keyword_rank") if r in c)

    best = max((c["similarity"] for c in candidates.values() if c["similarity"] is not None), default=None)
    if mode == "semantic":
        ranked = sorted(candidates.items(), key=lambda kv: -kv[1]["similarity"])
    elif mode == "keyword":
        ranked = sorted(candidates.items(), key=lambda kv: -kv[1].get("keyword_score", 0))
    else:
        ranked = sorted(candidates.items(), key=lambda kv: -kv[1]["fused_score"])
    if mode != "keyword":
        ranked = [kv for kv in ranked if kv[1]["similarity"] is not None and kv[1]["similarity"] >= threshold]
    ranked = ranked[:top_k]

    results = await hydrate(workspace_id, ranked)
    return {"results": results, "mode": mode, "best_similarity": best, "insufficient": not results,
            "embed_tokens": embed_tokens, "embed_ms": round(embed_ms, 1),
            "retrieval_ms": round((time.perf_counter() - t0) * 1000, 1), "searched_chunks": int(_mask(idx, doc_ids).sum())}


async def hydrate(workspace_id: str, ranked: list[tuple[str, dict]]) -> list[dict]:
    ids = [cid for cid, _ in ranked]
    rows = await db.chunks.find({"workspace_id": workspace_id, "id": {"$in": ids}}, {"_id": 0, "embedding": 0}).to_list(None)
    by_id = {r["id"]: r for r in rows}
    docs = await db.documents.find({"workspace_id": workspace_id, "id": {"$in": list({r["document_id"] for r in rows})}},
                                   {"_id": 0, "id": 1, "filename": 1}).to_list(None)
    names = {d["id"]: d["filename"] for d in docs}
    out = []
    for rank, (cid, meta) in enumerate(ranked, start=1):
        r = by_id.get(cid)
        if not r or r["document_id"] not in names:
            continue
        out.append({"rank": rank, "chunk_id": cid, "document_id": r["document_id"], "document_name": names[r["document_id"]],
                    "ordinal": r["ordinal"], "page_start": r.get("page_start"), "page_end": r.get("page_end"),
                    "text": r["text"], "similarity": None if meta.get("similarity") is None else round(meta["similarity"], 4),
                    "keyword_score": meta.get("keyword_score"), "fused_score": round(meta.get("fused_score", 0), 5),
                    "matched_by": [m for m in ("semantic", "keyword") if f"{m}_rank" in meta]})
    return out
