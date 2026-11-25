/* Wickwager menus and end screens (ARCH.md section 5, SPEC.md section 6.1): the title with its wordmark, run
   setup (Deck and Stake), Options, Pause, How to play, Overview, the deck view, Records, the Collection,
   Game Over, You win! with Endless mode, and the credits. Ember Lit throughout: the candlelit room behind,
   the painted pixel chrome of 00-core.js, labels and numbers in the pixel faces, long copy in Bricolage.

   Registers, replacing the stubs in 00-core.js:
     screens   'title', 'setup', 'records', 'collection', 'gameover', 'win'
     overlays  'options', 'pause', 'run-info', 'deck', 'help', 'credits'
   Every sprite goes through art(), which is TW.UI.spriteHTML: TW.Art's sprite (TW.Art.url), or a Lit card
   frame with the item's name in its plate when the sprite or TW.Art is missing. Every item name and text comes
   from TW.Content or the engine at run time; this file names no item.
   The wordmark and the end headlines are painted here from our own 7 x 11 pixel letters (the digit face's
   construction, redrawn twice as fine with EPX), lit by a candle that stands in for the I of WICK.
   Exposes TW.UI.menus = { art, rt, word, startStats, muted, setMuted } for the other screens and the checks. */
(() => {
  'use strict';
  const TW = (globalThis.TW = globalThis.TW || {});
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const UI = TW.UI;
  if (!UI) return;
  const { $, $$, el, esc, fmt, num, numHTML, anim, EASE, C } = UI;
  const PX = () => UI.PX();
  const E = () => UI.engine();
  const R = () => UI.run();
  const Cn = () => TW.Content || {};
  const phone = () => UI.MQ.phone.matches;
  const icon = (n, tone = 'light') => UI.iconHTML(n, tone);
  const later = (ms, fn) => setTimeout(fn, ms);
  const SUIT_ORDER = () => (Array.isArray(Cn().SUIT_ORDER) ? Cn().SUIT_ORDER : ['S', 'H', 'C', 'D']);

  /** A content table as an array (TW.Content tables are arrays that also answer by id). */
  function list(table) {
    const t = Cn()[table];
    if (Array.isArray(t)) return t.filter((r) => r && r.id);
    if (t && typeof t === 'object') return Object.values(t).filter((r) => r && typeof r === 'object' && r.id);
    return [];
  }
  function recs() {
    const r = UI.records();
    if (r) return r;
    const e = E();
    return e && typeof e.defaultRecords === 'function' ? e.defaultRecords()
      : { runs: 0, wins: 0, bestAnte: 0, bestHand: null, unlockedDecks: [], unlockedStakes: [], wonOn: [], history: [], discovered: {} };
  }
  const discovered = (kind) => { const d = recs().discovered || {}; return new Set(Array.isArray(d[kind]) ? d[kind] : []); };

  // ================================================================== art: one door to TW.Art, with a Lit placeholder
  /** Every sprite on these screens: TW.Art's art through TW.UI.spriteHTML (which calls TW.Art.url), or a blank
      Lit card frame with the item's name in its plate when the sprite or TW.Art is missing. */
  function art(id, o = {}) {
    try { return UI.spriteHTML(id, o); } catch (err) { return `<span class="ph ph-card" style="--w:41;--h:55" aria-hidden="true"><span class="ph-plate">${esc(o.name || '')}</span></span>`; }
  }
  const artOf = (id) => { try { return UI.artSprite(id); } catch (err) { return null; } };
  // the light layers every card carries on the table (a warm wash and the sweep / glint), so menu cards are lit alike
  const PLATE_KINDS = ['joker', 'tarot', 'planet', 'spectral', 'voucher'];
  // the layers, Edition light, Seal badges and name plates are 00-core.js's shared helpers, as on the table
  const layers = (inner) => UI.layersHTML(inner, null);
  /** A playing card's face with its Enhancement, Seal and Edition (TW.Art.card composes it; Colour-coded suits
      follow Options through UI.cardSpriteId). */
  function cardFace(c) {
    const id = UI.cardSpriteId(c);
    return { id, html: art(id, { kind: 'card', card: c, cls: 'face' }) + UI.sealBadgeHTML(c.seal) + UI.edFxHTML(c.edition, id) };
  }
  // Joker and consumable names sit on the plate drawn into the sprite (the full name is always in the label)
  const plateHTML = (name) => UI.plateHTML(name);
  /** The Blind candle (wax from TW.Art or Lit's painted wax, a three-frame flame and its bloom), as on the table. */
  function candleHTML(kind, out) {
    const tall = kind === 'big';
    const a = artOf('blind:' + (tall ? 'big' : 'small'));
    const wax = a ? UI.paint.imgTag(a) : UI.paint.imgTag(UI.paint.candle(tall));
    return `<div class="candle${out ? ' is-out' : ''}" aria-hidden="true"><div class="wick"><span class="bloom"></span><span class="flame"></span></div>${wax}</div>`;
  }
  function emblemHTML(bossId, name) {
    return `<div class="emblem" data-boss-id="${esc(bossId)}" tabindex="0" role="img" aria-label="${esc(name || '')}"><span class="bloom" aria-hidden="true"></span>${art('boss:' + bossId, { kind: 'boss', name })}</div>`;
  }

  // ================================================================== copy: keyword colours
  const KW = { joker: 'k-joker', tarot: 'k-tarot', planet: 'k-planet', spectral: 'k-spectral', boss: 'k-boss', tag: 'k-tag', voucher: 'k-voucher', stake: 'k-stake', enh: 'k-enh', edition: 'k-edition', seal: 'k-seal', pack: 'k-pack', blind: 'k-blind', name: 'k-name', money: 'k-money', chips: 'k-chips', mult: 'k-mult' };
  /** Mark a run of copy as a keyword: mark('joker', 'Jokers'). */
  const mark = (kind, text) => `[[${kind}|${String(text == null ? '' : text).replace(/[[\]|]/g, '')}]]`;
  /** Copy with marked keywords in their colours; the rest goes through richText (Chips blue, Mult red, $ yellow). */
  function rt(s) {
    return String(s == null ? '' : s).split(/(\[\[[a-z]+\|[^\]]*\]\])/g).map((part) => {
      const m = /^\[\[([a-z]+)\|([^\]]*)\]\]$/.exec(part);
      return m ? `<span class="${KW[m[1]] || 'k-name'}">${esc(m[2])}</span>` : UI.richText(part);
    }).join('');
  }
  const btn = (label, action, cls = 'b-cream', ic = null, extra = {}) => {
    const b = el('button', Object.assign({ type: 'button', class: `btn ${cls}`, 'data-action': action }, extra));
    if (ic) b.insertAdjacentHTML('beforeend', icon(ic, /b-(ember|cream|yellow|pink)/.test(cls) ? 'dark' : 'light'));
    b.append(el('span', { text: label }));
    return b;
  };
  const fmtDate = (iso) => { try { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch (err) { return ''; } };

  // ================================================================== pixel lettering: the wordmark and the end headlines
  // Our own letters on the digit face's 7 x 11 grid (two-pixel strokes, one corner pixel dropped), widths vary.
  const GLYPHS = {
    A: ['.#####.', '#######', '##...##', '##...##', '##...##', '#######', '#######', '##...##', '##...##', '##...##', '##...##'],
    C: ['.#####.', '#######', '##...##', '##.....', '##.....', '##.....', '##.....', '##.....', '##...##', '#######', '.#####.'],
    E: ['######', '######', '##....', '##....', '#####.', '#####.', '##....', '##....', '##....', '######', '######'],
    G: ['.#####.', '#######', '##...##', '##.....', '##.....', '##.####', '##.####', '##...##', '##...##', '#######', '.#####.'],
    I: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '######', '######'],
    K: ['##...##', '##...##', '##..##.', '##.##..', '####...', '###....', '####...', '##.##..', '##..##.', '##...##', '##...##'],
    M: ['##...##', '###.###', '#######', '##.#.##', '##.#.##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##'],
    N: ['##...##', '###..##', '###..##', '####.##', '##.#.##', '##.####', '##..###', '##..###', '##...##', '##...##', '##...##'],
    O: ['.#####.', '#######', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '#######', '.#####.'],
    R: ['######.', '#######', '##...##', '##...##', '##...##', '#######', '######.', '##.##..', '##..##.', '##...##', '##...##'],
    U: ['##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '#######', '.#####.'],
    V: ['##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '.##.##.', '.##.##.', '..###..', '...#...'],
    W: ['##...##', '##...##', '##...##', '##...##', '##.#.##', '##.#.##', '##.#.##', '##.#.##', '##.#.##', '#######', '.##.##.'],
    Y: ['##..##', '##..##', '##..##', '##..##', '.####.', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
    '!': ['##', '##', '##', '##', '##', '##', '##', '..', '..', '##', '##'],
  };
  /** EPX on a boolean mask: twice the size, diagonals stepped smooth (the digit face's XL and XXL recipe). */
  function epxMask(m) {
    const h = m.length, w = m[0].length;
    const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? m[y][x] : false);
    const out = Array.from({ length: h * 2 }, () => new Array(w * 2).fill(false));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), L = at(x - 1, y), D = at(x, y + 1);
      out[y * 2][x * 2] = L === A && L !== D && A !== B ? A : P;
      out[y * 2][x * 2 + 1] = A === B && A !== L && B !== D ? B : P;
      out[y * 2 + 1][x * 2] = D === L && D !== B && L !== A ? L : P;
      out[y * 2 + 1][x * 2 + 1] = B === D && B !== A && D !== L ? D : P;
    }
    return out;
  }
  /** EPX on a coloured bitmap (the candle and its flame): equal colours count as the same edge. */
  function epxPx(src) {
    const P = UI.paint.Px, b = new P(src.w * 2, src.h * 2);
    const at = (x, y) => src.get(x, y) || null;
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const p = at(x, y), A = at(x, y - 1), B = at(x + 1, y), L = at(x - 1, y), D = at(x, y + 1);
      b.set(x * 2, y * 2, L === A && L !== D && A !== B ? A : p);
      b.set(x * 2 + 1, y * 2, A === B && A !== L && B !== D ? B : p);
      b.set(x * 2, y * 2 + 1, D === L && D !== B && L !== A ? L : p);
      b.set(x * 2 + 1, y * 2 + 1, B === D && B !== A && D !== L ? D : p);
    }
    return b;
  }
  const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, t) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
  // letter styles: fill shades top to bottom, a lit and a shaded bevel, then a tinted rim (never a hard black drop)
  const INK = {
    ember: { ramp: ['#FFF8EC', '#FFE9C6', '#FFD09A', '#FFAE66', '#FF8C3E'], hi: '#FFFFFF', lo: '#C2501C', rim: '#4E1408', far: '#7A2440', glow: '255, 132, 52' },
    pink: { ramp: ['#FFF0F6', '#FFC8E0', '#FF96C4', '#FF66A8', '#E8408A'], hi: '#FFFFFF', lo: '#8E1850', rim: '#3E0824', far: '#5E0F38', glow: '255, 76, 155' },
    lime: { ramp: ['#FBFFEA', '#EAFFB8', '#CDF57E', '#ABE64C', '#86CC30'], hi: '#FFFFFF', lo: '#3F7317', rim: '#1C3A0A', far: '#2F5A12', glow: '170, 240, 90' },
  };
  /** Letters further from the candle sit a little deeper in the room: their ramp leans towards the dark. */
  function inkAt(st, d) {
    if (!d) return st;
    const t = Math.min(0.34, d * 0.045);
    return { ramp: st.ramp.map((c) => mix(c, st.far, t)), hi: mix(st.hi, st.ramp[1], Math.min(1, d * 0.12)), lo: mix(st.lo, st.far, t), rim: st.rim };
  }
  /** One letter at XL (14 x 22 art px) or XXL (28 x 44), bevelled by light from the left or the right. */
  function letterPx(ch, size, st, light) {
    let m = (GLYPHS[ch] || GLYPHS.I).map((r) => [...r].map((c) => c === '#'));
    const steps = size === 'XXL' ? 2 : size === 'XL' ? 1 : 0;
    for (let i = 0; i < steps; i++) m = epxMask(m);
    const h = m.length, w = m[0].length, n = st.ramp.length;
    const b = new UI.paint.Px(w + 2, h + 2);
    const on = (x, y) => y >= 0 && y < h && x >= 0 && x < w && m[y][x];
    const fromRight = light === 'right';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!m[y][x]) continue;
      let c = st.ramp[Math.min(n - 1, Math.floor(((y + 0.5) / h) * n))];
      const lit = !on(x, y - 1) || (fromRight ? !on(x + 1, y) : !on(x - 1, y));
      const shade = !on(x, y + 1) || (fromRight ? !on(x - 1, y) : !on(x + 1, y));
      if (lit) c = st.hi; else if (shade) c = st.lo;
      b.set(x + 1, y + 1, c);
    }
    b.outline(st.rim, true);
    return b;
  }
  /** The candle that stands in for the I of WICK: Lit's cream wax with a pink drip on a pink dish (13 x 22 at XL). */
  function candlePx(size) {
    const pk = UI.paint.R.pink;
    const P = UI.paint.Px, b = new P(13, 22);
    const col = ['#FFFCF5', '#FFF3E0', '#FFF3E0', '#FBE7CB', '#FBE7CB', '#F2D3AE', '#DDB08A'];
    for (let y = 0; y < 19; y++) for (let i = 0; i < 7; i++) b.set(3 + i, y, col[i]);
    b.rect(3, 0, 7, 1, pk[7]); b.rect(3, 1, 2, 3, pk[7]); b.set(3, 4, pk[6]); b.rect(7, 1, 2, 2, pk[7]); b.set(8, 3, pk[6]);
    [[1, 11, pk[7]], [0, 12, pk[5]], [2, 10, pk[2]]].forEach(([x0, x1, c], j) => { for (let x = x0; x <= x1; x++) b.set(x, 19 + j, c); });
    b.set(1, 19, pk[8]); b.set(2, 19, pk[8]);
    const big = size === 'XXL' ? epxPx(b) : b;
    const out = new P(big.w + 2, big.h + 2).blit(big, 1, 1);
    out.outline('#2B1220');
    return out;
  }
  /** Lit's three-frame flame strip, each frame redrawn twice as fine for the XXL wordmark. */
  function flamePx(size) {
    const strip = UI.paint.flame().bmp;
    if (size !== 'XXL') return strip;
    const P = UI.paint.Px, out = new P(42, 20);
    for (let f = 0; f < 3; f++) {
      const fr = new P(7, 10);
      for (let y = 0; y < 10; y++) for (let x = 0; x < 7; x++) { const c = strip.get(f * 7 + x, y); if (c) fr.set(x, y, c); }
      out.blit(epxPx(fr), f * 14, 0);
    }
    return out;
  }
  /** A word in our letters, as a row of lit sprites (hidden from screen readers; the heading carries the text).
      o: { size 'XL'|'XXL', ink 'ember'|'pink'|'lime', candleAt (index of a letter the candle replaces), glow } */
  function word(text, o = {}) {
    const size = o.size || 'XL', inkName = INK[o.ink] ? o.ink : 'ember', st = INK[inkName], px = PX();
    const wrap = el('span', { class: `pw pw-${size.toLowerCase()} pw-${inkName}${o.cls ? ' ' + o.cls : ''}`, 'aria-hidden': 'true' });
    wrap.pwWord = { text, o }; // relight() draws it again for a new pixel size
    [...String(text)].forEach((ch, i) => {
      if (ch === ' ') { wrap.append(el('span', { class: 'pw-sp' })); return; }
      if (o.candleAt === i) { wrap.append(candleEl(size)); return; }
      const d = o.candleAt != null ? Math.abs(i - o.candleAt) : 0;
      const light = o.candleAt != null && i < o.candleAt ? 'right' : 'left';
      const s = UI.paint.painted(`pw:${inkName}:${size}:${ch}:${light}:${d}`, () => letterPx(ch, size, inkAt(st, d), light));
      const span = el('span', { class: 'pw-l', 'data-d': String(d) });
      if (o.glow !== false && !UI.TEST) {
        try { span.append(UI.paint.glowCanvas(s, px, st.glow, { r1: 2, r2: size === 'XXL' ? 13 : 8, a1: 0.42, a2: Math.max(0.18, 0.5 - d * 0.04) })); } catch (err) { /* the glow is decoration */ }
      }
      span.insertAdjacentHTML('beforeend', UI.paint.imgTag(s, 'pw-img'));
      wrap.append(span);
    });
    return wrap;
  }
  function candleEl(size) {
    const s = UI.paint.painted(`pw:candle:${size}`, () => candlePx(size));
    const f = UI.paint.painted(`pw:flame:${size}`, () => flamePx(size));
    const big = size === 'XXL';
    // the flame's wick pixel sits on the candle's top rim: left/top offsets in art px from the candle's corner
    const span = el('span', { class: 'pw-l pw-candle', 'data-d': '0', style: `--fw:${big ? 14 : 7};--fh:${big ? 20 : 10};--fx:${big ? 7 : 4};--fy:${big ? 19 : 9}` });
    span.innerHTML = `<span class="pw-bloom"></span><span class="pw-flame" style="background-image:url(${f.url})"></span>${UI.paint.imgTag(s, 'pw-img')}`;
    return span;
  }
  /** The wordmark: WICKWAGER with a candle for the I, lit from the candle outwards. */
  const wordmarkSize = () => (innerWidth >= 1000 && !phone() ? 'XXL' : 'XL');
  function wordmark() { return word('WICKWAGER', { size: wordmarkSize(), ink: 'ember', candleAt: 1, cls: 'wm-word', wm: true }); }
  /** The one authored moment of the title: the flame catches, then the letters light from the candle outwards. */
  function igniteWordmark(wm) {
    if (!wm || !UI.motionOK()) return;
    const flame = $('.pw-flame', wm), bloom = $('.pw-bloom', wm);
    if (flame) anim(flame, [{ opacity: 0, transform: 'translateY(calc(2 * var(--px))) scale(.4)' }, { opacity: 1, transform: 'none' }], { d: 620, delay: 140, e: EASE.bouncy, fill: 'backwards', raw: true });
    if (bloom) anim(bloom, [{ opacity: 0 }, { opacity: 1 }], { d: 900, delay: 160, e: EASE.out, fill: 'backwards', raw: true });
    $$('.pw-l:not(.pw-candle)', wm).forEach((n) => {
      const d = Number(n.dataset.d) || 0;
      anim(n, [{ filter: 'brightness(.32) saturate(.7)' }, { filter: 'brightness(1.22) saturate(1.05)', offset: 0.55 }, { filter: 'brightness(1)' }], { d: 760, delay: 260 + d * 85, e: EASE.out, fill: 'backwards', raw: true });
    });
    if (flame && UI.table && typeof UI.table.burst === 'function') {
      later(220, () => { if (!flame.isConnected) return; const r = flame.getBoundingClientRect(); UI.table.burst(r.left + r.width / 2, r.top + r.height * 0.6, ['#FFD29C', '#FFA458', '#FF7A2B', '#FFF0D8'], 14, 0.7, [1, 2], 0.9); });
    }
  }

  // ================================================================== shared menu state
  const S = { deckId: null, stake: null, seed: '', helpPage: 0, coTab: 'jokers', abandon: false, erase: false, pause: null, setupLoaded: false };
  function loadSetup() {
    if (S.setupLoaded) return;
    S.setupLoaded = true;
    try { const v = JSON.parse(UI.store.get('ember:setup') || 'null'); if (v && typeof v === 'object') { S.deckId = v.deckId || null; S.stake = v.stake || null; } } catch (err) { /* defaults */ }
  }
  function saveSetup() { try { UI.store.set('ember:setup', JSON.stringify({ deckId: S.deckId, stake: S.stake })); } catch (err) { /* memory only */ } }
  const decks = () => list('DECKS');
  const stakes = () => list('STAKES');
  const deckOpen = (id) => { const u = recs().unlockedDecks; return Array.isArray(u) && u.length ? u.includes(id) : id === (decks()[0] || {}).id; };
  const stakeOpen = (id) => { const u = recs().unlockedStakes; return Array.isArray(u) && u.length ? u.includes(id) : id === (stakes()[0] || {}).id; };
  /** What a Deck on a Stake starts with, read from a fresh engine run (so Deck and Stake mods are never re-derived here). */
  const STATS = new Map();
  function startStats(deckId, stake) {
    const k = `${deckId}|${stake}`;
    if (STATS.has(k)) return STATS.get(k);
    let out = null;
    try {
      const r = E() && E().newRun({ deckId, stake, seed: 'PREVIEW2' });
      if (r) out = { hands: r.hands, discards: r.discards, handSize: r.handSize, money: r.money, jokerSlots: r.jokerSlots, consumableSlots: r.consumableSlots, jokers: (r.jokers || []).length, consumables: (r.consumables || []).length, cards: (r.cards || []).length };
    } catch (err) { out = null; }
    STATS.set(k, out);
    return out;
  }
  /** The seed field (title and setup share it): A to Z and 2 to 9, upper case, at most 16. */
  function seedField(id, onEnter) {
    const wrap = el('div', { class: 'field' });
    const inp = el('input', { type: 'text', id, class: 'seed-in', maxlength: '16', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'Leave empty for a random run', 'data-field': 'seed' });
    inp.value = S.seed;
    inp.addEventListener('input', () => { S.seed = UI.cleanSeed(inp.value); });
    inp.addEventListener('blur', () => { inp.value = S.seed; });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); S.seed = UI.cleanSeed(inp.value); if (onEnter) onEnter(); } });
    wrap.append(el('label', { class: 'lbl f-lbl', for: id, text: 'Seed (optional)' }), inp);
    return wrap;
  }
  const placePool = (node) => { if (node && UI.room && typeof UI.room.placePool === 'function') { try { UI.room.placePool(node.getBoundingClientRect()); } catch (err) { /* light is decoration */ } } };
  /** Panels rise into place on the spring, a beat apart (shown once per visit, never on a key press). */
  function riseIn(nodes, base = 80) {
    nodes.filter(Boolean).forEach((n, i) => anim(n, [{ opacity: 0, transform: `translateY(${10 * PX()}px)` }, { opacity: 1, transform: 'none' }], { d: 560, delay: base + i * 70, e: EASE.spring, fill: 'backwards', raw: true }));
  }
  // a screen that opens with the page (nothing pressed yet) leaves focus alone: a script's focus there shows no ring, so a
  // keyboard player could not see it and their first Tab would skip the control; from the page's start that first Tab
  // lands on the screen's first control (New run, or Continue run), ring and all (P5)
  const focusFirst = (node) => { if (node) later(0, () => { if (UI.lastInput() != null && !UI.topDialog() && node.isConnected) UI.focusQuiet(node); }); };

  // ================================================================== title
  function blindWord(r) {
    if (!r) return '';
    if (r.phase === 'shop' || r.phase === 'pack') return 'in the Shop';
    if (r.phase === 'cashout') return 'Blind beaten';
    const kind = ['small', 'big', 'boss'][r.blindIndex] || 'small';
    if (kind === 'boss' && r.bosses && r.bosses[r.ante]) return C.boss(r.bosses[r.ante]).name;
    return C.blind(kind).name;
  }
  function savedLine(r) {
    if (!r) return '';
    // a won run waits on the win screen: what is left is the choice, not the Boss Blind it already beat
    if (r.phase === 'win') return `You win! All ${r.ante >= 8 ? 'eight' : r.ante} Antes cleared, $${fmt(r.money)}. Continue for Endless mode or a new run.`;
    return `Ante ${r.ante}, ${blindWord(r)}, $${fmt(r.money)}`;
  }
  function historyRow(h) {
    const deck = h.deckId ? C.deck(h.deckId).name : '';
    const stake = h.stake ? C.stake(h.stake).name : '';
    const li = el('li', { class: 'hist-row' });
    li.innerHTML = `<span class="h-top"><span class="tag ${h.won ? 't-lime' : 't-plum'} h-res">${h.won ? 'You win!' : 'Game Over'}</span><span class="h-who copy">${esc([deck, stake].filter(Boolean).join(', '))}</span></span>
      <span class="h-meta"><span class="lbl">Ante</span>${numHTML(String(h.ante || 0), 'S', 'cream')}${h.at ? `<span class="h-at lbl">${esc(fmtDate(h.at))}</span>` : ''}</span>
      <span class="h-best"><span class="lbl">Best</span><span class="n g-score">${numHTML(fmt(h.bestScore || 0), 'S', 'score')}</span></span>`;
    return li;
  }
  function mountTitle(app) {
    const saved = UI.hasSavedRun() ? UI.loadSavedRun() : null;
    const root = el('div', { class: 'scr scr-title' });
    const head = el('header', { class: 'tt-head' });
    const h1 = el('h1', { class: 'wm' }, el('span', { class: 'sr', text: 'Wickwager' }));
    h1.append(wordmark());
    head.append(h1, el('p', { class: 'tt-tagline copy', text: 'Play poker hands, beat every Blind, clear all eight Antes.' }));

    const menu = el('section', { class: 'panel warm tt-menu', 'aria-label': 'Menu' });
    const go = el('div', { class: 'tt-go' });
    if (saved) {
      const cont = btn('Continue run', 'continue', 'b-ember big wide');
      cont.setAttribute('aria-describedby', 'ttSaved');
      go.append(cont, el('p', { class: 'tt-saved copy', id: 'ttSaved', html: UI.richText(savedLine(saved)) }));
    }
    go.append(btn('New run', 'new-run', `${saved ? 'b-cream' : 'b-ember'} big wide`));
    menu.append(go, seedField('ttSeed', () => UI.actions['new-run'] && UI.actions['new-run']()));
    const more = el('div', { class: 'tt-more', role: 'group', 'aria-label': 'More' });
    more.append(btn('Collection', 'open-collection', 'b-cream', 'deck'), btn('Records', 'open-records', 'b-cream', 'check'), btn('How to play', 'open-help', 'b-cream', 'info'), btn('Options', 'open-options', 'b-cream', 'options'));
    menu.append(more);

    const past = el('section', { class: 'panel deep tt-past', 'aria-labelledby': 'ttPastH' });
    past.append(el('div', { class: 'p-head' }, el('h2', { class: 'tag t-lime', id: 'ttPastH', text: 'Past runs' })));
    const hist = (recs().history || []).slice(-4).reverse();
    if (hist.length) { const ul = el('ul', { class: 'hist' }); hist.forEach((h) => ul.append(historyRow(h))); past.append(ul); }
    else past.append(el('p', { class: 'copy k-dim tt-empty', text: 'No runs yet. Every run you finish is kept here.' }));
    const r = recs();
    if (r.runs) past.append(el('p', { class: 'tt-sum' }, el('span', { class: 'lbl', html: `Runs ${numHTML(String(r.runs), 'S', 'cream')}` }), el('span', { class: 'lbl', html: `Wins ${numHTML(String(r.wins || 0), 'S', 'lime')}` })));

    const body = el('div', { class: 'tt-body' }, menu, past);
    const foot = el('footer', { class: 'tt-foot' }, btn('Credits', 'open-credits', 'b-ghost tt-credits'));
    root.append(head, body, foot);
    app.append(root);
    later(0, () => placePool(menu));
    // the flame catches once per visit to the game; coming back from a menu, the title is simply there
    if (!S.titleShown) { S.titleShown = true; igniteWordmark(h1); riseIn([menu, past], 380); }
    else anim(root, [{ opacity: 0 }, { opacity: 1 }], { d: 180, raw: true, always: true });
    focusFirst($('[data-action="continue"], [data-action="new-run"]', menu));
  }
  UI.register('title', {
    mount(app) { loadSetup(); mountTitle(app); },
    update() { UI.show('title'); },
  });

  // ================================================================== run setup: Deck and Stake
  function stakeChipHTML(k) {
    return art('stake:' + k.id, { kind: 'stake', name: k.name, cls: 'stk-spr' });
  }
  function renderSetup(dir = 0) {
    const root = $('.scr-setup');
    if (!root) return;
    const D = decks(), K = stakes();
    if (!D.length || !K.length) return;
    let di = D.findIndex((d) => d.id === S.deckId); if (di < 0) di = 0;
    let ki = K.findIndex((k) => k.id === S.stake); if (ki < 0) ki = 0;
    const deck = D[di], stake = K[ki];
    S.deckId = deck.id; S.stake = stake.id;
    const dOpen = deckOpen(deck.id), kOpen = stakeOpen(stake.id);
    // the deck carousel: the chosen back lifted and lit, its neighbours peeking from behind
    const stage = $('#suStage', root);
    const prev = D[(di - 1 + D.length) % D.length], next = D[(di + 1) % D.length];
    const backHTML = (d) => art('back:' + d.id, { kind: 'back', name: d.name, cls: 'face' });
    stage.innerHTML = `
      <span class="car-side car-prev${deckOpen(prev.id) ? '' : ' is-locked'}" data-action="deck-prev" aria-hidden="true">${backHTML(prev)}</span>
      <span class="car-side car-next${deckOpen(next.id) ? '' : ' is-locked'}" data-action="deck-next" aria-hidden="true">${backHTML(next)}</span>
      <span class="jk car-main${dOpen ? '' : ' is-locked'}" role="img" aria-label="${esc(`${deck.name}${dOpen ? '' : ', locked'}`)}">${layers(backHTML(deck))}${dOpen ? '' : `<span class="lock-badge" aria-hidden="true">${icon('lock', 'light')}</span>`}</span>`;
    if (dir) {
      const main = $('.car-main', stage);
      anim(main, [{ transform: `translateX(${dir * 14 * PX()}px)`, opacity: 0.2 }, { transform: 'none', opacity: 1 }], { d: 300, e: EASE.spring, raw: true });
    }
    const info = $('#suDeckInfo', root);
    info.innerHTML = `<h3 class="su-name">${esc(deck.name)}</h3><p class="copy su-text">${rt(deck.text || '')}</p>
      ${dOpen ? '' : `<p class="copy su-lock">${icon('lock', 'light')}<span>${esc(deck.unlock || 'Locked for now.')}</span></p>`}
      <p class="lbl su-count">Deck ${di + 1} of ${D.length}</p>`;
    // the stake chips: every Stake in a row, the chosen one raised in its light
    const row = $('#suStakes', root);
    row.innerHTML = K.map((k, i) => {
      const open = stakeOpen(k.id), on = i === ki;
      return `<button class="stk${on ? ' is-on' : ''}${open ? '' : ' is-locked'}" type="button" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" data-action="pick-stake" data-stake="${esc(k.id)}" aria-label="${esc(k.name + (open ? '' : ', locked'))}"><span class="stk-glow" aria-hidden="true"></span>${stakeChipHTML(k)}${open ? '' : `<span class="lock-mini" aria-hidden="true">${icon('lock', 'light')}</span>`}</button>`;
    }).join('');
    $('#suStakeInfo', root).innerHTML = `<h3 class="su-name">${esc(stake.name)}</h3><p class="copy su-text">${rt(stake.text || '')}</p>
      ${kOpen ? '' : `<p class="copy su-lock">${icon('lock', 'light')}<span>${esc(stake.unlock || 'Locked for now.')}</span></p>`}
      <p class="lbl su-count">Stake ${ki + 1} of ${K.length}</p>`;
    // what this Deck on this Stake starts with, read from the engine
    const st = startStats(deck.id, stake.id);
    const statsEl = $('#suStats', root);
    if (st) {
      const cell = (label, v, style) => `<li><span class="lbl">${label}</span><span class="n g-${style === 'money' ? 'money' : 'cream'}">${numHTML(String(v), 'L', style)}</span></li>`;
      statsEl.innerHTML = `<span class="lbl su-stats-h">Starts with</span><ul>${cell('Hands', st.hands, 'ember')}${cell('Discards', st.discards, 'pink')}${cell('Hand size', st.handSize, 'cream')}${cell('Money', '$' + st.money, 'money')}</ul>`;
      statsEl.hidden = false;
    } else statsEl.hidden = true;
    const why = !dOpen ? `${deck.name} is locked.` : !kOpen ? `${stake.name} is locked.` : '';
    const start = $('[data-action="start-run"]', root);
    if (why) { start.setAttribute('aria-disabled', 'true'); start.dataset.why = why; } else { start.removeAttribute('aria-disabled'); delete start.dataset.why; }
    const whyEl = $('#suWhy', root);
    const saved = !why && !R() && UI.hasSavedRun() ? UI.loadSavedRun() : null;
    whyEl.textContent = why || (saved ? `Starting replaces your saved run (${savedLine(saved)}).` : '');
    whyEl.classList.toggle('is-lock', !!why);
  }
  function mountSetup(app) {
    loadSetup();
    const root = el('div', { class: 'scr scr-setup' });
    const plate = el('section', { class: 'panel dlg-frame su-plate', 'aria-labelledby': 'suTitle' });
    plate.append(el('div', { class: 'p-head' }, el('h1', { class: 'tag t-ember', id: 'suTitle', text: 'New run' })));
    const deckSec = el('section', { class: 'su-sec su-deck', 'aria-labelledby': 'suDeckH' });
    deckSec.append(el('h2', { class: 'su-h', id: 'suDeckH', text: 'Deck' }));
    const car = el('div', { class: 'car' });
    car.append(btn('', 'deck-prev', 'b-cream car-arrow', 'arrow-left', { 'aria-label': 'Previous Deck' }), el('div', { class: 'car-stage', id: 'suStage' }), btn('', 'deck-next', 'b-cream car-arrow', 'arrow-right', { 'aria-label': 'Next Deck' }));
    deckSec.append(car, el('div', { class: 'su-info', id: 'suDeckInfo', 'aria-live': 'polite' }));
    const stakeSec = el('section', { class: 'su-sec su-stake', 'aria-labelledby': 'suStakeH' });
    stakeSec.append(el('h2', { class: 'su-h', id: 'suStakeH', text: 'Stake' }));
    const sr = el('div', { class: 'stk-pick' });
    sr.append(btn('', 'stake-prev', 'b-cream car-arrow', 'arrow-left', { 'aria-label': 'Previous Stake' }), el('div', { class: 'stk-row', id: 'suStakes', role: 'radiogroup', 'aria-labelledby': 'suStakeH' }), btn('', 'stake-next', 'b-cream car-arrow', 'arrow-right', { 'aria-label': 'Next Stake' }));
    stakeSec.append(sr, el('div', { class: 'su-info', id: 'suStakeInfo', 'aria-live': 'polite' }), seedField('suSeed', () => startFromSetup()));
    const grid = el('div', { class: 'su-grid' }, deckSec, stakeSec);
    const stats = el('div', { class: 'su-stats', id: 'suStats' });
    const foot = el('div', { class: 'su-foot' }, btn('Back', 'back', 'b-cream', 'arrow-left'), el('p', { class: 'su-why copy', id: 'suWhy', 'aria-live': 'polite' }), btn('Start run', 'start-run', 'b-ember big'));
    plate.append(grid, stats, foot);
    root.append(plate);
    app.append(root);
    renderSetup();
    later(0, () => placePool(plate));
    riseIn([plate], 40);
    focusFirst($('[data-action="start-run"]', root));
  }
  function stepDeck(dir) {
    const D = decks();
    if (!D.length) return;
    let i = D.findIndex((d) => d.id === S.deckId); if (i < 0) i = 0;
    S.deckId = D[(i + dir + D.length) % D.length].id;
    UI.sfx('flip');
    renderSetup(dir);
  }
  function stepStake(dir, focus) {
    const K = stakes();
    if (!K.length) return;
    let i = K.findIndex((k) => k.id === S.stake); if (i < 0) i = 0;
    S.stake = K[(i + dir + K.length) % K.length].id;
    UI.sfx('flip');
    renderSetup();
    if (focus) { const b = $(`.stk[data-stake="${S.stake}"]`); if (b) b.focus({ preventScroll: true }); }
  }
  function startFromSetup() {
    const deck = decks().find((d) => d.id === S.deckId) || decks()[0];
    const stake = stakes().find((k) => k.id === S.stake) || stakes()[0];
    if (!deck || !stake) { UI.error('The run could not start.'); return; }
    if (!deckOpen(deck.id)) { UI.error(`${deck.name} is locked.`); return; }
    if (!stakeOpen(stake.id)) { UI.error(`${stake.name} is locked.`); return; }
    const inp = $('#suSeed');
    const seed = UI.cleanSeed(inp ? inp.value : S.seed);
    saveSetup();
    UI.sfx('shuffle');
    const run = UI.newRun({ deckId: deck.id, stake: stake.id, seed: seed || undefined });
    if (run) { S.seed = ''; UI.announce(`New run: ${deck.name} on ${stake.name}. Seed ${run.seed}.`); }
  }
  UI.register('setup', {
    mount(app) { mountSetup(app); },
    update() { renderSetup(); },
    key(e) {
      const k = e.key;
      if (k === 'Escape') { UI.show('title'); return true; }
      const inStakes = !!(e.target && e.target.closest && e.target.closest('#suStakes'));
      if (k === 'ArrowLeft' || k === 'ArrowRight') { const dir = k === 'ArrowLeft' ? -1 : 1; if (inStakes) stepStake(dir, true); else stepDeck(dir); return true; }
      if ((k === 'ArrowUp' || k === 'ArrowDown') && inStakes) { stepStake(k === 'ArrowUp' ? -1 : 1, true); return true; }
      return false;
    },
  });
  // ================================================================== mute: a setting of core's (ember:settings), applied by core to TW.Audio
  let MUTED = !!UI.settings().muted;
  function setMuted(on) {
    MUTED = !!on;
    UI.setSetting('muted', MUTED);
  }
  UI.onSettings((s) => { MUTED = !!s.muted; });

  // ================================================================== Options (title and table; SPEC 6.6)
  let UID = 0;
  const uid = (p) => `${p}${++UID}`;
  function optRow(label, ic, ctl, hintId) {
    const id = uid('opL');
    const row = el('div', { class: 'op-row' });
    const l = el('span', { class: 'op-l', id });
    if (ic) l.insertAdjacentHTML('beforeend', icon(ic, 'light'));
    l.append(el('span', { text: label }));
    if (ctl.setAttribute && !ctl.hasAttribute('aria-labelledby') && !ctl.hasAttribute('aria-label')) ctl.setAttribute('aria-labelledby', id);
    $$('input, [role="group"], [role="switch"]', ctl).forEach((n) => { if (!n.hasAttribute('aria-label') && !n.hasAttribute('aria-labelledby')) n.setAttribute('aria-labelledby', id); });
    row.append(l, el('div', { class: 'op-c' }, ctl));
    if (hintId) row.append(el('p', { class: 'op-hint copy', id: hintId }));
    return row;
  }
  function segCtl(action, opts, cls = '') {
    const g = el('div', { class: `seg op-seg ${cls}`, role: 'group' });
    opts.forEach(([v, label, aria]) => g.append(el('button', { type: 'button', class: 'btn b-cream', 'data-action': action, 'data-value': String(v), 'aria-pressed': 'false', 'aria-label': aria || null, text: label })));
    return g;
  }
  function switchCtl(action) {
    const b = el('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': 'false', 'data-action': action });
    b.innerHTML = '<span class="sw-track" aria-hidden="true"><span class="sw-knob"></span></span><span class="sw-t" aria-hidden="true">Off</span>';
    return b;
  }
  const setSwitch = (b, on) => { if (!b) return; b.setAttribute('aria-checked', String(!!on)); const t = $('.sw-t', b); if (t) t.textContent = on ? 'On' : 'Off'; };
  function rangeCtl(key) {
    const wrap = el('div', { class: 'op-range' });
    const inp = el('input', { type: 'range', class: 'range', min: '0', max: '100', step: '5', 'data-opt': key });
    const out = el('span', { class: 'op-val n g-cream', 'aria-hidden': 'true' });
    inp.addEventListener('input', () => {
      const v = Number(inp.value) || 0;
      if (MUTED && v > 0) setMuted(false);
      UI.setSetting(key, v);
      syncOptions(inp.closest('.op'));
    });
    inp.addEventListener('change', () => { if (key === 'sfx') UI.sfx('chip', { index: 3 }); });
    wrap.append(inp, out);
    return wrap;
  }
  /** The slider knob: a small cream key on the button recipe (lit top, a lip along the bottom, two grip lines). */
  function installKnob() {
    const k = UI.paint.painted('ui:knob', () => {
      const R0 = UI.paint.R.cream, b = new UI.paint.Px(7, 11);
      for (let y = 0; y < 11; y++) for (let x = 0; x < 7; x++) {
        const corner = (y === 0 || y === 10) && (x === 0 || x === 6);
        if (corner) continue;
        const edge = x === 0 || x === 6 || y === 0 || y === 10;
        let c = R0[5];
        if (edge) c = '#2B1220';
        else if (y === 1) c = R0[7];
        else if (y >= 8) c = y === 9 ? R0[2] : R0[3];
        else if (x === 5) c = R0[4];
        else if (x === 1) c = R0[6];
        if (!edge && (y === 4 || y === 6) && x >= 2 && x <= 4) c = R0[3];
        b.set(x, y, c);
      }
      return b;
    });
    document.documentElement.style.setProperty('--knob', `url("${k.url}")`);
  }
  const MOTION_HINT = { auto: 'Follows your system setting.', reduced: 'Fades only: no shakes, flashes, drift or flourishes.', full: 'Every flourish, whatever your system says.' };
  // the table's one-key shortcuts, as SPEC 6.4 lists them: Options says what its switch turns off, How to play lists
  // every key (Esc and Shift with an arrow stay on: they are no single-key shortcuts)
  const KEYS_LINE = 'One key each at the table: 1 to 9 choose cards, Enter plays the hand, D discards, S sorts and I opens the Overview.';
  const KEYS_HELP = 'Keys: 1 to 9 choose cards, Enter plays the hand, D discards, S sorts, I opens the Overview and Esc pauses. Shift with an arrow key moves the card in focus. Options can switch the one-key shortcuts off.';
  function syncOptions(box) {
    if (!box || !box.isConnected) return;
    const s = UI.settings();
    $$('[data-action="set-speed"]', box).forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.value) === s.speed)));
    const sp = (UI.SPEEDS || []).find((x) => x.value === s.speed);
    const sh = $('#opSpeedHint', box); if (sh) sh.textContent = sp ? `${sp.name} pace.` : '';
    $$('[data-action="set-motion"]', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === s.motion)));
    const mh = $('#opMotionHint', box); if (mh) mh.textContent = MOTION_HINT[s.motion] || '';
    setSwitch($('[data-action="toggle-shake"]', box), s.shake);
    setSwitch($('[data-action="toggle-mute"]', box), MUTED);
    setSwitch($('[data-action="toggle-four-color"]', box), s.fourColor);
    setSwitch($('[data-action="toggle-keys"]', box), s.keys !== false);
    $$('input[data-opt]', box).forEach((inp) => {
      const v = Number(s[inp.dataset.opt]) || 0;
      if (document.activeElement !== inp || Number(inp.value) !== v) inp.value = String(v);
      inp.style.setProperty('--fill', `${v}%`);
      inp.setAttribute('aria-valuetext', MUTED ? `${v}, muted` : String(v));
      const out = inp.parentElement && $('.op-val', inp.parentElement);
      if (out) out.innerHTML = num(String(v), 'S', MUTED ? 'dim' : 'cream');
      inp.closest('.op-row').classList.toggle('is-muted', MUTED);
    });
    const er = $('.op-erase', box);
    if (er && er.dataset.mode !== (S.erase ? 'confirm' : 'idle')) renderErase(er);
  }
  function renderErase(sec) {
    sec.dataset.mode = S.erase ? 'confirm' : 'idle';
    sec.replaceChildren(el('h3', { class: 'op-h', id: 'opEraseH', text: 'Records' }));
    if (!S.erase) {
      sec.append(el('p', { class: 'copy k-dim', text: 'Runs, wins, unlocked Decks and Stakes, and everything in the Collection.' }), el('div', { class: 'op-erase-acts' }, btn('Erase records', 'erase-records', 'b-ghost')));
    } else {
      sec.append(el('p', { class: 'copy op-warn', text: "Erase every record, unlock and discovery? This can't be undone." }), el('div', { class: 'op-erase-acts' }, btn('Erase records', 'confirm-erase', 'b-pink'), btn('Keep them', 'cancel-erase', 'b-cream')));
    }
  }
  UI.registerOverlay('options', () => {
    S.erase = false;
    installKnob();
    const box = el('div', { class: 'op' });
    const listEl = el('div', { class: 'op-list' });
    listEl.append(
      optRow('Game speed', null, segCtl('set-speed', (UI.SPEEDS || []).map((s) => [s.value, `${s.value}x`, `${s.value}x, ${s.name}`]), 'op-speed'), 'opSpeedHint'),
      optRow('Motion', null, segCtl('set-motion', [['auto', 'Auto'], ['reduced', 'Reduced'], ['full', 'Full']]), 'opMotionHint'),
      optRow('Screen shake', null, switchCtl('toggle-shake')),
      optRow('Colour-coded suits', null, switchCtl('toggle-four-color'), 'opSuitsHint'),
      optRow('Sound effects', null, rangeCtl('sfx')),
      optRow('Music', null, rangeCtl('music')),
      optRow('Mute all sound', null, switchCtl('toggle-mute')),
      optRow('Keyboard shortcuts', null, switchCtl('toggle-keys'), 'opKeysHint'),
    );
    // SPEC 6.6: off by default; when on, Clubs and Diamonds take inks of their own (ART.md section 11)
    const suitsHint = $('#opSuitsHint', listEl);
    if (suitsHint) suitsHint.innerHTML = 'Clubs in deep green and Diamonds in royal blue, so all four suits read apart at a glance. Spades and Hearts keep their inks.';
    // WCAG 2.1.4: the one-key shortcuts (SPEC 6.4) can be switched off; the hint lists them (How to play does too)
    const keysHint = $('#opKeysHint', listEl);
    if (keysHint) { keysHint.textContent = KEYS_LINE; const sw = $('[data-action="toggle-keys"]', listEl); if (sw) sw.setAttribute('aria-describedby', 'opKeysHint'); }
    const erase = el('section', { class: 'op-erase', 'aria-labelledby': 'opEraseH' });
    box.append(listEl, erase);
    renderErase(erase);
    const h = UI.dialog({ title: 'Options', tag: 'cream', cls: 'op-dlg', body: box, focus: '[data-action="set-speed"][aria-pressed="true"]' });
    syncOptions(box);
    return h;
  });

  // ================================================================== Pause (Esc, or the Options button on the table)
  function renderPause(box) {
    const run = R();
    box.replaceChildren();
    if (run) box.append(el('p', { class: 'pz-where' }, el('span', { class: 'copy', html: UI.richText(savedLine(run)) }), el('span', { class: 'lbl', text: `Seed ${run.seed}` })));
    if (!S.abandon) {
      box.append(el('div', { class: 'pz-menu' },
        btn('Resume', 'resume', 'b-ember big wide'), btn('Overview', 'open-run-info', 'b-cream wide'), btn('Options', 'pause-options', 'b-cream wide'),
        btn('How to play', 'open-help', 'b-cream wide'), btn('Save and quit', 'save-quit', 'b-cream wide'), btn('Abandon run', 'abandon', 'b-ghost wide')));
    } else {
      box.append(el('div', { class: 'pz-confirm' },
        el('p', { class: 'copy', id: 'pzAsk', text: 'Abandon this run? It counts as a loss and the save is removed.' }),
        el('div', { class: 'pz-row' }, btn('Abandon run', 'confirm-abandon', 'b-pink', null, { 'aria-describedby': 'pzAsk' }), btn('Keep playing', 'cancel-abandon', 'b-cream'))));
    }
  }
  UI.registerOverlay('pause', () => {
    if (S.pause && S.pause.wrap && S.pause.wrap.isConnected) return S.pause;
    S.abandon = false;
    const box = el('div', { class: 'pz' });
    renderPause(box);
    const h = UI.dialog({ title: 'Paused', tag: 'cream', cls: 'narrow pz-dlg', body: box, focus: '[data-action="resume"]', onClose: () => { if (S.pause === h) S.pause = null; S.abandon = false; } });
    S.pause = h;
    return h;
  });

  // ================================================================== How to play: seven short illustrated pages
  const fan = (cards, cls = '') => `<div class="hp-fan ${cls}" style="--n:${cards.length}">${cards.map((c) => `<span class="card hp-card${c.edition ? ' ed-' + esc(c.edition) : ''}" aria-hidden="true">${layers(cardFace(c).html)}</span>`).join('')}</div>`;
  function itemCard(kind, row, extra = '') {
    if (!row) return '';
    const id = `${kind}:${row.id}`;
    const plate = PLATE_KINDS.includes(kind) ? plateHTML(row.name) : '';
    return `<span class="jk hp-item" aria-hidden="true">${layers(art(id, { kind, name: row.name, rarity: row.rarity, cls: 'face', plate: plate ? false : undefined }) + plate)}${extra}</span>`;
  }
  const priceTag = (v) => `<span class="tag t-cash hp-price">$${esc(String(v))}</span>`;
  /** The first n rows whose sprite is drawn (TW.Art.has only asks; nothing is painted until it shows), else the first n. */
  function firstWithArt(rows, kind, n = 1) {
    const out = [];
    const A = TW.Art;
    if (A && typeof A.has === 'function') for (const r of rows) { try { if (A.has(`${kind}:${r.id}`)) out.push(r); } catch (err) { /* no art yet */ } if (out.length >= n) break; }
    return out.length >= n ? out : rows.slice(0, n);
  }
  const ECON = () => Object.assign({ interestPer: 5, interestCap: 5, handBonus: 1 }, Cn().ECONOMY || {});
  const SHOPV = () => Object.assign({ rerollCost: 5, rerollStep: 1 }, Cn().SHOP || {});
  const HELP = [
    { id: 'hands', tab: 'Hands', title: 'Hands and Chips × Mult', make() {
      const hands = list('HANDS');
      const fh = hands.find((h) => h.id === 'fullhouse') || hands[0] || { name: 'Hand', chips: 0, mult: 0 };
      const ill = `${fan([{ rank: 13, suit: 'S' }, { rank: 13, suit: 'H' }, { rank: 13, suit: 'C' }, { rank: 7, suit: 'D' }, { rank: 7, suit: 'S' }])}
        <div class="hp-eq"><span class="hp-eq-name">${esc(fh.name)}</span><div class="cxm"><div class="well-n chips"><span class="n g-chips">${numHTML(fmt(fh.chips), 'L', 'chips')}</span></div><span class="times" aria-hidden="true">${num('x', 'S', 'cream')}</span><div class="well-n mult"><span class="n g-mult">${numHTML(fmt(fh.mult), 'L', 'mult')}</span></div></div></div>`;
      const table = `<table class="hp-hands"><caption class="sr">Poker hands, strongest first, with their Chips and Mult at level 1</caption><thead><tr><th scope="col" class="lbl">Hand</th><th scope="col" class="lbl">Chips</th><th scope="col" class="lbl">Mult</th></tr></thead><tbody>${hands.map((h) => `<tr><th scope="row" class="copy">${esc(h.name)}</th><td>${numHTML(fmt(h.chips), 'S', 'chips')}</td><td>${numHTML(fmt(h.mult), 'S', 'mult')}</td></tr>`).join('')}</tbody></table>`;
      return { ill, copy: [
        `Select up to 5 cards and play a poker hand. It scores Chips × Mult: the hand's own Chips and Mult, plus the Chips of each scoring card, plus whatever your ${mark('joker', 'Jokers')} add.`,
        'Discard the cards you don\'t want to draw new ones. Hands and discards refill at the start of every Blind.',
        KEYS_HELP,
      ], extra: table };
    } },
    { id: 'blinds', tab: 'Blinds', title: 'Blinds and Antes', make() {
      const bl = list('BLINDS');
      const b = (k) => bl.find((x) => x.id === k || x.kind === k) || { name: C.blind(k).name, mult: 1, reward: 0 };
      const boss = firstWithArt(list('BOSSES'), 'boss')[0];
      const tok = (k, token) => { const r = b(k); return `<div class="hp-blind"><div class="hp-tok">${token}</div><span class="tag ${k === 'boss' ? 't-vio' : k === 'big' ? 't-pink' : 't-ember'}">${esc(r.name)}</span><span class="hp-bl-n"><span class="lbl">Target</span>${numHTML('x' + String(r.mult), 'S', 'cream')}</span><span class="hp-bl-n"><span class="lbl">Reward</span><span class="n g-money">${numHTML('$' + r.reward, 'S', 'money')}</span></span></div>`; };
      const ill = `<div class="hp-blinds">${tok('small', candleHTML('small'))}${tok('big', candleHTML('big'))}${tok('boss', boss ? emblemHTML(boss.id, boss.name) : '')}</div>`;
      const e = ECON();
      return { ill, copy: [
        `Every ${mark('name', 'Ante')} has three Blinds: the Small Blind, the Big Blind and the Boss Blind. Reach the target score before your hands run out.`,
        `Each ${mark('boss', 'Boss Blind')} has its own twist. Skip a Small or Big Blind to take its ${mark('tag', 'Tag')} instead.`,
        `Beat a Blind, then collect: its reward, $${e.handBonus} for each hand to spare, and $1 of interest for every $${e.interestPer} you hold (up to $${e.interestCap}).`,
        'Beat the Boss Blind of Ante 8 to win, then try Endless mode if you dare.',
      ] };
    } },
    { id: 'jokers', tab: 'Jokers', title: 'Jokers', make() {
      const js = firstWithArt(list('JOKERS'), 'joker', 3);
      const ill = `<div class="hp-row">${js.map((j) => itemCard('joker', j)).join('')}</div>`;
      const rar = Cn().RARITIES || {};
      const rNames = ['common', 'uncommon', 'rare', 'legendary'].map((k) => `<span class="rar-${k}">${esc((rar[k] && rar[k].name) || k)}</span>`);
      return { ill, copy: [
        `${mark('joker', 'Jokers')} add Chips, Mult, money and stranger rules to every hand. You hold up to 5 at once.`,
        'Joker order matters: they trigger left to right, so drag them to reorder.',
        `<span class="hp-raw">Rarities, from the most common: ${rNames.slice(0, 3).join(', ')} and ${rNames[3]}.</span>`,
        'Sell a Joker for half its price to make room for a better one.',
      ] };
    } },
    { id: 'shop', tab: 'Shop', title: 'The Shop', make() {
      const j = firstWithArt(list('JOKERS'), 'joker')[0];
      const pk = firstWithArt(list('PACKS'), 'pack')[0];
      const v = firstWithArt(list('VOUCHERS'), 'voucher')[0];
      const ill = `<div class="hp-row hp-shop">${j ? itemCard('joker', j, priceTag(j.cost || 4)) : ''}${pk ? itemCard('pack', pk, priceTag(pk.price || 4)) : ''}${v ? itemCard('voucher', v, priceTag(v.price || 10)) : ''}</div>`;
      const sv = SHOPV(), e = ECON();
      return { ill, copy: [
        `Spend money in the Shop on ${mark('joker', 'Jokers')} (5 slots), ${mark('tarot', 'Tarot')}, ${mark('planet', 'Planet')} and ${mark('spectral', 'Spectral')} cards (2 slots shared), ${mark('pack', 'Booster Packs')} and ${mark('voucher', 'Vouchers')}.`,
        `Reroll to see new cards for sale: $${sv.rerollCost}, then $${sv.rerollStep} more each time in the same visit.`,
        `Money you keep earns interest each time you collect: $1 for every $${e.interestPer}, up to $${e.interestCap}.`,
      ] };
    } },
    { id: 'cards', tab: 'Cards', title: 'Tarot, Planet and Spectral cards', make() {
      const t = firstWithArt(list('TAROTS'), 'tarot')[0], p = firstWithArt(list('PLANETS'), 'planet')[0], s = firstWithArt(list('SPECTRALS'), 'spectral')[0];
      const ill = `<div class="hp-row">${itemCard('tarot', t)}${itemCard('planet', p)}${itemCard('spectral', s)}</div>`;
      return { ill, copy: [
        `${mark('planet', 'Planet cards')} level up one poker hand: it scores more Chips and Mult from then on.`,
        `${mark('tarot', 'Tarot cards')} change the cards in your hand: Enhancements, ranks, suits and copies.`,
        `${mark('spectral', 'Spectral cards')} are powerful, always with a cost or a risk.`,
        'You hold 2 at a time. One picked from a Booster Pack is used at once, on a hand dealt for the pack.',
      ] };
    } },
    { id: 'upgrades', tab: 'Upgrades', title: 'Enhancements, Editions and Seals', make() {
      const en = list('ENHANCEMENTS')[0], ed = list('EDITIONS')[0], se = list('SEALS')[0];
      const cards = [{ rank: 9, suit: 'H', enhancement: en ? en.id : null }, { rank: 11, suit: 'C', edition: ed ? ed.id : null }, { rank: 12, suit: 'D', seal: se ? se.id : null }];
      const ill = `<div class="hp-row hp-upg">${cards.map((c) => `<span class="card hp-card${c.edition ? ' ed-' + esc(c.edition) : ''}" aria-hidden="true">${layers(cardFace(c).html)}</span>`).join('')}</div>`;
      const ex = (row, kind) => (row ? ` For example, ${mark(kind, row.name)}: ${row.cardText || row.text || ''}` : '');
      return { ill, copy: [
        `${mark('enh', 'Enhancements')} change what a card does.${ex(en, 'enh')}`,
        `${mark('edition', 'Editions')} are moving light on a Joker or a card.${ex(ed, 'edition')}`,
        `${mark('seal', 'Seals')} are ribbons on a card's top edge.${ex(se, 'seal')}`,
        'A card holds one of each. The Collection lists them all.',
      ] };
    } },
    { id: 'tags', tab: 'Tags', title: 'Tags, Vouchers and Stakes', make() {
      const tags = firstWithArt(list('TAGS'), 'tag', 2), v = firstWithArt(list('VOUCHERS'), 'voucher')[0], k = list('STAKES')[0];
      const tok = (kind, row) => `<span class="hp-tok-s" aria-hidden="true">${art(`${kind}:${row.id}`, { kind, name: row.name })}</span>`;
      const ill = `<div class="hp-row hp-tags">${tags.map((t) => tok('tag', t)).join('')}${itemCard('voucher', v)}${k ? tok('stake', k) : ''}</div>`;
      return { ill, copy: [
        `Skip a Small or Big Blind to take its ${mark('tag', 'Tag')}: money, a free pack, a Joker and more.`,
        `A ${mark('voucher', 'Voucher')} upgrades the whole run. Each Ante's Shop offers one.`,
        `A ${mark('stake', 'Stake')} raises the targets. Win a run on one to unlock the next.`,
      ] };
    } },
  ];
  function renderHelp(box, page) {
    const n = HELP.length;
    S.helpPage = ((page % n) + n) % n;
    const pg = HELP[S.helpPage];
    let made = { ill: '', copy: [], extra: '' };
    try { made = pg.make(); } catch (err) { console.warn('Wickwager: help page failed', err); }
    const tabs = $('.hp-tabs', box);
    $$('[role="tab"]', tabs).forEach((t, i) => { const on = i === S.helpPage; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    const panel = $('.hp-panel', box);
    panel.setAttribute('aria-labelledby', `hpTab${S.helpPage}`);
    panel.innerHTML = `<h3 class="hp-title">${esc(pg.title)}</h3><div class="hp-ill">${made.ill || ''}</div>
      <div class="hp-text${made.extra ? ' has-extra' : ''}"><div class="hp-copy">${(made.copy || []).map((p) => (p.startsWith('<span class="hp-raw">') ? `<p class="copy">${p}</p>` : `<p class="copy">${rt(p)}</p>`)).join('')}</div>${made.extra || ''}</div>`;
    const sc = panel.closest('.dlg-body');
    if (sc) sc.scrollTop = 0;
    const count = $('.hp-count', box);
    if (count) count.innerHTML = numHTML(`${S.helpPage + 1}/${n}`, 'S', 'cream');
    if (UI.motionOK()) anim(panel, [{ opacity: 0, transform: `translateY(${3 * PX()}px)` }, { opacity: 1, transform: 'none' }], { d: 260, e: EASE.out, raw: true });
  }
  UI.registerOverlay('help', (props = {}) => {
    const box = el('div', { class: 'hp' });
    const tabs = el('div', { class: 'hp-tabs', role: 'tablist', 'aria-label': 'How to play' });
    HELP.forEach((p, i) => tabs.append(el('button', { type: 'button', class: 'hp-tab', role: 'tab', id: `hpTab${i}`, 'aria-controls': 'hpPanel', 'aria-selected': 'false', 'data-action': 'help-page', 'data-page': String(i), text: p.tab })));
    box.append(tabs, el('section', { class: 'hp-panel', id: 'hpPanel', role: 'tabpanel', tabindex: '0' }));
    // each name starts with the word the button shows (WCAG 2.5.3: "click Back" works by voice)
    const nav = el('div', { class: 'hp-nav' }, btn('Back', 'help-prev', 'b-cream', 'arrow-left', { 'aria-label': 'Back, previous page' }), el('span', { class: 'hp-count' }), btn('Next', 'help-next', 'b-ember', 'arrow-right', { 'aria-label': 'Next page' }));
    const start = props.page != null ? props.page : S.helpPage;
    const h = UI.dialog({ title: 'How to play', tag: 'ember', cls: 'wide hp-dlg', body: box, focus: '.hp-tab[aria-selected="true"]' });
    h.el.insertBefore(nav, h.body.nextSibling);
    renderHelp(h.el, start);
    h.onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const onTab = document.activeElement && document.activeElement.closest && document.activeElement.closest('.hp-tabs');
        renderHelp(h.el, S.helpPage + (e.key === 'ArrowRight' ? 1 : -1));
        UI.sfx('flip');
        if (onTab) { const t = $(`#hpTab${S.helpPage}`, h.el); if (t) t.focus(); }
      }
    };
    return h;
  });

  // ================================================================== Overview (overlay 'run-info'): hand levels, this Ante, the run
  function pendingLines(run) {
    const p = run.pending || {}, out = [];
    const sign = (v) => (v > 0 ? '+' : '') + v;
    if (p.extraHands) out.push(`${sign(p.extraHands)} ${UI.plural(Math.abs(p.extraHands), 'hand')} in your next Blind.`);
    if (p.extraDiscards) out.push(`${sign(p.extraDiscards)} ${UI.plural(Math.abs(p.extraDiscards), 'discard')} in your next Blind.`);
    if (p.handSizeDelta) out.push(`${sign(p.handSizeDelta)} hand size in your next Blind.`);
    if (p.targetMult && p.targetMult !== 1) out.push(`Your next Blind's target is ×${UI.fmtMult(p.targetMult)}.`);
    if (p.sale) { const t = C.tag('sale'); out.push(t && t.text ? `${t.name}: ${t.text}` : 'Your next Shop has a sale.'); }
    return out;
  }
  function runInfoHTML(run) {
    const hands = UI.q('handTable') || [];
    const most = hands.reduce((a, h) => (h.plays > (a ? a.plays : 0) ? h : a), null);
    const handRows = hands.map((h) => `<tr class="${h.level > 1 ? 'is-up' : ''}${most && most.handId === h.handId ? ' is-most' : ''}">
        <th scope="row" class="copy">${esc(h.name)}</th><td>${numHTML(String(h.level), 'S', h.level > 1 ? 'lime' : 'cream')}</td>
        <td><span class="n g-chips">${numHTML(fmt(h.chips), 'S', 'chips')}</span></td><td><span class="n g-mult">${numHTML(UI.fmtMult(h.mult), 'S', 'mult')}</span></td>
        <td>${numHTML(String(h.plays), 'S', h.plays ? 'cream' : 'dim')}</td></tr>`).join('');
    const handsSec = `<section class="ri-sec ri-hands" aria-labelledby="riHandsH"><h3 class="ri-h" id="riHandsH">Poker hands</h3>
      <table class="ri-table"><thead><tr><th scope="col" class="lbl">Hand</th><th scope="col" class="lbl">Level</th><th scope="col" class="lbl">Chips</th><th scope="col" class="lbl">Mult</th><th scope="col" class="lbl">Played</th></tr></thead><tbody>${handRows}</tbody></table></section>`;
    const infos = UI.q('blindsForAnte') || [];
    const STATUS = { cleared: ['Cleared', 't-lime'], skipped: ['Skipped', 't-plum'], current: ['Up next', 't-ember'], upcoming: ['Unlit', 't-plum'] };
    const blindRows = infos.map((b) => {
      const st = STATUS[b.status] || ['', 't-plum'];
      const name = C.blind(b.kind).name;
      let extra = '';
      if (b.boss) extra = `<div class="ri-boss">${emblemHTML(b.boss.id, b.boss.name)}<div><span class="b-name">${esc(b.boss.name)}</span><p class="copy">${rt(b.boss.text || '')}</p></div></div>`;
      else if (b.tag) extra = `<div class="ri-tagline"><span class="lbl">Skip for</span><span class="tag-tok" data-tag-id="${esc(b.tag.id)}" tabindex="0" role="img" aria-label="${esc(`${b.tag.name}: ${b.tag.text || ''}`)}">${art('tag:' + b.tag.id, { kind: 'tag', name: b.tag.name })}</span><span class="copy">${esc(b.tag.name)}</span></div>`;
      return `<li class="ri-blind is-${esc(b.status)}"><div class="ri-bl-top"><span class="tag ${b.kind === 'boss' ? 't-vio' : b.kind === 'big' ? 't-pink' : 't-ember'}">${esc(name)}</span><span class="tag ${st[1]} ri-st">${esc(st[0])}</span></div>
        <div class="ri-bl-n"><span class="lbl">Target</span><span class="n g-cream">${numHTML(fmt(b.target), 'S', 'cream')}</span><span class="lbl">Reward</span><span class="n g-money">${numHTML('$' + fmt(b.reward), 'S', 'money')}</span></div>${extra}</li>`;
    }).join('');
    const anteSec = `<section class="ri-sec ri-ante" aria-labelledby="riAnteH"><h3 class="ri-h" id="riAnteH">Ante ${esc(String(run.ante))}${run.endless ? ', Endless mode' : ''}</h3><ul class="ri-blinds">${blindRows}</ul></section>`;
    const deck = C.deck(run.deckId), stake = C.stake(run.stake);
    const vs = (run.vouchers || []).map((id) => C.voucher(id));
    const vouchers = vs.length ? `<ul class="ri-vouchers">${vs.map((v) => `<li><span class="v-name">${esc(v.name)}</span><span class="copy">${rt(v.text || '')}</span></li>`).join('')}</ul>` : '<p class="copy k-dim">None yet. One is for sale in each Ante\'s Shop.</p>';
    const waiting = pendingLines(run);
    const runSec = `<section class="ri-sec ri-run" aria-labelledby="riRunH"><h3 class="ri-h" id="riRunH">Run</h3>
      <dl class="ri-dl">
        <div><dt class="lbl">Deck</dt><dd><span class="v-name">${esc(deck.name)}</span><span class="copy">${rt(deck.text || '')}</span></dd></div>
        <div><dt class="lbl">Stake</dt><dd class="ri-stake"><span class="ri-chip" aria-hidden="true">${art('stake:' + run.stake, { kind: 'stake', name: stake.name })}</span><span><span class="v-name">${esc(stake.name)}</span><span class="copy">${rt(stake.text || '')}</span></span></dd></div>
        <div><dt class="lbl">Seed</dt><dd class="ri-seed"><output class="seed-val">${esc(run.seed)}</output></dd></div>
      </dl>
      <h4 class="ri-h2">Vouchers</h4>${vouchers}
      ${waiting.length ? `<h4 class="ri-h2">Waiting</h4><ul class="ri-wait">${waiting.map((w) => `<li class="copy">${rt(w)}</li>`).join('')}</ul>` : ''}</section>`;
    return `<div class="ri-cols"><div class="ri-col">${handsSec}</div><div class="ri-col">${anteSec}${runSec}</div></div>`;
  }
  UI.registerOverlay('run-info', () => {
    const run = R();
    if (!run) { UI.toast('Start a run to see its Overview.', 'info'); return null; }
    const body = el('div', { class: 'ri' });
    body.innerHTML = runInfoHTML(run);
    const seedDd = $('.ri-seed', body);
    if (seedDd) seedDd.append(btn('Copy', 'copy-seed', 'b-cream sm', null, { 'data-seed': run.seed, 'aria-label': `Copy the seed ${run.seed}` }));
    return UI.dialog({ title: 'Overview', tag: 'cream', cls: 'wide ri-dlg', body });
  });

  // ================================================================== the deck view: every card by suit, what is left to draw
  function deckHTML(run) {
    const view = UI.q('deckView') || { cards: run.cards || [], remaining: (run.cards || []).map((c) => c.uid) };
    const cards = view.cards || [];
    const left = new Set(view.remaining || cards.map((c) => c.uid));
    const inBlind = !!run.blind;
    const RN = Cn().RANK_NAMES || {};
    // the cards are one grid for the keyboard: a single Tab stop (the first card), the arrow keys, Home and End move
    // between them, and each shows its tip on focus, as it does on hover (its effect is the card's description)
    let first = true;
    const rows = SUIT_ORDER().map((su) => {
      const cs = cards.filter((c) => c.suit === su);
      const n = cs.filter((c) => left.has(c.uid)).length;
      const name = UI.suitName(su);
      const cardsHTML = cs.map((c) => {
        const f = cardFace(c);
        const out = inBlind && !left.has(c.uid);
        const label = (UI.table && UI.table.cardLabel ? UI.table.cardLabel(c) : `${UI.rankWord(c.rank)} of ${name}`) + (out ? ', drawn' : '');
        const tab = first ? 0 : -1;
        first = false;
        return `<span class="card dv-card${out ? ' is-out' : ''}${c.edition ? ' ed-' + esc(c.edition) : ''}" data-uid="${esc(c.uid)}" role="img" tabindex="${tab}" aria-label="${esc(label)}">${layers(f.html)}</span>`;
      }).join('');
      return `<div class="dv-suit"><div class="dv-suit-h"><span class="dv-sn">${esc(name)}</span><span class="n g-cream">${numHTML(inBlind ? `${n}/${cs.length}` : String(cs.length), 'S', 'cream')}</span></div>
        <div class="dv-row" role="group" aria-label="${esc(`${name}: ${inBlind ? `${n} of ${cs.length} left` : `${cs.length} cards`}`)}" style="--n:${Math.max(2, cs.length)}">${cardsHTML || '<span class="copy k-dim">None</span>'}</div></div>`;
    }).join('');
    const ranks = [];
    for (let r = 14; r >= 2; r--) {
      const all = cards.filter((c) => c.rank === r), n = all.filter((c) => left.has(c.uid)).length;
      if (!all.length) continue;
      ranks.push(`<li class="${n ? '' : 'is-none'}"><span class="dv-rk">${esc(RN[r] || String(r))}</span><span class="n">${numHTML(inBlind ? String(n) : String(all.length), 'S', n ? 'cream' : 'dim')}</span></li>`);
    }
    const total = cards.length;
    const sum = inBlind ? `${left.size} of ${total} cards are still in your draw pile. Drawn cards are dimmed.` : `${total} cards in your deck.`;
    return `<p class="dv-sum copy">${esc(sum)}</p><div class="dv-body"><div class="dv-rows">${rows}</div>
      <aside class="dv-side" aria-label="${inBlind ? 'Cards left by rank' : 'Cards by rank'}"><h3 class="ri-h">${inBlind ? 'Left by rank' : 'By rank'}</h3><ul class="dv-ranks">${ranks.join('')}</ul></aside></div>`;
  }
  UI.registerOverlay('deck', () => {
    const run = R();
    if (!run) return null;
    const body = el('div', { class: 'dv' });
    body.innerHTML = deckHTML(run);
    const t = UI.q('deckView');
    const left = run.blind && t ? (t.remaining || []).length : null;
    // focus opens on Close, as before; Tab then reaches the scrolling body and the grid of cards
    const h = UI.dialog({ title: left != null ? `Deck ${left}/${(t.cards || []).length}` : 'Deck', tag: 'cream', cls: 'wide dv-dlg', body, focus: '.x-close' });
    h.onKey = (e) => { const c = e.target; if (c && c.classList && c.classList.contains('dv-card') && moveGridFocus(c, e.key, $$('.dv-card', h.el))) e.preventDefault(); };
    return h;
  });

  // ================================================================== credits
  UI.registerOverlay('credits', () => {
    const fonts = [
      ['Jersey 10', 'Labels, buttons and titles.', 'Copyright 2023 The Soft Type Project Authors.'],
      ['Tiny5', 'Small labels and Joker plates.', 'Copyright 2022-2024 The Tiny5 Project Authors.'],
      ['Bricolage Grotesque', 'Descriptions and help. Subset and trimmed to the weights the game uses; no Reserved Font Name.', 'Copyright 2022 The Bricolage Grotesque Project Authors.'],
    ];
    const body = el('div', { class: 'cr' });
    body.innerHTML = `<p class="copy">Every card, Joker, emblem and sound in Wickwager is drawn or synthesised in code inside this one file. The digit face is drawn for the game too.</p>
      <h3 class="op-h">Fonts</h3>
      <ul class="cr-fonts">${fonts.map(([n, use, c]) => `<li><span class="v-name">${esc(n)}</span><span class="copy">${esc(use)}</span><span class="copy k-dim">${esc(c)} SIL Open Font License 1.1.</span></li>`).join('')}</ul>
      <p class="copy k-dim">The fonts are embedded under the SIL Open Font License 1.1, which lets anyone use, study, share and change them, as long as the licence travels with them.</p>`;
    return UI.dialog({ title: 'Credits', tag: 'cream', cls: 'cr-dlg', body });
  });
  // ================================================================== Records
  const readout = (label, inner, cls = '') => `<section class="panel rc-tile ${cls}"><span class="lbl">${esc(label)}</span><div class="rc-v">${inner}</div></section>`;
  function mountRecords(app) {
    const r = recs();
    const root = el('div', { class: 'scr scr-records' });
    const plate = el('section', { class: 'panel dlg-frame rc-plate', 'aria-labelledby': 'rcTitle' });
    plate.append(el('div', { class: 'p-head' }, el('h1', { class: 'tag t-lime', id: 'rcTitle', text: 'Records' }), btn('Back', 'back', 'b-cream', 'arrow-left')));
    const best = r.bestHand;
    const tiles = el('div', { class: 'rc-tiles' });
    tiles.innerHTML = readout('Runs', `<span class="n g-cream">${numHTML(fmt(r.runs || 0), 'L', 'cream')}</span>`)
      + readout('Wins', `<span class="n g-cream">${numHTML(fmt(r.wins || 0), 'L', 'lime')}</span>`)
      + readout('Best Ante', `<span class="n g-ember">${numHTML(String(r.bestAnte || 0), 'L', 'ember')}</span>`)
      + readout('Brightest hand', best ? `<span class="n g-score">${numHTML(fmt(best.score || 0), 'L', 'score')}</span><span class="copy rc-sub">${esc(best.name || C.hand(best.handId).name)}</span>` : '<span class="copy k-dim">None yet</span>', 'rc-best');
    const hist = (r.history || []).slice().reverse();
    const histSec = el('section', { class: 'rc-sec rc-hist', 'aria-labelledby': 'rcHistH' }, el('h2', { class: 'ri-h', id: 'rcHistH', text: 'Recent runs' }));
    if (hist.length) { const ul = el('ul', { class: 'hist' }); hist.forEach((h) => ul.append(historyRow(h))); histSec.append(ul); }
    else histSec.append(el('p', { class: 'copy k-dim', text: 'Finish a run to file it here.' }));
    const unl = el('section', { class: 'rc-sec rc-unlocks', 'aria-labelledby': 'rcUnlH' }, el('h2', { class: 'ri-h', id: 'rcUnlH', text: 'Unlocks' }));
    const unRow = (open, name, how) => `<li class="${open ? 'is-open' : 'is-locked'}"><span class="u-ic" aria-hidden="true">${icon(open ? 'check' : 'lock', 'light')}</span><span class="v-name">${esc(name)}</span>${open ? '<span class="sr">unlocked</span>' : `<span class="copy k-dim">${esc(how || 'Locked for now.')}</span>`}</li>`;
    const D = decks(), K = stakes();
    unl.insertAdjacentHTML('beforeend', `<h3 class="ri-h2">Decks <span class="lbl">${D.filter((d) => deckOpen(d.id)).length} of ${D.length}</span></h3><ul class="unl unl-decks">${D.map((d) => unRow(deckOpen(d.id), d.name, d.unlock)).join('')}</ul>
      <h3 class="ri-h2">Stakes <span class="lbl">${K.filter((k) => stakeOpen(k.id)).length} of ${K.length}</span></h3><ul class="unl">${K.map((k) => unRow(stakeOpen(k.id), k.name, k.unlock)).join('')}</ul>`);
    plate.append(tiles, el('div', { class: 'rc-cols' }, histSec, unl));
    root.append(plate);
    app.append(root);
    later(0, () => placePool(plate));
    riseIn([plate], 40);
    focusFirst($('[data-action="back"]', plate));
  }
  UI.register('records', {
    mount(app) { mountRecords(app); },
    update() { UI.show('records'); },
    key(e) { if (e.key === 'Escape') { UI.show('title'); return true; } return false; },
  });

  // ================================================================== Collection: every item, discovered or not
  const CO_TABS = [['jokers', 'Jokers'], ['consumables', 'Consumables'], ['vouchers', 'Vouchers'], ['tags', 'Tags'], ['bosses', 'Boss Blinds'], ['decks', 'Decks'], ['upgrades', 'Card upgrades']];
  const CO = { items: new Map() };
  const KIND_WORD = { tarot: 'Tarot card', planet: 'Planet card', spectral: 'Spectral card', voucher: 'Voucher', tag: 'Tag', boss: 'Boss Blind', back: 'Deck' };
  const TINT = { common: ['#BD8C6C', '#6E4636'], uncommon: ['#7CC12C', '#2F5A12'], rare: ['#E2337F', '#5E0F38'], legendary: ['#AC7BFF', '#2E1160'], tarot: ['#8B46EE', '#2E1160'], planet: ['#4A62FF', '#141A5E'], spectral: ['#9CC8E6', '#2E4078'], voucher: ['#DDB08A', '#6E4636'], back: ['#8C5671', '#2A1423'] };
  /** A card not found yet: the 41 x 55 card in the room's warm plum (the panels' fill, never near-black), a lit lip
      along its top as the panels have, its rim tinted by rarity or kind, and in its window an unlit candle, the
      Blind select's sign for what is still to come. The '?' sits over the window. */
  function lockedCard(tint) {
    return UI.paint.painted('co:lock:' + tint, () => {
      const [hi, lo] = TINT[tint] || TINT.common;
      const P = UI.paint.R.plum, LIP = '#FFD29C', BODY = P[4], WIN = P[3];
      const b = new UI.paint.Px(41, 55), CORNER = [4, 2, 1, 1];
      const inside = (x, y) => { if (x < 0 || y < 0 || x > 40 || y > 54) return false; const r = y < 4 ? CORNER[y] : y > 50 ? CORNER[54 - y] : 0; return x >= r && x < 41 - r; };
      for (let y = 0; y < 55; y++) for (let x = 0; x < 41; x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x, y - 1) || !inside(x, y + 1) || !inside(x - 1, y) || !inside(x + 1, y);
        let c = BODY;
        if (edge) c = '#2B1220';
        else if (!inside(x, y - 2)) c = mix(LIP, P[5], 0.42); // the lit lip
        else if (!inside(x, y - 3)) c = mix(hi, BODY, 0.5); // the rim's tint under it
        else if (y > 51) c = mix(lo, P[3], 0.4); // a tinted shadow along the foot, plum, not black
        else if (x === 1 || x === 39) c = mix(lo, BODY, 0.4);
        const win = x >= 5 && x <= 35 && y >= 7 && y <= 37;
        const winEdge = win && (x === 5 || x === 35 || y === 7 || y === 37);
        if (winEdge) c = y === 7 ? mix(P[2], WIN, 0.5) : mix(hi, WIN, 0.45);
        else if (win) c = y < 22 ? WIN : mix(WIN, P[2], 0.3);
        if (!edge && y >= 41 && y <= 51 && x >= 3 && x <= 37) c = (y === 41 || y === 51 || x === 3 || x === 37) ? mix(hi, BODY, 0.45) : WIN;
        b.set(x, y, c);
      }
      // the unlit candle at the foot of the window, under the '?': wax lit from the left, a dark wick, a dish
      const wax = [P[7], P[6], P[6], P[5], P[5]];
      for (let y = 31; y <= 35; y++) wax.forEach((c, i) => b.set(18 + i, y, c));
      b.set(18, 31, P[6]); b.set(22, 31, P[4]);
      b.set(20, 30, '#2B1220'); b.set(20, 29, '#2B1220');
      for (let x = 16; x <= 24; x++) b.set(x, 36, x === 16 || x === 24 ? P[4] : P[5]);
      return b;
    });
  }
  /** A silhouette of a token-shaped sprite (Tags, Boss emblems, Stakes): its own outline, filled in plum. */
  const SIL = new Map();
  function silhouette(id) {
    if (SIL.has(id)) return SIL.get(id);
    let s = null;
    try {
      const A = TW.Art;
      const bm = A && typeof A.has === 'function' && A.has(id) && typeof A.bitmap === 'function' ? A.bitmap(id) : null;
      if (bm && bm.data && bm.w && bm.h) {
        s = UI.paint.painted('co:sil:' + id, () => {
          const b = new UI.paint.Px(bm.w, bm.h);
          const on = (x, y) => x >= 0 && y >= 0 && x < bm.w && y < bm.h && bm.data[(y * bm.w + x) * 4 + 3] > 40;
          for (let y = 0; y < bm.h; y++) for (let x = 0; x < bm.w; x++) {
            if (!on(x, y)) continue;
            const top = !on(x, y - 1), edge = top || !on(x, y + 1) || !on(x - 1, y) || !on(x + 1, y);
            b.set(x, y, top ? '#8C5671' : edge ? '#4D2B40' : '#2A1423');
          }
          return b;
        });
      }
    } catch (err) { s = null; }
    SIL.set(id, s);
    return s;
  }
  function coData(tab) {
    const groups = [];
    const push = (title, cls, items) => groups.push({ title, cls, items });
    if (tab === 'jokers') {
      const seen = discovered('jokers');
      const all = list('JOKERS');
      ['common', 'uncommon', 'rare', 'legendary'].forEach((r) => {
        const rows = all.filter((j) => (j.rarity || 'common') === r);
        if (rows.length) push(C.rarity(r), 'rar-' + r, rows.map((j) => ({ key: 'joker:' + j.id, kind: 'joker', id: j.id, art: 'joker:' + j.id, name: j.name, text: j.text, rarity: r, tint: r, found: seen.has(j.id), sub: `${C.rarity(r)} Joker${j.cost ? `, $${j.cost}` : ''}`, subLocked: `${C.rarity(r)} Joker` })));
      });
      const extra = all.filter((j) => !['common', 'uncommon', 'rare', 'legendary'].includes(j.rarity || 'common'));
      if (extra.length) push('Other', 'rar-common', extra.map((j) => ({ key: 'joker:' + j.id, kind: 'joker', id: j.id, art: 'joker:' + j.id, name: j.name, text: j.text, tint: 'common', found: seen.has(j.id), sub: 'Joker', subLocked: 'Joker' })));
    } else if (tab === 'consumables') {
      const seen = discovered('consumables');
      [['TAROTS', 'tarot', 'Tarot cards'], ['PLANETS', 'planet', 'Planet cards'], ['SPECTRALS', 'spectral', 'Spectral cards']].forEach(([t, kind, title]) => {
        const rows = list(t);
        if (rows.length) push(title, 'kind-' + kind, rows.map((c) => ({ key: `${kind}:${c.id}`, kind, id: c.id, art: `${kind}:${c.id}`, name: c.name, text: c.text, tint: kind, found: seen.has(c.id), sub: KIND_WORD[kind], subLocked: KIND_WORD[kind] })));
      });
    } else if (tab === 'vouchers') {
      const seen = discovered('vouchers');
      push('Vouchers', 'kind-voucher', list('VOUCHERS').map((v) => ({ key: 'voucher:' + v.id, kind: 'voucher', id: v.id, art: 'voucher:' + v.id, name: v.name, text: v.text, tint: 'voucher', found: seen.has(v.id), sub: `Voucher${v.price ? `, $${v.price}` : ''}`, subLocked: 'Voucher' })));
    } else if (tab === 'tags') {
      const seen = discovered('tags');
      push('Tags', 'kind-tag', list('TAGS').map((t) => ({ key: 'tag:' + t.id, kind: 'tag', id: t.id, art: 'tag:' + t.id, name: t.name, text: t.text, found: seen.has(t.id), sub: t.fromAnte > 1 ? `Tag, from Ante ${t.fromAnte}` : 'Tag', subLocked: 'Tag', token: true, caption: true })));
    } else if (tab === 'bosses') {
      const seen = discovered('bosses');
      push('Boss Blinds', 'kind-boss', list('BOSSES').map((b) => ({ key: 'boss:' + b.id, kind: 'boss', id: b.id, art: 'boss:' + b.id, name: b.name, text: b.text, found: seen.has(b.id), sub: b.fromAnte ? `Boss Blind, from Ante ${b.fromAnte}` : 'Boss Blind', subLocked: 'Boss Blind', token: true, caption: true })));
    } else if (tab === 'decks') {
      push('Decks', 'kind-deck', decks().map((d) => ({ key: 'back:' + d.id, kind: 'back', id: d.id, art: 'back:' + d.id, name: d.name, text: d.text, tint: 'back', found: deckOpen(d.id), showLocked: true, unlock: d.unlock, sub: 'Deck', subLocked: 'Deck', caption: true })));
    }
    return groups;
  }
  function coCount(tab) {
    if (tab === 'upgrades') { const n = list('ENHANCEMENTS').length + list('EDITIONS').length + list('SEALS').length; return [n, n]; }
    let found = 0, total = 0;
    coData(tab).forEach((g) => g.items.forEach((it) => { total++; if (it.found) found++; }));
    return [found, total];
  }
  function coItemHTML(it, first) {
    CO.items.set(it.key, it);
    const label = it.found ? `${it.name}, ${it.sub}. ${it.text || ''}` : it.showLocked ? `${it.name}, locked. ${it.unlock || ''}` : `Not discovered yet. ${it.subLocked}.`;
    let inner;
    if (it.token) {
      const sil = it.found ? null : silhouette(it.art);
      inner = `<span class="co-tok${it.kind === 'boss' ? ' co-boss' : ''}">${it.found ? art(it.art, { kind: it.kind, name: it.name }) : sil ? UI.paint.imgTag(sil, 'co-sil') : `<span class="co-ring" aria-hidden="true"></span>`}${it.found ? '' : `<span class="co-q">${num('?', 'L', 'dim')}</span>`}</span>`;
    } else if (it.found || it.showLocked) {
      const plate = PLATE_KINDS.includes(it.kind) ? plateHTML(it.name) : '';
      inner = `<span class="jk co-card">${layers(art(it.art, { kind: it.kind, name: it.name, rarity: it.rarity, cls: 'face', plate: plate ? false : undefined }) + plate)}${it.found ? '' : `<span class="lock-badge" aria-hidden="true">${icon('lock', 'light')}</span>`}</span>`;
    } else {
      inner = `<span class="jk co-card"><span class="lift"><span class="sway">${UI.paint.imgTag(lockedCard(it.tint || 'common'), 'face co-lock')}<span class="co-q">${num('?', 'L', 'dim')}</span></span></span></span>`;
    }
    const cap = it.caption && (it.found || it.showLocked) ? `<span class="co-cap${it.found ? '' : ' is-dim'}">${esc(it.name)}</span>` : '';
    return `<span class="co-item k-${esc(it.kind)}${it.found ? '' : ' is-locked'}${it.token ? ' is-token' : ''}" tabindex="${first ? 0 : -1}" role="img" aria-label="${esc(label)}" data-co="${esc(it.key)}">${inner}${cap}</span>`;
  }
  function upgradesHTML() {
    const row = (card, name, lines, kindCls) => `<li class="co-up"><span class="card co-upcard${card.edition ? ' ed-' + esc(card.edition) : ''}" aria-hidden="true">${layers(cardFace(card).html)}</span><div class="co-up-t"><span class="v-name ${kindCls}">${esc(name)}</span>${lines.filter(Boolean).map((l) => `<p class="copy">${rt(l)}</p>`).join('')}</div></li>`;
    const suits = ['H', 'S', 'D', 'C'];
    const en = list('ENHANCEMENTS').map((r, i) => row({ rank: 14 - (i % 5) * 2, suit: suits[i % 4], enhancement: r.id }, r.name, [r.text], 'kind-enh')).join('');
    const ed = list('EDITIONS').map((r, i) => row({ rank: 12 - i, suit: suits[(i + 1) % 4], edition: r.id }, r.name, [r.cardText ? `On a card: ${r.cardText}` : r.text, r.jokerText ? `On a Joker: ${r.jokerText}` : ''], 'kind-edition')).join('');
    const se = list('SEALS').map((r, i) => row({ rank: 10 - i, suit: suits[(i + 2) % 4], seal: r.id }, r.name, [r.text], 'kind-seal')).join('');
    const grp = (title, n, items) => `<section class="co-grp"><h3 class="co-gh"><span class="v-name">${esc(title)}</span><span class="lbl">${n}</span></h3><ul class="co-ups">${items}</ul></section>`;
    return grp('Enhancements', list('ENHANCEMENTS').length, en) + grp('Editions', list('EDITIONS').length, ed) + grp('Seals', list('SEALS').length, se);
  }
  function renderCollection(focusTab) {
    const root = $('.scr-collection');
    if (!root) return;
    const tab = CO_TABS.some(([id]) => id === S.coTab) ? S.coTab : 'jokers';
    S.coTab = tab;
    $$('.co-tab', root).forEach((t) => { const on = t.dataset.tab === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    const panel = $('#coPanel', root);
    panel.setAttribute('aria-labelledby', 'coTab-' + tab);
    CO.items.clear();
    if (tab === 'upgrades') panel.innerHTML = `<p class="copy co-note">Enhancements, Editions and Seals are always listed: every one can turn up on your cards.</p>${upgradesHTML()}`;
    else {
      let first = true;
      panel.innerHTML = coData(tab).map((g) => {
        const found = g.items.filter((it) => it.found).length;
        const items = g.items.map((it) => { const h = coItemHTML(it, first); first = false; return h; }).join('');
        return `<section class="co-grp"><h3 class="co-gh"><span class="v-name ${esc(g.cls)}">${esc(g.title)}</span><span class="lbl">${tab === 'decks' ? 'Unlocked' : 'Found'} ${found} of ${g.items.length}</span></h3><div class="co-grid${g.items.some((it) => it.token) ? ' is-tokens' : ''}">${items}</div></section>`;
      }).join('');
    }
    panel.scrollTop = 0;
    if (focusTab) { const t = $(`#coTab-${tab}`, root); if (t) t.focus(); }
  }
  function mountCollection(app) {
    const root = el('div', { class: 'scr scr-collection' });
    const plate = el('section', { class: 'panel dlg-frame co-plate', 'aria-labelledby': 'coTitle' });
    let found = 0, total = 0;
    ['jokers', 'consumables', 'vouchers', 'tags', 'bosses'].forEach((t) => { const [f, n] = coCount(t); found += f; total += n; });
    plate.append(el('div', { class: 'p-head' }, el('h1', { class: 'tag t-vio', id: 'coTitle', text: 'Collection' }), el('p', { class: 'co-total lbl', html: `Found ${numHTML(`${found}/${total}`, 'S', 'cream')}` }), btn('Back', 'back', 'b-cream', 'arrow-left')));
    const tabs = el('div', { class: 'co-tabs', role: 'tablist', 'aria-label': 'Collection' });
    CO_TABS.forEach(([id, label]) => {
      const [f, n] = coCount(id);
      const b = el('button', { type: 'button', class: 'co-tab', role: 'tab', id: 'coTab-' + id, 'aria-controls': 'coPanel', 'aria-selected': 'false', 'data-action': 'co-tab', 'data-tab': id });
      b.append(el('span', { class: 'co-tl', text: label }), el('span', { class: `co-tn${f === n && n ? ' is-full' : ''}`, text: `${f}/${n}` }));
      b.setAttribute('aria-label', `${label}, ${f} of ${n}`);
      tabs.append(b);
    });
    plate.append(tabs, el('div', { class: 'co-panel', id: 'coPanel', role: 'tabpanel' }));
    root.append(plate);
    app.append(root);
    renderCollection();
    later(0, () => placePool(plate));
    riseIn([plate], 40);
    focusFirst($('.co-tab[aria-selected="true"]', plate));
  }
  /** Arrow keys, Home and End in a grid of one Tab stop (the Collection's items, the deck view's cards). */
  function moveGridFocus(cur, key, list) {
    const items = list || $$('.co-item', $('#coPanel'));
    const i = items.indexOf(cur);
    if (i < 0) return false;
    let j = i;
    if (key === 'ArrowRight') j = i + 1;
    else if (key === 'ArrowLeft') j = i - 1;
    else if (key === 'Home') j = 0;
    else if (key === 'End') j = items.length - 1;
    else if (key === 'ArrowDown' || key === 'ArrowUp') {
      const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, down = key === 'ArrowDown';
      let best = -1, score = Infinity;
      items.forEach((n, k) => {
        if (k === i) return;
        const q = n.getBoundingClientRect(), dy = down ? q.top - r.bottom : r.top - q.bottom;
        if (dy < -2) return;
        const s = dy * 4 + Math.abs(q.left + q.width / 2 - cx);
        if (s < score) { score = s; best = k; }
      });
      if (best < 0) return true;
      j = best;
    } else return false;
    j = UI.clamp(j, 0, items.length - 1);
    items.forEach((n, k) => { n.tabIndex = k === j ? 0 : -1; });
    items[j].focus();
    try { items[j].scrollIntoView({ block: 'nearest' }); } catch (err) { /* old engines */ }
    return true;
  }
  UI.register('collection', {
    mount(app) { mountCollection(app); },
    update() { renderCollection(); },
    key(e) {
      const k = e.key, t = e.target;
      if (k === 'Escape') { UI.show('title'); return true; }
      if (t && t.closest && t.closest('.co-tabs') && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End')) {
        const ids = CO_TABS.map(([id]) => id);
        let i = ids.indexOf(S.coTab);
        i = k === 'Home' ? 0 : k === 'End' ? ids.length - 1 : (i + (k === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
        S.coTab = ids[i];
        UI.sfx('flip');
        renderCollection(true);
        return true;
      }
      if (t && t.classList && t.classList.contains('co-item')) return moveGridFocus(t, k);
      return false;
    },
  });
  UI.registerTip('.co-item[data-co]', (n) => {
    const it = CO.items.get(n.dataset.co);
    if (!it) return null;
    if (!it.found && !it.showLocked) return UI.tipHTML({ name: 'Not discovered yet', kind: it.subLocked, kindCls: it.rarity ? 'rar-' + it.rarity : 'kind-' + it.kind, text: 'Find it in a run to learn what it does.' });
    if (!it.found) return UI.tipHTML({ name: it.name, kind: 'Locked', kindCls: 'kind-boss', text: it.text, warn: it.unlock || '' });
    return UI.tipHTML({ name: it.name, kind: it.sub, kindCls: it.rarity ? 'rar-' + it.rarity : 'kind-' + it.kind, text: it.text });
  });

  // ================================================================== Game Over and You win!
  function causeHTML(run, won) {
    const b = run && run.blind;
    if (!b) return '';
    const boss = b.boss ? C.boss(b.boss) : null;
    const name = boss ? boss.name : C.blind(b.kind).name;
    const token = boss ? emblemHTML(boss.id, boss.name) : candleHTML(b.kind, !won);
    const line = won ? `Beaten with ${fmt(b.score)}. The target was ${fmt(b.target)}.` : `Needed ${fmt(b.target)}. You scored ${fmt(b.score)}.`;
    return `<div class="es-cause"><div class="es-tok">${token}</div><div class="es-cause-t"><span class="b-name">${esc(name)}</span><p class="copy">${esc(line)}</p></div></div>`;
  }
  /** The run as a row of Ante candles, one per Ante: lit for every Ante cleared (all eight on a win), the one the
      run ended on burnt out, the rest never lit. An irregular group (two heights, whole-pixel steps), never a strip. */
  function antesHTML(reached, won) {
    const lit = won ? 8 : Math.max(0, Math.min(8, (Number(reached) || 1) - 1));
    const drop = [0, 2, 1, 3, 0, 2, 1, 0];
    const label = won ? 'All eight Antes cleared.' : `${lit} of 8 Antes cleared.`;
    return `<div class="es-antes" role="img" aria-label="${esc(label)}">${Array.from({ length: 8 }, (_, i) => `<span class="es-ante${i < lit ? ' is-lit' : ''}" style="--dy:${drop[i]}">${candleHTML(i % 3 === 1 ? 'big' : 'small', i >= lit)}</span>`).join('')}</div>`;
  }
  function endStatsHTML(st) {
    const best = st.bestHand ? `<span class="n g-score">${numHTML(fmt(st.bestHand.score), 'L', 'score')}</span><span class="copy es-sub">${esc(st.bestHand.name || C.hand(st.bestHand.handId).name)}</span>` : '<span class="copy k-dim">None</span>';
    const most = st.mostPlayed ? `<span class="copy es-sub es-strong">${esc(st.mostPlayed.name || C.hand(st.mostPlayed.handId).name)}</span><span class="lbl">${esc(`${st.mostPlayed.plays} ${UI.plural(st.mostPlayed.plays, 'time')}`)}</span>` : '<span class="copy k-dim">None</span>';
    const cell = (label, inner, cls = '') => `<div class="es-cell ${cls}"><dt class="lbl">${esc(label)}</dt><dd>${inner}</dd></div>`;
    // the counts are a quiet list beside the two hands that tell the run: small figures, no tiles of their own
    const n = (v, style = 'cream') => `<span class="n g-cream">${numHTML(fmt(v || 0), 'S', style)}</span>`;
    return `<dl class="es-stats">${cell('Brightest hand', best, 'is-wide')}${cell('Favourite hand', most, 'is-wide')}${cell('Ante reached', n(st.ante, 'ember'))}${cell('Hands played', n(st.handsPlayed))}${cell('Cards tossed', n(st.cardsDiscarded))}${cell('Blinds cleared', n(st.blindsCleared, 'lime'))}${cell('Blinds skipped', n(st.blindsSkipped))}${cell('Money earned', `<span class="n g-money">${numHTML('$' + fmt(st.moneyEarned || 0), 'S', 'money')}</span>`)}</dl>`;
  }
  function mountEnd(app, won) {
    const run = R();
    const st = UI.q('stats') || {};
    const deck = run ? C.deck(run.deckId) : null, stake = run ? C.stake(run.stake) : null;
    const root = el('div', { class: `scr scr-end ${won ? 'is-won' : 'is-lost'}` });
    const plate = el('section', { class: 'panel dlg-frame es-plate', 'aria-labelledby': 'esTitle' });
    const h1 = el('h1', { class: 'es-word', id: 'esTitle' }, el('span', { class: 'sr', text: won ? 'You win!' : 'Game Over' }));
    h1.append(word(won ? 'YOU WIN!' : 'GAME OVER', { size: 'XL', ink: won ? 'lime' : 'pink' }));
    plate.insertAdjacentHTML('afterbegin', antesHTML(st.ante || (run ? run.ante : 1), won));
    const sub = won
      ? `You cleared all eight Antes on ${stake ? stake.name : 'this Stake'} with the ${deck ? deck.name : 'Deck'}.`
      : `Your run ended on Ante ${st.ante || (run ? run.ante : 1)} with the ${deck ? deck.name : 'Deck'} on ${stake ? stake.name : 'this Stake'}.`;
    plate.append(h1, el('p', { class: 'es-sub-line copy', text: sub }));
    plate.insertAdjacentHTML('beforeend', causeHTML(run, won) + endStatsHTML(st));
    const seed = st.seed || (run && run.seed) || '';
    if (seed) plate.append(el('div', { class: 'es-seed' }, el('span', { class: 'lbl', text: 'Seed' }), el('output', { class: 'seed-val', text: seed }), btn('Copy', 'copy-seed', 'b-cream sm', null, { 'data-seed': seed, 'aria-label': `Copy the seed ${seed}` })));
    const acts = el('div', { class: 'es-acts' });
    if (won) acts.append(btn('Endless mode', 'endless', 'b-ember big'), btn('Return to title', 'to-title', 'b-cream big'));
    else acts.append(btn('New run', 'new-run', 'b-ember big'), btn('Return to title', 'to-title', 'b-cream big'));
    plate.append(acts);
    if (won) plate.append(el('p', { class: 'copy k-dim es-endless', text: 'Endless mode keeps this run going past Ante 8, with the targets climbing every Ante.' }));
    root.append(plate);
    app.append(root);
    later(0, () => placePool(plate));
    riseIn([plate], 60);
    const best = st.bestHand ? `Brightest hand ${st.bestHand.name || ''}, ${fmt(st.bestHand.score)}.` : '';
    const un = typeof UI.takeUnlocked === 'function' ? UI.takeUnlocked() : [];
    UI.announce(`${won ? 'You win!' : 'Game Over.'} Ante ${st.ante || (run ? run.ante : 1)}. ${best}${un.length ? ` Unlocked: ${UI.listJoin(un)}.` : ''}`);
    // a run lost some other way than the last hand (nothing left to draw, a card that cost the last hand) still ends on the candle going out
    if (!won && typeof UI.sfxAge === 'function' && UI.sfxAge('lose') > 4000) UI.sfx('lose');
    // the celebration plays once per win, not again when a phone turns and the screen is laid out anew
    if (won && S.cheered !== run) {
      S.cheered = run;
      UI.sfx('win', { intensity: 1 });
      later(UI.TEST ? 0 : 420, () => {
        const w = $('.es-word .pw', plate);
        if (!w || !UI.motionOK()) return;
        const r = w.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (UI.table && UI.table.burst) { UI.table.burst(x, y, ['#C3F26E', '#FFD29C', '#FF80BA', '#A9B8FF', '#FFF0D8'], 36, 1.6, [1, 2], 1.2); }
        if (UI.table && UI.table.ring) { UI.table.ring(x, y, r.width * 1.1, 820, 0, '196, 242, 110'); UI.table.ring(x, y, r.width * 1.4, 900, 140, '255, 76, 155'); }
        const f = UI.room && UI.room.flashAt ? UI.room.flashAt(x, y) : null;
        if (f) anim(f, [{ opacity: 0 }, { opacity: 0.9, offset: 0.2 }, { opacity: 0 }], { d: 900, e: EASE.out, raw: true });
      });
    }
    focusFirst($('.es-acts .btn', plate));
  }
  UI.register('gameover', { mount(app) { mountEnd(app, false); }, update() {} });
  UI.register('win', { mount(app) { mountEnd(app, true); }, update() {} });

  // ================================================================== actions
  function pauseBox() { return S.pause && S.pause.el && S.pause.el.isConnected ? $('.pz', S.pause.el) : null; }
  function saveQuit() {
    if (R()) { UI.saveRun(); UI.setRun(null); }
    S.abandon = false;
    // "Run saved" only when the save reached storage: a full storage keeps the run in memory, until the page closes
    const note = UI.saveQuitNote();
    UI.toast(note.text, note.saved ? 'info' : 'err');
    UI.show('title');
  }
  function abandonRun() {
    const run = R();
    if (run && !run.recorded) UI.updateRecords(true);
    UI.endRun();
    S.abandon = false;
    UI.sfx('discard');
    UI.toast('Run abandoned.', 'info');
    UI.show('title');
  }
  function eraseRecords() {
    const e = E(), cur = UI.records();
    const fresh = e && typeof e.defaultRecords === 'function' ? e.defaultRecords() : null;
    if (fresh && cur) { Object.keys(cur).forEach((k) => { delete cur[k]; }); Object.assign(cur, fresh); UI.saveRecords(); }
    else UI.store.remove('records');
    S.erase = false;
    UI.sfx('discard');
    UI.toast('Records erased.', 'info');
    // what shows records under the dialog follows: the title's Past runs
    const past = $('.tt-past');
    if (past) { $$('.hist, .tt-sum, .tt-empty', past).forEach((n) => n.remove()); past.append(el('p', { class: 'copy k-dim tt-empty', text: 'No runs yet. Every run you finish is kept here.' })); }
  }
  async function copySeed(seed, b) {
    if (!seed) return;
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(seed); ok = true; } } catch (err) { ok = false; }
    if (!ok) {
      try {
        const ta = el('textarea', { class: 'sr', readonly: true, 'aria-hidden': 'true' });
        ta.value = seed;
        document.body.append(ta);
        ta.select();
        ok = !!(document.execCommand && document.execCommand('copy'));
        ta.remove();
      } catch (err) { ok = false; }
      if (b && b.isConnected) b.focus({ preventScroll: true });
    }
    if (ok) { UI.sfx('tag'); UI.toast(`Seed ${seed} copied.`, 'good', 2200); }
    else {
      const out = b && b.parentElement ? $('.seed-val', b.parentElement) : null;
      if (out) { try { const range = document.createRange(); range.selectNodeContents(out); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); } catch (err) { /* nothing to select */ } }
      UI.toast(`Seed ${seed}. It is selected: copy it from here.`, 'info', 3200);
    }
  }
  const A = UI.registerAction;
  A('new-run', () => {
    const run = R();
    if (run && (run.phase === 'gameover' || run.phase === 'win')) { if (!run.recorded) UI.updateRecords(true); UI.endRun(); }
    UI.show('setup');
  });
  A('open-collection', () => UI.show('collection'));
  A('open-records', () => UI.show('records'));
  A('open-help', () => UI.openOverlay('help'));
  A('open-credits', () => UI.openOverlay('credits'));
  // on the table the Options button opens Pause, which holds Options (the genre's menu); elsewhere it opens Options
  A('open-options', () => UI.openOverlay(UI.inRun() ? 'pause' : 'options'));
  A('pause-options', () => UI.openOverlay('options'));
  A('deck-prev', () => stepDeck(-1));
  A('deck-next', () => stepDeck(1));
  A('stake-prev', () => stepStake(-1));
  A('stake-next', () => stepStake(1));
  A('pick-stake', (b) => { if (b.dataset.stake && b.dataset.stake !== S.stake) { S.stake = b.dataset.stake; UI.sfx('flip'); renderSetup(); const n = $(`.stk[data-stake="${S.stake}"]`); if (n) n.focus({ preventScroll: true }); } });
  A('start-run', () => startFromSetup());
  A('back', () => UI.show('title'));
  A('resume', () => { if (S.pause) UI.closeDialog(S.pause); else UI.closeDialog(); });
  A('save-quit', () => saveQuit());
  A('abandon', () => { S.abandon = true; const box = pauseBox(); if (box) { renderPause(box); const c = $('[data-action="cancel-abandon"]', box); if (c) UI.focusQuiet(c); } });
  A('cancel-abandon', () => { S.abandon = false; const box = pauseBox(); if (box) { renderPause(box); const c = $('[data-action="abandon"]', box); if (c) UI.focusQuiet(c); } });
  A('confirm-abandon', () => abandonRun());
  A('set-speed', (b) => { UI.setSetting('speed', Number(b.dataset.value)); syncOptions(b.closest('.op')); });
  A('set-motion', (b) => { UI.setSetting('motion', b.dataset.value); syncOptions(b.closest('.op')); });
  A('toggle-shake', (b) => { UI.setSetting('shake', !UI.settings().shake); syncOptions(b.closest('.op')); });
  A('toggle-four-color', (b) => {
    const on = !UI.settings().fourColor;
    UI.setSetting('fourColor', on);
    syncOptions(b.closest('.op'));
    UI.announce(on ? 'Colour-coded suits on: Clubs are green and Diamonds blue.' : 'Colour-coded suits off.');
  });
  A('toggle-mute', (b) => { setMuted(!MUTED); syncOptions(b.closest('.op')); if (!MUTED) UI.sfx('button'); });
  A('toggle-keys', (b) => { UI.setSetting('keys', UI.settings().keys === false); syncOptions(b.closest('.op')); });
  A('erase-records', (b) => { S.erase = true; const box = b.closest('.op'); syncOptions(box); const c = box && $('[data-action="cancel-erase"]', box); if (c) UI.focusQuiet(c); });
  A('cancel-erase', (b) => { S.erase = false; const box = b.closest('.op'); syncOptions(box); const c = box && $('[data-action="erase-records"]', box); if (c) UI.focusQuiet(c); });
  A('confirm-erase', (b) => { const box = b.closest('.op'); eraseRecords(); syncOptions(box); const c = box && $('[data-action="erase-records"]', box); if (c) UI.focusQuiet(c); });
  A('copy-seed', (b) => { copySeed(b.dataset.seed, b); });
  A('help-page', (b) => { const box = b.closest('.hp-dlg'); if (box) { renderHelp(box, Number(b.dataset.page) || 0); UI.sfx('flip'); } });
  A('help-prev', (b) => { const box = b.closest('.hp-dlg'); if (box) { renderHelp(box, S.helpPage - 1); UI.sfx('flip'); } });
  A('help-next', (b) => { const box = b.closest('.hp-dlg'); if (box) { renderHelp(box, S.helpPage + 1); UI.sfx('flip'); } });
  A('co-tab', (b) => { if (b.dataset.tab && b.dataset.tab !== S.coTab) { S.coTab = b.dataset.tab; UI.sfx('flip'); renderCollection(); } });

  // ================================================================== tooltips for these screens
  UI.registerTip('.dv-card[data-uid]', (n) => {
    const run = R();
    const c = run && (run.cards || []).find((x) => x.uid === n.dataset.uid);
    if (!c) return null;
    const lines = (UI.q('cardText', c.uid) || []).slice(1);
    const chips = E() && E().cardChips ? E().cardChips(c) : 0;
    const kind = [c.enhancement && C.enhancement(c.enhancement).name, c.edition && C.edition(c.edition).name, c.seal && C.seal(c.seal).name].filter(Boolean).join(', ');
    return UI.tipHTML({ name: `${UI.rankWord(c.rank)} of ${UI.suitName(c.suit)}`, kind: kind || `+${chips} Chips when scored`, kindCls: kind ? 'kind-enh' : '', lines: kind ? lines : [], warn: n.classList.contains('is-out') ? 'Drawn this Blind.' : '' });
  }, { describe: true });
  UI.registerTip('.stk[data-stake]', (n) => {
    const k = C.stake(n.dataset.stake);
    if (!k) return null;
    const open = stakeOpen(k.id);
    return UI.tipHTML({ name: k.name, kind: open ? 'Stake' : 'Locked Stake', kindCls: 'kind-boss', text: k.text, warn: open ? '' : k.unlock || '' });
  });

  // keep the wordmark at the right size when the window crosses a breakpoint
  let rsz = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rsz);
    rsz = setTimeout(() => {
      const wm = $('.scr-title .wm');
      if (wm) {
        const cur = $('.pw', wm), want = wordmarkSize();
        if (cur && !cur.classList.contains('pw-' + want.toLowerCase())) { cur.replaceWith(wordmark()); }
        const menu = $('.tt-menu'); if (menu) placePool(menu);
      }
      const plate = $('.su-plate, .rc-plate, .co-plate, .es-plate');
      if (plate) placePool(plate);
    }, 140);
  });
  // A new layout or pixel size (a phone turned, a window resized or snapped across 1024 px wide or 870 px tall) only
  // redraws what is drawn for one pixel size: the lettering (the glow under each letter is baked at that size; the
  // wordmark also changes face), the name plates (their words are chosen for the plate's width at that size: the
  // Collection's tiles, How to play's cards) and the pool of light under the plate. The screen is not mounted anew, so
  // an open dialog stays open with its focus, and Game Over neither sounds nor announces again. An open dialog's
  // plates (How to play, opened from the title or from Pause on any screen) are set again whatever the screen; the
  // table, the Shop and a pack draw their own again (final pass, part 3: 51 of the Collection's 120 plates and How to
  // play's were cut mid-letter).
  function relight() {
    UI.replate($('#dialogs'));
    if (!['title', 'setup', 'records', 'collection', 'gameover', 'win'].includes(UI.screen())) return;
    UI.replate($('#app'));
    $$('.pw').forEach((n) => {
      const w = n.pwWord;
      if (!w || !n.isConnected) return;
      n.replaceWith(word(w.text, w.o.wm ? Object.assign({}, w.o, { size: wordmarkSize() }) : w.o));
    });
    const plate = $('.tt-menu, .su-plate, .rc-plate, .co-plate, .es-plate');
    if (plate) placePool(plate);
  }
  UI.onBreakpoint(relight);

  UI.menus = { art, rt, mark, word, startStats, muted: () => MUTED, setMuted, helpPages: () => HELP.map((p) => p.id), collectionTabs: () => CO_TABS.map(([id]) => id) };
})();
