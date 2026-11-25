// Probes engine edge cases against the design. Usage: node probe.mjs <projectRoot>
import vm from 'node:vm';
import fs from 'node:fs';
const ROOT = process.argv[2];
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(ROOT + '/src/content.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(ROOT + '/src/engine.js', 'utf8'), ctx);
const E = vm.runInContext('TW.Engine', ctx);
const C = vm.runInContext('TW.Content', ctx);
E.debug = true;
const J = (x) => JSON.parse(JSON.stringify(x));
const show = (label, x) => console.log(label, JSON.stringify(x));

function blindRun(opts, bossId) {
  const run = E.newRun(Object.assign({ seed: 'PROBE' }, opts || {}));
  if (bossId) { run.blindIndex = 2; run.bosses[1] = bossId; }
  E.startBlind(run);
  return run;
}
function setHand(run, specs) {
  // replace the hand's cards with given rank/suit/extra
  const uids = run.blind.hand.slice(0, specs.length);
  specs.forEach((s, i) => Object.assign(E.getCard(run, uids[i]), { enhancement: null, edition: null, seal: null, grow: 0 }, s));
  return uids;
}

// 1. Held Encore + Spotlit: two passes
{
  const run = blindRun();
  const u = setHand(run, [{ rank: 14, suit: 'S' }, { rank: 3, suit: 'H', enhancement: 'spotlit', seal: 'encore' }]);
  const r = E.playHand(run, [u[0]]);
  show('1 held encore spotlit steps', r.result.steps.map((s) => [s.source, s.label, s.via]));
}
// 2. Heckler boos a Cameo card when it is the highest
{
  const run = blindRun({}, 'heckler');
  const u = setHand(run, [{ rank: 5, suit: 'S' }, { rank: 5, suit: 'H' }, { rank: 13, suit: 'D', seal: 'cameo' }]);
  const r = E.playHand(run, u);
  show('2 heckler cameo', { booed: r.result.booedUid === u[2], steps: r.result.steps.map((s) => [s.source, s.label]) });
}
// 3. Lid cap then Grudge
{
  const run = blindRun({}, 'lid');
  E.addJoker(run, 'jinglejester');
  const u = setHand(run, [{ rank: 5, suit: 'S', enhancement: 'punchy' }, { rank: 5, suit: 'H', enhancement: 'punchy' }]);
  const r = E.playHand(run, u);
  show('3 lid', r.result.steps.slice(-3).map((s) => [s.label, s.runningMult]));
}
// 4. Mint condition sell values
{
  const run = E.newRun({ seed: 'MINT', deckId: 'mintcondition' });
  const a = E.addJoker(run, 'bigtop'); // free, cost 8
  const b = E.addJoker(run, 'jinglejester', 3); // paid 3 (discount), cost 4
  show('4 mint sell', [E.jokerSellValue(run, a.uid), E.jokerSellValue(run, b.uid)]);
}
// 5. Pack hand with pending handSizeDelta
{
  const run = E.newRun({ seed: 'PK' });
  run.pending.handSizeDelta = -1;
  E.startBlind(run);
  show('5 hand size after pending -1', [run.blind.hand.length, E.handSizeNow(run)]);
}
// 6. Apparition from a pack when hands planned = 1
{
  const run = E.newRun({ seed: 'APP' });
  run.hands = 1;
  run.phase = 'shop'; run.shop = { items: [{ slot: 'pack', kind: 'pack', id: 'ghostnormal', price: 0, sold: false, edition: null, size: 'normal' }], rerollCost: 5, rerolls: 0, freeRerolls: 0, discount: 0 };
  E.buy(run, 0);
  run.pack.options[0] = { kind: 'spectral', id: 'apparition', picked: false };
  show('6 apparition from pack, hands=1', E.canPackPick(run, 0, [run.pack.hand[0]]));
}
// 7. Planet pack hand field
{
  const run = E.newRun({ seed: 'PL' });
  run.phase = 'shop'; run.shop = { items: [{ slot: 'pack', kind: 'pack', id: 'planetnormal', price: 0, sold: false, edition: null, size: 'normal' }], rerollCost: 5, rerolls: 0, freeRerolls: 0, discount: 0 };
  E.buy(run, 0);
  show('7 planet pack hand/draw', [run.pack.hand, run.pack.draw]);
}
// 8. Discard with Sleight of Hand (v2 Fishhook) when discardsLeft = 0
{
  const run = blindRun();
  E.addJoker(run, 'sleightofhand');
  run.blind.discardsLeft = 0;
  show('8 sleight of hand, discards 0', E.canDiscard(run, [run.blind.hand[0]]));
}
// 9. Sleight of Hand: a discard of 1 card is free, discardsLeft stays
{
  const run = blindRun();
  E.addJoker(run, 'sleightofhand');
  const d0 = run.blind.discardsLeft;
  const r = E.discard(run, [run.blind.hand[0]]);
  show('9 sleight of hand', [r.free, d0, run.blind.discardsLeft]);
}
// 10. The Censor and the Inverted card rank, Encore retrigger
{
  const run = blindRun({}, 'censor');
  const u = setHand(run, [{ rank: 13, suit: 'S', edition: 'inverted', seal: 'encore' }]);
  const r = E.playHand(run, [u[0]]);
  show('10 censor', r.result.steps.map((s) => [s.label, s.via]));
}
// 11. Wash-Out: Scribbled not any suit; Vintage no growth; Crumpled no money
{
  const run = blindRun({}, 'washout');
  const u = setHand(run, [{ rank: 13, suit: 'S', enhancement: 'vintage' }]);
  const r = E.playHand(run, [u[0]]);
  show('11 washout vintage', [r.result.grow, r.result.steps.map((s) => s.label)]);
}
// 12. Wet Blanket + Gloss Joker
{
  const run = E.newRun({ seed: 'WET' });
  E.addJoker(run, 'jinglejester', 0, 'gloss');
  E.addJoker(run, 'pipsqueak', 0, 'benday');
  run.blindIndex = 2; run.bosses[1] = 'wetblanket';
  E.startBlind(run);
  const u = setHand(run, [{ rank: 13, suit: 'S' }]);
  const r = E.playHand(run, [u[0]]);
  show('12 wet blanket', r.result.steps.map((s) => [s.source, s.label, s.via]));
}
// 13. Card pack options: card uid consumption
{
  const run = E.newRun({ seed: 'CP' });
  const before = run.nextUid;
  run.phase = 'shop'; run.shop = { items: [{ slot: 'pack', kind: 'pack', id: 'cardnormal', price: 0, sold: false, edition: null, size: 'normal' }], rerollCost: 5, rerolls: 0, freeRerolls: 0, discount: 0 };
  E.buy(run, 0);
  show('13 card pack option uids', [before, run.pack.options.map((o) => o.card.uid)]);
}
// 14. Sale tag + dollar off on a Joker priced $4 with gloss ($6): round(6*0.75)=4.5->5, -1 -> 4
{
  const run = E.newRun({ seed: 'SALE' });
  run.vouchers.push('dollaroff');
  run.pending.sale = true;
  run.phase = 'cashout'; run.cashout = { lines: [], total: 0 }; run.blind = { index: 0 };
  E.collect(run);
  show('14 shop prices', run.shop.items.map((i) => [i.kind, i.id, i.edition, i.price]), run.shop.freeRerolls);
}
// 15. Reroll counts
{
  const run = E.newRun({ seed: 'RR' });
  run.vouchers.push('secondlook');
  run.phase = 'cashout'; run.cashout = { lines: [], total: 0 }; run.blind = { index: 0 };
  E.collect(run);
  run.money = 50;
  const a = E.reroll(run), b = E.reroll(run), c = E.reroll(run);
  show('15 rerolls', [a.cost, b.cost, c.cost, run.shop.rerollCost]);
}
// 16. Graveyard Shift in a pack hand with 2 cards
{
  const run = E.newRun({ seed: 'GY' });
  run.phase = 'shop'; run.shop = { items: [{ slot: 'pack', kind: 'pack', id: 'ghostnormal', price: 0, sold: false, edition: null, size: 'normal' }], rerollCost: 5, rerolls: 0, freeRerolls: 0, discount: 0 };
  E.buy(run, 0);
  run.pack.options[0] = { kind: 'spectral', id: 'graveyardshift', picked: false };
  const r = E.packPick(run, 0, []);
  show('16 graveyard in pack', [r.ok, r.effect && r.effect.destroyed, r.effect && r.effect.created, run.cards.length]);
}
// 17. Overtime from a slot at Blind select: next Blind
{
  const run = E.newRun({ seed: 'OT' });
  run.consumables.push({ uid: 'k999', kind: 'tarot', id: 'overtime' });
  show('17 overtime at blind select', E.useConsumable(run, 'k999', []));
}
// 18. Paper Route at ante 8 -> min(10, 3+8)=10
{
  const run = E.newRun({ seed: 'PR' });
  run.ante = 8;
  run.consumables.push({ uid: 'k998', kind: 'tarot', id: 'paperroute' });
  show('18 paper route ante 8', E.useConsumable(run, 'k998', []).effect);
}
// 19. Haunted Press with [gloss A, plain B, plain C]
{
  const run = E.newRun({ seed: 'HP' });
  const a = E.addJoker(run, 'jinglejester', 0, 'gloss'); const b = E.addJoker(run, 'pipsqueak'); const c = E.addJoker(run, 'emptyseats');
  run.consumables.push({ uid: 'k997', kind: 'spectral', id: 'hauntedpress' });
  const r = E.useConsumable(run, 'k997', []);
  show('19 haunted press', [r.effect, run.jokers.map((j) => [j.id, j.edition])]);
}
// 20. Stats and records after a forced win
{
  const run = E.newRun({ seed: 'WIN' });
  run.ante = 8; run.blindIndex = 2;
  E.startBlind(run);
  run.blind.score = run.blind.target;
  const r = E.playHand(run, [run.blind.hand[0]]);
  show('20 win', [r.won, run.phase, run.cashout && run.cashout.total]);
  const rec = E.applyRunToRecords(E.defaultRecords(), run, { final: true, now: 'x' });
  show('20 unlocked', rec.unlocked);
  show('20 endless', [E.goEndless(run), run.phase]);
}
