// Q-systemet (Barton/NGI): Q = (RQD/Jn) · (Jr/Ja) · (Jw/SRF). Tabellene ligger i config/qsystem.json.
import { fmtNum } from './util.js';

export const Q_PARAMETERE = ['RQD', 'Jn', 'Jr', 'Ja', 'Jw', 'SRF'];

const tall = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** Beregner Q for en observasjon. q = obs.q, standardFaktor = typens Jn-faktor (påhugg 2). */
export function beregnQ(q, tabell, standardFaktor = 1) {
  q = q || {};
  const v = (k) => tall(q[k] && q[k].verdi);
  const rqd = v('RQD');
  const jn = v('Jn');
  let jr = v('Jr');
  const ja = v('Ja');
  const jw = v('Jw');
  const srf = v('SRF');
  const faktor = tall(q.jnFaktor) ?? standardFaktor ?? 1;
  if (jr !== null && q.Jr && q.Jr.pluss1) jr += 1;
  const mangler = Q_PARAMETERE.filter((k) => v(k) === null);
  if (mangler.length) return { Q: null, mangler, faktor, jr };
  const rqdBrukt = Math.max(10, rqd);
  const jnBrukt = jn * faktor;
  const deler = { blokk: rqdBrukt / jnBrukt, friksjon: jr / ja, spenning: jw / srf };
  const Q = deler.blokk * deler.friksjon * deler.spenning;
  return { Q, mangler: [], faktor, rqdBrukt, jnBrukt, jr, deler, klasse: qKlasse(Q, tabell) };
}

export function qKlasse(Q, tabell) {
  if (Q === null || Q === undefined) return null;
  return (tabell.klasser || []).find((k) => Q >= k.min && Q < k.max) || null;
}

/** Q med to gjeldende siffer, norsk desimalkomma. */
export function fmtQ(Q) {
  if (Q === null || Q === undefined) return '';
  if (Q >= 100) return fmtNum(Math.round(Q), 0);
  if (Q >= 10) return fmtNum(Math.round(Q), 0);
  const d = Q >= 1 ? 1 : Q >= 0.1 ? 2 : Q >= 0.01 ? 3 : 4;
  return fmtNum(Number(Q.toFixed(d)), d);
}

/** Kort tekst, f.eks. «Q = 2,3 (Dårlig)». */
export function qTekst(r) {
  if (!r || r.Q === null) return '';
  return `Q = ${fmtQ(r.Q)}${r.klasse ? ` (${r.klasse.navn})` : ''}`;
}

/** Linjer til rapport: verdiene som er brukt. */
export function qRader(q, r, tabell) {
  q = q || {};
  return Q_PARAMETERE.map((k) => {
    const p = tabell.parametere[k] || { valg: [] };
    const valgt = q[k] || {};
    const opt = (p.valg || []).find((x) => x.kode === valgt.kode);
    let verdi = valgt.verdi === null || valgt.verdi === undefined ? '' : fmtNum(valgt.verdi, 3);
    if (k === 'Jr' && valgt.pluss1) verdi += ' + 1,0';
    if (k === 'Jn' && r && r.faktor && r.faktor !== 1 && verdi) verdi += ` × ${fmtNum(r.faktor)}`;
    if (k === 'RQD' && verdi && Number(valgt.verdi) < 10) verdi += ' (10 brukt)';
    return [k, verdi, opt ? `${opt.kode}: ${opt.tekst}` : ''];
  });
}
