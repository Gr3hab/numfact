/* NUMIGMA heißt jetzt CIPHRO (https://ciphro.eu). Diese alte Adresse leitet nur noch weiter.
   Wer die alte Offline-Hilfe noch hat, bekommt beim nächsten Besuch diese Fassung:
   Sie löscht den alten Zwischenspeicher, meldet sich selbst ab und fängt keine Anfragen mehr ab. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('numigma-')).map(k => caches.delete(k))))
    .catch(() => {})
    .then(() => self.registration.unregister()));
});
