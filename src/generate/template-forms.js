// Template forms for the generator: each renders a small form and builds { data, bcid } from it.
import { h } from '../util/dom.js';
import { buildWifi, buildVCard, buildUrl, buildGs1, buildBcbp, buildEpc, GS1_TEMPLATE_AIS } from './templates.js';

function input(name, label, attrs = {}) {
  const el = attrs.type === 'select'
    ? h('select', { name }, attrs.options.map(([v, l]) => h('option', { value: v }, l)))
    : h('input', { name, type: attrs.type || 'text', ...attrs, options: undefined });
  if (attrs.type === 'checkbox') return h('label.check', el, ` ${label}`);
  return h('label.field', h('span', label), el);
}

function values(form) {
  const out = {};
  for (const el of form.querySelectorAll('[name]')) out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  return out;
}

const today = () => new Date().toISOString().slice(0, 10);

export const TEMPLATES = {
  wifi: {
    label: 'Wi-Fi',
    render: () => h('div.fields',
      input('ssid', 'Network name (SSID)', { autocomplete: 'off' }),
      input('password', 'Password', { autocomplete: 'off' }),
      input('security', 'Security', { type: 'select', options: [['WPA', 'WPA / WPA2 / WPA3'], ['WEP', 'WEP'], ['nopass', 'None (open)']] }),
      input('hidden', 'Hidden network', { type: 'checkbox' })),
    build: (form) => ({ data: buildWifi(values(form)), bcid: 'qrcode' }),
  },

  vcard: {
    label: 'Contact (vCard)',
    render: () => h('div.fields',
      input('first', 'First name'), input('last', 'Last name'), input('org', 'Organisation'), input('title', 'Job title'),
      input('phone', 'Phone', { type: 'tel' }), input('email', 'Email', { type: 'email' }), input('url', 'Website', { type: 'url' }),
      input('street', 'Street'), input('city', 'City'), input('zip', 'Postcode'), input('country', 'Country'), input('note', 'Note')),
    build: (form) => ({ data: buildVCard(values(form)), bcid: 'qrcode' }),
  },

  url: {
    label: 'URL',
    render: () => h('div.fields', input('url', 'Web address', { type: 'url', placeholder: 'https://example.com' })),
    build: (form) => ({ data: buildUrl(values(form)), bcid: 'qrcode' }),
  },

  gs1: {
    label: 'GS1 builder',
    render() {
      const rows = h('div.stack');
      const addRow = (ai = '01', value = '') => {
        const sel = h('select', { 'aria-label': 'Application Identifier' }, Object.entries(GS1_TEMPLATE_AIS).map(([k, d]) => h('option', { value: k }, d.label)));
        sel.value = ai;
        const val = h('input', { type: 'text', 'aria-label': 'Value', value });
        const setType = () => {
          const t = GS1_TEMPLATE_AIS[sel.value].type;
          val.type = t === 'date' ? 'date' : 'text';
          val.inputMode = t === 'n' || t === 'kg' ? 'decimal' : 'text';
          val.placeholder = t === 'kg' ? 'kg, e.g. 1.25' : t === 'n' ? 'digits' : '';
        };
        sel.addEventListener('change', setType);
        setType();
        const row = h('div.row.gs1-row', sel, val, h('button.small', { type: 'button', onclick: () => row.remove(), 'aria-label': 'Remove' }, '✕'));
        row._get = () => ({ ai: sel.value, value: val.value });
        rows.append(row);
      };
      addRow('01', '0952123454321');
      addRow('17', '');
      addRow('10', '');
      const carrier = input('carrier', 'Carrier symbology', {
        type: 'select',
        options: [['gs1datamatrix', 'GS1 DataMatrix'], ['gs1-128', 'GS1-128'], ['gs1qrcode', 'GS1 QR Code'], ['databarexpanded', 'GS1 DataBar Expanded']],
      });
      const box = h('div.stack', rows, h('div.row', h('button.small', { type: 'button', onclick: () => addRow('21', '') }, '+ Add AI')), carrier,
        h('p.small.muted', 'GTIN/SSCC check digits are added if you leave them out. Fixed-length AIs are placed first.'));
      box._rows = rows;
      return box;
    },
    build(form) {
      const rows = [...form._rows.children].map((r) => r._get());
      return { data: buildGs1(rows), bcid: form.querySelector('[name=carrier]').value };
    },
  },

  bcbp: {
    label: 'Boarding pass (sample)',
    render: () => h('div.stack',
      h('p.small.muted', 'Builds the mandatory fields of an IATA BCBP (Resolution 792) single-leg boarding pass. For testing only.'),
      h('div.fields',
        input('lastName', 'Surname', { value: 'SAMPLE' }), input('firstName', 'Given name', { value: 'ALEX' }),
        input('pnr', 'Booking ref. (PNR)', { value: 'ABC123', maxlength: 7 }),
        input('from', 'From (IATA)', { value: 'LIS', maxlength: 3 }), input('to', 'To (IATA)', { value: 'OPO', maxlength: 3 }),
        input('carrier', 'Airline', { value: 'TP', maxlength: 3 }), input('flight', 'Flight no.', { value: '1944', maxlength: 5 }),
        input('date', 'Flight date', { type: 'date', value: today() }),
        input('cabin', 'Class', { value: 'Y', maxlength: 1 }), input('seat', 'Seat', { value: '12C', maxlength: 4 }),
        input('sequence', 'Check-in seq.', { value: '42', maxlength: 5 }),
        input('carrierSym', 'Symbology', { type: 'select', options: [['pdf417', 'PDF417 (paper)'], ['azteccode', 'Aztec (mobile)'], ['qrcode', 'QR Code (mobile)'], ['datamatrix', 'Data Matrix']] }))),
    build(form) {
      const v = values(form);
      return { data: buildBcbp(v), bcid: v.carrierSym };
    },
  },

  epc: {
    label: 'SEPA payment (EPC)',
    render: () => h('div.stack',
      h('p.small.muted', 'European Payments Council QR (“GiroCode”) for a SEPA credit transfer, readable by most European banking apps.'),
      h('div.fields',
        input('name', 'Beneficiary name'), input('iban', 'IBAN', { autocomplete: 'off' }), input('bic', 'BIC (optional)'),
        input('amount', 'Amount (EUR)', { inputmode: 'decimal' }), input('text', 'Remittance text'), input('reference', 'Structured reference (RF…)'))),
    build: (form) => ({ data: buildEpc(values(form)), bcid: 'qrcode' }),
  },
};
