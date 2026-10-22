// Faste tekster i notatet. Alt er generert fra registrerte data – ingen vurderinger legges til.
export function innledningTekst(modell) {
  const m = modell.meta;
  const avsnitt = [];
  let a = `Befaringen ble utført ${m.dato}`;
  if (m.utfortAv) a += ` av ${m.utfortAv}`;
  a += '.';
  if (m.deltakere) a += ` Deltakere: ${m.deltakere}.`;
  avsnitt.push(a);
  if (m.formal) avsnitt.push(`Formål: ${m.formal}.`);
  const n = modell.oppsummering.length;
  const t = { rod: 0, gul: 0, gronn: 0 };
  for (const r of modell.oppsummering) if (r.alvorlighet) t[r.alvorlighet]++;
  let b = `Befaringen omfattet ${m.objekttyper.join(', ').toLowerCase() || 'ingen objekttyper'}`;
  if (m.omrade) b += ` (${m.omrade})`;
  b += `. Det ble registrert ${n} ${n === 1 ? 'observasjon' : 'observasjoner'}`;
  const deler = [];
  if (t.rod) deler.push(`${t.rod} røde`);
  if (t.gul) deler.push(`${t.gul} gule`);
  if (t.gronn) deler.push(`${t.gronn} grønne`);
  if (deler.length) b += `: ${deler.join(', ')}`;
  b += '.';
  avsnitt.push(b);
  if (m.vaer) avsnitt.push(`Vær/forhold: ${m.vaer}.`.replace(/\.\.$/, '.'));
  if (m.kommentar) avsnitt.push(m.kommentar);
  return avsnitt;
}
