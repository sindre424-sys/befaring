// Sprekkesett til RocScience Dips: CSV med fall/fallretning (korrigert for misvisning).
// Komma som skilletegn og punktum som desimaltegn.
import { korrigertRetning, grunnFilnavn, typeFor } from './data.js';
import { obsNr, profilTekst } from '../util.js';

const felt = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function lagDipsCsv(data) {
  const linjer = [['Dip', 'Dip Direction', 'Set', 'Profil', 'Observasjon', 'Kommentar'].join(',')];
  let antall = 0;
  let utenOrientering = 0;
  for (const o of data.obs) {
    for (const s of data.sett[o.id] || []) {
      const dd = korrigertRetning(s);
      if (s.fall === null || s.fall === undefined || dd === null) {
        utenOrientering++;
        continue;
      }
      const t = typeFor(data.config, o.objekttype);
      const kommentar = [t.kortnavn || t.navn, o.sted && o.sted.side ? o.sted.side : '', s.kommentar || ''].filter(Boolean).join('; ');
      linjer.push([
        Math.round(s.fall), Math.round(dd), felt(s.navn), felt(profilTekst(o.profilFra, o.profilTil).replace('Profil ', '').replace('–', '-')),
        obsNr(o.lopenr), felt(kommentar),
      ].join(','));
      antall++;
    }
  }
  const fil = new File([linjer.join('\r\n') + '\r\n'], `Sprekkesett_Dips_${grunnFilnavn(data)}.csv`, { type: 'text/csv' });
  return { fil, antall, utenOrientering };
}
