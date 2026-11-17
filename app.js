// Barritas — bootstrap, tab routing, theme.
import { store } from './src/util/storage.js';

const TABS = ['scan', 'generate', 'fiducials', 'about'];

// Each tab's controller is loaded on first visit (keeps bwip-js etc. off the critical path).
const loaders = {
  scan: () => import('./src/scan/index.js'),
  generate: () => import('./src/generate/form.js'),
  fiducials: () => import('./src/fiducial/generate.js'),
  about: () => import('./src/about.js'),
};
const started = new Map();

function panel(name) { return document.getElementById(`panel-${name}`); }
function tabButton(name) { return document.getElementById(`tab-${name}`); }

async function activate(name, { focus = false, updateHash = true } = {}) {
  if (!TABS.includes(name)) name = 'scan';
  for (const t of TABS) {
    const on = t === name;
    const btn = tabButton(t);
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
    panel(t).hidden = !on;
  }
  if (focus) tabButton(name).focus();
  if (updateHash && location.hash !== `#${name}`) {
    history.replaceState(null, '', `${location.pathname}${location.search}#${name}`);
  }
  // Tell controllers which tab is visible (scan stops the camera when hidden).
  document.dispatchEvent(new CustomEvent('tabchange', { detail: { tab: name } }));

  if (!started.has(name)) {
    const p = loaders[name]()
      .then((mod) => mod.init?.(panel(name)))
      .catch((err) => {
        console.error(err);
        const box = document.createElement('p');
        box.className = 'msg err';
        box.textContent = `Could not load this section: ${err.message || err}`;
        panel(name).prepend(box);
        started.delete(name);
      });
    started.set(name, p);
  }
  return started.get(name);
}

function initTabs() {
  const list = document.querySelector('[role="tablist"]');
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[role="tab"]');
    if (btn) activate(btn.dataset.tab);
  });
  // Arrow-key navigation between tabs (WAI-ARIA tabs pattern).
  list.addEventListener('keydown', (e) => {
    const i = TABS.indexOf(document.activeElement?.dataset?.tab);
    if (i < 0) return;
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = TABS.length - 1;
    if (j !== null) { e.preventDefault(); activate(TABS[j], { focus: true }); }
  });
  window.addEventListener('hashchange', () => activate(location.hash.slice(1), { updateHash: false }));
}

function initTheme() {
  const sel = document.getElementById('theme-select');
  const apply = (v) => {
    if (v === 'light' || v === 'dark') document.documentElement.dataset.theme = v;
    else delete document.documentElement.dataset.theme;
  };
  const saved = store.get('theme', 'auto');
  sel.value = saved;
  apply(saved);
  sel.addEventListener('change', () => { store.set('theme', sel.value); apply(sel.value); });
}

function initialTab() {
  const h = location.hash.slice(1);
  if (TABS.includes(h)) return h;
  // Shareable generator links (?f=qrcode&d=hello) open the generator.
  if (new URLSearchParams(location.search).has('f')) return 'generate';
  return 'scan';
}

initTheme();
initTabs();
activate(initialTab());

if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker not registered:', e));
}
