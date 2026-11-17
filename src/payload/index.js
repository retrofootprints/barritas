// Payload interpreters: try each parser in turn; the first that recognises the content wins.
// Each returns { title, summary?, fields: [[label, value]], sections?, links?, warnings? } or null.
import { interpretAamva } from './aamva.js';
import { interpretBcbp } from './bcbp.js';
import { interpretEpc } from './epc.js';
import { interpretWifi } from './wifi.js';
import { interpretVCard } from './vcard.js';
import { interpretMeCard } from './mecard.js';
import { interpretAtQr } from './pt-at.js';
import { interpretGs1 } from './gs1.js';
import { interpretGeo } from './geo.js';
import { interpretUrl } from './url.js';

const PARSERS = [
  ['aamva', interpretAamva],
  ['bcbp', interpretBcbp],
  ['epc', interpretEpc],
  ['wifi', interpretWifi],
  ['vcard', interpretVCard],
  ['mecard', interpretMeCard],
  ['pt-at', interpretAtQr],
  ['gs1', interpretGs1], // before URL: GS1 Digital Link URIs are URLs too
  ['geo', interpretGeo],
  ['url', interpretUrl],
];

/** @param r decoded result ({ text, symbologyIdentifier?, contentType? }) or a plain string */
export function interpret(r) {
  const result = typeof r === 'string' ? { text: r } : r;
  const text = result.text || '';
  if (!text) return null;
  for (const [type, fn] of PARSERS) {
    const out = fn(text, result);
    if (out) return { type, ...out };
  }
  return null;
}
