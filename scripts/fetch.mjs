// Downloads every source document listed in scripts/sources.mjs into sources/raw/ and
// writes sources/manifest.json. Runs in GitHub Actions (the development sandbox has no
// access to EUR-Lex or ACER).
//
//   node scripts/fetch.mjs [--out sources] [--only ID,ID]
//
// EUR-Lex: the Publications Office CELLAR endpoint is tried first (content negotiation,
// stable for automated clients), then the EUR-Lex HTML page.
// ACER: PDFs are discovered from the ACER index pages; registry URLs take precedence.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EURLEX, ACER, ACER_INDEX_PAGES } from './sources.mjs';

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i === -1 ? null : process.argv[i + 1];
};
const out = arg('--out') || 'sources';
const only = arg('--only')?.split(',');
const UA = 'remit-mcp source fetcher (+https://github.com/skraptt/remit-mcp)';

mkdirSync(join(out, 'raw'), { recursive: true });
const manifestPath = join(out, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const log = [];
const sha = (b) => createHash('sha256').update(b).digest('hex');

async function get(url, headers = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow' });
      const buf = Buffer.from(await res.arrayBuffer());
      return { ok: res.ok, status: res.status, type: res.headers.get('content-type') || '', buf, url: res.url };
    } catch (err) {
      if (attempt === 3) return { ok: false, status: 0, type: '', buf: Buffer.alloc(0), url, error: String(err) };
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

const looksLikeAct = (buf) => {
  const s = buf.toString('utf8', 0, Math.min(buf.length, 400000));
  return /Article\s+1\b/.test(s) && !/captcha|Request Rejected|challenge-platform/i.test(s.slice(0, 5000));
};

function save(entry, res, ext) {
  const file = `raw/${entry.id}.${ext}`;
  writeFileSync(join(out, file), res.buf);
  manifest[entry.id] = {
    id: entry.id,
    title: entry.title,
    short: entry.short,
    layer: entry.layer,
    file,
    url: res.url,
    sourceUrl: entry.sourceUrl ?? res.url,
    contentType: res.type,
    bytes: res.buf.length,
    sha256: sha(res.buf),
    fetchedAt: new Date().toISOString(),
    ...(entry.celex ? { celex: entry.resolvedCelex ?? entry.celex } : {}),
  };
  log.push(`✓ ${entry.id.padEnd(26)} ${String(res.buf.length).padStart(9)} B  ${res.url}`);
}

// ---- EUR-Lex ----
async function latestConsolidated(base) {
  // 1. Publications Office SPARQL endpoint: all CELEX numbers of consolidated versions.
  const q = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?c WHERE { ?w cdm:resource_legal_id_celex ?c . FILTER(STRSTARTS(STR(?c), "${base}-")) }`;
  const found = new Set();
  const sparql = await get(`https://publications.europa.eu/webapi/rdf/sparql?query=${encodeURIComponent(q)}&format=application%2Fsparql-results%2Bjson`, { Accept: 'application/sparql-results+json' });
  if (sparql.ok) {
    try {
      for (const b of JSON.parse(sparql.buf.toString('utf8')).results.bindings) {
        const m = b.c.value.match(/-(\d{8})$/);
        if (m) found.add(m[1]);
      }
    } catch {}
  }
  log.push(`· ${base}: SPARQL → HTTP ${sparql.status}, ${found.size} consolidated versions`);
  // 2. EUR-Lex "ALL" page as a fallback.
  if (!found.size) {
    const page = await get(`https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX:3${base.slice(1)}`);
    if (page.ok) for (const m of page.buf.toString('utf8').matchAll(new RegExp(`${base}-(\\d{8})`, 'g'))) found.add(m[1]);
  }
  const dates = [...found].sort();
  return dates.length ? `${base}-${dates[dates.length - 1]}` : `${base}-20240507`;
}

async function fetchEurLex(entry) {
  const celex = entry.consolidated ? await latestConsolidated(entry.celex) : entry.celex;
  entry.resolvedCelex = celex;
  entry.sourceUrl = `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celex}`;
  const tries = [
    [`https://publications.europa.eu/resource/celex/${celex}`, { Accept: 'application/xhtml+xml, text/html;q=0.9', 'Accept-Language': 'eng' }],
    [`https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:${celex}`, { Accept: 'text/html' }],
  ];
  for (const [url, headers] of tries) {
    const res = await get(url, headers);
    if (res.ok && looksLikeAct(res.buf)) {
      const head = res.buf.toString('utf8', 0, 20000);
      if (entry.verifyTitle && !entry.verifyTitle.test(head)) {
        log.push(`! ${entry.id}: ${url} does not look like the expected act (title check failed)`);
        continue;
      }
      return save(entry, res, 'html');
    }
    log.push(`· ${entry.id}: ${url} → HTTP ${res.status} ${res.type} ${res.buf.length} B ${res.error ?? ''}`);
  }
  log.push(`✗ ${entry.id}: not fetched`);
}

// ---- ACER ----
async function discoverAcerPdfs() {
  const links = new Set();
  for (const page of ACER_INDEX_PAGES) {
    const res = await get(page, { Accept: 'text/html' });
    if (!res.ok) {
      log.push(`· index ${page} → HTTP ${res.status}`);
      continue;
    }
    for (const m of res.buf.toString('utf8').matchAll(/href="([^"]+\.pdf)"/gi)) links.add(new URL(m[1].replace(/&amp;/g, '&'), page).href);
  }
  writeFileSync(join(out, 'acer-pdf-links.txt'), [...links].sort().join('\n') + '\n');
  return [...links];
}

async function fetchAcer(entry, links) {
  const candidates = [];
  if (entry.match) candidates.push(...links.filter((l) => entry.match.test(decodeURIComponent(l.split('/').pop()))));
  if (entry.url) candidates.push(entry.url);
  for (const url of [...new Set(candidates)]) {
    const res = await get(url, { Accept: 'application/pdf' });
    if (res.ok && res.buf.subarray(0, 5).toString() === '%PDF-') return save(entry, res, 'pdf');
    log.push(`· ${entry.id}: ${url} → HTTP ${res.status} ${res.type}`);
  }
  log.push(`✗ ${entry.id}: not fetched (${candidates.length} candidate URLs)`);
}

const want = (e) => !only || only.includes(e.id);
for (const e of EURLEX.filter(want)) await fetchEurLex(e);
const links = ACER.some(want) ? await discoverAcerPdfs() : [];
for (const e of ACER.filter(want)) await fetchAcer(e, links);

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(out, 'fetch-log.txt'), log.join('\n') + '\n');
console.log(log.join('\n'));
const missing = [...EURLEX, ...ACER].filter(want).filter((e) => !manifest[e.id]);
if (missing.length) console.log(`\n${missing.length} source(s) missing: ${missing.map((e) => e.id).join(', ')}`);
