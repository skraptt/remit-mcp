<img src="assets/icon.png" width="72" alt="" align="right">

# REMIT MCP

An open-source [Model Context Protocol](https://modelcontextprotocol.io) server for EU
wholesale energy market compliance. It gives AI assistants such as Claude the text of
REMIT, its implementing and delegated acts and ACER's guidance — **linked article by
article**, so that asking about a provision also brings up how ACER interprets it.

> Not legal advice. ACER guidance and Q&As are non-binding. Texts are as of the fetch date
> returned with every answer; check the linked source.

## What it covers

| Layer | Documents |
|---|---|
| Regulation | REMIT — Regulation (EU) No 1227/2011, latest consolidated version (incl. REMIT II); Regulation (EU) 2024/1106 (REMIT II) with its recitals |
| Implementing / delegated acts | Implementing Regulation (EU) 2026/256 on data reporting (with annex reporting tables); Delegated Regulation (EU) 2026/255 on RRMs and IIPs; Implementing Regulation (EU) No 1348/2014 (repealed; kept for the transition) |
| ACER guidance | Guidance on the application of REMIT (6.1st edition); guidance notes on wash trades, transmission capacity hoarding, layering and spoofing; Q&As on REMIT (30th edition); open letters on the 2026 implementing and delegated regulations and on algorithmic trading; UMM web-feed guidance; 2026 manual for new market participants; "REMIT data: what to report and how" |

Sources are fetched from EUR-Lex (Publications Office CELLAR) and acer.europa.eu every
day; a new consolidated version of REMIT or a new edition of an ACER document is picked up
automatically.

## Tools

| Tool | What it does |
|---|---|
| `search_remit` | Searches all layers; filter by layer or document. Accepts questions or citations. |
| `get_provision` | Full text of an article, recital, annex table or guidance section. For articles, also the ACER guidance sections and Q&As that refer to it, most specific first. For guidance, the provisions it cites. |
| `reporting_timeline` | Application dates of REMIT II, Implementing Regulation 2026/256 and Delegated Regulation 2026/255, 2024–2028, each with the provision it comes from. Given a date, which steps apply and what is next. |
| `list_documents` | Documents, fetch dates and links. |

Citations it understands: `Article 5 REMIT`, `Art. 8(1a) REMIT`, `Article 10 IR 2026`,
`Article 16 1348/2014`, `Article 12 Delegated Regulation`, `Recital 12 REMIT II`,
`IR 2026 Annex Table 1`, `ACER Guidance 6.2.1`, `Q&A 2.4.13`.

## How it works

- **Parsing.** EUR-Lex acts are split into recitals, articles and annex tables from their
  XHTML. ACER PDFs have no bookmarks, so sections are recovered from typography (heading
  size and weight) with ACER's own numbering; long sections are split at paragraph numbers.
  Running headers and footers are removed and footnotes are kept separately.
- **Linking.** Every guidance unit is scanned for references such as "Article 2(1) of
  REMIT", "Articles 3 and 5 of REMIT" or "Article 6 of the recast REMIT IR"; these links
  drive `get_provision`.
- **Search.** BM25 over titles and text, fused (reciprocal rank) with semantic search:
  the query is embedded with the multilingual `qwen3-embedding-0.6b` model on Cloudflare
  Workers AI and matched against unit vectors in Cloudflare Vectorize. If semantic search
  is unavailable, BM25 results are returned. One result per section.
- **Domain lexicon** (`src/lexicon.mjs`): abbreviations and everyday terms are matched to
  the legal terms both ways (RRM ↔ registered reporting mechanism, OMP ↔ organised market
  place, "own group" ↔ intragroup, "outage" ↔ unavailability, "outside the EU" ↔ third
  country).
- **Evaluation.** `npm run eval` scores compliance questions written in everyday terms
  (first hit, top 3, MRR@5) for BM25, semantic and hybrid search. There is a development
  set (30 questions, used for tuning) and a holdout set (15 questions, written before
  tuning and not used for it). At 1.0.1, hybrid search: development 70% / 87% / 0.78,
  holdout 33% / 80% / 0.57. The holdout shows the right unit is usually in the top three
  but often not first; semantic search alone is weaker on it than BM25. The sets are
  small and were written by the authors: treat them as a regression check.

## Use

Remote endpoint: `https://remit-mcp.skraptt.workers.dev/mcp` (Streamable HTTP, no
authentication). In Claude: Settings → Connectors → Add custom connector.

Local:

```bash
git fetch origin sources && git worktree add .sources origin/sources   # fetched documents
pip install pdfplumber                                                  # PDF text extraction
npm test        # builds data/remit.json and runs the tests
npm run dev     # http://localhost:8787/mcp
```

## Licence

Code: Apache-2.0. EU legislation is reused under the Commission's reuse policy
(Decision 2011/833/EU); EUR-Lex is the authentic source only for the Official Journal.
ACER documents: "Reproduction is authorised provided the source is acknowledged" —
every answer names and links its source.
