// Ny befaring: 1) prosjekt → 2) objekttype(r) → 3) hodeinfo.
import { html, useState } from '../lib.js';
import { db, useLive, add } from '../db.js';
import { useCtx } from '../config.js';
import { Topp, visMelding } from '../ui.js';
import { TypeIkon } from '../ikoner.js';
import { uid, fmtDatoTid } from '../util.js';
import { go } from '../router.js';

export function NyBefaring() {
  const ctx = useCtx();
  const inn = ctx.config.innstillinger;
  const [steg, setSteg] = useState(1);
  const [prosjektId, setProsjektId] = useState(null);
  const [typer, setTyper] = useState([]);
  const [nyttProsjekt, setNyttProsjekt] = useState(null);
  const [hode, setHode] = useState(null);
  const [start] = useState(Date.now());

  const prosjekter = useLive(async () => {
    const p = (await db.prosjekter.toArray()).filter((x) => !x.slettet);
    const bef = (await db.befaringer.toArray()).filter((x) => !x.slettet);
    const sist = {};
    for (const b of bef) sist[b.prosjektId] = Math.max(sist[b.prosjektId] || 0, b.start);
    return p.sort((a, b) => (sist[b.id] || b.created) - (sist[a.id] || a.created));
  }, [], null);

  const velgProsjekt = async (p) => {
    setProsjektId(p.id);
    const forrige = (await db.befaringer.where('prosjektId').equals(p.id).toArray())
      .filter((b) => !b.slettet).sort((a, b) => b.start - a.start)[0];
    setHode({
      utfortAv: (forrige && forrige.utfortAv) || inn.utfortAv || '',
      deltakere: '',
      omrade: p.standardOmrade || '',
      formal: '',
      vaer: '',
      kommentar: '',
    });
    if (forrige && forrige.objekttyper) setTyper(forrige.objekttyper.filter((t) => ctx.config.typer[t]));
    setSteg(2);
  };

  const opprettProsjekt = async () => {
    if (!nyttProsjekt.navn.trim()) return visMelding('Prosjektet må ha et navn.');
    const p = await add('prosjekter', { id: uid(), ...nyttProsjekt, navn: nyttProsjekt.navn.trim() });
    setNyttProsjekt(null);
    velgProsjekt(p);
  };

  const startBefaring = async () => {
    if (!typer.length) return visMelding('Velg minst én objekttype.');
    const b = await add('befaringer', {
      id: uid(),
      prosjektId,
      objekttyper: typer,
      start,
      slutt: null,
      status: 'pagar',
      ...hode,
    });
    go('befaring/' + b.id, true);
  };

  const sett = (k) => (e) => setHode({ ...hode, [k]: e.target.value });
  const settNP = (k) => (e) => setNyttProsjekt({ ...nyttProsjekt, [k]: e.target.value });

  return html`
    <${Topp} tittel="Ny befaring" undertittel=${`Steg ${steg} av 3`} tilbake="" />
    <main class="innhold med-bunnknapp">
      ${steg === 1 && html`
        <h2 class="steg-tittel">Velg prosjekt</h2>
        ${prosjekter && prosjekter.map((p) => html`<button class="kort valg-kort" onClick=${() => velgProsjekt(p)}>
          <div class="kort-tekst"><div class="kort-tittel">${p.navn}</div>
            <div class="kort-under">${[p.prosjektnummer, p.oppdragsgiver].filter(Boolean).join(' · ')}</div></div>
          <span class="pil">›</span></button>`)}
        ${!nyttProsjekt && html`<button class="knapp stor full" onClick=${() => setNyttProsjekt({ navn: '', prosjektnummer: '', oppdragsgiver: '', standardOmrade: '' })}>+ Nytt prosjekt</button>`}
        ${nyttProsjekt && html`<div class="seksjon">
          <h2>Nytt prosjekt</h2>
          <div class="felt"><label>Prosjektnavn</label><input value=${nyttProsjekt.navn} onInput=${settNP('navn')} autocapitalize="sentences" /></div>
          <div class="felt"><label>Prosjektnummer</label><input value=${nyttProsjekt.prosjektnummer} onInput=${settNP('prosjektnummer')} /></div>
          <div class="felt"><label>Oppdragsgiver/byggherre</label><input value=${nyttProsjekt.oppdragsgiver} onInput=${settNP('oppdragsgiver')} /></div>
          <div class="felt"><label>Standard område</label><input value=${nyttProsjekt.standardOmrade} onInput=${settNP('standardOmrade')} placeholder="F.eks. Tunnelløp A" /></div>
          <div class="knapperad">
            <button class="knapp" onClick=${() => setNyttProsjekt(null)}>Avbryt</button>
            <button class="knapp primar" onClick=${opprettProsjekt}>Opprett og velg</button>
          </div>
        </div>`}
      `}

      ${steg === 2 && html`
        <h2 class="steg-tittel">Hva skal befares?</h2>
        <p class="hjelp">Du kan velge flere.</p>
        <div class="type-valg">
          ${ctx.config.liste.filter((t) => t.aktiv !== false).map((t) => {
            const valgt = typer.includes(t.id);
            return html`<button class=${'type-knapp' + (valgt ? ' valgt' : '')} aria-pressed=${valgt}
              onClick=${() => setTyper(valgt ? typer.filter((x) => x !== t.id) : [...typer, t.id])}>
              <${TypeIkon} ikon=${t.ikon} size=${56} /><span>${t.navn}</span>
              <span class="hake">${valgt ? '✓' : ''}</span></button>`;
          })}
        </div>
      `}

      ${steg === 3 && hode && html`
        <h2 class="steg-tittel">Om befaringen</h2>
        <p class="hjelp">Start: ${fmtDatoTid(start)}</p>
        <div class="felt"><label>Utført av</label><input value=${hode.utfortAv} onInput=${sett('utfortAv')} autocapitalize="words" /></div>
        <div class="felt"><label>Deltakere</label><textarea rows="2" value=${hode.deltakere} onInput=${sett('deltakere')}></textarea></div>
        <div class="felt"><label>Område</label><input value=${hode.omrade} onInput=${sett('omrade')} placeholder="F.eks. Tunnelløp A, Skjæring S3, Påhugg nord" /></div>
        <div class="felt"><label>Formål</label>
          <select value=${hode.formal} onChange=${sett('formal')}>
            <option value="">— velg —</option>
            ${ctx.config.felles.formal.map((f) => html`<option value=${f}>${f}</option>`)}
          </select></div>
        <div class="felt"><label>Vær/forhold</label><input value=${hode.vaer} onInput=${sett('vaer')} /></div>
        <div class="felt"><label>Generell kommentar</label><textarea rows="3" value=${hode.kommentar} onInput=${sett('kommentar')}></textarea></div>
      `}
    </main>
    <div class="bunnlinje">
      ${steg > 1 && html`<button class="knapp stor" onClick=${() => setSteg(steg - 1)}>‹ Tilbake</button>`}
      ${steg === 2 && html`<button class="knapp primar stor full" disabled=${!typer.length} onClick=${() => setSteg(3)}>Neste ›</button>`}
      ${steg === 3 && html`<button class="knapp primar stor full" onClick=${startBefaring}>Start befaring</button>`}
    </div>
  `;
}
