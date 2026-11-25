// Unit tests for the UI fix pass of 2026-11-24 (src/ui/*.js with the real content, art and engine in a vm with a
// minimal fake DOM; the browser half of these checks is tests/e2e/fixes.mjs):
//   - Colour-coded suits: cardSpriteId asks TW.Art for 'card4:' faces when the setting is on, the warm order puts
//     them first, and Options offers the switch;
//   - the shared card helpers: Seal badges at TW.Art.meta's spot, the Edition light (on a card Sheen and Dither
//     masked to its bare stock, on a Joker Sheen by its face; Phantom with no see-through ghost), name plates that
//     never clip;
//   - selection: five cards can always be chosen (a Boss Blind's play limit limits plays, not discards);
//   - effect sentences name what changed (cards, Jokers, Planet cards, ranks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const plain = (v) => JSON.parse(JSON.stringify(v));
const ART = readdirSync(new URL('src/art/', root)).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/art/' + f);
const UI_FILES = readdirSync(new URL('src/ui/', root)).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/ui/' + f);

function fakeEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), className: '', textContent: '', innerHTML: '', children: [], dataset: {}, hidden: false,
    style: { setProperty() {}, removeProperty() {}, cssText: '' },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, append() {}, prepend() {}, appendChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getContext() { return null; }, getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    insertAdjacentHTML() {}, replaceChildren() {}, animate() { return null; }, focus() {}, closest() { return null; }, matches() { return false; },
  };
}
function load(search = '?test=1&seed=FIXUNIT') {
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
  // the fake DOM has no canvas: hand out a stand-in picture so the helpers that need one draw their markup
  ctx.TW.Art.url = (id) => (ctx.TW.Art.has(id) ? 'data:image/png;base64,AAAA' : null);
  return { TW: ctx.TW, storage };
}

test('Colour-coded suits: cardSpriteId asks for card4: faces while the setting is on, card: faces while it is off', () => {
  const { TW } = load();
  const UI = TW.UI;
  assert.equal(UI.settings().fourColor, false, 'off by default (SPEC 6.6)');
  assert.ok(UI.cardSpriteId({ rank: 12, suit: 'D' }).startsWith('card:12D'));
  UI.setSetting('fourColor', true);
  assert.equal(UI.cardSpriteId({ rank: 12, suit: 'D' }), 'card4:12D|||');
  const Cn = TW.Content;
  const c = { rank: 7, suit: 'C', enhancement: Cn.ENHANCEMENTS[0].id, seal: Cn.SEALS[1].id, edition: Cn.EDITIONS[1].id };
  const id = UI.cardSpriteId(c);
  assert.equal(id, `card4:7C|${c.enhancement}|${c.seal}|${c.edition}`);
  assert.ok(TW.Art.has(id), 'TW.Art registered the composed four-colour face');
  UI.setSetting('fourColor', false);
  assert.ok(UI.cardSpriteId(c).startsWith('card:7C|'), 'and back to the two-colour faces');
});

test('Colour-coded suits: the warm order puts the faces in use first, card4: next to card:', () => {
  const { TW } = load();
  const UI = TW.UI;
  let o = plain(UI.warmOrder());
  assert.deepEqual(o.slice(0, 3), ['card:', 'card4:', 'back:']);
  UI.setSetting('fourColor', true);
  o = plain(UI.warmOrder());
  assert.deepEqual(o.slice(0, 3), ['card4:', 'card:', 'back:']);
});

test('Colour-coded suits: Options offers the switch with its label and help text', () => {
  const src = read('src/ui/30-screens.js');
  assert.match(src, /optRow\('Colour-coded suits', null, switchCtl\('toggle-four-color'\), 'opSuitsHint'\)/);
  assert.match(src, /A\('toggle-four-color'/);
  assert.match(src, /UI\.setSetting\('fourColor', on\)/);
  // the label must not sound like an Edition (SPEC 6.6)
  const { TW } = load();
  for (const e of TW.Content.EDITIONS) assert.ok(!/Colour-coded suits/i.test(e.name));
});

test('Seal badges sit at TW.Art.meta(seal).at, the spot the art gives each Seal', () => {
  const { TW } = load();
  for (const s of TW.Content.SEALS) {
    const m = TW.Art.meta('seal:' + s.id);
    const h = TW.UI.sealBadgeHTML(s.id);
    assert.ok(h.includes(`--sx:${m.at[0]};--sy:${m.at[1]}`), `${s.id} at its meta spot`);
    assert.ok(h.includes(`--w:${m.w};--h:${m.h}`), `${s.id} at its own size`);
  }
  assert.equal(TW.UI.sealBadgeHTML(null), '');
});

test('Edition light: Sheen is masked, Glitch slips two slices, Phantom wears no see-through ghost', () => {
  const { TW } = load();
  const UI = TW.UI;
  const face = UI.cardSpriteId({ rank: 9, suit: 'S', edition: 'gloss' });
  assert.match(UI.edFxHTML('gloss', face), /--ed-mask:url\('data:image\/png;base64,AAAA'\)/);
  assert.equal((UI.edFxHTML('fourcolor', face).match(/class="spr slice/g) || []).length, 2);
  const ph = UI.edFxHTML('inverted', face);
  assert.ok(!/ghost/.test(ph), 'no afterimage layer: the Phantom card is opaque, its flicker is CSS');
  assert.equal(UI.edFxHTML(null, face), '');
  const css = read('src/styles/40-table.css');
  assert.match(css, /@keyframes ed-phantom /, 'the flicker');
  assert.match(css, /drop-shadow\(0 0 var\(--px\) #AED8F0B0\)/, 'the ghost-blue glow');
  assert.ok(!/\.ed-inverted \.ed-fx \.ghost/.test(css), 'the see-through afterimage is gone');
  assert.match(css, /ed-sheen 3\.2s/, 'the stepped Sheen sweep');
  assert.ok(!/ed-gloss[^}]*(170, 200, 255|200, 220, 255)/.test(css), 'never pale blue');
  const tokens = read('src/styles/10-tokens.css');
  assert.match(tokens, /\.reduce-motion \.emblem \.bloom/, 'reduced motion stops the Boss emblem bloom');
  assert.match(tokens, /\.reduce-motion \[class\*="ed-"\] \.ed-fx::before/, 'and the Edition sweeps on pseudo-elements');
});

// Added in the final pass (2026-11-24): measured on the running game, the face's own luminance let about a third of
// Sheen's sweep onto red pips and the index (they gained ~21 levels inside the band, the cream stock ~2), and the
// mask was scaled smooth, so the pips' pixel edges went soft under the band. The Dither hum covered the face too and
// stopped half an art pixel along.
test("Edition light: a card's Sheen sweep and Dither hum are masked to its bare stock, crisp; a Joker's Sheen by its face", () => {
  const { TW } = load();
  const UI = TW.UI, A = TW.Art;
  A.url = (id) => (A.has(id) ? 'data:image/png;base64,' + encodeURIComponent(id) : null);
  const at = (id) => `--ed-mask:url('data:image/png;base64,${encodeURIComponent(id)}')`;
  const gloss = UI.cardSpriteId({ rank: 10, suit: 'H', edition: 'gloss' });
  assert.equal(A.stockMask(gloss), 'mask:' + gloss);
  assert.ok(UI.edFxHTML('gloss', gloss).includes(at('mask:' + gloss)), 'Sheen on a card: the bare-stock mask, not the face');
  const benday = UI.cardSpriteId({ rank: 9, suit: 'C', enhancement: 'inked', seal: 'paid', edition: 'benday' });
  assert.ok(UI.edFxHTML('benday', benday).includes(at('mask:' + benday)), 'Dither on a card: the same mask');
  UI.setSetting('fourColor', true);
  const four = UI.cardSpriteId({ rank: 8, suit: 'D', edition: 'gloss' });
  assert.ok(four.startsWith('card4:') && UI.edFxHTML('gloss', four).includes(at('mask:' + four)), 'colour-coded suits: the mask of the four-colour face');
  UI.setSetting('fourColor', false);
  const jk = 'joker:' + TW.Content.JOKERS[0].id;
  assert.ok(UI.edFxHTML('gloss', jk).includes(at(jk)), 'Sheen on a Joker: its face');
  assert.ok(!/--ed-mask/.test(UI.edFxHTML('benday', jk)), 'Dither on a Joker: no mask');
  const css = read('src/styles/40-table.css');
  assert.match(css, /\.ed-gloss \.ed-fx, \.ed-benday \.ed-fx \{[^}]*mask-image: var\(--ed-mask, none\)[^}]*image-rendering: pixelated/, 'the masks scale in whole pixels');
  assert.match(css, /animation: ed-dither 2\.4s steps\(4, jump-none\)/, 'the hum moves 0, 1, 2 and 3 art px, never half a pixel');
});

test('name plates: one span, never a clip class; a long name gives a word, a tighter word or a word with a full stop', () => {
  const { TW } = load();
  const UI = TW.UI;
  for (const r of [].concat(TW.Content.JOKERS, TW.Content.TAROTS, TW.Content.VOUCHERS)) {
    const h = UI.plateHTML(r.name);
    // final pass, part 3: the plate keeps the full name (data-full), so a breakpoint can set it again in place
    const m = /^<span class="plate( pl-tight)?" aria-hidden="true" data-full="([^"]*)">([^<]*)<\/span>$/.exec(h);
    assert.ok(m, `${r.name}: ${h}`);
    assert.equal(m[2], UI.esc(r.name), `${r.name}: the plate keeps the full name`);
    const text = m[3].replace(/&amp;/g, '&').replace(/&#39;/g, "'");
    const words = r.name.split(/[\s-]+/);
    assert.ok(text === r.name || words.includes(text) || r.name.includes(text) || (/\.$/.test(text) && r.name.includes(text.slice(0, -1))), `${r.name} -> ${text}`);
  }
});

test('selection: five cards can always be chosen; a Boss Blind\'s play limit limits plays, not discards', () => {
  const { TW } = load('?test=1&seed=SQUEEZE1');
  const UI = TW.UI, E = TW.Engine;
  const run = UI.newRun({ show: false });
  assert.equal(UI.call('startBlind').ok, true);
  run.blind.boss = 'squeeze';
  run.blind.kind = 'boss';
  const hand = run.blind.hand.slice(0, 6);
  UI.table.select(hand);
  const sel = plain(UI.table.selected());
  assert.equal(sel.length, 5, 'five chosen, never more');
  assert.equal(E.canPlay(run, sel).ok, false, 'five cannot be played under the play limit');
  assert.match(E.canPlay(run, sel).error, /4/);
  assert.equal(E.canDiscard(run, sel).ok, true, 'but they can be discarded');
  const src = read('src/ui/10-table.js');
  assert.ok(!/b && b\.maxPlay \? b\.maxPlay/.test(src), 'the selection cap no longer reads maxPlay');
});

test('effect sentences name what changed: cards, Jokers, Planet cards, copies and ranks', () => {
  const { TW } = load('?test=1&seed=EFFECTS1');
  const UI = TW.UI, Cn = TW.Content;
  const run = UI.newRun({ show: false });
  const tarot = (f) => Cn.TAROTS.find(f), spectral = (f) => Cn.SPECTRALS.find(f);
  const destroy = tarot((t) => t.destroy && t.moneyEach);
  let s = UI.table.describeEffect({ name: destroy.name }, { kind: 'tarot', id: destroy.id, uids: ['c3', 'c4'], destroyed: ['c3', 'c4'], money: 2 });
  assert.match(s, /2 cards destroyed\./, s);
  const up = tarot((t) => t.rankDelta > 0), down = tarot((t) => t.rankDelta < 0);
  assert.match(UI.table.describeEffect({ name: up.name }, { kind: 'tarot', id: up.id, uids: ['c1', 'c2'] }), /2 cards ranked up\./);
  assert.match(UI.table.describeEffect({ name: down.name }, { kind: 'tarot', id: down.id, uids: ['c1'] }), /1 card ranked down\./);
  const copy = tarot((t) => t.copies === 1);
  assert.match(UI.table.describeEffect({ name: copy.name }, { kind: 'tarot', id: copy.id, uids: ['c1'], sourceUid: 'c1', created: ['c90'] }), /1 copy added to your deck\./);
  const killer = spectral((x) => x.destroyJoker && x.jokerEdition);
  s = UI.table.describeEffect({ name: killer.name }, { kind: 'spectral', id: killer.id, destroyed: ['h7'], jokerUid: 'h3', edition: 'fourcolor' });
  assert.match(s, /1 Joker destroyed\./, s);
  assert.ok(!/\b1 destroyed/.test(s), 'never a bare number');
  const planetMaker = tarot((t) => t.createPlanet);
  run.consumables.push({ uid: 'k99', kind: 'planet', id: Cn.PLANETS[0].id });
  s = UI.table.describeEffect({ name: planetMaker.name }, { kind: 'tarot', id: planetMaker.id, created: ['k99'] });
  assert.match(s, /a Planet card created\./, s);
});

test('the compact layout and the pixel size have their own queries, kept in step with the tokens', () => {
  const core = read('src/ui/00-core.js');
  assert.match(core, /phone: mq\('\(max-width: 1023px\)'\)/);
  assert.match(core, /px2: mq\('\(max-width: 1023px\), \(max-height: 869px\)'\)/);
  const tokens = read('src/styles/10-tokens.css');
  assert.match(tokens, /@media \(max-width: 1023px\), \(max-height: 869px\) \{\s*:root \{ --px: 2px;/);
  for (const f of ['src/styles/20-chrome.css', 'src/styles/40-table.css', 'src/styles/50-shop.css']) {
    assert.ok(!/@media \(max-width: 760px\)/.test(read(f)), `${f}: the compact layout starts below 1024 px (SPEC 6.7)`);
  }
});

test('sheets read before they act: focus lands on the title; the cash-out re-places itself on resize', () => {
  const core = read('src/ui/00-core.js');
  assert.match(core, /h2', \{ class: 's-name', id, text: o\.title \|\| '', tabindex: '-1' \}/);
  assert.match(core, /focusIn\(handle, o\.focus \|\| '\.s-name'\)/);
  const table = read('src/ui/10-table.js');
  assert.match(table, /h\.place = place;/, 'the cash-out keeps a place() for resizes');
  assert.match(table, /h\.reanchor\(jokerEl\(uid\)\)/, 'a moved Joker keeps its sheet');
  const shop = read('src/ui/20-shop.js');
  assert.match(shop, /box\.dataset\.sig = shopSig\(run\)/, 'every Shop render stamps what it drew');
});
