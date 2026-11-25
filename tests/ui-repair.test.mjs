// Unit tests for the final pass, part 3, repair round (2026-11-25): the confirmed review findings, src/ui/*.js with the
// real content, art and engine in a vm with a fake DOM a little richer than tests/ui-part3.test.mjs's (queries a test
// answers, buttons that keep state, media queries that can change), and the stylesheets as text. The browser half is
// tests/e2e/repair.mjs. Each test failed on the sources before the repair (build 013fa41f).
//   R1  once a deal's hold on input ends, the table sets its buttons again (Rank, Suit, Play hand and Discard were
//       left switched off after every discard and every hand);
//   R3  a name plate keeps its full name, and crossing a breakpoint sets the plates of an open dialog (How to play)
//       and a menu screen (the Collection) again, in place, for the new pixel size (they were cut mid-letter);
//   R4  a tip never covers the Move pair (the chosen card's tip lay over both arrows at 2 px, so the first click on
//       Move landed on the tip);
//   R5  a dialog finds its opener, and a sheet its item, again once the screen under them is drawn anew (focus fell
//       to the page and a Shop item's sheet jumped to the screen's centre);
//   R6  closing a dialog places focus quietly (focusQuiet), so the restored card opens no tip;
//   Q1  a press that starts on a tip is spent closing it: its click reaches no control under it;
//   Q2  with storage full, Save and quit says the run could not be saved (it said "Run saved");
//   Q3  S keeps focus on the hand card that had it (it fell to the page, and the next Enter played the hand);
//   Q4  unlock toasts end with a full stop, and stay quiet once the run has ended (the end screen says them);
//   Q5  on a fanned hand the chosen card's Seal hangs at the art's height on its strip, clear of the Move pair;
//   Q6  the compact Joker rack, a scroller, has room for the whole focus ring;
//   Q8  an empty Joker rack is no Tab stop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const ART = readdirSync(new URL('src/art/', root)).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/art/' + f);
const UI_FILES = readdirSync(new URL('src/ui/', root)).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/ui/' + f);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const rect = (l, t, w, h) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t });

/** The vm's Node: every stand-in element is one, so el(tag, attrs, ...kids) takes them as children. */
class FakeNode {}
/** A stand-in element: attributes that read back, focus that the fake document records, rects a test sets. */
function fakeEl(tag, o = {}) {
  const attrs = {};
  const n = Object.setPrototypeOf({
    tagName: String(tag).toUpperCase(), nodeType: 1, id: '', className: '', textContent: '', innerHTML: '', children: [], dataset: {}, hidden: false, isConnected: true, disabled: false,
    offsetWidth: 200, offsetHeight: 100, offsetLeft: 0,
    style: { setProperty(k, v) { this[k] = String(v); }, removeProperty(k) { delete this[k]; }, cssText: '' },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute(k, v) { attrs[k] = String(v); if (k === 'id') n.id = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null; },
    hasAttribute(k) { return k in attrs; }, removeAttribute(k) { delete attrs[k]; },
    append() {}, prepend() {}, appendChild() {}, remove() {}, after() {}, insertBefore() {},
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getContext() { return null; }, getBoundingClientRect() { return rect(0, 0, 0, 0); }, getClientRects() { return n.isConnected ? [rect(0, 0, 1, 1)] : []; },
    insertAdjacentHTML() {}, replaceChildren() {}, animate() { return null; }, closest() { return null; }, matches() { return false; }, contains(x) { return x === n; },
    focus(opts) { n.focusedWith = opts || null; if (n.doc) n.doc.activeElement = n; },
  }, FakeNode.prototype);
  Object.keys(o.attrs || {}).forEach((k) => n.setAttribute(k, o.attrs[k]));
  const rest = Object.assign({}, o);
  delete rest.attrs;
  return Object.assign(n, rest);
}
/** The UI in a vm. o.find(sel) / o.findAll(sel): what document.querySelector / querySelectorAll answer; o.compact,
    o.px2: the media queries' first state (TW.UI.MQ); o.setItem(key) may throw (a full storage); o.w, o.h: the window. */
function load(search = '?test=1&seed=REPAIR01', o = {}) {
  const storage = new Map();
  const mqs = [];
  const doc = {
    readyState: 'loading', documentElement: fakeEl('html'), body: fakeEl('body'),
    createElement: (t) => fakeEl(t, { doc }), createTextNode: (s) => fakeEl('#text', { textContent: String(s) }), addEventListener() {}, removeEventListener() {},
    querySelector(sel) { return o.find ? o.find(sel) : null; }, querySelectorAll(sel) { return o.findAll ? o.findAll(sel) : []; }, getAnimations() { return []; },
    fonts: { load: async () => [], ready: Promise.resolve(), check: () => false }, activeElement: null,
  };
  doc.activeElement = doc.body;
  const matches = (q) => (/max-width: 1023px/.test(q) && /max-height: 869px/.test(q) ? !!(o.compact || o.px2) : /max-width: 1023px/.test(q) ? !!o.compact : false);
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout, clearTimeout, performance, Promise, URLSearchParams, Map, Set, WeakMap, Math, JSON, Date,
    Number, String, Array, Object, Symbol, Error, Uint8Array, Uint8ClampedArray, Float32Array, Int32Array,
    location: { search }, document: doc, navigator: {}, innerWidth: o.w || 1440, innerHeight: o.h || 900, devicePixelRatio: 1,
    matchMedia: (q) => { const m = { media: q, matches: matches(q), fns: [], addEventListener(t, fn) { if (t === 'change') m.fns.push(fn); } }; mqs.push(m); return m; },
    localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => { if (o.setItem) o.setItem(k); storage.set(k, String(v)); }, removeItem: (k) => storage.delete(k) },
    CSS: { supports: () => true }, Node: FakeNode, addEventListener() {}, removeEventListener() {},
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['src/content.js', ...ART, 'src/engine.js', ...UI_FILES]) vm.runInContext(read(f), ctx, { filename: f });
  ctx.TW.Art.url = (id) => (ctx.TW.Art.has(id) ? 'data:image/png;base64,AAAA' : null);
  /** Cross a breakpoint: the pixel size (and the layout) as given, then every listener each changed query has. */
  const breakpoint = (next) => {
    Object.assign(o, next);
    mqs.forEach((m) => { const was = m.matches; m.matches = matches(m.media); if (was !== m.matches) m.fns.forEach((fn) => fn({ matches: m.matches })); });
  };
  return { TW: ctx.TW, ctx, doc, storage, breakpoint };
}
const quotaError = () => { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; return e; };
const plateText = (html) => { const m = /<span class="plate[^"]*"[^>]*>([^<]*)<\/span>/.exec(html); return m ? m[1] : null; };

test('R1: once a deal\'s hold on input ends, Rank, Suit, Play hand and Discard are set again', async () => {
  const btn = (action) => fakeEl('button', { dataset: { action } });
  const B = { play: btn('play-hand'), disc: btn('discard'), rank: btn('sort-rank'), suit: btn('sort-suit') };
  const { TW } = load('?test=1&seed=REPAIRR1', {
    find: (sel) => ({ '[data-action="play-hand"]': B.play, '[data-action="discard"]': B.disc })[sel] || null,
    findAll: (sel) => (sel === '.seg [data-action^="sort-"]' ? [B.rank, B.suit] : []),
  });
  const UI = TW.UI;
  const run = UI.newRun({ show: false });
  assert.equal(UI.call('startBlind').ok, true);
  const flight = () => { let done; const finished = new Promise((res) => { done = res; }); return { finished, done }; };
  // a discard: the hand is redrawn and its new cards deal in (a hold), then the flow sets the buttons in the same task
  const a = flight();
  UI.busyWhile([a], 5000);
  UI.table.select(run.blind.hand.slice(0, 2));
  assert.equal(UI.isBusy(), true);
  assert.deepEqual([B.rank.disabled, B.suit.disabled, B.play.disabled, B.disc.disabled], [true, true, true, true], 'switched off while the cards fly in');
  a.done();
  await tick();
  assert.equal(UI.isBusy(), false, 'every card has landed');
  assert.deepEqual([B.rank.disabled, B.suit.disabled], [false, false], 'Rank and Suit work again (they stayed off until a card was chosen)');
  assert.deepEqual([B.play.disabled, B.disc.disabled], [false, false], 'and so do Play hand and Discard for the two cards still chosen');
  // a flow that frees input and holds it again in one task tells nobody until the second hold ends
  assert.equal(typeof UI.onIdle, 'function', 'core tells listeners when input is free again');
  let told = 0;
  const stop = UI.onIdle(() => { told++; });
  const b = flight();
  UI.setBusy(true);
  UI.clearBusy();
  UI.busyWhile([b], 5000);
  await tick();
  assert.equal(told, 0, 'not told while the new cards still fly');
  b.done();
  await tick();
  assert.equal(told, 1, 'told once they have landed');
  stop();
  const src = read('src/ui/10-table.js');
  assert.match(src, /UI\.onIdle\(\(\) => \{ if \(phase\(\) === 'play'\) updateControls\(\); \}\);/, 'the table listens');
});

test('R3: a name plate keeps its full name; a breakpoint sets the plates of an open dialog and a menu screen again', () => {
  const plates = [];
  const plate = (full) => { const p = fakeEl('span', { className: 'plate', dataset: { full } }); plates.push(p); return p; };
  const dialogs = fakeEl('div', { querySelectorAll: (sel) => (sel === '.plate[data-full]' ? plates : []) });
  const { TW, breakpoint } = load('?test=1&seed=REPAIRR3', { find: (sel) => (sel === '#dialogs' ? dialogs : null) });
  const UI = TW.UI;
  assert.equal(UI.PX(), 3);
  const name = TW.Content.JOKERS.find((j) => j.name === 'Pipsqueak') ? 'Pipsqueak' : TW.Content.JOKERS.find((j) => j.name.length === 9).name;
  const h3 = UI.plateHTML(name);
  assert.equal(plateText(h3), name, 'whole at 3 px');
  const p = plate(name);
  p.textContent = plateText(h3);
  // a window crossing 870 px tall: 3 px to 2 px; the How to play dialog stays open over the screen
  breakpoint({ px2: true });
  assert.equal(UI.PX(), 2);
  const want = plateText(UI.plateHTML(name));
  assert.notEqual(want, name, 'the name does not fit the plate at 2 px');
  assert.equal(p.textContent, want, 'the open dialog\'s plate is set for 2 px, in place (it kept the 3 px name, cut mid-letter)');
  assert.equal(p.className, /pl-tight/.test(UI.plateHTML(name)) ? 'plate pl-tight' : 'plate');
  // the plate carries the full name it is set again from; replate counts what it changed and leaves a right one alone
  assert.match(h3, new RegExp(`data-full="${UI.esc(name)}"`), 'the plate carries the full name');
  assert.equal(UI.replate(dialogs), 0);
  breakpoint({ px2: false });
  assert.equal(p.textContent, name, 'and back at 3 px, whole again');
  const src = read('src/ui/30-screens.js');
  assert.match(src, /function relight\(\) \{\n {4}UI\.replate\(\$\('#dialogs'\)\);\n {4}if \(!\[[^\n]*\]\.includes\(UI\.screen\(\)\)\) return;\n {4}UI\.replate\(\$\('#app'\)\);/, 'relight sets the plates of an open dialog on any screen, and of a menu screen (the Collection)');
});

test('R4: a tip never covers the Move pair; it stands above it', () => {
  // 1024 x 768: the chosen middle card, the Move pair over the hand (the finding's rects)
  const tip = fakeEl('div', { id: 'tip', hidden: true, offsetWidth: 168, offsetHeight: 61 });
  const mover = fakeEl('div', { id: 'mover', getBoundingClientRect: () => rect(517, 526, 118, 24) });
  const { TW } = load('?test=1&seed=REPAIRR4', { w: 1024, h: 768, find: (sel) => ({ '#tip': tip, '#mover': mover })[sel] || null });
  const UI = TW.UI;
  const card = fakeEl('button', { attrs: { 'data-tip': 'Seven of Hearts' }, getBoundingClientRect: () => rect(563, 590, 82, 110) });
  UI.showTip(card, true);
  assert.equal(tip.hidden, false, 'the tip shows');
  const l = parseFloat(tip.style.left), t = parseFloat(tip.style.top);
  const m = mover.getBoundingClientRect();
  const overlaps = l < m.right && l + 168 > m.left && t < m.bottom && t + 61 > m.top;
  assert.equal(overlaps, false, `the tip (${l}, ${t}, 168 x 61) stays clear of the Move pair (517, 526, 118 x 24); it lay over both arrows`);
  assert.ok(t + 61 <= m.top, 'above it, still over its card');
  UI.hideTip();
  // with the pair hidden (no card chosen, or two) the tip hangs where it always did, just over its card
  mover.hidden = true;
  UI.showTip(card, true);
  assert.equal(parseFloat(tip.style.top), 590 - 61 - 10);
});

test('R5, R6: a dialog finds its opener again, and a sheet its item, once the screen is drawn anew; focus goes back quietly', () => {
  const found = new Map();
  const host = fakeEl('div', { id: 'dialogs' });
  const { TW, doc } = load('?test=1&seed=REPAIRR5', { find: (sel) => (sel === '#dialogs' ? host : null), findAll: (sel) => found.get(sel) || [] });
  const UI = TW.UI;
  const btnLike = (cls, attrs) => fakeEl('button', { className: cls, attrs, doc });
  // (b) Pause opened with Esc from Reroll; a breakpoint draws the Shop anew under it; Esc closes Pause
  const reroll = btnLike('btn b-pink', { 'data-action': 'reroll' });
  doc.activeElement = reroll;
  const pause = UI.dialog({ title: 'Paused' });
  reroll.isConnected = false;
  const reroll2 = btnLike('btn b-pink', { 'data-action': 'reroll' });
  found.set('button.btn[data-action="reroll"]', [reroll2]);
  doc.activeElement = doc.body;
  UI.closeDialog(pause);
  assert.equal(doc.activeElement, reroll2, 'focus goes back to the Reroll drawn in its place (it fell to the page)');
  assert.ok(reroll2.focusedWith && 'focusVisible' in reroll2.focusedWith, 'placed quietly (focusQuiet: no tooltip opens, R6)');
  assert.equal(pause.returnKey, 'button.btn[data-action="reroll"]', 'the handle keeps a selector for its opener');
  // (a) a Shop item's sheet by its art; the art is drawn anew elsewhere
  const art = btnLike('jk si-face', { 'data-shop-art': '0' });
  art.getBoundingClientRect = () => rect(407, 495, 123, 165);
  doc.activeElement = art;
  const sh = UI.sheet({ title: 'Merry-Go-Round', anchor: art });
  const top0 = parseFloat(sh.el.style.top);
  assert.equal(top0, 495 + 165 + 4 * UI.PX(), 'the sheet stands under its art');
  art.isConnected = false;
  const art2 = btnLike('jk si-face', { 'data-shop-art': '0' });
  art2.getBoundingClientRect = () => rect(511, 425, 82, 110);
  found.set('button.jk[data-shop-art="0"]', [art2]);
  sh.place();
  assert.equal(sh.anchor, art2, 'the sheet follows the art drawn in its place');
  assert.equal(parseFloat(sh.el.style.top), 425 + 110 + 4 * UI.PX(), 'and stands by it (it jumped to the screen\'s centre)');
  doc.activeElement = doc.body;
  UI.closeDialog(sh);
  assert.equal(doc.activeElement, art2, 'closing it hands focus to that art');
  // a candidate inside the dialog still open is not the page's control; nothing found leaves focus where it is
  const src = read('src/ui/00-core.js');
  assert.match(src, /const back = refind\(h\.returnFocus, h\.returnKey, [^\n]*\);\n {4}if \(back && typeof back\.focus === 'function' && \(!top \|\| top\.el\.contains\(back\)\)\) focusQuiet\(back\);/, 'closeDialog restores focus through focusQuiet (R6: back.focus() let the card\'s tip pop)');
  assert.doesNotMatch(src, /back\.focus\(\{ preventScroll: true \}\)/);
});

test('Q1: a press that starts on a tip is spent closing it; its click reaches no control', () => {
  const src = read('src/ui/00-core.js');
  // pinned (long-press) or hover: the press hides the tip and arms a one-shot swallow of the click that ends it
  assert.match(src, /if \(onTip\(e\.target\)\) \{ hideTip\(\); tipEat\.on = true; tipEat\.until = Date\.now\(\) \+ 1500; \}/);
  // in the capture phase on the document, before the table's, the Shop's and core's own click handlers
  assert.match(src, /document\.addEventListener\('click', \(e\) => \{\n {6}if \(!tipEat\.on\) return;\n {6}tipEat\.on = false;\n {6}if \(Date\.now\(\) > tipEat\.until\) return;\n {6}e\.preventDefault\(\);\n {6}e\.stopPropagation\(\);\n {4}\}, true\);\n {4}document\.addEventListener\('click', onClick\);/);
  // a press anywhere else, or a key, disarms it (a click a key makes is never swallowed)
  assert.match(src, /else \{\n {8}tipEat\.on = false;\n {8}if \(tipState\.pinned && !tipTargetOf\(e\.target\)\) hideTip\(\);\n {6}\}/);
  assert.match(src, /document\.addEventListener\('keydown', \(\) => \{ lastInput = 'key'; tipEat\.on = false; \}, true\);/);
});

test('Q2: storage full: Save and quit says the run could not be saved, never "Run saved"', () => {
  const box = { full: false };
  const { TW } = load('?test=1&seed=REPAIRQ2', { setItem: (k) => { if (box.full && /ember:run/.test(k)) throw quotaError(); } });
  const UI = TW.UI;
  const toasts = [];
  UI.toast = (text, kind) => { toasts.push({ text, kind }); return null; };
  UI.show = () => 'title';
  UI.newRun({ show: false });
  UI.actions['save-quit']();
  assert.deepEqual(toasts.pop(), { text: 'Run saved. Continue it from the title screen.', kind: 'info' }, 'a save that reached storage');
  UI.newRun({ show: false });
  box.full = true;
  assert.equal(UI.call('startBlind').ok, true);
  UI.actions['save-quit']();
  const t = toasts.pop();
  assert.doesNotMatch(t.text, /Run saved/, `it said "Run saved" while the run lived only in memory: ${t.text}`);
  assert.equal(t.text, "Your browser's storage is full, so the run could not be saved. It lasts until you close the page: continue it from the title screen.");
  assert.equal(t.kind, 'err');
  // the core's own Pause (the stub 30-screens.js replaces) says the same
  assert.match(read('src/ui/00-core.js'), /label: 'Save and quit', cls: 'b-cream', onClick: \(\) => \{ saveRun\(\); state\.run = null; const note = saveQuitNote\(\); toast\(note\.text, note\.saved \? 'info' : 'err'\);/);
});

test('Q3: S keeps focus on the hand card that had it, so the next Enter acts on that card', () => {
  let cards = [];
  const hand = fakeEl('div', { id: 'hand', querySelectorAll: (sel) => (sel === '.card' ? cards.slice() : []) });
  const { TW, doc } = load('?test=1&seed=REPAIRQ3', { find: (sel) => (sel === '#hand' ? hand : null) });
  const UI = TW.UI;
  const run = UI.newRun({ show: false });
  assert.equal(UI.call('startBlind').ok, true);
  cards = run.blind.hand.map((u) => fakeEl('button', { className: 'card', dataset: { uid: u }, doc }));
  // moving a node takes a focused one out of the page for a moment: the browser drops focus to the body
  hand.appendChild = (n) => { cards = cards.filter((x) => x !== n).concat(n); if (doc.activeElement === n) doc.activeElement = doc.body; };
  const second = cards[1];
  doc.activeElement = second;
  UI.table.sortBy(run.sortMode === 'rank' ? 'suit' : 'rank');
  assert.equal(doc.activeElement, second, 'focus stays on the card (it fell to the page, so Enter played the hand)');
  assert.ok(second.focusedWith && 'focusVisible' in second.focusedWith, 'given back quietly (no tip pops)');
  // focus elsewhere (a Sort button, the page) is left where it is
  doc.activeElement = doc.body;
  UI.table.sortBy(run.sortMode === 'rank' ? 'suit' : 'rank');
  assert.equal(doc.activeElement, doc.body);
});

test('Q4: unlock toasts are sentences; once the run has ended they stay quiet, as the end screen says them', async () => {
  const live = fakeEl('div', { id: 'live' });
  const kids = [];
  const toasts = fakeEl('div', { id: 'toasts', children: kids, append: (n) => { kids.push(n); n.remove = () => { const i = kids.indexOf(n); if (i >= 0) kids.splice(i, 1); }; } });
  Object.defineProperty(toasts, 'firstElementChild', { get: () => kids[0] });
  const { TW } = load('?test=1&seed=REPAIRQ4', { find: (sel) => ({ '#live': live, '#toasts': toasts })[sel] || null });
  const UI = TW.UI, E = TW.Engine;
  const run = UI.newRun({ show: false });
  const real = E.applyRunToRecords;
  let give = [];
  E.applyRunToRecords = (records, r, o) => { const out = real(records, r, o); return { records: out.records, unlocked: give.splice(0) }; };
  // mid-run: said, each a sentence of its own
  give = [{ type: 'deck', id: 'a', name: 'Parlour Deck' }, { type: 'deck', id: 'b', name: 'Mirrorball Deck' }];
  UI.updateRecords();
  await tick(40);
  assert.equal(live.textContent, 'Unlocked: Parlour Deck. Unlocked: Mirrorball Deck.', 'mid-run unlocks are said, each ending with a full stop');
  assert.deepEqual(kids.map((k) => /Unlocked: \w+ Deck\./.test(k.innerHTML)), [true, true], 'and shown');
  UI.takeUnlocked();
  // the run is won: the toasts show but are not said; the end screen's line says the names
  live.textContent = '';
  run.phase = 'win';
  give = [{ type: 'stake', id: 'uhoh', name: 'Nightfall Stake' }];
  UI.updateRecords();
  await tick(40);
  assert.equal(live.textContent, '', 'nothing said ahead of the result (it said "Unlocked: Nightfall Stake" before the score)');
  assert.deepEqual([...UI.takeUnlocked()], ['Nightfall Stake'], 'the end screen gets the name to say');
  assert.ok(kids.some((k) => /Nightfall Stake\./.test(k.innerHTML)), 'the toast still shows');
  // a new run starts with nothing left over for its end screen
  give = [{ type: 'deck', id: 'c', name: 'Gift-Wrapped Deck' }];
  run.phase = 'play';
  UI.updateRecords();
  UI.newRun({ show: false });
  assert.deepEqual([...UI.takeUnlocked()], [], 'an abandoned run\'s unlocks were said when they came and are not said again');
  E.applyRunToRecords = real;
});

test('Q5: on a fanned hand the chosen card\'s Seal hangs at the art\'s height on its strip, under the Move pair', () => {
  const css = read('src/styles/40-table.css');
  assert.match(css, /\.hand\.is-fanned \.card\[aria-pressed="true"\]:not\(:last-child\):not\(\.is-dragging\) \.seal-badge \{ top: calc\(var\(--sy\) \* var\(--px\)\); \}/, 'a chosen covered card\'s badge at the art\'s own height (it rose 12 art px over the card\'s top edge)');
  assert.match(css, /\.hand\.is-fanned \.card \.seal-badge \{ transition: top var\(--t-lift\) var\(--spring\); \}/, 'gliding with the lift');
  // the geometry on a phone held upright, art px: the pair's foot stands G over a resting card's top edge (the hand
  // zone's top padding plus the pair's margin, 1, as the hand rests on that padding there); a chosen card rises L; its
  // badge's top then stands L - sy (sy = -4) over the resting edge. (A landscape phone's hand rests lower in a taller
  // row, beside its button column: tests/e2e/repair.mjs measures it.)
  const block = (q) => { const at = css.indexOf(`@media ${q} {`); assert.ok(at >= 0, q); let i = css.indexOf('{', at) + 1, d = 1; const s = i; for (; d; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; } return css.slice(s, i - 1); };
  const num = (re, s) => { const m = re.exec(s); return m ? Number(m[1]) : null; };
  const LIFT = /\.hand \.card\[aria-pressed="true"\] \.lift \{ transform: translateY\(calc\(-(\d+) \* var\(--px\)\)\); \}/;
  const phone = block('(max-width: 1023px)'), tallish = block('(max-width: 1023px) and (max-height: 820px)'), short = block('(max-width: 599px) and (max-height: 760px)');
  const sy = -4;
  const cases = [
    ['a phone (390 x 844)', num(/\.handzone \{ padding: calc\((\d+) \* var\(--px\)\)/, phone), num(LIFT, phone)],
    ['a phone 820 px tall or less (390 x 780)', num(/\.handzone \{ padding-top: calc\((\d+) \* var\(--px\)\); \}/, tallish), num(LIFT, phone)],
    ['a short phone (360 x 640, 375 x 667)', num(/\.handzone \{ padding-top: calc\((\d+) \* var\(--px\)\); \}/, short), num(LIFT, short)],
  ];
  assert.equal(cases[2][2], 10, 'a short upright phone lifts a chosen card 10 art px (its stage is 36 px tall at 360 x 640: no room to lift the pair; 14 left the badge 4 art px under it)');
  for (const [where, pad, lift] of cases) assert.ok(pad + 1 >= lift - sy, `${where}: the chosen card's Seal (its top ${lift - sy} art px over the resting edge) stays under the pair's foot (${pad + 1})`);
  // every Seal hangs at the same spot of the art (TW.Art.meta(seal).at)
  const { TW } = load();
  for (const id of TW.Art.ids('seal:')) assert.equal(TW.Art.meta(id).at[1], sy, `${id} hangs 4 art px over the card's top edge`);
});

test('Q6: the compact Joker rack, a scroller, keeps room for the whole focus ring on its top and sides', () => {
  const css = read('src/styles/40-table.css');
  const m = /@media \(max-width: 1023px\) \{[\s\S]*?\n {2}\.rack\.r-jokers \.rack-in \{ ([^}]*) \}/.exec(css);
  assert.ok(m, 'the compact rack rule');
  const rule = m[1];
  assert.match(rule, /overflow-x: auto/, 'it scrolls (so it clips)');
  assert.match(rule, /padding: 6px 6px calc\(5 \* var\(--px\)\); margin: -6px -6px calc\(-5 \* var\(--px\)\);/, '6 px of room on the top and both sides, given back by a negative margin (the ring reaches 5 px out)');
  assert.match(rule, /scroll-padding-inline: 6px/, 'and the snap keeps the first Joker clear of the edge');
  // the ring it makes room for: a 2 px outline 3 px out, the dark band filling the gap
  assert.match(read('src/styles/10-tokens.css'), /:focus-visible \{ outline: 2px solid var\(--money-hi\); outline-offset: var\(--ring-gap, 3px\);/);
});

test('Q8: an empty Joker rack is no Tab stop; one with Jokers needs no tabindex', () => {
  const app = fakeEl('div', { id: 'app' });
  const { TW } = load('?test=1&seed=REPAIRQ8', { find: (sel) => (sel === '#app' ? app : null) });
  const UI = TW.UI;
  // the fake DOM has no canvas: a picture stands in for the column's drawn numbers
  UI.paint.Px.prototype.url = function () { return `data:image/png;base64,${this.w}x${this.h}`; };
  const run = UI.newRun({ show: false });
  UI.shell.ensure();
  const racks = UI.shell.el().racks;
  assert.match(racks.innerHTML, /<div class="rack-in" id="jokerRack" tabindex="-1">/, 'no Joker: kept out of the Tab order (it was an unnamed stop at 720 x 450)');
  TW.Engine.addJoker(run, TW.Content.JOKERS.find((j) => j.rarity === 'common').id);
  UI.shell.renderRacks();
  assert.match(racks.innerHTML, /<div class="rack-in" id="jokerRack">/, 'with a Joker, Tab reaches the Jokers themselves');
  assert.match(racks.innerHTML, /aria-label="Jokers, 1 of 5"/, 'the section names the rack');
});
