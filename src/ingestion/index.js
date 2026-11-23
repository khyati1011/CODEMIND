import path from 'path';
import fs from 'fs/promises';
import { env } from '../config/env.js';
import { fetchGithubRepository } from './githubFetcher.js';
import { safeExtractZip } from './zipExtractor.js';

export async function ingestFromZip(projectId, zipBuffer) {
  const workspaceDir = path.resolve(env.uploadDir, projectId);
  await fs.rm(workspaceDir, { recursive: true, force: true });
  const rootDir = await safeExtractZip(zipBuffer, workspaceDir, { stripTopDir: false });

  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory() && e.name !== '__MACOSX');
  if (entries.length === 1 && dirs.length === 1) {
    return path.join(rootDir, dirs[0].name);
  }
  return rootDir;
}

export async function ingestFromGithub(projectId, repoUrl) {
  const workspaceDir = path.resolve(env.uploadDir, projectId);
  await fs.rm(workspaceDir, { recursive: true, force: true });
  return fetchGithubRepository(repoUrl, workspaceDir);
}
