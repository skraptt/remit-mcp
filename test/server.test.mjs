import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine.mjs';
import { handleRequest } from '../src/server.mjs';

const engine = createEngine(JSON.parse(readFileSync(new URL('../data/remit.json', import.meta.url), 'utf8')));
const rpc = (body, ctx) =>
  handleRequest(
    engine,
    new Request('https://example.dev/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }),
    ctx,
  ).then((r) => r.json());

test('initialize and tools/list', async () => {
  const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.serverInfo.name, 'remit');
  const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), ['search_remit', 'get_provision', 'reporting_timeline', 'list_documents']);
  for (const t of list.result.tools) assert.equal(t.annotations.readOnlyHint, true);
});

test('tools return text and structured content', async () => {
  const call = (name, args) => rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: args } }).then((r) => r.result);
  const s = await call('search_remit', { query: 'wash trades', limit: 2 });
  assert.match(s.content[0].text, /<source_text>/);
  assert.equal(s.structuredContent.results.length, 2);
  const p = await call('get_provision', { provision: 'Article 3 REMIT' });
  assert.match(p.content[0].text, /Prohibition of insider trading/);
  const t = await call('reporting_timeline', { date: '2027-06-01' });
  assert.equal(t.structuredContent.next.date, '2027-10-29');
  assert.ok(t.structuredContent.steps.find((x) => x.date === '2027-01-01').status === 'applies');
  const bad = await call('get_provision', { provision: 'nonsense' });
  assert.equal(bad.isError, true);
});

test('semantic results are fused and client-supplied ones ignored', async () => {
  const seen = [];
  const r = await rpc(
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'search_remit', arguments: { query: 'can I trade before publishing an outage', limit: 5, semantic: ['REMIT/22'] } } },
    { semantic: async (q, d) => (seen.push([q, d]), { ids: ['REMIT/3', 'REMIT/4'] }) },
  );
  const ids = r.result.structuredContent.results.map((x) => x.id);
  assert.ok(ids.includes('REMIT/3') && ids.includes('REMIT/4'));
  assert.ok(!ids.includes('REMIT/22'));
  assert.deepEqual(seen, [['can I trade before publishing an outage', null]]);
});

test('HTTP basics', async () => {
  const get = await handleRequest(engine, new Request('https://example.dev/mcp'));
  assert.equal(get.status, 405);
  const info = await handleRequest(engine, new Request('https://example.dev/')).then((r) => r.json());
  assert.equal(info.documents, 16);
});
