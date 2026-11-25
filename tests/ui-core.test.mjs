// Unit tests for the UI foundation and the table (src/ui/00-core.js, 05-room.js, 10-table.js) plus the shell
// and the stylesheets this workflow owns. The scripts run in a vm with a minimal fake DOM: boot never runs (the
// document stays 'loading'), so this checks the public API, the pure helpers, the router's registry, the
// payout timeline, settings and storage, and a set of source rules (no rAF loops, no Math.random, no item
// names, no em dashes, no network URLs, and the cash-out button's own word: Collect, never the label of the
// originality list, which is local-only, so that one check skips without it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { needsOriginality, pattern } from './local-data.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
// values made inside the vm have the vm's prototypes: compare them as plain JSON
const plain = (v) => JSON.parse(JSON.stringify(v));
const UI_FILES = ['src/ui/00-core.js', 'src/ui/05-room.js', 'src/ui/10-table.js'];
const STYLE_FILES = ['src/styles/00-fonts.css', 'src/styles/10-tokens.css', 'src/styles/20-chrome.css', 'src/styles/30-room.css', 'src/styles/40-table.css'];

function fakeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(), className: '', textContent: '', innerHTML: '', children: [], dataset: {}, hidden: false,
    style: { setProperty() {}, removeProperty() {}, cssText: '' },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, append() {}, prepend() {}, appendChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getContext() { return null; }, getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    insertAdjacentHTML() {}, replaceChildren() {}, animate() { return null; }, focus() {}, closest() { return null; }, matches() { return false; },
  };
  return el;
}
function load(search = '?test=1&seed=UNITSEED') {
  const storage = new Map();
  const html = fakeEl('html');
  const doc = {
    readyState: 'loading', documentElement: html, body: fakeEl('body'),
    createElement: (t) => fakeEl(t), addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, getAnimations() { return []; },
    fonts: { load: async () => [], ready: Promise.resolve(), check: () => false }, activeElement: null,
  };
  const ctx = {
    console, setTimeout, clearTimeout, performance, Promise, URLSearchParams, Map, Set, WeakMap, Math, JSON, Date, Number, String, Array, Object, Symbol, Error,
    location: { search },
    document: doc,
    navigator: {},
    innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) },
    CSS: { supports: () => true },
    addEventListener() {}, removeEventListener() {},
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['src/content.js', 'src/engine.js', ...UI_FILES]) vm.runInContext(read(f), ctx, { filename: f });
  return { TW: ctx.TW, storage, ctx };
}

test('TW.UI exposes the shared API other screens build on', () => {
  const { TW } = load();
  const UI = TW.UI;
  for (const fn of ['register', 'show', 'refresh', 'update', 'screen', 'screenForPhase', 'act', 'call', 'q', 'dur', 'anim', 'punch', 'flare',
    'sprite', 'spriteHTML', 'cardSpriteId', 'iconHTML', 'num', 'numHTML', 'numSprite', 'fitSize', 'dialog', 'sheet', 'closeDialog', 'toast',
    'announce', 'error', 'sfx', 'registerTip', 'tipHTML', 'registerOverlay', 'openOverlay', 'registerAction', 'newRun', 'continueRun', 'saveRun',
    'updateRecords', 'setSetting', 'settings', 'richText', 'fmt', 'fmtMult', 'rng', 'hasScreen', 'screens', 'setBusy', 'clearBusy', 'isBusy']) {
    assert.equal(typeof UI[fn], 'function', `TW.UI.${fn}`);
  }
  assert.equal(typeof UI.Timeline, 'function');
  assert.ok(UI.EASE && /linear\(/.test(UI.EASE.spring), 'springs are sampled into linear() curves');
  assert.equal(typeof UI.shell.ensure, 'function', 'the table installs the shell');
  assert.equal(typeof UI.room.build, 'function', 'the room is installed');
  for (const fn of ['selected', 'select', 'playHand', 'discard', 'sortBy', 'openJoker', 'openConsumable', 'describeEffect', 'describeGain', 'cardLabel']) {
    assert.equal(typeof UI.table[fn], 'function', `TW.UI.table.${fn}`);
  }
});

test('every phase has a screen: the table owns three, the stubs stand in for the rest', () => {
  const { TW } = load();
  const UI = TW.UI;
  const want = { 'blind-select': 'blind-select', play: 'play', cashout: 'cashout', shop: 'shop', pack: 'pack', win: 'win', gameover: 'gameover' };
  for (const [phase, screen] of Object.entries(want)) {
    assert.equal(UI.screenForPhase(phase), screen);
    assert.ok(UI.hasScreen(screen), `a screen is registered for ${screen}`);
  }
  assert.equal(UI.screenForPhase('nonsense'), 'title');
  assert.ok(UI.hasScreen('title'));
  for (const o of ['options', 'run-info', 'pause']) assert.ok(UI.hasOverlay(o), `stub overlay ${o}`);
  // register() replaces a screen, so later files override the stubs
  const def = { mount() {} };
  UI.register('shop', def);
  assert.ok(UI.hasScreen('shop'));
});

test('numbers: thousands separators, short exponents, Mult with at most two decimals', () => {
  const { TW } = load();
  const { fmt, fmtMult } = TW.UI;
  assert.equal(fmt(0), '0');
  assert.equal(fmt(1184), '1,184');
  assert.equal(fmt(355.9), '355');
  assert.equal(fmt(1234567), '1,234,567');
  assert.equal(fmt(1.5e13), '1.50e13');
  assert.equal(fmtMult(12), '12');
  assert.equal(fmtMult(1.5), '1.5');
  assert.equal(fmtMult(26.4), '26.4');
  assert.equal(fmtMult(1.25), '1.25');
  assert.equal(fmtMult(1234.5), '1,234.5');
});

test('content text gets coloured keywords and stays escaped', () => {
  const { TW } = load();
  const h = TW.UI.richText('+15 Chips and +3 Mult. ×1.5 Mult. Earn $4. <b>');
  assert.match(h, /<span class="k-chips">\+15 Chips<\/span>/);
  assert.match(h, /<span class="k-mult">\+3 Mult<\/span>/);
  assert.match(h, /<span class="k-xmult">×1\.5 Mult<\/span>/);
  assert.match(h, /<span class="k-money">\$4<\/span>/);
  assert.match(h, /&lt;b&gt;/);
});

test('the digit face measures its strings and fits the largest face that fits', () => {
  const { TW } = load();
  const UI = TW.UI;
  // S glyphs are 5 wide with a 1-px gap, plus a 1-px rim each side
  assert.equal(UI.numWidth('12', 'S'), 5 + 1 + 5 + 2);
  assert.equal(UI.numWidth('8', 'XL'), 14 + 2);
  assert.equal(UI.numWidth('8', 'XXL'), 28 + 2);
  assert.equal(UI.fitSize('64', 3 * 100, ['XXL', 'XL', 'L']), 'XXL');
  assert.equal(UI.fitSize('1,234,567', 3 * 60, ['XXL', 'XL', 'L', 'S']), 'S');
});

test('test mode zeroes every duration and the timeline keeps step order', async () => {
  const { TW } = load('?test=1');
  const UI = TW.UI;
  assert.equal(UI.dur(1000), 0);
  assert.equal(UI.TEST, true);
  const seen = [];
  const tl = new UI.Timeline();
  tl.at(500, () => seen.push('c'));
  tl.at(100, () => { seen.push('a'); tl.after(10, () => seen.push('a2')); });
  tl.at(100, () => seen.push('b'));
  await tl.run();
  // every step is at t = 0 in test mode, yet they still run in their base-time order
  assert.deepEqual(seen, ['a', 'b', 'a2', 'c']);
});

test('the timeline runs at game speed and can hold and release (the scripted stills)', async () => {
  const { TW } = load('?speed=10');
  const UI = TW.UI;
  assert.equal(UI.GAME_SPEED, 10);
  assert.equal(UI.dur(1000), 100);
  const seen = [];
  const tl = new UI.Timeline();
  tl.at(100, () => seen.push(1));
  tl.at(300, () => { seen.push(2); });
  tl.at(600, () => seen.push(3));
  const done = tl.run();
  await new Promise((r) => setTimeout(r, 35));
  tl.pause();
  const held = seen.slice();
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(seen, held, 'nothing fires while held');
  tl.resume();
  await done;
  assert.deepEqual(seen, [1, 2, 3]);
});

test('settings: SPEC 6.6 speeds and defaults, stored under ember:settings (test: prefix in test mode)', () => {
  const { TW, storage } = load('?test=1');
  const UI = TW.UI;
  assert.deepEqual(plain(UI.SPEEDS.map((s) => s.div)), [1, 1.6, 2.6, 4.5]);
  // keys: the one-key shortcuts (SPEC 6.4), on by default; Options switches them off (WCAG 2.1.4, final pass A4)
  assert.deepEqual(plain(UI.settings()), { speed: 2, sfx: 60, music: 40, shake: true, motion: 'auto', fourColor: false, muted: false, keys: true });
  UI.setSetting('speed', 3);
  UI.setSetting('motion', 'reduced');
  UI.setSetting('sfx', 250);
  const s = UI.settings();
  assert.equal(s.speed, 3);
  assert.equal(s.motion, 'reduced');
  assert.equal(s.sfx, 100, 'volumes clamp to 0-100');
  assert.ok(storage.has('test:ember:settings'));
  assert.equal(UI.reduced(), true);
  UI.setSetting('speed', 99);
  assert.equal(UI.settings().speed, 3, 'an unknown speed is ignored');
});

test('sound and music: every sound asked for is logged (also in test mode), music follows the screen, mute is a setting', () => {
  const { TW, storage } = load('?test=1');
  const UI = TW.UI;
  const t0 = Date.now();
  UI.sfx('chip', { index: 3 });
  UI.sfx('total', { intensity: 0.8 });
  const log = UI.sfxLog(t0);
  assert.deepEqual(plain(log.map((e) => e.name)), ['chip', 'total']);
  assert.equal(log[0].index, 3);
  assert.ok(UI.sfxAge('chip') < 1000 && UI.sfxAge('lose') === Infinity);
  // the table loop on the menus and at the table, the Shop loop in the Shop and a pack, silence at Game Over
  for (const s of ['title', 'setup', 'blind-select', 'play', 'cashout', 'records', 'collection', 'win']) assert.equal(UI.musicFor(s), 'table', s);
  for (const s of ['shop', 'pack']) assert.equal(UI.musicFor(s), 'shop', s);
  assert.equal(UI.musicFor('gameover'), null);
  assert.equal(UI.musicWanted(), null, 'test mode plays no music');
  assert.equal(UI.settings().muted, false);
  UI.setSetting('muted', true);
  assert.equal(UI.settings().muted, true);
  assert.equal(JSON.parse(storage.get('test:ember:settings')).muted, true, 'mute is kept with the other settings');
  UI.setSetting('muted', 'yes');
  assert.equal(UI.settings().muted, true, 'only a boolean changes it');
});

test('layout work: a readout box is measured once per viewport; a beat after layout runs at once in test mode', () => {
  const { TW } = load('?test=1');
  const UI = TW.UI;
  let reads = 0;
  const box = { id: 'scoreBox', get clientWidth() { reads++; return 300; } };
  assert.equal(UI.boxWidth(box, 'score'), 300);
  assert.equal(UI.boxWidth(box, 'score'), 300);
  assert.equal(reads, 1, 'the second redraw reads no layout');
  let zero = 0;
  const hidden = { get clientWidth() { zero++; return 0; } };
  UI.boxWidth(hidden, 'hidden'); UI.boxWidth(hidden, 'hidden');
  assert.equal(zero, 2, 'a box not laid out yet is not kept');
  let ran = false;
  UI.afterLayout({ isConnected: true }, () => { ran = true; });
  assert.equal(ran, true);
  // idle sprite drawing is off in test mode (nothing to wait for)
  UI.warm(['card:14H']);
  assert.deepEqual(plain(UI.warmed()), { done: 0, left: 0 });
});

test('the engine wrapper saves the run and turns failures into a toast, never a throw', () => {
  const { TW, storage } = load('?test=1&seed=WRAPTEST');
  const UI = TW.UI;
  const run = UI.newRun({ show: false });
  assert.ok(run && run.phase === 'blind-select');
  assert.equal(run.seed, 'WRAPTEST', '?seed= seeds new runs');
  assert.ok(storage.has('test:ember:run'));
  const bad = UI.call('playHand', ['nope']);
  assert.equal(bad.ok, false);
  assert.equal(typeof bad.error, 'string');
  const ok = UI.call('startBlind');
  assert.equal(ok.ok, true);
  assert.equal(UI.run().phase, 'play');
  assert.equal(JSON.parse(storage.get('test:ember:run')).phase, 'play', 'saved after the action');
  assert.ok(storage.has('test:ember:records'));
});

test('names and effect sentences come from TW.Content at run time', () => {
  const { TW } = load();
  const UI = TW.UI, Cn = TW.Content;
  const j = Cn.JOKERS[0];
  assert.equal(UI.C.joker(j.id).name, j.name);
  const pair = Cn.HANDS.find((h) => h.id === 'pair');
  const msg = UI.table.describeEffect({ name: 'X' }, { handId: 'pair', level: 3 });
  assert.ok(msg.includes(pair.name) && msg.includes('level 3'), msg);
  const tag = Cn.TAGS[0];
  assert.ok(UI.table.describeGain({ id: tag.id, name: tag.name, text: tag.text }, { money: 6 }).startsWith(tag.name));
  const card = { uid: 'c1', rank: 12, suit: 'H', enhancement: Cn.ENHANCEMENTS[0].id, edition: null, seal: Cn.SEALS[0].id };
  const label = UI.table.cardLabel(card);
  assert.ok(label.startsWith('Queen of Hearts'), label);
  assert.ok(label.includes(Cn.ENHANCEMENTS[0].name) && label.includes(Cn.SEALS[0].name), label);
  assert.equal(UI.table.cardLabel(card, true), 'Hidden card, Hearts');
});

test('source rules: one animation engine, no dice, no item names, our own wording', () => {
  const { TW } = load();
  const src = UI_FILES.map((f) => [f, read(f)]);
  const names = [];
  for (const t of ['JOKERS', 'BOSSES', 'TAGS', 'TAROTS', 'PLANETS', 'SPECTRALS', 'VOUCHERS', 'DECKS', 'STAKES']) for (const r of TW.Content[t]) if (r.name && r.name.length > 4) names.push(r.name);
  for (const [f, s] of src) {
    assert.ok(!/requestAnimationFrame\s*\(/.test(s), `${f}: no requestAnimationFrame loops`);
    assert.ok(!/Math\.random/.test(s), `${f}: only the engine rolls dice`);
    assert.ok(!/[—–]/.test(s), `${f}: no em or en dashes`);
    for (const n of names) assert.ok(!s.includes(`'${n}'`) && !s.includes(`"${n}"`) && !s.includes(`>${n}<`), `${f}: hard-coded item name ${n}`);
  }
  const table = read('src/ui/10-table.js');
  for (const a of ['start-blind', 'skip-blind', 'play-hand', 'discard', 'sort-rank', 'sort-suit', 'use-consumable', 'sell-consumable', 'sell-joker', 'collect', 'open-run-info', 'open-options', 'open-deck']) {
    assert.ok(table.includes(`'${a}'`) || table.includes(`"${a}"`), `data-action ${a}`);
  }
  assert.ok(/data-joker-uid/.test(table) && /data-consumable-uid/.test(table), 'rack items carry their uids (SPEC 6.5)');
  assert.ok(/Collect \$/.test(table), 'the cash-out button says Collect $N');
});

test('source rules hold in every UI file and the audio: no rAF, no dice, our own wording, the e2e suites exist', () => {
  const { TW } = load();
  const files = readdirSync(new URL('src/ui/', root)).filter((f) => f.endsWith('.js')).map((f) => 'src/ui/' + f).concat(['src/audio.js']);
  const names = [];
  for (const t of ['JOKERS', 'BOSSES', 'TAGS', 'TAROTS', 'PLANETS', 'SPECTRALS', 'VOUCHERS', 'DECKS', 'STAKES']) for (const r of TW.Content[t]) if (r.name && r.name.length > 4) names.push(r.name);
  for (const f of files) {
    const s = read(f);
    assert.ok(!/requestAnimationFrame\s*\(/.test(s), `${f}: no requestAnimationFrame loops`);
    assert.ok(!/Math\.random/.test(s), `${f}: only the engine rolls dice`);
    assert.ok(!/[—–]/.test(s), `${f}: no em or en dashes`);
    assert.ok(!/https?:\/\/(?!www\.w3\.org\/)/.test(s), `${f}: nothing from the network`);
    for (const n of names) assert.ok(!s.includes(`'${n}'`) && !s.includes(`"${n}"`) && !s.includes(`>${n}<`), `${f}: hard-coded item name ${n}`);
  }
  const e2e = readdirSync(new URL('tests/e2e/', root));
  for (const f of ['table.mjs', 'shop.mjs', 'screens.mjs', 'playthrough.mjs', 'a11y.mjs', 'perf.mjs']) assert.ok(e2e.includes(f), `tests/e2e/${f}`);
});

test('source rules: the cash-out button says Collect, and no UI file or the audio says the cash-out label of the originality list', { skip: needsOriginality }, () => {
  const files = readdirSync(new URL('src/ui/', root)).filter((f) => f.endsWith('.js')).map((f) => 'src/ui/' + f).concat(['src/audio.js']);
  const label = pattern('cashOutLabel');
  // the button and every label say Collect; the help's prose follows the content plan's wording ("to cash out")
  for (const f of files) assert.ok(!label.test(read(f)), `${f}: the button says Collect, never ${label}`);
});

test('the shell and the styles: markers, title, no network, three embedded faces', () => {
  const shell = read('src/shell.html');
  assert.ok(shell.includes('<!-- @style -->') && shell.includes('<!-- @scripts -->'));
  assert.match(shell, /<title>Wickwager<\/title>/);
  assert.match(shell, /<noscript>/);
  for (const id of ['scene', 'app', 'fx', 'fxl', 'dialogs', 'toasts', 'tip', 'live']) assert.ok(shell.includes(`id="${id}"`), `layer #${id}`);
  assert.match(shell, /aria-live="polite"/);
  const css = STYLE_FILES.map(read).join('\n');
  assert.ok(!/https?:\/\/(?!www\.w3\.org\/)/.test(shell + css), 'nothing loads from the network');
  const fonts = read('src/styles/00-fonts.css');
  for (const f of ["'Jersey 10'", "'Tiny5'", "'Bricolage Grotesque'"]) assert.ok(fonts.includes(`font-family: ${f}`), f);
  assert.ok(/Open Font License/.test(fonts), 'licence lines kept');
  const styles = readdirSync(new URL('src/styles/', root)).filter((f) => f.endsWith('.css'));
  for (const f of ['00-fonts.css', '10-tokens.css', '20-chrome.css', '30-room.css', '40-table.css']) assert.ok(styles.includes(f), f);
  assert.ok(/--px: 2px/.test(read('src/styles/10-tokens.css')), 'two CSS px per art px on a phone');
});
