#!/usr/bin/env node
// Lists every content id that has no sprite yet, by kind.
// Exit codes: 0 every content id has a sprite; 1 some are missing (or temporary, with --strict); 2 the art did not
// load (src/content.js or an art file threw while loading, or TW.Art is missing), so coverage could not be checked.
//
// The ids come from TW.Content (src/content.js, loaded in a vm with src/art/*.js) and from
// content/content-plan.json, so this works before content.js is renamed: a TW.Content id that a plan row
// renames away (its oldId) is not expected. Kinds: Jokers, Tarot, Planet and Spectral cards, Boss Blinds,
// Vouchers, Tags, Booster Packs, Decks (backs), Stakes, Enhancements, Seals, Editions, the Small and Big
// Blinds, and all 52 playing cards.
//
// Usage: node tools/art-coverage.mjs [--strict] [--json]
//   --strict  temporary art (placeholders flagged temp, such as an undrawn court) counts as missing
//   --json    print { missing: [{ kind, id, sprite, name }], temporary: [...], counts } instead of text
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const asJson = args.includes('--json');

const ctx = vm.createContext({ console });
/** Run one file; a file that throws while loading is a broken build, not missing art: exit 2. */
function run(file) {
  try { vm.runInContext(read(file), ctx, { filename: file }); } catch (e) {
    console.error(`art-coverage: ${file} failed to load: ${e && e.message}`);
    process.exit(2);
  }
}
run('src/content.js');
const artFiles = existsSync(new URL('src/art/', root)) ? readdirSync(new URL('src/art/', root)).filter((f) => f.endsWith('.js')).sort() : [];
for (const f of artFiles) run(`src/art/${f}`);
const TW = ctx.TW;
const A = TW.Art;
if (!A) { console.error('art-coverage: src/art/00-core.js did not create TW.Art'); process.exit(2); }
const plan = existsSync(new URL('content/content-plan.json', root)) ? JSON.parse(read('content/content-plan.json')) : {};

// sprite prefix -> [TW.Content table, content-plan table, label]
const KINDS = [
  ['joker', 'JOKERS', 'jokers', 'Jokers'],
  ['tarot', 'TAROTS', 'tarot', 'Tarot cards'],
  ['planet', 'PLANETS', 'planets', 'Planet cards'],
  ['spectral', 'SPECTRALS', 'spectral', 'Spectral cards'],
  ['boss', 'BOSSES', 'bosses', 'Boss Blinds'],
  ['voucher', 'VOUCHERS', 'vouchers', 'Vouchers'],
  ['tag', 'TAGS', 'tags', 'Tags'],
  ['pack', 'PACKS', 'packs', 'Booster Packs'],
  ['back', 'DECKS', 'decks', 'Decks (backs)'],
  ['stake', 'STAKES', 'stakes', 'Stakes'],
  ['enh', 'ENHANCEMENTS', 'enhancements', 'Enhancements'],
  ['seal', 'SEALS', 'seals', 'Seals'],
  ['edition', 'EDITIONS', 'editions', 'Editions'],
  ['blind', 'BLINDS', 'rounds', 'Small and Big Blinds'],
];
/** Expected ids of one kind: the plan's ids, plus TW.Content's ids that no plan row renames away. */
function expected(table, planKey) {
  const rows = new Map();
  const planRows = Array.isArray(plan[planKey]) ? plan[planKey] : [];
  const renamed = new Set(planRows.map((r) => r.oldId).filter(Boolean));
  for (const r of planRows) rows.set(r.id, { id: r.id, name: r.name, planName: r.name });
  const live = TW.Content && Array.isArray(TW.Content[table]) ? TW.Content[table] : [];
  for (const r of live) {
    if (rows.has(r.id)) { rows.get(r.id).name = r.name; continue; }
    if (renamed.has(r.id) && !planRows.some((p) => p.id === r.id)) continue;
    rows.set(r.id, { id: r.id, name: r.name });
  }
  return [...rows.values()];
}

const missing = [], temporary = [], counts = {};
const check = (kind, label, id, sprite, name) => {
  counts[label] = counts[label] || { total: 0, missing: 0, temporary: 0 };
  counts[label].total++;
  if (!A.has(sprite)) { missing.push({ kind, label, id, sprite, name }); counts[label].missing++; return; }
  const m = A.meta(sprite);
  if (m && m.temp) { temporary.push({ kind, label, id, sprite, name }); counts[label].temporary++; if (strict) { missing.push({ kind, label, id, sprite, name, temp: true }); counts[label].missing++; } }
};
for (const [prefix, table, planKey, label] of KINDS) {
  for (const row of expected(table, planKey)) {
    if (prefix === 'blind' && row.id !== 'small' && row.id !== 'big') continue; // each Boss Blind is its own emblem
    check(prefix, label, row.id, `${prefix}:${row.id}`, row.name);
  }
}
const RANK = (TW.Content && TW.Content.RANK_WORDS) || {};
const SUIT = (TW.Content && TW.Content.SUIT_NAMES) || {};
for (const s of ['S', 'H', 'C', 'D']) for (let r = 2; r <= 14; r++) check('card', 'Playing cards', `${r}${s}`, `card:${r}${s}`, `${RANK[r] || r} of ${SUIT[s] || s}`);

if (asJson) {
  console.log(JSON.stringify({ missing, temporary, counts }, null, 2));
} else {
  const byLabel = (list) => list.reduce((m, x) => { (m[x.label] = m[x.label] || []).push(x); return m; }, {});
  const miss = byLabel(missing), tmp = byLabel(temporary);
  console.log(`Art coverage: ${A.ids().length} sprites registered from ${artFiles.length} files.`);
  for (const [label, c] of Object.entries(counts)) {
    const flag = c.missing ? 'MISSING' : c.temporary ? 'temp' : 'ok';
    console.log(`  ${label.padEnd(22)} ${String(c.total - c.missing).padStart(3)} of ${String(c.total).padStart(3)} drawn${c.temporary ? `, ${c.temporary} temporary` : ''}  ${flag}`);
  }
  if (missing.length) {
    console.log(`\nMissing (${missing.length}):`);
    for (const [label, list] of Object.entries(miss)) {
      console.log(`  ${label}:`);
      for (const x of list) console.log(`    ${x.sprite.padEnd(28)} ${x.name || ''}${x.temp ? '  (temporary art)' : ''}`);
    }
  }
  if (temporary.length && !strict) {
    console.log(`\nTemporary art, drawn as placeholders (${temporary.length}; --strict counts these as missing):`);
    for (const [, list] of Object.entries(tmp)) for (const x of list) console.log(`    ${x.sprite.padEnd(28)} ${x.name || ''}`);
  }
  if (!missing.length) console.log('\nEvery content id has a sprite.');
}
process.exit(missing.length ? 1 : 0);
