import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from core.db import db
from core.deps import current_workspace, rate_limit
from routes.schemas import CompareIn, DocIn, ExplainIn, SentimentIn
from services import intelligence as intel
from services.doc_context import indexed_document
from services.embeddings import EmbeddingConfigError
from services.usage import record_usage

router = APIRouter(prefix="/api", tags=["intelligence"])
logger = logging.getLogger("nexus.intelligence")


async def _run(ws: dict, op: str, coro):
    rate_limit(f"intel:{ws['id']}", 15, 60)
    try:
        return await coro
    except HTTPException:
        raise
    except EmbeddingConfigError as exc:
        raise HTTPException(503, str(exc))
    except Exception:
        logger.exception("%s failed", op)
        await record_usage(ws["id"], op, success=False, error=f"{op}_failed")
        raise HTTPException(502, "The AI analysis failed. Please try again.")


@router.post("/intelligence/summary")
async def summary(body: DocIn, ws: dict = Depends(current_workspace)):
    doc = await indexed_document(ws["id"], body.document_id)
    return await _run(ws, "summary", intel.summarize(ws, doc))


@router.post("/intelligence/sentiment")
async def sentiment(body: SentimentIn, ws: dict = Depends(current_workspace)):
    if not body.document_id and not (body.text and body.text.strip()):
        raise HTTPException(422, "Provide a document or some text.")
    doc = await indexed_document(ws["id"], body.document_id) if body.document_id else None
    return await _run(ws, "sentiment", intel.sentiment(ws, doc, body.text))


@router.post("/intelligence/compare")
async def compare(body: CompareIn, ws: dict = Depends(current_workspace)):
    if body.document_a == body.document_b:
        raise HTTPException(422, "Choose two different documents.")
    a = await indexed_document(ws["id"], body.document_a)
    b = await indexed_document(ws["id"], body.document_b)
    return await _run(ws, "compare", intel.compare(ws, a, b))


@router.post("/intelligence/explain")
async def explain(body: ExplainIn, ws: dict = Depends(current_workspace)):
    return await _run(ws, "explain", intel.explain(ws, body.concept.strip(), body.level, body.document_ids))


@router.post("/research/analyze")
async def research(body: DocIn, ws: dict = Depends(current_workspace)):
    doc = await indexed_document(ws["id"], body.document_id)
    return await _run(ws, "research", intel.research(ws, doc))


@router.get("/insights")
async def get_insight(kind: str = Query(..., pattern="^(summary|sentiment|compare|explain|research)$"),
                      key: str | None = None, ws: dict = Depends(current_workspace)):
    filt = {"workspace_id": ws["id"], "kind": kind}
    if key:
        filt["key"] = key
        return await db.insights.find_one(filt, {"_id": 0}, sort=[("created_at", -1)])
    return await db.insights.find(filt, {"_id": 0, "id": 1, "key": 1, "params": 1, "created_at": 1, "latency_ms": 1}) \
        .sort("created_at", -1).to_list(50)
