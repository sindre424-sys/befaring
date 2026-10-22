// Henter alle data for én befaring og bygger én felles «rapportmodell».
// Word og PDF tegnes fra samme modell, så innhold, rekkefølge og figurnumre blir like.
import { db, getInnstillinger } from '../db.js';
import { hentConfig } from '../config.js';
import { profilTekst, obsNr, fmtDato, fmtDatoTid, fmtNum, ALVORLIGHET, norm360, pad2 } from '../util.js';
import { stedForFoto } from '../bilder.js';
import { fallretningTilStrok, fmtRetning, fmtFall } from '../logikk.js';

const aktive = (l) => l.filter((x) => !x.slettet);
const etterTid = (a, b) => (a.created || 0) - (b.created || 0);

export async function hentBefaringData(befaringId) {
  const b = await db.befaringer.get(befaringId);
  if (!b) throw new Error('Fant ikke befaringen');
  const p = b.prosjektId ? await db.prosjekter.get(b.prosjektId) : null;
  const obs = aktive(await db.observasjoner.where('befaringId').equals(befaringId).toArray()).sort((x, y) => x.lopenr - y.lopenr);
  const obsIder = new Set(obs.map((o) => o.id));
  const gruppe = (liste) => {
    const m = {};
    for (const o of obs) m[o.id] = [];
    for (const x of aktive(liste)) if (obsIder.has(x.obsId)) m[x.obsId].push(x);
    return m;
  };
  const malinger = gruppe(await db.malinger.where('befaringId').equals(befaringId).toArray());
  const sett = gruppe(await db.sprekkesett.where('befaringId').equals(befaringId).toArray());
  const fotos = gruppe(await db.fotos.where('befaringId').equals(befaringId).toArray());
  for (const id in malinger) malinger[id].sort(etterTid);
  for (const id in sett) sett[id].sort(etterTid);
  for (const id in fotos) fotos[id].sort((x, y) => x.tid - y.tid);
  const config = await hentConfig();
  const inn = await getInnstillinger();
  return { b, p, obs, malinger, sett, fotos, config, inn };
}

export function typeFor(config, id) {
  return config.typer[id] || { id, navn: id || 'Ukjent', kortnavn: id || 'Ukjent', stedsfelt: [], geometri: null, rekkefolge: 99, profil: {} };
}

/** «Observasjon 01 – Profil 920–935, skjæring høyre side» */
export function obsOverskrift(o, t) {
  let s = `Observasjon ${obsNr(o.lopenr)} – ${profilTekst(o.profilFra, o.profilTil)}, ${(t.kortnavn || t.navn).toLowerCase()}`;
  if (o.sted && o.sted.side) s += ` ${o.sted.side.toLowerCase()} side`;
  if (o.sted && o.sted.del) s += `, ${o.sted.del.toLowerCase()}`;
  return s;
}

/** Fallretning korrigert for misvisning (lagres som avlest). */
export const korrigertRetning = (s) =>
  s.fallretning === null || s.fallretning === undefined ? null : norm360(s.fallretning + (s.misvisning || 0));

export const fmtVerdi = (v) => (v === null || v === undefined || v === '' ? '' : fmtNum(v, 3));

export function filnavnDel(s) {
  return String(s || '')
    .replace(/[æÆ]/g, 'ae').replace(/[øØ]/g, 'o').replace(/[åÅ]/g, 'a')
    .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function grunnFilnavn(data) {
  const d = new Date(data.b.start);
  const dato = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const nr = filnavnDel(data.p && (data.p.prosjektnummer || data.p.navn)) || 'befaring';
  return `${nr}_${dato}`;
}

/** Rekkefølgen på objekttyper i rapporten (f.eks. Skjæring → Påhugg → Tunnel). */
export function typerIRekkefolge(data) {
  const ider = new Set([...(data.b.objekttyper || []), ...data.obs.map((o) => o.objekttype)]);
  return [...ider].sort((x, y) => (typeFor(data.config, x).rekkefolge ?? 99) - (typeFor(data.config, y).rekkefolge ?? 99));
}

/** Bygger rapportmodellen. Figurer nummereres fortløpende i den rekkefølgen de står i notatet. */
export function byggModell(data) {
  const { b, p, obs, malinger, sett, fotos, config, inn } = data;
  let figNr = 0;
  const figurFor = {}; // foto-id → figurnummer (brukes også i Excel og bilde-zip)
  const seksjoner = [];

  for (const typeId of typerIRekkefolge(data)) {
    const t = typeFor(config, typeId);
    const liste = obs.filter((o) => o.objekttype === typeId);
    const seksjon = { typeId, tittel: t.navn, oversiktFigurer: [], observasjoner: [] };
    for (const o of liste) {
      const felter = [['Registrert', fmtDatoTid(o.tid)]];
      if (o.omrade) felter.push(['Område', o.omrade]);
      for (const sf of t.stedsfelt || []) {
        const v = o.sted && o.sted[sf.id];
        if (v !== null && v !== undefined && v !== '') felter.push([sf.navn, typeof v === 'number' ? fmtNum(v) : String(v)]);
      }
      if (o.posisjon && o.posisjon.length) felter.push(['Posisjon', o.posisjon.join(', ')]);
      if (o.obsType) felter.push(['Observasjonstype', o.obsType]);
      felter.push(['Status', o.status && o.status.length ? o.status.join(', ') : 'Ikke angitt']);

      const geometri = [];
      if (t.geometri && t.geometri.felt) {
        for (const f of t.geometri.felt) {
          const v = o.geometri && o.geometri[f.id];
          if (v !== null && v !== undefined && v !== '') geometri.push([f.navn, fmtVerdi(v), f.enhet || '']);
        }
      }
      const mal = (malinger[o.id] || []).map((m) => [m.type, fmtVerdi(m.verdi), m.enhet || '', m.kommentar || '']);
      const settRader = (sett[o.id] || []).map((s) => {
        const kr = korrigertRetning(s);
        return [
          s.navn || '',
          `${fmtFall(s.fall)}/${fmtRetning(kr)}`,
          `${fmtRetning(kr === null ? null : fallretningTilStrok(kr))}/${fmtFall(s.fall)}`,
          s.avstand !== null && s.avstand !== undefined ? fmtVerdi(s.avstand) : '',
          s.utholdenhet !== null && s.utholdenhet !== undefined ? fmtVerdi(s.utholdenhet) : '',
          s.ruhet || '',
          s.kommentar || '',
        ];
      });
      const figurer = (fotos[o.id] || []).map((f) => {
        const nr = ++figNr;
        figurFor[f.id] = nr;
        const sted = f.sted || stedForFoto(o);
        return { nr, foto: f, tekst: `Figur ${nr}: ${sted}${f.kommentar ? ' – ' + f.kommentar : ''}` };
      });
      seksjon.observasjoner.push({
        o, t, overskrift: obsOverskrift(o, t), felter, tekst: o.tekst || '', geometri, malinger: mal, sett: settRader,
        skisser: [], // fase 4: skisser og stereonett
        vurdering: o.vurdering || '', alvorlighet: o.alvorlighet || null, tiltak: o.tiltak || '', figurer,
      });
    }
    seksjoner.push(seksjon);
  }

  const dato = b.slutt && fmtDato(b.slutt) !== fmtDato(b.start) ? `${fmtDato(b.start)}–${fmtDato(b.slutt)}` : fmtDato(b.start);
  const meta = {
    tittel: `Befaringsnotat${b.omrade ? ' – ' + b.omrade : ''}`,
    prosjekt: p ? p.navn : '',
    prosjektnummer: p ? p.prosjektnummer || '' : '',
    oppdragsgiver: p ? p.oppdragsgiver || '' : '',
    dato,
    utfortAv: b.utfortAv || '',
    deltakere: b.deltakere || '',
    omrade: b.omrade || '',
    formal: b.formal || '',
    vaer: b.vaer || '',
    kommentar: b.kommentar || '',
    firma: inn.firma || '',
    objekttyper: seksjoner.map((s) => s.tittel),
    laget: fmtDatoTid(Date.now()),
  };
  const infoRader = [
    ['Prosjekt', meta.prosjekt],
    ['Prosjektnummer', meta.prosjektnummer],
    ['Oppdragsgiver/byggherre', meta.oppdragsgiver],
    ['Dato', meta.dato],
    ['Utført av', meta.utfortAv],
    ['Deltakere', meta.deltakere],
    ['Område', meta.omrade],
    ['Objekttyper', meta.objekttyper.join(', ')],
  ].filter(([, v]) => v);

  const oppsummering = seksjoner.flatMap((s) => s.observasjoner.map((x) => ({
    nr: obsNr(x.o.lopenr),
    type: x.t.kortnavn || x.t.navn,
    profil: profilTekst(x.o.profilFra, x.o.profilTil).replace('Profil ', ''),
    obsType: x.o.obsType || '',
    alvorlighet: x.alvorlighet,
    alvorlighetTekst: x.alvorlighet ? ALVORLIGHET[x.alvorlighet].navn : '',
    vurdering: x.vurdering,
    tiltak: x.tiltak,
  })));

  return { meta, infoRader, seksjoner, oppsummering, figurFor, antallFigurer: figNr };
}

// Farger for alvorlighet i rapporter (lys bakgrunn som også tåler utskrift i gråtoner)
export const ALV_FARGE = { gronn: 'C8E6C9', gul: 'FFF0B3', rod: 'F8C9C7' };
export const ALV_SYMBOL = { gronn: '●', gul: '●', rod: '●' };

/** Skalerer et bilde for rapport (mindre filer på e-post). */
export async function bildeForRapport(blob, maks) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Bildet kunne ikke leses'));
      i.src = url;
    });
    const s = Math.min(1, maks / Math.max(img.naturalWidth, img.naturalHeight));
    const b = Math.round(img.naturalWidth * s);
    const h = Math.round(img.naturalHeight * s);
    if (s === 1 && blob.type === 'image/jpeg') return { blob, bredde: b, hoyde: h };
    const c = document.createElement('canvas');
    c.width = b;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, b, h);
    const ut = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    c.width = c.height = 0;
    return { blob: ut, bredde: b, hoyde: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Bildestørrelse i notatet: tilpasset sidebredden, men ikke for høye stående bilder. */
export function figurMal(bredde, hoyde, maksB, maksH) {
  const s = Math.min(maksB / bredde, maksH / hoyde);
  return { b: Math.round(bredde * s), h: Math.round(hoyde * s) };
}
