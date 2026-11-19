// Network first so updates show up straight away. Only good responses are
// cached; on an error page (404, 5xx) or when offline, the cached copy wins.
const CACHE = "tresza-training-v1"; // per app; keep it stable once installed
const FILES = ["./", "index.html", "manifest.webmanifest", "icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "figure.js", "exercises.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith((async () => {
    const cached = () => caches.match(e.request, { ignoreSearch: true });
    let res;
    try {
      res = await fetch(e.request);
    } catch {
      return (await cached()) || Response.error();
    }
    if (res.ok) {
      const copy = res.clone();
      e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copy)));
      return res;
    }
    return (await cached()) || res;
  })());
});
