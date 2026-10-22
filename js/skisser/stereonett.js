// Stereonett (likeareal, nedre halvkule) med enkel kinematisk analyse (Markland-test).
// Dette er en FELTINDIKATOR og erstatter ikke en fullstendig stabilitetsvurdering.
import { norm360 } from '../util.js';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export const SETT_FARGER = ['#1f6fd1', '#e8590c', '#2b9348', '#8e44ad', '#a0522d', '#d6336c', '#0f9fb5', '#a68a00'];

// ---------- Vektorgeometri (Øst, Nord, Opp) ----------
const linjeVektor = (trend, stup) => [Math.cos(stup * RAD) * Math.sin(trend * RAD), Math.cos(stup * RAD) * Math.cos(trend * RAD), -Math.sin(stup * RAD)];
function tilLinje(v) {
  let [x, y, z] = v;
  const l = Math.hypot(x, y, z) || 1;
  x /= l; y /= l; z /= l;
  if (z > 0) { x = -x; y = -y; z = -z; }
  return { trend: norm360(Math.atan2(x, y) * DEG), stup: Math.asin(Math.min(1, -z)) * DEG };
}
const kryss = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const pol = (p) => ({ trend: norm360(p.fallretning + 180), stup: 90 - p.fall });
const polVektor = (p) => linjeVektor(norm360(p.fallretning + 180), 90 - p.fall);
export const vinkelDiff = (a, b) => { const d = Math.abs(norm360(a) - norm360(b)) % 360; return d > 180 ? 360 - d : d; };

/** Skjæringslinje mellom to plan. */
export function skjaeringslinje(p1, p2) {
  const v = kryss(polVektor(p1), polVektor(p2));
  if (Math.hypot(...v) < 1e-6) return null; // parallelle plan
  return tilLinje(v);
}

/** Gjennomsnittlig plan (f.eks. skjæringsflaten for en hel side). */
export function middelPlan(plan) {
  if (!plan.length) return null;
  const s = [0, 0, 0];
  for (const p of plan) { const v = polVektor(p); s[0] += v[0]; s[1] += v[1]; s[2] += v[2]; }
  const l = tilLinje(s);
  return { fall: 90 - l.stup, fallretning: norm360(l.trend + 180) };
}

// ---------- Kinematisk analyse ----------
const status = (m) => (m > 0 ? 'rod' : m > -5 ? 'gul' : 'gronn');
const verst = (liste) => (liste.some((x) => x.status === 'rod') ? 'rod' : liste.some((x) => x.status === 'gul') ? 'gul' : 'gronn');

/**
 * sett: [{ navn, fall, fallretning }] (sprekker, uten skjæringsflaten)
 * flate: { fall, fallretning } (skjæringsflaten), phi: friksjonsvinkel, lat: sideavgrensning (±°)
 */
export function kinematikk(sett, flate, phi = 30, lat = 20) {
  const plan = [];
  const velting = [];
  const kile = [];
  if (!flate) return null;
  const af = flate.fall;
  const bf = flate.fallretning;
  for (const s of sett) {
    // Plan utglidning: faller ut av skjæringen (±lat), slakere enn skjæringen og brattere enn friksjonsvinkelen
    const mPlan = Math.min(lat - vinkelDiff(s.fallretning, bf), s.fall - phi, af - s.fall);
    plan.push({ navn: s.navn, status: status(mPlan) });
    // Utvelting (Goodman): faller inn i skjæringen (±lat) og fall > 90 − skjæringshelning + friksjonsvinkel
    const mVelt = Math.min(lat - vinkelDiff(s.fallretning, bf + 180), s.fall - (90 - af + phi));
    velting.push({ navn: s.navn, status: status(mVelt) });
  }
  for (let i = 0; i < sett.length; i++) {
    for (let j = i + 1; j < sett.length; j++) {
      const l = skjaeringslinje(sett[i], sett[j]);
      if (!l) continue;
      const d = vinkelDiff(l.trend, bf);
      let m = -999;
      if (d < 90) {
        const tilsynelatende = Math.atan(Math.tan(af * RAD) * Math.cos(d * RAD)) * DEG;
        m = Math.min(l.stup - phi, tilsynelatende - l.stup, 90 - d);
      }
      kile.push({ navn: `${sett[i].navn} × ${sett[j].navn}`, status: status(m), linje: l });
    }
  }
  return {
    plan: { status: verst(plan), kandidater: plan },
    kile: { status: verst(kile), kandidater: kile },
    velting: { status: verst(velting), kandidater: velting },
    phi, lat, flate,
  };
}

/** Trafikklys-oppsummering, f.eks. «Kileutglidning: mulig (J1 × J3)». */
export function kinematikkTekst(a) {
  if (!a) return [];
  const linje = (navn, r) => {
    const rode = r.kandidater.filter((k) => k.status === 'rod').map((k) => k.navn);
    const gule = r.kandidater.filter((k) => k.status === 'gul').map((k) => k.navn);
    let tekst = 'ikke indikert';
    if (rode.length) tekst = `mulig (${rode.join(', ')})`;
    else if (gule.length) tekst = `marginal (${gule.join(', ')})`;
    return { mekanisme: navn, status: r.status, tekst, full: `${navn}: ${tekst}` };
  };
  return [linje('Plan utglidning', a.plan), linje('Kileutglidning', a.kile), linje('Utvelting', a.velting)];
}

export const ANSVARSTEKST = 'Kinematisk feltindikator – erstatter ikke en fullstendig stabilitetsvurdering.';

// ---------- Tegning ----------
export function tegnStereonett(S, f, { sett = [], flate = null, analyse = null, vis = 'alle', bredde = 300, tittel = null, medForklaring = false }) {
  const W = 300;
  const R = 118;
  const cx = W / 2;
  const cy = (tittel ? 22 : 8) + R + 10;
  const P = (trend, stup) => {
    const r = R * Math.SQRT2 * Math.sin(((90 - stup) / 2) * RAD);
    return [cx + r * Math.sin(trend * RAD), cy - r * Math.cos(trend * RAD)];
  };
  const sti = (pkt, lukk = false) => (pkt.length ? 'M' + pkt.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L') + (lukk ? 'Z' : '') : '');
  const storsirkel = (p) => {
    const s = linjeVektor(norm360(p.fallretning - 90), 0);
    const d = linjeVektor(p.fallretning, p.fall);
    const pkt = [];
    for (let a = 0; a <= 180; a += 3) {
      const v = [Math.cos(a * RAD) * s[0] + Math.sin(a * RAD) * d[0], Math.cos(a * RAD) * s[1] + Math.sin(a * RAD) * d[1], Math.cos(a * RAD) * s[2] + Math.sin(a * RAD) * d[2]];
      const l = tilLinje(v);
      pkt.push(P(l.trend, l.stup));
    }
    return sti(pkt);
  };
  const farge = {};
  let fi = 0;
  for (const s of sett) if (!(s.navn in farge)) farge[s.navn] = SETT_FARGER[fi++ % SETT_FARGER.length];

  const lag = [];
  lag.push(S('circle', { cx, cy, r: R, fill: f.bg, stroke: f.tekst, 'stroke-width': 1.5 }));
  lag.push(S('line', { x1: cx - 5, y1: cy, x2: cx + 5, y2: cy, stroke: f.tekst2 }));
  lag.push(S('line', { x1: cx, y1: cy - 5, x2: cx, y2: cy + 5, stroke: f.tekst2 }));
  for (let t = 0; t < 360; t += 10) {
    const [x1, y1] = P(t, 0);
    const [x2, y2] = P(t, t % 90 === 0 ? 6 : 3);
    lag.push(S('line', { x1, y1, x2, y2, stroke: f.tekst2, 'stroke-width': 0.8 }));
  }
  lag.push(S('text', { x: cx, y: cy - R - 4, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: f.tekst }, 'N'));

  // Kritiske soner
  if (flate && analyse) {
    const { phi, lat } = analyse;
    const af = flate.fall;
    const bf = flate.fallretning;
    if ((vis === 'alle' || vis === 'plan') && af > phi) {
      // poler til plan som kan gli: trend bf+180 ±lat, stup 90−af … 90−φ
      const ut = [];
      for (let t = -lat; t <= lat; t += 2) ut.push(P(bf + 180 + t, 90 - af));
      for (let t = lat; t >= -lat; t -= 2) ut.push(P(bf + 180 + t, 90 - phi));
      lag.push(S('path', { d: sti(ut, true), fill: f.rod, 'fill-opacity': 0.2, stroke: f.rod, 'stroke-width': 1 }));
    }
    if ((vis === 'alle' || vis === 'velting') && af - phi > 0) {
      // poler til plan som kan velte: trend bf ±lat, stup 0 … af−φ
      const ut = [];
      for (let t = -lat; t <= lat; t += 2) ut.push(P(bf + t, 0));
      for (let t = lat; t >= -lat; t -= 2) ut.push(P(bf + t, af - phi));
      lag.push(S('path', { d: sti(ut, true), fill: f.primar, 'fill-opacity': 0.18, stroke: f.primar, 'stroke-width': 1 }));
    }
    if (vis === 'alle' || vis === 'kile') {
      // skjæringslinjer som kan gi kile: mellom friksjonssirkelen og skjæringsflaten
      const ytre = [];
      const indre = [];
      for (let d = -89; d <= 89; d += 1) {
        const app = Math.atan(Math.tan(af * RAD) * Math.cos(d * RAD)) * DEG;
        if (app > phi) { ytre.push(P(bf + d, phi)); indre.push(P(bf + d, app)); }
      }
      if (ytre.length) lag.push(S('path', { d: sti([...ytre, ...indre.reverse()], true), fill: f.gul, 'fill-opacity': 0.25, stroke: f.gul, 'stroke-width': 1 }));
      const friksjon = [];
      for (let t = 0; t <= 360; t += 4) friksjon.push(P(t, phi));
      lag.push(S('path', { d: sti(friksjon, true), fill: 'none', stroke: f.tekst2, 'stroke-dasharray': '4 3', 'stroke-width': 1 }));
    }
  }
  // Skjæringsflaten
  if (flate) {
    lag.push(S('path', { d: storsirkel(flate), fill: 'none', stroke: f.tekst, 'stroke-width': 2.6, 'stroke-dasharray': '7 4' }));
    const [px, py] = P(flate.fallretning, flate.fall);
    lag.push(S('text', { x: px, y: py - 7, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: f.tekst, stroke: f.bg, 'stroke-width': 3, 'paint-order': 'stroke' }, 'Skj.flate'));
  }
  // Sprekkesett: storsirkel + pol
  for (const s of sett) {
    lag.push(S('path', { d: storsirkel(s), fill: 'none', stroke: farge[s.navn], 'stroke-width': 1.8 }));
  }
  for (const s of sett) {
    const p = pol(s);
    const [x, y] = P(p.trend, p.stup);
    lag.push(S('circle', { cx: x, cy: y, r: 4.2, fill: farge[s.navn], stroke: f.bg, 'stroke-width': 1 }));
    lag.push(S('text', { x: x + 6, y: y - 5, 'font-size': 10.5, 'font-weight': 700, fill: farge[s.navn] }, s.navn));
  }
  // Skjæringslinjer (kiler)
  if (analyse && (vis === 'alle' || vis === 'kile')) {
    for (const k of analyse.kile.kandidater) {
      const [x, y] = P(k.linje.trend, k.linje.stup);
      const c = k.status === 'rod' ? f.rod : k.status === 'gul' ? f.gul : f.tekst2;
      lag.push(S('path', { d: `M${x},${y - 5}L${x + 5},${y}L${x},${y + 5}L${x - 5},${y}Z`, fill: c, stroke: f.bg, 'stroke-width': 0.8 }));
    }
  }

  let hoyde = cy + R + 14;
  const forklaring = [];
  if (medForklaring) {
    let y = hoyde;
    const navn = Object.keys(farge);
    navn.forEach((n, i) => {
      const x = 12 + (i % 4) * 72;
      if (i % 4 === 0 && i > 0) y += 16;
      forklaring.push(S('line', { x1: x, y1: y - 4, x2: x + 16, y2: y - 4, stroke: farge[n], 'stroke-width': 3 }));
      forklaring.push(S('text', { x: x + 20, y, 'font-size': 10.5, fill: f.tekst }, n));
    });
    if (navn.length) y += 18;
    if (analyse) {
      for (const l of kinematikkTekst(analyse)) {
        forklaring.push(S('circle', { cx: 18, cy: y - 4, r: 5, fill: f[l.status] }));
        forklaring.push(S('text', { x: 30, y, 'font-size': 10.5, fill: f.tekst }, l.full));
        y += 15;
      }
      forklaring.push(S('text', { x: 12, y: y + 2, 'font-size': 9.5, fill: f.tekst2 }, `φ = ${analyse.phi}°, sideavgrensning ±${analyse.lat}°.`));
      forklaring.push(S('text', { x: 12, y: y + 15, 'font-size': 9.5, fill: f.tekst2 }, 'Feltindikator – erstatter ikke en stabilitetsvurdering.'));
      y += 28;
    } else if (!flate) {
      forklaring.push(S('text', { x: 12, y, 'font-size': 9.5, fill: f.tekst2 }, 'Ingen skjæringsflate – kun plott av sprekkesett.'));
      y += 14;
    }
    hoyde = y + 4;
  }
  return S('svg', { viewBox: `0 0 ${W} ${hoyde}`, width: bredde, height: (bredde * hoyde) / W, class: 'skisse', 'font-family': f.font },
    S('rect', { x: 0, y: 0, width: W, height: hoyde, fill: f.bg }),
    tittel && S('text', { x: W / 2, y: 15, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: f.tekst }, tittel),
    lag,
    forklaring,
  );
}
