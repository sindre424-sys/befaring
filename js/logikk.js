// Fagregler: nye observasjoner, profilforslag, GPS og orientering.
import { db, add, patch, getInnstillinger } from './db.js';
import { uid, norm360 } from './util.js';

/** Oppretter en ny observasjon som arver fra befaringen og forrige observasjon. */
export async function nyObservasjon(bef, objekttype) {
  const alle = await db.observasjoner.where('befaringId').equals(bef.id).toArray();
  // Løpenummer teller også observasjoner i papirkurven, så gjenoppretting aldri gir duplikater.
  const lopenr = alle.reduce((m, o) => Math.max(m, o.lopenr || 0), 0) + 1;
  const aktive = alle.filter((o) => !o.slettet).sort((a, b) => a.lopenr - b.lopenr);
  if (!objekttype) {
    const sisteObs = aktive[aktive.length - 1];
    objekttype = sisteObs && bef.objekttyper.includes(sisteObs.objekttype) ? sisteObs.objekttype : bef.objekttyper[0];
  }
  const forrige = aktive.filter((o) => o.objekttype === objekttype).pop();
  const obs = await add('observasjoner', {
    id: uid(),
    befaringId: bef.id,
    objekttype,
    lopenr,
    tid: Date.now(),
    gps: null,
    gpsAv: false,
    profilFra: forrige ? forrige.profilTil ?? forrige.profilFra ?? null : null,
    profilTil: null,
    omrade: bef.omrade || '',
    sted: forrige && forrige.sted ? { ...forrige.sted } : {},
    posisjon: [],
    obsType: null,
    status: [],
    vurdering: null,
    alvorlighet: null,
    alvorlighetManuell: false,
    tekst: '',
    tiltak: '',
    geometri: forrige && forrige.geometri ? { ...forrige.geometri } : {},
    test: !!bef.test,
  });
  const inn = await getInnstillinger();
  if (inn.gps) hentGps(obs.id);
  return obs;
}

/** Henter GPS-posisjon i bakgrunnen og lagrer den på observasjonen. */
export function hentGps(obsId, overskriv = false) {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const obs = await db.observasjoner.get(obsId);
        if (!obs || (obs.gps && !overskriv) || obs.gpsAv) return resolve(null);
        const gps = {
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          noyaktighet: Math.round(p.coords.accuracy),
          hoyde: p.coords.altitude ?? null,
          tid: p.timestamp,
        };
        await patch('observasjoner', obsId, { gps });
        resolve(gps);
      },
      (e) => {
        console.warn('GPS', e.message);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    );
  });
}

export function hentGpsPosisjon() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, noyaktighet: Math.round(p.coords.accuracy), tid: p.timestamp }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
    );
  });
}

// ---------- Orientering ----------
// Lagres alltid som fall/fallretning. Strøk følger høyrehåndsregelen: fallretning = strøk + 90°.
export const strokTilFallretning = (strok) => (strok === null ? null : norm360(strok + 90));
export const fallretningTilStrok = (fr) => (fr === null || fr === undefined ? null : norm360(fr - 90));

export const fmtRetning = (v) => (v === null || v === undefined ? '–' : String(Math.round(v)).padStart(3, '0'));
export const fmtFall = (v) => (v === null || v === undefined ? '–' : String(Math.round(v)).padStart(2, '0'));

/** Kort tekst for et sprekkesett, f.eks. «70/085». */
export function orienteringTekst(s) {
  return `${fmtFall(s.fall)}/${fmtRetning(s.fallretning)}`;
}

/** Neste ledige sprekkesettnavn (J1, J2 …) i en observasjon. */
export function nesteSettNavn(eksisterende, navneliste) {
  const brukt = new Set(eksisterende.map((s) => s.navn));
  const j = navneliste.filter((n) => /^J\d+$/.test(n));
  for (const n of j) if (!brukt.has(n)) return n;
  let i = 1;
  while (brukt.has('J' + i)) i++;
  return 'J' + i;
}

/** Foreslått alvorlighet ut fra vurdering. */
export function alvorlighetFraVurdering(vurdering, felles) {
  const v = (felles.vurderinger || []).find((x) => x.navn === vurdering);
  return v ? v.alvorlighet || null : null;
}
