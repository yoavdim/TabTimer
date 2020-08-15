
const constant_pages = [
  './',
  './index.html',
  './A-Tone.wav',
  'TabTimer.css',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'manifest.json',
  './TabScript.js'
];

const strip_query_to = [
  './',
  './index.html'
]; // cache regardless of the ?key=%val

function stripQueryStringAndHashFromPath(url) {
  return url.split("?")[0].split("#")[0];
}

self.addEventListener('install', function(e) {
 e.waitUntil(
   caches.open('tabtimer').then(function(cache) {
     return cache.addAll(constant_pages);
   })
 );
});


self.addEventListener('fetch', (event) => {
  event.respondWith(async function() {
    try {
      return await fetch(event.request);  // from the web
    } catch (err) {
      const stripedRequestUrl = stripQueryStringAndHashFromPath(event.request.url);
      if(stripedRequestUrl in strip_query_to){
        return caches.match(stripedRequestUrl);
      } else {
        return caches.match(event.request);
      }
    }
  }());
});
