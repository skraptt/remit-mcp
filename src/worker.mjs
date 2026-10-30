// Cloudflare Workers entry point. Data and index are loaded once per isolate.

import data from '../data/remit.json';
import { createEngine } from './engine.mjs';
import { handleRequest } from './server.mjs';
import { createSemantic } from './semantic.mjs';

const engine = createEngine(data);

export default {
  fetch(request, env) {
    // Without the AI and VEC bindings only BM25 search runs.
    return handleRequest(engine, request, { semantic: createSemantic(env) });
  },
};
