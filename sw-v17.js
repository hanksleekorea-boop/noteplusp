const CACHE = "noteplusp-v17-shell-1";
const SHELL = ["./", "./노트앱_v17.html", "./노트앱_v16.html", "./firebase-config-v17.js", "./noteplus-cloud-v3.js", "./noteplus-v17.webmanifest", "./icon.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const pathname = new URL(event.request.url).pathname;
  if (pathname.endsWith("/firebase-config-v17.js")) {
    event.respondWith(fetch(event.request, {cache:"no-store"}).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
    return response;
  }).catch(() => caches.match("./노트앱_v17.html"))));
});
