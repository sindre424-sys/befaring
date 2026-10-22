// Sikkerhetskopi: alle data, bilder og konfigurasjon i én zip-fil – og innlesing av en slik fil.
// Innlesing sletter aldri noe: data slås sammen, og nyeste versjon av hver rad beholdes.
import { db, setInnstilling, getInnstillinger } from './db.js';
import { lastJszip } from './eksport/last.js';
import { APP_VERSJON } from './versjon.js';
import { pad2 } from './util.js';

const FORMAT = 'befaringsapp-sikkerhetskopi';
const TABELLER = ['prosjekter', 'befaringer', 'observasjoner', 'malinger', 'sprekkesett', 'fotos'];

export async function lagSikkerhetskopi(fremdrift = () => {}) {
  const JSZip = await lastJszip();
  const zip = new JSZip();
  const tabeller = {};
  let bilder = 0;
  for (const t of TABELLER) {
    const rader = await db[t].toArray();
    if (t === 'fotos') {
      tabeller[t] = [];
      for (const f of rader) {
        const { blob, miniatyr, ...rest } = f;
        const rad = { ...rest };
        if (blob) {
          rad.fil = `bilder/${f.id}.jpg`;
          zip.file(rad.fil, blob, { binary: true, compression: 'STORE' });
        }
        if (miniatyr) {
          rad.miniatyrFil = `bilder/${f.id}_mini.jpg`;
          zip.file(rad.miniatyrFil, miniatyr, { binary: true, compression: 'STORE' });
        }
        tabeller[t].push(rad);
        fremdrift(++bilder);
      }
    } else {
      tabeller[t] = rader;
    }
  }
  const innstillinger = await db.innstillinger.toArray();
  const innhold = {
    format: FORMAT,
    formatVersjon: 1,
    appVersjon: APP_VERSJON,
    laget: Date.now(),
    antall: Object.fromEntries(TABELLER.map((t) => [t, tabeller[t].length])),
    tabeller,
    innstillinger,
  };
  zip.file('data.json', JSON.stringify(innhold), { compression: 'DEFLATE' });
  zip.file('LES_MEG.txt',
    'Sikkerhetskopi fra Befaringsapp.\n' +
    'Gjenopprett: Innstillinger → Sikkerhetskopi → «Gjenopprett fra fil» og velg denne zip-filen.\n' +
    'Filen inneholder alle befaringer, observasjoner, målinger, sprekkesett, bilder og innstillinger.\n');
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
  const d = new Date();
  const navn = `Befaringsapp_sikkerhetskopi_${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}.zip`;
  return { fil: new File([blob], navn, { type: 'application/zip' }), antall: innhold.antall };
}

export async function markerSikkerhetskopiTatt() {
  await setInnstilling('sisteSikkerhetskopi', Date.now());
}

/** Leser en sikkerhetskopi og returnerer en oversikt før noe skrives. */
export async function lesSikkerhetskopi(fil) {
  const JSZip = await lastJszip();
  let zip;
  try {
    zip = await JSZip.loadAsync(fil);
  } catch (e) {
    throw new Error('Filen er ikke en gyldig zip-fil.');
  }
  const dataFil = zip.file('data.json');
  if (!dataFil) throw new Error('Fant ikke data.json – dette er ikke en sikkerhetskopi fra Befaringsapp.');
  const innhold = JSON.parse(await dataFil.async('string'));
  if (innhold.format !== FORMAT) throw new Error('Ukjent filformat.');
  return { zip, innhold };
}

/** Slår sammen sikkerhetskopien med det som finnes. Nyeste versjon (etter «updated») vinner. */
export async function gjenopprett({ zip, innhold }, fremdrift = () => {}) {
  const res = { nye: 0, oppdatert: 0, uendret: 0 };
  for (const t of TABELLER) {
    for (const rad of innhold.tabeller[t] || []) {
      const finnes = await db[t].get(rad.id);
      if (finnes && (finnes.updated || 0) >= (rad.updated || 0)) {
        res.uendret++;
        continue;
      }
      const ny = { ...rad };
      if (t === 'fotos') {
        const { fil, miniatyrFil } = ny;
        delete ny.fil;
        delete ny.miniatyrFil;
        if (fil && zip.file(fil)) ny.blob = new Blob([await zip.file(fil).async('uint8array')], { type: rad.type || 'image/jpeg' });
        if (miniatyrFil && zip.file(miniatyrFil)) ny.miniatyr = new Blob([await zip.file(miniatyrFil).async('uint8array')], { type: 'image/jpeg' });
        fremdrift();
      }
      await db[t].put(ny);
      finnes ? res.oppdatert++ : res.nye++;
    }
  }
  // Innstillinger og valglister: tas inn fra sikkerhetskopien, men tidspunkt for siste sikkerhetskopi beholdes lokalt.
  const lokal = await getInnstillinger();
  for (const rad of innhold.innstillinger || []) {
    if (rad.key === 'config:egne') {
      const her = await db.innstillinger.get('config:egne');
      await db.innstillinger.put({ key: rad.key, value: [...new Set([...(her ? her.value : []), ...(rad.value || [])])] });
    } else if (rad.key === 'generelt') {
      await db.innstillinger.put({ key: 'generelt', value: { ...lokal, ...rad.value, sisteSikkerhetskopi: lokal.sisteSikkerhetskopi } });
    } else {
      await db.innstillinger.put(rad);
    }
  }
  return res;
}

/** Skal appen minne om sikkerhetskopi? (over 14 dager siden sist, eller aldri tatt og det finnes egne data) */
export async function trengerSikkerhetskopi() {
  const inn = await getInnstillinger();
  const egne = await db.befaringer.filter((b) => !b.test && !b.slettet).count();
  if (!egne) return null;
  if (!inn.sisteSikkerhetskopi) return { dager: null };
  const dager = Math.floor((Date.now() - inn.sisteSikkerhetskopi) / 86400000);
  return dager > 14 ? { dager } : null;
}
