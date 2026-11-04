import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "nexus_ai")
LLM_MODEL = os.environ.get("LLM_MODEL") or "gpt-4o"
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL") or "text-embedding-3-small"
EMBEDDING_DIM = 1536
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB") or 20)
APP_NAME = "nexus-ai"

ALLOWED_MODELS = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4.1",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.2",
]

DEFAULT_SETTINGS = {
    "top_k": 6,
    "threshold": 0.25,
    "mode": "hybrid",
    "chunk_size": 1200,
    "chunk_overlap": 200,
    "llm_model": LLM_MODEL,
}


def emergent_key() -> str:
    return os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("OPENAI_API_KEY", "")


def openai_key() -> str:
    return os.environ.get("OPENAI_API_KEY", "")
