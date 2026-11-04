# NEXUS AI — The Intelligent Knowledge Operating System

*Your Knowledge. Connected.* A retrieval-augmented knowledge platform: upload PDFs, then search them, ask questions with cited answers, analyse documents, and measure how well retrieval performs.

## Architecture (React + FastAPI + MongoDB)
This app was built on the Emergent platform stack instead of the Next.js/Supabase stack in the original brief. Each part of the brief maps to this stack as follows:

| Brief | Implementation |
|---|---|
| Next.js route handlers | FastAPI routers in `backend/routes/*`, business logic in `backend/services/*` |
| Zod validation | Pydantic models (`backend/routes/schemas.py`) |
| Supabase Postgres + pgvector (HNSW) | MongoDB stores each chunk with its 1536-d vector. Cosine search runs over an in-memory numpy matrix for each workspace, which is rebuilt after ingestion or deletion. Exact search is fine at workspace scale. Move to an ANN index (Atlas Vector Search) when you need large scale. |
| Postgres FTS | MongoDB text index on `chunks.text` |
| Hybrid search | Reciprocal Rank Fusion (k=60) of semantic and keyword rankings |
| Supabase Storage | Emergent Object Storage (original PDFs) |
| Supabase RLS | Workspace scoping on the server. The workspace is resolved from the verified session and never taken from the client. Every query filters by `workspace_id`. |
| Auth | Emergent-managed Clerk (Google sign-in) |
| OpenAI Responses API | Generation through the Emergent Universal Key (`gpt-5.4`, configurable). Embeddings call OpenAI `text-embedding-3-small` directly with your own key. |

### Ingestion pipeline (`services/ingestion.py`)
1. Validate the upload: extension or MIME type, `%PDF-` magic bytes, size limit, and SHA-256 duplicate check.
2. Store the original PDF.
3. Run processing as a background task: pypdf text extraction for each page → cleaning (NFKC, de-hyphenation) → chunking that tracks pages, with overlap and de-duplication → batched embeddings (64 per batch) → store chunks.
4. Progress and stage are saved on the document. If any step fails, partial chunks are removed and the document is marked `failed` with a safe error message. Jobs interrupted by a restart are marked failed when the server starts.

### RAG (`services/chat.py`, `services/retrieval.py`)
Each question goes through these steps:
1. Embed the query with the same model used for the documents.
2. Retrieve candidates, scoped to the workspace and optionally to selected documents.
3. Apply the cosine-similarity threshold. If nothing passes, return a fixed "insufficient evidence" answer without calling the model.
4. Wrap the retrieved passages in `<source>` blocks marked as untrusted.
5. Stream an answer that cites passages as `[S#]`.
6. Save the citations (document, pages, excerpt, rank, cosine similarity, keyword score) and the measured latency and token counts.

### Intelligence
- **Summary, Compare and Research Intelligence** read chunks sampled evenly across the document. Evidence tags returned by the model are mapped back to real chunk IDs, and tags that don't match a chunk are dropped.
- **Sentiment** is a zero-shot LLM classification. It is labelled as such, and confidence scores are self-reported by the model. No model is trained.

### Evaluation Lab (`services/evaluation.py`)
- Uses synthetic questions generated from sampled chunks (the source chunk is the ground truth) plus manual questions you add (an expected document and keywords).
- Reports Recall@K (hit rate), Precision@K, MRR, context coverage and latency.
- Each metric's definition and limitations are shown in the UI.

## Environment variables (`backend/.env`)
| Name | Purpose |
|---|---|
| `MONGO_URL`, `DB_NAME` | MongoDB connection (platform-managed) |
| `EMERGENT_LLM_KEY` | Generation and object storage |
| `OPENAI_API_KEY` | Embeddings (`text-embedding-3-small`). Needs billing credits. |
| `LLM_MODEL` | Default generation model (`gpt-5.4`) |
| `EMBEDDING_MODEL` | `text-embedding-3-small` |
| `MAX_UPLOAD_MB` | Upload limit (default 20) |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Set automatically by Emergent |

The frontend uses only `REACT_APP_BACKEND_URL`. No secrets reach the browser.

## Tests
```
cd backend && python -m pytest -q tests -p no:cacheprovider
```
- **Unit tests** cover chunking, cleaning, JSON parsing and evidence mapping.
- **Pipeline tests** run against MongoDB with a deterministic fake embedder. They cover ingestion, retrieval, workspace isolation, the insufficient-evidence path and rollback.
- **API regression suite** (`test_nexus_api.py`): needs the running preview and Clerk test tokens. See `memory/test_credentials.md`.

## Deployment
Deploy with Emergent (the **Deploy** button). Production Clerk keys are injected automatically. Make sure `OPENAI_API_KEY` is set in the production secrets. Vercel isn't used, because this backend is a long-running FastAPI service with background ingestion tasks.
