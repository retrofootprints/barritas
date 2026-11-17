// Checks that the service worker precaches every file the app needs offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
}

test('sw.js precaches all app files', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const list = [...sw.matchAll(/^ {2}'([^']+)',$/gm)].map((m) => m[1]);
  const required = ['index.html', 'app.js', 'manifest.webmanifest', 'css/style.css', ...walk('src'), ...walk('vendor'), ...walk('icons')];
  const missing = required.filter((f) => !list.includes(f));
  assert.deepEqual(missing, [], `missing from PRECACHE in sw.js: ${missing.join(', ')}`);
  const stale = list.filter((f) => f !== './' && !fs.existsSync(path.join(root, f)));
  assert.deepEqual(stale, [], `listed in sw.js but not found: ${stale.join(', ')}`);
});
