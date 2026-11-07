// Arbeidsmappe på PC: hver befaring lagres som en egen fil i en mappe du velger selv, for eksempel en SharePoint-mappe.
// Filene er vanlige overføringsfiler, så de kan leses inn igjen her eller på telefonen.
// Nettleseren kan slette sine egne data, så denne mappen er det varige lageret på PC-en. Ingenting sendes til nett av appen.
import { db, onLagret, setConfigRad, slettConfigRad } from './db.js';
import { lagSikkerhetskopi, befaringFilnavn } from './sikkerhetskopi.js';
import { useState, useEffect } from './lib.js';

const MAPPE = 'lokal:arbeidsmappe';
const LAGRET = 'lokal:arbeidsmappe-lagret';
const VENT_MS = 30000;

let tilstand = { status: 'av', navn: null, sist: null, feil: null };
const lyttere = new Set();
function sett(ny) {
  tilstand = { ...tilstand, ...ny };
  for (const fn of lyttere) fn(tilstand);
}

export const stottes = () => 'showDirectoryPicker' in window;

export function useArbeidsmappe() {
  const [t, setT] = useState(tilstand);
  useEffect(() => {
    lyttere.add(setT);
    setT(tilstand);
    return () => lyttere.delete(setT);
  }, []);
  return t;
}

async function hentMappe() {
  const rad = await db.innstillinger.get(MAPPE);
  return rad ? rad.value : null;
}

async function harTilgang(mappe, spor = false) {
  const opt = { mode: 'readwrite' };
  if ((await mappe.queryPermission(opt)) === 'granted') return true;
  return spor ? (await mappe.requestPermission(opt)) === 'granted' : false;
}

let kjorer = false;
let igjen = false;

/** Skriver befaringer som er endret siden sist. Med alle = true skrives alle. */
export async function lagreTilMappe({ alle = false } = {}) {
  if (kjorer) {
    igjen = true;
    return;
  }
  const mappe = await hentMappe();
  if (!mappe) return;
  if (!(await harTilgang(mappe))) {
    sett({ status: 'trengerTilgang', navn: mappe.name });
    return;
  }
  kjorer = true;
  try {
    const rad = await db.innstillinger.get(LAGRET);
    const lagret = { ...(rad ? rad.value : {}) };
    const bef = (await db.befaringer.toArray()).filter((b) => !b.slettet);
    let skrevet = 0;
    for (const b of bef) {
      const forrige = lagret[b.id];
      if (!alle && forrige && forrige.tid >= (b.updated || 0)) continue;
      sett({ status: 'lagrer', feil: null });
      const tid = b.updated || Date.now();
      const { fil } = await lagSikkerhetskopi(() => {}, { befaringId: b.id });
      const navn = (forrige && forrige.navn) || (await befaringFilnavn(b));
      const handle = await mappe.getFileHandle(navn, { create: true });
      const skriv = await handle.createWritable();
      await skriv.write(fil);
      await skriv.close();
      lagret[b.id] = { tid, navn };
      await setConfigRad(LAGRET, lagret);
      skrevet++;
    }
    sett({ status: 'ok', navn: mappe.name, sist: skrevet ? Date.now() : tilstand.sist, feil: null });
  } catch (e) {
    console.error('Kunne ikke lagre til arbeidsmappen', e);
    sett({ status: 'feil', feil: e.message || String(e) });
  } finally {
    kjorer = false;
    if (igjen) {
      igjen = false;
      planlegg(1000);
    }
  }
}

let timer = 0;
function planlegg(ms = VENT_MS) {
  clearTimeout(timer);
  timer = setTimeout(() => lagreTilMappe(), ms);
}

export async function velgMappe() {
  const mappe = await window.showDirectoryPicker({ id: 'befaring', mode: 'readwrite' });
  await setConfigRad(MAPPE, mappe);
  sett({ status: 'ok', navn: mappe.name, feil: null });
  await lagreTilMappe({ alle: true });
}

/** Må kalles fra et klikk. Nettleseren spør om tilgang på nytt etter omstart. */
export async function giTilgang() {
  const mappe = await hentMappe();
  if (!mappe) return;
  if (await harTilgang(mappe, true)) {
    sett({ status: 'ok', navn: mappe.name, feil: null });
    await lagreTilMappe();
  }
}

export async function fjernMappe() {
  await slettConfigRad(MAPPE);
  await slettConfigRad(LAGRET);
  sett({ status: 'av', navn: null, sist: null, feil: null });
}

/** Startes én gang når appen åpnes. Gjør ingenting før det er valgt en mappe. */
export async function startArbeidsmappe() {
  if (!stottes()) return;
  const mappe = await hentMappe();
  if (mappe) {
    const ok = await harTilgang(mappe).catch(() => false);
    sett({ status: ok ? 'ok' : 'trengerTilgang', navn: mappe.name });
    if (ok) lagreTilMappe();
  }
  onLagret(() => { if (tilstand.status !== 'av') planlegg(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && tilstand.status !== 'av') lagreTilMappe();
  });
}
