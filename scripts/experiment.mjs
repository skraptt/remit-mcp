// Search experiments that need Workers AI. Runs in GitHub Actions (experiment.yml) and
// writes its results to the `experiments` branch; the analysis runs locally
// (scripts/eval-judged.mjs --exp …).
//
//   node scripts/experiment.mjs --vectors .vectors/vectors.json --out .exp
//
// For each judged question (scripts/eval-candidates.mjs):
//   rerank   cross-encoder scores for the union of the top 20 hybrid, top 10 BM25 and
//            top 10 semantic results, for each model in RERANKERS
//   titles   vectors of the ACER Q&A question titles on their own (one per Q&A unit),
//            to test matching the user's question against the Q&A's question
//
// Needs CLOUDFLARE_API_TOKEN (Workers AI: Read) and CLOUDFLARE_ACCOUNT_ID.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEngine, FUSION } from '../src/engine.mjs';
import { EMBED_MODEL, dequantize, nearest, quantize, vectorsOf } from '../src/semantic.mjs';
import { CANDIDATES } from './eval-candidates.mjs';

const RERANKERS = ['@cf/baai/bge-reranker-base'];
const CONTEXT_CHARS = 1500;
const CHUNK = 16;

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i === -1 ? null : process.argv[i + 1];
};
const outDir = arg('--out') || '.exp';
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
if (!token || !account) {
  console.error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.');
  process.exit(1);
}
const api = `https://api.cloudflare.com/client/v4/accounts/${account}`;
async function run(model, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${api}/ai/run/${model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) return JSON.parse(text);
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    throw new Error(`${model}: HTTP ${res.status} ${text.slice(0, 400)}`);
  }
}

const data = JSON.parse(readFileSync(new URL('../data/remit.json', import.meta.url), 'utf8'));
const e = createEngine(data);
const c = JSON.parse(readFileSync(arg('--vectors'), 'utf8'));
const store = new Map(Object.entries(c.units).map(([id, v]) => [id, dequantize(v)]));
const base = (id) => id.replace(/~\d+$/, '');
const dedupe = (ids) => [...new Set(ids.map(base))];

const contextOf = (uid) => {
  const p = e.getProvision({ provision: uid, related: 0 });
  return `${p.citation}${p.title ? `. ${p.title}` : ''}\n${p.text}`.slice(0, CONTEXT_CHARS);
};

const log = [];
const out = { snapshot: data.snapshot, contextChars: CONTEXT_CHARS, rerank: {}, titles: {}, titleModel: EMBED_MODEL };

// 1. Rerank candidates.
for (const model of RERANKERS) {
  const res = (out.rerank[model] = {});
  let first = true;
  try {
    for (const [id, q] of CANDIDATES) {
      const qv = c.queries[q];
      if (!qv) throw new Error(`No query vector for ${id}`);
      const sem = nearest(store, dequantize(qv), { topK: 40 }).map((x) => (typeof x === 'string' ? x : x.id));
      const hyb = dedupe(e.search({ query: q, limit: 30, semantic: sem, fusion: FUSION }).results.map((r) => r.id)).slice(0, 20);
      const bm = dedupe(e.search({ query: q, limit: 15 }).results.map((r) => r.id)).slice(0, 10);
      const ids = [...new Set([...hyb, ...bm, ...dedupe(sem).slice(0, 10)])];
      const scores = {};
      for (let i = 0; i < ids.length; i += CHUNK) {
        const part = ids.slice(i, i + CHUNK);
        const r = await run(model, { query: q, contexts: part.map((u) => ({ text: contextOf(u) })) });
        if (first) {
          log.push(`${model} raw response sample: ${JSON.stringify(r).slice(0, 300)}`);
          first = false;
        }
        const list = r?.result?.response ?? r?.response ?? [];
        for (const x of list) scores[part[x.id]] = x.score;
      }
      res[id] = scores;
    }
    log.push(`${model}: ${Object.keys(res).length} questions`);
  } catch (err) {
    log.push(`${model} FAILED: ${err.message}`);
  }
}

// 2. Embed ACER Q&A question titles on their own.
const docShort = new Map(data.docs.map((d) => [d.id, d.short]));
const qaUnits = data.units.filter((u) => u.d === 'ACER-QA' && u.b);
try {
  for (let i = 0; i < qaUnits.length; i += 24) {
    const part = qaUnits.slice(i, i + 24);
    const vecs = vectorsOf(await run(EMBED_MODEL, { text: part.map((u) => `${docShort.get(u.d)} ${u.n}\n${u.b}`) }));
    part.forEach((u, j) => (out.titles[`${u.d}/${u.n}`] = quantize(vecs[j])));
  }
  log.push(`titles: ${Object.keys(out.titles).length} Q&A units`);
} catch (err) {
  log.push(`titles FAILED: ${err.message}`);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'experiment.json'), JSON.stringify(out));
writeFileSync(join(outDir, 'experiment-log.txt'), `${log.join('\n')}\n`);
console.log(log.join('\n'));
