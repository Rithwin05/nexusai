import logging
import uuid

from core.db import db, now_iso

logger = logging.getLogger("nexus.usage")


async def record_usage(workspace_id: str, op: str, success: bool = True, error: str | None = None, **fields) -> None:
    doc = {"id": str(uuid.uuid4()), "workspace_id": workspace_id, "op": op, "success": success,
           "error": error, "created_at": now_iso(), **fields}
    await db.ai_usage.insert_one(doc)
    logger.info("usage op=%s ok=%s %s", op, success, {k: v for k, v in fields.items() if k.endswith(("_ms", "_tokens"))})


async def log_activity(workspace_id: str, kind: str, title: str, ref: str | None = None) -> None:
    await db.activity.insert_one({"id": str(uuid.uuid4()), "workspace_id": workspace_id, "kind": kind,
                                  "title": title, "ref": ref, "created_at": now_iso()})
