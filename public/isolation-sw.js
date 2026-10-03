// Supply isolation headers on static hosts such as GitHub Pages.
// No application/model cache here: the TTS workers own model persistence.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || (request.cache === 'only-if-cached' && request.mode !== 'same-origin')) return;
  event.respondWith((async () => {
    const response = await fetch(request);
    // Opaque redirects must be passed through for the browser to follow them.
    if (response.status === 0) return response;
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  })());
});
