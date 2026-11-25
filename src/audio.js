/*
 * Wickwager audio: TW.Audio, the sound of the Ember Lit table.
 *
 * Everything is synthesised in code at run time. There are no samples, no files and no network.
 * - Instruments rendered once in plain JS into small AudioBuffers, then pitched with playbackRate
 *   (one render per base note, every 4 semitones, made lazily and warmed in idle time after init):
 *     pluck    a soft nylon string (Karplus-Strong with a lowpassed pluck and a wooden body),
 *     mallet   a felt marimba bar (modal: 1, 4 and 9.3 times the pitch),
 *     kalimba  a tine (1, 6.27, 17.5) with a slow shimmer,
 *     bell     a warm hand bell (prime, twelfth, a little octave) with a beating twin,
 *     bead     a wooden abacus bead, for money and small ticks,
 *     gong     a deep temple gong, for the Boss Blind.
 * - Live nodes for the rest: filtered noise for card slides, whooshes and paper; sine thumps on felt;
 *   heavily filtered saw pads for the music; brown noise for the candle hum.
 * - One generated wooden room (ConvolverNode), a bus compressor and a soft ceiling (WaveShaper)
 *   keep stacked sounds below 0 dBFS (the ceiling never passes -1 dBFS).
 * - The key is D major. Every scoring tick climbs the D major pentatonic, so ticks, chords and the
 *   music always agree.
 *
 * API. Nothing here ever throws. Without Web Audio (Node, old browsers) and before init() it is a no-op.
 *   TW.Audio.init()                  create or resume the AudioContext. Call it from a user gesture; safe to call
 *                                    often. Called earlier, it waits for the first pointer or key press.
 *   TW.Audio.sfx(name, opts) → bool  true when the sound was scheduled. opts (all optional):
 *       index      0..n  step number in a sequence: scoring ticks climb the ladder with it (chip, mult, xmult,
 *                        again, money), select climbs with the number of cards chosen, deal varies per card.
 *                        `step` is read as a synonym.
 *       intensity  0..1  size of total, beaten, win, collect, xmult and boss (e.g. how far the total beat the target).
 *                        Default 0.5. boss below 0.35 is the light version for a Boss twist inside a payout.
 *       pitch      semitones up or down (-24..24).
 *       pan        -1..1 place the sound left or right (where its card or Joker sits).
 *       delay      ms    schedule ahead on the audio clock (sample-accurate sequences).
 *   TW.Audio.music(on, variant)      on: true | false | 'table' | 'shop'. variant: 'table' (title, Blind select,
 *                                    play) or 'shop' (Shop and packs). Switching crossfades; off fades out and stops.
 *   TW.Audio.setVolume(kind, v)      kind 'sfx' | 'music', v 0..1 (values above 1 are read as percent). A perceptual
 *                                    curve is applied. setVolume(v) alone sets the sound effects.
 *   TW.Audio.setMuted(bool)          mutes everything (music keeps its place). Muted, the context is suspended and the
 *                                    music's scheduler stops once the sounds playing have rung out, as for a hidden page.
 *   TW.Audio.state()                 { supported, ready, running, context, muted, hidden, volume: { sfx, music },
 *                                    music: { on, variant, playing, songs, scheduler, bar, section }, voices, bank,
 *                                    bankMs, bankMaxMs, names }
 *   TW.Audio.ladder(index)           the MIDI note a scoring step plays (A4 = 69 up to D6 = 86), e.g. to tint a label.
 *   TW.Audio.NAMES                   the sound names, below.
 *   Spelling from SPEC §6.9 and the v2 UI also works: play(name, { step }), setMusicVolume(v), and the old
 *   names in ALIASES.
 *   Browser-only tools for tools/audio-preview.html and the checks: render(name, opts, cfg) → Promise<AudioBuffer>,
 *   renderStack([[name, opts, delayMs]], cfg), renderMusic(variant, seconds, cfg), measure(buffer) → stats.
 *
 * Sounds (each one line; the UI calls exactly these names):
 *   select    a soft kalimba note over a paper tick; climbs with the number of cards chosen (index)
 *   deselect  the same tine a step lower and shorter, set down on felt
 *   deal      a card leaving the deck: snap, slide over cloth, a soft landing (varies with index)
 *   play      the played cards sweep to the stage and land on the felt
 *   chip      a wooden marimba tick for +Chips; climbs the ladder with index
 *   mult      a warm plucked string with its octave below for +Mult; climbs with index
 *   xmult     a fast three-string strum, a felt drum and a bell for ×Mult; climbs with index, grows with intensity
 *   again     a quick rising double strike for a retrigger (the "Encore!" note)
 *   total     a fat warm strummed D major chord with a felt drum and a bell; grows with intensity
 *   beaten    a bright, rounded hand-bell cascade over a low string chord: Blind beaten
 *   lose      a candle blown out, then a falling minor line over a low drone: Game Over
 *   win       a harp run up two octaves into a full chord with bells: You win!
 *   collect   a wooden box set down and a rising three-string pluck with two beads: Collect $N
 *   buy       a card laid on the felt and a rising fifth
 *   sell      a falling fifth and two beads
 *   reroll    a rattle of wooden beads and a rising tine pair
 *   pack      paper torn open, a warm swell and two tines
 *   pick      a quick card flip and a plucked fifth with a small bell
 *   use       a rising shimmer that settles on two bells: a Tarot, Planet or Spectral card is used
 *   skip      a short air sweep and two falling beads
 *   boss      a deep gong, a felt drum and a low tritone: the Boss Blind (lighter below intensity 0.35)
 *   tag       two small bells a fourth apart
 *   error     two muted felt knocks, falling (no buzzer)
 *   button    one small wooden bead
 *   shuffle   a riffle of card flicks, then the deck squared on the felt
 *   discard   cards swept away with a falling whoosh
 *   money     two quick abacus beads; climbs with index ($ steps and cash-out lines)
 *   flip      a quick paper flick with a tiny tick
 *
 * Music: generative loops on an AudioContext clock, scheduled ahead by a setTimeout look-ahead timer
 * (no requestAnimationFrame). The table loop (72 bpm) is felt pads, a soft mallet pulse, a low string bass, sparse
 * kalimba with a dotted-eighth echo and the candle hum; it walks through eight progressions in four arrangements.
 * The Shop loop (80 bpm) is a plucked harp arpeggio over a walking string bass with a few bells. While the page is
 * hidden or the sound is muted, the audio fades out and, once the sounds still playing have rung out, the context is
 * suspended and the music's scheduler stops (a silent game costs nothing); shown or unmuted, it resumes where it was.
 */
(() => {
  'use strict';
  const TW = (globalThis.TW = globalThis.TW || {});
  if (TW.Audio && TW.Audio.__wick) return; // loaded twice (the bench, a rebuild): keep the first

  // =============================================================== names
  const NAMES = Object.freeze([
    'select', 'deselect', 'deal', 'play', 'chip', 'mult', 'xmult', 'again', 'total', 'beaten', 'lose', 'win', 'collect', 'buy',
    'sell', 'reroll', 'pack', 'pick', 'use', 'skip', 'boss', 'tag', 'error', 'button', 'shuffle', 'discard', 'money', 'flip',
  ]);
  /** Older spellings (SPEC §6.9, the v2 UI) → the sound that now plays. */
  const ALIASES = Object.freeze({
    chips: 'chip', slide: 'deal', pop: 'flip', bell: 'beaten', tickets: 'collect', whoosh: 'play', stamp: 'tag',
    shine: 'use', spooky: 'use', tide: 'boss', cashout: 'collect', click: 'button',
  });

  // =============================================================== tuning
  const LEAD = 0.006; //          s from a call to its first sample
  const AHEAD = 0.3; //           s of music scheduled ahead of the clock
  const TICK_MS = 60; //          look-ahead timer period
  const VOICE_CAP = 48; //        live sound-effect voices before quiet ones are dropped
  const TRIM = 0.66; //           undoes the bus compressor's automatic make-up gain (measured +3.6 dB), so quiet sounds pass at unity
  const REV_LEVEL = 0.62; //      room return
  const MUSIC_SEND = 0.3; //      music into the room
  const CEIL_KNEE = 0.6; //       the soft ceiling is linear up to this level ...
  const CEIL_MAX = 0.96; //       ... and bends towards this one (the curve ends at 0.89, -1 dBFS)
  const PRE_ROLL = 0.8; //        s of silence before an offline render: Chrome's compressor opens up from a reduced gain

  // =============================================================== small helpers
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const PENT = [0, 2, 4, 7, 9];
  /** Degree k of D major pentatonic; degree 0 is D4 (MIDI 62). */
  const deg = (k) => 62 + 12 * Math.floor(k / 5) + PENT[((k % 5) + 5) % 5];
  /** The scoring ladder: A4 (index 0) up to D6 (index 7 and above). */
  const ladder = (i) => deg(3 + Math.min(Math.max(0, i | 0), 7));
  /** Slider 0..1 to gain: amplitude v^1.7 makes loudness close to linear in v (Stevens: loudness ~ amplitude^0.6). */
  const curve = (v) => (v > 0 ? Math.pow(v, 1.7) : 0);
  const AC = () => globalThis.AudioContext || globalThis.webkitAudioContext || null;
  const OAC = () => globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext || null;
  const hasDoc = () => typeof document !== 'undefined' && !!document && typeof document.addEventListener === 'function';
  const nowMs = () => (typeof performance !== 'undefined' && performance && performance.now ? performance.now() : Date.now());
  const later = (fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null);
  const cancel = (id) => { if (id != null && typeof clearTimeout === 'function') clearTimeout(id); };
  const swallow = (p) => { if (p && typeof p.catch === 'function') p.catch(() => {}); };
  const drop = (n) => { try { n.disconnect(); } catch (e) { /* already gone */ } };

  function mulberry32(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // =============================================================== offline DSP (plain JS into Float32Arrays)
  /** RBJ biquad coefficients, normalised: [b0, b1, b2, a1, a2]. */
  function biquad(type, f, q, db, sr) {
    const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
    const cw = Math.cos(w), sw = Math.sin(w), A = Math.pow(10, (db || 0) / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'peaking') {
      const al = sw / (2 * q);
      b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A;
    } else { // high shelf, slope 1
      const s = 2 * Math.sqrt(A) * (sw / Math.SQRT2);
      b0 = A * (A + 1 + (A - 1) * cw + s); b1 = -2 * A * (A - 1 + (A + 1) * cw); b2 = A * (A + 1 + (A - 1) * cw - s);
      a0 = A + 1 - (A - 1) * cw + s; a1 = 2 * (A - 1 - (A + 1) * cw); a2 = A + 1 - (A - 1) * cw - s;
    }
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function runBiquad(x, c) {
    const b0 = c[0], b1 = c[1], b2 = c[2], a1 = c[3], a2 = c[4];
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const xi = x[i];
      const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = xi; y2 = y1; y1 = y;
      x[i] = y;
    }
  }
  function onePole(x, fc, sr) {
    const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
    let y = 0;
    for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y; }
  }
  /** DC blocker, a 25 ms fade at the end, then normalise the peak to 1. */
  function finish(x, sr) {
    const R = 1 - (2 * Math.PI * 16) / sr;
    let px = 0, py = 0;
    for (let i = 0; i < x.length; i++) { const y = x[i] - px + R * py; px = x[i]; py = y; x[i] = y; }
    const fade = Math.min(x.length, Math.floor(sr * 0.025));
    for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;
    let pk = 0;
    for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > pk) pk = a; }
    if (pk > 0) { const s = 1 / pk; for (let i = 0; i < x.length; i++) x[i] *= s; }
    return x;
  }
  /** Modal synthesis: damped sines [ratio, amp, t60 seconds] from a resonator recursion, a soft onset, a strike. */
  function renderModal(sr, f, spec) {
    const n = Math.max(16, Math.ceil(spec.len * sr));
    const x = new Float32Array(n);
    for (const [ratio, amp, t60] of spec.parts) {
      const fr = f * ratio;
      if (!(fr > 0) || fr > sr * 0.45 || !(amp > 0)) continue;
      const w = (2 * Math.PI * fr) / sr;
      const r = Math.exp(-6.907755 / (Math.max(0.004, t60) * sr));
      const c = 2 * r * Math.cos(w), r2 = r * r;
      const stop = Math.min(n, Math.ceil(Math.log(1e-5 / amp) / Math.log(r)) + 2);
      let y2 = 0, y1 = amp * r * Math.sin(w);
      x[1] += y1;
      for (let i = 2; i < stop; i++) { const y = c * y1 - r2 * y2; x[i] += y; y2 = y1; y1 = y; }
    }
    const att = Math.max(1, Math.floor((spec.attack || 0.001) * sr));
    for (let i = 0; i < att && i < n; i++) x[i] *= i / att;
    if (spec.click) {
      const rnd = mulberry32(spec.seed || 1), cl = Math.max(1, spec.click.len * sr);
      const a = 1 - Math.exp((-2 * Math.PI * spec.click.fc) / sr);
      let lp = 0;
      for (let i = 0; i < cl * 5 && i < n; i++) { lp += a * (rnd() * 2 - 1 - lp); x[i] += lp * spec.click.amp * 2.5 * Math.exp(-i / cl); }
    }
    if (spec.lp) onePole(x, spec.lp, sr);
    return finish(x, sr);
  }
  /** Karplus-Strong string: a lowpassed noise pluck in a tuned loop (allpass for the fraction), then a wooden body. */
  function renderPluck(sr, f, spec) {
    const n = Math.max(16, Math.ceil(spec.len * sr));
    const x = new Float32Array(n);
    const loop = sr / f - 0.5;
    let N = Math.floor(loop), frac = loop - N;
    if (frac < 0.2) { N -= 1; frac += 1; }
    N = Math.max(2, N);
    const C = (1 - frac) / (1 + frac);
    const line = new Float32Array(N);
    const rnd = mulberry32(spec.seed || 7);
    const a = 1 - Math.exp((-2 * Math.PI * spec.bright) / sr);
    let l1 = 0, l2 = 0;
    for (let i = 0; i < N; i++) { l1 += a * (rnd() * 2 - 1 - l1); l2 += a * (l1 - l2); line[i] = l2; }
    const P = Math.max(1, Math.round(N * spec.pos)), ex = Float32Array.from(line);
    for (let i = 0; i < N; i++) line[i] = ex[i] - 0.85 * ex[(i - P + N) % N]; // where along the string it was plucked
    let mean = 0;
    for (let i = 0; i < N; i++) mean += line[i];
    mean /= N;
    let pk = 0;
    for (let i = 0; i < N; i++) { line[i] -= mean; pk = Math.max(pk, Math.abs(line[i])); }
    if (pk > 0) for (let i = 0; i < N; i++) line[i] /= pk;
    const rho = Math.pow(0.001, 1 / (spec.t60 * f));
    let idx = 0, prev = 0, ax = 0, ay = 0;
    for (let i = 0; i < n; i++) {
      const cur = line[idx];
      x[i] = cur;
      const avg = 0.5 * (cur + prev);
      prev = cur;
      const ap = C * avg + ax - C * ay;
      ax = avg; ay = ap;
      line[idx] = ap * rho;
      if (++idx >= N) idx = 0;
    }
    const att = Math.floor(0.0025 * sr);
    for (let i = 0; i < att && i < n; i++) x[i] *= i / att;
    runBiquad(x, biquad('peaking', 230, 1.0, 3, sr));
    runBiquad(x, biquad('shelf', 3200, 0.7, -6, sr));
    return finish(x, sr);
  }
  /** A small wooden room: 8 ms pre-delay, early reflections, a tail that darkens as it decays (RT60 about 1.3 s). */
  function makeIR(sr) {
    const n = Math.floor(sr * 1.7), pre = Math.floor(sr * 0.008), rt = 1.3;
    const taps = [0.0107, 0.0173, 0.0229, 0.0311, 0.0397, 0.0523, 0.0641];
    return [0, 1].map((c) => {
      const ch = new Float32Array(n), rnd = mulberry32(101 + c * 37);
      let lp = 0, a = 0;
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / sr;
        if ((i & 31) === 0 || i === pre) a = 1 - Math.exp((-2 * Math.PI * (850 + 6400 * Math.exp(-t * 2.4))) / sr);
        lp += a * (rnd() * 2 - 1 - lp);
        ch[i] = lp * Math.exp((-6.907755 * t) / rt);
      }
      const on = Math.floor(sr * 0.002);
      for (let i = 0; i < on; i++) ch[pre + i] *= i / on;
      taps.forEach((tt, k) => { const i = Math.floor((tt + c * 0.0013) * sr); if (i < n) ch[i] += (k % 2 ? -0.5 : 0.5) * Math.pow(0.78, k); });
      return ch;
    });
  }
  /** Seamlessly looping noise (white, or brown for the candle hum). */
  function makeNoise(sr, seconds, brown, seed) {
    const n = Math.floor(sr * seconds), m = Math.floor(sr * 0.08);
    const raw = new Float32Array(n + m), rnd = mulberry32(seed);
    let b = 0;
    for (let i = 0; i < n + m; i++) {
      const w = rnd() * 2 - 1;
      if (brown) { b = (b + 0.02 * w) / 1.02; raw[i] = b * 3.5; } else raw[i] = w;
    }
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = i < m ? raw[i] * Math.sqrt(i / m) + raw[n + i] * Math.sqrt(1 - i / m) : raw[i];
    return out;
  }
  function makeCeiling() {
    const n = 4096, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, ax = Math.abs(x);
      const y = ax <= CEIL_KNEE ? ax : CEIL_KNEE + (CEIL_MAX - CEIL_KNEE) * Math.tanh((ax - CEIL_KNEE) / (CEIL_MAX - CEIL_KNEE));
      c[i] = x < 0 ? -y : y;
    }
    return c;
  }

  // =============================================================== the instrument bank
  const INST = {
    pluck: { lo: 34, hi: 94, step: 4, make: (sr, f, seed) => {
      const t60 = clamp(2.6 * Math.pow(110 / f, 0.42), 0.55, 2.6);
      return renderPluck(sr, f, { len: Math.min(2.0, t60 * 0.85 + 0.12), t60, bright: clamp(f * 5.5, 900, 6500), pos: 0.17, seed });
    } },
    mallet: { lo: 54, hi: 90, step: 4, make: (sr, f, seed) => {
      const td = clamp(0.95 * Math.pow(440 / f, 0.55), 0.22, 1.5);
      return renderModal(sr, f, { len: td * 0.9 + 0.02, attack: 0.0012, seed, lp: 7000,
        parts: [[1, 1, td], [3.98, 0.17, td * 0.22], [9.3, 0.05, td * 0.07]], click: { amp: 0.1, fc: 2600, len: 0.004 } });
    } },
    kalimba: { lo: 66, hi: 98, step: 4, make: (sr, f, seed) => {
      const tk = clamp(1.5 * Math.pow(587 / f, 0.5), 0.5, 2.2);
      return renderModal(sr, f, { len: tk * 0.85, attack: 0.0015, seed, lp: 7500,
        parts: [[1, 1, tk], [1.0012, 0.12, tk * 0.9], [6.27, 0.11, tk * 0.12], [17.5, 0.025, tk * 0.04]], click: { amp: 0.05, fc: 3500, len: 0.003 } });
    } },
    bell: { lo: 70, hi: 94, step: 4, make: (sr, f, seed) => {
      const tb = clamp(2.4 * Math.pow(587 / f, 0.4), 1.2, 3.2);
      return renderModal(sr, f, { len: Math.min(2.2, tb * 0.8), attack: 0.0025, seed, lp: 6000,
        parts: [[1, 1, tb], [1.0016, 0.5, tb * 0.95], [2, 0.07, tb * 0.5], [3, 0.2, tb * 0.4], [4.2, 0.05, tb * 0.22], [5.43, 0.022, tb * 0.12]],
        click: { amp: 0.025, fc: 4000, len: 0.003 } });
    } },
    bead: { lo: 58, hi: 94, step: 4, make: (sr, f, seed) => renderModal(sr, f, { len: 0.16, attack: 0.0006, seed, lp: 8000,
      parts: [[1, 1, 0.1], [2.756, 0.3, 0.045], [5.404, 0.09, 0.022]], click: { amp: 0.12, fc: 3000, len: 0.002 } }) },
    gong: { lo: 38, hi: 62, step: 12, make: (sr, f, seed) => renderModal(sr, f, { len: 3.0, attack: 0.02, seed, lp: 2500,
      parts: [[1, 1, 3.2], [1.0035, 0.5, 3.0], [1.52, 0.6, 2.5], [2, 0.42, 2.0], [2.41, 0.34, 1.6], [2.91, 0.24, 1.25], [3.37, 0.14, 1.0], [4.12, 0.08, 0.7]],
      click: { amp: 0.04, fc: 900, len: 0.012 } }) },
  };
  const bankCache = new Map(); // `${sampleRate}|${inst}|${base}` → AudioBuffer (shared by every context at that rate)
  const sharedCache = new Map(); // IR and noise buffers per sample rate
  const bankStats = { ms: 0, max: 0 }; // time spent rendering the bank (state().bankMs, for the bench)

  function toBuffer(ctx, chans) {
    const buf = ctx.createBuffer(chans.length, chans[0].length, ctx.sampleRate);
    chans.forEach((d, c) => { if (buf.copyToChannel) buf.copyToChannel(d, c); else buf.getChannelData(c).set(d); });
    return buf;
  }
  function bankNote(ctx, inst, midi) {
    const I = INST[inst];
    if (!I || !Number.isFinite(midi)) return null;
    const base = clamp(I.lo + Math.round((midi - I.lo) / I.step) * I.step, I.lo, I.hi);
    const key = ctx.sampleRate + '|' + inst + '|' + base;
    let buffer = bankCache.get(key);
    if (!buffer) {
      const t0 = nowMs();
      buffer = toBuffer(ctx, [I.make(ctx.sampleRate, mtof(base), base * 131 + inst.length * 7919)]);
      bankCache.set(key, buffer);
      const ms = nowMs() - t0;
      bankStats.ms += ms;
      if (ms > bankStats.max) bankStats.max = ms;
    }
    return { buffer, rate: Math.pow(2, (midi - base) / 12) };
  }
  function shared(ctx, what) {
    const key = ctx.sampleRate + '|' + what;
    let buf = sharedCache.get(key);
    if (!buf) {
      const sr = ctx.sampleRate;
      buf = toBuffer(ctx, what === 'ir' ? makeIR(sr) : [makeNoise(sr, what === 'brown' ? 4 : 2, what === 'brown', what === 'brown' ? 77 : 33)]);
      sharedCache.set(key, buf);
    }
    return buf;
  }
  /** Render the whole bank in idle moments after init, a note at a time, so no sound waits on a render. */
  function warmBank(c) {
    const jobs = [];
    for (const inst of ['mallet', 'kalimba', 'bead', 'pluck', 'bell', 'gong']) {
      const I = INST[inst];
      for (let m = I.lo; m <= I.hi; m += I.step) jobs.push([inst, m]);
    }
    const step = () => {
      if (c !== ctx) return; // closed or replaced
      const t0 = nowMs();
      while (jobs.length && nowMs() - t0 < 6) { const [inst, m] = jobs.shift(); try { bankNote(c, inst, m); } catch (e) { if (API.debug) throw e; } }
      if (jobs.length) later(step, 16);
    };
    later(step, 30);
  }

  // =============================================================== the graph: buses, room, compressor, ceiling
  function gainNode(c, v) { const g = c.createGain(); g.gain.value = v; return g; }
  function filt(c, type, f, q) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
  function setP(p, v) { if (p) p.value = v; }

  function buildGraph(c, cfg) {
    const g = { ctx: c, sr: c.sampleRate };
    g.master = gainNode(c, cfg.muted ? 0 : 1);
    g.master.connect(c.destination);
    g.ceil = c.createWaveShaper();
    g.ceil.curve = CEILING;
    g.ceil.oversample = 'none'; // no resampling filter, so nothing can ring past the ceiling
    g.ceil.connect(g.master);
    g.trim = gainNode(c, TRIM);
    g.trim.connect(g.ceil);
    g.comp = c.createDynamicsCompressor();
    setP(g.comp.threshold, -12); setP(g.comp.knee, 8); setP(g.comp.ratio, 3.5); setP(g.comp.attack, 0.004); setP(g.comp.release, 0.22);
    g.comp.connect(g.trim);
    g.sum = gainNode(c, 1);
    g.sum.connect(g.comp);
    g.rev = c.createConvolver();
    g.rev.buffer = shared(c, 'ir');
    g.revOut = gainNode(c, REV_LEVEL);
    g.rev.connect(g.revOut);
    g.revOut.connect(g.sum);
    g.sfx = gainNode(c, curve(cfg.sfx));
    g.sfx.connect(g.sum);
    g.sfxWet = gainNode(c, curve(cfg.sfx));
    g.sfxWet.connect(g.rev);
    g.mus = gainNode(c, curve(cfg.music));
    g.duck = gainNode(c, 1);
    g.mus.connect(g.duck);
    g.duck.connect(g.sum);
    g.musSend = gainNode(c, MUSIC_SEND);
    g.duck.connect(g.musSend);
    g.musSend.connect(g.rev);
    g.white = shared(c, 'white');
    g.brown = shared(c, 'brown');
    return g;
  }
  const CEILING = makeCeiling();

  /** Lower the music under a big moment that starts at `at` (audio time), then let it back up. */
  function duck(g, depth, hold, at) {
    const p = g.duck && g.duck.gain;
    if (!p) return;
    const now = g.ctx.currentTime, t = Math.max(now, num(at, now));
    p.cancelScheduledValues(t);
    if (t <= now) p.setValueAtTime(num(p.value, 1), now);
    p.setTargetAtTime(depth, t, 0.05);
    p.setTargetAtTime(1, t + hold, 0.6);
  }

  // =============================================================== voices
  let voiceSeed = 1;
  function makeVoice(g, t, o) {
    const c = g.ctx;
    const v = { G: g, ctx: c, t, o, nodes: [], end: t, last: null, rng: mulberry32(Math.imul(++voiceSeed, 0x9e3779b1) >>> 0) };
    v.out = gainNode(c, 1);
    let tail = v.out;
    if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; v.out.connect(p); tail = p; v.nodes.push(p); }
    tail.connect(g.sfx);
    v.wet = gainNode(c, 0);
    tail.connect(v.wet);
    v.wet.connect(g.sfxWet);
    v.nodes.push(v.out, v.wet);
    v.send = (a) => { v.wet.gain.value = a; };
    v.track = (src, nodes, start, stop, offset) => {
      for (const n of nodes) v.nodes.push(n);
      if (offset != null) src.start(start, offset); else src.start(start);
      src.stop(stop);
      if (stop >= v.end) { v.end = stop; v.last = src; }
    };
    return v;
  }
  function seal(v) {
    if (!v.last) return;
    const nodes = v.nodes;
    v.last.onended = () => { for (const n of nodes) drop(n); };
  }

  /** A note from the bank into dest. o: { lp, pan, cut (s: fade out early), rate, also (a second destination), alsoGain }. */
  function playBank(c, dest, inst, midi, t, gain, o, owner) {
    const b = bankNote(c, inst, midi);
    if (!b || !(gain > 0)) return 0;
    const src = c.createBufferSource();
    src.buffer = b.buffer;
    const rate = b.rate * (o.rate || 1);
    src.playbackRate.value = rate;
    const g = c.createGain();
    const nodes = [src, g];
    src.connect(g);
    let tail = g;
    if (o.lp) { const f = filt(c, 'lowpass', o.lp, 0.5); tail.connect(f); tail = f; nodes.push(f); }
    if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); tail.connect(p); tail = p; nodes.push(p); }
    tail.connect(dest);
    if (o.also) { const s = gainNode(c, o.alsoGain == null ? 1 : o.alsoGain); tail.connect(s); s.connect(o.also); nodes.push(s); }
    const full = b.buffer.duration / rate;
    let stop = t + full;
    if (o.cut && o.cut < full) {
      g.gain.setValueAtTime(gain, t);
      g.gain.setValueAtTime(gain, t + o.cut * 0.55);
      g.gain.linearRampToValueAtTime(0, t + o.cut);
      stop = t + o.cut + 0.005;
    } else g.gain.value = gain;
    owner.track(src, nodes, t, stop);
    return stop;
  }
  const note = (v, inst, midi, dt, gain, o) => playBank(v.ctx, v.out, inst, midi, v.t + dt, gain, o || {}, v);

  function noiseSrc(v, brown) {
    const s = v.ctx.createBufferSource();
    s.buffer = brown ? v.G.brown : v.G.white;
    s.loop = true;
    return s;
  }
  /** Band-passed noise sweeping f0 → f1 (→ f2): slides, whooshes, puffs. */
  function swish(v, dt, dur, f0, f1, q, peak, attack, f2) {
    const c = v.ctx, t = v.t + dt;
    const src = noiseSrc(v);
    const bp = filt(c, 'bandpass', f0, q);
    bp.frequency.setValueAtTime(f0, t);
    if (f2) {
      bp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.45);
      bp.frequency.exponentialRampToValueAtTime(f2, t + dur);
    } else bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = gainNode(c, 0);
    const a = Math.max(0.001, Math.min(attack, dur * 0.8));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(bp); bp.connect(g); g.connect(v.out);
    v.track(src, [src, bp, g], t, t + dur + 0.01, v.rng() * 1.5);
  }
  /** A felt drum: a sine falling f0 → f1, with a breath of low noise for the felt. */
  function thump(v, dt, f0, f1, dur, peak) {
    const c = v.ctx, t = v.t + dt;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + Math.min(0.12, dur * 0.4));
    const g = gainNode(c, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.004, dur / 5);
    o.connect(g); g.connect(v.out);
    v.track(o, [o, g], t, t + 0.004 + dur * 1.5);
    const n = noiseSrc(v), lp = filt(c, 'lowpass', Math.min(900, f0 * 3), 0.7), gn = gainNode(c, 0);
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(peak * 0.35, t + 0.003);
    gn.gain.setTargetAtTime(0, t + 0.003, 0.012);
    n.connect(lp); lp.connect(gn); gn.connect(v.out);
    v.track(n, [n, lp, gn], t, t + 0.1, v.rng() * 1.5);
  }
  /** An oscillator with a soft attack and an exponential decay (swells, drones, knocks). */
  function tone(v, dt, f, type, peak, attack, decay, lp, f1) {
    const c = v.ctx, t = v.t + dt;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + attack + decay * 0.5);
    const g = gainNode(c, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0, t + attack, decay / 5);
    const nodes = [o, g];
    let tail = o;
    if (lp) { const f2 = filt(c, 'lowpass', lp, 0.5); o.connect(f2); tail = f2; nodes.push(f2); }
    tail.connect(g); g.connect(v.out);
    v.track(o, nodes, t, t + attack + decay * 1.5);
  }
  /** A tiny paper tick. */
  function tick(v, dt, peak) {
    const c = v.ctx, t = v.t + dt;
    const src = noiseSrc(v), hp = filt(c, 'highpass', 2600, 0.7), lp = filt(c, 'lowpass', 7000, 0.7), g = gainNode(c, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.001);
    g.gain.setTargetAtTime(0, t + 0.001, 0.003);
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(v.out);
    v.track(src, [src, hp, lp, g], t, t + 0.03, v.rng() * 1.5);
  }
  /** Noise cut into grains (paper, a riffle): list of [t, amp, len], sorted, through a filter chain. */
  function grains(v, dt, list, chain, peak) {
    const c = v.ctx, t = v.t + dt;
    const src = noiseSrc(v), g = gainNode(c, 0);
    g.gain.setValueAtTime(0, t);
    let end = t;
    for (const [gt, ga, gl] of list) {
      const s = Math.max(end, t + gt);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(peak * ga, s + gl * 0.25);
      g.gain.linearRampToValueAtTime(0, s + gl);
      end = s + gl;
    }
    let head = src;
    for (const n of chain) { head.connect(n); head = n; }
    head.connect(g); g.connect(v.out);
    v.track(src, [src, ...chain, g], t, end + 0.01, v.rng() * 1.5);
  }

  // =============================================================== the sounds
  // prio 2 always plays, 1 is scoring, 0 is interface (dropped first when many voices ring). len is the longest
  // the sound lasts before its room tail, for offline renders.
  const SFX = {
    button: { prio: 0, len: 0.2, fn(v, o) {
      note(v, 'bead', 79 + o.pitch, 0, 0.21);
      v.send(0.05);
    } },
    select: { prio: 0, len: 0.4, fn(v, o) {
      tick(v, 0, 0.04);
      note(v, 'kalimba', deg(5 + Math.min(o.index, 5)) + o.pitch, 0.003, 0.1, { cut: 0.32 });
      v.send(0.08);
    } },
    deselect: { prio: 0, len: 0.3, fn(v, o) {
      note(v, 'kalimba', deg(4 + Math.min(o.index, 5)) + o.pitch, 0, 0.075, { cut: 0.2, lp: 2600 });
      thump(v, 0.004, 210, 150, 0.05, 0.045);
      v.send(0.05);
    } },
    deal: { prio: 0, len: 0.2, fn(v, o) {
      const P = Math.pow(2, o.pitch / 12) * (1 + 0.035 * (((o.index * 7) % 5) - 2));
      swish(v, 0, 0.014, 3400 * P, 2800 * P, 1.0, 0.18, 0.001);
      swish(v, 0.004, 0.066, 2100 * P, 950 * P, 1.3, 0.3, 0.008);
      thump(v, 0.058, 200 * P, 120 * P, 0.06, 0.1);
      v.send(0.05);
    } },
    play: { prio: 1, len: 0.5, fn(v, o) {
      const P = Math.pow(2, o.pitch / 12);
      swish(v, 0, 0.32, 650 * P, 2000 * P, 1.3, 0.42, 0.06, 800 * P);
      thump(v, 0.27, 170 * P, 95 * P, 0.12, 0.17);
      note(v, 'bead', 69 + o.pitch, 0.272, 0.07);
      v.send(0.1);
    } },
    chip: { prio: 1, len: 0.9, fn(v, o) {
      const k = Math.min(o.index, 7), m = ladder(o.index) + o.pitch;
      note(v, 'mallet', m, 0, 0.25 * (1 + 0.03 * k));
      if (o.index > 7) note(v, 'kalimba', m + 12, 0.004, 0.02 * Math.min(o.index - 7, 4)); // past the top: more shine, not more height
      v.send(0.12);
    } },
    mult: { prio: 1, len: 1.6, fn(v, o) {
      const k = Math.min(o.index, 7), m = ladder(o.index) + o.pitch;
      note(v, 'pluck', m, 0, 0.32 * (1 + 0.11 * k), { lp: 3600 });
      note(v, 'pluck', m - 12, 0.006, 0.14);
      thump(v, 0, 140, 80, 0.12, 0.06);
      v.send(0.16);
    } },
    xmult: { prio: 1, len: 2.4, fn(v, o) {
      const m = ladder(o.index) + o.pitch, s = 0.95 + 0.8 * o.intensity;
      note(v, 'pluck', m - 12, 0, 0.16 * s);
      note(v, 'pluck', m - 5, 0.016, 0.19 * s);
      note(v, 'pluck', m, 0.032, 0.23 * s, { lp: 4000 });
      note(v, 'bell', Math.min(m, 86), 0.05, 0.1 * s);
      thump(v, 0, 120, 55, 0.35, 0.24 * s);
      swish(v, 0, 0.18, 700, 2400, 2, 0.07 * s, 0.05);
      v.send(0.22);
    } },
    again: { prio: 1, len: 0.9, fn(v, o) {
      const m = ladder(o.index) + o.pitch;
      note(v, 'mallet', m, 0, 0.19);
      note(v, 'mallet', Math.min(deg(5 + Math.min(o.index, 7)), 88) + o.pitch, 0.06, 0.21);
      swish(v, 0, 0.09, 1400, 3600, 2.5, 0.08, 0.01);
      v.send(0.14);
    } },
    money: { prio: 1, len: 0.3, fn(v, o) {
      const m = ladder(o.index) + o.pitch;
      note(v, 'bead', m, 0, 0.35);
      note(v, 'bead', m + 5, 0.035, 0.27);
      v.send(0.08);
    } },
    total: { prio: 2, len: 2.6, fn(v, o) {
      const i = o.intensity, p = o.pitch;
      const VOICINGS = [[50, 57, 62, 66], [38, 50, 57, 62, 66], [38, 50, 57, 62, 66, 69], [38, 50, 57, 62, 66, 69, 74], [38, 50, 57, 62, 66, 69, 74, 76]];
      const chord = VOICINGS[Math.round(i * 4)];
      const sd = 0.02 - 0.006 * i;
      chord.forEach((m, j) => note(v, 'pluck', m + p, j * sd, (0.17 + 0.09 * i) * (m < 45 ? 0.9 : 1), { pan: (j / (chord.length - 1) - 0.5) * 0.5 }));
      thump(v, 0, 95, 42, 0.55 + 0.35 * i, 0.2 + 0.18 * i);
      const top = 0.06 + chord.length * sd;
      note(v, 'bell', 86 + p, top, 0.09 + 0.1 * i);
      if (i > 0.55) note(v, 'bell', 81 + p, top + 0.09, 0.06 + 0.06 * i);
      for (const m of [62, 66, 69]) tone(v, 0.01, mtof(m + p), 'sawtooth', 0.03 + 0.03 * i, 0.05, 1.4, 1400);
      swish(v, 0, 0.5, 400, 1500, 0.6, 0.04 + 0.05 * i, 0.04);
      v.send(0.24 + 0.14 * i);
      duck(v.G, 0.5, 1.6, v.t);
    } },
    beaten: { prio: 2, len: 2.4, fn(v, o) {
      const p = o.pitch, s = 1.13 + 0.4 * o.intensity;
      [74, 76, 78, 81, 83, 86].forEach((m, j) => note(v, 'bell', m + p, j * 0.07, (0.17 - j * 0.009) * s, { pan: j % 2 ? 0.3 : -0.3 }));
      note(v, 'bell', 81 + p, 0.5, 0.14 * s, { pan: -0.15 });
      note(v, 'bell', 86 + p, 0.5, 0.13 * s, { pan: 0.15 });
      note(v, 'pluck', 50 + p, 0, 0.21);
      note(v, 'pluck', 57 + p, 0.03, 0.2);
      note(v, 'pluck', 62 + p, 0.06, 0.17);
      thump(v, 0, 110, 55, 0.4, 0.2);
      v.send(0.3);
      duck(v.G, 0.55, 1.8, v.t);
    } },
    collect: { prio: 1, len: 1.4, fn(v, o) {
      const p = o.pitch;
      thump(v, 0, 160, 90, 0.12, 0.15);
      note(v, 'bead', 64 + p, 0, 0.1);
      const run = o.intensity > 0.5 ? [69, 74, 78, 81] : [69, 74, 78];
      run.forEach((m, j) => note(v, 'pluck', m + p, 0.03 + j * 0.07, 0.22));
      note(v, 'bead', 81 + p, 0.12, 0.09);
      note(v, 'bead', 86 + p, 0.16, 0.075);
      v.send(0.16);
    } },
    buy: { prio: 1, len: 1.2, fn(v, o) {
      const p = o.pitch;
      thump(v, 0, 190, 115, 0.07, 0.13);
      swish(v, 0, 0.05, 1600, 1100, 1.2, 0.13, 0.005);
      note(v, 'pluck', 74 + p, 0.02, 0.26);
      note(v, 'pluck', 81 + p, 0.065, 0.26, { lp: 4000 });
      note(v, 'bell', 86 + p, 0.1, 0.055);
      v.send(0.15);
    } },
    sell: { prio: 1, len: 1.2, fn(v, o) {
      const p = o.pitch;
      note(v, 'pluck', 81 + p, 0, 0.25, { lp: 4000 });
      note(v, 'pluck', 74 + p, 0.06, 0.25);
      note(v, 'bead', 78 + p, 0.08, 0.12);
      note(v, 'bead', 83 + p, 0.115, 0.1);
      v.send(0.12);
    } },
    reroll: { prio: 0, len: 1.2, fn(v, o) {
      const p = o.pitch;
      [[0, 76], [0.024, 81], [0.05, 78], [0.077, 83], [0.101, 74], [0.128, 86]].forEach(([t, m], j) => note(v, 'bead', m + p, t + v.rng() * 0.004, 0.105 - j * 0.007));
      note(v, 'kalimba', 81 + p, 0.17, 0.12, { cut: 0.6 });
      note(v, 'kalimba', 86 + p, 0.23, 0.12, { cut: 0.7 });
      v.send(0.12);
    } },
    pack: { prio: 1, len: 1.4, fn(v, o) {
      const p = o.pitch, list = [];
      for (let j = 0; j < 30; j++) list.push([j * 0.0093 + v.rng() * 0.004, 0.3 + v.rng() * 0.7, 0.003 + v.rng() * 0.007]);
      const c = v.ctx;
      grains(v, 0, list, [filt(c, 'highpass', 900, 0.7), filt(c, 'bandpass', 2300, 0.8), filt(c, 'lowpass', 5000, 0.7)], 0.42);
      for (const m of [62, 69, 76]) tone(v, 0.2, mtof(m + p), 'triangle', 0.06, 0.14, 0.8, 1800);
      note(v, 'kalimba', 81 + p, 0.3, 0.15);
      note(v, 'kalimba', 86 + p, 0.38, 0.13);
      v.send(0.22);
    } },
    pick: { prio: 1, len: 1.2, fn(v, o) {
      const p = o.pitch, m = deg(5 + Math.min(o.index, 3)) + p;
      swish(v, 0, 0.045, 1200, 3000, 2, 0.17, 0.005);
      note(v, 'pluck', m, 0.015, 0.26);
      note(v, 'pluck', m + 7, 0.05, 0.21, { lp: 4000 });
      note(v, 'bell', Math.min(m + 12, 88), 0.07, 0.055);
      v.send(0.16);
    } },
    use: { prio: 1, len: 1.6, fn(v, o) {
      const p = o.pitch, P = Math.pow(2, p / 12);
      swish(v, 0, 0.34, 450 * P, 2600 * P, 3.5, 0.26, 0.2);
      note(v, 'bell', 81 + p, 0.27, 0.13);
      note(v, 'bell', 86 + p, 0.31, 0.11);
      note(v, 'kalimba', 88 + p, 0.37, 0.07);
      thump(v, 0.26, 130 * P, 65 * P, 0.2, 0.15);
      v.send(0.28);
    } },
    skip: { prio: 0, len: 0.5, fn(v, o) {
      const p = o.pitch;
      swish(v, 0, 0.22, 1900, 620, 1.4, 0.26, 0.02);
      note(v, 'bead', 76 + p, 0.06, 0.13);
      note(v, 'bead', 71 + p, 0.13, 0.11);
      v.send(0.12);
    } },
    tag: { prio: 1, len: 1.6, fn(v, o) {
      const p = o.pitch;
      note(v, 'bell', 83 + p, 0, 0.19, { pan: -0.15 });
      note(v, 'bell', 88 + p, 0.085, 0.16, { pan: 0.15 });
      v.send(0.22);
    } },
    boss: { prio: 2, len: 3.0, fn(v, o) {
      // intensity 0.5 (the default) is the Boss Blind's reveal. Below 0.35 it is a Boss twist firing inside a payout
      // ("Booed", "Capped at 18", the cap rising with the Ante): the gong's upper octaves and the tritone only, with no drum and no duck.
      const p = o.pitch, P = Math.pow(2, p / 12), s = 0.55 + 0.9 * o.intensity, full = o.intensity >= 0.35;
      if (full) note(v, 'gong', 38 + p, 0, 0.26 * s); //     the deep body
      note(v, 'gong', 50 + p, 0.012, 0.2 * s); //            its octaves, so phone speakers hear the Boss Blind too
      note(v, 'gong', 62 + p, 0.02, 0.09 * s);
      note(v, 'pluck', 50 + p, 0.05, 0.16 * s);
      note(v, 'pluck', 56 + p, 0.09, 0.1 * s); //            a low tritone for colour
      v.send(0.32);
      if (!full) return;
      thump(v, 0, 75 * P, 38 * P, 0.9, 0.26 * s);
      const c = v.ctx, src = noiseSrc(v, true), lp = filt(c, 'lowpass', 320, 0.7), g = gainNode(c, 0), t = v.t;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.09 * s, t + 0.25);
      g.gain.setTargetAtTime(0, t + 0.25, 0.35);
      src.connect(lp); lp.connect(g); g.connect(v.out);
      v.track(src, [src, lp, g], t, t + 2.4, v.rng() * 3);
      duck(v.G, 0.45, 2.2, v.t);
    } },
    win: { prio: 2, len: 3.6, fn(v, o) {
      const p = o.pitch, s = 1.4 + 0.7 * o.intensity;
      thump(v, 0, 95, 45, 0.6, 0.18 * s);
      note(v, 'pluck', 38 + p, 0, 0.1 * s);
      note(v, 'pluck', 50 + p, 0.012, 0.09 * s);
      for (let j = 0; j <= 10; j++) note(v, 'pluck', deg(j) + p, 0.05 + j * 0.058, (0.085 + j * 0.003) * s, { pan: -0.3 + j * 0.06, lp: 4200 });
      const T = 0.75;
      [38, 50, 57, 62, 66, 69, 74].forEach((m, j) => note(v, 'pluck', m + p, T + j * 0.012, 0.1 * s));
      for (const m of [50, 57, 62, 66, 69, 76]) tone(v, T, mtof(m + p), 'sawtooth', 0.02 * s, 0.25, 2.6, 1500);
      note(v, 'bell', 86 + p, T + 0.05, 0.07 * s);
      note(v, 'bell', 81 + p, T + 0.14, 0.06 * s);
      note(v, 'bell', 78 + p, T + 0.23, 0.05 * s);
      note(v, 'bell', 93 + p, T + 0.6, 0.03 * s);
      thump(v, T, 90, 42, 0.8, 0.18 * s);
      v.send(0.3);
      duck(v.G, 0.3, 3.5, v.t);
    } },
    lose: { prio: 2, len: 3.2, fn(v, o) {
      const p = o.pitch, P = Math.pow(2, p / 12);
      swish(v, 0, 0.42, 1700 * P, 380 * P, 0.7, 0.36, 0.025); //   the candle blown out
      thump(v, 0, 62 * P, 34 * P, 0.5, 0.2);
      [69, 65, 64, 62].forEach((m, j) => note(v, 'pluck', m + p, 0.28 + j * 0.28, 0.3 - j * 0.03, { lp: 2600 - j * 400 }));
      tone(v, 0.3, 146.83 * P, 'triangle', 0.07, 0.4, 2.6, 600);
      tone(v, 0.3, 73.42 * P, 'sine', 0.1, 0.4, 2.6);
      tone(v, 0.3, 110 * P, 'sine', 0.06, 0.4, 2.4);
      v.send(0.3);
      duck(v.G, 0.35, 3.0, v.t);
    } },
    error: { prio: 0, len: 0.4, fn(v, o) {
      const P = Math.pow(2, o.pitch / 12);
      for (const [dt, f] of [[0, 329.6], [0.11, 277.2]]) { // E4 then C#4, muted
        tone(v, dt, f * P, 'triangle', 0.24, 0.002, 0.11, 1100, f * P * 0.93);
        swish(v, dt, 0.03, 700, 500, 0.8, 0.08, 0.002);
      }
      v.send(0.05);
    } },
    shuffle: { prio: 0, len: 1.0, fn(v, o) {
      const c = v.ctx, list = [], N = 26;
      for (let j = 0; j < N; j++) list.push([(0.52 * j) / N + v.rng() * 0.004, 0.5 + v.rng() * 0.5, 0.004 + v.rng() * 0.003]);
      grains(v, 0, list, [filt(c, 'bandpass', 2000, 1.0), filt(c, 'lowpass', 4500, 0.7)], 0.45);
      grains(v, 0, list, [filt(c, 'lowpass', 900, 0.7)], 0.18);
      thump(v, 0.58, 150, 95, 0.12, 0.13);
      note(v, 'bead', 66 + o.pitch, 0.59, 0.08);
      v.send(0.08);
    } },
    discard: { prio: 0, len: 0.5, fn(v, o) {
      const P = Math.pow(2, o.pitch / 12);
      swish(v, 0, 0.26, 2200 * P, 600 * P, 1.1, 0.32, 0.015);
      swish(v, 0, 0.04, 3600, 3000, 0.9, 0.03, 0.004);
      thump(v, 0.21, 150 * P, 95 * P, 0.08, 0.09);
      v.send(0.08);
    } },
    flip: { prio: 0, len: 0.2, fn(v, o) {
      swish(v, 0, 0.05, 900, 3000, 2.2, 0.5, 0.006);
      note(v, 'bead', 84 + o.pitch, 0.03, 0.14);
      v.send(0.06);
    } },
  };

  // =============================================================== music
  /** Chords in D major: bass note, felt pad voicing (table), harp arpeggio tones (Shop). */
  const CH = {
    I: { b: 38, pad: [50, 57, 61, 64, 66], arp: [62, 66, 69, 73, 74, 78] },
    ii: { b: 40, pad: [52, 55, 59, 62, 66], arp: [59, 62, 64, 67, 71, 74] },
    iii: { b: 42, pad: [54, 57, 61, 64, 69], arp: [61, 64, 66, 69, 73, 76] },
    IV: { b: 43, pad: [55, 59, 62, 66, 69], arp: [62, 66, 67, 71, 74, 78] },
    V: { b: 45, pad: [57, 62, 64, 67, 71], arp: [61, 64, 66, 69, 73, 76] },
    vi: { b: 35, pad: [54, 57, 61, 62, 66], arp: [62, 66, 69, 71, 74, 78] },
    bVII: { b: 36, pad: [55, 59, 60, 64, 67], arp: [60, 64, 67, 71, 72, 76] },
  };
  const SONGS = {
    table: {
      bpm: 72, level: 1.4, hum: 0.05, pad: 0.11, first: 'breath',
      progs: [['I', 'vi', 'IV', 'I'], ['I', 'iii', 'IV', 'V'], ['vi', 'IV', 'I', 'V'], ['IV', 'I', 'ii', 'vi'], ['I', 'bVII', 'IV', 'I'], ['ii', 'V', 'I', 'I'], ['I', 'IV', 'vi', 'V'], ['IV', 'iii', 'ii', 'I']],
      profiles: [
        { id: 'breath', pad: 1.0, pulse: null, bass: 'root', mel: 0.1 },
        { id: 'pulse', pad: 0.85, pulse: [1, 1, 1, 1, 1, 1, 1, 1], bass: 'root5', mel: 0.15 },
        { id: 'sparkle', pad: 0.8, pulse: [0, 1, 0, 1, 0, 1, 0, 1], bass: 'root5', mel: 0.28 },
        { id: 'lilt', pad: 0.9, pulse: [1, 0, 1, 1, 0, 1, 1, 0], bass: 'pick', mel: 0.18 },
      ],
    },
    shop: {
      bpm: 80, level: 1.5, hum: 0.035, pad: 0.075, first: 'stroll',
      progs: [['IV', 'V', 'iii', 'vi'], ['ii', 'V', 'I', 'vi'], ['I', 'IV', 'I', 'V'], ['vi', 'ii', 'V', 'I'], ['I', 'vi', 'ii', 'V']],
      profiles: [
        { id: 'stroll', pad: 0.8, arp: 0, walk: true, bell: 0.3, mel: 0 },
        { id: 'lift', pad: 0.7, arp: 1, walk: true, bell: 0.4, mel: 0.06 },
        { id: 'soft', pad: 1.0, arp: 4, walk: false, bell: 0.2, mel: 0.05 },
        { id: 'turn', pad: 0.8, arp: 2, walk: true, bell: 0.25, mel: 0.03 },
      ],
    },
  };
  const ARPS = [[0, 2, 4, 2, 1, 3, 5, 3], [0, 1, 2, 3, 4, 3, 2, 1], [0, 2, 1, 3, 2, 4, 3, 5], [5, 4, 3, 2, 1, 2, 3, 4], [0, -1, 2, 4, -1, 3, 5, -1]];
  const pickOther = (rng, list, not) => {
    const pool = list.filter((x) => x !== not);
    return pool[Math.floor(rng() * pool.length) % pool.length];
  };

  function Song(g, variant, seed, offline) {
    const c = g.ctx, def = SONGS[variant];
    this.G = g; this.ctx = c; this.variant = variant; this.def = def; this.offline = !!offline;
    this.rng = mulberry32(seed);
    this.beat = 60 / def.bpm; this.stepDur = this.beat / 2; this.barDur = this.beat * 4;
    this.bus = gainNode(c, 0);
    this.bus.connect(g.mus);
    // a dotted-eighth echo for the melody, darker on every repeat
    this.echoIn = gainNode(c, 1);
    this.delay = c.createDelay(2);
    this.delay.delayTime.value = this.beat * 0.75;
    this.fbLp = filt(c, 'lowpass', 2300, 0.5);
    this.fb = gainNode(c, 0.32);
    this.echoOut = gainNode(c, 0.5);
    this.echoIn.connect(this.delay); this.delay.connect(this.fbLp); this.fbLp.connect(this.fb); this.fb.connect(this.delay);
    this.fbLp.connect(this.echoOut); this.echoOut.connect(this.bus);
    this.fixed = [this.bus, this.echoIn, this.delay, this.fbLp, this.fb, this.echoOut];
    this.srcs = new Set();
    this.step = 0; this.next = 0; this.bar = -1; this.prog = null; this.pos = 0; this.progN = 0;
    this.chord = CH.I; this.profile = def.profiles[0]; this.mdeg = 7;
    this.stopping = false; this.stopAt = Infinity;
  }
  Song.prototype.track = function (src, nodes, start, stop, offset) {
    const srcs = this.srcs;
    srcs.add(src);
    src.onended = () => { srcs.delete(src); for (const n of nodes) drop(n); };
    if (offset != null) src.start(start, offset); else src.start(start);
    if (stop !== Infinity) src.stop(stop);
  };
  Song.prototype.audible = function () { return this.offline || (!muted && !hidden && vol.music > 0); };
  Song.prototype.start = function (t, fade) {
    const c = this.ctx;
    this.next = t;
    const p = this.bus.gain;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(this.def.level, t + fade);
    // the candle hum: brown noise under 170 Hz with a slow, uneven flicker
    const src = c.createBufferSource();
    src.buffer = this.G.brown;
    src.loop = true;
    const lp = filt(c, 'lowpass', 170, 0.6), hum = gainNode(c, this.def.hum);
    src.connect(lp); lp.connect(hum); hum.connect(this.bus);
    this.track(src, [src, lp, hum], t, Infinity, this.rng() * 3);
    for (const [hz, depth] of [[0.23, 0.35], [1.37, 0.12]]) {
      const lfo = c.createOscillator(), d = gainNode(c, this.def.hum * depth);
      lfo.frequency.value = hz;
      lfo.connect(d); d.connect(hum.gain);
      this.track(lfo, [lfo, d], t, Infinity);
    }
  };
  /** Schedule every step that starts before `until`. Late steps (the timer stalled) only advance the clock. */
  Song.prototype.fill = function (until, now) {
    while (this.next < until) {
      const t = this.next;
      this.schedule(this.step, t, !(t >= now - 0.02 && this.audible()));
      this.step++;
      this.next += this.stepDur;
    }
  };
  Song.prototype.schedule = function (step, t, quiet) {
    const s = step % 8;
    if (s === 0) this.newBar(t, quiet);
    if (quiet) return;
    if (this.variant === 'shop') this.shopStep(s, t); else this.tableStep(s, t);
  };
  Song.prototype.newBar = function (t, quiet) {
    const def = this.def;
    if (!this.prog || this.pos >= this.prog.length) {
      if (this.progN % 2 === 0) {
        this.profile = this.progN === 0 ? def.profiles.find((x) => x.id === def.first) : pickOther(this.rng, def.profiles, this.profile);
      }
      this.progN++;
      this.prog = pickOther(this.rng, def.progs, this.prog);
      this.pos = 0;
    }
    this.chord = CH[this.prog[this.pos++]];
    this.bar++;
    if (!quiet) this.pad(t);
  };
  Song.prototype.pad = function (t) {
    const c = this.ctx, ch = this.chord, lvl = this.def.pad * (this.profile.pad || 1);
    const table = this.variant !== 'shop';
    const attack = table ? 1.3 : 0.6, rel = table ? 2.2 : 1.4, end = t + this.barDur;
    const lp = filt(c, 'lowpass', 620, 0.4);
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.linearRampToValueAtTime(table ? 1250 : 1600, t + this.barDur * 0.55);
    lp.frequency.linearRampToValueAtTime(700, end + rel);
    const g = gainNode(c, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(lvl, t + attack);
    g.gain.setValueAtTime(lvl, end);
    g.gain.linearRampToValueAtTime(0, end + rel);
    lp.connect(g); g.connect(this.bus);
    const per = 1 / (ch.pad.length * 2);
    let first = true;
    for (const m of ch.pad) {
      for (const det of [-7, 6]) {
        const o = c.createOscillator(), og = gainNode(c, per);
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = det + (this.rng() - 0.5) * 3;
        o.connect(og); og.connect(lp);
        this.track(o, first ? [o, og, lp, g] : [o, og], t, end + rel + 0.05);
        first = false;
      }
    }
  };
  Song.prototype.tableStep = function (s, t) {
    const c = this.ctx, P = this.profile, ch = this.chord, rng = this.rng, bus = this.bus;
    if (s === 0) playBank(c, bus, 'pluck', ch.b, t, 0.16, { lp: 700, cut: this.beat * 2.2 }, this);
    if (s === 4 && P.bass !== 'root') playBank(c, bus, 'pluck', ch.b + 7, t, 0.1, { lp: 700, cut: this.beat * 1.8 }, this);
    if (s === 7 && P.bass === 'pick' && rng() < 0.5) playBank(c, bus, 'pluck', ch.b + 12, t, 0.06, { lp: 900, cut: this.beat * 0.8 }, this);
    if (P.pulse && P.pulse[s]) {
      const m = ch.pad[s % 2 ? 3 : 1], vel = (s % 4 === 0 ? 1.25 : 1) * (0.9 + rng() * 0.2);
      playBank(c, bus, 'mallet', m, t + rng() * 0.006, 0.05 * vel, { lp: 2400 }, this);
    }
    if (rng() < P.mel * (s === 0 || s === 4 ? 1.4 : s % 2 ? 0.7 : 1)) this.melody(t);
  };
  Song.prototype.shopStep = function (s, t) {
    const c = this.ctx, P = this.profile, ch = this.chord, rng = this.rng, bus = this.bus;
    if (s % 2 === 0) {
      const q = s / 2;
      const iv = P.walk ? (this.bar % 2 ? [0, 5, 7, 9] : [0, 7, 12, 7])[q] : q === 0 ? 0 : q === 2 ? 7 : null;
      if (iv != null) playBank(c, bus, 'pluck', ch.b + iv, t, (q === 0 ? 0.15 : 0.11) * (0.9 + rng() * 0.15), { lp: 900, cut: this.beat * 0.95 }, this);
    }
    const ix = ARPS[P.arp % ARPS.length][s];
    if (ix >= 0) {
      playBank(c, bus, 'pluck', ch.arp[ix], t + rng() * 0.01, 0.07 * (s === 0 ? 1.25 : 1) * (0.85 + rng() * 0.25),
        { lp: 4200, pan: (ix / 5 - 0.5) * 0.5, cut: this.beat * 1.6 }, this);
    }
    if (s === 0 && rng() < P.bell) {
      let m = ch.arp[4];
      while (m < 79) m += 12;
      while (m > 88) m -= 12;
      playBank(c, bus, 'bell', m, t + 0.02, 0.035, { pan: 0.15 }, this);
    }
    if (P.mel && rng() < P.mel) this.melody(t);
  };
  /** A slow random walk on the pentatonic (D5 to F#6), leaning on the chord's tones, into the echo. */
  Song.prototype.melody = function (t) {
    const rng = this.rng, moves = [-2, -1, -1, 1, 1, 2, 0];
    this.mdeg = clamp(this.mdeg + moves[Math.floor(rng() * moves.length) % moves.length], 5, 12);
    let m = deg(this.mdeg);
    const pcs = this.chord.pad.map((x) => x % 12);
    if (pcs.indexOf(m % 12) < 0 && rng() < 0.6) {
      const alt = deg(this.mdeg + (rng() < 0.5 ? -1 : 1));
      if (pcs.indexOf(alt % 12) >= 0) m = alt;
    }
    playBank(this.ctx, this.bus, 'kalimba', m, t + rng() * 0.012, 0.06 * (0.75 + rng() * 0.3),
      { pan: (rng() - 0.5) * 0.6, also: this.echoIn, alsoGain: 0.6 }, this);
  };
  Song.prototype.fadeOut = function (now, dur) {
    if (this.stopping) return;
    this.stopping = true;
    const p = this.bus.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(num(p.value, this.def.level), now);
    p.linearRampToValueAtTime(0, now + dur);
    this.stopAt = now + dur + 0.05;
  };
  Song.prototype.kill = function () {
    for (const src of Array.from(this.srcs)) { try { src.stop(); } catch (e) { /* not started or already stopped */ } }
    this.srcs.clear();
    for (const n of this.fixed) drop(n);
  };

  // =============================================================== state
  let ctx = null;
  let G = null;
  let armed = false;
  let hidden = false;
  let pausedByUs = false;
  let visListening = false;
  let suspendT = null;
  let timer = null;
  let limbo = []; //               voices scheduled in a gesture before the context had started
  let limboUntil = 0;
  let songSeed = (Date.now() ^ 0x5eed) >>> 0;
  let muted = (() => { try { return typeof location !== 'undefined' && /[?&]test=1(&|$)/.test(location.search || ''); } catch (e) { return false; } })();
  const vol = { sfx: 0.6, music: 0.4 };
  const want = { on: false, variant: 'table' };
  const songs = [];
  const ends = []; //               end times of live sound-effect voices
  const lastPlayed = Object.create(null);

  function report(err) { if (API.debug) throw err; }
  function resolveName(name) {
    if (typeof name !== 'string') return null;
    const n = name.trim().toLowerCase();
    if (SFX[n]) return n;
    return ALIASES[n] || null;
  }
  function normOpts(o) {
    o = o && typeof o === 'object' ? o : {};
    const idx = o.index != null ? o.index : o.step;
    return {
      index: clamp(Math.floor(num(Number(idx), 0)), 0, 999),
      intensity: clamp(num(Number(o.intensity), 0.5), 0, 1),
      pitch: clamp(num(Number(o.pitch), 0), -24, 24),
      pan: clamp(num(Number(o.pan), 0), -1, 1),
      delay: clamp(num(Number(o.delay), 0), 0, 10000) / 1000,
    };
  }

  // =============================================================== context life
  function create(C) {
    try { ctx = new C({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new C(); } catch (e2) { ctx = null; return; } }
    G = buildGraph(ctx, { sfx: vol.sfx, music: vol.music, muted: muted || hidden });
    const c = ctx;
    ctx.onstatechange = () => {
      try {
        if (c !== ctx) return;
        if (c.state === 'running') onRunning();
        else if (!pausedByUs && c.state !== 'closed') arm(); // suspended or interrupted by the browser: the next gesture resumes it
      } catch (err) { report(err); }
    };
    listenVisibility();
    warmBank(c);
  }
  function onRunning() {
    disarm();
    if (limbo.length) {
      if (nowMs() > limboUntil) for (const v of limbo) drop(v.out); // the context started late: those sounds are stale
      limbo = [];
    }
    applyMaster(0.02);
    applyMusic();
    if (muted || hidden) rest(450); // started while muted (a saved setting) or hidden: it rests again
  }
  function init() {
    const C = AC();
    if (!C) return false;
    if (!ctx) {
      const ua = typeof navigator !== 'undefined' && navigator ? navigator.userActivation : null;
      if (ua && !ua.hasBeenActive && !ua.isActive) { arm(); return false; } // no gesture yet: wait for one
      create(C);
      if (!ctx) return false;
    }
    if (ctx.state !== 'running' && !pausedByUs) { swallow(ctx.resume && ctx.resume()); if (ctx.state !== 'running') arm(); }
    if (ctx.state === 'running') onRunning();
    return true;
  }
  const GESTURES = ['pointerdown', 'pointerup', 'mousedown', 'touchend', 'keydown', 'click'];
  function onGesture() {
    try {
      const C = AC();
      if (!C) return;
      if (!ctx) create(C);
      if (ctx && ctx.state !== 'running' && !pausedByUs) swallow(ctx.resume && ctx.resume());
      if (ctx && ctx.state === 'running') onRunning();
    } catch (err) { /* a gesture never fails because of sound */ }
  }
  function arm() {
    if (armed || !hasDoc()) return;
    armed = true;
    for (const e of GESTURES) document.addEventListener(e, onGesture, true);
  }
  function disarm() {
    if (!armed || !hasDoc()) return;
    armed = false;
    for (const e of GESTURES) document.removeEventListener(e, onGesture, true);
  }
  function listenVisibility() {
    if (visListening || !hasDoc()) return;
    visListening = true;
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
  }
  function onVisibility() {
    try {
      hidden = document.visibilityState === 'hidden';
      if (!ctx) return;
      applyMaster(hidden ? 0.08 : 0.04);
      rest(450);
    } catch (err) { report(err); }
  }
  /** Hidden or muted, nothing can be heard: after at least `ms`, and once the sound effects still playing have rung
      out (so none is frozen halfway), the context is suspended and the music's scheduler stops, so a silent game
      costs nothing. Heard again, the context resumes and the music carries on where it was (a change of loop asked
      for meanwhile is made then). */
  function rest(ms) {
    cancel(suspendT);
    suspendT = null;
    if (!ctx) return;
    if (muted || hidden) {
      suspendT = later(() => {
        suspendT = null;
        if ((muted || hidden) && ctx && ctx.state === 'running') { pausedByUs = true; cancel(timer); timer = null; swallow(ctx.suspend && ctx.suspend()); }
      }, Math.max(ms, ringOutMs()));
    } else if (pausedByUs) {
      pausedByUs = false;
      swallow(ctx.resume && ctx.resume());
      applyMusic();
    }
  }
  /** Milliseconds until the last sound effect still playing has ended. */
  function ringOutMs() {
    if (!ctx) return 0;
    let end = 0;
    for (const e of ends) if (e > end) end = e;
    return Math.min(6000, Math.max(0, (end - ctx.currentTime) * 1000 + 60));
  }
  function applyMaster(tc) {
    if (!G) return;
    const p = G.master.gain, now = ctx.currentTime, target = muted || hidden ? 0 : 1;
    p.cancelScheduledValues(now);
    p.setValueAtTime(num(p.value, target), now);
    p.setTargetAtTime(target, now, tc || 0.03);
  }
  function rampVol() {
    if (!G) return;
    const now = ctx.currentTime;
    for (const [node, v] of [[G.sfx, vol.sfx], [G.sfxWet, vol.sfx], [G.mus, vol.music]]) {
      const p = node.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(num(p.value, curve(v)), now);
      p.setTargetAtTime(curve(v), now, 0.03);
    }
  }

  // =============================================================== public: sound effects
  function sfx(name, opts) {
    const key = resolveName(name);
    if (!key || !ctx || !G || muted || hidden || vol.sfx <= 0) return false;
    let inLimbo = false;
    if (ctx.state !== 'running') {
      const ua = typeof navigator !== 'undefined' && navigator ? navigator.userActivation : null;
      if (pausedByUs || (ua && !ua.isActive)) return false; // not in a gesture: the sound would arrive late
      swallow(ctx.resume && ctx.resume());
      inLimbo = true;
    }
    const o = normOpts(opts);
    const v = playSfx(G, key, o, ctx.currentTime + LEAD + o.delay, false);
    if (!v) return false;
    if (inLimbo) { limbo.push(v); limboUntil = nowMs() + 400; }
    return true;
  }
  function playSfx(g, key, o, t, offline) {
    const def = SFX[key];
    if (!offline) {
      const now = g.ctx.currentTime;
      for (let i = ends.length - 1; i >= 0; i--) if (ends[i] <= now) ends.splice(i, 1);
      if (ends.length >= VOICE_CAP && def.prio < 2) return null;
      if (ends.length >= VOICE_CAP * 0.75 && def.prio === 0) return null;
      const last = lastPlayed[key];
      if (last && last.index === o.index && Math.abs(t - last.t) < 0.012) return null; // the same call twice
      lastPlayed[key] = { t, index: o.index };
    }
    const v = makeVoice(g, t, o);
    def.fn(v, o);
    seal(v);
    if (!offline) ends.push(v.end);
    return v;
  }

  // =============================================================== public: music
  function music(on, variant) {
    let wantOn = on, v = variant;
    if (typeof on === 'string') {
      const s = on.toLowerCase();
      if (s === 'off' || s === 'stop' || s === 'none') wantOn = false;
      else { wantOn = true; v = s; }
    }
    wantOn = !!wantOn;
    if (typeof v === 'string' && SONGS[v.toLowerCase()]) want.variant = v.toLowerCase();
    else if (wantOn && !songs.some((s) => !s.stopping)) want.variant = want.variant || 'table';
    want.on = wantOn;
    applyMusic();
    return true;
  }
  function applyMusic() {
    if (!G || !ctx || pausedByUs) return; // resting: the wish is kept in `want` and made when the sound wakes
    const now = ctx.currentTime;
    const live = songs.filter((s) => !s.stopping);
    if (!want.on) {
      for (const s of live) s.fadeOut(now, 1.6);
    } else {
      let cur = null;
      for (const s of live) { if (!cur && s.variant === want.variant) cur = s; else s.fadeOut(now, 1.4); }
      if (!cur) {
        songSeed = (Math.imul(songSeed, 1664525) + 1013904223) >>> 0;
        const s = new Song(G, want.variant, songSeed, false);
        s.start(now + 0.08, live.length ? 2.2 : 3.0);
        songs.push(s);
      }
    }
    ensureTimer();
  }
  function ensureTimer() {
    if (timer == null && songs.length && G && !pausedByUs) timer = later(tick, 0);
  }
  function tick() {
    timer = null;
    try {
      if (!G || !ctx) return;
      const now = ctx.currentTime;
      for (let i = songs.length - 1; i >= 0; i--) {
        const s = songs[i];
        if (s.stopping && now >= s.stopAt) { s.kill(); songs.splice(i, 1); }
      }
      for (const s of songs) if (!s.stopping) s.fill(now + AHEAD, now);
    } catch (err) { report(err); }
    if (songs.length && !pausedByUs) timer = later(tick, TICK_MS);
  }

  // =============================================================== public: mix
  function setVolume(kind, v) {
    if ((typeof kind === 'number' || (typeof kind === 'string' && kind.trim() !== '' && !Number.isNaN(Number(kind)))) && v === undefined) {
      v = Number(kind);
      kind = 'sfx';
    }
    let x = Number(v);
    if (!Number.isFinite(x)) return false;
    if (x > 1) x /= 100; // 0..100 from a slider
    x = clamp(x, 0, 1);
    const k = typeof kind === 'string' ? kind.toLowerCase() : '';
    if (k === 'sfx' || k === 'effects' || k === 'sound') vol.sfx = x;
    else if (k === 'music') vol.music = x;
    else return false;
    rampVol();
    return true;
  }
  function setMuted(m) {
    muted = !!m;
    applyMaster(0.03);
    rest(450); // muted: the context rests once the sounds playing have rung out; unmuted: it wakes where it was
    return true;
  }
  function state() {
    const now = ctx ? ctx.currentTime : 0;
    return {
      supported: !!AC(),
      ready: !!G,
      running: !!(ctx && ctx.state === 'running'),
      context: ctx ? ctx.state : 'none',
      muted,
      hidden,
      volume: { sfx: vol.sfx, music: vol.music },
      music: {
        on: want.on,
        variant: want.variant,
        playing: songs.some((s) => !s.stopping),
        songs: songs.length,
        scheduler: timer != null,
        bar: songs.length ? songs[songs.length - 1].bar : -1,
        section: songs.length && songs[songs.length - 1].profile ? songs[songs.length - 1].profile.id : null,
      },
      voices: ends.filter((e) => e > now).length,
      bank: bankCache.size,
      bankMs: Math.round(bankStats.ms),
      bankMaxMs: Math.round(bankStats.max * 10) / 10,
      names: NAMES.slice(),
    };
  }

  // =============================================================== offline renders (the bench and the checks)
  function offline(seconds, cfg) {
    const O = OAC();
    if (!O) return null;
    const sr = num(cfg.sampleRate, 48000);
    const c = new O(2, Math.ceil(sr * seconds), sr);
    return { c, g: buildGraph(c, { sfx: num(cfg.volume, 1), music: num(cfg.musicVolume, 1), muted: false }) };
  }
  function rendered(c) {
    const p = c.startRendering();
    if (p && typeof p.then === 'function') return p;
    return new Promise((res) => { c.oncomplete = (e) => res(e.renderedBuffer); });
  }
  /** Render one sound (cfg: { volume = 1, sampleRate = 48000, seconds }) into an AudioBuffer. */
  function render(name, opts, cfg) {
    cfg = cfg || {};
    const key = resolveName(name);
    if (!key) return Promise.resolve(null);
    const o = normOpts(opts);
    const r = offline(num(cfg.seconds, PRE_ROLL + SFX[key].len + o.delay + 1.9), cfg);
    if (!r) return Promise.resolve(null);
    playSfx(r.g, key, o, PRE_ROLL + o.delay, true);
    return rendered(r.c);
  }
  /** Render several sounds into one buffer: [[name, opts, delayMs], ...]. */
  function renderStack(list, cfg) {
    cfg = cfg || {};
    const items = (Array.isArray(list) ? list : []).map((x) => [resolveName(x && x[0]), normOpts(x && x[1]), clamp(num(Number(x && x[2]), 0), 0, 20000) / 1000]).filter((x) => x[0]);
    if (!items.length) return Promise.resolve(null);
    const len = PRE_ROLL + Math.max(...items.map(([k, o, d]) => SFX[k].len + o.delay + d)) + 1.9;
    const r = offline(num(cfg.seconds, len), cfg);
    if (!r) return Promise.resolve(null);
    for (const [k, o, d] of items) playSfx(r.g, k, o, PRE_ROLL + d + o.delay, true);
    return rendered(r.c);
  }
  /** Render `seconds` of a music variant from its first bar. */
  function renderMusic(variant, seconds, cfg) {
    cfg = cfg || {};
    const v = typeof variant === 'string' && SONGS[variant] ? variant : 'table';
    const secs = clamp(num(seconds, 20), 1, 600);
    const r = offline(PRE_ROLL + secs, cfg);
    if (!r) return Promise.resolve(null);
    const s = new Song(r.g, v, num(cfg.seed, 1234) >>> 0, true);
    s.start(PRE_ROLL, num(cfg.fade, 2.5));
    s.fill(PRE_ROLL + secs, 0);
    return rendered(r.c);
  }
  /** Peak, RMS over the sounding part, length to -60 dBFS, DC and the largest sample step (a click detector). */
  function measure(buf) {
    if (!buf || !buf.getChannelData) return null;
    const n = buf.length, sr = buf.sampleRate, thr = 0.001;
    let peak = 0, sum = 0, cnt = 0, dc = 0, step = 0, first = n, last = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const a = Math.abs(d[i]);
        if (a > peak) peak = a;
        if (a > thr) { if (i < first) first = i; if (i > last) last = i; }
      }
    }
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      let prev = 0;
      for (let i = 0; i < n; i++) {
        const x = d[i];
        dc += x;
        const j = Math.abs(x - prev);
        if (j > step) step = j;
        prev = x;
        if (i >= first && i <= last) { sum += x * x; cnt++; }
      }
    }
    const db = (x) => (x > 0 ? Math.round(2000 * Math.log10(x)) / 100 : -999);
    const rms = cnt ? Math.sqrt(sum / cnt) : 0;
    return {
      peak, peakDb: db(peak), rms, rmsDb: db(rms), seconds: n / sr,
      start: first < n ? first / sr : 0, end: last / sr, dc: dc / (n * buf.numberOfChannels), maxStep: step, silent: peak < 1e-4,
    };
  }

  // =============================================================== export
  function guard(fn, fallback) {
    return function () {
      try { return fn.apply(null, arguments); } catch (err) {
        if (API.debug) throw err;
        return typeof fallback === 'function' ? fallback() : fallback;
      }
    };
  }
  const API = {
    __wick: true,
    version: 1,
    NAMES,
    ALIASES,
    /** true: internal errors are thrown instead of swallowed (tests and development). */
    debug: false,
    init: guard(init, false),
    sfx: guard(sfx, false),
    play: guard((name, opts) => sfx(name, opts), false),
    music: guard(music, false),
    setVolume: guard(setVolume, false),
    setMusicVolume: guard((v) => setVolume('music', v), false),
    setMuted: guard(setMuted, false),
    state: guard(state, () => ({ supported: false, ready: false, running: false, context: 'none', muted, hidden: false, volume: { sfx: vol.sfx, music: vol.music }, music: { on: want.on, variant: want.variant, playing: false, songs: 0, scheduler: false, bar: -1, section: null }, voices: 0, bank: 0, names: NAMES.slice() })),
    /** The MIDI note a scoring step plays at this index (A4 = 69 up to D6 = 86). */
    ladder: guard((i) => ladder(num(Number(i), 0)), 69),
    render: guard(render, () => Promise.resolve(null)),
    renderStack: guard(renderStack, () => Promise.resolve(null)),
    renderMusic: guard(renderMusic, () => Promise.resolve(null)),
    measure: guard(measure, null),
  };
  TW.Audio = API;
})();
