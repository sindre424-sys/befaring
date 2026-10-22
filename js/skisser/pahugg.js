// Tunnelpåhugg: frontskisse (trykk velger posisjon) og lengdesnitt med overdekning, spiling og buer.
import { sone, rekt, poly } from './svg.js';
import { fmtNum } from '../util.js';

export const PAHUGG_SONER = {
  terreng: 'Terreng over påhugg', heng: 'Heng over påhugg', vederlagV: 'Vederlag venstre',
  vederlagH: 'Vederlag høyre', front: 'Påhuggsflate/front', portal: 'Portal/forlengelse',
};

/** Frontskisse: påhuggsflaten sett forfra. */
export function tegnPahuggFront(S, f, { valgte = [], onVelg = null, soner = PAHUGG_SONER, oversikt = null, bredde = 300 }) {
  const n = { ...PAHUGG_SONER, ...(soner || {}) };
  const W = 300;
  const H = 250;
  const z = (navn, d, tx, ty, liten = true, maks = 11) => {
    const o = oversikt && oversikt[navn];
    return sone(S, f, { d, navn, valgt: !oversikt && valgte.includes(navn), onVelg, tekstX: tx, tekstY: ty, liten, maks,
      farge: o ? f[o.verst] || f.ingen : null, antall: o ? o.antall : null });
  };
  const terrengLinje = 'M0,30 Q60,14 120,22 T240,18 T300,26';
  const bergGrense = 'M0,70 Q70,56 150,64 T300,66';
  const apning = 'M112,226V160A38,38 0 0 1 188,160V226Z';
  const frontV = 'M6,64H40V172H104V222H6Z';
  const frontH = 'M294,64H260V172H196V222H294Z';
  return S('svg', { viewBox: `0 0 ${W} ${H}`, width: bredde, height: (bredde * H) / W, class: 'skisse', 'font-family': f.font },
    S('rect', { x: 0, y: 0, width: W, height: H, fill: f.luft }),
    S('path', { d: `${terrengLinje}V${H}H0Z`, fill: f.losmasse }),
    S('path', { d: `${bergGrense}V${H}H0Z`, fill: f.berg, stroke: f.bergKant }),
    S('path', { d: terrengLinje, fill: 'none', stroke: f.tekst, 'stroke-width': 2 }),
    // portal/forlengelse som ramme rundt åpningen
    S('path', { d: 'M100,226V158A50,50 0 0 1 200,158V226', fill: 'none', stroke: f.tekst2, 'stroke-width': 7, 'stroke-opacity': 0.5 }),
    S('path', { d: apning, fill: f.vei, 'fill-opacity': 0.85, stroke: f.tekst, 'stroke-width': 2.5 }),
    S('line', { x1: 0, y1: 226, x2: W, y2: 226, stroke: f.vei, 'stroke-width': 4 }),
    z(n.terreng, rekt(6, 6, 288, 52), 150, 38, false, 30),
    z(n.heng, 'M92,64H208V118A58,44 0 0 0 92,118Z', 150, 88, true, 16),
    z(n.vederlagV, rekt(42, 112, 62, 58), 73, 141),
    z(n.vederlagH, rekt(196, 112, 62, 58), 227, 141),
    z(n.front, frontV + frontH, 56, 196, true, 13),
    z(n.portal, apning, 150, 200, true, 9),
  );
}

const verdi = (malinger, ...navn) => {
  for (const m of malinger) {
    if (navn.some((x) => (m.type || '').toLowerCase() === x.toLowerCase()) && m.verdi !== null && m.verdi !== undefined) return Number(m.verdi);
  }
  return null;
};

/** Henter verdier til lengdesnittet fra målinger og status. */
export function pahuggData(obsListe, malingerFor) {
  const d = { bergoverdekning: null, losmasse: null, spilingslengde: null, antallSpiler: null, buesenteravstand: null, spiling: false, buer: false, profil: null };
  for (const o of obsListe) {
    const m = malingerFor[o.id] || [];
    d.bergoverdekning ??= verdi(m, 'Bergoverdekning', 'Overdekning');
    d.losmasse ??= verdi(m, 'Løsmassetykkelse', 'Løsmassetykkelse i topp');
    d.spilingslengde ??= verdi(m, 'Spilingslengde');
    d.antallSpiler ??= verdi(m, 'Antall spiler');
    d.buesenteravstand ??= verdi(m, 'Buesenteravstand');
    const st = (o.status || []).join(' ').toLowerCase();
    if (st.includes('spiling') || st.includes('forbolting')) d.spiling = true;
    if (st.includes('buer')) d.buer = true;
    if (d.profil === null && o.profilFra !== null && o.profilFra !== undefined) d.profil = o.profilFra;
  }
  if (d.spilingslengde) d.spiling = true;
  if (d.buesenteravstand) d.buer = true;
  return d;
}

export const harLengdesnittData = (d) => d.bergoverdekning !== null || d.losmasse !== null || d.spiling || d.buer;

/** Lengdesnitt: terreng, grense løsmasse/berg og tunnelens heng fra påhugget og innover. */
export function tegnPahuggLengdesnitt(S, f, { data, bredde = 340 }) {
  const W = 340;
  const H = 220;
  const lengde = 30; // meter vist inn i tunnelen
  const tunnelH = 7;
  const berg0 = data.bergoverdekning ?? 4;
  const los0 = data.losmasse ?? 2;
  const stigning = 0.35; // skjematisk: overdekningen øker innover
  const mx = 18;
  const ytop = berg0 + los0 + lengde * stigning + 2;
  const s = Math.min((W - mx * 2 - 72) / (lengde + 8), (H - 46) / (ytop + 2));
  const X = (x) => mx + 72 + x * s; // x = 0 ved påhugget
  const Y = (y) => H - 26 - (y + 2) * s; // y = 0 ved såle
  const heng = tunnelH;
  const bergFlate = (x) => heng + berg0 + Math.max(0, x) * stigning;
  const terreng = (x) => bergFlate(x) + los0 + Math.max(0, x) * 0.05;
  const pkt = (fn, x0, x1) => {
    const ut = [];
    for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 30) ut.push([X(x), Y(fn(x))]);
    return ut;
  };
  // foran påhugget: forskjæring ned mot vegen
  const forskjaering = [[X(-5), Y(0)], [X(-0.6), Y(heng + 0.4)], [X(0), Y(bergFlate(0))]];
  const bergPoly = [[X(0), Y(0)], [X(0), Y(bergFlate(0))], ...pkt(bergFlate, 0, lengde), [X(lengde), Y(0)]];
  const losPoly = [[X(-0.2), Y(bergFlate(0))], [X(0.6), Y(terreng(0))], ...pkt(terreng, 0.6, lengde), ...pkt(bergFlate, 0, lengde).reverse()];
  const ting = [];
  ting.push(S('rect', { x: 0, y: 0, width: W, height: H, fill: f.luft }));
  ting.push(S('path', { d: poly(losPoly), fill: f.losmasse, stroke: f.bergKant, 'stroke-width': 0.8 }));
  ting.push(S('path', { d: poly(bergPoly), fill: f.berg, stroke: f.bergKant }));
  ting.push(S('polyline', { points: forskjaering.map((q) => q.join(',')).join(' '), fill: 'none', stroke: f.tekst, 'stroke-width': 1.5 }));
  // tunnelen
  ting.push(S('rect', { x: X(0), y: Y(heng), width: X(lengde) - X(0), height: Y(0) - Y(heng), fill: f.luft, stroke: 'none' }));
  ting.push(S('line', { x1: X(0), y1: Y(heng), x2: X(lengde), y2: Y(heng), stroke: f.tekst, 'stroke-width': 2.5 }));
  ting.push(S('line', { x1: X(-6), y1: Y(0), x2: X(lengde), y2: Y(0), stroke: f.vei, 'stroke-width': 4 }));
  ting.push(S('text', { x: X(lengde * 0.85), y: Y(heng / 2) + 4, 'text-anchor': 'middle', 'font-size': 10.5, fill: f.tekst2 }, 'tunnel →'));
  ting.push(S('text', { x: X(0), y: H - 8, 'text-anchor': 'middle', 'font-size': 10, fill: f.tekst2 }, data.profil !== null ? `påhugg, profil ${fmtNum(data.profil, 1)}` : 'påhugg'));
  // spiling
  if (data.spiling) {
    const L = data.spilingslengde ?? 6;
    for (let i = 0; i < 3; i++) {
      const x0 = i * (L * 0.7);
      if (x0 > lengde) break;
      ting.push(S('line', { x1: X(x0), y1: Y(heng + 0.2), x2: X(Math.min(lengde, x0 + L)), y2: Y(heng + 0.2 + L * 0.18), stroke: f.primar, 'stroke-width': 2 }));
    }
    ting.push(S('text', { x: X(L * 0.5), y: Y(heng + L * 0.18) - 4, 'font-size': 10, fill: f.primar, 'font-weight': 600, stroke: f.bg, 'stroke-width': 3, 'paint-order': 'stroke' },
      `spiling ${data.spilingslengde ? fmtNum(data.spilingslengde, 1) + ' m' : ''}${data.antallSpiler ? `, ${fmtNum(data.antallSpiler, 0)} stk` : ''}`));
  }
  // buer
  if (data.buer) {
    const c = data.buesenteravstand ?? 1.5;
    for (let x = 0.4; x <= Math.min(lengde, 12); x += c) {
      ting.push(S('line', { x1: X(x), y1: Y(0), x2: X(x), y2: Y(heng), stroke: f.rod, 'stroke-width': 1.6, 'stroke-opacity': 0.8 }));
    }
    ting.push(S('text', { x: X(1), y: Y(0) + 13, 'font-size': 10, fill: f.rod, 'font-weight': 600, stroke: f.bg, 'stroke-width': 3, 'paint-order': 'stroke' }, `buer${data.buesenteravstand ? ' c/c ' + fmtNum(data.buesenteravstand, 1) + ' m' : ''}`));
  }
  // mål ved påhugget
  const mxl = X(0) - 12;
  const pil = (y1, y2, tekst) => [
    S('line', { x1: mxl, y1: Y(y1), x2: mxl, y2: Y(y2), stroke: f.tekst, 'stroke-width': 1 }),
    S('line', { x1: mxl - 4, y1: Y(y1), x2: mxl + 4, y2: Y(y1), stroke: f.tekst }),
    S('line', { x1: mxl - 4, y1: Y(y2), x2: mxl + 4, y2: Y(y2), stroke: f.tekst }),
    S('text', { x: mxl - 6, y: (Y(y1) + Y(y2)) / 2 + 4, 'text-anchor': 'end', 'font-size': 10.5, 'font-weight': 600, fill: f.tekst }, tekst),
  ];
  ting.push(pil(heng, bergFlate(0), `berg ${data.bergoverdekning !== null ? fmtNum(data.bergoverdekning, 1) + ' m' : '?'}`));
  ting.push(pil(bergFlate(0), terreng(0), `løsm. ${data.losmasse !== null ? fmtNum(data.losmasse, 1) + ' m' : '?'}`));
  ting.push(S('text', { x: W - 8, y: 14, 'text-anchor': 'end', 'font-size': 11, 'font-weight': 700, fill: f.tekst2 }, 'Lengdesnitt (skjematisk)'));
  return S('svg', { viewBox: `0 0 ${W} ${H}`, width: bredde, height: (bredde * H) / W, class: 'skisse', 'font-family': f.font }, ting);
}
