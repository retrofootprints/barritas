// IATA Bar Coded Boarding Pass (Resolution 792), format "M". Mandatory fields for every leg,
// plus the conditional (version-dependent) items when present.

const PASSENGER_STATUS = {
  0: 'Ticket issuance / passenger not checked in',
  1: 'Ticket issuance / passenger checked in',
  2: 'Baggage checked, passenger not checked in',
  3: 'Baggage checked, passenger checked in',
  4: 'Passenger passed security check',
  5: 'Passenger passed gate exit (coupon used)',
  6: 'Transit',
  7: 'Standby',
  8: 'Boarding data revalidation done',
  9: 'Original boarding line used at time of ticket issuance',
  A: 'Up- or downgrading required at close-out',
};

const PASSENGER_DESC = { 0: 'Adult', 1: 'Male', 2: 'Female', 3: 'Child', 4: 'Infant', 5: 'No passenger (cabin baggage)', 6: 'Adult travelling with infant', 7: 'Unaccompanied minor' };
const CHECKIN_SOURCE = { W: 'Web', K: 'Airport kiosk', R: 'Remote or off-site kiosk', M: 'Mobile device', O: 'Airport agent', T: 'Town agent', V: 'Third-party vendor' };
const DOC_TYPE = { B: 'Boarding pass', I: 'Itinerary receipt' };

const hex = (s) => (/^[0-9A-Fa-f]{2}$/.test(s) ? parseInt(s, 16) : NaN);
const trim = (s) => (s || '').trim();

/** Day-of-year → "22 Nov" in the year closest to today (the year is not encoded in BCBP). */
export function julianToDate(doy, today = new Date()) {
  const n = Number(doy);
  if (!Number.isInteger(n) || n < 1 || n > 366) return null;
  const y = today.getUTCFullYear();
  let best = null;
  for (const year of [y - 1, y, y + 1]) {
    const d = new Date(Date.UTC(year, 0, n));
    if (d.getUTCFullYear() !== year) continue;
    if (!best || Math.abs(d - today) < Math.abs(best - today)) best = d;
  }
  return best;
}

const fmtDay = (d) => d && d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function flight(f) {
  const n = trim(f);
  return n.replace(/^0+(?=\d)/, '');
}

/** Parse; returns a structured object or null when it doesn't look like BCBP. */
export function parseBcbp(text) {
  if (!/^M[1-9]/.test(text) || text.length < 60) return null;
  const legsCount = Number(text[1]);
  const out = {
    formatCode: 'M',
    legsCount,
    name: trim(text.slice(2, 22)),
    eticket: text[22] === 'E',
    legs: [],
    warnings: [],
  };
  let pos = 23;
  for (let i = 0; i < legsCount; i++) {
    if (text.length < pos + 37) {
      out.warnings.push(`Data ends before leg ${i + 1}.`);
      break;
    }
    const m = text.slice(pos, pos + 37);
    const leg = {
      pnr: trim(m.slice(0, 7)),
      from: trim(m.slice(7, 10)),
      to: trim(m.slice(10, 13)),
      carrier: trim(m.slice(13, 16)),
      flight: flight(m.slice(16, 21)),
      julian: trim(m.slice(21, 24)),
      compartment: m.slice(24, 25),
      seat: trim(m.slice(25, 29)).replace(/^0+(?=\d)/, ''),
      sequence: trim(m.slice(29, 34)).replace(/^0+(?=\d)/, ''),
      status: m.slice(34, 35),
    };
    const varSize = hex(m.slice(35, 37));
    pos += 37;
    if (Number.isNaN(varSize)) {
      out.warnings.push(`Leg ${i + 1}: invalid variable-field size “${m.slice(35, 37)}”.`);
      out.legs.push(leg);
      break;
    }
    let v = text.slice(pos, pos + varSize);
    pos += varSize;
    if (i === 0 && v[0] === '>') {
      out.version = v[1];
      const uSize = hex(v.slice(2, 4));
      const u = Number.isNaN(uSize) ? '' : v.slice(4, 4 + uSize);
      v = Number.isNaN(uSize) ? '' : v.slice(4 + uSize);
      out.unique = {
        passengerDescription: u.slice(0, 1),
        checkinSource: u.slice(1, 2),
        issuanceSource: u.slice(2, 3),
        issueDate: trim(u.slice(3, 7)),
        documentType: u.slice(7, 8),
        issuer: trim(u.slice(8, 11)),
        bagTags: [u.slice(11, 24), u.slice(24, 37), u.slice(37, 50)].map(trim).filter(Boolean),
      };
    }
    if (v.length >= 2) {
      const rSize = hex(v.slice(0, 2));
      if (!Number.isNaN(rSize)) {
        const r = v.slice(2, 2 + rSize);
        leg.conditional = {
          airlineNumericCode: trim(r.slice(0, 3)),
          documentSerial: trim(r.slice(3, 13)),
          selectee: trim(r.slice(13, 14)),
          docVerification: trim(r.slice(14, 15)),
          marketingCarrier: trim(r.slice(15, 18)),
          frequentFlyerAirline: trim(r.slice(18, 21)),
          frequentFlyerNumber: trim(r.slice(21, 37)),
          idAdIndicator: trim(r.slice(37, 38)),
          freeBaggage: trim(r.slice(38, 41)),
          fastTrack: trim(r.slice(41, 42)),
        };
        leg.airlineUse = v.slice(2 + rSize);
      } else {
        leg.airlineUse = v;
      }
    }
    out.legs.push(leg);
  }
  if (text[pos] === '^') {
    const len = hex(text.slice(pos + 2, pos + 4));
    out.security = { type: text[pos + 1], length: len, data: text.slice(pos + 4, pos + 4 + (Number.isNaN(len) ? 0 : len)) };
  }
  if (out.legs.length !== legsCount) out.warnings.push(`Header says ${legsCount} legs, found ${out.legs.length}.`);
  return out;
}

/** Payload view for the scanner. */
export function interpretBcbp(text) {
  const p = parseBcbp(text);
  if (!p) return null;
  const [last, first] = p.name.split('/');
  const fields = [
    ['Passenger', first ? `${first} ${last}` : p.name],
    ['Electronic ticket', p.eticket ? 'yes' : 'no'],
    ['Legs', p.legsCount],
  ];
  if (p.version) fields.push(['BCBP version', p.version]);
  if (p.unique) {
    const u = p.unique;
    if (u.passengerDescription) fields.push(['Passenger type', PASSENGER_DESC[u.passengerDescription] || u.passengerDescription]);
    if (u.checkinSource) fields.push(['Check-in source', CHECKIN_SOURCE[u.checkinSource] || u.checkinSource]);
    if (u.issueDate) fields.push(['Issued', `year …${u.issueDate[0]}, day ${u.issueDate.slice(1)}`]);
    if (u.documentType) fields.push(['Document', DOC_TYPE[u.documentType] || u.documentType]);
    if (u.issuer) fields.push(['Issued by', u.issuer]);
    if (u.bagTags.length) fields.push(['Bag tags', u.bagTags.join(', ')]);
  }
  const sections = p.legs.map((l, i) => {
    const date = julianToDate(l.julian);
    const f = [
      ['Flight', `${l.carrier} ${l.flight}`],
      ['Route', `${l.from} → ${l.to}`],
      ['Date', date ? `${fmtDay(date)} (day ${Number(l.julian)}; year not encoded)` : l.julian],
      ['Booking ref. (PNR)', l.pnr],
      ['Seat', l.seat],
      ['Class (compartment)', l.compartment],
      ['Check-in sequence', l.sequence],
      ['Status', PASSENGER_STATUS[l.status] ? `${l.status} – ${PASSENGER_STATUS[l.status]}` : l.status],
    ];
    if (l.conditional) {
      const c = l.conditional;
      f.push(
        ['Ticket number', c.airlineNumericCode && c.documentSerial ? `${c.airlineNumericCode}-${c.documentSerial}` : ''],
        ['Marketing carrier', c.marketingCarrier],
        ['Frequent flyer', [c.frequentFlyerAirline, c.frequentFlyerNumber].filter(Boolean).join(' ')],
        ['Free baggage', c.freeBaggage],
        ['Selectee', c.selectee === '1' ? 'yes' : ''],
        ['Fast track', c.fastTrack === 'Y' ? 'yes' : ''],
      );
    }
    if (l.airlineUse) f.push(['Airline data', l.airlineUse]);
    return { title: `Leg ${i + 1}: ${l.from} → ${l.to}`, fields: f };
  });
  if (p.security) sections.push({ title: 'Security data', fields: [['Type', p.security.type], ['Length', p.security.length], ['Data', p.security.data]] });
  const leg1 = p.legs[0];
  return {
    title: 'Boarding pass (IATA BCBP)',
    summary: leg1 ? `${leg1.carrier} ${leg1.flight} · ${leg1.from} → ${leg1.to}${p.legsCount > 1 ? ` (+${p.legsCount - 1} more leg${p.legsCount > 2 ? 's' : ''})` : ''}` : '',
    fields,
    sections,
    warnings: [...p.warnings, 'Contains personal data. It is processed on this device only.'],
  };
}
