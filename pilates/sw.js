// Network first so updates show up straight away. Only good responses are
// cached; on an error page (404, 5xx) or when offline, the cached copy wins.
// The large 3D files are saved per version (file?v=fingerprint): the app reads the
// saved copy directly and only asks the network for a version it doesn't have.
const CACHE = "tresza-training-v1"; // per app; keep it stable once installed
const FILES = ["./", "index.html", "manifest.webmanifest", "icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "figure.js", "illustrations.js", "exercises.js", "achievements.js",
  "figure3d.js", "vendor/three.min.js", "vendor/GLTFLoader.js", "model/tresza_mh.json", "model/hair.png", "model/eye.png", "model/brows.png", "model/lashes.png", "asset-versions.js"];
try { importScripts("asset-versions.js"); } catch (e) {}
const VERSIONS = self.ASSET_VERSIONS || {};
const versioned = f => VERSIONS[f] ? `${f}?v=${VERSIONS[f]}` : f;
// remove every saved version of a file except this one
async function dropOthers(c, url) {
  const keep = new URL(url, self.location).href;
  for (const k of await c.keys(keep, { ignoreSearch: true })) if (k.url !== keep) await c.delete(k);
}

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE), need = [];
    // a 3D file with any saved version is left alone: the app fetches a newer one when it needs it
    for (const f of FILES) if (!VERSIONS[f] || !(await c.match(f, { ignoreSearch: true }))) need.push(versioned(f));
    await c.addAll(need);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(k => k !== CACHE).map(k => caches.delete(k)));
    const c = await caches.open(CACHE);
    for (const f in VERSIONS) if (await c.match(versioned(f))) await dropOthers(c, versioned(f));
    await self.clients.claim();
  })());
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
      e.waitUntil(caches.open(CACHE).then(async c => {
        await c.put(e.request, copy);
        if (new URL(e.request.url).searchParams.has("v")) await dropOthers(c, e.request.url);
      }));
      return res;
    }
    return (await cached()) || res;
  })());
});
