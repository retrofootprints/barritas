// Builds the images in samples/: for every readable format, one clean PNG and one "hard" JPEG
// (rotated, blurred, low contrast, noisy, downscaled), plus a few special cases.
// Open tests/make-samples.html and use the download links (or let a test harness collect window.__samples).
import { GEN_FORMATS, applyCheckDigit } from '../src/generate/formats.js';
import { buildOptions, renderCanvas } from '../src/generate/render.js';
import { getDictionary } from '../src/fiducial/detect.js';
import { markerCanvas } from '../src/fiducial/marker.js';

// Deterministic noise so regenerated samples are identical.
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function onWhite(src, margin) {
  const c = document.createElement('canvas');
  c.width = src.width + margin * 2;
  c.height = src.height + margin * 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, margin, margin);
  return c;
}

function harden(src, seed, { angle = 6, blur = 0.6, scale = 0.9, contrast = 0.6, noise = 16 } = {}) {
  const a = (angle * Math.PI) / 180;
  const w = Math.ceil((Math.abs(Math.cos(a)) * src.width + Math.abs(Math.sin(a)) * src.height) * scale) + 40;
  const h = Math.ceil((Math.abs(Math.sin(a)) * src.width + Math.abs(Math.cos(a)) * src.height) * scale) + 40;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate(a);
  ctx.scale(scale, scale);
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';
  const img = ctx.getImageData(0, 0, w, h);
  const r = rng(seed);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 2 * noise;
    // Uneven lighting: darker towards the bottom-right.
    const p = i / 4;
    const shade = 1 - 0.18 * (((p % w) / w + Math.floor(p / w) / h) / 2);
    for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, (70 + d[i + k] * contrast + n) * shade));
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function invert(src) {
  const c = onWhite(src, 0);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) for (let k = 0; k < 3; k++) img.data[i + k] = 255 - img.data[i + k];
  ctx.putImageData(img, 0, 0);
  return c;
}

function tiny(src, target = 90) {
  const k = target / Math.max(src.width, src.height);
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k) + 16;
  c.height = Math.round(src.height * k) + 16;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 8, 8, c.width - 16, c.height - 16);
  return c;
}

// How zxing reports these symbologies (different from the generator's input text).
const READ_AS = { issn: '9770311175001', code32: 'A012345676', aztecrune: '025' };

const samples = [];
const seen = new Set();
let seed = 1;
for (const fmt of GEN_FORMATS) {
  if (!fmt.zxing || seen.has(fmt.bcid)) continue;
  seen.add(fmt.bcid);
  const { text, error } = applyCheckDigit(fmt, fmt.sample);
  const data = error ? fmt.sample : text;
  const opts = buildOptions(fmt.bcid, data, { scale: 3, quiet: 0, includetext: fmt.kind === 'ean' });
  const clean = onWhite(await renderCanvas(opts), 30);
  const base = fmt.bcid.toLowerCase();
  const expect = READ_AS[fmt.bcid] || data;
  samples.push({ file: `${base}-clean.png`, bcid: fmt.bcid, format: fmt.zxing, text: expect, kind: 'clean', url: clean.toDataURL('image/png') });
  samples.push({ file: `${base}-hard.jpg`, bcid: fmt.bcid, format: fmt.zxing, text: expect, kind: 'hard', url: harden(clean, seed++).toDataURL('image/jpeg', 0.72) });
}

// Special cases from the test plan: inverted (white on black) and tiny codes.
const qr = GEN_FORMATS.find((f) => f.bcid === 'qrcode');
const qrClean = onWhite(await renderCanvas(buildOptions('qrcode', qr.sample, { scale: 4, quiet: 0 })), 30);
samples.push({ file: 'qrcode-inverted.png', bcid: 'qrcode', format: 'QRCode', text: qr.sample, kind: 'inverted', url: invert(qrClean).toDataURL('image/png') });
const dm = onWhite(await renderCanvas(buildOptions('datamatrix', 'TINY', { scale: 4, quiet: 0 })), 16);
samples.push({ file: 'datamatrix-tiny.png', bcid: 'datamatrix', format: 'DataMatrix', text: 'TINY', kind: 'tiny', url: tiny(dm, 48).toDataURL('image/png') });
const e13 = onWhite(await renderCanvas(buildOptions('ean13', '5901234123457', { scale: 2, quiet: 0, includetext: true })), 20);
samples.push({ file: 'ean13-tiny.png', bcid: 'ean13', format: 'EAN13', text: '5901234123457', kind: 'tiny', url: tiny(e13, 190).toDataURL('image/png') });

// Fiducial markers: a clean one, a "photo" one, and a barcode + marker together (for "Both" mode).
for (const [dictName, id, kind] of [['ARUCO_MIP_36h12', 3, 'clean'], ['APRILTAG_36h11', 7, 'hard'], ['ARUCO_4X4_1000', 42, 'clean']]) {
  const d = await getDictionary(dictName);
  const m = onWhite(markerCanvas(d.codes[id], d.size, { cellPx: 16, quiet: 1 }), 24);
  const img = kind === 'hard' ? harden(m, seed++, { angle: 14, blur: 0.8, scale: 0.6 }) : m;
  const file = `marker-${dictName.toLowerCase()}-${id}-${kind}.${kind === 'hard' ? 'jpg' : 'png'}`;
  samples.push({ file, marker: { dict: dictName, id }, kind: `marker ${kind}`, url: kind === 'hard' ? img.toDataURL('image/jpeg', 0.75) : img.toDataURL('image/png') });
}
{
  const d = await getDictionary('ARUCO_MIP_36h12');
  const m = markerCanvas(d.codes[11], d.size, { cellPx: 14, quiet: 1 });
  const q = await renderCanvas(buildOptions('qrcode', 'Both modes', { scale: 5, quiet: 4 }));
  const c = document.createElement('canvas');
  c.width = m.width + q.width + 120;
  c.height = Math.max(m.height, q.height) + 80;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(m, 40, 40);
  ctx.drawImage(q, m.width + 80, 40);
  samples.push({ file: 'both-qrcode-and-marker.png', bcid: 'qrcode', format: 'QRCode', text: 'Both modes', marker: { dict: 'ARUCO_MIP_36h12', id: 11 }, kind: 'both', url: c.toDataURL('image/png') });
}

const manifest = samples.map(({ url, ...rest }) => rest);
window.__samples = { done: true, samples, manifest };

const list = document.getElementById('list');
for (const s of samples) {
  const a = document.createElement('a');
  a.href = s.url;
  a.download = s.file;
  a.textContent = s.file;
  const li = document.createElement('li');
  li.append(a);
  list.append(li);
}
const m = document.createElement('a');
m.href = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }));
m.download = 'manifest.json';
m.textContent = 'manifest.json';
const li = document.createElement('li');
li.append(m);
list.prepend(li);
document.getElementById('status').textContent = `${samples.length} images ready.`;
