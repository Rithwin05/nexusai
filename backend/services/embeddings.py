import openai
from openai import AsyncOpenAI

from core.config import EMBEDDING_DIM, EMBEDDING_MODEL, openai_key

BATCH_SIZE = 64
_clients: dict[str, AsyncOpenAI] = {}


class EmbeddingConfigError(Exception):
    pass


def embeddings_configured() -> bool:
    return bool(openai_key())


def _client() -> AsyncOpenAI:
    key = openai_key()
    if not key:
        raise EmbeddingConfigError("Embeddings are not configured: OPENAI_API_KEY is missing on the server.")
    if key not in _clients:
        _clients.clear()
        _clients[key] = AsyncOpenAI(api_key=key, timeout=60, max_retries=3)
    return _clients[key]


async def embed_texts(texts: list[str], on_batch=None) -> tuple[list[list[float]], int]:
    """Embed in ordered batches. Returns (vectors, total_tokens)."""
    client, vectors, tokens = _client(), [], 0
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        try:
            resp = await client.embeddings.create(model=EMBEDDING_MODEL, input=batch, dimensions=EMBEDDING_DIM)
        except openai.AuthenticationError as exc:
            raise EmbeddingConfigError("OpenAI rejected the API key used for embeddings. Update OPENAI_API_KEY.") from exc
        except openai.RateLimitError as exc:
            if "insufficient_quota" in str(exc) or "credit" in str(exc):
                raise EmbeddingConfigError("The OpenAI account used for embeddings has no remaining credits. Add billing credits, then re-index.") from exc
            raise
        data = sorted(resp.data, key=lambda d: d.index)
        if any(len(d.embedding) != EMBEDDING_DIM for d in data):
            raise RuntimeError("Embedding dimension mismatch")
        vectors.extend(d.embedding for d in data)
        tokens += getattr(resp.usage, "total_tokens", 0) or 0
        if on_batch:
            await on_batch(min(i + BATCH_SIZE, len(texts)), len(texts))
    return vectors, tokens


async def embed_query(text: str) -> tuple[list[float], int]:
    vectors, tokens = await embed_texts([text])
    return vectors[0], tokens
