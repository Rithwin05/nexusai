from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from core.db import db
from core.deps import current_workspace

router = APIRouter(prefix="/api", tags=["analytics"])


def _pct(values: list[float], p: float):
    values = sorted(v for v in values if v is not None)
    return round(values[int(p * (len(values) - 1))], 1) if values else None


@router.get("/overview")
async def overview(ws: dict = Depends(current_workspace)):
    wid = ws["id"]
    status_counts = {s["_id"]: s["n"] for s in await db.documents.aggregate(
        [{"$match": {"workspace_id": wid}}, {"$group": {"_id": "$status", "n": {"$sum": 1}}}]).to_list(None)}
    tokens = await db.ai_usage.aggregate([{"$match": {"workspace_id": wid}}, {"$group": {
        "_id": None, "inp": {"$sum": {"$ifNull": ["$input_tokens", 0]}}, "out": {"$sum": {"$ifNull": ["$output_tokens", 0]}},
        "emb": {"$sum": {"$ifNull": ["$embed_tokens", 0]}}, "calls": {"$sum": 1}}}]).to_list(1)
    t = tokens[0] if tokens else {"inp": 0, "out": 0, "emb": 0, "calls": 0}
    return {
        "workspace": {"id": wid, "name": ws["name"]},
        "documents": sum(status_counts.values()), "status_counts": status_counts,
        "chunks": await db.chunks.count_documents({"workspace_id": wid}),
        "questions": await db.messages.count_documents({"workspace_id": wid, "role": "user"}),
        "conversations": await db.conversations.count_documents({"workspace_id": wid}),
        "tokens": {"input": t["inp"], "output": t["out"], "embedding": t["emb"], "ai_calls": t["calls"]},
        "recent_documents": await db.documents.find({"workspace_id": wid}, {"_id": 0, "storage_path": 0, "metadata": 0})
            .sort("created_at", -1).limit(5).to_list(5),
        "recent_conversations": await db.conversations.find({"workspace_id": wid}, {"_id": 0}).sort("updated_at", -1).limit(5).to_list(5),
        "activity": await db.activity.find({"workspace_id": wid}, {"_id": 0}).sort("created_at", -1).limit(12).to_list(12),
    }


@router.get("/analytics")
async def analytics(ws: dict = Depends(current_workspace)):
    wid = ws["id"]
    since = (datetime.now(timezone.utc) - timedelta(days=13)).date().isoformat()
    usage = await db.ai_usage.find({"workspace_id": wid}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    by_op: dict[str, dict] = {}
    for u in usage:
        o = by_op.setdefault(u["op"], {"op": u["op"], "count": 0, "failures": 0, "total_ms": [], "retrieval_ms": [], "generation_ms": [],
                                       "input_tokens": 0, "output_tokens": 0, "embed_tokens": 0})
        o["count"] += 1
        o["failures"] += 0 if u.get("success", True) else 1
        for k in ("total_ms", "retrieval_ms", "generation_ms"):
            if u.get(k) is not None:
                o[k].append(u[k])
        for k in ("input_tokens", "output_tokens", "embed_tokens"):
            o[k] += u.get(k) or 0
    ops = []
    for o in by_op.values():
        lat = {f"avg_{k}": round(sum(o[k]) / len(o[k]), 1) if o[k] else None for k in ("total_ms", "retrieval_ms", "generation_ms")}
        ops.append({**{k: v for k, v in o.items() if not k.endswith("_ms")}, **lat, "p95_total_ms": _pct(o["total_ms"], 0.95)})

    days = [(datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat() for i in range(13, -1, -1)]
    series = {d: {"date": d[5:], "queries": 0, "tokens": 0, "failures": 0} for d in days}
    for u in usage:
        d = u["created_at"][:10]
        if d >= since and d in series:
            series[d]["queries"] += 1 if u["op"] in ("chat", "search") else 0
            series[d]["tokens"] += (u.get("input_tokens") or 0) + (u.get("output_tokens") or 0) + (u.get("embed_tokens") or 0)
            series[d]["failures"] += 0 if u.get("success", True) else 1
    chat_lat = [{"total": u.get("total_ms"), "retrieval": u.get("retrieval_ms"), "generation": u.get("generation_ms"),
                 "at": u["created_at"]} for u in usage if u["op"] == "chat" and u.get("success", True)][:30][::-1]
    fb = {f["_id"]: f["n"] for f in await db.messages.aggregate([{"$match": {"workspace_id": wid, "feedback": {"$ne": None}}},
          {"$group": {"_id": "$feedback.rating", "n": {"$sum": 1}}}]).to_list(None)}
    docs = await db.documents.find({"workspace_id": wid}, {"_id": 0, "status": 1, "processing_ms": 1}).to_list(None)
    failures = [{"op": u["op"], "error": u.get("error"), "at": u["created_at"]} for u in usage if not u.get("success", True)][:15]
    return {"ops": ops, "series": list(series.values()), "chat_latency": chat_lat,
            "feedback": {"up": fb.get("up", 0), "down": fb.get("down", 0)},
            "documents": {"total": len(docs), "failed": sum(1 for d in docs if d["status"] == "failed"),
                          "indexed": sum(1 for d in docs if d["status"] == "indexed"),
                          "avg_processing_ms": round(sum(d["processing_ms"] for d in docs if d.get("processing_ms") and d["status"] == "indexed")
                                                     / max(1, sum(1 for d in docs if d.get("processing_ms") and d["status"] == "indexed")))},
            "chunks": await db.chunks.count_documents({"workspace_id": wid}),
            "insufficient_answers": sum(1 for u in usage if u["op"] == "chat" and u.get("insufficient")),
            "recent_failures": failures}
