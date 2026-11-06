// Tegning på bilder: sikringssymboler, områder, piler, sirkler/ellipser, frihånd og tekst.
// Lagres som vektordata på bildet (foto.tegning), slik at originalbildet aldri endres.
// Ved eksport tegnes figurene inn i en kopi av bildet.
import { html, h, useState, useRef, useEffect } from './lib.js';
import { db, patch, useBildeUrl } from './db.js';
import { lagBygger, tilSvgTekst } from './skisser/svg.js';
import { bekreft, visMelding } from './ui.js';
import { useCtx } from './config.js';
import { fmtNum, parseNum } from './util.js';
import {
  SYMBOLSTORRELSER, POLYGONSTIL, boltNavn, symbolBredde, nySymbolfigur, symbolSvg, polygonSvg, mengder, annenMengde,
} from './sikring.js';

export const TEGNEFARGER = { Rød: '#e03131', Gul: '#ffd43b', Hvit: '#ffffff', Svart: '#111111' };

const strek = (W, H) => Math.max(3, Math.round(Math.max(W, H) * 0.006));
const skrift = (W, H) => Math.max(14, Math.round(Math.max(W, H) * 0.035));

/** Tegner figurene som SVG-elementer (fungerer både i appen og som tekst for eksport). */
export function figurerSvg(S, tegning, ekstra = null) {
  const { bredde: W, hoyde: H } = tegning;
  const sw0 = strek(W, H);
  const fs = skrift(W, H);
  const liste = [...(tegning.figurer || []), ...(ekstra ? [ekstra] : [])];
  // Områder tegnes først, slik at de aldri dekker symboler og streker
  const alle = [...liste.filter((f) => f.type === 'polygon'), ...liste.filter((f) => f.type !== 'polygon')];
  return alle.map((fg) => {
    const c = fg.farge || '#e03131';
    const kontrast = c === '#111111' ? '#ffffff' : '#000000';
    const sw = sw0 * (fg.tykkelse || 1);
    if (fg.type === 'symbol') return symbolSvg(S, fg, fg.x, fg.y, symbolBredde(W, H, tegning.symbolSkala));
    if (fg.type === 'polygon') return polygonSvg(S, fg, sw0);
    if (fg.type === 'frihand') {
      const pkt = fg.punkter || [];
      if (!pkt.length) return null;
      const d = 'M' + pkt.map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).join('L') + (pkt.length === 1 ? 'l0.1,0' : '');
      return S('g', null,
        S('path', { d, fill: 'none', stroke: kontrast, 'stroke-width': sw + 3, 'stroke-opacity': 0.45, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        S('path', { d, fill: 'none', stroke: c, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    }
    if (fg.type === 'pil') {
      const dx = fg.x2 - fg.x1;
      const dy = fg.y2 - fg.y1;
      const l = Math.hypot(dx, dy) || 1;
      const ux = dx / l;
      const uy = dy / l;
      const hl = sw * 5;
      const bx = fg.x2 - ux * hl;
      const by = fg.y2 - uy * hl;
      const spiss = `M${fg.x2},${fg.y2}L${bx - uy * hl * 0.55},${by + ux * hl * 0.55}L${bx + uy * hl * 0.55},${by - ux * hl * 0.55}Z`;
      return S('g', null,
        S('line', { x1: fg.x1, y1: fg.y1, x2: bx, y2: by, stroke: kontrast, 'stroke-width': sw + 3, 'stroke-opacity': 0.45, 'stroke-linecap': 'round' }),
        S('line', { x1: fg.x1, y1: fg.y1, x2: bx, y2: by, stroke: c, 'stroke-width': sw, 'stroke-linecap': 'round' }),
        S('path', { d: spiss, fill: c, stroke: kontrast, 'stroke-width': 1.5, 'stroke-opacity': 0.45 }));
    }
    if (fg.type === 'sirkel') {
      const cx = (fg.x1 + fg.x2) / 2;
      const cy = (fg.y1 + fg.y2) / 2;
      const rx = Math.max(4, Math.abs(fg.x2 - fg.x1) / 2);
      const ry = Math.max(4, Math.abs(fg.y2 - fg.y1) / 2);
      return S('g', null,
        S('ellipse', { cx, cy, rx, ry, fill: 'none', stroke: kontrast, 'stroke-width': sw + 3, 'stroke-opacity': 0.45 }),
        S('ellipse', { cx, cy, rx, ry, fill: 'none', stroke: c, 'stroke-width': sw }));
    }
    if (fg.type === 'tekst') {
      const fst = fs * (fg.tykkelse || 1);
      return S('text', {
        x: fg.x1, y: fg.y1, 'font-size': fst, 'font-weight': 700, fill: c, stroke: kontrast, 'stroke-width': Math.max(2, fst * 0.12),
        'paint-order': 'stroke', 'font-family': 'Helvetica, Arial, sans-serif',
      }, fg.tekst || '');
    }
    return null;
  });
}

export const harTegning = (foto) => !!(foto && foto.tegning && foto.tegning.figurer && foto.tegning.figurer.length);

/** Overlegg i appen (over miniatyr eller fullt bilde). */
export function TegningOverlegg({ tegning, dekk = false }) {
  if (!tegning || !tegning.figurer || !tegning.figurer.length) return null;
  const S = lagBygger('app');
  return S('svg', {
    class: 'tegning-overlegg', viewBox: `0 0 ${tegning.bredde} ${tegning.hoyde}`,
    preserveAspectRatio: dekk ? 'xMidYMid slice' : 'xMidYMid meet', 'aria-hidden': 'true',
  }, figurerSvg(S, tegning));
}

/** Lager en JPEG med tegningen brent inn (til Word, PDF og bilde-zip). */
export async function bildeMedTegning(foto, kvalitet = 0.88) {
  const url = URL.createObjectURL(foto.blob);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Bildet kunne ikke leses'));
      i.src = url;
    });
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const t = { ...foto.tegning };
    const R = lagBygger('rapport');
    const svg = tilSvgTekst(R('svg', { viewBox: `0 0 ${t.bredde} ${t.hoyde}`, width: W, height: H }, figurerSvg(R, t)));
    const surl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const over = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('Tegningen kunne ikke tegnes'));
        i.src = surl;
      });
      ctx.drawImage(over, 0, 0, W, H);
    } finally {
      URL.revokeObjectURL(surl);
    }
    const ut = await new Promise((r) => c.toBlob(r, 'image/jpeg', kvalitet));
    c.width = c.height = 0;
    return ut;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Utkast ----------
// Mens du tegner, lagres arbeidet i et lite utkast på telefonen. Selve bilderaden skrives først når du trykker
// Ferdig, så bildet ikke kopieres for hver strek. Utkastet overlever at appen lukkes, og hentes inn ved neste start.
const UTKAST = 'befaring-tegneutkast:';

function skrivUtkast(fotoId, tegning) {
  try {
    localStorage.setItem(UTKAST + fotoId, JSON.stringify({ tegning }));
    return true;
  } catch (e) {
    console.warn('Kunne ikke lagre tegneutkast', e);
    return false;
  }
}
function fjernUtkast(fotoId) {
  try {
    localStorage.removeItem(UTKAST + fotoId);
  } catch (e) {
    /* ignorer */
  }
}

/** Legger inn tegninger som ikke ble lukket, for eksempel fordi telefonen lukket appen. */
export async function hentInnUtkast() {
  let nokler = [];
  try {
    nokler = Object.keys(localStorage).filter((k) => k.startsWith(UTKAST));
  } catch (e) {
    return;
  }
  for (const k of nokler) {
    const fotoId = k.slice(UTKAST.length);
    try {
      const { tegning } = JSON.parse(localStorage.getItem(k));
      if (await db.fotos.get(fotoId)) await patch('fotos', fotoId, { tegning });
      fjernUtkast(fotoId);
    } catch (e) {
      console.warn('Kunne ikke hente inn tegneutkast', e);
    }
  }
}

// ---------- Tegnemodus ----------
const VERKTOY = [['frihand', '✎ Frihånd'], ['pil', '➚ Pil'], ['sirkel', '◯ Sirkel'], ['tekst', 'T Tekst']];
const TYKKELSER = [['Tynn', 0.6], ['Middels', 1], ['Tykk', 1.8]];
const MAKS_ZOOM = 8;
const FINGER = 24; // treffområde i skjermpunkter, romslig for hansker
const DRA_GRENSE = 8; // bevegelse under dette regnes som et trykk

// Huskes mens appen er åpen, slik at neste bilde starter der du slapp.
let sisteFane = 'sikring';
let sisteSymbolId = null;

const kopier = (f) => JSON.parse(JSON.stringify(f));

function flyttetFigur(f, dx, dy) {
  if (f.type === 'symbol') return { ...f, x: f.x + dx, y: f.y + dy };
  if (f.punkter) return { ...f, punkter: f.punkter.map((q) => [q[0] + dx, q[1] + dy]) };
  if (f.type === 'tekst') return { ...f, x1: f.x1 + dx, y1: f.y1 + dy };
  return { ...f, x1: f.x1 + dx, y1: f.y1 + dy, x2: f.x2 + dx, y2: f.y2 + dy };
}

function iPolygon(p, pkt) {
  let inni = false;
  for (let i = 0, j = pkt.length - 1; i < pkt.length; j = i++) {
    const [xi, yi] = pkt[i];
    const [xj, yj] = pkt[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inni = !inni;
  }
  return inni;
}

function avstandLinje(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

function treffer(f, p, radius, tegning) {
  if (f.type === 'symbol') return Math.hypot(p[0] - f.x, p[1] - f.y) <= Math.max(radius, symbolBredde(tegning.bredde, tegning.hoyde, tegning.symbolSkala) * 0.8);
  if (f.type === 'polygon') return iPolygon(p, f.punkter) || f.punkter.some((q, i) => avstandLinje(p, q, f.punkter[(i + 1) % f.punkter.length]) <= radius);
  if (f.type === 'frihand') return f.punkter.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= radius);
  if (f.type === 'pil') return avstandLinje(p, [f.x1, f.y1], [f.x2, f.y2]) <= radius;
  if (f.type === 'sirkel') {
    return p[0] >= Math.min(f.x1, f.x2) - radius && p[0] <= Math.max(f.x1, f.x2) + radius
      && p[1] >= Math.min(f.y1, f.y2) - radius && p[1] <= Math.max(f.y1, f.y2) + radius;
  }
  if (f.type === 'tekst') {
    const fs = skrift(tegning.bredde, tegning.hoyde) * (f.tykkelse || 1);
    return p[0] >= f.x1 - radius && p[0] <= f.x1 + (f.tekst || '').length * fs * 0.6 + radius && p[1] >= f.y1 - fs - radius && p[1] <= f.y1 + radius;
  }
  return false;
}

/** Finner figuren under fingeren. Symboler går foran streker, og store områder kommer sist. */
function finnFigur(figurer, p, radius, tegning) {
  for (const gruppe of [(f) => f.type === 'symbol', (f) => f.type !== 'symbol' && f.type !== 'polygon', (f) => f.type === 'polygon']) {
    for (let i = figurer.length - 1; i >= 0; i--) {
      if (gruppe(figurer[i]) && treffer(figurer[i], p, radius, tegning)) return i;
    }
  }
  return -1;
}

const figurNavn = (f) => ({ pil: 'Pil', sirkel: 'Sirkel', frihand: 'Frihånd', tekst: 'Tekst' }[f.type] || f.navn || 'Figur');

function MiniSymbol({ fg }) {
  const A = lagBygger('app');
  return A('svg', { class: 'mini-symbol', viewBox: '-13 -13 26 28', 'aria-hidden': 'true' }, symbolSvg(A, fg, 0, -1, 18));
}

function MiniPolygon({ stil }) {
  const s = POLYGONSTIL[stil] || POLYGONSTIL.gul;
  return html`<svg class="mini-symbol" viewBox="0 0 26 28" aria-hidden="true">
    <polygon points="3,9 16,3 24,14 19,25 6,22" fill=${s.fyll} fill-opacity=${s.fyllOpasitet || undefined} stroke=${s.strek} stroke-width="2.5" stroke-linejoin="round" />
  </svg>`;
}

/**
 * Tegneflate for både sikring og vanlig tegning.
 * Én finger tegner eller plasserer, to fingre zoomer og flytter bildet. Symboler og polygonhjørner settes
 * når fingeren slippes, slik at et zoomegrep aldri legger igjen et symbol ved et uhell.
 * Alt lagres fortløpende, så ingenting går tapt om telefonen lukker appen.
 */
export function Tegnemodus({ foto, onLukk }) {
  const ctx = useCtx();
  const sikring = ctx.config.sikring;
  const bolter = sikring.bolter || [];
  const annen = sikring.annen || [];
  const paletten = [...bolter, ...annen.filter((a) => a.type === 'punkt')];

  const { url, onError: bildeFeil, feilet: bildeFeilet } = useBildeUrl(foto.id);
  const [dim, setDim] = useState(foto.bredde && foto.hoyde ? { bredde: foto.bredde, hoyde: foto.hoyde } : null);
  const [figurer, setFigurer] = useState((foto.tegning && foto.tegning.figurer) || []);
  const [symbolSkala, setSymbolSkala] = useState((foto.tegning && foto.tegning.symbolSkala) || 1);
  const [fane, setFane] = useState(sisteFane);
  const [verktoy, setVerktoy] = useState(sisteFane === 'sikring' ? 'symbol' : sisteFane === 'velg' ? 'velg' : 'frihand');
  const [symbol, setSymbol] = useState(paletten.find((s) => s.id === sisteSymbolId) || paletten[0] || null);
  const [farge, setFarge] = useState('Rød');
  const [tykkelse, setTykkelse] = useState('Middels');
  const [utkast, setUtkast] = useState(null);
  const [tekstPunkt, setTekstPunkt] = useState(null);
  const [tekst, setTekst] = useState('');
  const [poly, setPoly] = useState(null); // område som tegnes nå: { def, punkter }
  const [arealFor, setArealFor] = useState(null);
  const [arealTekst, setArealTekst] = useState('');
  const [valgt, setValgt] = useState(null);
  const [visMengder, setVisMengder] = useState(false);
  const [rammeMal, setRammeMal] = useState(null);
  const [zoomVis, setZoomVis] = useState(1);
  const [harHistorikk, setHarHistorikk] = useState(false);

  const flateRef = useRef(null);
  const rammeRef = useRef(null);
  const svgRef = useRef(null);
  const tekstRef = useRef(null);
  const arealRef = useRef(null);
  const utkastRef = useRef(null);
  const ramme = useRef(0);
  const figRef = useRef(figurer);
  const historikk = useRef([]);
  const polyRef = useRef(null);
  const gest = useRef(null);
  const zoom = useRef({ s: 1, x: 0, y: 0 });
  const lagreTimer = useRef(0);
  const ulagret = useRef(false);
  const lukket = useRef(false);
  const original = useRef(foto.tegning ? kopier(foto.tegning) : null);
  // Verdier som de faste lytterne trenger (unngår utdaterte verdier i lukkede funksjoner)
  const tilstand = useRef({});
  tilstand.current = { dim, verktoy, farge, tykkelse, symbol, symbolSkala, valgt };

  useEffect(() => { if (tekstPunkt && tekstRef.current) tekstRef.current.focus(); }, [tekstPunkt]);
  useEffect(() => { if (arealFor !== null && arealRef.current) arealRef.current.focus(); }, [arealFor]);

  // ---------- Endringer og lagring ----------
  const tegningNa = () => {
    const d = tilstand.current.dim;
    return figRef.current.length && d
      ? { versjon: 2, bredde: d.bredde, hoyde: d.hoyde, symbolSkala: tilstand.current.symbolSkala, figurer: figRef.current }
      : null;
  };
  const lagreUtkast = () => {
    clearTimeout(lagreTimer.current);
    if (!ulagret.current) return;
    ulagret.current = false;
    if (!skrivUtkast(foto.id, tegningNa())) patch('fotos', foto.id, { tegning: tegningNa() });
  };
  const planleggLagring = () => {
    ulagret.current = true;
    clearTimeout(lagreTimer.current);
    lagreTimer.current = setTimeout(lagreUtkast, 400);
  };
  const erEndret = () => {
    const opprinnelig = original.current;
    const na = tegningNa();
    if (!opprinnelig || !na) return !!opprinnelig !== !!na;
    return JSON.stringify(opprinnelig.figurer || []) !== JSON.stringify(na.figurer)
      || (opprinnelig.symbolSkala || 1) !== na.symbolSkala;
  };
  /** Skriver til bilderaden bare hvis noe faktisk er endret. */
  const lagreEndelig = async () => {
    clearTimeout(lagreTimer.current);
    ulagret.current = false;
    if (erEndret()) await patch('fotos', foto.id, { tegning: tegningNa() });
    fjernUtkast(foto.id);
  };
  const sett = (ny, medHistorikk = true) => {
    if (medHistorikk) {
      historikk.current.push(figRef.current);
      setHarHistorikk(true);
    }
    figRef.current = ny;
    setFigurer(ny);
    planleggLagring();
  };
  const angre = () => {
    const forrige = historikk.current.pop();
    if (!forrige) return;
    setValgt(null);
    setHarHistorikk(historikk.current.length > 0);
    sett(forrige, false);
  };
  useEffect(() => {
    const iBakgrunn = () => { if (document.visibilityState === 'hidden') lagreUtkast(); };
    document.addEventListener('visibilitychange', iBakgrunn);
    window.addEventListener('pagehide', lagreUtkast);
    return () => {
      document.removeEventListener('visibilitychange', iBakgrunn);
      window.removeEventListener('pagehide', lagreUtkast);
      if (!lukket.current) lagreEndelig();
    };
  }, []);

  // ---------- Bildets størrelse og zoom ----------
  const trans = () => `translate(${zoom.current.x}px, ${zoom.current.y}px) scale(${zoom.current.s})`;
  const brukZoom = () => {
    const fl = flateRef.current;
    const ra = rammeRef.current;
    if (!fl || !ra) return;
    const z = zoom.current;
    const klem = (t, inn, fri, start) => {
      const vis = inn * z.s;
      if (vis <= fri) return (fri - vis) / 2 - start;
      return Math.min(-start, Math.max(fri - start - vis, t));
    };
    z.x = klem(z.x, ra.offsetWidth, fl.clientWidth, ra.offsetLeft);
    z.y = klem(z.y, ra.offsetHeight, fl.clientHeight, ra.offsetTop);
    ra.style.transform = trans();
  };
  const zoomRundt = (px, py, s) => {
    const ra = rammeRef.current;
    const z = zoom.current;
    const ny = Math.max(1, Math.min(MAKS_ZOOM, s));
    const cx = (px - ra.offsetLeft - z.x) / z.s;
    const cy = (py - ra.offsetTop - z.y) / z.s;
    z.s = ny;
    z.x = px - ra.offsetLeft - cx * ny;
    z.y = py - ra.offsetTop - cy * ny;
    brukZoom();
  };
  const nullstillZoom = () => {
    zoom.current = { s: 1, x: 0, y: 0 };
    brukZoom();
    setZoomVis(1);
  };
  useEffect(() => {
    const fl = flateRef.current;
    if (!fl || !dim) return undefined;
    const mal = () => {
      const fw = fl.clientWidth;
      const fh = fl.clientHeight;
      if (!fw || !fh) return;
      const s = Math.min(fw / dim.bredde, fh / dim.hoyde);
      setRammeMal({ w: Math.round(dim.bredde * s), h: Math.round(dim.hoyde * s) });
    };
    mal();
    const ro = new ResizeObserver(mal);
    ro.observe(fl);
    return () => ro.disconnect();
  }, [dim]);
  useEffect(() => { brukZoom(); }, [rammeMal]);

  // ---------- Polygon ----------
  const settPoly = (p) => { polyRef.current = p; setPoly(p); };
  const fullforPoly = () => {
    const p = polyRef.current;
    if (!p) return;
    settPoly(null);
    if (p.punkter.length < 3) return;
    const { def } = p;
    const ny = { type: 'polygon', art: def.id, navn: def.navn, stil: def.stil, beskrivelse: def.beskrivelse || null, medAreal: !!def.areal, punkter: p.punkter, areal: null };
    sett([...figRef.current, ny]);
    if (def.areal) {
      setArealTekst('');
      setArealFor(figRef.current.length - 1);
    }
  };
  const startPoly = (def) => {
    fullforPoly();
    setVerktoy('polygon');
    settPoly({ def, punkter: [] });
  };
  const lagreAreal = () => {
    const v = parseNum(arealTekst);
    if (arealTekst.trim() && (Number.isNaN(v) || v < 0)) {
      visMelding('Skriv arealet som et tall, for eksempel 3 eller 2,5.');
      return;
    }
    const kopi = [...figRef.current];
    kopi[arealFor] = { ...kopi[arealFor], areal: v };
    sett(kopi);
    setArealFor(null);
  };
  const apneAreal = (i) => {
    const a = figRef.current[i].areal;
    setArealTekst(typeof a === 'number' ? fmtNum(a) : '');
    setArealFor(i);
  };

  const byttFane = (f) => {
    fullforPoly();
    setValgt(null);
    setFane(f);
    sisteFane = f;
    if (f === 'velg') setVerktoy('velg');
    else if (f === 'sikring') setVerktoy('symbol');
    else setVerktoy('frihand');
  };
  const velgSymbol = (s) => {
    fullforPoly();
    setSymbol(s);
    sisteSymbolId = s.id;
    setVerktoy('symbol');
  };

  const visUtkast = () => {
    if (ramme.current) return;
    ramme.current = requestAnimationFrame(() => {
      ramme.current = 0;
      setUtkast(utkastRef.current ? { ...utkastRef.current, punkter: utkastRef.current.punkter && [...utkastRef.current.punkter] } : null);
    });
  };

  // ---------- Fingre og mus ----------
  useEffect(() => {
    const fl = flateRef.current;
    if (!fl || !dim) return undefined;
    const punkt = (x, y) => {
      const r = svgRef.current.getBoundingClientRect();
      const d = tilstand.current.dim;
      return [((x - r.left) / r.width) * d.bredde, ((y - r.top) / r.height) * d.hoyde];
    };
    const bildePerSkjermpunkt = () => tilstand.current.dim.bredde / svgRef.current.getBoundingClientRect().width;
    const iBildet = (p) => {
      const d = tilstand.current.dim;
      return p[0] >= 0 && p[1] >= 0 && p[0] <= d.bredde && p[1] <= d.hoyde;
    };
    const tegningMal = () => ({ ...tilstand.current.dim, symbolSkala: tilstand.current.symbolSkala });

    const trykk = (x, y) => {
      const p = punkt(x, y);
      const { verktoy: v, symbol: s } = tilstand.current;
      if (!iBildet(p)) return;
      if (v === 'symbol' && s) sett([...figRef.current, nySymbolfigur(s, p[0], p[1])]);
      if (v === 'tekst') {
        setTekstPunkt(p);
        setTekst('');
      }
      if (v === 'polygon' && polyRef.current) {
        const q = polyRef.current;
        const forste = q.punkter[0];
        if (q.punkter.length >= 3 && Math.hypot(p[0] - forste[0], p[1] - forste[1]) <= FINGER * bildePerSkjermpunkt()) fullforPoly();
        else settPoly({ ...q, punkter: [...q.punkter, p] });
      }
    };

    const start = (x, y) => {
      const { verktoy: v, farge: fn, tykkelse: tk, valgt: va } = tilstand.current;
      const p = punkt(x, y);
      if (v === 'velg') {
        const radius = FINGER * bildePerSkjermpunkt();
        const fig = va !== null ? figRef.current[va] : null;
        if (fig && fig.type === 'polygon') {
          const h = fig.punkter.findIndex((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= radius);
          if (h >= 0) {
            gest.current = { modus: 'hjorne', i: va, hjorne: h, x, y, flyttet: false, forDra: figRef.current };
            return;
          }
        }
        const i = finnFigur(figRef.current, p, radius, tegningMal());
        if (i >= 0) {
          setValgt(i);
          gest.current = { modus: 'dra', i, x, y, sist: p, flyttet: false, forDra: figRef.current };
        } else {
          gest.current = { modus: 'tom', x, y, zx: zoom.current.x, zy: zoom.current.y, flyttet: false };
        }
        return;
      }
      if (v === 'symbol' || v === 'polygon' || v === 'tekst') {
        gest.current = { modus: 'trykk', x, y, zx: zoom.current.x, zy: zoom.current.y, flyttet: false };
        return;
      }
      if (!iBildet(p)) return;
      gest.current = { modus: 'tegn' };
      const t = (TYKKELSER.find((z) => z[0] === tk) || TYKKELSER[1])[1];
      utkastRef.current = v === 'frihand'
        ? { type: 'frihand', punkter: [p], farge: TEGNEFARGER[fn], tykkelse: t }
        : { type: v, x1: p[0], y1: p[1], x2: p[0], y2: p[1], farge: TEGNEFARGER[fn], tykkelse: t };
      visUtkast();
    };

    const flytt = (x, y) => {
      const g = gest.current;
      if (!g) return;
      if (g.modus === 'tegn') {
        const u = utkastRef.current;
        if (!u) return;
        const p = punkt(x, y);
        if (u.type === 'frihand') {
          const d = tilstand.current.dim;
          const siste = u.punkter[u.punkter.length - 1];
          if (Math.hypot(p[0] - siste[0], p[1] - siste[1]) > Math.max(d.bredde, d.hoyde) * 0.003) u.punkter.push(p);
        } else {
          u.x2 = p[0];
          u.y2 = p[1];
        }
        visUtkast();
        return;
      }
      const langt = Math.hypot(x - g.x, y - g.y) > DRA_GRENSE;
      if (g.modus === 'dra' || g.modus === 'hjorne') {
        if (!g.flyttet && !langt) return;
        if (!g.flyttet) {
          g.flyttet = true;
          historikk.current.push(g.forDra);
          setHarHistorikk(true);
        }
        const p = punkt(x, y);
        const kopi = [...figRef.current];
        if (g.modus === 'dra') {
          kopi[g.i] = flyttetFigur(kopi[g.i], p[0] - g.sist[0], p[1] - g.sist[1]);
          g.sist = p;
        } else {
          const pkt = [...kopi[g.i].punkter];
          pkt[g.hjorne] = p;
          kopi[g.i] = { ...kopi[g.i], punkter: pkt };
        }
        sett(kopi, false);
        return;
      }
      // Trykk eller tom flate: dra flytter bildet når det er zoomet inn
      if (langt) g.flyttet = true;
      if (g.flyttet && zoom.current.s > 1) {
        zoom.current.x = g.zx + x - g.x;
        zoom.current.y = g.zy + y - g.y;
        brukZoom();
      }
    };

    const slutt = (x, y) => {
      const g = gest.current;
      gest.current = null;
      if (!g) return;
      if (g.modus === 'trykk') {
        if (!g.flyttet || zoom.current.s <= 1) trykk(x, y);
      } else if (g.modus === 'tom') {
        if (!g.flyttet) setValgt(null);
      } else if (g.modus === 'tegn') {
        const u = utkastRef.current;
        utkastRef.current = null;
        if (u) {
          const d = tilstand.current.dim;
          const min = Math.max(d.bredde, d.hoyde) * 0.012;
          const ok = u.type === 'frihand' ? u.punkter.length > 1 : Math.hypot(u.x2 - u.x1, u.y2 - u.y1) > min;
          if (ok) sett([...figRef.current, u]);
        }
        setUtkast(null);
      }
    };

    // En finger nummer to avbryter det som var på gang og starter zoom
    const avbrytGest = () => {
      const g = gest.current;
      if (g && g.modus === 'tegn') {
        utkastRef.current = null;
        setUtkast(null);
      }
      if (g && (g.modus === 'dra' || g.modus === 'hjorne') && g.flyttet) {
        historikk.current.pop();
        setHarHistorikk(historikk.current.length > 0);
        sett(g.forDra, false);
      }
    };
    const midt = (e) => {
      const a = e.touches[0];
      const b = e.touches[1];
      const r = fl.getBoundingClientRect();
      return { x: (a.clientX + b.clientX) / 2 - r.left, y: (a.clientY + b.clientY) / 2 - r.top, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1 };
    };
    const startKnip = (e) => {
      avbrytGest();
      const m = midt(e);
      const ra = rammeRef.current;
      const z = zoom.current;
      gest.current = { modus: 'knip', d: m.d, s: z.s, cx: (m.x - ra.offsetLeft - z.x) / z.s, cy: (m.y - ra.offsetTop - z.y) / z.s };
    };
    const knip = (e) => {
      const g = gest.current;
      const m = midt(e);
      const ra = rammeRef.current;
      const z = zoom.current;
      z.s = Math.max(1, Math.min(MAKS_ZOOM, (g.s * m.d) / g.d));
      z.x = m.x - ra.offsetLeft - g.cx * z.s;
      z.y = m.y - ra.offsetTop - g.cy * z.s;
      brukZoom();
    };

    // Berøring (iPhone): stopp rulling og zoom i Safari, siden appen styrer dette selv
    const tStart = (e) => {
      e.preventDefault();
      if (e.touches.length >= 2) {
        if (!gest.current || gest.current.modus !== 'knip') startKnip(e);
        return;
      }
      if (gest.current) return;
      const t = e.touches[0];
      start(t.clientX, t.clientY);
    };
    const tFlytt = (e) => {
      e.preventDefault();
      const g = gest.current;
      if (g && g.modus === 'knip') {
        if (e.touches.length >= 2) knip(e);
        return;
      }
      const t = e.touches[0];
      if (t) flytt(t.clientX, t.clientY);
    };
    const tSlutt = (e) => {
      e.preventDefault();
      if (gest.current && gest.current.modus === 'knip') {
        if (e.touches.length === 0) {
          gest.current = null;
          setZoomVis(zoom.current.s);
        }
        return;
      }
      if (e.touches.length) return;
      const t = e.changedTouches[0];
      if (t) slutt(t.clientX, t.clientY);
    };
    const tAvbrutt = (e) => {
      e.preventDefault();
      avbrytGest();
      gest.current = null;
      setZoomVis(zoom.current.s);
    };
    // Mus og penn
    const pStart = (e) => {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      if (fl.setPointerCapture) fl.setPointerCapture(e.pointerId);
      start(e.clientX, e.clientY);
    };
    const pFlytt = (e) => { if (e.pointerType !== 'touch') flytt(e.clientX, e.clientY); };
    const pSlutt = (e) => { if (e.pointerType !== 'touch') slutt(e.clientX, e.clientY); };
    const hjul = (e) => {
      e.preventDefault();
      const r = fl.getBoundingClientRect();
      zoomRundt(e.clientX - r.left, e.clientY - r.top, zoom.current.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
      setZoomVis(zoom.current.s);
    };
    const opt = { passive: false };
    fl.addEventListener('touchstart', tStart, opt);
    fl.addEventListener('touchmove', tFlytt, opt);
    fl.addEventListener('touchend', tSlutt, opt);
    fl.addEventListener('touchcancel', tAvbrutt, opt);
    fl.addEventListener('pointerdown', pStart);
    fl.addEventListener('pointermove', pFlytt);
    fl.addEventListener('pointerup', pSlutt);
    fl.addEventListener('wheel', hjul, opt);
    return () => {
      fl.removeEventListener('touchstart', tStart, opt);
      fl.removeEventListener('touchmove', tFlytt, opt);
      fl.removeEventListener('touchend', tSlutt, opt);
      fl.removeEventListener('touchcancel', tAvbrutt, opt);
      fl.removeEventListener('pointerdown', pStart);
      fl.removeEventListener('pointermove', pFlytt);
      fl.removeEventListener('pointerup', pSlutt);
      fl.removeEventListener('wheel', hjul, opt);
      if (ramme.current) cancelAnimationFrame(ramme.current);
    };
  }, [dim]);

  // Hindre at siden bak ruller/zoomer mens tegnemodus er åpen
  useEffect(() => {
    const stopp = (e) => { if (e.target.closest && !e.target.closest('.tegne-verktoy, .tegne-tekst, .tegne-topp, .tegne-mengder')) e.preventDefault(); };
    document.addEventListener('touchmove', stopp, { passive: false });
    document.addEventListener('gesturestart', stopp, { passive: false });
    return () => {
      document.removeEventListener('touchmove', stopp, { passive: false });
      document.removeEventListener('gesturestart', stopp, { passive: false });
    };
  }, []);

  const leggTilTekst = () => {
    const t = (TYKKELSER.find((z) => z[0] === tykkelse) || TYKKELSER[1])[1];
    if (tekst.trim()) sett([...figRef.current, { type: 'tekst', x1: tekstPunkt[0], y1: tekstPunkt[1], tekst: tekst.trim(), farge: TEGNEFARGER[farge], tykkelse: t }]);
    setTekstPunkt(null);
  };
  const ferdig = async () => {
    fullforPoly();
    lukket.current = true;
    await lagreEndelig();
    visMelding(figRef.current.length ? 'Tegningen er lagret. Originalbildet er uendret.' : 'Tegningen er fjernet.');
    onLukk();
  };
  const avbryt = async () => {
    const endret = polyRef.current || erEndret();
    if (endret && !(await bekreft('Forkaste endringene i tegningen?', { ok: 'Forkast', fare: true, detalj: 'Tegningen settes tilbake til slik den var da du åpnet den.' }))) return;
    lukket.current = true;
    clearTimeout(lagreTimer.current);
    ulagret.current = false;
    fjernUtkast(foto.id);
    onLukk();
  };
  const tom = async () => {
    if (!figRef.current.length) return;
    if (await bekreft('Fjerne alt du har tegnet på dette bildet?', { ok: 'Fjern alt', fare: true, detalj: 'Du kan angre etterpå. Originalbildet påvirkes ikke.' })) {
      setValgt(null);
      sett([]);
    }
  };
  const slettValgt = () => {
    const kopi = figRef.current.filter((_, i) => i !== valgt);
    setValgt(null);
    sett(kopi);
    visMelding('Figuren er fjernet.', { angre });
  };
  const byttValgtSymbol = (id) => {
    const s = paletten.find((p) => p.id === id);
    if (!s) return;
    const kopi = [...figRef.current];
    const gml = kopi[valgt];
    kopi[valgt] = nySymbolfigur(s, gml.x, gml.y);
    sett(kopi);
  };
  const byttStorrelse = () => {
    const i = SYMBOLSTORRELSER.findIndex((z) => z[1] === symbolSkala);
    setSymbolSkala(SYMBOLSTORRELSER[(i + 1) % SYMBOLSTORRELSER.length][1]);
    planleggLagring();
  };

  const A = lagBygger('app');
  const tegning = dim ? { ...dim, symbolSkala, figurer } : null;
  const valgtFig = valgt !== null ? figurer[valgt] : null;
  const m = tegning ? mengder(tegning) : { bolter: [], annen: [] };
  const antallBolter = m.bolter.reduce((s, b) => s + b.antall, 0);
  const sammendrag = [antallBolter ? `${antallBolter} bolter` : '', ...m.annen.map((a) => annenMengde(a) ? `${a.navn} ${annenMengde(a)}` : a.navn)].filter(Boolean).join(' · ');
  const storrelsNavn = (SYMBOLSTORRELSER.find((z) => z[1] === symbolSkala) || SYMBOLSTORRELSER[1])[0];
  const hjelp = {
    symbol: 'Trykk på bildet der symbolet skal stå.',
    polygon: 'Trykk ett og ett hjørne. Trykk på første hjørne eller Ferdig for å lukke området.',
    velg: 'Trykk på en figur for å velge den, og dra for å flytte. I et valgt område kan du dra hjørnene.',
    frihand: 'Tegn med fingeren.',
    pil: 'Sett fingeren der pilen skal starte, og dra til spissen.',
    sirkel: 'Dra diagonalt over området som skal rammes inn.',
    tekst: 'Trykk der teksten skal stå.',
  }[verktoy];

  // Merking av valgt figur vises bare her og kommer aldri med i rapporter.
  const skala = dim && rammeMal ? dim.bredde / (rammeMal.w * zoomVis) : 1;
  const merking = () => {
    if (!valgtFig) return null;
    if (valgtFig.type === 'polygon') {
      return valgtFig.punkter.map((q) => A('circle', { cx: q[0], cy: q[1], r: 11 * skala, fill: '#ffffff', stroke: '#000000', 'stroke-width': 2 * skala }));
    }
    if (valgtFig.type === 'symbol') {
      return A('circle', { cx: valgtFig.x, cy: valgtFig.y, r: Math.max(26 * skala, symbolBredde(dim.bredde, dim.hoyde, symbolSkala)), fill: 'none', stroke: '#ffffff', 'stroke-width': 3 * skala, 'stroke-dasharray': `${8 * skala} ${6 * skala}` });
    }
    return null;
  };

  return html`<div class="tegnemodus" role="dialog" aria-modal="true">
    <div class="tegne-topp">
      <button class="knapp flat" onClick=${avbryt}>Avbryt</button>
      <strong>Tegn på bildet</strong>
      <button class="knapp primar" onClick=${ferdig} disabled=${!dim}>Ferdig</button>
    </div>
    <div class="tegne-flate" ref=${flateRef}>
      <div class="tegne-ramme" ref=${rammeRef} style=${rammeMal ? { width: rammeMal.w + 'px', height: rammeMal.h + 'px', transform: trans() } : { visibility: 'hidden' }}>
        ${url && html`<img src=${url} alt="" draggable="false" onError=${bildeFeil} onLoad=${(e) => !dim && setDim({ bredde: e.target.naturalWidth, hoyde: e.target.naturalHeight })} />`}
        ${dim && h('svg', { ref: svgRef, class: 'tegne-svg', viewBox: `0 0 ${dim.bredde} ${dim.hoyde}`, preserveAspectRatio: 'none' },
          figurerSvg(A, tegning, utkast),
          poly && polygonSvg(A, { punkter: poly.punkter, stil: poly.def.stil }, strek(dim.bredde, dim.hoyde), true),
          merking())}
      </div>
      ${bildeFeilet && html`<div class="bilde-feil">Bildet kan ikke vises akkurat nå. Det er ikke slettet. Lukk appen helt og åpne den igjen.</div>`}
      ${zoomVis > 1.01 && html`<button class="knapp tegne-zoomknapp" onClick=${nullstillZoom}>Hele bildet</button>`}
    </div>
    ${visMengder && html`<div class="tegne-mengder">
      <div class="rad-kort-topp"><strong>Mengder på dette bildet</strong><button class="knapp flat liten" onClick=${() => setVisMengder(false)}>Lukk ✕</button></div>
      ${!m.bolter.length && !m.annen.length && html`<p class="hjelp">Ingen sikring er tegnet ennå.</p>`}
      ${m.bolter.map((b) => html`<div class="mengde-rad"><${MiniSymbol} fg=${b} /><span>${b.navn}</span><strong>${b.antall} stk</strong></div>`)}
      ${m.annen.map((a) => html`<div class="mengde-rad">${a.stil ? html`<${MiniPolygon} stil=${a.stil} />` : html`<${MiniSymbol} fg=${{ form: a.form, prikker: '0' }} />`}<span>${a.navn}</span><strong>${annenMengde(a)}</strong></div>`)}
    </div>`}
    ${tekstPunkt && html`<div class="tegne-tekst">
      <input ref=${tekstRef} value=${tekst} onInput=${(e) => setTekst(e.target.value)} placeholder="Skriv tekst …"
        onKeyDown=${(e) => e.key === 'Enter' && leggTilTekst()} autocapitalize="sentences" />
      <button class="knapp" onClick=${() => setTekstPunkt(null)}>Avbryt</button>
      <button class="knapp primar" onClick=${leggTilTekst}>Legg til</button>
    </div>`}
    ${arealFor !== null && html`<div class="tegne-tekst">
      <input ref=${arealRef} value=${arealTekst} inputmode="decimal" onInput=${(e) => setArealTekst(e.target.value)} placeholder="Areal i m²"
        aria-label="Areal i kvadratmeter" onKeyDown=${(e) => e.key === 'Enter' && lagreAreal()} />
      <button class="knapp" onClick=${() => setArealFor(null)}>Senere</button>
      <button class="knapp primar" onClick=${lagreAreal}>Lagre</button>
    </div>`}
    <div class="tegne-verktoy">
      <div class="chips kompakt tegne-faner">
        ${[['sikring', '⚑ Sikring'], ['tegn', '✎ Tegn'], ['velg', '✥ Velg']].map(([k, n]) => html`<button class=${'chip' + (fane === k ? ' valgt' : '')} onClick=${() => byttFane(k)}>${n}</button>`)}
      </div>
      ${fane === 'sikring' && !poly && html`<div class="symbol-rad">
        ${paletten.map((s) => {
          const fg = s.lengde !== undefined ? s : { form: s.form, prikker: '0' };
          return html`<button class=${'symbol-knapp' + (verktoy === 'symbol' && symbol && symbol.id === s.id ? ' valgt' : '')} onClick=${() => velgSymbol(s)}>
            <${MiniSymbol} fg=${fg} /><span>${s.lengde !== undefined ? boltNavn(s) : s.navn}</span></button>`;
        })}
        ${annen.filter((a) => a.type === 'polygon').map((a) => html`<button class="symbol-knapp" onClick=${() => startPoly(a)}>
          <${MiniPolygon} stil=${a.stil} /><span>${a.navn}</span></button>`)}
      </div>`}
      ${fane === 'sikring' && poly && html`<div class="tegne-kontekst">
        <span><strong>${poly.def.navn}</strong><br />${poly.punkter.length} hjørner</span>
        <button class="knapp" disabled=${!poly.punkter.length} onClick=${() => settPoly({ ...poly, punkter: poly.punkter.slice(0, -1) })}>↶ Punkt</button>
        <button class="knapp" onClick=${() => settPoly(null)}>Avbryt</button>
        <button class="knapp primar" disabled=${poly.punkter.length < 3} onClick=${fullforPoly}>Ferdig</button>
      </div>`}
      ${fane === 'tegn' && html`
        <div class="chips kompakt">
          ${VERKTOY.map(([k, n]) => html`<button class=${'chip' + (verktoy === k ? ' valgt' : '')} onClick=${() => setVerktoy(k)}>${n}</button>`)}
        </div>
        <div class="chips kompakt">
          ${Object.entries(TEGNEFARGER).map(([n, c]) => html`<button class=${'chip farge-chip' + (farge === n ? ' valgt' : '')} onClick=${() => setFarge(n)}
            aria-label=${n}><span class="fargeprikk" style=${`background:${c}`}></span>${n}</button>`)}
        </div>
        <div class="chips kompakt">
          ${TYKKELSER.map(([n]) => html`<button class=${'chip' + (tykkelse === n ? ' valgt' : '')} onClick=${() => setTykkelse(n)}>${n}</button>`)}
        </div>`}
      ${fane === 'velg' && html`<div class="tegne-kontekst">
        ${!valgtFig && html`<span class="hjelp">Ingen figur er valgt.</span>`}
        ${valgtFig && html`<span><strong>${figurNavn(valgtFig)}</strong>${valgtFig.medAreal ? html`<br />${typeof valgtFig.areal === 'number' ? fmtNum(valgtFig.areal, 1) + ' m²' : 'Mangler areal'}` : ''}</span>`}
        ${valgtFig && valgtFig.type === 'symbol' && html`<select class="tegne-velger" aria-label="Bytt symbol" value=${valgtFig.symbolId} onChange=${(e) => byttValgtSymbol(e.target.value)}>
          ${paletten.map((s) => html`<option value=${s.id}>${s.lengde !== undefined ? boltNavn(s) : s.navn}</option>`)}
        </select>`}
        ${valgtFig && valgtFig.medAreal && html`<button class="knapp" onClick=${() => apneAreal(valgt)}>Areal</button>`}
        ${valgtFig && html`<button class="knapp fare-tekst" onClick=${slettValgt}>Slett</button>`}
      </div>`}
      <div class="knapperad tegne-handling">
        <button class="knapp" disabled=${!harHistorikk} onClick=${angre}>↶ Angre</button>
        <button class="knapp" onClick=${byttStorrelse} aria-label="Bytt symbolstørrelse">Symbol: ${storrelsNavn}</button>
        <button class="knapp fare-tekst" disabled=${!figurer.length} onClick=${tom}>Tøm</button>
      </div>
      <button class="tegne-sum" onClick=${() => setVisMengder(!visMengder)}>Σ ${sammendrag || 'Ingen sikring tegnet'}</button>
      <p class="hjelp">${hjelp} To fingre zoomer. Originalbildet endres ikke.</p>
    </div>
  </div>`;
}
