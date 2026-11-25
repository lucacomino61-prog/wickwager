// Checks the Joker vocabulary against the design: every `engine` row of the 120 Jokers in
// content/content-plan.json must pass Engine.jokerProblems, and every word a row declares in
// `needs` must be in Engine.VOCABULARY. Then the 120 plan rows are loaded into the real engine (in
// place of src/content.js's table, which holds the same rows) and each is added to a run, scored on a few hands, and walked through
// a Blind, a sale and a Shop with Engine.debug on, so a row that crashes the engine shows up.
// Usage: node vocab-check.mjs <projectRoot>   (exit code 1 on any problem)
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'content-plan.json'), 'utf8'));
const rows = plan.jokers.map((j) => ({ id: j.id, name: j.name, rarity: j.rarity, cost: j.cost, text: j.text, ...j.engine }));
const load = (swap) => {
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'content.js'), 'utf8'), ctx);
  if (swap) {
    ctx.__rows = JSON.stringify(rows);
    vm.runInContext('(() => { const l = JSON.parse(__rows); for (const r of l) Object.defineProperty(l, r.id, { value: r, enumerable: false, configurable: true, writable: true }); TW.Content.JOKERS = l; })();', ctx);
  }
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'engine.js'), 'utf8'), ctx);
  return vm.runInContext('TW.Engine', ctx);
};
const problems = [];

// 1. jokerProblems on every plan row, and every declared need is a known word.
const E = load(false);
const V = E.VOCABULARY;
const KIND = { condition: V.conditions, counter: V.counters, event: V.events, eventOp: V.eventOps, setter: V.setters, rule: V.rules, amount: V.amounts || [] };
const needs = new Set();
for (const j of plan.jokers) {
  const row = rows.find((r) => r.id === j.id);
  for (const p of E.jokerProblems(row)) problems.push(`${j.id}: ${p}`);
  for (const n of j.needs) {
    needs.add(n);
    const [kind, word] = n.split(' ');
    if (!KIND[kind] || !KIND[kind].includes(word)) problems.push(`${j.id}: need '${n}' is not in Engine.VOCABULARY`);
  }
}

// 2. Every row in the real engine: add, score, play a Blind, sell, Shop (debug on: errors throw).
const X = load(true);
X.debug = true;
const hands = [[[13, 'S'], [13, 'H']], [[11, 'S'], [11, 'H'], [11, 'D']], [[5, 'S'], [6, 'S'], [7, 'S'], [8, 'S'], [9, 'H']], [[14, 'D'], [2, 'D'], [3, 'D'], [4, 'D'], [7, 'D']]];
let exercised = 0;
for (const row of rows) {
  try {
    const run = X.newRun({ seed: 'VCHK' + row.id.toUpperCase().slice(0, 4) });
    run.jokerSlots = 8;
    X.addJoker(run, 'tindrum');
    const j = X.addJoker(run, row.id, 0, null);
    X.addJoker(run, 'standin');
    X.addJoker(run, 'oldflame');
    if (!j) throw new Error('addJoker returned null');
    if (!X.startBlind(run).ok) throw new Error('startBlind failed');
    for (const h of hands) {
      const r = X.scoreCards(run, h.map(([rank, suit]) => X.makeCard(rank, suit)), run.blind.hand.slice(0, 3).map((u) => X.getCard(run, u)));
      if (!r || !Array.isArray(r.steps) || !Number.isFinite(r.total)) throw new Error('scoreCards gave no result');
    }
    X.jokerText(run, j.uid);
    X.discard(run, run.blind.hand.slice(0, 2));
    X.playHand(run, run.blind.hand.slice(0, 2));
    if (run.phase === 'play') {
      run.blind.score = run.blind.target;
      X.playHand(run, run.blind.hand.slice(0, 1));
    }
    if (run.phase === 'cashout') X.collect(run);
    if (run.phase === 'shop') {
      run.money = 50;
      X.reroll(run);
      X.sellJoker(run, j.uid);
      X.buy(run, run.shop.items.findIndex((it) => it.kind === 'pack'));
    }
    if (!X.deserialize(X.serialize(run))) throw new Error('the run does not round-trip');
    exercised += 1;
  } catch (err) {
    problems.push(`${row.id}: ${err && err.message}`);
  }
}

console.log(`${plan.jokers.length} plan rows checked by jokerProblems; ${needs.size} declared needs, all in Engine.VOCABULARY unless listed below; ${exercised} rows exercised in the real engine.`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exitCode = 1;
} else console.log('OK: no problems.');
