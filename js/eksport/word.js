// Word-eksport (.docx): redigerbart befaringsnotat bygget fra rapportmodellen.
import { lastDocx } from './last.js';
import { grunnFilnavn, figurBilde, figurMal, ALV_FARGE } from './data.js';
import { innledningTekst } from './tekster.js';

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function lagWord(data, modell, { medBilder = true, bildeMaks = 1280, fremdrift = () => {} } = {}) {
  const D = await lastDocx();
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun,
    Header, Footer, PageNumber, AlignmentType, ShadingType, BorderStyle, TableLayoutType,
  } = D;
  const { meta } = modell;

  const p = (tekst, opt = {}) => new Paragraph({ children: [new TextRun({ text: tekst || '', ...(opt.run || {}) })], ...opt.para });
  const tekstAvsnitt = (tekst) =>
    String(tekst || '').split(/\n+/).filter((l) => l.trim()).map((l) => new Paragraph({ children: [new TextRun(l)], spacing: { after: 120 } }));
  const feltLinje = (navn, verdi) => new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: navn + ': ', bold: true }), new TextRun(verdi || '')],
  });
  // Faste kolonnebredder (twips). Sidebredde A4 minus marger = 9070 twips.
  const INNHOLD_BREDDE = 9070;
  const twips = (prosent) => Math.round((INNHOLD_BREDDE * prosent) / 100);
  const celle = (tekst, { hode = false, fyll = null, bredde = null } = {}) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: tekst ?? '', bold: hode, size: 18 })] })],
    shading: fyll || hode ? { type: ShadingType.CLEAR, color: 'auto', fill: fyll || 'E7EBEF' } : undefined,
    width: bredde ? { size: twips(bredde), type: WidthType.DXA } : undefined,
  });
  const kant = { style: BorderStyle.SINGLE, size: 4, color: 'A0A8B0' };
  const tabell = (hode, rader, bredder, fyllFor) => new Table({
    width: { size: INNHOLD_BREDDE, type: WidthType.DXA },
    columnWidths: bredder.map(twips),
    layout: TableLayoutType.FIXED,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    borders: { top: kant, bottom: kant, left: kant, right: kant, insideHorizontal: kant, insideVertical: kant },
    rows: [
      new TableRow({ tableHeader: true, children: hode.map((h, i) => celle(h, { hode: true, bredde: bredder && bredder[i] })) }),
      ...rader.map((r, ri) => new TableRow({
        cantSplit: true,
        children: r.map((v, i) => celle(v, { bredde: bredder && bredder[i], fyll: fyllFor ? fyllFor(ri, i) : null })),
      })),
    ],
  });
  const luft = () => new Paragraph({ children: [], spacing: { after: 80 } });

  const figur = async (fig) => {
    const bilde = await figurBilde(fig, bildeMaks);
    const mal = figurMal(bilde.bredde || 4, bilde.hoyde || 3, Math.min(560, bilde.maksBredde || 560), bilde.maksBredde ? 520 : 420);
    const buf = new Uint8Array(await bilde.blob.arrayBuffer());
    return [
      new Paragraph({
        keepNext: true,
        spacing: { before: 120 },
        children: [new ImageRun({ type: bilde.type, data: buf, transformation: { width: mal.b, height: mal.h }, altText: { title: fig.tekst, description: fig.tekst, name: 'Figur ' + fig.nr } })],
      }),
      new Paragraph({ style: 'Caption', children: [new TextRun(fig.tekst)] }),
    ];
  };

  const innhold = [];
  // Tittel og info
  innhold.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(meta.tittel)] }));
  innhold.push(new Table({
    width: { size: INNHOLD_BREDDE, type: WidthType.DXA },
    columnWidths: [twips(30), twips(70)],
    layout: TableLayoutType.FIXED,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    borders: { top: kant, bottom: kant, left: kant, right: kant, insideHorizontal: kant, insideVertical: kant },
    rows: modell.infoRader.map(([k, v]) => new TableRow({ children: [celle(k, { hode: true, bredde: 30 }), celle(v, { bredde: 70 })] })),
  }));
  innhold.push(p(`Generert fra feltregistreringer ${meta.laget}.`, { run: { italics: true, size: 16, color: '666666' }, para: { spacing: { before: 80, after: 200 } } }));

  // 1 Innledning
  let kap = 1;
  innhold.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`${kap} Innledning`)] }));
  for (const avsnitt of innledningTekst(modell)) innhold.push(...tekstAvsnitt(avsnitt));

  // Én seksjon per objekttype
  let ferdigeBilder = 0;
  for (const s of modell.seksjoner) {
    kap++;
    innhold.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`${kap} ${s.tittel}`)] }));
    if (!s.observasjoner.length) innhold.push(p('Ingen observasjoner registrert.'));
    for (const fig of s.oversiktFigurer) innhold.push(...(await figur(fig)));
    for (const t of s.oversiktTekst || []) innhold.push(p(t, { run: { italics: t.startsWith('Kinematisk feltindikator –') }, para: { spacing: { after: 80 } } }));
    for (const x of s.observasjoner) {
      innhold.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(x.overskrift)] }));
      for (const [k, v] of x.felter) innhold.push(feltLinje(k, v));
      if (x.tekst) {
        innhold.push(p('Observasjon', { run: { bold: true }, para: { spacing: { before: 120, after: 40 }, keepNext: true } }));
        innhold.push(...tekstAvsnitt(x.tekst));
      }
      if (x.geometri.length) {
        innhold.push(p('Skjæringsgeometri', { run: { bold: true }, para: { spacing: { before: 120, after: 40 }, keepNext: true } }));
        innhold.push(tabell(['Parameter', 'Verdi', 'Enhet'], x.geometri, [50, 25, 25]));
      }
      if (x.malinger.length) {
        innhold.push(p('Målinger', { run: { bold: true }, para: { spacing: { before: 120, after: 40 }, keepNext: true } }));
        innhold.push(tabell(['Måletype', 'Verdi', 'Enhet', 'Kommentar'], x.malinger, [32, 14, 12, 42]));
      }
      if (x.sett.length) {
        innhold.push(p('Sprekkesett', { run: { bold: true }, para: { spacing: { before: 120, after: 40 }, keepNext: true } }));
        innhold.push(tabell(['Navn', 'Fall/fallretning', 'Strøk/fall', 'Avstand', 'Utholdenhet', 'Ruhet/fylling', 'Kommentar'], x.sett, [14, 13, 11, 10, 14, 18, 20]));
      }
      if (x.q) {
        innhold.push(p(`Q-system: ${x.q.tekst}`, { run: { bold: true }, para: { spacing: { before: 120, after: 40 }, keepNext: true } }));
        innhold.push(tabell(['Parameter', 'Verdi', 'Beskrivelse'], x.q.rader, [14, 16, 70]));
        if (x.q.kommentar) innhold.push(p(x.q.kommentar, { run: { italics: true } }));
      }
      for (const fig of x.skisser) innhold.push(...(await figur(fig)));
      if (x.kinematikk && x.kinematikk.length) {
        innhold.push(p('Kinematisk feltindikator', { run: { bold: true }, para: { spacing: { before: 80, after: 40 }, keepNext: true } }));
        for (const l of x.kinematikk) innhold.push(p(l, { para: { spacing: { after: 20 } } }));
      }
      innhold.push(new Paragraph({
        spacing: { before: 160, after: 40 },
        children: [
          new TextRun({ text: 'Vurdering: ', bold: true }),
          new TextRun(x.vurdering || 'Ikke vurdert'),
          ...(x.alvorlighet ? [new TextRun('  '), new TextRun({
            text: ` ${{ gronn: 'Grønn', gul: 'Gul', rod: 'Rød' }[x.alvorlighet]} `, bold: true,
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: ALV_FARGE[x.alvorlighet] },
          })] : []),
        ],
      }));
      if (x.tiltak) {
        innhold.push(p('Anbefalte tiltak', { run: { bold: true }, para: { spacing: { before: 80, after: 40 }, keepNext: true } }));
        innhold.push(...tekstAvsnitt(x.tiltak));
      }
      if (medBilder) {
        for (const fig of x.figurer) {
          innhold.push(...(await figur(fig)));
          fremdrift(++ferdigeBilder);
        }
      }
      innhold.push(luft());
    }
  }

  // Oppsummering
  kap++;
  innhold.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`${kap} Oppsummering av observasjoner og tiltak`)] }));
  if (modell.oppsummering.length) {
    const medQ = modell.harQ;
    innhold.push(tabell(
      ['Obs.', 'Objekttype', 'Profil', 'Type', ...(medQ ? ['Q'] : []), 'Alvorlighet', 'Vurdering', 'Anbefalte tiltak'],
      modell.oppsummering.map((r) => [r.nr, r.type, r.profil, r.obsType, ...(medQ ? [r.q] : []), r.alvorlighetTekst, r.vurdering, r.tiltak]),
      medQ ? [6, 11, 10, 15, 6, 10, 17, 25] : [6, 11, 11, 16, 10, 18, 28],
      (ri, ci) => (ci === (medQ ? 5 : 4) && modell.oppsummering[ri].alvorlighet ? ALV_FARGE[modell.oppsummering[ri].alvorlighet] : null),
    ));
  } else {
    innhold.push(p('Ingen observasjoner registrert.'));
  }

  const toppTekst = [meta.firma, meta.prosjekt, meta.prosjektnummer, `Befaring ${meta.dato}`].filter(Boolean).join('  ·  ');
  const doc = new Document({
    creator: meta.utfortAv || 'Befaringsapp',
    title: meta.tittel,
    description: 'Befaringsnotat generert fra feltregistrering',
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
        title: { run: { font: 'Calibri', size: 40, bold: true, color: '1F3864' }, paragraph: { spacing: { after: 200 } } },
        heading1: { run: { font: 'Calibri', size: 30, bold: true, color: '1F3864' }, paragraph: { spacing: { before: 360, after: 120 } } },
        heading2: { run: { font: 'Calibri', size: 24, bold: true, color: '2F5496' }, paragraph: { spacing: { before: 280, after: 80 } } },
      },
      paragraphStyles: [{
        id: 'Caption', name: 'caption', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { italics: true, size: 18, color: '333333' }, paragraph: { spacing: { before: 40, after: 200 } },
      }],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1418, right: 1418, header: 567, footer: 567 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: toppTekst, size: 16, color: '555555' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Side ', PageNumber.CURRENT, ' av ', PageNumber.TOTAL_PAGES], size: 16, color: '555555' })] })] }) },
      children: innhold,
    }],
  });
  const blob = await Packer.toBlob(doc);
  return new File([blob], `Befaringsnotat_${grunnFilnavn(data)}.docx`, { type: DOCX_TYPE });
}
