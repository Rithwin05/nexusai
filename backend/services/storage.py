import io
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from core.db import db
from core.config import APP_NAME

_bucket = None


def get_bucket():
    global _bucket
    if _bucket is None:
        _bucket = AsyncIOMotorGridFSBucket(db)
    return _bucket


def init_storage(force: bool = False):
    return "mongo_gridfs"


def object_path(workspace_id: str, doc_id: str) -> str:
    return f"{APP_NAME}/documents/{workspace_id}/{doc_id}.pdf"


async def put_object(path: str, data: bytes, content_type: str = "application/pdf") -> dict:
    bucket = get_bucket()
    try:
        cursor = bucket.find({"filename": path})
        async for doc in cursor:
            await bucket.delete(doc["_id"])
    except Exception:
        pass

    grid_in = bucket.open_upload_stream(path, metadata={"content_type": content_type})
    await grid_in.write(data)
    await grid_in.close()
    return {"path": path, "id": str(grid_in._id)}


async def get_object(path: str) -> bytes:
    bucket = get_bucket()
    grid_out = await bucket.open_download_stream_by_name(path)
    return await grid_out.read()
