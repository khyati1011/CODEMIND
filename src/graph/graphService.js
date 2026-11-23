import path from 'path';
import Graph from 'graphology';

export function resolveModulePath(sourceFile, rawImport, fileSet) {
  if (rawImport.startsWith('.')) {
    const dir = path.posix.dirname(sourceFile);
    const normalized = path.posix.normalize(path.posix.join(dir, rawImport));
    const candidates = [
      normalized,
      `${normalized}.js`,
      `${normalized}.mjs`,
      `${normalized}.cjs`,
      `${normalized}.jsx`,
      `${normalized}.py`,
      `${normalized}/index.js`,
      `${normalized}/index.jsx`,
      `${normalized}/__init__.py`,
    ];
    for (const candidate of candidates) {
      if (fileSet.has(candidate)) return candidate;
    }
  }

  const cleanedPy = rawImport.replace(/^\.+/, '').replace(/\./g, '/');
  if (cleanedPy) {
    const dir = path.posix.dirname(sourceFile);
    const pyCandidates = [
      `${cleanedPy}.py`,
      `${cleanedPy}/__init__.py`,
      path.posix.normalize(path.posix.join(dir, `${cleanedPy}.py`)),
    ];
    for (const candidate of pyCandidates) {
      if (fileSet.has(candidate)) return candidate;
    }
  }

  return null;
}

export function buildDependencyGraph(files, analysisMap) {
  const graph = new Graph({ type: 'directed', allowSelfLoops: false });
  const codeFiles = files.filter((f) => f.isCodeSupported);
  const fileSet = new Set(codeFiles.map((f) => f.path));

  for (const file of codeFiles) {
    graph.addNode(file.path, {
      label: path.posix.basename(file.path),
      language: file.language,
      linesCount: file.linesCount,
    });
  }

  for (const file of codeFiles) {
    const analysis = analysisMap.get(file.path);
    if (!analysis) continue;

    for (const rawImport of analysis.imports) {
      const target = resolveModulePath(file.path, rawImport, fileSet);
      if (target && target !== file.path && graph.hasNode(target) && !graph.hasEdge(file.path, target)) {
        graph.addEdge(file.path, target);
      }
    }
  }

  const nodes = graph.nodes().map((nodeId) => {
    const attrs = graph.getNodeAttributes(nodeId);
    const inDegree = graph.inDegree(nodeId);
    const outDegree = graph.outDegree(nodeId);
    const baseName = attrs.label.toLowerCase();
    const isLikelyEntry =
      (inDegree === 0 && outDegree > 0) ||
      ['index.js', 'server.js', 'app.js', 'main.js', 'main.py', 'app.py'].includes(baseName);

    const centrality = inDegree * 2 + outDegree;

    return {
      id: nodeId,
      label: attrs.label,
      language: attrs.language,
      linesCount: attrs.linesCount,
      inDegree,
      outDegree,
      centrality,
      isEntryPoint: isLikelyEntry,
    };
  });

  const edges = graph.edges().map((edgeId) => ({
    source: graph.source(edgeId),
    target: graph.target(edgeId),
  }));

  const rankings = [...nodes]
    .sort((a, b) => Number(b.isEntryPoint) - Number(a.isEntryPoint) || b.centrality - a.centrality)
    .slice(0, 12)
    .map((n) => ({
      filePath: n.id,
      score: n.centrality,
      reason: n.isEntryPoint
        ? `Entry/orchestrator file (${n.outDegree} outgoing imports, ${n.inDegree} incoming)`
        : `Core module (${n.inDegree} dependents, ${n.outDegree} imports)`,
    }));

  return { graph, nodes, edges, rankings };
}

export function getGraphNeighbors(graphData, filePaths, maxExtras = 4) {
  if (!graphData?.edges?.length || !filePaths.length) return [];
  const seedSet = new Set(filePaths);
  const neighbors = new Set();

  for (const edge of graphData.edges) {
    if (seedSet.has(edge.source) && !seedSet.has(edge.target)) {
      neighbors.add(edge.target);
    }
    if (seedSet.has(edge.target) && !seedSet.has(edge.source)) {
      neighbors.add(edge.source);
    }
    if (neighbors.size >= maxExtras) break;
  }

  return Array.from(neighbors);
}
