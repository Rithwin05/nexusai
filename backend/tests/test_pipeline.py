"""Pipeline integration test against the local MongoDB with a deterministic fake embedder (no OpenAI calls)."""
import asyncio
import hashlib
import re
import sys
import uuid
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import DEFAULT_SETTINGS  # noqa: E402
from core.db import db  # noqa: E402
from services import ingestion, retrieval  # noqa: E402

SAMPLE = Path(__file__).parent / "sample_peft.pdf"
LOOP = asyncio.new_event_loop()


def fake_vec(text: str) -> list[float]:
    v = np.zeros(1536, dtype=np.float32)
    for w in re.findall(r"[a-z]{3,}", text.lower()):
        v[int(hashlib.md5(w.encode()).hexdigest(), 16) % 1536] += 1
    return v.tolist()


async def fake_embed(texts, on_batch=None):
    if on_batch:
        await on_batch(len(texts), len(texts))
    return [fake_vec(t) for t in texts], 0


def test_ingest_retrieve_and_isolation(monkeypatch):
    monkeypatch.setattr(ingestion, "embed_texts", fake_embed)

    async def fake_query(text):
        return fake_vec(text), 0
    monkeypatch.setattr(retrieval, "embed_query", fake_query)

    async def scenario():
        ws_a, ws_b = f"test-{uuid.uuid4()}", f"test-{uuid.uuid4()}"
        doc = {"id": str(uuid.uuid4()), "workspace_id": ws_a, "filename": "sample_peft.pdf", "status": "queued"}
        await db.documents.insert_one(dict(doc))
        try:
            await ingestion.process(doc, dict(DEFAULT_SETTINGS, chunk_size=400, chunk_overlap=60), SAMPLE.read_bytes())
            saved = await db.documents.find_one({"id": doc["id"]})
            assert saved["status"] == "indexed", saved.get("error")
            assert saved["page_count"] == 2 and saved["chunk_count"] > 0

            ret = await retrieval.retrieve(ws_a, "LoRA low-rank matrices trainable parameters", "semantic", 3, 0.05)
            assert ret["results"] and "LoRA" in ret["results"][0]["text"]
            assert ret["results"][0]["page_start"] in (1, 2)

            kw = await retrieval.retrieve(ws_a, "quantisation", "keyword", 3, 0)
            assert kw["results"]

            other = await retrieval.retrieve(ws_b, "LoRA low-rank matrices", "hybrid", 3, 0.0)
            assert other["results"] == [] and other["insufficient"]

            none = await retrieval.retrieve(ws_a, "medieval castle architecture", "semantic", 3, 0.5)
            assert none["insufficient"]
        finally:
            await db.chunks.delete_many({"workspace_id": ws_a})
            await db.documents.delete_many({"workspace_id": ws_a})
            await db.ai_usage.delete_many({"workspace_id": ws_a})
            await db.activity.delete_many({"workspace_id": ws_a})

    LOOP.run_until_complete(scenario())


def test_failed_ingestion_rolls_back(monkeypatch):
    async def boom(texts, on_batch=None):
        raise RuntimeError("network down")
    monkeypatch.setattr(ingestion, "embed_texts", boom)

    async def scenario():
        ws = f"test-{uuid.uuid4()}"
        doc = {"id": str(uuid.uuid4()), "workspace_id": ws, "filename": "x.pdf", "status": "queued"}
        await db.documents.insert_one(dict(doc))
        try:
            await ingestion.process(doc, DEFAULT_SETTINGS, SAMPLE.read_bytes())
            saved = await db.documents.find_one({"id": doc["id"]})
            assert saved["status"] == "failed" and saved["chunk_count"] == 0
            assert await db.chunks.count_documents({"document_id": doc["id"]}) == 0
        finally:
            await db.documents.delete_many({"workspace_id": ws})
            await db.ai_usage.delete_many({"workspace_id": ws})
            await db.activity.delete_many({"workspace_id": ws})

    LOOP.run_until_complete(scenario())
