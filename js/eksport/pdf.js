// PDF-eksport: samme innhold og oppsett som Word-notatet (samme rapportmodell).
import { lastPdfmake } from './last.js';
import { grunnFilnavn, figurBilde, figurMal, ALV_FARGE } from './data.js';
import { innledningTekst } from './tekster.js';

const tilDataUrl = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

const BLA = '#1F3864';

export async function lagPdf(data, modell, { medBilder = true, bildeMaks = 1280, fremdrift = () => {} } = {}) {
  const pdfMake = await lastPdfmake();
  const { meta } = modell;
  const kant = { hLineColor: () => '#A0A8B0', vLineColor: () => '#A0A8B0', hLineWidth: () => 0.5, vLineWidth: () => 0.5,
    paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 2, paddingBottom: () => 2 };

  const tabell = (hode, rader, bredder, fyllFor) => ({
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: bredder,
      body: [
        hode.map((h) => ({ text: h, bold: true, fillColor: '#E7EBEF', fontSize: 8.5 })),
        ...rader.map((r, ri) => r.map((v, ci) => ({ text: v ?? '', fontSize: 8.5, fillColor: fyllFor ? fyllFor(ri, ci) : undefined }))),
      ],
    },
    layout: kant,
    margin: [0, 0, 0, 6],
  });
  const tekstAvsnitt = (tekst) => String(tekst || '').split(/\n+/).filter((l) => l.trim()).map((l) => ({ text: l, margin: [0, 0, 0, 5] }));
  const undertittel = (t) => ({ text: t, bold: true, margin: [0, 6, 0, 2], headlineLevel: 1 });

  // Sidebredde A4 (595 pt) minus marger (2 × 70 pt) = 455 pt
  const figur = async (fig) => {
    const bilde = await figurBilde(fig, bildeMaks);
    // skisser: 1 px i skissen ≈ 0,78 pt, maks sidebredde
    const mal = bilde.maksBredde
      ? figurMal(bilde.bredde, bilde.hoyde, Math.min(440, bilde.maksBredde * 0.78), 400)
      : figurMal(bilde.bredde || 4, bilde.hoyde || 3, 440, 330);
    return {
      unbreakable: true,
      stack: [
        { image: await tilDataUrl(bilde.blob), width: mal.b, height: mal.h, margin: [0, 6, 0, 2] },
        { text: fig.tekst, style: 'figurtekst' },
      ],
    };
  };

  const innhold = [];
  innhold.push({ text: meta.tittel, style: 'tittel' });
  innhold.push({
    table: { widths: [130, '*'], body: modell.infoRader.map(([k, v]) => [{ text: k, bold: true, fillColor: '#E7EBEF' }, { text: v }]) },
    layout: kant,
  });
  innhold.push({ text: `Generert fra feltregistreringer ${meta.laget}.`, italics: true, fontSize: 8, color: '#666666', margin: [0, 4, 0, 10] });

  let kap = 1;
  innhold.push({ text: `${kap} Innledning`, style: 'h1' });
  for (const a of innledningTekst(modell)) innhold.push(...tekstAvsnitt(a));

  let ferdigeBilder = 0;
  for (const s of modell.seksjoner) {
    kap++;
    innhold.push({ text: `${kap} ${s.tittel}`, style: 'h1', headlineLevel: 1 });
    if (!s.observasjoner.length) innhold.push({ text: 'Ingen observasjoner registrert.' });
    for (const fig of s.oversiktFigurer) innhold.push(await figur(fig));
    for (const t of s.oversiktTekst || []) innhold.push({ text: t, italics: t.startsWith('Kinematisk feltindikator –'), margin: [0, 0, 0, 4] });
    for (const x of s.observasjoner) {
      const blokk = [{ text: x.overskrift, style: 'h2' }];
      for (const [k, v] of x.felter) blokk.push({ text: [{ text: k + ': ', bold: true }, v || ''], margin: [0, 0, 0, 1] });
      innhold.push({ stack: blokk, unbreakable: true, headlineLevel: 1 });
      if (x.tekst) innhold.push(undertittel('Observasjon'), ...tekstAvsnitt(x.tekst));
      if (x.geometri.length) innhold.push(undertittel('Skjæringsgeometri'), tabell(['Parameter', 'Verdi', 'Enhet'], x.geometri, ['*', 60, 50]));
      if (x.malinger.length) innhold.push(undertittel('Målinger'), tabell(['Måletype', 'Verdi', 'Enhet', 'Kommentar'], x.malinger, [130, 50, 40, '*']));
      if (x.sett.length) {
        innhold.push(undertittel('Sprekkesett'), tabell(['Navn', 'Fall/fallretning', 'Strøk/fall', 'Avstand', 'Utholdenhet', 'Ruhet/fylling', 'Kommentar'],
          x.sett, [58, 50, 42, 36, 56, 64, '*']));
      }
      for (const fig of x.skisser) innhold.push(await figur(fig));
      if (x.kinematikk && x.kinematikk.length) innhold.push(undertittel('Kinematisk feltindikator'), ...x.kinematikk.map((l) => ({ text: l, margin: [0, 0, 0, 1] })));
      innhold.push({
        margin: [0, 6, 0, 2],
        text: [
          { text: 'Vurdering: ', bold: true }, x.vurdering || 'Ikke vurdert',
          ...(x.alvorlighet ? ['  ', { text: ` ${{ gronn: 'Grønn', gul: 'Gul', rod: 'Rød' }[x.alvorlighet]} `, bold: true, background: '#' + ALV_FARGE[x.alvorlighet] }] : []),
        ],
      });
      if (x.tiltak) innhold.push(undertittel('Anbefalte tiltak'), ...tekstAvsnitt(x.tiltak));
      if (medBilder) {
        for (const fig of x.figurer) {
          innhold.push(await figur(fig));
          fremdrift(++ferdigeBilder);
        }
      }
      innhold.push({ text: ' ', margin: [0, 0, 0, 4] });
    }
  }

  kap++;
  innhold.push({ text: `${kap} Oppsummering av observasjoner og tiltak`, style: 'h1', pageBreak: undefined });
  if (modell.oppsummering.length) {
    innhold.push(tabell(
      ['Obs.', 'Objekttype', 'Profil', 'Type', 'Alvorlighet', 'Vurdering', 'Anbefalte tiltak'],
      modell.oppsummering.map((r) => [r.nr, r.type, r.profil, r.obsType, r.alvorlighetTekst, r.vurdering, r.tiltak]),
      [24, 48, 48, 66, 44, 74, '*'],
      (ri, ci) => (ci === 4 && modell.oppsummering[ri].alvorlighet ? '#' + ALV_FARGE[modell.oppsummering[ri].alvorlighet] : undefined),
    ));
  } else {
    innhold.push({ text: 'Ingen observasjoner registrert.' });
  }

  const toppTekst = [meta.firma, meta.prosjekt, meta.prosjektnummer, `Befaring ${meta.dato}`].filter(Boolean).join('  ·  ');
  const dd = {
    pageSize: 'A4',
    pageMargins: [70, 60, 70, 55],
    info: { title: meta.tittel, author: meta.utfortAv || 'Befaringsapp', subject: 'Befaringsnotat' },
    header: () => ({ text: toppTekst, alignment: 'right', fontSize: 8, color: '#555555', margin: [70, 28, 70, 0] }),
    footer: (side, antall) => ({ text: `Side ${side} av ${antall}`, alignment: 'center', fontSize: 8, color: '#555555', margin: [0, 20, 0, 0] }),
    content: innhold,
    // Overskrifter skal aldri stå alene nederst på en side
    pageBreakBefore: (node, folgendePaSiden) => !!node.headlineLevel && folgendePaSiden.length === 0,
    styles: {
      tittel: { fontSize: 18, bold: true, color: BLA, margin: [0, 0, 0, 10] },
      h1: { fontSize: 14, bold: true, color: BLA, margin: [0, 14, 0, 6] },
      h2: { fontSize: 11.5, bold: true, color: '#2F5496', margin: [0, 10, 0, 3] },
      figurtekst: { fontSize: 8.5, italics: true, color: '#333333', margin: [0, 0, 0, 8] },
    },
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.15 },
  };
  const blob = await new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(dd).getBlob((b) => resolve(b));
    } catch (e) {
      reject(e);
    }
  });
  return new File([blob], `Befaringsnotat_${grunnFilnavn(data)}.pdf`, { type: 'application/pdf' });
}
