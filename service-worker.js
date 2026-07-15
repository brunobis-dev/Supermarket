// App shell em cache-first. Suba o número da versão a cada deploy para
// invalidar o cache antigo automaticamente.
const CACHE_NOME = 'lista-mercado-v1';

const ARQUIVOS_APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/catalogo.js',
  './js/db.js',
  './js/camera.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_NOME)
      .then((cache) => cache.addAll(ARQUIVOS_APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((nome) => nome !== CACHE_NOME).map((nome) => caches.delete(nome))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;

  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      if (respostaCache) return respostaCache;

      return fetch(evento.request)
        .then((resposta) => {
          if (resposta.ok && evento.request.url.startsWith(self.location.origin)) {
            const copia = resposta.clone();
            caches.open(CACHE_NOME).then((cache) => cache.put(evento.request, copia));
          }
          return resposta;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
