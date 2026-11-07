// Fyller ut malen for arbeidsbeskrivelse i PowerPoint. Malen leses fra en fil på PC-en og ligger aldri i appen.
// Utseendet kommer fra malen. Her settes bare tekst, bilder og sikringssymboler inn.
// Symbolene blir ekte PowerPoint-figurer, så de kan flyttes og endres etterpå.
import { lastJszip } from './last.js';
import { mengder, annenMengde } from '../sikring.js';
import { fmtNum } from '../util.js';

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const DEKL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const RELTYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const SLIDETYPE = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';

const emu = (pt) => Math.round(pt * 12700);
const pt = (e) => Number(e) / 12700;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const les = (xml) => new DOMParser().parseFromString(xml, 'application/xml');
const skriv = (doc) => DEKL + new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, '');
const barn = (el, navn) => [...el.children].filter((c) => c.localName === navn);
const alle = (el, ns, navn) => [...el.getElementsByTagNameNS(ns, navn)];
const tekstI = (el) => alle(el, A, 't').map((t) => t.textContent).join('');

// ---------- Tekst og tabeller ----------
function formFor(p) {
  const r = barn(p, 'r')[0];
  const rPr = r ? barn(r, 'rPr')[0] : null;
  return rPr || barn(p, 'endParaRPr')[0] || null;
}

/** Bytter innholdet i en celle eller et tekstfelt og beholder malens skrift. Ett avsnitt per linje. */
function settTekst(txEier, linjer, { linjeavstand } = {}) {
  const tx = barn(txEier, 'txBody')[0];
  const doc = tx.ownerDocument;
  const ps = barn(tx, 'p');
  const pPr = barn(ps[0], 'pPr')[0] || null;
  const form = ps.map(formFor).find(Boolean) || null;
  ps.forEach((p) => p.remove());
  for (const linje of linjer.length ? linjer : ['']) {
    const p = doc.createElementNS(A, 'a:p');
    let ny = pPr ? pPr.cloneNode(true) : null;
    if (linjeavstand) {
      if (!ny) ny = doc.createElementNS(A, 'a:pPr');
      barn(ny, 'lnSpc').forEach((x) => x.remove());
      const ls = doc.createElementNS(A, 'a:lnSpc');
      const pts = doc.createElementNS(A, 'a:spcPts');
      pts.setAttribute('val', String(Math.round(linjeavstand * 100)));
      ls.appendChild(pts);
      ny.insertBefore(ls, ny.firstChild);
    }
    if (ny) p.appendChild(ny);
    const lagForm = (navn) => {
      const f = doc.createElementNS(A, navn);
      if (form) {
        for (const a of form.attributes) f.setAttribute(a.name, a.value);
        for (const c of form.children) f.appendChild(c.cloneNode(true));
      }
      return f;
    };
    if (linje !== '') {
      const r = doc.createElementNS(A, 'a:r');
      r.appendChild(lagForm('a:rPr'));
      const t = doc.createElementNS(A, 'a:t');
      t.textContent = linje;
      r.appendChild(t);
      p.appendChild(r);
    } else {
      p.appendChild(lagForm('a:endParaRPr'));
    }
    tx.appendChild(p);
  }
}

const rader = (tbl) => barn(tbl, 'tr');
const celler = (tr) => barn(tr, 'tc');
const tabellMed = (doc, tekst) => alle(doc, A, 'tbl').find((t) => tekstI(t).includes(tekst));

function formerNavn(doc, navn) {
  return alle(doc, P, 'cNvPr').filter((n) => n.getAttribute('name') === navn).map((n) => n.parentElement.parentElement);
}

function oppdragsinfo(doc, dok) {
  for (const tbl of alle(doc, A, 'tbl')) {
    if (!tekstI(tbl).includes('Oppdragsgiver:')) continue;
    const [r0, r1] = rader(tbl);
    settTekst(celler(r0)[1], [dok.oppdragsgiver]);
    settTekst(celler(r0)[3], [dok.oppdragsnummer]);
    settTekst(celler(r1)[1], [dok.oppdragsnavn]);
    settTekst(celler(r1)[3], [dok.dokumentnummer]);
  }
}

function sidetall(doc, nr, sum) {
  for (const sp of formerNavn(doc, 'Sidenummerering')) settTekst(sp, [`Side ${nr} av ${sum}`]);
}

/** Bytter [plassholdere] i malens tekster, én etter én. */
function byttRekkefolge(el, soke, verdier) {
  const ko = [...verdier];
  for (const t of alle(el, A, 't')) {
    while (t.textContent.includes(soke) && ko.length) t.textContent = t.textContent.replace(soke, ko.shift());
  }
}

// ---------- Figurer ----------
const leggTil = (spTree, xml) => {
  const rot = les(`<rot xmlns:a="${A}" xmlns:p="${P}" xmlns:r="${R}">${xml}</rot>`).documentElement;
  const slutt = barn(spTree, 'extLst')[0] || null;
  for (const n of [...rot.childNodes]) spTree.insertBefore(spTree.ownerDocument.importNode(n, true), slutt);
};

const ROD = 'FF0000';
const lnXml = (b, farge = ROD) => `<a:ln w="${emu(b)}"><a:solidFill><a:srgbClr val="${farge}"/></a:solidFill></a:ln>`;
const hvit = '<a:solidFill><a:schemeClr val="bg1"/></a:solidFill>';
const rod = `<a:solidFill><a:srgbClr val="${ROD}"/></a:solidFill>`;

function form(s, navn, prst, x, y, w, h, fyll, ln, flipV = false) {
  s.boks.push([x, y, x + w, y + h]);
  return `<p:sp><p:nvSpPr><p:cNvPr id="${s.id++}" name="${esc(navn)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>`
    + `<a:xfrm${flipV ? ' flipV="1"' : ''}><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>`
    + `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${fyll}${ln}</p:spPr></p:sp>`;
}

/** Samme mål som i appen (js/sikring.js), så symbolene ser like ut på skjerm og i dokumentet. */
function symbolXml(ctx, fg, cx, cy, d) {
  const r = d / 2;
  const sw = d * 0.11;
  const s = { id: ctx.id + 1, boks: [] };
  const grp = ctx.id;
  const ln = lnXml(sw);
  const deler = [];
  let bunn = cy + r;
  let prikkY = cy;
  if (fg.form === 'trekant') {
    bunn = cy + r * 0.75;
    prikkY = cy + r * 0.28;
    deler.push(form(s, 'Trekant', 'triangle', cx - r * 1.08, cy - r * 0.98, r * 2.16, r * 1.73, hvit, ln));
  } else if (fg.form === 'firkant') {
    bunn = cy + r * 0.85;
    deler.push(form(s, 'Firkant', 'rect', cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7, hvit, ln));
  } else if (fg.form === 'femkant') {
    const R5 = r * 1.05;
    bunn = cy + r * 0.85;
    deler.push(form(s, 'Femkant', 'pentagon', cx - R5 * 0.951, cy - R5, R5 * 1.902, R5 * 1.809, hvit, ln));
  } else if (fg.form === 'stjerne') {
    const tynn = lnXml(sw * 0.65);
    deler.push(form(s, 'Trekant', 'triangle', cx - r * 0.866, cy - r, r * 1.732, r * 1.5, hvit, tynn));
    deler.push(form(s, 'Trekant', 'triangle', cx - r * 0.866, cy - r * 0.5, r * 1.732, r * 1.5, '<a:noFill/>', tynn, true));
  } else if (fg.form === 'sirkelkryss') {
    deler.push(form(s, 'Sirkel med kryss', 'flowChartOr', cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8, hvit, ln));
  } else if (fg.form === 'kryss') {
    deler.push(form(s, 'Rensk', 'mathMultiply', cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6, hvit, lnXml(sw * 0.7)));
  } else {
    deler.push(form(s, 'Ring', 'ellipse', cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8, hvit, ln));
  }
  const n = Number(fg.prikker) || 0;
  const pr = r * 0.27;
  const prikk = lnXml(0.25);
  if (n === 1) {
    const p1 = pr * 1.15;
    deler.push(form(s, 'Prikk', 'ellipse', cx - p1, prikkY - p1, p1 * 2, p1 * 2, rod, prikk));
  } else if (n > 1) {
    const y = bunn + sw * 0.5 + pr * 1.35;
    const avstand = pr * 2.5;
    for (let i = 0; i < n; i++) deler.push(form(s, 'Prikk', 'ellipse', cx + (i - (n - 1) / 2) * avstand - pr, y - pr, pr * 2, pr * 2, rod, prikk));
  }
  ctx.id = s.id;
  const x0 = Math.min(...s.boks.map((b) => b[0]));
  const y0 = Math.min(...s.boks.map((b) => b[1]));
  const x1 = Math.max(...s.boks.map((b) => b[2]));
  const y1 = Math.max(...s.boks.map((b) => b[3]));
  const off = `x="${emu(x0)}" y="${emu(y0)}"`;
  const ext = `cx="${emu(x1 - x0)}" cy="${emu(y1 - y0)}"`;
  return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${grp}" name="${esc(fg.navn || 'Symbol')}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
    + `<p:grpSpPr><a:xfrm><a:off ${off}/><a:ext ${ext}/><a:chOff ${off}/><a:chExt ${ext}/></a:xfrm></p:grpSpPr>${deler.join('')}</p:grpSp>`;
}

function polygonXml(ctx, navn, stil, punkter) {
  const xs = punkter.map((q) => q[0]);
  const ys = punkter.map((q) => q[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 || 1;
  const h = Math.max(...ys) - y0 || 1;
  const sti = punkter.map((q, i) => {
    const pos = `<a:pt x="${emu(q[0] - x0)}" y="${emu(q[1] - y0)}"/>`;
    return i ? `<a:lnTo>${pos}</a:lnTo>` : `<a:moveTo>${pos}</a:moveTo>`;
  }).join('');
  const fyll = stil === 'bla'
    ? '<a:solidFill><a:schemeClr val="accent1"><a:alpha val="30000"/></a:schemeClr></a:solidFill>'
    : '<a:noFill/>';
  const ln = stil === 'bla' ? lnXml(1, '0070C0') : lnXml(2.25, 'FFFF00');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${ctx.id++}" name="${esc(navn)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>`
    + `<a:xfrm><a:off x="${emu(x0)}" y="${emu(y0)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>`
    + `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}">${sti}<a:close/></a:path></a:pathLst></a:custGeom>`
    + `${fyll}${ln}</p:spPr></p:sp>`;
}

const bildeXml = (ctx, rid, x, y, w, h, tekst) => `<p:pic><p:nvPicPr><p:cNvPr id="${ctx.id++}" name="Bilde" descr="${esc(tekst)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`
  + `<p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>`
  + `<p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;

// ---------- Side med bilde ----------
const OMRADE = { staaende: { x: 14, y: 14, b: 521, h: 427 }, liggende: { x: 14, y: 14, b: 692, h: 329 } };
const LINJE_MAKS = 14;
const LINJE_MIN = 11;

function tabellMal(graphicFrame, tbl) {
  const xfrm = barn(graphicFrame, 'xfrm')[0];
  const off = barn(xfrm, 'off')[0];
  const kol = barn(barn(tbl, 'tblGrid')[0], 'gridCol').map((c) => pt(c.getAttribute('w')));
  const rad = rader(tbl).map((r) => pt(r.getAttribute('h')));
  const sum = (a, n) => a.slice(0, n).reduce((s, v) => s + v, 0);
  return { x: pt(off.getAttribute('x')), y: pt(off.getAttribute('y')), kol, rad, sum };
}

/** Fyller én rubrikk med linjer på fast avstand, så symbolene treffer tekstlinjene. */
function linjerFor(antall, hoyde) {
  const fri = hoyde - 5;
  const avstand = antall ? Math.min(LINJE_MAKS, Math.max(LINJE_MIN, fri / antall)) : LINJE_MAKS;
  return { avstand, plass: Math.floor(fri / LINJE_MIN) };
}

function fyllSide(doc, ctx, side, rid, advarsler, sideNr) {
  const spTree = alle(doc, P, 'spTree')[0];
  for (const sp of alle(doc, P, 'sp')) if (tekstI(sp).startsWith('Bilde skjæring med symboler')) sp.remove();

  const tbl = tabellMed(doc, 'Boltesikring');
  const ramme = tbl.parentElement.parentElement.parentElement;
  const rr = rader(tbl);
  const liggende = rr.length === 3;
  const mal = tabellMal(ramme, tbl);
  const m = mengder(side.foto.tegning);

  const bolter = m.bolter.map((b) => ({ ...b, type: side.boltetyper[`${b.lengde}|${b.dim}`] || '' }));
  const boltRad = rr[2];
  const annenRad = liggende ? rr[2] : rr[5];
  const c = celler(boltRad);
  const ca = celler(annenRad);
  const kolBolt = { symbol: 0, lengde: 1, dim: 2, type: 3, antall: liggende ? 4 : 5 };
  const kolAnnen = liggende ? { symbol: 6, tekst: 7, mengde: 8 } : { symbol: 0, tekst: 1, mengde: 4 };
  const bredBeskr = liggende ? mal.kol[7] : mal.kol[1] + mal.kol[2] + mal.kol[3];

  // Boltesikring
  const lb = linjerFor(bolter.length, mal.rad[2]);
  if (bolter.length > lb.plass) advarsler.push(`Side ${sideNr}: ${bolter.length} boltetyper, men plass til ${lb.plass} uten at tabellen vokser.`);
  const opt = { linjeavstand: lb.avstand };
  settTekst(c[kolBolt.lengde], bolter.map((b) => `${fmtNum(b.lengde)} m`), opt);
  settTekst(c[kolBolt.dim], bolter.map((b) => `Ø${b.dim}`), opt);
  settTekst(c[kolBolt.type], bolter.map((b) => b.type), opt);
  settTekst(c[kolBolt.antall], bolter.map((b) => String(b.antall)), opt);

  // Annen sikring. Lang tekst går over flere linjer, og tomme linjer holder de andre kolonnene på høyde.
  const linjerPerRad = m.annen.map((a) => Math.max(1, Math.ceil(((a.beskrivelse || a.navn).length * 3) / (bredBeskr - 5))));
  const hoydeAnnen = mal.rad[liggende ? 2 : 5];
  const la = linjerFor(linjerPerRad.reduce((s, n) => s + n, 0), hoydeAnnen);
  const beskr = [];
  const meng = [];
  const startLinje = [];
  m.annen.forEach((a, i) => {
    startLinje.push(meng.length);
    beskr.push(a.beskrivelse || a.navn);
    meng.push(annenMengde(a), ...Array(linjerPerRad[i] - 1).fill(''));
  });
  const optA = { linjeavstand: la.avstand };
  settTekst(ca[kolAnnen.tekst], beskr, optA);
  settTekst(ca[kolAnnen.mengde], meng, optA);
  if (meng.length > la.plass) advarsler.push(`Side ${sideNr}: «Annen sikring» trenger mer plass enn rubrikken har.`);

  if (!liggende) {
    settTekst(ca[5], ['']); // fjerner gamle tall som ligger igjen i malen
    settTekst(celler(rr[7])[0], side.kommentar ? side.kommentar.split('\n') : ['']);
  } else {
    settTekst(celler(rr[1])[10], side.kommentar ? side.kommentar.split('\n') : ['']);
  }

  // Sted og dato
  const sted = rader(tabellMed(doc, 'Sted/bergskjæring:'));
  settTekst(celler(sted[0])[1], [side.sted]);
  settTekst(celler(sted[1])[1], [side.dato]);
  settTekst(celler(sted[2])[1], [side.av]);

  // Bilde, med figurene oppå
  const omr = OMRADE[liggende ? 'liggende' : 'staaende'];
  const { bredde: W, hoyde: H } = side.bilde;
  const s = Math.min(omr.b / W, omr.h / H);
  const bb = W * s;
  const bh = H * s;
  const bx = omr.x + (omr.b - bb) / 2;
  const by = omr.y + (omr.h - bh) / 2;
  const deler = [bildeXml(ctx, rid, bx, by, bb, bh, side.sted)];
  const t = side.foto.tegning;
  const tilSide = (q) => [bx + (q[0] / t.bredde) * bb, by + (q[1] / t.hoyde) * bh];
  const d = Math.max(bb, bh) * 0.035 * (t.symbolSkala || 1);
  const figurer = t.figurer || [];
  for (const f of figurer.filter((x) => x.type === 'polygon')) deler.push(polygonXml(ctx, f.navn, f.stil, f.punkter.map(tilSide)));
  for (const f of figurer.filter((x) => x.type === 'symbol')) {
    const [cx, cy] = tilSide([f.x, f.y]);
    deler.push(symbolXml(ctx, f, cx, cy, d));
  }

  // Symboler i tabellene, på høyde med tekstlinjene
  const celleTopp = (rad) => mal.y + mal.sum(mal.rad, rad) + 2.1;
  const midtKol = (k) => mal.x + mal.sum(mal.kol, k) + mal.kol[k] / 2;
  const toppBolt = celleTopp(2);
  bolter.forEach((b, i) => {
    const cy = toppBolt + (i + 0.5) * lb.avstand - lb.avstand * 0.08;
    deler.push(symbolXml(ctx, { ...b, navn: b.navn }, midtKol(0), cy, Math.min(8, lb.avstand * 0.6)));
  });
  const toppAnnen = celleTopp(liggende ? 2 : 5);
  const xa = midtKol(kolAnnen.symbol);
  m.annen.forEach((a, i) => {
    const cy = toppAnnen + (startLinje[i] + 0.5) * la.avstand;
    if (a.stil) {
      const b = 7;
      const h = la.avstand * 0.32;
      deler.push(polygonXml(ctx, a.navn, a.stil, [[xa - b, cy], [xa, cy - h], [xa + b, cy - h * 0.2], [xa + b * 0.4, cy + h]]));
    } else {
      deler.push(symbolXml(ctx, { form: a.form, prikker: '0', navn: a.navn }, xa, cy, Math.min(8, la.avstand * 0.6)));
    }
  });
  leggTil(spTree, deler.join(''));
}

// ---------- Hele dokumentet ----------
const erStaaende = (d) => rader(tabellMed(d, 'Boltesikring')).length > 3;

/**
 * mal: ArrayBuffer med malen. dok: dokumentfelt. versjoner: rader i versjonstabellen.
 * sider: [{ foto, bilde: { blob, bredde, hoyde }, sted, dato, av, kommentar, boltetyper }]
 */
export async function lagArbeidsbeskrivelse({ mal, dok, versjoner, sider }) {
  const JSZip = await lastJszip();
  const zip = await JSZip.loadAsync(mal);
  const lesFil = (n) => zip.file(n).async('string');

  const presSti = 'ppt/presentation.xml';
  let pres = await lesFil(presSti);
  let presRels = await lesFil('ppt/_rels/presentation.xml.rels');
  let typer = await lesFil('[Content_Types].xml');

  const rid2mal = Object.fromEntries([...presRels.matchAll(/<Relationship\b[^>]*>/g)].map(([x]) => [x.match(/Id="([^"]+)"/)[1], x.match(/Target="([^"]+)"/)[1]]));
  const sldIder = [...pres.matchAll(/<p:sldId\b[^>]*>/g)].map(([x]) => ({ id: Number(x.match(/ id="(\d+)"/)[1]), rid: x.match(/r:id="([^"]+)"/)[1] }));
  const malSider = [];
  for (const s of sldIder) {
    const sti = 'ppt/' + rid2mal[s.rid];
    malSider.push({ ...s, sti, navn: sti.split('/').pop(), xml: await lesFil(sti), rels: await lesFil(sti.replace('slides/', 'slides/_rels/') + '.rels') });
  }
  for (const m of malSider) m.doc = les(m.xml);
  const finn = (fn) => malSider.find((m) => fn(m.doc));
  const forside = malSider[0];
  const versjonSide = finn((d) => !!tabellMed(d, 'Versjon'));
  const sideStaaende = finn((d) => !!tabellMed(d, 'Boltesikring') && erStaaende(d));
  const sideLiggende = finn((d) => !!tabellMed(d, 'Boltesikring') && !erStaaende(d));
  const bakside = malSider[malSider.length - 1];
  if (!versjonSide || !sideStaaende || !sideLiggende || new Set([forside, versjonSide, sideStaaende, sideLiggende, bakside]).size !== 5) {
    throw new Error('Filen ser ikke ut som malen for arbeidsbeskrivelse.');
  }

  // Sider med bilde lages som kopier av malens stående eller liggende side
  const advarsler = [];
  const nye = [];
  let nesteNr = Math.max(...[...zip.file(/^ppt\/slides\/slide\d+\.xml$/)].map((f) => Number(f.name.match(/(\d+)\.xml/)[1]))) + 1;
  let nesteSldId = Math.max(...sldIder.map((s) => s.id), 255) + 1;
  sider.forEach((side, i) => {
    const liggende = side.bilde.bredde >= side.bilde.hoyde;
    const kilde = liggende ? sideLiggende : sideStaaende;
    const doc = les(kilde.xml);
    const ider = alle(doc, P, 'cNvPr').map((n) => Number(n.getAttribute('id')) || 0);
    const ctx = { id: Math.max(...ider) + 1 };
    const rid = 'rIdBilde1';
    const media = `ppt/media/befaring${i + 1}.jpg`;
    zip.file(media, side.bilde.blob);
    fyllSide(doc, ctx, side, rid, advarsler, i + 3);
    const nr = nesteNr++;
    nye.push({
      navn: `slide${nr}.xml`, doc, id: nesteSldId++, rid: `rIdSide${nr}`,
      rels: kilde.rels.replace('</Relationships>', `<Relationship Id="${rid}" Type="${RELTYPE}/image" Target="../media/befaring${i + 1}.jpg"/></Relationships>`),
    });
  });

  // Forside, versjoner og bakside
  byttRekkefolge(forside.doc, '[Bergskjæring (navn, profil etc.)]', [dok.tittel]);
  byttRekkefolge(forside.doc, '[Dokumentnummer]', [dok.dokumentnummer]);
  byttRekkefolge(forside.doc, '[versjon]', [dok.versjon]);
  byttRekkefolge(forside.doc, '[XXX]', [dok.til, dok.fra]);
  const vt = rader(tabellMed(versjonSide.doc, 'Versjon'));
  vt.slice(1).forEach((rad, i) => {
    const v = versjoner[i] || {};
    [v.versjon, v.dato, v.beskrivelse, v.utarbeidet, v.kontrollert, v.godkjent].forEach((tekst, k) => settTekst(celler(rad)[k], [tekst || '']));
  });
  for (const sp of alle(bakside.doc, P, 'sp')) {
    if (tekstI(sp).includes('Oppdragsgiver:')) settTekst(sp, [`Oppdragsgiver: ${dok.oppdragsgiver}  Oppdragsnr.: ${dok.oppdragsnummer}  ${dok.oppdragsnavn}  Dokumentnr.: ${dok.dokumentnummer}`]);
  }

  const rekke = [
    { ...forside, gammel: true }, { ...versjonSide, gammel: true },
    ...nye,
    { ...bakside, gammel: true },
  ];
  rekke.forEach((s, i) => {
    oppdragsinfo(s.doc, dok);
    sidetall(s.doc, i + 1, rekke.length);
  });

  // Skriv sidene
  for (const s of rekke) {
    zip.file(`ppt/slides/${s.navn}`, skriv(s.doc));
    if (!s.gammel) {
      zip.file(`ppt/slides/_rels/${s.navn}.rels`, s.rels);
      typer = typer.replace('</Types>', `<Override PartName="/ppt/slides/${s.navn}" ContentType="${SLIDETYPE}"/></Types>`);
      presRels = presRels.replace('</Relationships>', `<Relationship Id="${s.rid}" Type="${RELTYPE}/slide" Target="slides/${s.navn}"/></Relationships>`);
    }
  }
  for (const m of [sideStaaende, sideLiggende]) {
    zip.remove(m.sti);
    zip.remove(m.sti.replace('slides/', 'slides/_rels/') + '.rels');
    typer = typer.replace(new RegExp(`<Override PartName="/${m.sti}"[^>]*/>`), '');
    presRels = presRels.replace(new RegExp(`<Relationship\\b[^>]*Id="${m.rid}"[^>]*/>`), '');
  }
  pres = pres.replace(/<p:sldIdLst>.*?<\/p:sldIdLst>/s, `<p:sldIdLst>${rekke.map((s) => `<p:sldId id="${s.id}" r:id="${s.rid}"/>`).join('')}</p:sldIdLst>`);

  // Uten makroer: appen tar seg av sidetall og oppdragsinfo. Endringshistorikken fra malen følger heller ikke med.
  zip.remove('ppt/vbaProject.bin');
  typer = typer.replace(/<Override PartName="\/ppt\/vbaProject\.bin"[^>]*\/>/, '');
  typer = typer.replace('application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml', 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml');
  presRels = presRels.replace(/<Relationship\b[^>]*vbaProject[^>]*\/>/, '');
  for (const n of Object.keys(zip.files).filter((f) => f.startsWith('ppt/changesInfos/') || f === 'ppt/revisionInfo.xml')) {
    if (!zip.files[n].dir) {
      typer = typer.replace(new RegExp(`<Override PartName="/${n.replace('.', '\\.')}"[^>]*/>`), '');
      zip.remove(n);
    }
  }
  zip.remove('ppt/changesInfos');
  presRels = presRels.replace(/<Relationship\b[^>]*(?:changesInfo|revisionInfo)[^>]*\/>/g, '');

  zip.file(presSti, pres);
  zip.file('ppt/_rels/presentation.xml.rels', presRels);
  zip.file('[Content_Types].xml', typer);

  // Antall sider i dokumentegenskapene
  const app = zip.file('docProps/app.xml') ? await lesFil('docProps/app.xml') : null;
  if (app) {
    const ekstra = rekke.length - malSider.length;
    let ny = app.replace(/<Slides>\d+<\/Slides>/, `<Slides>${rekke.length}</Slides>`);
    ny = ny.replace(/(<vt:lpstr>Slide Titles<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>)\d+/, `$1${rekke.length}`);
    ny = ny.replace(/<TitlesOfParts><vt:vector size="(\d+)" baseType="lpstr">(.*?)<\/vt:vector>/s, (_, n, inn) => {
      let deler = [...inn.matchAll(/<vt:lpstr>.*?<\/vt:lpstr>/gs)].map((x) => x[0]);
      if (ekstra < 0) deler = deler.slice(0, ekstra);
      else deler = deler.concat(Array(ekstra).fill('<vt:lpstr>PowerPoint Presentation</vt:lpstr>'));
      return `<TitlesOfParts><vt:vector size="${deler.length}" baseType="lpstr">${deler.join('')}</vt:vector>`;
    });
    zip.file('docProps/app.xml', ny);
  }

  const blob = await zip.generateAsync({
    type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 },
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  const navn = `${dok.dokumentnummer || 'Arbeidsbeskrivelse'} ${dok.tittel || ''}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  return { fil: new File([blob], `${navn}.pptx`, { type: blob.type }), advarsler };
}
