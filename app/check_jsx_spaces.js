const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const filePath = path.join(__dirname, 'src/screens/DonaPlaceholder.tsx');
const code = fs.readFileSync(filePath, 'utf8');

try {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });

  let count = 0;

  traverse(ast, {
    JSXExpressionContainer(pathNode) {
      const expr = pathNode.node.expression;
      if (
        (expr.type === 'StringLiteral' && expr.value.trim() === '') ||
        (expr.type === 'TemplateLiteral' && expr.quasis.length === 1 && expr.quasis[0].value.raw.trim() === '')
      ) {
        // Encontra se está fora de <Text>
        let parent = pathNode.parentPath;
        let isInsideText = false;
        while (parent) {
          if (parent.node.type === 'JSXElement' && parent.node.openingElement.name.name === 'Text') {
            isInsideText = true;
            break;
          }
          parent = parent.parentPath;
        }

        if (!isInsideText) {
          console.log(`❌ Espaço vazio expresso fora de <Text>:
            Linha: ${expr.loc.start.line}:${expr.loc.start.column}
          `);
          count++;
        }
      }
    }
  });

  if (count === 0) {
    console.log('✅ Nenhum espaço vazio fora de <Text> foi encontrado!');
  } else {
    console.log(`Fim da checagem: ${count} erros encontrados.`);
  }

} catch (err) {
  console.error('Error:', err.message);
}
