const CACHE_NAME = "readybread-static-v4";
const PRECACHE_URLS = [
  // Keep only truly static assets; avoid caching index.html to prevent stale bundles.
  "/manifest.webmanifest",
  "/icons/icon-box.png",
  "/icons/icon-transparent.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isStaticAsset = url.pathname.startsWith("/assets/");
  const isNavigation = request.mode === "navigate";

  // Always let asset requests and navigations hit the network first
  // to avoid serving stale HTML that references outdated bundles.
  if (isStaticAsset || isNavigation) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
