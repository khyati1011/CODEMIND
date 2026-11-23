import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSourceCode } from '../src/analyzer/index.js';

test('Tree-sitter JavaScript analyzer extracts functions, classes, imports, and exports', () => {
  const source = `
    import express from 'express';
    const helper = require('./utils/helper');

    export class AuthService {
      verifyToken(token) {
        return Boolean(token);
      }
    }

    export function startServer(port) {
      return port;
    }

    const buildApp = () => express();
  `;

  const result = analyzeSourceCode(source, 'JavaScript');
  assert.equal(result.supported, true);
  assert.ok(result.classes.some((c) => c.name === 'AuthService'));
  assert.ok(result.functions.some((f) => f.name === 'verifyToken' && f.kind === 'method'));
  assert.ok(result.functions.some((f) => f.name === 'startServer' && f.kind === 'function'));
  assert.ok(result.functions.some((f) => f.name === 'buildApp'));
  assert.deepEqual(result.imports.sort(), ['./utils/helper', 'express']);
  assert.ok(result.exports.includes('AuthService'));
  assert.ok(result.exports.includes('startServer'));
});

test('Tree-sitter Python analyzer extracts classes, functions, and imports', () => {
  const source = `
from services.db import get_connection
import os

class TokenManager:
    def issue(self, user_id):
        return user_id

def validate_payload(data):
    return bool(data)
  `;

  const result = analyzeSourceCode(source, 'Python');
  assert.equal(result.supported, true);
  assert.ok(result.classes.some((c) => c.name === 'TokenManager'));
  assert.ok(result.functions.some((f) => f.name === 'issue' && f.kind === 'method'));
  assert.ok(result.functions.some((f) => f.name === 'validate_payload' && f.kind === 'function'));
  assert.ok(result.imports.includes('services.db'));
  assert.ok(result.imports.includes('os'));
});

test('Unsupported language returns supported: false cleanly', () => {
  const result = analyzeSourceCode('SELECT 1;', 'SQL');
  assert.equal(result.supported, false);
  assert.deepEqual(result.symbols, []);
});
