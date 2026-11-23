import { env } from '../config/env.js';
import { safeExtractZip } from './zipExtractor.js';

const GITHUB_SLUG_RE = /^[a-zA-Z0-9_.-]+$/;

export function parseGithubRepoUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid repository URL format.');
  }

  if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
    throw new Error('Only public HTTPS github.com repository URLs are supported.');
  }

  const segments = url.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new Error('GitHub URL must include owner and repository name (e.g. https://github.com/owner/repo).');
  }

  const [owner, repo] = segments;
  if (!GITHUB_SLUG_RE.test(owner) || !GITHUB_SLUG_RE.test(repo)) {
    throw new Error('GitHub owner or repository name contains invalid characters.');
  }

  return { owner, repo };
}

function buildGithubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'CODEMIND-Analyzer',
  };
  if (env.githubToken) {
    headers.Authorization = `Bearer ${env.githubToken}`;
  }
  return headers;
}

export async function fetchGithubRepository(repoUrl, workspaceDir) {
  const { owner, repo } = parseGithubRepoUrl(repoUrl);
  const headers = buildGithubHeaders();

  const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`GitHub API error (${metaRes.status}): ${errText.slice(0, 200)}`);
  }

  const meta = await metaRes.json();
  if (meta.size && meta.size * 1024 > env.limits.maxUncompressedBytes * 2) {
    throw new Error('Repository exceeds CODEMIND maximum size limit.');
  }

  const branch = meta.default_branch || 'main';
  const zipRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/zipball/${encodeURIComponent(branch)}`,
    { headers, redirect: 'follow' }
  );

  if (!zipRes.ok) {
    throw new Error(`Failed to download repository archive from GitHub API (${zipRes.status}).`);
  }

  const arrayBuffer = await zipRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > env.limits.maxUploadBytes * 2) {
    throw new Error('Downloaded repository archive exceeds allowed size.');
  }

  const extractedPath = await safeExtractZip(buffer, workspaceDir, { stripTopDir: true });

  return {
    rootDir: extractedPath,
    repoName: meta.name || repo,
    defaultBranch: branch,
  };
}
