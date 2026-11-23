import { chromaClient, getProjectCollectionName } from '../config/chroma.js';
import { Summary } from '../models/Summary.js';
import { ChunkMetadata } from '../models/ChunkMetadata.js';
import { getGraphNeighbors } from '../graph/index.js';
import { embedTexts } from '../assistant/llmProvider.js';

export async function retrieveProjectContext(projectId, query, topK = 6) {
  const collectionName = getProjectCollectionName(projectId);
  const collection = await chromaClient.getCollection({ name: collectionName });

  const [queryVector] = await embedTexts([query], 'RETRIEVAL_QUERY');
  const searchRes = await collection.query({
    queryEmbeddings: [queryVector],
    nResults: topK,
  });

  const docs = searchRes.documents?.[0] || [];
  const metas = searchRes.metadatas?.[0] || [];
  const distances = searchRes.distances?.[0] || [];

  const primaryChunks = metas.map((m, idx) => {
    const dist = distances[idx] ?? 1.0;
    const score = Number((1 / (1 + dist)).toFixed(3));
    return {
      filePath: m.filePath,
      language: m.language,
      symbol: m.symbol,
      startLine: Number(m.startLine),
      endLine: Number(m.endLine),
      score,
      fromGraphNeighbor: false,
      document: docs[idx],
    };
  });

  const summaryDoc = await Summary.findOne({ projectId }).lean();
  const primaryFiles = [...new Set(primaryChunks.map((c) => c.filePath))];
  const neighborFiles = getGraphNeighbors(summaryDoc?.graph, primaryFiles, 3);

  const neighborChunks = [];
  if (neighborFiles.length > 0) {
    const found = await ChunkMetadata.find({
      projectId,
      filePath: { $in: neighborFiles },
    })
      .limit(3)
      .lean();

    for (const item of found) {
      neighborChunks.push({
        filePath: item.filePath,
        language: item.language,
        symbol: item.symbol,
        startLine: item.startLine,
        endLine: item.endLine,
        score: 0.4,
        fromGraphNeighbor: true,
        document: `File: ${item.filePath} (${item.language}) [Graph Neighbor]\nSymbol: ${item.symbol}\nLines ${item.startLine}-${item.endLine}:\n${item.content}`,
      });
    }
  }

  const topScore = primaryChunks[0]?.score ?? 0;
  const confidence = topScore >= 0.62 ? 'high' : topScore >= 0.45 ? 'medium' : 'low';

  return {
    chunks: [...primaryChunks, ...neighborChunks],
    confidence,
  };
}
