# CODEMIND REST API Reference

Base URL: `/api`

All endpoints are rate-limited (`RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_MS`), and AI chat endpoints have an additional per-minute limit.

---

## Health

### `GET /api/health`
Returns service readiness.

**Response `200 OK`**
```json
{
  "status": "ok",
  "service": "codemind-backend",
  "timestamp": "2026-11-22T23:50:00.000Z"
}
```

---

## Projects & Ingestion

### `GET /api/projects`
Lists all projects with their latest analysis job status.

**Response `200 OK`**
```json
[
  {
    "id": "uuid",
    "name": "express-starter",
    "source_type": "github",
    "source_url": "https://github.com/expressjs/express",
    "total_files": 42,
    "total_lines": 3210,
    "total_symbols": 118,
    "languages_json": { "JavaScript": 36, "JSON": 4, "Markdown": 2 },
    "job_status": "completed",
    "job_progress": 100,
    "current_stage": "Analysis completed"
  }
]
```

### `POST /api/projects/github`
Ingests a public GitHub repository via the GitHub REST API and starts an asynchronous analysis job.

**Request Body (`application/json`)**
```json
{
  "repoUrl": "https://github.com/owner/repo",
  "name": "optional-display-name"
}
```

**Response `202 Accepted`**
```json
{
  "projectId": "uuid",
  "jobId": "uuid",
  "name": "repo",
  "status": "queued"
}
```

### `POST /api/projects/upload`
Ingests a `.zip` repository archive (`multipart/form-data`, field name `file`) and starts an asynchronous analysis job.

**Form Fields**
- `file` (required): `.zip` archive up to `MAX_UPLOAD_SIZE_MB`
- `name` (optional): custom project display name

**Response `202 Accepted`**
```json
{
  "projectId": "uuid",
  "jobId": "uuid",
  "name": "my-project",
  "status": "queued"
}
```

### `GET /api/projects/:id`
Returns project metadata, latest job progress, scanned files with AST symbols, Graphology dependency graph summary, onboarding guide, and chat history.

**Response `200 OK`**
```json
{
  "project": { "id": "...", "name": "...", "languages_json": {} },
  "job": { "id": "...", "status": "completed", "progress": 100, "current_stage": "Analysis completed" },
  "files": [
    {
      "file_path": "src/index.js",
      "language": "JavaScript",
      "lines_count": 48,
      "symbols_json": [],
      "imports_json": [],
      "exports_json": []
    }
  ],
  "summary": { "projectSummary": "...", "graph": { "nodes": [], "edges": [], "rankings": [] }, "fileTree": {} },
  "onboarding": { "overview": "...", "setupSteps": [], "keyModules": [], "readingOrder": [] },
  "chatHistory": []
}
```

### `GET /api/projects/:id/job`
Lightweight polling endpoint returning only the latest `analysis_jobs` record for a project.

### `GET /api/projects/:id/file?path=<relativePath>`
Reads a source file safely from the project's extracted workspace directory (enforces strict path containment).

**Response `200 OK`**
```json
{
  "path": "src/index.js",
  "content": "..."
}
```

### `POST /api/projects/:id/chat`
Runs hybrid retrieval (ChromaDB vector similarity + Graphology dependency neighbors) and sends a grounded prompt to Gemini.

**Request Body (`application/json`)**
```json
{
  "question": "How is authentication handled?"
}
```

**Response `200 OK`**
```json
{
  "projectId": "uuid",
  "role": "assistant",
  "content": "Authentication middleware is defined in [src/middleware/auth.js:10-28]...",
  "confidence": "high",
  "sources": [
    {
      "filePath": "src/middleware/auth.js",
      "startLine": 10,
      "endLine": 28,
      "symbol": "verifyToken",
      "score": 0.782,
      "fromGraphNeighbor": false
    }
  ]
}
```

### `DELETE /api/projects/:id`
Deletes the project from MySQL, MongoDB (`chunk_metadata`, `summaries`, `onboarding_guides`, `chat_history`), ChromaDB collection, and the workspace directory on disk.
