/*
 * Wickwager: shared harness for the black-box Joker suites
 *   tests/jokers-bb.test.mjs               (1-3 tests for each of the 120 Jokers)
 *   tests/jokers-bb-interactions.test.mjs  (20 hand-computed scenarios across Jokers)
 *
 * This is not a test file (it does not match tests/*.test.mjs). It holds the one ASSUMED table
 * both suites use, so a reconcile step can realign every API guess in one place.
 *
 * Written from the design only: content/content-plan.json (each Joker's text and behaviour),
 * CONTENT.md (Joker behaviours, engine rows, the 70 vocabulary words), content/CHECKS.md, and
 * SPEC.md sections 2 and 4. src/engine.js and src/content.js were NOT read: they are loaded,
 * in build order, into one bare vm context, exactly like the top of tests/v3.test.mjs.
 *
 * Conventions:
 *  - Expected numbers are worked out by hand from the design text and typed into the tests.
 *  - Display names are read from TW.Content at run time where a result embeds one (cash-out
 *    lines). Test titles use the design names below, as labels only.
 *  - Tests set documented run fields (hand cards, run.money, run.blind.handsLeft, run.plays, ...)
 *    to build exact situations, as tests/v3.test.mjs does.
 *  - Objects from the vm context have foreign prototypes, so deep comparisons go through JSON.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ loading (as tests/v3.test.mjs)
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');
const CONTENT_FILE = path.join(ROOT, 'src', 'content.js');
const ENGINE_FILE = path.join(ROOT, 'src', 'engine.js');
const CONTENT_SRC = fs.readFileSync(CONTENT_FILE, 'utf8');
const ENGINE_SRC = fs.readFileSync(ENGINE_FILE, 'utf8');

// prelude runs before content.js; afterContent runs after content.js and before engine.js.
export function makeContext({ prelude, afterContent } = {}) {
  const ctx = vm.createContext({ console });
  if (prelude) vm.runInContext(prelude, ctx);
  vm.runInContext(CONTENT_SRC, ctx, { filename: CONTENT_FILE });
  if (afterContent) vm.runInContext(afterContent, ctx);
  vm.runInContext(ENGINE_SRC, ctx, { filename: ENGINE_FILE });
  return ctx;
}

export const context = makeContext();
export const TW = vm.runInContext('globalThis.TW', context);
export const Engine = TW.Engine;
export const Content = TW.Content;

// ================================================================== ASSUMED (realign here)
// Everything these suites take for granted that SPEC.md §4 does not pin down, or that comes from
// the design's *proposed* engine rows rather than from the player-facing text. Each entry is
// either a value the tests read, or a flag documenting a reading the tests rely on (search the
// suites for "ASSUMED." to find every use).
export const ASSUMED = {
  // A1. run.shop.items[].slot names (SPEC §4.1). A pack's Shop item carries its PACKS row id in
  //     item.id, plus item.size (same guess as tests/v3.test.mjs).
  slot: { card: 'card', pack: 'pack', voucher: 'voucher' },

  // A2. Joker state keys: the design's proposed engine rows (CONTENT.md "Joker engine rows";
  //     the behaviour lines name the same keys, e.g. "state.chips starts 60").
  state: {
    gingerbreadfool: 'chips', magpie: 'chips', accordion: 'chips', tealeaves: 'chips', patchworkdoll: 'chips',
    jackinthebox: 'mult', packrat: 'mult', pawnbroker: 'mult', drippingcandle: 'mult', bigspender: 'mult', nailbiter: 'mult',
    stargazer: 'planets', pokerface: 'x', dragontamer: 'x', brazier: 'x',
    fortunecookie: 'rank', headsortails: 'side', sleightofhand: 'used', luckydip: 'used',
    standin: 'target', oldflame: 'copy',
  },

  // A3. Heads or Tails keeps its side as these strings (behaviour: "state.side starts 'heads'").
  coin: { heads: 'heads', tails: 'tails' },

  // A4. Stand-In's state.target holds the uid of the Joker it copies, and setting it by hand
  //     mid-Blind is honoured (behaviour: "state.target: the uid of a random other Joker").
  standInTargetIsUid: true,

  // A5. The Engine.discard result flag for a discard that did not lower discardsLeft
  //     (SPEC §4.2 lists `free`; Sleight of Hand reuses it).
  discardFree: 'free',

  // A6. Cash-out line labels (SPEC §2.7). Joker lines are labelled with TW.Content's Joker name.
  interestLabel: 'Interest',
  handsToSpareLabel: 'Hands to spare',

  // A7. Engine.rerollCost(run) is the price the next reroll actually charges, Spinning Top
  //     included (SPEC §4.2: "0 while a free reroll is left").
  rerollCostIsCharged: true,

  // A8. Engine.blindTarget(run, ante, 2) is the target the Boss Blind would start with, Smooth
  //     Talker included (behaviour: "when the Boss Blind starts and in Blind select previews").
  blindTargetIncludesJokers: true,

  // A9. Engine.addJoker counts as gaining the Joker: its `gained` events run. The tests never
  //     depend on it alone (Stand-In and Fortune Cookie are also checked after a Blind starts).
  addJokerGains: true,

  // A10. Hot Cocoa's Second Wind Tag shows as run.pending.extraHands + 1 right after the Boss
  //      Blind is beaten (behaviour: "pending.extraHands +1"), and the next startBlind uses it.
  secondWindIsPendingHand: true,

  // A11. Lucky Dip's extra pick shows in run.pack.picksLeft as soon as the pack is bought.
  luckyDipInPicksLeft: true,

  // A12. A Joker-created consumable (Moonstruck, Palm Reader, Night Moth) lands in
  //      run.consumables as { uid, kind, id } (SPEC §4.1 shape).
  createdConsumableShape: true,

  // A13. Gains counted inside scoring (Jack-in-the-Box, Accordion) leave the Joker's state alone
  //      in Engine.scoreCards and are stored by Engine.playHand; the tests only read the state
  //      key (A2), never the name of the field scoreCards reports the gain in.
  scoringGainStoredByPlayHand: true,

  // A14. Engine.jokerText(run, uid) shows a live value somewhere in its string as the bare
  //      number (or the plural rank word), whatever the wording around it.
  liveTextHoldsNumber: true,

  // A15. Old Flame, having taken on a sold Joker, runs that Joker's events on its own copied
  //      state too ("acts exactly as that Joker, with its own state that keeps growing or burning
  //      down"), including Last Laugh's `sold` event when Old Flame itself is sold.
  oldFlameRunsCopiedEvents: true,

  // A16. Legendary Jokers come from Engine.addJoker (the SPEC §4.2 test hook) and from Tall Tale
  //      (spectral id 'originstory') used from a consumable slot.
  legendaryHook: 'addJoker',
};

// ================================================================== design tables (typed in from the design)
// The 120 Jokers: id -> [design name, rarity, cost] (content/content-plan.json, CONTENT.md tables).
export const DESIGN = {
  // common (60)
  jinglejester: ['Jingle Jester', 'common', 4],
  pipsqueak: ['Pipsqueak', 'common', 4],
  gingerbreadfool: ['Gingerbread Fool', 'common', 4],
  partyhorn: ['Party Horn', 'common', 4],
  papercrown: ['Paper Crown', 'common', 4],
  couponclipper: ['Coupon Clipper', 'common', 4],
  emptyseats: ['Empty Seats', 'common', 4],
  pinwheel: ['Pinwheel', 'common', 4],
  sleightofhand: ['Sleight of Hand', 'common', 4],
  doubleact: ['Double Act', 'common', 4],
  tallyowl: ['Tally Owl', 'common', 5],
  magpie: ['Magpie', 'common', 5],
  tindrum: ['Tin Drum', 'common', 3],
  emberimp: ['Ember Imp', 'common', 3],
  solofiddler: ['Solo Fiddler', 'common', 4],
  matchingsocks: ['Matching Socks', 'common', 4],
  squaredance: ['Square Dance', 'common', 4],
  hattrick: ['Hat Trick', 'common', 4],
  tightrope: ['Tightrope', 'common', 4],
  peacock: ['Peacock', 'common', 4],
  clowncar: ['Clown Car', 'common', 4],
  quartet: ['Quartet', 'common', 3],
  rednose: ['Red Nose', 'common', 5],
  blackcat: ['Black Cat', 'common', 5],
  jewelbox: ['Jewel Box', 'common', 6],
  luckysevens: ['Lucky Sevens', 'common', 5],
  anklebiters: ['Ankle Biters', 'common', 4],
  jackinthebox: ['Jack-in-the-Box', 'common', 5],
  tophat: ['Top Hat', 'common', 4],
  aceupthesleeve: ['Ace Up the Sleeve', 'common', 4],
  portraitgallery: ['Portrait Gallery', 'common', 5],
  peekaboo: ['Peek-a-Boo', 'common', 4],
  earlybird: ['Early Bird', 'common', 4],
  prizerosette: ['Prize Rosette', 'common', 4],
  doorman: ['Doorman', 'common', 3],
  spinningtop: ['Spinning Top', 'common', 4],
  brassabacus: ['Brass Abacus', 'common', 3],
  lastlaugh: ['Last Laugh', 'common', 4],
  dartboard: ['Dartboard', 'common', 4],
  accordion: ['Accordion', 'common', 5],
  packrat: ['Pack Rat', 'common', 5],
  pawnbroker: ['Pawnbroker', 'common', 5],
  tealeaves: ['Tea Leaves', 'common', 4],
  stargazer: ['Stargazer', 'common', 5],
  drippingcandle: ['Dripping Candle', 'common', 4],
  merrygoround: ['Merry-Go-Round', 'common', 5],
  courtace: ['Court Ace', 'common', 4],
  highfive: ['High Five', 'common', 4],
  understudy: ['Understudy', 'common', 4],
  jesterparade: ['Jester Parade', 'common', 4],
  fancydress: ['Fancy Dress', 'common', 4],
  signetring: ['Signet Ring', 'common', 4],
  bravobouquet: ['Bravo Bouquet', 'common', 4],
  grandfinale: ['Grand Finale', 'common', 4],
  hotcocoa: ['Hot Cocoa', 'common', 3],
  nightwatchman: ['Night Watchman', 'common', 4],
  seesaw: ['Seesaw', 'common', 4],
  pennilesspoet: ['Penniless Poet', 'common', 4],
  orrery: ['Orrery', 'common', 5],
  patchworkdoll: ['Patchwork Doll', 'common', 4],
  // uncommon (40)
  sableknave: ['Sable Knave', 'uncommon', 6],
  redhanded: ['Red-Handed', 'uncommon', 6],
  congaline: ['Conga Line', 'uncommon', 6],
  moneybags: ['Moneybags', 'uncommon', 6],
  openingact: ['Opening Act', 'uncommon', 6],
  finalbow: ['Final Bow', 'uncommon', 7],
  chimneysweep: ['Chimney Sweep', 'uncommon', 6],
  goldtooth: ['Gold Tooth', 'uncommon', 6],
  oldstager: ['Old Stager', 'uncommon', 6],
  paperclip: ['The Paperclip', 'uncommon', 6],
  lamplighter: ['Lamplighter', 'uncommon', 7],
  fandancer: ['Fan Dancer', 'uncommon', 7],
  maypole: ['Maypole', 'uncommon', 7],
  callandresponse: ['Call and Response', 'uncommon', 6],
  bookends: ['Bookends', 'uncommon', 6],
  onemanband: ['One-Man Band', 'uncommon', 7],
  colourguard: ['Colour Guard', 'uncommon', 6],
  threesacrowd: ["Three's a Crowd", 'uncommon', 6],
  twoscompany: ["Two's Company", 'uncommon', 6],
  pocketlint: ['Pocket Lint', 'uncommon', 6],
  signaturemove: ['Signature Move', 'uncommon', 7],
  headsortails: ['Heads or Tails', 'uncommon', 6],
  velvetrope: ['Velvet Rope', 'uncommon', 6],
  shoeshine: ['Shoeshine', 'uncommon', 6],
  thimble: ['Thimble', 'uncommon', 7],
  moonstruck: ['Moonstruck', 'uncommon', 7],
  palmreader: ['Palm Reader', 'uncommon', 6],
  crystalgazer: ['Crystal Gazer', 'uncommon', 6],
  paymaster: ['Paymaster', 'uncommon', 6],
  facevalue: ['Face Value', 'uncommon', 6],
  carpetbag: ['Carpetbag', 'uncommon', 7],
  helpinghand: ['Helping Hand', 'uncommon', 5],
  nestingdolls: ['Nesting Dolls', 'uncommon', 5],
  makeover: ['Makeover', 'uncommon', 6],
  luckydip: ['Lucky Dip', 'uncommon', 7],
  bigspender: ['Big Spender', 'uncommon', 6],
  nailbiter: ['Nail-Biter', 'uncommon', 6],
  smoothtalker: ['Smooth Talker', 'uncommon', 8],
  coronation: ['Coronation', 'uncommon', 5],
  usher: ['Usher', 'uncommon', 5],
  // rare (15)
  bigtop: ['Big Top', 'rare', 8],
  pokerface: ['Poker Face', 'rare', 8],
  dragontamer: ['Dragon Tamer', 'rare', 9],
  fortunecookie: ['Fortune Cookie', 'rare', 8],
  standin: ['Stand-In', 'rare', 9],
  oldflame: ['Old Flame', 'rare', 8],
  jackofalltrades: ['Jack of All Trades', 'rare', 8],
  nightmoth: ['Night Moth', 'rare', 7],
  ticketcollector: ['Ticket Collector', 'rare', 8],
  reprise: ['Reprise', 'rare', 9],
  kaleidoscope: ['Kaleidoscope', 'rare', 8],
  galanight: ['Gala Night', 'rare', 8],
  brazier: ['Brazier', 'rare', 7],
  goldenhour: ['Golden Hour', 'rare', 8],
  blackjack: ['Blackjack', 'rare', 7],
  // legendary (5)
  candleking: ['The Candle King', 'legendary', 20],
  madameecho: ['Madame Echo', 'legendary', 20],
  puppetmaster: ['The Puppet Master', 'legendary', 20],
  sirmotley: ['Sir Motley', 'legendary', 20],
  ringmaster: ['The Ringmaster', 'legendary', 20],
};
export const DESIGN_IDS = Object.keys(DESIGN);
export const LEGENDARY_IDS = DESIGN_IDS.filter((id) => DESIGN[id][1] === 'legendary');

// SPEC §2.2: id -> [base Chips, base Mult, +Chips per level, +Mult per level]
export const HANDS = {
  straightflush: [110, 8, 45, 4], four: [64, 6, 32, 3], fullhouse: [44, 4, 27, 2], flush: [38, 4, 18, 2],
  straight: [34, 4, 32, 3], three: [32, 3, 22, 2], twopair: [22, 2, 22, 1], pair: [12, 2, 16, 1], high: [5, 1, 12, 1],
};
export const HAND_IDS = Object.keys(HANDS);
export const ENHANCEMENT_IDS = ['inked', 'punchy', 'dimestore', 'popout', 'scribbled', 'spotlit', 'vintage', 'crumpled'];
export const EDITION_IDS = ['gloss', 'benday', 'fourcolor', 'inverted'];
export const SEAL_IDS = ['encore', 'paid', 'airmail', 'cameo'];
export const TAROT_IDS = [
  'inkpot', 'boxingglove', 'pricegun', 'threedglasses', 'crayon', 'spotlight', 'backissues', 'scrunch', 'eraser', 'ladder',
  'shrinkray', 'paintbucket', 'carboncopy', 'paperroute', 'gueststar', 'overtime', 'doover', 'happyaccident', 'launchpad', 'reprint',
];
export const SPECTRAL_IDS = [
  'curtaincall', 'cursedcoin', 'deadletter', 'apparition', 'phantomink', 'upsidedown', 'hauntedpress', 'midnightedition',
  'wormhole', 'vanishingact', 'ghostwriter', 'doppelganger', 'spellbound', 'graveyardshift', 'hallofmirrors', 'originstory',
];
// SPEC §3.7: the Planet card of each hand.
export const PLANET_OF = {
  high: 'blip', pair: 'boing', twopair: 'zipzap', three: 'kerplunk', straight: 'zoom',
  flush: 'swoosh', fullhouse: 'kaboom', four: 'thwack', straightflush: 'bigbang',
};
// SPEC §3.12: id -> [kind, size, shown, picks, price]
export const PACKS = {
  cardnormal: ['card', 'normal', 4, 1, 4], cardjumbo: ['card', 'jumbo', 6, 1, 6], cardmega: ['card', 'mega', 6, 2, 9],
  tarotnormal: ['tarot', 'normal', 4, 1, 4], tarotjumbo: ['tarot', 'jumbo', 6, 1, 6], tarotmega: ['tarot', 'mega', 6, 2, 9],
  planetnormal: ['planet', 'normal', 4, 1, 4], planetjumbo: ['planet', 'jumbo', 6, 1, 6], planetmega: ['planet', 'mega', 6, 2, 9],
  jokernormal: ['joker', 'normal', 2, 1, 6], jokerjumbo: ['joker', 'jumbo', 3, 1, 8], jokermega: ['joker', 'mega', 4, 2, 10],
  ghostnormal: ['ghost', 'normal', 2, 1, 5], ghostjumbo: ['ghost', 'jumbo', 3, 1, 7], ghostmega: ['ghost', 'mega', 4, 2, 10],
};

// ================================================================== generic helpers
export const plain = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
export function deq(actual, expected, message) {
  assert.deepStrictEqual(plain(actual), plain(expected), message);
}
export const sorted = (list) => plain(list).slice().sort();
export function pickKeys(obj, keys) {
  const o = {};
  for (const k of keys) o[k] = obj == null ? undefined : obj[k];
  return o;
}
export const approx = (a, b, eps = 1e-9) => typeof a === 'number' && Math.abs(a - b) < eps;
export const totals = (res) => pickKeys(res, ['chips', 'mult', 'total']);

// Seeds use the randomSeed alphabet (A-Z and 2-9 without O and I).
const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function seedN(n) {
  let x = n >>> 0;
  let s = '';
  for (let i = 0; i < 8; i++) {
    s = SEED_ALPHABET[x % 32] + s;
    x = Math.floor(x / 32);
  }
  return s;
}
export const SEED = 'JOKERSBB';

// ------------------------------------------------------------------ content lookups (run time)
function rowsOf(table) {
  if (!table) return [];
  return Array.isArray(table) ? Array.from(table) : Object.values(table);
}
export const rows = (name) => rowsOf(Content[name]);
export const rowById = (name, id) => rows(name).find((r) => r && r.id === id) || null;
export const jokerRow = (id) => rowById('JOKERS', id);
// The display name the game shows (TW.Content), falling back to the design name for messages.
export const jokerName = (id) => (jokerRow(id) && jokerRow(id).name) || (DESIGN[id] && DESIGN[id][0]) || id;
// A label for test titles and failure messages: the design name plus the id.
export const label = (id) => `${(DESIGN[id] && DESIGN[id][0]) || id} (${id})`;

// ------------------------------------------------------------------ result helpers
export function ok(r, what = 'call') {
  assert.ok(r && typeof r === 'object', `${what}: returns a result object, got ${JSON.stringify(plain(r))}`);
  assert.equal(r.ok, true, `${what} failed: ${r && r.error}`);
  return plain(r);
}
export function bad(r, what = 'call', error) {
  assert.ok(r && typeof r === 'object', `${what}: returns a result object`);
  assert.equal(r.ok, false, `${what} must fail`);
  assert.equal(typeof r.error, 'string', `${what}: error is a sentence`);
  if (error instanceof RegExp) assert.match(r.error, error, what);
  else if (error) assert.equal(r.error, error, what);
  return plain(r);
}

// ------------------------------------------------------------------ run helpers
export function mkRun(opts = {}) {
  const o = { seed: SEED };
  for (const [k, v] of Object.entries(opts)) if (v !== undefined) o[k] = v;
  const run = Engine.newRun(o);
  assert.ok(run && typeof run === 'object', 'newRun returns a run');
  return run;
}
// Starts the current Blind, optionally after moving to another Ante / Blind / Boss first.
export function begin(run, { ante, blindIndex, boss } = {}) {
  if (ante != null) run.ante = ante;
  if (blindIndex != null) run.blindIndex = blindIndex;
  if (boss !== undefined) run.bosses[run.ante] = boss;
  return ok(Engine.startBlind(run), 'startBlind');
}
export function blindRun(opts = {}, at = {}) {
  const run = mkRun(opts);
  begin(run, at);
  return run;
}
// A Boss Blind at Ante 1 with the given Boss (The Smudge only hides ranks in the UI, so it is
// the neutral Boss for "a Boss Blind" tests).
export function bossRun(bossId = 'smudge', opts = {}) {
  const run = mkRun(opts);
  begin(run, { blindIndex: 2, boss: bossId });
  assert.equal(run.blind.boss, bossId, 'the Boss Blind is set up');
  return run;
}

// Cards: 'KS' = King of Spades, '10H', 'AD', '2C'.
const RANK_OF = { A: 14, K: 13, Q: 12, J: 11 };
export function parseCode(code) {
  const m = /^(10|[2-9AKQJ])([SHDC])$/.exec(code);
  if (!m) throw new Error('bad card code ' + code);
  return { rank: RANK_OF[m[1]] || Number(m[1]), suit: m[2] };
}
// A loose card for scoreCards: mk('KS', { enhancement:'inked', edition:'gloss', seal:'encore' }).
export function mk(code, extra = {}) {
  const { rank, suit } = parseCode(code);
  const { grow, ...opts } = extra;
  const card = Engine.makeCard(rank, suit, opts);
  assert.ok(card && card.uid, 'makeCard returns a card');
  if (grow != null) card.grow = grow;
  return card;
}
export const cards = (...codes) => codes.map((c) => mk(c));
export const KK = () => [mk('KS'), mk('KH')]; // a plain Pair of Kings: 12 + 10 + 10 = 32 Chips x 2 Mult = 64
export const cardRef = (run, uid) => run.cards.find((c) => c.uid === uid) || null;
export const handCards = (run) => run.blind.hand.map((u) => cardRef(run, u));
// Rewrites the first specs.length cards in hand and pins the hand order (sortMode 'manual').
// A spec is 'KS' or { code:'KS', enhancement, edition, seal, grow }. Returns their uids in order.
export function setHand(run, specs) {
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

export function score(run, played, held = []) {
  const res = Engine.scoreCards(run, played, held);
  assert.ok(res && Array.isArray(res.steps), 'scoreCards returns a ScoreResult');
  return plain(res);
}
export function play(run, uids) {
  return ok(Engine.playHand(run, uids), 'playHand');
}
export function discard(run, uids) {
  return ok(Engine.discard(run, uids), 'discard');
}
// Plays the lowest card in hand alone (a High Card worth at most a few dozen points), so the
// Blind goes on. Returns the playHand result.
export function playLow(run) {
  const uid = run.blind.hand[run.blind.hand.length - 1];
  const r = play(run, [uid]);
  assert.equal(r.cleared, false, 'a lone low card does not clear the Blind');
  return r;
}
// Clears the running Blind: the score is set just under the target and one card is played.
export function clearBlind(run, { money } = {}) {
  assert.equal(run.phase, 'play', 'a Blind is running');
  run.blind.score = run.blind.target - 1;
  if (money != null) run.money = money;
  const r = play(run, [run.blind.hand[0]]);
  assert.equal(r.cleared, true, 'the hand clears the Blind');
  return r;
}
export function toShop(run, clearOpts) {
  if (run.phase === 'blind-select') begin(run);
  clearBlind(run, clearOpts);
  ok(Engine.collect(run), 'collect');
  assert.equal(run.phase, 'shop');
  return run;
}
export function shopRun(opts = {}, clearOpts) {
  const run = mkRun(opts);
  toShop(run, clearOpts);
  return run;
}
// From the cash-out or the Shop to the next Blind, started.
export function nextBlind(run, at = {}) {
  if (run.phase === 'cashout') ok(Engine.collect(run), 'collect');
  if (run.phase === 'shop') ok(Engine.leaveShop(run), 'leaveShop');
  return begin(run, at);
}
export const shopItems = (run, slot) =>
  run.shop.items.map((it, index) => ({ ...plain(it), index })).filter((x) => !slot || x.slot === slot);
// ASSUMED A1: rewrites the nth pack slot to the given pack row.
export function forcePack(run, packId, nth = 0) {
  const row = PACKS[packId];
  const p = shopItems(run, ASSUMED.slot.pack)[nth];
  assert.ok(p, `the Shop has pack slot ${nth}`);
  Object.assign(run.shop.items[p.index], { id: packId, size: row[1], sold: false, price: row[4] });
  return p.index;
}
export function openPack(run, packId, nth = 0) {
  const i = forcePack(run, packId, nth);
  run.money += PACKS[packId][4];
  const r = ok(Engine.buy(run, i), `buy ${packId}`);
  assert.equal(r.opened, true, 'buying a pack opens it');
  assert.equal(run.phase, 'pack');
  return r;
}
// Card-slot item rewritten in place, e.g. { kind:'tarot', id:'paperroute', price:3 }.
export function forceCard(run, fields, nth = 0) {
  const c = shopItems(run, ASSUMED.slot.card)[nth];
  assert.ok(c, `the Shop has card slot ${nth}`);
  Object.assign(run.shop.items[c.index], { edition: null, sold: false }, fields);
  return c.index;
}
export function skipWith(run, tagId) {
  run.tags[`${run.ante}-${run.blindIndex}`] = tagId;
  return ok(Engine.skipBlind(run), `skip for ${tagId}`);
}
// Puts a consumable straight into the slots, in the engine's own shape (SPEC §2.1).
export function give(run, kind, id) {
  const c = { uid: 'k' + run.nextUid++, kind, id };
  run.consumables.push(c);
  return c.uid;
}
export function use(run, uid, selected = []) {
  return ok(Engine.useConsumable(run, uid, selected), 'useConsumable');
}
export function pick(run, index, selected = []) {
  return ok(Engine.packPick(run, index, selected), 'packPick');
}
export const packHand = (run) => (run.pack && run.pack.hand) || [];

// ------------------------------------------------------------------ Joker helpers
// For tests that get a Joker some other way than addJoker (buying it): the row must exist.
export function needRow(id) {
  assert.ok(jokerRow(id), `${label(id)}: the design row '${id}' is not in TW.Content.JOKERS yet`);
}
export const live = (run, uid) => run.jokers.find((j) => j.uid === uid) || null;
export const owns = (run, uid) => run.jokers.some((j) => j.uid === uid);
// Adds a design Joker through the SPEC §4.2 test hook; fails with a message naming the Joker.
export function addJ(run, id, edition = null) {
  let j;
  try {
    j = Engine.addJoker(run, id, 0, edition);
  } catch (e) {
    assert.fail(`${label(id)}: Engine.addJoker threw: ${e && e.message}`);
  }
  assert.ok(
    j && j.uid,
    `${label(id)}: Engine.addJoker(run, '${id}') returned ${JSON.stringify(plain(j) ?? null)}; ` +
      `expected a Joker instance (the design row '${id}' is not in TW.Content.JOKERS yet, or the rack is full)`,
  );
  return live(run, j.uid) || j;
}
// The Joker's state value under its ASSUMED (A2) key.
export function st(run, j, key = ASSUMED.state[j.id]) {
  const x = live(run, j.uid);
  assert.ok(x, `${label(j.id)}: still in the rack`);
  assert.ok(x.state && typeof x.state === 'object', `${label(j.id)}: has a state object`);
  return plain(x.state[key]);
}
export function setSt(run, j, value, key = ASSUMED.state[j.id]) {
  const x = live(run, j.uid);
  assert.ok(x && x.state && typeof x.state === 'object', `${label(j.id)}: has a state object`);
  x.state[key] = value;
}
// The Joker's own effect steps (via 'joker'), as [kind, amount].
export const jokerSteps = (res, j) =>
  res.steps.filter((s) => s.source === 'joker' && s.uid === j.uid && s.via === 'joker').map((s) => [s.kind, s.amount]);
export const editionSteps = (res, j) =>
  res.steps.filter((s) => s.source === 'joker' && s.uid === j.uid && s.via === 'edition').map((s) => [s.kind, s.amount, s.edition]);
export const moneySteps = (res) => res.steps.filter((s) => s.kind === 'money').map((s) => s.amount);
export const againNotes = (res) => res.steps.filter((s) => s.label === 'Encore!');
export const cashLines = (run) => plain((run.cashout && run.cashout.lines) || []);
export const jokerLine = (run, id) => cashLines(run).find((l) => l.label === jokerName(id)) || null;

// Asserts the totals, with a message naming the Joker, the situation and the expected arithmetic.
export function expectTotals(id, res, chips, mult, total, how) {
  deq(
    totals(res),
    { chips, mult, total },
    `${label(id)}: ${how}: expected ${chips} x ${mult} = ${total}, got ${res.chips} x ${res.mult} = ${res.total}`,
  );
}
export function expectJokerSteps(id, res, j, expected, how = 'its own steps') {
  deq(jokerSteps(res, j), expected, `${label(id)}: ${how}: expected Joker steps ${JSON.stringify(expected)}`);
}
