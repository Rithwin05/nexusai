import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.chunking import chunk_pages  # noqa: E402
from services.doc_context import resolve_evidence  # noqa: E402
from services.llm import parse_json  # noqa: E402
from services.pdf import clean_text, is_pdf  # noqa: E402


def test_chunks_track_pages_and_overlap():
    pages = ["Alpha sentence one. " * 40, "Beta sentence two. " * 40]
    chunks = chunk_pages(pages, size=400, overlap=80)
    assert len(chunks) > 3
    assert chunks[0]["page_start"] == 1
    assert chunks[-1]["page_end"] == 2
    assert all(len(c["text"]) <= 400 for c in chunks)
    assert [c["ordinal"] for c in chunks] == list(range(len(chunks)))


def test_chunks_skip_duplicates_and_tiny():
    chunks = chunk_pages(["x", "Repeated block of meaningful text here. " * 5, "Repeated block of meaningful text here. " * 5], 1000, 0)
    texts = [c["text"] for c in chunks]
    assert len(texts) == len(set(texts))


def test_clean_text_dehyphenates():
    assert clean_text("trans-\nformer   model") == "transformer model"


def test_is_pdf():
    assert is_pdf(b"%PDF-1.7 ...")
    assert not is_pdf(b"<html>")


def test_parse_json_fences():
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_resolve_evidence_drops_unknown_tags():
    refs = {"C1": {"tag": "C1"}}
    out = resolve_evidence({"items": [{"evidence": ["C1", "C9"]}]}, refs)
    assert out["items"][0]["evidence"] == [{"tag": "C1"}]
