// URLs and other URI schemes: http(s), mailto, tel, sms/smsto, otpauth.

const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 't.ly', 'qrco.de', 'tiny.cc'];

function web(text) {
  let u;
  try { u = new URL(text); } catch { return null; }
  const warnings = [];
  if (u.protocol === 'http:') warnings.push('Not encrypted (http, not https).');
  if (u.username || u.password || /@/.test(text.split('/')[2] || '')) warnings.push('The address contains “@” before the host: the real destination is the part after it.');
  if (/(^|\.)xn--/.test(u.hostname)) warnings.push(`International domain name (${u.hostname}): check for look-alike characters.`);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname) || u.hostname.startsWith('[')) warnings.push('The host is a raw IP address.');
  if (SHORTENERS.includes(u.hostname.replace(/^www\./, ''))) warnings.push('Link shortener: the final destination is hidden.');
  const params = [...u.searchParams.keys()];
  return {
    title: 'Web link',
    summary: u.hostname,
    fields: [
      ['Host', u.hostname],
      ['Path', decodeURIComponent(u.pathname) !== '/' ? decodeURIComponent(u.pathname) : ''],
      ['Query parameters', params.length ? params.join(', ') : ''],
      ['Fragment', u.hash],
    ],
    warnings,
    links: [{ label: 'Open link', href: u.href }],
  };
}

function mailto(text) {
  let u;
  try { u = new URL(text); } catch { return null; }
  const p = u.searchParams;
  return {
    title: 'Email',
    summary: decodeURIComponent(u.pathname),
    fields: [['To', decodeURIComponent(u.pathname)], ['Cc', p.get('cc')], ['Bcc', p.get('bcc')], ['Subject', p.get('subject')], ['Body', p.get('body')]],
    links: [{ label: 'Write email', href: text }],
  };
}

/** MATMSG:TO:a@b;SUB:subject;BODY:text;; (DoCoMo email format) */
function matmsg(text) {
  const f = Object.fromEntries(text.slice(7).split(';').map((p) => p.match(/^(\w+):([\s\S]*)$/)).filter(Boolean).map((m) => [m[1].toUpperCase(), m[2]]));
  if (!f.TO) return null;
  const href = `mailto:${f.TO}?subject=${encodeURIComponent(f.SUB || '')}&body=${encodeURIComponent(f.BODY || '')}`;
  return { title: 'Email', summary: f.TO, fields: [['To', f.TO], ['Subject', f.SUB], ['Body', f.BODY]], links: [{ label: 'Write email', href }] };
}

function tel(text) {
  const n = decodeURIComponent(text.replace(/^tel:/i, ''));
  return { title: 'Phone number', summary: n, fields: [['Number', n]], links: [{ label: 'Call', href: `tel:${n.replace(/[^\d+*#,;]/g, '')}` }] };
}

function sms(text) {
  // sms:+351…?body=…  or  SMSTO:+351…:message
  let number;
  let body = '';
  if (/^smsto:/i.test(text)) {
    const rest = text.slice(6);
    const i = rest.indexOf(':');
    number = i < 0 ? rest : rest.slice(0, i);
    body = i < 0 ? '' : rest.slice(i + 1);
  } else {
    const rest = text.slice(4);
    const [n, q] = rest.split('?');
    number = decodeURIComponent(n);
    body = new URLSearchParams(q || '').get('body') || '';
  }
  return {
    title: 'Text message (SMS)',
    summary: number,
    fields: [['To', number], ['Message', body]],
    links: [{ label: 'Send SMS', href: `sms:${number}${body ? `?body=${encodeURIComponent(body)}` : ''}` }],
  };
}

function otpauth(text) {
  let u;
  try { u = new URL(text); } catch { return null; }
  const p = u.searchParams;
  const label = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
  const [issuerFromLabel, account] = label.includes(':') ? label.split(':') : ['', label];
  return {
    title: 'One-time password (2FA) setup',
    summary: p.get('issuer') || issuerFromLabel || account,
    fields: [
      ['Type', u.hostname.toUpperCase()],
      ['Issuer', p.get('issuer') || issuerFromLabel],
      ['Account', account],
      ['Algorithm', p.get('algorithm') || 'SHA1'],
      ['Digits', p.get('digits') || '6'],
      [u.hostname === 'hotp' ? 'Counter' : 'Period', u.hostname === 'hotp' ? p.get('counter') : `${p.get('period') || 30} s`],
    ],
    warnings: ['This contains a secret key for two-factor authentication. Anyone with it can generate your codes.'],
  };
}

export function interpretUrl(text) {
  const t = text.trim();
  if (/\s/.test(t) && !/^(smsto|sms|mailto|matmsg):/i.test(t)) return null;
  if (/^https?:\/\//i.test(t)) return web(t);
  if (/^mailto:/i.test(t)) return mailto(t);
  if (/^MATMSG:/i.test(t)) return matmsg(t);
  if (/^tel:/i.test(t)) return tel(t);
  if (/^(sms|smsto):/i.test(t)) return sms(t);
  if (/^otpauth:\/\//i.test(t)) return otpauth(t);
  return null;
}
