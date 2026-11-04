# NEXUS AI — PRD

## Original problem statement
Build NEXUS AI, "The Intelligent Knowledge Operating System" (tagline: *Your Knowledge. Connected.*): a premium dark, futuristic AI SaaS for document intelligence built on genuine RAG.
- PDF ingestion: extract, chunk, embed and index documents.
- Grounded chat with verifiable citations.
- Semantic, keyword and hybrid search.
- Intelligence Studio: summaries, sentiment, comparison and concept explanations.
- Analytics and evaluation.
- Secure workspace scoping and protection against prompt injection.
- Real metrics only — nothing faked.

## User choices
- **Generation:** OpenAI GPT through the Emergent key (`gpt-5.4`).
- **Embeddings:** OpenAI `text-embedding-3-small` with the user's own `OPENAI_API_KEY`.
- **Sign-in:** Emergent-managed Google sign-in (Clerk).
- **Signature feature:** Research Intelligence Mode + Research Gap Finder.
- **Supporting feature:** a lightweight RAG Evaluation Lab.
- **Later:** Knowledge Graph Explorer.

## Architecture
React (CRA) + Tailwind/shadcn + Recharts + Framer Motion, with a FastAPI backend that is modular (core / services / routes), MongoDB, and Emergent Object Storage. See README.md for the mapping to the original stack.

## Personas
Students, researchers and engineers analysing papers and reports.

## Implemented (2026-11-04)
- **Auth and workspaces:** Clerk Google auth. Each user gets a personal workspace, resolved on the server.
- **Knowledge Base:**
  - Drag-drop upload with progress.
  - Validation: type, magic bytes, size, duplicates.
  - Background ingestion with stage and progress, plus rollback on failure.
  - List, search and status filter; delete with confirmation; re-index.
  - Chunk inspector with highlighting, original PDF viewer, and metadata.
- **Research Chat:**
  - SSE streaming and markdown.
  - Clickable `[S#]` citations that open a side panel and jump to the highlighted chunk.
  - Insufficient-evidence guard.
  - Copy, regenerate and feedback; conversation history; questions suggested from real document names; document scope.
- **Semantic Search:** semantic, keyword and hybrid (RRF) modes; top-k, similarity threshold and document filters; scores labelled accurately.
- **Intelligence Studio:** summary (with evidence), sentiment (document or text, sentence-level, method disclosed), comparison, and a concept explainer that is either grounded in documents or clearly labelled as general.
- **Research Intelligence:** objectives, research questions, methodology, findings, limitations (stated vs inferred), future scope, a gap matrix with evidence and priority, and follow-up questions that can be sent to chat.
- **Analytics:** real usage aggregation (latency avg/p95, tokens, failures, feedback, daily series, latency breakdown).
- **Evaluation Lab:** synthetic and manual benchmark questions; Recall@K, Precision@K, MRR and coverage; run history and comparison chart; metric notes.
- **Settings:** retrieval mode, top-k, threshold, model, chunk size and overlap (validated), workspace name, and system status.
- **Tests:** unit tests, pipeline integration tests and an API regression suite (45 passing).

## Backlog
- **P1:**
  - Knowledge Graph Explorer.
  - OCR for scanned PDFs.
  - Faithfulness judging (LLM-as-judge) in the Evaluation Lab.
  - Multiple workspaces with members.
- **P2:**
  - ANN vector index for large corpora.
  - DOCX/TXT ingestion.
  - Export of insights and reports.
  - Notifications.
