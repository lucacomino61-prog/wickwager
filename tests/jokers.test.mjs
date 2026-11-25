/*
 * Engine v3: white-box tests for the 120 Jokers (SPEC.md §3.4, content/content-plan.json).
 *
 * Every Joker has at least two tests: its effect when it applies, and nothing when it does not.
 * On top of that:
 *  - scaling Jokers: the growth from the real event, what ends or resets it, and a JSON round trip;
 *  - event Jokers: the event, through the real action, with its jokerEvents entry;
 *  - money Jokers: the money at the right moment (scoreCards is pure, playHand pays, cash-out lines
 *    pay at collect, events pay at once);
 *  - rule Jokers: the rule's effect on the action it changes;
 *  - the copiers (Stand-In, Old Flame, The Puppet Master): copying a hand Joker, a card Joker, an
 *    event Joker, a copier, a Legendary Joker and an empty target;
 *  - exact trace steps (§2.4, §4.3) for more than 30 Jokers.
 * A last test checks that coverage: two tests or more for each of the 120, and 30 traced.
 *
 * White-box: the tests read and set run fields (§4.1), Joker state, result.jokerGains and the
 * actions' jokerEvents. Expected numbers are worked out by hand from the Joker texts and the
 * §2.2 hand table: a Pair of Kings (KS KH) is 12 + 10 + 10 = 32 Chips x 2 Mult = 64; a lone
 * 2 (High Card) is 5 + 2 = 7 x 1 = 7; a lone King 5 + 10 = 15 x 1.
 * src/content.js and src/engine.js are loaded into one bare vm context, as in tests/engine.test.mjs.
 *
 * The one test that reads content/content-plan.json (local-only) skips where it is absent (tests/local-data.mjs).
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
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(CONTENT_FILE, 'utf8'), ctx, { filename: CONTENT_FILE });
vm.runInContext(fs.readFileSync(ENGINE_FILE, 'utf8'), ctx, { filename: ENGINE_FILE });
const Engine = vm.runInContext('TW.Engine', ctx);
const Content = vm.runInContext('TW.Content', ctx);

// ------------------------------------------------------------------ the 120 Jokers (typed in from content/content-plan.json)
// id -> [name, rarity, cost, v2 id it renames (oldId)]
const JOKERS = {
  // common
  jinglejester: ['Jingle Jester', 'common', 4, 'anchor'],
  pipsqueak: ['Pipsqueak', 'common', 4, 'gull'],
  gingerbreadfool: ['Gingerbread Fool', 'common', 4, 'biscuit'],
  partyhorn: ['Party Horn', 'common', 4, 'whistle'],
  papercrown: ['Paper Crown', 'common', 4, 'coralcrown'],
  couponclipper: ['Coupon Clipper', 'common', 4, 'sanddollar'],
  emptyseats: ['Empty Seats', 'common', 4, 'raft'],
  pinwheel: ['Pinwheel', 'common', 4, 'compassrose'],
  sleightofhand: ['Sleight of Hand', 'common', 4, 'fishhook'],
  doubleact: ['Double Act', 'common', 4, 'reefknot'],
  tallyowl: ['Tally Owl', 'common', 5, 'quill'],
  magpie: ['Magpie', 'common', 5, 'netmender'],
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
  // uncommon
  sableknave: ['Sable Knave', 'uncommon', 6, 'kraken'],
  redhanded: ['Red-Handed', 'uncommon', 6, 'lobsterpot'],
  congaline: ['Conga Line', 'uncommon', 6, 'lighthouse'],
  moneybags: ['Moneybags', 'uncommon', 6, 'stormpetrel'],
  openingact: ['Opening Act', 'uncommon', 6, 'figurehead'],
  finalbow: ['Final Bow', 'uncommon', 7, 'crosscurrent'],
  chimneysweep: ['Chimney Sweep', 'uncommon', 6, 'bilgerat'],
  goldtooth: ['Gold Tooth', 'uncommon', 6, 'goldtooth'],
  oldstager: ['Old Stager', 'uncommon', 6, 'soundingline'],
  paperclip: ['The Paperclip', 'uncommon', 6, 'kelpforest'],
  lamplighter: ['Lamplighter', 'uncommon', 7, 'mermaidcomb'],
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
  // rare
  bigtop: ['Big Top', 'rare', 8, 'leviathan'],
  pokerface: ['Poker Face', 'rare', 8, 'ghostship'],
  dragontamer: ['Dragon Tamer', 'rare', 9, 'seaserpent'],
  fortunecookie: ['Fortune Cookie', 'rare', 8, 'treasuremap'],
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
  // legendary
  candleking: ['The Candle King', 'legendary', 20],
  madameecho: ['Madame Echo', 'legendary', 20],
  puppetmaster: ['The Puppet Master', 'legendary', 20],
  sirmotley: ['Sir Motley', 'legendary', 20],
  ringmaster: ['The Ringmaster', 'legendary', 20],
};
const JOKER_IDS = Object.keys(JOKERS);
const NAME = (id) => JOKERS[id][0];

// ------------------------------------------------------------------ generic helpers
const plain = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const deq = (actual, expected, msg) => assert.deepStrictEqual(plain(actual), plain(expected), msg);
const sorted = (arr) => [...plain(arr)].sort();
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj == null ? undefined : obj[k]]));
function ok(res, what = 'action') {
  assert.ok(res && typeof res === 'object', `${what}: expected a result object`);
  assert.equal(res.ok, true, `${what} failed: ${res.error}`);
  return res;
}
function fails(res, sentence, what = 'action') {
  assert.equal(res.ok, false, `${what}: expected { ok: false }`);
  if (sentence !== undefined) assert.equal(res.error, sentence, what);
  return res;
}

// ------------------------------------------------------------------ cards: 'KS', 'QH+inked', 'AS+gloss+encore'
const RANK_OF = { J: 11, Q: 12, K: 13, A: 14 };
const ENH = ['inked', 'punchy', 'dimestore', 'popout', 'scribbled', 'spotlit', 'vintage', 'crumpled'];
const EDS = ['gloss', 'benday', 'fourcolor', 'inverted'];
const SEALS = ['encore', 'paid', 'airmail', 'cameo'];
function parseCard(spec) {
  const [face, ...mods] = spec.split('+');
  const out = { rank: RANK_OF[face.slice(0, -1)] ?? Number(face.slice(0, -1)), suit: face.slice(-1), enhancement: null, edition: null, seal: null };
  for (const m of mods) {
    if (ENH.includes(m)) out.enhancement = m;
    else if (EDS.includes(m)) out.edition = m;
    else if (SEALS.includes(m)) out.seal = m;
    else throw new Error(`parseCard: unknown modifier ${m}`);
  }
  return out;
}
const mk = (spec) => {
  const p = parseCard(spec);
  return Engine.makeCard(p.rank, p.suit, { enhancement: p.enhancement, edition: p.edition, seal: p.seal });
};
const mks = (s) => (s && s.trim() ? s.trim().split(/\s+/).map(mk) : []);

// ------------------------------------------------------------------ runs
const SEED = 'JOKERSWB';
const fresh = (opts = {}) => Engine.newRun({ seed: SEED, ...opts });
function inBlind(opts = {}) {
  const run = fresh(opts);
  ok(Engine.startBlind(run), 'startBlind');
  return run;
}
/** A Boss Blind at Ante 1 with the given Boss (The Smudge only hides ranks: the neutral Boss). */
function inBoss(bossId = 'smudge', opts = {}) {
  const run = fresh(opts);
  run.blindIndex = 2;
  run.bosses[1] = bossId;
  ok(Engine.startBlind(run), 'startBlind (Boss)');
  assert.equal(run.blind.boss, bossId);
  return run;
}
const live = (run, uid) => run.jokers.find((j) => j.uid === uid) || null;
/** Engine.addJoker (the §4.2 test hook): its 'gained' events run. Returns the live instance. */
function add(run, id, edition = null, paid = 0) {
  const j = Engine.addJoker(run, id, paid, edition);
  assert.ok(j, `addJoker(${id})`);
  return live(run, j.uid);
}
const cardOf = (run, uid) => run.cards.find((c) => c.uid === uid) || null;
/** Rewrites the first cards of the Blind hand (rank, suit and modifiers), pins the order, returns their uids. */
function setHand(run, specs) {
  const uids = run.blind.hand.slice();
  specs.forEach((spec, i) => Object.assign(cardOf(run, uids[i]), parseCard(spec), { grow: 0 }));
  ok(Engine.reorderHand(run, uids), 'reorderHand');
  return uids.slice(0, specs.length);
}
/** Beats the running Blind with one card (the score is set just under the target). */
function clearBlind(run, uids = [run.blind.hand[0]]) {
  run.blind.score = run.blind.target - 1;
  const r = ok(Engine.playHand(run, uids), 'playHand (clearing)');
  assert.equal(r.cleared, true, 'the hand beats the Blind');
  return r;
}
function toShop(run) {
  if (run.phase === 'blind-select') ok(Engine.startBlind(run), 'startBlind');
  clearBlind(run);
  ok(Engine.collect(run), 'collect');
  assert.equal(run.phase, 'shop');
  return run;
}
/** Buys a pack of the given row from the Shop's first pack slot (price set to $0 unless given). */
function buyPack(run, packId, price = 0) {
  let i = run.shop.items.findIndex((it) => it.slot === 'pack' && !it.sold);
  if (i < 0) i = run.shop.items.findIndex((it) => it.slot === 'pack'); // every pack bought: reuse the first slot
  assert.ok(i >= 0, 'a pack slot');
  const size = Content.PACKS.find((p) => p.id === packId).size;
  Object.assign(run.shop.items[i], { id: packId, size, price, sold: false });
  run.money += price;
  const r = ok(Engine.buy(run, i), `buy ${packId}`);
  assert.equal(r.opened, true);
  return r;
}
/** Rewrites the Shop's first unsold card slot. */
function forceCard(run, fields) {
  const i = run.shop.items.findIndex((it) => it.slot === 'card' && !it.sold);
  assert.ok(i >= 0, 'a card slot');
  Object.assign(run.shop.items[i], { edition: null, sold: false }, fields);
  return i;
}
function give(run, kind, id) {
  const uid = `k${run.nextUid}`;
  run.nextUid += 1;
  run.consumables.push({ uid, kind, id });
  return uid;
}
const roundTrip = (run) => {
  const back = Engine.deserialize(Engine.serialize(run));
  assert.ok(back, 'deserialize');
  deq(back, run, 'the run round-trips through JSON');
  return back;
};

// ------------------------------------------------------------------ scoring and traces
/** Scores loose cards ('KS KH') with the run's Jokers. -> { r, p, h } (r is plain JSON). */
function score(run, played, held = '') {
  const p = typeof played === 'string' ? mks(played) : played;
  const h = typeof held === 'string' ? mks(held) : held;
  const r = Engine.scoreCards(run, p, h);
  assert.ok(r && Array.isArray(r.steps), 'scoreCards returns a ScoreResult');
  return { r: plain(r), p, h };
}
const totals = (r) => [r.chips, r.mult, r.total];
/** A Joker's own steps (source 'joker', its uid, via 'joker'): [kind, amount, label]. */
const own = (r, j) => r.steps.filter((s) => s.uid === j.uid && s.via === 'joker').map((s) => [s.kind, s.amount, s.label]);
const againBy = (r, j) => r.steps.filter((s) => s.label === 'Encore!' && s.jokerUid === j.uid).length;
/**
 * The trace as one string per step: source:uid:cardUid:via:kind:label, then ^enhancement,
 * ~edition, #seal, @jokerUid and <copyOf when set, then =runningChips x runningMult. Uids are named:
 * p0.. played cards, h0.. held cards, Jokers by the names given.
 */
function trace(r, names) {
  const nm = (u) => (u == null ? '-' : names[u] || u);
  return r.steps.map((s) => {
    let t = `${s.source}:${nm(s.uid)}:${nm(s.cardUid)}:${s.via || '-'}:${s.kind}:${s.label}`;
    if (s.enhancement) t += `^${s.enhancement}`;
    if (s.edition) t += `~${s.edition}`;
    if (s.seal) t += `#${s.seal}`;
    if (s.jokerUid) t += `@${nm(s.jokerUid)}`;
    if (s.copyOf) t += `<${s.copyOf}`;
    return `${t}=${s.runningChips}x${s.runningMult}`;
  });
}
function namesOf(p, h, jokers) {
  const n = {};
  p.forEach((c, i) => { n[c.uid] = `p${i}`; });
  h.forEach((c, i) => { n[c.uid] = `h${i}`; });
  for (const [name, j] of Object.entries(jokers)) n[j.uid] = name;
  return n;
}
// The base steps of the hands used most (§2.2 level 1).
const KK = ['base:-:-:-:note:Pair lv.1=12x2', 'card:p0:-:rank:chips:+10=22x2', 'card:p1:-:rank:chips:+10=32x2'];

// ------------------------------------------------------------------ the coverage registry
const COVER = Object.fromEntries(JOKER_IDS.map((id) => [id, 0]));
const TRACED = new Set();
/** A test about one Joker (or several: an array of ids); each id it names counts once. */
function jt(ids, title, fn) {
  const list = Array.isArray(ids) ? ids : [ids];
  for (const id of list) {
    assert.ok(id in COVER, `jt: unknown Joker id ${id}`);
    COVER[id] += 1;
  }
  test(`${list.map((id) => `${NAME(id)} (${id})`).join(' + ')}: ${title}`, fn);
}

// =========================================================================================
describe('the 120-Joker table (SPEC §3.4)', () => {
  test('JOKERS holds the 120 Jokers of content/content-plan.json in plan order, with their names, rarities, costs and oldIds', () => {
    const rows = Array.from(Content.JOKERS);
    deq(rows.map((r) => r.id), JOKER_IDS);
    for (const r of rows) {
      const [name, rarity, cost, oldId] = JOKERS[r.id];
      deq(pick(r, ['name', 'rarity', 'cost', 'oldId']), { name, rarity, cost, oldId }, r.id);
      assert.equal(Content.JOKERS[r.id], r, `${r.id} answers by id`);
      assert.equal(Content.byId('JOKERS', r.id), r);
    }
    deq(['common', 'uncommon', 'rare', 'legendary'].map((x) => rows.filter((r) => r.rarity === x).length), [60, 40, 15, 5]);
  });

  test('each row is its plan row: text and engine row as designed (Sleight of Hand and Lucky Dip drop the placeholder state.used)', { skip: needs('content/content-plan.json') }, () => {
    const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'content-plan.json'), 'utf8'));
    assert.equal(plan.jokers.length, 120);
    for (const j of plan.jokers) {
      const want = { id: j.id, ...(j.oldId ? { oldId: j.oldId } : {}), name: j.name, rarity: j.rarity, cost: j.cost, text: j.text, ...j.engine };
      if (j.id === 'sleightofhand' || j.id === 'luckydip') {
        deq(j.engine.state, { used: false }, `${j.id}: the plan's placeholder`);
        delete want.state;
      }
      deq(Content.JOKERS[j.id], want, j.id);
    }
  });

  // added 2026-11-23 (engine reconcile): SPEC §3.4 lists every Joker by id with its words and row.
  test('SPEC.md §3.4 lists all 120 Jokers by id, in table order, with the vocabulary words and the row of each', async () => {
    const { renderTable, specTable, lit, engineRow } = await import(new URL('../tools/engine-fuzz/spec-jokers.mjs', import.meta.url).href);
    const spec = fs.readFileSync(path.join(ROOT, 'SPEC.md'), 'utf8');
    const listed = specTable(spec);
    assert.ok(listed, 'SPEC.md has the <!-- jokers-table:begin --> … <!-- jokers-table:end --> list');
    const rows = listed.split('\n').filter((l) => /^\| \d+ \| `/.test(l));
    deq(rows.map((l) => l.split(' | ')[1].replace(/`/g, '')), JOKER_IDS, 'the ids, in table order');
    rows.forEach((l, i) => {
      const row = Content.JOKERS[i];
      assert.ok(l.endsWith(`\`${lit(engineRow(row))}\` |`), `${row.id}: SPEC's row is the table's row`);
      assert.ok(l.includes(` | ${row.name} | `), `${row.id}: name`);
    });
    assert.equal(listed, renderTable(Content, Engine), 'SPEC.md is what `node tools/engine-fuzz/spec-jokers.mjs <root>` writes');
  });

  test('Engine.jokerProblems reports nothing for all 120 rows', () => {
    const problems = [];
    for (const r of Array.from(Content.JOKERS)) for (const p of Engine.jokerProblems(r)) problems.push(`${r.id}: ${p}`);
    deq(problems, []);
    assert.equal(Array.from(Content.JOKERS).length, 120);
  });

  test('every row is plain data (JSON round trip keeps it) and every Joker can be added, scored, described and sold', () => {
    for (const id of JOKER_IDS) {
      const row = Content.JOKERS[id];
      deq(JSON.parse(JSON.stringify(row)), row, `${id} is plain JSON`);
      const run = inBlind();
      const j = add(run, id);
      deq(pick(j, ['id', 'paid', 'edition']), { id, paid: 0, edition: null });
      const res = Engine.scoreCards(run, mks('KS KH 5D 5C 9H'), mks('AD 2S'));
      assert.ok(res && Number.isFinite(res.total), `${id} scores`);
      assert.ok(Engine.jokerText(run, j.uid).startsWith(row.text), `${id} text`);
      assert.equal(Engine.jokerSellValue(run, j.uid), Math.max(1, Math.floor(row.cost / 2)), `${id} sells for half its cost`);
      ok(Engine.sellJoker(run, j.uid), `sell ${id}`);
    }
  });

  test('Legendary Jokers weigh 0: the Shop and Joker Packs never offer one (only Tall Tale creates them)', () => {
    const legends = JOKER_IDS.filter((id) => JOKERS[id][1] === 'legendary');
    assert.equal(Content.RARITIES.legendary.weight, 0);
    const run = toShop(fresh({ seed: 'LEGNEVER' }));
    run.money = 1e9;
    for (let i = 0; i < 300; i++) {
      for (const it of run.shop.items) if (it.kind === 'joker') assert.ok(!legends.includes(it.id), `Shop offered ${it.id}`);
      ok(Engine.reroll(run));
    }
    for (let i = 0; i < 40; i++) {
      buyPack(run, 'jokermega');
      for (const o of run.pack.options) assert.ok(!legends.includes(o.id), `Joker Pack offered ${o.id}`);
      ok(Engine.packSkip(run));
    }
    const t = inBlind();
    ok(Engine.useConsumable(t, give(t, 'spectral', 'originstory'), []));
    assert.ok(legends.includes(t.jokers[0].id), 'Tall Tale creates a Legendary Joker');
  });
});

// =========================================================================================
// Exact traces (§2.4 order, §4.3 step fields): the Joker under test is J; other Jokers are named by id.
// [id, title, { setup(run, J), before: [[id, edition]], after: [[id, edition]], boss }, played, held, trace, total]
const S = (s) => `card:${s}`; // a card step shorthand
const TRACES = [
  ['jinglejester', '+15 Chips, then +3 Mult: two steps', {}, 'KS KH', '', [...KK, 'joker:J:-:joker:chips:+15=47x2', 'joker:J:-:joker:mult:+3=47x5'], 235],
  ['pipsqueak', '+45 Chips with 2 cards played', {}, 'KS KH', '', [...KK, 'joker:J:-:joker:chips:+45=77x2'], 154],
  ['gingerbreadfool', '+60 Chips while fresh', {}, '2S', '', ['base:-:-:-:note:High Card lv.1=5x1', S('p0:-:rank:chips:+2=7x1'), 'joker:J:-:joker:chips:+60=67x1'], 67],
  ['partyhorn', '+8 Mult on the first hand of the Blind', {}, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+8=32x10'], 320],
  ['papercrown', 'each scored face card +12 Chips, right after its rank', {}, 'QS QH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), 'joker:J:p0:joker:chips:+12=34x2', S('p1:-:rank:chips:+10=44x2'), 'joker:J:p1:joker:chips:+12=56x2'], 112],
  ['emptyseats', '+2 Mult per empty Joker slot (4 of 5 empty)', {}, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+8=32x10'], 320],
  ['pinwheel', '+3 Mult per suit among scored cards (2)', {}, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+6=32x8'], 256],
  ['doubleact', '+4 Mult per pair among scored cards (1)', {}, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+4=32x6'], 192],
  ['tallyowl', '+1 Mult per 4 hands played (8 played: +2)', { setup: (r) => { r.stats.handsPlayed = 8; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+2=32x4'], 128],
  ['magpie', 'gives the Chips it gathered (20)', { setup: (r, j) => { j.state.chips = 20; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:chips:+20=52x2'], 104],
  ['tindrum', '+40 Chips', {}, 'KS KH', '', [...KK, 'joker:J:-:joker:chips:+40=72x2'], 144],
  ['emberimp', '+5 Mult', {}, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+5=32x7'], 224],
  ['solofiddler', '+8 Mult on a High Card', {}, 'AS', '', ['base:-:-:-:note:High Card lv.1=5x1', S('p0:-:rank:chips:+11=16x1'), 'joker:J:-:joker:mult:+8=16x9'], 144],
  ['matchingsocks', '+25 Chips then +4 Mult on a Pair', {}, 'KS KH', '', [...KK, 'joker:J:-:joker:chips:+25=57x2', 'joker:J:-:joker:mult:+4=57x6'], 342],
  ['squaredance', '+60 Chips on a Two Pair', {}, 'KS KH 5S 5H', '',
    ['base:-:-:-:note:Two Pair lv.1=22x2', S('p0:-:rank:chips:+10=32x2'), S('p1:-:rank:chips:+10=42x2'), S('p2:-:rank:chips:+5=47x2'), S('p3:-:rank:chips:+5=52x2'), 'joker:J:-:joker:chips:+60=112x2'], 224],
  ['hattrick', '+30 Chips then +6 Mult on a Three of a Kind', {}, 'KS KH KD', '',
    ['base:-:-:-:note:Three of a Kind lv.1=32x3', S('p0:-:rank:chips:+10=42x3'), S('p1:-:rank:chips:+10=52x3'), S('p2:-:rank:chips:+10=62x3'), 'joker:J:-:joker:chips:+30=92x3', 'joker:J:-:joker:mult:+6=92x9'], 828],
  ['tightrope', '+70 Chips on a Straight', {}, '9S 10H JD QC KS', '',
    ['base:-:-:-:note:Straight lv.1=34x4', S('p0:-:rank:chips:+9=43x4'), S('p1:-:rank:chips:+10=53x4'), S('p2:-:rank:chips:+10=63x4'), S('p3:-:rank:chips:+10=73x4'), S('p4:-:rank:chips:+10=83x4'), 'joker:J:-:joker:chips:+70=153x4'], 612],
  ['peacock', '+9 Mult on a Flush', {}, '2H 4H 6H 8H 10H', '',
    ['base:-:-:-:note:Flush lv.1=38x4', S('p0:-:rank:chips:+2=40x4'), S('p1:-:rank:chips:+4=44x4'), S('p2:-:rank:chips:+6=50x4'), S('p3:-:rank:chips:+8=58x4'), S('p4:-:rank:chips:+10=68x4'), 'joker:J:-:joker:mult:+9=68x13'], 884],
  ['clowncar', '+20 Chips then +10 Mult on a Full House', {}, 'KS KH KD 5S 5H', '',
    ['base:-:-:-:note:Full House lv.1=44x4', S('p0:-:rank:chips:+10=54x4'), S('p1:-:rank:chips:+10=64x4'), S('p2:-:rank:chips:+10=74x4'), S('p3:-:rank:chips:+5=79x4'), S('p4:-:rank:chips:+5=84x4'), 'joker:J:-:joker:chips:+20=104x4', 'joker:J:-:joker:mult:+10=104x14'], 1456],
  ['quartet', '+20 Mult on a Four of a Kind', {}, 'KS KH KD KC', '',
    ['base:-:-:-:note:Four of a Kind lv.1=64x6', S('p0:-:rank:chips:+10=74x6'), S('p1:-:rank:chips:+10=84x6'), S('p2:-:rank:chips:+10=94x6'), S('p3:-:rank:chips:+10=104x6'), 'joker:J:-:joker:mult:+20=104x26'], 2704],
  ['rednose', 'a scored Heart +2 Mult; the Spade gives nothing', {}, 'KS KH', '', [...KK, 'joker:J:p1:joker:mult:+2=32x4'], 128],
  ['blackcat', 'a scored Spade +15 Chips; the Heart gives nothing', {}, 'KS KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), 'joker:J:p0:joker:chips:+15=37x2', S('p1:-:rank:chips:+10=47x2')], 94],
  ['jewelbox', 'a +$2 money step with 5 scored Diamonds', {}, '2D 4D 6D 8D 10D', '',
    ['base:-:-:-:note:Flush lv.1=38x4', S('p0:-:rank:chips:+2=40x4'), S('p1:-:rank:chips:+4=44x4'), S('p2:-:rank:chips:+6=50x4'), S('p3:-:rank:chips:+8=58x4'), S('p4:-:rank:chips:+10=68x4'), 'joker:J:-:joker:money:+$2=68x4'], 272],
  ['luckysevens', 'each scored 7 +7 Mult', {}, '7S 7H', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+7=19x2'), 'joker:J:p0:joker:mult:+7=19x9', S('p1:-:rank:chips:+7=26x9'), 'joker:J:p1:joker:mult:+7=26x16'], 416],
  ['anklebiters', 'each scored 5 +12 Chips', {}, '5S 5H', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+5=17x2'), 'joker:J:p0:joker:chips:+12=29x2', S('p1:-:rank:chips:+5=34x2'), 'joker:J:p1:joker:chips:+12=46x2'], 92],
  // Balance 2026-11-23 (Jokers, engine fix): +0.5 Mult per Jack pass (was +1)
  ['jackinthebox', 'two scored Jacks gain +0.5 Mult each during scoring, which this hand already gives (+1)', {}, 'JS JH', '', [...KK, 'joker:J:-:joker:mult:+1=32x3'], 96],
  ['tophat', 'the highest held card (a King) gives 3 x 13 = 39 Chips', {}, '2S', 'KD 5C',
    ['base:-:-:-:note:High Card lv.1=5x1', S('p0:-:rank:chips:+2=7x1'), 'joker:J:h0:joker:chips:+39=46x1'], 46],
  ['aceupthesleeve', '+10 Mult with an Ace held', {}, 'KS KH', 'AD', [...KK, 'joker:J:-:joker:mult:+10=32x12'], 384],
  ['portraitgallery', 'each held face card +2 Mult', {}, 'KS KH', 'QD JC 5S', [...KK, 'joker:J:h0:joker:mult:+2=32x4', 'joker:J:h1:joker:mult:+2=32x6'], 192],
  ['peekaboo', '+20 Chips per pair held (2)', {}, '2S', 'KD KC 5D 5C', ['base:-:-:-:note:High Card lv.1=5x1', S('p0:-:rank:chips:+2=7x1'), 'joker:J:-:joker:chips:+40=47x1'], 47],
  ['sableknave', 'a scored Spade x1.1 Mult; Mult rounded to 6 decimals', {}, 'KS KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), 'joker:J:p0:joker:xmult:×1.1=22x2.2', S('p1:-:rank:chips:+10=32x2.2')], 70],
  ['redhanded', 'each held Heart or Diamond +2 Mult', {}, 'KS KH', 'QH 5D 3S', [...KK, 'joker:J:h0:joker:mult:+2=32x4', 'joker:J:h1:joker:mult:+2=32x6'], 192],
  ['congaline', 'x1.5 Mult on a Straight', {}, '9S 10H JD QC KS', '',
    ['base:-:-:-:note:Straight lv.1=34x4', S('p0:-:rank:chips:+9=43x4'), S('p1:-:rank:chips:+10=53x4'), S('p2:-:rank:chips:+10=63x4'), S('p3:-:rank:chips:+10=73x4'), S('p4:-:rank:chips:+10=83x4'), 'joker:J:-:joker:xmult:×1.5=83x6'], 498],
  ['openingact', 'the first scored card +20 Chips then +2 Mult', {}, 'KS KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), 'joker:J:p0:joker:chips:+20=42x2', 'joker:J:p0:joker:mult:+2=42x4', S('p1:-:rank:chips:+10=52x4')], 208],
  ['finalbow', 'the last scored card x1.5 Mult', {}, 'KS KH', '', [...KK, 'joker:J:p1:joker:xmult:×1.5=32x3'], 96],
  ['goldtooth', 'each scored Ace a +$1 money step', {}, 'AS AH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+11=23x2'), 'joker:J:p0:joker:money:+$1=23x2', S('p1:-:rank:chips:+11=34x2'), 'joker:J:p1:joker:money:+$1=34x2'], 68],
  ['oldstager', 'each scored card +2 Chips at Ante 1', {}, 'KS KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), 'joker:J:p0:joker:chips:+2=24x2', S('p1:-:rank:chips:+10=34x2'), 'joker:J:p1:joker:chips:+2=36x2'], 72],
  ['paperclip', 'each held card +5 Chips', {}, 'KS KH', 'QD 5S 2C', [...KK, 'joker:J:h0:joker:chips:+5=37x2', 'joker:J:h1:joker:chips:+5=42x2', 'joker:J:h2:joker:chips:+5=47x2'], 94],
  ['maypole', 'the sealed card scores again (Encore! from Maypole)', {}, 'KS+paid KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), S('p0:-:retrigger:note:Encore!@J=22x2'), S('p0:-:rank:chips:+10=32x2'), S('p1:-:rank:chips:+10=42x2')], 84],
  ['callandresponse', 'both Kings retrigger while a King is held; the held King gives nothing', {}, 'KS KH', 'KD',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), S('p0:-:retrigger:note:Encore!@J=22x2'), S('p0:-:rank:chips:+10=32x2'), S('p1:-:rank:chips:+10=42x2'), S('p1:-:retrigger:note:Encore!@J=42x2'), S('p1:-:rank:chips:+10=52x2')], 104],
  ['bookends', 'the first and the last scored card retrigger', {}, 'KS KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), S('p0:-:retrigger:note:Encore!@J=22x2'), S('p0:-:rank:chips:+10=32x2'), S('p1:-:rank:chips:+10=42x2'), S('p1:-:retrigger:note:Encore!@J=42x2'), S('p1:-:rank:chips:+10=52x2')], 104],
  ['onemanband', 'a lone card scores 4 times', {}, 'AS', '',
    ['base:-:-:-:note:High Card lv.1=5x1', S('p0:-:rank:chips:+11=16x1'), S('p0:-:retrigger:note:Encore!@J=16x1'), S('p0:-:rank:chips:+11=27x1'), S('p0:-:retrigger:note:Encore!@J=27x1'), S('p0:-:rank:chips:+11=38x1'), S('p0:-:retrigger:note:Encore!@J=38x1'), S('p0:-:rank:chips:+11=49x1')], 49],
  ['colourguard', 'x1.5 Mult when every scored card is red', {}, 'KH KD', '', [...KK, 'joker:J:-:joker:xmult:×1.5=32x3'], 96],
  ['threesacrowd', 'x1.75 Mult with exactly 3 cards played (the 4 is not scored)', {}, 'KS KH 4C', '', [...KK, 'joker:J:-:joker:xmult:×1.75=32x3.5'], 112],
  ['highfive', '+5 Mult with exactly 5 cards played (3 not scored)', {}, 'KS KH 2C 3D 4S', '', [...KK, 'joker:J:-:joker:mult:+5=32x7'], 224],
  ['understudy', '+3 Mult per played card that does not score (2)', {}, 'KS KH 2C 3D', '', [...KK, 'joker:J:-:joker:mult:+6=32x8'], 256],
  ['bigtop', 'x2.5 Mult on a Full House', {}, 'KS KH KD 5S 5H', '',
    ['base:-:-:-:note:Full House lv.1=44x4', S('p0:-:rank:chips:+10=54x4'), S('p1:-:rank:chips:+10=64x4'), S('p2:-:rank:chips:+10=74x4'), S('p3:-:rank:chips:+5=79x4'), S('p4:-:rank:chips:+5=84x4'), 'joker:J:-:joker:xmult:×2.5=84x10'], 840],
  ['twoscompany', 'x2 Mult on a Two Pair', {}, 'KS KH 5S 5H', '',
    ['base:-:-:-:note:Two Pair lv.1=22x2', S('p0:-:rank:chips:+10=32x2'), S('p1:-:rank:chips:+10=42x2'), S('p2:-:rank:chips:+5=47x2'), S('p3:-:rank:chips:+5=52x2'), 'joker:J:-:joker:xmult:×2=52x4'], 208],
  ['pocketlint', 'x1.5 Mult with empty consumable slots', {}, 'KS KH', '', [...KK, 'joker:J:-:joker:xmult:×1.5=32x3'], 96],
  ['signaturemove', 'x1.5 Mult on Pair, the most-played hand when nothing is played yet', {}, 'KS KH', '', [...KK, 'joker:J:-:joker:xmult:×1.5=32x3'], 96],
  ['headsortails', 'x2 Mult on Heads', { setup: (r, j) => { j.state.side = 'heads'; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:xmult:×2=32x4'], 128],
  ['velvetrope', 'x1.25 for the one Joker with an Edition (Tin Drum with Sheen)', { before: [['tindrum', 'gloss']] }, 'KS KH', '',
    [...KK, 'joker:tindrum:-:edition:chips:+40~gloss=72x2', 'joker:tindrum:-:joker:chips:+40=112x2', 'joker:J:-:joker:xmult:×1.25=112x2.5'], 280],
  ['moneybags', '+1 Mult per $4 held ($20: +5)', { setup: (r) => { r.money = 20; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+5=32x7'], 224],
  // Balance 2026-11-23 (Jokers, engine fix): +1 Mult for every 2 cards discarded (was every card)
  ['chimneysweep', '+1 Mult for every 2 cards discarded this Blind (7: +3)', { setup: (r) => { r.blind.cardsDiscarded = 7; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+3=32x5'], 160],
  ['grandfinale', '+60 Chips on the last hand', { setup: (r) => { r.blind.handsLeft = 1; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:chips:+60=92x2'], 184],
  ['seesaw', '+10 Mult on the second hand', { setup: (r) => { r.blind.handsPlayed = 1; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+10=32x12'], 384],
  ['pennilesspoet', '+9 Mult with $5', { setup: (r) => { r.money = 5; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+9=32x11'], 352],
  ['orrery', '+2 Mult per level above 1 (Pair level 4: +6)', { setup: (r) => { r.levels.pair = 4; } }, 'KS KH', '',
    ['base:-:-:-:note:Pair lv.4=60x5', S('p0:-:rank:chips:+10=70x5'), S('p1:-:rank:chips:+10=80x5'), 'joker:J:-:joker:mult:+6=80x11'], 880],
  ['jesterparade', '+12 Chips per other common Joker (Tin Drum, Ember Imp)', { before: [['tindrum'], ['emberimp']] }, 'KS KH', '',
    [...KK, 'joker:tindrum:-:joker:chips:+40=72x2', 'joker:emberimp:-:joker:mult:+5=72x7', 'joker:J:-:joker:chips:+24=96x7'], 672],
  ['signetring', '+10 Chips per sealed card in the deck (3)', { setup: (r) => { for (const c of r.cards.slice(0, 3)) c.seal = 'paid'; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:chips:+30=62x2'], 124],
  ['fancydress', 'the enhanced card +2 Mult, after its Enhancement', {}, 'KS+inked KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), S('p0:-:enhancement:chips:+35^inked=57x2'), 'joker:J:p0:joker:mult:+2=57x4', S('p1:-:rank:chips:+10=67x4')], 268],
  ['bravobouquet', 'the Encore card +20 Chips on both passes', {}, 'KS+encore KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), 'joker:J:p0:joker:chips:+20=42x2', S('p0:-:retrigger:note:Encore!#encore=42x2'), S('p0:-:rank:chips:+10=52x2'), 'joker:J:p0:joker:chips:+20=72x2', S('p1:-:rank:chips:+10=82x2')], 164],
  ['galanight', 'x2 Mult when every scored card has an Enhancement', {}, 'KS+inked KH+punchy', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), S('p0:-:enhancement:chips:+35^inked=57x2'), S('p1:-:rank:chips:+10=67x2'), S('p1:-:enhancement:mult:+5^punchy=67x7'), 'joker:J:-:joker:xmult:×2=67x14'], 938],
  ['blackjack', 'x3 Mult: three 7s add up to 21', {}, '7S 7H 7D', '',
    ['base:-:-:-:note:Three of a Kind lv.1=32x3', S('p0:-:rank:chips:+7=39x3'), S('p1:-:rank:chips:+7=46x3'), S('p2:-:rank:chips:+7=53x3'), 'joker:J:-:joker:xmult:×3=53x9'], 477],
  ['ticketcollector', 'x(1 + 0.25 x 2 Vouchers) = x1.5', { setup: (r) => { r.vouchers.push('skyatlas', 'savingsbond'); } }, 'KS KH', '', [...KK, 'joker:J:-:joker:xmult:×1.5=32x3'], 96],
  ['nightwatchman', '+12 Mult in a Boss Blind', { boss: 'smudge' }, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+12=32x14'], 448],
  ['reprise', 'the enhanced card retriggers: rank and Enhancement again', {}, 'KS+inked KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), S('p0:-:enhancement:chips:+35^inked=57x2'), S('p0:-:retrigger:note:Encore!@J=57x2'), S('p0:-:rank:chips:+10=67x2'), S('p0:-:enhancement:chips:+35^inked=102x2'), S('p1:-:rank:chips:+10=112x2')], 224],
  ['kaleidoscope', 'the card Sheen fires twice', {}, 'KS+gloss KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), S('p0:-:edition:chips:+40~gloss=62x2'), S('p0:-:edition:chips:+40~gloss=102x2'), S('p1:-:rank:chips:+10=112x2')], 224],
  ['fortunecookie', 'each scored card of the named rank (King) a +$2 money step', { setup: (r, j) => { j.state.rank = 13; } }, 'KS KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), 'joker:J:p0:joker:money:+$2=22x2', S('p1:-:rank:chips:+10=32x2'), 'joker:J:p1:joker:money:+$2=32x2'], 64],
  ['pokerface', 'xstate.x (1.5)', { setup: (r, j) => { j.state.x = 1.5; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:xmult:×1.5=32x3'], 96],
  ['dragontamer', 'xstate.x (2)', { setup: (r, j) => { j.state.x = 2; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:xmult:×2=32x4'], 128],
  ['brazier', 'xstate.x (1.4)', { setup: (r, j) => { j.state.x = 1.4; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:xmult:×1.4=32x2.8'], 89],
  ['accordion', 'exactly 5 cards: +3 during scoring, given this hand', {}, 'KS KH 2C 3D 4S', '', [...KK, 'joker:J:-:joker:chips:+3=35x2'], 70],
  ['packrat', '+state.mult (3)', { setup: (r, j) => { j.state.mult = 3; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+3=32x5'], 160],
  ['pawnbroker', '+state.mult (4)', { setup: (r, j) => { j.state.mult = 4; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+4=32x6'], 192],
  ['tealeaves', '+state.chips (12)', { setup: (r, j) => { j.state.chips = 12; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:chips:+12=44x2'], 88],
  ['stargazer', '+1 Mult per 2 Planet cards (4: +2)', { setup: (r, j) => { j.state.planets = 4; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+2=32x4'], 128],
  ['drippingcandle', '+state.mult (15)', {}, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+15=32x17'], 544],
  ['patchworkdoll', '+state.chips (8)', { setup: (r, j) => { j.state.chips = 8; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:chips:+8=40x2'], 80],
  ['bigspender', '+state.mult (2)', { setup: (r, j) => { j.state.mult = 2; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+2=32x4'], 128],
  ['nailbiter', '+state.mult (4)', { setup: (r, j) => { j.state.mult = 4; } }, 'KS KH', '', [...KK, 'joker:J:-:joker:mult:+4=32x6'], 192],
  ['candleking', 'each scored card x1.25 Mult', {}, 'KS KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), 'joker:J:p0:joker:xmult:×1.25=22x2.5', S('p1:-:rank:chips:+10=32x2.5'), 'joker:J:p1:joker:xmult:×1.25=32x3.125'], 100],
  ['madameecho', 'every scored card retriggers', {}, 'KS KH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), S('p0:-:retrigger:note:Encore!@J=22x2'), S('p0:-:rank:chips:+10=32x2'), S('p1:-:rank:chips:+10=42x2'), S('p1:-:retrigger:note:Encore!@J=42x2'), S('p1:-:rank:chips:+10=52x2')], 104],
  ['ringmaster', 'x1.3 per other Joker: x1.69 with two', { before: [['tindrum'], ['emberimp']] }, 'KS KH', '',
    [...KK, 'joker:tindrum:-:joker:chips:+40=72x2', 'joker:emberimp:-:joker:mult:+5=72x7', 'joker:J:-:joker:xmult:×1.69=72x11.83'], 851],
  ['sirmotley', 'five cards of four suits are a Flush, all five scoring', {}, '2S 5H 9D JC KS', '',
    ['base:-:-:-:note:Flush lv.1=38x4', S('p0:-:rank:chips:+2=40x4'), S('p1:-:rank:chips:+5=45x4'), S('p2:-:rank:chips:+9=54x4'), S('p3:-:rank:chips:+10=64x4'), S('p4:-:rank:chips:+10=74x4')], 296],
  ['jackofalltrades', 'a Jack stands in for a King: a Pair, both scoring', {}, 'JS KH', '', [...KK], 64],
  ['merrygoround', 'Q-K-A-2-3 wraps into a Straight', {}, 'QS KH AD 2C 3S', '',
    ['base:-:-:-:note:Straight lv.1=34x4', S('p0:-:rank:chips:+10=44x4'), S('p1:-:rank:chips:+10=54x4'), S('p2:-:rank:chips:+11=65x4'), S('p3:-:rank:chips:+2=67x4'), S('p4:-:rank:chips:+3=70x4')], 280],
  ['fandancer', 'four Hearts and a Spade are a Flush; the Spade does not score', {}, '2H 5H 9H JH KS', '',
    ['base:-:-:-:note:Flush lv.1=38x4', S('p0:-:rank:chips:+2=40x4'), S('p1:-:rank:chips:+5=45x4'), S('p2:-:rank:chips:+9=54x4'), S('p3:-:rank:chips:+10=64x4')], 256],
  ['courtace', 'Aces are face cards for Paper Crown', { before: [['papercrown']] }, 'AS AH', '',
    ['base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+11=23x2'), 'joker:papercrown:p0:joker:chips:+12=35x2', S('p1:-:rank:chips:+11=46x2'), 'joker:papercrown:p1:joker:chips:+12=58x2'], 116],
];

describe('exact traces (§2.4, §4.3)', () => {
  for (const [id, title, o, played, held, want, total] of TRACES) {
    TRACED.add(id);
    jt(id, `trace: ${title} (${total})`, () => {
      const run = o.boss ? inBoss(o.boss) : inBlind();
      const named = {};
      for (const [x, ed] of o.before || []) named[x] = add(run, x, ed || null);
      const j = add(run, id);
      named.J = j;
      for (const [x, ed] of o.after || []) named[x] = add(run, x, ed || null);
      if (o.setup) o.setup(run, j);
      const before = Engine.serialize(run);
      const { r, p, h } = score(run, played, held);
      deq(trace(r, namesOf(p, h, named)), want);
      assert.equal(r.total, total);
      assert.equal(Engine.serialize(run), before, 'scoreCards is pure');
      for (const s of r.steps.filter((x) => x.source === 'joker' && x.uid === j.uid)) {
        deq(pick(s, ['copyOf', 'jokerName']), { copyOf: null, jokerName: NAME(id) }, 'a Joker step names its Joker');
      }
    });
  }
});

// =========================================================================================
// Nothing when the condition does not hold: the Joker makes no step and the total is the plain one.
// [id, title, { setup, boss, wet, fillers: [ids] }, played, held, total]
const QUIET = [
  ['jinglejester', 'switched off by The Wet Blanket', { wet: true }, 'KS KH', '', 64],
  ['pipsqueak', '3 cards played', {}, 'KS KH 2C', '', 64],
  ['gingerbreadfool', 'switched off by The Wet Blanket', { wet: true }, '2S', '', 7],
  ['partyhorn', 'a later hand of the Blind', { setup: (r) => { r.blind.handsPlayed = 1; } }, 'KS KH', '', 64],
  ['papercrown', 'Aces are not face cards (without Court Ace)', {}, 'AS AH', '', 68],
  ['emptyseats', 'no empty Joker slot (5 of 5 taken)', { fillers: ['courtace', 'merrygoround', 'usher', 'spinningtop'] }, 'KS KH', '', 64],
  ['pinwheel', 'no scored card (The Heckler boos the lone one)', { boss: 'heckler' }, '2S', '', 5],
  ['doubleact', 'a High Card has no pair', {}, '2S', '', 7],
  ['tallyowl', '3 hands played', { setup: (r) => { r.stats.handsPlayed = 3; } }, 'KS KH', '', 64],
  ['magpie', 'nothing gathered yet', {}, 'KS KH', '', 64],
  ['tindrum', 'switched off by The Wet Blanket', { wet: true }, 'KS KH', '', 64],
  ['emberimp', 'switched off by The Wet Blanket', { wet: true }, 'KS KH', '', 64],
  ['solofiddler', 'a Pair', {}, 'KS KH', '', 64],
  ['matchingsocks', 'a Two Pair is not a Pair', {}, 'KS KH 5S 5H', '', 104],
  ['squaredance', 'a Pair', {}, 'KS KH', '', 64],
  ['hattrick', 'a Full House is not a Three of a Kind', {}, 'KS KH KD 5S 5H', '', 336],
  ['tightrope', 'a Straight Flush is not a Straight', {}, '5H 6H 7H 8H 9H', '', 1160],
  ['peacock', 'a Straight Flush is not a Flush', {}, '5H 6H 7H 8H 9H', '', 1160],
  ['clowncar', 'a Four of a Kind', {}, 'KS KH KD KC', '', 624],
  ['quartet', 'a Full House', {}, 'KS KH KD 5S 5H', '', 336],
  ['rednose', 'black cards', {}, 'KS KC', '', 64],
  ['blackcat', 'red cards', {}, 'KH KD', '', 64],
  ['jewelbox', 'one scored Diamond', {}, 'KD KH', '', 64],
  ['luckysevens', 'no 7', {}, 'KS KH', '', 64],
  ['anklebiters', 'a Pair of 6s', {}, '6S 6H', '', 48],
  ['jackinthebox', 'no Jack scores', {}, 'KS KH', '', 64],
  ['tophat', 'no card held', {}, '2S', '', 7],
  ['aceupthesleeve', 'no Ace held', {}, 'KS KH', 'QD', 64],
  ['portraitgallery', 'no face card held', {}, 'KS KH', '5S 2C', 64],
  ['peekaboo', 'no pair held', {}, '2S', 'KD QC', 7],
  ['sableknave', 'no Spade scored', {}, 'KH KD', '', 64],
  ['redhanded', 'only black cards held', {}, 'KS KH', '3S 4C', 64],
  ['congaline', 'a Flush', {}, '2H 5H 9H JH KH', '', 296],
  ['moneybags', '$3', { setup: (r) => { r.money = 3; } }, 'KS KH', '', 64],
  ['openingact', 'The Heckler boos the first scored card; the next one does not take its place', { boss: 'heckler' }, 'KS KH', '', 44],
  ['finalbow', 'The Heckler boos the last scored card', { boss: 'heckler' }, '2S 3H 4D 5C 6S', '', 192],
  ['chimneysweep', 'no card discarded this Blind', {}, 'KS KH', '', 64],
  ['chimneysweep', 'only 1 card discarded this Blind (every 2 count)', { setup: (r) => { r.blind.cardsDiscarded = 1; } }, 'KS KH', '', 64],
  ['goldtooth', 'no Ace', {}, 'KS KH', '', 64],
  ['oldstager', 'no scored card (booed)', { boss: 'heckler' }, '2S', '', 5],
  ['paperclip', 'no card held', {}, 'KS KH', '', 64],
  ['maypole', 'no sealed card', {}, 'KS KH', '', 64],
  ['callandresponse', 'no held card of a scored rank', {}, 'KS KH', 'QD', 64],
  ['bookends', 'the lone card is booed', { boss: 'heckler' }, '2S', '', 5],
  ['onemanband', '2 cards played', {}, 'KS KH', '', 64],
  ['colourguard', 'a red and a black card', {}, 'KS KH', '', 64],
  ['threesacrowd', '2 cards played', {}, 'KS KH', '', 64],
  ['twoscompany', 'a Pair', {}, 'KS KH', '', 64],
  ['pocketlint', 'a card in a consumable slot', { setup: (r) => { give(r, 'tarot', 'inkpot'); } }, 'KS KH', '', 64],
  ['signaturemove', 'Flush is the most-played hand', { setup: (r) => { r.plays.flush = 3; } }, 'KS KH', '', 64],
  ['headsortails', 'Tails', { setup: (r, j) => { j.state.side = 'tails'; } }, 'KS KH', '', 64],
  ['velvetrope', 'no Joker with an Edition', {}, 'KS KH', '', 64],
  ['fancydress', 'no enhanced card', {}, 'KS KH', '', 64],
  ['signetring', 'no sealed card in the deck', {}, 'KS KH', '', 64],
  ['bravobouquet', 'The Blackout switches the Encore Seal off', { boss: 'censor' }, 'KS+encore KH', '', 64],
  ['grandfinale', '4 hands left', {}, 'KS KH', '', 64],
  ['nightwatchman', 'a Small Blind', {}, 'KS KH', '', 64],
  ['seesaw', 'the third hand (2 played before it)', { setup: (r) => { r.blind.handsPlayed = 2; } }, 'KS KH', '', 64],
  ['pennilesspoet', '$6', { setup: (r) => { r.money = 6; } }, 'KS KH', '', 64],
  ['orrery', 'level 1', {}, 'KS KH', '', 64],
  ['jesterparade', 'the other Jokers are uncommon', { fillers: ['fandancer', 'helpinghand'] }, 'KS KH', '', 64],
  ['understudy', 'every played card scores; a Cameo card counts as scoring (32 + 2 = 34 x 2)', {}, 'KS KH 2C+cameo', '', 68],
  ['bigtop', 'a Flush', {}, '2H 5H 9H JH KH', '', 296],
  ['highfive', '4 cards played', {}, 'KS KH 2C 3D', '', 64],
  ['accordion', '4 cards played: no gain, no step', {}, 'KS KH 2C 3D', '', 64],
  ['packrat', 'no pack opened yet', {}, 'KS KH', '', 64],
  ['pawnbroker', 'nothing sold yet', {}, 'KS KH', '', 64],
  ['tealeaves', 'no Tarot used yet', {}, 'KS KH', '', 64],
  ['stargazer', '1 Planet card used: floor(1 / 2) = 0', { setup: (r, j) => { j.state.planets = 1; } }, 'KS KH', '', 64],
  ['drippingcandle', 'switched off by The Wet Blanket', { wet: true }, 'KS KH', '', 64],
  ['patchworkdoll', 'no card added yet', {}, 'KS KH', '', 64],
  ['bigspender', 'nothing bought yet', {}, 'KS KH', '', 64],
  ['nailbiter', 'no Blind beaten on the last hand yet', {}, 'KS KH', '', 64],
  ['fortunecookie', 'no card of the named rank (2)', { setup: (r, j) => { j.state.rank = 2; } }, 'KS KH', '', 64],
  ['pokerface', 'x1: no step', {}, 'KS KH', '', 64],
  ['dragontamer', 'x1: no step', {}, 'KS KH', '', 64],
  ['brazier', 'x1: no step', {}, 'KS KH', '', 64],
  ['ticketcollector', 'no Voucher: x1, no step', {}, 'KS KH', '', 64],
  ['reprise', 'no enhanced card', {}, 'KS KH', '', 64],
  ['kaleidoscope', 'no Edition to double', {}, 'KS KH', '', 64],
  ['galanight', 'one scored card is plain', {}, 'KS+inked KH', '', 134],
  ['blackjack', 'two Kings add up to 20', {}, 'KS KH', '', 64],
  ['candleking', 'no scored card (booed)', { boss: 'heckler' }, '2S', '', 5],
  ['madameecho', 'no scored card (booed): no Encore!', { boss: 'heckler' }, '2S', '', 5],
  ['ringmaster', 'no other Joker', {}, 'KS KH', '', 64],
  ['sirmotley', 'switched off by The Wet Blanket: two suits are no Flush', { wet: true }, '2S 5H 9D JC KS', '', 15],
  ['jackofalltrades', 'switched off by The Wet Blanket: the Jack is a Jack (High Card King)', { wet: true }, 'JS KH', '', 15],
  ['merrygoround', 'switched off by The Wet Blanket: no wrap (High Card Ace)', { wet: true }, 'QS KH AD 2C 3S', '', 16],
  ['fandancer', 'switched off by The Wet Blanket: no 4-card Flush (High Card King)', { wet: true }, '2H 5H 9H JH KS', '', 15],
  ['courtace', 'switched off by The Wet Blanket: Aces are not face cards', { wet: true, fillers: ['papercrown'] }, 'AS AH', '', 68],
];

describe('nothing when the condition does not hold', () => {
  for (const [id, title, o, played, held, total] of QUIET) {
    jt(id, `nothing: ${title} (${total})`, () => {
      const run = o.boss ? inBoss(o.boss) : inBlind();
      const j = add(run, id);
      for (const x of o.fillers || []) add(run, x);
      if (o.wet) run.blind.wetJoker = j.uid;
      if (o.setup) o.setup(run, j);
      const { r } = score(run, played, held);
      deq(r.steps.filter((s) => s.uid === j.uid || s.jokerUid === j.uid), [], 'no step from the Joker');
      deq(r.jokerGains, [], 'no gain');
      assert.equal(r.total, total);
    });
  }
});

// =========================================================================================
describe('cash-out Jokers: their line, after Interest, paid at collect (§2.7)', () => {
  // A fresh run holds $4: no Interest line. Beating the Small Blind with the first hand leaves 3
  // hands: Small Blind $3, Hands to spare $3.
  const lines = (run) => plain(run.cashout.lines);

  jt('couponclipper', '+$1 per unused discard (2 left after one discard), paid at collect', () => {
    const run = inBlind();
    add(run, 'couponclipper');
    ok(Engine.discard(run, [run.blind.hand[0]]));
    const m = run.money;
    clearBlind(run);
    deq(lines(run), [{ label: 'Small Blind', amount: 3 }, { label: 'Hands to spare', amount: 3 }, { label: 'Coupon Clipper', amount: 2 }]);
    assert.equal(run.money, m, 'nothing is paid before collect');
    ok(Engine.collect(run));
    assert.equal(run.money, m + 8);
  });
  jt('couponclipper', 'no line with every discard used ($0 lines are left out)', () => {
    const run = inBlind();
    add(run, 'couponclipper');
    for (let i = 0; i < 3; i++) ok(Engine.discard(run, [run.blind.hand[0]]));
    clearBlind(run);
    assert.ok(!lines(run).some((l) => l.label === 'Coupon Clipper'), JSON.stringify(lines(run)));
  });

  jt('earlybird', '+$1 per hand left when the Blind is beaten (3), on top of Hands to spare', () => {
    const run = inBlind();
    add(run, 'earlybird');
    clearBlind(run);
    deq(lines(run), [{ label: 'Small Blind', amount: 3 }, { label: 'Hands to spare', amount: 3 }, { label: 'Early Bird', amount: 3 }]);
  });
  jt('earlybird', 'no line when the last hand beat the Blind', () => {
    const run = inBlind();
    add(run, 'earlybird');
    run.blind.handsLeft = 1;
    clearBlind(run);
    deq(lines(run), [{ label: 'Small Blind', amount: 3 }]);
  });

  jt('prizerosette', '+$3 after a Boss Blind', () => {
    const run = inBoss();
    add(run, 'prizerosette');
    clearBlind(run);
    deq(lines(run).find((l) => l.label === 'Prize Rosette'), { label: 'Prize Rosette', amount: 3 });
    assert.equal(lines(run)[lines(run).length - 1].label, 'Prize Rosette', 'the Joker lines come last');
  });
  jt('prizerosette', 'nothing after a Small Blind', () => {
    const run = inBlind();
    add(run, 'prizerosette');
    clearBlind(run);
    assert.ok(!lines(run).some((l) => l.label === 'Prize Rosette'));
  });

  jt('dartboard', '+$3 when the first hand beat the Blind', () => {
    const run = inBlind();
    add(run, 'dartboard');
    clearBlind(run);
    deq(lines(run).find((l) => l.label === 'Dartboard'), { label: 'Dartboard', amount: 3 });
  });
  jt('dartboard', 'nothing when the second hand beat it', () => {
    const run = inBlind();
    add(run, 'dartboard');
    ok(Engine.playHand(run, [run.blind.hand[run.blind.hand.length - 1]]));
    clearBlind(run);
    assert.ok(!lines(run).some((l) => l.label === 'Dartboard'));
  });

  jt('paymaster', '+$1 per other Joker (a Phantom one counts); live text +$N', () => {
    const run = inBlind();
    const pm = add(run, 'paymaster');
    add(run, 'tindrum');
    add(run, 'emberimp', 'inverted');
    assert.ok(Engine.jokerText(run, pm.uid).endsWith('(now +$2)'), Engine.jokerText(run, pm.uid));
    clearBlind(run);
    deq(lines(run).find((l) => l.label === 'Paymaster'), { label: 'Paymaster', amount: 2 });
  });
  jt('paymaster', 'no line without another Joker', () => {
    const run = inBlind();
    add(run, 'paymaster');
    clearBlind(run);
    assert.ok(!lines(run).some((l) => l.label === 'Paymaster'));
  });
});

// =========================================================================================
describe('money Jokers: the money arrives at the right moment', () => {
  jt('jewelbox', 'scoreCards only reports the +$2 step; playHand pays it', () => {
    const run = inBlind();
    add(run, 'jewelbox');
    const uids = setHand(run, ['2D', '4D', '6D', '8D', '10D']);
    const m = run.money;
    const { r } = score(run, uids.map((u) => plain(cardOf(run, u))));
    deq(r.steps.filter((s) => s.kind === 'money').map((s) => s.amount), [2]);
    assert.equal(run.money, m, 'scoreCards pays nothing');
    const res = ok(Engine.playHand(run, uids));
    deq([res.money, run.money], [2, m + 2]);
  });
  jt('jewelbox', 'a Diamond booed by The Heckler is not scored: two left, no money', () => {
    const run = inBoss('heckler');
    add(run, 'jewelbox');
    const { r } = score(run, '3D 4D 5S 6C 7D');
    assert.equal(r.booedUid != null, true);
    deq(r.steps.filter((s) => s.kind === 'money'), []);
    const free = inBlind();
    add(free, 'jewelbox');
    deq(score(free, '3D 4D 5S 6C 7D').r.steps.filter((s) => s.kind === 'money').map((s) => s.amount), [2], 'three Diamonds without The Heckler');
  });

  jt('goldtooth', 'playHand pays +$1 per scored Ace', () => {
    const run = inBlind();
    add(run, 'goldtooth');
    const m = run.money;
    const res = ok(Engine.playHand(run, setHand(run, ['AS', 'AH'])));
    deq([res.money, run.money], [2, m + 2]);
  });

  jt('fortunecookie', 'playHand pays +$2 per scored card of the named rank, and nothing for others', () => {
    const run = inBlind();
    const fc = add(run, 'fortunecookie');
    fc.state.rank = 12;
    const m = run.money;
    const res = ok(Engine.playHand(run, setHand(run, ['QS', 'QH'])));
    deq([res.money, run.money], [4, m + 4]);
    const res2 = ok(Engine.playHand(run, setHand(run, ['KS', 'KH'])));
    deq([res2.money, run.money], [0, m + 4]);
  });
});

// =========================================================================================
describe('live values in jokerText (§3.4)', () => {
  // [id, setup(run, j), the text's parenthesised ending]
  const LIVE = [
    ['gingerbreadfool', (r, j) => { j.state.chips = 45; }, '(now +45 Chips)'],
    ['emptyseats', null, '(now +8 Mult)'],
    ['tallyowl', (r) => { r.stats.handsPlayed = 9; }, '(now +2 Mult)'],
    ['magpie', (r, j) => { j.state.chips = 6; }, '(now +6 Chips)'],
    ['jackinthebox', (r, j) => { j.state.mult = 3; }, '(now +3 Mult)'],
    ['accordion', (r, j) => { j.state.chips = 9; }, '(now +9 Chips)'],
    ['packrat', (r, j) => { j.state.mult = 2; }, '(now +2 Mult)'],
    ['pawnbroker', (r, j) => { j.state.mult = 4; }, '(now +4 Mult)'],
    ['tealeaves', (r, j) => { j.state.chips = 12; }, '(now +12 Chips)'],
    ['stargazer', (r, j) => { j.state.planets = 5; }, '(now +2 Mult)'],
    ['drippingcandle', null, '(now +15 Mult)'],
    ['jesterparade', (r) => { Engine.addJoker(r, 'tindrum'); }, '(now +12 Chips)'],
    ['signetring', (r) => { r.cards[0].seal = 'encore'; r.cards[1].seal = 'cameo'; }, '(now +20 Chips)'],
    ['patchworkdoll', (r, j) => { j.state.chips = 8; }, '(now +8 Chips)'],
    ['moneybags', (r) => { r.money = 13; }, '(now +3 Mult)'],
    ['chimneysweep', (r) => { r.blind.cardsDiscarded = 5; }, '(now +2 Mult)'],
    ['oldstager', (r) => { r.ante = 3; }, '(now +6 Chips per card)'],
    ['velvetrope', (r, j) => { j.edition = 'gloss'; }, '(now ×1.25)'],
    ['bigspender', (r, j) => { j.state.mult = 2; }, '(now +2 Mult)'],
    ['nailbiter', (r, j) => { j.state.mult = 8; }, '(now +8 Mult)'],
    ['pokerface', (r, j) => { j.state.x = 1.25; }, '(now ×1.25)'],
    ['dragontamer', (r, j) => { j.state.x = 1.5; }, '(now ×1.5)'],
    ['fortunecookie', (r, j) => { j.state.rank = 12; }, '(named: Queens)'],
    ['ticketcollector', (r) => { r.vouchers.push('skyatlas'); }, '(now ×1.25)'],
    ['brazier', (r, j) => { j.state.x = 1.6; }, '(now ×1.6)'],
    ['ringmaster', (r) => { Engine.addJoker(r, 'tindrum'); Engine.addJoker(r, 'emberimp'); }, '(now ×1.69)'],
    ['sleightofhand', null, '(free discard: ready)'],
    ['seesaw', null, '(next hand: off)'],
    ['signaturemove', (r) => { r.plays.flush = 2; }, '(most-played: Flush)'],
    ['moonstruck', null, '(most-played: Pair)'],
    ['headsortails', (r, j) => { j.state.side = 'tails'; }, '(now Tails)'],
    ['carpetbag', null, '(now +0 hand size)'],
    ['paymaster', null, '(now +$0)'],
    ['standin', null, '(copying: nothing)'],
    ['oldflame', null, '(nothing yet)'],
    ['puppetmaster', null, '(copying: nothing)'],
  ];
  for (const [id, setup, ending] of LIVE) {
    jt(id, `jokerText ends with ${ending}`, () => {
      const run = inBlind();
      const j = add(run, id);
      if (setup) setup(run, j);
      const text = Engine.jokerText(run, j.uid);
      assert.ok(text.startsWith(Content.JOKERS[id].text), text);
      assert.ok(text.endsWith(` ${ending}`), `${id}: ${text}`);
    });
  }
  jt(['sleightofhand', 'seesaw', 'carpetbag', 'chimneysweep'], 'the during-a-Blind live values are left out between Blinds; the others change with the Blind', () => {
    const run = fresh();
    const ids = ['sleightofhand', 'seesaw', 'carpetbag', 'chimneysweep'];
    const js = ids.map((id) => add(run, id));
    js.forEach((j, i) => assert.equal(Engine.jokerText(run, j.uid), Content.JOKERS[ids[i]].text, ids[i]));
    ok(Engine.startBlind(run));
    ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    ok(Engine.playHand(run, [run.blind.hand[0]]));
    const t = js.map((j) => Engine.jokerText(run, j.uid));
    assert.ok(t[0].endsWith('(free discard: used)'), t[0]);
    assert.ok(t[1].endsWith('(next hand: on)'), t[1]);
    assert.ok(t[2].endsWith('(now +1 hand size)'), t[2]);
    assert.ok(t[3].endsWith('(now +1 Mult)'), t[3]); // 2 cards discarded: +1 (balance 2026-11-23, every 2 cards)
  });
});

// =========================================================================================
// Scaling Jokers: the growth from the real event, what ends or resets it, and a JSON round trip.
const ev = (r, j) => plain(r.jokerEvents).filter((e) => e.uid === j.uid);
const stateEvent = (j, id, event, key, from, to, copyOf = null) => ({ uid: j.uid, id, copyOf, event, op: 'state', key, from, to });
/** From a cash-out, through the Shop, to the next Blind started (Small Blind and Big Blind Tags set to Piggy Bank). */
function nextBlind(run) {
  if (run.phase === 'cashout') ok(Engine.collect(run), 'collect');
  if (run.phase === 'shop') ok(Engine.leaveShop(run), 'leaveShop');
  if (run.blindIndex === 2) run.bosses[run.ante] = 'smudge';
  ok(Engine.startBlind(run), 'startBlind');
  return run;
}

describe('scaling Jokers: growth, end or reset, JSON round trip', () => {
  // Every Joker with a starting state: a new instance gets a fresh copy of the row's state, so one
  // instance growing changes neither the row nor another instance (Fortune Cookie names its rank when
  // gained, Stand-In its target).
  const STATEFUL = ['gingerbreadfool', 'magpie', 'jackinthebox', 'accordion', 'packrat', 'pawnbroker', 'tealeaves', 'stargazer', 'drippingcandle',
    'patchworkdoll', 'headsortails', 'bigspender', 'nailbiter', 'pokerface', 'dragontamer', 'brazier', 'oldflame'];
  jt(STATEFUL, "each instance starts from a fresh copy of its row state; growing one changes neither the row nor another", () => {
    const run = fresh();
    run.jokerSlots = 40;
    for (const id of STATEFUL) {
      const row = Content.JOKERS[id];
      const a = add(run, id);
      deq(a.state, row.state, `${id} starts as its row`);
      for (const k of Object.keys(a.state)) a.state[k] = typeof a.state[k] === 'number' ? a.state[k] + 7 : 'changed';
      const b = add(run, id);
      deq([b.state, JSON.parse(JSON.stringify(row.state))], [row.state, row.state], `${id}: a second instance and the row are untouched`);
      assert.notEqual(a.state, b.state);
    }
  });
  jt('gingerbreadfool', 'loses 15 Chips when a Blind is beaten (jokerEvents), not when one is skipped, and is eaten at 0', () => {
    const run = inBlind();
    const g = add(run, 'gingerbreadfool');
    const r1 = clearBlind(run);
    deq(ev(r1, g), [stateEvent(g, 'gingerbreadfool', 'blindCleared', 'chips', 60, 45)]);
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    run.tags['1-1'] = 'piggybank';
    ok(Engine.skipBlind(run));
    assert.equal(live(run, g.uid).state.chips, 45, 'a skipped Blind is not beaten');
    live(run, g.uid).state.chips = 15;
    nextBlind(run);
    const r2 = clearBlind(run);
    deq(ev(r2, g), [stateEvent(g, 'gingerbreadfool', 'blindCleared', 'chips', 15, 0)]);
    deq(r2.eaten, [g.uid]);
    assert.equal(live(run, g.uid), null, 'eaten at 0');
  });
  jt('gingerbreadfool', 'its state survives a JSON round trip (30 left: +30 Chips) and a new one starts at 60', () => {
    const run = inBlind();
    const g = add(run, 'gingerbreadfool');
    g.state.chips = 30;
    const back = roundTrip(run);
    deq(totals(score(back, 'KS KH').r), [62, 2, 124]);
    deq(add(back, 'gingerbreadfool').state, { chips: 60 });
  });

  // Balance 2026-11-23 (Jokers, engine fix): the cap is +50 (was +100)
  jt('magpie', 'gains +2 per discarded card, The Fumble\'s extra card included, and never passes 50', () => {
    const run = inBoss('fumble');
    const m = add(run, 'magpie');
    const r = ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    assert.ok(r.extra, 'The Fumble dropped a card');
    deq(ev(r, m), [stateEvent(m, 'magpie', 'discard', 'chips', 0, 6)]);
    live(run, m.uid).state.chips = 48;
    ok(Engine.discard(run, [run.blind.hand[0]]));
    assert.equal(live(run, m.uid).state.chips, 50, '48 + 4, capped at 50');
  });
  jt('magpie', 'paused while The Wet Blanket switches it off; JSON round trip; a new one starts at 0', () => {
    const run = fresh();
    const m = add(run, 'magpie');
    run.blindIndex = 2;
    run.bosses[1] = 'wetblanket';
    ok(Engine.startBlind(run));
    assert.equal(run.blind.wetJoker, m.uid);
    const r = ok(Engine.discard(run, run.blind.hand.slice(0, 3)));
    deq([ev(r, m), live(run, m.uid).state.chips], [[], 0]);
    live(run, m.uid).state.chips = 24;
    run.blind.wetJoker = null;
    const back = roundTrip(run);
    deq(totals(score(back, 'KS KH').r), [56, 2, 112]);
    deq(add(back, 'magpie').state, { chips: 0 });
  });

  // Balance 2026-11-23 (Jokers, engine fix): +0.5 Mult per Jack pass (was +1)
  jt('jackinthebox', 'scoreCards reports each Jack pass as a gain (at, cardUid) and leaves the state; playHand stores it', () => {
    const run = inBlind();
    const j = add(run, 'jackinthebox');
    const [js, jh] = setHand(run, ['JS', 'JH']);
    const before = Engine.serialize(run);
    const r = plain(Engine.scoreCards(run, [cardOf(run, js), cardOf(run, jh)], []));
    deq(r.jokerGains, [
      { uid: j.uid, path: [], key: 'mult', from: 0, to: 0.5, cardUid: js, at: 2 },
      { uid: j.uid, path: [], key: 'mult', from: 0.5, to: 1, cardUid: jh, at: 3 },
    ]);
    assert.equal(Engine.serialize(run), before, 'scoreCards is pure');
    const res = ok(Engine.playHand(run, [js, jh]));
    deq([res.result.total, live(run, j.uid).state.mult], [96, 1]);
    deq(res.jokerEvents, [], 'gains during scoring are reported in result.jokerGains, not jokerEvents');
  });
  jt('jackinthebox', 'a retriggered Jack counts twice; the stored Mult carries to the next hand and through JSON', () => {
    const run = inBlind();
    const j = add(run, 'jackinthebox');
    const [js, jh] = setHand(run, ['JS+encore', 'JH']);
    const res = ok(Engine.playHand(run, [js, jh]));
    assert.equal(live(run, j.uid).state.mult, 1.5);
    assert.equal(res.result.total, (12 + 30) * (2 + 1.5));
    const back = roundTrip(run);
    deq(totals(score(back, 'KS KH').r), [32, 3.5, 112]);
    assert.ok(Engine.jokerText(back, j.uid).endsWith('(now +1.5 Mult)'), Engine.jokerText(back, j.uid));
  });

  jt('accordion', 'exactly 5 cards: +3 during scoring (cardUid null), given the same hand and stored', () => {
    const run = inBlind();
    const a = add(run, 'accordion');
    const { r } = score(run, 'KS KH 2C 3D 4S');
    deq(r.jokerGains, [{ uid: a.uid, path: [], key: 'chips', from: 0, to: 3, cardUid: null, at: 3 }]);
    assert.equal(a.state.chips, 0, 'scoreCards leaves it');
    const first = ok(Engine.playHand(run, setHand(run, ['KS', 'KH', '2C', '3D', '4S'])));
    deq([first.result.total, live(run, a.uid).state.chips], [(32 + 3) * 2, 3]);
    const res = ok(Engine.playHand(run, setHand(run, ['KS', 'KH', '2C', '3D', '4S'])));
    assert.equal(live(run, a.uid).state.chips, 6);
    deq(own(res.result, a), [['chips', 6, '+6']], 'this hand already counts');
  });
  jt('accordion', 'its Chips survive a JSON round trip and a new Blind', () => {
    const run = inBlind();
    const a = add(run, 'accordion');
    a.state.chips = 9;
    clearBlind(run);
    nextBlind(run);
    const back = roundTrip(run);
    deq(totals(score(back, 'KS KH').r), [41, 2, 82]);
  });

  jt('packrat', '+1 Mult per Booster Pack opened: one bought in the Shop, one free from a Tag (jokerEvents packOpened)', () => {
    const run = toShop(fresh());
    const p = add(run, 'packrat');
    const r = buyPack(run, 'cardnormal');
    deq(ev(r, p), [stateEvent(p, 'packrat', 'packOpened', 'mult', 0, 1)]);
    ok(Engine.packSkip(run));
    ok(Engine.leaveShop(run));
    run.tags['1-1'] = 'grabbag';
    const s = ok(Engine.skipBlind(run));
    deq(ev(s, p), [stateEvent(p, 'packrat', 'packOpened', 'mult', 1, 2)]);
    deq(totals(score(run, 'KS KH').r), [32, 4, 128]);
    assert.equal(roundTrip(run).jokers[0].state.mult, 2);
  });

  jt('pawnbroker', '+2 Mult each time another Joker is sold; a Joker destroyed by Poltergeist is not sold', () => {
    const run = inBlind();
    const pb = add(run, 'pawnbroker');
    const t = add(run, 'tindrum');
    add(run, 'emberimp');
    const r = ok(Engine.sellJoker(run, t.uid));
    deq(ev(r, pb), [stateEvent(pb, 'pawnbroker', 'jokerSold', 'mult', 0, 2)]);
    const u = ok(Engine.useConsumable(run, give(run, 'spectral', 'hauntedpress'), []));
    deq([u.effect.destroyed.length, ev(u, pb), live(run, pb.uid).state.mult], [1, [], 2]);
    assert.equal(roundTrip(run).jokers[0].state.mult, 2);
  });

  jt('tealeaves', '+6 Chips per Tarot used, from a slot or picked from a Tarot Pack; a Planet does not count', () => {
    const run = toShop(fresh());
    const t = add(run, 'tealeaves');
    const r = ok(Engine.useConsumable(run, give(run, 'tarot', 'paperroute'), []));
    deq(ev(r, t), [stateEvent(t, 'tealeaves', 'consumableUsed', 'chips', 0, 6)]);
    ok(Engine.useConsumable(run, give(run, 'planet', 'boing'), []));
    assert.equal(t.state.chips, 6);
    buyPack(run, 'tarotnormal');
    run.pack.options[0] = { kind: 'tarot', id: 'paperroute', picked: false };
    ok(Engine.packPick(run, 0));
    assert.equal(live(run, t.uid).state.chips, 12);
    assert.equal(roundTrip(run).jokers[0].state.chips, 12);
  });

  jt('stargazer', 'counts each Planet used (slot or pack) and gives +1 Mult for every 2; a Tarot does not count', () => {
    const run = toShop(fresh());
    const s = add(run, 'stargazer');
    ok(Engine.useConsumable(run, give(run, 'planet', 'boing'), []));
    ok(Engine.useConsumable(run, give(run, 'tarot', 'paperroute'), []));
    assert.equal(s.state.planets, 1);
    buyPack(run, 'planetnormal');
    const r = ok(Engine.packPick(run, 0));
    deq(ev(r, s), [stateEvent(s, 'stargazer', 'consumableUsed', 'planets', 1, 2)]);
    const back = roundTrip(run);
    back.levels = Object.fromEntries(Object.keys(back.levels).map((k) => [k, 1]));
    deq(totals(score(back, 'KS KH').r), [32, 3, 96]);
  });

  jt('drippingcandle', 'loses 1 Mult after each hand (jokerEvents afterHand) and melts at 0 (playHand eaten)', () => {
    const run = inBlind();
    const d = add(run, 'drippingcandle');
    const low = () => [run.blind.hand[run.blind.hand.length - 1]];
    const r = ok(Engine.playHand(run, low()));
    deq(ev(r, d), [stateEvent(d, 'drippingcandle', 'afterHand', 'mult', 15, 14)]);
    live(run, d.uid).state.mult = 1;
    const r2 = ok(Engine.playHand(run, low()));
    deq([r2.eaten, live(run, d.uid)], [[d.uid], null]);
  });
  jt('drippingcandle', 'its Mult survives a JSON round trip; a new one starts at 15', () => {
    const run = inBlind();
    const d = add(run, 'drippingcandle');
    d.state.mult = 7;
    const back = roundTrip(run);
    deq(totals(score(back, 'KS KH').r), [32, 9, 288]);
    deq(add(back, 'drippingcandle').state, { mult: 15 });
  });

  jt('patchworkdoll', '+4 Chips per playing card added: a Card Pack pick, then 3 copies from Hall of Mirrors (+12)', () => {
    const run = toShop(fresh());
    const p = add(run, 'patchworkdoll');
    buyPack(run, 'cardnormal');
    const r = ok(Engine.packPick(run, 0));
    deq(ev(r, p), [stateEvent(p, 'patchworkdoll', 'cardAdded', 'chips', 0, 4)]);
    ok(Engine.leaveShop(run));
    ok(Engine.startBlind(run));
    ok(Engine.useConsumable(run, give(run, 'spectral', 'hallofmirrors'), [run.blind.hand[0]]));
    assert.equal(live(run, p.uid).state.chips, 16);
    assert.equal(roundTrip(run).jokers[0].state.chips, 16);
  });

  // Balance 2026-11-23 (Jokers, engine fix): +0.5 Mult per purchase (was +1)
  jt('bigspender', '+0.5 Mult per purchase above $0; its own purchase, a reroll and a free item do not count', () => {
    const run = toShop(fresh());
    run.money = 50;
    ok(Engine.buy(run, forceCard(run, { kind: 'joker', id: 'bigspender', price: 6 })));
    const b = run.jokers.find((j) => j.id === 'bigspender');
    assert.equal(b.state.mult, 0, 'its own purchase');
    const r = ok(Engine.buy(run, forceCard(run, { kind: 'tarot', id: 'inkpot', price: 3 })));
    deq(ev(r, b), [stateEvent(b, 'bigspender', 'purchase', 'mult', 0, 0.5)]);
    ok(Engine.reroll(run));
    ok(Engine.buy(run, forceCard(run, { kind: 'planet', id: 'boing', price: 0 })));
    assert.equal(live(run, b.uid).state.mult, 0.5, 'reroll and free item');
    assert.equal(roundTrip(run).jokers[0].state.mult, 0.5);
    assert.ok(Engine.jokerText(run, b.uid).endsWith('(now +0.5 Mult)'), Engine.jokerText(run, b.uid));
  });

  jt('nailbiter', '+4 Mult when the last hand beats the Blind; nothing with hands to spare', () => {
    const run = inBlind();
    const n = add(run, 'nailbiter');
    const r1 = clearBlind(run);
    deq(ev(r1, n), []);
    nextBlind(run);
    run.blind.handsLeft = 1;
    const r2 = clearBlind(run);
    deq(ev(r2, n), [stateEvent(n, 'nailbiter', 'blindCleared', 'mult', 0, 4)]);
    assert.equal(roundTrip(run).jokers[0].state.mult, 4);
  });

  jt('pokerface', 'x0.25 for a Blind beaten without a discard; a Blind with a discard adds nothing', () => {
    const run = inBlind();
    const p = add(run, 'pokerface');
    const r = clearBlind(run);
    deq(ev(r, p), [stateEvent(p, 'pokerface', 'blindCleared', 'x', 1, 1.25)]);
    nextBlind(run);
    ok(Engine.discard(run, [run.blind.hand[0]]));
    clearBlind(run);
    assert.equal(live(run, p.uid).state.x, 1.25);
    const back = roundTrip(run);
    deq(totals(score(back, 'KS KH').r), [32, 2.5, 80]);
  });

  jt('dragontamer', 'x0.5 for each Boss Blind beaten; a Small Blind adds nothing', () => {
    const run = inBlind();
    const d = add(run, 'dragontamer');
    deq(ev(clearBlind(run), d), []);
    const boss = inBoss();
    const d2 = add(boss, 'dragontamer');
    deq(ev(clearBlind(boss), d2), [stateEvent(d2, 'dragontamer', 'blindCleared', 'x', 1, 1.5)]);
    assert.equal(roundTrip(boss).jokers[0].state.x, 1.5);
  });

  jt('brazier', 'x0.2 per playing card destroyed: Candle Snuffer destroys 2 (x1.4, jokerEvents cardDestroyed)', () => {
    const run = inBlind();
    const b = add(run, 'brazier');
    const r = ok(Engine.useConsumable(run, give(run, 'tarot', 'eraser'), run.blind.hand.slice(0, 2)));
    deq(ev(r, b), [stateEvent(b, 'brazier', 'cardDestroyed', 'x', 1, 1.4)]);
    const back = roundTrip(run);
    deq(totals(score(back, 'KS KH').r), [32, 2.8, 89]);
  });

  jt('headsortails', 'the coin flips after every hand from the run\'s RNG: both sides come up and the same seed flips the same way', () => {
    const flips = (seed) => {
      const run = Engine.newRun({ seed });
      ok(Engine.startBlind(run));
      const h = add(run, 'headsortails');
      run.blind.target = 1e9;
      run.blind.handsLeft = 30;
      const out = [];
      let prev = 'heads';
      for (let i = 0; i < 20; i++) {
        const r = ok(Engine.playHand(run, [run.blind.hand[0]]));
        const side = live(run, h.uid).state.side;
        assert.ok(side === 'heads' || side === 'tails', side);
        deq(ev(r, h), side === prev ? [] : [stateEvent(h, 'headsortails', 'afterHand', 'side', prev, side)]);
        out.push(side);
        prev = side;
      }
      return out;
    };
    const a = flips('COINFLIP');
    deq(flips('COINFLIP'), a);
    assert.ok(a.includes('heads') && a.includes('tails'), a.join(' '));
  });

  jt('fortunecookie', 'names a rank (2 to Ace) when gained and again when each Blind starts (jokerEvents blindStart)', () => {
    const run = fresh();
    const f = add(run, 'fortunecookie');
    assert.ok(Number.isInteger(f.state.rank) && f.state.rank >= 2 && f.state.rank <= 14, `gained: ${f.state.rank}`);
    f.state.rank = 99;
    const r = ok(Engine.startBlind(run));
    const rank = live(run, f.uid).state.rank;
    assert.ok(Number.isInteger(rank) && rank >= 2 && rank <= 14, `rank ${rank}`);
    deq(ev(r, f), [stateEvent(f, 'fortunecookie', 'blindStart', 'rank', 99, rank)]);
  });
  // changed 2026-11-23 (Jokers, engine fix): between Blinds the old rank would mislead (the next Blind names a new one)
  jt('fortunecookie', 'its live text names the rank only during a Blind', () => {
    const run = fresh();
    const f = add(run, 'fortunecookie');
    assert.ok(!/named:/.test(Engine.jokerText(run, f.uid)), Engine.jokerText(run, f.uid));
    ok(Engine.startBlind(run));
    live(run, f.uid).state.rank = 12;
    assert.ok(Engine.jokerText(run, f.uid).endsWith('(named: Queens)'));
    clearBlind(run);
    assert.ok(!/named:/.test(Engine.jokerText(run, f.uid)), 'not at the cash-out');
  });
});

// =========================================================================================
describe('event Jokers: the event, through the real action', () => {
  jt('doorman', 'pays $1 at once when a Blind starts (jokerEvents money)', () => {
    const run = fresh();
    const d = add(run, 'doorman');
    const m = run.money;
    const r = ok(Engine.startBlind(run));
    deq(ev(r, d), [{ uid: d.uid, id: 'doorman', copyOf: null, event: 'blindStart', op: 'money', amount: 1 }]);
    assert.equal(run.money, m + 1);
  });
  jt('doorman', 'a skipped Blind never starts: no money', () => {
    const run = fresh();
    add(run, 'doorman');
    run.tags['1-0'] = 'secondwind';
    const m = run.money;
    const r = ok(Engine.skipBlind(run));
    deq([run.money, r.jokerEvents], [m, []]);
  });

  jt('thimble', 'when a Blind starts, one card in hand without a Seal gets a random Seal (jokerEvents sealHandCard)', () => {
    const run = fresh();
    const t = add(run, 'thimble');
    const r = ok(Engine.startBlind(run));
    const [e] = ev(r, t);
    deq([e.event, e.op, e.uids.length], ['blindStart', 'sealHandCard', 1]);
    assert.ok(run.blind.hand.includes(e.uids[0]), 'a card in hand');
    assert.ok(SEALS.includes(e.seals[0]), e.seals[0]);
    deq(run.cards.filter((c) => c.seal).map((c) => [c.uid, c.seal]), [[e.uids[0], e.seals[0]]], 'the Seal stays on that card');
  });
  jt('thimble', 'nothing when every card in hand already has a Seal', () => {
    const run = fresh();
    for (const c of run.cards) c.seal = 'cameo';
    add(run, 'thimble');
    const r = ok(Engine.startBlind(run));
    deq(r.jokerEvents, []);
    assert.ok(run.cards.every((c) => c.seal === 'cameo'));
  });

  // Balance 2026-11-23 (Jokers, engine fix): only when a Boss Blind starts (was every Blind)
  jt('moonstruck', 'when a Boss Blind starts, creates the Planet card of the most-played hand (Pair when nothing is played); a Small or Big Blind gives nothing', () => {
    const run = fresh();
    const m = add(run, 'moonstruck');
    const small = ok(Engine.startBlind(run));
    deq([ev(small, m), run.consumables], [[], []], 'a Small Blind gives nothing');
    clearBlind(run);
    nextBlind(run);
    assert.equal(run.blind.kind, 'big');
    deq(run.consumables, [], 'a Big Blind gives nothing');
    const boss = fresh();
    const mb = add(boss, 'moonstruck');
    boss.blindIndex = 2;
    boss.bosses[1] = 'smudge';
    const r = ok(Engine.startBlind(boss));
    assert.equal(boss.blind.kind, 'boss');
    deq(boss.consumables.map((k) => [k.kind, k.id]), [['planet', 'boing']]);
    deq(ev(r, mb), [{ uid: mb.uid, id: 'moonstruck', copyOf: null, event: 'blindStart', op: 'createPlanet', created: [boss.consumables[0].uid] }]);
    const fl = fresh();
    add(fl, 'moonstruck');
    fl.plays.flush = 5;
    fl.blindIndex = 2;
    fl.bosses[1] = 'smudge';
    ok(Engine.startBlind(fl));
    deq(fl.consumables.map((k) => k.id), ['swoosh'], 'the most-played hand: Flush');
  });
  jt('moonstruck', 'nothing when the consumable slots are full', () => {
    const run = fresh();
    give(run, 'tarot', 'inkpot');
    give(run, 'tarot', 'overtime');
    add(run, 'moonstruck');
    run.blindIndex = 2;
    run.bosses[1] = 'smudge';
    const r = ok(Engine.startBlind(run));
    deq([r.jokerEvents, run.consumables.length], [[], 2]);
  });

  jt('palmreader', 'a discard of exactly 2 cards of one rank creates a Tarot card (jokerEvents createTarot, not result.created)', () => {
    const run = inBlind();
    const p = add(run, 'palmreader');
    const r = ok(Engine.discard(run, setHand(run, ['7S', '7H'])));
    deq(run.consumables.map((k) => k.kind), ['tarot']);
    deq(ev(r, p), [{ uid: p.uid, id: 'palmreader', copyOf: null, event: 'discard', op: 'createTarot', created: [run.consumables[0].uid] }]);
    deq(r.created, []);
  });
  jt('palmreader', 'nothing for 2 cards of different ranks, for 3 cards with a pair, or with full slots', () => {
    const run = inBlind();
    add(run, 'palmreader');
    ok(Engine.discard(run, setHand(run, ['7S', '8H'])));
    ok(Engine.discard(run, setHand(run, ['7S', '7H', '2C'])));
    assert.equal(run.consumables.length, 0);
    give(run, 'tarot', 'inkpot');
    give(run, 'tarot', 'inkpot');
    const r = ok(Engine.discard(run, setHand(run, ['9S', '9H'])));
    deq([r.jokerEvents, run.consumables.length], [[], 2]);
  });

  jt('crystalgazer', '$2 at once when a Tarot card is used (jokerEvents money)', () => {
    const run = inBlind();
    const c = add(run, 'crystalgazer');
    const m = run.money;
    const r = ok(Engine.useConsumable(run, give(run, 'tarot', 'overtime'), []));
    deq(ev(r, c), [{ uid: c.uid, id: 'crystalgazer', copyOf: null, event: 'consumableUsed', op: 'money', amount: 2 }]);
    assert.equal(run.money, m + 2);
  });
  jt('crystalgazer', 'nothing for a Planet or a Spectral card', () => {
    const run = inBlind();
    add(run, 'crystalgazer');
    const m = run.money;
    deq(ok(Engine.useConsumable(run, give(run, 'planet', 'boing'), [])).jokerEvents, []);
    deq(ok(Engine.useConsumable(run, give(run, 'spectral', 'deadletter'), [run.blind.hand[0]])).jokerEvents, []);
    assert.equal(run.money, m);
  });

  jt('facevalue', '$1 at once per face card discarded (jokerEvents money; the discard result money is the cards\' own)', () => {
    const run = inBlind();
    const f = add(run, 'facevalue');
    const m = run.money;
    const r = ok(Engine.discard(run, setHand(run, ['KS', 'QH', '2C'])));
    deq(ev(r, f), [{ uid: f.uid, id: 'facevalue', copyOf: null, event: 'discard', op: 'money', amount: 2 }]);
    deq([r.money, run.money], [0, m + 2]);
  });
  jt('facevalue', 'nothing for a discard with no face card (Aces are not faces without Court Ace)', () => {
    const run = inBlind();
    add(run, 'facevalue');
    const m = run.money;
    const r = ok(Engine.discard(run, setHand(run, ['AS', '9H', '2C'])));
    deq([r.jokerEvents, run.money], [[], m]);
  });

  jt('carpetbag', 'each discard +1 hand size this Blind and draws up, at most +3; the next Blind starts plain', () => {
    const run = inBlind();
    const c = add(run, 'carpetbag');
    run.blind.discardsLeft = 5;
    const r = ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    deq(ev(r, c).map((e) => [e.event, e.op, e.handSize, e.drawn.length]), [['discard', 'handSizeThisBlind', 1, 3]]);
    deq([run.blind.handSizeDelta, run.blind.handSizeBy[c.uid], run.blind.hand.length, r.drawn.length], [1, 1, 9, 3]);
    for (let i = 0; i < 3; i++) ok(Engine.discard(run, [run.blind.hand[0]]));
    deq([run.blind.handSizeDelta, run.blind.handSizeBy[c.uid], run.blind.hand.length, Engine.handSizeNow(run)], [3, 3, 11, 11]);
    clearBlind(run);
    nextBlind(run);
    deq([run.blind.handSizeDelta, run.blind.hand.length], [0, 8]);
  });
  jt('carpetbag', 'switched off by The Wet Blanket: no hand size', () => {
    const run = inBlind();
    const c = add(run, 'carpetbag');
    run.blind.wetJoker = c.uid;
    const r = ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    deq([r.jokerEvents, run.blind.handSizeDelta, run.blind.hand.length], [[], 0, 8]);
  });

  jt('makeover', 'a plain card added to the deck gets a random Enhancement (Card Pack pick; jokerEvents enhanceAdded)', () => {
    const run = toShop(fresh());
    const mo = add(run, 'makeover');
    buyPack(run, 'cardnormal');
    run.pack.options[0].card.enhancement = null;
    const uid = run.pack.options[0].card.uid;
    const r = ok(Engine.packPick(run, 0));
    assert.ok(ENH.includes(cardOf(run, uid).enhancement), cardOf(run, uid).enhancement);
    deq(ev(r, mo), [{ uid: mo.uid, id: 'makeover', copyOf: null, event: 'cardAdded', op: 'enhanceAdded', uids: [uid] }]);
  });
  jt('makeover', 'a card that already has an Enhancement keeps it', () => {
    const run = toShop(fresh());
    add(run, 'makeover');
    buyPack(run, 'cardnormal');
    run.pack.options[0].card.enhancement = 'vintage';
    const uid = run.pack.options[0].card.uid;
    const r = ok(Engine.packPick(run, 0));
    deq([cardOf(run, uid).enhancement, r.jokerEvents], ['vintage', []]);
  });

  jt('coronation', 'after the hand, scored Jacks become Queens and scored Queens Kings, at once (no chain)', () => {
    const run = inBlind();
    const co = add(run, 'coronation');
    const [j1, j2, q] = setHand(run, ['JS', 'JH', 'QD']);
    const r = ok(Engine.playHand(run, [j1, j2]));
    deq(ev(r, co), [{ uid: co.uid, id: 'coronation', copyOf: null, event: 'afterHand', op: 'rankUpScored', uids: [j1, j2] }]);
    deq([cardOf(run, j1).rank, cardOf(run, j2).rank, cardOf(run, q).rank], [12, 12, 12]);
    const [q1, q2, k1] = setHand(run, ['QS', 'QH', 'KC']);
    ok(Engine.playHand(run, [q1, q2, k1]));
    deq([cardOf(run, q1).rank, cardOf(run, q2).rank, cardOf(run, k1).rank], [13, 13, 13], 'Queens to Kings, the unscored King stays');
  });
  jt('coronation', 'a card booed by The Heckler was not scored and keeps its rank', () => {
    const run = inBoss('heckler');
    add(run, 'coronation');
    const [j1, j2] = setHand(run, ['JS', 'JH']);
    ok(Engine.playHand(run, [j1, j2]));
    deq([cardOf(run, j1).rank, cardOf(run, j2).rank], [11, 12]);
  });

  jt('lamplighter', 'after the hand, scored plain Hearts become Kindled (result.enhanced); this hand does not count it', () => {
    const run = inBlind();
    add(run, 'lamplighter');
    const [kh, ks, h2] = setHand(run, ['KH', 'KS', '2H']);
    const r = ok(Engine.playHand(run, [kh, ks, h2]));
    deq([r.result.total, r.enhanced], [64, [kh]]);
    deq([cardOf(run, kh).enhancement, cardOf(run, ks).enhancement, cardOf(run, h2).enhancement], ['punchy', null, null]);
  });
  // Decided 2026-11-23 (Jokers, engine fix): Sir Motley's "every Joker that checks suits" wins over
  // Lamplighter's "own suit" (which only kept Masked cards out, and those have an Enhancement anyway).
  jt('lamplighter', 'with Sir Motley every plain scored card counts as a Heart and becomes Kindled', () => {
    const run = inBlind();
    add(run, 'lamplighter');
    add(run, 'sirmotley');
    const [s5, c5] = setHand(run, ['5S', '5C']);
    const r = ok(Engine.playHand(run, [s5, c5]));
    deq([r.enhanced, cardOf(run, s5).enhancement, cardOf(run, c5).enhancement], [[s5, c5], 'punchy', 'punchy']);
  });
  jt('lamplighter', 'an enhanced Heart keeps its Enhancement and a booed Heart is left alone; The Wash-Out does not stop it', () => {
    const run = inBlind();
    add(run, 'lamplighter');
    const [qh, qs] = setHand(run, ['QH+inked', 'QS']);
    deq(ok(Engine.playHand(run, [qh, qs])).enhanced, []);
    assert.equal(cardOf(run, qh).enhancement, 'inked');
    const heck = inBoss('heckler');
    add(heck, 'lamplighter');
    const [kh] = setHand(heck, ['KH']);
    const r = ok(Engine.playHand(heck, [kh]));
    deq([r.result.booedUid, r.enhanced, cardOf(heck, kh).enhancement], [kh, [], null], 'the lone King of Hearts was booed');
    const wash = inBoss('washout');
    add(wash, 'lamplighter');
    const [ah] = setHand(wash, ['AH']);
    deq(ok(Engine.playHand(wash, [ah])).enhanced, [ah]);
  });

  jt('hotcocoa', 'beating a Boss Blind gains a Second Wind Tag: +1 hand in the next Blind', () => {
    const run = inBoss();
    const h = add(run, 'hotcocoa');
    const r = clearBlind(run);
    deq(ev(r, h).map((e) => [e.event, e.op, e.tag]), [['blindCleared', 'gainTag', 'secondwind']]);
    deq([run.pending.extraHands, run.discovered.tags.includes('secondwind')], [1, true]);
    nextBlind(run);
    assert.equal(run.blind.handsLeft, 5);
  });
  jt('hotcocoa', 'nothing after a Small Blind', () => {
    const run = inBlind();
    add(run, 'hotcocoa');
    deq(clearBlind(run).jokerEvents, []);
    assert.equal(run.pending.extraHands, 0);
  });

  jt('shoeshine', 'beating a Boss Blind gives 2 deck cards without an Edition a Sheen, Dither or Glitch', () => {
    const run = inBoss();
    const s = add(run, 'shoeshine');
    const [e] = ev(clearBlind(run), s);
    deq([e.event, e.op, e.uids.length], ['blindCleared', 'editionDeckCards', 2]);
    e.uids.forEach((u, i) => {
      assert.equal(cardOf(run, u).edition, e.editions[i]);
      assert.ok(['gloss', 'benday', 'fourcolor'].includes(e.editions[i]), e.editions[i]);
    });
    assert.equal(run.cards.filter((c) => c.edition).length, 2);
  });
  jt('shoeshine', 'nothing after a Small Blind; only cards without an Edition are picked', () => {
    const run = inBlind();
    add(run, 'shoeshine');
    deq(clearBlind(run).jokerEvents, []);
    const boss = inBoss();
    for (const c of boss.cards.slice(1)) c.edition = 'inverted';
    const s = add(boss, 'shoeshine');
    const [e] = ev(clearBlind(boss), s);
    deq(e.uids, [boss.cards[0].uid], 'one card had no Edition');
  });

  jt('nightmoth', 'beating a Boss Blind creates a Spectral card, never Tall Tale', () => {
    for (let i = 0; i < 12; i++) {
      const run = inBoss('smudge', { seed: `MOTH${i}AB` });
      const n = add(run, 'nightmoth');
      const [e] = ev(clearBlind(run), n);
      deq([e.op, run.consumables.length, run.consumables[0].kind], ['createSpectral', 1, 'spectral']);
      assert.notEqual(run.consumables[0].id, 'originstory');
      deq(e.created, [run.consumables[0].uid]);
    }
  });
  jt('nightmoth', 'nothing after a Small Blind or with full slots', () => {
    const run = inBlind();
    add(run, 'nightmoth');
    clearBlind(run);
    assert.equal(run.consumables.length, 0);
    const boss = inBoss();
    add(boss, 'nightmoth');
    give(boss, 'tarot', 'inkpot');
    give(boss, 'tarot', 'inkpot');
    deq(clearBlind(boss).jokerEvents, []);
  });

  jt('lastlaugh', 'sold during a Blind: +1 hand this Blind (jokerEvents extraHand), plus its $2', () => {
    const run = inBlind();
    const l = add(run, 'lastlaugh');
    const r = ok(Engine.sellJoker(run, l.uid));
    deq([r.money, run.blind.handsLeft], [2, 5]);
    deq(r.jokerEvents, [{ uid: l.uid, id: 'lastlaugh', copyOf: null, event: 'sold', op: 'extraHand', hands: 1 }]);
  });
  jt('lastlaugh', 'sold in the Shop: only its sale price', () => {
    const run = toShop(fresh());
    const l = add(run, 'lastlaugh');
    const m = run.money;
    const r = ok(Engine.sellJoker(run, l.uid));
    deq([r.money, run.money, r.jokerEvents], [2, m + 2, []]);
  });
});

// =========================================================================================
describe('rule Jokers: the rule changes the action', () => {
  jt('sleightofhand', 'one discard of 1 or 2 selected cards per Blind is free (blind.freeDiscardUsed); a 3-card discard is not', () => {
    const run = inBlind();
    add(run, 'sleightofhand');
    const big = ok(Engine.discard(run, run.blind.hand.slice(0, 3)));
    deq([big.free, run.blind.discardsLeft, run.blind.freeDiscardUsed], [false, 2, false]);
    const small = ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    deq([small.free, small.cost, run.blind.discardsLeft, run.blind.freeDiscardUsed], [true, 0, 2, true]);
    assert.equal(ok(Engine.discard(run, [run.blind.hand[0]])).free, false);
    assert.equal(run.blind.discardsLeft, 1);
  });
  jt('sleightofhand', "The Fumble's extra card is not counted (2 selected + 1 dropped is free); The Tollbooth still charges $2", () => {
    const run = inBoss('fumble');
    add(run, 'sleightofhand');
    const r = ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    deq([r.free, run.blind.discardsLeft, run.blind.cardsDiscarded], [true, 3, 3]);
    const toll = inBoss('tollbooth');
    add(toll, 'sleightofhand');
    toll.money = 10;
    const t = ok(Engine.discard(toll, [toll.blind.hand[0]]));
    deq([t.free, t.cost, toll.money, toll.blind.discardsLeft], [true, 2, 8, 3]);
  });

  jt('spinningtop', 'a paid reroll costs $1 less than the Shop price: $4, then $5 (the price still rises); Engine.rerollCost says so', () => {
    const run = toShop(fresh());
    add(run, 'spinningtop');
    run.money = 20;
    assert.equal(Engine.rerollCost(run), 4);
    deq(pick(ok(Engine.reroll(run)), ['cost', 'free']), { cost: 4, free: false });
    deq([run.money, run.shop.rerollCost, Engine.rerollCost(run)], [16, 6, 5]);
    assert.equal(ok(Engine.reroll(run)).cost, 5);
  });
  jt('spinningtop', 'a free reroll stays free and does not raise the price; never below $1', () => {
    const run = toShop(fresh());
    add(run, 'spinningtop');
    run.shop.freeRerolls = 1;
    run.money = 0;
    assert.equal(Engine.rerollCost(run), 0);
    deq(pick(ok(Engine.reroll(run)), ['cost', 'free']), { cost: 0, free: true });
    assert.equal(run.shop.rerollCost, 5);
    run.shop.rerollCost = 1;
    run.money = 5;
    deq([Engine.rerollCost(run), ok(Engine.reroll(run)).cost], [1, 1]);
  });

  jt('brassabacus', 'Interest is $1 per full $4 held: $12 gives $3 (not $2), in the preview and the cash-out', () => {
    const run = inBlind();
    add(run, 'brassabacus');
    run.money = 12;
    assert.equal(Engine.interestPreview(run), 3);
    clearBlind(run);
    deq(run.cashout.lines.find((l) => l.label === 'Interest'), { label: 'Interest', amount: 3 });
  });
  jt('brassabacus', 'the cap does not change ($40 gives $5); switched off by The Wet Blanket it is $1 per $5 again', () => {
    const run = inBlind();
    const b = add(run, 'brassabacus');
    run.money = 40;
    assert.equal(Engine.interestPreview(run), 5);
    run.money = 12;
    run.blind.wetJoker = b.uid;
    assert.equal(Engine.interestPreview(run), 2);
  });

  jt('merrygoround', 'J-Q-K-A-2 and K-A-2-3-4 wrap too (preview of the real hand); A-2-3-4-5 still counts; a gap does not', () => {
    const run = inBlind();
    add(run, 'merrygoround');
    for (const specs of [['JS', 'QH', 'KD', 'AC', '2S'], ['KS', 'AH', '2D', '3C', '4S'], ['AS', '2H', '3D', '4C', '5S']]) {
      assert.equal(Engine.preview(run, setHand(run, specs)).handId, 'straight', specs.join(' '));
    }
    assert.equal(Engine.preview(run, setHand(run, ['QS', 'KH', 'AD', '2C', '4S'])).handId, 'high');
    assert.equal(score(run, 'QH KH AH 2H 3H').r.handId, 'straightflush', 'a wrapped Straight in one suit');
  });

  jt('courtace', 'Face Value pays for a discarded Ace and Portrait Gallery counts a held Ace; an Ace still scores 11 Chips', () => {
    const run = inBlind();
    add(run, 'courtace');
    add(run, 'facevalue');
    add(run, 'portraitgallery');
    const m = run.money;
    ok(Engine.discard(run, setHand(run, ['AS', '2C'])));
    assert.equal(run.money, m + 1);
    deq(totals(score(run, 'KS KH', 'AD').r), [32, 4, 128]);
    assert.equal(score(run, 'AS').r.chips, 16);
  });

  jt('fandancer', 'preview: four Hearts and a Spade are a Flush scoring the Hearts; 5H to 9S is a Straight Flush scoring all 5; a Full House still wins', () => {
    const run = inBlind();
    add(run, 'fandancer');
    const u = setHand(run, ['2H', '5H', '9H', 'JH', 'KS']);
    deq(pick(Engine.preview(run, u), ['handId', 'scoringUids']), { handId: 'flush', scoringUids: u.slice(0, 4) });
    const { r } = score(run, '5H 6H 7H 8H 9S');
    deq([r.handId, r.scoringUids.length, r.total], ['straightflush', 5, 1160]);
    assert.equal(score(run, 'KS KH KD 5S 5H').r.handId, 'fullhouse');
  });

  jt('helpinghand', 'The Candlemaker takes 3 selected cards (select [1, 3]); The Tailor 2 to 4', () => {
    const run = inBlind();
    add(run, 'helpinghand');
    const k = give(run, 'tarot', 'inkpot');
    deq(Engine.consumableInfo(run, k).select, [1, 3]);
    const sel = run.blind.hand.slice(0, 3);
    const r = ok(Engine.useConsumable(run, k, sel));
    deq(r.effect.uids, sel);
    for (const u of sel) assert.equal(cardOf(run, u).enhancement, 'inked');
    fails(Engine.canUseConsumable(run, give(run, 'tarot', 'inkpot'), run.blind.hand.slice(0, 4)), 'Select 1 to 3 cards.');
    fails(Engine.canUseConsumable(run, give(run, 'tarot', 'paintbucket'), run.blind.hand.slice(0, 5)), 'Select 2 to 4 cards.');
  });
  jt('helpinghand', 'without it 3 cards are too many; Spectral and 0-card Tarot cards keep their range; Carbon Copy copies each of 2 cards', () => {
    const run = inBlind();
    fails(Engine.canUseConsumable(run, give(run, 'tarot', 'inkpot'), run.blind.hand.slice(0, 3)), 'Select 1 or 2 cards.');
    run.consumables = [];
    add(run, 'helpinghand');
    deq(Engine.consumableInfo(run, give(run, 'spectral', 'cursedcoin')).select, [1, 2]);
    deq(Engine.consumableInfo(run, give(run, 'tarot', 'overtime')).select, [0, 0]);
    run.consumables = [];
    const sel = run.blind.hand.slice(0, 2);
    const r = ok(Engine.useConsumable(run, give(run, 'tarot', 'carboncopy'), sel));
    deq([r.effect.created.length, r.effect.sourceUids, run.cards.length], [2, sel, 54]);
  });

  jt('nestingdolls', 'Matching Socks accepts a Two Pair (it contains a Pair); detection and base values do not change', () => {
    const run = inBlind();
    const ms = add(run, 'matchingsocks');
    add(run, 'nestingdolls');
    const { r } = score(run, 'KS KH 5S 5H');
    deq([r.handId, r.steps[0].label, r.total], ['twopair', 'Two Pair lv.1', 462]);
    deq(own(r, ms), [['chips', 25, '+25'], ['mult', 4, '+4']]);
  });
  jt('nestingdolls', 'High Card accepts only itself; Signature Move counts a Three of a Kind when Pair is the most-played hand', () => {
    const run = inBlind();
    const sf = add(run, 'solofiddler');
    const sm = add(run, 'signaturemove');
    add(run, 'nestingdolls');
    run.plays.pair = 3;
    const { r } = score(run, 'KS KH KD');
    deq([own(r, sf), own(r, sm), r.total], [[], [['xmult', 1.5, '×1.5']], 279]);
  });

  jt('luckydip', 'the first pack bought in a Shop visit gets 1 more pick (shop.packsBought counts); the second gets none', () => {
    const run = toShop(fresh());
    add(run, 'luckydip');
    buyPack(run, 'cardnormal');
    deq([run.pack.picksLeft, run.shop.packsBought], [2, 1]);
    ok(Engine.packSkip(run));
    buyPack(run, 'cardnormal');
    deq([run.pack.picksLeft, run.shop.packsBought], [1, 2]);
  });
  jt('luckydip', 'a free pack from a Tag is unchanged; the next Shop visit counts again', () => {
    const run = toShop(fresh());
    add(run, 'luckydip');
    ok(Engine.leaveShop(run));
    run.tags['1-1'] = 'grabbag';
    ok(Engine.skipBlind(run));
    assert.equal(run.pack.picksLeft, 1);
    ok(Engine.packSkip(run));
    run.bosses[1] = 'smudge';
    toShop(run);
    assert.equal(run.shop.packsBought, 0);
    buyPack(run, 'jokermega');
    assert.equal(run.pack.picksLeft, 3);
  });

  jt('smoothtalker', 'Boss Blind targets x0.8: 600 becomes 480 in the preview and when the Boss Blind starts', () => {
    const run = fresh();
    run.bosses[1] = 'smudge';
    add(run, 'smoothtalker');
    deq([0, 1, 2].map((i) => Engine.blindTarget(run, 1, i)), [300, 450, 480]);
    deq(Engine.blindsForAnte(run).map((b) => b.target), [300, 450, 480]);
    run.blindIndex = 2;
    ok(Engine.startBlind(run));
    assert.equal(run.blind.target, 480);
  });
  jt('smoothtalker', 'sold after the Boss Blind started, the target stays; the preview is back to 600', () => {
    const run = fresh();
    run.bosses[1] = 'smudge';
    const s = add(run, 'smoothtalker');
    run.blindIndex = 2;
    ok(Engine.startBlind(run));
    ok(Engine.sellJoker(run, s.uid));
    deq([run.blind.target, Engine.blindTarget(run, 1, 2)], [480, 600]);
  });

  jt('usher', 'Vouchers cost half, rounded up: $10 becomes $5, and $4 with Season Pass', () => {
    const run = inBlind();
    add(run, 'usher');
    clearBlind(run);
    ok(Engine.collect(run));
    assert.equal(run.shop.items.find((i) => i.slot === 'voucher').price, 5);
    const sp = inBlind({ seed: 'USHERSP2' });
    add(sp, 'usher');
    sp.vouchers.push('dollaroff');
    clearBlind(sp);
    ok(Engine.collect(sp));
    assert.equal(sp.shop.items.find((i) => i.slot === 'voucher').price, 4);
  });
  jt('usher', 'sold in the Shop, the unsold Voucher is $10 again at once', () => {
    const run = inBlind();
    const u = add(run, 'usher');
    clearBlind(run);
    ok(Engine.collect(run));
    const i = run.shop.items.findIndex((x) => x.slot === 'voucher');
    assert.equal(run.shop.items[i].price, 5);
    ok(Engine.sellJoker(run, u.uid));
    assert.equal(run.shop.items[i].price, 10);
  });

  jt('jackofalltrades', 'four Kings and a Jack: a Four of a Kind with all five scoring; the Jack keeps its 10 Chips', () => {
    const run = inBlind();
    add(run, 'jackofalltrades');
    const { r } = score(run, 'KS KH KD KC JS');
    deq([r.handId, r.scoringUids.length, r.total], ['four', 5, (64 + 50) * 6]);
  });
  jt('jackofalltrades', 'the strongest hand wins: two Jacks and a pair of 5s are a Four of a Kind (preview agrees)', () => {
    const run = inBlind();
    add(run, 'jackofalltrades');
    const u = setHand(run, ['JS', 'JH', '5S', '5H', '9C']);
    deq(pick(Engine.preview(run, u), ['handId', 'scoringUids']), { handId: 'four', scoringUids: u.slice(0, 4) });
    assert.equal(score(run, 'JS JH 5S 5H 9C').r.total, (64 + 30) * 6);
  });

  jt('kaleidoscope', "a Joker's Sheen fires twice before it acts; a Phantom card gives its rank as Mult twice", () => {
    const run = inBlind();
    add(run, 'kaleidoscope');
    const t = add(run, 'tindrum', 'gloss');
    const { r } = score(run, 'KS KH');
    deq(r.steps.filter((s) => s.uid === t.uid).map((s) => [s.via, s.kind, s.amount, s.edition]), [['edition', 'chips', 40, 'gloss'], ['edition', 'chips', 40, 'gloss'], ['joker', 'chips', 40, null]]);
    assert.equal(r.total, (32 + 120) * 2);
    const ph = inBlind();
    add(ph, 'kaleidoscope');
    deq(totals(score(ph, 'KS+inverted KH').r), [22, 22, 484]);
  });
  jt('kaleidoscope', 'nothing to double under The Blackout', () => {
    const run = inBoss('censor');
    add(run, 'kaleidoscope');
    add(run, 'tindrum', 'gloss');
    deq(totals(score(run, 'KS+gloss KH').r), [72, 2, 144]);
  });

  jt('goldenhour', 'in a Blind, money steps from cards and Jokers pay double (+$2 steps); playHand pays them', () => {
    const run = inBlind();
    add(run, 'goldenhour');
    add(run, 'goldtooth');
    const { r } = score(run, 'AS AH+dimestore');
    deq(r.steps.filter((s) => s.kind === 'money').map((s) => [s.source, s.amount, s.label]), [['joker', 2, '+$2'], ['card', 2, '+$2'], ['joker', 2, '+$2']]);
    const m = run.money;
    const res = ok(Engine.playHand(run, setHand(run, ['AS', 'AH'])));
    deq([res.money, run.money], [4, m + 4]);
  });
  jt('goldenhour', 'Doorman pays $2 and a Crumpled discard $2; Tarot money and cash-out lines are not doubled; nothing doubles outside a Blind', () => {
    const run = fresh();
    add(run, 'goldenhour');
    add(run, 'doorman');
    add(run, 'couponclipper');
    add(run, 'goldtooth');
    const m = run.money;
    ok(Engine.startBlind(run));
    assert.equal(run.money, m + 2);
    const d = ok(Engine.discard(run, setHand(run, ['5S+crumpled'])));
    assert.equal(d.money, 2);
    const m2 = run.money;
    ok(Engine.useConsumable(run, give(run, 'tarot', 'paperroute'), []));
    assert.equal(run.money, m2 + 4, "Busker's Hat: $3 + $1 per Ante");
    clearBlind(run);
    deq(run.cashout.lines.find((l) => l.label === 'Coupon Clipper'), { label: 'Coupon Clipper', amount: 2 });
    ok(Engine.collect(run));
    deq(score(run, 'AS').r.steps.filter((s) => s.kind === 'money').map((s) => s.amount), [1], 'in the Shop: +$1');
  });

  jt('sirmotley', 'The Wash-Out does not switch it off; every Straight is a Straight Flush; Red Nose sees every card as a Heart', () => {
    const wash = inBoss('washout');
    add(wash, 'sirmotley');
    deq([score(wash, '2S 5H 9D JC KS').r.handId, score(wash, '2S 5H 9D JC KS').r.total], ['flush', 296]);
    assert.equal(score(wash, '5S 6H 7D 8C 9S').r.total, 1160);
    const run = inBlind();
    add(run, 'sirmotley');
    const rn = add(run, 'rednose');
    const { r } = score(run, 'KS KC');
    deq([own(r, rn), r.total], [[['mult', 2, '+2'], ['mult', 2, '+2']], 192]);
  });
});

// =========================================================================================
// The copiers (§3.4 copy). Their steps keep the copier as source (uid) and name the target:
// copyOf (the target's id) and jokerName ('Stand-In (as Tin Drum)').
const named = (r, j) => r.steps.filter((s) => s.uid === j.uid || s.jokerUid === j.uid).map((s) => [s.label, s.copyOf, s.jokerName]);

describe('Stand-In (copy: random)', () => {
  jt('standin', 'copies a hand Joker: a second +40 from Tin Drum (trace, copyOf, jokerName); jokerCopies and jokerText name it', () => {
    TRACED.add('standin');
    const run = inBlind();
    const t = add(run, 'tindrum');
    const s = add(run, 'standin');
    assert.equal(s.state.target, t.uid, 'picked when gained: the only other Joker');
    const { r, p, h } = score(run, 'KS KH');
    deq(trace(r, namesOf(p, h, { T: t, S: s })), [...KK, 'joker:T:-:joker:chips:+40=72x2', 'joker:S:-:joker:chips:+40<tindrum=112x2']);
    deq([r.total, named(r, s)], [224, [['+40', 'tindrum', 'Stand-In (as Tin Drum)']]]);
    deq(Engine.jokerCopies(run, s.uid), [{ id: 'tindrum', uid: t.uid }]);
    assert.ok(Engine.jokerText(run, s.uid).endsWith('(copying: Tin Drum)'));
  });
  jt('standin', 'copies a card Joker: Paper Crown fires twice on each face card', () => {
    const run = inBlind();
    const c = add(run, 'papercrown');
    const s = add(run, 'standin');
    const { r, p, h } = score(run, 'QS QH');
    deq(trace(r, namesOf(p, h, { C: c, S: s })), [
      'base:-:-:-:note:Pair lv.1=12x2', S('p0:-:rank:chips:+10=22x2'), 'joker:C:p0:joker:chips:+12=34x2', 'joker:S:p0:joker:chips:+12<papercrown=46x2',
      S('p1:-:rank:chips:+10=56x2'), 'joker:C:p1:joker:chips:+12=68x2', 'joker:S:p1:joker:chips:+12<papercrown=80x2',
    ]);
    assert.equal(r.total, 160);
  });
  // Changed 2026-11-23 (Jokers, engine fix): a copy runs its target's event operations except the
  // state ones, so gains stay with the target and a Doorman copy pays too.
  jt('standin', "copies an event Joker: Magpie gains once per discard (the copy reads Magpie's state); Doorman pays for both", () => {
    const run = inBlind();
    const m = add(run, 'magpie');
    const s = add(run, 'standin');
    m.state.chips = 10;
    assert.equal(score(run, 'KS KH').r.total, (32 + 20) * 2);
    const r = ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    deq([live(run, m.uid).state.chips, live(run, s.uid).state, ev(r, s)], [14, { target: m.uid }, []]);
    assert.equal(score(run, 'KS KH').r.total, (32 + 28) * 2);
    const door = fresh();
    add(door, 'doorman');
    const sd = add(door, 'standin');
    const before = door.money;
    const st = ok(Engine.startBlind(door));
    assert.equal(door.money, before + 2, 'Doorman pays $1 and its copy $1');
    deq(st.jokerEvents.filter((e) => e.uid === sd.uid).map((e) => [e.id, e.copyOf, e.event, e.op, e.amount]), [['standin', 'doorman', 'blindStart', 'money', 1]]);
  });
  jt('standin', 'copies an event Joker: Thimble seals 2 cards in hand; Face Value pays twice for each face card discarded', () => {
    const run = fresh();
    add(run, 'thimble');
    const s = add(run, 'standin');
    const st = ok(Engine.startBlind(run));
    const seals = st.jokerEvents.filter((e) => e.op === 'sealHandCard');
    deq(seals.map((e) => [e.uid === s.uid ? 'copy' : 'thimble', e.copyOf, e.uids.length]), [['thimble', null, 1], ['copy', 'thimble', 1]]);
    assert.equal(run.blind.hand.filter((u) => Engine.getCard(run, u).seal).length, 2);
    const fv = inBlind();
    add(fv, 'facevalue');
    add(fv, 'standin');
    const m = fv.money;
    const d = ok(Engine.discard(fv, setHand(fv, ['KS', 'QH', '5C'])));
    assert.equal(fv.money, m + 4, 'two face cards: $2 from Face Value and $2 from its copy');
    deq(d.jokerEvents.filter((e) => e.op === 'money').map((e) => [e.copyOf, e.amount]), [[null, 2], ['facevalue', 2]]);
  });
  jt('standin', 'copies a copier: The Puppet Master resolves to its two neighbours (jokerCopies lists the final targets)', () => {
    const run = inBlind();
    const t = add(run, 'tindrum');
    const pm = add(run, 'puppetmaster');
    const e = add(run, 'emberimp');
    const s = add(run, 'standin');
    s.state.target = pm.uid;
    deq(Engine.jokerCopies(run, s.uid), [{ id: 'tindrum', uid: t.uid }, { id: 'emberimp', uid: e.uid }]);
    const { r } = score(run, 'KS KH');
    deq(named(r, s), [['+40', 'tindrum', 'Stand-In (as Tin Drum)'], ['+5', 'emberimp', 'Stand-In (as Ember Imp)']]);
    assert.equal(r.total, (32 + 120) * (2 + 15));
    // changed 2026-11-23 (Jokers, engine fix): the live text names the final targets, as jokerCopies does
    assert.ok(Engine.jokerText(run, s.uid).endsWith('(copying: Tin Drum and Ember Imp)'));
    assert.ok(Engine.jokerText(run, pm.uid).endsWith('(copying: Tin Drum and Ember Imp)'));
  });
  jt('standin', 'the live text names what the chain ends at: an Old Flame that holds nothing gives "copying: nothing"; one holding Tin Drum "copying: Tin Drum"', () => {
    const run = inBlind();
    const o = add(run, 'oldflame');
    const s = add(run, 'standin');
    assert.equal(s.state.target, o.uid);
    deq([Engine.jokerCopies(run, s.uid), Engine.jokerText(run, s.uid).endsWith('(copying: nothing)')], [[], true]);
    ok(Engine.sellJoker(run, add(run, 'tindrum').uid));
    s.state.target = o.uid;
    deq([Engine.jokerCopies(run, s.uid), Engine.jokerText(run, s.uid).endsWith('(copying: Tin Drum)')], [[{ id: 'tindrum', uid: null }], true]);
  });
  jt('standin', 'with no target it picks as soon as another Joker joins (it used to wait for the next Blind)', () => {
    const run = fresh();
    const s = add(run, 'standin');
    assert.equal(s.state.target, null);
    const t = add(run, 'tindrum');
    deq([s.state.target, Engine.jokerText(run, s.uid).endsWith('(copying: Tin Drum)')], [t.uid, true]);
  });
  jt('standin', 'copies a Legendary Joker: with Madame Echo every scored card gets two extra passes; it never copies another Stand-In', () => {
    const run = inBlind();
    const e = add(run, 'madameecho');
    const s = add(run, 'standin');
    const { r } = score(run, 'KS KH');
    deq([r.total, againBy(r, e), againBy(r, s)], [144, 2, 2]);
    deq(named(r, s), [['Encore!', 'madameecho', 'Stand-In (as Madame Echo)'], ['Encore!', 'madameecho', 'Stand-In (as Madame Echo)']]);
    const two = fresh();
    const t = add(two, 'tindrum');
    const a = add(two, 'standin');
    const b = add(two, 'standin');
    deq([a.state.target, b.state.target], [t.uid, t.uid], 'when gained');
    ok(Engine.startBlind(two));
    deq([live(two, a.uid).state.target, live(two, b.uid).state.target], [t.uid, t.uid], 'at Blind start');
  });
  jt('standin', 'with no other Joker it copies nothing; when its target leaves it picks again at once; each Blind start picks again', () => {
    const run = inBlind();
    const s = add(run, 'standin');
    deq([s.state.target, Engine.jokerCopies(run, s.uid), named(score(run, 'KS KH').r, s)], [null, [], []]);
    const t = add(run, 'tindrum');
    const e = add(run, 'emberimp');
    s.state.target = t.uid;
    ok(Engine.sellJoker(run, t.uid));
    assert.equal(live(run, s.uid).state.target, e.uid, 'the only other Joker left');
    ok(Engine.sellJoker(run, e.uid));
    assert.equal(live(run, s.uid).state.target, null);
    const many = fresh({ seed: 'STANDIN9' });
    const ids = ['tindrum', 'emberimp', 'quartet', 'peacock'].map((id) => add(many, id).uid);
    const sm = add(many, 'standin');
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      ok(Engine.startBlind(many));
      const tgt = live(many, sm.uid).state.target;
      assert.ok(ids.includes(tgt), `a random other Joker: ${tgt}`);
      seen.add(tgt);
      many.phase = 'blind-select'; // back to the Blind select by hand, to start the Blind again
      many.blind = null;
    }
    assert.ok(seen.size > 1, 'it picks again each time');
  });
  jt('standin', 'copies a cash-out line and a rule: "Stand-In (as Early Bird)"; a copy of Fan Dancer works while Fan Dancer is switched off', () => {
    const run = inBlind();
    add(run, 'earlybird');
    add(run, 'standin');
    clearBlind(run);
    deq(run.cashout.lines.filter((l) => /Early Bird/.test(l.label)), [{ label: 'Early Bird', amount: 3 }, { label: 'Stand-In (as Early Bird)', amount: 3 }]);
    const wet = inBlind();
    const f = add(wet, 'fandancer');
    add(wet, 'standin');
    wet.blind.wetJoker = f.uid;
    assert.equal(score(wet, '2H 5H 9H JH KS').r.handId, 'flush');
  });
});

describe('Old Flame (copy: lastSold)', () => {
  jt('oldflame', 'before any sale it copies nothing ("nothing yet"); selling itself takes nothing', () => {
    const run = inBlind();
    const o = add(run, 'oldflame');
    deq([o.state, Engine.jokerCopies(run, o.uid), named(score(run, 'KS KH').r, o)], [{ copy: null }, [], []]);
    assert.ok(Engine.jokerText(run, o.uid).endsWith('(nothing yet)'));
    const r = ok(Engine.sellJoker(run, o.uid));
    deq(r.jokerEvents, []);
  });
  jt('oldflame', 'takes on a sold hand Joker (op copy): +40 as Old Flame (as Tin Drum), with no Edition of its own', () => {
    TRACED.add('oldflame');
    const run = inBlind();
    const o = add(run, 'oldflame');
    const t = add(run, 'tindrum', 'gloss');
    const r = ok(Engine.sellJoker(run, t.uid));
    deq(r.jokerEvents, [{ uid: o.uid, id: 'oldflame', copyOf: 'tindrum', event: 'jokerSold', op: 'copy', from: t.uid }]);
    deq(live(run, o.uid).state.copy, { id: 'tindrum', state: {} });
    const { r: s, p, h } = score(run, 'KS KH');
    deq(trace(s, namesOf(p, h, { O: o })), [...KK, 'joker:O:-:joker:chips:+40<tindrum=72x2']);
    deq(named(s, o), [['+40', 'tindrum', 'Old Flame (as Tin Drum)']]);
    deq(Engine.jokerCopies(run, o.uid), [{ id: 'tindrum', uid: null }]);
    assert.ok(Engine.jokerText(run, o.uid).endsWith('(now: Tin Drum)'));
  });
  jt('oldflame', 'takes on a card Joker: Lucky Sevens, each scored 7 +7 Mult; a later sale replaces it', () => {
    const run = inBlind();
    const o = add(run, 'oldflame');
    const l = add(run, 'luckysevens');
    const t = add(run, 'tindrum');
    ok(Engine.sellJoker(run, l.uid));
    assert.equal(score(run, '7S 7H').r.total, 416 + 40 * 16);
    ok(Engine.sellJoker(run, t.uid));
    deq(live(run, o.uid).state.copy, { id: 'tindrum', state: {} });
    assert.equal(score(run, '7S 7H').r.total, (26 + 40) * 2);
  });
  jt('oldflame', 'runs the copied event Joker\'s events on its own copied state: Magpie keeps gathering inside Old Flame', () => {
    const run = inBlind();
    const o = add(run, 'oldflame');
    const m = add(run, 'magpie');
    m.state.chips = 10;
    ok(Engine.sellJoker(run, m.uid));
    const r = ok(Engine.discard(run, run.blind.hand.slice(0, 3)));
    deq(ev(r, o), [stateEvent(o, 'oldflame', 'discard', 'chips', 10, 16, 'magpie')]);
    deq(live(run, o.uid).state.copy, { id: 'magpie', state: { chips: 16 } });
    assert.equal(score(run, 'KS KH').r.total, (32 + 16) * 2);
    const back = roundTrip(run);
    deq(back.jokers[0].state, { copy: { id: 'magpie', state: { chips: 16 } } });
  });
  jt('oldflame', 'an ability that would eat itself leaves Old Flame with nothing (Dripping Candle melts: op forgot)', () => {
    const run = inBlind();
    const o = add(run, 'oldflame');
    const d = add(run, 'drippingcandle');
    d.state.mult = 1;
    ok(Engine.sellJoker(run, d.uid));
    const r = ok(Engine.playHand(run, [run.blind.hand[run.blind.hand.length - 1]]));
    deq(ev(r, o), [stateEvent(o, 'oldflame', 'afterHand', 'mult', 1, 0, 'drippingcandle'), { uid: o.uid, id: 'oldflame', copyOf: 'drippingcandle', event: 'afterHand', op: 'forgot' }]);
    deq([r.eaten, live(run, o.uid).state.copy], [[], null]);
  });
  jt('oldflame', 'takes on a copier: a sold Stand-In still copies its target (the chain resolves to Tin Drum)', () => {
    const run = inBlind();
    const o = add(run, 'oldflame');
    const t = add(run, 'tindrum');
    const s = add(run, 'standin');
    s.state.target = t.uid;
    ok(Engine.sellJoker(run, s.uid));
    deq(live(run, o.uid).state.copy, { id: 'standin', state: { target: t.uid } });
    deq(Engine.jokerCopies(run, o.uid), [{ id: 'tindrum', uid: t.uid }]);
    deq(named(score(run, 'KS KH').r, o), [['+40', 'tindrum', 'Old Flame (as Tin Drum)']]);
  });
  jt('oldflame', 'takes on a Legendary Joker: The Ringmaster counts the Jokers other than Old Flame (x1.3)', () => {
    const run = inBlind();
    const o = add(run, 'oldflame');
    const t = add(run, 'tindrum');
    const rm = add(run, 'ringmaster');
    ok(Engine.sellJoker(run, rm.uid));
    const { r, p, h } = score(run, 'KS KH');
    deq(trace(r, namesOf(p, h, { O: o, T: t })), [...KK, 'joker:O:-:joker:xmult:×1.3<ringmaster=32x2.6', 'joker:T:-:joker:chips:+40=72x2.6']);
    assert.equal(r.total, 187);
  });
  jt('oldflame', 'switched off by The Wet Blanket, it takes nothing from a sale', () => {
    const run = fresh();
    const o = add(run, 'oldflame');
    const t = add(run, 'tindrum');
    run.blindIndex = 2;
    run.bosses[1] = 'wetblanket';
    ok(Engine.startBlind(run));
    assert.equal(run.blind.wetJoker, o.uid);
    const r = ok(Engine.sellJoker(run, t.uid));
    deq([r.jokerEvents, live(run, o.uid).state.copy], [[], null]);
  });
});

describe('The Puppet Master (copy: neighbours)', () => {
  jt('puppetmaster', 'alone it copies nothing ("copying: nothing")', () => {
    const run = inBlind();
    const pm = add(run, 'puppetmaster');
    deq([Engine.jokerCopies(run, pm.uid), named(score(run, 'KS KH').r, pm), score(run, 'KS KH').r.total], [[], [], 64]);
    assert.ok(Engine.jokerText(run, pm.uid).endsWith('(copying: nothing)'));
  });
  jt('puppetmaster', 'copies the hand Joker on its left; at the right end of the rack it has one neighbour', () => {
    TRACED.add('puppetmaster');
    const run = inBlind();
    const t = add(run, 'tindrum');
    const pm = add(run, 'puppetmaster');
    const { r, p, h } = score(run, 'KS KH');
    deq(trace(r, namesOf(p, h, { T: t, P: pm })), [...KK, 'joker:T:-:joker:chips:+40=72x2', 'joker:P:-:joker:chips:+40<tindrum=112x2']);
    deq(named(r, pm), [['+40', 'tindrum', 'The Puppet Master (as Tin Drum)']]);
    deq(Engine.jokerCopies(run, pm.uid), [{ id: 'tindrum', uid: t.uid }]);
  });
  jt('puppetmaster', 'copies left then right: a card Joker (Paper Crown) and a hand Joker (Ember Imp)', () => {
    const run = inBlind();
    const c = add(run, 'papercrown');
    const pm = add(run, 'puppetmaster');
    const e = add(run, 'emberimp');
    deq(Engine.jokerCopies(run, pm.uid), [{ id: 'papercrown', uid: c.uid }, { id: 'emberimp', uid: e.uid }]);
    assert.ok(Engine.jokerText(run, pm.uid).endsWith('(copying: Paper Crown and Ember Imp)'));
    const { r } = score(run, 'KS KH');
    deq(named(r, pm), [['+12', 'papercrown', 'The Puppet Master (as Paper Crown)'], ['+12', 'papercrown', 'The Puppet Master (as Paper Crown)'], ['+5', 'emberimp', 'The Puppet Master (as Ember Imp)']]);
    assert.equal(r.total, 80 * 12);
  });
  jt('puppetmaster', 'copies an event Joker by its state; the event runs once (Magpie)', () => {
    const run = inBlind();
    const m = add(run, 'magpie');
    add(run, 'puppetmaster');
    m.state.chips = 10;
    ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    assert.equal(live(run, m.uid).state.chips, 14);
    assert.equal(score(run, 'KS KH').r.total, (32 + 28) * 2);
  });
  // changed 2026-11-23 (Jokers, engine fix): a copy runs its targets' event operations (not the state ones)
  jt('puppetmaster', "runs its neighbours' event operations: next to Face Value two face cards discarded pay $2 twice; next to Thimble two cards are sealed", () => {
    const run = inBlind();
    add(run, 'facevalue');
    const pm = add(run, 'puppetmaster');
    const m = run.money;
    const d = ok(Engine.discard(run, setHand(run, ['KS', 'QH', '5C'])));
    deq([run.money - m, d.jokerEvents.filter((e) => e.uid === pm.uid).map((e) => [e.copyOf, e.op, e.amount])], [4, [['facevalue', 'money', 2]]]);
    const th = fresh();
    add(th, 'thimble');
    add(th, 'puppetmaster');
    const st = ok(Engine.startBlind(th));
    deq([st.jokerEvents.filter((e) => e.op === 'sealHandCard').length, th.blind.hand.filter((u) => cardOf(th, u).seal).length], [2, 2]);
  });
  jt('carpetbag', 'each copy is its own Joker: a Stand-In copying Carpetbag adds its own +1 per discard, at most +3', () => {
    const run = inBlind();
    add(run, 'carpetbag');
    const s = add(run, 'standin');
    for (let i = 0; i < 3; i++) ok(Engine.discard(run, [run.blind.hand[0]]));
    deq([run.blind.handSizeDelta, plain(run.blind.handSizeBy)[s.uid], Engine.handSizeNow(run)], [6, 3, 14]);
    assert.ok(Engine.jokerText(run, s.uid).endsWith('(copying: Carpetbag)'));
  });
  jt('puppetmaster', 'copies a copier: a Stand-In on its left resolves to its target; two Puppet Masters side by side do not loop', () => {
    const run = inBlind();
    const t = add(run, 'tindrum');
    const s = add(run, 'standin');
    const pm = add(run, 'puppetmaster');
    ok(Engine.reorderJokers(run, [s.uid, pm.uid, t.uid]));
    assert.equal(live(run, s.uid).state.target, t.uid);
    deq(Engine.jokerCopies(run, pm.uid), [{ id: 'tindrum', uid: t.uid }, { id: 'tindrum', uid: t.uid }]);
    assert.equal(score(run, 'KS KH').r.total, (32 + 160) * 2);
    const loop = inBlind();
    const t2 = add(loop, 'tindrum');
    const a = add(loop, 'puppetmaster');
    const b = add(loop, 'puppetmaster');
    deq([Engine.jokerCopies(loop, a.uid), Engine.jokerCopies(loop, b.uid)], [[{ id: 'tindrum', uid: t2.uid }], [{ id: 'tindrum', uid: t2.uid }]]);
    assert.equal(score(loop, 'KS KH').r.total, (32 + 120) * 2);
  });
  jt('puppetmaster', 'copies a Legendary Joker: next to Madame Echo every scored card gets two extra passes', () => {
    const run = inBlind();
    const e = add(run, 'madameecho');
    const pm = add(run, 'puppetmaster');
    const { r } = score(run, 'KS KH');
    deq([r.total, againBy(r, e), againBy(r, pm)], [144, 2, 2]);
  });
  jt('puppetmaster', 'copies rules too: next to Merry-Go-Round switched off by The Wet Blanket, Straights still wrap', () => {
    const run = inBlind();
    const mg = add(run, 'merrygoround');
    add(run, 'puppetmaster');
    run.blind.wetJoker = mg.uid;
    deq([score(run, 'QS KH AD 2C 3S').r.handId, score(run, 'QS KH AD 2C 3S').r.total], ['straight', 280]);
  });
});

// =========================================================================================
describe('coverage of this suite', () => {
  test('every one of the 120 Jokers has at least 2 tests, and more than 30 have an exact trace', () => {
    const thin = JOKER_IDS.filter((id) => COVER[id] < 2).map((id) => `${id} (${COVER[id]})`);
    deq(thin, [], 'Jokers with fewer than 2 tests');
    assert.equal(Object.keys(COVER).length, 120);
    assert.ok(TRACED.size >= 30, `${TRACED.size} Jokers traced`);
  });
});
