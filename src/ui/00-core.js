/* Wickwager UI core (TW.UI): boot, the screen router, storage and settings, motion, the pixel painter for
   chrome and numbers, sprites with placeholders, dialogs, sheets, tooltips, toasts, the live region, the
   keyboard, audio glue, the engine wrapper and the test hooks. ARCH.md section 5; SPEC.md sections 5 and 6.

   Screens register themselves and later files override earlier ones:
     TW.UI.register(name, { mount(root, props), unmount(nextName), update(), key(e) -> true when handled, shell })
     TW.UI.show(name, props)          unmounts the current screen and mounts `name` (shell screens keep the table)
     TW.UI.refresh()                  shows the screen for run.phase, or updates the current one
   Engine calls go through one wrapper:
     TW.UI.call(name, ...args)        engine action on the current run: error toast, save, records; no render
     TW.UI.act(name, ...args)         the same, then refresh()
   Motion: TW.UI.dur(ms), TW.UI.anim(node, keyframes, opts), TW.UI.EASE, TW.UI.GAME_SPEED (getter).
   Look: TW.UI.sprite(id, opts) / spriteHTML(id, opts), TW.UI.num(text, size, style), TW.UI.numHTML(...).
   Overlays: TW.UI.dialog(opts), TW.UI.sheet(opts), TW.UI.closeDialog(h), TW.UI.registerOverlay(name, fn),
             TW.UI.openOverlay(name, props), TW.UI.toast(text, kind), TW.UI.announce(text), TW.UI.tipHTML(o).
   The stub screens at the end of this file (title, shop, pack, gameover, win) and the stub overlays
   (options, run-info (Overview), pause, deck) are placeholders: 20-shop.js and 30-screens.js replace them. */
(() => {
  'use strict';
  const TW = (globalThis.TW = globalThis.TW || {});
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // ================================================================== environment
  const params = (() => { try { return new URLSearchParams(window.location.search || ''); } catch (err) { return new URLSearchParams(''); } })();
  const cleanSeed = (s) => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  const TEST = params.get('test') === '1';
  const URL_SEED = cleanSeed(params.get('seed')) || null;
  const URL_SPEED = Number(params.get('speed')) > 0 ? Number(params.get('speed')) : null;
  const URL_SCREEN = String(params.get('screen') || '').toLowerCase();
  const PREFIX = TEST ? 'test:' : '';
  const root = document.documentElement;
  const mq = (q) => { try { return window.matchMedia(q); } catch (err) { return { matches: false, addEventListener() {} }; } };
  // Two layouts and two pixel sizes (SPEC 6.7; tokens in 10-tokens.css, kept in step with these queries):
  //   phone   the compact layout (the column becomes a top bar, sheets rise from the bottom): below 1024 px wide,
  //           phones, tablets and landscape phones alike;
  //   px2     the art pixel is 2 CSS px: the compact layout, and the table layout on a window under 870 px tall
  //           (a laptop's browser), where 3 CSS px would push the hand and its buttons below the fold.
  const MQ = {
    reduce: mq('(prefers-reduced-motion: reduce)'),
    phone: mq('(max-width: 1023px)'),
    px2: mq('(max-width: 1023px), (max-height: 869px)'),
    fine: mq('(hover: hover) and (pointer: fine)'),
  };
  MQ.compact = MQ.phone;
  const PX = () => (MQ.px2.matches ? 2 : 3);
  /** fn() after either breakpoint changes (the layout or the pixel size); one call per change. */
  const onBreakpoint = (fn) => { [MQ.phone, MQ.px2].forEach((m) => { if (m && m.addEventListener) m.addEventListener('change', fn); }); };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ================================================================== small helpers
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style') node.setAttribute('style', v);
        else if (k === 'hidden' || k === 'disabled') node[k] = !!v;
        else node.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return node;
  }
  /** Whole numbers with thousands separators; past a trillion, a short exponent (the digit face has an 'e'). */
  function fmt(n) {
    const v = Number(n) || 0;
    if (Math.abs(v) >= 1e12) return v.toExponential(2).replace('+', '');
    return Math.floor(v).toLocaleString('en-US');
  }
  /** Mult and other small decimals: at most 2 decimals, trailing zeros trimmed. */
  function fmtMult(m) {
    const v = Math.round((Number(m) || 0) * 100) / 100;
    if (Math.abs(v) >= 1e12) return fmt(v);
    const parts = v.toFixed(2).replace(/\.?0+$/, '').split('.');
    parts[0] = Number(parts[0]).toLocaleString('en-US');
    return parts.join('.');
  }
  const cash = (n) => '$' + fmt(n);
  const plural = (n, one, many) => (n === 1 ? one : many || one + 's');
  const titleCase = (id) => String(id || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  function listJoin(items) {
    const a = items.filter(Boolean);
    if (a.length <= 1) return a.join('');
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }
  /** Content text with coloured keywords: Chips blue, Mult red, xMult hot red, money yellow. */
  const RICH = /(×\s?\d+(?:\.\d+)?(?:\s?Mult)?)|([+\-−]?\d+(?:\.\d+)?\s?Chips)|([+\-−]?\d+(?:\.\d+)?\s?Mult)|([+\-−]?\$\d+(?:\.\d+)?)|(\bChips\b)|(\bMult\b)/g;
  function richText(s) {
    return esc(s).replace(RICH, (m, x, c, mu, d, cw) => {
      const k = x ? 'k-xmult' : c || cw ? 'k-chips' : mu ? 'k-mult' : d ? 'k-money' : 'k-mult';
      return `<span class="${k}">${m}</span>`;
    });
  }
  const later = (ms, fn) => setTimeout(fn, ms);
  /** A seeded random stream for decoration only (FNV-1a into mulberry32); the rules never use it. */
  function rng(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    let s = h >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ================================================================== storage (every call in try/catch; memory fallback)
  const KEYS = { settings: 'ember:settings', run: 'ember:run', records: 'ember:records' };
  const memory = new Map();
  // keys whose last write did not reach localStorage (it is full, or there is none): the in-memory copy is newer
  // than anything stored, so every read takes it until a write gets through again (Continue never brings back
  // an older save that happened to fit)
  const unsaved = new Set();
  // of those, the keys a full storage turned away (the others: no storage at all, or one that throws)
  const fullKeys = new Set();
  // fullSaid: the one warning that storage is full is on its way; fullNoted: Save and quit has said so in its own words
  let fullSaid = false, fullNoted = false;
  const quotaError = (err) => !!err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014);
  const store = {
    key: (name) => PREFIX + (KEYS[name] || name),
    get(name) {
      const key = store.key(name);
      if (unsaved.has(key)) return memory.has(key) ? memory.get(key) : null;
      try { const v = window.localStorage.getItem(key); if (v != null) return v; } catch (err) { /* storage unavailable */ }
      return memory.has(key) ? memory.get(key) : null;
    },
    set(name, value) {
      const key = store.key(name);
      memory.set(key, value);
      try { window.localStorage.setItem(key, value); unsaved.delete(key); fullKeys.delete(key); } catch (err) {
        // the in-memory copy keeps the session going; a full storage is said once, since what is played from
        // here on is gone when the page closes
        unsaved.add(key);
        if (quotaError(err)) fullKeys.add(key); else fullKeys.delete(key);
        if (!fullSaid && quotaError(err)) { fullSaid = true; later(0, () => { if (!fullNoted) toast("Your browser's storage is full, so the game can't save. This run lasts until you close the page.", 'err', 6000); }); }
      }
    },
    remove(name) {
      const key = store.key(name);
      memory.delete(key);
      unsaved.delete(key);
      fullKeys.delete(key);
      try { window.localStorage.removeItem(key); } catch (err) { /* nothing stored */ }
    },
    /** The keys whose newest value lives only in memory (their last write failed). */
    unsaved: () => [...unsaved],
  };
  /** What Save and quit says once it has saved, { text, saved }: the run is stored, or, when its last write failed,
      that it lasts only until the page closes, never "Run saved" (final pass, part 3: a full storage was told "Run
      saved" right after the toast that said the game can't save, and the run was gone after a reload). */
  function saveQuitNote() {
    const key = store.key('run');
    if (!unsaved.has(key)) return { saved: true, text: 'Run saved. Continue it from the title screen.' };
    if (fullKeys.has(key)) fullNoted = true;
    return { saved: false, text: `${fullKeys.has(key) ? "Your browser's storage is full, so the run could not be saved" : 'The run could not be saved in this browser'}. It lasts until you close the page: continue it from the title screen.` };
  }

  // ================================================================== settings (SPEC 6.6)
  // keys: the table's one-key shortcuts (1 to 9, Enter, D, S and I; SPEC 6.4), on by default; Options switches them off
  // (WCAG 2.1.4: a speech user's stray "d" must never spend a discard)
  const DEFAULT_SETTINGS = { speed: 2, sfx: 60, music: 40, shake: true, motion: 'auto', fourColor: false, muted: false, keys: true };
  // Lit's authored timeline is the Relaxed pace; Normal plays it 1.6 times as fast.
  const SPEEDS = [
    { value: 1, name: 'Relaxed', div: 1 },
    { value: 2, name: 'Normal', div: 1.6 },
    { value: 3, name: 'Fast', div: 2.6 },
    { value: 4, name: 'Blazing', div: 4.5 },
  ];
  /** Valid fields of raw over base (the defaults, or the current settings when one setting changes). */
  function normalizeSettings(raw, base = DEFAULT_SETTINGS) {
    const s = Object.assign({}, base);
    if (!raw || typeof raw !== 'object') return s;
    const sp = Number(raw.speed);
    if (SPEEDS.some((x) => x.value === sp)) s.speed = sp;
    const fx = Number(raw.sfx);
    if (raw.sfx != null && Number.isFinite(fx)) s.sfx = clamp(Math.round(fx), 0, 100);
    const mu = Number(raw.music);
    if (raw.music != null && Number.isFinite(mu)) s.music = clamp(Math.round(mu), 0, 100);
    if (typeof raw.shake === 'boolean') s.shake = raw.shake;
    if (['auto', 'reduced', 'full'].includes(raw.motion)) s.motion = raw.motion;
    if (typeof raw.fourColor === 'boolean') s.fourColor = raw.fourColor;
    if (typeof raw.muted === 'boolean') s.muted = raw.muted;
    if (typeof raw.keys === 'boolean') s.keys = raw.keys;
    return s;
  }
  /** The table's one-key shortcuts are on (Options: Keyboard shortcuts). */
  const shortcuts = () => settings.keys !== false;
  function loadSettings() {
    const raw = store.get('settings');
    if (!raw) return normalizeSettings(null);
    try { return normalizeSettings(JSON.parse(raw)); } catch (err) { return normalizeSettings(null); }
  }
  let settings = loadSettings();
  const settingsListeners = new Set();
  function setSetting(key, value) {
    const wasReduced = reduced();
    settings = normalizeSettings({ [key]: value }, settings);
    store.set('settings', JSON.stringify(settings));
    applySettings();
    if (!wasReduced && reduced()) settleMotion();
    if (key === 'music' || key === 'muted') syncMusic();
    if (key === 'fourColor') fourColorChanged();
    settingsListeners.forEach((fn) => { try { fn(settings, key); } catch (err) { console.warn('Wickwager: settings listener failed', err); } });
    return settings;
  }
  /** Reduced motion switched on mid-flourish (the title's ignition, an entrance): every scripted animation still
      running lands at its end at once, so nothing keeps moving after the switch. CSS loops follow the class. */
  function settleMotion() {
    try {
      (document.getAnimations ? document.getAnimations() : []).forEach((a) => {
        if ((typeof CSSAnimation === 'function' && a instanceof CSSAnimation) || (typeof CSSTransition === 'function' && a instanceof CSSTransition)) return;
        const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
        if (!t || t.iterations === Infinity || a.playState !== 'running') return;
        try { a.finish(); } catch (err) { /* an animation that cannot finish is left to end */ }
      });
    } catch (err) { /* nothing to settle */ }
  }
  /** Colour-coded suits changed: the cards on screen are drawn again in their new inks (and those inks warmed). */
  function fourColorChanged() {
    warmArt(settings.fourColor ? 'card4:' : 'card:');
    const scr = state.screen;
    try {
      if (scr === 'play' || scr === 'pack') update();
      else if (scr === 'cashout' && UI.table && typeof UI.table.renderHand === 'function') UI.table.renderHand();
    } catch (err) { console.warn('Wickwager: redraw for colour-coded suits failed', err); }
  }

  // ================================================================== motion
  /** The divisor every gameplay duration goes through: the speed setting, or ?speed=N. */
  const gameSpeed = () => URL_SPEED || (SPEEDS.find((x) => x.value === settings.speed) || SPEEDS[1]).div;
  const reduced = () => settings.motion === 'reduced' || (settings.motion !== 'full' && MQ.reduce.matches);
  const motionOK = () => !TEST && !reduced();
  const shakeOK = () => motionOK() && settings.shake;
  /** A gameplay duration at the current speed; 0 in test mode. */
  const dur = (ms) => (TEST ? 0 : Math.max(0, Number(ms) || 0) / gameSpeed());

  /** A damped spring sampled into a CSS linear() curve; it settles to 0.1 % at its end, so the duration is the settle time. */
  function springCurve(zeta, n = 56) {
    const wn = -Math.log(0.001) / zeta, wd = wn * Math.sqrt(1 - zeta * zeta);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = 1 - Math.exp(-zeta * wn * t) * (Math.cos(wd * t) + ((zeta * wn) / wd) * Math.sin(wd * t));
      pts.push(+x.toFixed(4));
    }
    pts[n] = 1;
    return `linear(${pts.join(', ')})`;
  }
  const LINEAR_OK = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 0.5, 1)');
  // the cubic-bézier nearest each spring, for a browser without linear(): the same three stand in 10-tokens.css until
  // applySettings writes these curves there, so the CSS transitions and the Web Animations share one curve either way
  // (final pass, part 4, P5: the two files had kept two different sets; each pick is the closer of the two to its spring)
  const EASE_FALLBACK = { spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)', soft: 'cubic-bezier(0.22, 1, 0.36, 1)', bouncy: 'cubic-bezier(0.34, 1.7, 0.64, 1)' };
  const EASE = {
    out: 'cubic-bezier(0.23, 1, 0.32, 1)',
    inOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
    hit: 'cubic-bezier(0.55, 0, 1, 0.45)',
    fall: 'cubic-bezier(0.5, 0, 0.9, 0.6)',
    spring: LINEAR_OK ? springCurve(0.62) : EASE_FALLBACK.spring,
    soft: LINEAR_OK ? springCurve(0.86) : EASE_FALLBACK.soft,
    bouncy: LINEAR_OK ? springCurve(0.42, 72) : EASE_FALLBACK.bouncy,
  };
  function applySettings() {
    root.classList.toggle('reduce-motion', reduced());
    root.classList.toggle('four-color', !!settings.fourColor);
    root.classList.toggle('no-shake', !settings.shake);
    const gs = gameSpeed();
    root.style.setProperty('--speed', String(gs));
    [['--t-press', 110], ['--t-fast', 160], ['--t-base', 240], ['--t-lift', 460], ['--t-follow', 1400]].forEach(([k, v]) => root.style.setProperty(k, (TEST ? 0 : Math.round(v / gs)) + 'ms'));
    // EASE is the one source of the springs: the CSS variables always take its curves (linear(), or EASE_FALLBACK)
    root.style.setProperty('--spring', EASE.spring);
    root.style.setProperty('--spring-soft', EASE.soft);
    root.style.setProperty('--spring-bouncy', EASE.bouncy);
    applyAudio();
  }
  function opacityOnly(kf) {
    if (!kf.some((k) => 'opacity' in k)) return null;
    return kf.map((k) => { const o = {}; if ('opacity' in k) o.opacity = k.opacity; if ('offset' in k) o.offset = k.offset; return o; });
  }
  /** One Web Animation at game speed. Reduced motion keeps only its opacity (unless o.always); test mode runs nothing.
      o: { d, delay, e (easing), fill, add (composite add), pseudo, raw (skip the game speed), always, iter } */
  function anim(node, kf, o = {}) {
    if (!node || typeof node.animate !== 'function' || TEST) return null;
    let frames = kf;
    if (reduced() && !o.always) { frames = opacityOnly(kf); if (!frames) return null; }
    const d = o.raw ? (o.d || 200) : dur(o.d || 200);
    if (!(d > 0)) return null;
    try {
      return node.animate(frames, {
        duration: d, delay: o.raw ? (o.delay || 0) : dur(o.delay || 0), easing: o.e || EASE.out, fill: o.fill || 'none',
        composite: o.add ? 'add' : 'replace', pseudoElement: o.pseudo, iterations: o.iter || 1,
      });
    } catch (err) { return null; }
  }
  /** Run fn once the browser has laid out what was just built (a ResizeObserver delivers after layout and before
      paint), so a beat that measures where things landed does not force a second, synchronous layout inside the
      task that built them. Test mode, and a node that never lays out, run it at once or shortly after. */
  function afterLayout(node, fn) {
    if (TEST || typeof ResizeObserver !== 'function' || !node || !node.isConnected) { fn(); return; }
    let done = false;
    const go = () => { if (done) return; done = true; ro.disconnect(); clearTimeout(guard); try { fn(); } catch (err) { console.warn('Wickwager: a beat failed', err); } };
    const ro = new ResizeObserver(go);
    const guard = setTimeout(go, 200);
    ro.observe(node);
  }
  /** Removes a node once its animation ends (or after ms when nothing animates). */
  function transient(node, a, ms) {
    const kill = () => { if (node && node.parentNode) node.remove(); };
    if (a && a.finished) a.finished.then(kill, kill);
    else setTimeout(kill, dur(ms || 300) + 20);
  }
  /** A quick swell, then a spring back to rest. */
  const punch = (node, ms = 420, k = 1.12) => anim(node, [{ transform: 'scale(1)', easing: EASE.out }, { transform: `scale(${k})`, offset: 0.18, easing: EASE.bouncy }, { transform: 'scale(1)' }], { d: ms, e: 'linear' });
  /** A readout flares for a moment: a well flares its pool of light, a glowing number brightens its element. */
  function flare(node, k = 1.8, ms = 420, delay = 0) {
    if (!node) return null;
    if (node.classList && node.classList.contains('well-n')) {
      return anim(node, [{ opacity: 0.6, transform: 'scale(1)' }, { opacity: 1, transform: `scale(${(1 + (k - 1) * 0.35).toFixed(2)})`, offset: 0.18 }, { opacity: 0.6, transform: 'scale(1)' }], { d: ms, delay, e: EASE.out, pseudo: '::before' });
    }
    const host = node.classList && [...node.classList].some((c) => c.startsWith('g-')) ? node.parentElement : node;
    return anim(host, [{ filter: 'brightness(1)' }, { filter: `brightness(${k}) saturate(1.15)`, offset: 0.18 }, { filter: 'brightness(1)' }], { d: ms, delay, e: EASE.out });
  }

  /** A timeline of steps at base times (ms at speed 1), scaled by the game speed, that can pause and resume
      (the scripted stills hold the payout at its peak). Sub-steps scheduled from a running step use after(). */
  class Timeline {
    constructor() { this.items = []; this.timer = 0; this.paused = false; this.cancelled = false; this.start = 0; this.pauseWall = 0; this.held = []; this.done = null; this.seq = 0; this.curBt = 0; }
    // t is the scaled time; bt the base time, which keeps the order when test mode collapses every t to 0
    at(t, fn) { this.items.push({ t: dur(t), bt: Number(t) || 0, fn, s: this.seq++ }); return this; }
    now() { return (this.paused ? this.pauseWall : performance.now()) - this.start; }
    after(ms, fn) {
      const t = TEST ? 0 : this.now() + dur(ms), bt = this.curBt + (Number(ms) || 0);
      const it = { t, bt, fn, s: this.seq++ };
      let i = this.items.findIndex((x) => x.t > t || (x.t === t && x.bt > bt));
      if (i < 0) i = this.items.length;
      this.items.splice(i, 0, it);
      if (!this.firing) this.next();
      return this;
    }
    run() {
      this.items.sort((a, b) => a.t - b.t || a.bt - b.bt || a.s - b.s);
      this.start = performance.now();
      return new Promise((res) => { this.done = res; this.next(); });
    }
    next() {
      clearTimeout(this.timer);
      if (this.paused || this.cancelled) return;
      this.firing = true;
      while (this.items.length && this.items[0].t <= this.now() + 0.5) {
        const it = this.items.shift();
        this.curBt = it.bt;
        try { it.fn(); } catch (err) { console.warn('Wickwager: payout step failed', err); }
        if (this.paused || this.cancelled) { this.firing = false; return; }
      }
      this.firing = false;
      if (!this.items.length) { const d = this.done; this.done = null; if (d) d(); return; }
      this.timer = setTimeout(() => this.next(), Math.max(0, this.items[0].t - this.now()));
    }
    pause() {
      if (this.paused) return;
      this.paused = true;
      this.pauseWall = performance.now();
      clearTimeout(this.timer);
      this.held = (document.getAnimations ? document.getAnimations() : []).filter((a) => a.playState === 'running');
      this.held.forEach((a) => { try { a.pause(); } catch (err) { /* finished meanwhile */ } });
      root.classList.add('frame-mode');
    }
    resume() {
      if (!this.paused) return;
      this.start += performance.now() - this.pauseWall;
      this.paused = false;
      this.held.forEach((a) => { try { a.play(); } catch (err) { /* removed meanwhile */ } });
      this.held = [];
      root.classList.remove('frame-mode');
      this.next();
    }
    cancel() { this.cancelled = true; clearTimeout(this.timer); const d = this.done; this.done = null; if (d) d(); }
  }
  // scripted checks can hold a payout at a named moment ('peak') and release it
  const HOLD = { point: null, timeline: null, waiters: [] };
  function checkHold(point, tl) {
    if (!HOLD.point || HOLD.point !== point || !tl) return false;
    HOLD.timeline = tl;
    tl.pause();
    HOLD.waiters.splice(0).forEach((fn) => fn(point));
    return true;
  }

  // ================================================================== the pixel painter: chrome, digits, light (Lit's recipes)
  // Chrome 9-slices and the Ember digit face are UI graphics drawn here, so the table never depends on the art
  // workflow for its frames or numbers. Item art comes from TW.Art through sprite() below.
  const hexRGBA = (() => {
    const m = new Map();
    return (h) => {
      if (m.has(h)) return m.get(h);
      const s = h.replace('#', '');
      const v = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)).concat(s.length > 6 ? parseInt(s.slice(6, 8), 16) : 255);
      m.set(h, v);
      return v;
    };
  })();
  class Px {
    constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
    in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    get(x, y) { return this.in(x, y) ? this.p[y * this.w + x] : null; }
    set(x, y, c) { if (c && this.in(x, y)) this.p[y * this.w + x] = c; return this; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
    blit(src, x0, y0) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c) this.set(x0 + x, y0 + y, c); } return this; }
    draw(rows, x0, y0, key) { rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch !== '.' && ch !== ' ' && key[ch]) this.set(x0 + i, y0 + j, key[ch]); } }); return this; }
    outline(col, diag = false) {
      const add = [];
      const nb = diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (nb.some(([dx, dy]) => { const c = this.get(x + dx, y + dy); return c && c !== col; })) add.push([x, y]);
      }
      add.forEach(([x, y]) => this.set(x, y, col));
      return this;
    }
    canvas() {
      const cv = document.createElement('canvas');
      cv.width = this.w; cv.height = this.h;
      // CPU-backed: a sprite is encoded to PNG once, and a GPU canvas would stall on every read-back
      const g = cv.getContext('2d', { willReadFrequently: true });
      const im = g.createImageData(this.w, this.h);
      for (let i = 0; i < this.p.length; i++) { const c = this.p[i]; if (c) im.data.set(hexRGBA(c), i * 4); }
      g.putImageData(im, 0, 0);
      return cv;
    }
    url() { return this.canvas().toDataURL('image/png'); }
  }
  const maskFn = (w, h, f) => { const m = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (f(x, y)) m[y * w + x] = 1; return { w, h, m, get: (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? m[y * w + x] : 0) }; };
  // ramps run dark to light (the Lit art kit's)
  const R = {
    cream: ['#6E4636', '#8F6150', '#BD8C6C', '#DDB08A', '#F2D3AE', '#FBE7CB', '#FFF3E0', '#FFFCF5'],
    chips: ['#0D1140', '#141A5E', '#1C2489', '#2734B5', '#3346D6', '#4A62FF', '#7C8FFF', '#A9B8FF', '#D5DCFF'],
    mult: ['#3A0812', '#5C0D1B', '#7E1222', '#A51A27', '#C8262F', '#E9382B', '#FF8F78', '#FFB9A6', '#FFE3DA'],
    money: ['#5A3008', '#7E4A0E', '#A86814', '#D18A1D', '#EBAA2A', '#FFCE3B', '#FFE070', '#FFF0A0', '#FFFAD6'],
    lime: ['#1C3A0A', '#2F5A12', '#3F7317', '#5A9A1F', '#7CC12C', '#9EE03C', '#C3F26E', '#E2FFA6', '#F4FFD6'],
    pink: ['#3E0824', '#5E0F38', '#87154C', '#B21F67', '#E2337F', '#FF4C9B', '#FF80BA', '#FFB2D6', '#FFE3F0'],
    ember: ['#4A1A08', '#6E2A10', '#943B13', '#C24F1A', '#E8611F', '#FF7A2B', '#FFA458', '#FFD29C', '#FFF0D8'],
    vio: ['#1E0B42', '#2E1160', '#3E1880', '#5320A0', '#6F33C9', '#8B46EE', '#AC7BFF', '#CDA8FF', '#EBDDFF'],
    plum: ['#13070F', '#1E0D19', '#2A1423', '#3C2132', '#4D2B40', '#5A334C', '#6A3D55', '#7A4A62'],
  };
  const EDGE = '#2B1220';
  // ---- chrome: a 9 x 9 rounded panel on a 3-px curve, lit lip panels, pills and buttons (Lit art.js)
  const roundMask = (S, H, r) => maskFn(S, H, (x, y) => { const c = y < r.length ? r[y] : y > H - 1 - r.length ? r[H - 1 - y] : 0; return x >= c && x < S - c; });
  function framePanel(o) {
    const S = 9, k = roundMask(S, S, [3, 1, 1]), b = new Px(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!k.get(x, y)) continue;
      const up = !k.get(x, y - 1), dn = !k.get(x, y + 1), lf = !k.get(x - 1, y), rt = !k.get(x + 1, y);
      let c = o.fill;
      if (up) c = o.top; else if (dn) c = o.bottom; else if (lf || rt) c = o.side; else if (o.inner && !k.get(x, y - 2)) c = o.inner;
      b.set(x, y, c);
    }
    return b;
  }
  function frameLip(o) {
    const S = 9, k = roundMask(S, S, [3, 1, 1]), b = new Px(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!k.get(x, y)) continue;
      const first = !k.get(x, y - 1), second = !first && !k.get(x, y - 2);
      b.set(x, y, first ? o.lip0 : second ? o.lip1 : o.fill);
    }
    return b;
  }
  function framePill(ramp) {
    const n = ramp.length, S = 7, k = roundMask(S, S, [2, 1]), b = new Px(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!k.get(x, y)) continue;
      const up = !k.get(x, y - 1), dn = !k.get(x, y + 1);
      b.set(x, y, up ? ramp[n - 2] : dn ? ramp[n - 6] : y === S - 2 ? ramp[n - 5] : ramp[n - 4]);
    }
    return b;
  }
  function frameButton(ramp, pressed) {
    const n = ramp.length, S = 9, H = 10, r = [3, 1, 1];
    const top = pressed ? 1 : 0, lip = pressed ? 1 : 2;
    const k = maskFn(S, H, (x, y) => {
      if (y < top) return false;
      const yy = y - top, hh = H - top;
      const c = yy < 3 ? r[yy] : yy > hh - 4 ? r[hh - 1 - yy] : 0;
      return x >= c && x < S - c;
    });
    const b = new Px(S, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < S; x++) {
      if (!k.get(x, y)) continue;
      const fromBottom = H - 1 - y, up = !k.get(x, y - 1);
      let c = ramp[n - 4];
      if (fromBottom < lip) c = fromBottom === 0 ? ramp[n - 7] : ramp[n - 6];
      else if (up) c = ramp[n - 2];
      else if (!k.get(x, y - 2)) c = ramp[n - 3];
      else if (!k.get(x - 1, y)) c = ramp[n - 3];
      else if (!k.get(x + 1, y) || fromBottom === lip) c = ramp[n - 5];
      b.set(x, y, c);
    }
    return b;
  }
  // ---- the card silhouette (41 x 55, corners stepped 4-2-1-1) and an empty slot with a dotted rim
  const CW = 41, CH = 55, CORNER = [4, 2, 1, 1];
  const cardMask = (w = CW, h = CH) => maskFn(w, h, (x, y) => { const r = y < CORNER.length ? CORNER[y] : y >= h - CORNER.length ? CORNER[h - 1 - y] : 0; return x >= r && x < w - r; });
  function slotBmp() {
    const k = cardMask(), b = new Px(CW, CH);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      if (!k.get(x, y)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !k.get(x + dx, y + dy));
      if (edge) { if ((x + y) % 3 !== 0) b.set(x, y, y < 3 ? '#F0BE9638' : '#F0BE9660'); } else b.set(x, y, '#12060E30');
    }
    return b;
  }
  // ---- icons (9 x 9): the Lit set, plus close and arrows; TW.Art's icon:{name} wins when it exists
  const ICONS = {
    info: ['..kkkkk..', '.kvvvvvk.', 'kvvvkvvvk', 'kvvvvvvvk', 'kvvvkvvvk', 'kvvvkvvvk', 'kvvvkvvvk', '.kvvvvvk.', '..kkkkk..'],
    options: ['..kk.....', 'kkkkkkkkk', '..kk.....', '.........', '......kk.', 'kkkkkkkkk', '......kk.', '.........', '.........'],
    replay: ['...kkkk..', '..k....kk', '.k....kkk', 'k.....kkk', 'k........', 'k.......k', '.k.....k.', '..k...k..', '...kkk...'],
    deck: ['.kkkkkk..', 'kwwwwwk..', 'kwkkkkkkk', 'kwkwwwwwk', 'kwkwwxwwk', 'kwkwxxxwk', '.kkwwxwwk', '..kwwwwwk', '..kkkkkkk'],
    close: ['.........', '.kk...kk.', '.kkk.kkk.', '..kkkkk..', '...kkk...', '..kkkkk..', '.kkk.kkk.', '.kk...kk.', '.........'],
    'arrow-left': ['.........', '....kk...', '...kk....', '..kk.....', '.kkkkkkk.', '..kk.....', '...kk....', '....kk...', '.........'],
    'arrow-right': ['.........', '...kk....', '....kk...', '.....kk..', '.kkkkkkk.', '.....kk..', '....kk...', '...kk....', '.........'],
    pause: ['.........', '.kk...kk.', '.kk...kk.', '.kk...kk.', '.kk...kk.', '.kk...kk.', '.kk...kk.', '.kk...kk.', '.........'],
  };
  function iconBmp(name, col) {
    const g = ICONS[name] || ICONS.info;
    return new Px(9, 9).draw(g, 0, 0, { k: col || EDGE, w: '#FFF3E0', x: '#B31B3D' });
  }
  // ---- the candle token for Small and Big Blinds: wax, a pink drip and dish, and a three-frame stepped flame
  const FLAME_KEY = { r: '#E8461C', o: '#FF7A2B', a: '#FFA458', y: '#FFD84A', u: '#FFF2B0', v: '#FFFFFF', k: EDGE };
  function flameStrip() {
    const fr = [
      ['...r...', '...o...', '..ooo..', '..oao..', '.oayao.', '.oyuyo.', 'roauaor', '.oavao.', '..ooo..', '...k...'],
      ['...r...', '..ro...', '..oo...', '..oao..', '.oayao.', '.ayuyo.', 'roauaor', '.oavao.', '..ooo..', '...k...'],
      ['....r..', '...or..', '..ooo..', '..oaoo.', '.oayao.', '.oyuya.', 'roauaor', '.oavao.', '..ooo..', '...k...'],
    ];
    const b = new Px(21, 10);
    fr.forEach((g, i) => b.draw(g, i * 7, 0, FLAME_KEY));
    return b;
  }
  function candleWax(tall) {
    const wax = tall ? 22 : 14, w = 17, h = wax + 6, b = new Px(w, h);
    const col = ['#FFFCF5', '#FFF3E0', '#FFF3E0', '#FBE7CB', '#FBE7CB', '#F2D3AE', '#DDB08A'];
    for (let y = 0; y < wax; y++) for (let i = 0; i < 7; i++) b.set(5 + i, y, col[i]);
    b.set(5, 0, '#FBE7CB'); b.set(11, 0, '#DDB08A');
    b.rect(5, 0, 7, 1, R.pink[7]); b.rect(5, 1, 2, 3, R.pink[7]); b.set(5, 4, R.pink[6]); b.rect(9, 1, 2, 2, R.pink[7]); b.set(10, 3, R.pink[6]);
    const dish = [[2, 14, R.pink[7]], [1, 15, R.pink[5]], [1, 15, R.pink[4]], [3, 13, R.pink[2]]];
    dish.forEach(([x0, x1, c], j) => { for (let x = x0; x <= x1; x++) b.set(x, wax + j, c); });
    b.set(2, wax, R.pink[8]); b.set(3, wax, R.pink[8]);
    b.outline(EDGE);
    return b;
  }
  // ---- pixel shards for the total's burst: lit along the top and left, shaded along the bottom and right
  function shardBmp(ramp, w, h, kind) {
    const n = ramp.length;
    if (kind === 'diag' || kind === 'anti') {
      const b = new Px(w + 1, w);
      for (let k = 0; k < w; k++) { const y = kind === 'diag' ? k : w - 1 - k; b.set(k, y, k === 0 ? ramp[n - 1] : ramp[n - 3]); b.set(k + 1, y, ramp[n - 4]); }
      return b;
    }
    const b = new Px(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = x === 0 && y === 0 ? ramp[n - 1] : y === 0 || x === 0 ? ramp[n - 3] : y === h - 1 || x === w - 1 ? ramp[n - 5] : ramp[n - 4];
      b.set(x, y, c);
    }
    return b;
  }
  // ---- the Ember digit face: S 5 x 7, L 7 x 11, XL is L redrawn twice as fine with EPX, XXL twice again with a lit bevel
  const GLYPH_S = {
    0: '.###.|##.##|##.##|##.##|##.##|##.##|.###.', 1: '.##..|###..|.##..|.##..|.##..|.##..|####.', 2: '.###.|##.##|...##|..##.|.##..|##...|#####',
    3: '####.|...##|...##|.###.|...##|...##|####.', 4: '...##|..###|.####|##.##|#####|...##|...##', 5: '#####|##...|####.|...##|...##|##.##|.###.',
    6: '.###.|##...|##...|####.|##.##|##.##|.###.', 7: '#####|...##|..##.|..##.|.##..|.##..|.##..', 8: '.###.|##.##|##.##|.###.|##.##|##.##|.###.',
    9: '.###.|##.##|##.##|.####|...##|...##|.###.', $: '..#..|.####|##.#.|.###.|.#.##|####.|..#..', '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
    '-': '.....|.....|.....|####.|.....|.....|.....', x: '.....|##.##|.###.|..#..|.###.|##.##|.....', '/': '...##|...##|..##.|..#..|.##..|##...|##...',
    ',': '..|..|..|..|..|##|.#', '.': '..|..|..|..|..|##|##', ' ': '...|...|...|...|...|...|...', e: '.....|.....|.###.|##.##|#####|##...|.####',
    '?': '.###.|##.##|...##|..##.|..##.|.....|..##.',
  };
  const GLYPH_L = {
    0: '.#####.|#######|##...##|##...##|##...##|##...##|##...##|##...##|##...##|#######|.#####.',
    1: '...##..|..###..|.####..|...##..|...##..|...##..|...##..|...##..|...##..|.######|.######',
    2: '.#####.|#######|##...##|.....##|....###|..####.|.###...|###....|##.....|#######|#######',
    3: '######.|#######|.....##|.....##|.#####.|.#####.|.....##|.....##|.....##|#######|######.',
    4: '....###|...####|..##.##|.##..##|##...##|#######|#######|.....##|.....##|.....##|.....##',
    5: '#######|#######|##.....|##.....|######.|#######|.....##|.....##|##...##|#######|.#####.',
    6: '.#####.|#######|##.....|##.....|######.|#######|##...##|##...##|##...##|#######|.#####.',
    7: '#######|#######|.....##|....##.|....##.|...##..|...##..|..##...|..##...|..##...|..##...',
    8: '.#####.|#######|##...##|##...##|.#####.|.#####.|##...##|##...##|##...##|#######|.#####.',
    9: '.#####.|#######|##...##|##...##|##...##|#######|.######|.....##|.....##|#######|.#####.',
    $: '...##..|.######|#######|##.##..|#######|.######|...##.#|...##.#|#######|######.|...##..',
    '+': '......|......|..##..|..##..|######|######|..##..|..##..|......|......|......',
    '-': '......|......|......|......|######|######|......|......|......|......|......',
    x: '.......|.......|##...##|###.###|.#####.|..###..|.#####.|###.###|##...##|.......|.......',
    '/': '.....##|.....##|....##.|....##.|...##..|...##..|..##...|..##...|.##....|##.....|##.....',
    ',': '...|...|...|...|...|...|...|...|###|.##|.#.', '.': '...|...|...|...|...|...|...|...|...|###|###',
    ' ': '....|....|....|....|....|....|....|....|....|....|....',
    e: '.......|.......|.......|.#####.|#######|##...##|#######|#######|##.....|#######|.######',
    '?': '.#####.|#######|##...##|.....##|....###|...###.|...##..|...##..|.......|...##..|...##..',
  };
  const parseGlyph = (s) => s.split('|').map((r) => [...r].map((ch) => ch === '#'));
  function epx(m) {
    const h = m.length, w = m[0].length;
    const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? m[y][x] : false);
    const out = Array.from({ length: h * 2 }, () => new Array(w * 2).fill(false));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), Cc = at(x - 1, y), D = at(x, y + 1);
      let p1 = P, p2 = P, p3 = P, p4 = P;
      if (Cc === A && Cc !== D && A !== B) p1 = A;
      if (A === B && A !== Cc && B !== D) p2 = B;
      if (D === Cc && D !== B && Cc !== A) p3 = Cc;
      if (B === D && B !== A && D !== Cc) p4 = D;
      out[y * 2][x * 2] = p1; out[y * 2][x * 2 + 1] = p2; out[y * 2 + 1][x * 2] = p3; out[y * 2 + 1][x * 2 + 1] = p4;
    }
    return out;
  }
  const FONTS = {
    S: { g: Object.fromEntries(Object.entries(GLYPH_S).map(([k, v]) => [k, parseGlyph(v)])), gap: 1 },
    L: { g: Object.fromEntries(Object.entries(GLYPH_L).map(([k, v]) => [k, parseGlyph(v)])), gap: 1 },
  };
  FONTS.XL = { g: Object.fromEntries(Object.entries(FONTS.L.g).map(([k, v]) => [k, epx(v)])), gap: 2 };
  FONTS.XXL = { g: Object.fromEntries(Object.entries(FONTS.XL.g).map(([k, v]) => [k, epx(v)])), gap: 4, bevel: true };
  // text styles: fill shades from the top row to the bottom row, then a coloured rim (never a hard black drop)
  const TEXT = {
    cream: { ramp: ['#FFFFFF', '#FFF6E8', '#FFE7C8', '#F7CFA2'], ol: '#4A1A36' },
    score: { ramp: ['#FFFFFF', '#FFF8EC', '#FFEACB', '#FFD29A', '#FFB874'], ol: '#5E1E12' },
    chips: { ramp: ['#FFFFFF', '#EEF1FF', '#CDD5FF', '#A9B8FF'], ol: '#3346D6' },
    mult: { ramp: ['#FFFFFF', '#FFEEE8', '#FFCBBD', '#FFA38A'], ol: '#C8262F' },
    money: { ramp: ['#FFCE3B'], ol: '#D18A1D' }, // flat yellow, one amber rim: cash never reads as a gold trim
    ember: { ramp: ['#FFF4E2', '#FFD29C', '#FFA458', '#FF8436'], ol: '#5E1E0C' },
    pink: { ramp: ['#FFEEF6', '#FFB2D6', '#FF80BA', '#FF5AA4'], ol: '#5E0F38' },
    lime: { ramp: ['#F7FFE0', '#E2FFA6', '#C3F26E', '#A6E44A'], ol: '#2A4E10' },
    blue: { ramp: ['#F2F4FF', '#CDD5FF', '#A9B8FF', '#7C8FFF'], ol: '#141A5E' },
    red: { ramp: ['#FFF1EC', '#FFCBBD', '#FFA38A', '#FF7F68'], ol: '#5C0D1B' },
    hot: { ramp: ['#FFF6F0', '#FFD3C4', '#FF9A7C', '#FF5A3D'], ol: '#5C0D1B' },
    vio: { ramp: ['#FBF4FF', '#EBDDFF', '#CDA8FF', '#AC7BFF'], ol: '#2E1160' },
    total: { ramp: ['#FFFFFF', '#FFFBF0', '#FFF0D6', '#FFDCAA', '#FFC27E'], ol: '#6E2A10' },
    soft: { ramp: ['#F7DCCB', '#EBC6B0', '#DDB09A'], ol: null },
    dim: { ramp: ['#C9A2B4', '#B08A9E'], ol: '#3C2132' },
  };
  const GLYPH_MAP = { '×': 'x', '−': '-', X: 'x', E: 'e' };
  const glyphOf = (F, ch) => F.g[GLYPH_MAP[ch] || ch] || F.g[String(ch).toLowerCase()] || F.g['?'] || F.g[' '];
  function textBmp(str, size = 'S', style = 'cream') {
    const F = FONTS[size] || FONTS.S, st = TEXT[style] || TEXT.cream;
    const chars = [...String(str)].map((ch) => glyphOf(F, ch));
    if (!chars.length) chars.push(F.g[' ']);
    const h = chars[0].length;
    const w = chars.reduce((s, g) => s + g[0].length, 0) + F.gap * (chars.length - 1);
    const pad = st.ol ? 1 : 0;
    const b = new Px(w + pad * 2, h + pad * 2);
    const n = st.ramp.length;
    let cx = pad;
    chars.forEach((g) => {
      const on = (x, y) => y >= 0 && y < g.length && x >= 0 && x < g[0].length && g[y][x];
      g.forEach((row, y) => row.forEach((p, x) => {
        if (!p) return;
        let c = st.ramp[Math.min(n - 1, Math.floor(((y + 0.5) / h) * n))];
        if (F.bevel && n > 2) {
          if (!on(x, y - 1) || !on(x - 1, y)) c = st.ramp[0];
          else if (!on(x, y + 1) || !on(x + 1, y)) c = st.ramp[n - 1];
        }
        b.set(cx + x, pad + y, c);
      }));
      cx += g[0].length + F.gap;
    });
    if (st.ol) b.outline(st.ol, true);
    return b;
  }
  /** Width of a string in the digit face, in art px (rim included). */
  function numWidth(str, size = 'S') {
    const F = FONTS[size] || FONTS.S;
    const chars = [...String(str)].map((ch) => glyphOf(F, ch));
    return chars.reduce((s, g) => s + g[0].length, 0) + F.gap * Math.max(0, chars.length - 1) + 2;
  }
  const SPRITES = new Map();
  /** A painted sprite, cached: { url, w, h, bmp }. */
  function painted(key, make) {
    if (!SPRITES.has(key)) { const b = make(); SPRITES.set(key, { key, url: b.url(), w: b.w, h: b.h, bmp: b }); }
    return SPRITES.get(key);
  }
  const imgTag = (s, cls = '', alt = '') => `<img class="spr ${cls}" src="${s.url}" style="--w:${s.w};--h:${s.h}" alt="${esc(alt)}"${alt ? '' : ' aria-hidden="true"'} draggable="false">`;
  // Numbers in the digit face have a cache of their own: every readout draws many strings (the payout counts Chips,
  // Mult and the score in steps, Endless numbers run long), so past NUM_CAP the string unused longest is forgotten
  // (drawn again if it comes back), and an entry keeps only its picture: the bitmap, which only a glow reads, is
  // drawn again on demand. Memory stays flat from hand to hand.
  const NUMS = new Map();
  const NUM_CAP = 512;
  function numSprite(str, size = 'S', style = 'cream') {
    const key = `t:${size}:${style}:${str}`;
    let s = NUMS.get(key);
    if (s) { NUMS.delete(key); NUMS.set(key, s); return s; }
    const b = textBmp(str, size, style);
    s = { key, url: b.url(), w: b.w, h: b.h, get bmp() { return textBmp(str, size, style); } };
    NUMS.set(key, s);
    if (NUMS.size > NUM_CAP) NUMS.delete(NUMS.keys().next().value);
    return s;
  }
  /** A number or short string in the Ember digit face, as an <img> on the art grid (hidden from screen readers). */
  const num = (str, size = 'S', style = 'cream', cls = '') => imgTag(numSprite(str, size, style), 'num-img ' + cls);
  /** The same with its text for screen readers. */
  const numHTML = (str, size = 'S', style = 'cream') => `<span class="sr">${esc(str)}</span>${num(str, size, style)}`;
  const WIDTHS = new Map();
  /** A box's inner width in CSS px, measured once per viewport size and kept. A readout redraws its number many
      times (the payout counts Chips, Mult and the score dozens of times): reading the width after each redraw would
      force a layout every time. key names the box (its id or role); 0 is never kept (a box not laid out yet). */
  function boxWidth(node, key) {
    if (!node) return 0;
    const k = `${key || node.id || node.className}@${innerWidth}x${innerHeight}`;
    let w = WIDTHS.get(k);
    if (!w) { w = node.clientWidth; if (w) WIDTHS.set(k, w); }
    return w || 0;
  }
  /** The largest face from `sizes` whose width fits maxCss CSS px at the current pixel size. */
  function fitSize(str, maxCss, sizes = ['XXL', 'XL', 'L', 'S']) {
    const p = PX();
    for (const s of sizes) if (numWidth(str, s) * p <= maxCss) return s;
    return sizes[sizes.length - 1];
  }
  /** A soft glow baked once into a canvas from a painted sprite: a tight core and a wide halo, behind the crisp sprite. */
  function glowCanvas(s, px, rgb, o = {}) {
    const r1 = (o.r1 ?? 2) / px, r2 = (o.r2 ?? 8) / px, pad = Math.ceil(r2 * 2.6);
    const W = s.w + pad * 2, H = s.h + pad * 2;
    const src = s.bmp.canvas();
    const tinted = (col) => {
      const sil = document.createElement('canvas');
      sil.width = W; sil.height = H;
      const sg = sil.getContext('2d', { willReadFrequently: true });
      sg.drawImage(src, pad, pad);
      sg.globalCompositeOperation = 'source-in';
      sg.fillStyle = `rgb(${col})`;
      sg.fillRect(0, 0, W, H);
      return sil;
    };
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.filter = `blur(${r2}px)`; g.globalAlpha = o.a2 ?? 0.75; g.drawImage(tinted(rgb), 0, 0);
    g.filter = `blur(${r1}px)`; g.globalAlpha = o.a1 ?? 0.9; g.drawImage(tinted(o.core || rgb), 0, 0);
    g.filter = 'none';
    cv.className = 'glow-bake';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = `width:${W * px}px;height:${H * px}px;left:${-pad * px}px;top:${-pad * px}px`;
    return cv;
  }
  /** A soft light (bloom, ring, flash) drawn small into a canvas; CSS stretches it. stops: [[offset, 'rgba(...)'], ...] */
  function lightCanvas(size, stops, cpu = false) {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const g = cv.getContext('2d', cpu ? { willReadFrequently: true } : undefined);
    const c = size / 2, gr = g.createRadialGradient(c, c, 0, c, c, c);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    cv.setAttribute('aria-hidden', 'true');
    return cv;
  }
  /** A ring of light as an image, made once per colour (an image needs no new GPU shader on its first showing). */
  const ringURL = (() => {
    const m = new Map();
    return (rgb) => {
      if (!m.has(rgb)) {
        const rc = rgb.split(',').map((v) => Number(v)), c = rc.join(', ');
        const mix = rc.map((v, i) => Math.round(v * 0.62 + [255, 244, 228][i] * 0.38)).join(', ');
        m.set(rgb, lightCanvas(128, [[0, `rgba(${c}, 0)`], [0.55, `rgba(${c}, 0)`], [0.63, `rgba(${c}, .34)`], [0.71, `rgba(${mix}, 1)`], [0.79, `rgba(${c}, .46)`], [1, `rgba(${c}, 0)`]], true).toDataURL('image/png'));
      }
      return m.get(rgb);
    };
  })();
  const paint = {
    Px, R, painted, imgTag, textBmp, numWidth, glowCanvas, lightCanvas, ringURL, NUM_CAP, numCached: () => NUMS.size,
    slot: () => painted('slot', slotBmp),
    icon: (name, col) => painted(`icon:${name}:${col || ''}`, () => iconBmp(name, col)),
    flame: () => painted('flame', flameStrip),
    candle: (tall) => painted(`candle:${tall ? 'big' : 'small'}`, () => candleWax(tall)),
    shard: (col, w, h, kind = '') => painted(`shard:${col}:${w}x${h}:${kind}`, () => shardBmp(R[col] || R.ember, w, h, kind)),
    frames() {
      const f = (k, make) => painted('frame:' + k, make).url;
      const lip = { lip0: '#FFD29CA8', lip1: '#8C5671B8' };
      return {
        panel: f('panel', () => frameLip({ ...lip, fill: '#2E0F249E' })),
        'panel-warm': f('panelWarm', () => frameLip({ lip0: '#FFDCA8C0', lip1: '#A2566AC0', fill: '#4A1A2CA8' })),
        'panel-deep': f('panelDeep', () => frameLip({ lip0: '#FFD29C90', lip1: '#6A3D55C0', fill: '#170612C4' })),
        'panel-rack': f('panelRack', () => frameLip({ ...lip, fill: '#2A0D2288' })),
        well: f('well', () => framePanel({ top: '#0A02088C', side: '#FFD6B41A', bottom: '#FFDCBE40', fill: '#14050F80' })),
        chips: f('chips', () => framePanel({ top: '#05082EFF', side: '#2A3AB0FF', bottom: '#8C9EFFFF', fill: '#121860FF', inner: '#060A38FF' })),
        mult: f('mult', () => framePanel({ top: '#2E040CFF', side: '#8A1A24FF', bottom: '#FF9A84FF', fill: '#5A0C1CFF', inner: '#30040EFF' })),
        tip: f('tip', () => frameLip({ lip0: '#FFE2BCD0', lip1: '#8C5671E0', fill: '#24091CF2' })),
        plaque: f('plaque', () => frameLip({ lip0: '#FFE6C0F0', lip1: '#B8607AE8', fill: '#2A0C20EE' })),
        dialog: f('dialog', () => frameLip({ lip0: '#FFE6C0F0', lip1: '#A2566AF0', fill: '#2A0C20F6' })),
        boss: f('boss', () => frameLip({ lip0: '#CDA8FFE0', lip1: '#6F33C9E0', fill: '#1E0B42E8' })),
        'toast-err': f('toastErr', () => frameLip({ lip0: '#FFB2D6E0', lip1: '#B21F67E0', fill: '#2A0C20F4' })),
        'toast-good': f('toastGood', () => frameLip({ lip0: '#E2FFA6E0', lip1: '#5A9A1FE0', fill: '#20101CF4' })),
        'pill-ember': f('pillEmber', () => framePill(R.ember)),
        'pill-pink': f('pillPink', () => framePill(R.pink)),
        'pill-lime': f('pillLime', () => framePill(R.lime)),
        'pill-cream': f('pillCream', () => framePill(R.cream)),
        'pill-vio': f('pillVio', () => framePill(R.vio)),
        // the Chips and Mult pills sit one step deeper on their ramps, so their light ink keeps 4.5:1 (WCAG 1.4.3): on the
        // bright step a Mult Edition's pill and the payout's +Mult tags read at 3.8:1, the Chips ones at 4.3:1
        'pill-blue': f('pillBlue', () => framePill(R.chips.slice(0, -1))),
        'pill-red': f('pillRed', () => framePill(R.mult.slice(0, -1))),
        'pill-plum': f('pillPlum', () => framePill(R.plum)),
        'btn-ember': f('btnEmber', () => frameButton(R.ember)),
        'btn-ember-down': f('btnEmberDown', () => frameButton(R.ember, true)),
        'btn-pink': f('btnPink', () => frameButton(R.pink)),
        'btn-pink-down': f('btnPinkDown', () => frameButton(R.pink, true)),
        'btn-cream': f('btnCream', () => frameButton(R.cream)),
        'btn-cream-down': f('btnCreamDown', () => frameButton(R.cream, true)),
        'btn-yellow-down': f('btnYellowDown', () => frameButton(R.money, true)),
        'btn-plum': f('btnPlum', () => frameButton(R.plum)),
        'btn-ghost': f('btnGhost', () => frameLip({ lip0: '#FFD29C80', lip1: '#8C567190', fill: '#3A132C8C' })),
      };
    },
  };
  function installChrome() {
    const F = paint.frames();
    Object.entries(F).forEach(([k, url]) => root.style.setProperty('--f-' + k, `url("${url}")`));
    root.style.setProperty('--flame', `url("${paint.flame().url}")`);
  }

  // ================================================================== sprites from TW.Art, with placeholders
  const SIZE_BY_PREFIX = { card: [41, 55], joker: [41, 55], tarot: [41, 55], planet: [41, 55], spectral: [41, 55], voucher: [41, 55], pack: [41, 55], back: [41, 55], tag: [17, 17], stake: [15, 15], icon: [9, 9], blind: [17, 28], boss: [31, 31], seal: [17, 17], edition: [17, 17], enh: [17, 17] };
  const ART = new Map();
  /** The art for an id: { id, url, w, h } from TW.Art, or null when TW.Art or the sprite is missing. */
  function artSprite(id) {
    if (!id) return null;
    if (ART.has(id)) return ART.get(id);
    let out = null;
    const A = TW.Art;
    if (A && typeof A.url === 'function') {
      try {
        const known = typeof A.has === 'function' ? A.has(id) : true;
        const url = known ? A.url(id) : null;
        if (url) {
          const b = typeof A.bitmap === 'function' ? A.bitmap(id) : null;
          const d = SIZE_BY_PREFIX[String(id).split(':')[0]] || [41, 55];
          out = { id, url, w: b && b.w ? b.w : d[0], h: b && b.h ? b.h : d[1] };
        }
      } catch (err) { out = null; }
    }
    ART.set(id, out);
    return out;
  }
  /** The art id of a playing card with its Enhancement, Seal and Edition (TW.Art.card composes it on demand).
      With Colour-coded suits on (settings.fourColor) it asks for the four-colour face, a 'card4:' id. */
  function cardSpriteId(c) {
    const A = TW.Art;
    const four = !!settings.fourColor;
    if (c && A && typeof A.card === 'function') {
      try {
        const o = { rank: c.rank, suit: c.suit, enhancement: c.enhancement || null, seal: c.seal || null, edition: c.edition || null };
        if (four) o.fourColor = true;
        const id = A.card(o);
        if (id) return id;
      } catch (err) { /* fall back to the plain face */ }
    }
    return c ? `${four ? 'card4' : 'card'}:${c.rank}${c.suit}` : 'card:?';
  }
  /** { url, w, h, ok }: the art, or the size a placeholder should take. */
  function sprite(id, o = {}) {
    const s = artSprite(id);
    if (s) return Object.assign({ ok: true }, s);
    const d = SIZE_BY_PREFIX[String(id || '').split(':')[0]] || [41, 55];
    return { ok: false, id, url: null, w: o.w || d[0], h: o.h || d[1] };
  }
  const CARD_KINDS = ['joker', 'tarot', 'planet', 'spectral', 'voucher', 'pack', 'back', 'card'];
  /** An <img> for an art id, or a styled placeholder (a blank Lit card frame with the name in its plate).
      o: { cls, alt, name, kind, rarity, card (for a playing card placeholder), plate (false: leave the plate empty) } */
  function spriteHTML(id, o = {}) {
    const s = artSprite(id);
    if (s) return imgTag(s, o.cls || '', o.alt || '');
    const kind = o.kind || String(id || '').split(':')[0] || 'card';
    const d = SIZE_BY_PREFIX[kind] || [41, 55];
    const w = o.w || d[0], h = o.h || d[1];
    const label = o.alt ? ` role="img" aria-label="${esc(o.alt)}"` : ' aria-hidden="true"';
    if (CARD_KINDS.includes(kind)) {
      if (kind === 'card' && o.card) {
        const c = o.card, red = c.suit === 'H' || c.suit === 'D';
        const rk = (TW.Content && TW.Content.RANK_NAMES && TW.Content.RANK_NAMES[c.rank]) || String(c.rank);
        return `<span class="ph ph-card ph-k-card${red ? ' ph-red' : ''} ${o.cls || ''}" style="--w:${w};--h:${h}"${label}><span class="ph-rank">${esc(rk)}</span><span class="ph-suit">${esc(suitName(c.suit))}</span></span>`;
      }
      const plate = o.plate === false || ['joker', 'tarot', 'planet', 'spectral'].includes(kind) ? '' : esc(o.name || '');
      return `<span class="ph ph-card ph-k-${kind} ph-r-${esc(o.rarity || 'common')} ${o.cls || ''}" style="--w:${w};--h:${h}"${label}><span class="ph-win"></span><span class="ph-plate">${plate}</span></span>`;
    }
    const initials = String(o.name || '').replace(/^the\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
    return `<span class="ph ph-token ph-k-${esc(kind)} ${o.cls || ''}" style="--w:${w};--h:${h}"${label}>${kind === 'icon' ? '' : esc(initials)}</span>`;
  }

  // ---- the layers every card, Joker and consumable wears, shared by the table, the Shop, packs and the menus
  const LIGHT_HTML = '<span class="wash"></span><span class="sheen"><i></i><b></b></span>';
  const swayStyle = (i) => `--sway-delay:-${((i * 0.73) % 3.6).toFixed(2)}s;--sway-d:${(3.3 + (i % 3) * 0.4).toFixed(2)}s`;
  /** The lift (selection, hover), the idle hop (i staggers it; null holds it still) and the light over a face. */
  const layersHTML = (inner, i) => `<span class="lift"><span class="sway"${i == null ? '' : ` style="${swayStyle(i)}"`}>${inner}${LIGHT_HTML}</span></span>`;
  /** The moving light of an Edition (class ed-{id} on the card or Joker; ART.md section 11): Glitch slips two slices
      of the face; on a playing card, Sheen's sweep and Dither's hum are masked to its bare stock (TW.Art.stockMask:
      clear on the index, pips, court, an Enhancement's marks and the Seal), and on a Joker Sheen's sweep is masked by
      the face itself. Phantom's flicker and glow are CSS on the card, with nothing extra here. */
  function edFxHTML(edition, faceId) {
    if (!edition) return '';
    const s = artSprite(faceId);
    let inner = '', style = '';
    if (s && edition === 'fourcolor') inner = `<img class="spr slice s1" src="${s.url}" style="--w:${s.w};--h:${s.h}" alt="" aria-hidden="true" draggable="false"><img class="spr slice s2" src="${s.url}" style="--w:${s.w};--h:${s.h}" alt="" aria-hidden="true" draggable="false">`;
    const bare = edition === 'gloss' || edition === 'benday' ? stockMaskSprite(faceId) : null;
    if (bare) style = ` style="--ed-mask:url('${bare.url}')"`;
    else if (s && edition === 'gloss') style = ` style="--ed-mask:url('${s.url}')"`;
    return `<span class="ed-fx"${style} aria-hidden="true">${inner}</span>`;
  }
  /** The bare-stock mask of a playing card's face (TW.Art.stockMask), or null (a Joker, or no such art). */
  function stockMaskSprite(faceId) {
    const A = TW.Art;
    if (!A || typeof A.stockMask !== 'function') return null;
    try { const id = A.stockMask(faceId); return id ? artSprite(id) : null; } catch (err) { return null; }
  }
  /** A Seal's badge over its playing card at the Seal's own spot (TW.Art.meta('seal:' + id).at, [29, -4] for all
      four), so the part above the card's top edge shows. Empty when the Seal has no art. */
  function sealBadgeHTML(seal) {
    if (!seal) return '';
    const s = artSprite('seal:' + seal);
    if (!s) return '';
    let at = null;
    try { const m = TW.Art && typeof TW.Art.meta === 'function' ? TW.Art.meta('seal:' + seal) : null; at = m && m.at; } catch (err) { at = null; }
    if (!at || typeof at.length !== 'number' || at.length < 2) at = [38 - s.w, -4];
    return `<img class="spr seal-badge" src="${s.url}" style="--w:${s.w};--h:${s.h};--sx:${Number(at[0])};--sy:${Number(at[1])}" alt="" aria-hidden="true" draggable="false">`;
  }
  // ---- name plates: Joker, consumable and Voucher names sit on the plate drawn into the sprite (33 art px wide:
  // 99 CSS px at 3 px an art pixel, 66 at 2). Tiny5 at 16 px, its own grid, always: the full name when it fits;
  // else its most telling word; else that word set one CSS px tighter per letter (Tiny5 keeps a 1 px gap); else
  // the word shortened to what fits, with a full stop to say so, never clipped mid-letter. (Jersey 10
  // at 20 px measures as wide as Tiny5 at 16 px, so a change of face buys nothing.) The full name is always in the
  // item's label, tooltip and sheet.
  const plateCtx = (() => { try { return document.createElement('canvas').getContext('2d'); } catch (err) { return null; } })();
  const PLATE_W = new Map();
  /** A plate word's width in CSS px in a pixel face ('16px Tiny5' or '20px "Jersey 10"'); an estimate until the
      face has loaded (the racks are drawn again once it has, and the estimate is never kept). */
  function plateWidth(text, font) {
    const k = font + '|' + text;
    if (PLATE_W.has(k)) return PLATE_W.get(k);
    let w = String(text).length * (font.indexOf('Jersey') >= 0 ? 8 : 10);
    try {
      if (plateCtx && document.fonts && document.fonts.check(font)) { plateCtx.font = font; w = plateCtx.measureText(text).width; PLATE_W.set(k, w); }
    } catch (err) { /* estimate */ }
    return w;
  }
  function plateWord(full) {
    const words = full.replace(/^the\s+/i, '').split(/\s+/).filter(Boolean);
    if (!words.length) return full;
    // the longest word, the later one on a near tie (the noun after its adjective)
    return words.reduce((a, w) => (w.length >= a.length - 1 && words.indexOf(w) > words.indexOf(a) ? w : a), words[words.length - 1]);
  }
  /** The words a plate shows for a name at the current pixel size: { text, cls } (cls '' or 'pl-tight'). */
  function plateFit(name) {
    const full = String(name || '');
    const room = 33 * PX() - 2;
    const T5 = '16px Tiny5';
    const fits = (t) => plateWidth(t, T5) <= room;
    const tightFits = (t) => plateWidth(t, T5) - [...t].length <= room;
    let text = full, cls = '';
    if (plateWidth(full, T5) * 0.98 > room) {
      const words = full.replace(/^the\s+/i, '').split(/\s+/).filter(Boolean);
      const word = plateWord(full);
      // the telling word, else any other word of the name that fits whole (longest first)
      const other = words.slice().sort((a, b) => b.length - a.length).find((w) => w !== word && w.length > 2 && fits(w));
      // a hyphenated name gives up its longest part that fits, never a cut that ends on a hyphen
      const part = word.indexOf('-') > 0 ? word.split('-').filter((p) => p.length > 2 && fits(p)).reduce((a, p) => (p.length > a.length ? p : a), '') : '';
      if (fits(word)) text = word;
      else if (tightFits(word)) { text = word; cls = 'pl-tight'; }
      else if (other) text = other;
      else if (part) text = part;
      else {
        let k = word.length - 1;
        while (k > 2 && !fits(word.slice(0, k) + '.')) k--;
        text = word.slice(0, k) + '.';
      }
    }
    return { text, cls };
  }
  /** A name plate; it keeps the full name (data-full), so it can be set again for another pixel size (replate). */
  function plateHTML(name) {
    const full = String(name || '');
    const { text, cls } = plateFit(full);
    return `<span class="plate${cls ? ' ' + cls : ''}" aria-hidden="true" data-full="${esc(full)}">${esc(text)}</span>`;
  }
  /** Every name plate under root set again, in place, for the current pixel size: a plate chosen at 3 CSS px an art
      pixel is cut mid-letter at 2 (a window crossing 870 px tall, a phone turned). Only the plates change, so focus,
      a scroll position, an open dialog and its opener all stay (final pass, part 3: the Collection and an open How to
      play kept their 3 px plates). Returns how many changed. */
  function replate(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return 0;
    let n = 0;
    root.querySelectorAll('.plate[data-full]').forEach((p) => {
      const { text, cls } = plateFit(p.dataset.full);
      const want = 'plate' + (cls ? ' ' + cls : '');
      if (p.textContent === text && p.className === want) return;
      p.textContent = text;
      p.className = want;
      n++;
    });
    return n;
  }
  // ---- sprites made ahead, in idle time: a Joker takes about 10 ms to draw and encode, a card about 2, so a Shop
  // or a pack drawing five of them at once would hold a frame past 50 ms. The queue runs in idle callbacks (a few
  // ms of each idle period, never while a payout or a beat holds the table) and puts what a run needs first.
  const WARM = { queue: [], queued: new Set(), scheduled: false, done: 0 };
  // the faces the player sees first come first: with Colour-coded suits on, the four-colour faces lead
  const WARM_BASE = ['back:', 'blind:', 'icon:', 'seal:', 'stake:', 'boss:', 'tag:', 'joker:', 'tarot:', 'planet:', 'spectral:', 'pack:', 'voucher:', 'edition:', 'enh:'];
  const warmOrder = () => (settings.fourColor ? ['card4:', 'card:'] : ['card:', 'card4:']).concat(WARM_BASE);
  const WARM_ORDER = warmOrder();
  /** Ask TW.Art to draw and encode sprites in idle time (TW.Art.warm: a prefix such as 'card:' or a list of ids),
      a few ms a slice; without it, the same ids go through this file's own idle queue. Never throws. */
  function warmArt(what, budget = 6) {
    if (TEST || !what) return null;
    const A = TW.Art;
    if (A && typeof A.warm === 'function') {
      try { const p = A.warm(what, { budget }); if (p && typeof p.catch === 'function') p.catch(() => {}); return p; } catch (err) { /* fall back to the queue */ }
    }
    if (Array.isArray(what)) warm(what);
    else if (A && typeof A.ids === 'function') { try { warm(A.ids(what)); } catch (err) { /* nothing to warm */ } }
    return null;
  }
  /** Queue art ids to draw in idle time; front puts them ahead of the rest (the run's own Jokers, the Ante's Boss). */
  function warm(ids, front = false) {
    if (TEST || !ids || !ids.length) return;
    const fresh = ids.filter((id) => id && !ART.has(id) && !WARM.queued.has(id));
    fresh.forEach((id) => WARM.queued.add(id));
    if (front) WARM.queue.unshift(...fresh); else WARM.queue.push(...fresh);
    scheduleWarm();
  }
  function scheduleWarm() {
    if (WARM.scheduled || !WARM.queue.length) return;
    WARM.scheduled = true;
    const ric = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback.bind(window) : (fn) => setTimeout(() => fn({ timeRemaining: () => 6, didTimeout: false }), 80);
    ric((dl) => {
      WARM.scheduled = false;
      if (isBusy()) { setTimeout(scheduleWarm, 250); return; }
      while (WARM.queue.length && dl.timeRemaining() > 4) {
        const id = WARM.queue.shift();
        WARM.queued.delete(id);
        if (!ART.has(id)) { try { artSprite(id); WARM.done++; } catch (err) { /* drawn on demand instead */ } }
      }
      if (WARM.queue.length) setTimeout(scheduleWarm, 16);
    }, { timeout: 3000 });
  }
  /** Every sprite TW.Art can draw, in the order a run meets them. */
  function warmAll() {
    const A = TW.Art;
    if (!A || typeof A.ids !== 'function') return;
    let all = [];
    try { all = A.ids(); } catch (err) { return; }
    const order = warmOrder();
    const rank = (id) => { const i = order.findIndex((p) => String(id).startsWith(p)); return i < 0 ? order.length : i; };
    warm(all.slice().sort((a, b) => rank(a) - rank(b)));
  }
  /** While a Blind is played: what the next Shop can offer (the Jokers not owned, the packs, the Ante's Voucher, the
      Tarot and Planet cards), drawn ahead so the Shop deals in without waiting on first draws. */
  function warmNextShop(run) {
    const Cn = TW.Content || {};
    if (!run || TEST) return;
    const owned = new Set((run.jokers || []).map((j) => j.id));
    const ids = [].concat(
      run.anteVoucher ? ['voucher:' + run.anteVoucher] : [],
      (Cn.PACKS || []).map((p) => 'pack:' + p.id),
      (Cn.JOKERS || []).filter((j) => j && j.rarity !== 'legendary' && !owned.has(j.id)).map((j) => 'joker:' + j.id),
      (Cn.TAROTS || []).map((t) => 'tarot:' + t.id),
      (Cn.PLANETS || []).map((p) => 'planet:' + p.id),
    );
    warmArt(ids, 4);
  }
  /** What this run shows next: its deck back, Jokers and consumables, the Ante's Boss and Tags. */
  function warmRun(run) {
    if (!run) return;
    const ids = [`back:${run.deckId}`].concat(
      (run.jokers || []).map((j) => 'joker:' + j.id),
      (run.consumables || []).map((k) => `${k.kind}:${k.id}`),
      run.bosses && run.bosses[run.ante] ? ['boss:' + run.bosses[run.ante]] : [],
      [0, 1].map((i) => (run.tags && run.tags[`${run.ante}-${i}`] ? 'tag:' + run.tags[`${run.ante}-${i}`] : null)),
      run.shop && Array.isArray(run.shop.items) ? run.shop.items.filter(Boolean).map((it) => `${it.kind === 'pack' ? 'pack' : it.kind}:${it.id}`) : [],
    );
    warm(ids.filter(Boolean), true);
  }
  /** An icon: TW.Art's icon:{name} (tone 'light': icon:{name}:light, for dark chrome) when drawn, else the painted Lit icon. */
  function iconHTML(name, tone = 'light', cls = '') {
    const light = tone !== 'dark';
    const s = artSprite(light ? `icon:${name}:light` : `icon:${name}`);
    if (s) return imgTag(s, cls);
    return imgTag(paint.icon(name, light ? '#FFE6CC' : EDGE), cls);
  }

  // ================================================================== content lookups (names and texts always come from TW.Content)
  const content = () => TW.Content || {};
  function row(table, id) {
    if (id == null) return null;
    const Cn = content();
    try { if (typeof Cn.byId === 'function') { const r = Cn.byId(table, id); if (r) return r; } } catch (err) { /* fall through */ }
    const t = Cn[table];
    if (!t) return null;
    if (Array.isArray(t)) return t.find((r) => r && r.id === id) || null;
    return t[id] && typeof t[id] === 'object' ? t[id] : null;
  }
  const KIND_TABLE = { tarot: 'TAROTS', planet: 'PLANETS', spectral: 'SPECTRALS' };
  const C = {
    row,
    joker: (id) => row('JOKERS', id) || { id, name: titleCase(id), text: '', rarity: 'common', cost: 0 },
    consumable: (kind, id) => row(KIND_TABLE[kind] || 'TAROTS', id) || { id, kind, name: titleCase(id), text: '' },
    boss: (id) => row('BOSSES', id) || (id ? { id, name: titleCase(id), text: '' } : null),
    tag: (id) => row('TAGS', id) || (id ? { id, name: titleCase(id), text: '' } : null),
    enhancement: (id) => row('ENHANCEMENTS', id) || (id ? { id, name: titleCase(id), text: '' } : null),
    edition: (id) => row('EDITIONS', id) || (id ? { id, name: titleCase(id), text: '' } : null),
    seal: (id) => row('SEALS', id) || (id ? { id, name: titleCase(id), text: '' } : null),
    deck: (id) => row('DECKS', id) || { id, name: titleCase(id) + ' Deck', text: '' },
    stake: (id) => row('STAKES', id) || { id, name: titleCase(id), text: '' },
    voucher: (id) => row('VOUCHERS', id) || { id, name: titleCase(id), text: '' },
    pack: (id) => row('PACKS', id) || { id, name: titleCase(id), text: '' },
    hand: (id) => row('HANDS', id) || { id, name: titleCase(id), text: '' },
    blind: (kind) => row('BLINDS', kind) || { id: kind, name: { small: 'Small Blind', big: 'Big Blind', boss: 'Boss Blind' }[kind] || 'Blind' },
    rarity: (r) => { const t = content().RARITIES; return (t && t[r] && t[r].name) || titleCase(r || 'common'); },
  };
  const RANK_WORDS = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
  const SUITS = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
  const rankWord = (r) => (content().RANK_WORDS && content().RANK_WORDS[r]) || RANK_WORDS[r] || String(r);
  function suitName(s) { return (content().SUIT_NAMES && content().SUIT_NAMES[s]) || SUITS[s] || String(s); }

  // ================================================================== live region, toasts
  // #live is the one announcer: the readouts in the column are plain text (a count-up is never spoken step by step)
  let liveTimer = 0, liveQueue = [];
  const liveKey = (s) => String(s).trim().replace(/[\s.!?]+$/, '').toLowerCase();
  /** Say something politely. Messages that come within a moment of each other are said together, in order,
      so a fast result (a hand's score, then "Blind beaten") is never cut short by the next one; the same
      sentence asked for twice in that moment is said once. */
  function announce(text) {
    const live = $('#live');
    if (!live || !text) return;
    const t = String(text).trim();
    if (!t || liveQueue.some((x) => liveKey(x) === liveKey(t))) return;
    liveQueue.push(t);
    live.textContent = '';
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = liveQueue.join(' '); liveQueue = []; }, 30);
  }
  /** A short lit note at the top of the screen (bottom on a phone). kind: 'info' | 'err' | 'good'. Not scaled by game speed.
      The note is a status message, so it is said in the live region too (#toasts itself stays hidden from assistive
      tech, so nothing is heard twice). o: the time it stays (ms), or { ms, say: false } when the caller says the same
      news in its own, fuller words. */
  function toast(text, kind = 'info', o = 2800) {
    const opt = typeof o === 'number' ? { ms: o } : o || {};
    const ms = Number(opt.ms) > 0 ? Number(opt.ms) : 2800;
    const host = $('#toasts');
    if (!host || !text) return null;
    if (opt.say !== false) announce(text);
    const t = el('div', { class: 'toast ' + kind });
    t.innerHTML = `<p class="copy">${richText(text)}</p>`;
    host.append(t);
    // two at most (one over an open pack, where they would reach its head): a new one pushes the oldest out, so a
    // run of picks never stacks a wall over the table
    const most = state.screen === 'pack' ? 1 : 2;
    while (host.children.length > most) host.firstElementChild.remove();
    if (!TEST && !reduced()) t.animate([{ opacity: 0, transform: 'translateY(-6px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE.out });
    setTimeout(() => {
      if (!t.isConnected) return;
      const a = TEST || reduced() ? null : t.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-4px)' }], { duration: 160, easing: EASE.out, fill: 'forwards' });
      if (a) a.finished.then(() => t.remove(), () => t.remove()); else t.remove();
    }, ms);
    return t;
  }
  function error(msg) {
    const m = msg || "That didn't work.";
    toast(m, 'err');
    sfx('error');
  }

  // ================================================================== tooltips: hover on desktop, long-press and tap on touch, focus
  const tipProviders = [];
  /** fn(target) → html (string) or null. The selector decides which elements can show a tip. o.describe: while the tip
      shows, it is the target's accessible description (everything but the tip's name line), for a target whose label
      names it without saying what it does (a playing card: its effect and a Boss Blind's switch-off live in the tip). */
  function registerTip(selector, fn, o) { tipProviders.unshift({ selector, fn, describe: !!(o && o.describe) }); }
  // leave: the short grace before a hover tip closes, so the pointer can cross onto the tip (it stays while hovered)
  const tipState = { target: null, timer: 0, leave: 0, lastShown: 0, pinned: false, linked: null };
  const TIP_LEAVE_MS = 160;
  function tipTargetOf(node) {
    if (!node || !node.closest) return null;
    for (const p of tipProviders) { const t = node.closest(p.selector); if (t) return t; }
    return node.closest('[data-tip]');
  }
  function tipFor(target) {
    for (const p of tipProviders) {
      if (target.matches(p.selector)) { try { const h = p.fn(target); if (h) return { html: h, describe: p.describe }; } catch (err) { console.warn('Wickwager: tooltip failed', err); } }
    }
    const t = target.getAttribute('data-tip');
    return t ? { html: `<p class="t-text copy">${richText(t)}</p>`, describe: true } : null;
  }
  const tipShowing = () => { const n = $('#tip'); return !!(n && !n.hidden); };
  /** The tip's own description link comes off its target (one set by the page is never touched). */
  function unlinkTip() {
    const t = tipState.linked;
    tipState.linked = null;
    if (t && t.getAttribute('aria-describedby') === t.dataset.tipLink) t.removeAttribute('aria-describedby');
    if (t) delete t.dataset.tipLink;
  }
  function cancelTipLeave() { clearTimeout(tipState.leave); tipState.leave = 0; }
  /** The pointer left a hover tip's target or the tip itself: it closes after a short grace, unless the pointer reaches
      the tip or comes back to its target in that time (WCAG 1.4.13: the tip can be hovered). Real time in every mode. */
  function leaveTipSoon() {
    cancelTipLeave();
    tipState.leave = setTimeout(() => { tipState.leave = 0; if (!tipState.pinned) hideTip(); }, TIP_LEAVE_MS);
  }
  /** Tooltip markup: o = { name, kind, kindCls, text (content text, coloured), html (raw), lines: [text], warn, sell } */
  function tipHTML(o) {
    let h = '';
    if (o.name) h += `<b class="t-name">${esc(o.name)}</b>`;
    if (o.kind) h += `<span class="t-kind ${o.kindCls || ''}">${esc(o.kind)}</span>`;
    if (o.text) h += `<p class="t-text copy">${richText(o.text)}</p>`;
    if (o.html) h += o.html;
    (o.lines || []).filter(Boolean).forEach((l) => { h += `<p class="t-line copy">${richText(l)}</p>`; });
    if (o.warn) h += `<p class="t-warn copy">${richText(o.warn)}</p>`;
    if (o.sell != null) h += `<p class="t-sell"><span class="lbl">Sells for</span><span class="n g-money">${numHTML('$' + o.sell, 'S', 'money')}</span></p>`;
    return h;
  }
  // what a tip never covers: the Move pair over the hand, which the pointer goes to right after choosing the card whose
  // tip it opens (final pass, part 3: at 2 px the chosen card's tip lay over both arrows, and since a tip can be
  // hovered the first click on Move landed on the tip)
  const TIP_CLEAR = ['#mover'];
  function tipObstacles(target) {
    const out = [];
    TIP_CLEAR.forEach((sel) => {
      const n = $(sel);
      if (!n || n.hidden || !n.getClientRects().length || n.contains(target)) return;
      try { if (getComputedStyle(n).visibility === 'hidden') return; } catch (err) { /* shown */ }
      out.push(n.getBoundingClientRect());
    });
    return out;
  }
  /** Where a tip of tw x th at (x, y) goes to stay clear of the obstacles: further up when it hangs above its target
      (further down below it), else to the side nearest its place; where there is no room, where it was. */
  function tipClear(x, y, tw, th, above, obstacles, vw, vh) {
    const g = 4;
    for (const o of obstacles) {
      if (x >= o.right + g || x + tw <= o.left - g || y >= o.bottom + g || y + th <= o.top - g) continue;
      const vy = above ? o.top - g - th : o.bottom + g;
      if (above ? vy >= 4 : vy + th <= vh - 4) { y = vy; continue; }
      const sides = [o.left - g - tw, o.right + g].filter((v) => v >= 8 && v + tw <= vw - 8);
      if (sides.length) x = sides.reduce((a, v) => (Math.abs(v - x) < Math.abs(a - x) ? v : a));
    }
    return { x, y };
  }
  function placeTip(node, target) {
    const r = target.getBoundingClientRect();
    node.style.left = '0px'; node.style.top = '0px';
    const tw = node.offsetWidth, th = node.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    const preferAbove = r.top + r.height / 2 > vh * 0.45;
    let above = preferAbove && r.top - th - 12 > 4;
    if (!preferAbove && r.bottom + th + 12 > vh - 4 && r.top - th - 12 > 4) above = true;
    const y0 = above ? r.top - th - 10 : Math.min(r.bottom + 10, vh - th - 4);
    const x0 = clamp(r.left + r.width / 2 - tw / 2, 8, Math.max(8, vw - tw - 8));
    const { x, y } = tipClear(x0, y0, tw, th, above, tipObstacles(target), vw, vh);
    node.style.left = Math.round(x) + 'px';
    node.style.top = Math.round(Math.max(4, y)) + 'px';
    node.style.setProperty('--tip-origin', Math.round(r.left + r.width / 2 - x) + 'px ' + (above ? th + 'px' : '0px'));
  }
  function showTip(target, instant) {
    const node = $('#tip');
    if (!node || !target || !target.isConnected || isBusy()) return;
    const got = tipFor(target);
    if (!got) { hideTip(); return; }
    cancelTipLeave();
    unlinkTip();
    tipState.target = target;
    node.innerHTML = got.html;
    node.hidden = false;
    placeTip(node, target);
    if (got.describe && !target.hasAttribute('aria-describedby')) {
      const parts = [...node.children].filter((n) => !n.classList.contains('t-name'));
      parts.forEach((n, i) => { n.id = 'tipd' + i; });
      if (parts.length) {
        const ids = parts.map((n) => n.id).join(' ');
        target.setAttribute('aria-describedby', ids);
        target.dataset.tipLink = ids;
        tipState.linked = target;
      }
    }
    if (!instant && !TEST && !reduced()) node.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 140, easing: EASE.out });
    tipState.lastShown = Date.now();
  }
  function hideTip() {
    clearTimeout(tipState.timer);
    cancelTipLeave();
    unlinkTip();
    const node = $('#tip');
    tipState.target = null;
    tipState.pinned = false;
    if (node && !node.hidden) { node.hidden = true; node.innerHTML = ''; }
  }
  function scheduleTip(target) {
    clearTimeout(tipState.timer);
    const node = $('#tip');
    // once one tip is open, its neighbours open at once and without animation
    if (node && !node.hidden && Date.now() - tipState.lastShown < 600) { showTip(target, true); return; }
    tipState.timer = setTimeout(() => showTip(target, false), 380);
  }

  // ================================================================== dialogs and sheets (focus trapped, Esc closes, focus restored)
  const DLG = { stack: [], seq: 0 };
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  // ---- a dialog's opener and a sheet's item may be drawn anew while it is open (a breakpoint redraws the Shop, a
  // pack, the column and the racks): each handle keeps a selector that finds the same control again, so closing
  // still hands focus back to it and a sheet still stands by its item (final pass, part 3: focus fell to the page and
  // a Shop item's sheet jumped to the screen's centre)
  const KEY_ATTRS = ['data-action', 'data-index', 'data-uid', 'data-joker-uid', 'data-consumable-uid', 'data-shop-art', 'data-opt-art', 'data-own-voucher', 'data-wait-tag', 'data-tag-id', 'data-boss-id', 'data-rule', 'data-co', 'data-tab', 'data-page', 'data-dir', 'data-stake', 'data-value'];
  const cssq = (v) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, '\\$&'));
  /** A selector for a control that finds it again once its screen is drawn anew: its id, else its tag, first class and
      the data- attributes that say what it is (an action and its index, a card, a Joker, a Shop item, a tile ...);
      null for a node that has none of them, or for the page itself. */
  function nodeKey(n) {
    if (!n || n.nodeType !== 1 || n === document.body || n === document.documentElement || !n.getAttribute) return null;
    if (n.id) return '#' + cssq(n.id);
    const parts = KEY_ATTRS.filter((a) => n.hasAttribute(a)).map((a) => `[${a}="${cssq(n.getAttribute(a))}"]`);
    if (!parts.length) return null;
    const cls = String(n.className || '').split(/\s+/).filter(Boolean)[0];
    return String(n.tagName).toLowerCase() + (cls ? '.' + cssq(cls) : '') + parts.join('');
  }
  /** node while it shows in the page, else the shown control its key finds now that ok(candidate) accepts (the column
      draws an Options button for each layout, one hidden), else node if it is still in the page, else null. */
  function refind(node, key, ok) {
    const shown = (x) => !!x && x.isConnected && x.getClientRects().length > 0;
    if (shown(node)) return node;
    let list = [];
    if (key) { try { list = $$(key); } catch (err) { list = []; } }
    return list.find((x) => shown(x) && (!ok || ok(x))) || (node && node.isConnected ? node : null);
  }
  const onPage = (x) => !x.closest('#dialogs');
  /** A dialog body taller than its room is a stop of its own (a named region), so the keyboard can reach it and scroll
      it with the arrow and page keys: the Deck view at 200 % zoom has nothing else to focus inside, and Tab cycles only
      the dialog's own stops. Marked again whenever the body or its content changes size; a body that fits is no stop. */
  function markScroller(h) {
    const body = h.body;
    if (!body || !body.isConnected) return;
    if (body.scrollHeight > body.clientHeight + 1) {
      if (body.getAttribute('tabindex') === '0') return;
      body.setAttribute('tabindex', '0');
      body.setAttribute('role', 'region');
      if (h.labelId) body.setAttribute('aria-labelledby', h.labelId); else body.setAttribute('aria-label', h.label || 'Dialog content');
    } else if (body.hasAttribute('tabindex') && document.activeElement !== body) {
      ['tabindex', 'role', 'aria-labelledby', 'aria-label'].forEach((a) => body.removeAttribute(a));
    }
  }
  function watchScroller(h) {
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(() => markScroller(h));
    h.watch = () => { ro.disconnect(); ro.observe(h.body); if (h.body.firstElementChild) ro.observe(h.body.firstElementChild); };
    h.unwatch = () => ro.disconnect();
    h.watch();
  }
  function buildActs(actions, handle) {
    if (!actions || !actions.length) return null;
    const acts = el('div', { class: 'acts' });
    actions.forEach((a) => {
      const b = el('button', { type: 'button', class: `btn ${a.cls || 'b-cream'}${a.big ? ' big' : ''}`, 'data-action': a.action || null, 'aria-label': a.aria || null, 'aria-disabled': a.why ? 'true' : null, 'data-why': a.why || null, disabled: !!a.disabled });
      if (a.icon) b.insertAdjacentHTML('beforeend', iconHTML(a.icon, a.iconTone || 'dark'));
      b.append(el('span', { text: a.label }));
      if (a.data) Object.keys(a.data).forEach((k) => { b.dataset[k] = a.data[k]; });
      if (typeof a.onClick === 'function') b._onAct = () => a.onClick(handle, b);
      acts.append(b);
    });
    return acts;
  }
  /** A centred dialog. o: { title, tag ('ember'|'lime'|'pink'|'vio'|'cream'|'blue'|'red'), body (Node | html string),
      actions: [{ label, cls, action, onClick(handle, button), disabled, why, icon, big }], cls ('narrow'|'wide'|...),
      dismissible (default true), closeButton (default true when dismissible), onClose, focus (selector), scrim (false: no dim) }
      Returns a handle { el, wrap, body, close(), setBody(content) }. */
  function dialog(o = {}) {
    hideTip();
    const id = 'dlg' + ++DLG.seq;
    const wrap = el('div', { class: 'overlay' + (o.scrim === false ? ' clear' : '') + (o.wrapCls ? ' ' + o.wrapCls : '') });
    const box = el('section', { class: `panel dlg-frame dlg ${o.cls || ''}`, role: o.role || 'dialog', 'aria-modal': 'true', 'aria-labelledby': o.title ? id : null, 'aria-label': o.title ? null : o.label || null });
    const handle = { el: box, wrap, id, dismissible: o.dismissible !== false, onClose: o.onClose, returnFocus: document.activeElement, returnKey: nodeKey(document.activeElement), closing: false };
    if (o.title) box.append(el('div', { class: 'p-head' }, el('h2', { class: `tag t-${o.tag || 'ember'}`, id, text: o.title })));
    const body = el('div', { class: 'dlg-body' });
    if (o.body instanceof Node) body.append(o.body); else if (o.body != null) body.innerHTML = String(o.body);
    box.append(body);
    handle.body = body;
    const acts = buildActs(o.actions, handle);
    if (acts) box.append(acts);
    if (handle.dismissible && o.closeButton !== false) {
      const x = el('button', { type: 'button', class: 'btn b-ghost x-close', 'aria-label': 'Close' });
      x.innerHTML = iconHTML('close', 'light');
      x._onAct = () => closeDialog(handle);
      box.append(x);
    }
    wrap.append(box);
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap && handle.dismissible) { e.preventDefault(); closeDialog(handle); } });
    $('#dialogs').append(wrap);
    DLG.stack.push(handle);
    handle.close = (v) => closeDialog(handle, v);
    handle.setBody = (c) => { body.replaceChildren(); if (c instanceof Node) body.append(c); else body.innerHTML = String(c); if (handle.watch) handle.watch(); };
    handle.labelId = o.title ? id : null;
    handle.label = o.label || null;
    watchScroller(handle);
    anim(wrap, [{ opacity: 0 }, { opacity: 1 }], { d: 200, raw: true, always: true });
    anim(box, [{ transform: `translateY(${10 * PX()}px) scale(.96)`, opacity: 0 }, { transform: `translateY(${10 * PX()}px) scale(.96)`, opacity: 1, offset: 0.05 }, { transform: 'none', opacity: 1 }], { d: 520, raw: true, e: EASE.spring });
    focusIn(handle, o.focus);
    return handle;
  }
  /** A sheet: anchored next to its item on desktop, a bottom sheet on a phone. Same options as dialog(), plus anchor.
      An item's sheet reads first and acts second: focus lands on its title, never on Sell, Use or Buy, so the Enter
      a player meant for the table can never sell, use or buy what they only opened to read (o.focus overrides).
      handle.reanchor(node) follows the item when it moves (a Joker moved left or right). */
  function sheet(o = {}) {
    hideTip();
    const id = 'dlg' + ++DLG.seq;
    const wrap = el('div', { class: 'overlay sheet-wrap' });
    const box = el('section', { class: `panel dlg-frame sheet ${o.cls || ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id });
    const handle = { el: box, wrap, id, dismissible: o.dismissible !== false, onClose: o.onClose, returnFocus: document.activeElement, returnKey: nodeKey(document.activeElement), anchor: o.anchor || null, anchorKey: nodeKey(o.anchor) };
    box.append(el('h2', { class: 's-name', id, text: o.title || '', tabindex: '-1' }));
    if (o.kind) box.append(el('p', { class: 's-kind ' + (o.kindCls || ''), text: o.kind }));
    const body = el('div', { class: 'sheet-body' });
    if (o.body instanceof Node) body.append(o.body); else if (o.body != null) body.innerHTML = String(o.body);
    box.append(body);
    handle.body = body;
    const acts = buildActs(o.actions, handle);
    if (acts) box.append(acts);
    const x = el('button', { type: 'button', class: 'btn b-ghost x-close', 'aria-label': 'Close' });
    x.innerHTML = iconHTML('close', 'light');
    x._onAct = () => closeDialog(handle);
    box.append(x);
    wrap.append(box);
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) { e.preventDefault(); closeDialog(handle); } });
    $('#dialogs').append(wrap);
    DLG.stack.push(handle);
    handle.close = (v) => closeDialog(handle, v);
    handle.setBody = (c) => { body.replaceChildren(); if (c instanceof Node) body.append(c); else body.innerHTML = String(c); };
    handle.reanchor = (node) => { if (node && node.isConnected) { handle.anchor = node; handle.returnFocus = node; handle.anchorKey = handle.returnKey = nodeKey(node); } placeSheet(handle); };
    handle.place = () => placeSheet(handle);
    placeSheet(handle);
    const phone = MQ.phone.matches;
    anim(box, phone
      ? [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }]
      : [{ transform: `translateY(${-4 * PX()}px) scale(.96)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { d: phone ? 420 : 260, raw: true, e: phone ? 'cubic-bezier(0.32, 0.72, 0, 1)' : EASE.out });
    focusIn(handle, o.focus || '.s-name');
    return handle;
  }
  function placeSheet(h) {
    if (!h || !h.el || !h.el.isConnected) return;
    // the item drawn anew since the sheet opened (a breakpoint's redraw): the sheet follows the item drawn in its place
    const now = refind(h.anchor, h.anchorKey, onPage);
    if (now) h.anchor = now;
    if (MQ.phone.matches || !h.anchor || !h.anchor.isConnected) {
      if (!MQ.phone.matches) { h.el.style.left = Math.round((innerWidth - h.el.offsetWidth) / 2) + 'px'; h.el.style.top = Math.round((innerHeight - h.el.offsetHeight) / 2) + 'px'; }
      else { h.el.style.left = ''; h.el.style.top = ''; }
      return;
    }
    const r = h.anchor.getBoundingClientRect(), w = h.el.offsetWidth, ht = h.el.offsetHeight, p = PX();
    const below = r.bottom + 4 * p + ht <= innerHeight - 8;
    const top = below ? r.bottom + 4 * p : Math.max(8, r.top - 4 * p - ht);
    const left = clamp(r.left + r.width / 2 - w / 2, 8, innerWidth - w - 8);
    h.el.style.left = Math.round(left) + 'px';
    h.el.style.top = Math.round(top) + 'px';
    h.el.style.setProperty('--sheet-origin', `${Math.round(r.left + r.width / 2 - left)}px ${below ? '0' : '100%'}`);
  }
  /** Move focus for everyone; draw the ring only for keyboard players (it is noise after a click or a tap). Focus the
      game places (a dialog opening, a card in a played one's place) opens no tooltip: a tip answers the player moving
      focus (Tab, the arrows), never pops up over what just opened. */
  let placing = false;
  function focusQuiet(node) {
    if (!node || !node.isConnected) return;
    placing = true;
    try { node.focus({ preventScroll: true, focusVisible: lastInput === 'key' }); } catch (err) { node.focus(); } finally { placing = false; }
  }
  /** Focus lands once the dialog's opener has filled it in (Options marks the speed in use after it is built). */
  function focusIn(handle, sel) {
    const box = handle.el;
    setTimeout(() => {
      if (!box.isConnected) return;
      const target = (sel && box.querySelector(sel)) || box.querySelector('.acts ' + FOCUSABLE) || box.querySelector(FOCUSABLE);
      if (target) focusQuiet(target);
    }, 0);
  }
  function closeDialog(handle, value) {
    const h = handle || DLG.stack[DLG.stack.length - 1];
    if (!h || h.closing) return;
    h.closing = true;
    const i = DLG.stack.indexOf(h);
    if (i >= 0) DLG.stack.splice(i, 1);
    const kill = () => { if (h.wrap.parentNode) h.wrap.remove(); };
    const a = anim(h.wrap, [{ opacity: 1 }, { opacity: 0 }], { d: 140, raw: true, always: true, fill: 'forwards' });
    if (a) a.finished.then(kill, kill); else kill();
    if (h.unwatch) h.unwatch();
    if (typeof h.onClose === 'function') { try { h.onClose(value); } catch (err) { console.warn('Wickwager: dialog onClose failed', err); } }
    // focus goes back to the control that opened the dialog (or the one drawn in its place while the dialog was open): on
    // the page, or in the dialog still open under it (Options, Overview or How to play opened from Pause hand focus
    // back to their button in Pause); a dialog left open whose opener has gone takes focus itself, so it never drops
    // to the page behind. It is focus the game places: it opens no tooltip, so the next Esc opens Pause again (final
    // pass, part 3: the restored card's tip popped and took that Esc)
    const top = topDialog();
    const back = refind(h.returnFocus, h.returnKey, (x) => !h.wrap.contains(x) && (top ? top.el.contains(x) : onPage(x)));
    if (back && typeof back.focus === 'function' && (!top || top.el.contains(back))) focusQuiet(back);
    else if (top && !top.el.contains(document.activeElement)) focusIn(top);
  }
  function closeAllDialogs() {
    DLG.stack.splice(0).reverse().forEach((h) => { h.closing = true; if (h.unwatch) h.unwatch(); if (h.wrap.parentNode) h.wrap.remove(); });
  }
  const topDialog = () => DLG.stack[DLG.stack.length - 1] || null;
  function trapTab(e, box) {
    const nodes = $$(FOCUSABLE, box).filter((n) => n.offsetParent !== null);
    if (!nodes.length) { e.preventDefault(); return; }
    const first = nodes[0], last = nodes[nodes.length - 1];
    const i = nodes.indexOf(document.activeElement);
    // focus on something outside the cycle (a sheet's title, or the page behind): Tab enters at the first stop,
    // Shift+Tab at the last, so focus never leaves the modal
    if (i < 0) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
    if (e.shiftKey && i === 0) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && i === nodes.length - 1) { e.preventDefault(); first.focus(); }
  }
  // named overlays (Overview, options, pause, deck, how to play, records, collection): 30-screens.js registers the real ones
  const OVERLAYS = {};
  function registerOverlay(name, fn) { OVERLAYS[name] = fn; }
  function openOverlay(name, props) {
    const fn = OVERLAYS[name];
    if (typeof fn !== 'function') { toast('That panel is not built yet.', 'info'); return null; }
    if (isBusy()) return null;
    sfx('button');
    try { return fn(props || {}); } catch (err) { console.error('Wickwager: overlay failed', name, err); return null; }
  }

  // ================================================================== audio glue (TW.Audio is optional)
  function audioCall(fn, ...args) {
    const A = TW.Audio;
    if (!A || typeof A[fn] !== 'function') return undefined;
    try { return A[fn](...args); } catch (err) { return undefined; }
  }
  /** sfx names: select deselect deal play chip mult xmult again total beaten lose win collect buy sell reroll pack pick
      use skip boss tag error button shuffle discard money flip. opts.index (or step) climbs the ladder through a
      payout, opts.intensity sizes the big moments, opts.pan places a sound, opts.delay schedules it on the audio clock.
      Every request is logged (the last 400, in test mode too, where nothing sounds) so scripted checks can hear it. */
  const SFX = { log: [], at: Object.create(null), queue: [], timer: 0 };
  // sounds are handed to the synth in a task of their own, right after the one that asked: building a voice costs
  // about a millisecond, and a deal asks for eight while the screen it deals on is still being built
  function flushSfx() {
    SFX.timer = 0;
    const q = SFX.queue.splice(0);
    const A = TW.Audio;
    if (!A) return;
    q.forEach(([name, opts]) => { if (typeof A.sfx === 'function') audioCall('sfx', name, opts); else audioCall('play', name, opts); });
  }
  function sfx(name, opts) {
    const t = Date.now();
    SFX.at[name] = t;
    SFX.log.push({ name, t, screen: state.screen, index: opts && (opts.index != null ? opts.index : opts.step) });
    if (SFX.log.length > 400) SFX.log.splice(0, SFX.log.length - 400);
    if (TEST || !TW.Audio) return;
    SFX.queue.push([name, opts]);
    if (!SFX.timer) SFX.timer = setTimeout(flushSfx, 0);
  }
  /** Milliseconds since a sound was last asked for (Infinity when never). */
  const sfxAge = (name) => (SFX.at[name] ? Date.now() - SFX.at[name] : Infinity);
  // music follows the screen: the table loop on the menus and at the table, the Shop loop in the Shop and an open
  // pack, silence once a run is lost (the candle has just gone out), the table loop again for the win
  const MUSIC_FOR = { shop: 'shop', pack: 'shop', gameover: null, boot: null, missing: null };
  let gestured = false;
  let musicNow = null;
  const musicFor = (scr) => (!scr ? null : Object.prototype.hasOwnProperty.call(MUSIC_FOR, scr) ? MUSIC_FOR[scr] : 'table');
  /** The loop the current screen wants: 'table', 'shop' or null (off: test mode, music at 0, Game Over). */
  function musicWanted() {
    if (TEST || !(settings.music > 0)) return null;
    return musicFor(state.screen);
  }
  /** Start, switch (crossfade) or stop the music for the current screen. Before the first gesture TW.Audio
      remembers the wish and starts it with the context. */
  function syncMusic() {
    const want = musicWanted();
    if (want === musicNow) return;
    musicNow = want;
    audioCall('music', want || false);
  }
  function onGesture() {
    if (gestured) return;
    gestured = true;
    audioCall('init');
    applyAudio();
    musicNow = undefined; // re-assert the wish once the context exists
    syncMusic();
  }
  function applyAudio() {
    const A = TW.Audio;
    audioCall('setMuted', TEST || !!settings.muted);
    // TW.Audio v1 takes setVolume(kind, v); an older synth only setVolume(v) and setMusicVolume(v)
    if (A && A.version >= 1 && Array.isArray(A.NAMES)) {
      audioCall('setVolume', 'sfx', TEST ? 0 : settings.sfx / 100);
      audioCall('setVolume', 'music', TEST ? 0 : settings.music / 100);
    } else {
      audioCall('setVolume', TEST ? 0 : settings.sfx / 100);
      audioCall('setMusicVolume', TEST ? 0 : settings.music / 100);
    }
  }

  // ================================================================== engine glue, runs and records
  // unlocked: names unlocked since the end screen last read them (it says them aloud with the result)
  // busy: the flows that hold input (a payout, a discard, a pick), counted; holds: animations input waits for (a deal)
  const state = { run: null, screen: null, props: null, records: null, busy: 0, holds: 0, booted: false, unlocked: [] };
  const isBusy = () => state.busy > 0 || state.holds > 0;
  // what waits for input to be free again (the table's buttons, switched off while a deal or a payout held input):
  // told once the last busy flow and the last held animation have ended, in a microtask, so a flow that frees input
  // and holds it again in the same task (a discard frees it, then deals new cards) tells nobody until the deal lands
  // (final pass, part 3: nothing switched Rank and Suit back on once a deal's hold ended)
  const IDLE = { fns: new Set(), owed: false, queued: false };
  function tellIdle() {
    IDLE.queued = false;
    if (isBusy() || !IDLE.owed) return;
    IDLE.owed = false;
    IDLE.fns.forEach((fn) => { try { fn(); } catch (err) { console.warn('Wickwager: an idle listener failed', err); } });
  }
  const showBusy = () => {
    const busy = isBusy();
    document.body.dataset.busy = busy ? '1' : '0';
    if (busy) { IDLE.owed = true; return; }
    if (IDLE.owed && !IDLE.queued) { IDLE.queued = true; Promise.resolve().then(tellIdle); }
  };
  /** fn() whenever input is free again after being held (SPEC 6.2: busy back to '0'); returns a function that stops it. */
  function onIdle(fn) { if (typeof fn === 'function') IDLE.fns.add(fn); return () => IDLE.fns.delete(fn); }
  function setBusy(on) {
    state.busy = Math.max(0, state.busy + (on ? 1 : -1));
    showBusy();
  }
  function clearBusy() { state.busy = 0; showBusy(); }
  /** Input waits while these Web Animations run (SPEC 6.2: busy is '1' during animations), e.g. cards being dealt:
      from now until the last one has finished or been cancelled, and never past maxMs (a held or stalled one). A
      flow's clearBusy() does not cut it short. */
  function busyWhile(anims, maxMs) {
    const list = (anims || []).filter((a) => a && a.finished && typeof a.finished.then === 'function');
    if (!list.length) return;
    let left = list.length, done = false;
    const release = () => { if (done) return; done = true; clearTimeout(guard); state.holds = Math.max(0, state.holds - 1); showBusy(); };
    const guard = setTimeout(release, Math.max(0, Number(maxMs) || 0) + 500);
    state.holds += 1;
    showBusy();
    const one = () => { left -= 1; if (left <= 0) release(); };
    list.forEach((a) => a.finished.then(one, one));
  }
  const engine = () => TW.Engine || null;
  /** An engine action on the current run. Failed results toast their sentence; good ones save the run and records. */
  function call(name, ...args) {
    const E = engine();
    if (!E || typeof E[name] !== 'function' || !state.run) { error("That didn't work."); return { ok: false, error: "That didn't work." }; }
    let res;
    try { res = E[name](state.run, ...args); } catch (err) { console.warn('Wickwager: engine call failed', name, err); res = { ok: false, error: "That didn't work." }; }
    if (!res || res.ok === false) {
      const msg = (res && res.error) || "That didn't work.";
      error(msg);
      return res && typeof res === 'object' ? res : { ok: false, error: msg };
    }
    afterAction();
    return res;
  }
  /** The same, then the screen follows the run's phase (or the current screen updates). */
  function act(name, ...args) {
    const res = call(name, ...args);
    if (res && res.ok) refresh();
    return res;
  }
  /** A pure engine query on the current run (null when there is no run or no such query). */
  function q(name, ...args) {
    const E = engine();
    if (!E || typeof E[name] !== 'function' || !state.run) return null;
    try { return E[name](state.run, ...args); } catch (err) { return null; }
  }
  function afterAction() { updateRecords(); saveRun(); warmRun(state.run); }
  function saveRun() {
    const E = engine(), run = state.run;
    if (!run || !E) return;
    if (run.phase === 'gameover' && run.recorded) { store.remove('run'); return; }
    try { store.set('run', E.serialize(run)); } catch (err) { /* keep playing */ }
  }
  function loadSavedRun() {
    const E = engine();
    const raw = store.get('run');
    if (!E || !raw) return null;
    try { return E.deserialize(raw); } catch (err) { return null; }
  }
  const hasSavedRun = () => { const r = loadSavedRun(); return !!(r && r.phase !== 'gameover'); };
  function loadRecords() {
    const E = engine();
    let raw = null;
    try { raw = JSON.parse(store.get('records') || 'null'); } catch (err) { raw = null; }
    if (E && typeof E.normalizeRecords === 'function') return E.normalizeRecords(raw);
    return raw || { version: 2, runs: 0, wins: 0, bestAnte: 0, bestHand: null, unlockedDecks: [], unlockedStakes: [], wonOn: [], history: [], discovered: {} };
  }
  function saveRecords() { try { store.set('records', JSON.stringify(state.records)); } catch (err) { /* memory copy */ } }
  /** Merge the run into the records; final defaults to true at Game Over and You win!. Toasts new unlocks. */
  function updateRecords(final) {
    const E = engine(), run = state.run;
    if (!E || !run || typeof E.applyRunToRecords !== 'function') return [];
    const fin = final != null ? !!final : run.phase === 'gameover' || run.phase === 'win';
    try {
      const out = E.applyRunToRecords(state.records, run, { final: fin, now: new Date().toISOString() });
      if (out && out.records) { state.records = out.records; saveRecords(); }
      const un = (out && out.unlocked) || [];
      // each is a sentence of its own when said (several run together in #live); once the run has ended the end screen
      // says them all in its line, after the result, so their toasts stay quiet (final pass, part 3: a win said each
      // unlock twice, the first time ahead of the hand's score and "You win!")
      const ended = run.phase === 'gameover' || run.phase === 'win';
      un.forEach((u) => toast(`Unlocked: ${u.name}.`, 'good', { ms: 3600, say: !ended }));
      if (un.length) { sfx('tag'); state.unlocked = state.unlocked.concat(un.map((u) => u.name)); }
      return un;
    } catch (err) { return []; }
  }
  /** Start a run (seeded by opts.seed, then ?seed=, else random) and show the Blind select. */
  function newRun(opts = {}) {
    const E = engine();
    if (!E) { error('The rules engine did not load.'); return null; }
    const seed = cleanSeed(opts.seed) || URL_SEED || undefined;
    let run = null;
    try { run = E.newRun({ deckId: opts.deckId || 'firstissue', stake: opts.stake || 'sunny', seed }); } catch (err) { run = null; }
    if (!run) { error('The run could not start.'); return null; }
    state.run = run;
    // the end screen lists what this run unlocked: names a run left unread (one abandoned) were said when they came
    state.unlocked = [];
    saveRun();
    updateRecords(false);
    warmRun(run);
    if (opts.show !== false) show('blind-select');
    return run;
  }
  function continueRun() {
    const r = loadSavedRun();
    if (!r) { error('There is no saved run to continue.'); return null; }
    state.run = r;
    warmRun(r);
    refresh();
    return r;
  }
  /** Leave the run: removes the save (a finished run stays in the records). */
  function endRun() { state.run = null; store.remove('run'); }
  /** The column's "Blind n" (SPEC 6.1 item 5: the Blinds played or skipped, +1). Before a Blind (the Blind select, the
      Blind in play, and a pack a Tag opened at the Blind select, which comes before the next Blind) it counts the
      Blind to come; after one (the cash-out, the Shop and a pack bought there) the Blind just beaten. */
  function roundNumber(run = state.run) {
    if (!run) return 1;
    const n = Object.keys(run.blindStatus || {}).length;
    const before = run.phase === 'blind-select' || run.phase === 'play' || (run.phase === 'pack' && !!run.pack && run.pack.returnTo === 'blind-select');
    return before ? n + 1 : Math.max(1, n);
  }

  // ================================================================== the router
  const SCREENS = {};
  const PHASE_SCREENS = { 'blind-select': 'blind-select', play: 'play', cashout: 'cashout', shop: 'shop', pack: 'pack', win: 'win', gameover: 'gameover' };
  const screenForPhase = (phase) => PHASE_SCREENS[phase] || 'title';
  /** def: { mount(root, props), unmount(nextName), update(), key(e) → true when handled,
      shell: true to live in the table (root is then the playfield's main area under the racks, emptied first),
      keepMain: true to keep what the previous shell screen left there (the cash-out sits over the hand) } */
  function register(name, def) { if (name && def && typeof def.mount === 'function') SCREENS[name] = def; }
  // ---- route transitions (Lit motion): the view that leaves is laid over the one that arrives as a lifeless copy
  // and fades out fast, while the new view makes its own entrance on the springs (the table's column and racks
  // slide in, the Blinds rise, the Shop deals in). Exit 180 ms, ease-out; reduced motion keeps the fade; test
  // mode has none. A copy drops the Web Animations of its original, so what they show now is written onto it.
  function ghostOf(src, cls) {
    const g = src.cloneNode(true);
    try {
      const anims = document.getAnimations ? document.getAnimations() : [];
      if (anims.length) {
        const from = [src, ...src.querySelectorAll('*')], to = [g, ...g.querySelectorAll('*')];
        const at = new Map(from.map((n, i) => [n, i]));
        anims.forEach((a) => {
          // the copy runs its own CSS loops and transitions; only a Web Animation's held state is written onto it
          if ((typeof CSSAnimation === 'function' && a instanceof CSSAnimation) || (typeof CSSTransition === 'function' && a instanceof CSSTransition)) return;
          const t = a.effect && a.effect.target;
          if (!t || a.effect.pseudoElement || !at.has(t)) return;
          const n = to[at.get(t)], cs = getComputedStyle(t);
          if (n && n.style) { n.style.opacity = cs.opacity; n.style.transform = cs.transform; n.style.translate = cs.translate; }
        });
      }
    } catch (err) { /* the copy shows the resting state */ }
    // the copy fades out in 160 to 180 ms: its cards' light (the wash, the sweep and the Edition's moving light, each a
    // blended layer clipped to the card's outline) would only make it slower to paint. Painted in full, a table's copy
    // and the Shop arriving under it made one frame of 50 to 100 ms (final pass, part 4, P6)
    g.querySelectorAll('.wash, .sheen, .ed-fx').forEach((n) => n.remove());
    g.removeAttribute('id');
    g.className = `${src.className || ''} ${cls}`.trim();
    g.setAttribute('aria-hidden', 'true');
    g.inert = true;
    g.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    g.querySelectorAll('[data-action], [data-uid], [data-joker-uid], [data-consumable-uid], [tabindex]').forEach((n) => {
      ['data-action', 'data-uid', 'data-joker-uid', 'data-consumable-uid', 'tabindex'].forEach((k) => n.removeAttribute(k));
    });
    return g;
  }
  function fadeGhost(g, ms = 180) {
    const a = anim(g, [{ opacity: 1 }, { opacity: 0 }], { d: ms, raw: true, always: true, e: EASE.out, fill: 'forwards' });
    const kill = () => { if (g.parentNode) g.remove(); };
    if (a) a.finished.then(kill, kill); else kill();
  }
  /** The whole view (menu to table, table to menu, menu to menu). */
  function ghostApp(app) {
    if (TEST || !app || !app.firstElementChild) return;
    const g = ghostOf(app, 'route-ghost');
    app.after(g);
    fadeGhost(g, 180);
  }
  /** The table's main area only (Blind select to play, the Shop to a pack ...): the column and racks stay. */
  function ghostMain(main) {
    if (TEST || !main || !main.firstElementChild || !main.isConnected) return;
    const r = main.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const g = ghostOf(main, 'route-ghost-main');
    g.style.cssText += `;left:${Math.round(r.left)}px;top:${Math.round(r.top)}px;width:${Math.round(r.width)}px;height:${Math.round(r.height)}px`;
    document.body.append(g);
    fadeGhost(g, 160);
  }
  function show(name, props = {}) {
    const def = SCREENS[name] || SCREENS.missing;
    hideTip();
    closeAllDialogs();
    const prevName = state.screen, prev = prevName && SCREENS[prevName];
    if (prev && typeof prev.unmount === 'function') { try { prev.unmount(name); } catch (err) { console.warn('Wickwager: unmount failed', prevName, err); } }
    const app = $('#app');
    let mountRoot = app;
    const shell = TW.UI.shell;
    const moving = !!prevName && prevName !== name && prevName !== 'boot' && !props.instant;
    if (def.shell && shell && typeof shell.ensure === 'function') {
      const stays = !!(prev && prev.shell && shell.el && shell.el().table && shell.el().table.isConnected);
      if (moving && !stays) ghostApp(app);
      else if (moving && !def.keepMain) ghostMain(shell.el().main);
      mountRoot = shell.ensure(name);
      if (!def.keepMain) mountRoot.replaceChildren();
      mountRoot.dataset.screen = name;
    } else {
      if (moving) ghostApp(app);
      if (shell && typeof shell.remove === 'function') shell.remove();
      app.replaceChildren();
    }
    state.screen = SCREENS[name] ? name : 'missing';
    state.props = props;
    document.body.dataset.screen = state.screen;
    try { def.mount(mountRoot, props || {}); } catch (err) { console.error('Wickwager: screen failed', name, err); }
    syncMusic();
    return state.screen;
  }
  function update() {
    const def = SCREENS[state.screen];
    if (def && typeof def.update === 'function') { try { def.update(); } catch (err) { console.error('Wickwager: update failed', state.screen, err); } }
    else if (def) show(state.screen, state.props);
  }
  /** Show the screen the run's phase asks for, or update the current one when it already matches. */
  function refresh() {
    const want = state.run ? screenForPhase(state.run.phase) : 'title';
    if (want !== state.screen) show(want); else update();
  }
  const inRun = () => !!state.run && ['blind-select', 'play', 'cashout', 'shop', 'pack'].includes(state.screen);

  // ================================================================== input: actions, keyboard, pointer
  const ACTIONS = {};
  /** A handler for buttons carrying data-action="name": fn(button, event). Later registrations replace earlier ones. */
  function registerAction(name, fn) { ACTIONS[name] = fn; }
  const QUIET = new Set(['play-hand', 'discard', 'buy', 'sell-joker', 'sell-consumable', 'use-consumable', 'collect', 'reroll', 'start-blind', 'skip-blind', 'sort-rank', 'sort-suit', 'move-card']);
  const drag = { suppressUntil: 0 };
  function onClick(e) {
    const t = e.target;
    if (!t || !t.closest) return;
    if (Date.now() < drag.suppressUntil) { e.preventDefault(); e.stopPropagation(); return; }
    // a tap on something that only explains itself (a Tag, a Boss emblem) pins its tooltip; a second tap hides it
    const tipOnly = lastPointer === 'touch' && tipTargetOf(t);
    if (tipOnly && !tipOnly.closest('button, [data-action]')) {
      if (tipState.target === tipOnly) hideTip(); else { showTip(tipOnly, true); tipState.pinned = true; }
      return;
    }
    const b = t.closest('button, [data-action]');
    if (!b) return;
    if (b._onAct) {
      if (b.disabled) return;
      if (b.getAttribute('aria-disabled') === 'true') { error(b.dataset.why || 'Not available right now.'); return; }
      sfx('button');
      b._onAct(e);
      return;
    }
    const name = b.dataset && b.dataset.action;
    if (!name || !ACTIONS[name]) return;
    if (b.disabled) return;
    if (b.getAttribute('aria-disabled') === 'true') { e.preventDefault(); error(b.dataset.why || 'Not available right now.'); return; }
    if (isBusy() && !b.closest('#dialogs')) { e.preventDefault(); return; }
    if (!QUIET.has(name)) sfx('button');
    try { ACTIONS[name](b, e); } catch (err) { console.error('Wickwager: action failed', name, err); }
  }
  function onKey(e) {
    if (e.defaultPrevented) return;
    onGesture();
    // a tooltip that shows is dismissed on its own first (WCAG 1.4.13): this Esc opens no Pause, closes no dialog and
    // moves no focus; the next Esc does what Esc does
    if (e.key === 'Escape' && tipShowing()) { e.preventDefault(); hideTip(); return; }
    const top = topDialog();
    if (top) {
      if (e.key === 'Escape') { e.preventDefault(); if (top.dismissible) closeDialog(top); return; }
      if (e.key === 'Tab') { trapTab(e, top.el); return; }
      if (typeof top.onKey === 'function') top.onKey(e);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tgt = e.target;
    if (tgt && tgt.closest && tgt.closest('input, textarea, select, [contenteditable="true"]')) return;
    const def = SCREENS[state.screen];
    if (def && typeof def.key === 'function') { let used = false; try { used = def.key(e) === true; } catch (err) { console.warn('Wickwager: key failed', err); } if (used) { e.preventDefault(); return; } }
    if (isBusy()) return;
    if (e.key === 'Escape' && inRun()) { e.preventDefault(); hideTip(); openOverlay('pause'); return; }
    if ((e.key === 'i' || e.key === 'I') && inRun() && shortcuts()) { e.preventDefault(); openOverlay('run-info'); }
  }
  // long press on touch opens the tooltip (and the click that follows it is swallowed)
  const press = { timer: 0, x: 0, y: 0, target: null };
  // a press that started on a tip: its click is swallowed (once, and only soon after; the next press elsewhere clears it)
  const tipEat = { on: false, until: 0 };
  // null until the first key or pointer press: a screen that loads with the page leaves focus alone (P5), so a keyboard
  // player's first Tab lands on its first control with the ring showing, never past it
  let lastInput = null;
  let lastPointer = 'mouse';
  function bindGlobal() {
    document.addEventListener('keydown', () => { lastInput = 'key'; tipEat.on = false; }, true);
    document.addEventListener('pointerdown', (e) => { lastInput = 'pointer'; lastPointer = e.pointerType || 'mouse'; }, true);
    // a control the keyboard focuses inside a row that scrolls inside itself (the Shop's row, a pack's options, the
    // Joker rack, the run setup's Deck and Stake) comes whole into view, its ring included: those rows keep scroll
    // padding for it. The browser left a control the row had partly in view where it was, its ring cut by up to 33 px
    // (final pass, part 4, P3). Nearest, so a control already whole in view never moves; a press never scrolls.
    document.addEventListener('focusin', (e) => {
      const n = e.target;
      if (lastInput !== 'key' || !n || n === document.body || typeof n.scrollIntoView !== 'function') return;
      for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (!/(auto|scroll)/.test(s.overflowX + ' ' + s.overflowY)) continue;
        if (p.scrollWidth <= p.clientWidth + 1 && p.scrollHeight <= p.clientHeight + 1) continue;
        try { n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (err) { /* an old engine scrolled it already */ }
        return;
      }
    });
    // a press that starts on a tip is spent closing it: the click that ends it is swallowed here, before any control
    // hears it, so a tip over a control (a pinned consumable's tip over Play hand on a landscape phone, a card's over
    // the Move pair) never presses that control (final pass, part 3: the tap went through and played the hand)
    document.addEventListener('click', (e) => {
      if (!tipEat.on) return;
      tipEat.on = false;
      if (Date.now() > tipEat.until) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', (e) => {
      onGesture();
      // a press on a tip, pinned (a long-press opened it) or hover, closes it and does nothing else
      if (onTip(e.target)) { hideTip(); tipEat.on = true; tipEat.until = Date.now() + 1500; }
      else {
        tipEat.on = false;
        if (tipState.pinned && !tipTargetOf(e.target)) hideTip();
      }
      if (e.pointerType === 'touch') {
        const t = tipTargetOf(e.target);
        clearTimeout(press.timer);
        if (!t) return;
        press.target = t; press.x = e.clientX; press.y = e.clientY;
        press.timer = setTimeout(() => {
          if (!press.target || isBusy() || TW.UI.dragging) return;
          showTip(press.target, true);
          tipState.pinned = true;
          drag.suppressUntil = Date.now() + 450;
          if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) { /* optional */ } }
        }, 450);
      }
    }, true);
    const cancelPress = () => { clearTimeout(press.timer); press.target = null; };
    document.addEventListener('pointermove', (e) => { if (press.target && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) cancelPress(); }, { passive: true });
    document.addEventListener('pointerup', cancelPress, true);
    document.addEventListener('pointercancel', cancelPress, true);
    document.addEventListener('contextmenu', (e) => { if (tipTargetOf(e.target) && e.pointerType !== 'mouse') e.preventDefault(); });
    // a hover tip can be hovered (WCAG 1.4.13): the pointer may cross the gap onto it and rest there; it closes a moment
    // after the pointer has left both the tip and its target
    const onTip = (n) => { const tp = $('#tip'); return !!(n && tp && !tp.hidden && tp.contains(n)); };
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch' || !MQ.fine.matches || tipState.pinned || TW.UI.dragging) return;
      if (onTip(e.target)) { cancelTipLeave(); return; }
      const t = tipTargetOf(e.target);
      if (!t) return;
      if (t === tipState.target) { cancelTipLeave(); return; }
      scheduleTip(t);
    });
    document.addEventListener('pointerout', (e) => {
      if (e.pointerType === 'touch' || tipState.pinned) return;
      const rel = e.relatedTarget;
      if (onTip(e.target)) {
        if (onTip(rel) || (rel && tipState.target && tipState.target.contains(rel))) return;
        leaveTipSoon();
        return;
      }
      const t = tipTargetOf(e.target);
      if (!t || (rel && t.contains(rel))) return;
      clearTimeout(tipState.timer);
      if (tipState.target === t && !onTip(rel)) leaveTipSoon();
    });
    document.addEventListener('focusin', (e) => {
      const t = tipTargetOf(e.target);
      if (!t || TW.UI.dragging || placing) return;
      let visible = false;
      try { visible = t.matches(':focus-visible'); } catch (err) { visible = false; }
      if (visible) showTip(t, true);
    });
    document.addEventListener('focusout', (e) => { const t = tipTargetOf(e.target); if (t && tipState.target === t && !tipState.pinned) hideTip(); });
    // a scroll closes a hover tip; a tip that keyboard focus opened follows its target (the arrow keys walking a grid
    // that scrolls, the Deck view's cards or the Collection's) while it stays in view
    window.addEventListener('scroll', () => {
      if (tipState.pinned) return;
      const t = tipState.target, node = $('#tip');
      if (t && node && !node.hidden && t.isConnected && document.activeElement === t) {
        const r = t.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) { placeTip(node, t); return; }
      }
      hideTip();
    }, true);
    // a dialog that sits by the layout (a sheet by its item, the cash-out over the field) is placed again whenever
    // the window changes size or crosses a breakpoint (a phone turned, a window snapped narrow)
    const replace = () => { DLG.stack.forEach((h) => { if (typeof h.place === 'function') { try { h.place(); } catch (err) { /* placed on the next change */ } } }); };
    let rz = 0;
    window.addEventListener('resize', () => { hideTip(); replace(); clearTimeout(rz); rz = setTimeout(replace, 140); });
    onBreakpoint(() => setTimeout(replace, 0));
    const onReduce = () => { const was = root.classList.contains('reduce-motion'); if (settings.motion === 'auto') applySettings(); if (!was && reduced()) settleMotion(); };
    if (MQ.reduce.addEventListener) MQ.reduce.addEventListener('change', onReduce);
    document.addEventListener('visibilitychange', () => { if (document.hidden && state.run && !isBusy()) saveRun(); });
  }

  // ================================================================== stub screens and overlays (20-shop.js and 30-screens.js replace these)
  // STUB: the title. 30-screens.js registers the real one.
  register('title', {
    mount(app) {
      const saved = hasSavedRun();
      const box = el('section', { class: 'panel dlg-frame stub-panel', 'aria-labelledby': 'stubTitle' });
      box.innerHTML = `<h1 class="stub-title" id="stubTitle">Wickwager</h1><p class="copy stub-copy">Play poker hands, beat every Blind, clear all eight Antes.</p>`;
      const acts = el('div', { class: 'stub-acts' });
      if (saved) acts.append(el('button', { type: 'button', class: 'btn b-cream big', 'data-action': 'continue', text: 'Continue run' }));
      acts.append(el('button', { type: 'button', class: 'btn b-ember big', 'data-action': 'new-run', text: 'New run' }));
      box.append(acts);
      app.append(el('div', { class: 'stub-wrap' }, box));
      const first = box.querySelector('.btn');
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 0);
    },
  });
  // STUB: the Shop. 20-shop.js registers the real one (shell: true keeps the left column and the racks).
  register('shop', {
    shell: true,
    mount(main) {
      const box = el('section', { class: 'panel stub-panel stub-in', 'aria-label': 'Shop' });
      box.innerHTML = `<div class="p-head"><h2 class="tag t-pink">Shop</h2></div><p class="copy stub-copy">The Shop opens here.</p>`;
      box.append(el('div', { class: 'stub-acts' }, el('button', { type: 'button', class: 'btn b-ember big', 'data-action': 'leave-shop', text: 'Next Blind' })));
      main.append(el('div', { class: 'stub-wrap in-shell' }, box));
    },
  });
  // STUB: an open Booster Pack. 20-shop.js registers the real one.
  register('pack', {
    shell: true,
    mount(main) {
      const run = state.run, p = run && run.pack;
      const box = el('section', { class: 'panel stub-panel stub-in', 'aria-label': 'Booster Pack' });
      box.innerHTML = `<div class="p-head"><h2 class="tag t-vio">${esc(p ? C.pack(p.id).name : 'Booster Pack')}</h2></div><p class="copy stub-copy">The pack opens here.</p>`;
      box.append(el('div', { class: 'stub-acts' }, el('button', { type: 'button', class: 'btn b-cream big', 'data-action': 'pack-skip', text: 'Skip' })));
      main.append(el('div', { class: 'stub-wrap in-shell' }, box));
    },
  });
  // STUB: Game Over and You win!. 30-screens.js registers the real ones.
  function endStub(app, won) {
    const run = state.run, st = q('stats') || {};
    const box = el('section', { class: 'panel dlg-frame stub-panel', 'aria-labelledby': 'endTitle' });
    const rows = [
      ['Ante reached', st.ante], ['Brightest hand', st.bestHand ? `${st.bestHand.name} ${fmt(st.bestHand.score)}` : '-'],
      ['Hands played', st.handsPlayed], ['Blinds cleared', st.blindsCleared], ['Seed', st.seed || (run && run.seed)],
    ];
    box.innerHTML = `<div class="p-head"><h1 class="tag ${won ? 't-lime' : 't-pink'}" id="endTitle">${won ? 'You win!' : 'Game Over'}</h1></div>
      <ul class="stub-stats">${rows.map(([k, v]) => `<li><span class="lbl">${esc(k)}</span><span class="copy">${esc(v == null ? '-' : v)}</span></li>`).join('')}</ul>`;
    const acts = el('div', { class: 'stub-acts' });
    if (won) acts.append(el('button', { type: 'button', class: 'btn b-cream big', 'data-action': 'endless', text: 'Endless mode' }));
    acts.append(el('button', { type: 'button', class: 'btn b-ember big', 'data-action': 'new-run', text: 'New run' }));
    acts.append(el('button', { type: 'button', class: 'btn b-ghost', 'data-action': 'to-title', text: 'Return to title' }));
    box.append(acts);
    app.append(el('div', { class: 'stub-wrap' }, box));
    announce(won ? 'You win!' : 'Game Over.');
  }
  register('gameover', { mount(app) { endStub(app, false); } });
  register('win', { mount(app) { endStub(app, true); } });
  register('missing', { mount(app) { app.append(el('div', { class: 'stub-wrap' }, el('section', { class: 'panel dlg-frame stub-panel' }, el('p', { class: 'copy', text: 'That screen is not built yet.' }), el('button', { type: 'button', class: 'btn b-ember', 'data-action': 'to-title', text: 'Return to title' })))); } });

  // STUB overlays: 30-screens.js registers the real Options, Overview, Pause and Deck.
  registerOverlay('options', () => {
    const body = el('div', { class: 'stub-opts' });
    const seg = (label, key, opts) => {
      const row = el('div', { class: 'opt-row' }, el('span', { class: 'lbl', text: label }));
      const g = el('div', { class: 'seg', role: 'group', 'aria-label': label });
      opts.forEach(([v, name]) => {
        const b = el('button', { type: 'button', class: 'btn b-cream', 'aria-pressed': String(settings[key] === v), text: name });
        b._onAct = () => { setSetting(key, v); $$('button', g).forEach((x, i) => x.setAttribute('aria-pressed', String(opts[i][0] === settings[key]))); };
        g.append(b);
      });
      row.append(g);
      return row;
    };
    body.append(seg('Game speed', 'speed', SPEEDS.map((s) => [s.value, s.name])), seg('Motion', 'motion', [['auto', 'Auto'], ['reduced', 'Reduced'], ['full', 'Full']]), seg('Screen shake', 'shake', [[true, 'On'], [false, 'Off']]));
    return dialog({ title: 'Options', tag: 'cream', body, cls: 'narrow' });
  });
  registerOverlay('run-info', () => {
    const rows = q('handTable') || [];
    const body = el('div', { class: 'stub-hands' });
    body.innerHTML = `<table class="hand-table"><thead><tr><th class="lbl">Hand</th><th class="lbl">Lv</th><th class="lbl">Chips</th><th class="lbl">Mult</th><th class="lbl">Played</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="copy">${esc(r.name)}</td><td>${num(String(r.level), 'S', 'cream')}</td><td>${num(fmt(r.chips), 'S', 'chips')}</td><td>${num(fmtMult(r.mult), 'S', 'mult')}</td><td>${num(String(r.plays), 'S', 'cream')}</td></tr>`).join('')}</tbody></table><p class="copy k-dim stub-seed">Seed ${esc(state.run ? state.run.seed : '')}</p>`;
    return dialog({ title: 'Overview', tag: 'cream', body });
  });
  registerOverlay('deck', () => {
    const view = q('deckView') || { cards: [], remaining: [] };
    const left = new Set(view.remaining || []);
    const order = (content().SUIT_ORDER || ['S', 'H', 'C', 'D']);
    const rows = order.map((su) => {
      const cs = view.cards.filter((c) => c.suit === su);
      const n = cs.filter((c) => left.has(c.uid)).length;
      return `<li class="opt-row"><span class="copy">${esc(suitName(su))}</span><span class="n">${numHTML(`${n}/${cs.length}`, 'S', 'cream')}</span></li>`;
    }).join('');
    return dialog({ title: 'Deck', tag: 'cream', cls: 'narrow', body: `<ul class="stub-stats">${rows}</ul><p class="copy k-dim stub-seed">${esc(`${left.size} of ${view.cards.length} cards left`)}</p>` });
  });
  registerOverlay('pause', () => dialog({
    title: 'Paused', tag: 'cream', cls: 'narrow', body: '',
    actions: [
      { label: 'Resume', cls: 'b-ember', onClick: (h) => h.close() },
      { label: 'Options', cls: 'b-cream', onClick: () => openOverlay('options') },
      { label: 'Save and quit', cls: 'b-cream', onClick: () => { saveRun(); state.run = null; const note = saveQuitNote(); toast(note.text, note.saved ? 'info' : 'err'); show('title'); } },
    ],
  }));

  registerAction('new-run', () => {
    if (state.run && (state.run.phase === 'gameover' || state.run.phase === 'win')) { if (!state.run.recorded) updateRecords(true); endRun(); }
    newRun({});
  });
  registerAction('continue', () => continueRun());
  registerAction('to-title', () => { if (state.run && (state.run.phase === 'gameover' || state.run.phase === 'win')) { if (!state.run.recorded) updateRecords(true); endRun(); } else saveRun(); state.run = null; show('title'); });
  registerAction('leave-shop', () => { if (act('leaveShop').ok) announce('On to the next Blind.'); });
  registerAction('pack-skip', () => { if (act('packSkip').ok) announce('Pack skipped.'); });
  registerAction('endless', () => act('goEndless'));
  registerAction('open-run-info', () => openOverlay('run-info'));
  registerAction('open-options', () => openOverlay('options'));
  registerAction('open-pause', () => openOverlay('pause'));
  registerAction('open-deck', () => openOverlay('deck'));
  registerAction('close-overlay', () => closeDialog());

  // ================================================================== the public API
  const UI = (TW.UI = TW.UI || {});
  Object.assign(UI, {
    // environment
    TEST, URL_SEED, URL_SPEED, URL_SCREEN, PX, MQ, onBreakpoint, $, $$,
    get GAME_SPEED() { return gameSpeed(); },
    // helpers
    esc, el, fmt, fmtMult, cash, plural, titleCase, listJoin, richText, clamp, cleanSeed, later, rng,
    // storage and settings
    store, saveQuitNote, SPEEDS, DEFAULT_SETTINGS, settings: () => Object.assign({}, settings), setSetting, onSettings: (fn) => { settingsListeners.add(fn); return () => settingsListeners.delete(fn); },
    // motion
    dur, reduced, motionOK, shakeOK, EASE, springCurve, anim, transient, punch, flare, Timeline, afterLayout,
    // the pixel painter, numbers and sprites
    paint, num, numHTML, numSprite, numWidth, fitSize, boxWidth, sprite, spriteHTML, cardSpriteId, iconHTML, artSprite, warm, warmRun, warmArt, warmNextShop, warmOrder,
    warmed: () => ({ done: WARM.done, left: WARM.queue.length }),
    // the layers, Edition light, Seal badges and name plates every card face shares
    layersHTML, edFxHTML, sealBadgeHTML, plateHTML, replate, LIGHT_HTML,
    // content lookups
    C, rankWord, suitName,
    // feedback and sound
    announce, toast, error, sfx, sfxAge, onGesture, syncMusic, musicWanted, musicFor, music: () => musicNow || null,
    sfxLog: (since = 0) => SFX.log.filter((e) => e.t >= since).map((e) => Object.assign({}, e)),
    takeUnlocked: () => state.unlocked.splice(0),
    // tooltips, dialogs, sheets, overlays
    registerTip, tipHTML, showTip, hideTip, dialog, sheet, closeDialog, closeAllDialogs, topDialog, registerOverlay, openOverlay,
    // engine, runs, records
    engine, call, act, q, saveRun, loadSavedRun, hasSavedRun, newRun, continueRun, endRun, updateRecords,
    records: () => state.records, saveRecords, run: () => state.run, setRun: (r) => { state.run = r; saveRun(); }, roundNumber,
    // router and input
    register, show, refresh, update, screen: () => state.screen, screenForPhase, PHASE_SCREENS, registerAction, actions: ACTIONS,
    hasScreen: (name) => !!SCREENS[name], screens: () => Object.keys(SCREENS), hasOverlay: (name) => typeof OVERLAYS[name] === 'function',
    isBusy, setBusy, clearBusy, busyWhile, onIdle, drag, inRun, focusQuiet, lastInput: () => lastInput, shortcuts, tipShowing,
    // test hooks for the payout
    checkHold, hold: HOLD,
  });
  if (!('shell' in UI)) UI.shell = null; // 10-table.js installs the table shell
  if (!('dragging' in UI)) UI.dragging = false;

  // ================================================================== boot
  function fatal(message) {
    const app = $('#app');
    if (!app) return;
    app.replaceChildren(el('div', { class: 'stub-wrap' }, el('section', { class: 'panel dlg-frame stub-panel' }, el('h1', { class: 'stub-title', text: 'Wickwager' }), el('p', { class: 'copy stub-copy', text: message }))));
  }
  function routeFromUrl() {
    const sc = URL_SCREEN;
    if (!sc || sc === 'title') { show('title'); return; }
    if (['blind-select', 'play', 'cashout', 'shop', 'pack'].includes(sc)) {
      const run = newRun({ show: false });
      if (!run) { show('title'); return; }
      if (sc === 'play') { call('startBlind'); }
      show(sc === 'cashout' ? 'play' : sc);
      return;
    }
    if (SCREENS[sc]) { if (['gameover', 'win'].includes(sc)) newRun({ show: false }); show(sc); return; }
    show('title');
  }
  function boot() {
    if (state.booted) return;
    state.booted = true;
    if (TEST) root.classList.add('test-mode');
    applySettings();
    installChrome();
    bindGlobal();
    state.records = loadRecords();
    const fontsReady = (async () => {
      try { await Promise.all([document.fonts.load('20px "Jersey 10"'), document.fonts.load('16px "Tiny5"'), document.fonts.load('500 16px "Bricolage Grotesque"')]); await document.fonts.ready; } catch (err) { /* fallbacks hold the layout */ }
      root.dataset.fonts = document.fonts && document.fonts.check('20px "Jersey 10"') ? 'ready' : 'fallback';
    })();
    UI.fontsReady = fontsReady;
    if (UI.room && typeof UI.room.build === 'function') { try { UI.room.build($('#scene')); } catch (err) { console.error('Wickwager: the room failed', err); } }
    // test hooks: TW.app (SPEC 6.5) and window.__wick for scripted checks
    TW.app = {
      getRun: () => state.run,
      getSettings: () => Object.assign({}, settings),
      getRecords: () => state.records,
      newRun: (o) => newRun(o || {}),
      screen: () => state.screen,
    };
    window.__wick = {
      run: () => state.run,
      act: (name, ...args) => act(name, ...args),
      state: () => {
        const r = state.run, b = r && r.blind;
        const tbl = UI.table || {};
        return {
          screen: state.screen, phase: r ? r.phase : null, busy: isBusy(), ante: r ? r.ante : 0, blindIndex: r ? r.blindIndex : 0,
          money: r ? r.money : 0, score: b ? b.score : 0, target: b ? b.target : 0, handsLeft: b ? b.handsLeft : 0, discardsLeft: b ? b.discardsLeft : 0,
          hand: b ? b.hand.slice() : [], selected: typeof tbl.selected === 'function' ? tbl.selected() : [], jokers: r ? r.jokers.map((j) => j.id) : [],
          dialogs: DLG.stack.length, fonts: root.dataset.fonts || '',
        };
      },
      screen: () => state.screen,
      newRun: (o) => newRun(o || {}),
      settings: () => Object.assign({}, settings),
      /** The sounds asked for since `since` (ms epoch), oldest first, and the music the screen wants. */
      sfx: (since = 0) => SFX.log.filter((e) => e.t >= since).map((e) => Object.assign({}, e)),
      music: () => (settings.music > 0 ? musicFor(state.screen) : null), // what would play (test mode plays nothing)
      live: () => { const n = $('#live'); return n ? n.textContent : ''; },
      /** Hold the next payout at a named moment ('peak'); resolves when it gets there. */
      hold: (point = 'peak') => new Promise((res) => { HOLD.point = point; HOLD.waiters.push(res); }),
      release: () => { const tl = HOLD.timeline; HOLD.point = null; HOLD.timeline = null; if (tl) tl.resume(); },
    };
    if (!engine()) { fatal('The rules engine did not load, so the cards cannot be dealt. Reload the page to try again.'); return; }
    routeFromUrl();
    // while the title is up: the 52 faces (in the inks Options asks for) and the run's Deck back through TW.Art's
    // own idle warmer, a saved run's sprites, then everything a run can meet
    const saved = loadSavedRun();
    warmArt(settings.fourColor ? 'card4:' : 'card:');
    warmArt(['back:' + ((state.run && state.run.deckId) || (saved && saved.deckId) || 'firstissue')]);
    warmRun(saved);
    warmAll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else setTimeout(boot, 0);
})();
