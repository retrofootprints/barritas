// Generate barcode tab: format picker, templates, per-format options, preview, export, verify.
import { $, $$, h } from '../util/dom.js';
import { store } from '../util/storage.js';
import { copyText, copyImage, downloadBlob, canvasToBlob, safeFilename } from '../util/io.js';
import { GEN_FORMATS, BY_BCID, RMQR_VERSIONS, applyCheckDigit } from './formats.js';
import { buildOptions, renderSVG, renderCanvas, verify, friendlyError, loadBwip } from './render.js';
import { TEMPLATES } from './template-forms.js';

const DEFAULT_COMMON = { scale: 3, quiet: 8, fg: '#000000', bg: '#ffffff', rotate: 'N', includetext: true };
const DM_SQUARE = [10, 12, 14, 16, 18, 20, 22, 24, 26, 32, 36, 40, 44, 48, 52, 64, 72, 80, 88, 96, 104, 120, 132, 144];
const DM_RECT = ['8x18', '8x32', '12x26', '12x36', '16x36', '16x48'];

const saved = store.get('gen', {});
const state = {
  bcid: BY_BCID[saved.bcid] ? saved.bcid : 'qrcode',
  data: typeof saved.data === 'string' ? saved.data : null,
  o: { ...DEFAULT_COMMON, ...(saved.o || {}) },
};
const els = {};
let renderToken = 0;
let lastGood = null; // { options, svg, text }

function save() { store.set('gen', { bcid: state.bcid, data: state.data, o: state.o }); }

// ---------- format + options UI ----------

function populateFormats() {
  const groups = {};
  for (const f of GEN_FORMATS) (groups[f.group] ||= []).push(h('option', { value: f.bcid }, f.zxing ? f.label : `${f.label} (generate only)`));
  els.format.replaceChildren(...Object.entries(groups).map(([g, opts]) => h('optgroup', { label: g }, opts)));
}

function fillSelect(sel, values, current) {
  sel.replaceChildren(h('option', { value: '' }, 'Auto'), ...values.map((v) => h('option', { value: v }, v)));
  sel.value = values.includes(current) ? current : '';
}

function updateOptionVisibility() {
  const fmt = BY_BCID[state.bcid];
  const kind = fmt.kind;
  for (const el of $$('[data-kinds]', els.panel)) {
    el.hidden = !el.dataset.kinds.split(' ').includes(kind);
  }
  if (kind === 'qr') {
    const versions = state.bcid === 'microqrcode' ? ['M1', 'M2', 'M3', 'M4']
      : state.bcid === 'rectangularmicroqrcode' ? RMQR_VERSIONS
        : Array.from({ length: 40 }, (_, i) => String(i + 1));
    fillSelect(els.qrversion, versions, state.o.qrversion);
  }
  if (kind === 'datamatrix') {
    const rect = state.o.dmformat === 'rectangle' || state.bcid === 'datamatrixrectangular';
    fillSelect(els.dmversion, rect ? DM_RECT : DM_SQUARE.map((n) => `${n}x${n}`), state.o.dmversion);
  }
}

function bindOptions() {
  for (const el of $$('[data-gopt]', els.panel)) {
    const key = el.dataset.gopt;
    const v = state.o[key];
    if (el.type === 'checkbox') el.checked = !!v;
    else if (v !== undefined && v !== null) el.value = v;
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'color' ? 'change' : 'input', () => {
      state.o[key] = el.type === 'checkbox' ? el.checked : el.value;
      if (key === 'dmformat') updateOptionVisibility();
      save();
      schedule();
    });
  }
}

/** bwip `bcid` actually used (GS1 / compact toggles switch symbology). */
function effectiveBcid() {
  const { bcid, o } = state;
  if (bcid === 'datamatrix' && o.dmgs1) return 'gs1datamatrix';
  if (bcid === 'pdf417' && o.pdfcompact) return 'pdf417compact';
  return bcid;
}

function extraOptions() {
  const { o } = state;
  const kind = BY_BCID[state.bcid].kind;
  switch (kind) {
    case 'qr': return { eclevel: o.eclevel, version: o.qrversion || (state.bcid === 'rectangularmicroqrcode' ? 'auto' : ''), mask: o.mask };
    case 'aztec': return { eclevel: o.azecpercent, format: o.azformat, layers: o.azlayers };
    case 'datamatrix': return { format: o.dmformat, version: o.dmversion };
    case 'pdf417': return { columns: o.pdfcolumns, rows: o.pdfrows, eclevel: o.pdfeclevel };
    default: return {};
  }
}

function commonOptions() {
  const { o } = state;
  const kind = BY_BCID[state.bcid].kind;
  const linear = kind === 'linear' || kind === 'ean';
  return {
    scale: o.scale, quiet: o.quiet, fg: o.fg, bg: o.bg, rotate: o.rotate,
    height: ['linear', 'ean', 'postal'].includes(kind) ? o.height : '',
    includetext: linear && o.includetext,
    textsize: linear ? o.textsize : '',
  };
}

// ---------- data validation ----------

function prepareText() {
  const fmt = BY_BCID[state.bcid];
  const raw = state.data ?? '';
  if (!raw.trim()) return { error: 'Enter the data to encode.' };
  const { text, info, error } = applyCheckDigit(fmt, raw.trim());
  if (error) return { error };
  if ((fmt.gs1 || effectiveBcid().startsWith('gs1') || ['databaromni', 'databarstacked', 'databarstackedomni', 'databarlimited', 'databarexpanded', 'databarexpandedstacked'].includes(fmt.bcid))
    && !/^\(\d{2,4}\)/.test(text)) {
    return { error: 'GS1 data must be written as (AI)value pairs, e.g. (01)09521234543213(10)ABC123.' };
  }
  let full = text;
  if (fmt.kind === 'ean' && state.o.addon) {
    if (!/^(\d{2}|\d{5})$/.test(state.o.addon)) return { error: 'Add-on must be 2 or 5 digits.' };
    full = `${text} ${state.o.addon}`;
  }
  return { text: full, info, verifyText: text };
}

// ---------- render ----------

let timer = 0;
function schedule(delay = 150) {
  clearTimeout(timer);
  timer = setTimeout(render, delay);
}

async function render() {
  const token = ++renderToken;
  const prep = prepareText();
  els.dataMsg.className = `msg small ${prep.error ? 'err' : 'ok'}`;
  els.dataMsg.textContent = prep.error || prep.info || '';
  els.verify.textContent = '';
  els.verify.className = 'msg small';
  if (prep.error) {
    setPreviewState(false);
    return;
  }
  const options = buildOptions(effectiveBcid(), prep.text, commonOptions(), extraOptions());
  let svg;
  try {
    svg = await renderSVG(options);
  } catch (e) {
    if (token !== renderToken) return;
    els.error.textContent = friendlyError(e);
    setPreviewState(false);
    return;
  }
  if (token !== renderToken) return;
  els.error.textContent = '';
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const node = document.importNode(doc.documentElement, true);
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', `${BY_BCID[state.bcid].label} barcode`);
  els.preview.replaceChildren(node);
  lastGood = { options, svg, text: prep.text };
  setPreviewState(true);

  // Round-trip check (debounced a little more, since it decodes).
  els.verify.textContent = 'Verifying…';
  const v = await verify(state.bcid, options, prep.verifyText).catch((e) => ({ status: 'fail', detail: `Verify failed: ${e.message}` }));
  if (token !== renderToken) return;
  const cls = { pass: 'ok', decoded: 'warn', fail: 'err', na: '' }[v.status];
  const prefix = { pass: '✔ Verified. ', decoded: '⚠ ', fail: '✘ Not readable. ', na: '' }[v.status];
  els.verify.className = `msg small ${cls}`;
  els.verify.textContent = prefix + v.detail;
}

function setPreviewState(ok) {
  els.preview.classList.toggle('stale', !ok);
  for (const b of [els.svgBtn, els.pngBtn, els.copyBtn]) b.disabled = !ok;
  if (ok) els.error.textContent = els.error.textContent || '';
}

// ---------- export ----------

function baseName() {
  return `${state.bcid}-${safeFilename(lastGood?.text || '', 'barcode')}`;
}

async function pngBlob() {
  const canvas = await renderCanvas(lastGood.options);
  return canvasToBlob(canvas);
}

function flash(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = old; }, 1200);
}

// ---------- templates ----------

function openTemplate(key) {
  const t = TEMPLATES[key];
  const box = els.templateForm;
  const closing = box.dataset.key === key && !box.hidden;
  for (const b of $$('button', els.templates)) b.setAttribute('aria-pressed', String(!closing && b.dataset.key === key));
  if (closing) {
    box.hidden = true;
    box.dataset.key = '';
    return;
  }
  box.dataset.key = key;
  box.hidden = false;
  const msg = h('p.msg.err.small');
  const form = t.render();
  const apply = h('button.primary', { type: 'button' }, 'Use this');
  apply.addEventListener('click', () => {
    try {
      const { data, bcid } = t.build(form);
      state.bcid = bcid;
      state.data = data;
      els.format.value = bcid;
      els.data.value = data;
      msg.textContent = '';
      updateOptionVisibility();
      save();
      schedule(0);
    } catch (e) {
      msg.textContent = e.message;
    }
  });
  box.replaceChildren(h('h3', t.label), form, msg, h('div.row', apply, h('button', { type: 'button', onclick: () => openTemplate(key) }, 'Close')));
}

// ---------- init ----------

export function init(panel) {
  Object.assign(els, {
    panel,
    format: $('#gen-format', panel),
    data: $('#gen-data', panel),
    dataMsg: $('#gen-data-msg', panel),
    templates: $('#gen-templates', panel),
    templateForm: $('#gen-template-form', panel),
    qrversion: $('#gen-qrversion', panel),
    dmversion: $('#gen-dmversion', panel),
    preview: $('#gen-preview', panel),
    error: $('#gen-error', panel),
    verify: $('#gen-verify', panel),
    svgBtn: $('#gen-svg', panel),
    pngBtn: $('#gen-png', panel),
    copyBtn: $('#gen-copy', panel),
    linkBtn: $('#gen-link', panel),
  });

  // Shareable link: ?f=<bcid>&d=<data>
  const params = new URLSearchParams(location.search);
  if (params.has('f') && BY_BCID[params.get('f')]) {
    state.bcid = params.get('f');
    state.data = params.get('d') ?? BY_BCID[state.bcid].sample;
  }
  if (state.data === null) state.data = BY_BCID[state.bcid].sample;

  populateFormats();
  els.format.value = state.bcid;
  els.data.value = state.data;
  bindOptions();
  updateOptionVisibility();

  els.format.addEventListener('change', () => {
    const prev = BY_BCID[state.bcid];
    state.bcid = els.format.value;
    // Swap in the new format's sample if the data was untouched.
    if (!state.data || state.data === prev.sample) {
      state.data = BY_BCID[state.bcid].sample;
      els.data.value = state.data;
    }
    updateOptionVisibility();
    save();
    schedule(0);
  });
  els.data.addEventListener('input', () => { state.data = els.data.value; save(); schedule(); });

  for (const [key, t] of Object.entries(TEMPLATES)) {
    els.templates.append(h('button.small', { type: 'button', dataset: { key }, 'aria-pressed': 'false', onclick: () => openTemplate(key) }, t.label));
  }

  els.svgBtn.addEventListener('click', () => {
    if (!lastGood) return;
    downloadBlob(new Blob([lastGood.svg], { type: 'image/svg+xml' }), `${baseName()}.svg`);
  });
  els.pngBtn.addEventListener('click', async () => {
    if (!lastGood) return;
    downloadBlob(await pngBlob(), `${baseName()}.png`);
  });
  els.copyBtn.addEventListener('click', async () => {
    if (!lastGood) return;
    flash(els.copyBtn, (await copyImage(pngBlob())) ? 'Copied' : 'Not supported here');
  });
  els.linkBtn.addEventListener('click', async () => {
    const url = new URL(location.href);
    url.search = new URLSearchParams({ f: state.bcid, d: state.data || '' }).toString();
    url.hash = 'generate';
    flash(els.linkBtn, (await copyText(url.href)) ? 'Link copied' : 'Copy failed');
  });

  els.preview.replaceChildren(h('p.muted.small', 'Loading generator…'));
  loadBwip().then(() => schedule(0), (e) => { els.error.textContent = `Could not load bwip-js: ${e.message}`; });
}
