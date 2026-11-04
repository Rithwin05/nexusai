import logging
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, TEXT, IndexModel
import certifi

from core.config import DB_NAME, MONGO_URL

client_kwargs = {}
if "mongodb+srv://" in MONGO_URL or "ssl=true" in MONGO_URL.lower() or "tls=true" in MONGO_URL.lower():
    client_kwargs["tlsCAFile"] = certifi.where()

client = AsyncIOMotorClient(MONGO_URL, **client_kwargs) if MONGO_URL else None
db = client[DB_NAME] if client is not None else None

INDEXES: dict[str, list[IndexModel]] = {
    "workspaces": [IndexModel([("id", ASCENDING)], unique=True, name="id"),
                   IndexModel([("owner_id", ASCENDING)], unique=True, name="owner")],
    "documents": [IndexModel([("id", ASCENDING)], unique=True, name="id"),
                  IndexModel([("workspace_id", ASCENDING), ("created_at", DESCENDING)], name="ws_created"),
                  IndexModel([("workspace_id", ASCENDING), ("sha256", ASCENDING)], name="ws_sha")],
    "chunks": [IndexModel([("id", ASCENDING)], unique=True, name="id"),
               IndexModel([("workspace_id", ASCENDING), ("document_id", ASCENDING), ("ordinal", ASCENDING)], name="ws_doc_ord"),
               IndexModel([("text", TEXT)], name="text_search")],
    "conversations": [IndexModel([("id", ASCENDING)], unique=True, name="id"),
                      IndexModel([("workspace_id", ASCENDING), ("updated_at", DESCENDING)], name="ws_updated")],
    "messages": [IndexModel([("id", ASCENDING)], unique=True, name="id"),
                 IndexModel([("conversation_id", ASCENDING), ("created_at", ASCENDING)], name="conv_created"),
                 IndexModel([("workspace_id", ASCENDING), ("role", ASCENDING)], name="ws_role")],
    "ai_usage": [IndexModel([("workspace_id", ASCENDING), ("created_at", DESCENDING)], name="ws_created")],
    "activity": [IndexModel([("workspace_id", ASCENDING), ("created_at", DESCENDING)], name="ws_created")],
    "search_logs": [IndexModel([("workspace_id", ASCENDING), ("created_at", DESCENDING)], name="ws_created")],
    "insights": [IndexModel([("workspace_id", ASCENDING), ("kind", ASCENDING), ("key", ASCENDING)], name="ws_kind_key")],
    "eval_items": [IndexModel([("workspace_id", ASCENDING), ("created_at", DESCENDING)], name="ws_created")],
    "eval_runs": [IndexModel([("workspace_id", ASCENDING), ("created_at", DESCENDING)], name="ws_created")],
}


async def ensure_indexes() -> None:
    if db is None:
        return
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logging.getLogger(__name__).error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
