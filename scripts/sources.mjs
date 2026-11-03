// Source registry. Every document the server serves is listed here.
//
// layer:
//   regulation   – Level 1: REMIT and the acts amending it
//   implementing – Level 2: Commission implementing / delegated regulations
//   guidance     – Level 3: ACER guidance, guidance notes, Q&As, open letters, manuals
//
// EUR-Lex documents are fetched as HTML by CELEX number. ACER documents are PDFs; their
// URLs are discovered from the ACER pages listed in ACER_INDEX_PAGES (scripts/fetch.mjs),
// and matched to the entries below by the `match` pattern on the PDF file name. A direct
// `url` takes precedence over discovery.

export const EURLEX = [
  {
    id: 'REMIT',
    title: 'Regulation (EU) No 1227/2011 on wholesale energy market integrity and transparency (REMIT), consolidated',
    short: 'REMIT',
    layer: 'regulation',
    // Consolidated text as amended by Regulation (EU) 2024/1106. The date suffix is the
    // consolidation date; fetch.mjs resolves the latest consolidated version.
    celex: '02011R1227',
    consolidated: true,
  },
  {
    id: 'REMIT-II',
    title: 'Regulation (EU) 2024/1106 amending Regulations (EU) No 1227/2011 and (EU) 2019/942 (REMIT II)',
    short: 'Reg. 2024/1106',
    layer: 'regulation',
    celex: '32024R1106',
  },
  {
    id: 'IR-2026',
    title: 'Commission Implementing Regulation (EU) 2026/256 on data reporting under REMIT (recast)',
    short: 'REMIT IR 2026',
    layer: 'implementing',
    celex: '32026R0256',
    verifyTitle: /implementing regulation/i,
  },
  {
    id: 'DR-2026',
    title: 'Commission Delegated Regulation (EU) 2026/255 on registered reporting mechanisms and inside information platforms',
    short: 'REMIT DR 2026',
    layer: 'implementing',
    celex: '32026R0255',
    verifyTitle: /delegated regulation/i,
  },
  {
    id: 'IR-2014',
    title: 'Commission Implementing Regulation (EU) No 1348/2014 on data reporting implementing REMIT (repealed by the 2026 recast; kept for transition)',
    short: 'REMIT IR 2014',
    layer: 'implementing',
    celex: '32014R1348',
  },
];

export const ACER_INDEX_PAGES = [
  'https://www.acer.europa.eu/remit-documents/guidance-remit-application',
  'https://www.acer.europa.eu/remit-documents',
  'https://acer.europa.eu/news/updated-remit-framework-strengthens-trust-eu-energy-markets',
  'https://www.acer.europa.eu/remit-documents/remit-reporting-guidance',
  'https://www.acer.europa.eu/transaction-reporting-user-manual-trum',
];

export const ACER = [
  {
    id: 'ACER-GUIDANCE',
    title: 'ACER Guidance on the application of REMIT, 6.1st edition (18 December 2024)',
    short: 'ACER Guidance 6.1',
    layer: 'guidance',
    url: 'https://www.acer.europa.eu/sites/default/files/documents/Other%20Documents/6.1st_Edition_ACER_Guidance_REMIT_application_TC.pdf',
    // Clean version first; the track-changes version (registry URL) is the fallback.
    match: /6\.1st_Edition_ACER_Guidance\.pdf$/i,
  },
  { id: 'ACER-GN-WASH', title: 'ACER Guidance Note 1/2017 – Wash trades', short: 'ACER GN 1/2017', layer: 'guidance', match: /wash|Guidance Note v6\.0/i },
  { id: 'ACER-GN-CAPACITY', title: 'ACER Guidance Note 1/2018 – Transmission capacity hoarding', short: 'ACER GN 1/2018', layer: 'guidance', match: /hoarding/i },
  { id: 'ACER-GN-LAYERING', title: 'ACER Guidance Note 1/2019 – Layering and spoofing', short: 'ACER GN 1/2019', layer: 'guidance', match: /layering|spoofing/i },
  { id: 'ACER-QA', title: 'ACER Q&As on REMIT (12 March 2025)', short: 'ACER Q&A', layer: 'guidance', match: /Q(?:&|%26|and)?A[^/]*REMIT|REMIT[^/]*Q(?:&|%26|and)?As?\b/i },
  {
    id: 'ACER-OL-IR-2026',
    title: 'ACER Open Letter on the REMIT Implementing Regulation (2026)',
    short: 'ACER Open Letter IR 2026',
    layer: 'guidance',
    url: 'https://www.acer.europa.eu/sites/default/files/REMIT/Guidance%20on%20REMIT%20Application/Open%20Letters%20on%20REMIT%20Policy/ACER-Open-Letter-REMIT-Implementing-Regulation-2026.pdf',
  },
  { id: 'ACER-OL-DR-2026', title: 'ACER Open Letter on the REMIT Delegated Regulation (2026)', short: 'ACER Open Letter DR 2026', layer: 'guidance', match: /Open-Letter[^/]*Delegated/i },
  { id: 'ACER-MANUAL-2026', keepFrontMatter: true, title: 'ACER REMIT manual for new market participants (2026)', short: 'ACER Manual 2026', layer: 'guidance', url: 'https://www.acer.europa.eu/sites/default/files/REMIT/Guidance%20on%20REMIT%20Application/REMIT-manual-new-market-participants-2026.pdf' },
  { id: 'ACER-UMM-GUIDANCE', title: 'ACER Guidance on the implementation of web feeds for inside information platforms (UMM)', short: 'ACER UMM Guidance', layer: 'guidance', match: /UMM_Guidance\.pdf$/i },
  { id: 'ACER-OL-ALGO', title: 'ACER Open Letter on algorithmic trading', short: 'ACER Open Letter algo', layer: 'guidance', match: /Open-letter-on-algorithmic-trading/i },
  // Reporting manuals. Several versions can be listed on ACER's pages; `latest` picks the
  // highest version number in the file name, and `url` is the fallback.
  {
    id: 'ACER-TRUM',
    rank: { weight: 0.5, framework: true }, // see rankWeight in build-data.mjs
    defaultIR: 'IR-2026', // "the REMIT Implementing Regulation" in this document
    pdf: { tables: true, annexes: true, numberedPlain: true, fieldHeadings: true },
    title: 'ACER Transaction Reporting User Manual (TRUM), latest version – for reporting under Implementing Regulation (EU) 2026/256 from 29 October 2027',
    short: 'ACER TRUM',
    layer: 'guidance',
    latest: true,
    match: /^ACER-REMIT-(?:Transaction-User-Manual|TRUM-\d{4})-v\d+(?:\.\d+)?(?:-\d{4})?\.pdf$/i,
    url: 'https://acer.europa.eu/sites/default/files/REMIT/REMIT%20Reporting%20Guidance/REMIT-reporting-phase-1/ACER-REMIT-Transaction-User-Manual-v8-2026.pdf',
  },
  {
    id: 'ACER-TRUM-7',
    rank: { weight: 0.5, framework: true, chapters: /^[0-3](?:\.|$)/ }, // see rankWeight in build-data.mjs
    defaultIR: 'IR-2014', // "the REMIT Implementing Regulation" in this document
    pdf: { tables: true, annexes: true, numberedPlain: true, fieldHeadings: true },
    title: 'ACER Transaction Reporting User Manual (TRUM) v7.0 – applies until 29 October 2027 (reporting tables of Implementing Regulation 1348/2014)',
    short: 'ACER TRUM 7.0',
    layer: 'guidance',
    url: 'https://www.acer.europa.eu/sites/default/files/REMIT/REMIT%20Reporting%20Guidance/Transaction%20Reporting%20User%20Manual%20(TRUM)/ACER-REMIT-TRUM-2024-v7.0.pdf',
  },
  {
    id: 'ACER-EXPOSURE',
    rank: { weight: 0.5, framework: true }, // see rankWeight in build-data.mjs
    defaultIR: 'IR-2026', // "the REMIT Implementing Regulation" in this document
    pdf: { tables: true, annexes: true, numberedPlain: true, fieldHeadings: true },
    title: 'ACER Guidance on reporting exposure under REMIT (Article 6 of Implementing Regulation (EU) 2026/256)',
    short: 'ACER Exposure Guidance',
    layer: 'guidance',
    match: /Guidance-on-reporting-exposure/i,
  },
  {
    id: 'ACER-MOP',
    rank: { weight: 0.5, framework: true }, // see rankWeight in build-data.mjs
    defaultIR: 'IR-2014', // "the REMIT Implementing Regulation" in this document
    pdf: { tables: true, annexes: true, numberedPlain: true, fieldHeadings: true },
    title: 'ACER Manual of Procedures (MoP) on transaction data, fundamental data and inside information reporting (Annex VII: data fields for inside information)',
    short: 'ACER MoP',
    layer: 'guidance',
    latest: true,
    match: /^ACER[-_]REMIT[-_](?:Manual-data-reporting-V\d+|MoP-on-data-reporting)\.pdf$/i,
    url: 'https://www.acer.europa.eu/sites/default/files/REMIT/REMIT%20Reporting%20Guidance/Manual%20of%20Procedures%20%28MoP%29%20on%20Data%20Reporting/ACER-REMIT-Manual-data-reporting-V10.pdf',
  },
  { id: 'ACER-WHAT-TO-REPORT-2026', title: 'ACER – REMIT data: what to report and how (2026)', short: 'ACER What to report 2026', layer: 'guidance', match: /what[^/]*report/i },
];
