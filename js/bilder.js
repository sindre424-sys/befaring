// Bilder: komprimering, lagring og visning.
// Bildene lagres i den lokale databasen på telefonen (maks 2000 px langside, JPEG).
import { html, useState, useEffect } from './lib.js';
import { db, add, patch, getInnstillinger } from './db.js';
import { uid, profilTekst } from './util.js';
import { hentGpsPosisjon } from './logikk.js';
import { TegningOverlegg } from './tegning.js';

export const MAKS_LANGSIDE = 2000;
export const KVALITET = 0.85;
const MINIATYR = 480;

function lastBilde(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Bildet kunne ikke leses'));
    };
    img.src = url;
  });
}

function tegnJpeg(kilde, b, h, kvalitet) {
  const c = document.createElement('canvas');
  c.width = b;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(kilde, 0, 0, b, h);
  return new Promise((resolve, reject) => {
    c.toBlob((blob) => {
      c.width = 0;
      c.height = 0; // frigjør minne på iPhone
      blob ? resolve(blob) : reject(new Error('Kunne ikke lage JPEG'));
    }, 'image/jpeg', kvalitet);
  });
}

/** Skalerer ned til maks 2000 px langside og lager en liten miniatyr. iPhone roterer riktig selv. */
export async function komprimer(fil) {
  const { img, url } = await lastBilde(fil);
  try {
    const b0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    const s = Math.min(1, MAKS_LANGSIDE / Math.max(b0, h0));
    const b = Math.round(b0 * s);
    const h = Math.round(h0 * s);
    const blob = await tegnJpeg(img, b, h, KVALITET);
    const sm = Math.min(1, MINIATYR / Math.max(b0, h0));
    const miniatyr = await tegnJpeg(img, Math.round(b0 * sm), Math.round(h0 * sm), 0.75);
    return { blob, miniatyr, bredde: b, hoyde: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Standard stedstekst for et bilde, f.eks. «Profil 935, høyre side, heng». */
export function stedForFoto(o) {
  if (!o) return '';
  const deler = [profilTekst(o.profilFra, o.profilTil)];
  if (o.sted && o.sted.side) deler.push(o.sted.side.toLowerCase() + ' side');
  if (o.sted && o.sted.del) deler.push(o.sted.del.toLowerCase());
  if (o.posisjon && o.posisjon.length) deler.push(o.posisjon.join(', ').toLowerCase());
  return deler.join(', ');
}

/** Lagrer ett bilde på en observasjon. Feiler komprimeringen, lagres originalen – bildet går aldri tapt. */
export async function lagreFoto(fil, obs, fraKamera) {
  let data;
  let komprimert = true;
  try {
    data = await komprimer(fil);
  } catch (e) {
    console.warn('Komprimering feilet, lagrer original', e);
    komprimert = false;
    data = { blob: fil, miniatyr: null, bredde: null, hoyde: null };
  }
  const tid = fraKamera || !fil.lastModified ? Date.now() : fil.lastModified;
  const foto = await add('fotos', {
    id: uid(),
    obsId: obs.id,
    befaringId: obs.befaringId,
    blob: data.blob,
    miniatyr: data.miniatyr,
    bredde: data.bredde,
    hoyde: data.hoyde,
    type: data.blob.type || 'image/jpeg',
    storrelse: data.blob.size,
    komprimert,
    fraKamera: !!fraKamera,
    tid,
    gps: obs.gps || null,
    sted: null, // null = følger observasjonen automatisk
    kommentar: '',
    test: !!obs.test,
  });
  // Oppdater GPS for bildet i bakgrunnen (bare for bilder tatt nå).
  if (fraKamera) {
    getInnstillinger().then((inn) => {
      if (!inn.gps || obs.gpsAv) return;
      hentGpsPosisjon().then((gps) => gps && patch('fotos', foto.id, { gps }));
    });
  }
  return foto;
}

// ---------- Visning ----------
const miniatyrUrler = new Map();

/** Miniatyr som ikke tegnes på nytt hver gang noe lagres (adressen gjenbrukes per bilde). */
export function Miniatyr({ foto, onClick, klasse = 'miniatyr' }) {
  const kilde = foto.miniatyr || foto.blob;
  let url = miniatyrUrler.get(foto.id);
  if (!url && kilde) {
    url = URL.createObjectURL(kilde);
    miniatyrUrler.set(foto.id, url);
  }
  return html`<button type="button" class=${klasse} onClick=${onClick} aria-label="Vis bildet i full størrelse">
    ${url ? html`<img src=${url} alt="" />` : html`<span>?</span>`}
    <${TegningOverlegg} tegning=${foto.tegning} dekk />
    ${foto.tegning && foto.tegning.figurer && foto.tegning.figurer.length ? html`<span class="tegnet-merke" aria-hidden="true">✏️</span>` : ''}
  </button>`;
}

/** Fullt bilde. Adressen lages og frigjøres sammen med visningen. */
export function FulltBilde({ foto }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!foto || !foto.blob) return;
    const u = URL.createObjectURL(foto.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [foto && foto.id]);
  return url ? html`<span class="fullt-ramme"><img class="fullt-bilde" src=${url} alt=${foto.kommentar || 'Bilde'} /><${TegningOverlegg} tegning=${foto.tegning} /></span>` : null;
}

export async function hentFotos(obsId) {
  return (await db.fotos.where('obsId').equals(obsId).toArray())
    .filter((f) => !f.slettet)
    .sort((a, b) => a.tid - b.tid);
}

// ---------- Testbilder (fiktive) ----------
/** Tegner et enkelt fiktivt «bergbilde» slik at testdataene har bilder. */
export async function lagTestbilde(tekst, frø = 1) {
  let s = frø * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const b = 1600;
  const h = 1200;
  const c = document.createElement('canvas');
  c.width = b;
  c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, b, h);
  g.addColorStop(0, '#6f7378');
  g.addColorStop(1, '#4a4e52');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, b, h);
  for (let i = 0; i < 500; i++) {
    const v = 70 + rnd() * 70;
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 8},0.35)`;
    ctx.beginPath();
    ctx.arc(rnd() * b, rnd() * h, 10 + rnd() * 60, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(20,20,20,0.75)';
  for (let k = 0; k < 3; k++) {
    const vinkel = (rnd() - 0.5) * 1.6 + k * 1.1;
    for (let i = 0; i < 6; i++) {
      ctx.lineWidth = 2 + rnd() * 5;
      const x = rnd() * b;
      const y = rnd() * h;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(vinkel) * 900, y - Math.sin(vinkel) * 900);
      for (let t = -900; t <= 900; t += 150) ctx.lineTo(x + Math.cos(vinkel) * t + (rnd() - 0.5) * 30, y + Math.sin(vinkel) * t + (rnd() - 0.5) * 30);
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, h - 150, b, 150);
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 64px -apple-system, sans-serif';
  ctx.fillText('TESTBILDE – fiktivt', 40, h - 80);
  ctx.fillStyle = '#ffffff';
  ctx.font = '44px -apple-system, sans-serif';
  ctx.fillText(tekst, 40, h - 26);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
  const sm = MINIATYR / b;
  const miniatyr = await tegnJpeg(c, Math.round(b * sm), Math.round(h * sm), 0.75);
  c.width = 0;
  c.height = 0;
  return { blob, miniatyr, bredde: b, hoyde: h };
}
