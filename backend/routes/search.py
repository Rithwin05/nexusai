import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.db import db, now_iso
from core.deps import current_workspace, rate_limit
from routes.schemas import SearchIn
from services.embeddings import EmbeddingConfigError
from services.retrieval import retrieve
from services.usage import record_usage

router = APIRouter(prefix="/api", tags=["search"])


@router.post("/search")
async def search(body: SearchIn, ws: dict = Depends(current_workspace)):
    rate_limit(f"search:{ws['id']}", 60, 60)
    try:
        ret = await retrieve(ws["id"], body.query, body.mode, body.top_k, body.threshold, body.document_ids)
    except EmbeddingConfigError as exc:
        await record_usage(ws["id"], "search", success=False, error=str(exc))
        raise HTTPException(503, f"{exc} Keyword mode still works.")
    except Exception:
        await record_usage(ws["id"], "search", success=False, error="search_failed")
        raise HTTPException(502, "Search failed. Please try again.")
    await record_usage(ws["id"], "search", retrieval_ms=ret["retrieval_ms"], total_ms=ret["retrieval_ms"],
                       embed_tokens=ret["embed_tokens"], mode=body.mode)
    await db.search_logs.insert_one({"id": str(uuid.uuid4()), "workspace_id": ws["id"], "source": "search", "query": body.query,
                                     "mode": body.mode, "results": len(ret["results"]), "created_at": now_iso()})
    return ret
