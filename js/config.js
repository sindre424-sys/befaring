// Konfigurasjon per objekttype. Standardverdiene ligger i /config/*.json.
// Endringer fra innstillingssiden lagres i databasen og overstyrer standardverdiene.
import { db, useLive, STANDARD_INNSTILLINGER, setConfigRad, slettConfigRad } from './db.js';
import { useMemo, createContext, useContext } from './lib.js';
import { slug, uid } from './util.js';

export const STANDARD_TYPER = ['skjaering', 'pahugg', 'tunnel'];

let DEFAULTS = null;

export async function lastStandardConfig() {
  const hent = async (navn) => {
    const r = await fetch(`config/${navn}.json`);
    if (!r.ok) throw new Error(`Fant ikke config/${navn}.json`);
    return r.json();
  };
  const [felles, ...typer] = await Promise.all([hent('felles'), ...STANDARD_TYPER.map(hent)]);
  DEFAULTS = { felles, typer: Object.fromEntries(typer.map((t) => [t.id, t])) };
  return DEFAULTS;
}

export const standardConfig = () => DEFAULTS;

/** Gjør konfigurasjonen robust mot manglende felt (f.eks. egne typer). */
function normaliserType(c, id) {
  return {
    navn: id,
    kortnavn: c.navn || id,
    ikon: '◆',
    aktiv: true,
    rekkefolge: 50,
    profil: { fra: true, til: true, fraNavn: 'Profil fra', tilNavn: 'Profil til' },
    stedsfelt: [],
    posisjoner: [],
    observasjonstyper: [],
    status: [],
    maletyper: [],
    geometri: null,
    skisser: [],
    ...c,
    id,
  };
}

export function byggConfig(rader) {
  const map = Object.fromEntries((rader || []).map((r) => [r.key, r.value]));
  const egne = map['config:egne'] || [];
  const typer = {};
  for (const id of [...STANDARD_TYPER, ...egne]) {
    const std = DEFAULTS.typer[id] || {};
    const over = map['config:type:' + id];
    if (!over && !DEFAULTS.typer[id]) continue;
    typer[id] = normaliserType({ ...std, ...(over || {}) }, id);
    typer[id].endret = !!over;
    typer[id].egen = !DEFAULTS.typer[id];
  }
  const felles = { ...DEFAULTS.felles, ...(map['config:felles'] || {}) };
  const liste = Object.values(typer).sort((a, b) => (a.rekkefolge ?? 99) - (b.rekkefolge ?? 99));
  const innstillinger = { ...STANDARD_INNSTILLINGER, ...(map['generelt'] || {}) };
  return { typer, felles, liste, innstillinger, fellesEndret: !!map['config:felles'] };
}

/** Henter konfigurasjon + innstillinger og oppdateres automatisk ved endringer. */
export function useConfigLive() {
  const rader = useLive(() => db.innstillinger.toArray(), [], null);
  return useMemo(() => (rader ? byggConfig(rader) : null), [rader]);
}

export async function hentConfig() {
  return byggConfig(await db.innstillinger.toArray());
}

export const Ctx = createContext(null);
export const useCtx = () => useContext(Ctx);

export function typeCfg(ctx, id) {
  return ctx.config.typer[id] || normaliserType({ navn: id || 'Ukjent type' }, id || 'ukjent');
}

// ---------- Redigering ----------
export async function lagreType(cfg) {
  const { id, endret, egen, ...rest } = cfg;
  await setConfigRad('config:type:' + id, rest);
}
export async function tilbakestillType(id) {
  await slettConfigRad('config:type:' + id);
}
export async function lagreFelles(felles) {
  await setConfigRad('config:felles', felles);
}
export async function tilbakestillFelles() {
  await slettConfigRad('config:felles');
}

export async function nyType(navn, malId, config) {
  const id = slug(navn) + '-' + uid().slice(0, 4);
  const mal = malId && config.typer[malId] ? JSON.parse(JSON.stringify(config.typer[malId])) : {};
  delete mal.endret;
  delete mal.egen;
  const cfg = normaliserType(
    {
      ...mal,
      navn,
      kortnavn: navn,
      ikon: mal.ikon || '◆',
      rekkefolge: 10 + config.liste.length,
      skisser: [],
      aktiv: true,
    },
    id,
  );
  if (!malId) {
    cfg.posisjoner = ['Annet'];
    cfg.observasjonstyper = ['Annet'];
    cfg.status = ['Annet'];
    cfg.maletyper = [{ navn: 'Annet', enhet: '', gruppe: 'Annet' }];
  }
  const egneRad = await db.innstillinger.get('config:egne');
  const egne = egneRad ? egneRad.value : [];
  await lagreType(cfg);
  await setConfigRad('config:egne', [...egne, id]);
  return id;
}
