from fastapi import HTTPException

from core.db import db
from services.prompts import source_block


async def indexed_document(ws_id: str, doc_id: str) -> dict:
    doc = await db.documents.find_one({"id": doc_id, "workspace_id": ws_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc["status"] != "indexed":
        raise HTTPException(409, "Document is not indexed yet")
    return doc


async def document_context(ws_id: str, doc: dict, prefix: str = "C", budget: int = 40000) -> tuple[str, dict]:
    """Evenly sample chunks across the document within a character budget. Returns (context, tag->chunk ref)."""
    chunks = await db.chunks.find({"workspace_id": ws_id, "document_id": doc["id"]}, {"_id": 0, "embedding": 0}) \
        .sort("ordinal", 1).to_list(None)
    total = sum(len(c["text"]) for c in chunks) or 1
    step = max(1.0, total / budget)
    picked, acc = [], 0.0
    for i, c in enumerate(chunks):
        if i >= acc:
            picked.append(c)
            acc += step
    refs, blocks = {}, []
    for i, c in enumerate(picked, start=1):
        tag = f"{prefix}{i}"
        refs[tag] = {"tag": tag, "chunk_id": c["id"], "document_id": doc["id"], "document_name": doc["filename"],
                     "page_start": c.get("page_start"), "page_end": c.get("page_end"), "ordinal": c["ordinal"], "text": c["text"]}
        blocks.append(source_block(tag, doc["filename"], c.get("page_start"), c.get("page_end"), c["text"]))
    coverage = round(len(picked) / max(len(chunks), 1), 3)
    return "\n\n".join(blocks), {"refs": refs, "coverage": coverage, "chunks_used": len(picked), "chunks_total": len(chunks)}


def resolve_evidence(obj, refs: dict):
    """Replace evidence tag lists in model output with real chunk references; drop unknown tags."""
    if isinstance(obj, dict):
        return {k: ([refs[t] for t in v if isinstance(t, str) and t in refs] if k == "evidence" and isinstance(v, list)
                    else resolve_evidence(v, refs)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [resolve_evidence(v, refs) for v in obj]
    return obj
