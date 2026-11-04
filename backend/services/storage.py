import asyncio
import os

import requests

from core.config import APP_NAME, emergent_key

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
_storage_key = None


def init_storage(force: bool = False) -> str:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": emergent_key()}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _put(path: str, data: bytes, content_type: str) -> dict:
    for attempt in range(2):
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": init_storage(force=attempt > 0), "Content-Type": content_type},
                            data=data, timeout=120)
        if resp.status_code == 404 and attempt == 0:
            continue
        resp.raise_for_status()
        return resp.json()


def _get(path: str) -> bytes:
    for attempt in range(2):
        resp = requests.get(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": init_storage(force=attempt > 0)}, timeout=60)
        if resp.status_code == 404 and attempt == 0:
            continue
        resp.raise_for_status()
        return resp.content


def object_path(workspace_id: str, doc_id: str) -> str:
    return f"{APP_NAME}/documents/{workspace_id}/{doc_id}.pdf"


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    return await asyncio.to_thread(_put, path, data, content_type)


async def get_object(path: str) -> bytes:
    return await asyncio.to_thread(_get, path)
