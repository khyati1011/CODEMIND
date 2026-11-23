const API_BASE = '/api';

async function parseJsonResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function listProjects() {
  const res = await fetch(`${API_BASE}/projects`);
  return parseJsonResponse(res);
}

export async function ingestGithubRepository(repoUrl, name) {
  const res = await fetch(`${API_BASE}/projects/github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl, name }),
  });
  return parseJsonResponse(res);
}

export async function ingestZipArchive(file, name) {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);

  const res = await fetch(`${API_BASE}/projects/upload`, {
    method: 'POST',
    body: formData,
  });
  return parseJsonResponse(res);
}

export async function getProjectDetail(projectId) {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}`);
  return parseJsonResponse(res);
}

export async function getProjectJobStatus(projectId) {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/job`);
  return parseJsonResponse(res);
}

export async function getProjectFile(projectId, filePath) {
  const res = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(filePath)}`
  );
  return parseJsonResponse(res);
}

export async function askProjectAssistant(projectId, question) {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  return parseJsonResponse(res);
}

export async function deleteProject(projectId) {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
  return parseJsonResponse(res);
}
