// Unit tests for the final pass's accessibility batch (2026-11-24): src/ui/*.js with the real content, art and engine
// in a vm with a minimal fake DOM (as tests/ui-part2.test.mjs does), plus the rules the fixes rest on in the styles.
// The browser half is tests/e2e/access.mjs.
//   A1   the column's readouts are plain text, not <output> live regions; Collect is said before the Shop is;
//   A2   the focus ring is two-tone, and a focused card or Joker comes up over its neighbours;
//   A3   a card moves one place along the hand without a drag (engine order kept, ends refused, never mid-payout);
//   A4   the one-key shortcuts are a setting (on by default) that Options switches off;
//   A5   the tip takes the pointer and Esc closes it on its own;
//   A6   a dialog body that scrolls is a stop of its own;
//   A7   closing a dialog opened from another hands focus back to its button there;
//   A8   a toast is said in the live region (once), unless its caller says it in other words;
//   A9   choosing cards says the cards and the hand they make, once the keys settle;
//   A10  the pressed segment carries a bar under its label;
//   A11  How to play's Back, the phone's deck chip and Consumables heading are named for what they show;
//   A14  Reduce motion leaves the switch knob and the Stake chips without a transition;
//   A15  the Blind and hand pills wrap instead of clipping;
//   A16  a Boss rule the layout cuts short opens its tip with the whole rule;
//   A17  a card's name says what a Boss Blind switches off; a card's tip describes it while it shows;
//   P5   nothing is focused by a screen that opens with the page;
//   and 1.4.3, found while this batch's checks ran: every pill's ink keeps 4.5:1 on its fill.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const plain = (v) => JSON.parse(JSON.stringify(v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
/** The UI in a vm, with a live region (#live) and a toast host (#toasts) the core can write into. */
function load(search = '?test=1&seed=ACCESSU1') {
  const storage = new Map();
  const live = fakeEl('div');
  const kids = [];
  const toasts = Object.assign(fakeEl('div'), {
    append(t) { kids.push(t); t.isConnected = true; t.remove = () => { const i = kids.indexOf(t); if (i >= 0) kids.splice(i, 1); t.isConnected = false; }; },
  });
  Object.defineProperty(toasts, 'children', { get: () => kids });
  Object.defineProperty(toasts, 'firstElementChild', { get: () => kids[0] });
  const doc = {
    readyState: 'loading', documentElement: fakeEl('html'), body: fakeEl('body'),
    createElement: (t) => fakeEl(t), addEventListener() {}, removeEventListener() {},
    querySelector: (s) => (s === '#live' ? live : s === '#toasts' ? toasts : null), querySelectorAll() { return []; }, getAnimations() { return []; },
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
  return { TW: ctx.TW, storage, live, toasts: kids };
}
const css = (f) => read('src/styles/' + f);
const rule = (src, sel) => { const i = src.indexOf(sel + ' {'); assert.ok(i >= 0, `a rule for ${sel}`); return src.slice(i, src.indexOf('}', i) + 1); };

test('A1: the column readouts are plain text in their labelled panels, never <output> live regions', () => {
  const table = read('src/ui/10-table.js');
  const col = table.slice(table.indexOf('function renderCol()'), table.indexOf('// ================================================================== the racks'));
  assert.ok(!/<output\b/.test(col), 'no <output> in the column (each was a polite status region that spoke every count-up step)');
  for (const id of ['score', 'chips', 'mult', 'hands', 'discards', 'money']) assert.match(col, new RegExp(`<span class="n g-[a-z]+" id="${id}"></span>`), `#${id} is a plain span`);
  assert.match(col, /<span class="sr">Chips<\/span><span class="n g-chips" id="chips">/, 'the Chips well still says what it holds');
  assert.ok(!/aria-live/.test(col), 'and nothing else in the column is live');
});

test('A1: Collect is said before the Shop says itself, so the merged line runs in order', () => {
  const table = read('src/ui/10-table.js');
  const fn = table.slice(table.indexOf('function collect(h)'), table.indexOf("UI.registerAction('collect'"));
  assert.ok(fn.indexOf('UI.announce(`Collected $') >= 0 && fn.indexOf('UI.announce(`Collected $') < fn.indexOf('UI.refresh()'), 'the Collect line comes before refresh() mounts the Shop');
});

test('A8: a toast is said in the live region; the same line asked twice in a moment is said once', async () => {
  const { TW, live } = load();
  const UI = TW.UI;
  UI.toast('Run saved. Continue it from the title screen.', 'info', 5);
  await sleep(60);
  assert.equal(live.textContent, 'Run saved. Continue it from the title screen.', 'a toast was visual only before');
  UI.error('Select 1 to 5 cards to discard.');
  await sleep(60);
  assert.equal(live.textContent, 'Select 1 to 5 cards to discard.', 'an error is said once (toast and error both asked)');
  UI.announce('Pack skipped.'); UI.announce('Pack skipped.');
  await sleep(60);
  assert.equal(live.textContent, 'Pack skipped.');
  // a caller that says the news in its own fuller words keeps the toast quiet
  UI.toast('The Tag: +$5.', 'good', { ms: 5, say: false });
  UI.announce('Blind skipped. The Tag: +$5.');
  await sleep(60);
  assert.equal(live.textContent, 'Blind skipped. The Tag: +$5.');
  assert.match(read('src/shell.html'), /id="toasts" aria-hidden="true"/, '#toasts stays hidden from assistive tech, so nothing is heard twice');
});

test('A4: the one-key shortcuts are a setting, on by default, that Options switches off', () => {
  const { TW, storage } = load();
  const UI = TW.UI;
  assert.equal(UI.settings().keys, true);
  assert.equal(UI.shortcuts(), true);
  UI.setSetting('keys', false);
  assert.equal(UI.shortcuts(), false);
  assert.equal(JSON.parse(storage.get('test:ember:settings')).keys, false, 'kept with the other settings');
  UI.setSetting('keys', 'no');
  assert.equal(UI.settings().keys, false, 'only a boolean changes it');
  const table = read('src/ui/10-table.js'), shop = read('src/ui/20-shop.js'), core = read('src/ui/00-core.js'), screens = read('src/ui/30-screens.js');
  assert.match(table, /if \(!UI\.shortcuts\(\)\) return false;\n\s+if \(\/\^\[1-9\]\$\/\.test\(k\)\)/, 'the table\'s 1 to 9, Enter, D and S wait on it');
  assert.match(shop, /if \(!UI\.shortcuts\(\)\) return false;/, 'the pack\'s number keys too');
  assert.match(core, /\(e\.key === 'i' \|\| e\.key === 'I'\) && inRun\(\) && shortcuts\(\)/, 'and I');
  assert.match(screens, /optRow\('Keyboard shortcuts', null, switchCtl\('toggle-keys'\), 'opKeysHint'\)/, 'Options has the switch, with the keys listed under it');
  assert.match(screens, /KEYS_HELP,\n\s+\], extra: table/, 'How to play lists the keys');
  // Enter on a card is the card's own key (it chose nothing and played the hand before)
  assert.match(table, /if \(k === 'Enter'\) \{ if \(t && t\.closest && t\.closest\('button, a, \[role="button"\], input, select, textarea'\)\) return false; playHand\(\); return true; \}/);
});

test('A3: a card moves one place along the hand without a drag; the engine keeps the order', () => {
  const { TW } = load('?test=1&seed=ACCESSU3');
  const UI = TW.UI;
  UI.newRun({ show: false });
  assert.equal(UI.call('startBlind').ok, true);
  const run = UI.run(), h0 = run.blind.hand.slice();
  assert.equal(UI.table.moveCard(h0[2], -1), true, 'one place left');
  assert.deepEqual(plain(run.blind.hand.slice(0, 3)), [h0[0], h0[2], h0[1]]);
  assert.equal(run.sortMode, 'manual', 'the hand keeps its manual order, as after a drag');
  assert.equal(UI.table.moveCard(run.blind.hand[0], -1), false, 'the first card goes no further left');
  assert.equal(UI.table.moveCard(run.blind.hand[run.blind.hand.length - 1], 1), false, 'the last no further right');
  UI.setBusy(true);
  assert.equal(UI.table.moveCard(run.blind.hand[3], 1), false, 'nothing moves while a payout runs');
  UI.clearBusy();
  const table = read('src/ui/10-table.js');
  assert.match(table, /if \(onCard && e\.shiftKey && \(k === 'ArrowLeft' \|\| k === 'ArrowRight'\)\) \{ moveCard\(/, 'Shift with an arrow moves the focused card');
  assert.match(table, /<div class="seg mover" id="mover" role="group" aria-label="Move the chosen card" hidden>/, 'the Move pair sits over the hand');
  assert.match(table, /const uid = b && phase\(\) === 'play' && sel\.length === 1 \? sel\[0\] : null;/, 'it shows while exactly one card is chosen');
});

test('A9: choosing cards says the cards and the hand they make, once the keys settle', async () => {
  const { TW, live } = load('?test=1&seed=ACCESSU9');
  const UI = TW.UI;
  UI.newRun({ show: false });
  UI.call('startBlind');
  const run = UI.run(), [a, b] = run.blind.hand;
  await sleep(60);
  live.textContent = '';
  UI.table.toggle(a);
  UI.table.toggle(b);
  assert.equal(live.textContent, '', 'nothing yet: the line waits for the keys to settle');
  // the line comes 260 + 30 ms after the last key: wait for it (up to 2 s) rather than a fixed 350 ms, which Windows'
  // late timers on a busy machine lost in 4 of 6 runs (final pass, part 4, final agent C; the UI was unchanged)
  const settle = async (f) => { const end = Date.now() + 2000; while (!f() && Date.now() < end) await sleep(20); };
  await settle(() => live.textContent);
  const word = (u) => { const c = UI.q('getCard', u); return `${UI.rankWord(c.rank)} of ${UI.suitName(c.suit)}`; };
  const pv = UI.q('preview', [a, b].filter((u) => UI.table.selected().includes(u)));
  assert.equal(live.textContent, `${word(a)} and ${word(b)} selected. ${pv.name}, level ${pv.level}: ${UI.fmt(pv.chips)} Chips times ${UI.fmtMult(pv.mult)} Mult.`);
  UI.table.toggle(a);
  await settle(() => /put back/.test(live.textContent));
  assert.match(live.textContent, new RegExp(`^${word(a)} put back\\. .+, level \\d+: `));
});

test('A17: a card\'s name says what The Wash-Out and The Blackout switch off', () => {
  const { TW } = load('?test=1&seed=ACCESSU7');
  const UI = TW.UI, Cn = TW.Content;
  UI.newRun({ show: false });
  UI.call('startBlind');
  const run = UI.run(), b = run.blind;
  const c = UI.q('getCard', b.hand[0]);
  c.enhancement = 'punchy'; c.edition = 'gloss'; c.seal = 'encore';
  const name = (id) => Cn.BOSSES.find((x) => x.id === id).name;
  const enh = Cn.ENHANCEMENTS.find((x) => x.id === 'punchy').name, ed = Cn.EDITIONS.find((x) => x.id === 'gloss').name, seal = Cn.SEALS.find((x) => x.id === 'encore').name;
  b.kind = 'boss'; b.boss = 'washout';
  assert.equal(UI.table.cardLabel(c, false, { washed: true, censored: false }), `${UI.rankWord(c.rank)} of ${UI.suitName(c.suit)}, ${enh}, ${ed}, ${seal}. Switched off by ${name('washout')}: ${enh}.`);
  b.boss = 'censor';
  assert.equal(UI.table.cardLabel(c, false, { washed: false, censored: true }), `${UI.rankWord(c.rank)} of ${UI.suitName(c.suit)}, ${enh}, ${ed}, ${seal}. Switched off by ${name('censor')}: ${ed} and ${seal}.`);
  assert.equal(UI.table.cardLabel(c), `${UI.rankWord(c.rank)} of ${UI.suitName(c.suit)}, ${enh}, ${ed}, ${seal}`, 'with no Boss state, the name lists its parts as before');
  const table = read('src/ui/10-table.js'), core = read('src/ui/00-core.js'), screens = read('src/ui/30-screens.js');
  assert.match(table, /aria-label="\$\{esc\(cardLabel\(c, st\.smudged, st\)\)\}"/, 'the hand card\'s name takes its state');
  assert.match(table, /\}, \{ describe: true \}\);/, 'a hand card\'s tip describes it while it shows');
  assert.match(screens, /\}, \{ describe: true \}\);/, 'and a Deck view card\'s');
  assert.match(core, /target\.setAttribute\('aria-describedby', ids\)/, 'the tip\'s lines become the target\'s description');
  assert.match(screens, /role="img" tabindex="\$\{tab\}"/, 'the Deck view\'s cards are a keyboard grid of one stop');
});

test('A2: the focus ring is two-tone, and a focused card or Joker comes up over its neighbours', () => {
  const tokens = css('10-tokens.css'), table = css('40-table.css');
  assert.match(tokens, /:focus-visible \{ outline: 2px solid var\(--money-hi\); outline-offset: var\(--ring-gap, 3px\);[^}]*box-shadow: 0 0 0 var\(--ring-gap, 3px\) var\(--edge\); \}/, 'a dark plum band inside the pale ring');
  assert.match(table, /\.card:focus-visible, \.jk:focus-visible \{ z-index: 30 !important; \}/, 'over the inline z-index each card gets');
  for (const f of ['.seed-in:focus-visible', '.range:focus-visible', '.hp-panel:focus-visible']) assert.match(rule(css('60-screens.css'), f), /--ring-gap: [^;]+; outline: 2px solid var\(--money-hi\); outline-offset: var\(--ring-gap\)/, `${f} keeps the two-tone ring`);
});

test('A5, A6, A7: the tip can be hovered and closed alone; a body that scrolls is a stop; focus returns inside a dialog', () => {
  const chrome = css('20-chrome.css'), core = read('src/ui/00-core.js');
  assert.match(rule(chrome, '.tip'), /pointer-events: auto;/, 'the tip takes the pointer (it was pointer-events: none)');
  assert.match(core, /if \(e\.key === 'Escape' && tipShowing\(\)\) \{ e\.preventDefault\(\); hideTip\(\); return; \}\n\s+const top = topDialog\(\);/, 'Esc closes a tip before anything else');
  assert.match(core, /if \(onTip\(e\.target\)\) \{ cancelTipLeave\(\); return; \}/, 'a pointer on the tip keeps it');
  assert.match(core, /if \(!t \|\| TW\.UI\.dragging \|\| placing\) return;/, 'focus the game places (a dialog opening) opens no tip, so one Esc still closes the dialog');
  assert.match(core, /body\.setAttribute\('tabindex', '0'\);\n\s+body\.setAttribute\('role', 'region'\);/, 'a dialog body that scrolls becomes a named region in the Tab order');
  assert.match(chrome, /\.dlg \.dlg-body\[tabindex="0"\]:focus-visible \{/, 'with a ring inside its edge');
  // final pass, part 3: the opener is found again when it was drawn anew (refind, R5), and focus is placed quietly, so the
  // restored card opens no tip and the next Esc opens Pause (focusQuiet, R6; tests/ui-repair.test.mjs)
  assert.match(core, /const back = refind\(h\.returnFocus, h\.returnKey, \(x\) => !h\.wrap\.contains\(x\) && \(top \? top\.el\.contains\(x\) : onPage\(x\)\)\);\n\s+if \(back && typeof back\.focus === 'function' && \(!top \|\| top\.el\.contains\(back\)\)\) focusQuiet\(back\);/, 'focus goes back to the opener inside the dialog left open (it went only when no dialog was left)');
  assert.match(read('src/ui/10-table.js'), /refocusRack\('joker', at\)/, 'a sold Joker hands focus to the one in its place');
});

test('A10, A11, A14, A15, A16: a bar on the pressed segment; names; no slide with Reduce motion; pills wrap; a cut rule opens', () => {
  const chrome = css('20-chrome.css'), tokens = css('10-tokens.css'), table = css('40-table.css');
  assert.match(rule(chrome, '.seg .btn[aria-pressed="true"]'), /text-decoration: underline/, 'A10: the pressed segment has a bar under its label');
  assert.match(read('src/ui/30-screens.js'), /btn\('Back', 'help-prev', 'b-cream', 'arrow-left', \{ 'aria-label': 'Back, previous page' \}\)/, 'A11: Back is named with the word it shows');
  assert.match(read('src/ui/10-table.js'), /\$\$\('\.deck-btn, \.deck-chip'\)\.forEach\(\(d\) => d\.setAttribute\('aria-label', `Deck, \$\{t\.replace\('\/', ' of '\)\} cards left`\)\)/, 'A11: the phone\'s deck chip says the count');
  assert.ok(!/\.rack\.r-cons \.tag \.tw \{ display: none; \}/.test(table) && /\.rack\.r-cons \.tag \.tw \{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset\(50%\);/.test(table), 'A11: the phone keeps "Consumables" for a screen reader');
  assert.match(tokens, /\.reduce-motion \.sw-knob, \.reduce-motion \.stk \{ transition: none !important; \}/, 'A14: the switch knob and the Stake chips stop sliding');
  assert.match(table, /\.w-blind \.tag, \.w-hand \.tag \{ max-width: 100%; height: auto; min-height: calc\(9 \* var\(--px\)\); line-height: \.9; white-space: normal;/, 'A15: the pills wrap instead of clipping');
  assert.match(read('src/ui/10-table.js'), /n\.classList\.add\('is-cut'\);\n\s+n\.dataset\.bossId = id;\n\s+n\.setAttribute\('tabindex', '0'\);/, 'A16: a cut Boss rule opens its tip and takes focus');
});

test('1.4.3: every pill\'s ink keeps 4.5:1 on its fill (the Chips and Mult pills sit a step deeper on their ramps)', () => {
  // found while this batch's checks ran: a Shop item's Mult Edition pill read at 3.84:1 (a11y.mjs at 1024 x 768)
  const core = read('src/ui/00-core.js'), chrome = css('20-chrome.css');
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = (h) => { const n = parseInt(h.slice(1, 7), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const ramp = (k) => JSON.parse(core.match(new RegExp(`\\n    ${k}: (\\[[^\\]]+\\])`))[1].replace(/'/g, '"'));
  const ink = (cls) => { const m = new RegExp(`\\.${cls} \\{ --tag: var\\(--f-pill-[a-z]+\\); color: (#[0-9A-Fa-f]{6})`).exec(chrome); return m && m[1]; };
  // framePill fills its middle with ramp[n - 4] of the ramp it is given
  const fill = (r) => r[r.length - 4];
  for (const [cls, key, sliced] of [['t-red', 'mult', true], ['t-blue', 'chips', true], ['t-vio', 'vio', false]]) {
    assert.match(core, new RegExp(`framePill\\(R\\.${key}${sliced ? '\\.slice\\(0, -1\\)' : ''}\\)`), `${cls} is painted from its ramp${sliced ? ', one step deeper' : ''}`);
    const r = ramp(key), f = fill(sliced ? r.slice(0, -1) : r), c = ratio(ink(cls), f);
    assert.ok(c >= 4.5, `${cls}: ${ink(cls)} on ${f} is ${c.toFixed(2)}:1`);
  }
});

test('P5: a screen that opens with the page leaves focus alone; later screens still place it', () => {
  const { TW } = load();
  assert.equal(TW.UI.lastInput(), null, 'no key or pointer yet (it started as "pointer", so focus was placed with no ring)');
  assert.match(read('src/ui/30-screens.js'), /const focusFirst = \(node\) => \{ if \(node\) later\(0, \(\) => \{ if \(UI\.lastInput\(\) != null && !UI\.topDialog\(\) && node\.isConnected\) UI\.focusQuiet\(node\); \}\); \};/);
});
