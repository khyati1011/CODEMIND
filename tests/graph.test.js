import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDependencyGraph, getGraphNeighbors } from '../src/graph/index.js';

test('Graphology builder maps JS and Python file dependencies and computes entry-point rankings', () => {
  const files = [
    { path: 'src/server.js', language: 'JavaScript', isCodeSupported: true, linesCount: 25 },
    { path: 'src/routes/auth.js', language: 'JavaScript', isCodeSupported: true, linesCount: 40 },
    { path: 'src/utils/jwt.js', language: 'JavaScript', isCodeSupported: true, linesCount: 30 },
    { path: 'README.md', language: 'Markdown', isCodeSupported: false, linesCount: 10 },
  ];

  const analysisMap = new Map([
    ['src/server.js', { imports: ['./routes/auth'] }],
    ['src/routes/auth.js', { imports: ['../utils/jwt', 'express'] }],
    ['src/utils/jwt.js', { imports: [] }],
  ]);

  const { nodes, edges, rankings } = buildDependencyGraph(files, analysisMap);

  assert.equal(nodes.length, 3);
  assert.equal(edges.length, 2);
  assert.ok(edges.some((e) => e.source === 'src/server.js' && e.target === 'src/routes/auth.js'));
  assert.ok(edges.some((e) => e.source === 'src/routes/auth.js' && e.target === 'src/utils/jwt.js'));

  const serverNode = nodes.find((n) => n.id === 'src/server.js');
  assert.equal(serverNode.isEntryPoint, true);
  assert.equal(rankings[0].filePath, 'src/server.js');

  const neighbors = getGraphNeighbors({ edges }, ['src/routes/auth.js'], 4);
  assert.deepEqual(neighbors.sort(), ['src/server.js', 'src/utils/jwt.js']);
});
