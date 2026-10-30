// Parses an EUR-Lex / CELLAR XHTML act into units: recitals, articles and annex tables.
// Two markup families are handled: the consolidated-text format (title-article-norm,
// stitle-article-norm) and the Official Journal format since 2023 (oj-ti-art, oj-sti-art).
// Both wrap each article in <div class="eli-subdivision" id="art_N">.

import { htmlToText } from './html.mjs';

const clean = (t) =>
  t
    .replace(/[►▼]\s*[MBAC]\d+\s*/g, '') // consolidated-text amendment markers
    .replace(/[ \t]*◄[ \t]*/g, ' ')
    .replace(/[\u00a0\u2002\u2003\u2009]/g, ' ')
    // List labels and paragraph numbers on their own line: "(a)\n\ntext", "1.\ntext"
    .replace(/^[ \t]*(\((?:[a-z]{1,4}|\d{1,3})\)|\d{1,3}[a-z]?\.|[–—-])[ \t]*\n+(?=\S)/gm, '$1 ')
    .replace(/^\(([a-z]{1,4}|[ivx]+|\d{1,3})\)\t+/gm, '($1) ')
    .replace(/\t+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/[  ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// Returns the outer HTML of the element that starts at `start` (a "<div" position).
function elementAt(html, start) {
  const re = /<(\/?)div\b[^>]*>/gi;
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, re.lastIndex);
  }
  return html.slice(start);
}

function divsById(html, prefix) {
  const out = [];
  const re = new RegExp(`<div\\b[^>]*\\bid="(${prefix}_[0-9a-z]+)"[^>]*>`, 'gi');
  let m;
  while ((m = re.exec(html))) {
    const el = elementAt(html, m.index);
    out.push({ id: m[1], html: el });
    re.lastIndex = m.index + el.length;
  }
  return out;
}

const textOf = (frag) => clean(htmlToText(`<body>${frag}</body>`));
const firstMatch = (html, cls) => {
  const m = html.match(new RegExp(`<p\\b[^>]*class="(?:${cls})"[^>]*>([\\s\\S]*?)<\\/p>`, 'i'));
  return m ? textOf(m[1]).replace(/\s+/g, ' ') : null;
};

export function parseAct(html, { doc }) {
  const units = [];
  const amended = new Set();

  // Recitals ("(1) Whereas …")
  for (const { id, html: h } of divsById(html, 'rct')) {
    const n = id.split('_')[1];
    const t = textOf(h).replace(/^\(\d+\)\s*/, '');
    units.push({ d: doc, k: 'recital', n: `Recital ${n}`, b: null, t });
  }

  // Articles
  let chapter = null;
  for (const { id, html: h } of divsById(html, 'art')) {
    const n = id.split('_')[1];
    const head = firstMatch(h, 'title-article-norm|oj-ti-art') || `Article ${n}`;
    const title = firstMatch(h, 'stitle-article-norm|oj-sti-art');
    if (/[►▼]\s*M\d/.test(h)) amended.add(n);
    // Drop the heading lines (article number, title) from the body.
    const norm = (x) => x.replace(/\s+/g, ' ').trim().toLowerCase();
    const lines = textOf(h).split('\n');
    while (lines.length && (!lines[0].trim() || [norm(head), norm(title || '\u0000')].includes(norm(lines[0])))) lines.shift();
    const body = lines.join('\n');
    units.push({ d: doc, k: 'article', n: head.replace(/^Article\s+/i, ''), b: title, y: chapter, t: body.trim(), ...(amended.has(n) ? { am: true } : {}) });
  }

  // Annexes: one unit per table (or per annex if it has no tables).
  for (const { id, html: h } of divsById(html, 'anx')) {
    const annex = firstMatch(h, 'oj-doc-ti|title-annex-1|doc-ti') || 'ANNEX';
    const parts = h.split(/(?=<p\b[^>]*class="oj-ti-tbl"[^>]*>\s*<span class="oj-italic">\s*Table)/i);
    for (const part of parts) {
      const tbl = part.match(/<span class="oj-italic">\s*(Table\s+[0-9A-Z]+)\s*<\/span>/i)?.[1];
      const titles = [...part.matchAll(/<p\b[^>]*class="oj-ti-tbl"[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => textOf(m[1]).replace(/\s+/g, ' ')).filter((x) => !/^Table\s/i.test(x));
      // Table rows: drop paragraph breaks inside cells so each row becomes one line.
      const flat = part.replace(/<table\b[\s\S]*?<\/table>/gi, (tb) => tb.replace(/<\/?p\b[^>]*>/gi, ' ').replace(/<\/td>/gi, ' | </td>'));
      const t = textOf(flat)
        .split('\n')
        .map((l) => l.replace(/\s*\|\s*$/, '').replace(/\s*\|\s*/g, ' | ').trim())
        .filter(Boolean)
        .join('\n');
      if (t.replace(/\s/g, '').length < 40) continue;
      units.push({ d: doc, k: 'annex', n: tbl ? `${annex.replace(/\s+/g, ' ')}, ${tbl}` : annex, b: titles[0] || null, t, ...(id ? {} : {}) });
    }
  }
  return { units, amended: [...amended] };
}
