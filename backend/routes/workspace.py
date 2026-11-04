from fastapi import APIRouter, Depends, HTTPException

from core.config import ALLOWED_MODELS, EMBEDDING_DIM, EMBEDDING_MODEL, MAX_UPLOAD_MB, emergent_key
from core.db import db, now_iso
from core.deps import current_workspace
from routes.schemas import SettingsIn
from services.embeddings import embeddings_configured

router = APIRouter(prefix="/api", tags=["workspace"])


@router.get("/workspace")
async def get_workspace(ws: dict = Depends(current_workspace)):
    return {"id": ws["id"], "name": ws["name"], "settings": ws["settings"], "allowed_models": ALLOWED_MODELS,
            "system": {"embeddings_configured": embeddings_configured(), "llm_configured": bool(emergent_key()),
                       "embedding_model": EMBEDDING_MODEL, "embedding_dim": EMBEDDING_DIM, "max_upload_mb": MAX_UPLOAD_MB,
                       "vector_store": "MongoDB + in-memory cosine index (numpy)", "keyword_index": "MongoDB text index"}}


@router.put("/workspace/settings")
async def update_settings(body: SettingsIn, ws: dict = Depends(current_workspace)):
    if body.llm_model not in ALLOWED_MODELS:
        raise HTTPException(422, "Unsupported model")
    if body.chunk_overlap >= body.chunk_size // 2:
        raise HTTPException(422, "Overlap must be less than half the chunk size.")
    settings = body.model_dump(exclude={"workspace_name"})
    update = {"settings": settings, "updated_at": now_iso()}
    if body.workspace_name:
        update["name"] = body.workspace_name.strip()
    await db.workspaces.update_one({"id": ws["id"]}, {"$set": update})
    return {"ok": True, "settings": settings}
