// zxing-wasm decoder running in a module Web Worker.
// Protocol: { id, type: 'decode', image: ImageData, options } -> { id, results, ms } | { id, error }
//           { id, type: 'warmup' } -> { id, ready: true }
import { prepareZXingModule, readBarcodes, ZXING_WASM_VERSION } from '../../vendor/zxing-wasm/reader/index.js';

const wasmUrl = new URL('../../vendor/zxing-wasm/reader/zxing_reader.wasm', import.meta.url).href;

// Serve the .wasm from this site instead of the library's default CDN.
prepareZXingModule({
  overrides: {
    locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
  },
});

function serialise(r) {
  return {
    format: r.format,
    symbology: r.symbology,
    text: r.text,
    bytes: new Uint8Array(r.bytes), // own copy, so it can be transferred
    isValid: r.isValid,
    error: r.error,
    contentType: r.contentType,
    hasECI: r.hasECI,
    ecLevel: r.ecLevel,
    version: r.version,
    orientation: r.orientation,
    isMirrored: r.isMirrored,
    isInverted: r.isInverted,
    symbologyIdentifier: r.symbologyIdentifier,
    sequenceSize: r.sequenceSize,
    sequenceIndex: r.sequenceIndex,
    sequenceId: r.sequenceId,
    readerInit: r.readerInit,
    lineCount: r.lineCount,
    extra: r.extra,
    position: r.position && {
      topLeft: { ...r.position.topLeft },
      topRight: { ...r.position.topRight },
      bottomRight: { ...r.position.bottomRight },
      bottomLeft: { ...r.position.bottomLeft },
    },
  };
}

self.onmessage = async (e) => {
  const { id, type, image, options } = e.data;
  try {
    if (type === 'warmup') {
      // Decode a tiny blank image to force the wasm download + compile.
      await readBarcodes(new ImageData(8, 8), { formats: ['QRCode'] });
      self.postMessage({ id, ready: true, version: ZXING_WASM_VERSION });
      return;
    }
    const t0 = performance.now();
    const results = await readBarcodes(image, options);
    const out = results.map(serialise);
    self.postMessage({ id, results: out, ms: performance.now() - t0 }, out.map((r) => r.bytes.buffer));
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
