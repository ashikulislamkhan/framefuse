/* FrameFuse service worker: precached app shell, stale-while-revalidate for assets,
   network-first for frames.json, and /frame/<slug> deep links served from the cached shell.
   Hosted frame PNGs are cached by FrameProvider (Cache API), not here.
   Bump CACHE to push a new app version to every client. */
const CACHE = "framefuse-v2";
const ASSETS = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png",
                "config.js", "router.js", "frame-provider.js"];
const shell = () => new URL("index.html", self.registration.scope).href;

self.addEventListener("install", (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())));

self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("framefuse-v") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())));

async function networkFirst(req) {
  try {
    const res = await fetch(req, { cache: "no-cache" });
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  } catch (err) {
    return (await caches.match(req)) || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const hit = await caches.match(req);
  const net = fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => hit || (req.mode === "navigate" ? caches.match(shell()) : Response.error()));
  return hit || net;
}

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // cross-origin (Drive) is left alone
  if (req.mode === "navigate" && /\/frame\/[^/]+\/?$/.test(url.pathname)) {
    e.respondWith(caches.match(shell()).then((hit) => hit || fetch(shell())));
  } else if (url.pathname.endsWith("/frames.json")) {
    e.respondWith(networkFirst(req));
  } else {
    e.respondWith(staleWhileRevalidate(req));
  }
});
