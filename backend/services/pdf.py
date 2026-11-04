import io
import re
import unicodedata

from pypdf import PdfReader


class PdfError(Exception):
    pass


def is_pdf(data: bytes) -> bool:
    return data[:1024].lstrip().startswith(b"%PDF-")


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).replace("\x00", "")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)          # de-hyphenate line breaks
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"(?<![.\n:;!?])\n(?!\n)", " ", text)    # join wrapped lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pages(data: bytes) -> tuple[list[str], dict]:
    """Return cleaned text per page (index 0 = page 1) and document metadata."""
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            raise PdfError("The PDF is password-protected.")
        pages = [clean_text(page.extract_text() or "") for page in reader.pages]
    except PdfError:
        raise
    except Exception as exc:
        raise PdfError("The PDF could not be parsed. It may be corrupted.") from exc
    meta = {}
    try:
        info = reader.metadata or {}
        meta = {k: str(v)[:300] for k, v in {"title": info.get("/Title"), "author": info.get("/Author"),
                                              "subject": info.get("/Subject"), "creator": info.get("/Creator")}.items() if v}
    except Exception:
        pass
    return pages, meta
