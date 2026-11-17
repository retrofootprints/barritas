// MeCard (NTT DoCoMo contact format): MECARD:N:Doe,John;TEL:+351…;EMAIL:…;;
import { splitEscaped } from './wifi.js';

export function parseMeCard(text) {
  if (!/^MECARD:/i.test(text)) return null;
  const out = { tel: [], email: [], url: [], adr: [] };
  for (const part of splitEscaped(text.slice(7), ';')) {
    const m = part.match(/^([A-Za-z-]+):([\s\S]*)$/);
    if (!m) continue;
    const key = m[1].toUpperCase();
    const val = m[2];
    if (key === 'N') {
      const [last, first] = val.split(',');
      out.name = first ? `${first} ${last}` : last;
    } else if (key === 'TEL' || key === 'TEL-AV') out.tel.push(val);
    else if (key === 'EMAIL') out.email.push(val);
    else if (key === 'URL') out.url.push(val);
    else if (key === 'ADR') out.adr.push(val.replace(/,/g, ', '));
    else if (key === 'BDAY') out.bday = val;
    else if (key === 'NOTE') out.note = val;
    else if (key === 'NICKNAME') out.nickname = val;
    else if (key === 'SOUND') out.reading = val;
    else if (key === 'ORG') out.org = val;
  }
  return out.name || out.tel.length || out.email.length ? out : null;
}

export function interpretMeCard(text) {
  const c = parseMeCard(text);
  if (!c) return null;
  const fields = [['Name', c.name], ['Reading', c.reading], ['Nickname', c.nickname], ['Organisation', c.org]];
  c.tel.forEach((t) => fields.push(['Phone', t]));
  c.email.forEach((e) => fields.push(['Email', e]));
  c.url.forEach((u) => fields.push(['Website', u]));
  c.adr.forEach((a) => fields.push(['Address', a]));
  fields.push(['Birthday', c.bday], ['Note', c.note]);
  const links = [];
  if (c.tel[0]) links.push({ label: 'Call', href: `tel:${c.tel[0].replace(/[^\d+*#]/g, '')}` });
  if (c.email[0]) links.push({ label: 'Email', href: `mailto:${c.email[0]}` });
  return { title: 'Contact (MeCard)', summary: c.name, fields, links };
}
