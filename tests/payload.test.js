// Payload parser unit tests: `node --test tests/` (no dependencies).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { interpret } from '../src/payload/index.js';
import { parseBcbp, julianToDate } from '../src/payload/bcbp.js';
import { parseHri, parseRaw, parseDigitalLink, gs1Date, interpretGs1 } from '../src/payload/gs1.js';
import { parseWifi } from '../src/payload/wifi.js';
import { parseVCard } from '../src/payload/vcard.js';
import { parseMeCard } from '../src/payload/mecard.js';
import { parseEpc, ibanOk } from '../src/payload/epc.js';
import { parseAtQr, nifValid, interpretAtQr } from '../src/payload/pt-at.js';
import { parseAamva, interpretAamva } from '../src/payload/aamva.js';
import { parseGeo } from '../src/payload/geo.js';
import { interpretUrl } from '../src/payload/url.js';
import { buildWifi, buildVCard, buildBcbp, buildEpc, buildGs1 } from '../src/generate/templates.js';

const field = (view, label) => view.fields.find(([k]) => k.startsWith(label))?.[1];

// ---------- IATA BCBP ----------

test('BCBP: single leg (IATA Resolution 792 example)', () => {
  const p = parseBcbp('M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 326J001A0025 100');
  assert.equal(p.name, 'DESMARAIS/LUC');
  assert.equal(p.eticket, true);
  assert.equal(p.legs.length, 1);
  assert.deepEqual(
    { ...p.legs[0] },
    { pnr: 'ABC123', from: 'YUL', to: 'FRA', carrier: 'AC', flight: '834', julian: '326', compartment: 'J', seat: '1A', sequence: '25', status: '1' },
  );
  assert.deepEqual(p.warnings, []);
});

test('BCBP: multi-leg with conditional items and security data', () => {
  const pad = (s, n) => s.padEnd(n, ' ');
  const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');
  const unique = '1WW6225BAC ';
  const rep1 = `014${'1234567890'}10AC AC ${pad('1234567890123', 16)}020KN`;
  const rep2 = `014${'0987654321'}00LH LH ${pad('987654', 16)}01PCY`;
  assert.equal(rep1.length, 42);
  const var1 = `>6${hex2(unique.length)}${unique}${hex2(rep1.length)}${rep1}LX58Z`;
  const var2 = `${hex2(rep2.length)}${rep2}`;
  const sec = 'S'.repeat(100);
  const text = `M2${pad('DESMARAIS/LUC', 20)}E`
    + `ABC123 YULFRAAC 0834 326J001A0025 1${hex2(var1.length)}${var1}`
    + `DEF456 FRAGVALH 3664 327C012C0002 1${hex2(var2.length)}${var2}`
    + `^1${hex2(sec.length)}${sec}`;
  const p = parseBcbp(text);
  assert.equal(p.legs.length, 2);
  assert.equal(p.version, '6');
  assert.equal(p.unique.checkinSource, 'W');
  assert.equal(p.unique.issuer, 'AC');
  assert.equal(p.legs[0].conditional.frequentFlyerNumber, '1234567890123');
  assert.equal(p.legs[0].conditional.freeBaggage, '20K');
  assert.equal(p.legs[0].airlineUse, 'LX58Z');
  assert.deepEqual([p.legs[1].from, p.legs[1].to, p.legs[1].carrier, p.legs[1].flight, p.legs[1].seat], ['FRA', 'GVA', 'LH', '3664', '12C']);
  assert.equal(p.legs[1].conditional.marketingCarrier, 'LH');
  assert.equal(p.security.length, 100);
  assert.deepEqual(p.warnings, []);
  const view = interpret(text);
  assert.equal(view.type, 'bcbp');
  assert.equal(view.sections.length, 3);
});

test('BCBP: builder round-trip and Julian dates', () => {
  const s = buildBcbp({ lastName: 'Sample', firstName: 'Alex', pnr: 'XYZ789', from: 'LIS', to: 'OPO', carrier: 'TP', flight: '1944', date: '2026-03-01', cabin: 'Y', seat: '12C', sequence: '42' });
  const p = parseBcbp(s);
  assert.equal(p.legs[0].julian, '060');
  assert.equal(p.legs[0].flight, '1944');
  assert.equal(p.legs[0].seat, '12C');
  assert.equal(p.legs[0].sequence, '42');
  assert.equal(julianToDate('060', new Date(Date.UTC(2026, 5, 1))).toISOString().slice(0, 10), '2026-03-01');
  assert.equal(parseBcbp('M1 too short'), null);
});

// ---------- GS1 ----------

test('GS1: HRI element string', () => {
  const items = parseHri('(01)09521234543213(17)261231(10)ABC123');
  assert.deepEqual(items, [{ ai: '01', value: '09521234543213' }, { ai: '17', value: '261231' }, { ai: '10', value: 'ABC123' }]);
  const v = interpretGs1('(01)09521234543213(17)261231(3103)001500(10)ABC123');
  assert.match(field(v, '(01)'), /check digit OK/);
  assert.equal(field(v, '(17)'), '2026-12-31');
  assert.equal(field(v, '(3103)'), '1.500');
});

test('GS1: raw with symbology identifier and GS separators', () => {
  assert.deepEqual(parseRaw(']C101095212345432131726123110ABC123\x1d21XYZ'), [
    { ai: '01', value: '09521234543213' }, { ai: '17', value: '261231' }, { ai: '10', value: 'ABC123' }, { ai: '21', value: 'XYZ' },
  ]);
  assert.deepEqual(parseRaw('010952123454321310ABC\x1d3103001500\x1d400PO-77'), [
    { ai: '01', value: '09521234543213' }, { ai: '10', value: 'ABC' }, { ai: '3103', value: '001500' }, { ai: '400', value: 'PO-77' },
  ]);
  assert.equal(parseRaw('hello'), null);
  // zxing reports GS1 content via the symbology identifier
  assert.ok(interpretGs1('0109521234543213', { symbologyIdentifier: ']d2' }));
});

test('GS1: Digital Link and dates', () => {
  assert.deepEqual(parseDigitalLink('https://id.gs1.org/01/09521234543213/10/ABC?17=261231'), [
    { ai: '01', value: '09521234543213' }, { ai: '10', value: 'ABC' }, { ai: '17', value: '261231' },
  ]);
  assert.equal(interpret('https://id.gs1.org/01/09521234543213').type, 'gs1');
  assert.equal(gs1Date('260200', new Date(Date.UTC(2026, 0, 1))), '2026-02-28 (end of month)');
  assert.equal(gs1Date('991231', new Date(Date.UTC(2026, 0, 1))), '1999-12-31');
});

test('GS1: builder output parses back', () => {
  const s = buildGs1([{ ai: '10', value: 'LOT1' }, { ai: '01', value: '0952123454321' }, { ai: '17', value: '2027-01-31' }]);
  assert.deepEqual(parseHri(s).map((i) => i.ai), ['01', '17', '10']);
});

// ---------- Wi-Fi, vCard, MeCard ----------

test('Wi-Fi: escapes and fields', () => {
  assert.deepEqual(parseWifi('WIFI:T:WPA;S:My\\;Net;P:p\\:a\\\\ss;H:true;;'), {
    ssid: 'My;Net', security: 'WPA', password: 'p:a\\ss', hidden: true, eap: undefined, identity: undefined, anonymousIdentity: undefined, phase2: undefined,
  });
  const w = { ssid: 'Café "5G", 2.4', password: 'a;b:c\\d,e', security: 'WPA', hidden: false };
  const p = parseWifi(buildWifi(w));
  assert.equal(p.ssid, w.ssid);
  assert.equal(p.password, w.password);
  assert.equal(parseWifi('WIFI:T:nopass;S:Open;;').security, 'nopass');
});

test('vCard: builder round-trip and folded lines', () => {
  const v = parseVCard(buildVCard({ first: 'Ana', last: 'Silva', org: 'ACME; Lda', phone: '+351 912 345 678', email: 'ana@example.pt', street: 'Rua A, 1', city: 'Lisboa', zip: '1000-001', country: 'Portugal' }));
  assert.equal(v.fn, 'Ana Silva');
  assert.equal(v.org, 'ACME; Lda');
  assert.equal(v.tel[0].value, '+351 912 345 678');
  assert.equal(v.adr[0].parts[2], 'Rua A, 1');
  const folded = parseVCard('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Very Long\r\n  Name\r\nNOTE:line1\\nline2\r\nEND:VCARD');
  assert.equal(folded.fn, 'Very Long Name');
  assert.equal(folded.note, 'line1\nline2');
});

test('MeCard', () => {
  const c = parseMeCard('MECARD:N:Doe,John;TEL:+351912345678;EMAIL:john@example.com;NOTE:a\\;b;;');
  assert.equal(c.name, 'John Doe');
  assert.deepEqual(c.tel, ['+351912345678']);
  assert.equal(c.note, 'a;b');
});

// ---------- payments / invoices ----------

test('EPC: spec example and builder round-trip', () => {
  const p = parseEpc('BCD\n001\n1\nSCT\nBPOTBEB1\nRed Cross\nBE72000000001616\nEUR1\nCHAR\n\nUrgency fund\nSample EPC QR code');
  assert.equal(p.name, 'Red Cross');
  assert.equal(p.amount, 1);
  assert.equal(p.remittance, 'Urgency fund');
  assert.ok(ibanOk(p.iban));
  assert.ok(!ibanOk('BE72000000001617'));
  const b = parseEpc(buildEpc({ name: 'Cruz Vermelha', iban: 'PT50 0002 0123 1234 5678 9015 4', amount: '12,5', text: 'Donativo' }));
  assert.equal(b.iban, 'PT50000201231234567890154');
  assert.equal(b.amount, 12.5);
  assert.equal(interpret('BCD\n002\n1\nSCT\n\nX\nBE72000000001616').type, 'epc');
});

test('Portuguese AT invoice QR', () => {
  const s = 'A:123456789*B:999999990*C:PT*D:FS*E:N*F:20231115*G:FS 1/1234*H:CSDF7T5H-1234*I1:PT*I7:10.00*I8:2.30*N:2.30*O:12.30*Q:ABCD*R:9999';
  const f = parseAtQr(s);
  assert.equal(f.H, 'CSDF7T5H-1234');
  assert.ok(nifValid('123456789'));
  assert.ok(!nifValid('123456780'));
  const v = interpretAtQr(s);
  assert.equal(field(v, 'Document date'), '2023-11-15');
  assert.match(field(v, 'Document type'), /Simplified invoice/);
  assert.equal(field(v, 'Total with taxes'), '12.30 €');
  assert.match(field(v, 'Buyer tax number'), /final consumer/);
});

// ---------- AAMVA ----------

const AAMVA = '@\n\x1e\rANSI 636014080102DL00410278ZC03190008DLDAQD1234562\nDCSPUBLIC\nDDEN\nDACJOHN\nDDFN\nDADQ\nDDGN\nDCAC\nDCBNONE\nDCDNONE\nDBD08292015\nDBB01311970\nDBA01312025\nDBC1\nDAU069 in\nDAYBRO\nDAG2570 24TH STREET\nDAIANYTOWN\nDAJCA\nDAK958220000  \nDCF83D9BN217QO983B1\nDCGUSA\nDAW180\nDDAF\nDDB10302012\nDDK1\r';

test('AAMVA driver licence', () => {
  const p = parseAamva(AAMVA);
  assert.equal(p.iin, '636014');
  assert.equal(p.version, 8);
  assert.equal(p.elements.DAQ, 'D1234562');
  assert.equal(p.elements.DCS, 'PUBLIC');
  const v = interpretAamva(AAMVA);
  assert.equal(field(v, 'Date of birth'), '1970-01-31');
  assert.equal(field(v, 'Sex'), 'Male');
  assert.equal(field(v, 'Compliance'), 'Fully compliant (REAL ID)');
  assert.equal(v.summary, 'JOHN Q PUBLIC · CA');
  assert.equal(interpret(AAMVA).type, 'aamva');
});

// ---------- URIs ----------

test('URLs and URI schemes', () => {
  assert.ok(interpretUrl('https://xn--pple-43d.com/login').warnings.some((w) => /International/.test(w)));
  assert.ok(interpretUrl('http://bit.ly/abc').warnings.length >= 2);
  assert.equal(interpretUrl('https://example.com/').warnings.length, 0);
  assert.equal(field(interpretUrl('mailto:a@b.com?subject=Hi'), 'Subject'), 'Hi');
  assert.equal(interpretUrl('tel:+351210000000').summary, '+351210000000');
  assert.equal(field(interpretUrl('SMSTO:+351912345678:hello there'), 'Message'), 'hello there');
  const otp = interpretUrl('otpauth://totp/ACME:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ACME');
  assert.equal(field(otp, 'Issuer'), 'ACME');
  assert.equal(field(otp, 'Account'), 'alice@example.com');
  assert.deepEqual(parseGeo('geo:38.7223,-9.1393?q=Lisboa'), { lat: 38.7223, lon: -9.1393, alt: null, uncertainty: null, query: 'Lisboa' });
  assert.equal(parseGeo('geo:91,0'), null);
});

test('Dispatcher: plain text is not interpreted', () => {
  assert.equal(interpret('hello world'), null);
  assert.equal(interpret(''), null);
  assert.equal(interpret({ text: 'WIFI:S:x;;' }).type, 'wifi');
});

test('zxing HRI control tokens are rebuilt from the raw bytes', async () => {
  const { textWithControls } = await import('../src/scan/engine.js');
  const raw = '@\n\x1e\rANSI 6360140801';
  const bytes = new TextEncoder().encode(raw);
  assert.equal(textWithControls('@<LF><RS><CR>ANSI 6360140801', bytes), raw);
  assert.equal(textWithControls('(01)09521234543213', new Uint8Array()), '(01)09521234543213');
});
