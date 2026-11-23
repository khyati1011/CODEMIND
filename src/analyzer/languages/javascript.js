import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const JavaScript = require('tree-sitter-javascript');

export const javascriptAdapter = {
  language: 'JavaScript',
  grammar: JavaScript,

  extractFromTree(rootNode) {
    const functions = [];
    const classes = [];
    const imports = [];
    const exportsList = [];

    function visit(node) {
      switch (node.type) {
        case 'function_declaration': {
          const nameNode = node.childForFieldName('name');
          if (nameNode) {
            functions.push({
              name: nameNode.text,
              kind: 'function',
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
            });
          }
          break;
        }
        case 'class_declaration': {
          const nameNode = node.childForFieldName('name');
          if (nameNode) {
            classes.push({
              name: nameNode.text,
              kind: 'class',
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
            });
          }
          break;
        }
        case 'method_definition': {
          const nameNode = node.childForFieldName('name');
          if (nameNode) {
            functions.push({
              name: nameNode.text,
              kind: 'method',
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
            });
          }
          break;
        }
        case 'lexical_declaration':
        case 'variable_declaration': {
          for (let i = 0; i < node.namedChildCount; i++) {
            const decl = node.namedChild(i);
            if (decl.type === 'variable_declarator') {
              const nameNode = decl.childForFieldName('name');
              const valNode = decl.childForFieldName('value');
              if (nameNode && valNode && (valNode.type === 'arrow_function' || valNode.type === 'function_expression')) {
                functions.push({
                  name: nameNode.text,
                  kind: 'function',
                  startLine: node.startPosition.row + 1,
                  endLine: node.endPosition.row + 1,
                });
              }
            }
          }
          break;
        }
        case 'import_statement': {
          const source = node.childForFieldName('source');
          if (source) imports.push(source.text.replace(/['"`]/g, ''));
          break;
        }
        case 'call_expression': {
          const fn = node.childForFieldName('function');
          const args = node.childForFieldName('arguments');
          if (fn?.text === 'require' && args && args.namedChildCount > 0) {
            const arg0 = args.namedChild(0);
            if (arg0.type === 'string') {
              imports.push(arg0.text.replace(/['"`]/g, ''));
            }
          }
          break;
        }
        case 'export_statement': {
          const decl = node.childForFieldName('declaration');
          if (decl) {
            const nameNode = decl.childForFieldName('name');
            if (nameNode) {
              exportsList.push(nameNode.text);
            } else {
              for (let i = 0; i < decl.namedChildCount; i++) {
                const sub = decl.namedChild(i);
                const subName = sub.childForFieldName('name');
                if (subName) exportsList.push(subName.text);
              }
            }
          } else {
            exportsList.push(node.text.slice(0, 80).replace(/\s+/g, ' '));
          }
          break;
        }
        case 'assignment_expression': {
          const left = node.childForFieldName('left');
          if (left && (left.text.startsWith('module.exports') || left.text.startsWith('exports.'))) {
            exportsList.push(left.text);
          }
          break;
        }
        default:
          break;
      }

      for (let i = 0; i < node.namedChildCount; i++) {
        visit(node.namedChild(i));
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
