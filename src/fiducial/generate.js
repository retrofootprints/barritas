// Generate marker tab: single marker (SVG/PNG, verified by detection) and printable sheets.
import { $, h } from '../util/dom.js';
import { store } from '../util/storage.js';
import { downloadBlob, canvasToBlob } from '../util/io.js';
import { DICTIONARIES, DICT_BY_NAME } from './dictionaries.js';
import { getDictionary, detectMarkers } from './detect.js';
import { markerSvg, markerCanvas, sheetPages, parseIds } from './marker.js';

const els = {};
const S = { dict: 'ARUCO_MIP_36h12', id: 0, size: 50, quiet: 1, label: true, ids: '0-11', paper: 'A4', gap: 6, sheetLabels: true, cut: true, ...store.get('fid', {}) };
let dict = null;
let token = 0;

function save() { store.set('fid', S); }

function readForm() {
  Object.assign(S, {
    dict: els.dict.value,
    id: Math.max(0, Math.floor(Number(els.id.value) || 0)),
    size: Number(els.size.value) || 50,
    quiet: Math.max(0, Math.min(10, Math.floor(Number(els.quiet.value) || 0))),
    label: els.label.checked,
    ids: els.ids.value,
    paper: els.paper.value,
    gap: Number(els.gap.value) || 0,
    sheetLabels: els.sheetLabels.checked,
    cut: els.cut.checked,
  });
  save();
}

function writeForm() {
  els.dict.value = S.dict;
  els.id.value = S.id;
  els.size.value = S.size;
  els.quiet.value = S.quiet;
  els.label.checked = S.label;
  els.ids.value = S.ids;
  els.paper.value = S.paper;
  els.gap.value = S.gap;
  els.sheetLabels.checked = S.sheetLabels;
  els.cut.checked = S.cut;
}

const dictLabel = () => DICT_BY_NAME[S.dict]?.label || S.dict;

async function update() {
  const t = ++token;
  readForm();
  els.verify.className = 'msg small';
  els.verify.textContent = 'Loading dictionary…';
  els.preview.classList.add('stale');
  try {
    dict = await getDictionary(S.dict);
  } catch (e) {
    els.preview.replaceChildren(h('p.msg.err', `Could not load dictionary: ${e.message}`));
    return;
  }
  if (t !== token) return;
  els.id.max = dict.count - 1;
  els.range.textContent = `(0–${dict.count - 1})`;
  els.info.textContent = `${dict.size}×${dict.size} data bits (${dict.size + 2}×${dict.size + 2} with border), minimum Hamming distance ${dict.tau}, ${dict.count} IDs.`
    + (dict.tau === 0 ? ' Note: this dictionary contains duplicate codes, so some IDs cannot be told apart.' : '');
  els.preview.classList.remove('stale');
  if (S.id >= dict.count) {
    els.preview.replaceChildren(h('p.msg.err', `ID must be between 0 and ${dict.count - 1}.`));
    els.verify.textContent = '';
    return;
  }
  const svg = markerSvg(dict.codes[S.id], dict.size, { sizeMm: S.size, quiet: S.quiet, label: S.label ? `${dictLabel()} · ID ${S.id}` : '' });
  const node = document.importNode(new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement, true);
  // Show on screen at a comfortable size; the file keeps its mm dimensions.
  node.removeAttribute('width');
  node.removeAttribute('height');
  node.classList.add('marker-svg');
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', `${dictLabel()} marker ID ${S.id}`);
  els.preview.replaceChildren(node);
  verifyMarker(t);
}

async function verifyMarker(t) {
  els.verify.className = 'msg small';
  els.verify.textContent = 'Verifying…';
  // Render at 12 px per cell with at least 2 white cells around it, then detect.
  const canvas = markerCanvas(dict.codes[S.id], dict.size, { cellPx: 12, quiet: Math.max(2, S.quiet) });
  const img = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  try {
    const { markers } = await detectMarkers(img, { dict: S.dict, maxErrors: 'auto' }, { transfer: true });
    if (t !== token) return;
    const hit = markers.find((m) => m.id === S.id && m.hamming === 0);
    els.verify.className = `msg small ${hit ? 'ok' : 'err'}`;
    els.verify.textContent = hit
      ? `✔ Verified: detected as ${dictLabel()} ID ${S.id}.`
      : `✘ Detection returned ${markers.length ? markers.map((m) => `ID ${m.id}`).join(', ') : 'nothing'}.`;
  } catch (e) {
    els.verify.className = 'msg small err';
    els.verify.textContent = `Verify failed: ${e.message}`;
  }
}

function buildSheet() {
  readForm();
  if (!dict) throw new Error('Dictionary not loaded yet.');
  const ids = parseIds(S.ids, dict.count);
  const res = sheetPages(dict, ids, { paper: S.paper, sizeMm: S.size, quiet: S.quiet, gapMm: S.gap, labels: S.sheetLabels, cutMarks: S.cut, dictLabel: dictLabel() });
  els.sheetMsg.className = 'msg small ok';
  els.sheetMsg.textContent = `${ids.length} marker${ids.length > 1 ? 's' : ''} on ${res.pages.length} page${res.pages.length > 1 ? 's' : ''} (${res.cols}×${res.rows} per page).`;
  return res;
}

function sheetError(e) {
  els.sheetMsg.className = 'msg small err';
  els.sheetMsg.textContent = e.message;
}

function svgNodes(pages) {
  return pages.map((p) => document.importNode(new DOMParser().parseFromString(p, 'image/svg+xml').documentElement, true));
}

function setPageSize(paper) {
  // @page size via a constructable stylesheet (inline <style> is blocked by the CSP).
  try {
    const sheet = new CSSStyleSheet();
    const size = paper === 'Letter' ? '8.5in 11in' : '210mm 297mm';
    sheet.replaceSync(`@page { size: ${size}; margin: 0; } @media print { #print-root svg { width: ${paper === 'Letter' ? '8.5in' : '210mm'}; height: ${paper === 'Letter' ? '11in' : '297mm'}; } }`);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets.filter((s) => !s._barritasPage), Object.assign(sheet, { _barritasPage: true })];
  } catch { /* older browsers: user picks paper size in the print dialog */ }
}

export function init(panel) {
  Object.assign(els, {
    dict: $('#fid-dict', panel), id: $('#fid-id', panel), size: $('#fid-size', panel), quiet: $('#fid-quiet', panel),
    label: $('#fid-label', panel), range: $('#fid-range', panel), info: $('#fid-info', panel),
    ids: $('#fid-ids', panel), paper: $('#fid-paper', panel), gap: $('#fid-gap', panel),
    sheetLabels: $('#fid-sheet-labels', panel), cut: $('#fid-cut', panel), sheetMsg: $('#fid-sheet-msg', panel),
    preview: $('#fid-preview', panel), verify: $('#fid-verify', panel),
    sheetCard: $('#fid-sheet-card', panel), sheet: $('#fid-sheet', panel),
  });
  els.dict.replaceChildren(...DICTIONARIES.map((d) => h('option', { value: d.name }, d.label)));
  if (!DICT_BY_NAME[S.dict]) S.dict = 'ARUCO_MIP_36h12';
  writeForm();

  for (const el of [els.dict, els.id, els.size, els.quiet, els.label]) el.addEventListener('change', update);
  for (const el of [els.id, els.size, els.quiet]) el.addEventListener('input', update);
  for (const el of [els.ids, els.paper, els.gap, els.sheetLabels, els.cut]) el.addEventListener('change', readForm);

  $('#fid-svg', panel).addEventListener('click', () => {
    if (!dict || S.id >= dict.count) return;
    const svg = markerSvg(dict.codes[S.id], dict.size, { sizeMm: S.size, quiet: S.quiet, label: S.label ? `${dictLabel()} · ID ${S.id}` : '' });
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${S.dict.toLowerCase()}-${S.id}-${S.size}mm.svg`);
  });
  $('#fid-png', panel).addEventListener('click', async () => {
    if (!dict || S.id >= dict.count) return;
    // 300 dpi: cell size in pixels from the physical size.
    const cellPx = Math.max(1, Math.round(((S.size / (dict.size + 2)) / 25.4) * 300));
    const c = markerCanvas(dict.codes[S.id], dict.size, { cellPx, quiet: S.quiet });
    downloadBlob(await canvasToBlob(c), `${S.dict.toLowerCase()}-${S.id}-${S.size}mm-300dpi.png`);
  });

  $('#fid-sheet-preview', panel).addEventListener('click', () => {
    try {
      const { pages } = buildSheet();
      els.sheet.replaceChildren(...svgNodes(pages.slice(0, 10)));
      if (pages.length > 10) els.sheet.append(h('p.small.muted', `…and ${pages.length - 10} more pages.`));
      els.sheetCard.hidden = false;
    } catch (e) { sheetError(e); }
  });
  $('#fid-print', panel).addEventListener('click', () => {
    try {
      const { pages } = buildSheet();
      const root = document.getElementById('print-root');
      root.replaceChildren(...svgNodes(pages));
      setPageSize(S.paper);
      document.body.classList.add('printing');
      const done = () => { document.body.classList.remove('printing'); root.replaceChildren(); };
      window.addEventListener('afterprint', done, { once: true });
      window.print();
      setTimeout(() => { if (!matchMedia('print').matches) done(); }, 1000);
    } catch (e) { sheetError(e); }
  });
  $('#fid-sheet-svg', panel).addEventListener('click', () => {
    try {
      const { pages } = buildSheet();
      pages.forEach((p, i) => setTimeout(() => downloadBlob(new Blob([p], { type: 'image/svg+xml' }), `${S.dict.toLowerCase()}-sheet-${i + 1}.svg`), i * 300));
    } catch (e) { sheetError(e); }
  });

  update();
}
