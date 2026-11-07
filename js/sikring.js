// Sikringssymboler på bilder: tegneregler og opptelling av mengder.
// Hver figur lagrer sine egne opplysninger (lengde, dimensjon, form), slik at gamle tegninger
// fortsatt vises riktig selv om symbollisten endres senere.
import { fmtNum } from './util.js';

export const FORMER = ['ring', 'trekant', 'firkant', 'femkant', 'stjerne', 'sirkelkryss'];
export const SYMBOLSTORRELSER = [['Liten', 0.7], ['Middels', 1], ['Stor', 1.45]];

const ROD = '#ff0000';
const HVIT = '#ffffff';
export const POLYGONSTIL = {
  gul: { strek: '#ffff00', fyll: 'none', fyllOpasitet: 0 },
  bla: { strek: '#0070c0', fyll: '#00abbd', fyllOpasitet: 0.3 },
};

export const boltNavn = (b) => `${fmtNum(b.lengde)} m Ø${b.dim}`;

/** Bredden på et symbol i bildepunkter. */
export const symbolBredde = (W, H, skala = 1) => Math.max(W, H) * 0.035 * (skala || 1);

/** Lager en figur av et valg i symbolpaletten. */
export function nySymbolfigur(sym, x, y) {
  if (sym.lengde !== undefined) {
    return { type: 'symbol', art: 'bolt', symbolId: sym.id, navn: boltNavn(sym), lengde: sym.lengde, dim: sym.dim, form: sym.form, prikker: sym.prikker, x, y };
  }
  return { type: 'symbol', art: sym.id, symbolId: sym.id, navn: sym.navn, form: sym.form, prikker: '0', x, y };
}

/** Hjørner i en regulær mangekant rundt (cx, cy), med første hjørne rett opp. */
function mangekant(cx, cy, r, n, start = -Math.PI / 2) {
  const ut = [];
  for (let i = 0; i < n; i++) {
    const v = start + (i * 2 * Math.PI) / n;
    ut.push([cx + r * Math.cos(v), cy + r * Math.sin(v)]);
  }
  return ut;
}
const tilPunkter = (p) => p.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');

function kryssPunkter(cx, cy, r) {
  const a = r * 0.95; // armlengde
  const t = r * 0.3; // halv armbredde
  return [[-a, -a + t], [-a + t, -a], [0, -t], [a - t, -a], [a, -a + t], [t, 0], [a, a - t], [a - t, a], [0, t], [-a + t, a], [-a, a - t], [-t, 0]]
    .map((q) => [cx + q[0], cy + q[1]]);
}

/** Tegner ett symbol med sentrum i (cx, cy). d er symbolets bredde. */
export function symbolSvg(S, fg, cx, cy, d) {
  const r = d / 2;
  const sw = d * 0.11;
  const stil = { fill: HVIT, stroke: ROD, 'stroke-width': sw, 'stroke-linejoin': 'round' };
  const deler = [];
  let bunn = cy + r;
  let prikkY = cy;
  if (fg.form === 'ring') {
    deler.push(S('circle', { cx, cy, r: r * 0.9, ...stil }));
  } else if (fg.form === 'trekant') {
    bunn = cy + r * 0.75;
    prikkY = cy + r * 0.28;
    deler.push(S('polygon', { points: tilPunkter([[cx, cy - r * 0.98], [cx + r * 1.08, bunn], [cx - r * 1.08, bunn]]), ...stil }));
  } else if (fg.form === 'firkant') {
    bunn = cy + r * 0.85;
    deler.push(S('rect', { x: cx - r * 0.85, y: cy - r * 0.85, width: r * 1.7, height: r * 1.7, ...stil }));
  } else if (fg.form === 'femkant') {
    bunn = cy + r * 0.85;
    deler.push(S('polygon', { points: tilPunkter(mangekant(cx, cy, r * 1.05, 5)), ...stil }));
  } else if (fg.form === 'stjerne') {
    bunn = cy + r;
    const tynn = { ...stil, 'stroke-width': sw * 0.65 };
    deler.push(S('polygon', { points: tilPunkter(mangekant(cx, cy, r, 3)), ...tynn }));
    deler.push(S('polygon', { points: tilPunkter(mangekant(cx, cy, r, 3, Math.PI / 2)), ...tynn, fill: 'none' }));
  } else if (fg.form === 'sirkelkryss') {
    const k = r * 0.9;
    const dg = k * Math.SQRT1_2;
    deler.push(S('circle', { cx, cy, r: k, ...stil }));
    deler.push(S('line', { x1: cx - dg, y1: cy - dg, x2: cx + dg, y2: cy + dg, stroke: ROD, 'stroke-width': sw * 0.75 }));
    deler.push(S('line', { x1: cx - dg, y1: cy + dg, x2: cx + dg, y2: cy - dg, stroke: ROD, 'stroke-width': sw * 0.75 }));
  } else if (fg.form === 'kryss') {
    deler.push(S('polygon', { points: tilPunkter(kryssPunkter(cx, cy, r)), ...stil, 'stroke-width': sw * 0.7 }));
  } else {
    deler.push(S('circle', { cx, cy, r: r * 0.9, ...stil }));
  }
  const n = Number(fg.prikker) || 0;
  const pr = r * 0.27;
  if (n === 1) {
    deler.push(S('circle', { cx, cy: prikkY, r: pr * 1.15, fill: ROD }));
  } else if (n > 1) {
    const y = bunn + sw * 0.5 + pr * 1.35;
    const avstand = pr * 2.5;
    for (let i = 0; i < n; i++) deler.push(S('circle', { cx: cx + (i - (n - 1) / 2) * avstand, cy: y, r: pr, fill: ROD }));
  }
  return S('g', null, deler);
}

/** Polygon for område. Under tegning (utkast) er den åpen, og hjørnene vises. */
export function polygonSvg(S, fg, sw, utkast = false) {
  const pkt = fg.punkter || [];
  if (!pkt.length) return null;
  const stil = POLYGONSTIL[fg.stil] || POLYGONSTIL.gul;
  const points = tilPunkter(pkt);
  if (utkast) {
    return S('g', null,
      S('polyline', { points, fill: 'none', stroke: '#000000', 'stroke-width': sw + 3, 'stroke-opacity': 0.45, 'stroke-linejoin': 'round' }),
      S('polyline', { points, fill: 'none', stroke: stil.strek, 'stroke-width': sw, 'stroke-linejoin': 'round' }),
      pkt.map((q) => S('circle', { cx: q[0], cy: q[1], r: sw * 1.8, fill: stil.strek, stroke: '#000000', 'stroke-width': sw * 0.3 })));
  }
  return S('polygon', {
    points, fill: stil.fyll, 'fill-opacity': stil.fyll === 'none' ? undefined : stil.fyllOpasitet,
    stroke: stil.strek, 'stroke-width': sw, 'stroke-linejoin': 'round',
  });
}

/** Teller opp sikringen på ett bilde. */
export function mengder(tegning) {
  const bolter = new Map();
  const annen = new Map();
  for (const f of (tegning && tegning.figurer) || []) {
    if (f.type === 'symbol' && f.art === 'bolt') {
      const k = f.lengde + '|' + f.dim;
      if (!bolter.has(k)) bolter.set(k, { navn: f.navn, lengde: f.lengde, dim: f.dim, form: f.form, prikker: f.prikker, antall: 0 });
      bolter.get(k).antall += 1;
    } else if (f.type === 'symbol') {
      if (!annen.has(f.art)) annen.set(f.art, { art: f.art, navn: f.navn, form: f.form, antall: 0 });
      annen.get(f.art).antall += 1;
    } else if (f.type === 'polygon') {
      if (!annen.has(f.art)) annen.set(f.art, { art: f.art, navn: f.navn, stil: f.stil, beskrivelse: f.beskrivelse || null, medAreal: !!f.medAreal, polygoner: 0, areal: 0, utenAreal: 0 });
      const a = annen.get(f.art);
      a.polygoner += 1;
      if (f.medAreal) {
        if (typeof f.areal === 'number') a.areal += f.areal;
        else a.utenAreal += 1;
      }
    }
  }
  return {
    bolter: [...bolter.values()].sort((a, b) => a.lengde - b.lengde || a.dim - b.dim),
    annen: [...annen.values()].sort((a, b) => a.art.localeCompare(b.art)),
  };
}

/** Mengde for en «annen sikring»-linje, f.eks. «1», «3 m²» eller «mangler areal». */
export function annenMengde(a) {
  if (a.antall !== undefined) return String(a.antall);
  if (!a.medAreal) return '';
  if (a.utenAreal) return a.areal ? `${fmtNum(a.areal, 1)} m² + ${a.utenAreal} uten areal` : 'mangler areal';
  return `${fmtNum(a.areal, 1)} m²`;
}

/** Kort tekst til bildevisning og rapporter. Tom tekst når bildet ikke har sikring. */
export function mengdeTekst(tegning) {
  const { bolter, annen } = mengder(tegning);
  const deler = bolter.map((b) => `${b.navn}: ${b.antall} stk`);
  for (const a of annen) {
    const m = annenMengde(a);
    deler.push(m ? `${a.navn}: ${m}` : a.navn);
  }
  return deler.join(' · ');
}
