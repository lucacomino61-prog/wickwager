// Unit tests for the final pass, part 4 (the small-windows round, P1 to P6, 2026-11-25): the stylesheets, the perf
// scenario and the UI as text, and src/ui/*.js in a vm with a fake DOM (as tests/ui-part3.test.mjs does) for what runs.
// The browser half is tests/e2e/windows.mjs (P1, P2: every screen at 99 sizes) and tests/e2e/part4.mjs (P3, P4).
//   P1  short browser windows scrolled the page outside packs: a short window held wide (below 1024 px wide, 601 to 760
//       px tall) takes the landscape phone's layout, with the table's column given back; a compact window held
//       upright under 870 px tall sets its top bar's two rows out again; the compact Shop under 870 px tall stands its
//       items in one row; the table layout's Shop keeps three lines of text at 820 px tall or less and two at 700; a
//       Boss Blind's column and the end screens and run setup fit a window 700 px tall;
//   P2  the narrow 3 px table (1024 to 1279 px wide, 870 px tall or more): a pack of six scrolls inside the field, the
//       reading plate stays in it, the dealt hand's strips are 44 px, Play hand's row stays under the hand;
//   P3  the rows that scroll keep room for a focus ring, and the keyboard brings a control whole into view;
//   P4  on a short window held wide the racks stay over a pack that deals a hand;
//   P5  comments that say what the code does, the unused classes gone, one source for the springs;
//   P6  the Shop's shelves are built a task after the screen change, the fading copy is lighter, and perf.mjs guards
//       the Shop's entrance with the payout's bar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

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
/** The UI in a vm. o.linear: whether CSS.supports linear(); o.styles(node): what getComputedStyle answers. The document's
    listeners and the root's custom properties are kept, so a test can fire one and read the other. */
function load(search = '?test=1&seed=PARTFOUR', o = {}) {
  const storage = new Map(), listeners = {}, props = {};
  const html = fakeEl('html');
  html.style = { setProperty(k, v) { props[k] = v; }, removeProperty() {}, cssText: '' };
  const doc = {
    readyState: 'loading', documentElement: html, body: fakeEl('body'),
    createElement: (t) => fakeEl(t), addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, getAnimations() { return []; },
    fonts: { load: async () => [], ready: Promise.resolve(), check: () => false }, activeElement: null,
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout, clearTimeout, performance, Promise, URLSearchParams, Map, Set, WeakMap, Math, JSON, Date,
    Number, String, Array, Object, Symbol, Error, Uint8Array, Uint8ClampedArray, Float32Array, Int32Array, RegExp,
    location: { search }, document: doc, navigator: {}, innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    getComputedStyle: (n) => (o.styles ? o.styles(n) : { overflowX: 'visible', overflowY: 'visible' }),
    localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => { storage.set(k, String(v)); }, removeItem: (k) => storage.delete(k) },
    CSS: { supports: () => o.linear !== false }, addEventListener() {}, removeEventListener() {},
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['src/content.js', ...ART, 'src/engine.js', ...UI_FILES]) vm.runInContext(read(f), ctx, { filename: f });
  ctx.TW.UI.paint.Px.prototype.url = function () { return `data:image/png;base64,${this.w}x${this.h}`; };
  // o.boot: the page's boot binds the document's listeners before it looks for the page's elements, which the fake DOM
  // lacks; the listeners are what a test fires
  if (o.boot) { try { (listeners.DOMContentLoaded || []).forEach((fn) => fn()); } catch (err) { /* no #app in the fake DOM */ } }
  return { TW: ctx.TW, doc, listeners, props, ctx };
}
/** One @media block's body (the first whose query is exactly q, nested or not), or null. */
function mediaBlock(css, q) {
  const at = css.indexOf(`@media ${q} {`);
  if (at < 0) return null;
  let i = css.indexOf('{', at) + 1, depth = 1;
  const start = i;
  for (; i < css.length && depth; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
  return css.slice(start, i - 1);
}
const TABLE = () => read('src/styles/40-table.css');
const SHOP = () => read('src/styles/50-shop.css');
const SCREENS = () => read('src/styles/60-screens.css');
const LAND = '(max-width: 1023px) and (max-height: 760px) and (orientation: landscape)';
const BAND = '(max-width: 1023px) and (min-height: 601px) and (max-height: 760px) and (orientation: landscape)';

test('P1: a short window held wide takes the landscape layout (a status column, the hand\'s buttons beside it), up to 760 px tall', () => {
  // its top bar of two rows left Play hand and Discard below the fold at 900 x 650 and 800 x 620, and a Boss Blind's
  // rule grew it by four lines more (up to 172 px of page scroll)
  for (const [f, css] of [['40-table.css', TABLE()], ['50-shop.css', SHOP()]]) {
    assert.ok(!css.includes('@media (max-width: 1023px) and (max-height: 600px) and (orientation: landscape) {\n  .table'), `${f}: the layout no longer stops at 600 px tall`);
    assert.ok(mediaBlock(css, LAND), `${f}: the landscape block reaches 760 px tall`);
  }
  assert.match(mediaBlock(TABLE(), LAND), /\.table \{ grid-template-columns: calc\(112 \* var\(--px\)\) minmax\(0, 1fr\);/, 'the status column beside the field');
  // a landscape phone (600 px tall or less) keeps its own Tags rule: the waiting Tags show again on a taller window
  assert.match(SHOP(), /@media \(max-width: 1023px\) and \(max-height: 600px\) and \(orientation: landscape\), \(max-width: 599px\) and \(max-height: 760px\) \{\s*\.main\[data-screen="blind-select"\] > \.tags-waiting \{ display: none; \}/);
});

test('P1: on a short window held wide (601 to 760 px tall) the column gives back what a phone sets aside, in the table\'s order', () => {
  const band = mediaBlock(TABLE(), BAND);
  assert.ok(band, 'the band\'s own block');
  assert.match(band, /\.w-blind \.candle, \.w-blind \.emblem \{ display: grid; \}/, 'the Blind\'s candle or the Boss\'s emblem');
  assert.match(band, /\.w-blind \.boss-rule \.copy \{ display: block; -webkit-line-clamp: none;/, 'the whole Boss rule');
  // the table's order: the Blind, the Blind score, Chips x Mult, hands and discards, money with Ante and the Blind count,
  // Overview and Options with their names
  const at = (sel) => { const m = new RegExp(`body:not\\(:is\\(\\[data-screen="shop"\\], \\[data-screen="pack"\\]\\)\\) \\.col > \\.${sel} \\{ grid-area: (\\d+) /`).exec(band); return m ? Number(m[1]) : null; };
  assert.deepEqual(['w-score', 'w-hand', 'r-counts', 'r-money', 'r-btns'].map(at), [2, 3, 4, 5, 6]);
  assert.match(band, /\.col > \.r-money > \.w-small \{ display: grid; \}/, 'Ante and the Blind count beside the money');
  assert.match(band, /\.col > \.r-counts > \.btn\.ph-only \{ display: none !important; \}/, 'the icon buttons give way to the named ones');
  assert.match(band, /\.col > \.r-btns \.btn \{ min-height: 44px; \}/, 'Overview and Options keep 44 px targets');
  assert.match(band, /\.blind-card \.bc-emblem \{ display: grid; height: calc\(33 \* var\(--px\)\); \}/, 'the Blind select keeps its candles');
  assert.match(band, /\.blinds \{ align-items: end; \}/, 'and its Blinds stand at the stage\'s foot');
  // the landscape phone's counts took 59 px for "Discards" (68): the counts take what their labels need
  assert.match(mediaBlock(TABLE(), LAND), /\.col > \.r-counts \{ grid-area: 4 \/ 1 \/ 5 \/ 13; grid-template-columns: minmax\(min-content, 1fr\) minmax\(min-content, 1fr\) auto auto;/);
});

test('P1: a compact window held upright under 870 px tall sets its top bar out again; at 760 px or less the stage gives way', () => {
  const up = mediaBlock(TABLE(), '(min-width: 600px) and (max-width: 1023px) and (max-height: 869px) and (orientation: portrait)');
  assert.ok(up, 'the upright window\'s block');
  // three narrow panels and Chips x Mult in one row of four wrapped the Blind's pill, ran "Blind score" out of its pill
  // and gave a Boss rule five lines
  assert.match(up, /\.col > \.w-blind \{ grid-area: 1 \/ 1 \/ 2 \/ 7; \}/, 'the Blind takes half the first row');
  assert.match(up, /\.col > \.w-hand \{ grid-area: 2 \/ 1 \/ 3 \/ 7; \}/, 'Chips x Mult opens the second');
  assert.match(up, /\.col > \.r-counts \{ grid-area: 2 \/ 7 \/ 3 \/ 13;/, 'beside hands, discards and the two buttons');
  assert.match(up, /\.w-blind \.boss-rule \.copy \{ display: -webkit-box;[^}]*-webkit-line-clamp: 2;/, 'a Boss rule in two lines (its tip holds it whole)');
  assert.match(up, /body:not\(:is\(\[data-screen="shop"\], \[data-screen="pack"\]\)\) \.r-counts > \.w-small\.ph-only \{ display: none !important; \}/, 'Ante and the Blind count step aside on the table only');
  const short = mediaBlock(TABLE(), '(min-width: 600px) and (max-width: 1023px) and (max-height: 760px) and (orientation: portrait)');
  assert.ok(short, '...and its block at 760 px tall or less');
  assert.match(short, /\.main \{ grid-template-rows: minmax\(0, 1fr\) auto auto;/, 'the stage gives up its room');
  assert.match(short, /\.hand \.card\[aria-pressed="true"\] \.lift \{ transform: translateY\(calc\(-10 \* var\(--px\)\)\); \}/, 'a chosen card rises 10 art px');
  assert.match(short, /body\[data-screen="blind-select"\] \.w-blind \.boss-rule \{ display: none; \}/, 'the bar says no Boss rule its Blind already says');
  assert.match(short, /\.blind-card \.bc-emblem \{ display: none; \}/);
});

test('P1: the compact Shop under 870 px tall stands its items in one row under its head (not on a landscape phone)', () => {
  const outer = mediaBlock(SHOP(), '(min-width: 600px) and (max-width: 1023px) and (max-height: 869px)');
  assert.ok(outer, 'the compact, short Shop\'s block');
  const inner = mediaBlock(outer, 'not all and (max-height: 600px) and (orientation: landscape)');
  assert.ok(inner, 'which leaves the landscape phone\'s Shop as it is');
  assert.match(inner, /\.shop > \.sh-head \{ width: auto; min-height: 44px; flex-direction: row;/, 'the head row over the items');
  assert.match(inner, /\.shop-grid, \.shop\.dense \.shop-grid \{ display: grid; grid-template-columns: max-content max-content;[^}]*overflow-x: auto;/, 'one row: the cards, then the packs and the Voucher');
  assert.match(inner, /\.si, \.shop\.dense \.si \{ grid-template-columns: calc\(var\(--card-w\) \+ 4 \* var\(--px\)\);[^}]*grid-template-areas: "art" "info" "buy";/, 'each item a column, as on a phone');
  assert.match(inner, /-webkit-line-clamp: 2;/, 'with a two-line taste of its effect');
  assert.match(inner, /\.si-art \{ padding-bottom: calc\(4 \* var\(--px\)\); \}/, 'and room under the art for an Edition pill');
  // where the Shop sits: at the foot of the field, as at the table
  assert.match(inner, /\.shop, \.shop\.dense \{ flex-direction: column; align-items: stretch; align-self: end;/);
});

test('P1: the table layout\'s Shop keeps three lines of text at 820 px tall or less (Night Market) or 760 (five items), two at 700', () => {
  const t820 = mediaBlock(SHOP(), '(min-width: 1024px) and (max-height: 820px)'), t760 = mediaBlock(SHOP(), '(min-width: 1024px) and (max-height: 760px)'), t700 = mediaBlock(SHOP(), '(min-width: 1024px) and (max-height: 700px)');
  assert.match(t820, /^\s*\.shop\.dense \.si-text \{ -webkit-line-clamp: 3; line-clamp: 3; \}\s*$/, 'Night Market at 820 px or less');
  assert.match(t760, /^\s*\.si-text \{ -webkit-line-clamp: 3; line-clamp: 3; \}\s*$/, 'the five-item Shop at 760 px or less (a laptop at 768 keeps its five lines)');
  assert.match(t700, /\.si-text, \.shop\.dense \.si-text \{ -webkit-line-clamp: 2; line-clamp: 2; \}/);
  assert.match(t700, /\.si-kind \{ display: none; \}/);
});

test('P1: a Boss Blind\'s column, the run setup and the end screens fit a window 700 px tall', () => {
  const boss = mediaBlock(TABLE(), '(min-width: 1024px) and (max-height: 700px)');
  assert.ok(boss, 'the short table\'s block');
  assert.match(boss, /\.w-blind \.boss-rule \.b-name \{ display: none; \}/, 'the Boss\'s name steps out of its rule (the pill names it)');
  assert.match(boss, /\.col > \.w-score \{ height: calc\(40 \* var\(--px\)\); \}/);
  const setup = mediaBlock(SCREENS(), '(min-width: 600px) and (max-height: 700px)');
  assert.match(setup, /\.scr-setup \{ height: 100dvh; min-height: 0; grid-template-rows: minmax\(0, 1fr\); \}/, 'the setup plate is as tall as the window');
  assert.match(setup, /\.su-plate > \.su-grid \{[^}]*overflow-y: auto;[^}]*padding: 6px; margin: calc\(2 \* var\(--px\) - 6px\) -6px -6px; \}/, 'its Deck and Stake scroll inside it, with room for the rings');
  assert.match(mediaBlock(SCREENS(), '(max-height: 700px)'), /\.es-plate \{ gap: calc\(3 \* var\(--px\)\);/, 'the end screens sit closer');
  // a toast on a compact menu or end screen sits at the top, off Start run and the end screens' buttons
  assert.match(SCREENS(), /@media \(max-width: 1023px\) \{\s*body:is\(\[data-screen="title"\], \[data-screen="setup"\], \[data-screen="records"\], \[data-screen="collection"\], \[data-screen="gameover"\], \[data-screen="win"\]\) \.toasts \{/);
});

test('P2: on the narrow 3 px table a pack of six scrolls inside the field, the plate stays in it, the dealt hand gets 44 px strips', () => {
  assert.match(mediaBlock(SHOP(), '(min-width: 1024px)'), /\.shop\.dense \.shelf/, 'the table layout\'s Night Market rule is still there');
  assert.ok(/@media \(min-width: 1024px\) \{\s*\.pk-stage \{ grid-template-columns: minmax\(0, 1fr\); \}/.test(SHOP()), 'the stage\'s one column is the field\'s width, never the row\'s');
  const narrow = mediaBlock(SHOP(), '(min-width: 1024px) and (max-width: 1279px) and (min-height: 870px)');
  assert.ok(narrow, 'the narrow 3 px table\'s block');
  assert.match(narrow, /\.pk-opts\.is-many \{[^}]*overflow-x: auto;[^}]*scrollbar-width: thin;/, 'a pack of six scrolls sideways, with a thin bar for a mouse');
  assert.match(narrow, /padding: calc\(4 \* var\(--px\)\) 6px 6px; margin: 0 -6px -6px; scroll-padding-inline: 6px;/, 'and room for the focus ring');
  assert.match(narrow, /\.pk-handzone \{ grid-template-columns: calc\(70 \* var\(--px\)\) minmax\(0, 1fr\);/, 'the plate narrows beside the hand');
  assert.match(narrow, /\.pk-handzone > \.pk-deck \{ display: none; \}/, 'and the deck steps aside');
  // at 1024 px: field 655 px, plate 210, gap 12, so the hand gets 433 px and eight 123 px cards show strips of 44 px
  const strip = (433 - 41 * 3) / 7;
  assert.ok(strip >= 44, `strips of ${strip.toFixed(1)} px`);
  assert.match(narrow, /\.shelf, \.shop\.dense \.shelf \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, max-content\)\);/, 'Night Market\'s shelves hold two a row');
  assert.match(mediaBlock(TABLE(), '(min-width: 1024px) and (max-width: 1279px) and (min-height: 870px)'), /\.controls \.btn\.big \{ min-width: 0; \}/, 'Play hand\'s row stays under the hand');
});

test('P3: the rows that scroll keep 6 px of room for a focus ring, given back so nothing moves', () => {
  const css = SHOP();
  assert.match(css, /\.shop-grid \{\n {2}display: grid;[^}]*padding: 6px calc\(1 \* var\(--px\) \+ 6px\) calc\(1 \* var\(--px\) \+ 6px\); margin: -6px; scroll-padding: 6px;/, 'the table\'s shelves');
  assert.match(mediaBlock(css, LAND), /\.shop-grid, \.shop\.dense \.shop-grid \{[^}]*padding: 6px; margin: -6px; scroll-padding: 6px; \}/, 'the landscape Shop\'s row (5 px of the first ring was cut)');
  assert.match(mediaBlock(css, LAND), /\.pk-opts \{ width: auto; margin: 0 -2px -2px; padding: calc\(4 \* var\(--px\)\) 6px 6px; scroll-padding-inline: 6px;/, 'a pack\'s options there (1 px was cut)');
  assert.match(mediaBlock(css, LAND), /\.pack-view\.has-hand \.pk-handcol \{ grid-area: 3 \/ 2 \/ 4 \/ 3; padding-bottom: calc\(6 \* var\(--px\)\); \}/, 'the dealt hand\'s outer cards clear the window\'s foot (3 px was cut)');
  assert.match(css, /\.pk-opts:has\(:focus-visible\) \{ scroll-snap-type: none; \}/, 'a row\'s soft snap holds off while the keyboard is in it');
  assert.match(css, /margin: 0 calc\(-8 \* var\(--px\)\) -2px; gap: calc\(3 \* var\(--px\)\); padding: calc\(5 \* var\(--px\)\) calc\(2 \* var\(--px\)\) 6px; \}/, 'the compact options row\'s foot');
});

test('P3: a control the keyboard focuses inside a row that scrolls comes whole into view; a press never scrolls', () => {
  const { listeners } = load('?test=1&seed=PARTFOUR', {
    boot: true,
    styles: (n) => (n.scroller ? { overflowX: 'auto', overflowY: 'hidden' } : { overflowX: 'visible', overflowY: 'visible' }),
  });
  const calls = [];
  const node = (o) => Object.assign({ dataset: {}, closest() { return null; }, matches() { return false; }, contains() { return false; }, getAttribute() { return null; }, hasAttribute() { return false; } }, o);
  const row = node({ scroller: true, scrollWidth: 900, clientWidth: 500, scrollHeight: 200, clientHeight: 200, parentElement: null });
  const item = node({ scrollWidth: 0, clientWidth: 0, scrollHeight: 0, clientHeight: 0, parentElement: row });
  const btn = node({ parentElement: item, getBoundingClientRect() { return {}; }, scrollIntoView(o) { calls.push(o); } });
  const ev = (o) => Object.assign({ preventDefault() {}, stopPropagation() {}, defaultPrevented: false }, o);
  // only the core's own input bookkeeping and the focus listener are fired here (the rest want a whole page)
  const fire = (type, e) => (listeners[type] || []).forEach((fn) => { try { fn(ev(e)); } catch (err) { /* a listener that needs the page */ } });
  assert.ok((listeners.focusin || []).length >= 1, 'the core listens for focus');
  fire('pointerdown', { target: btn, pointerType: 'mouse' });
  fire('focusin', { target: btn });
  assert.equal(calls.length, 0, 'focus that a press gave scrolls nothing');
  fire('keydown', { key: 'Tab', target: btn });
  fire('focusin', { target: btn });
  assert.deepEqual(calls.map((o) => [o.block, o.inline]), [['nearest', 'nearest']], 'keyboard focus brings it whole into view, nearest, so nothing already in view moves');
  // a row that holds all it has (nothing to scroll) is left alone
  row.scrollWidth = 500;
  fire('focusin', { target: btn });
  assert.equal(calls.length, 1);
});

test('P4: on a short window held wide the racks stay over a pack that deals a hand; elsewhere they step aside as before', () => {
  const band = mediaBlock(SHOP(), BAND);
  assert.ok(band, 'the band\'s block in the Shop\'s styles');
  assert.match(band, /body:has\(\.pack-view\.has-hand\) \.racks \{ display: flex; \}/);
  assert.match(band, /body:has\(\.pack-view\.has-hand\) \.field \{ grid-template-rows: auto minmax\(0, 1fr\); \}/);
  // it comes after the blocks that send the racks aside, so it wins in the band
  const css = SHOP();
  assert.ok(css.indexOf(`@media ${BAND}`) > css.indexOf(`@media ${LAND}`), 'after the landscape block');
  assert.ok(css.indexOf(`@media ${BAND}`) > css.indexOf('@media (min-width: 600px) and (max-width: 1023px) and (max-height: 760px) {'), 'and after the compact short block');
});

test('P5: the comments say what the code does, and the classes nothing uses are gone', () => {
  const tokens = read('src/styles/10-tokens.css'), chrome = read('src/styles/20-chrome.css'), core = read('src/ui/00-core.js');
  assert.doesNotMatch(tokens, /2 at 760 px/, 'the pixel size is 2 below 1024 px wide or under 870 px tall, not "at 760 px"');
  assert.match(tokens, /--px is 3 CSS px on a window at least 1024 px wide and 870 px\s+tall, and 2 below 1024 px wide or under 870 px tall/);
  assert.doesNotMatch(TABLE(), /Chips x Mult panel takes the room/, 'the spare height sits above Overview and Options');
  assert.doesNotMatch(SCREENS(), /credits: a small ghost button/, 'Credits wears the opaque plum plate');
  // nothing in the UI, the tests or the art draws these: the classes and the frames painted for them are gone
  for (const cls of ['b-vio', 't-yellow', 'b-yellow']) {
    for (const f of [...UI_FILES, ...readdirSync(new URL('src/styles/', root)).map((x) => 'src/styles/' + x)]) assert.ok(!new RegExp(`\\.${cls}\\b|['"\` ]${cls}['"\` ]`).test(read(f)), `${f} has no ${cls}`);
  }
  for (const frame of ["'pill-yellow'", "'btn-vio'", "'btn-vio-down'", "'btn-yellow'"]) assert.ok(!core.includes(frame + ':'), `no ${frame} frame is painted`);
  assert.ok(core.includes("'btn-yellow-down':"), 'the pressed toggle segment keeps its yellow frame');
  assert.doesNotMatch(read('tests/e2e/access.mjs'), /'t-yellow'/);
});

test('P5: the springs have one source: the CSS variables always take the core\'s curves, and the fallbacks agree', () => {
  const tokens = read('src/styles/10-tokens.css');
  const cssVal = (k) => (new RegExp(`--${k}: (cubic-bezier\\([^)]*\\));`).exec(tokens) || [])[1];
  // a browser without linear(): the core's cubic-béziers are the tokens'
  const old = load('?test=1&seed=PARTFOUR', { linear: false });
  assert.equal(old.TW.UI.EASE.spring, cssVal('spring'));
  assert.equal(old.TW.UI.EASE.soft, cssVal('spring-soft'));
  assert.equal(old.TW.UI.EASE.bouncy, cssVal('spring-bouncy'));
  // either way the core writes its curves into the CSS variables (it wrote them only with linear() before)
  for (const L of [old, load('?test=1&seed=PARTFOUR', { linear: true })]) {
    const UI = L.TW.UI;
    UI.setSetting('speed', 3);
    assert.equal(L.props['--spring'], UI.EASE.spring);
    assert.equal(L.props['--spring-soft'], UI.EASE.soft);
    assert.equal(L.props['--spring-bouncy'], UI.EASE.bouncy);
  }
  assert.match(load('?test=1&seed=PARTFOUR', { linear: true }).TW.UI.EASE.spring, /^linear\(/, 'linear() where it works');
});

test('P6: the Shop\'s shelves are built a task after the screen change; the fading copy is lighter; perf.mjs guards the entrance', () => {
  const shop = read('src/ui/20-shop.js'), core = read('src/ui/00-core.js'), perf = read('tests/e2e/perf.mjs');
  const mount = shop.slice(shop.indexOf("UI.register('shop', {"), shop.indexOf('// ================================================================== the open Booster Pack'));
  assert.match(mount, /if \(!fresh \|\| UI\.TEST\) \{ draw\(\); return; \}/, 'a return to the Shop and test mode draw at once');
  assert.match(mount, /UI\.setBusy\(true\);\s*UI\.afterLayout\(main, \(\) => setTimeout\(\(\) => \{ UI\.clearBusy\(\); if \(UI\.screen\(\) === 'shop' && main\.isConnected && !\$\('#shop', main\)\) draw\(\); \}, 0\)\);/, 'a new visit\'s shelves wait for the screen change\'s frame, input held');
  assert.match(core.slice(core.indexOf('function ghostOf('), core.indexOf('function fadeGhost(')), /g\.querySelectorAll\('\.wash, \.sheen, \.ed-fx'\)\.forEach\(\(n\) => n\.remove\(\)\);/, 'the copy that fades drops its cards\' blended light');
  assert.match(perf, /out\.shopLongTasks = out\.runs\.reduce\(\(n, r\) => n \+ \(r\.shop \? r\.shop\.longTasks : 0\), 0\);/);
  assert.match(perf, /if \(out\.payoutLongTasks \|\| out\.shopLongTasks\) fail\(/, 'one bar for the payout and the Shop\'s entrance');
});
