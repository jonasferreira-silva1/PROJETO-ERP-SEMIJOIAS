const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const files = [
  path.join(__dirname, 'src/screens/DonaPlaceholder.tsx'),
  path.join(__dirname, 'src/screens/FuncPlaceholder.tsx')
];

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  const code = fs.readFileSync(filePath, 'utf8');

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    console.log(`Analyzing: ${path.basename(filePath)}`);
    let count = 0;

    traverse(ast, {
      JSXExpressionContainer(pathNode) {
        const expr = pathNode.node.expression;
        if (expr.type === 'LogicalExpression' && expr.operator === '&&') {
          // Checa se a parte esquerda pode ser um número ou length
          const left = expr.left;
          let isSuspect = false;
          
          if (left.type === 'MemberExpression' && left.property.name === 'length') {
            isSuspect = true;
          } else if (left.type === 'Identifier' && left.name === 'length') {
            isSuspect = true;
          } else if (left.type === 'BinaryExpression') {
            // Operadores que retornam booleano são seguros
            const safeOps = ['===', '!==', '==', '!=', '>', '<', '>=', '<='];
            if (!safeOps.includes(left.operator)) {
              isSuspect = true;
            }
          } else if (left.type === 'LogicalExpression') {
            isSuspect = true;
          }

          if (isSuspect) {
            console.log(`  ❌ Suspect Expression: {${code.substring(expr.start, expr.end)}}
              Line: ${expr.loc.start.line}:${expr.loc.start.column}
            `);
            count++;
          }
        }
      }
    });

    if (count === 0) {
      console.log(`  ✅ No suspect expressions found!`);
    } else {
      console.log(`  Total: ${count} suspect expressions.`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
});
