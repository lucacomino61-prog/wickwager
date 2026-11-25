// Random-play stress test of the engine (rewritten 2026-11-23 for the 120 Jokers, engine reconcile).
//
// Usage: node tools/engine-fuzz/fuzz.mjs <projectRoot> [seed] [options]
//   [seed]          one fuzz seed (instead of --seeds)
//   --seeds=1,2,..  the fuzz seeds (default 1,2,3,4,5,6); each seed plays --games games
//   --games=N       games per seed (default 400)            --steps=N  actions per game at most (default 400)
//   --set=N         every game starts with N distinct random Jokers from all 120 (default 5; Legendary
//                   Jokers through the Engine.addJoker test hook; a copier in most games), with Editions
//   --plan          load the plan's own rows (content/content-plan.json `engine`) instead of src/content.js's
//   --jobs=N        worker threads (default min(seeds, cpus - 1)); --jobs=0 runs in this thread, no watchdog
//   --box=MS        the time box of one engine call (default 50): a call over it is re-run from its
//                   snapshot twice, and is a failure if every run is over the box
//   --hard=MS       the watchdog: a call still running after MS (default 1000) is a hang; the worker is
//                   stopped and the game, step and call are reported
//   --corrupt=N     malformed-run trials per seed with Engine.debug off (default 300): nothing may throw
//   --only=G        play only game G of each seed (to reproduce a failure)    --json  print JSON only
//
// Every game: a random Deck and Stake, random Boss Blinds (any of the 15, at any Ante, half the games),
// a random Joker set, random Enhancements, Editions and Seals on deck cards, then random actions with
// Engine.debug on (an internal error throws): Blinds, hands, discards, consumables, the Shop, packs,
// selling, reordering, Endless mode, plus ~3% calls with bad arguments. After every call it checks:
//  - a failed action returns a §4.4 sentence and leaves the run exactly as it was; can* agree with the action;
//  - queries never change the run; scoreCards equals the score playHand reports;
//  - the step trace adds up (§2.4, §4.3): running values, total = floor(Chips x Mult), step money;
//  - card piles (hand, draw and discard pile, or the pack's hand and draw, are the deck, no card twice),
//    Joker and consumable slots, money (a whole number >= 0), unique uids below nextUid, known ids,
//    Stand-In targets and Old Flame copies, Blind counters;
//  - the run round-trips through serialize/deserialize unchanged;
// and after the game it replays the whole log in a second engine instance (with other module state), swapping
// in the first instance's JSON snapshot halfway: every state and result must be identical (deterministic
// replay, and the JSON holds the whole run). Exit code 1 on any failure.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ACTIONS = ['newRun', 'startBlind', 'skipBlind', 'playHand', 'discard', 'useConsumable', 'sellJoker', 'sellConsumable', 'setSort', 'reorderHand', 'reorderJokers', 'collect', 'buy', 'reroll', 'packPick', 'packSkip', 'leaveShop', 'goEndless', 'addJoker'];
const QUERIES = ['getCard', 'blindsForAnte', 'currentBlindInfo', 'preview', 'scoreCards', 'handTable', 'deckView', 'jokerText', 'jokerSellValue', 'jokerSlotsUsed', 'jokerCopies', 'consumableInfo', 'consumableSellValue', 'canUseConsumable', 'canBuy', 'canPackPick', 'canPlay', 'canDiscard', 'canSell', 'interestPreview', 'rerollCost', 'handSizeNow', 'blindTarget', 'cardText', 'stats'];
const CALLS = [...ACTIONS, ...QUERIES, 'serialize', 'deserialize', 'perturb'];
const STEP_FIELDS = ['source', 'uid', 'cardUid', 'kind', 'amount', 'label', 'via', 'enhancement', 'edition', 'seal', 'jokerUid', 'copyOf', 'jokerName', 'runningChips', 'runningMult'];
const PHASES = ['blind-select', 'play', 'cashout', 'shop', 'pack', 'win', 'gameover'];

function options(argv) {
  const val = (n, d) => {
    const a = argv.find((x) => x.startsWith(`--${n}=`));
    return a ? a.slice(n.length + 3) : d;
  };
  const positional = argv.slice(3).find((a) => !a.startsWith('--'));
  const seeds = positional != null ? [Number(positional) >>> 0] : String(val('seeds', '1,2,3,4,5,6')).split(',').map((x) => Number(x) >>> 0);
  return {
    root: path.resolve(argv[2] || '.'),
    seeds,
    games: Number(val('games', 400)),
    steps: Number(val('steps', 400)),
    set: Number(val('set', 5)),
    plan: argv.includes('--plan'),
    jobs: Number(val('jobs', Math.max(1, Math.min(seeds.length, os.cpus().length - 1)))),
    box: Number(val('box', 50)),
    hard: Number(val('hard', 1000)),
    corrupt: Number(val('corrupt', 300)),
    only: val('only', null) == null ? null : Number(val('only', 0)),
    json: argv.includes('--json'),
  };
}

// ------------------------------------------------------------------------------------------------ main thread
async function main() {
  const o = options(process.argv);
  const t0 = Date.now();
  const results = [];
  if (o.jobs === 0) {
    for (const seed of o.seeds) results.push(runSeed(o, seed, null, (m) => !o.json && console.error(m)));
  } else {
    await new Promise((resolve) => {
      const queue = o.seeds.slice();
      const running = new Set();
      const timer = setInterval(() => {
        const now = performance.timeOrigin + performance.now();
        for (const job of running) {
          const start = job.f[0];
          if (!job.hung && start > 0 && now - start > o.hard) {
            job.hung = true;
            results.push({ seed: job.seed, failures: [{ kind: 'hang', game: job.i[0], step: job.i[1], call: CALLS[job.i[2]] || '?', ms: Math.round(now - start) }] });
            job.w.terminate();
          }
        }
      }, 5);
      const launch = () => {
        while (running.size < o.jobs && queue.length) {
          const seed = queue.shift();
          const sab = new SharedArrayBuffer(32);
          const job = { seed, f: new Float64Array(sab, 0, 1), i: new Int32Array(sab, 8, 4), done: false, hung: false };
          job.w = new Worker(fileURLToPath(import.meta.url), { workerData: { o, seed, sab } });
          running.add(job);
          job.w.on('message', (m) => {
            if (m.type === 'result') {
              job.done = true;
              results.push(m.result);
            } else if (!o.json) console.error(m.msg);
          });
          job.w.on('error', (err) => {
            job.done = true;
            results.push({ seed, failures: [{ kind: 'worker', error: String((err && err.stack) || err) }] });
          });
          job.w.on('exit', () => {
            running.delete(job);
            if (!job.done && !job.hung) results.push({ seed, failures: [{ kind: 'worker', error: 'the worker stopped without a result' }] });
            launch();
            if (!running.size && !queue.length) {
              clearInterval(timer);
              resolve();
            }
          });
        }
      };
      launch();
    });
  }
  results.sort((a, b) => o.seeds.indexOf(a.seed) - o.seeds.indexOf(b.seed));
  const failures = results.flatMap((r) => (r.failures || []).map((f) => Object.assign({ seed: r.seed }, f)));
  const sum = (k) => results.reduce((s, r) => s + (r[k] || 0), 0);
  const merge = (k) => results.reduce((m, r) => { for (const [x, n] of Object.entries(r[k] || {})) m[x] = (m[x] || 0) + n; return m; }, {});
  const timing = results.reduce((m, r) => { for (const [x, t] of Object.entries(r.timing || {})) { const c = (m[x] = m[x] || { calls: 0, totalMs: 0, maxMs: 0, overBox: 0 }); c.calls += t.calls; c.totalMs += t.totalMs; c.maxMs = Math.max(c.maxMs, t.maxMs); c.overBox += t.overBox; } return m; }, {});
  const hist = results.reduce((h, r) => { (r.hist || []).forEach((n, i) => { h[i] += n; }); return h; }, new Array(HIST).fill(0));
  const slow = (names) => Object.fromEntries(Object.entries(timing).filter(([k]) => names.includes(k)).sort((a, b) => b[1].maxMs - a[1].maxMs).slice(0, 5)
    .map(([k, t]) => [k, { calls: t.calls, meanMs: +(t.totalMs / t.calls).toFixed(3), maxMs: +t.maxMs.toFixed(2), overBox: t.overBox }]));
  const summary = {
    plan: o.plan, seeds: o.seeds, gamesPerSeed: o.games, set: o.set, box: o.box, hard: o.hard,
    games: sum('games'), actions: sum('actions'), calls: sum('calls'), badCalls: sum('badCalls'), failedActions: sum('failedActions'),
    checks: sum('checks'), replayedSteps: sum('replayedSteps'), snapshotsResumed: sum('snapshotsResumed'), corruptTrials: sum('corruptTrials'), corruptCalls: sum('corruptCalls'),
    wins: sum('wins'), losses: sum('losses'), maxAnte: Math.max(0, ...results.map((r) => r.maxAnte || 0)), hands: sum('hands'), jokerEvents: sum('jokerEvents'),
    jokersSeen: new Set(results.flatMap((r) => r.jokersSeen || [])).size, copierGames: sum('copierGames'), legendaryGames: sum('legendaryGames'),
    bossesSeen: new Set(results.flatMap((r) => r.bossesSeen || [])).size, cardEditionsScored: merge('cardEditions'), sealsScored: merge('seals'), jokerEditions: merge('jokerEditions'),
    paidSealLines: sum('paidSealLines'), cometPlanets: sum('cometPlanets'),
    ops: merge('ops'),
    actionMs: { p50: percentile(hist, 0.5), p99: percentile(hist, 0.99), p999: percentile(hist, 0.999), max: +Math.max(0, ...Object.entries(timing).filter(([k]) => ACTIONS.includes(k)).map(([, t]) => t.maxMs)).toFixed(2) },
    slowestActions: slow(ACTIONS),
    slowestQueries: slow(QUERIES),
    retried: sum('retried'),
    seconds: Math.round((Date.now() - t0) / 1000),
    failures: failures.length,
  };
  console.log(JSON.stringify(summary, null, o.json ? 0 : 1));
  if (failures.length) {
    console.log(JSON.stringify(failures.slice(0, 25), null, 1));
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------------------------------------------ one seed
function load(o, noise) {
  const read = (p) => fs.readFileSync(path.join(o.root, p), 'utf8');
  const ctx = vm.createContext({ console });
  vm.runInContext(read('src/content.js'), ctx, { filename: 'content.js' });
  if (o.plan) {
    const plan = JSON.parse(read('content/content-plan.json'));
    ctx.__rows = JSON.stringify(plan.jokers.map((j) => ({ id: j.id, name: j.name, rarity: j.rarity, cost: j.cost, text: j.text, ...j.engine })));
    vm.runInContext('(() => { const l = JSON.parse(__rows); for (const r of l) Object.defineProperty(l, r.id, { value: r, enumerable: false, configurable: true, writable: true }); TW.Content.JOKERS = l; })();', ctx);
  }
  vm.runInContext(read('src/engine.js'), ctx, { filename: 'engine.js' });
  const E = vm.runInContext('TW.Engine', ctx);
  const C = vm.runInContext('TW.Content', ctx);
  E.debug = true;
  if (noise) {
    // other module state than the first instance: loose cards and a throwaway game
    for (let i = 0; i < 3 + (noise % 29); i++) E.makeCard(2, 'S');
    const r = E.newRun({ seed: `NOISE${noise}` });
    E.startBlind(r);
    E.discard(r, r.blind.hand.slice(0, 2));
    E.playHand(r, r.blind.hand.slice(0, 3));
  }
  return { E, C };
}

function specSentences(root, C) {
  const spec = fs.readFileSync(path.join(root, 'SPEC.md'), 'utf8');
  const sec = spec.slice(spec.indexOf('### 4.4'), spec.indexOf('## 5.'));
  const set = new Set([...sec.matchAll(/"([^"]+?[.!])"/g)].map((m) => m[1]));
  for (const b of C.BOSSES) {
    if (b.maxPlay) set.add(`${b.name}: play at most ${b.maxPlay} cards.`);
    if (b.discardCost) set.add(`${b.name}: each discard costs $${b.discardCost}.`);
  }
  return set;
}

const sha = (s) => crypto.createHash('sha1').update(s).digest('base64');
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const PAUSE = new Int32Array(new SharedArrayBuffer(4));
const HIST_STEP = 0.025; // action times, in 0.025 ms buckets up to 50 ms (the last bucket holds the rest)
const HIST = 2001;
const percentile = (hist, p) => {
  const total = hist.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < hist.length; i++) if ((acc += hist[i]) >= total * p) return +((i + 1) * HIST_STEP).toFixed(3);
  return null;
};

function runSeed(o, seed, beat, progress) {
  const A = load(o, 0);
  const B = load(o, seed + 1);
  const { C } = A;
  const KNOWN = specSentences(o.root, C);
  const JOKER_IDS = C.JOKERS.map((j) => j.id);
  const COPIERS = C.JOKERS.filter((j) => j.rules && j.rules.copy).map((j) => j.id);
  const LEGENDARY = C.JOKERS.filter((j) => j.rarity === 'legendary').map((j) => j.id);
  const BOSSES = C.BOSSES.map((b) => b.id);
  const ENH = C.ENHANCEMENTS.map((e) => e.id);
  const EDS = C.EDITIONS.map((e) => e.id);
  const SEALS = C.SEALS.map((s) => s.id);
  const CONS = [...C.TAROTS.map((t) => ['tarot', t.id]), ...C.PLANETS.map((t) => ['planet', t.id]), ...C.SPECTRALS.map((t) => ['spectral', t.id])];
  const KNOWN_CONS = new Set(CONS.map(([k, id]) => `${k}:${id}`));
  const DISC = { jokers: new Set(JOKER_IDS), consumables: new Set(CONS.map((c) => c[1])), bosses: new Set(BOSSES), vouchers: new Set(C.VOUCHERS.map((v) => v.id)), tags: new Set(C.TAGS.map((t) => t.id)) };

  const out = {
    seed, games: 0, actions: 0, calls: 0, badCalls: 0, failedActions: 0, checks: 0, replayedSteps: 0, snapshotsResumed: 0, corruptTrials: 0, corruptCalls: 0,
    wins: 0, losses: 0, maxAnte: 0, hands: 0, jokerEvents: 0, copierGames: 0, legendaryGames: 0, retried: 0, paidSealLines: 0, cometPlanets: 0,
    ops: {}, cardEditions: {}, seals: {}, jokerEditions: {}, timing: {}, failures: [], hist: new Array(HIST).fill(0),
  };
  const jokersSeen = new Set();
  const bossesSeen = new Set();

  // fuzz RNG (the harness's own; the engine only uses its seeded run.rng)
  let s = 1;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const pickA = (a) => a[Math.floor(rnd() * a.length)];
  const shuffled = (a) => a.map((x) => [rnd(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  const subset = (a, p, max) => a.filter(() => rnd() < p).slice(0, max);

  let game = 0;
  let step = 0;
  // Runs fn as engine call `name`, timed, under the watchdog's heartbeat.
  function timed(name, fn) {
    const t0 = performance.now();
    if (beat) {
      beat.i[0] = game;
      beat.i[1] = step;
      beat.i[2] = CALLS.indexOf(name);
      beat.f[0] = performance.timeOrigin + t0;
    }
    let ms = 0;
    try {
      return fn();
    } finally {
      ms = performance.now() - t0;
      if (beat) beat.f[0] = 0;
      const t = (out.timing[name] = out.timing[name] || { calls: 0, totalMs: 0, maxMs: 0, overBox: 0 });
      t.calls += 1;
      t.totalMs += ms;
      if (ms > t.maxMs) t.maxMs = ms;
      if (ms > o.box) t.overBox += 1;
      timed.last = ms;
    }
  }

  // ---------------------------------------------------------------- applying one log entry
  // { e: name, a: [args] } calls Engine[name](run, ...args) ({ e:'newRun', a:[opts] } makes the run);
  // { p: kind, ... } is a change the harness makes to the run's data (a test setup, like the tests do).
  function apply(X, run, entry) {
    if (entry.e === 'newRun') return { run: X.E.newRun(...structuredClone(entry.a)), res: null };
    if (entry.e) return { run, res: X.E[entry.e](run, ...structuredClone(entry.a)) };
    switch (entry.p) {
      case 'giveConsumable': run.consumables.push({ uid: 'k' + run.nextUid++, kind: entry.kind, id: entry.id }); break;
      case 'decorate': for (const [uid, enh, ed, seal] of entry.list) { const c = run.cards.find((x) => x.uid === uid); if (c) Object.assign(c, { enhancement: enh, edition: ed, seal }); } break;
      case 'money': run.money += entry.n; break;
      case 'score': if (run.blind) run.blind.score += entry.n; break;
      case 'bosses': Object.assign(run.bosses, entry.map); break;
      case 'jokerSlots': run.jokerSlots = entry.n; break;
      case 'blindIndex': run.blindIndex = entry.i; break;
      default: throw new Error(`unknown entry ${JSON.stringify(entry)}`);
    }
    return { run, res: null };
  }

  // ---------------------------------------------------------------- invariants
  const fails = [];
  const failNow = (kind, detail, entry) => fails.push({ kind, game, step, entry: entry ? JSON.stringify(entry).slice(0, 300) : null, detail: String(detail).slice(0, 600) });
  function uidsOK(run) {
    const all = [...run.cards.map((c) => c.uid), ...run.jokers.map((j) => j.uid), ...run.consumables.map((k) => k.uid)];
    if (new Set(all).size !== all.length) return 'a uid is used twice';
    for (const u of all) {
      if (typeof u !== 'string' || !/^[chk]\d+$/.test(u)) return `bad uid ${u}`;
      if (Number(u.slice(1)) >= run.nextUid) return `uid ${u} is not below nextUid ${run.nextUid}`;
    }
    for (const c of run.cards) if (c.uid[0] !== 'c') return `card uid ${c.uid}`;
    for (const j of run.jokers) if (j.uid[0] !== 'h') return `Joker uid ${j.uid}`;
    for (const k of run.consumables) if (k.uid[0] !== 'k') return `consumable uid ${k.uid}`;
    return null;
  }
  function partition(piles, deck, what) {
    const all = [].concat(...piles);
    if (new Set(all).size !== all.length) return `${what}: a card is in two piles`;
    const ids = new Set(deck);
    for (const u of all) if (!ids.has(u)) return `${what}: ${u} is not in the deck`;
    if (all.length !== deck.length) return `${what}: ${all.length} cards in the piles, ${deck.length} in the deck`;
    return null;
  }
  function state(run) {
    const E = A.E;
    const errs = [];
    const add = (e) => e && errs.push(e);
    if (!PHASES.includes(run.phase)) add(`phase ${run.phase}`);
    if (run.phase === 'play' && !run.blind) add('play without a Blind');
    if (run.phase === 'shop' && !run.shop) add('shop without a Shop');
    if (run.phase === 'pack' && !run.pack) add('pack phase without a pack');
    if ((run.phase === 'cashout' || run.phase === 'win') && !run.cashout) add(`${run.phase} without a cash-out`);
    if (!Number.isInteger(run.money) || run.money < 0) add(`money ${run.money}`);
    if (E.jokerSlotsUsed(run) > run.jokerSlots) add(`Joker slots ${E.jokerSlotsUsed(run)}/${run.jokerSlots}`);
    if (run.consumables.length > run.consumableSlots) add(`consumables ${run.consumables.length}/${run.consumableSlots}`);
    add(uidsOK(run));
    const deck = run.cards.map((c) => c.uid);
    for (const c of run.cards) {
      if (!(Number.isInteger(c.rank) && c.rank >= 2 && c.rank <= 14) || !['S', 'H', 'D', 'C'].includes(c.suit)) add(`card ${c.uid} ${c.rank}${c.suit}`);
      if ((c.enhancement && !ENH.includes(c.enhancement)) || (c.edition && !EDS.includes(c.edition)) || (c.seal && !SEALS.includes(c.seal))) add(`card ${c.uid} has an unknown Enhancement, Edition or Seal`);
      if (!(c.grow >= 0)) add(`card ${c.uid} grow ${c.grow}`);
    }
    if (run.blind && ['play', 'cashout', 'win', 'gameover'].includes(run.phase)) {
      const b = run.blind;
      add(partition([b.hand, b.draw, b.discardPile], deck, 'Blind piles'));
      if (!(Number.isInteger(b.handsLeft) && b.handsLeft >= 0)) add(`handsLeft ${b.handsLeft}`);
      if (!(Number.isInteger(b.discardsLeft) && b.discardsLeft >= 0)) add(`discardsLeft ${b.discardsLeft}`);
      if (!(Number.isInteger(b.score) && b.score >= 0)) add(`score ${b.score}`);
      if (!(b.target > 0)) add(`target ${b.target}`);
    }
    if (run.phase === 'pack' && run.pack) {
      const p = run.pack;
      if (!Array.isArray(p.hand) || !Array.isArray(p.draw)) add('pack hand/draw are not arrays');
      else if (p.hand.length || p.draw.length) add(partition([p.hand, p.draw], deck, 'pack piles'));
      if (!(p.picksLeft > 0)) add(`an open pack with ${p.picksLeft} picks left`);
    }
    for (const j of run.jokers) {
      if (!JOKER_IDS.includes(j.id)) add(`unknown Joker ${j.id}`);
      if (j.edition && !EDS.includes(j.edition)) add(`Joker edition ${j.edition}`);
      const st = j.state || {};
      if (j.id === 'standin' && st.target != null && (st.target === j.uid || !run.jokers.some((x) => x.uid === st.target && x.id !== 'standin'))) add(`Stand-In ${j.uid} targets ${st.target}`);
      if (j.id === 'oldflame' && st.copy != null && !(st.copy && JOKER_IDS.includes(st.copy.id) && st.copy.state && typeof st.copy.state === 'object')) add(`Old Flame holds ${JSON.stringify(st.copy)}`);
    }
    for (const k of run.consumables) if (!KNOWN_CONS.has(`${k.kind}:${k.id}`)) add(`unknown consumable ${k.kind}:${k.id}`);
    if (new Set(run.vouchers).size !== run.vouchers.length || run.vouchers.some((v) => !DISC.vouchers.has(v))) add(`vouchers ${run.vouchers}`);
    for (const key of Object.keys(DISC)) {
      const list = run.discovered[key];
      if (new Set(list).size !== list.length || list.some((id) => !DISC[key].has(id))) add(`discovered.${key}`);
    }
    for (const h of A.E.HAND_IDS) if (!(Number.isInteger(run.levels[h]) && run.levels[h] >= 1) || !(Number.isInteger(run.plays[h]) && run.plays[h] >= 0)) add(`hand ${h} level/plays`);
    if (run.shop) for (const it of run.shop.items) if (!(Number.isInteger(it.price) && it.price >= 0)) add(`Shop price ${it.price}`);
    return errs;
  }
  function trace(r) {
    const errs = [];
    if (!r || !Array.isArray(r.steps) || !r.steps.length) return { errs: ['no steps'], money: 0 };
    const s0 = r.steps[0];
    if (s0.source !== 'base' || s0.kind !== 'note') errs.push('the first step is not the base note');
    let chips = s0.runningChips;
    let mult = s0.runningMult;
    let money = 0;
    r.steps.forEach((st, i) => {
      for (const f of STEP_FIELDS) if (!(f in st)) errs.push(`step ${i} has no ${f}`);
      if (i === 0) return;
      if (st.kind === 'chips') chips += st.amount;
      else if (st.kind === 'mult') mult = r6(mult + st.amount);
      else if (st.kind === 'xmult') mult = r6(mult * st.amount);
      else if (st.kind === 'money') money += st.amount;
      else if (st.kind === 'note') { if (/^Capped at \d+$/.test(st.label)) mult = Math.min(mult, Number(st.label.slice(10))); }
      else errs.push(`step ${i} kind ${st.kind}`);
      if (st.kind !== 'note' && (!Number.isFinite(st.amount) || (st.kind === 'xmult' ? st.amount === 1 : st.amount === 0))) errs.push(`step ${i} (${st.label}) is a no-op ${st.kind} ${st.amount}`);
      if (st.runningChips !== chips || st.runningMult !== mult) errs.push(`step ${i} (${st.label}) runs ${st.runningChips} x ${st.runningMult}, the steps add up to ${chips} x ${mult}`);
    });
    if (r.chips !== chips || r.mult !== mult) errs.push(`result ${r.chips} x ${r.mult}, last step ${chips} x ${mult}`);
    if (r.total !== Math.floor(chips * mult + 1e-9)) errs.push(`total ${r.total} is not floor(${chips} x ${mult})`);
    return { errs, money };
  }
  // Queries on the run (pure): every one is called, nothing may change. -> a few answers the checks use.
  function queries(run, sel) {
    const E = A.E;
    const q = (name, ...args) => timed(name, () => E[name](run, ...args));
    for (const j of run.jokers) {
      if (typeof q('jokerText', j.uid) !== 'string') failNow('query', `jokerText(${j.uid}) is not a string`);
      q('jokerSellValue', j.uid);
      q('jokerCopies', j.uid);
    }
    for (const k of run.consumables) {
      q('consumableInfo', k.uid);
      q('consumableSellValue', k.uid);
      q('canUseConsumable', k.uid, sel);
    }
    q('jokerSlotsUsed');
    q('blindsForAnte');
    q('currentBlindInfo');
    q('handTable');
    q('deckView');
    q('stats');
    q('interestPreview');
    q('rerollCost');
    q('handSizeNow');
    q('canPlay', sel);
    q('canDiscard', sel);
    q('canSell');
    q('blindTarget', run.ante, run.blindIndex);
    if (run.cards.length) q('cardText', pickA(run.cards).uid);
    if (sel.length) q('preview', sel);
    if (run.shop) run.shop.items.forEach((it, i) => q('canBuy', i));
    if (run.pack) run.pack.options.forEach((opt, i) => q('canPackPick', i, sel));
    if (run.blind && run.blind.hand.length) {
      const played = run.blind.hand.slice(0, 1 + Math.floor(rnd() * Math.min(5, run.blind.hand.length))).map((u) => E.getCard(run, u));
      const held = run.blind.hand.filter((u) => !played.some((c) => c.uid === u)).map((u) => E.getCard(run, u));
      const r = q('scoreCards', played, held);
      if (r) for (const e of trace(r).errs) failNow('trace', `scoreCards: ${e}`);
    }
  }
  const CAN = { playHand: 'canPlay', discard: 'canDiscard', useConsumable: 'canUseConsumable', buy: 'canBuy', packPick: 'canPackPick' };

  // Runs one entry on the live run with every check; -> the run (null when the game must stop).
  function exec(run, entry, log, hashes, snaps) {
    const E = A.E;
    const isNew = entry.e === 'newRun';
    const before = isNew ? null : E.serialize(run);
    let can = null;
    let pre = null;
    if (!isNew && entry.e) {
      const sel = Array.isArray(entry.a[0]) ? entry.a[0] : Array.isArray(entry.a[1]) ? entry.a[1] : [];
      queries(run, sel.filter((u) => typeof u === 'string'));
      // canPlay / canDiscard without uids check only the phase (§4.2), so they are compared only with uids
      const withUids = !((entry.e === 'playHand' || entry.e === 'discard') && entry.a[0] === undefined);
      if (CAN[entry.e] && withUids) can = timed(CAN[entry.e], () => E[CAN[entry.e]](run, ...structuredClone(entry.a)));
      if ((entry.e === 'sellJoker' || entry.e === 'sellConsumable')) can = timed('canSell', () => E.canSell(run));
      if (entry.e === 'playHand' && can && can.ok) {
        const b = run.blind;
        const sel2 = b.hand.filter((u) => entry.a[0].includes(u));
        pre = timed('scoreCards', () => E.scoreCards(run, sel2.map((u) => E.getCard(run, u)), b.hand.filter((u) => !sel2.includes(u)).map((u) => E.getCard(run, u))));
      }
      const mid = E.serialize(run);
      if (mid !== before) {
        failNow('query', 'a query or check changed the run', entry);
        return null;
      }
    }
    // The call itself, in the time box. A call over the box is re-run from its snapshot (after a short
    // pause, so a stall of the whole machine passes); it fails only when every run is over the box.
    let res;
    let next = run;
    const name = entry.e || 'perturb';
    const runs = [];
    for (let attempt = 0; ; attempt++) {
      if (attempt > 0) Atomics.wait(PAUSE, 0, 0, 25 * attempt);
      try {
        ({ run: next, res } = timed(name, () => apply(A, attempt === 0 ? run : isNew ? null : E.deserialize(before), entry)));
      } catch (err) {
        failNow('throw', (err && err.stack ? err.stack.split('\n').slice(0, 4).join(' | ') : String(err)), entry);
        return null;
      }
      runs.push(timed.last.toFixed(1));
      if (timed.last <= o.box || attempt >= 3) {
        if (timed.last > o.box) failNow('slow', `${name} took ${runs.join(', ')} ms on ${runs.length} runs (box ${o.box} ms)`, entry);
        if (attempt > 0) out.retried += 1;
        break;
      }
    }
    if (ACTIONS.includes(name)) out.hist[Math.min(HIST - 1, Math.floor(timed.last / HIST_STEP))] += 1;
    run = next;
    if (entry.e) out.calls += 1;
    if (entry.bad) out.badCalls += 1;
    const after = E.serialize(run);
    if (QUERIES.includes(entry.e) && after !== before) failNow('query', `the query ${entry.e} changed the run`, entry);
    if (res && typeof res === 'object' && 'ok' in res) {
      out.actions += 1;
      out.ops[entry.e] = (out.ops[entry.e] || 0) + 1;
      if (res.ok === false) {
        out.failedActions += 1;
        if (!KNOWN.has(res.error)) failNow('sentence', `"${res.error}" is not a §4.4 sentence`, entry);
        if (after !== before) failNow('mutation', `the failed ${entry.e} ("${res.error}") changed the run`, entry);
      } else if (res.ok !== true) failNow('result', `ok is ${res.ok}`, entry);
      // can* agrees with the action: the same ok and sentence (canSell checks only the phase: when it
      // refuses, the sale is refused with its sentence)
      const canBad = !can ? false : CAN[entry.e] ? can.ok !== res.ok || (!res.ok && can.error !== res.error) : !can.ok && (res.ok || res.error !== can.error);
      if (canBad) failNow('can', `${entry.e}: check ${JSON.stringify(can)} vs action ${JSON.stringify({ ok: res.ok, error: res.error })}`, entry);
      if (res.ok && Array.isArray(res.jokerEvents)) {
        out.jokerEvents += res.jokerEvents.length;
        for (const ev of res.jokerEvents) if (typeof ev.uid !== 'string' || typeof ev.id !== 'string' || typeof ev.event !== 'string' || typeof ev.op !== 'string') failNow('events', JSON.stringify(ev), entry);
      } else if (res.ok && ['startBlind', 'skipBlind', 'playHand', 'discard', 'useConsumable', 'buy', 'sellJoker', 'packPick'].includes(entry.e)) failNow('events', `${entry.e} has no jokerEvents`, entry);
      if (res.ok && entry.e === 'discard' && res.created.length) out.cometPlanets += res.created.length;
      if (res.ok && entry.e === 'playHand' && run.cashout && run.cashout.lines.some((l) => /Seal/.test(l.label))) out.paidSealLines += 1;
      if (res.ok && entry.e === 'playHand') {
        out.hands += 1;
        const t = trace(res.result);
        for (const e of t.errs) failNow('trace', e, entry);
        if (r6(t.money) !== r6(res.money)) failNow('trace', `money steps ${t.money}, result money ${res.money}`, entry);
        if (pre && JSON.stringify(pre) !== JSON.stringify(res.result)) failNow('pure', 'scoreCards before the hand differs from the hand playHand scored', entry);
        for (const st of res.result.steps) {
          if (st.source === 'card' && st.edition && (st.via === 'edition' || st.via === 'rank')) out.cardEditions[st.edition] = (out.cardEditions[st.edition] || 0) + 1; // a Phantom card's step is its rank step
          if (st.source === 'joker' && st.via === 'edition') out.jokerEditions[st.edition] = (out.jokerEditions[st.edition] || 0) + 1;
          if (st.seal) out.seals[st.seal] = (out.seals[st.seal] || 0) + 1;
        }
      }
    }
    if (run && typeof run === 'object' && run.cards) {
      out.checks += 1;
      for (const e of state(run)) failNow('state', e, entry);
      const back = E.deserialize(after);
      if (!back || E.serialize(back) !== after) failNow('json', 'the run does not round-trip through serialize/deserialize', entry);
      if (run.blind && run.blind.boss) bossesSeen.add(run.blind.boss);
      for (const j of run.jokers) jokersSeen.add(j.id);
      out.maxAnte = Math.max(out.maxAnte, run.ante);
    }
    log.push(entry);
    hashes.push(sha(after || '') + sha(JSON.stringify(res === undefined ? null : res)));
    afters.push(after);
    if (snaps && rnd() < 0.02) snaps.push(after);
    return fails.length ? null : run;
  }
  let afters = []; // this game's states after each entry (the replay resumes from one of them)

  // ---------------------------------------------------------------- decisions
  const G = () => pickA([undefined, null, -1, 0, 1, 2.5, NaN, Infinity, 1e9, '', 'x', 'c1', 'h1', 'k1', 'c99999', {}, [], [null], [1, 2], ['c1', 'c1'], true, false, { uid: 'c1' }]);
  function badEntry(run) {
    const deck = run.cards.map((c) => c.uid);
    const hand = (run.blind && run.blind.hand) || (run.pack && run.pack.hand) || [];
    const uids = () => pickA([
      G(), [], deck.slice(0, 6), hand.slice(0, 6), [hand[0], hand[0]], subset(deck, 0.1, 5), [...hand.slice(0, 2), 'c99999'],
      [...hand.slice(0, 2), 7], hand.slice(0, 4).concat(run.jokers.map((j) => j.uid).slice(0, 1)),
    ]);
    const idx = () => pickA([G(), -1, 99, 0.5, '0', 1e9]);
    const cases = [
      ['startBlind', []], ['skipBlind', []], ['playHand', [uids()]], ['discard', [uids()]], ['useConsumable', [pickA([G(), ...run.consumables.map((k) => k.uid)]), uids()]],
      ['sellJoker', [G()]], ['sellConsumable', [G()]], ['setSort', [G()]], ['reorderHand', [uids()]], ['reorderJokers', [pickA([G(), run.jokers.map((j) => j.uid).slice(1), [...run.jokers.map((j) => j.uid), 'h0']])]],
      ['collect', []], ['buy', [idx()]], ['reroll', []], ['packPick', [idx(), uids()]], ['packSkip', []], ['leaveShop', []], ['goEndless', []],
      ['addJoker', [G(), G(), G()]], ['getCard', [G()]], ['preview', [uids()]], ['scoreCards', [G(), G()]], ['jokerText', [G()]], ['jokerCopies', [G()]],
      ['consumableInfo', [G()]], ['canUseConsumable', [G(), uids()]], ['canBuy', [idx()]], ['canPackPick', [idx(), uids()]], ['canPlay', [uids()]], ['canDiscard', [uids()]],
      ['cardText', [G()]], ['blindTarget', [G(), G()]], ['jokerSellValue', [G()]],
    ];
    const [e, a] = pickA(cases);
    return { e, a, bad: true };
  }
  function decide(run) {
    const r = rnd();
    // occasional changes to the run's data and calls with bad arguments, in any phase
    if (r < 0.03) return badEntry(run);
    if (r < 0.06 && run.consumables.length < run.consumableSlots) { const [kind, id] = pickA(CONS); return { p: 'giveConsumable', kind, id }; }
    if (r < 0.08 && run.jokers.length < 8) return { e: 'addJoker', a: [pickA(rnd() < 0.3 ? [...COPIERS, ...LEGENDARY] : JOKER_IDS), 0, pickA([null, null, null, null, ...EDS])] };
    if (r < 0.085 && run.jokerSlots < 8) return { p: 'jokerSlots', n: run.jokerSlots + 1 };
    if (r < 0.10 && run.cards.length) { const c = pickA(run.cards); return { p: 'decorate', list: [[c.uid, pickA([null, ...ENH]), pickA([null, null, ...EDS]), pickA([null, null, ...SEALS])]] }; }
    if (r < 0.115) return { p: 'money', n: Math.floor(rnd() * 20) };
    if (r < 0.13 && run.jokers.length > 1) return { e: 'reorderJokers', a: [shuffled(run.jokers.map((j) => j.uid))] };
    const hold = (run.phase === 'play' && run.blind) || (run.phase === 'pack' && run.pack && run.pack.hand && run.pack.hand.length ? run.pack : null);
    if (r < 0.14 && hold) return { e: 'reorderHand', a: [shuffled(hold.hand)] };
    if (r < 0.145) return { e: 'setSort', a: [pickA(['rank', 'suit'])] };
    switch (run.phase) {
      case 'blind-select': {
        const x = rnd();
        if (x < 0.1 && run.blindIndex < 2) return { p: 'blindIndex', i: 2 };
        if (x < 0.25) return { p: 'bosses', map: { [run.ante]: pickA(BOSSES) } };
        if (x < 0.5 && run.blindIndex < 2) return { e: 'skipBlind', a: [] };
        if (x < 0.55 && run.jokers.length) return { e: 'sellJoker', a: [pickA(run.jokers).uid] };
        if (x < 0.62 && run.consumables.length) return { e: 'useConsumable', a: [pickA(run.consumables).uid, []] };
        return { e: 'startBlind', a: [] };
      }
      case 'play': {
        const h = run.blind.hand;
        const sel = subset(h, 0.4, 1 + Math.floor(rnd() * 5));
        const x = rnd();
        if (x < 0.12 && run.consumables.length) return { e: 'useConsumable', a: [pickA(run.consumables).uid, sel] };
        if (x < 0.36) return { e: 'discard', a: [sel.length ? sel : h.slice(0, 1)] };
        if (x < 0.39 && run.jokers.length) return { e: 'sellJoker', a: [pickA(run.jokers).uid] };
        if (x < 0.41 && run.consumables.length) return { e: 'sellConsumable', a: [pickA(run.consumables).uid] };
        if (x < 0.6) return { p: 'score', n: Math.floor(run.blind.target * 0.6) };
        return { e: 'playHand', a: [sel.length ? sel : h.slice(0, 1)] };
      }
      case 'cashout': return { e: 'collect', a: [] };
      case 'shop': {
        const x = rnd();
        if (x < 0.15) return { p: 'money', n: Math.floor(rnd() * 10) };
        if (x < 0.5) return { e: 'buy', a: [Math.floor(rnd() * run.shop.items.length)] };
        if (x < 0.62) return { e: 'reroll', a: [] };
        if (x < 0.7 && run.jokers.length) return { e: 'sellJoker', a: [pickA(run.jokers).uid] };
        if (x < 0.73 && run.consumables.length) return { e: 'sellConsumable', a: [pickA(run.consumables).uid] };
        if (x < 0.8 && run.consumables.length) return { e: 'useConsumable', a: [pickA(run.consumables).uid, []] };
        return { e: 'leaveShop', a: [] };
      }
      case 'pack': {
        const h = run.pack.hand || [];
        const sel = subset(h, 0.3, 4);
        const x = rnd();
        if (x < 0.72) return { e: 'packPick', a: [Math.floor(rnd() * run.pack.options.length), sel] };
        if (x < 0.82 && run.consumables.length) return { e: 'useConsumable', a: [pickA(run.consumables).uid, sel] };
        return { e: 'packSkip', a: [] };
      }
      case 'win': return { e: 'goEndless', a: [] };
      default: return null;
    }
  }
  function startEntries(g) {
    const list = [{ e: 'newRun', a: [{ seed: `F${seed}G${g}`, deckId: pickA(C.DECKS).id, stake: pickA(C.STAKES).id }] }];
    if (rnd() < 0.5) {
      const map = {};
      for (let a = 1; a <= 8; a++) map[a] = pickA(BOSSES);
      list.push({ p: 'bosses', map });
    }
    if (o.set > 0) {
      const set = shuffled(JOKER_IDS).slice(0, o.set);
      if (rnd() < 0.6 && !set.some((id) => COPIERS.includes(id))) set[Math.floor(rnd() * set.length)] = pickA(COPIERS);
      list.push({ p: 'jokerSlots', n: 5 + o.set });
      for (const id of set) list.push({ e: 'addJoker', a: [id, 0, rnd() < 0.3 ? pickA(EDS) : null] });
    }
    const deco = [];
    const share = rnd() * 0.6;
    for (let i = 0; i < 60; i++) if (rnd() < share) deco.push([`c${1 + Math.floor(rnd() * 52)}`, pickA([null, ...ENH]), pickA([null, null, ...EDS]), pickA([null, null, ...SEALS])]);
    if (deco.length) list.push({ p: 'decorate', list: deco });
    return list;
  }

  // ---------------------------------------------------------------- the games
  const snapsAll = [];
  for (game = 0; game < o.games; game++) {
    if (o.only != null && game !== o.only) continue;
    s = (Math.imul(seed + 1, 2654435761) ^ Math.imul(game + 1, 40503)) >>> 0 || 1;
    for (let k = 0; k < 4; k++) rnd();
    out.games += 1;
    const log = [];
    const hashes = [];
    const snaps = [];
    afters = [];
    let run = null;
    step = 0;
    for (const entry of startEntries(game)) {
      run = exec(run, entry, log, hashes, null);
      if (!run) break;
    }
    if (run && run.jokers.some((j) => COPIERS.includes(j.id))) out.copierGames += 1;
    if (run && run.jokers.some((j) => LEGENDARY.includes(j.id))) out.legendaryGames += 1;
    for (step = 1; run && step <= o.steps; step++) {
      if (run.phase === 'gameover') { out.losses += 1; break; }
      if (run.phase === 'win') out.wins += 1;
      const entry = decide(run);
      if (!entry) break;
      run = exec(run, entry, log, hashes, snaps);
    }
    if (fails.length) break;
    // replay in the second instance: from scratch to the middle, then from the first instance's JSON
    const swap = Math.floor(log.length / 2);
    let rb = null;
    for (let i = 0; i < log.length; i++) {
      step = i;
      if (i === swap && i > 0) {
        // the first instance's JSON at this point, read by the second: the run must play on identically
        rb = B.E.deserialize(afters[i - 1]);
        out.snapshotsResumed += 1;
      }
      let resB;
      try {
        ({ run: rb, res: resB } = timed(log[i].e || 'perturb', () => apply(B, rb, log[i])));
      } catch (err) {
        failNow('replay', `the replay threw: ${err && err.message}`, log[i]);
        break;
      }
      const h = sha(B.E.serialize(rb) || '') + sha(JSON.stringify(resB === undefined ? null : resB));
      out.replayedSteps += 1;
      if (h !== hashes[i]) {
        failNow('replay', `the replay differs at entry ${i} of ${log.length}`, log[i]);
        break;
      }
    }
    if (fails.length) break;
    if (snaps.length) snapsAll.push(...snaps.slice(0, 3));
    if (progress && (game + 1) % 50 === 0) progress(`seed ${seed}: ${game + 1}/${o.games} games, ${out.actions} actions`);
  }

  // ---------------------------------------------------------------- malformed runs, Engine.debug off: nothing may throw
  const E = A.E;
  E.debug = false;
  const junk = () => pickA([null, undefined, -1, 0, 3.5, NaN, 1e12, '', 'x', [], [null], {}, { a: 1 }, true, 'play', 'c1']);
  const paths = (obj) => {
    const out2 = [];
    const walk = (v, p, d) => {
      if (d > 4 || !v || typeof v !== 'object') return;
      for (const k of Object.keys(v)) {
        out2.push(p.concat(k));
        if (out2.length < 4000) walk(v[k], p.concat(k), d + 1);
      }
    };
    walk(obj, [], 0);
    return out2;
  };
  for (let t = 0; t < o.corrupt && snapsAll.length && !fails.length; t++) {
    game = -1;
    step = t;
    const run = E.deserialize(pickA(snapsAll));
    const ps = paths(run);
    for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) {
      const p = pickA(ps);
      let v = run;
      for (const key of p.slice(0, -1)) v = v && typeof v === 'object' ? v[key] : undefined;
      if (v && typeof v === 'object') {
        if (rnd() < 0.2) delete v[p[p.length - 1]];
        else v[p[p.length - 1]] = junk();
      }
    }
    out.corruptTrials += 1;
    const hand = (run.blind && Array.isArray(run.blind.hand) && run.blind.hand) || [];
    const calls = [
      ['startBlind', []], ['skipBlind', []], ['playHand', [hand.slice(0, 2)]], ['discard', [hand.slice(0, 1)]], ['useConsumable', [run.consumables && run.consumables[0] && run.consumables[0].uid, hand.slice(0, 1)]],
      ['sellJoker', [run.jokers && run.jokers[0] && run.jokers[0].uid]], ['sellConsumable', ['k1']], ['setSort', ['suit']], ['reorderHand', [hand.slice().reverse()]], ['reorderJokers', [[]]],
      ['collect', []], ['buy', [0]], ['reroll', []], ['packPick', [0, []]], ['packSkip', []], ['leaveShop', []], ['goEndless', []], ['addJoker', ['standin', 0, 'gloss']],
      ...QUERIES.map((qn) => [qn, [hand[0], hand.slice(0, 3)]]),
    ];
    for (const [name, args] of shuffled(calls)) {
      out.corruptCalls += 1;
      try {
        const res = timed(name, () => E[name](run, ...args));
        if (ACTIONS.includes(name) && name !== 'addJoker' && !(res && typeof res.ok === 'boolean')) failNow('corrupt', `${name} on a malformed run gave ${JSON.stringify(res)}`);
      } catch (err) {
        failNow('corrupt', `${name} threw on a malformed run: ${err && err.message}`);
      }
    }
    for (const [name, fn] of [
      ['serialize', () => E.serialize(run)], ['deserialize', () => E.deserialize(pickA(['', '{', 'null', '[]', '{"version":3}', JSON.stringify(run)]))],
      ['perturb', () => E.applyRunToRecords(pickA([null, {}, { version: 2, discovered: 5 }, E.defaultRecords()]), run, { final: true, now: 't' })],
      ['perturb', () => E.normalizeRecords(pickA([null, 5, 'x', { version: 1, discovered: { charms: ['anchor', 7] } }, { version: 2, history: 'x', discovered: { jokers: ['anchor', null] } }]))],
      ['perturb', () => E.newRun(pickA([null, 5, { seed: {} }, { deckId: 'nope', stake: 7, seed: '' }]))],
      ['perturb', () => E.evaluate(pickA([null, [null], [{ rank: 99, suit: 'Z' }], 'abc']), pickA([null, 5, { wildJacks: 1 }]))],
      ['perturb', () => E.jokerProblems(pickA([null, 5, {}, { effects: 'x', events: [], rules: 5 }]))],
    ]) {
      try {
        timed(name, fn);
      } catch (err) {
        failNow('corrupt', `${name} threw: ${err && err.message}`);
      }
    }
  }

  out.failures = fails.slice(0, 25);
  out.jokersSeen = [...jokersSeen];
  out.bossesSeen = [...bossesSeen];
  return out;
}

if (isMainThread) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
} else {
  const { o, seed, sab } = workerData;
  const beat = { f: new Float64Array(sab, 0, 1), i: new Int32Array(sab, 8, 4) };
  const result = runSeed(o, seed, beat, (msg) => parentPort.postMessage({ type: 'progress', msg }));
  parentPort.postMessage({ type: 'result', result });
}
