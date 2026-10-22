// Excel-eksport: ark Befaring, Observasjoner, Målinger, Sprekkesett og Bilder + bildene i en zip-fil.
import { lastXlsx, lastJszip } from './last.js';
import { typeFor, korrigertRetning, grunnFilnavn, filnavnDel, typerIRekkefolge } from './data.js';
import { stedForFoto } from '../bilder.js';
import { fallretningTilStrok } from '../logikk.js';
import { tilUtm } from '../utm.js';
import { ALVORLIGHET, obsNr, profilTekst } from '../util.js';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Excel-datoer: dager siden 1899-12-30, i lokal tid (slik at klokkeslettet blir riktig i Excel).
const tilExcelDato = (ts) => (ts ? (ts - new Date(ts).getTimezoneOffset() * 60000) / 86400000 + 25569 : null);
const tom = (v) => (v === undefined || v === '' ? null : v);

function lagArk(XLSX, kolonner, rader) {
  const aoa = [kolonner.map((k) => k.navn), ...rader.map((r) => kolonner.map((k, i) => {
    const v = r[i];
    if (k.type === 'dato') return tilExcelDato(v);
    return tom(v);
  }))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Formater datoer og sett kolonnebredder
  kolonner.forEach((k, c) => {
    if (k.type === 'dato') {
      for (let r = 1; r <= rader.length; r++) {
        const celle = ws[XLSX.utils.encode_cell({ r, c })];
        if (celle && celle.t === 'n') celle.z = 'dd.mm.yyyy hh:mm';
      }
    }
  });
  ws['!cols'] = kolonner.map((k, c) => {
    if (k.bredde) return { wch: k.bredde };
    let maks = k.navn.length;
    for (const r of rader) maks = Math.max(maks, String(r[c] ?? '').length);
    return { wch: Math.min(Math.max(maks + 2, 8), 60) };
  });
  if (rader.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rader.length, c: kolonner.length - 1 } }) };
  return ws;
}

export async function lagExcel(data, modell) {
  const XLSX = await lastXlsx();
  const { b, p, obs, malinger, sett, fotos, config, inn } = data;
  const sone = inn.utmSone || 32;
  const typer = typerIRekkefolge(data).map((id) => typeFor(config, id));
  const obsById = Object.fromEntries(obs.map((o) => [o.id, o]));
  const T = (o) => typeFor(config, o.objekttype);

  // Typespesifikke kolonner: union av stedsfelt og geometri for alle objekttyper i befaringen
  const stedKol = [];
  const geoKol = [];
  for (const t of typer) {
    for (const sf of t.stedsfelt || []) if (!stedKol.some((k) => k.id === sf.id)) stedKol.push(sf);
    for (const f of (t.geometri && t.geometri.felt) || []) if (!geoKol.some((k) => k.id === f.id)) geoKol.push(f);
  }
  const harFelt = (o, id, kilde) => (kilde === 'sted' ? (T(o).stedsfelt || []) : ((T(o).geometri && T(o).geometri.felt) || [])).some((x) => x.id === id);

  const wb = XLSX.utils.book_new();

  // --- Befaring ---
  XLSX.utils.book_append_sheet(wb, lagArk(XLSX, [
    { navn: 'Befaring-ID' }, { navn: 'Prosjekt-ID' }, { navn: 'Prosjekt' }, { navn: 'Prosjektnummer' },
    { navn: 'Oppdragsgiver/byggherre' }, { navn: 'Objekttyper' }, { navn: 'Start', type: 'dato', bredde: 17 },
    { navn: 'Slutt', type: 'dato', bredde: 17 }, { navn: 'Utført av' }, { navn: 'Deltakere' }, { navn: 'Område' },
    { navn: 'Formål' }, { navn: 'Vær/forhold' }, { navn: 'Generell kommentar' }, { navn: 'Status' },
    { navn: 'Antall observasjoner' },
  ], [[
    b.id, b.prosjektId, p && p.navn, p && p.prosjektnummer, p && p.oppdragsgiver,
    typer.map((t) => t.navn).join(', '), b.start, b.slutt, b.utfortAv, b.deltakere, b.omrade, b.formal, b.vaer,
    b.kommentar, b.status === 'avsluttet' ? 'Avsluttet' : 'Pågår', obs.length,
  ]]), 'Befaring');

  // --- Observasjoner ---
  const obsKol = [
    { navn: 'Obs-ID' }, { navn: 'Befaring-ID' }, { navn: 'Løpenr' }, { navn: 'Objekttype' },
    { navn: 'Tidspunkt', type: 'dato', bredde: 17 }, { navn: 'Profil fra' }, { navn: 'Profil til' }, { navn: 'Område' },
    ...stedKol.map((sf) => ({ navn: sf.navn })),
    { navn: 'Posisjon' }, { navn: 'Observasjonstype' }, { navn: 'Status utført' }, { navn: 'Vurdering' },
    { navn: 'Alvorlighet' }, { navn: 'Observasjon', bredde: 60 }, { navn: 'Anbefalte tiltak', bredde: 50 },
    ...geoKol.map((f) => ({ navn: `${f.navn}${f.enhet ? ' [' + f.enhet + ']' : ''}` })),
    { navn: 'Breddegrad (WGS84)' }, { navn: 'Lengdegrad (WGS84)' }, { navn: 'GPS-nøyaktighet [m]' },
    { navn: `UTM${sone} Øst` }, { navn: `UTM${sone} Nord` }, { navn: 'Antall målinger' }, { navn: 'Antall sprekkesett' },
    { navn: 'Antall bilder' },
  ];
  const obsRader = obs.map((o) => {
    const utm = o.gps ? tilUtm(o.gps.lat, o.gps.lon, sone) : null;
    return [
      o.id, o.befaringId, o.lopenr, T(o).navn, o.tid, o.profilFra, o.profilTil, o.omrade,
      ...stedKol.map((sf) => (harFelt(o, sf.id, 'sted') ? (o.sted || {})[sf.id] : null)),
      (o.posisjon || []).join(', '), o.obsType, (o.status || []).join(', '), o.vurdering,
      o.alvorlighet ? ALVORLIGHET[o.alvorlighet].navn : null, o.tekst, o.tiltak,
      ...geoKol.map((f) => (harFelt(o, f.id, 'geo') ? (o.geometri || {})[f.id] : null)),
      o.gps ? o.gps.lat : null, o.gps ? o.gps.lon : null, o.gps ? o.gps.noyaktighet : null,
      utm ? utm.ost : null, utm ? utm.nord : null,
      (malinger[o.id] || []).length, (sett[o.id] || []).length, (fotos[o.id] || []).length,
    ];
  });
  XLSX.utils.book_append_sheet(wb, lagArk(XLSX, obsKol, obsRader), 'Observasjoner');

  // --- Målinger ---
  const malRader = [];
  for (const o of obs) for (const m of malinger[o.id] || []) {
    malRader.push([m.id, o.id, o.lopenr, T(o).navn, o.profilFra, o.profilTil, m.type, m.verdi, m.enhet, m.kommentar]);
  }
  XLSX.utils.book_append_sheet(wb, lagArk(XLSX, [
    { navn: 'Måling-ID' }, { navn: 'Obs-ID' }, { navn: 'Løpenr' }, { navn: 'Objekttype' }, { navn: 'Profil fra' },
    { navn: 'Profil til' }, { navn: 'Måletype' }, { navn: 'Verdi' }, { navn: 'Enhet' }, { navn: 'Kommentar' },
  ], malRader), 'Målinger');

  // --- Sprekkesett ---
  const ae = config.felles.sprekkesettFelt.avstandEnhet;
  const ue = config.felles.sprekkesettFelt.utholdenhetEnhet;
  const settRader = [];
  for (const o of obs) for (const s of sett[o.id] || []) {
    const kr = korrigertRetning(s);
    settRader.push([
      s.id, o.id, o.lopenr, T(o).navn, o.profilFra, o.profilTil, (o.sted || {}).side || null, s.navn, s.fall,
      s.fallretning, s.misvisning || 0, kr, kr === null ? null : fallretningTilStrok(kr), s.avstand, s.utholdenhet,
      s.ruhet, s.kommentar,
    ]);
  }
  XLSX.utils.book_append_sheet(wb, lagArk(XLSX, [
    { navn: 'Sett-ID' }, { navn: 'Obs-ID' }, { navn: 'Løpenr' }, { navn: 'Objekttype' }, { navn: 'Profil fra' },
    { navn: 'Profil til' }, { navn: 'Side' }, { navn: 'Navn' }, { navn: 'Fall [°]' }, { navn: 'Fallretning avlest [°]' },
    { navn: 'Misvisning [°]' }, { navn: 'Fallretning [°]' }, { navn: 'Strøk høyrehånd [°]' },
    { navn: `Sprekkeavstand [${ae}]` }, { navn: `Utholdenhet [${ue}]` }, { navn: 'Ruhet/fylling' }, { navn: 'Kommentar' },
  ], settRader), 'Sprekkesett');

  // --- Bilder ---
  const bildeRader = [];
  const bildeFiler = [];
  for (const o of obs) for (const f of fotos[o.id] || []) {
    const nr = modell.figurFor[f.id];
    const filnavn = bildeFilnavn(nr, o, f);
    bildeFiler.push({ filnavn, blob: f.blob });
    bildeRader.push([
      f.id, o.id, o.lopenr, T(o).navn, nr, filnavn, f.tid, f.sted || stedForFoto(o), f.kommentar,
      f.gps ? f.gps.lat : null, f.gps ? f.gps.lon : null, f.bredde, f.hoyde,
    ]);
  }
  XLSX.utils.book_append_sheet(wb, lagArk(XLSX, [
    { navn: 'Bilde-ID' }, { navn: 'Obs-ID' }, { navn: 'Løpenr' }, { navn: 'Objekttype' }, { navn: 'Figurnr' },
    { navn: 'Filnavn' }, { navn: 'Tidspunkt', type: 'dato', bredde: 17 }, { navn: 'Sted/profil' }, { navn: 'Kommentar' },
    { navn: 'Breddegrad (WGS84)' }, { navn: 'Lengdegrad (WGS84)' }, { navn: 'Bredde [px]' }, { navn: 'Høyde [px]' },
  ], bildeRader), 'Bilder');

  wb.Props = { Title: modell.meta.tittel, Author: b.utfortAv || '', CreatedDate: new Date() };
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
  const navn = `Befaring_${grunnFilnavn(data)}`;
  const filer = [new File([buf], navn + '.xlsx', { type: XLSX_TYPE })];

  if (bildeFiler.length) {
    const JSZip = await lastJszip();
    const zip = new JSZip();
    for (const bf of bildeFiler) zip.file(bf.filnavn, bf.blob, { binary: true, compression: 'STORE' });
    const zblob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
    filer.push(new File([zblob], `Bilder_${grunnFilnavn(data)}.zip`, { type: 'application/zip' }));
  }
  return filer;
}

export function bildeFilnavn(nr, o, f) {
  const prof = filnavnDel(profilTekst(o.profilFra, o.profilTil).replace('Profil ', 'P').replace('–', '-'));
  return `Fig${String(nr).padStart(2, '0')}_Obs${obsNr(o.lopenr)}_${prof}.jpg`;
}
