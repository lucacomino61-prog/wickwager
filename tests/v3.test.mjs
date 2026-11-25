/*
 * Kapow Poker: engine v3, independent black-box test suite.
 *
 * Written from the design alone: content/systems.json (+ content/SYSTEMS.md), the owner
 * decisions in the v3 brief, and SPEC.md v2 §4 with the v3 renames and the §4 patches in
 * systems.json "rules". src/engine.js was not read while writing this file.
 * src/content.js and src/engine.js are loaded, in that order, into one bare vm context.
 *
 * Owner decisions that override the design (tested here):
 *  - Tarot, Planet and Spectral cards picked from a Booster Pack are used at once (Tarot and
 *    Spectral cards on a hand of cards dealt from the deck while the pack is open). They are
 *    never stored in the consumable slots.
 *  - Every Joker, Legendary included, sells for half its cost rounded down (minimum $1).
 *  - The 31 v2 charms stay as Jokers under their numbers, except the four tide ones
 *    (mudskipper, moonjelly, tidemill, stormglass). The tide mechanic is gone. Since the 120-Joker
 *    table (2026-11-23 (Jokers)) they carry the ids of content/content-plan.json, each with the v2
 *    id in oldId; the tests below use the new ids. The plan kept every v2 number except one:
 *    Sleight of Hand (v2 Fishhook) frees one discard of 1 or 2 cards per Blind (content check).
 *  - (Storage prefix "ember:" is owned by the UI layer and not tested here.)
 *
 * Conventions:
 *  - Expected numbers are worked out by hand from the design tables, typed in below.
 *    Display names are never asserted from memory, because a parallel re-theme may change
 *    them: where a label embeds a name, the test reads that name from TW.Content by id.
 *  - Where the design does not pin an API down, the test uses the most natural extension of
 *    the v2 style and carries the comment "API ASSUMED". The ASSUMED table collects the
 *    names so a reconcile step can realign them in one place.
 *  - Tests set documented run fields (hand cards, run.bosses, run.tags, run.money, ...) to
 *    build exact situations, as the v2 suite does.
 *  - Objects from the vm context have foreign prototypes, so deep comparisons go through a
 *    JSON round trip (deq).
 *
 * Run from the project root: node --test "tests/*.test.mjs"
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ loading
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CONTENT_FILE = path.join(ROOT, 'src', 'content.js');
const ENGINE_FILE = path.join(ROOT, 'src', 'engine.js');
const CONTENT_SRC = fs.readFileSync(CONTENT_FILE, 'utf8');
const ENGINE_SRC = fs.readFileSync(ENGINE_FILE, 'utf8');

// prelude runs before content.js; afterContent runs after content.js and before engine.js.
function makeContext({ prelude, afterContent } = {}) {
  const ctx = vm.createContext({ console });
  if (prelude) vm.runInContext(prelude, ctx);
  vm.runInContext(CONTENT_SRC, ctx, { filename: CONTENT_FILE });
  if (afterContent) vm.runInContext(afterContent, ctx);
  vm.runInContext(ENGINE_SRC, ctx, { filename: ENGINE_FILE });
  return ctx;
}

const context = makeContext();
const TW = vm.runInContext('globalThis.TW', context);
const Engine = TW.Engine;
const Content = TW.Content;

// ------------------------------------------------------------------ API ASSUMED (realign here)
// v3 names the design leaves open, chosen as the natural extension of the v2 API.
const ASSUMED = {
  blindKinds: ['small', 'big', 'boss'], // run.blind.kind and BlindInfo.kind (the systems.json rounds ids)
  slot: { card: 'card', pack: 'pack', voucher: 'voucher' }, // shop item.slot (v2: 'card' | 'crate' | 'refit')
  packHand: 'hand', // run.pack.hand: uids dealt from the deck for Tarot/Spectral picks (owner decision)
};

// ------------------------------------------------------------------ design tables (typed in from content/systems.json)
const HAND_IDS = ['straightflush', 'four', 'fullhouse', 'flush', 'straight', 'three', 'twopair', 'pair', 'high'];
// id -> [base Chips, base Mult, +Chips per level, +Mult per level] (§2.2 patch: new per-level values)
const HANDS = {
  straightflush: [110, 8, 45, 4],
  four: [64, 6, 32, 3],
  fullhouse: [44, 4, 27, 2],
  flush: [38, 4, 18, 2],
  straight: [34, 4, 32, 3],
  three: [32, 3, 22, 2],
  twopair: [22, 2, 22, 1],
  pair: [12, 2, 16, 1],
  high: [5, 1, 12, 1],
};
const ANTE_TARGETS = [300, 700, 1700, 4000, 8500, 16000, 28000, 45000];
const BLINDS = [
  { kind: 'small', mult: 1, reward: 3, skippable: true },
  { kind: 'big', mult: 1.5, reward: 4, skippable: true },
  { kind: 'boss', mult: 2, reward: 5, skippable: false },
];
const ENHANCEMENT_IDS = ['inked', 'punchy', 'dimestore', 'popout', 'scribbled', 'spotlit', 'vintage', 'crumpled'];
const EDITION_SURCHARGE = { gloss: 2, benday: 3, fourcolor: 4, inverted: 4 };
const EDITION_IDS = Object.keys(EDITION_SURCHARGE);
const SEAL_IDS = ['encore', 'paid', 'airmail', 'cameo'];
// id -> [select, where, enhancement applied or null]
const TAROTS = {
  inkpot: [[1, 2], 'blind', 'inked'],
  boxingglove: [[1, 2], 'blind', 'punchy'],
  pricegun: [[1, 1], 'blind', 'dimestore'],
  threedglasses: [[1, 1], 'blind', 'popout'],
  crayon: [[1, 2], 'blind', 'scribbled'],
  spotlight: [[1, 2], 'blind', 'spotlit'],
  backissues: [[1, 2], 'blind', 'vintage'],
  scrunch: [[1, 3], 'blind', 'crumpled'],
  eraser: [[1, 2], 'blind', null],
  ladder: [[1, 3], 'blind', null],
  shrinkray: [[1, 3], 'blind', null],
  paintbucket: [[2, 3], 'blind', null],
  carboncopy: [[1, 1], 'blind', null],
  paperroute: [[0, 0], 'any', null],
  gueststar: [[0, 0], 'any', null],
  overtime: [[0, 0], 'blind', null],
  doover: [[0, 0], 'blind', null],
  happyaccident: [[0, 0], 'any', null],
  launchpad: [[0, 0], 'any', null],
  reprint: [[0, 0], 'any', null],
};
const TAROT_IDS = Object.keys(TAROTS);
const PLANETS = {
  blip: 'high', boing: 'pair', zipzap: 'twopair', kerplunk: 'three', zoom: 'straight',
  swoosh: 'flush', kaboom: 'fullhouse', thwack: 'four', bigbang: 'straightflush',
};
const PLANET_IDS = Object.keys(PLANETS);
const PLANET_OF = Object.fromEntries(Object.entries(PLANETS).map(([p, h]) => [h, p]));
// id -> [select, where]
const SPECTRALS = {
  curtaincall: [[1, 1], 'blind'],
  cursedcoin: [[1, 2], 'blind'],
  deadletter: [[1, 2], 'blind'],
  apparition: [[1, 2], 'blind'],
  phantomink: [[1, 1], 'blind'],
  upsidedown: [[1, 1], 'blind'],
  hauntedpress: [[0, 0], 'any'],
  midnightedition: [[0, 0], 'any'],
  wormhole: [[0, 0], 'any'],
  vanishingact: [[1, 4], 'blind'],
  ghostwriter: [[0, 0], 'any'],
  doppelganger: [[0, 0], 'any'],
  spellbound: [[1, 1], 'blind'], // decision 'wickwisp' (content-plan.json): select 1 card
  graveyardshift: [[0, 0], 'blind'],
  hallofmirrors: [[1, 1], 'blind'],
  originstory: [[0, 0], 'any'],
};
const SPECTRAL_IDS = Object.keys(SPECTRALS);
// id -> fromAnte
const BOSSES = {
  heckler: 1, lid: 3, shuffler: 1, fade: 2, tollbooth: 1, smudge: 1, squeeze: 2, washout: 2,
  wetblanket: 2, grudge: 2, censor: 3, warmup: 1, fumble: 1, shortfuse: 2, bigfinish: 8,
};
const BOSS_IDS = Object.keys(BOSSES);
const VOUCHER_IDS = [
  'musclecourse', 'speedcourse', 'springcleaning', 'extrapanel', 'skyatlas', 'savingsbond', 'spinnerrack',
  'secondlook', 'slickpaper', 'stampalbum', 'mailorderghost', 'bonuspages', 'dollaroff',
];
// id -> fromAnte
const TAGS = {
  piggybank: 1, buddy: 1, tarot: 1, fanfavorite: 1, secondwind: 1, headstart: 1,
  sale: 1, grabbag: 1, collector: 1, ghost: 2, stamp: 1, sky: 1,
};
const TAG_IDS = Object.keys(TAGS);
// id -> [kind, size, shown, picks, cost, fromAnte]
const PACKS = {
  cardnormal: ['card', 'normal', 4, 1, 4, 1],
  cardjumbo: ['card', 'jumbo', 6, 1, 6, 1],
  cardmega: ['card', 'mega', 6, 2, 9, 1],
  tarotnormal: ['tarot', 'normal', 4, 1, 4, 1],
  tarotjumbo: ['tarot', 'jumbo', 6, 1, 6, 1],
  tarotmega: ['tarot', 'mega', 6, 2, 9, 1],
  planetnormal: ['planet', 'normal', 4, 1, 4, 1],
  planetjumbo: ['planet', 'jumbo', 6, 1, 6, 1],
  planetmega: ['planet', 'mega', 6, 2, 9, 1],
  jokernormal: ['joker', 'normal', 2, 1, 6, 1],
  jokerjumbo: ['joker', 'jumbo', 3, 1, 8, 1],
  jokermega: ['joker', 'mega', 4, 2, 10, 1],
  ghostnormal: ['ghost', 'normal', 2, 1, 5, 2],
  ghostjumbo: ['ghost', 'jumbo', 3, 1, 7, 2],
  ghostmega: ['ghost', 'mega', 4, 2, 10, 2],
};
const PACK_IDS = Object.keys(PACKS);
const DECK_IDS = ['firstissue', 'speedlines', 'sketchbook', 'panorama', 'bargainbin', 'studio', 'rubberstamp', 'mintcondition', 'halftone', 'spooky'];
const STAKES = { sunny: 1, uhoh: 1.2, gulp: 1.2, yikes: 1.4 };
const STAKE_IDS = Object.keys(STAKES);
// The 27 v2 charms that stay as Jokers, under their 120-Joker ids: id -> [v2 id (oldId), rarity, cost]
// (SPEC v2 §3.4 numbers; content/content-plan.json ids).
const JOKERS = {
  jinglejester: ['anchor', 'common', 4], pipsqueak: ['gull', 'common', 4], gingerbreadfool: ['biscuit', 'common', 4], partyhorn: ['whistle', 'common', 4],
  papercrown: ['coralcrown', 'common', 4], couponclipper: ['sanddollar', 'common', 4], emptyseats: ['raft', 'common', 4], pinwheel: ['compassrose', 'common', 4],
  sleightofhand: ['fishhook', 'common', 4], doubleact: ['reefknot', 'common', 4], tallyowl: ['quill', 'common', 5], magpie: ['netmender', 'common', 5],
  sableknave: ['kraken', 'uncommon', 6], redhanded: ['lobsterpot', 'uncommon', 6], congaline: ['lighthouse', 'uncommon', 6], moneybags: ['stormpetrel', 'uncommon', 6],
  openingact: ['figurehead', 'uncommon', 6], finalbow: ['crosscurrent', 'uncommon', 7], chimneysweep: ['bilgerat', 'uncommon', 6], goldtooth: ['goldtooth', 'uncommon', 6],
  oldstager: ['soundingline', 'uncommon', 6], paperclip: ['kelpforest', 'uncommon', 6], lamplighter: ['mermaidcomb', 'uncommon', 7],
  bigtop: ['leviathan', 'rare', 8], pokerface: ['ghostship', 'rare', 8], dragontamer: ['seaserpent', 'rare', 9], fortunecookie: ['treasuremap', 'rare', 8],
};
// The five Legendary Jokers of the 120-Joker table (content/content-plan.json).
const LEGENDARY_IDS = ['candleking', 'madameecho', 'puppetmaster', 'sirmotley', 'ringmaster'];
const JOKER_IDS = Object.keys(JOKERS);
const TIDE_JOKERS = ['mudskipper', 'moonjelly', 'tidemill', 'stormglass'];

// ------------------------------------------------------------------ generic helpers
const plain = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
function deq(actual, expected, message) {
  assert.deepStrictEqual(plain(actual), plain(expected), message);
}
const sorted = (list) => plain(list).slice().sort();
function between(x, lo, hi, message) {
  assert.ok(x >= lo && x <= hi, `${message}: ${x} is not within [${lo}, ${hi}]`);
}
function pickKeys(obj, keys) {
  const o = {};
  for (const k of keys) o[k] = obj == null ? undefined : obj[k];
  return o;
}
function memo(fn) {
  let done = false;
  let value;
  return () => {
    if (!done) {
      value = fn();
      done = true;
    }
    return value;
  };
}

// Content tables may be arrays (answering by id) or id-keyed objects: read both.
function rowsOf(table) {
  if (!table) return [];
  return Array.isArray(table) ? Array.from(table) : Object.values(table);
}
const rows = (name) => rowsOf(Content[name]);
const rowById = (name, id) => rows(name).find((r) => r && (r.id === id || (r.id == null && r.kind === id))) || null;
const jokerRow = (id) => rowById('JOKERS', id);
const packRow = (id) => rowById('PACKS', id);
const handName = (id) => (rowById('HANDS', id) || {}).name;
const blindName = (index) => (rows('BLINDS')[index] || {}).name;
const jokerIdsOfRarity = (rarity) => rows('JOKERS').filter((r) => r.rarity === rarity).map((r) => r.id);

// Seeds use the randomSeed alphabet (A-Z and 2-9 without O and I).
const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function seedN(n) {
  let x = n >>> 0;
  let s = '';
  for (let i = 0; i < 8; i++) {
    s = SEED_ALPHABET[x % 32] + s;
    x = Math.floor(x / 32);
  }
  return s;
}
const SEED = 'TESTSEED';

// ------------------------------------------------------------------ result helpers
function ok(r, what = 'call') {
  assert.ok(r && typeof r === 'object', `${what}: returns a result object`);
  assert.equal(r.ok, true, `${what} failed: ${r && r.error}`);
  return plain(r);
}
function bad(r, what = 'call', error) {
  assert.ok(r && typeof r === 'object', `${what}: returns a result object`);
  assert.equal(r.ok, false, `${what} must fail`);
  assert.equal(typeof r.error, 'string', `${what}: error is a sentence`);
  assert.ok(r.error.length > 0, `${what}: error is not empty`);
  if (error instanceof RegExp) assert.match(r.error, error);
  else if (error) assert.equal(r.error, error);
  return plain(r);
}

// ------------------------------------------------------------------ run helpers
function mkRun(opts = {}) {
  const o = { seed: SEED };
  for (const [k, v] of Object.entries(opts)) if (v !== undefined) o[k] = v;
  const run = Engine.newRun(o);
  assert.ok(run && typeof run === 'object', 'newRun returns a run');
  return run;
}
// Starts the current Blind, optionally after moving to another Ante / Blind / Boss first.
function begin(run, { ante, blindIndex, boss } = {}) {
  if (ante != null) run.ante = ante;
  if (blindIndex != null) run.blindIndex = blindIndex;
  if (boss !== undefined) run.bosses[run.ante] = boss;
  return ok(Engine.startBlind(run), 'startBlind');
}
function blindRun(opts = {}, at = {}) {
  const run = mkRun(opts);
  begin(run, at);
  return run;
}
function bossRun(bossId, opts = {}, at = {}) {
  const run = mkRun(opts);
  begin(run, { blindIndex: 2, boss: bossId, ...at });
  assert.equal(run.blind.boss, bossId, 'the Boss Blind is set up');
  return run;
}

// Cards: 'KS' = King of Spades, '10H', 'AD', '2C'.
const RANK_OF = { A: 14, K: 13, Q: 12, J: 11 };
function parseCode(code) {
  const m = /^(10|[2-9AKQJ])([SHDC])$/.exec(code);
  if (!m) throw new Error('bad card code ' + code);
  return { rank: RANK_OF[m[1]] || Number(m[1]), suit: m[2] };
}
// A loose card for scoreCards: mk('KS', { enhancement:'inked', edition:'gloss', seal:'encore', grow:8 }).
function mk(code, extra = {}) {
  const { rank, suit } = parseCode(code);
  const { grow, ...opts } = extra;
  const card = Engine.makeCard(rank, suit, opts);
  assert.ok(card && card.uid, 'makeCard returns a card');
  if (grow != null) card.grow = grow;
  return card;
}
const cardRef = (run, uid) => run.cards.find((c) => c.uid === uid) || null;
const handCards = (run) => run.blind.hand.map((u) => cardRef(run, u));
// Rewrites the first specs.length cards in hand and pins the hand order (sortMode 'manual').
// A spec is 'KS' or { code:'KS', enhancement, edition, seal, grow }. Returns their uids in order.
function setHand(run, specs) {
  const uids = run.blind.hand.slice();
  assert.ok(specs.length <= uids.length, 'enough cards in hand');
  specs.forEach((spec, i) => {
    const s = typeof spec === 'string' ? { code: spec } : spec;
    const card = cardRef(run, uids[i]);
    Object.assign(card, parseCode(s.code), {
      enhancement: s.enhancement ?? null,
      edition: s.edition ?? null,
      seal: s.seal ?? null,
      grow: s.grow ?? 0,
    });
  });
  ok(Engine.reorderHand(run, uids), 'reorderHand');
  return uids.slice(0, specs.length);
}
// Makes every card in hand plain except the given specs (applied to the first cards).
function setWholeHand(run, specs, fill = ['2C', '3C', '4C', '5D', '7D', '8D', '9C', '6C', '10D', 'JC']) {
  const n = run.blind.hand.length;
  const all = specs.slice();
  for (let i = 0; all.length < n; i++) all.push(fill[i % fill.length]);
  return setHand(run, all);
}

function score(run, played, held = []) {
  const res = Engine.scoreCards(run, played, held);
  assert.ok(res && Array.isArray(res.steps), 'scoreCards returns a ScoreResult');
  return plain(res);
}
// Compares the steps after the base step, on the keys each expected step names.
function expectSteps(res, expected, message = 'steps after base') {
  const got = res.steps.slice(1).map((s, i) => pickKeys(s, Object.keys(expected[i] || { source: 1, kind: 1, amount: 1 })));
  deq(got, expected, message);
}
const labelled = (res, label) => res.steps.filter((s) => s.label === label);

function play(run, uids) {
  return ok(Engine.playHand(run, uids), 'playHand');
}
function discard(run, uids) {
  return ok(Engine.discard(run, uids), 'discard');
}
// Clears the running Blind: the score is set just under the target and one card is played.
function clearBlind(run, { money } = {}) {
  assert.equal(run.phase, 'play', 'a Blind is running');
  run.blind.score = run.blind.target - 1;
  if (money != null) run.money = money;
  const r = play(run, [run.blind.hand[0]]);
  assert.equal(r.cleared, true, 'the hand clears the Blind');
  return r;
}
function toShop(run, clearOpts) {
  if (run.phase === 'blind-select') begin(run);
  clearBlind(run, clearOpts);
  ok(Engine.collect(run), 'collect');
  assert.equal(run.phase, 'shop');
  return run;
}
function shopRun(opts = {}, clearOpts) {
  const run = mkRun(opts);
  toShop(run, clearOpts);
  return run;
}
const shopItems = (run, slot) =>
  run.shop.items.map((it, index) => ({ ...plain(it), index })).filter((x) => !slot || x.slot === slot);
// API ASSUMED: a pack's shop item carries the pack row id as item.id (plus item.size).
function forcePack(run, packId) {
  const row = PACKS[packId];
  const p = shopItems(run, ASSUMED.slot.pack)[0];
  assert.ok(p, 'the Shop has a Booster Pack slot');
  Object.assign(run.shop.items[p.index], { id: packId, size: row[1], sold: false, price: row[4] });
  return p.index;
}
function openPack(run, packId) {
  const i = forcePack(run, packId);
  run.money += PACKS[packId][4];
  const r = ok(Engine.buy(run, i), `buy ${packId}`);
  assert.equal(r.opened, true, 'buying a pack opens it');
  assert.equal(run.phase, 'pack');
  return r;
}
function forceVoucher(run, id) {
  const v = shopItems(run, ASSUMED.slot.voucher)[0];
  assert.ok(v, 'the Shop has a Voucher slot');
  Object.assign(run.shop.items[v.index], { id, sold: false, price: 10 });
  run.anteVoucher = id;
  return v.index;
}
function buyVoucher(run, id) {
  const i = forceVoucher(run, id);
  run.money += 10;
  return ok(Engine.buy(run, i), `buy Voucher ${id}`);
}
// Card-slot item rewritten in place, e.g. { kind:'joker', id:'jinglejester', edition:'gloss', price:6 }.
function forceCard(run, fields) {
  const c = shopItems(run, ASSUMED.slot.card)[0];
  assert.ok(c, 'the Shop has a card slot');
  Object.assign(run.shop.items[c.index], { edition: null, sold: false }, fields);
  return c.index;
}
function skipWith(run, tagId) {
  run.tags[`${run.ante}-${run.blindIndex}`] = tagId;
  return ok(Engine.skipBlind(run), `skip for ${tagId}`);
}
// Puts a consumable straight into the slots, in the engine's own shape (§2.1 patch).
function give(run, kind, id) {
  const c = { uid: 'k' + run.nextUid++, kind, id };
  run.consumables.push(c);
  return c.uid;
}
function use(run, uid, selected = []) {
  return ok(Engine.useConsumable(run, uid, selected), 'useConsumable');
}
function addJ(run, id, paid = 0, edition = null) {
  const j = Engine.addJoker(run, id, paid, edition);
  assert.ok(j && j.uid, `addJoker ${id}`);
  return j;
}
const jokerIds = (run) => run.jokers.map((j) => j.id);
const packHand = (run) => (run.pack && run.pack[ASSUMED.packHand]) || [];
function pick(run, index, selected = []) {
  return ok(Engine.packPick(run, index, selected), 'packPick');
}
const levelValue = (handId, level) => {
  const [c, m, lc, lm] = HANDS[handId];
  return { chips: c + (level - 1) * lc, mult: m + (level - 1) * lm };
};

// ================================================================== §0 harness and ground rules
describe('§0 harness and ground rules', () => {
  test('content.js and engine.js load into one bare vm context', () => {
    assert.equal(typeof TW, 'object');
    assert.equal(typeof Engine, 'object');
    assert.equal(typeof Content, 'object');
    for (const fn of ['newRun', 'startBlind', 'skipBlind', 'playHand', 'discard', 'scoreCards', 'evaluate', 'collect', 'buy', 'reroll', 'packPick', 'packSkip', 'leaveShop', 'useConsumable', 'serialize', 'deserialize']) {
      assert.equal(typeof Engine[fn], 'function', `Engine.${fn}`);
    }
  });

  test('§0: the engine is DOM-free and clock-free, and Math.random is left to randomSeed', () => {
    const ctx = makeContext({
      prelude: `
        globalThis.Date = function () { throw new Error('Date is not allowed'); };
        globalThis.Date.now = function () { throw new Error('Date.now is not allowed'); };
        Math.random = function () { throw new Error('Math.random is only allowed in randomSeed'); };
      `,
    });
    const E = vm.runInContext('globalThis.TW.Engine', ctx);
    const run = E.newRun({ seed: 'CLOCKFRE' });
    assert.equal(E.startBlind(run).ok, true);
    assert.equal(E.discard(run, [run.blind.hand[0]]).ok, true);
    run.blind.score = run.blind.target - 1;
    assert.equal(E.playHand(run, [run.blind.hand[0]]).ok, true);
    assert.equal(E.collect(run).ok, true);
    run.money = 100;
    assert.equal(E.reroll(run).ok, true);
    assert.equal(typeof E.serialize(run), 'string');
    assert.equal(E.leaveShop(run).ok, true);
    assert.equal(run.phase, 'blind-select');
  });

  test('§4.2 randomSeed: 8 characters from A-Z and 2-9, without O, I, 0 or 1', () => {
    for (let i = 0; i < 40; i++) {
      assert.match(Engine.randomSeed(), /^[A-HJ-NP-Z2-9]{8}$/);
    }
  });
});

// ================================================================== §3 content tables
describe('§3 content tables (keyed by id; display names are not asserted)', () => {
  test('§3: the v3 tables exist', () => {
    for (const name of ['HANDS', 'ANTE_TARGETS', 'BLINDS', 'ENHANCEMENTS', 'EDITIONS', 'SEALS', 'TAROTS', 'PLANETS', 'SPECTRALS', 'BOSSES', 'VOUCHERS', 'TAGS', 'PACKS', 'DECKS', 'STAKES', 'RARITIES', 'JOKERS']) {
      assert.ok(Content[name], `TW.Content.${name}`);
    }
  });

  test('§3: every row of every table has an id, a name and a text', () => {
    for (const name of ['HANDS', 'ENHANCEMENTS', 'EDITIONS', 'SEALS', 'TAROTS', 'PLANETS', 'SPECTRALS', 'BOSSES', 'VOUCHERS', 'TAGS', 'PACKS', 'DECKS', 'STAKES', 'JOKERS']) {
      for (const r of rows(name)) {
        assert.equal(typeof r.id, 'string', `${name} row id`);
        assert.equal(typeof r.name, 'string', `${name}.${r.id} name`);
        assert.equal(typeof r.text, 'string', `${name}.${r.id} text`);
        assert.ok(r.name.length > 0 && r.text.length > 0, `${name}.${r.id} name and text are not empty`);
      }
    }
  });

  test('§2.2 patch: HANDS keep their base values and get the new per-level values', () => {
    deq(rows('HANDS').map((h) => h.id), HAND_IDS);
    for (const h of rows('HANDS')) {
      deq([h.chips, h.mult, h.lchips, h.lmult], HANDS[h.id], h.id);
    }
  });

  test('§2.6: ANTE_TARGETS are unchanged', () => {
    deq(Content.ANTE_TARGETS, ANTE_TARGETS);
  });

  test('§2.6: BLINDS are Small x1 $3 skippable, Big x1.5 $4 skippable, Boss x2 $5 never skippable', () => {
    const got = rows('BLINDS').map((b) => ({ kind: b.kind ?? b.id, mult: b.mult, reward: b.reward, skippable: b.skippable }));
    deq(got, BLINDS);
  });

  test('§3: ENHANCEMENTS, EDITIONS and SEALS hold exactly the designed ids', () => {
    deq(sorted(rows('ENHANCEMENTS').map((r) => r.id)), sorted(ENHANCEMENT_IDS));
    deq(sorted(rows('EDITIONS').map((r) => r.id)), sorted(EDITION_IDS));
    deq(sorted(rows('SEALS').map((r) => r.id)), sorted(SEAL_IDS));
  });

  test('§3: TAROTS (20), PLANETS (9) and SPECTRALS (16) hold exactly the designed ids', () => {
    deq(sorted(rows('TAROTS').map((r) => r.id)), sorted(TAROT_IDS));
    deq(sorted(rows('PLANETS').map((r) => r.id)), sorted(PLANET_IDS));
    deq(sorted(rows('SPECTRALS').map((r) => r.id)), sorted(SPECTRAL_IDS));
  });

  test('§3.3: each Planet card levels its own poker hand', () => {
    for (const r of rows('PLANETS')) assert.equal(r.hand, PLANETS[r.id], r.id);
  });

  test('§3.5: BOSSES hold the 15 Boss Blinds with their fromAnte; only The Big Finish is the finale', () => {
    deq(sorted(rows('BOSSES').map((r) => r.id)), sorted(BOSS_IDS));
    for (const r of rows('BOSSES')) assert.equal(r.fromAnte, BOSSES[r.id], `${r.id} fromAnte`);
    deq(rows('BOSSES').filter((r) => r.finale).map((r) => r.id), ['bigfinish']);
  });

  test('§3.6: VOUCHERS hold the 13 Vouchers, $10 each', () => {
    deq(sorted(rows('VOUCHERS').map((r) => r.id)), sorted(VOUCHER_IDS));
    for (const r of rows('VOUCHERS')) assert.equal(r.cost ?? r.price, 10, `${r.id} costs $10`);
  });

  test('§3.7: TAGS hold the 12 Tags; the Ghost Tag only from Ante 2', () => {
    deq(sorted(rows('TAGS').map((r) => r.id)), sorted(TAG_IDS));
    for (const r of rows('TAGS')) assert.equal(r.fromAnte ?? 1, TAGS[r.id], `${r.id} fromAnte`);
  });

  test('§2.9: PACKS hold 5 kinds x 3 sizes with the designed shown / picks / price', () => {
    deq(sorted(rows('PACKS').map((r) => r.id)), sorted(PACK_IDS));
    for (const r of rows('PACKS')) {
      // API ASSUMED: content rows reuse the systems.json field names (kind, size, shown, picks, cost).
      deq([r.kind, r.size, r.shown, r.picks, r.cost ?? r.price], PACKS[r.id].slice(0, 5), r.id);
      assert.ok(r.picks <= r.shown, `${r.id}: picks never exceed cards shown`);
    }
  });

  test('§3.8 / §3.9: DECKS (10) and STAKES (4) hold the designed ids; Stake target multipliers', () => {
    deq(sorted(rows('DECKS').map((r) => r.id)), sorted(DECK_IDS));
    deq(sorted(rows('STAKES').map((r) => r.id)), sorted(STAKE_IDS));
    for (const r of rows('STAKES')) assert.equal(r.targetMult, STAKES[r.id], r.id);
  });

  test('§2.8: RARITIES are common 70, uncommon 25, rare 5 and legendary 0', () => {
    const R = Content.RARITIES;
    const weight = (id) => {
      const r = Array.isArray(R) ? R.find((x) => x.id === id) : R[id];
      return r && (typeof r === 'number' ? r : r.weight);
    };
    deq(['common', 'uncommon', 'rare', 'legendary'].map(weight), [70, 25, 5, 0]);
  });

  test('§3.4: JOKERS rename the 27 non-tide charms through oldId, keeping their rarities and costs', () => {
    for (const id of JOKER_IDS) {
      const r = jokerRow(id);
      assert.ok(r, `Joker ${id} is present`);
      deq([r.oldId, r.rarity, r.cost], JOKERS[id], id);
      if (r.oldId !== id) assert.equal(jokerRow(r.oldId), null, `the v2 id ${r.oldId} is gone`);
    }
    deq(sorted(rows('JOKERS').filter((r) => r.oldId).map((r) => r.id)), sorted(JOKER_IDS), 'exactly these 27 carry an oldId');
  });

  test('§3.4: JOKERS is the 120-Joker table: 60 common, 40 uncommon, 15 rare and 5 Legendary', () => {
    const all = rows('JOKERS');
    assert.equal(all.length, 120);
    assert.equal(new Set(all.map((r) => r.id)).size, 120);
    deq(['common', 'uncommon', 'rare', 'legendary'].map((x) => all.filter((r) => r.rarity === x).length), [60, 40, 15, 5]);
    deq(sorted(all.filter((r) => r.rarity === 'legendary').map((r) => r.id)), sorted(LEGENDARY_IDS));
    for (const r of all.filter((x) => x.rarity === 'legendary')) assert.equal(r.cost, 20, r.id);
  });

  test('§3.4: every Joker row has a known rarity and a whole-dollar cost', () => {
    for (const r of rows('JOKERS')) {
      assert.ok(['common', 'uncommon', 'rare', 'legendary'].includes(r.rarity), `${r.id} rarity`);
      assert.ok(Number.isInteger(r.cost) && r.cost > 0, `${r.id} cost`);
    }
  });
});

// ================================================================== §2.5 the tide is gone
describe('§2.5 patch: the tide is fully gone', () => {
  const keysDeep = (value, out = new Set()) => {
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        out.add(k);
        keysDeep(v, out);
      }
    }
    return out;
  };

  test('the four tide Jokers are not in the Joker table', () => {
    for (const id of TIDE_JOKERS) assert.equal(jokerRow(id), null, id);
  });

  test('no Engine function deals with the tide', () => {
    for (const fn of ['turnTide', 'canTurnTide', 'tideFixed']) assert.equal(Engine[fn], undefined, fn);
    for (const name of Object.keys(Engine)) assert.doesNotMatch(name, /tide/i, `Engine.${name}`);
  });

  test('no content row mentions the tide or keeps a tide field', () => {
    for (const name of ['ENHANCEMENTS', 'EDITIONS', 'SEALS', 'TAROTS', 'PLANETS', 'SPECTRALS', 'BOSSES', 'VOUCHERS', 'TAGS', 'PACKS', 'DECKS', 'STAKES', 'JOKERS']) {
      for (const r of rows(name)) {
        assert.doesNotMatch(r.text, /\btides?\b/i, `${name}.${r.id} text`);
        for (const k of Object.keys(r)) assert.doesNotMatch(k, /tide/i, `${name}.${r.id}.${k}`);
      }
    }
    for (const d of rows('DECKS')) {
      assert.equal(d.fixedTide, undefined, `${d.id} fixedTide`);
      assert.equal(d.startCharms, undefined, `${d.id} startCharms`);
    }
  });

  test('a run, a Blind and a played hand carry no tide state', () => {
    const run = blindRun();
    for (const k of keysDeep(run)) assert.doesNotMatch(k, /tide/i, `run key ${k}`);
    const r = play(run, run.blind.hand.slice(0, 2));
    assert.equal(r.tide, undefined, 'playHand reports no tide');
    for (const k of keysDeep(run)) assert.doesNotMatch(k, /tide/i, `run key ${k} after a hand`);
  });
});

// ================================================================== §4.1 / §2.11 a new run
describe('§4.1 / §2.11 a new run', () => {
  test('defaults: First Issue Deck on Sunny Stake, $4, 4 hands, 3 discards, hand size 8, 5 Joker and 2 consumable slots', () => {
    const run = Engine.newRun({ seed: SEED });
    deq(
      pickKeys(run, ['version', 'deckId', 'stake', 'ante', 'blindIndex', 'phase', 'endless', 'won', 'money', 'hands', 'discards', 'handSize', 'jokerSlots', 'consumableSlots']),
      { version: 3, deckId: 'firstissue', stake: 'sunny', ante: 1, blindIndex: 0, phase: 'blind-select', endless: false, won: false, money: 4, hands: 4, discards: 3, handSize: 8, jokerSlots: 5, consumableSlots: 2 },
    );
    deq([run.jokers, run.consumables, run.vouchers], [[], [], []]);
    assert.equal(run.blind, null);
    assert.equal(run.shop, null);
    assert.equal(run.pack, null);
    assert.equal(run.cashout, null);
  });

  test('§2.1 patch: 52 distinct cards shaped { uid, rank, suit, enhancement, edition, seal, grow }', () => {
    const run = mkRun();
    assert.equal(run.cards.length, 52);
    const seen = new Set();
    for (const c of run.cards) {
      assert.match(c.uid, /^c\d+$/);
      deq(pickKeys(c, ['enhancement', 'edition', 'seal', 'grow']), { enhancement: null, edition: null, seal: null, grow: 0 }, c.uid);
      assert.ok(c.rank >= 2 && c.rank <= 14 && 'SHDC'.includes(c.suit));
      seen.add(`${c.rank}${c.suit}`);
    }
    assert.equal(seen.size, 52);
    assert.equal(new Set(run.cards.map((c) => c.uid)).size, 52);
  });

  test('§4.1: levels start at 1 and plays at 0 for every hand', () => {
    const run = mkRun();
    deq(run.levels, Object.fromEntries(HAND_IDS.map((h) => [h, 1])));
    deq(run.plays, Object.fromEntries(HAND_IDS.map((h) => [h, 0])));
  });

  test('§4.1: pending starts empty (no extra hands, target x1, no sale)', () => {
    const run = mkRun();
    assert.equal(run.pending.extraHands, 0);
    assert.equal(run.pending.targetMult, 1);
    assert.ok(!run.pending.sale, 'no Sale Tag pending');
  });

  test('§2.12 patch: discovery tracks jokers, consumables, bosses, vouchers and tags', () => {
    const run = mkRun();
    deq(sorted(Object.keys(run.discovered)), ['bosses', 'consumables', 'jokers', 'tags', 'vouchers']);
    for (const v of Object.values(run.discovered)) assert.ok(Array.isArray(v));
  });

  test('§3.5: Boss Blinds are rolled for Antes 1-8 at creation; Ante 8 is The Big Finish', () => {
    const run = mkRun();
    for (let a = 1; a <= 8; a++) assert.ok(BOSS_IDS.includes(run.bosses[a]), `Ante ${a} boss`);
    assert.equal(run.bosses[8], 'bigfinish');
  });

  test('§2.10 patch: Tags are rolled for every Small and Big Blind of Antes 1-8 at creation', () => {
    const run = mkRun();
    for (let a = 1; a <= 8; a++) {
      for (const i of [0, 1]) assert.ok(TAG_IDS.includes(run.tags[`${a}-${i}`]), `Tag ${a}-${i}`);
      assert.equal(run.tags[`${a}-2`], undefined, `no Tag for the Boss Blind of Ante ${a}`);
    }
  });

  test('§4.2: unknown deck or stake ids fall back or fail without throwing', () => {
    assert.doesNotThrow(() => Engine.newRun({ deckId: 'nope', stake: 'nope', seed: SEED }));
  });
});

// ================================================================== §3.8 Decks
describe('§3.8 Decks', () => {
  test('First Issue Deck: a plain 52-card deck', () => {
    const run = mkRun({ deckId: 'firstissue' });
    assert.equal(run.cards.filter((c) => c.enhancement || c.edition || c.seal).length, 0);
    deq([run.hands, run.discards, run.handSize, run.money], [4, 3, 8, 4]);
  });

  test('Speed Lines Deck: +1 hand every Blind, -1 discard', () => {
    const run = mkRun({ deckId: 'speedlines' });
    deq([run.hands, run.discards], [5, 2]);
  });

  test('Sketchbook Deck: +1 discard every Blind', () => {
    const run = mkRun({ deckId: 'sketchbook' });
    deq([run.hands, run.discards], [4, 4]);
  });

  test('Panorama Deck: +1 hand size, -1 discard every Blind', () => {
    const run = mkRun({ deckId: 'panorama' });
    deq([run.handSize, run.discards], [9, 2]);
    begin(run);
    assert.equal(run.blind.hand.length, 9);
  });

  test('Bargain Bin Deck: six random cards start as Dime Store cards, and you start with $0', () => {
    const run = mkRun({ deckId: 'bargainbin' });
    assert.equal(run.money, 0);
    assert.equal(run.cards.filter((c) => c.enhancement === 'dimestore').length, 6);
    assert.equal(run.cards.filter((c) => c.enhancement && c.enhancement !== 'dimestore').length, 0);
  });

  test('Studio Deck: +1 consumable slot and starts with Ink Pot, Boxing Glove and Spotlight', () => {
    const run = mkRun({ deckId: 'studio' });
    assert.equal(run.consumableSlots, 3);
    deq(run.consumables.map((c) => [c.kind, c.id]), [['tarot', 'inkpot'], ['tarot', 'boxingglove'], ['tarot', 'spotlight']]);
    for (const c of run.consumables) assert.match(c.uid, /^k\d+$/);
  });

  test('Rubber Stamp Deck: eight random cards start with a random Seal', () => {
    for (const seed of ['STAMPAAA', 'STAMPBBB', 'STAMPCCC']) {
      const run = mkRun({ deckId: 'rubberstamp', seed });
      const sealed = run.cards.filter((c) => c.seal);
      assert.equal(sealed.length, 8, seed);
      for (const c of sealed) assert.ok(SEAL_IDS.includes(c.seal), c.seal);
    }
  });

  test('Mint Condition Deck: start with $12', () => {
    assert.equal(mkRun({ deckId: 'mintcondition' }).money, 12);
  });

  test('Halftone Deck: starts with a random common Joker with Gloss, gained free', () => {
    for (const seed of ['HALFAAAA', 'HALFBBBB', 'HALFCCCC']) {
      const run = mkRun({ deckId: 'halftone', seed });
      assert.equal(run.jokers.length, 1, seed);
      const j = run.jokers[0];
      assert.match(j.uid, /^h\d+$/);
      assert.equal(jokerRow(j.id).rarity, 'common');
      assert.equal(j.edition, 'gloss');
      assert.equal(j.paid, 0);
    }
  });

  test('Spooky Deck: starts with Curtain Call (a Spectral card)', () => {
    const run = mkRun({ deckId: 'spooky' });
    deq(run.consumables.map((c) => [c.kind, c.id]), [['spectral', 'curtaincall']]);
  });
});

// ================================================================== §3.9 Stakes
describe('§3.9 Stakes', () => {
  test('Sunny and Uh-Oh keep 3 discards; Gulp and Yikes take one away', () => {
    deq(STAKE_IDS.map((stake) => mkRun({ stake }).discards), [3, 3, 2, 2]);
    deq(STAKE_IDS.map((stake) => mkRun({ stake }).stake), STAKE_IDS);
  });

  test('discards stack across Deck and Stake and never go below 0', () => {
    assert.equal(mkRun({ deckId: 'speedlines', stake: 'yikes' }).discards, 1);
    assert.equal(mkRun({ deckId: 'panorama', stake: 'gulp' }).discards, 1);
  });
});

// ================================================================== §4.2 serialize / deserialize and determinism
describe('§4.2 serialize, deserialize and seeded determinism', () => {
  test('a fresh run survives a round trip', () => {
    const run = mkRun();
    const s = Engine.serialize(run);
    assert.equal(typeof s, 'string');
    deq(Engine.deserialize(s), run);
  });

  test('a run in the middle of a Blind, a Shop and a pack survives a round trip', () => {
    const run = blindRun();
    play(run, run.blind.hand.slice(0, 1));
    deq(Engine.deserialize(Engine.serialize(run)), run);
    clearBlind(run);
    ok(Engine.collect(run));
    deq(Engine.deserialize(Engine.serialize(run)), run);
    openPack(run, 'tarotnormal');
    deq(Engine.deserialize(Engine.serialize(run)), run);
  });

  test('bad JSON and a version 2 run deserialize to null', () => {
    assert.equal(Engine.deserialize('{not json'), null);
    const old = plain(mkRun());
    old.version = 2;
    assert.equal(Engine.deserialize(JSON.stringify(old)), null);
  });

  test('the same seed gives the same run, and the same actions give the same state', () => {
    const a = mkRun({ seed: 'SAMESEED' });
    const b = mkRun({ seed: 'SAMESEED' });
    deq(a, b);
    for (const run of [a, b]) {
      begin(run);
      discard(run, run.blind.hand.slice(0, 3));
      play(run, run.blind.hand.slice(0, 5));
    }
    deq(a, b);
  });

  test('different seeds deal different decks', () => {
    const a = blindRun({ seed: 'SEEDAAAA' });
    const b = blindRun({ seed: 'SEEDBBBB' });
    assert.notDeepEqual(plain(a.blind.draw), plain(b.blind.draw));
  });
});

// ================================================================== §2.2 poker hands
describe('§2.2 evaluate', () => {
  const ev = (cards, opts) => plain(Engine.evaluate(cards, opts));

  test('a Pair scores its two cards; other cards are unscored', () => {
    const cards = [mk('KS'), mk('7D'), mk('KH'), mk('2C')];
    deq(ev(cards), { handId: 'pair', scoringUids: [cards[0].uid, cards[2].uid] });
  });

  test('High Card scores only the single highest-ranked card', () => {
    const cards = [mk('9S'), mk('QH'), mk('3D'), mk('7C'), mk('2H')];
    deq(ev(cards), { handId: 'high', scoringUids: [cards[1].uid] });
  });

  test('A-2-3-4-5 and 10-J-Q-K-A are Straights; Q-K-A-2-3 does not wrap', () => {
    assert.equal(ev([mk('AS'), mk('2H'), mk('3D'), mk('4C'), mk('5S')]).handId, 'straight');
    assert.equal(ev([mk('10S'), mk('JH'), mk('QD'), mk('KC'), mk('AS')]).handId, 'straight');
    assert.equal(ev([mk('QS'), mk('KH'), mk('AD'), mk('2C'), mk('3S')]).handId, 'high');
  });

  test('Four of a Kind scores the four; Full House, Flush and Straight Flush score all five', () => {
    const four = [mk('8S'), mk('8H'), mk('3C'), mk('8D'), mk('8C')];
    deq(ev(four).scoringUids, [four[0].uid, four[1].uid, four[3].uid, four[4].uid]);
    assert.equal(ev(four).handId, 'four');
    const fh = [mk('8S'), mk('8H'), mk('3C'), mk('8D'), mk('3S')];
    deq(ev(fh), { handId: 'fullhouse', scoringUids: fh.map((c) => c.uid) });
    const sf = [mk('5H'), mk('6H'), mk('7H'), mk('8H'), mk('9H')];
    deq(ev(sf), { handId: 'straightflush', scoringUids: sf.map((c) => c.uid) });
  });

  test('Two Pair scores the four paired cards; Three of a Kind the three', () => {
    const tp = [mk('9S'), mk('4H'), mk('9D'), mk('4C'), mk('KH')];
    deq(ev(tp), { handId: 'twopair', scoringUids: [tp[0].uid, tp[1].uid, tp[2].uid, tp[3].uid] });
    const three = [mk('JS'), mk('JH'), mk('2D'), mk('JC')];
    deq(ev(three), { handId: 'three', scoringUids: [three[0].uid, three[1].uid, three[3].uid] });
  });

  test('§2.2 patch: a Scribbled card matches any suit for a Flush, unless The Wash-Out is active', () => {
    const cards = [mk('2H'), mk('5H'), mk('9H'), mk('KH'), mk('7S', { enhancement: 'scribbled' })];
    assert.equal(ev(cards).handId, 'flush');
    assert.equal(ev(cards, { washout: true }).handId, 'high');
  });

  test('§2.2 patch: five Scribbled cards of mixed suits are a Flush', () => {
    const cards = ['2H', '5S', '9D', 'KC', '7S'].map((c) => mk(c, { enhancement: 'scribbled' }));
    assert.equal(ev(cards).handId, 'flush');
  });

  test('0 cards or more than 5 cards evaluate to null', () => {
    assert.equal(Engine.evaluate([]), null);
    assert.equal(Engine.evaluate(['2S', '3S', '4S', '5S', '6S', '8S'].map((c) => mk(c))), null);
  });

  // API ASSUMED: evaluate applies the Cameo rule itself; The Censor is passed as { censor:true }.
  test('§2.2 patch: a played Cameo card joins the scoring cards in play order but never changes the hand type', () => {
    const cards = [mk('5D', { seal: 'cameo' }), mk('KS'), mk('KH'), mk('2C')];
    deq(ev(cards), { handId: 'pair', scoringUids: [cards[0].uid, cards[1].uid, cards[2].uid] });
    const two = [mk('KS'), mk('5D', { seal: 'cameo' })];
    deq(ev(two), { handId: 'high', scoringUids: [two[0].uid, two[1].uid] });
    deq(ev(cards, { censor: true }).scoringUids, [cards[1].uid, cards[2].uid], 'API ASSUMED: { censor:true } drops Cameo cards');
  });
});

// ================================================================== hand levels
describe('§2.2 patch: hand levels use the new per-level increments', () => {
  test('handTable lists every hand strongest first at level 1 with its base values', () => {
    const t = plain(Engine.handTable(mkRun()));
    deq(t.map((r) => r.handId), HAND_IDS);
    for (const r of t) deq([r.level, r.chips, r.mult, r.plays], [1, HANDS[r.handId][0], HANDS[r.handId][1], 0], r.handId);
  });

  test('at level L a hand is worth base + (L - 1) x per-level, for every hand', () => {
    const run = mkRun();
    for (const h of HAND_IDS) run.levels[h] = 3;
    for (const r of plain(Engine.handTable(run))) {
      deq([r.level, r.chips, r.mult], [3, levelValue(r.handId, 3).chips, levelValue(r.handId, 3).mult], r.handId);
    }
  });

  test('worked values at level 2: High 17/2, Pair 28/3, Two Pair 44/3, Three 54/5, Straight 66/7, Flush 56/6, Full House 71/6, Four 96/9, Straight Flush 155/12', () => {
    const run = mkRun();
    for (const h of HAND_IDS) run.levels[h] = 2;
    const got = Object.fromEntries(plain(Engine.handTable(run)).map((r) => [r.handId, [r.chips, r.mult]]));
    deq(got, {
      high: [17, 2], pair: [28, 3], twopair: [44, 3], three: [54, 5], straight: [66, 7],
      flush: [56, 6], fullhouse: [71, 6], four: [96, 9], straightflush: [155, 12],
    });
  });

  test('preview shows the selected hand at its level', () => {
    const run = blindRun();
    const [a, b] = setHand(run, ['KS', 'KH']);
    run.levels.pair = 3;
    deq(pickKeys(Engine.preview(run, [a, b]), ['handId', 'level', 'chips', 'mult']), { handId: 'pair', level: 3, chips: 44, mult: 4 });
    assert.equal(Engine.preview(run, []), null);
  });

  test('a scored Pair of Kings at level 3 makes 64 x 4 = 256', () => {
    const run = mkRun();
    run.levels.pair = 3;
    const res = score(run, [mk('KS'), mk('KH')]);
    deq(pickKeys(res, ['handId', 'level', 'chips', 'mult', 'total']), { handId: 'pair', level: 3, chips: 64, mult: 4, total: 256 });
    deq(pickKeys(res.steps[0], ['source', 'kind', 'amount', 'label', 'runningChips', 'runningMult']), {
      source: 'base', kind: 'note', amount: 0, label: `${handName('pair')} lv.3`, runningChips: 44, runningMult: 4,
    });
  });
});

// ================================================================== §2.6 targets and rewards
describe('§2.6 Blind targets and rewards', () => {
  const targets = (run) => plain(Engine.blindsForAnte(run)).map((b) => b.target);
  const atAnte = (ante, opts = {}, boss = 'heckler') => {
    const run = mkRun(opts);
    run.ante = ante;
    run.bosses[ante] = boss;
    return run;
  };

  test('Ante 1 on Sunny Stake: Small 300, Big 450, Boss 600, paying $3, $4 and $5', () => {
    const info = plain(Engine.blindsForAnte(atAnte(1)));
    deq(info.map((b) => [b.index, b.target, b.reward]), [[0, 300, 3], [1, 450, 4], [2, 600, 5]]);
    deq(info.map((b) => b.kind), ASSUMED.blindKinds, 'API ASSUMED: BlindInfo.kind uses the rounds ids');
    deq(info.map((b) => b.name), [blindName(0), blindName(1), blindName(2)]);
    deq(info.map((b) => b.status), ['current', 'upcoming', 'upcoming']);
  });

  test('every Ante 1-7: Small = the Ante target, Big = x1.5, Boss = x2', () => {
    for (let a = 1; a <= 7; a++) {
      const t = ANTE_TARGETS[a - 1];
      deq(targets(atAnte(a)), [t, Math.round((t * 1.5) / 10) * 10, t * 2], `Ante ${a}`);
    }
  });

  test('Ante 8: the Boss Blind is The Big Finish, x2 x1.5 = 135000', () => {
    const run = mkRun();
    run.ante = 8;
    deq(targets(run), [45000, 67500, 135000]);
  });

  test('Stakes multiply every target: Uh-Oh and Gulp x1.2, Yikes x1.4', () => {
    deq(targets(atAnte(1, { stake: 'uhoh' })), [360, 540, 720]);
    deq(targets(atAnte(1, { stake: 'gulp' })), [360, 540, 720]);
    deq(targets(atAnte(1, { stake: 'yikes' })), [420, 630, 840]);
    deq(targets(atAnte(2, { stake: 'uhoh' })), [840, 1260, 1680]);
    deq(targets(atAnte(3, { stake: 'yikes' })), [2380, 3570, 4760]);
  });

  test('The Short Fuse lowers its Boss Blind target by 25%', () => {
    deq(targets(atAnte(2, {}, 'shortfuse')), [700, 1050, 1050]);
    deq(targets(atAnte(1, {}, 'shortfuse')), [300, 450, 450]);
  });

  test('Mint Condition Deck: Blind rewards are $1 lower', () => {
    deq(plain(Engine.blindsForAnte(atAnte(1, { deckId: 'mintcondition' }))).map((b) => b.reward), [2, 3, 4]);
  });

  test('BlindInfo shows the Tag of the Small and Big Blinds and the Boss Blind of the third', () => {
    const run = atAnte(1);
    run.tags['1-0'] = 'piggybank';
    run.tags['1-1'] = 'sky';
    const info = plain(Engine.blindsForAnte(run));
    // API ASSUMED: BlindInfo.tag (was driftwood) is { id, name, text } or null.
    deq(info.map((b) => b.tag && b.tag.id), ['piggybank', 'sky', null]);
    deq(info.map((b) => b.boss && b.boss.id), [null, null, 'heckler']);
    assert.equal(info[2].boss.name, rowById('BOSSES', 'heckler').name);
  });
});

// ================================================================== §2.3 starting a Blind
describe('§2.3 starting a Blind', () => {
  test('startBlind deals the hand and opens the Small Blind', () => {
    const run = mkRun();
    const r = ok(Engine.startBlind(run));
    assert.equal(run.phase, 'play');
    const b = run.blind;
    deq(pickKeys(b, ['kind', 'index', 'boss', 'target', 'score', 'handsLeft', 'discardsLeft', 'handsPlayed', 'handSizeDelta']), {
      kind: 'small', index: 0, boss: null, target: 300, score: 0, handsLeft: 4, discardsLeft: 3, handsPlayed: 0, handSizeDelta: 0,
    });
    assert.equal(b.hand.length, 8);
    assert.equal(b.draw.length, 44);
    deq(b.discardPile, []);
    deq(sorted(r.drawn), sorted(b.hand));
    deq(sorted([...b.hand, ...b.draw]), sorted(run.cards.map((c) => c.uid)));
  });

  test('the Boss Blind takes the boss rolled for its Ante', () => {
    const run = mkRun();
    run.blindIndex = 2;
    const boss = run.bosses[1];
    begin(run);
    deq(pickKeys(run.blind, ['kind', 'index', 'boss']), { kind: 'boss', index: 2, boss });
  });

  test('currentBlindInfo describes the running Blind', () => {
    const run = blindRun();
    deq(pickKeys(Engine.currentBlindInfo(run), ['index', 'target', 'reward']), { index: 0, target: 300, reward: 3 });
  });

  test('startBlind outside Blind select fails with a sentence', () => {
    const run = blindRun();
    bad(Engine.startBlind(run), 'startBlind twice', 'There is no Blind to start right now.');
  });

  test('§2.3: The Smudge hides ranks; other Blinds do not', () => {
    assert.equal(bossRun('smudge').blind.hideRanks, true);
    assert.equal(blindRun().blind.hideRanks, false);
  });
});

// ================================================================== §2.4 scoring order
// All hands below are a Pair of Kings unless said otherwise: base 12 x 2, each King +10 Chips.
const totals = (res) => pickKeys(res, ['chips', 'mult', 'total']);

describe('§2.4 scoring order: Enhancements on scored and held cards', () => {
  test('a plain Pair of Kings: 32 x 2 = 64, one rank step per scoring card', () => {
    const run = blindRun();
    const [ks, kh, sd] = [mk('KS'), mk('KH'), mk('7D')];
    const res = score(run, [ks, kh, sd]);
    deq(pickKeys(res, ['handId', 'playedUids', 'scoringUids', 'booedUid']), { handId: 'pair', playedUids: [ks.uid, kh.uid, sd.uid], scoringUids: [ks.uid, kh.uid], booedUid: null });
    deq(totals(res), { chips: 32, mult: 2, total: 64 });
    expectSteps(res, [
      { source: 'card', uid: ks.uid, kind: 'chips', amount: 10, via: 'rank' },
      { source: 'card', uid: kh.uid, kind: 'chips', amount: 10, via: 'rank' },
    ]);
    const last = res.steps[res.steps.length - 1];
    deq([last.runningChips, last.runningMult], [32, 2]);
  });

  test('Inked: +35 Chips when scored, right after the rank (134)', () => {
    const [ks, kh] = [mk('KS', { enhancement: 'inked' }), mk('KH')];
    const res = score(blindRun(), [ks, kh]);
    deq(totals(res), { chips: 67, mult: 2, total: 134 });
    expectSteps(res, [
      { source: 'card', uid: ks.uid, kind: 'chips', amount: 10, via: 'rank' },
      { source: 'card', uid: ks.uid, kind: 'chips', amount: 35, via: 'enhancement' },
      { source: 'card', uid: kh.uid, kind: 'chips', amount: 10, via: 'rank' },
    ]);
  });

  test('Punchy: +5 Mult when scored (32 x 7 = 224)', () => {
    const [ks, kh] = [mk('KS', { enhancement: 'punchy' }), mk('KH')];
    const res = score(blindRun(), [ks, kh]);
    deq(totals(res), { chips: 32, mult: 7, total: 224 });
    expectSteps(res, [
      { uid: ks.uid, kind: 'chips', amount: 10 },
      { uid: ks.uid, kind: 'mult', amount: 5, via: 'enhancement' },
      { uid: kh.uid, kind: 'chips', amount: 10 },
    ]);
  });

  test('Dime Store: +$1 when scored, as a money step', () => {
    const [ks, kh] = [mk('KS', { enhancement: 'dimestore' }), mk('KH')];
    const res = score(blindRun(), [ks, kh]);
    deq(totals(res), { chips: 32, mult: 2, total: 64 });
    expectSteps(res, [
      { uid: ks.uid, kind: 'chips', amount: 10 },
      { uid: ks.uid, kind: 'money', amount: 1, via: 'enhancement' },
      { uid: kh.uid, kind: 'chips', amount: 10 },
    ]);
  });

  test('Dime Store money is paid when the hand is played', () => {
    const run = blindRun();
    const [a, b] = setHand(run, [{ code: 'KS', enhancement: 'dimestore' }, { code: 'KH', enhancement: 'dimestore' }]);
    const before = run.money;
    play(run, [a, b]);
    assert.equal(run.money, before + 2);
  });

  // content check (content-plan.json): Sequined gives x1.4.
  test('Sequined (popout): x1.4 Mult when scored (32 x 2.8 = 89.6, floored to 89)', () => {
    const [ks, kh] = [mk('KS', { enhancement: 'popout' }), mk('KH')];
    const res = score(blindRun(), [ks, kh]);
    deq(totals(res), { chips: 32, mult: 2.8, total: 89 });
    expectSteps(res, [
      { uid: ks.uid, kind: 'chips', amount: 10 },
      { uid: ks.uid, kind: 'xmult', amount: 1.4, via: 'enhancement' },
      { uid: kh.uid, kind: 'chips', amount: 10 },
    ]);
  });

  test('Scribbled: +10 Chips when scored (42 x 2 = 84)', () => {
    const [ks, kh] = [mk('KS', { enhancement: 'scribbled' }), mk('KH')];
    const res = score(blindRun(), [ks, kh]);
    deq(totals(res), { chips: 42, mult: 2, total: 84 });
    expectSteps(res, [
      { uid: ks.uid, kind: 'chips', amount: 10 },
      { uid: ks.uid, kind: 'chips', amount: 10, via: 'enhancement' },
      { uid: kh.uid, kind: 'chips', amount: 10 },
    ]);
  });

  test('Spotlit: +3 Mult while held in hand (32 x 5 = 160)', () => {
    const qd = mk('QD', { enhancement: 'spotlit' });
    const res = score(blindRun(), [mk('KS'), mk('KH')], [qd, mk('3C')]);
    deq(totals(res), { chips: 32, mult: 5, total: 160 });
    const held = res.steps.filter((s) => s.source === 'held');
    deq(held.map((s) => pickKeys(s, ['uid', 'kind', 'amount', 'via'])), [{ uid: qd.uid, kind: 'mult', amount: 3, via: 'enhancement' }]);
  });

  test('Spotlit does nothing when it is scored instead of held', () => {
    const res = score(blindRun(), [mk('KS', { enhancement: 'spotlit' }), mk('KH')]);
    deq(totals(res), { chips: 32, mult: 2, total: 64 });
  });

  test('Crumpled does nothing when scored', () => {
    const res = score(blindRun(), [mk('KS', { enhancement: 'crumpled' }), mk('KH')]);
    deq(totals(res), { chips: 32, mult: 2, total: 64 });
  });

  test('Vintage: its first-ever score grows it to +4 and gives +4; scoreCards reports grow and stays pure', () => {
    const ks = mk('KS', { enhancement: 'vintage' });
    const res = score(blindRun(), [ks, mk('KH')]);
    deq(totals(res), { chips: 36, mult: 2, total: 72 });
    deq(res.grow, [{ uid: ks.uid, by: 4 }]);
    assert.equal(ks.grow, 0, 'scoreCards does not change the card');
    deq(pickKeys(res.steps[2], ['uid', 'kind', 'amount', 'via']), { uid: ks.uid, kind: 'chips', amount: 4, via: 'enhancement' });
  });

  test('Vintage with +8 stored grows to +12 and gives +12 (44 x 2 = 88)', () => {
    const ks = mk('KS', { enhancement: 'vintage', grow: 8 });
    const res = score(blindRun(), [ks, mk('KH')]);
    deq(totals(res), { chips: 44, mult: 2, total: 88 });
    deq(res.grow, [{ uid: ks.uid, by: 4 }]);
  });

  test('Vintage growth is kept for good by playHand: +4, then +8', () => {
    const run = blindRun();
    const [v] = setHand(run, [{ code: 'KS', enhancement: 'vintage' }]);
    const first = play(run, [v]);
    assert.equal(cardRef(run, v).grow, 4);
    deq(first.result.grow, [{ uid: v, by: 4 }]);
    // Put the same card back in hand for a second hand.
    run.blind.discardPile = run.blind.discardPile.filter((u) => u !== v);
    run.blind.hand.unshift(v);
    ok(Engine.reorderHand(run, run.blind.hand.slice()));
    const second = play(run, [v]);
    assert.equal(cardRef(run, v).grow, 8);
    // High Card: base 5, the King's rank +10, then Vintage grows from +4 to +8 and gives +8.
    assert.equal(second.result.chips, 5 + 10 + 8);
  });
});

describe('§2.4 scoring order: Editions on scored playing cards', () => {
  test('Gloss: +40 Chips after the rank and the Enhancement (107 x 2 = 214)', () => {
    const [ks, kh] = [mk('KS', { enhancement: 'inked', edition: 'gloss' }), mk('KH')];
    const res = score(blindRun(), [ks, kh]);
    deq(totals(res), { chips: 107, mult: 2, total: 214 });
    expectSteps(res, [
      { uid: ks.uid, kind: 'chips', amount: 10, via: 'rank' },
      { uid: ks.uid, kind: 'chips', amount: 35, via: 'enhancement' },
      { source: 'card', uid: ks.uid, kind: 'chips', amount: 40, via: 'edition', edition: 'gloss' },
      { uid: kh.uid, kind: 'chips', amount: 10, via: 'rank' },
    ]);
  });

  test('Ben-Day: +8 Mult when scored (32 x 10 = 320)', () => {
    const [ks, kh] = [mk('KS', { edition: 'benday' }), mk('KH')];
    const res = score(blindRun(), [ks, kh]);
    deq(totals(res), { chips: 32, mult: 10, total: 320 });
    deq(pickKeys(res.steps[2], ['uid', 'kind', 'amount', 'via', 'edition']), { uid: ks.uid, kind: 'mult', amount: 8, via: 'edition', edition: 'benday' });
  });

  test('Four-Color: x1.6 Mult when scored (32 x 3.2 = 102)', () => {
    const [ks, kh] = [mk('KS', { edition: 'fourcolor' }), mk('KH')];
    const res = score(blindRun(), [ks, kh]);
    deq(totals(res), { chips: 32, mult: 3.2, total: 102 });
    deq(pickKeys(res.steps[2], ['uid', 'kind', 'amount', 'via', 'edition']), { uid: ks.uid, kind: 'xmult', amount: 1.6, via: 'edition', edition: 'fourcolor' });
  });

  test('Inverted: a King gives +10 Mult instead of +10 Chips (22 x 12 = 264)', () => {
    const [ks, kh] = [mk('KS', { edition: 'inverted' }), mk('KH')];
    const res = score(blindRun(), [ks, kh]);
    deq(totals(res), { chips: 22, mult: 12, total: 264 });
    expectSteps(res, [
      { uid: ks.uid, kind: 'mult', amount: 10 },
      { uid: kh.uid, kind: 'chips', amount: 10 },
    ]);
  });

  test('Inverted: an Ace gives +11 Mult (23 x 13 = 299)', () => {
    const res = score(blindRun(), [mk('AS', { edition: 'inverted' }), mk('AH')]);
    deq(totals(res), { chips: 23, mult: 13, total: 299 });
  });

  test('Inverted keeps its Enhancement: Inked still gives +35 Chips (57 x 12 = 684)', () => {
    const [ks, kh] = [mk('KS', { enhancement: 'inked', edition: 'inverted' }), mk('KH')];
    const res = score(blindRun(), [ks, kh]);
    deq(totals(res), { chips: 57, mult: 12, total: 684 });
    expectSteps(res, [
      { uid: ks.uid, kind: 'mult', amount: 10 },
      { uid: ks.uid, kind: 'chips', amount: 35, via: 'enhancement' },
      { uid: kh.uid, kind: 'chips', amount: 10 },
    ]);
  });

  test('the card Edition fires before the Jokers\' on-card effects', () => {
    const run = blindRun();
    const crown = addJ(run, 'papercrown');
    const [ks, kh] = [mk('KS', { edition: 'gloss' }), mk('KH')];
    const res = score(run, [ks, kh]);
    deq(totals(res), { chips: 96, mult: 2, total: 192 });
    expectSteps(res, [
      { uid: ks.uid, kind: 'chips', amount: 10, via: 'rank' },
      { uid: ks.uid, kind: 'chips', amount: 40, via: 'edition' },
      { source: 'joker', uid: crown.uid, cardUid: ks.uid, kind: 'chips', amount: 12, via: 'joker' },
      { uid: kh.uid, kind: 'chips', amount: 10, via: 'rank' },
      { source: 'joker', uid: crown.uid, cardUid: kh.uid, kind: 'chips', amount: 12, via: 'joker' },
    ]);
  });
});

describe('§2.4 scoring order: Seals and retriggers ("Encore!")', () => {
  const again = (uid, source = 'card') => ({ source, uid, kind: 'note', amount: 0, label: 'Encore!', via: 'retrigger' });

  test('Encore Seal: the card scores twice, with an Encore! note before the second pass (42 x 2 = 84)', () => {
    const [ks, kh] = [mk('KS', { seal: 'encore' }), mk('KH')];
    const res = score(blindRun(), [ks, kh]);
    deq(totals(res), { chips: 42, mult: 2, total: 84 });
    expectSteps(res, [
      { source: 'card', uid: ks.uid, kind: 'chips', amount: 10, via: 'rank' },
      again(ks.uid),
      { source: 'card', uid: ks.uid, kind: 'chips', amount: 10, via: 'rank' },
      { source: 'card', uid: kh.uid, kind: 'chips', amount: 10, via: 'rank' },
    ]);
  });

  test('a retrigger repeats the rank, the Enhancement and the Edition (122 x 12 = 1464)', () => {
    const [ks, kh] = [mk('KS', { enhancement: 'punchy', edition: 'gloss', seal: 'encore' }), mk('KH')];
    const res = score(blindRun(), [ks, kh]);
    deq(totals(res), { chips: 122, mult: 12, total: 1464 });
    expectSteps(res, [
      { uid: ks.uid, kind: 'chips', amount: 10 },
      { uid: ks.uid, kind: 'mult', amount: 5 },
      { uid: ks.uid, kind: 'chips', amount: 40 },
      again(ks.uid),
      { uid: ks.uid, kind: 'chips', amount: 10 },
      { uid: ks.uid, kind: 'mult', amount: 5 },
      { uid: ks.uid, kind: 'chips', amount: 40 },
      { uid: kh.uid, kind: 'chips', amount: 10 },
    ]);
  });

  test('a retriggered Four-Color multiplies twice (42 x 5.12 = 215)', () => {
    const res = score(blindRun(), [mk('KS', { edition: 'fourcolor', seal: 'encore' }), mk('KH')]);
    deq(totals(res), { chips: 42, mult: 5.12, total: 215 });
  });

  test('a retrigger re-fires the Jokers\' on-card effects (78 x 2 = 156)', () => {
    const run = blindRun();
    const crown = addJ(run, 'papercrown');
    const [ks, kh] = [mk('KS', { seal: 'encore' }), mk('KH')];
    const res = score(run, [ks, kh]);
    deq(totals(res), { chips: 78, mult: 2, total: 156 });
    expectSteps(res, [
      { uid: ks.uid, kind: 'chips', amount: 10 },
      { uid: crown.uid, cardUid: ks.uid, kind: 'chips', amount: 12 },
      again(ks.uid),
      { uid: ks.uid, kind: 'chips', amount: 10 },
      { uid: crown.uid, cardUid: ks.uid, kind: 'chips', amount: 12 },
      { uid: kh.uid, kind: 'chips', amount: 10 },
      { uid: crown.uid, cardUid: kh.uid, kind: 'chips', amount: 12 },
    ]);
  });

  test('a held Spotlit card with an Encore Seal fires twice (32 x 8 = 256)', () => {
    const qd = mk('QD', { enhancement: 'spotlit', seal: 'encore' });
    const res = score(blindRun(), [mk('KS'), mk('KH')], [qd]);
    deq(totals(res), { chips: 32, mult: 8, total: 256 });
    const held = res.steps.filter((s) => s.source === 'held');
    deq(held.map((s) => pickKeys(s, ['uid', 'kind', 'amount', 'label', 'via'])), [
      { uid: qd.uid, kind: 'mult', amount: 3, label: held[0].label, via: 'enhancement' },
      { uid: qd.uid, kind: 'note', amount: 0, label: 'Encore!', via: 'retrigger' },
      { uid: qd.uid, kind: 'mult', amount: 3, label: held[2].label, via: 'enhancement' },
    ]);
  });

  test('a held card with an Encore Seal re-fires the Jokers\' on-held effects (42 x 2 = 84)', () => {
    const run = blindRun();
    addJ(run, 'paperclip');
    const res = score(run, [mk('KS'), mk('KH')], [mk('QD', { seal: 'encore' })]);
    deq(totals(res), { chips: 42, mult: 2, total: 84 });
    assert.equal(labelled(res, 'Encore!').length, 1);
  });

  test('a Vintage card with an Encore Seal grows twice in one hand (54 x 2 = 108)', () => {
    const ks = mk('KS', { enhancement: 'vintage', seal: 'encore' });
    const res = score(blindRun(), [ks, mk('KH')]);
    deq(totals(res), { chips: 54, mult: 2, total: 108 });
    const grown = res.grow.filter((g) => g.uid === ks.uid).reduce((s, g) => s + g.by, 0);
    assert.equal(grown, 8);
  });

  test('Cameo Seal: a played kicker scores too, the hand stays a Pair (37 x 2 = 74)', () => {
    const [ks, kh, five] = [mk('KS'), mk('KH'), mk('5D', { seal: 'cameo' })];
    const res = score(blindRun(), [ks, kh, five, mk('2C')]);
    assert.equal(res.handId, 'pair');
    deq(res.scoringUids, [ks.uid, kh.uid, five.uid]);
    deq(totals(res), { chips: 37, mult: 2, total: 74 });
  });

  test('Cameo cards keep their place in play order', () => {
    const [five, ks, kh] = [mk('5D', { seal: 'cameo' }), mk('KS'), mk('KH')];
    const res = score(blindRun(), [five, ks, kh]);
    deq(res.scoringUids, [five.uid, ks.uid, kh.uid]);
    assert.equal(res.steps[1].uid, five.uid, 'the Cameo card scores first');
  });

  test('Paid and Airmail Seals do nothing while scoring', () => {
    const res = score(blindRun(), [mk('KS', { seal: 'paid' }), mk('KH', { seal: 'airmail' })], [mk('2C', { seal: 'paid' })]);
    deq(totals(res), { chips: 32, mult: 2, total: 64 });
  });
});

describe('§2.4 scoring order: Joker Editions', () => {
  test('Gloss Joker: +40 Chips just before its own effect (87 x 5 = 435)', () => {
    const run = blindRun();
    const j = addJ(run, 'jinglejester', 0, 'gloss');
    const res = score(run, [mk('KS'), mk('KH')]);
    deq(totals(res), { chips: 87, mult: 5, total: 435 });
    deq(res.steps.filter((s) => s.source === 'joker').map((s) => pickKeys(s, ['uid', 'kind', 'amount', 'via'])), [
      { uid: j.uid, kind: 'chips', amount: 40, via: 'edition' },
      { uid: j.uid, kind: 'chips', amount: 15, via: 'joker' },
      { uid: j.uid, kind: 'mult', amount: 3, via: 'joker' },
    ]);
    assert.equal(res.steps.find((s) => s.via === 'edition').edition, 'gloss');
  });

  test('Ben-Day Joker: +8 Mult just before its own effect (47 x 13 = 611)', () => {
    const run = blindRun();
    const j = addJ(run, 'jinglejester', 0, 'benday');
    const res = score(run, [mk('KS'), mk('KH')]);
    deq(totals(res), { chips: 47, mult: 13, total: 611 });
    deq(res.steps.filter((s) => s.source === 'joker').map((s) => pickKeys(s, ['uid', 'kind', 'amount', 'via'])), [
      { uid: j.uid, kind: 'mult', amount: 8, via: 'edition' },
      { uid: j.uid, kind: 'chips', amount: 15, via: 'joker' },
      { uid: j.uid, kind: 'mult', amount: 3, via: 'joker' },
    ]);
  });

  test('Four-Color Joker: x1.6 Mult just after its own effect (47 x 8 = 376)', () => {
    const run = blindRun();
    const j = addJ(run, 'jinglejester', 0, 'fourcolor');
    const res = score(run, [mk('KS'), mk('KH')]);
    deq(totals(res), { chips: 47, mult: 8, total: 376 });
    deq(res.steps.filter((s) => s.source === 'joker').map((s) => pickKeys(s, ['uid', 'kind', 'amount', 'via'])), [
      { uid: j.uid, kind: 'chips', amount: 15, via: 'joker' },
      { uid: j.uid, kind: 'mult', amount: 3, via: 'joker' },
      { uid: j.uid, kind: 'xmult', amount: 1.6, via: 'edition' },
    ]);
  });

  test('Joker Edition steps fire even when the Joker\'s own effect gives nothing', () => {
    const run = blindRun();
    addJ(run, 'congaline', 0, 'fourcolor'); // x1.5 only on a Straight
    deq(totals(score(run, [mk('KS'), mk('KH')])), { chips: 32, mult: 3.2, total: 102 });
    const run2 = blindRun();
    addJ(run2, 'pipsqueak', 0, 'gloss'); // +45 only with 2 or fewer cards played
    deq(totals(score(run2, [mk('KS'), mk('KH'), mk('KD')])), { chips: 102, mult: 3, total: 306 });
  });

  test('an Inverted Joker has no scoring step (47 x 5 = 235)', () => {
    const run = blindRun();
    addJ(run, 'jinglejester', 0, 'inverted');
    const res = score(run, [mk('KS'), mk('KH')]);
    deq(totals(res), { chips: 47, mult: 5, total: 235 });
    assert.equal(res.steps.filter((s) => s.via === 'edition').length, 0);
  });

  test('Jokers fire left to right, each with its own Edition (124 x 22.5 = 2790)', () => {
    const run = blindRun();
    const a = addJ(run, 'jinglejester', 0, 'benday');
    const l = addJ(run, 'congaline', 0, 'gloss');
    const res = score(run, ['5S', '6H', '7D', '8C', '9S'].map((c) => mk(c)));
    assert.equal(res.handId, 'straight');
    deq(totals(res), { chips: 124, mult: 22.5, total: 2790 });
    deq(res.steps.filter((s) => s.source === 'joker').map((s) => [s.uid, s.kind, s.amount]), [
      [a.uid, 'mult', 8], [a.uid, 'chips', 15], [a.uid, 'mult', 3], [l.uid, 'chips', 40], [l.uid, 'xmult', 1.5],
    ]);
  });
});

// ================================================================== §3.4 the v2 charms as Jokers (v2 numbers)
describe('§3.4 the 27 kept Jokers score with their v2 numbers', () => {
  const KK = () => [mk('KS'), mk('KH')];
  const withJ = (ids, setup) => {
    const run = blindRun();
    const js = ids.map((id) => addJ(run, id));
    if (setup) setup(run, js);
    return run;
  };

  test('jinglejester: +15 Chips and +3 Mult (47 x 5 = 235)', () => {
    deq(totals(score(withJ(['jinglejester']), KK())), { chips: 47, mult: 5, total: 235 });
  });

  test('pipsqueak: +45 Chips with 2 or fewer cards played, counting every played card', () => {
    deq(totals(score(withJ(['pipsqueak']), KK())), { chips: 77, mult: 2, total: 154 });
    deq(totals(score(withJ(['pipsqueak']), [mk('KS'), mk('KH'), mk('2C')])), { chips: 32, mult: 2, total: 64 });
  });

  test('papercrown: scored face cards give +12 Chips', () => {
    deq(totals(score(withJ(['papercrown']), KK())), { chips: 56, mult: 2, total: 112 });
    deq(totals(score(withJ(['papercrown']), [mk('5S'), mk('5H')])), { chips: 22, mult: 2, total: 44 });
  });

  test('paperclip: each card held in hand gives +5 Chips', () => {
    deq(totals(score(withJ(['paperclip']), KK(), [mk('2C'), mk('3C'), mk('4D')])), { chips: 47, mult: 2, total: 94 });
  });

  test('redhanded: each held Heart or Diamond gives +2 Mult; a held Scribbled card counts', () => {
    const held = [mk('QH'), mk('QD'), mk('QS', { enhancement: 'scribbled' }), mk('QC')];
    deq(totals(score(withJ(['redhanded']), KK(), held)), { chips: 32, mult: 8, total: 256 });
  });

  test('congaline: x1.5 Mult on a Straight (69 x 6 = 414)', () => {
    const res = score(withJ(['congaline']), ['5S', '6H', '7D', '8C', '9S'].map((c) => mk(c)));
    deq(totals(res), { chips: 69, mult: 6, total: 414 });
  });

  test('bigtop: x2.5 Mult on a Full House (84 x 10 = 840)', () => {
    const res = score(withJ(['bigtop']), ['KS', 'KH', 'KD', '5S', '5H'].map((c) => mk(c)));
    deq(totals(res), { chips: 84, mult: 10, total: 840 });
  });

  test('openingact: the first scored card gives +20 Chips and +2 Mult (52 x 4 = 208)', () => {
    deq(totals(score(withJ(['openingact']), KK())), { chips: 52, mult: 4, total: 208 });
  });

  test('finalbow: the last scored card gives x1.5 Mult (32 x 3 = 96)', () => {
    deq(totals(score(withJ(['finalbow']), KK())), { chips: 32, mult: 3, total: 96 });
  });

  test('sableknave: each scored Spade gives x1.1 Mult; a Scribbled card counts as a Spade', () => {
    deq(totals(score(withJ(['sableknave']), KK())), { chips: 32, mult: 2.2, total: 70 });
    deq(totals(score(withJ(['sableknave']), [mk('KS'), mk('KH', { enhancement: 'scribbled' })])), { chips: 42, mult: 2.42, total: 101 });
  });

  test('§2.4: Mult is rounded to 6 decimals after every operation (sableknave on a Spade Flush: 71 x 6.44204 = 457)', () => {
    const res = score(withJ(['sableknave']), ['2S', '5S', '9S', 'KS', '7S'].map((c) => mk(c)));
    assert.equal(res.handId, 'flush');
    deq(totals(res), { chips: 71, mult: 6.44204, total: 457 });
  });

  test('oldstager: each scored card gives +2 Chips per Ante', () => {
    deq(totals(score(withJ(['oldstager']), KK())), { chips: 36, mult: 2, total: 72 });
    deq(totals(score(withJ(['oldstager'], (run) => { run.ante = 3; }), KK())), { chips: 44, mult: 2, total: 88 });
  });

  test('doubleact: +4 Mult for each pair of matching ranks among scored cards', () => {
    deq(totals(score(withJ(['doubleact']), KK())), { chips: 32, mult: 6, total: 192 });
    deq(totals(score(withJ(['doubleact']), ['9S', '9D', '4H', '4C'].map((c) => mk(c)))), { chips: 48, mult: 10, total: 480 });
  });

  test('pinwheel: +3 Mult per different suit among scored cards; a Scribbled card counts as all four', () => {
    deq(totals(score(withJ(['pinwheel']), KK())), { chips: 32, mult: 8, total: 256 });
    deq(totals(score(withJ(['pinwheel']), [mk('KS', { enhancement: 'scribbled' }), mk('KH')])), { chips: 42, mult: 14, total: 588 });
  });

  test('emptyseats: +2 Mult per empty Joker slot; an Inverted Joker leaves its slot empty', () => {
    deq(totals(score(withJ(['emptyseats']), KK())), { chips: 32, mult: 10, total: 320 });
    const run = blindRun();
    addJ(run, 'emptyseats');
    addJ(run, 'jinglejester', 0, 'inverted');
    deq(totals(score(run, KK())), { chips: 47, mult: 13, total: 611 });
    deq(totals(score(withJ(['emptyseats', 'jinglejester']), KK())), { chips: 47, mult: 11, total: 517 });
  });

  test('moneybags: +1 Mult for every $4 you hold', () => {
    deq(totals(score(withJ(['moneybags'], (run) => { run.money = 4; }), KK())), { chips: 32, mult: 3, total: 96 });
    deq(totals(score(withJ(['moneybags'], (run) => { run.money = 13; }), KK())), { chips: 32, mult: 5, total: 160 });
  });

  test('partyhorn: +8 Mult on the first hand of each Blind only', () => {
    deq(totals(score(withJ(['partyhorn']), KK())), { chips: 32, mult: 10, total: 320 });
    deq(totals(score(withJ(['partyhorn'], (run) => { run.blind.handsPlayed = 1; }), KK())), { chips: 32, mult: 2, total: 64 });
  });

  test('gingerbreadfool: starts at +60 Chips (v2 state.chips)', () => {
    const run = withJ(['gingerbreadfool']);
    assert.equal(run.jokers[0].state.chips, 60);
    deq(totals(score(run, KK())), { chips: 92, mult: 2, total: 184 });
  });

  test('tallyowl: +1 Mult for every 4 hands played this run, before this hand', () => {
    deq(totals(score(withJ(['tallyowl'], (run) => { run.stats.handsPlayed = 9; }), KK())), { chips: 32, mult: 4, total: 128 });
  });

  // Balance 2026-11-23 (Jokers, engine fix): every 2 cards discarded (was every card)
  test('chimneysweep: +1 Mult for every 2 cards discarded this Blind', () => {
    deq(totals(score(withJ(['chimneysweep'], (run) => { run.blind.cardsDiscarded = 3; }), KK())), { chips: 32, mult: 3, total: 96 });
    deq(totals(score(withJ(['chimneysweep'], (run) => { run.blind.cardsDiscarded = 4; }), KK())), { chips: 32, mult: 4, total: 128 });
  });

  test('magpie: gives the Chips it has gathered (v2 state.chips)', () => {
    deq(totals(score(withJ(['magpie'], (run, [j]) => { j.state.chips = 20; }), KK())), { chips: 52, mult: 2, total: 104 });
  });

  test('magpie gathers +2 Chips for every card you discard', () => {
    const run = withJ(['magpie']);
    discard(run, run.blind.hand.slice(0, 3));
    assert.equal(run.jokers[0].state.chips, 6);
  });

  test('goldtooth: scored Aces give +$1 each', () => {
    const res = score(withJ(['goldtooth']), [mk('AS'), mk('AH')]);
    deq(res.steps.filter((s) => s.kind === 'money').map((s) => s.amount), [1, 1]);
    deq(totals(res), { chips: 34, mult: 2, total: 68 });
  });

  test('fortunecookie: scored cards of the marked rank give +$2 (v2 state.rank)', () => {
    const res = score(withJ(['fortunecookie'], (run, [j]) => { j.state.rank = 13; }), KK());
    deq(res.steps.filter((s) => s.kind === 'money').map((s) => s.amount), [2, 2]);
  });

  test('pokerface and dragontamer: their xMult (v2 state.x); no step while x is 1', () => {
    const g = withJ(['pokerface']);
    assert.equal(score(g, KK()).steps.filter((s) => s.source === 'joker').length, 0);
    g.jokers[0].state.x = 1.5;
    deq(totals(score(g, KK())), { chips: 32, mult: 3, total: 96 });
    deq(totals(score(withJ(['dragontamer'], (run, [j]) => { j.state.x = 2; }), KK())), { chips: 32, mult: 4, total: 128 });
  });

  test('clearing a Blind: gingerbreadfool loses 15 Chips and pokerface (no discards) gains x0.25', () => {
    const run = mkRun();
    addJ(run, 'gingerbreadfool');
    addJ(run, 'pokerface');
    begin(run);
    clearBlind(run);
    deq(run.jokers.map((j) => [j.id, j.id === 'gingerbreadfool' ? j.state.chips : j.state.x]), [['gingerbreadfool', 45], ['pokerface', 1.25]]);
  });

  test('clearing a Boss Blind: dragontamer gains x0.5', () => {
    const run = mkRun();
    addJ(run, 'dragontamer');
    begin(run, { blindIndex: 2, boss: 'heckler' });
    clearBlind(run);
    assert.equal(run.jokers[0].state.x, 1.5);
  });

  test('lamplighter: scored Hearts with no Enhancement become Punchy after the hand', () => {
    const run = blindRun();
    addJ(run, 'lamplighter');
    const [plainHeart, inkedHeart, ks, heldHeart] = setHand(run, ['KH', { code: 'KH', enhancement: 'inked' }, 'KS', 'JH']);
    play(run, [plainHeart, inkedHeart, ks]);
    deq(
      [plainHeart, inkedHeart, ks, heldHeart].map((u) => cardRef(run, u).enhancement),
      ['punchy', 'inked', null, null],
    );
  });
});

// ================================================================== §3.5 Boss Blinds
describe('§3.5 Boss Blinds', () => {
  test('Antes 1-7 roll distinct Boss Blinds whose fromAnte fits; Ante 8 is always The Big Finish', () => {
    const union = new Set();
    for (let i = 0; i < 60; i++) {
      const run = mkRun({ seed: seedN(1000 + i) });
      const seen = new Set();
      for (let a = 1; a <= 7; a++) {
        const b = run.bosses[a];
        assert.ok(BOSS_IDS.includes(b) && b !== 'bigfinish', `Ante ${a}: ${b}`);
        assert.ok(BOSSES[b] <= a, `${b} (from Ante ${BOSSES[b]}) at Ante ${a}`);
        seen.add(b);
        union.add(b);
      }
      assert.equal(seen.size, 7, 'distinct');
      assert.equal(run.bosses[8], 'bigfinish');
    }
    assert.equal(union.size, 14, 'every Boss Blind besides the finale shows up');
  });

  test('The Heckler boos the highest-ranked scoring card, the leftmost on ties (22 x 2 = 44)', () => {
    const run = bossRun('heckler');
    const [ks, kh] = [mk('KS'), mk('KH')];
    const res = score(run, [ks, kh]);
    assert.equal(res.booedUid, ks.uid);
    deq(totals(res), { chips: 22, mult: 2, total: 44 });
    assert.equal(res.steps.filter((s) => s.source === 'card' && s.uid === ks.uid && s.kind !== 'note').length, 0, 'the booed card gives nothing');
    assert.equal(labelled(res, 'Booed').length, 1);
  });

  test('The Heckler: the highest rank is booed, not the leftmost card', () => {
    const run = bossRun('heckler');
    const cards = ['4H', '9S', '4C', '9D'].map((c) => mk(c));
    const res = score(run, cards);
    assert.equal(res.booedUid, cards[1].uid);
    deq(totals(res), { chips: 39, mult: 2, total: 78 });
  });

  test('The Heckler: a booed card skips its retriggers and the Jokers\' on-card effects', () => {
    const run = mkRun();
    addJ(run, 'openingact');
    begin(run, { blindIndex: 2, boss: 'heckler' });
    const res = score(run, [mk('KS', { seal: 'encore' }), mk('KH')]);
    deq(totals(res), { chips: 22, mult: 2, total: 44 });
    assert.equal(labelled(res, 'Encore!').length, 0);
  });

  test('The Heckler can boo a Cameo card', () => {
    const run = bossRun('heckler');
    const ad = mk('AD', { seal: 'cameo' });
    const res = score(run, [mk('KS'), mk('KH'), ad]);
    assert.equal(res.booedUid, ad.uid);
    deq(totals(res), { chips: 32, mult: 2, total: 64 });
  });

  test('The Lid caps Mult at 12 after the Joker Editions (47 x 12 = 564)', () => {
    const run = mkRun();
    addJ(run, 'jinglejester', 0, 'benday');
    begin(run, { blindIndex: 2, boss: 'lid' });
    const res = score(run, [mk('KS'), mk('KH')]);
    deq(totals(res), { chips: 47, mult: 12, total: 564 });
    const cap = labelled(res, 'Capped at 12');
    assert.equal(cap.length, 1);
    assert.equal(cap[0].source, 'boss');
    assert.equal(res.steps[res.steps.length - 1].label, 'Capped at 12', 'the cap is the last step');
    assert.equal(labelled(score(run, [mk('5S'), mk('5H')]), 'Capped at 12').length, 1);
    assert.equal(labelled(score(bossRun('lid'), [mk('KS'), mk('KH')]), 'Capped at 12').length, 0, 'no step under the cap');
  });

  // Balance 2026-11-23 (Jokers, engine fix): "Mult can't go above 12, plus 6 for each Ante after Ante 3."
  test('The Lid at Ante 5 caps Mult at 24 (12 + 2 x 6), and Blind select says so', () => {
    const run = mkRun();
    run.levels.pair = 40; // Pair Mult 2 + 39 = 41
    run.ante = 5;
    run.blindIndex = 2;
    run.bosses[5] = 'lid';
    assert.ok(Engine.currentBlindInfo(run).boss.text.endsWith('(now 24).'), Engine.currentBlindInfo(run).boss.text);
    begin(run);
    const res = score(run, [mk('KS'), mk('KH')]);
    deq([res.mult, labelled(res, 'Capped at 24').length], [24, 1]);
  });

  test('The Shuffler sweeps the whole hand back, shuffles and draws a fresh hand after every hand', () => {
    const run = bossRun('shuffler');
    const before = run.blind.hand.slice();
    const played = before.slice(0, 2);
    play(run, played);
    const b = run.blind;
    assert.equal(b.hand.length, 8);
    deq(sorted(b.discardPile), sorted(played));
    deq(sorted([...b.hand, ...b.draw, ...b.discardPile]), sorted(run.cards.map((c) => c.uid)));
    assert.ok(!before.slice(2).every((u) => b.hand.includes(u)), 'the held cards went back into the deck');
  });

  test('The Fade: before each hand after the first, the score drops by 15% (floor)', () => {
    const run = bossRun('fade');
    play(run, setHand(run, ['KS', 'KH']));
    assert.equal(run.blind.score, 64);
    play(run, setHand(run, ['QS', 'QH']));
    assert.equal(run.blind.score, Math.floor(64 * 0.85) + 64);
  });

  test('The Tollbooth: each discard costs $2, and discarding is blocked below $2', () => {
    const run = bossRun('tollbooth');
    run.money = 5;
    assert.equal(discard(run, [run.blind.hand[0]]).cost, 2);
    assert.equal(run.money, 3);
    discard(run, [run.blind.hand[0]]);
    assert.equal(run.money, 1);
    bad(Engine.discard(run, [run.blind.hand[0]]), 'discard with $1', 'The Tollbooth: each discard costs $2.');
    assert.equal(run.blind.discardsLeft, 1);
  });

  // Balance 2026-11-23 (Jokers, engine fix): "You can play at most 4 cards per hand." (was 3)
  test('The Squeeze: at most 4 cards per hand', () => {
    const run = bossRun('squeeze');
    bad(Engine.playHand(run, run.blind.hand.slice(0, 5)), 'play 5 cards', 'The Squeeze: play at most 4 cards.');
    assert.equal(run.blind.handsLeft, 4);
    play(run, run.blind.hand.slice(0, 4));
  });

  test('The Squeeze does not shrink the hand (the old one-card-fewer rule is gone)', () => {
    assert.equal(bossRun('squeeze').blind.hand.length, 8);
  });

  test('The Wash-Out: Enhancements do nothing', () => {
    const run = bossRun('washout');
    deq(totals(score(run, [mk('KS', { enhancement: 'inked' }), mk('KH', { enhancement: 'popout' })])), { chips: 32, mult: 2, total: 64 });
    deq(totals(score(run, [mk('KS'), mk('KH')], [mk('QD', { enhancement: 'spotlit' })])), { chips: 32, mult: 2, total: 64 });
  });

  test('The Wash-Out switches off Scribbled\'s any-suit rule and its +10 Chips', () => {
    const run = bossRun('washout');
    const res = score(run, [mk('2H'), mk('5H'), mk('9H'), mk('KH'), mk('7S', { enhancement: 'scribbled' })]);
    assert.equal(res.handId, 'high');
    deq(totals(res), { chips: 15, mult: 1, total: 15 });
  });

  test('The Wash-Out stops Vintage growth', () => {
    const res = score(bossRun('washout'), [mk('KS', { enhancement: 'vintage', grow: 8 }), mk('KH')]);
    deq(totals(res), { chips: 32, mult: 2, total: 64 });
    deq(res.grow || [], []);
  });

  test('The Wet Blanket: the Joker leftmost at the start is off for the whole Blind, its Edition included', () => {
    const run = mkRun();
    const a = addJ(run, 'jinglejester', 0, 'gloss');
    const c = addJ(run, 'papercrown');
    begin(run, { blindIndex: 2, boss: 'wetblanket' });
    assert.equal(run.blind.wetJoker, a.uid);
    deq(totals(score(run, [mk('KS'), mk('KH')])), { chips: 56, mult: 2, total: 112 });
    ok(Engine.reorderJokers(run, [c.uid, a.uid]), 'reorderJokers');
    deq(totals(score(run, [mk('KS'), mk('KH')])), { chips: 56, mult: 2, total: 112 }, 'still the same Joker after reordering');
  });

  test('The Grudge halves Mult on the most-played hand; Pair when nothing was played', () => {
    const run = bossRun('grudge');
    assert.equal(run.blind.grudgeHand, 'pair');
    const res = score(run, [mk('KS'), mk('KH')]);
    deq(totals(res), { chips: 32, mult: 1, total: 32 });
    assert.equal(labelled(res, 'Half Mult').length, 1);
    deq(totals(score(run, [mk('KS'), mk('2H')])), { chips: 15, mult: 1, total: 15 }, 'High Card is not marked');
  });

  test('The Grudge marks the most-played hand at the start, ties going to the stronger hand', () => {
    const r1 = mkRun();
    Object.assign(r1.plays, { flush: 2, pair: 1 });
    begin(r1, { blindIndex: 2, boss: 'grudge' });
    assert.equal(r1.blind.grudgeHand, 'flush');
    deq(totals(score(r1, [mk('KS'), mk('KH')])), { chips: 32, mult: 2, total: 64 });
    const r2 = mkRun();
    Object.assign(r2.plays, { flush: 2, pair: 2 });
    begin(r2, { blindIndex: 2, boss: 'grudge' });
    assert.equal(r2.blind.grudgeHand, 'flush');
  });

  test('The Censor: playing-card Editions and Seals do nothing; Inverted cards score Chips as normal', () => {
    const run = bossRun('censor');
    deq(totals(score(run, [mk('KS', { edition: 'gloss', seal: 'encore' }), mk('KH', { edition: 'benday' })])), { chips: 32, mult: 2, total: 64 });
    deq(totals(score(run, [mk('KS', { edition: 'inverted' }), mk('KH', { edition: 'fourcolor' })])), { chips: 32, mult: 2, total: 64 });
    deq(totals(score(run, [mk('KS'), mk('KH')], [mk('QD', { enhancement: 'spotlit', seal: 'encore' })])), { chips: 32, mult: 5, total: 160 });
  });

  test('The Censor: a Cameo card does not join the scoring cards', () => {
    const res = score(bossRun('censor'), [mk('KS'), mk('KH'), mk('5D', { seal: 'cameo' })]);
    assert.equal(res.scoringUids.length, 2);
    deq(totals(res), { chips: 32, mult: 2, total: 64 });
  });

  test('The Censor: Joker Editions give no steps, and an Inverted Joker still takes no slot', () => {
    const run = mkRun();
    addJ(run, 'jinglejester', 0, 'gloss');
    for (const id of ['papercrown', 'pipsqueak', 'emptyseats', 'partyhorn']) addJ(run, id);
    addJ(run, 'paperclip', 0, 'inverted');
    begin(run, { blindIndex: 2, boss: 'censor' });
    assert.equal(Engine.jokerSlotsUsed(run), 5);
    const res = score(run, [mk('5S'), mk('5H'), mk('2C')]);
    assert.equal(res.steps.filter((s) => s.via === 'edition').length, 0);
  });

  test('The Warm-Up: the Blind\'s first hand scores half Mult, later hands in full', () => {
    const run = bossRun('warmup');
    const first = play(run, setHand(run, ['KS', 'KH']));
    deq(totals(first.result), { chips: 32, mult: 1, total: 32 });
    assert.equal(labelled(first.result, 'Warm-up: half').length, 1);
    const second = play(run, setHand(run, ['QS', 'QH']));
    deq(totals(second.result), { chips: 32, mult: 2, total: 64 });
  });

  test('The Fumble: each discard also drops 1 random card you did not select', () => {
    const run = bossRun('fumble');
    const before = run.blind.hand.slice();
    const r = discard(run, [before[0]]);
    assert.ok(before.includes(r.extra) && r.extra !== before[0], 'the extra card came from the hand');
    deq(sorted(run.blind.discardPile), sorted([before[0], r.extra]));
    assert.equal(run.blind.hand.length, 8);
    assert.equal(run.blind.discardsLeft, 2);
    assert.equal(run.blind.cardsDiscarded, 2);
  });

  test('The Short Fuse: 2 fewer hands (at least 1), target 25% lower', () => {
    const run = bossRun('shortfuse');
    deq([run.blind.handsLeft, run.blind.target], [2, 450]);
    const low = mkRun();
    low.hands = 2;
    begin(low, { blindIndex: 2, boss: 'shortfuse' });
    assert.equal(low.blind.handsLeft, 1);
  });

  test('The Big Finish: Ante 8, target 135000, and the hand is shuffled back after every hand', () => {
    const run = mkRun();
    begin(run, { ante: 8, blindIndex: 2 });
    deq([run.blind.boss, run.blind.target], ['bigfinish', 135000]);
    const before = run.blind.hand.slice();
    play(run, before.slice(0, 2));
    assert.ok(!before.slice(2).every((u) => run.blind.hand.includes(u)), 'the held cards went back into the deck');
    assert.equal(run.blind.hand.length, 8);
  });
});

// ================================================================== §2.3 playing and discarding
describe('§2.3 playing a hand', () => {
  test('a hand scores, uses a hand, sends the cards to the discard pile and draws back up', () => {
    const run = blindRun();
    const [a, b] = setHand(run, ['KS', 'KH']);
    const r = play(run, [a, b]);
    assert.equal(r.result.total, 64);
    deq(pickKeys(run.blind, ['score', 'handsLeft', 'handsPlayed']), { score: 64, handsLeft: 3, handsPlayed: 1 });
    deq(sorted(run.blind.discardPile), sorted([a, b]));
    assert.equal(run.blind.hand.length, 8);
    assert.equal(run.blind.draw.length, 42);
    assert.equal(r.drawn.length, 2);
    assert.equal(run.plays.pair, 1);
    assert.equal(run.stats.handsPlayed, 1);
    deq([r.cleared, r.lost], [false, false]);
  });

  test('playing 0 or 6 cards, or a card not in hand, fails without changing the Blind', () => {
    const run = blindRun();
    bad(Engine.playHand(run, []), 'play nothing');
    bad(Engine.playHand(run, run.blind.hand.slice(0, 6)), 'play 6');
    bad(Engine.playHand(run, [run.blind.draw[0]]), 'play a card from the draw pile');
    assert.equal(run.blind.handsLeft, 4);
  });

  test('the Blind is cleared the moment the score reaches the target: cash-out opens', () => {
    const run = blindRun();
    const r = clearBlind(run);
    deq([r.cleared, r.lost], [true, false]);
    assert.equal(run.phase, 'cashout');
    assert.ok(run.cashout && Array.isArray(run.cashout.lines));
    assert.equal(run.blindStatus['1-0'], 'cleared');
    assert.equal(run.stats.blindsCleared, 1);
  });

  test('Game Over when the last hand ends below the target', () => {
    const run = blindRun();
    run.blind.handsLeft = 1;
    const r = play(run, [run.blind.hand[0]]);
    deq([r.cleared, r.lost], [false, true]);
    assert.equal(run.phase, 'gameover');
  });

  test('You win! when Ante 8\'s Boss Blind is beaten; Endless mode then goes on to cash-out', () => {
    const run = mkRun();
    bad(Engine.goEndless(run), 'goEndless before winning', "The run isn't won yet.");
    begin(run, { ante: 8, blindIndex: 2 });
    clearBlind(run);
    assert.equal(run.phase, 'win');
    assert.equal(run.won, true);
    ok(Engine.goEndless(run), 'goEndless');
    deq([run.endless, run.phase], [true, 'cashout']);
  });

  test('Endless mode: Ante 9 rolls a Boss Blind other than The Big Finish, new Tags, and grows targets x1.75', () => {
    for (let i = 0; i < 12; i++) {
      const run = mkRun({ seed: seedN(4000 + i) });
      begin(run, { ante: 8, blindIndex: 2 });
      clearBlind(run);
      ok(Engine.goEndless(run));
      ok(Engine.collect(run));
      ok(Engine.leaveShop(run));
      deq(pickKeys(run, ['ante', 'blindIndex', 'phase']), { ante: 9, blindIndex: 0, phase: 'blind-select' });
      assert.ok(BOSS_IDS.includes(run.bosses[9]) && run.bosses[9] !== 'bigfinish', `endless boss ${run.bosses[9]}`);
      assert.ok(TAG_IDS.includes(run.tags['9-0']) && TAG_IDS.includes(run.tags['9-1']));
      const t = plain(Engine.blindsForAnte(run)).map((b) => b.target);
      deq(t.slice(0, 2), [78800, 118200]);
      assert.equal(t[2], run.bosses[9] === 'shortfuse' ? 118200 : 157600);
    }
  });

  test('leaving the Shop moves to the next Blind, and after the Boss Blind to the next Ante', () => {
    const run = shopRun();
    ok(Engine.leaveShop(run));
    deq(pickKeys(run, ['ante', 'blindIndex', 'phase']), { ante: 1, blindIndex: 1, phase: 'blind-select' });
    run.blindIndex = 2;
    toShop(run);
    ok(Engine.leaveShop(run));
    deq(pickKeys(run, ['ante', 'blindIndex', 'phase']), { ante: 2, blindIndex: 0, phase: 'blind-select' });
  });
});

describe('§2.3 discarding', () => {
  test('a discard uses a discard, sends the cards to the discard pile and draws back up', () => {
    const run = blindRun();
    const two = run.blind.hand.slice(0, 2);
    const r = discard(run, two);
    deq(pickKeys(run.blind, ['discardsLeft', 'cardsDiscarded']), { discardsLeft: 2, cardsDiscarded: 2 });
    deq(sorted(run.blind.discardPile), sorted(two));
    assert.equal(run.blind.hand.length, 8);
    assert.equal(r.drawn.length, 2);
    assert.equal(r.extra ?? null, null);
    assert.equal(run.stats.cardsDiscarded, 2);
  });

  test('no discards left: a sentence, nothing moves', () => {
    const run = blindRun();
    run.blind.discardsLeft = 0;
    bad(Engine.discard(run, [run.blind.hand[0]]), 'discard with none left', 'No discards left this Blind.');
    assert.equal(run.blind.discardPile.length, 0);
  });

  test('Crumpled: +$1 for each Crumpled card discarded', () => {
    const run = blindRun();
    const [a, b, c] = setHand(run, [{ code: 'KS', enhancement: 'crumpled' }, { code: 'QS', enhancement: 'crumpled' }, 'JS']);
    const before = run.money;
    const r = discard(run, [a, b, c]);
    assert.equal(r.money, 2);
    assert.equal(run.money, before + 2);
  });

  test('Crumpled pays nothing under The Wash-Out', () => {
    const run = bossRun('washout');
    const [a] = setHand(run, [{ code: 'KS', enhancement: 'crumpled' }]);
    const before = run.money;
    discard(run, [a]);
    assert.equal(run.money, before);
  });

  test('The Fumble\'s extra card is a discard in every way: a Crumpled extra card pays too', () => {
    const run = bossRun('fumble');
    setWholeHand(run, Array.from({ length: 8 }, () => ({ code: '9S', enhancement: 'crumpled' })));
    const before = run.money;
    discard(run, [run.blind.hand[0]]);
    assert.equal(run.money, before + 2);
  });

  test('Airmail Seal: discarding it creates the Planet card of your most-played hand', () => {
    const run = blindRun();
    Object.assign(run.plays, { flush: 3, pair: 1 });
    const [a] = setHand(run, [{ code: 'KS', seal: 'airmail' }]);
    const r = discard(run, [a]);
    assert.equal(r.created.length, 1);
    deq(run.consumables.map((c) => [c.kind, c.id]), [['planet', 'swoosh']]);
    assert.equal(run.consumables[0].uid, r.created[0]);
  });

  test('Airmail Seal needs a free consumable slot', () => {
    const run = blindRun();
    give(run, 'tarot', 'inkpot');
    give(run, 'tarot', 'crayon');
    const [a] = setHand(run, [{ code: 'KS', seal: 'airmail' }]);
    const r = discard(run, [a]);
    deq(r.created, []);
    assert.equal(run.consumables.length, 2);
  });

  test('Airmail Seal does nothing under The Censor', () => {
    const run = bossRun('censor');
    const [a] = setHand(run, [{ code: 'KS', seal: 'airmail' }]);
    discard(run, [a]);
    assert.equal(run.consumables.length, 0);
  });

  // The plan changed v2 Fishhook's number here (content check): not the first discard of each Blind,
  // but one discard of 1 or 2 cards per Blind is free.
  test('sleightofhand: once per Blind, a discard of 1 or 2 cards is free (was: the first discard)', () => {
    const run = blindRun();
    addJ(run, 'sleightofhand');
    const big = discard(run, run.blind.hand.slice(0, 3));
    deq([big.free, run.blind.discardsLeft], [false, 2], 'the first discard, of 3 cards, is not free');
    const first = discard(run, [run.blind.hand[0]]);
    deq([first.free, run.blind.discardsLeft], [true, 2]);
    const second = discard(run, [run.blind.hand[0]]);
    deq([second.free, run.blind.discardsLeft], [false, 1]);
  });
});

// ================================================================== §2.7 cash-out
describe('§2.7 cash-out', () => {
  const cashout = (run) => plain(run.cashout);

  test('Small Blind with $4 after one hand: reward $3 and $3 for hands to spare; $0 lines are left out', () => {
    const run = blindRun();
    clearBlind(run, { money: 4 });
    deq(cashout(run), { lines: [{ label: blindName(0), amount: 3 }, { label: 'Hands to spare', amount: 3 }], total: 6 });
  });

  test('all lines in order: reward, hands to spare, Paid Seals, interest, Joker lines', () => {
    const run = blindRun();
    addJ(run, 'couponclipper');
    const [k] = setHand(run, ['KS', { code: '2C', seal: 'paid' }, { code: '3C', seal: 'paid' }]);
    run.blind.score = run.blind.target - 1;
    run.money = 23;
    play(run, [k]);
    assert.equal(run.phase, 'cashout');
    deq(cashout(run), {
      lines: [
        { label: blindName(0), amount: 3 },
        { label: 'Hands to spare', amount: 3 },
        { label: 'Paid Seals', amount: 4 },
        { label: 'Interest', amount: 4 },
        { label: jokerRow('couponclipper').name, amount: 3 },
      ],
      total: 17,
    });
  });

  test('a Paid Seal pays only while it is in hand when the Blind is beaten', () => {
    const run = blindRun();
    const [paid] = setHand(run, [{ code: 'KS', seal: 'paid' }]);
    run.blind.score = run.blind.target - 1;
    play(run, [paid]);
    assert.equal(cashout(run).lines.find((l) => l.label === 'Paid Seals'), undefined);
  });

  test('Paid Seals pay nothing under The Censor', () => {
    const run = bossRun('censor');
    const [k] = setHand(run, ['KS', { code: '2C', seal: 'paid' }]);
    run.blind.score = run.blind.target - 1;
    play(run, [k]);
    assert.equal(cashout(run).lines.find((l) => l.label === 'Paid Seals'), undefined);
  });

  test('interest: $1 per full $5 held, capped at $5', () => {
    const interest = (money, opts = {}, vouchers = []) => {
      const run = blindRun(opts);
      run.vouchers.push(...vouchers);
      run.money = money;
      const preview = Engine.interestPreview(run);
      clearBlind(run, { money });
      const line = cashout(run).lines.find((l) => l.label === 'Interest');
      assert.equal(line ? line.amount : 0, preview, 'interestPreview matches the cash-out');
      return preview;
    };
    deq([interest(4), interest(5), interest(23), interest(40)], [0, 1, 4, 5]);
    assert.equal(interest(40, {}, ['savingsbond']), 8, 'Savings Bond: cap +$3');
    assert.equal(interest(40, { stake: 'yikes' }), 3, 'Yikes Stake caps at $3');
    assert.equal(interest(40, { stake: 'yikes' }, ['savingsbond']), 6, 'Yikes caps at $3 before Savings Bond');
  });

  test('Big and Boss Blind rewards are $4 and $5; Mint Condition pays $1 less', () => {
    const reward = (blindIndex, opts) => {
      const run = mkRun(opts);
      begin(run, { blindIndex, boss: 'heckler' });
      clearBlind(run, { money: 0 });
      return cashout(run).lines[0];
    };
    deq(reward(1), { label: blindName(1), amount: 4 });
    deq(reward(2), { label: blindName(2), amount: 5 });
    deq(reward(0, { deckId: 'mintcondition' }), { label: blindName(0), amount: 2 });
  });

  test('collect adds the total and opens the Shop', () => {
    const run = blindRun();
    clearBlind(run, { money: 4 });
    const r = ok(Engine.collect(run));
    assert.equal(r.total, 6);
    assert.equal(run.money, 10);
    assert.equal(run.phase, 'shop');
    assert.equal(run.blind, null);
    assert.ok(run.shop && Array.isArray(run.shop.items));
  });
});

// ================================================================== §2.8 the Shop
// Rerolls a Shop n times and returns every card-slot item seen, first roll included.
function sampleCards(run, n) {
  run.money = 1e9;
  const seen = [];
  const take = () => seen.push(...shopItems(run, ASSUMED.slot.card));
  take();
  for (let i = 0; i < n; i++) {
    ok(Engine.reroll(run), 'reroll');
    take();
  }
  return seen;
}
// Opens `count` first Shops (one per seed) and returns their pack items.
function samplePacks(count, opts = {}, { ante = 1, vouchers = [] } = {}) {
  const packs = [];
  for (let i = 0; i < count; i++) {
    const run = mkRun({ seed: seedN(20000 + i), ...opts });
    run.vouchers.push(...vouchers);
    run.ante = ante;
    toShop(run);
    packs.push(...shopItems(run, ASSUMED.slot.pack));
  }
  return packs;
}
const share = (list, pred) => list.filter(pred).length / list.length;
const jokerPrice = (it) => jokerRow(it.id).cost + (it.edition ? EDITION_SURCHARGE[it.edition] : 0);

describe('§2.8 Shop slots, kinds and odds', () => {
  test('a Shop has 2 card slots, 2 Booster Pack slots and 1 Voucher slot', () => {
    const run = shopRun();
    deq([shopItems(run, ASSUMED.slot.card).length, shopItems(run, ASSUMED.slot.pack).length, shopItems(run, ASSUMED.slot.voucher).length], [2, 2, 1]);
    for (const it of shopItems(run)) assert.equal(it.sold, false);
  });

  test('Spinner Rack: +1 card slot and +1 Booster Pack slot', () => {
    const run = blindRun();
    run.vouchers.push('spinnerrack');
    toShop(run);
    deq([shopItems(run, ASSUMED.slot.card).length, shopItems(run, ASSUMED.slot.pack).length], [3, 3]);
  });

  const base = memo(() => {
    const run = shopRun({ seed: 'SHOPAAAA' });
    return sampleCards(run, 1500);
  });

  test('card slots roll Joker 70 / Tarot 15 / Planet 15, and never a Spectral card by default', () => {
    const items = base();
    between(share(items, (x) => x.kind === 'joker'), 0.65, 0.75, 'Joker share');
    between(share(items, (x) => x.kind === 'tarot'), 0.11, 0.19, 'Tarot share');
    between(share(items, (x) => x.kind === 'planet'), 0.11, 0.19, 'Planet share');
    assert.equal(items.filter((x) => x.kind === 'spectral').length, 0);
    for (const x of items) assert.ok(['joker', 'tarot', 'planet'].includes(x.kind), x.kind);
  });

  test('card items carry valid ids', () => {
    for (const x of base()) {
      if (x.kind === 'joker') assert.ok(jokerRow(x.id), x.id);
      if (x.kind === 'tarot') assert.ok(TAROT_IDS.includes(x.id), x.id);
      if (x.kind === 'planet') assert.ok(PLANET_IDS.includes(x.id), x.id);
    }
  });

  test('Joker rarity odds: common 70, uncommon 25, rare 5, never Legendary', () => {
    const jokers = base().filter((x) => x.kind === 'joker');
    const rarity = (x) => jokerRow(x.id).rarity;
    between(share(jokers, (x) => rarity(x) === 'common'), 0.63, 0.77, 'common');
    between(share(jokers, (x) => rarity(x) === 'uncommon'), 0.19, 0.31, 'uncommon');
    between(share(jokers, (x) => rarity(x) === 'rare'), 0.025, 0.085, 'rare');
    assert.equal(jokers.filter((x) => rarity(x) === 'legendary').length, 0);
  });

  test('Joker Editions: Gloss 3%, Ben-Day 2%, Four-Color 0.5%, Inverted 0.5% (6% in all)', () => {
    const jokers = base().filter((x) => x.kind === 'joker');
    for (const x of jokers) assert.ok(x.edition == null || EDITION_IDS.includes(x.edition), String(x.edition));
    between(share(jokers, (x) => x.edition), 0.035, 0.09, 'any Edition');
    between(share(jokers, (x) => x.edition === 'gloss'), 0.012, 0.05, 'Gloss');
    assert.ok(share(jokers, (x) => x.edition === 'gloss') > share(jokers, (x) => x.edition === 'fourcolor'), 'Gloss is commoner than Four-Color');
  });

  test('only Jokers roll Editions in the card slots; consumables have none', () => {
    for (const x of base()) if (x.kind !== 'joker') assert.equal(x.edition ?? null, null);
  });

  test('prices: Joker = listed cost + Edition surcharge; Tarot $3; Planet $3', () => {
    for (const x of base()) {
      if (x.kind === 'joker') assert.equal(x.price, jokerPrice(x), `${x.id} ${x.edition}`);
      if (x.kind === 'tarot' || x.kind === 'planet') assert.equal(x.price, 3, x.id);
    }
  });

  test('the Shop never offers a Joker you own, nor the same Joker twice at once', () => {
    const run = blindRun({ seed: 'SHOPOWNS' });
    addJ(run, 'jinglejester');
    addJ(run, 'paperclip');
    toShop(run);
    run.money = 1e9;
    for (let i = 0; i < 400; i++) {
      const ids = shopItems(run, ASSUMED.slot.card).filter((x) => x.kind === 'joker').map((x) => x.id);
      assert.ok(!ids.includes('jinglejester') && !ids.includes('paperclip'), 'an owned Joker was offered');
      assert.equal(new Set(ids).size, ids.length, 'a Joker was offered twice');
      ok(Engine.reroll(run));
    }
  });

  test('an empty rarity pool rolls another rarity', () => {
    const run = blindRun({ seed: 'SHOPRARE' });
    for (const id of jokerIdsOfRarity('rare')) addJ(run, id, 0, 'inverted');
    toShop(run);
    const items = sampleCards(run, 400);
    const jokers = items.filter((x) => x.kind === 'joker');
    assert.equal(jokers.filter((x) => jokerRow(x.id).rarity === 'rare').length, 0);
    between(jokers.length / items.length, 0.62, 0.78, 'Jokers keep their share');
  });

  test('when every Joker is owned, the Joker rolls become Planet cards', () => {
    const run = blindRun({ seed: 'SHOPFULL' });
    for (const r of rows('JOKERS')) if (r.rarity !== 'legendary') addJ(run, r.id, 0, 'inverted');
    toShop(run);
    const items = sampleCards(run, 200);
    assert.equal(items.filter((x) => x.kind === 'joker').length, 0);
    assert.ok(share(items, (x) => x.kind === 'planet') > 0.7, 'Planet cards fill the Joker share');
  });

  test('Slick Paper triples Joker Edition odds (18% in all)', () => {
    const run = blindRun({ seed: 'SHOPSLIK' });
    run.vouchers.push('slickpaper');
    toShop(run);
    between(share(sampleCards(run, 1500).filter((x) => x.kind === 'joker'), (x) => x.edition), 0.135, 0.23, 'any Edition with Slick Paper');
  });

  test('Halftone Deck doubles Joker Edition odds (12%); with Slick Paper x6 (36%)', () => {
    const h = shopRun({ deckId: 'halftone', seed: 'SHOPHALF' });
    between(share(sampleCards(h, 1500).filter((x) => x.kind === 'joker'), (x) => x.edition), 0.085, 0.16, 'Halftone');
    const both = blindRun({ deckId: 'halftone', seed: 'SHOPBOTH' });
    both.vouchers.push('slickpaper');
    toShop(both);
    between(share(sampleCards(both, 1500).filter((x) => x.kind === 'joker'), (x) => x.edition), 0.3, 0.42, 'Halftone + Slick Paper');
  });

  test('Spooky Deck: Spectral cards join the card roll at weight 5, at $4, never Origin Story', () => {
    const items = sampleCards(shopRun({ deckId: 'spooky', seed: 'SHOPSPOO' }), 1500);
    const spectral = items.filter((x) => x.kind === 'spectral');
    between(spectral.length / items.length, 0.025, 0.075, 'Spectral share');
    for (const x of spectral) {
      assert.ok(SPECTRAL_IDS.includes(x.id) && x.id !== 'originstory', x.id);
      assert.equal(x.price, 4);
    }
  });

  test('Mail-Order Ghost: Spectral cards can appear in the Shop', () => {
    const run = blindRun({ seed: 'SHOPMAIL' });
    run.vouchers.push('mailorderghost');
    toShop(run);
    const items = sampleCards(run, 600);
    assert.ok(items.some((x) => x.kind === 'spectral'));
    assert.ok(!items.some((x) => x.id === 'originstory'));
  });

  test('Sketchbook Deck: Tarot cards cost $2', () => {
    const items = sampleCards(shopRun({ deckId: 'sketchbook', seed: 'SHOPSKET' }), 300);
    const tarots = items.filter((x) => x.kind === 'tarot');
    assert.ok(tarots.length > 0);
    for (const x of tarots) assert.equal(x.price, 2);
  });
});

describe('§2.8 Booster Pack slots', () => {
  const ante1 = memo(() => samplePacks(400));

  test('pack items are valid pack ids at their table price', () => {
    for (const p of ante1()) {
      assert.ok(PACKS[p.id], `pack id ${p.id}`);
      assert.equal(p.price, PACKS[p.id][4], p.id);
      assert.equal(p.size, PACKS[p.id][1], p.id);
    }
  });

  test('no Ghost Pack in Ante 1', () => {
    assert.equal(ante1().filter((p) => PACKS[p.id][0] === 'ghost').length, 0);
  });

  test('pack kinds roll Card 32 / Tarot 24 / Planet 24 / Joker 14', () => {
    const kind = (p) => PACKS[p.id][0];
    between(share(ante1(), (p) => kind(p) === 'card'), 0.27, 0.41, 'Card');
    between(share(ante1(), (p) => kind(p) === 'tarot'), 0.19, 0.32, 'Tarot');
    between(share(ante1(), (p) => kind(p) === 'planet'), 0.19, 0.32, 'Planet');
    between(share(ante1(), (p) => kind(p) === 'joker'), 0.1, 0.2, 'Joker');
  });

  test('pack sizes roll Normal 70 / Jumbo 22 / Mega 8', () => {
    const size = (p) => PACKS[p.id][1];
    between(share(ante1(), (p) => size(p) === 'normal'), 0.63, 0.77, 'Normal');
    between(share(ante1(), (p) => size(p) === 'jumbo'), 0.16, 0.28, 'Jumbo');
    between(share(ante1(), (p) => size(p) === 'mega'), 0.04, 0.13, 'Mega');
  });

  test('Ghost Packs appear from Ante 2 at weight 6, and twice as often on the Spooky Deck', () => {
    const ghost = (list) => share(list, (p) => PACKS[p.id][0] === 'ghost');
    between(ghost(samplePacks(400, {}, { ante: 2 })), 0.025, 0.1, 'Ghost share at Ante 2');
    between(ghost(samplePacks(400, { deckId: 'spooky' }, { ante: 2 })), 0.065, 0.17, 'Ghost share on the Spooky Deck');
  });
});

describe('§2.8 prices, discounts and rerolls', () => {
  test('Dollar-Off Coupon: everything costs $1 less (minimum $1)', () => {
    const run = blindRun({ seed: 'SHOPDOLL' });
    run.vouchers.push('dollaroff');
    toShop(run);
    for (const x of shopItems(run, ASSUMED.slot.pack)) assert.equal(x.price, PACKS[x.id][4] - 1, x.id);
    for (const x of shopItems(run, ASSUMED.slot.voucher)) assert.equal(x.price, 9);
    for (const x of sampleCards(run, 300)) {
      if (x.kind === 'joker') assert.equal(x.price, Math.max(1, jokerPrice(x) - 1), x.id);
      else assert.equal(x.price, 2, x.id);
    }
  });

  test('Sale Tag: next Shop has Jokers 25% off (rounded, minimum $1) and one free reroll', () => {
    const run = mkRun({ seed: 'SHOPSALE' });
    skipWith(run, 'sale');
    assert.ok(run.pending.sale, 'pending.sale is set');
    toShop(run);
    assert.equal(run.shop.freeRerolls, 1);
    const items = sampleCards(run, 300);
    for (const x of items) {
      if (x.kind === 'joker') assert.equal(x.price, Math.max(1, Math.round(jokerPrice(x) * 0.75)), `${x.id} ${x.edition}`);
      if (x.kind === 'tarot' || x.kind === 'planet') assert.equal(x.price, 3, 'only Jokers are discounted');
    }
    assert.ok(!run.pending.sale, 'the Sale Tag is used up by this Shop');
  });

  test('Sale Tag then Dollar-Off Coupon: the coupon applies last', () => {
    const run = mkRun({ seed: 'SHOPBOTH' });
    run.vouchers.push('dollaroff');
    skipWith(run, 'sale');
    toShop(run);
    for (const x of sampleCards(run, 200)) {
      if (x.kind === 'joker') assert.equal(x.price, Math.max(1, Math.max(1, Math.round(jokerPrice(x) * 0.75)) - 1), x.id);
    }
  });

  test('a reroll costs $5, then $1 more after each paid reroll, and re-rolls only the card slots', () => {
    const run = shopRun({ seed: 'SHOPROLL' });
    run.money = 100;
    const packs = plain(shopItems(run, ASSUMED.slot.pack));
    const voucher = plain(shopItems(run, ASSUMED.slot.voucher));
    deq([ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost], [5, 6, 7]);
    assert.equal(run.money, 100 - 18);
    deq(shopItems(run, ASSUMED.slot.pack), packs);
    deq(shopItems(run, ASSUMED.slot.voucher), voucher);
    assert.equal(run.stats.rerolls, 3);
  });

  test('the reroll price resets on the next Shop visit', () => {
    const run = shopRun({ seed: 'SHOPRSET' });
    run.money = 100;
    ok(Engine.reroll(run));
    ok(Engine.reroll(run));
    ok(Engine.leaveShop(run));
    toShop(run);
    run.money = 100;
    assert.equal(ok(Engine.reroll(run)).cost, 5);
  });

  test('a reroll needs the money', () => {
    const run = shopRun();
    run.money = 4;
    bad(Engine.reroll(run), 'reroll with $4', 'Not enough money.');
  });

  // content check (content-plan.json): Second Look keeps the reroll price flat (flatRerolls).
  test('Second Look: rerolls in the Shop do not go up in price ($5, $5, $5); no free reroll', () => {
    const run = blindRun({ seed: 'SHOPLOOK' });
    run.vouchers.push('secondlook');
    toShop(run);
    run.money = 20;
    assert.equal(run.shop.freeRerolls, 0);
    deq([ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost], [5, 5, 5]);
    assert.equal(run.money, 5);
  });

  test('Second Look with the Sale Tag: the Sale Tag reroll is free, then every paid reroll is $5', () => {
    const run = mkRun({ seed: 'SHOPFREE' });
    run.vouchers.push('secondlook');
    skipWith(run, 'sale');
    toShop(run);
    run.money = 20;
    assert.equal(run.shop.freeRerolls, 1);
    deq([ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost], [0, 5, 5]);
  });
});

// ================================================================== §2.8 buying
describe('§2.8 buying', () => {
  test('buying a Joker: pay the price; it joins the rack with paid = price; the slot shows sold', () => {
    const run = shopRun();
    const i = forceCard(run, { kind: 'joker', id: 'jinglejester', price: 4 });
    run.money = 10;
    const r = ok(Engine.buy(run, i));
    assert.equal(r.opened, false);
    assert.equal(run.money, 6);
    deq(pickKeys(run.jokers.find((j) => j.id === 'jinglejester'), ['id', 'paid', 'edition']), { id: 'jinglejester', paid: 4, edition: null });
    assert.match(run.jokers[0].uid, /^h\d+$/);
    assert.equal(run.shop.items[i].sold, true);
    bad(Engine.buy(run, i), 'buy a sold slot');
  });

  test('a bought Joker keeps its Edition, and paid includes the surcharge', () => {
    const run = shopRun();
    const i = forceCard(run, { kind: 'joker', id: 'jinglejester', edition: 'benday', price: 7 });
    run.money = 10;
    ok(Engine.buy(run, i));
    deq(pickKeys(run.jokers[0], ['id', 'paid', 'edition']), { id: 'jinglejester', paid: 7, edition: 'benday' });
  });

  test('buying needs the money', () => {
    const run = shopRun();
    const i = forceCard(run, { kind: 'joker', id: 'jinglejester', price: 4 });
    run.money = 3;
    bad(Engine.canBuy(run, i), 'canBuy with $3', 'Not enough money.');
    bad(Engine.buy(run, i), 'buy with $3', 'Not enough money.');
    assert.equal(run.jokers.length, 0);
  });

  test('a Joker needs a free Joker slot, unless it is Inverted', () => {
    const run = shopRun();
    for (const id of ['pipsqueak', 'emptyseats', 'partyhorn', 'tallyowl', 'doubleact']) addJ(run, id);
    run.money = 50;
    const i = forceCard(run, { kind: 'joker', id: 'jinglejester', price: 4 });
    bad(Engine.buy(run, i), 'buy a 6th Joker', 'Your Joker slots are full.');
    Object.assign(run.shop.items[i], { edition: 'inverted', price: 8 });
    ok(Engine.canBuy(run, i), 'canBuy an Inverted Joker');
    ok(Engine.buy(run, i), 'buy an Inverted Joker');
    deq([run.jokers.length, Engine.jokerSlotsUsed(run)], [6, 5]);
  });

  test('a Tarot card goes into a consumable slot, which must be free', () => {
    const run = shopRun();
    run.money = 50;
    const i = forceCard(run, { kind: 'tarot', id: 'inkpot', price: 3 });
    ok(Engine.buy(run, i));
    deq(run.consumables.map((c) => [c.kind, c.id]), [['tarot', 'inkpot']]);
    give(run, 'planet', 'blip');
    const j = shopItems(run, ASSUMED.slot.card)[1].index;
    Object.assign(run.shop.items[j], { kind: 'planet', id: 'boing', price: 3, sold: false, edition: null });
    bad(Engine.buy(run, j), 'buy with full consumable slots', 'Your consumable slots are full.');
  });

  test('a Voucher applies at once: Extra Panel gives a 6th Joker slot', () => {
    const run = shopRun();
    const money = run.money;
    buyVoucher(run, 'extrapanel');
    assert.equal(run.money, money);
    assert.ok(run.vouchers.includes('extrapanel'));
    assert.equal(run.jokerSlots, 6);
  });

  test('one Voucher per Ante: it stays on offer through the Ante until bought, and is never one you own', () => {
    const run = shopRun({ seed: 'VOUCHAAA' });
    const first = shopItems(run, ASSUMED.slot.voucher)[0];
    assert.ok(VOUCHER_IDS.includes(first.id));
    assert.equal(first.price, 10);
    ok(Engine.leaveShop(run));
    toShop(run);
    assert.equal(shopItems(run, ASSUMED.slot.voucher)[0].id, first.id, 'same Voucher at the next visit');
    run.money += 10;
    ok(Engine.buy(run, shopItems(run, ASSUMED.slot.voucher)[0].index));
    ok(Engine.leaveShop(run));
    run.blindIndex = 2;
    toShop(run);
    assert.equal(shopItems(run, ASSUMED.slot.voucher).filter((x) => !x.sold).length, 0, 'bought: none left this Ante');
    ok(Engine.leaveShop(run));
    toShop(run);
    assert.equal(run.ante, 2);
    const next = shopItems(run, ASSUMED.slot.voucher)[0];
    assert.ok(next && !run.vouchers.includes(next.id), 'a new Voucher you do not own');
  });

  test('§2.12: everything offered in the Shop is discovered', () => {
    const run = shopRun({ seed: 'DISCOVER' });
    for (const x of shopItems(run, ASSUMED.slot.card)) {
      const list = x.kind === 'joker' ? run.discovered.jokers : run.discovered.consumables;
      assert.ok(list.includes(x.id), `${x.kind} ${x.id} discovered`);
    }
    assert.ok(run.discovered.vouchers.includes(shopItems(run, ASSUMED.slot.voucher)[0].id));
  });
});

// ================================================================== selling (owner decision: half the cost)
describe('§2.8 selling (owner decision: every Joker sells for half its cost, rounded down, minimum $1)', () => {
  test('Jokers sell for floor(cost / 2), gained free or not', () => {
    for (const [id, expected] of [['jinglejester', 2], ['tallyowl', 2], ['sableknave', 3], ['finalbow', 3], ['bigtop', 4], ['dragontamer', 4]]) {
      const run = mkRun();
      const j = addJ(run, id, 0);
      assert.equal(Engine.jokerSellValue(run, j.uid), expected, `${id} value`);
      const money = run.money;
      deq(ok(Engine.sellJoker(run, j.uid)).money, expected);
      assert.equal(run.money, money + expected, `${id} sold`);
      assert.equal(run.jokers.length, 0);
    }
  });

  test('a bought Joker sells by the same rule', () => {
    const run = shopRun();
    const i = forceCard(run, { kind: 'joker', id: 'sableknave', price: 6 });
    run.money = 10;
    ok(Engine.buy(run, i));
    assert.equal(Engine.jokerSellValue(run, run.jokers[0].uid), 3);
  });

  // ASSUMED (rule): "its cost" is what the Shop asks for it, so it includes the Edition surcharge.
  test('an Edition Joker sells for half of its cost including the surcharge', () => {
    const run = mkRun();
    const g = addJ(run, 'jinglejester', 0, 'gloss');
    const n = addJ(run, 'jinglejester', 0, 'inverted');
    deq([Engine.jokerSellValue(run, g.uid), Engine.jokerSellValue(run, n.uid)], [3, 4]);
  });

  // Rule from content/systems-v3.json decision 'jokersell' (the owner's cost basis applied to
  // this Deck): on the Mint Condition Deck a Joker sells for its full cost, max(1, cost).
  test('Mint Condition Deck: a Joker sells for its full cost, bought or free', () => {
    const run = shopRun({ deckId: 'mintcondition' });
    const i = forceCard(run, { kind: 'joker', id: 'sableknave', price: 6 });
    run.money = 10;
    ok(Engine.buy(run, i));
    assert.equal(Engine.jokerSellValue(run, run.jokers[0].uid), 6);
    const free = addJ(run, 'bigtop', 0);
    const gloss = addJ(run, 'jinglejester', 0, 'gloss');
    deq([Engine.jokerSellValue(run, free.uid), Engine.jokerSellValue(run, gloss.uid)], [8, 6]);
  });

  test('consumables sell for $1 (Tarot, Planet) and $2 (Spectral)', () => {
    const run = mkRun();
    const t = give(run, 'tarot', 'inkpot');
    const p = give(run, 'planet', 'blip');
    deq([ok(Engine.sellConsumable(run, t)).money, ok(Engine.sellConsumable(run, p)).money], [1, 1]);
    const s = give(run, 'spectral', 'wormhole');
    assert.equal(ok(Engine.sellConsumable(run, s)).money, 2);
    assert.equal(run.consumables.length, 0);
  });

  test('selling works at Blind select, between hands, in the Shop and while a pack is open', () => {
    const run = mkRun();
    for (const id of ['jinglejester', 'pipsqueak', 'emptyseats', 'partyhorn']) addJ(run, id);
    ok(Engine.sellJoker(run, run.jokers[0].uid), 'at Blind select');
    begin(run);
    ok(Engine.sellJoker(run, run.jokers[0].uid), 'during a Blind');
    clearBlind(run);
    ok(Engine.collect(run));
    ok(Engine.sellJoker(run, run.jokers[0].uid), 'in the Shop');
    openPack(run, 'jokernormal');
    ok(Engine.sellJoker(run, run.jokers[0].uid), 'while a pack is open');
    assert.equal(run.jokers.length, 0);
  });

  test('selling a Joker you do not have fails with a sentence', () => {
    bad(Engine.sellJoker(mkRun(), 'h999'), 'sell a missing Joker', "That Joker isn't in your rack.");
  });
});

// ================================================================== Joker slots, queries
describe('Joker slots and the v3 queries', () => {
  test('jokerSlotsUsed counts only Jokers without the Inverted Edition', () => {
    const run = mkRun();
    addJ(run, 'jinglejester');
    addJ(run, 'pipsqueak', 0, 'inverted');
    addJ(run, 'emptyseats', 0, 'gloss');
    assert.equal(Engine.jokerSlotsUsed(run), 2);
  });

  test('addJoker returns null when the slots are full, but an Inverted Joker still fits', () => {
    const run = mkRun();
    for (const id of ['jinglejester', 'pipsqueak', 'emptyseats', 'partyhorn', 'tallyowl']) addJ(run, id);
    assert.equal(Engine.addJoker(run, 'doubleact', 0, null), null);
    const inv = Engine.addJoker(run, 'doubleact', 0, 'inverted');
    assert.ok(inv && inv.uid);
    deq(pickKeys(inv, ['id', 'paid', 'edition']), { id: 'doubleact', paid: 0, edition: 'inverted' });
  });

  test('a Joker instance is { uid, id, state, paid, edition }', () => {
    const j = plain(addJ(mkRun(), 'gingerbreadfool', 4, 'gloss'));
    deq(pickKeys(j, ['id', 'paid', 'edition']), { id: 'gingerbreadfool', paid: 4, edition: 'gloss' });
    assert.match(j.uid, /^h\d+$/);
    assert.equal(typeof j.state, 'object');
  });

  test('jokerText gives the Joker text plus live values', () => {
    const run = mkRun();
    const j = addJ(run, 'gingerbreadfool');
    const text = Engine.jokerText(run, j.uid);
    assert.equal(typeof text, 'string');
    assert.ok(text.includes('60'), text);
  });

  test('cardText names the Enhancement, Edition and Seal of a card', () => {
    const run = mkRun();
    Object.assign(run.cards[0], { enhancement: 'inked', edition: 'gloss', seal: 'encore' });
    const t = Engine.cardText(run, run.cards[0].uid);
    const text = Array.isArray(t) ? t.join('\n') : String(t);
    for (const [table, id] of [['ENHANCEMENTS', 'inked'], ['EDITIONS', 'gloss'], ['SEALS', 'encore']]) {
      assert.ok(text.includes(rowById(table, id).name), `${id} named in ${text}`);
    }
  });

  test('editionInfo and sealInfo describe the content rows', () => {
    for (const id of EDITION_IDS) assert.equal(Engine.editionInfo(id).id, id);
    for (const id of SEAL_IDS) assert.equal(Engine.sealInfo(id).id, id);
    assert.equal(Engine.editionInfo('nope') ?? null, null);
  });
});

// ================================================================== §2.9 Booster Packs
describe('§2.9 Booster Packs: kinds, sizes and the pick flow', () => {
  const optionKind = { card: 'card', tarot: 'tarot', planet: 'planet', joker: 'joker', ghost: 'spectral' };

  test('every pack opens with its designed number of cards and picks, remembering it came from the Shop', () => {
    for (const id of PACK_IDS) {
      const run = shopRun({ seed: 'PACKSIZE' });
      openPack(run, id);
      const [kind, size, shown, picks] = PACKS[id];
      deq(pickKeys(run.pack, ['id', 'kind', 'size', 'picksLeft', 'returnTo']), { id, kind, size, picksLeft: picks, returnTo: 'shop' }, id);
      assert.equal(run.pack.options.length, shown, `${id} shows ${shown}`);
      for (const o of run.pack.options) {
        if (o.id === 'originstory') continue; // a Tarot or Ghost Pack slot may roll Origin Story
        assert.equal(o.kind, optionKind[kind], `${id} option kind`);
      }
    }
  });

  test('Bonus Pages: every pack shows 1 more card', () => {
    for (const id of ['cardnormal', 'tarotjumbo', 'planetmega', 'jokernormal', 'ghostmega']) {
      const run = blindRun({ seed: 'PACKBONU' });
      run.vouchers.push('bonuspages');
      toShop(run);
      openPack(run, id);
      assert.equal(run.pack.options.length, PACKS[id][2] + 1, id);
      assert.equal(run.pack.picksLeft, PACKS[id][3], `${id} picks are unchanged`);
    }
  });

  test('Card Pack: the picked card joins the deck for good and the pack closes', () => {
    const run = shopRun();
    openPack(run, 'cardnormal');
    const option = plain(run.pack.options[0]);
    assert.equal(option.kind, 'card');
    assert.ok(option.card && option.card.rank >= 2 && option.card.rank <= 14 && 'SHDC'.includes(option.card.suit));
    const before = new Set(run.cards.map((c) => c.uid));
    const r = pick(run, 0);
    deq(pickKeys(r, ['kind', 'picksLeft', 'closed']), { kind: 'card', picksLeft: 0, closed: true });
    const added = run.cards.filter((c) => !before.has(c.uid));
    assert.equal(added.length, 1);
    const keys = ['rank', 'suit', 'enhancement', 'edition', 'seal'];
    deq(pickKeys(added[0], keys), pickKeys({ enhancement: null, edition: null, seal: null, ...option.card }, keys));
    deq([run.phase, run.pack], ['shop', null]);
  });

  test('Mega packs: two picks, one at a time; the pack closes when they are used up', () => {
    const run = shopRun();
    openPack(run, 'cardmega');
    const first = pick(run, 0);
    deq([first.picksLeft, first.closed, run.phase], [1, false, 'pack']);
    const second = pick(run, 1);
    deq([second.picksLeft, second.closed, run.phase], [0, true, 'shop']);
    assert.equal(run.cards.length, 54);
  });

  test('packSkip closes the pack and returns where it was opened, gaining nothing', () => {
    const run = shopRun();
    openPack(run, 'cardjumbo');
    ok(Engine.packSkip(run), 'packSkip');
    deq([run.phase, run.pack, run.cards.length], ['shop', null, 52]);
  });

  test('pack errors: no pack open, a bad option index', () => {
    const run = shopRun();
    bad(Engine.packPick(run, 0, []), 'pick with no pack', 'No Booster Pack is open.');
    bad(Engine.packSkip(run), 'skip with no pack', 'No Booster Pack is open.');
    openPack(run, 'cardnormal');
    bad(Engine.packPick(run, 9, []), 'pick option 9', "Pick one of the pack's cards.");
    assert.equal(run.phase, 'pack');
  });

  test('Planet Pack: distinct Planet cards; a pick levels its hand at once, even with full consumable slots', () => {
    const run = shopRun();
    give(run, 'tarot', 'inkpot');
    give(run, 'tarot', 'crayon');
    openPack(run, 'planetjumbo');
    const ids = run.pack.options.map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, 'distinct');
    for (const id of ids) assert.ok(PLANET_IDS.includes(id), id);
    const hand = PLANETS[ids[0]];
    pick(run, 0);
    assert.equal(run.levels[hand], 2);
    deq(run.consumables.map((c) => c.id), ['inkpot', 'crayon'], 'not stored');
  });

  // Owner decision: Tarot and Spectral picks are used at once on a hand dealt from the deck.
  // API ASSUMED: the dealt cards are run.pack.hand (uids); packPick(run, i, selectedUids).
  test('Tarot Pack: a hand of cards is dealt from the deck while the pack is open', () => {
    const run = shopRun();
    openPack(run, 'tarotnormal');
    const h = packHand(run);
    assert.equal(h.length, run.handSize);
    for (const u of h) assert.ok(cardRef(run, u), `${u} is a deck card`);
    assert.equal(new Set(h).size, h.length);
  });

  test('Tarot Pack: distinct Tarot cards (a slot may be Origin Story)', () => {
    const run = shopRun();
    openPack(run, 'tarotmega');
    const ids = run.pack.options.filter((o) => o.id !== 'originstory').map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.ok(TAROT_IDS.includes(id), id);
  });

  test('Tarot Pack: a picked Tarot is used at once on the selected dealt cards and never stored', () => {
    const run = shopRun();
    give(run, 'planet', 'blip');
    give(run, 'planet', 'boing');
    openPack(run, 'tarotnormal');
    run.pack.options[0] = { kind: 'tarot', id: 'inkpot' };
    const [a, b] = packHand(run);
    const r = pick(run, 0, [a, b]);
    assert.equal(r.closed, true);
    deq([cardRef(run, a).enhancement, cardRef(run, b).enhancement], ['inked', 'inked']);
    deq(run.consumables.map((c) => c.id), ['blip', 'boing'], 'the slots are untouched');
    deq([run.phase, run.pack, run.cards.length], ['shop', null, 52]);
  });

  test('Tarot Pack: a pick that needs selected cards fails without them, and the pack stays open', () => {
    const run = shopRun();
    openPack(run, 'tarotnormal');
    run.pack.options[0] = { kind: 'tarot', id: 'pricegun' };
    bad(Engine.packPick(run, 0, []), 'Price Gun with no card');
    bad(Engine.canPackPick(run, 0, []), 'canPackPick Price Gun with no card');
    bad(Engine.packPick(run, 0, packHand(run).slice(0, 2)), 'Price Gun with 2 cards');
    assert.equal(run.phase, 'pack');
    const [a] = packHand(run);
    pick(run, 0, [a]);
    assert.equal(cardRef(run, a).enhancement, 'dimestore');
  });

  test('Tarot Pack: a Tarot that needs no cards works at once (Paper Route pays $4 at Ante 1)', () => {
    const run = shopRun();
    openPack(run, 'tarotnormal');
    run.pack.options[0] = { kind: 'tarot', id: 'paperroute' };
    const money = run.money;
    pick(run, 0, []);
    assert.equal(run.money, money + 4);
    assert.equal(run.consumables.length, 0);
  });

  test('Ghost Pack: a picked Spectral card is used at once (Wormhole) and never stored', () => {
    const run = shopRun();
    openPack(run, 'ghostnormal');
    run.pack.options[0] = { kind: 'spectral', id: 'wormhole' };
    run.money = 9;
    pick(run, 0, []);
    for (const h of HAND_IDS) assert.equal(run.levels[h], 2, h);
    assert.equal(run.money, 5);
    assert.equal(run.consumables.length, 0);
  });

  test('Ghost Pack: a Spectral card that needs a card works on the dealt hand (Curtain Call)', () => {
    const run = shopRun();
    openPack(run, 'ghostnormal');
    run.pack.options[0] = { kind: 'spectral', id: 'curtaincall' };
    const [a] = packHand(run);
    pick(run, 0, [a]);
    assert.equal(cardRef(run, a).seal, 'encore');
    assert.equal(run.cards.length, 51, 'one other dealt card is destroyed');
  });

  test('Joker Pack: Jokers you do not own, never Legendary; a pick joins the rack free', () => {
    const run = shopRun({ seed: 'PACKJOKR' });
    addJ(run, 'jinglejester');
    openPack(run, 'jokermega');
    const ids = run.pack.options.map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const o of plain(run.pack.options)) {
      assert.equal(o.kind, 'joker');
      assert.ok(jokerRow(o.id) && o.id !== 'jinglejester' && jokerRow(o.id).rarity !== 'legendary', o.id);
      assert.ok(o.edition == null || EDITION_IDS.includes(o.edition));
    }
    const chosen = plain(run.pack.options[0]);
    pick(run, 0);
    const j = run.jokers.find((x) => x.id === chosen.id);
    deq(pickKeys(j, ['id', 'edition', 'paid']), { id: chosen.id, edition: chosen.edition ?? null, paid: 0 });
  });

  test('Joker Pack: a pick needs a free Joker slot unless the Joker is Inverted', () => {
    const run = shopRun();
    for (const id of ['pipsqueak', 'emptyseats', 'partyhorn', 'tallyowl', 'doubleact']) addJ(run, id);
    openPack(run, 'jokernormal');
    run.pack.options[0] = { kind: 'joker', id: 'jinglejester', edition: null };
    run.pack.options[1] = { kind: 'joker', id: 'sableknave', edition: 'inverted' };
    bad(Engine.canPackPick(run, 0, []), 'canPackPick with full slots', 'Your Joker slots are full.');
    bad(Engine.packPick(run, 0, []), 'pick with full slots', 'Your Joker slots are full.');
    pick(run, 1);
    assert.ok(jokerIds(run).includes('sableknave'));
  });

  test('a free Joker from a pack sells for half its cost (owner decision)', () => {
    const run = shopRun();
    openPack(run, 'jokernormal');
    run.pack.options[0] = { kind: 'joker', id: 'bigtop', edition: null };
    pick(run, 0);
    assert.equal(Engine.jokerSellValue(run, run.jokers.find((j) => j.id === 'bigtop').uid), 4);
  });
});

describe('§2.9 Card Pack and Ghost Pack contents (odds)', () => {
  // Grab Bag Tag opens a free Jumbo Card Pack (6 cards) at Blind select.
  const cardPackCards = (count, vouchers = []) => {
    const cards = [];
    for (let i = 0; i < count; i++) {
      const run = mkRun({ seed: seedN(30000 + i) });
      run.vouchers.push(...vouchers);
      skipWith(run, 'grabbag');
      for (const o of plain(run.pack.options)) cards.push(o.card);
    }
    return cards;
  };
  const plainPacks = memo(() => cardPackCards(300));

  test('Card Pack cards: an Enhancement 35% of the time, from all 8', () => {
    const cards = plainPacks();
    between(share(cards, (c) => c.enhancement), 0.29, 0.41, 'Enhancement share');
    for (const c of cards) assert.ok(c.enhancement == null || ENHANCEMENT_IDS.includes(c.enhancement));
    assert.equal(new Set(cards.map((c) => c.enhancement).filter(Boolean)).size, 8, 'every Enhancement shows up');
  });

  test('Card Pack cards: Gloss 4% / Ben-Day 3% / Four-Color 1%, never Inverted', () => {
    const cards = plainPacks();
    between(share(cards, (c) => c.edition), 0.05, 0.115, 'Edition share');
    assert.equal(cards.filter((c) => c.edition === 'inverted').length, 0);
  });

  test('Card Pack cards: a Seal 10% of the time, from all 4', () => {
    const cards = plainPacks();
    between(share(cards, (c) => c.seal), 0.065, 0.14, 'Seal share');
    assert.equal(new Set(cards.map((c) => c.seal).filter(Boolean)).size, 4);
  });

  test('Stamp Album: Card Pack cards get a Seal 40% of the time', () => {
    between(share(cardPackCards(200, ['stampalbum']), (c) => c.seal), 0.34, 0.46, 'Seal share with Stamp Album');
  });

  test('Slick Paper triples Card Pack Edition odds (24%), still never Inverted', () => {
    const cards = cardPackCards(200, ['slickpaper']);
    between(share(cards, (c) => c.edition), 0.19, 0.29, 'Edition share with Slick Paper');
    assert.equal(cards.filter((c) => c.edition === 'inverted').length, 0);
  });

  test('Tarot Pack slots are Origin Story 0.5% of the time', () => {
    let slots = 0;
    let origin = 0;
    for (let i = 0; i < 600; i++) {
      const run = shopRun({ seed: seedN(45000 + i) });
      openPack(run, 'tarotmega');
      for (const o of run.pack.options) {
        slots++;
        if (o.id === 'originstory') origin++;
        else assert.ok(TAROT_IDS.includes(o.id), o.id);
      }
    }
    between(origin / slots, 0.001, 0.0125, 'Origin Story share in Tarot Packs');
  });

  test('Ghost Pack slots roll Origin Story at 2%, otherwise distinct Spectral cards', () => {
    const slots = [];
    for (let i = 0; i < 600; i++) {
      const run = mkRun({ seed: seedN(40000 + i) });
      skipWith(run, 'ghost');
      const ids = run.pack.options.map((o) => o.id);
      for (const id of ids) assert.ok(SPECTRAL_IDS.includes(id), id);
      const others = ids.filter((id) => id !== 'originstory');
      assert.equal(new Set(others).size, others.length, 'distinct');
      slots.push(...ids);
    }
    between(share(slots, (id) => id === 'originstory'), 0.007, 0.04, 'Origin Story share');
  });
});

// ================================================================== §3.2 Tarot cards
describe('§3.2 Tarot cards', () => {
  test('consumableInfo gives each Tarot card its select range and where it can be used', () => {
    const run = mkRun();
    for (const id of TAROT_IDS) {
      const uid = give(run, 'tarot', id);
      const info = plain(Engine.consumableInfo(run, uid));
      deq(pickKeys(info, ['uid', 'kind', 'id', 'select', 'where']), { uid, kind: 'tarot', id, select: TAROTS[id][0], where: TAROTS[id][1] }, id);
      run.consumables = [];
    }
  });

  test('a Blind-only Tarot card cannot be used at Blind select or in the Shop', () => {
    const run = mkRun();
    const uid = give(run, 'tarot', 'overtime');
    bad(Engine.canUseConsumable(run, uid, []), 'Overtime at Blind select', 'Only usable during a Blind.');
    bad(Engine.useConsumable(run, uid, []), 'Overtime at Blind select', 'Only usable during a Blind.');
    assert.equal(run.consumables.length, 1);
  });

  for (const [id, [select, , enhancement]] of Object.entries(TAROTS).filter(([, v]) => v[2])) {
    test(`${id}: makes up to ${select[1]} selected card(s) ${enhancement}, and is used up`, () => {
      const run = blindRun();
      const uid = give(run, 'tarot', id);
      const chosen = run.blind.hand.slice(0, select[1]);
      const r = use(run, uid, chosen);
      assert.equal(r.effect.kind, 'tarot');
      assert.equal(r.effect.id, id);
      for (const u of chosen) assert.equal(cardRef(run, u).enhancement, enhancement, u);
      assert.equal(cardRef(run, run.blind.hand[select[1]]).enhancement, null, 'unselected cards are untouched');
      assert.equal(run.consumables.length, 0);
      assert.equal(run.stats.consumablesUsed, 1);
      bad(Engine.canUseConsumable(run, give(run, 'tarot', id), run.blind.hand.slice(0, select[1] + 1)), `${id} with too many cards`);
    });
  }

  test('a new Enhancement replaces the old one', () => {
    const run = blindRun();
    const [a] = setHand(run, [{ code: 'KS', enhancement: 'inked' }]);
    use(run, give(run, 'tarot', 'boxingglove'), [a]);
    assert.equal(cardRef(run, a).enhancement, 'punchy');
  });

  test('Back Issues makes a card Vintage with no stored Chips yet', () => {
    const run = blindRun();
    const [a] = setHand(run, ['KS']);
    use(run, give(run, 'tarot', 'backissues'), [a]);
    deq(pickKeys(cardRef(run, a), ['enhancement', 'grow']), { enhancement: 'vintage', grow: 0 });
  });

  test('Eraser destroys up to 2 selected cards for good, pays $1 each, and draws back up', () => {
    const run = blindRun();
    const two = run.blind.hand.slice(0, 2);
    const money = run.money;
    const r = use(run, give(run, 'tarot', 'eraser'), two);
    assert.equal(run.money, money + 2);
    assert.equal(run.cards.length, 50);
    for (const u of two) assert.equal(cardRef(run, u), null);
    deq(sorted(r.effect.destroyed || two), sorted(two));
    assert.equal(run.blind.hand.length, 8);
  });

  test('The Ladder raises up to 3 cards one rank; Aces stay Aces', () => {
    const run = blindRun();
    const cards = setHand(run, ['2S', '9H', 'AS']);
    use(run, give(run, 'tarot', 'ladder'), cards);
    deq(cards.map((u) => cardRef(run, u).rank), [3, 10, 14]);
  });

  test('Shrink Ray lowers up to 3 cards one rank; 2s stay 2s', () => {
    const run = blindRun();
    const cards = setHand(run, ['2S', '9H', 'AS']);
    use(run, give(run, 'tarot', 'shrinkray'), cards);
    deq(cards.map((u) => cardRef(run, u).rank), [2, 8, 13]);
  });

  test('Paint Bucket turns 2-3 selected cards into the suit of the leftmost one in hand order', () => {
    const run = blindRun();
    const cards = setHand(run, ['KH', '2S', '3D']);
    bad(Engine.canUseConsumable(run, give(run, 'tarot', 'paintbucket'), cards.slice(0, 1)), 'Paint Bucket with 1 card');
    use(run, run.consumables[0].uid, [cards[2], cards[1], cards[0]]);
    deq(cards.map((u) => cardRef(run, u).suit), ['H', 'H', 'H']);
  });

  test('Carbon Copy adds a copy (rank, suit, Enhancement, Edition, Seal and Vintage growth) into the draw pile', () => {
    const run = blindRun();
    const [a] = setHand(run, [{ code: 'QD', enhancement: 'vintage', edition: 'benday', seal: 'paid', grow: 12 }]);
    const before = new Set(run.cards.map((c) => c.uid));
    use(run, give(run, 'tarot', 'carboncopy'), [a]);
    const added = run.cards.filter((c) => !before.has(c.uid));
    assert.equal(added.length, 1);
    const keys = ['rank', 'suit', 'enhancement', 'edition', 'seal', 'grow'];
    deq(pickKeys(added[0], keys), { rank: 12, suit: 'D', enhancement: 'vintage', edition: 'benday', seal: 'paid', grow: 12 });
    assert.ok(run.blind.draw.includes(added[0].uid), 'the copy is in the draw pile');
  });

  test('Paper Route: $3 plus $1 per Ante, at most $10; usable at Blind select and in the Shop', () => {
    const at = (ante) => {
      const run = mkRun();
      run.ante = ante;
      const money = run.money;
      use(run, give(run, 'tarot', 'paperroute'));
      return run.money - money;
    };
    deq([at(1), at(4), at(7), at(8)], [4, 7, 10, 10]);
    const shop = shopRun();
    const money = shop.money;
    use(shop, give(shop, 'tarot', 'paperroute'));
    assert.equal(shop.money, money + 4);
  });

  test('Guest Star creates a random common Joker, gained free', () => {
    const run = mkRun();
    use(run, give(run, 'tarot', 'gueststar'));
    assert.equal(run.jokers.length, 1);
    assert.equal(jokerRow(run.jokers[0].id).rarity, 'common');
    deq(pickKeys(run.jokers[0], ['paid', 'edition']), { paid: 0, edition: null });
  });

  test('Guest Star needs a free Joker slot', () => {
    const run = mkRun();
    for (const id of ['jinglejester', 'pipsqueak', 'emptyseats', 'partyhorn', 'tallyowl']) addJ(run, id);
    bad(Engine.useConsumable(run, give(run, 'tarot', 'gueststar'), []), 'Guest Star with full slots', /Joker slot/);
    assert.equal(run.consumables.length, 1);
  });

  test('Overtime: +1 hand this Blind; Do-Over: +2 discards this Blind', () => {
    const run = blindRun();
    use(run, give(run, 'tarot', 'overtime'));
    use(run, give(run, 'tarot', 'doover'));
    deq([run.blind.handsLeft, run.blind.discardsLeft], [5, 5]);
    deq([run.hands, run.discards], [4, 3], 'only this Blind');
  });

  test('Happy Accident: 1 in 3 chance to add Gloss, Ben-Day or Four-Color to a Joker without an Edition', () => {
    let hits = 0;
    const n = 300;
    for (let i = 0; i < n; i++) {
      const run = mkRun({ seed: seedN(50000 + i) });
      addJ(run, 'jinglejester');
      use(run, give(run, 'tarot', 'happyaccident'));
      assert.equal(run.consumables.length, 0, 'used up either way');
      const ed = run.jokers[0].edition;
      if (ed) {
        hits++;
        assert.ok(['gloss', 'benday', 'fourcolor'].includes(ed), ed);
      }
    }
    between(hits / n, 0.24, 0.43, 'Happy Accident hit rate');
  });

  test('Happy Accident needs a Joker without an Edition', () => {
    const run = mkRun();
    addJ(run, 'jinglejester', 0, 'gloss');
    bad(Engine.useConsumable(run, give(run, 'tarot', 'happyaccident'), []), 'Happy Accident', 'You need a Joker without an Edition.');
  });

  test('Launch Pad creates the Planet card of your most-played hand', () => {
    const run = mkRun();
    Object.assign(run.plays, { three: 2, pair: 1 });
    const other = give(run, 'tarot', 'inkpot');
    use(run, give(run, 'tarot', 'launchpad'));
    deq(run.consumables.map((c) => [c.kind, c.id]), [['tarot', 'inkpot'], ['planet', 'kerplunk']]);
    assert.equal(run.consumables[0].uid, other);
  });

  test('Reprint copies the leftmost other Tarot or Planet card you hold', () => {
    const run = mkRun();
    const reprint = give(run, 'tarot', 'reprint');
    give(run, 'spectral', 'wormhole');
    give(run, 'planet', 'boing');
    run.consumableSlots = 3;
    use(run, reprint);
    deq(run.consumables.map((c) => c.id), ['wormhole', 'boing', 'boing']);
    assert.notEqual(run.consumables[1].uid, run.consumables[2].uid);
  });

  test('Reprint needs another Tarot or Planet card (a Spectral card does not count)', () => {
    const run = mkRun();
    const reprint = give(run, 'tarot', 'reprint');
    give(run, 'spectral', 'curtaincall');
    bad(Engine.useConsumable(run, reprint, []), 'Reprint', 'You need another Tarot or Planet card.');
  });
});

// ================================================================== §3.3 Planet cards
describe('§3.3 Planet cards', () => {
  test('consumableInfo: Planet cards need no cards and work anywhere', () => {
    const run = mkRun();
    for (const id of PLANET_IDS) {
      const info = plain(Engine.consumableInfo(run, give(run, 'planet', id)));
      deq(pickKeys(info, ['kind', 'id', 'select', 'where']), { kind: 'planet', id, select: [0, 0], where: 'any' });
      run.consumables = [];
    }
  });

  test('each Planet card gives its hand +1 level, with the new per-level values', () => {
    for (const [id, hand] of Object.entries(PLANETS)) {
      const run = mkRun();
      const r = use(run, give(run, 'planet', id));
      assert.equal(run.levels[hand], 2, id);
      assert.equal(r.effect.handId, hand);
      const row = plain(Engine.handTable(run)).find((h) => h.handId === hand);
      deq([row.chips, row.mult], [levelValue(hand, 2).chips, levelValue(hand, 2).mult], id);
    }
  });

  test('Sky Atlas: Planet cards give 2 levels', () => {
    const run = mkRun();
    run.vouchers.push('skyatlas');
    const r = use(run, give(run, 'planet', 'boing'));
    assert.equal(run.levels.pair, 3);
    assert.equal(r.effect.levels, 2);
  });

  test('Planet cards work during a Blind and in the Shop too', () => {
    const run = blindRun();
    use(run, give(run, 'planet', 'zoom'));
    clearBlind(run);
    ok(Engine.collect(run));
    use(run, give(run, 'planet', 'zoom'));
    assert.equal(run.levels.straight, 3);
  });
});

// ================================================================== §3 Spectral cards
describe('§3 Spectral cards', () => {
  const inHand = (run, uids) => uids.filter((u) => run.blind.hand.includes(u));

  test('consumableInfo gives each Spectral card its select range and where it can be used', () => {
    const run = mkRun();
    for (const id of SPECTRAL_IDS) {
      const uid = give(run, 'spectral', id);
      deq(pickKeys(plain(Engine.consumableInfo(run, uid)), ['kind', 'id', 'select', 'where']), { kind: 'spectral', id, select: SPECTRALS[id][0], where: SPECTRALS[id][1] }, id);
      run.consumables = [];
    }
  });

  test('Curtain Call: an Encore Seal on 1 selected card; 1 random other card in hand is destroyed', () => {
    const run = blindRun();
    const hand = run.blind.hand.slice();
    use(run, give(run, 'spectral', 'curtaincall'), [hand[0]]);
    assert.equal(cardRef(run, hand[0]).seal, 'encore');
    const gone = hand.filter((u) => !cardRef(run, u));
    assert.equal(gone.length, 1);
    assert.notEqual(gone[0], hand[0]);
    assert.equal(run.cards.length, 51);
  });

  test('Cursed Coin: a Paid Seal on up to 2 selected cards; lose $5, never below $0', () => {
    const run = blindRun();
    const two = run.blind.hand.slice(0, 2);
    run.money = 10;
    use(run, give(run, 'spectral', 'cursedcoin'), two);
    deq(two.map((u) => cardRef(run, u).seal), ['paid', 'paid']);
    assert.equal(run.money, 5);
    run.money = 3;
    use(run, give(run, 'spectral', 'cursedcoin'), [run.blind.hand[3]]);
    assert.equal(run.money, 0);
  });

  test('Dead Letter: an Airmail Seal on up to 2 cards; -1 discard this Blind, not below 0', () => {
    const run = blindRun();
    use(run, give(run, 'spectral', 'deadletter'), run.blind.hand.slice(0, 2));
    assert.equal(cardRef(run, run.blind.hand[0]).seal, 'airmail');
    assert.equal(run.blind.discardsLeft, 2);
    assert.equal(run.discards, 3, 'only this Blind');
    run.blind.discardsLeft = 0;
    use(run, give(run, 'spectral', 'deadletter'), [run.blind.hand[3]]);
    assert.equal(run.blind.discardsLeft, 0);
  });

  test('Apparition: a Cameo Seal on up to 2 cards; -1 hand this Blind; needs at least 2 hands left', () => {
    const run = blindRun();
    const two = run.blind.hand.slice(0, 2);
    use(run, give(run, 'spectral', 'apparition'), two);
    deq(two.map((u) => cardRef(run, u).seal), ['cameo', 'cameo']);
    assert.equal(run.blind.handsLeft, 3);
    run.blind.handsLeft = 1;
    bad(Engine.useConsumable(run, give(run, 'spectral', 'apparition'), [run.blind.hand[3]]), 'Apparition with 1 hand left', 'You need at least 2 hands left.');
  });

  test('Phantom Ink: Gloss, Ben-Day or Four-Color on 1 card; -1 hand size for the rest of this Blind', () => {
    const run = blindRun();
    const [a, low1, low2] = setHand(run, ['KS', '2C', '3D']);
    use(run, give(run, 'spectral', 'phantomink'), [a]);
    assert.ok(['gloss', 'benday', 'fourcolor'].includes(cardRef(run, a).edition), String(cardRef(run, a).edition));
    assert.equal(run.blind.handSizeDelta, -1);
    const r = play(run, [low1, low2]); // a weak High Card, so the Blind is not cleared
    assert.equal(r.cleared, false);
    assert.equal(run.blind.hand.length, 7, 'draws back up to 7');
    assert.equal(run.handSize, 8, 'only this Blind');
  });

  test('Phantom Ink picks Gloss most often and never Inverted', () => {
    const count = { gloss: 0, benday: 0, fourcolor: 0 };
    for (let i = 0; i < 200; i++) {
      const run = blindRun({ seed: seedN(60000 + i) });
      const a = run.blind.hand[0];
      use(run, give(run, 'spectral', 'phantomink'), [a]);
      count[cardRef(run, a).edition]++;
    }
    assert.equal(count.gloss + count.benday + count.fourcolor, 200);
    assert.ok(count.gloss > count.benday && count.benday > count.fourcolor && count.fourcolor > 0, JSON.stringify(count));
  });

  test('Upside Down: makes 1 card Inverted and destroys 2 random other cards in hand', () => {
    const run = blindRun();
    const hand = run.blind.hand.slice();
    use(run, give(run, 'spectral', 'upsidedown'), [hand[0]]);
    assert.equal(cardRef(run, hand[0]).edition, 'inverted');
    const gone = hand.filter((u) => !cardRef(run, u));
    assert.equal(gone.length, 2);
    assert.ok(!gone.includes(hand[0]));
    assert.equal(run.cards.length, 50);
  });

  test('Haunted Press: Four-Color on the leftmost Joker without an Edition; destroys the rightmost Joker', () => {
    const run = mkRun();
    const a = addJ(run, 'jinglejester', 0, 'gloss');
    const b = addJ(run, 'papercrown');
    addJ(run, 'paperclip');
    use(run, give(run, 'spectral', 'hauntedpress'));
    deq(run.jokers.map((j) => [j.uid, j.edition]), [[a.uid, 'gloss'], [b.uid, 'fourcolor']]);
  });

  test('Haunted Press needs 2 or more Jokers, and its target cannot be the rightmost one', () => {
    const one = mkRun();
    addJ(one, 'jinglejester');
    bad(Engine.useConsumable(one, give(one, 'spectral', 'hauntedpress'), []), 'with 1 Joker', 'You need at least 2 Jokers.');
    const two = mkRun();
    addJ(two, 'jinglejester', 0, 'gloss');
    addJ(two, 'papercrown');
    bad(Engine.useConsumable(two, give(two, 'spectral', 'hauntedpress'), []), 'only the rightmost has no Edition');
    assert.equal(two.jokers.length, 2);
  });

  test('Midnight Edition: a random Joker without an Edition becomes Inverted; -1 discard every Blind for good', () => {
    const run = mkRun();
    addJ(run, 'jinglejester');
    addJ(run, 'papercrown', 0, 'gloss');
    use(run, give(run, 'spectral', 'midnightedition'));
    deq(run.jokers.map((j) => j.edition), ['inverted', 'gloss']);
    assert.equal(run.discards, 2);
    begin(run);
    assert.equal(run.blind.discardsLeft, 2);
  });

  test('Midnight Edition never takes discards below 0, and needs a Joker without an Edition', () => {
    const run = mkRun();
    addJ(run, 'jinglejester');
    run.discards = 0;
    use(run, give(run, 'spectral', 'midnightedition'));
    assert.equal(run.discards, 0);
    bad(Engine.useConsumable(run, give(run, 'spectral', 'midnightedition'), []), 'no Joker without an Edition', 'You need a Joker without an Edition.');
  });

  test('Wormhole: every poker hand gains a level; lose half your money, rounded down', () => {
    const run = mkRun();
    run.money = 9;
    const r = use(run, give(run, 'spectral', 'wormhole'));
    for (const h of HAND_IDS) assert.equal(run.levels[h], 2, h);
    assert.equal(run.money, 5);
    assert.ok(r.effect.levelsAll === 1 || r.effect.levelsAll === true, 'effect.levelsAll');
  });

  test('Sky Atlas does not double Wormhole', () => {
    const run = mkRun();
    run.vouchers.push('skyatlas');
    use(run, give(run, 'spectral', 'wormhole'));
    for (const h of HAND_IDS) assert.equal(run.levels[h], 2, h);
  });

  test('Vanishing Act: destroys up to 4 selected cards and pays $4 each', () => {
    const run = blindRun();
    const three = run.blind.hand.slice(0, 3);
    const money = run.money;
    use(run, give(run, 'spectral', 'vanishingact'), three);
    assert.equal(run.money, money + 12);
    assert.equal(run.cards.length, 49);
    deq(inHand(run, three), []);
  });

  test('Ghost Writer: destroys your leftmost Joker and creates a random rare Joker', () => {
    const run = mkRun();
    const a = addJ(run, 'jinglejester');
    addJ(run, 'papercrown');
    use(run, give(run, 'spectral', 'ghostwriter'));
    assert.ok(!run.jokers.some((j) => j.uid === a.uid));
    assert.equal(run.jokers.length, 2);
    const made = run.jokers.find((j) => j.id !== 'papercrown');
    assert.equal(jokerRow(made.id).rarity, 'rare');
    assert.equal(made.paid, 0);
  });

  test('Ghost Writer falls back to an uncommon Joker when every rare one is owned; needs a Joker', () => {
    const run = mkRun();
    for (const id of ['jinglejester', ...jokerIdsOfRarity('rare')]) addJ(run, id, 0, id === 'jinglejester' ? null : 'inverted');
    use(run, give(run, 'spectral', 'ghostwriter'));
    const made = run.jokers.find((j) => !['jinglejester', ...jokerIdsOfRarity('rare')].includes(j.id));
    assert.equal(jokerRow(made.id).rarity, 'uncommon');
    const empty = mkRun();
    bad(Engine.useConsumable(empty, give(empty, 'spectral', 'ghostwriter'), []), 'Ghost Writer with no Joker');
  });

  test('Doppelganger: destroys the rightmost Joker, then copies the leftmost one fresh, without its Edition', () => {
    const run = mkRun();
    const b = addJ(run, 'gingerbreadfool', 4, 'gloss');
    b.state.chips = 30;
    addJ(run, 'jinglejester');
    use(run, give(run, 'spectral', 'doppelganger'));
    deq(run.jokers.map((j) => [j.id, j.edition, j.state.chips]), [['gingerbreadfool', 'gloss', 30], ['gingerbreadfool', null, 60]]);
    assert.notEqual(run.jokers[0].uid, run.jokers[1].uid);
  });

  test('Doppelganger needs 2 or more Jokers', () => {
    const run = mkRun();
    addJ(run, 'jinglejester');
    bad(Engine.useConsumable(run, give(run, 'spectral', 'doppelganger'), []), 'with 1 Joker', 'You need at least 2 Jokers.');
  });

  // decision 'wickwisp' (content-plan.json): select 1 card; every card in hand takes its suit;
  // -1 hand this Blind (needs 2 hands left during a Blind); no money cost.
  test('Wickwisp (spellbound): every card in hand takes the suit of 1 selected card; -1 hand this Blind', () => {
    const run = blindRun();
    const [, s2] = setHand(run, ['KD', '2S', '3H', '4C']);
    run.money = 10;
    const hands = run.blind.handsLeft;
    use(run, give(run, 'spectral', 'spellbound'), [s2]);
    deq(handCards(run).map((c) => c.suit), Array(8).fill('S'));
    assert.equal(run.blind.handsLeft, hands - 1);
    assert.equal(run.money, 10, 'no money cost any more');
    bad(Engine.useConsumable(run, give(run, 'spectral', 'spellbound'), []), 'with no card selected', 'Select exactly 1 card.');
    run.blind.handsLeft = 1;
    bad(Engine.useConsumable(run, give(run, 'spectral', 'spellbound'), [run.blind.hand[0]]), 'with 1 hand left', 'You need at least 2 hands left.');
  });

  test('Graveyard Shift: destroys 2 random cards in hand and adds 2 random cards with an Enhancement and a Seal', () => {
    const run = blindRun();
    const hand = run.blind.hand.slice();
    const before = new Set(run.cards.map((c) => c.uid));
    use(run, give(run, 'spectral', 'graveyardshift'));
    assert.equal(hand.filter((u) => !cardRef(run, u)).length, 2);
    const added = run.cards.filter((c) => !before.has(c.uid));
    assert.equal(added.length, 2);
    for (const c of added) {
      assert.ok(ENHANCEMENT_IDS.includes(c.enhancement), c.enhancement);
      assert.ok(SEAL_IDS.includes(c.seal), c.seal);
      assert.equal(c.edition ?? null, null);
      assert.ok(run.blind.hand.includes(c.uid), 'added to the hand');
    }
    assert.equal(run.cards.length, 52);
  });

  test('Hall of Mirrors: 3 copies of 1 selected card join the deck; 2 random other cards in hand are destroyed', () => {
    const run = blindRun();
    const [a] = setHand(run, [{ code: 'JH', enhancement: 'inked', seal: 'cameo' }]);
    const hand = run.blind.hand.slice();
    const before = new Set(run.cards.map((c) => c.uid));
    use(run, give(run, 'spectral', 'hallofmirrors'), [a]);
    const added = run.cards.filter((c) => !before.has(c.uid));
    assert.equal(added.length, 3);
    for (const c of added) deq(pickKeys(c, ['rank', 'suit', 'enhancement', 'seal']), { rank: 11, suit: 'H', enhancement: 'inked', seal: 'cameo' });
    const gone = hand.filter((u) => !cardRef(run, u));
    assert.equal(gone.length, 2);
    assert.ok(!gone.includes(a));
    assert.equal(run.cards.length, 53);
  });

  test('Origin Story: creates a Legendary Joker (a rare one while none is left to find); -1 hand size for good', () => {
    const run = mkRun();
    use(run, give(run, 'spectral', 'originstory'));
    assert.equal(run.jokers.length, 1);
    const legends = jokerIdsOfRarity('legendary');
    const rarity = jokerRow(run.jokers[0].id).rarity;
    assert.equal(rarity, legends.length ? 'legendary' : 'rare');
    assert.equal(run.handSize, 7);
    begin(run);
    assert.equal(run.blind.hand.length, 7);
  });

  test('Origin Story keeps hand size at least 1 and needs a free Joker slot', () => {
    const run = mkRun();
    run.handSize = 1;
    use(run, give(run, 'spectral', 'originstory'));
    assert.equal(run.handSize, 1);
    const full = mkRun();
    for (const id of ['jinglejester', 'pipsqueak', 'emptyseats', 'partyhorn', 'tallyowl']) addJ(full, id);
    bad(Engine.useConsumable(full, give(full, 'spectral', 'originstory'), []), 'Origin Story with full slots', /Joker slot/);
    assert.equal(full.handSize, 8);
  });

  test('§4.2 patch: useConsumable reports seal, edition, destroyed, created, jokerUid and moneyLost', () => {
    const run = blindRun();
    run.money = 3;
    const [a] = setHand(run, ['KS']);
    const coin = use(run, give(run, 'spectral', 'cursedcoin'), [a]);
    deq([coin.effect.seal, coin.effect.moneyLost], ['paid', 3]);
    const curtain = use(run, give(run, 'spectral', 'curtaincall'), [a]);
    assert.equal(curtain.effect.seal, 'encore');
    assert.equal(cardRef(run, a).seal, 'encore', 'a new Seal replaces the old one');
    assert.equal(curtain.effect.destroyed.length, 1);
    const ink = use(run, give(run, 'spectral', 'phantomink'), [a]);
    assert.equal(ink.effect.edition, cardRef(run, a).edition);
    const origin = use(run, give(run, 'spectral', 'originstory'));
    assert.equal(origin.effect.jokerUid, run.jokers[0].uid);
    const pad = use(run, give(run, 'tarot', 'launchpad'));
    deq(pad.effect.created, [run.consumables[run.consumables.length - 1].uid]);
  });

  test('Blind-only Spectral cards cannot be used outside a Blind', () => {
    const run = mkRun();
    for (const id of SPECTRAL_IDS.filter((s) => SPECTRALS[s][1] === 'blind')) {
      // Cards that need no selection must name the reason; the others may complain about the selection first.
      const needsNone = SPECTRALS[id][0][1] === 0;
      bad(Engine.canUseConsumable(run, give(run, 'spectral', id), []), id, needsNone ? 'Only usable during a Blind.' : undefined);
    }
  });
});

// ================================================================== §2.10 skipping and Tags
describe('§2.10 skipping Blinds and Tags', () => {
  test('Tags are rolled uniformly from those allowed at the Ante: no Ghost Tag in Ante 1', () => {
    const ante1 = {};
    let ghostLater = 0;
    for (let i = 0; i < 200; i++) {
      const run = mkRun({ seed: seedN(70000 + i) });
      for (const k of ['1-0', '1-1']) ante1[run.tags[k]] = (ante1[run.tags[k]] || 0) + 1;
      for (let a = 2; a <= 8; a++) for (const k of [`${a}-0`, `${a}-1`]) if (run.tags[k] === 'ghost') ghostLater++;
    }
    assert.equal(ante1.ghost, undefined, 'no Ghost Tag at Ante 1');
    for (const id of TAG_IDS.filter((t) => t !== 'ghost')) assert.ok((ante1[id] || 0) >= 12, `${id} seen ${ante1[id] || 0} times in 400`);
    assert.ok(ghostLater > 50, `Ghost Tag from Ante 2 on (${ghostLater})`);
  });

  test('skipping the Small Blind grants its Tag and goes to the next Blind select, with no cash-out or Shop', () => {
    const run = mkRun();
    const r = skipWith(run, 'piggybank');
    assert.equal(r.tag.id, 'piggybank');
    deq(pickKeys(run, ['blindIndex', 'phase', 'cashout', 'shop']), { blindIndex: 1, phase: 'blind-select', cashout: null, shop: null });
    assert.equal(run.blindStatus['1-0'], 'skipped');
    assert.equal(run.stats.blindsSkipped, 1);
    assert.ok(run.discovered.tags.includes('piggybank'));
  });

  test('the Big Blind can be skipped too; the Boss Blind never', () => {
    const run = mkRun();
    skipWith(run, 'piggybank');
    skipWith(run, 'piggybank');
    assert.equal(run.blindIndex, 2);
    bad(Engine.skipBlind(run), 'skip the Boss Blind', "Boss Blinds can't be skipped.");
  });

  test('skipping is only possible at Blind select', () => {
    const run = blindRun();
    bad(Engine.skipBlind(run), 'skip during a Blind', "You can't skip a Blind right now.");
  });

  test('Piggy Bank Tag: gain $6', () => {
    const run = mkRun();
    const r = skipWith(run, 'piggybank');
    assert.equal(run.money, 10);
    assert.equal(r.gained.money, 6);
  });

  test('Buddy Tag: a random common Joker, gained free; $4 instead when the Joker slots are full', () => {
    const run = mkRun();
    const r = skipWith(run, 'buddy');
    assert.equal(run.jokers.length, 1);
    assert.equal(jokerRow(run.jokers[0].id).rarity, 'common');
    assert.equal(run.jokers[0].paid, 0);
    assert.equal(r.gained.jokerId ?? run.jokers[0].id, run.jokers[0].id);
    const full = mkRun();
    for (const id of ['jinglejester', 'pipsqueak', 'emptyseats', 'partyhorn', 'tallyowl']) addJ(full, id);
    skipWith(full, 'buddy');
    deq([full.jokers.length, full.money], [5, 8]);
  });

  test('Tarot Tag: 2 random Tarot cards, as many as fit', () => {
    const run = mkRun();
    skipWith(run, 'tarot');
    assert.equal(run.consumables.length, 2);
    for (const c of run.consumables) deq([c.kind, TAROT_IDS.includes(c.id)], ['tarot', true]);
    const one = mkRun();
    give(one, 'planet', 'blip');
    skipWith(one, 'tarot');
    assert.equal(one.consumables.length, 2);
  });

  test('Fan Favorite Tag: your most-played hand gains a level (a random hand when none was played)', () => {
    const run = mkRun();
    Object.assign(run.plays, { flush: 3, pair: 1 });
    skipWith(run, 'fanfavorite');
    assert.equal(run.levels.flush, 2);
    const fresh = mkRun();
    skipWith(fresh, 'fanfavorite');
    assert.equal(Object.values(fresh.levels).reduce((s, l) => s + l, 0), 10);
  });

  test('Second Wind Tag: +1 hand in your next Blind only', () => {
    const run = mkRun();
    skipWith(run, 'secondwind');
    begin(run);
    assert.equal(run.blind.handsLeft, 5);
    assert.equal(run.pending.extraHands, 0, 'used up by startBlind');
  });

  test('Head Start Tag: your next Blind\'s target is 25% lower (Big Blind 450 -> 340)', () => {
    const run = mkRun();
    skipWith(run, 'headstart');
    begin(run);
    assert.equal(run.blind.target, 340);
    assert.equal(run.pending.targetMult, 1, 'used up by startBlind');
  });

  test('Grab Bag Tag: a free Jumbo Card Pack opens at once and returns to Blind select', () => {
    const run = mkRun();
    const money = run.money;
    skipWith(run, 'grabbag');
    assert.equal(run.phase, 'pack');
    deq(pickKeys(run.pack, ['id', 'kind', 'size', 'picksLeft', 'returnTo']), { id: 'cardjumbo', kind: 'card', size: 'jumbo', picksLeft: 1, returnTo: 'blind-select' });
    assert.equal(run.pack.options.length, 6);
    pick(run, 0);
    deq([run.phase, run.blindIndex, run.money, run.cards.length], ['blind-select', 1, money, 53]);
  });

  test('Sky Tag: a free Jumbo Planet Pack opens at once', () => {
    const run = mkRun();
    skipWith(run, 'sky');
    deq(pickKeys(run.pack, ['id', 'kind', 'returnTo']), { id: 'planetjumbo', kind: 'planet', returnTo: 'blind-select' });
    assert.equal(run.pack.options.length, 6);
    for (const o of run.pack.options) assert.ok(PLANET_IDS.includes(o.id));
    ok(Engine.packSkip(run));
    assert.equal(run.phase, 'blind-select');
  });

  test('Ghost Tag: a free Jumbo Ghost Pack opens at once, with a hand dealt for its Spectral cards', () => {
    const run = mkRun();
    skipWith(run, 'ghost');
    deq(pickKeys(run.pack, ['id', 'kind', 'picksLeft', 'returnTo']), { id: 'ghostjumbo', kind: 'ghost', picksLeft: 1, returnTo: 'blind-select' });
    assert.equal(run.pack.options.length, 3);
    for (const o of run.pack.options) deq([o.kind, SPECTRAL_IDS.includes(o.id)], ['spectral', true]);
    assert.equal(packHand(run).length, 8);
  });

  test('Collector\'s Tag: Gloss, Ben-Day or Four-Color on a random Joker without an Edition, or $4', () => {
    const run = mkRun();
    addJ(run, 'jinglejester');
    addJ(run, 'papercrown', 0, 'gloss');
    skipWith(run, 'collector');
    assert.ok(['gloss', 'benday', 'fourcolor'].includes(run.jokers[0].edition), String(run.jokers[0].edition));
    assert.equal(run.jokers[1].edition, 'gloss');
    const none = mkRun();
    skipWith(none, 'collector');
    assert.equal(none.money, 8);
  });

  test('Stamp Tag: a random Seal on 2 random deck cards that have none', () => {
    const run = mkRun();
    skipWith(run, 'stamp');
    const sealed = run.cards.filter((c) => c.seal);
    assert.equal(sealed.length, 2);
    for (const c of sealed) assert.ok(SEAL_IDS.includes(c.seal));
    const stamped = mkRun({ deckId: 'rubberstamp' });
    const before = stamped.cards.filter((c) => c.seal).map((c) => [c.uid, c.seal]);
    skipWith(stamped, 'stamp');
    assert.equal(stamped.cards.filter((c) => c.seal).length, 10);
    for (const [uid, seal] of before) assert.equal(cardRef(stamped, uid).seal, seal, 'existing Seals are kept');
  });
});

// ================================================================== §3.6 Vouchers
describe('§3.6 Vouchers', () => {
  const afterVoucher = (id, opts) => {
    const run = shopRun(opts);
    buyVoucher(run, id);
    ok(Engine.leaveShop(run));
    return run;
  };

  test('Muscle Course: +1 hand size, and +1 more in Boss Blinds', () => {
    const run = afterVoucher('musclecourse');
    assert.equal(run.handSize, 9);
    begin(run);
    assert.equal(run.blind.hand.length, 9, 'Big Blind');
    clearBlind(run);
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    begin(run, { boss: 'heckler' });
    assert.equal(run.blind.hand.length, 10, 'Boss Blind');
  });

  test('Speed Course: +1 hand every Blind, and +1 more in Boss Blinds', () => {
    const run = afterVoucher('speedcourse');
    assert.equal(run.hands, 5);
    begin(run);
    assert.equal(run.blind.handsLeft, 5);
    clearBlind(run);
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    begin(run, { boss: 'heckler' });
    assert.equal(run.blind.handsLeft, 6);
  });

  test('Speed Course and The Short Fuse: 4 + 1 + 1 - 2 = 4 hands', () => {
    const run = afterVoucher('speedcourse');
    run.blindIndex = 2;
    begin(run, { boss: 'shortfuse' });
    assert.equal(run.blind.handsLeft, 4);
  });

  test('Spring Cleaning: +2 discards every Blind', () => {
    const run = afterVoucher('springcleaning');
    assert.equal(run.discards, 5);
    begin(run);
    assert.equal(run.blind.discardsLeft, 5);
  });

  test('Savings Bond: the interest cap goes up by $3', () => {
    const run = afterVoucher('savingsbond');
    begin(run);
    clearBlind(run, { money: 50 });
    assert.equal(run.cashout.lines.find((l) => l.label === 'Interest').amount, 8);
  });

  test('a Voucher you own cannot be bought again', () => {
    const run = shopRun();
    run.vouchers.push('dollaroff');
    const i = forceVoucher(run, 'dollaroff');
    run.money = 50;
    bad(Engine.buy(run, i), 'buy an owned Voucher', 'You already have that Voucher.');
  });
});

// ================================================================== Legendary Jokers and the data-driven Joker table
// The 120-Joker table holds five Legendary Jokers; this context adds two more test Legendaries
// (and one common clone) to TW.Content.JOKERS between content.js and engine.js, so the rules are
// checked on rows that are not in the design too. They copy the rows of existing Jokers under new ids.
const LEG = memo(() => {
  const ctx = makeContext({
    afterContent: `(() => {
      const C = globalThis.TW && globalThis.TW.Content;
      const list = C && C.JOKERS;
      if (!list) return;
      const find = (id) => (Array.isArray(list) ? list.find((r) => r.id === id) : list[id]);
      const add = (row) => {
        if (Array.isArray(list)) {
          list.push(row);
          try { Object.defineProperty(list, row.id, { value: row, enumerable: false, configurable: true, writable: true }); } catch (e) {}
        } else list[row.id] = row;
      };
      add(Object.assign({}, find('jinglejester'), { id: 'testlegenda', name: 'Test Legend A', rarity: 'legendary', cost: 20 }));
      add(Object.assign({}, find('paperclip'), { id: 'testlegendb', name: 'Test Legend B', rarity: 'legendary', cost: 20 }));
      add(Object.assign({}, find('jinglejester'), { id: 'testclone', name: 'Test Clone', rarity: 'common', cost: 4 }));
    })();`,
  });
  return vm.runInContext('globalThis.TW.Engine', ctx);
});
const LEGENDS = ['testlegenda', 'testlegendb', ...LEGENDARY_IDS];

describe('Legendary Jokers: never in the Shop or packs, only from Origin Story', () => {
  const legShop = (seed) => {
    const E = LEG();
    const run = E.newRun({ seed });
    assert.equal(E.startBlind(run).ok, true);
    run.blind.score = run.blind.target - 1;
    assert.equal(E.playHand(run, [run.blind.hand[0]]).ok, true);
    assert.equal(E.collect(run).ok, true);
    return { E, run };
  };
  const useOrigin = (E, run) => {
    const uid = 'k' + run.nextUid++;
    run.consumables.push({ uid, kind: 'spectral', id: 'originstory' });
    return plain(E.useConsumable(run, uid, []));
  };

  test('the Shop never offers a Legendary Joker', () => {
    const { E, run } = legShop('LEGSHOPA');
    run.money = 1e9;
    let jokers = 0;
    for (let i = 0; i < 1500; i++) {
      for (const it of run.shop.items) {
        if (it.kind !== 'joker') continue;
        jokers++;
        assert.ok(!LEGENDS.includes(it.id), `Legendary ${it.id} offered`);
      }
      assert.equal(E.reroll(run).ok, true);
    }
    assert.ok(jokers > 1000);
  });

  test('Joker Packs never hold a Legendary Joker', () => {
    for (let i = 0; i < 60; i++) {
      const { E, run } = legShop(seedN(80000 + i));
      const slot = run.shop.items.findIndex((it) => it.slot === ASSUMED.slot.pack);
      Object.assign(run.shop.items[slot], { id: 'jokermega', size: 'mega', sold: false, price: 10 });
      run.money = 100;
      assert.equal(E.buy(run, slot).ok, true);
      for (const o of run.pack.options) assert.ok(!LEGENDS.includes(o.id), `Legendary ${o.id} in a Joker Pack`);
    }
  });

  test('Origin Story creates a Legendary Joker you do not own, then a rare one once you own them all', () => {
    const E = LEG();
    const run = E.newRun({ seed: 'LEGORIGN' });
    run.jokerSlots = 10;
    assert.equal(useOrigin(E, run).ok, true);
    const first = run.jokers[0].id;
    assert.ok(LEGENDS.includes(first), first);
    for (let i = 1; i < LEGENDS.length; i++) assert.equal(useOrigin(E, run).ok, true);
    deq(sorted(run.jokers.map((j) => j.id)), sorted(LEGENDS), 'each use is a Legendary not owned yet (5 of the table, 2 test rows)');
    assert.equal(useOrigin(E, run).ok, true);
    const last = run.jokers[LEGENDS.length].id;
    assert.ok(!LEGENDS.includes(last) && jokerRow(last) && jokerRow(last).rarity === 'rare', last);
  });

  test('Guest Star, Ghost Writer and the Buddy Tag never make a Legendary Joker', () => {
    const E = LEG();
    for (let i = 0; i < 40; i++) {
      const run = E.newRun({ seed: seedN(85000 + i) });
      for (const [kind, id] of [['tarot', 'gueststar'], ['spectral', 'ghostwriter']]) {
        const uid = 'k' + run.nextUid++;
        run.consumables.push({ uid, kind, id });
        assert.equal(E.useConsumable(run, uid, []).ok, true, id);
      }
      run.tags['1-0'] = 'buddy';
      assert.equal(E.skipBlind(run).ok, true);
      assert.equal(run.jokers.length, 2);
      for (const j of run.jokers) assert.ok(!LEGENDS.includes(j.id), j.id);
    }
  });

  test('a Legendary Joker sells for half its cost (owner decision), though it was free', () => {
    const E = LEG();
    const run = E.newRun({ seed: 'LEGSELLS' });
    useOrigin(E, run);
    assert.equal(run.jokers[0].paid, 0);
    assert.equal(E.jokerSellValue(run, run.jokers[0].uid), 10);
  });

  // API ASSUMED: Joker effects are described by the content row, so a copied row with a new id
  // behaves like the original with no engine change (the "data-driven, easy to extend" brief).
  test('a Joker added to the content table works with no engine change', () => {
    const E = LEG();
    const run = E.newRun({ seed: 'LEGCLONE' });
    assert.equal(E.startBlind(run).ok, true);
    assert.ok(E.addJoker(run, 'testclone', 0, null), 'addJoker accepts the new id');
    const res = plain(E.scoreCards(run, [E.makeCard(13, 'S', {}), E.makeCard(13, 'H', {})], []));
    deq(pickKeys(res, ['chips', 'mult', 'total']), { chips: 47, mult: 5, total: 235 });
  });
});

// ================================================================== §5 records
describe('§5 records (v2 records shape)', () => {
  const apply = (records, run, opts = { final: true, now: '2026-11-23' }) => plain(Engine.applyRunToRecords(records, run, opts));

  test('defaultRecords: version 2 with the three starting Decks and the Sunny Stake', () => {
    deq(plain(Engine.defaultRecords()), {
      version: 2, runs: 0, wins: 0, bestAnte: 0, bestHand: null,
      unlockedDecks: ['firstissue', 'speedlines', 'sketchbook'], unlockedStakes: ['sunny'],
      wonOn: [], history: [], discovered: { jokers: [], consumables: [], bosses: [], vouchers: [], tags: [] },
    });
  });

  test('best Ante unlocks Decks: Panorama 3, Bargain Bin 4, Studio 5, Rubber Stamp 6, Halftone 7', () => {
    for (const [ante, deck] of [[3, 'panorama'], [4, 'bargainbin'], [5, 'studio'], [6, 'rubberstamp'], [7, 'halftone']]) {
      const run = mkRun();
      run.ante = ante;
      const out = apply(Engine.defaultRecords(), run, { final: false, now: '' });
      assert.ok(out.records.unlockedDecks.includes(deck), `${deck} at Ante ${ante}`);
      assert.ok(out.unlocked.some((u) => u.type === 'deck' && u.id === deck));
      assert.equal(out.records.bestAnte, ante);
    }
    const two = mkRun();
    two.ante = 2;
    deq(apply(Engine.defaultRecords(), two, { final: false, now: '' }).records.unlockedDecks, ['firstissue', 'speedlines', 'sketchbook']);
  });

  test('a win on Sunny unlocks the Mint Condition Deck and the Uh-Oh Stake, not the Spooky Deck', () => {
    const run = mkRun();
    run.ante = 8;
    run.won = true;
    const out = apply(Engine.defaultRecords(), run);
    assert.ok(out.records.unlockedDecks.includes('mintcondition'));
    assert.ok(!out.records.unlockedDecks.includes('spooky'));
    assert.ok(out.records.unlockedStakes.includes('uhoh'));
    assert.equal(out.records.wins, 1);
  });

  test('a win on Uh-Oh Stake (or higher) unlocks the Spooky Deck and the next Stake', () => {
    const run = mkRun({ stake: 'uhoh' });
    run.ante = 8;
    run.won = true;
    const out = apply(Engine.defaultRecords(), run);
    assert.ok(out.records.unlockedDecks.includes('spooky'));
    assert.ok(out.records.unlockedStakes.includes('gulp'));
  });

  test('a final run is counted once and filed in the history (the last 12 are kept)', () => {
    let records = plain(Engine.defaultRecords());
    const run = mkRun({ deckId: 'speedlines', stake: 'sunny' });
    run.ante = 2;
    records = apply(records, run).records;
    assert.equal(records.runs, 1);
    assert.equal(run.recorded, true);
    deq(pickKeys(records.history[0], ['at', 'deckId', 'stake', 'ante', 'won']), { at: '2026-11-23', deckId: 'speedlines', stake: 'sunny', ante: 2, won: false });
    assert.equal(apply(records, run).records.runs, 1, 'not counted twice');
    for (let i = 0; i < 14; i++) records = apply(records, mkRun({ seed: seedN(90000 + i) })).records;
    assert.equal(records.runs, 15);
    assert.equal(records.history.length, 12);
  });

  test('records merge what the run discovered', () => {
    const run = mkRun();
    run.discovered.jokers.push('jinglejester');
    run.discovered.tags.push('sky');
    const out = apply(Engine.defaultRecords(), run, { final: false, now: '' });
    assert.ok(out.records.discovered.jokers.includes('jinglejester'));
    assert.ok(out.records.discovered.tags.includes('sky'));
  });

  // API ASSUMED: if the engine owns normalizeRecords (§5 patch), version 1 records migrate through the oldId columns.
  test('normalizeRecords migrates version 1 records by the oldId columns', (t) => {
    if (typeof Engine.normalizeRecords !== 'function') {
      t.skip('Engine.normalizeRecords is not part of the engine (the UI may own it)');
      return;
    }
    const v1 = {
      version: 1, voyages: 3, wins: 1, bestAnte: 4, bestHand: null,
      unlockedDecks: ['dinghy', 'clipper', 'trawler', 'lantern', 'nosuchdeck'], unlockedSeaStates: ['calm', 'choppy'],
      wonOn: [], history: [], discovered: { charms: ['anchor'], consumables: ['springtide', 'polaris'], bosses: ['siren'] },
    };
    const r = plain(Engine.normalizeRecords(v1));
    deq(pickKeys(r, ['version', 'runs', 'wins', 'bestAnte']), { version: 2, runs: 3, wins: 1, bestAnte: 4 });
    deq(sorted(r.unlockedDecks), sorted(['firstissue', 'speedlines', 'sketchbook', 'panorama']));
    deq(sorted(r.unlockedStakes), ['sunny', 'uhoh']);
    deq(r.discovered.jokers, ['jinglejester'], 'the v2 charm anchor is Jingle Jester through oldId');
    assert.ok(r.discovered.consumables.includes('inkpot') && r.discovered.consumables.includes('blip'));
    assert.ok(r.discovered.bosses.includes('heckler'));
  });
});

// ================================================================== §4 errors, stats and discovery
describe('§4 invalid actions return { ok:false, error } and never throw', () => {
  test('actions in the wrong phase or with bad arguments return a sentence', () => {
    const run = mkRun();
    const calls = {
      playHand: () => Engine.playHand(run, [run.cards[0].uid]),
      discard: () => Engine.discard(run, [run.cards[0].uid]),
      collect: () => Engine.collect(run),
      buy: () => Engine.buy(run, 0),
      reroll: () => Engine.reroll(run),
      packPick: () => Engine.packPick(run, 0, []),
      packSkip: () => Engine.packSkip(run),
      leaveShop: () => Engine.leaveShop(run),
      goEndless: () => Engine.goEndless(run),
      sellJoker: () => Engine.sellJoker(run, 'h404'),
      sellConsumable: () => Engine.sellConsumable(run, 'k404'),
      useConsumable: () => Engine.useConsumable(run, 'k404', []),
      reorderJokers: () => Engine.reorderJokers(run, ['h404']),
      playNull: () => Engine.playHand(run, null),
      buyNegative: () => Engine.buy(run, -1),
    };
    for (const [name, call] of Object.entries(calls)) {
      let r;
      assert.doesNotThrow(() => { r = call(); }, name);
      bad(r, name);
    }
    deq(run, mkRun(), 'nothing changed');
  });

  test('during a Blind: shop and pack actions fail politely', () => {
    const run = blindRun();
    for (const [name, call] of Object.entries({
      collect: () => Engine.collect(run),
      buy: () => Engine.buy(run, 0),
      reroll: () => Engine.reroll(run),
      leaveShop: () => Engine.leaveShop(run),
      startBlind: () => Engine.startBlind(run),
      discardNone: () => Engine.discard(run, []),
      discardSix: () => Engine.discard(run, run.blind.hand.slice(0, 6)),
    })) {
      let r;
      assert.doesNotThrow(() => { r = call(); }, name);
      bad(r, name);
    }
  });
});

describe('§2.12 / §2.13 discovery and end-of-run stats', () => {
  test('the Boss Blind is discovered by the time it starts; a Joker gained from a Tag is discovered', () => {
    const run = mkRun();
    skipWith(run, 'buddy');
    assert.ok(run.discovered.jokers.includes(run.jokers[0].id));
    skipWith(run, 'piggybank');
    begin(run);
    assert.ok(run.discovered.bosses.includes(run.bosses[1]));
  });

  test('a pack\'s options are discovered when it opens', () => {
    const run = mkRun();
    skipWith(run, 'sky');
    for (const o of run.pack.options) assert.ok(run.discovered.consumables.includes(o.id), o.id);
  });

  test('stats report Blinds cleared and skipped, hands played and the seed', () => {
    const run = mkRun();
    skipWith(run, 'piggybank');
    begin(run);
    clearBlind(run);
    const s = plain(Engine.stats(run));
    deq(pickKeys(s, ['ante', 'blindsCleared', 'blindsSkipped', 'handsPlayed', 'seed']), { ante: 1, blindsCleared: 1, blindsSkipped: 1, handsPlayed: 1, seed: SEED });
    assert.ok(s.bestHand && typeof s.bestHand.score === 'number');
  });
});
