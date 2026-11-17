// Synthetic pose test: render a marker in perspective at a known pose, detect it, compare.
import { getDictionary, detectMarkers } from '../src/fiducial/detect.js';
import { markerCanvas } from '../src/fiducial/marker.js';
import { focalPx } from '../src/fiducial/pose.js';

const W = 1280;
const H = 720;
const FOV = 65;
const MARKER_MM = 50;
const DICT = 'ARUCO_MIP_36h12';
const ID = 3;

const rad = (d) => (d * Math.PI) / 180;
function rotation(yaw, pitch, roll) {
  // R = Rz(roll) · Ry(yaw) · Rx(pitch) — same convention as the worker's euler output.
  const [cy, sy, cp, sp, cr, sr] = [Math.cos(rad(yaw)), Math.sin(rad(yaw)), Math.cos(rad(pitch)), Math.sin(rad(pitch)), Math.cos(rad(roll)), Math.sin(rad(roll))];
  const Rz = [[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]];
  const Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]];
  const Rx = [[1, 0, 0], [0, cp, -sp], [0, sp, cp]];
  const mul = (A, B) => A.map((row, i) => B[0].map((_, j) => row.reduce((s, _v, k) => s + A[i][k] * B[k][j], 0)));
  return mul(mul(Rz, Ry), Rx);
}

/** Ray-cast every pixel onto the marker plane and sample the marker texture. */
function render(tex, quietCells, cells, R, t, f) {
  const tctx = tex.getContext('2d');
  const tdata = tctx.getImageData(0, 0, tex.width, tex.height).data;
  const out = new ImageData(W, H);
  const n = [R[0][2], R[1][2], R[2][2]];
  const nt = n[0] * t[0] + n[1] * t[1] + n[2] * t[2];
  const cellMm = MARKER_MM / cells;
  const totalMm = cellMm * (cells + 2 * quietCells);
  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const d = [(u + 0.5 - W / 2) / f, -(v + 0.5 - H / 2) / f, 1];
      const nd = n[0] * d[0] + n[1] * d[1] + n[2] * d[2];
      let val = 170;
      if (Math.abs(nd) > 1e-9) {
        const s = nt / nd;
        const p = [s * d[0] - t[0], s * d[1] - t[1], s * d[2] - t[2]];
        // local = Rᵀ p
        const X = R[0][0] * p[0] + R[1][0] * p[1] + R[2][0] * p[2];
        const Y = R[0][1] * p[0] + R[1][1] * p[1] + R[2][1] * p[2];
        const tx = ((X + totalMm / 2) / totalMm) * tex.width;
        const ty = ((totalMm / 2 - Y) / totalMm) * tex.height;
        if (tx >= 0 && ty >= 0 && tx < tex.width && ty < tex.height) val = tdata[(Math.floor(ty) * tex.width + Math.floor(tx)) * 4];
      }
      const i = (v * W + u) * 4;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = val;
      out.data[i + 3] = 255;
    }
  }
  return out;
}

const CASES = window.__cases || [
  { z: 300, yaw: 0, pitch: 0, roll: 0, x: 0, y: 0 },
  { z: 500, yaw: 20, pitch: 0, roll: 0, x: 40, y: 0 },
  { z: 700, yaw: 0, pitch: -25, roll: 10, x: -60, y: 30 },
  { z: 1000, yaw: -15, pitch: 15, roll: -30, x: 0, y: -50 },
];

const dict = await getDictionary(DICT);
const quiet = 1;
const tex = markerCanvas(dict.codes[ID], dict.size, { cellPx: 24, quiet });
const f = focalPx(W, { fov: FOV });
const tbody = document.querySelector('#out tbody');
const results = [];
for (const c of CASES) {
  const R = rotation(c.yaw, c.pitch, c.roll);
  const img = render(tex, quiet, dict.size + 2, R, [c.x, c.y, c.z], f);
  const { markers } = await detectMarkers(img, { dict: DICT, maxErrors: 'auto', markerMm: MARKER_MM, fov: FOV }, { transfer: true });
  const m = markers.find((k) => k.id === ID);
  const row = { case: c, found: !!m };
  if (m?.pose) {
    row.distance = m.pose.distance;
    row.trueDistance = Math.hypot(c.x, c.y, c.z);
    row.distErrPct = (100 * Math.abs(row.distance - row.trueDistance)) / row.trueDistance;
    row.euler = m.pose.euler;
    row.angleErr = Math.max(Math.abs(m.pose.euler.yaw - c.yaw), Math.abs(m.pose.euler.pitch - c.pitch), Math.abs(m.pose.euler.roll - c.roll));
  }
  row.ok = row.found && row.distErrPct < 3 && row.angleErr < 5;
  results.push(row);
  const tr = document.createElement('tr');
  const e = row.euler;
  for (const v of [
    `z=${c.z} x=${c.x} y=${c.y} yaw=${c.yaw} pitch=${c.pitch} roll=${c.roll}`,
    row.found ? `${row.distance?.toFixed(1)} mm (true ${row.trueDistance.toFixed(1)}, ${row.distErrPct?.toFixed(2)}%)` : 'not found',
    e ? `yaw ${e.yaw.toFixed(1)} pitch ${e.pitch.toFixed(1)} roll ${e.roll.toFixed(1)}` : '',
    row.ok ? '✔' : '✘',
  ]) {
    const td = document.createElement('td');
    td.textContent = v;
    tr.append(td);
  }
  tbody.append(tr);
}
const bad = results.filter((r) => !r.ok);
const summary = document.getElementById('summary');
summary.className = `msg ${bad.length ? 'err' : 'ok'}`;
summary.textContent = `${results.length - bad.length}/${results.length} poses within 3% distance and 5° per angle (same focal length as the renderer).`;
window.__pose = { done: true, results };
