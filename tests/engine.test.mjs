/*
 * Engine v3: test suite.
 *
 * Every expectation is derived from SPEC.md v3 and content/systems.json (the section is
 * named in each test). src/content.js and src/engine.js are loaded, in that order, into one
 * bare vm context, exactly as SPEC §7 describes. Expected numbers are worked out by hand
 * from the tables; nothing is read back from the engine to build an expectation.
 *
 * Test technique notes:
 * - Runs are built with Engine.newRun, Engine.addJoker and real actions. Where a test needs a
 *   precise situation it sets documented run fields (§4.1), e.g. a hand card's rank,
 *   run.blind.score, run.bosses[ante] or a shop item's id.
 * - The Joker table is the 120 Jokers of content/content-plan.json (2026-11-23 (Jokers)). The
 *   tests that were written for the 27 v2 charms use their new ids (the plan's oldId), and keep
 *   every number the plan kept; the one number the plan changed (Sleight of Hand, was Fishhook)
 *   follows the plan and says so. tests/jokers.test.mjs tests every one of the 120 Jokers.
 * - A second context adds test-only Jokers (a Legendary pair and retrigger Jokers) to the
 *   content before the engine loads: the Joker vocabulary is data, so they need no code.
 * - Objects from the vm context have foreign prototypes, so deep comparisons go through a
 *   JSON round trip (deq).
 * - A few tests need local-only files (the originality list, the content plan, the content check): they skip with
 *   the reason where those are absent (tests/local-data.mjs).
 * - Run with: node --test "tests/*.test.mjs"
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGINALITY, needs, needsOriginality, pattern, itemNames } from './local-data.mjs';

// ------------------------------------------------------------------ loading
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CONTENT_FILE = path.join(ROOT, 'src', 'content.js');
const ENGINE_FILE = path.join(ROOT, 'src', 'engine.js');
const CONTENT_SRC = fs.readFileSync(CONTENT_FILE, 'utf8');
const ENGINE_SRC = fs.readFileSync(ENGINE_FILE, 'utf8');

function makeContext(prelude, between) {
  const ctx = vm.createContext({ console });
  if (prelude) vm.runInContext(prelude, ctx);
  vm.runInContext(CONTENT_SRC, ctx, { filename: CONTENT_FILE });
  if (between) vm.runInContext(between, ctx);
  vm.runInContext(ENGINE_SRC, ctx, { filename: ENGINE_FILE });
  return ctx;
}

const context = makeContext();
const GLOBALS_AFTER_LOAD = Object.keys(context);
const TW = vm.runInContext('globalThis.TW', context);
const Engine = TW.Engine;
const Content = TW.Content;

// Test-only Jokers, written in the Joker vocabulary (SPEC §3.4) and added before the engine loads.
const TEST_JOKERS = `TW.Content.JOKERS.push(
  { id: 'testlegend', name: 'Test Legend', rarity: 'legendary', cost: 20, text: '+100 Chips.', effects: [{ on: 'hand', chips: 100 }] },
  { id: 'testlegendb', name: 'Test Legend B', rarity: 'legendary', cost: 21, text: '+1 Mult.', effects: [{ on: 'hand', mult: 1 }] },
  { id: 'testface', name: 'Test Face', rarity: 'rare', cost: 8, text: 'Retrigger each scored face card.', effects: [{ on: 'retrigger', of: 'scored', when: { face: true }, times: 1 }] },
  { id: 'testheld', name: 'Test Held', rarity: 'rare', cost: 8, text: 'Retrigger each held card twice.', effects: [{ on: 'retrigger', of: 'held', times: 2 }] },
  { id: 'testvocab', name: 'Test Vocab', rarity: 'uncommon', cost: 5, text: '+3 Mult per played card if you play 3 or more.', effects: [{ on: 'hand', when: { minPlayed: 3 }, mult: 3, per: 'playedCards' }] },
  { id: 'testunknown', name: 'Test Unknown', rarity: 'common', cost: 3, text: 'Uses a word the engine does not know.', effects: [{ on: 'hand', when: { noSuchWord: true }, chips: 999 }] },
  { id: 'testfirstfree', name: 'Test First Free', rarity: 'common', cost: 4, text: 'Your first discard each Blind is free.', rules: { freeFirstDiscard: true } },
);`;
const xcontext = makeContext(null, TEST_JOKERS);
const XEngine = vm.runInContext('TW.Engine', xcontext);
// A third context without the Legendary rows, for Tall Tale's fallback (a table with no Legendary Joker).
const nolegContext = makeContext(null, `(() => { const L = TW.Content.JOKERS; for (let i = L.length - 1; i >= 0; i--) if (L[i].rarity === 'legendary') { delete L[L[i].id]; L.splice(i, 1); } })();`);
const NEngine = vm.runInContext('TW.Engine', nolegContext);

// ------------------------------------------------------------------ v3 tables (typed in from SPEC.md / systems.json)
const HAND_IDS = ['straightflush', 'four', 'fullhouse', 'flush', 'straight', 'three', 'twopair', 'pair', 'high'];
// §2.2: base values unchanged, per-level values new in v3
const SPEC_HANDS = [
  { id: 'straightflush', name: 'Straight Flush', chips: 110, mult: 8, lchips: 45, lmult: 4 },
  { id: 'four', name: 'Four of a Kind', chips: 64, mult: 6, lchips: 32, lmult: 3 },
  { id: 'fullhouse', name: 'Full House', chips: 44, mult: 4, lchips: 27, lmult: 2 },
  { id: 'flush', name: 'Flush', chips: 38, mult: 4, lchips: 18, lmult: 2 },
  { id: 'straight', name: 'Straight', chips: 34, mult: 4, lchips: 32, lmult: 3 },
  { id: 'three', name: 'Three of a Kind', chips: 32, mult: 3, lchips: 22, lmult: 2 },
  { id: 'twopair', name: 'Two Pair', chips: 22, mult: 2, lchips: 22, lmult: 1 },
  { id: 'pair', name: 'Pair', chips: 12, mult: 2, lchips: 16, lmult: 1 },
  { id: 'high', name: 'High Card', chips: 5, mult: 1, lchips: 12, lmult: 1 },
];
const HAND_NAME = Object.fromEntries(SPEC_HANDS.map((h) => [h.id, h.name]));

// §3.4: id -> [name, rarity, cost], the 120 Jokers of content/content-plan.json in plan order (60 common,
// 40 uncommon, 15 rare, 5 Legendary).
const SPEC_JOKERS = {
  // common
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
  // uncommon
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
  // rare
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
  // legendary
  candleking: ['The Candle King', 'legendary', 20],
  madameecho: ['Madame Echo', 'legendary', 20],
  puppetmaster: ['The Puppet Master', 'legendary', 20],
  sirmotley: ['Sir Motley', 'legendary', 20],
  ringmaster: ['The Ringmaster', 'legendary', 20],
};
// §3.4: the 27 v2 charms the 120-Joker table renames: v2 id -> [new id (its oldId is the v2 id), v2 rarity,
// v2 cost]. The plan keeps every number of theirs except Sleight of Hand's rule (the content check made it
// "once per Blind, a discard of 1 or 2 cards is free"; v2 Fishhook: "your first discard each Blind is free").
const OLD_JOKER_IDS = {
  anchor: ['jinglejester', 'common', 4], gull: ['pipsqueak', 'common', 4], biscuit: ['gingerbreadfool', 'common', 4],
  whistle: ['partyhorn', 'common', 4], coralcrown: ['papercrown', 'common', 4], sanddollar: ['couponclipper', 'common', 4],
  raft: ['emptyseats', 'common', 4], compassrose: ['pinwheel', 'common', 4], fishhook: ['sleightofhand', 'common', 4],
  reefknot: ['doubleact', 'common', 4], quill: ['tallyowl', 'common', 5], netmender: ['magpie', 'common', 5],
  kraken: ['sableknave', 'uncommon', 6], lobsterpot: ['redhanded', 'uncommon', 6], lighthouse: ['congaline', 'uncommon', 6],
  stormpetrel: ['moneybags', 'uncommon', 6], figurehead: ['openingact', 'uncommon', 6], crosscurrent: ['finalbow', 'uncommon', 7],
  bilgerat: ['chimneysweep', 'uncommon', 6], goldtooth: ['goldtooth', 'uncommon', 6], soundingline: ['oldstager', 'uncommon', 6],
  kelpforest: ['paperclip', 'uncommon', 6], mermaidcomb: ['lamplighter', 'uncommon', 7], leviathan: ['bigtop', 'rare', 8],
  ghostship: ['pokerface', 'rare', 8], seaserpent: ['dragontamer', 'rare', 9], treasuremap: ['fortunecookie', 'rare', 8],
};
const JOKER_IDS = Object.keys(SPEC_JOKERS);
const byRarity = (r) => JOKER_IDS.filter((id) => SPEC_JOKERS[id][1] === r);
const COMMONS = byRarity('common');
const UNCOMMONS = byRarity('uncommon');
const RARES = byRarity('rare');
const LEGENDARIES = byRarity('legendary');
// §3.1
const SPEC_ENH = { inked: 'Waxed', punchy: 'Kindled', dimestore: 'Gilt-Edged', popout: 'Sequined', scribbled: 'Masked', spotlit: 'Spotlit', vintage: 'Vintage', crumpled: 'Crumpled' };
// §3.2: id -> [name, surcharge, Shop/Joker Pack odds, Card Pack odds]
const SPEC_EDITIONS = { gloss: ['Sheen', 2, 0.03, 0.04], benday: ['Dither', 3, 0.02, 0.03], fourcolor: ['Glitch', 4, 0.005, 0.01], inverted: ['Phantom', 4, 0.005, 0] };
// §3.3
const SPEC_SEALS = { encore: 'Encore Seal', paid: 'Paid Seal', airmail: 'Comet Seal', cameo: 'Cameo Seal' };
// §3.6: id -> [name, select, where]
const SPEC_TAROT = {
  inkpot: ['The Candlemaker', [1, 2], 'blind'],
  boxingglove: ['Fire-Eater', [1, 2], 'blind'],
  pricegun: ['Gold Leaf', [1, 1], 'blind'],
  threedglasses: ['The Seamstress', [1, 1], 'blind'],
  crayon: ['Masquerade', [1, 2], 'blind'],
  spotlight: ['Spotlight', [1, 2], 'blind'],
  backissues: ['Heirloom', [1, 2], 'blind'],
  scrunch: ['Tinderbox', [1, 3], 'blind'],
  eraser: ['Candle Snuffer', [1, 2], 'blind'],
  ladder: ['The Ladder', [1, 3], 'blind'],
  shrinkray: ['The Slide', [1, 3], 'blind'],
  paintbucket: ['The Tailor', [2, 3], 'blind'],
  carboncopy: ['Carbon Copy', [1, 1], 'blind'],
  paperroute: ["Busker's Hat", [0, 0], 'any'],
  gueststar: ['Late Arrival', [0, 0], 'any'],
  overtime: ['Overtime', [0, 0], 'blind'],
  doover: ['Do-Over', [0, 0], 'blind'],
  happyaccident: ['Happy Accident', [0, 0], 'any'],
  launchpad: ['Launch Pad', [0, 0], 'any'],
  reprint: ['Copycat', [0, 0], 'any'],
};
// Enhancement Tarot cards -> the Enhancement they make
const ENH_TAROT = { inkpot: 'inked', boxingglove: 'punchy', pricegun: 'dimestore', threedglasses: 'popout', crayon: 'scribbled', spotlight: 'spotlit', backissues: 'vintage', scrunch: 'crumpled' };
// §3.7: id -> [name, hand]
const SPEC_PLANETS = {
  blip: ['Pipkin', 'high'], boing: ['Twindle', 'pair'], zipzap: ['Marmalon', 'twopair'], kerplunk: ['Cinderon', 'three'], zoom: ['Quintara', 'straight'],
  swoosh: ['Ochrelle', 'flush'], kaboom: ['Hearthon', 'fullhouse'], thwack: ['Tetralune', 'four'], bigbang: ['Regalis', 'straightflush'],
};
const PLANET_OF = Object.fromEntries(Object.entries(SPEC_PLANETS).map(([id, [, hand]]) => [hand, id]));
// §3.8: id -> [name, select, where]
const SPEC_SPECTRAL = {
  curtaincall: ['Curtain Call', [1, 1], 'blind'],
  cursedcoin: ['Cursed Coin', [1, 2], 'blind'],
  deadletter: ['Starfall', [1, 2], 'blind'],
  apparition: ['Apparition', [1, 2], 'blind'],
  phantomink: ['Foxfire', [1, 1], 'blind'],
  upsidedown: ['Shadow Play', [1, 1], 'blind'],
  hauntedpress: ['Poltergeist', [0, 0], 'any'],
  midnightedition: ['Witching Hour', [0, 0], 'any'],
  wormhole: ['Eclipse', [0, 0], 'any'],
  vanishingact: ['Vanishing Act', [1, 4], 'blind'],
  ghostwriter: ['Ghost Writer', [0, 0], 'any'],
  doppelganger: ['Doppelganger', [0, 0], 'any'],
  spellbound: ['Wickwisp', [1, 1], 'blind'], // decision 'wickwisp'
  graveyardshift: ['Graveyard Shift', [0, 0], 'blind'],
  hallofmirrors: ['Hall of Mirrors', [1, 1], 'blind'],
  originstory: ['Tall Tale', [0, 0], 'any'],
};
const SPECTRAL_IDS = Object.keys(SPEC_SPECTRAL);
// §3.9: id -> [name, from Ante]
const SPEC_BOSSES = {
  heckler: ['The Heckler', 1], lid: ['The Lid', 3], shuffler: ['The Shuffler', 1], fade: ['The Fade', 2], tollbooth: ['The Tollbooth', 1],
  smudge: ['The Smudge', 1], squeeze: ['The Squeeze', 2], washout: ['The Wash-Out', 2], wetblanket: ['The Wet Blanket', 2], grudge: ['The Spoilsport', 2],
  censor: ['The Blackout', 3], warmup: ['The Warm-Up', 1], fumble: ['The Fumble', 1], shortfuse: ['The Short Fuse', 2], bigfinish: ['The Big Finish', 8],
};
// §3.10
const SPEC_VOUCHERS = {
  musclecourse: 'Long Sleeves', speedcourse: 'Midnight Oil', springcleaning: 'Spring Cleaning', extrapanel: 'Pull Up a Chair', skyatlas: 'Sky Atlas',
  savingsbond: 'Savings Bond', spinnerrack: 'Night Market', secondlook: 'Second Look', slickpaper: 'Shimmer Dust', stampalbum: 'Ribbon Box',
  mailorderghost: 'Haunted Stall', bonuspages: "Baker's Dozen", dollaroff: 'Season Pass',
};
// §3.11: id -> [name, from Ante]
const SPEC_TAGS = {
  piggybank: ['Piggy Bank Tag', 1], buddy: ['Buddy Tag', 1], tarot: ['Tarot Tag', 1], fanfavorite: ['Crowd Pleaser Tag', 1], secondwind: ['Second Wind Tag', 1],
  headstart: ['Head Start Tag', 1], sale: ['Sale Tag', 1], grabbag: ['Grab Bag Tag', 1], collector: ['Glimmer Tag', 1], ghost: ['Ghost Tag', 2],
  stamp: ['Ribbon Tag', 1], sky: ['Sky Tag', 1],
};
// §3.12: id -> [name, kind, size, shown, picks, price, from Ante]
const SPEC_PACKS = {
  cardnormal: ['Card Pack', 'card', 'normal', 4, 1, 4, 1], cardjumbo: ['Jumbo Card Pack', 'card', 'jumbo', 6, 1, 6, 1], cardmega: ['Mega Card Pack', 'card', 'mega', 6, 2, 9, 1],
  tarotnormal: ['Tarot Pack', 'tarot', 'normal', 4, 1, 4, 1], tarotjumbo: ['Jumbo Tarot Pack', 'tarot', 'jumbo', 6, 1, 6, 1], tarotmega: ['Mega Tarot Pack', 'tarot', 'mega', 6, 2, 9, 1],
  planetnormal: ['Planet Pack', 'planet', 'normal', 4, 1, 4, 1], planetjumbo: ['Jumbo Planet Pack', 'planet', 'jumbo', 6, 1, 6, 1], planetmega: ['Mega Planet Pack', 'planet', 'mega', 6, 2, 9, 1],
  jokernormal: ['Joker Pack', 'joker', 'normal', 2, 1, 6, 1], jokerjumbo: ['Jumbo Joker Pack', 'joker', 'jumbo', 3, 1, 8, 1], jokermega: ['Mega Joker Pack', 'joker', 'mega', 4, 2, 10, 1],
  ghostnormal: ['Ghost Pack', 'ghost', 'normal', 2, 1, 5, 2], ghostjumbo: ['Jumbo Ghost Pack', 'ghost', 'jumbo', 3, 1, 7, 2], ghostmega: ['Mega Ghost Pack', 'ghost', 'mega', 4, 2, 10, 2],
};
// §3.13
const SPEC_DECKS = {
  firstissue: 'House Deck', speedlines: 'Firefly Deck', sketchbook: "Seer's Deck", panorama: 'Candelabra Deck', bargainbin: 'Rags to Riches Deck',
  studio: 'Parlour Deck', rubberstamp: 'Gift-Wrapped Deck', mintcondition: 'High Roller Deck', halftone: 'Mirrorball Deck', spooky: 'Spooky Deck',
};
// §3.14
const SPEC_STAKES = { sunny: 'Twilight Stake', uhoh: 'Nightfall Stake', gulp: 'Moonless Stake', yikes: 'Last Candle Stake' };

// §2.6 targets, worked out by hand: round(base x Blind x Stake x Big Finish / 10) x 10.
// Ante 8's Boss Blind is always The Big Finish (x1.5).
const TARGETS = {
  sunny: [
    [300, 450, 600], [700, 1050, 1400], [1700, 2550, 3400], [4000, 6000, 8000],
    [8500, 12750, 17000], [16000, 24000, 32000], [28000, 42000, 56000], [45000, 67500, 135000],
  ],
  uhoh: [
    [360, 540, 720], [840, 1260, 1680], [2040, 3060, 4080], [4800, 7200, 9600],
    [10200, 15300, 20400], [19200, 28800, 38400], [33600, 50400, 67200], [54000, 81000, 162000],
  ],
  gulp: [
    [360, 540, 720], [840, 1260, 1680], [2040, 3060, 4080], [4800, 7200, 9600],
    [10200, 15300, 20400], [19200, 28800, 38400], [33600, 50400, 67200], [54000, 81000, 162000],
  ],
  yikes: [
    [420, 630, 840], [980, 1470, 1960], [2380, 3570, 4760], [5600, 8400, 11200],
    [11900, 17850, 23800], [22400, 33600, 44800], [39200, 58800, 78400], [63000, 94500, 189000],
  ],
};

// §0: the item names of the originality list (tests/local/originality.json, local-only; SYSTEMS.md, section Checks).
// "Joker" is a system word, so it is allowed. Without the list, the test that reads them skips.
const LISTED_NAMES = ORIGINALITY ? itemNames().filter((n) => n !== 'Joker') : [];

// ------------------------------------------------------------------ generic helpers
const plain = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const deq = (actual, expected, msg) => assert.deepStrictEqual(plain(actual), plain(expected), msg);
const list = (table) => (Array.isArray(table) ? Array.from(table) : Object.values(table || {}));
const entry = (table, id) => list(table).find((e) => e && e.id === id);
const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) out[k] = obj == null ? undefined : obj[k];
  return out;
};
const sorted = (arr) => [...arr].sort();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function within(x, lo, hi, what) {
  assert.ok(x >= lo && x <= hi, `${what}: ${x.toFixed(4)} is outside [${lo}, ${hi}]`);
}
function ok(res, what = 'action') {
  assert.ok(res && typeof res === 'object', `${what}: expected a result object, got ${res}`);
  assert.equal(res.ok, true, `${what} failed: ${res.error}`);
  return res;
}
function fails(res, what = 'action', sentence) {
  assert.ok(res && typeof res === 'object', `${what}: expected a result object, got ${res}`);
  assert.equal(res.ok, false, `${what}: expected { ok: false }`);
  assert.equal(typeof res.error, 'string', `${what}: error should be a sentence`);
  assert.ok(res.error.trim().length > 0, `${what}: error should not be empty`);
  if (sentence !== undefined) assert.equal(res.error, sentence, what);
  return res;
}

// ------------------------------------------------------------------ card helpers
// 'KS', 'QH+inked', 'AS+gloss+encore', '7C+vintage+grow8'
const RANK_OF = { J: 11, Q: 12, K: 13, A: 14 };
function parseCard(spec) {
  const [face, ...mods] = spec.split('+');
  const out = { rank: RANK_OF[face.slice(0, -1)] ?? Number(face.slice(0, -1)), suit: face.slice(-1), enhancement: null, edition: null, seal: null, grow: 0 };
  for (const m of mods) {
    if (m in SPEC_ENH) out.enhancement = m;
    else if (m in SPEC_EDITIONS) out.edition = m;
    else if (m in SPEC_SEALS) out.seal = m;
    else if (/^grow\d+$/.test(m)) out.grow = Number(m.slice(4));
    else throw new Error(`parseCard: unknown modifier ${m}`);
  }
  return out;
}
function mkWith(E, spec) {
  const p = parseCard(spec);
  return E.makeCard(p.rank, p.suit, { enhancement: p.enhancement, edition: p.edition, seal: p.seal, grow: p.grow });
}
const mk = (spec) => mkWith(Engine, spec);
const mks = (s) => (s.trim() ? s.trim().split(/\s+/).map(mk) : []);
const uidsOf = (cards) => cards.map((c) => c.uid);
const SUIT_IDX = { S: 0, H: 1, C: 2, D: 3 };
const rankCmp = (a, b) => b.rank - a.rank || SUIT_IDX[a.suit] - SUIT_IDX[b.suit];
const suitCmp = (a, b) => SUIT_IDX[a.suit] - SUIT_IDX[b.suit] || b.rank - a.rank;

// ------------------------------------------------------------------ run helpers
function fresh(opts = {}, E = Engine) {
  return E.newRun({ seed: 'TESTSEED', ...opts });
}
function inBlind(opts = {}, E = Engine) {
  const run = fresh(opts, E);
  ok(E.startBlind(run), 'startBlind');
  return run;
}
const cardOf = (run, uid) => run.cards.find((c) => c.uid === uid);
const jokerOf = (run, uid) => run.jokers.find((j) => j.uid === uid);
const handCards = (run) => run.blind.hand.map((u) => cardOf(run, u));
const oneCard = (run) => [run.blind.hand[run.blind.hand.length - 1]];

/** Rewrites the first cards of a hand (documented card fields) and returns their uids. */
function setHand(run, specs, holder = run.blind) {
  const hand = holder.hand;
  assert.ok(specs.length <= hand.length, 'setHand: more specs than cards in hand');
  specs.forEach((spec, i) => Object.assign(cardOf(run, hand[i]), parseCard(spec)));
  return hand.slice(0, specs.length);
}
/** Puts a consumable straight into the documented consumables array. */
function give(run, kind, id) {
  const uid = `k${run.nextUid}`;
  run.nextUid += 1;
  run.consumables.push({ uid, kind, id });
  return uid;
}
/** Plays one card from a score just short of the target, so the Blind is beaten. */
function forceClear(run, E = Engine) {
  assert.equal(run.phase, 'play', 'forceClear needs a Blind in play');
  const b = run.blind;
  b.score = b.boss === 'fade' && b.handsPlayed > 0 ? b.target * 2 : b.target - 1;
  const r = ok(E.playHand(run, [b.hand[0]]), 'playHand (clearing)');
  assert.equal(r.cleared, true, 'the forced hand should beat the Blind');
  return r;
}
function toShop(run, E = Engine) {
  if (run.phase === 'blind-select') ok(E.startBlind(run), 'startBlind');
  forceClear(run, E);
  ok(E.collect(run), 'collect');
  assert.equal(run.phase, 'shop');
  return run;
}
function skip(run, tagId, E = Engine) {
  if (tagId) run.tags[`${run.ante}-${run.blindIndex}`] = tagId;
  const r = ok(E.skipBlind(run), 'skipBlind');
  if (run.phase === 'pack') ok(E.packSkip(run), 'packSkip');
  return r;
}
function clearAndLeave(run, E = Engine) {
  toShop(run, E);
  ok(E.leaveShop(run), 'leaveShop');
}
function advanceToAnte(run, n) {
  while (run.ante < n) {
    if (run.blindIndex < 2) skip(run, 'piggybank');
    else clearAndLeave(run);
  }
}
/** Skips the Small and Big Blinds (Piggy Bank Tag each) and starts the Boss Blind. */
function toBoss(run, bossId, E = Engine) {
  skip(run, 'piggybank', E);
  skip(run, 'piggybank', E);
  if (bossId) run.bosses[run.ante] = bossId;
  ok(E.startBlind(run), 'startBlind (boss)');
  assert.equal(run.blind.kind, 'boss');
  if (bossId) assert.equal(run.blind.boss, bossId);
  return run;
}
/** Opens a pack of the given id from the Shop (by rewriting a documented pack slot). */
function openPackFromShop(run, packId, E = Engine) {
  if (run.phase !== 'shop') toShop(run, E);
  const i = run.shop.items.findIndex((it) => it.slot === 'pack');
  Object.assign(run.shop.items[i], { id: packId, size: SPEC_PACKS[packId][2], price: 0, sold: false });
  const r = ok(E.buy(run, i), `buy ${packId}`);
  assert.equal(r.opened, true);
  assert.equal(run.phase, 'pack');
  return run;
}
function rerollUntil(run, pred, max = 400, E = Engine) {
  for (let i = 0; i < max; i++) {
    const idx = run.shop.items.findIndex(pred);
    if (idx >= 0) return idx;
    run.money = Math.max(run.money, 1e6);
    ok(E.reroll(run), 'reroll');
  }
  return assert.fail('reroll never produced the wanted item');
}
const cardItems = (run) => run.shop.items.filter((i) => i.slot === 'card');

// ------------------------------------------------------------------ scoring helpers
function score(run, played, held = [], E = Engine) {
  const p = typeof played === 'string' ? played.trim().split(/\s+/).filter(Boolean).map((s) => mkWith(E, s)) : played;
  const h = typeof held === 'string' ? held.trim().split(/\s+/).filter(Boolean).map((s) => mkWith(E, s)) : held;
  return E.scoreCards(run, p, h);
}
function nameMap(named) {
  const m = {};
  for (const [k, v] of Object.entries(named)) m[v.uid] = k;
  return m;
}
/** Compact step rows: [source, uid name, kind, amount, label, runningChips, runningMult]. */
function rows(result, names) {
  return result.steps.map((s) => [s.source, s.uid == null ? null : names[s.uid] ?? s.uid, s.kind, s.amount, s.label, s.runningChips, s.runningMult]);
}
/** Step tags: [via, enhancement, edition, seal, jokerUid name]. */
function tags(result, names) {
  return result.steps.map((s) => [s.via, s.enhancement, s.edition, s.seal, s.jokerUid == null ? null : names[s.jokerUid] ?? s.jokerUid]);
}
function assertSorted(run, mode, hand = run.blind.hand) {
  const cmp = mode === 'rank' ? rankCmp : suitCmp;
  const cards = hand.map((u) => cardOf(run, u));
  for (let i = 1; i < cards.length; i++) {
    assert.ok(cmp(cards[i - 1], cards[i]) <= 0, `hand not sorted by ${mode}: ${cards.map((c) => c.rank + c.suit).join(' ')}`);
  }
}
function assertPlainJSON(value, where = 'run') {
  const ctxObjectProto = vm.runInContext('Object.prototype', context);
  const walk = (v, p) => {
    if (v === null) return;
    const t = typeof v;
    if (t === 'string' || t === 'boolean') return;
    if (t === 'number') {
      assert.ok(Number.isFinite(v), `${p} is not a finite number`);
      return;
    }
    assert.equal(t, 'object', `${p} has type ${t}`);
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${p}[${i}]`));
      return;
    }
    const proto = Object.getPrototypeOf(v);
    assert.ok(proto === ctxObjectProto || proto === null || proto === Object.prototype, `${p} is not a plain object`);
    for (const [k, x] of Object.entries(v)) {
      assert.notEqual(x, undefined, `${p}.${k} is undefined`);
      walk(x, `${p}.${k}`);
    }
  };
  walk(value, where);
}

// =========================================================================================
describe('§0 Ground rules', () => {
  test('§0 content.js and engine.js run as classic scripts in a bare Node vm context and attach to TW', () => {
    assert.equal(typeof Engine, 'object');
    assert.equal(typeof Content, 'object');
    deq(GLOBALS_AFTER_LOAD.filter((k) => k !== 'console' && k !== 'TW'), []);
  });

  test('§0 the engine runs without Date', () => {
    const ctx2 = makeContext('delete globalThis.Date;');
    const E2 = vm.runInContext('TW.Engine', ctx2);
    assert.doesNotThrow(() => {
      E2.randomSeed();
      const run = E2.newRun({ seed: 'NODATE22' });
      E2.startBlind(run);
      E2.discard(run, run.blind.hand.slice(0, 2));
      E2.playHand(run, run.blind.hand.slice(0, 1));
      E2.deserialize(E2.serialize(run));
      E2.applyRunToRecords(E2.defaultRecords(), run, { final: true, now: 'n' });
    });
  });

  test('§0 Math.random is never used once a seed is given (only Engine.randomSeed may use it)', () => {
    vm.runInContext(
      'globalThis.__calls = 0; globalThis.__orig = Math.random; Math.random = function () { globalThis.__calls++; return globalThis.__orig(); };',
      context,
    );
    try {
      const run = Engine.newRun({ seed: 'NORANDOM', deckId: 'rubberstamp' });
      Engine.addJoker(run, 'fortunecookie');
      Engine.addJoker(run, 'jinglejester');
      ok(Engine.startBlind(run));
      ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
      ok(Engine.useConsumable(run, give(run, 'spectral', 'graveyardshift'), []));
      ok(Engine.useConsumable(run, give(run, 'tarot', 'happyaccident'), []));
      ok(Engine.playHand(run, oneCard(run)));
      forceClear(run);
      ok(Engine.collect(run));
      run.money = 100;
      ok(Engine.reroll(run));
      ok(Engine.leaveShop(run));
      run.tags['1-1'] = 'grabbag';
      ok(Engine.skipBlind(run));
      ok(Engine.packPick(run, 0));
      ok(Engine.useConsumable(run, give(run, 'spectral', 'originstory'), []));
      ok(Engine.startBlind(run));
      ok(Engine.playHand(run, oneCard(run)));
      assert.equal(vm.runInContext('globalThis.__calls', context), 0);
    } finally {
      vm.runInContext('Math.random = globalThis.__orig; delete globalThis.__calls; delete globalThis.__orig;', context);
    }
  });

  test('§0 no content name is an item name of the originality list, and no text names one', { skip: needsOriginality }, () => {
    assert.ok(LISTED_NAMES.length > 300, `the originality list holds the item names (${LISTED_NAMES.length})`);
    const multi = LISTED_NAMES.filter((n) => /\s/.test(n));
    const single = LISTED_NAMES.filter((n) => !/\s/.test(n));
    const wordRe = (n, flags) => new RegExp(`(^|[^A-Za-z0-9])${escapeRe(n)}($|[^A-Za-z0-9])`, flags);
    const hits = [];
    for (const key of ['HANDS', 'BLINDS', 'ENHANCEMENTS', 'EDITIONS', 'SEALS', 'TAROTS', 'PLANETS', 'SPECTRALS', 'JOKERS', 'BOSSES', 'VOUCHERS', 'TAGS', 'PACKS', 'DECKS', 'STAKES']) {
      for (const row of list(Content[key])) {
        if (LISTED_NAMES.some((n) => n.toLowerCase() === row.name.toLowerCase())) hits.push(`${key}.${row.id} name equals ${row.name}`);
        for (const n of multi) if (wordRe(n, 'i').test(row.name)) hits.push(`${key}.${row.id} name contains ${n}`);
        for (const field of ['text', 'unlock', 'jokerText', 'cardText']) {
          const t = row[field];
          if (typeof t !== 'string') continue;
          for (const n of multi) if (wordRe(n, 'i').test(t)) hits.push(`${key}.${row.id}.${field} contains ${n}`);
          for (const n of single) if (wordRe(n, '').test(t)) hits.push(`${key}.${row.id}.${field} contains ${n}`);
        }
      }
    }
    deq(hits, []);
  });

  test('§0 no content text uses a v2 sea word or a renamed concept (the 120 Joker names included)', () => {
    const banned = /\b(watch(es)?|voyages?|charms?|fittings?|refits?|driftwood|crates?|tides?|sea states?|lost at sea)\b/i;
    const hits = [];
    (function walk(v, p, key, table) {
      if (typeof v === 'string') {
        if (key === 'id' || key === 'oldId') return;
        if (banned.test(v)) hits.push(`${p}: ${v}`);
        return;
      }
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`, k, table || (p === 'Content' ? k : table));
    })(Content, 'Content', null, null);
    deq(hits, []);
  });

  test('§0 no literal </script inside content.js or engine.js', () => {
    assert.ok(!/<\/script/i.test(CONTENT_SRC), 'content.js contains </script');
    assert.ok(!/<\/script/i.test(ENGINE_SRC), 'engine.js contains </script');
  });
});

// =========================================================================================
describe('§3 Content tables', () => {
  test('§3.15 HANDS lists the nine hands strongest first with base and the v3 per-level values', () => {
    assert.ok(Array.isArray(Content.HANDS));
    deq(Content.HANDS.map((h) => pick(h, ['id', 'name', 'chips', 'mult', 'lchips', 'lmult'])), SPEC_HANDS);
  });

  test('§3.15 BLINDS and ANTE_TARGETS', () => {
    deq(list(Content.BLINDS).map((b) => pick(b, ['id', 'kind', 'name', 'mult', 'reward', 'skippable'])), [
      { id: 'small', kind: 'small', name: 'Small Blind', mult: 1, reward: 3, skippable: true },
      { id: 'big', kind: 'big', name: 'Big Blind', mult: 1.5, reward: 4, skippable: true },
      { id: 'boss', kind: 'boss', name: 'Boss Blind', mult: 2, reward: 5, skippable: false },
    ]);
    deq(Content.ANTE_TARGETS, [300, 700, 1700, 4000, 8500, 16000, 28000, 45000]);
  });

  test('§3.15 rank and suit name tables', () => {
    deq(Content.RANK_NAMES, { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' });
    deq(Content.RANK_WORDS, { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' });
    deq(Content.RANK_PLURALS, { 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' });
    deq(Content.SUIT_NAMES, { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' });
    deq(Content.SUIT_ORDER, ['S', 'H', 'C', 'D']);
  });

  const first = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const idNameCases = [
    ['§3.1 ENHANCEMENTS (8)', 'ENHANCEMENTS', SPEC_ENH],
    ['§3.2 EDITIONS (4)', 'EDITIONS', first(SPEC_EDITIONS)],
    ['§3.3 SEALS (4)', 'SEALS', SPEC_SEALS],
    ['§3.4 JOKERS (120)', 'JOKERS', first(SPEC_JOKERS)],
    ['§3.6 TAROTS (20)', 'TAROTS', first(SPEC_TAROT)],
    ['§3.7 PLANETS (9)', 'PLANETS', first(SPEC_PLANETS)],
    ['§3.8 SPECTRALS (16)', 'SPECTRALS', first(SPEC_SPECTRAL)],
    ['§3.9 BOSSES (15)', 'BOSSES', first(SPEC_BOSSES)],
    ['§3.10 VOUCHERS (13)', 'VOUCHERS', SPEC_VOUCHERS],
    ['§3.11 TAGS (12)', 'TAGS', first(SPEC_TAGS)],
    ['§3.12 PACKS (15)', 'PACKS', first(SPEC_PACKS)],
    ['§3.13 DECKS (10)', 'DECKS', SPEC_DECKS],
    ['§3.14 STAKES (4)', 'STAKES', SPEC_STAKES],
  ];
  for (const [title, key, names] of idNameCases) {
    test(`${title}: exact ids and names, each with text`, () => {
      const rowsOf = list(Content[key]);
      deq(sorted(rowsOf.map((e) => e.id)), sorted(Object.keys(names)));
      for (const [id, name] of Object.entries(names)) {
        const e = entry(Content[key], id);
        assert.equal(e.name, name, `${key}.${id} name`);
        assert.equal(typeof e.text, 'string', `${key}.${id} text`);
        assert.ok(e.text.length > 0, `${key}.${id} text is empty`);
      }
      assert.equal(Content.byId(key, rowsOf[0].id), rowsOf[0]);
      assert.equal(Content.byId(key, 'nope'), null);
    });
  }

  test('§3.4 the four tide charms are gone; the 27 other v2 charms are renamed through oldId, keeping their v2 rarities and costs', () => {
    for (const id of ['mudskipper', 'moonjelly', 'tidemill', 'stormglass']) {
      assert.equal(entry(Content.JOKERS, id), undefined, id);
      assert.ok(!list(Content.JOKERS).some((r) => r.oldId === id), `nothing renames the tide charm ${id}`);
    }
    for (const [id, [, rarity, cost]] of Object.entries(SPEC_JOKERS)) deq(pick(entry(Content.JOKERS, id), ['rarity', 'cost']), { rarity, cost }, id);
    const renamed = list(Content.JOKERS).filter((r) => r.oldId);
    deq(Object.fromEntries(renamed.map((r) => [r.oldId, [r.id, r.rarity, r.cost]])), OLD_JOKER_IDS, 'oldId -> id, v2 rarity and v2 cost');
    for (const oldId of Object.keys(OLD_JOKER_IDS)) if (oldId !== 'goldtooth') assert.equal(entry(Content.JOKERS, oldId), undefined, `the v2 id ${oldId} is gone`);
    deq(list(Content.JOKERS).map((r) => r.id), JOKER_IDS, 'plan order');
    deq([COMMONS.length, UNCOMMONS.length, RARES.length, LEGENDARIES.length], [60, 40, 15, 5]);
    deq(Object.keys(Content.RARITIES), ['common', 'uncommon', 'rare', 'legendary']);
    deq(Object.values(Content.RARITIES).map((r) => r.weight), [70, 25, 5, 0]);
  });

  test('§3.6 / §3.8 Tarot and Spectral cards carry select [min, max] and where', () => {
    for (const [key, table] of [['TAROTS', SPEC_TAROT], ['SPECTRALS', SPEC_SPECTRAL]]) {
      for (const [id, [, select, where]] of Object.entries(table)) {
        const e = entry(Content[key], id);
        deq(e.select, select, `${id} select`);
        assert.equal(e.where, where, `${id} where`);
      }
    }
  });

  test('§3.7 each Planet card text is "Level up <Hand>. (+Chips / +Mult per level)" with the v3 values', () => {
    for (const [id, [, hand]] of Object.entries(SPEC_PLANETS)) {
      const h = SPEC_HANDS.find((x) => x.id === hand);
      const e = entry(Content.PLANETS, id);
      assert.equal(e.hand, hand);
      assert.equal(e.text, `Level up ${h.name}. (+${h.lchips} Chips / +${h.lmult} Mult per level)`);
    }
  });

  test('§3.12 PACKS: kind, size, cards shown, picks, price and first Ante per row', () => {
    for (const [id, [, kind, size, shown, picks, price, fromAnte]] of Object.entries(SPEC_PACKS)) {
      deq(pick(entry(Content.PACKS, id), ['kind', 'size', 'shown', 'picks', 'price', 'fromAnte']), { kind, size, shown, picks, price, fromAnte }, id);
    }
  });

  test('§3.2 EDITIONS: surcharges and roll odds', () => {
    for (const [id, [, surcharge, joker, card]] of Object.entries(SPEC_EDITIONS)) {
      const e = entry(Content.EDITIONS, id);
      assert.equal(e.surcharge, surcharge, `${id} surcharge`);
      deq(e.odds, { joker, card }, `${id} odds`);
    }
  });

  test('§3.13 / §3.14 every locked Deck and Stake carries unlock text', () => {
    for (const key of ['DECKS', 'STAKES']) {
      for (const e of list(Content[key])) {
        assert.equal(typeof e.unlock, 'string', `${e.id}.unlock`);
        assert.ok(e.unlock.length > 0, `${e.id}.unlock is empty`);
      }
    }
  });

  test('§3 renamed rows keep the v2 id they replace in oldId (used by the records migration)', () => {
    const cases = [
      ['ENHANCEMENTS', 'inked', 'barnacle'], ['TAROTS', 'inkpot', 'springtide'], ['TAROTS', 'eraser', 'undertow'], ['PLANETS', 'blip', 'polaris'],
      ['BOSSES', 'heckler', 'siren'], ['BOSSES', 'squeeze', 'doldrums'], ['BOSSES', 'bigfinish', 'maelstrom'], ['VOUCHERS', 'slickpaper', 'tideclock'],
      ['TAGS', 'piggybank', 'bottle'], ['DECKS', 'firstissue', 'dinghy'], ['DECKS', 'rubberstamp', 'tender'], ['DECKS', 'mintcondition', 'sloop'],
      ['STAKES', 'yikes', 'gale'], ['PACKS', 'cardnormal', 'deck'], ['BLINDS', 'boss', 'night'],
    ];
    for (const [key, id, oldId] of cases) assert.equal(entry(Content[key], id).oldId, oldId, `${key}.${id}`);
  });
});

// =========================================================================================
describe('§2.1 Cards', () => {
  test('§2.1 a new run owns the standard 52 cards: ranks 2-14 in S, H, D, C, with no Enhancement, Edition or Seal', () => {
    const run = fresh();
    assert.equal(run.cards.length, 52);
    const expected = [];
    for (const s of ['S', 'H', 'D', 'C']) for (let r = 2; r <= 14; r++) expected.push(`${r}${s}`);
    deq(sorted(run.cards.map((c) => `${c.rank}${c.suit}`)), sorted(expected));
    for (const c of run.cards) {
      deq(pick(c, ['enhancement', 'edition', 'seal', 'grow']), { enhancement: null, edition: null, seal: null, grow: 0 });
      assert.match(c.uid, /^c\d+$/);
    }
    assert.equal(new Set(run.cards.map((c) => c.uid)).size, 52);
  });

  test("§2.1 uids share one counter: 'c' cards, 'h' Jokers, 'k' consumables, each from run.nextUid++", () => {
    const run = fresh();
    const n = run.nextUid;
    for (const c of run.cards) assert.ok(Number(c.uid.slice(1)) < n);
    const j = Engine.addJoker(run, 'jinglejester');
    assert.equal(j.uid, `h${n}`);
    assert.equal(run.nextUid, n + 1);
    assert.equal(Engine.addJoker(run, 'pipsqueak').uid, `h${n + 1}`);
    const studio = fresh({ deckId: 'studio' });
    const halftone = fresh({ deckId: 'halftone' });
    for (const k of studio.consumables) assert.match(k.uid, /^k\d+$/);
    for (const r of [studio, halftone]) {
      const all = [...r.cards, ...r.jokers, ...r.consumables].map((x) => x.uid.slice(1));
      assert.equal(new Set(all).size, all.length, 'numbers are never reused across prefixes');
      for (const x of all) assert.ok(Number(x) < r.nextUid);
    }
  });

  test("§2.1 makeCard(rank, suit, { enhancement, edition, seal }) returns a card with an 'x' uid", () => {
    const a = Engine.makeCard(12, 'H');
    const b = Engine.makeCard(14, 'S', { enhancement: 'punchy', edition: 'gloss', seal: 'encore' });
    const c = Engine.makeCard(9, 'D', 'inked');
    deq(pick(a, ['rank', 'suit', 'enhancement', 'edition', 'seal', 'grow']), { rank: 12, suit: 'H', enhancement: null, edition: null, seal: null, grow: 0 });
    deq(pick(b, ['rank', 'suit', 'enhancement', 'edition', 'seal']), { rank: 14, suit: 'S', enhancement: 'punchy', edition: 'gloss', seal: 'encore' });
    assert.equal(c.enhancement, 'inked', 'an Enhancement id string also works');
    for (const x of [a, b, c]) assert.match(x.uid, /^x\d+$/);
    assert.equal(new Set([a.uid, b.uid, c.uid]).size, 3);
  });

  test('§2.1 card Chips: ranks 2-10 give their rank, J/Q/K give 10, A gives 11', () => {
    const run = inBlind();
    const chips = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 10, 12: 10, 13: 10, 14: 11 };
    for (let r = 2; r <= 14; r++) {
      const res = Engine.scoreCards(run, [Engine.makeCard(r, 'C')], []);
      assert.equal(res.handId, 'high');
      assert.equal(res.chips, 5 + chips[r], `rank ${r}`);
      assert.equal(res.total, 5 + chips[r]);
      assert.equal(Engine.cardChips({ rank: r }), chips[r]);
    }
  });
});

// =========================================================================================
describe('§2.2 Poker hands: detection and scoring cards', () => {
  const evalCase = (title, specs, handId, scoringIdx, opts) =>
    test(title, () => {
      const cards = mks(specs);
      const r = opts ? Engine.evaluate(cards, opts) : Engine.evaluate(cards);
      assert.ok(r, 'evaluate returned null');
      assert.equal(r.handId, handId);
      deq(r.scoringUids, scoringIdx.map((i) => cards[i].uid));
    });

  evalCase('§2.2 Straight Flush: five suited cards in a run', '9H 10H JH QH KH', 'straightflush', [0, 1, 2, 3, 4]);
  evalCase('§2.2 Straight Flush: 10-J-Q-K-A suited', '10S JS QS KS AS', 'straightflush', [0, 1, 2, 3, 4]);
  evalCase('§2.2 Four of a Kind scores only the four matching cards', '7S 7H 2S 7D 7C', 'four', [0, 1, 3, 4]);
  evalCase('§2.2 four or more of one rank is Four of a Kind and scores every card of that rank', '7S 7H 7D 7C 7S', 'four', [0, 1, 2, 3, 4]);
  evalCase('§2.2 Full House: three plus two, all five score', 'KS 3C KH 3S KD', 'fullhouse', [0, 1, 2, 3, 4]);
  evalCase('§2.2 Flush: exactly five cards of one suit', '2H 5H 9H JH KH', 'flush', [0, 1, 2, 3, 4]);
  evalCase('§2.2 Straight: five distinct ranks in a run, in any play order', '9S 5S 7D 6H 8C', 'straight', [0, 1, 2, 3, 4]);
  evalCase('§2.2 Straight: A-2-3-4-5 plays the Ace low', '3D AS 5S 2H 4C', 'straight', [0, 1, 2, 3, 4]);
  evalCase('§2.2 Straight: no wrap-around, Q-K-A-2-3 is High Card on the Ace', 'QS KH AD 2C 3S', 'high', [2]);
  evalCase('§2.2 Straight and Flush need exactly five cards', '5H 6H 7H 8H', 'high', [3]);
  evalCase('§2.2 Three of a Kind scores the three', '8S KC 8H 2S 8D', 'three', [0, 2, 4]);
  evalCase('§2.2 Two Pair scores the four paired cards, not the kicker', '4S 9D KS 4H 9C', 'twopair', [0, 1, 3, 4]);
  evalCase('§2.2 Pair scores the two, in play order', '3D QS 7C QH 9S', 'pair', [1, 3]);
  evalCase('§2.2 High Card scores the single highest rank wherever it sits', '9H 2S KS 7D 4C', 'high', [2]);
  evalCase('§2.2 Masked flush: the other cards share one suit', '2H 5H 9H JH KS+scribbled', 'flush', [0, 1, 2, 3, 4]);
  evalCase('§2.2 Masked flush: every card Masked', '2S+scribbled 5H+scribbled 9D+scribbled JC+scribbled KS+scribbled', 'flush', [0, 1, 2, 3, 4]);
  evalCase('§2.2 Masked does not join two different suits', '2H 5H 9S JH KS+scribbled', 'high', [4]);
  evalCase('§2.2 Masked turns a suited run into a Straight Flush', '5H 6H 7H 8H 9S+scribbled', 'straightflush', [0, 1, 2, 3, 4]);
  evalCase('§2.2 strongest hand wins: Four of a Kind beats a Masked Flush', '7H 7S+scribbled 7D+scribbled 7C+scribbled 2H', 'four', [0, 1, 2, 3]);
  evalCase('§2.2 The Wash-Out disables Masked: no flush, High Card on the King', '2H 5H 9H JH KS+scribbled', 'high', [4], { washout: true });
  evalCase('§2.2 The Wash-Out leaves a natural Flush alone', '2H 5H 9H JH KH', 'flush', [0, 1, 2, 3, 4], { washout: true });
  evalCase('§2.2 a Cameo Seal card joins the scoring cards in play order', '2C+cameo KS 9D KH', 'pair', [0, 1, 3]);
  evalCase('§2.2 a Cameo Seal never changes the hand type', '2C+cameo 9D+cameo KS KH 4S', 'pair', [0, 1, 2, 3]);
  evalCase('§2.2 a Cameo card that already scores is listed once', 'KS+cameo KH', 'pair', [0, 1]);
  evalCase('§2.2 The Blackout stops Cameo Seals', '2C+cameo KS 9D KH', 'pair', [1, 3], { censor: true });

  test('§4.2 evaluate returns null for 0 or more than 5 cards, and for junk', () => {
    assert.equal(Engine.evaluate([]), null);
    assert.equal(Engine.evaluate(mks('2S 3S 4S 5S 6S 7S')), null);
    assert.equal(Engine.evaluate([{ rank: 1, suit: 'S' }]), null);
    assert.equal(Engine.evaluate(null), null);
  });

  const totalCase = (title, specs, handId, chips, mult, total) =>
    test(title, () => {
      const run = inBlind();
      const r = score(run, specs);
      deq(pick(r, ['handId', 'chips', 'mult', 'total']), { handId, chips, mult, total });
    });
  totalCase('§2.2 Straight Flush 9-K of Hearts at level 1 scores 159 x 8 = 1272', '9H 10H JH QH KH', 'straightflush', 159, 8, 1272);
  totalCase('§2.2 Four 7s with a kicker score 92 x 6 = 552', '7S 7H 7D 7C 2S', 'four', 92, 6, 552);
  totalCase('§2.2 Full House K-K-K-3-3 scores 80 x 4 = 320', 'KS KH KD 3C 3S', 'fullhouse', 80, 4, 320);
  totalCase('§2.2 Flush 2-5-9-J-K scores 74 x 4 = 296', '2H 5H 9H JH KH', 'flush', 74, 4, 296);
  totalCase('§2.2 A-2-3-4-5 Straight: the low Ace still gives 11 Chips, 59 x 4 = 236', 'AS 2H 3D 4C 5S', 'straight', 59, 4, 236);
  totalCase('§2.2 Three 8s score 56 x 3 = 168', '8S 8H 8D KC 2S', 'three', 56, 3, 168);
  totalCase('§2.2 Two Pair 4s and 9s score 48 x 2 = 96', '4S 4H 9D 9C KS', 'twopair', 48, 2, 96);
  totalCase('§2.2 Pair of Queens scores 32 x 2 = 64', 'QS QH 3D 7C 9S', 'pair', 32, 2, 64);
  totalCase('§2.2 High Card King scores 15 x 1 = 15', 'KS 9H 7D 4C 2S', 'high', 15, 1, 15);
  totalCase('§2.2 a Cameo card adds its Chips: Pair of Kings plus a 2 is 34 x 2 = 68', 'KS KH 2C+cameo', 'pair', 34, 2, 68);

  test('§2.2 unscored cards are played but add nothing', () => {
    const run = inBlind();
    const cards = mks('3D QS 7C QH 9S');
    const r = Engine.scoreCards(run, cards, []);
    deq(r.playedUids, uidsOf(cards));
    deq(r.scoringUids, [cards[1].uid, cards[3].uid]);
    deq(r.steps.filter((s) => s.source === 'card').map((s) => s.uid), [cards[1].uid, cards[3].uid]);
    assert.equal(r.total, 64);
  });

  test('§2.2 hand values at level L are base + (L - 1) x the v3 per-level values', () => {
    const run = fresh();
    for (const L of [1, 2, 5]) {
      for (const h of HAND_IDS) run.levels[h] = L;
      deq(
        Engine.handTable(run).map((t) => pick(t, ['handId', 'name', 'level', 'chips', 'mult'])),
        SPEC_HANDS.map((h) => ({ handId: h.id, name: h.name, level: L, chips: h.chips + (L - 1) * h.lchips, mult: h.mult + (L - 1) * h.lmult })),
        `level ${L}`,
      );
    }
    // by hand: High Card lv.2 = 17/2, Pair lv.3 = 44/4, Flush lv.2 = 56/6, Straight Flush lv.5 = 290/24
    run.levels.high = 2;
    run.levels.pair = 3;
    run.levels.flush = 2;
    run.levels.straightflush = 5;
    const t = Object.fromEntries(Engine.handTable(run).map((x) => [x.handId, [x.chips, x.mult]]));
    deq([t.high, t.pair, t.flush, t.straightflush], [[17, 2], [44, 4], [56, 6], [290, 24]]);
  });

  test('§2.2 scoring uses the hand level: Pair lv.3 of Kings scores 64 x 4 = 256', () => {
    const run = inBlind();
    run.levels.pair = 3;
    const r = score(run, 'KS KH');
    assert.equal(r.level, 3);
    deq(pick(r.steps[0], ['source', 'kind', 'label', 'runningChips', 'runningMult']), { source: 'base', kind: 'note', label: 'Pair lv.3', runningChips: 44, runningMult: 4 });
    assert.equal(r.total, 256);
  });
});

// =========================================================================================
describe('§2.3 A Blind', () => {
  test('§2.3 startBlind deals handSizeNow cards from a draw pile holding every deck card', () => {
    const run = fresh();
    const r = ok(Engine.startBlind(run));
    assert.equal(run.phase, 'play');
    const b = run.blind;
    deq(pick(b, ['kind', 'index', 'boss', 'target', 'score', 'handsLeft', 'discardsLeft', 'handSizeDelta', 'handsPlayed', 'discardsUsed', 'cardsDiscarded', 'hideRanks', 'wetJoker', 'grudgeHand']), {
      kind: 'small', index: 0, boss: null, target: 300, score: 0, handsLeft: 4, discardsLeft: 3, handSizeDelta: 0,
      handsPlayed: 0, discardsUsed: 0, cardsDiscarded: 0, hideRanks: false, wetJoker: null, grudgeHand: null,
    });
    assert.ok(!('tide' in b) && !('tideTurned' in b), 'no tide state');
    deq(b.log, []);
    assert.equal(b.hand.length, 8);
    assert.equal(b.draw.length, 44);
    deq(b.discardPile, []);
    deq(sorted(r.drawn), sorted(b.hand));
    deq(sorted([...b.hand, ...b.draw]), sorted(run.cards.map((c) => c.uid)));
    assert.notDeepEqual(plain(b.draw), plain(run.cards.map((c) => c.uid).filter((u) => b.draw.includes(u))), 'the draw pile is shuffled');
  });

  test('§2.3 playHand: handsLeft -1, cards to the discard pile, draw back up; no tide', () => {
    const run = inBlind();
    const played = setHand(run, ['AC', 'KD', 'JH', '9S', '7C', '5D', '3H', '2S']).slice(0, 5);
    const kept = run.blind.hand.slice(5);
    const r = ok(Engine.playHand(run, played));
    const b = run.blind;
    deq(pick(r, ['cleared', 'lost', 'won', 'fade', 'money', 'score']), { cleared: false, lost: false, won: false, fade: null, money: 0, score: 16 });
    assert.ok(!('tide' in r));
    assert.equal(r.result.handId, 'high');
    assert.equal(r.result.total, 16);
    deq([b.score, b.handsLeft, b.handsPlayed], [16, 3, 1]);
    deq(sorted(b.discardPile), sorted(played));
    assert.equal(b.hand.length, 8);
    assert.equal(r.drawn.length, 5);
    assert.equal(b.draw.length, 39);
    for (const u of kept) assert.ok(b.hand.includes(u), 'unplayed cards stay in hand');
    assert.equal(run.phase, 'play');
  });

  test('§2.3 play order is the order in the hand, whatever order the uids are passed in', () => {
    const run = inBlind();
    const sel = [run.blind.hand[1], run.blind.hand[4], run.blind.hand[6]];
    deq(ok(Engine.playHand(run, [...sel].reverse())).result.playedUids, sel);
  });

  test('§2.3 playHand scores exactly like scoreCards with the rest of the hand held', () => {
    const run = inBlind();
    Engine.addJoker(run, 'paperclip');
    Engine.addJoker(run, 'redhanded');
    const hand = run.blind.hand.slice();
    const played = hand.slice(5, 7);
    const expected = Engine.scoreCards(run, played.map((u) => cardOf(run, u)), hand.filter((u) => !played.includes(u)).map((u) => cardOf(run, u)));
    deq(ok(Engine.playHand(run, played)).result, plain(expected));
  });

  test('§2.3 the Blind log records each hand: handId, name, level, chips, mult, total, scoreAfter', () => {
    const run = inBlind();
    const [a] = setHand(run, ['AC']);
    ok(Engine.playHand(run, [a]));
    deq(run.blind.log.map((l) => pick(l, ['handId', 'name', 'level', 'chips', 'mult', 'total', 'scoreAfter'])), [
      { handId: 'high', name: 'High Card', level: 1, chips: 16, mult: 1, total: 16, scoreAfter: 16 },
    ]);
  });

  test('§2.3 cleared the moment score >= target after a hand; no draw, phase cashout', () => {
    const run = inBlind();
    const [a] = setHand(run, ['AC']);
    run.blind.score = run.blind.target - 16;
    const r = ok(Engine.playHand(run, [a]));
    deq(pick(r, ['cleared', 'lost', 'won', 'score']), { cleared: true, lost: false, won: false, score: 300 });
    deq(r.drawn, []);
    assert.equal(run.phase, 'cashout');
    assert.ok(run.cashout && Array.isArray(run.cashout.lines));
    assert.equal(run.blindStatus['1-0'], 'cleared');
    assert.equal(run.stats.blindsCleared, 1);
  });

  test('§2.3 one Chip short of the target is not cleared', () => {
    const run = inBlind();
    const [a] = setHand(run, ['AC']);
    run.blind.score = run.blind.target - 17;
    assert.equal(ok(Engine.playHand(run, [a])).cleared, false);
    assert.equal(run.blind.score, 299);
    assert.equal(run.phase, 'play');
  });

  test("§2.3 lost when handsLeft reaches 0 below the target: phase 'gameover'", () => {
    const run = inBlind();
    for (let i = 1; i <= 4; i++) {
      const r = ok(Engine.playHand(run, oneCard(run)));
      assert.equal(r.lost, i === 4, `hand ${i}`);
    }
    assert.equal(run.phase, 'gameover');
    assert.equal(run.won, false);
    fails(Engine.playHand(run, [run.cards[0].uid]));
  });

  test('§2.3 lost when nothing is left to play (hand and draw pile both empty)', () => {
    const run = fresh();
    run.cards = run.cards.slice(0, 3);
    ok(Engine.startBlind(run));
    assert.equal(run.blind.hand.length, 3);
    const r = ok(Engine.playHand(run, run.blind.hand.slice()));
    assert.equal(r.lost, true);
    assert.equal(run.phase, 'gameover');
  });

  test('§2.3 drawing back up never reshuffles the discard pile', () => {
    const run = fresh();
    run.cards = run.cards.slice(0, 10);
    ok(Engine.startBlind(run));
    const r1 = ok(Engine.playHand(run, setHand(run, ['AC', 'KD', 'JH', '9S', '7C'])));
    assert.equal(r1.drawn.length, 2);
    const r2 = ok(Engine.playHand(run, [run.blind.hand[0]]));
    deq(r2.drawn, []);
    deq([run.blind.hand.length, run.blind.draw.length, run.blind.discardPile.length], [4, 0, 6]);
  });

  test('§2.3 discard: discardsLeft -1, cards to the discard pile, draw back up', () => {
    const run = inBlind();
    const d = run.blind.hand.slice(0, 3);
    const r = ok(Engine.discard(run, d));
    deq(pick(r, ['cost', 'free', 'extra', 'money', 'created', 'lost']), { cost: 0, free: false, extra: null, money: 0, created: [], lost: false });
    assert.equal(r.drawn.length, 3);
    const b = run.blind;
    deq([b.discardsLeft, b.discardsUsed, b.cardsDiscarded, b.handsLeft, b.hand.length, b.draw.length], [2, 1, 3, 4, 8, 41]);
    deq(sorted(b.discardPile), sorted(d));
    assert.equal(run.stats.cardsDiscarded, 3);
    assert.equal(ok(Engine.discard(run, run.blind.hand.slice(0, 5))).drawn.length, 5, 'discarding 5 cards');
  });

  test('§2.3 discard with no discards left fails and changes nothing', () => {
    const run = inBlind();
    for (let i = 0; i < 3; i++) ok(Engine.discard(run, [run.blind.hand[0]]));
    const before = Engine.serialize(run);
    fails(Engine.discard(run, [run.blind.hand[0]]), 'discard', 'No discards left this Blind.');
    assert.equal(Engine.serialize(run), before);
  });

  test('§2.3 hand sorting: rank (rank desc, then S H C D) and suit (S H C D, then rank desc)', () => {
    const run = inBlind();
    ok(Engine.setSort(run, 'rank'));
    deq(run.blind.hand, handCards(run).slice().sort(rankCmp).map((c) => c.uid));
    ok(Engine.setSort(run, 'suit'));
    assert.equal(run.sortMode, 'suit');
    deq(run.blind.hand, handCards(run).slice().sort(suitCmp).map((c) => c.uid));
    ok(Engine.discard(run, run.blind.hand.slice(0, 4)));
    assertSorted(run, 'suit');
    ok(Engine.setSort(run, 'rank'));
    ok(Engine.playHand(run, oneCard(run)));
    assertSorted(run, 'rank');
  });

  test("§2.3 reordering sets 'manual'; new cards are then appended on the right", () => {
    const run = inBlind();
    const order = run.blind.hand.slice().reverse();
    ok(Engine.reorderHand(run, order));
    assert.equal(run.sortMode, 'manual');
    const r = ok(Engine.discard(run, order.slice(0, 2)));
    deq(run.blind.hand, [...order.slice(2), ...r.drawn]);
  });

  test('§2.3 hand size: Long Sleeves gives +1, and +1 more in Boss Blinds', () => {
    const run = fresh({ seed: 'MUSCLE01' });
    run.vouchers.push('musclecourse');
    run.handSize = 9; // its mods, as buying it applies them
    ok(Engine.startBlind(run));
    deq([Engine.handSizeNow(run), run.blind.hand.length], [9, 9]);
    run.phase = 'blind-select';
    run.blind = null;
    toBoss(run, 'heckler');
    deq([Engine.handSizeNow(run), run.blind.hand.length], [10, 10]);
  });

  test('§2.3 hands: Midnight Oil gives +1 every Blind, and +1 more in Boss Blinds', () => {
    const run = fresh({ seed: 'SPEED001' });
    run.vouchers.push('speedcourse');
    run.hands = 5;
    ok(Engine.startBlind(run));
    assert.equal(run.blind.handsLeft, 5);
    run.phase = 'blind-select';
    run.blind = null;
    toBoss(run, 'heckler');
    assert.equal(run.blind.handsLeft, 6);
  });
});

// =========================================================================================
describe('§2.4 Scoring order and the step trace (§4.3)', () => {
  test('§2.4 base, scored cards (rank, Enhancement, on-card Jokers), held cards (Spotlit, on-held Jokers), hand Jokers', () => {
    const run = inBlind();
    const sl = Engine.addJoker(run, 'oldstager');
    const cc = Engine.addJoker(run, 'papercrown');
    const kf = Engine.addJoker(run, 'paperclip');
    const an = Engine.addJoker(run, 'jinglejester');
    const played = mks('7C KS+inked QD KH 2S');
    const held = mks('9D+spotlit 4C');
    const [, ks, , kh] = played;
    const [d9, c4] = held;
    const N = nameMap({ ks, kh, d9, c4, sl, cc, kf, an });
    const r = Engine.scoreCards(run, played, held);
    deq(rows(r, N), [
      ['base', null, 'note', 0, 'Pair lv.1', 12, 2],
      ['card', 'ks', 'chips', 10, '+10', 22, 2],
      ['card', 'ks', 'chips', 35, '+35', 57, 2],
      ['joker', 'sl', 'chips', 2, '+2', 59, 2],
      ['joker', 'cc', 'chips', 12, '+12', 71, 2],
      ['card', 'kh', 'chips', 10, '+10', 81, 2],
      ['joker', 'sl', 'chips', 2, '+2', 83, 2],
      ['joker', 'cc', 'chips', 12, '+12', 95, 2],
      ['held', 'd9', 'mult', 3, '+3', 95, 5],
      ['joker', 'kf', 'chips', 5, '+5', 100, 5],
      ['joker', 'kf', 'chips', 5, '+5', 105, 5],
      ['joker', 'an', 'chips', 15, '+15', 120, 5],
      ['joker', 'an', 'mult', 3, '+3', 120, 8],
    ]);
    deq(r.steps.map((s) => s.via), [null, 'rank', 'enhancement', 'joker', 'joker', 'rank', 'joker', 'joker', 'enhancement', 'joker', 'joker', 'joker', 'joker']);
    deq(r.steps.filter((s) => s.source === 'joker').map((s) => N[s.cardUid] ?? null), ['ks', 'ks', 'kh', 'kh', 'd9', 'c4', null, null]);
    deq(pick(r, ['handId', 'name', 'level', 'booedUid', 'chips', 'mult', 'total', 'grow']), { handId: 'pair', name: 'Pair', level: 1, booedUid: null, chips: 120, mult: 8, total: 960, grow: [] });
    deq(r.scoringUids, [ks.uid, kh.uid]);
  });

  test('§2.4 Editions and Seals in the trace: card Edition after the Enhancement, Encore! passes, Joker Editions around the Joker', () => {
    const run = inBlind();
    const an = Engine.addJoker(run, 'jinglejester', 0, 'benday');
    const kr = Engine.addJoker(run, 'sableknave', 0, 'fourcolor');
    const played = mks('KS+gloss KH+encore');
    const held = mks('5D+spotlit+encore');
    const [ks, kh] = played;
    const [d5] = held;
    const N = nameMap({ ks, kh, d5, an, kr });
    const r = Engine.scoreCards(run, played, held);
    deq(rows(r, N), [
      ['base', null, 'note', 0, 'Pair lv.1', 12, 2],
      ['card', 'ks', 'chips', 10, '+10', 22, 2],
      ['card', 'ks', 'chips', 40, '+40', 62, 2],
      ['joker', 'kr', 'xmult', 1.1, '×1.1', 62, 2.2],
      ['card', 'kh', 'chips', 10, '+10', 72, 2.2],
      ['card', 'kh', 'note', 0, 'Encore!', 72, 2.2],
      ['card', 'kh', 'chips', 10, '+10', 82, 2.2],
      ['held', 'd5', 'mult', 3, '+3', 82, 5.2],
      ['held', 'd5', 'note', 0, 'Encore!', 82, 5.2],
      ['held', 'd5', 'mult', 3, '+3', 82, 8.2],
      ['joker', 'an', 'mult', 8, '+8', 82, 16.2],
      ['joker', 'an', 'chips', 15, '+15', 97, 16.2],
      ['joker', 'an', 'mult', 3, '+3', 97, 19.2],
      ['joker', 'kr', 'xmult', 1.6, '×1.6', 97, 30.72],
    ]);
    deq(tags(r, N), [
      [null, null, null, null, null],
      ['rank', null, null, null, null],
      ['edition', null, 'gloss', null, null],
      ['joker', null, null, null, null],
      ['rank', null, null, null, null],
      ['retrigger', null, null, 'encore', null],
      ['rank', null, null, null, null],
      ['enhancement', 'spotlit', null, null, null],
      ['retrigger', null, null, 'encore', null],
      ['enhancement', 'spotlit', null, null, null],
      ['edition', null, 'benday', null, null],
      ['joker', null, null, null, null],
      ['joker', null, null, null, null],
      ['edition', null, 'fourcolor', null, null],
    ]);
    assert.equal(r.total, 2979);
  });

  test('§4.3 every step has the same fields; the first is the base note', () => {
    const run = inBlind();
    Engine.addJoker(run, 'sableknave', 0, 'gloss');
    Engine.addJoker(run, 'goldtooth');
    const KEYS = ['source', 'uid', 'cardUid', 'kind', 'amount', 'label', 'via', 'enhancement', 'edition', 'seal', 'jokerUid', 'copyOf', 'jokerName', 'runningChips', 'runningMult'];
    for (const specs of ['AS+encore AH', '2S 4S+inked 6S 8S 10S+inverted', 'KS+vintage', '5H 6H 7H+popout 8H 9H+cameo']) {
      const r = score(run, specs, '9D+spotlit QC+encore');
      deq(pick(r.steps[0], ['source', 'kind', 'amount', 'uid', 'via', 'label']), { source: 'base', kind: 'note', amount: 0, uid: null, via: null, label: `${HAND_NAME[r.handId]} lv.1` });
      for (const s of r.steps) {
        deq(sorted(Object.keys(s)), sorted(KEYS), 'step fields');
        assert.ok(['base', 'card', 'held', 'joker', 'boss'].includes(s.source), `source ${s.source}`);
        assert.ok(['chips', 'mult', 'xmult', 'money', 'note'].includes(s.kind), `kind ${s.kind}`);
        assert.ok([null, 'rank', 'enhancement', 'edition', 'seal', 'joker', 'retrigger', 'boss'].includes(s.via), `via ${s.via}`);
        assert.equal(typeof s.amount, 'number');
        assert.equal(typeof s.label, 'string');
      }
      const last = r.steps[r.steps.length - 1];
      deq([r.chips, r.mult, r.total], [last.runningChips, last.runningMult, Math.floor(r.chips * r.mult + 1e-9)]);
    }
  });

  test('§2.4 Mult is rounded to 6 decimals after every operation (Sable Knave x1.1 on five Spades)', () => {
    const run = inBlind();
    const kr = Engine.addJoker(run, 'sableknave');
    const played = mks('2S 4S 6S 8S 10S');
    const N = nameMap({ kr, s2: played[0], s4: played[1], s6: played[2], s8: played[3], s10: played[4] });
    const r = Engine.scoreCards(run, played, []);
    deq(rows(r, N), [
      ['base', null, 'note', 0, 'Flush lv.1', 38, 4],
      ['card', 's2', 'chips', 2, '+2', 40, 4],
      ['joker', 'kr', 'xmult', 1.1, '×1.1', 40, 4.4],
      ['card', 's4', 'chips', 4, '+4', 44, 4.4],
      ['joker', 'kr', 'xmult', 1.1, '×1.1', 44, 4.84],
      ['card', 's6', 'chips', 6, '+6', 50, 4.84],
      ['joker', 'kr', 'xmult', 1.1, '×1.1', 50, 5.324],
      ['card', 's8', 'chips', 8, '+8', 58, 5.324],
      ['joker', 'kr', 'xmult', 1.1, '×1.1', 58, 5.8564],
      ['card', 's10', 'chips', 10, '+10', 68, 5.8564],
      ['joker', 'kr', 'xmult', 1.1, '×1.1', 68, 6.44204],
    ]);
    assert.equal(r.total, 438);
  });

  test('§2.4 total = floor(Chips x Mult + 1e-9): 30 x 4.1 gives 123, not 122', () => {
    const run = inBlind();
    Engine.addJoker(run, 'sableknave');
    Engine.addJoker(run, 'jinglejester');
    const r = score(run, 'KS');
    deq(r.steps.map((s) => [s.runningChips, s.runningMult]), [[5, 1], [15, 1], [15, 1.1], [30, 1.1], [30, 4.1]]);
    assert.equal(r.total, 123);
  });

  test('§2.4 Jokers act left to right: +8 then x1.5 differs from x1.5 then +8', () => {
    const run = inBlind();
    const wh = Engine.addJoker(run, 'partyhorn');
    const gs = Engine.addJoker(run, 'pokerface');
    jokerOf(run, gs.uid).state.x = 1.5;
    assert.equal(score(run, '2S').total, 94); // 7 x ((1 + 8) x 1.5)
    ok(Engine.reorderJokers(run, [gs.uid, wh.uid]));
    deq(run.jokers.map((j) => j.uid), [gs.uid, wh.uid]);
    const r = score(run, '2S');
    deq(r.steps.slice(-2).map((s) => [s.kind, s.runningMult]), [['xmult', 1.5], ['mult', 9.5]]);
    assert.equal(r.total, 66);
  });

  test('§2.4 scoreCards is pure: step money is only added when the hand is played', () => {
    const run = inBlind();
    Engine.addJoker(run, 'goldtooth');
    const before = Engine.serialize(run);
    const r = score(run, 'AS AH+dimestore');
    deq(r.steps.filter((s) => s.kind === 'money').map((s) => [s.source, s.amount, s.label]), [['joker', 1, '+$1'], ['card', 1, '+$1'], ['joker', 1, '+$1']]);
    assert.equal(Engine.serialize(run), before);
    const [a, b] = setHand(run, ['AS', 'AH+dimestore']);
    const money = run.money;
    const res = ok(Engine.playHand(run, [a, b]));
    assert.equal(res.money, 3);
    assert.equal(run.money, money + 3);
  });

  test('§2.4 Joker Editions: Sheen and Dither just before the Joker, Glitch just after, even when the Joker gives nothing', () => {
    const run = inBlind();
    const cc = Engine.addJoker(run, 'papercrown', 0, 'gloss');
    let r = score(run, '2S'); // no face card: Paper Crown itself gives nothing
    deq(r.steps.filter((s) => s.uid === cc.uid).map((s) => [s.kind, s.amount, s.via, s.edition]), [['chips', 40, 'edition', 'gloss']]);
    assert.equal(r.total, 47);
    const run2 = inBlind();
    Engine.addJoker(run2, 'jinglejester', 0, 'benday');
    assert.equal(score(run2, '2S').total, 264); // (7 + 15) x (1 + 8 + 3)
    const run3 = inBlind();
    Engine.addJoker(run3, 'jinglejester', 0, 'fourcolor');
    assert.equal(score(run3, '2S').total, 140); // 22 x (4 x 1.6)
    Engine.addJoker(run3, 'partyhorn');
    assert.equal(score(run3, '2S').total, 316); // 22 x (6.4 + 8)
  });

  test('§2.4 an Phantom Joker has no scoring step of its own Edition', () => {
    const run = inBlind();
    const an = Engine.addJoker(run, 'jinglejester', 0, 'inverted');
    const r = score(run, '2S');
    deq(r.steps.filter((s) => s.uid === an.uid).map((s) => s.via), ['joker', 'joker']);
    assert.equal(r.total, 88);
  });

  test('§3.4 a Joker word the engine does not know never fires', () => {
    const run = inBlind({}, XEngine);
    XEngine.addJoker(run, 'testunknown');
    assert.equal(score(run, '2S', '', XEngine).total, 7);
  });
});

// =========================================================================================
describe('§3.1 Enhancements', () => {
  const enhCase = (title, played, held, total, ownSteps) =>
    test(title, () => {
      const run = inBlind();
      const r = score(run, played, held);
      assert.equal(r.total, total);
      if (ownSteps) deq(r.steps.filter((s) => s.via === 'enhancement').map((s) => [s.source, s.kind, s.amount, s.label]), ownSteps);
    });
  enhCase('§3.1 Waxed: +35 Chips when scored (50)', 'KS+inked', '', 50, [['card', 'chips', 35, '+35']]);
  enhCase('§3.1 Kindled: +5 Mult when scored (15 x 6 = 90)', 'KS+punchy', '', 90, [['card', 'mult', 5, '+5']]);
  enhCase('§3.1 Gilt-Edged: +$1 when scored', 'KS+dimestore', '', 15, [['card', 'money', 1, '+$1']]);
  enhCase('§3.1 Sequined: x1.4 Mult when scored (15 x 1.4 = 21)', 'KS+popout', '', 21, [['card', 'xmult', 1.4, '×1.4']]);
  enhCase('§3.1 Masked: +10 Chips when scored (25)', 'KS+scribbled', '', 25, [['card', 'chips', 10, '+10']]);
  enhCase('§3.1 Spotlit: +3 Mult while held in hand (7 x 4 = 28)', '2S', 'KD+spotlit', 28, [['held', 'mult', 3, '+3']]);
  enhCase('§3.1 a played Spotlit card gives nothing', 'KD+spotlit', '', 15, []);
  enhCase('§3.1 an unscored card with an Enhancement gives nothing', 'KS KH 2C+inked', '', 64, []);
  enhCase('§3.1 Vintage: its first-ever score gives +4 (19)', 'KS+vintage', '', 19, [['card', 'chips', 4, '+4']]);
  enhCase('§3.1 Vintage with 8 stored Chips gives +12 (27)', 'KS+vintage+grow8', '', 27, [['card', 'chips', 12, '+12']]);
  enhCase('§3.1 Crumpled has no scoring step', 'KS+crumpled', '', 15, []);

  test('§3.1 the Spotlit step points at the held card and names its Enhancement', () => {
    const run = inBlind();
    const held = mks('KD+spotlit 3C');
    const step = score(run, '2S', held).steps.find((s) => s.source === 'held');
    deq(pick(step, ['uid', 'kind', 'amount', 'via', 'enhancement', 'runningChips', 'runningMult']), { uid: held[0].uid, kind: 'mult', amount: 3, via: 'enhancement', enhancement: 'spotlit', runningChips: 7, runningMult: 4 });
  });

  test('§3.1 a Gilt-Edged card pays $1 when the hand is played', () => {
    const run = inBlind();
    const [p] = setHand(run, ['KS+dimestore']);
    const m = run.money;
    ok(Engine.playHand(run, [p]));
    assert.equal(run.money, m + 1);
  });

  test('§3.1 Vintage: scoreCards reports the growth, playHand stores it, and the next score is bigger', () => {
    const run = inBlind();
    const [v] = setHand(run, ['KS+vintage']);
    const r = Engine.scoreCards(run, [cardOf(run, v)], []);
    deq(r.grow, [{ uid: v, by: 4 }]);
    assert.equal(cardOf(run, v).grow, 0, 'scoreCards changes nothing');
    ok(Engine.playHand(run, [v]));
    assert.equal(cardOf(run, v).grow, 4);
    const again = Engine.scoreCards(run, [cardOf(run, v)], []);
    assert.equal(again.total, 5 + 10 + 8);
    deq(again.grow, [{ uid: v, by: 4 }]);
  });

  test('§3.1 a retriggered Vintage card grows twice in one hand (+4, then +8)', () => {
    const run = inBlind();
    const card = mk('KS+vintage+encore');
    const r = Engine.scoreCards(run, [card], []);
    deq(r.steps.filter((s) => s.via === 'enhancement').map((s) => s.amount), [4, 8]);
    assert.equal(r.total, 5 + 10 + 4 + 10 + 8);
    deq(r.grow, [{ uid: card.uid, by: 8 }]);
  });

  test('§3.1 Crumpled: +$1 for each Crumpled card discarded', () => {
    const run = inBlind();
    const [a, b] = setHand(run, ['KS+crumpled', 'QS+crumpled', '2C']);
    const m = run.money;
    const earned = run.stats.moneyEarned;
    const r = ok(Engine.discard(run, [a, b, run.blind.hand[2]]));
    assert.equal(r.money, 2);
    assert.equal(run.money, m + 2);
    assert.equal(run.stats.moneyEarned, earned + 2);
  });

  test('§3.1 a card holds one Enhancement; applying another replaces it', () => {
    const run = inBlind();
    const [u] = setHand(run, ['KS+inked']);
    ok(Engine.useConsumable(run, give(run, 'tarot', 'boxingglove'), [u]));
    assert.equal(cardOf(run, u).enhancement, 'punchy');
  });
});

// =========================================================================================
describe('§3.2 Editions', () => {
  const edCase = (title, played, total, edSteps) =>
    test(title, () => {
      const run = inBlind();
      const r = score(run, played);
      assert.equal(r.total, total);
      if (edSteps) deq(r.steps.filter((s) => s.edition).map((s) => [s.via, s.kind, s.amount, s.edition]), edSteps);
    });
  edCase('§3.2 Sheen card: +40 Chips when scored (55)', 'KS+gloss', 55, [['edition', 'chips', 40, 'gloss']]);
  edCase('§3.2 Dither card: +8 Mult when scored (15 x 9 = 135)', 'KS+benday', 135, [['edition', 'mult', 8, 'benday']]);
  edCase('§3.2 Glitch card: x1.6 Mult when scored (15 x 1.6 = 24)', 'KS+fourcolor', 24, [['edition', 'xmult', 1.6, 'fourcolor']]);
  edCase('§3.2 Phantom card: its rank scores as Mult (5 x 11 = 55)', 'KS+inverted', 55, [['rank', 'mult', 10, 'inverted']]);
  edCase('§3.2 Phantom Ace keeps its Enhancement: (5 + 35) x (1 + 11) = 480', 'AS+inverted+inked', 480, [['rank', 'mult', 11, 'inverted']]);
  edCase('§3.2 the Edition comes after the Enhancement: 15 x ((1 + 5) x 1.6) = 144', 'KS+punchy+fourcolor', 144, [['edition', 'xmult', 1.6, 'fourcolor']]);
  edCase('§3.2 the Edition fires on every pass: 5 + 10 + 40 + 10 + 40 = 105', 'KS+gloss+encore', 105, [['edition', 'chips', 40, 'gloss'], ['edition', 'chips', 40, 'gloss']]);

  test('§3.2 an Phantom Joker takes no Joker slot; jokerSlotsUsed counts the others', () => {
    const run = fresh();
    for (const id of ['jinglejester', 'pipsqueak', 'gingerbreadfool', 'partyhorn']) assert.ok(Engine.addJoker(run, id));
    const inv = Engine.addJoker(run, 'emptyseats', 0, 'inverted');
    assert.ok(inv);
    assert.equal(Engine.jokerSlotsUsed(run), 4);
    assert.ok(Engine.addJoker(run, 'papercrown'), 'the fifth slot is still free');
    assert.equal(Engine.jokerSlotsUsed(run), 5);
    assert.equal(Engine.addJoker(run, 'pinwheel'), null, 'slots full');
    assert.ok(Engine.addJoker(run, 'doubleact', 0, 'inverted'), 'an Phantom Joker fits anyway');
    deq([run.jokers.length, Engine.jokerSlotsUsed(run)], [7, 5]);
  });

  test('§3.2 editionInfo describes each Edition; unknown ids give null', () => {
    for (const [id, [name, surcharge]] of Object.entries(SPEC_EDITIONS)) {
      const info = Engine.editionInfo(id);
      deq(pick(info, ['id', 'name', 'surcharge']), { id, name, surcharge });
      for (const k of ['text', 'jokerText', 'cardText']) assert.ok(typeof info[k] === 'string' && info[k].length > 0, `${id}.${k}`);
    }
    assert.equal(Engine.editionInfo('nope'), null);
  });
});

// =========================================================================================
describe('§3.3 Seals', () => {
  test('§3.3 Encore Seal: a scored card runs twice, with an Encore! note', () => {
    const run = inBlind();
    const card = mk('KS+encore');
    const r = Engine.scoreCards(run, [card], []);
    deq(r.steps.map((s) => [s.source, s.kind, s.label, s.via, s.seal]), [
      ['base', 'note', 'High Card lv.1', null, null],
      ['card', 'chips', '+10', 'rank', null],
      ['card', 'note', 'Encore!', 'retrigger', 'encore'],
      ['card', 'chips', '+10', 'rank', null],
    ]);
    assert.equal(r.total, 25);
  });

  test('§3.3 Encore Seal: held-in-hand effects fire twice (Spotlit, The Paperclip)', () => {
    const run = inBlind();
    assert.equal(score(run, '2S', 'KD+spotlit+encore').total, 49); // 7 x (1 + 3 + 3)
    Engine.addJoker(run, 'paperclip');
    assert.equal(score(run, '2S', 'KD+encore').total, 17); // 7 + 5 + 5
  });

  test('§3.3 a held Encore card with nothing to give adds no step', () => {
    const run = inBlind();
    const r = score(run, '2S', 'KD+encore');
    deq(r.steps.map((s) => s.source), ['base', 'card']);
    assert.equal(r.total, 7);
  });

  test('§3.3 Paid Seal: +$2 at cash-out per Paid Seal card in hand when the Blind is beaten', () => {
    const run = inBlind();
    run.money = 10;
    cardOf(run, run.blind.hand[1]).seal = 'paid';
    cardOf(run, run.blind.hand[2]).seal = 'paid';
    forceClear(run);
    deq(run.cashout.lines, [
      { label: 'Small Blind', amount: 3 },
      { label: 'Hands to spare', amount: 3 },
      { label: 'Paid Seals', amount: 4 },
      { label: 'Interest', amount: 2 },
    ]);
    deq(sorted(run.blind.heldAtClear), sorted(run.blind.hand));
    assert.equal(run.cashout.total, 12);
  });

  test('§3.3 a Paid Seal card that is played does not pay', () => {
    const run = inBlind();
    cardOf(run, run.blind.hand[0]).seal = 'paid'; // forceClear plays hand[0]
    forceClear(run);
    assert.ok(!run.cashout.lines.some((l) => l.label === 'Paid Seals'));
  });

  test('§3.3 Comet Seal: discarding it creates a Planet card for your most-played hand', () => {
    const run = inBlind();
    run.plays.flush = 2;
    run.plays.pair = 1;
    const [a] = setHand(run, ['KS+airmail']);
    const r = ok(Engine.discard(run, [a]));
    assert.equal(r.created.length, 1);
    deq(pick(run.consumables.find((k) => k.uid === r.created[0]), ['kind', 'id']), { kind: 'planet', id: 'swoosh' });
    assert.ok(run.discovered.consumables.includes('swoosh'));
  });

  test('§3.3 Comet Seal: with nothing played yet, a random Planet; with full slots, nothing', () => {
    const run = inBlind();
    const [a, b] = setHand(run, ['KS+airmail', 'QS+airmail']);
    const r = ok(Engine.discard(run, [a, b]));
    assert.equal(r.created.length, 2);
    for (const uid of r.created) assert.ok(run.consumables.find((k) => k.uid === uid).id in SPEC_PLANETS);
    assert.equal(run.consumables.length, 2);
    const [c] = setHand(run, ['JS+airmail']);
    deq(ok(Engine.discard(run, [c])).created, [], 'no free consumable slot');
    assert.equal(run.consumables.length, 2);
  });

  test('§3.3 Cameo Seal: the card scores with a Cameo note, even outside the poker hand', () => {
    const run = inBlind();
    const played = mks('KS KH 2C+cameo');
    const r = Engine.scoreCards(run, played, []);
    deq(r.scoringUids, uidsOf(played));
    deq(r.steps.slice(-2).map((s) => [s.uid, s.kind, s.label, s.via, s.seal]), [
      [played[2].uid, 'note', 'Cameo', 'seal', 'cameo'],
      [played[2].uid, 'chips', '+2', 'rank', null],
    ]);
    assert.equal(r.total, 68);
  });

  test('§3.3 sealInfo describes each Seal; unknown ids give null', () => {
    for (const [id, name] of Object.entries(SPEC_SEALS)) deq(pick(Engine.sealInfo(id), ['id', 'name']), { id, name });
    assert.equal(Engine.sealInfo('nope'), null);
  });
});

// =========================================================================================
describe('§3.4 Jokers', () => {
  // [id, title, setup(run, joker), played, held, total, jokerSteps [kind, amount, label], cardRefs]
  const cases = [
    ['jinglejester', '+15 Chips and +3 Mult as two steps', null, '2S', '', 88, [['chips', 15, '+15'], ['mult', 3, '+3']]],
    ['pipsqueak', '+45 Chips with 2 cards played', null, 'KS KH', '', 154, [['chips', 45, '+45']]],
    ['pipsqueak', 'nothing with 3 cards played', null, 'KS KH 2C', '', 64, []],
    ['pipsqueak', 'counts every played card, scored or not', null, 'AS 5D', '', 61, [['chips', 45, '+45']]],
    ['gingerbreadfool', '+60 Chips while fresh', null, '2S', '', 67, [['chips', 60, '+60']]],
    ['partyhorn', '+8 Mult on the first hand of a Blind', null, '2S', '', 63, [['mult', 8, '+8']]],
    ['partyhorn', 'nothing on a later hand', (r) => { r.blind.handsPlayed = 1; }, '2S', '', 7, []],
    ['papercrown', 'scored face cards give +12 Chips', null, 'QS QH', '', 112, [['chips', 12, '+12'], ['chips', 12, '+12']], ['p0', 'p1']],
    ['papercrown', 'Aces are not face cards', null, 'AS AH', '', 68, []],
    ['emptyseats', '+2 Mult per empty Joker slot (4 empty)', null, '2S', '', 63, [['mult', 8, '+8']]],
    ['pinwheel', 'counts suits among scored cards only', null, 'KS KH 5D 7C 2S', '', 256, [['mult', 6, '+6']]],
    ['pinwheel', 'four suits give +12 Mult', null, '4S 4H 9D 9C KS', '', 672, [['mult', 12, '+12']]],
    ['pinwheel', 'a Masked card counts as all four suits', null, 'KS+scribbled KH', '', 588, [['mult', 12, '+12']]],
    ['doubleact', 'Pair: one pair, +4', null, 'KS KH', '', 192, [['mult', 4, '+4']]],
    ['doubleact', 'Two Pair: +8', null, '4S 4H 9D 9C', '', 480, [['mult', 8, '+8']]],
    ['doubleact', 'Three of a Kind: floor(3/2) = 1, +4', null, '8S 8H 8D', '', 392, [['mult', 4, '+4']]],
    ['doubleact', 'Full House: +8', null, 'KS KH KD 3C 3S', '', 960, [['mult', 8, '+8']]],
    ['doubleact', 'Four of a Kind: floor(4/2) = 2, +8', null, '7S 7H 7D 7C', '', 1288, [['mult', 8, '+8']]],
    ['doubleact', 'a Straight has no pairs', null, '5S 6H 7D 8C 9S', '', 276, []],
    ['tallyowl', '+1 Mult per 4 hands played this run (9 played: +2)', (r) => { r.stats.handsPlayed = 9; }, '2S', '', 21, [['mult', 2, '+2']]],
    ['tallyowl', '3 hands played gives nothing yet', (r) => { r.stats.handsPlayed = 3; }, '2S', '', 7, []],
    ['magpie', 'adds its stored Chips', (r, j) => { j.state.chips = 40; }, '2S', '', 47, [['chips', 40, '+40']]],
    ['sableknave', 'a Masked card counts as a Spade (42 x 2.2 = 92)', null, 'KH+scribbled KD', '', 92, [['xmult', 1.1, '×1.1']], ['p0']],
    ['redhanded', 'each held Heart or Diamond (Masked counts) gives +2 Mult', null, '2S', '5H 6D 7C 8S+scribbled', 49, [['mult', 2, '+2'], ['mult', 2, '+2'], ['mult', 2, '+2']], ['h0', 'h1', 'h3']],
    ['congaline', 'x1.5 on a Straight', null, '5S 6H 7D 8C 9S', '', 414, [['xmult', 1.5, '×1.5']]],
    ['congaline', 'x1.5 on a Straight Flush', null, '5H 6H 7H 8H 9H', '', 1740, [['xmult', 1.5, '×1.5']]],
    ['congaline', 'nothing on a Flush', null, '2H 5H 9H JH KH', '', 296, []],
    ['moneybags', '+1 Mult per $4 held ($13: +3)', (r) => { r.money = 13; }, '2S', '', 28, [['mult', 3, '+3']]],
    ['moneybags', '$3 held gives nothing', (r) => { r.money = 3; }, '2S', '', 7, []],
    ['openingact', 'the first scoring card gives +20 Chips and +2 Mult', null, '2C KS KH', '', 208, [['chips', 20, '+20'], ['mult', 2, '+2']], ['p1', 'p1']],
    ['finalbow', 'the last scoring card gives x1.5 Mult', null, 'KS KH 2C', '', 96, [['xmult', 1.5, '×1.5']], ['p1']],
    // Balance 2026-11-23 (Jokers, engine fix): +1 Mult for every 2 cards discarded (was every card)
    ['chimneysweep', '+1 Mult for every 2 cards discarded this Blind', (r) => { r.blind.cardsDiscarded = 5; }, '2S', '', 21, [['mult', 2, '+2']]],
    ['goldtooth', 'scored Aces give +$1', null, 'AS AH', '', 68, [['money', 1, '+$1'], ['money', 1, '+$1']], ['p0', 'p1']],
    ['oldstager', '+2 Chips per Ante per scored card (Ante 1)', null, 'KS KH', '', 72, [['chips', 2, '+2'], ['chips', 2, '+2']], ['p0', 'p1']],
    ['oldstager', 'Ante 3 gives +6 per scored card', (r) => { r.ante = 3; }, 'KS KH', '', 88, [['chips', 6, '+6'], ['chips', 6, '+6']], ['p0', 'p1']],
    ['paperclip', 'each held card gives +5 Chips', null, '2S', '3C 4C 5C', 22, [['chips', 5, '+5'], ['chips', 5, '+5'], ['chips', 5, '+5']], ['h0', 'h1', 'h2']],
    ['lamplighter', 'has no scoring step', null, 'KH KS', '', 64, []],
    ['couponclipper', 'has no scoring step', null, '2S', '', 7, []],
    ['sleightofhand', 'has no scoring step', null, '2S', '', 7, []],
    ['bigtop', 'x2.5 on a Full House', null, 'KS KH KD 3C 3S', '', 800, [['xmult', 2.5, '×2.5']]],
    ['bigtop', 'x2.5 on Four of a Kind', null, '7S 7H 7D 7C', '', 1380, [['xmult', 2.5, '×2.5']]],
    ['bigtop', 'x2.5 on a Straight Flush', null, '5H 6H 7H 8H 9H', '', 2900, [['xmult', 2.5, '×2.5']]],
    ['bigtop', 'nothing on a Flush', null, '2H 5H 9H JH KH', '', 296, []],
    ['pokerface', 'no step while x is 1', null, '2S', '', 7, []],
    ['pokerface', 'x1.25 after one clean clear (7 x 1.25 = 8)', (r, j) => { j.state.x = 1.25; }, '2S', '', 8, [['xmult', 1.25, '×1.25']]],
    ['dragontamer', 'x1.5 after one Boss Blind (7 x 1.5 = 10)', (r, j) => { j.state.x = 1.5; }, '2S', '', 10, [['xmult', 1.5, '×1.5']]],
    ['fortunecookie', 'scored cards of the marked rank give +$2', (r, j) => { j.state.rank = 12; }, 'QS QH', '', 64, [['money', 2, '+$2'], ['money', 2, '+$2']], ['p0', 'p1']],
  ];
  for (const [id, title, setup, played, held, total, jokerSteps, cardRefs] of cases) {
    test(`§3.4 ${SPEC_JOKERS[id][0]}: ${title}`, () => {
      const run = inBlind();
      const joker = Engine.addJoker(run, id);
      assert.ok(joker, `addJoker(${id})`);
      if (setup) setup(run, jokerOf(run, joker.uid));
      const p = mks(played);
      const h = mks(held);
      const r = Engine.scoreCards(run, p, h);
      assert.equal(r.total, total);
      const own = r.steps.filter((s) => s.uid === joker.uid);
      if (jokerSteps) deq(own.map((s) => [s.kind, s.amount, s.label]), jokerSteps);
      for (const s of own) deq([s.source, s.via], ['joker', 'joker']);
      if (cardRefs) {
        const refs = { ...Object.fromEntries(p.map((c, i) => [c.uid, `p${i}`])), ...Object.fromEntries(h.map((c, i) => [c.uid, `h${i}`])) };
        deq(own.map((s) => refs[s.cardUid] ?? null), cardRefs);
      }
    });
  }

  test('§3.4 addJoker gives the starting state from the content row', () => {
    const run = fresh();
    run.jokerSlots = 10;
    const st = (id) => plain(Engine.addJoker(run, id).state);
    deq([st('gingerbreadfool').chips, st('magpie').chips, st('pokerface').x, st('dragontamer').x], [60, 0, 1, 1]);
    const tm = st('fortunecookie');
    assert.ok(Number.isInteger(tm.rank) && tm.rank >= 2 && tm.rank <= 14, `Fortune Cookie rank ${tm.rank}`);
    deq(st('jinglejester'), {});
  });

  test('§3.4 addJoker records paid (0 by default) and the Edition, and returns null when the slots are full', () => {
    const run = fresh();
    deq(pick(Engine.addJoker(run, 'jinglejester'), ['id', 'paid', 'edition']), { id: 'jinglejester', paid: 0, edition: null });
    deq(pick(Engine.addJoker(run, 'pipsqueak', 6, 'gloss'), ['paid', 'edition']), { paid: 6, edition: 'gloss' });
    for (const id of ['gingerbreadfool', 'partyhorn', 'emptyseats']) assert.ok(Engine.addJoker(run, id));
    assert.equal(run.jokers.length, 5);
    assert.equal(Engine.addJoker(run, 'sleightofhand'), null);
    assert.equal(Engine.addJoker(run, 'nope'), null);
    assert.equal(run.jokers.length, 5);
  });

  test("§3.4 Gingerbread Fool loses 15 Chips each Blind you clear and is eaten at 0", () => {
    const run = fresh({ seed: 'BISCUIT1' });
    const bi = Engine.addJoker(run, 'gingerbreadfool');
    clearAndLeave(run);
    assert.equal(jokerOf(run, bi.uid).state.chips, 45);
    ok(Engine.startBlind(run));
    assert.equal(score(run, '2S').total, 52);
    forceClear(run);
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    assert.equal(jokerOf(run, bi.uid).state.chips, 30);
    clearAndLeave(run);
    assert.equal(jokerOf(run, bi.uid).state.chips, 15);
    skip(run, 'piggybank');
    assert.equal(jokerOf(run, bi.uid).state.chips, 15, 'skipping is not clearing');
    toShop(run);
    assert.equal(jokerOf(run, bi.uid), undefined, 'eaten at 0');
  });

  test('§3.4 the eaten Joker is reported by the clearing hand', () => {
    const run = inBlind();
    const bi = Engine.addJoker(run, 'gingerbreadfool');
    jokerOf(run, bi.uid).state.chips = 15;
    deq(forceClear(run).eaten, [bi.uid]);
  });

  // The plan changed this number (content check): v2 Fishhook made the first discard of each Blind
  // free; Sleight of Hand makes one discard of 1 or 2 cards free, once per Blind.
  test('§3.4 Sleight of Hand: once per Blind, a discard of 1 or 2 cards is free (the plan changed v2 Fishhook\'s first discard)', () => {
    const run = fresh();
    Engine.addJoker(run, 'sleightofhand');
    ok(Engine.startBlind(run));
    deq(pick(ok(Engine.discard(run, [run.blind.hand[0]])), ['free', 'cost']), { free: true, cost: 0 });
    deq([run.blind.discardsLeft, run.blind.freeDiscardUsed], [3, true]);
    assert.equal(ok(Engine.discard(run, [run.blind.hand[0]])).free, false, 'once per Blind');
    assert.equal(run.blind.discardsLeft, 2);
    clearAndLeave(run);
    ok(Engine.startBlind(run));
    assert.equal(ok(Engine.discard(run, run.blind.hand.slice(0, 3))).free, false, 'a discard of 3 cards is not free, even the first');
    assert.equal(run.blind.discardsLeft, 2);
    assert.equal(ok(Engine.discard(run, run.blind.hand.slice(0, 2))).free, true, 'the free discard waited for a small one');
    assert.equal(run.blind.discardsLeft, 2);
    run.blind.discardsLeft = 0;
    fails(Engine.discard(run, [run.blind.hand[0]]), 'no discards left', 'No discards left this Blind.');
  });

  test('§3.4 the rule word freeFirstDiscard (the v2 Fishhook row, kept in the vocabulary): the first discard of each Blind is free', () => {
    const run = fresh({}, XEngine);
    XEngine.addJoker(run, 'testfirstfree');
    ok(XEngine.startBlind(run));
    deq(pick(ok(XEngine.discard(run, run.blind.hand.slice(0, 5))), ['free', 'cost']), { free: true, cost: 0 });
    assert.equal(run.blind.discardsLeft, 3);
    assert.equal(ok(XEngine.discard(run, [run.blind.hand[0]])).free, false);
    assert.equal(run.blind.discardsLeft, 2);
    clearAndLeave(run, XEngine);
    ok(XEngine.startBlind(run));
    assert.equal(ok(XEngine.discard(run, [run.blind.hand[0]])).free, true);
  });

  test('§3.4 Coupon Clipper: a cash-out line of $1 per unused discard', () => {
    const run = inBlind();
    Engine.addJoker(run, 'couponclipper');
    ok(Engine.discard(run, [run.blind.hand[0]]));
    forceClear(run);
    deq(run.cashout.lines.find((l) => l.label === 'Coupon Clipper'), { label: 'Coupon Clipper', amount: 2 });
    const run2 = inBlind();
    Engine.addJoker(run2, 'couponclipper');
    for (let i = 0; i < 3; i++) ok(Engine.discard(run2, [run2.blind.hand[0]]));
    forceClear(run2);
    assert.ok(!run2.cashout.lines.some((l) => l.label === 'Coupon Clipper'), 'a $0 line is left out');
  });

  test('§3.4 Empty Seats counts empty Joker slots; an Phantom Joker leaves its slot empty', () => {
    const run = inBlind();
    Engine.addJoker(run, 'emptyseats');
    Engine.addJoker(run, 'couponclipper');
    const fh = Engine.addJoker(run, 'sleightofhand');
    assert.equal(score(run, '2S').total, 35); // 2 empty: 7 x 5
    run.jokerSlots = 6;
    assert.equal(score(run, '2S').total, 49); // 3 empty
    jokerOf(run, fh.uid).edition = 'inverted';
    assert.equal(score(run, '2S').total, 63); // 4 empty
  });

  test('§3.4 Tally Owl uses the hands played before this hand, through real plays', () => {
    const run = fresh({ seed: 'QUILL001' });
    const q = Engine.addJoker(run, 'tallyowl');
    ok(Engine.startBlind(run));
    for (let i = 0; i < 3; i++) ok(Engine.playHand(run, oneCard(run)));
    const r4 = forceClear(run);
    assert.ok(!r4.result.steps.some((s) => s.uid === q.uid), 'the 4th hand sees only 3 hands played');
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    ok(Engine.startBlind(run));
    assert.equal(score(run, '2S').total, 14);
  });

  // Balance 2026-11-23 (Jokers, engine fix): the cap is +50 (was +100; the review's simulation).
  test('§3.4 Magpie gains +2 Chips per discarded card, up to +50', () => {
    const run = fresh();
    const nm = Engine.addJoker(run, 'magpie');
    ok(Engine.startBlind(run));
    ok(Engine.discard(run, run.blind.hand.slice(0, 3)));
    assert.equal(jokerOf(run, nm.uid).state.chips, 6);
    ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    assert.equal(jokerOf(run, nm.uid).state.chips, 10);
    assert.equal(score(run, '2S').total, 17);
    jokerOf(run, nm.uid).state.chips = 48;
    ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    assert.equal(jokerOf(run, nm.uid).state.chips, 50);
  });

  test('§3.4 Chimney Sweep counts the cards discarded this Blind, through real discards', () => {
    const run = fresh();
    Engine.addJoker(run, 'chimneysweep');
    ok(Engine.startBlind(run));
    ok(Engine.discard(run, run.blind.hand.slice(0, 2)));
    ok(Engine.discard(run, run.blind.hand.slice(0, 3)));
    assert.equal(score(run, '2S').total, 21, '5 cards discarded: +2 Mult (every 2 cards; balance 2026-11-23)');
    clearAndLeave(run);
    ok(Engine.startBlind(run));
    assert.equal(score(run, '2S').total, 7, 'a new Blind starts from 0');
  });

  test('§3.4 Opening Act and Final Bow give nothing when their card is booed by The Heckler', () => {
    const run = fresh();
    const fh = Engine.addJoker(run, 'openingact');
    const cc = Engine.addJoker(run, 'finalbow');
    toBoss(run, 'heckler');
    const pair = mks('KS KH');
    const r = Engine.scoreCards(run, pair, []);
    assert.equal(r.booedUid, pair[0].uid);
    assert.ok(!r.steps.some((s) => s.uid === fh.uid), 'the first scoring card is booed: no Opening Act');
    deq(r.steps.filter((s) => s.uid === cc.uid).map((s) => [s.kind, s.amount, s.cardUid]), [['xmult', 1.5, pair[1].uid]]);
    assert.equal(r.total, 66);
    const straight = mks('5S 6H 7D 8C 9S');
    const r2 = Engine.scoreCards(run, straight, []);
    assert.equal(r2.booedUid, straight[4].uid);
    assert.ok(!r2.steps.some((s) => s.uid === cc.uid), 'the last scoring card is booed: no Final Bow');
    assert.equal(r2.total, 480); // (34 + 5 + 20 + 6 + 7 + 8) x (4 + 2)
  });

  test("§3.4 Lamplighter: scored Hearts with no Enhancement become Kindled after the hand", () => {
    const run = fresh();
    Engine.addJoker(run, 'lamplighter');
    ok(Engine.startBlind(run));
    const [kh, ks, h2] = setHand(run, ['KH', 'KS', '2H']);
    const r = ok(Engine.playHand(run, [kh, ks, h2]));
    assert.equal(r.result.total, 64, 'the new Kindled does not count in the same hand');
    deq(r.enhanced, [kh]);
    deq([cardOf(run, kh).enhancement, cardOf(run, ks).enhancement, cardOf(run, h2).enhancement], ['punchy', null, null]);
    const [ah] = setHand(run, ['AH+inked']);
    ok(Engine.playHand(run, [ah]));
    assert.equal(cardOf(run, ah).enhancement, 'inked', 'an enhanced Heart keeps its Enhancement');
  });

  test('§3.4 Gold Tooth and Fortune Cookie pay their money when the hand is played', () => {
    const run = fresh();
    Engine.addJoker(run, 'goldtooth');
    const map = Engine.addJoker(run, 'fortunecookie');
    ok(Engine.startBlind(run));
    jokerOf(run, map.uid).state.rank = 12;
    let m = run.money;
    ok(Engine.playHand(run, setHand(run, ['AS', 'AH'])));
    assert.equal(run.money, m + 2);
    m = run.money;
    ok(Engine.playHand(run, setHand(run, ['QS', 'QH'])));
    assert.equal(run.money, m + 4);
  });

  test('§3.4 Fortune Cookie re-rolls its rank at Blind start', () => {
    const run = fresh();
    const map = Engine.addJoker(run, 'fortunecookie');
    jokerOf(run, map.uid).state.rank = 99;
    ok(Engine.startBlind(run));
    const rank = jokerOf(run, map.uid).state.rank;
    assert.ok(Number.isInteger(rank) && rank >= 2 && rank <= 14, `rank ${rank}`);
  });

  test('§3.4 Poker Face gains x0.25 for each Blind cleared without discarding', () => {
    const run = fresh({ seed: 'GHOSTSHP' });
    const gs = Engine.addJoker(run, 'pokerface');
    clearAndLeave(run);
    assert.equal(jokerOf(run, gs.uid).state.x, 1.25);
    ok(Engine.startBlind(run));
    assert.equal(score(run, '2S').total, 8);
    ok(Engine.discard(run, [run.blind.hand[0]]));
    forceClear(run);
    assert.equal(jokerOf(run, gs.uid).state.x, 1.25, 'a Blind with a discard does not count');
  });

  test('§3.4 Dragon Tamer gains x0.5 for each Boss Blind cleared', () => {
    const run = fresh({ seed: 'SERPENT1' });
    const ss = Engine.addJoker(run, 'dragontamer');
    clearAndLeave(run);
    assert.equal(jokerOf(run, ss.uid).state.x, 1, 'a Small Blind does not count');
    skip(run, 'piggybank');
    clearAndLeave(run);
    assert.equal(jokerOf(run, ss.uid).state.x, 1.5);
  });

  test('§3.4 jokerText appends live values in parentheses where the row asks for them', () => {
    const textOf = (id) => entry(Content.JOKERS, id).text;
    const check = (id, setup, re) => {
      const r = inBlind();
      const j = Engine.addJoker(r, id);
      if (setup) setup(r, jokerOf(r, j.uid));
      const text = Engine.jokerText(r, j.uid);
      assert.ok(text.startsWith(textOf(id)), `${id}: ${text}`);
      if (re) assert.match(text, re, `${id}: ${text}`);
      else assert.equal(text, textOf(id));
    };
    check('jinglejester', null, null);
    check('gingerbreadfool', null, /\(now \+60 Chips\)$/);
    check('gingerbreadfool', (r, j) => { j.state.chips = 45; }, /now \+45/);
    check('emptyseats', null, /now \+8/);
    check('tallyowl', (r) => { r.stats.handsPlayed = 9; }, /now \+2/);
    check('magpie', (r, j) => { j.state.chips = 6; }, /now \+6/);
    check('moneybags', (r) => { r.money = 13; }, /now \+3/);
    check('chimneysweep', (r) => { r.blind.cardsDiscarded = 4; }, /now \+2/); // every 2 cards (balance 2026-11-23)
    check('pokerface', (r, j) => { j.state.x = 1.25; }, /now ×1\.25/);
    check('dragontamer', (r, j) => { j.state.x = 1.5; }, /now ×1\.5/);
    check('fortunecookie', (r, j) => { j.state.rank = 12; }, /\(named: Queens\)$/);
    check('moneybags', (r) => { r.money = 13; }, /\(now \+3 Mult\)$/);
    // The plan added live text to Old Stager (v2 Sounding Line had none).
    check('oldstager', (r) => { r.ante = 3; }, /\(now \+6 Chips per card\)$/);
    const run = fresh();
    const br = Engine.addJoker(run, 'chimneysweep');
    assert.equal(Engine.jokerText(run, br.uid), textOf('chimneysweep'), 'no live value outside a Blind');
    assert.equal(Engine.jokerText(run, 'h99999'), '');
  });

  test('§3.4 the Joker vocabulary: a Joker made only of data (minPlayed, per playedCards) works', () => {
    const run = inBlind({}, XEngine);
    XEngine.addJoker(run, 'testvocab');
    assert.equal(score(run, 'KS KH 2C', '', XEngine).total, 352); // 32 x (2 + 3 x 3)
    assert.equal(score(run, 'KS KH', '', XEngine).total, 64);
  });

  test('§3.4 Joker retriggers: extra passes for scored cards, stacking after an Encore Seal', () => {
    const run = inBlind({}, XEngine);
    const tf = XEngine.addJoker(run, 'testface');
    const played = 'KS+encore KH 2C'.split(' ').map((s) => mkWith(XEngine, s));
    const r = XEngine.scoreCards(run, played, []);
    deq(r.steps.filter((s) => s.label === 'Encore!').map((s) => [s.uid, s.seal, s.jokerUid]), [
      [played[0].uid, 'encore', null],
      [played[0].uid, null, tf.uid],
      [played[1].uid, null, tf.uid],
    ]);
    assert.equal(r.total, 124); // (12 + 3 x 10 + 2 x 10) x 2
  });

  test('§3.4 Joker retriggers for held cards: twice means two Encore! passes', () => {
    const run = inBlind({}, XEngine);
    XEngine.addJoker(run, 'testheld');
    const r = score(run, '2S', 'KD+spotlit', XEngine);
    assert.equal(r.steps.filter((s) => s.label === 'Encore!').length, 2);
    assert.equal(r.total, 70); // 7 x (1 + 3 + 3 + 3)
  });

  test('§3.4 every Joker row uses only words the engine knows (Engine.jokerProblems)', () => {
    for (const row of list(Content.JOKERS)) deq(Engine.jokerProblems(row), [], row.id);
    const xrows = list(vm.runInContext('TW.Content.JOKERS', xcontext));
    deq(xrows.filter((row) => XEngine.jokerProblems(row).length).map((row) => row.id), ['testunknown']);
    deq(sorted(Object.keys(Engine.VOCABULARY)), ['amounts', 'conditions', 'counters', 'eventOps', 'events', 'on', 'rules', 'setters']);
    assert.ok(Engine.VOCABULARY.conditions.includes('stateRank') && Engine.VOCABULARY.counters.includes('scoredSuits'));
  });

  test('§3.4 jokerProblems names each unknown word in a broken row', () => {
    const bad = {
      id: 'broken', name: 'Broken', text: 'Nothing works.', rarity: 'mythic', cost: 3,
      effects: [{ on: 'sometimes', when: { moonPhase: true }, chips: 5, per: 'stars' }, { on: 'hand' }],
      events: { onTuesday: [{ grow: 1 }], blindStart: [{ set: { rank: 'luckyRank' } }] },
      rules: { fly: true },
    };
    deq(Engine.jokerProblems(bad), [
      "unknown rarity 'mythic'",
      "effects[0]: unknown on 'sometimes'",
      "effects[0]: unknown condition 'moonPhase'",
      "effects[0]: unknown counter 'stars'",
      'effects[1]: no chips, mult, xmult or money',
      "unknown event 'onTuesday'",
      "onTuesday: unknown operation 'grow'",
      "blindStart: unknown setter 'luckyRank'",
      "unknown rule 'fly'",
    ]);
    deq(Engine.jokerProblems(null), ['not a Joker row']);
  });
});

// =========================================================================================
describe('§3.9 Boss Blinds', () => {
  test('§3.9 Antes 1-7 roll distinct Boss Blinds allowed at that Ante; Ante 8 is always The Big Finish', () => {
    const seen = new Set();
    for (let i = 0; i < 150; i++) {
      const run = Engine.newRun({ seed: `BOSSES${i}` });
      const ids = [];
      for (let a = 1; a <= 7; a++) {
        const id = run.bosses[a];
        assert.ok(id in SPEC_BOSSES && id !== 'bigfinish', `Ante ${a}: ${id}`);
        assert.ok(SPEC_BOSSES[id][1] <= a, `${id} is not allowed at Ante ${a}`);
        ids.push(id);
        seen.add(id);
      }
      assert.equal(new Set(ids).size, 7, 'distinct');
      assert.equal(run.bosses[8], 'bigfinish');
    }
    deq(sorted(seen), sorted(Object.keys(SPEC_BOSSES).filter((id) => id !== 'bigfinish')), 'all 14 others appear');
  });

  test('§3.9 the Boss Blind uses the Ante boss; Small and Big Blinds have none', () => {
    const run = fresh();
    const infos = Engine.blindsForAnte(run);
    deq(infos.map((w) => (w.boss ? w.boss.id : null)), [null, null, run.bosses[1]]);
    ok(Engine.startBlind(run));
    assert.equal(run.blind.boss, null);
  });

  test('§3.9 The Heckler boos the highest-ranked scoring card (leftmost on ties): it scores nothing', () => {
    const run = toBoss(fresh(), 'heckler');
    const pair = mks('KS KH');
    const r = Engine.scoreCards(run, pair, []);
    deq(rows(r, nameMap({ ks: pair[0], kh: pair[1] })), [
      ['base', null, 'note', 0, 'Pair lv.1', 12, 2],
      ['boss', 'ks', 'note', 0, 'Booed', 12, 2],
      ['card', 'kh', 'chips', 10, '+10', 22, 2],
    ]);
    assert.equal(r.steps[1].via, 'boss');
    deq([r.booedUid, r.total], [pair[0].uid, 44]);
    const qq = mks('QS KH QD');
    assert.equal(Engine.scoreCards(run, qq, []).booedUid, qq[0].uid, 'the unscored King is not booed');
  });

  test('§3.9 The Heckler: a booed card skips its retriggers, and a Cameo card can be booed', () => {
    const run = toBoss(fresh(), 'heckler');
    const r = score(run, 'KS+encore KH');
    assert.ok(!r.steps.some((s) => s.label === 'Encore!'));
    assert.equal(r.total, 44);
    const cards = mks('KS KH AC+cameo');
    const r2 = Engine.scoreCards(run, cards, []);
    deq([r2.booedUid, r2.total], [cards[2].uid, 64]);
    assert.ok(!r2.steps.some((s) => s.label === 'Cameo'));
  });

  test('§3.9 The Lid caps Mult at 12, after Joker Editions', () => {
    const run = fresh();
    Engine.addJoker(run, 'jinglejester', 0, 'benday');
    toBoss(run, 'lid');
    const r = score(run, 'KS KH'); // Mult 2 + 8 + 3 = 13
    deq(rows(r, {}).slice(-1), [['boss', null, 'note', 0, 'Capped at 12', 47, 12]]);
    assert.equal(r.total, 564);
    assert.ok(!score(run, '2S').steps.some((s) => s.source === 'boss'), 'no step when Mult is 12 or less');
  });

  // Balance 2026-11-23 (Jokers, engine fix): a flat 12 ended nearly every run that met it from Ante 5 on.
  test('§3.9 The Lid: the cap rises by 6 for each Ante after Ante 3 (18 at Ante 4, 36 at Ante 7, 48 at Endless Ante 9), and the Blind info shows it', () => {
    const capAt = (ante) => {
      const run = fresh();
      run.levels.pair = 60; // a Pair of Kings: Mult 2 + 59 = 61
      Object.assign(run, { ante, blindIndex: 2, endless: ante > 8 });
      run.bosses[ante] = 'lid';
      const info = Engine.currentBlindInfo(run);
      ok(Engine.startBlind(run));
      const r = score(run, 'KS KH');
      return [r.mult, r.steps.filter((s) => s.source === 'boss').map((s) => s.label), info.boss.text];
    };
    const text = entry(Content.BOSSES, 'lid').text.replace(/\.$/, '');
    deq(capAt(3), [12, ['Capped at 12'], `${text} (now 12).`]);
    deq(capAt(4), [18, ['Capped at 18'], `${text} (now 18).`]);
    deq(capAt(7), [36, ['Capped at 36'], `${text} (now 36).`]);
    deq(capAt(9), [48, ['Capped at 48'], `${text} (now 48).`]);
    assert.equal(Engine.blindsForAnte(fresh())[2].boss.text, entry(Content.BOSSES, fresh().bosses[1]).text, 'other Boss Blinds keep their text');
  });
  test('§3.9 toAnte (added 2026-11-23, balance; no row uses it): a Boss Blind row with toAnte is never rolled after that Ante', () => {
    const E2 = vm.runInContext('TW.Engine', makeContext(null, "TW.Content.BOSSES.find((b) => b.id === 'lid').toAnte = 4;"));
    const late = [];
    let early = 0;
    for (let s = 0; s < 300; s++) {
      const run = E2.newRun({ seed: `TOANTE${s}` });
      for (let a = 1; a <= 7; a++) if (run.bosses[a] === 'lid') { if (a > 4) late.push(`TOANTE${s}@${a}`); else early++; }
    }
    deq(late, [], 'no Lid after Ante 4');
    assert.ok(early > 0, 'The Lid still comes at Antes 3 and 4');
  });

  test('§3.9 The Shuffler: after every hand the whole hand goes back into the deck and a fresh hand is drawn', () => {
    const run = toBoss(fresh(), 'shuffler');
    const b = run.blind;
    const played = [b.hand[0]];
    const r = ok(Engine.playHand(run, played));
    deq([r.drawn.length, b.hand.length, b.discardPile.length, b.draw.length], [8, 8, 1, 43]);
    deq(sorted([...b.hand, ...b.draw, ...b.discardPile]), sorted(run.cards.map((c) => c.uid)));
  });

  test('§3.9 The Fade: before each hand after the first, the score drops to floor(score x 0.85)', () => {
    const run = toBoss(fresh(), 'fade');
    const [a] = setHand(run, ['2C']);
    const r1 = ok(Engine.playHand(run, [a]));
    assert.equal(r1.fade, null);
    run.blind.score = 101;
    const [c] = setHand(run, ['2D']);
    const r2 = ok(Engine.playHand(run, [c]));
    deq(r2.fade, { before: 101, after: 85 });
    assert.equal(run.blind.score, 85 + 7);
  });

  test('§3.9 The Tollbooth: each discard costs $2; discarding is blocked below $2', () => {
    const run = toBoss(fresh(), 'tollbooth');
    run.money = 3;
    const r = ok(Engine.discard(run, [run.blind.hand[0]]));
    deq([r.cost, run.money], [2, 1]);
    fails(Engine.discard(run, [run.blind.hand[0]]), 'discard', 'The Tollbooth: each discard costs $2.');
    fails(Engine.canDiscard(run), 'canDiscard', 'The Tollbooth: each discard costs $2.');
  });

  test('§3.9 The Smudge sets blind.hideRanks', () => {
    assert.equal(toBoss(fresh(), 'smudge').blind.hideRanks, true);
    assert.equal(inBlind().blind.hideRanks, false);
  });

  // Balance 2026-11-23 (Jokers, engine fix): at most 4 cards (was 3)
  test('§3.9 The Squeeze: at most 4 cards per hand; discards are unchanged', () => {
    const run = toBoss(fresh(), 'squeeze');
    const hand = run.blind.hand;
    fails(Engine.playHand(run, hand.slice(0, 5)), 'playHand', 'The Squeeze: play at most 4 cards.');
    fails(Engine.canPlay(run, hand.slice(0, 5)), 'canPlay', 'The Squeeze: play at most 4 cards.');
    ok(Engine.discard(run, run.blind.hand.slice(0, 5)));
    ok(Engine.canPlay(run, run.blind.hand.slice(0, 4)));
    ok(Engine.playHand(run, run.blind.hand.slice(0, 4)));
  });

  test("§3.9 The Wash-Out: Enhancements do nothing, Masked's any-suit rule included", () => {
    const run = fresh();
    Engine.addJoker(run, 'sableknave');
    toBoss(run, 'washout');
    assert.equal(score(run, 'KD+inked KH+punchy').total, 64);
    assert.equal(score(run, '2D', 'KD+spotlit').total, 7);
    assert.equal(score(run, '2H 5H 9H JH KS+scribbled').handId, 'high');
    const v = score(run, 'KD+vintage');
    deq([v.total, v.grow], [15, []]);
    assert.equal(score(run, 'KH+scribbled').total, 15, 'not a Spade for Sable Knave either');
    assert.ok(!score(run, 'KS+dimestore').steps.some((s) => s.kind === 'money'));
    const [c] = setHand(run, ['KS+crumpled']);
    assert.equal(ok(Engine.discard(run, [c])).money, 0);
    assert.equal(Engine.preview(run, setHand(run, ['2H', '5H', '9H', 'JH', 'KS+scribbled'])).handId, 'high');
  });

  test('§3.9 The Wet Blanket switches off the Joker leftmost at Blind start for the whole Blind, Edition included', () => {
    const run = fresh();
    const a = Engine.addJoker(run, 'jinglejester', 0, 'gloss');
    const g = Engine.addJoker(run, 'pipsqueak');
    toBoss(run, 'wetblanket');
    assert.equal(run.blind.wetJoker, a.uid);
    let r = score(run, 'KS KH');
    assert.ok(!r.steps.some((s) => s.uid === a.uid), 'no steps from the switched-off Joker or its Edition');
    assert.ok(r.steps.some((s) => s.uid === g.uid));
    ok(Engine.reorderJokers(run, [g.uid, a.uid]));
    r = score(run, 'KS KH');
    assert.ok(!r.steps.some((s) => s.uid === a.uid), 'still off after reordering');
    assert.ok(r.steps.some((s) => s.uid === g.uid), 'the new leftmost Joker still works');
    assert.equal(toBoss(fresh(), 'wetblanket').blind.wetJoker, null, 'no Jokers: nothing marked');
  });

  test('§3.9 a Joker switched off by The Wet Blanket does nothing at all (Sleight of Hand, Magpie)', () => {
    const run = fresh();
    const fh = Engine.addJoker(run, 'sleightofhand');
    const nm = Engine.addJoker(run, 'magpie');
    toBoss(run, 'wetblanket');
    assert.equal(ok(Engine.discard(run, run.blind.hand.slice(0, 2))).free, false, 'a 2-card discard, free if Sleight of Hand worked');
    assert.equal(jokerOf(run, nm.uid).state.chips, 4, 'Magpie still works');
    assert.ok(jokerOf(run, fh.uid));
  });

  test('§3.9 The Spoilsport halves Mult for the most-played hand (Pair when nothing has been played; ties to the stronger)', () => {
    const run = fresh();
    toBoss(run, 'grudge');
    assert.equal(run.blind.grudgeHand, 'pair');
    const r = score(run, 'KS KH');
    deq(r.steps.slice(-1).map((s) => [s.source, s.kind, s.amount, s.label]), [['boss', 'xmult', 0.5, 'Half Mult']]);
    assert.equal(r.total, 32);
    assert.equal(score(run, '2S').total, 7);
    const run2 = fresh();
    run2.plays.flush = 3;
    run2.plays.pair = 3;
    toBoss(run2, 'grudge');
    assert.equal(run2.blind.grudgeHand, 'flush');
  });

  test('§3.9 The Blackout: Editions and Seals do nothing; an Phantom card scores Chips', () => {
    const run = fresh();
    Engine.addJoker(run, 'jinglejester', 0, 'gloss');
    toBoss(run, 'censor');
    assert.equal(score(run, 'KS+gloss').total, 120, 'no card Edition step: (5 + 10 + 15) x (1 + 3)');
    assert.equal(score(run, 'KS+inverted').total, 120, 'the rank gives Chips as normal');
    assert.ok(!score(run, '2S').steps.some((s) => s.via === 'edition'), 'no Joker Edition step');
    const enc = score(run, 'KS+encore');
    assert.ok(!enc.steps.some((s) => s.label === 'Encore!'));
    deq(score(run, 'KS KH 2C+cameo').scoringUids.length, 2);
  });

  test('§3.9 The Blackout: no Paid Seal money, no Airmail Planet; an Phantom Joker still takes no slot', () => {
    const run = fresh();
    for (const id of ['pipsqueak', 'gingerbreadfool', 'partyhorn', 'emptyseats', 'papercrown']) Engine.addJoker(run, id);
    Engine.addJoker(run, 'jinglejester', 0, 'inverted');
    toBoss(run, 'censor');
    assert.equal(Engine.jokerSlotsUsed(run), 5);
    const [m] = setHand(run, ['KS+airmail']);
    deq(ok(Engine.discard(run, [m])).created, []);
    cardOf(run, run.blind.hand[1]).seal = 'paid';
    forceClear(run);
    assert.ok(!run.cashout.lines.some((l) => l.label === 'Paid Seals'));
  });

  test('§3.9 The Warm-Up: the first hand of the Blind scores half', () => {
    const run = toBoss(fresh(), 'warmup');
    const r1 = score(run, 'KS KH');
    deq(r1.steps.slice(-1).map((s) => [s.source, s.kind, s.amount, s.label]), [['boss', 'xmult', 0.5, 'Warm-up: half']]);
    assert.equal(r1.total, 32);
    ok(Engine.playHand(run, oneCard(run)));
    assert.equal(score(run, 'KS KH').total, 64);
  });

  test('§3.9 The Fumble: each discard also drops 1 random unselected card, a discard in every way', () => {
    const run = fresh();
    const nm = Engine.addJoker(run, 'magpie');
    toBoss(run, 'fumble');
    for (const u of run.blind.hand) cardOf(run, u).enhancement = 'crumpled';
    const sel = [run.blind.hand[0]];
    const r = ok(Engine.discard(run, sel));
    assert.ok(r.extra && r.extra !== sel[0] && run.blind.discardPile.includes(r.extra), 'an extra card is discarded');
    deq([run.blind.cardsDiscarded, run.blind.discardsLeft, r.money, jokerOf(run, nm.uid).state.chips], [2, 2, 2, 4]);
    deq(sorted(run.blind.discardPile), sorted([sel[0], r.extra]));
    const run2 = fresh();
    run2.cards = run2.cards.slice(0, 2);
    toBoss(run2, 'fumble');
    assert.equal(ok(Engine.discard(run2, run2.blind.hand.slice())).extra, null, 'no unselected card to drop');
  });

  test('§3.9 The Short Fuse: 2 fewer hands (at least 1) and a 25% lower target', () => {
    const run = fresh();
    advanceToAnte(run, 2);
    toBoss(run, 'shortfuse');
    deq([run.blind.handsLeft, run.blind.target], [2, 1050]);
    const run2 = fresh();
    run2.hands = 2;
    toBoss(run2, 'shortfuse');
    assert.equal(run2.blind.handsLeft, 1);
  });

  test('§3.9 The Big Finish: Ante 8 Boss Blind, target x1.5, and the hand is shuffled back after every hand', () => {
    const run = fresh({ seed: 'BIGFIN01' });
    run.ante = 8;
    assert.equal(Engine.blindsForAnte(run)[2].target, 135000);
    toBoss(run);
    deq([run.blind.boss, run.blind.target], ['bigfinish', 135000]);
    const r = ok(Engine.playHand(run, [run.blind.hand[0]]));
    assert.equal(r.drawn.length, 8);
  });
});

// =========================================================================================
describe('§2.6 Antes, Blinds, targets and rewards', () => {
  for (const stake of Object.keys(SPEC_STAKES)) {
    test(`§2.6 targets for every Blind of Antes 1-8 on ${SPEC_STAKES[stake]}`, () => {
      const run = fresh({ stake });
      for (let a = 1; a <= 7; a++) run.bosses[a] = 'heckler'; // a Boss Blind with no target rule
      for (let a = 1; a <= 8; a++) for (let i = 0; i < 3; i++) assert.equal(Engine.blindTarget(run, a, i), TARGETS[stake][a - 1][i], `Ante ${a} Blind ${i}`);
      run.bosses[7] = 'shortfuse';
      assert.equal(Engine.blindTarget(run, 7, 2), Math.round((TARGETS[stake][6][2] * 0.75) / 10) * 10, 'The Short Fuse: x0.75');
    });
  }

  test('§2.6 endless targets: round(45000 x 1.75^(n-8) / 100) x 100', () => {
    deq([9, 10, 11, 12].map((n) => Engine.anteBaseTarget(n)), [78800, 137800, 241200, 422100]);
  });

  test('§2.6 startBlind uses the same target (Ante 2 Big Blind on Last Candle Stake is 1470)', () => {
    const run = fresh({ stake: 'yikes' });
    advanceToAnte(run, 2);
    skip(run, 'piggybank');
    ok(Engine.startBlind(run));
    assert.equal(run.blind.target, 1470);
  });

  test('§2.6 Head Start Tag on a Small Blind: round(300 x 0.75 / 10) x 10 = 230', () => {
    const run = fresh();
    run.pending.targetMult = 0.75;
    assert.equal(Engine.currentBlindInfo(run).target, 230);
    ok(Engine.startBlind(run));
    assert.equal(run.blind.target, 230);
  });

  test('§2.6 rewards are $3, $4, $5; the High Roller Deck gets $1 less on each', () => {
    deq(Engine.blindsForAnte(fresh()).map((w) => w.reward), [3, 4, 5]);
    deq(Engine.blindsForAnte(fresh({ deckId: 'mintcondition' })).map((w) => w.reward), [2, 3, 4]);
  });

  test('§4.2 blindsForAnte describes each Blind with its Boss Blind, Tag and status', () => {
    const run = fresh();
    const infos = Engine.blindsForAnte(run);
    deq(infos.map((w) => pick(w, ['index', 'kind', 'name', 'target', 'reward', 'status'])), [
      { index: 0, kind: 'small', name: 'Small Blind', target: 300, reward: 3, status: 'current' },
      { index: 1, kind: 'big', name: 'Big Blind', target: 450, reward: 4, status: 'upcoming' },
      { index: 2, kind: 'boss', name: 'Boss Blind', target: 600, reward: 5, status: 'upcoming' },
    ]);
    deq(infos[0].tag, pick(entry(Content.TAGS, run.tags['1-0']), ['id', 'name', 'text']));
    assert.equal(infos[2].tag, null);
    deq(infos[2].boss, pick(entry(Content.BOSSES, run.bosses[1]), ['id', 'name', 'text']));
    skip(run, 'piggybank');
    deq(Engine.blindsForAnte(run).map((w) => w.status), ['skipped', 'current', 'upcoming']);
    deq(pick(Engine.currentBlindInfo(run), ['index', 'kind']), { index: 1, kind: 'big' });
  });

  test("§2.6 You win! on beating Ante 8's Boss Blind; Endless mode goes on to Ante 9", () => {
    const run = fresh({ seed: 'WINNER01' });
    run.ante = 8;
    toBoss(run);
    const r = forceClear(run);
    deq(pick(r, ['cleared', 'won']), { cleared: true, won: true });
    deq([run.phase, run.won, run.endless], ['win', true, false]);
    assert.ok(run.cashout.total > 0);
    ok(Engine.goEndless(run));
    deq([run.phase, run.endless], ['cashout', true]);
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    deq([run.ante, run.blindIndex, run.phase], [9, 0, 'blind-select']);
    assert.ok(run.bosses[9] && run.bosses[9] !== 'bigfinish');
    assert.ok(run.tags['9-0'] in SPEC_TAGS && run.tags['9-1'] in SPEC_TAGS);
    assert.equal(Engine.currentBlindInfo(run).target, 78800);
  });

  test('§3.9 endless Antes roll any Boss Blind except The Big Finish', () => {
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const run = fresh({ seed: `ENDLESS${i}` });
      run.ante = 8;
      run.blindIndex = 2;
      run.phase = 'shop';
      run.endless = true;
      ok(Engine.leaveShop(run));
      seen.add(run.bosses[9]);
    }
    assert.ok(!seen.has('bigfinish'));
    assert.ok(seen.size >= 8, `only ${seen.size} different endless bosses`);
  });
});

// =========================================================================================
describe('§2.7 Cash-out', () => {
  test('§2.7 lines in order: Blind reward, Hands to spare, Paid Seals, Interest, Joker lines; collect opens the Shop', () => {
    const run = inBlind();
    Engine.addJoker(run, 'couponclipper');
    run.money = 14;
    cardOf(run, run.blind.hand[1]).seal = 'paid';
    forceClear(run);
    deq(run.cashout.lines, [
      { label: 'Small Blind', amount: 3 },
      { label: 'Hands to spare', amount: 3 },
      { label: 'Paid Seals', amount: 2 },
      { label: 'Interest', amount: 2 },
      { label: 'Coupon Clipper', amount: 3 },
    ]);
    assert.equal(run.cashout.total, 13);
    const r = ok(Engine.collect(run));
    deq([r.total, run.money, run.phase, run.blind, run.cashout], [13, 27, 'shop', null, null]);
  });

  test('§2.7 $0 lines are left out: no interest under $5 and no hands to spare on the last hand', () => {
    const run = inBlind();
    run.money = 4;
    run.blind.handsLeft = 1;
    forceClear(run);
    deq(run.cashout.lines, [{ label: 'Small Blind', amount: 3 }]);
  });

  test('§2.7 the Blind name and reward: Big $4, Boss $5; Mint Condition $3', () => {
    const run = fresh();
    skip(run, 'piggybank');
    run.money = 0;
    ok(Engine.startBlind(run));
    run.blind.handsLeft = 1;
    forceClear(run);
    deq(run.cashout.lines, [{ label: 'Big Blind', amount: 4 }]);
    const boss = toBoss(fresh());
    boss.money = 0;
    boss.blind.handsLeft = 1;
    forceClear(boss);
    deq(boss.cashout.lines, [{ label: 'Boss Blind', amount: 5 }]);
    const mint = fresh({ deckId: 'mintcondition' });
    skip(mint, 'piggybank');
    mint.money = 0;
    ok(Engine.startBlind(mint));
    mint.blind.handsLeft = 1;
    forceClear(mint);
    deq(mint.cashout.lines, [{ label: 'Big Blind', amount: 3 }]);
  });

  const interestOf = (setup) => {
    const run = inBlind();
    setup(run);
    return Engine.interestPreview(run);
  };
  test('§2.7 interest: $1 per full $5 held, up to $5', () => {
    deq([4, 5, 14, 25, 99].map((m) => interestOf((r) => { r.money = m; })), [0, 1, 2, 5, 5]);
  });
  test('§2.7 Savings Bond raises the interest cap by $3', () => {
    deq([25, 40, 99].map((m) => interestOf((r) => { r.money = m; r.vouchers.push('savingsbond'); })), [5, 8, 8]);
  });
  test('§2.7 Last Candle Stake caps interest at $3, and Savings Bond still adds $3', () => {
    const at = (m, bond) => {
      const run = inBlind({ stake: 'yikes' });
      run.money = m;
      if (bond) run.vouchers.push('savingsbond');
      return Engine.interestPreview(run);
    };
    deq([at(25, false), at(99, false), at(99, true)], [3, 3, 6]);
  });

  test('§2.7 the Interest line counts the money held before this payout, step money included', () => {
    const run = inBlind();
    Engine.addJoker(run, 'goldtooth');
    run.money = 9;
    run.blind.score = run.blind.target - 1;
    ok(Engine.playHand(run, setHand(run, ['AS'])));
    assert.equal(run.money, 10);
    assert.equal(run.cashout.lines.find((l) => l.label === 'Interest').amount, 2);
  });
});

// =========================================================================================
describe('§2.8 Shop', () => {
  const basePrice = (it, deck = 'firstissue') => {
    switch (it.kind) {
      case 'joker': return SPEC_JOKERS[it.id][2] + (it.edition ? SPEC_EDITIONS[it.edition][1] : 0);
      case 'tarot': return deck === 'sketchbook' ? 2 : 3;
      case 'planet': return 3;
      case 'spectral': return 4;
      case 'pack': return SPEC_PACKS[it.id][5];
      case 'voucher': return 10;
      default: return NaN;
    }
  };
  /** A run in its first Shop with the given Voucher on offer, and money to spend. */
  function shopWithVoucher(voucherId, opts = {}) {
    const run = fresh(opts);
    run.anteVoucher = voucherId;
    run.anteVoucherAnte = 1;
    toShop(run);
    run.money = 1000;
    return run;
  }
  const voucherIndex = (run) => run.shop.items.findIndex((it) => it.slot === 'voucher');

  test('§2.8 collect builds the Shop: 2 card slots, 2 Booster Pack slots and 1 Voucher, unsold', () => {
    const run = toShop(fresh());
    const items = run.shop.items;
    deq(['card', 'pack', 'voucher'].map((s) => items.filter((i) => i.slot === s).length), [2, 2, 1]);
    for (const it of items) {
      deq(sorted(Object.keys(it)), ['edition', 'id', 'kind', 'price', 'size', 'slot', 'sold']);
      assert.equal(it.sold, false);
      if (it.slot === 'card') assert.ok(['joker', 'tarot', 'planet'].includes(it.kind), it.kind);
      if (it.kind === 'joker') assert.ok(it.id in SPEC_JOKERS && (it.edition === null || it.edition in SPEC_EDITIONS));
      if (it.slot === 'pack') deq([it.kind, it.id in SPEC_PACKS, it.size], ['pack', true, SPEC_PACKS[it.id][2]]);
      if (it.slot === 'voucher') deq([it.kind, it.id in SPEC_VOUCHERS], ['voucher', true]);
    }
    deq(pick(run.shop, ['rerollCost', 'rerolls', 'freeRerolls', 'discount']), { rerollCost: 5, rerolls: 0, freeRerolls: 0, discount: 0 });
  });

  test('§2.8 prices: Joker cost plus its Edition surcharge, Tarot $3, Planet $3, packs per the table, Voucher $10', () => {
    for (let s = 0; s < 30; s++) {
      const run = toShop(fresh({ seed: `PRICES${s}` }));
      run.money = 1e6;
      for (let i = 0; i < 10; i++) {
        for (const it of run.shop.items) assert.equal(it.price, basePrice(it), `${it.kind} ${it.id} ${it.edition}`);
        ok(Engine.reroll(run));
      }
    }
  });

  test('§2.8 Seer\'s Deck: Tarot cards cost $2 in the Shop; other prices unchanged', () => {
    const run = toShop(fresh({ deckId: 'sketchbook', seed: 'SKETCH01' }));
    const t = rerollUntil(run, (it) => it.kind === 'tarot');
    assert.equal(run.shop.items[t].price, 2);
    for (const it of run.shop.items) assert.equal(it.price, basePrice(it, 'sketchbook'));
  });

  test('§2.8 card slots roll Joker 70 / Tarot 15 / Planet 15, and Jokers by rarity 70 / 25 / 5', () => {
    const run = toShop(fresh({ seed: 'SHOPDIST' }));
    run.money = 1e8;
    const kinds = { joker: 0, tarot: 0, planet: 0, spectral: 0 };
    const rar = { common: 0, uncommon: 0, rare: 0 };
    for (let i = 0; i <= 600; i++) {
      for (const it of cardItems(run)) {
        kinds[it.kind] += 1;
        if (it.kind === 'joker') rar[SPEC_JOKERS[it.id][1]] += 1;
      }
      ok(Engine.reroll(run));
    }
    const n = kinds.joker + kinds.tarot + kinds.planet;
    assert.equal(kinds.spectral, 0, 'no Spectral cards without the Spooky Deck or Haunted Stall');
    within(kinds.joker / n, 0.64, 0.76, 'Joker share');
    within(kinds.tarot / n, 0.1, 0.2, 'Tarot share');
    within(kinds.planet / n, 0.1, 0.2, 'Planet share');
    within(rar.common / kinds.joker, 0.63, 0.77, 'common share');
    within(rar.uncommon / kinds.joker, 0.19, 0.31, 'uncommon share');
    within(rar.rare / kinds.joker, 0.02, 0.09, 'rare share');
  });

  test('§2.8 Legendary Jokers are never in the Shop', () => {
    const legends = list(vm.runInContext('TW.Content.JOKERS', xcontext)).filter((r) => r.rarity === 'legendary').map((r) => r.id);
    deq(sorted(legends), sorted([...LEGENDARIES, 'testlegend', 'testlegendb']));
    const run = toShop(fresh({ seed: 'NOLEGEND' }, XEngine), XEngine);
    run.money = 1e8;
    for (let i = 0; i < 400; i++) {
      for (const it of cardItems(run)) assert.ok(!legends.includes(it.id), `offered ${it.id}`);
      ok(XEngine.reroll(run));
    }
  });

  const editionRate = (opts, prepare, rolls = 1500) => {
    const run = toShop(fresh(opts));
    if (prepare) prepare(run);
    run.money = 1e9;
    let jokers = 0;
    const eds = { gloss: 0, benday: 0, fourcolor: 0, inverted: 0 };
    for (let i = 0; i < rolls; i++) {
      for (const it of cardItems(run)) {
        if (it.kind !== 'joker') continue;
        jokers += 1;
        if (it.edition) eds[it.edition] += 1;
      }
      ok(Engine.reroll(run));
    }
    return { rate: (eds.gloss + eds.benday + eds.fourcolor + eds.inverted) / jokers, eds };
  };
  test('§2.8 Shop Jokers roll an Edition: Sheen 3%, Dither 2%, Glitch 0.5%, Phantom 0.5% (6% in all)', () => {
    within(editionRate({ seed: 'EDRATE01' }).rate, 0.04, 0.08, 'edition rate');
  });
  test('§2.8 Shimmer Dust triples the Edition odds; the Mirrorball Deck doubles them; both give x6', () => {
    within(editionRate({ seed: 'EDRATE02' }, (r) => r.vouchers.push('slickpaper')).rate, 0.15, 0.21, 'Shimmer Dust');
    within(editionRate({ seed: 'EDRATE03', deckId: 'halftone' }).rate, 0.095, 0.145, 'Mirrorball Deck');
    const both = editionRate({ seed: 'EDRATE04', deckId: 'halftone' }, (r) => r.vouchers.push('slickpaper'));
    within(both.rate, 0.32, 0.40, 'both');
    const all = Object.values(both.eds).reduce((s, n) => s + n, 0);
    within(both.eds.gloss / all, 0.4, 0.6, 'Sheen is half of all Editions');
    for (const id of Object.keys(SPEC_EDITIONS)) assert.ok(both.eds[id] > 0, `${id} appears`);
  });

  test('§2.8 Spectral cards join the card roll at weight 5 with the Spooky Deck or Haunted Stall; never Tall Tale', () => {
    for (const [opts, prepare] of [[{ deckId: 'spooky', seed: 'SPOOKY01' }, null], [{ seed: 'MAILORD1' }, (r) => r.vouchers.push('mailorderghost')]]) {
      const run = toShop(fresh(opts));
      if (prepare) prepare(run);
      run.money = 1e8;
      let spectral = 0;
      let n = 0;
      for (let i = 0; i < 700; i++) {
        for (const it of cardItems(run)) {
          n += 1;
          if (it.kind !== 'spectral') continue;
          spectral += 1;
          assert.ok(it.id in SPEC_SPECTRAL && it.id !== 'originstory', it.id);
          assert.equal(it.price, 4);
        }
        ok(Engine.reroll(run));
      }
      within(spectral / n, 0.028, 0.07, `Spectral share (${opts.deckId || 'mailorderghost'})`);
    }
  });

  test('§2.8 never offers a Joker the player owns, nor the same Joker twice at once', () => {
    const run = toShop(fresh({ seed: 'NODUPES1' }));
    for (const id of ['jinglejester', 'pipsqueak', 'gingerbreadfool']) Engine.addJoker(run, id);
    run.money = 1e8;
    for (let i = 0; i < 300; i++) {
      const offered = cardItems(run).filter((it) => it.kind === 'joker').map((it) => it.id);
      assert.equal(new Set(offered).size, offered.length, 'the same Joker twice');
      for (const id of offered) assert.ok(!['jinglejester', 'pipsqueak', 'gingerbreadfool'].includes(id), `offered owned ${id}`);
      ok(Engine.reroll(run));
    }
  });

  test('§2.8 an empty rarity pool rolls another rarity; with every Joker owned, a Joker roll becomes a Planet card', () => {
    const run = toShop(fresh({ seed: 'POOLS001' }));
    run.jokerSlots = 200; // room for all 115 Jokers the Shop can offer (Legendary ones are never offered)
    for (const id of RARES) Engine.addJoker(run, id);
    run.money = 1e8;
    let jokers = 0;
    for (let i = 0; i < 200; i++) {
      for (const it of cardItems(run)) if (it.kind === 'joker') {
        jokers += 1;
        assert.notEqual(SPEC_JOKERS[it.id][1], 'rare');
      }
      ok(Engine.reroll(run));
    }
    assert.ok(jokers > 100, 'Jokers are still offered');
    for (const id of [...COMMONS, ...UNCOMMONS]) assert.ok(Engine.addJoker(run, id), id);
    for (let i = 0; i < 100; i++) {
      ok(Engine.reroll(run));
      for (const it of cardItems(run)) assert.ok(['tarot', 'planet'].includes(it.kind), it.kind);
    }
  });

  test('§2.8 Night Market: 3 card slots and 3 Booster Pack slots, at once when bought and in every later Shop', () => {
    const run = shopWithVoucher('spinnerrack');
    ok(Engine.buy(run, voucherIndex(run)));
    const count = (slot) => run.shop.items.filter((i) => i.slot === slot).length;
    deq([count('card'), count('pack')], [3, 3]);
    ok(Engine.reroll(run));
    assert.equal(count('card'), 3, 'kept through rerolls');
    ok(Engine.leaveShop(run));
    toShop(run);
    deq([count('card'), count('pack')], [3, 3]);
  });

  test('§2.8 reroll: $5, +$1 after each paid reroll; only the card slots change; the price resets next visit', () => {
    const run = toShop(fresh({ seed: 'REROLL01' }));
    run.money = 100;
    const packs = plain(run.shop.items.filter((i) => i.slot !== 'card'));
    assert.equal(Engine.rerollCost(run), 5);
    deq(pick(ok(Engine.reroll(run)), ['cost', 'free']), { cost: 5, free: false });
    assert.equal(ok(Engine.reroll(run)).cost, 6);
    assert.equal(Engine.rerollCost(run), 7);
    deq(plain(run.shop.items.filter((i) => i.slot !== 'card')), packs);
    deq([run.money, run.shop.rerolls, run.stats.rerolls], [89, 2, 2]);
    ok(Engine.leaveShop(run));
    toShop(run);
    assert.equal(Engine.rerollCost(run), 5);
    run.money = 4;
    fails(Engine.reroll(run), 'reroll', 'Not enough money.');
  });

  test('§2.8 Second Look: rerolls in the Shop never go up in price', () => {
    const run = shopWithVoucher('secondlook');
    run.money = 100;
    deq([ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost], [5, 6], 'before Second Look the price rises');
    ok(Engine.buy(run, voucherIndex(run)));
    deq([run.shop.freeRerolls, Engine.rerollCost(run)], [0, 5], 'bought: the price is back at the base at once, and no free reroll');
    deq([ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost], [5, 5, 5]);
    deq(pick(ok(Engine.reroll(run)), ['cost', 'free']), { cost: 5, free: false });
    ok(Engine.leaveShop(run));
    toShop(run);
    run.money = 100;
    deq([run.shop.freeRerolls, Engine.rerollCost(run), ok(Engine.reroll(run)).cost, ok(Engine.reroll(run)).cost], [0, 5, 5, 5], 'every later Shop too');
  });

  test('§2.8 Sale Tag: next Shop Jokers x0.75 (rounded, min $1) and one free reroll; with Second Look the paid ones stay $5', () => {
    const run = fresh({ seed: 'SALETAG1' });
    run.vouchers.push('secondlook');
    skip(run, 'sale');
    assert.equal(run.pending.sale, true);
    toShop(run);
    deq(pick(run.shop, ['discount', 'freeRerolls']), { discount: 0.25, freeRerolls: 1 });
    deq([Engine.rerollCost(run), ok(Engine.reroll(run)).cost, Engine.rerollCost(run)], [0, 0, 5]);
    run.money = 1e6;
    for (let i = 0; i < 40; i++) {
      for (const it of run.shop.items) {
        const p = basePrice(it);
        assert.equal(it.price, it.kind === 'joker' ? Math.max(1, Math.round(p * 0.75)) : p, `${it.kind} ${it.id}`);
      }
      ok(Engine.reroll(run));
    }
    ok(Engine.leaveShop(run));
    toShop(run);
    deq(pick(run.shop, ['discount', 'freeRerolls']), { discount: 0, freeRerolls: 0 }, 'the next Shop only');
  });

  test('§2.8 Season Pass: everything costs $1 less (min $1), after the Sale Tag, and at once when bought', () => {
    const run = shopWithVoucher('dollaroff');
    const before = plain(run.shop.items);
    ok(Engine.buy(run, voucherIndex(run)));
    run.shop.items.forEach((it, i) => {
      if (it.slot !== 'voucher') assert.equal(it.price, Math.max(1, before[i].price - 1), `${it.kind} ${it.id}`);
    });
    const sale = fresh({ seed: 'DOLLAR02' });
    sale.vouchers.push('dollaroff');
    sale.pending.sale = true;
    toShop(sale);
    sale.money = 1e6;
    for (let i = 0; i < 30; i++) {
      for (const it of sale.shop.items) {
        const p = it.kind === 'joker' ? Math.max(1, Math.round(basePrice(it) * 0.75)) : basePrice(it);
        assert.equal(it.price, Math.max(1, p - 1), `${it.kind} ${it.id}`);
      }
      ok(Engine.reroll(sale));
    }
  });

  test('§2.8 buying a Joker needs the money and a free slot; it records what was paid and its Edition', () => {
    const run = toShop(fresh({ seed: 'BUYJOKER' }));
    const i = rerollUntil(run, (it) => it.kind === 'joker');
    const item = run.shop.items[i];
    item.edition = 'gloss';
    item.price = 6;
    run.money = 5;
    fails(Engine.canBuy(run, i), 'canBuy', 'Not enough money.');
    fails(Engine.buy(run, i), 'buy', 'Not enough money.');
    run.money = 6;
    const r = ok(Engine.buy(run, i));
    deq([r.opened, r.item.id, run.money, run.shop.items[i].sold], [false, item.id, 0, true]);
    deq(pick(run.jokers[0], ['id', 'paid', 'edition']), { id: item.id, paid: 6, edition: 'gloss' });
    fails(Engine.buy(run, i), 'buy', 'Already sold.');
    assert.equal(run.shop.items.length, 5, 'a sold slot stays');
  });

  test('§2.8 a Joker needs a free Joker slot, unless it is Phantom', () => {
    const run = toShop(fresh({ seed: 'FULLSLOT' }));
    for (const id of ['jinglejester', 'pipsqueak', 'gingerbreadfool', 'partyhorn', 'emptyseats']) Engine.addJoker(run, id);
    const i = rerollUntil(run, (it) => it.kind === 'joker');
    run.money = 100;
    fails(Engine.buy(run, i), 'buy', 'Your Joker slots are full.');
    run.shop.items[i].edition = 'inverted';
    ok(Engine.buy(run, i));
    deq([run.jokers.length, Engine.jokerSlotsUsed(run)], [6, 5]);
  });

  test('§2.8 Tarot, Planet and Spectral cards go into the 2 shared consumable slots', () => {
    const run = toShop(fresh({ seed: 'CONSUME1' }));
    run.money = 1000;
    for (let n = 0; n < 2; n++) {
      const i = rerollUntil(run, (it) => (it.kind === 'tarot' || it.kind === 'planet') && !it.sold);
      ok(Engine.buy(run, i));
    }
    assert.equal(run.consumables.length, 2);
    const i = rerollUntil(run, (it) => (it.kind === 'tarot' || it.kind === 'planet') && !it.sold);
    fails(Engine.buy(run, i), 'buy', 'Your consumable slots are full.');
  });

  test('§2.8 a Joker sells for half its cost (listed cost plus Edition surcharge), whatever was paid; Legendary included', () => {
    const run = toShop(fresh());
    const bought = Engine.addJoker(run, 'jinglejester', 3); // e.g. bought for $3 with the Sale Tag
    const free = Engine.addJoker(run, 'finalbow'); // free: paid 0, cost $7
    const gloss = Engine.addJoker(run, 'pipsqueak', 0, 'gloss'); // $4 + $2
    const four = Engine.addJoker(run, 'dragontamer', 0, 'fourcolor'); // $9 + $4
    deq([bought, free, gloss, four].map((j) => Engine.jokerSellValue(run, j.uid)), [2, 3, 3, 6]);
    const m = run.money;
    deq(pick(ok(Engine.sellJoker(run, free.uid)), ['money']), { money: 3 });
    deq([run.money, run.jokers.length], [m + 3, 3]);
    fails(Engine.sellJoker(run, free.uid), 'sellJoker', "That Joker isn't in your rack.");
    const xrun = fresh({}, XEngine);
    const legend = XEngine.addJoker(xrun, 'testlegend');
    assert.equal(XEngine.jokerSellValue(xrun, legend.uid), 10);
    for (const id of LEGENDARIES) assert.equal(Engine.jokerSellValue(run, Engine.addJoker(run, id, 0, 'inverted').uid), 12, `${id}: ($20 + $4 Phantom) / 2`);
    assert.equal(Engine.jokerSellValue(run, Engine.addJoker(run, 'candleking').uid), 10, 'a plain Legendary: $20 / 2');
  });

  // systems-v3.json decision 'jokersell': the Deck keeps its twist on the owner's cost basis.
  test('§2.8 High Roller Deck: Jokers sell for their full cost (listed cost plus Edition surcharge), whatever was paid', () => {
    const run = fresh({ deckId: 'mintcondition' });
    const a = Engine.addJoker(run, 'jinglejester', 3); // bought for $3 with the Sale Tag; cost $4
    const b = Engine.addJoker(run, 'bigtop'); // free; cost $8
    const c = Engine.addJoker(run, 'pipsqueak', 0, 'fourcolor'); // $4 + $4
    deq([a, b, c].map((j) => Engine.jokerSellValue(run, j.uid)), [4, 8, 8]);
    const m = run.money;
    deq(pick(ok(Engine.sellJoker(run, b.uid)), ['money']), { money: 8 });
    assert.equal(run.money, m + 8);
    const xrun = fresh({ deckId: 'mintcondition' }, XEngine);
    assert.equal(XEngine.jokerSellValue(xrun, XEngine.addJoker(xrun, 'testlegend').uid), 20);
    assert.equal(Engine.jokerSellValue(run, Engine.addJoker(run, 'ringmaster').uid), 20, 'a real Legendary: its full $20');
  });

  test('§2.8 consumables sell for $1 (Tarot, Planet) or $2 (Spectral)', () => {
    const run = toShop(fresh());
    const t = give(run, 'tarot', 'inkpot');
    const p = give(run, 'planet', 'blip');
    deq([Engine.consumableSellValue(run, t), Engine.consumableSellValue(run, p)], [1, 1]);
    assert.equal(ok(Engine.sellConsumable(run, t)).money, 1);
    const s = give(run, 'spectral', 'wormhole');
    assert.equal(Engine.consumableInfo(run, s).sell, 2);
    assert.equal(ok(Engine.sellConsumable(run, s)).money, 2);
    deq(run.consumables.map((k) => k.uid), [p]);
  });

  test('§2.8 selling works at Blind select, during a Blind, in the Shop and in an open pack, but not at cash-out', () => {
    const run = fresh();
    const sellOne = () => ok(Engine.sellJoker(run, Engine.addJoker(run, 'jinglejester').uid));
    sellOne();
    ok(Engine.startBlind(run));
    sellOne();
    forceClear(run);
    const j = Engine.addJoker(run, 'jinglejester');
    fails(Engine.sellJoker(run, j.uid), 'sellJoker', "You can't sell right now.");
    fails(Engine.canSell(run));
    ok(Engine.collect(run));
    ok(Engine.sellJoker(run, j.uid));
    openPackFromShop(run, 'planetnormal');
    sellOne();
    ok(Engine.canSell(run));
  });

  test('§2.8 leaveShop goes to the next Blind select, and to the next Ante after the Boss Blind', () => {
    const run = fresh();
    clearAndLeave(run);
    deq([run.phase, run.ante, run.blindIndex, run.shop], ['blind-select', 1, 1, null]);
    clearAndLeave(run);
    clearAndLeave(run);
    deq([run.ante, run.blindIndex], [2, 0]);
  });

  test("§2.8 the Voucher is rolled at the Ante's first Shop and stays on offer through that Ante until bought", () => {
    const run = fresh({ seed: 'VOUCHER1' });
    toShop(run);
    const v = run.anteVoucher;
    assert.ok(v in SPEC_VOUCHERS);
    assert.equal(run.anteVoucherAnte, 1);
    ok(Engine.leaveShop(run));
    toShop(run);
    assert.equal(run.shop.items[voucherIndex(run)].id, v, 'same Voucher in the next Shop of the Ante');
    run.money = 100;
    ok(Engine.buy(run, voucherIndex(run)));
    deq([run.vouchers, run.anteVoucher], [[v], null]);
    ok(Engine.leaveShop(run));
    toShop(run);
    assert.equal(voucherIndex(run), -1, 'nothing more this Ante');
    ok(Engine.leaveShop(run));
    toShop(run);
    const w = run.shop.items[voucherIndex(run)];
    assert.ok(w && w.id !== v && !run.vouchers.includes(w.id), 'a new Ante rolls a Voucher not owned');
    run.vouchers.push(w.id);
    run.money = 100;
    fails(Engine.canBuy(run, voucherIndex(run)), 'canBuy', 'You already have that Voucher.');
  });

  test('§2.8 no Voucher is offered once every Voucher is owned', () => {
    const run = fresh();
    run.vouchers = Object.keys(SPEC_VOUCHERS);
    toShop(run);
    assert.equal(voucherIndex(run), -1);
  });
});

// =========================================================================================
describe('§2.9 Booster Packs', () => {
  test("§2.9 buying a pack opens it: run.pack and phase 'pack'", () => {
    const run = toShop(fresh({ seed: 'OPENPACK' }));
    const i = run.shop.items.findIndex((it) => it.slot === 'pack');
    run.money = 100;
    const id = run.shop.items[i].id;
    deq(pick(ok(Engine.buy(run, i)), ['opened']), { opened: true });
    assert.equal(run.phase, 'pack');
    deq(pick(run.pack, ['id', 'kind', 'size', 'picksLeft', 'returnTo']), { id, kind: SPEC_PACKS[id][1], size: SPEC_PACKS[id][2], picksLeft: SPEC_PACKS[id][4], returnTo: 'shop' });
    for (const o of run.pack.options) assert.equal(o.picked, false);
  });

  test('§2.9 every pack shows its cards and allows its picks; Baker\'s Dozen shows one more', () => {
    for (const id of Object.keys(SPEC_PACKS)) {
      for (const bonus of [false, true]) {
        const run = fresh({ seed: `SHOWN${id}` });
        if (bonus) run.vouchers.push('bonuspages');
        openPackFromShop(run, id);
        const [, kind, , shown, picks] = SPEC_PACKS[id];
        deq([run.pack.options.length, run.pack.picksLeft], [shown + (bonus ? 1 : 0), picks], `${id}${bonus ? ' + Baker\'s Dozen' : ''}`);
        const want = { card: 'card', tarot: 'tarot', planet: 'planet', joker: 'joker', ghost: 'spectral' }[kind];
        for (const o of run.pack.options) assert.ok(o.kind === want || (o.kind === 'spectral' && o.id === 'originstory'), `${id}: ${o.kind}`);
        if (kind !== 'card') {
          const ids = run.pack.options.map((o) => o.id);
          assert.equal(new Set(ids).size, ids.length, `${id}: distinct`);
        }
      }
    }
  });

  /** Opens the same pack again and again from one Shop slot, calling fn(run) each time. */
  function samplePacks(run, packId, times, fn) {
    if (run.phase !== 'shop') toShop(run);
    const i = run.shop.items.findIndex((it) => it.slot === 'pack');
    for (let n = 0; n < times; n++) {
      Object.assign(run.shop.items[i], { id: packId, size: SPEC_PACKS[packId][2], price: 0, sold: false });
      ok(Engine.buy(run, i));
      fn(run);
      if (run.phase === 'pack') ok(Engine.packSkip(run));
    }
  }
  const cardStats = (prepare, seed) => {
    const run = fresh({ seed });
    if (prepare) prepare(run);
    const n = { cards: 0, enh: 0, ed: 0, inverted: 0, seal: 0 };
    samplePacks(run, 'cardjumbo', 160, (r) => {
      for (const o of r.pack.options) {
        const c = o.card;
        assert.ok(Number.isInteger(c.rank) && c.rank >= 2 && c.rank <= 14 && 'SHDC'.includes(c.suit));
        n.cards += 1;
        if (c.enhancement) n.enh += 1;
        if (c.edition) n.ed += 1;
        if (c.edition === 'inverted') n.inverted += 1;
        if (c.seal) n.seal += 1;
      }
    });
    return n;
  };
  test('§2.9 Card Pack cards: random rank and suit, Enhancement 35%, Edition 8% (never Phantom), Seal 10%', () => {
    const n = cardStats(null, 'CARDPK01');
    within(n.enh / n.cards, 0.3, 0.4, 'Enhancement share');
    within(n.ed / n.cards, 0.05, 0.11, 'Edition share');
    within(n.seal / n.cards, 0.07, 0.13, 'Seal share');
    assert.equal(n.inverted, 0);
  });
  test('§2.9 Ribbon Box: Card Pack Seals 40%; Shimmer Dust: Card Pack Editions x3', () => {
    within(cardStats((r) => r.vouchers.push('stampalbum'), 'CARDPK02').seal / 960, 0.35, 0.45, 'Seal share with Ribbon Box');
    within(cardStats((r) => r.vouchers.push('slickpaper'), 'CARDPK03').ed / 960, 0.19, 0.29, 'Edition share with Shimmer Dust');
  });

  test('§2.9 Card Pack: the pick joins the deck for good and the pack closes', () => {
    const run = openPackFromShop(fresh({ seed: 'CARDPICK' }), 'cardnormal');
    const card = plain(run.pack.options[2].card);
    const r = ok(Engine.packPick(run, 2));
    deq(pick(r, ['kind', 'uid', 'picksLeft', 'closed']), { kind: 'card', uid: card.uid, picksLeft: 0, closed: true });
    deq(plain(cardOf(run, card.uid)), card);
    deq([run.cards.length, run.phase, run.pack], [53, 'shop', null]);
  });

  test('§2.9 Tarot Pack: a hand is dealt from the deck, and a Tarot pick is used at once on it, never stored', () => {
    const run = openPackFromShop(fresh({ seed: 'TAROTPK1' }), 'tarotnormal');
    const p = run.pack;
    deq([p.hand.length, p.draw.length], [8, 44]);
    deq(sorted([...p.hand, ...p.draw]), sorted(run.cards.map((c) => c.uid)));
    p.options[0] = { kind: 'tarot', id: 'inkpot', picked: false };
    fails(Engine.canPackPick(run, 0, []), 'canPackPick', 'Select 1 or 2 cards.');
    fails(Engine.packPick(run, 0, ['c99999']), 'packPick', 'Select cards from your hand.');
    const sel = p.hand.slice(0, 2);
    const used = run.stats.consumablesUsed;
    const r = ok(Engine.packPick(run, 0, sel));
    deq(pick(r, ['kind', 'id', 'closed']), { kind: 'tarot', id: 'inkpot', closed: true });
    deq(pick(r.effect, ['kind', 'id', 'uids', 'enhancement']), { kind: 'tarot', id: 'inkpot', uids: sel, enhancement: 'inked' });
    for (const u of sel) assert.equal(cardOf(run, u).enhancement, 'inked');
    deq([run.consumables.length, run.stats.consumablesUsed, run.phase], [0, used + 1, 'shop']);
  });

  test('§2.9 Planet Pack: distinct Planet cards, no hand, and the pick levels up its hand at once (2 with Sky Atlas)', () => {
    const run = openPackFromShop(fresh({ seed: 'PLANETPK' }), 'planetnormal');
    deq([run.pack.hand, run.pack.draw], [[], []], 'no dealt hand');
    const o = run.pack.options[0];
    const r = ok(Engine.packPick(run, 0));
    const hand = SPEC_PLANETS[o.id][1];
    deq(pick(r.effect, ['handId', 'levels', 'level']), { handId: hand, levels: 1, level: 2 });
    assert.equal(run.consumables.length, 0);
    run.vouchers.push('skyatlas');
    openPackFromShop(run, 'planetnormal');
    run.pack.options[0] = { kind: 'planet', id: 'swoosh', picked: false };
    ok(Engine.packPick(run, 0));
    assert.equal(run.levels.flush, hand === 'flush' ? 4 : 3);
  });

  test('§2.9 Joker Pack: Jokers you do not own, each with an Edition roll; the pick is free and keeps its Edition', () => {
    const run = fresh({ seed: 'JOKERPK1' });
    Engine.addJoker(run, 'jinglejester');
    openPackFromShop(run, 'jokermega');
    const opts = run.pack.options;
    assert.equal(opts.length, 4);
    for (const o of opts) {
      assert.ok(o.id in SPEC_JOKERS && o.id !== 'jinglejester');
      assert.ok(o.edition === null || o.edition in SPEC_EDITIONS);
    }
    opts[1].edition = 'benday';
    const r = ok(Engine.packPick(run, 1));
    deq(pick(r, ['kind', 'id', 'picksLeft', 'closed']), { kind: 'joker', id: opts[1].id, picksLeft: 1, closed: false });
    deq(pick(jokerOf(run, r.uid), ['id', 'paid', 'edition']), { id: opts[1].id, paid: 0, edition: 'benday' });
    fails(Engine.packPick(run, 1), 'packPick', 'You already took that card.');
    assert.equal(ok(Engine.packPick(run, 3)).closed, true);
    assert.equal(run.phase, 'shop');
  });

  test('§2.9 a Joker pick needs a free Joker slot, unless it is Phantom; Joker Packs never hold a Legendary', () => {
    const run = fresh({ seed: 'JOKERPK2' });
    for (const id of ['jinglejester', 'pipsqueak', 'gingerbreadfool', 'partyhorn', 'emptyseats']) Engine.addJoker(run, id);
    openPackFromShop(run, 'jokernormal');
    run.pack.options[0].edition = null;
    fails(Engine.packPick(run, 0), 'packPick', 'Your Joker slots are full.');
    run.pack.options[0].edition = 'inverted';
    ok(Engine.packPick(run, 0));
    const xrun = toShop(fresh({ seed: 'JOKERPK3' }, XEngine), XEngine);
    const i = xrun.shop.items.findIndex((it) => it.slot === 'pack');
    for (let n = 0; n < 150; n++) {
      Object.assign(xrun.shop.items[i], { id: 'jokermega', size: 'mega', price: 0, sold: false });
      ok(XEngine.buy(xrun, i));
      for (const o of xrun.pack.options) assert.ok(!['testlegend', 'testlegendb', ...LEGENDARIES].includes(o.id), o.id);
      ok(XEngine.packSkip(xrun));
    }
  });

  test('§2.9 Ghost Pack: Spectral cards used at once on a dealt hand (Cursed Coin: Paid Seals, lose $5)', () => {
    const run = openPackFromShop(fresh({ seed: 'GHOSTPK1' }), 'ghostnormal');
    assert.equal(run.pack.hand.length, 8);
    for (const o of run.pack.options) assert.ok(o.id in SPEC_SPECTRAL);
    run.pack.options[0] = { kind: 'spectral', id: 'cursedcoin', picked: false };
    run.money = 7;
    const sel = run.pack.hand.slice(0, 2);
    const r = ok(Engine.packPick(run, 0, sel));
    deq(pick(r.effect, ['seal', 'uids', 'moneyLost']), { seal: 'paid', uids: sel, moneyLost: 5 });
    deq(sel.map((u) => cardOf(run, u).seal), ['paid', 'paid']);
    deq([run.money, run.consumables.length], [2, 0]);
  });

  test('§2.9 Tall Tale can stand in for a Tarot Pack slot (0.5%) or a Ghost Pack slot (2%)', () => {
    const rateIn = (packId, packs, seed) => {
      let slots = 0;
      let origin = 0;
      samplePacks(fresh({ seed }), packId, packs, (r) => {
        slots += r.pack.options.length;
        origin += r.pack.options.filter((o) => o.id === 'originstory').length;
        assert.ok(r.pack.options.filter((o) => o.id === 'originstory').length <= 1);
      });
      return origin / slots;
    };
    within(rateIn('ghostmega', 400, 'ORIGIN01'), 0.008, 0.036, 'Ghost Pack slots');
    within(rateIn('tarotmega', 400, 'ORIGIN02'), 0.0008, 0.012, 'Tarot Pack slots');
  });

  test('§2.9 Mega packs: two picks, one at a time; a pack closes when its picks are used', () => {
    const run = openPackFromShop(fresh({ seed: 'MEGAPICK' }), 'cardmega');
    deq(pick(ok(Engine.packPick(run, 0)), ['picksLeft', 'closed']), { picksLeft: 1, closed: false });
    assert.equal(run.phase, 'pack');
    fails(Engine.canPackPick(run, 0), 'canPackPick', 'You already took that card.');
    deq(pick(ok(Engine.packPick(run, 5)), ['picksLeft', 'closed']), { picksLeft: 0, closed: true });
    assert.equal(run.cards.length, 54);
  });

  test('§2.9 packSkip returns to where the pack was opened', () => {
    const run = openPackFromShop(fresh({ seed: 'PACKSKIP' }), 'tarotjumbo');
    ok(Engine.packSkip(run));
    deq([run.phase, run.pack], ['shop', null]);
    const run2 = fresh({ seed: 'PACKSKP2' });
    run2.tags['1-0'] = 'grabbag';
    ok(Engine.skipBlind(run2));
    deq([run2.phase, run2.pack.returnTo], ['pack', 'blind-select']);
    ok(Engine.packSkip(run2));
    assert.equal(run2.phase, 'blind-select');
    fails(Engine.packSkip(run2), 'packSkip', 'No Booster Pack is open.');
  });

  test('§2.9 cards destroyed in a pack hand leave the deck for good, and the hand draws back up', () => {
    const run = openPackFromShop(fresh({ seed: 'PACKERAS' }), 'tarotnormal');
    run.pack.options[0] = { kind: 'tarot', id: 'eraser', picked: false };
    const sel = run.pack.hand.slice(0, 2);
    const m = run.money;
    const r = ok(Engine.packPick(run, 0, sel));
    deq([r.effect.destroyed, r.effect.money, run.money, run.cards.length], [sel, 2, m + 2, 50]);
    for (const u of sel) assert.equal(cardOf(run, u), undefined);
  });

  test('§2.9 "this Blind" cards picked from a pack act on the next Blind', () => {
    const run = fresh({ seed: 'NEXTBLND' });
    openPackFromShop(run, 'tarotmega');
    run.pack.options[0] = { kind: 'tarot', id: 'overtime', picked: false };
    run.pack.options[1] = { kind: 'tarot', id: 'doover', picked: false };
    deq(pick(ok(Engine.packPick(run, 0)).effect, ['hands', 'nextBlind']), { hands: 1, nextBlind: true });
    deq(pick(ok(Engine.packPick(run, 1)).effect, ['discards', 'nextBlind']), { discards: 2, nextBlind: true });
    openPackFromShop(run, 'ghostmega');
    run.pack.options[0] = { kind: 'spectral', id: 'phantomink', picked: false };
    run.pack.options[1] = { kind: 'spectral', id: 'deadletter', picked: false };
    const [u] = run.pack.hand;
    const r = ok(Engine.packPick(run, 0, [u]));
    assert.ok(['gloss', 'benday', 'fourcolor'].includes(cardOf(run, u).edition));
    deq(r.effect.edition, cardOf(run, u).edition);
    ok(Engine.packPick(run, 1, [run.pack.hand[1]]));
    deq(pick(run.pending, ['extraHands', 'extraDiscards', 'handSizeDelta']), { extraHands: 1, extraDiscards: 1, handSizeDelta: -1 });
    ok(Engine.leaveShop(run));
    ok(Engine.startBlind(run));
    deq([run.blind.handsLeft, run.blind.discardsLeft, run.blind.hand.length], [5, 4, 7]);
    deq(pick(run.pending, ['extraHands', 'extraDiscards', 'handSizeDelta']), { extraHands: 0, extraDiscards: 0, handSizeDelta: 0 }, 'used up');
  });

  // systems-v3.json §2.9: "'Needs at least 2 hands left' applies only during a Blind."
  test('§2.9 Apparition picked from a pack: "at least 2 hands left" counts only during a Blind; the next Blind keeps 1 hand', () => {
    const run = fresh({ seed: 'APPARIT1' });
    run.hands = 1;
    openPackFromShop(run, 'ghostnormal');
    run.pack.options[0] = { kind: 'spectral', id: 'apparition', picked: false };
    const [u] = run.pack.hand;
    const r = ok(Engine.packPick(run, 0, [u]));
    deq(pick(r.effect, ['seal', 'uids', 'hands', 'nextBlind']), { seal: 'cameo', uids: [u], hands: -1, nextBlind: true });
    assert.equal(run.pending.extraHands, -1);
    ok(Engine.leaveShop(run));
    ok(Engine.startBlind(run));
    deq([run.blind.handsLeft, run.pending.extraHands], [1, 0]);
  });

  test('§2.9 a consumable from the slots can be used on the hand of an open Tarot or Ghost Pack', () => {
    const run = openPackFromShop(fresh({ seed: 'SLOTUSE1' }), 'tarotnormal');
    const k = give(run, 'tarot', 'crayon');
    const [u] = run.pack.hand;
    ok(Engine.useConsumable(run, k, [u]));
    assert.equal(cardOf(run, u).enhancement, 'scribbled');
    const run2 = openPackFromShop(fresh({ seed: 'SLOTUSE2' }), 'planetnormal');
    fails(Engine.useConsumable(run2, give(run2, 'tarot', 'crayon'), []), 'useConsumable', 'Only usable during a Blind.');
  });

  // systems-v3.json decision 'packpicks': a pick that creates a card still needs room for it.
  test('§2.9 Launch Pad and Copycat picked from a pack need a free consumable slot for the card they create', () => {
    const run = openPackFromShop(fresh({ seed: 'PACKROOM' }), 'tarotmega');
    give(run, 'planet', 'blip');
    const ink = give(run, 'tarot', 'inkpot');
    run.pack.options[0] = { kind: 'tarot', id: 'launchpad', picked: false };
    run.pack.options[1] = { kind: 'tarot', id: 'reprint', picked: false };
    fails(Engine.canPackPick(run, 0), 'Launch Pad, slots full', 'Your consumable slots are full.');
    fails(Engine.packPick(run, 1), 'Copycat, slots full', 'Your consumable slots are full.');
    ok(Engine.sellConsumable(run, ink));
    const r = ok(Engine.packPick(run, 1));
    deq([r.effect.created.length, run.consumables.map((k) => k.id), r.closed], [1, ['blip', 'blip'], false]);
    fails(Engine.packPick(run, 0), 'Launch Pad, slots full again', 'Your consumable slots are full.');
  });
});

// =========================================================================================
describe('§2.10 Skipping and Tags', () => {
  test('§2.10 Tags are rolled at run creation for every Small and Big Blind of Antes 1-8 (Ghost Tag from Ante 2)', () => {
    const seen = new Set();
    for (let s = 0; s < 60; s++) {
      const run = fresh({ seed: `TAGS${s}` });
      deq(sorted(Object.keys(run.tags)), sorted([1, 2, 3, 4, 5, 6, 7, 8].flatMap((a) => [`${a}-0`, `${a}-1`])));
      for (const [key, id] of Object.entries(run.tags)) {
        assert.ok(id in SPEC_TAGS, id);
        assert.ok(SPEC_TAGS[id][1] <= Number(key.split('-')[0]), `${id} at ${key}`);
        seen.add(id);
      }
    }
    deq(sorted(seen), sorted(Object.keys(SPEC_TAGS)), 'every Tag appears');
  });

  test('§2.10 skipping grants the Tag and goes straight to the next Blind select', () => {
    const run = fresh();
    const r = skip(run, 'piggybank');
    deq(r.tag, pick(entry(Content.TAGS, 'piggybank'), ['id', 'name', 'text']));
    deq(r.gained, { money: 6 });
    deq([run.phase, run.blindIndex, run.blindStatus['1-0'], run.stats.blindsSkipped, run.money, run.cashout], ['blind-select', 1, 'skipped', 1, 10, null]);
    assert.ok(run.discovered.tags.includes('piggybank'));
  });

  test("§2.10 the Big Blind can be skipped; the Boss Blind never", () => {
    const run = fresh();
    skip(run, 'piggybank');
    skip(run, 'piggybank');
    fails(Engine.skipBlind(run), 'skipBlind', "Boss Blinds can't be skipped.");
    ok(Engine.startBlind(run));
    fails(Engine.skipBlind(run), 'skipBlind', "You can't skip a Blind right now.");
  });

  test('§2.10 Buddy Tag: a random common Joker (paid 0), or $4 when the Joker slots are full', () => {
    const run = fresh();
    const r = skip(run, 'buddy');
    assert.ok(COMMONS.includes(r.gained.jokerId));
    deq(pick(jokerOf(run, r.gained.jokerUid), ['id', 'paid', 'edition']), { id: r.gained.jokerId, paid: 0, edition: null });
    const full = fresh();
    for (const id of ['bigtop', 'pokerface', 'dragontamer', 'fortunecookie', 'sableknave']) Engine.addJoker(full, id);
    const m = full.money;
    deq(skip(full, 'buddy').gained, { money: 4 });
    assert.equal(full.money, m + 4);
  });

  test('§2.10 Tarot Tag: 2 random Tarot cards, as many as fit', () => {
    const run = fresh();
    const r = skip(run, 'tarot');
    assert.equal(r.gained.consumableIds.length, 2);
    for (const k of run.consumables) deq([k.kind, k.id in SPEC_TAROT], ['tarot', true]);
    const one = fresh();
    give(one, 'planet', 'blip');
    assert.equal(skip(one, 'tarot').gained.consumableIds.length, 1);
  });

  test('§2.10 Crowd Pleaser Tag: the most-played hand gains a level; with none played, a random hand', () => {
    const run = fresh();
    run.plays.three = 2;
    assert.equal(skip(run, 'fanfavorite').gained.handId, 'three');
    assert.equal(run.levels.three, 2);
    const none = fresh();
    const h = skip(none, 'fanfavorite').gained.handId;
    assert.ok(HAND_IDS.includes(h));
    assert.equal(none.levels[h], 2);
  });

  test('§2.10 Second Wind Tag: +1 hand in the next Blind actually started, then used up', () => {
    const run = fresh();
    skip(run, 'secondwind');
    assert.equal(run.pending.extraHands, 1);
    ok(Engine.startBlind(run));
    assert.equal(run.blind.handsLeft, 5);
    assert.equal(run.pending.extraHands, 0);
  });

  test("§2.10 Head Start Tag: the next started Blind's target is 25% lower, then used up", () => {
    const run = fresh();
    skip(run, 'headstart');
    ok(Engine.startBlind(run));
    assert.equal(run.blind.target, 340); // round(450 x 0.75 / 10) x 10 = round(33.75) x 10
    forceClear(run);
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    ok(Engine.startBlind(run));
    assert.equal(run.blind.target, Engine.blindTarget(run, 1, 2));
  });

  test('§2.10 Sale Tag waits for the next Shop', () => {
    const run = fresh();
    skip(run, 'sale');
    ok(Engine.startBlind(run));
    assert.equal(run.pending.sale, true, 'starting a Blind does not use it');
    forceClear(run);
    ok(Engine.collect(run));
    deq([run.shop.discount, run.pending.sale], [0.25, false]);
  });

  test('§2.10 Grab Bag, Sky and Ghost Tags open their free Jumbo pack at once, back to Blind select', () => {
    for (const [tag, packId, hand] of [['grabbag', 'cardjumbo', false], ['sky', 'planetjumbo', false], ['ghost', 'ghostjumbo', true]]) {
      const run = fresh({ seed: `TAGPACK${tag}` });
      run.tags['1-0'] = tag;
      const r = ok(Engine.skipBlind(run));
      assert.equal(r.gained.pack, packId);
      deq([run.phase, run.pack.id, run.pack.returnTo, run.pack.options.length, run.pack.hand.length > 0], ['pack', packId, 'blind-select', SPEC_PACKS[packId][3], hand]);
      if (tag === 'grabbag') {
        ok(Engine.packPick(run, 0));
        assert.equal(run.phase, 'blind-select');
      }
    }
  });

  test("§2.10 Glimmer Tag: Sheen, Dither or Glitch on a random Joker without an Edition, or $4", () => {
    const run = fresh();
    const a = Engine.addJoker(run, 'jinglejester', 0, 'gloss');
    const b = Engine.addJoker(run, 'pipsqueak');
    const r = skip(run, 'collector');
    assert.equal(r.gained.jokerUid, b.uid);
    assert.ok(['gloss', 'benday', 'fourcolor'].includes(jokerOf(run, b.uid).edition));
    deq([r.gained.edition, jokerOf(run, a.uid).edition], [jokerOf(run, b.uid).edition, 'gloss']);
    const none = fresh();
    deq(skip(none, 'collector').gained, { money: 4 });
  });

  test('§2.10 Ribbon Tag: a random Seal on 2 random deck cards that have none', () => {
    const run = fresh();
    for (const c of run.cards.slice(0, 50)) c.seal = 'paid';
    const r = skip(run, 'stamp');
    deq(sorted(r.gained.uids), sorted(run.cards.slice(50).map((c) => c.uid)));
    for (const c of run.cards.slice(50)) assert.ok(c.seal in SPEC_SEALS);
  });
});

// =========================================================================================
describe('§2.11 / §3.13 Decks and §3.14 Stakes: starting state', () => {
  const base = (r) => pick(r, ['money', 'hands', 'discards', 'handSize', 'jokerSlots', 'consumableSlots']);
  test('§3.13 House Deck: 52 standard cards, $4, 4 hands, 3 discards, hand size 8, 5 Joker and 2 consumable slots', () => {
    const run = fresh({ deckId: 'firstissue' });
    deq(base(run), { money: 4, hands: 4, discards: 3, handSize: 8, jokerSlots: 5, consumableSlots: 2 });
    deq([run.cards.length, run.jokers, run.consumables, run.deckId, run.stake], [52, [], [], 'firstissue', 'sunny']);
  });
  test('§3.13 Firefly Deck: +1 hand every Blind, -1 discard', () => deq(base(fresh({ deckId: 'speedlines' })), { money: 4, hands: 5, discards: 2, handSize: 8, jokerSlots: 5, consumableSlots: 2 }));
  test('§3.13 Seer\'s Deck: +1 discard every Blind', () => assert.equal(fresh({ deckId: 'sketchbook' }).discards, 4));
  test('§3.13 Candelabra Deck: hand size 9 and one fewer discard', () => deq(pick(fresh({ deckId: 'panorama' }), ['handSize', 'discards']), { handSize: 9, discards: 2 }));
  test('§3.13 Rags to Riches Deck: exactly six random cards start as Gilt-Edged cards, and $0', () => {
    const run = fresh({ deckId: 'bargainbin' });
    deq([run.money, run.cards.filter((c) => c.enhancement === 'dimestore').length, run.cards.filter((c) => c.enhancement).length], [0, 6, 6]);
  });
  test('§3.13 Parlour Deck: 3 consumable slots holding The Candlemaker, Fire-Eater and Spotlight', () => {
    const run = fresh({ deckId: 'studio' });
    deq([run.consumableSlots, run.consumables.map((k) => [k.kind, k.id])], [3, [['tarot', 'inkpot'], ['tarot', 'boxingglove'], ['tarot', 'spotlight']]]);
  });
  test('§3.13 Gift-Wrapped Deck: exactly eight random cards start with a random Seal', () => {
    const run = fresh({ deckId: 'rubberstamp' });
    const sealed = run.cards.filter((c) => c.seal);
    assert.equal(sealed.length, 8);
    for (const c of sealed) assert.ok(c.seal in SPEC_SEALS);
  });
  test('§3.13 High Roller Deck: starts with $12', () => assert.equal(fresh({ deckId: 'mintcondition' }).money, 12));
  test('§3.13 Mirrorball Deck: starts with a random common Joker with Sheen (paid 0)', () => {
    const run = fresh({ deckId: 'halftone' });
    assert.equal(run.jokers.length, 1);
    deq([COMMONS.includes(run.jokers[0].id), run.jokers[0].edition, run.jokers[0].paid], [true, 'gloss', 0]);
  });
  test('§3.13 Spooky Deck: starts with Curtain Call; Ghost Packs show up twice as often', () => {
    const run = fresh({ deckId: 'spooky' });
    deq(run.consumables.map((k) => [k.kind, k.id]), [['spectral', 'curtaincall']]);
    const share = (deckId, seed) => {
      let ghost = 0;
      let n = 0;
      for (let s = 0; s < 250; s++) {
        const r = fresh({ deckId, seed: `${seed}${s}` });
        ok(Engine.startBlind(r));
        r.ante = 2; // Ghost Packs can appear from Ante 2
        forceClear(r);
        ok(Engine.collect(r));
        for (const it of r.shop.items) if (it.slot === 'pack') {
          n += 1;
          if (SPEC_PACKS[it.id][1] === 'ghost') ghost += 1;
        }
      }
      return ghost / n;
    };
    within(share('firstissue', 'GHOSTW'), 0.025, 0.1, 'Ghost Pack share');
    within(share('spooky', 'GHOSTS'), 0.075, 0.17, 'Ghost Pack share on the Spooky Deck');
  });
  test('§2.8 Booster Pack slots roll Card 32 / Tarot 24 / Planet 24 / Joker 14 / Ghost 6 (none in Ante 1), then Normal 70 / Jumbo 22 / Mega 8', () => {
    const kinds = { card: 0, tarot: 0, planet: 0, joker: 0, ghost: 0 };
    const sizes = { normal: 0, jumbo: 0, mega: 0 };
    let ante1Ghost = 0;
    for (let s = 0; s < 500; s++) {
      const r1 = toShop(fresh({ seed: `PACKW${s}` }));
      for (const it of r1.shop.items) if (it.slot === 'pack' && SPEC_PACKS[it.id][1] === 'ghost') ante1Ghost += 1;
      const r = fresh({ seed: `PACKX${s}` });
      ok(Engine.startBlind(r));
      r.ante = 2;
      forceClear(r);
      ok(Engine.collect(r));
      for (const it of r.shop.items) if (it.slot === 'pack') {
        kinds[SPEC_PACKS[it.id][1]] += 1;
        sizes[it.size] += 1;
      }
    }
    assert.equal(ante1Ghost, 0, 'no Ghost Packs in Ante 1');
    const n = 1000;
    within(kinds.card / n, 0.27, 0.37, 'Card');
    within(kinds.tarot / n, 0.2, 0.28, 'Tarot');
    within(kinds.planet / n, 0.2, 0.28, 'Planet');
    within(kinds.joker / n, 0.1, 0.18, 'Joker');
    within(kinds.ghost / n, 0.03, 0.09, 'Ghost');
    within(sizes.normal / n, 0.65, 0.75, 'Normal');
    within(sizes.jumbo / n, 0.18, 0.26, 'Jumbo');
    within(sizes.mega / n, 0.05, 0.11, 'Mega');
  });
  test('§3.14 Gulp and Last Candle Stakes: one fewer discard every Blind; Sunny and Uh-Oh keep the Deck values', () => {
    deq(['sunny', 'uhoh', 'gulp', 'yikes'].map((stake) => fresh({ stake }).discards), [3, 3, 2, 2]);
    deq(['sunny', 'uhoh', 'gulp', 'yikes'].map((stake) => fresh({ stake, deckId: 'sketchbook' }).discards), [4, 4, 3, 3]);
    assert.equal(fresh({ stake: 'gulp', deckId: 'speedlines' }).discards, 1);
  });
  test('§2.11 unknown Deck or Stake ids fall back to the first ones', () => {
    deq(pick(Engine.newRun({ seed: 'X', deckId: 'nope', stake: 'nope' }), ['deckId', 'stake']), { deckId: 'firstissue', stake: 'sunny' });
  });
});

// =========================================================================================
describe('§3.6 Tarot cards and §3.7 Planet cards', () => {
  test('§4.2 consumableInfo reports uid, kind, id, name, text, where, select and sell value', () => {
    const run = inBlind();
    const t = give(run, 'tarot', 'paintbucket');
    const p = give(run, 'planet', 'kaboom');
    deq(Engine.consumableInfo(run, t), { uid: t, kind: 'tarot', id: 'paintbucket', name: 'The Tailor', text: entry(Content.TAROTS, 'paintbucket').text, where: 'blind', select: [2, 3], sell: 1 });
    deq(pick(Engine.consumableInfo(run, p), ['kind', 'id', 'name', 'where', 'select']), { kind: 'planet', id: 'kaboom', name: 'Hearthon', where: 'any', select: [0, 0] });
    assert.equal(Engine.consumableInfo(run, 'k99999'), null);
  });

  for (const [id, enh] of Object.entries(ENH_TAROT)) {
    test(`§3.6 ${SPEC_TAROT[id][0]} makes the selected card(s) ${SPEC_ENH[enh]}, replacing any Enhancement`, () => {
      const run = inBlind();
      const n = SPEC_TAROT[id][1][1];
      const sel = setHand(run, Array.from({ length: n }, (_, i) => `${i + 2}S+${enh === 'inked' ? 'punchy' : 'inked'}`));
      const r = ok(Engine.useConsumable(run, give(run, 'tarot', id), sel));
      for (const u of sel) assert.equal(cardOf(run, u).enhancement, enh);
      deq(pick(r.effect, ['kind', 'id', 'uids', 'enhancement']), { kind: 'tarot', id, uids: sel, enhancement: enh });
      assert.equal(run.consumables.length, 0);
      assert.equal(run.stats.consumablesUsed, 1);
    });
  }

  test('§3.6 selection counts are enforced', () => {
    const run = inBlind();
    const h = run.blind.hand;
    fails(Engine.useConsumable(run, give(run, 'tarot', 'inkpot'), []), 'The Candlemaker with 0', 'Select 1 or 2 cards.');
    fails(Engine.useConsumable(run, give(run, 'tarot', 'inkpot'), h.slice(0, 3)), 'The Candlemaker with 3', 'Select 1 or 2 cards.');
    fails(Engine.useConsumable(run, give(run, 'tarot', 'pricegun'), h.slice(0, 2)), 'Gold Leaf with 2', 'Select exactly 1 card.');
    fails(Engine.useConsumable(run, give(run, 'tarot', 'scrunch'), h.slice(0, 4)), 'Tinderbox with 4', 'Select 1 to 3 cards.');
    fails(Engine.useConsumable(run, give(run, 'tarot', 'paintbucket'), h.slice(0, 1)), 'The Tailor with 1', 'Select 2 or 3 cards.');
    fails(Engine.useConsumable(run, give(run, 'spectral', 'vanishingact'), h.slice(0, 5)), 'Vanishing Act with 5', 'Select 1 to 4 cards.');
    fails(Engine.useConsumable(run, give(run, 'tarot', 'inkpot'), ['c99999']), 'not in hand', 'Select cards from your hand.');
    fails(Engine.useConsumable(run, give(run, 'tarot', 'inkpot'), [h[0], h[0]]), 'twice', 'Select cards from your hand.');
  });

  test("§3.6 'blind' cards need a hand of cards: not at Blind select or in the Shop", () => {
    const run = fresh();
    for (const id of ['inkpot', 'overtime', 'doover']) fails(Engine.useConsumable(run, give(run, 'tarot', id), []), id, 'Only usable during a Blind.');
    toShop(run);
    fails(Engine.useConsumable(run, give(run, 'spectral', 'spellbound'), []), 'spellbound', 'Only usable during a Blind.');
  });

  test("§3.6 'any' cards work at Blind select, during a Blind, in the Shop and in an open pack; nothing at cash-out", () => {
    const run = fresh();
    const use = () => ok(Engine.useConsumable(run, give(run, 'tarot', 'paperroute'), []));
    use();
    ok(Engine.useConsumable(run, give(run, 'planet', 'blip'), []));
    ok(Engine.startBlind(run));
    use();
    forceClear(run);
    fails(Engine.useConsumable(run, give(run, 'tarot', 'paperroute'), []), 'at cash-out', "You can't use that right now.");
    fails(Engine.useConsumable(run, give(run, 'tarot', 'inkpot'), []), 'at cash-out', 'Only usable during a Blind.');
    run.consumables = [];
    ok(Engine.collect(run));
    use();
    openPackFromShop(run, 'cardnormal');
    use();
    assert.equal(run.levels.high, 2);
  });

  test('§3.6 Candle Snuffer destroys the selected cards for good, pays $1 each and draws back up', () => {
    const run = inBlind();
    const sel = run.blind.hand.slice(0, 2);
    const m = run.money;
    const r = ok(Engine.useConsumable(run, give(run, 'tarot', 'eraser'), sel));
    deq([r.effect.destroyed, r.effect.money, run.money, run.cards.length, run.blind.hand.length, r.effect.drawn.length], [sel, 2, m + 2, 50, 8, 2]);
    for (const u of sel) assert.ok(!run.blind.hand.includes(u) && !cardOf(run, u));
  });

  test('§3.6 The Ladder raises up to 3 cards one rank (Aces stay Aces); The Slide lowers them (2s stay 2s); the hand re-sorts', () => {
    const run = inBlind();
    const sel = setHand(run, ['AS', '9H', '2C']);
    ok(Engine.useConsumable(run, give(run, 'tarot', 'ladder'), sel));
    deq(sel.map((u) => cardOf(run, u).rank), [14, 10, 3]);
    assertSorted(run, 'rank');
    const run2 = inBlind();
    const sel2 = setHand(run2, ['AS', '9H', '2C']);
    ok(Engine.useConsumable(run2, give(run2, 'tarot', 'shrinkray'), sel2));
    deq(sel2.map((u) => cardOf(run2, u).rank), [13, 8, 2]);
    assertSorted(run2, 'rank');
  });

  test("§3.6 The Tailor turns 2-3 cards into the suit of the leftmost one in hand order, and re-sorts", () => {
    const run = inBlind();
    ok(Engine.setSort(run, 'suit'));
    const h = run.blind.hand;
    const sel = [h[5], h[0], h[3]];
    const want = cardOf(run, h[0]).suit;
    const r = ok(Engine.useConsumable(run, give(run, 'tarot', 'paintbucket'), sel));
    assert.equal(r.effect.suit, want);
    for (const u of sel) assert.equal(cardOf(run, u).suit, want);
    assertSorted(run, 'suit');
  });

  test('§3.6 Carbon Copy adds a copy (Enhancement, Edition, Seal and Vintage growth kept) into the draw pile', () => {
    const run = inBlind();
    const [u] = setHand(run, ['QH+vintage+gloss+encore']);
    cardOf(run, u).grow = 12;
    const drawBefore = run.blind.draw.length;
    const r = ok(Engine.useConsumable(run, give(run, 'tarot', 'carboncopy'), [u]));
    const [copyUid] = r.effect.created;
    deq(pick(cardOf(run, copyUid), ['rank', 'suit', 'enhancement', 'edition', 'seal', 'grow']), { rank: 12, suit: 'H', enhancement: 'vintage', edition: 'gloss', seal: 'encore', grow: 12 });
    deq([r.effect.sourceUid, run.cards.length, run.blind.draw.length, run.blind.draw.includes(copyUid)], [u, 53, drawBefore + 1, true]);
  });

  test('§3.6 Busker\'s Hat: $3 plus $1 per Ante, at most $10', () => {
    const run = fresh();
    const gain = (ante) => {
      run.ante = ante;
      return ok(Engine.useConsumable(run, give(run, 'tarot', 'paperroute'), [])).effect.money;
    };
    deq([gain(1), gain(5), gain(9)], [4, 8, 10]);
  });

  test('§3.6 Late Arrival: a random common Joker (paid 0); it needs a free Joker slot and a common Joker you do not own', () => {
    const run = fresh();
    const r = ok(Engine.useConsumable(run, give(run, 'tarot', 'gueststar'), []));
    assert.ok(COMMONS.includes(r.effect.jokerId));
    deq(pick(jokerOf(run, r.effect.jokerUid), ['paid', 'edition']), { paid: 0, edition: null });
    for (const id of UNCOMMONS.slice(0, 4)) Engine.addJoker(run, id);
    fails(Engine.useConsumable(run, give(run, 'tarot', 'gueststar'), []), 'full', 'You need a free Joker slot.');
    const run2 = fresh();
    run2.jokerSlots = 100;
    for (const id of COMMONS) assert.ok(Engine.addJoker(run2, id), id);
    fails(Engine.useConsumable(run2, give(run2, 'tarot', 'gueststar'), []), 'none left', 'There are no common Jokers left to find.');
  });

  test('§3.6 Overtime: +1 hand this Blind; Do-Over: +2 discards this Blind', () => {
    const run = inBlind();
    deq(pick(ok(Engine.useConsumable(run, give(run, 'tarot', 'overtime'), [])).effect, ['hands', 'nextBlind']), { hands: 1, nextBlind: undefined });
    deq(ok(Engine.useConsumable(run, give(run, 'tarot', 'doover'), [])).effect.discards, 2);
    deq([run.blind.handsLeft, run.blind.discardsLeft], [5, 5]);
  });

  test('§3.6 Happy Accident: a 1 in 3 chance of Sheen, Dither or Glitch on a random Joker without an Edition', () => {
    let hits = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const run = fresh({ seed: `HAPPY${i}` });
      const a = Engine.addJoker(run, 'jinglejester', 0, 'gloss');
      const b = Engine.addJoker(run, 'pipsqueak');
      const r = ok(Engine.useConsumable(run, give(run, 'tarot', 'happyaccident'), []));
      assert.equal(jokerOf(run, a.uid).edition, 'gloss');
      if (r.effect.hit) {
        hits += 1;
        assert.equal(r.effect.jokerUid, b.uid);
        assert.ok(['gloss', 'benday', 'fourcolor'].includes(jokerOf(run, b.uid).edition));
      } else {
        assert.equal(jokerOf(run, b.uid).edition, null);
      }
    }
    within(hits / N, 0.26, 0.41, 'hit rate');
    const none = fresh();
    Engine.addJoker(none, 'jinglejester', 0, 'benday');
    fails(Engine.useConsumable(none, give(none, 'tarot', 'happyaccident'), []), 'no plain Joker', 'You need a Joker without an Edition.');
  });

  test('§3.6 Launch Pad: a Planet card for your most-played hand (any hand when none played)', () => {
    const run = fresh();
    run.plays.straight = 4;
    const r = ok(Engine.useConsumable(run, give(run, 'tarot', 'launchpad'), []));
    deq(run.consumables.map((k) => [k.uid, k.kind, k.id]), [[r.effect.created[0], 'planet', 'zoom']]);
    const run2 = fresh();
    give(run2, 'tarot', 'inkpot');
    ok(Engine.useConsumable(run2, give(run2, 'tarot', 'launchpad'), []), 'its own slot makes room');
    assert.ok(run2.consumables[1].id in SPEC_PLANETS);
  });

  test('§3.6 Copycat copies the leftmost other Tarot or Planet card you hold, never a Spectral card or itself', () => {
    const run = fresh();
    run.consumableSlots = 4;
    give(run, 'spectral', 'wormhole');
    const re = give(run, 'tarot', 'reprint');
    give(run, 'planet', 'thwack');
    const r = ok(Engine.useConsumable(run, re, []));
    deq(run.consumables.map((k) => k.id), ['wormhole', 'thwack', 'thwack']);
    assert.equal(r.effect.created[0], run.consumables[2].uid);
    const lone = fresh();
    give(lone, 'spectral', 'wormhole');
    fails(Engine.useConsumable(lone, give(lone, 'tarot', 'reprint'), []), 'nothing to copy', 'You need another Tarot or Planet card.');
  });

  for (const [id, [name, hand]] of Object.entries(SPEC_PLANETS)) {
    test(`§3.7 ${name} levels up ${HAND_NAME[hand]}`, () => {
      const run = fresh();
      const r = ok(Engine.useConsumable(run, give(run, 'planet', id), []));
      deq(pick(r.effect, ['kind', 'id', 'handId', 'levels', 'level']), { kind: 'planet', id, handId: hand, levels: 1, level: 2 });
      for (const h of HAND_IDS) assert.equal(run.levels[h], h === hand ? 2 : 1);
    });
  }

  test('§3.10 Sky Atlas: Planet cards give 2 levels (not Eclipse, which is not a Planet card)', () => {
    const run = fresh();
    run.vouchers.push('skyatlas');
    deq(pick(ok(Engine.useConsumable(run, give(run, 'planet', 'bigbang'), [])).effect, ['levels', 'level']), { levels: 2, level: 3 });
    ok(Engine.useConsumable(run, give(run, 'spectral', 'wormhole'), []));
    deq([run.levels.straightflush, run.levels.pair], [4, 2]);
  });
});

// =========================================================================================
describe('§3.8 Spectral cards', () => {
  const use = (run, id, sel = []) => ok(Engine.useConsumable(run, give(run, 'spectral', id), sel), id);

  test('§3.8 Curtain Call: an Encore Seal on 1 selected card; 1 random other card in hand is destroyed', () => {
    const run = inBlind();
    const [u] = run.blind.hand;
    const r = use(run, 'curtaincall', [u]);
    deq([cardOf(run, u).seal, r.effect.seal, r.effect.destroyed.length, run.cards.length, run.blind.hand.length], ['encore', 'encore', 1, 51, 8]);
    assert.notEqual(r.effect.destroyed[0], u);
    const lone = fresh();
    lone.cards = lone.cards.slice(0, 1);
    ok(Engine.startBlind(lone));
    deq(use(lone, 'curtaincall', lone.blind.hand.slice()).effect.destroyed, [], 'no other card: nothing destroyed');
  });

  test('§3.8 Cursed Coin: a Paid Seal on up to 2 selected cards; lose $5 (never below $0)', () => {
    const run = inBlind();
    run.money = 7;
    const sel = run.blind.hand.slice(0, 2);
    deq(pick(use(run, 'cursedcoin', sel).effect, ['seal', 'moneyLost']), { seal: 'paid', moneyLost: 5 });
    deq([sel.map((u) => cardOf(run, u).seal), run.money], [['paid', 'paid'], 2]);
    assert.equal(use(run, 'cursedcoin', sel.slice(0, 1)).effect.moneyLost, 2);
    assert.equal(run.money, 0);
  });

  test('§3.8 Starfall: an Comet Seal on up to 2 selected cards; -1 discard this Blind (not below 0)', () => {
    const run = inBlind();
    const sel = run.blind.hand.slice(0, 2);
    use(run, 'deadletter', sel);
    deq([sel.map((u) => cardOf(run, u).seal), run.blind.discardsLeft], [['airmail', 'airmail'], 2]);
    run.blind.discardsLeft = 0;
    use(run, 'deadletter', sel.slice(0, 1));
    assert.equal(run.blind.discardsLeft, 0);
  });

  test('§3.8 Apparition: a Cameo Seal on up to 2 selected cards; -1 hand this Blind, needing at least 2 hands left', () => {
    const run = inBlind();
    const sel = run.blind.hand.slice(0, 2);
    use(run, 'apparition', sel);
    deq([sel.map((u) => cardOf(run, u).seal), run.blind.handsLeft], [['cameo', 'cameo'], 3]);
    run.blind.handsLeft = 1;
    fails(Engine.useConsumable(run, give(run, 'spectral', 'apparition'), sel), 'apparition', 'You need at least 2 hands left.');
  });

  test('§3.8 Foxfire: Sheen, Dither or Glitch on 1 selected card; -1 hand size for the rest of this Blind', () => {
    const run = inBlind();
    const [u] = run.blind.hand;
    const r = use(run, 'phantomink', [u]);
    assert.ok(['gloss', 'benday', 'fourcolor'].includes(cardOf(run, u).edition));
    deq([r.effect.edition, r.effect.handSize, run.blind.handSizeDelta, Engine.handSizeNow(run)], [cardOf(run, u).edition, -1, -1, 7]);
    ok(Engine.playHand(run, run.blind.hand.slice(0, 2)));
    assert.equal(run.blind.hand.length, 7);
    clearAndLeave(run);
    assert.equal(Engine.handSizeNow(run), 8, 'only for that Blind');
  });

  test('§3.8 Shadow Play: 1 selected card becomes Phantom; 2 random other cards in hand are destroyed', () => {
    const run = inBlind();
    const [u] = run.blind.hand;
    const r = use(run, 'upsidedown', [u]);
    deq([cardOf(run, u).edition, r.effect.destroyed.length, run.cards.length, run.blind.hand.length], ['inverted', 2, 50, 8]);
    assert.ok(!r.effect.destroyed.includes(u));
  });

  test("§3.8 Poltergeist: Glitch on the leftmost Joker without an Edition; the rightmost Joker is destroyed", () => {
    const run = fresh();
    const a = Engine.addJoker(run, 'jinglejester', 0, 'gloss');
    const b = Engine.addJoker(run, 'pipsqueak');
    const c = Engine.addJoker(run, 'gingerbreadfool');
    const r = use(run, 'hauntedpress');
    deq([jokerOf(run, a.uid).edition, jokerOf(run, b.uid).edition, jokerOf(run, c.uid), r.effect.jokerUid, r.effect.destroyed], ['gloss', 'fourcolor', undefined, b.uid, [c.uid]]);
    const one = fresh();
    Engine.addJoker(one, 'jinglejester');
    fails(Engine.useConsumable(one, give(one, 'spectral', 'hauntedpress'), []), 'one Joker', 'You need at least 2 Jokers.');
    const two = fresh();
    Engine.addJoker(two, 'jinglejester', 0, 'gloss');
    Engine.addJoker(two, 'pipsqueak');
    fails(Engine.useConsumable(two, give(two, 'spectral', 'hauntedpress'), []), 'only the rightmost is plain', 'You need a Joker without an Edition.');
  });

  test('§3.8 Witching Hour: a random Joker without an Edition becomes Phantom; -1 discard every Blind, for good (min 0)', () => {
    const run = fresh();
    const a = Engine.addJoker(run, 'jinglejester', 0, 'benday');
    const b = Engine.addJoker(run, 'pipsqueak');
    use(run, 'midnightedition');
    deq([jokerOf(run, a.uid).edition, jokerOf(run, b.uid).edition, run.discards, Engine.jokerSlotsUsed(run)], ['benday', 'inverted', 2, 1]);
    run.discards = 0;
    Engine.addJoker(run, 'gingerbreadfool');
    use(run, 'midnightedition');
    assert.equal(run.discards, 0);
    fails(Engine.useConsumable(run, give(run, 'spectral', 'midnightedition'), []), 'no plain Joker', 'You need a Joker without an Edition.');
  });

  test('§3.8 Eclipse: every poker hand gains a level; lose half your money, rounded down', () => {
    const run = fresh();
    run.money = 9;
    const r = use(run, 'wormhole');
    deq([r.effect.levelsAll, r.effect.moneyLost, run.money], [1, 4, 5]);
    for (const h of HAND_IDS) assert.equal(run.levels[h], 2);
  });

  test('§3.8 Vanishing Act: destroy up to 4 selected cards and gain $4 for each', () => {
    const run = inBlind();
    const sel = run.blind.hand.slice(0, 4);
    const m = run.money;
    const r = use(run, 'vanishingact', sel);
    deq([r.effect.money, run.money, run.cards.length], [16, m + 16, 48]);
  });

  test('§3.8 Ghost Writer: destroy the leftmost Joker and create a random rare one (uncommon if every rare is taken)', () => {
    const run = fresh();
    const k = Engine.addJoker(run, 'sableknave');
    Engine.addJoker(run, 'bigtop');
    const r = use(run, 'ghostwriter');
    deq(r.effect.destroyed, [k.uid]);
    assert.ok(RARES.includes(r.effect.jokerId) && r.effect.jokerId !== 'bigtop');
    const all = fresh();
    all.jokerSlots = RARES.length;
    for (const id of RARES) assert.ok(Engine.addJoker(all, id), id);
    const r2 = use(all, 'ghostwriter');
    assert.ok(UNCOMMONS.includes(r2.effect.jokerId), `got ${r2.effect.jokerId}`);
    const none = fresh();
    fails(Engine.useConsumable(none, give(none, 'spectral', 'ghostwriter'), []), 'no Joker', 'You need at least 1 Joker.');
  });

  test('§3.8 Doppelganger: destroy the rightmost Joker, then copy the leftmost one fresh (no Edition, new state, paid 0)', () => {
    const run = fresh();
    const a = Engine.addJoker(run, 'gingerbreadfool', 4, 'gloss');
    jokerOf(run, a.uid).state.chips = 30;
    const b = Engine.addJoker(run, 'pipsqueak');
    const r = use(run, 'doppelganger');
    deq(r.effect.destroyed, [b.uid]);
    deq(run.jokers.map((j) => [j.id, j.edition, j.paid, j.state.chips]), [['gingerbreadfool', 'gloss', 4, 30], ['gingerbreadfool', null, 0, 60]]);
    const one = fresh();
    Engine.addJoker(one, 'jinglejester');
    fails(Engine.useConsumable(one, give(one, 'spectral', 'doppelganger'), []), 'one Joker', 'You need at least 2 Jokers.');
  });

  test("§3.8 Wickwisp (decision 'wickwisp'): every card in hand takes the suit of 1 selected card; -1 hand this Blind", () => {
    const run = inBlind();
    run.money = 6;
    const pickU = run.blind.hand[run.blind.hand.length - 1];
    const suit = cardOf(run, pickU).suit;
    const hands = run.blind.handsLeft;
    const r = use(run, 'spellbound', [pickU]);
    for (const u of run.blind.hand) assert.equal(cardOf(run, u).suit, suit);
    deq([r.effect.suit, r.effect.hands, r.effect.moneyLost, run.money, run.blind.handsLeft], [suit, -1, undefined, 6, hands - 1]);
    deq(sorted(r.effect.uids), sorted(run.blind.hand));
    fails(Engine.useConsumable(run, give(run, 'spectral', 'spellbound'), []), 'no card selected', 'Select exactly 1 card.');
    run.blind.handsLeft = 1;
    fails(Engine.useConsumable(run, give(run, 'spectral', 'spellbound'), [run.blind.hand[0]]), '1 hand left', 'You need at least 2 hands left.');
  });

  test('§3.8 Graveyard Shift: 2 random hand cards destroyed, 2 random cards with an Enhancement and a Seal added to the hand', () => {
    const run = inBlind();
    const r = use(run, 'graveyardshift');
    deq([r.effect.destroyed.length, r.effect.created.length, run.cards.length, run.blind.hand.length], [2, 2, 52, 8]);
    for (const u of r.effect.created) {
      const c = cardOf(run, u);
      assert.ok(run.blind.hand.includes(u));
      assert.ok(c.enhancement in SPEC_ENH && c.seal in SPEC_SEALS && c.edition === null, JSON.stringify(c));
    }
    const small = fresh();
    small.cards = small.cards.slice(0, 1);
    ok(Engine.startBlind(small));
    fails(Engine.useConsumable(small, give(small, 'spectral', 'graveyardshift'), []), 'one card', 'You need at least 2 cards in hand.');
  });

  test('§3.8 Hall of Mirrors: 3 copies of 1 selected card join the deck; 2 random other cards in hand are destroyed', () => {
    const run = inBlind();
    const [u] = setHand(run, ['7D+punchy']);
    const r = use(run, 'hallofmirrors', [u]);
    deq([r.effect.created.length, r.effect.destroyed.length, run.cards.length], [3, 2, 53]);
    for (const c of r.effect.created) {
      deq(pick(cardOf(run, c), ['rank', 'suit', 'enhancement']), { rank: 7, suit: 'D', enhancement: 'punchy' });
      assert.ok(run.blind.draw.includes(c) || run.blind.hand.includes(c), 'in the draw pile (or drawn back up)');
    }
  });

  test('§3.8 Tall Tale: a Legendary Joker you do not own (the five of §3.4, then a rare one); -1 hand size for good; it needs a free Joker slot', () => {
    const run = fresh();
    run.jokerSlots = 10;
    const r = use(run, 'originstory');
    assert.ok(LEGENDARIES.includes(r.effect.jokerId), r.effect.jokerId);
    deq([run.handSize, jokerOf(run, r.effect.jokerUid).paid], [7, 0]);
    const got = [r.effect.jokerId];
    for (let i = 0; i < 4; i++) {
      const ri = use(run, 'originstory');
      const ed = jokerOf(run, ri.effect.jokerUid).edition;
      assert.ok(ed === null || ed in SPEC_EDITIONS, `Edition at Shop odds: ${ed}`);
      got.push(ri.effect.jokerId);
    }
    deq(sorted(got), sorted(LEGENDARIES), 'five uses: each Legendary once, never one you own');
    assert.equal(run.handSize, 3);
    const r6 = use(run, 'originstory');
    assert.equal(SPEC_JOKERS[r6.effect.jokerId][1], 'rare', 'every Legendary owned: a rare Joker');
    run.handSize = 1;
    use(run, 'originstory');
    assert.equal(run.handSize, 1, 'never below 1');
    run.jokerSlots = Engine.jokerSlotsUsed(run);
    fails(Engine.useConsumable(run, give(run, 'spectral', 'originstory'), []), 'full', 'You need a free Joker slot.');
    // The test-only Legendary rows join the pool like the real ones.
    const xrun = fresh({}, XEngine);
    xrun.jokerSlots = 10;
    const xs = [];
    for (let i = 0; i < 7; i++) xs.push(ok(XEngine.useConsumable(xrun, give(xrun, 'spectral', 'originstory'), [])).effect.jokerId);
    deq(sorted(xs), sorted([...LEGENDARIES, 'testlegend', 'testlegendb']));
  });

  test('§3.8 Tall Tale with no Legendary Joker in the table creates a rare one', () => {
    const run = fresh({}, NEngine);
    assert.ok(!list(vm.runInContext('TW.Content.JOKERS', nolegContext)).some((r) => r.rarity === 'legendary'), 'no Legendary row');
    const r = ok(NEngine.useConsumable(run, give(run, 'spectral', 'originstory'), []));
    assert.ok(RARES.includes(r.effect.jokerId), r.effect.jokerId);
  });
});

// =========================================================================================
describe('§3.10 Vouchers', () => {
  const buyVoucher = (id) => {
    const run = fresh({ seed: `VBUY${id}` });
    run.anteVoucher = id;
    run.anteVoucherAnte = 1;
    toShop(run);
    run.money = 100;
    ok(Engine.buy(run, run.shop.items.findIndex((it) => it.slot === 'voucher')), `buy ${id}`);
    return run;
  };
  test('§3.10 Long Sleeves, Midnight Oil, Spring Cleaning and Pull Up a Chair raise their run fields at once', () => {
    deq(buyVoucher('musclecourse').handSize, 9);
    deq(buyVoucher('speedcourse').hands, 5);
    deq(buyVoucher('springcleaning').discards, 5);
    deq(buyVoucher('extrapanel').jokerSlots, 6);
  });
  test('§3.10 a bought Voucher is owned, discovered and never offered again', () => {
    const run = buyVoucher('savingsbond');
    deq([run.vouchers, run.discovered.vouchers.includes('savingsbond'), run.anteVoucher], [['savingsbond'], true, null]);
    run.money = 25;
    assert.equal(Engine.interestPreview(run), 5);
    run.money = 99;
    assert.equal(Engine.interestPreview(run), 8);
  });
});

// =========================================================================================
describe('§2.12 Discovery', () => {
  test("§2.12 the Ante 1 Boss Blind and both Tags are seen on the first Blind select; later Antes' are not", () => {
    const run = fresh();
    deq(run.discovered.bosses, [run.bosses[1]]);
    deq(sorted(run.discovered.tags), sorted([...new Set([run.tags['1-0'], run.tags['1-1']])]));
    deq([run.discovered.jokers, run.discovered.vouchers], [[], []]);
  });

  test("§2.12 a new Ante's Boss Blind and Tags are discovered on its Blind select", () => {
    const run = fresh();
    advanceToAnte(run, 2);
    for (const id of [run.bosses[2], run.tags['2-0'], run.tags['2-1']]) assert.ok(run.discovered.bosses.includes(id) || run.discovered.tags.includes(id), id);
  });

  test('§2.12 everything offered in the Shop or a pack is discovered, without duplicates', () => {
    const run = toShop(fresh({ seed: 'DISCOVER' }));
    run.money = 1e6;
    for (let i = 0; i < 30; i++) ok(Engine.reroll(run));
    openPackFromShop(run, 'tarotmega');
    const offered = run.pack.options.map((o) => o.id);
    for (const id of offered) assert.ok(run.discovered.consumables.includes(id));
    for (const key of ['jokers', 'consumables', 'bosses', 'vouchers', 'tags']) assert.equal(new Set(run.discovered[key]).size, run.discovered[key].length, `${key} duplicates`);
    assert.ok(run.discovered.vouchers.includes(run.anteVoucher));
    assert.ok(run.discovered.jokers.length > 5);
  });

  test('§2.12 starting Jokers and consumables, and Tag gains, count as gained', () => {
    deq(fresh({ deckId: 'studio' }).discovered.consumables, ['inkpot', 'boxingglove', 'spotlight']);
    const ht = fresh({ deckId: 'halftone' });
    deq(ht.discovered.jokers, [ht.jokers[0].id]);
    const run = fresh();
    const r = skip(run, 'buddy');
    assert.ok(run.discovered.jokers.includes(r.gained.jokerId));
    const r2 = skip(run, 'tarot');
    for (const id of r2.gained.consumableIds) assert.ok(run.discovered.consumables.includes(id));
  });
});

// =========================================================================================
describe('§2.13 / §4.2 Stats', () => {
  test('§4.2 stats summarise the run: hands, discards, best and most played hand, Blinds, money, seed', () => {
    const run = fresh({ seed: 'STATS001' });
    ok(Engine.startBlind(run));
    ok(Engine.discard(run, run.blind.hand.slice(0, 3)));
    ok(Engine.playHand(run, setHand(run, ['KS', 'KH'])));
    ok(Engine.playHand(run, setHand(run, ['QS', 'QH'])));
    ok(Engine.playHand(run, setHand(run, ['AS'])));
    forceClear(run);
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    skip(run, 'piggybank');
    deq(Engine.stats(run), {
      ante: 1, bestHand: { handId: 'pair', name: 'Pair', score: 64 }, mostPlayed: { handId: 'pair', name: 'Pair', plays: 2 }, // a 2-2 tie goes to the stronger hand
      handsPlayed: 4, cardsDiscarded: 3, blindsCleared: 1, blindsSkipped: 1, moneyEarned: run.stats.moneyEarned, seed: 'STATS001',
    });
    assert.ok(run.stats.moneyEarned >= 6 + 3);
  });
});

// =========================================================================================
describe('§4.1 Run object and §4.2 queries', () => {
  test('§4.1 a new run has the documented v3 shape and defaults', () => {
    const run = fresh();
    deq(sorted(Object.keys(run)), sorted([
      'version', 'seed', 'rng', 'nextUid', 'deckId', 'stake', 'ante', 'blindIndex', 'phase', 'endless', 'won', 'recorded', 'money',
      'hands', 'discards', 'handSize', 'jokerSlots', 'consumableSlots', 'cards', 'jokers', 'consumables', 'levels', 'plays', 'vouchers',
      'bosses', 'tags', 'blindStatus', 'pending', 'sortMode', 'discovered', 'blind', 'shop', 'anteVoucher', 'anteVoucherAnte', 'pack', 'cashout', 'stats',
    ]));
    deq(pick(run, ['version', 'seed', 'deckId', 'stake', 'ante', 'blindIndex', 'phase', 'endless', 'won', 'recorded', 'sortMode', 'blind', 'shop', 'pack', 'cashout', 'anteVoucher', 'anteVoucherAnte']), {
      version: 3, seed: 'TESTSEED', deckId: 'firstissue', stake: 'sunny', ante: 1, blindIndex: 0, phase: 'blind-select', endless: false, won: false,
      recorded: false, sortMode: 'rank', blind: null, shop: null, pack: null, cashout: null, anteVoucher: null, anteVoucherAnte: 0,
    });
    deq(run.pending, { extraHands: 0, extraDiscards: 0, handSizeDelta: 0, targetMult: 1, sale: false });
    deq(sorted(Object.keys(run.discovered)), ['bosses', 'consumables', 'jokers', 'tags', 'vouchers']);
    deq(run.stats, { handsPlayed: 0, cardsPlayed: 0, cardsDiscarded: 0, blindsCleared: 0, blindsSkipped: 0, moneyEarned: 0, consumablesUsed: 0, rerolls: 0, bestHand: null });
    deq(sorted(Object.keys(run.levels)), sorted(HAND_IDS));
    for (const h of HAND_IDS) deq([run.levels[h], run.plays[h]], [1, 0]);
  });

  test('§4.2 newRun without a seed picks one with randomSeed; randomSeed is 8 characters from A-Z and 2-9 without O, I, 0 or 1', () => {
    assert.match(Engine.newRun({}).seed, /^[A-HJ-NP-Z2-9]{8}$/);
    for (let i = 0; i < 50; i++) assert.match(Engine.randomSeed(), /^[A-HJ-NP-Z2-9]{8}$/);
    assert.equal(Engine.newRun({ seed: '  ABC  ' }).seed, 'ABC');
  });

  test('§4.1 the run stays plain JSON in every phase, a dealt pack hand included', () => {
    const run = fresh({ deckId: 'rubberstamp', seed: 'PLAINJSN' });
    Engine.addJoker(run, 'fortunecookie', 8, 'gloss');
    assertPlainJSON(run, 'blind-select');
    ok(Engine.startBlind(run));
    assertPlainJSON(run, 'play');
    forceClear(run);
    assertPlainJSON(run, 'cashout');
    ok(Engine.collect(run));
    assertPlainJSON(run, 'shop');
    openPackFromShop(run, 'ghostmega');
    assertPlainJSON(run, 'pack');
    ok(Engine.packSkip(run));
    ok(Engine.leaveShop(run));
    ok(Engine.startBlind(run));
    for (let i = 0; i < 4; i++) ok(Engine.playHand(run, oneCard(run)));
    assert.equal(run.phase, 'gameover');
    assertPlainJSON(run, 'gameover');
  });

  test('§4.2 the same seed plus the same actions gives the same run, packs and consumables included', () => {
    const script = (E) => {
      const run = E.newRun({ seed: 'SAMESEED', deckId: 'spooky' });
      E.startBlind(run);
      E.useConsumable(run, run.consumables[0].uid, [run.blind.hand[0]]);
      E.discard(run, run.blind.hand.slice(0, 2));
      E.playHand(run, run.blind.hand.slice(0, 3));
      run.blind.score = run.blind.target;
      E.playHand(run, run.blind.hand.slice(0, 1));
      E.collect(run);
      run.money = 50;
      E.reroll(run);
      const i = run.shop.items.findIndex((it) => it.slot === 'pack');
      E.buy(run, i);
      if (run.phase === 'pack') E.packPick(run, 0, run.pack.hand ? run.pack.hand.slice(0, 1) : []);
      if (run.phase === 'pack') E.packSkip(run);
      E.leaveShop(run);
      run.tags['1-1'] = 'ghost';
      E.skipBlind(run);
      return E.serialize(run);
    };
    assert.equal(script(Engine), script(Engine));
    const other = makeContext();
    assert.equal(script(vm.runInContext('TW.Engine', other)), script(Engine), 'a fresh context gives the same run');
  });

  test('§4.2 serialize/deserialize round-trips a run, and the RNG carries on exactly like the original', () => {
    const run = inBlind({ seed: 'ROUNDTRP' });
    Engine.addJoker(run, 'gingerbreadfool', 4, 'benday');
    const copy = Engine.deserialize(Engine.serialize(run));
    deq(copy, run);
    ok(Engine.discard(run, run.blind.hand.slice(0, 3)));
    ok(Engine.discard(copy, copy.blind.hand.slice(0, 3)));
    deq(copy, run);
  });

  test('§4.2 deserialize returns null for bad JSON, a wrong version (a v2 run) or a broken shape, and never throws', () => {
    const good = JSON.parse(Engine.serialize(fresh()));
    for (const bad of ['', '{', 'null', '[]', '42', JSON.stringify({ ...good, version: 2 }), JSON.stringify({ ...good, jokers: undefined, charms: [] }), JSON.stringify({ ...good, phase: 'watch-select' }), JSON.stringify({ ...good, rng: 'x' })]) {
      assert.doesNotThrow(() => Engine.deserialize(bad));
      assert.equal(Engine.deserialize(bad), null, bad.slice(0, 40));
    }
    assert.equal(Engine.deserialize(undefined), null);
  });

  test('§4.2 queries are pure: they never change the run', () => {
    const run = inBlind({ seed: 'PUREQRY1' });
    const j = Engine.addJoker(run, 'fortunecookie');
    const k = give(run, 'tarot', 'inkpot');
    const before = Engine.serialize(run);
    const h = run.blind.hand;
    Engine.getCard(run, h[0]);
    Engine.blindsForAnte(run);
    Engine.currentBlindInfo(run);
    Engine.preview(run, h.slice(0, 2));
    Engine.scoreCards(run, h.slice(0, 2).map((u) => cardOf(run, u)), []);
    Engine.handTable(run);
    Engine.deckView(run);
    Engine.jokerText(run, j.uid);
    Engine.jokerSellValue(run, j.uid);
    Engine.jokerSlotsUsed(run);
    Engine.consumableInfo(run, k);
    Engine.consumableSellValue(run, k);
    Engine.canUseConsumable(run, k, h.slice(0, 1));
    Engine.canBuy(run, 0);
    Engine.canPackPick(run, 0);
    Engine.canPlay(run, h.slice(0, 2));
    Engine.canDiscard(run, h.slice(0, 2));
    Engine.canSell(run);
    Engine.interestPreview(run);
    Engine.rerollCost(run);
    Engine.handSizeNow(run);
    Engine.blindTarget(run, 2, 1);
    Engine.cardText(run, h[0]);
    Engine.stats(run);
    assert.equal(Engine.serialize(run), before);
  });

  test('§4.2 getCard, preview and handTable', () => {
    const run = inBlind();
    const u = run.blind.hand[0];
    assert.equal(Engine.getCard(run, u).uid, u);
    assert.equal(Engine.getCard(run, 'c99999'), null);
    run.levels.pair = 2;
    const [a, b] = setHand(run, ['KS', 'KH']);
    deq(Engine.preview(run, [b, a]), { handId: 'pair', name: 'Pair', level: 2, chips: 28, mult: 3, scoringUids: [a, b] });
    assert.equal(Engine.preview(run, []), null);
    assert.equal(Engine.preview(run, [a, a]), null);
    deq(Engine.handTable(run).map((t) => t.handId), HAND_IDS);
  });

  test('§4.2 deckView: every card in suit order then rank descending; remaining is the draw pile during a Blind', () => {
    const run = fresh();
    const v = Engine.deckView(run);
    deq(v.cards.map((c) => `${c.rank}${c.suit}`).slice(0, 3), ['14S', '13S', '12S']);
    assert.equal(v.remaining.length, 52);
    ok(Engine.startBlind(run));
    deq(Engine.deckView(run).remaining, run.blind.draw);
  });

  test('§4.2 reorderJokers reorders by uid and rejects anything that is not the same set', () => {
    const run = fresh();
    const a = Engine.addJoker(run, 'jinglejester');
    const b = Engine.addJoker(run, 'pipsqueak');
    ok(Engine.reorderJokers(run, [b.uid, a.uid]));
    deq(run.jokers.map((j) => j.uid), [b.uid, a.uid]);
    fails(Engine.reorderJokers(run, [a.uid]), 'reorderJokers', "That order doesn't match your Jokers.");
    fails(Engine.reorderJokers(run, [a.uid, a.uid]));
  });

  test('§4.2 cardText: the card name, then its Enhancement, Edition and Seal lines', () => {
    const run = inBlind();
    const [u] = setHand(run, ['QH+vintage+gloss+encore']);
    cardOf(run, u).grow = 8;
    deq(Engine.cardText(run, u), [
      'Queen of Hearts',
      `Vintage: ${entry(Content.ENHANCEMENTS, 'vintage').text} (stored +8, next +12)`, // changed 2026-11-23 (Jokers): was "(now +8)"
      `Sheen: ${entry(Content.EDITIONS, 'gloss').cardText}`,
      `Encore Seal: ${entry(Content.SEALS, 'encore').text}`,
    ]);
    deq(Engine.cardText(run, Engine.makeCard(2, 'C')), ['Two of Clubs']);
    deq(Engine.cardText(run, 'c99999'), []);
  });
});

// =========================================================================================
describe('§4.4 Invalid actions return { ok:false, error } and never throw', () => {
  function expectFail(run, fn, ...args) {
    const before = Engine.serialize(run);
    let res;
    assert.doesNotThrow(() => {
      res = Engine[fn](run, ...args);
    }, `Engine.${fn} threw in phase ${run.phase}`);
    fails(res, `Engine.${fn}(${args.map((x) => JSON.stringify(x)).join(', ')}) in ${run.phase}`);
    assert.equal(Engine.serialize(run), before, `Engine.${fn} changed the run while failing`);
    return res;
  }

  test('§4.4 at Blind select', () => {
    const run = fresh();
    assert.equal(expectFail(run, 'playHand', [run.cards[0].uid]).error, "You can't play a hand right now.");
    assert.equal(expectFail(run, 'discard', [run.cards[0].uid]).error, "You can't discard right now.");
    assert.equal(expectFail(run, 'collect').error, 'There is nothing to cash out.');
    assert.equal(expectFail(run, 'buy', 0).error, 'The Shop is closed.');
    expectFail(run, 'reroll');
    assert.equal(expectFail(run, 'packPick', 0).error, 'No Booster Pack is open.');
    expectFail(run, 'packSkip');
    assert.equal(expectFail(run, 'leaveShop').error, "You're not in the Shop.");
    assert.equal(expectFail(run, 'goEndless').error, "The run isn't won yet.");
    expectFail(run, 'sellJoker', 'h99999');
    assert.equal(expectFail(run, 'sellConsumable', 'k99999').error, "That card isn't in your consumable slots.");
    expectFail(run, 'useConsumable', 'k99999', []);
    expectFail(run, 'reorderJokers', ['h99999']);
    expectFail(run, 'reorderHand', []);
    assert.equal(expectFail(run, 'setSort', 'banana').error, 'Sort by rank or suit.');
  });

  test('§4.4 during a Blind', () => {
    const run = inBlind();
    const hand = run.blind.hand.slice();
    assert.equal(expectFail(run, 'startBlind').error, 'There is no Blind to start right now.');
    expectFail(run, 'skipBlind');
    assert.equal(expectFail(run, 'playHand', []).error, 'Select 1 to 5 cards to play.');
    expectFail(run, 'playHand', hand.slice(0, 6));
    assert.equal(expectFail(run, 'playHand', ['zzz']).error, 'Select cards from your hand.');
    expectFail(run, 'playHand', run.blind.draw.slice(0, 1));
    expectFail(run, 'playHand', null);
    expectFail(run, 'playHand', undefined);
    assert.equal(expectFail(run, 'discard', []).error, 'Select 1 to 5 cards to discard.');
    expectFail(run, 'discard', hand.slice(0, 6));
    expectFail(run, 'discard', null);
    expectFail(run, 'discard', undefined);
    expectFail(run, 'reorderHand', hand.slice(1));
    expectFail(run, 'reorderHand', [...hand.slice(1), 'zzz']);
    expectFail(run, 'collect');
    expectFail(run, 'buy', 0);
    expectFail(run, 'leaveShop');
    expectFail(run, 'packPick', 0);
    expectFail(run, 'goEndless');
    run.blind.handsLeft = 0;
    assert.equal(expectFail(run, 'playHand', hand.slice(0, 1)).error, 'No hands left this Blind.');
  });

  test('§4.4 at cash-out', () => {
    const run = inBlind();
    const j = Engine.addJoker(run, 'jinglejester', 4);
    forceClear(run);
    expectFail(run, 'playHand', [run.cards[0].uid]);
    expectFail(run, 'discard', [run.cards[0].uid]);
    expectFail(run, 'startBlind');
    expectFail(run, 'skipBlind');
    expectFail(run, 'buy', 0);
    expectFail(run, 'reroll');
    expectFail(run, 'leaveShop');
    expectFail(run, 'goEndless');
    expectFail(run, 'sellJoker', j.uid);
  });

  test('§4.4 in the Shop', () => {
    const run = toShop(fresh());
    run.money = 0;
    assert.equal(expectFail(run, 'buy', 99).error, 'There is nothing for sale there.');
    expectFail(run, 'buy', -1);
    expectFail(run, 'buy', 'x');
    expectFail(run, 'buy', run.shop.items.findIndex((i) => i.slot === 'voucher'));
    expectFail(run, 'reroll');
    expectFail(run, 'startBlind');
    expectFail(run, 'skipBlind');
    expectFail(run, 'playHand', [run.cards[0].uid]);
    expectFail(run, 'collect');
    expectFail(run, 'packPick', 0);
    expectFail(run, 'goEndless');
    fails(Engine.canBuy(run, 99));
  });

  test('§4.4 in an open pack', () => {
    const run = fresh();
    run.tags['1-0'] = 'grabbag';
    ok(Engine.skipBlind(run));
    assert.equal(expectFail(run, 'packPick', 6).error, "Pick one of the pack's cards.");
    expectFail(run, 'packPick', -1);
    expectFail(run, 'packPick', 'x');
    expectFail(run, 'startBlind');
    expectFail(run, 'skipBlind');
    expectFail(run, 'leaveShop');
    expectFail(run, 'buy', 0);
    expectFail(run, 'reroll');
    expectFail(run, 'collect');
  });

  test('§4.4 after Game Over', () => {
    const run = inBlind();
    for (let i = 0; i < 4; i++) ok(Engine.playHand(run, oneCard(run)));
    assert.equal(run.phase, 'gameover');
    expectFail(run, 'playHand', [run.cards[0].uid]);
    expectFail(run, 'discard', [run.cards[0].uid]);
    expectFail(run, 'startBlind');
    expectFail(run, 'skipBlind');
    expectFail(run, 'collect');
    expectFail(run, 'leaveShop');
    expectFail(run, 'goEndless');
    expectFail(run, 'useConsumable', give(run, 'tarot', 'paperroute'), []);
  });

  test('§4.4 a missing or broken run gives a failed result or an empty answer, never an exception', () => {
    for (const bad of [null, undefined, {}, { cards: [] }, 42]) {
      assert.doesNotThrow(() => {
        fails(Engine.startBlind(bad));
        fails(Engine.playHand(bad, []));
        fails(Engine.packPick(bad, 0));
        assert.equal(Engine.scoreCards(bad, []), null);
        deq(Engine.blindsForAnte(bad), []);
        deq(Engine.cardText(bad, 'c1'), []);
        assert.equal(Engine.addJoker(bad, 'jinglejester'), null);
        assert.equal(Engine.jokerSlotsUsed(bad), 0);
      });
    }
  });

  // Added 2026-11-23 (engine reconcile). The black-box Joker suite found that buying a Shop Joker whose
  // id has no row took the money and added nothing; §4 says an invalid action fails and changes nothing.
  test('§4.4 a Shop item or pack option whose id has no content row is refused, and nothing changes', () => {
    const run = toShop(fresh());
    run.money = 50;
    const items = [
      { slot: 'card', kind: 'joker', id: 'nosuchjoker', price: 6, sold: false, edition: null, size: null },
      { slot: 'card', kind: 'tarot', id: 'nosuchtarot', price: 3, sold: false, edition: null, size: null },
      { slot: 'voucher', kind: 'voucher', id: 'nosuchvoucher', price: 10, sold: false, edition: null, size: null },
      { slot: 'pack', kind: 'pack', id: 'nosuchpack', price: 4, sold: false, edition: null, size: 'normal' },
      { slot: 'card', kind: 'joker', id: 'jinglejester', price: NaN, sold: false, edition: null, size: null },
      { slot: 'card', kind: 'sticker', id: 'jinglejester', price: 1, sold: false, edition: null, size: null },
    ];
    run.shop.items.push(...items);
    const first = run.shop.items.length - items.length;
    for (let i = first; i < run.shop.items.length; i++) {
      assert.equal(Engine.canBuy(run, i).error, 'There is nothing for sale there.', `canBuy item ${i}`);
      assert.equal(expectFail(run, 'buy', i).error, 'There is nothing for sale there.');
    }
    assert.equal(run.money, 50);
    // pack options: an unknown Joker, an unknown Tarot card, a card that is not a card, a card already in the deck
    const pack = fresh();
    pack.tags['1-0'] = 'grabbag';
    ok(Engine.skipBlind(pack));
    pack.pack.options = [
      { kind: 'joker', id: 'nosuchjoker', edition: null, picked: false },
      { kind: 'tarot', id: 'nosuchtarot', picked: false },
      { kind: 'card', card: { uid: 'c9999', rank: 1, suit: 'S' }, picked: false },
      { kind: 'card', card: Object.assign({}, pack.cards[0]), picked: false },
      { kind: 'sticker', id: 'x', picked: false },
    ];
    for (let i = 0; i < pack.pack.options.length; i++) {
      assert.equal(Engine.canPackPick(pack, i, []).error, "Pick one of the pack's cards.", `canPackPick option ${i}`);
      assert.equal(expectFail(pack, 'packPick', i, []).error, "Pick one of the pack's cards.");
    }
  });

  test('§4.4 with Engine.debug off, addJoker, serialize and applyRunToRecords never throw on a malformed run', () => {
    const run = fresh();
    run.jokers = [{ uid: 'h1', id: 'jinglejester', get edition() { throw new Error('broken'); } }];
    assert.doesNotThrow(() => assert.equal(Engine.addJoker(run, 'tindrum'), null));
    const loop = fresh();
    loop.self = loop; // JSON can't hold it
    assert.doesNotThrow(() => assert.equal(Engine.serialize(loop), null));
    const odd = fresh();
    odd.discovered = { jokers: 'x' };
    Object.defineProperty(odd, 'ante', { get() { throw new Error('broken'); } });
    let res;
    assert.doesNotThrow(() => { res = Engine.applyRunToRecords(Engine.defaultRecords(), odd, { final: true, now: 't' }); });
    deq(res.unlocked, []);
    deq(res.records, Engine.defaultRecords());
  });
});

// =========================================================================================
describe('§4.2 Records', () => {
  const unlockKeys = (unlocked) => sorted(plain(unlocked).map((u) => `${u.type}:${u.id}:${u.name}`));
  const runAt = (ante, opts = {}) => {
    const run = fresh(opts);
    run.ante = ante;
    return run;
  };

  test('§4.2 defaultRecords (version 2)', () => {
    deq(Engine.defaultRecords(), {
      version: 2, runs: 0, wins: 0, bestAnte: 0, bestHand: null,
      unlockedDecks: ['firstissue', 'speedlines', 'sketchbook'], unlockedStakes: ['sunny'], wonOn: [], history: [],
      discovered: { jokers: [], consumables: [], bosses: [], vouchers: [], tags: [] },
    });
  });

  test('§4.2 applyRunToRecords returns a new records object and leaves the input untouched', () => {
    const rec = Engine.defaultRecords();
    const before = JSON.stringify(rec);
    const out = Engine.applyRunToRecords(rec, runAt(3), { final: false });
    assert.notEqual(out.records, rec);
    assert.equal(JSON.stringify(rec), before);
  });

  test('§4.2 unlocks: Panorama at Ante 3, Bargain Bin 4, Studio 5, Rubber Stamp 6, Halftone 7', () => {
    const at = (ante) => unlockKeys(Engine.applyRunToRecords(Engine.defaultRecords(), runAt(ante)).unlocked);
    deq(at(2), []);
    deq(at(3), ['deck:panorama:Candelabra Deck']);
    deq(at(7), sorted(['deck:panorama:Candelabra Deck', 'deck:bargainbin:Rags to Riches Deck', 'deck:studio:Parlour Deck', 'deck:rubberstamp:Gift-Wrapped Deck', 'deck:halftone:Mirrorball Deck']));
  });

  test('§4.2 Deck unlocks follow bestAnte, not only this run', () => {
    const rec = Engine.applyRunToRecords(Engine.defaultRecords(), runAt(5)).records;
    const out = Engine.applyRunToRecords(rec, runAt(1));
    deq([out.records.bestAnte, out.unlocked.length], [5, 0]);
    assert.ok(out.records.unlockedDecks.includes('studio'));
  });

  test('§4.2 bestHand keeps the highest score, with the hand name; discovered sets merge without duplicates', () => {
    const run = fresh();
    run.stats.bestHand = { handId: 'flush', score: 900 };
    run.discovered.jokers.push('jinglejester');
    run.discovered.vouchers.push('skyatlas');
    let rec = Engine.applyRunToRecords(Engine.defaultRecords(), run).records;
    deq(rec.bestHand, { handId: 'flush', name: 'Flush', score: 900 });
    run.stats.bestHand = { handId: 'pair', score: 100 };
    rec = Engine.applyRunToRecords(rec, run).records;
    deq(rec.bestHand.score, 900);
    deq([rec.discovered.jokers, rec.discovered.vouchers], [['jinglejester'], ['skyatlas']]);
    assert.ok(rec.discovered.bosses.includes(run.bosses[1]) && rec.discovered.tags.includes(run.tags['1-0']));
  });

  // Added 2026-11-23 (Jokers): version 2 records saved before the 120-Joker table hold the 27 v2
  // Joker ids; they map through oldId like version 1 records do, and unknown ids are dropped.
  test('§4.2 normalizeRecords maps version 2 records through oldId: the v2 Joker ids become the 120-Joker ids, unknown ids are dropped', () => {
    const v2 = {
      version: 2, runs: 4, wins: 1, bestAnte: 5, bestHand: { handId: 'pair', name: 'Pair', score: 300 },
      unlockedDecks: ['firstissue', 'speedlines', 'sketchbook', 'panorama'], unlockedStakes: ['sunny', 'uhoh'], wonOn: ['sunny'], history: [],
      discovered: {
        jokers: ['anchor', 'jinglejester', 'treasuremap', 'goldtooth', 'mudskipper', 'nope', 'candleking', 'fishhook', 42, 'constructor'],
        consumables: ['inkpot', 'springtide', 'nope'], bosses: ['heckler', 'siren', 'maelstrom', 'nope'],
        vouchers: ['skyatlas', 'charttable', 'nope'], tags: ['sky', 'bottle', 'nope'],
      },
    };
    const before = JSON.stringify(v2);
    const r = Engine.normalizeRecords(v2);
    deq(r.discovered, {
      jokers: ['jinglejester', 'fortunecookie', 'goldtooth', 'candleking', 'sleightofhand'],
      consumables: ['inkpot'], bosses: ['heckler', 'bigfinish'], vouchers: ['skyatlas'], tags: ['sky', 'piggybank'],
    });
    deq(pick(r, ['version', 'runs', 'wins', 'bestAnte', 'unlockedStakes', 'wonOn']), { version: 2, runs: 4, wins: 1, bestAnte: 5, unlockedStakes: ['sunny', 'uhoh'], wonOn: ['sunny'] });
    assert.equal(JSON.stringify(v2), before, 'the input is untouched');
    for (const [oldId, [id]] of Object.entries(OLD_JOKER_IDS)) {
      deq(Engine.normalizeRecords({ version: 2, discovered: { jokers: [oldId] } }).discovered.jokers, [id], oldId);
      deq(Engine.normalizeRecords({ version: 1, discovered: { charms: [oldId] } }).discovered.jokers, [id], `v1 ${oldId}`);
    }
    deq(Engine.normalizeRecords({ version: 2, discovered: { jokers: JOKER_IDS } }).discovered.jokers, JOKER_IDS, 'every current id is kept');
  });

  test('§4.2 applyRunToRecords records a run\'s discovered ids by the same map (current ids kept, v2 Joker ids renamed, unknown ones dropped)', () => {
    const run = fresh();
    run.discovered.jokers.push('pipsqueak', 'gull', 'nope');
    run.discovered.vouchers.push('hammock');
    const rec = Engine.applyRunToRecords(Engine.defaultRecords(), run).records;
    deq([rec.discovered.jokers, rec.discovered.vouchers], [['pipsqueak'], ['musclecourse']]);
  });

  test('§4.2 deserialize renames the Jokers of a run saved before the 120-Joker table (v2 ids) through oldId, and the run plays on', () => {
    const run = inBlind({ seed: 'OLDSAVE1' });
    const gb = Engine.addJoker(run, 'gingerbreadfool');
    const fc = Engine.addJoker(run, 'fortunecookie');
    jokerOf(run, gb.uid).state.chips = 45;
    jokerOf(run, fc.uid).state.rank = 13;
    const old = JSON.parse(Engine.serialize(run));
    old.jokers[0].id = 'biscuit';
    old.jokers[1].id = 'treasuremap';
    old.discovered.jokers = ['biscuit', 'treasuremap', 'gingerbreadfool'];
    const back = Engine.deserialize(JSON.stringify(old));
    deq(back.jokers.map((j) => [j.id, j.state]), [['gingerbreadfool', { chips: 45 }], ['fortunecookie', { rank: 13 }]]);
    deq(back.discovered.jokers, ['gingerbreadfool', 'fortunecookie']);
    const r = Engine.scoreCards(back, mks('KS KH'), []);
    deq([r.chips, r.total, r.steps.filter((s) => s.kind === 'money').length], [77, 154, 2], 'Gingerbread Fool +45 Chips, Fortune Cookie +$2 on each King');
    const same = Engine.deserialize(Engine.serialize(run));
    deq(same, run, 'a current save is unchanged');
  });

  test('§4.2 a final lost run counts once and adds a history entry', () => {
    const run = runAt(2, { deckId: 'speedlines', stake: 'sunny' });
    run.stats.bestHand = { handId: 'pair', score: 120 };
    const first = Engine.applyRunToRecords(Engine.defaultRecords(), run, { final: true, now: '2026-11-23T10:00' });
    deq(pick(first.records, ['runs', 'wins']), { runs: 1, wins: 0 });
    // seed: the run's seed, added 2026-11-24 (final pass), so the entry of a won run can follow it into Endless mode
    deq(first.records.history, [{ at: '2026-11-23T10:00', deckId: 'speedlines', stake: 'sunny', ante: 2, won: false, bestScore: 120, seed: 'TESTSEED' }]);
    assert.equal(run.recorded, true);
    const again = Engine.applyRunToRecords(first.records, run, { final: true, now: 'later' });
    deq([again.records.runs, again.records.history], [1, first.records.history], 'a recorded run that is not in Endless mode changes nothing more');
  });

  test('§4.2 a non-final call never counts a run or a win', () => {
    const run = runAt(8);
    run.won = true;
    const out = Engine.applyRunToRecords(Engine.defaultRecords(), run, { final: false });
    deq(pick(out.records, ['runs', 'wins']), { runs: 0, wins: 0 });
    assert.equal(run.recorded, false);
  });

  test('§4.2 a final win counts a win and unlocks the High Roller Deck and the next Stake, in a chain; the Spooky Deck from Uh-Oh up', () => {
    const win = (rec, stake) => {
      const run = runAt(8, { stake });
      run.won = true;
      return Engine.applyRunToRecords(rec, run, { final: true, now: stake });
    };
    let out = win(Engine.defaultRecords(), 'sunny');
    deq(unlockKeys(out.unlocked), sorted(['deck:panorama:Candelabra Deck', 'deck:bargainbin:Rags to Riches Deck', 'deck:studio:Parlour Deck', 'deck:rubberstamp:Gift-Wrapped Deck', 'deck:halftone:Mirrorball Deck', 'deck:mintcondition:High Roller Deck', 'stake:uhoh:Nightfall Stake']));
    deq(pick(out.records, ['runs', 'wins', 'wonOn']), { runs: 1, wins: 1, wonOn: ['sunny'] });
    assert.ok(!out.records.unlockedDecks.includes('spooky'));
    out = win(out.records, 'uhoh');
    deq(unlockKeys(out.unlocked), ['deck:spooky:Spooky Deck', 'stake:gulp:Moonless Stake']);
    out = win(out.records, 'gulp');
    deq(unlockKeys(out.unlocked), ['stake:yikes:Last Candle Stake']);
    out = win(out.records, 'yikes');
    deq([out.unlocked.length, out.records.wins, sorted(out.records.wonOn)], [0, 4, ['gulp', 'sunny', 'uhoh', 'yikes']]);
  });

  test('§4.2 history keeps the last 12 runs', () => {
    let rec = Engine.defaultRecords();
    for (let i = 0; i < 15; i++) rec = Engine.applyRunToRecords(rec, runAt(1), { final: true, now: `t${i}` }).records;
    deq([rec.runs, rec.history.length, rec.history[0].at, rec.history[11].at], [15, 12, 't3', 't14']);
  });

  test('§4.2 normalizeRecords migrates version 1 records: fields renamed, old ids mapped, unknown ids dropped', () => {
    const v1 = {
      version: 1, voyages: 7, wins: 2, bestAnte: 6, bestHand: { handId: 'flush', name: 'Flush', score: 1500 },
      unlockedDecks: ['dinghy', 'clipper', 'trawler', 'lantern', 'tender', 'sloop'], unlockedSeaStates: ['calm', 'choppy'], wonOn: ['calm'],
      history: [{ at: 'a', deckId: 'tender', seaState: 'choppy', ante: 8, won: true, bestScore: 1500 }],
      discovered: { charms: ['anchor', 'mudskipper', 'kelpforest', 'treasuremap'], consumables: ['springtide', 'polaris', 'nope'], bosses: ['siren', 'doldrums', 'maelstrom'] },
    };
    // The v2 charm ids map to the 120-Joker ids through oldId (anchor -> Jingle Jester, kelpforest -> The
    // Paperclip, treasuremap -> Fortune Cookie); the tide charm mudskipper has no row and is dropped.
    deq(Engine.normalizeRecords(v1), {
      version: 2, runs: 7, wins: 2, bestAnte: 6, bestHand: { handId: 'flush', name: 'Flush', score: 1500 },
      unlockedDecks: ['firstissue', 'speedlines', 'sketchbook', 'panorama', 'rubberstamp', 'mintcondition'], unlockedStakes: ['sunny', 'uhoh'], wonOn: ['sunny'],
      history: [{ at: 'a', deckId: 'rubberstamp', stake: 'uhoh', ante: 8, won: true, bestScore: 1500 }],
      discovered: { jokers: ['jinglejester', 'paperclip', 'fortunecookie'], consumables: ['inkpot', 'blip'], bosses: ['heckler', 'squeeze', 'bigfinish'], vouchers: [], tags: [] },
    });
    deq(Engine.normalizeRecords({ version: 99, runs: 5 }), Engine.defaultRecords(), 'an unknown version gives fresh records');
    deq(Engine.normalizeRecords('junk'), Engine.defaultRecords());
    const rec = Engine.applyRunToRecords(v1, runAt(1)).records;
    deq([rec.version, rec.runs, rec.unlockedStakes], [2, 7, ['sunny', 'uhoh']]);
  });

  test('§4.2 records from a real run', () => {
    const run = fresh({ seed: 'REALRUN1' });
    clearAndLeave(run);
    ok(Engine.startBlind(run));
    for (let i = 0; i < 4; i++) ok(Engine.playHand(run, oneCard(run)));
    const out = Engine.applyRunToRecords(Engine.defaultRecords(), run, { final: true, now: 'n' });
    deq(pick(out.records, ['runs', 'wins', 'bestAnte']), { runs: 1, wins: 0, bestAnte: 1 });
    assert.ok(out.records.bestHand && out.records.bestHand.score > 0);
    assert.ok(out.records.discovered.jokers.length > 0 || out.records.discovered.consumables.length > 0);
  });

  // Final pass (2026-11-24), REQUESTS.md "an Endless run's last Ante is never filed": a run is filed
  // when it is won (phase 'win'), so the final call at its Endless Game Over returned early and
  // Past runs kept "You win!, Ante 8" with the win's best hand. Now the history entry of an Endless
  // run follows it (§4.2). The first test is the repro and failed before the fix (Ante 8, best 16).
  /** Wins a run at Ante 8 with a lone Ace (High Card: 5 + 11 = 16) and files it, as the UI does at You win!. */
  function wonAndFiled(seed, opts = {}) {
    const run = fresh({ seed, deckId: 'speedlines', ...opts });
    run.ante = 8;
    toBoss(run);
    setHand(run, ['AS']);
    forceClear(run);
    assert.equal(run.phase, 'win');
    const rec = Engine.applyRunToRecords(Engine.defaultRecords(), run, { final: true, now: 'won' }).records;
    return { run, rec };
  }
  /** From You win! into Endless mode: the cash-out, the Shop and Ante 9's Blind select. */
  function intoEndless(run) {
    ok(Engine.goEndless(run));
    ok(Engine.collect(run));
    ok(Engine.leaveShop(run));
    assert.equal(run.ante, 9);
  }
  /** Plays a Flush (A K Q J 9 of Spades: (38 + 50) x 4 = 352) as the Blind's last hand, which loses it. */
  function loseOnAFlush(run) {
    ok(Engine.startBlind(run));
    run.blind.handsLeft = 1;
    const r = ok(Engine.playHand(run, setHand(run, ['AS', 'KS', 'QS', 'JS', '9S'])));
    deq([r.result.total, r.lost, run.phase], [352, true, 'gameover']);
  }

  test("§4.2 final pass: an Endless run's Game Over files the Ante it reached and its best hand on the history entry of its win (the repro: it kept Ante 8)", () => {
    const { run, rec: won } = wonAndFiled('ENDLESS1');
    const FIELDS = ['at', 'deckId', 'stake', 'ante', 'won', 'bestScore'];
    deq([won.history.length, pick(won.history[0], FIELDS)], [1, { at: 'won', deckId: 'speedlines', stake: 'sunny', ante: 8, won: true, bestScore: 16 }]);
    intoEndless(run);
    loseOnAFlush(run);
    const out = Engine.applyRunToRecords(won, run, { final: true, now: 'lost' });
    deq([out.records.history.length, pick(out.records.history[0], FIELDS)], [1, { at: 'won', deckId: 'speedlines', stake: 'sunny', ante: 9, won: true, bestScore: 352 }],
      'the entry reads You win!, Ante 9, best 352; it keeps the time it was filed');
    deq(pick(out.records, ['runs', 'wins', 'bestAnte']), { runs: 1, wins: 1, bestAnte: 9 }, 'the run and the win are counted once');
    deq(out.records.history[0].seed, 'ENDLESS1', 'the entry names the run by its seed (added 2026-11-24)');
    deq(out.records.bestHand, { handId: 'flush', name: 'Flush', score: 352 });
    deq(out.unlocked, []);
    assert.equal(run.recorded, true);
    deq(Engine.applyRunToRecords(out.records, run, { final: true, now: 'again' }).records, out.records, 'a second final call changes nothing');
  });

  test('§4.2 final pass: the Endless entry follows the run on every call, so a run saved and left in Endless mode (or abandoned) still shows its last Ante', () => {
    const { run, rec: won } = wonAndFiled('ENDLESS2');
    ok(Engine.goEndless(run));
    ok(Engine.collect(run));
    let rec = Engine.applyRunToRecords(won, run).records;
    deq(pick(rec.history[0], ['ante', 'bestScore']), { ante: 8, bestScore: 16 }, 'in the Shop after the win: still Ante 8');
    ok(Engine.leaveShop(run));
    rec = Engine.applyRunToRecords(rec, run).records;
    deq(pick(rec.history[0], ['ante', 'bestScore']), { ante: 9, bestScore: 16 }, "Ante 9's Blind select: the entry says Ante 9");
    run.ante = 11;
    rec = Engine.applyRunToRecords(rec, run, { final: false }).records;
    deq([rec.history.length, rec.history[0].ante, rec.runs, rec.wins, rec.bestAnte], [1, 11, 1, 1, 11]);
    run.ante = 10; // a stale copy of the run never lowers it
    deq(Engine.applyRunToRecords(rec, run).records.history[0].ante, 11);
  });

  test("§4.2 final pass: an Endless run never changes another run's history entry", () => {
    const { run, rec: won } = wonAndFiled('ENDLESS3');
    intoEndless(run);
    run.ante = 12;
    const other = { at: 'x', deckId: 'speedlines', stake: 'sunny', ante: 3, won: false, bestScore: 70, seed: 'OTHERRUN' };
    // its own entry is found by its seed even when a run filed since (another tab) is newer
    let out = Engine.applyRunToRecords({ ...won, history: [...won.history, other] }, run).records;
    deq(out.history.map((h) => [h.seed, h.ante]), [['ENDLESS3', 12], ['OTHERRUN', 3]]);
    deq(out.history[1], other);
    // no entry of its own (records erased after the win, or another run's win on the same Deck and Stake)
    const strangers = [
      [],
      [{ at: 'x', deckId: 'speedlines', stake: 'sunny', ante: 8, won: true, bestScore: 70, seed: 'OTHERRUN' }],
      [{ at: 'x', deckId: 'speedlines', stake: 'sunny', ante: 8, won: false, bestScore: 70 }],
      [{ at: 'x', deckId: 'firstissue', stake: 'sunny', ante: 8, won: true, bestScore: 70 }],
      [{ at: 'x', deckId: 'speedlines', stake: 'uhoh', ante: 8, won: true, bestScore: 70 }],
      [{ at: 'x', deckId: 'speedlines', stake: 'sunny', ante: 8, won: true, bestScore: 70 }, other],
    ];
    for (const history of strangers) {
      out = Engine.applyRunToRecords({ ...Engine.defaultRecords(), runs: 4, wins: 1, history }, run, { final: true, now: 'y' }).records;
      deq([out.history, out.runs, out.wins], [history, 4, 1], JSON.stringify(history));
    }
    // a run in Endless mode that was never filed (no records when it was won) is filed once, at the Ante it reached
    const unfiled = fresh({ seed: 'UNFILED1' });
    Object.assign(unfiled, { ante: 9, won: true, endless: true, phase: 'gameover' });
    out = Engine.applyRunToRecords(Engine.defaultRecords(), unfiled, { final: true, now: 'z' }).records;
    deq([out.runs, out.wins, out.history], [1, 1, [{ at: 'z', deckId: 'firstissue', stake: 'sunny', ante: 9, won: true, bestScore: 0, seed: 'UNFILED1' }]]);
  });

  test('§4.2 final pass: records saved before history entries kept their seed load as they were, and an Endless run filed then gets its last Ante on that entry', () => {
    const old = {
      version: 2, runs: 3, wins: 1, bestAnte: 8, bestHand: { handId: 'flush', name: 'Flush', score: 400 },
      unlockedDecks: ['firstissue', 'speedlines', 'sketchbook'], unlockedStakes: ['sunny', 'uhoh'], wonOn: ['sunny'],
      history: [
        { at: '2026-11-24T09:00', deckId: 'firstissue', stake: 'sunny', ante: 3, won: false, bestScore: 50 },
        { at: '2026-11-24T10:00', deckId: 'speedlines', stake: 'sunny', ante: 8, won: true, bestScore: 400 },
      ],
      discovered: { jokers: [], consumables: [], bosses: [], vouchers: [], tags: [] },
    };
    const before = JSON.stringify(old);
    deq(Engine.normalizeRecords(old), old, 'normalizeRecords gives them back unchanged: no seed is added');
    // the owner's case: won and filed by the build before this pass, continued in Endless mode on this one
    const run = fresh({ seed: 'OWNERRUN', deckId: 'speedlines' });
    Object.assign(run, { ante: 10, won: true, endless: true, recorded: true, phase: 'gameover' });
    run.stats.bestHand = { handId: 'flush', score: 900 };
    const out = Engine.applyRunToRecords(old, run, { final: true, now: 'n' });
    deq(out.records.history, [old.history[0], { ...old.history[1], ante: 10, bestScore: 900, seed: 'OWNERRUN' }], 'the newest entry, a win on its Deck and Stake, takes its Ante, best hand and seed');
    deq(pick(out.records, ['runs', 'wins', 'bestAnte']), { runs: 3, wins: 1, bestAnte: 10 });
    assert.equal(JSON.stringify(old), before, 'the input is untouched');
    // an older seedless win is never taken: only the newest entry can be the run's own
    const older = { ...old, history: [old.history[1], old.history[0]] };
    deq(Engine.applyRunToRecords(older, run).records.history, older.history);
    // normalizeRecords keeps a seed that is a string, and drops one that is not
    const n = Engine.normalizeRecords({ version: 2, history: [{ ante: 2, seed: 'K7Q2M9TX' }, { ante: 2, seed: 7 }, { ante: 2, seed: '' }, { ante: 2, seed: { a: 1 } }] });
    deq(n.history.map((h) => h.seed), ['K7Q2M9TX', undefined, undefined, undefined]);
    deq(Engine.normalizeRecords({ version: 1, voyages: 1, history: [{ at: 'a', deckId: 'dinghy', seaState: 'calm', ante: 2, bestScore: 9 }] }).history,
      [{ at: 'a', deckId: 'firstissue', stake: 'sunny', ante: 2, won: false, bestScore: 9 }], 'version 1 records still migrate, with no seed');
  });
});

// =========================================================================================
// The robustness pass of the engine fix (2026-11-23 (Jokers)): what an older, edited or broken save
// can hold, and what huge numbers do. Each test is a repro from the review, now passing.
describe('§4 Robustness: broken saves, failed actions and huge numbers (2026-11-23 engine fix)', () => {
  test("a hand uid with no card behind it: canPlay refuses it with the action's sentence and The Fade does not fade", () => {
    const run = fresh({ seed: 'ROBUST01' });
    run.blindIndex = 2;
    run.bosses[1] = 'fade';
    ok(Engine.startBlind(run));
    ok(Engine.playHand(run, [run.blind.hand[0]]));
    run.blind.score = 100;
    run.blind.hand[0] = 'c999';
    const sel = run.blind.hand.slice(0, 2);
    fails(Engine.canPlay(run, sel), 'canPlay', 'Select cards from your hand.');
    const before = Engine.serialize(run);
    fails(Engine.playHand(run, sel), 'playHand', 'Select cards from your hand.');
    fails(Engine.discard(run, sel), 'discard', 'Select cards from your hand.');
    deq([Engine.serialize(run) === before, run.blind.score], [true, 100]);
  });
  test('an internal error inside an action puts the run back exactly as it was', () => {
    const run = inBlind({ seed: 'ROBUST02' });
    run.blind.discardPile = 'not a pile'; // playHand scores, then throws when it moves the cards
    const before = Engine.serialize(run);
    fails(Engine.playHand(run, [run.blind.hand[0]]), 'playHand', "That didn't work.");
    assert.equal(Engine.serialize(run), before, 'score, money, stats and hand unchanged');
  });
  test("a Joker state missing the key its row reads uses the row's starting value: Poker Face {} gives x1, not x0", () => {
    const run = inBlind({ seed: 'ROBUST03' });
    jokerOf(run, Engine.addJoker(run, 'pokerface').uid).state = {};
    const r = score(run, 'AS AH');
    deq([r.steps.filter((s) => s.kind === 'xmult').length, r.total], [0, (12 + 22) * 2]);
    const br = jokerOf(run, Engine.addJoker(run, 'brazier').uid);
    br.state.x = 0;
    assert.equal(score(run, 'AS AH').total, 68, 'an xMult of 0 never fires');
  });
  test("deserialize fills a Joker's missing state keys from its row, along Old Flame's copy; a current save comes back unchanged", () => {
    const run = fresh({ seed: 'ROBUST04' });
    const pf = Engine.addJoker(run, 'pokerface');
    const of = Engine.addJoker(run, 'oldflame');
    jokerOf(run, of.uid).state.copy = { id: 'gingerbreadfool', state: { chips: 30 } };
    const sane = Engine.serialize(run);
    assert.equal(Engine.serialize(Engine.deserialize(sane)), sane);
    jokerOf(run, pf.uid).state = {};
    jokerOf(run, of.uid).state.copy.state = {};
    const back = Engine.deserialize(Engine.serialize(run));
    deq([jokerOf(back, pf.uid).state, jokerOf(back, of.uid).state.copy], [{ x: 1 }, { id: 'gingerbreadfool', state: { chips: 60 } }]);
  });
  test('huge numbers stay finite: Chips, Mult, the total and the Blind score saturate at Number.MAX_VALUE and survive a save', () => {
    const run = inBlind({ seed: 'ROBUST05' });
    jokerOf(run, Engine.addJoker(run, 'brazier').uid).state.x = 1e200;
    jokerOf(run, Engine.addJoker(run, 'pokerface').uid).state.x = 1e200;
    const [a, b] = setHand(run, ['AS', 'AH']);
    const r = ok(Engine.playHand(run, [a, b]));
    deq([r.result.mult, r.result.total, Number.isFinite(run.blind.score)], [Number.MAX_VALUE, Number.MAX_VALUE, true]);
    const back = Engine.deserialize(Engine.serialize(run));
    deq([back.stats.bestHand.score, back.blind.score], [Number.MAX_VALUE, run.blind.score]);
    const big = inBlind({ seed: 'ROBUST06' });
    jokerOf(big, Engine.addJoker(big, 'brazier').uid).state.x = 2e302;
    assert.equal(score(big, 'KS').mult, 2e302, 'Mult above 1.8e302 is not rounded to Infinity');
  });
  // Changed 2026-11-24 (final review): the formula is worked out exactly, in BigInt. The test used to
  // compare with the same formula in floating point, which itself rounds to a neighbouring multiple of
  // 100 at 387 Antes from Ante 60 on (Ante 60: 195519935576272500 instead of ...400).
  test('Endless targets follow the §2.6 formula exactly, then saturate at Number.MAX_VALUE (Twilight Stake: the Boss Blind from Ante 1256, the Big Blind from 1257, every Blind from 1258); a save keeps the target', () => {
    // round(45000 x 1.75^k / 100) x 100 = round(450 x 7^k / 4^k) x 100 with k = n - 8, halves up, then the nearest number
    const exact = (n) => {
      const k = BigInt(n - 8);
      const num = 450n * 7n ** k;
      const den = 4n ** k;
      return Math.min(Number(((2n * num + den) / (2n * den)) * 100n), Number.MAX_VALUE);
    };
    const off = [];
    for (let n = 9; n <= 1300; n++) if (Engine.anteBaseTarget(n) !== exact(n)) off.push(n);
    deq(off, [], 'Antes whose base target differs from the exact formula');
    deq([60, 61, 62, 65, 67].map((n) => Engine.anteBaseTarget(n)), [60, 61, 62, 65, 67].map(exact), 'the first Antes the floating-point product got wrong');
    assert.equal(Engine.anteBaseTarget(60), 195519935576272400);
    const sat = fresh({ seed: 'ROBUST07' });
    const firstMax = (i) => {
      for (let n = 1240; n < 1270; n++) if (Engine.blindTarget(sat, n, i) === Number.MAX_VALUE) return n;
      return null;
    };
    deq([firstMax(0), firstMax(1), firstMax(2)], [1258, 1257, 1256], 'the first Ante at Number.MAX_VALUE: Small, Big, Boss Blind');
    deq([1255, 1256, 1257].map((n) => Number.isFinite(Engine.blindTarget(sat, n, 0)) && Engine.blindTarget(sat, n, 0) < Number.MAX_VALUE), [true, true, true]);
    deq([1258, 5000, 1e15, Infinity].map((n) => Engine.anteBaseTarget(n)), [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE], 'far Antes saturate at once');
    const run = fresh({ seed: 'ROBUST07' });
    Object.assign(run, { ante: 1300, endless: true });
    run.bosses[1300] = 'heckler';
    ok(Engine.startBlind(run));
    const back = Engine.deserialize(Engine.serialize(run));
    assert.equal(back.blind.target, Number.MAX_VALUE);
    assert.equal(ok(Engine.playHand(back, [back.blind.hand[0]])).cleared, false, 'one High Card does not beat it');
  });
  test('formatNumber: at most 2 decimals; whole numbers and anything from 1e15 up print as they are', () => {
    deq([1.239, 2.5, 7, -0, 123456789012, 1e21, Number.MAX_VALUE].map((n) => Engine.formatNumber(n)), ['1.24', '2.5', '7', '0', '123456789012', '1e+21', '1.7976931348623157e+308']);
  });
  test('deserialize repairs the numbers the actions read; a Blind whose target is not a finite number above 0 is refused', () => {
    const shop = toShop(fresh({ seed: 'ROBUST08' }));
    const s = Engine.serialize(shop).replace(/"rerollCost":\d+/, '"rerollCost":null').replace(/"money":\d+/, '"money":null');
    const back = Engine.deserialize(s);
    deq([back.shop.rerollCost, back.money], [5, 0]);
    fails(Engine.reroll(back), 'reroll', 'Not enough money.');
    const run = inBlind({ seed: 'ROBUST09' });
    const broken = JSON.parse(Engine.serialize(run));
    Object.assign(broken.blind, { score: null, handsLeft: null });
    broken.levels.pair = null;
    broken.stats.handsPlayed = null;
    const fixed = Engine.deserialize(JSON.stringify(broken));
    deq([fixed.blind.score, fixed.blind.handsLeft, fixed.levels.pair, fixed.stats.handsPlayed], [0, 1, 1, 0]);
    broken.blind.target = null;
    assert.equal(Engine.deserialize(JSON.stringify(broken)), null, 'any hand would beat a null target');
    broken.blind.target = -5;
    assert.equal(Engine.deserialize(JSON.stringify(broken)), null);
  });
  test('normalizeRecords cleans version 2 records like version 1: known Deck and Stake ids, rebuilt history, a sound best hand', () => {
    const n = Engine.normalizeRecords({ version: 2, bestHand: { handId: 'pair', score: 'abc' }, unlockedDecks: ['firstissue', 'nope', 7, null, 'panorama', 'panorama'], unlockedStakes: ['sunny', 'calm'], wonOn: ['nope', 'sunny'], history: [null, 5, { deckId: 'nope', stake: 'uhoh', ante: 'x', won: 1, bestScore: 40, at: 3 }] });
    deq([n.unlockedDecks, n.unlockedStakes, n.wonOn, n.bestHand], [['firstissue', 'panorama', 'speedlines', 'sketchbook'], ['sunny'], ['sunny'], null]);
    deq(n.history, [{ at: '3', deckId: null, stake: 'uhoh', ante: 0, won: true, bestScore: 40 }]);
    const run = fresh({ seed: 'ROBUST10' });
    run.stats.bestHand = { handId: 'flush', score: 50000 };
    deq(Engine.applyRunToRecords(n, run, { final: true }).records.bestHand, { handId: 'flush', name: 'Flush', score: 50000 });
    const long = Engine.normalizeRecords({ version: 2, history: Array.from({ length: 20 }, (x, i) => ({ at: String(i), ante: i })) });
    deq(long.history.map((h) => h.at), Array.from({ length: 12 }, (x, i) => String(i + 8)), 'the last 12');
  });
  // wildJacks tries only the ranks that can matter (2026-11-23 robustness pass: the full search took
  // 6,188 classifications for five Jacks). bruteWild is the full search written with the public API:
  // every multiset of ranks for the Jacks (the earlier Jack the lower rank), evaluated without
  // wildJacks; the strongest hand, then the most scoring cards, then the highest ranks among them,
  // and the first one found on a tie.
  function bruteWild(cards, opts) {
    const jacks = cards.map((c, i) => i).filter((i) => cards[i].rank === 11);
    const o = Object.assign({}, opts, { wildJacks: false });
    let best = null;
    const walk = (k, from, ranks) => {
      if (k === jacks.length) {
        const trial = cards.map((c, i) => Object.assign({}, c, { rank: ranks[i] }));
        const ev = Engine.evaluate(trial, o);
        const key = [-HAND_IDS.indexOf(ev.handId), ev.scoringUids.length, ev.scoringUids.reduce((t, u) => t + trial.find((c) => c.uid === u).rank, 0)];
        if (!best || key[0] > best.key[0] || (key[0] === best.key[0] && (key[1] > best.key[1] || (key[1] === best.key[1] && key[2] > best.key[2])))) best = { key, ev };
        return;
      }
      for (let v = from; v <= 14; v++) {
        ranks[jacks[k]] = v;
        walk(k + 1, v, ranks);
      }
    };
    walk(0, 2, cards.map((c) => c.rank));
    return best.ev;
  }
  test('wildJacks: the quick search finds exactly the hand and scoring cards of the full search over every rank', () => {
    let s = 7;
    const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
    const SUITS = ['S', 'H', 'D', 'C'];
    for (let t = 0; t < 700; t++) {
      const n = 1 + Math.floor(rnd() * 5);
      const nj = 1 + Math.floor(rnd() * Math.min(n, t % 7 === 0 ? 4 : 3));
      const oneSuit = rnd() < 0.4;
      const base = 2 + Math.floor(rnd() * 9);
      const rank = () => (rnd() < 0.5 ? Math.min(14, base + Math.floor(rnd() * 5)) : 2 + Math.floor(rnd() * 13));
      const cards = Array.from({ length: n }, (x, i) => Engine.makeCard(i < nj ? 11 : rank(), oneSuit && rnd() < 0.9 ? 'H' : SUITS[Math.floor(rnd() * 4)]));
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
      const opts = { wildJacks: true, wrapStraights: rnd() < 0.4, fourCardFlush: rnd() < 0.4, everySuit: rnd() < 0.15 };
      deq(Engine.evaluate(cards, opts), bruteWild(cards, opts), `${cards.map((c) => c.rank + c.suit).join(' ')} ${JSON.stringify(opts)}`);
    }
  });
});

// =========================================================================================
// The final review (2026-11-24): what an edited save, edited records or a direct API call can hold.
// Each test is a repro from the review (F1, F3; F2 is the Endless target test above) and failed
// before the fix.
describe('§4 Final review (2026-11-24): ids named after Object.prototype members, pile uids with no card', () => {
  // F1. The engine's id lookups were plain objects, so these names counted as content rows
  // (STAKE.toString, DECK.constructor, JOKER.__proto__, HAND.valueOf, ...).
  const PROTO_IDS = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__proto__', '__defineGetter__', '__lookupSetter__'];
  const UNKNOWN = 'nosuchid';
  // A result as JSON with the id written as <id> (a value JSON can't hold, such as a function, as its type).
  const norm = (v, id) => String(JSON.stringify(v === undefined ? null : v) ?? typeof v).split(id).join('<id>');
  // An id named after an Object.prototype member gives exactly what any unknown id gives (f returns
  // one result or a list of them; each is compared on its own).
  function likeUnknown(what, f) {
    const parts = (id) => {
      const v = f(id);
      return Array.isArray(v) ? v.map((x) => norm(x, id)) : [norm(v, id)];
    };
    const want = parts(UNKNOWN);
    for (const id of PROTO_IDS) {
      const got = parts(id);
      assert.equal(got.length, want.length, `${what}: '${id}'`);
      got.forEach((g, i) => assert.equal(g, want[i], `${what}, result ${i}: '${id}' is not treated as an unknown id`));
    }
  }

  test('F1 newRun: a Deck or Stake id named after an Object.prototype member falls back to firstissue and sunny, with finite targets (§2.11)', () => {
    for (const id of PROTO_IDS) {
      const run = Engine.newRun({ seed: 'PROTO01', deckId: id, stake: id });
      deq([run.deckId, run.stake, Engine.blindsForAnte(run).map((b) => b.target)], ['firstissue', 'sunny', [300, 450, 600]], id);
      ok(Engine.startBlind(run), `startBlind '${id}'`);
      run.blind.score = 1e300;
      assert.equal(ok(Engine.playHand(run, [run.blind.hand[0]])).cleared, true, `'${id}': a score of 1e300 beats the Small Blind`);
      assert.ok(Engine.deserialize(Engine.serialize(run)), `'${id}': the save loads`);
    }
    likeUnknown('newRun', (id) => Engine.serialize(Engine.newRun({ seed: 'PROTO01', deckId: id, stake: id })));
    deq(pick(Engine.newRun({ seed: 'PROTO01', deckId: ['speedlines'], stake: ['uhoh'] }), ['deckId', 'stake']), { deckId: 'firstissue', stake: 'sunny' }, 'an id is a string');
  });

  test("F1 canBuy and buy refuse a Shop item, and canPackPick and packPick a pack option, whose id is an Object.prototype member name (§4.2)", () => {
    for (const id of PROTO_IDS) {
      const run = toShop(fresh({ seed: 'PROTO02' }));
      run.money = 20;
      const had = [run.jokers.length, run.consumables.length, run.vouchers.length];
      for (const kind of ['joker', 'tarot', 'planet', 'spectral', 'voucher', 'pack']) {
        run.shop.items[0] = { slot: kind === 'pack' || kind === 'voucher' ? kind : 'card', kind, id, price: 3, sold: false, edition: null, size: kind === 'pack' ? 'normal' : null };
        fails(Engine.canBuy(run, 0), `canBuy ${kind} '${id}'`, 'There is nothing for sale there.');
        fails(Engine.buy(run, 0), `buy ${kind} '${id}'`, 'There is nothing for sale there.');
      }
      deq([run.money, run.jokers.length, run.consumables.length, run.vouchers.length, run.phase], [20, ...had, 'shop'], id);
      const p = openPackFromShop(fresh({ seed: 'PROTO03' }), 'jokernormal');
      for (const kind of ['joker', 'tarot', 'planet', 'spectral']) {
        p.pack.options[0] = { kind, id, edition: null, picked: false };
        fails(Engine.canPackPick(p, 0, []), `canPackPick ${kind} '${id}'`, "Pick one of the pack's cards.");
        fails(Engine.packPick(p, 0, []), `packPick ${kind} '${id}'`, "Pick one of the pack's cards.");
      }
    }
  });

  test('F1 addJoker refuses an id named after an Object.prototype member; such a Joker in an edited rack is inert, its text is a string and it sells like any unknown Joker', () => {
    for (const id of PROTO_IDS) {
      const run = fresh({ seed: 'PROTO04' });
      const n = run.jokers.length;
      assert.equal(Engine.addJoker(run, id), null, `addJoker '${id}'`);
      assert.equal(run.jokers.length, n);
      run.jokers.push({ uid: 'h900', id, state: {}, paid: 0, edition: null });
      assert.equal(Engine.jokerText(run, 'h900'), '', `jokerText '${id}'`);
      assert.equal(Engine.jokerSellValue(run, 'h900'), 1, `jokerSellValue '${id}'`);
    }
    likeUnknown('a rack Joker', (id) => {
      const run = inBlind({ seed: 'PROTO05' });
      run.jokers.push({ uid: 'h900', id, state: {}, paid: 0, edition: null });
      const [a, b, ...held] = run.blind.hand;
      const out = [Engine.jokerText(run, 'h900'), Engine.jokerSellValue(run, 'h900'), Engine.jokerCopies(run, 'h900'), Engine.jokerSlotsUsed(run)];
      out.push(Engine.scoreCards(run, [cardOf(run, a), cardOf(run, b)], held.map((u) => cardOf(run, u))), Engine.playHand(run, [a, b]));
      out.push(Engine.sellJoker(run, 'h900'), run.money, Engine.serialize(run));
      return out;
    });
    assert.equal(Engine.addJoker(fresh({ seed: 'PROTO04' }), ['jinglejester']), null, 'an id is a string');
  });

  test('F1 deserialize, Engine.stats and the records treat ids named after Object.prototype members like unknown ids: a best hand needs a poker hand, the Deck and Stake fall back', () => {
    const save = (id) => {
      const o = JSON.parse(Engine.serialize(fresh({ seed: 'PROTO06' })));
      o.stats.bestHand = { handId: id, score: 7 };
      Object.assign(o, { deckId: id, stake: id, vouchers: [id] });
      Object.assign(o.cards[0], { enhancement: id, edition: id, seal: id });
      o.tags['1-0'] = id;
      o.bosses['1'] = id;
      o.consumables.push({ uid: 'k900', kind: id, id });
      o.jokers.push({ uid: 'h901', id, state: { copy: { id, state: {} } }, paid: 0, edition: null }); // deserialize maps old Joker ids
      o.discovered.jokers.push(id);
      return JSON.stringify(o);
    };
    for (const id of PROTO_IDS) {
      const back = Engine.deserialize(save(id));
      assert.ok(back, `'${id}': the save loads`);
      deq([back.deckId, back.stake, back.stats.bestHand, Engine.stats(back).bestHand], ['firstissue', 'sunny', null, null], id);
      assert.equal(Engine.normalizeRecords({ version: 2, bestHand: { handId: id, score: 50 } }).bestHand, null, `records '${id}'`);
    }
    likeUnknown('a loaded save', (id) => {
      const back = Engine.deserialize(save(id));
      const out = [Engine.serialize(back), Engine.stats(back), Engine.blindsForAnte(back), Engine.cardText(back, back.cards[0].uid)];
      out.push(Engine.jokerText(back, 'h901'), Engine.jokerSellValue(back, 'h901'), Engine.jokerCopies(back, 'h901'));
      out.push(Engine.consumableInfo(back, 'k900'), Engine.consumableSellValue(back, 'k900'), Engine.canUseConsumable(back, 'k900', []));
      out.push(Engine.sellConsumable(back, 'k900'), back.money, Engine.skipBlind(back), Engine.serialize(back));
      return out;
    });
    likeUnknown('records', (id) => {
      const run = fresh({ seed: 'PROTO07' });
      run.stats.bestHand = { handId: id, score: 99 };
      return [
        Engine.normalizeRecords({ version: 2, bestHand: { handId: id, score: 50 }, unlockedDecks: [id], unlockedStakes: [id], wonOn: [id], history: [{ deckId: id, stake: id, ante: 3 }], discovered: { jokers: [id], consumables: [id], bosses: [id], vouchers: [id], tags: [id] } }),
        Engine.normalizeRecords({ version: 1, voyages: 2, bestHand: { handId: id, score: 50 }, unlockedDecks: [id], unlockedSeaStates: [id], wonOn: [id], history: [{ deckId: id, seaState: id }], discovered: { charms: [id], consumables: [id], bosses: [id] } }),
        Engine.applyRunToRecords(Engine.defaultRecords(), run, { final: true, now: 't' }).records,
      ];
    });
  });

  test('F1 a card whose Enhancement, Edition, Seal or suit is an Object.prototype member name scores and reads like one with an unknown id', () => {
    likeUnknown('card fields', (id) => {
      const run = inBlind({ seed: 'PROTO08' });
      const [a, b, c, d] = run.blind.hand;
      cardOf(run, a).enhancement = id;
      cardOf(run, b).edition = id;
      cardOf(run, c).seal = id;
      const played = [a, b, c, d].map((u) => cardOf(run, u));
      const held = run.blind.hand.slice(4).map((u) => cardOf(run, u));
      const loose = { uid: 'z1', rank: 14, suit: id, enhancement: null, edition: null, seal: null, grow: 0 };
      const out = [Engine.scoreCards(run, played, held), Engine.preview(run, [a, b, c, d]), [a, b, c].map((u) => Engine.cardText(run, u)), Engine.evaluate(played)];
      out.push(Engine.cardName(loose), Engine.cardText(run, loose), Engine.evaluate([loose]), Engine.editionInfo(id), Engine.sealInfo(id));
      out.push(Engine.playHand(run, [a, b, c, d]), Engine.serialize(run));
      return out;
    });
  });

  test('F1 jokerProblems: a condition, counter, setter or Tag named after an Object.prototype member is an unknown word, and in play such a word never fires', () => {
    const row = (id) => ({
      id: 'testproto', name: 'Test Proto', text: 'Test.', rarity: 'common', cost: 3,
      effects: [{ on: 'hand', when: { [id]: true }, chips: 999 }, { on: 'hand', mult: 1, per: id }, { on: 'hand', mult: 1, per: { count: id } }],
      events: { blindStart: [{ set: { k: id } }, { gainTag: id }] },
    });
    likeUnknown('jokerProblems', (id) => Engine.jokerProblems(row(id)));
    for (const id of PROTO_IDS) assert.ok(Engine.jokerProblems(row(id)).includes(`effects[0]: unknown condition '${id}'`), id);
    // Test-only Jokers that use such a word as a condition (+999 Chips) or a counter (+1 Mult per it).
    const rows = PROTO_IDS.map((id, i) => `{ id: 'testproto${i}', name: 'Test Proto ${i}', rarity: 'common', cost: 3, text: 'Uses a word.', effects: [{ on: 'hand', when: { [${JSON.stringify(id)}]: true }, chips: 999 }, { on: 'hand', mult: 1, per: ${JSON.stringify(id)} }] }`);
    const P = vm.runInContext('TW.Engine', makeContext(null, `TW.Content.JOKERS.push(${rows.join(', ')});`));
    const run = P.newRun({ seed: 'PROTO09' });
    ok(P.startBlind(run));
    const two = run.blind.hand.slice(0, 2).map((u) => cardOf(run, u));
    const bare = P.scoreCards(run, two, []);
    run.jokerSlots = 20;
    PROTO_IDS.forEach((id, i) => assert.ok(P.addJoker(run, `testproto${i}`), `testproto${i}`));
    const r = P.scoreCards(run, two, []);
    assert.ok(r, 'scoring never throws');
    deq([r.total, r.steps.length], [bare.total, bare.steps.length], 'the words never fire');
  });

  // F3. A hand, draw-pile or discard-pile uid with no card behind it (a stale or edited save, or a
  // run changed through the API). The checks said yes and the actions failed inside.
  const useCard = (run, id, sel = []) => ok(Engine.useConsumable(run, give(run, 'spectral', id), sel), id);
  const dropCard = (run, uid) => {
    run.cards = run.cards.filter((c) => c.uid !== uid);
  };

  test("F3 deserialize drops pile uids that name no card (the Blind's and an open pack's); a hand that lost one refills from its draw pile; a current save comes back unchanged", () => {
    const run = inBlind({ seed: 'STALE01' });
    ok(Engine.discard(run, [run.blind.hand[0]]));
    const sane = Engine.serialize(run);
    assert.equal(Engine.serialize(Engine.deserialize(sane)), sane, 'a current save comes back unchanged');
    const b = run.blind;
    const gone = b.hand[2];
    const next = b.draw[0];
    dropCard(run, gone); // the card left the deck; its uid stayed in the hand
    b.draw.splice(1, 0, 'c9002');
    b.discardPile.push('c9003');
    const back = Engine.deserialize(Engine.serialize(run));
    deq(sorted(back.blind.hand), sorted(b.hand.filter((u) => u !== gone).concat(next)), 'the hand: the stale uid gone, the next card drawn');
    assertSorted(back, 'rank', back.blind.hand);
    deq([back.blind.draw, back.blind.discardPile], [b.draw.filter((u) => u !== 'c9002').slice(1), b.discardPile.filter((u) => u !== 'c9003')]);
    deq(sorted([...back.blind.hand, ...back.blind.draw, ...back.blind.discardPile]), sorted(back.cards.map((c) => c.uid)), 'the piles are the deck');
    // a Ghost Pack's dealt hand
    const p = openPackFromShop(fresh({ seed: 'STALE02' }), 'ghostnormal');
    const ph = p.pack.hand.slice();
    const pd = p.pack.draw.slice();
    dropCard(p, ph[0]);
    p.pack.draw.unshift('c9004');
    const backP = Engine.deserialize(Engine.serialize(p));
    deq([sorted(backP.pack.hand), backP.pack.draw], [sorted(ph.slice(1).concat(pd[0])), pd.slice(1)]);
  });

  test('F3 The Fumble with a hand uid that names no card: canDiscard and discard agree on every seed, and the extra card is a real one', () => {
    for (let s = 0; s < 40; s++) {
      const run = fresh({ seed: `STALE1${s}` });
      toBoss(run, 'fumble');
      const gone = run.blind.hand[1];
      dropCard(run, gone);
      const sel = [run.blind.hand[0]];
      ok(Engine.canDiscard(run, sel), `canDiscard STALE1${s}`);
      const r = ok(Engine.discard(run, sel), `discard STALE1${s}`);
      assert.ok(r.extra && r.extra !== gone && cardOf(run, r.extra), `STALE1${s}: the extra card ${r.extra} is a real card`);
    }
  });

  test("F3 Wickwisp with a hand uid that names no card: the check and the use agree, and every real card takes the suit (in a Blind and in a Ghost Pack's dealt hand)", () => {
    const run = inBlind({ seed: 'STALE03' });
    const gone = run.blind.hand[1];
    dropCard(run, gone);
    const sel = [run.blind.hand[run.blind.hand.length - 1]];
    const suit = cardOf(run, sel[0]).suit;
    const real = run.blind.hand.filter((u) => u !== gone);
    const k = give(run, 'spectral', 'spellbound');
    ok(Engine.canUseConsumable(run, k, sel));
    const r = ok(Engine.useConsumable(run, k, sel));
    deq(sorted(r.effect.uids), sorted(real));
    for (const u of real) assert.equal(cardOf(run, u).suit, suit);
    const p = openPackFromShop(fresh({ seed: 'STALE04' }), 'ghostnormal');
    p.pack.options[0] = { kind: 'spectral', id: 'spellbound', picked: false };
    const goneP = p.pack.hand[0];
    dropCard(p, goneP);
    const selP = [p.pack.hand[p.pack.hand.length - 1]];
    const suitP = cardOf(p, selP[0]).suit;
    const realP = p.pack.hand.filter((u) => u !== goneP);
    ok(Engine.canPackPick(p, 0, selP));
    const rp = ok(Engine.packPick(p, 0, selP));
    deq(sorted(rp.effect.uids), sorted(realP));
    for (const u of realP) assert.equal(cardOf(p, u).suit, suitP);
  });

  test('F3 Graveyard Shift and Hall of Mirrors with a hand uid that names no card destroy real cards only; "needs 2 cards in hand" counts real cards', () => {
    for (let s = 0; s < 20; s++) {
      for (const [id, nSel] of [['graveyardshift', 0], ['hallofmirrors', 1]]) {
        const run = inBlind({ seed: `STALE2${s}` });
        const gone = run.blind.hand[1];
        dropCard(run, gone);
        const r = useCard(run, id, run.blind.hand.slice(run.blind.hand.length - nSel));
        assert.equal(r.effect.destroyed.length, 2, `${id} STALE2${s}: two cards destroyed`);
        assert.ok(!r.effect.destroyed.includes(gone), `${id} STALE2${s}: the stale uid is not one of them`);
      }
    }
    const small = inBlind({ seed: 'STALE05' });
    small.blind.hand = small.blind.hand.slice(0, 2);
    dropCard(small, small.blind.hand[1]);
    const k = give(small, 'spectral', 'graveyardshift');
    fails(Engine.canUseConsumable(small, k, []), 'canUseConsumable', 'You need at least 2 cards in hand.');
    fails(Engine.useConsumable(small, k, []), 'useConsumable', 'You need at least 2 cards in hand.');
  });
});

// =========================================================================================
// Final pass (2026-11-24), the wording ruling (REQUESTS.md): the genre's system words stay, and every other label,
// button and callout is the game's own (the words the checks look for are on the originality list,
// tests/local/originality.json; local-only). The engine owns two strings the game shows that the ruling reaches: the
// retrigger note and the Blind texts.
describe('Final pass (2026-11-24): the wording ruling', () => {
  /** A Pair of Kings: KS gets its Encore Seal, then Test Face; KH gets Test Face. */
  const encorePair = () => {
    const run = inBlind({}, XEngine);
    XEngine.addJoker(run, 'testface');
    return XEngine.scoreCards(run, [mkWith(XEngine, 'KS+encore'), mkWith(XEngine, 'KH')], []);
  };
  test('§1 / §4.3 every retrigger pass is announced "Encore!", from a Seal and from a Joker alike', () => {
    const r = encorePair();
    const notes = r.steps.filter((s) => s.via === 'retrigger');
    deq(notes.map((s) => [s.label, s.seal, s.jokerUid ? 'joker' : null]), [['Encore!', 'encore', null], ['Encore!', null, 'joker'], ['Encore!', null, 'joker']],
      'a Pair of Kings: KS gets its Encore Seal, then Test Face; KH gets Test Face');
  });

  test('§1 / §4.3 no scoring step says the retrigger callout of the originality list', { skip: needsOriginality }, () => {
    const r = encorePair();
    const callout = pattern('retriggerCallout');
    assert.ok(!r.steps.some((s) => callout.test(String(s.label))), `no step says ${callout}`);
  });

  test('§2.6 the Blind texts read "Reach ... the Ante target"', () => {
    deq(list(Content.BLINDS).map((b) => [b.id, b.text]), [
      ['small', 'Reach the Ante target. Skip it for its Tag.'],
      ['big', 'Reach 1.5 times the Ante target. Skip it for its Tag.'],
      ['boss', "Reach twice the Ante target, under the Boss Blind's rule. Can't be skipped."],
    ]);
  });

  test('§2.6 no item name or text uses a UI phrase of the originality list', { skip: needsOriginality }, () => {
    const texts = [];
    for (const key of ['BLINDS', 'ENHANCEMENTS', 'EDITIONS', 'SEALS', 'TAROTS', 'PLANETS', 'SPECTRALS', 'JOKERS', 'BOSSES', 'VOUCHERS', 'TAGS', 'PACKS', 'DECKS', 'STAKES']) for (const row of list(Content[key])) texts.push(`${row.name} ${row.text}`);
    const phrases = pattern('itemTextPhrases');
    const hits = texts.filter((t) => phrases.test(t));
    deq(hits, [], 'no item name or text uses those UI phrases');
  });
});

// =========================================================================================
// Final pass, part 2 (2026-11-24): the design documents follow what ships. SPEC §6.7 described only the split at
// 1024 px while the UI shipped a landscape-phone and a short-phone layout (I4, REQUESTS.md), and the plan's art line
// for the Jingle Jester still described Lit's capped jester after the art redrew it as a candle ringing a handbell
// (I5, REQUESTS.md). Both read the other owners' files and change nothing.
describe('Final pass, part 2 (2026-11-24): the documents follow what ships', () => {
  test('§6.7 names every width and height a layout turns on (src/styles/*.css and TW.UI.MQ), and the landscape layout', () => {
    const spec = fs.readFileSync(path.join(ROOT, 'SPEC.md'), 'utf8');
    const at = spec.indexOf('### 6.7 Layout');
    assert.ok(at > 0, 'SPEC.md has §6.7 Layout');
    const s67 = spec.slice(at, spec.indexOf('\n### ', at + 1));
    // every query: the stylesheets' @media rules and the UI core's matchMedia table (TW.UI.MQ)
    const queries = [];
    const styles = path.join(ROOT, 'src', 'styles');
    for (const f of fs.readdirSync(styles).filter((n) => n.endsWith('.css')).sort()) {
      for (const [q] of fs.readFileSync(path.join(styles, f), 'utf8').matchAll(/@media[^{]+/g)) queries.push([`src/styles/${f}`, q]);
    }
    for (const [, q] of fs.readFileSync(path.join(ROOT, 'src', 'ui', '00-core.js'), 'utf8').matchAll(/\bmq\('([^']+)'\)/g)) queries.push(['src/ui/00-core.js', q]);
    assert.ok(queries.length > 10, `the layout queries were found (${queries.length})`);
    // "below 1024 px wide" is (max-width: 1023px) and "760 px tall or less" is (max-height: 760px): either number counts
    const named = (n) => [n, n + 1].some((x) => new RegExp(`(?<![0-9])${x} ?px`).test(s67));
    const missing = new Set();
    for (const [file, q] of queries) for (const [m, , , n] of q.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)/g)) if (!named(Number(n))) missing.add(`${file}: ${m}`);
    deq([...missing], [], 'every breakpoint is described in §6.7');
    if (queries.some(([, q]) => /orientation:\s*landscape/.test(q))) assert.match(s67, /landscape phone/, '§6.7 describes the landscape phone');
    assert.match(s67, /TW\.UI\.MQ\.px2/, '§6.7 keeps the pixel size to its one query');
  });

  test("src/art/40-jokers-lit.js keeps the Jingle Jester's one-line switch", () => {
    const art = fs.readFileSync(path.join(ROOT, 'src', 'art', '40-jokers-lit.js'), 'utf8');
    assert.ok(art.match(/const JINGLE_JESTER_STYLE = '([a-z]+)'/), "src/art/40-jokers-lit.js keeps the Jingle Jester's one-line switch");
  });

  test("the Jingle Jester's art line (the plan and CONTENT.md) describes the sprite src/art/40-jokers-lit.js draws", { skip: needs('content/content-plan.json', 'content/jokers-a.json', 'CONTENT.md') }, () => {
    const art = fs.readFileSync(path.join(ROOT, 'src', 'art', '40-jokers-lit.js'), 'utf8');
    const sw = art.match(/const JINGLE_JESTER_STYLE = '([a-z]+)'/);
    assert.ok(sw, "src/art/40-jokers-lit.js keeps the Jingle Jester's one-line switch");
    const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'content-plan.json'), 'utf8'));
    const line = plan.jokers.find((j) => j.id === 'jinglejester').art;
    const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'jokers-a.json'), 'utf8')).jokers.find((j) => j.id === 'jinglejester').art;
    if (sw[1] === 'classic') {
      // Lit's drawing is back: so is the source design's line (drop the change in tools/checks/content-check/build.mjs)
      assert.equal(line, source, "'classic' draws Lit's capped jester, which the source design's line describes");
    } else {
      // 'candle' (any other value draws it too): one of the table's candles ringing a handbell; no cap, ruff or mask
      assert.match(line, /\bcandles?\b/, 'the line names the candle');
      assert.match(line, /\bhandbell\b/, 'the line names the handbell');
      assert.doesNotMatch(line, /\b(cap|ruff|mask|grinning)\b/i, "the line keeps nothing of Lit's capped jester");
      assert.notEqual(line, source, 'the content check replaces the source design line');
    }
    const md = fs.readFileSync(path.join(ROOT, 'CONTENT.md'), 'utf8');
    assert.ok(md.includes(`| **Jingle Jester** | common | ${line} |`), "CONTENT.md's Joker art table shows the plan's line");
  });
});

// =========================================================================================
// Final pass, part 3 (2026-11-25): content/CHECKS.md had not been written again since the merge of 2026-11-23 (it said
// "91 of 91" while the validator had 94 checks), and the planted-fault probe still expected the engine check's name from
// before the engine reconcile, so a re-run counted that fault missed. Both read the content check's files only, which
// are local-only (tools/checks/ and content/): without them both skip.
describe('Final pass, part 3 (2026-11-25): content/CHECKS.md follows the content check', () => {
  const DIR = path.join(ROOT, 'tools', 'checks', 'content-check');
  test("content/CHECKS.md shows the validator's last result and lists every check of checks.json (node md.mjs after validate.mjs)", { skip: needs('tools/checks/content-check/checks.json', 'content/CHECKS.md') }, () => {
    const checks = JSON.parse(fs.readFileSync(path.join(DIR, 'checks.json'), 'utf8'));
    const md = fs.readFileSync(path.join(ROOT, 'content', 'CHECKS.md'), 'utf8');
    assert.ok(checks.total > 90 && Array.isArray(checks.results) && checks.results.length === checks.total, `checks.json holds the validator's run (${checks.total} checks)`);
    assert.ok(md.includes(`**Result: ${checks.passed} of ${checks.total} checks pass.**`), `CHECKS.md says ${checks.passed} of ${checks.total}`);
    const absent = checks.results.filter((r) => !md.includes(`- ${r.pass ? 'PASS' : '**FAIL**'}: ${r.name}`)).map((r) => r.name);
    deq(absent, [], 'every check is listed with its result');
    // the folder it names to re-run in is the project's, not the session scratchpad the merge was written in
    assert.match(md, /in the folder `tools\/checks\/content-check`/, 'CHECKS.md names the project folder of the check');
    assert.doesNotMatch(md, /scratchpad/i, 'CHECKS.md names no session scratchpad');
  });

  test('every planted fault of probe.mjs names a check the validator runs, and probe.json records each as caught', { skip: needs('tools/checks/content-check/checks.json', 'tools/checks/content-check/probe.mjs', 'tools/checks/content-check/probe.json') }, () => {
    const checks = JSON.parse(fs.readFileSync(path.join(DIR, 'checks.json'), 'utf8'));
    const src = fs.readFileSync(path.join(DIR, 'probe.mjs'), 'utf8');
    const expects = [...src.matchAll(/\}, '([^']+)'\],/g)].map((m) => m[1]);
    assert.equal(expects.length, 17, 'the 17 planted faults are read from probe.mjs');
    const unnamed = expects.filter((e) => !checks.results.some((r) => r.name.startsWith(e) || r.name.includes(e)));
    deq(unnamed, [], 'each expectation names a current check');
    const probe = JSON.parse(fs.readFileSync(path.join(DIR, 'probe.json'), 'utf8'));
    deq(probe.map((r) => r.expect), expects, 'probe.json is the run of this probe.mjs');
    deq(probe.filter((r) => !r.caught).map((r) => r.what), [], 'every planted fault was caught');
  });
});
