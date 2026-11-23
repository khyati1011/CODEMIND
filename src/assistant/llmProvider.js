import { GoogleGenAI } from '@google/genai';
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { env } from '../config/env.js';

let directClient = null;

function getDirectClient() {
  if (!env.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is missing in environment configuration.');
  }
  if (!directClient) {
    directClient = new GoogleGenAI({
      apiKey: env.geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return directClient;
}

async function withRetry(fn, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.code;
      const transient = status === 429 || (status >= 500 && status < 600);
      if (!transient || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

/**
 * Swappable LLM / Embeddings provider.
 * Defaults to @google/genai directly; set USE_LANGCHAIN=true to use LangChain.js.
 */
export async function generateCompletion(prompt, systemInstruction = '') {
  if (env.useMock) {
    const questionMatch = prompt.match(/Developer Question:\n([\s\S]*?)$/i);
    const question = questionMatch?.[1]?.trim() || 'your question';
    const chunks = [...prompt.matchAll(/\[CHUNK \d+ \|[^\n]*\| ([^\]]+):([^\]]+)\]/g)];
    const sources = chunks.map((match) => `${match[1]}:${match[2]}`).join(', ');
    return `Demo response for “${question}”.\n\nThis repository appears to be organized around the CODEMIND analysis pipeline and Express API routes. The retrieved implementation context points to ${sources || 'the indexed project files'}, so start by tracing the route handler, service layer, and its data dependencies.\n\nThis is a clearly marked mock response generated from repository context because USE_MOCK=true.`;
  }

  if (!env.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is missing in environment configuration.');
  }

  if (env.useLangChain) {
    return withRetry(async () => {
      const model = new ChatGoogleGenerativeAI({
        apiKey: env.geminiApiKey,
        model: env.geminiModel,
      });
      const messages = [];
      if (systemInstruction) messages.push(['system', systemInstruction]);
      messages.push(['human', prompt]);
      const res = await model.invoke(messages);
      return typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    });
  }

  const ai = getDirectClient();
  return withRetry(async () => {
    const res = await ai.models.generateContent({
      model: env.geminiModel,
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : undefined,
    });
    return res.text || '';
  });
}

export async function embedTexts(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  if (!texts.length) return [];
  if (env.useMock) {
    return texts.map((text) => {
      const vector = new Array(128).fill(0);
      for (let i = 0; i < text.length; i += 1) {
        vector[i % 128] += (text.charCodeAt(i) % 31) / 31;
      }
      return vector;
    });
  }
  if (!env.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is missing in environment configuration.');
  }

  if (env.useLangChain) {
    return withRetry(async () => {
      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: env.geminiApiKey,
        model: env.geminiEmbeddingModel,
      });
      if (taskType === 'RETRIEVAL_QUERY' && texts.length === 1) {
        return [await embeddings.embedQuery(texts[0])];
      }
      return embeddings.embedDocuments(texts);
    });
  }

  const ai = getDirectClient();
  const vectors = [];
  const batchSize = 20;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await withRetry(() =>
      ai.models.embedContent({
        model: env.geminiEmbeddingModel,
        contents: batch,
        config: { taskType },
      })
    );
    vectors.push(...(res.embeddings || []).map((e) => e.values || []));
  }
  return vectors;
}
