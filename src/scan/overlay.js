// Draw detection outlines, labels and pose axes on the overlay canvas.

const BARCODE_COLOUR = '#22d36b';
const MARKER_COLOUR = '#ffb020';

export function sizeOverlay(overlay, w, h) {
  if (overlay.width !== w) overlay.width = w;
  if (overlay.height !== h) overlay.height = h;
}

export function clearOverlay(overlay) {
  overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
}

function label(ctx, text, x, y, colour, unit) {
  ctx.font = `600 ${Math.round(13 * unit)}px system-ui, sans-serif`;
  const pad = 4 * unit;
  const w = ctx.measureText(text).width + pad * 2;
  const h = 18 * unit;
  const lx = Math.min(Math.max(0, x), ctx.canvas.width - w);
  const ly = Math.max(0, y - h - 2 * unit);
  ctx.fillStyle = colour;
  ctx.fillRect(lx, ly, w, h);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, lx + pad, ly + h / 2);
}

function quadPath(ctx, quad) {
  ctx.beginPath();
  quad.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

/**
 * barcodes: [{ quad, formatLabel, text }]
 * markers:  [{ corners, id, axes?: { origin, x, y, z } }]
 */
export function drawDetections(overlay, { barcodes = [], markers = [] }) {
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  const unit = Math.max(1, Math.min(overlay.width, overlay.height) / 480);
  ctx.lineJoin = 'round';

  for (const b of barcodes) {
    if (!b.quad) continue;
    quadPath(ctx, b.quad);
    ctx.lineWidth = 4 * unit;
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.stroke();
    ctx.lineWidth = 2.5 * unit;
    ctx.strokeStyle = BARCODE_COLOUR;
    ctx.stroke();
    const top = b.quad.reduce((a, p) => (p.y < a.y ? p : a), b.quad[0]);
    const left = Math.min(...b.quad.map((p) => p.x));
    const text = b.text.length > 24 ? `${b.text.slice(0, 23)}…` : b.text;
    label(ctx, `${b.formatLabel}: ${text}`, left, top.y, BARCODE_COLOUR, unit);
  }

  for (const m of markers) {
    quadPath(ctx, m.corners);
    ctx.lineWidth = 2.5 * unit;
    ctx.strokeStyle = MARKER_COLOUR;
    ctx.stroke();
    // First corner (marker's top-left) highlighted.
    ctx.fillStyle = MARKER_COLOUR;
    ctx.beginPath();
    ctx.arc(m.corners[0].x, m.corners[0].y, 4 * unit, 0, Math.PI * 2);
    ctx.fill();
    if (m.axes) {
      const { origin, x, y, z } = m.axes;
      for (const [end, colour] of [[x, '#ff3b30'], [y, '#34c759'], [z, '#0a84ff']]) {
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(end.x, end.y);
        ctx.lineWidth = 3 * unit;
        ctx.strokeStyle = colour;
        ctx.stroke();
      }
    }
    const top = m.corners.reduce((a, p) => (p.y < a.y ? p : a), m.corners[0]);
    const left = Math.min(...m.corners.map((p) => p.x));
    label(ctx, `ID ${m.id}${m.distanceMm ? ` · ${Math.round(m.distanceMm)} mm` : ''}`, left, top.y, MARKER_COLOUR, unit);
  }
}

/** Offset quads by an ROI origin (results decoded from a crop). */
export function offsetQuad(quad, dx, dy) {
  return quad ? quad.map((p) => ({ x: p.x + dx, y: p.y + dy })) : quad;
}
