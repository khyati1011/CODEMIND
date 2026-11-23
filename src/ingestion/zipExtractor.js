import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import { env } from '../config/env.js';
import { looksBinary, shouldIgnorePath } from './filters.js';

/**
 * Safely extracts a ZIP buffer into workspaceDir.
 * Guards against Zip-Slip traversal, zip bombs, symlinks, binaries, secrets, and dependency caches.
 * Extracted files are strictly read as static text and never executed.
 */
export async function safeExtractZip(zipBuffer, workspaceDir, { stripTopDir = false } = {}) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  if (entries.length > env.limits.maxFilesPerProject * 4) {
    throw new Error('Archive contains too many entries to safely process.');
  }

  const resolvedBase = path.resolve(workspaceDir);
  await fs.mkdir(resolvedBase, { recursive: true });

  let totalUncompressed = 0;
  let writtenFiles = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    // Reject UNIX symlinks
    const unixMode = (entry.header.attr >>> 16) & 0o170000;
    if (unixMode === 0o120000) continue;

    let entryPath = entry.entryName.replace(/\\/g, '/').replace(/^\/+/, '');
    if (stripTopDir) {
      const idx = entryPath.indexOf('/');
      if (idx !== -1) entryPath = entryPath.slice(idx + 1);
    }

    if (!entryPath || entryPath.split('/').includes('..')) continue;
    if (shouldIgnorePath(entryPath)) continue;

    const data = entry.getData();
    if (data.length > env.limits.maxFileBytes) continue;

    totalUncompressed += data.length;
    if (totalUncompressed > env.limits.maxUncompressedBytes) {
      throw new Error('Uncompressed repository exceeds maximum allowed workspace size.');
    }

    if (looksBinary(data)) continue;

    const targetPath = path.resolve(resolvedBase, entryPath);
    if (!targetPath.startsWith(resolvedBase + path.sep)) {
      throw new Error(`Unsafe archive entry blocked: ${entry.entryName}`);
    }

    writtenFiles += 1;
    if (writtenFiles > env.limits.maxFilesPerProject) {
      throw new Error(`Project exceeds maximum file limit (${env.limits.maxFilesPerProject}).`);
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, data);
  }

  if (writtenFiles === 0) {
    throw new Error('No valid non-binary source files remained after security filtering.');
  }

  return resolvedBase;
}
