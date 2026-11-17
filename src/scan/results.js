// Result cards for decoded barcodes.
import { h, kv } from '../util/dom.js';
import { hexDump, detectEncoding, visibleControls } from '../util/hex.js';
import { copyText, canShare, share } from '../util/io.js';
import { interpret } from '../payload/index.js';

function flash(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = old; }, 1200);
}

const ORIENT = (deg) => (deg === undefined || deg === null ? '' : `${deg}°`);

function renderPayload(p) {
  const box = h('div.payload');
  box.append(h('h4', p.title));
  if (p.summary) box.append(h('p.small', p.summary));
  if (p.warnings?.length) for (const w of p.warnings) box.append(h('p.msg.warn.small', w));
  if (p.fields?.length) box.append(kv(p.fields));
  for (const sec of p.sections || []) {
    box.append(h('div.sub', sec.title), kv(sec.fields));
  }
  if (p.links?.length) {
    box.append(h('div.row.actions', p.links.map((l) => h('a.btn.small', { href: l.href, target: '_blank', rel: 'noopener noreferrer' }, l.label))));
  }
  return box;
}

/** @param r normalised result from engine.decode */
export function barcodeCard(r, { source } = {}) {
  const card = h('article.result');
  card.append(h('header',
    h('span.badge.accent', r.formatLabel),
    h('span.badge', r.engine === 'native' ? 'native BarcodeDetector' : 'zxing-wasm'),
    r.symbologyIdentifier ? h('span.badge', { title: 'Symbology identifier' }, r.symbologyIdentifier) : null,
    source ? h('span.small.muted', source) : null,
  ));
  card.append(h('div.text', visibleControls(r.text) || '(empty)'));

  const actions = h('div.row.actions');
  const copyBtn = h('button.small', { type: 'button', onclick: async () => flash(copyBtn, (await copyText(r.text)) ? 'Copied' : 'Copy failed') }, 'Copy');
  actions.append(copyBtn);
  if (/^https?:\/\/\S+$/i.test(r.text.trim())) {
    actions.append(h('a.btn.small', { href: r.text.trim(), target: '_blank', rel: 'noopener noreferrer' }, 'Open link'));
  }
  if (canShare({ text: r.text })) {
    actions.append(h('button.small', { type: 'button', onclick: () => share({ text: r.text }) }, 'Share'));
  }
  card.append(actions);

  let payload = null;
  try { payload = interpret(r); } catch (e) { console.warn('payload parser failed', e); }
  if (payload) card.append(renderPayload(payload));

  const bytes = r.bytes || new Uint8Array();
  const details = h('details.more', h('summary', 'Details and raw bytes'));
  details.append(kv([
    ['Format', `${r.formatLabel} (${r.format})`],
    ['Engine', r.engine],
    ['Symbology ID', r.symbologyIdentifier],
    ['Content type', r.contentType],
    ['EC level', r.ecLevel],
    ['Version / size', r.version],
    ['Orientation', ORIENT(r.orientation)],
    ['Mirrored', r.isMirrored ? 'yes' : ''],
    ['Inverted', r.isInverted ? 'yes (light on dark)' : ''],
    ['ECI', r.hasECI ? 'yes' : ''],
    ['Structured append', r.sequence ? `${r.sequence.index + 1} of ${r.sequence.size} (id ${r.sequence.id})` : ''],
    ['Reader init', r.readerInit ? 'yes' : ''],
    ['Bytes', `${bytes.length}${r.bytesAreText ? ' (UTF-8 of text; native API has no raw bytes)' : ''}`],
    ['Encoding', detectEncoding(bytes)],
  ]));
  if (bytes.length) details.append(h('div.hex', hexDump(bytes)));
  card.append(details);
  return card;
}

const deg = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}°`;
const mm = (v) => `${Math.round(v)} mm`;

/** Card for a detected fiducial marker (with approximate pose when available). */
export function markerCard(m, { dictLabel, markerMm, focalPx, source, live } = {}) {
  const card = h('article.result');
  card.append(h('header',
    h('span.badge.accent', `ID ${m.id}`),
    h('span.badge', dictLabel),
    m.hamming ? h('span.badge', { title: 'Bits corrected' }, `${m.hamming} bit${m.hamming > 1 ? 's' : ''} corrected`) : null,
    source ? h('span.small.muted', source) : null,
  ));
  const pairs = [];
  if (m.pose) {
    const [x, y, z] = m.pose.translation;
    pairs.push(
      ['Distance', `≈ ${mm(m.pose.distance)}`],
      ['Yaw / pitch / roll', `${deg(m.pose.euler.yaw)} / ${deg(m.pose.euler.pitch)} / ${deg(m.pose.euler.roll)}`],
      ['Translation (x, y, z)', `${mm(x)}, ${mm(y)}, ${mm(z)}`],
    );
  }
  pairs.push(['Corners (px)', m.corners.map((c) => `${Math.round(c.x)},${Math.round(c.y)}`).join('  ')]);
  card.append(kv(pairs));
  if (m.pose && !live) {
    card.append(h('p.small.muted', `Pose assumes a ${markerMm} mm marker and a focal length of ${Math.round(focalPx)} px estimated from the field of view, so values are approximate (no camera calibration). Camera axes: x right, y up, z forward.`));
  } else if (!m.pose && !live) {
    card.append(h('p.small.muted', 'Set the printed marker size in the scan settings to estimate distance and rotation.'));
  }
  return card;
}

export function messageCard(text, kind = 'warn') {
  return h(`p.msg.${kind}`, text);
}
