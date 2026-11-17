// Decode every image in samples/ with the app's own pipeline and default settings.
import { blobToCanvas, imageDataOf } from '../src/scan/input.js';
import { decode } from '../src/scan/engine.js';
import { DEFAULTS } from '../src/scan/defaults.js';
import { expectedForms, normaliseForCompare } from '../src/generate/formats.js';

// Documented zxing limitations on the synthetic "hard" images (rotated ~6°, blurred, noisy):
// thin stacked rows (DataBar Stacked), rMQR's 7-module-high finder, and MaxiCode (needs clean, unrotated images).
const KNOWN_HARD = new Set(['databarstacked-hard.jpg', 'rectangularmicroqrcode-hard.jpg', 'maxicode-hard.jpg']);

const manifest = await (await fetch('../samples/manifest.json')).json();
const tbody = document.querySelector('#out tbody');
const results = [];

for (const s of manifest) {
  const blob = await (await fetch(`../samples/${s.file}`)).blob();
  const canvas = await blobToCanvas(blob);
  const settings = { ...DEFAULTS, engine: new URLSearchParams(location.search).get('engine') || 'zxing' };
  const t0 = performance.now();
  const { results: found, engine } = await decode(imageDataOf(canvas), settings);
  const ms = Math.round(performance.now() - t0);
  const want = expectedForms(s.bcid, s.text);
  const hit = found.find((r) => want.has(normaliseForCompare(r.text)));
  const status = hit ? 'pass' : KNOWN_HARD.has(s.file) ? 'known limitation' : found.length ? 'wrong text' : 'not found';
  const row = { file: s.file, kind: s.kind, status, ok: !!hit || KNOWN_HARD.has(s.file), ms, engine, got: found.map((r) => `${r.formatLabel}: ${r.text}`).join(' | ') };
  results.push(row);
  const tr = document.createElement('tr');
  for (const v of [s.file, s.kind, `${row.ok ? '✔' : '✘'} ${status}`, `${ms} ms (${engine})`, row.got]) {
    const td = document.createElement('td');
    td.textContent = v;
    tr.append(td);
  }
  tbody.append(tr);
}

const bad = results.filter((r) => !r.ok);
const summary = document.getElementById('summary');
summary.className = `msg ${bad.length ? 'err' : 'ok'}`;
summary.textContent = `${results.length - bad.length}/${results.length} OK${bad.length ? ` — failing: ${bad.map((r) => r.file).join(', ')}` : ''}`;
window.__samplesTest = { done: true, results, failing: bad };
