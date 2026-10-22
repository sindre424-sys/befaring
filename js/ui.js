// Felles UI-komponenter: felt med autolagring, knapperader, dialoger, meldinger.
import { html, useState, useEffect, useRef } from './lib.js';
import { parseNum, fmtNum } from './util.js';
import { onLagret } from './db.js';

// ---------- Autolagring: alle ventende lagringer kan tvinges ut ----------
const ventende = new Map();
export function flushAll() {
  for (const fn of [...ventende.values()]) {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  }
}

/** Felles logikk for felt som lagrer automatisk etter kort pause, ved blur og ved lukking. */
function useAutolagring(lagre, forsinkelse = 500) {
  const timer = useRef(null);
  const nokkel = useRef({});
  const siste = useRef(null);
  const lagreRef = useRef(lagre);
  lagreRef.current = lagre;

  const flush = () => {
    clearTimeout(timer.current);
    ventende.delete(nokkel.current);
    if (siste.current) {
      const v = siste.current.v;
      siste.current = null;
      lagreRef.current(v);
    }
  };
  const planlegg = (v) => {
    siste.current = { v };
    ventende.set(nokkel.current, flush);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, forsinkelse);
  };
  useEffect(() => () => flush(), []);
  return { planlegg, flush, harVentende: () => !!siste.current };
}

let feltTeller = 0;
const nyFeltId = () => 'f' + ++feltTeller;

// ---------- Tekstfelt ----------
export function TextField({
  label, value, onSave, multiline = false, rows = 3, placeholder = '', autoFocus = false,
  hjelp, type = 'text', klasse = '', autocap = 'sentences',
}) {
  const [lokal, setLokal] = useState(value ?? '');
  const ref = useRef(null);
  const id = useRef(nyFeltId()).current;
  const { planlegg, flush, harVentende } = useAutolagring((v) => {
    if (v !== (value ?? '')) onSave(v);
  });
  useEffect(() => {
    if (document.activeElement !== ref.current && !harVentende()) setLokal(value ?? '');
  }, [value]);
  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      if (multiline) {
        const n = ref.current.value.length;
        ref.current.setSelectionRange(n, n);
      }
    }
  }, [autoFocus]);
  const onInput = (e) => {
    setLokal(e.target.value);
    planlegg(e.target.value);
  };
  useAutoHoyde(ref, lokal, multiline);
  return html`<div class=${'felt ' + klasse}>
    ${label && html`<label for=${id}>${label}</label>`}
    ${multiline
      ? html`<textarea id=${id} ref=${ref} rows=${rows} value=${lokal} placeholder=${placeholder}
          onInput=${onInput} onBlur=${flush} autocapitalize=${autocap}></textarea>`
      : html`<input id=${id} ref=${ref} type=${type} value=${lokal} placeholder=${placeholder}
          onInput=${onInput} onBlur=${flush} autocapitalize=${autocap} autocomplete="off" />`}
    ${hjelp && html`<div class="hjelp">${hjelp}</div>`}
  </div>`;
}

function useAutoHoyde(ref, verdi, aktiv) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !aktiv) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight + 2, 60) + 'px';
  }, [verdi]);
}

// ---------- Tallfelt ----------
/** Tallfelt med numerisk tastatur. Advarer ved urimelige verdier, men blokkerer aldri. */
export function NumField({
  label, value, onSave, enhet, min, max, heltall = false, autoFocus = false, placeholder = '',
  klasse = '', hjelp, ekstraAdvarsel,
}) {
  const [lokal, setLokal] = useState(fmtNum(value, 3));
  const ref = useRef(null);
  const id = useRef(nyFeltId()).current;
  const { planlegg, flush, harVentende } = useAutolagring((tekst) => {
    const n = parseNum(tekst);
    if (Number.isNaN(n)) return; // ugyldig tekst lagres ikke, men står igjen med advarsel
    if (n !== (value ?? null)) onSave(n);
  });
  useEffect(() => {
    if (document.activeElement !== ref.current && !harVentende()) setLokal(fmtNum(value, 3));
  }, [value]);
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);
  const n = parseNum(lokal);
  let advarsel = null;
  if (Number.isNaN(n)) advarsel = 'Ugyldig tall – ikke lagret';
  else if (n !== null) {
    if (min !== undefined && min !== null && n < min) advarsel = `Uvanlig lav verdi (under ${fmtNum(min)})`;
    else if (max !== undefined && max !== null && n > max) advarsel = `Uvanlig høy verdi (over ${fmtNum(max)})`;
    else if (heltall && !Number.isInteger(n)) advarsel = 'Forventet et heltall';
    else if (ekstraAdvarsel) advarsel = ekstraAdvarsel(n);
  }
  return html`<div class=${'felt tall ' + klasse + (advarsel ? ' advar' : '')}>
    ${label && html`<label for=${id}>${label}${enhet ? html` <span class="enhet">[${enhet}]</span>` : ''}</label>`}
    <input id=${id} ref=${ref} type="text" inputmode=${heltall ? 'numeric' : 'decimal'}
      value=${lokal} placeholder=${placeholder} autocomplete="off"
      onInput=${(e) => { setLokal(e.target.value); planlegg(e.target.value); }} onBlur=${flush} />
    ${advarsel && html`<div class="advarsel">⚠︎ ${advarsel}</div>`}
    ${hjelp && !advarsel && html`<div class="hjelp">${hjelp}</div>`}
  </div>`;
}

// ---------- Knapperader (valg) ----------
/** Viser valg som store knapper. Verdier som ikke lenger finnes i listen vises fortsatt. */
export function Chips({ options, value, multi = false, onChange, label, hjelp, kompakt = false }) {
  const valgt = multi ? value || [] : value ? [value] : [];
  const ekstra = valgt.filter((v) => !options.includes(v));
  const trykk = (opt) => {
    if (multi) {
      onChange(valgt.includes(opt) ? valgt.filter((v) => v !== opt) : [...valgt, opt]);
    } else {
      onChange(valgt.includes(opt) ? null : opt);
    }
  };
  return html`<div class="felt">
    ${label && html`<label>${label}</label>`}
    <div class=${'chips' + (kompakt ? ' kompakt' : '')} role="group">
      ${options.map(
        (o) => html`<button type="button" class=${'chip' + (valgt.includes(o) ? ' valgt' : '')}
          aria-pressed=${valgt.includes(o)} onClick=${() => trykk(o)}>${o}</button>`,
      )}
      ${ekstra.map(
        (o) => html`<button type="button" class="chip valgt utenfor" title="Ikke i gjeldende valgliste"
          onClick=${() => trykk(o)}>${o} <small>(ikke i listen)</small></button>`,
      )}
    </div>
    ${hjelp && html`<div class="hjelp">${hjelp}</div>`}
  </div>`;
}

// ---------- Nedtrekksliste ----------
export function Select({ label, value, options, onChange, tomTekst = '— velg —' }) {
  const id = useRef(nyFeltId()).current;
  const opts = [...options];
  const utenfor = value && !opts.includes(value);
  return html`<div class="felt">
    ${label && html`<label for=${id}>${label}</label>`}
    <select id=${id} value=${value || ''} onChange=${(e) => onChange(e.target.value || null)}>
      <option value="">${tomTekst}</option>
      ${opts.map((o) => html`<option value=${o}>${o}</option>`)}
      ${utenfor && html`<option value=${value}>${value} (ikke i listen)</option>`}
    </select>
  </div>`;
}

export function Bryter({ label, value, onChange, hjelp }) {
  return html`<div class="felt bryter-felt">
    <button type="button" class=${'bryter' + (value ? ' paa' : '')} role="switch" aria-checked=${!!value}
      onClick=${() => onChange(!value)}>
      <span class="bryter-tekst">${label}</span>
      <span class="bryter-spor"><span class="bryter-knott"></span></span>
    </button>
    ${hjelp && html`<div class="hjelp">${hjelp}</div>`}
  </div>`;
}

// ---------- Meldinger med «Angre» ----------
let toastSett = null;
export function visMelding(tekst, { angre, ms = angre ? 10000 : 5000 } = {}) {
  if (toastSett) toastSett({ tekst, angre, ms, id: Date.now() });
}
export function MeldingVert() {
  const [m, setM] = useState(null);
  toastSett = setM;
  useEffect(() => {
    if (!m) return;
    const t = setTimeout(() => setM(null), m.ms);
    return () => clearTimeout(t);
  }, [m && m.id]);
  if (!m) return null;
  return html`<div class="toast" role="status">
    <span>${m.tekst}</span>
    ${m.angre && html`<button class="toast-angre" onClick=${() => { const f = m.angre; setM(null); f(); }}>Angre</button>`}
    <button class="toast-lukk" aria-label="Lukk" onClick=${() => setM(null)}>✕</button>
  </div>`;
}

// ---------- Bekreftelsesdialog ----------
let dialogSett = null;
export function bekreft(tekst, { ok = 'OK', avbryt = 'Avbryt', fare = false, detalj } = {}) {
  return new Promise((resolve) => {
    if (!dialogSett) return resolve(window.confirm(tekst));
    dialogSett({ tekst, ok, avbryt, fare, detalj, resolve });
  });
}

// ---------- Ark (bunnpanel) ----------
let arkSett = null;
export function visArk(tittel, innhold) {
  if (arkSett) arkSett({ tittel, innhold });
}
export const lukkArk = () => arkSett && arkSett(null);

export function DialogVert() {
  const [d, setD] = useState(null);
  const [ark, setArk] = useState(null);
  dialogSett = setD;
  arkSett = setArk;
  const svar = (v) => {
    const r = d.resolve;
    setD(null);
    r(v);
  };
  return html`
    ${ark && html`<div class="ark-bakgrunn" onClick=${(e) => e.target === e.currentTarget && setArk(null)}>
      <div class="ark" role="dialog" aria-modal="true">
        <div class="ark-topp"><h2>${ark.tittel}</h2>
          <button class="knapp flat" onClick=${() => setArk(null)}>Lukk</button></div>
        <div class="ark-innhold">${typeof ark.innhold === 'function' ? html`<${ark.innhold} />` : ark.innhold}</div>
      </div></div>`}
    ${d && html`<div class="ark-bakgrunn sentrert">
      <div class="dialog" role="alertdialog" aria-modal="true">
        <p class="dialog-tekst">${d.tekst}</p>
        ${d.detalj && html`<p class="hjelp">${d.detalj}</p>`}
        <div class="dialog-knapper">
          <button class="knapp" onClick=${() => svar(false)}>${d.avbryt}</button>
          <button class=${'knapp ' + (d.fare ? 'fare' : 'primar')} onClick=${() => svar(true)}>${d.ok}</button>
        </div>
      </div></div>`}
  `;
}

// ---------- «Lagret»-indikator ----------
export function LagretIndikator() {
  const [t, setT] = useState(0);
  const [vis, setVis] = useState(false);
  useEffect(() => onLagret((ts) => { setT(ts); setVis(true); }), []);
  useEffect(() => {
    if (!vis) return;
    const h = setTimeout(() => setVis(false), 1500);
    return () => clearTimeout(h);
  }, [t]);
  return html`<span class=${'lagret' + (vis ? ' vis' : '')} aria-live="polite">✓ Lagret</span>`;
}

// ---------- Fokus-triks for iPhone ----------
// iOS åpner bare tastaturet hvis fokus settes direkte i et trykk. Vi fokuserer et skjult felt
// i trykket, og flytter fokus til riktig felt når det er tegnet opp – da blir tastaturet stående.
export function fokusProxy(numerisk = false) {
  const el = document.getElementById('fokus-proxy');
  if (!el) return;
  el.setAttribute('inputmode', numerisk ? 'decimal' : 'text');
  el.value = '';
  el.focus({ preventScroll: true });
  // Sikring: hvis riktig felt ikke tar over fokus, slipp det skjulte feltet så ingen tastetrykk forsvinner.
  setTimeout(() => {
    if (document.activeElement === el) el.blur();
  }, 1500);
}

// ---------- Topptekst ----------
export function Topp({ tittel, tilbake, undertittel, hoyre }) {
  return html`<header class="topp">
    <div class="topp-rad">
      ${tilbake !== undefined && tilbake !== null
        ? html`<a class="topp-tilbake" href=${'#/' + tilbake} aria-label="Tilbake">‹</a>`
        : html`<span class="topp-tilbake tom"></span>`}
      <div class="topp-tittel">
        <h1>${tittel}</h1>
        ${undertittel && html`<div class="topp-under">${undertittel}</div>`}
      </div>
      <div class="topp-hoyre"><${LagretIndikator} />${hoyre}</div>
    </div>
  </header>`;
}

export function Seksjon({ tittel, children, hoyre, id, klasse = '' }) {
  return html`<section class=${'seksjon ' + klasse} id=${id}>
    ${tittel && html`<div class="seksjon-topp"><h2>${tittel}</h2>${hoyre}</div>`}
    ${children}
  </section>`;
}

export function AlvorlighetPrikk({ verdi, stor = false }) {
  return html`<span class=${'prikk ' + (verdi || 'ingen') + (stor ? ' stor' : '')}
    title=${verdi ? { gronn: 'Grønn', gul: 'Gul', rod: 'Rød' }[verdi] : 'Ikke vurdert'}></span>`;
}
