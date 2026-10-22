// Q-system i observasjonsskjemaet (Tunnel og Tunnelpåhugg). Alt lagres automatisk på observasjonen.
import { html, useState } from '../lib.js';
import { patch } from '../db.js';
import { Seksjon, NumField, Chips, Bryter, TextField } from '../ui.js';
import { beregnQ, fmtQ, Q_PARAMETERE } from '../qsystem.js';
import { fmtNum } from '../util.js';

const FAKTORER = [['Normalt', 1], ['Påhugg (2 × Jn)', 2], ['Kryss (3 × Jn)', 3]];

export function QSeksjon({ o, t, tabell }) {
  const qcfg = t.qsystem || {};
  const q = o.q || {};
  const r = beregnQ(q, tabell, qcfg.jnFaktor || 1);
  const [apen, setApen] = useState(!!o.q);
  const lagre = (sti, v) => patch('observasjoner', o.id, { [`q.${sti}`]: v });

  if (!apen) {
    return html`<${Seksjon} tittel="Q-system">
      <button class="knapp full" onClick=${() => setApen(true)}>+ Registrer Q-verdi</button>
    <//>`;
  }

  const velg = (k, kode) => {
    const p = tabell.parametere[k];
    const opt = (p.valg || []).find((x) => x.kode === kode);
    const gammel = q[k] || {};
    lagre(k, { ...gammel, kode: kode || null, verdi: opt ? opt.verdi : gammel.verdi ?? null });
  };

  return html`<${Seksjon} tittel="Q-system">
    <div class=${'q-resultat ' + (r.klasse ? r.klasse.farge : 'ingen')}>
      ${r.Q !== null
        ? html`<div class="q-verdi">Q = ${fmtQ(r.Q)}</div><div class="q-klasse">${r.klasse ? r.klasse.navn : ''}</div>
          <div class="q-deler">(${fmtNum(r.rqdBrukt, 0)}/${fmtNum(r.jnBrukt, 2)}) · (${fmtNum(r.jr, 2)}/${fmtNum(q.Ja.verdi, 2)}) · (${fmtNum(q.Jw.verdi, 3)}/${fmtNum(q.SRF.verdi, 2)})</div>`
        : html`<div class="q-klasse">Mangler: ${r.mangler.join(', ')}</div>`}
    </div>

    ${Q_PARAMETERE.map((k) => html`<${QParameter} key=${k} k=${k} p=${tabell.parametere[k]} verdi=${q[k] || {}}
      onVelg=${(kode) => velg(k, kode)} onVerdi=${(v) => lagre(k, { ...(q[k] || {}), verdi: v })}
      ekstra=${k === 'Jn'
        ? html`<${Chips} label="Jn-faktor" kompakt options=${FAKTORER.map((x) => x[0])}
            value=${(FAKTORER.find((x) => x[1] === (q.jnFaktor ?? qcfg.jnFaktor ?? 1)) || FAKTORER[0])[0]}
            onChange=${(navn) => navn && lagre('jnFaktor', FAKTORER.find((x) => x[0] === navn)[1])} />`
        : k === 'Jr'
          ? html`<${Bryter} label="+1,0 (midlere sprekkeavstand > 3 m)" value=${!!(q.Jr && q.Jr.pluss1)}
              onChange=${(v) => lagre('Jr', { ...(q.Jr || {}), pluss1: v })} />`
          : null} />`)}

    <${TextField} label="Kommentar til Q-verdien" value=${q.kommentar || ''} onSave=${(v) => lagre('kommentar', v)} />
    <p class="hjelp">Q = (RQD/Jn) · (Jr/Ja) · (Jw/SRF). Tabellene kan kontrolleres og endres i Innstillinger → Felles valglister → Q-system.</p>
  <//>`;
}

function QParameter({ k, p, verdi, onVelg, onVerdi, ekstra }) {
  if (!p) return null;
  const opt = (p.valg || []).find((x) => x.kode === verdi.kode);
  const grupper = [];
  for (const v of p.valg || []) {
    let g = grupper.find((x) => x.navn === (v.gruppe || ''));
    if (!g) grupper.push((g = { navn: v.gruppe || '', valg: [] }));
    g.valg.push(v);
  }
  const vis = (v) => `${v.kode} – ${v.tekst} (${v.min !== undefined ? `${fmtNum(v.min, 3)}–${fmtNum(v.max, 3)}` : fmtNum(v.verdi, 3)})`;
  const min = opt && opt.min !== undefined ? opt.min : p.min;
  const max = opt && opt.max !== undefined ? opt.max : p.max;
  return html`<div class="q-param">
    <div class="q-param-topp"><strong>${p.navn}</strong> <span class="hjelp">${p.beskrivelse || ''}</span></div>
    <div class="q-param-rad">
      <div class="felt">
        <select value=${verdi.kode || ''} onChange=${(e) => onVelg(e.target.value || null)} aria-label=${p.navn + ' – velg fra tabell'}>
          <option value="">— velg fra tabell —</option>
          ${grupper.map((g) => (g.navn
            ? html`<optgroup label=${g.navn}>${g.valg.map((v) => html`<option value=${v.kode}>${vis(v)}</option>`)}</optgroup>`
            : g.valg.map((v) => html`<option value=${v.kode}>${vis(v)}</option>`)))}
        </select>
      </div>
      <${NumField} label=${p.navn} value=${verdi.verdi} onSave=${onVerdi} min=${min} max=${max} klasse="q-tall" />
    </div>
    ${opt && html`<div class="hjelp">${opt.kode}: ${opt.tekst}</div>`}
    ${ekstra}
  </div>`;
}
