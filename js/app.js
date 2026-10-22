// Oppstart og ruting.
import { html, render, useEffect } from './lib.js';
import { bePersistent } from './db.js';
import { lastStandardConfig, useConfigLive, Ctx } from './config.js';
import { useRute } from './router.js';
import { MeldingVert, DialogVert, flushAll } from './ui.js';
import { Start } from './views/start.js';
import { NyBefaring } from './views/ny-befaring.js';
import { Befaring } from './views/befaring.js';
import { Observasjon } from './views/observasjon.js';
import { Innstillinger } from './views/innstillinger.js';
import { TypeRedigerer, FellesRedigerer } from './views/config-editor.js';
import { Prosjekter, Prosjekt, Papirkurv } from './views/diverse.js';
import { Eksport } from './views/eksport.js';

function Side({ rute }) {
  const [a, b, c] = rute.deler;
  switch (a) {
    case undefined: return html`<${Start} />`;
    case 'ny': return html`<${NyBefaring} />`;
    case 'befaring': return html`<${Befaring} key=${b} id=${b} />`;
    case 'obs': return html`<${Observasjon} key=${b} id=${b} ny=${rute.q.ny === '1'} />`;
    case 'eksport': return html`<${Eksport} key=${b} id=${b} />`;
    case 'innstillinger':
      if (b === 'type') return html`<${TypeRedigerer} key=${c} id=${c} />`;
      if (b === 'felles') return html`<${FellesRedigerer} />`;
      return html`<${Innstillinger} />`;
    case 'prosjekter': return html`<${Prosjekter} />`;
    case 'prosjekt': return html`<${Prosjekt} key=${b} id=${b} />`;
    case 'papirkurv': return html`<${Papirkurv} />`;
    default: return html`<main class="innhold"><p>Ukjent side. <a href="#/">Til startsiden</a></p></main>`;
  }
}

function App() {
  const config = useConfigLive();
  const rute = useRute();
  const tema = config ? config.innstillinger.tema : 'auto';
  useEffect(() => {
    document.documentElement.dataset.tema = tema;
  }, [tema]);
  if (!config) return html`<main class="innhold"><p>Laster …</p></main>`;
  return html`<${Ctx.Provider} value=${{ config }}>
    <${Side} rute=${rute} />
    <${MeldingVert} />
    <${DialogVert} />
  <//>`;
}

// Lagre alt som venter når appen legges i bakgrunnen eller lukkes.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });
window.addEventListener('pagehide', flushAll);

async function start() {
  try {
    await lastStandardConfig();
  } catch (e) {
    document.getElementById('app').innerHTML = `<main class="innhold"><p>Kunne ikke laste konfigurasjonen: ${e.message}</p></main>`;
    return;
  }
  render(html`<${App} />`, document.getElementById('app'));
  bePersistent();
  registrerServiceWorker();
}

// ---------- Offline (service worker) og oppdateringer ----------
function registrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const visOppdatering = (w) => {
      const el = document.getElementById('oppdatering');
      el.hidden = false;
      el.onclick = () => {
        flushAll();
        setTimeout(() => w.postMessage('SKIP_WAITING'), 300);
      };
    };
    if (reg.waiting && navigator.serviceWorker.controller) visOppdatering(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) visOppdatering(w);
      });
    });
    // Se etter ny versjon når appen åpnes igjen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  });
  let lastetPaNytt = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (lastetPaNytt) return;
    lastetPaNytt = true;
    location.reload();
  });
}

start();
