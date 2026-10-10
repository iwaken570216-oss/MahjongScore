// Increment this version when releasing changes to the application.
const ROOT = new URL("./", self.location).href;
// Isolate this project's cache from other Pages apps on the same origin.
const CACHE_PREFIX = `janroku-${new URL(ROOT).pathname}-`;
const CACHE = `${CACHE_PREFIX}v5`;
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch(ROOT, { cache: "reload" });
      if (!response.ok)
        throw new Error("Application shell could not be fetched");
      const html = await response.clone().text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => new URL(match[1], ROOT))
        .filter((url) => url.origin === self.location.origin && !url.hash)
        .map((url) => url.href);
      await cache.addAll([
        ...new Set([
          ...assets,
          new URL("icon-isou-192.png", ROOT).href,
          new URL("icon-isou-512.png", ROOT).href,
        ]),
      ]);
      await cache.put(ROOT, response);
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith(CACHE_PREFIX) && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin ||
    !new URL(event.request.url).pathname.startsWith(new URL(ROOT).pathname)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (event.request.mode === "navigate") {
        // Serve the shell matching this worker's assets until the next worker activates.
        return (
          (await cache.match(ROOT, { ignoreVary: true })) ||
          fetch(event.request)
        );
      }
      // Only the public, same-origin application shell is cached. Ignore hosting CORS Vary headers.
      return (
        (await cache.match(event.request, { ignoreVary: true })) ||
        fetch(event.request)
      );
    })(),
  );
});
