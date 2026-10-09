import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['packages', 'tests', 'scripts'];
function walk(dir) {
  return readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const path = join(dir,entry.name);
    return entry.isDirectory() ? walk(path) : /\.(ts|mjs)$/.test(path) ? [path] : [];
  });
}
const errors = [];
for (const file of roots.flatMap(walk)) {
  const content = readFileSync(file,'utf8');
  if (content.includes('\t')) errors.push(`${file}: tab character`);
  if (/\b(?:@ts-ignore|@ts-nocheck)\b/.test(content)) errors.push(`${file}: TypeScript suppression directive`);
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true,
    file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  function inspect(node) {
    if (node.kind === ts.SyntaxKind.DebuggerStatement) errors.push(`${file}: debugger statement`);
    if (node.kind === ts.SyntaxKind.AnyKeyword) errors.push(`${file}: explicit any type`);
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(source) === 'console'
      && node.expression.name.text === 'log') errors.push(`${file}: console.log`);
    ts.forEachChild(node,inspect);
  }
  inspect(source);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode=1; }
else console.info('ProjectOS source quality checks passed');
