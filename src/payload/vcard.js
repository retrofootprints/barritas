// vCard 2.1 / 3.0 / 4.0 (the common properties).

const unesc = (s) => s.replace(/\\([nN])/g, '\n').replace(/\\([,;:\\])/g, '$1');

/** Split on unescaped `sep`. */
function splitUnescaped(s, sep) {
  const out = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) { cur += s[i] + s[++i]; continue; }
    if (s[i] === sep) { out.push(cur); cur = ''; continue; }
    cur += s[i];
  }
  out.push(cur);
  return out;
}

export function parseVCard(text) {
  if (!/^\s*BEGIN:VCARD/i.test(text)) return null;
  // Unfold continuation lines (CRLF followed by space or tab).
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const props = [];
  for (const line of lines) {
    const m = line.match(/^(?:[\w-]+\.)?([A-Za-z-]+)((?:;[^:]*)?):(.*)$/);
    if (!m) continue;
    const name = m[1].toUpperCase();
    if (name === 'BEGIN' || name === 'END') continue;
    const params = m[2].slice(1).split(';').filter(Boolean).map((p) => p.toUpperCase());
    const types = params.flatMap((p) => (p.startsWith('TYPE=') ? p.slice(5).split(',') : p.includes('=') ? [] : [p])).map((t) => t.toLowerCase());
    props.push({ name, types, value: m[3] });
  }
  const get = (n) => props.filter((p) => p.name === n);
  const one = (n) => get(n)[0]?.value;
  const nParts = one('N') ? splitUnescaped(one('N'), ';').map(unesc) : [];
  return {
    version: one('VERSION'),
    fn: one('FN') ? unesc(one('FN')) : [nParts[3], nParts[1], nParts[2], nParts[0], nParts[4]].filter(Boolean).join(' '),
    n: nParts,
    org: one('ORG') ? splitUnescaped(one('ORG'), ';').map(unesc).filter(Boolean).join(', ') : '',
    title: one('TITLE') ? unesc(one('TITLE')) : '',
    tel: get('TEL').map((p) => ({ value: unesc(p.value).replace(/^tel:/i, ''), types: p.types })),
    email: get('EMAIL').map((p) => ({ value: unesc(p.value), types: p.types })),
    url: get('URL').map((p) => unesc(p.value)),
    adr: get('ADR').map((p) => ({ parts: splitUnescaped(p.value, ';').map(unesc), types: p.types })),
    bday: one('BDAY'),
    note: one('NOTE') ? unesc(one('NOTE')) : '',
  };
}

const typeLabel = (types) => (types.length ? ` (${types.filter((t) => t !== 'pref' && t !== 'voice').join(', ') || 'pref'})` : '');

export function interpretVCard(text) {
  const v = parseVCard(text);
  if (!v) return null;
  const fields = [['Name', v.fn], ['Organisation', v.org], ['Title', v.title]];
  v.tel.forEach((t) => fields.push([`Phone${typeLabel(t.types)}`, t.value]));
  v.email.forEach((e) => fields.push([`Email${typeLabel(e.types)}`, e.value]));
  v.url.forEach((u) => fields.push(['Website', u]));
  v.adr.forEach((a) => {
    // ADR: PO box; extended; street; locality; region; postal code; country
    const [po, ext, street, city, region, zip, country] = a.parts;
    fields.push([`Address${typeLabel(a.types)}`, [po, ext, street, [zip, city].filter(Boolean).join(' '), region, country].filter(Boolean).join(', ')]);
  });
  fields.push(['Birthday', v.bday], ['Note', v.note], ['vCard version', v.version]);
  const links = [];
  if (v.tel[0]) links.push({ label: 'Call', href: `tel:${v.tel[0].value.replace(/[^\d+*#]/g, '')}` });
  if (v.email[0]) links.push({ label: 'Email', href: `mailto:${v.email[0].value}` });
  links.push({ label: 'Save contact (.vcf)', blob: new Blob([text], { type: 'text/vcard' }), download: `${(v.fn || 'contact').replace(/[^\w.-]+/g, '_')}.vcf` });
  return { title: 'Contact (vCard)', summary: v.fn, fields, links };
}
