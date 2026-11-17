// bwip-js rendering (SVG / canvas / PNG) and round-trip verification with zxing.
import { BY_BCID, RMQR_VERSIONS, normaliseForCompare, expectedForms } from './formats.js';
import { decode } from '../scan/engine.js';

let bwipPromise = null;
/** bwip-js is ~2.3 MB, so it is only loaded when something needs it. */
export function loadBwip() {
  bwipPromise ||= import('../../vendor/bwip-js/bwip-js.mjs').then((m) => m.default);
  return bwipPromise;
}

const hex = (c) => String(c || '').replace(/^#/, '');

/**
 * Build bwip-js options.
 * common: { scale, quiet, fg, bg, rotate, height, includetext, textsize }
 * extra:  per-format bwip options (already validated), e.g. { eclevel: 'M', version: '5' }
 */
export function buildOptions(bcid, text, common = {}, extra = {}) {
  const o = { ...(BY_BCID[bcid]?.defaults || {}), bcid, text, scale: Number(common.scale) || 3, rotate: common.rotate || 'N' };
  const q = Number(common.quiet);
  if (Number.isFinite(q) && q >= 0) { o.paddingwidth = q; o.paddingheight = q; }
  if (common.fg) o.barcolor = hex(common.fg);
  if (common.bg) o.backgroundcolor = hex(common.bg);
  if (common.height) o.height = Number(common.height);
  if (common.includetext) {
    o.includetext = true;
    o.textxalign = 'center';
    if (common.textsize) o.textsize = Number(common.textsize);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v === '' || v === undefined || v === null || v === false) continue;
    o[k] = v;
  }
  return o;
}

/** rMQR has no automatic sizing in bwip-js: try sizes from smallest until the data fits. */
function withSize(bwip, options, fn) {
  if (options.bcid !== 'rectangularmicroqrcode' || (options.version && options.version !== 'auto')) {
    const { version, ...rest } = options;
    return fn(version === 'auto' ? rest : options);
  }
  let last;
  for (const version of RMQR_VERSIONS) {
    try { return fn({ ...options, version }); } catch (e) { last = e; }
  }
  throw last;
}

export async function renderSVG(options) {
  const bwip = await loadBwip();
  return withSize(bwip, options, (o) => bwip.toSVG(o));
}

export async function renderCanvas(options, canvas = document.createElement('canvas')) {
  const bwip = await loadBwip();
  withSize(bwip, options, (o) => bwip.toCanvas(canvas, o));
  return canvas;
}

/** Turn bwip-js errors ("bwipp.ean13badLength#4401: EAN-13 must be 12 or 13 digits") into friendly text. */
export function friendlyError(e) {
  const msg = String(e?.message || e);
  const m = msg.match(/^bwipp?\.\w+#?\d*:\s*(.*)$/s);
  return m ? m[1] : msg;
}

/**
 * Render with the user's options, place on white with a margin (as if printed),
 * then decode with zxing. Returns { status, detail, decoded? }:
 *   pass      — read back and the text matches
 *   decoded   — read back, but the text differs (e.g. ISBN/ISSN mapping, GS1 formatting)
 *   fail      — zxing could not read it
 *   na        — no browser decoder exists for this symbology
 */
export async function verify(bcid, options, expectedText) {
  const fmt = BY_BCID[bcid];
  if (fmt && !fmt.zxing) return { status: 'na', detail: 'No in-browser decoder exists for this symbology, so it cannot be verified here.' };
  const src = await renderCanvas({ ...options, scale: Math.max(2, Math.min(Number(options.scale) || 2, 4)) });
  const margin = 40;
  const c = document.createElement('canvas');
  c.width = src.width + margin * 2;
  c.height = src.height + margin * 2;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, margin, margin);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const { results } = await decode(img, {
    engine: 'zxing', format: '', tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true,
    maxSymbols: 'many', binarizer: 'LocalAverage',
  }, { transfer: true });
  if (!results.length) return { status: 'fail', detail: 'zxing could not read the generated image.' };
  const want = expectedForms(bcid, expectedText);
  const match = results.find((r) => want.has(normaliseForCompare(r.text)));
  const r = match || results[0];
  const decoded = { format: r.format, formatLabel: r.formatLabel, text: r.text };
  if (match) return { status: 'pass', detail: `Read back as ${r.formatLabel}: “${r.text}”.`, decoded };
  return { status: 'decoded', detail: `Read back as ${r.formatLabel}: “${r.text}” (differs from the input text).`, decoded };
}
