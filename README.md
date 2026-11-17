# Barritas

A single-page web app to **scan**, **decode** and **generate** barcodes and fiducial markers, entirely client-side.

**Live:** https://retrofootprints.github.io/barritas/

- Scan from the camera, image files, drag-and-drop or clipboard paste.
- Auto-detects the format, or you can force a format or a group of formats.
- Interprets known payloads: IATA boarding passes, GS1, Wi-Fi, vCard/MeCard, URLs, SEPA/EPC payments, Portuguese AT invoices, AAMVA driver licences.
- Generates barcodes (100+ symbologies) as SVG/PNG and checks each one by decoding it again.
- Detects and generates fiducial markers (ArUco, AprilTag, ARTag, …), with approximate pose estimation and printable sheets.

Nothing you scan or generate leaves your device. There is no backend, no analytics and no third-party request; a Content-Security-Policy restricts scripts to the site itself.

## How it is built

Plain JavaScript ES modules served as-is. No build step, no bundler, no npm at runtime, no GitHub Actions. GitHub Pages serves the `main` branch root.

```
index.html, app.js        page shell, tab routing, theme
css/style.css
src/scan/                 camera, file/drop/paste input, engines (native BarcodeDetector + zxing worker), overlay
src/fiducial/             marker detection worker, pose, marker generator + print sheet
src/generate/             barcode generator form, rendering, round-trip verify
src/payload/              payload interpreters (BCBP, GS1, Wi-Fi, vCard, EPC, AT, AAMVA, …)
src/util/                 hex view, copy/download, storage
vendor/                   pinned third-party libraries (see below)
samples/                  test images
tests/                    unit tests (Node) and in-browser tests
sw.js, manifest.webmanifest  offline support / installable PWA
```

To run locally, serve the folder over HTTP (the camera needs `https://` or `localhost`):

```
python -m http.server 8000
# open http://localhost:8000/
```

## Vendored libraries

Copied unmodified from npm into `vendor/`, each with its own licence file. Nothing is loaded from a CDN.

| Library | Version | Files | Licence |
|---|---|---|---|
| [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (zxing-cpp in WebAssembly) | 3.1.6 | `vendor/zxing-wasm/` (`dist/es/reader`, `dist/es/share.js`, `zxing_reader.wasm`) | MIT (zxing-cpp: Apache-2.0) |
| [bwip-js](https://github.com/metafloor/bwip-js) | 4.11.4 | `vendor/bwip-js/` (`dist/bwip-js.mjs`, `dist/bwipp.mjs`) | MIT (BWIPP: MIT; Inconsolata font: OFL) |
| [js-aruco2](https://github.com/damianofalcioni/js-aruco2) | 2.0.0 | `vendor/js-aruco2/` (`src/`) | MIT (AprilTag dictionaries: BSD-2-Clause) |

The zxing `.wasm` is served from `vendor/zxing-wasm/reader/` and wired up with `prepareZXingModule({ overrides: { locateFile } })`.

To update a library: download the new npm tarball, copy the same files over, update the version here and in `src/about.js`, and run the tests.

## Tests

- `node --test tests/` — payload parser unit tests (no dependencies).
- `tests/roundtrip.html` — open in a browser; generates every generator format with bwip-js and decodes it with zxing.
- `tests/samples.html` — decodes every image in `samples/` and compares with the expected text.

## Licence

[MIT](LICENSE) for the project code. Vendored libraries keep their own licences (next to each library in `vendor/`).
