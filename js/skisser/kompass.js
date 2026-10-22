// Orienteringsindikator: kompass med strøklinje og fallpil (geologisk symbol), så feil oppdages med en gang.
import { norm360 } from '../util.js';

export function tegnKompass(S, f, { fall, fallretning, storrelse = 76 }) {
  const r = storrelse / 2 - 8;
  const c = storrelse / 2;
  const har = fall !== null && fall !== undefined && fallretning !== null && fallretning !== undefined;
  const rad = (g) => (g * Math.PI) / 180;
  const punkt = (az, l) => [c + l * Math.sin(rad(az)), c - l * Math.cos(rad(az))];
  const ting = [];
  ting.push(S('circle', { cx: c, cy: c, r, fill: f.bg, stroke: f.kant, 'stroke-width': 1.2 }));
  for (const az of [0, 90, 180, 270]) {
    const [x1, y1] = punkt(az, r);
    const [x2, y2] = punkt(az, r - 5);
    ting.push(S('line', { x1, y1, x2, y2, stroke: f.tekst2, 'stroke-width': 1 }));
  }
  ting.push(S('text', { x: c, y: 9, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 700, fill: f.tekst, 'font-family': f.font }, 'N'));
  if (har) {
    const strok = norm360(fallretning - 90);
    const [sx1, sy1] = punkt(strok, r - 4);
    const [sx2, sy2] = punkt(strok + 180, r - 4);
    const [dx, dy] = punkt(fallretning, r * 0.55);
    ting.push(S('line', { x1: sx1, y1: sy1, x2: sx2, y2: sy2, stroke: f.primar, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    ting.push(S('line', { x1: c, y1: c, x2: dx, y2: dy, stroke: f.primar, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    // pilspiss mot fallretningen
    const [p1x, p1y] = punkt(fallretning, r * 0.55 + 6);
    const [q1x, q1y] = [dx + 4 * Math.cos(rad(fallretning)), dy + 4 * Math.sin(rad(fallretning))];
    const [q2x, q2y] = [dx - 4 * Math.cos(rad(fallretning)), dy - 4 * Math.sin(rad(fallretning))];
    ting.push(S('path', { d: `M${p1x},${p1y}L${q1x},${q1y}L${q2x},${q2y}Z`, fill: f.primar }));
    const [tx, ty] = punkt(fallretning + 180, r * 0.45);
    if (storrelse >= 56) ting.push(S('text', { x: tx, y: ty + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: f.tekst, 'font-family': f.font }, String(Math.round(fall))));
  } else {
    ting.push(S('text', { x: c, y: c + 4, 'text-anchor': 'middle', 'font-size': 10, fill: f.tekst2, 'font-family': f.font }, '–'));
  }
  return S('svg', { viewBox: `0 0 ${storrelse} ${storrelse}`, width: storrelse, height: storrelse, class: 'kompass', 'aria-hidden': 'true' }, ting);
}
