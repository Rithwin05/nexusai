import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.db import db, now_iso
from core.deps import current_workspace, rate_limit
from routes.schemas import EvalGenerateIn, EvalItemIn, EvalRunIn
from services import evaluation
from services.embeddings import EmbeddingConfigError

router = APIRouter(prefix="/api/evaluation", tags=["evaluation"])
logger = logging.getLogger("nexus.eval")


@router.get("/items")
async def list_items(ws: dict = Depends(current_workspace)):
    items = await db.eval_items.find({"workspace_id": ws["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    names = {d["id"]: d["filename"] for d in await db.documents.find({"workspace_id": ws["id"]}, {"_id": 0, "id": 1, "filename": 1}).to_list(None)}
    for i in items:
        i["document_name"] = names.get(i["document_id"])
    return items


@router.post("/items")
async def add_item(body: EvalItemIn, ws: dict = Depends(current_workspace)):
    if not await db.documents.find_one({"id": body.document_id, "workspace_id": ws["id"]}, {"_id": 1}):
        raise HTTPException(404, "Document not found")
    item = {"id": str(uuid.uuid4()), "workspace_id": ws["id"], "kind": "manual", "question": body.question.strip(),
            "document_id": body.document_id, "source_chunk_id": None, "source_ordinal": None, "source_page": None,
            "expected_keywords": [k.strip() for k in body.expected_keywords if k.strip()], "created_at": now_iso()}
    await db.eval_items.insert_one(dict(item))
    return item


@router.delete("/items/{item_id}")
async def delete_item(item_id: str, ws: dict = Depends(current_workspace)):
    if not (await db.eval_items.delete_one({"id": item_id, "workspace_id": ws["id"]})).deleted_count:
        raise HTTPException(404, "Item not found")
    return {"ok": True}


@router.post("/generate")
async def generate(body: EvalGenerateIn, ws: dict = Depends(current_workspace)):
    rate_limit(f"evalgen:{ws['id']}", 5, 60)
    try:
        items, _ = await evaluation.generate_items(ws, body.count, body.document_ids)
    except Exception:
        logger.exception("eval generate failed")
        raise HTTPException(502, "Question generation failed. Please try again.")
    if not items:
        raise HTTPException(409, "Index at least one document with enough text first.")
    return items


@router.post("/run")
async def run(body: EvalRunIn, ws: dict = Depends(current_workspace)):
    rate_limit(f"evalrun:{ws['id']}", 6, 60)
    try:
        return await evaluation.run(ws, body.mode, body.top_k, body.threshold, body.label)
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    except EmbeddingConfigError as exc:
        raise HTTPException(503, str(exc))
    except Exception:
        logger.exception("eval run failed")
        raise HTTPException(502, "Evaluation run failed. Please try again.")


@router.get("/runs")
async def runs(ws: dict = Depends(current_workspace)):
    rows = await db.eval_runs.find({"workspace_id": ws["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"runs": rows, "metric_notes": evaluation.METRIC_NOTES, "limitations": evaluation.LIMITATIONS}
