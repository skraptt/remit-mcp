// English text normalisation and light stemming for legal text.

const STOP = new Set(
  `a an the and or of to in on for by with as at from into under upon within without about between
  is are was were be been being shall may must should would could can will this that these those such
  which who whom whose what when where why how it its their there here than then also any all each
  other per not no nor if but so do does did done has have had i we you they he she my our your
  article articles paragraph point regulation remit acer guidance`.split(/\s+/),
);

// Conversational words dropped from queries only.
const QUERY_STOP = new Set('please tell me explain need know does do i my our us we want would like about regarding'.split(' '));

export const fold = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`]/g, "'");

// Small suffix-stripping stemmer (a subset of Porter step 1 plus common legal suffixes).
export function stem(w) {
  if (w.length <= 3 || /\d/.test(w)) return w;
  let s = w;
  if (s.endsWith("'s")) s = s.slice(0, -2);
  if (s.endsWith('ies') && s.length > 4) s = `${s.slice(0, -3)}y`;
  else if (s.endsWith('sses')) s = s.slice(0, -2);
  else if (s.endsWith('s') && !s.endsWith('ss') && !s.endsWith('us') && !s.endsWith('is')) s = s.slice(0, -1);
  for (const suf of ['ational', 'ization', 'isation', 'ations', 'ation', 'ments', 'ment', 'ings', 'ing', 'edly', 'ed', 'ers', 'er', 'ive', 'ity', 'ally', 'al', 'ly', 'ence', 'ance']) {
    if (s.endsWith(suf) && s.length - suf.length >= 4) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  if (s.endsWith('e') && s.length > 4) s = s.slice(0, -1);
  return s;
}

export function tokenize(text, { query = false } = {}) {
  const out = [];
  const folded = fold(text);
  // Hyphenated compounds also count as one word ("de-register" = "deregister").
  for (const m of folded.matchAll(/\b([a-z]{2,})-([a-z]{3,})\b/g)) {
    const joined = m[1] + m[2];
    if (!STOP.has(joined)) out.push(stem(joined));
  }
  for (const raw of folded.split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw) || (query && QUERY_STOP.has(raw))) continue;
    if (raw.length < 2 && !/\d/.test(raw)) continue;
    out.push(stem(raw));
  }
  return out;
}
