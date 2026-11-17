// AAMVA DL/ID card design standard (US / Canada driver licences, PDF417 on the back).
// "@\n\x1e\rANSI " + IIN(6) + version(2) + jurisdiction version(2) + entries(2) + designators, then subfiles
// "DL" / "ID" made of 3-letter element IDs followed by data, separated by LF.

const ELEMENTS = {
  DCA: 'Vehicle class', DCB: 'Restrictions', DCD: 'Endorsements', DBA: 'Expiry date', DCS: 'Family name',
  DAC: 'First name', DAD: 'Middle name(s)', DBD: 'Issue date', DBB: 'Date of birth', DBC: 'Sex', DAY: 'Eye colour',
  DAU: 'Height', DAG: 'Street', DAH: 'Street 2', DAI: 'City', DAJ: 'State / province', DAK: 'Postal code',
  DAQ: 'Licence / ID number', DCF: 'Document discriminator', DCG: 'Country', DDE: 'Family name truncated',
  DDF: 'First name truncated', DDG: 'Middle name truncated', DAZ: 'Hair colour', DCI: 'Place of birth',
  DCJ: 'Audit information', DCK: 'Inventory control number', DBN: 'Alias family name', DBG: 'Alias given name',
  DBS: 'Alias suffix', DCU: 'Name suffix', DCE: 'Weight range', DCL: 'Race / ethnicity', DCM: 'Standard vehicle class',
  DCN: 'Standard endorsement code', DCO: 'Standard restriction code', DCP: 'Vehicle class description',
  DCQ: 'Endorsement description', DCR: 'Restriction description', DDA: 'Compliance type', DDB: 'Card revision date',
  DDC: 'HAZMAT endorsement expiry', DDD: 'Limited duration document', DAW: 'Weight (lb)', DAX: 'Weight (kg)',
  DDH: 'Under 18 until', DDI: 'Under 19 until', DDJ: 'Under 21 until', DDK: 'Organ donor', DDL: 'Veteran',
  DAA: 'Full name', DCT: 'Given names', DAB: 'Family name', DAE: 'Name suffix', DAF: 'Name prefix',
};
const DATE_ELEMENTS = new Set(['DBA', 'DBD', 'DBB', 'DDB', 'DDC', 'DDH', 'DDI', 'DDJ']);
const SEX = { 1: 'Male', 2: 'Female', 9: 'Not specified', M: 'Male', F: 'Female', X: 'Not specified' };
const TRUNC = { T: 'truncated', N: 'not truncated', U: 'unknown' };
// Element order for display; anything else follows.
const ORDER = ['DCS', 'DAC', 'DAD', 'DCU', 'DAA', 'DCT', 'DBB', 'DBC', 'DAQ', 'DBD', 'DBA', 'DCA', 'DCB', 'DCD', 'DAG', 'DAH', 'DAI', 'DAJ', 'DAK', 'DCG', 'DAU', 'DAW', 'DAY', 'DAZ', 'DDA', 'DDK', 'DDL'];

function fmtDate(v, country, version) {
  if (!/^\d{8}$/.test(v)) return v;
  // Version 1 and Canadian cards use CCYYMMDD; US cards (version ≥ 2) use MMDDCCYY.
  const ccyyFirst = version === 1 || country === 'CAN' || (/^(19|20)\d{2}/.test(v) && Number(v.slice(4, 6)) <= 12 && !/^(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(19|20)/.test(v));
  const [y, m, d] = ccyyFirst ? [v.slice(0, 4), v.slice(4, 6), v.slice(6, 8)] : [v.slice(4, 8), v.slice(0, 2), v.slice(2, 4)];
  return `${y}-${m}-${d}`;
}

export function parseAamva(text) {
  if (!/^@[\s\S]{0,6}(ANSI |AAMVA)/.test(text)) return null;
  const head = text.match(/(?:ANSI |AAMVA)(\d{6})(\d{2})(\d{2})?(\d{2})?/);
  const iin = head?.[1] || '';
  const version = head ? Number(head[2]) : null;
  // The first subfile starts at "DL" or "ID" followed by an element ID (e.g. "DLDAQ…").
  const start = text.search(/(DL|ID)(?=D[A-Z]{2})/);
  const body = start >= 0 ? text.slice(start + 2) : text;
  const elements = {};
  for (let line of body.split(/[\n\r\x1e]+/)) {
    line = line.replace(/^(DL|ID|Z[A-Z])(?=[A-Z]{3})/, '');
    const m = line.match(/^([A-Z]{3})(.*)$/);
    if (m && (m[1].startsWith('D') || m[1].startsWith('Z')) && !(m[1] in elements)) elements[m[1]] = m[2].trim();
  }
  if (!Object.keys(elements).length) return null;
  return { iin, version, jurisdictionVersion: head?.[3] ? Number(head[3]) : null, type: start >= 0 ? text.slice(start, start + 2) : '', elements };
}

export function interpretAamva(text) {
  const p = parseAamva(text);
  if (!p) return null;
  const e = p.elements;
  const country = e.DCG;
  const value = (id, v) => {
    if (DATE_ELEMENTS.has(id)) return fmtDate(v, country, p.version);
    if (id === 'DBC') return SEX[v] || v;
    if (/^DD[EFG]$/.test(id)) return TRUNC[v] || v;
    if (id === 'DDA') return { F: 'Fully compliant (REAL ID)', N: 'Non-compliant' }[v] || v;
    if (id === 'DDK' || id === 'DDL') return v === '1' ? 'yes' : v;
    return v;
  };
  const ids = [...ORDER.filter((id) => id in e), ...Object.keys(e).filter((id) => !ORDER.includes(id))];
  const fields = ids.map((id) => [`${ELEMENTS[id] || 'Jurisdiction field'} (${id})`, value(id, e[id])]);
  const name = [e.DAC || e.DCT, e.DAD, e.DCS].filter(Boolean).join(' ') || e.DAA;
  return {
    title: `${p.type === 'ID' ? 'ID card' : 'Driver licence'} (AAMVA)`,
    summary: [name, e.DAJ].filter(Boolean).join(' · '),
    fields: [['Issuer IIN', p.iin], ['AAMVA version', p.version], ...fields],
    warnings: ['Contains personal data. It is processed on this device only.'],
  };
}
