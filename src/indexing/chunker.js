const MAX_CHUNK_LINES = 80;
const FALLBACK_WINDOW = 55;
const FALLBACK_OVERLAP = 10;

/**
 * Chunks files by extracted Tree-sitter symbols (functions/classes/methods) first,
 * falling back to overlapping line windows for module-level code or config files.
 */
export function chunkFileBySymbols(file, analysis) {
  const lines = file.content.split('\n');
  const chunks = [];
  const symbols = analysis?.symbols || [];
  const coveredLines = new Set();

  for (const sym of symbols) {
    const start = Math.max(1, sym.startLine);
    const end = Math.min(lines.length, sym.endLine);
    if (end < start) continue;

    for (let cursor = start; cursor <= end; cursor += MAX_CHUNK_LINES - 10) {
      const subEnd = Math.min(end, cursor + MAX_CHUNK_LINES - 1);
      const snippet = lines.slice(cursor - 1, subEnd).join('\n').trim();
      if (!snippet) continue;

      chunks.push({
        chunkId: `${file.path}:${sym.name}:${cursor}-${subEnd}`,
        filePath: file.path,
        language: file.language,
        symbol: sym.name,
        symbolKind: sym.kind,
        startLine: cursor,
        endLine: subEnd,
        content: snippet,
      });

      for (let l = cursor; l <= subEnd; l++) coveredLines.add(l);
      if (subEnd === end) break;
    }
  }

  let windowStart = 1;
  while (windowStart <= lines.length) {
    while (windowStart <= lines.length && coveredLines.has(windowStart)) {
      windowStart++;
    }
    if (windowStart > lines.length) break;

    let windowEnd = windowStart;
    while (
      windowEnd < lines.length &&
      windowEnd - windowStart + 1 < FALLBACK_WINDOW &&
      !coveredLines.has(windowEnd + 1)
    ) {
      windowEnd++;
    }

    const snippet = lines.slice(windowStart - 1, windowEnd).join('\n').trim();
    if (snippet) {
      chunks.push({
        chunkId: `${file.path}:module:${windowStart}-${windowEnd}`,
        filePath: file.path,
        language: file.language,
        symbol: 'module_scope',
        symbolKind: 'module',
        startLine: windowStart,
        endLine: windowEnd,
        content: snippet,
      });
    }

    const nextStart = windowEnd - FALLBACK_OVERLAP + 1;
    windowStart = nextStart > windowStart ? nextStart : windowEnd + 1;
  }

  return chunks;
}
