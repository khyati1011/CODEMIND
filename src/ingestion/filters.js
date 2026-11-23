import path from 'path';

export const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'out',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.venv',
  'venv',
  'env',
  '.idea',
  '.vscode',
]);

export const SECRET_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.crt$/i,
  /^id_rsa(\.pub)?$/i,
  /^id_ed25519(\.pub)?$/i,
  /credentials\.json$/i,
  /service[-_]?account.*\.json$/i,
  /\.npmrc$/i,
  /\.pypirc$/i,
];

export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm',
  '.mp3', '.mp4', '.mov', '.avi', '.woff', '.woff2', '.ttf', '.eot',
  '.pyc', '.pyo', '.class', '.jar', '.sqlite', '.db',
]);

export function shouldIgnorePath(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const fileName = parts[parts.length - 1] || '';

  for (const dir of parts.slice(0, -1)) {
    if (IGNORED_DIRECTORIES.has(dir)) return true;
  }

  for (const pattern of SECRET_FILE_PATTERNS) {
    if (pattern.test(fileName)) return true;
  }

  const ext = path.posix.extname(fileName).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;

  return false;
}

export function looksBinary(buffer) {
  const sample = buffer.subarray(0, 4096);
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}
