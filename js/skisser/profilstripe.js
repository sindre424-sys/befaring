// Profilstripe: horisontal profilakse med observasjonene som markører/strekninger, én rad per objekttype.
import { finSteg, alvFarge } from './svg.js';
import { obsNr, fmtNum } from '../util.js';

/**
 * rader: [{ navn, obs: [observasjoner] }]
 * onVelg(obsId) åpner observasjonen (bare i appen).
 */
export function tegnProfilstripe(S, f, { rader, bredde = 340, onVelg = null }) {
  const alle = rader.flatMap((r) => r.obs);
  const verdier = alle.flatMap((o) => [o.profilFra, o.profilTil]).filter((v) => v !== null && v !== undefined);
  const venstreMarg = 74;
  const hoyreMarg = 12;
  const radH = 44;
  const topp = 26;
  const hoyde = topp + rader.length * radH + 8;
  const b = bredde - venstreMarg - hoyreMarg;

  if (!verdier.length) {
    return S('svg', { viewBox: `0 0 ${bredde} 60`, width: bredde, height: 60, class: 'skisse' },
      S('text', { x: bredde / 2, y: 34, 'text-anchor': 'middle', 'font-size': 12, fill: f.tekst2, 'font-family': f.font },
        'Ingen observasjoner med profil ennå'));
  }
  let min = Math.min(...verdier);
  let max = Math.max(...verdier);
  if (max - min < 20) { min -= 10; max += 10; }
  const pad = (max - min) * 0.04;
  min -= pad;
  max += pad;
  const x = (v) => venstreMarg + ((v - min) / (max - min)) * b;
  const steg = finSteg(max - min, Math.max(3, Math.floor(b / 60)));
  const merker = [];
  for (let v = Math.ceil(min / steg) * steg; v <= max; v += steg) merker.push(v);

  return S('svg', { viewBox: `0 0 ${bredde} ${hoyde}`, width: bredde, height: hoyde, class: 'skisse', 'font-family': f.font },
    S('rect', { x: 0, y: 0, width: bredde, height: hoyde, fill: f.bg }),
    // akse med profilnummer øverst
    S('line', { x1: venstreMarg, y1: topp - 6, x2: bredde - hoyreMarg, y2: topp - 6, stroke: f.kant }),
    merker.map((v) => S('g', null,
      S('line', { x1: x(v), y1: topp - 10, x2: x(v), y2: hoyde - 6, stroke: f.kant, 'stroke-dasharray': '2 4', 'stroke-width': 0.7 }),
      S('text', { x: x(v), y: topp - 13, 'text-anchor': 'middle', 'font-size': 10, fill: f.tekst2 }, fmtNum(v, 1)),
    )),
    rader.map((r, i) => {
      const yRad = topp + i * radH + radH / 2;
      return S('g', null,
        S('text', { x: 4, y: yRad + 4, 'font-size': 11, 'font-weight': 600, fill: f.tekst }, r.navn),
        S('line', { x1: venstreMarg, y1: yRad, x2: bredde - hoyreMarg, y2: yRad, stroke: f.kant, 'stroke-width': 1 }),
        sporFor(r.obs, x).map(({ o, x1, x2, spor, antallSpor }) => {
          const y = yRad + (spor - (antallSpor - 1) / 2) * 13;
          const farge = alvFarge(f, o.alvorlighet);
          const midt = (x1 + x2) / 2;
          const trykk = onVelg ? { onClick: () => onVelg(o.id), style: 'cursor:pointer', role: 'button', 'aria-label': 'Observasjon ' + obsNr(o.lopenr) } : {};
          return S('g', trykk,
            // usynlig, stor trykkflate
            onVelg && S('rect', { x: Math.min(x1, midt - 14), y: y - 12, width: Math.max(x2 - x1, 28), height: 24, fill: 'transparent' }),
            x2 - x1 >= 6
              ? S('rect', { x: x1, y: y - 6, width: x2 - x1, height: 12, rx: 3, fill: farge, 'fill-opacity': 0.85, stroke: f.bg, 'stroke-width': 1 })
              : S('circle', { cx: midt, cy: y, r: 6.5, fill: farge, stroke: f.bg, 'stroke-width': 1.5 }),
            S('text', { x: x2 - x1 >= 6 ? midt : midt + 9, y: x2 - x1 >= 6 ? y - 8 : y + 3.5, 'text-anchor': x2 - x1 >= 6 ? 'middle' : 'start', 'font-size': 9.5, 'font-weight': 700, fill: f.tekst, stroke: f.bg, 'stroke-width': 2.5, 'paint-order': 'stroke' }, obsNr(o.lopenr)),
          );
        }),
      );
    }),
  );
}

/** Fordeler markører på spor slik at overlappende observasjoner ikke skjuler hverandre. */
function sporFor(obs, x) {
  const liste = obs.filter((o) => (o.profilFra !== null && o.profilFra !== undefined) || (o.profilTil !== null && o.profilTil !== undefined))
    .map((o) => {
      const fra = o.profilFra ?? o.profilTil;
      const til = o.profilTil ?? o.profilFra;
      return { o, x1: x(Math.min(fra, til)), x2: x(Math.max(fra, til)) };
    })
    .sort((a, b) => a.x1 - b.x1);
  const sluttPaSpor = [];
  for (const m of liste) {
    const v0 = Math.min(m.x1, (m.x1 + m.x2) / 2 - 9);
    let s = sluttPaSpor.findIndex((slutt) => slutt < v0);
    if (s === -1) { s = sluttPaSpor.length; sluttPaSpor.push(0); }
    sluttPaSpor[s] = Math.max(m.x2, (m.x1 + m.x2) / 2 + 9);
    m.spor = Math.min(s, 2);
  }
  const antallSpor = Math.min(3, Math.max(1, sluttPaSpor.length));
  return liste.map((m) => ({ ...m, antallSpor }));
}

export const profilstripeHoyde = (antallRader) => 26 + antallRader * 44 + 8;
