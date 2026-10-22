// Redigering av konfigurasjon per objekttype og felles valglister.
// Endringer her sletter aldri registrerte data: verdier som fjernes fra en liste
// blir stående på observasjonene og vises som «(ikke i listen)».
import { html, useState } from '../lib.js';
import { useCtx, lagreType, tilbakestillType, lagreFelles, tilbakestillFelles, standardConfig } from '../config.js';
import { Topp, Seksjon, TextField, NumField, Bryter, Chips, visMelding, bekreft } from '../ui.js';
import { TypeIkon, IKON_VALG } from '../ikoner.js';
import { slug } from '../util.js';

/** Liste med tekstverdier: endre, flytte, slette (med angre), legge til. */
function ListeRedigerer({ liste, onChange, nyTekst = 'Nytt valg' }) {
  const [fokusIndeks, setFokus] = useState(null);
  const flytt = (i, d) => {
    const ny = [...liste];
    const [x] = ny.splice(i, 1);
    ny.splice(i + d, 0, x);
    onChange(ny);
  };
  const slett = (i) => {
    const gammel = [...liste];
    onChange(liste.filter((_, j) => j !== i));
    visMelding(`«${liste[i]}» fjernet fra listen. Registrerte data beholdes.`, { angre: () => onChange(gammel) });
  };
  return html`<div class="liste-red">
    ${liste.map((v, i) => html`<div class="liste-rad" key=${i + ':' + liste.length}>
      <${TextField} value=${v} autoFocus=${fokusIndeks === i}
        onSave=${(nv) => { const ny = [...liste]; ny[i] = nv; onChange(ny); }} />
      <button class="knapp flat liten" disabled=${i === 0} aria-label="Flytt opp" onClick=${() => flytt(i, -1)}>▲</button>
      <button class="knapp flat liten" disabled=${i === liste.length - 1} aria-label="Flytt ned" onClick=${() => flytt(i, 1)}>▼</button>
      <button class="knapp flat liten fare-tekst" aria-label="Fjern" onClick=${() => slett(i)}>✕</button>
    </div>`)}
    <button class="knapp full" onClick=${() => { setFokus(liste.length); onChange([...liste, nyTekst]); }}>+ Legg til</button>
  </div>`;
}

/** Liste med objekter (f.eks. måletyper) der hver rad har flere felt. */
function ObjektListe({ liste, felt, onChange, ny, tittel }) {
  const endre = (i, k, v) => {
    const kopi = liste.map((x) => ({ ...x }));
    kopi[i][k] = v;
    onChange(kopi);
  };
  const flytt = (i, d) => {
    const kopi = [...liste];
    const [x] = kopi.splice(i, 1);
    kopi.splice(i + d, 0, x);
    onChange(kopi);
  };
  const slett = (i) => {
    const gammel = [...liste];
    onChange(liste.filter((_, j) => j !== i));
    visMelding(`«${liste[i][tittel]}» fjernet. Registrerte data beholdes.`, { angre: () => onChange(gammel) });
  };
  return html`<div class="liste-red">
    ${liste.map((x, i) => html`<div class="rad-kort" key=${i + ':' + liste.length}>
      <div class="rad-kort-topp"><strong>${x[tittel] || '(uten navn)'}</strong>
        <span>
          <button class="knapp flat liten" disabled=${i === 0} onClick=${() => flytt(i, -1)}>▲</button>
          <button class="knapp flat liten" disabled=${i === liste.length - 1} onClick=${() => flytt(i, 1)}>▼</button>
          <button class="knapp flat liten fare-tekst" onClick=${() => slett(i)}>✕</button>
        </span></div>
      <div class="rad2">
        ${felt.map((f) => {
          if (f.type === 'tall') return html`<${NumField} label=${f.navn} value=${x[f.id]} onSave=${(v) => endre(i, f.id, v)} />`;
          if (f.type === 'valg') return html`<${Chips} label=${f.navn} options=${f.valg} value=${x[f.id]} kompakt onChange=${(v) => endre(i, f.id, v)} />`;
          if (f.type === 'bryter') return html`<${Bryter} label=${f.navn} value=${!!x[f.id]} onChange=${(v) => endre(i, f.id, v)} />`;
          if (f.type === 'liste') return html`<${TextField} label=${f.navn} value=${(x[f.id] || []).join(', ')} hjelp="Skill valgene med komma"
            onSave=${(v) => endre(i, f.id, v.split(',').map((s) => s.trim()).filter(Boolean))} />`;
          return html`<${TextField} label=${f.navn} value=${x[f.id]} onSave=${(v) => endre(i, f.id, v)} />`;
        })}
      </div>
    </div>`)}
    <button class="knapp full" onClick=${() => onChange([...liste, ny()])}>+ Legg til</button>
  </div>`;
}

function JsonRedigerer({ verdi, onBruk }) {
  const [apen, setApen] = useState(false);
  const [tekst, setTekst] = useState('');
  const [feil, setFeil] = useState(null);
  if (!apen) {
    return html`<button class="knapp" onClick=${() => { setTekst(JSON.stringify(verdi, null, 2)); setFeil(null); setApen(true); }}>Vis/rediger som JSON</button>`;
  }
  return html`<div>
    <textarea class="json" rows="18" value=${tekst} spellcheck="false" autocapitalize="none" onInput=${(e) => setTekst(e.target.value)}></textarea>
    ${feil && html`<div class="advarsel">⚠︎ ${feil}</div>`}
    <div class="knapperad">
      <button class="knapp" onClick=${() => setApen(false)}>Lukk</button>
      <button class="knapp primar" onClick=${async () => {
        try {
          const obj = JSON.parse(tekst);
          if (typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Må være et JSON-objekt { … }');
          await onBruk(obj);
          setApen(false);
          visMelding('Konfigurasjonen er oppdatert.');
        } catch (e) {
          setFeil('Ugyldig JSON: ' + e.message);
        }
      }}>Bruk endringene</button>
    </div>
  </div>`;
}

export function TypeRedigerer({ id }) {
  const ctx = useCtx();
  const t = ctx.config.typer[id];
  if (!t) return html`<${Topp} tittel="Objekttype" tilbake="innstillinger" /><main class="innhold"><p>Finner ikke objekttypen.</p></main>`;
  const lagre = (k) => (v) => lagreType({ ...t, [k]: v });
  const harStandard = !!standardConfig().typer[id];

  return html`
    <${Topp} tittel=${t.navn} undertittel="Objekttype" tilbake="innstillinger" />
    <main class="innhold">
      <${Seksjon} tittel="Generelt">
        <${TextField} label="Navn" value=${t.navn} onSave=${lagre('navn')} />
        <${TextField} label="Kortnavn (på kort og knapper)" value=${t.kortnavn} onSave=${lagre('kortnavn')} />
        <div class="felt"><label>Ikon</label>
          <div class="chips">
            ${IKON_VALG.map((k) => html`<button class=${'chip' + (t.ikon === k ? ' valgt' : '')} onClick=${() => lagreType({ ...t, ikon: k })}><${TypeIkon} ikon=${k} size=${28} /></button>`)}
          </div></div>
        <${TextField} label="…eller en emoji som ikon" value=${IKON_VALG.includes(t.ikon) ? '' : t.ikon} onSave=${(v) => v && lagreType({ ...t, ikon: v })} />
        <${Bryter} label="Vises ved ny befaring" value=${t.aktiv !== false} onChange=${lagre('aktiv')}
          hjelp="Skjulte typer vises fortsatt på befaringer som allerede bruker dem." />
        <${NumField} label="Rekkefølge i rapport" value=${t.rekkefolge} onSave=${lagre('rekkefolge')} heltall />
        <${Bryter} label="Har «profil til»" value=${t.profil.til !== false} onChange=${(v) => lagreType({ ...t, profil: { ...t.profil, til: v } })} />
      <//>

      <${Seksjon} tittel="Stedsfelt">
        <p class="hjelp">Ekstra felt under «Sted», f.eks. side eller pall. Type: valg, tall, heltall eller tekst.</p>
        <${ObjektListe} liste=${t.stedsfelt} tittel="navn" onChange=${lagre('stedsfelt')}
          ny=${() => ({ id: 'felt-' + Date.now().toString(36), navn: 'Nytt felt', type: 'tekst' })}
          felt=${[
            { id: 'navn', navn: 'Navn' },
            { id: 'type', navn: 'Type', type: 'valg', valg: ['valg', 'tall', 'heltall', 'tekst'] },
            { id: 'valg', navn: 'Valg (for type «valg»)', type: 'liste' },
            { id: 'hjelp', navn: 'Hjelpetekst' },
          ]} />
      <//>

      <${Seksjon} tittel="Posisjoner"><${ListeRedigerer} liste=${t.posisjoner} onChange=${lagre('posisjoner')} /><//>
      <${Seksjon} tittel="Observasjonstyper"><${ListeRedigerer} liste=${t.observasjonstyper} onChange=${lagre('observasjonstyper')} /><//>
      <${Seksjon} tittel="Status / utført"><${ListeRedigerer} liste=${t.status} onChange=${lagre('status')} /><//>

      <${Seksjon} tittel="Måletyper">
        <p class="hjelp">Min/maks gir bare en advarsel – verdien lagres uansett.</p>
        <${ObjektListe} liste=${t.maletyper} tittel="navn" onChange=${lagre('maletyper')}
          ny=${() => ({ navn: 'Ny måletype', enhet: '', gruppe: 'Annet' })}
          felt=${[
            { id: 'navn', navn: 'Navn' },
            { id: 'enhet', navn: 'Enhet' },
            { id: 'gruppe', navn: 'Gruppe' },
            { id: 'min', navn: 'Min', type: 'tall' },
            { id: 'max', navn: 'Maks', type: 'tall' },
            { id: 'heltall', navn: 'Heltall', type: 'bryter' },
          ]} />
      <//>

      <${Seksjon} tittel="Avansert">
        <p class="hjelp">Hele oppsettet som JSON. Her kan du også styre skjæringsgeometri og skisser.</p>
        <${JsonRedigerer} verdi=${(({ endret, egen, ...r }) => r)(t)} onBruk=${(obj) => lagreType({ ...obj, id })} />
        ${harStandard && t.endret && html`<button class="knapp fare-tekst" onClick=${async () => {
          if (!(await bekreft(`Tilbakestille ${t.navn} til standardoppsettet?`, { ok: 'Tilbakestill', fare: true, detalj: 'Dine endringer i valglistene forsvinner. Registrerte data beholdes.' }))) return;
          const gammel = { ...t };
          await tilbakestillType(id);
          visMelding('Tilbakestilt.', { angre: () => lagreType(gammel) });
        }}>Tilbakestill til standard</button>`}
      <//>
    </main>
  `;
}

export function FellesRedigerer() {
  const ctx = useCtx();
  const f = ctx.config.felles;
  const lagre = (k) => (v) => lagreFelles({ ...f, [k]: v });
  return html`
    <${Topp} tittel="Felles valglister" tilbake="innstillinger" />
    <main class="innhold">
      <${Seksjon} tittel="Formål"><${ListeRedigerer} liste=${f.formal} onChange=${lagre('formal')} /><//>
      <${Seksjon} tittel="Vurderinger">
        <p class="hjelp">Alvorligheten foreslås automatisk når vurderingen velges, men kan alltid overstyres.</p>
        <${ObjektListe} liste=${f.vurderinger} tittel="navn" onChange=${lagre('vurderinger')}
          ny=${() => ({ navn: 'Ny vurdering', alvorlighet: 'gul' })}
          felt=${[{ id: 'navn', navn: 'Navn' }, { id: 'alvorlighet', navn: 'Alvorlighet', type: 'valg', valg: ['gronn', 'gul', 'rod'] }]} />
      <//>
      <${Seksjon} tittel="Hurtignavn for sprekkesett"><${ListeRedigerer} liste=${f.sprekkesettnavn} onChange=${lagre('sprekkesettnavn')} /><//>
      <${Seksjon} tittel="Avansert">
        <${JsonRedigerer} verdi=${f} onBruk=${lagreFelles} />
        ${ctx.config.fellesEndret && html`<button class="knapp fare-tekst" onClick=${async () => {
          if (!(await bekreft('Tilbakestille felles valglister?', { ok: 'Tilbakestill', fare: true }))) return;
          const gammel = { ...f };
          await tilbakestillFelles();
          visMelding('Tilbakestilt.', { angre: () => lagreFelles(gammel) });
        }}>Tilbakestill til standard</button>`}
      <//>
    </main>
  `;
}
