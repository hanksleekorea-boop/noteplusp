const CACHE = "noteplusp-v15-shell-1";
const SHELL = ["./", "./노트앱_v15.html", "./firebase-config.js", "./noteplus-cloud-v3.js", "./noteplus.webmanifest", "./icon.svg", "./노트플러스P_Evernote_전체백업_PC.zip", "./assets/evernote-guide/evernote-windows-notebook-menu.png", "./assets/evernote-guide/evernote-windows-enex-settings.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).pathname.endsWith("/firebase-config.js")) {
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
  }).catch(() => caches.match("./노트앱_v15.html"))));
});
