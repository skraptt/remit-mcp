// Computes unit vectors and uploads them to Cloudflare Vectorize. Runs in GitHub Actions
// before deployment (deploy.yml).
//
//   node scripts/embed.mjs --cache .vectors [--queries] [--upload]
//
// The cache (.vectors/vectors.json) keeps a hash of each unit's text and its int8-quantised
// vector; only new or changed units are embedded. The cache lives on the `vectors` branch.
//   --queries  also embed the evaluation questions (npm run eval -- --vectors …)
//   --upload   upload changed vectors to Vectorize and delete units no longer in the data
//
// Needs CLOUDFLARE_API_TOKEN (Workers AI: Read, Vectorize: Edit) and CLOUDFLARE_ACCOUNT_ID.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIMS, EMBED_MODEL, INDEX_NAME, docText, queryText, quantize, dequantize, vectorsOf } from '../src/semantic.mjs';

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i === -1 ? null : process.argv[i + 1];
};
const cacheDir = arg('--cache') || '.vectors';
const withQueries = process.argv.includes('--queries');
const upload = process.argv.includes('--upload');
const BATCH = 24;

const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
if (!token || !account) {
  console.error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.');
  process.exit(1);
}
const api = `https://api.cloudflare.com/client/v4/accounts/${account}`;

async function cf(path, body, { ndjson = false } = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${api}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': ndjson ? 'application/x-ndjson' : 'application/json' },
      body: ndjson ? body : JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) return JSON.parse(text);
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    throw new Error(`${path}: HTTP ${res.status} ${text.slice(0, 500)}`);
  }
}

const embed = async (texts) => vectorsOf(await cf(`/ai/run/${EMBED_MODEL}`, { text: texts }));
const sha = (s) => createHash('sha256').update(s).digest('base64url').slice(0, 16);

const data = JSON.parse(readFileSync(new URL('../data/remit.json', import.meta.url), 'utf8'));
const docMeta = new Map(data.docs.map((d) => [d.id, d]));
const docs = data.units.map((u) => {
  const text = docText(u, docMeta.get(u.d));
  return { id: `${u.d}/${u.n}`, text, h: sha(`${EMBED_MODEL}|${DIMS}|${text}`), d: u.d };
});

mkdirSync(cacheDir, { recursive: true });
const file = join(cacheDir, 'vectors.json');
const cache = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
if (cache.model !== EMBED_MODEL || cache.dims !== DIMS) {
  if (cache.model) console.log(`Model or dimensions changed (${cache.model}/${cache.dims}); recomputing all vectors.`);
  Object.assign(cache, { model: EMBED_MODEL, dims: DIMS, units: {}, queries: {}, uploaded: {} });
}
cache.units ??= {};
cache.queries ??= {};
cache.uploaded ??= {};
const save = () => writeFileSync(file, JSON.stringify(cache));

// 1. Unit vectors
const todo = docs.filter((d) => cache.units[d.id]?.h !== d.h);
console.log(`${docs.length} units; ${todo.length} to embed.`);
for (let i = 0; i < todo.length; i += BATCH) {
  const part = todo.slice(i, i + BATCH);
  const vecs = await embed(part.map((d) => d.text));
  part.forEach((d, j) => (cache.units[d.id] = { h: d.h, ...quantize(vecs[j]) }));
  if ((i / BATCH) % 20 === 19) save(); // keep progress on a long first run
  process.stdout.write(`\r  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
}
if (todo.length) process.stdout.write('\n');
const live = new Set(docs.map((d) => d.id));
const removed = Object.keys(cache.units).filter((id) => !live.has(id));
for (const id of removed) delete cache.units[id];
save();

// 2. Evaluation questions
if (withQueries) {
  const { CASES, HOLDOUT = [] } = await import('./eval-cases.mjs');
  const qs = [...new Set([...CASES, ...HOLDOUT].map(([q]) => q))].filter((q) => !cache.queries[q]);
  console.log(`${qs.length} evaluation questions to embed.`);
  for (let i = 0; i < qs.length; i += BATCH) {
    const part = qs.slice(i, i + BATCH);
    const vecs = await embed(part.map(queryText));
    part.forEach((q, j) => (cache.queries[q] = quantize(vecs[j])));
  }
  save();
}

// 3. Upload to Vectorize
if (upload) {
  const changed = docs.filter((d) => cache.uploaded[d.id] !== d.h);
  const gone = Object.keys(cache.uploaded).filter((id) => !live.has(id));
  console.log(`Vectorize (${INDEX_NAME}): ${changed.length} to upload, ${gone.length} to delete.`);
  for (let i = 0; i < changed.length; i += 1000) {
    const part = changed.slice(i, i + 1000);
    const body = part.map((d) => JSON.stringify({ id: d.id, values: [...dequantize(cache.units[d.id])], metadata: { d: d.d } })).join('\n');
    await cf(`/vectorize/v2/indexes/${INDEX_NAME}/upsert`, body, { ndjson: true });
    for (const d of part) cache.uploaded[d.id] = d.h;
    save();
    console.log(`  ${Math.min(i + 1000, changed.length)}/${changed.length}`);
  }
  for (let i = 0; i < gone.length; i += 1000) {
    const ids = gone.slice(i, i + 1000);
    await cf(`/vectorize/v2/indexes/${INDEX_NAME}/delete_by_ids`, { ids });
    for (const id of ids) delete cache.uploaded[id];
    save();
  }
}
console.log('✓ vectors up to date');
