// Felles uttrekk av data til skissene (brukes både i appen og i eksport).
import { norm360 } from '../util.js';
import { middelPlan, kinematikk } from './stereonett.js';

const erFlate = (navn) => /skj(æ|ae)ringsflate|skj\.?\s*flate/i.test(navn || '');
const harOrientering = (s) => s.fall !== null && s.fall !== undefined && s.fallretning !== null && s.fallretning !== undefined;

/** Sprekker (korrigert for misvisning) og skjæringsflate for én observasjon. */
export function orienteringerForObs(o, sett, misvisning = 0) {
  const sprekker = [];
  let flateFraSett = null;
  for (const s of sett || []) {
    if (!harOrientering(s)) continue;
    const p = { navn: s.navn || '?', fall: Number(s.fall), fallretning: norm360(Number(s.fallretning) + (s.misvisning || 0)) };
    if (erFlate(s.navn)) flateFraSett = p;
    else sprekker.push(p);
  }
  let flate = null;
  const g = o.geometri || {};
  if (g.helning !== null && g.helning !== undefined && g.fallretning !== null && g.fallretning !== undefined) {
    flate = { fall: Number(g.helning), fallretning: norm360(Number(g.fallretning) + (misvisning || 0)) };
  } else if (flateFraSett) {
    flate = flateFraSett;
  }
  return { sprekker, flate };
}

/** Analyse for én observasjon (kun skjæring har kinematikk). */
export function analyseForObs(o, sett, inn, erSkjaering) {
  const { sprekker, flate } = orienteringerForObs(o, sett, inn.misvisning);
  const analyse = erSkjaering && flate && sprekker.length ? kinematikk(sprekker, flate, inn.friksjonsvinkel ?? 30, inn.sideavgrensning ?? 20) : null;
  return { sprekker, flate: erSkjaering ? flate : null, analyse };
}

/** Samlet stereonett per side for alle skjæringsobservasjoner i befaringen. */
export function samletPerSide(obsListe, settFor, inn) {
  const sider = {};
  for (const o of obsListe) {
    const side = (o.sted && o.sted.side) || 'Uten side';
    const { sprekker, flate } = orienteringerForObs(o, settFor[o.id], inn.misvisning);
    const s = (sider[side] ||= { side, sprekker: [], flater: [], obs: [] });
    s.obs.push(o);
    for (const p of sprekker) s.sprekker.push(p);
    if (flate) s.flater.push(flate);
  }
  return Object.values(sider).map((s) => {
    const flate = middelPlan(s.flater);
    const analyse = flate && s.sprekker.length ? kinematikk(s.sprekker, flate, inn.friksjonsvinkel ?? 30, inn.sideavgrensning ?? 20) : null;
    const spredning = s.flater.length > 1 ? Math.max(...s.flater.map((x) => Math.abs(x.fall - flate.fall))) : 0;
    return { ...s, flate, analyse, ulikeFlater: spredning > 15 };
  }).filter((s) => s.sprekker.length || s.flate);
}

const RANG = { rod: 3, gul: 2, gronn: 1 };
/** Antall og verste alvorlighet per posisjon (til oversiktsskisser for tunnel og påhugg). */
export function posisjonsOversikt(obsListe) {
  const ut = {};
  for (const o of obsListe) {
    for (const p of o.posisjon || []) {
      const x = (ut[p] ||= { antall: 0, verst: 'ingen' });
      x.antall++;
      if ((RANG[o.alvorlighet] || 0) > (RANG[x.verst] || 0)) x.verst = o.alvorlighet;
    }
  }
  return ut;
}
