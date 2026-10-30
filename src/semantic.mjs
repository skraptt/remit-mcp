// Semantic search: finds units close in meaning to the query, for questions phrased
// differently from the legal text ("can I trade before publishing an outage").
//
// Unit vectors are computed at build time and uploaded to Cloudflare Vectorize
// (scripts/embed.mjs). At request time only the query is embedded with Workers AI and the
// nearest units are looked up in Vectorize. If this fails for any reason, search continues
// with BM25 only.

export const EMBED_MODEL = '@cf/qwen/qwen3-embedding-0.6b';
// The model returns 1024 dimensions and is Matryoshka-trained: the first 512, renormalised,
// keep nearly all quality and fit the Vectorize free tier.
export const DIMS = 512;
export const INDEX_NAME = 'remit';
export const QUERY_INSTRUCTION =
  'Instruct: Given a question about EU wholesale energy market regulation (REMIT), retrieve the legal provision or ACER guidance passage that answers it\nQuery: ';
const DOC_CHARS = 2000;
const TIMEOUT_MS = 5000;

// Text embedded for a unit: document, citation, title and the start of the body.
export function docText(unit, doc) {
  const head = `${doc.short} ${unit.k === 'article' ? `Article ${unit.n}` : unit.n.replace(/~\d+$/, '')}`;
  return `${head}\n${unit.b || ''}\n${unit.t}`.slice(0, DOC_CHARS);
}

export const queryText = (q) => QUERY_INSTRUCTION + String(q).trim();

export function vectorsOf(res) {
  const data = res?.data ?? res?.result?.data ?? res?.result?.response ?? res?.response;
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('No vectors in the Workers AI response');
  return data.map(truncate);
}

export function truncate(v) {
  const out = new Float32Array(DIMS);
  let n = 0;
  for (let i = 0; i < DIMS; i++) {
    out[i] = v[i];
    n += v[i] * v[i];
  }
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIMS; i++) out[i] /= n;
  return out;
}

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('semantic search timed out')), ms))]);

// Returns a search function when the Worker has the AI and VEC bindings, otherwise null.
// The function resolves to { ids } (nearest first) or { error }; it never throws, and the
// error message never contains the query.
export function createSemantic(env, { topK = 30 } = {}) {
  if (!env?.AI || !env?.VEC) return null;
  return async function semanticSearch(query, documentId) {
    try {
      const run = async () => {
        const [vec] = vectorsOf(await env.AI.run(EMBED_MODEL, { text: [queryText(query)] }));
        const opts = { topK, returnValues: false, returnMetadata: 'none' };
        if (documentId) opts.filter = { d: documentId };
        const r = await env.VEC.query([...vec], opts);
        return { ids: (r?.matches || []).map((m) => m.id) };
      };
      return await withTimeout(run(), TIMEOUT_MS);
    } catch (err) {
      return { error: String(err?.message || err).slice(0, 200) };
    }
  };
}

// ---- Local vector store (evaluation and the vector cache) ----
// Vectors are quantised to int8 (512 bytes + scale); enough for cosine similarity.
export function quantize(v) {
  let max = 0;
  for (const x of v) max = Math.max(max, Math.abs(x));
  const scale = max / 127 || 1;
  const q = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) q[i] = Math.round(v[i] / scale);
  return { q: Buffer.from(q.buffer).toString('base64'), s: scale };
}

export function dequantize({ q, s }) {
  const b = Buffer.from(q, 'base64');
  const i8 = new Int8Array(b.buffer, b.byteOffset, b.length);
  const v = new Float32Array(i8.length);
  let n = 0;
  for (let i = 0; i < i8.length; i++) {
    v[i] = i8[i] * s;
    n += v[i] * v[i];
  }
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

// Brute-force nearest neighbours: the local equivalent of Vectorize's cosine ranking.
export function nearest(store, vec, { topK = 30, documentId = null } = {}) {
  const scored = [];
  for (const [id, v] of store) {
    if (documentId && !id.startsWith(`${documentId}/`)) continue;
    let s = 0;
    for (let i = 0; i < vec.length; i++) s += vec[i] * v[i];
    scored.push([id, s]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, topK).map(([id]) => id);
}
