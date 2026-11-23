# CODEMIND Architecture Notes

## Overview

CODEMIND is a full-stack, context-aware codebase analysis and developer onboarding platform. It converts a raw GitHub repository or ZIP archive into structured relational metadata, a directed module dependency graph, vector-indexed code chunks, an AI onboarding guide, and a grounded question-answering assistant.

## Processing Pipeline

```text
Upload (GitHub API / ZIP)
  -> Security Filtering (no binaries, secrets, node_modules, symlinks, or path traversal)
  -> Scanner (directories, languages, file tree)
  -> Tree-sitter AST Analyzer (functions, classes, methods, imports, exports)
  -> Graphology Dependency Graph (directed edges, in/out-degree, entry-point ranking)
  -> Symbol-Aware Chunker + Gemini Embeddings -> ChromaDB + MongoDB
  -> Gemini Onboarding Generator -> MySQL + MongoDB
  -> Retrieval (ChromaDB semantic search + Graphology neighbor expansion)
  -> Grounded Assistant (Prompt construction + source file/line citations)
```

## Polyglot Storage Design

1. **MySQL (Relational Data)**:
   - `users`: Workspace user accounts.
   - `projects`: Repository metadata, source type, aggregate file/line/symbol counts, language distribution.
   - `analysis_jobs`: Asynchronous pipeline job status, percentage progress, stage descriptions, and error details.
   - `file_metadata`: Per-file language, directory, line counts, byte size, extracted symbols, imports, and exports.

2. **MongoDB (Document Data)**:
   - `chunk_metadata`: Symbol-level code chunks with line ranges and raw snippets (enables graph-neighbor lookup without re-reading disk).
   - `summaries`: Project-level summary, file tree structure, and Graphology dependency graph (`nodes`, `edges`, `rankings`).
   - `onboarding_guides`: Generated overview, setup commands, key modules, and suggested reading order.
   - `chat_history`: Conversational history per project including retrieval confidence and clickable source citations.

3. **ChromaDB (Vector Store)**:
   - One isolated collection per project (`cm_<projectIdWithoutHyphens>`) storing Gemini embeddings and line-range metadata for fast semantic retrieval.

## Security Boundaries

- **No Execution**: Uploaded code is strictly parsed via Tree-sitter static ASTs and read as UTF-8 text; no `eval`, `child_process`, or package installation is ever executed against uploaded repositories.
- **Zip-Slip & Zip-Bomb Protections**: Archive entries are validated against resolved workspace boundaries, symlinks are discarded, and strict per-file, total-uncompressed, and file-count caps are enforced.
- **Secret Exclusion**: `.env*`, private keys (`.pem`, `.key`, `id_rsa`), service-account JSONs, binaries, and dependency caches (`node_modules`, `__pycache__`, `.git`) are stripped before disk write.
- **SSRF Controls**: GitHub ingestion parses and validates `https://github.com/<owner>/<repo>` strictly and downloads archives through `api.github.com` only.

## Swappable AI / RAG Layer

`backend/src/assistant/llmProvider.js` isolates all generation and embedding calls behind `generateCompletion` and `embedTexts`. Setting `USE_LANGCHAIN=true` routes requests through `@langchain/google-genai`, while `USE_LANGCHAIN=false` (default) uses the official `@google/genai` SDK directly.

## Extending Language Support

Add a new adapter under `backend/src/analyzer/languages/<lang>.js` exporting `{ language, grammar, extractFromTree(rootNode) }`, register it in `backend/src/analyzer/parserService.js`, and add the file extension in `backend/src/scanner/languageMap.js`.
