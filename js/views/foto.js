// Bilder i observasjonsskjemaet: ta bilde, hent fra Bilder, kommentar og visning i full størrelse.
import { html, useState, useRef } from '../lib.js';
import { useLive, patch, softDelete, restore } from '../db.js';
import { Seksjon, TextField, visMelding, flushAll, bekreft } from '../ui.js';
import { lagreFoto, hentFotos, stedForFoto, Miniatyr, FulltBilde } from '../bilder.js';
import { fmtDatoTid } from '../util.js';
import { Tegnemodus } from '../tegning.js';

export function FotoSeksjon({ o }) {
  const fotos = useLive(() => hentFotos(o.id), [o.id], []);
  const [sisteId, setSisteId] = useState(null);
  const [behandler, setBehandler] = useState(0);
  const [visIndeks, setVisIndeks] = useState(null);
  const kamera = useRef(null);
  const bibliotek = useRef(null);

  const apne = (ref) => {
    flushAll(); // lagre alt før kameraet åpnes – iPhone kan lukke appen i bakgrunnen
    ref.current.value = '';
    ref.current.click();
  };

  const mottaFiler = async (e, fraKamera) => {
    const filer = [...(e.target.files || [])];
    e.target.value = '';
    if (!filer.length) return;
    setBehandler((n) => n + filer.length);
    let sist = null;
    for (const fil of filer) {
      try {
        sist = await lagreFoto(fil, o, fraKamera);
      } catch (err) {
        console.error(err);
        visMelding('Kunne ikke lagre bildet: ' + err.message);
      } finally {
        setBehandler((n) => n - 1);
      }
    }
    if (sist) {
      setSisteId(sist.id);
      if (filer.length > 1) visMelding(`${filer.length} bilder lagt til.`);
    }
  };

  const slett = async (f) => {
    if (!(await bekreft('Flytte bildet til papirkurven?', { ok: 'Flytt til papirkurv', fare: true, detalj: 'Du kan angre eller gjenopprette fra papirkurven.' }))) return;
    await softDelete('fotos', f.id);
    if (sisteId === f.id) setSisteId(null);
    visMelding('Bildet er flyttet til papirkurven.', { angre: () => restore('fotos', f.id) });
  };

  const siste = sisteId ? fotos.find((f) => f.id === sisteId) : null;
  const ovrige = fotos.filter((f) => f.id !== sisteId);
  const standardSted = stedForFoto(o);

  return html`<${Seksjon} tittel=${`Bilder (${fotos.length})`}>
    <input ref=${kamera} type="file" accept="image/*" capture="environment" hidden onChange=${(e) => mottaFiler(e, true)} />
    <input ref=${bibliotek} type="file" accept="image/*" multiple hidden onChange=${(e) => mottaFiler(e, false)} />

    ${behandler > 0 && html`<div class="info-boks">Lagrer bilde … (${behandler})</div>`}

    ${siste && html`<div class="siste-bilde">
      <div class="siste-topp">
        <${Miniatyr} foto=${siste} klasse="miniatyr stor" onClick=${() => setVisIndeks(fotos.indexOf(siste))} />
        <div class="siste-tekst">
          <strong>✓ Bilde lagret</strong>
          <div class="hjelp">${standardSted}</div>
        </div>
      </div>
      <${TextField} label="Kommentar til bildet" value=${siste.kommentar} onSave=${(v) => patch('fotos', siste.id, { kommentar: v })} />
      <div class="knapperad">
        <button class="knapp" onClick=${() => setSisteId(null)}>Ferdig</button>
        <button class="knapp primar stor" onClick=${() => apne(kamera)}>📷 Ta nytt bilde</button>
      </div>
    </div>`}

    ${!siste && html`<div class="knapperad">
      <button class="knapp primar stor" onClick=${() => apne(kamera)}>📷 Ta bilde</button>
      <button class="knapp stor" onClick=${() => apne(bibliotek)}>🖼 Fra Bilder</button>
    </div>`}

    ${ovrige.map((f) => html`<${FotoKort} key=${f.id} f=${f} standardSted=${standardSted}
      onVis=${() => setVisIndeks(fotos.indexOf(f))} onSlett=${() => slett(f)} />`)}

    ${siste && html`<button class="knapp full" onClick=${() => apne(bibliotek)}>🖼 Legg til fra Bilder</button>`}
    <p class="hjelp">Bilder tatt med «Ta bilde» lagres bare i appen, ikke i Bilder-appen. De lagres i maks 2000 px.</p>

    ${visIndeks !== null && fotos[visIndeks] && html`<${Visning} fotos=${fotos} indeks=${visIndeks}
      standardSted=${standardSted} onBytt=${setVisIndeks} onLukk=${() => setVisIndeks(null)} />`}
  <//>`;
}

function FotoKort({ f, standardSted, onVis, onSlett }) {
  const [endreSted, setEndreSted] = useState(false);
  return html`<div class="foto-kort">
    <div class="foto-rad">
      <${Miniatyr} foto=${f} onClick=${onVis} />
      <div class="foto-felt">
        <${TextField} label="Kommentar" value=${f.kommentar} onSave=${(v) => patch('fotos', f.id, { kommentar: v })} multiline rows=${2} />
      </div>
    </div>
    ${endreSted
      ? html`<${TextField} label="Sted/profil (tomt = følger observasjonen)" value=${f.sted || ''} placeholder=${standardSted} autoFocus
          onSave=${(v) => patch('fotos', f.id, { sted: v.trim() ? v : null })} />`
      : html`<button class="foto-sted" onClick=${() => setEndreSted(true)}>
          📍 ${f.sted || standardSted}${f.sted ? '' : html` <span class="hjelp">(auto)</span>`} <span class="lenke">Endre</span>
        </button>`}
    <div class="foto-bunn">
      <span class="hjelp">${fmtDatoTid(f.tid)}${f.gps ? ' · GPS ✓' : ''}${f.komprimert === false ? ' · original' : ''}</span>
      <button class="knapp flat liten fare-tekst" aria-label="Slett bilde" onClick=${onSlett}>✕ Slett</button>
    </div>
  </div>`;
}

function Visning({ fotos, indeks, standardSted, onBytt, onLukk }) {
  const f = fotos[indeks];
  const [tegner, setTegner] = useState(false);
  if (tegner) return html`<${Tegnemodus} foto=${f} onLukk=${() => setTegner(false)} />`;
  return html`<div class="visning" role="dialog" aria-modal="true">
    <div class="visning-topp">
      <span>${indeks + 1} / ${fotos.length}</span>
      <button class="knapp flat" onClick=${() => setTegner(true)}>✏️ Tegn</button>
      <button class="knapp flat" onClick=${onLukk}>Lukk ✕</button>
    </div>
    <div class="visning-bilde"><${FulltBilde} foto=${f} /></div>
    <div class="visning-tekst">
      <div>${f.sted || standardSted}</div>
      ${f.kommentar && html`<div class="hjelp">${f.kommentar}</div>`}
    </div>
    <div class="visning-knapper">
      <button class="knapp stor" disabled=${indeks === 0} onClick=${() => onBytt(indeks - 1)}>‹ Forrige</button>
      <button class="knapp stor" disabled=${indeks === fotos.length - 1} onClick=${() => onBytt(indeks + 1)}>Neste ›</button>
    </div>
  </div>`;
}
