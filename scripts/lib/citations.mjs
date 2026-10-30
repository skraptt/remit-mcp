// Finds references to REMIT, the implementing / delegated regulations and REMIT II in
// free text ("Article 2(1) of REMIT", "Articles 3 and 5 of REMIT", "Article 6 of the
// recast REMIT IR") and returns the unit ids they point to ("REMIT/2", "IR-2026/6").

const NUM = String.raw`\d{1,2}[a-z]?(?:\(\s*\d{1,2}[a-z]?\s*\))?(?:\s*\(\s*[a-z]{1,4}\s*\))?(?:\s*,?\s*(?:first|second|third|fourth|fifth|last)\s+subparagraph)?`;
const LIST = String.raw`${NUM}(?:\s*(?:,|and|or|to|–|-)\s*(?:Article\s+)?(?:${NUM}|\(\s*\d{1,2}[a-z]?\s*\)))*`;
const TARGET = String.raw`(?:of|in|under)\s+(?:the\s+)?(recast\s+REMIT\s+IR|REMIT\s+IR|REMIT\s+Implementing\s+Regulation|(?:Commission\s+)?Implementing\s+Regulation(?:\s*\(EU\)\s*(?:No\s*)?(?:1348\/2014|2026\/256))?|(?:Commission\s+)?Delegated\s+Regulation(?:\s*\(EU\)\s*2026\/255)?|Regulation\s*\(EU\)\s*(?:No\s*)?1227\/2011|Regulation\s*\(EU\)\s*2024\/1106|REMIT(?!\s+(?:IR|Implementing|revision|II)))`;
const RE = new RegExp(String.raw`\bArticles?\s+(${LIST})\s*,?\s+${TARGET}`, 'gi');

function targetDoc(name, { defaultIR }) {
  const n = name.toLowerCase().replace(/\s+/g, ' ');
  if (/1348\/2014/.test(n)) return 'IR-2014';
  if (/2026\/256|recast/.test(n)) return 'IR-2026';
  if (/delegated/.test(n)) return 'DR-2026';
  if (/2024\/1106/.test(n)) return 'REMIT-II';
  if (/implementing|remit ir/.test(n)) return defaultIR;
  return 'REMIT';
}

// Returns [{ id: 'REMIT/2', ref: 'Article 2(1) of REMIT' }, …], deduplicated by id.
export function findCitations(text, { defaultIR = 'IR-2014' } = {}) {
  const out = new Map();
  for (const m of text.matchAll(RE)) {
    const doc = targetDoc(m[2], { defaultIR });
    const nums = [];
    let prevEnd = 0;
    // Paragraph-only items ("and (4)") refer to the same article; drop them.
    const list = m[1].replace(/(^|[\s,])\(\s*\d{1,2}[a-z]?\s*\)/g, '$1');
    for (const a of list.matchAll(/(\d{1,2}[a-z]?)(?:\s*\([^)]*\))*/gi)) {
      const between = list.slice(prevEnd, a.index);
      const last = nums[nums.length - 1];
      // "Articles 13 to 15": expand plain numeric ranges.
      if (last && /\bto\b|[–-]/.test(between) && /^\d+$/.test(last) && /^\d+$/.test(a[1]) && +a[1] - +last < 30) {
        for (let k = +last + 1; k < +a[1]; k++) nums.push(String(k));
      }
      nums.push(a[1]);
      prevEnd = a.index + a[0].length;
    }
    for (const n of nums) {
      const id = `${doc}/${n}`;
      if (!out.has(id)) out.set(id, m[0].replace(/\s+/g, ' '));
    }
  }
  return [...out].map(([id, ref]) => ({ id, ref }));
}
