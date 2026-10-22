// Fiktive testdata: én befaring som dekker skjæring, påhugg og tunnel.
// Alle rader merkes test: true, slik at de kan fjernes uten å røre egne data.
import { db } from './db.js';
import { uid } from './util.js';
import { lagTestbilde } from './bilder.js';

export async function harTestdata() {
  return (await db.befaringer.filter((b) => !!b.test).count()) > 0;
}

export async function lastInnTestdata() {
  const naa = Date.now();
  const start = naa - 3 * 3600 * 1000;
  const prosjektId = uid();
  const befaringId = uid();
  await db.prosjekter.add({
    id: prosjektId, navn: 'Fv. 999 Testdalstunnelen (fiktivt)', prosjektnummer: 'TEST-0001',
    oppdragsgiver: 'Testkommune (fiktiv)', standardOmrade: 'Testdalen', created: start, updated: start, slettet: null, test: true,
  });
  await db.befaringer.add({
    id: befaringId, prosjektId, objekttyper: ['skjaering', 'pahugg', 'tunnel'], start, slutt: null, status: 'pagar',
    utfortAv: 'Test Testesen', deltakere: 'Ola Normann (entreprenør, fiktiv), Kari Nordmann (byggherre, fiktiv)',
    omrade: 'Skjæring S3, påhugg nord og tunnelløp A', formal: 'Kontroll av sikring',
    vaer: 'Opphold, +4 °C. Vått i tunnelen.', kommentar: 'Fiktiv testbefaring for å prøve appen.',
    created: start, updated: start, slettet: null, test: true,
  });

  // Vegen går mot nord (stigende profil = 000°). Høyre side heller mot vest (270°), venstre mot øst (090°).
  const obs = [
    {
      objekttype: 'skjaering', profilFra: 820, profilTil: 850, sted: { side: 'Høyre', pall: 1 },
      posisjon: ['Skjæringsflate øvre del'], obsType: 'Løse blokker', status: ['Maskinrensk utført'],
      tekst: 'Enkelte løse blokker i øvre del etter maskinrensk. Blokkene ligger på J1-flater.',
      vurdering: 'Ekstra rensk nødvendig', alvorlighet: 'gul', tiltak: 'Spettrensk øvre del før åpning for trafikk.', bilder: ['Løse blokker i øvre del'],
      geometri: { hoyde: 14, helning: 80, antallPaller: 1, pallbredde: 4, groftbredde: 4, losmasse: 2, fallretning: 270 },
      malinger: [['Blokkstørrelse', 0.5, 'm³', 'Største blokk'], ['Skjæringshøyde', 14, 'm', '']],
      sett: [],
    },
    {
      objekttype: 'skjaering', profilFra: 850, profilTil: 900, sted: { side: 'Høyre', pall: 1 },
      posisjon: ['Skjæringsflate øvre del', 'Skjæringsflate nedre del'], obsType: 'Plan utglidning',
      status: ['Maskinrensk utført', 'Bolting utført'],
      tekst: 'Gjennomgående J1 som faller ut av skjæringen med ca. 50°. Tydelig glideflate med kalsittbelegg. J2 og J3 danner kiler.',
      vurdering: 'Ny/supplerende sikring nødvendig', alvorlighet: 'rod',
      tiltak: 'Systematisk bolting 4 m c/c 2 m i sone 850–900. Vurder nett i øvre del.', bilder: [{ kommentar: 'Oversikt over glideflate J1', tegning: { versjon: 1, bredde: 1600, hoyde: 1200, figurer: [
        { type: 'pil', x1: 300, y1: 260, x2: 700, y2: 540, farge: '#ffd43b' },
        { type: 'sirkel', x1: 690, y1: 470, x2: 1080, y2: 780, farge: '#e03131' },
        { type: 'tekst', x1: 120, y1: 230, tekst: 'J1 – glideflate', farge: '#ffd43b' }] } },
        'Detalj av kalsittbelegg', 'Kile mellom J2 og J3'],
      geometri: { hoyde: 15, helning: 80, antallPaller: 1, pallbredde: 4, groftbredde: 4, losmasse: 1.5, fallretning: 270 },
      malinger: [['Sprekkåpning', 15, 'mm', 'J1, åpen i topp'], ['Skjæringshelning', 80, '°', ''], ['Boltelengde', 4, 'm', 'Eksisterende']],
      sett: [
        ['Skjæringsflate', 80, 270, null, null, '', 'Målt på sprengt flate'],
        ['J1', 50, 265, 60, 10, 'Plan, glatt, kalsitt', 'Gjennomgående'],
        ['J2', 70, 210, 80, 5, 'Ru, ren', ''],
        ['J3', 65, 330, 100, 3, 'Ru, noe leire', ''],
        ['J4', 80, 90, 50, 4, 'Ru', 'Faller inn i skjæringen'],
      ],
    },
    {
      objekttype: 'skjaering', profilFra: 880, profilTil: 940, sted: { side: 'Venstre', pall: 2 },
      posisjon: ['Pallkant/hylle'], obsType: 'Forvitring/oppsprukket berg', status: ['Kontrollert sikring'],
      tekst: 'Noe forvitret berg på pall 2. Ingen tegn til bevegelse.',
      vurdering: 'Ingen tiltak', alvorlighet: 'gronn', tiltak: '',
      geometri: { hoyde: 8, helning: 70, antallPaller: 2, pallbredde: 3, groftbredde: 3, losmasse: 3, fallretning: 90 },
      malinger: [['Pallbredde', 3, 'm', '']],
      sett: [['Skjæringsflate', 70, 90, null, null, '', ''], ['J1', 50, 265, 60, 10, '', '']],
    },
    {
      objekttype: 'skjaering', profilFra: 940, profilTil: 960, sted: { side: 'Venstre', pall: 1 },
      posisjon: ['Grøft/fanggrøft', 'Skjæringsfot'], obsType: 'Steinsprang/nedfall i grøft', status: ['Fanggrøft rensket'],
      tekst: 'Nedfall i grøft etter frost/tining. Grøften er rensket.',
      vurdering: 'Følges opp', alvorlighet: 'gul', tiltak: 'Ny kontroll etter neste frostperiode.',
      geometri: { hoyde: 9, helning: 75, antallPaller: 1, pallbredde: null, groftbredde: 3.5, losmasse: 2.5, fallretning: 90 },
      malinger: [['Mengde nedfall i grøft', 2, 'm³', ''], ['Grøftbredde', 3.5, 'm', '']],
      sett: [],
    },
    {
      objekttype: 'pahugg', profilFra: 960, profilTil: null, sted: { del: 'Påhuggsflate' },
      posisjon: ['Heng over påhugg', 'Påhuggsflate/front'], obsType: 'Tynn bergoverdekning',
      status: ['Forbolting/spiling utført', 'Sprøytebetongbuer utført'],
      tekst: 'Bergoverdekning ca. 4,5 m over heng ved påhugget. Løsmasser over berg. Spiling og buer er utført.',
      vurdering: 'Følges opp', alvorlighet: 'gul', tiltak: 'Kontroller buer og spiling ved neste befaring.',
      q: { RQD: { kode: 'C', verdi: 60 }, Jn: { kode: 'E', verdi: 6 }, Jr: { kode: 'C', verdi: 2 }, Ja: { kode: 'C', verdi: 2 },
        Jw: { kode: 'A', verdi: 1 }, SRF: { kode: 'F', verdi: 2.5 }, kommentar: 'Påhugg: 2 × Jn brukt.' }, bilder: ['Påhuggsflate med buer', 'Løsmasser over påhugget'],
      malinger: [['Bergoverdekning', 4.5, 'm', ''], ['Løsmassetykkelse', 2, 'm', ''], ['Spilingslengde', 6, 'm', ''],
        ['Antall spiler', 25, 'stk', ''], ['Buesenteravstand', 1.5, 'm', '']],
      sett: [['J1', 55, 350, 40, 5, '', 'Parallell med front']],
    },
    {
      objekttype: 'pahugg', profilFra: 960, profilTil: null, sted: { del: 'Portal/forlengelse' },
      posisjon: ['Terreng over påhugg'], obsType: 'Vann/is/istapper', status: [],
      tekst: 'Vannsig fra terreng over påhugget. Fare for istapper vinterstid.',
      vurdering: 'Avvik – må meldes', alvorlighet: 'rod', tiltak: 'Etabler avskjærende grøft i terreng. Varsle byggherre.',
      malinger: [['Vannlekkasje', 5, 'l/min', 'Anslått']],
      sett: [],
    },
    {
      objekttype: 'tunnel', profilFra: 975, profilTil: 990, sted: {},
      posisjon: ['Heng', 'Vederlag høyre'], obsType: 'Svakhetssone/leire', status: ['Bolting utført', 'Sprøytebetong utført'],
      tekst: 'Svakhetssone ca. 1 m bred med svelleleire. Krysser tunnelen skrått.',
      vurdering: 'Ny/supplerende sikring nødvendig', alvorlighet: 'rod', tiltak: 'Armerte sprøytebetongbuer c/c 1,5 m. Ta leireprøve.',
      q: { RQD: { kode: 'B', verdi: 30 }, Jn: { kode: 'F', verdi: 9 }, Jr: { kode: 'C', verdi: 2 }, Ja: { kode: 'H', verdi: 8 },
        Jw: { kode: 'B', verdi: 0.66 }, SRF: { kode: 'C', verdi: 5 }, kommentar: 'Q i svakhetssonen.' }, bilder: ['Svakhetssone i heng'],
      malinger: [['Sprøytebetongtykkelse', 8, 'cm', ''], ['Boltelengde', 4, 'm', ''], ['Antall bolter', 12, 'stk', '']],
      sett: [['Svakhetssone', 75, 120, null, 50, 'Leire 5–20 cm', '']],
    },
    {
      objekttype: 'tunnel', profilFra: 1040, profilTil: null, sted: {},
      posisjon: ['Stuff'], obsType: 'Bergmasse generelt', status: ['Rensk utført'],
      tekst: 'Massiv granittisk gneis, tre sprekkesett. Tørr stuff.',
      q: { RQD: { kode: 'D', verdi: 85 }, Jn: { kode: 'F', verdi: 9 }, Jr: { kode: 'B', verdi: 3 }, Ja: { kode: 'B', verdi: 1 },
        Jw: { kode: 'A', verdi: 1 }, SRF: { kode: 'G', verdi: 1 } },
      vurdering: 'Ingen tiltak', alvorlighet: 'gronn', tiltak: '',
      malinger: [['Sprekkavstand', 30, 'cm', 'Gjennomsnitt']],
      sett: [['J1', 50, 265, 60, 10, '', ''], ['J2', 70, 210, 80, 5, '', ''], ['J3', 65, 330, 100, 3, '', '']],
    },
    {
      objekttype: 'tunnel', profilFra: 1100, profilTil: 1130, sted: {},
      posisjon: ['Vegg venstre', 'Såle'], obsType: 'Vann/lekkasje', status: [],
      tekst: 'Drypp og sig fra vegg venstre. Vann samles på sålen.',
      vurdering: 'Følges opp', alvorlighet: 'gul', tiltak: 'Vurder injeksjon eller vann- og frostsikring.', bilder: ['Vannsig fra vegg venstre'],
      malinger: [['Vannlekkasje', 12, 'l/min', 'Målt med bøtte']],
      sett: [],
    },
    {
      objekttype: 'tunnel', profilFra: 1180, profilTil: null, sted: {},
      posisjon: ['Heng'], obsType: 'Løse blokker/utfall', status: ['Spettrensk utført'],
      tekst: 'Små løse blokker i heng etter salve.',
      vurdering: 'Ekstra rensk nødvendig', alvorlighet: 'gul', tiltak: 'Ny spettrensk før bolting.',
      malinger: [['Blokkstørrelse', 0.2, 'm³', '']],
      sett: [],
    },
  ];

  let nr = 0;
  for (const o of obs) {
    nr++;
    const tid = start + nr * 12 * 60 * 1000;
    const obsId = uid();
    const { malinger, sett, bilder = [], ...felt } = o;
    await db.observasjoner.add({
      id: obsId, befaringId, lopenr: nr, tid, gps: null, gpsAv: false, omrade: 'Testdalen',
      alvorlighetManuell: false, geometri: {}, ...felt, created: tid, updated: tid, slettet: null, test: true,
    });
    let k = 0;
    for (const [type, verdi, enhet, kommentar] of malinger) {
      await db.malinger.add({ id: uid(), obsId, befaringId, type, verdi, enhet, kommentar, created: tid + ++k, updated: tid, slettet: null, test: true });
    }
    for (const [navn, fall, fallretning, avstand, utholdenhet, ruhet, kommentar] of sett) {
      await db.sprekkesett.add({
        id: uid(), obsId, befaringId, navn, fall, fallretning, avstand, utholdenhet, ruhet, kommentar, misvisning: 0,
        created: tid + ++k, updated: tid, slettet: null, test: true,
      });
    }
    let j = 0;
    for (const bilde of bilder) {
      j++;
      const kommentar = typeof bilde === 'string' ? bilde : bilde.kommentar;
      const tegning = typeof bilde === 'string' ? null : bilde.tegning || null;
      const b = await lagTestbilde(`Obs. ${String(nr).padStart(2, '0')} – ${kommentar}`, nr * 10 + j);
      await db.fotos.add({
        id: uid(), obsId, befaringId, blob: b.blob, miniatyr: b.miniatyr, bredde: b.bredde, hoyde: b.hoyde,
        type: 'image/jpeg', storrelse: b.blob.size, komprimert: true, fraKamera: true, tid: tid + j * 60000,
        gps: null, sted: null, kommentar, tegning, created: tid + ++k, updated: tid, slettet: null, test: true,
      });
    }
  }
  return befaringId;
}

export async function fjernTestdata() {
  for (const t of ['prosjekter', 'befaringer', 'observasjoner', 'malinger', 'sprekkesett', 'fotos']) {
    const ids = await db[t].filter((r) => !!r.test).primaryKeys();
    await db[t].bulkDelete(ids);
  }
}
