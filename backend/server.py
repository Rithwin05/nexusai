import asyncio
import logging
import sys
from contextlib import suppress
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402
import os  # noqa: E402

from clerk_auth import clerk_router  # noqa: E402
from core.db import client, db, ensure_indexes, now_iso  # noqa: E402
from routes import analytics, chat, documents, evaluation, intelligence, search, workspace  # noqa: E402
from services.storage import init_storage  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("nexus")

app = FastAPI(title="NEXUS AI API")


@app.get("/api/health")
async def health():
    return {"ok": True, "service": "nexus-ai"}


for r in (documents, chat, search, intelligence, analytics, evaluation, workspace):
    app.include_router(r.router)
app.include_router(clerk_router)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logger.exception("unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    # Jobs interrupted by a restart are marked failed so they are never shown as ready.
    await db.documents.update_many({"status": {"$in": ["queued", "processing"]}},
                                   {"$set": {"status": "failed", "stage": "failed", "progress": 0, "updated_at": now_iso(),
                                             "error": "Processing was interrupted by a server restart. Please re-index."}})
    try:
        await asyncio.to_thread(init_storage)
    except Exception as exc:
        logger.error("Storage init failed: %s", exc)


@app.on_event("shutdown")
async def shutdown():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
