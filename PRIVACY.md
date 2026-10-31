# Privacy Policy

**REMIT MCP** — https://github.com/skraptt/remit-mcp · Last updated: 31 October 2026

REMIT MCP is a read-only server that returns the text of EU legislation and ACER
publications. It has no user accounts, no sign-in, no cookies and no analytics.

- **Data collected.** Only what an MCP client sends: the tool name and its arguments (for
  example a search phrase). Please do not put personal or confidential information into
  queries.
- **Use and storage.** Requests are processed in memory to produce the response. The server
  writes no logs, and Cloudflare Workers request logging is disabled (`wrangler.toml`).
  Nothing from a request is stored after the response is sent.
- **Third parties.** Requests are not sold or shared. For semantic search, the text of a
  `search_remit` query is sent to Cloudflare Workers AI (an embedding model run by
  Cloudflare) and the resulting vector is looked up in Cloudflare Vectorize; both are
  Cloudflare services on the account that hosts the server, and neither the query nor the
  vector is stored by the server. The server runs on Cloudflare Workers; Cloudflare processes connection data such as IP addresses under the
  [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/).
- **Contact.** https://github.com/skraptt/remit-mcp/issues
