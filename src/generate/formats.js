// Generator catalogue: bwip-js `bcid`s grouped by family.
// defaults: bwip options always applied (e.g. Code 93 check characters, which readers require).
// zxing: the zxing-wasm format name that should read it back (null = generate only, no browser decoder).
// kind: which per-format option group applies (qr, aztec, datamatrix, pdf417, linear, ean, other2d, postal).

export const GEN_FORMATS = [
  // Retail
  { bcid: 'ean13', label: 'EAN-13', group: 'Retail', zxing: 'EAN13', kind: 'ean', sample: '590123412345', check: 'gs1', len: [12, 13] },
  { bcid: 'ean8', label: 'EAN-8', group: 'Retail', zxing: 'EAN8', kind: 'ean', sample: '9638507', check: 'gs1', len: [7, 8] },
  { bcid: 'upca', label: 'UPC-A', group: 'Retail', zxing: 'UPCA', kind: 'ean', sample: '03600029145', check: 'gs1', len: [11, 12] },
  { bcid: 'upce', label: 'UPC-E', group: 'Retail', zxing: 'UPCE', kind: 'ean', sample: '0123456', check: 'upce', len: [7, 8] },
  { bcid: 'isbn', label: 'ISBN', group: 'Retail', zxing: 'ISBN', kind: 'ean', sample: '978-1-56581-231-4' },
  { bcid: 'issn', label: 'ISSN', group: 'Retail', zxing: 'EAN13', kind: 'ean', sample: '0311-175X 00' },
  { bcid: 'ismn', label: 'ISMN', group: 'Retail', zxing: 'EAN13', kind: 'ean', sample: '979-0-2605-3211-3' },
  { bcid: 'ean5', label: 'EAN-5 add-on', group: 'Retail', zxing: null, kind: 'linear', sample: '90200' },
  { bcid: 'ean2', label: 'EAN-2 add-on', group: 'Retail', zxing: null, kind: 'linear', sample: '05' },

  // GS1 DataBar
  { bcid: 'databaromni', label: 'DataBar Omni', group: 'GS1 DataBar', zxing: 'DataBar', kind: 'linear', sample: '(01)24012345678905' },
  { bcid: 'databarstacked', label: 'DataBar Stacked', group: 'GS1 DataBar', zxing: 'DataBarStk', kind: 'linear', sample: '(01)24012345678905' },
  { bcid: 'databarstackedomni', label: 'DataBar Stacked Omni', group: 'GS1 DataBar', zxing: 'DataBarStk', kind: 'linear', sample: '(01)24012345678905' },
  { bcid: 'databarlimited', label: 'DataBar Limited', group: 'GS1 DataBar', zxing: 'DataBarLtd', kind: 'linear', sample: '(01)15012345678907' },
  { bcid: 'databarexpanded', label: 'DataBar Expanded', group: 'GS1 DataBar', zxing: 'DataBarExp', kind: 'linear', sample: '(01)98898765432106(3202)012345(15)991231' },
  { bcid: 'databarexpandedstacked', label: 'DataBar Expanded Stacked', group: 'GS1 DataBar', zxing: 'DataBarExpStk', kind: 'linear', sample: '(01)98898765432106(3202)012345(15)991231' },

  // Industrial / 1D
  { bcid: 'code128', label: 'Code 128', group: 'Industrial 1D', zxing: 'Code128', kind: 'linear', sample: 'Barritas-128' },
  { bcid: 'gs1-128', label: 'GS1-128', group: 'Industrial 1D', zxing: 'Code128', kind: 'linear', sample: '(01)09521234543213(10)ABC123', gs1: true },
  { bcid: 'sscc18', label: 'SSCC-18', group: 'Industrial 1D', zxing: 'Code128', kind: 'linear', sample: '(00)095012345678901237' },
  { bcid: 'code39', label: 'Code 39', group: 'Industrial 1D', zxing: 'Code39', kind: 'linear', sample: 'CODE39 TEST' },
  { bcid: 'code39ext', label: 'Code 39 Extended', group: 'Industrial 1D', zxing: 'Code39Ext', kind: 'linear', sample: 'Code39 ext!' },
  { bcid: 'code32', label: 'Code 32 (Italian pharma)', group: 'Industrial 1D', zxing: 'Code32', kind: 'linear', sample: '01234567' },
  { bcid: 'pzn', label: 'PZN (German pharma)', group: 'Industrial 1D', zxing: 'PZN', kind: 'linear', sample: '1234562' },
  { bcid: 'code93', label: 'Code 93', group: 'Industrial 1D', zxing: 'Code93', kind: 'linear', sample: 'CODE93', defaults: { includecheck: true } },
  { bcid: 'code93ext', label: 'Code 93 Extended', group: 'Industrial 1D', zxing: 'Code93', kind: 'linear', sample: 'Code93 ext', defaults: { includecheck: true } },
  { bcid: 'interleaved2of5', label: 'ITF (Interleaved 2 of 5)', group: 'Industrial 1D', zxing: 'ITF', kind: 'linear', sample: '1234567890' },
  { bcid: 'itf14', label: 'ITF-14', group: 'Industrial 1D', zxing: 'ITF14', kind: 'linear', sample: '1540014128876', check: 'gs1', len: [13, 14] },
  { bcid: 'rationalizedCodabar', label: 'Codabar', group: 'Industrial 1D', zxing: 'Codabar', kind: 'linear', sample: 'A40156B' },
  { bcid: 'telepen', label: 'Telepen', group: 'Industrial 1D', zxing: 'Telepen', kind: 'linear', sample: 'Telepen' },
  { bcid: 'telepennumeric', label: 'Telepen Numeric', group: 'Industrial 1D', zxing: 'Telepen', kind: 'linear', sample: '01234567' },
  { bcid: 'code11', label: 'Code 11', group: 'Industrial 1D', zxing: null, kind: 'linear', sample: '0123456789' },
  { bcid: 'msi', label: 'MSI Plessey', group: 'Industrial 1D', zxing: null, kind: 'linear', sample: '0123456789' },
  { bcid: 'plessey', label: 'Plessey UK', group: 'Industrial 1D', zxing: null, kind: 'linear', sample: '01234ABCD' },
  { bcid: 'industrial2of5', label: 'Industrial 2 of 5', group: 'Industrial 1D', zxing: null, kind: 'linear', sample: '0123456789' },
  { bcid: 'matrix2of5', label: 'Matrix 2 of 5', group: 'Industrial 1D', zxing: null, kind: 'linear', sample: '0123456789' },
  { bcid: 'iata2of5', label: 'IATA 2 of 5', group: 'Industrial 1D', zxing: null, kind: 'linear', sample: '0123456789' },
  { bcid: 'pharmacode', label: 'Pharmacode', group: 'Industrial 1D', zxing: null, kind: 'linear', sample: '117480' },
  { bcid: 'code16k', label: 'Code 16K', group: 'Industrial 1D', zxing: null, kind: 'other2d', sample: 'Code 16K sample' },
  { bcid: 'code49', label: 'Code 49', group: 'Industrial 1D', zxing: null, kind: 'other2d', sample: 'CODE 49' },
  { bcid: 'codablockf', label: 'Codablock-F', group: 'Industrial 1D', zxing: null, kind: 'other2d', sample: 'Codablock F sample' },

  // 2D
  { bcid: 'qrcode', label: 'QR Code', group: '2D', zxing: 'QRCode', kind: 'qr', sample: 'https://retrofootprints.github.io/barritas/' },
  { bcid: 'gs1qrcode', label: 'GS1 QR Code', group: '2D', zxing: 'QRCode', kind: 'qr', sample: '(01)09521234543213(17)261231(10)ABC123', gs1: true },
  { bcid: 'microqrcode', label: 'Micro QR', group: '2D', zxing: 'MicroQRCode', kind: 'qr', sample: 'MICROQR1' },
  { bcid: 'rectangularmicroqrcode', label: 'rMQR', group: '2D', zxing: 'RMQRCode', kind: 'qr', sample: 'rMQR 12345' },
  { bcid: 'datamatrix', label: 'Data Matrix', group: '2D', zxing: 'DataMatrix', kind: 'datamatrix', sample: 'Data Matrix sample' },
  { bcid: 'datamatrixrectangular', label: 'Data Matrix (rectangular)', group: '2D', zxing: 'DataMatrix', kind: 'datamatrix', sample: 'DMRE 1234' },
  { bcid: 'gs1datamatrix', label: 'GS1 DataMatrix', group: '2D', zxing: 'DataMatrix', kind: 'datamatrix', sample: '(01)09521234543213(17)261231(10)ABC123(21)XYZ', gs1: true },
  { bcid: 'azteccode', label: 'Aztec', group: '2D', zxing: 'Aztec', kind: 'aztec', sample: 'Aztec sample text' },
  { bcid: 'azteccodecompact', label: 'Aztec (compact)', group: '2D', zxing: 'Aztec', kind: 'aztec', sample: 'Compact' },
  { bcid: 'aztecrune', label: 'Aztec Rune', group: '2D', zxing: 'AztecRune', kind: 'other2d', sample: '25' },
  { bcid: 'pdf417', label: 'PDF417', group: '2D', zxing: 'PDF417', kind: 'pdf417', sample: 'PDF417 sample text' },
  { bcid: 'pdf417compact', label: 'Compact PDF417', group: '2D', zxing: 'CompactPDF417', kind: 'pdf417', sample: 'Compact PDF417' },
  { bcid: 'micropdf417', label: 'MicroPDF417', group: '2D', zxing: 'MicroPDF417', kind: 'other2d', sample: 'MicroPDF417' },
  { bcid: 'maxicode', label: 'MaxiCode', group: '2D', zxing: 'MaxiCode', kind: 'other2d', sample: 'MaxiCode sample' },
  { bcid: 'dotcode', label: 'DotCode', group: '2D', zxing: null, kind: 'other2d', sample: 'DotCode sample' },
  { bcid: 'hanxin', label: 'Han Xin', group: '2D', zxing: null, kind: 'other2d', sample: 'Han Xin sample' },
  { bcid: 'codeone', label: 'Code One', group: '2D', zxing: null, kind: 'other2d', sample: 'Code One sample' },
  { bcid: 'ultracode', label: 'Ultracode', group: '2D', zxing: null, kind: 'other2d', sample: 'Ultracode' },

  // Postal (generate only)
  { bcid: 'onecode', label: 'USPS Intelligent Mail', group: 'Postal', zxing: null, kind: 'postal', sample: '0123456709498765432101234567891' },
  { bcid: 'postnet', label: 'USPS POSTNET', group: 'Postal', zxing: null, kind: 'postal', sample: '01234' },
  { bcid: 'planet', label: 'USPS PLANET', group: 'Postal', zxing: null, kind: 'postal', sample: '01234567890' },
  { bcid: 'royalmail', label: 'Royal Mail 4-state (RM4SCC)', group: 'Postal', zxing: null, kind: 'postal', sample: 'LE28HS9Z' },
  { bcid: 'kix', label: 'KIX (PostNL)', group: 'Postal', zxing: null, kind: 'postal', sample: '1231FZ13XHS' },
  { bcid: 'auspost', label: 'Australia Post', group: 'Postal', zxing: null, kind: 'postal', sample: '5956439111ABA 9' },
  { bcid: 'japanpost', label: 'Japan Post', group: 'Postal', zxing: null, kind: 'postal', sample: '6540123789-A-K-Z' },
];

// rMQR sizes in bwip-js; the generator picks the smallest that fits when set to auto.
export const RMQR_VERSIONS = [7, 9, 11, 13, 15, 17]
  .flatMap((r) => [27, 43, 59, 77, 99, 139].map((c) => [r, c]))
  .filter(([r, c]) => !(c === 27 && r !== 11 && r !== 13))
  .sort((a, b) => a[0] * a[1] - b[0] * b[1])
  .map(([r, c]) => `R${r}x${c}`);

export const BY_BCID = Object.fromEntries(GEN_FORMATS.map((f) => [f.bcid, f]));

/** GS1 mod-10 check digit for a string of digits (without the check digit). */
export function gs1CheckDigit(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = digits.charCodeAt(digits.length - 1 - i) - 48;
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return String((10 - (sum % 10)) % 10);
}

/** Expand UPC-E (number system + 6 digits) to UPC-A without check digit. */
export function upceToUpca(s7) {
  const ns = s7[0];
  const d = s7.slice(1);
  const last = d[5];
  let body;
  if ('012'.includes(last)) body = `${d.slice(0, 2)}${last}0000${d.slice(2, 5)}`;
  else if (last === '3') body = `${d.slice(0, 3)}00000${d.slice(3, 5)}`;
  else if (last === '4') body = `${d.slice(0, 4)}00000${d[4]}`;
  else body = `${d.slice(0, 5)}0000${last}`;
  return ns + body;
}

/**
 * Apply/validate check digits for EAN/UPC/ITF-14.
 * Returns { text, info?, error? } — text is the full data including the check digit.
 */
export function applyCheckDigit(fmt, raw) {
  if (!fmt.check) return { text: raw };
  const s = raw.replace(/\s+/g, '');
  if (!/^\d+$/.test(s)) return { text: raw, error: `${fmt.label} takes digits only.` };
  const [short, full] = fmt.len;
  if (fmt.check === 'upce' && s.length === short && !/^[01]/.test(s)) {
    return { text: raw, error: 'UPC-E must start with number system 0 or 1.' };
  }
  const calc = (body) => (fmt.check === 'upce' ? gs1CheckDigit(upceToUpca(body)) : gs1CheckDigit(body));
  if (s.length === short) {
    const c = calc(s);
    return { text: s + c, info: `Check digit ${c} added.` };
  }
  if (s.length === full) {
    const c = calc(s.slice(0, -1));
    if (c !== s.slice(-1)) return { text: s, error: `Wrong check digit: expected ${c}, got ${s.slice(-1)}.` };
    return { text: s };
  }
  return { text: s, error: `${fmt.label} needs ${short} digits (check digit added for you) or ${full} digits.` };
}

/** Normalise text for round-trip comparison (GS1 parentheses / FNC1, spaces, dashes, case). */
export function normaliseForCompare(s) {
  return String(s).replace(/^\][A-Za-z]\d/, '').replace(/[()\s\-\x1d]/g, '').toUpperCase();
}

/** Acceptable normalised read-back texts for the given input (UPC-A/UPC-E also have EAN-13 forms). */
export function expectedForms(bcid, text) {
  const n = normaliseForCompare(text);
  const forms = new Set([n]);
  if (bcid === 'upca' && /^\d{12}$/.test(n)) forms.add(`0${n}`);
  if (bcid === 'upce' && /^\d{8}$/.test(n)) {
    const a = upceToUpca(n.slice(0, 7));
    forms.add(a + n[7]);
    forms.add(`0${a}${n[7]}`);
  }
  return forms;
}
