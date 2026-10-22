// Befaringsside: hodeinfo, oversikt, observasjoner og «+ Ny observasjon».
import { html, useState } from '../lib.js';
import { db, useLive, patch, softDelete, restore } from '../db.js';
import { useCtx, typeCfg } from '../config.js';
import { Topp, Seksjon, TextField, Select, AlvorlighetPrikk, visMelding, bekreft, fokusProxy } from '../ui.js';
import { TypeIkon } from '../ikoner.js';
import { fmtDato, fmtDatoTid, toLocalInput, fromLocalInput, profilTekst, obsNr } from '../util.js';
import { nyObservasjon } from '../logikk.js';
import { go } from '../router.js';
import { BefaringOversikt } from '../skisser/komponenter.js';

/** Kort tekst for et observasjonskort, f.eks. «Observasjon 01 – Profil 920 · Skjæring H · 3 bilder». */
export function obsTittel(o, ctx, antallBilder = 0) {
  const t = typeCfg(ctx, o.objekttype);
  let typeTekst = t.kortnavn || t.navn;
  const side = o.sted && o.sted.side;
  if (side) typeTekst += ' ' + side.charAt(0).toUpperCase();
  const del = o.sted && o.sted.del;
  if (del) typeTekst += ' – ' + del;
  const deler = [`Observasjon ${obsNr(o.lopenr)} – ${profilTekst(o.profilFra, o.profilTil)}`, typeTekst];
  if (antallBilder) deler.push(`${antallBilder} ${antallBilder === 1 ? 'bilde' : 'bilder'}`);
  return deler.join(' · ');
}

export function Befaring({ id }) {
  const ctx = useCtx();
  const data = useLive(async () => {
    const b = await db.befaringer.get(id);
    if (!b) return { b: null };
    const p = b.prosjektId ? await db.prosjekter.get(b.prosjektId) : null;
    const obs = (await db.observasjoner.where('befaringId').equals(id).toArray())
      .filter((o) => !o.slettet).sort((a, c) => a.lopenr - c.lopenr);
    const fotos = (await db.fotos.where('befaringId').equals(id).toArray()).filter((f) => !f.slettet);
    const bilder = {};
    for (const f of fotos) bilder[f.obsId] = (bilder[f.obsId] || 0) + 1;
    const prosjekter = (await db.prosjekter.toArray()).filter((x) => !x.slettet);
    const gruppe = (liste) => {
      const m = {};
      for (const x of liste) if (!x.slettet) (m[x.obsId] ||= []).push(x);
      return m;
    };
    const settFor = gruppe(await db.sprekkesett.where('befaringId').equals(id).toArray());
    const malingerFor = gruppe(await db.malinger.where('befaringId').equals(id).toArray());
    return { b, p, obs, bilder, prosjekter, settFor, malingerFor };
  }, [id]);
  const [visHode, setVisHode] = useState(null);

  if (!data) return html`<${Topp} tittel="Befaring" tilbake="" /><main class="innhold"><p>Laster …</p></main>`;
  const { b, p, obs, bilder, prosjekter, settFor, malingerFor } = data;
  if (!b || b.slettet) {
    return html`<${Topp} tittel="Befaring" tilbake="" /><main class="innhold"><p>Befaringen finnes ikke (kanskje i papirkurven).</p></main>`;
  }
  const hodeApen = visHode === null ? obs.length === 0 : visHode;
  const lagre = (k) => (v) => patch('befaringer', id, { [k]: v });

  const nyObs = async () => {
    fokusProxy(false);
    const o = await nyObservasjon(b);
    go(`obs/${o.id}?ny=1`);
  };

  const byttType = async (t) => {
    const har = b.objekttyper.includes(t);
    if (har) {
      const brukt = obs.filter((o) => o.objekttype === t).length;
      if (brukt) return visMelding(`Kan ikke fjerne – ${brukt} observasjon(er) bruker denne typen.`);
      if (b.objekttyper.length === 1) return visMelding('Befaringen må ha minst én objekttype.');
      await patch('befaringer', id, { objekttyper: b.objekttyper.filter((x) => x !== t) });
    } else {
      const rek = (x) => typeCfg(ctx, x).rekkefolge ?? 99;
      await patch('befaringer', id, { objekttyper: [...b.objekttyper, t].sort((a, c) => rek(a) - rek(c)) });
    }
  };

  const avslutt = async () => {
    const ok = await bekreft('Avslutte befaringen?', { ok: 'Avslutt', detalj: 'Du kan gjenåpne den senere. Ingen data endres.' });
    if (!ok) return;
    await patch('befaringer', id, { status: 'avsluttet', slutt: b.slutt || Date.now() });
    go('eksport/' + id);
  };

  const slett = async () => {
    const ok = await bekreft('Flytte hele befaringen til papirkurven?', {
      ok: 'Flytt til papirkurv', fare: true,
      detalj: `${obs.length} observasjoner følger med. Du kan gjenopprette fra Innstillinger → Papirkurv.`,
    });
    if (!ok) return;
    await softDelete('befaringer', id);
    go('', true);
    visMelding('Befaringen er flyttet til papirkurven.', { angre: async () => { await restore('befaringer', id); go('befaring/' + id); } });
  };

  const telling = { gronn: 0, gul: 0, rod: 0, ingen: 0 };
  for (const o of obs) telling[o.alvorlighet || 'ingen']++;
  const typerForOversikt = b.objekttyper.map((t) => ({ t, n: obs.filter((o) => o.objekttype === t).length }));

  return html`
    <${Topp} tittel=${'Befaring ' + fmtDato(b.start)} undertittel=${p ? p.navn : 'Uten prosjekt'} tilbake="" />
    <main class="innhold med-bunnknapp">
      ${b.status === 'avsluttet' && html`<div class="info-boks">
        Befaringen er avsluttet. <button class="lenke" onClick=${() => patch('befaringer', id, { status: 'pagar' })}>Gjenåpne</button>
        · <a href=${'#/eksport/' + id}>Eksport</a></div>`}

      <section class="seksjon">
        <button class="seksjon-topp klikkbar" onClick=${() => setVisHode(!hodeApen)} aria-expanded=${hodeApen}>
          <h2>Om befaringen</h2><span class="pil">${hodeApen ? '▾' : '▸'}</span>
        </button>
        ${!hodeApen && html`<div class="hode-sammendrag" onClick=${() => setVisHode(true)}>
          <div>${b.omrade || 'Uten område'} · ${b.formal || 'Formål ikke valgt'}</div>
          <div class="hjelp">${b.utfortAv || 'Utført av ikke angitt'}${b.deltakere ? ' · ' + b.deltakere : ''}</div>
        </div>`}
        ${hodeApen && html`<div>
          <div class="felt"><label>Objekttyper</label>
            <div class="chips">
              ${ctx.config.liste.filter((t) => t.aktiv !== false || b.objekttyper.includes(t.id)).map((t) => html`
                <button class=${'chip med-ikon' + (b.objekttyper.includes(t.id) ? ' valgt' : '')} onClick=${() => byttType(t.id)}>
                  <${TypeIkon} ikon=${t.ikon} size=${22} /> ${t.navn}</button>`)}
            </div></div>
          <${Select} label="Prosjekt" value=${p ? p.navn : ''} options=${prosjekter.map((x) => x.navn)}
            onChange=${(navn) => { const np = prosjekter.find((x) => x.navn === navn); if (np) patch('befaringer', id, { prosjektId: np.id }); }} />
          <div>
            <div class="felt"><label>Start</label>
              <input type="datetime-local" value=${toLocalInput(b.start)} onChange=${(e) => { const t = fromLocalInput(e.target.value); if (t) patch('befaringer', id, { start: t }); }} /></div>
            <div class="felt"><label>Slutt</label>
              <input type="datetime-local" value=${toLocalInput(b.slutt)} onChange=${(e) => patch('befaringer', id, { slutt: fromLocalInput(e.target.value) })} /></div>
          </div>
          <${TextField} label="Utført av" value=${b.utfortAv} onSave=${lagre('utfortAv')} autocap="words" />
          <${TextField} label="Deltakere" value=${b.deltakere} onSave=${lagre('deltakere')} multiline rows=${2} />
          <${TextField} label="Område" value=${b.omrade} onSave=${lagre('omrade')} hjelp="Nye observasjoner arver området." />
          <${Select} label="Formål" value=${b.formal} options=${ctx.config.felles.formal} onChange=${lagre('formal')} />
          <${TextField} label="Vær/forhold" value=${b.vaer} onSave=${lagre('vaer')} />
          <${TextField} label="Generell kommentar" value=${b.kommentar} onSave=${lagre('kommentar')} multiline rows=${3} />
        </div>`}
      </section>

      <${Seksjon} tittel="Oversikt">
        <div class="oversikt">
          <span><strong>${obs.length}</strong> observasjoner</span>
          <span><${AlvorlighetPrikk} verdi="rod" /> ${telling.rod}</span>
          <span><${AlvorlighetPrikk} verdi="gul" /> ${telling.gul}</span>
          <span><${AlvorlighetPrikk} verdi="gronn" /> ${telling.gronn}</span>
          ${telling.ingen ? html`<span><${AlvorlighetPrikk} /> ${telling.ingen}</span>` : ''}
        </div>
        <div class="oversikt typer">
          ${typerForOversikt.map(({ t, n }) => html`<span><${TypeIkon} ikon=${typeCfg(ctx, t).ikon} size=${20} /> ${typeCfg(ctx, t).kortnavn}: ${n}</span>`)}
        </div>
        <${BefaringOversikt} ctx=${ctx} b=${b} obs=${obs} settFor=${settFor} malingerFor=${malingerFor} onVelg=${(oid) => go('obs/' + oid)} />
      <//>

      <${Seksjon} tittel="Observasjoner">
        ${obs.length === 0 && html`<p class="hjelp">Ingen observasjoner ennå. Trykk «+ Ny observasjon».</p>`}
        ${obs.map((o) => html`<a class="kort obs-kort" href=${'#/obs/' + o.id}>
          <${AlvorlighetPrikk} verdi=${o.alvorlighet} stor />
          <div class="kort-tekst">
            <div class="kort-tittel">${obsTittel(o, ctx, bilder[o.id])}</div>
            <div class="kort-under">${[o.obsType, (o.posisjon || []).join(', ')].filter(Boolean).join(' · ') || 'Type ikke valgt'}</div>
            ${o.tekst && html`<div class="kort-under utdrag">${o.tekst}</div>`}
          </div>
          <${TypeIkon} ikon=${typeCfg(ctx, o.objekttype).ikon} size=${24} />
        </a>`)}
      <//>

      <div class="knapperad vertikal">
        ${b.status !== 'avsluttet' && html`<button class="knapp stor" onClick=${avslutt}>Avslutt befaring → eksport</button>`}
        <a class="knapp stor" href=${'#/eksport/' + id}>Eksport (Excel, Word, PDF, Dips)</a>
        <button class="knapp fare-tekst" onClick=${slett}>Flytt befaring til papirkurv</button>
      </div>
      <p class="hjelp sentrert">Startet ${fmtDatoTid(b.start)}${b.slutt ? ' · avsluttet ' + fmtDatoTid(b.slutt) : ''}</p>
    </main>
    <div class="bunnlinje">
      <button class="knapp primar stor full" onClick=${nyObs}>+ Ny observasjon</button>
    </div>
  `;
}
