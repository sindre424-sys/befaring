// Små hjelpefunksjoner: id-er, tall og datoer i norsk format.

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** Tolker tekst som tall. Godtar både komma og punktum som desimaltegn.
 *  Returnerer null for tom tekst og NaN for ugyldig tekst. */
export function parseNum(str) {
  if (str === null || str === undefined) return null;
  const s = String(str).trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

/** Viser tall med komma som desimaltegn. */
export function fmtNum(n, maxDes = 2) {
  if (n === null || n === undefined || n === '' || Number.isNaN(n)) return '';
  const r = Math.round(Number(n) * 10 ** maxDes) / 10 ** maxDes;
  return String(r).replace('.', ',');
}

export const pad2 = (n) => String(n).padStart(2, '0');
export const pad3 = (n) => String(n).padStart(3, '0');

export function fmtDato(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
export function fmtTid(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
export const fmtDatoTid = (ts) => (ts ? `${fmtDato(ts)} kl. ${fmtTid(ts)}` : '');

/** Tidsstempel → verdi for <input type="datetime-local"> */
export function toLocalInput(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
export function fromLocalInput(s) {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

export function profilTekst(fra, til) {
  const f = fmtNum(fra, 1);
  const t = fmtNum(til, 1);
  if (f && t && f !== t) return `Profil ${f}–${t}`;
  if (f) return `Profil ${f}`;
  if (t) return `Profil ${t}`;
  return 'Profil ikke angitt';
}

export const obsNr = (n) => pad2(n || 0);

export function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'type';
}

export const ALVORLIGHET = {
  gronn: { navn: 'Grønn', farge: 'var(--gronn)' },
  gul: { navn: 'Gul', farge: 'var(--gul)' },
  rod: { navn: 'Rød', farge: 'var(--rod)' },
};

export const isStandalone = () =>
  window.navigator.standalone === true ||
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

/** Retning 0–360 normalisert */
export const norm360 = (a) => ((a % 360) + 360) % 360;
