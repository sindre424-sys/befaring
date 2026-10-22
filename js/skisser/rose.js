// Rosediagram over sprekkeretninger (10°-sektorer). Strøk vises toveis (symmetrisk), fallretning enveis.
import { norm360, fmtNum } from '../util.js';

export const ROSE_MIN_ANTALL = 3;

export function roseData(sett, modus = 'strok', sektor = 10) {
  const n = Math.round(360 / sektor);
  const telling = new Array(n).fill(0);
  for (const s of sett) {
    const retning = modus === 'strok' ? norm360(s.fallretning - 90) : norm360(s.fallretning);
    const i = Math.floor(retning / sektor) % n;
    telling[i]++;
    if (modus === 'strok') telling[(i + n / 2) % n]++;
  }
  return { telling, sektor, antall: sett.length };
}

export function tegnRose(S, f, { sett, modus = 'strok', bredde = 300, tittel = null }) {
  const W = 300;
  const R = 112;
  const cx = W / 2;
  const cy = (tittel ? 24 : 10) + R + 12;
  const { telling, sektor, antall } = roseData(sett, modus);
  const maks = Math.max(1, ...telling);
  const rad = (g) => (g * Math.PI) / 180;
  const P = (az, r) => [cx + r * Math.sin(rad(az)), cy - r * Math.cos(rad(az))];
  const ting = [];
  ting.push(S('circle', { cx, cy, r: R, fill: f.bg, stroke: f.tekst, 'stroke-width': 1.3 }));
  const ringer = maks <= 4 ? maks : 4;
  for (let i = 1; i <= ringer; i++) {
    const r = (R * i) / ringer;
    ting.push(S('circle', { cx, cy, r, fill: 'none', stroke: f.kant, 'stroke-width': 0.7, 'stroke-dasharray': '3 3' }));
    ting.push(S('text', { x: cx + 3, y: cy - r + 11, 'font-size': 9, fill: f.tekst2 }, fmtNum((maks * i) / ringer, 1)));
  }
  for (const [az, t] of [[0, 'N'], [90, 'Ø'], [180, 'S'], [270, 'V']]) {
    const [x, y] = P(az, R + 9);
    ting.push(S('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: f.tekst }, t));
  }
  telling.forEach((c, i) => {
    if (!c) return;
    const r = (R * c) / maks;
    const a1 = i * sektor;
    const a2 = a1 + sektor;
    const [x1, y1] = P(a1, r);
    const [x2, y2] = P(a2, r);
    ting.push(S('path', { d: `M${cx},${cy}L${x1},${y1}A${r},${r} 0 0 1 ${x2},${y2}Z`, fill: f.primar, 'fill-opacity': 0.7, stroke: f.bg, 'stroke-width': 0.8 }));
  });
  const H = cy + R + 34;
  return S('svg', { viewBox: `0 0 ${W} ${H}`, width: bredde, height: (bredde * H) / W, class: 'skisse', 'font-family': f.font },
    S('rect', { x: 0, y: 0, width: W, height: H, fill: f.bg }),
    tittel && S('text', { x: W / 2, y: 16, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: f.tekst }, tittel),
    ting,
    S('text', { x: W / 2, y: H - 10, 'text-anchor': 'middle', 'font-size': 10, fill: f.tekst2 },
      `${modus === 'strok' ? 'Strøkretning (toveis)' : 'Fallretning'}, 10° sektorer, n = ${antall}`),
  );
}
