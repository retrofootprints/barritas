// Service worker: offline support for the whole app (scope = the folder it is served from).
// App code is network-first (always fresh online, cached offline, never a mix of versions);
// vendor/ files are pinned versions, so they are served cache-first.
// When files are added or removed, update PRECACHE (tests/sw.test.js checks it) and bump VERSION.
const VERSION = 'barritas-v1';

const PRECACHE = [
  './',
  'index.html',
  'app.js',
  'manifest.webmanifest',
  'css/style.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon-maskable.svg',
  'icons/icon.svg',
  'src/about.js',
  'src/fiducial/detect.js',
  'src/fiducial/dictionaries.js',
  'src/fiducial/generate.js',
  'src/fiducial/marker.js',
  'src/fiducial/pose.js',
  'src/fiducial/worker.js',
  'src/generate/form.js',
  'src/generate/formats.js',
  'src/generate/render.js',
  'src/generate/template-forms.js',
  'src/generate/templates.js',
  'src/payload/aamva.js',
  'src/payload/bcbp.js',
  'src/payload/epc.js',
  'src/payload/geo.js',
  'src/payload/gs1.js',
  'src/payload/index.js',
  'src/payload/mecard.js',
  'src/payload/pt-at.js',
  'src/payload/url.js',
  'src/payload/vcard.js',
  'src/payload/wifi.js',
  'src/scan/camera.js',
  'src/scan/defaults.js',
  'src/scan/engine.js',
  'src/scan/formats.js',
  'src/scan/index.js',
  'src/scan/input.js',
  'src/scan/overlay.js',
  'src/scan/results.js',
  'src/scan/worker.js',
  'src/util/dom.js',
  'src/util/hex.js',
  'src/util/io.js',
  'src/util/storage.js',
  'vendor/bwip-js/LICENSE',
  'vendor/bwip-js/LICENSE.INCONSOLATA',
  'vendor/bwip-js/bwip-js.mjs',
  'vendor/bwip-js/bwipp.mjs',
  'vendor/js-aruco2/LICENSE.txt',
  'vendor/js-aruco2/aruco.js',
  'vendor/js-aruco2/cv.js',
  'vendor/js-aruco2/dictionaries/apriltag_16h5.js',
  'vendor/js-aruco2/dictionaries/apriltag_25h7.js',
  'vendor/js-aruco2/dictionaries/apriltag_25h9.js',
  'vendor/js-aruco2/dictionaries/apriltag_36h10.js',
  'vendor/js-aruco2/dictionaries/apriltag_36h11.js',
  'vendor/js-aruco2/dictionaries/apriltag_36h9.js',
  'vendor/js-aruco2/dictionaries/artag.js',
  'vendor/js-aruco2/dictionaries/artoolkitplus.js',
  'vendor/js-aruco2/dictionaries/artoolkitplusbch.js',
  'vendor/js-aruco2/dictionaries/aruco_4x4_1000.js',
  'vendor/js-aruco2/dictionaries/aruco_5x5_1000.js',
  'vendor/js-aruco2/dictionaries/aruco_6x6_1000.js',
  'vendor/js-aruco2/dictionaries/aruco_7x7_1000.js',
  'vendor/js-aruco2/dictionaries/aruco_default.js',
  'vendor/js-aruco2/dictionaries/aruco_default_opencv.js',
  'vendor/js-aruco2/dictionaries/aruco_mip_16h3.js',
  'vendor/js-aruco2/dictionaries/aruco_mip_25h7.js',
  'vendor/js-aruco2/dictionaries/aruco_mip_36h12.js',
  'vendor/js-aruco2/dictionaries/chilitags.js',
  'vendor/js-aruco2/posit1.js',
  'vendor/js-aruco2/svd.js',
  'vendor/zxing-wasm/LICENSE',
  'vendor/zxing-wasm/reader/index.js',
  'vendor/zxing-wasm/reader/zxing_reader.wasm',
  'vendor/zxing-wasm/share.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('barritas-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (request.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  const path = url.pathname.slice(scope.pathname.length);
  event.respondWith(path.startsWith('vendor/') ? cacheFirst(request) : networkFirst(request));
});
