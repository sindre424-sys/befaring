// Tunnel: hesteskoformet tverrsnitt der posisjon velges ved trykk. Stuff er eget valg i midten.
import { sone, rekt } from './svg.js';

export const TUNNEL_SONER = {
  heng: 'Heng', vederlagV: 'Vederlag venstre', vederlagH: 'Vederlag høyre',
  veggV: 'Vegg venstre', veggH: 'Vegg høyre', saale: 'Såle', stuff: 'Stuff',
};

const CX = 150;
const CY = 118;
const R = 70;

function sektor(r1, r2, a1, a2) {
  const p = (r, a) => [CX + r * Math.cos((a * Math.PI) / 180), CY - r * Math.sin((a * Math.PI) / 180)];
  const [x1, y1] = p(r2, a1);
  const [x2, y2] = p(r2, a2);
  const [x3, y3] = p(r1, a2);
  const [x4, y4] = p(r1, a1);
  const stor = a2 - a1 > 180 ? 1 : 0;
  return `M${x1},${y1}A${r2},${r2} 0 ${stor} 0 ${x2},${y2}L${x3},${y3}A${r1},${r1} 0 ${stor} 1 ${x4},${y4}Z`;
}

/** valgte: liste med posisjonsnavn. oversikt: { navn: { antall, verst } } for befaringsoversikt. */
export function tegnTunnel(S, f, { valgte = [], onVelg = null, soner = TUNNEL_SONER, oversikt = null, bredde = 300 }) {
  const n = { ...TUNNEL_SONER, ...(soner || {}) };
  const hoyde = 250;
  const z = (navn, d, tx, ty, liten) => {
    const o = oversikt && oversikt[navn];
    return sone(S, f, {
      d, navn, valgt: !oversikt && valgte.includes(navn), onVelg, tekstX: tx, tekstY: ty, liten, maks: liten ? 10 : 16,
      farge: o ? f[o.verst] || f.ingen : null, antall: o ? o.antall : null,
    });
  };
  const kontur = `M80,212V${CY}A${R},${R} 0 0 1 220,${CY}V212`;
  return S('svg', { viewBox: `0 0 300 ${hoyde}`, width: bredde, height: (bredde * hoyde) / 300, class: 'skisse', 'font-family': f.font },
    S('rect', { x: 0, y: 0, width: 300, height: hoyde, fill: f.berg }),
    S('path', { d: `${kontur}Z`, fill: f.luft }),
    S('path', { d: kontur, fill: 'none', stroke: f.tekst, 'stroke-width': 3 }),
    S('line', { x1: 60, y1: 212, x2: 240, y2: 212, stroke: f.vei, 'stroke-width': 4 }),
    z(n.heng, sektor(54, 100, 56, 124), CX, 40),
    z(n.vederlagH, sektor(54, 100, 0, 56), 232, 72, true),
    z(n.vederlagV, sektor(54, 100, 124, 180), 68, 72, true),
    z(n.veggV, rekt(48, CY, 46, 86), 71, 170, true),
    z(n.veggH, rekt(206, CY, 46, 86), 229, 170, true),
    z(n.saale, rekt(94, 200, 112, 34), CX, 222),
    z(n.stuff, `M${CX - 34},150a34,30 0 1 0 68,0a34,30 0 1 0 -68,0Z`, CX, 154),
  );
}
