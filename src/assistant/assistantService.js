import { pool } from '../config/mysql.js';
import { ChatHistory } from '../models/ChatHistory.js';
import { retrieveProjectContext } from '../retrieval/index.js';
import { generateCompletion } from './llmProvider.js';

export async function askAssistant(projectId, question) {
  await ChatHistory.create({
    projectId,
    role: 'user',
    content: question,
  });

  const [projectRows] = await pool.query(
    'SELECT name, languages_json FROM projects WHERE id = ?',
    [projectId]
  );
  const project = projectRows[0];
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }

  const { chunks, confidence } = await retrieveProjectContext(projectId, question, 6);

  if (!chunks.length) {
    return ChatHistory.create({
      projectId,
      role: 'assistant',
      confidence: 'low',
      content:
        'I could not find relevant code chunks in the indexed repository for this question. Try naming a specific file, function, or module.',
      sources: [],
    });
  }

  const contextBlock = chunks
    .map(
      (c, i) =>
        `[CHUNK ${i + 1} | score=${c.score} | ${c.filePath}:${c.startLine}-${c.endLine}]\n${c.document}`
    )
    .join('\n\n');

  const systemInstruction = `You are CODEMIND, a context-aware codebase analysis assistant.
Follow these rules strictly:
1. Answer ONLY using evidence from the retrieved code chunks and project metadata.
2. Cite sources inline as [filePath:startLine-endLine].
3. If the retrieved context is weak (confidence: ${confidence}) or incomplete to fully answer the question, explicitly state what is missing or uncertain instead of inventing details.`;

  const prompt = `Repository: ${project.name}
Languages: ${JSON.stringify(project.languages_json || {})}
Retrieval Confidence: ${confidence}

Retrieved Code Context:
${contextBlock}

Developer Question:
${question}`;

  const answer = await generateCompletion(prompt, systemInstruction);

  const sources = chunks.map((c) => ({
    filePath: c.filePath,
    startLine: c.startLine,
    endLine: c.endLine,
    symbol: c.symbol,
    score: c.score,
    fromGraphNeighbor: c.fromGraphNeighbor,
  }));

  return ChatHistory.create({
    projectId,
    role: 'assistant',
    content: answer,
    confidence,
    sources,
  });
}
