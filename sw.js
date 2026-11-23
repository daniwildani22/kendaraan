/**
 * KendaraTrack - Service Worker (PWA Offline & Home Screen Support)
 * Version: 1.0.0
 */

const CACHE_NAME = "kendaratrack-v1.0.0";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/seedData.js",
  "./js/utils.js",
  "./services/api.js",
  "./js/calendar.js",
  "./js/charts.js",
  "./js/app.js",
  "./icons/icon.svg",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

// Install Event - Pre-cache essential app shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell assets...");
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("[Service Worker] Warning caching some assets:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network-First with Cache Fallback for offline usage
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Skip non-GET requests or browser-extension schemes
  if (req.method !== "GET" || !req.url.startsWith("http")) {
    return;
  }

  // Bypass CDN external API calls or Supabase requests from service worker caching
  if (req.url.includes("supabase.co") || req.url.includes("script.google.com") || req.url.includes("google.com/maps")) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        // If successful, clone and update cache
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network fails (offline)
        return caches.match(req).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
      })
  );
});