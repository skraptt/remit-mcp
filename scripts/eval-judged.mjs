// Judged evaluation: BM25, semantic and hybrid search against eval/qrels.json
// (graded relevance 0/1/2 for 115 questions; see the "method" field in that file).
//
//   node scripts/eval-judged.mjs --vectors .vectors/vectors.json [--detail] [--type everyday|technical|temporal] [--split dev|test]
//
// Metrics (unjudged results count as not relevant; the share of unjudged results is printed):
//   nDCG@5      graded, gain 2^g - 1 (answers = 3, relevant = 1), ideal from all judged units
//   Succ@1      the first result answers the question (grade 2)
//   MRR@5       reciprocal rank of the first grade-2 result within the top 5
//   R@5, R@8    share of a question's grade-2 units found in the top 5 / top 8
//   Rel@5       at least one result of grade >= 1 in the top 5
//   Old@5       share of top-5 results from the repealed Implementing Regulation 1348/2014,
//               on questions that are not about the transition
//   No2         questions where no judged unit answers the question (left out of Succ/MRR/R)

import { readFileSync } from 'node:fs';
import { createEngine, FUSION } from '../src/engine.mjs';
import { dequantize, nearest } from '../src/semantic.mjs';
import { CANDIDATES } from './eval-candidates.mjs';

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i === -1 ? null : process.argv[i + 1];
};
const detail = process.argv.includes('--detail');
const onlyType = arg('--type');

const data = JSON.parse(readFileSync(new URL('../data/remit.json', import.meta.url), 'utf8'));
const { qrels } = JSON.parse(readFileSync(new URL('../eval/qrels.json', import.meta.url), 'utf8'));
// --dw "ACER-TRUM=0.7,ACER-MOP=0.7": document weights to try (see createEngine).
const dwArg = arg('--dw');
const docWeight = Object.fromEntries((dwArg ? dwArg.split(',') : []).map((x) => x.split('=')).map(([k, v]) => [k, +v]));
const e = createEngine(data, { docWeight });
const vpath = arg('--vectors');
const c = vpath ? JSON.parse(readFileSync(vpath, 'utf8')) : null;
const store = c ? new Map(Object.entries(c.units).map(([id, v]) => [id, dequantize(v)])) : null;
const base = (id) => id.replace(/~\d+$/, '');
const dedupe = (ids) => [...new Set(ids.map(base))];
const DEPTH = 10;
const TRANSITION = new Set(['t002']); // questions about the old regulation itself

// Experiment results from CI (scripts/experiment.mjs): reranker scores and Q&A title vectors.
const expPath = arg('--exp');
const exp = expPath ? JSON.parse(readFileSync(expPath, 'utf8')) : null;
const RR = exp ? Object.values(exp.rerank)[0] : null;
const titleStore = exp ? new Map(Object.entries(exp.titles).map(([id, v]) => [id, dequantize(v)])) : null;
const RR_DEPTH = +(arg('--rr-depth') ?? 20);
const RR_W = +(arg('--rr-w') ?? 1); // weight of the reranker rank in rank fusion with hybrid
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

function runs(q, id) {
  const out = { bm25: dedupe(e.search({ query: q, limit: DEPTH + 5 }).results.map((r) => r.id)).slice(0, DEPTH) };
  if (store) {
    const qv = c.queries[q];
    if (!qv) throw new Error(`No query vector for: ${q}`);
    const sem = nearest(store, dequantize(qv), { topK: 30 }).map((x) => (typeof x === 'string' ? x : x.id));
    out.semantic = dedupe(sem).slice(0, DEPTH);
    out.hybrid = dedupe(e.search({ query: q, limit: DEPTH + 5, semantic: sem, fusion: FUSION }).results.map((r) => r.id)).slice(0, DEPTH);
    if (exp) {
      const qvec = dequantize(qv);
      // Semantic with Q&A titles: a Q&A unit scores the better of its body and title vector.
      const sims = [];
      for (const [uid, v] of store) {
        const t = titleStore.get(base(uid));
        sims.push([uid, Math.max(dot(qvec, v), t ? dot(qvec, t) : -1)]);
      }
      const semT = sims.sort((a, b) => b[1] - a[1]).slice(0, 30).map(([u]) => u);
      out['sem+title'] = dedupe(semT).slice(0, DEPTH);
      out['hyb+title'] = dedupe(e.search({ query: q, limit: DEPTH + 5, semantic: semT, fusion: FUSION }).results.map((r) => r.id)).slice(0, DEPTH);
      // Reranking the hybrid top RR_DEPTH with the cross-encoder.
      const sc = RR[id] || {};
      const pool = dedupe(e.search({ query: q, limit: RR_DEPTH + 10, semantic: sem, fusion: FUSION }).results.map((r) => r.id)).slice(0, RR_DEPTH);
      const scored = pool.map((u, r) => ({ u, r, s: sc[u] ?? -1 }));
      out.rerank = [...scored].sort((a, b) => b.s - a.s || a.r - b.r).map((x) => x.u).slice(0, DEPTH);
      const rrRank = new Map([...scored].sort((a, b) => b.s - a.s || a.r - b.r).map((x, i) => [x.u, i]));
      out['hyb⊕rr'] = [...scored]
        .map((x) => ({ u: x.u, f: 1 / (60 + x.r + 1) + RR_W / (60 + rrRank.get(x.u) + 1) }))
        .sort((a, b) => b.f - a.f).map((x) => x.u).slice(0, DEPTH);
      out.missingRR = pool.filter((u) => !(u in sc)).length;
    }
  }
  return out;
}

// Fixed dev/test split, stratified by question type: within each type, questions are
// ordered by a hash of their id and the first 60% go to dev. Tune on dev only; report
// test once a change is final.
import { createHash } from 'node:crypto';
const split = arg('--split');
const SPLIT = new Map();
{
  const byType = {};
  for (const [id, , , type] of CANDIDATES) (byType[type] ??= []).push(id);
  const h = (s) => createHash('sha256').update(`remit-split-2026|${s}`).digest('hex');
  for (const ids of Object.values(byType)) {
    ids.sort((a, b) => (h(a) < h(b) ? -1 : 1));
    const nDev = Math.round(ids.length * 0.6);
    ids.forEach((id, i) => SPLIT.set(id, i < nDev ? 'dev' : 'test'));
  }
}

const dcg = (gains) => gains.reduce((s, g, i) => s + (2 ** g - 1) / Math.log2(i + 2), 0);

const tot = {};
const perQ = [];
for (const [id, q, , type] of CANDIDATES) {
  if (onlyType && type !== onlyType) continue;
  if (split && SPLIT.get(id) !== split) continue;
  const rel = qrels[id] || {};
  const answers = Object.keys(rel).filter((u) => rel[u] === 2);
  const ideal = dcg(Object.values(rel).sort((a, b) => b - a).slice(0, 5));
  const row = { id, type, q };
  const R = runs(q, id);
  row.missingRR = R.missingRR ?? 0;
  delete R.missingRR;
  for (const [sys, list] of Object.entries(R)) {
    const g = (u) => rel[u] ?? 0;
    const top5 = list.slice(0, 5);
    const first2 = top5.findIndex((u) => g(u) === 2);
    const m = {
      ndcg5: ideal ? dcg(top5.map(g)) / ideal : 0,
      succ1: answers.length ? +(g(list[0]) === 2) : null,
      mrr5: answers.length ? (first2 === -1 ? 0 : 1 / (first2 + 1)) : null,
      r5: answers.length ? top5.filter((u) => g(u) === 2).length / answers.length : null,
      r8: answers.length ? list.slice(0, 8).filter((u) => g(u) === 2).length / answers.length : null,
      rel5: +top5.some((u) => g(u) >= 1),
      old5: TRANSITION.has(id) ? null : top5.filter((u) => u.startsWith('IR-2014/')).length / top5.length,
      unj5: top5.filter((u) => !(u in rel)).length / Math.max(1, top5.length),
      unj8: list.slice(0, 8).filter((u) => !(u in rel)).length / Math.min(8, list.length),
    };
    row[sys] = { ...m, top: top5.map((u) => `${u}${u in rel ? `=${rel[u]}` : '=?'}`) };
    const t = (tot[sys] ??= {});
    for (const [k, v] of Object.entries(m)) {
      if (v == null) continue;
      t[k] = (t[k] ?? 0) + v;
      t[`${k}#`] = (t[`${k}#`] ?? 0) + 1;
    }
  }
  row.no2 = !answers.length;
  perQ.push(row);
}

const fmt = (v, pct) => (pct ? `${(100 * v).toFixed(0)}%` : v.toFixed(3));
const cols = [['ndcg5', 'nDCG@5', 0], ['succ1', 'Succ@1', 1], ['mrr5', 'MRR@5', 0], ['r5', 'R@5', 1], ['r8', 'R@8', 1], ['rel5', 'Rel@5', 1], ['old5', 'Old@5', 1], ['unj5', 'unjudg@5', 1], ['unj8', 'unjudg@8', 1]];
console.log(`${perQ.length} questions${onlyType ? ` (${onlyType})` : ''}${split ? ` [${split}]` : ''}; ${perQ.filter((r) => r.no2).length} with no answering unit (No2)`);
if (exp) console.log(`reranker scores missing for ${perQ.reduce((a, r) => a + r.missingRR, 0)} of ${perQ.length * RR_DEPTH} pooled results`);
console.log(['system'.padEnd(10), ...cols.map(([, h]) => h.padStart(11))].join(''));
for (const [sys, t] of Object.entries(tot)) {
  console.log([sys.padEnd(10), ...cols.map(([k, , p]) => (t[`${k}#`] ? fmt(t[k] / t[`${k}#`], p) : '-').padStart(11))].join(''));
}
if (detail) {
  for (const r of perQ) {
    console.log(`\n${r.id} [${r.type}]${r.no2 ? ' (no answering unit)' : ''} ${r.q}`);
    for (const sys of Object.keys(tot)) console.log(`  ${sys.padEnd(8)} nDCG ${r[sys].ndcg5.toFixed(2)}  ${r[sys].top.join('  ')}`);
  }
}
