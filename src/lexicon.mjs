// Domain lexicon. REMIT texts switch between abbreviations and full terms ("RRM" /
// "registered reporting mechanism"), and practitioners ask in everyday words ("trades
// within our own group" for intragroup transactions, "outage" for unavailability).
// Each group lists equivalent expressions; when any of them appears in a text (at
// indexing) or in a query, the terms of the others are added. Patterns are matched on
// lower-cased text.

export const LEXICON = [
  ['rrm', 'registered reporting mechanism'],
  ['iip', 'inside information platform'],
  ['omp', 'organised market place', 'organised marketplace', 'trading venue'],
  ['ppat', 'ppaet', 'persons professionally arranging'],
  ['nra', 'national regulatory authority'],
  ['tso', 'transmission system operator'],
  ['umm', 'urgent market message'],
  ['ppa', 'power purchase agreement'],
  ['wep', 'wholesale energy product'],
  ['ceremp', 'registration of market participants'],
  ['intragroup', 'intra-group', 'own group', 'same group', 'group companies'],
  ['third country', 'third-country', 'outside the eu', 'outside the union', 'non-eu'],
  ['unavailability', 'outage'],
  ['uti', 'unique transaction identifier'],
  ['lei', 'legal entity identifier'],
  ['eic', 'energy identification code'],
  ['deregister', 'deregistration', 'cancel the registration', 'remove from the register'],
  ['permanently shut down', 'permanent shutdown', 'closed for good', 'decommission', 'decommissioned', 'closure of the plant'],
  ['same facility', 'same site', 'on-site', 'onsite', 'self-consumption', 'consumed internally'],
  ['wash trade', 'wash trading', 'trade with each other', 'trade with ourselves', 'self-trade', 'self-trading'],
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const GROUPS = LEXICON.map((g) => ({ terms: g, re: new RegExp(`(?:^|[^a-z0-9])(?:${g.map(esc).join('|')})(?:s|es)?(?![a-z0-9])`, 'i') }));

// Returns the extra text to index or search with: all equivalents of the groups present.
export function expansions(text) {
  const t = String(text).toLowerCase();
  const out = [];
  for (const g of GROUPS) if (g.re.test(t)) out.push(...g.terms);
  return out.join(' ');
}
