// Eksportskjerm for én befaring + sikkerhetskopi.
// Hver eksport lages først, og deles så med et eget trykk (iPhone krever et trykk rett før deling).
import { html, useState, useRef } from '../lib.js';
import { db, useLive, patch } from '../db.js';
import { useCtx } from '../config.js';
import { Topp, Seksjon, Chips, visMelding, bekreft } from '../ui.js';
import { fmtDato, fmtDatoTid } from '../util.js';
import { go } from '../router.js';
import { hentBefaringData, byggModell } from '../eksport/data.js';
import { delFiler, kanDele, fmtStorrelse } from '../eksport/del.js';
import { lagSikkerhetskopi, markerSikkerhetskopiTatt, lesSikkerhetskopi, gjenopprett } from '../sikkerhetskopi.js';

function EksportKnapp({ ikon, tittel, beskrivelse, lag, etterDeling }) {
  const [tilstand, setTilstand] = useState({ s: 'klar' });
  const start = async () => {
    setTilstand({ s: 'lager', info: 'Starter …' });
    try {
      const res = await lag((info) => setTilstand({ s: 'lager', info }));
      setTilstand({ s: 'ferdig', filer: res.filer, melding: res.melding });
    } catch (e) {
      console.error(e);
      setTilstand({ s: 'feil', feil: e.message || String(e) });
    }
  };
  const del = async () => {
    try {
      const ok = await delFiler(tilstand.filer, tittel);
      if (ok && etterDeling) etterDeling();
    } catch (e) {
      visMelding('Deling feilet: ' + e.message);
    }
  };
  return html`<div class="eksport-kort">
    <div class="eksport-topp">
      <span class="eksport-ikon">${ikon}</span>
      <div class="kort-tekst"><div class="kort-tittel">${tittel}</div><div class="kort-under">${beskrivelse}</div></div>
    </div>
    ${tilstand.s === 'klar' && html`<button class="knapp stor full" onClick=${start}>Lag fil</button>`}
    ${tilstand.s === 'lager' && html`<div class="info-boks">⏳ ${tilstand.info}</div>`}
    ${tilstand.s === 'feil' && html`<div class="info-boks advar">Noe gikk galt: ${tilstand.feil}</div>
      <button class="knapp full" onClick=${start}>Prøv igjen</button>`}
    ${tilstand.s === 'ferdig' && html`
      ${tilstand.filer.map((f) => html`<div class="fil-linje">📎 ${f.name} <span class="hjelp">(${fmtStorrelse(f.size)})</span></div>`)}
      ${tilstand.melding && html`<p class="hjelp">${tilstand.melding}</p>`}
      <div class="knapperad">
        <button class="knapp" onClick=${start}>Lag på nytt</button>
        <button class="knapp primar stor" onClick=${del}>${kanDele(tilstand.filer) ? 'Del / lagre …' : 'Last ned'}</button>
      </div>`}
  </div>`;
}

export function Eksport({ id }) {
  const ctx = useCtx();
  const b = useLive(() => db.befaringer.get(id), [id]);
  const [medBilder, setMedBilder] = useState(true);
  const [kvalitet, setKvalitet] = useState('Normal');
  const [medSkisser, setMedSkisser] = useState(true);
  const [posSkisser, setPosSkisser] = useState(false);
  if (!b) return null;
  const bildeMaks = kvalitet === 'Høy' ? 2000 : 1280;

  const hent = async (info) => {
    info('Henter data …');
    const data = await hentBefaringData(id);
    return { data, modell: byggModell(data, { skisser: medSkisser, posisjonsskisser: posSkisser }) };
  };

  const lagExcelFiler = async (info) => {
    const { data, modell } = await hent(info);
    info('Laster Excel-modul …');
    const { lagExcel } = await import('../eksport/excel.js');
    info('Lager Excel-fil og bilde-zip …');
    const filer = await lagExcel(data, modell);
    return { filer, melding: filer.length > 1 ? 'Excel-filen og bildene (zip) deles sammen.' : 'Ingen bilder i befaringen.' };
  };
  const lagWordFil = async (info) => {
    const { data, modell } = await hent(info);
    info('Laster Word-modul …');
    const { lagWord } = await import('../eksport/word.js');
    const n = medBilder ? modell.antallFigurer : 0;
    info(n ? `Legger inn bilder (0 av ${n}) …` : 'Lager Word-fil …');
    const fil = await lagWord(data, modell, { medBilder, bildeMaks, fremdrift: (i) => info(`Legger inn bilder (${i} av ${n}) …`) });
    return { filer: [fil] };
  };
  const lagPdfFil = async (info) => {
    const { data, modell } = await hent(info);
    info('Laster PDF-modul …');
    const { lagPdf } = await import('../eksport/pdf.js');
    const n = medBilder ? modell.antallFigurer : 0;
    info(n ? `Legger inn bilder (0 av ${n}) …` : 'Lager PDF …');
    const fil = await lagPdf(data, modell, { medBilder, bildeMaks, fremdrift: (i) => info(`Legger inn bilder (${i} av ${n}) …`) });
    return { filer: [fil] };
  };
  const lagDips = async (info) => {
    const { data } = await hent(info);
    const { lagDipsCsv } = await import('../eksport/dips.js');
    const r = lagDipsCsv(data);
    if (!r.antall) throw new Error('Befaringen har ingen sprekkesett med fall og fallretning.');
    return {
      filer: [r.fil],
      melding: `${r.antall} sprekkesett.${r.utenOrientering ? ` ${r.utenOrientering} uten fullstendig orientering er utelatt.` : ''}${ctx.config.innstillinger.misvisning ? ' Fallretning er korrigert for misvisning.' : ''}`,
    };
  };

  return html`
    <${Topp} tittel="Eksport" undertittel=${'Befaring ' + fmtDato(b.start)} tilbake=${'befaring/' + id} />
    <main class="innhold">
      <div class="info-boks">
        Befaringen er ${b.status === 'avsluttet' ? 'avsluttet' : 'fortsatt åpen'}.
        ${b.status === 'avsluttet'
          ? html` <button class="lenke" onClick=${async () => { await patch('befaringer', id, { status: 'pagar' }); go('befaring/' + id); }}>Gjenåpne</button>`
          : ''}
        Filene deles via delingsarket – velg f.eks. Mail, «Arkiver i Filer» eller OneDrive.
      </div>

      <${Seksjon} tittel="Valg for Word og PDF">
        <${Chips} label="Bilder i notatet" options=${['Med bilder', 'Uten bilder']} value=${medBilder ? 'Med bilder' : 'Uten bilder'}
          onChange=${(v) => v && setMedBilder(v === 'Med bilder')} />
        ${medBilder && html`<${Chips} label="Bildekvalitet" options=${['Normal', 'Høy']} value=${kvalitet} onChange=${(v) => v && setKvalitet(v)}
          hjelp="Normal (1280 px) gir mindre filer, som passer for e-post. Høy (2000 px) gir best utskrift." />`}
        <${Chips} label="Skisser og stereonett" options=${['Med skisser', 'Uten skisser']} value=${medSkisser ? 'Med skisser' : 'Uten skisser'}
          onChange=${(v) => v && setMedSkisser(v === 'Med skisser')}
          hjelp="Profilstripe, oppriss, samlet stereonett, tverrsnitt og lengdesnitt per seksjon, og snitt/stereonett per observasjon." />
        ${medSkisser && html`<${Chips} label="Posisjonsskisse per observasjon (tunnel/påhugg)" options=${['Ja', 'Nei']} value=${posSkisser ? 'Ja' : 'Nei'}
          onChange=${(v) => v && setPosSkisser(v === 'Ja')} />`}
        <p class="hjelp">Figurnumrene i Excel og bilde-zip følger valgene her, så lag gjerne alle filene med samme valg.</p>
      <//>

      <${EksportKnapp} ikon="📊" tittel="Excel + bilder" beskrivelse="Ark: Befaring, Observasjoner, Målinger, Sprekkesett, Bilder. Bildene i egen zip." lag=${lagExcelFiler} />
      <${EksportKnapp} ikon="📄" tittel="Word-notat (.docx)" beskrivelse="Redigerbart befaringsnotat med figurer og oppsummering." lag=${lagWordFil} />
      <${EksportKnapp} ikon="📕" tittel="PDF-notat" beskrivelse="Samme innhold som Word, klar til å sende." lag=${lagPdfFil} />
      <${EksportKnapp} ikon="🧭" tittel="Sprekkesett til Dips (.csv)" beskrivelse="Dip, Dip Direction, Set, Profil, Observasjon, Kommentar." lag=${lagDips} />

      <${SikkerhetskopiPanel} />
    </main>
  `;
}

export function SikkerhetskopiPanel() {
  const ctx = useCtx();
  const siste = ctx.config.innstillinger.sisteSikkerhetskopi;
  const filRef = useRef(null);
  const [lesing, setLesing] = useState(null);

  const lag = async (info) => {
    info('Samler data og bilder …');
    const { fil, antall } = await lagSikkerhetskopi((n) => info(`Pakker bilder (${n}) …`));
    return { filer: [fil], melding: `${antall.befaringer} befaringer, ${antall.observasjoner} observasjoner, ${antall.fotos} bilder. Lagre filen et annet sted enn på telefonen, f.eks. OneDrive eller e-post til deg selv.` };
  };

  const velgFil = async (e) => {
    const fil = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!fil) return;
    try {
      setLesing('Leser sikkerhetskopien …');
      const kopi = await lesSikkerhetskopi(fil);
      setLesing(null);
      const a = kopi.innhold.antall || {};
      const ok = await bekreft('Gjenopprette fra sikkerhetskopi?', {
        ok: 'Gjenopprett',
        detalj: `Laget ${fmtDatoTid(kopi.innhold.laget)}: ${a.befaringer || 0} befaringer, ${a.observasjoner || 0} observasjoner, ${a.fotos || 0} bilder. `
          + 'Dataene slås sammen med det som finnes på telefonen. Ingenting slettes – nyeste versjon av hver registrering beholdes.',
      });
      if (!ok) return;
      let n = 0;
      setLesing('Gjenoppretter …');
      const res = await gjenopprett(kopi, () => setLesing(`Gjenoppretter bilder (${++n}) …`));
      setLesing(null);
      visMelding(`Ferdig: ${res.nye} nye, ${res.oppdatert} oppdatert, ${res.uendret} uendret.`);
    } catch (err) {
      setLesing(null);
      visMelding('Kunne ikke lese filen: ' + err.message);
    }
  };

  return html`<${Seksjon} tittel="Sikkerhetskopi">
    <p class="hjelp">Alle befaringer, bilder og innstillinger i én zip-fil. Kan leses inn på denne eller en annen telefon.
      Siste sikkerhetskopi: <strong>${siste ? fmtDatoTid(siste) : 'aldri'}</strong>.</p>
    <${EksportKnapp} ikon="💾" tittel="Ta sikkerhetskopi" beskrivelse="Alt på telefonen – data, bilder og valglister." lag=${lag}
      etterDeling=${async () => { await markerSikkerhetskopiTatt(); visMelding('Sikkerhetskopi registrert.'); }} />
    <input ref=${filRef} type="file" accept=".zip,application/zip" hidden onChange=${velgFil} />
    ${lesing && html`<div class="info-boks">⏳ ${lesing}</div>`}
    <button class="knapp full" onClick=${() => filRef.current.click()}>Gjenopprett fra fil …</button>
  <//>`;
}
