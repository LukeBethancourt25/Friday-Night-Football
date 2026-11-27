/*
 * Offline support for the home-screen app (GitHub Pages build only).
 *
 * The first time the game opens with internet, this saves the game, its icons and
 * fonts on the phone; after that it opens with no connection at all. Saves are
 * not touched: they live in the browser's own storage, not here.
 *
 * Updates: every build stamps a new VERSION below, so the phone notices a new
 * upload the next time it checks. The new copy downloads in the background and
 * waits; the game shows "New version ready" and switches when the player taps it.
 */
const VERSION = "a80ec9fd3538";
const APP = "fnf-app-" + VERSION;
const FONTS = "fnf-fonts"; // kept across versions
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  // cache: "reload" skips the browser's HTTP cache so a new version is really new
  e.waitUntil(
    caches.open(APP).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" }))))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("fnf-app-") && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// the game asks the waiting copy to take over when the player taps Update
self.addEventListener("message", (e) => {
  if (e.data === "fnf-update") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts: use the saved copy, refresh it in the background when online
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONTS).then((c) =>
        c.match(req).then((hit) => {
          const net = fetch(req)
            .then((res) => {
              if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // opening the app (any page of it): the saved game
  if (req.mode === "navigate") {
    e.respondWith(
      caches.open(APP).then((c) => c.match("index.html").then((hit) => hit || fetch(req)))
    );
    return;
  }

  // everything else of ours: saved copy first, else the network (and save it)
  e.respondWith(
    caches.open(APP).then((c) =>
      c.match(req, { ignoreSearch: true }).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) c.put(req, res.clone());
            return res;
          })
      )
    )
  );
});
