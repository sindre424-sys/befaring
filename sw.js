// Service worker: lagrer hele appen lokalt slik at den virker 100 % uten nett.
// VIKTIG: Øk VERSJON ved hver endring, ellers får ikke telefonen den nye versjonen.
const VERSJON = '0.5.1';
const CACHE = 'befaring-' + VERSJON;

const FILER = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'config/felles.json',
  'config/tunnel.json',
  'config/skjaering.json',
  'config/pahugg.json',
  'config/typer.json',
  'config/qsystem.json',
  'config/byggegrop.json',
  'vendor/preact-htm.mjs',
  'vendor/dexie.mjs',
  'vendor/xlsx.mini.min.js',
  'vendor/docx.umd.js',
  'vendor/pdfmake.min.js',
  'vendor/vfs_fonts.js',
  'vendor/jszip.min.js',
  'js/app.js',
  'js/lib.js',
  'js/db.js',
  'js/config.js',
  'js/ui.js',
  'js/util.js',
  'js/router.js',
  'js/ikoner.js',
  'js/logikk.js',
  'js/testdata.js',
  'js/versjon.js',
  'js/bilder.js',
  'js/views/foto.js',
  'js/views/eksport.js',
  'js/utm.js',
  'js/sikkerhetskopi.js',
  'js/eksport/last.js',
  'js/eksport/data.js',
  'js/eksport/tekster.js',
  'js/eksport/excel.js',
  'js/eksport/word.js',
  'js/eksport/pdf.js',
  'js/eksport/dips.js',
  'js/eksport/del.js',
  'js/skisser/svg.js',
  'js/skisser/data.js',
  'js/skisser/profilstripe.js',
  'js/skisser/kompass.js',
  'js/skisser/tunnel.js',
  'js/skisser/skjaering.js',
  'js/skisser/pahugg.js',
  'js/skisser/stereonett.js',
  'js/skisser/komponenter.js',
  'js/skisser/rose.js',
  'js/qsystem.js',
  'js/tegning.js',
  'js/views/qsystem.js',
  'js/views/start.js',
  'js/views/ny-befaring.js',
  'js/views/befaring.js',
  'js/views/observasjon.js',
  'js/views/innstillinger.js',
  'js/views/config-editor.js',
  'js/views/diverse.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(FILER.map((f) => new Request(f, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nøkler) => Promise.all(nøkler.filter((k) => k.startsWith('befaring-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html', { cacheName: CACHE }).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true, cacheName: CACHE }).then((r) => r || fetch(req)),
  );
});
