// Henter alle data for én befaring og bygger én felles «rapportmodell».
// Word og PDF tegnes fra samme modell, så innhold, rekkefølge og figurnumre blir like.
import { db, getInnstillinger } from '../db.js';
import { hentConfig } from '../config.js';
import { profilTekst, obsNr, fmtDato, fmtDatoTid, fmtNum, ALVORLIGHET, norm360, pad2 } from '../util.js';
import { stedForFoto } from '../bilder.js';
import { fallretningTilStrok, fmtRetning, fmtFall } from '../logikk.js';
import { lagBygger, tilSvgTekst, RAPPORT_FARGER } from '../skisser/svg.js';
import { tegnProfilstripe } from '../skisser/profilstripe.js';
import { tegnTunnel } from '../skisser/tunnel.js';
import { tegnSkjaeringSnitt, tegnSkjaeringFasade } from '../skisser/skjaering.js';
import { tegnPahuggFront, tegnPahuggLengdesnitt, pahuggData, harLengdesnittData } from '../skisser/pahugg.js';
import { tegnStereonett, kinematikkTekst, ANSVARSTEKST } from '../skisser/stereonett.js';
import { analyseForObs, samletPerSide, posisjonsOversikt } from '../skisser/data.js';

const R = lagBygger('rapport');
const RF = RAPPORT_FARGER;
/** Gjør en skisse om til en figur i notatet (SVG-tekst med størrelse). */
function skisseFigur(node, maksBredde) {
  const svg = tilSvgTekst(node);
  const b = Number((svg.match(/ width="([\d.]+)"/) || [])[1]) || 340;
  const h = Number((svg.match(/ height="([\d.]+)"/) || [])[1]) || 240;
  return { svg, bredde: b, hoyde: h, maksBredde };
}

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

/** Bygger rapportmodellen. Figurer nummereres fortløpende i den rekkefølgen de står i notatet.
 *  valg.skisser: ta med skisser og stereonett. valg.posisjonsskisser: posisjonsskisse per observasjon. */
export function byggModell(data, valg = {}) {
  const { b, p, obs, malinger, sett, fotos, config, inn } = data;
  const medSkisser = valg.skisser !== false;
  const medPosisjon = !!valg.posisjonsskisser;
  let figNr = 0;
  const nyFigur = (fig, tekst) => ({ ...fig, nr: ++figNr, tekst: `Figur ${figNr}: ${tekst}` });
  const figurFor = {}; // foto-id → figurnummer (brukes også i Excel og bilde-zip)
  const seksjoner = [];

  for (const typeId of typerIRekkefolge(data)) {
    const t = typeFor(config, typeId);
    const liste = obs.filter((o) => o.objekttype === typeId);
    const seksjon = { typeId, tittel: t.navn, oversiktFigurer: [], oversiktTekst: [], observasjoner: [] };
    const skisser = t.skisser || [];
    const ps = t.posisjonsskisse || {};
    const erSkjaering = skisser.includes('stereonett');
    if (medSkisser && liste.length) {
      seksjon.oversiktFigurer.push(nyFigur(skisseFigur(tegnProfilstripe(R, RF, { rader: [{ navn: t.kortnavn || t.navn, obs: liste }], bredde: 560 }), 560),
        `Profilstripe – ${t.navn.toLowerCase()}. Observasjonene er farget etter alvorlighet.`));
      if (skisser.includes('skjaering-fasade')) {
        for (const side of ['Venstre', 'Høyre']) {
          const pa = liste.filter((o) => o.sted && o.sted.side === side);
          if (pa.length) seksjon.oversiktFigurer.push(nyFigur(skisseFigur(tegnSkjaeringFasade(R, RF, { obs: pa, side, soner: ps.soner, bredde: 520 }), 520),
            `Oppriss av skjæringen, ${side.toLowerCase()} side, med observasjonene plottet der de ble registrert.`));
        }
      }
      if (erSkjaering) {
        for (const s of samletPerSide(liste, sett, inn)) {
          seksjon.oversiktFigurer.push(nyFigur(skisseFigur(tegnStereonett(R, RF, { sett: s.sprekker, flate: s.flate, analyse: s.analyse, medForklaring: true, tittel: `Samlet – ${s.side.toLowerCase()} side`, bredde: 340 }), 340),
            `Samlet stereonett (likeareal, nedre halvkule), ${s.side.toLowerCase()} side.`));
          if (s.analyse) {
            seksjon.oversiktTekst.push(`Kinematisk feltindikator, ${s.side.toLowerCase()} side (φ = ${s.analyse.phi}°, ±${s.analyse.lat}°): `
              + kinematikkTekst(s.analyse).map((l) => l.full).join('; ') + '.');
          }
        }
        if (seksjon.oversiktTekst.length) seksjon.oversiktTekst.push(ANSVARSTEKST);
      }
      if (ps.type === 'tunnel-tverrsnitt' && skisser.includes('tunnel-tverrsnitt')) {
        seksjon.oversiktFigurer.push(nyFigur(skisseFigur(tegnTunnel(R, RF, { oversikt: posisjonsOversikt(liste), soner: ps.soner, bredde: 300 }), 300),
          'Tverrsnitt med antall observasjoner per posisjon, farget etter verste alvorlighet.'));
      }
      if (ps.type === 'pahugg-front' && skisser.includes('pahugg-front')) {
        seksjon.oversiktFigurer.push(nyFigur(skisseFigur(tegnPahuggFront(R, RF, { oversikt: posisjonsOversikt(liste), soner: ps.soner, bredde: 300 }), 300),
          'Påhuggsflaten sett forfra med antall observasjoner per posisjon, farget etter verste alvorlighet.'));
      }
      if (skisser.includes('pahugg-lengdesnitt')) {
        const d = pahuggData(liste, malinger);
        if (harLengdesnittData(d)) {
          seksjon.oversiktFigurer.push(nyFigur(skisseFigur(tegnPahuggLengdesnitt(R, RF, { data: d, bredde: 480 }), 480),
            'Skjematisk lengdesnitt ved påhugget med bergoverdekning, løsmassetykkelse, spiling og buer fra registrerte målinger.'));
        }
      }
    }
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
      const skisseFigurer = [];
      let kinematikk = [];
      if (medSkisser) {
        const prof = profilTekst(o.profilFra, o.profilTil);
        const g = o.geometri || {};
        if (ps.type === 'skjaering-snitt' && ['hoyde', 'helning', 'groftbredde', 'losmasse'].some((k) => g[k] !== null && g[k] !== undefined && g[k] !== '')) {
          const side = (o.sted && o.sted.side) || 'Høyre';
          skisseFigurer.push(nyFigur(skisseFigur(tegnSkjaeringSnitt(R, RF, { geometri: g, side, valgte: o.posisjon || [], soner: ps.soner, bredde: 340 }), 340),
            `Skjæringssnitt, ${prof.toLowerCase()}, ${side.toLowerCase()} side${o.posisjon && o.posisjon.length ? ' – ' + o.posisjon.join(', ').toLowerCase() : ''}.`));
        } else if (medPosisjon && o.posisjon && o.posisjon.length && (ps.type === 'tunnel-tverrsnitt' || ps.type === 'pahugg-front')) {
          const tegn = ps.type === 'tunnel-tverrsnitt' ? tegnTunnel : tegnPahuggFront;
          skisseFigurer.push(nyFigur(skisseFigur(tegn(R, RF, { valgte: o.posisjon, soner: ps.soner, bredde: 300 }), 260),
            `Posisjon, ${prof.toLowerCase()} – ${o.posisjon.join(', ').toLowerCase()}.`));
        }
        const an = analyseForObs(o, sett[o.id], inn, erSkjaering);
        if (an.sprekker.length || an.flate) {
          skisseFigurer.push(nyFigur(skisseFigur(tegnStereonett(R, RF, { sett: an.sprekker, flate: an.flate, analyse: an.analyse, medForklaring: true, bredde: 300 }), 300),
            `Stereonett (likeareal, nedre halvkule), observasjon ${obsNr(o.lopenr)}.`));
        }
        if (an.analyse) kinematikk = [...kinematikkTekst(an.analyse).map((l) => l.full), `φ = ${an.analyse.phi}°, sideavgrensning ±${an.analyse.lat}°. ${ANSVARSTEKST}`];
        if (skisser.includes('pahugg-lengdesnitt')) {
          const d = pahuggData([o], { [o.id]: malinger[o.id] || [] });
          if (harLengdesnittData(d)) {
            skisseFigurer.push(nyFigur(skisseFigur(tegnPahuggLengdesnitt(R, RF, { data: d, bredde: 420 }), 420),
              `Skjematisk lengdesnitt, observasjon ${obsNr(o.lopenr)}.`));
          }
        }
      }
      const figurer = (fotos[o.id] || []).map((f) => {
        const nr = ++figNr;
        figurFor[f.id] = nr;
        const sted = f.sted || stedForFoto(o);
        return { nr, foto: f, tekst: `Figur ${nr}: ${sted}${f.kommentar ? ' – ' + f.kommentar : ''}` };
      });
      seksjon.observasjoner.push({
        o, t, overskrift: obsOverskrift(o, t), felter, tekst: o.tekst || '', geometri, malinger: mal, sett: settRader,
        skisser: skisseFigurer, kinematikk,
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

/** Bilde eller skisse → { blob, bredde, hoyde, type } klar for Word/PDF. */
export async function figurBilde(fig, bildeMaks) {
  if (fig.svg) {
    const { svgTilPng } = await import('../skisser/svg.js');
    const blob = await svgTilPng(fig.svg, fig.bredde, fig.hoyde, 3);
    return { blob, bredde: fig.bredde, hoyde: fig.hoyde, type: 'png', maksBredde: fig.maksBredde };
  }
  const b = await bildeForRapport(fig.foto.blob, bildeMaks);
  return { ...b, type: 'jpg', maksBredde: null };
}

/** Bildestørrelse i notatet: tilpasset sidebredden, men ikke for høye stående bilder. */
export function figurMal(bredde, hoyde, maksB, maksH) {
  const s = Math.min(maksB / bredde, maksH / hoyde);
  return { b: Math.round(bredde * s), h: Math.round(hoyde * s) };
}
