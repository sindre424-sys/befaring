// Skissene som komponenter i appen.
import { html, useState } from '../lib.js';
import { lagBygger, APP_FARGER } from './svg.js';
import { tegnProfilstripe } from './profilstripe.js';
import { tegnKompass } from './kompass.js';
import { tegnTunnel } from './tunnel.js';
import { tegnSkjaeringSnitt, tegnSkjaeringFasade } from './skjaering.js';
import { tegnPahuggFront, tegnPahuggLengdesnitt, pahuggData, harLengdesnittData } from './pahugg.js';
import { tegnStereonett, kinematikkTekst, ANSVARSTEKST } from './stereonett.js';
import { analyseForObs, samletPerSide, posisjonsOversikt } from './data.js';
import { typeCfg } from '../config.js';
import { fmtFall, fmtRetning } from '../logikk.js';

const A = lagBygger('app');
const F = APP_FARGER;

export const Kompass = ({ fall, fallretning, storrelse = 64 }) => tegnKompass(A, F, { fall, fallretning, storrelse });

/** Posisjonsskisse etter objekttype. Returnerer null hvis typen ikke har skisse. */
export function PosisjonsSkisse({ t, o, onToggle }) {
  const ps = t.posisjonsskisse;
  if (!ps || !ps.type) return null;
  const valgte = o.posisjon || [];
  const felles = { valgte, onVelg: onToggle, soner: ps.soner, bredde: 340 };
  let svg = null;
  if (ps.type === 'tunnel-tverrsnitt') svg = tegnTunnel(A, F, felles);
  else if (ps.type === 'skjaering-snitt') svg = tegnSkjaeringSnitt(A, F, { ...felles, geometri: o.geometri, side: (o.sted && o.sted.side) || 'Høyre' });
  else if (ps.type === 'pahugg-front') svg = tegnPahuggFront(A, F, felles);
  if (!svg) return null;
  return html`<div class="skisse-boks">${svg}
    <p class="hjelp">Trykk i skissen for å velge posisjon. ${ps.type === 'skjaering-snitt' ? 'Snittet tegnes ut fra skjæringsgeometrien og siden du har valgt.' : ''}</p>
  </div>`;
}

const LYS = { rod: '🔴', gul: '🟡', gronn: '🟢' };

/** Stereonett for én observasjon, med kinematisk analyse for skjæring. */
export function StereonettPanel({ o, sett, inn, erSkjaering }) {
  const [vis, setVis] = useState('alle');
  const { sprekker, flate, analyse } = analyseForObs(o, sett, inn, erSkjaering);
  if (!sprekker.length && !flate) return null;
  const linjer = kinematikkTekst(analyse);
  return html`<div class="skisse-boks">
    ${analyse && html`<div class="chips kompakt" role="group">
      ${[['alle', 'Alle'], ['plan', 'Plan'], ['kile', 'Kile'], ['velting', 'Utvelting']].map(([k, navn]) => html`
        <button class=${'chip' + (vis === k ? ' valgt' : '')} onClick=${() => setVis(k)}>${navn}</button>`)}
    </div>`}
    ${tegnStereonett(A, F, { sett: sprekker, flate, analyse, vis, bredde: 300 })}
    ${analyse && html`<ul class="trafikklys">${linjer.map((l) => html`<li><span class=${'prikk ' + l.status}></span><strong>${l.mekanisme}:</strong> ${l.tekst}</li>`)}</ul>`}
    ${erSkjaering && !flate && html`<p class="hjelp">Legg inn skjæringsflatens helning og fallretning (skjæringsgeometri), eller et sprekkesett med navn «Skjæringsflate», for kinematisk analyse.</p>`}
    ${erSkjaering && flate && !sprekker.length && html`<p class="hjelp">Legg inn sprekkesett for kinematisk analyse.</p>`}
    ${analyse && html`<p class="hjelp">Skjæringsflate ${fmtFall(flate.fall)}/${fmtRetning(flate.fallretning)}, φ = ${analyse.phi}°, ±${analyse.lat}°. Sone: rød = plan (poler), blå = utvelting (poler), gul = kile (skjæringslinjer ◆). ${ANSVARSTEKST}</p>`}
  </div>`;
}

export function Lengdesnitt({ obsListe, malingerFor }) {
  const d = pahuggData(obsListe, malingerFor);
  if (!harLengdesnittData(d)) return null;
  return html`<div class="skisse-boks">${tegnPahuggLengdesnitt(A, F, { data: d, bredde: 340 })}
    <p class="hjelp">Tegnet fra målingene Bergoverdekning, Løsmassetykkelse, Spilingslengde/Antall spiler og Buesenteravstand.</p></div>`;
}

function lesApen() {
  try { return localStorage.getItem('oversiktApen') === '1'; } catch (e) { return false; }
}

/** Visuell oversikt på befaringssiden. */
export function BefaringOversikt({ ctx, b, obs, settFor, malingerFor, onVelg }) {
  const [apen, setApen] = useState(lesApen);
  const inn = ctx.config.innstillinger;
  const typer = [...new Set([...b.objekttyper, ...obs.map((o) => o.objekttype)])]
    .sort((x, y) => (typeCfg(ctx, x).rekkefolge ?? 99) - (typeCfg(ctx, y).rekkefolge ?? 99));
  const rader = typer.map((t) => ({ navn: typeCfg(ctx, t).kortnavn || typeCfg(ctx, t).navn, obs: obs.filter((o) => o.objekttype === t) }));
  const veksle = () => {
    const ny = !apen;
    setApen(ny);
    try { localStorage.setItem('oversiktApen', ny ? '1' : '0'); } catch (e) { /* ignorer */ }
  };
  const deler = [];
  if (apen) {
    for (const t of typer) {
      const tc = typeCfg(ctx, t);
      const liste = obs.filter((o) => o.objekttype === t);
      const skisser = tc.skisser || [];
      const ps = tc.posisjonsskisse || {};
      if (!liste.length) continue;
      if (skisser.includes('skjaering-fasade')) {
        for (const side of ['Venstre', 'Høyre']) {
          const pa = liste.filter((o) => o.sted && o.sted.side === side);
          if (pa.length) deler.push(html`<div class="skisse-boks">${tegnSkjaeringFasade(A, F, { obs: pa, side, soner: ps.soner, onVelg })}</div>`);
        }
      }
      if (skisser.includes('stereonett')) {
        for (const s of samletPerSide(liste, settFor, inn)) {
          deler.push(html`<div class="skisse-boks">
            ${tegnStereonett(A, F, { sett: s.sprekker, flate: s.flate, analyse: s.analyse, tittel: `Samlet stereonett – ${s.side.toLowerCase()} side`, bredde: 300 })}
            ${s.analyse && html`<ul class="trafikklys">${kinematikkTekst(s.analyse).map((l) => html`<li><span class=${'prikk ' + l.status}></span><strong>${l.mekanisme}:</strong> ${l.tekst}</li>`)}</ul>`}
            ${s.ulikeFlater && html`<p class="hjelp">⚠︎ Skjæringsflaten varierer mye på denne siden – gjennomsnittet er brukt.</p>`}
            <p class="hjelp">${ANSVARSTEKST}</p>
          </div>`);
        }
      }
      if (ps.type === 'tunnel-tverrsnitt' && skisser.includes('tunnel-tverrsnitt')) {
        deler.push(html`<div class="skisse-boks"><h3>Tunnel – observasjoner per posisjon</h3>${tegnTunnel(A, F, { oversikt: posisjonsOversikt(liste), soner: ps.soner, bredde: 300 })}</div>`);
      }
      if (ps.type === 'pahugg-front' && skisser.includes('pahugg-front')) {
        deler.push(html`<div class="skisse-boks"><h3>Påhugg – observasjoner per posisjon</h3>${tegnPahuggFront(A, F, { oversikt: posisjonsOversikt(liste), soner: ps.soner, bredde: 300 })}</div>`);
      }
      if (skisser.includes('pahugg-lengdesnitt')) {
        const l = html`<${Lengdesnitt} obsListe=${liste} malingerFor=${malingerFor} />`;
        deler.push(l);
      }
    }
  }
  return html`<div>
    <div class="skisse-boks">${tegnProfilstripe(A, F, { rader, bredde: 340, onVelg })}</div>
    <button class="knapp full" onClick=${veksle}>${apen ? 'Skjul skisser og stereonett ▴' : 'Vis skisser og stereonett ▾'}</button>
    ${deler}
  </div>`;
}
