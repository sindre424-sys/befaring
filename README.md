# Befaringsapp – ingeniørgeologi

En app for iPhone til feltregistrering på befaring i tunnel, skjæring og ved tunnelpåhugg.
Appen er en nettapp (PWA) som installeres fra Safari og virker helt uten nett.

## Personvern

- **Alle data ligger kun på telefonen** (i appens lokale database). Ingen sky, ingen innlogging, ingen sporing.
- Appen har en sikkerhetsregel (Content Security Policy i `index.html`) som gjør at den **teknisk ikke kan sende data**
  til noen server.
- Koden på GitHub er offentlig. **Dataene dine ligger aldri på GitHub.** De finnes bare på telefonen og i
  eksporter du selv sender.
- Ikke legg eksporter eller sikkerhetskopier i denne mappen. `.gitignore` stopper de vanligste filtypene
  (xlsx, docx, pdf, zip, csv, jpg) slik at de ikke publiseres ved et uhell.

## Publisere på GitHub Pages (én gang)

1. Lag en gratis konto på <https://github.com>.
2. Last ned og installer **GitHub Desktop**: <https://desktop.github.com>. Logg inn med GitHub-kontoen.
3. I GitHub Desktop: **File → Add Local Repository…** → velg mappen `Befaringsapp`.
   Står det «This directory does not appear to be a Git repository», trykker du **create a repository**.
   Navn: `befaring`. Trykk **Create Repository**.
4. Nederst til venstre: skriv `Fase 1` i feltet «Summary» og trykk **Commit to main**.
5. Trykk **Publish repository** øverst. **Fjern haken ved «Keep this code private»** (gratis GitHub Pages krever
   offentlig kode). Trykk **Publish Repository**.
6. Gå til repoet på github.com (`https://github.com/<brukernavn>/befaring`) → **Settings** → **Pages**.
   Under «Build and deployment»: Source = **Deploy from a branch**, Branch = **main** og mappe **/ (root)** → **Save**.
7. Vent 1–2 minutter. Adressen til appen blir `https://<brukernavn>.github.io/befaring/`.

## Installere på iPhone

1. Åpne adressen over i **Safari** på iPhone.
2. Trykk **Del**-knappen → **Legg til på Hjem-skjerm**. La «Åpne som nettapp» stå på → **Legg til**.
3. **Åpne alltid appen fra ikonet på Hjem-skjermen.** Safari og den installerte appen har hver sin lagring.
   Data i en vanlig Safari-fane kan slettes automatisk av iOS, men det skjer ikke i den installerte appen.
4. I appen: **Innstillinger → Lagring**. «Vedvarende lagring» skal vise **Ja ✓**. Står det «Nei», trykker du
   «Be om vedvarende lagring».

## Oppdatere appen (etter hver fase)

1. Jeg (Claude) endrer filene og øker versjonsnummeret i `sw.js` og `js/versjon.js`.
2. I GitHub Desktop: skriv en kort tekst i «Summary» → **Commit to main** → **Push origin**.
3. Vent 1–2 minutter. Åpne appen på iPhone. Et gult felt øverst sier «Ny versjon er klar – trykk for å oppdatere».
   Dataene dine beholdes.

## Teste fase 1 på iPhone

- [ ] **Testdata:** Innstillinger → «Last inn testdata». Bla gjennom befaringen og observasjonene.
- [ ] **Offline:** Slå på flymodus. Lukk appen helt (sveip den bort) og åpne den igjen. Alt skal virke.
- [ ] **Ny befaring:** Lag et eget prosjekt → velg objekttyper → fyll inn → «Start befaring».
- [ ] **Ny observasjon:** Tastaturet skal komme opp i fritekstfeltet. Prøv diktering (mikrofonen på tastaturet).
- [ ] **Objekttype:** Har befaringen flere typer, skal du kunne bytte øverst i observasjonen. Feltene skal endre seg.
- [ ] **Måling:** «+ Legg til måling» → velg type. Tallastaturet skal komme opp, og enheten skal fylles ut.
  Prøv komma som desimaltegn. Prøv en urimelig verdi (f.eks. helning 95°). Du skal få en advarsel, men verdien lagres.
- [ ] **Sprekkesett:** Prøv både fall/fallretning og strøk/fall (bytt i Innstillinger).
- [ ] **Autolagring:** Skriv noe, lukk appen med en gang og åpne den igjen. Teksten skal være der.
- [ ] **Sletting:** Slett en måling og trykk «Angre». Slett en observasjon og gjenopprett den fra Innstillinger → Papirkurv.
- [ ] **Valglister:** Innstillinger → Skjæring. Legg til en posisjon, og se at den dukker opp i en skjæringsobservasjon.
- [ ] **GPS:** Første gang spør iPhone om tilgang til posisjon. Svar «Tillat mens appen er i bruk».
- [ ] **Mørk/lys modus:** Innstillinger → Tema.
- [ ] Når du er ferdig: Innstillinger → «Fjern testdata». Bare testdataene fjernes.

## Teste fase 2 (bilder) på iPhone

- [ ] **Oppdater:** Åpne appen. Trykk det gule feltet «Ny versjon er klar». Nederst i Innstillinger skal det stå versjon 0.2.0.
- [ ] **Testbilder:** Innstillinger → «Fjern testdata» → «Last inn testdata». Observasjon 01, 02, 05, 07 og 09 har nå fiktive bilder.
- [ ] **Ta bilde:** Åpne en observasjon → «📷 Ta bilde». Kameraet skal åpne seg direkte. Etter bildet skal du se
  «✓ Bilde lagret», et kommentarfelt og «📷 Ta nytt bilde».
- [ ] **Flere bilder på rad:** Trykk «Ta nytt bilde» noen ganger. Telleren «Bilder (n)» og «· n bilder» på kortet skal øke.
- [ ] **Fra Bilder:** «🖼 Fra Bilder» → velg flere bilder samtidig.
- [ ] **Stående og liggende:** Ta ett bilde av hver. Begge skal vises riktig vei.
- [ ] **Full størrelse:** Trykk på et bilde. Bla med «Forrige/Neste». Prøv å zoome med to fingre.
- [ ] **Sted/profil:** Står som «(auto)» og følger profil, side og posisjon i observasjonen. Trykk «Endre» for å skrive egen tekst.
- [ ] **Sletting:** Slett et bilde (bekreftelse + «Angre»). Gjenopprett et bilde fra Papirkurv.
- [ ] **Tunnel/offline:** Flymodus → ta bilde. Det skal fungere uten nett (GPS kan mangle, det er normalt).
- [ ] **Lagring:** Innstillinger → Lagring viser hvor mye plass bildene bruker (ca. 0,3–0,8 MB per bilde).

## Teste fase 3 (eksport og sikkerhetskopi) på iPhone

Første gang etter oppdateringen laster appen ned eksportmodulene (ca. 4 MB). Gjør det med nett.

- [ ] **Oppdater** til versjon 0.3.0 (gult felt øverst, versjonen står nederst i Innstillinger).
- [ ] Åpne testbefaringen → **«Eksport (Excel, Word, PDF, Dips)»**.
- [ ] **Excel + bilder:** «Lag fil» → «Del / lagre …» → «Arkiver i Filer» eller Mail. Åpne i Excel. Sjekk arkene,
  ID-kolonnene, datoene og at kolonnene for side/pall/del bare er fylt ut der de gjelder. Bilde-zip-en har filnavn som
  `Fig02_Obs02_P850-900.jpg`, med samme figurnummer som i notatet.
- [ ] **Word:** Åpne i Word. Sjekk topptekst, innledning, én seksjon per objekttype (Skjæring → Påhugg → Tunnel),
  tabeller, figurtekster («Figur 3: …») og oppsummeringstabellen til slutt. Prøv å redigere teksten.
- [ ] **PDF:** Samme innhold som Word. Sjekk at bildene er skarpe nok. Prøv «Høy» bildekvalitet.
- [ ] **Dips:** CSV-filen har kolonnene `Dip, Dip Direction, Set, Profil, Observasjon, Kommentar`.
  Åpne den i Excel, eller importer i Dips (kolonne 1 = Dip, kolonne 2 = Dip Direction).
- [ ] **Offline:** Slå på flymodus og lag en PDF. Det skal virke (bare delingen trenger nett hvis du velger Mail/OneDrive).
- [ ] **Sikkerhetskopi:** Innstillinger → Sikkerhetskopi → «Lag fil» → «Del / lagre …» → lagre i OneDrive eller Filer.
  «Siste sikkerhetskopi» skal oppdateres.
- [ ] **Gjenopprett:** Slett en testobservasjon helt (papirkurv er ikke nok – bruk «Fjern testdata»), og velg så
  «Gjenopprett fra fil …» med sikkerhetskopien. Testdataene skal komme tilbake med bilder.
- [ ] **Påminnelse:** Startsiden minner deg på sikkerhetskopi hvis du har egne befaringer og det er over 14 dager siden sist.

## Teste fase 4 (visuelle hjelpemidler) på iPhone

Ta en sikkerhetskopi før du oppdaterer (Innstillinger → Sikkerhetskopi). Oppdateringen endrer ikke lagrede data.

- [ ] **Oppdater** til versjon 0.4.0.
- [ ] **Profilstripe** øverst på befaringssiden: én rad per objekttype, farget etter alvorlighet. Trykk på en markør for å åpne observasjonen.
- [ ] **«Vis skisser og stereonett»** på befaringssiden: oppriss av skjæringen per side, samlet stereonett per side med
  trafikklys, tunneltverrsnitt og påhuggsfront med antall observasjoner per posisjon, og lengdesnitt ved påhugget.
- [ ] **Posisjonsskisser:** I en observasjon velger du posisjon ved å trykke i skissen (tunnel: hesteskoprofil med «Stuff»
  i midten, skjæring: snitt, påhugg: front). Sjekk at trykkflatene er store nok med hansker.
- [ ] **Skjæringssnitt:** Endre høyde, helning, antall paller og side. Snittet skal tegnes om med en gang.
- [ ] **Kompass:** Når du legger inn fall og fallretning, vises strøklinje og fallpil. Sjekk at retningen stemmer med det du målte.
- [ ] **Stereonett per observasjon:** Under sprekkesettene. For skjæring vises kritiske soner og trafikklys
  (plan utglidning, kile, utvelting). Bytt mellom «Alle / Plan / Kile / Utvelting».
- [ ] **Friksjonsvinkel/sideavgrensning:** Endre i Innstillinger og se at analysen endrer seg.
- [ ] **Lengdesnitt (påhugg):** Vises når observasjonen har målinger av bergoverdekning, løsmassetykkelse, spiling eller buer.
- [ ] **Eksport:** Lag Word og PDF «Med skisser». Sjekk figurene og figurtekstene, og at kinematikk-oppsummeringen står i teksten.

> Stereonettet er en **feltindikator** og erstatter ikke en fullstendig stabilitetsvurdering.

> **Viktig før du bruker appen i felt:** Ta sikkerhetskopi jevnlig og lagre den utenfor telefonen (OneDrive/e-post).
> Data som bare ligger på telefonen, forsvinner hvis telefonen blir borte.

## Oppbygging (for den som vil se i koden)

| Mappe/fil | Innhold |
|---|---|
| `config/*.json` | Standardoppsett per objekttype (stedsfelt, posisjoner, typer, status, måletyper) og felles lister |
| `js/db.js` | Lokal database (IndexedDB via Dexie) |
| `js/config.js` | Slår sammen standardoppsett med endringer gjort i Innstillinger |
| `js/views/` | Skjermene |
| `js/bilder.js` | Komprimering og lagring av bilder |
| `js/views/foto.js` | Bildedelen i observasjonen |
| `js/eksport/` | Excel, Word, PDF og Dips. `data.js` bygger én felles rapportmodell for Word og PDF |
| `js/skisser/` | Alle skisser (SVG): profilstripe, kompass, tunnel, skjæring (snitt/oppriss), påhugg (front/lengdesnitt) og stereonett med kinematikk. Samme kode tegner i appen og i Word/PDF |
| `js/sikkerhetskopi.js` | Sikkerhetskopi til zip og gjenoppretting (slår sammen, sletter aldri) |
| `js/testdata.js` | Fiktive testdata (også fiktive bilder) |
| `sw.js` | Offline-støtte. Lista `FILER` må inneholde alle filer appen bruker |
| `vendor/` | Lokale kopier av Preact/htm, Dexie, SheetJS, docx, pdfmake og JSZip (ingen nettverk ved kjøring) |
| `tools/lag-ikoner.py` | Lager app-ikonene |

Endringer du gjør i Innstillinger lagres på telefonen og overstyrer `config/*.json`. Registrerte data slettes
aldri når valglister endres: verdier som er fjernet fra en liste, vises fortsatt som «(ikke i listen)».
