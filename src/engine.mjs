// Search and retrieval over data/remit.json. No network access; runs in Cloudflare
// Workers and Node alike. Semantic results, when available, are passed in from outside
// (search({ semantic })) and fused with BM25 by reciprocal rank.

import { fold, tokenize } from './text.mjs';
import { expansions } from './lexicon.mjs';

const K1 = 1.2;
const B = 0.75;
const TITLE_WEIGHT = 6;
// Reciprocal rank fusion of BM25 and semantic results: score = w / (k + rank).
export const FUSION = { k: 60, bm25: 1, semantic: 1 };
const LAYER_LABEL = { regulation: 'Regulation (Level 1)', implementing: 'Implementing / delegated act (Level 2)', guidance: 'ACER guidance (Level 3)' };

// Ways people refer to the documents. Order matters: more specific first.
const DOC_ALIASES = [
  ['IR-2026', /\b(?:2026\s*\/\s*256|recast\s+(?:remit\s+)?(?:ir|implementing)|new\s+(?:remit\s+)?(?:ir|implementing)|ir\s*2026|2026\s*ir|implementing\s+regulation\s+2026)\b/i],
  ['IR-2014', /\b(?:1348\s*\/\s*2014|ir\s*2014|2014\s*ir|old\s+(?:remit\s+)?(?:ir|implementing)|implementing\s+regulation\s+2014)\b/i],
  ['DR-2026', /\b(?:2026\s*\/\s*255|delegated\s+regulation|dr\s*2026|rrm\s*and\s*iip\s+regulation)\b/i],
  ['REMIT-II', /\b(?:2024\s*\/\s*1106|remit\s*(?:ii|2)\b|remit\s+revision|amending\s+regulation)/i],
  ['ACER-QA', /\bq\s*(?:&|and)?\s*as?\b|questions?\s+(?:and|&)\s+answers?/i],
  ['ACER-GN-WASH', /wash\s*trad/i],
  ['ACER-GN-CAPACITY', /capacity\s+hoard/i],
  ['ACER-GN-LAYERING', /layering|spoofing/i],
  ['ACER-OL-IR-2026', /open\s+letter.*(?:implementing|\bir\b)/i],
  ['ACER-OL-DR-2026', /open\s+letter.*delegated/i],
  ['ACER-OL-ALGO', /open\s+letter.*algo/i],
  ['ACER-UMM-GUIDANCE', /\bumm\b|web\s*feed/i],
  ['ACER-TRUM-7', /\b(?:trum|transaction\s+reporting\s+user\s+manual)\s*(?:v(?:ersion)?\s*)?7(?:\.0)?\b/i],
  ['ACER-TRUM', /\btrum\b|transaction\s+(?:reporting\s+)?user\s+manual/i],
  ['ACER-MOP', /\bmop\b|manual\s+of\s+procedures/i],
  ['ACER-EXPOSURE', /exposure\s+(?:reporting\s+)?guidance|guidance\s+on\s+(?:reporting\s+)?exposure/i],
  ['ACER-MANUAL-2026', /\bmanual\b/i],
  ['ACER-WHAT-TO-REPORT-2026', /what\s+to\s+report/i],
  ['ACER-GUIDANCE', /\bacer\s+guidance\b|\bguidance\b/i],
  ['REMIT', /\b(?:remit|1227\s*\/\s*2011)\b/i],
];

export function createEngine(data) {
  const { docs, units } = data;
  const docById = new Map(docs.map((d) => [d.id, d]));
  const idOf = (u) => `${u.d}/${u.n}`;
  const byId = new Map(units.map((u, i) => [idOf(u), i]));

  // Parts of a split section ("6.2.1~1", "6.2.1~2") are grouped under their section id.
  const baseId = (u) => `${u.d}/${u.n.replace(/~\d+$/, '')}`;
  const sectionParts = new Map();
  units.forEach((u, i) => {
    const k = baseId(u);
    if (!sectionParts.has(k)) sectionParts.set(k, []);
    sectionParts.get(k).push(i);
  });

  // Reverse links: provision id → guidance units that cite it, with mention counts.
  const citedBy = new Map();
  units.forEach((u, i) => {
    for (const l of u.l || []) {
      if (!citedBy.has(l)) citedBy.set(l, []);
      citedBy.get(l).push(i);
    }
  });

  const isNav = units.map((u) => u.d === 'ACER-QA' && !/^\d+\.\d+\.\d+/.test(u.n));

  // ---- BM25 index (built at start-up; the corpus is small) ----
  const postings = new Map();
  const docLen = new Float32Array(units.length);
  units.forEach((u, i) => {
    const tf = new Map();
    for (const t of tokenize(u.t)) tf.set(t, (tf.get(t) || 0) + 1);
    // Equivalent terms (abbreviation ↔ full form) count once, so both spellings match.
    for (const t of new Set(tokenize(expansions(`${u.b || ''} ${u.t}`)))) tf.set(t, (tf.get(t) || 0) + 1);
    if (u.b) for (const t of tokenize(u.b)) tf.set(t, (tf.get(t) || 0) + TITLE_WEIGHT);
    let len = 0;
    for (const [t, n] of tf) {
      len += n;
      if (!postings.has(t)) postings.set(t, []);
      postings.get(t).push(i, n);
    }
    docLen[i] = len;
  });
  const N = units.length;
  const avgLen = docLen.reduce((a, b) => a + b, 0) / N;

  // ---- Presentation ----
  const label = (u) => {
    const d = docById.get(u.d);
    const n = u.n.replace(/~\d+$/, '');
    if (u.k === 'article') return `Article ${n} ${d.short}`;
    if (u.k === 'recital') return `${n} ${d.short}`;
    if (u.k === 'annex') return `${d.short}, ${n.replace(/^ANNEX/i, 'Annex')}`;
    if (u.d === 'ACER-QA') return `${d.short}, Q ${n}`;
    return `${d.short}, ${n === '0' ? 'introduction' : /^Annex /.test(n) ? n : `section ${n}`}${u.pr ? `, ${u.pr}` : ''}`;
  };
  const urlOf = (u) => {
    const d = docById.get(u.d);
    if (u.k === 'article' && d.celex) return `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${d.celex}#art_${u.n}`;
    if (u.k === 'recital' && d.celex) return `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${d.celex}#rct_${u.n.replace(/\D+/g, '')}`;
    if (u.pg) return `${d.url}#page=${u.pg}`;
    return d.url;
  };
  const snippet = (t, terms, n = 320) => {
    if (t.length <= n) return t;
    const f = fold(t);
    let best = 0;
    let bestScore = -1;
    for (let i = 0; i < f.length; i += 80) {
      const w = f.slice(i, i + n);
      const s = terms.reduce((a, x) => a + (w.includes(x) ? 1 : 0), 0);
      if (s > bestScore) (bestScore = s), (best = i);
    }
    const start = Math.max(0, t.lastIndexOf(' ', best) + 1);
    return `${start > 0 ? '…' : ''}${t.slice(start, start + n).trim()}${start + n < t.length ? '…' : ''}`;
  };
  const brief = (i, terms = []) => {
    const u = units[i];
    const d = docById.get(u.d);
    return {
      id: idOf(u),
      citation: label(u),
      title: u.b || null,
      document: d.short,
      layer: LAYER_LABEL[d.layer],
      snippet: snippet(u.t, terms),
      url: urlOf(u),
    };
  };

  // ---- Search ----
  function search({ query, layer, document, limit = 8, semantic = null, fusion = FUSION } = {}) {
    const q = String(query ?? '').trim();
    if (!q) return { error: 'query is empty.' };
    limit = Math.max(1, Math.min(20, Number(limit) || 8));
    const docFilter = document ? resolveDoc(document) : null;
    if (document && !docFilter) return { error: `Unknown document "${document}". Use list_documents to see the available documents.` };
    const allowed = (i) => (!layer || docById.get(units[i].d).layer === layer) && (!docFilter || units[i].d === docFilter);
    // Q&A chapter introductions ("This section contains answers on …") never answer a
    // question; they are left out of ranked results but still resolve as citations.
    const ranks = (i) => allowed(i) && !isNav[i];

    // A query that is itself a citation returns that provision first.
    const direct = resolveProvision(q);
    const terms = [...new Set(tokenize(`${q} ${expansions(q)}`, { query: true }))];
    const scores = new Map();
    const hits = new Map();
    for (const t of terms) {
      const p = postings.get(t);
      if (!p) continue;
      const df = p.length / 2;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      for (let j = 0; j < p.length; j += 2) {
        const i = p[j];
        if (!ranks(i)) continue;
        const tf = p[j + 1];
        scores.set(i, (scores.get(i) || 0) + idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * docLen[i]) / avgLen))));
        hits.set(i, (hits.get(i) || 0) + 1);
      }
    }
    let ranked = [...scores]
      .map(([i, s]) => [i, s * (0.5 + (0.5 * (hits.get(i) || 0)) / Math.max(1, terms.length))])
      .sort((a, b) => b[1] - a[1])
      .map(([i]) => i);

    const sem = (semantic || []).map((id) => byId.get(id)).filter((i) => i != null && ranks(i));
    if (sem.length) {
      const fused = new Map();
      ranked.forEach((i, r) => fused.set(i, (fused.get(i) || 0) + fusion.bm25 / (fusion.k + r + 1)));
      sem.forEach((i, r) => fused.set(i, (fused.get(i) || 0) + fusion.semantic / (fusion.k + r + 1)));
      ranked = [...fused].sort((a, b) => b[1] - a[1]).map(([i]) => i);
    }
    // One result per section: split parts collapse into the best-ranked part.
    const seen = new Set();
    const out = [];
    const head = direct?.indices?.filter(allowed) ?? [];
    for (const i of [...head, ...ranked]) {
      const k = baseId(units[i]);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(brief(i, terms));
      if (out.length >= limit) break;
    }
    return { query: q, results: out, total: seen.size + Math.max(0, ranked.length - seen.size), semantic: sem.length > 0 };
  }

  // ---- Resolving references ----
  function resolveDoc(s) {
    const t = String(s).trim();
    if (docById.has(t.toUpperCase())) return t.toUpperCase();
    for (const [id, re] of DOC_ALIASES) if (re.test(t)) return id;
    return null;
  }

  // "Article 5 REMIT", "REMIT Art. 8(1a)", "Art 6 IR 2026", "Recital 12 REMIT II",
  // "ACER Guidance 6.2.1", "Q&A 2.1.1", "IR 2026 Annex Table 1", "REMIT/5".
  function resolveProvision(s) {
    const t = String(s).trim();
    if (byId.has(t) || sectionParts.has(t)) return { id: t, indices: sectionParts.get(t) || [byId.get(t)] };
    const doc = resolveDoc(t.replace(/\b(?:article|art\.?|recital|section|annex|table|q)\b[\s\S]*$/i, '') || t) || resolveDoc(t);
    let m;
    if ((m = t.match(/\b(?:article|art\.?)\s*(\d{1,2}[a-z]?)/i))) {
      const d = doc && !/^ACER/.test(doc) ? doc : 'REMIT';
      const id = `${d}/${m[1].toLowerCase()}`;
      return byId.has(id) ? { id, indices: [byId.get(id)], paragraph: t.match(/\b\d{1,2}[a-z]?\s*\(\s*(\d{1,2}[a-z]?)\s*\)/)?.[1] ?? null } : { missing: id };
    }
    if ((m = t.match(/\brecital\s*(\d{1,3})/i))) {
      const d = doc && !/^ACER/.test(doc) ? doc : 'REMIT-II';
      const id = `${d}/Recital ${m[1]}`;
      return byId.has(id) ? { id, indices: [byId.get(id)] } : { missing: id };
    }
    if ((m = t.match(/\btable\s*(\d)/i)) && doc && !/^ACER/.test(doc)) {
      const i = units.findIndex((u) => u.d === doc && u.k === 'annex' && new RegExp(`Table\\s+${m[1]}\\b`).test(u.n));
      return i >= 0 ? { id: idOf(units[i]), indices: [i] } : { missing: `${doc} Annex Table ${m[1]}` };
    }
    // Reporting manuals: "TRUM field 30", "TRUM 4.4 field (30)", "MoP Annex VII field 4/b",
    // "MoP Annex III.I".
    if (doc && /^ACER/.test(doc)) {
      const annex = t.match(/\bannex\s+([ivxl]+(?:\.[ivxl]+)?)\b/i)?.[1]?.toUpperCase();
      const field = t.match(/\bfield\s*(?:no\.?\s*)?\(?\s*(\d{1,3}[a-z]?(?:\/[a-z])?)\s*\)?/i)?.[1];
      // The section is the number just before "field" ("4.1 field (3)"), else any section
      // number that is not a document version ("TRUM 7.0").
      const sec =
        t.match(/(\d{1,2}(?:\.\d{1,3}){1,4})\s*,?\s*(?:data\s+)?field\b/i)?.[1] ??
        t.replace(/\b(?:trum|v(?:ersion)?)\s*v?\d+(?:\.\d+)?\b/gi, ' ').match(/(?:^|\s|§)(\d{1,2}(?:\.\d{1,3}){1,4})\b/)?.[1];
      if (field) {
        const where = annex ? `Annex ${annex}` : sec;
        const want = (n) => n.replace(/~\d+$/, '').endsWith(`, field (${field})`) && (!where || n.startsWith(`${where}, field`));
        const i = units.findIndex((u) => u.d === doc && want(u.n));
        if (i >= 0) return { id: baseId(units[i]), indices: sectionParts.get(baseId(units[i])) || [i] };
        return { missing: `${doc} ${where ? `${where}, ` : ''}field (${field})` };
      }
      if (annex) {
        const id = `${doc}/Annex ${annex}`;
        if (sectionParts.has(id)) return { id, indices: sectionParts.get(id) };
        if (byId.has(id)) return { id, indices: [byId.get(id)] };
      }
    }
    if ((m = t.match(/(?:^|\s|§)(\d{1,2}(?:\.\d{1,3}){0,4})\b/)) && doc && /^ACER/.test(doc)) {
      const id = `${doc}/${m[1]}`;
      if (sectionParts.has(id)) return { id, indices: sectionParts.get(id) };
      return { missing: id };
    }
    return null;
  }

  // ---- Provision with its interpretation ----
  function getProvision({ provision, related = 6 } = {}) {
    const r = resolveProvision(provision ?? '');
    if (!r) return { error: `Could not recognise "${provision}". Examples: "Article 5 REMIT", "Article 6 IR 2026", "Recital 12 REMIT II", "ACER Guidance 6.2.1", "Q&A 2.1.1".` };
    if (r.missing) return { error: `${r.missing} was not found. Use search_remit to find the right provision.` };
    const first = units[r.indices[0]];
    const d = docById.get(first.d);
    const text = r.indices.map((i) => units[i].t).join('\n');
    const notes = r.indices.flatMap((i) => units[i].fn || []);
    const out = {
      id: baseId(first),
      citation: label({ ...first, pr: null }),
      title: first.b || null,
      document: d.title,
      layer: LAYER_LABEL[d.layer],
      text,
      ...(notes.length ? { footnotes: notes } : {}),
      ...(r.paragraph ? { paragraphRequested: r.paragraph } : {}),
      url: urlOf(first),
      source: { url: d.url, fetchedAt: d.fetchedAt, checkedAt: data.checked ?? data.snapshot },
    };

    if (first.k === 'article') {
      // ACER guidance and Q&As that refer to this article, most specific first: units whose
      // title names the article, then by how few other provisions they cite.
      const key = baseId(first);
      const cands = (citedBy.get(key) || []).filter((i) => units[i].k === 'section');
      const num = first.n;
      const score = (i) => {
        const u = units[i];
        const inTitle = new RegExp(`Article\\s+${num}\\b`, 'i').test(u.b || '') ? 4 : 0;
        const mentions = (u.t.match(new RegExp(`Article\\s+${num}\\b`, 'gi')) || []).length;
        return inTitle + Math.min(mentions, 6) * 0.5 - (u.l?.length || 0) * 0.08;
      };
      const ranked = [...new Set(cands)].sort((a, b) => score(b) - score(a));
      const seen = new Set();
      const pick = (pred) => {
        const res = [];
        for (const i of ranked) {
          const k = baseId(units[i]);
          if (!pred(units[i]) || seen.has(k)) continue;
          seen.add(k);
          res.push(brief(i));
          if (res.length >= related) break;
        }
        return res;
      };
      out.acerGuidance = pick((u) => u.d !== 'ACER-QA');
      out.acerQAs = pick((u) => u.d === 'ACER-QA');
      out.relatedCount = new Set(ranked.map((i) => baseId(units[i]))).size;
    } else if (first.l?.length) {
      out.citesProvisions = [...new Set(r.indices.flatMap((i) => units[i].l || []))].filter((id) => byId.has(id)).map((id) => ({ id, citation: label(units[byId.get(id)]), title: units[byId.get(id)].b }));
    }
    return out;
  }

  function listDocuments() {
    return {
      snapshot: data.snapshot,
      checked: data.checked ?? data.snapshot,
      documents: docs.map((d) => ({
        id: d.id,
        title: d.title,
        short: d.short,
        layer: LAYER_LABEL[d.layer],
        units: units.filter((u) => u.d === d.id).length,
        url: d.url,
        fetchedAt: d.fetchedAt,
      })),
    };
  }

  return { search, getProvision, listDocuments, resolveProvision, resolveDoc, units, docs };
}
