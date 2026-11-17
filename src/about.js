// About panel: supported formats, libraries and licences, privacy, limitations.
import { h } from './util/dom.js';
import { FORMATS } from './scan/formats.js';
import { GEN_FORMATS } from './generate/formats.js';
import { DICTIONARIES } from './fiducial/dictionaries.js';

const LIBRARIES = [
  ['zxing-wasm', '3.1.6', 'https://github.com/Sec-ant/zxing-wasm', 'MIT (zxing-cpp: Apache-2.0)', 'vendor/zxing-wasm/LICENSE', 'Barcode reading (zxing-cpp compiled to WebAssembly)'],
  ['bwip-js', '4.11.4', 'https://github.com/metafloor/bwip-js', 'MIT (BWIPP: MIT; Inconsolata: OFL)', 'vendor/bwip-js/LICENSE', 'Barcode generation'],
  ['js-aruco2', '2.0.0', 'https://github.com/damianofalcioni/js-aruco2', 'MIT (AprilTag dictionaries: BSD-2-Clause)', 'vendor/js-aruco2/LICENSE.txt', 'Fiducial marker detection and pose (POSIT)'],
];

const PAYLOADS = [
  'IATA boarding passes (BCBP, all legs)', 'GS1 Application Identifiers and GS1 Digital Link', 'Wi-Fi network', 'vCard and MeCard contacts',
  'SEPA / EPC payment QR', 'Portuguese invoice QR (AT / ATCUD)', 'AAMVA driver licences (US/Canada)', 'Web links (with safety hints), email, phone, SMS, geo location, 2FA setup (otpauth)',
];

function card(title, ...children) {
  return h('div.card', h('h2', title), ...children);
}

function table(head, rows) {
  return h('div.table-wrap', h('table.formats-table',
    h('thead', h('tr', head.map((t) => h('th', t)))),
    h('tbody', rows.map((r) => h('tr', r.map((c) => h('td', c))))),
  ));
}

function group(list, key) {
  const out = new Map();
  for (const item of list) {
    const k = key(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

export function init(panel) {
  const readGroups = group(FORMATS, (f) => f[2]);
  const genGroups = group(GEN_FORMATS, (f) => f.group);

  panel.replaceChildren(
    card('About Barritas',
      h('p', 'Scan, decode and generate barcodes and fiducial markers. Everything runs in your browser: there is no server, no tracking and no third-party request. Images from your camera or files never leave this device.'),
      h('p.small.muted', 'Installable as an app and works offline after the first visit. Source code: ', h('a', { href: 'https://github.com/retrofootprints/barritas', target: '_blank', rel: 'noopener noreferrer' }, 'github.com/retrofootprints/barritas'), ' (MIT licence).'),
    ),

    card('Privacy',
      h('ul',
        h('li', 'All decoding, generating and marker detection happens on this device.'),
        h('li', 'A Content-Security-Policy only allows scripts from this site; nothing is loaded from other servers.'),
        h('li', 'Settings (theme, scan options, last generator format) are kept in this browser’s local storage. Recent scans stay in memory unless you tick “Remember on this device”.'),
        h('li', 'Boarding passes and driver licences contain personal data. They are shown to you only and never sent anywhere.'),
      ),
      h('button', {
        type: 'button',
        onclick: (e) => {
          try {
            Object.keys(localStorage).filter((k) => k.startsWith('barritas.')).forEach((k) => localStorage.removeItem(k));
            e.target.textContent = 'Cleared — reload to apply defaults';
          } catch { e.target.textContent = 'Storage not available'; }
        },
      }, 'Clear saved settings and history'),
    ),

    card('Reads (scan)',
      table(['Family', 'Formats'], [...readGroups].map(([fam, items]) => [fam, items.map((f) => f[1]).join(', ')])),
      h('p.small.muted', 'Uses the browser’s native BarcodeDetector where available (mostly Android/Chromium) and zxing-wasm everywhere else. Postal 4-state codes, DotCode and Han Xin cannot be read in the browser. MaxiCode needs a clean, unrotated image.'),
    ),

    card('Interprets',
      h('ul', PAYLOADS.map((p) => h('li', p))),
      h('p.small.muted', 'Anything else is shown as text, with a hex dump and the detected encoding under “Details and raw bytes”.'),
    ),

    card('Generates',
      table(['Family', 'Formats (✓ = verified by decoding it again)'], [...genGroups].map(([g, items]) => [g, items.map((f) => `${f.label}${f.zxing ? ' ✓' : ''}`).join(', ')])),
    ),

    card('Fiducial markers',
      h('p', DICTIONARIES.map((d) => d.label).join(' · ')),
      h('p.small.muted', 'Generated markers have a one-cell black border (the layout the detector expects). Pose (distance and rotation) uses POSIT with a focal length estimated from the field of view, so it is approximate unless you enter your camera’s 35 mm-equivalent focal length.'),
    ),

    card('Libraries and licences',
      table(['Library', 'Version', 'Used for', 'Licence'], LIBRARIES.map(([name, ver, url, lic, file, use]) => [
        h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, name), ver, use, h('a', { href: file, target: '_blank' }, lic),
      ])),
      h('p.small.muted', 'Barritas itself is MIT-licensed. Libraries are vendored (copied into the site) and pinned to these versions.'),
    ),

    card('Tips and tests',
      h('ul',
        h('li', 'Paste an image with Ctrl/⌘+V or drop it anywhere on the Scan tab.'),
        h('li', 'Use the arrow keys to move between tabs.'),
        h('li', 'Pause the camera to freeze a frame, change settings and Re-scan it.'),
        h('li', 'Self-tests: ',
          h('a', { href: 'tests/samples.html' }, 'sample images'), ' · ',
          h('a', { href: 'tests/roundtrip.html' }, 'generator round-trip'), ' · ',
          h('a', { href: 'tests/pose.html' }, 'marker pose')),
      ),
    ),
  );
}
