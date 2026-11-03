// Application dates of REMIT II and its implementing / delegated acts.
//
// Every entry is taken from the entry-into-force and transitional provisions of the acts
// themselves; `source` names the provision. Dates of entry into force follow from the
// publication date (twentieth day after publication).

export const TIMELINE = [
  {
    date: '2024-05-07',
    event: 'REMIT II (Regulation (EU) 2024/1106) enters into force; amendments to REMIT apply unless listed below.',
    source: 'REMIT-II/3',
    applies: [],
  },
  {
    date: '2024-11-08',
    event: 'Article 15(2) REMIT (as amended) applies.',
    source: 'REMIT-II/3',
    applies: ['REMIT/15'],
  },
  {
    date: '2025-01-01',
    event: 'Articles 7a to 7e REMIT (as inserted by REMIT II) apply.',
    source: 'REMIT-II/3',
    applies: ['REMIT/7a', 'REMIT/7b', 'REMIT/7c', 'REMIT/7d', 'REMIT/7e'],
  },
  {
    date: '2026-04-29',
    event:
      'Implementing Regulation (EU) 2026/256 enters into force and Implementing Regulation (EU) No 1348/2014 is repealed (with the transitional exceptions listed below). From this date 2026/256 applies except Articles 3, 4, 6, 7(2), 8(5), 9, 10(6), 11(4), 12(5), 12(9) and 13(2) — in particular the reporting deadlines in Article 10 (standard contracts: no later than two working days; non-standard contracts: no later than ten working days) and the transactions reportable on request in Article 5. Delegated Regulation (EU) 2026/255 (RRMs and IIPs) enters into force; its Articles 1, 2, 9 and 40 apply. Articles 4a(1)–(7) and 9a(1)–(5) REMIT apply from the entry into force of the delegated acts adopted under them.',
    source: 'IR-2026/16',
    applies: ['IR-2026/1', 'IR-2026/2', 'IR-2026/5', 'IR-2026/7', 'IR-2026/8', 'IR-2026/10', 'IR-2026/11', 'IR-2026/12', 'IR-2026/13', 'IR-2026/14', 'IR-2026/15', 'IR-2026/16', 'DR-2026/1', 'DR-2026/2', 'DR-2026/9', 'REMIT/4a', 'REMIT/9a'],
    alsoSee: ['IR-2026/17', 'DR-2026/40', 'REMIT-II/3'],
  },
  {
    date: '2026-10-29',
    event: 'Deadline for ACER guidance and electronic formats on Article 6 (exposure reporting) and on Articles 3, 4(2), 7(2), 8(5) and 10(6) of Implementing Regulation (EU) 2026/256. ACER published TRUM v8.0 and its Guidance on reporting exposure (v1.0) on this date.',
    source: 'IR-2026/17',
    applies: [],
    alsoSee: ['ACER-TRUM/1.2', 'ACER-EXPOSURE/2.3'],
  },
  {
    date: '2027-01-01',
    event: 'Exposure reporting (Article 6 of Implementing Regulation (EU) 2026/256) applies: market participants assess the 600 GWh threshold for 2027 on the basis of transactions concluded by 31 December 2026 with delivery in 2027. The first report is due in October 2027.',
    source: 'IR-2026/17',
    applies: ['IR-2026/6'],
    alsoSee: ['ACER-EXPOSURE/2.3', 'ACER-OL-IR-2026/19'],
  },
  {
    date: '2027-04-29',
    event: 'Deadline for ACER guidance and electronic formats on Articles 4(1), 4(3)–(7), 9, 11(4), 12(5) and 12(9) of Implementing Regulation (EU) 2026/256.',
    source: 'IR-2026/17',
    applies: [],
  },
  {
    date: '2027-10-29',
    event: 'TRUM v8.0 replaces TRUM v7.0: reporting under the new tables of Implementing Regulation (EU) 2026/256 follows TRUM v8.0; until this date TRUM v7.0 applies.',
    source: 'ACER-TRUM/1.2',
    applies: [],
    alsoSee: ['ACER-TRUM-7/1.1'],
  },
  {
    date: '2027-10-29',
    event:
      'Articles 3, 4(2), 7(2), 8(5), 10(6) and the Annex (reporting tables) of Implementing Regulation (EU) 2026/256 apply. Article 3, Article 11(1) and the Annex of Implementing Regulation (EU) No 1348/2014 cease to apply. Articles 3 to 8 and 10 to 39 of Delegated Regulation (EU) 2026/255, including Annexes I and II, apply. Deadline for ACER guidance on Article 4(8).',
    source: 'IR-2026/17',
    applies: ['IR-2026/3', 'IR-2026/4', 'IR-2026/7', 'IR-2026/8', 'IR-2026/10', 'DR-2026/3', 'DR-2026/10', 'DR-2026/39'],
    alsoSee: ['IR-2026/16', 'DR-2026/40'],
  },
  {
    date: '2027-10-31',
    event: 'First exposure report due (reference quarter Q3 2027; positions with delivery 1 October 2027 – 31 March 2029), then quarterly by the last day of the month after each quarter.',
    source: 'ACER-EXPOSURE/2.3',
    applies: ['IR-2026/6'],
    alsoSee: ['ACER-OL-IR-2026/19'],
  },
  {
    date: '2028-04-29',
    event:
      'Articles 4(1), 4(3)–(7) (periodic reporting), 9 (trade-matching systems), 11(4), 12(5), 12(9) and 13(2) of Implementing Regulation (EU) 2026/256 apply. Articles 9(5), 9(9) and 10(1) of Implementing Regulation (EU) No 1348/2014 cease to apply.',
    source: 'IR-2026/17',
    applies: ['IR-2026/4', 'IR-2026/9', 'IR-2026/11', 'IR-2026/12', 'IR-2026/13'],
    alsoSee: ['IR-2026/16'],
  },
  {
    date: '2028-07-01',
    event: 'Article 4(8) of Implementing Regulation (EU) 2026/256 applies.',
    source: 'IR-2026/17',
    applies: ['IR-2026/4'],
  },
];
