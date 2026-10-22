// Observasjonsskjema. Rekkefølge: objekttype → sted → posisjon → type → fritekst → status →
// målinger og sprekkesett → bilder → vurdering. Alt lagres automatisk.
import { html, useState } from '../lib.js';
import { db, useLive, patch, add, softDelete, restore } from '../db.js';
import { useCtx, typeCfg } from '../config.js';
import {
  Topp, Seksjon, TextField, NumField, Chips, Select, AlvorlighetPrikk,
  visMelding, bekreft, visArk, lukkArk, fokusProxy, Bryter,
} from '../ui.js';
import { TypeIkon } from '../ikoner.js';
import { uid, obsNr, fmtDatoTid, fmtNum, ALVORLIGHET } from '../util.js';
import {
  nyObservasjon, hentGps, strokTilFallretning, fallretningTilStrok, fmtRetning, fmtFall,
  nesteSettNavn, alvorlighetFraVurdering,
} from '../logikk.js';
import { go } from '../router.js';
import { FotoSeksjon } from './foto.js';
import { PosisjonsSkisse, Kompass, StereonettPanel, Lengdesnitt } from '../skisser/komponenter.js';

export function Observasjon({ id, ny }) {
  const ctx = useCtx();
  const data = useLive(async () => {
    const o = await db.observasjoner.get(id);
    if (!o) return { o: null };
    const b = await db.befaringer.get(o.befaringId);
    const malinger = (await db.malinger.where('obsId').equals(id).toArray()).filter((x) => !x.slettet)
      .sort((a, c) => a.created - c.created);
    const sett = (await db.sprekkesett.where('obsId').equals(id).toArray()).filter((x) => !x.slettet)
      .sort((a, c) => a.created - c.created);
    const soskenAlle = (await db.observasjoner.where('befaringId').equals(o.befaringId).toArray())
      .filter((x) => !x.slettet).sort((a, c) => a.lopenr - c.lopenr);
    const i = soskenAlle.findIndex((x) => x.id === id);
    return { o, b, malinger, sett, forrige: soskenAlle[i - 1], neste: soskenAlle[i + 1] };
  }, [id]);
  const [nyMalingId, setNyMalingId] = useState(null);
  const [nyttSettId, setNyttSettId] = useState(null);

  if (!data) return html`<${Topp} tittel="Observasjon" /><main class="innhold"><p>Laster …</p></main>`;
  const { o, b, malinger, sett, forrige, neste } = data;
  if (!o || o.slettet || !b) {
    return html`<${Topp} tittel="Observasjon" tilbake="" /><main class="innhold"><p>Observasjonen finnes ikke (kanskje i papirkurven).</p></main>`;
  }
  const t = typeCfg(ctx, o.objekttype);
  const felles = ctx.config.felles;
  const inn = ctx.config.innstillinger;
  const lagre = (k) => (v) => patch('observasjoner', id, { [k]: v });
  const tilbake = 'befaring/' + b.id;

  // ----- Objekttyper i denne befaringen -----
  const typerIBef = [...b.objekttyper];
  if (!typerIBef.includes(o.objekttype)) typerIBef.push(o.objekttype);

  // ----- Målinger -----
  const leggTilMaling = () => {
    const grupper = {};
    for (const m of t.maletyper) (grupper[m.gruppe || 'Annet'] ||= []).push(m);
    visArk('Velg måletype', () => html`<div>
      ${Object.entries(grupper).map(([g, liste]) => html`<div class="ark-gruppe">
        <h3>${g}</h3>
        <div class="chips">
          ${liste.map((m) => html`<button class="chip stor" onClick=${async () => {
            fokusProxy(true);
            const ny = await add('malinger', {
              id: uid(), obsId: id, befaringId: b.id, type: m.navn, enhet: m.enhet || '',
              verdi: null, kommentar: '', test: !!o.test,
            });
            setNyMalingId(ny.id);
            lukkArk();
          }}>${m.navn}${m.enhet ? html` <small>[${m.enhet}]</small>` : ''}</button>`)}
        </div></div>`)}
    </div>`);
  };

  const byttMaletype = (mal) => {
    visArk('Bytt måletype', () => html`<div class="chips">
      ${t.maletyper.map((m) => html`<button class="chip stor" onClick=${async () => {
        await patch('malinger', mal.id, { type: m.navn, enhet: m.enhet || mal.enhet });
        lukkArk();
      }}>${m.navn}</button>`)}</div>`);
  };

  const slettMaling = async (m) => {
    if (!(await bekreft(`Slette målingen «${m.type}»?`, { ok: 'Slett', fare: true }))) return;
    await softDelete('malinger', m.id);
    visMelding(`Måling «${m.type}» slettet.`, { angre: () => restore('malinger', m.id) });
  };

  // ----- Sprekkesett -----
  const leggTilSett = async () => {
    fokusProxy(true);
    const ny = await add('sprekkesett', {
      id: uid(), obsId: id, befaringId: b.id, navn: nesteSettNavn(sett, felles.sprekkesettnavn),
      fall: null, fallretning: null, avstand: null, utholdenhet: null, ruhet: '', kommentar: '',
      misvisning: inn.misvisning || 0, test: !!o.test,
    });
    setNyttSettId(ny.id);
  };
  const slettSett = async (s) => {
    if (!(await bekreft(`Slette sprekkesettet «${s.navn}»?`, { ok: 'Slett', fare: true }))) return;
    await softDelete('sprekkesett', s.id);
    visMelding(`Sprekkesett «${s.navn}» slettet.`, { angre: () => restore('sprekkesett', s.id) });
  };

  // ----- Vurdering -----
  const settVurdering = (v) => {
    const endring = { vurdering: v };
    if (!o.alvorlighetManuell) endring.alvorlighet = alvorlighetFraVurdering(v, felles);
    patch('observasjoner', id, endring);
  };
  const settAlvorlighet = (a) => {
    if (o.alvorlighet === a) patch('observasjoner', id, { alvorlighet: null, alvorlighetManuell: false });
    else patch('observasjoner', id, { alvorlighet: a, alvorlighetManuell: true });
  };

  // ----- Navigasjon og sletting -----
  const nesteObs = async () => {
    fokusProxy(false);
    const n = await nyObservasjon(b, o.objekttype);
    go(`obs/${n.id}?ny=1`);
  };
  const slettObs = async () => {
    const ok = await bekreft(`Flytte observasjon ${obsNr(o.lopenr)} til papirkurven?`, {
      ok: 'Flytt til papirkurv', fare: true, detalj: 'Målinger, sprekkesett og bilder følger med og kan gjenopprettes.',
    });
    if (!ok) return;
    await softDelete('observasjoner', id);
    go(tilbake, true);
    visMelding(`Observasjon ${obsNr(o.lopenr)} er flyttet til papirkurven.`, {
      angre: async () => { await restore('observasjoner', id); go('obs/' + id); },
    });
  };

  const navKnapper = html`<span class="obs-nav">
    ${forrige ? html`<a class="knapp flat liten nav-pil" href=${'#/obs/' + forrige.id} aria-label=${'Forrige: ' + obsNr(forrige.lopenr)}>‹</a>` : ''}
    ${neste ? html`<a class="knapp flat liten nav-pil" href=${'#/obs/' + neste.id} aria-label=${'Neste: ' + obsNr(neste.lopenr)}>›</a>` : ''}
  </span>`;

  return html`
    <${Topp} tittel=${html`<${AlvorlighetPrikk} verdi=${o.alvorlighet} /> Observasjon ${obsNr(o.lopenr)}`}
      undertittel=${t.navn + (o.obsType ? ' · ' + o.obsType : '')} tilbake=${tilbake} hoyre=${navKnapper} />
    <main class="innhold med-bunnknapp obs-skjema" key=${id}>

      ${typerIBef.length > 1 && html`<div class="type-rad" role="group" aria-label="Objekttype">
        ${typerIBef.map((tid) => {
          const tc = typeCfg(ctx, tid);
          return html`<button class=${'type-segment' + (o.objekttype === tid ? ' valgt' : '')}
            onClick=${() => o.objekttype !== tid && patch('observasjoner', id, { objekttype: tid })}>
            <${TypeIkon} ikon=${tc.ikon} size=${26} /><span>${tc.kortnavn}</span></button>`;
        })}
      </div>`}

      <${Seksjon} tittel="Sted">
        <div class="rad2">
          ${t.profil.fra !== false && html`<${NumField} label=${t.profil.fraNavn || 'Profil fra'} value=${o.profilFra} onSave=${lagre('profilFra')} min=${0} max=${100000} />`}
          ${t.profil.til !== false && html`<${NumField} label=${t.profil.tilNavn || 'Profil til'} value=${o.profilTil} onSave=${lagre('profilTil')} placeholder="valgfri"
            ekstraAdvarsel=${(n) => (o.profilFra !== null && o.profilFra !== undefined && n < o.profilFra ? '«Til» er mindre enn «fra»' : null)} />`}
        </div>
        ${t.stedsfelt.map((sf) => html`<${Stedsfelt} key=${sf.id} sf=${sf} verdi=${(o.sted || {})[sf.id]}
          onSave=${(v) => patch('observasjoner', id, { ['sted.' + sf.id]: v })} />`)}
        <${TextField} label="Område" value=${o.omrade} onSave=${lagre('omrade')} />
      <//>

      <${Seksjon} tittel="Posisjon">
        <${PosisjonsSkisse} t=${t} o=${o} onToggle=${(navn) => {
          const naa = o.posisjon || [];
          patch('observasjoner', id, { posisjon: naa.includes(navn) ? naa.filter((x) => x !== navn) : [...naa, navn] });
        }} />
        <${Chips} options=${t.posisjoner} value=${o.posisjon} multi onChange=${lagre('posisjon')} />
      <//>

      <${Seksjon} tittel="Type og observasjon">
        <${Select} label="Observasjonstype" value=${o.obsType} options=${t.observasjonstyper} onChange=${lagre('obsType')} />
        <${TextField} label="Observasjon" value=${o.tekst} onSave=${lagre('tekst')} multiline rows=${5}
          autoFocus=${ny} placeholder="Skriv eller dikter (mikrofon på tastaturet) …" klasse="stor-tekst" />
      <//>

      <${Seksjon} tittel="Status">
        <${Chips} options=${t.status} value=${o.status} multi onChange=${lagre('status')} />
      <//>

      ${t.geometri && t.geometri.felt && html`<${Seksjon} tittel="Skjæringsgeometri">
        <div class="rad2">
          ${t.geometri.felt.map((f) => html`<${NumField} key=${f.id} label=${f.navn} enhet=${f.enhet} value=${(o.geometri || {})[f.id]}
            min=${f.min} max=${f.max} heltall=${f.heltall} onSave=${(v) => patch('observasjoner', id, { ['geometri.' + f.id]: v })} />`)}
        </div>
        <p class="hjelp">Arves fra forrige skjæringsobservasjon. Brukes i snittet over (Posisjon) og som skjæringsflate i stereonettet.</p>
      <//>`}

      <${Seksjon} tittel=${`Målinger (${malinger.length})`}>
        ${malinger.map((m) => html`<${MalingRad} key=${m.id} m=${m} t=${t} autoFocus=${m.id === nyMalingId}
          onBytt=${() => byttMaletype(m)} onSlett=${() => slettMaling(m)} />`)}
        <button class="knapp stor full" onClick=${leggTilMaling}>+ Legg til måling</button>
        ${(t.skisser || []).includes('pahugg-lengdesnitt') && html`<${Lengdesnitt} obsListe=${[o]} malingerFor=${{ [o.id]: malinger }} />`}
      <//>

      <${Seksjon} tittel=${`Sprekkesett (${sett.length})`}>
        ${sett.map((s) => html`<${SettRad} key=${s.id} s=${s} format=${inn.orienteringsformat} felles=${felles}
          autoFocus=${s.id === nyttSettId} onSlett=${() => slettSett(s)} />`)}
        <button class="knapp stor full" onClick=${leggTilSett}>+ Legg til sprekkesett</button>
        <p class="hjelp">Format: ${inn.orienteringsformat === 'strok' ? 'strøk/fall (høyrehåndsregel)' : 'fall/fallretning'} – kan endres i Innstillinger.</p>
        <${StereonettPanel} o=${o} sett=${sett} inn=${inn} erSkjaering=${(t.skisser || []).includes('stereonett')} />
      <//>

      <${FotoSeksjon} o=${o} />

      <${Seksjon} tittel="Vurdering">
        <${Select} label="Vurdering" value=${o.vurdering} options=${felles.vurderinger.map((v) => v.navn)} onChange=${settVurdering} />
        <div class="felt"><label>Alvorlighet ${o.alvorlighet && !o.alvorlighetManuell ? html`<span class="hjelp">(foreslått fra vurdering)</span>` : ''}</label>
          <div class="alvorlighet-rad">
            ${['gronn', 'gul', 'rod'].map((a) => html`<button class=${'alv-knapp ' + a + (o.alvorlighet === a ? ' valgt' : '')}
              aria-pressed=${o.alvorlighet === a} onClick=${() => settAlvorlighet(a)}>${ALVORLIGHET[a].navn}</button>`)}
          </div></div>
        <${TextField} label="Anbefalte tiltak" value=${o.tiltak} onSave=${lagre('tiltak')} multiline rows=${3} />
      <//>

      <${Seksjon} tittel="Tid og GPS">
        <p>Registrert ${fmtDatoTid(o.tid)}</p>
        ${o.gps
          ? html`<p>GPS: ${o.gps.lat.toFixed(6)}, ${o.gps.lon.toFixed(6)} (±${o.gps.noyaktighet} m)</p>`
          : html`<p class="hjelp">${o.gpsAv ? 'GPS er slått av for denne observasjonen.' : inn.gps ? 'Ingen GPS-posisjon (venter, eller ikke tilgjengelig – vanlig i tunnel).' : 'GPS er slått av i innstillingene.'}</p>`}
        <div class="knapperad">
          <button class="knapp" onClick=${async () => {
            await patch('observasjoner', id, { gpsAv: false });
            const g = await hentGps(id, true);
            visMelding(g ? `Posisjon hentet (±${g.noyaktighet} m).` : 'Fikk ikke posisjon. Sjekk at appen har tilgang til posisjon.');
          }}>Hent posisjon</button>
          ${o.gps && html`<button class="knapp" onClick=${async () => {
            const gammel = o.gps;
            await patch('observasjoner', id, { gps: null, gpsAv: true });
            visMelding('GPS-posisjon fjernet.', { angre: () => patch('observasjoner', id, { gps: gammel, gpsAv: false }) });
          }}>Fjern posisjon</button>`}
        </div>
      <//>

      <div class="knapperad vertikal">
        <button class="knapp fare-tekst" onClick=${slettObs}>Flytt observasjon til papirkurv</button>
      </div>
    </main>
    <div class="bunnlinje">
      <a class="knapp stor" href=${'#/' + tilbake}>‹ Befaring</a>
      <button class="knapp primar stor full" onClick=${nesteObs}>+ Ny observasjon</button>
    </div>
  `;
}

function Stedsfelt({ sf, verdi, onSave }) {
  if (sf.type === 'valg') {
    return html`<${Chips} label=${sf.navn} options=${sf.valg || []} value=${verdi} onChange=${onSave} hjelp=${sf.hjelp} />`;
  }
  if (sf.type === 'tall' || sf.type === 'heltall') {
    return html`<${NumField} label=${sf.navn} value=${verdi} onSave=${onSave} heltall=${sf.type === 'heltall'}
      min=${sf.min} max=${sf.max} enhet=${sf.enhet} hjelp=${sf.hjelp} />`;
  }
  return html`<${TextField} label=${sf.navn} value=${verdi} onSave=${onSave} hjelp=${sf.hjelp} />`;
}

function MalingRad({ m, t, autoFocus, onBytt, onSlett }) {
  const def = t.maletyper.find((x) => x.navn === m.type) || {};
  const lagre = (k) => (v) => patch('malinger', m.id, { [k]: v });
  return html`<div class="rad-kort">
    <div class="rad-kort-topp">
      <button class="lenke stor" onClick=${onBytt}>${m.type} ▾</button>
      <button class="knapp flat liten fare-tekst" aria-label="Slett måling" onClick=${onSlett}>✕</button>
    </div>
    <div class="rad-verdi">
      <${NumField} label="Verdi" value=${m.verdi} onSave=${lagre('verdi')} min=${def.min} max=${def.max}
        heltall=${def.heltall} autoFocus=${autoFocus} klasse="verdi" />
      <${TextField} label="Enhet" value=${m.enhet} onSave=${lagre('enhet')} klasse="enhet-felt" autocap="none" />
    </div>
    <${TextField} label="Kommentar" value=${m.kommentar} onSave=${lagre('kommentar')} />
  </div>`;
}

function SettRad({ s, format, felles, autoFocus, onSlett }) {
  const [apen, setApen] = useState(autoFocus || s.fall === null || s.fall === undefined);
  const lagre = (k) => (v) => patch('sprekkesett', s.id, { [k]: v });
  const strok = fallretningTilStrok(s.fallretning);
  const harBegge = s.fall !== null && s.fall !== undefined && s.fallretning !== null && s.fallretning !== undefined;
  const ae = felles.sprekkesettFelt.avstandEnhet;
  const ue = felles.sprekkesettFelt.utholdenhetEnhet;

  if (!apen) {
    const detaljer = [
      s.avstand !== null && s.avstand !== undefined ? `avstand ${fmtNum(s.avstand)} ${ae}` : '',
      s.utholdenhet !== null && s.utholdenhet !== undefined ? `utholdenhet ${fmtNum(s.utholdenhet)} ${ue}` : '',
      s.ruhet || '',
    ].filter(Boolean).join(' · ');
    return html`<button class="rad-kort sammendrag" onClick=${() => setApen(true)}>
      <span class="sett-kompass"><${Kompass} fall=${s.fall} fallretning=${s.fallretning} storrelse=${40} /></span>
      <span class="sett-navn">${s.navn || 'Uten navn'}</span>
      <span class="sett-orient">${format === 'strok' ? `${fmtRetning(strok)}/${fmtFall(s.fall)}` : `${fmtFall(s.fall)}/${fmtRetning(s.fallretning)}`}</span>
      <span class="sett-detalj">${detaljer || (s.kommentar ? s.kommentar : 'Trykk for å redigere')}</span>
      <span class="pil">›</span>
    </button>`;
  }

  const fallFelt = html`<${NumField} label="Fall" enhet="°" value=${s.fall} onSave=${lagre('fall')} min=${0} max=${90} heltall
    autoFocus=${autoFocus && format !== 'strok'} />`;
  const orientering = format === 'strok'
    ? html`<${NumField} label="Strøk" enhet="°" value=${strok} min=${0} max=${360} heltall autoFocus=${autoFocus}
        onSave=${(v) => patch('sprekkesett', s.id, { fallretning: v === null ? null : strokTilFallretning(v) })} />${fallFelt}`
    : html`${fallFelt}<${NumField} label="Fallretning" enhet="°" value=${s.fallretning} onSave=${lagre('fallretning')} min=${0} max=${360} heltall />`;
  return html`<div class="rad-kort">
    <div class="rad-kort-topp">
      <button class="lenke stor" onClick=${() => setApen(false)}>${s.navn || 'Uten navn'} ▴</button>
      <button class="knapp flat liten fare-tekst" aria-label="Slett sprekkesett" onClick=${onSlett}>✕</button>
    </div>
    <div class="rad2">${orientering}</div>
    <div class="orientering-rad">
      <${Kompass} fall=${s.fall} fallretning=${s.fallretning} storrelse=${76} />
      <div class="orientering-sammendrag">
        ${harBegge
          ? html`Fall/fallretning <strong>${fmtFall(s.fall)}/${fmtRetning(s.fallretning)}</strong><br />strøk/fall ${fmtRetning(strok)}/${fmtFall(s.fall)}`
          : html`Kompasset viser strøklinje og fallpil når fall og retning er fylt ut.`}
      </div>
    </div>
    <${Chips} label="Navn" options=${felles.sprekkesettnavn} value=${s.navn} onChange=${(v) => v && patch('sprekkesett', s.id, { navn: v })} kompakt />
    <${TextField} label="Eget navn" value=${s.navn} onSave=${lagre('navn')} autocap="none" />
    <div class="rad2">
      <${NumField} label="Sprekkeavstand" enhet=${ae} value=${s.avstand} onSave=${lagre('avstand')} min=${0} />
      <${NumField} label="Utholdenhet" enhet=${ue} value=${s.utholdenhet} onSave=${lagre('utholdenhet')} min=${0} />
    </div>
    <${TextField} label="Ruhet/fylling" value=${s.ruhet} onSave=${lagre('ruhet')} />
    <${TextField} label="Kommentar" value=${s.kommentar} onSave=${lagre('kommentar')} />
  </div>`;
}
