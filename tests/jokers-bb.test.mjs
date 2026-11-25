/*
 * Wickwager: black-box tests for the 120 Jokers, 1-3 tests each, through the public API.
 *
 * Written from the design only: content/content-plan.json (each Joker's text and behaviour),
 * CONTENT.md (behaviours, engine rows, the vocabulary), content/CHECKS.md, and SPEC.md §2 and §4.
 * src/engine.js and src/content.js were not read; they are loaded into a vm context by
 * tests/jokers-bb-harness.mjs, which also holds the design tables and the ONE ASSUMED table
 * (every API guess, realignable in one place; search this file for "ASSUMED." to find its uses).
 *
 * Every test title starts with the Joker's design name and id, and every assertion message names
 * the Joker and the value its text promises. Expected numbers are hand-computed from the text:
 * the arithmetic is in the titles and comments. A plain Pair of Kings (KK) scores
 * 12 + 10 + 10 = 32 Chips x 2 Mult = 64; a lone King (High Card) 5 + 10 = 15 x 1 = 15.
 *
 * Run from the project root: node --test "tests/*.test.mjs"
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSUMED, Engine, Content, DESIGN, DESIGN_IDS, ENHANCEMENT_IDS, SEAL_IDS, TAROT_IDS, SPECTRAL_IDS, PLANET_OF,
  plain, deq, pickKeys, approx, seedN, ok, bad, label, jokerRow, jokerName,
  mkRun, begin, blindRun, bossRun, mk, cards, KK, cardRef, setHand, score, play, discard, playLow, clearBlind,
  toShop, shopRun, nextBlind, shopItems, openPack, forceCard, skipWith, give, use, pick,
  owns, addJ, needRow, st, setSt, editionSteps, moneySteps, againNotes, cashLines, jokerLine,
  expectTotals, expectJokerSteps,
} from './jokers-bb-harness.mjs';

// A test about one Joker: the title names it, and fn gets { id, L } (L is the label for messages).
const jt = (id, title, fn) => test(`${label(id)}: ${title}`, () => fn({ id, L: label(id) }));
const interestOf = (run) => (cashLines(run).find((l) => l.label === ASSUMED.interestLabel) || {}).amount;

// ================================================================== the table
describe('the 120-Joker table (design ids, rarity, cost)', () => {
  test('TW.Content.JOKERS holds all 120 design Jokers with their design rarity and cost', () => {
    const missing = [];
    const wrong = [];
    for (const id of DESIGN_IDS) {
      const r = jokerRow(id);
      if (!r) {
        missing.push(id);
        continue;
      }
      const [, rarity, cost] = DESIGN[id];
      if (r.rarity !== rarity || r.cost !== cost) wrong.push(`${label(id)} is ${r.rarity} $${r.cost}, expected ${rarity} $${cost}`);
    }
    assert.deepEqual(missing, [], `${missing.length} of 120 design Jokers are missing from TW.Content.JOKERS: ${missing.join(' ')}`);
    assert.deepEqual(wrong, [], wrong.join('; '));
    const counts = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
    for (const id of DESIGN_IDS) counts[jokerRow(id).rarity]++;
    deq(counts, { common: 60, uncommon: 40, rare: 15, legendary: 5 }, '60 common, 40 uncommon, 15 rare, 5 Legendary');
  });

  test('Engine.jokerProblems reports no unknown vocabulary word in any of the 120 rows', () => {
    const problems = [];
    for (const id of DESIGN_IDS) {
      const r = jokerRow(id);
      if (!r) {
        problems.push(`${label(id)}: no row in TW.Content.JOKERS`);
        continue;
      }
      const p = plain(Engine.jokerProblems(r)) || [];
      if (p.length) problems.push(`${label(id)}: ${p.join(' / ')}`);
    }
    assert.deepEqual(problems, [], `${problems.length} rows still use words the engine does not know:\n${problems.join('\n')}`);
  });

  test('every Joker sells for half its listed cost, rounded down, minimum $1 (Legendary $20 -> $10)', () => {
    const wrong = [];
    for (const id of DESIGN_IDS) {
      const run = mkRun();
      const j = Engine.addJoker(run, id, 0, null);
      const expected = Math.max(1, Math.floor(DESIGN[id][2] / 2));
      const got = j && j.uid ? Engine.jokerSellValue(run, j.uid) : 'not added';
      if (got !== expected) wrong.push(`${label(id)}: sells for ${got}, expected $${expected}`);
    }
    assert.deepEqual(wrong, [], `${wrong.length} Jokers sell wrong:\n${wrong.join('\n')}`);
  });
});

// ================================================================== Common Jokers
describe('Common Jokers (60)', () => {
  // ---------------------------------------------------------------- Jingle Jester
  jt('jinglejester', '+15 Chips, then +3 Mult, every hand (KK: 47 x 5 = 235)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, KK());
    expectTotals(id, res, 47, 5, 235, 'Pair of Kings 32 + 15 Chips, 2 + 3 Mult');
    expectJokerSteps(id, res, j, [['chips', 15], ['mult', 3]], 'two steps, Chips first');
  });

  // ---------------------------------------------------------------- Pipsqueak
  jt('pipsqueak', '+45 Chips when 1 or 2 cards are played, scoring or not', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 77, 2, 154, 'two cards (KK): 32 + 45');
    expectTotals(id, score(run, cards('KS', '2C')), 60, 1, 60, 'two cards, one unscored (High Card): 5 + 10 + 45');
    expectTotals(id, score(run, cards('KS')), 60, 1, 60, 'one card: 5 + 10 + 45');
  });
  jt('pipsqueak', 'nothing with 3 or more cards played (KS KH 2C: 64)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, cards('KS', 'KH', '2C'));
    expectTotals(id, res, 32, 2, 64, 'three cards played');
    expectJokerSteps(id, res, j, [], 'no step');
  });

  // ---------------------------------------------------------------- Gingerbread Fool
  jt('gingerbreadfool', '+60 Chips to start (KK: 92 x 2 = 184)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    assert.equal(st(run, j), 60, `${L}: state.chips starts at 60`);
    expectTotals(id, score(run, KK()), 92, 2, 184, 'Pair of Kings 32 + 60');
  });
  jt('gingerbreadfool', 'loses 15 Chips each Blind you beat; a skipped Blind does not count; the text shows it', ({ id, L }) => {
    const run = mkRun();
    const j = addJ(run, id);
    skipWith(run, 'headstart');
    assert.equal(st(run, j), 60, `${L}: skipping the Small Blind leaves it at 60`);
    begin(run);
    clearBlind(run);
    assert.equal(st(run, j), 45, `${L}: beating the Big Blind takes it from 60 to 45`);
    // ASSUMED A14: the live value appears in jokerText.
    assert.ok(String(Engine.jokerText(run, j.uid)).includes('45'), `${L}: jokerText shows the live +45, got "${Engine.jokerText(run, j.uid)}"`);
  });
  jt('gingerbreadfool', 'eaten when it falls to 0: playHand lists it in eaten and it leaves the rack', ({ id, L }) => {
    const run = mkRun();
    const j = addJ(run, id);
    begin(run);
    setSt(run, j, 15);
    const r = clearBlind(run);
    assert.ok((r.eaten || []).includes(j.uid), `${L}: 15 - 15 = 0, so it is eaten (playHand eaten: ${JSON.stringify(r.eaten)})`);
    assert.ok(!owns(run, j.uid), `${L}: it left the rack`);
  });

  // ---------------------------------------------------------------- Party Horn
  jt('partyhorn', '+8 Mult on the first hand of a Blind (KK: 32 x 10 = 320), nothing on later hands (64)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectTotals(id, score(run, KK()), 32, 10, 320, 'first hand (blind.handsPlayed 0)');
    run.blind.handsPlayed = 1;
    const res = score(run, KK());
    expectTotals(id, res, 32, 2, 64, 'second hand (blind.handsPlayed 1)');
    expectJokerSteps(id, res, j, [], 'no step after the first hand');
  });
  jt('partyhorn', 'in play: the first hand gets +8 Mult, the second does not', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectJokerSteps(id, playLow(run).result, j, [['mult', 8]], 'the first hand played');
    expectJokerSteps(id, playLow(run).result, j, [], 'the second hand played');
  });

  // ---------------------------------------------------------------- Paper Crown
  jt('papercrown', 'scored face cards give +12 Chips each (KK: 56 x 2 = 112); an unscored Queen and 5s give nothing', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const [ks, kh] = KK();
    const res = score(run, [ks, kh]);
    expectTotals(id, res, 56, 2, 112, 'two scored Kings, +12 each');
    deq(
      res.steps.filter((s) => s.source === 'joker').map((s) => [s.cardUid, s.kind, s.amount]),
      [[ks.uid, 'chips', 12], [kh.uid, 'chips', 12]],
      `${L}: one on-card step per King, pointing at the card`,
    );
    expectTotals(id, score(run, cards('KS', 'KH', 'QD')), 56, 2, 112, 'Pair of Kings with an unscored Queen');
    expectTotals(id, score(run, cards('5S', '5H')), 22, 2, 44, 'Pair of 5s: no face card');
  });
  jt('papercrown', 'fires on every pass: an Encore King gives it twice (12 + 22 + 22 + 22 = 78 x 2 = 156)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { seal: 'encore' }), mk('KH')]), 78, 2, 156, 'Encore King: 2 passes of 10 + 12, then 10 + 12');
  });

  // ---------------------------------------------------------------- Coupon Clipper
  jt('couponclipper', 'cash-out: +$1 per unused discard, a line after Interest ($10 held, 3 unused: $3)', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run);
    clearBlind(run, { money: 10 });
    const lines = cashLines(run);
    const i = lines.findIndex((l) => l.label === jokerName(id));
    assert.ok(i >= 0, `${L}: a cash-out line labelled "${jokerName(id)}" (lines: ${JSON.stringify(lines)})`);
    assert.equal(lines[i].amount, 3, `${L}: 3 unused discards = $3`);
    const interest = lines.findIndex((l) => l.label === ASSUMED.interestLabel);
    assert.ok(interest >= 0 && interest < i, `${L}: the Joker line comes after Interest (lines: ${JSON.stringify(lines)})`);
  });
  jt('couponclipper', 'one discard used: $2; no discards left: no line', ({ id, L }) => {
    const a = mkRun();
    addJ(a, id);
    begin(a);
    discard(a, a.blind.hand.slice(0, 1));
    clearBlind(a);
    assert.equal((jokerLine(a, id) || {}).amount, 2, `${L}: 2 unused discards = $2`);
    const b = mkRun();
    addJ(b, id);
    begin(b);
    b.blind.discardsLeft = 0;
    clearBlind(b);
    assert.equal(jokerLine(b, id), null, `${L}: a $0 line is left out`);
  });

  // ---------------------------------------------------------------- Empty Seats
  jt('emptyseats', '+2 Mult per empty Joker slot, its own slot used (alone: 4 empty, 32 x 10 = 320)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, KK());
    expectTotals(id, res, 32, 10, 320, '5 slots - 1 used = 4 empty, +8 Mult');
    expectJokerSteps(id, res, j, [['mult', 8]]);
  });
  jt('emptyseats', 'a Phantom Joker takes no slot (with Tin Drum: 72 x 8 = 576; with a Phantom Tin Drum: 72 x 10 = 720)', ({ id }) => {
    const a = blindRun();
    addJ(a, id);
    addJ(a, 'tindrum');
    expectTotals(id, score(a, KK()), 72, 8, 576, '3 empty slots (+6 Mult), Tin Drum +40 Chips');
    const b = blindRun();
    addJ(b, id);
    addJ(b, 'tindrum', 'inverted');
    expectTotals(id, score(b, KK()), 72, 10, 720, 'a Phantom Tin Drum uses no slot: 4 empty (+8 Mult)');
  });
  jt('emptyseats', 'no step with every slot full', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    for (const other of ['solofiddler', 'squaredance', 'tightrope', 'peacock']) addJ(run, other); // none of them fires on a Pair
    const res = score(run, KK());
    expectTotals(id, res, 32, 2, 64, '0 empty slots');
    expectJokerSteps(id, res, j, [], 'no step at 0');
  });

  // ---------------------------------------------------------------- Pinwheel
  jt('pinwheel', '+3 Mult per different suit among scored cards (KS KH: 2 suits, 32 x 8 = 256)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 32, 8, 256, 'Spade and Heart: +6 Mult');
    expectTotals(id, score(run, cards('KS', 'KH', '2C')), 32, 8, 256, 'an unscored Club does not count');
  });
  jt('pinwheel', 'a Masked card counts as all four suits (42 x 14 = 588)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { enhancement: 'scribbled' }), mk('KH')]), 42, 14, 588, 'Masked King (+10 Chips) and a Heart: 4 suits, +12 Mult');
  });

  // ---------------------------------------------------------------- Sleight of Hand
  jt('sleightofhand', 'once per Blind a discard of 1 or 2 cards is free; the next one costs a discard', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run);
    assert.equal(run.blind.discardsLeft, 3);
    const r1 = discard(run, run.blind.hand.slice(0, 2));
    assert.equal(run.blind.discardsLeft, 3, `${L}: a discard of 2 cards is free, discardsLeft stays 3`);
    assert.equal(r1[ASSUMED.discardFree], true, `${L}: the discard result says it was free`);
    const r2 = discard(run, run.blind.hand.slice(0, 1));
    assert.equal(run.blind.discardsLeft, 2, `${L}: the free discard is used up, so 3 -> 2`);
    assert.ok(!r2[ASSUMED.discardFree], `${L}: the second discard was not free`);
  });
  jt('sleightofhand', 'a discard of 3 cards is not free and keeps the free one for later', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run);
    discard(run, run.blind.hand.slice(0, 3));
    assert.equal(run.blind.discardsLeft, 2, `${L}: 3 cards cost a discard (3 -> 2)`);
    discard(run, run.blind.hand.slice(0, 1));
    assert.equal(run.blind.discardsLeft, 2, `${L}: then a 1-card discard is free (stays 2)`);
    discard(run, run.blind.hand.slice(0, 2));
    assert.equal(run.blind.discardsLeft, 1, `${L}: once per Blind only (2 -> 1)`);
  });
  jt('sleightofhand', 'the free discard is ready again next Blind; it never discards with 0 discards left', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run);
    discard(run, run.blind.hand.slice(0, 1));
    clearBlind(run);
    nextBlind(run);
    discard(run, run.blind.hand.slice(0, 1));
    assert.equal(run.blind.discardsLeft, 3, `${L}: the next Blind's first small discard is free again`);
    run.blind.discardsLeft = 0;
    bad(Engine.discard(run, run.blind.hand.slice(0, 1)), `${L}: discard with 0 left`, 'No discards left this Blind.');
  });

  // ---------------------------------------------------------------- Double Act
  jt('doubleact', '+4 Mult per pair among scored cards: Pair 1 (32 x 6 = 192), Two Pair 2 (48 x 10 = 480), Three 1 (62 x 7 = 434)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 32, 6, 192, 'one pair');
    expectTotals(id, score(run, cards('9S', '9D', '4H', '4C')), 48, 10, 480, 'two pairs: 22 + 26 Chips');
    expectTotals(id, score(run, cards('KS', 'KH', 'KD')), 62, 7, 434, 'three Kings: floor(3 / 2) = 1');
  });
  jt('doubleact', 'a High Card has no pair: no step (15 x 1 = 15)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, cards('KS'));
    expectTotals(id, res, 15, 1, 15, 'lone King');
    expectJokerSteps(id, res, j, []);
  });

  // ---------------------------------------------------------------- Tally Owl
  jt('tallyowl', '+1 Mult per 4 hands played before this one (9 played: +2, 32 x 4 = 128; 3 played: none)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    run.stats.handsPlayed = 9;
    expectTotals(id, score(run, KK()), 32, 4, 128, 'floor(9 / 4) = 2');
    run.stats.handsPlayed = 3;
    const res = score(run, KK());
    expectTotals(id, res, 32, 2, 64, 'floor(3 / 4) = 0');
    expectJokerSteps(id, res, j, [], 'no step at 0');
  });

  // ---------------------------------------------------------------- Magpie
  jt('magpie', 'starts at 0 (no step); gains +2 Chips per discarded card (3 cards, then KK: 38 x 2 = 76)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectJokerSteps(id, score(run, KK()), j, [], 'nothing discarded yet');
    discard(run, run.blind.hand.slice(0, 3));
    assert.equal(st(run, j), 6, `${L}: 3 cards discarded = +6`);
    expectTotals(id, score(run, KK()), 38, 2, 76, 'Pair of Kings + 6 Chips');
  });
  // Balance 2026-11-23 (Jokers, engine fix): the cap is +50 (was +100).
  jt('magpie', 'never above +50 (48, then 3 cards: 50)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    setSt(run, j, 48);
    discard(run, run.blind.hand.slice(0, 3));
    assert.equal(st(run, j), 50, `${L}: capped at 50, not 54`);
  });

  // ---------------------------------------------------------------- Tin Drum
  jt('tindrum', '+40 Chips every hand (KK: 72 x 2 = 144)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, KK());
    expectTotals(id, res, 72, 2, 144, 'Pair of Kings + 40 Chips');
    expectJokerSteps(id, res, j, [['chips', 40]]);
  });

  // ---------------------------------------------------------------- Ember Imp
  jt('emberimp', '+5 Mult every hand (KK: 32 x 7 = 224)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, KK());
    expectTotals(id, res, 32, 7, 224, 'Pair of Kings + 5 Mult');
    expectJokerSteps(id, res, j, [['mult', 5]]);
  });

  // ---------------------------------------------------------------- Solo Fiddler
  jt('solofiddler', '+8 Mult if the hand is a High Card (KS: 15 x 9 = 135); a Pair gets nothing (64)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('KS')), 15, 9, 135, 'High Card');
    expectTotals(id, score(run, KK()), 32, 2, 64, 'Pair');
  });

  // ---------------------------------------------------------------- Matching Socks
  jt('matchingsocks', 'a Pair: +25 Chips, then +4 Mult (KK: 57 x 6 = 342)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, KK());
    expectTotals(id, res, 57, 6, 342, 'Pair of Kings');
    expectJokerSteps(id, res, j, [['chips', 25], ['mult', 4]]);
  });
  jt('matchingsocks', 'a Two Pair (48 x 2 = 96) or a Full House (84 x 4 = 336) is not a Pair', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('9S', '9D', '4H', '4C')), 48, 2, 96, 'Two Pair');
    expectTotals(id, score(run, cards('KS', 'KH', 'KD', '5S', '5H')), 84, 4, 336, 'Full House');
  });

  // ---------------------------------------------------------------- Square Dance
  jt('squaredance', 'a Two Pair: +60 Chips (48 + 60 = 108 x 2 = 216); a Pair gets nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('9S', '9D', '4H', '4C')), 108, 2, 216, 'Two Pair');
    expectTotals(id, score(run, KK()), 32, 2, 64, 'Pair');
  });

  // ---------------------------------------------------------------- Hat Trick
  jt('hattrick', 'a Three of a Kind: +30 Chips, then +6 Mult (KS KH KD: 92 x 9 = 828)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, cards('KS', 'KH', 'KD'));
    expectTotals(id, res, 92, 9, 828, 'three Kings: 32 + 30 + 30 Chips, 3 + 6 Mult');
    expectJokerSteps(id, res, j, [['chips', 30], ['mult', 6]]);
  });
  jt('hattrick', 'a Full House (84 x 4 = 336) or a Four of a Kind (104 x 6 = 624) is not a Three of a Kind', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('KS', 'KH', 'KD', '5S', '5H')), 84, 4, 336, 'Full House');
    expectTotals(id, score(run, cards('KS', 'KH', 'KD', 'KC')), 104, 6, 624, 'Four of a Kind');
  });

  // ---------------------------------------------------------------- Tightrope
  jt('tightrope', 'a Straight: +70 Chips (5-9: 69 + 70 = 139 x 4 = 556); a Straight Flush gets nothing (145 x 8 = 1160)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('5S', '6H', '7D', '8C', '9S')), 139, 4, 556, 'Straight');
    expectTotals(id, score(run, cards('5S', '6S', '7S', '8S', '9S')), 145, 8, 1160, 'Straight Flush');
  });

  // ---------------------------------------------------------------- Peacock
  jt('peacock', 'a Flush: +9 Mult (2S 5S 9S KS 7S: 71 x 13 = 923); a Straight Flush gets nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('2S', '5S', '9S', 'KS', '7S')), 71, 13, 923, 'Flush: 38 + 33 Chips');
    expectTotals(id, score(run, cards('5S', '6S', '7S', '8S', '9S')), 145, 8, 1160, 'Straight Flush');
  });

  // ---------------------------------------------------------------- Clown Car
  jt('clowncar', 'a Full House: +20 Chips, then +10 Mult (84 + 20 = 104 x 14 = 1456); a Three of a Kind gets nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('KS', 'KH', 'KD', '5S', '5H')), 104, 14, 1456, 'Full House');
    expectTotals(id, score(run, cards('KS', 'KH', 'KD')), 62, 3, 186, 'Three of a Kind');
  });

  // ---------------------------------------------------------------- Quartet
  jt('quartet', 'a Four of a Kind: +20 Mult (104 x 26 = 2704); a Three of a Kind gets nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('KS', 'KH', 'KD', 'KC')), 104, 26, 2704, 'Four of a Kind');
    expectTotals(id, score(run, cards('KS', 'KH', 'KD')), 62, 3, 186, 'Three of a Kind');
  });

  // ---------------------------------------------------------------- Red Nose
  jt('rednose', 'each scored Heart or Diamond gives +2 Mult (KS KH: 32 x 4 = 128; KH KD: 32 x 6 = 192)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 32, 4, 128, 'one Heart');
    expectTotals(id, score(run, cards('KH', 'KD')), 32, 6, 192, 'a Heart and a Diamond');
  });
  jt('rednose', 'a Masked Spade counts as red (42 x 6 = 252)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { enhancement: 'scribbled' }), mk('KH')]), 42, 6, 252, 'Masked King +10 Chips, both red: +4 Mult');
  });

  // ---------------------------------------------------------------- Black Cat
  jt('blackcat', 'each scored Spade or Club gives +15 Chips (KS KH: 47 x 2 = 94; KS KC: 62 x 2 = 124; KH KD: 64)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 47, 2, 94, 'one Spade');
    expectTotals(id, score(run, cards('KS', 'KC')), 62, 2, 124, 'a Spade and a Club');
    expectTotals(id, score(run, cards('KH', 'KD')), 32, 2, 64, 'no black card');
  });

  // ---------------------------------------------------------------- Jewel Box
  jt('jewelbox', '3 or more scored Diamonds: one +$2 money step, once per hand', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const three = score(run, cards('5D', '5D', '5D'));
    expectTotals(id, three, 47, 3, 141, 'three 5s of Diamonds (money only)');
    deq(moneySteps(three), [2], `${L}: three scored Diamonds = one +$2 step`);
    deq(moneySteps(score(run, cards('2D', '5D', '9D', 'KD', '7D'))), [2], `${L}: five Diamonds still give one +$2 step`);
    deq(moneySteps(score(run, cards('9D', '9H', '4D', '4C'))), [], `${L}: two Diamonds give nothing`);
  });
  jt('jewelbox', 'the $2 is paid when the hand is played', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const uids = setHand(run, ['5D', '5D', '5D']);
    const before = run.money;
    play(run, uids);
    assert.equal(run.money, before + 2, `${L}: +$2 after playing three Diamonds`);
  });

  // ---------------------------------------------------------------- Lucky Sevens
  jt('luckysevens', 'each scored 7 gives +7 Mult (7S 7H: 26 x 16 = 416); Kings give nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('7S', '7H')), 26, 16, 416, 'two 7s: 12 + 14 Chips, 2 + 14 Mult');
    expectTotals(id, score(run, KK()), 32, 2, 64, 'no 7');
  });

  // ---------------------------------------------------------------- Ankle Biters
  jt('anklebiters', 'each scored 2, 3, 4 or 5 gives +12 Chips (5s: 46 x 2 = 92; 2s: 40 x 2 = 80); 6s give nothing (48)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('5S', '5H')), 46, 2, 92, 'Pair of 5s: 22 + 24');
    expectTotals(id, score(run, cards('2S', '2H')), 40, 2, 80, 'Pair of 2s: 16 + 24');
    expectTotals(id, score(run, cards('6S', '6H')), 24, 2, 48, 'Pair of 6s');
  });

  // ---------------------------------------------------------------- Jack-in-the-Box
  // Balance 2026-11-23 (Jokers, engine fix): +0.5 Mult per Jack pass (was +1).
  jt('jackinthebox', "this hand's Jacks count at once (JS JH: +1 Mult, 32 x 3 = 96); scoreCards leaves the state alone", ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectTotals(id, score(run, cards('JS', 'JH')), 32, 3, 96, 'two scored Jacks: +0.5 each, then the Joker gives +1 Mult');
    assert.equal(st(run, j), 0, `${L}: scoreCards is pure, state.mult stays 0 (ASSUMED A13)`);
    const res = score(run, KK());
    expectJokerSteps(id, res, j, [], 'no Jack, nothing stored: no step');
  });
  jt('jackinthebox', 'playHand stores the gain: after JS JH it gives +1 Mult (KK: 32 x 3 = 96)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    play(run, setHand(run, ['JS', 'JH']));
    assert.equal(st(run, j), 1, `${L}: two Jacks scored = +1 stored`);
    expectTotals(id, score(run, KK()), 32, 3, 96, 'Pair of Kings + 1 Mult');
  });
  jt('jackinthebox', 'a retriggered Jack adds 1 (Encore JS + JH: +1.5 Mult, 42 x 3.5 = 147)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('JS', { seal: 'encore' }), mk('JH')]), 42, 3.5, 147, 'three Jack passes: 12 + 30 Chips, 2 + 1.5 Mult');
  });

  // ---------------------------------------------------------------- Top Hat
  jt('tophat', 'the highest card held gives Chips equal to 3 x its rank (held Q: +36, 68 x 2 = 136; held A: +42, 74 x 2 = 148)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK(), cards('QD', '3C')), 68, 2, 136, 'held Queen: 3 x 12');
    expectTotals(id, score(run, KK(), cards('AS', '3C')), 74, 2, 148, 'held Ace: 3 x 14');
  });
  jt('tophat', 'only the highest held card, the leftmost on ties (held QD QC 3C: +36 once)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const held = cards('QD', 'QC', '3C');
    const res = score(run, KK(), held);
    expectTotals(id, res, 68, 2, 136, 'two Queens held: one +36');
    deq(res.steps.filter((s) => s.source === 'joker' && s.uid === j.uid).map((s) => s.cardUid), [held[0].uid], `${L}: the step points at the leftmost Queen`);
  });
  jt('tophat', 'an Encore Seal on that card doubles it (held Encore Q: +72, 104 x 2 = 208)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK(), [mk('QD', { seal: 'encore' }), mk('3C')]), 104, 2, 208, 'two passes of +36');
  });

  // ---------------------------------------------------------------- Ace Up the Sleeve
  jt('aceupthesleeve', 'an Ace held in hand: +10 Mult once, however many Aces (held AS AD: 32 x 12 = 384); held Q: nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK(), cards('AS', 'AD')), 32, 12, 384, 'two Aces held');
    expectTotals(id, score(run, KK(), cards('QD')), 32, 2, 64, 'no Ace held');
  });
  jt('aceupthesleeve', 'a played Ace does not count (AS AH played, 2C held: 34 x 2 = 68)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, cards('AS', 'AH'), cards('2C'));
    expectTotals(id, res, 34, 2, 68, 'Pair of Aces, no Ace held');
    expectJokerSteps(id, res, j, [], `${L}: no step`);
  });

  // ---------------------------------------------------------------- Portrait Gallery
  jt('portraitgallery', 'each face card held gives +2 Mult (held Q J 5: 32 x 6 = 192)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK(), cards('QD', 'JC', '5H')), 32, 6, 192, 'two faces held');
  });
  jt('portraitgallery', 'on every pass: a held Encore King gives it twice (32 x 6 = 192); number cards nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK(), [mk('KD', { seal: 'encore' })]), 32, 6, 192, 'Encore King held: 2 x +2');
    expectTotals(id, score(run, KK(), cards('5H', '9C')), 32, 2, 64, 'no face held');
  });

  // ---------------------------------------------------------------- Peek-a-Boo
  jt('peekaboo', '+20 Chips per pair held (two Kings and two 5s: +40, 72 x 2 = 144)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK(), cards('KD', 'KC', '5H', '5D')), 72, 2, 144, 'two pairs held');
  });
  jt('peekaboo', 'three Kings held are one pair (+20: 52 x 2 = 104); no pair held: nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK(), cards('KD', 'KC', 'KS')), 52, 2, 104, 'floor(3 / 2) = 1');
    expectTotals(id, score(run, KK(), cards('KD', '5H')), 32, 2, 64, 'no pair held');
  });

  // ---------------------------------------------------------------- Early Bird
  jt('earlybird', 'cash-out: +$1 per hand left, besides Hands to spare (beaten with the first hand: 3 left, $3)', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run);
    clearBlind(run);
    const spare = cashLines(run).find((l) => l.label === ASSUMED.handsToSpareLabel);
    assert.equal(spare && spare.amount, 3, `${L}: the usual Hands to spare line stays ($3)`);
    assert.equal((jokerLine(run, id) || {}).amount, 3, `${L}: 3 hands left = $3 (lines: ${JSON.stringify(cashLines(run))})`);
  });
  jt('earlybird', 'beaten with the last hand: 0 left, no line', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run);
    run.blind.handsLeft = 1;
    clearBlind(run);
    assert.equal(jokerLine(run, id), null, `${L}: a $0 line is left out`);
  });

  // ---------------------------------------------------------------- Prize Rosette
  jt('prizerosette', 'cash-out: +$3 after a Boss Blind; nothing after a Small Blind', ({ id, L }) => {
    const boss = mkRun();
    addJ(boss, id);
    begin(boss, { blindIndex: 2, boss: 'smudge' });
    clearBlind(boss);
    assert.equal((jokerLine(boss, id) || {}).amount, 3, `${L}: $3 after the Boss Blind (lines: ${JSON.stringify(cashLines(boss))})`);
    const small = mkRun();
    addJ(small, id);
    begin(small);
    clearBlind(small);
    assert.equal(jokerLine(small, id), null, `${L}: no line after a Small Blind`);
  });

  // ---------------------------------------------------------------- Doorman
  jt('doorman', 'earns $1 when a Blind starts ($4 -> $5)', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    const before = run.money;
    begin(run);
    assert.equal(run.money, before + 1, `${L}: +$1 at startBlind`);
  });
  jt('doorman', 'a skipped Blind never starts, so it pays nothing; the next one does', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    const before = run.money;
    skipWith(run, 'headstart');
    assert.equal(run.money, before, `${L}: skipping pays nothing`);
    begin(run);
    assert.equal(run.money, before + 1, `${L}: the Big Blind starts: +$1`);
  });

  // ---------------------------------------------------------------- Spinning Top
  jt('spinningtop', 'paid rerolls cost $1 less and still rise by $1 ($4, then $5)', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    toShop(run);
    run.money = 50;
    assert.equal(Engine.rerollCost(run), 4, `${L}: rerollCost shows $5 - $1 (ASSUMED A7)`);
    assert.equal(ok(Engine.reroll(run), 'reroll 1').cost, 4, `${L}: the first reroll costs $4`);
    assert.equal(Engine.rerollCost(run), 5, `${L}: then $6 - $1`);
    assert.equal(ok(Engine.reroll(run), 'reroll 2').cost, 5, `${L}: the second reroll costs $5`);
    assert.equal(run.money, 41, `${L}: $50 - $4 - $5`);
  });
  jt('spinningtop', 'a free reroll (Sale Tag) stays free and is spent first ($0, $4, $5)', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    skipWith(run, 'sale');
    toShop(run);
    run.money = 50;
    const costs = [ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost];
    deq(costs, [0, 4, 5], `${L}: the free reroll, then $4 and $5`);
    assert.equal(run.money, 41, `${L}: $50 - $9`);
  });

  // ---------------------------------------------------------------- Brass Abacus
  jt('brassabacus', 'interest is $1 per full $4, not $5 ($12 held: $3)', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run);
    clearBlind(run, { money: 12 });
    assert.equal(interestOf(run), 3, `${L}: floor(12 / 4) = $3 (lines: ${JSON.stringify(cashLines(run))})`);
  });
  jt('brassabacus', 'the cap does not change: $24 held gives $5, not $6; $6 with Savings Bond', ({ id, L }) => {
    const a = mkRun();
    addJ(a, id);
    begin(a);
    clearBlind(a, { money: 24 });
    assert.equal(interestOf(a), 5, `${L}: floor(24 / 4) = 6, capped at $5`);
    const b = mkRun();
    addJ(b, id);
    b.vouchers.push('savingsbond');
    begin(b);
    clearBlind(b, { money: 24 });
    assert.equal(interestOf(b), 6, `${L}: Savings Bond raises the cap to $8, so $6`);
  });

  // ---------------------------------------------------------------- Last Laugh
  jt('lastlaugh', 'sold during a Blind: +1 hand this Blind, and it pays its $2', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const money = run.money;
    assert.equal(run.blind.handsLeft, 4);
    const r = ok(Engine.sellJoker(run, j.uid), 'sellJoker');
    assert.equal(r.money, 2, `${L}: sells for half of $4`);
    assert.equal(run.money, money + 2, `${L}: +$2`);
    assert.equal(run.blind.handsLeft, 5, `${L}: 4 -> 5 hands this Blind`);
    assert.equal(run.hands, 4, `${L}: only this Blind`);
  });
  jt('lastlaugh', 'sold in the Shop: only its $2, no hand now or in the next Blind', ({ id, L }) => {
    const run = shopRun();
    const j = addJ(run, id);
    const money = run.money;
    ok(Engine.sellJoker(run, j.uid), 'sellJoker');
    assert.equal(run.money, money + 2, `${L}: +$2`);
    assert.equal(run.pending.extraHands, 0, `${L}: nothing waits for the next Blind`);
    nextBlind(run);
    assert.equal(run.blind.handsLeft, 4, `${L}: the next Blind has the usual 4 hands`);
  });

  // ---------------------------------------------------------------- Dartboard
  jt('dartboard', 'cash-out: +$3 when the first hand beats the Blind', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run);
    clearBlind(run);
    assert.equal((jokerLine(run, id) || {}).amount, 3, `${L}: $3 (lines: ${JSON.stringify(cashLines(run))})`);
  });
  jt('dartboard', 'nothing when a later hand beats it', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run);
    playLow(run);
    clearBlind(run);
    assert.equal(jokerLine(run, id), null, `${L}: beaten with the second hand: no line`);
  });

  // ---------------------------------------------------------------- Accordion
  jt('accordion', 'exactly 5 cards: +3 counted in this very hand (High Card K: 5 + 10 + 3 = 18); fewer: nothing', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectTotals(id, score(run, cards('KC', 'JS', '9H', '5D', '2C')), 18, 1, 18, '5 cards played');
    assert.equal(st(run, j), 0, `${L}: scoreCards is pure, state.chips stays 0 (ASSUMED A13)`);
    const four = score(run, cards('KC', 'JS', '9H', '5D'));
    expectTotals(id, four, 15, 1, 15, '4 cards played');
    expectJokerSteps(id, four, j, [], 'no gain, no step');
  });
  jt('accordion', 'playHand stores the +3 (then KK: 35 x 2 = 70)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    play(run, setHand(run, ['KC', 'JS', '9H', '5D', '2C']));
    assert.equal(st(run, j), 3, `${L}: +3 stored after a 5-card hand`);
    expectTotals(id, score(run, KK()), 35, 2, 70, 'Pair of Kings + 3 Chips');
  });

  // ---------------------------------------------------------------- Pack Rat
  jt('packrat', 'gains +1 Mult per Booster Pack opened: one bought in the Shop, one free from a Tag', ({ id, L }) => {
    const run = mkRun();
    const j = addJ(run, id);
    toShop(run);
    openPack(run, 'cardnormal');
    assert.equal(st(run, j), 1, `${L}: a bought pack = +1`);
    ok(Engine.packSkip(run), 'packSkip');
    ok(Engine.leaveShop(run), 'leaveShop');
    skipWith(run, 'grabbag');
    assert.equal(run.phase, 'pack', 'the Grab Bag Tag opens a free Jumbo Card Pack');
    assert.equal(st(run, j), 2, `${L}: a free Tag pack = +1 more`);
  });
  jt('packrat', 'gives its Mult (+2: 32 x 4 = 128); no step at 0', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectJokerSteps(id, score(run, KK()), j, [], 'nothing opened yet');
    setSt(run, j, 2);
    expectTotals(id, score(run, KK()), 32, 4, 128, 'two packs opened');
  });

  // ---------------------------------------------------------------- Pawnbroker
  jt('pawnbroker', 'gains +2 Mult each time you sell another Joker (sell Tin Drum, then KK: 32 x 4 = 128)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const t = addJ(run, 'tindrum');
    expectJokerSteps(id, score(run, KK()), j, [], 'nothing sold yet');
    ok(Engine.sellJoker(run, t.uid), 'sell Tin Drum');
    assert.equal(st(run, j), 2, `${L}: one Joker sold = +2`);
    expectTotals(id, score(run, KK()), 32, 4, 128, 'Pair of Kings + 2 Mult');
  });
  jt('pawnbroker', 'a destroyed Joker does not count (Ghost Writer destroys the leftmost Joker)', ({ id, L }) => {
    const run = mkRun();
    const t = addJ(run, 'tindrum');
    const j = addJ(run, id);
    use(run, give(run, 'spectral', 'ghostwriter'));
    assert.ok(!owns(run, t.uid), 'Ghost Writer destroyed the leftmost Joker (Tin Drum)');
    assert.equal(st(run, j), 0, `${L}: still 0 after a destroyed Joker`);
  });

  // ---------------------------------------------------------------- Tea Leaves
  jt('tealeaves', 'gains +6 Chips per Tarot card used from a slot; a Planet card adds nothing (then KK: 38 x 2 = 76)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    use(run, give(run, 'tarot', 'doover'));
    assert.equal(st(run, j), 6, `${L}: one Tarot card = +6`);
    use(run, give(run, 'planet', 'blip'));
    assert.equal(st(run, j), 6, `${L}: a Planet card does not count`);
    expectTotals(id, score(run, KK()), 38, 2, 76, 'Pair of Kings + 6 Chips');
  });
  jt('tealeaves', 'a Tarot card picked from a Tarot Pack and used at once counts too', ({ id, L }) => {
    const run = shopRun();
    const j = addJ(run, id);
    openPack(run, 'tarotnormal');
    run.pack.options[0] = { kind: 'tarot', id: 'paperroute' };
    pick(run, 0);
    assert.equal(st(run, j), 6, `${L}: a pack pick = +6`);
  });

  // ---------------------------------------------------------------- Stargazer
  jt('stargazer', '+1 Mult for every 2 Planet cards used (1 used: none; 2 used: 32 x 3 = 96)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    use(run, give(run, 'planet', 'blip'));
    assert.equal(st(run, j), 1, `${L}: one Planet card counted`);
    expectJokerSteps(id, score(run, KK()), j, [], 'floor(1 / 2) = 0: no step');
    use(run, give(run, 'planet', 'blip'));
    assert.equal(st(run, j), 2, `${L}: two Planet cards counted`);
    expectTotals(id, score(run, KK()), 32, 3, 96, 'floor(2 / 2) = 1 Mult (Pair still at level 1)');
  });
  jt('stargazer', 'a Tarot card does not count; a Planet Pack pick does', ({ id, L }) => {
    const run = shopRun();
    const j = addJ(run, id);
    use(run, give(run, 'tarot', 'paperroute'));
    assert.equal(st(run, j), 0, `${L}: a Tarot card does not count`);
    openPack(run, 'planetnormal');
    pick(run, 0);
    assert.equal(st(run, j), 1, `${L}: a Planet Pack pick counts`);
  });

  // ---------------------------------------------------------------- Dripping Candle
  jt('drippingcandle', '+15 Mult (KK: 32 x 17 = 544), then 1 less after each hand played', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectTotals(id, score(run, KK()), 32, 17, 544, 'Pair of Kings + 15 Mult');
    playLow(run);
    assert.equal(st(run, j), 14, `${L}: 15 -> 14 after one hand`);
  });
  jt('drippingcandle', 'melts at 0: playHand lists it in eaten and it leaves the rack', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    setSt(run, j, 1);
    const r = playLow(run);
    assert.ok((r.eaten || []).includes(j.uid), `${L}: 1 -> 0 melts it (playHand eaten: ${JSON.stringify(r.eaten)})`);
    assert.ok(!owns(run, j.uid), `${L}: it left the rack`);
  });

  // ---------------------------------------------------------------- Merry-Go-Round
  jt('merrygoround', 'Q-K-A-2-3 is a Straight (34 + 36 = 70 x 4 = 280); without the Joker it is a High Card', ({ id, L }) => {
    const plainRun = blindRun();
    assert.equal(score(plainRun, cards('QS', 'KH', 'AD', '2C', '3S')).handId, 'high', 'no wrap without the Joker');
    const run = blindRun();
    addJ(run, id);
    const res = score(run, cards('QS', 'KH', 'AD', '2C', '3S'));
    assert.equal(res.handId, 'straight', `${L}: Q-K-A-2-3 wraps around the Ace`);
    expectTotals(id, res, 70, 4, 280, 'all five score: 10 + 10 + 11 + 2 + 3');
  });
  jt('merrygoround', 'J-Q-K-A-2 wraps too (77 x 4 = 308); a wrapped Straight in one suit is a Straight Flush (146 x 8 = 1168)', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const jqka2 = score(run, cards('JS', 'QH', 'KD', 'AC', '2S'));
    assert.equal(jqka2.handId, 'straight', `${L}: J-Q-K-A-2`);
    expectTotals(id, jqka2, 77, 4, 308, 'J-Q-K-A-2');
    const sf = score(run, cards('QS', 'KS', 'AS', '2S', '3S'));
    assert.equal(sf.handId, 'straightflush', `${L}: Q-K-A-2-3 of Spades`);
    expectTotals(id, sf, 146, 8, 1168, 'wrapped Straight Flush: 110 + 36');
  });

  // ---------------------------------------------------------------- Court Ace
  jt('courtace', 'with Paper Crown, scored Aces count as face cards (AS AH: 34 + 24 = 58 x 2 = 116); alone it changes nothing (68)', ({ id }) => {
    const alone = blindRun();
    addJ(alone, id);
    expectTotals(id, score(alone, cards('AS', 'AH')), 34, 2, 68, 'Court Ace alone: Aces keep their 11 Chips, still a Pair');
    const run = blindRun();
    addJ(run, id);
    addJ(run, 'papercrown');
    expectTotals(id, score(run, cards('AS', 'AH')), 58, 2, 116, 'Paper Crown pays +12 for each Ace');
  });
  jt('courtace', 'with Portrait Gallery, a held Ace gives +2 Mult (AS AH played, AD held: 34 x 4 = 136)', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    addJ(run, 'portraitgallery');
    const res = score(run, cards('AS', 'AH'), cards('AD', '5C'));
    assert.equal(res.handId, 'pair', `${L}: hand detection does not change`);
    expectTotals(id, res, 34, 4, 136, 'the held Ace counts as a face card');
  });

  // ---------------------------------------------------------------- High Five
  jt('highfive', 'exactly 5 cards played: +5 Mult (High Card K: 15 x 6 = 90); 4 cards: nothing (15)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('KC', 'JS', '9H', '5D', '2C')), 15, 6, 90, '5 cards, only the King scores');
    expectTotals(id, score(run, cards('KC', 'JS', '9H', '5D')), 15, 1, 15, '4 cards');
  });

  // ---------------------------------------------------------------- Understudy
  jt('understudy', '+3 Mult per played card that does not score (KS KH 2C 3D: 2 unscored, 32 x 8 = 256)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, cards('KS', 'KH', '2C', '3D'));
    expectTotals(id, res, 32, 8, 256, '2 unscored kickers');
    expectJokerSteps(id, res, j, [['mult', 6]]);
    expectJokerSteps(id, score(run, KK()), j, [], 'every played card scores: nothing at 0');
  });
  jt('understudy', 'a Cameo card scores, so it does not count (34 x 5 = 170); a booed card is still a scoring card (22 x 8 = 176)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    const cameo = [mk('KS'), mk('KH'), mk('2C', { seal: 'cameo' }), mk('3D')];
    expectTotals(id, score(run, cameo), 34, 5, 170, 'Cameo 2 scores: 1 unscored card, +3 Mult');
    const heckler = bossRun('heckler');
    addJ(heckler, id);
    // The Heckler boos KS; it still counts as scoring, so the 2 kickers give +6.
    expectTotals(id, score(heckler, cards('KS', 'KH', '2C', '3D')), 22, 8, 176, 'The Heckler boos KS: 12 + 10 Chips, 2 + 6 Mult');
  });

  // ---------------------------------------------------------------- Jester Parade
  jt('jesterparade', '+12 Chips per other common Joker (Tin Drum and Ember Imp: +24; 96 x 7 = 672)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    addJ(run, 'tindrum');
    addJ(run, 'emberimp');
    const res = score(run, KK());
    expectTotals(id, res, 96, 7, 672, '32 + 24 + 40 Chips, 2 + 5 Mult');
    expectJokerSteps(id, res, j, [['chips', 24]]);
  });
  jt('jesterparade', 'an uncommon Joker does not count, nor does it itself: no step', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    addJ(run, 'congaline');
    const res = score(run, KK());
    expectTotals(id, res, 32, 2, 64, 'only an uncommon Joker beside it');
    expectJokerSteps(id, res, j, []);
  });

  // ---------------------------------------------------------------- Fancy Dress
  jt('fancydress', 'each scored card with an Enhancement gives +2 Mult (Waxed King: 67 x 4 = 268; plain: 64)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { enhancement: 'inked' }), mk('KH')]), 67, 4, 268, 'Waxed King +35 Chips, +2 Mult');
    expectTotals(id, score(run, KK()), 32, 2, 64, 'plain Kings');
  });
  jt('fancydress', 'on every pass (Encore Waxed King: 112 x 6 = 672); nothing during The Wash-Out (64)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { enhancement: 'inked', seal: 'encore' }), mk('KH')]), 112, 6, 672, 'two passes of 10 + 35 Chips and +2 Mult');
    const wash = bossRun('washout');
    addJ(wash, id);
    expectTotals(id, score(wash, [mk('KS', { enhancement: 'inked' }), mk('KH')]), 32, 2, 64, 'The Wash-Out: no Enhancement, no +2');
  });

  // ---------------------------------------------------------------- Signet Ring
  jt('signetring', '+10 Chips per card with a Seal in the full deck (none: no step; 3 sealed: 62 x 2 = 124)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectJokerSteps(id, score(run, KK()), j, [], 'no Seal in the deck');
    run.cards[0].seal = 'paid';
    run.cards[1].seal = 'encore';
    run.cards[2].seal = 'cameo';
    expectTotals(id, score(run, KK()), 62, 2, 124, '3 sealed deck cards: +30 Chips');
  });
  jt('signetring', 'it still counts during The Blackout (2 sealed: 52 x 2 = 104)', ({ id }) => {
    const run = bossRun('censor');
    addJ(run, id);
    run.cards[0].seal = 'paid';
    run.cards[1].seal = 'airmail';
    expectTotals(id, score(run, KK()), 52, 2, 104, 'The Blackout does not stop the count');
  });

  // ---------------------------------------------------------------- Bravo Bouquet
  jt('bravobouquet', 'a scored Encore card gives +20 Chips on both passes (12 + 30 + 30 + 10 = 82 x 2 = 164)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { seal: 'encore' }), mk('KH')]), 82, 2, 164, 'Encore King: 2 x (10 + 20)');
  });
  jt('bravobouquet', 'other Seals give nothing; nothing during The Blackout', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { seal: 'paid' }), mk('KH')]), 32, 2, 64, 'a Paid Seal');
    const dark = bossRun('censor');
    addJ(dark, id);
    expectTotals(id, score(dark, [mk('KS', { seal: 'encore' }), mk('KH')]), 32, 2, 64, 'The Blackout: no retrigger and no +20');
  });

  // ---------------------------------------------------------------- Grand Finale
  jt('grandfinale', "the Blind's last hand: +60 Chips (handsLeft 1: 92 x 2 = 184); earlier hands nothing", ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    run.blind.handsLeft = 1;
    expectTotals(id, score(run, KK()), 92, 2, 184, 'the final hand');
    run.blind.handsLeft = 4;
    expectTotals(id, score(run, KK()), 32, 2, 64, '4 hands left');
  });

  // ---------------------------------------------------------------- Hot Cocoa
  jt('hotcocoa', 'beating a Boss Blind gains a Second Wind Tag: +1 hand in the next Blind (5)', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run, { blindIndex: 2, boss: 'smudge' });
    clearBlind(run);
    assert.equal(run.pending.extraHands, 1, `${L}: pending.extraHands + 1 (ASSUMED A10)`);
    nextBlind(run);
    assert.equal(run.blind.handsLeft, 5, `${L}: the next Blind starts with 4 + 1 hands`);
  });
  jt('hotcocoa', 'beating a Small Blind gives nothing', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run);
    clearBlind(run);
    assert.equal(run.pending.extraHands, 0, `${L}: no Tag after a Small Blind`);
  });

  // ---------------------------------------------------------------- Night Watchman
  jt('nightwatchman', 'during a Boss Blind: +12 Mult (32 x 14 = 448); a Small Blind: nothing', ({ id }) => {
    const boss = bossRun('smudge');
    addJ(boss, id);
    expectTotals(id, score(boss, KK()), 32, 14, 448, 'Boss Blind');
    const small = blindRun();
    addJ(small, id);
    expectTotals(id, score(small, KK()), 32, 2, 64, 'Small Blind');
  });

  // ---------------------------------------------------------------- Seesaw
  jt('seesaw', "the Blind's 2nd and 4th hands: +10 Mult (32 x 12 = 384); 1st and 3rd: nothing", ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    for (const [played, total] of [[0, 64], [1, 384], [2, 64], [3, 384]]) {
      run.blind.handsPlayed = played;
      const res = score(run, KK());
      assert.equal(res.total, total, `${label(id)}: with ${played} hands played before, expected ${total}, got ${res.total}`);
    }
  });

  // ---------------------------------------------------------------- Penniless Poet
  jt('pennilesspoet', '$5 or less: +9 Mult (32 x 11 = 352); $6: nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    for (const [money, total] of [[0, 352], [5, 352], [6, 64]]) {
      run.money = money;
      const res = score(run, KK());
      assert.equal(res.total, total, `${label(id)}: with $${money}, expected ${total}, got ${res.total}`);
    }
  });

  // ---------------------------------------------------------------- Orrery
  jt('orrery', '+2 Mult per level above 1 of the played hand (Pair lv.4: 60 + 20 = 80, 5 + 6 = 11; 880); level 1: no step', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectJokerSteps(id, score(run, KK()), j, [], 'Pair at level 1');
    run.levels.pair = 4;
    expectTotals(id, score(run, KK()), 80, 11, 880, 'Pair at level 4: base 12 + 48 Chips, 2 + 3 Mult');
  });

  // ---------------------------------------------------------------- Patchwork Doll
  jt('patchworkdoll', 'no step at 0; gains +4 Chips per card added to the deck: a Carbon Copy (then KK: 36 x 2 = 72)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectJokerSteps(id, score(run, KK()), j, [], 'nothing added yet');
    use(run, give(run, 'tarot', 'carboncopy'), [run.blind.hand[0]]);
    assert.equal(st(run, j), 4, `${L}: one card added = +4`);
    expectTotals(id, score(run, KK()), 36, 2, 72, 'Pair of Kings + 4 Chips');
  });
  jt('patchworkdoll', 'a Card Pack pick adds a card too: +4', ({ id, L }) => {
    const run = shopRun();
    const j = addJ(run, id);
    openPack(run, 'cardnormal');
    pick(run, 0);
    assert.equal(st(run, j), 4, `${L}: a Card Pack pick = +4`);
  });
});

// ================================================================== Uncommon Jokers
describe('Uncommon Jokers (40)', () => {
  // ---------------------------------------------------------------- Sable Knave
  jt('sableknave', 'each scored Spade gives x1.1 Mult (KS KH: 32 x 2.2 = 70)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, KK());
    expectTotals(id, res, 32, 2.2, 70, 'one Spade');
    expectJokerSteps(id, res, j, [['xmult', 1.1]]);
  });
  jt('sableknave', 'a Spade Flush multiplies five times (71 x 6.44204 = 457); a Masked Heart counts as a Spade (42 x 2.42 = 101)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('2S', '5S', '9S', 'KS', '7S')), 71, 6.44204, 457, '4 x 1.1^5, rounded to 6 decimals each step');
    expectTotals(id, score(run, [mk('KS'), mk('KH', { enhancement: 'scribbled' })]), 42, 2.42, 101, 'Masked Heart +10 Chips and x1.1');
  });

  // ---------------------------------------------------------------- Red-Handed
  jt('redhanded', 'each Heart or Diamond held gives +2 Mult; a held Masked card counts (QH QD QS* QC: +6, 32 x 8 = 256)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK(), [mk('QH'), mk('QD'), mk('QS', { enhancement: 'scribbled' }), mk('QC')]), 32, 8, 256, 'three red held cards');
  });
  jt('redhanded', 'a held Encore Heart gives it twice (32 x 6 = 192); The Wash-Out stops a Masked card (64)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK(), [mk('QH', { seal: 'encore' })]), 32, 6, 192, 'Encore Heart held: 2 x +2');
    const wash = bossRun('washout');
    addJ(wash, id);
    expectTotals(id, score(wash, KK(), [mk('QS', { enhancement: 'scribbled' })]), 32, 2, 64, 'a held Masked Spade during The Wash-Out');
  });

  // ---------------------------------------------------------------- Conga Line
  jt('congaline', 'a Straight or Straight Flush: x1.5 Mult (69 x 6 = 414; 145 x 12 = 1740); a Pair: nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('5S', '6H', '7D', '8C', '9S')), 69, 6, 414, 'Straight');
    expectTotals(id, score(run, cards('5S', '6S', '7S', '8S', '9S')), 145, 12, 1740, 'Straight Flush');
    expectTotals(id, score(run, KK()), 32, 2, 64, 'Pair');
  });

  // ---------------------------------------------------------------- Moneybags
  jt('moneybags', '+1 Mult per $4 held ($13: +3, 32 x 5 = 160); $3: no step', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    run.money = 13;
    expectTotals(id, score(run, KK()), 32, 5, 160, 'floor(13 / 4) = 3');
    run.money = 3;
    expectJokerSteps(id, score(run, KK()), j, [], 'floor(3 / 4) = 0');
  });

  // ---------------------------------------------------------------- Opening Act
  jt('openingact', 'the first scored card gives +20 Chips, then +2 Mult (KK: 52 x 4 = 208); on every pass (Encore first card: 82 x 6 = 492)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, KK());
    expectTotals(id, res, 52, 4, 208, 'first King only');
    expectJokerSteps(id, res, j, [['chips', 20], ['mult', 2]]);
    expectTotals(id, score(run, [mk('KS', { seal: 'encore' }), mk('KH')]), 82, 6, 492, 'Encore first King: 2 x (10 + 20 Chips, +2 Mult)');
  });
  jt('openingact', 'The Heckler boos the first card: nothing, and the next card does not take its place (22 x 2 = 44)', ({ id }) => {
    const run = bossRun('heckler');
    const j = addJ(run, id);
    const res = score(run, KK());
    expectTotals(id, res, 22, 2, 44, 'KS booed, KH scores 10');
    expectJokerSteps(id, res, j, []);
  });

  // ---------------------------------------------------------------- Final Bow
  jt('finalbow', 'the last scored card gives x1.5 Mult (KK: 32 x 3 = 96; KKK: 62 x 4.5 = 279)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const [ks, kh] = KK();
    const res = score(run, [ks, kh]);
    expectTotals(id, res, 32, 3, 96, 'Pair of Kings');
    deq(res.steps.filter((s) => s.source === 'joker' && s.uid === j.uid).map((s) => s.cardUid), [kh.uid], `${L}: the step points at the last scored card`);
    expectTotals(id, score(run, cards('KS', 'KH', 'KD')), 62, 4.5, 279, 'Three of a Kind');
  });

  // ---------------------------------------------------------------- Chimney Sweep
  // Balance 2026-11-23 (Jokers, engine fix): +1 Mult for every 2 cards discarded (was every card).
  jt('chimneysweep', '+1 Mult for every 2 cards discarded this Blind (3 discarded: +1, 32 x 3 = 96; 5 discarded: +2, 32 x 4 = 128)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    discard(run, run.blind.hand.slice(0, 3));
    expectTotals(id, score(run, KK()), 32, 3, 96, '3 cards discarded');
    discard(run, run.blind.hand.slice(0, 2));
    expectTotals(id, score(run, KK()), 32, 4, 128, '5 cards discarded');
  });
  jt('chimneysweep', 'starts again at 0 in the next Blind', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    discard(run, run.blind.hand.slice(0, 2));
    clearBlind(run);
    nextBlind(run);
    const res = score(run, KK());
    expectTotals(id, res, 32, 2, 64, 'nothing discarded in the new Blind');
    expectJokerSteps(id, res, j, []);
  });

  // ---------------------------------------------------------------- Gold Tooth
  jt('goldtooth', 'scored Aces give +$1 money steps (AS AH: [1, 1], 34 x 2 = 68)', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const res = score(run, cards('AS', 'AH'));
    deq(moneySteps(res), [1, 1], `${L}: one +$1 step per scored Ace`);
    expectTotals(id, res, 34, 2, 68, 'money only');
    deq(moneySteps(score(run, KK())), [], `${L}: Kings give nothing`);
  });
  jt('goldtooth', 'paid when the hand is played (+$2)', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const uids = setHand(run, ['AS', 'AH']);
    const before = run.money;
    play(run, uids);
    assert.equal(run.money, before + 2, `${L}: +$2`);
  });

  // ---------------------------------------------------------------- Old Stager
  jt('oldstager', 'each scored card gives +2 Chips per Ante (Ante 1: 36 x 2 = 72; Ante 3: 44 x 2 = 88)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 36, 2, 72, 'Ante 1: +2 per King');
    run.ante = 3;
    expectTotals(id, score(run, KK()), 44, 2, 88, 'Ante 3: +6 per King');
  });

  // ---------------------------------------------------------------- The Paperclip
  jt('paperclip', 'each card held gives +5 Chips (3 held: 47 x 2 = 94)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK(), cards('2C', '3C', '4D')), 47, 2, 94, '3 cards held');
  });
  jt('paperclip', 'a held Encore card gives it twice (42 x 2 = 84)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK(), [mk('QD', { seal: 'encore' })]), 42, 2, 84, 'Encore Queen held: 2 x +5');
  });

  // ---------------------------------------------------------------- Lamplighter
  jt('lamplighter', 'after the hand, scored Hearts with no Enhancement become Kindled; Enhanced, unscored, held and other suits stay', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const [plainHeart, inkedHeart, ks, kicker, heldHeart] = setHand(run, ['KH', { code: 'KH', enhancement: 'inked' }, 'KS', '2H', 'JH']);
    // Three Kings score (32 + 10 + 45 + 10 = 97 x 3 = 291, the Blind goes on); 2H is unscored; JH stays in hand.
    play(run, [plainHeart, inkedHeart, ks, kicker]);
    deq(
      [plainHeart, inkedHeart, ks, kicker, heldHeart].map((u) => cardRef(run, u).enhancement),
      ['punchy', 'inked', null, null, null],
      `${L}: only the plain scored Heart becomes Kindled (punchy)`,
    );
  });
  jt('lamplighter', 'it still converts during The Wash-Out', ({ id, L }) => {
    const run = bossRun('washout');
    addJ(run, id);
    const [h] = setHand(run, ['9H']);
    play(run, [h]);
    assert.equal(cardRef(run, h).enhancement, 'punchy', `${L}: the scored 9 of Hearts became Kindled`);
  });

  // ---------------------------------------------------------------- Fan Dancer
  jt('fandancer', 'four cards of one suit are a Flush (2S 5S 9S KS: 38 + 26 = 64 x 4 = 256); not without the Joker', ({ id, L }) => {
    assert.equal(score(blindRun(), cards('2S', '5S', '9S', 'KS')).handId, 'high', 'without the Joker 4 Spades are a High Card');
    const run = blindRun();
    addJ(run, id);
    const res = score(run, cards('2S', '5S', '9S', 'KS'));
    assert.equal(res.handId, 'flush', `${L}: a 4-card Flush`);
    expectTotals(id, res, 64, 4, 256, '4 Spades score');
  });
  jt('fandancer', 'an off-suit fifth card does not score (64 x 4 = 256); a Straight with 4 of a suit is a Straight Flush (145 x 8 = 1160)', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const five = cards('2S', '5S', '9S', 'KS', '3H');
    const res = score(run, five);
    assert.equal(res.handId, 'flush', `${L}: 4 Spades and a Heart`);
    deq(res.scoringUids, five.slice(0, 4).map((c) => c.uid), `${L}: the Heart is unscored`);
    expectTotals(id, res, 64, 4, 256, 'only the Spades score');
    const sf = score(run, cards('5S', '6S', '7S', '8S', '9H'));
    assert.equal(sf.handId, 'straightflush', `${L}: 5-9 with 4 Spades`);
    expectTotals(id, sf, 145, 8, 1160, 'all 5 score');
  });

  // ---------------------------------------------------------------- Maypole
  jt('maypole', 'a scored card with any Seal retriggers (Paid King: 42 x 2 = 84); an Encore card scores 3 times (52 x 2 = 104)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const paidRes = score(run, [mk('KS', { seal: 'paid' }), mk('KH')]);
    expectTotals(id, paidRes, 42, 2, 84, 'Paid King twice');
    deq(againNotes(paidRes).map((s) => s.jokerUid), [j.uid], `${L}: the Encore! note names the Joker`);
    expectTotals(id, score(run, [mk('KS', { seal: 'encore' }), mk('KH')]), 52, 2, 104, 'Encore King: 1 + 1 + 1 passes');
  });
  jt('maypole', 'plain cards do not retrigger; nothing during The Blackout', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 32, 2, 64, 'no Seal');
    const dark = bossRun('censor');
    addJ(dark, id);
    expectTotals(id, score(dark, [mk('KS', { seal: 'paid' }), mk('KH')]), 32, 2, 64, 'The Blackout');
  });

  // ---------------------------------------------------------------- Call and Response
  jt('callandresponse', 'a scored card retriggers when its rank is held (held KD: 52 x 2 = 104); held Q: nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK(), cards('KD')), 52, 2, 104, 'both Kings retrigger once');
    expectTotals(id, score(run, KK(), cards('KD', 'KC')), 52, 2, 104, 'once per card, however many matches');
    expectTotals(id, score(run, KK(), cards('QD')), 32, 2, 64, 'no King held');
  });

  // ---------------------------------------------------------------- Bookends
  jt('bookends', 'the first and last scored cards retrigger (KK: 52 x 2 = 104; KKK: 82 x 3 = 246)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, KK());
    expectTotals(id, res, 52, 2, 104, 'two Kings, both ends');
    assert.equal(againNotes(res).filter((s) => s.jokerUid === j.uid).length, 2, `${L}: two Encore! notes`);
    expectTotals(id, score(run, cards('KS', 'KH', 'KD')), 82, 3, 246, 'the middle King scores once');
  });
  jt('bookends', 'a lone scoring card gets 1 extra pass, not 2 (KS: 25 x 1 = 25)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('KS')), 25, 1, 25, 'High Card King twice');
  });

  // ---------------------------------------------------------------- One-Man Band
  jt('onemanband', 'exactly 1 card played retriggers 3 times (KS: 5 + 40 = 45); 2 cards: nothing (64)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, cards('KS'));
    expectTotals(id, res, 45, 1, 45, 'the King scores 4 times');
    assert.equal(againNotes(res).filter((s) => s.jokerUid === j.uid).length, 3, `${L}: three Encore! notes`);
    expectTotals(id, score(run, KK()), 32, 2, 64, 'two cards played');
  });

  // ---------------------------------------------------------------- Colour Guard
  jt('colourguard', 'all red or all black scored cards: x1.5 (KH KD: 96; KS KC: 96)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('KH', 'KD')), 32, 3, 96, 'all red');
    expectTotals(id, score(run, cards('KS', 'KC')), 32, 3, 96, 'all black');
  });
  jt('colourguard', 'mixed: nothing (64); a lone card qualifies (22); a Masked card fits either colour (42 x 3 = 126)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 32, 2, 64, 'a Spade and a Heart');
    expectTotals(id, score(run, cards('KS')), 15, 1.5, 22, 'one scored card');
    expectTotals(id, score(run, [mk('KS', { enhancement: 'scribbled' }), mk('KH')]), 42, 3, 126, 'Masked King with a Heart');
  });

  // ---------------------------------------------------------------- Three's a Crowd
  jt('threesacrowd', 'exactly 3 cards played: x1.75 Mult (KS KH 2C: 32 x 3.5 = 112); 2 cards: nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('KS', 'KH', '2C')), 32, 3.5, 112, '3 cards, one unscored');
    expectTotals(id, score(run, KK()), 32, 2, 64, '2 cards');
  });

  // ---------------------------------------------------------------- Two's Company
  jt('twoscompany', 'a Two Pair: x2 Mult (48 x 4 = 192); a Pair: nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('9S', '9D', '4H', '4C')), 48, 4, 192, 'Two Pair');
    expectTotals(id, score(run, KK()), 32, 2, 64, 'Pair');
  });

  // ---------------------------------------------------------------- Pocket Lint
  jt('pocketlint', 'no card in any consumable slot: x1.5 (96); one card held: nothing (64)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 32, 3, 96, 'empty slots');
    give(run, 'planet', 'blip');
    expectTotals(id, score(run, KK()), 32, 2, 64, 'a Planet card in a slot');
  });

  // ---------------------------------------------------------------- Signature Move
  jt('signaturemove', 'nothing played yet: the Pair counts as most-played (KK: 96); a High Card does not (15)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 32, 3, 96, 'Pair, as The Spoilsport picks it');
    expectTotals(id, score(run, cards('KS')), 15, 1, 15, 'High Card');
  });
  jt('signaturemove', 'the most-played hand gets x1.5 (High Card played 3 times: 22); ties go to the stronger hand (Flush: 71 x 6 = 426)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    run.plays.high = 3;
    expectTotals(id, score(run, cards('KS')), 15, 1.5, 22, 'High Card most-played');
    expectTotals(id, score(run, KK()), 32, 2, 64, 'Pair is not');
    run.plays.high = 2;
    run.plays.flush = 2;
    expectTotals(id, score(run, cards('2S', '5S', '9S', 'KS', '7S')), 71, 6, 426, 'High Card and Flush tied: the Flush');
    expectTotals(id, score(run, cards('KS')), 15, 1, 15, 'the High Card lost the tie');
  });

  // ---------------------------------------------------------------- Heads or Tails
  jt('headsortails', 'x2 Mult on Heads (KK: 128); nothing on Tails (64); scoreCards does not flip the coin', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    assert.equal(st(run, j), ASSUMED.coin.heads, `${L}: starts on Heads`);
    expectTotals(id, score(run, KK()), 32, 4, 128, 'Heads');
    assert.equal(st(run, j), ASSUMED.coin.heads, `${L}: scoring did not flip it`);
    setSt(run, j, ASSUMED.coin.tails);
    expectTotals(id, score(run, KK()), 32, 2, 64, 'Tails');
  });
  jt('headsortails', 'the coin flips after every hand played, from the seeded RNG (both sides turn up; same seed, same sides)', ({ id, L }) => {
    const sidesFor = (seed) => {
      const run = blindRun({ seed });
      const j = addJ(run, id);
      const sides = [];
      for (let i = 0; i < 3; i++) {
        playLow(run);
        sides.push(st(run, j));
      }
      return sides;
    };
    const all = [];
    for (let i = 0; i < 6; i++) {
      const sides = sidesFor(seedN(7000 + i));
      for (const s of sides) assert.ok([ASSUMED.coin.heads, ASSUMED.coin.tails].includes(s), `${L}: side ${JSON.stringify(s)}`);
      all.push(...sides);
      deq(sidesFor(seedN(7000 + i)), sides, `${L}: the same seed flips the same way`);
    }
    assert.ok(all.includes(ASSUMED.coin.tails), `${L}: 18 flips never came up Tails: ${all.join(' ')}`);
  });

  // ---------------------------------------------------------------- Velvet Rope
  jt('velvetrope', 'x1.25 per Joker with an Edition, itself included (Sheen Velvet Rope: +40 first, 72 x 2.5 = 180)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id, 'gloss');
    const res = score(run, KK());
    expectTotals(id, res, 72, 2.5, 180, 'Sheen +40 Chips, then x1.25');
    deq(editionSteps(res, j), [['chips', 40, 'gloss']], `${L}: its Sheen step comes first`);
    expectJokerSteps(id, res, j, [['xmult', 1.25]]);
  });
  jt('velvetrope', 'Dither and Phantom Jokers count (x1.5625: 72 x 16.125 = 1161); no Edition anywhere: no step', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    addJ(run, 'tindrum', 'benday');
    addJ(run, 'emberimp', 'inverted');
    // 2 x 1.25^2 = 3.125; Tin Drum: Dither +8 -> 11.125, +40 Chips; Ember Imp (Phantom, no step) +5 -> 16.125
    expectTotals(id, score(run, KK()), 72, 16.125, 1161, 'two Jokers with an Edition');
    const bare = blindRun();
    const j = addJ(bare, id);
    expectJokerSteps(id, score(bare, KK()), j, [], 'no Edition: x1.25^0, no step');
  });

  // ---------------------------------------------------------------- Shoeshine
  jt('shoeshine', 'beating a Boss Blind: 2 random deck cards with no Edition gain Sheen, Dither or Glitch', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run, { blindIndex: 2, boss: 'smudge' });
    assert.equal(run.cards.filter((c) => c.edition).length, 0);
    clearBlind(run);
    const shiny = run.cards.filter((c) => c.edition);
    assert.equal(shiny.length, 2, `${L}: 2 cards gained an Edition`);
    for (const c of shiny) assert.ok(['gloss', 'benday', 'fourcolor'].includes(c.edition), `${L}: ${c.edition} is Sheen, Dither or Glitch`);
  });
  jt('shoeshine', 'never Phantom (12 seeds), and nothing after a Small Blind', ({ id, L }) => {
    for (let i = 0; i < 12; i++) {
      const run = mkRun({ seed: seedN(7100 + i) });
      addJ(run, id);
      begin(run, { blindIndex: 2, boss: 'smudge' });
      clearBlind(run);
      const eds = run.cards.filter((c) => c.edition).map((c) => c.edition);
      assert.equal(eds.length, 2, `${L}: seed ${i}: 2 cards`);
      assert.ok(!eds.includes('inverted'), `${L}: never Phantom`);
    }
    const small = mkRun();
    addJ(small, id);
    begin(small);
    clearBlind(small);
    assert.equal(small.cards.filter((c) => c.edition).length, 0, `${L}: nothing after a Small Blind`);
  });

  // ---------------------------------------------------------------- Thimble
  jt('thimble', 'when a Blind starts, one random card in hand gains a random Seal (8 seeds)', ({ id, L }) => {
    for (let i = 0; i < 8; i++) {
      const run = mkRun({ seed: seedN(7200 + i) });
      addJ(run, id);
      begin(run);
      const sealed = run.cards.filter((c) => c.seal);
      assert.equal(sealed.length, 1, `${L}: exactly one card gained a Seal`);
      assert.ok(run.blind.hand.includes(sealed[0].uid), `${L}: it is a card in hand`);
      assert.ok(SEAL_IDS.includes(sealed[0].seal), `${L}: ${sealed[0].seal} is a Seal`);
    }
  });
  jt('thimble', 'the Seal stays for good (2 sealed after 2 Blinds); nothing when every card in hand has one', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run);
    clearBlind(run);
    nextBlind(run);
    assert.equal(run.cards.filter((c) => c.seal).length, 2, `${L}: the first Seal stayed and a second card got one`);
    const full = mkRun();
    addJ(full, id);
    for (const c of full.cards) c.seal = 'paid';
    begin(full);
    assert.ok(full.cards.every((c) => c.seal === 'paid'), `${L}: every card kept its Paid Seal`);
  });

  // ---------------------------------------------------------------- Moonstruck
  // Balance 2026-11-23 (Jokers, engine fix): only when a Boss Blind starts (was every Blind).
  jt('moonstruck', 'when a Boss Blind starts: the Planet card of the most-played hand (nothing played: Pair); a Small Blind gives nothing', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run, { blindIndex: 2, boss: 'smudge' });
    deq(run.consumables.map((c) => [c.kind, c.id]), [['planet', PLANET_OF.pair]], `${L}: one Planet card for the Pair (ASSUMED A12)`);
    const small = mkRun();
    addJ(small, id);
    begin(small);
    deq(small.consumables, [], `${L}: nothing at a Small Blind`);
  });
  jt('moonstruck', 'ties go to the stronger hand (Flush and High Card tied: the Flush); with full slots, nothing', ({ id, L }) => {
    const a = mkRun();
    addJ(a, id);
    Object.assign(a.plays, { flush: 2, high: 2 });
    begin(a, { blindIndex: 2, boss: 'smudge' });
    deq(a.consumables.map((c) => c.id), [PLANET_OF.flush], `${L}: the Flush's Planet card`);
    const b = mkRun();
    addJ(b, id);
    give(b, 'tarot', 'inkpot');
    give(b, 'tarot', 'crayon');
    begin(b, { blindIndex: 2, boss: 'smudge' });
    deq(b.consumables.map((c) => c.id), ['inkpot', 'crayon'], `${L}: no free slot, nothing created`);
  });

  // ---------------------------------------------------------------- Palm Reader
  jt('palmreader', 'discarding exactly 2 cards of the same rank creates a random Tarot card', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    discard(run, setHand(run, ['KS', 'KH']));
    assert.equal(run.consumables.length, 1, `${L}: one card created`);
    assert.equal(run.consumables[0].kind, 'tarot', `${L}: a Tarot card`);
    assert.ok(TAROT_IDS.includes(run.consumables[0].id), `${L}: ${run.consumables[0].id} is a Tarot card`);
  });
  jt('palmreader', 'nothing for 2 different ranks, for 3 cards, or with full slots', ({ id, L }) => {
    const a = blindRun();
    addJ(a, id);
    discard(a, setHand(a, ['KS', 'QH']));
    assert.equal(a.consumables.length, 0, `${L}: different ranks`);
    const b = blindRun();
    addJ(b, id);
    discard(b, setHand(b, ['KS', 'KH', 'QD']));
    assert.equal(b.consumables.length, 0, `${L}: 3 cards`);
    const c = blindRun();
    addJ(c, id);
    give(c, 'planet', 'blip');
    give(c, 'planet', 'boing');
    discard(c, setHand(c, ['KS', 'KH']));
    deq(c.consumables.map((x) => x.id), ['blip', 'boing'], `${L}: full slots`);
  });

  // ---------------------------------------------------------------- Crystal Gazer
  jt('crystalgazer', 'each Tarot card used pays $2 at once; a Planet card does not', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const m0 = run.money;
    use(run, give(run, 'tarot', 'doover'));
    assert.equal(run.money, m0 + 2, `${L}: +$2 for a Tarot card`);
    use(run, give(run, 'planet', 'blip'));
    assert.equal(run.money, m0 + 2, `${L}: nothing for a Planet card`);
  });
  jt('crystalgazer', "a Tarot card picked from a Tarot Pack pays $2 too (Busker's Hat $4 + $2)", ({ id, L }) => {
    const run = shopRun();
    addJ(run, id);
    openPack(run, 'tarotnormal');
    run.pack.options[0] = { kind: 'tarot', id: 'paperroute' };
    const m0 = run.money;
    pick(run, 0);
    assert.equal(run.money, m0 + 4 + 2, `${L}: $3 + $1 (Ante 1) from the card, +$2`);
  });

  // ---------------------------------------------------------------- Paymaster
  jt('paymaster', 'cash-out: +$1 per other Joker (Tin Drum and Ember Imp: $2)', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    addJ(run, 'tindrum');
    addJ(run, 'emberimp');
    begin(run);
    clearBlind(run);
    assert.equal((jokerLine(run, id) || {}).amount, 2, `${L}: $2 (lines: ${JSON.stringify(cashLines(run))})`);
  });
  jt('paymaster', 'alone: no line; a Phantom Joker counts ($1)', ({ id, L }) => {
    const a = mkRun();
    addJ(a, id);
    begin(a);
    clearBlind(a);
    assert.equal(jokerLine(a, id), null, `${L}: no other Joker, no line`);
    const b = mkRun();
    addJ(b, id);
    addJ(b, 'tindrum', 'inverted');
    begin(b);
    clearBlind(b);
    assert.equal((jokerLine(b, id) || {}).amount, 1, `${L}: a Phantom Joker counts`);
  });

  // ---------------------------------------------------------------- Face Value
  jt('facevalue', '+$1 per face card discarded, at once (K Q 5: +$2; 5 9: +$0)', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const m0 = run.money;
    discard(run, setHand(run, ['KS', 'QH', '5D']));
    assert.equal(run.money, m0 + 2, `${L}: two face cards discarded`);
    discard(run, setHand(run, ['5S', '9H']));
    assert.equal(run.money, m0 + 2, `${L}: no face card, nothing`);
  });

  // ---------------------------------------------------------------- Carpetbag
  jt('carpetbag', 'each discard gives +1 hand size for the rest of the Blind, at most +3', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    run.blind.discardsLeft = 5;
    const sizes = [];
    for (let i = 0; i < 4; i++) {
      discard(run, run.blind.hand.slice(0, 1));
      sizes.push([Engine.handSizeNow(run), run.blind.hand.length]);
    }
    deq(sizes, [[9, 9], [10, 10], [11, 11], [11, 11]], `${L}: hand size 9, 10, 11, then capped at 11, drawn up each time`);
    assert.equal(run.blind.handSizeDelta, 3, `${L}: blind.handSizeDelta +3`);
  });
  jt('carpetbag', 'it ends with the Blind: the next Blind deals 8 cards', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    discard(run, run.blind.hand.slice(0, 1));
    clearBlind(run);
    nextBlind(run);
    assert.equal(Engine.handSizeNow(run), 8, `${L}: back to 8`);
    assert.equal(run.blind.hand.length, 8, `${L}: 8 cards dealt`);
  });

  // ---------------------------------------------------------------- Helping Hand
  jt('helpinghand', 'Tarot cards that use selected cards take 1 more (The Candlemaker on 3 cards; Gold Leaf on 2)', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const uid = give(run, 'tarot', 'inkpot');
    const three = run.blind.hand.slice(0, 3);
    ok(Engine.canUseConsumable(run, uid, three), `${L}: The Candlemaker accepts 3 cards`);
    use(run, uid, three);
    for (const u of three) assert.equal(cardRef(run, u).enhancement, 'inked', `${L}: all 3 became Waxed`);
    const two = run.blind.hand.slice(3, 5);
    use(run, give(run, 'tarot', 'pricegun'), two);
    for (const u of two) assert.equal(cardRef(run, u).enhancement, 'dimestore', `${L}: Gold Leaf took 2 cards`);
  });
  jt('helpinghand', 'without it The Candlemaker refuses 3 cards; Spectral cards are not changed (Cursed Coin still 1-2)', ({ id, L }) => {
    const a = blindRun();
    bad(Engine.canUseConsumable(a, give(a, 'tarot', 'inkpot'), a.blind.hand.slice(0, 3)), 'The Candlemaker on 3 cards without Helping Hand', 'Select 1 or 2 cards.');
    const b = blindRun();
    addJ(b, id);
    bad(Engine.canUseConsumable(b, give(b, 'spectral', 'cursedcoin'), b.blind.hand.slice(0, 3)), `${L}: Cursed Coin on 3 cards`);
  });

  // ---------------------------------------------------------------- Nesting Dolls
  jt('nestingdolls', 'a Pair Joker accepts a Two Pair (Matching Socks: 48 + 25 = 73 x 6 = 438; without: 96)', ({ id }) => {
    const plainRun = blindRun();
    addJ(plainRun, 'matchingsocks');
    expectTotals(id, score(plainRun, cards('9S', '9D', '4H', '4C')), 48, 2, 96, 'Matching Socks alone ignores a Two Pair');
    const run = blindRun();
    addJ(run, id);
    addJ(run, 'matchingsocks');
    expectTotals(id, score(run, cards('9S', '9D', '4H', '4C')), 73, 6, 438, 'with Nesting Dolls');
  });
  jt('nestingdolls', 'a High Card Joker accepts only a High Card; detection and base values do not change', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    addJ(run, 'solofiddler');
    const res = score(run, KK());
    assert.equal(res.handId, 'pair', `${L}: still a Pair`);
    expectTotals(id, res, 32, 2, 64, 'Solo Fiddler stays off on a Pair');
  });

  // ---------------------------------------------------------------- Makeover
  jt('makeover', 'a card added with no Enhancement gets a random one (Carbon Copy of a plain Queen)', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const [a] = setHand(run, ['QD']);
    const before = new Set(run.cards.map((c) => c.uid));
    use(run, give(run, 'tarot', 'carboncopy'), [a]);
    const added = run.cards.filter((c) => !before.has(c.uid));
    assert.equal(added.length, 1, 'one copy added');
    assert.ok(ENHANCEMENT_IDS.includes(added[0].enhancement), `${L}: the copy got an Enhancement, got ${added[0].enhancement}`);
    deq(pickKeys(added[0], ['rank', 'suit']), { rank: 12, suit: 'D' }, `${L}: still a Queen of Diamonds`);
    assert.equal(cardRef(run, a).enhancement, null, `${L}: the original stays plain`);
  });
  jt('makeover', 'an added card that has an Enhancement keeps it; a Card Pack pick gets one too', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const [a] = setHand(run, [{ code: 'QD', enhancement: 'inked' }]);
    const before = new Set(run.cards.map((c) => c.uid));
    use(run, give(run, 'tarot', 'carboncopy'), [a]);
    assert.equal(run.cards.find((c) => !before.has(c.uid)).enhancement, 'inked', `${L}: a Waxed copy stays Waxed`);
    const shop = shopRun();
    addJ(shop, id);
    openPack(shop, 'cardnormal');
    shop.pack.options[0].card.enhancement = null;
    const was = new Set(shop.cards.map((c) => c.uid));
    pick(shop, 0);
    const picked = shop.cards.filter((c) => !was.has(c.uid));
    assert.equal(picked.length, 1, 'the pick joined the deck');
    assert.ok(ENHANCEMENT_IDS.includes(picked[0].enhancement), `${L}: the plain Card Pack card got an Enhancement`);
  });

  // ---------------------------------------------------------------- Lucky Dip
  jt('luckydip', 'the first Booster Pack bought in a Shop allows 1 more pick (Card Pack: 2)', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    toShop(run);
    openPack(run, 'cardnormal');
    assert.equal(run.pack.picksLeft, 2, `${L}: 1 + 1 picks (ASSUMED A11)`);
    pick(run, 0);
    const r = pick(run, 1);
    assert.equal(r.closed, true, `${L}: the pack closes after 2 picks`);
    assert.equal(run.cards.length, 54, `${L}: both picks joined the deck`);
  });
  jt('luckydip', 'the second pack in the same Shop and a free Tag pack are unchanged (1 pick)', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    toShop(run);
    openPack(run, 'cardnormal', 0);
    ok(Engine.packSkip(run), 'packSkip');
    openPack(run, 'cardnormal', 1);
    assert.equal(run.pack.picksLeft, 1, `${L}: the second pack bought in this Shop`);
    ok(Engine.packSkip(run), 'packSkip');
    ok(Engine.leaveShop(run), 'leaveShop');
    skipWith(run, 'grabbag');
    assert.equal(run.pack.picksLeft, 1, `${L}: a free Tag pack`);
  });

  // ---------------------------------------------------------------- Big Spender
  // Balance 2026-11-23 (Jokers, engine fix): +0.5 Mult per purchase (was +1).
  jt('bigspender', 'gains +0.5 Mult per Shop purchase (a Tarot card, a pack); a reroll does not count', ({ id, L }) => {
    const run = mkRun();
    const j = addJ(run, id);
    toShop(run);
    run.money = 30;
    ok(Engine.buy(run, forceCard(run, { kind: 'tarot', id: 'paperroute', price: 3 })), 'buy a Tarot card');
    assert.equal(st(run, j), 0.5, `${L}: one purchase`);
    ok(Engine.reroll(run), 'reroll');
    assert.equal(st(run, j), 0.5, `${L}: a reroll is not a purchase`);
    openPack(run, 'cardnormal');
    assert.equal(st(run, j), 1, `${L}: a Booster Pack is a purchase`);
  });
  jt('bigspender', 'buying Big Spender itself does not count; its Mult scores (+2: 32 x 4 = 128)', ({ id, L }) => {
    needRow(id);
    const run = shopRun();
    run.money = 30;
    ok(Engine.buy(run, forceCard(run, { kind: 'joker', id, price: 6 })), 'buy Big Spender');
    const j = run.jokers.find((x) => x.id === id);
    assert.ok(j, `${L}: the bought Big Spender is in the rack`);
    assert.equal(st(run, j), 0, `${L}: its own purchase does not count`);
    const b = blindRun();
    const k = addJ(b, id);
    setSt(b, k, 2);
    expectTotals(id, score(b, KK()), 32, 4, 128, 'four purchases at +0.5 (balance 2026-11-23)');
  });

  // ---------------------------------------------------------------- Nail-Biter
  jt('nailbiter', 'gains +4 Mult when the hand that beats the Blind leaves 0 hands', ({ id, L }) => {
    const run = mkRun();
    const j = addJ(run, id);
    begin(run);
    run.blind.handsLeft = 1;
    clearBlind(run);
    assert.equal(st(run, j), 4, `${L}: beaten with the last hand`);
  });
  jt('nailbiter', 'beaten with hands to spare: nothing; its Mult scores (+4: 32 x 6 = 192)', ({ id, L }) => {
    const run = mkRun();
    const j = addJ(run, id);
    begin(run);
    clearBlind(run);
    assert.equal(st(run, j), 0, `${L}: 3 hands were left`);
    const b = blindRun();
    const k = addJ(b, id);
    setSt(b, k, 4);
    expectTotals(id, score(b, KK()), 32, 6, 192, 'one nail-biting win');
  });

  // ---------------------------------------------------------------- Smooth Talker
  jt('smoothtalker', 'Boss Blind targets x0.8 (Ante 1: 600 -> 480), in the preview and when it starts; Small and Big unchanged', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    deq([0, 1, 2].map((i) => Engine.blindTarget(run, 1, i)), [300, 450, 480], `${L}: blindTarget previews (ASSUMED A8)`);
    begin(run, { blindIndex: 2, boss: 'smudge' });
    assert.equal(run.blind.target, 480, `${L}: the Boss Blind starts at 480`);
  });
  jt('smoothtalker', 'with the other multipliers (Nightfall Stake, Ante 2, The Short Fuse: 700 x 2 x 1.2 x 0.75 x 0.8 = 1008 -> 1010)', ({ id, L }) => {
    const run = mkRun({ stake: 'uhoh' });
    addJ(run, id);
    begin(run, { ante: 2, blindIndex: 2, boss: 'shortfuse' });
    assert.equal(run.blind.target, 1010, `${L}: rounded to tens`);
    const without = mkRun({ stake: 'uhoh' });
    begin(without, { ante: 2, blindIndex: 2, boss: 'shortfuse' });
    assert.equal(without.blind.target, 1260, 'without the Joker: 700 x 2 x 1.2 x 0.75');
  });

  // ---------------------------------------------------------------- Coronation
  jt('coronation', 'after the hand, scored Jacks become Queens and scored Queens become Kings; others stay, Enhancements too', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const [js, jh, qd, jc] = setHand(run, [{ code: 'JS', enhancement: 'inked' }, 'JH', 'QD', 'JC']);
    play(run, [js, jh, qd]); // a Pair of Jacks (12 + 45 + 10 = 67 x 2 = 134); the Queen is unscored; JC stays in hand
    deq([js, jh, qd, jc].map((u) => cardRef(run, u).rank), [12, 12, 12, 11], `${L}: the two scored Jacks became Queens`);
    assert.equal(cardRef(run, js).enhancement, 'inked', `${L}: the Enhancement stays`);
    const [qs, qh, kd] = setHand(run, ['QS', 'QH', 'KD']);
    play(run, [qs, qh, kd]); // a Pair of Queens; the King is unscored
    deq([qs, qh, kd].map((u) => cardRef(run, u).rank), [13, 13, 13], `${L}: the two scored Queens became Kings`);
  });

  // ---------------------------------------------------------------- Usher
  jt('usher', 'the Voucher costs half, rounded up ($10 -> $5), and is bought for $5', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    toShop(run);
    const v = shopItems(run, ASSUMED.slot.voucher)[0];
    assert.ok(v, 'a Voucher is on offer');
    assert.equal(v.price, 5, `${L}: $5`);
    run.money = 5;
    ok(Engine.buy(run, v.index), `${L}: buy the Voucher with $5`);
    assert.equal(run.money, 0);
  });
  jt('usher', 'before Season Pass takes its $1 off ($10 -> $5 -> $4)', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    run.vouchers.push('dollaroff');
    toShop(run);
    assert.equal(shopItems(run, ASSUMED.slot.voucher)[0].price, 4, `${L}: half first, then $1 off`);
  });
});

// ================================================================== Rare Jokers
describe('Rare Jokers (15)', () => {
  // ---------------------------------------------------------------- Big Top
  jt('bigtop', 'x2.5 Mult on a Full House (84 x 10 = 840), Four of a Kind (104 x 15 = 1560) or Straight Flush (145 x 20 = 2900)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('KS', 'KH', 'KD', '5S', '5H')), 84, 10, 840, 'Full House');
    expectTotals(id, score(run, cards('KS', 'KH', 'KD', 'KC')), 104, 15, 1560, 'Four of a Kind');
    expectTotals(id, score(run, cards('5S', '6S', '7S', '8S', '9S')), 145, 20, 2900, 'Straight Flush');
  });
  jt('bigtop', 'a Pair, Flush or Straight: nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 32, 2, 64, 'Pair');
    expectTotals(id, score(run, cards('2S', '5S', '9S', 'KS', '7S')), 71, 4, 284, 'Flush');
    expectTotals(id, score(run, cards('5S', '6H', '7D', '8C', '9S')), 69, 4, 276, 'Straight');
  });

  // ---------------------------------------------------------------- Poker Face
  jt('pokerface', 'gains x0.25 each Blind beaten without discarding; a discard spoils it', ({ id, L }) => {
    const run = mkRun();
    const j = addJ(run, id);
    begin(run);
    clearBlind(run);
    assert.ok(approx(st(run, j), 1.25), `${L}: x1 -> x1.25, got ${st(run, j)}`);
    nextBlind(run);
    discard(run, run.blind.hand.slice(0, 1));
    clearBlind(run);
    assert.ok(approx(st(run, j), 1.25), `${L}: a Blind with a discard adds nothing, got ${st(run, j)}`);
  });
  jt('pokerface', 'gives its xMult (x1.5: 32 x 3 = 96); no step at x1', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectJokerSteps(id, score(run, KK()), j, [], 'x1');
    setSt(run, j, 1.5);
    expectTotals(id, score(run, KK()), 32, 3, 96, 'x1.5');
  });

  // ---------------------------------------------------------------- Dragon Tamer
  jt('dragontamer', 'gains x0.5 each Boss Blind beaten; a Small Blind adds nothing', ({ id, L }) => {
    const boss = mkRun();
    const j = addJ(boss, id);
    begin(boss, { blindIndex: 2, boss: 'smudge' });
    clearBlind(boss);
    assert.ok(approx(st(boss, j), 1.5), `${L}: x1 -> x1.5, got ${st(boss, j)}`);
    const small = mkRun();
    const k = addJ(small, id);
    begin(small);
    clearBlind(small);
    assert.ok(approx(st(small, k), 1), `${L}: still x1 after a Small Blind`);
  });
  jt('dragontamer', 'gives its xMult (x2: 32 x 4 = 128); no step at x1', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectJokerSteps(id, score(run, KK()), j, [], 'x1');
    setSt(run, j, 2);
    expectTotals(id, score(run, KK()), 32, 4, 128, 'x2');
  });

  // ---------------------------------------------------------------- Fortune Cookie
  jt('fortunecookie', 'scored cards of the named rank give +$2 each, paid when played (Kings named: [2, 2], +$4)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    setSt(run, j, 13);
    const res = score(run, KK());
    deq(moneySteps(res), [2, 2], `${L}: two named Kings`);
    expectTotals(id, res, 32, 2, 64, 'money only');
    assert.ok(String(Engine.jokerText(run, j.uid)).includes(Content.RANK_PLURALS[13]), `${L}: jokerText names the rank, got "${Engine.jokerText(run, j.uid)}"`);
    setSt(run, j, 5);
    deq(moneySteps(score(run, KK())), [], `${L}: 5s named, Kings give nothing`);
    setSt(run, j, 13);
    const uids = setHand(run, ['KS', 'KH']);
    const m0 = run.money;
    play(run, uids);
    assert.equal(run.money, m0 + 4, `${L}: +$4 when played`);
  });
  jt('fortunecookie', 'the rank is rolled when gained and again when each Blind starts (2 to Ace, 12 seeds)', ({ id, L }) => {
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      const run = mkRun({ seed: seedN(7300 + i) });
      const j = addJ(run, id);
      const gained = st(run, j);
      assert.ok(Number.isInteger(gained) && gained >= 2 && gained <= 14, `${L}: rank ${gained} when gained`);
      begin(run);
      const rolled = st(run, j);
      assert.ok(Number.isInteger(rolled) && rolled >= 2 && rolled <= 14, `${L}: rank ${rolled} at Blind start`);
      seen.add(rolled);
    }
    assert.ok(seen.size >= 2, `${L}: 12 Blinds all named the same rank`);
  });

  // ---------------------------------------------------------------- Stand-In
  jt('standin', 'copies a random other Joker, picked when a Blind starts (only Tin Drum: 32 + 40 + 40 = 112 x 2 = 224)', ({ id, L }) => {
    const run = mkRun();
    const t = addJ(run, 'tindrum');
    const j = addJ(run, id);
    begin(run);
    assert.equal(st(run, j), t.uid, `${L}: it targets Tin Drum (ASSUMED A4)`);
    expectTotals(id, score(run, KK()), 112, 2, 224, 'Tin Drum twice');
  });
  jt('standin', 'with no other Joker it does nothing (64)', ({ id }) => {
    const run = mkRun();
    addJ(run, id);
    begin(run);
    expectTotals(id, score(run, KK()), 32, 2, 64, 'nothing to copy');
  });
  jt('standin', 'when its target leaves, it picks again at once (sell Tin Drum: it copies Ember Imp, 32 x 12 = 384)', ({ id }) => {
    const run = mkRun();
    const t = addJ(run, 'tindrum');
    addJ(run, 'emberimp');
    addJ(run, id);
    begin(run);
    ok(Engine.sellJoker(run, t.uid), 'sell Tin Drum');
    // Whatever it copied before, the only other Joker now is Ember Imp: +5, +5.
    expectTotals(id, score(run, KK()), 32, 12, 384, 'Ember Imp twice');
  });

  // ---------------------------------------------------------------- Old Flame
  jt('oldflame', 'nothing until you sell a Joker; then it acts as that Joker (sell Tin Drum: 72 x 2 = 144)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 32, 2, 64, 'nothing sold yet');
    const t = addJ(run, 'tindrum');
    ok(Engine.sellJoker(run, t.uid), 'sell Tin Drum');
    expectTotals(id, score(run, KK()), 72, 2, 144, 'Old Flame acts as Tin Drum');
  });
  jt('oldflame', 'selling another Joker replaces it (sell Ember Imp next: 32 x 7 = 224)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    ok(Engine.sellJoker(run, addJ(run, 'tindrum').uid), 'sell Tin Drum');
    ok(Engine.sellJoker(run, addJ(run, 'emberimp').uid), 'sell Ember Imp');
    expectTotals(id, score(run, KK()), 32, 7, 224, 'now Ember Imp, no more Tin Drum');
  });

  // ---------------------------------------------------------------- Jack of All Trades
  jt('jackofalltrades', 'a Jack stands in for any rank: KS KH JD is a Three of a Kind (32 + 30 = 62 x 3 = 186)', ({ id, L }) => {
    const plainRun = blindRun();
    assert.equal(score(plainRun, cards('KS', 'KH', 'JD')).handId, 'pair', 'without the Joker: a Pair of Kings');
    const run = blindRun();
    addJ(run, id);
    const hand = cards('KS', 'KH', 'JD');
    const res = score(run, hand);
    assert.equal(res.handId, 'three', `${L}: the Jack joins the Kings`);
    deq(res.scoringUids, hand.map((c) => c.uid), `${L}: the Jack scores`);
    expectTotals(id, res, 62, 3, 186, 'the Jack keeps its 10 Chips');
  });
  jt('jackofalltrades', 'a Jack fills a Straight (5 6 7 8 J: 34 + 36 = 70 x 4 = 280)', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const res = score(run, cards('5S', '6H', '7D', '8C', 'JS'));
    assert.equal(res.handId, 'straight', `${L}: the Jack plays as a 4 or a 9`);
    expectTotals(id, res, 70, 4, 280, 'all five score');
  });

  // ---------------------------------------------------------------- Night Moth
  jt('nightmoth', 'beating a Boss Blind creates a Spectral card, never Tall Tale (12 seeds)', ({ id, L }) => {
    for (let i = 0; i < 12; i++) {
      const run = mkRun({ seed: seedN(7400 + i) });
      addJ(run, id);
      begin(run, { blindIndex: 2, boss: 'smudge' });
      clearBlind(run);
      assert.equal(run.consumables.length, 1, `${L}: seed ${i}: one card created`);
      const c = run.consumables[0];
      assert.equal(c.kind, 'spectral', `${L}: a Spectral card`);
      assert.ok(SPECTRAL_IDS.includes(c.id) && c.id !== 'originstory', `${L}: ${c.id} is a Spectral card other than Tall Tale`);
    }
  });
  jt('nightmoth', 'nothing with full slots, nor after a Small Blind', ({ id, L }) => {
    const full = mkRun();
    addJ(full, id);
    give(full, 'planet', 'blip');
    give(full, 'planet', 'boing');
    begin(full, { blindIndex: 2, boss: 'smudge' });
    clearBlind(full);
    deq(full.consumables.map((c) => c.id), ['blip', 'boing'], `${L}: full slots`);
    const small = mkRun();
    addJ(small, id);
    begin(small);
    clearBlind(small);
    assert.equal(small.consumables.length, 0, `${L}: a Small Blind`);
  });

  // ---------------------------------------------------------------- Ticket Collector
  jt('ticketcollector', 'x(1 + 0.25 per Voucher): 2 Vouchers x1.5 (32 x 3 = 96); none: no step', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectJokerSteps(id, score(run, KK()), j, [], 'no Voucher');
    run.vouchers = ['skyatlas', 'savingsbond'];
    const res = score(run, KK());
    expectTotals(id, res, 32, 3, 96, 'two Vouchers');
    expectJokerSteps(id, res, j, [['xmult', 1.5]]);
  });

  // ---------------------------------------------------------------- Reprise
  jt('reprise', 'a scored card with an Enhancement retriggers (Waxed King: 12 + 90 + 10 = 112 x 2 = 224); plain cards do not', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { enhancement: 'inked' }), mk('KH')]), 112, 2, 224, 'Waxed King twice');
    expectTotals(id, score(run, KK()), 32, 2, 64, 'plain Kings');
  });
  jt('reprise', 'nothing during The Wash-Out (64)', ({ id }) => {
    const run = bossRun('washout');
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { enhancement: 'inked' }), mk('KH')]), 32, 2, 64, 'no Enhancement, no retrigger');
  });

  // ---------------------------------------------------------------- Kaleidoscope
  jt('kaleidoscope', 'card Editions fire twice (Sheen King: 112 x 2 = 224; Phantom King: 22 x 22 = 484); nothing during The Blackout', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { edition: 'gloss' }), mk('KH')]), 112, 2, 224, 'Sheen +40 twice');
    expectTotals(id, score(run, [mk('KS', { edition: 'inverted' }), mk('KH')]), 22, 22, 484, 'Phantom King: +10 Mult twice');
    const dark = bossRun('censor');
    addJ(dark, id);
    expectTotals(id, score(dark, [mk('KS', { edition: 'gloss' }), mk('KH')]), 32, 2, 64, 'The Blackout: no Edition step to double');
  });
  jt('kaleidoscope', 'Joker Editions fire twice (Sheen Tin Drum: 32 + 80 + 40 = 152 x 2 = 304)', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const t = addJ(run, 'tindrum', 'gloss');
    const res = score(run, KK());
    expectTotals(id, res, 152, 2, 304, 'Sheen Tin Drum');
    assert.equal(editionSteps(res, t).length, 2, `${L}: two Sheen steps`);
  });

  // ---------------------------------------------------------------- Gala Night
  jt('galanight', 'every scored card has an Enhancement: x2 (Waxed and Kindled Kings: 67 x 14 = 938); one plain: nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { enhancement: 'inked' }), mk('KH', { enhancement: 'punchy' })]), 67, 14, 938, 'both Enhanced');
    expectTotals(id, score(run, [mk('KS', { enhancement: 'inked' }), mk('KH')]), 67, 2, 134, 'one plain King');
  });
  jt('galanight', 'nothing during The Wash-Out (64)', ({ id }) => {
    const run = bossRun('washout');
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { enhancement: 'inked' }), mk('KH', { enhancement: 'punchy' })]), 32, 2, 64, 'Enhancements switched off');
  });

  // ---------------------------------------------------------------- Brazier
  jt('brazier', 'gains x0.2 per playing card destroyed (Candle Snuffer on 2: x1.4; KK: 32 x 2.8 = 89)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    use(run, give(run, 'tarot', 'eraser'), run.blind.hand.slice(0, 2));
    assert.ok(approx(st(run, j), 1.4), `${L}: x1 + 2 x 0.2 = x1.4, got ${st(run, j)}`);
    expectTotals(id, score(run, KK()), 32, 2.8, 89, 'x1.4');
  });
  jt('brazier', 'no step at x1', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectJokerSteps(id, score(run, KK()), j, []);
  });

  // ---------------------------------------------------------------- Golden Hour
  jt('goldenhour', 'money from cards during a Blind pays double (two Gilt-Edged Kings: +$4; a Crumpled discard: +$2)', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const uids = setHand(run, [{ code: 'KS', enhancement: 'dimestore' }, { code: 'KH', enhancement: 'dimestore' }]);
    const m0 = run.money;
    play(run, uids);
    assert.equal(run.money, m0 + 4, `${L}: 2 x $1, doubled`);
    const [c] = setHand(run, [{ code: '5D', enhancement: 'crumpled' }]);
    const m1 = run.money;
    discard(run, [c]);
    assert.equal(run.money, m1 + 2, `${L}: Crumpled $1, doubled`);
  });
  jt('goldenhour', 'Joker money doubles too (Gold Tooth on two Aces: +$4); cash-out lines do not (Coupon Clipper $3)', ({ id, L }) => {
    const run = mkRun();
    addJ(run, id);
    addJ(run, 'goldtooth');
    addJ(run, 'couponclipper');
    begin(run);
    const uids = setHand(run, ['AS', 'AH']);
    const m0 = run.money;
    play(run, uids);
    assert.equal(run.money, m0 + 4, `${L}: Gold Tooth 2 x $1, doubled`);
    clearBlind(run); // no discard used: Coupon Clipper's line is 3 x $1
    assert.equal((jokerLine(run, 'couponclipper') || {}).amount, 3, `${L}: the cash-out line is not doubled`);
  });

  // ---------------------------------------------------------------- Blackjack
  jt('blackjack', 'scored cards adding up to exactly 21: x3 (7-7-7: 53 x 9 = 477; 2-3-4-5-7 Flush: 59 x 12 = 708)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('7S', '7H', '7D')), 53, 9, 477, 'three 7s');
    expectTotals(id, score(run, cards('2S', '3S', '4S', '5S', '7S')), 59, 12, 708, 'a low Flush');
  });
  jt('blackjack', 'an Ace is 1 or 11 (A-A-A-9-9 Full House: 1 + 1 + 1 + 9 + 9 = 21, 95 x 12 = 1140); KK (20): nothing', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, cards('AS', 'AH', 'AD', '9S', '9H')), 95, 12, 1140, 'three Aces as 1 and two 9s');
    expectTotals(id, score(run, KK()), 32, 2, 64, 'two Kings make 20');
  });
});

// ================================================================== Legendary Jokers
describe('Legendary Jokers (5, through the Engine.addJoker test hook)', () => {
  // ---------------------------------------------------------------- The Candle King
  jt('candleking', 'every scored card gives x1.25 Mult (KK: 2 x 1.25 x 1.25 = 3.125; 32 x 3.125 = 100)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, KK());
    expectTotals(id, res, 32, 3.125, 100, 'two Kings');
    expectJokerSteps(id, res, j, [['xmult', 1.25], ['xmult', 1.25]]);
  });
  jt('candleking', 'retriggers repeat it (Encore King: 42 x 3.90625 = 164)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { seal: 'encore' }), mk('KH')]), 42, 3.90625, 164, 'three passes of x1.25');
  });

  // ---------------------------------------------------------------- Madame Echo
  jt('madameecho', 'every scored card retriggers (KK: 12 + 20 + 20 = 52 x 2 = 104)', ({ id, L }) => {
    const run = blindRun();
    const j = addJ(run, id);
    const res = score(run, KK());
    expectTotals(id, res, 52, 2, 104, 'both Kings twice');
    assert.equal(againNotes(res).filter((s) => s.jokerUid === j.uid).length, 2, `${L}: one Encore! per card`);
  });
  jt('madameecho', 'stacks with an Encore Seal (Encore King 3 passes: 12 + 30 + 20 = 62 x 2 = 124)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, [mk('KS', { seal: 'encore' }), mk('KH')]), 62, 2, 124, 'Encore King 3 times, plain King twice');
  });

  // ---------------------------------------------------------------- The Puppet Master
  jt('puppetmaster', 'copies the Jokers on both sides (Tin Drum, it, Ember Imp: 32 + 40 + 40 = 112, 2 + 5 + 5 = 12; 1344)', ({ id }) => {
    const run = blindRun();
    addJ(run, 'tindrum');
    addJ(run, id);
    addJ(run, 'emberimp');
    expectTotals(id, score(run, KK()), 112, 12, 1344, 'Tin Drum and Ember Imp twice each');
  });
  jt('puppetmaster', 'alone it does nothing (64); at an end of the rack it copies its one neighbour (it, Tin Drum: 112 x 2 = 224)', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    expectTotals(id, score(run, KK()), 32, 2, 64, 'no neighbour to copy');
    addJ(run, 'tindrum');
    expectTotals(id, score(run, KK()), 112, 2, 224, 'Tin Drum twice');
  });

  // ---------------------------------------------------------------- Sir Motley
  jt('sirmotley', 'every 5-card hand is at least a Flush (2S 5H 9D KC 7S: 71 x 4 = 284); every Straight is a Straight Flush (1160)', ({ id, L }) => {
    const run = blindRun();
    addJ(run, id);
    const flush = score(run, cards('2S', '5H', '9D', 'KC', '7S'));
    assert.equal(flush.handId, 'flush', `${L}: five mixed suits make a Flush`);
    expectTotals(id, flush, 71, 4, 284, 'Flush');
    const sf = score(run, cards('5S', '6H', '7D', '8C', '9S'));
    assert.equal(sf.handId, 'straightflush', `${L}: a mixed Straight is a Straight Flush`);
    expectTotals(id, sf, 145, 8, 1160, 'Straight Flush');
  });
  jt('sirmotley', 'Jokers that check suits see every suit (Red Nose on KS KH: 32 x 6 = 192), even during The Wash-Out', ({ id }) => {
    const run = blindRun();
    addJ(run, id);
    addJ(run, 'rednose');
    expectTotals(id, score(run, KK()), 32, 6, 192, 'both Kings count as red');
    const wash = bossRun('washout');
    addJ(wash, id);
    addJ(wash, 'rednose');
    expectTotals(id, score(wash, KK()), 32, 6, 192, 'The Wash-Out does not switch it off');
  });

  // ---------------------------------------------------------------- The Ringmaster
  jt('ringmaster', 'one x1.3^n step, n = other Jokers (it, Tin Drum, Ember Imp: 2 x 1.69 = 3.38 + 5 = 8.38; 72 x 8.38 = 603)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    addJ(run, 'tindrum');
    addJ(run, 'emberimp');
    const res = score(run, KK());
    expectTotals(id, res, 72, 8.38, 603, 'two other Jokers');
    expectJokerSteps(id, res, j, [['xmult', 1.69]]);
  });
  jt('ringmaster', 'alone: no step (64); a Phantom Joker counts (x1.3: 72 x 2.6 = 187)', ({ id }) => {
    const run = blindRun();
    const j = addJ(run, id);
    expectJokerSteps(id, score(run, KK()), j, [], 'no other Joker');
    addJ(run, 'tindrum', 'inverted');
    expectTotals(id, score(run, KK()), 72, 2.6, 187, 'a Phantom Tin Drum');
  });
});
