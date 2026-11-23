import type { ChatMessage, ProjectDetail, ProjectListItem } from '../types.ts';

const API_BASE = '/api';

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const res = await fetch(`${API_BASE}/projects`);
  return parseJsonResponse<ProjectListItem[]>(res);
}

export async function ingestGithubRepository(repoUrl: string, name: string) {
  const res = await fetch(`${API_BASE}/projects/github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl, name }),
  });
  return parseJsonResponse<{ projectId: string; jobId: string; name: string; status: string }>(res);
}

export async function ingestZipArchive(file: File | null, name: string) {
  if (!file) throw new Error('Please choose a .zip file to upload.');
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);

  const res = await fetch(`${API_BASE}/projects/upload`, {
    method: 'POST',
    body: formData,
  });
  return parseJsonResponse<{ projectId: string; jobId: string; name: string; status: string }>(res);
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail> {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}`);
  return parseJsonResponse<ProjectDetail>(res);
}

export async function getProjectFile(projectId: string, filePath: string) {
  const res = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(filePath)}`
  );
  return parseJsonResponse<{ path: string; content: string }>(res);
}

export async function askProjectAssistant(projectId: string, question: string): Promise<ChatMessage> {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  return parseJsonResponse<ChatMessage>(res);
}

export async function deleteProject(projectId: string) {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
  return parseJsonResponse<{ deleted: boolean }>(res);
}
