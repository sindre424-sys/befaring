// Arbeidsbeskrivelse: fyll inn det appen ikke kan vite, og lag PowerPoint-filen fra malen.
// Alt som skrives her, lagres på befaringen, så det følger med ved overføring og i arbeidsmappen.
import { html, useRef, useState } from '../lib.js';
import { db, useLive, patch, setConfigRad, hentFotoRader } from '../db.js';
import { useCtx, typeCfg } from '../config.js';
import { Topp, Seksjon, TextField, Bryter, visMelding } from '../ui.js';
import { fmtDato, obsNr } from '../util.js';
import { stedForFoto, Miniatyr } from '../bilder.js';
import { mengder, annenMengde } from '../sikring.js';
import { bildeMedTegning } from '../tegning.js';
import { lagArbeidsbeskrivelse } from '../eksport/arbeidsbeskrivelse.js';
import { lastNed } from '../eksport/del.js';

const MAL = 'lokal:mal-arbeidsbeskrivelse';

const harSikring = (f) => !!(f.tegning && (f.tegning.figurer || []).some((x) => x.type === 'symbol' || x.type === 'polygon'));

async function lagre(id, felt, verdi) {
  const b = await db.befaringer.get(id);
  await patch('befaringer', id, { arbeidsbeskrivelse: { ...(b.arbeidsbeskrivelse || {}), [felt]: verdi } });
}

/** Bildet med piler, frihånd og tekst brent inn. Sikringssymbolene legges på som figurer i PowerPoint. */
async function bildeUtenSikring(foto) {
  const rad = await db.fotos.get(foto.id);
  const t = rad.tegning || {};
  const andre = (t.figurer || []).filter((x) => x.type !== 'symbol' && x.type !== 'polygon');
  const blob = andre.length ? await bildeMedTegning({ ...rad, tegning: { ...t, figurer: andre } }) : rad.blob;
  return { blob, bredde: t.bredde || rad.bredde, hoyde: t.hoyde || rad.hoyde };
}

export function Arbeidsbeskrivelse({ id }) {
  const ctx = useCtx();
  const inn = ctx.config.innstillinger;
  const data = useLive(async () => {
    const b = await db.befaringer.get(id);
    if (!b) return { b: null };
    const p = b.prosjektId ? await db.prosjekter.get(b.prosjektId) : null;
    const obs = Object.fromEntries((await db.observasjoner.where('befaringId').equals(id).toArray()).filter((o) => !o.slettet).map((o) => [o.id, o]));
    const fotos = (await hentFotoRader('befaringId', id)).filter((f) => !f.slettet && harSikring(f) && obs[f.obsId]);
    fotos.sort((x, y) => (obs[x.obsId].lopenr - obs[y.obsId].lopenr) || (x.tid - y.tid));
    return { b, p, obs, fotos };
  }, [id]);
  const mal = useLive(() => db.innstillinger.get(MAL), [], null);
  const filRef = useRef(null);
  const [lager, setLager] = useState(false);
  const [resultat, setResultat] = useState(null);

  if (!data) return html`<${Topp} tittel="Arbeidsbeskrivelse" tilbake=${'eksport/' + id} /><main class="innhold"><p class="hjelp">Laster …</p></main>`;
  const { b, p, obs, fotos } = data;
  if (!b) return html`<${Topp} tittel="Arbeidsbeskrivelse" tilbake="" /><main class="innhold"><p>Fant ikke befaringen.</p></main>`;

  const ab = b.arbeidsbeskrivelse || {};
  const fra = inn.utfortAv || b.utfortAv || '';
  const dok = {
    tittel: b.omrade || '', dokumentnummer: '', versjon: 'v00', til: '', fra,
    oppdragsgiver: (p && p.oppdragsgiver) || '', oppdragsnummer: (p && p.prosjektnummer) || '', oppdragsnavn: (p && p.navn) || '',
    ...(ab.dok || {}),
  };
  const settDok = (k) => (v) => lagre(id, 'dok', { ...(ab.dok || {}), [k]: v });
  const versjoner = ab.versjoner || [{ versjon: dok.versjon, dato: fmtDato(Date.now()), beskrivelse: 'For utførelse', utarbeidet: fra, kontrollert: '', godkjent: '' }];
  const settVersjon = (i, k) => (v) => {
    const ny = [...versjoner];
    ny[i] = { ...(ny[i] || {}), [k]: v };
    lagre(id, 'versjoner', ny);
  };

  const rekke = ab.rekkefolge || [];
  const sortert = [...fotos].sort((x, y) => {
    const a = rekke.indexOf(x.id);
    const c = rekke.indexOf(y.id);
    if (a === -1 && c === -1) return 0;
    if (a === -1) return 1;
    if (c === -1) return -1;
    return a - c;
  });
  const flytt = (i, d) => {
    const ny = sortert.map((f) => f.id);
    const [x] = ny.splice(i, 1);
    ny.splice(i + d, 0, x);
    lagre(id, 'rekkefolge', ny);
  };
  const sideData = (f) => (ab.sider || {})[f.id] || {};
  const settSide = (f, k) => (v) => lagre(id, 'sider', { ...(ab.sider || {}), [f.id]: { ...sideData(f), [k]: v } });
  const standardTyper = ab.boltetyper || {};
  const typeFor = (f, n) => (sideData(f).boltetyper || {})[n] || standardTyper[n] || '';
  const settType = async (f, n, v) => {
    await lagre(id, 'sider', { ...(ab.sider || {}), [f.id]: { ...sideData(f), boltetyper: { ...(sideData(f).boltetyper || {}), [n]: v } } });
    await lagre(id, 'boltetyper', { ...standardTyper, [n]: v });
  };

  const velgMal = async (e) => {
    const fil = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!fil) return;
    await setConfigRad(MAL, { navn: fil.name, data: await fil.arrayBuffer(), lagt: Date.now() });
    visMelding('Malen er lagret på denne PC-en.');
  };

  const stedFor = (f) => sideData(f).sted ?? (f.sted || stedForFoto(obs[f.obsId]));
  const datoFor = (f) => sideData(f).dato ?? fmtDato(b.start);
  const avFor = (f) => sideData(f).av ?? (b.utfortAv || fra);
  const medSider = sortert.filter((f) => sideData(f).med !== false);

  const manglerType = medSider.reduce((n, f) => n + mengder(f.tegning).bolter.filter((x) => !typeFor(f, `${x.lengde}|${x.dim}`)).length, 0);
  const manglerAreal = medSider.reduce((n, f) => n + mengder(f.tegning).annen.reduce((s, a) => s + (a.utenAreal || 0), 0), 0);

  const lagFil = async () => {
    setLager(true);
    setResultat(null);
    try {
      const rad = await db.innstillinger.get(MAL);
      const sider = [];
      for (const f of medSider) {
        const boltetyper = {};
        for (const x of mengder(f.tegning).bolter) boltetyper[`${x.lengde}|${x.dim}`] = typeFor(f, `${x.lengde}|${x.dim}`);
        sider.push({ foto: f, bilde: await bildeUtenSikring(f), sted: stedFor(f), dato: datoFor(f), av: avFor(f), kommentar: sideData(f).kommentar || '', boltetyper });
      }
      const res = await lagArbeidsbeskrivelse({ mal: rad.value.data, dok, versjoner, sider });
      lastNed(res.fil);
      setResultat(res);
    } catch (e) {
      console.error(e);
      visMelding('Kunne ikke lage filen: ' + (e.message || e));
    } finally {
      setLager(false);
    }
  };

  return html`
    <${Topp} tittel="Arbeidsbeskrivelse" undertittel=${p ? p.navn : 'Uten prosjekt'} tilbake=${'eksport/' + id} />
    <main class="innhold">
      <${Seksjon} tittel="Mal">
        <p class="hjelp">Malen lagres bare i nettleseren på denne PC-en. Den følger ikke med i overføringsfiler, arbeidsmappen eller sikkerhetskopier.</p>
        ${mal && html`<p>Valgt mal: <strong>${mal.value.navn}</strong></p>`}
        <input ref=${filRef} type="file" accept=".pptm,.pptx" hidden onChange=${velgMal} />
        <button class=${'knapp full' + (mal ? '' : ' primar')} onClick=${() => filRef.current.click()}>${mal ? 'Bytt mal …' : 'Velg mal …'}</button>
      <//>

      <${Seksjon} tittel="Dokument">
        <div class="ab-felt">
          <${TextField} label="Bergskjæring (navn, profil)" value=${dok.tittel} onSave=${settDok('tittel')} />
          <${TextField} label="Dokumentnummer" value=${dok.dokumentnummer} onSave=${settDok('dokumentnummer')} />
          <${TextField} label="Versjon" value=${dok.versjon} onSave=${settDok('versjon')} />
          <${TextField} label="Oppdragsgiver" value=${dok.oppdragsgiver} onSave=${settDok('oppdragsgiver')} />
          <${TextField} label="Oppdragsnummer" value=${dok.oppdragsnummer} onSave=${settDok('oppdragsnummer')} />
          <${TextField} label="Oppdragsnavn" value=${dok.oppdragsnavn} onSave=${settDok('oppdragsnavn')} />
          <${TextField} label="Til" value=${dok.til} onSave=${settDok('til')} />
          <${TextField} label="Fra (v/)" value=${dok.fra} onSave=${settDok('fra')} />
        </div>
      <//>

      <${Seksjon} tittel="Versjoner">
        ${[0, 1, 2, 3].map((i) => {
          const v = versjoner[i] || {};
          return html`<div class="ab-versjon" key=${i}>
            ${[['versjon', 'Versjon'], ['dato', 'Dato'], ['beskrivelse', 'Beskrivelse'], ['utarbeidet', 'Utarbeidet av'], ['kontrollert', 'Kontrollert av'], ['godkjent', 'Godkjent av']].map(([k, n]) => html`
              <${TextField} label=${n} value=${v[k] || ''} onSave=${settVersjon(i, k)} />`)}
          </div>`;
        })}
      <//>

      <${Seksjon} tittel=${`Sider (${medSider.length})`}>
        ${!sortert.length && html`<p class="hjelp">Ingen bilder i denne befaringen har sikringssymboler ennå. Åpne et bilde og trykk Tegn og sikring.</p>`}
        ${sortert.map((f, i) => {
          const m = mengder(f.tegning);
          const o = obs[f.obsId];
          return html`<div class="ab-side" key=${f.id}>
            <div class="ab-side-topp">
              <strong>Observasjon ${obsNr(o.lopenr)} · ${typeCfg(ctx, o.objekttype).kortnavn}</strong>
              <span>
                <button class="knapp flat liten" disabled=${i === 0} aria-label="Flytt opp" onClick=${() => flytt(i, -1)}>▲</button>
                <button class="knapp flat liten" disabled=${i === sortert.length - 1} aria-label="Flytt ned" onClick=${() => flytt(i, 1)}>▼</button>
              </span>
            </div>
            <div class="ab-side-innhold">
              <div class="ab-bilde"><${Miniatyr} foto=${f} klasse="miniatyr stor" onClick=${() => {}} />
                <${Bryter} label="Ta med" value=${sideData(f).med !== false} onChange=${settSide(f, 'med')} /></div>
              <div class="ab-tekst">
                <${TextField} label="Sted/bergskjæring" value=${stedFor(f)} onSave=${settSide(f, 'sted')} />
                <div class="rad2">
                  <${TextField} label="Anvist dato" value=${datoFor(f)} onSave=${settSide(f, 'dato')} />
                  <${TextField} label="Anvist av" value=${avFor(f)} onSave=${settSide(f, 'av')} />
                </div>
                <${TextField} label="Kommentarer" value=${sideData(f).kommentar || ''} onSave=${settSide(f, 'kommentar')} multiline rows=${2} />
              </div>
              <div class="ab-mengder">
                ${m.bolter.map((x) => {
                  const n = `${x.lengde}|${x.dim}`;
                  return html`<label class="ab-bolt"><span>${x.navn} · ${x.antall} stk</span>
                    <select value=${typeFor(f, n)} onChange=${(e) => settType(f, n, e.target.value)}>
                      <option value="">Velg boltetype …</option>
                      ${[...new Set([...(ctx.config.sikring.boltetyper || []), ...(typeFor(f, n) ? [typeFor(f, n)] : [])])].map((t) => html`<option value=${t}>${t}</option>`)}
                    </select></label>`;
                })}
                ${m.annen.map((a) => html`<div class="ab-annen"><span>${a.navn}</span><strong>${annenMengde(a)}</strong></div>`)}
              </div>
            </div>
          </div>`;
        })}
      <//>

      <${Seksjon} tittel="Lag dokument">
        ${manglerType > 0 && html`<div class="info-boks advar">${manglerType === 1 ? '1 rad mangler' : `${manglerType} rader mangler`} boltetype.</div>`}
        ${manglerAreal > 0 && html`<div class="info-boks advar">${manglerAreal === 1 ? '1 område' : `${manglerAreal} områder`} med sprøytebetong mangler areal.</div>`}
        ${!dok.dokumentnummer && html`<div class="info-boks advar">Dokumentnummer er ikke fylt ut.</div>`}
        <button class="knapp primar stor full" disabled=${!mal || !medSider.length || lager} onClick=${lagFil}>${lager ? 'Lager filen …' : 'Lag PowerPoint'}</button>
        ${resultat && html`<div class="info-boks">Filen er lastet ned: ${resultat.fil.name}</div>`}
        ${resultat && resultat.advarsler.map((t) => html`<div class="info-boks advar">${t}</div>`)}
        <p class="hjelp">Filen lagres der Chrome laster ned filer. Flytt den selv til prosjektmappen. Symboler og områder kan justeres i PowerPoint.</p>
      <//>
    </main>
  `;
}
