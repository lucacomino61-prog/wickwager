/*
 * Engine v3: the Joker vocabulary words added on 2026-11-23 (SPEC.md §3.4, CONTENT.md "Joker
 * vocabulary"): 20 conditions, 10 counters, 9 events, 12 event operations, 1 setter, 16 rules
 * (the copy mechanism of Stand-In, Old Flame and The Puppet Master included) and 2 amount forms.
 *
 * Each word is tested with test-only Joker rows that use it, added to TW.Content.JOKERS in a
 * separate vm context before the engine loads (the real table holds the 120 Jokers of the plan
 * since 2026-11-23; tests/jokers.test.mjs tests those rows). Every word gets a positive and a negative case; the tests also check the trace
 * steps, state carried across hands and Blinds, and the JSON round trip of the new state.
 * Expected numbers are worked out by hand: a Pair of Kings (KK) is 12 + 10 + 10 = 32 Chips x 2
 * Mult = 64; a lone King (High Card) 5 + 10 = 15 x 1 = 15; a lone 2 is 7 x 1 = 7.
 *
 * The check of the plan's own rows reads content/content-plan.json (local-only) and skips where it is absent
 * (tests/local-data.mjs).
 *
 * Run from the project root: node --test "tests/*.test.mjs"
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { needs } from './local-data.mjs';

// ------------------------------------------------------------------ loading
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CONTENT_FILE = path.join(ROOT, 'src', 'content.js');
const ENGINE_FILE = path.join(ROOT, 'src', 'engine.js');
const CONTENT_SRC = fs.readFileSync(CONTENT_FILE, 'utf8');
const ENGINE_SRC = fs.readFileSync(ENGINE_FILE, 'utf8');

// Test-only Joker rows, one or more per word (modelled on the content-plan rows that need it).
const J = (id, rarity, cost, row) => Object.assign({ id, name: `V ${id.slice(1)}`, rarity, cost, text: `Test row ${id}.` }, row);
const ROWS = [
  // conditions
  J('vjewel', 'common', 6, { effects: [{ on: 'hand', when: { scoredSuitCount: { suit: 'D', min: 3 } }, money: 2 }] }),
  J('vtophat', 'common', 4, { effects: [{ on: 'held', when: { highestHeld: true }, chips: 3, per: 'cardRank' }] }),
  J('vace', 'common', 4, { effects: [{ on: 'hand', when: { heldRank: 14 }, mult: 10 }] }),
  J('vdart', 'common', 4, { effects: [{ on: 'cashout', when: { clearedOnFirstHand: true }, money: 3 }] }),
  J('vnail', 'uncommon', 6, { state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { blindCleared: [{ when: { clearedOnLastHand: true }, add: { mult: 4 } }] }, live: true }),
  J('vtea', 'common', 4, { state: { chips: 0 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { consumableUsed: [{ when: { kind: 'tarot' }, add: { chips: 6 } }] }, live: true }),
  J('vgazer', 'uncommon', 6, { events: { consumableUsed: [{ when: { kind: 'tarot' }, money: 2 }] } }),
  J('vfancy', 'common', 4, { effects: [{ on: 'card', when: { enhanced: true }, mult: 2 }] }),
  J('vreprise', 'rare', 9, { effects: [{ on: 'retrigger', when: { enhanced: true } }] }),
  J('vgala', 'rare', 8, { effects: [{ on: 'hand', when: { allEnhanced: true }, xmult: 2 }] }),
  J('vbravo', 'common', 4, { effects: [{ on: 'card', when: { seal: 'encore' }, chips: 20 }] }),
  J('vmaypole', 'uncommon', 7, { effects: [{ on: 'retrigger', when: { seal: 'any' } }] }),
  J('vfinale', 'common', 4, { effects: [{ on: 'hand', when: { lastHand: true }, chips: 60 }] }),
  J('vseesaw', 'common', 4, { effects: [{ on: 'hand', when: { evenHand: true }, mult: 10 }] }),
  J('vpoet', 'common', 4, { effects: [{ on: 'hand', when: { maxMoney: 5 }, mult: 9 }] }),
  J('vguard', 'uncommon', 6, { effects: [{ on: 'hand', when: { oneColour: true }, xmult: 1.5 }] }),
  J('vlint', 'uncommon', 6, { effects: [{ on: 'hand', when: { noConsumables: true }, xmult: 1.5 }] }),
  J('vsignature', 'uncommon', 7, { effects: [{ on: 'hand', when: { mostPlayed: true }, xmult: 1.5 }] }),
  J('vcoin', 'uncommon', 6, { state: { side: 'heads' }, effects: [{ on: 'hand', when: { stateIs: { side: 'heads' } }, xmult: 2 }], events: { afterHand: [{ set: { side: 'coinFlip' } }] } }),
  J('vcall', 'uncommon', 6, { effects: [{ on: 'retrigger', when: { heldSameRank: true } }] }),
  J('vbookends', 'uncommon', 6, { effects: [{ on: 'retrigger', when: { firstOrLast: true } }] }),
  J('vpalm', 'uncommon', 6, { events: { discard: [{ when: { pairDiscard: true }, createTarot: 1 }] } }),
  J('vblackjack', 'rare', 7, { effects: [{ on: 'hand', when: { sum21: true }, xmult: 3 }] }),
  // counters
  J('vpeek', 'common', 4, { effects: [{ on: 'hand', chips: 20, per: 'heldPairs' }] }),
  J('vearly', 'common', 4, { effects: [{ on: 'cashout', money: 1, per: 'handsLeft' }] }),
  J('vunder', 'common', 4, { effects: [{ on: 'hand', mult: 3, per: 'unscoredCards' }] }),
  J('vparade', 'common', 4, { effects: [{ on: 'hand', chips: 12, per: 'otherCommonJokers' }], live: true }),
  J('vsignet', 'common', 4, { effects: [{ on: 'hand', chips: 10, per: 'sealedCards' }], live: true }),
  J('vorrery', 'common', 5, { effects: [{ on: 'hand', mult: 2, per: 'levelsAbove1' }] }),
  J('vvelvet', 'uncommon', 6, { effects: [{ on: 'hand', xmult: 1.25, per: 'editionJokers' }], live: true }),
  J('vring', 'legendary', 20, { effects: [{ on: 'hand', xmult: 1.3, per: 'otherJokers' }], live: true }),
  J('vpay', 'uncommon', 6, { effects: [{ on: 'cashout', money: 1, per: 'otherJokers' }], live: true }),
  J('vticket', 'rare', 8, { effects: [{ on: 'hand', xmult: 0.25, per: 'vouchers', linear: true }], live: true }),
  // events
  J('vjack', 'common', 5, { state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { cardScored: [{ when: { rank: 11 }, add: { mult: 1 } }] }, live: true }),
  J('vaccordion', 'common', 5, { state: { chips: 0 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { handScored: [{ when: { minPlayed: 5 }, add: { chips: 3 } }] }, live: true }),
  J('vpackrat', 'common', 5, { state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { packOpened: [{ add: { mult: 1 } }] }, live: true }),
  J('vpawn', 'common', 5, { state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { jokerSold: [{ add: { mult: 2 } }] }, live: true }),
  J('vlaugh', 'common', 4, { events: { sold: [{ extraHand: 1 }] } }),
  J('vstar', 'common', 5, { state: { planets: 0 }, effects: [{ on: 'hand', mult: 1, per: { state: 'planets', every: 2 } }], events: { consumableUsed: [{ when: { kind: 'planet' }, add: { planets: 1 } }] }, live: true }),
  J('vdoll', 'common', 4, { state: { chips: 0 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { cardAdded: [{ add: { chips: 4 }, perCard: true }] }, live: true }),
  J('vmakeover', 'uncommon', 6, { events: { cardAdded: [{ enhanceAdded: 'random' }] } }),
  J('vbrazier', 'rare', 7, { state: { x: 1 }, effects: [{ on: 'hand', xmult: { state: 'x' } }], events: { cardDestroyed: [{ add: { x: 0.2 }, perCard: true }] }, live: true }),
  J('vspender', 'uncommon', 6, { state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { purchase: [{ add: { mult: 1 } }] }, live: true }),
  // event operations
  J('vdoor', 'common', 3, { events: { blindStart: [{ money: 1 }] } }),
  J('vface', 'uncommon', 6, { events: { discard: [{ money: 1, perFace: true }] } }),
  J('vcocoa', 'common', 3, { events: { blindCleared: [{ when: { bossBlind: true }, gainTag: 'secondwind' }] } }),
  J('vshine', 'uncommon', 6, { events: { blindCleared: [{ when: { bossBlind: true }, editionDeckCards: { count: 2, weights: { gloss: 50, benday: 35, fourcolor: 15, inverted: 99 } } }] } }),
  J('vthimble', 'uncommon', 7, { events: { blindStart: [{ sealHandCard: 1 }] } }),
  J('vmoon', 'uncommon', 7, { events: { blindStart: [{ createPlanet: 'mostPlayed' }] } }),
  J('vmoth', 'rare', 7, { events: { blindCleared: [{ when: { bossBlind: true }, createSpectral: 1 }] } }),
  J('vbag', 'uncommon', 7, { events: { discard: [{ handSizeThisBlind: { add: 1, max: 3 } }] } }),
  J('vcrown', 'uncommon', 5, { events: { afterHand: [{ rankUpScored: { 11: 12, 12: 13 } }] } }),
  // rules
  J('vsleight', 'common', 4, { state: { used: false }, rules: { freeSmallDiscard: 2 } }),
  J('vtop', 'common', 4, { rules: { rerollDiscount: 1 } }),
  J('vabacus', 'common', 3, { rules: { interestStep: 4 } }),
  J('vmerry', 'common', 5, { rules: { wrapStraights: true } }),
  J('vcourt', 'common', 4, { rules: { acesAreFaces: true } }),
  J('vfan', 'uncommon', 7, { rules: { fourCardFlush: true } }),
  J('vnest', 'uncommon', 5, { rules: { handsContain: true } }),
  J('vhelp', 'uncommon', 5, { rules: { tarotSelectPlus: 1 } }),
  J('vdip', 'uncommon', 7, { state: { used: false }, rules: { firstPackExtraPick: 1 } }),
  J('vsmooth', 'uncommon', 8, { rules: { bossTargetMult: 0.8 } }),
  J('vusher', 'uncommon', 5, { rules: { voucherPriceMult: 0.5 } }),
  J('vjat', 'rare', 8, { rules: { wildJacks: true } }),
  J('vkaleido', 'rare', 8, { rules: { editionsTwice: true } }),
  J('vgolden', 'rare', 8, { rules: { blindMoneyX: 2 } }),
  J('vmotley', 'legendary', 20, { rules: { everySuit: true } }),
  J('vstandin', 'rare', 9, { state: { target: null }, rules: { copy: 'random' } }),
  J('vflame', 'rare', 8, { state: { copy: null }, rules: { copy: 'lastSold' } }),
  J('vpuppet', 'legendary', 20, { rules: { copy: 'neighbours' } }),
  // plain rows the tests combine with the words
  J('vdrum', 'common', 3, { effects: [{ on: 'hand', chips: 40 }] }),
  J('vimp', 'common', 3, { effects: [{ on: 'hand', mult: 5 }] }),
  J('vcrownface', 'common', 4, { effects: [{ on: 'card', when: { face: true }, chips: 12 }] }),
  J('vpair', 'common', 4, { effects: [{ on: 'hand', when: { hands: ['pair'] }, chips: 25 }] }),
  J('vhigh', 'common', 4, { effects: [{ on: 'hand', when: { hands: ['high'] }, mult: 8 }] }),
  J('vredsuit', 'common', 5, { effects: [{ on: 'card', when: { suits: ['H', 'D'] }, mult: 2 }] }),
  J('vmagpie', 'common', 5, { state: { chips: 0 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { discard: [{ add: { chips: 2 }, perCard: true, max: { chips: 100 } }] }, live: true }),
  J('vcandle', 'common', 4, { state: { mult: 15 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { afterHand: [{ add: { mult: -1 }, eatenAt: { mult: 0 } }] }, live: true }),
  J('vgold', 'uncommon', 6, { effects: [{ on: 'card', when: { rank: 14 }, money: 1 }] }),
  J('vstager', 'uncommon', 6, { effects: [{ on: 'card', chips: 2, per: 'ante' }], live: true }),
  J('vclipper', 'common', 4, { effects: [{ on: 'cashout', money: 1, per: 'discardsLeft' }] }),
  J('vecho', 'legendary', 20, { effects: [{ on: 'retrigger' }] }),
  J('vclip', 'uncommon', 6, { effects: [{ on: 'held', chips: 5 }] }),
];
const ROWS_JS = `TW.Content.JOKERS.push(...${JSON.stringify(ROWS)});`;

function makeContext(afterContent) {
  const ctx = vm.createContext({ console });
  vm.runInContext(CONTENT_SRC, ctx, { filename: CONTENT_FILE });
  if (afterContent) vm.runInContext(afterContent, ctx);
  vm.runInContext(ENGINE_SRC, ctx, { filename: ENGINE_FILE });
  return ctx;
}
const context = makeContext(ROWS_JS);
const TW = vm.runInContext('globalThis.TW', context);
const Engine = TW.Engine;
const Content = TW.Content;
const NAME = Object.fromEntries(ROWS.map((r) => [r.id, r.name]));

// ------------------------------------------------------------------ helpers
const plain = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const deq = (actual, expected, msg) => assert.deepStrictEqual(plain(actual), plain(expected), msg);
const sorted = (a) => [...a].sort();
function ok(res, what = 'action') {
  assert.ok(res && typeof res === 'object', `${what}: expected a result object`);
  assert.equal(res.ok, true, `${what} failed: ${res.error}`);
  return res;
}
function fails(res, what, sentence) {
  assert.ok(res && res.ok === false, `${what}: expected { ok: false }`);
  if (sentence !== undefined) assert.equal(res.error, sentence, what);
  return res;
}
const RANK_OF = { J: 11, Q: 12, K: 13, A: 14 };
const ENH = ['inked', 'punchy', 'dimestore', 'popout', 'scribbled', 'spotlit', 'vintage', 'crumpled'];
const EDS = ['gloss', 'benday', 'fourcolor', 'inverted'];
const SEALS = ['encore', 'paid', 'airmail', 'cameo'];
// 'KS', 'QH+inked', 'AS+gloss+encore'
function parse(spec) {
  const [face, ...mods] = spec.split('+');
  const out = { rank: RANK_OF[face.slice(0, -1)] ?? Number(face.slice(0, -1)), suit: face.slice(-1), enhancement: null, edition: null, seal: null, grow: 0 };
  for (const m of mods) {
    if (ENH.includes(m)) out.enhancement = m;
    else if (EDS.includes(m)) out.edition = m;
    else if (SEALS.includes(m)) out.seal = m;
    else throw new Error(`unknown modifier ${m}`);
  }
  return out;
}
const mk = (spec) => {
  const p = parse(spec);
  return Engine.makeCard(p.rank, p.suit, { enhancement: p.enhancement, edition: p.edition, seal: p.seal });
};
const mks = (s) => (s.trim() ? s.trim().split(/\s+/).map(mk) : []);
const fresh = (opts = {}) => Engine.newRun({ seed: 'VOCAB001', ...opts });
const cardOf = (run, uid) => run.cards.find((c) => c.uid === uid);
const jokerOf = (run, uid) => run.jokers.find((j) => j.uid === uid);
function add(run, id, edition = null) {
  const j = Engine.addJoker(run, id, 0, edition);
  assert.ok(j && j.uid, `addJoker ${id}`);
  return jokerOf(run, j.uid);
}
function inBlind(opts = {}) {
  const run = fresh(opts);
  ok(Engine.startBlind(run), 'startBlind');
  return run;
}
/** A run with these Jokers in a started Small Blind. */
function blindWith(ids, opts = {}) {
  const run = fresh(opts);
  const js = ids.map((id) => add(run, id));
  ok(Engine.startBlind(run), 'startBlind');
  return [run, ...js];
}
/** Starts the Ante's Boss Blind (skipping Small and Big), optionally a given Boss Blind. */
function toBoss(run, bossId) {
  for (let i = 0; i < 2; i++) {
    run.tags[`${run.ante}-${run.blindIndex}`] = 'piggybank';
    ok(Engine.skipBlind(run), 'skipBlind');
  }
  if (bossId) run.bosses[run.ante] = bossId;
  ok(Engine.startBlind(run), 'startBlind (boss)');
  return run;
}
/** Rewrites the first cards in hand and pins the order; returns their uids. */
function setHand(run, specs, holder = run.blind) {
  const uids = holder.hand.slice();
  specs.forEach((spec, i) => Object.assign(cardOf(run, uids[i]), parse(spec)));
  ok(Engine.reorderHand(run, uids), 'reorderHand');
  return uids.slice(0, specs.length);
}
const score = (run, played, held = '') => Engine.scoreCards(run, typeof played === 'string' ? mks(played) : played, typeof held === 'string' ? mks(held) : held);
const own = (r, joker) => r.steps.filter((s) => s.uid === joker.uid);
const ownRows = (r, joker) => own(r, joker).map((s) => [s.kind, s.amount, s.label]);
function forceClear(run) {
  run.blind.score = run.blind.target - 1;
  const r = ok(Engine.playHand(run, [run.blind.hand[0]]), 'playHand (clearing)');
  assert.equal(r.cleared, true, 'the forced hand beats the Blind');
  return r;
}
function toShop(run) {
  if (run.phase === 'blind-select') ok(Engine.startBlind(run), 'startBlind');
  forceClear(run);
  ok(Engine.collect(run), 'collect');
  assert.equal(run.phase, 'shop');
  return run;
}
function give(run, kind, id) {
  const uid = `k${run.nextUid}`;
  run.nextUid += 1;
  run.consumables.push({ uid, kind, id });
  return uid;
}
const use = (run, kind, id, sel = []) => ok(Engine.useConsumable(run, give(run, kind, id), sel), `use ${id}`);
function buyPack(run, packId, nth = 0) {
  const slots = run.shop.items.map((it, i) => [it, i]).filter(([it]) => it.slot === 'pack');
  const [it, i] = slots[nth];
  Object.assign(it, { id: packId, size: Content.PACKS.find((p) => p.id === packId).size, sold: false, price: 1 });
  run.money = Math.max(run.money, 50);
  return ok(Engine.buy(run, i), `buy ${packId}`);
}
const evOps = (res, op) => (res.jokerEvents || []).filter((e) => e.op === op);

// =========================================================================================
describe('vocabulary: the word lists and jokerProblems', () => {
  test('Engine.VOCABULARY lists every new word, and the amount forms', () => {
    const V = Engine.VOCABULARY;
    for (const w of ['scoredSuitCount', 'highestHeld', 'heldRank', 'clearedOnFirstHand', 'clearedOnLastHand', 'kind', 'enhanced', 'allEnhanced', 'seal', 'lastHand', 'evenHand', 'maxMoney', 'oneColour', 'noConsumables', 'mostPlayed', 'stateIs', 'heldSameRank', 'firstOrLast', 'pairDiscard', 'sum21']) assert.ok(V.conditions.includes(w), `condition ${w}`);
    for (const w of ['cardRank', 'heldPairs', 'handsLeft', 'unscoredCards', 'otherCommonJokers', 'sealedCards', 'levelsAbove1', 'editionJokers', 'otherJokers', 'vouchers']) assert.ok(V.counters.includes(w), `counter ${w}`);
    for (const w of ['cardScored', 'handScored', 'packOpened', 'jokerSold', 'sold', 'consumableUsed', 'cardAdded', 'cardDestroyed', 'purchase']) assert.ok(V.events.includes(w), `event ${w}`);
    for (const w of ['money', 'perFace', 'extraHand', 'gainTag', 'editionDeckCards', 'sealHandCard', 'createPlanet', 'createTarot', 'createSpectral', 'handSizeThisBlind', 'enhanceAdded', 'rankUpScored']) assert.ok(V.eventOps.includes(w), `eventOp ${w}`);
    assert.ok(V.setters.includes('coinFlip'));
    for (const w of ['freeSmallDiscard', 'rerollDiscount', 'interestStep', 'wrapStraights', 'acesAreFaces', 'fourCardFlush', 'handsContain', 'tarotSelectPlus', 'firstPackExtraPick', 'bossTargetMult', 'voucherPriceMult', 'wildJacks', 'editionsTwice', 'blindMoneyX', 'everySuit', 'copy']) assert.ok(V.rules.includes(w), `rule ${w}`);
    for (const w of ['perState', 'linear']) assert.ok(V.amounts.includes(w), `amount ${w}`);
    // the words of the first vocabulary are all still there
    for (const w of ['maxPlayed', 'minPlayed', 'firstHand', 'hands', 'face', 'suit', 'suits', 'rank', 'ranks', 'first', 'last', 'stateRank', 'noDiscards', 'bossBlind']) assert.ok(V.conditions.includes(w), w);
    assert.ok(V.rules.includes('freeFirstDiscard'));
  });

  test('every test row is sound (Engine.jokerProblems)', () => {
    for (const row of ROWS) deq(Engine.jokerProblems(row), [], row.id);
  });

  test('all 120 engine rows of content/content-plan.json are sound (Engine.jokerProblems), and every need is a word', { skip: needs('content/content-plan.json') }, () => {
    const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'content-plan.json'), 'utf8'));
    assert.equal(plan.jokers.length, 120);
    const bad = [];
    for (const j of plan.jokers) {
      const p = plain(Engine.jokerProblems({ id: j.id, name: j.name, rarity: j.rarity, cost: j.cost, text: j.text, ...j.engine }));
      if (p.length) bad.push(`${j.id}: ${p.join(', ')}`);
    }
    deq(bad, []);
    // every word a plan row declares as a need is now in the vocabulary
    const V = Engine.VOCABULARY;
    const KIND = { condition: V.conditions, counter: V.counters, event: V.events, eventOp: V.eventOps, setter: V.setters, rule: V.rules, amount: V.amounts };
    const needs = new Set(plan.jokers.flatMap((j) => j.needs));
    assert.equal(needs.size, 70, '70 distinct words');
    for (const n of needs) {
      const [kind, word] = n.split(' ');
      assert.ok(KIND[kind] && KIND[kind].includes(word), `need ${n}`);
    }
  });

  test('jokerProblems names misuse of the new words', () => {
    const base = { id: 'x', name: 'X', text: 'X.', rarity: 'common', cost: 3 };
    deq(Engine.jokerProblems({ ...base, effects: [{ on: 'hand', mult: 2, linear: true }] }), ['effects[0]: linear needs xmult and per']);
    deq(Engine.jokerProblems({ ...base, effects: [{ on: 'hand', mult: 2, per: { state: 'n', every: 2 } }] }), []);
    deq(Engine.jokerProblems({ ...base, effects: [{ on: 'hand', mult: 2, per: { count: 'nope' } }] }), ["effects[0]: unknown counter 'nope'"]);
    deq(Engine.jokerProblems({ ...base, events: { cardScored: [{ money: 1 }] } }), ["cardScored: operation 'money' can't run inside scoring"]);
    deq(Engine.jokerProblems({ ...base, events: { handScored: [{ set: { side: 'coinFlip' } }] } }), ["handScored: setter 'coinFlip' can't run inside scoring"]);
    deq(Engine.jokerProblems({ ...base, events: { blindCleared: [{ gainTag: 'grabbag' }] } }), ["blindCleared: gainTag 'grabbag' would open a pack"]);
    deq(Engine.jokerProblems({ ...base, events: { blindCleared: [{ gainTag: 'nope' }] } }), ["blindCleared: unknown Tag 'nope'"]);
    deq(Engine.jokerProblems({ ...base, events: { blindStart: [{ createPlanet: 'random' }] } }), ["blindStart: createPlanet takes 'mostPlayed'"]);
    deq(Engine.jokerProblems({ ...base, rules: { copy: 'everyone' } }), ["unknown copy 'everyone'"]);
    deq(Engine.jokerProblems({ ...base, events: { onTuesday: [{ money: 1 }] } }), ["unknown event 'onTuesday'"]);
  });
});

// =========================================================================================
describe('vocabulary: conditions', () => {
  test('scoredSuitCount: +$2 with 3 scored Diamonds (a Masked card counts; not under The Wash-Out)', () => {
    const [run, j] = blindWith(['vjewel']);
    const r = score(run, '7D 7D 7D');
    deq(ownRows(r, j), [['money', 2, '+$2']]);
    deq(own(r, j).map((s) => [s.source, s.via, s.cardUid]), [['joker', 'joker', null]]);
    assert.equal(own(score(run, '7D 7D 7S'), j).length, 0, 'two Diamonds');
    assert.equal(own(score(run, '7D 7D 7S+scribbled'), j).length, 1, 'a Masked Seven counts');
    run.blind.boss = 'washout';
    assert.equal(own(score(run, '7D 7D 7S+scribbled'), j).length, 0, 'The Wash-Out');
  });

  test('highestHeld + cardRank: only the highest held card, leftmost on ties, gives 3 x its rank; an Encore Seal doubles it', () => {
    const [run, j] = blindWith(['vtophat']);
    const held = mks('QD QC 3C');
    const r = score(run, '2S', held);
    deq(own(r, j).map((s) => [s.kind, s.amount, s.cardUid]), [['chips', 36, held[0].uid]]);
    assert.equal(r.total, 43); // (5 + 2 + 36) x 1
    assert.equal(score(run, '2S', 'AH 3C').total, 7 + 42);
    assert.equal(own(score(run, '2S'), j).length, 0, 'nothing held');
    assert.equal(score(run, '2S', 'QD+encore 3C').total, 7 + 72);
  });

  test('heldRank: +10 Mult once if an Ace is held, however many', () => {
    const [run, j] = blindWith(['vace']);
    assert.equal(score(run, '2S', 'AH 3C').total, 77); // 7 x 11
    deq(ownRows(score(run, '2S', 'AH AD'), j), [['mult', 10, '+10']]);
    assert.equal(score(run, '2S', '3C KD').total, 7);
    assert.equal(score(run, 'AS').total, 16, 'a played Ace is not held');
  });

  test('clearedOnFirstHand: a $3 cash-out line when the first hand beats the Blind', () => {
    const [run] = blindWith(['vdart']);
    forceClear(run);
    deq(run.cashout.lines.find((l) => l.label === NAME.vdart), { label: NAME.vdart, amount: 3 });
    const [run2] = blindWith(['vdart']);
    ok(Engine.playHand(run2, [run2.blind.hand[0]]));
    forceClear(run2);
    assert.ok(!run2.cashout.lines.some((l) => l.label === NAME.vdart), 'beaten by the second hand');
  });

  test('clearedOnLastHand: +4 Mult for good each time the last hand beats a Blind; the state carries across Blinds', () => {
    const run = fresh();
    const j = add(run, 'vnail');
    ok(Engine.startBlind(run));
    run.blind.handsLeft = 1;
    forceClear(run);
    assert.equal(jokerOf(run, j.uid).state.mult, 4);
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    ok(Engine.startBlind(run));
    forceClear(run); // 4 hands left: not the last hand
    assert.equal(jokerOf(run, j.uid).state.mult, 4);
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    run.bosses[run.ante] = 'smudge'; // a Boss Blind that leaves the score alone
    ok(Engine.startBlind(run));
    assert.equal(score(run, '2S').total, 35); // 7 x (1 + 4)
    run.blind.handsLeft = 1;
    forceClear(run);
    assert.equal(jokerOf(run, j.uid).state.mult, 8);
  });

  test('kind + consumableUsed: +6 Chips for a Tarot card (from a slot or a pack pick), nothing for a Planet card', () => {
    const run = inBlind();
    const j = add(run, 'vtea');
    use(run, 'tarot', 'overtime');
    assert.equal(jokerOf(run, j.uid).state.chips, 6);
    use(run, 'planet', 'boing');
    assert.equal(jokerOf(run, j.uid).state.chips, 6, 'a Planet card is not a Tarot card');
    assert.equal(score(run, '2S').total, 13);
    forceClear(run);
    ok(Engine.collect(run));
    buyPack(run, 'tarotnormal');
    run.pack.options[0] = { kind: 'tarot', id: 'paperroute', picked: false };
    ok(Engine.packPick(run, 0, []));
    assert.equal(jokerOf(run, j.uid).state.chips, 12, 'a pack pick used at once counts');
  });

  test('kind + money: +$2 at once when a Tarot card is used, reported in jokerEvents', () => {
    const run = inBlind();
    const j = add(run, 'vgazer');
    const m = run.money;
    const r = use(run, 'tarot', 'overtime');
    assert.equal(run.money, m + 2);
    deq(evOps(r, 'money').map((e) => [e.uid, e.event, e.amount]), [[j.uid, 'consumableUsed', 2]]);
    use(run, 'planet', 'blip');
    assert.equal(run.money, m + 2, 'no money for a Planet card');
  });

  test('enhanced: +2 Mult for each scored card with an Enhancement; nothing under The Wash-Out', () => {
    const [run, j] = blindWith(['vfancy']);
    const played = mks('KS+inked KH');
    const r = score(run, played);
    deq(own(r, j).map((s) => [s.kind, s.amount, s.cardUid]), [['mult', 2, played[0].uid]]);
    assert.equal(r.total, (32 + 35) * 4);
    run.blind.boss = 'washout';
    assert.equal(own(score(run, 'KS+inked KH'), j).length, 0);
  });

  test('enhanced (retrigger): each scored card with an Enhancement scores twice, after its Encore Seal', () => {
    const [run, j] = blindWith(['vreprise']);
    const played = mks('KS+punchy+encore KH');
    const r = score(run, played);
    deq(r.steps.filter((s) => s.label === 'Encore!').map((s) => [s.uid, s.seal, s.jokerUid, s.jokerName]), [
      [played[0].uid, 'encore', null, null],
      [played[0].uid, null, j.uid, NAME.vreprise],
    ]);
    assert.equal(r.total, (12 + 30 + 10) * (2 + 15)); // three passes of KS+punchy
    assert.equal(score(run, 'KS KH').steps.filter((s) => s.label === 'Encore!').length, 0);
  });

  test('allEnhanced: x2 Mult when every scored card has an Enhancement; not with one plain card, nothing scored, or The Wash-Out', () => {
    const [run, j] = blindWith(['vgala']);
    deq(ownRows(score(run, 'KS+inked KH+punchy 2C'), j), [['xmult', 2, '×2']], 'the unscored 2 does not matter');
    assert.equal(own(score(run, 'KS+inked KH'), j).length, 0);
    run.blind.boss = 'washout';
    assert.equal(own(score(run, 'KS+inked KH+punchy'), j).length, 0);
    run.blind.boss = 'heckler';
    assert.equal(own(score(run, 'KS+inked'), j).length, 0, 'the only scored card is booed: nothing is scored');
  });

  test("seal: Bravo-style +20 Chips on an Encore card (twice, with its pass); not another Seal; not under The Blackout", () => {
    const [run, j] = blindWith(['vbravo']);
    const played = mks('KS+encore KH');
    deq(own(score(run, played), j).map((s) => [s.amount, s.cardUid]), [[20, played[0].uid], [20, played[0].uid]]);
    assert.equal(own(score(run, 'KS+paid KH'), j).length, 0);
    run.blind.boss = 'censor';
    assert.equal(own(score(run, 'KS+encore KH'), j).length, 0);
  });

  test("seal 'any' (retrigger): a card with any Seal scores once more; a plain card does not; nothing under The Blackout", () => {
    const [run, j] = blindWith(['vmaypole']);
    const played = mks('KS+paid KH');
    const again = score(run, played).steps.filter((s) => s.label === 'Encore!');
    deq(again.map((s) => [s.uid, s.jokerUid]), [[played[0].uid, j.uid]]);
    assert.equal(score(run, 'KS+encore KH').steps.filter((s) => s.label === 'Encore!').length, 2, 'Encore Seal + this Joker');
    run.blind.boss = 'censor';
    assert.equal(score(run, 'KS+paid KH').steps.filter((s) => s.label === 'Encore!').length, 0);
  });

  test('lastHand: +60 Chips on the final hand of the Blind (handsLeft 1 before it)', () => {
    const [run, j] = blindWith(['vfinale']);
    assert.equal(own(score(run, '2S'), j).length, 0);
    run.blind.handsLeft = 1;
    deq(ownRows(score(run, '2S'), j), [['chips', 60, '+60']]);
  });

  test("evenHand: +10 Mult on the Blind's 2nd, 4th ... hand; the live text says whether the next hand is on", () => {
    const [run, j] = blindWith(['vseesaw']);
    assert.equal(own(score(run, '2S'), j).length, 0, 'first hand');
    assert.match(Engine.jokerText(run, j.uid), /\(next hand: off\)$/);
    ok(Engine.playHand(run, [run.blind.hand[0]]));
    assert.match(Engine.jokerText(run, j.uid), /\(next hand: on\)$/);
    deq(ownRows(score(run, '2S'), j), [['mult', 10, '+10']]);
    run.blind.handsPlayed = 2;
    assert.equal(own(score(run, '2S'), j).length, 0, 'third hand');
  });

  test('maxMoney: +9 Mult at $5 or less, before this hand earns anything', () => {
    const [run, j] = blindWith(['vpoet']);
    run.money = 5;
    deq(ownRows(score(run, '2S'), j), [['mult', 9, '+9']]);
    run.money = 6;
    assert.equal(own(score(run, '2S'), j).length, 0);
    run.money = 5;
    const g = add(run, 'vgold');
    assert.ok(own(score(run, 'AS AH'), j).length === 1 && own(score(run, 'AS AH'), g).length === 2, 'the Aces pay after the check');
  });

  test('oneColour: x1.5 when the scored cards are all red or all black (a Masked card fits either)', () => {
    const [run, j] = blindWith(['vguard']);
    for (const h of ['KH KD', 'KS KC', 'KH KS+scribbled', 'KS']) deq(ownRows(score(run, h), j), [['xmult', 1.5, '×1.5']], h);
    assert.equal(own(score(run, 'KH KS'), j).length, 0);
    assert.equal(own(score(run, 'KH KH 2S'), j).length, 1, 'an unscored card does not count');
  });

  test('noConsumables: x1.5 with empty consumable slots only', () => {
    const [run, j] = blindWith(['vlint']);
    assert.equal(score(run, 'KS KH').total, 96);
    give(run, 'tarot', 'overtime');
    assert.equal(own(score(run, 'KS KH'), j).length, 0);
  });

  test('mostPlayed: x1.5 on the most-played hand before this one (Pair when nothing is played; ties to the stronger)', () => {
    const [run, j] = blindWith(['vsignature']);
    assert.equal(own(score(run, 'KS KH'), j).length, 1, 'nothing played yet: Pair');
    assert.match(Engine.jokerText(run, j.uid), /\(most-played: Pair\)$/);
    run.plays.flush = 2;
    run.plays.pair = 2;
    assert.equal(own(score(run, 'KS KH'), j).length, 0, 'a tie goes to the stronger Flush');
    assert.equal(own(score(run, '2H 5H 9H JH KH'), j).length, 1);
    assert.match(Engine.jokerText(run, j.uid), /most-played: Flush/);
  });

  test('stateIs + coinFlip: x2 on Heads, nothing on Tails; the coin flips after each hand from the seeded RNG, never inside scoreCards', () => {
    const [run, j] = blindWith(['vcoin']);
    assert.equal(score(run, 'KS KH').total, 128);
    assert.match(Engine.jokerText(run, j.uid), /\(now Heads\)$/);
    const before = Engine.serialize(run);
    score(run, 'KS KH');
    assert.equal(Engine.serialize(run), before, 'scoring is pure');
    jokerOf(run, j.uid).state.side = 'tails';
    assert.equal(score(run, 'KS KH').total, 64);
    const sides = [];
    for (let i = 0; i < 12; i++) {
      run.blind.handsLeft = 9;
      run.blind.score = 0;
      const was = jokerOf(run, j.uid).state.side;
      const r = ok(Engine.playHand(run, [run.blind.hand[0]]));
      sides.push(jokerOf(run, j.uid).state.side);
      assert.ok(['heads', 'tails'].includes(sides[i]));
      deq(evOps(r, 'state').map((e) => [e.key, e.from, e.to]), sides[i] === was ? [] : [['side', was, sides[i]]], 'a flip that turns the coin is reported');
    }
    assert.ok(sides.includes('heads') && sides.includes('tails'), sides.join(' '));
    const [again, j2] = blindWith(['vcoin']);
    const sides2 = [];
    for (let i = 0; i < 12; i++) {
      again.blind.handsLeft = 9;
      again.blind.score = 0;
      ok(Engine.playHand(again, [again.blind.hand[0]]));
      sides2.push(jokerOf(again, j2.uid).state.side);
    }
    deq(sides2, sides, 'same seed, same flips');
  });

  test('heldSameRank (retrigger): a scored card retriggers when a card of its exact rank is held', () => {
    const [run, j] = blindWith(['vcall']);
    const played = mks('KS KH');
    deq(score(run, played, 'KD 2C').steps.filter((s) => s.label === 'Encore!').map((s) => [s.uid, s.jokerUid]), [[played[0].uid, j.uid], [played[1].uid, j.uid]]);
    assert.equal(score(run, 'KS KH', 'QD 2C').steps.filter((s) => s.label === 'Encore!').length, 0);
    assert.equal(score(run, 'KS KH', 'KD KC').steps.filter((s) => s.label === 'Encore!').length, 2, 'once per card, however many matches');
  });

  test('firstOrLast (retrigger): the first and last scoring cards; a lone card once; a booed card keeps nothing', () => {
    const [run, j] = blindWith(['vbookends']);
    const st = mks('5S 6H 7D 8C 9S');
    deq(score(run, st).steps.filter((s) => s.label === 'Encore!').map((s) => s.uid), [st[0].uid, st[4].uid]);
    assert.equal(score(run, 'KS').steps.filter((s) => s.label === 'Encore!').length, 1);
    run.blind.boss = 'heckler';
    const st2 = mks('5S 6H 7D 8C 9S');
    deq(score(run, st2).steps.filter((s) => s.label === 'Encore!').map((s) => s.uid), [st2[0].uid], 'the booed 9 is not replaced');
  });

  test("pairDiscard + createTarot: discarding exactly 2 cards of one rank creates a Tarot card (needs a free slot); The Fumble's card is not counted", () => {
    const [run, j] = blindWith(['vpalm']);
    const [a, b] = setHand(run, ['7S', '7H', '9C']);
    const r = ok(Engine.discard(run, [a, b]));
    assert.equal(run.consumables.length, 1);
    assert.equal(run.consumables[0].kind, 'tarot');
    deq(evOps(r, 'createTarot').map((e) => [e.uid, e.event, e.created]), [[j.uid, 'discard', [run.consumables[0].uid]]]);
    const [c, d] = setHand(run, ['7S', '8H']);
    ok(Engine.discard(run, [c, d]));
    assert.equal(run.consumables.length, 1, 'two ranks');
    const [e, f, g] = setHand(run, ['7S', '7H', '2C']);
    ok(Engine.discard(run, [e, f, g]));
    assert.equal(run.consumables.length, 1, 'three cards');
    const run2 = fresh();
    add(run2, 'vpalm');
    toBoss(run2, 'fumble');
    const [p, q] = setHand(run2, ['7S', '7H']);
    const r2 = ok(Engine.discard(run2, [p, q]));
    assert.ok(r2.extra, 'The Fumble dropped a third card');
    assert.equal(run2.consumables.length, 1, 'the selected pair still counts');
    run2.consumableSlots = 1;
    const [x, y] = setHand(run2, ['4S', '4H']);
    ok(Engine.discard(run2, [x, y]));
    assert.equal(run2.consumables.length, 1, 'no free slot');
  });

  test('sum21: x3 when the scored cards add up to exactly 21 (Aces 1 or 11, faces 10)', () => {
    const [run, j] = blindWith(['vblackjack']);
    for (const h of ['7S 7H 7D', '3S 3H 3D 6C 6S', '2H 3H 4H 5H 7H', 'AS AH 3D 3C 3S']) deq(ownRows(score(run, h), j), [['xmult', 3, '×3']], h);
    for (const h of ['KS KH', 'AS AH', '7S 7H 7D 7C']) assert.equal(own(score(run, h), j).length, 0, h);
    assert.equal(own(score(run, 'KS+encore QS+encore AS'), j).length, 0, 'a High Card: only the Ace scores, retriggers do not count twice');
  });
});

// =========================================================================================
describe('vocabulary: counters and amount forms', () => {
  test('heldPairs: +20 Chips for each pair among the cards held (two Kings and two 5s: +40)', () => {
    const [run, j] = blindWith(['vpeek']);
    deq(ownRows(score(run, '2S', 'KD KC 5H 5D 2C'), j), [['chips', 40, '+40']]);
    assert.equal(own(score(run, '2S', 'KD 5H'), j).length, 0);
  });

  test('handsLeft: a cash-out line of $1 per hand left when the Blind is beaten', () => {
    const [run] = blindWith(['vearly']);
    forceClear(run);
    deq(run.cashout.lines.find((l) => l.label === NAME.vearly), { label: NAME.vearly, amount: 3 });
    const [run2] = blindWith(['vearly']);
    run2.blind.handsLeft = 1;
    forceClear(run2);
    assert.ok(!run2.cashout.lines.some((l) => l.label === NAME.vearly), 'no hand left: no $0 line');
  });

  test('unscoredCards: +3 Mult per played card that does not score (a Cameo card scores; a booed card is still a scoring card)', () => {
    const [run, j] = blindWith(['vunder']);
    assert.equal(score(run, 'KS KH 2C 3D').total, 256); // 32 x (2 + 6)
    assert.equal(own(score(run, 'KS KH 2C+cameo'), j).length, 0);
    run.blind.boss = 'heckler';
    deq(ownRows(score(run, 'KS KH 2C'), j), [['mult', 3, '+3']]);
  });

  test('otherCommonJokers: +12 Chips per other common Joker; the live text shows it', () => {
    const [run, j] = blindWith(['vparade', 'vdrum', 'vimp', 'vgala']);
    deq(ownRows(score(run, 'KS KH'), j), [['chips', 24, '+24']]);
    assert.match(Engine.jokerText(run, j.uid), /\(now \+24 Chips\)$/);
    const [run2, j2] = blindWith(['vparade', 'vgala']);
    assert.equal(own(score(run2, 'KS KH'), j2).length, 0, 'a rare Joker is not common');
  });

  test('sealedCards: +10 Chips per card with a Seal in the full deck, counted even under The Blackout', () => {
    const [run, j] = blindWith(['vsignet']);
    run.cards[0].seal = 'paid';
    run.cards[10].seal = 'encore';
    run.cards[20].seal = 'cameo';
    deq(ownRows(score(run, 'KS KH'), j), [['chips', 30, '+30']]);
    run.blind.boss = 'censor';
    deq(ownRows(score(run, 'KS KH'), j), [['chips', 30, '+30']]);
    for (const c of run.cards) c.seal = null;
    assert.equal(own(score(run, 'KS KH'), j).length, 0);
  });

  test('levelsAbove1: +2 Mult per level the played hand has above 1 (Pair lv.4: +6)', () => {
    const [run, j] = blindWith(['vorrery']);
    assert.equal(own(score(run, 'KS KH'), j).length, 0);
    run.levels.pair = 4;
    const r = score(run, 'KS KH');
    deq(ownRows(r, j), [['mult', 6, '+6']]);
    assert.equal(r.total, 880); // (12 + 48 + 20) x (2 + 3 + 6)
  });

  test('editionJokers: x1.25 per Joker with an Edition, itself included, counted even under The Blackout', () => {
    const run = fresh();
    const v = add(run, 'vvelvet', 'gloss');
    add(run, 'vimp', 'benday');
    ok(Engine.startBlind(run));
    deq(own(score(run, 'KS KH'), v).map((s) => [s.kind, s.amount, s.via]), [['chips', 40, 'edition'], ['xmult', 1.5625, 'joker']]);
    run.blind.boss = 'censor';
    deq(own(score(run, 'KS KH'), v).map((s) => [s.kind, s.amount]), [['xmult', 1.5625]], 'no Edition step, but the count stays');
    const [run2, v2] = blindWith(['vvelvet']);
    assert.equal(own(score(run2, 'KS KH'), v2).length, 0, 'no Edition anywhere: x1, no step');
  });

  test('otherJokers: x1.3 per other Joker (a Phantom one counts); a cash-out line of $1 per other Joker', () => {
    const run = fresh();
    const r1 = add(run, 'vring');
    add(run, 'vdrum');
    add(run, 'vimp', 'inverted');
    ok(Engine.startBlind(run));
    deq(own(score(run, 'KS KH'), r1).map((s) => [s.kind, s.amount]), [['xmult', 1.69]]);
    assert.match(Engine.jokerText(run, r1.uid), /\(now ×1\.69\)$/);
    const [run2] = blindWith(['vpay', 'vdrum']);
    forceClear(run2);
    deq(run2.cashout.lines.find((l) => l.label === NAME.vpay), { label: NAME.vpay, amount: 1 });
    const [run3, p3] = blindWith(['vpay', 'vdrum', 'vimp']);
    assert.ok(Engine.jokerText(run3, p3.uid).endsWith('(now +$2)'), `a money live value reads "now +$N": ${Engine.jokerText(run3, p3.uid)}`);
  });

  test('vouchers + linear: x(1 + 0.25 per Voucher) instead of a power; no step with none', () => {
    const [run, j] = blindWith(['vticket']);
    assert.equal(own(score(run, 'KS KH'), j).length, 0);
    run.vouchers.push('skyatlas', 'savingsbond');
    deq(ownRows(score(run, 'KS KH'), j), [['xmult', 1.5, '×1.5']]);
    assert.match(Engine.jokerText(run, j.uid), /\(now ×1\.5\)$/);
    run.vouchers.push('slickpaper', 'stampalbum');
    deq(ownRows(score(run, 'KS KH'), j), [['xmult', 2, '×2']]);
  });

  test('perState: +1 Mult per 2 Planet cards used (state.planets via consumableUsed)', () => {
    const run = fresh();
    const j = add(run, 'vstar');
    for (const id of ['blip', 'boing', 'zoom']) use(run, 'planet', id);
    assert.equal(jokerOf(run, j.uid).state.planets, 3);
    ok(Engine.startBlind(run));
    deq(ownRows(score(run, '2S'), j), [['mult', 1, '+1']]);
    assert.match(Engine.jokerText(run, j.uid), /\(now \+1 Mult\)$/);
    jokerOf(run, j.uid).state.planets = 1;
    assert.equal(own(score(run, '2S'), j).length, 0);
  });

  test("live: 'per card' for an on-card effect", () => {
    const [run, j] = blindWith(['vstager']);
    run.ante = 3;
    assert.match(Engine.jokerText(run, j.uid), /\(now \+6 Chips per card\)$/);
  });
});

// =========================================================================================
describe('vocabulary: events', () => {
  test('cardScored: each pass of a scored Jack adds +1 inside scoreCards (this hand counts); scoreCards stays pure; playHand stores it', () => {
    const [run, j] = blindWith(['vjack']);
    const played = mks('JS JH');
    const before = Engine.serialize(run);
    const r = Engine.scoreCards(run, played, []);
    assert.equal(Engine.serialize(run), before, 'scoreCards changes nothing');
    deq(ownRows(r, j), [['mult', 2, '+2']]);
    assert.equal(r.total, 128); // 32 x (2 + 2)
    deq(r.jokerGains.map((g) => [g.uid, g.path, g.key, g.from, g.to, g.cardUid]), [[j.uid, [], 'mult', 0, 1, played[0].uid], [j.uid, [], 'mult', 1, 2, played[1].uid]]);
    assert.ok(r.jokerGains.every((g) => g.at > 0 && g.at <= r.steps.length));
    const [a, b] = setHand(run, ['JS', 'JH']);
    const p = ok(Engine.playHand(run, [a, b]));
    assert.equal(p.result.jokerGains.length, 2);
    assert.equal(jokerOf(run, j.uid).state.mult, 2, 'stored');
    assert.equal(score(run, 'KS').total, 45, 'the next hand starts from +2: 15 x 3');
    assert.equal(score(run, 'JS+encore').total, 25 * 5, 'a retriggered Jack adds 2: (5 + 10 + 10) x (1 + 2 + 2)');
    assert.match(Engine.jokerText(run, j.uid), /\(now \+2 Mult\)$/);
  });

  test('cardScored: paused while The Wet Blanket switches the Joker off', () => {
    const run = fresh();
    const j = add(run, 'vjack');
    toBoss(run, 'wetblanket');
    assert.equal(run.blind.wetJoker, j.uid);
    const r = score(run, 'JS JH');
    deq([r.jokerGains.length, own(r, j).length], [0, 0]);
  });

  test('handScored: +3 Chips once per hand of exactly 5 cards, before the Joker pass', () => {
    const [run, j] = blindWith(['vaccordion']);
    const r = score(run, '2S 4H 6D 8C 10S');
    deq(ownRows(r, j), [['chips', 3, '+3']]);
    assert.equal(r.total, 18); // 5 + 10 + 3
    deq(r.jokerGains.map((g) => [g.key, g.from, g.to, g.cardUid]), [['chips', 0, 3, null]]);
    assert.equal(score(run, '2S 4H 6D 8C').jokerGains.length, 0, '4 cards');
    const five = setHand(run, ['2S', '4H', '6D', '8C', '10S']);
    ok(Engine.playHand(run, five));
    assert.equal(jokerOf(run, j.uid).state.chips, 3);
    deq(ownRows(score(run, '2S 4H 6D 8C 10S'), j), [['chips', 6, '+6']]);
  });

  test('packOpened: +1 Mult each time a Booster Pack opens, bought or free from a Tag', () => {
    const run = fresh();
    const j = add(run, 'vpackrat');
    toShop(run);
    const b = buyPack(run, 'cardnormal');
    assert.equal(jokerOf(run, j.uid).state.mult, 1);
    deq(evOps(b, 'state').map((e) => [e.uid, e.event, e.key, e.from, e.to]), [[j.uid, 'packOpened', 'mult', 0, 1]]);
    ok(Engine.packSkip(run));
    ok(Engine.leaveShop(run));
    run.tags[`${run.ante}-${run.blindIndex}`] = 'grabbag';
    const sk = ok(Engine.skipBlind(run));
    assert.equal(jokerOf(run, j.uid).state.mult, 2, 'a Tag pack counts');
    assert.equal(evOps(sk, 'state').length, 1);
  });

  test('jokerSold: +2 Mult each time you sell another Joker; a destroyed Joker does not count', () => {
    const run = fresh();
    const d = add(run, 'vdrum');
    const j = add(run, 'vpawn');
    const i = add(run, 'vimp');
    ok(Engine.sellJoker(run, i.uid));
    assert.equal(jokerOf(run, j.uid).state.mult, 2);
    use(run, 'spectral', 'ghostwriter'); // destroys the leftmost Joker (Drum), creates a rare one
    assert.ok(!jokerOf(run, d.uid), 'Drum was destroyed');
    assert.equal(jokerOf(run, j.uid).state.mult, 2, 'not a sale');
    ok(Engine.sellJoker(run, run.jokers.find((x) => x.uid !== j.uid).uid));
    assert.equal(jokerOf(run, j.uid).state.mult, 4);
  });

  test('sold + extraHand: sold during a Blind it gives +1 hand this Blind; sold elsewhere it only pays', () => {
    const run = inBlind();
    const j = add(run, 'vlaugh');
    const hands = run.blind.handsLeft;
    const r = ok(Engine.sellJoker(run, j.uid));
    assert.equal(run.blind.handsLeft, hands + 1);
    deq(evOps(r, 'extraHand').map((e) => [e.uid, e.event, e.hands]), [[j.uid, 'sold', 1]]);
    const run2 = fresh();
    const j2 = add(run2, 'vlaugh');
    const r2 = ok(Engine.sellJoker(run2, j2.uid));
    deq([r2.money, evOps(r2, 'extraHand').length, run2.pending.extraHands], [2, 0, 0], 'at Blind select: no Blind, no hand');
  });

  test('cardAdded + enhanceAdded: +4 Chips per card joining the deck; a plain added card gets a random Enhancement', () => {
    const run = inBlind();
    const doll = add(run, 'vdoll');
    add(run, 'vmakeover');
    const [plainU, waxedU] = setHand(run, ['5S', '6S+inked']);
    const r = use(run, 'tarot', 'carboncopy', [plainU]);
    const copy = cardOf(run, r.effect.created[0]);
    assert.equal(jokerOf(run, doll.uid).state.chips, 4);
    assert.ok(ENH.includes(copy.enhancement), 'the plain copy got an Enhancement');
    deq(evOps(r, 'enhanceAdded').map((e) => e.uids), [[copy.uid]]);
    const r2 = use(run, 'tarot', 'carboncopy', [waxedU]);
    assert.equal(cardOf(run, r2.effect.created[0]).enhancement, 'inked', 'an enhanced copy keeps its own');
    assert.equal(jokerOf(run, doll.uid).state.chips, 8);
    use(run, 'spectral', 'hallofmirrors', [run.blind.hand[0]]);
    assert.equal(jokerOf(run, doll.uid).state.chips, 20, '3 copies: +12');
    deq(ownRows(score(run, 'KS KH'), doll), [['chips', 20, '+20']]);
  });

  test('cardAdded: a Card Pack pick joins the deck and counts', () => {
    const run = fresh();
    const doll = add(run, 'vdoll');
    toShop(run);
    buyPack(run, 'cardnormal');
    const p = ok(Engine.packPick(run, 0));
    assert.equal(jokerOf(run, doll.uid).state.chips, 4);
    deq(evOps(p, 'state').map((e) => [e.event, e.key, e.to]), [['cardAdded', 'chips', 4]]);
  });

  test('cardDestroyed: x0.2 more per playing card destroyed (Candle Snuffer, Vanishing Act); the state carries over', () => {
    const run = inBlind();
    const j = add(run, 'vbrazier');
    use(run, 'tarot', 'eraser', run.blind.hand.slice(0, 2));
    assert.equal(jokerOf(run, j.uid).state.x, 1.4);
    assert.equal(score(run, 'KS KH').total, 89); // 64 x 1.4 = 89.6
    use(run, 'spectral', 'vanishingact', run.blind.hand.slice(0, 3));
    assert.equal(jokerOf(run, j.uid).state.x, 2);
    deq(ownRows(score(run, 'KS KH'), j), [['xmult', 2, '×2']]);
    assert.match(Engine.jokerText(run, j.uid), /\(now ×2\)$/);
    const run2 = inBlind();
    const j2 = add(run2, 'vbrazier');
    use(run2, 'tarot', 'overtime');
    assert.equal(jokerOf(run2, j2.uid).state.x, 1, 'nothing destroyed');
  });

  test('purchase: +1 Mult per Shop purchase; not a reroll, a free item, or its own purchase', () => {
    const run = fresh();
    toShop(run);
    run.money = 100;
    const card = run.shop.items.findIndex((it) => it.slot === 'card');
    Object.assign(run.shop.items[card], { kind: 'joker', id: 'vspender', price: 6, sold: false, edition: null });
    ok(Engine.buy(run, card));
    const j = run.jokers.find((x) => x.id === 'vspender');
    assert.equal(j.state.mult, 0, 'buying it is not counted');
    const card2 = run.shop.items.findIndex((it, i) => it.slot === 'card' && i !== card);
    Object.assign(run.shop.items[card2], { kind: 'tarot', id: 'overtime', price: 3, sold: false, edition: null });
    ok(Engine.buy(run, card2));
    assert.equal(j.state.mult, 1);
    ok(Engine.reroll(run));
    assert.equal(j.state.mult, 1, 'a reroll is not a purchase');
    const pk = run.shop.items.findIndex((it) => it.slot === 'pack');
    run.shop.items[pk].price = 0;
    ok(Engine.buy(run, pk));
    assert.equal(j.state.mult, 1, 'a free item is not a purchase');
  });
});

// =========================================================================================
describe('vocabulary: event operations', () => {
  test('money: +$1 at once when a Blind starts, reported by startBlind; doubled by blindMoneyX during a Blind', () => {
    const run = fresh();
    const j = add(run, 'vdoor');
    const m = run.money;
    const r = ok(Engine.startBlind(run));
    assert.equal(run.money, m + 1);
    deq(r.jokerEvents.map((e) => [e.uid, e.id, e.event, e.op, e.amount]), [[j.uid, 'vdoor', 'blindStart', 'money', 1]]);
    const run2 = fresh();
    add(run2, 'vdoor');
    add(run2, 'vgolden');
    const m2 = run2.money;
    ok(Engine.startBlind(run2));
    assert.equal(run2.money, m2 + 2);
  });

  test('perFace: $1 per face card discarded (with acesAreFaces an Ace counts)', () => {
    const [run, j] = blindWith(['vface']);
    const m = run.money;
    const sel = setHand(run, ['KS', 'QH', '2C']);
    const r = ok(Engine.discard(run, sel));
    assert.equal(run.money, m + 2);
    deq(evOps(r, 'money').map((e) => [e.uid, e.amount]), [[j.uid, 2]]);
    ok(Engine.discard(run, setHand(run, ['2S', '3H'])));
    assert.equal(run.money, m + 2, 'no face card');
    add(run, 'vcourt');
    ok(Engine.discard(run, setHand(run, ['AS', 'KS'])));
    assert.equal(run.money, m + 4);
  });

  test('gainTag: a Second Wind Tag when a Boss Blind is beaten (+1 hand in the next Blind); not after a Small Blind', () => {
    const run = fresh();
    add(run, 'vcocoa');
    ok(Engine.startBlind(run));
    forceClear(run);
    assert.equal(run.pending.extraHands, 0, 'a Small Blind');
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    run.tags[`${run.ante}-${run.blindIndex}`] = 'piggybank';
    ok(Engine.skipBlind(run));
    run.bosses[run.ante] = 'smudge';
    ok(Engine.startBlind(run));
    const r = forceClear(run);
    assert.equal(run.pending.extraHands, 1);
    deq(evOps(r, 'gainTag').map((e) => e.tag), ['secondwind']);
    assert.ok(run.discovered.tags.includes('secondwind'));
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    ok(Engine.startBlind(run));
    assert.equal(run.blind.handsLeft, 5);
    assert.equal(run.pending.extraHands, 0, 'used up');
  });

  test('editionDeckCards: 2 random deck cards without an Edition gain Sheen, Dither or Glitch (never Phantom) after a Boss Blind', () => {
    for (const seed of ['SHINE001', 'SHINE002', 'SHINE003']) {
      const run = fresh({ seed });
      add(run, 'vshine');
      toBoss(run, 'smudge');
      const r = forceClear(run);
      const eds = run.cards.filter((c) => c.edition);
      assert.equal(eds.length, 2, seed);
      for (const c of eds) assert.ok(['gloss', 'benday', 'fourcolor'].includes(c.edition), c.edition);
      deq(evOps(r, 'editionDeckCards').map((e) => sorted(e.uids)), [sorted(eds.map((c) => c.uid))]);
    }
    const run = fresh();
    add(run, 'vshine');
    for (const c of run.cards.slice(1)) c.edition = 'gloss';
    toBoss(run, 'smudge');
    forceClear(run);
    assert.equal(run.cards.filter((c) => !c.edition).length, 0, 'only one card qualified: it gained one');
    const small = fresh();
    add(small, 'vshine');
    ok(Engine.startBlind(small));
    forceClear(small);
    assert.equal(small.cards.filter((c) => c.edition).length, 0, 'not after a Small Blind');
  });

  test('sealHandCard: when a Blind starts (after the deal), 1 random card in hand without a Seal gains a random Seal', () => {
    for (const seed of ['THIMBLE1', 'THIMBLE2']) {
      const run = fresh({ seed });
      const j = add(run, 'vthimble');
      const r = ok(Engine.startBlind(run));
      const sealed = run.cards.filter((c) => c.seal);
      assert.equal(sealed.length, 1, seed);
      assert.ok(run.blind.hand.includes(sealed[0].uid), 'a card in hand');
      assert.ok(SEALS.includes(sealed[0].seal));
      deq(evOps(r, 'sealHandCard').map((e) => [e.uid, e.uids, e.seals]), [[j.uid, [sealed[0].uid], [sealed[0].seal]]]);
    }
    const run = fresh();
    add(run, 'vthimble');
    for (const c of run.cards) c.seal = 'paid';
    const r = ok(Engine.startBlind(run));
    deq(evOps(r, 'sealHandCard'), [], 'every card in hand already has one');
  });

  test('createPlanet: when a Blind starts, the Planet card for the most-played hand (Pair when none) if a slot is free', () => {
    const run = fresh();
    add(run, 'vmoon');
    const r = ok(Engine.startBlind(run));
    deq(run.consumables.map((k) => [k.kind, k.id]), [['planet', 'boing']]);
    deq(evOps(r, 'createPlanet').map((e) => e.created), [[run.consumables[0].uid]]);
    const run2 = fresh();
    add(run2, 'vmoon');
    run2.plays.flush = 3;
    give(run2, 'tarot', 'overtime');
    ok(Engine.startBlind(run2));
    deq(run2.consumables.map((k) => k.id), ['overtime', 'swoosh']);
    forceClear(run2);
    ok(Engine.collect(run2));
    ok(Engine.leaveShop(run2));
    ok(Engine.startBlind(run2));
    assert.equal(run2.consumables.length, 2, 'no free slot: nothing');
  });

  test('createSpectral: a Spectral card (never Tall Tale) after a Boss Blind, if a slot is free', () => {
    for (const seed of ['MOTH0001', 'MOTH0002', 'MOTH0003']) {
      const run = fresh({ seed });
      add(run, 'vmoth');
      toBoss(run, 'smudge');
      forceClear(run);
      assert.equal(run.consumables.length, 1, seed);
      assert.equal(run.consumables[0].kind, 'spectral');
      assert.notEqual(run.consumables[0].id, 'originstory');
    }
    const run = fresh();
    add(run, 'vmoth');
    give(run, 'tarot', 'overtime');
    give(run, 'tarot', 'doover');
    toBoss(run, 'smudge');
    forceClear(run);
    assert.equal(run.consumables.length, 2, 'full slots');
  });

  test('handSizeThisBlind: each discard gives +1 hand size this Blind (at most +3), then draws up; it ends with the Blind', () => {
    const [run, j] = blindWith(['vbag']);
    run.blind.discardsLeft = 6;
    const r = ok(Engine.discard(run, [run.blind.hand[0]]));
    deq([run.blind.handSizeDelta, run.blind.hand.length, r.drawn.length, Engine.handSizeNow(run)], [1, 9, 2, 9]);
    deq(evOps(r, 'handSizeThisBlind').map((e) => [e.uid, e.handSize, e.drawn.length]), [[j.uid, 1, 2]], 'it draws up at once: the discarded card and the extra one');
    assert.match(Engine.jokerText(run, j.uid), /\(now \+1 hand size\)$/);
    for (let i = 0; i < 4; i++) ok(Engine.discard(run, [run.blind.hand[0]]));
    deq([run.blind.handSizeDelta, run.blind.hand.length, run.blind.handSizeBy[j.uid]], [3, 11, 3]);
    forceClear(run);
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    ok(Engine.startBlind(run));
    deq([run.blind.handSizeDelta, run.blind.hand.length], [0, 8]);
  });

  test('rankUpScored: after the hand, scored Jacks become Queens and scored Queens Kings (no chain; unscored cards stay)', () => {
    const [run, j] = blindWith(['vcrown']);
    const jj = setHand(run, ['JS', 'JH']);
    const r = ok(Engine.playHand(run, jj));
    deq(jj.map((u) => cardOf(run, u).rank), [12, 12], 'Jacks to Queens, not Kings');
    deq(evOps(r, 'rankUpScored').map((e) => [e.uid, e.uids]), [[j.uid, jj]]);
    const qq = setHand(run, ['QS', 'QH']);
    ok(Engine.playHand(run, qq));
    deq(qq.map((u) => cardOf(run, u).rank), [13, 13]);
    const kk = setHand(run, ['KS', 'KH', 'JD']);
    ok(Engine.playHand(run, kk));
    deq(kk.map((u) => cardOf(run, u).rank), [13, 13, 11], 'Kings stay; the unscored Jack stays');
  });
});

// =========================================================================================
describe('vocabulary: rules', () => {
  test('freeSmallDiscard: once per Blind a discard of at most 2 selected cards keeps discardsLeft; ready again next Blind', () => {
    const [run, j] = blindWith(['vsleight']);
    assert.match(Engine.jokerText(run, j.uid), /\(free discard: ready\)$/);
    const big = ok(Engine.discard(run, run.blind.hand.slice(0, 3)));
    deq([big.free, run.blind.discardsLeft, run.blind.freeDiscardUsed], [false, 2, false], '3 cards: not free, still ready');
    const small = ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    deq([small.free, run.blind.discardsLeft, run.blind.freeDiscardUsed], [true, 2, true]);
    assert.match(Engine.jokerText(run, j.uid), /\(free discard: used\)$/);
    assert.equal(ok(Engine.discard(run, run.blind.hand.slice(0, 1))).free, false, 'once per Blind');
    assert.equal(run.blind.discardsLeft, 1);
    forceClear(run);
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    ok(Engine.startBlind(run));
    assert.equal(ok(Engine.discard(run, run.blind.hand.slice(0, 1))).free, true);
    run.blind.discardsLeft = 0;
    fails(Engine.discard(run, run.blind.hand.slice(0, 1)), '0 discards left', 'No discards left this Blind.');
  });

  test("freeSmallDiscard: The Fumble's extra card is not counted; The Tollbooth still charges", () => {
    const run = fresh();
    add(run, 'vsleight');
    toBoss(run, 'fumble');
    const r = ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    deq([!!r.extra, r.free, run.blind.discardsLeft], [true, true, 3]);
    const run2 = fresh();
    add(run2, 'vsleight');
    toBoss(run2, 'tollbooth');
    run2.money = 10;
    const r2 = ok(Engine.discard(run2, run2.blind.hand.slice(0, 1)));
    deq([r2.free, r2.cost, run2.money], [true, 2, 8]);
  });

  test('rerollDiscount: every paid reroll costs $1 less (the price still rises; never below $1; free rerolls stay free)', () => {
    const run = fresh();
    add(run, 'vtop');
    toShop(run);
    run.money = 100;
    assert.equal(Engine.rerollCost(run), 4);
    deq([ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost], [4, 5, 6]);
    run.shop.rerollCost = 1;
    assert.equal(ok(Engine.reroll(run)).cost, 1, 'never below $1');
    run.shop.freeRerolls = 1;
    assert.equal(ok(Engine.reroll(run)).cost, 0);
    const plainShop = toShop(fresh());
    assert.equal(Engine.rerollCost(plainShop), 5, 'without the rule');
    const flat = fresh();
    add(flat, 'vtop');
    flat.vouchers.push('secondlook');
    toShop(flat);
    flat.money = 100;
    deq([ok(Engine.reroll(flat)).cost, ok(Engine.reroll(flat)).cost], [4, 4], 'with Second Look: $4 every time');
  });

  test('interestStep: interest is $1 per full $4 instead of $5; the cap does not change', () => {
    const run = fresh();
    run.money = 12;
    assert.equal(Engine.interestPreview(run), 2);
    add(run, 'vabacus');
    assert.equal(Engine.interestPreview(run), 3);
    run.money = 40;
    assert.equal(Engine.interestPreview(run), 5, 'capped at $5');
    ok(Engine.startBlind(run));
    run.money = 16;
    forceClear(run);
    assert.equal(run.cashout.lines.find((l) => l.label === 'Interest').amount, 4);
  });

  test('wrapStraights: Q-K-A-2-3 and J-Q-K-A-2 are Straights (in one suit a Straight Flush); not without the rule', () => {
    const [run] = blindWith(['vmerry']);
    const r = score(run, 'QS KH AD 2C 3S');
    deq([r.handId, r.total], ['straight', 280]); // (34 + 10 + 10 + 11 + 2 + 3) x 4
    assert.equal(score(run, 'JS QH KD AC 2S').handId, 'straight');
    assert.equal(score(run, 'QH KH AH 2H 3H').handId, 'straightflush');
    assert.equal(score(run, 'QS KH AD 2C 4S').handId, 'high', 'not a run');
    assert.equal(score(inBlind(), 'QS KH AD 2C 3S').handId, 'high', 'without the rule');
    const uids = setHand(run, ['QS', 'KH', 'AD', '2C', '3S']);
    assert.equal(Engine.preview(run, uids).handId, 'straight', 'the hand preview agrees');
    deq([Engine.evaluate(mks('KS AH 2D 3C 4S'), { wrapStraights: true }).handId, Engine.evaluate(mks('KS AH 2D 3C 4S')).handId], ['straight', 'high']);
  });

  test('acesAreFaces: every face-card check also counts Aces; hand detection and Chips do not change', () => {
    const [run, c] = blindWith(['vcrownface', 'vcourt']);
    const r = score(run, 'AS AH');
    deq(ownRows(r, c), [['chips', 12, '+12'], ['chips', 12, '+12']]);
    deq([r.handId, r.total], ['pair', (12 + 22 + 24) * 2]);
    const [run2, c2] = blindWith(['vcrownface']);
    assert.equal(own(score(run2, 'AS AH'), c2).length, 0);
  });

  test('fourCardFlush: 4 cards of one suit are a Flush; an off-suit fifth card does not score; a Straight with 4 of a suit is a Straight Flush', () => {
    const [run] = blindWith(['vfan']);
    const four = mks('2S 5S 9S KS');
    const r = score(run, four);
    deq([r.handId, r.total], ['flush', 256]); // (38 + 2 + 5 + 9 + 10) x 4
    const five = mks('2S 5S 9S KS 3H');
    const r5 = score(run, five);
    deq([r5.handId, r5.scoringUids, r5.total], ['flush', five.slice(0, 4).map((c) => c.uid), 256]);
    const sf = score(run, '5S 6S 7S 8S 9H');
    deq([sf.handId, sf.scoringUids.length, sf.total], ['straightflush', 5, 1160]); // (110 + 35) x 8
    assert.equal(score(run, '2S 5S 9H KD').handId, 'high');
    assert.equal(score(run, 'KS KH KD 2S 2H').handId, 'fullhouse', 'stronger hands still win');
    assert.equal(score(inBlind(), '2S 5S 9S KS').handId, 'high', 'without the rule');
    const uids = setHand(run, ['2S', '5S', '9S', 'KS']);
    assert.equal(Engine.preview(run, uids).handId, 'flush');
  });

  test('handsContain: a Joker condition naming a hand also accepts a hand that contains it (High Card only itself)', () => {
    const [run, p, h] = blindWith(['vpair', 'vhigh', 'vnest']);
    assert.equal(own(score(run, 'KS KH 5S 5H'), p).length, 1, 'Two Pair contains a Pair');
    assert.equal(own(score(run, 'KS KH KD 5S 5H'), p).length, 1, 'a Full House contains a Pair');
    assert.equal(own(score(run, '5S 6H 7D 8C 9S'), p).length, 0, 'a Straight does not');
    assert.equal(own(score(run, 'KS KH'), h).length, 0, 'High Card accepts only itself');
    assert.equal(own(score(run, 'KS'), h).length, 1);
    assert.equal(score(run, 'KS KH 5S 5H').handId, 'twopair', 'detection does not change');
    const [run2, p2] = blindWith(['vpair']);
    assert.equal(own(score(run2, 'KS KH 5S 5H'), p2).length, 0, 'without the rule: exactly a Pair');
  });

  test('handsContain also widens mostPlayed', () => {
    const [run, s] = blindWith(['vsignature', 'vnest']);
    run.plays.pair = 3;
    assert.equal(own(score(run, 'KS KH 5S 5H'), s).length, 1);
  });

  test('tarotSelectPlus: a Tarot card that uses selected cards takes 1 more; Spectral cards do not change', () => {
    const run = inBlind();
    add(run, 'vhelp');
    const sel = setHand(run, ['2S', '3S', '4S']);
    const k = give(run, 'tarot', 'inkpot');
    deq(Engine.consumableInfo(run, k).select, [1, 3]);
    ok(Engine.useConsumable(run, k, sel));
    for (const u of sel) assert.equal(cardOf(run, u).enhancement, 'inked');
    const c = give(run, 'spectral', 'cursedcoin');
    deq(Engine.consumableInfo(run, c).select, [1, 2]);
    fails(Engine.useConsumable(run, c, run.blind.hand.slice(0, 3)), 'Cursed Coin on 3', 'Select 1 or 2 cards.');
    fails(Engine.useConsumable(run, give(run, 'tarot', 'paintbucket'), run.blind.hand.slice(0, 5)), 'The Tailor on 5', 'Select 2 to 4 cards.');
    const two = setHand(run, ['5S', '6H']);
    const cc = ok(Engine.useConsumable(run, give(run, 'tarot', 'carboncopy'), two));
    deq([cc.effect.created.length, cc.effect.sourceUids], [2, two], 'Carbon Copy copies both selected cards');
    const bare = inBlind();
    fails(Engine.useConsumable(bare, give(bare, 'tarot', 'inkpot'), bare.blind.hand.slice(0, 3)), 'without the rule', 'Select 1 or 2 cards.');
  });

  test('firstPackExtraPick: the first pack bought in each Shop visit allows 1 more pick (never more than it shows); later and Tag packs do not', () => {
    const run = fresh();
    add(run, 'vdip');
    toShop(run);
    buyPack(run, 'cardnormal');
    assert.equal(run.pack.picksLeft, 2);
    ok(Engine.packPick(run, 0));
    assert.equal(ok(Engine.packPick(run, 1)).closed, true);
    buyPack(run, 'cardnormal', 1);
    assert.equal(run.pack.picksLeft, 1, 'the second pack this visit');
    ok(Engine.packSkip(run));
    ok(Engine.leaveShop(run));
    run.tags[`${run.ante}-${run.blindIndex}`] = 'grabbag';
    ok(Engine.skipBlind(run));
    assert.equal(run.pack.picksLeft, 1, 'a Tag pack');
    ok(Engine.packSkip(run));
    toShop(run);
    buyPack(run, 'jokernormal');
    assert.equal(run.pack.picksLeft, 2, 'a Joker Pack shows 2: 2 picks');
    ok(Engine.packSkip(run));
    const run2 = fresh();
    add(run2, 'vdip');
    toShop(run2);
    run2.shop.packsBought = 1;
    buyPack(run2, 'cardnormal');
    assert.equal(run2.pack.picksLeft, 1, 'shop.packsBought counts the packs bought this visit');
  });

  test('bossTargetMult: Boss Blind targets x0.8 in the previews and at the start; selling it before the start removes it', () => {
    const run = fresh();
    run.bosses[1] = 'smudge';
    const st = add(run, 'vsmooth');
    deq(Engine.blindsForAnte(run).map((b) => b.target), [300, 450, 480]);
    assert.equal(Engine.blindTarget(run, 1, 2), 480);
    ok(Engine.sellJoker(run, st.uid));
    assert.equal(Engine.blindTarget(run, 1, 2), 600);
    add(run, 'vsmooth');
    toBoss(run);
    assert.equal(run.blind.target, 480);
    const wet = fresh();
    wet.bosses[1] = 'wetblanket';
    add(wet, 'vsmooth');
    assert.equal(Engine.blindTarget(wet, 1, 2), 600, 'The Wet Blanket switches the leftmost Joker off');
    toBoss(wet);
    assert.equal(wet.blind.target, 600);
  });

  test('voucherPriceMult: Vouchers cost half, rounded up, before Season Pass; buying or selling the Joker in the Shop re-prices at once', () => {
    const run = fresh();
    add(run, 'vusher');
    toShop(run);
    const v = run.shop.items.find((it) => it.kind === 'voucher');
    assert.equal(v.price, 5);
    const off = fresh();
    off.vouchers.push('dollaroff');
    add(off, 'vusher');
    toShop(off);
    assert.equal(off.shop.items.find((it) => it.kind === 'voucher').price, 4, '$10 x 0.5 = $5, then $1 off');
    const run2 = toShop(fresh());
    const v2 = run2.shop.items.find((it) => it.kind === 'voucher');
    assert.equal(v2.price, 10);
    const i = run2.shop.items.findIndex((it) => it.slot === 'card');
    Object.assign(run2.shop.items[i], { kind: 'joker', id: 'vusher', price: 5, sold: false, edition: null });
    run2.money = 20;
    ok(Engine.buy(run2, i));
    assert.equal(v2.price, 5, 'at once');
    ok(Engine.sellJoker(run2, run2.jokers.find((j) => j.id === 'vusher').uid));
    assert.equal(v2.price, 10);
  });

  test('wildJacks: each Jack stands in for any rank to make the strongest hand; it keeps its own Chips', () => {
    const [run] = blindWith(['vjat']);
    const r = score(run, 'KS KH JD');
    deq([r.handId, r.scoringUids.length, r.total], ['three', 3, 186]); // (32 + 30) x 3
    deq([score(run, '5S 6H 7D 8C JS').handId, score(run, '5S 6H 7D 8C JS').total], ['straight', 280]);
    deq([score(run, 'JS JH JD JC JS').handId, score(run, 'JS JH JD JC JS').scoringUids.length], ['four', 5], 'five of a rank: Four of a Kind');
    assert.equal(score(run, 'KS KH JD JC').handId, 'four');
    assert.equal(score(run, 'JS').handId, 'high');
    assert.equal(score(inBlind(), 'KS KH JD').handId, 'pair', 'without the rule');
    const uids = setHand(run, ['KS', 'KH', 'JD']);
    assert.equal(Engine.preview(run, uids).handId, 'three');
    assert.equal(Engine.evaluate(mks('9S 9H JD JC 2S'), { wildJacks: true }).handId, 'four');
  });

  test('editionsTwice: every Edition step fires twice (cards, every pass; Jokers before and after; Phantom rank-as-Mult); nothing under The Blackout', () => {
    const [run] = blindWith(['vkaleido']);
    const k = mk('KS+gloss');
    const r = score(run, [k]);
    deq(r.steps.filter((s) => s.via === 'edition').map((s) => [s.uid, s.amount]), [[k.uid, 40], [k.uid, 40]]);
    assert.equal(r.total, 95);
    assert.equal(score(run, 'KS+inverted').total, 5 * 21); // the rank as Mult, twice
    assert.equal(score(run, 'KS+fourcolor+encore').steps.filter((s) => s.kind === 'xmult').length, 4);
    const d = add(run, 'vdrum', 'gloss');
    deq(own(score(run, '2S'), d).map((s) => [s.via, s.amount]), [['edition', 40], ['edition', 40], ['joker', 40]]);
    run.blind.boss = 'censor';
    assert.equal(score(run, 'KS+gloss').steps.filter((s) => s.via === 'edition').length, 0);
  });

  test('blindMoneyX: card and Joker money during a Blind pays double (scored, held-over, discarded); the cash-out does not', () => {
    const [run] = blindWith(['vgolden', 'vgold', 'vclipper']);
    const r = score(run, 'AS AH+dimestore');
    deq(r.steps.filter((s) => s.kind === 'money').map((s) => [s.source, s.amount, s.label]), [['joker', 2, '+$2'], ['card', 2, '+$2'], ['joker', 2, '+$2']]);
    const [a, b] = setHand(run, ['AS', 'AH+dimestore']);
    const m = run.money;
    deq(ok(Engine.playHand(run, [a, b])).money, 6);
    assert.equal(run.money, m + 6);
    const [c] = setHand(run, ['5S+crumpled']);
    deq(ok(Engine.discard(run, [c])).money, 2);
    forceClear(run);
    deq(run.cashout.lines.find((l) => l.label === NAME.vclipper), { label: NAME.vclipper, amount: 2 }, '2 unused discards: $2, not doubled');
    const plain = score(inBlind(), 'KS+dimestore');
    assert.equal(plain.steps.find((s) => s.kind === 'money').amount, 1);
  });

  test('everySuit: every card counts as every suit, for detection and suit checks, even under The Wash-Out', () => {
    const [run, , red] = blindWith(['vmotley', 'vredsuit']);
    const r = score(run, '2S 5H 9D KC 7S');
    deq([r.handId], ['flush']);
    assert.equal(score(run, '5S 6H 7D 8C 9S').handId, 'straightflush');
    deq(ownRows(score(run, 'KS KH'), red), [['mult', 2, '+2'], ['mult', 2, '+2']]);
    run.blind.boss = 'washout';
    assert.equal(score(run, '2S 5H 9D KC 7S').handId, 'flush');
    assert.equal(score(inBlind(), '2S 5H 9D KC 7S').handId, 'high');
  });
});

// =========================================================================================
describe('vocabulary: copy (Stand-In, Old Flame, The Puppet Master)', () => {
  test("copy 'random': Stand-In acts as its target; its steps name it with the target; the live text and jokerCopies say what it copies", () => {
    const [run, d, s] = blindWith(['vdrum', 'vstandin']);
    assert.equal(jokerOf(run, s.uid).state.target, d.uid);
    const r = score(run, 'KS KH');
    assert.equal(r.total, 224); // (32 + 40 + 40) x 2
    deq(own(r, s).map((st) => [st.kind, st.amount, st.via, st.copyOf, st.jokerName]), [['chips', 40, 'joker', 'vdrum', 'V standin (as V drum)']]);
    deq(own(r, d).map((st) => [st.copyOf, st.jokerName]), [[null, 'V drum']]);
    assert.match(Engine.jokerText(run, s.uid), /\(copying: V drum\)$/);
    deq(Engine.jokerCopies(run, s.uid), [{ id: 'vdrum', uid: d.uid }]);
    deq(Engine.jokerCopies(run, d.uid), [], 'not a copier');
  });

  test('Stand-In: no other Joker, nothing; it never picks another Stand-In; it picks a new target when each Blind starts', () => {
    const [run, s] = blindWith(['vstandin']);
    deq([jokerOf(run, s.uid).state.target, score(run, 'KS KH').total], [null, 64]);
    assert.match(Engine.jokerText(run, s.uid), /\(copying: nothing\)$/);
    for (const seed of ['STAND001', 'STAND002', 'STAND003', 'STAND004']) {
      const [r2, d, a, b] = blindWith(['vdrum', 'vstandin', 'vstandin'], { seed });
      assert.equal(jokerOf(r2, a.uid).state.target, d.uid, seed);
      assert.equal(jokerOf(r2, b.uid).state.target, d.uid, seed);
    }
    const seen = new Set();
    for (const seed of ['PICK0001', 'PICK0002', 'PICK0003', 'PICK0004', 'PICK0005', 'PICK0006']) {
      const run3 = fresh({ seed });
      add(run3, 'vdrum');
      add(run3, 'vimp');
      const s3 = add(run3, 'vstandin');
      ok(Engine.startBlind(run3));
      seen.add(jokerOf(run3, s3.uid).state.target === run3.jokers[0].uid ? 'drum' : 'imp');
    }
    deq(sorted([...seen]), ['drum', 'imp'], 'a random pick (both turn up over a few seeds)');
  });

  test('Stand-In: when its target leaves the rack it picks again at once', () => {
    const [run, d, i, s] = blindWith(['vdrum', 'vimp', 'vstandin']);
    const target = jokerOf(run, s.uid).state.target;
    const other = target === d.uid ? i.uid : d.uid;
    ok(Engine.sellJoker(run, target));
    assert.equal(jokerOf(run, s.uid).state.target, other);
    const run2 = fresh();
    const d2 = add(run2, 'vdrum');
    const s2 = add(run2, 'vstandin');
    ok(Engine.sellJoker(run2, d2.uid));
    assert.equal(jokerOf(run2, s2.uid).state.target, null, 'nothing left to copy');
  });

  test("Stand-In reads the target's state, but the target's gain events do not fire twice", () => {
    const [run, m, s] = blindWith(['vmagpie', 'vstandin']);
    assert.equal(jokerOf(run, s.uid).state.target, m.uid);
    ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    deq([jokerOf(run, m.uid).state.chips, jokerOf(run, s.uid).state.chips], [4, undefined]);
    assert.equal(score(run, 'KS KH').total, 80); // (32 + 4 + 4) x 2
    const [run2, j, s2] = blindWith(['vjack', 'vstandin']);
    const r = score(run2, 'JS JH');
    deq([r.jokerGains.length, own(r, s2).map((st) => st.amount)], [2, [2]], 'only the Jack-in-the-Box gains; the copy reads its gains');
    assert.equal(r.total, 32 * 6);
  });

  test("Stand-In's Edition is its own", () => {
    const run = fresh();
    add(run, 'vimp');
    const s = add(run, 'vstandin', 'gloss');
    ok(Engine.startBlind(run));
    deq(own(score(run, 'KS KH'), s).map((st) => [st.via, st.kind, st.amount, st.edition, st.copyOf]), [['edition', 'chips', 40, 'gloss', null], ['joker', 'mult', 5, null, 'vimp']]);
  });

  test('copies carry rules: a Stand-In copying a switched-off Merry-Go-Round still wraps Straights', () => {
    const run = fresh();
    add(run, 'vmerry');
    add(run, 'vstandin');
    toBoss(run, 'wetblanket');
    assert.equal(score(run, 'QS KH AD 2C 3S').handId, 'straight');
    const bare = fresh();
    add(bare, 'vmerry');
    toBoss(bare, 'wetblanket');
    assert.equal(score(bare, 'QS KH AD 2C 3S').handId, 'high', 'the switched-off Joker gives no rule');
  });

  test('copies carry retrigger, held and cash-out effects', () => {
    const [run, e, s] = blindWith(['vecho', 'vstandin']);
    const k = mk('KS');
    const again = score(run, [k]).steps.filter((st) => st.label === 'Encore!');
    deq(again.map((st) => [st.jokerUid, st.copyOf, st.jokerName]), [[e.uid, null, 'V echo'], [s.uid, 'vecho', 'V standin (as V echo)']]);
    const [run2] = blindWith(['vclip', 'vstandin']);
    assert.equal(score(run2, '2S', 'QD').total, 17); // 7 + 5 + 5
    const [run3] = blindWith(['vclipper', 'vstandin']);
    forceClear(run3);
    deq(run3.cashout.lines.filter((l) => /clipper/.test(l.label)), [{ label: NAME.vclipper, amount: 3 }, { label: 'V standin (as V clipper)', amount: 3 }]);
  });

  test("copy 'lastSold': Old Flame copies nothing until you sell a Joker, then acts as it; selling another replaces it", () => {
    const run = inBlind();
    const f = add(run, 'vflame');
    assert.equal(score(run, 'KS KH').total, 64);
    assert.match(Engine.jokerText(run, f.uid), /\(nothing yet\)$/);
    const d = add(run, 'vdrum');
    const sold = ok(Engine.sellJoker(run, d.uid));
    deq(jokerOf(run, f.uid).state.copy, { id: 'vdrum', state: {} });
    deq(evOps(sold, 'copy').map((e) => [e.uid, e.copyOf, e.from]), [[f.uid, 'vdrum', d.uid]]);
    const r = score(run, 'KS KH');
    assert.equal(r.total, 144);
    deq(own(r, f).map((st) => [st.copyOf, st.jokerName]), [['vdrum', 'V flame (as V drum)']]);
    assert.match(Engine.jokerText(run, f.uid), /\(now: V drum\)$/);
    deq(Engine.jokerCopies(run, f.uid), [{ id: 'vdrum', uid: null }]);
    ok(Engine.sellJoker(run, add(run, 'vimp').uid));
    assert.equal(score(run, 'KS KH').total, 32 * 7, 'now the Imp, no more Drum');
  });

  test('Old Flame runs the copied events on its own state; an ability that would destroy itself leaves it with nothing', () => {
    const run = inBlind();
    run.blind.target = 1e9;
    run.blind.handsLeft = 20;
    const f = add(run, 'vflame');
    const c = add(run, 'vcandle');
    ok(Engine.playHand(run, [run.blind.hand[0]]));
    assert.equal(jokerOf(run, c.uid).state.mult, 14);
    ok(Engine.sellJoker(run, c.uid));
    deq(jokerOf(run, f.uid).state.copy, { id: 'vcandle', state: { mult: 14 } });
    assert.match(Engine.jokerText(run, f.uid), /\(now: V candle, now \+14 Mult\)$/);
    const p = ok(Engine.playHand(run, [run.blind.hand[0]]));
    assert.equal(p.result.steps.find((st) => st.uid === f.uid).amount, 14);
    assert.equal(jokerOf(run, f.uid).state.copy.state.mult, 13, 'it burns down on its own copy');
    jokerOf(run, f.uid).state.copy.state.mult = 1;
    const last = ok(Engine.playHand(run, [run.blind.hand[0]]));
    deq([jokerOf(run, f.uid).state.copy, last.eaten, evOps(last, 'forgot').map((e) => e.uid)], [null, [], [f.uid]]);
    assert.ok(jokerOf(run, f.uid), 'Old Flame stays in the rack');
  });

  test("Old Flame as Last Laugh: its own 'sold' event fires when Old Flame is sold during a Blind", () => {
    const run = inBlind();
    const f = add(run, 'vflame');
    const l = add(run, 'vlaugh');
    const h = run.blind.handsLeft;
    ok(Engine.sellJoker(run, l.uid));
    assert.equal(run.blind.handsLeft, h + 1);
    ok(Engine.sellJoker(run, f.uid));
    assert.equal(run.blind.handsLeft, h + 2);
  });

  test("copy 'neighbours': The Puppet Master copies the Joker on its left, then the one on its right; at an end its one neighbour", () => {
    const [run, d, p, i] = blindWith(['vdrum', 'vpuppet', 'vimp']);
    const r = score(run, 'KS KH');
    assert.equal(r.total, 1344); // (32 + 40 + 40) x (2 + 5 + 5)
    deq(r.steps.filter((st) => st.source === 'joker').map((st) => [st.uid === p.uid ? 'pm' : st.uid === d.uid ? 'drum' : 'imp', st.amount, st.copyOf]), [['drum', 40, null], ['pm', 40, 'vdrum'], ['pm', 5, 'vimp'], ['imp', 5, null]]);
    assert.match(Engine.jokerText(run, p.uid), /\(copying: V drum and V imp\)$/);
    deq(Engine.jokerCopies(run, p.uid), [{ id: 'vdrum', uid: d.uid }, { id: 'vimp', uid: i.uid }]);
    const [run2] = blindWith(['vpuppet', 'vdrum']);
    assert.equal(score(run2, 'KS KH').total, 224);
    ok(Engine.reorderJokers(run, [p.uid, d.uid, i.uid]));
    assert.equal(score(run, 'KS KH').total, (32 + 80) * 7, 'moved to the end: only the Drum');
  });

  test('copy chains resolve to the final target; loops and missing targets give nothing; a deep chain stops', () => {
    const [run, d, p, s] = blindWith(['vdrum', 'vpuppet', 'vstandin']);
    jokerOf(run, s.uid).state.target = d.uid;
    assert.equal(score(run, 'KS KH').total, 384); // Drum, PM as Drum and as Stand-In as Drum, Stand-In as Drum: 32 + 160
    deq(Engine.jokerCopies(run, p.uid).map((c) => c.id), ['vdrum', 'vdrum']);
    const [loop, p2, s2] = blindWith(['vpuppet', 'vstandin']);
    jokerOf(loop, s2.uid).state.target = p2.uid;
    assert.equal(score(loop, 'KS KH').total, 64, 'Puppet Master <-> Stand-In: a loop does nothing');
    deq([Engine.jokerCopies(loop, p2.uid), Engine.jokerCopies(loop, s2.uid)], [[], []]);
    const [cyc, a, b, c] = blindWith(['vstandin', 'vstandin', 'vstandin']);
    jokerOf(cyc, a.uid).state.target = b.uid;
    jokerOf(cyc, b.uid).state.target = c.uid;
    jokerOf(cyc, c.uid).state.target = a.uid;
    assert.equal(score(cyc, 'KS KH').total, 64);
    const [gone, s3] = blindWith(['vstandin']);
    jokerOf(gone, s3.uid).state.target = 'h99999';
    assert.equal(score(gone, 'KS KH').total, 64, 'a missing target');
    const [deep, f] = blindWith(['vflame']);
    let copy = { id: 'vdrum', state: {} };
    for (let k = 0; k < 30; k++) copy = { id: 'vflame', state: { copy } };
    jokerOf(deep, f.uid).state.copy = copy;
    assert.equal(score(deep, 'KS KH').total, 64, 'a chain deeper than the limit resolves to nothing');
    assert.ok(Engine.jokerText(deep, f.uid).length > 0);
    const [shallow, f2] = blindWith(['vflame']);
    jokerOf(shallow, f2.uid).state.copy = { id: 'vflame', state: { copy: { id: 'vdrum', state: {} } } };
    assert.equal(score(shallow, 'KS KH').total, 144, 'Old Flame remembering an Old Flame follows it');
  });
});

// =========================================================================================
describe('vocabulary: API additions and the JSON round trip', () => {
  test('every step carries copyOf and jokerName; jokerGains is always an array', () => {
    const [run, d] = blindWith(['vdrum']);
    const r = score(run, 'KS+encore KH', 'QD+spotlit');
    for (const st of r.steps) {
      assert.ok('copyOf' in st && 'jokerName' in st);
      if (st.source === 'joker') assert.equal(st.jokerName, NAME.vdrum);
      else if (!st.jokerUid) assert.equal(st.jokerName, null);
    }
    deq(r.jokerGains, []);
    assert.ok(d);
  });

  test('actions report jokerEvents: startBlind, skipBlind, playHand, discard, useConsumable, buy, sellJoker, packPick', () => {
    const run = fresh();
    add(run, 'vdoor');
    for (const res of [Engine.startBlind(run), Engine.playHand(run, [run.blind.hand[0]]), Engine.discard(run, [run.blind.hand[0]]), Engine.useConsumable(run, give(run, 'tarot', 'overtime'), [])]) {
      ok(res);
      assert.ok(Array.isArray(res.jokerEvents));
    }
    forceClear(run);
    ok(Engine.collect(run));
    const b = buyPack(run, 'cardnormal');
    assert.ok(Array.isArray(b.jokerEvents));
    assert.ok(Array.isArray(ok(Engine.packPick(run, 0)).jokerEvents));
    assert.ok(Array.isArray(ok(Engine.sellJoker(run, run.jokers[0].uid)).jokerEvents));
    ok(Engine.leaveShop(run));
    run.tags[`${run.ante}-${run.blindIndex}`] = 'piggybank';
    assert.ok(Array.isArray(ok(Engine.skipBlind(run)).jokerEvents));
  });

  test('the new state is plain JSON: a run round-trips through serialize and plays on exactly like the original', () => {
    const run = fresh({ seed: 'ROUNDTR1' });
    run.jokerSlots = 8;
    add(run, 'vdrum');
    add(run, 'vstandin');
    add(run, 'vflame');
    add(run, 'vcoin');
    add(run, 'vbag');
    ok(Engine.sellJoker(run, add(run, 'vjack').uid));
    ok(Engine.startBlind(run));
    add(run, 'vsleight');
    ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    ok(Engine.playHand(run, [run.blind.hand[0]]));
    const copy = Engine.deserialize(Engine.serialize(run));
    deq(copy, run);
    assert.equal(typeof copy.jokers.find((j) => j.id === 'vstandin').state.target, 'string');
    deq(copy.jokers.find((j) => j.id === 'vflame').state.copy, { id: 'vjack', state: { mult: 0 } });
    deq([copy.blind.freeDiscardUsed, copy.blind.handSizeBy[run.jokers.find((j) => j.id === 'vbag').uid]], [true, 1]);
    const steps = (r) => [Engine.playHand(r, [r.blind.hand[0]]), Engine.discard(r, [r.blind.hand[0]]), Engine.playHand(r, r.blind.hand.slice(0, 2))];
    deq(steps(copy), steps(run));
    deq(copy, run);
    run.blind.score = run.blind.target;
    copy.blind.score = copy.blind.target;
    toShopFrom(run);
    toShopFrom(copy);
    buyPack(run, 'cardnormal');
    buyPack(copy, 'cardnormal');
    deq(copy.shop.packsBought, 1);
    deq(copy, run);
  });
});
function toShopFrom(run) {
  if (run.phase === 'play') {
    run.blind.score = run.blind.target - 1;
    ok(Engine.playHand(run, [run.blind.hand[0]]));
  }
  ok(Engine.collect(run));
}
