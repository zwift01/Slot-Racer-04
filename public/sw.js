/*
 * Slot Racing – Service Worker (Version 0.4)
 * Strategie: App-Dateien beim Installieren vorab zwischenspeichern,
 * danach „Cache zuerst, Netzwerk im Hintergrund". Dadurch läuft die
 * App nach dem ersten Laden komplett offline.
 * Bei neuen Versionen die Konstante CACHE erhöhen, damit das Update
 * zuverlässig auf dem Gerät ankommt.
 */

var CACHE = "slot-racing-v04-1";
var ASSETS = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return cache.addAll(ASSETS);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k.indexOf("slot-racing-") === 0 && k !== CACHE;
            })
            .map(function (k) {
              return caches.delete(k);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== location.origin) return;

  // Seiten-Navigation: Netzwerk zuerst (damit Updates ankommen), Cache als Fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) {
              c.put("index.html", copy);
            });
          }
          return res;
        })
        .catch(function () {
          return caches.match("index.html", { ignoreSearch: true });
        })
    );
    return;
  }

  // Sonstige Dateien: Cache zuerst, im Hintergrund aktualisieren
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var refresh = fetch(req)
        .then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) {
              c.put(req, copy);
            });
          }
          return res;
        })
        .catch(function () {
          return hit;
        });
      return hit || refresh;
    })
  );
});
