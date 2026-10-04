// Revue des puits HTML : pour chaque chaîne HTML construite par concaténation dans src/js,
// liste les valeurs insérées et vérifie qu'elles passent par esc() ou par un constructeur HTML connu.
//   node audit-refonte/scripts/html-sinks.mjs <dossier typescript> [dossier js]
// Analyse syntaxique (AST TypeScript) : une valeur « à relire » n'est pas forcément un défaut, elle demande un regard humain.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)(path.resolve(process.argv[2]));
const dir = path.resolve(process.argv[3] || 'src/js');
// Fonctions dont le résultat est sûr à insérer : échappement, icônes, nombres formatés, ou HTML déjà construit avec esc().
const ESCAPERS = new Set(['esc']);
const BUILDERS = new Set(['ic', 'extLink', 'placeBadges', 'stepButton', 'postCard', 'field', 'exportJourneySVG']);
const NUMERIC = new Set(['fmt', 'Math.round', 'Math.max', 'Math.min', 'Number', 'String.fromCharCode']);
const out = { files: 0, htmlExpressions: 0, inserted: 0, escaped: 0, builder: 0, numeric: 0, literalChoice: 0, review: [] };
const text = (n, sf) => n.getText(sf);
function leaves(node, acc) { if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) { leaves(node.left, acc); leaves(node.right, acc); } else if (ts.isParenthesizedExpression(node)) leaves(node.expression, acc); else acc.push(node); return acc; }
// Une expression est « littérale » si toutes ses issues sont des chaînes fixes (ternaires, chaînes, concaténations de celles-ci).
function classify(n, sf) {
  if (ts.isStringLiteralLike(n) || ts.isNumericLiteral(n)) return 'literal';
  if (ts.isParenthesizedExpression(n)) return classify(n.expression, sf);
  if (ts.isConditionalExpression(n)) { const a = classify(n.whenTrue, sf), b = classify(n.whenFalse, sf); return a === b ? a : [a, b].includes('review') ? 'review' : [a, b].find((x) => x !== 'literal'); }
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) { const kinds = leaves(n, []).map((x) => classify(x, sf)); return kinds.includes('review') ? 'review' : kinds.find((k) => k !== 'literal') || 'literal'; }
  if (ts.isCallExpression(n)) {
    const callee = text(n.expression, sf);
    if (ESCAPERS.has(callee)) return 'escaped';
    if (BUILDERS.has(callee)) return 'builder';
    if (NUMERIC.has(callee) || /\.(toFixed|length)$/.test(callee)) return 'numeric';
    if (/\.join$/.test(callee) && ts.isPropertyAccessExpression(n.expression)) return classify(n.expression.expression, sf);   // tableau.map(...).join('')
    if (/\.(map|filter|slice|concat)$/.test(callee) && n.arguments.length && (ts.isFunctionExpression(n.arguments[0]) || ts.isArrowFunction(n.arguments[0]))) {
      const fn = n.arguments[0], rets = []; const visit = (x) => { if (ts.isReturnStatement(x) && x.expression) rets.push(x.expression); else if (!ts.isFunctionLike(x) || x === fn) ts.forEachChild(x, visit); }; ts.forEachChild(fn.body, visit);
      if (/\.map$/.test(callee)) { const kinds = rets.map((r) => classify(r, sf)); return kinds.includes('review') ? 'review' : kinds.find((k) => k !== 'literal') || 'literal'; }
      return classify(n.expression.expression, sf);
    }
    if (/\.(replace)$/.test(callee)) return classify(n.expression.expression, sf);
    return 'review';
  }
  if (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) return 'numeric';
  if (ts.isBinaryExpression(n)) return [ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.SlashToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.GreaterThanEqualsToken].includes(n.operatorToken.kind) ? 'numeric' : n.operatorToken.kind === ts.SyntaxKind.BarBarToken ? classify(n.left, sf) === 'literal' && classify(n.right, sf) === 'literal' ? 'literal' : 'review' : 'review';
  return 'review';
}
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8'), sf = ts.createSourceFile(f, src, ts.ScriptTarget.ES2022, true); out.files++;
  const seen = new Set();
  const visit = (node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken && !(node.parent && ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken)) {
      const parts = leaves(node, []);
      if (parts.some((p) => ts.isStringLiteralLike(p) && /<[a-z!\/]/i.test(p.text))) {
        out.htmlExpressions++;
        for (const p of parts) {
          if (ts.isStringLiteralLike(p) || ts.isNumericLiteral(p)) continue;
          const kind = classify(p, sf); out.inserted++;
          if (kind === 'escaped') out.escaped++; else if (kind === 'builder') out.builder++; else if (kind === 'numeric') out.numeric++; else if (kind === 'literal') out.literalChoice++;
          else { const key = f + ':' + text(p, sf); if (!seen.has(key)) { seen.add(key); out.review.push({ file: f, line: sf.getLineAndCharacterOfPosition(p.getStart(sf)).line + 1, value: text(p, sf).replace(/\s+/g, ' ').slice(0, 110) }); } }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
