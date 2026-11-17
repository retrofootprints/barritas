// Payload builders used by the generator's templates. Pure functions (unit-tested in tests/).
import { gs1CheckDigit } from './formats.js';

// ---------- Wi-Fi ----------

const wifiEsc = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');

/** { ssid, password, security: 'WPA'|'WEP'|'nopass', hidden } → WIFI:… string */
export function buildWifi({ ssid, password = '', security = 'WPA', hidden = false }) {
  if (!ssid) throw new Error('Network name (SSID) is required.');
  let s = `WIFI:T:${security};S:${wifiEsc(ssid)};`;
  if (security !== 'nopass') s += `P:${wifiEsc(password)};`;
  if (hidden) s += 'H:true;';
  return `${s};`;
}

// ---------- vCard ----------

const vEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function buildVCard({ first = '', last = '', org = '', title = '', phone = '', email = '', url = '', street = '', city = '', zip = '', country = '', note = '' }) {
  if (!first && !last && !org) throw new Error('Enter at least a name or an organisation.');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${vEsc(last)};${vEsc(first)};;;`, `FN:${vEsc([first, last].filter(Boolean).join(' ') || org)}`];
  if (org) lines.push(`ORG:${vEsc(org)}`);
  if (title) lines.push(`TITLE:${vEsc(title)}`);
  if (phone) lines.push(`TEL;TYPE=CELL:${vEsc(phone)}`);
  if (email) lines.push(`EMAIL:${vEsc(email)}`);
  if (url) lines.push(`URL:${vEsc(url)}`);
  if (street || city || zip || country) lines.push(`ADR;TYPE=WORK:;;${vEsc(street)};${vEsc(city)};;${vEsc(zip)};${vEsc(country)}`);
  if (note) lines.push(`NOTE:${vEsc(note)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

// ---------- URL ----------

export function buildUrl({ url }) {
  const u = String(url || '').trim();
  if (!u) throw new Error('Enter a URL.');
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
}

// ---------- GS1 ----------

// AI → { label, fixed (value length) | max, type: 'n'|'an'|'date'|'kg' }
export const GS1_TEMPLATE_AIS = {
  '00': { label: 'SSCC (00)', fixed: 18, type: 'n', check: true },
  '01': { label: 'GTIN (01)', fixed: 14, type: 'n', check: true },
  '02': { label: 'Contained GTIN (02)', fixed: 14, type: 'n', check: true },
  '11': { label: 'Production date (11)', fixed: 6, type: 'date' },
  '13': { label: 'Packaging date (13)', fixed: 6, type: 'date' },
  '15': { label: 'Best before (15)', fixed: 6, type: 'date' },
  '17': { label: 'Expiry date (17)', fixed: 6, type: 'date' },
  '3103': { label: 'Net weight, kg (3103)', fixed: 6, type: 'kg' },
  '10': { label: 'Batch / lot (10)', max: 20, type: 'an' },
  '21': { label: 'Serial number (21)', max: 20, type: 'an' },
  '30': { label: 'Count of items (30)', max: 8, type: 'n' },
  '37': { label: 'Count of trade items (37)', max: 8, type: 'n' },
  '400': { label: "Customer's order number (400)", max: 30, type: 'an' },
};

function gs1Value(ai, raw) {
  const def = GS1_TEMPLATE_AIS[ai];
  let v = String(raw ?? '').trim();
  if (def.type === 'date') {
    // Accept YYYY-MM-DD (from <input type=date>) or YYMMDD.
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) v = m[1].slice(2) + m[2] + m[3];
    if (!/^\d{6}$/.test(v)) throw new Error(`${def.label}: enter a date.`);
    return v;
  }
  if (def.type === 'kg') {
    const n = Number(v.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n >= 1000) throw new Error(`${def.label}: enter a weight below 1000 kg.`);
    return String(Math.round(n * 1000)).padStart(6, '0');
  }
  if (def.type === 'n' && !/^\d+$/.test(v)) throw new Error(`${def.label}: digits only.`);
  if (def.check && v.length === def.fixed - 1) v += gs1CheckDigit(v);
  if (def.check && v.length === def.fixed && gs1CheckDigit(v.slice(0, -1)) !== v.slice(-1)) {
    throw new Error(`${def.label}: wrong check digit (expected ${gs1CheckDigit(v.slice(0, -1))}).`);
  }
  if (def.fixed && v.length !== def.fixed) throw new Error(`${def.label}: needs ${def.fixed} digits${def.check ? ` (or ${def.fixed - 1}; the check digit is added)` : ''}.`);
  if (def.max && (v.length < 1 || v.length > def.max)) throw new Error(`${def.label}: 1–${def.max} characters.`);
  if (def.type === 'an' && !/^[!"%-?A-Z_a-z]+$/.test(v)) throw new Error(`${def.label}: only GS1 characters allowed (letters, digits and !"%&'()*+,-./:;<=>?_).`);
  return v;
}

/** rows: [{ ai, value }] → "(01)…(17)…(10)…" with fixed-length AIs first. */
export function buildGs1(rows) {
  const items = rows.filter((r) => r.ai && String(r.value ?? '').trim() !== '').map((r) => ({ ai: r.ai, value: gs1Value(r.ai, r.value) }));
  if (!items.length) throw new Error('Add at least one Application Identifier.');
  if (new Set(items.map((i) => i.ai)).size !== items.length) throw new Error('Each AI can only be used once.');
  items.sort((a, b) => Number(!GS1_TEMPLATE_AIS[a.ai].fixed) - Number(!GS1_TEMPLATE_AIS[b.ai].fixed));
  return items.map((i) => `(${i.ai})${i.value}`).join('');
}

// ---------- IATA BCBP (Resolution 792), mandatory fields, single leg ----------

export function dayOfYear(date) {
  const d = date instanceof Date ? date : new Date(`${date}T12:00:00Z`);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
}

const pad = (s, n) => String(s ?? '').toUpperCase().slice(0, n).padEnd(n, ' ');

/**
 * { lastName, firstName, pnr, from, to, carrier, flight, date (YYYY-MM-DD), cabin, seat, sequence, status, eticket }
 * → "M1SURNAME/GIVEN       EPNR    FROTOCC 0123 123Y012A0001 100"
 */
export function buildBcbp(f) {
  const name = `${(f.lastName || '').trim()}/${(f.firstName || '').trim()}`.toUpperCase();
  if (name.length < 2) throw new Error('Passenger name is required.');
  for (const [k, n] of [['from', 3], ['to', 3]]) {
    if (!/^[A-Z]{3}$/i.test(f[k] || '')) throw new Error(`${k === 'from' ? 'From' : 'To'}: 3-letter IATA airport code.`);
    void n;
  }
  if (!/^[A-Z0-9]{2,3}$/i.test(f.carrier || '')) throw new Error('Carrier: 2–3 character airline designator.');
  const fm = String(f.flight || '').trim().toUpperCase().match(/^(\d{1,4})([A-Z]?)$/);
  if (!fm) throw new Error('Flight number: up to 4 digits, optional letter.');
  const flight = fm[1].padStart(4, '0') + (fm[2] || ' ');
  if (!f.date) throw new Error('Flight date is required.');
  const doy = String(dayOfYear(f.date)).padStart(3, '0');
  const sm = String(f.seat || '').trim().toUpperCase().match(/^(\d{1,3})([A-Z])$/);
  const seat = sm ? sm[1].padStart(3, '0') + sm[2] : pad(f.seat || '', 4);
  const qm = String(f.sequence || '').trim().toUpperCase().match(/^(\d{1,4})([A-Z]?)$/);
  const seq = qm ? qm[1].padStart(4, '0') + (qm[2] || ' ') : pad(f.sequence || '', 5);
  return [
    'M1',
    pad(name, 20),
    f.eticket === false ? ' ' : 'E',
    pad(f.pnr, 7),
    pad(f.from, 3),
    pad(f.to, 3),
    pad(f.carrier, 3),
    flight,
    doy,
    pad(f.cabin || 'Y', 1),
    seat,
    seq,
    pad(f.status || '1', 1),
    '00',
  ].join('');
}

// ---------- EPC / SEPA credit transfer QR ----------

export function ibanValid(iban) {
  const s = String(iban).replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

/** { name, iban, bic, amount, purpose, reference, text } → EPC069-12 v002 payload */
export function buildEpc({ name, iban, bic = '', amount = '', purpose = '', reference = '', text = '' }) {
  const ib = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (!name) throw new Error('Beneficiary name is required.');
  if (name.length > 70) throw new Error('Beneficiary name: at most 70 characters.');
  if (!ibanValid(ib)) throw new Error('IBAN is not valid (check digits do not match).');
  if (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i.test(bic.trim())) throw new Error('BIC must be 8 or 11 characters.');
  let amt = '';
  if (String(amount).trim() !== '') {
    const n = Number(String(amount).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0.01 || n > 999999999.99) throw new Error('Amount must be between 0.01 and 999999999.99.');
    amt = `EUR${n.toFixed(2)}`;
  }
  if (reference && text) throw new Error('Use either a structured reference or a remittance text, not both.');
  if (text.length > 140) throw new Error('Remittance text: at most 140 characters.');
  const lines = ['BCD', '002', '1', 'SCT', bic.trim().toUpperCase(), name.trim(), ib, amt, purpose.trim().toUpperCase(), reference.trim(), text.trim()];
  while (lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
