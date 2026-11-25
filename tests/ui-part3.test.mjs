// Unit tests for the final pass, part 3 (UI fixes F1 to F6, 2026-11-25): src/ui/*.js with the real content, art and
// engine in a vm with a minimal fake DOM (as tests/ui-part2.test.mjs does), and the stylesheets and the perf scenario
// as text. The browser half is tests/e2e/part3.mjs.
//   F1  the Blind select's button says Play, as SPEC 6.1 names it (ARCH.md section 1), and its accessible name starts
//       with the word it shows: "Play the Small Blind, target 300"; that no UI file draws a button with the word of
//       the originality list is checked against that list (local-only: that check skips without it);
//   F2  a landscape phone lays a Tarot or Ghost Pack with its dealt hand out in two columns: the pack's name, picks
//       left and Skip over a reading plate that runs to the foot of the hand (it was 117 px tall beside the hand and
//       cut 22 of the 36 readings); the options stand over the hand at the right;
//   F3  a wide compact window 760 px tall or less moves the racks aside while such a pack is open, so nothing scrolls
//       the page, and its plate keeps the 52 art px that hold every reading (44 cut 4 of the 36);
//   F4  tests/e2e/perf.mjs measures the payout's long tasks at real speed, at Normal and at Blazing, whatever URL it
//       is given (test mode fires the whole payout in one task by construction);
//   F5  the open pack, drawn anew (a breakpoint, an update), keeps keyboard focus where it was, and the redraw a
//       breakpoint asks for waits for a busy moment to end instead of being dropped;
//   F6  the 30 px strips of a 667 x 375 phone stay (no clean room for more, written in 40-table.css), and on a strip
//       that narrow each covered card's Seal tab moves onto its strip, clear of the rank (the next card hid part of it);
//   and, found on the way: effects never start from a rack with no box (the racks step aside for a dealt hand), and
//   the table's main area route copy is fixed in place (it fell into the page's flow and made the page a screen taller);
//   and, from the final agent of part 3: a Planet Pack keeps the racks on a landscape phone (F3's block matched the
//   landscape phones too and sent them aside there for nothing), and a pack's name wraps in its pill there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { needsOriginality, pattern } from './local-data.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const ART = readdirSync(new URL('src/art/', root)).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/art/' + f);
const UI_FILES = readdirSync(new URL('src/ui/', root)).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/ui/' + f);

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
/** The UI in a vm. o.compact: the compact layout's queries match (2 CSS px an art pixel); o.find(sel): what
    document.querySelector returns. */
function load(search = '?test=1&seed=PARTTHR1', o = {}) {
  const storage = new Map();
  const doc = {
    readyState: 'loading', documentElement: fakeEl('html'), body: fakeEl('body'),
    createElement: (t) => fakeEl(t), addEventListener() {}, removeEventListener() {},
    querySelector(sel) { return o.find ? o.find(sel) : null; }, querySelectorAll() { return []; }, getAnimations() { return []; },
    fonts: { load: async () => [], ready: Promise.resolve(), check: () => false }, activeElement: null,
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout, clearTimeout, performance, Promise, URLSearchParams, Map, Set, WeakMap, Math, JSON, Date,
    Number, String, Array, Object, Symbol, Error, Uint8Array, Uint8ClampedArray, Float32Array, Int32Array,
    location: { search }, document: doc, navigator: {}, innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    matchMedia: (q) => ({ matches: !!o.compact && /max-width: 1023px/.test(q), addEventListener() {} }),
    localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => { storage.set(k, String(v)); }, removeItem: (k) => storage.delete(k) },
    CSS: { supports: () => true }, addEventListener() {}, removeEventListener() {},
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['src/content.js', ...ART, 'src/engine.js', ...UI_FILES]) vm.runInContext(read(f), ctx, { filename: f });
  ctx.TW.Art.url = (id) => (ctx.TW.Art.has(id) ? 'data:image/png;base64,AAAA' : null);
  return { TW: ctx.TW, storage, doc };
}
/** The start-blind button in a Blind card's HTML: its shown text and its accessible name. */
function startButton(html) {
  const m = /<button[^>]*data-action="start-blind"[^>]*>([\s\S]*?)<\/button>/.exec(html);
  if (!m) return null;
  const name = /aria-label="([^"]*)"/.exec(m[0]);
  return { text: m[1].replace(/<[^>]+>/g, '').trim(), name: name ? name[1] : null };
}
/** One @media block's body (the first whose query is exactly q), or null. */
function mediaBlock(css, q) {
  const at = css.indexOf(`@media ${q} {`);
  if (at < 0) return null;
  let i = css.indexOf('{', at) + 1, depth = 1;
  const start = i;
  for (; i < css.length && depth; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
  return css.slice(start, i - 1);
}

test('F1: the Blind select\'s button says Play, and its name starts with the word it shows', () => {
  const { TW } = load('?test=1&seed=PARTTHR1');
  const UI = TW.UI, E = TW.Engine;
  // the fake DOM has no canvas: a picture stands in for the drawn numbers
  UI.paint.Px.prototype.url = function () { return `data:image/png;base64,${this.w}x${this.h}`; };
  const run = UI.newRun({ show: false });
  assert.equal(typeof UI.table.blindCardHTML, 'function', 'the Blind card is drawn by UI.table.blindCardHTML');
  for (const [i, kind] of [[0, 'small'], [1, 'big'], [2, 'boss']]) {
    run.blindIndex = i;
    run.blindStatus = Object.fromEntries([...Array(i)].map((_, k) => [`${run.ante}-${k}`, 'cleared']));
    const infos = E.blindsForAnte(run);
    const cur = infos.find((x) => x.status === 'current');
    assert.equal(cur.kind, kind);
    const html = UI.table.blindCardHTML(cur, run);
    const b = startButton(html);
    const blindName = TW.Content.BLINDS.find((x) => x.kind === kind || x.id === kind).name;
    assert.ok(b, `the ${blindName} has its start button`);
    assert.equal(b.text, 'Play', `the ${blindName}'s button says Play (the word SPEC 6.1 names, since part 3's F1)`);
    assert.equal(b.name, `Play the ${blindName}, target ${UI.fmt(cur.target)}`, 'its accessible name starts with the word it shows');
    // the Blinds not up yet carry no button
    for (const other of infos.filter((x) => x !== cur)) assert.equal(startButton(UI.table.blindCardHTML(other, run)), null);
  }
});

test('F1: nowhere in the UI does a button show the Blind select word of the originality list', { skip: needsOriginality }, () => {
  const button = pattern('blindSelectButton');
  for (const f of UI_FILES) assert.doesNotMatch(read(f), button, `${f} has no button that says the listed word`);
});

test('F2: a landscape phone lays a pack with a dealt hand out in two columns, the reading plate running to the foot of the hand', () => {
  const css = read('src/styles/50-shop.css');
  const land = mediaBlock(css, '(max-width: 1023px) and (max-height: 760px) and (orientation: landscape)');
  assert.ok(land, 'the landscape phone\'s block');
  // beside the hand, capped at the hand's height (card + 6 art px), the plate cut 22 of the 36 readings by up to 81 px
  assert.doesNotMatch(land, /\.pk-handzone \.pk-detail \{[^}]*max-height: calc\(var\(--card-h\) \+ 6/, 'no plate capped at the hand\'s height');
  assert.match(land, /\.pack-view\.has-hand \{ grid-template-columns: calc\(96 \* var\(--px\)\) minmax\(0, 1fr\); grid-template-rows: auto minmax\(0, 1fr\) auto;/, 'two columns: the plate\'s (96 art px) and the rest');
  assert.match(land, /\.pack-view\.has-hand > :is\(\.pk-stage, \.pk-handzone\) \{ display: contents; \}/, 'the stage and the hand zone lend their parts to the grid');
  assert.match(land, /\.pack-view\.has-hand \.pk-head \{ grid-area: 1 \/ 1 \/ 2 \/ 2;/, 'the head at the top left');
  assert.match(land, /\.pack-view\.has-hand \.pk-detail \{ grid-area: 2 \/ 1 \/ 4 \/ 2; height: auto; max-height: none;[^}]*align-self: stretch;/, 'the plate under it, to the foot of the hand, with no cap');
  assert.match(land, /\.pack-view\.has-hand \.pk-opts \{ grid-area: 1 \/ 2 \/ 3 \/ 3;/, 'the options at the right');
  assert.match(land, /\.pack-view\.has-hand \.pk-handcol \{ grid-area: 3 \/ 2 \/ 4 \/ 3;/, 'the hand under them');
  assert.match(land, /body:has\(\.pack-view\.has-hand\) \.racks \{ display: none; \}/, 'the racks step aside while it is open');
  assert.match(land, /body:has\(\.pack-view\.has-hand\) \.field \{ grid-template-rows: minmax\(0, 1fr\); \}/, 'and the field gives the pack their row');
  // the pack's parts the grid places are plain boxes (no role), so display: contents hides nothing from assistive tech
  const shop = read('src/ui/20-shop.js');
  assert.match(shop, /<div class="pk-stage">/);
  assert.match(shop, /const handZone = `<div class="pk-handzone">/);
});

test('F3: a wide compact window 760 px tall or less moves the racks aside for a pack\'s dealt hand; the plate keeps 52 art px', () => {
  const css = read('src/styles/50-shop.css');
  const wide = mediaBlock(css, '(min-width: 600px) and (max-width: 1023px) and (max-height: 760px)');
  assert.ok(wide, 'the wide compact, short window\'s block');
  // with the racks the page scrolled by 26 to 106 px at 1000 x 700, 900 x 650, 800 x 620 and 700 x 700, and a 44 art
  // px plate cut 4 of the 36 readings
  assert.doesNotMatch(wide, /\.pk-detail \{ height: calc\(44 \* var\(--px\)\); \}/, 'no 44 art px plate');
  assert.match(wide, /body:has\(\.pack-view\.has-hand\) \.racks \{ display: none; \}/, 'the racks step aside');
  assert.match(wide, /body:has\(\.pack-view\.has-hand\) \.field \{ grid-template-rows: minmax\(0, 1fr\); \}/);
  assert.match(wide, /\.pack-view\.has-hand \{ height: 100%; \}/, 'the hand rests at the foot of the screen');
  // a Planet Pack's bar takes a second row (the hand panel its pick levels): the racks step aside for it too
  assert.match(wide, /body\[data-screen="pack"\]\[data-pack="planet"\] \.racks \{ display: none; \}/, 'and for a Planet Pack');
  const tall = mediaBlock(css, '(min-width: 600px) and (max-width: 1023px)');
  assert.match(tall, /\.pk-handzone \.pk-detail \{ height: calc\(52 \* var\(--px\)\); \}/, 'the plate a wide compact window keeps (52 art px)');
});

test('F3, final agent of part 3: a Planet Pack keeps the racks on a landscape phone; a wide compact window still sends them aside', () => {
  const css = read('src/styles/50-shop.css');
  const wide = mediaBlock(css, '(min-width: 600px) and (max-width: 1023px) and (max-height: 760px)');
  // that block matches every landscape phone from 600 px wide too (844 x 390, 932 x 430, 667 x 375), so its Planet rule
  // sent the racks aside there as well: no Joker or consumable could be seen, sold or used while a Planet Pack was open,
  // though the pack fits beside them there (as before part 3; tests/e2e/part3.mjs section 7 measures it)
  const notLand = mediaBlock(wide, 'not all and (max-height: 760px) and (orientation: landscape)');
  assert.ok(notLand, 'the Planet rule stands in a block that leaves the landscape phone out');
  assert.match(notLand, /body\[data-screen="pack"\]\[data-pack="planet"\] \.racks \{ display: none; \}/, 'the racks step aside for a Planet Pack there');
  assert.match(notLand, /body\[data-screen="pack"\]\[data-pack="planet"\] \.field \{ grid-template-rows: minmax\(0, 1fr\); \}/);
  assert.doesNotMatch(wide.replace(notLand, ''), /data-pack="planet"/, 'and nowhere else in the wide block');
  // the landscape phone's own block (the query the nested one negates) never sends the racks aside for a Planet Pack
  const land = mediaBlock(css, '(max-width: 1023px) and (max-height: 760px) and (orientation: landscape)');
  assert.ok(land, "the landscape phone's block");
  assert.doesNotMatch(land, /data-pack="planet"\] \.racks/);
});

test("final agent of part 3: on a landscape phone a pack's name wraps in its pill instead of running out of it", () => {
  // the head column is 56 art px (112 px) wide there: "Jumbo Planet Pack" (144 px of text), "Mega Planet Pack",
  // "Jumbo Joker Pack" and the other Jumbo and Mega Card, Planet and Joker Packs ran out of the pill and under the
  // first card ("MEGA PLANET PA"); the pill grows to a second line, as the Blind's pill does at the table (40-table.css)
  const css = read('src/styles/50-shop.css');
  const land = mediaBlock(css, '(max-width: 1023px) and (max-height: 760px) and (orientation: landscape)');
  const rule = /\n {2}\.pk-head > \.tag \{([^}]*)\}/.exec(land);
  assert.ok(rule, "the landscape block styles the pack's pill");
  assert.match(rule[1], /white-space: normal;/, 'its name may wrap');
  assert.match(rule[1], /height: auto;/, 'and the pill grows with it');
  assert.match(rule[1], /min-height: calc\(9 \* var\(--px\)\);/, 'one line keeps the pill its own nine art px');
  assert.match(read('src/styles/40-table.css'), /\.w-blind \.tag, \.w-hand \.tag \{ max-width: 100%; height: auto; min-height: calc\(9 \* var\(--px\)\); line-height: \.9; white-space: normal; text-wrap: balance;/, "the same way the table's Blind pill wraps");
});

test('F4: the perf scenario measures the payout at real speed, at Normal and at Blazing, whatever URL it is given', () => {
  const src = read('tests/e2e/perf.mjs');
  assert.match(src, /u\.searchParams\.delete\('test'\)/, 'it drops test=1 from the URL it is given');
  assert.match(src, /if \(await js\('TW\.UI\.TEST'\)\) fail\(/, 'and refuses to measure in test mode');
  assert.match(src, /process\.env\.SPEEDS \|\| '2,4'/, 'at Normal (2) and Blazing (4), the fastest a player can pick');
  assert.match(src, /TW\.UI\.setSetting\('speed', \$\{speed\}\)/, 'through the game speed setting players use');
  // final pass, part 4 (P6): the Shop's entrance takes the payout's bar too
  assert.match(src, /if \(out\.payoutLongTasks \|\| out\.shopLongTasks\) fail\(/, "the bar is the same at both speeds: no long task in the payout or the Shop's entrance");
  // Blazing is the fastest setting there is
  const core = read('src/ui/00-core.js');
  const speeds = [...core.matchAll(/\{ value: (\d), name: '(\w+)', div: ([\d.]+) \}/g)].map((m) => ({ value: Number(m[1]), name: m[2], div: Number(m[3]) }));
  assert.equal(speeds.length, 4);
  assert.equal(speeds.reduce((a, b) => (b.div > a.div ? b : a)).value, 4, 'setting 4 has the largest divisor');
});

test('F5: the open pack drawn anew keeps keyboard focus, and a breakpoint\'s redraw waits for a busy moment to end', () => {
  const shop = read('src/ui/20-shop.js').replace(/\r\n/g, '\n');
  // the pack's update draws the view anew: it finds the control that had focus again (a button by action and index, an
  // option's art, a card of the dealt hand, the hand group)
  assert.match(shop, /const packFocusKey = \(n\) => \{[\s\S]*?data-action[\s\S]*?data-opt-art[\s\S]*?#hand \.card\[data-uid=[\s\S]*?\n {2}\};/);
  assert.match(shop, /update\(\) \{\n {6}if \(UI\.isBusy\(\)\) return;[\s\S]*?const key = packFocusKey\(document\.activeElement\);[\s\S]*?main\.innerHTML = packHTML\(R\(\)\);[\s\S]*?const n = key && \$\(key, main\);\n {6}if \(n\) UI\.focusQuiet\(n\);/, 'the pack\'s update puts focus back');
  // the final agent's breakpoint redraw (part 2) was dropped when the Shop or the pack was busy
  assert.match(shop, /if \(UI\.isBusy\(\)\) \{ rd = setTimeout\(redrawForBreakpoint, 250\); return; \}/, 'busy: it tries again');
  assert.match(shop, /UI\.onBreakpoint\(\(\) => \{ clearTimeout\(rd\); rd = setTimeout\(redrawForBreakpoint, 0\); \}\);/);
  // the behaviour: packFocusKey in the vm, on stand-in nodes inside and outside the open pack
  const { TW } = load();
  const key = TW.UI.shop.packFocusKey;
  const node = (dataset, id = '', inPack = true) => ({ dataset, id, closest: (sel) => (inPack && sel === '.pack-view' ? {} : null) });
  assert.equal(key(node({ action: 'pack-pick', index: '2' })), '.pack-view [data-action="pack-pick"][data-index="2"]', 'a Use button, by its index');
  assert.equal(key(node({ action: 'pack-skip' })), '.pack-view [data-action="pack-skip"]', 'Skip');
  assert.equal(key(node({ optArt: '1' })), '.pack-view [data-opt-art="1"]', 'an option\'s art');
  assert.equal(key(node({ uid: 'c12' })), '#hand .card[data-uid="c12"]', 'a card of the dealt hand');
  assert.equal(key(node({}, 'hand')), '#hand', 'the hand group');
  assert.equal(key(node({ action: 'pack-pick', index: '0' }, '', false)), null, 'nothing outside the pack');
  assert.equal(key(null), null);
});

test('F6: on a narrow strip a covered card\'s Seal tab moves onto the strip, clear of the rank; the 30 px strips are written down', () => {
  // a fanned hand of eight stand-in cards, each step px from the last, laid out by the table's own layoutHand
  const tabAt = (step) => {
    const props = {};
    const cards = [...Array(8)].map((_, i) => Object.assign(fakeEl('button'), { offsetLeft: i * step, querySelector: () => null, querySelectorAll: () => [] }));
    const hand = Object.assign(fakeEl('div'), { id: 'hand', querySelectorAll: (sel) => (sel === '.card' ? cards : []), style: { setProperty: (k, v) => { props[k] = v; }, removeProperty() {} } });
    const { TW } = load('?test=1&seed=PARTTHR6', { compact: true, find: (sel) => (sel === '#hand' ? hand : null) });
    assert.equal(TW.UI.PX(), 2, 'the compact layout: 2 CSS px an art pixel');
    TW.UI.table.layoutHand();
    return [Number(props['--tab-x']), Number(props['--tab-b'])];
  };
  // the tab is 9 art px wide; at x 10 its foot is 5 art px into the card (clear of the index at x 3 to 7 and the pips
  // from row 6); a narrower strip than 19 art px moved nothing, so the next card hid the tab's right side
  assert.deepEqual(tabAt(44), [10, 5], '390 x 844 (22 art px strips): the tab keeps its spot');
  assert.deepEqual(tabAt(40), [10, 5], '360 x 640 (20)');
  assert.deepEqual(tabAt(36), [9, 5], 'an 18 art px strip: one art px left, still clear of the index');
  assert.deepEqual(tabAt(30), [6, 3], '667 x 375 (15): it ends at the strip\'s edge, over the index\'s columns, so it rides two art px higher');
  assert.deepEqual(tabAt(16), [1, 3], 'never left of the card\'s border');
  const css = read('src/styles/40-table.css');
  assert.match(css, /\.hand\.is-fanned \.card:not\(:last-child\):not\(\.is-dragging\) \.seal-badge \{ left: calc\(var\(--tab-x, 10\) \* var\(--px\)\); top: calc\(\(var\(--tab-b, 5\) - var\(--h\)\) \* var\(--px\)\); \}/);
  // every Seal badge is as wide as fanCheck assumes
  const A = load().TW.Art;
  for (const id of A.ids('seal:')) assert.equal(A.bitmap(id).w, 9, `${id} is 9 art px wide`);
  // the 30 px strips of the smallest landscape phone are written down where the layout is
  assert.match(css, /the smallest landscape phone \(667 x 375\) leaves the hand 289 px, so each covered\s+card shows a 30 px strip/);
});

test('F2, F3 (found on the way): effects never start from a rack with no box; the main area\'s route copy is fixed in place', () => {
  // the racks step aside while a pack deals its hand (a phone, and now a window 760 px tall or less): a Joker reacting
  // there (Tea Leaves on a Tarot card) popped its note at the screen's top-left corner, from a rack with no box
  const shop = read('src/ui/20-shop.js').replace(/\r\n/g, '\n');
  assert.match(shop, /const shown = \(n\) => !!\(n && n\.getClientRects && n\.getClientRects\(\)\.length\);/);
  assert.match(shop, /const burstAt = \(node, cols, n = 10, spread = 0\.8\) => \{ if \(!shown\(node\) \|\| !T\(\)\.burst\) return;/, 'sparks');
  assert.match(shop, /const ringAt = \(node, rgb, r = 70, ms = 720, delay = 0\) => \{ if \(!shown\(node\) \|\| !T\(\)\.ring\) return;/, 'rings');
  assert.match(shop, /function landGhost\(ghost, dest, cols, d = 560\) \{\n {4}if \(!shown\(dest\)\) \{ if \(ghost\) ghost\.remove\(\); return; \}/, 'a flight to it');
  assert.match(shop, /function roomFlash\(node, k = 0\.6\) \{\n {4}if \(!shown\(node\) \|\|/, 'a flash of the room');
  assert.match(shop, /function tagOn\(node, text, cls, ms = 1500\) \{\n {4}if \(!shown\(node\) \|\| !text\) return;/, 'a tag or a note');
  // the main area's route copy keeps the class .main; 40-table.css's .main { position: relative } outranked the copy's
  // position: fixed, so it fell into the page's flow under the table and the page grew by a screen while it faded
  const chrome = read('src/styles/20-chrome.css');
  assert.match(chrome, /\.main\.route-ghost-main, \.route-ghost-main \{ position: fixed;/, 'the copy outranks .main');
  assert.match(read('src/styles/40-table.css'), /\n\.main \{ position: relative;/, 'the rule it must outrank');
  const order = readdirSync(new URL('src/styles/', root)).filter((f) => f.endsWith('.css')).sort();
  assert.ok(order.indexOf('20-chrome.css') >= 0 && order.indexOf('20-chrome.css') < order.indexOf('40-table.css'), 'which the build puts later (file-name order)');
});
