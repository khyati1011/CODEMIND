import { createRequire } from 'module';
import { javascriptAdapter } from './languages/javascript.js';
import { pythonAdapter } from './languages/python.js';

const require = createRequire(import.meta.url);
const Parser = require('tree-sitter');

// Registry makes adding new language grammars a single entry
const LANGUAGE_ADAPTERS = new Map([
  ['JavaScript', javascriptAdapter],
  ['Python', pythonAdapter],
]);

export function getSupportedAnalyzerLanguages() {
  return Array.from(LANGUAGE_ADAPTERS.keys());
}

export function analyzeSourceCode(content, language) {
  const adapter = LANGUAGE_ADAPTERS.get(language);
  if (!adapter) {
    return {
      supported: false,
      functions: [],
      classes: [],
      symbols: [],
      imports: [],
      exports: [],
    };
  }

  const parser = new Parser();
  parser.setLanguage(adapter.grammar);
  const tree = parser.parse(content);
  const extracted = adapter.extractFromTree(tree.rootNode);

  const symbols = [...extracted.classes, ...extracted.functions].sort(
    (a, b) => a.startLine - b.startLine
  );

  return {
    supported: true,
    functions: extracted.functions,
    classes: extracted.classes,
    symbols,
    imports: extracted.imports,
    exports: extracted.exports,
  };
}
