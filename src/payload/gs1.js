// GS1 Application Identifiers: element strings in HRI form "(01)…(10)…", raw form with FNC1/GS
// separators (optionally prefixed by a symbology identifier ]C1 ]e0 ]d2 ]Q3 ]J1), and GS1 Digital Link URIs.

const GS = '\x1d';

// AI → [title, kind]. kind: date | n (numeric) | gtin | an | dec (decimal, last AI digit = decimals) | country | gln
const AIS = {
  '00': ['SSCC (serial shipping container code)', 'gtin'],
  '01': ['GTIN', 'gtin'],
  '02': ['GTIN of contained trade items', 'gtin'],
  '03': ['GTIN of trade items (MTO)', 'gtin'],
  '10': ['Batch / lot', 'an'],
  '11': ['Production date', 'date'],
  '12': ['Due date', 'date'],
  '13': ['Packaging date', 'date'],
  '15': ['Best before', 'date'],
  '16': ['Sell by', 'date'],
  '17': ['Expiry date', 'date'],
  '20': ['Internal product variant', 'n'],
  '21': ['Serial number', 'an'],
  '22': ['Consumer product variant', 'an'],
  '235': ['Third-party controlled serialised extension', 'an'],
  '240': ['Additional product identification', 'an'],
  '241': ['Customer part number', 'an'],
  '242': ['Made-to-order variation number', 'n'],
  '243': ['Packaging component number', 'an'],
  '250': ['Secondary serial number', 'an'],
  '251': ['Reference to source entity', 'an'],
  '253': ['Global Document Type Identifier (GDTI)', 'an'],
  '254': ['GLN extension component', 'an'],
  '255': ['Global Coupon Number (GCN)', 'n'],
  '30': ['Variable count', 'n'],
  '37': ['Count of trade items', 'n'],
  '400': ["Customer's purchase order number", 'an'],
  '401': ['Global Identification Number for Consignment (GINC)', 'an'],
  '402': ['Global Shipment Identification Number (GSIN)', 'n'],
  '403': ['Routing code', 'an'],
  '410': ['Ship to / deliver to GLN', 'gln'],
  '411': ['Bill to / invoice to GLN', 'gln'],
  '412': ['Purchased from GLN', 'gln'],
  '413': ['Ship for / deliver for GLN', 'gln'],
  '414': ['Physical location GLN', 'gln'],
  '415': ['Invoicing party GLN', 'gln'],
  '416': ['Production or service location GLN', 'gln'],
  '417': ['Party GLN', 'gln'],
  '420': ['Ship to postal code', 'an'],
  '421': ['Ship to postal code with country', 'an'],
  '422': ['Country of origin', 'country'],
  '423': ['Country of initial processing', 'an'],
  '424': ['Country of processing', 'country'],
  '425': ['Country of disassembly', 'an'],
  '426': ['Country covering full process chain', 'country'],
  '427': ['Country subdivision of origin', 'an'],
  '7001': ['NATO Stock Number', 'n'],
  '7002': ['UN/ECE meat carcass classification', 'an'],
  '7003': ['Expiration date and time', 'n'],
  '7004': ['Active potency', 'n'],
  '7005': ['Catch area', 'an'],
  '7006': ['First freeze date', 'date'],
  '7007': ['Harvest date', 'an'],
  '7008': ['Species for fishery purposes', 'an'],
  '7009': ['Fishing gear type', 'an'],
  '7010': ['Production method', 'an'],
  '7240': ['Protocol ID', 'an'],
  '8001': ['Roll products (width, length, diameter, direction, splices)', 'n'],
  '8002': ['Cellular mobile telephone identifier', 'an'],
  '8003': ['Global Returnable Asset Identifier (GRAI)', 'an'],
  '8004': ['Global Individual Asset Identifier (GIAI)', 'an'],
  '8005': ['Price per unit of measure', 'n'],
  '8006': ['Identification of an individual trade item piece (ITIP)', 'n'],
  '8007': ['IBAN', 'an'],
  '8008': ['Date and time of production', 'n'],
  '8009': ['Optically readable sensor indicator', 'an'],
  '8010': ['Component / part identifier (CPID)', 'an'],
  '8011': ['CPID serial number', 'n'],
  '8012': ['Software version', 'an'],
  '8013': ['Global Model Number (GMN)', 'an'],
  '8017': ['GSRN – provider', 'n'],
  '8018': ['GSRN – recipient', 'n'],
  '8019': ['Service Relation Instance Number (SRIN)', 'n'],
  '8020': ['Payment slip reference number', 'an'],
  '8026': ['ITIP of contained trade items', 'n'],
  '8200': ['Extended packaging URL', 'an'],
  '90': ['Information mutually agreed between trading partners', 'an'],
};
for (let i = 91; i <= 99; i++) AIS[String(i)] = ['Company internal information', 'an'];

// 4-digit AIs with an implied decimal point (last digit = number of decimals).
const DECIMAL = {
  '310': 'Net weight (kg)', '311': 'Length (m)', '312': 'Width (m)', '313': 'Height (m)', '314': 'Area (m²)',
  '315': 'Net volume (l)', '316': 'Net volume (m³)', '320': 'Net weight (lb)', '321': 'Length (in)', '322': 'Length (ft)',
  '323': 'Length (yd)', '324': 'Width (in)', '325': 'Width (ft)', '326': 'Width (yd)', '327': 'Height (in)', '328': 'Height (ft)',
  '329': 'Height (yd)', '330': 'Gross weight (kg)', '331': 'Length, logistics (m)', '332': 'Width, logistics (m)',
  '333': 'Height, logistics (m)', '334': 'Area, logistics (m²)', '335': 'Gross volume (l)', '336': 'Gross volume (m³)',
  '340': 'Gross weight (lb)', '350': 'Area (in²)', '351': 'Area (ft²)', '352': 'Area (yd²)', '356': 'Net weight (troy oz)',
  '357': 'Net volume (oz)', '360': 'Net volume (qt)', '361': 'Net volume (gal)', '364': 'Net volume (in³)',
  '365': 'Net volume (ft³)', '366': 'Net volume (yd³)', '390': 'Amount payable (local currency)',
  '391': 'Amount payable (with ISO currency)', '392': 'Amount payable, single monetary area', '393': 'Amount payable (with ISO currency)',
  '394': 'Percentage discount of a coupon', '395': 'Amount payable per unit',
};

// Predefined total lengths (AI + data) by the AI's first two digits: these never need a GS separator.
const PREDEFINED = { '00': 20, '01': 16, '02': 16, '03': 16, '04': 18, '11': 8, '12': 8, '13': 8, '14': 8, '15': 8, '16': 8, '17': 8, '18': 8, '19': 8, '20': 4, '31': 10, '32': 10, '33': 10, '34': 10, '35': 10, '36': 10, '41': 16 };

/** Resolve the AI at the start of `s`: returns { ai, title, kind, decimals? } or null. */
export function aiInfo(s) {
  const d4 = s.slice(0, 4);
  const d3 = s.slice(0, 3);
  const d2 = s.slice(0, 2);
  if (/^\d{4}$/.test(d4) && DECIMAL[d3]) return { ai: d4, title: DECIMAL[d3], kind: 'dec', decimals: Number(d4[3]) };
  if (AIS[d4] && /^(7|8)\d{3}$/.test(d4)) return { ai: d4, title: AIS[d4][0], kind: AIS[d4][1] };
  if (AIS[d3] && /^[2-4]\d\d$/.test(d3) && !AIS[d2]) return { ai: d3, title: AIS[d3][0], kind: AIS[d3][1] };
  if (AIS[d2]) return { ai: d2, title: AIS[d2][0], kind: AIS[d2][1] };
  if (AIS[d3]) return { ai: d3, title: AIS[d3][0], kind: AIS[d3][1] };
  return null;
}

export function gs1CheckOk(digits) {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length - 1; i++) {
    const d = digits.charCodeAt(digits.length - 2 - i) - 48;
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

/** YYMMDD → ISO-like date (GS1 century rule: within −49…+50 years of today). DD=00 = last day of month. */
export function gs1Date(v, today = new Date()) {
  if (!/^\d{6}$/.test(v)) return v;
  const yy = Number(v.slice(0, 2));
  const mm = Number(v.slice(2, 4));
  let dd = Number(v.slice(4, 6));
  const cur = today.getUTCFullYear();
  let year = Math.floor(cur / 100) * 100 + yy;
  if (year - cur > 50) year -= 100;
  else if (cur - year > 49) year += 100;
  if (mm < 1 || mm > 12) return v;
  const endOfMonth = dd === 0;
  if (endOfMonth) dd = new Date(Date.UTC(year, mm, 0)).getUTCDate();
  const iso = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  return endOfMonth ? `${iso} (end of month)` : iso;
}

function describe(info, value) {
  switch (info.kind) {
    case 'date': return gs1Date(value);
    case 'gtin':
    case 'gln': return `${value} ${gs1CheckOk(value) ? '(check digit OK)' : '(check digit WRONG)'}`;
    case 'dec': {
      if (!/^\d+$/.test(value)) return value;
      // 391n/393n start with a 3-digit ISO 4217 currency code.
      if (/^39[13]/.test(info.ai)) {
        const cur = value.slice(0, 3);
        const amt = value.slice(3);
        return `${(Number(amt) / 10 ** info.decimals).toFixed(info.decimals)} (currency ${cur})`;
      }
      return (Number(value) / 10 ** info.decimals).toFixed(info.decimals);
    }
    default: return value;
  }
}

/** HRI "(01)12345678901231(10)ABC" → [{ ai, value }] or null. */
export function parseHri(text) {
  const t = text.trim();
  if (!/^\(\d{2,4}\)/.test(t)) return null;
  const items = [];
  const re = /\((\d{2,4})\)([^(]*)/gy;
  let m;
  let last = 0;
  while ((m = re.exec(t))) {
    items.push({ ai: m[1], value: m[2] });
    last = re.lastIndex;
  }
  return last === t.length && items.length ? items : null;
}

/** Raw element string (FNC1 as GS, optional symbology identifier) → [{ ai, value }] or null. */
export function parseRaw(text) {
  let s = text.replace(/^\](C1|e0|d2|Q3|J1|e1|e2)/, '');
  const hadSym = s !== text;
  if (s[0] === GS) s = s.slice(1);
  if (!hadSym && !s.includes(GS)) return null;
  const items = [];
  while (s.length) {
    const info = aiInfo(s);
    if (!info) return null;
    const pre = PREDEFINED[s.slice(0, 2)];
    let value;
    if (pre) {
      value = s.slice(info.ai.length, pre);
      s = s.slice(pre);
    } else {
      const end = s.indexOf(GS);
      value = s.slice(info.ai.length, end < 0 ? undefined : end);
      s = end < 0 ? '' : s.slice(end + 1);
    }
    items.push({ ai: info.ai, value });
    if (s[0] === GS) s = s.slice(1);
  }
  return items.length ? items : null;
}

/** GS1 Digital Link: https://id.gs1.org/01/09506000134352/10/ABC?17=261231 → [{ ai, value }] */
export function parseDigitalLink(text) {
  let u;
  try { u = new URL(text.trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const segs = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const keys = ['01', '00', '253', '255', '401', '402', '414', '417', '8003', '8004', '8006', '8010', '8013', '8017', '8018', '8019'];
  const start = segs.findIndex((s, i) => keys.includes(s) && i + 1 < segs.length);
  if (start < 0) return null;
  const items = [];
  for (let i = start; i + 1 < segs.length; i += 2) {
    if (!/^\d{2,4}$/.test(segs[i])) break;
    items.push({ ai: segs[i], value: segs[i + 1] });
  }
  for (const [k, v] of u.searchParams) if (/^\d{2,4}$/.test(k)) items.push({ ai: k, value: v });
  return items.length ? items : null;
}

function view(items, title, extra = {}) {
  const fields = items.map(({ ai, value }) => {
    const info = aiInfo(ai) || { ai, title: 'Unknown AI', kind: 'an' };
    return [`(${ai}) ${info.title}`, describe({ ...info, ai }, value)];
  });
  const gtin = items.find((i) => i.ai === '01');
  return { title, summary: gtin ? `GTIN ${gtin.value}` : '', fields, ...extra };
}

/** Payload view, or null. `result` may carry symbologyIdentifier / contentType from zxing. */
export function interpretGs1(text, result = {}) {
  const hri = parseHri(text);
  if (hri) return view(hri, 'GS1 element string');
  const isGs1Sym = /^\](C1|e0|d2|Q3|J1)/.test(result.symbologyIdentifier || '') || result.contentType === 'GS1';
  const raw = parseRaw(isGs1Sym && !/^\]/.test(text) ? `]C1${text}` : text);
  if (raw) return view(raw, 'GS1 element string');
  const dl = parseDigitalLink(text);
  if (dl) return view(dl, 'GS1 Digital Link', { links: [{ label: 'Open link', href: text.trim() }] });
  return null;
}
