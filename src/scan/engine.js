// Decoder engines: native BarcodeDetector (fast path where available) and zxing-wasm in a worker.
import { FROM_NATIVE, formatLabel, nativeFormatsFor, nativeCoversSelection } from './formats.js';

// ---------- zxing worker ----------

let worker = null;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error) p.reject(new Error(e.data.error));
    else p.resolve(e.data);
  };
  worker.onerror = (e) => {
    const err = new Error(e.message || 'zxing worker failed to start');
    for (const p of pending.values()) p.reject(err);
    pending.clear();
    worker = null;
  };
  return worker;
}

function call(msg, transfer = []) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...msg, id }, transfer);
  });
}

/** Start downloading/compiling the wasm early. */
export function warmup() {
  return call({ type: 'warmup' }).catch((e) => console.warn('zxing warmup failed', e));
}

export function zxingOptions(s) {
  return {
    formats: s.format ? [s.format] : [],
    tryHarder: !!s.tryHarder,
    tryRotate: !!s.tryRotate,
    tryInvert: !!s.tryInvert,
    tryDownscale: !!s.tryDownscale,
    binarizer: s.binarizer || 'LocalAverage',
    maxNumberOfSymbols: s.maxSymbols === '1' ? 1 : 255,
    textMode: 'HRI',
    eanAddOnSymbol: 'Read',
    returnErrors: false,
  };
}

function quadFromPosition(p) {
  if (!p) return null;
  return [p.topLeft, p.topRight, p.bottomRight, p.bottomLeft].map(({ x, y }) => ({ x, y }));
}

async function decodeZxing(imageData, settings, transfer) {
  const res = await call(
    { type: 'decode', image: imageData, options: zxingOptions(settings) },
    transfer ? [imageData.data.buffer] : [],
  );
  return res.results.map((r) => ({
    engine: 'zxing',
    format: r.format,
    formatLabel: formatLabel(r.format),
    text: r.text,
    bytes: r.bytes,
    quad: quadFromPosition(r.position),
    symbologyIdentifier: r.symbologyIdentifier,
    ecLevel: r.ecLevel,
    version: r.version,
    orientation: r.orientation,
    isMirrored: r.isMirrored,
    isInverted: r.isInverted,
    contentType: r.contentType,
    hasECI: r.hasECI,
    sequence: r.sequenceSize > 1 ? { size: r.sequenceSize, index: r.sequenceIndex, id: r.sequenceId } : null,
    readerInit: r.readerInit,
    lineCount: r.lineCount,
  }));
}

// ---------- native BarcodeDetector ----------

let nativeInfo = null;
const detectors = new Map();

export async function nativeSupport() {
  if (nativeInfo) return nativeInfo;
  nativeInfo = { available: false, formats: [] };
  try {
    if ('BarcodeDetector' in globalThis) {
      const formats = await globalThis.BarcodeDetector.getSupportedFormats();
      nativeInfo = { available: formats.length > 0, formats };
    }
  } catch { /* unsupported */ }
  return nativeInfo;
}

async function decodeNative(source, formats) {
  const key = formats.join(',');
  let det = detectors.get(key);
  if (!det) { det = new globalThis.BarcodeDetector({ formats }); detectors.set(key, det); }
  const found = await det.detect(source);
  const enc = new TextEncoder();
  return found.map((b) => {
    const format = FROM_NATIVE[b.format] || b.format;
    return {
      engine: 'native',
      format,
      formatLabel: formatLabel(format),
      text: b.rawValue,
      bytes: enc.encode(b.rawValue),
      bytesAreText: true, // native API only exposes the decoded string
      quad: b.cornerPoints?.length === 4 ? b.cornerPoints.map(({ x, y }) => ({ x, y })) : null,
    };
  });
}

// ---------- public ----------

/**
 * Decode barcodes in an ImageData.
 * settings.engine: 'auto' | 'native' | 'zxing'
 * opts.transfer: hand the pixel buffer to the worker (caller must not reuse imageData).
 * Returns { results, engine, ms, note }.
 */
export async function decode(imageData, settings, opts = {}) {
  const t0 = performance.now();
  const native = await nativeSupport();
  const nativeFormats = native.available ? nativeFormatsFor(settings.format || '', native.formats) : [];
  let note = '';

  const useNative = settings.engine === 'native' || (settings.engine === 'auto' && nativeFormats.length > 0);
  if (useNative) {
    if (!native.available) {
      note = 'Native BarcodeDetector is not available in this browser; used zxing instead.';
    } else if (!nativeFormats.length) {
      note = 'The native detector does not support this format; used zxing instead.';
    } else {
      try {
        const results = await decodeNative(imageData, nativeFormats);
        // Forced native: report whatever it found. Auto: fall back to zxing when native finds nothing,
        // or when the selection includes formats native can't read.
        if (results.length || settings.engine === 'native') {
          return { results, engine: 'native', ms: performance.now() - t0, note };
        }
        if (nativeCoversSelection(settings.format, native.formats) && opts.live) {
          return { results, engine: 'native', ms: performance.now() - t0, note };
        }
      } catch (e) {
        note = `Native detector failed (${e.message}); used zxing instead.`;
      }
    }
  }
  const results = await decodeZxing(imageData, settings, opts.transfer);
  return { results, engine: 'zxing', ms: performance.now() - t0, note };
}
