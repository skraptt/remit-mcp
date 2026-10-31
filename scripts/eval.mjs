// Search quality: npm run eval [-- --vectors .vectors/vectors.json] [-- --detail]
// Prints first-hit, top-3 and MRR@5 over scripts/eval-cases.mjs. With --vectors, semantic
// results from the local vector cache are fused in, as the deployed server does.

import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine.mjs';
import { dequantize, nearest } from '../src/semantic.mjs';
import { CASES, HOLDOUT } from './eval-cases.mjs';

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i === -1 ? null : process.argv[i + 1];
};
const e = createEngine(JSON.parse(readFileSync(new URL('../data/remit.json', import.meta.url), 'utf8')));
const detail = process.argv.includes('--detail');
const fusion = { k: +(arg('--k') ?? 60), bm25: 1, semantic: +(arg('--sw') ?? 1) };
const only = arg('--only');
let store = null;
let qv = null;
if (arg('--vectors')) {
  const c = JSON.parse(readFileSync(arg('--vectors'), 'utf8'));
  store = new Map(Object.entries(c.units).map(([id, v]) => [id, dequantize(v)]));
  qv = new Map(Object.entries(c.queries || {}).map(([q, v]) => [q, dequantize(v)]));
}

function run(mode, cases = CASES, name = 'dev') {
  let t1 = 0, t3 = 0, rr = 0;
  for (const [q, ok] of cases) {
    if (mode !== 'bm25' && !qv.get(q)) return console.log(`${name.padEnd(8)} ${mode.padEnd(9)} (no query vectors yet)`);
    const semantic = mode === 'bm25' ? null : nearest(store, qv.get(q), { topK: 30 }).map((x) => (typeof x === 'string' ? x : x.id));
    const ids = (mode === 'semantic' ? semantic.slice(0, 5) : e.search({ query: q, limit: 5, semantic, fusion }).results.map((x) => x.id)).map((id) => id.replace(/~\d+$/, ''));
    const r = ids.findIndex((id) => ok.includes(id)) + 1;
    t1 += r === 1;
    t3 += r > 0 && r <= 3;
    rr += r ? 1 / r : 0;
    if (detail) console.log(r === 1 ? '✓' : r && r <= 3 ? '~' : r ? '·' : '✗', q.padEnd(72), ids.slice(0, 3).join('  '));
  }
  const n = cases.length;
  console.log(`${name.padEnd(8)} ${mode.padEnd(9)} ${n} questions   first: ${((100 * t1) / n).toFixed(0)}%   top 3: ${((100 * t3) / n).toFixed(0)}%   MRR@5: ${(rr / n).toFixed(3)}`);
}

for (const [cases, name] of [[CASES, 'dev'], [HOLDOUT, 'holdout']].filter(([, n]) => !only || n === only)) {
  run('bm25', cases, name);
  if (store) {
    run('semantic', cases, name);
    run('hybrid', cases, name);
  }
}
