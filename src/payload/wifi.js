// Wi-Fi network QR: WIFI:T:WPA;S:MyNet;P:secret;H:false;;

/** Split on unescaped `sep`, then unescape backslash sequences. */
export function splitEscaped(s, sep) {
  const parts = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      cur += s[++i];
    } else if (c === sep) {
      parts.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur);
  return parts;
}

/** Split "K:value" keeping escaped characters raw (value unescaped later by splitEscaped). */
function fieldsOf(body) {
  const out = {};
  // Split on unescaped ';' but keep escapes for now.
  const raw = [];
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\' && i + 1 < body.length) { cur += c + body[++i]; continue; }
    if (c === ';') { raw.push(cur); cur = ''; continue; }
    cur += c;
  }
  raw.push(cur);
  for (const f of raw) {
    const m = f.match(/^([A-Za-z]+):([\s\S]*)$/);
    if (m) out[m[1].toUpperCase()] = splitEscaped(m[2], '\u0000')[0];
  }
  return out;
}

export function parseWifi(text) {
  if (!/^WIFI:/i.test(text)) return null;
  const f = fieldsOf(text.slice(5));
  if (!('S' in f)) return null;
  return {
    ssid: f.S,
    security: f.T || 'nopass',
    password: f.P ?? '',
    hidden: /^true$/i.test(f.H || ''),
    eap: f.E, identity: f.I, anonymousIdentity: f.A, phase2: f.PH2,
  };
}

export function interpretWifi(text) {
  const w = parseWifi(text);
  if (!w) return null;
  const sec = { WPA: 'WPA / WPA2 / WPA3', WEP: 'WEP (insecure)', nopass: 'None (open network)', SAE: 'WPA3 (SAE)' }[w.security] || w.security;
  return {
    title: 'Wi-Fi network',
    summary: w.ssid,
    fields: [
      ['Network (SSID)', w.ssid],
      ['Security', sec],
      ['Password', w.security === 'nopass' ? '' : w.password || '(empty)'],
      ['Hidden network', w.hidden ? 'yes' : ''],
      ['EAP method', w.eap], ['Identity', w.identity], ['Anonymous identity', w.anonymousIdentity], ['Phase 2', w.phase2],
    ],
    warnings: w.security === 'WEP' ? ['WEP encryption is broken; prefer WPA2/WPA3.'] : [],
  };
}
