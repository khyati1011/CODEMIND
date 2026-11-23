import { chromaClient, getProjectCollectionName } from '../config/chroma.js';
import { ChunkMetadata } from '../models/ChunkMetadata.js';
import { embedTexts } from '../assistant/llmProvider.js';
import { chunkFileBySymbols } from './chunker.js';

export async function indexProjectCodebase(projectId, files, analysisMap) {
  const allChunks = [];

  for (const file of files) {
    const analysis = analysisMap.get(file.path);
    const fileChunks = chunkFileBySymbols(file, analysis);
    allChunks.push(...fileChunks);
  }

  await ChunkMetadata.deleteMany({ projectId });
  const collectionName = getProjectCollectionName(projectId);
  try {
    await chromaClient.deleteCollection({ name: collectionName });
  } catch {
    // Ignore if collection does not exist yet
  }

  if (!allChunks.length) return { chunkCount: 0 };

  await ChunkMetadata.insertMany(
    allChunks.map((c) => ({
      projectId,
      ...c,
    }))
  );

  const formattedTexts = allChunks.map(
    (c) =>
      `File: ${c.filePath} (${c.language})\nSymbol: ${c.symbol} (${c.symbolKind})\nLines ${c.startLine}-${c.endLine}:\n${c.content}`
  );

  const vectors = await embedTexts(formattedTexts, 'RETRIEVAL_DOCUMENT');
  const collection = await chromaClient.getOrCreateCollection({ name: collectionName });

  const batchSize = 50;
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const chunkSlice = allChunks.slice(i, i + batchSize);
    await collection.add({
      ids: chunkSlice.map((c) => c.chunkId),
      embeddings: vectors.slice(i, i + batchSize),
      documents: formattedTexts.slice(i, i + batchSize),
      metadatas: chunkSlice.map((c) => ({
        filePath: c.filePath,
        language: c.language,
        symbol: c.symbol,
        symbolKind: c.symbolKind,
        startLine: c.startLine,
        endLine: c.endLine,
      })),
    });
  }

  return { chunkCount: allChunks.length };
}
