// Felles tegnemotor for skisser. Samme tegnekode lager
//  - Preact-elementer i appen (trykkbare, følger lys/mørk modus), og
//  - SVG-tekst til Word/PDF (faste farger, gjøres om til PNG).
import { h } from '../lib.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** modus 'app' → Preact-elementer, modus 'rapport' → SVG-tekst. */
export function lagBygger(modus) {
  if (modus === 'app') {
    return (tag, attr, ...barn) => h(tag, attr || {}, ...barn.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
  }
  return (tag, attr = {}, ...barn) => {
    const a = Object.entries(attr || {})
      .filter(([k, v]) => v !== undefined && v !== null && v !== false && !/^on[A-Z]/.test(k) && k !== 'key' && k !== 'role' && k !== 'tabindex')
      .map(([k, v]) => ` ${k === 'className' ? 'class' : k}="${esc(v)}"`).join('');
    const inner = barn.flat(Infinity)
      .filter((x) => x !== null && x !== undefined && x !== false && x !== '')
      .map((x) => (typeof x === 'object' && x.__svg ? x.__svg : esc(x))).join('');
    return { __svg: `<${tag}${a}>${inner}</${tag}>` };
  };
}

export function tilSvgTekst(node) {
  return node.__svg.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
}

// Farger: i appen brukes CSS-variabler (lys/mørk modus), i rapporter faste farger.
export const APP_FARGER = {
  tekst: 'var(--tekst)', tekst2: 'var(--tekst2)', bg: 'var(--flate)', kant: 'var(--kant)',
  berg: 'var(--berg)', bergKant: 'var(--berg-kant)', losmasse: 'var(--losmasse)', vei: 'var(--vei)',
  luft: 'var(--bg)', valgt: 'var(--valgt-bg)', valgtTekst: 'var(--valgt-tekst)', sone: 'var(--sone)',
  gronn: 'var(--gronn)', gul: 'var(--gul)', rod: 'var(--rod)', ingen: 'var(--tekst2)', primar: 'var(--primar)',
  font: '-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif',
};
export const RAPPORT_FARGER = {
  tekst: '#111111', tekst2: '#555555', bg: '#ffffff', kant: '#8a949e',
  berg: '#c3c8ce', bergKant: '#6f7880', losmasse: '#e3cf9f', vei: '#5a5f64',
  luft: '#ffffff', valgt: '#0b5cad', valgtTekst: '#ffffff', sone: '#e9eef3',
  gronn: '#1e8e3e', gul: '#e8a600', rod: '#d0312d', ingen: '#777777', primar: '#0b5cad',
  font: 'Helvetica, Arial, sans-serif',
};

export const alvFarge = (f, a) => (a ? f[a] : f.ingen);

/** Velger «pene» akseintervaller (1, 2, 5, 10, 20, 50 …). */
export function finSteg(spenn, maksAntall = 8) {
  if (!(spenn > 0)) return 10;
  const grov = spenn / maksAntall;
  const p = 10 ** Math.floor(Math.log10(grov));
  for (const m of [1, 2, 5, 10]) if (m * p >= grov) return m * p;
  return 10 * p;
}

/** SVG-tekst → PNG (Blob) i høy oppløsning for Word/PDF. */
export async function svgTilPng(svgTekst, bredde, hoyde, skala = 3) {
  const blob = new Blob([svgTekst], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Skissen kunne ikke tegnes'));
      i.src = url;
    });
    const c = document.createElement('canvas');
    c.width = Math.round(bredde * skala);
    c.height = Math.round(hoyde * skala);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const png = await new Promise((r) => c.toBlob(r, 'image/png'));
    c.width = c.height = 0;
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Trykkflate for posisjonsvalg: stor, tydelig markert når valgt. */
/** Deler en etikett i linjer på maks antall tegn (bryter etter mellomrom eller skråstrek). */
export function brytTekst(tekst, maks) {
  if (!maks || tekst.length <= maks) return [tekst];
  const ord = [];
  let buf = '';
  for (const c of tekst) {
    buf += c;
    if (c === ' ' || c === '/') { ord.push(buf); buf = ''; }
  }
  if (buf) ord.push(buf);
  const linjer = [];
  let linje = '';
  for (const o of ord) {
    if (linje && (linje + o).trim().length > maks) { linjer.push(linje.trim()); linje = o; } else linje += o;
  }
  if (linje.trim()) linjer.push(linje.trim());
  return linjer;
}

export function sone(S, f, { d, valgt, navn, onVelg, tekstX, tekstY, tekst, liten = false, farge = null, antall = null, maks = 18 }) {
  const fyll = farge || (valgt ? f.valgt : f.sone);
  const props = {
    d,
    fill: fyll,
    'fill-opacity': farge ? 0.55 : valgt ? 0.85 : 0.35,
    stroke: valgt ? f.valgt : f.kant,
    'stroke-width': valgt ? 3 : 1,
    'stroke-dasharray': valgt ? null : '4 3',
  };
  if (onVelg) {
    props.onClick = () => onVelg(navn);
    props.role = 'button';
    props['aria-label'] = navn + (valgt ? ' (valgt)' : '');
    props.style = 'cursor:pointer';
  }
  const etikett = tekst ?? navn;
  const linjer = etikett ? brytTekst((valgt ? '✓ ' : '') + etikett + (antall ? ` (${antall})` : ''), maks) : [];
  const fs = liten ? 10 : 11.5;
  const y0 = tekstY - ((linjer.length - 1) * fs * 1.15) / 2;
  return S('g', null,
    S('path', props),
    linjer.length && S('text', {
      x: tekstX, y: y0, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': valgt ? 700 : 500,
      fill: valgt && !farge ? f.valgtTekst : f.tekst, 'pointer-events': 'none', 'font-family': f.font,
    }, linjer.map((l, i) => S('tspan', { x: tekstX, dy: i === 0 ? 0 : fs * 1.15 }, l))),
  );
}

/** Rektangel som path-streng */
export const rekt = (x, y, b, h) => `M${x},${y}h${b}v${h}h${-b}Z`;
export const poly = (pkt) => 'M' + pkt.map((p) => p.map((v) => Math.round(v * 10) / 10).join(',')).join('L') + 'Z';
