// Readable formats (zxing-wasm names) and how they map onto the native BarcodeDetector API.

export const GROUPS = [
  { value: 'AllLinear', label: 'Linear (1D)' },
  { value: 'AllMatrix', label: 'Matrix / stacked (2D)' },
  { value: 'AllRetail', label: 'Retail (EAN/UPC, DataBar)' },
  { value: 'AllIndustrial', label: 'Industrial (Code 39/93/128, ITF, Telepen)' },
  { value: 'AllGS1', label: 'GS1-capable' },
];

// [zxing name, label, family]
export const FORMATS = [
  ['EAN13', 'EAN-13', 'Retail'],
  ['EAN8', 'EAN-8', 'Retail'],
  ['UPCA', 'UPC-A', 'Retail'],
  ['UPCE', 'UPC-E', 'Retail'],
  ['ISBN', 'ISBN', 'Retail'],
  ['DataBar', 'DataBar (Omni)', 'GS1 DataBar'],
  ['DataBarStk', 'DataBar Stacked', 'GS1 DataBar'],
  ['DataBarLtd', 'DataBar Limited', 'GS1 DataBar'],
  ['DataBarExp', 'DataBar Expanded', 'GS1 DataBar'],
  ['DataBarExpStk', 'DataBar Expanded Stacked', 'GS1 DataBar'],
  ['Code128', 'Code 128', 'Industrial'],
  ['Code39', 'Code 39', 'Industrial'],
  ['Code39Ext', 'Code 39 Extended', 'Industrial'],
  ['Code32', 'Code 32 (Italian pharma)', 'Industrial'],
  ['PZN', 'PZN (German pharma)', 'Industrial'],
  ['Code93', 'Code 93', 'Industrial'],
  ['ITF', 'ITF (Interleaved 2 of 5)', 'Industrial'],
  ['ITF14', 'ITF-14', 'Industrial'],
  ['Codabar', 'Codabar', 'Industrial'],
  ['Telepen', 'Telepen', 'Industrial'],
  ['DXFilmEdge', 'DX Film Edge', 'Other'],
  ['QRCode', 'QR Code', '2D'],
  ['QRCodeModel1', 'QR Code Model 1', '2D'],
  ['MicroQRCode', 'Micro QR', '2D'],
  ['RMQRCode', 'rMQR', '2D'],
  ['DataMatrix', 'Data Matrix', '2D'],
  ['Aztec', 'Aztec', '2D'],
  ['AztecRune', 'Aztec Rune', '2D'],
  ['PDF417', 'PDF417', 'Stacked'],
  ['CompactPDF417', 'Compact PDF417', 'Stacked'],
  ['MicroPDF417', 'MicroPDF417', 'Stacked'],
  ['MaxiCode', 'MaxiCode (limited)', '2D'],
];

const LABELS = Object.fromEntries(FORMATS.map(([v, l]) => [v, l]));
const EXTRA_LABELS = {
  QRCodeModel2: 'QR Code', AztecCode: 'Aztec', DataBarOmni: 'DataBar Omni', DataBarStkOmni: 'DataBar Stacked Omni',
  Code39Std: 'Code 39', TelepenAlpha: 'Telepen', TelepenNumeric: 'Telepen Numeric', EAN2: 'EAN-2', EAN5: 'EAN-5',
};
export function formatLabel(name) { return LABELS[name] || EXTRA_LABELS[name] || name; }

// zxing name -> native BarcodeDetector format
export const TO_NATIVE = {
  Aztec: 'aztec', AztecCode: 'aztec', Codabar: 'codabar', Code39: 'code_39', Code93: 'code_93', Code128: 'code_128',
  DataMatrix: 'data_matrix', EAN8: 'ean_8', EAN13: 'ean_13', ITF: 'itf', PDF417: 'pdf417',
  QRCode: 'qr_code', UPCA: 'upc_a', UPCE: 'upc_e',
};
export const FROM_NATIVE = {
  aztec: 'Aztec', codabar: 'Codabar', code_39: 'Code39', code_93: 'Code93', code_128: 'Code128',
  data_matrix: 'DataMatrix', ean_8: 'EAN8', ean_13: 'EAN13', itf: 'ITF', pdf417: 'PDF417',
  qr_code: 'QRCode', upc_a: 'UPCA', upc_e: 'UPCE',
};
const NATIVE_GROUPS = {
  '': Object.values(TO_NATIVE),
  AllLinear: ['codabar', 'code_39', 'code_93', 'code_128', 'ean_8', 'ean_13', 'itf', 'upc_a', 'upc_e'],
  AllMatrix: ['aztec', 'data_matrix', 'pdf417', 'qr_code'],
  AllRetail: ['ean_8', 'ean_13', 'upc_a', 'upc_e'],
  AllIndustrial: ['code_39', 'code_93', 'code_128', 'itf'],
  AllGS1: [], // native API cannot flag GS1 content, so leave GS1 to zxing
};

/** Native formats to ask BarcodeDetector for, given the selected format, or [] if it can't help. */
export function nativeFormatsFor(selection, supported) {
  const wanted = selection in NATIVE_GROUPS ? NATIVE_GROUPS[selection] : [TO_NATIVE[selection]].filter(Boolean);
  return [...new Set(wanted)].filter((f) => supported.includes(f));
}

/** True when the native detector covers the whole selection (single format it supports). */
export function nativeCoversSelection(selection, supported) {
  return !!TO_NATIVE[selection] && supported.includes(TO_NATIVE[selection]);
}
