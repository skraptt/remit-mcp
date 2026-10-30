// mevzuat.gov.tr'nin kanun metni sayfasını (MevzuatFihristDetayIframe) düz metne çevirir.
// Sayfanın içindeki metin, Microsoft Word'ün "filtered HTML" çıktısıdır: <p class=MsoNormal>
// paragrafları, <b>/<span> biçimlendirmesi, <sup>/<a> dipnot işaretleri ve <table>.
// Çıktı, tarayıcıdaki innerText'in satır yapısını taklit eder (her paragraf ayrı satır,
// paragraflar arasında boş satır), böylece aynı ayrıştırıcı iki kaynakla da çalışır.
// Bağımlılık yoktur; Node'da ve tarayıcıda aynı şekilde çalışır.

const NAMED = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", shy: '',
  laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', sbquo: '‚', bdquo: '„',
  ndash: '–', mdash: '—', hellip: '…', middot: '·', bull: '•', deg: '°', sect: '§', para: '¶',
  copy: '©', reg: '®', trade: '™', times: '×', divide: '÷', plusmn: '±', frac12: '½', frac14: '¼', frac34: '¾',
  sup1: '¹', sup2: '²', sup3: '³', ordm: 'º', ordf: 'ª', acirc: 'â', icirc: 'î', ucirc: 'û',
  Acirc: 'Â', Icirc: 'Î', Ucirc: 'Û', ccedil: 'ç', Ccedil: 'Ç', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü',
  eacute: 'é', egrave: 'è', aacute: 'á', agrave: 'à', zwnj: '', zwj: '', lrm: '', rlm: '',
};

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (all, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : all;
    }
    return e in NAMED ? NAMED[e] : all;
  });
}

// Sayfadan Word belgesinin gövdesini çıkarır. Bulunamazsa null döner (ör. metin PDF ise).
export function extractDocument(html) {
  const start = html.search(/<body[\s>]/i);
  if (start === -1) return null;
  const end = html.indexOf('</body>', start);
  const body = html.slice(start, end === -1 ? undefined : end);
  return /<p[\s>]/i.test(body) ? body : null;
}

const BLOCK2 = 'p|h[1-6]|blockquote|pre|ol|ul|dl|table'; // innerText: 2 satır sonu
const BLOCK1 = 'div|li|dt|dd|tr|caption|thead|tbody|tfoot|hr|center|section|article|header|footer|address';

export function htmlToText(html) {
  const doc = extractDocument(html) ?? html;
  let s = doc
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|title|xml)\b[\s\S]*?<\/\1\s*>/gi, '')
    // Kaynaktaki satır sonları HTML'de boşluktur.
    .replace(/[ \t\r\n\f]+/g, ' ')
    .replace(/<br\b[^>]*>/gi, '\u0001')
    .replace(new RegExp(`<\\/?(?:${BLOCK2})\\b[^>]*>`, 'gi'), '\u0002')
    .replace(new RegExp(`<\\/?(?:${BLOCK1})\\b[^>]*>`, 'gi'), '\u0001')
    // Aynı dipnota ikinci kez yapılan atıf, bağlantısız bir üst simge olarak yazılır
    // ("<sup><span class=MsoFootnoteReference>5</span></sup>"); bunu da "[5]" biçimine getir.
    // Bazı sayfalarda bu atıf üst simge bile değildir: "<span class=MsoFootnoteReference>67</span>".
    .replace(/<span\b[^>]*class=["']?MsoFootnoteReference\b[^>]*>((?:\s|<[a-z][^>]*>)*)(\d{1,3})((?:\s|<\/[a-z]+\s*>)*?)<\/span>/gi, '[$2]')
    .replace(/<sup\b[^>]*>((?:\s|<[^>]+>)*)(\d{1,3})((?:\s|<[^>]+>)*)<\/sup>/gi, '[$2]')
    .replace(/<\/t[dh]\s*>/gi, '\t')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s);

  // Blok sınırlarını satır sonlarına çevir: art arda gelen sınırlar birleşir, en büyüğü geçerlidir.
  const out = [];
  for (const part of s.split(/((?:[\u0001\u0002] ?)+)/)) {
    if (/^[\u0001\u0002]/.test(part)) {
      out.push(part.includes('\u0002') ? '\n\n' : '\n');
      continue;
    }
    out.push(part);
  }
  return out
    .join('')
    .split('\n')
    .map((l) => l.replace(/^[ \t]+|[ \t]+$/g, '').replace(/ {2,}/g, ' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}
