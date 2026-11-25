/*
 * TW.Audio (src/audio.js): the sound synthesizer.
 *
 * 1. In a bare vm (no Web Audio, no DOM, no timers) the API exists, every documented sound name is accepted, and
 *    every call is a quiet no-op that never throws.
 * 2. With a strict fake AudioContext (it throws like a browser on non-finite automation, a second start(), stop()
 *    before start() or an exponential ramp to 0) and fake timers: init() builds the graph, sfx() schedules sources
 *    that reach the speakers for every name, the music scheduler looks ahead on setTimeout and stops after
 *    music(false), and mute, volume, the hidden page and the first-gesture wait behave.
 * The browser checks (real Web Audio, offline renders measured for level) live in tools/audio-preview.html.
 * Run with: node --test "tests/*.test.mjs"
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, '..', 'src', 'audio.js');
const SRC = fs.readFileSync(FILE, 'utf8');

const NAMES = ['select', 'deselect', 'deal', 'play', 'chip', 'mult', 'xmult', 'again', 'total', 'beaten', 'lose', 'win', 'collect', 'buy',
  'sell', 'reroll', 'pack', 'pick', 'use', 'skip', 'boss', 'tag', 'error', 'button', 'shuffle', 'discard', 'money', 'flip'];

/** Objects from the vm have foreign prototypes: compare through JSON. */
const plain = (x) => JSON.parse(JSON.stringify(x));

// ------------------------------------------------------------------ a strict fake Web Audio
function finite(...xs) { for (const x of xs) if (typeof x !== 'number' || !Number.isFinite(x)) throw new TypeError(`non-finite value ${x}`); }

class FakeParam {
  constructor(v) { this._v = v; this.events = []; }
  get value() { return this._v; }
  set value(v) { finite(v); this._v = v; }
  push(type, v, t, extra) { finite(v, t); if (t < 0) throw new RangeError('negative time'); this.events.push({ type, v, t, ...extra }); return this; }
  setValueAtTime(v, t) { return this.push('set', v, t); }
  linearRampToValueAtTime(v, t) { return this.push('linear', v, t); }
  exponentialRampToValueAtTime(v, t) { if (!(Math.abs(v) > 0)) throw new RangeError('exponential ramp to 0'); return this.push('exp', v, t); }
  setTargetAtTime(v, t, tc) { finite(tc); if (tc < 0) throw new RangeError('time constant'); return this.push('target', v, t, { tc }); }
  cancelScheduledValues(t) { finite(t); this.events = this.events.filter((e) => e.t < t); return this; }
}
class FakeNode {
  constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; this.outs = []; ctx.nodes.push(this); }
  connect(dest) { if (!dest) throw new TypeError('connect() needs a destination'); this.outs.push(dest); return dest; }
  disconnect() { this.outs = []; }
}
class FakeSource extends FakeNode {
  start(t = 0, offset) {
    if (this.started != null) throw new Error('InvalidStateError: start() called twice');
    finite(t); if (t < 0) throw new RangeError('negative start');
    if (offset != null) finite(offset);
    this.started = t; this.offset = offset; this.ctx.sources.push(this);
  }
  stop(t = 0) {
    if (this.started == null) throw new Error('InvalidStateError: stop() before start()');
    finite(t); if (t < 0) throw new RangeError('negative stop');
    this.stopped = t;
  }
}
class FakeBuffer {
  constructor(ch, len, sr) {
    if (!(ch >= 1) || !(len >= 1) || !(sr > 0)) throw new RangeError('bad buffer');
    this.numberOfChannels = ch; this.length = len; this.sampleRate = sr; this.duration = len / sr;
    this.data = Array.from({ length: ch }, () => new Float32Array(len));
  }
  getChannelData(c) { return this.data[c]; }
  copyToChannel(d, c) { this.data[c].set(d); }
}
function makeWorld({ userActivation = null, withDocument = false } = {}) {
  const clock = { now: 0, seq: 0, timers: new Map() };
  const instances = [];
  class FakeAudioContext {
    constructor() {
      this.sampleRate = 48000; this.state = 'suspended'; this.nodes = []; this.sources = []; this.onstatechange = null;
      this.destination = new FakeNode(this, 'destination');
      instances.push(this);
    }
    get currentTime() { return clock.now / 1000; }
    resume() { this.state = 'running'; if (this.onstatechange) this.onstatechange(); return Promise.resolve(); }
    suspend() { this.state = 'suspended'; if (this.onstatechange) this.onstatechange(); return Promise.resolve(); }
    createGain() { const n = new FakeNode(this, 'gain'); n.gain = new FakeParam(1); return n; }
    createOscillator() { const n = new FakeSource(this, 'oscillator'); n.type = 'sine'; n.frequency = new FakeParam(440); n.detune = new FakeParam(0); return n; }
    createBufferSource() { const n = new FakeSource(this, 'buffer'); n.buffer = null; n.loop = false; n.playbackRate = new FakeParam(1); return n; }
    createBiquadFilter() { const n = new FakeNode(this, 'biquad'); n.type = 'lowpass'; n.frequency = new FakeParam(350); n.Q = new FakeParam(1); n.gain = new FakeParam(0); n.detune = new FakeParam(0); return n; }
    createDynamicsCompressor() { const n = new FakeNode(this, 'compressor'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new FakeParam(0); n.reduction = 0; return n; }
    createWaveShaper() { const n = new FakeNode(this, 'waveshaper'); n.curve = null; n.oversample = 'none'; return n; }
    createConvolver() { const n = new FakeNode(this, 'convolver'); n.buffer = null; n.normalize = true; return n; }
    createDelay(max = 1) { const n = new FakeNode(this, 'delay'); n.maxDelayTime = max; n.delayTime = new FakeParam(0); return n; }
    createStereoPanner() { const n = new FakeNode(this, 'panner'); n.pan = new FakeParam(0); return n; }
    createBuffer(ch, len, sr) { return new FakeBuffer(ch, len, sr); }
  }
  const listeners = {};
  const document = withDocument ? {
    visibilityState: 'visible',
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
  } : undefined;
  const fire = (type) => { for (const fn of (listeners[type] || []).slice()) fn({ type }); };
  const sandbox = {
    console,
    AudioContext: FakeAudioContext,
    setTimeout: (fn, ms) => { const id = ++clock.seq; clock.timers.set(id, { fn, at: clock.now + Math.max(0, Number(ms) || 0) }); return id; },
    clearTimeout: (id) => { clock.timers.delete(id); },
  };
  if (document) sandbox.document = document;
  if (userActivation) sandbox.navigator = { userActivation };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SRC, ctx, { filename: FILE });
  const A = ctx.TW.Audio;
  A.debug = true; // surface internal errors instead of swallowing them
  /** Run due timers in time order while moving the clock forward by ms. */
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
  return { A, clock, advance, instances, document, fire, listeners };
}

/** Can sound flow from node to the context's destination? (AudioParams are dead ends.) */
function reaches(node, dest, seen = new Set()) {
  if (node === dest) return true;
  if (!node || seen.has(node) || !node.outs) return false;
  seen.add(node);
  return node.outs.some((n) => reaches(n, dest, seen));
}

// ------------------------------------------------------------------ 1. no Web Audio at all
describe('TW.Audio without Web Audio (Node, old browsers)', () => {
  const ctx = vm.createContext({ console });
  vm.runInContext(SRC, ctx, { filename: FILE });
  const A = ctx.TW.Audio;

  test('the API exists', () => {
    for (const fn of ['init', 'sfx', 'music', 'setVolume', 'setMuted', 'state', 'play', 'setMusicVolume', 'render', 'renderStack', 'renderMusic', 'measure', 'ladder']) {
      assert.equal(typeof A[fn], 'function', fn);
    }
    assert.ok(Array.isArray(A.NAMES));
  });

  test('NAMES lists exactly the documented sounds', () => {
    assert.deepEqual([...A.NAMES].sort(), [...NAMES].sort());
    assert.equal(new Set(A.NAMES).size, A.NAMES.length);
  });

  test('every documented name is accepted, and every call is a no-op that never throws', () => {
    assert.equal(A.init(), false);
    for (const n of NAMES) {
      assert.equal(A.sfx(n), false, n);
      assert.equal(A.sfx(n, { index: 3, intensity: 1, pitch: -5, pan: 0.5, delay: 20 }), false, n);
      assert.equal(A.play(n, { step: 2 }), false, n);
    }
    for (const odd of [undefined, null, 42, {}, 'nope', 'CHIP', ' chip ']) assert.equal(A.sfx(odd, { index: NaN, intensity: Infinity, pitch: 'x' }), false);
    assert.equal(A.music(true), true);
    assert.equal(A.music('shop'), true);
    assert.equal(A.music(false), true);
    assert.equal(A.music('bogus'), true);
    assert.equal(A.setVolume('sfx', 0.3), true);
    assert.equal(A.setVolume(0.7), true);
    assert.equal(A.setMusicVolume(0.2), true);
    assert.equal(A.setVolume('music', 'loud'), false);
    assert.equal(A.setVolume('drums', 0.5), false);
    assert.equal(A.setMuted(true), true);
    assert.equal(A.setMuted(false), true);
  });

  test('state() reports no support and remembers the settings', () => {
    const s = plain(A.state());
    assert.equal(s.supported, false);
    assert.equal(s.ready, false);
    assert.equal(s.running, false);
    assert.equal(s.context, 'none');
    assert.equal(s.volume.sfx, 0.7);
    assert.equal(s.volume.music, 0.2);
    assert.equal(s.music.playing, false);
    assert.deepEqual([...s.names].sort(), [...NAMES].sort());
  });

  test('offline renders resolve to null and measure(null) is null', async () => {
    assert.equal(await A.render('chip'), null);
    assert.equal(await A.renderStack([['chip'], ['total']]), null);
    assert.equal(await A.renderMusic('table', 4), null);
    assert.equal(A.measure(null), null);
  });

  test('the scoring ladder climbs the D major pentatonic from A4 and holds at D6', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 30].map((i) => A.ladder(i)), [69, 71, 74, 76, 78, 81, 83, 86, 86, 86]);
  });
});

// ------------------------------------------------------------------ 2. a fake AudioContext
describe('TW.Audio with a fake AudioContext', () => {
  test('before init() nothing is created or scheduled', () => {
    const w = makeWorld();
    for (const n of NAMES) assert.equal(w.A.sfx(n), false, n);
    assert.equal(w.instances.length, 0);
    assert.equal(w.clock.timers.size, 0);
  });

  test('init() creates one running context with the master chain, and is safe to call again', () => {
    const w = makeWorld();
    assert.equal(w.A.init(), true);
    assert.equal(w.A.init(), true);
    assert.equal(w.instances.length, 1);
    const c = w.instances[0];
    assert.equal(c.state, 'running');
    const kinds = new Set(c.nodes.map((n) => n.kind));
    for (const k of ['compressor', 'waveshaper', 'convolver', 'gain']) assert.ok(kinds.has(k), k);
    const shaper = c.nodes.find((n) => n.kind === 'waveshaper');
    let top = 0;
    for (const y of shaper.curve) top = Math.max(top, Math.abs(y));
    assert.ok(top < 0.9, `the ceiling stays below -1 dBFS (max ${top})`);
    assert.ok(reaches(shaper, c.destination));
    const s = plain(w.A.state());
    assert.equal(s.ready, true);
    assert.equal(s.running, true);
  });

  test('sfx() schedules sources that reach the speakers, for every documented name', () => {
    const w = makeWorld();
    w.A.init();
    const c = w.instances[0];
    for (const n of NAMES) {
      w.advance(40);
      const before = c.sources.length, now = c.currentTime;
      assert.equal(w.A.sfx(n, { index: 3, intensity: 0.7, pan: -0.4 }), true, n);
      const fresh = c.sources.slice(before);
      assert.ok(fresh.length > 0, `${n} started no source`);
      for (const src of fresh) {
        assert.ok(src.started >= now, `${n} starts in the past`);
        assert.ok(src.stopped > src.started, `${n} has a stop after its start`);
        assert.ok(src.stopped - now < 6, `${n} stops within 6 s`);
        assert.ok(reaches(src, c.destination), `${n}: a ${src.kind} source does not reach the destination`);
        if (src.kind === 'buffer') assert.ok(src.buffer && src.buffer.length > 0, `${n} plays an empty buffer`);
      }
    }
  });

  test('opts are read: delay schedules ahead, aliases and the old play(name, { step }) spelling work', () => {
    const w = makeWorld();
    w.A.init();
    const c = w.instances[0];
    w.advance(100);
    const before = c.sources.length;
    assert.equal(w.A.sfx('chip', { delay: 500 }), true);
    const first = Math.min(...c.sources.slice(before).map((s) => s.started));
    assert.ok(first >= c.currentTime + 0.5, 'delay is in ms on the audio clock');
    assert.equal(w.A.sfx('chips'), true);
    assert.equal(w.A.sfx(' SELECT '), true);
    assert.equal(w.A.play('mult', { step: 4 }), true);
    assert.equal(w.A.sfx('kazoo'), false);
    // the same call twice in the same instant plays once
    w.advance(100);
    assert.equal(w.A.sfx('money', { index: 2 }), true);
    assert.equal(w.A.sfx('money', { index: 2 }), false);
    assert.equal(w.A.sfx('money', { index: 3 }), true);
    // a Boss twist inside a payout (low intensity) is the light gong: fewer layers than the Boss Blind's reveal
    w.advance(100);
    let n = c.sources.length;
    assert.equal(w.A.sfx('boss', { intensity: 0.2 }), true);
    const light = c.sources.length - n;
    w.advance(100);
    n = c.sources.length;
    assert.equal(w.A.sfx('boss'), true);
    const reveal = c.sources.length - n;
    assert.ok(light > 0 && light < reveal, `light boss ${light} sources, reveal ${reveal}`);
  });

  test('mute and volume', () => {
    const w = makeWorld();
    w.A.setVolume('sfx', 0.3);
    w.A.setVolume('music', 40); // percent from a 0..100 slider
    w.A.setMuted(true);
    w.A.init();
    let s = plain(w.A.state());
    assert.equal(s.volume.sfx, 0.3);
    assert.equal(s.volume.music, 0.4);
    assert.equal(s.muted, true);
    assert.equal(w.A.sfx('chip'), false, 'muted: nothing plays');
    w.A.setMuted(false);
    w.advance(20);
    assert.equal(w.A.sfx('chip'), true);
    w.A.setVolume(0.8);
    w.A.setVolume('music', 150);
    s = plain(w.A.state());
    assert.equal(s.volume.sfx, 0.8);
    assert.equal(s.volume.music, 1);
    w.A.setVolume('sfx', 0);
    w.advance(20);
    assert.equal(w.A.sfx('chip'), false, 'volume 0: nothing plays');
  });

  test('music looks ahead on a setTimeout scheduler and stops cleanly after music(false)', () => {
    const w = makeWorld();
    w.A.init();
    const c = w.instances[0];
    w.advance(3000); // the instrument bank warms up in idle time; no music yet
    const quiet = c.sources.length;
    assert.equal(quiet, 0, 'nothing plays before music(true)');
    assert.equal(w.A.music(true), true);
    let s = plain(w.A.state());
    assert.equal(s.music.on, true);
    assert.equal(s.music.playing, true);
    assert.equal(s.music.variant, 'table');
    assert.equal(s.music.scheduler, true);
    w.advance(8000);
    const playing = c.sources.length;
    assert.ok(playing > 20, `the table loop scheduled ${playing} sources in 8 s`);
    for (const src of c.sources) assert.ok(src.started <= c.currentTime + 0.3 + 0.45, 'nothing is scheduled further ahead than the look-ahead window');
    assert.ok(c.sources.every((src) => reaches(src, c.destination) || src.kind === 'oscillator'), 'music reaches the speakers (LFOs feed a gain)');
    assert.equal(w.A.music(false), true);
    s = plain(w.A.state());
    assert.equal(s.music.on, false);
    assert.equal(s.music.playing, false);
    w.advance(3000);
    s = plain(w.A.state());
    assert.equal(s.music.songs, 0, 'the loop is gone after its fade');
    assert.equal(s.music.scheduler, false, 'the scheduler stopped');
    assert.equal(w.clock.timers.size, 0, 'no timer is left pending');
    for (const src of c.sources) assert.ok(src.stopped != null, `every music source is stopped (${src.kind})`);
    const after = c.sources.length;
    w.advance(10000);
    assert.equal(c.sources.length, after, 'nothing new is scheduled after the stop');
  });

  test('music asked for before init() starts on init, and a variant switch crossfades', () => {
    const w = makeWorld();
    w.A.music('shop');
    assert.equal(plain(w.A.state()).music.playing, false);
    w.A.init();
    let s = plain(w.A.state());
    assert.equal(s.music.playing, true);
    assert.equal(s.music.variant, 'shop');
    w.advance(2000);
    w.A.music('table');
    s = plain(w.A.state());
    assert.equal(s.music.variant, 'table');
    assert.equal(s.music.songs, 2, 'the Shop loop fades while the table loop fades in');
    w.advance(3000);
    s = plain(w.A.state());
    assert.equal(s.music.songs, 1);
    assert.equal(s.music.variant, 'table');
    w.A.music(false);
    w.advance(3000);
    assert.equal(plain(w.A.state()).music.scheduler, false);
  });

  test('a hidden page fades out, suspends the context and stops the scheduler; showing it resumes', () => {
    const w = makeWorld({ withDocument: true });
    w.A.init();
    const c = w.instances[0];
    w.A.music(true);
    w.advance(1000);
    w.document.visibilityState = 'hidden';
    w.fire('visibilitychange');
    assert.equal(plain(w.A.state()).hidden, true);
    assert.equal(w.A.sfx('chip'), false, 'nothing plays while hidden');
    w.advance(600);
    assert.equal(c.state, 'suspended');
    assert.equal(plain(w.A.state()).music.scheduler, false);
    w.document.visibilityState = 'visible';
    w.fire('visibilitychange');
    assert.equal(c.state, 'running');
    w.advance(200);
    assert.equal(plain(w.A.state()).music.scheduler, true);
    assert.equal(w.A.sfx('chip'), true);
    w.A.music(false);
    w.advance(3000);
  });

  test('without a user gesture yet, init() waits and the first pointer press starts the sound', () => {
    const ua = { hasBeenActive: false, isActive: false };
    const w = makeWorld({ withDocument: true, userActivation: ua });
    assert.equal(w.A.init(), false);
    assert.equal(w.instances.length, 0, 'no context before a gesture');
    assert.ok((w.listeners.pointerdown || []).length > 0, 'listens for the first gesture');
    ua.hasBeenActive = true; ua.isActive = true;
    w.fire('pointerdown');
    assert.equal(w.instances.length, 1);
    assert.equal(w.instances[0].state, 'running');
    assert.equal((w.listeners.pointerdown || []).length, 0, 'the gesture listeners are removed');
    w.advance(20);
    assert.equal(w.A.sfx('button'), true);
  });

  test('a flood of calls is capped, but the big moments still play', () => {
    const w = makeWorld();
    w.A.init();
    w.advance(20);
    let played = 0;
    for (let i = 0; i < 200; i++) if (w.A.sfx('deal', { index: i })) played++;
    assert.ok(played < 200 && played >= 30, `deal flood played ${played}`);
    assert.equal(w.A.sfx('total', { intensity: 1 }), true);
    assert.equal(w.A.sfx('beaten'), true);
  });
});
