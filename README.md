# CODEMIND

CODEMIND is an AI-powered, context-aware codebase analysis and developer onboarding platform. Submit a public GitHub repository URL or upload a `.zip` archive to parse source files with Tree-sitter, map module dependencies with Graphology, index symbol chunks into ChromaDB using Gemini embeddings, generate an onboarding guide, and ask grounded questions with clickable file and line references.

## Tech Stack

- **Frontend**: React + Tailwind CSS (Vite)
- **Backend**: Node.js + Express.js (JavaScript ESM)
- **Code Parsing**: Tree-sitter (`tree-sitter-javascript`, `tree-sitter-python`) + AST extraction
- **Dependency Graph**: Graphology
- **AI & Embeddings**: Gemini API (`@google/genai`, optional `@langchain/google-genai` adapter via `USE_LANGCHAIN=true`)
- **Vector DB**: ChromaDB
- **Relational DB**: MySQL (`users`, `projects`, `analysis_jobs`, `file_metadata`)
- **Document DB**: MongoDB (`chunk_metadata`, `summaries`, `chat_history`, `onboarding_guides`)
- **Deployment**: Docker + Docker Compose

## Folder Structure

```text
codemind/
├── .env.example
├── docker-compose.yml
├── README.md
├── docs/
│   ├── architecture.md
│   └── api-reference.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── index.js
│   │   ├── config/          # env, mysql, mongo, chroma
│   │   ├── models/          # Mongoose schemas
│   │   ├── ingestion/       # GitHub API fetcher, safe ZIP extractor, secret/binary filters
│   │   ├── scanner/         # Language detection, directory walk, file tree
│   │   ├── analyzer/        # Tree-sitter AST adapters (JavaScript, Python)
│   │   ├── graph/           # Graphology dependency graph & entry-point ranking
│   │   ├── indexing/        # Symbol-aware chunker & ChromaDB indexer
│   │   ├── retrieval/       # Semantic search + Graphology neighbor expansion
│   │   ├── assistant/       # Swappable Gemini/LangChain provider & grounded Q&A
│   │   ├── onboarding/      # Overview, setup steps, key modules & reading order
│   │   ├── pipeline/        # Asynchronous job runner
│   │   └── api/             # Express app, routes, validation, rate limiting
│   └── tests/               # Node built-in test runner unit tests
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    └── src/
        ├── api/client.js
        ├── components/      # Sidebar, FileTree, JobStatusBanner
        └── pages/           # Upload, Dashboard, CodeExplorer, DependencyGraph, Chat, Onboarding
```

## Setup & Run (Docker — Recommended)

1. Create your environment file from `.env.example` and add your `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env
   ```
2. Build and start all five containers (`frontend`, `backend`, `mysql`, `mongodb`, `chromadb`):
   ```bash
   docker compose up --build
   ```
3. Open the web UI at `http://localhost:3000` (backend API listens on `http://localhost:5000`).

## Setup & Run (Local Development)

1. Start only the databases with Docker:
   ```bash
   docker compose up -d mysql mongodb chromadb
   ```
2. Copy `.env.example` to `backend/.env` and update database hosts for localhost:
   ```env
   MYSQL_HOST=localhost
   MYSQL_URL=mysql://codemind:codemind_pass@localhost:3306/codemind
   MONGODB_URL=mongodb://localhost:27017/codemind
   CHROMA_URL=http://localhost:8000
   GEMINI_API_KEY=your_key_here
   ```
3. Install dependencies and start the backend:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
4. In a second terminal, install dependencies and start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
5. Open `http://localhost:3000`.

## Running Unit Tests

The parser, Graphology builder, and symbol chunker tests use Node's built-in `node:test` runner:

```bash
cd backend
npm install
npm test
```

## Usage

1. Open **Connect Repository** (`UploadPage`) and submit a public GitHub URL (`https://github.com/owner/repo`) or upload a `.zip` archive.
2. Monitor real-time pipeline stages (`ingesting -> scanning -> parsing -> graphing -> indexing -> onboarding -> completed`).
3. Explore the **Dashboard** (summary, language breakdown, file tree), **Code Explorer** (line-numbered source + extracted AST symbols/imports/exports), **Dependency Graph** (interactive Graphology map and entry-point rankings), **Onboarding Guide**, and **AI Assistant** (clickable `[filePath:startLine-endLine]` citations).

See `docs/architecture.md` and `docs/api-reference.md` for full technical documentation.
