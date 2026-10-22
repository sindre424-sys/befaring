// Prosjekter, papirkurv og eksport (eksport bygges i fase 3).
import { html } from '../lib.js';
import { db, useLive, add, patch, softDelete, restore } from '../db.js';
import { useCtx, typeCfg } from '../config.js';
import { Topp, Seksjon, TextField, visMelding, bekreft } from '../ui.js';
import { uid, fmtDato, fmtDatoTid, obsNr, fmtNum, profilTekst } from '../util.js';
import { orienteringTekst } from '../logikk.js';
import { go } from '../router.js';
import { Miniatyr } from '../bilder.js';

export function Prosjekter() {
  const liste = useLive(async () => {
    const p = (await db.prosjekter.toArray()).filter((x) => !x.slettet).sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
    const bef = (await db.befaringer.toArray()).filter((x) => !x.slettet);
    return p.map((x) => ({ ...x, antall: bef.filter((b) => b.prosjektId === x.id).length }));
  }, [], null);
  const nytt = async () => {
    const p = await add('prosjekter', { id: uid(), navn: 'Nytt prosjekt', prosjektnummer: '', oppdragsgiver: '', standardOmrade: '' });
    go('prosjekt/' + p.id);
  };
  return html`
    <${Topp} tittel="Prosjekter" tilbake="innstillinger" />
    <main class="innhold med-bunnknapp">
      ${liste && liste.length === 0 && html`<p class="hjelp">Ingen prosjekter ennå.</p>`}
      ${liste && liste.map((p) => html`<a class="kort" href=${'#/prosjekt/' + p.id}>
        <div class="kort-tekst"><div class="kort-tittel">${p.navn}</div>
          <div class="kort-under">${[p.prosjektnummer, p.oppdragsgiver, `${p.antall} befaringer`].filter(Boolean).join(' · ')}</div></div>
        <span class="pil">›</span></a>`)}
    </main>
    <div class="bunnlinje"><button class="knapp primar stor full" onClick=${nytt}>+ Nytt prosjekt</button></div>
  `;
}

export function Prosjekt({ id }) {
  const data = useLive(async () => {
    const p = await db.prosjekter.get(id);
    const antall = (await db.befaringer.where('prosjektId').equals(id).toArray()).filter((b) => !b.slettet).length;
    return { p, antall };
  }, [id]);
  if (!data) return null;
  const { p, antall } = data;
  if (!p || p.slettet) return html`<${Topp} tittel="Prosjekt" tilbake="prosjekter" /><main class="innhold"><p>Finnes ikke.</p></main>`;
  const lagre = (k) => (v) => patch('prosjekter', id, { [k]: v });
  const slett = async () => {
    if (antall) return visMelding(`Prosjektet har ${antall} befaring(er) og kan ikke slettes.`);
    if (!(await bekreft(`Flytte «${p.navn}» til papirkurven?`, { ok: 'Flytt til papirkurv', fare: true }))) return;
    await softDelete('prosjekter', id);
    go('prosjekter', true);
    visMelding('Prosjektet er flyttet til papirkurven.', { angre: () => restore('prosjekter', id) });
  };
  return html`
    <${Topp} tittel=${p.navn} undertittel="Prosjekt" tilbake="prosjekter" />
    <main class="innhold">
      <${Seksjon}>
        <${TextField} label="Prosjektnavn" value=${p.navn} onSave=${lagre('navn')} />
        <${TextField} label="Prosjektnummer" value=${p.prosjektnummer} onSave=${lagre('prosjektnummer')} />
        <${TextField} label="Oppdragsgiver/byggherre" value=${p.oppdragsgiver} onSave=${lagre('oppdragsgiver')} />
        <${TextField} label="Standard område" value=${p.standardOmrade} onSave=${lagre('standardOmrade')} hjelp="Foreslås ved ny befaring." />
      <//>
      <p class="hjelp">${antall} befaring(er) i prosjektet.</p>
      <button class="knapp fare-tekst" onClick=${slett}>Flytt prosjekt til papirkurv</button>
    </main>
  `;
}

export function Papirkurv() {
  const ctx = useCtx();
  const data = useLive(async () => {
    const [p, b, o, m, s, f] = await Promise.all(
      ['prosjekter', 'befaringer', 'observasjoner', 'malinger', 'sprekkesett', 'fotos'].map((t) => db[t].toArray()),
    );
    const bMap = Object.fromEntries(b.map((x) => [x.id, x]));
    const oMap = Object.fromEntries(o.map((x) => [x.id, x]));
    const slettet = (l) => l.filter((x) => x.slettet).sort((a, c) => c.slettet - a.slettet);
    return { p: slettet(p), b: slettet(b), o: slettet(o), m: slettet(m), s: slettet(s), f: slettet(f), bMap, oMap };
  }, []);
  if (!data) return null;
  const obsNavn = (oid) => {
    const o = data.oMap[oid];
    return o ? `obs. ${obsNr(o.lopenr)}${data.bMap[o.befaringId] ? ' (' + fmtDato(data.bMap[o.befaringId].start) + ')' : ''}` : 'ukjent obs.';
  };
  const Rad = ({ tabell, x, tekst }) => html`<div class="kort">
    <div class="kort-tekst"><div class="kort-tittel">${tekst}</div><div class="kort-under">Slettet ${fmtDatoTid(x.slettet)}</div></div>
    <button class="knapp" onClick=${async () => { await restore(tabell, x.id); visMelding('Gjenopprettet.'); }}>Gjenopprett</button>
  </div>`;
  const tom = !data.p.length && !data.b.length && !data.o.length && !data.m.length && !data.s.length && !data.f.length;
  return html`
    <${Topp} tittel="Papirkurv" tilbake="innstillinger" />
    <main class="innhold">
      <p class="hjelp">Ingenting slettes for godt. Alt du har slettet ligger her og kan gjenopprettes.</p>
      ${tom && html`<p>Papirkurven er tom.</p>`}
      ${data.b.length > 0 && html`<${Seksjon} tittel="Befaringer">${data.b.map((x) => html`<${Rad} tabell="befaringer" x=${x} tekst=${`${fmtDato(x.start)} · ${x.omrade || 'uten område'}`} />`)}<//>`}
      ${data.o.length > 0 && html`<${Seksjon} tittel="Observasjoner">${data.o.map((x) => html`<${Rad} tabell="observasjoner" x=${x}
        tekst=${`Observasjon ${obsNr(x.lopenr)} – ${profilTekst(x.profilFra, x.profilTil)} · ${typeCfg(ctx, x.objekttype).kortnavn}${data.bMap[x.befaringId] ? ' · ' + fmtDato(data.bMap[x.befaringId].start) : ''}`} />`)}<//>`}
      ${data.m.length > 0 && html`<${Seksjon} tittel="Målinger">${data.m.map((x) => html`<${Rad} tabell="malinger" x=${x} tekst=${`${x.type}: ${fmtNum(x.verdi)} ${x.enhet} · ${obsNavn(x.obsId)}`} />`)}<//>`}
      ${data.s.length > 0 && html`<${Seksjon} tittel="Sprekkesett">${data.s.map((x) => html`<${Rad} tabell="sprekkesett" x=${x} tekst=${`${x.navn} ${orienteringTekst(x)} · ${obsNavn(x.obsId)}`} />`)}<//>`}
      ${data.f.length > 0 && html`<${Seksjon} tittel="Bilder">${data.f.map((x) => html`<div class="kort">
        <${Miniatyr} foto=${x} klasse="miniatyr liten" onClick=${() => {}} />
        <div class="kort-tekst"><div class="kort-tittel">${x.kommentar || 'Bilde'} · ${obsNavn(x.obsId)}</div><div class="kort-under">Slettet ${fmtDatoTid(x.slettet)}</div></div>
        <button class="knapp" onClick=${async () => { await restore('fotos', x.id); visMelding('Gjenopprettet.'); }}>Gjenopprett</button>
      </div>`)}<//>`}
      ${data.p.length > 0 && html`<${Seksjon} tittel="Prosjekter">${data.p.map((x) => html`<${Rad} tabell="prosjekter" x=${x} tekst=${x.navn} />`)}<//>`}
    </main>
  `;
}
