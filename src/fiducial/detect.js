// Client for the fiducial worker.
import { DICT_BY_NAME } from './dictionaries.js';
import { focalPx } from './pose.js';

let worker = null;
let nextId = 1;
const pending = new Map();
const dictInfo = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.js', import.meta.url));
  worker.onmessage = (e) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error) p.reject(new Error(e.data.error));
    else p.resolve(e.data);
  };
  worker.onerror = (e) => {
    const err = new Error(e.message || 'Marker detector failed to start');
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

/** { name, nBits, size, count, tau, codes: ['0101…', …] } */
export async function getDictionary(name) {
  if (!dictInfo.has(name)) {
    const p = call({ type: 'dict', dict: name, file: DICT_BY_NAME[name]?.file, tau: DICT_BY_NAME[name]?.tau }).then((r) => r.dict);
    dictInfo.set(name, p);
    p.catch(() => dictInfo.delete(name));
  }
  return dictInfo.get(name);
}

/**
 * Detect markers in an ImageData.
 * settings: { dict, maxErrors, markerMm, fov, focal35 }
 * Returns { markers: [{ id, hamming, corners, pose }], ms, errors }.
 */
export function detectMarkers(image, settings, { transfer = false } = {}) {
  const f = focalPx(image.width, settings);
  return call({
    type: 'detect',
    image,
    dict: settings.dict,
    file: DICT_BY_NAME[settings.dict]?.file,
    tau: DICT_BY_NAME[settings.dict]?.tau,
    maxErrors: settings.maxErrors,
    markerMm: Number(settings.markerMm) || 0,
    focalPx: f,
  }, transfer ? [image.data.buffer] : []);
}
