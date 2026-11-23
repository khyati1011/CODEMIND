import { ChromaClient } from 'chromadb';
import { env } from './env.js';

const parsed = new URL(env.chromaUrl);

export const chromaClient = new ChromaClient({
  ssl: parsed.protocol === 'https:',
  host: parsed.hostname,
  port: Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 8000),
});

export function getProjectCollectionName(projectId) {
  return `cm_${projectId.replace(/[^a-zA-Z0-9]/g, '')}`;
}
