import path from 'path';

export const SUPPORTED_SOURCE_EXTENSIONS = {
  '.js': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.jsx': 'JavaScript',
  '.py': 'Python',
};

export const CONTEXT_EXTENSIONS = {
  '.json': 'JSON',
  '.md': 'Markdown',
  '.txt': 'Text',
  '.yml': 'YAML',
  '.yaml': 'YAML',
  '.sql': 'SQL',
};

export function detectFileLanguage(filePath) {
  const base = path.posix.basename(filePath);
  if (base === 'Dockerfile') return { language: 'Docker', isCodeSupported: false };

  const ext = path.posix.extname(filePath).toLowerCase();
  if (SUPPORTED_SOURCE_EXTENSIONS[ext]) {
    return { language: SUPPORTED_SOURCE_EXTENSIONS[ext], isCodeSupported: true };
  }
  if (CONTEXT_EXTENSIONS[ext]) {
    return { language: CONTEXT_EXTENSIONS[ext], isCodeSupported: false };
  }
  return { language: 'Unsupported', isCodeSupported: false };
}
