// Generate every format with its sample data and decode it again.
import { GEN_FORMATS, BY_BCID, applyCheckDigit } from '../src/generate/formats.js';
import { buildOptions, verify, renderSVG, friendlyError } from '../src/generate/render.js';

// Formats where zxing legitimately reports a different text representation.
const EXPECT_DIFFERENT = new Set(['issn', 'ismn', 'code32', 'pzn', 'aztecrune']);

const tbody = document.querySelector('#out tbody');
const results = [];

for (const fmt of GEN_FORMATS) {
  let { text, error } = applyCheckDigit(fmt, fmt.sample);
  if (error) text = fmt.sample;
  const opts = buildOptions(fmt.bcid, text, { scale: 3, quiet: 10, includetext: fmt.kind === 'ean' });
  let row;
  try {
    await renderSVG(opts); // SVG path must work too
    const v = await verify(fmt.bcid, opts, text);
    const ok = v.status === 'pass' || v.status === 'na' || (v.status === 'decoded' && EXPECT_DIFFERENT.has(fmt.bcid) && v.decoded.format);
    row = { bcid: fmt.bcid, label: fmt.label, status: v.status, ok: !!ok, detail: v.detail };
  } catch (e) {
    row = { bcid: fmt.bcid, label: fmt.label, status: 'error', ok: false, detail: friendlyError(e) };
  }
  results.push(row);
  const tr = document.createElement('tr');
  for (const v of [row.label, row.bcid, `${row.ok ? '✔' : '✘'} ${row.status}`, row.detail]) {
    const td = document.createElement('td');
    td.textContent = v;
    tr.append(td);
  }
  tbody.append(tr);
}

const bad = results.filter((r) => !r.ok);
const summary = document.getElementById('summary');
summary.className = `msg ${bad.length ? 'err' : 'ok'}`;
summary.textContent = `${results.length - bad.length}/${results.length} OK${bad.length ? ` — failing: ${bad.map((r) => r.bcid).join(', ')}` : ''}`;
window.__roundtrip = { done: true, results, failing: bad };
void BY_BCID;
