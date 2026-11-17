// Fiducial marker detection (js-aruco2) + POSIT pose estimation in a classic Web Worker.
// Messages:
//   { id, type: 'dict', dict, files }                       -> { id, dict: { name, nBits, size, count, tau, codes } }
//   { id, type: 'detect', image, dict, file, maxErrors, markerMm, focalPx } -> { id, markers, ms }
/* global AR, CV, POS */
importScripts('../../vendor/js-aruco2/cv.js', '../../vendor/js-aruco2/aruco.js', '../../vendor/js-aruco2/svd.js', '../../vendor/js-aruco2/posit1.js');

// Same pipeline as js-aruco2's Detector.detect, with two fixes (kept here so the vendored file is unmodified):
// 1. It warps every candidate to 49×49 px and samples floor(49 / cells) px per cell, which drifts for
//    markers that are not 7 or 8 cells wide (7×7 ArUco, Chilitags…). Warp to 7 px per cell instead.
// 2. notTooNear() drops the smaller of two nearby squares. For small markers that is the black marker
//    itself (its corners are < 10 px from those of the white border around it), so small markers were
//    never decoded. Decode every candidate and de-duplicate the decoded markers instead.
AR.Detector.prototype.detect = function detect(image) {
  CV.grayscale(image, this.grey);
  CV.adaptiveThreshold(this.grey, this.thres, 2, 7);
  this.contours = CV.findContours(this.thres, this.binary);
  this.candidates = this.findCandidates(this.contours, image.width * 0.01, 0.05, 10);
  this.candidates = this.clockwiseCorners(this.candidates);
  const found = this.findMarkers(this.grey, this.candidates, this.dictionary.markSize * 7);
  const centre = (m) => m.corners.reduce((a, p) => ({ x: a.x + p.x / 4, y: a.y + p.y / 4 }), { x: 0, y: 0 });
  const out = [];
  for (const m of found) {
    const c = centre(m);
    const dup = out.find((o) => o.id === m.id && Math.hypot(centre(o).x - c.x, centre(o).y - c.y) < 10);
    if (!dup) out.push(m);
    else if (m.hammingDistance < dup.hammingDistance) out[out.indexOf(dup)] = m;
  }
  return out;
};

const dictCache = new Map(); // name -> AR.Dictionary (with computed tau)
const detectors = new Map(); // `${name}|${errors}` -> AR.Detector

function dictionary(name, file, tau) {
  if (dictCache.has(name)) return dictCache.get(name);
  if (!AR.DICTIONARIES[name]) {
    if (!file) throw new Error(`Unknown dictionary ${name}`);
    importScripts(`../../vendor/js-aruco2/dictionaries/${file}`);
  }
  if (!AR.DICTIONARIES[name].tau && tau) AR.DICTIONARIES[name].tau = tau;
  const d = new AR.Dictionary(name); // computes tau (minimum Hamming distance) when the file has none
  dictCache.set(name, d);
  return d;
}

/** Errors we are willing to correct: "auto" = floor((tau - 1) / 2), which keeps decoding unambiguous. */
function allowedErrors(dict, maxErrors) {
  const safe = Math.max(0, Math.floor((dict.tau - 1) / 2));
  if (maxErrors === 'auto' || maxErrors === '' || maxErrors == null) return safe;
  return Math.max(0, Math.min(Number(maxErrors), dict.tau - 1));
}

function detector(name, file, errors) {
  const key = `${name}|${errors}`;
  if (!detectors.has(key)) {
    dictionary(name, file);
    // js-aruco2 accepts a code when its distance is < tau, so tau = errors + 1.
    detectors.set(key, new AR.Detector({ dictionaryName: name, maxHammingDistance: errors + 1 }));
  }
  return detectors.get(key);
}

// ---------- pose ----------

function eulerDeg(R) {
  // R = Rz(roll) · Ry(yaw) · Rx(pitch)
  const yaw = Math.asin(Math.max(-1, Math.min(1, -R[2][0])));
  const pitch = Math.atan2(R[2][1], R[2][2]);
  const roll = Math.atan2(R[1][0], R[0][0]);
  const d = 180 / Math.PI;
  return { yaw: yaw * d, pitch: pitch * d, roll: roll * d };
}

function project(R, t, p, f, w, h) {
  const X = R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2] + t[0];
  const Y = R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2] + t[1];
  const Z = R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2] + t[2];
  return { x: w / 2 + (f * X) / Z, y: h / 2 - (f * Y) / Z };
}

function pose(corners, markerMm, focalPx, w, h) {
  const posit = new POS.Posit(markerMm, focalPx);
  const centred = corners.map((c) => ({ x: c.x - w / 2, y: h / 2 - c.y }));
  const p = posit.pose(centred);
  const R = p.bestRotation;
  const t = p.bestTranslation;
  if (!R || !t || t.some((v) => !Number.isFinite(v)) || t[2] <= 0) return null;
  const L = markerMm / 2;
  return {
    translation: t, // mm, camera frame: x right, y up, z forward (marker centre)
    distance: Math.hypot(t[0], t[1], t[2]),
    rotation: R,
    euler: eulerDeg(R),
    error: p.bestError,
    // Axes drawn from the marker centre; Z points out of the marker towards the camera.
    axes: {
      origin: project(R, t, [0, 0, 0], focalPx, w, h),
      x: project(R, t, [L, 0, 0], focalPx, w, h),
      y: project(R, t, [0, L, 0], focalPx, w, h),
      z: project(R, t, [0, 0, -L], focalPx, w, h),
    },
  };
}

// ---------- messages ----------

self.onmessage = (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'dict') {
      const d = dictionary(msg.dict, msg.file, msg.tau);
      self.postMessage({ id: msg.id, dict: { name: msg.dict, nBits: d.nBits, size: Math.sqrt(d.nBits), count: d.codeList.length, tau: d.tau, codes: d.codeList } });
      return;
    }
    if (msg.type === 'detect') {
      const t0 = performance.now();
      const dict = dictionary(msg.dict, msg.file, msg.tau);
      const errors = allowedErrors(dict, msg.maxErrors);
      const det = detector(msg.dict, msg.file, errors);
      const { width, height } = msg.image;
      const found = det.detect(msg.image);
      const markers = found.map((m) => {
        const corners = m.corners.map((c) => ({ x: c.x, y: c.y }));
        let p = null;
        if (msg.markerMm > 0 && msg.focalPx > 0) {
          try { p = pose(corners, msg.markerMm, msg.focalPx, width, height); } catch { p = null; }
        }
        return { id: m.id, hamming: m.hammingDistance, corners, pose: p };
      });
      self.postMessage({ id: msg.id, markers, errors, ms: performance.now() - t0 });
    }
  } catch (err) {
    self.postMessage({ id: msg.id, error: String(err?.message || err) });
  }
};
