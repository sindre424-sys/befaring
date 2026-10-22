// Tegning på bilder: piler, sirkler/ellipser og tekst. Lagres som vektordata på bildet (foto.tegning),
// slik at originalbildet aldri endres. Ved eksport tegnes figurene inn i en kopi av bildet.
import { html, h, useState, useRef, useEffect } from './lib.js';
import { patch } from './db.js';
import { lagBygger, tilSvgTekst } from './skisser/svg.js';
import { bekreft, visMelding } from './ui.js';

export const TEGNEFARGER = { Rød: '#e03131', Gul: '#ffd43b', Hvit: '#ffffff', Svart: '#111111' };

const strek = (W, H) => Math.max(3, Math.round(Math.max(W, H) * 0.006));
const skrift = (W, H) => Math.max(14, Math.round(Math.max(W, H) * 0.035));

/** Tegner figurene som SVG-elementer (fungerer både i appen og som tekst for eksport). */
export function figurerSvg(S, tegning, ekstra = null) {
  const { bredde: W, hoyde: H } = tegning;
  const sw0 = strek(W, H);
  const fs = skrift(W, H);
  const alle = [...(tegning.figurer || []), ...(ekstra ? [ekstra] : [])];
  return alle.map((fg) => {
    const c = fg.farge || '#e03131';
    const kontrast = c === '#111111' ? '#ffffff' : '#000000';
    const sw = sw0 * (fg.tykkelse || 1);
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

// ---------- Tegnemodus ----------
const VERKTOY = [['frihand', '✎ Frihånd'], ['pil', '➚ Pil'], ['sirkel', '◯ Sirkel'], ['tekst', 'T Tekst']];
const TYKKELSER = [['Tynn', 0.6], ['Middels', 1], ['Tykk', 1.8]];

/**
 * Tegneflate. På iPhone brukes berøringshendelser (touch) direkte, og standardoppførselen (rulling/zoom)
 * stoppes, slik at fingeren kan dra figuren ut uten at Safari avbryter. Mus/penn bruker pekerhendelser.
 */
export function Tegnemodus({ foto, onLukk }) {
  const [url, setUrl] = useState(null);
  const [dim, setDim] = useState(foto.bredde && foto.hoyde ? { bredde: foto.bredde, hoyde: foto.hoyde } : null);
  const [figurer, setFigurer] = useState((foto.tegning && foto.tegning.figurer) || []);
  const [verktoy, setVerktoy] = useState('frihand');
  const [farge, setFarge] = useState('Rød');
  const [tykkelse, setTykkelse] = useState('Middels');
  const [utkast, setUtkast] = useState(null);
  const [tekstPunkt, setTekstPunkt] = useState(null);
  const [tekst, setTekst] = useState('');
  const svgRef = useRef(null);
  const tekstRef = useRef(null);
  // Verdier som de faste lytterne trenger (unngår utdaterte verdier i lukkede funksjoner)
  const tilstand = useRef({});
  tilstand.current = { dim, verktoy, farge, tykkelse };
  const utkastRef = useRef(null);
  const ramme = useRef(0);

  useEffect(() => {
    const u = URL.createObjectURL(foto.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [foto.id]);
  useEffect(() => { if (tekstPunkt && tekstRef.current) tekstRef.current.focus(); }, [tekstPunkt]);

  const visUtkast = () => {
    if (ramme.current) return;
    ramme.current = requestAnimationFrame(() => {
      ramme.current = 0;
      setUtkast(utkastRef.current ? { ...utkastRef.current, punkter: utkastRef.current.punkter && [...utkastRef.current.punkter] } : null);
    });
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el || !dim) return undefined;
    const punkt = (x, y) => {
      const r = el.getBoundingClientRect();
      const d = tilstand.current.dim;
      return [((x - r.left) / r.width) * d.bredde, ((y - r.top) / r.height) * d.hoyde];
    };
    const start = (x, y) => {
      const { verktoy: v, farge: fn, tykkelse: tk } = tilstand.current;
      const [px, py] = punkt(x, y);
      if (v === 'tekst') {
        setTekstPunkt([px, py]);
        setTekst('');
        return;
      }
      const t = (TYKKELSER.find((z) => z[0] === tk) || TYKKELSER[1])[1];
      utkastRef.current = v === 'frihand'
        ? { type: 'frihand', punkter: [[px, py]], farge: TEGNEFARGER[fn], tykkelse: t }
        : { type: v, x1: px, y1: py, x2: px, y2: py, farge: TEGNEFARGER[fn], tykkelse: t };
      visUtkast();
    };
    const flytt = (x, y) => {
      const u = utkastRef.current;
      if (!u) return;
      const [px, py] = punkt(x, y);
      if (u.type === 'frihand') {
        const d = tilstand.current.dim;
        const siste = u.punkter[u.punkter.length - 1];
        if (Math.hypot(px - siste[0], py - siste[1]) > Math.max(d.bredde, d.hoyde) * 0.003) u.punkter.push([px, py]);
      } else {
        u.x2 = px;
        u.y2 = py;
      }
      visUtkast();
    };
    const slutt = () => {
      const u = utkastRef.current;
      utkastRef.current = null;
      if (!u) return;
      const d = tilstand.current.dim;
      const min = Math.max(d.bredde, d.hoyde) * 0.012;
      const ok = u.type === 'frihand' ? u.punkter.length > 1 : Math.hypot(u.x2 - u.x1, u.y2 - u.y1) > min;
      if (ok) setFigurer((f) => [...f, u]);
      setUtkast(null);
    };
    // Berøring (iPhone): stopp rulling og zoom mens det tegnes
    const tStart = (e) => { if (e.touches.length > 1) return; e.preventDefault(); const t = e.touches[0]; start(t.clientX, t.clientY); };
    const tFlytt = (e) => { e.preventDefault(); const t = e.touches[0]; if (t) flytt(t.clientX, t.clientY); };
    const tSlutt = (e) => { e.preventDefault(); slutt(); };
    // Mus og penn
    const pStart = (e) => { if (e.pointerType === 'touch') return; e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); start(e.clientX, e.clientY); };
    const pFlytt = (e) => { if (e.pointerType === 'touch') return; flytt(e.clientX, e.clientY); };
    const pSlutt = (e) => { if (e.pointerType === 'touch') return; slutt(); };
    const opt = { passive: false };
    el.addEventListener('touchstart', tStart, opt);
    el.addEventListener('touchmove', tFlytt, opt);
    el.addEventListener('touchend', tSlutt, opt);
    el.addEventListener('touchcancel', tSlutt, opt);
    el.addEventListener('pointerdown', pStart);
    el.addEventListener('pointermove', pFlytt);
    el.addEventListener('pointerup', pSlutt);
    el.addEventListener('pointercancel', pSlutt);
    return () => {
      el.removeEventListener('touchstart', tStart, opt);
      el.removeEventListener('touchmove', tFlytt, opt);
      el.removeEventListener('touchend', tSlutt, opt);
      el.removeEventListener('touchcancel', tSlutt, opt);
      el.removeEventListener('pointerdown', pStart);
      el.removeEventListener('pointermove', pFlytt);
      el.removeEventListener('pointerup', pSlutt);
      el.removeEventListener('pointercancel', pSlutt);
      if (ramme.current) cancelAnimationFrame(ramme.current);
    };
  }, [dim]);

  // Hindre at siden bak ruller/zoomer mens tegnemodus er åpen
  useEffect(() => {
    const stopp = (e) => { if (e.target.closest && !e.target.closest('.tegne-verktoy, .tegne-tekst, .tegne-topp')) e.preventDefault(); };
    document.addEventListener('touchmove', stopp, { passive: false });
    document.addEventListener('gesturestart', stopp, { passive: false });
    return () => {
      document.removeEventListener('touchmove', stopp, { passive: false });
      document.removeEventListener('gesturestart', stopp, { passive: false });
    };
  }, []);

  const leggTilTekst = () => {
    const t = (TYKKELSER.find((z) => z[0] === tykkelse) || TYKKELSER[1])[1];
    if (tekst.trim()) setFigurer([...figurer, { type: 'tekst', x1: tekstPunkt[0], y1: tekstPunkt[1], tekst: tekst.trim(), farge: TEGNEFARGER[farge], tykkelse: t }]);
    setTekstPunkt(null);
  };
  const lagre = async () => {
    await patch('fotos', foto.id, { tegning: figurer.length ? { versjon: 1, bredde: dim.bredde, hoyde: dim.hoyde, figurer } : null });
    visMelding(figurer.length ? 'Tegningen er lagret. Originalbildet er uendret.' : 'Tegningen er fjernet.');
    onLukk();
  };
  const avbryt = async () => {
    const forrige = (foto.tegning && foto.tegning.figurer) || [];
    if (JSON.stringify(forrige) !== JSON.stringify(figurer)
      && !(await bekreft('Forkaste endringene i tegningen?', { ok: 'Forkast', fare: true }))) return;
    onLukk();
  };
  const tom = async () => {
    if (!figurer.length) return;
    if (await bekreft('Fjerne alt du har tegnet på dette bildet?', { ok: 'Fjern alt', fare: true, detalj: 'Originalbildet påvirkes ikke.' })) setFigurer([]);
  };

  const A = lagBygger('app');
  const hjelp = {
    frihand: 'Tegn med fingeren.',
    pil: 'Sett fingeren der pilen skal starte, og dra til spissen.',
    sirkel: 'Dra diagonalt over området som skal rammes inn.',
    tekst: 'Trykk der teksten skal stå.',
  }[verktoy];
  return html`<div class="tegnemodus" role="dialog" aria-modal="true">
    <div class="tegne-topp">
      <button class="knapp flat" onClick=${avbryt}>Avbryt</button>
      <strong>Tegn på bildet</strong>
      <button class="knapp primar" onClick=${lagre} disabled=${!dim}>Ferdig</button>
    </div>
    <div class="tegne-flate">
      <div class="tegne-ramme">
        ${url && html`<img src=${url} alt="" draggable="false" onLoad=${(e) => !dim && setDim({ bredde: e.target.naturalWidth, hoyde: e.target.naturalHeight })} />`}
        ${dim && h('svg', { ref: svgRef, class: 'tegne-svg', viewBox: `0 0 ${dim.bredde} ${dim.hoyde}`, preserveAspectRatio: 'none' },
          figurerSvg(A, { ...dim, figurer }, utkast))}
      </div>
    </div>
    ${tekstPunkt && html`<div class="tegne-tekst">
      <input ref=${tekstRef} value=${tekst} onInput=${(e) => setTekst(e.target.value)} placeholder="Skriv tekst …"
        onKeyDown=${(e) => e.key === 'Enter' && leggTilTekst()} autocapitalize="sentences" />
      <button class="knapp" onClick=${() => setTekstPunkt(null)}>Avbryt</button>
      <button class="knapp primar" onClick=${leggTilTekst}>Legg til</button>
    </div>`}
    <div class="tegne-verktoy">
      <div class="chips kompakt">
        ${VERKTOY.map(([k, n]) => html`<button class=${'chip' + (verktoy === k ? ' valgt' : '')} onClick=${() => setVerktoy(k)}>${n}</button>`)}
      </div>
      <div class="chips kompakt">
        ${Object.entries(TEGNEFARGER).map(([n, c]) => html`<button class=${'chip farge-chip' + (farge === n ? ' valgt' : '')} onClick=${() => setFarge(n)}
          aria-label=${n}><span class="fargeprikk" style=${`background:${c}`}></span>${n}</button>`)}
      </div>
      <div class="chips kompakt">
        ${TYKKELSER.map(([n]) => html`<button class=${'chip' + (tykkelse === n ? ' valgt' : '')} onClick=${() => setTykkelse(n)}>${n}</button>`)}
      </div>
      <div class="knapperad">
        <button class="knapp" disabled=${!figurer.length} onClick=${() => setFigurer(figurer.slice(0, -1))}>↶ Angre</button>
        <button class="knapp fare-tekst" disabled=${!figurer.length} onClick=${tom}>Tøm</button>
      </div>
      <p class="hjelp">${hjelp} Originalbildet endres ikke.</p>
    </div>
  </div>`;
}
