import bisect
import hashlib
import re

MIN_CHUNK_CHARS = 40


def _break_point(text: str, start: int, end: int, size: int) -> int:
    window_start = start + int(size * 0.6)
    for sep in ("\n\n", ". ", "? ", "! ", "; ", " "):
        idx = text.rfind(sep, window_start, end)
        if idx != -1:
            return idx + len(sep)
    return end


def chunk_pages(pages: list[str], size: int = 1200, overlap: int = 200) -> list[dict]:
    """Split page texts into overlapping chunks, keeping page provenance and dropping duplicates."""
    overlap = max(0, min(overlap, size // 2))
    full, offsets = "", []
    for page in pages:
        offsets.append(len(full))
        full += page + "\n\n"

    def page_at(pos: int) -> int:
        return bisect.bisect_right(offsets, pos)

    chunks, seen, start, n = [], set(), 0, len(full)
    while start < n:
        end = min(start + size, n)
        if end < n:
            end = _break_point(full, start, end, size)
        raw = full[start:end]
        text = raw.strip()
        if len(text) >= MIN_CHUNK_CHARS:
            digest = hashlib.sha1(re.sub(r"\s+", " ", text.lower()).encode()).hexdigest()
            if digest not in seen:
                seen.add(digest)
                lead = len(raw) - len(raw.lstrip())
                chunks.append({"ordinal": len(chunks), "text": text, "char_start": start + lead,
                               "page_start": page_at(start + lead), "page_end": page_at(max(start, end - 1))})
        if end >= n:
            break
        nxt = max(end - overlap, start + 1)
        space = full.find(" ", nxt, end)
        start = space + 1 if overlap and space != -1 else nxt
    return chunks
