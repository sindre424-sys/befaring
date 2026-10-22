// Innstillinger: generelt, objekttyper, felles valglister, prosjekter, papirkurv, lagring, testdata.
import { html, useState, useEffect } from '../lib.js';
import { setInnstilling, lagringsInfo, bePersistent } from '../db.js';
import { useCtx, nyType } from '../config.js';
import { Topp, Seksjon, TextField, NumField, Chips, Bryter, visMelding, bekreft, visArk, lukkArk } from '../ui.js';
import { TypeIkon } from '../ikoner.js';
import { go } from '../router.js';
import { lastInnTestdata, fjernTestdata, harTestdata } from '../testdata.js';
import { APP_VERSJON } from '../versjon.js';
import { SikkerhetskopiPanel } from './eksport.js';

const MB = (b) => (b === null || b === undefined ? '?' : (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB');

export function Innstillinger() {
  const ctx = useCtx();
  const inn = ctx.config.innstillinger;
  const sett = (k) => (v) => setInnstilling(k, v);
  const [lagring, setLagring] = useState(null);
  const [test, setTest] = useState(null);
  const oppdaterInfo = () => { lagringsInfo().then(setLagring); harTestdata().then(setTest); };
  useEffect(oppdaterInfo, []);

  const lagNyType = () => {
    let navn = '';
    visArk('Ny objekttype', () => html`<div>
      <div class="felt"><label>Navn</label><input placeholder="F.eks. Byggegrop" onInput=${(e) => (navn = e.target.value)} autocapitalize="sentences" /></div>
      <p class="hjelp">Kopier oppsettet fra en eksisterende type, eller start tomt:</p>
      <div class="knapperad vertikal">
        ${ctx.config.liste.map((t) => html`<button class="knapp" onClick=${() => opprett(t.id)}>Kopier fra ${t.navn}</button>`)}
        <button class="knapp" onClick=${() => opprett(null)}>Tomt oppsett</button>
      </div></div>`);
    const opprett = async (mal) => {
      if (!navn.trim()) return visMelding('Skriv inn et navn først.');
      const id = await nyType(navn.trim(), mal, ctx.config);
      lukkArk();
      go('innstillinger/type/' + id);
    };
  };

  return html`
    <${Topp} tittel="Innstillinger" tilbake="" />
    <main class="innhold">
      <${Seksjon} tittel="Generelt">
        <${TextField} label="Utført av (standard)" value=${inn.utfortAv} onSave=${sett('utfortAv')} autocap="words" />
        <${TextField} label="Firma (til rapport)" value=${inn.firma} onSave=${sett('firma')} />
        <${Chips} label="Orientering tastes som" options=${['Fall/fallretning', 'Strøk/fall (høyrehånd)']}
          value=${inn.orienteringsformat === 'strok' ? 'Strøk/fall (høyrehånd)' : 'Fall/fallretning'}
          onChange=${(v) => v && setInnstilling('orienteringsformat', v.startsWith('Strøk') ? 'strok' : 'fall')}
          hjelp="Lagres alltid internt som fall/fallretning." />
        <${NumField} label="Misvisning" enhet="°" value=${inn.misvisning} onSave=${(v) => setInnstilling('misvisning', v ?? 0)} min=${-30} max=${30}
          hjelp="Østlig misvisning positiv. Lagres på hvert sprekkesett og legges til fallretningen ved eksport og i stereonett. Det du taster inn endres ikke." />
        <div class="rad2">
          <${NumField} label="Friksjonsvinkel" enhet="°" value=${inn.friksjonsvinkel} onSave=${(v) => setInnstilling('friksjonsvinkel', v ?? 30)} min=${10} max=${50} />
          <${NumField} label="Sideavgrensning" enhet="±°" value=${inn.sideavgrensning} onSave=${(v) => setInnstilling('sideavgrensning', v ?? 20)} min=${5} max=${45} />
        </div>
        <${Bryter} label="Hent GPS-posisjon automatisk" value=${inn.gps} onChange=${sett('gps')} />
        <${Chips} label="UTM-sone i eksport" options=${['32', '33']} value=${String(inn.utmSone)} onChange=${(v) => v && setInnstilling('utmSone', Number(v))} />
        <${Chips} label="Tema" options=${['Auto', 'Lys', 'Mørk']}
          value=${{ auto: 'Auto', lys: 'Lys', mork: 'Mørk' }[inn.tema] || 'Auto'}
          onChange=${(v) => v && setInnstilling('tema', { Auto: 'auto', Lys: 'lys', Mørk: 'mork' }[v])} />
      <//>

      <${Seksjon} tittel="Objekttyper og valglister">
        ${ctx.config.liste.map((t) => html`<a class="kort" href=${'#/innstillinger/type/' + t.id}>
          <${TypeIkon} ikon=${t.ikon} size=${32} />
          <div class="kort-tekst"><div class="kort-tittel">${t.navn}${t.aktiv === false ? ' (skjult)' : ''}</div>
            <div class="kort-under">${t.posisjoner.length} posisjoner · ${t.observasjonstyper.length} typer · ${t.maletyper.length} måletyper${t.endret ? ' · endret' : ''}</div></div>
          <span class="pil">›</span></a>`)}
        <a class="kort" href="#/innstillinger/felles">
          <span class="ikon ikon-emoji" style="font-size:24px;width:32px;height:32px">☰</span>
          <div class="kort-tekst"><div class="kort-tittel">Felles valglister</div>
            <div class="kort-under">Formål, vurderinger, sprekkesettnavn${ctx.config.fellesEndret ? ' · endret' : ''}</div></div>
          <span class="pil">›</span></a>
        <button class="knapp full" onClick=${lagNyType}>+ Ny objekttype</button>
      <//>

      <${Seksjon} tittel="Data">
        <a class="kort" href="#/prosjekter"><div class="kort-tekst"><div class="kort-tittel">Prosjekter</div></div><span class="pil">›</span></a>
        <a class="kort" href="#/papirkurv"><div class="kort-tekst"><div class="kort-tittel">Papirkurv</div>
          <div class="kort-under">Gjenopprett slettede befaringer, observasjoner, målinger …</div></div><span class="pil">›</span></a>
      <//>

      <${Seksjon} tittel="Lagring">
        ${lagring && html`<p>Brukt: <strong>${MB(lagring.brukt)}</strong>${lagring.kvote ? ` av ca. ${MB(lagring.kvote)} tilgjengelig` : ''}</p>
          <p>Vedvarende lagring: <strong>${lagring.persistent === true ? 'Ja ✓' : lagring.persistent === false ? 'Nei' : 'Ukjent'}</strong></p>`}
        <button class="knapp" onClick=${async () => {
          const ok = await bePersistent();
          visMelding(ok ? 'Lagringen er vedvarende.' : 'Nettleseren sa nei. Installer appen på Hjem-skjermen og prøv igjen.');
          oppdaterInfo();
        }}>Be om vedvarende lagring</button>
        <p class="hjelp">Alle data ligger kun på denne telefonen. Appen kan teknisk sett ikke sende data til noen server.</p>
      <//>

      <${SikkerhetskopiPanel} />

      <${Seksjon} tittel="Testdata">
        <p class="hjelp">En fiktiv befaring med skjæring, påhugg og tunnel, slik at du kan se valglister, skisser og eksport.</p>
        <div class="knapperad">
          ${!test && html`<button class="knapp" onClick=${async () => { const bid = await lastInnTestdata(); oppdaterInfo(); go('befaring/' + bid); }}>Last inn testdata</button>`}
          ${test && html`<button class="knapp fare-tekst" onClick=${async () => {
            if (!(await bekreft('Fjerne testdataene?', { ok: 'Fjern', fare: true, detalj: 'Bare data merket som testdata fjernes. Dine egne data røres ikke.' }))) return;
            await fjernTestdata(); oppdaterInfo(); visMelding('Testdata fjernet.');
          }}>Fjern testdata</button>`}
        </div>
      <//>

      <p class="hjelp sentrert">Befaringsapp versjon ${APP_VERSJON}</p>
    </main>
  `;
}
