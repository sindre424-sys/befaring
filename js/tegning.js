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
  const sw = strek(W, H);
  const fs = skrift(W, H);
  const alle = [...(tegning.figurer || []), ...(ekstra ? [ekstra] : [])];
  return alle.map((fg) => {
    const c = fg.farge || '#e03131';
    const kontrast = c === '#111111' ? '#ffffff' : '#000000';
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
      return S('text', {
        x: fg.x1, y: fg.y1, 'font-size': fs, 'font-weight': 700, fill: c, stroke: kontrast, 'stroke-width': Math.max(2, fs * 0.12),
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
const VERKTOY = [['pil', '➚ Pil'], ['sirkel', '◯ Sirkel'], ['tekst', 'T Tekst']];

export function Tegnemodus({ foto, onLukk }) {
  const [url, setUrl] = useState(null);
  const [dim, setDim] = useState(foto.bredde && foto.hoyde ? { bredde: foto.bredde, hoyde: foto.hoyde } : null);
  const [figurer, setFigurer] = useState((foto.tegning && foto.tegning.figurer) || []);
  const [verktoy, setVerktoy] = useState('pil');
  const [farge, setFarge] = useState('Rød');
  const [utkast, setUtkast] = useState(null);
  const [tekstPunkt, setTekstPunkt] = useState(null);
  const [tekst, setTekst] = useState('');
  const svgRef = useRef(null);
  const tekstRef = useRef(null);

  useEffect(() => {
    const u = URL.createObjectURL(foto.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [foto.id]);
  useEffect(() => { if (tekstPunkt && tekstRef.current) tekstRef.current.focus(); }, [tekstPunkt]);

  const punkt = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * dim.bredde, ((e.clientY - r.top) / r.height) * dim.hoyde];
  };
  const ned = (e) => {
    if (!dim) return;
    e.preventDefault();
    const [x, y] = punkt(e);
    if (verktoy === 'tekst') { setTekstPunkt([x, y]); setTekst(''); return; }
    svgRef.current.setPointerCapture && svgRef.current.setPointerCapture(e.pointerId);
    setUtkast({ type: verktoy, x1: x, y1: y, x2: x, y2: y, farge: TEGNEFARGER[farge] });
  };
  const flytt = (e) => {
    if (!utkast) return;
    e.preventDefault();
    const [x, y] = punkt(e);
    setUtkast({ ...utkast, x2: x, y2: y });
  };
  const opp = () => {
    if (!utkast) return;
    const l = Math.hypot(utkast.x2 - utkast.x1, utkast.y2 - utkast.y1);
    if (l > Math.max(dim.bredde, dim.hoyde) * 0.015) setFigurer([...figurer, utkast]);
    setUtkast(null);
  };
  const leggTilTekst = () => {
    if (tekst.trim()) setFigurer([...figurer, { type: 'tekst', x1: tekstPunkt[0], y1: tekstPunkt[1], tekst: tekst.trim(), farge: TEGNEFARGER[farge] }]);
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
  return html`<div class="tegnemodus" role="dialog" aria-modal="true">
    <div class="tegne-topp">
      <button class="knapp flat" onClick=${avbryt}>Avbryt</button>
      <strong>Tegn på bildet</strong>
      <button class="knapp primar" onClick=${lagre} disabled=${!dim}>Ferdig</button>
    </div>
    <div class="tegne-flate">
      <div class="tegne-ramme">
        ${url && html`<img src=${url} alt="" onLoad=${(e) => !dim && setDim({ bredde: e.target.naturalWidth, hoyde: e.target.naturalHeight })} />`}
        ${dim && h('svg', {
          ref: svgRef, class: 'tegne-svg', viewBox: `0 0 ${dim.bredde} ${dim.hoyde}`, preserveAspectRatio: 'none',
          onPointerDown: ned, onPointerMove: flytt, onPointerUp: opp, onPointerCancel: opp,
        }, figurerSvg(A, { ...dim, figurer }, utkast))}
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
      <div class="knapperad">
        <button class="knapp" disabled=${!figurer.length} onClick=${() => setFigurer(figurer.slice(0, -1))}>↶ Angre</button>
        <button class="knapp fare-tekst" disabled=${!figurer.length} onClick=${tom}>Tøm</button>
      </div>
      <p class="hjelp">${verktoy === 'tekst' ? 'Trykk der teksten skal stå.' : 'Dra med fingeren for å tegne.'} Originalbildet endres ikke.</p>
    </div>
  </div>`;
}
