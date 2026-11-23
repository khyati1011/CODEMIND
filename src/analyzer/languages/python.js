import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Python = require('tree-sitter-python');

export const pythonAdapter = {
  language: 'Python',
  grammar: Python,

  extractFromTree(rootNode) {
    const functions = [];
    const classes = [];
    const imports = [];
    const exportsList = [];

    function visit(node, depth = 0) {
      switch (node.type) {
        case 'function_definition': {
          const nameNode = node.childForFieldName('name');
          if (nameNode) {
            const isMethod = node.parent?.parent?.type === 'class_definition';
            functions.push({
              name: nameNode.text,
              kind: isMethod ? 'method' : 'function',
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
            });
            if (depth <= 1 && !nameNode.text.startsWith('_')) {
              exportsList.push(nameNode.text);
            }
          }
          break;
        }
        case 'class_definition': {
          const nameNode = node.childForFieldName('name');
          if (nameNode) {
            classes.push({
              name: nameNode.text,
              kind: 'class',
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
            });
            if (!nameNode.text.startsWith('_')) {
              exportsList.push(nameNode.text);
            }
          }
          break;
        }
        case 'import_from_statement': {
          const mod = node.childForFieldName('module_name');
          if (mod) imports.push(mod.text);
          break;
        }
        case 'import_statement': {
          for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (child.type === 'dotted_name') {
              imports.push(child.text);
            } else if (child.type === 'aliased_import') {
              const nameNode = child.childForFieldName('name');
              if (nameNode) imports.push(nameNode.text);
            }
          }
          break;
        }
        default:
          break;
      }

      for (let i = 0; i < node.namedChildCount; i++) {
        visit(node.namedChild(i), depth + 1);
      }
    }

    visit(rootNode);

    return {
      functions,
      classes,
      imports: [...new Set(imports)],
      exports: [...new Set(exportsList)],
    };
  },
};
