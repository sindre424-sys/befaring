import { html, useState, useEffect } from '../lib.js';
import { db, useLive, lagringsInfo } from '../db.js';
import { useCtx, typeCfg } from '../config.js';
import { Topp, AlvorlighetPrikk } from '../ui.js';
import { TypeIkon } from '../ikoner.js';
import { fmtDato, fmtTid, isStandalone, erPc } from '../util.js';
import { trengerSikkerhetskopi } from '../sikkerhetskopi.js';
import { HentFil } from './eksport.js';
import { stottes, useArbeidsmappe, giTilgang } from '../arbeidsmappe.js';

export function Start() {
  const ctx = useCtx();
  const data = useLive(async () => {
    const bef = (await db.befaringer.toArray()).filter((b) => !b.slettet).sort((a, b) => b.start - a.start);
    const prosj = Object.fromEntries((await db.prosjekter.toArray()).map((p) => [p.id, p]));
    const obs = (await db.observasjoner.toArray()).filter((o) => !o.slettet);
    const stat = {};
    for (const o of obs) {
      const s = (stat[o.befaringId] ||= { antall: 0, gronn: 0, gul: 0, rod: 0 });
      s.antall++;
      if (o.alvorlighet) s[o.alvorlighet]++;
    }
    return { bef, prosj, stat };
  }, []);

  const [lagring, setLagring] = useState(null);
  const [kopi, setKopi] = useState(null);
  useEffect(() => { lagringsInfo().then(setLagring); trengerSikkerhetskopi().then(setKopi); }, []);
  const standalone = isStandalone();
  const pc = erPc();
  const mappe = useArbeidsmappe();

  return html`
    <${Topp} tittel="Befaringer" hoyre=${html`<a class="knapp flat ikonknapp" href="#/innstillinger" aria-label="Innstillinger">⚙︎</a>`} />
    <main class="innhold med-bunnknapp">
      ${!standalone && !pc && html`<div class="info-boks">
        <strong>Installer appen:</strong> Trykk Del-knappen i Safari → «Legg til på Hjem-skjerm».
        Åpne alltid appen fra ikonet. Safari og den installerte appen har hver sin lagring.
      </div>`}
      ${pc && html`<section class="seksjon pc-hent">
        <div class="pc-hent-tekst"><h2>Hent fra telefon</h2>
          <p class="hjelp">På telefonen: åpne befaringen → Eksport → Send til PC, og lagre filen i OneDrive. Velg den her.</p></div>
        <div class="pc-hent-knapp"><${HentFil} tekst="Hent fil …" stor /></div>
      </section>`}
      ${pc && stottes() && mappe.status === 'av' && html`<a class="info-boks advar blokk-lenke" href="#/innstillinger">
        <strong>Velg arbeidsmappe:</strong> Data i nettleseren kan bli slettet. Gå til Innstillinger → Arbeidsmappe.</a>`}
      ${mappe.status === 'trengerTilgang' && html`<div class="info-boks advar">
        Chrome må få tilgang til arbeidsmappen «${mappe.navn}» igjen før endringer kan lagres der.
        ${' '}<button class="lenke" onClick=${giTilgang}>Gi tilgang</button></div>`}
      ${mappe.status === 'feil' && html`<a class="info-boks advar blokk-lenke" href="#/innstillinger">Kunne ikke lagre til arbeidsmappen. Trykk her for detaljer.</a>`}
      ${standalone && lagring && lagring.persistent === false && html`<div class="info-boks advar">
        Lagringen er ikke markert som vedvarende. Gå til Innstillinger → Lagring.
      </div>`}
      ${kopi && html`<a class="info-boks advar blokk-lenke" href="#/innstillinger">
        <strong>💾 Ta sikkerhetskopi:</strong>${' '}${kopi.dager === null ? 'Du har ikke tatt sikkerhetskopi ennå.' : `Det er ${kopi.dager} dager siden siste sikkerhetskopi.`}${' '}Trykk her → Sikkerhetskopi.
      </a>`}
      ${!data && html`<p class="hjelp">Laster …</p>`}
      ${data && data.bef.length === 0 && html`<div class="tom">
        <p><strong>Ingen befaringer ennå.</strong></p>
        <p class="hjelp">Trykk «Ny befaring» for å starte. Vil du se hvordan appen ser ut med data,
          kan du laste inn testdata under <a href="#/innstillinger">Innstillinger</a>.</p>
      </div>`}
      ${data && data.bef.map((b) => {
        const p = data.prosj[b.prosjektId];
        const s = data.stat[b.id] || { antall: 0, gronn: 0, gul: 0, rod: 0 };
        return html`<a class="kort befaring-kort" href=${'#/befaring/' + b.id}>
          <div class="kort-ikoner">${(b.objekttyper || []).map((t) => html`<${TypeIkon} ikon=${typeCfg(ctx, t).ikon} size=${30} />`)}</div>
          <div class="kort-tekst">
            <div class="kort-tittel">${fmtDato(b.start)} · ${b.omrade || 'Uten område'}</div>
            <div class="kort-under">${p ? p.navn : 'Uten prosjekt'}${p && p.prosjektnummer ? ` (${p.prosjektnummer})` : ''}</div>
            <div class="kort-under">
              <span class=${'merke ' + (b.status === 'avsluttet' ? 'avsluttet' : 'pagar')}>${b.status === 'avsluttet' ? 'Avsluttet' : 'Pågår'}</span>
              ${' '}${s.antall} obs. · start ${fmtTid(b.start)}
              ${s.rod ? html` · <${AlvorlighetPrikk} verdi="rod" />${s.rod}` : ''}
              ${s.gul ? html` · <${AlvorlighetPrikk} verdi="gul" />${s.gul}` : ''}
              ${s.gronn ? html` · <${AlvorlighetPrikk} verdi="gronn" />${s.gronn}` : ''}
              ${b.test ? html` · <span class="merke test">Testdata</span>` : ''}
            </div>
          </div>
          <span class="pil">›</span>
        </a>`;
      })}
    </main>
    <div class="bunnlinje">
      <a class="knapp primar stor full" href="#/ny">+ Ny befaring</a>
    </div>
  `;
}
