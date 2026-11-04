import hashlib
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile

from core.config import MAX_UPLOAD_MB
from core.db import db, now_iso
from core.deps import current_workspace
from services import ingestion, retrieval
from services.pdf import is_pdf
from services.storage import get_object, object_path, put_object
from services.usage import log_activity

router = APIRouter(prefix="/api/documents", tags=["documents"])
LIST_FIELDS = {"_id": 0, "storage_path": 0}


async def _get_doc(ws: dict, doc_id: str) -> dict:
    doc = await db.documents.find_one({"id": doc_id, "workspace_id": ws["id"]}, LIST_FIELDS)
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.post("/upload")
async def upload(file: UploadFile = File(...), ws: dict = Depends(current_workspace)):
    name = (file.filename or "document.pdf").strip()[:200]
    if not name.lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise HTTPException(415, "Only PDF files are supported.")
    data = await file.read(MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds the {MAX_UPLOAD_MB} MB limit.")
    if not data:
        raise HTTPException(400, "The file is empty.")
    if not is_pdf(data):
        raise HTTPException(415, "The file content is not a valid PDF.")
    sha = hashlib.sha256(data).hexdigest()
    dup = await db.documents.find_one({"workspace_id": ws["id"], "sha256": sha}, {"_id": 0, "id": 1, "filename": 1})
    if dup:
        raise HTTPException(409, f"This file is already in your knowledge base as \"{dup['filename']}\".")

    doc_id = str(uuid.uuid4())
    try:
        stored = await put_object(object_path(ws["id"], doc_id), data, "application/pdf")
    except Exception:
        raise HTTPException(502, "Could not store the file. Please try again.")
    doc = {"id": doc_id, "workspace_id": ws["id"], "filename": name, "file_type": "pdf", "size": len(data), "sha256": sha,
           "storage_path": stored["path"], "status": "queued", "stage": "queued", "progress": 0, "error": None,
           "page_count": None, "chunk_count": 0, "processing_ms": None, "metadata": {}, "created_at": now_iso(), "updated_at": now_iso()}
    await db.documents.insert_one(dict(doc))
    await log_activity(ws["id"], "upload", f"Uploaded {name}", doc_id)
    ingestion.schedule(doc, ws["settings"], data)
    return {k: v for k, v in doc.items() if k not in ("storage_path", "_id")}


@router.get("")
async def list_documents(q: str | None = Query(None, max_length=200), status: str | None = None,
                         ws: dict = Depends(current_workspace)):
    filt = {"workspace_id": ws["id"]}
    if status in ("queued", "processing", "indexed", "failed"):
        filt["status"] = status
    docs = await db.documents.find(filt, LIST_FIELDS).sort("created_at", -1).to_list(1000)
    if q:
        docs = [d for d in docs if q.lower() in d["filename"].lower()]
    return docs


@router.get("/{doc_id}")
async def get_document(doc_id: str, ws: dict = Depends(current_workspace)):
    return await _get_doc(ws, doc_id)


@router.get("/{doc_id}/chunks")
async def get_chunks(doc_id: str, skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
                     q: str | None = Query(None, max_length=200), ws: dict = Depends(current_workspace)):
    await _get_doc(ws, doc_id)
    filt = {"workspace_id": ws["id"], "document_id": doc_id}
    if q:
        filt["text"] = {"$regex": __import__("re").escape(q), "$options": "i"}
    total = await db.chunks.count_documents(filt)
    rows = await db.chunks.find(filt, {"_id": 0, "embedding": 0}).sort("ordinal", 1).skip(skip).limit(limit).to_list(limit)
    return {"total": total, "chunks": rows}


@router.get("/{doc_id}/file")
async def get_file(doc_id: str, ws: dict = Depends(current_workspace)):
    doc = await db.documents.find_one({"id": doc_id, "workspace_id": ws["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")
    try:
        data = await get_object(doc["storage_path"])
    except Exception:
        raise HTTPException(502, "Could not load the original file.")
    return Response(content=data, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{doc_id}.pdf"'})


@router.post("/{doc_id}/reindex")
async def reindex(doc_id: str, ws: dict = Depends(current_workspace)):
    doc = await db.documents.find_one({"id": doc_id, "workspace_id": ws["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc["status"] in ("queued", "processing"):
        raise HTTPException(409, "Document is already being processed.")
    await db.documents.update_one({"id": doc_id}, {"$set": {"status": "queued", "stage": "queued", "progress": 0, "error": None}})
    ingestion.schedule(doc, ws["settings"])
    return {"ok": True}


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, ws: dict = Depends(current_workspace)):
    doc = await _get_doc(ws, doc_id)
    if doc["status"] in ("processing", "queued"):
        raise HTTPException(409, "Wait for processing to finish before deleting.")
    scope = {"workspace_id": ws["id"], "document_id": doc_id}
    removed = (await db.chunks.delete_many(scope)).deleted_count
    await db.eval_items.delete_many(scope)
    await db.insights.delete_many({"workspace_id": ws["id"], "key": {"$regex": doc_id}})
    await db.documents.delete_one({"id": doc_id, "workspace_id": ws["id"]})
    retrieval.invalidate(ws["id"])
    await log_activity(ws["id"], "delete", f"Deleted {doc['filename']}", doc_id)
    return {"ok": True, "chunks_removed": removed}
