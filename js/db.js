// Lokal database (IndexedDB via Dexie). Alle data ligger kun på telefonen.
import Dexie, { liveQuery } from '../vendor/dexie.mjs';
import { useState, useEffect } from './lib.js';

export const db = new Dexie('befaringsapp');

db.version(1).stores({
  prosjekter: 'id, updated',
  befaringer: 'id, prosjektId, start, updated',
  observasjoner: 'id, befaringId, updated',
  malinger: 'id, obsId, befaringId',
  sprekkesett: 'id, obsId, befaringId',
  fotos: 'id, obsId, befaringId',
  innstillinger: 'key',
});

// ---------- «Lagret»-indikator ----------
const lagretLyttere = new Set();
export function onLagret(fn) {
  lagretLyttere.add(fn);
  return () => lagretLyttere.delete(fn);
}
function varsleLagret() {
  for (const fn of lagretLyttere) fn(Date.now());
}

// ---------- Skriving ----------
export async function add(table, obj) {
  const now = Date.now();
  const rad = { created: now, updated: now, slettet: null, ...obj };
  await db[table].add(rad);
  if (rad.befaringId) await db.befaringer.update(rad.befaringId, { updated: now });
  varsleLagret();
  return rad;
}

/** Oppdaterer felt. Støtter punktnotasjon, f.eks. {'sted.side': 'Høyre'}. */
export async function patch(table, id, changes) {
  const now = Date.now();
  await db[table].update(id, { ...changes, updated: now });
  if (table !== 'befaringer' && table !== 'prosjekter') {
    const rad = await db[table].get(id);
    if (rad && rad.befaringId) await db.befaringer.update(rad.befaringId, { updated: now });
  }
  varsleLagret();
}

/** «Sletting» flytter til papirkurven. Ingenting forsvinner for godt. */
export async function softDelete(table, id) {
  await db[table].update(id, { slettet: Date.now() });
  varsleLagret();
}
export async function restore(table, id) {
  await db[table].update(id, { slettet: null, updated: Date.now() });
  varsleLagret();
}

// ---------- Innstillinger ----------
export const STANDARD_INNSTILLINGER = {
  utfortAv: '',
  firma: '',
  orienteringsformat: 'fall', // 'fall' = fall/fallretning, 'strok' = strøk/fall (høyrehåndsregel)
  misvisning: 0,
  friksjonsvinkel: 30,
  sideavgrensning: 20,
  gps: true,
  utmSone: 32,
  tema: 'auto', // auto | lys | mork
  sisteSikkerhetskopi: null,
};

export async function getInnstillinger() {
  const rad = await db.innstillinger.get('generelt');
  return { ...STANDARD_INNSTILLINGER, ...(rad ? rad.value : {}) };
}
export async function setInnstilling(key, value) {
  const naa = await getInnstillinger();
  await db.innstillinger.put({ key: 'generelt', value: { ...naa, [key]: value } });
  varsleLagret();
}

export async function setConfigRad(key, value) {
  await db.innstillinger.put({ key, value });
  varsleLagret();
}
export async function slettConfigRad(key) {
  await db.innstillinger.delete(key);
  varsleLagret();
}

// ---------- Lagring som ikke slettes av iOS ----------
export async function bePersistent() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (e) {
    console.warn('persist feilet', e);
  }
  return false;
}
export async function lagringsInfo() {
  const info = { persistent: null, brukt: null, kvote: null };
  try {
    if (navigator.storage) {
      if (navigator.storage.persisted) info.persistent = await navigator.storage.persisted();
      if (navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        info.brukt = e.usage;
        info.kvote = e.quota;
      }
    }
  } catch (e) {
    /* ignorer */
  }
  return info;
}

// ---------- Reaktiv spørring for Preact ----------
/** Kjører spørringen og kjører den på nytt når data endres. */
export function useLive(fn, deps = [], initial = undefined) {
  const [val, setVal] = useState(initial);
  useEffect(() => {
    const sub = liveQuery(fn).subscribe({
      next: (v) => setVal(() => v),
      error: (e) => console.error('liveQuery', e),
    });
    return () => sub.unsubscribe();
  }, deps);
  return val;
}

export const ikkeSlettet = (r) => r && !r.slettet;
