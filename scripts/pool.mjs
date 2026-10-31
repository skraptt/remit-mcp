// Builds the judging pool: for each candidate question, the union of the top results of
// BM25, semantic and hybrid search (plus the unit the question was derived from).
//
//   node scripts/pool.mjs --vectors .vectors/vectors.json [--depth 5] > pool.json

import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine.mjs';
import { dequantize, nearest } from '../src/semantic.mjs';
import { CANDIDATES } from './eval-candidates.mjs';

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i === -1 ? null : process.argv[i + 1];
};
const depth = +(arg('--depth') ?? 5);
const data = JSON.parse(readFileSync(new URL('../data/remit.json', import.meta.url), 'utf8'));
const e = createEngine(data);
const c = JSON.parse(readFileSync(arg('--vectors'), 'utf8'));
const store = new Map(Object.entries(c.units).map(([id, v]) => [id, dequantize(v)]));
const base = (id) => id.replace(/~\d+$/, '');

const out = [];
for (const [id, q, origin, type] of CANDIDATES) {
  const qv = c.queries[q];
  if (!qv) throw new Error(`No query vector for ${id}`);
  const sem = nearest(store, dequantize(qv), { topK: 30 }).map((x) => (typeof x === 'string' ? x : x.id));
  const lists = {
    bm25: e.search({ query: q, limit: depth }).results.map((r) => base(r.id)),
    semantic: [...new Set(sem.map(base))].slice(0, depth),
    hybrid: e.search({ query: q, limit: depth, semantic: sem }).results.map((r) => base(r.id)),
  };
  const ids = [...new Set([...(origin ? [origin] : []), ...lists.hybrid, ...lists.bm25, ...lists.semantic])];
  const candidates = ids.map((uid) => {
    const p = e.getProvision({ provision: uid, related: 0 });
    return {
      id: uid,
      citation: p.citation,
      title: p.title,
      layer: p.layer,
      url: p.url,
      text: p.text.length > 1800 ? `${p.text.slice(0, 1800)}…` : p.text,
      from: Object.entries(lists).filter(([, l]) => l.includes(uid)).map(([k]) => k).concat(uid === origin ? ['origin'] : []),
    };
  });
  out.push({ id, q, type, origin, candidates });
}
process.stdout.write(JSON.stringify(out));
const n = out.reduce((a, x) => a + x.candidates.length, 0);
console.error(`${out.length} questions, ${n} candidates (${(n / out.length).toFixed(1)} per question)`);
