/* Rules engine v3 (TW.Engine). SPEC.md sections 2 and 4.
 *
 * All state lives in one plain-JSON run object (no functions, Sets or Maps), so
 * Engine.serialize / Engine.deserialize round-trip it exactly. Actions mutate the run in
 * place and return { ok:true, ... } or { ok:false, error:'<sentence for the player>' };
 * invalid player actions never throw. Every random roll comes from the seeded PRNG kept in
 * run.rng (mulberry32 over an FNV-1a hash of the seed); only Engine.randomSeed() draws on
 * the platform's unseeded generator. No browser, clock or storage access: safe to load in
 * Node after content.js.
 *
 * The rules read data, not ids, wherever they can: Joker effects come from each Joker's
 * content row (the vocabulary is CONDITIONS, COUNTERS, EVENT_OPS, SETTERS and RULE_WORDS
 * below, SPEC 3.4), Boss Blinds from rule flags, Vouchers, Tags, Decks and Stakes from their
 * fields, and Tarot, Planet and Spectral cards from operation fields applied in a fixed order
 * (OPS). Adding a Joker that uses the existing vocabulary needs only a content row, and
 * Engine.jokerProblems(row) checks a row against that vocabulary.
 *
 * Copies (rule word copy: Stand-In, Old Flame, The Puppet Master) resolve through facets: a
 * Joker acts with its own row, or a copier with the rows of its final targets (resolveFacets:
 * loops, missing targets and chains deeper than MAX_COPY_DEPTH resolve to nothing). Every
 * trigger point (scoring, cash-out, events, rules, live text) walks the facets, so a copy acts
 * as its target everywhere the design says, and its steps name the copier with the target.
 */
(() => {
  'use strict';
  const TW = (globalThis.TW = globalThis.TW || {});
  const C = TW.Content;
  if (!C || !Array.isArray(C.HANDS) || !Array.isArray(C.JOKERS)) throw new Error('TW.Engine: content.js must load before engine.js');

  const VERSION = 3;
  const RECORDS_VERSION = 2;
  const TIMES = '×';

  // ---------------------------------------------------------------------------
  // Content snapshot (taken at load, so later UI code can't disturb the rules)
  // ---------------------------------------------------------------------------
  // Every table the rules look an id up in has no prototype, so an id named after an
  // Object.prototype member ('constructor', 'toString', '__proto__', ...) is unknown like any
  // other (2026-11-24 (final review): STAKE.toString and DECK.constructor counted as rows, which
  // gave NaN targets, and JOKER.constructor was for sale). own() does the same for the plain
  // objects of TW.Content that are read by a key from a run (names, sell prices).
  const dict = () => Object.create(null);
  const own = (o, k) => (o != null && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
  const index = (list) => {
    const out = dict();
    for (const row of list) out[row.id] = row;
    return out;
  };
  const idsOf = (list) => list.map((row) => row.id);
  const HAND = index(C.HANDS);
  const HAND_IDS = idsOf(C.HANDS); // strongest first
  const BLINDS = C.BLINDS.map((b) => Object.assign({}, b));
  const ENH = index(C.ENHANCEMENTS);
  const ENH_IDS = idsOf(C.ENHANCEMENTS);
  const EDITION = index(C.EDITIONS);
  const EDITION_IDS = idsOf(C.EDITIONS); // the order an Edition roll walks
  const SEAL = index(C.SEALS);
  const SEAL_IDS = idsOf(C.SEALS);
  const TAROT = index(C.TAROTS);
  const TAROT_IDS = idsOf(C.TAROTS);
  const PLANET = index(C.PLANETS);
  const PLANET_IDS = idsOf(C.PLANETS);
  const SPECTRAL = index(C.SPECTRALS);
  const PLANET_FOR = dict();
  for (const p of C.PLANETS) PLANET_FOR[p.hand] = p.id;
  const ORIGIN = (C.SPECTRALS.find((s) => s.createJoker === 'legendary') || {}).id || null;
  const SPECTRAL_POOL = idsOf(C.SPECTRALS).filter((id) => id !== ORIGIN); // Shop and Ghost Pack pool
  const JOKER = index(C.JOKERS);
  const JOKER_IDS = idsOf(C.JOKERS);
  // v2 Joker id -> its id in the 120-Joker table (the rows' oldId), for runs and records saved
  // before the table (added 2026-11-23 (Jokers)). A current id always means itself.
  const JOKER_OLD = dict();
  for (const row of C.JOKERS) if (row.oldId && !JOKER[row.oldId]) JOKER_OLD[row.oldId] = row.id;
  const BOSS = index(C.BOSSES);
  const FINALE = (C.BOSSES.find((b) => b.finale) || {}).id || null;
  const BOSS_POOL = C.BOSSES.filter((b) => !b.finale).map((b) => b.id);
  const VOUCHER = index(C.VOUCHERS);
  const VOUCHER_IDS = idsOf(C.VOUCHERS);
  const TAG = index(C.TAGS);
  const TAG_IDS = idsOf(C.TAGS);
  const SALE_TAG = C.TAGS.find((t) => t.discount > 0) || { discount: 0, freeRerolls: 0 };
  const PACK = index(C.PACKS);
  const PACK_BY = dict(); // kind -> size -> pack id
  for (const p of C.PACKS) (PACK_BY[p.kind] = PACK_BY[p.kind] || dict())[p.size] = p.id;
  const PACK_KIND_FROM_ANTE = dict();
  for (const p of C.PACKS) PACK_KIND_FROM_ANTE[p.kind] = Math.min(PACK_KIND_FROM_ANTE[p.kind] || 99, p.fromAnte || 1);
  const DECK = index(C.DECKS);
  const DEFAULT_DECK = C.DECKS[0].id;
  const STAKE = index(C.STAKES);
  const DEFAULT_STAKE = C.STAKES[0].id;
  // An id that names a row of the table (a string: ['speedlines'] is no id, though it reads as one).
  const isRowId = (table, id) => typeof id === 'string' && !!table[id];
  const ANTE_TARGETS = C.ANTE_TARGETS.slice();
  const SUITS = C.SUIT_ORDER.slice();
  const SUIT_INDEX = dict();
  SUITS.forEach((s, i) => { SUIT_INDEX[s] = i; });
  const DEF = Object.assign({ money: 4, hands: 4, discards: 3, handSize: 8, jokerSlots: 5, consumableSlots: 2, minHands: 1, minDiscards: 0, minHandSize: 1 }, C.DEFAULTS || {});
  const SHOP = C.SHOP;
  const ECON = Object.assign({ interestPer: 5, interestCap: 5, handBonus: 1, endlessGrowth: 1.75 }, C.ECONOMY || {});
  const RARITY_IDS = Object.keys(C.RARITIES);
  const RARITY_WEIGHT = dict();
  for (const r of RARITY_IDS) RARITY_WEIGHT[r] = C.RARITIES[r].weight || 0;
  const PHASES = ['blind-select', 'play', 'cashout', 'shop', 'pack', 'win', 'gameover'];
  const SELL_PHASES = ['shop', 'blind-select', 'play', 'pack'];
  const ANY_PHASES = ['blind-select', 'play', 'shop', 'pack'];
  const CONSUMABLE_KINDS = ['tarot', 'planet', 'spectral'];
  const DEFAULT_GRUDGE = 'pair';

  // ---------------------------------------------------------------------------
  // Player-facing error sentences (4.4)
  // ---------------------------------------------------------------------------
  const E = {
    bad: "That didn't work.",
    startNotNow: 'There is no Blind to start right now.',
    skipNotNow: "You can't skip a Blind right now.",
    skipBoss: "Boss Blinds can't be skipped.",
    playNotNow: "You can't play a hand right now.",
    selectPlay: 'Select 1 to 5 cards to play.',
    noHands: 'No hands left this Blind.',
    discardNotNow: "You can't discard right now.",
    selectDiscard: 'Select 1 to 5 cards to discard.',
    fromHand: 'Select cards from your hand.',
    noDiscards: 'No discards left this Blind.',
    money: 'Not enough money.',
    jokersFull: 'Your Joker slots are full.',
    needSlot: 'You need a free Joker slot.',
    consFull: 'Your consumable slots are full.',
    blindOnly: 'Only usable during a Blind.',
    useNotNow: "You can't use that right now.",
    noConsumable: "That card isn't in your consumable slots.",
    noCommons: 'There are no common Jokers left to find.',
    noJokersLeft: 'There are no Jokers left to find.',
    sellNotNow: "You can't sell right now.",
    noJoker: "That Joker isn't in your rack.",
    sortMode: 'Sort by rank or suit.',
    handOrder: "That order doesn't match your hand.",
    jokerOrder: "That order doesn't match your Jokers.",
    noCashout: 'There is nothing to cash out.',
    shopClosed: 'The Shop is closed.',
    noItem: 'There is nothing for sale there.',
    sold: 'Already sold.',
    ownJoker: 'You already have that Joker.',
    ownVoucher: 'You already have that Voucher.',
    noPack: 'No Booster Pack is open.',
    noOption: "Pick one of the pack's cards.",
    picked: 'You already took that card.',
    notInShop: "You're not in the Shop.",
    notWon: "The run isn't won yet.",
    needPlain: 'You need a Joker without an Edition.',
    needOther: 'You need another Tarot or Planet card.',
  };
  const fail = (error) => ({ ok: false, error });
  const needJokers = (n) => (n === 1 ? 'You need at least 1 Joker.' : `You need at least ${n} Jokers.`);
  const needHands = (n) => `You need at least ${n} hands left.`;
  const needCards = (n) => `You need at least ${n} cards in hand.`;
  const maxPlayError = (b) => `${b.name}: play at most ${b.maxPlay} cards.`;
  const discardCostError = (b) => `${b.name}: each discard costs $${b.discardCost}.`;

  function selectError(min, max) {
    if (min === max) return `Select exactly ${min} card${min === 1 ? '' : 's'}.`;
    if (max === min + 1) return `Select ${min} or ${max} cards.`;
    return `Select ${min} to ${max} cards.`;
  }

  // ---------------------------------------------------------------------------
  // Numbers
  // ---------------------------------------------------------------------------
  // Mult is kept to 6 decimals. From 1e15 up a double has no decimals left to round, and x * 1e6
  // would overflow to Infinity above about 1.8e302, so big values pass through (2026-11-23 fix).
  const r6 = (x) => (Math.abs(x) >= 1e15 ? x : Math.round(x * 1e6) / 1e6);
  // Scores, targets, Chips and Mult never leave the finite range: JSON writes Infinity and NaN as
  // null, so a saved run would come back broken (added 2026-11-23 (Jokers), robustness pass).
  const MAX_NUM = Number.MAX_VALUE;
  const capNum = (x) => (x > MAX_NUM ? MAX_NUM : x < -MAX_NUM ? -MAX_NUM : x);
  // Round to a multiple of step, halves up, immune to float noise such as 94.49999999. The noise
  // allowance is capped at 0.001 of a step, so huge values (deep Endless targets) round exactly.
  function roundTo(x, step) {
    const v = x / step;
    return capNum(Math.round(v + Math.min(Math.abs(v) * 1e-12, 1e-3) + 1e-9) * step);
  }
  // At most 2 decimals, trailing zeros trimmed. Whole numbers and anything from 1e15 up (no decimals
  // left) print as they are: Math.round(n * 100) / 100 is inexact there (1e21 printed 999...900000).
  function formatNumber(n) {
    const x = Number(n);
    const v = Number.isInteger(x) || Math.abs(x) >= 1e15 ? x : Math.round(x * 100) / 100;
    return String(Object.is(v, -0) ? 0 : v);
  }
  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ---------------------------------------------------------------------------
  // Seeded PRNG (state in run.rng)
  // ---------------------------------------------------------------------------
  function hashSeed(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }
  function rand(run) {
    const a = (run.rng = (run.rng + 0x6d2b79f5) >>> 0);
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const randInt = (run, n) => Math.floor(rand(run) * n);
  const pick = (run, arr) => (arr.length ? arr[randInt(run, arr.length)] : null);
  function pickWeighted(run, pairs) {
    let total = 0;
    for (const p of pairs) total += p[1] > 0 ? p[1] : 0;
    if (!(total > 0)) return null;
    let r = rand(run) * total;
    for (const p of pairs) {
      if (!(p[1] > 0)) continue;
      if (r < p[1]) return p[0];
      r -= p[1];
    }
    return pairs.filter((p) => p[1] > 0).pop()[0];
  }
  function shuffle(run, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(run, i + 1);
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }
  function pickDistinct(run, arr, n) {
    const pool = arr.slice();
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(randInt(run, pool.length), 1)[0]);
    return out;
  }

  const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function randomSeed() {
    let s = '';
    for (let i = 0; i < 8; i++) s += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
    return s;
  }
  function normalizeSeed(seed) {
    if (typeof seed === 'number' && Number.isFinite(seed)) return String(seed);
    if (typeof seed === 'string' && seed.trim()) return seed.trim();
    return null;
  }

  // ---------------------------------------------------------------------------
  // Small run helpers
  // ---------------------------------------------------------------------------
  const newUid = (run, prefix) => prefix + run.nextUid++;
  const uidNum = (uid) => {
    const n = parseInt(String(uid).slice(1), 10);
    return Number.isFinite(n) ? n : 0;
  };
  function cardChips(card) {
    if (!card) return 0;
    const r = card.rank;
    if (r === 14) return 11;
    if (r >= 11) return 10;
    return r;
  }
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const deckOf = (run) => DECK[run.deckId] || DECK[DEFAULT_DECK];
  const stakeOf = (run) => STAKE[run.stake] || STAKE[DEFAULT_STAKE];
  const levelOf = (run, handId) => (run.levels && run.levels[handId] > 0 ? run.levels[handId] : 1);
  const hasVoucher = (run, id) => Array.isArray(run.vouchers) && run.vouchers.includes(id);
  const findJoker = (run, uid) => (Array.isArray(run.jokers) ? run.jokers.find((j) => j && j.uid === uid) || null : null);
  const findConsumable = (run, uid) => (Array.isArray(run.consumables) ? run.consumables.find((k) => k && k.uid === uid) || null : null);
  const isConsumableKind = (kind) => CONSUMABLE_KINDS.includes(kind);
  function defOf(kind, id) {
    const t = kind === 'tarot' ? TAROT : kind === 'planet' ? PLANET : kind === 'spectral' ? SPECTRAL : null;
    return (t && t[id]) || null;
  }
  const consumableDef = (k) => (k ? defOf(k.kind, k.id) : null);
  const kindOfConsumable = (id) => (TAROT[id] ? 'tarot' : PLANET[id] ? 'planet' : SPECTRAL[id] ? 'spectral' : null);
  const ownsJoker = (run, id) => run.jokers.some((j) => j.id === id);
  const editionOf = (id) => (id && EDITION[id]) || null;
  const takesSlot = (joker) => !(editionOf(joker.edition) && editionOf(joker.edition).slot);
  const editionTakesSlot = (id) => !(editionOf(id) && editionOf(id).slot);
  function jokerSlotsUsed(run) {
    return run.jokers.filter((j) => j && takesSlot(j)).length;
  }
  const freeJokerSlots = (run) => Math.max(0, run.jokerSlots - jokerSlotsUsed(run));
  const freeConsumableSlots = (run) => Math.max(0, run.consumableSlots - run.consumables.length);
  const wetUid = (run) => (run.blind && run.blind.wetJoker) || null;
  // Jokers that act right now (The Wet Blanket switches one off for the whole Blind).
  const activeJokers = (run) => run.jokers.filter((j) => j && JOKER[j.id] && j.uid !== wetUid(run));
  const bossOf = (run) => (run.blind && run.blind.boss && BOSS[run.blind.boss]) || null;
  const bossFlag = (run, key) => {
    const b = bossOf(run);
    return b ? b[key] : undefined;
  };

  function getCard(run, uid) {
    if (!run || !Array.isArray(run.cards)) return null;
    return run.cards.find((c) => c && c.uid === uid) || null;
  }
  // The uids that name a card (a stale or edited hand can hold one that names none; added
  // 2026-11-24 (final review): what picks among or changes hand cards skips those).
  const realUids = (run, uids) => uids.filter((u) => !!getCard(run, u));
  function newCard(run, rank, suit, o) {
    const x = o || {};
    return { uid: newUid(run, 'c'), rank, suit, enhancement: x.enhancement || null, edition: x.edition || null, seal: x.seal || null, grow: 0 };
  }
  const copyCard = (run, src) => Object.assign(newCard(run, src.rank, src.suit, src), { grow: Math.max(0, Number(src.grow) || 0) });

  function cmpRank(a, b) {
    return (b.rank - a.rank) || (SUIT_INDEX[a.suit] - SUIT_INDEX[b.suit]) || (uidNum(a.uid) - uidNum(b.uid));
  }
  function cmpSuit(a, b) {
    return (SUIT_INDEX[a.suit] - SUIT_INDEX[b.suit]) || (b.rank - a.rank) || (uidNum(a.uid) - uidNum(b.uid));
  }

  function discover(run, key, id) {
    if (!id || !run.discovered || !Array.isArray(run.discovered[key])) return;
    if (!run.discovered[key].includes(id)) run.discovered[key].push(id);
  }
  // What the Blind select screen shows for the current Ante: its Boss Blind and its two Tags.
  function discoverAnte(run) {
    discover(run, 'bosses', run.bosses[run.ante]);
    for (let i = 0; i < BLINDS.length; i++) if (BLINDS[i].skippable) discover(run, 'tags', run.tags[`${run.ante}-${i}`]);
  }

  function gainMoney(run, n) {
    if (n > 0) {
      run.money += n;
      run.stats.moneyEarned += n;
    }
  }
  // Takes at most what the player has; returns what was taken.
  function loseMoney(run, n) {
    const lost = Math.max(0, Math.min(run.money, n));
    run.money -= lost;
    return lost;
  }

  // Voucher bonuses, summed (or multiplied) over every owned Voucher.
  const ownedVouchers = (run) => (Array.isArray(run.vouchers) ? run.vouchers : []).map((id) => VOUCHER[id]).filter(Boolean);
  const vSum = (run, key) => ownedVouchers(run).reduce((s, v) => s + (Number(v[key]) || 0), 0);
  const vAny = (run, key) => ownedVouchers(run).some((v) => !!v[key]);
  const vProduct = (run, key) => ownedVouchers(run).reduce((p, v) => p * (v[key] > 0 ? v[key] : 1), 1);
  const vMax = (run, key, base) => ownedVouchers(run).reduce((m, v) => (v[key] > m ? v[key] : m), base);

  const isFirstHand = (blind) => !blind || !(blind.handsPlayed > 0);
  function handSizeNow(run) {
    const b = run.blind;
    if (!b) return Math.max(DEF.minHandSize, run.handSize);
    const bonus = b.kind === 'boss' ? vSum(run, 'bossHandSize') : 0;
    return Math.max(DEF.minHandSize, run.handSize + bonus + (b.handSizeDelta || 0));
  }
  const planetLevels = (run) => vMax(run, 'planetLevels', 1);
  // A hand's Chips and Mult at its current level: base + (level - 1) x per level.
  function handValues(run, handId) {
    const hd = HAND[handId];
    const level = levelOf(run, handId);
    return { handId, name: hd.name, level, chips: hd.chips + (level - 1) * hd.lchips, mult: r6(hd.mult + (level - 1) * hd.lmult) };
  }

  // ---------------------------------------------------------------------------
  // Targets and rewards (2.6)
  // ---------------------------------------------------------------------------
  // Endless Antes: round(B x g^k / 100) x 100 with k = Ante - 8, halves up, worked out exactly in
  // integer arithmetic and turned into a number once (changed 2026-11-24 (final review): the
  // floating-point product is off by more than the rounding margin once 7^k passes 53 bits, so from
  // Ante 60 on 387 Antes rounded to the neighbouring multiple of 100). B (Ante 8's target) and g
  // (endlessGrowth) are read as the exact binary fractions they are: 1.75 is 7/4. Past
  // Number.MAX_VALUE the target is Number.MAX_VALUE. The values are cached by k (module state that
  // no run holds; the same Ante always gives the same number).
  const BIG = typeof BigInt === 'function' ? BigInt : null; // no BigInt: the floating-point formula
  function exactFraction(x) {
    let v = x;
    let e = 0;
    while (!Number.isInteger(v)) { // doubling a double is exact, and a fraction becomes whole within 1075 steps
      v *= 2;
      e += 1;
    }
    return [BIG(v), BIG(2) ** BIG(e)];
  }
  const ENDLESS = (() => {
    const b = ANTE_TARGETS[7];
    const g = ECON.endlessGrowth;
    if (!BIG || !(Number.isFinite(b) && b > 0 && Number.isFinite(g) && g > 0)) return null;
    const [bn, bd] = exactFraction(b);
    const [gn, gd] = exactFraction(g);
    return { bn, bd, gn, gd, bits: gn.toString(2).length + gd.toString(2).length, log2b: Math.log2(b), log2g: Math.log2(g), max: BIG(MAX_NUM), cache: new Map() };
  })();
  function endlessTarget(k) {
    const X = ENDLESS;
    if (X && X.log2b + k * X.log2g > 1025) return MAX_NUM; // above 2^1025: far past Number.MAX_VALUE
    if (!X || k * X.bits > 65536) return roundTo(capNum(ANTE_TARGETS[7] * Math.pow(ECON.endlessGrowth, k)), 100); // powers too long to work out
    let v = X.cache.get(k);
    if (v === undefined) {
      const K = BIG(k);
      const num = X.bn * X.gn ** K; // the target / 100 is num / den
      const den = X.bd * X.gd ** K * BIG(100);
      const r = ((BIG(2) * num + den) / (BIG(2) * den)) * BIG(100);
      v = r > X.max ? MAX_NUM : Number(r);
      X.cache.set(k, v);
    }
    return v;
  }
  function anteBaseTarget(ante) {
    const a = Math.max(1, Math.floor(Number(ante) || 1));
    if (a <= 8) return ANTE_TARGETS[a - 1];
    return endlessTarget(a - 8);
  }
  function computeTarget(run, ante, index, bossId, extraMult) {
    let p = anteBaseTarget(ante) * BLINDS[index].mult * stakeOf(run).targetMult;
    if (bossId && BOSS[bossId] && BOSS[bossId].targetMult) p *= BOSS[bossId].targetMult;
    if (typeof extraMult === 'number' && extraMult > 0 && extraMult !== 1) p *= extraMult;
    if (BLINDS[index].kind === 'boss') {
      // bossTargetMult (Smooth Talker); The Wet Blanket's Joker (leftmost) gives no rule.
      const wet = bossId && BOSS[bossId] && BOSS[bossId].wetLeftmost && run.jokers.length ? run.jokers[0].uid : null;
      const x = numRule(rulesOf(run, wet), 'bossTargetMult');
      if (x > 0 && x !== 1) p *= x;
    }
    return roundTo(p, 10);
  }
  function bossFor(run, ante, index) {
    if (!BLINDS[index] || BLINDS[index].kind !== 'boss') return null;
    return (run.bosses && run.bosses[ante]) || null;
  }
  function blindTarget(run, ante, index) {
    if (!run || !BLINDS[index]) return 0;
    return computeTarget(run, ante, index, bossFor(run, ante, index), 1);
  }
  function rewardFor(run, index) {
    return Math.max(0, BLINDS[index].reward + (deckOf(run).rewardDelta || 0));
  }
  function interestCap(run) {
    const s = stakeOf(run);
    return (s.interestCap != null ? s.interestCap : ECON.interestCap) + vSum(run, 'interestCap');
  }
  // $1 per full interestPer held ($5; interestStep from Brass Abacus), up to the cap.
  function interestNow(run) {
    const per = numRule(rulesOf(run), 'interestStep') || ECON.interestPer;
    return Math.max(0, Math.min(interestCap(run), Math.floor(run.money / per)));
  }

  // ---------------------------------------------------------------------------
  // Hand detection (2.2). Four Joker rule words change it (3.4, added 2026-11-23): wrapStraights,
  // fourCardFlush, wildJacks and everySuit. o = { washout, censor, wrap, four, wild, every }.
  // ---------------------------------------------------------------------------
  function validCard(c) {
    return !!c && typeof c === 'object' && Number.isInteger(c.rank) && c.rank >= 2 && c.rank <= 14 &&
      Object.prototype.hasOwnProperty.call(SUIT_INDEX, c.suit);
  }
  const anySuit = (card, washout) => !washout && !!(card.enhancement && ENH[card.enhancement] && ENH[card.enhancement].anySuit);
  // c: a context with washout and everySuit (Sir Motley's rule is not switched off by The Wash-Out).
  const wildSuit = (card, c) => !!(c && c.everySuit) || anySuit(card, !!(c && c.washout));
  const suitMatches = (card, suit, c) => card.suit === suit || wildSuit(card, c);
  const joinsScoring = (card, censor) => !censor && !!(card.seal && SEAL[card.seal] && SEAL[card.seal].joinsScoring);
  const detectWild = (card, o) => o.every || anySuit(card, o.washout);
  // -> the indices of the cards that make a Flush, or null. Normally all 5 cards share a suit
  // (a Masked card matches any suit); with fourCardFlush 4 or 5 cards with at least 4 of one suit.
  function flushIdx(cards, o) {
    const n = cards.length;
    if (n < (o.four ? 4 : 5)) return null;
    let best = null;
    for (const s of SUITS) {
      const idx = [];
      for (let i = 0; i < n; i++) if (cards[i].suit === s || detectWild(cards[i], o)) idx.push(i);
      if (idx.length === n) return idx;
      if (o.four && idx.length >= 4 && (!best || idx.length > best.length)) best = idx;
    }
    return best;
  }
  // Five distinct ranks in a run; an Ace plays high or low. wrap: any run on the loop
  // ... Q-K-A-2-3 ... (J-Q-K-A-2, Q-K-A-2-3 and K-A-2-3-4 too).
  function isStraightRanks(ranks, wrap) {
    if (ranks.length !== 5 || new Set(ranks).size !== 5) return false;
    const r = ranks.slice().sort((a, b) => a - b);
    if (r[4] - r[0] === 4) return true;
    if (r[0] === 2 && r[1] === 3 && r[2] === 4 && r[3] === 5 && r[4] === 14) return true; // A-2-3-4-5
    if (!wrap) return false;
    for (let start = 0; start < 13; start++) if (r.every((x) => (x - 2 - start + 13) % 13 < 5)) return true;
    return false;
  }
  // The hand and the cards it scores (indices in play order), for cards whose ranks count as `ranks`.
  // fl: the Flush's card indices or null (it depends only on the suits, so detect works it out once).
  function classify(cards, ranks, o, fl0) {
    const n = cards.length;
    const counts = {};
    for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
    const groups = Object.keys(counts).map((r) => counts[r]).sort((a, b) => b - a);
    const fl = fl0 === undefined ? flushIdx(cards, o) : fl0;
    const straight = isStraightRanks(ranks, o.wrap);
    let handId = 'high';
    if (straight && fl) handId = 'straightflush'; // with fourCardFlush: a Straight with 4 of one suit
    else if (groups[0] >= 4) handId = 'four';
    else if (groups[0] === 3 && groups[1] >= 2) handId = 'fullhouse';
    else if (fl) handId = 'flush';
    else if (straight) handId = 'straight';
    else if (groups[0] === 3) handId = 'three';
    else if (groups[0] === 2 && groups[1] === 2) handId = 'twopair';
    else if (groups[0] === 2) handId = 'pair';
    const all = cards.map((c, i) => i);
    let natural;
    switch (handId) {
      case 'straightflush': case 'straight': case 'fullhouse': natural = all; break;
      case 'flush': natural = fl; break; // a 4-card Flush leaves the off-suit card unscored
      case 'four': natural = all.filter((i) => counts[ranks[i]] >= 4); break;
      case 'three': natural = all.filter((i) => counts[ranks[i]] === 3); break;
      case 'twopair': case 'pair': natural = all.filter((i) => counts[ranks[i]] === 2); break;
      default: {
        let best = 0;
        for (let i = 1; i < n; i++) if (ranks[i] > ranks[best]) best = i; // leftmost on ties
        natural = [best];
      }
    }
    return { handId, natural };
  }
  // Stronger first: the hand, then more scoring cards, then higher (standing-in) ranks among them.
  function betterHand(a, b) {
    if (!b) return true;
    const ha = HAND_IDS.indexOf(a.handId);
    const hb = HAND_IDS.indexOf(b.handId);
    if (ha !== hb) return ha < hb;
    if (a.natural.length !== b.natural.length) return a.natural.length > b.natural.length;
    const sum = (h) => h.natural.reduce((s, i) => s + h.ranks[i], 0);
    return sum(a) > sum(b);
  }
  // wildJacks: each Jack may stand in for any one rank (2 to Ace), chosen to make the strongest
  // hand. The ranks are tried as multisets, the earlier Jack in play order taking the lower rank,
  // in increasing order, and the first strongest one wins.
  // Trying all 13 ranks for every Jack took up to 6,188 classifications (five Jacks: 15 ms per
  // preview), so only the ranks that can matter are tried (2026-11-23 robustness pass; the answers
  // are the same, checked against the full search on random hands):
  //  - a Straight: for each run of five ranks (the loop with wrapStraights) that holds the other
  //    cards, the ranks it is missing;
  //  - any other hand: the other cards' ranks (to match them) and the highest ranks none of them
  //    has, one for each Jack (for Jacks that pair among themselves or score alone).
  // That is at most 139 classifications.
  const STRAIGHT_RUNS = [];
  for (let s = 2; s <= 10; s++) STRAIGHT_RUNS.push([s, s + 1, s + 2, s + 3, s + 4]);
  STRAIGHT_RUNS.push([14, 2, 3, 4, 5]);
  const WRAP_RUNS = [[11, 12, 13, 14, 2], [12, 13, 14, 2, 3], [13, 14, 2, 3, 4]];
  function jackTuples(others, k, n, wrap) {
    const out = new Map();
    const put = (vals) => { out.set(vals.join(','), vals); };
    if (n === 5 && new Set(others).size === others.length) {
      for (const run of wrap ? STRAIGHT_RUNS.concat(WRAP_RUNS) : STRAIGHT_RUNS) {
        if (!others.every((r) => run.includes(r))) continue;
        const missing = run.filter((r) => !others.includes(r)).sort((a, b) => a - b);
        if (missing.length === k) put(missing);
      }
    }
    const vals = [...new Set(others)];
    for (let r = 14, added = 0; r >= 2 && added < k; r--) if (!vals.includes(r)) { vals.push(r); added++; }
    vals.sort((a, b) => a - b);
    const walk = (acc, from) => {
      if (acc.length === k) return put(acc.slice());
      for (let i = from; i < vals.length; i++) { acc.push(vals[i]); walk(acc, i); acc.pop(); }
    };
    walk([], 0);
    // the full search's order: lexicographic over the Jacks' ranks in play order
    return [...out.values()].sort((a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; });
  }
  function detect(cards, o) {
    const real = cards.map((c) => c.rank);
    const jacks = o.wild ? real.map((r, i) => i).filter((i) => real[i] === 11) : [];
    const fl = flushIdx(cards, o); // depends on the suits only
    if (!jacks.length) return classify(cards, real, o, fl);
    const others = real.filter((r, i) => !jacks.includes(i));
    let best = null;
    for (const vals of jackTuples(others, jacks.length, cards.length, o.wrap)) {
      const ranks = real.slice();
      jacks.forEach((ji, t) => { ranks[ji] = vals[t]; });
      const h = classify(cards, ranks, o, fl);
      h.ranks = ranks;
      if (betterHand(h, best)) best = h;
    }
    return { handId: best.handId, natural: best.natural };
  }
  const detectOpts = (washout, censor, rules) => {
    const r = rules || {};
    return { washout: !!washout, censor: !!censor, every: !!r.everySuit, wrap: !!r.wrapStraights, four: !!r.fourCardFlush, wild: !!r.wildJacks };
  };
  // -> { handId, idx:[scoring indices in play order], cameo:[indices added by a Cameo Seal] } | null
  function evalIdx(cards, o) {
    if (!Array.isArray(cards) || cards.length < 1 || cards.length > 5) return null;
    for (const c of cards) if (!validCard(c)) return null;
    const { handId, natural } = detect(cards, o);
    const cameo = cards.map((c, i) => i).filter((i) => !natural.includes(i) && joinsScoring(cards[i], o.censor));
    const idx = cards.map((c, i) => i).filter((i) => natural.includes(i) || cameo.includes(i));
    return { handId, idx, cameo };
  }
  // opts: { washout, censor, wrapStraights, fourCardFlush, wildJacks, everySuit } (the last four
  // added 2026-11-23 (Jokers): the rule words, for evaluating without a run).
  function evaluate(cards, opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const ev = evalIdx(cards, detectOpts(o.washout, o.censor, o));
    if (!ev) return null;
    return { handId: ev.handId, scoringUids: ev.idx.map((i) => cards[i].uid) };
  }

  // ---------------------------------------------------------------------------
  // The Joker vocabulary (SPEC 3.4). A Joker's content row says what it does; these tables
  // say what the words mean. c (the context) holds run, blind, joker (a view: uid, id, state,
  // edition), washout, censor, everySuit and rules (the active rule words), and while scoring
  // also x (the tally), card and info ({ first, last }). Events add their own fields: cards
  // (the cards discarded, added or destroyed), selected (the cards picked for a discard),
  // scored (uids), consumable ({ kind, id }), item (a bought Shop item) and sold ({ uid, id }).
  // ---------------------------------------------------------------------------
  const RED = ['H', 'D'];
  const BLACK = ['S', 'C'];
  // The hands a named hand also accepts under handsContain (Nesting Dolls).
  const CONTAINED_IN = Object.assign(dict(), { pair: ['twopair', 'three', 'fullhouse', 'four'], twopair: ['fullhouse'], three: ['fullhouse', 'four'], straight: ['straightflush'], flush: ['straightflush'] });
  const handIs = (played, named, c) => played === named || (!!(c.rules && c.rules.handsContain) && (CONTAINED_IN[named] || []).includes(played));
  const faceCard = (card, c) => (card.rank >= 11 && card.rank <= 13) || (card.rank === 14 && !!(c && c.rules && c.rules.acesAreFaces));
  const hasEnhancement = (card, c) => !c.washout && !!(card.enhancement && ENH[card.enhancement]);
  function pairsIn(cards) {
    const n = {};
    for (const k of cards) n[k.rank] = (n[k.rank] || 0) + 1;
    return Object.keys(n).reduce((s, r) => s + Math.floor(n[r] / 2), 0);
  }
  function highestHeldCard(held) {
    let best = null;
    for (const k of held) if (!best || k.rank > best.rank) best = k; // leftmost on ties
    return best;
  }
  function oneColour(cards, c) {
    if (!cards.length) return false;
    const fits = (k, set) => set.some((s) => suitMatches(k, s, c));
    return cards.every((k) => fits(k, RED)) || cards.every((k) => fits(k, BLACK));
  }
  // 2 to 10 at face value, J/Q/K 10, each Ace 1 or 11.
  function sumIs21(cards) {
    if (!cards.length) return false;
    let sum = 0;
    let aces = 0;
    for (const k of cards) {
      if (k.rank === 14) aces += 1;
      sum += k.rank === 14 ? 1 : Math.min(10, k.rank);
    }
    for (let a = 0; a <= aces; a++) if (sum + 10 * a === 21) return true;
    return false;
  }
  // The vocabulary tables have no prototype either: a row's word 'toString' is unknown, so
  // jokerProblems reports it and it never fires (2026-11-24 (final review)).
  const CONDITIONS = Object.assign(dict(), {
    maxPlayed: (a, c) => !!c.x && c.x.played.length <= a,
    minPlayed: (a, c) => !!c.x && c.x.played.length >= a,
    firstHand: (a, c) => isFirstHand(c.blind) === a,
    hands: (a, c) => !!c.x && Array.isArray(a) && a.some((h) => handIs(c.x.handId, h, c)),
    face: (a, c) => !!c.card && faceCard(c.card, c) === a,
    suit: (a, c) => !!c.card && suitMatches(c.card, a, c),
    suits: (a, c) => !!c.card && Array.isArray(a) && a.some((s) => suitMatches(c.card, s, c)),
    rank: (a, c) => !!c.card && c.card.rank === a,
    ranks: (a, c) => !!c.card && Array.isArray(a) && a.includes(c.card.rank),
    first: (a, c) => !!(c.info && c.info.first) === a,
    last: (a, c) => !!(c.info && c.info.last) === a,
    stateRank: (a, c) => !!c.card && !!c.joker.state && c.card.rank === c.joker.state[a],
    noDiscards: (a, c) => !!c.blind && (c.blind.discardsUsed === 0) === a,
    bossBlind: (a, c) => !!c.blind && (c.blind.kind === 'boss') === a,
    // added 2026-11-23 (Jokers)
    scoredSuitCount: (a, c) => !!c.x && !!a && typeof a === 'object' && c.x.scored.filter((k) => suitMatches(k, a.suit, c)).length >= (Number(a.min) || 0),
    highestHeld: (a, c) => !!c.card && !!c.x && (highestHeldCard(c.x.held) === c.card) === a,
    heldRank: (a, c) => !!c.x && c.x.held.some((k) => k.rank === a),
    clearedOnFirstHand: (a, c) => !!c.blind && (c.blind.handsPlayed === 1) === a,
    clearedOnLastHand: (a, c) => !!c.blind && (c.blind.handsLeft <= 0) === a,
    kind: (a, c) => !!c.consumable && (Array.isArray(a) ? a.includes(c.consumable.kind) : c.consumable.kind === a),
    enhanced: (a, c) => !!c.card && hasEnhancement(c.card, c) === a,
    allEnhanced: (a, c) => !!c.x && (c.x.scored.length > 0 && c.x.scored.every((k) => hasEnhancement(k, c))) === a,
    seal: (a, c) => !!c.card && !c.censor && (a === 'any' ? !!(c.card.seal && SEAL[c.card.seal]) : c.card.seal === a),
    lastHand: (a, c) => !!c.blind && (c.blind.handsLeft <= 1) === a,
    evenHand: (a, c) => !!c.blind && ((c.blind.handsPlayed || 0) % 2 === 1) === a,
    maxMoney: (a, c) => Math.max(0, Number(c.run.money) || 0) <= a,
    oneColour: (a, c) => !!c.x && oneColour(c.x.scored, c) === a,
    noConsumables: (a, c) => (!Array.isArray(c.run.consumables) || c.run.consumables.length === 0) === a,
    mostPlayed: (a, c) => !!c.x && handIs(c.x.handId, mostPlayedHand(c.run) || DEFAULT_GRUDGE, c) === a,
    stateIs: (a, c) => !!a && typeof a === 'object' && Object.keys(a).every((k) => !!c.joker.state && c.joker.state[k] === a[k]),
    heldSameRank: (a, c) => !!c.card && !!c.x && c.x.held.some((k) => k.rank === c.card.rank) === a,
    firstOrLast: (a, c) => !!(c.info && (c.info.first || c.info.last)) === a,
    pairDiscard: (a, c) => Array.isArray(c.selected) && (c.selected.length === 2 && c.selected[0].rank === c.selected[1].rank) === a,
    sum21: (a, c) => !!c.x && sumIs21(c.x.scored) === a,
  });
  const COUNTERS = Object.assign(dict(), {
    emptyJokerSlots: (c) => freeJokerSlots(c.run),
    scoredSuits: (c) => {
      if (!c.x) return null;
      if (c.x.scored.some((k) => wildSuit(k, c))) return 4; // a Masked card counts as all four
      return new Set(c.x.scored.map((k) => k.suit)).size;
    },
    scoredPairs: (c) => (c.x ? pairsIn(c.x.scored) : null),
    playedCards: (c) => (c.x ? c.x.played.length : null),
    handsPlayed: (c) => (c.run.stats && c.run.stats.handsPlayed) || 0,
    money: (c) => Math.max(0, c.run.money || 0),
    cardsDiscarded: (c) => (c.blind ? c.blind.cardsDiscarded || 0 : null),
    discardsLeft: (c) => (c.blind ? Math.max(0, c.blind.discardsLeft) : 0),
    ante: (c) => Math.max(1, c.run.ante || 1),
    // added 2026-11-23 (Jokers)
    cardRank: (c) => (c.card ? c.card.rank : null),
    heldPairs: (c) => (c.x ? pairsIn(c.x.held) : null),
    handsLeft: (c) => (c.blind ? Math.max(0, c.blind.handsLeft) : 0),
    unscoredCards: (c) => (c.x ? Math.max(0, c.x.played.length - c.x.scoring.length) : null),
    otherCommonJokers: (c) => c.run.jokers.filter((j) => j && j.uid !== c.joker.uid && JOKER[j.id] && JOKER[j.id].rarity === 'common').length,
    sealedCards: (c) => c.run.cards.filter((k) => k && k.seal && SEAL[k.seal]).length,
    levelsAbove1: (c) => (c.x ? levelOf(c.run, c.x.handId) - 1 : null),
    editionJokers: (c) => c.run.jokers.filter((j) => j && editionOf(j.edition)).length,
    otherJokers: (c) => c.run.jokers.filter((j) => j && j.uid !== c.joker.uid).length,
    vouchers: (c) => ownedVouchers(c.run).length,
  });
  const EFFECT_KINDS = ['chips', 'mult', 'xmult', 'money'];
  const effectKind = (e) => EFFECT_KINDS.find((k) => e[k] != null) || null;
  const isDynamic = (e) => e.per != null || (effectKind(e) && typeof e[effectKind(e)] === 'object');

  function matches(when, c) {
    if (!when) return true;
    if (typeof when !== 'object') return false;
    for (const key of Object.keys(when)) {
      const test = CONDITIONS[key];
      if (!test || !test(when[key], c)) return false; // an unknown word never fires
    }
    return true;
  }
  // A number kept in a Joker's state. A key that is missing or not a finite number (an older or
  // edited save, or a copy of a broken state) reads as the row's starting value, so a Poker Face
  // with state {} gives x1, not x0 (2026-11-23 robustness pass). row: the row whose state it is.
  function rowStart(row, key) {
    const d = row && isObj(row.state) ? row.state[key] : undefined;
    return typeof d === 'number' && Number.isFinite(d) ? d : 0;
  }
  function stateNum(st, key, row) {
    const v = isObj(st) ? st[key] : undefined;
    return typeof v === 'number' && Number.isFinite(v) ? v : rowStart(row, key);
  }
  function baseAmount(spec, joker) {
    if (typeof spec === 'number') return spec;
    if (spec && typeof spec === 'object' && typeof spec.state === 'string') return stateNum(joker.state, spec.state, JOKER[joker.id]);
    return 0;
  }
  // The multiplier from `per`: a counter name, { count, every }, or { state, every } (perState:
  // floor(state[key] / every)). null when it can't be read.
  function perCount(per, c) {
    if (per == null) return 1;
    let n;
    if (typeof per === 'string') n = COUNTERS[per] ? COUNTERS[per](c) : null;
    else if (per && typeof per === 'object' && typeof per.state === 'string') n = stateNum(c.joker.state, per.state, JOKER[c.joker.id]);
    else if (per && typeof per === 'object' && COUNTERS[per.count]) n = COUNTERS[per.count](c);
    else n = null;
    if (n == null) return null;
    return per.every > 0 ? Math.floor(n / per.every) : n;
  }
  // -> { kind, amount } with no-op amounts (+0, x1) kept; null when it can't be read (or is not
  // a finite number). An xmult amount with `per` is raised to that power, or with `linear` gives
  // x(1 + amount x count).
  function rawAmount(e, c) {
    const kind = effectKind(e);
    const n = kind ? perCount(e.per, c) : null;
    if (n == null) return null;
    const base = baseAmount(e[kind], c.joker);
    const amount = kind === 'xmult' ? (e.linear ? r6(1 + base * n) : r6(Math.pow(base, n))) : r6(base * n);
    return Number.isFinite(amount) ? { kind, amount } : null;
  }
  // An effect worth +0 or x1 makes no step, and an xMult of 0 or less never fires (it would wipe
  // the hand; only a broken state can give one).
  function effectAmount(e, c) {
    const v = rawAmount(e, c);
    if (!v || (v.kind === 'xmult' ? v.amount === 1 || !(v.amount > 0) : v.amount === 0)) return null;
    return v;
  }

  // ---------------------------------------------------------------------------
  // Copies (rule word copy, added 2026-11-23). A Joker acts through its facets: its own row,
  // or for a copier the rows it copies. 'random' (Stand-In) copies the Joker in state.target,
  // 'neighbours' (The Puppet Master) the Jokers directly left and right of it, both with the
  // target's own state and without the target's events; 'lastSold' (Old Flame) acts exactly
  // as the Joker in state.copy = { id, state }, events included, on that copied state.
  // Copying a copier follows the chain; a loop or a missing target resolves to nothing, and
  // a chain is never followed more than MAX_COPY_DEPTH steps.
  // Facet: { row, state, holderUid, path, events, copyOf, copyUid }, where holderUid and path
  // say where the state lives (path [] is holder.state, ['copy','state'] Old Flame's copy).
  // ---------------------------------------------------------------------------
  const COPY_HOWS = ['random', 'neighbours', 'lastSold'];
  const MAX_COPY_DEPTH = 8;
  const copyHow = (row) => (row && row.rules && COPY_HOWS.includes(row.rules.copy) ? row.rules.copy : null);
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  function resolveFacets(run, j, holderUid, path, seen, depth, own, top) {
    const row = j && JOKER[j.id];
    if (!row || depth > MAX_COPY_DEPTH) return [];
    const state = isObj(j.state) ? j.state : {};
    const how = copyHow(row);
    if (!how) return [{ row, state, holderUid, path, events: own, copyOf: top ? null : row.id, copyUid: top ? null : j.uid || null }];
    let seenNow = seen;
    if (j.uid) {
      if (seen.includes(j.uid)) return []; // a loop does nothing
      seenNow = seen.concat(j.uid);
    }
    if (how === 'lastSold') {
      const cp = state.copy;
      if (!isObj(cp) || !JOKER[cp.id]) return [];
      return resolveFacets(run, { id: cp.id, state: cp.state }, holderUid, path.concat('copy', 'state'), seenNow, depth + 1, own, false);
    }
    if (how === 'random') {
      const t = typeof state.target === 'string' ? findJoker(run, state.target) : null;
      return t ? resolveFacets(run, t, t.uid, [], seenNow, depth + 1, false, false) : [];
    }
    const at = run.jokers.findIndex((x) => x && x.uid === (j.uid || holderUid));
    const out = [];
    for (const k of [at - 1, at + 1]) {
      const nb = at >= 0 ? run.jokers[k] : null;
      if (nb) out.push(...resolveFacets(run, nb, nb.uid, [], seenNow, depth + 1, false, false));
    }
    return out;
  }
  const facetsOf = (run, joker) => resolveFacets(run, joker, joker.uid, [], [], 0, true, true);
  const nameFor = (joker, f) => {
    const own = (JOKER[joker.id] && JOKER[joker.id].name) || '';
    return f && f.copyOf && JOKER[f.copyOf] ? `${own} (as ${JOKER[f.copyOf].name})` : own;
  };
  const holderKey = (f) => `${f.holderUid}/${f.path.join('/')}`;
  // The live state object a facet writes to (actions only): it creates missing objects.
  function ensureState(run, f) {
    const holder = findJoker(run, f.holderUid);
    if (!holder) return f.state;
    if (!isObj(holder.state)) holder.state = {};
    let st = holder.state;
    for (const k of f.path) {
      if (!isObj(st[k])) st[k] = {};
      st = st[k];
    }
    return st;
  }
  // A copy of a Joker's state with every key its row starts with: a missing key, or a number key
  // that is not a finite number, takes the row's starting value; other keys and their order stay.
  // Old Flame's copied state is filled the same way along the chain (2026-11-23 robustness pass:
  // deserialize and Old Flame's take-over use it, so a key a row reads is always there).
  function filledState(id, st, depth) {
    const row = JOKER[id];
    const start = row && isObj(row.state) ? row.state : {};
    const out = isObj(st) ? clone(st) : {};
    for (const k of Object.keys(start)) {
      if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = clone(start[k]);
      else if (typeof start[k] === 'number' && !(typeof out[k] === 'number' && Number.isFinite(out[k]))) out[k] = start[k];
    }
    const cp = out.copy;
    if (row && copyHow(row) === 'lastSold' && isObj(cp) && JOKER[cp.id] && (depth || 0) < MAX_COPY_DEPTH) cp.state = filledState(cp.id, cp.state, (depth || 0) + 1);
    return out;
  }
  // The state that holds a Stand-In target for this Joker (its own, or Old Flame's copy of a
  // Stand-In), or null.
  function randomCopierState(joker) {
    let row = JOKER[joker.id];
    let st = joker.state;
    for (let d = 0; row && copyHow(row) === 'lastSold' && d < MAX_COPY_DEPTH; d++) {
      const cp = isObj(st) ? st.copy : null;
      if (!isObj(cp) || !JOKER[cp.id]) return null;
      row = JOKER[cp.id];
      st = cp.state;
    }
    return row && copyHow(row) === 'random' && isObj(st) ? st : null;
  }
  // Stand-In picks a random other Joker you own, never another Stand-In.
  function pickCopyTarget(run, joker, st) {
    const pool = run.jokers.filter((o) => o && o.uid !== joker.uid && JOKER[o.id] && copyHow(JOKER[o.id]) !== 'random');
    const t = pick(run, pool);
    st.target = t ? t.uid : null;
  }
  // Every Stand-In picks again (each Blind start), or (onlyLost) only those whose target left the
  // rack or that have none (changed 2026-11-23 (Jokers): a Stand-In with nothing to copy picks as
  // soon as there is a Joker it can copy, such as one that just joined; an empty pool draws no RNG).
  function repickCopyTargets(run, onlyLost) {
    for (const joker of run.jokers.slice()) {
      if (!joker || (!onlyLost && !activeJokers(run).includes(joker))) continue;
      const st = randomCopierState(joker);
      if (!st) continue;
      const gone = st.target == null || !findJoker(run, st.target) || st.target === joker.uid;
      if (!onlyLost || gone) pickCopyTarget(run, joker, st);
    }
  }

  // ---------------------------------------------------------------------------
  // Rule words: passive flags read from the active Jokers, copies included (3.4). One Joker
  // or copy turns a rule on and more copies add nothing: the leftmost value is used.
  // ---------------------------------------------------------------------------
  const RULE_WORDS = ['freeFirstDiscard', 'freeSmallDiscard', 'rerollDiscount', 'interestStep', 'wrapStraights', 'acesAreFaces', 'fourCardFlush',
    'handsContain', 'tarotSelectPlus', 'firstPackExtraPick', 'bossTargetMult', 'voucherPriceMult', 'wildJacks', 'editionsTwice', 'blindMoneyX', 'everySuit', 'copy'];
  function rulesOf(run, skipUid) {
    const out = {};
    if (!run || !Array.isArray(run.jokers)) return out;
    for (const j of activeJokers(run)) {
      if (j.uid === skipUid) continue;
      for (const f of facetsOf(run, j)) {
        const r = f.row.rules;
        if (!isObj(r)) continue;
        for (const k of Object.keys(r)) if (k !== 'copy' && out[k] === undefined && r[k] != null && r[k] !== false) out[k] = r[k];
      }
    }
    return out;
  }
  const ruleOf = (run, rule) => rulesOf(run)[rule];
  const numRule = (rules, key) => (Number(rules[key]) > 0 ? Number(rules[key]) : 0);

  // ---------------------------------------------------------------------------
  // Joker events. An event fires on every active Joker, left to right; each facet that may run
  // events (a Joker's own row, Old Flame's copy) runs its entries whose `when` holds. An entry
  // runs set, add, max, eatenAt and enhanceScored, then the operations in EVENT_OPS order.
  // What the operations did is reported in out.events (actions return it as jokerEvents).
  // ---------------------------------------------------------------------------
  const SETTERS = Object.assign(dict(), {
    randomRank: (run) => 2 + randInt(run, 13),
    coinFlip: (run) => (rand(run) < 0.5 ? 'heads' : 'tails'), // added 2026-11-23 (Jokers)
  });
  const SCORING_EVENTS = ['cardScored', 'handScored']; // run inside scoreCards: state operations only
  const STATE_OPS = ['when', 'set', 'add', 'perCard', 'max'];
  const newOut = () => ({ eaten: [], enhanced: [], events: [], drawn: [] });
  const report = (out, joker, f, event, op, detail) => out.events.push(Object.assign({ uid: joker.uid, id: joker.id, copyOf: f.copyOf, event, op }, detail));
  // Scored cards of that suit (their own suit; with everySuit, Sir Motley, every card: decided
  // 2026-11-23 (Jokers), Sir Motley's "every Joker that checks suits" wins over Lamplighter's
  // "own suit", which only kept out Masked cards, and those have an Enhancement anyway).
  function enhanceScored(run, spec, c, out) {
    for (const uid of c.scored || []) {
      const card = getCard(run, uid);
      if (!card || !(card.suit === spec.suit || !!(c && c.everySuit)) || (spec.onlyPlain && card.enhancement)) continue;
      card.enhancement = spec.to;
      out.enhanced.push(uid);
    }
  }
  const handOfRun = (run) => (run.phase === 'play' && run.blind ? run.blind : holderOf(run));
  const EVENT_OPS = [
    ['money', (run, joker, f, e, c, out, name, times) => {
      let amount = (Number(e.money) || 0) * times;
      if (!(amount > 0)) return;
      if (inBlind(run) && numRule(c.rules, 'blindMoneyX') > 0) amount = r6(amount * numRule(c.rules, 'blindMoneyX')); // Golden Hour
      gainMoney(run, amount);
      report(out, joker, f, name, 'money', { amount });
    }],
    ['extraHand', (run, joker, f, e, c, out, name) => {
      const n = Math.floor(Number(e.extraHand) || 0);
      if (!inBlind(run) || !n) return; // no effect outside a Blind
      run.blind.handsLeft = Math.max(DEF.minHands, run.blind.handsLeft + n);
      report(out, joker, f, name, 'extraHand', { hands: n });
    }],
    ['gainTag', (run, joker, f, e, c, out, name) => {
      if (!TAG[e.gainTag]) return;
      const gained = applyTag(run, e.gainTag, { noPack: true });
      report(out, joker, f, name, 'gainTag', { tag: e.gainTag, gained });
    }],
    ['editionDeckCards', (run, joker, f, e, c, out, name) => {
      const spec = isObj(e.editionDeckCards) ? e.editionDeckCards : {};
      const weights = Object.assign({}, spec.weights);
      for (const id of Object.keys(weights)) if (!EDITION[id] || !editionTakesSlot(id)) delete weights[id]; // never Phantom
      const cards = pickDistinct(run, run.cards.filter((k) => !k.edition), Math.max(0, Math.floor(Number(spec.count) || 0)));
      for (const k of cards) k.edition = editionFrom(run, { weights });
      if (cards.length) report(out, joker, f, name, 'editionDeckCards', { uids: cards.map((k) => k.uid), editions: cards.map((k) => k.edition) });
    }],
    ['sealHandCard', (run, joker, f, e, c, out, name) => {
      const h = handOfRun(run);
      if (!h) return;
      const cards = pickDistinct(run, h.hand.map((u) => getCard(run, u)).filter((k) => k && !k.seal), Math.max(0, Math.floor(Number(e.sealHandCard) || 0)));
      for (const k of cards) k.seal = pick(run, SEAL_IDS);
      if (cards.length) report(out, joker, f, name, 'sealHandCard', { uids: cards.map((k) => k.uid), seals: cards.map((k) => k.seal) });
    }],
    ['createPlanet', (run, joker, f, e, c, out, name) => {
      if (freeConsumableSlots(run) <= 0) return;
      const k = addConsumable(run, 'planet', PLANET_FOR[mostPlayedHand(run) || DEFAULT_GRUDGE]);
      report(out, joker, f, name, 'createPlanet', { created: [k.uid] });
    }],
    ['createTarot', (run, joker, f, e, c, out, name) => {
      const ids = pickDistinct(run, TAROT_IDS, Math.min(Math.max(0, Math.floor(Number(e.createTarot) || 0)), freeConsumableSlots(run)));
      if (ids.length) report(out, joker, f, name, 'createTarot', { created: ids.map((id) => addConsumable(run, 'tarot', id).uid) });
    }],
    ['createSpectral', (run, joker, f, e, c, out, name) => {
      const ids = pickDistinct(run, SPECTRAL_POOL, Math.min(Math.max(0, Math.floor(Number(e.createSpectral) || 0)), freeConsumableSlots(run)));
      if (ids.length) report(out, joker, f, name, 'createSpectral', { created: ids.map((id) => addConsumable(run, 'spectral', id).uid) });
    }],
    ['handSizeThisBlind', (run, joker, f, e, c, out, name) => {
      const spec = isObj(e.handSizeThisBlind) ? e.handSizeThisBlind : { add: e.handSizeThisBlind };
      if (!inBlind(run)) return;
      const b = run.blind;
      const by = isObj(b.handSizeBy) ? b.handSizeBy : (b.handSizeBy = {});
      const used = Number(by[joker.uid]) || 0;
      const cap = spec.max != null ? Number(spec.max) : Infinity;
      const inc = Math.min(Math.floor(Number(spec.add) || 0), cap - used);
      if (!(inc > 0)) return;
      b.handSizeDelta = (b.handSizeDelta || 0) + inc;
      by[joker.uid] = used + inc;
      const drawn = drawUp(run, b);
      out.drawn.push(...drawn);
      report(out, joker, f, name, 'handSizeThisBlind', { handSize: inc, drawn });
    }],
    ['enhanceAdded', (run, joker, f, e, c, out, name) => {
      const uids = [];
      for (const k of c.cards || []) {
        if (!k || k.enhancement) continue;
        k.enhancement = pick(run, ENH_IDS);
        uids.push(k.uid);
      }
      if (uids.length) report(out, joker, f, name, 'enhanceAdded', { uids });
    }],
    ['rankUpScored', (run, joker, f, e, c, out, name) => {
      const map = isObj(e.rankUpScored) ? e.rankUpScored : {};
      const uids = [];
      for (const u of c.scored || []) {
        const k = getCard(run, u);
        const to = k ? Number(map[k.rank]) : NaN;
        if (!k || !(to >= 2 && to <= 14)) continue;
        k.rank = to;
        uids.push(u);
      }
      if (uids.length) report(out, joker, f, name, 'rankUpScored', { uids });
    }],
  ];
  // How many times an entry's operations count: every card (perCard), every face card (perFace), or once.
  const entryTimes = (entry, c) => (entry.perCard ? (c.cards ? c.cards.length : 0) : entry.perFace ? (c.cards || []).filter((k) => k && faceCard(k, c)).length : 1);
  // Runs one event entry on a facet; -> true when the Joker is gone (eaten) or Old Flame forgot.
  function applyEventEntry(run, joker, f, entry, c, out, name) {
    const st = ensureState(run, f);
    const before = Object.assign({}, st);
    const times = entryTimes(entry, c);
    if (isObj(entry.set)) for (const k of Object.keys(entry.set)) st[k] = typeof entry.set[k] === 'string' && SETTERS[entry.set[k]] ? SETTERS[entry.set[k]](run) : entry.set[k];
    if (isObj(entry.add)) for (const k of Object.keys(entry.add)) st[k] = r6(stateNum(st, k, f.row) + (Number(entry.add[k]) || 0) * times);
    if (isObj(entry.max)) for (const k of Object.keys(entry.max)) st[k] = Math.min(entry.max[k], stateNum(st, k, f.row));
    for (const k of Object.keys(st)) if (st[k] !== before[k]) report(out, joker, f, name, 'state', { key: k, from: before[k] === undefined ? null : before[k], to: st[k] });
    let gone = false;
    if (isObj(entry.eatenAt)) for (const k of Object.keys(entry.eatenAt)) if ((Number(st[k]) || 0) <= entry.eatenAt[k]) gone = true;
    if (gone) {
      if (f.path.length) {
        // Old Flame: an ability that would destroy itself leaves it with nothing instead.
        const holder = findJoker(run, f.holderUid);
        if (holder && isObj(holder.state)) holder.state.copy = null;
        report(out, joker, f, name, 'forgot', {});
      } else if (!out.eaten.includes(joker.uid)) out.eaten.push(joker.uid);
      return true;
    }
    if (isObj(entry.enhanceScored)) enhanceScored(run, entry.enhanceScored, c, out);
    for (const [op, fn] of EVENT_OPS) if (entry[op] != null && entry[op] !== false) fn(run, joker, f, entry, c, out, name, times);
    return false;
  }
  // A copy (Stand-In, The Puppet Master) runs its target's operations except the state ones (set,
  // add, max, eatenAt): it reads the target's state, so gains don't fire twice, and it is never
  // eaten. A Stand-In copying Doorman also pays $1 when a Blind starts (changed 2026-11-23 (Jokers):
  // a copy used to run none of its target's events). Its jokerEvents carry copyOf (the target's id).
  function applyCopiedEntry(run, joker, f, entry, c, out, name) {
    const times = entryTimes(entry, c);
    if (isObj(entry.enhanceScored)) enhanceScored(run, entry.enhanceScored, c, out);
    for (const [op, fn] of EVENT_OPS) if (entry[op] != null && entry[op] !== false) fn(run, joker, f, entry, c, out, name, times);
  }
  function eventCtx(run, extra) {
    const rules = rulesOf(run);
    return Object.assign({ run, blind: run.blind || null, washout: !!bossFlag(run, 'noEnhancements'), censor: !!bossFlag(run, 'noEditionsSeals'), rules, everySuit: !!rules.everySuit }, extra || {});
  }
  function fireOne(run, joker, name, extra, out, base) {
    if (SCORING_EVENTS.includes(name)) return out;
    const ctx0 = base || eventCtx(run, extra);
    for (const f of facetsOf(run, joker)) {
      const list = isObj(f.row.events) ? f.row.events[name] : null;
      if (!Array.isArray(list)) continue;
      if (!f.events) {
        const cc = Object.assign({}, ctx0, { joker: { uid: joker.uid, id: f.row.id, state: f.state, edition: joker.edition || null } });
        for (const entry of list) if (isObj(entry) && matches(entry.when, cc)) applyCopiedEntry(run, joker, f, entry, cc, out, name);
        continue;
      }
      const c = Object.assign({}, ctx0, { joker: { uid: joker.uid, id: f.row.id, state: ensureState(run, f), edition: joker.edition || null } });
      for (const entry of list) {
        if (!isObj(entry) || !matches(entry.when, c)) continue;
        if (applyEventEntry(run, joker, f, entry, c, out, name)) break; // eaten, or Old Flame forgot
      }
    }
    return out;
  }
  // Takes Jokers out of the rack; a Stand-In whose target left picks again at once.
  function dropJokers(run, uids) {
    if (!uids.length) return;
    run.jokers = run.jokers.filter((j) => !uids.includes(j.uid));
    repickCopyTargets(run, true);
  }
  // Fires an event on every active Joker, left to right (skipping `skip` uids). Eaten Jokers
  // leave the rack afterwards.
  function fireJokerEvent(run, name, extra, out, skip) {
    const o = out || newOut();
    const base = eventCtx(run, extra);
    for (const joker of activeJokers(run).slice()) {
      if (skip && skip.includes(joker.uid)) continue;
      if (run.jokers.includes(joker)) fireOne(run, joker, name, null, o, base);
    }
    dropJokers(run, o.eaten.filter((u) => findJoker(run, u)));
    return o;
  }

  // The words a Joker row may use, and a checker for new rows (an unknown word never fires,
  // so a typo would otherwise go unnoticed).
  const VOCABULARY = {
    on: ['card', 'held', 'hand', 'cashout', 'retrigger'],
    conditions: Object.keys(CONDITIONS),
    counters: Object.keys(COUNTERS),
    events: ['gained', 'blindStart', 'blindCleared', 'discard', 'afterHand', 'cardScored', 'handScored', 'packOpened', 'jokerSold', 'sold', 'consumableUsed', 'cardAdded', 'cardDestroyed', 'purchase'],
    eventOps: ['when', 'set', 'add', 'perCard', 'max', 'eatenAt', 'enhanceScored', ...EVENT_OPS.map(([k]) => k), 'perFace'],
    setters: Object.keys(SETTERS),
    rules: RULE_WORDS.slice(),
    amounts: ['number', 'state', 'per', 'every', 'perState', 'linear'], // added 2026-11-23 (Jokers)
  };
  function effectProblems(e, at) {
    if (!isObj(e)) return [`${at}: not an effect`];
    const out = [];
    if (!VOCABULARY.on.includes(e.on)) out.push(`${at}: unknown on '${e.on}'`);
    for (const w of Object.keys(isObj(e.when) ? e.when : {})) if (!CONDITIONS[w]) out.push(`${at}: unknown condition '${w}'`);
    if (e.on !== 'retrigger' && !effectKind(e)) out.push(`${at}: no chips, mult, xmult or money`);
    if (isObj(e.per) && typeof e.per.state !== 'string' && !COUNTERS[e.per.count]) out.push(`${at}: unknown counter '${e.per.count}'`);
    else if (typeof e.per === 'string' && !COUNTERS[e.per]) out.push(`${at}: unknown counter '${e.per}'`);
    if (e.linear && (effectKind(e) !== 'xmult' || e.per == null)) out.push(`${at}: linear needs xmult and per`);
    return out;
  }
  function eventProblems(name, list) {
    const out = VOCABULARY.events.includes(name) ? [] : [`unknown event '${name}'`];
    for (const entry of Array.isArray(list) ? list : []) {
      if (!isObj(entry)) {
        out.push(`${name}: not an entry`);
        continue;
      }
      for (const k of Object.keys(entry)) {
        if (!VOCABULARY.eventOps.includes(k)) out.push(`${name}: unknown operation '${k}'`);
        else if (SCORING_EVENTS.includes(name) && !STATE_OPS.includes(k)) out.push(`${name}: operation '${k}' can't run inside scoring`);
      }
      for (const w of Object.keys(isObj(entry.when) ? entry.when : {})) if (!CONDITIONS[w]) out.push(`${name}: unknown condition '${w}'`);
      for (const v of Object.values(isObj(entry.set) ? entry.set : {})) {
        if (typeof v === 'string' && !SETTERS[v]) out.push(`${name}: unknown setter '${v}'`);
        else if (typeof v === 'string' && SCORING_EVENTS.includes(name)) out.push(`${name}: setter '${v}' can't run inside scoring`);
      }
      if (entry.gainTag != null && !TAG[entry.gainTag]) out.push(`${name}: unknown Tag '${entry.gainTag}'`);
      else if (entry.gainTag != null && TAG[entry.gainTag].pack) out.push(`${name}: gainTag '${entry.gainTag}' would open a pack`);
      if (entry.createPlanet != null && entry.createPlanet !== 'mostPlayed') out.push(`${name}: createPlanet takes 'mostPlayed'`);
    }
    return out;
  }
  function jokerProblems(row) {
    if (!row || typeof row !== 'object') return ['not a Joker row'];
    const out = [];
    for (const k of ['id', 'name', 'text', 'rarity']) if (typeof row[k] !== 'string' || !row[k]) out.push(`missing ${k}`);
    if (!(Number(row.cost) >= 0)) out.push('missing cost');
    if (row.rarity && !RARITY_IDS.includes(row.rarity)) out.push(`unknown rarity '${row.rarity}'`);
    (Array.isArray(row.effects) ? row.effects : []).forEach((e, i) => out.push(...effectProblems(e, `effects[${i}]`)));
    for (const name of Object.keys(isObj(row.events) ? row.events : {})) out.push(...eventProblems(name, row.events[name]));
    for (const k of Object.keys(isObj(row.rules) ? row.rules : {})) if (!VOCABULARY.rules.includes(k)) out.push(`unknown rule '${k}'`);
    if (isObj(row.rules) && row.rules.copy != null && !COPY_HOWS.includes(row.rules.copy)) out.push(`unknown copy '${row.rules.copy}'`);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Scoring (2.4) -> ScoreResult (4.3). Pure: reads the run, never changes it. Joker gains
  // during scoring (the cardScored and handScored events) change a per-hand copy of the
  // Joker's state (x.vstate); they are reported in result.jokerGains and playHand stores them.
  // ---------------------------------------------------------------------------
  const labelFor = (kind, n) => (kind === 'xmult' ? TIMES + formatNumber(n) : kind === 'money' ? '+$' + formatNumber(n) : '+' + formatNumber(n));
  function newTally(chips, mult) {
    const t = { chips, mult, steps: [], moneyX: 1 };
    t.add = (kind, amount0, m) => {
      // Golden Hour (blindMoneyX): money steps from cards and Jokers during a Blind pay more.
      const amount = kind === 'money' && t.moneyX > 1 ? r6(amount0 * t.moneyX) : amount0;
      // Running Chips and Mult saturate at the largest finite number (they never become Infinity).
      if (kind === 'chips') t.chips = capNum(t.chips + amount);
      else if (kind === 'mult') t.mult = capNum(r6(t.mult + amount));
      else if (kind === 'xmult') t.mult = capNum(r6(t.mult * amount));
      t.steps.push({
        source: m.source, uid: m.uid || null, cardUid: m.cardUid || null, kind, amount,
        label: m.label != null ? m.label : labelFor(kind, amount),
        via: m.via || null, enhancement: m.enhancement || null, edition: m.edition || null, seal: m.seal || null, jokerUid: m.jokerUid || null,
        copyOf: m.copyOf || null, jokerName: m.jokerName || null, // added 2026-11-23 (Jokers)
        runningChips: t.chips, runningMult: t.mult,
      });
    };
    t.note = (m, label) => t.add('note', 0, Object.assign({}, m, { label }));
    return t;
  }
  const scoringJokers = (run) => (Array.isArray(run.jokers) ? run.jokers : []).filter((j) => j && JOKER[j.id] && j.uid !== wetUid(run));
  // A facet's state as this hand sees it: the per-hand copy once a gain has touched it.
  const stateOf = (x, f) => x.vstate[holderKey(f)] || f.state;
  const ctxOf = (x, joker, f, card, info) => ({
    x, run: x.run, blind: x.blind, washout: x.washout, censor: x.censor, everySuit: x.everySuit, rules: x.rules,
    joker: { uid: joker.uid, id: f.row.id, state: stateOf(x, f), edition: joker.edition || null }, card: card || null, info: info || null,
  });
  const jokerMark = (joker, f) => ({ copyOf: f.copyOf, jokerName: nameFor(joker, f) });

  function runJokerEffects(x, joker, on, card, info) {
    for (const f of x.facets[joker.uid] || []) {
      for (const e of f.row.effects || []) {
        if (!isObj(e) || e.on !== on) continue;
        const c = ctxOf(x, joker, f, card, info);
        if (!matches(e.when, c)) continue;
        const v = effectAmount(e, c);
        if (v) x.add(v.kind, v.amount, Object.assign({ source: 'joker', uid: joker.uid, cardUid: card ? card.uid : null, via: 'joker' }, jokerMark(joker, f)));
      }
    }
  }
  // cardScored (each pass of a scored card) and handScored (once, before the Joker pass): state
  // operations on the per-hand copy of the state, for the facets that run events.
  function scoringEvent(x, name, card, info) {
    for (const joker of x.jokers) {
      for (const f of x.facets[joker.uid] || []) {
        const list = f.events && isObj(f.row.events) ? f.row.events[name] : null;
        if (!Array.isArray(list)) continue;
        for (const entry of list) {
          if (!isObj(entry) || !matches(entry.when, ctxOf(x, joker, f, card, info))) continue;
          const key = holderKey(f);
          const st = x.vstate[key] || (x.vstate[key] = Object.assign({}, f.state));
          const before = Object.assign({}, st);
          const times = 1; // one pass of one card (cardScored) or the whole hand (handScored)
          if (isObj(entry.set)) for (const k of Object.keys(entry.set)) if (!(typeof entry.set[k] === 'string' && SETTERS[entry.set[k]])) st[k] = entry.set[k];
          if (isObj(entry.add)) for (const k of Object.keys(entry.add)) st[k] = r6(stateNum(st, k, f.row) + (Number(entry.add[k]) || 0) * times);
          if (isObj(entry.max)) for (const k of Object.keys(entry.max)) st[k] = Math.min(entry.max[k], stateNum(st, k, f.row));
          for (const k of Object.keys(st)) {
            if (st[k] === before[k]) continue;
            x.gains.push({ uid: f.holderUid, path: f.path.slice(), key: k, from: before[k] === undefined ? null : before[k], to: st[k], cardUid: card ? card.uid : null, at: x.steps.length });
          }
        }
      }
    }
  }
  // One entry per extra pass: the Encore Seal's first, then each Joker's, left to right.
  function extraPasses(x, card, of, info) {
    const out = [];
    const seal = !x.censor && card.seal && SEAL[card.seal];
    for (let k = 0; seal && k < (seal.retrigger || 0); k++) out.push({ seal: card.seal, jokerUid: null });
    for (const joker of x.jokers) {
      for (const f of x.facets[joker.uid] || []) {
        for (const e of f.row.effects || []) {
          if (!isObj(e) || e.on !== 'retrigger' || (e.of || 'scored') !== of || !matches(e.when, ctxOf(x, joker, f, card, info))) continue;
          for (let k = 0; k < Math.max(1, Math.floor(Number(e.times) || 1)); k++) out.push(Object.assign({ seal: null, jokerUid: joker.uid }, jokerMark(joker, f)));
        }
      }
    }
    return out;
  }
  // (a) rank: an Inverted (Phantom) card gives its rank as Mult; under editionsTwice that step
  // is an Edition step and fires twice.
  function rankStep(x, card) {
    const cc = cardChips(card);
    const ed = !x.censor && editionOf(card.edition);
    if (ed && ed.rankAsMult) for (let k = 0; k < x.edTimes; k++) x.add('mult', cc, { source: 'card', uid: card.uid, via: 'rank', edition: ed.id });
    else x.add('chips', cc, { source: 'card', uid: card.uid, via: 'rank' });
  }
  function growNow(x, card) {
    return x.growNow[card.uid] != null ? x.growNow[card.uid] : Math.max(0, Number(card.grow) || 0);
  }
  function enhancementSteps(x, card) {
    const e = !x.washout && card.enhancement && ENH[card.enhancement];
    if (!e) return;
    const m = { source: 'card', uid: card.uid, via: 'enhancement', enhancement: e.id };
    if (e.grow) {
      const now = growNow(x, card) + e.grow;
      if (x.growBy[card.uid] == null) {
        x.growBy[card.uid] = 0;
        x.growOrder.push(card.uid);
      }
      x.growNow[card.uid] = now;
      x.growBy[card.uid] += e.grow;
      x.add('chips', now, m);
    }
    if (e.chips) x.add('chips', e.chips, m);
    if (e.mult) x.add('mult', e.mult, m);
    if (e.money) x.add('money', e.money, m);
    if (e.xmult) x.add('xmult', e.xmult, m);
  }
  // An Edition's steps; editionsTwice (Kaleidoscope) fires each one twice in a row.
  function editionSteps(x, ed, m) {
    for (let k = 0; k < x.edTimes; k++) {
      if (ed.chips) x.add('chips', ed.chips, m);
      if (ed.mult) x.add('mult', ed.mult, m);
      if (ed.xmult) x.add('xmult', ed.xmult, m);
    }
  }
  function cardPass(x, card, info) {
    rankStep(x, card);
    enhancementSteps(x, card);
    const ed = !x.censor && editionOf(card.edition);
    if (ed) editionSteps(x, ed, { source: 'card', uid: card.uid, via: 'edition', edition: ed.id });
    for (const joker of x.jokers) runJokerEffects(x, joker, 'card', card, info);
    scoringEvent(x, 'cardScored', card, info);
  }
  function heldPass(x, card) {
    const e = !x.washout && card.enhancement && ENH[card.enhancement];
    if (e && e.heldMult) x.add('mult', e.heldMult, { source: 'held', uid: card.uid, via: 'enhancement', enhancement: e.id });
    for (const joker of x.jokers) runJokerEffects(x, joker, 'held', card, null);
  }
  // Every pass after the first is announced 'Encore!' (the wording ruling of the final pass, 2026-11-24: the theatre
  // word fits the room), and the UI keys on via 'retrigger'.
  const RETRIGGER_LABEL = 'Encore!';
  const againNote = (x, source, card, p) => x.note({ source, uid: card.uid, via: 'retrigger', seal: p.seal, jokerUid: p.jokerUid, copyOf: p.copyOf, jokerName: p.jokerName }, RETRIGGER_LABEL);

  // 2. The Heckler boos the highest-ranked scoring card (leftmost on ties). -> index or -1
  function bossPrePass(x, ev) {
    if (!x.boss || !x.boss.boos) return -1;
    let best = -1;
    for (const i of ev.idx) if (best < 0 || x.played[i].rank > x.played[best].rank) best = i;
    if (best >= 0) x.note({ source: 'boss', uid: x.played[best].uid, via: 'boss' }, 'Booed');
    return best;
  }
  // 3. Scoring cards, left to right: every pass runs rank, Enhancement, Edition, on-card Jokers.
  function scoreScoringCards(x, ev, booedIdx) {
    const first = ev.idx[0];
    const last = ev.idx[ev.idx.length - 1];
    for (const i of ev.idx) {
      if (i === booedIdx) continue;
      const card = x.played[i];
      const info = { first: i === first, last: i === last };
      if (ev.cameo.includes(i)) x.note({ source: 'card', uid: card.uid, via: 'seal', seal: card.seal }, 'Cameo');
      cardPass(x, card, info);
      for (const p of extraPasses(x, card, 'scored', info)) {
        againNote(x, 'card', card, p);
        cardPass(x, card, info);
      }
    }
  }
  // 4. Held cards, left to right. A held card with nothing to give is never retriggered.
  function scoreHeldCards(x) {
    for (const card of x.held) {
      const before = x.steps.length;
      heldPass(x, card);
      if (x.steps.length === before) continue;
      for (const p of extraPasses(x, card, 'held', null)) {
        againNote(x, 'held', card, p);
        heldPass(x, card);
      }
    }
  }
  // 5. Jokers, left to right: Edition before, the Joker's hand effects (each facet's, for a
  // copier), Edition after. A copier's Edition is its own.
  function scoreJokers(x) {
    scoringEvent(x, 'handScored', null, null);
    for (const joker of x.jokers) {
      const ed = !x.censor && editionOf(joker.edition);
      const m = ed ? { source: 'joker', uid: joker.uid, via: 'edition', edition: ed.id, jokerName: (JOKER[joker.id] || {}).name || null } : null;
      if (ed && ed.timing === 'before') editionSteps(x, ed, m);
      runJokerEffects(x, joker, 'hand', null, null);
      if (ed && ed.timing === 'after') editionSteps(x, ed, m);
    }
  }
  // 6. Boss post-pass: The Lid's cap, then The Spoilsport, then The Warm-Up.
  // The Lid's cap: `cap`, plus `capPerAnte` for each Ante after the first one it can appear in
  // (fromAnte); added 2026-11-23 (Jokers, balance).
  const bossCap = (b, ante) => b.cap + (Number(b.capPerAnte) > 0 ? Number(b.capPerAnte) : 0) * Math.max(0, Math.floor(Number(ante) || 1) - (b.fromAnte || 1));
  function bossPostPass(x, handId) {
    const b = x.boss;
    if (!b) return;
    const cap = b.cap != null ? bossCap(b, x.run.ante) : null;
    if (cap != null && x.mult > cap) {
      x.mult = cap;
      x.note({ source: 'boss', via: 'boss' }, `Capped at ${formatNumber(cap)}`);
    }
    if (b.mostPlayedX && x.blind && x.blind.grudgeHand === handId) x.add('xmult', b.mostPlayedX, { source: 'boss', via: 'boss', label: 'Half Mult' });
    if (b.firstHandX && isFirstHand(x.blind)) x.add('xmult', b.firstHandX, { source: 'boss', via: 'boss', label: 'Warm-up: half' });
  }

  function scoreCards(run, playedCards, heldCards) {
    if (!run || typeof run !== 'object' || !Array.isArray(playedCards)) return null;
    const blind = run.blind || null;
    const boss = (blind && blind.boss && BOSS[blind.boss]) || null;
    const washout = !!(boss && boss.noEnhancements);
    const censor = !!(boss && boss.noEditionsSeals);
    const rules = rulesOf(run);
    const ev = evalIdx(playedCards, detectOpts(washout, censor, rules));
    if (!ev) return null;
    const { name, level, chips, mult } = handValues(run, ev.handId);
    const x = newTally(chips, mult);
    const jokers = scoringJokers(run);
    const facets = dict(); // by Joker uid; growNow, growBy and vstate by card uid or state key
    for (const j of jokers) facets[j.uid] = facetsOf(run, j);
    Object.assign(x, {
      run, blind, boss, washout, censor, rules, everySuit: !!rules.everySuit, handId: ev.handId, played: playedCards,
      held: Array.isArray(heldCards) ? heldCards.filter(validCard) : [], jokers, facets,
      growNow: dict(), growBy: dict(), growOrder: [], vstate: dict(), gains: [],
      edTimes: rules.editionsTwice ? 2 : 1,
      moneyX: blind && numRule(rules, 'blindMoneyX') > 0 ? numRule(rules, 'blindMoneyX') : 1,
    });
    x.note({ source: 'base' }, `${name} lv.${level}`); // 1. base
    const booedIdx = bossPrePass(x, ev);
    x.scoring = ev.idx.map((i) => playedCards[i]);
    x.scored = ev.idx.filter((i) => i !== booedIdx).map((i) => playedCards[i]);
    scoreScoringCards(x, ev, booedIdx);
    scoreHeldCards(x);
    scoreJokers(x);
    bossPostPass(x, ev.handId);
    return {
      handId: ev.handId,
      name,
      level,
      playedUids: playedCards.map((c) => c.uid),
      scoringUids: x.scoring.map((c) => c.uid),
      booedUid: booedIdx >= 0 ? playedCards[booedIdx].uid : null,
      steps: x.steps,
      chips: x.chips,
      mult: x.mult,
      total: capNum(Math.floor(x.chips * x.mult + 1e-9)), // 7. total (finite: saturates at Number.MAX_VALUE)
      grow: x.growOrder.map((uid) => ({ uid, by: x.growBy[uid] })),
      jokerGains: x.gains, // added 2026-11-23 (Jokers)
    };
  }
  // playHand stores the gains a scored hand reported (the last value of each key wins).
  function applyJokerGains(run, gains) {
    for (const g of gains || []) {
      const holder = findJoker(run, g.uid);
      if (!holder) continue;
      if (!isObj(holder.state)) holder.state = {};
      let st = holder.state;
      for (const k of g.path || []) {
        if (!isObj(st[k])) st[k] = {};
        st = st[k];
      }
      st[g.key] = g.to;
    }
  }

  // ---------------------------------------------------------------------------
  // Hands of cards. A "holder" owns a hand and a draw pile: the Blind during play, or the
  // open Booster Pack when it dealt a hand for its Tarot and Spectral cards.
  // ---------------------------------------------------------------------------
  const dealsHand = (p) => !!(p && PACK[p.id] && PACK[p.id].dealsHand && Array.isArray(p.hand) && Array.isArray(p.draw));
  function holderOf(run) {
    if (run.phase === 'play' && run.blind) return run.blind;
    if (run.phase === 'pack' && dealsHand(run.pack)) return run.pack;
    return null;
  }
  const holderSize = (run, h) => (h === run.blind ? handSizeNow(run) : Math.max(DEF.minHandSize, run.handSize));
  function sortHolder(run, h) {
    if (!h || run.sortMode === 'manual') return;
    const cards = h.hand.map((u) => getCard(run, u)).filter(Boolean);
    cards.sort(run.sortMode === 'suit' ? cmpSuit : cmpRank);
    h.hand = cards.map((c) => c.uid);
  }
  function drawUp(run, h) {
    const size = holderSize(run, h);
    const drawn = [];
    while (h.hand.length < size && h.draw.length) {
      const u = h.draw.shift();
      h.hand.push(u);
      drawn.push(u);
    }
    sortHolder(run, h);
    return drawn;
  }
  function sweepAndRedraw(run) {
    const b = run.blind;
    for (const u of b.hand) b.draw.push(u);
    b.hand = [];
    shuffle(run, b.draw);
    return drawUp(run, b);
  }
  // -> uids in hand order, or null when any uid isn't a distinct card in the hand. A uid in the
  // hand with no valid card behind it (a stale or edited save) is refused too, so every check gives
  // the action's own answer (2026-11-23 robustness pass: canPlay said yes and playHand then failed).
  function selectionFrom(run, h, uids) {
    if (!h || !Array.isArray(uids) || !Array.isArray(h.hand)) return null;
    const seen = dict();
    for (const u of uids) {
      if (typeof u !== 'string' || seen[u] || !h.hand.includes(u) || !validCard(getCard(run, u))) return null;
      seen[u] = true;
    }
    return h.hand.filter((u) => seen[u]);
  }
  function mostPlayedHand(run) {
    let best = null;
    for (const id of HAND_IDS) {
      const n = (run.plays && run.plays[id]) || 0;
      if (n > 0 && (best === null || n > run.plays[best])) best = id; // ties keep the stronger
    }
    return best;
  }
  // Removes cards from the deck for good (and from the hand and draw pile they sit in).
  function destroyCards(run, h, uids) {
    run.cards = run.cards.filter((c) => !uids.includes(c.uid));
    if (h) {
      h.hand = h.hand.filter((u) => !uids.includes(u));
      if (Array.isArray(h.draw)) h.draw = h.draw.filter((u) => !uids.includes(u));
    }
  }

  // ---------------------------------------------------------------------------
  // Jokers, consumables, Editions
  // ---------------------------------------------------------------------------
  // A new Joker: a fresh copy of its row's starting state, then its 'gained' events. A Stand-In
  // picks its target at once, and a Stand-In that had nothing to copy picks now (2026-11-23).
  function addJoker(run, id, paid, edition, out) {
    if (!run || !Array.isArray(run.jokers) || !isRowId(JOKER, id)) return null;
    const ed = editionOf(edition) ? edition : null;
    if (editionTakesSlot(ed) && freeJokerSlots(run) <= 0) return null;
    const p = Number(paid);
    const state = isObj(JOKER[id].state) ? clone(JOKER[id].state) : {};
    const joker = { uid: newUid(run, 'h'), id, state, paid: Number.isFinite(p) && p > 0 ? Math.floor(p) : 0, edition: ed };
    run.jokers.push(joker);
    discover(run, 'jokers', id);
    const o = out || newOut();
    fireOne(run, joker, 'gained', null, o);
    const st = randomCopierState(joker);
    if (st) pickCopyTarget(run, joker, st);
    repickCopyTargets(run, true);
    dropJokers(run, o.eaten.filter((u) => findJoker(run, u)));
    return joker;
  }
  function addConsumable(run, kind, id) {
    const k = { uid: newUid(run, 'k'), kind, id };
    run.consumables.push(k);
    discover(run, 'consumables', id);
    return k;
  }
  const unownedJokers = (run, rarity) => JOKER_IDS.filter((id) => !ownsJoker(run, id) && (!rarity || JOKER[id].rarity === rarity));
  // Joker ids the Shop or a pack may offer: not owned, not on offer in the Shop, not in `extra`.
  function offerableJokers(run, rarity, extra) {
    const blocked = {};
    for (const j of run.jokers) blocked[j.id] = true;
    if (run.shop && Array.isArray(run.shop.items)) {
      for (const it of run.shop.items) if (it && it.kind === 'joker' && !it.sold) blocked[it.id] = true;
    }
    if (extra) for (const id of extra) blocked[id] = true;
    return JOKER_IDS.filter((id) => !blocked[id] && (!rarity || JOKER[id].rarity === rarity));
  }
  // Rolls a rarity by weight among those with something left (Legendary weighs 0: never).
  function rollJokerId(run, extra) {
    const pools = {};
    const weights = [];
    for (const r of RARITY_IDS) {
      if (!(RARITY_WEIGHT[r] > 0)) continue;
      pools[r] = offerableJokers(run, r, extra);
      if (pools[r].length) weights.push([r, RARITY_WEIGHT[r]]);
    }
    const rarity = pickWeighted(run, weights);
    return rarity ? pick(run, pools[rarity]) : null;
  }
  // One number r in [0,1), walked through the Editions in table order.
  function rollEdition(run, oddsKey, mult) {
    const r = rand(run);
    let acc = 0;
    for (const id of EDITION_IDS) {
      const p = ((EDITION[id].odds && EDITION[id].odds[oddsKey]) || 0) * mult;
      if (!(p > 0)) continue;
      acc += p;
      if (r < acc) return id;
    }
    return null;
  }
  const deckEditionOdds = (run) => (deckOf(run).editionOdds > 0 ? deckOf(run).editionOdds : 1);
  const rollJokerEdition = (run) => rollEdition(run, 'joker', vProduct(run, 'editionOdds') * deckEditionOdds(run));
  const rollCardEdition = (run) => rollEdition(run, 'card', vProduct(run, 'editionOdds'));
  // An Edition spec is an id, or { weights: { id: weight } } to pick one by weight.
  function editionFrom(run, spec) {
    if (typeof spec === 'string') return spec;
    return pickWeighted(run, Object.keys(spec.weights).filter((id) => EDITION[id]).map((id) => [id, spec.weights[id]]));
  }
  function levelUp(run, handId, n) {
    run.levels[handId] = levelOf(run, handId) + n;
  }
  function createMostPlayedPlanet(run) {
    const hand = mostPlayedHand(run) || pick(run, HAND_IDS);
    return addConsumable(run, 'planet', PLANET_FOR[hand]);
  }

  // ---------------------------------------------------------------------------
  // Prices (2.8): base price (Vouchers: voucherPriceMult, rounded up), then the Sale Tag
  // (Jokers), then Season Pass ($1 off everything).
  // ---------------------------------------------------------------------------
  function jokerCost(id, edition) {
    const ed = editionOf(edition);
    return (JOKER[id] ? JOKER[id].cost : 0) + (ed ? ed.surcharge || 0 : 0);
  }
  function basePrice(run, kind, id, edition) {
    switch (kind) {
      case 'joker': return jokerCost(id, edition);
      case 'tarot': return Math.max(1, SHOP.prices.tarot + (deckOf(run).tarotPriceDelta || 0));
      case 'planet': return SHOP.prices.planet;
      case 'spectral': return SHOP.prices.spectral;
      case 'voucher': {
        const p = (VOUCHER[id] && VOUCHER[id].price) || SHOP.prices.voucher;
        const x = numRule(rulesOf(run), 'voucherPriceMult'); // Usher
        return x > 0 && x !== 1 ? Math.ceil(p * x - 1e-9) : p;
      }
      case 'pack': return PACK[id] ? PACK[id].price : 0;
      default: return 0;
    }
  }
  function priceOf(run, kind, id, edition) {
    let p = basePrice(run, kind, id, edition);
    const discount = run.shop && run.shop.discount > 0 ? run.shop.discount : 0;
    if (kind === 'joker' && discount > 0) p = Math.max(1, roundTo(p * (1 - discount), 1));
    const off = vSum(run, 'priceOff');
    return off > 0 ? Math.max(1, p - off) : p;
  }
  // Owner decision: every Joker sells for half its cost (listed cost plus its current Edition's
  // surcharge), whatever was paid; a Deck with sellFull sells for the full cost. Minimum $1.
  function jokerSellValue(run, uid) {
    const j = findJoker(run, uid);
    if (!j) return 0;
    const cost = jokerCost(j.id, j.edition);
    return Math.max(1, deckOf(run).sellFull ? cost : Math.floor(cost / 2));
  }
  const consumableSell = (k) => (k && own(SHOP.sell, k.kind)) || 0;
  // Unsold Vouchers follow voucherPriceMult at once when a Joker that has it joins or leaves.
  function repriceVouchers(run, before) {
    if (!run.shop || !Array.isArray(run.shop.items) || ruleOf(run, 'voucherPriceMult') === before) return;
    for (const it of run.shop.items) if (it && it.kind === 'voucher' && !it.sold) it.price = priceOf(run, it.kind, it.id, it.edition);
  }
  // The price of the next paid reroll: shop.rerollCost less rerollDiscount (Spinning Top), at least $1.
  // shop.rerollCost, or the base price when it is not a number of $0 or more (a broken save never
  // rerolls for free; 2026-11-23 robustness pass).
  function rerollBase(run) {
    const c = run.shop ? run.shop.rerollCost : SHOP.rerollCost;
    return typeof c === 'number' && Number.isFinite(c) && c >= 0 ? c : SHOP.rerollCost;
  }
  function paidRerollCost(run) {
    const base = rerollBase(run);
    const d = numRule(rulesOf(run), 'rerollDiscount');
    return d > 0 ? Math.max(1, base - d) : base;
  }

  // ---------------------------------------------------------------------------
  // Shop (2.8)
  // ---------------------------------------------------------------------------
  function shopItem(run, slot, kind, id, extra) {
    const it = Object.assign({ slot, kind, id, price: 0, sold: false, edition: null, size: null }, extra || {});
    it.price = priceOf(run, kind, id, it.edition);
    return it;
  }
  const spectralInShop = (run) => !!deckOf(run).spectralInShop || vAny(run, 'spectralInShop');
  function cardKindWeights(run) {
    const w = SHOP.cardKindWeights;
    const pairs = [['joker', w.joker], ['tarot', w.tarot], ['planet', w.planet]];
    const s = spectralInShop(run) ? SHOP.spectralWeight : w.spectral || 0;
    if (s > 0) pairs.push(['spectral', s]);
    return pairs;
  }
  function pickNotOnOffer(run, ids, kind) {
    const onOffer = {};
    if (run.shop) for (const it of run.shop.items) if (it && it.kind === kind && !it.sold) onOffer[it.id] = true;
    const pool = ids.filter((id) => !onOffer[id]);
    return pick(run, pool.length ? pool : ids);
  }
  function consumableItem(run, kind) {
    const ids = kind === 'tarot' ? TAROT_IDS : kind === 'spectral' ? SPECTRAL_POOL : PLANET_IDS;
    return shopItem(run, 'card', kind, pickNotOnOffer(run, ids, kind));
  }
  function rollCardItem(run) {
    const kind = pickWeighted(run, cardKindWeights(run));
    if (kind !== 'joker') return consumableItem(run, kind);
    const id = rollJokerId(run, null);
    if (!id) return consumableItem(run, 'planet'); // every Joker owned or on offer
    return shopItem(run, 'card', 'joker', id, { edition: rollJokerEdition(run) });
  }
  function packKindWeight(run, kind) {
    if ((run.ante || 1) < (PACK_KIND_FROM_ANTE[kind] || 1)) return 0;
    const w = SHOP.packKindWeights[kind] || 0;
    return kind === 'ghost' && deckOf(run).ghostPackWeight > 0 ? w * deckOf(run).ghostPackWeight : w;
  }
  function rollPackItem(run) {
    const kind = pickWeighted(run, Object.keys(SHOP.packKindWeights).map((k) => [k, packKindWeight(run, k)]));
    const size = pickWeighted(run, Object.keys(SHOP.packSizeWeights).map((s) => [s, SHOP.packSizeWeights[s]]));
    const id = PACK_BY[kind][size] || Object.values(PACK_BY[kind])[0];
    return shopItem(run, 'pack', 'pack', id, { size: PACK[id].size });
  }
  function discoverItem(run, it) {
    if (!it) return;
    if (it.kind === 'joker') discover(run, 'jokers', it.id);
    else if (isConsumableKind(it.kind)) discover(run, 'consumables', it.id);
    else if (it.kind === 'voucher') discover(run, 'vouchers', it.id);
  }
  function pushItem(run, it) {
    run.shop.items.push(it);
    discoverItem(run, it);
  }
  function rollAnteVoucher(run) {
    if (run.anteVoucherAnte === run.ante) return;
    run.anteVoucher = pick(run, VOUCHER_IDS.filter((id) => !hasVoucher(run, id)));
    run.anteVoucherAnte = run.ante;
  }
  function buildShop(run) {
    const sale = !!(run.pending && run.pending.sale);
    if (run.pending) run.pending.sale = false;
    run.shop = {
      items: [], rerollCost: SHOP.rerollCost, rerolls: 0,
      freeRerolls: vSum(run, 'freeRerolls') + (sale ? SALE_TAG.freeRerolls || 0 : 0),
      discount: sale ? SALE_TAG.discount || 0 : 0,
      packsBought: 0, // added 2026-11-23 (Jokers): firstPackExtraPick counts the packs bought this visit
    };
    for (let i = 0; i < SHOP.cardSlots + vSum(run, 'cardSlots'); i++) pushItem(run, rollCardItem(run));
    for (let i = 0; i < SHOP.packSlots + vSum(run, 'packSlots'); i++) pushItem(run, rollPackItem(run));
    rollAnteVoucher(run);
    if (run.anteVoucher && !hasVoucher(run, run.anteVoucher)) pushItem(run, shopItem(run, 'voucher', 'voucher', run.anteVoucher));
  }
  function rerollCards(run) {
    const items = run.shop.items;
    for (let i = 0; i < items.length; i++) if (items[i] && items[i].slot === 'card') items[i] = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i] === null) {
        items[i] = rollCardItem(run);
        discoverItem(run, items[i]);
      }
    }
  }
  function applyVoucher(run, id) {
    const v = VOUCHER[id];
    run.vouchers.push(id);
    discover(run, 'vouchers', id);
    if (v.mods) for (const k of Object.keys(v.mods)) run[k] = (Number(run[k]) || 0) + v.mods[k];
    if (!run.shop) return;
    for (let i = 0; i < (v.cardSlots || 0); i++) pushItem(run, rollCardItem(run));
    for (let i = 0; i < (v.packSlots || 0); i++) pushItem(run, rollPackItem(run));
    if (v.freeRerolls) run.shop.freeRerolls += v.freeRerolls;
    if (v.flatRerolls) run.shop.rerollCost = SHOP.rerollCost; // Second Look: the price stays at the base
    if (v.priceOff) for (const it of run.shop.items) if (it && !it.sold) it.price = priceOf(run, it.kind, it.id, it.edition);
  }

  // ---------------------------------------------------------------------------
  // Booster Packs (2.9)
  // ---------------------------------------------------------------------------
  function rollPackCard(run) {
    const rank = 2 + randInt(run, 13);
    const suit = pick(run, SUITS);
    const enhancement = rand(run) < SHOP.cardPack.enhancement ? pick(run, ENH_IDS) : null;
    const edition = rollCardEdition(run);
    const seal = rand(run) < vMax(run, 'sealOdds', SHOP.cardPack.seal) ? pick(run, SEAL_IDS) : null;
    return newCard(run, rank, suit, { enhancement, edition, seal });
  }
  // Distinct cards of one kind; each slot may instead be Origin Story (at most once a pack).
  function consumableOptions(run, n, kind, ids, originChance) {
    const out = [];
    const left = ids.slice();
    let origin = false;
    for (let i = 0; i < n; i++) {
      if (ORIGIN && !origin && originChance > 0 && rand(run) < originChance) {
        origin = true;
        out.push({ kind: 'spectral', id: ORIGIN, picked: false });
      } else if (left.length) {
        out.push({ kind, id: left.splice(randInt(run, left.length), 1)[0], picked: false });
      }
    }
    return out;
  }
  function jokerOptions(run, n) {
    const chosen = [];
    const out = [];
    for (let i = 0; i < n; i++) {
      const id = rollJokerId(run, chosen);
      if (!id) break;
      chosen.push(id);
      out.push({ kind: 'joker', id, edition: rollJokerEdition(run), picked: false });
    }
    return out;
  }
  const PACK_OPTIONS = Object.assign(dict(), {
    card: (run, n) => Array.from({ length: n }, () => ({ kind: 'card', card: rollPackCard(run), picked: false })),
    tarot: (run, n) => consumableOptions(run, n, 'tarot', TAROT_IDS, SHOP.originStory.tarot || 0),
    planet: (run, n) => consumableOptions(run, n, 'planet', PLANET_IDS, 0),
    joker: (run, n) => jokerOptions(run, n),
    ghost: (run, n) => consumableOptions(run, n, 'spectral', SPECTRAL_POOL, SHOP.originStory.ghost || 0),
  });
  function discoverOption(run, o) {
    if (o.kind === 'joker') discover(run, 'jokers', o.id);
    else if (isConsumableKind(o.kind)) discover(run, 'consumables', o.id);
  }
  // extraPicks: firstPackExtraPick (Lucky Dip) on the first pack bought in a Shop visit; never
  // more picks than the pack shows. The Jokers' packOpened events fire once it is open.
  function openPack(run, id, returnTo, extraPicks, out) {
    const row = PACK[id];
    const options = PACK_OPTIONS[row.kind](run, row.shown + vSum(run, 'packShown'));
    const extra = extraPicks > 0 ? Math.max(0, Math.min(extraPicks, options.length - row.picks)) : 0;
    // hand / draw: the hand dealt for Tarot and Spectral picks (empty for the other packs)
    run.pack = { id, kind: row.kind, size: row.size, options, picksLeft: row.picks + extra, returnTo, hand: [], draw: [] };
    run.phase = 'pack';
    if (row.dealsHand) {
      run.pack.draw = shuffle(run, run.cards.map((c) => c.uid));
      drawUp(run, run.pack);
    }
    for (const o of options) discoverOption(run, o);
    fireJokerEvent(run, 'packOpened', { pack: { id, kind: row.kind, size: row.size } }, out);
  }
  function closePack(run) {
    const back = run.pack && run.pack.returnTo === 'blind-select' ? 'blind-select' : 'shop';
    run.pack = null;
    run.phase = back === 'shop' && !run.shop ? 'blind-select' : back;
  }

  // ---------------------------------------------------------------------------
  // Tarot, Planet and Spectral cards (3.5-3.8). A card's row lists operation fields; the
  // checks below decide whether it can be used, then OPS apply in table order. Used from a
  // consumable slot, the card leaves its slot first (so it never copies itself and frees
  // room for what it creates); picked from a pack, it is used at once and never stored.
  // ---------------------------------------------------------------------------
  const inBlind = (run) => run.phase === 'play' && !!run.blind;
  const leftmostPlain = (run, notLast) => run.jokers.find((j, i) => !j.edition && (!notLast || i < run.jokers.length - 1)) || null;
  function jokerTargets(run, how) {
    if (how === 'leftmostPlain') return leftmostPlain(run, true) ? [leftmostPlain(run, true)] : [];
    return run.jokers.filter((j) => !j.edition); // 'randomPlain'
  }
  // How many Joker slots are free once this card's own destroy has happened.
  function slotsAfterDestroy(run, d) {
    const gone = d.destroyJoker === 'leftmost' ? run.jokers[0] : d.destroyJoker === 'rightmost' ? run.jokers[run.jokers.length - 1] : null;
    return freeJokerSlots(run) + (gone && takesSlot(gone) ? 1 : 0);
  }
  // Jokers a card may create: of its rarity (or the fallback), none you own or it destroys.
  function createPool(run, d, alsoExclude) {
    const excluded = run.jokers.map((j) => j.id).concat(alsoExclude || []);
    const pool = (rarity) => JOKER_IDS.filter((id) => JOKER[id].rarity === rarity && !excluded.includes(id));
    const first = pool(d.createJoker);
    return first.length || !d.fallbackRarity ? first : pool(d.fallbackRarity);
  }
  function checkJokerNeeds(run, d) {
    if (d.needJokers && run.jokers.length < d.needJokers) return needJokers(d.needJokers);
    if (d.jokerEdition && !jokerTargets(run, d.jokerTarget).length) return E.needPlain;
    if ((d.createJoker || d.copyJoker) && slotsAfterDestroy(run, d) <= 0) return E.needSlot;
    if (d.createJoker && !createPool(run, d).length) return d.createJoker === 'common' ? E.noCommons : E.noJokersLeft;
    return null;
  }
  // The leftmost other Tarot or Planet card in the slots (never a Spectral card).
  function copySource(run, d, selfUid) {
    return run.consumables.find((k) => d.copyConsumable.includes(k.kind) && k.uid !== selfUid) || null;
  }
  function checkOtherNeeds(run, d, h, ctx) {
    // "Needs at least n hands left" counts only during a Blind: outside one, the "this Blind"
    // part waits in run.pending and the next Blind keeps at least 1 hand anyway.
    if (d.needHands && inBlind(run) && run.blind.handsLeft < d.needHands) return needHands(d.needHands);
    if (d.needCards && (!h || realUids(run, h.hand).length < d.needCards)) return needCards(d.needCards);
    if (d.copyConsumable && !copySource(run, d, ctx.selfUid)) return E.needOther;
    const room = freeConsumableSlots(run) + (ctx.fromSlot ? 1 : 0); // a used slot card frees its slot
    if ((d.createPlanet || d.copyConsumable) && room <= 0) return E.consFull;
    return null;
  }
  // [min, max] selected cards; tarotSelectPlus (Helping Hand) lets a Tarot card that uses
  // selected cards take more.
  function selectOf(run, d) {
    const [min, max] = d.select;
    const n = d.kind === 'tarot' && max > 0 ? numRule(rulesOf(run), 'tarotSelectPlus') : 0;
    return [min, max + Math.floor(n)];
  }
  // -> { ok } | { ok:false, error }. ctx: { fromSlot, selfUid }.
  function checkUse(run, d, selectedUids, ctx) {
    if (!d) return fail(E.noConsumable);
    const h = holderOf(run);
    if (d.where === 'blind' ? !h : !ANY_PHASES.includes(run.phase)) return fail(d.where === 'blind' ? E.blindOnly : E.useNotNow);
    const [min, max] = selectOf(run, d);
    if (max > 0) {
      const sel = selectionFrom(run, h, selectedUids == null ? [] : selectedUids);
      if (!sel) return fail(E.fromHand);
      if (sel.length < min || sel.length > max) return fail(selectError(min, max));
    }
    const err = checkJokerNeeds(run, d) || checkOtherNeeds(run, d, h, ctx);
    return err ? fail(err) : { ok: true };
  }

  // Each op: (st) where st = { run, d, h, sel, effect, destroyed, resort, goneJokers, lostCards,
  // added, out }. lostCards and added feed the Jokers' cardDestroyed and cardAdded events.
  const pushTo = (effect, key, list) => { effect[key] = (effect[key] || []).concat(list); };
  function forSelected(st, set) {
    for (const u of st.sel) set(getCard(st.run, u));
    st.effect.uids = st.sel.slice();
  }
  function destroyInHand(st, uids) {
    for (const u of uids) if (getCard(st.run, u)) st.lostCards.push(clone(getCard(st.run, u)));
    destroyCards(st.run, st.h, uids);
    pushTo(st.effect, 'destroyed', uids);
    st.destroyed = true;
  }
  function addCardTo(st, card, toHand) {
    st.run.cards.push(card);
    st.added.push(card);
    if (toHand) st.h.hand.push(card.uid);
    else if (st.h && Array.isArray(st.h.draw)) st.h.draw.splice(randInt(st.run, st.h.draw.length + 1), 0, card.uid);
    pushTo(st.effect, 'created', [card.uid]);
  }
  function thisBlind(st, key, pendingKey, n) {
    const { run } = st;
    if (inBlind(run)) {
      const floor = key === 'handsLeft' ? DEF.minHands : key === 'discardsLeft' ? DEF.minDiscards : -Infinity;
      run.blind[key] = Math.max(floor, (run.blind[key] || 0) + n);
    } else {
      const pend = run.pending || (run.pending = freshPending());
      pend[pendingKey] = (pend[pendingKey] || 0) + n; // used outside a Blind: the next one
      st.effect.nextBlind = true;
    }
  }
  function removeJoker(st, joker) {
    st.run.jokers = st.run.jokers.filter((j) => j !== joker);
    pushTo(st.effect, 'destroyed', [joker.uid]);
    st.goneJokers.push(joker.id);
  }
  function jokerEditionOp(st) {
    const { run, d, effect } = st;
    if (d.chance != null && !(rand(run) < d.chance)) {
      effect.hit = false;
      return;
    }
    const target = pick(run, jokerTargets(run, d.jokerTarget));
    target.edition = editionFrom(run, d.jokerEdition);
    Object.assign(effect, { hit: true, jokerUid: target.uid, edition: target.edition });
  }
  function createJokerOp(st) {
    const { run, d, effect } = st;
    const id = pick(run, createPool(run, d, st.goneJokers));
    const joker = addJoker(run, id, 0, d.rollEdition ? rollJokerEdition(run) : null, st.out);
    Object.assign(effect, { jokerId: id, jokerUid: joker ? joker.uid : null });
    if (joker && joker.edition) effect.edition = joker.edition;
  }
  const OPS = [
    ['enhancement', (st) => { forSelected(st, (c) => { c.enhancement = st.d.enhancement; }); st.effect.enhancement = st.d.enhancement; }],
    ['seal', (st) => { forSelected(st, (c) => { c.seal = st.d.seal; }); st.effect.seal = st.d.seal; }],
    ['cardEdition', (st) => { const ed = editionFrom(st.run, st.d.cardEdition); forSelected(st, (c) => { c.edition = ed; }); st.effect.edition = ed; }],
    ['rankDelta', (st) => { forSelected(st, (c) => { c.rank = clampInt(c.rank + st.d.rankDelta, 2, 14); }); st.resort = true; }],
    ['suitFromLeftmost', (st) => {
      const targets = st.d.suitFromLeftmost === 'hand' ? realUids(st.run, st.h.hand) : st.sel;
      const suit = targets.length ? getCard(st.run, targets[0]).suit : null;
      for (const u of targets) getCard(st.run, u).suit = suit;
      Object.assign(st.effect, { uids: targets.slice(), suit });
      st.resort = true;
    }],
    // Wickwisp (decision 'wickwisp'): the whole hand ('hand') or the selected cards
    // ('selected') take the suit of the first selected card.
    ['suitFromSelected', (st) => {
      const src = st.sel.length ? getCard(st.run, st.sel[0]) : null;
      const targets = st.d.suitFromSelected === 'selected' ? st.sel.slice() : realUids(st.run, st.h.hand);
      const suit = src ? src.suit : null;
      if (suit) for (const u of targets) getCard(st.run, u).suit = suit;
      Object.assign(st.effect, { uids: targets, suit });
      st.resort = true;
    }],
    // Copies of each selected card (Carbon Copy takes 2 with Helping Hand).
    ['copies', (st) => {
      for (const u of st.sel) {
        const src = getCard(st.run, u);
        for (let k = 0; k < st.d.copies; k++) addCardTo(st, copyCard(st.run, src), false);
      }
      st.effect.sourceUid = st.sel[0];
      if (st.sel.length > 1) st.effect.sourceUids = st.sel.slice();
    }],
    ['destroy', (st) => {
      const n = st.sel.length;
      destroyInHand(st, st.sel.slice());
      if (st.d.moneyEach) gainMoney(st.run, st.d.moneyEach * n);
      if (st.d.moneyEach) st.effect.money = st.d.moneyEach * n;
    }],
    ['destroyOthers', (st) => destroyInHand(st, pickDistinct(st.run, realUids(st.run, st.h.hand).filter((u) => !st.sel.includes(u)), st.d.destroyOthers))],
    ['destroyRandom', (st) => destroyInHand(st, pickDistinct(st.run, realUids(st.run, st.h.hand), st.d.destroyRandom))],
    ['addCards', (st) => {
      for (let k = 0; k < st.d.addCards; k++) {
        const card = newCard(st.run, 2 + randInt(st.run, 13), pick(st.run, SUITS), { enhancement: pick(st.run, ENH_IDS), seal: pick(st.run, SEAL_IDS) });
        addCardTo(st, card, true);
      }
      st.resort = true;
    }],
    ['money', (st) => {
      const d = st.d;
      const m = d.perAnte ? Math.min(d.maxMoney || Infinity, d.money + d.perAnte * st.run.ante) : d.money;
      gainMoney(st.run, m);
      st.effect.money = m;
    }],
    ['moneyLoss', (st) => { st.effect.moneyLost = loseMoney(st.run, st.d.moneyLoss); }],
    ['loseHalfMoney', (st) => { st.effect.moneyLost = loseMoney(st.run, Math.floor(st.run.money / 2)); }],
    ['hands', (st) => { thisBlind(st, 'handsLeft', 'extraHands', st.d.hands); st.effect.hands = st.d.hands; }],
    ['discards', (st) => { thisBlind(st, 'discardsLeft', 'extraDiscards', st.d.discards); st.effect.discards = st.d.discards; }],
    ['handSize', (st) => { thisBlind(st, 'handSizeDelta', 'handSizeDelta', st.d.handSize); st.effect.handSize = st.d.handSize; }],
    ['discardsForGood', (st) => { st.run.discards = Math.max(DEF.minDiscards, st.run.discards + st.d.discardsForGood); st.effect.discardsForGood = st.d.discardsForGood; }],
    ['handSizeForGood', (st) => { st.run.handSize = Math.max(DEF.minHandSize, st.run.handSize + st.d.handSizeForGood); st.effect.handSizeForGood = st.d.handSizeForGood; }],
    ['jokerEdition', jokerEditionOp],
    ['destroyJoker', (st) => {
      const js = st.run.jokers;
      removeJoker(st, st.d.destroyJoker === 'leftmost' ? js[0] : js[js.length - 1]);
    }],
    ['createJoker', createJokerOp],
    ['copyJoker', (st) => {
      const src = st.run.jokers[0];
      const joker = addJoker(st.run, src.id, 0, null, st.out);
      Object.assign(st.effect, { jokerId: src.id, jokerUid: joker ? joker.uid : null });
    }],
    ['hand', (st) => {
      const n = planetLevels(st.run);
      levelUp(st.run, st.d.hand, n);
      Object.assign(st.effect, { handId: st.d.hand, levels: n, level: st.run.levels[st.d.hand] });
    }],
    ['levelsAll', (st) => { for (const id of HAND_IDS) levelUp(st.run, id, st.d.levelsAll); st.effect.levelsAll = st.d.levelsAll; }],
    ['createPlanet', (st) => pushTo(st.effect, 'created', [createMostPlayedPlanet(st.run).uid])],
    ['copyConsumable', (st) => {
      const src = copySource(st.run, st.d, null);
      pushTo(st.effect, 'created', [addConsumable(st.run, src.kind, src.id).uid]);
    }],
  ];
  // Applies a card already checked by checkUse, then fires the Jokers' cardDestroyed and
  // cardAdded events for the playing cards it destroyed or added. -> { effect, lost }
  function applyConsumable(run, kind, d, selectedUids, out) {
    const o = out || newOut();
    const h = holderOf(run);
    const sel = (d.select[1] > 0 && selectionFrom(run, h, selectedUids == null ? [] : selectedUids)) || [];
    const st = { run, d, h, sel, effect: { kind, id: d.id }, destroyed: false, resort: false, goneJokers: [], lostCards: [], added: [], out: o };
    for (const [field, op] of OPS) if (d[field] != null && d[field] !== false) op(st);
    if (st.goneJokers.length) repickCopyTargets(run, true);
    let lost = false;
    if (h && st.destroyed) st.effect.drawn = drawUp(run, h);
    else if (h && st.resort) sortHolder(run, h);
    if (st.lostCards.length) fireJokerEvent(run, 'cardDestroyed', { cards: st.lostCards }, o);
    if (st.added.length) fireJokerEvent(run, 'cardAdded', { cards: st.added }, o);
    if (h === run.blind && inBlind(run) && !h.hand.length) {
      lost = true;
      run.phase = 'gameover';
    }
    return { effect: st.effect, lost };
  }

  // ---------------------------------------------------------------------------
  // Tags (2.10): operation fields applied in this order; a pack opens last.
  // ---------------------------------------------------------------------------
  function tagJoker(run, t, gained, out) {
    const pool = unownedJokers(run, t.joker);
    if (freeJokerSlots(run) > 0 && pool.length) {
      const joker = addJoker(run, pick(run, pool), 0, null, out);
      Object.assign(gained, { jokerId: joker.id, jokerUid: joker.uid });
    } else {
      gainMoney(run, t.fallbackMoney || 0);
      gained.money = t.fallbackMoney || 0;
    }
  }
  function tagJokerEdition(run, t, gained) {
    const plain = run.jokers.filter((j) => !j.edition);
    if (!plain.length) {
      gainMoney(run, t.fallbackMoney || 0);
      gained.money = t.fallbackMoney || 0;
      return;
    }
    const target = pick(run, plain);
    target.edition = editionFrom(run, t.jokerEdition);
    Object.assign(gained, { jokerUid: target.uid, edition: target.edition });
  }
  function tagSeals(run, t, gained) {
    const cards = pickDistinct(run, run.cards.filter((c) => !c.seal), t.seals);
    for (const c of cards) c.seal = pick(run, SEAL_IDS);
    Object.assign(gained, { uids: cards.map((c) => c.uid), seals: cards.map((c) => c.seal) });
  }
  // opts: { noPack } (gainTag: a Tag gained by a Joker event never opens a pack), out.
  function applyTag(run, id, opts) {
    const o = opts || {};
    const t = TAG[id];
    const gained = {};
    const pend = run.pending || (run.pending = freshPending());
    discover(run, 'tags', id);
    if (t.money) {
      gainMoney(run, t.money);
      gained.money = t.money;
    }
    if (t.joker) tagJoker(run, t, gained, o.out);
    if (t.tarots) {
      gained.consumableIds = pickDistinct(run, TAROT_IDS, Math.min(t.tarots, freeConsumableSlots(run)));
      for (const k of gained.consumableIds) addConsumable(run, 'tarot', k);
    }
    if (t.levels) {
      gained.handId = mostPlayedHand(run) || pick(run, HAND_IDS);
      levelUp(run, gained.handId, t.levels);
    }
    if (t.hands) pend.extraHands = (pend.extraHands || 0) + t.hands;
    if (t.targetMult) pend.targetMult = r6((pend.targetMult || 1) * t.targetMult);
    if (t.discount) pend.sale = true;
    if (t.jokerEdition) tagJokerEdition(run, t, gained);
    if (t.seals) tagSeals(run, t, gained);
    if (t.pack && PACK[t.pack] && !o.noPack) {
      openPack(run, t.pack, 'blind-select', 0, o.out);
      gained.pack = t.pack;
    }
    return gained;
  }
  const rollTagId = (run, ante) => pick(run, TAG_IDS.filter((id) => (TAG[id].fromAnte || 1) <= ante));

  // ---------------------------------------------------------------------------
  // Run creation
  // ---------------------------------------------------------------------------
  const freshPending = () => ({ extraHands: 0, extraDiscards: 0, handSizeDelta: 0, targetMult: 1, sale: false });
  function baseRun(seed, deckId, stake) {
    return {
      version: VERSION, seed, rng: hashSeed(seed), nextUid: 1,
      deckId, stake, ante: 1, blindIndex: 0, phase: 'blind-select',
      endless: false, won: false, recorded: false,
      money: DECK[deckId].money != null ? DECK[deckId].money : DEF.money,
      hands: DEF.hands, discards: DEF.discards, handSize: DEF.handSize, jokerSlots: DEF.jokerSlots, consumableSlots: DEF.consumableSlots,
      cards: [], jokers: [], consumables: [], levels: {}, plays: {}, vouchers: [],
      bosses: {}, tags: {}, blindStatus: {}, pending: freshPending(), sortMode: 'rank',
      discovered: { jokers: [], consumables: [], bosses: [], vouchers: [], tags: [] },
      blind: null, shop: null, anteVoucher: null, anteVoucherAnte: 0, pack: null, cashout: null,
      stats: { handsPlayed: 0, cardsPlayed: 0, cardsDiscarded: 0, blindsCleared: 0, blindsSkipped: 0, moneyEarned: 0, consumablesUsed: 0, rerolls: 0, bestHand: null },
    };
  }
  function applyMods(run, mods) {
    if (mods) for (const k of Object.keys(mods)) run[k] += mods[k];
  }
  function rollAnteTags(run, ante) {
    for (let i = 0; i < BLINDS.length; i++) {
      const key = `${ante}-${i}`;
      if (BLINDS[i].skippable && !run.tags[key]) run.tags[key] = rollTagId(run, ante);
    }
  }
  // Antes 1-7 each roll a distinct Boss Blind allowed at that Ante; Ante 8 is the finale.
  // A Boss Blind appears from its fromAnte on, and up to its toAnte when it has one (added
  // 2026-11-23 (Jokers, balance)); Endless Antes roll by the same rule.
  const bossAllowed = (id, a) => BOSS[id].fromAnte <= a && !(BOSS[id].toAnte != null && a > BOSS[id].toAnte);
  function rollBosses(run) {
    const used = [];
    for (let a = 1; a <= 7; a++) {
      let pool = BOSS_POOL.filter((id) => bossAllowed(id, a) && !used.includes(id));
      if (!pool.length) pool = BOSS_POOL.filter((id) => bossAllowed(id, a));
      const id = pick(run, pool);
      used.push(id);
      run.bosses[a] = id;
    }
    run.bosses[8] = FINALE;
  }
  function ensureAnte(run, ante) {
    if (ante <= 8) return;
    if (!run.bosses[ante]) {
      const pool = BOSS_POOL.filter((id) => bossAllowed(id, ante));
      run.bosses[ante] = pick(run, pool.length ? pool : BOSS_POOL);
    }
    rollAnteTags(run, ante);
  }
  function applyDeckStart(run, deck) {
    const se = deck.startEnhancement;
    if (se) for (const c of pickDistinct(run, run.cards, se.count)) c.enhancement = se.id;
    if (deck.startSeals) for (const c of pickDistinct(run, run.cards, deck.startSeals)) c.seal = pick(run, SEAL_IDS);
    for (const id of deck.startConsumables || []) if (kindOfConsumable(id)) addConsumable(run, kindOfConsumable(id), id);
    if (deck.startJoker) {
      const id = pick(run, unownedJokers(run, deck.startJoker.rarity));
      if (id) addJoker(run, id, 0, deck.startJoker.edition || null);
    }
  }
  function newRun(opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const deckId = isRowId(DECK, o.deckId) ? o.deckId : DEFAULT_DECK;
    const stake = isRowId(STAKE, o.stake) ? o.stake : DEFAULT_STAKE;
    const run = baseRun(normalizeSeed(o.seed) || randomSeed(), deckId, stake);
    applyMods(run, DECK[deckId].mods);
    applyMods(run, STAKE[stake].mods);
    run.hands = Math.max(DEF.minHands, run.hands);
    run.discards = Math.max(DEF.minDiscards, run.discards);
    run.handSize = Math.max(DEF.minHandSize, run.handSize);
    run.money = Math.max(0, run.money);
    for (const id of HAND_IDS.slice().reverse()) {
      run.levels[id] = 1;
      run.plays[id] = 0;
    }
    for (const s of SUITS) for (let r = 2; r <= 14; r++) run.cards.push(newCard(run, r, s, null));
    rollBosses(run);
    for (let a = 1; a <= 8; a++) rollAnteTags(run, a);
    applyDeckStart(run, DECK[deckId]);
    discoverAnte(run);
    return run;
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------
  function serialize(run) {
    return JSON.stringify(run);
  }
  // A run saved before the 120-Joker table (2026-11-23) names its Jokers by the 27 v2 ids: they
  // map through oldId (the renamed rows keep their state keys). Other ids stay as they are.
  function migrateJokerIds(run) {
    const to = (id) => (typeof id === 'string' && !JOKER[id] && JOKER_OLD[id] ? JOKER_OLD[id] : id);
    for (const j of run.jokers) {
      if (!isObj(j)) continue;
      j.id = to(j.id);
      if (isObj(j.state) && isObj(j.state.copy)) j.state.copy.id = to(j.state.copy.id);
    }
    if (isObj(run.discovered) && Array.isArray(run.discovered.jokers)) {
      run.discovered.jokers = run.discovered.jokers.map(to).filter((id, i, all) => all.indexOf(id) === i);
    }
    if (isObj(run.shop) && Array.isArray(run.shop.items)) for (const it of run.shop.items) if (isObj(it) && it.kind === 'joker') it.id = to(it.id);
    if (isObj(run.pack) && Array.isArray(run.pack.options)) for (const o of run.pack.options) if (isObj(o) && o.kind === 'joker') o.id = to(o.id);
    return run;
  }
  // The numbers the actions read, checked after a load (added 2026-11-23 robustness pass). JSON
  // writes NaN and Infinity as null, and an edited save may hold anything, so a number that is not
  // a finite number goes back to its starting value (money and counters 0, the reroll price the
  // base $5, levels 1); a Joker's state gets its row's missing keys. A current save comes back
  // unchanged. -> the run, or null for a Blind whose target is not a finite number above 0 (it
  // would be beaten by any hand).
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const numOr = (v, d) => (isNum(v) ? v : d);
  const countOr = (v, d) => (isNum(v) && v >= 0 ? v : d);
  function fixNums(o, keys, d, min) {
    for (const k of keys) if (!isNum(o[k]) || (min != null && o[k] < min)) o[k] = typeof d === 'function' ? d(k) : d;
  }
  // Pile uids that name no card in run.cards (a stale or edited save) are dropped from a holder's
  // hand, draw pile and discard pile; when the live hand lost one, it refills from its draw pile
  // as after a play (added 2026-11-24 (final review): the checks said yes, then The Fumble's extra
  // card or Wickwisp hit the missing card and the action failed inside).
  function dropMissingUids(run, h) {
    if (!isObj(h)) return;
    const have = new Set(run.cards.filter(isObj).map((c) => c.uid));
    const before = Array.isArray(h.hand) ? h.hand.length : 0;
    for (const k of ['hand', 'draw', 'discardPile']) if (Array.isArray(h[k]) && h[k].some((u) => !have.has(u))) h[k] = h[k].filter((u) => have.has(u));
    if (Array.isArray(h.hand) && h.hand.length < before && Array.isArray(h.draw) && h === holderOf(run)) drawUp(run, h);
  }
  function repairRun(run) {
    if (!isNum(run.rng)) return null;
    // An unknown Deck or Stake id falls back to the first row (2.11), as in newRun (added
    // 2026-11-24 (final review); the rules already read it that way).
    if (!isRowId(DECK, run.deckId)) run.deckId = DEFAULT_DECK;
    if (!isRowId(STAKE, run.stake)) run.stake = DEFAULT_STAKE;
    fixNums(run, ['money'], 0, 0);
    fixNums(run, ['hands', 'discards', 'handSize', 'jokerSlots', 'consumableSlots'], (k) => DEF[k]);
    fixNums(run, ['ante'], 1, 1);
    fixNums(run, ['blindIndex'], 0, 0);
    if (run.blindIndex > BLINDS.length - 1) run.blindIndex = BLINDS.length - 1;
    if (!isObj(run.levels)) run.levels = {};
    if (!isObj(run.plays)) run.plays = {};
    fixNums(run.levels, HAND_IDS, 1, 1);
    fixNums(run.plays, HAND_IDS, 0, 0);
    if (!isObj(run.stats)) return null;
    fixNums(run.stats, ['handsPlayed', 'cardsPlayed', 'cardsDiscarded', 'blindsCleared', 'blindsSkipped', 'moneyEarned', 'consumablesUsed', 'rerolls'], 0, 0);
    const bh = run.stats.bestHand;
    if (bh != null && !(isObj(bh) && HAND[bh.handId] && isNum(bh.score))) run.stats.bestHand = null;
    if (!isObj(run.pending)) run.pending = freshPending();
    fixNums(run.pending, ['extraHands', 'extraDiscards', 'handSizeDelta'], 0);
    if (!(isNum(run.pending.targetMult) && run.pending.targetMult > 0)) run.pending.targetMult = 1;
    // uids: the counter stays above every uid in use (cards, Jokers, consumables, pack cards)
    let top = 0;
    const seenUid = (u) => { if (typeof u === 'string' && /^[chk]\d+$/.test(u)) top = Math.max(top, uidNum(u)); };
    for (const list of [run.cards, run.jokers, run.consumables]) for (const x of list) if (isObj(x)) seenUid(x.uid);
    if (isObj(run.pack) && Array.isArray(run.pack.options)) for (const o of run.pack.options) if (isObj(o) && isObj(o.card)) seenUid(o.card.uid);
    if (!(isNum(run.nextUid) && run.nextUid > top)) run.nextUid = top + 1;
    const b = run.blind;
    if (isObj(b)) {
      if (!(isNum(b.target) && b.target > 0)) return null;
      fixNums(b, ['score', 'handsPlayed', 'discardsUsed', 'cardsDiscarded'], 0, 0);
      fixNums(b, ['handsLeft'], DEF.minHands, 0); // never a Blind with no hand to play by accident
      fixNums(b, ['discardsLeft'], 0, 0);
      fixNums(b, ['handSizeDelta'], 0);
      dropMissingUids(run, b);
    }
    if (isObj(run.pack)) dropMissingUids(run, run.pack);
    const s = run.shop;
    if (isObj(s)) {
      fixNums(s, ['rerollCost'], SHOP.rerollCost, 0);
      fixNums(s, ['rerolls', 'freeRerolls', 'packsBought'], 0, 0);
      if (!(isNum(s.discount) && s.discount >= 0 && s.discount < 1)) s.discount = 0;
      if (Array.isArray(s.items)) {
        for (const it of s.items) {
          if (!isObj(it) || (isNum(it.price) && it.price >= 0)) continue;
          if (shopItemKnown(Object.assign({}, it, { price: 0 }))) it.price = priceOf(run, it.kind, it.id, it.edition);
        }
      }
    }
    const co = run.cashout;
    if (isObj(co) && Array.isArray(co.lines)) {
      for (const l of co.lines) if (isObj(l)) fixNums(l, ['amount'], 0, 0);
      const sum = co.lines.reduce((t, l) => t + (isObj(l) ? l.amount : 0), 0);
      if (!isNum(co.total)) co.total = sum;
    }
    for (const j of run.jokers) {
      if (!isObj(j) || !JOKER[j.id]) continue;
      const st = filledState(j.id, j.state, 0);
      if (JSON.stringify(st) !== JSON.stringify(j.state)) j.state = st;
    }
    return run;
  }
  function deserialize(str) {
    if (typeof str !== 'string') return null;
    let run;
    try {
      run = JSON.parse(str);
    } catch (err) {
      return null;
    }
    if (!run || typeof run !== 'object' || Array.isArray(run) || run.version !== VERSION) return null;
    if (!Array.isArray(run.cards) || !Array.isArray(run.jokers) || !Array.isArray(run.consumables)) return null;
    if (typeof run.rng !== 'number' || !PHASES.includes(run.phase) || !run.levels || !run.stats) return null;
    try {
      return repairRun(migrateJokerIds(run));
    } catch (err) {
      if (Engine.debug) throw err;
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Queries (pure)
  // ---------------------------------------------------------------------------
  const brief = (row) => (row ? { id: row.id, name: row.name, text: row.text } : null);
  // A Boss Blind's text, plus The Lid's cap at that Ante when it rises with the Ante (capPerAnte):
  // "… after Ante 3 (now 18)." (added 2026-11-23 (Jokers, balance)).
  function bossBrief(row, ante) {
    const b = brief(row);
    if (b && row.cap != null && Number(row.capPerAnte) > 0) b.text = `${String(row.text).replace(/\.\s*$/, '')} (now ${formatNumber(bossCap(row, ante))}).`;
    return b;
  }
  function blindInfo(run, ante, i) {
    const def = BLINDS[i];
    const key = `${ante}-${i}`;
    const bossId = bossFor(run, ante, i);
    const done = run.blindStatus && run.blindStatus[key];
    const isCurrent = ante === run.ante && i === run.blindIndex;
    let target;
    if (run.blind && isCurrent && run.blind.index === i) target = run.blind.target;
    else if (isCurrent && !done && !run.blind) target = computeTarget(run, ante, i, bossId, run.pending ? run.pending.targetMult : 1);
    else target = computeTarget(run, ante, i, bossId, 1);
    return {
      index: i,
      kind: def.kind,
      name: def.name,
      target,
      reward: rewardFor(run, i),
      boss: bossBrief(bossId && BOSS[bossId], ante),
      tag: def.skippable ? brief(TAG[run.tags && run.tags[key]]) : null,
      status: done || (isCurrent ? 'current' : 'upcoming'),
    };
  }
  const blindsForAnte = (run) => BLINDS.map((def, i) => blindInfo(run, run.ante, i));
  const currentBlindInfo = (run) => blindInfo(run, run.ante, clampInt(run.blindIndex | 0, 0, BLINDS.length - 1));

  function preview(run, uids) {
    if (!run || !Array.isArray(uids) || uids.length < 1 || uids.length > 5) return null;
    if (new Set(uids).size !== uids.length) return null;
    let cards = uids.map((u) => getCard(run, u));
    if (cards.some((c) => !c)) return null;
    const h = holderOf(run);
    if (h) {
      const pos = (c) => (h.hand.indexOf(c.uid) < 0 ? 1e6 : h.hand.indexOf(c.uid));
      cards = cards.slice().sort((a, b) => pos(a) - pos(b));
    }
    // The same hand detection as scoring, the Jokers' rule words included.
    const ev = evalIdx(cards, detectOpts(!!bossFlag(run, 'noEnhancements'), !!bossFlag(run, 'noEditionsSeals'), rulesOf(run)));
    if (!ev) return null;
    return Object.assign(handValues(run, ev.handId), { scoringUids: ev.idx.map((i) => cards[i].uid) });
  }

  function handTable(run) {
    return HAND_IDS.map((id) => Object.assign(handValues(run, id), { plays: (run.plays && run.plays[id]) || 0 }));
  }

  function deckView(run) {
    const cards = run.cards.map((c) => Object.assign({}, c)).sort(cmpSuit);
    const inPlay = run.phase === 'play' && run.blind && Array.isArray(run.blind.draw);
    return { cards, remaining: inPlay ? run.blind.draw.slice() : run.cards.map((c) => c.uid) };
  }

  // Live values for jokerText (3.4), joined with ', ' in parentheses after the text:
  // - live: true: 'now +N Chips', 'now +N Mult', 'now ×N' or 'now +$N' (plus ' per card' for an
  //   on-card effect) from the first effect with a state amount or a per counter;
  // - live: { rank: key }: 'named: <Ranks>';
  // - added 2026-11-23 (Jokers), from the words themselves: freeSmallDiscard ('free discard:
  //   ready|used', during a Blind), evenHand ('next hand: on|off', during a Blind), mostPlayed
  //   and createPlanet 'mostPlayed' ('most-played: <Hand>'), stateIs with a text value
  //   ('now Heads'), handSizeThisBlind ('now +N hand size', during a Blind), and the copy rule
  //   ('copying: <name>' | 'copying: <left> and <right>' | 'now: <name>' | 'nothing yet').
  function nowText(v, e) {
    const n = formatNumber(v.amount);
    const per = e.on === 'card' ? ' per card' : '';
    if (v.kind === 'xmult') return `now ${TIMES}${n}`;
    if (v.kind === 'money') return `now +$${n}${per}`;
    return `now +${n} ${v.kind === 'chips' ? 'Chips' : 'Mult'}${per}`;
  }
  const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function rowLive(run, j, row, state, parts) {
    const blind = run.phase === 'play' ? run.blind : null;
    const view = { uid: j.uid, id: row.id, state, edition: j.edition || null };
    const effects = (Array.isArray(row.effects) ? row.effects : []).filter(isObj);
    const entries = [];
    for (const list of Object.values(isObj(row.events) ? row.events : {})) if (Array.isArray(list)) entries.push(...list.filter(isObj));
    if (isObj(row.live) && row.live.rank) {
      // Only during a Blind: the next Blind names a new rank, so between Blinds the old one would mislead.
      const r = blind ? state[row.live.rank] : null;
      if (own(C.RANK_PLURALS, r)) parts.push(`named: ${own(C.RANK_PLURALS, r)}`);
    } else if (row.live) {
      const e = effects.find(isDynamic);
      const v = e ? rawAmount(e, { run, blind, joker: view, washout: false, censor: false, rules: rulesOf(run), everySuit: false }) : null;
      if (v) parts.push(nowText(v, e));
    }
    if (blind && isObj(row.rules) && row.rules.freeSmallDiscard) parts.push(blind.freeDiscardUsed ? 'free discard: used' : 'free discard: ready');
    if (blind && effects.some((e) => isObj(e.when) && e.when.evenHand)) parts.push((blind.handsPlayed || 0) % 2 === 1 ? 'next hand: on' : 'next hand: off');
    if (effects.some((e) => isObj(e.when) && e.when.mostPlayed) || entries.some((x) => x.createPlanet === 'mostPlayed')) parts.push(`most-played: ${HAND[mostPlayedHand(run) || DEFAULT_GRUDGE].name}`);
    for (const e of effects) {
      if (!isObj(e.when) || !isObj(e.when.stateIs)) continue;
      for (const k of Object.keys(e.when.stateIs)) if (typeof state[k] === 'string' && state[k]) parts.push(`now ${capital(state[k])}`);
    }
    if (blind && entries.some((x) => x.handSizeThisBlind != null)) parts.push(`now +${(isObj(blind.handSizeBy) && Number(blind.handSizeBy[j.uid])) || 0} hand size`);
  }
  // A copier names what it really acts as: the final targets after any copy chain, as jokerCopies
  // and the step names do (changed 2026-11-23 (Jokers): it named the next Joker in the chain, so a
  // Stand-In copying an empty Old Flame said "copying: Old Flame" and copied nothing). Each once.
  const copyNames = (run, x, seen, depth) => resolveFacets(run, x, x.uid, [], seen, depth, false, false).map((f) => f.row.name);
  const copyingText = (names) => `copying: ${names.length ? names.filter((n, i) => names.indexOf(n) === i).join(' and ') : 'nothing'}`;
  function liveFor(run, j, row, state, parts, depth) {
    const how = copyHow(row);
    if (!how) return rowLive(run, j, row, state, parts);
    if (how === 'random') {
      const t = typeof state.target === 'string' ? findJoker(run, state.target) : null;
      parts.push(copyingText(t ? copyNames(run, t, j.uid ? [j.uid] : [], depth + 1) : []));
    } else if (how === 'neighbours') {
      const at = run.jokers.indexOf(j);
      const sides = (at < 0 ? [] : [run.jokers[at - 1], run.jokers[at + 1]]).filter((x) => x && JOKER[x.id]);
      parts.push(copyingText([].concat(...sides.map((x) => copyNames(run, x, [j.uid], depth + 1)))));
    } else {
      const cp = state.copy;
      if (!isObj(cp) || !JOKER[cp.id] || depth >= MAX_COPY_DEPTH) return parts.push('nothing yet');
      parts.push(`now: ${JOKER[cp.id].name}`);
      liveFor(run, j, JOKER[cp.id], isObj(cp.state) ? cp.state : {}, parts, depth + 1);
    }
    return undefined;
  }
  function jokerText(run, uid) {
    const j = findJoker(run, uid);
    if (!j || !JOKER[j.id]) return '';
    const parts = [];
    liveFor(run, j, JOKER[j.id], isObj(j.state) ? j.state : {}, parts, 0);
    const live = parts.filter((p, i) => parts.indexOf(p) === i);
    return live.length ? `${JOKER[j.id].text} (${live.join(', ')})` : JOKER[j.id].text;
  }

  // added 2026-11-23 (Jokers): the Jokers a copier acts as right now, [{ id, uid }] (uid null for
  // Old Flame's remembered Joker); [] for a Joker that copies nothing (or is not a copier).
  function jokerCopies(run, uid) {
    const j = findJoker(run, uid);
    if (!j || !copyHow(JOKER[j.id])) return [];
    return facetsOf(run, j).map((f) => ({ id: f.row.id, uid: f.copyUid }));
  }
  function consumableInfo(run, uid) {
    const k = findConsumable(run, uid);
    const d = consumableDef(k);
    if (!k || !d) return null;
    return { uid: k.uid, kind: k.kind, id: k.id, name: d.name, text: d.text, where: d.where, select: selectOf(run, d), sell: consumableSell(k) };
  }
  function canUseConsumable(run, uid, selectedUids) {
    const k = findConsumable(run, uid);
    if (!k || !consumableDef(k)) return fail(E.noConsumable);
    return checkUse(run, consumableDef(k), selectedUids, { fromSlot: true, selfUid: k.uid });
  }

  // added 2026-11-23 (Jokers, reconcile): a Shop item must name a content row and carry a price;
  // a stale or forged item (a Joker id the table no longer has) is "nothing for sale" instead of
  // taking the money and adding nothing.
  function shopItemKnown(it) {
    if (!(Number.isFinite(it.price) && it.price >= 0) || typeof it.id !== 'string') return false;
    if (it.kind === 'joker') return !!JOKER[it.id];
    if (isConsumableKind(it.kind)) return !!defOf(it.kind, it.id);
    if (it.kind === 'voucher') return !!VOUCHER[it.id];
    if (it.kind === 'pack') return !!PACK[it.id] && !!PACK_OPTIONS[PACK[it.id].kind];
    return false;
  }
  function canBuy(run, itemIndex) {
    if (run.phase !== 'shop' || !run.shop || !Array.isArray(run.shop.items)) return fail(E.shopClosed);
    const item = Number.isInteger(itemIndex) ? run.shop.items[itemIndex] : null;
    if (!item || typeof item !== 'object') return fail(E.noItem);
    if (item.sold) return fail(E.sold);
    if (!shopItemKnown(item)) return fail(E.noItem);
    if (run.money < item.price) return fail(E.money);
    if (item.kind === 'joker') {
      if (editionTakesSlot(item.edition) && freeJokerSlots(run) <= 0) return fail(E.jokersFull);
      if (ownsJoker(run, item.id)) return fail(E.ownJoker);
    }
    if (isConsumableKind(item.kind) && freeConsumableSlots(run) <= 0) return fail(E.consFull);
    if (item.kind === 'voucher' && hasVoucher(run, item.id)) return fail(E.ownVoucher);
    return { ok: true };
  }

  function stats(run) {
    const s = run.stats || {};
    const bh = s.bestHand && HAND[s.bestHand.handId] ? s.bestHand : null;
    const mp = mostPlayedHand(run);
    return {
      ante: run.ante,
      bestHand: bh ? { handId: bh.handId, name: HAND[bh.handId].name, score: bh.score } : null,
      mostPlayed: mp ? { handId: mp, name: HAND[mp].name, plays: run.plays[mp] } : null,
      handsPlayed: s.handsPlayed || 0,
      cardsDiscarded: s.cardsDiscarded || 0,
      blindsCleared: s.blindsCleared || 0,
      blindsSkipped: s.blindsSkipped || 0,
      moneyEarned: s.moneyEarned || 0,
      seed: run.seed,
    };
  }

  function canPlay(run, uids) {
    if (run.phase !== 'play' || !run.blind) return fail(E.playNotNow);
    if (run.blind.handsLeft <= 0) return fail(E.noHands);
    if (uids === undefined) return { ok: true };
    if (!Array.isArray(uids) || uids.length < 1 || uids.length > 5) return fail(E.selectPlay);
    const boss = bossOf(run);
    if (boss && boss.maxPlay && uids.length > boss.maxPlay) return fail(maxPlayError(boss));
    if (!selectionFrom(run, run.blind, uids)) return fail(E.fromHand);
    return { ok: true };
  }
  function canDiscard(run, uids) {
    if (run.phase !== 'play' || !run.blind) return fail(E.discardNotNow);
    const boss = bossOf(run);
    if (run.blind.discardsLeft <= 0) return fail(E.noDiscards);
    if (boss && boss.discardCost && run.money < boss.discardCost) return fail(discardCostError(boss));
    if (uids === undefined) return { ok: true };
    if (!Array.isArray(uids) || uids.length < 1 || uids.length > 5) return fail(E.selectDiscard);
    if (!selectionFrom(run, run.blind, uids)) return fail(E.fromHand);
    return { ok: true };
  }
  // added 2026-11-23 (Jokers, reconcile): a pack option must name a content row (or hold a valid new
  // card) before it can be picked, so a stale or forged option is refused instead of half-applied.
  function packOptionKnown(run, opt) {
    if (opt.kind === 'joker') return isRowId(JOKER, opt.id);
    if (isConsumableKind(opt.kind)) return typeof opt.id === 'string' && !!defOf(opt.kind, opt.id);
    if (opt.kind === 'card') return validCard(opt.card) && typeof opt.card.uid === 'string' && !getCard(run, opt.card.uid);
    return false;
  }
  function canPackPick(run, optionIndex, selectedUids) {
    if (run.phase !== 'pack' || !run.pack || !Array.isArray(run.pack.options)) return fail(E.noPack);
    const opt = Number.isInteger(optionIndex) ? run.pack.options[optionIndex] : null;
    if (!opt || typeof opt !== 'object') return fail(E.noOption);
    if (opt.picked) return fail(E.picked); // a picked card is in the deck now, so this comes first
    if (!packOptionKnown(run, opt)) return fail(E.noOption);
    if (opt.kind === 'joker') {
      if (editionTakesSlot(opt.edition) && freeJokerSlots(run) <= 0) return fail(E.jokersFull);
      if (ownsJoker(run, opt.id)) return fail(E.ownJoker);
    }
    if (isConsumableKind(opt.kind)) return checkUse(run, defOf(opt.kind, opt.id), selectedUids, { fromSlot: false, selfUid: null });
    return { ok: true };
  }
  const canSell = (run) => (SELL_PHASES.includes(run.phase) ? { ok: true } : fail(E.sellNotNow));
  // 0 while a free reroll is left; otherwise the paid price (rerollDiscount included), also
  // outside the Shop (the base price).
  function rerollCostOf(run) {
    if (run.shop && run.shop.freeRerolls > 0) return 0;
    return paidRerollCost(run);
  }
  function cardName(card) {
    const rank = card ? own(C.RANK_WORDS, card.rank) : null;
    const suit = card ? own(C.SUIT_NAMES, card.suit) : null;
    return rank && suit ? `${rank} of ${suit}` : '';
  }
  // Tooltip lines for a card (a uid, or a card object such as a pack option's): its name,
  // then its Enhancement, Edition and Seal lines.
  function cardText(run, uidOrCard) {
    const card = typeof uidOrCard === 'string' ? getCard(run, uidOrCard) : uidOrCard;
    if (!validCard(card)) return [];
    const lines = [cardName(card)];
    const e = card.enhancement && ENH[card.enhancement];
    // Vintage: what it has stored, and what its next scoring pass gives (it stores +4 first; changed
    // 2026-11-23 (Jokers): it said "now +8" for a card whose next pass gives +12).
    const g = Math.max(0, Number(card.grow) || 0);
    if (e) lines.push(`${e.name}: ${e.text}${e.grow && g > 0 ? ` (stored +${formatNumber(g)}, next +${formatNumber(g + e.grow)})` : ''}`);
    const ed = editionOf(card.edition);
    if (ed) lines.push(`${ed.name}: ${ed.cardText}`);
    const s = card.seal && SEAL[card.seal];
    if (s) lines.push(`${s.name}: ${s.text}`);
    return lines;
  }
  function editionInfo(id) {
    const ed = editionOf(id);
    return ed ? { id: ed.id, name: ed.name, text: ed.text, jokerText: ed.jokerText, cardText: ed.cardText, surcharge: ed.surcharge || 0 } : null;
  }
  const sealInfo = (id) => brief(SEAL[id]);
  const consumableSellValue = (run, uid) => consumableSell(findConsumable(run, uid));

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function newBlind(run, i, bossId) {
    const def = BLINDS[i];
    const boss = bossId ? BOSS[bossId] : null;
    const pend = run.pending;
    const bossHands = def.kind === 'boss' ? vSum(run, 'bossHands') : 0;
    return {
      kind: def.kind, index: i, boss: bossId,
      target: computeTarget(run, run.ante, i, bossId, pend.targetMult),
      score: 0,
      handsLeft: Math.max(DEF.minHands, run.hands + (pend.extraHands || 0) + bossHands + ((boss && boss.handsDelta) || 0)),
      discardsLeft: Math.max(DEF.minDiscards, run.discards + (pend.extraDiscards || 0)),
      handSizeDelta: pend.handSizeDelta || 0,
      draw: [], hand: [], discardPile: [],
      handsPlayed: 0, discardsUsed: 0, cardsDiscarded: 0,
      hideRanks: !!(boss && boss.hideRanks),
      wetJoker: boss && boss.wetLeftmost && run.jokers.length ? run.jokers[0].uid : null,
      grudgeHand: boss && boss.mostPlayedX ? mostPlayedHand(run) || DEFAULT_GRUDGE : null,
      heldAtClear: [],
      log: [],
      freeDiscardUsed: false, // added 2026-11-23 (Jokers): freeSmallDiscard used this Blind
      handSizeBy: {}, // added 2026-11-23 (Jokers): hand size each Joker's handSizeThisBlind added, by uid
    };
  }
  function startBlind(run) {
    if (run.phase !== 'blind-select' || !BLINDS[run.blindIndex]) return fail(E.startNotNow);
    if (!run.pending) run.pending = freshPending();
    const bossId = bossFor(run, run.ante, run.blindIndex);
    const b = newBlind(run, run.blindIndex, bossId);
    run.pending = Object.assign(freshPending(), { sale: !!run.pending.sale }); // used up by this Blind
    run.blind = b;
    run.cashout = null;
    b.draw = shuffle(run, run.cards.map((c) => c.uid));
    let drawn = drawUp(run, b);
    run.phase = 'play';
    discover(run, 'bosses', bossId);
    // After the first hand is dealt: every Stand-In picks a new target, then the blindStart events.
    const out = newOut();
    repickCopyTargets(run, false);
    fireJokerEvent(run, 'blindStart', {}, out);
    drawn = drawn.concat(out.drawn);
    const lost = !b.hand.length;
    if (lost) run.phase = 'gameover';
    return { ok: true, drawn, lost, jokerEvents: out.events };
  }

  function skipBlind(run) {
    if (run.phase !== 'blind-select') return fail(E.skipNotNow);
    const i = run.blindIndex;
    if (!BLINDS[i] || !BLINDS[i].skippable) return fail(E.skipBoss);
    const key = `${run.ante}-${i}`;
    if (!TAG[run.tags[key]]) run.tags[key] = rollTagId(run, run.ante);
    const t = TAG[run.tags[key]];
    run.blindStatus[key] = 'skipped';
    run.stats.blindsSkipped += 1;
    run.blindIndex = i + 1; // skippable Blinds are never the Boss Blind, so the Ante stays
    run.phase = 'blind-select';
    const out = newOut();
    const gained = applyTag(run, t.id, { out });
    return { ok: true, tag: brief(t), gained, jokerEvents: out.events };
  }

  function sealLines(run, b) {
    if (bossFlag(run, 'noEditionsSeals')) return [];
    const lines = [];
    for (const s of C.SEALS) {
      if (!s.clearMoney) continue;
      const n = b.heldAtClear.filter((u) => (getCard(run, u) || {}).seal === s.id).length;
      lines.push({ label: `${s.name}s`, amount: n * s.clearMoney });
    }
    return lines;
  }
  // Joker lines, labelled with the Joker's name ('Stand-In (as Early Bird)' for a copy).
  function jokerCashoutLines(run) {
    const lines = [];
    const rules = rulesOf(run);
    for (const joker of activeJokers(run)) {
      for (const f of facetsOf(run, joker)) {
        for (const e of f.row.effects || []) {
          if (!isObj(e) || e.on !== 'cashout') continue;
          const c = { run, blind: run.blind, joker: { uid: joker.uid, id: f.row.id, state: f.state, edition: joker.edition || null }, washout: false, censor: false, rules, everySuit: !!rules.everySuit };
          const v = matches(e.when, c) ? rawAmount(e, c) : null;
          if (v && v.kind === 'money') lines.push({ label: nameFor(joker, f), amount: v.amount });
        }
      }
    }
    return lines;
  }
  function buildCashout(run) {
    const b = run.blind;
    const lines = [
      { label: BLINDS[b.index].name, amount: rewardFor(run, b.index) },
      { label: 'Hands to spare', amount: Math.max(0, b.handsLeft) * ECON.handBonus },
      ...sealLines(run, b),
      { label: 'Interest', amount: interestNow(run) },
      ...jokerCashoutLines(run),
    ];
    const kept = lines.filter((l) => l.amount > 0);
    return { lines: kept, total: kept.reduce((s, l) => s + l.amount, 0) };
  }

  function bookHand(run, b, result, played) {
    b.handsLeft -= 1;
    b.handsPlayed += 1;
    run.stats.handsPlayed += 1;
    run.stats.cardsPlayed += played.length;
    run.plays[result.handId] = (run.plays[result.handId] || 0) + 1;
    if (!run.stats.bestHand || result.total > run.stats.bestHand.score) run.stats.bestHand = { handId: result.handId, score: result.total };
    b.log.push({ handId: result.handId, name: result.name, level: result.level, chips: result.chips, mult: result.mult, total: result.total, scoreAfter: b.score });
  }
  function clearBlind(run, b, out, ev) {
    out.cleared = true;
    run.blindStatus[`${run.ante}-${b.index}`] = 'cleared';
    run.stats.blindsCleared += 1;
    b.heldAtClear = b.hand.slice(); // the cards in hand when the Blind was beaten (Paid Seals)
    fireJokerEvent(run, 'blindCleared', {}, ev);
    run.cashout = buildCashout(run);
    if (!run.endless && run.ante >= 8 && b.kind === 'boss') {
      out.won = true;
      run.won = true;
      run.phase = 'win';
    } else {
      run.phase = 'cashout';
    }
  }
  function applyFade(run, b) {
    const keep = bossFlag(run, 'keep');
    if (!keep || !(b.handsPlayed > 0)) return null;
    const before = b.score;
    b.score = Math.floor(before * keep);
    return { before, after: b.score };
  }
  function playHand(run, uids) {
    const check = canPlay(run, uids === undefined ? null : uids);
    if (!check.ok) return check;
    const b = run.blind;
    const sel = selectionFrom(run, b, uids);
    const played = sel.map((u) => getCard(run, u));
    const heldUids = b.hand.filter((u) => !sel.includes(u));
    const result = scoreCards(run, played, heldUids.map((u) => getCard(run, u))); // 2. score (pure)
    if (!result) return fail(E.bad); // nothing has changed yet
    // 1. The Fade, applied once the hand is known to score (2026-11-23: a hand that failed used to
    // fade the score anyway); scoring never reads the Blind's score, so the order is the same.
    const fade = applyFade(run, b);
    const money = result.steps.reduce((s, st) => s + (st.kind === 'money' ? st.amount : 0), 0);
    gainMoney(run, money);
    b.score = capNum(b.score + result.total);
    for (const g of result.grow) { // 3. Vintage growth, bookkeeping, discard pile, after-hand Jokers
      const card = getCard(run, g.uid);
      if (card) card.grow = (Number(card.grow) || 0) + g.by;
    }
    applyJokerGains(run, result.jokerGains); // gains counted during scoring (cardScored, handScored)
    bookHand(run, b, result, played);
    b.hand = heldUids;
    for (const u of sel) b.discardPile.push(u);
    const scored = result.scoringUids.filter((u) => u !== result.booedUid);
    const ev = newOut();
    fireJokerEvent(run, 'afterHand', { scored }, ev);
    const out = { ok: true, result, fade, cleared: false, lost: false, won: false, drawn: [], money, eaten: [], enhanced: ev.enhanced, score: b.score, jokerEvents: [] };
    if (b.score >= b.target) clearBlind(run, b, out, ev); // 4. cleared / lost / draw
    else if (b.handsLeft <= 0) out.lost = true;
    else {
      out.drawn = ev.drawn.concat(bossFlag(run, 'sweep') ? sweepAndRedraw(run) : drawUp(run, b));
      if (!b.hand.length) out.lost = true;
    }
    if (out.lost) run.phase = 'gameover';
    out.score = b.score;
    out.eaten = ev.eaten.slice(); // Jokers eaten after the hand or when the Blind was beaten
    out.jokerEvents = ev.events;
    return out;
  }

  // Crumpled money and Comet Seal Planets, card by card in hand order. Golden Hour
  // (blindMoneyX) multiplies the Crumpled money.
  function discardEffects(run, uids, rules) {
    const washout = !!bossFlag(run, 'noEnhancements');
    const censor = !!bossFlag(run, 'noEditionsSeals');
    const moneyX = numRule(rules, 'blindMoneyX') || 1;
    let money = 0;
    const created = [];
    for (const u of uids) {
      const card = getCard(run, u);
      if (!card) continue;
      const e = !washout && card.enhancement && ENH[card.enhancement];
      if (e && e.discardMoney) money = r6(money + e.discardMoney * moneyX);
      const s = !censor && card.seal && SEAL[card.seal];
      if (s && s.discardCreates === 'planet' && freeConsumableSlots(run) > 0) created.push(createMostPlayedPlanet(run).uid);
    }
    gainMoney(run, money);
    return { money, created };
  }
  function discard(run, uids) {
    const check = canDiscard(run, uids === undefined ? null : uids);
    if (!check.ok) return check;
    const b = run.blind;
    const sel = selectionFrom(run, b, uids);
    const boss = bossOf(run);
    const cost = boss && boss.discardCost ? boss.discardCost : 0;
    const rules = rulesOf(run);
    // freeFirstDiscard: the first discard of a Blind; freeSmallDiscard n (Sleight of Hand): once
    // per Blind, a discard of at most n selected cards (The Fumble's extra card not counted).
    const firstFree = b.discardsUsed === 0 && !!rules.freeFirstDiscard;
    const smallFree = !firstFree && numRule(rules, 'freeSmallDiscard') > 0 && !b.freeDiscardUsed && sel.length <= numRule(rules, 'freeSmallDiscard');
    const free = firstFree || smallFree;
    if (smallFree) b.freeDiscardUsed = true;
    run.money -= cost;
    const extras = boss && boss.extraDiscard ? pickDistinct(run, realUids(run, b.hand).filter((u) => !sel.includes(u)), boss.extraDiscard) : [];
    const all = b.hand.filter((u) => sel.includes(u) || extras.includes(u)); // hand order
    if (!free) b.discardsLeft -= 1;
    b.discardsUsed += 1;
    b.cardsDiscarded += all.length;
    run.stats.cardsDiscarded += all.length;
    b.hand = b.hand.filter((u) => !all.includes(u));
    for (const u of all) b.discardPile.push(u);
    const fx = discardEffects(run, all, rules);
    const ev = newOut();
    fireJokerEvent(run, 'discard', { cards: all.map((u) => getCard(run, u)), selected: sel.map((u) => getCard(run, u)) }, ev);
    const drawn = ev.drawn.concat(drawUp(run, b));
    const lost = !b.hand.length;
    if (lost) run.phase = 'gameover';
    return { ok: true, drawn, cost, free, extra: extras[0] || null, money: fx.money, created: fx.created, lost, jokerEvents: ev.events };
  }

  function useConsumable(run, uid, selectedUids) {
    const check = canUseConsumable(run, uid, selectedUids);
    if (!check.ok) return check;
    const k = findConsumable(run, uid);
    const vBefore = ruleOf(run, 'voucherPriceMult');
    run.consumables = run.consumables.filter((c) => c.uid !== uid);
    run.stats.consumablesUsed += 1;
    const ev = newOut();
    const res = applyConsumable(run, k.kind, consumableDef(k), selectedUids, ev);
    fireJokerEvent(run, 'consumableUsed', { consumable: { kind: k.kind, id: k.id } }, ev);
    repriceVouchers(run, vBefore);
    return { ok: true, effect: res.effect, lost: res.lost, jokerEvents: ev.events };
  }

  // Selling: the Joker's own 'sold' events (Last Laugh), then it leaves; the others' jokerSold
  // events (Pawnbroker) fire, then every Old Flame takes on the sold Joker (its id and a copy of
  // its state, not its Edition) and a Stand-In whose target it was picks a new one.
  function sellJoker(run, uid) {
    if (!SELL_PHASES.includes(run.phase)) return fail(E.sellNotNow);
    const j = findJoker(run, uid);
    if (!j) return fail(E.noJoker);
    const value = jokerSellValue(run, uid);
    const vBefore = ruleOf(run, 'voucherPriceMult');
    const ev = newOut();
    if (activeJokers(run).includes(j)) fireOne(run, j, 'sold', null, ev);
    run.jokers = run.jokers.filter((x) => x.uid !== uid);
    run.money += value;
    fireJokerEvent(run, 'jokerSold', { sold: { uid: j.uid, id: j.id } }, ev);
    for (const o of activeJokers(run)) {
      if (copyHow(JOKER[o.id]) !== 'lastSold') continue;
      if (!isObj(o.state)) o.state = {};
      o.state.copy = { id: j.id, state: filledState(j.id, j.state, 0) };
      ev.events.push({ uid: o.uid, id: o.id, copyOf: j.id, event: 'jokerSold', op: 'copy', from: j.uid });
    }
    repickCopyTargets(run, true);
    repriceVouchers(run, vBefore);
    return { ok: true, money: value, jokerEvents: ev.events };
  }
  function sellConsumable(run, uid) {
    if (!SELL_PHASES.includes(run.phase)) return fail(E.sellNotNow);
    const k = findConsumable(run, uid);
    if (!k) return fail(E.noConsumable);
    const value = consumableSell(k);
    run.consumables = run.consumables.filter((c) => c.uid !== uid);
    run.money += value;
    return { ok: true, money: value };
  }

  function setSort(run, mode) {
    if (mode !== 'rank' && mode !== 'suit') return fail(E.sortMode);
    run.sortMode = mode;
    sortHolder(run, holderOf(run));
    return { ok: true };
  }
  const sameSet = (uids, have) => Array.isArray(uids) && uids.length === have.length && new Set(uids).size === uids.length && uids.every((u) => have.includes(u));
  function reorderHand(run, uids) {
    const h = holderOf(run);
    if (!h || !sameSet(uids, h.hand)) return fail(E.handOrder);
    h.hand = uids.slice();
    run.sortMode = 'manual';
    return { ok: true };
  }
  function reorderJokers(run, uids) {
    if (!sameSet(uids, run.jokers.map((j) => j.uid))) return fail(E.jokerOrder);
    const vBefore = ruleOf(run, 'voucherPriceMult');
    run.jokers = uids.map((u) => run.jokers.find((j) => j.uid === u));
    repriceVouchers(run, vBefore); // The Puppet Master's neighbours may change
    return { ok: true };
  }

  function collect(run) {
    if (run.phase !== 'cashout' || !run.cashout) return fail(E.noCashout);
    const total = run.cashout.total;
    gainMoney(run, total);
    run.cashout = null;
    run.blind = null;
    buildShop(run);
    run.phase = 'shop';
    return { ok: true, total };
  }

  function buy(run, itemIndex) {
    const check = canBuy(run, itemIndex);
    if (!check.ok) return check;
    const item = run.shop.items[itemIndex];
    const vBefore = ruleOf(run, 'voucherPriceMult');
    const ev = newOut();
    run.money -= item.price;
    item.sold = true;
    let opened = false;
    let bought = null;
    if (item.kind === 'joker') bought = addJoker(run, item.id, item.price, item.edition, ev);
    else if (isConsumableKind(item.kind)) addConsumable(run, item.kind, item.id);
    else if (item.kind === 'voucher') {
      applyVoucher(run, item.id);
      run.anteVoucher = null;
    } else if (item.kind === 'pack') {
      // firstPackExtraPick (Lucky Dip): the first pack bought in this Shop visit.
      const first = !(run.shop.packsBought > 0);
      run.shop.packsBought = (Number(run.shop.packsBought) || 0) + 1;
      openPack(run, item.id, 'shop', first ? Math.floor(numRule(rulesOf(run), 'firstPackExtraPick')) : 0, ev);
      opened = true;
    }
    // purchase: every Joker but the one just bought; a free item is not a purchase.
    if (item.price > 0) fireJokerEvent(run, 'purchase', { item: { kind: item.kind, id: item.id, price: item.price } }, ev, bought ? [bought.uid] : null);
    repriceVouchers(run, vBefore);
    return { ok: true, item: Object.assign({}, item), opened, jokerEvents: ev.events };
  }

  function reroll(run) {
    if (run.phase !== 'shop' || !run.shop) return fail(E.shopClosed);
    const s = run.shop;
    const free = s.freeRerolls > 0;
    const cost = free ? 0 : paidRerollCost(run);
    if (run.money < cost) return fail(E.money);
    run.money -= cost;
    rerollCards(run);
    s.rerolls += 1;
    run.stats.rerolls += 1;
    if (free) s.freeRerolls -= 1; // a free reroll does not raise the price
    else if (!vAny(run, 'flatRerolls')) s.rerollCost = rerollBase(run) + SHOP.rerollStep; // Second Look keeps it flat
    return { ok: true, cost, free };
  }

  const PICK = Object.assign(dict(), {
    card(run, opt, sel, out, ev) {
      const card = Object.assign({}, opt.card);
      run.cards.push(card);
      out.uid = opt.card.uid;
      fireJokerEvent(run, 'cardAdded', { cards: [card] }, ev);
    },
    joker(run, opt, sel, out, ev) {
      const joker = addJoker(run, opt.id, 0, opt.edition || null, ev);
      Object.assign(out, { id: opt.id, uid: joker ? joker.uid : null });
    },
    consumable(run, opt, sel, out, ev) {
      run.stats.consumablesUsed += 1;
      const res = applyConsumable(run, opt.kind, defOf(opt.kind, opt.id), sel, ev);
      fireJokerEvent(run, 'consumableUsed', { consumable: { kind: opt.kind, id: opt.id } }, ev);
      Object.assign(out, { id: opt.id, effect: res.effect });
    },
  });
  // Takes one card from the open pack. Tarot, Planet and Spectral cards are used at once
  // (Tarot and Spectral cards on the pack's dealt hand: pass the selected uids).
  function packPick(run, optionIndex, selectedUids) {
    const check = canPackPick(run, optionIndex, selectedUids);
    if (!check.ok) return check;
    const p = run.pack;
    const opt = p.options[optionIndex];
    const vBefore = ruleOf(run, 'voucherPriceMult');
    const out = { ok: true, kind: opt.kind, picksLeft: 0, closed: false };
    const ev = newOut();
    PICK[isConsumableKind(opt.kind) ? 'consumable' : opt.kind](run, opt, selectedUids, out, ev);
    opt.picked = true;
    p.picksLeft -= 1;
    out.picksLeft = p.picksLeft;
    if (p.picksLeft <= 0 || !p.options.some((o) => !o.picked)) {
      closePack(run);
      out.closed = true;
    }
    repriceVouchers(run, vBefore);
    out.jokerEvents = ev.events;
    return out;
  }
  function packSkip(run) {
    if (run.phase !== 'pack' || !run.pack) return fail(E.noPack);
    closePack(run);
    return { ok: true };
  }

  function leaveShop(run) {
    if (run.phase !== 'shop') return fail(E.notInShop);
    run.shop = null;
    run.blindIndex += 1;
    if (run.blindIndex > BLINDS.length - 1) {
      run.blindIndex = 0;
      run.ante += 1;
      ensureAnte(run, run.ante);
    }
    run.phase = 'blind-select';
    discoverAnte(run);
    return { ok: true };
  }

  function goEndless(run) {
    if (run.phase !== 'win') return fail(E.notWon);
    run.endless = true;
    run.phase = 'cashout';
    if (!run.cashout) run.cashout = { lines: [], total: 0 };
    return { ok: true };
  }

  let testUid = 0;
  // A loose card for tests and previews (uid 'x' + n). opts: { enhancement, edition, seal,
  // grow }, or an Enhancement id string.
  function makeCard(rank, suit, opts) {
    const o = typeof opts === 'string' ? { enhancement: opts } : opts && typeof opts === 'object' ? opts : {};
    testUid += 1;
    return { uid: 'x' + testUid, rank, suit, enhancement: o.enhancement || null, edition: o.edition || null, seal: o.seal || null, grow: Math.max(0, Number(o.grow) || 0) };
  }

  // ---------------------------------------------------------------------------
  // Records (4.2). Version 2; version 1 records migrate through the oldId columns.
  // ---------------------------------------------------------------------------
  const DISCOVERY_KEYS = ['jokers', 'consumables', 'bosses', 'vouchers', 'tags'];
  const startIds = (rows) => rows.filter((r) => r.unlockedBy && r.unlockedBy.type === 'start').map((r) => r.id);
  function defaultRecords() {
    return {
      version: RECORDS_VERSION,
      runs: 0,
      wins: 0,
      bestAnte: 0,
      bestHand: null,
      unlockedDecks: startIds(C.DECKS),
      unlockedStakes: startIds(C.STAKES),
      wonOn: [],
      history: [],
      discovered: { jokers: [], consumables: [], bosses: [], vouchers: [], tags: [] },
    };
  }
  function oldIdMap(rows) {
    const m = dict();
    for (const r of rows) if (r.oldId) m[r.oldId] = r.id;
    return m;
  }
  const sameIds = (...tables) => Object.fromEntries([].concat(...tables).map((r) => [r.id, r.id]));
  // The ids a discovered list may hold, by key: today's ids (which always mean themselves) plus the
  // old ids of the rows that rename them (oldId). Added 2026-11-23 (Jokers): version 2 records
  // map through it too, so a Joker id saved before the 120-Joker table (one of the 27 v2 ids)
  // becomes its new id, and an id no table knows is dropped.
  const KNOWN = {
    jokers: Object.assign(oldIdMap(C.JOKERS), sameIds(C.JOKERS)),
    consumables: Object.assign(oldIdMap(C.TAROTS), oldIdMap(C.PLANETS), oldIdMap(C.SPECTRALS), sameIds(C.TAROTS, C.PLANETS, C.SPECTRALS)),
    bosses: Object.assign(oldIdMap(C.BOSSES), sameIds(C.BOSSES)),
    vouchers: Object.assign(oldIdMap(C.VOUCHERS), sameIds(C.VOUCHERS)),
    tags: Object.assign(oldIdMap(C.TAGS), sameIds(C.TAGS)),
  };
  const MIGRATE = {
    decks: oldIdMap(C.DECKS),
    stakes: oldIdMap(C.STAKES),
    consumables: Object.assign(oldIdMap(C.TAROTS), oldIdMap(C.PLANETS), oldIdMap(C.SPECTRALS)),
    bosses: oldIdMap(C.BOSSES),
    jokers: KNOWN.jokers, // v1 charm ids through oldId (today's ids kept)
  };
  function mapIds(list, map) {
    const out = [];
    for (const id of Array.isArray(list) ? list : []) if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(map, id) && !out.includes(map[id])) out.push(map[id]);
    return out;
  }
  function migrateV1(r) {
    const d = r.discovered && typeof r.discovered === 'object' ? r.discovered : {};
    return {
      version: RECORDS_VERSION,
      runs: r.voyages,
      wins: r.wins,
      bestAnte: r.bestAnte,
      bestHand: r.bestHand && HAND[r.bestHand.handId] ? r.bestHand : null,
      unlockedDecks: mapIds(r.unlockedDecks, MIGRATE.decks),
      unlockedStakes: mapIds(r.unlockedSeaStates, MIGRATE.stakes),
      wonOn: mapIds(r.wonOn, MIGRATE.stakes),
      history: (Array.isArray(r.history) ? r.history : []).filter(isObj).map((h) => ({
        at: h.at != null ? String(h.at) : '',
        deckId: MIGRATE.decks[h.deckId] || null,
        stake: MIGRATE.stakes[h.seaState] || null,
        ante: Number(h.ante) || 0,
        won: !!h.won,
        bestScore: Number(h.bestScore) || 0,
      })),
      discovered: {
        jokers: mapIds(d.charms, MIGRATE.jokers),
        consumables: mapIds(d.consumables, MIGRATE.consumables),
        bosses: mapIds(d.bosses, MIGRATE.bosses),
        vouchers: [],
        tags: [],
      },
    };
  }
  function normalizeRecords(records) {
    const base = defaultRecords();
    if (!records || typeof records !== 'object' || Array.isArray(records)) return base;
    let copy;
    try {
      copy = JSON.parse(JSON.stringify(records));
    } catch (err) {
      return base;
    }
    if (copy.version === 1) copy = migrateV1(copy);
    else if (copy.version != null && copy.version !== RECORDS_VERSION) return base;
    const out = Object.assign(base, copy, { version: RECORDS_VERSION });
    const count = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
    out.runs = count(out.runs);
    out.wins = count(out.wins);
    out.bestAnte = count(out.bestAnte);
    for (const key of ['unlockedDecks', 'unlockedStakes', 'wonOn', 'history']) if (!Array.isArray(out[key])) out[key] = defaultRecords()[key];
    // Every version is cleaned the same way (2026-11-23 robustness pass: version 2 records kept junk):
    // only known Deck and Stake ids, once each; history entries rebuilt field by field (anything that
    // is not an object dropped, the last 12 kept); a best hand needs a poker hand and a finite score.
    const known = (list, table) => list.filter((id, i) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(table, id) && list.indexOf(id) === i);
    out.unlockedDecks = known(out.unlockedDecks, DECK);
    out.unlockedStakes = known(out.unlockedStakes, STAKE);
    out.wonOn = known(out.wonOn, STAKE);
    out.history = out.history.filter(isObj).map((h) => {
      const e = {
        at: h.at != null ? String(h.at) : '',
        deckId: typeof h.deckId === 'string' && DECK[h.deckId] ? h.deckId : null,
        stake: typeof h.stake === 'string' && STAKE[h.stake] ? h.stake : null,
        ante: count(h.ante),
        won: !!h.won,
        bestScore: count(h.bestScore),
      };
      // the run the entry files, by its seed (added 2026-11-24 (final pass)); an entry saved without one loads as it was
      if (typeof h.seed === 'string' && h.seed) e.seed = h.seed;
      return e;
    }).slice(-12);
    const bh = out.bestHand;
    out.bestHand = isObj(bh) && HAND[bh.handId] && Number.isFinite(bh.score) ? { handId: bh.handId, name: HAND[bh.handId].name, score: bh.score } : null;
    const disc = out.discovered && typeof out.discovered === 'object' ? out.discovered : {};
    out.discovered = {};
    for (const key of DISCOVERY_KEYS) out.discovered[key] = mapIds(disc[key], KNOWN[key]); // old ids mapped, unknown ones dropped
    for (const id of startIds(C.DECKS)) if (!out.unlockedDecks.includes(id)) out.unlockedDecks.push(id);
    for (const id of startIds(C.STAKES)) if (!out.unlockedStakes.includes(id)) out.unlockedStakes.push(id);
    return out;
  }
  function unlockWins(rec, run, unlockDeck, unlocked) {
    for (const d of C.DECKS) {
      const u = d.unlockedBy;
      if (u && u.type === 'win' && (!u.stakes || u.stakes.includes(run.stake))) unlockDeck(d);
    }
    if (!rec.wonOn.includes(run.stake)) rec.wonOn.push(run.stake);
    for (const s of C.STAKES) {
      if (s.unlockedBy && s.unlockedBy.type === 'win' && s.unlockedBy.on === run.stake && !rec.unlockedStakes.includes(s.id)) {
        rec.unlockedStakes.push(s.id);
        unlocked.push({ type: 'stake', id: s.id, name: s.name });
      }
    }
  }
  // The history entry that filed this run (added 2026-11-24 (final pass)): the newest win with its
  // seed, Deck and Stake. An entry filed before entries kept their seed is the run's only when it is
  // the newest entry and a win on the run's Deck and Stake (a single save slot means nothing else
  // can be filed while the run is played on). Null when the run has no entry: records erased since,
  // or another run's.
  function filedEntry(rec, run) {
    const h = rec.history;
    const mine = (e) => e.won && e.deckId === run.deckId && e.stake === run.stake;
    for (let i = h.length - 1; i >= 0; i--) if (h[i].seed != null && h[i].seed === run.seed && mine(h[i])) return h[i];
    const last = h[h.length - 1];
    return last && last.seed == null && mine(last) ? last : null;
  }
  function applyRunToRecords(records, run, opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    const rec = normalizeRecords(records);
    const unlocked = [];
    if (!run || typeof run !== 'object' || !run.stats) return { records: rec, unlocked };
    rec.bestAnte = Math.max(rec.bestAnte, Number(run.ante) || 0);
    const bh = run.stats.bestHand;
    if (bh && HAND[bh.handId] && (!rec.bestHand || bh.score > rec.bestHand.score)) {
      rec.bestHand = { handId: bh.handId, name: HAND[bh.handId].name, score: bh.score };
    }
    // A run is filed when it is won, before Endless mode; from then on its history entry follows it
    // to the Ante it reaches and its best hand, on every call, so Past runs shows the last Ante of a
    // run that ends in Endless mode, or is saved and left there (added 2026-11-24 (final pass): the
    // final call at its Game Over returned early, and the entry kept Ante 8 and the win's best hand).
    if (run.endless && run.recorded) {
      const e = filedEntry(rec, run);
      if (e) {
        e.ante = Math.max(e.ante, Number(run.ante) || 0);
        if (bh && Number.isFinite(bh.score)) e.bestScore = Math.max(e.bestScore, bh.score);
        if (e.seed == null && typeof run.seed === 'string' && run.seed) e.seed = run.seed;
      }
    }
    const disc = run.discovered && typeof run.discovered === 'object' ? run.discovered : {};
    for (const key of DISCOVERY_KEYS) {
      for (const id of mapIds(disc[key], KNOWN[key])) if (!rec.discovered[key].includes(id)) rec.discovered[key].push(id);
    }
    const unlockDeck = (d) => {
      if (rec.unlockedDecks.includes(d.id)) return;
      rec.unlockedDecks.push(d.id);
      unlocked.push({ type: 'deck', id: d.id, name: d.name });
    };
    for (const d of C.DECKS) if (d.unlockedBy && d.unlockedBy.type === 'ante' && rec.bestAnte >= d.unlockedBy.ante) unlockDeck(d);
    if (o.final && !run.recorded) {
      rec.runs += 1;
      if (run.won) {
        rec.wins += 1;
        unlockWins(rec, run, unlockDeck, unlocked);
      }
      const entry = { at: o.now == null ? '' : String(o.now), deckId: run.deckId, stake: run.stake, ante: run.ante, won: !!run.won, bestScore: bh ? bh.score : 0 };
      if (typeof run.seed === 'string' && run.seed) entry.seed = run.seed; // added 2026-11-24 (final pass): the entry can follow the run into Endless mode
      rec.history.push(entry);
      if (rec.history.length > 12) rec.history = rec.history.slice(-12);
      run.recorded = true;
    }
    return { records: rec, unlocked };
  }

  // ---------------------------------------------------------------------------
  // Public API. Every function that takes a run is guarded: a missing or malformed run
  // gives a failed result (or an empty answer for queries) instead of an exception.
  // ---------------------------------------------------------------------------
  const isRun = (run) => !!run && typeof run === 'object' && Array.isArray(run.cards) && Array.isArray(run.jokers) && Array.isArray(run.consumables) && !!run.stats;
  const Engine = { debug: false };
  // An action that hits an internal error leaves the run exactly as it was: its JSON is taken
  // before the call and put back on the same run object (2026-11-23 robustness pass; a stale card
  // uid under The Fade used to fade the score on every failed tap). About 0.1 ms per action.
  function snapshotOf(run) {
    try {
      return JSON.stringify(run);
    } catch (err) {
      return null;
    }
  }
  function restoreRun(run, snap) {
    if (snap == null) return;
    try {
      const back = JSON.parse(snap);
      for (const k of Object.keys(run)) if (!Object.prototype.hasOwnProperty.call(back, k)) delete run[k];
      Object.assign(run, back);
    } catch (err) {
      /* the run could not be put back; the failed result still says so */
    }
  }
  function act(fn) {
    return function (run, a, b) {
      if (!isRun(run)) return fail(E.bad);
      const snap = snapshotOf(run);
      try {
        return fn(run, a, b);
      } catch (err) {
        restoreRun(run, snap);
        if (Engine.debug) throw err;
        return fail(E.bad);
      }
    };
  }
  function query(fn, fallback) {
    return function (run, a, b) {
      if (!isRun(run)) return typeof fallback === 'function' ? fallback() : fallback;
      try {
        return fn(run, a, b);
      } catch (err) {
        if (Engine.debug) throw err;
        return typeof fallback === 'function' ? fallback() : fallback;
      }
    };
  }
  function safe(fn, fallback) {
    return function (a, b) {
      try {
        return fn(a, b);
      } catch (err) {
        if (Engine.debug) throw err;
        return typeof fallback === 'function' ? fallback() : fallback;
      }
    };
  }
  const failBad = () => fail(E.bad);

  Object.assign(Engine, {
    VERSION,
    RECORDS_VERSION,
    HAND_IDS: HAND_IDS.slice(),
    // creation and storage
    randomSeed,
    newRun,
    serialize: safe(serialize, null), // null for a run JSON can't hold (a cycle); 2026-11-23 reconcile
    deserialize,
    // queries
    getCard: query(getCard, null),
    blindsForAnte: query(blindsForAnte, () => []),
    currentBlindInfo: query(currentBlindInfo, null),
    evaluate: safe(evaluate, null),
    preview: query(preview, null),
    scoreCards: query(scoreCards, null),
    handTable: query(handTable, () => []),
    deckView: query(deckView, () => ({ cards: [], remaining: [] })),
    jokerText: query(jokerText, ''),
    jokerSellValue: query(jokerSellValue, 0),
    jokerSlotsUsed: query(jokerSlotsUsed, 0),
    jokerCopies: query(jokerCopies, () => []),
    consumableInfo: query(consumableInfo, null),
    consumableSellValue: query(consumableSellValue, 0),
    canUseConsumable: query(canUseConsumable, failBad),
    canBuy: query(canBuy, failBad),
    canPackPick: query(canPackPick, failBad),
    canPlay: query(canPlay, failBad),
    canDiscard: query(canDiscard, failBad),
    canSell: query(canSell, failBad),
    interestPreview: query(interestNow, 0),
    rerollCost: query(rerollCostOf, 0),
    handSizeNow: query(handSizeNow, 0),
    blindTarget: query(blindTarget, 0),
    cardText: query(cardText, () => []),
    stats: query(stats, null),
    // actions
    startBlind: act(startBlind),
    skipBlind: act(skipBlind),
    playHand: act(playHand),
    discard: act(discard),
    useConsumable: act(useConsumable),
    sellJoker: act(sellJoker),
    sellConsumable: act(sellConsumable),
    setSort: act(setSort),
    reorderHand: act(reorderHand),
    reorderJokers: act(reorderJokers),
    collect: act(collect),
    buy: act(buy),
    reroll: act(reroll),
    packPick: act(packPick),
    packSkip: act(packSkip),
    leaveShop: act(leaveShop),
    goEndless: act(goEndless),
    // Guarded like the actions (2026-11-23 reconcile): a malformed run gives null, never a throw.
    addJoker(run, id, paid, edition) {
      if (!isRun(run)) return null;
      const snap = snapshotOf(run);
      try {
        return addJoker(run, id, paid === undefined ? 0 : paid, edition === undefined ? null : edition);
      } catch (err) {
        restoreRun(run, snap);
        if (Engine.debug) throw err;
        return null;
      }
    },
    makeCard,
    // records
    defaultRecords,
    normalizeRecords: safe(normalizeRecords, defaultRecords),
    applyRunToRecords: (records, run, opts) => {
      try {
        return applyRunToRecords(records, run, opts);
      } catch (err) {
        if (Engine.debug) throw err;
        return { records: normalizeRecords(records), unlocked: [] };
      }
    },
    // content helpers (pure, no run)
    VOCABULARY: JSON.parse(JSON.stringify(VOCABULARY)),
    jokerProblems: safe(jokerProblems, () => ['not a Joker row']),
    editionInfo: safe(editionInfo, null),
    sealInfo: safe(sealInfo, null),
    cardChips,
    cardName,
    formatNumber,
    anteBaseTarget,
  });

  TW.Engine = Engine;
})();
