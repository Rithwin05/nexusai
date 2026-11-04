import asyncio
import logging
import time
import uuid

from core.config import EMBEDDING_MODEL
from core.db import db, now_iso
from services import retrieval
from services.chunking import chunk_pages
from services.embeddings import EmbeddingConfigError, embed_texts
from services.pdf import PdfError, extract_pages
from services.storage import get_object
from services.usage import log_activity, record_usage

logger = logging.getLogger("nexus.ingestion")
_tasks: set[asyncio.Task] = set()


async def _status(doc_id: str, **fields) -> None:
    await db.documents.update_one({"id": doc_id}, {"$set": {**fields, "updated_at": now_iso()}})


def schedule(doc: dict, settings: dict, data: bytes | None = None) -> None:
    task = asyncio.create_task(process(doc, settings, data))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def process(doc: dict, settings: dict, data: bytes | None = None) -> None:
    doc_id, ws_id = doc["id"], doc["workspace_id"]
    t0 = time.perf_counter()
    try:
        await db.chunks.delete_many({"document_id": doc_id})
        retrieval.invalidate(ws_id)
        await _status(doc_id, status="processing", stage="extracting", progress=5, error=None)
        if data is None:
            data = await get_object(doc["storage_path"])
        pages, meta = await asyncio.to_thread(extract_pages, data)
        if sum(len(p) for p in pages) < 40:
            raise PdfError("No extractable text found. The PDF may be scanned images (OCR is not supported yet).")

        await _status(doc_id, stage="chunking", progress=20, page_count=len(pages), metadata=meta,
                      char_count=sum(len(p) for p in pages))
        chunks = chunk_pages(pages, settings["chunk_size"], settings["chunk_overlap"])

        async def on_batch(done, total):
            await _status(doc_id, stage="embedding", progress=20 + int(70 * done / total))

        await _status(doc_id, stage="embedding", progress=25)
        vectors, tokens = await embed_texts([c["text"] for c in chunks], on_batch)

        await _status(doc_id, stage="storing", progress=95)
        rows = [{"id": str(uuid.uuid4()), "workspace_id": ws_id, "document_id": doc_id, **c,
                 "embedding": v, "embedding_model": EMBEDDING_MODEL, "created_at": now_iso()} for c, v in zip(chunks, vectors)]
        if not await db.documents.find_one({"id": doc_id}, {"_id": 1}):
            return  # document was deleted while processing
        for i in range(0, len(rows), 500):
            await db.chunks.insert_many(rows[i:i + 500])
        ms = round((time.perf_counter() - t0) * 1000)
        await _status(doc_id, status="indexed", stage="done", progress=100, chunk_count=len(rows),
                      processing_ms=ms, embedding_model=EMBEDDING_MODEL, indexed_at=now_iso())
        retrieval.invalidate(ws_id)
        await record_usage(ws_id, "ingestion", model=EMBEDDING_MODEL, embed_tokens=tokens, total_ms=ms, document_id=doc_id)
        await log_activity(ws_id, "indexed", f"Indexed {doc['filename']} · {len(rows)} chunks", doc_id)
    except Exception as exc:
        known = isinstance(exc, (PdfError, EmbeddingConfigError))
        msg = str(exc) if known else "Indexing failed due to an internal error. Please try re-indexing."
        logger.exception("ingestion failed doc=%s", doc_id) if not known else logger.warning("ingestion failed doc=%s: %s", doc_id, exc)
        await db.chunks.delete_many({"document_id": doc_id})  # rollback partial index
        retrieval.invalidate(ws_id)
        await _status(doc_id, status="failed", stage="failed", progress=0, chunk_count=0, error=msg,
                      processing_ms=round((time.perf_counter() - t0) * 1000))
        await record_usage(ws_id, "ingestion", success=False, error=msg, document_id=doc_id)
        await log_activity(ws_id, "failed", f"Failed to index {doc['filename']}", doc_id)
