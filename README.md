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

> Fase 1 har ennå ikke eksport eller sikkerhetskopi (kommer i fase 3). Ikke bruk appen til ekte befaringer før det er på plass.

## Oppbygging (for den som vil se i koden)

| Mappe/fil | Innhold |
|---|---|
| `config/*.json` | Standardoppsett per objekttype (stedsfelt, posisjoner, typer, status, måletyper) og felles lister |
| `js/db.js` | Lokal database (IndexedDB via Dexie) |
| `js/config.js` | Slår sammen standardoppsett med endringer gjort i Innstillinger |
| `js/views/` | Skjermene |
| `js/testdata.js` | Fiktive testdata |
| `sw.js` | Offline-støtte. Lista `FILER` må inneholde alle filer appen bruker |
| `vendor/` | Lokale kopier av Preact/htm og Dexie (ingen nettverk ved kjøring) |
| `tools/lag-ikoner.py` | Lager app-ikonene |

Endringer du gjør i Innstillinger lagres på telefonen og overstyrer `config/*.json`. Registrerte data slettes
aldri når valglister endres: verdier som er fjernet fra en liste, vises fortsatt som «(ikke i listen)».
