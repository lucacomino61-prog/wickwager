#!/usr/bin/env node
// Writes gallery.html: every registered sprite, for review. A standalone page (open it from disk or serve it)
// that inlines src/content.js and every src/art/*.js in name order, so it always shows the art as it is now.
//
//   gallery.html               every sprite at 3 CSS px per art px, grouped by kind, with id, name and size
//   gallery.html?scale=6       at 6 (any whole number 1 to 8; 2 is the phone scale)
//   gallery.html?kind=joker    only some kinds (comma-separated: card, back, joker, tarot, planet, spectral,
//                              voucher, pack, tag, blind, boss, stake, enh, seal, edition, icon, ui, num, fx,
//                              and the sections missing and composed)
//
// A red list at the top names every content id with no sprite (from TW.Content and content/content-plan.json,
// as tools/art-coverage.mjs does). Temporary art has a dashed outline. The composed section shows each
// Enhancement on a few ranks, each Seal and each Edition, as the UI should show them (ART.md section 6).
// The page sets <html data-ready="1"> when it is drawn (data-errors counts sprites that failed to draw).
//
// Usage: node tools/gallery.mjs [--out=gallery.html]   (--out: a path relative to the project root, or absolute)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const outName = (process.argv.slice(2).find((a) => a.startsWith('--out=')) || '--out=gallery.html').slice(6);
const artFiles = readdirSync(new URL('src/art/', root)).filter((f) => f.endsWith('.js')).sort();
const plan = existsSync(new URL('content/content-plan.json', root)) ? JSON.parse(read('content/content-plan.json')) : {};
const PLAN_KEYS = {
  JOKERS: 'jokers', TAROTS: 'tarot', PLANETS: 'planets', SPECTRALS: 'spectral', BOSSES: 'bosses', VOUCHERS: 'vouchers', TAGS: 'tags',
  PACKS: 'packs', DECKS: 'decks', STAKES: 'stakes', ENHANCEMENTS: 'enhancements', SEALS: 'seals', EDITIONS: 'editions', BLINDS: 'rounds',
};
const PLAN = Object.fromEntries(Object.entries(PLAN_KEYS).map(([table, key]) => [table, (plan[key] || []).map((r) => ({ id: r.id, name: r.name, oldId: r.oldId || null, art: r.art || '', rarity: r.rarity || null }))]));
const fonts = existsSync(new URL('mockups/ember-lit/fonts.css', root)) ? read('mockups/ember-lit/fonts.css') : '';
const script = (name, js) => `<script data-src="${name}">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`;

const STYLE = `
:root {
  --px: 3px; --edge: #2B1220; --cream: #FFF3E0; --muted: #EBC3AE; --line: #F0BE96; --acid: #CFFF2F; --bad: #FF6B86;
  --b0: #2C1535; --b1: #40173F; --b2: #5A1A41; --b3: #761F3C; --b4: #922B35; --b5: #AE402C; --b6: #C65A26;
  --f-display: 'Jersey 10', 'Tiny5', ui-monospace, monospace; --f-label: 'Tiny5', 'Jersey 10', ui-monospace, monospace;
}
* { box-sizing: border-box; }
html { background: radial-gradient(70% 520px at 50% 100%, rgba(255, 122, 52, .45), rgba(255, 122, 52, 0) 100%), linear-gradient(180deg, var(--b0) 0%, var(--b1) 16%, var(--b2) 31%, var(--b3) 45%, var(--b4) 60%, var(--b5) 76%, var(--b6) 100%); background-color: var(--b2); min-height: 100%; }
body { margin: 0; color: var(--cream); font: 400 16px/1.4 var(--f-label); -webkit-font-smoothing: none; }
main { max-width: 1440px; margin: 0 auto; padding: 32px 40px 72px; display: grid; gap: 44px; }
header { display: grid; gap: 10px; }
h1 { margin: 0; font: 400 40px/1 var(--f-display); letter-spacing: .02em; }
h2 { margin: 0 0 18px; font: 400 30px/1 var(--f-display); letter-spacing: .04em; text-transform: uppercase; color: #FFD29C; }
h2 small { font: 400 16px/1 var(--f-label); color: var(--muted); text-transform: none; letter-spacing: 0; margin-left: 10px; }
p { margin: 0; color: var(--muted); max-width: 90ch; }
nav { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--muted); }
nav a { color: var(--line); }
nav a[aria-current] { color: var(--acid); }
.grid { display: flex; flex-wrap: wrap; gap: 26px 18px; align-items: flex-start; }
.item { margin: 0; display: grid; justify-items: center; align-content: start; gap: 8px; min-width: 112px; width: max(112px, calc(var(--w) * var(--px))); }
.frame { position: relative; display: grid; place-items: end center; min-height: calc(var(--h) * var(--px)); }
.spr { display: block; width: calc(var(--w) * var(--px)); height: calc(var(--h) * var(--px)); image-rendering: pixelated; }
.temp .frame { outline: 2px dashed var(--acid); outline-offset: 4px; }
.cap { display: grid; justify-items: center; gap: 2px; text-align: center; max-width: 100%; }
.cap b { font: 400 20px/1.05 var(--f-display); letter-spacing: .03em; text-transform: uppercase; overflow-wrap: anywhere; }
.cap code { font: 12px/1.3 ui-monospace, Consolas, monospace; color: var(--line); overflow-wrap: anywhere; }
.cap span { font-size: 13px; color: var(--muted); }
.cap .plan { color: #CDA8FF; }
.cap .t { color: var(--acid); }
.missing { border: 2px solid var(--bad); border-radius: 6px; padding: 16px 20px; background: rgba(58, 8, 18, .72); }
.missing h2 { color: var(--bad); }
.missing ul { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 4px 18px; }
.missing li { color: #FFB9A6; font-size: 14px; }
.missing li code { color: var(--bad); font: 13px ui-monospace, Consolas, monospace; }
.missing h3 { margin: 12px 0 6px; font: 400 20px/1 var(--f-display); color: #FFB9A6; letter-spacing: .03em; }
.errors { border: 2px solid var(--bad); padding: 12px 16px; background: rgba(58, 8, 18, .8); }
.ok { color: #C3F26E; }
.ui .spr { background: repeating-conic-gradient(rgba(255,255,255,.06) 0 25%, transparent 0 50%) 0 0 / calc(2 * var(--px)) calc(2 * var(--px)); }
/* the UI's layers, as ART.md section 6 asks for them: the Glitch Edition's outer plates, a Seal's overhang */
.ed-fourcolor { filter: drop-shadow(calc(-1 * var(--px)) 0 0 #FF2E4AE0) drop-shadow(var(--px) 0 0 #4A62FFE0); }
/* a 9-slice shown at work: the sprite stretched over a sample box with the slice ART.md gives it */
.slice9 { display: grid; place-items: center; width: calc(36 * var(--px)); height: calc(16 * var(--px)); border-style: solid; border-color: transparent; image-rendering: pixelated; font: 400 20px/1 var(--f-display); color: var(--cream); }
.ui .item.nine { width: max(112px, calc(36 * var(--px))); }
.stack { position: relative; display: block; width: calc(41 * var(--px)); height: calc(55 * var(--px)); }
.over { position: absolute; left: calc(var(--x) * var(--px)); top: calc(var(--y) * var(--px)); }
@media (max-width: 760px) { main { padding: 20px 16px 40px; gap: 32px; } h1 { font-size: 30px; } h2 { font-size: 22px; } .grid { gap: 20px 12px; } .missing { padding: 12px; } }
/* ink icons on a cream tile, light icons on a dark one, so both read */
.icon .spr { background: #FFF3E0; outline: calc(1 * var(--px)) solid #FFF3E0; }
.icon .light .spr { background: #2A0D22; outline-color: #2A0D22; }
`;

const APP = String.raw`
(() => {
  'use strict';
  const A = TW.Art, CONTENT = TW.Content || {}, PLAN = window.__PLAN;
  const root = document.documentElement;
  const Q = new URLSearchParams(location.search);
  const scale = Math.max(1, Math.min(8, parseInt(Q.get('scale') || '3', 10) || 3));
  const kinds = (Q.get('kind') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const want = (k) => !kinds.length || kinds.includes(k);
  root.style.setProperty('--px', scale + 'px');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ORDER = ['card', 'back', 'joker', 'tarot', 'planet', 'spectral', 'voucher', 'pack', 'tag', 'blind', 'boss', 'stake', 'enh', 'seal', 'edition', 'icon', 'ui', 'num', 'fx'];
  const TITLE = { card: 'Playing cards', back: 'Deck backs', joker: 'Jokers', tarot: 'Tarot cards', planet: 'Planet cards', spectral: 'Spectral cards', voucher: 'Vouchers', pack: 'Booster Packs', tag: 'Tags', blind: 'Blinds', boss: 'Boss Blinds', stake: 'Stakes', enh: 'Enhancement badges', seal: 'Seal badges', edition: 'Edition badges', icon: 'Icons', ui: 'UI chrome', num: 'Digits', fx: 'Effects' };
  const TABLES = A.TABLES || {};
  const RANK = CONTENT.RANK_WORDS || {}, SUIT = CONTENT.SUIT_NAMES || {};
  const errors = [];

  const planRow = (table, id) => (PLAN[table] || []).find((r) => r.id === id) || null;
  const liveRow = (table, id) => { const t = CONTENT[table]; return Array.isArray(t) ? t.find((r) => r.id === id) || null : null; };
  function names(id, kind) {
    const m = /^card:(\d+)([SHCD])/.exec(id);
    if (m) return { name: (RANK[m[1]] || m[1]) + ' of ' + (SUIT[m[2]] || m[2]) };
    const table = TABLES[kind];
    const key = id.slice(id.indexOf(':') + 1);
    if (!table) return { name: key };
    const live = liveRow(table, key), planned = planRow(table, key);
    const name = live ? live.name : planned ? planned.name : '';
    return { name, plan: planned && planned.name !== name ? planned.name : '', brief: planned ? planned.art : '' };
  }
  function img(id, cls = '', style = '') {
    try {
      const m = A.meta(id);
      A.bitmap(id); // throws with the reason when the sprite cannot be drawn
      const u = A.url(id);
      if (!u) throw new Error('no url');
      return '<img class="spr ' + cls + '" src="' + u + '" style="--w:' + m.w + ';--h:' + m.h + ';' + style + '" alt="">';
    } catch (e) { errors.push([id, e && e.message || String(e)]); return '<span class="cap" style="color:var(--bad)">failed: ' + esc(e && e.message) + '</span>'; }
  }
  // a UI chrome piece is a 9-slice: show it stretched as lit.css uses it (ART.md section 6)
  function nineSlice(id) {
    const m = A.meta(id), u = A.url(id);
    if (!u || m.kind !== 'ui' || m.w > 9) return '';
    const isBtn = m.h === 10, isPill = m.w === 7;
    const slice = isBtn ? '4 4 5' : isPill ? '3' : '4';
    const width = isBtn ? 'calc(4 * var(--px)) calc(4 * var(--px)) calc(5 * var(--px))' : isPill ? 'calc(3 * var(--px))' : 'calc(4 * var(--px))';
    const dark = /cream|yellow|lime|ember|pink/.test(id) && !/panel|ghost/.test(id);
    return '<span class="slice9" style="border-width:' + width + ';border-image:url(' + u + ') ' + slice + ' fill / ' + width + ' stretch;' + (dark ? 'color:#2A0A06' : '') + '">' + (isBtn ? 'Play' : isPill ? 'Tag' : 'Panel') + '</span>';
  }
  function figure(id, opts = {}) {
    const m = A.meta(id) || { w: 41, h: 55, kind: '' };
    const n = opts.name ? { name: opts.name } : names(id, m.kind);
    const nine = m.kind === 'ui' ? nineSlice(id) : '';
    const inner = opts.html || (nine ? '<span style="display:grid;gap:10px;justify-items:center">' + img(id) + nine + '</span>' : img(id));
    return '<figure class="item' + (m.temp ? ' temp' : '') + (nine ? ' nine' : '') + (/:light$/.test(id) ? ' light' : '') + '" style="--w:' + m.w + ';--h:' + m.h + '"' + (n.brief ? ' title="' + esc(n.brief) + '"' : '') + '>' +
      '<div class="frame">' + inner + '</div>' +
      '<figcaption class="cap">' + (n.name ? '<b>' + esc(n.name) + '</b>' : '') + (n.plan ? '<span class="plan">plan: ' + esc(n.plan) + '</span>' : '') +
      '<code>' + esc(id) + '</code><span>' + esc(m.kind) + ' · ' + m.w + '×' + m.h + (m.temp ? ' · <span class="t">TEMP</span>' : '') + (opts.note ? ' · ' + esc(opts.note) : '') + '</span></figcaption></figure>';
  }
  const section = (key, title, count, body, cls = '') => '<section class="group ' + cls + '" id="k-' + key + '" aria-label="' + esc(title) + '"><h2>' + esc(title) + '<small>' + count + '</small></h2>' + body + '</section>';

  // ---- the missing list: every content id with no sprite (TW.Content, plus the plan's ids not yet in it)
  function missingList(everything = false) {
    const out = [];
    const groups = Object.entries(TABLES);
    for (const [prefix, table] of groups) {
      const planRows = PLAN[table] || [];
      const renamed = new Set(planRows.map((r) => r.oldId).filter(Boolean));
      const ids = new Map(planRows.map((r) => [r.id, r.name]));
      // TW.Content's name wins; a TW.Content id that a plan row renames away (its oldId) is not expected
      for (const r of Array.isArray(CONTENT[table]) ? CONTENT[table] : []) if (ids.has(r.id) || !renamed.has(r.id)) ids.set(r.id, r.name);
      for (const [id, name] of ids) {
        if (prefix === 'blind' && id !== 'small' && id !== 'big') continue;
        if (!everything && !want(prefix) && !want('missing')) continue;
        if (!A.has(prefix + ':' + id)) out.push({ prefix, sprite: prefix + ':' + id, name });
      }
    }
    if (everything || want('card') || want('missing')) for (const s of 'SHCD') for (let r = 2; r <= 14; r++) if (!A.has('card:' + r + s)) out.push({ prefix: 'card', sprite: 'card:' + r + s, name: (RANK[r] || r) + ' of ' + (SUIT[s] || s) });
    return out;
  }

  // ---- composed playing cards, shown with the UI's layers (Edition CSS, the Seal's overhang)
  function composed() {
    const items = [];
    const show = (o, note) => {
      const id = A.card(o);
      const seal = o.seal && A.has('seal:' + o.seal) ? A.meta('seal:' + o.seal) : null;
      let html = '<span class="stack">' + img(id, o.edition ? 'ed-' + o.edition : '');
      if (seal && seal.at) html += img('seal:' + o.seal, 'over', '--x:' + seal.at[0] + ';--y:' + seal.at[1]);
      html += '</span>';
      const name = (RANK[o.rank] || o.rank) + ' of ' + (SUIT[o.suit] || o.suit);
      items.push(figure(id, { html, name, note }));
    };
    const lab = (table, id) => { const r = liveRow(table, id) || planRow(table, id); return r ? r.name : id; };
    for (const e of A.enhancements()) for (const [rank, suit] of [[7, 'D'], [10, 'S'], [12, 'H'], [14, 'C']]) show({ rank, suit, enhancement: e }, lab('ENHANCEMENTS', e));
    for (const s of A.seals()) for (const [rank, suit] of [[14, 'H'], [7, 'D'], [13, 'S']]) show({ rank, suit, seal: s }, lab('SEALS', s));
    for (const d of A.editions()) for (const [rank, suit] of [[13, 'S'], [7, 'D'], [2, 'C']]) show({ rank, suit, edition: d }, lab('EDITIONS', d));
    if (A.enhancements().length || (A.seals().length && A.editions().length)) {
      const o = { rank: 12, suit: 'S', enhancement: A.enhancements()[0], seal: A.seals()[0], edition: A.editions()[0] };
      show(o, 'all at once');
    }
    return items;
  }

  // on-demand sprites worth a look: the digit face and a few payout shards
  if (want('num')) [['0123456789', 'S', 'cream'], ['355', 'XL', 'score'], ['71', 'XL', 'chips'], ['5', 'XL', 'mult'], ['$9', 'L', 'money'], ['+15', 'L', 'blue'], ['1,250', 'XXL', 'total']].forEach(([t, s, st]) => A.num(t, s, st));
  if (want('fx')) [['chips', 6, 2, ''], ['mult', 2, 7, ''], ['lime', 5, 0, 'diag'], ['pink', 6, 0, 'anti'], ['chips', 4, 4, '']].forEach(([c, w, h, k]) => A.shard(c, w, h, k));

  const parts = [];
  const all = A.ids();
  const baseIds = all.filter((id) => !(id.startsWith('card:') && id.includes('|')));
  const missing = missingList(), missingAll = missingList(true);
  const temps = baseIds.filter((id) => A.meta(id).temp);
  const nav = '<nav>' + ['3', '6', '2'].map((s) => '<a href="?scale=' + s + (kinds.length ? '&kind=' + kinds.join(',') : '') + '"' + (String(scale) === s ? ' aria-current="true"' : '') + '>' + s + '×</a>').join('') +
    '<span>·</span>' + ['', ...ORDER, 'composed', 'missing'].map((k) => '<a href="?scale=' + scale + (k ? '&kind=' + k : '') + '"' + ((k === '' && !kinds.length) || kinds.includes(k) ? ' aria-current="true"' : '') + '>' + (k || 'all') + '</a>').join('') + '</nav>';
  parts.push('<header><h1>Wickwager art</h1><p>Every sprite registered in TW.Art, drawn from src/art at ' + scale + ' CSS px per art px. ' +
    baseIds.length + ' sprites; ' + (missingAll.length ? '<b style="color:var(--bad)">' + missingAll.length + ' content ids have no sprite</b>' : '<span class="ok">every content id has a sprite</span>') +
    (temps.length ? '; ' + temps.length + ' temporary (dashed)' : '') + '. Hover a sprite for its art brief.</p>' + nav + '</header>');

  if (missing.length && (want('missing') || kinds.length === 0 || kinds.some((k) => k !== 'composed'))) {
    const by = missing.reduce((m, x) => { (m[x.prefix] = m[x.prefix] || []).push(x); return m; }, {});
    parts.push('<section class="missing" id="missing" aria-label="Missing sprites"><h2>Missing<small>' + missing.length + ' content ids with no sprite</small></h2>' +
      Object.entries(by).map(([p, list]) => '<h3>' + esc(TITLE[p] || p) + ' (' + list.length + ')</h3><ul>' + list.map((x) => '<li><code>' + esc(x.sprite) + '</code> ' + esc(x.name || '') + '</li>').join('') + '</ul>').join('') + '</section>');
  }
  for (const kind of ORDER) {
    if (!want(kind)) continue;
    const ids = baseIds.filter((id) => A.meta(id).kind === kind);
    if (!ids.length) continue;
    parts.push(section(kind, TITLE[kind] || kind, ids.length, '<div class="grid">' + ids.map((id) => figure(id)).join('') + '</div>', kind));
  }
  const other = baseIds.filter((id) => !ORDER.includes(A.meta(id).kind));
  if (other.length && !kinds.length) parts.push(section('other', 'Other', other.length, '<div class="grid">' + other.map((id) => figure(id)).join('') + '</div>'));
  if (want('composed')) {
    const items = composed();
    if (items.length) parts.push(section('composed', 'Composed cards', items.length + ' · Edition CSS and Seal overhangs as the UI shows them (ART.md section 6)', '<div class="grid">' + items.join('') + '</div>'));
  }
  if (errors.length) parts.unshift('<div class="errors"><b>' + errors.length + ' sprites failed to draw</b><ul>' + errors.map(([id, m]) => '<li><code>' + esc(id) + '</code> ' + esc(m) + '</li>').join('') + '</ul></div>');
  document.getElementById('gallery').innerHTML = parts.join('');
  root.dataset.errors = String(errors.length);
  root.dataset.missing = String(missingAll.length);
  root.dataset.ready = '1';
})();
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wickwager Art Gallery</title>
<meta name="description" content="Every sprite in TW.Art, drawn from src/art, with its id, name and kind. Generated by tools/gallery.mjs.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 8 8%27 shape-rendering=%27crispEdges%27%3E%3Cpath fill=%27%23FF7A2B%27 d=%27M3 0h2v1h1v3H2V1h1z%27/%3E%3Cpath fill=%27%23FFF3E0%27 d=%27M3 4h2v4H3z%27/%3E%3C/svg%3E">
<style>
${fonts}
${STYLE}
</style>
</head>
<body>
<main id="gallery" aria-label="Sprite gallery"><p>Drawing…</p></main>
${script('src/content.js', read('src/content.js'))}
${artFiles.map((f) => script(`src/art/${f}`, read(`src/art/${f}`))).join('\n')}
<script>window.__PLAN = ${JSON.stringify(PLAN).replace(/</g, '\\u003c')};</script>
${script('gallery', APP)}
</body>
</html>
`;
// a plain path (C:/... or relative to the project root), never parsed as a URL: 'C:' is not a scheme
// (a file:/// URL still works, as it did before)
const outPath = outName.startsWith('file:') ? fileURLToPath(outName) : resolve(fileURLToPath(root), outName);
writeFileSync(outPath, html);
console.log(`Wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB): content.js and ${artFiles.length} art files inlined.`);
