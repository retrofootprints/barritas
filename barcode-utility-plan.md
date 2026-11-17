# Barcode Utility — Project Plan

A single-page web app to **scan**, **decode** and **generate** barcodes and fiducial markers, entirely client-side, hosted on **GitHub Pages**.

---

## 1. Goals

- Read barcodes from camera, uploaded files, drag-and-drop and clipboard paste.
- **Auto-detect** format by default; allow **forcing** a format or format group.
- Interpret known payloads (boarding passes, GS1, Wi-Fi, payments…) into readable fields.
- Generate barcodes in many formats as SVG/PNG.
- Detect and generate fiducial markers (ArUco, AprilTag, ARTag).
- No backend, no tracking; all processing stays on the device.

### Non-goals

- Batch mode (folders of images, CSV export). This is a one-at-a-time utility: read one, generate one.
- Reading postal 4-state codes, DotCode, Han Xin (no solid open-source browser decoder).
- Native mobile apps, backend, build pipeline.

---

## 2. Tech stack

| Concern | Library | Notes |
|---|---|---|
| Barcode reading | [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (`zxing-wasm/reader`) | zxing-cpp compiled to WASM, ~1.04 MiB |
| Native fast path | `BarcodeDetector` (browser API) | Chromium/Android only; feature-detect |
| Barcode generation | [bwip-js](https://github.com/metafloor/bwip-js) | 100+ symbologies, canvas or SVG |
| Fiducials (detect + dictionaries) | [js-aruco2](https://github.com/damianofalcioni/js-aruco2) | Pure JS; ArUco, AprilTag, ARTag dictionaries |
| Fiducials (alt. AprilTag) | [apriltag-js-standalone](https://github.com/arenaxr/apriltag-js-standalone) | Optional; official C lib in WASM |
| Hosting | GitHub Pages | HTTPS (needed for camera), static only |

**Decisions (settled)**

- [x] **No build step.** Plain JavaScript ES modules, served as-is. No bundler, no npm at runtime, no GitHub Actions.
- [x] **Libraries vendored** into `vendor/` (copied into the repo, versions pinned and noted in README).
- [x] **WASM self-hosted** in `vendor/zxing-wasm/`; nothing loaded from a CDN at runtime.
- [x] **File structure:** `index.html` + `app.js` + small modules under `src/` (see §3).
- [x] **License: MIT** for project code. (Having no license would legally mean "all rights reserved", so MIT is the simple way to make it open.) Keep each vendored library's own LICENSE file next to it.
- [x] **Fully static.** No server code, no third-party requests, no analytics. A Content-Security-Policy `<meta>` tag restricts scripts to the site itself.

---

## 3. Repository layout (proposed)

```
/
├── index.html
├── app.js                 # bootstrap, tab routing, state
├── css/style.css
├── src/
│   ├── scan/
│   │   ├── camera.js      # getUserMedia, torch, zoom, device picker
│   │   ├── input.js       # file / drag-drop / paste
│   │   ├── engine.js      # BarcodeDetector vs zxing selection
│   │   ├── worker.js      # zxing decode in a Web Worker
│   │   └── overlay.js     # draw result quads on canvas
│   ├── fiducial/
│   │   ├── detect.js      # js-aruco2 wrapper
│   │   ├── pose.js        # pose estimation (js-aruco2 POSIT) + axis overlay
│   │   └── generate.js    # render marker bits to SVG
│   ├── generate/
│   │   ├── form.js        # format picker + per-format options
│   │   └── render.js      # bwip-js → SVG/PNG, verify round-trip
│   ├── payload/
│   │   ├── index.js       # dispatcher: try each parser
│   │   ├── bcbp.js        # IATA boarding pass (M1)
│   │   ├── gs1.js         # GS1 Application Identifiers
│   │   ├── wifi.js, vcard.js, mecard.js, url.js, geo.js
│   │   ├── epc.js         # SEPA / EPC payment QR
│   │   ├── pt-at.js       # Portuguese invoice QR (AT / ATCUD)
│   │   └── aamva.js       # US/CA driver licence PDF417
│   └── util/              # hex view, copy, download, storage
├── vendor/
│   ├── zxing-wasm/        # reader JS + zxing_reader.wasm
│   ├── bwip-js/
│   └── js-aruco2/
├── samples/               # test images per format
├── .nojekyll
├── LICENSE                # MIT
└── README.md
```

---

## 4. Features

### 4.1 Scan tab

**Inputs**
- [ ] Live camera (rear camera default, device picker)
- [ ] Torch toggle and zoom (where `MediaTrackCapabilities` allows)
- [ ] Image upload (multiple files)
- [ ] Drag-and-drop
- [ ] Paste from clipboard
- [ ] Pause / freeze-frame and re-scan the frozen frame with different settings

**Mode**
- [ ] Barcodes / Fiducials / Both (alternate frames in "Both")

**Engine**
- [ ] Auto: native `BarcodeDetector` if available *and* supports the chosen format → else zxing-wasm
- [ ] Force native / force zxing (for comparison)
- [ ] Show which engine produced each result

**Format selection**
- [ ] Auto (All)
- [ ] Groups: Linear, Matrix, Retail, Industrial, GS1
- [ ] Single format (full list from zxing-wasm)

**Reader options (zxing)**
- [ ] Try harder
- [ ] Try rotate
- [ ] Try invert (white-on-black codes)
- [ ] Try downscale
- [ ] Max number of symbols (1 / many)
- [ ] Binarizer choice (advanced)

**Fiducial options**
- [ ] Dictionary: ArUco original, ARUCO_MIP_36h12, AprilTag 36h11 / 25h9 / 16h5, ARTag, …
- [ ] Max Hamming distance / error tolerance

**Fiducial pose estimation (in v1)**
- [ ] Inputs: printed marker size (mm) and camera focal length
- [ ] Focal length: estimate from an assumed field of view (default ~65° horizontal), with a manual override field
- [ ] Output per marker: distance (mm), rotation (yaw / pitch / roll), translation vector
- [ ] Overlay: draw 3D axes (X red, Y green, Z blue) on each detected marker
- [ ] Show a note that accuracy depends on the focal-length estimate (no calibration in v1)

**Performance**
- [ ] Decode in a Web Worker, transfer `ImageData`/`ImageBitmap`
- [ ] Throttle to ~10 fps; skip frames while busy
- [ ] Optional region-of-interest crop (centre box) for speed

**Output**
- [ ] Overlay: quad outline + label on video/canvas
- [ ] Result card: format, text, raw bytes (hex), symbology identifier, EC level, orientation
- [ ] Copy / open link / share buttons
- [ ] Beep / vibrate on new result (toggle)
- [ ] De-duplicate repeated reads
- [ ] Single-shot by default: stop scanning after the first result, "Scan again" button
- [ ] Short recent list (last ~10, in-memory or localStorage, clearable). No export.

### 4.2 Payload interpreters

Run on every decoded result; show a structured view when recognised, raw otherwise. **All of these are in v1.** They are plain text parsers with no cost or dependencies.

- [ ] **IATA BCBP (M1)** — name, PNR, from/to, carrier, flight, Julian date, class, seat, sequence, multi-leg
- [ ] **GS1** — parse AIs (GTIN, batch, expiry, serial…) from `]C1`, `]e0`, `]d2`, `]Q3`, FNC1/GS separators
- [ ] **URL**, **mailto**, **tel**, **sms**, **geo**
- [ ] **Wi-Fi** (`WIFI:T:…;S:…;P:…;;`)
- [ ] **vCard** / **MeCard**
- [ ] **EPC / SEPA payment QR** (`BCD` header)
- [ ] **Portuguese AT invoice QR** (`A:` NIF … `H:` ATCUD fields)
- [ ] **AAMVA** driver licence (PDF417)
- [ ] Fallback: text + hex dump + detected encoding

### 4.3 Generate barcodes tab

- [ ] Format dropdown grouped by family (bwip-js `bcid`)
- [ ] Data input with per-format validation and helpful errors
- [ ] Auto check digits (EAN/UPC/ITF-14)
- [ ] Per-format options:
  - [ ] QR: EC level, version, mask, Micro QR / rMQR
  - [ ] Aztec: EC %, compact/full, layers
  - [ ] Data Matrix: size, square/rectangular, GS1 mode
  - [ ] PDF417: columns, rows, EC level, compact
  - [ ] Linear: bar height, include text, text font size, add-ons
- [ ] Common: scale, quiet zone, foreground/background colour, rotation
- [ ] Output: live SVG preview, download SVG / PNG, copy image
- [ ] **Verify**: decode generated image with zxing and show pass/fail
- [ ] Templates: Wi-Fi, vCard, URL, GS1 builder, sample BCBP builder, EPC payment

### 4.4 Generate fiducials tab

- [ ] Dictionary + ID picker (with valid ID range shown)
- [ ] Marker size (mm) and border width
- [ ] SVG output (crisp for print), PNG download
- [ ] Print sheet: grid of IDs, exact mm sizing, labels, cut marks
- [ ] Verify by detecting the rendered marker

### 4.5 Cross-cutting

- [ ] Responsive / mobile-first layout
- [ ] Dark mode
- [ ] Accessible: keyboard nav, ARIA live region for results
- [ ] Offline support (service worker / PWA manifest, installable)
- [ ] Settings persisted in localStorage (wrapped in try/catch)
- [ ] Shareable URL params for generator state (e.g. `?f=qrcode&d=hello`)
- [ ] "About" panel: supported formats, libraries, licences, privacy note

---

## 5. Milestones

| # | Milestone | Scope | Done when |
|---|---|---|---|
| M1 | Skeleton + deploy | Repo, Pages, tabs shell, vendored libs | Page loads on `*.github.io` |
| M2 | Scan from images | zxing-wasm, file/drag/paste, format + options | Sample images decode correctly |
| M3 | Live camera | getUserMedia, worker, overlay, native fast path | Scans on Android Chrome + iOS Safari |
| M4 | Generator | bwip-js form, SVG/PNG, verify round-trip | Every listed format generates + verifies |
| M5 | Fiducials | Detect in Scan tab, pose + axes overlay, generator tab, print sheet | Printed markers detected by ID; distance within ~10% at 30–100 cm |
| M6 | Payload interpreters | BCBP, GS1, Wi-Fi, vCard, EPC, AT, AAMVA | Each parser has test fixtures |
| M7 | Polish | PWA, history, a11y, dark mode, About | Lighthouse PWA + a11y pass |

---

## 6. GitHub Pages checklist

- [ ] Repo created; Pages enabled: **Deploy from a branch → `main` / root** (no Actions)
- [ ] HTTPS enforced (default on `*.github.io`)
- [ ] CSP `<meta>` tag: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' data: blob:; media-src 'self' blob:`
- [ ] `.wasm` self-hosted under `vendor/`; zxing-wasm pointed at it (`prepareZXingModule` / `locateFile`)
- [ ] All asset paths relative (works under `/<repo>/` sub-path)
- [ ] Add `.nojekyll` (avoids Jekyll ignoring `_`-prefixed files)
- [ ] Optional custom domain + DNS
- [ ] Service worker scope matches the repo sub-path

---

## 7. Testing

- [ ] `samples/` folder: at least one clean + one hard image per format
- [ ] Generated-then-decoded round-trip test for every generator format
- [ ] Payload parser unit tests with fixed strings (incl. multi-leg BCBP)
- [ ] Device matrix:
  - [ ] Android Chrome (native `BarcodeDetector`)
  - [ ] iOS Safari (zxing fallback)
  - [ ] Desktop Chrome / Firefox / Safari
- [ ] Low light, glare, screen-to-camera (phone boarding pass), inverted codes, tiny codes
- [ ] Performance: frame time in worker, memory over 5 min of scanning

---

## 8. Risks & open questions

| Risk / question | Mitigation |
|---|---|
| WASM size (~1 MiB) slows first load on mobile | Lazy-load per tab; cache via service worker |
| `BarcodeDetector` inconsistent across platforms | Always keep zxing fallback; show engine used |
| MaxiCode reading needs clean, unrotated images | Document limitation in UI |
| Fiducial false positives in "Both" mode | Restrict dictionary; require stable detection over N frames |
| Pose accuracy without camera calibration | FOV-based focal estimate + manual override; label values as approximate |
| BCBP / AAMVA contain personal data | Never send anywhere; clear-history button; privacy note |
| bwip-js bundle size | Load only when Generate tab opens |
| Library updates break API | Pin versions in `vendor/`; note versions in README |

**Open questions**

- [ ] Repo name / URL — to be provided when starting in Claude Code

**Resolved**

- [x] Build step → none, plain JS, vendored libs, no Actions
- [x] File structure → `index.html` + modules
- [x] WASM → self-hosted copy in repo
- [x] License → MIT
- [x] Payload interpreters → all of them in v1
- [x] Fiducial pose estimation → in v1
- [x] Batch mode → not wanted

---

## 9. Format reference

### Read (zxing-wasm) — and write via bwip-js

| Family | Formats |
|---|---|
| Retail 1D | EAN-13, EAN-8, UPC-A, UPC-E, ISBN, EAN-2/5 add-ons (write only in zxing) |
| GS1 DataBar | Omni, Stacked, Limited, Expanded, Expanded Stacked |
| Industrial 1D | Code 128, Code 39 (+ Extended, PZN, Code 32, VIN), Code 93, ITF, ITF-14, Codabar, Telepen |
| Stacked / 2D | PDF417, Compact PDF417, MicroPDF417, QR (Model 1 read-only, Model 2), Micro QR, rMQR, Data Matrix, Aztec (+ Rune), MaxiCode (limited read) |
| Other | DX Film Edge |

### Generate only (bwip-js)

Postal 4-state (USPS IMb, Royal Mail, KIX, Australia Post), POSTNET/PLANET, DotCode, Han Xin, Grid Matrix, Ultracode, Code One, Pharmacode, MSI/Plessey, Code 11, and more.

### Fiducials (js-aruco2)

ArUco (original + MIP 36h12), AprilTag families, ARTag, ARToolKitPlus, ChiliTags.

### Payload standards riding on top

| Payload | Usual carrier |
|---|---|
| IATA BCBP (Resolution 792) | PDF417 (paper), Aztec / QR / Data Matrix (mobile) |
| Airline bag tag | ITF (10-digit licence plate) |
| GS1 Application Identifiers | GS1-128, GS1 DataMatrix, GS1 QR, DataBar |
| AAMVA driver licence | PDF417 |
| EPC / SEPA payment | QR |
| Portuguese AT invoice | QR |
| UIC rail tickets | Aztec |

---

## 10. Kickoff prompt for Claude Code

> Build the barcode utility described in `barcode-utility-plan.md` in this repo (`<repo name>`), hosted on GitHub Pages from `main` / root. Plain JavaScript ES modules, no build step, no CDN at runtime: download and vendor zxing-wasm (reader + `.wasm`), bwip-js and js-aruco2 into `vendor/` with their licences, and point zxing-wasm at the local `.wasm`. Add MIT `LICENSE`, `.nojekyll` and the CSP meta tag from §6. Work milestone by milestone (M1 → M7), committing after each, and tick the checkboxes in the plan as items are done. Use relative paths so it works under `/<repo>/`.
