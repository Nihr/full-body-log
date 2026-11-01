/* Full body log service worker.
   Bump VERSION on every change to any file in SHELL so phones pick it up. */
const VERSION = 'v2';
const SHELL_CACHE = 'fbl-shell-' + VERSION;
const FONT_CACHE = 'fbl-fonts-v1';
// Every local file that index.html or the manifest uses; test.js checks this list.
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
// Must match the stylesheet link in index.html.
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&display=swap';

/* Install: precache the app shell, and the fonts if the network allows. */
self.addEventListener('install', event => {
  event.waitUntil(Promise.all([
    caches.open(SHELL_CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))),
    cacheFonts()
  ]).then(() => self.skipWaiting()));
});

/* Fetches the font stylesheet and the font files it points to. Never fails. */
async function cacheFonts() {
  try {
    const cache = await caches.open(FONT_CACHE);
    if (await cache.match(FONT_CSS, { ignoreVary: true })) return;
    const res = await fetch(FONT_CSS, { mode: 'cors' });
    if (!res.ok) return;
    const css = await res.clone().text();
    await cache.put(FONT_CSS, res);
    const urls = Array.from(css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g), m => m[1]);
    await Promise.all(urls.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok ? cache.put(u, r) : null).catch(() => null)));
  } catch (e) { /* offline during install: fonts get cached on first use instead */ }
}

/* Activate: drop this app's caches from older versions. Other apps on the same origin
   (all GitHub Pages sites of one account share it) keep theirs. */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('fbl-') && k !== SHELL_CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Fetch: the shell is served cache first; Google Fonts from cache, refreshed in the background. */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(FONT_CACHE).then(async cache => {
      const hit = await cache.match(req, { ignoreVary: true });
      const net = fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      });
      if (hit) { event.waitUntil(net.catch(() => null)); return hit; }
      return net.catch(() => Response.error());
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    })
  );
});
