// Portuguese invoice QR code (Autoridade Tributária, Portaria 195/2020): fields "X:value" separated by "*".
// A:NIF emitente*B:NIF adquirente*C:país*D:tipo*E:estado*F:data*G:id documento*H:ATCUD*I1:…*N:…*O:…*Q:hash*R:certificado

const LABELS = {
  A: 'Seller tax number (NIF do emitente)',
  B: 'Buyer tax number (NIF do adquirente)',
  C: 'Buyer country (país do adquirente)',
  D: 'Document type (tipo de documento)',
  E: 'Document status (estado)',
  F: 'Document date (data)',
  G: 'Document number (identificação única)',
  H: 'ATCUD',
  L: 'Not subject to VAT (não sujeito / não tributável)',
  M: 'Stamp duty (imposto do selo)',
  N: 'Total taxes (total de impostos)',
  O: 'Total with taxes (total do documento)',
  P: 'Withholding tax (retenção na fonte)',
  Q: 'Hash (4 characters)',
  R: 'Software certificate no. (nº do certificado)',
  S: 'Other information (outras informações)',
};
// I, J, K: three fiscal regions with the same sub-fields.
const REGION_FIELDS = {
  1: 'Fiscal region (espaço fiscal)',
  2: 'VAT-exempt base (base isenta)',
  3: 'Reduced-rate base (base taxa reduzida)',
  4: 'Reduced-rate VAT (IVA taxa reduzida)',
  5: 'Intermediate-rate base (base taxa intermédia)',
  6: 'Intermediate-rate VAT (IVA taxa intermédia)',
  7: 'Standard-rate base (base taxa normal)',
  8: 'Standard-rate VAT (IVA taxa normal)',
};
const DOC_TYPES = {
  FT: 'Invoice (fatura)', FS: 'Simplified invoice (fatura simplificada)', FR: 'Invoice-receipt (fatura-recibo)',
  ND: 'Debit note (nota de débito)', NC: 'Credit note (nota de crédito)', RG: 'Receipt (recibo)',
  GR: 'Delivery note (guia de remessa)', GT: 'Transport note (guia de transporte)', GA: 'Own fixed-asset movement guide',
  GC: 'Consignment note (guia de consignação)', GD: 'Return note (guia de devolução)', OR: 'Quote (orçamento)',
  PF: 'Pro-forma invoice', CM: 'Table consultation (consulta de mesa)', NE: 'Order note (nota de encomenda)',
  FO: 'Work sheet (folha de obra)', OU: 'Other (outros)', CC: 'Consignment credit note', CS: 'Co-insurance imputation',
  LC: 'Co-insurer debit note', RC: 'VAT cash receipt (recibo IVA de caixa)', RA: 'Leader co-insurer note', RE: 'Receipt (other)',
  RP: 'Premium receipt', RM: 'Receipt (insurance)', CO: 'Co-insurance',
};
const STATUS = { N: 'Normal', A: 'Cancelled (anulado)', F: 'Invoiced (faturado)', S: 'Self-billing (autofaturação)', T: 'Transport doc. invoiced', R: 'Summary document' };

export function nifValid(nif) {
  if (!/^\d{9}$/.test(nif)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(nif[i]) * (9 - i);
  const check = 11 - (sum % 11);
  return (check >= 10 ? 0 : check) === Number(nif[8]);
}

export function parseAtQr(text) {
  if (!/^A:\d{9}\*B:/.test(text.trim())) return null;
  const fields = {};
  for (const part of text.trim().split('*')) {
    const i = part.indexOf(':');
    if (i < 1) continue;
    fields[part.slice(0, i)] = part.slice(i + 1);
  }
  return fields;
}

const eur = (v) => (/^-?\d+(\.\d+)?$/.test(v) ? `${Number(v).toFixed(2)} €` : v);

export function interpretAtQr(text) {
  const f = parseAtQr(text);
  if (!f) return null;
  const warnings = [];
  const out = [];
  for (const [k, v] of Object.entries(f)) {
    let label = LABELS[k];
    let value = v;
    const rm = k.match(/^([IJK])([1-8])$/);
    if (rm) label = `${REGION_FIELDS[rm[2]]}${rm[1] !== 'I' ? ` — region ${rm[1]}` : ''}`;
    if (!label) label = k;
    if (k === 'A' || (k === 'B' && v !== '999999990')) value = `${v} ${nifValid(v) ? '(valid)' : '(check digit WRONG)'}`;
    if (k === 'B' && v === '999999990') value = `${v} (final consumer / consumidor final)`;
    if (k === 'D') value = DOC_TYPES[v] ? `${v} – ${DOC_TYPES[v]}` : v;
    if (k === 'E') value = STATUS[v] ? `${v} – ${STATUS[v]}` : v;
    if (k === 'F' && /^\d{8}$/.test(v)) value = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}`;
    if (/^([IJK][2-8]|[LMNOP])$/.test(k)) value = eur(v);
    out.push([label, value]);
  }
  if (f.A && !nifValid(f.A)) warnings.push('Seller tax number has an invalid check digit.');
  return {
    title: 'Portuguese invoice (AT QR code)',
    summary: [f.D, f.G, f.O ? eur(f.O) : ''].filter(Boolean).join(' · '),
    fields: out,
    warnings,
  };
}
