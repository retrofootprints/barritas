// Copy, download, share, beep.

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers without async clipboard permission.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'sr-only';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}

export async function copyImage(blobOrPromise) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try {
    // Passing a promise keeps Safari's user-activation requirement happy.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': Promise.resolve(blobOrPromise) })]);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type));
}

export function canShare(data) {
  try { return !!navigator.share && (!navigator.canShare || navigator.canShare(data)); } catch { return false; }
}

export async function share(data) {
  try { await navigator.share(data); return true; } catch { return false; }
}

let audioCtx = null;
export function beep() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1760;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.13);
  } catch { /* audio unavailable */ }
  try { navigator.vibrate?.(60); } catch { /* ignore */ }
}

export function safeFilename(s, fallback = 'barcode') {
  const clean = String(s || '').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return clean || fallback;
}
