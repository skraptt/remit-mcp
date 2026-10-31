// Search quality evaluation set: [question, acceptable units (section ids; parts match their section)].
// Written as compliance officers would ask, mostly without the words of the legal text.
// Expected units were checked against data/remit.json. On 31 Oct 2026 seven answer lists
// were corrected after review: they had missed units that answer the question (e.g.
// balancing services are reported periodically under Article 4 of IR 2026, not Article 3).

// HOLDOUT is written before tuning and must not be used to tune synonyms or weights.
// Its answer lists were reviewed once, the same way (three lists extended with units that
// answer the question); the lexicon and weights were not changed for it.

export const CASES = [
  ['Can we delay disclosure of inside information about a planned outage?', ['ACER-GUIDANCE/4.4', 'REMIT/4']],
  ['How quickly must a PPAT notify the NRA of a suspicious transaction?', ['ACER-GUIDANCE/9.3.3', 'REMIT/15']],
  ['Is a power purchase agreement a wholesale energy product?', ['ACER-GUIDANCE/2.2.1', 'REMIT/2']],
  ['What is a wash trade?', ['ACER-GN-WASH/2']],
  ['What is spoofing?', ['ACER-GN-LAYERING/2', 'ACER-GN-LAYERING/1']],
  ['Who has to register with the national regulator?', ['ACER-GUIDANCE/8.2', 'REMIT/9']],
  ['Do we have to report trades within our own group?', ['IR-2026/5', 'IR-2026/Recital 10', 'ACER-QA/3.3.26']],
  ['What is the reporting deadline for non-standard contracts?', ['IR-2026/10', 'ACER-OL-IR-2026/8']],
  ['How many working days do we have to report a standard contract?', ['IR-2026/10', 'ACER-OL-IR-2026/8']],
  ['Which firms must report their exposures?', ['IR-2026/6', 'ACER-OL-IR-2026/17']],
  ['What penalties can be imposed for breaching REMIT?', ['REMIT/18', 'ACER-GUIDANCE/10.3']],
  ['Is it market manipulation to withhold transmission capacity?', ['ACER-GN-CAPACITY/2', 'ACER-GN-CAPACITY/3.1', 'ACER-GN-CAPACITY/3.1.1', 'ACER-GN-CAPACITY/3.2']],
  ['Can our traders act on our own trading plans?', ['ACER-GUIDANCE/3.3.5']],
  ['What counts as inside information?', ['REMIT/2', 'ACER-GUIDANCE/3.3']],
  ['When is information precise enough to be inside information?', ['ACER-GUIDANCE/3.3.1']],
  ['Do we need to notify ACER about algorithmic trading?', ['ACER-GUIDANCE/7.2', 'REMIT/5a', 'ACER-OL-ALGO/1']],
  ['How must inside information be published on a platform?', ['ACER-GUIDANCE/4.2.1', 'DR-2026/19', 'REMIT/4']],
  ['Are hydrogen contracts in scope?', ['ACER-GUIDANCE/2.2.1', 'ACER-OL-IR-2026/22']],
  ['What does ACER need to authorise a reporting mechanism?', ['DR-2026/3', 'DR-2026/4', 'DR-2026/10', 'REMIT/9a']],
  ['How should LNG transactions be reported?', ['IR-2026/10', 'ACER-OL-IR-2026/12', 'REMIT/7c', 'REMIT/7d', 'ACER-WHAT-TO-REPORT-2026/1.1']],
  ['When does the new transaction reporting format start?', ['IR-2026/17', 'ACER-OL-IR-2026/1', 'ACER-OL-IR-2026/2']],
  ['Does REMIT apply to traders outside the EU?', ['ACER-GUIDANCE/8.6', 'ACER-GUIDANCE/2.3', 'REMIT/9']],
  ['Can ACER carry out on-site inspections?', ['REMIT/13a']],
  ['What are indicators of insider trading?', ['ACER-GUIDANCE/5.3.1', 'ACER-GUIDANCE/5.3']],
  ['What arrangements must a trading venue have to detect market abuse?', ['ACER-GUIDANCE/9.4.1', 'ACER-GUIDANCE/9.4.4', 'REMIT/15']],
  ['How does REMIT relate to MAR and MiFID?', ['ACER-GUIDANCE/2.5', 'REMIT/1']],
  ['What is an organised marketplace?', ['IR-2026/2', 'ACER-QA/3.5.1']],
  ['Must transactions on balancing markets be reported?', ['IR-2026/4', 'ACER-GUIDANCE/2.2.2']],
  ['What is the exemption for transmission system operators in balancing?', ['ACER-GUIDANCE/5.5.1', 'REMIT/3']],
  ['How do we disclose an unplanned outage of a power plant?', ['REMIT/4', 'ACER-GUIDANCE/4.2.1', 'ACER-QA/3.7.17', 'ACER-QA/3.7.10']],
];

export const HOLDOUT = [
  ['Do we have to publish information about planned maintenance of a gas storage facility?', ['REMIT/4', 'ACER-GUIDANCE/3.3.4', 'ACER-QA/3.7.17']],
  ['Can an employee trade on information they heard in a meeting before it is public?', ['REMIT/3', 'ACER-GUIDANCE/5.2.1']],
  ['What information must be included when registering in CEREMP?', ['ACER-GUIDANCE/8.3', 'REMIT/9']],
  ['Who can report transactions on our behalf?', ['IR-2026/8', 'REMIT/8']],
  ['Is placing orders without intending to execute them prohibited?', ['ACER-GN-LAYERING/2', 'ACER-GN-LAYERING/3.2', 'ACER-GUIDANCE/6.2.1']],
  ['What is a lifecycle event?', ['IR-2026/2', 'ACER-OL-IR-2026/6']],
  ['Do final customers with large consumption fall under REMIT?', ['ACER-GUIDANCE/2.3.6', 'REMIT/2', 'ACER-QA/2.4.44']],
  ['How must fundamental data on electricity be reported?', ['IR-2026/11', 'ACER-OL-IR-2026/15']],
  ['What happens to transactions reported under the old implementing regulation?', ['IR-2026/16', 'ACER-OL-IR-2026/2']],
  ['Can ACER investigate cross-border cases itself?', ['REMIT/13', 'REMIT/13a', 'REMIT/13b', 'REMIT-II/Recital 27']],
  ['What must a registered reporting mechanism do if it detects invalid data?', ['DR-2026/27', 'DR-2026/26']],
  ['Are guarantees of origin wholesale energy products?', ['ACER-QA/3.3.50', 'ACER-GUIDANCE/2.2.1']],
  ['Is it manipulation to spread false rumours about a power plant outage?', ['ACER-GUIDANCE/6.2.4', 'REMIT/2']],
  ['What should a compliance programme for REMIT include?', ['ACER-MANUAL-2026/6', 'ACER-GUIDANCE/9.4.2', 'ACER-GUIDANCE/10.2']],
  ['When can a TSO be exempted from the insider trading prohibition?', ['ACER-GUIDANCE/5.5.1', 'REMIT/3']],
];
