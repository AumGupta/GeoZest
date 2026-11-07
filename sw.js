const CACHE = "geozest-v37";
const SHELL = [
  "./",
  "index.html",
  "css/style.css",
  "js/core.js",
  "js/map.js",
  "js/globe.js",
  "js/ui.js",
  "js/quiz.js",
  "js/main.js",
  "js/pwa.js",
  "data/geo.js",
  "favicon.svg",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "fonts/geist-mono-latin-ext-wght-normal.woff2",
  "fonts/geist-mono-latin-wght-normal.woff2",
  "fonts/inter-latin-ext-wght-normal.woff2",
  "fonts/inter-latin-wght-normal.woff2",
  "fonts/source-serif-4-latin-ext-wght-italic.woff2",
  "fonts/source-serif-4-latin-wght-italic.woff2",
];
const HOSTS = [location.host, "cdnjs.cloudflare.com", "cdn.jsdelivr.net"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || !HOSTS.includes(url.host)) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok || r.type === "opaque") {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request)),
  );
});
