// Scan tab controller: inputs, settings, decoding, results, history.
import { $, h, announce } from '../util/dom.js';
import { store } from '../util/storage.js';
import { beep } from '../util/io.js';
import { FORMATS, GROUPS, formatLabel } from './formats.js';
import { decode, warmup, nativeSupport } from './engine.js';
import { wireInputs, blobToCanvas, imageDataOf } from './input.js';
import { sizeOverlay, clearOverlay, drawDetections } from './overlay.js';
import { barcodeCard, messageCard } from './results.js';
import { DEFAULTS } from './defaults.js';


const S = { ...DEFAULTS, ...store.get('scan', {}) };
const els = {};
let history = [];
let current = null; // { kind: 'still', name } — what the stage shows

function saveSettings() { store.set('scan', S); }

// ---------- settings UI ----------

function populateFormats() {
  const sel = els.format;
  sel.append(h('option', { value: '' }, 'Auto (all formats)'));
  const g = h('optgroup', { label: 'Groups' });
  for (const { value, label } of GROUPS) g.append(h('option', { value }, label));
  sel.append(g);
  const families = {};
  for (const [value, label, fam] of FORMATS) (families[fam] ||= []).push(h('option', { value }, label));
  for (const [fam, opts] of Object.entries(families)) sel.append(h('optgroup', { label: fam }, opts));
  if (![...sel.options].some((o) => o.value === S.format)) S.format = '';
}

function bindSettings(panel) {
  for (const el of panel.querySelectorAll('[data-opt]')) {
    const key = el.dataset.opt;
    if (el.type === 'checkbox') el.checked = !!S[key];
    else el.value = S[key] ?? '';
    el.addEventListener('change', () => {
      S[key] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
      saveSettings();
      onSettingChanged(key);
    });
  }
}

function onSettingChanged(key) {
  if (key === 'persistHistory') {
    if (S.persistHistory) store.set('history', history);
    else store.remove('history');
  }
  if (key === 'engine' || key === 'format') updateEngineInfo();
}

async function updateEngineInfo() {
  const n = await nativeSupport();
  els.engineInfo.textContent = n.available
    ? `Native BarcodeDetector available (${n.formats.length} formats). Auto uses it first where it supports the chosen format, then falls back to zxing.`
    : 'Native BarcodeDetector is not available in this browser; zxing-wasm is used.';
}

// ---------- history ----------

function renderHistory() {
  const ul = els.history;
  ul.replaceChildren();
  if (!history.length) { ul.append(h('li.muted', 'No recent scans.')); return; }
  for (const item of history) {
    ul.append(h('li',
      h('span.badge', item.label),
      h('span.h-text', { title: item.text }, item.text),
      h('span.h-time', new Date(item.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    ));
  }
}

export function addHistory(label, text) {
  const key = `${label}\u0000${text}`;
  history = history.filter((x) => `${x.label}\u0000${x.text}` !== key);
  history.unshift({ label, text, t: Date.now() });
  history = history.slice(0, 10);
  if (S.persistHistory) store.set('history', history);
  renderHistory();
}

// ---------- stage ----------

function showStill() {
  els.placeholder.hidden = true;
  els.media.hidden = false;
  els.still.hidden = false;
  els.video.hidden = true;
  els.rescan.hidden = false;
}

function setStatus(text) {
  els.status.hidden = !text;
  els.status.textContent = text || '';
}

function setResults(nodes) {
  els.results.replaceChildren(...nodes);
}

// ---------- decoding stills ----------

async function scanStill() {
  const canvas = els.still;
  sizeOverlay(els.overlay, canvas.width, canvas.height);
  clearOverlay(els.overlay);
  setStatus('Decoding…');
  const nodes = [];
  let found = 0;
  let first = '';
  try {
    const { results, engine, ms, note } = await decode(imageDataOf(canvas), S);
    drawDetections(els.overlay, { barcodes: results });
    if (note) nodes.push(messageCard(note, 'warn'));
    for (const r of results) {
      nodes.push(barcodeCard(r, { source: current?.name }));
      addHistory(r.formatLabel, r.text);
    }
    found = results.length;
    first = results[0] ? `${results[0].formatLabel}: ${results[0].text.slice(0, 120)}` : '';
    setStatus(`${found} found · ${engine} · ${Math.round(ms)} ms`);
  } catch (e) {
    nodes.push(messageCard(`Decoding failed: ${e.message}`, 'err'));
    setStatus('');
  }
  if (!found) {
    nodes.push(messageCard(`No barcode found${S.format ? ` (looking for ${formatLabel(S.format)} only)` : ''}. Try “Try harder”, choose the exact format, crop closer to the code, or use a sharper image.`, 'warn'));
  } else if (S.beep) {
    beep();
  }
  announce(found ? `${found} result${found > 1 ? 's' : ''}. ${first}` : 'No barcode found');
  setResults(nodes);
  return found;
}

async function handleFiles(files) {
  // One image at a time: with several files, decode each in turn and keep all results.
  const all = [];
  for (const file of files) {
    try {
      await blobToCanvas(file, els.still);
    } catch (e) {
      all.push(messageCard(e.message, 'err'));
      continue;
    }
    current = { kind: 'still', name: file.name || 'pasted image' };
    showStill();
    await scanStill();
    all.push(...els.results.childNodes);
  }
  if (files.length > 1) setResults(all);
}

function showError(text) {
  setResults([messageCard(text, 'err')]);
}

// ---------- init ----------

export function init(panel) {
  Object.assign(els, {
    panel,
    format: $('#opt-format', panel),
    engineInfo: $('#engine-info', panel),
    file: $('#scan-file', panel),
    stage: $('#scan-stage', panel),
    media: $('#scan-media', panel),
    video: $('#scan-video', panel),
    still: $('#scan-still', panel),
    overlay: $('#scan-overlay', panel),
    status: $('#scan-status', panel),
    placeholder: $('#scan-placeholder', panel),
    results: $('#scan-results', panel),
    history: $('#scan-history', panel),
    rescan: $('#scan-rescan', panel),
  });
  populateFormats();
  bindSettings(panel);
  updateEngineInfo();

  history = S.persistHistory ? store.get('history', []) : [];
  renderHistory();
  $('#history-clear', panel).addEventListener('click', () => {
    history = [];
    store.remove('history');
    renderHistory();
  });

  wireInputs({
    fileInput: els.file,
    dropTarget: panel,
    onFiles: handleFiles,
    onError: showError,
    isActive: () => !panel.hidden,
  });
  els.rescan.addEventListener('click', () => { if (current?.kind === 'still') scanStill(); });

  // Fetch + compile the wasm while the user is still choosing an input.
  (window.requestIdleCallback || setTimeout)(() => warmup());
}
