/*
 * Wickwager: 20 black-box interaction scenarios across Jokers.
 *
 * Copiers with scalers, retriggers and xMult order, a Boss Blind that boos cards against
 * card-triggered Jokers, Editions on Jokers, selling mid-Blind with events, Legendary Jokers via
 * the Engine.addJoker test hook and Tall Tale, and Boss Blinds that switch parts off.
 *
 * Written from the design only (content/content-plan.json texts and behaviours, CONTENT.md,
 * SPEC.md §2 and §4); src/engine.js and src/content.js were not read. Each scenario is computed by
 * hand from the Jokers' texts, with the arithmetic in comments. The harness and the one ASSUMED
 * table are in tests/jokers-bb-harness.mjs.
 *
 * A scenario's title lists the Joker ids it combines, and every assertion message names the Joker
 * whose promise it checks. A plain Pair of Kings (KK) scores 32 Chips x 2 Mult = 64.
 *
 * Run from the project root: node --test "tests/*.test.mjs"
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSUMED, Engine, LEGENDARY_IDS, ENHANCEMENT_IDS, PLANET_OF,
  deq, sorted, approx, ok, label,
  mkRun, begin, blindRun, bossRun, mk, cards, KK, setHand, score, play, discard, playLow, clearBlind,
  toShop, openPack, give, use, pick,
  owns, addJ, st, setSt, editionSteps, moneySteps, againNotes, jokerLine,
  expectTotals,
} from './jokers-bb-harness.mjs';

const scenario = (n, ids, title, fn) => test(`S${String(n).padStart(2, '0')} [${ids.join(', ')}]: ${title}`, fn);

describe('Joker interactions (20 hand-computed scenarios)', () => {
  // ------------------------------------------------------------------ copiers with scalers
  scenario(1, ['standin', 'magpie'], "Stand-In copies Magpie: the copy reads Magpie's Chips, but Magpie gains only once", () => {
    const run = mkRun();
    const m = addJ(run, 'magpie');
    const s = addJ(run, 'standin');
    begin(run); // Stand-In picks a target when the Blind starts: Magpie is the only other Joker.
    assert.equal(st(run, s), m.uid, `${label('standin')}: targets Magpie (ASSUMED A4)`);
    discard(run, run.blind.hand.slice(0, 3));
    // Magpie: 0 + 2 x 3 cards = 6. The copy does not run Magpie's discard event again (it would be 12).
    assert.equal(st(run, m), 6, `${label('magpie')}: +2 x 3 discarded cards, gained once`);
    // KK 32 Chips; Magpie +6 -> 38; Stand-In as Magpie +6 -> 44; x 2 Mult = 88
    expectTotals('standin', score(run, KK()), 44, 2, 88, 'Magpie +6 and its copy +6');
  });

  scenario(2, ['oldflame', 'drippingcandle'], 'Old Flame takes on a sold Dripping Candle with its state, burns down on its own, and goes back to nothing instead of melting', () => {
    const run = mkRun();
    const o = addJ(run, 'oldflame');
    const d = addJ(run, 'drippingcandle');
    begin(run);
    setSt(run, d, 2); // the candle has burnt down to +2 Mult
    ok(Engine.sellJoker(run, d.uid), 'sell Dripping Candle between hands');
    // Old Flame now acts as Dripping Candle with a copy of its state (+2): KK 32 x (2 + 2) = 128
    expectTotals('oldflame', score(run, KK()), 32, 4, 128, 'the copied candle at +2');
    playLow(run); // after the hand the copy burns down: 2 -> 1
    expectTotals('oldflame', score(run, KK()), 32, 3, 96, 'the copied candle at +1');
    const r = playLow(run); // 1 -> 0: the copy would melt, so Old Flame goes back to nothing (ASSUMED A15)
    assert.ok(owns(run, o.uid), `${label('oldflame')}: stays in the rack`);
    assert.ok(!(r.eaten || []).includes(o.uid), `${label('oldflame')}: is not eaten`);
    expectTotals('oldflame', score(run, KK()), 32, 2, 64, 'back to nothing');
  });

  scenario(3, ['puppetmaster', 'standin', 'tindrum'], 'The Puppet Master follows a copy chain through Stand-In; a copy loop does nothing', () => {
    // A: [Tin Drum, Puppet Master, Stand-In copying Tin Drum]
    const a = mkRun();
    const t = addJ(a, 'tindrum');
    addJ(a, 'puppetmaster');
    const s = addJ(a, 'standin');
    begin(a);
    setSt(a, s, t.uid); // ASSUMED A4: Stand-In copies Tin Drum
    // Tin Drum +40 -> 72. Puppet Master: its left (Tin Drum) +40 -> 112; its right (Stand-In, whose chain ends at
    // Tin Drum) +40 -> 152. Stand-In as Tin Drum +40 -> 192. 192 x 2 = 384
    expectTotals('puppetmaster', score(a, KK()), 192, 2, 384, 'Tin Drum four times over');
    // B: [Stand-In copying Puppet Master, Puppet Master]
    const b = mkRun();
    const s2 = addJ(b, 'standin');
    const p2 = addJ(b, 'puppetmaster');
    begin(b);
    setSt(b, s2, p2.uid);
    // Puppet Master copies its one neighbour, Stand-In, which copies Puppet Master: a loop, nothing.
    // Stand-In copies Puppet Master, which copies Stand-In: a loop, nothing. KK stays 64.
    expectTotals('puppetmaster', score(b, KK()), 32, 2, 64, 'a copy loop does nothing');
  });

  // ------------------------------------------------------------------ retriggers and xMult order
  scenario(4, ['madameecho', 'bookends', 'onemanband'], 'retriggers stack on a lone Encore King: 1 + 1 (Encore) + 1 (Madame Echo) + 1 (Bookends) + 3 (One-Man Band) = 7 passes', () => {
    const run = blindRun();
    const e = addJ(run, 'madameecho');
    const b = addJ(run, 'bookends');
    const o = addJ(run, 'onemanband');
    const res = score(run, [mk('KS', { seal: 'encore' })]);
    // High Card: 5 + 7 passes x 10 = 75 Chips x 1 Mult = 75. Bookends gives a lone card 1 extra pass, not 2.
    expectTotals('onemanband', res, 75, 1, 75, 'seven passes of the King');
    const notes = againNotes(res);
    assert.equal(notes.length, 6, `${label('madameecho')}, ${label('bookends')}, ${label('onemanband')}: 6 Encore! notes, got ${notes.length}`);
    assert.equal(notes.filter((n) => n.seal === 'encore').length, 1, 'one pass names the Encore Seal');
    deq(
      [e, b, o].map((j) => notes.filter((n) => n.jokerUid === j.uid).length),
      [1, 1, 3],
      'Encore! notes name Madame Echo once, Bookends once, One-Man Band three times',
    );
  });

  scenario(5, ['ringmaster', 'tindrum', 'emberimp', 'candleking'], "xMult order: The Ringmaster after +Mult beats it before; The Candle King's on-card xMult comes first wherever it sits", () => {
    const run = blindRun();
    const t = addJ(run, 'tindrum');
    const e = addJ(run, 'emberimp');
    const r = addJ(run, 'ringmaster');
    // [Tin Drum, Ember Imp, Ringmaster]: 32 + 40 = 72 Chips; (2 + 5) x 1.3^2 = 7 x 1.69 = 11.83; 72 x 11.83 = 851.76 -> 851
    expectTotals('ringmaster', score(run, KK()), 72, 11.83, 851, 'Ringmaster last');
    ok(Engine.reorderJokers(run, [r.uid, t.uid, e.uid]), 'reorderJokers');
    // [Ringmaster, Tin Drum, Ember Imp]: 2 x 1.69 = 3.38, + 5 = 8.38; 72 x 8.38 = 603.36 -> 603
    expectTotals('ringmaster', score(run, KK()), 72, 8.38, 603, 'Ringmaster first');
    const c = blindRun();
    const ce = addJ(c, 'emberimp');
    const ck = addJ(c, 'candleking');
    // Scoring step 3 (cards) comes before step 5 (Jokers): 2 x 1.25 x 1.25 = 3.125, then Ember Imp + 5 = 8.125; 32 x 8.125 = 260
    expectTotals('candleking', score(c, KK()), 32, 8.125, 260, 'Candle King right of Ember Imp');
    ok(Engine.reorderJokers(c, [ck.uid, ce.uid]), 'reorderJokers');
    expectTotals('candleking', score(c, KK()), 32, 8.125, 260, 'Candle King left of Ember Imp: the same');
  });

  // ------------------------------------------------------------------ a Boss Blind that boos cards
  scenario(6, ['openingact', 'finalbow', 'papercrown', 'bookends', 'candleking'], 'The Heckler boos the top card: card Jokers skip it and nothing moves to its neighbour', () => {
    const run = bossRun('heckler');
    addJ(run, 'openingact');
    addJ(run, 'finalbow');
    addJ(run, 'papercrown');
    const b = addJ(run, 'bookends');
    const hand = cards('KS', 'KH', '5D', '5C'); // Two Pair: all four score
    const res = score(run, hand);
    // Base 22 x 2. KS is booed (highest rank, leftmost on ties) and skips everything.
    // KH +10 -> 32, Paper Crown +12 -> 44 (Opening Act: its first card was booed and KH does not take its place).
    // 5D +5 -> 49. 5C is last (Bookends +1 pass): +5 -> 54, Final Bow x1.5 -> 3; Encore! +5 -> 59, x1.5 -> 4.5.
    // Bookends' pass for the first card is lost with KS. 59 x 4.5 = 265.5 -> 265
    assert.equal(res.booedUid, hand[0].uid, 'The Heckler boos the King of Spades');
    const booed = res.steps.find((s) => s.label === 'Booed');
    assert.ok(booed && booed.source === 'boss' && booed.uid === hand[0].uid, "a 'Booed' note from the Boss Blind on KS");
    expectTotals('openingact', res, 59, 4.5, 265, 'Opening Act, Final Bow, Paper Crown and Bookends around a booed King');
    deq(againNotes(res).map((n) => [n.uid, n.jokerUid]), [[hand[3].uid, b.uid]], `${label('bookends')}: one Encore!, on the last card only`);
    const k = bossRun('heckler');
    addJ(k, 'candleking');
    // KS booed: KH +10 -> 22 Chips, x1.25 -> 2.5 Mult; 22 x 2.5 = 55
    expectTotals('candleking', score(k, KK()), 22, 2.5, 55, 'a booed card is not scored, so no x1.25 for it');
  });

  // ------------------------------------------------------------------ Editions on Jokers
  scenario(7, ['kaleidoscope', 'tindrum', 'ringmaster'], 'Kaleidoscope doubles Joker Editions: a Sheen Tin Drum and a Glitch Ringmaster', () => {
    const run = blindRun();
    const t = addJ(run, 'tindrum', 'gloss');
    addJ(run, 'kaleidoscope');
    const r = addJ(run, 'ringmaster', 'fourcolor');
    const res = score(run, KK());
    // Tin Drum: Sheen +40 twice -> 112, then its own +40 -> 152. Kaleidoscope has no step of its own.
    // Ringmaster: its own x1.3^2 (2 other Jokers) -> 2 x 1.69 = 3.38, then Glitch x1.6 twice -> 5.408 -> 8.6528.
    // 152 x 8.6528 = 1315.2256 -> 1315
    expectTotals('kaleidoscope', res, 152, 8.6528, 1315, 'Sheen and Glitch each twice');
    deq(editionSteps(res, t), [['chips', 40, 'gloss'], ['chips', 40, 'gloss']], `${label('tindrum')}: two Sheen steps`);
    deq(
      res.steps.filter((s) => s.source === 'joker' && s.uid === r.uid).map((s) => [s.via, s.kind, s.amount]),
      [['joker', 'xmult', 1.69], ['edition', 'xmult', 1.6], ['edition', 'xmult', 1.6]],
      `${label('ringmaster')}: its own x1.69 first, then Glitch twice`,
    );
  });

  scenario(8, ['emptyseats', 'paymaster', 'tindrum', 'emberimp'], 'Phantom Jokers take no slot (Empty Seats) but still count as Jokers (Paymaster)', () => {
    const run = mkRun();
    addJ(run, 'emptyseats');
    addJ(run, 'paymaster');
    addJ(run, 'tindrum', 'inverted');
    addJ(run, 'emberimp', 'inverted');
    assert.equal(Engine.jokerSlotsUsed(run), 2, 'two Phantom Jokers use no slot');
    begin(run);
    // Empty Seats: 5 - 2 used = 3 empty -> +6 Mult. Paymaster: nothing while scoring. Tin Drum (Phantom: no Edition
    // step) +40. Ember Imp +5. 72 Chips x (2 + 6 + 5 = 13) = 936
    expectTotals('emptyseats', score(run, KK()), 72, 13, 936, '3 empty slots beside two Phantom Jokers');
    clearBlind(run);
    // Paymaster: 3 other Jokers, Phantom ones included -> $3
    assert.equal((jokerLine(run, 'paymaster') || {}).amount, 3, `${label('paymaster')}: $1 x 3 other Jokers`);
  });

  // ------------------------------------------------------------------ selling mid-Blind with events
  scenario(9, ['lastlaugh', 'pawnbroker', 'oldflame'], 'selling mid-Blind: Last Laugh gives a hand, Pawnbroker counts both sales, Old Flame takes on Last Laugh and gives a hand when sold', () => {
    const run = mkRun();
    const p = addJ(run, 'pawnbroker');
    const l = addJ(run, 'lastlaugh');
    const o = addJ(run, 'oldflame');
    begin(run); // 4 hands, $4
    ok(Engine.sellJoker(run, l.uid), 'sell Last Laugh');
    // Last Laugh: +1 hand (5), sells for $4 / 2 = $2 ($6); Pawnbroker +2; Old Flame takes on Last Laugh.
    assert.equal(run.blind.handsLeft, 5, `${label('lastlaugh')}: 4 + 1 hands`);
    assert.equal(st(run, p), 2, `${label('pawnbroker')}: +2 for Last Laugh`);
    ok(Engine.sellJoker(run, o.uid), 'sell Old Flame');
    // Old Flame acts as Last Laugh (ASSUMED A15): +1 hand (6); sells for $8 / 2 = $4 ($10); Pawnbroker +2 -> 4.
    assert.equal(run.blind.handsLeft, 6, `${label('oldflame')}: as Last Laugh, +1 more hand`);
    assert.equal(run.money, 10, 'money: $4 + $2 + $4');
    assert.equal(st(run, p), 4, `${label('pawnbroker')}: +2 for Old Flame`);
    // KK: 32 x (2 + 4) = 192
    expectTotals('pawnbroker', score(run, KK()), 32, 6, 192, 'two Jokers sold');
  });

  // ------------------------------------------------------------------ Legendary Jokers via the test hook
  scenario(10, ['candleking', 'madameecho', 'puppetmaster', 'ringmaster', 'sirmotley', 'rednose', 'pinwheel'], 'Legendary Jokers through the test hook and Tall Tale; Sir Motley makes Red Nose and Pinwheel see every suit', () => {
    // A: with 4 Legendaries owned (Engine.addJoker, ASSUMED A16), Tall Tale creates the 5th and costs 1 hand size for good.
    const run = mkRun();
    for (const id of ['candleking', 'madameecho', 'puppetmaster', 'ringmaster']) addJ(run, id);
    use(run, give(run, 'spectral', 'originstory'));
    deq(sorted(run.jokers.map((j) => j.id)), sorted(LEGENDARY_IDS), `${label('sirmotley')}: Tall Tale created the one Legendary not owned`);
    assert.equal(run.handSize, 7, 'Tall Tale: -1 hand size for good');
    // B: [Sir Motley, Red Nose, Pinwheel] on KK: KS counts as a Heart, so Red Nose +2 and +2 -> 6; Pinwheel: 4 suits
    // -> +12 -> 18. 32 x 18 = 576
    const b = blindRun();
    addJ(b, 'sirmotley');
    addJ(b, 'rednose');
    addJ(b, 'pinwheel');
    expectTotals('sirmotley', score(b, KK()), 32, 18, 576, 'every card counts as every suit');
  });

  // ------------------------------------------------------------------ Boss Blinds that switch parts off
  scenario(11, ['magpie', 'chimneysweep'], 'The Wet Blanket switches off the leftmost Joker for the Blind: Magpie gains nothing and its Sheen is off; Chimney Sweep counts on', () => {
    const run = mkRun();
    const m = addJ(run, 'magpie', 'gloss');
    addJ(run, 'chimneysweep');
    begin(run, { blindIndex: 2, boss: 'wetblanket' });
    assert.equal(run.blind.wetJoker, m.uid, 'The Wet Blanket marks Magpie, the leftmost Joker');
    discard(run, run.blind.hand.slice(0, 3));
    assert.equal(st(run, m), 0, `${label('magpie')}: paused, its counter does not move`);
    const res = score(run, KK());
    // Magpie: off (no Sheen +40, no Chips). Chimney Sweep: 3 cards discarded -> +1 (every 2 cards;
    // balance 2026-11-23, engine fix). 32 x 3 = 96
    expectTotals('chimneysweep', res, 32, 3, 96, 'only Chimney Sweep acts');
    assert.equal(res.steps.filter((s) => s.uid === m.uid).length, 0, `${label('magpie')}: no step at all, its Edition included`);
  });

  scenario(12, ['rednose', 'pinwheel', 'sirmotley'], 'The Wash-Out turns a Masked King back into a Spade, but Sir Motley still makes every card every suit', () => {
    const run = bossRun('washout');
    addJ(run, 'rednose');
    addJ(run, 'pinwheel');
    const played = () => [mk('KS', { enhancement: 'scribbled' }), mk('KH')];
    // Masked does nothing (no +10, no any-suit): Red Nose: KH +2 -> 4; Pinwheel: Spade and Heart -> +6 -> 10. 32 x 10 = 320
    expectTotals('rednose', score(run, played()), 32, 10, 320, 'The Wash-Out: a plain Spade and a Heart');
    addJ(run, 'sirmotley');
    // Sir Motley is not switched off: Red Nose +2 and +2 -> 6; Pinwheel 4 suits +12 -> 18; Chips still 32. 32 x 18 = 576
    expectTotals('sirmotley', score(run, played()), 32, 18, 576, 'The Wash-Out with Sir Motley');
  });

  // ------------------------------------------------------------------ money
  scenario(13, ['goldenhour', 'goldtooth', 'couponclipper'], 'Golden Hour doubles card and Joker money, retriggers included; the cash-out is not doubled', () => {
    const run = mkRun();
    addJ(run, 'goldtooth');
    addJ(run, 'goldenhour');
    addJ(run, 'couponclipper');
    begin(run);
    const uids = setHand(run, [{ code: 'AS', seal: 'encore' }, { code: 'AH', enhancement: 'dimestore' }]);
    const m0 = run.money;
    const r = play(run, uids);
    // Money: AS pass 1 Gold Tooth $1, AS pass 2 Gold Tooth $1, AH Gilt-Edged $1, AH Gold Tooth $1 = $4, doubled = $8
    assert.equal(run.money, m0 + 8, `${label('goldenhour')}: $4 from cards and Gold Tooth, doubled`);
    assert.equal(moneySteps(r.result).length, 4, 'four money steps');
    // Pair of Aces with the Encore Ace twice: 12 + 11 + 11 + 11 = 45 x 2 = 90 (the Blind goes on)
    expectTotals('goldenhour', r.result, 45, 2, 90, 'Pair of Aces, one retriggered');
    clearBlind(run);
    assert.equal((jokerLine(run, 'couponclipper') || {}).amount, 3, `${label('goldenhour')}: Coupon Clipper's cash-out line stays $3`);
  });

  // ------------------------------------------------------------------ hand conditions
  scenario(14, ['nestingdolls', 'matchingsocks', 'hattrick', 'twoscompany'], 'Nesting Dolls: one Full House pays the Pair, Three of a Kind and Two Pair Jokers', () => {
    const run = blindRun();
    const n = addJ(run, 'nestingdolls');
    addJ(run, 'matchingsocks');
    addJ(run, 'hattrick');
    addJ(run, 'twoscompany');
    const fh = () => cards('KS', 'KH', 'KD', '5S', '5H');
    const res = score(run, fh());
    assert.equal(res.handId, 'fullhouse', 'detection does not change');
    // Full House 44 + 40 = 84 Chips, 4 Mult. Matching Socks +25 -> 109, +4 -> 8; Hat Trick +30 -> 139, +6 -> 14;
    // Two's Company x2 -> 28. 139 x 28 = 3892
    expectTotals('nestingdolls', res, 139, 28, 3892, 'three hand Jokers on one Full House');
    ok(Engine.sellJoker(run, n.uid), 'sell Nesting Dolls');
    expectTotals('nestingdolls', score(run, fh()), 84, 4, 336, 'without Nesting Dolls none of them fires');
  });

  scenario(15, ['kaleidoscope'], 'Kaleidoscope with a Glitch Encore King: four x1.6 steps on one card', () => {
    const run = blindRun();
    addJ(run, 'kaleidoscope');
    const res = score(run, [mk('KS', { edition: 'fourcolor', seal: 'encore' }), mk('KH')]);
    // KS pass 1: +10 -> 22, x1.6 x1.6 -> 5.12; pass 2: +10 -> 32, x1.6 x1.6 -> 13.1072; KH +10 -> 42.
    // 42 x 13.1072 = 550.5024 -> 550
    expectTotals('kaleidoscope', res, 42, 13.1072, 550, 'Glitch twice on each of two passes');
    assert.equal(res.steps.filter((s) => s.source === 'card' && s.via === 'edition').length, 4, `${label('kaleidoscope')}: four card Edition steps`);
  });

  // ------------------------------------------------------------------ cards added and destroyed
  scenario(16, ['patchworkdoll', 'makeover', 'brazier'], 'Hall of Mirrors: 3 copies (Makeover enhances each, Patchwork Doll +12) and 2 cards destroyed (Brazier x1.4)', () => {
    const run = blindRun();
    const pd = addJ(run, 'patchworkdoll');
    addJ(run, 'makeover');
    const bz = addJ(run, 'brazier');
    const [a] = setHand(run, ['9C']);
    const before = new Set(run.cards.map((c) => c.uid));
    use(run, give(run, 'spectral', 'hallofmirrors'), [a]);
    const added = run.cards.filter((c) => !before.has(c.uid));
    assert.equal(added.length, 3, 'three copies');
    for (const c of added) {
      deq([c.rank, c.suit], [9, 'C'], 'a copy of the 9 of Clubs');
      assert.ok(ENHANCEMENT_IDS.includes(c.enhancement), `${label('makeover')}: each plain copy gets an Enhancement, got ${c.enhancement}`);
    }
    assert.equal(run.cards.length, 53, '52 + 3 copies - 2 destroyed');
    assert.equal(st(run, pd), 12, `${label('patchworkdoll')}: +4 x 3 cards added`);
    assert.ok(approx(st(run, bz), 1.4), `${label('brazier')}: x1 + 0.2 x 2 destroyed = x1.4, got ${st(run, bz)}`);
    // KK: Patchwork Doll +12 -> 44 Chips; Brazier x1.4 -> 2.8 Mult; 44 x 2.8 = 123.2 -> 123
    expectTotals('brazier', score(run, KK()), 44, 2.8, 123, 'Patchwork Doll and Brazier after the mirrors');
  });

  // ------------------------------------------------------------------ consumable slots
  // Balance 2026-11-23 (Jokers, engine fix): Moonstruck acts only when a Boss Blind starts, so this starts one
  // (The Smudge, the neutral Boss).
  scenario(17, ['moonstruck', 'pocketlint', 'stargazer'], 'Moonstruck fills a slot when the Boss Blind starts, switching Pocket Lint off; using the Planet turns it back on and feeds Stargazer', () => {
    const run = mkRun();
    addJ(run, 'moonstruck');
    addJ(run, 'pocketlint');
    const sg = addJ(run, 'stargazer');
    begin(run, { blindIndex: 2, boss: 'smudge' });
    deq(run.consumables.map((c) => c.id), [PLANET_OF.pair], `${label('moonstruck')}: the Pair's Planet card, nothing played yet`);
    // A card is held, so Pocket Lint gives nothing; Stargazer has 0 Planets. KK 64
    expectTotals('pocketlint', score(run, KK()), 32, 2, 64, 'a Planet card in a slot');
    use(run, run.consumables[0].uid);
    assert.equal(run.levels.pair, 2, 'the Pair levelled up');
    assert.equal(st(run, sg), 1, `${label('stargazer')}: one Planet card used`);
    // Pair lv.2: 12 + 16 = 28 Chips, 2 + 1 = 3 Mult; the Kings +20 -> 48; Pocket Lint x1.5 -> 4.5;
    // Stargazer floor(1 / 2) = 0, no step. 48 x 4.5 = 216
    expectTotals('pocketlint', score(run, KK()), 48, 4.5, 216, 'empty slots again, Pair at level 2');
  });

  // ------------------------------------------------------------------ one Shop visit
  scenario(18, ['luckydip', 'packrat', 'bigspender'], 'one Shop visit: Lucky Dip only on the first pack; Pack Rat and Big Spender count both packs, not the reroll', () => {
    const run = mkRun();
    addJ(run, 'luckydip');
    const pr = addJ(run, 'packrat');
    const bs = addJ(run, 'bigspender');
    toShop(run);
    openPack(run, 'cardnormal', 0);
    assert.equal(run.pack.picksLeft, 2, `${label('luckydip')}: the first pack bought, 1 + 1 picks (ASSUMED A11)`);
    pick(run, 0);
    assert.equal(pick(run, 1).closed, true, 'the pack closes after its 2 picks');
    openPack(run, 'cardnormal', 1);
    assert.equal(run.pack.picksLeft, 1, `${label('luckydip')}: the second pack bought in this Shop, 1 pick`);
    ok(Engine.packSkip(run), 'packSkip');
    deq([st(run, pr), st(run, bs)], [2, 1], `${label('packrat')} and ${label('bigspender')}: two packs opened and bought (Big Spender +0.5 each, balance 2026-11-23)`);
    run.money = 20;
    ok(Engine.reroll(run), 'reroll');
    assert.equal(st(run, bs), 1, `${label('bigspender')}: a reroll is not a purchase`);
    assert.equal(run.cards.length, 54, 'two Card Pack picks joined the deck');
  });

  // ------------------------------------------------------------------ caps and discards
  scenario(19, ['emberimp', 'ringmaster'], 'The Lid caps Mult at 12 after Joker Editions and xMult', () => {
    const run = bossRun('lid');
    addJ(run, 'emberimp', 'benday');
    addJ(run, 'ringmaster');
    const res = score(run, KK());
    // Ember Imp: Dither +8 -> 10, +5 -> 15; Ringmaster x1.3 (1 other) -> 19.5; The Lid: 12. 32 x 12 = 384
    expectTotals('ringmaster', res, 32, 12, 384, 'capped after the Jokers');
    const cap = res.steps.find((s) => s.label === 'Capped at 12');
    assert.ok(cap && cap.source === 'boss', "a 'Capped at 12' step from the Boss Blind");
  });

  scenario(20, ['sleightofhand', 'magpie', 'carpetbag', 'chimneysweep'], 'The Fumble adds a card to a 2-card discard: Sleight of Hand still sees 2 (free), Magpie and Chimney Sweep count 3, Carpetbag +1 hand size', () => {
    const run = mkRun();
    addJ(run, 'sleightofhand');
    const m = addJ(run, 'magpie');
    addJ(run, 'carpetbag');
    addJ(run, 'chimneysweep');
    begin(run, { blindIndex: 2, boss: 'fumble' });
    const r = discard(run, run.blind.hand.slice(0, 2));
    assert.ok(r.extra, 'The Fumble dropped an extra card');
    assert.equal(run.blind.discardsLeft, 3, `${label('sleightofhand')}: 2 selected cards, so the discard is free`);
    assert.equal(r[ASSUMED.discardFree], true, `${label('sleightofhand')}: the result says free`);
    assert.equal(run.blind.cardsDiscarded, 3, 'the extra card is a discard in every way');
    assert.equal(st(run, m), 6, `${label('magpie')}: +2 x 3 cards, The Fumble's card included`);
    assert.equal(run.blind.hand.length, 9, `${label('carpetbag')}: 8 + 1 hand size, drawn up`);
    // KK: Magpie +6 -> 38 Chips; Chimney Sweep 3 cards -> +1 (every 2 cards; balance 2026-11-23,
    // engine fix) -> 3 Mult. 38 x 3 = 114
    expectTotals('magpie', score(run, KK()), 38, 3, 114, 'Magpie and Chimney Sweep after the Fumble discard');
  });
});
