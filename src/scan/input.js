// Still-image inputs: file picker, drag-and-drop, clipboard paste.

const MAX_SIDE = 4096; // larger images are scaled down before decoding

async function decodeToSource(blob) {
  // createImageBitmap honours EXIF orientation; SVG (and some formats) need an <img> instead.
  if (blob.type !== 'image/svg+xml' && 'createImageBitmap' in window) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw new Error('empty image');
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Load an image Blob into a canvas (scaled to MAX_SIDE). Resolves to the canvas. */
export async function blobToCanvas(blob, canvas = document.createElement('canvas')) {
  let src;
  try {
    src = await decodeToSource(blob);
  } catch {
    throw new Error(`Could not open “${blob.name || 'image'}” as an image.`);
  }
  const w0 = src.naturalWidth || src.width;
  const h0 = src.naturalHeight || src.height;
  const k = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k));
  const h = Math.max(1, Math.round(h0 * k));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Transparent PNGs (e.g. exported barcodes) decode best on white.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  src.close?.();
  return canvas;
}

export function imageDataOf(canvas, rect) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const r = rect || { x: 0, y: 0, w: canvas.width, h: canvas.height };
  return ctx.getImageData(r.x, r.y, r.w, r.h);
}

function imageFiles(list) {
  return [...(list || [])].filter((f) => f && (f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)$/i.test(f.name || '')));
}

/**
 * Wire up file input, drag-and-drop on `dropTarget`, and paste on the document.
 * onFiles(files: File[]) is called with image files; isActive() gates paste handling.
 */
export function wireInputs({ fileInput, dropTarget, onFiles, onError, isActive }) {
  fileInput.addEventListener('change', () => {
    const files = imageFiles(fileInput.files);
    if (files.length) onFiles(files);
    fileInput.value = '';
  });

  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  dropTarget.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    dropTarget.classList.add('dragover');
  });
  dropTarget.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  dropTarget.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) dropTarget.classList.remove('dragover');
  });
  dropTarget.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    dropTarget.classList.remove('dragover');
    const files = imageFiles(e.dataTransfer.files);
    if (files.length) onFiles(files);
    else onError('Drop an image file (PNG, JPEG, WebP, GIF, BMP or SVG).');
  });

  document.addEventListener('paste', (e) => {
    if (!isActive()) return;
    const items = [...(e.clipboardData?.items || [])];
    const files = items.filter((i) => i.kind === 'file' && i.type.startsWith('image/')).map((i) => i.getAsFile()).filter(Boolean);
    if (files.length) {
      e.preventDefault();
      onFiles(files);
    } else if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
      onError('The clipboard does not contain an image.');
    }
  });
}
