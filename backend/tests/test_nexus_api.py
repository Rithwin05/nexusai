"""NEXUS AI public-URL API regression tests (auth, isolation, upload validation, chat SSE, search, studio, eval, settings)."""
import io
import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

BASE_URL = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/")
HERE = Path(__file__).parent
SAMPLE = HERE / "sample_peft.pdf"
NOT_PDF = HERE / "not_a_pdf.pdf"
OTHER_EMAIL = "other.tester+clerk_test@example.com"


def _token(email=None):
    args = [sys.executable, str(HERE / "clerk_token.py")] + ([email] if email else [])
    return subprocess.check_output(args, cwd=str(HERE.parent), text=True).strip()


@pytest.fixture(scope="module")
def s1():
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {_token()}"
    return s


@pytest.fixture(scope="module")
def s2():
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {_token(OTHER_EMAIL)}"
    return s


@pytest.fixture(scope="module")
def sample_doc(s1):
    docs = s1.get(f"{BASE_URL}/api/documents").json()
    d = [x for x in docs if x["filename"] == "sample_peft.pdf" and x["status"] == "indexed"]
    if not d:
        pytest.skip("sample_peft.pdf not indexed")
    return d[0]


def make_pdf(text: str) -> bytes:
    from reportlab.pdfgen import canvas
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    y = 800
    for line in text.split("\n"):
        c.drawString(50, y, line)
        y -= 16
    c.save()
    return buf.getvalue()


def sse_events(resp):
    out = []
    for line in resp.iter_lines(decode_unicode=True):
        if line and line.startswith("data: "):
            out.append(json.loads(line[6:]))
    return out


# --- Auth: 401 without token
class TestAuth:
    @pytest.mark.parametrize("method,path", [
        ("get", "/api/documents"), ("get", "/api/conversations"), ("post", "/api/search"), ("get", "/api/workspace"),
        ("get", "/api/overview"), ("get", "/api/analytics"), ("get", "/api/evaluation/runs"), ("post", "/api/chat/stream"),
        ("post", "/api/intelligence/summary"), ("get", "/api/insights?kind=research"), ("put", "/api/workspace/settings"),
    ])
    def test_requires_token(self, method, path):
        r = getattr(requests, method)(f"{BASE_URL}{path}", json={})
        assert r.status_code == 401, (path, r.status_code, r.text[:200])

    def test_health_public(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200 and r.json()["ok"] is True

    def test_clerk_config_public(self):
        assert requests.get(f"{BASE_URL}/api/clerk/config").status_code == 200

    def test_bad_token(self):
        r = requests.get(f"{BASE_URL}/api/documents", headers={"Authorization": "Bearer garbage"})
        assert r.status_code == 401


# --- Workspace isolation between two users
class TestIsolation:
    def test_second_user_isolated(self, s1, s2, sample_doc):
        assert s2.get(f"{BASE_URL}/api/documents").json() == []
        assert s2.get(f"{BASE_URL}/api/conversations").json() == []
        did = sample_doc["id"]
        assert s2.get(f"{BASE_URL}/api/documents/{did}").status_code == 404
        assert s2.get(f"{BASE_URL}/api/documents/{did}/chunks").status_code == 404
        assert s2.get(f"{BASE_URL}/api/documents/{did}/file").status_code == 404
        assert s2.delete(f"{BASE_URL}/api/documents/{did}").status_code == 404
        assert s2.post(f"{BASE_URL}/api/intelligence/summary", json={"document_id": did}).status_code == 404
        assert s1.get(f"{BASE_URL}/api/documents/{did}").status_code == 200


# --- Upload validation + failed ingestion rollback (no OpenAI credits)
class TestUpload:
    def test_not_pdf_415(self, s1):
        r = s1.post(f"{BASE_URL}/api/documents/upload", files={"file": ("not_a_pdf.pdf", NOT_PDF.read_bytes(), "application/pdf")})
        assert r.status_code == 415, r.text

    def test_wrong_ext_415(self, s1):
        r = s1.post(f"{BASE_URL}/api/documents/upload", files={"file": ("a.txt", b"hello", "text/plain")})
        assert r.status_code == 415

    def test_duplicate_409(self, s1, sample_doc):
        r = s1.post(f"{BASE_URL}/api/documents/upload", files={"file": ("sample_peft.pdf", SAMPLE.read_bytes(), "application/pdf")})
        assert r.status_code == 409 and "already" in r.json()["detail"]

    def test_oversize_413(self, s1):
        data = b"%PDF-1.4\n" + b"0" * (21 * 1024 * 1024)
        r = s1.post(f"{BASE_URL}/api/documents/upload", files={"file": ("big.pdf", data, "application/pdf")})
        assert r.status_code == 413, r.status_code

    def test_new_pdf_ingestion_credit_aware(self, s1):
        pdf = make_pdf(f"TEST_upload {uuid.uuid4()}\nThis document discusses retrieval augmented generation pipelines.\n"
                       "It covers chunking, embeddings and reranking strategies for knowledge systems.")
        r = s1.post(f"{BASE_URL}/api/documents/upload", files={"file": ("TEST_upload.pdf", pdf, "application/pdf")})
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["status"] == "queued"
        try:
            final = None
            for _ in range(30):
                final = s1.get(f"{BASE_URL}/api/documents/{doc['id']}").json()
                if final["status"] in ("failed", "indexed"):
                    break
                time.sleep(1)
            ch = s1.get(f"{BASE_URL}/api/documents/{doc['id']}/chunks").json()
            if final["status"] == "failed":  # OpenAI account without credits -> rollback
                assert "no remaining credits" in (final["error"] or ""), final["error"]
                assert final["chunk_count"] == 0 and ch["total"] == 0
            else:  # credits available -> real indexing
                assert final["status"] == "indexed" and final["chunk_count"] > 0 and ch["total"] == final["chunk_count"]
            # reindex also fails gracefully
            rr = s1.post(f"{BASE_URL}/api/documents/{doc['id']}/reindex")
            assert rr.status_code == 200
        finally:
            for _ in range(20):
                d = s1.delete(f"{BASE_URL}/api/documents/{doc['id']}")
                if d.status_code != 409:
                    break
                time.sleep(1)
            assert s1.get(f"{BASE_URL}/api/documents/{doc['id']}").status_code == 404


# --- Documents detail endpoints
class TestDocuments:
    def test_chunks_and_file(self, s1, sample_doc):
        ch = s1.get(f"{BASE_URL}/api/documents/{sample_doc['id']}/chunks").json()
        assert ch["total"] == sample_doc["chunk_count"] and ch["chunks"][0]["page_start"] >= 1
        assert "embedding" not in ch["chunks"][0]
        f = s1.get(f"{BASE_URL}/api/documents/{sample_doc['id']}/file")
        assert f.status_code == 200 and f.content[:4] == b"%PDF"

    def test_filters(self, s1):
        assert all(d["status"] == "indexed" for d in s1.get(f"{BASE_URL}/api/documents?status=indexed").json())
        assert s1.get(f"{BASE_URL}/api/documents?q=zzznomatch").json() == []


# --- Search modes
class TestSearch:
    def test_keyword(self, s1, sample_doc):
        r = s1.post(f"{BASE_URL}/api/search", json={"query": "LoRA GPU memory", "mode": "keyword", "top_k": 5})
        assert r.status_code == 200
        res = r.json()["results"]
        assert res and res[0]["rank"] == 1 and res[0]["keyword_score"] > 0

    @pytest.mark.parametrize("mode", ["semantic", "hybrid"])
    def test_semantic_modes_credit_aware(self, s1, mode):
        r = s1.post(f"{BASE_URL}/api/search", json={"query": "LoRA", "mode": mode})
        if r.status_code == 503:
            assert "credits" in r.json()["detail"]
        else:
            assert r.status_code == 200 and r.json()["mode"] == mode and r.json()["embed_tokens"] > 0

    def test_validation(self, s1):
        assert s1.post(f"{BASE_URL}/api/search", json={"query": "", "mode": "keyword"}).status_code == 422


# --- Chat SSE + conversations + feedback + regenerate
class TestChat:
    def test_grounded_flow(self, s1, sample_doc):
        r = s1.post(f"{BASE_URL}/api/chat/stream", json={"question": "How much did LoRA reduce GPU memory?"}, stream=True, timeout=120)
        assert r.status_code == 200
        ev = sse_events(r)
        types = [e["type"] for e in ev]
        assert types[0] == "meta" and "sources" in types and types[-1] == "done", types[-3:]
        msg = ev[-1]["message"]
        conv_id = ev[0]["conversation_id"]
        try:
            assert msg["citations"] and "[S" in msg["content"], msg["content"][:300]
            assert msg["metrics"]["grounded"] is True
            assert s1.post(f"{BASE_URL}/api/messages/{msg['id']}/feedback", json={"rating": "up"}).json()["ok"]
            conv = s1.get(f"{BASE_URL}/api/conversations/{conv_id}").json()
            assert len(conv["messages"]) == 2 and conv["messages"][1]["feedback"]["rating"] == "up"
            # regenerate
            r2 = s1.post(f"{BASE_URL}/api/chat/stream", json={"question": "How much did LoRA reduce GPU memory?",
                                                              "conversation_id": conv_id, "regenerate": True}, stream=True, timeout=120)
            ev2 = sse_events(r2)
            assert ev2[-1]["type"] == "done"
            conv = s1.get(f"{BASE_URL}/api/conversations/{conv_id}").json()
            assert len(conv["messages"]) == 2
            assert conv["message_count"] == 2
        finally:
            assert s1.delete(f"{BASE_URL}/api/conversations/{conv_id}").status_code == 200
            assert s1.get(f"{BASE_URL}/api/conversations/{conv_id}").status_code == 404

    def test_insufficient(self, s1):
        r = s1.post(f"{BASE_URL}/api/chat/stream", json={"question": "zzqx flibbertigibbet"}, stream=True, timeout=120)
        ev = sse_events(r)
        conv_id = ev[0]["conversation_id"]
        try:
            msg = ev[-1]["message"]
            assert msg["citations"] == [] and msg["metrics"]["grounded"] is False
            assert "not contain enough evidence" in msg["content"]
        finally:
            s1.delete(f"{BASE_URL}/api/conversations/{conv_id}")

    def test_bad_feedback(self, s1):
        assert s1.post(f"{BASE_URL}/api/messages/nope/feedback", json={"rating": "up"}).status_code == 404
        assert s1.post(f"{BASE_URL}/api/messages/nope/feedback", json={"rating": "meh"}).status_code == 422


# --- Intelligence studio + research
class TestIntelligence:
    def test_sentiment_text(self, s1):
        r = s1.post(f"{BASE_URL}/api/intelligence/sentiment", json={"text": "I absolutely love this product, it is wonderful."}, timeout=120)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), dict)

    def test_sentiment_empty_422(self, s1):
        assert s1.post(f"{BASE_URL}/api/intelligence/sentiment", json={}).status_code == 422

    def test_compare_same_422(self, s1, sample_doc):
        r = s1.post(f"{BASE_URL}/api/intelligence/compare", json={"document_a": sample_doc["id"], "document_b": sample_doc["id"]})
        assert r.status_code == 422

    def test_research_cached(self, s1, sample_doc):
        r = s1.get(f"{BASE_URL}/api/insights", params={"kind": "research"})
        assert r.status_code == 200 and isinstance(r.json(), list)


# --- Evaluation lab
class TestEvaluation:
    def test_manual_item_and_run(self, s1, sample_doc):
        it = s1.post(f"{BASE_URL}/api/evaluation/items", json={"question": "TEST_ How much memory does LoRA save?",
                                                              "document_id": sample_doc["id"], "expected_keywords": ["LoRA"]})
        assert it.status_code == 200, it.text
        iid = it.json()["id"]
        try:
            assert any(i["id"] == iid for i in s1.get(f"{BASE_URL}/api/evaluation/items").json())
            runs = s1.get(f"{BASE_URL}/api/evaluation/runs").json()
            assert "metric_notes" in runs
        finally:
            assert s1.delete(f"{BASE_URL}/api/evaluation/items/{iid}").status_code == 200

    def test_run_semantic_credit_aware(self, s1, sample_doc):
        r = s1.post(f"{BASE_URL}/api/evaluation/run", json={"mode": "semantic"})
        assert r.status_code in (200, 503, 409), r.text
        if r.status_code == 200:
            assert 0 <= r.json()["metrics"]["recall_at_k"] <= 1


# --- Workspace settings
class TestSettings:
    def test_overlap_validation_and_roundtrip(self, s1):
        ws = s1.get(f"{BASE_URL}/api/workspace").json()
        st = ws["settings"]
        bad = dict(st, chunk_size=1000, chunk_overlap=500)
        assert s1.put(f"{BASE_URL}/api/workspace/settings", json=bad).status_code == 422
        ok = s1.put(f"{BASE_URL}/api/workspace/settings", json=dict(st, top_k=st["top_k"]))
        assert ok.status_code == 200
        assert s1.get(f"{BASE_URL}/api/workspace").json()["settings"]["mode"] == st["mode"]

    def test_overview_analytics(self, s1):
        o = s1.get(f"{BASE_URL}/api/overview")
        a = s1.get(f"{BASE_URL}/api/analytics")
        assert o.status_code == 200 and a.status_code == 200
