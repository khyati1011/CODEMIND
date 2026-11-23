import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkFileBySymbols } from '../src/indexing/chunker.js';

test('chunkFileBySymbols creates symbol-aligned chunks plus module-scope chunks', () => {
  const content = [
    "import { db } from './db.js';",
    '',
    'export function loadUser(id) {',
    '  return db.find(id);',
    '}',
    '',
    'export class SessionStore {',
    '  get(key) {',
    '    return key;',
    '  }',
    '}',
  ].join('\n');

  const file = {
    path: 'src/users.js',
    language: 'JavaScript',
    content,
  };

  const analysis = {
    symbols: [
      { name: 'loadUser', kind: 'function', startLine: 3, endLine: 5 },
      { name: 'SessionStore', kind: 'class', startLine: 7, endLine: 11 },
    ],
  };

  const chunks = chunkFileBySymbols(file, analysis);

  const fnChunk = chunks.find((c) => c.symbol === 'loadUser');
  assert.ok(fnChunk);
  assert.equal(fnChunk.startLine, 3);
  assert.equal(fnChunk.endLine, 5);
  assert.match(fnChunk.content, /db\.find/);

  const classChunk = chunks.find((c) => c.symbol === 'SessionStore');
  assert.ok(classChunk);
  assert.equal(classChunk.symbolKind, 'class');

  const modChunk = chunks.find((c) => c.symbol === 'module_scope');
  assert.ok(modChunk);
  assert.equal(modChunk.startLine, 1);
});
