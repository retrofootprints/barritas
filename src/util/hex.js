// Hex dump and text-encoding detection for raw barcode bytes.

export function toHex(bytes, sep = ' ') {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(sep);
}

/** Classic 16-bytes-per-line hex dump with an ASCII column. */
export function hexDump(bytes, max = 4096) {
  const lines = [];
  const n = Math.min(bytes.length, max);
  for (let off = 0; off < n; off += 16) {
    const row = bytes.subarray(off, Math.min(off + 16, n));
    const hex = [...row].map((b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
    const ascii = [...row].map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${off.toString(16).padStart(6, '0')}  ${hex}  ${ascii}`);
  }
  if (bytes.length > max) lines.push(`… ${bytes.length - max} more bytes`);
  return lines.join('\n');
}

/** Best-effort guess at the byte encoding. */
export function detectEncoding(bytes) {
  if (!bytes || !bytes.length) return 'empty';
  let ascii = true;
  let control = 0;
  for (const b of bytes) {
    if (b >= 0x80) ascii = false;
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d && b !== 0x1d && b !== 0x1e && b !== 0x04) control++;
  }
  if (control > bytes.length * 0.1) return 'binary';
  if (ascii) return 'ASCII';
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return 'UTF-8';
  } catch {
    return 'ISO-8859-1 / other 8-bit';
  }
}

/** Make control characters visible: GS → ␝, RS → ␞, EOT → ␄, CR/LF kept. */
export function visibleControls(text) {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, (c) => String.fromCharCode(0x2400 + (c === '\x7f' ? 0x21 : c.charCodeAt(0))));
}
