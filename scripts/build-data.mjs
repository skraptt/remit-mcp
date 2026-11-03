// Builds data/remit.json from the fetched sources (.sources/ or --src DIR).
//
//   node scripts/build-data.mjs [--src .sources]
//
// EUR-Lex acts are parsed from XHTML; ACER PDFs from the line files produced by
// scripts/pdf_lines.py (generated here when missing and Python + pdfplumber are available).
// Every guidance unit is scanned for article references, which link it to the provisions
// it interprets.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { EURLEX, ACER } from './sources.mjs';
import { parseAct } from './lib/eurlex.mjs';
import { parsePdfLines } from './lib/pdfdoc.mjs';
import { findCitations } from './lib/citations.mjs';

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i === -1 ? null : process.argv[i + 1];
};
const src = arg('--src') || '.sources';
const MAX_UNIT = 4000; // characters; longer guidance sections are split at paragraph numbers

const manifest = JSON.parse(readFileSync(join(src, 'manifest.json'), 'utf8'));
const registry = new Map([...EURLEX, ...ACER].map((e) => [e.id, e]));

function pdfLines(id) {
  const out = join(src, 'lines', `${id}.jsonl`);
  if (!existsSync(out)) {
    mkdirSync(join(src, 'lines'), { recursive: true });
    const text = execFileSync('python3', [new URL('./pdf_lines.py', import.meta.url).pathname, join(src, manifest[id].file)], { maxBuffer: 1 << 28 });
    writeFileSync(out, text);
  }
  return readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

// Splits a long section at "(n)" paragraph starts into parts of at most MAX_UNIT characters.
function splitSection(text) {
  if (text.length <= MAX_UNIT) return [text];
  const paras = text.split(/\n(?=\(\d{1,4}\)\s)/);
  const parts = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length > MAX_UNIT) {
      parts.push(cur);
      cur = p;
    } else cur = cur ? `${cur}\n${p}` : p;
  }
  if (cur) parts.push(cur);
  return parts;
}

const paraRange = (t) => {
  const nums = [...t.matchAll(/^\((\d{1,4})\)\s/gm)].map((m) => +m[1]);
  return nums.length ? (nums.length === 1 ? `para. (${nums[0]})` : `paras. (${nums[0]})–(${nums[nums.length - 1]})`) : null;
};

const docs = [];
const units = [];
for (const [id, m] of Object.entries(manifest)) {
  const reg = registry.get(id);
  if (!reg) continue;
  const doc = { id, title: reg.title, short: reg.short, layer: reg.layer, url: m.sourceUrl || m.url, fetchedAt: m.fetchedAt, sha256: m.sha256 };
  if (m.celex) doc.celex = m.celex;
  docs.push(doc);

  if (m.file.endsWith('.html')) {
    const { units: u } = parseAct(readFileSync(join(src, m.file), 'utf8'), { doc: id });
    for (const x of u) units.push(x);
    continue;
  }

  const defaultIR = /2026/.test(id) ? 'IR-2026' : 'IR-2014';
  const sections = parsePdfLines(pdfLines(id), { doc: id });
  const seen = new Map();
  for (const s of sections) {
    // Front matter of the long documents is a cover page and a list of related documents.
    if (s.num === '0' && !reg.keepFrontMatter && sections.length > 12) continue;
    if (!s.text) continue;
    // Lists of abbreviations only add noise to search.
    if (/^(?:annex\s*\d*\s*:?\s*)?(?:list of )?abbreviations$/i.test(s.title.trim())) continue;
    // Withdrawn Q&As ("2.3.5. [removed on 12 March 2025]") are stubs.
    if (/^\[(?:removed|merged|deleted)\b/i.test(s.title) && s.text.length < 400) continue;
    let num = s.num;
    if (seen.has(num)) num = `${num}${'′'.repeat(seen.get(num))}`; // duplicate numbering (summary tables)
    seen.set(s.num, (seen.get(s.num) || 0) + 1);
    const parts = splitSection(s.text);
    parts.forEach((t, i) => {
      const cites = findCitations(`${s.title}\n${t}\n${s.notes.join('\n')}`, { defaultIR });
      units.push({
        d: id,
        k: 'section',
        n: parts.length > 1 ? `${num}~${i + 1}` : num,
        b: s.title,
        t,
        pg: s.page,
        ...(paraRange(t) ? { pr: paraRange(t) } : {}),
        ...(s.notes.length && i === parts.length - 1 ? { fn: s.notes } : {}),
        ...(cites.length ? { l: cites.map((c) => c.id) } : {}),
      });
    });
  }
}

// Recitals and articles of the acts can cite each other too (e.g. REMIT II → REMIT).
for (const u of units) {
  if (u.l || u.k === 'section') continue;
  const cites = findCitations(u.t, { defaultIR: 'IR-2026' }).filter((c) => !c.id.startsWith(`${u.d}/`));
  if (cites.length) u.l = cites.map((c) => c.id);
}

// snapshot: when a source last changed. checked: when the sources were last checked for
// changes (the fetch run before this build; falls back to the snapshot).
const snapshot = docs.map((d) => d.fetchedAt).sort().pop();
const checkedFile = join(src, 'checked.txt');
const checked = existsSync(checkedFile) ? readFileSync(checkedFile, 'utf8').trim() : snapshot;
mkdirSync('data', { recursive: true });
writeFileSync('data/remit.json', JSON.stringify({ snapshot, checked, docs, units }));
const byDoc = {};
for (const u of units) byDoc[u.d] = (byDoc[u.d] || 0) + 1;
const linked = units.filter((u) => u.k === 'section' && u.l).length;
console.log(Object.entries(byDoc).map(([d, n]) => `  ${d.padEnd(26)} ${n}`).join('\n'));
console.log(`✓ ${docs.length} documents, ${units.length} units (${linked} guidance units linked to provisions) → data/remit.json`);
