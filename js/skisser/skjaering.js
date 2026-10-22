// Skjæring: tverrsnitt tegnet ut fra skjæringsgeometrien (trykk velger posisjon), og fasadeskisse langs profilen.
import { sone, poly, finSteg, alvFarge } from './svg.js';
import { fmtNum, obsNr } from '../util.js';

export const SKJAERING_SONER = {
  terreng: 'Terreng/bakkant', losmasseskraning: 'Løsmasseskråning', overgang: 'Overgang løsmasse/berg',
  ovre: 'Skjæringsflate øvre del', nedre: 'Skjæringsflate nedre del', pallkant: 'Pallkant/hylle',
  fot: 'Skjæringsfot', groft: 'Grøft/fanggrøft',
};

// Korte etiketter i snittet (fullt navn står i knappene under skissen)
const KORT = {
  terreng: 'Terreng/ bakkant', losmasseskraning: 'Løsmasse- skråning', overgang: 'Overgang', ovre: 'Øvre del',
  nedre: 'Nedre del', pallkant: 'Pall/hylle', fot: 'Fot', groft: 'Grøft',
};

// Høyde i skjæringen (andel av bergskjæringens høyde) for hver posisjon – brukes i fasaden.
const HOYDE_ANDEL = {
  terreng: [1.12, 1.26], losmasseskraning: [1.0, 1.14], overgang: [0.93, 1.04], ovre: [0.5, 0.93],
  nedre: [0.1, 0.5], pallkant: [0.44, 0.56], fot: [0, 0.12], groft: [-0.12, 0],
};

const tall = (v, std) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? std : Number(v));

/** Geometri med standardverdier der noe mangler. */
export function skjaeringGeometri(g = {}) {
  const mangler = ['hoyde', 'helning'].filter((k) => g[k] === null || g[k] === undefined || g[k] === '');
  return {
    H: Math.max(1, tall(g.hoyde, 10)),
    a: Math.min(90, Math.max(20, tall(g.helning, 80))),
    nivaer: Math.max(1, Math.round(tall(g.antallPaller, 1))),
    B: Math.max(0.5, tall(g.pallbredde, 3)),
    G: Math.max(0.5, tall(g.groftbredde, 3)),
    L: Math.max(0, tall(g.losmasse, 1.5)),
    mangler,
    oppgitt: g,
  };
}

/** Lager et bånd (polygon) rundt en polylinje med tykkelse t px. */
function band(pkt, t) {
  if (pkt.length < 2) {
    const [x, y] = pkt[0];
    return poly([[x - t, y - t], [x + t, y - t], [x + t, y + t], [x - t, y + t]]);
  }
  const venstre = [];
  const hoyre = [];
  for (let i = 0; i < pkt.length; i++) {
    const a = pkt[Math.max(0, i - 1)];
    const b = pkt[Math.min(pkt.length - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    venstre.push([pkt[i][0] - dy * t, pkt[i][1] + dx * t]);
    hoyre.push([pkt[i][0] + dy * t, pkt[i][1] - dx * t]);
  }
  return poly([...venstre, ...hoyre.reverse()]);
}

/** Klipper stigende segmenter til høydeintervallet [y0, y1] (meter). */
function klipp(segmenter, y0, y1) {
  const ut = [];
  for (const [p, q] of segmenter) {
    const lo = Math.max(y0, p[1]);
    const hi = Math.min(y1, q[1]);
    if (hi - lo <= 1e-6) continue;
    const t = (y) => [p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]), y];
    ut.push([t(lo), t(hi)]);
  }
  return ut;
}

/**
 * Tverrsnitt. side 'Høyre' tegnes med vegen til venstre og skjæringen til høyre; 'Venstre' speilvendes.
 */
export function tegnSkjaeringSnitt(S, f, { geometri, side = 'Høyre', valgte = [], onVelg = null, soner = SKJAERING_SONER, visMal = true, bredde = 340 }) {
  const n = { ...SKJAERING_SONER, ...(soner || {}) };
  const g = skjaeringGeometri(geometri);
  const W = 340;
  const HPX = 300;
  const speil = side === 'Venstre';

  // --- geometri i meter (vegbane y = 0, grøftebunn y = -1) ---
  const vei = 5;
  const fot = [vei + g.G, -1];
  const flate = []; // stigende segmenter
  const hyller = [];
  let p = fot;
  const h = g.H / g.nivaer;
  for (let i = 0; i < g.nivaer; i++) {
    const q = [p[0] + h / Math.tan((g.a * Math.PI) / 180), p[1] + h];
    flate.push([p, q]);
    p = q;
    if (i < g.nivaer - 1) {
      const r = [p[0] + g.B, p[1]];
      hyller.push([p, r]);
      p = r;
    }
  }
  const bergTopp = p;
  const bakkant = [bergTopp[0] + 1.5 * g.L, bergTopp[1] + g.L];
  const xmax = bakkant[0] + 5;
  const ymax = bakkant[1] + 0.4;
  const ymin = -3;
  // Loddrett: riktig målestokk. Vannrett: skjæringsflaten i samme målestokk (riktig helning),
  // mens veg, grøft, hyller og løsmasser får en minstebredde så trykkflatene blir store nok.
  const s = Math.min((HPX - 64) / (ymax - ymin), (W - 200) / Math.max(1, bergTopp[0] - fot[0]));
  const bruddM = [0, vei, fot[0]];
  const bruddPx = [0, 64, 64 + Math.max(g.G * s, 46)];
  for (let i = 0; i < flate.length; i++) {
    const [a, b] = flate[i];
    bruddM.push(b[0]);
    bruddPx.push(bruddPx[bruddPx.length - 1] + (b[0] - a[0]) * s);
    if (hyller[i]) {
      bruddM.push(hyller[i][1][0]);
      bruddPx.push(bruddPx[bruddPx.length - 1] + Math.max(g.B * s, 30));
    }
  }
  bruddM.push(bakkant[0], xmax);
  bruddPx.push(bruddPx[bruddPx.length - 1] + Math.max(1.5 * g.L * s, 42), bruddPx[bruddPx.length - 1] + Math.max(1.5 * g.L * s, 42) + 56);
  const totalPx = bruddPx[bruddPx.length - 1];
  const ml = Math.max(8, (W - totalPx) / 2);
  const xPx = (xm) => {
    for (let i = 1; i < bruddM.length; i++) {
      if (xm <= bruddM[i] + 1e-9 || i === bruddM.length - 1) {
        const t = bruddM[i] === bruddM[i - 1] ? 0 : (xm - bruddM[i - 1]) / (bruddM[i] - bruddM[i - 1]);
        return bruddPx[i - 1] + t * (bruddPx[i] - bruddPx[i - 1]);
      }
    }
    return 0;
  };
  const X = (x) => (speil ? W - (ml + xPx(x)) : ml + xPx(x));
  const Y = (y) => 26 + (ymax - y) * s;
  const P = (pt) => [X(pt[0]), Y(pt[1])];

  const terrengLinje = [[0, 0], [vei, 0], [vei + g.G * 0.4, -1], fot, ...flate.flatMap(([a, b], i) => (hyller[i] ? [b, hyller[i][1]] : [b])), bakkant, [xmax, ymax - 0.1]];
  const berg = [[0, ymin], [xmax, ymin], [xmax, bergTopp[1]], bergTopp, ...[...flate.flatMap(([a, b], i) => (hyller[i] ? [b, hyller[i][1]] : [b]))].reverse().slice(1), fot, [vei + g.G * 0.4, -1], [vei, 0], [0, 0]];
  const losmasse = [bergTopp, bakkant, [xmax, ymax - 0.1], [xmax, bergTopp[1]]];

  const z = (key, d, tx, ty, liten = true) => sone(S, f, {
    d, navn: n[key], valgt: valgte.includes(n[key]), onVelg, tekstX: tx, tekstY: ty, liten, maks: 11,
    tekst: n[key] === SKJAERING_SONER[key] ? KORT[key] : n[key],
  });
  const T = 20;
  const ym = fot[1] + g.H / 2;
  const fotH = fot[1] + Math.max(0.12 * g.H, 0.8);
  const ovreTopp = bergTopp[1] - Math.max(0.07 * g.H, 0.5);
  const linjer = (segs) => segs.map(([a, b]) => band([P(a), P(b)], T)).join('');
  const midt = (segs) => {
    if (!segs.length) return [0, 0];
    const [a, b] = segs[Math.floor(segs.length / 2)];
    return P([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  };
  const nedre = klipp(flate, fotH, ym);
  const ovre = klipp(flate, ym, ovreTopp);
  const [nx, ny] = midt(nedre);
  const [ox, oy] = midt(ovre);
  const forskyv = speil ? -1 : 1; // etikett utenfor skjæringen, mot vegsiden
  const [fx, fy] = P(fot);
  const [bx, by] = P(bergTopp);
  const [kx, ky] = P(bakkant);
  const groftPkt = [[vei, 0], [vei + g.G * 0.4, -1], [fot[0] - 0.3, -1]].map(P);

  const mal = [];
  if (visMal) {
    const o = g.oppgitt || {};
    // høyde
    const hx = fx - forskyv * 30;
    mal.push(S('line', { x1: hx, y1: fy, x2: hx, y2: by, stroke: f.tekst, 'stroke-width': 1, 'marker-start': null }));
    mal.push(S('line', { x1: hx - 4, y1: fy, x2: hx + 4, y2: fy, stroke: f.tekst }));
    mal.push(S('line', { x1: hx - 4, y1: by, x2: hx + 4, y2: by, stroke: f.tekst }));
    mal.push(S('text', { x: hx - forskyv * 4, y: (fy + by) / 2, 'text-anchor': speil ? 'start' : 'end', 'font-size': 11, 'font-weight': 600, fill: f.tekst, stroke: f.luft, 'stroke-width': 3, 'paint-order': 'stroke' },
      `H ${o.hoyde !== undefined && o.hoyde !== null ? fmtNum(o.hoyde, 1) + ' m' : '?'}`));
    mal.push(S('text', { x: fx + forskyv * 10, y: fy - 22, 'text-anchor': speil ? 'end' : 'start', 'font-size': 11, 'font-weight': 600, fill: f.tekst, stroke: f.luft, 'stroke-width': 3, 'paint-order': 'stroke' },
      o.helning !== undefined && o.helning !== null ? `${fmtNum(o.helning, 0)}°` : '?°'));
    const [g1x] = P([vei, 0]);
    mal.push(S('line', { x1: g1x, y1: fy + 16, x2: fx, y2: fy + 16, stroke: f.tekst, 'stroke-width': 1 }));
    mal.push(S('text', { x: (g1x + fx) / 2, y: fy + 28, 'text-anchor': 'middle', 'font-size': 10.5, fill: f.tekst, stroke: f.luft, 'stroke-width': 3, 'paint-order': 'stroke' },
      `grøft ${o.groftbredde !== undefined && o.groftbredde !== null ? fmtNum(o.groftbredde, 1) + ' m' : '?'}`));
    if (o.losmasse !== undefined && o.losmasse !== null) {
      mal.push(S('text', { x: (bx + kx) / 2 - forskyv * 10, y: (by + ky) / 2 - 8, 'text-anchor': speil ? 'start' : 'end', 'font-size': 10.5, fill: f.tekst, stroke: f.luft, 'stroke-width': 3, 'paint-order': 'stroke' }, `løsmasse ${fmtNum(o.losmasse, 1)} m`));
    }
    if (g.mangler.length) {
      mal.push(S('text', { x: W / 2, y: HPX - 6, 'text-anchor': 'middle', 'font-size': 10, fill: f.tekst2 }, 'Mål mangler – skissen bruker standardverdier'));
    }
  }

  return S('svg', { viewBox: `0 0 ${W} ${HPX}`, width: bredde, height: (bredde * HPX) / W, class: 'skisse', 'font-family': f.font },
    S('rect', { x: 0, y: 0, width: W, height: HPX, fill: f.luft }),
    S('path', { d: poly(berg.map(P)), fill: f.berg, stroke: f.bergKant, 'stroke-width': 1 }),
    S('path', { d: poly(losmasse.map(P)), fill: f.losmasse, stroke: f.bergKant, 'stroke-width': 0.8 }),
    S('polyline', { points: terrengLinje.map(P).map((q) => q.join(',')).join(' '), fill: 'none', stroke: f.tekst, 'stroke-width': 2 }),
    S('line', { x1: X(0), y1: Y(0), x2: X(vei), y2: Y(0), stroke: f.vei, 'stroke-width': 5 }),
    S('text', { x: X(vei / 2), y: Y(0) + 16, 'text-anchor': 'middle', 'font-size': 10, fill: f.tekst2 }, 'veg'),
    S('text', { x: speil ? W - 8 : 8, y: 16, 'text-anchor': speil ? 'end' : 'start', 'font-size': 12, 'font-weight': 700, fill: f.tekst2 }, `${side} side`),
    z('groft', band(groftPkt, T), (groftPkt[0][0] + groftPkt[2][0]) / 2, groftPkt[0][1] - 24),
    z('fot', band([P([fot[0] - 0.6, -1]), P(fot), ...klipp(flate, fot[1], fotH).map(([, b]) => P(b))], T), fx + forskyv * 40, fy + 2),
    z('nedre', linjer(nedre), nx + forskyv * 52, ny + 4),
    hyller.length ? z('pallkant', hyller.map(([a, b]) => band([P(a), P(b)], T)).join(''), (P(hyller[0][0])[0] + P(hyller[0][1])[0]) / 2, P(hyller[0][0])[1] - 20) : null,
    z('ovre', linjer(ovre), ox + forskyv * 52, oy + 4),
    z('overgang', band([P(bergTopp)], 18), bx - forskyv * 34, by + 4),
    z('losmasseskraning', band([P(bergTopp), P(bakkant)], T), (bx + kx) / 2 + forskyv * 26, (by + ky) / 2 + 30),
    z('terreng', band([P(bakkant), P([xmax, ymax - 0.1])], T), (kx + X(xmax)) / 2 + forskyv * 6, ky - 4),
    mal,
  );
}

/** Fasadeskisse: skjæringen sett forfra, profil på x-aksen og høyde på y-aksen. */
export function tegnSkjaeringFasade(S, f, { obs, side, soner = SKJAERING_SONER, bredde = 340, onVelg = null }) {
  const n = { ...SKJAERING_SONER, ...(soner || {}) };
  const andelFor = {};
  for (const [k, v] of Object.entries(n)) andelFor[v] = HOYDE_ANDEL[k];
  const W = 340;
  const HPX = 210;
  const ml = 34;
  const mr = 10;
  const mt = 24;
  const mb = 42;
  const med = obs.filter((o) => o.profilFra !== null && o.profilFra !== undefined || o.profilTil !== null && o.profilTil !== undefined);
  if (!med.length) {
    return S('svg', { viewBox: `0 0 ${W} 60`, width: bredde, height: (bredde * 60) / W, class: 'skisse', 'font-family': f.font },
      S('text', { x: W / 2, y: 34, 'text-anchor': 'middle', 'font-size': 12, fill: f.tekst2 }, `${side} side: ingen observasjoner med profil`));
  }
  const spenn = med.map((o) => {
    const a = o.profilFra ?? o.profilTil;
    const b = o.profilTil ?? o.profilFra;
    return [Math.min(a, b), Math.max(a, b)];
  });
  let pmin = Math.min(...spenn.map((x) => x[0]));
  let pmax = Math.max(...spenn.map((x) => x[1]));
  if (pmax - pmin < 20) { pmin -= 10; pmax += 10; }
  const pad = (pmax - pmin) * 0.05;
  pmin -= pad;
  pmax += pad;
  // Høydeprofil: høyde fra geometrien der den finnes
  const hoyder = med.map((o, i) => ({ fra: spenn[i][0], til: spenn[i][1], H: o.geometri && o.geometri.hoyde ? Number(o.geometri.hoyde) : null, L: o.geometri && o.geometri.losmasse !== undefined && o.geometri.losmasse !== null ? Number(o.geometri.losmasse) : null }));
  const kjente = hoyder.filter((x) => x.H);
  const stdH = kjente.length ? kjente.reduce((s, x) => s + x.H, 0) / kjente.length : 10;
  const Hmaks = Math.max(stdH, ...kjente.map((x) => x.H)) * 1.3;
  const hoydeVed = (p) => {
    const treff = kjente.filter((x) => p >= x.fra - 0.01 && p <= x.til + 0.01);
    if (treff.length) return Math.max(...treff.map((x) => x.H));
    if (!kjente.length) return stdH;
    return kjente.reduce((best, x) => (Math.abs((x.fra + x.til) / 2 - p) < Math.abs((best.fra + best.til) / 2 - p) ? x : best)).H;
  };
  const X = (p) => ml + ((p - pmin) / (pmax - pmin)) * (W - ml - mr);
  const Y = (y) => HPX - mb - (y / Hmaks) * (HPX - mt - mb);
  const N = 60;
  const topp = [];
  for (let i = 0; i <= N; i++) {
    const p = pmin + ((pmax - pmin) * i) / N;
    topp.push([X(p), Y(hoydeVed(p))]);
  }
  const L = stdH * 0.12;
  const losTopp = topp.map(([x, y]) => [x, y - (L / Hmaks) * (HPX - mt - mb) - 3]);
  const steg = finSteg(pmax - pmin, 6);
  const merker = [];
  for (let v = Math.ceil(pmin / steg) * steg; v <= pmax; v += steg) merker.push(v);

  const sortert = med.map((o, i) => ({ o, fra: spenn[i][0], til: spenn[i][1] }))
    .sort((a, b) => b.til - b.fra - (a.til - a.fra));
  const bokser = sortert.map(({ o, fra, til }) => {
    const andeler = (o.posisjon || []).map((pnavn) => andelFor[pnavn]).filter(Boolean);
    const [a0, a1] = andeler.length ? [Math.min(...andeler.map((a) => a[0])), Math.max(...andeler.map((a) => a[1]))] : [0, 1];
    const Hh = hoydeVed((fra + til) / 2);
    let x1 = X(fra);
    let x2 = X(til);
    if (x2 - x1 < 14) { const m = (x1 + x2) / 2; x1 = m - 7; x2 = m + 7; }
    const y1 = Y(a1 * Hh);
    const y2 = Y(a0 * Hh);
    const farge = alvFarge(f, o.alvorlighet);
    const trykk = onVelg ? { onClick: () => onVelg(o.id), style: 'cursor:pointer', role: 'button', 'aria-label': 'Observasjon ' + obsNr(o.lopenr) } : {};
    return S('g', trykk,
      S('rect', { x: x1, y: Math.min(y1, y2), width: x2 - x1, height: Math.max(Math.abs(y2 - y1), 10), rx: 3, fill: farge, 'fill-opacity': 0.55, stroke: farge, 'stroke-width': 2 }),
      S('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 + 4, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: f.tekst }, obsNr(o.lopenr)),
    );
  });

  return S('svg', { viewBox: `0 0 ${W} ${HPX}`, width: bredde, height: (bredde * HPX) / W, class: 'skisse', 'font-family': f.font },
    S('rect', { x: 0, y: 0, width: W, height: HPX, fill: f.luft }),
    S('path', { d: poly([[ml, Y(0)], ...topp, [W - mr, Y(0)]]), fill: f.berg, stroke: f.bergKant }),
    S('path', { d: poly([...topp, ...losTopp.slice().reverse()]), fill: f.losmasse, stroke: f.bergKant, 'stroke-width': 0.6 }),
    S('line', { x1: ml, y1: Y(0), x2: W - mr, y2: Y(0), stroke: f.vei, 'stroke-width': 4 }),
    merker.map((v) => S('g', null,
      S('line', { x1: X(v), y1: HPX - 30, x2: X(v), y2: HPX - 26, stroke: f.tekst2 }),
      S('text', { x: X(v), y: HPX - 16, 'text-anchor': 'middle', 'font-size': 10, fill: f.tekst2 }, fmtNum(v, 1)),
    )),
    S('text', { x: W - mr, y: HPX - 4, 'text-anchor': 'end', 'font-size': 9.5, fill: f.tekst2 }, 'profil →'),
    S('text', { x: 4, y: Y(stdH) + 4, 'font-size': 9.5, fill: f.tekst2 }, `${fmtNum(stdH, 0)} m`),
    S('text', { x: ml, y: 15, 'font-size': 11.5, 'font-weight': 700, fill: f.tekst }, `Skjæring – ${side.toLowerCase()} side (oppriss)`),
    bokser,
  );
}
