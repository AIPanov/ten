// Offline cache: the game works without internet after the first open.
// VERSION is stamped by tools/build_web.py from a hash of the files: every update gets a new cache.
var VERSION = "ten-b2f0dd65f8";
var FILES = ["./", "index.html", "style.css", "data.js", "game.js", "sound.js", "app.js", "mona_lisa.jpg",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "rules.html",
  "rules/count.jpg", "rules/pass.jpg", "rules/role.jpg", "rules/hub.jpg", "rules/alibi.jpg", "rules/board.jpg",
  "rules/clue.jpg", "rules/auction.jpg", "rules/deal.jpg", "rules/seller.jpg", "rules/mail.jpg", "rules/keypad.jpg",
  "rules/court.jpg", "rules/final.jpg"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Network first (fresh version when online), cache when offline.
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(function (r) {
    var copy = r.clone();
    caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
    return r;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match("index.html"); });
  }));
});
