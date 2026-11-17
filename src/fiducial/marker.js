// Render marker bits (from a js-aruco2 dictionary) to SVG / canvas, and lay out print sheets.
// Layout of a marker of an n×n code: a 1-cell black border around the data cells ('1' bits are white),
// optionally surrounded by `quiet` cells of white. "Marker size" is the edge of the black square.

export const PAPERS = {
  A4: { w: 210, h: 297, label: 'A4' },
  Letter: { w: 215.9, h: 279.4, label: 'US Letter' },
};

const r = (v) => Math.round(v * 1000) / 1000;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** SVG elements (no wrapper) for one marker whose black square has its top-left at (x, y), cell size `c`. */
function markerShapes(code, n, x, y, c) {
  let s = `<rect x="${r(x)}" y="${r(y)}" width="${r(c * (n + 2))}" height="${r(c * (n + 2))}" fill="#000"/>`;
  for (let row = 0; row < n; row++) {
    let col = 0;
    while (col < n) {
      if (code[row * n + col] !== '1') { col++; continue; }
      const start = col;
      while (col < n && code[row * n + col] === '1') col++;
      s += `<rect x="${r(x + (start + 1) * c)}" y="${r(y + (row + 1) * c)}" width="${r((col - start) * c)}" height="${r(c)}" fill="#fff"/>`;
    }
  }
  return s;
}

/** Standalone marker SVG sized in millimetres. */
export function markerSvg(code, n, { sizeMm = 50, quiet = 1, label = '' } = {}) {
  const c = sizeMm / (n + 2);
  const edge = c * (n + 2 + 2 * quiet);
  const labelH = label ? Math.max(4, sizeMm * 0.08) : 0;
  const h = edge + labelH;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${r(edge)}mm" height="${r(h)}mm" viewBox="0 0 ${r(edge)} ${r(h)}" shape-rendering="crispEdges">`;
  s += `<rect width="${r(edge)}" height="${r(h)}" fill="#fff"/>`;
  s += markerShapes(code, n, quiet * c, quiet * c, c);
  if (label) {
    s += `<text x="${r(edge / 2)}" y="${r(edge + labelH * 0.7)}" font-family="sans-serif" font-size="${r(labelH * 0.6)}" text-anchor="middle" fill="#000">${esc(label)}</text>`;
  }
  return `${s}</svg>`;
}

/** Draw a marker to a canvas at `cellPx` pixels per cell (with quiet border). Returns the canvas. */
export function markerCanvas(code, n, { cellPx = 10, quiet = 1, canvas = document.createElement('canvas') } = {}) {
  const cells = n + 2 + 2 * quiet;
  canvas.width = canvas.height = cells * cellPx;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.fillRect(quiet * cellPx, quiet * cellPx, (n + 2) * cellPx, (n + 2) * cellPx);
  ctx.fillStyle = '#fff';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (code[row * n + col] === '1') ctx.fillRect((quiet + 1 + col) * cellPx, (quiet + 1 + row) * cellPx, cellPx, cellPx);
    }
  }
  return canvas;
}

/** "0-5, 8, 10-12" → [0,1,2,3,4,5,8,10,11,12]; throws on invalid input. */
export function parseIds(text, count) {
  const ids = [];
  for (const part of String(text).split(/[,\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`“${part}” is not an ID or range (use e.g. 0-11, 15, 20-23).`);
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (b < a) throw new Error(`Range ${part} is backwards.`);
    if (b >= count) throw new Error(`ID ${b} is out of range: this dictionary has IDs 0–${count - 1}.`);
    if (b - a > 2000) throw new Error('Too many markers at once.');
    for (let i = a; i <= b; i++) ids.push(i);
  }
  if (!ids.length) throw new Error('Enter at least one ID.');
  if (ids.length > 1000) throw new Error('At most 1000 markers per sheet set.');
  return ids;
}

/**
 * Lay out markers on pages. Returns { pages: [svgString], perPage, cols, rows }.
 * opts: { paper, sizeMm, quiet (cells), gapMm, labels, cutMarks, dictLabel }
 */
export function sheetPages(dict, ids, opts) {
  const paper = PAPERS[opts.paper] || PAPERS.A4;
  const n = dict.size;
  const c = opts.sizeMm / (n + 2);
  const quietMm = (opts.quiet ?? 1) * c;
  const boxW = opts.sizeMm + 2 * quietMm;
  const labelH = opts.labels ? 5 : 0;
  const boxH = boxW + labelH;
  const gap = Math.max(0, Number(opts.gapMm) || 0) + (opts.cutMarks ? 4 : 0);
  const margin = 12;
  const cols = Math.floor((paper.w - 2 * margin + gap) / (boxW + gap));
  const rows = Math.floor((paper.h - 2 * margin - 8 + gap) / (boxH + gap));
  if (cols < 1 || rows < 1) throw new Error(`A ${opts.sizeMm} mm marker does not fit on ${paper.label} paper.`);
  const perPage = cols * rows;
  // Centre the grid horizontally.
  const x0 = (paper.w - (cols * boxW + (cols - 1) * gap)) / 2;
  const y0 = margin + 6;
  const pages = [];
  for (let p = 0; p * perPage < ids.length; p++) {
    const pageIds = ids.slice(p * perPage, (p + 1) * perPage);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${paper.w}mm" height="${paper.h}mm" viewBox="0 0 ${paper.w} ${paper.h}">`;
    s += `<rect width="${paper.w}" height="${paper.h}" fill="#fff"/>`;
    s += `<text x="${margin}" y="${margin}" font-family="sans-serif" font-size="3" fill="#555">${esc(`${opts.dictLabel} · ${opts.sizeMm} mm markers · page ${p + 1} · print at 100% (actual size)`)}</text>`;
    // 50 mm scale bar to check the printer did not scale the page.
    const by = paper.h - margin + 4;
    s += `<rect x="${margin}" y="${r(by - 1.2)}" width="50" height="1.2" fill="#000"/><text x="${margin + 52}" y="${r(by)}" font-family="sans-serif" font-size="2.6" fill="#555">← this bar should measure 50 mm</text>`;
    pageIds.forEach((id, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = x0 + col * (boxW + gap);
      const by2 = y0 + row * (boxH + gap);
      s += `<g shape-rendering="crispEdges">${markerShapes(dict.codes[id], n, bx + quietMm, by2 + quietMm, c)}</g>`;
      if (opts.labels) {
        s += `<text x="${r(bx + boxW / 2)}" y="${r(by2 + boxW + 3.6)}" font-family="sans-serif" font-size="3" text-anchor="middle" fill="#000">${esc(`ID ${id}`)}</text>`;
      }
      if (opts.cutMarks) {
        const L = 2.5;
        const o = 1;
        const xs = [bx, bx + boxW];
        const ys = [by2, by2 + boxH];
        for (const [cx, sx] of [[xs[0], -1], [xs[1], 1]]) {
          for (const [cy, sy] of [[ys[0], -1], [ys[1], 1]]) {
            s += `<path d="M${r(cx + sx * o)} ${r(cy)}h${r(sx * L)}M${r(cx)} ${r(cy + sy * o)}v${r(sy * L)}" stroke="#888" stroke-width="0.2" fill="none"/>`;
          }
        }
      }
    });
    pages.push(`${s}</svg>`);
  }
  return { pages, perPage, cols, rows };
}
