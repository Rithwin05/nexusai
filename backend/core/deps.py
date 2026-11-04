import time
import uuid
from collections import defaultdict, deque

from fastapi import Depends, HTTPException

from clerk_auth import require_user
from core.config import DEFAULT_SETTINGS
from core.db import db, now_iso


async def current_workspace(user: dict = Depends(require_user)) -> dict:
    """Server-side resolved workspace: clients never choose a workspace id."""
    uid = user["user_id"]
    ws = await db.workspaces.find_one({"owner_id": uid}, {"_id": 0})
    if ws is None:
        ws = {"id": str(uuid.uuid4()), "owner_id": uid, "name": "Personal Workspace",
              "settings": dict(DEFAULT_SETTINGS), "created_at": now_iso(), "updated_at": now_iso()}
        await db.workspaces.update_one({"owner_id": uid}, {"$setOnInsert": ws}, upsert=True)
        ws = await db.workspaces.find_one({"owner_id": uid}, {"_id": 0})
    ws["settings"] = {**DEFAULT_SETTINGS, **(ws.get("settings") or {})}
    return ws


_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(key: str, limit: int = 30, window: int = 60) -> None:
    q = _hits[key]
    now = time.monotonic()
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a moment and try again.")
    q.append(now)
