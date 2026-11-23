import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import Graph from 'graphology';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

interface SymbolEntry {
  name: string;
  kind: 'function' | 'class' | 'method';
  startLine: number;
  endLine: number;
}

interface ScannedFile {
  file_path: string;
  directory: string;
  language: string;
  isCodeSupported: boolean;
  lines_count: number;
  size_bytes: number;
  symbol_count: number;
  symbols_json: SymbolEntry[];
  imports_json: string[];
  exports_json: string[];
  content: string;
}

interface GraphNode {
  id: string;
  label: string;
  language: string;
  linesCount: number;
  inDegree: number;
  outDegree: number;
  centrality: number;
  isEntryPoint: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface GraphRanking {
  filePath: string;
  score: number;
  reason: string;
}

interface IndexedChunk {
  chunkId: string;
  filePath: string;
  language: string;
  symbol: string;
  symbolKind: string;
  startLine: number;
  endLine: number;
  content: string;
  document: string;
  embedding: number[] | null;
}

interface ChatSource {
  filePath: string;
  startLine: number;
  endLine: number;
  symbol: string;
  score: number;
  fromGraphNeighbor: boolean;
}

interface ChatMessageRecord {
  id: string;
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  confidence: 'high' | 'medium' | 'low';
  sources: ChatSource[];
}

interface OnboardingData {
  overview: string;
  setupSteps: string[];
  keyModules: Array<{ filePath: string; purpose: string; centrality: number }>;
  readingOrder: Array<{ step: number; filePath: string; role: string; rationale: string }>;
}

interface ProjectRecord {
  id: string;
  name: string;
  source_type: 'zip' | 'github';
  source_url: string | null;
  default_branch: string | null;
  total_files: number;
  total_lines: number;
  total_symbols: number;
  languages_json: Record<string, number>;
  created_at: string;
  job: {
    id: string;
    status: string;
    progress: number;
    current_stage: string;
    error_message: string | null;
  };
  files: ScannedFile[];
  summary: {
    projectSummary: string;
    fileTree: Record<string, unknown>;
    graph: {
      nodes: GraphNode[];
      edges: GraphEdge[];
      rankings: GraphRanking[];
    };
  };
  onboarding: OnboardingData | null;
  chatHistory: ChatMessageRecord[];
  chunks: IndexedChunk[];
}

const PORT = 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES_PER_PROJECT = 1500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GITHUB_SLUG_RE = /^[a-zA-Z0-9_.-]+$/;

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.next', 'dist', 'build', 'coverage',
  '__pycache__', '.pytest_cache', '.venv', 'venv', '.idea', '.vscode',
]);

const SECRET_PATTERNS = [
  /^\.env(\..+)?$/i, /\.pem$/i, /\.key$/i, /\.p12$/i, /\.pfx$/i, /\.crt$/i,
  /^id_rsa(\.pub)?$/i, /^id_ed25519(\.pub)?$/i, /credentials\.json$/i,
  /service[-_]?account.*\.json$/i, /\.npmrc$/i, /\.pypirc$/i,
];

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.pdf', '.zip', '.tar',
  '.gz', '.7z', '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm', '.mp3', '.mp4',
  '.woff', '.woff2', '.ttf', '.eot', '.pyc', '.class', '.jar', '.sqlite', '.db',
]);

const CODE_EXT_LANG: Record<string, string> = {
  '.js': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.jsx': 'JavaScript',
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.py': 'Python',
};

const CONTEXT_EXT_LANG: Record<string, string> = {
  '.json': 'JSON', '.md': 'Markdown', '.txt': 'Text', '.yml': 'YAML', '.yaml': 'YAML', '.sql': 'SQL',
};

const projectsStore = new Map<string, ProjectRecord>();

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return aiClient;
}

function shouldIgnorePath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const fileName = parts[parts.length - 1] || '';
  for (const dir of parts.slice(0, -1)) {
    if (IGNORED_DIRS.has(dir)) return true;
  }
  for (const pat of SECRET_PATTERNS) {
    if (pat.test(fileName)) return true;
  }
  const ext = path.posix.extname(fileName).toLowerCase();
  return BINARY_EXTS.has(ext);
}

function detectLanguage(filePath: string): { language: string; isCodeSupported: boolean } {
  const base = path.posix.basename(filePath);
  if (base === 'Dockerfile') return { language: 'Docker', isCodeSupported: false };
  const ext = path.posix.extname(filePath).toLowerCase();
  if (CODE_EXT_LANG[ext]) return { language: CODE_EXT_LANG[ext], isCodeSupported: true };
  if (CONTEXT_EXT_LANG[ext]) return { language: CONTEXT_EXT_LANG[ext], isCodeSupported: false };
  return { language: 'Unsupported', isCodeSupported: false };
}

function analyzeAstLightweight(content: string, language: string) {
  const symbols: SymbolEntry[] = [];
  const imports: string[] = [];
  const exportsList: string[] = [];
  const lines = content.split('\n');

  if (language === 'JavaScript' || language === 'TypeScript') {
    lines.forEach((line, i) => {
      const lineNum = i + 1;
      const clsMatch = line.match(/^\s*(?:export\s+(?:default\s+)?)?class\s+([A-Za-z0-9_$]+)/);
      if (clsMatch) {
        symbols.push({ name: clsMatch[1], kind: 'class', startLine: lineNum, endLine: Math.min(lines.length, lineNum + 15) });
        if (line.includes('export')) exportsList.push(clsMatch[1]);
      }
      const fnMatch = line.match(/^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/);
      if (fnMatch) {
        symbols.push({ name: fnMatch[1], kind: 'function', startLine: lineNum, endLine: Math.min(lines.length, lineNum + 12) });
        if (line.includes('export')) exportsList.push(fnMatch[1]);
      }
      const arrowMatch = line.match(/^\s*(?:export\s+)?(?:const|let)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/);
      if (arrowMatch) {
        symbols.push({ name: arrowMatch[1], kind: 'function', startLine: lineNum, endLine: Math.min(lines.length, lineNum + 8) });
        if (line.includes('export')) exportsList.push(arrowMatch[1]);
      }
      const impMatch = line.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/);
      if (impMatch) imports.push(impMatch[1]);
      const reqMatch = line.match(/require\(['"]([^'"]+)['"]\)/);
      if (reqMatch) imports.push(reqMatch[1]);
    });
  } else if (language === 'Python') {
    lines.forEach((line, i) => {
      const lineNum = i + 1;
      const clsMatch = line.match(/^class\s+([A-Za-z0-9_]+)/);
      if (clsMatch) {
        symbols.push({ name: clsMatch[1], kind: 'class', startLine: lineNum, endLine: Math.min(lines.length, lineNum + 15) });
        if (!clsMatch[1].startsWith('_')) exportsList.push(clsMatch[1]);
      }
      const fnMatch = line.match(/^(\s*)(?:async\s+)?def\s+([A-Za-z0-9_]+)/);
      if (fnMatch) {
        const isMethod = fnMatch[1].length >= 4;
        symbols.push({ name: fnMatch[2], kind: isMethod ? 'method' : 'function', startLine: lineNum, endLine: Math.min(lines.length, lineNum + 10) });
        if (!isMethod && !fnMatch[2].startsWith('_')) exportsList.push(fnMatch[2]);
      }
      const fromImp = line.match(/^\s*from\s+([\w.]+)\s+import/);
      if (fromImp) imports.push(fromImp[1]);
      const dirImp = line.match(/^\s*import\s+([\w.]+)/);
      if (dirImp) imports.push(dirImp[1]);
    });
  }

  return {
    symbols,
    imports: [...new Set(imports)],
    exports: [...new Set(exportsList)],
  };
}

function resolveImportPath(sourceFile: string, rawImport: string, fileSet: Set<string>): string | null {
  if (rawImport.startsWith('.')) {
    const dir = path.posix.dirname(sourceFile);
    const norm = path.posix.normalize(path.posix.join(dir, rawImport));
    const candidates = [
      norm, `${norm}.js`, `${norm}.jsx`, `${norm}.ts`, `${norm}.tsx`, `${norm}.py`,
      `${norm}/index.js`, `${norm}/index.ts`, `${norm}/__init__.py`,
    ];
    for (const c of candidates) {
      if (fileSet.has(c)) return c;
    }
  }
  const pyPath = `${rawImport.replace(/^\.+/, '').replace(/\./g, '/')}.py`;
  if (fileSet.has(pyPath)) return pyPath;
  return null;
}

function buildGraph(files: ScannedFile[]) {
  const graph = new Graph({ type: 'directed', allowSelfLoops: false });
  const codeFiles = files.filter((f) => f.isCodeSupported);
  const fileSet = new Set(codeFiles.map((f) => f.file_path));

  for (const f of codeFiles) {
    graph.addNode(f.file_path, {
      label: path.posix.basename(f.file_path),
      language: f.language,
      linesCount: f.lines_count,
    });
  }

  for (const f of codeFiles) {
    for (const rawImp of f.imports_json) {
      const target = resolveImportPath(f.file_path, rawImp, fileSet);
      if (target && target !== f.file_path && graph.hasNode(target) && !graph.hasEdge(f.file_path, target)) {
        graph.addEdge(f.file_path, target);
      }
    }
  }

  const nodes: GraphNode[] = graph.nodes().map((nodeId) => {
    const attrs = graph.getNodeAttributes(nodeId);
    const inDegree = graph.inDegree(nodeId);
    const outDegree = graph.outDegree(nodeId);
    const base = String(attrs.label).toLowerCase();
    const isEntryPoint =
      (inDegree === 0 && outDegree > 0) ||
      ['index.js', 'server.js', 'app.js', 'main.js', 'main.py', 'app.py', 'server.ts'].includes(base);
    return {
      id: nodeId,
      label: String(attrs.label),
      language: String(attrs.language),
      linesCount: Number(attrs.linesCount),
      inDegree,
      outDegree,
      centrality: inDegree * 2 + outDegree,
      isEntryPoint,
    };
  });

  const edges: GraphEdge[] = graph.edges().map((e) => ({
    source: graph.source(e),
    target: graph.target(e),
  }));

  const rankings: GraphRanking[] = [...nodes]
    .sort((a, b) => Number(b.isEntryPoint) - Number(a.isEntryPoint) || b.centrality - a.centrality)
    .slice(0, 12)
    .map((n) => ({
      filePath: n.id,
      score: n.centrality,
      reason: n.isEntryPoint
        ? `Entry/orchestrator file (${n.outDegree} outgoing imports, ${n.inDegree} incoming)`
        : `Core module (${n.inDegree} dependents, ${n.outDegree} imports)`,
    }));

  return { nodes, edges, rankings };
}

function buildFileTree(files: ScannedFile[]) {
  const tree: Record<string, unknown> = {};
  for (const f of files) {
    const parts = f.file_path.split('/').filter(Boolean);
    let cursor = tree as Record<string, any>;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        cursor[part] = {
          type: 'file',
          path: f.file_path,
          language: f.language,
          linesCount: f.lines_count,
        };
      } else {
        if (!cursor[part] || cursor[part].type === 'file') {
          cursor[part] = { type: 'dir', children: {} };
        }
        cursor = cursor[part].children;
      }
    }
  }
  return tree;
}

function chunkFiles(files: ScannedFile[]): IndexedChunk[] {
  const chunks: IndexedChunk[] = [];
  for (const file of files) {
    const lines = file.content.split('\n');
    const symbolNames = file.symbols_json.map((s) => s.name).join(', ') || 'module_scope';
    const windowSize = 55;
    for (let start = 0; start < lines.length; start += 45) {
      const end = Math.min(lines.length, start + windowSize);
      const snippet = lines.slice(start, end).join('\n').trim();
      if (!snippet) continue;
      chunks.push({
        chunkId: `${file.file_path}:${start + 1}-${end}`,
        filePath: file.file_path,
        language: file.language,
        symbol: symbolNames,
        symbolKind: file.symbols_json[0]?.kind || 'module',
        startLine: start + 1,
        endLine: end,
        content: snippet,
        document: `File: ${file.file_path} (${file.language})\nSymbols: ${symbolNames}\nLines ${start + 1}-${end}:\n${snippet}`,
        embedding: null,
      });
      if (end === lines.length) break;
    }
  }
  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom ? dot / denom : 0;
}

async function processInMemoryFiles(
  projectId: string,
  rawEntries: Array<{ path: string; content: string }>
) {
  const proj = projectsStore.get(projectId);
  if (!proj) return;

  try {
    proj.job = { id: proj.job.id, status: 'scanning', progress: 25, current_stage: 'Scanning files and languages', error_message: null };

    const scanned: ScannedFile[] = [];
    const languageCounts: Record<string, number> = {};
    let totalLines = 0;
    let totalSymbols = 0;

    for (const item of rawEntries) {
      const { language, isCodeSupported } = detectLanguage(item.path);
      if (language === 'Unsupported') continue;
      const linesCount = item.content.split('\n').length;
      const parsed = isCodeSupported ? analyzeAstLightweight(item.content, language) : { symbols: [], imports: [], exports: [] };

      totalLines += linesCount;
      totalSymbols += parsed.symbols.length;
      languageCounts[language] = (languageCounts[language] || 0) + 1;

      scanned.push({
        file_path: item.path,
        directory: path.posix.dirname(item.path) === '.' ? '/' : path.posix.dirname(item.path),
        language,
        isCodeSupported,
        lines_count: linesCount,
        size_bytes: Buffer.byteLength(item.content, 'utf-8'),
        symbol_count: parsed.symbols.length,
        symbols_json: parsed.symbols,
        imports_json: parsed.imports,
        exports_json: parsed.exports,
        content: item.content,
      });
    }

    if (!scanned.length) {
      throw new Error('No supported source or configuration files found.');
    }

    proj.files = scanned.sort((a, b) => a.file_path.localeCompare(b.file_path));
    proj.total_files = scanned.length;
    proj.total_lines = totalLines;
    proj.total_symbols = totalSymbols;
    proj.languages_json = languageCounts;

    proj.job = { id: proj.job.id, status: 'graphing', progress: 55, current_stage: 'Building Graphology dependency graph', error_message: null };
    const graphData = buildGraph(scanned);
    const fileTree = buildFileTree(scanned);
    proj.summary = {
      projectSummary: `${proj.name} contains ${scanned.length} scanned files (${totalLines} lines, ${totalSymbols} extracted symbols).`,
      fileTree,
      graph: graphData,
    };

    proj.job = { id: proj.job.id, status: 'indexing', progress: 75, current_stage: 'Chunking symbols and computing embeddings', error_message: null };
    const chunks = chunkFiles(scanned);
    const ai = getAiClient();
    if (ai && chunks.length > 0) {
      try {
        for (let i = 0; i < chunks.length; i += 20) {
          const slice = chunks.slice(i, i + 20);
          const res = await ai.models.embedContent({
            model: GEMINI_EMBEDDING_MODEL,
            contents: slice.map((c) => c.document),
            config: { taskType: 'RETRIEVAL_DOCUMENT' },
          });
          (res.embeddings || []).forEach((emb, idx) => {
            if (slice[idx] && emb.values) slice[idx].embedding = emb.values;
          });
        }
      } catch (err) {
        console.warn('[CODEMIND] Embedding fallback to lexical retrieval:', (err as Error).message);
      }
    }
    proj.chunks = chunks;

    proj.job = { id: proj.job.id, status: 'onboarding', progress: 90, current_stage: 'Generating onboarding guide', error_message: null };
    if (ai) {
      try {
        const prompt = `Return strictly valid JSON (no markdown fences) with keys:
- "projectSummary": 2-sentence summary
- "overview": 3-4 sentence architectural overview
- "setupSteps": array of concrete setup command strings
- "keyModules": array of { "filePath": string, "purpose": string, "centrality": number }
- "readingOrder": array of { "step": number, "filePath": string, "role": string, "rationale": string }

Project: ${proj.name}
Languages: ${JSON.stringify(languageCounts)}
Graph Rankings: ${JSON.stringify(graphData.rankings)}
Files: ${scanned.slice(0, 35).map((f) => f.file_path).join(', ')}`;

        const genRes = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: { systemInstruction: 'Output strictly valid JSON.' },
        });
        const parsed = JSON.parse((genRes.text || '{}').replace(/```json\s*|\s*```/g, '').trim());
        proj.summary.projectSummary = parsed.projectSummary || proj.summary.projectSummary;
        proj.onboarding = {
          overview: parsed.overview || proj.summary.projectSummary,
          setupSteps: Array.isArray(parsed.setupSteps) ? parsed.setupSteps : [],
          keyModules: Array.isArray(parsed.keyModules) ? parsed.keyModules : [],
          readingOrder: Array.isArray(parsed.readingOrder) ? parsed.readingOrder : [],
        };
      } catch {
        // Use deterministic Graphology fallback below
      }
    }

    if (!proj.onboarding) {
      proj.onboarding = {
        overview: `${proj.name} is organized into ${scanned.length} source and configuration files across ${Object.keys(languageCounts).join(', ')}.`,
        setupSteps: [
          'Install dependencies listed in package.json or requirements.txt.',
          'Configure environment variables from .env.example.',
          'Start the primary entry point module listed in the reading order.',
        ],
        keyModules: graphData.rankings.slice(0, 5).map((r) => ({
          filePath: r.filePath,
          purpose: r.reason,
          centrality: r.score,
        })),
        readingOrder: graphData.rankings.slice(0, 5).map((r, i) => ({
          step: i + 1,
          filePath: r.filePath,
          role: i === 0 ? 'Entry Point' : 'Core Module',
          rationale: r.reason,
        })),
      };
    }

    proj.job = { id: proj.job.id, status: 'completed', progress: 100, current_stage: 'Analysis completed', error_message: null };
  } catch (err) {
    proj.job = {
      id: proj.job.id,
      status: 'failed',
      progress: 100,
      current_stage: 'Analysis failed',
      error_message: (err as Error).message,
    };
  }
}

function extractEntriesFromZip(zipBuffer: Buffer, stripTopDir: boolean) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  if (entries.length > MAX_FILES_PER_PROJECT * 4) {
    throw new Error('Archive contains too many entries.');
  }

  let totalBytes = 0;
  const output: Array<{ path: string; content: string }> = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const unixMode = (entry.header.attr >>> 16) & 0o170000;
    if (unixMode === 0o120000) continue;

    let entryPath = entry.entryName.replace(/\\/g, '/').replace(/^\/+/, '');
    if (stripTopDir) {
      const idx = entryPath.indexOf('/');
      if (idx !== -1) entryPath = entryPath.slice(idx + 1);
    }
    if (!entryPath || entryPath.split('/').includes('..') || shouldIgnorePath(entryPath)) continue;

    const data = entry.getData();
    if (data.length > MAX_FILE_BYTES) continue;
    totalBytes += data.length;
    if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new Error('Uncompressed repository exceeds size limit.');
    }

    const sample = data.subarray(0, 4096);
    let isBin = false;
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) { isBin = true; break; }
    }
    if (isBin) continue;

    output.push({ path: entryPath, content: data.toString('utf-8') });
    if (output.length > MAX_FILES_PER_PROJECT) {
      throw new Error('Repository exceeds maximum file limit.');
    }
  }

  // Unwrap single top-level directory for manual ZIP uploads
  if (!stripTopDir && output.length > 0) {
    const firstSegments = new Set(output.map((f) => f.path.split('/')[0]));
    if (firstSegments.size === 1 && output.every((f) => f.path.includes('/'))) {
      const prefix = `${Array.from(firstSegments)[0]}/`;
      return output.map((f) => ({ path: f.path.slice(prefix.length), content: f.content }));
    }
  }

  return output;
}

function seedDemoProject() {
  const demoId = '11111111-1111-4111-8111-111111111111';
  const demoFiles: Array<{ path: string; content: string }> = [
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: 'express-auth-starter',
          version: '1.0.0',
          type: 'module',
          scripts: { dev: 'node src/server.js' },
          dependencies: { express: '^4.21.2', jsonwebtoken: '^9.0.2' },
        },
        null,
        2
      ),
    },
    {
      path: 'src/server.js',
      content: [
        "import express from 'express';",
        "import authRoutes from './routes/authRoutes.js';",
        "import { connectDatabase } from './config/db.js';",
        '',
        'const app = express();',
        'app.use(express.json());',
        "app.use('/api/auth', authRoutes);",
        '',
        'export async function startServer(port = 5000) {',
        '  await connectDatabase();',
        '  return app.listen(port, () => console.log(`Listening on ${port}`));',
        '}',
        '',
        'startServer();',
      ].join('\n'),
    },
    {
      path: 'src/config/db.js',
      content: [
        'export async function connectDatabase() {',
        "  return { connected: true, engine: 'mysql' };",
        '}',
      ].join('\n'),
    },
    {
      path: 'src/routes/authRoutes.js',
      content: [
        "import express from 'express';",
        "import { loginUser, registerUser } from '../controllers/authController.js';",
        "import { verifyBearerToken } from '../middleware/authMiddleware.js';",
        '',
        'const router = express.Router();',
        "router.post('/login', loginUser);",
        "router.post('/register', registerUser);",
        "router.get('/me', verifyBearerToken, (req, res) => res.json({ user: req.user }));",
        '',
        'export default router;',
      ].join('\n'),
    },
    {
      path: 'src/controllers/authController.js',
      content: [
        "import jwt from 'jsonwebtoken';",
        "import { UserRepository } from '../models/User.js';",
        '',
        'export async function loginUser(req, res) {',
        '  const { email, password } = req.body;',
        '  const user = await UserRepository.findByEmail(email);',
        '  if (!user || !user.verifyPassword(password)) {',
        "    return res.status(401).json({ error: 'Invalid credentials' });",
        '  }',
        "  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET || 'dev-secret');",
        '  return res.json({ token });',
        '}',
        '',
        'export async function registerUser(req, res) {',
        '  const created = await UserRepository.create(req.body);',
        '  return res.status(201).json(created);',
        '}',
      ].join('\n'),
    },
    {
      path: 'src/middleware/authMiddleware.js',
      content: [
        "import jwt from 'jsonwebtoken';",
        '',
        'export function verifyBearerToken(req, res, next) {',
        "  const header = req.headers.authorization || '';",
        "  const token = header.startsWith('Bearer ') ? header.slice(7) : '';",
        "  if (!token) return res.status(401).json({ error: 'Missing bearer token' });",
        "  req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');",
        '  return next();',
        '}',
      ].join('\n'),
    },
    {
      path: 'src/models/User.js',
      content: [
        'export class UserRepository {',
        '  static async findByEmail(email) {',
        "    return { id: 'usr_1', email, verifyPassword: (pw) => Boolean(pw) };",
        '  }',
        '  static async create(payload) {',
        "    return { id: 'usr_2', email: payload.email };",
        '  }',
        '}',
      ].join('\n'),
    },
  ];

  const scanned: ScannedFile[] = [];
  const languageCounts: Record<string, number> = {};
  let totalLines = 0;
  let totalSymbols = 0;

  for (const item of demoFiles) {
    const { language, isCodeSupported } = detectLanguage(item.path);
    const linesCount = item.content.split('\n').length;
    const parsed = isCodeSupported ? analyzeAstLightweight(item.content, language) : { symbols: [], imports: [], exports: [] };
    totalLines += linesCount;
    totalSymbols += parsed.symbols.length;
    languageCounts[language] = (languageCounts[language] || 0) + 1;
    scanned.push({
      file_path: item.path,
      directory: path.posix.dirname(item.path) === '.' ? '/' : path.posix.dirname(item.path),
      language,
      isCodeSupported,
      lines_count: linesCount,
      size_bytes: Buffer.byteLength(item.content, 'utf-8'),
      symbol_count: parsed.symbols.length,
      symbols_json: parsed.symbols,
      imports_json: parsed.imports,
      exports_json: parsed.exports,
      content: item.content,
    });
  }

  const graphData = buildGraph(scanned);
  const fileTree = buildFileTree(scanned);
  const chunks = chunkFiles(scanned);

  projectsStore.set(demoId, {
    id: demoId,
    name: 'express-auth-starter',
    source_type: 'github',
    source_url: 'https://github.com/codemind-demo/express-auth-starter',
    default_branch: 'main',
    total_files: scanned.length,
    total_lines: totalLines,
    total_symbols: totalSymbols,
    languages_json: languageCounts,
    created_at: new Date().toISOString(),
    job: {
      id: '22222222-2222-4222-8222-222222222222',
      status: 'completed',
      progress: 100,
      current_stage: 'Analysis completed',
      error_message: null,
    },
    files: scanned,
    summary: {
      projectSummary:
        'express-auth-starter is a modular Node.js Express authentication service separating HTTP routing, JWT verification middleware, controller workflows, and user data persistence.',
      fileTree,
      graph: graphData,
    },
    onboarding: {
      overview:
        'This Express.js backend handles user registration, login, and protected profile retrieval via Bearer JWT tokens. Entry routing begins in src/server.js and delegates /api/auth endpoints to src/routes/authRoutes.js.',
      setupSteps: [
        'Run npm install to install express and jsonwebtoken.',
        'Set JWT_SECRET in your environment.',
        'Start the server with npm run dev (listens on port 5000).',
      ],
      keyModules: graphData.rankings.slice(0, 5).map((r) => ({
        filePath: r.filePath,
        purpose: r.reason,
        centrality: r.score,
      })),
      readingOrder: [
        {
          step: 1,
          filePath: 'src/server.js',
          role: 'Entry Point',
          rationale: 'Bootstraps Express JSON parsing, connects the database, and mounts /api/auth.',
        },
        {
          step: 2,
          filePath: 'src/routes/authRoutes.js',
          role: 'Router Hub',
          rationale: 'Maps /login, /register, and /me endpoints to controllers and middleware.',
        },
        {
          step: 3,
          filePath: 'src/controllers/authController.js',
          role: 'Controller',
          rationale: 'Implements credential verification and JWT issuance.',
        },
        {
          step: 4,
          filePath: 'src/middleware/authMiddleware.js',
          role: 'Auth Guard',
          rationale: 'Validates Authorization Bearer tokens on protected routes.',
        },
      ],
    },
    chatHistory: [],
    chunks,
  });
}

async function start() {
  seedDemoProject();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'codemind-server' });
  });

  app.get('/api/projects', (_req: Request, res: Response) => {
    const list = Array.from(projectsStore.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => ({
        id: p.id,
        name: p.name,
        source_type: p.source_type,
        source_url: p.source_url,
        default_branch: p.default_branch,
        total_files: p.total_files,
        total_lines: p.total_lines,
        total_symbols: p.total_symbols,
        languages_json: p.languages_json,
        created_at: p.created_at,
        job_id: p.job.id,
        job_status: p.job.status,
        job_progress: p.job.progress,
        current_stage: p.job.current_stage,
        error_message: p.job.error_message,
      }));
    res.json(list);
  });

  app.post('/api/projects/github', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repoUrl = typeof req.body?.repoUrl === 'string' ? req.body.repoUrl.trim() : '';
      if (!repoUrl) {
        res.status(400).json({ error: 'repoUrl is required.' });
        return;
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(repoUrl);
      } catch {
        res.status(400).json({ error: 'Invalid repository URL format.' });
        return;
      }

      if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'github.com') {
        res.status(400).json({ error: 'Only public HTTPS github.com repository URLs are supported.' });
        return;
      }

      const parts = parsedUrl.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/').filter(Boolean);
      if (parts.length < 2 || !GITHUB_SLUG_RE.test(parts[0]) || !GITHUB_SLUG_RE.test(parts[1])) {
        res.status(400).json({ error: 'GitHub URL must follow https://github.com/owner/repo.' });
        return;
      }

      const [owner, repo] = parts;
      const projectName = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : repo;
      const projectId = randomUUID();
      const jobId = randomUUID();

      projectsStore.set(projectId, {
        id: projectId,
        name: projectName,
        source_type: 'github',
        source_url: repoUrl,
        default_branch: null,
        total_files: 0,
        total_lines: 0,
        total_symbols: 0,
        languages_json: {},
        created_at: new Date().toISOString(),
        job: { id: jobId, status: 'ingesting', progress: 10, current_stage: 'Fetching repository from GitHub API', error_message: null },
        files: [],
        summary: { projectSummary: '', fileTree: {}, graph: { nodes: [], edges: [], rankings: [] } },
        onboarding: null,
        chatHistory: [],
        chunks: [],
      });

      (async () => {
        const proj = projectsStore.get(projectId);
        if (!proj) return;
        try {
          const headers: Record<string, string> = {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'CODEMIND-Analyzer',
          };
          if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

          const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
          if (!metaRes.ok) throw new Error(`GitHub API error (${metaRes.status})`);
          const meta = (await metaRes.json()) as { default_branch?: string };
          const branch = meta.default_branch || 'main';
          proj.default_branch = branch;

          const zipRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/zipball/${encodeURIComponent(branch)}`,
            { headers, redirect: 'follow' }
          );
          if (!zipRes.ok) throw new Error(`Failed to fetch repository archive (${zipRes.status})`);
          const buf = Buffer.from(await zipRes.arrayBuffer());
          const extracted = extractEntriesFromZip(buf, true);
          await processInMemoryFiles(projectId, extracted);
        } catch (err) {
          proj.job = {
            id: jobId,
            status: 'failed',
            progress: 100,
            current_stage: 'GitHub ingestion failed',
            error_message: (err as Error).message,
          };
        }
      })();

      res.status(202).json({ projectId, jobId, name: projectName, status: 'ingesting' });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/projects/upload', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'A .zip file upload is required.' });
        return;
      }
      if (!req.file.originalname.toLowerCase().endsWith('.zip')) {
        res.status(400).json({ error: 'Only .zip archives are supported.' });
        return;
      }

      const projectName =
        typeof req.body?.name === 'string' && req.body.name.trim()
          ? req.body.name.trim()
          : req.file.originalname.replace(/\.zip$/i, '');

      const projectId = randomUUID();
      const jobId = randomUUID();

      projectsStore.set(projectId, {
        id: projectId,
        name: projectName,
        source_type: 'zip',
        source_url: null,
        default_branch: null,
        total_files: 0,
        total_lines: 0,
        total_symbols: 0,
        languages_json: {},
        created_at: new Date().toISOString(),
        job: { id: jobId, status: 'ingesting', progress: 10, current_stage: 'Safely extracting ZIP archive', error_message: null },
        files: [],
        summary: { projectSummary: '', fileTree: {}, graph: { nodes: [], edges: [], rankings: [] } },
        onboarding: null,
        chatHistory: [],
        chunks: [],
      });

      const fileBuffer = req.file.buffer;
      (async () => {
        try {
          const extracted = extractEntriesFromZip(fileBuffer, false);
          await processInMemoryFiles(projectId, extracted);
        } catch (err) {
          const proj = projectsStore.get(projectId);
          if (proj) {
            proj.job = {
              id: jobId,
              status: 'failed',
              progress: 100,
              current_stage: 'ZIP extraction failed',
              error_message: (err as Error).message,
            };
          }
        }
      })();

      res.status(202).json({ projectId, jobId, name: projectName, status: 'ingesting' });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/projects/:id', (req: Request, res: Response) => {
    const id = req.params.id;
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: 'Invalid project ID format.' });
      return;
    }
    const proj = projectsStore.get(id);
    if (!proj) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    res.json({
      project: {
        id: proj.id,
        name: proj.name,
        source_type: proj.source_type,
        source_url: proj.source_url,
        default_branch: proj.default_branch,
        total_files: proj.total_files,
        total_lines: proj.total_lines,
        total_symbols: proj.total_symbols,
        languages_json: proj.languages_json,
      },
      job: proj.job,
      files: proj.files.map(({ content: _c, ...meta }) => meta),
      summary: proj.summary,
      onboarding: proj.onboarding,
      chatHistory: proj.chatHistory,
    });
  });

  app.get('/api/projects/:id/file', (req: Request, res: Response) => {
    const id = req.params.id;
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!UUID_RE.test(id) || !relPath) {
      res.status(400).json({ error: 'Invalid project ID or file path.' });
      return;
    }
    const proj = projectsStore.get(id);
    if (!proj) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const file = proj.files.find((f) => f.file_path === relPath);
    if (!file) {
      res.status(404).json({ error: 'File not found in workspace.' });
      return;
    }
    res.json({ path: file.file_path, content: file.content });
  });

  app.post('/api/projects/:id/chat', async (req: Request, res: Response) => {
    const id = req.params.id;
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!UUID_RE.test(id) || !question) {
      res.status(400).json({ error: 'Valid project ID and question are required.' });
      return;
    }
    const proj = projectsStore.get(id);
    if (!proj) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    proj.chatHistory.push({
      id: randomUUID(),
      projectId: id,
      role: 'user',
      content: question,
      confidence: 'high',
      sources: [],
    });

    if (process.env.USE_MOCK === 'true') {
      const locations = proj.chunks.slice(0, 5).map((chunk) =>
        `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`
      );
      const assistantMsg: ChatMessageRecord = {
        id: randomUUID(),
        projectId: id,
        role: 'assistant',
        content: `Demo response for “${question}”.\n\nThe repository has ${proj.files.length} indexed files. Start by tracing the Express route, controller, middleware, and model layers. Relevant retrieved locations: ${locations.join(', ') || 'no chunks indexed yet'}.\n\nThis is a mock response because USE_MOCK=true.`,
        confidence: proj.chunks.length > 0 ? 'medium' : 'low',
        sources: proj.chunks.slice(0, 5).map((chunk) => ({
          filePath: chunk.filePath,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          symbol: chunk.symbol,
          score: 0.5,
          fromGraphNeighbor: false,
        })),
      };
      proj.chatHistory.push(assistantMsg);
      res.json(assistantMsg);
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured. Add it in Settings > Secrets to enable AI Assistant answers.',
      });
      return;
    }

    try {
      let queryEmbedding: number[] | null = null;
      const hasEmbeddings = proj.chunks.some((c) => c.embedding !== null);
      if (hasEmbeddings) {
        try {
          const embRes = await ai.models.embedContent({
            model: GEMINI_EMBEDDING_MODEL,
            contents: [question],
            config: { taskType: 'RETRIEVAL_QUERY' },
          });
          queryEmbedding = embRes.embeddings?.[0]?.values || null;
        } catch {
          queryEmbedding = null;
        }
      }

      const terms = question.toLowerCase().split(/\W+/).filter((t: string) => t.length > 2);
      const scored = proj.chunks.map((chunk) => {
        let score = 0;
        if (queryEmbedding && chunk.embedding) {
          score = Number(cosineSimilarity(queryEmbedding, chunk.embedding).toFixed(3));
        } else {
          const hay = chunk.document.toLowerCase();
          const hits = terms.filter((t: string) => hay.includes(t)).length;
          score = Number(Math.min(0.9, 0.25 + hits * 0.14).toFixed(3));
        }
        return { chunk, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const topChunks = scored.slice(0, 5);
      const topScore = topChunks[0]?.score ?? 0;
      const confidence: 'high' | 'medium' | 'low' =
        topScore >= 0.62 ? 'high' : topScore >= 0.45 ? 'medium' : 'low';

      const contextText = topChunks
        .map(
          (item, i) =>
            `[CHUNK ${i + 1} | score=${item.score} | ${item.chunk.filePath}:${item.chunk.startLine}-${item.chunk.endLine}]\n${item.chunk.document}`
        )
        .join('\n\n');

      const genRes = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Repository: ${proj.name}\nLanguages: ${JSON.stringify(proj.languages_json)}\nRetrieval Confidence: ${confidence}\n\nRetrieved Context:\n${contextText}\n\nDeveloper Question:\n${question}`,
        config: {
          systemInstruction: `You are CODEMIND, a context-aware codebase assistant. Answer strictly using the retrieved code chunks, cite sources inline as [filePath:startLine-endLine], and state clearly if context is insufficient rather than guessing.`,
        },
      });

      const assistantMsg: ChatMessageRecord = {
        id: randomUUID(),
        projectId: id,
        role: 'assistant',
        content: genRes.text || 'No response returned.',
        confidence,
        sources: topChunks.map((t) => ({
          filePath: t.chunk.filePath,
          startLine: t.chunk.startLine,
          endLine: t.chunk.endLine,
          symbol: t.chunk.symbol,
          score: t.score,
          fromGraphNeighbor: false,
        })),
      };

      proj.chatHistory.push(assistantMsg);
      res.json(assistantMsg);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/projects/:id', (req: Request, res: Response) => {
    const id = req.params.id;
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: 'Invalid project ID format.' });
      return;
    }
    projectsStore.delete(id);
    res.json({ deleted: true });
  });

  app.use((err: Error & { code?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Uploaded file exceeds 25 MB limit.' });
      return;
    }
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const idx = path.join(distDir, 'index.html');
      if (fs.existsSync(idx)) res.sendFile(idx);
      else res.status(404).send('Build not found');
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CODEMIND] Server listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('[CODEMIND] Startup error:', err);
  process.exit(1);
});
