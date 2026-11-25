// Unit tests for the final UI pass of 2026-11-24 (src/ui/*.js with the real content, art and engine in a vm with a
// minimal fake DOM, as tests/ui-fixes.test.mjs does; the browser half is tests/e2e/fixes.mjs):
//   - the wording ruling (REQUESTS.md, orchestrator 11:20): "Target", "Blind score" and "Overview", everywhere the
//     player meets them (the words the checks look for are on the originality list, tests/local/originality.json:
//     local-only, so the checks for them skip without it);
//   - outside a Blind the left column shows the hands the next Blind will really deal (final review F4): a Boss
//     Blind's handsDelta and the Vouchers' bossHands included, in the Shop the Blind after the one just beaten;
//   - the small screens: a landscape phone and a short phone get their own layout queries (the pixel size keeps its
//     one query), and the Shop with Night Market packs its rows instead of wrapping into its scroller;
//   - the menus keep 44 px targets on every compact window (a landscape phone, a tablet).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { ORIGINALITY, needsOriginality, pattern, patternList } from './local-data.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const ART = readdirSync(new URL('src/art/', root)).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/art/' + f);
const UI_FILES = readdirSync(new URL('src/ui/', root)).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/ui/' + f);
const STYLES = readdirSync(new URL('src/styles/', root)).filter((f) => f.endsWith('.css')).sort().map((f) => 'src/styles/' + f);

function fakeEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), className: '', textContent: '', innerHTML: '', children: [], dataset: {}, hidden: false, isConnected: true,
    style: { setProperty() {}, removeProperty() {}, cssText: '' },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, append() {}, prepend() {}, appendChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getContext() { return null; }, getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    insertAdjacentHTML() {}, replaceChildren() {}, animate() { return null; }, focus() {}, closest() { return null; }, matches() { return false; },
  };
}
function load(search = '?test=1&seed=FINALUI1') {
  const storage = new Map();
  const doc = {
    readyState: 'loading', documentElement: fakeEl('html'), body: fakeEl('body'),
    createElement: (t) => fakeEl(t), addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, getAnimations() { return []; },
    fonts: { load: async () => [], ready: Promise.resolve(), check: () => false }, activeElement: null,
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout, clearTimeout, performance, Promise, URLSearchParams, Map, Set, WeakMap, Math, JSON, Date,
    Number, String, Array, Object, Symbol, Error, Uint8Array, Uint8ClampedArray, Float32Array, Int32Array,
    location: { search }, document: doc, navigator: {}, innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) },
    CSS: { supports: () => true }, addEventListener() {}, removeEventListener() {},
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['src/content.js', ...ART, 'src/engine.js', ...UI_FILES]) vm.runInContext(read(f), ctx, { filename: f });
  ctx.TW.Art.url = (id) => (ctx.TW.Art.has(id) ? 'data:image/png;base64,AAAA' : null);
  return { TW: ctx.TW, storage };
}
/** The three old labels (the originality list's oldLabels), or null where the local-only list is absent. */
const OLD = ORIGINALITY ? pattern('oldLabels') : null;

test('the wording ruling: no screen, label, announce line, comment or design note says one of the three old labels', { skip: needsOriginality }, () => {
  const files = ['src/shell.html', ...STYLES, ...UI_FILES, 'src/audio.js', 'PRODUCT.md',
    ...readdirSync(new URL('.impeccable/surfaces/', root)).map((f) => '.impeccable/surfaces/' + f)];
  for (const f of files) {
    const lines = read(f).split('\n');
    lines.forEach((l, i) => assert.ok(!OLD.test(l), `${f}:${i + 1} still says ${(l.match(OLD) || [''])[0]}`));
  }
});

test('the wording ruling: the new words are where the player meets them', () => {
  const table = read('src/ui/10-table.js'), screens = read('src/ui/30-screens.js'), shop = read('src/ui/20-shop.js'), core = read('src/ui/00-core.js');
  assert.match(table, /cleared \? 'Blind cleared' : 'Target'/, 'the Blind panel: Target (Blind cleared once beaten)');
  assert.match(table, /<div class="bc-target"><span class="lbl">Target<\/span>/, 'each Blind at the Blind select');
  assert.match(table, /aria-label="Blind score"/, 'the score panel names itself');
  assert.match(table, /'Blind beaten' : 'Blind score'/, 'its tag (Blind beaten stays)');
  assert.match(table, /aria-label="Overview">\$\{icon\('info'\)\}<span class="t">Overview<\/span>/, 'the table button keeps the info icon');
  assert.match(table, /aria-label="Overview">\$\{icon\('info'\)\}<\/button>/, 'the compact bar\'s icon button');
  assert.match(table, /started\. Target \$\{fmt/, 'the announce line when a Blind starts');
  assert.match(table, /\$\{cur\.boss\.text \|\| ''\} Target \$\{fmt/, 'the Boss Blind\'s reveal');
  assert.match(screens, /btn\('Overview', 'open-run-info'/, 'the Pause menu');
  assert.match(screens, /title: 'Overview', tag: 'cream', cls: 'wide ri-dlg'/, 'the dialog title');
  assert.match(screens, /<span class="lbl">Target<\/span><span class="n g-cream">/, 'each Blind in Overview');
  assert.match(shop, /lbl\.textContent = 'Target'/, 'a pack a Tag opened before the Blind');
  // the I key stays, behind Options' Keyboard shortcuts switch since the final pass (A4, WCAG 2.1.4)
  assert.match(core, /\(e\.key === 'i' \|\| e\.key === 'I'\) && inRun\(\)( && shortcuts\(\))?\) \{ e\.preventDefault\(\); openOverlay\('run-info'\)/, 'the I key stays');
});

/** What the column says the next Blind deals, against what the engine then deals (on a copy of the run). */
function compare(TW, run, go) {
  const E = TW.Engine;
  const shown = TW.UI.table.nextBlindCounts(run);
  const copy = E.deserialize(E.serialize(run));
  go(E, copy);
  assert.equal(copy.phase, 'play', 'the copy reached the Blind');
  return { shown, dealt: { hands: copy.blind.handsLeft, discards: copy.blind.discardsLeft } };
}

test('the next Blind\'s hands: a Boss Blind\'s handsDelta (The Short Fuse) at the Blind select', () => {
  const { TW } = load();
  const run = TW.UI.newRun({ show: false });
  Object.assign(run, { ante: 2, blindIndex: 2 });
  run.bosses[2] = 'shortfuse';
  const { shown, dealt } = compare(TW, run, (E, r) => assert.equal(E.startBlind(r).ok, true));
  assert.equal(dealt.hands, 2, 'the engine deals 2 (4 - 2)');
  assert.deepEqual({ ...shown }, dealt, 'the column says what the Blind will deal (it said 4 before)');
});

test('the next Blind\'s hands: Midnight Oil\'s Boss Blind hand, only for the Boss Blind', () => {
  const { TW } = load();
  const C = TW.Content;
  const oil = C.VOUCHERS.find((v) => v.bossHands > 0);
  assert.ok(oil, 'a Voucher gives Boss Blinds more hands');
  for (const index of [0, 1, 2]) {
    const run = TW.UI.newRun({ show: false });
    Object.assign(run, { ante: 2, blindIndex: index });
    run.bosses[2] = 'heckler';
    run.vouchers.push(oil.id);
    for (const k of Object.keys(oil.mods || {})) run[k] += oil.mods[k];
    const { shown, dealt } = compare(TW, run, (E, r) => assert.equal(E.startBlind(r).ok, true));
    assert.deepEqual({ ...shown }, dealt, `Blind ${index}: ${JSON.stringify(shown)} against ${JSON.stringify(dealt)}`);
  }
});

test('the next Blind\'s hands: in the Shop it is the Blind after the one just beaten', () => {
  const { TW } = load();
  for (const [index, boss] of [[1, 'shortfuse'], [2, 'shortfuse'], [0, 'shortfuse']]) {
    const run = TW.UI.newRun({ show: false });
    Object.assign(run, { ante: 2, blindIndex: index, phase: 'shop', shop: { items: [], rerollCost: 5, rerolls: 0, freeRerolls: 0, discount: 0, packsBought: 0 } });
    run.bosses[2] = boss;
    run.pending.extraHands = 1;
    const { shown, dealt } = compare(TW, run, (E, r) => { assert.equal(E.leaveShop(r).ok, true); assert.equal(E.startBlind(r).ok, true); });
    assert.deepEqual({ ...shown }, dealt, `after Blind ${index}: ${JSON.stringify(shown)} against ${JSON.stringify(dealt)}`);
  }
});

test('the next Blind\'s hands: a pack a Tag opened before the Boss Blind counts the Boss Blind', () => {
  const { TW } = load();
  const run = TW.UI.newRun({ show: false });
  Object.assign(run, { ante: 2, blindIndex: 2, phase: 'pack', pack: { id: 'x', kind: 'card', size: 'normal', picksLeft: 1, returnTo: 'blind-select', options: [], hand: [], draw: [] } });
  run.bosses[2] = 'shortfuse';
  const shown = TW.UI.table.nextBlindCounts(run);
  assert.equal(shown.hands, 2);
  run.pack.returnTo = 'shop';
  run.blindIndex = 1;
  assert.equal(TW.UI.table.nextBlindCounts(run).hands, 2, 'a pack bought in the Shop after the Big Blind: the Boss Blind is next');
  run.blindIndex = 2;
  assert.equal(TW.UI.table.nextBlindCounts(run).hands, 4, 'and after the Boss Blind, the next Ante\'s Small Blind');
});

test('the wording ruling holds across line breaks too (a comment wrapped mid-label)', { skip: needsOriginality }, () => {
  const files = [...STYLES, ...UI_FILES, 'PRODUCT.md', ...readdirSync(new URL('.impeccable/surfaces/', root)).map((f) => '.impeccable/surfaces/' + f)];
  for (const f of files) assert.ok(!OLD.test(read(f).replace(/\s+/g, ' ')), `${f}: ${(read(f).replace(/\s+/g, ' ').match(OLD) || [''])[0]}`);
});

test('small screens: a landscape phone and a short upright phone have their own layout queries; the pixel size keeps one', () => {
  const table = read('src/styles/40-table.css'), shop = read('src/styles/50-shop.css'), tokens = read('src/styles/10-tokens.css');
  // the landscape layout covers a short window held wide too, up to 760 px tall (final pass, part 4)
  const LAND = '@media (max-width: 1023px) and (max-height: 760px) and (orientation: landscape)';
  const SHORT = '@media (max-width: 599px) and (max-height: 760px)';
  assert.ok(table.includes(LAND) && shop.includes(LAND), 'the landscape layout in the table and the Shop');
  assert.ok(table.includes(SHORT) && shop.includes(SHORT), 'the short-phone layout in the table and the Shop');
  // only the tokens set --px, from the one query (ARCH.md section 2)
  for (const [f, css] of [['40-table.css', table], ['50-shop.css', shop]]) assert.ok(!/--px\s*:/.test(css), `${f} never sets --px`);
  assert.equal((tokens.match(/--px\s*:/g) || []).length, 2, 'the tokens set --px twice: 3, and 2 in the one query');
  // the landscape table: a status column beside the field, the hand's buttons in a column, the table never scrolls
  const land = table.slice(table.indexOf(LAND));
  assert.match(land, /\.table \{ grid-template-columns: calc\(112 \* var\(--px\)\) minmax\(0, 1fr\);[^}]*height: 100dvh/);
  assert.match(land, /> \.controls \{ grid-area: 2 \/ 2 \/ 3 \/ 3; display: flex; flex-direction: column;/);
  assert.match(land, /env\(safe-area-inset-left, 0px\)/, 'the notch keeps its safe area');
  assert.match(table, /\.table \{ overflow-y: clip; \}/);
  // the played cards overlap like the hand when the stage is narrower than the row
  assert.match(table, /\.stage-row > \.card \+ \.card \{ margin-left: min\(calc\(5 \* var\(--px\)\), calc\(\(100% - var\(--card-w\)\) \/ \(var\(--n\) - 1\) - var\(--card-w\)\)\); \}/);
  assert.match(read('src/ui/10-table.js'), /class: 'stage-row', style: `--n:\$\{Math\.max\(2, played\.length\)\}`/);
});

test('Night Market: a Shop with a row of four is dense, and on the table layout its rows share four columns', () => {
  const shopJs = read('src/ui/20-shop.js'), css = read('src/styles/50-shop.css');
  assert.match(shopJs, /const dense = Math\.max\(cards\.length, packs\.length \+ 1\) > 3;/);
  assert.match(shopJs, /class="panel warm shop\$\{dense \? ' dense' : ''\}"/);
  assert.match(css, /@media \(min-width: 1024px\) \{\s*\.shop\.dense \.shelf \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, calc\(var\(--card-w\) \+ 59 \* var\(--px\)\)\)\);/);
  assert.match(css, /\.shop\.dense \.si \{ grid-template-columns: var\(--card-w\) minmax\(0, 1fr\);/, 'the text column gives up width, never the art');
  assert.match(css, /\.shop\.dense \.shelf \{ display: grid; grid-template-columns: repeat\(4, var\(--card-w\)\);/, 'four to a row on a phone');
});

test('compact menus keep 44 px targets on a landscape phone and a tablet too', () => {
  const css = read('src/styles/60-screens.css');
  assert.match(css, /@media \(max-width: 1023px\) \{\s*\.scr \.btn, \.dlg \.btn, \.seed-in \{ min-height: 44px; \}\s*\.stk \{ min-width: 44px; min-height: 44px; \}/);
});

test('the engine\'s further phrases (REQUESTS.md, engine final pass): the Blind count, Encore!, "On to the next Blind.", Cards tossed', () => {
  const table = read('src/ui/10-table.js'), core = read('src/ui/00-core.js'), shop = read('src/ui/20-shop.js'), screens = read('src/ui/30-screens.js');
  assert.equal((table.match(/aria-label="Blind count"><span class="lbl">Blind<\/span>/g) || []).length, 2, 'the counter says Blind on both layouts');
  assert.match(core, /announce\('On to the next Blind\.'\)/);
  assert.match(shop, /UI\.announce\('On to the next Blind\.'\)/);
  assert.match(screens, /cell\('Cards tossed', n\(st\.cardsDiscarded\)\)/);
});

test('the engine\'s further phrases: no UI file holds the counter word or a further phrase of the originality list', { skip: needsOriginality }, () => {
  const table = read('src/ui/10-table.js');
  const counter = pattern('roundCounter');
  assert.ok(!counter.test(table), `no ${counter} counter`);
  const phrases = patternList('uiPhrases');
  assert.ok(phrases.length >= 4, 'the originality list holds the further phrases');
  for (const f of UI_FILES) {
    const src = read(f);
    for (const p of phrases) assert.ok(!p.test(src), `${f}: ${p}`);
  }
});
