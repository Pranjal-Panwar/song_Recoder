/* sw.js — makes the studio installable and openable with no signal.
   Bump SHELL when you change index.html so old copies get replaced. */

const SHELL = 'studio-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* never cache: the lyrics API, the storage worker, recordings */
  if (url.hostname.includes('lrclib.net') || url.pathname.startsWith('/upload') ||
      url.pathname.startsWith('/file')   || url.pathname.startsWith('/list')) return;

  /* the page itself: fresh if possible, cached if offline */
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req).then(r => {
        caches.open(SHELL).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  /* fonts, icons, everything else: cached first, then network */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok && (url.origin === location.origin || url.hostname.includes('fonts.g'))) {
        caches.open(SHELL).then(c => c.put(req, r.clone()));
      }
      return r;
    }))
  );
});
