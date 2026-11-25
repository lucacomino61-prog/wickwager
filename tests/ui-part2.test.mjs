// Unit tests for the final pass, part 2 (UI code, play and design fixes, 2026-11-24): src/ui/*.js with the real content,
// art and engine in a vm with a minimal fake DOM (as tests/ui-fixes.test.mjs does), and src/audio.js on a fake Web
// Audio clock. The browser half is tests/e2e/part2.mjs.
//   C1  storage is full: a key whose last write failed is read from memory, so Continue brings back the run as it is
//       (never an older save that happened to fit);
//   C2  the cache of drawn numbers stays under its cap and keeps no bitmaps (a glow draws one on demand);
//   C3  muted, the audio context rests (suspended, no scheduler) once the sounds playing have rung out; unmuted, the
//       same music carries on where it was; a change of loop asked for while muted is made on waking, never piled up;
//   C4  crossing a breakpoint redraws the menu lettering in place: the screen is never mounted anew;
//   C5  in a pack a Tag opened at the Blind select, the Blind count is the next Blind's;
//   P1  the Blind plate's Boss rule is the engine's, with The Lid's live cap;
//   P2  Tall Tale's new Legendary Joker wears its Edition in the sentence that brings it;
//   P3  input waits while cards are dealt (busyWhile), and a flow's clearBusy() does not cut that short;
//   I3+ (the final agent's review stills) the reading plate beside a pack's dealt hand has one height per layout that
//       holds the longest reading (no cap at the hand's height), and a breakpoint draws the Shop and the pack again
//       (their name plates are chosen for the pixel size); How to play's tab row wraps on a phone, as the Collection's
//       does (D3). The browser half is tests/e2e/stills.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const plain = (v) => JSON.parse(JSON.stringify(v));
const ART = readdirSync(new URL('src/art/', root)).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/art/' + f);
const UI_FILES = readdirSync(new URL('src/ui/', root)).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/ui/' + f);

function fakeEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), className: '', textContent: '', innerHTML: '', children: [], dataset: {}, hidden: false, isConnected: true,
    style: { setProperty() {}, removeProperty() {}, cssText: '' },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, append() {}, prepend() {}, appendChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getContext() { return null; }, getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    insertAdjacentHTML() {}, replaceChildren() {}, animate() { return null; }, focus() {}, closest() { return null; }, matches() { return false; },
  };
}
/** The UI in a vm. o.setItem(key) may throw (a full storage). */
function load(search = '?test=1&seed=PARTTWO1', o = {}) {
  const storage = new Map();
  const doc = {
    readyState: 'loading', documentElement: fakeEl('html'), body: fakeEl('body'),
    createElement: (t) => fakeEl(t), addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, getAnimations() { return []; },
    fonts: { load: async () => [], ready: Promise.resolve(), check: () => false }, activeElement: null,
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout, clearTimeout, performance, Promise, URLSearchParams, Map, Set, WeakMap, Math, JSON, Date,
    Number, String, Array, Object, Symbol, Error, Uint8Array, Uint8ClampedArray, Float32Array, Int32Array,
    location: { search }, document: doc, navigator: {}, innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { if (o.setItem) o.setItem(k); storage.set(k, String(v)); },
      removeItem: (k) => storage.delete(k),
    },
    CSS: { supports: () => true }, addEventListener() {}, removeEventListener() {},
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['src/content.js', ...ART, 'src/engine.js', ...UI_FILES]) vm.runInContext(read(f), ctx, { filename: f });
  ctx.TW.Art.url = (id) => (ctx.TW.Art.has(id) ? 'data:image/png;base64,AAAA' : null);
  return { TW: ctx.TW, storage, doc };
}
const quotaError = () => { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; return e; };

test('C1: storage is full: Continue brings back the run as it is, never an older save that fit', () => {
  const box = { full: false };
  const { TW, storage } = load('?test=1&seed=QAQUOTA1', { setItem: (k) => { if (box.full && /ember:run/.test(k)) throw quotaError(); } });
  const UI = TW.UI;
  UI.newRun({ show: false });
  assert.equal(UI.loadSavedRun().phase, 'blind-select', 'the first save fits');
  box.full = true;
  assert.equal(UI.call('startBlind').ok, true);
  assert.equal(JSON.parse(storage.get('test:ember:run')).phase, 'blind-select', 'localStorage still holds the older save');
  const saved = UI.loadSavedRun();
  assert.equal(saved.phase, 'play', 'Continue reads the run being played (it read the Blind select before)');
  assert.equal(saved.blind.handsLeft, UI.run().blind.handsLeft);
  assert.ok(UI.hasSavedRun());
  assert.deepEqual(plain(UI.store.unsaved()), ['test:ember:run'], 'the key is known to live only in memory');
  // a write that gets through again hands reads back to localStorage
  box.full = false;
  UI.saveRun();
  assert.deepEqual(plain(UI.store.unsaved()), []);
  assert.equal(JSON.parse(storage.get('test:ember:run')).phase, 'play');
  // and a removed key is gone from both
  box.full = true;
  UI.saveRun();
  UI.store.remove('run');
  assert.equal(UI.store.get('run'), null);
  assert.deepEqual(plain(UI.store.unsaved()), []);
});

test('C1: the player is told once that storage is full; a missing storage stays silent', () => {
  const src = read('src/ui/00-core.js');
  assert.match(src, /quotaError\(err\)[^\n]*toast\("Your browser's storage is full, so the game can't save\./, 'a full storage is said in a toast');
  assert.match(src, /if \(!fullSaid && quotaError\(err\)\) \{ fullSaid = true;/, 'once per session, and only for a full storage');
});

test('C2: the cache of drawn numbers stays under its cap and keeps no bitmaps', () => {
  const { TW } = load();
  const UI = TW.UI;
  // the fake DOM has no canvas: a picture stands in for the PNG
  UI.paint.Px.prototype.url = function () { return `data:image/png;base64,${this.w}x${this.h}`; };
  const cap = UI.paint.NUM_CAP;
  assert.ok(cap >= 256 && cap <= 2048, `a cap of a few hundred (${cap})`);
  const first = UI.numSprite('1', 'XL', 'chips');
  assert.equal(UI.numSprite('1', 'XL', 'chips'), first, 'a string drawn again is the cached picture');
  for (let i = 0; i < cap * 4; i++) UI.numSprite(UI.fmt(1000 + i * 37), i % 2 ? 'L' : 'S', i % 3 ? 'score' : 'cream');
  assert.equal(UI.paint.numCached(), cap, 'four caps of distinct numbers later, the cache holds the cap');
  assert.notEqual(UI.numSprite('1', 'XL', 'chips'), first, 'the string unused longest was forgotten (and is drawn again)');
  const s = UI.numSprite('12,345', 'XXL', 'total');
  const d = Object.getOwnPropertyDescriptor(s, 'bmp');
  assert.ok(d && typeof d.get === 'function' && !('value' in d), 'an entry keeps no bitmap of its own');
  const b = s.bmp;
  assert.equal(b.w, s.w, 'a glow gets the bitmap drawn again on demand');
  assert.equal(b.h, s.h);
  assert.equal(UI.numSprite('12,345', 'XXL', 'total'), s, 'and the entry stays the one in the cache');
});

// ---------------------------------------------------------------- C3: a fake Web Audio clock
class FakeParam {
  constructor(v) { this.value = v; }
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  setTargetAtTime() { return this; }
  cancelScheduledValues() { return this; }
}
function audioWorld() {
  const clock = { now: 0, seq: 0, timers: new Map() };
  const instances = [];
  class FakeNode {
    constructor(c, kind) { this.ctx = c; this.kind = kind; }
    connect(d) { return d; }
    disconnect() {}
  }
  class FakeSource extends FakeNode {
    start(t = 0) { this.started = t; this.ctx.sources.push(this); }
    stop(t = 0) { this.stopped = t; }
  }
  class FakeAudioContext {
    constructor() { this.sampleRate = 48000; this.state = 'suspended'; this.sources = []; this.onstatechange = null; this.destination = new FakeNode(this, 'destination'); instances.push(this); }
    get currentTime() { return clock.now / 1000; }
    resume() { this.state = 'running'; if (this.onstatechange) this.onstatechange(); return Promise.resolve(); }
    suspend() { this.state = 'suspended'; if (this.onstatechange) this.onstatechange(); return Promise.resolve(); }
    createGain() { const n = new FakeNode(this, 'gain'); n.gain = new FakeParam(1); return n; }
    createOscillator() { const n = new FakeSource(this, 'oscillator'); n.frequency = new FakeParam(440); n.detune = new FakeParam(0); return n; }
    createBufferSource() { const n = new FakeSource(this, 'buffer'); n.buffer = null; n.loop = false; n.playbackRate = new FakeParam(1); return n; }
    createBiquadFilter() { const n = new FakeNode(this, 'biquad'); n.frequency = new FakeParam(350); n.Q = new FakeParam(1); n.gain = new FakeParam(0); n.detune = new FakeParam(0); return n; }
    createDynamicsCompressor() { const n = new FakeNode(this, 'compressor'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new FakeParam(0); return n; }
    createWaveShaper() { return new FakeNode(this, 'waveshaper'); }
    createConvolver() { return new FakeNode(this, 'convolver'); }
    createDelay() { const n = new FakeNode(this, 'delay'); n.delayTime = new FakeParam(0); return n; }
    createStereoPanner() { const n = new FakeNode(this, 'panner'); n.pan = new FakeParam(0); return n; }
    createBuffer(ch, len, sr) { const data = Array.from({ length: ch }, () => new Float32Array(len)); return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: (i) => data[i], copyToChannel: (d, i) => data[i].set(d) }; }
  }
  const sandbox = {
    console, AudioContext: FakeAudioContext,
    setTimeout: (fn, ms) => { const id = ++clock.seq; clock.timers.set(id, { fn, at: clock.now + Math.max(0, Number(ms) || 0) }); return id; },
    clearTimeout: (id) => { clock.timers.delete(id); },
  };
  vm.createContext(sandbox);
  vm.runInContext(read('src/audio.js'), sandbox, { filename: 'src/audio.js' });
  const A = sandbox.TW.Audio;
  A.debug = true;
  function advance(ms) {
    const end = clock.now + ms;
    for (;;) {
      let pick = null;
      for (const [id, t] of clock.timers) if (t.at <= end && (!pick || t.at < pick.t.at)) pick = { id, t };
      if (!pick) break;
      clock.timers.delete(pick.id);
      clock.now = Math.max(clock.now, pick.t.at);
      pick.t.fn();
    }
    clock.now = end;
  }
  return { A, clock, advance, instances };
}

test('C3: muted, the audio rests once the sounds playing have rung out; unmuted, the same music carries on', () => {
  const w = audioWorld();
  const A = w.A;
  assert.equal(A.init(), true);
  const c = w.instances[0];
  w.advance(3000); // the instrument bank warms in idle time
  A.music('table');
  w.advance(2000);
  const hums = () => c.sources.filter((s) => s.kind === 'buffer' && s.loop && s.stopped == null);
  assert.equal(hums().length, 1, 'one loop is playing (its candle hum)');
  const hum = hums()[0];
  assert.equal(A.sfx('win'), true, 'a long sound is playing');
  A.setMuted(true);
  w.advance(460);
  let s = plain(A.state());
  assert.ok(s.voices > 0, 'the sound is still ringing (unheard: the master is down)');
  assert.equal(c.state, 'running', 'so the context waits for it to end');
  w.advance(6500);
  s = plain(A.state());
  assert.equal(s.voices, 0);
  assert.equal(c.state, 'suspended', 'muted: the context rests');
  assert.equal(s.music.scheduler, false, 'and the music scheduler stops');
  const n = c.sources.length;
  w.advance(10000);
  assert.equal(c.sources.length, n, 'nothing is scheduled while muted');
  A.setMuted(false);
  assert.equal(c.state, 'running', 'unmuted, it wakes');
  s = plain(A.state());
  assert.equal(s.music.scheduler, true);
  assert.equal(s.music.songs, 1);
  assert.equal(hums().length, 1);
  assert.equal(hums()[0], hum, 'the same loop carries on where it was (no new song)');
  w.advance(2000);
  assert.ok(c.sources.length > n, 'and the music schedules again');
  A.music(false);
  w.advance(3000);
});

test('C3: a change of loop asked for while muted is made on waking, never piled up', () => {
  const w = audioWorld();
  const A = w.A;
  A.init();
  const c = w.instances[0];
  w.advance(3000);
  A.music('table');
  w.advance(1000);
  A.setMuted(true);
  w.advance(600);
  assert.equal(c.state, 'suspended');
  for (const v of ['shop', 'table', 'shop', 'table', 'shop']) A.music(v); // the player walks the Shop and the table, muted
  let s = plain(A.state());
  assert.equal(s.music.songs, 1, 'no loop is started while the sound rests');
  assert.equal(s.music.variant, 'shop', 'the wish is kept');
  A.setMuted(false);
  s = plain(A.state());
  assert.equal(s.music.variant, 'shop');
  assert.equal(s.music.songs, 2, 'on waking, the Shop loop fades in over the table loop');
  w.advance(3000);
  assert.equal(plain(A.state()).music.songs, 1);
  // a page hidden while muted, then shown: it stays at rest until the sound is unmuted
  A.setMuted(true);
  w.advance(600);
  assert.equal(c.state, 'suspended');
  A.init();
  assert.equal(c.state, 'suspended', 'init() (a gesture) does not wake a muted context');
  A.setMuted(false);
  assert.equal(c.state, 'running');
  A.music(false);
  w.advance(3000);
});

test('C4: crossing a breakpoint redraws the menu lettering in place, never mounts the screen anew', () => {
  const src = read('src/ui/30-screens.js');
  assert.ok(!/onBreakpoint\([^\n]*UI\.show\(/.test(src), 'no breakpoint handler calls UI.show()');
  assert.match(src, /UI\.onBreakpoint\(relight\)/);
  assert.match(src, /function relight\(\) \{[\s\S]*?n\.replaceWith\(word\(w\.text/, 'relight() draws each word again');
  assert.match(src, /wrap\.pwWord = \{ text, o \}/, 'each word remembers what it says');
});

test('C5: in a pack a Tag opened at the Blind select, the Blind count is the next Blind\'s', () => {
  const { TW } = load();
  const UI = TW.UI;
  const run = UI.newRun({ show: false });
  assert.equal(UI.roundNumber(run), 1, 'Blind 1 at the first Blind select');
  run.blindStatus['1-0'] = 'skipped';
  run.blindIndex = 1;
  Object.assign(run, { phase: 'pack', pack: { id: 'x', kind: 'card', size: 'normal', picksLeft: 1, returnTo: 'blind-select', options: [], hand: [], draw: [] } });
  assert.equal(UI.roundNumber(run), 2, 'one Blind skipped, the next is Blind 2 (it said 1)');
  run.phase = 'blind-select';
  run.pack = null;
  assert.equal(UI.roundNumber(run), 2, 'the Blind select after the pack agrees');
  // after a Blind (the Shop, a pack bought there) the count stays on the Blind just beaten
  run.blindStatus['1-1'] = 'cleared';
  Object.assign(run, { phase: 'pack', pack: { id: 'x', kind: 'card', size: 'normal', picksLeft: 1, returnTo: 'shop', options: [], hand: [], draw: [] } });
  assert.equal(UI.roundNumber(run), 2);
  run.phase = 'shop';
  assert.equal(UI.roundNumber(run), 2);
});

test('P1: the Blind plate shows the Boss rule the engine words for this Ante: The Lid with its live cap', () => {
  const { TW } = load('?test=1&seed=QALID005');
  const UI = TW.UI, E = TW.Engine;
  for (const [ante, cap] of [[5, 24], [3, 12]]) {
    const run = UI.newRun({ show: false });
    Object.assign(run, { ante, blindIndex: 2 });
    run.bosses[ante] = 'lid';
    run.blindStatus = { [`${ante}-0`]: 'cleared', [`${ante}-1`]: 'cleared' };
    const want = E.currentBlindInfo(run).boss.text;
    assert.match(want, new RegExp(`\\(now ${cap}\\)\\.$`), want);
    assert.equal(UI.table.bossText(run, 'lid'), want, `Ante ${ante}, the Blind select`);
    assert.equal(UI.call('startBlind').ok, true);
    assert.equal(UI.run().phase, 'play');
    assert.equal(UI.table.bossText(UI.run(), 'lid'), want, `Ante ${ante}, during the Blind (the plate read the row's text, no cap)`);
    assert.equal(UI.table.bossRule('lid'), want, 'and the emblem\'s tooltip');
  }
  // a Boss with no live number keeps the row's text, plus what it picked this Blind
  const run = UI.newRun({ show: false });
  const plainBoss = TW.Content.BOSSES.find((b) => b.cap == null && !b.capPerAnte);
  Object.assign(run, { ante: 2, blindIndex: 2 });
  run.bosses[2] = plainBoss.id;
  assert.equal(UI.table.bossText(run, plainBoss.id), plainBoss.text);
});

test('P2: Tall Tale\'s new Legendary Joker wears its Edition in the sentence that brings it', () => {
  const { TW } = load('?test=1&seed=QACONS44');
  const UI = TW.UI, Cn = TW.Content;
  const run = UI.newRun({ show: false });
  const tall = Cn.SPECTRALS.find((x) => x.createJoker === 'legendary');
  const legend = Cn.JOKERS.find((j) => j.rarity === 'legendary');
  const ed = Cn.EDITIONS.find((e) => e.id === 'fourcolor') || Cn.EDITIONS[0];
  const owned = Cn.JOKERS.find((j) => j.rarity === 'common');
  run.jokers.push({ uid: 'h40', id: owned.id, edition: null }, { uid: 'h41', id: legend.id, edition: ed.id });
  // the effect createJokerOp reports when the new Joker rolls an Edition
  const s = UI.table.describeEffect({ name: tall.name }, { kind: 'spectral', id: tall.id, jokerId: legend.id, jokerUid: 'h41', edition: ed.id, handSizeForGood: -1 });
  assert.equal(s, `${tall.name}: ${legend.name} (${ed.name}) joins your Jokers. -1 hand size for good.`);
  assert.ok(!/became/.test(s), 'no Joker the player had is said to have changed');
  // without an Edition, as before
  assert.equal(UI.table.describeEffect({ name: tall.name }, { kind: 'spectral', id: tall.id, jokerId: legend.id, jokerUid: 'h41', handSizeForGood: -1 }), `${tall.name}: ${legend.name} joins your Jokers. -1 hand size for good.`);
  // an Edition on a Joker already owned names that Joker
  const happy = Cn.TAROTS.find((x) => x.jokerEdition && x.chance);
  const gloss = Cn.EDITIONS.find((e) => e.id === 'gloss') || Cn.EDITIONS[0];
  assert.equal(UI.table.describeEffect({ name: happy.name }, { kind: 'tarot', id: happy.id, hit: true, jokerUid: 'h40', edition: gloss.id }), `${happy.name}: ${owned.name} became ${gloss.name}.`);
  // a Tag's Edition too
  const tag = Cn.TAGS.find((t) => t.jokerEdition);
  assert.equal(UI.table.describeGain(tag, { jokerUid: 'h40', edition: gloss.id }), `${tag.name}: ${owned.name} became ${gloss.name}.`);
});

test('P3: input waits while cards are dealt, and a flow\'s clearBusy() does not cut that short', async () => {
  const { TW, doc } = load();
  const UI = TW.UI;
  const flight = () => { let done, fail; const finished = new Promise((res, rej) => { done = res; fail = rej; }); return { finished, done, fail }; };
  const a = flight(), b = flight();
  UI.busyWhile([a, null, b], 5000);
  assert.equal(UI.isBusy(), true, 'busy from the first card');
  assert.equal(doc.body.dataset.busy, '1');
  UI.clearBusy(); // the payout's end clears its own busy while the next hand deals in
  assert.equal(UI.isBusy(), true, 'the deal still holds input');
  a.done();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(UI.isBusy(), true, 'one card still in flight');
  b.fail(new Error('cancelled')); // a cancelled flight counts as landed
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(UI.isBusy(), false, 'every card has landed');
  assert.equal(doc.body.dataset.busy, '0');
  // a held or stalled animation never keeps input waiting past its time
  UI.busyWhile([flight()], 0);
  assert.equal(UI.isBusy(), true);
  await new Promise((r) => setTimeout(r, 650));
  assert.equal(UI.isBusy(), false, 'released after its time');
  UI.busyWhile([null, null], 100);
  assert.equal(UI.isBusy(), false, 'no animation (test mode, nothing to wait for): no hold');
  // the deal holds input from its first card to the last landing (SPEC 6.2)
  const table = read('src/ui/10-table.js');
  assert.match(table, /function dealIn\(nodes, startDelay = 0\) \{[\s\S]*?UI\.busyWhile\(flights, UI\.dur\(startDelay \+ \(nodes\.length - 1\) \* 55 \+ 640\)\);/);
});

test('I3+: the reading plate beside a pack\'s dealt hand holds the longest reading at every upright layout; a breakpoint redraws the Shop and the pack', () => {
  const css = read('src/styles/50-shop.css');
  // capped at the hand's height (max-height: card height + 9 art px) it cut 30 of the 36 readings at 1024 x 768
  assert.doesNotMatch(css, /\.pk-handzone \.pk-detail \{[^}]*max-height: calc\(var\(--card-h\) \+ 9/, 'no cap at the hand\'s height on the table layout');
  assert.match(css, /\n\.pk-handzone \.pk-detail \{[^}]*height: calc\(84 \* var\(--px\)\)/, 'the table layout holds 84 art px of copy');
  assert.match(css, /@media \(min-width: 1024px\) and \(max-height: 869px\) \{\s*\.pk-handzone \{ grid-template-columns: calc\(120 \* var\(--px\)\) [^}]*\}\s*\.pk-handzone \.pk-detail \{ height: calc\(104 \* var\(--px\)\); \}/, 'at 2 px the table layout widens the plate (120 art px) and holds 104');
  assert.match(css, /@media \(max-width: 1023px\) \{[\s\S]*?\.pk-handzone \.pk-detail \{ align-self: stretch; height: calc\(62 \* var\(--px\)\);/, 'a phone held upright holds 62 art px (44 cut 16 of the 36 at 390 x 844)');
  // part 3 (F3): a wide compact window 760 px tall or less no longer cuts its plate to 44 art px (that cut 4 of the 36
  // readings, and the page scrolled); the racks step aside there instead and the plate keeps 52 (tests/ui-part3.test.mjs)
  assert.match(css, /@media \(min-width: 600px\) and \(max-width: 1023px\) and \(max-height: 760px\) \{\s*body:has\(\.pack-view\.has-hand\) \.racks \{ display: none; \}/, 'a wide compact window 760 px tall or less moves the racks aside for the dealt hand');
  // part 3 (F5): the redraw waits for a busy moment to end instead of being dropped (tests/ui-part3.test.mjs)
  const shop = read('src/ui/20-shop.js').replace(/\r\n/g, '\n');
  assert.match(shop, /const redrawForBreakpoint = \(\) => \{[\s\S]*?if \(s !== 'shop' && s !== 'pack'\) return;[\s\S]*?UI\.update\(\);\n {2}\};\n {2}UI\.onBreakpoint\(/, 'crossing a breakpoint draws the Shop or the open pack again');
});

test("D3+: How to play's tab row wraps on a phone, as the Collection's does: no scroller with its bar hidden", () => {
  const css = read('src/styles/60-screens.css');
  // as a scroller (nowrap, overflow-x: auto, scrollbar hidden) it cut UPGRADES mid-word on a 390 px phone and hid TAGS
  assert.doesNotMatch(css, /\.hp-tabs \{[^}]*(nowrap|overflow-x: auto)/, 'the tab row never scrolls sideways');
  assert.doesNotMatch(css, /\.hp-tabs::-webkit-scrollbar/, 'no hidden scrollbar');
  assert.match(css, /\.hp-tabs \{ display: flex; flex-wrap: wrap;/, 'it wraps at every width');
});
