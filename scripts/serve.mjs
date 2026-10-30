// Local development server: node scripts/serve.mjs [port]
// Test with MCP Inspector at http://localhost:8787/mcp, or expose it through a tunnel
// (e.g. cloudflared) to add it to Claude as a custom connector.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '../src/engine.mjs';
import { handleRequest } from '../src/server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const engine = createEngine(JSON.parse(readFileSync(join(root, 'data', 'remit.json'), 'utf8')));
const port = Number(process.argv[2] || process.env.PORT || 8787);

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  });
  const response = await handleRequest(engine, request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`REMIT MCP: http://localhost:${port}/mcp`));
