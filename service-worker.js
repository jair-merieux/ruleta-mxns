const CACHE_NAME = "ruleta-app-cache-v3";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./logo.png",
  "./manifest.json"
];

// Instalación: Guarda todos los archivos locales en la caché
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activación: Toma control inmediato de la app
self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

// Intercepción de peticiones: Responde siempre desde la caché offline
self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});