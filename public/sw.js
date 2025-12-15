const CACHE_NAME = "readybread-static-v7";
const PRECACHE_URLS = [
  // Keep only truly static assets; avoid caching index.html to prevent stale bundles.
  "/manifest.webmanifest",
  "/icons/icon-box.webp",
  "/icons/icon-transparent.webp",
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
  const isSameOrigin = url.origin === self.location.origin;
  const isStaticAsset = url.pathname.startsWith("/assets/");
  const isNavigation = request.mode === "navigate";

  // Let navigations, built assets, and third-party requests bypass the SW
  // so we do not interfere with external scripts/logos or fresh HTML.
  if (!isSameOrigin || isStaticAsset || isNavigation) {
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        return await fetch(request);
      } catch (_) {
        return Response.error();
      }
    })()
  );
});
