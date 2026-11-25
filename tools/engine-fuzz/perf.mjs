// Scoring speed: Engine.scoreCards on 5-card hands with 5 Jokers, copiers and retriggers included.
// Usage: node tools/engine-fuzz/perf.mjs <projectRoot> [--hands=1000] [--budget=2] [--rounds=3]
//
// The rack is the heaviest mix the vocabulary allows on one hand (every card scores 5 to 6 passes):
//   Madame Echo (retrigger every scored card), The Puppet Master (copies Madame Echo on its left and
//   Bookends on its right), Bookends (retrigger the first and last scoring card), Stand-In (copying
//   Madame Echo) and Old Flame (copying The Candle King: x1.25 per scored card), with Editions on
//   three of them. Each hand is 5 random cards with random Enhancements, Editions and Seals (Encore
//   Seals add passes), plus 3 held cards, in a Blind. The run is fixed, so only the hands vary.
// Reports the mean, median and worst time per hand over `hands` hands, for `rounds` rounds (the
// first round includes the JIT warm-up), and the mean for a full Engine.playHand on the same rack.
// A second rack times wild Jacks (Jack of All Trades, Fan Dancer, Merry-Go-Round): Engine.preview
// and Engine.scoreCards on 5, 4 and 3 selected Jacks (added 2026-11-23, engine fix).
// Exit code 1 when the best round's mean, or the wild Jacks' best preview or scoring mean, is over
// `budget` ms.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.slice(name.length + 3)) : def;
};
const HANDS = arg('hands', 1000);
const BUDGET = arg('budget', 2);
const ROUNDS = arg('rounds', 3);

const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'content.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'engine.js'), 'utf8'), ctx);
const E = vm.runInContext('TW.Engine', ctx);
const C = vm.runInContext('TW.Content', ctx);

let s = 20261123;
const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ENH = [null, null, ...C.ENHANCEMENTS.map((e) => e.id)];
const EDS = [null, null, null, ...C.EDITIONS.map((e) => e.id)];
const SEALS = [null, null, 'encore', ...C.SEALS.map((x) => x.id)];
const SUITS = ['S', 'H', 'D', 'C'];

function rack() {
  const run = E.newRun({ seed: 'PERFRACK' });
  run.jokerSlots = 6;
  E.startBlind(run);
  run.blind.target = 1e12; // never cleared, so playHand keeps the Blind going
  run.blind.handsLeft = 1e6;
  const echo = E.addJoker(run, 'madameecho', 0, 'gloss');
  E.addJoker(run, 'puppetmaster', 0, 'fourcolor');
  E.addJoker(run, 'bookends');
  const standin = E.addJoker(run, 'standin', 0, 'benday');
  standin.state.target = echo.uid;
  const flame = E.addJoker(run, 'oldflame');
  flame.state.copy = { id: 'candleking', state: {} };
  return run;
}
const card = (rank, suit) => E.makeCard(rank || 2 + Math.floor(rnd() * 13), suit || pick(SUITS), { enhancement: pick(ENH), edition: pick(EDS), seal: pick(SEALS) });
// Three hands in four score all 5 cards (the slow case): a Flush, a Straight or a Full House.
function hand(i) {
  const kind = i % 4;
  if (kind === 0) { const suit = pick(SUITS); return [2, 5, 8, 11, 13].map((r) => card(r, suit)); }
  if (kind === 1) { const lo = 2 + Math.floor(rnd() * 9); return [0, 1, 2, 3, 4].map((k) => card(lo + k)); }
  if (kind === 2) { const a = 2 + Math.floor(rnd() * 13); const b = a === 14 ? 2 : a + 1; return [card(a), card(a), card(a), card(b), card(b)]; }
  return [card(), card(), card(), card(), card()];
}

const run = rack();
const copies = run.jokers.map((j) => `${j.id}${E.jokerCopies(run, j.uid).length ? ` -> ${E.jokerCopies(run, j.uid).map((c) => c.id).join(' + ')}` : ''}`);
const hands = Array.from({ length: HANDS }, (x, i) => ({ played: hand(i), held: [card(), card(), card()] }));

const rounds = [];
let steps = 0;
let passes = 0;
for (let r = 0; r < ROUNDS; r++) {
  const times = [];
  for (const h of hands) {
    const t0 = performance.now();
    const res = E.scoreCards(run, h.played, h.held);
    times.push(performance.now() - t0);
    if (r === 0) {
      steps += res.steps.length;
      passes += res.steps.filter((x) => x.source === 'card' && x.via === 'rank').length;
    }
  }
  times.sort((a, b) => a - b);
  rounds.push({ meanMs: times.reduce((a, b) => a + b, 0) / times.length, medianMs: times[Math.floor(times.length / 2)], worstMs: times[times.length - 1] });
}

// A full playHand on the same rack: the deal is reset to the same 8 cards before each hand.
const play = rack();
const base = JSON.stringify(play);
let playMs = 0;
for (let i = 0; i < Math.min(HANDS, 300); i++) {
  const p = E.deserialize(base);
  const uids = p.blind.hand.slice(0, 5);
  for (const u of uids) Object.assign(E.getCard(p, u), { enhancement: pick(ENH), edition: pick(EDS), seal: pick(SEALS) });
  const t0 = performance.now();
  const res = E.playHand(p, uids);
  playMs += performance.now() - t0;
  if (!res.ok) throw new Error(`playHand failed: ${res.error}`);
}
playMs /= Math.min(HANDS, 300);

// Wild Jacks (added 2026-11-23, engine fix): with Jack of All Trades every Jack may stand in for any
// rank, and Fan Dancer and Merry-Go-Round widen what detection must try. The full search took 6,188
// classifications for five Jacks (about 15 ms per Engine.preview on this machine); the engine now tries
// only the ranks that can matter. Each case selects 3 to 5 Jacks from an 8-card Blind hand and times
// Engine.preview (what every selection change costs) and Engine.scoreCards on the same cards.
function wildRack() {
  const w = E.newRun({ seed: 'PERFJACK' });
  E.startBlind(w);
  w.blind.target = 1e12;
  for (const id of ['jackofalltrades', 'fandancer', 'merrygoround']) E.addJoker(w, id);
  return w;
}
const wild = wildRack();
const WILD_CASES = [
  ['5 Jacks', [11, 11, 11, 11, 11]],
  ['4 Jacks + 1', [11, 11, 11, 11, 0]],
  ['3 Jacks + 2', [11, 11, 11, 0, 0]],
];
const wildTimes = { preview: [], score: [] };
const wildCases = [];
for (let r = 0; r < ROUNDS; r++) {
  const pv = [], sc = [];
  for (let i = 0; i < Math.min(HANDS, 400); i++) {
    const [, ranks] = WILD_CASES[i % WILD_CASES.length];
    const uids = wild.blind.hand.slice(0, 5);
    ranks.forEach((rk, k) => Object.assign(E.getCard(wild, uids[k]), { rank: rk || 2 + Math.floor(rnd() * 13), suit: pick(SUITS), enhancement: null, edition: null, seal: null }));
    let t0 = performance.now();
    const p = E.preview(wild, uids);
    pv.push(performance.now() - t0);
    const cards = uids.map((u) => E.getCard(wild, u));
    t0 = performance.now();
    const res = E.scoreCards(wild, cards, []);
    sc.push(performance.now() - t0);
    if (r === 0 && i < WILD_CASES.length) wildCases.push(`${WILD_CASES[i][0]}: ${p && p.handId} / ${res.handId}`);
    if (!p || p.handId !== res.handId) throw new Error(`preview and scoreCards disagree on ${cards.map((c) => c.rank + c.suit).join(' ')}`);
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  wildTimes.preview.push({ mean: mean(pv), worst: Math.max(...pv) });
  wildTimes.score.push({ mean: mean(sc), worst: Math.max(...sc) });
}
const wildPreview = Math.min(...wildTimes.preview.map((x) => x.mean));
const wildScore = Math.min(...wildTimes.score.map((x) => x.mean));

const best = Math.min(...rounds.map((r) => r.meanMs));
const fmt = (n) => Number(n.toFixed(4));
const ok = best < BUDGET && wildPreview < BUDGET && wildScore < BUDGET;
console.log(JSON.stringify({
  rack: copies,
  hands: HANDS,
  avgStepsPerHand: fmt(steps / HANDS),
  avgCardPassesPerHand: fmt(passes / HANDS),
  rounds: rounds.map((r) => ({ meanMs: fmt(r.meanMs), medianMs: fmt(r.medianMs), worstMs: fmt(r.worstMs) })),
  bestMeanMs: fmt(best),
  playHandMeanMs: fmt(playMs),
  wildJacks: {
    rack: wild.jokers.map((j) => j.id),
    cases: wildCases,
    previewBestMeanMs: fmt(wildPreview),
    scoreBestMeanMs: fmt(wildScore),
    previewWorstMs: fmt(Math.min(...wildTimes.preview.map((x) => x.worst))),
    scoreWorstMs: fmt(Math.min(...wildTimes.score.map((x) => x.worst))),
  },
  budgetMs: BUDGET,
  ok,
}, null, 1));
if (!ok) process.exitCode = 1;
