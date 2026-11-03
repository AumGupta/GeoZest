const CACHE = "geozest-v7";
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
