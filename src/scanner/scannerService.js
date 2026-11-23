import fs from 'fs/promises';
import path from 'path';
import { shouldIgnorePath } from '../ingestion/filters.js';
import { detectFileLanguage } from './languageMap.js';

function insertIntoTree(tree, relPath, meta) {
  const parts = relPath.split('/').filter(Boolean);
  let cursor = tree;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isFile = i === parts.length - 1;
    if (isFile) {
      cursor[part] = { type: 'file', path: relPath, language: meta.language, linesCount: meta.linesCount };
    } else {
      if (!cursor[part] || cursor[part].type === 'file') {
        cursor[part] = { type: 'dir', children: {} };
      }
      cursor = cursor[part].children;
    }
  }
}

export async function scanWorkspace(rootDir) {
  const scannedFiles = [];
  const unsupportedFiles = [];
  const languageCounts = {};
  const directories = new Set();
  const fileTree = {};

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (!shouldIgnorePath(`${relPath}/placeholder`)) {
          directories.add(relPath);
          await walk(fullPath);
        }
        continue;
      }

      if (shouldIgnorePath(relPath)) continue;

      const { language, isCodeSupported } = detectFileLanguage(relPath);
      if (language === 'Unsupported') {
        unsupportedFiles.push(relPath);
        continue;
      }

      const stat = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const linesCount = content.split('\n').length;
      const directory = path.posix.dirname(relPath);

      languageCounts[language] = (languageCounts[language] || 0) + 1;
      insertIntoTree(fileTree, relPath, { language, linesCount });

      scannedFiles.push({
        path: relPath,
        directory: directory === '.' ? '/' : directory,
        language,
        isCodeSupported,
        linesCount,
        sizeBytes: stat.size,
        content,
      });
    }
  }

  await walk(rootDir);

  return {
    files: scannedFiles,
    unsupportedFiles,
    languageCounts,
    directories: Array.from(directories).sort(),
    fileTree,
  };
}
