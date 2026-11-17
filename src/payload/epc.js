// EPC069-12 "SEPA credit transfer" QR (a.k.a. GiroCode). Lines:
// BCD / version / charset / SCT|INST / BIC / name / IBAN / EURamount / purpose / structured ref / text / info

const CHARSETS = { 1: 'UTF-8', 2: 'ISO 8859-1', 3: 'ISO 8859-2', 4: 'ISO 8859-4', 5: 'ISO 8859-5', 6: 'ISO 8859-7', 7: 'ISO 8859-10', 8: 'ISO 8859-15' };

export function ibanOk(iban) {
  const s = String(iban).replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  let rem = 0;
  for (const ch of s.slice(4) + s.slice(0, 4)) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

const groupIban = (s) => s.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

export function parseEpc(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== 'BCD' || lines.length < 7) return null;
  const [, version, charset, ident, bic, name, iban, amount, purpose, reference, remittance, info] = lines.map((l) => (l ?? '').trim());
  const amt = (amount || '').match(/^([A-Z]{3})(\d+(?:\.\d{1,2})?)$/);
  return { version, charset, ident, bic, name, iban, currency: amt?.[1] || '', amount: amt ? Number(amt[2]) : null, rawAmount: amount, purpose, reference, remittance, info };
}

export function interpretEpc(text) {
  const p = parseEpc(text);
  if (!p) return null;
  const warnings = [];
  if (!ibanOk(p.iban)) warnings.push('The IBAN check digits are not valid.');
  if (p.rawAmount && p.amount === null) warnings.push(`Unrecognised amount “${p.rawAmount}”.`);
  if (!['001', '002'].includes(p.version)) warnings.push(`Unknown EPC version “${p.version}”.`);
  return {
    title: 'SEPA payment (EPC QR)',
    summary: `${p.amount !== null ? `${p.currency} ${p.amount.toFixed(2)} → ` : ''}${p.name}`,
    fields: [
      ['Beneficiary', p.name],
      ['IBAN', `${groupIban(p.iban)} ${ibanOk(p.iban) ? '(valid)' : '(INVALID)'}`],
      ['BIC', p.bic],
      ['Amount', p.amount !== null ? `${p.currency} ${p.amount.toFixed(2)}` : '(not set)'],
      ['Purpose code', p.purpose],
      ['Structured reference', p.reference],
      ['Remittance text', p.remittance],
      ['Information', p.info],
      ['Transfer type', p.ident === 'INST' ? 'SEPA Instant' : p.ident === 'SCT' ? 'SEPA credit transfer' : p.ident],
      ['Version / charset', `${p.version} / ${CHARSETS[p.charset] || p.charset}`],
    ],
    warnings,
  };
}
