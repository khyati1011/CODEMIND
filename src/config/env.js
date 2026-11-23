import dotenv from 'dotenv';

dotenv.config();

function parseMysqlUrl(urlStr) {
  if (!urlStr) return null;
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
    };
  } catch {
    return null;
  }
}

const mysqlFromUrl = parseMysqlUrl(process.env.MYSQL_URL);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-4-hydrogen',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2',
  useLangChain: process.env.USE_LANGCHAIN === 'true',
  useMock: process.env.USE_MOCK === 'true',
  githubToken: process.env.GITHUB_TOKEN || '',
  uploadDir: process.env.UPLOAD_DIR || '/tmp/codemind-workspaces',
  limits: {
    maxUploadBytes: (Number(process.env.MAX_UPLOAD_SIZE_MB) || 25) * 1024 * 1024,
    maxUncompressedBytes: (Number(process.env.MAX_UNCOMPRESSED_SIZE_MB) || 80) * 1024 * 1024,
    maxFileBytes: (Number(process.env.MAX_FILE_SIZE_KB) || 512) * 1024,
    maxFilesPerProject: Number(process.env.MAX_FILES_PER_PROJECT) || 1500,
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 120,
  },
  mysql: {
    host: process.env.MYSQL_HOST || mysqlFromUrl?.host || 'localhost',
    port: Number(process.env.MYSQL_PORT) || mysqlFromUrl?.port || 3306,
    user: process.env.MYSQL_USER || mysqlFromUrl?.user || 'codemind',
    password: process.env.MYSQL_PASSWORD || mysqlFromUrl?.password || 'codemind_pass',
    database: process.env.MYSQL_DATABASE || mysqlFromUrl?.database || 'codemind',
  },
  mongoUrl: process.env.MONGODB_URL || 'mongodb://localhost:27017/codemind',
  chromaUrl: process.env.CHROMA_URL || 'http://localhost:8000',
};
