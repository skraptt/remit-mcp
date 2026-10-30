import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine.mjs';
import { findCitations } from '../scripts/lib/citations.mjs';
import { TIMELINE } from '../src/timeline.mjs';

const data = JSON.parse(readFileSync(new URL('../data/remit.json', import.meta.url), 'utf8'));
const e = createEngine(data);
const ids = new Set(data.units.map((u) => `${u.d}/${u.n}`));

test('all 16 source documents are present and parsed', () => {
  assert.equal(data.docs.length, 16);
  const count = (d, k) => data.units.filter((u) => u.d === d && (!k || u.k === k)).length;
  assert.ok(count('REMIT', 'article') >= 40, 'REMIT articles incl. 7a–7e');
  assert.equal(count('IR-2026', 'article'), 17);
  assert.equal(count('DR-2026', 'article'), 40);
  assert.equal(count('IR-2026', 'annex'), 5);
  assert.ok(count('ACER-QA') > 150);
  assert.ok(count('ACER-GUIDANCE') > 100);
});

test('articles keep their number, title and body', () => {
  const a = data.units.find((u) => u.d === 'REMIT' && u.n === '5');
  assert.equal(a.b, 'Prohibition of market manipulation');
  assert.match(a.t, /^Any engagement in, or attempt to engage in, market manipulation/);
  const ir10 = data.units.find((u) => u.d === 'IR-2026' && u.n === '10');
  assert.match(ir10.t, /no later than two working days/);
});

test('guidance sections follow ACER numbering', () => {
  const s = data.units.filter((u) => u.d === 'ACER-GUIDANCE');
  assert.ok(s.some((u) => u.n.startsWith('6.2.1') && /false or misleading signals/i.test(u.b)));
  assert.ok(s.some((u) => u.n.replace(/~\d+$/, '') === '9.3.3' && /When to notify/i.test(u.b)));
  const q = data.units.find((u) => u.d === 'ACER-QA' && u.n === '2.1.1');
  assert.equal(q.b, 'What is REMIT?');
  assert.ok(!data.units.some((u) => u.d === 'ACER-QA' && /^\[(removed|merged)/i.test(u.b || '')), 'withdrawn Q&As are dropped');
});

test('every link points to an existing provision', () => {
  for (const u of data.units) for (const l of u.l || []) assert.ok(ids.has(l), `${u.d}/${u.n} → ${l}`);
});

test('citation finder', () => {
  const f = (t, o) => findCitations(t, o).map((x) => x.id);
  assert.deepEqual(f('Articles 13 to 15 of REMIT'), ['REMIT/13', 'REMIT/14', 'REMIT/15']);
  assert.deepEqual(f('Article 2(1) and (4) of REMIT'), ['REMIT/2']);
  assert.deepEqual(f('Article 6 of the recast REMIT IR'), ['IR-2026/6']);
  assert.deepEqual(f('Article 5(1)(a) of Commission Implementing Regulation (EU) No 1348/2014'), ['IR-2014/5']);
  assert.deepEqual(f('Article 12 of the Delegated Regulation on RRMs'), ['DR-2026/12']);
  assert.deepEqual(f('Article 2(3) of MAR'), []);
});

test('provision references resolve', () => {
  const r = (s) => e.getProvision({ provision: s });
  assert.equal(r('Article 5 REMIT').id, 'REMIT/5');
  assert.equal(r('Art. 8(1a) REMIT').id, 'REMIT/8');
  assert.equal(r('Article 10 IR 2026').id, 'IR-2026/10');
  assert.equal(r('Article 10 of Implementing Regulation 1348/2014').id, 'IR-2014/10');
  assert.equal(r('Article 12 Delegated Regulation').id, 'DR-2026/12');
  assert.equal(r('Recital 12 REMIT II').id, 'REMIT-II/Recital 12');
  assert.equal(r('IR 2026 Annex Table 1').id, 'IR-2026/ANNEX, Table 1');
  assert.equal(r('ACER Guidance 6.2.1').id, 'ACER-GUIDANCE/6.2.1');
  assert.equal(r('Q&A 2.1.1').id, 'ACER-QA/2.1.1');
  assert.ok(r('Article 99 REMIT').error);
});

test('an article comes with the ACER material that refers to it', () => {
  const p = e.getProvision({ provision: 'Article 4 REMIT' });
  assert.ok(p.acerGuidance.length > 0 && p.acerQAs.length > 0);
  assert.ok(p.acerGuidance.every((g) => g.layer.startsWith('ACER')));
  assert.ok(p.acerGuidance.some((g) => /^ACER Guidance 6\.1, section 4\./.test(g.citation)));
  // A split section is returned whole.
  const s = e.getProvision({ provision: 'ACER Guidance 6.2.1' });
  assert.ok(s.text.length > 10000);
  assert.ok(s.citesProvisions.some((c) => c.id === 'REMIT/5'));
});

test('search finds the specific guidance', () => {
  const top = (q, n = 3) => e.search({ query: q, limit: n }).results.map((r) => r.id.replace(/~\d+$/, ''));
  assert.ok(top('wash trades').some((id) => id.startsWith('ACER-GN-WASH/')));
  assert.ok(top('exposure reporting threshold').includes('IR-2026/6') || top('exposure reporting threshold').some((id) => id.startsWith('ACER-OL-IR-2026/')));
  assert.ok(top('layering and spoofing').some((id) => id.startsWith('ACER-GN-LAYERING/')));
  assert.equal(top('Article 5 REMIT', 1)[0], 'REMIT/5');
  assert.ok(e.search({ query: 'inside information', layer: 'regulation' }).results.every((r) => r.layer.startsWith('Regulation')));
  assert.ok(e.search({ query: 'reporting', document: 'Q&A' }).results.every((r) => r.id.startsWith('ACER-QA/')));
});

test('timeline entries cite existing provisions and are ordered', () => {
  const dates = TIMELINE.map((t) => t.date);
  assert.deepEqual(dates, [...dates].sort());
  for (const t of TIMELINE) for (const id of [t.source, ...t.applies, ...(t.alsoSee || [])]) assert.ok(ids.has(id), id);
});
