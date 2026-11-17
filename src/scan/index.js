// Scan tab controller: inputs, settings, live camera loop, decoding, results, history.
import { $, h, announce } from '../util/dom.js';
import { store } from '../util/storage.js';
import { beep } from '../util/io.js';
import { FORMATS, GROUPS, formatLabel } from './formats.js';
import { decode, warmup, nativeSupport } from './engine.js';
import { wireInputs, blobToCanvas, imageDataOf } from './input.js';
import { sizeOverlay, clearOverlay, drawDetections } from './overlay.js';
import { barcodeCard, markerCard, messageCard } from './results.js';
import { Camera, mapQuad } from './camera.js';
import { DEFAULTS } from './defaults.js';
import { DICTIONARIES, DICT_BY_NAME } from '../fiducial/dictionaries.js';
import { detectMarkers } from '../fiducial/detect.js';
import { focalPx, mapMarker } from '../fiducial/pose.js';

const S = { ...DEFAULTS, ...store.get('scan', {}) };
const els = {};
let history = [];
let current = null; // { kind: 'still' | 'live', name }
let cam = null;

const FRAME_INTERVAL = 100; // ms → ~10 decodes per second at most
const DEDUPE_MS = 3000; // the same code seen again within this window is not reported twice
const MAX_CARDS = 10;
const ROI_FRACTION = 0.6;

const live = {
  analysing: false, busy: false, last: 0, seen: new Map(), clearTimer: 0, frameTimes: [], frame: 0,
  barcodes: [], markers: [], barcodesAt: 0, markersAt: 0, prevMarkerIds: new Set(), markerCard: null,
};

const wantBarcodes = () => S.mode !== 'fiducials';
const wantMarkers = () => S.mode !== 'barcodes';
const dictLabel = () => DICT_BY_NAME[S.dict]?.label || S.dict;

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
  els.dict.replaceChildren(...DICTIONARIES.map((d) => h('option', { value: d.name }, d.label)));
  if (!DICT_BY_NAME[S.dict]) S.dict = DEFAULTS.dict;
}

function updateModeVisibility() {
  els.fidOpts.hidden = !wantMarkers();
  for (const id of ['#opt-format-wrap', '#opt-engine-wrap', '#zxing-opts', '#engine-info']) $(id, els.panel).hidden = !wantBarcodes();
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
  if (key === 'roi') updateRoiBox();
  if (key === 'mode') {
    updateModeVisibility();
    live.markers = [];
    live.barcodes = [];
  }
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

function showMedia(which) {
  els.placeholder.hidden = true;
  els.media.hidden = false;
  els.still.hidden = which !== 'still';
  els.video.hidden = which !== 'video';
  updateRoiBox();
}

function updateRoiBox() {
  els.roi.hidden = !(S.roi && live.analysing);
}

function setStatus(text) {
  els.status.hidden = !text;
  els.status.textContent = text || '';
}

function setResults(nodes) {
  els.results.replaceChildren(...nodes);
}

function prependResults(nodes) {
  if (els.results.querySelector('p.muted')) els.results.replaceChildren();
  els.results.prepend(...nodes);
  while (els.results.children.length > MAX_CARDS) els.results.lastElementChild.remove();
}

function updateButtons() {
  const camOn = !!cam?.active;
  els.cameraBtn.textContent = camOn ? 'Stop camera' : 'Start camera';
  els.cameraBtn.classList.toggle('primary', !camOn);
  els.freeze.hidden = !(camOn && live.analysing);
  els.again.hidden = !(camOn && !live.analysing);
  els.rescan.hidden = current?.kind !== 'still';
  els.camControls.hidden = !camOn;
  els.camControls2.hidden = !camOn;
}

// ---------- decoding stills (files, paste, frozen frames) ----------

async function scanStill() {
  const canvas = els.still;
  sizeOverlay(els.overlay, canvas.width, canvas.height);
  clearOverlay(els.overlay);
  setStatus('Decoding…');
  const nodes = [];
  const status = [];
  let barcodes = [];
  let markers = [];
  if (wantBarcodes()) {
    try {
      const { results, engine, ms, note } = await decode(imageDataOf(canvas), S);
      barcodes = results;
      if (note) nodes.push(messageCard(note, 'warn'));
      for (const r of results) {
        nodes.push(barcodeCard(r, { source: current?.name }));
        addHistory(r.formatLabel, r.text);
      }
      status.push(`${results.length} barcode${results.length === 1 ? '' : 's'} · ${engine} · ${Math.round(ms)} ms`);
    } catch (e) {
      nodes.push(messageCard(`Decoding failed: ${e.message}`, 'err'));
    }
  }
  if (wantMarkers()) {
    try {
      const img = imageDataOf(canvas);
      const f = focalPx(img.width, S);
      const res = await detectMarkers(img, S, { transfer: true });
      markers = res.markers;
      for (const m of markers) {
        nodes.push(markerCard(m, { dictLabel: dictLabel(), markerMm: S.markerMm, focalPx: f, source: current?.name }));
        addHistory(`${dictLabel()} marker`, `ID ${m.id}`);
      }
      status.push(`${markers.length} marker${markers.length === 1 ? '' : 's'} · ${Math.round(res.ms)} ms`);
    } catch (e) {
      nodes.push(messageCard(`Marker detection failed: ${e.message}`, 'err'));
    }
  }
  drawDetections(els.overlay, { barcodes, markers: markers.map(overlayMarker) });
  setStatus(status.join(' · '));
  const found = barcodes.length + markers.length;
  if (!found) {
    const what = S.mode === 'fiducials'
      ? `No ${dictLabel()} marker found. Check the dictionary, and that the marker has a white border around it.`
      : `No barcode${S.mode === 'both' ? ' or marker' : ''} found${S.format ? ` (looking for ${formatLabel(S.format)} only)` : ''}. Try “Try harder”, choose the exact format, crop closer to the code, or use a sharper image.`;
    nodes.push(messageCard(what, 'warn'));
  } else if (S.beep) {
    beep();
  }
  const first = barcodes[0] ? `${barcodes[0].formatLabel}: ${barcodes[0].text.slice(0, 120)}` : markers[0] ? `Marker ID ${markers[0].id}` : '';
  announce(found ? `${found} result${found > 1 ? 's' : ''}. ${first}` : 'Nothing found');
  setResults(nodes);
  return found;
}

/** Overlay data for a marker: corners, label and pose axes. */
function overlayMarker(m) {
  return { corners: m.corners, id: m.id, axes: m.pose?.axes, distanceMm: m.pose?.distance };
}

async function handleFiles(files) {
  if (cam?.active) stopCamera();
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
    showMedia('still');
    updateButtons();
    await scanStill();
    all.push(...els.results.childNodes);
  }
  if (files.length > 1) setResults(all);
}

function showError(text) {
  setResults([messageCard(text, 'err')]);
}

// ---------- live camera ----------

async function startCamera(deviceId) {
  cam ||= new Camera(els.video);
  setStatus('Starting camera…');
  els.placeholder.hidden = true;
  try {
    await cam.start(deviceId);
  } catch (e) {
    setStatus('');
    els.placeholder.hidden = !els.media.hidden;
    showError(e.message);
    updateButtons();
    return;
  }
  current = { kind: 'live', name: 'camera' };
  showMedia('video');
  sizeOverlay(els.overlay, cam.width, cam.height);
  clearOverlay(els.overlay);
  if (els.results.querySelector('.msg')) setResults([]);
  await setupCameraControls();
  resumeAnalysis();
}

function stopCamera() {
  live.analysing = false;
  cam?.stop();
  if (current?.kind === 'live') {
    current = null;
    els.media.hidden = true;
    els.placeholder.hidden = false;
  }
  setStatus('');
  updateRoiBox();
  updateButtons();
}

async function setupCameraControls() {
  const devices = await cam.listDevices();
  const sel = els.camDevice;
  sel.replaceChildren(...devices.map((d, i) => h('option', { value: d.deviceId }, d.label || `Camera ${i + 1}`)));
  sel.value = cam.deviceId;
  sel.closest('label').hidden = devices.length < 2;

  const caps = cam.capabilities();
  els.torch.hidden = !caps.torch;
  els.torch.setAttribute('aria-pressed', 'false');
  els.zoomWrap.hidden = !caps.zoom;
  if (caps.zoom) {
    const settings = cam.track.getSettings?.() || {};
    Object.assign(els.zoom, { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1, value: settings.zoom ?? caps.zoom.min });
    els.zoomVal.textContent = `${Number(els.zoom.value).toFixed(1)}×`;
  }
}

function resumeAnalysis() {
  if (!cam?.active) return;
  live.analysing = true;
  live.seen.clear();
  live.prevMarkerIds = new Set();
  live.markerCard = null;
  live.barcodes = [];
  live.markers = [];
  current = { kind: 'live', name: 'camera' };
  showMedia('video');
  clearOverlay(els.overlay);
  setStatus('Scanning…');
  updateButtons();
  schedule();
}

/** Stop analysing and keep the current frame on screen (pause / single-shot hit). */
function freezeFrame() {
  live.analysing = false;
  cam.snapshot(els.still);
  current = { kind: 'still', name: 'camera frame' };
  showMedia('still');
  updateButtons();
}

function schedule() {
  if (!live.analysing) return;
  if (els.video.requestVideoFrameCallback) els.video.requestVideoFrameCallback(() => tick());
  else requestAnimationFrame(() => tick());
}

async function tick() {
  if (!live.analysing) return;
  const now = performance.now();
  if (live.busy || now - live.last < FRAME_INTERVAL) { schedule(); return; }
  live.busy = true;
  live.last = now;
  try {
    const grab = cam.grab(S.roi ? ROI_FRACTION : 0);
    if (grab) {
      // "Both" alternates frames between the barcode decoder and the marker detector.
      live.frame++;
      const doMarkers = wantMarkers() && (!wantBarcodes() || live.frame % 2 === 0);
      if (doMarkers) {
        const f = focalPx(grab.image.width, S);
        const res = await detectMarkers(grab.image, S, { transfer: true });
        if (live.analysing) onLiveMarkers(res.markers.map((m) => mapMarker(m, grab)), res.ms, f * grab.scale);
      } else {
        const settings = S.singleShot ? { ...S, maxSymbols: '1' } : S;
        const { results, engine, ms } = await decode(grab.image, settings, { live: true, transfer: true });
        if (live.analysing) {
          onLiveResults(results.map((r) => ({ ...r, quad: mapQuad(r.quad, grab) })), engine, ms);
        }
      }
    }
  } catch (e) {
    console.warn(e);
    setStatus(`Decoder error: ${e.message}`);
  } finally {
    live.busy = false;
    schedule();
  }
}

function onLiveResults(results, engine, ms) {
  live.frameTimes.push(ms);
  if (live.frameTimes.length > 20) live.frameTimes.shift();
  const avg = live.frameTimes.reduce((a, b) => a + b, 0) / live.frameTimes.length;
  setStatus(`Scanning · ${engine} · ${Math.round(avg)} ms/frame`);

  if (!results.length) return;
  live.barcodes = results;
  live.barcodesAt = performance.now();
  redrawLive();

  const now = Date.now();
  const fresh = results.filter((r) => {
    const key = `${r.format}\u0000${r.text}`;
    const seenAt = live.seen.get(key);
    live.seen.set(key, now);
    return !seenAt || now - seenAt > DEDUPE_MS;
  });
  if (!fresh.length) return;

  prependResults(fresh.map((r) => barcodeCard(r, { source: 'camera' })));
  for (const r of fresh) addHistory(r.formatLabel, r.text);
  if (S.beep) beep();
  announce(`${fresh[0].formatLabel}: ${fresh[0].text.slice(0, 120)}`);

  if (S.singleShot) {
    freezeFrame();
    drawDetections(els.overlay, { barcodes: results, markers: live.markers.map(overlayMarker) });
    setStatus(`Found ${results[0].formatLabel} · ${engine}`);
  }
}

/** Draw the latest barcodes and markers together; ones not seen for a while disappear. */
function redrawLive() {
  const now = performance.now();
  const keep = 600 * (S.mode === 'both' ? 2 : 1);
  if (now - live.barcodesAt > keep) live.barcodes = [];
  if (now - live.markersAt > keep) live.markers = [];
  drawDetections(els.overlay, { barcodes: live.barcodes, markers: live.markers.map(overlayMarker) });
  clearTimeout(live.clearTimer);
  live.clearTimer = setTimeout(() => { if (live.analysing) redrawLive(); }, keep + 50);
}

function onLiveMarkers(markers, ms, focal) {
  if (S.mode === 'fiducials') setStatus(`Scanning markers · ${Math.round(ms)} ms/frame`);
  // Require a marker to be seen in two consecutive detector frames (cuts false positives).
  const stable = markers.filter((m) => live.prevMarkerIds.has(m.id));
  live.prevMarkerIds = new Set(markers.map((m) => m.id));
  if (!stable.length) {
    if (!markers.length) {
      live.markers = [];
      redrawLive();
    }
    return;
  }
  live.markers = stable;
  live.markersAt = performance.now();
  redrawLive();

  // One live card group, updated in place (the pose changes every frame).
  const box = live.markerCard && els.results.contains(live.markerCard) ? live.markerCard : h('div.results');
  box.replaceChildren(...stable.map((m) => markerCard(m, { dictLabel: dictLabel(), markerMm: S.markerMm, focalPx: focal, source: 'camera', live: true })));
  if (box !== live.markerCard) {
    live.markerCard = box;
    prependResults([box]);
  }

  const now = Date.now();
  const fresh = stable.filter((m) => {
    const key = `marker|${S.dict}|${m.id}`;
    const seenAt = live.seen.get(key);
    live.seen.set(key, now);
    return !seenAt || now - seenAt > DEDUPE_MS;
  });
  if (fresh.length) {
    for (const m of fresh) addHistory(`${dictLabel()} marker`, `ID ${m.id}`);
    if (S.beep) beep();
    announce(`Marker ID ${fresh.map((m) => m.id).join(', ')}`);
  }
  if (S.singleShot && fresh.length) {
    freezeFrame();
    drawDetections(els.overlay, { barcodes: live.barcodes, markers: stable.map(overlayMarker) });
    // Swap the live card for full cards (with the pose note) for the frozen frame.
    box.replaceChildren(...stable.map((m) => markerCard(m, { dictLabel: dictLabel(), markerMm: S.markerMm, focalPx: focal, source: 'camera' })));
    live.markerCard = null;
    setStatus(`Found marker ID ${stable.map((m) => m.id).join(', ')}`);
  }
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
    roi: $('#scan-roi', panel),
    status: $('#scan-status', panel),
    placeholder: $('#scan-placeholder', panel),
    results: $('#scan-results', panel),
    history: $('#scan-history', panel),
    rescan: $('#scan-rescan', panel),
    cameraBtn: $('#scan-camera', panel),
    freeze: $('#scan-freeze', panel),
    again: $('#scan-again', panel),
    camControls: $('#camera-controls', panel),
    camControls2: $('#camera-controls-2', panel),
    camDevice: $('#cam-device', panel),
    torch: $('#cam-torch', panel),
    zoomWrap: $('#cam-zoom-wrap', panel),
    zoom: $('#cam-zoom', panel),
    zoomVal: $('#cam-zoom-val', panel),
    dict: $('#opt-dict', panel),
    fidOpts: $('#fid-opts', panel),
  });
  populateFormats();
  bindSettings(panel);
  updateModeVisibility();
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

  els.cameraBtn.addEventListener('click', () => (cam?.active ? stopCamera() : startCamera()));
  els.freeze.addEventListener('click', () => { if (live.analysing) { freezeFrame(); setStatus('Paused — change settings and Re-scan, or Scan again'); } });
  els.again.addEventListener('click', () => resumeAnalysis());
  els.rescan.addEventListener('click', () => { if (current?.kind === 'still') scanStill(); });
  els.camDevice.addEventListener('change', () => startCamera(els.camDevice.value));
  els.torch.addEventListener('click', async () => {
    const on = els.torch.getAttribute('aria-pressed') !== 'true';
    try {
      await cam.setTorch(on);
      els.torch.setAttribute('aria-pressed', String(on));
    } catch { els.torch.hidden = true; }
  });
  els.zoom.addEventListener('input', () => {
    els.zoomVal.textContent = `${Number(els.zoom.value).toFixed(1)}×`;
    cam?.setZoom(els.zoom.value).catch(() => {});
  });

  // Release the camera when the tab or the page is hidden.
  document.addEventListener('tabchange', (e) => { if (e.detail.tab !== 'scan' && cam?.active) stopCamera(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && cam?.active) stopCamera(); });

  updateButtons();
  // Fetch + compile the wasm while the user is still choosing an input.
  (window.requestIdleCallback || setTimeout)(() => warmup());
}
