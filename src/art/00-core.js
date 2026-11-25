/* Wickwager art core: TW.Art, the Ember Lit pixel-art kit and the sprite registry (ARCH.md section 4).
 *
 * The kit is ported from mockups/ember-lit/art.js with its behaviour unchanged: every Lit sprite drawn
 * through it is pixel-identical to the mockup. Each sprite is a grid of art pixels in a Bmp (one colour
 * string per pixel), shaded from hue-shifted ramps of 6 to 9 shades and lit from the upper left, with a
 * 1-art-px ink edge. Glow, bloom, shadows and light are CSS layers the UI owns, never sprite pixels.
 *
 * DOM-free: everything here returns bitmaps and runs in Node. Only TW.Art.url(id) touches the DOM (a canvas,
 * once per sprite, to make a PNG data URL); it returns null when there is no document.
 *
 * Registry (ARCH section 4; how to add each kind of sprite is in src/art/ART.md):
 *   TW.Art.define(id, { w, h, make(kit) -> Bmp })   lazy: make() runs once on first use, then cached
 *   TW.Art.has(id), TW.Art.ids(prefix?), TW.Art.bitmap(id) -> { w, h, data } | null, TW.Art.url(id)
 *   TW.Art.card({ rank, suit, enhancement, seal, edition }) -> 'card:{rank}{suit}|{enh}|{seal}|{edition}'
 *   TW.Art.card({ ..., fourColor: true }) -> 'card4:{rank}{suit}|{enh}|{seal}|{edition}' (colour-coded suits)
 *   TW.Art.stockMask(cardId) -> 'mask:{cardId}': white on the card's bare stock, clear on its face, marks and Seal
 *   TW.Art.kit: the drawing kit (frozen all the way down)
 *   TW.Art.warm(ids | prefix, { budget }) -> Promise: draws and encodes sprites in idle time, ahead of need
 *   helpers: joker, tarot, planet, spectral, voucher, pack, tag, boss, stake, back, court,
 *   and the card-mod hooks enhancement, seal, edition.
 */
(() => {
  'use strict';
  const TW = (globalThis.TW = globalThis.TW || {});

  // ------------------------------------------------------------ palette and ramps (mirrored as CSS tokens in the UI)
  const C = {
    edge: '#2B1220', ink0: '#13070F', ink: '#1E0D19', ink2: '#2A1423', ink3: '#33182C',
    plum: '#3C2132', plum2: '#4D2B40', plum3: '#6A3D55', plum4: '#8C5671',
    white: '#FFFCF5', cream: '#FFF3E0', cream1: '#FBE7CB', cream2: '#F2D3AE', cream3: '#DDB08A', cream4: '#BD8C6C', cream5: '#8F6150',
    line: '#F0BE96',
    chip: '#4A62FF', mult: '#E9382B', money: '#FFCE3B', lime: '#9EE03C', pink: '#FF4C9B', ember: '#FF7A2B', vio: '#8B46EE', acid: '#CFFF2F',
    bands: ['#2C1535', '#40173F', '#5A1A41', '#761F3C', '#922B35', '#AE402C', '#C65A26'],
  };
  // Every ramp runs dark to light. Shadows lean toward plum and red, highlights toward warm white.
  const R = {
    cream: ['#6E4636', '#8F6150', '#BD8C6C', '#DDB08A', '#F2D3AE', '#FBE7CB', '#FFF3E0', '#FFFCF5'],
    chips: ['#0D1140', '#141A5E', '#1C2489', '#2734B5', '#3346D6', '#4A62FF', '#7C8FFF', '#A9B8FF', '#D5DCFF'],
    mult: ['#3A0812', '#5C0D1B', '#7E1222', '#A51A27', '#C8262F', '#E9382B', '#FF8F78', '#FFB9A6', '#FFE3DA'],
    money: ['#5A3008', '#7E4A0E', '#A86814', '#D18A1D', '#EBAA2A', '#FFCE3B', '#FFE070', '#FFF0A0', '#FFFAD6'],
    lime: ['#1C3A0A', '#2F5A12', '#3F7317', '#5A9A1F', '#7CC12C', '#9EE03C', '#C3F26E', '#E2FFA6', '#F4FFD6'],
    pink: ['#3E0824', '#5E0F38', '#87154C', '#B21F67', '#E2337F', '#FF4C9B', '#FF80BA', '#FFB2D6', '#FFE3F0'],
    ember: ['#4A1A08', '#6E2A10', '#943B13', '#C24F1A', '#E8611F', '#FF7A2B', '#FFA458', '#FFD29C', '#FFF0D8'],
    vio: ['#1E0B42', '#2E1160', '#3E1880', '#5320A0', '#6F33C9', '#8B46EE', '#AC7BFF', '#CDA8FF', '#EBDDFF'],
    acid: ['#3E5508', '#5E7A0E', '#86B814', '#A9DB1E', '#CFFF2F', '#E6FF8A', '#F6FFD0'],
    peach: ['#5A2A1A', '#7E3F28', '#A85C3E', '#C98C6A', '#E0A884', '#F0BE96', '#F8D6B8', '#FFEBD8'],
    red: ['#4A0820', '#7D1030', '#B31B3D', '#E0294B', '#FF6B86', '#FF9DAC', '#FFD3DA'],
    dark: ['#0F0B22', '#16112F', '#272152', '#3A3270', '#5F55A8', '#8E84D6', '#C4BDF0'],
    wood: ['#2E140A', '#4A2213', '#6A331B', '#8E4826', '#B0623A', '#D08A52', '#ECB57E'],
    ghost: ['#1A2350', '#2E4078', '#4D6CA8', '#7FA6D6', '#AED8F0', '#D9F4FF', '#F4FCFF'],
    night: ['#08091F', '#0E1130', '#141844', '#1B2058', '#232A6B', '#2E3780', '#3C4796'],
    steel: ['#3A4258', '#5A6580', '#8692AA', '#B3BDCE', '#DCE3EC', '#F6F9FC'],
    plum: ['#13070F', '#1E0D19', '#2A1423', '#3C2132', '#4D2B40', '#6A3D55', '#8C5671', '#B07A90'],
    gold: ['#4A2606', '#7E4A0E', '#B07418', '#E09A22', '#FFC43A', '#FFE07A', '#FFF6C8'],
    // added for the game (not in the Lit mockup): brass for Tag tokens, maroon for the Joker Pack and
    // ticket plates, navy for the Ghost Pack and Spectral things. Same rule: plum shadows, warm highlights.
    brass: ['#3A1E10', '#5E3518', '#86542A', '#AE7A3C', '#CFA052', '#E8C474', '#F8E2A8'],
    maroon: ['#2A0714', '#43101F', '#5E1A2C', '#7A2638', '#983648', '#B8505E', '#D8787E', '#F2A8A2'],
    navy: ['#0C0F2A', '#141A44', '#1E2658', '#283270', '#344088', '#4652A0', '#5C6AB8'],
  };
  const deepFreeze = (o) => { Object.values(o).forEach((v) => { if (v && typeof v === 'object') Object.freeze(v); }); return Object.freeze(o); };
  deepFreeze(C); deepFreeze(R);

  // ------------------------------------------------------------ bitmaps and masks
  const hexRGBA = (() => {
    const m = new Map();
    return (h) => {
      if (m.has(h)) return m.get(h);
      let v;
      if (typeof h === 'string' && h[0] === '#') {
        let s = h.replace('#', '');
        if (s.length === 3 || s.length === 4) s = [...s].map((ch) => ch + ch).join(''); // #RGB, #RGBA
        v = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)).concat(s.length > 6 ? parseInt(s.slice(6, 8), 16) : 255);
      } else if (typeof h === 'string' && /^rgba?\(/i.test(h)) {
        const n = h.match(/[\d.]+/g).map(Number);
        v = [n[0], n[1], n[2], n.length > 3 ? Math.round(n[3] * 255) : 255];
      } else v = [0, 0, 0, 0];
      m.set(h, v);
      return v;
    };
  })();
  const hex2 = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0').toUpperCase();
  /** Source-over: colour src (may carry alpha, #RRGGBBAA) laid over dst (or over nothing). */
  function blendHex(dst, src) {
    const s = hexRGBA(src);
    if (s[3] >= 255 || !dst) return src;
    const d = hexRGBA(dst), a = s[3] / 255, A = d[3] / 255, oa = a + A * (1 - a);
    if (oa <= 0) return null;
    const ch = (i) => (s[i] * a + d[i] * A * (1 - a)) / oa;
    return '#' + hex2(ch(0)) + hex2(ch(1)) + hex2(ch(2)) + (oa >= 1 ? '' : hex2(oa * 255));
  }
  /** Rows of a grid, checked: every row must be the same width. */
  function grid(src) {
    const g = typeof src === 'string' ? src.split('\n').map((r) => r.trim()).filter(Boolean) : src;
    const w = g[0].length;
    g.forEach((row, i) => { if (row.length !== w) throw new Error(`grid row ${i} is ${row.length} wide, not ${w}: "${row}"`); });
    return g;
  }

  class Bmp {
    constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
    in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    get(x, y) { return this.in(x, y) ? this.p[y * this.w + x] : null; }
    set(x, y, c) { if (c && this.in(x, y)) this.p[y * this.w + x] = c; return this; }
    del(x, y) { if (this.in(x, y)) this.p[y * this.w + x] = null; return this; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
    /** Stamp a grid; key maps characters to colours. */
    draw(g, x0, y0, key, o = {}) {
      const gr = grid(g);
      const H = gr.length;
      gr.forEach((row, j) => {
        const W = row.length;
        for (let i = 0; i < W; i++) {
          const ch = row[i];
          if (ch === '.' || ch === ' ') continue;
          const col = key[ch];
          if (col === undefined) throw new Error(`sprite colour key "${ch}" is undefined`);
          this.set(o.flipX ? x0 + (W - 1 - i) : x0 + i, o.flipY ? y0 + (H - 1 - j) : y0 + j, col);
        }
      });
      return this;
    }
    line(x0, y0, x1, y1, c, w = 1) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy, x = x0, y = y0;
      for (;;) {
        this.rect(x, y, w, w, c);
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
      return this;
    }
    blit(src, x0, y0, o = {}) {
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (!c) continue;
        const tx = o.flipX ? x0 + src.w - 1 - x : x0 + x, ty = o.flipY ? y0 + src.h - 1 - y : y0 + y;
        if (o.clip && !o.clip(tx, ty)) continue;
        this.set(tx, ty, c);
      }
      return this;
    }
    /** A 1-px outline on empty pixels around everything not already that colour. */
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
    mask() { const k = new Mask(this.w, this.h); this.p.forEach((c, i) => { if (c) k.m[i] = 1; }); return k; }
    recolor(map) { this.p = this.p.map((c) => (c && map[c] !== undefined ? map[c] : c)); return this; }
    // ---- added for the game (Lit drew through a canvas; the game keeps pixels as data)
    /** Lay a colour with alpha (#RRGGBBAA) over the pixel already there. */
    mix(x, y, c) { if (c && this.in(x, y)) { const i = y * this.w + x; this.p[i] = blendHex(this.p[i], c); } return this; }
    clone() { const b = new Bmp(this.w, this.h); b.p = this.p.slice(); return b; }
    /** The pixels as RGBA bytes, row by row (what TW.Art.bitmap returns). */
    rgba() {
      const d = new Uint8ClampedArray(this.w * this.h * 4);
      for (let i = 0; i < this.p.length; i++) {
        const c = this.p[i];
        if (c) { const v = hexRGBA(c), j = i * 4; d[j] = v[0]; d[j + 1] = v[1]; d[j + 2] = v[2]; d[j + 3] = v[3]; }
      }
      return d;
    }
  }

  class Mask {
    constructor(w, h) { this.w = w; this.h = h; this.m = new Uint8Array(w * h); }
    in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    get(x, y) { return this.in(x, y) ? this.m[y * this.w + x] : 0; }
    set(x, y, v = 1) { if (this.in(x, y)) this.m[y * this.w + x] = v; return this; }
    static fn(w, h, f) { const k = new Mask(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (f(x, y)) k.m[y * w + x] = 1; return k; }
    static rows(src, on = (ch) => ch !== '.' && ch !== ' ') { const g = grid(src); return Mask.fn(g[0].length, g.length, (x, y) => on(g[y][x])); }
    flipY() { return Mask.fn(this.w, this.h, (x, y) => this.get(x, this.h - 1 - y)); }
    flipX() { return Mask.fn(this.w, this.h, (x, y) => this.get(this.w - 1 - x, y)); }
    or(o, dx = 0, dy = 0) { for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) if (o.get(x, y)) this.set(x + dx, y + dy); return this; }
    sub(o, dx = 0, dy = 0) { for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) if (o.get(x, y)) this.set(x + dx, y + dy, 0); return this; }
    and(f) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y) && !f(x, y)) this.set(x, y, 0); return this; }
  }
  /** Flags (row by row, 1 or 0) for the mask's outer edge: its pixels with an empty 4-neighbour. Computed once
      per mask, so the shape code asks a flat array instead of building neighbour lists for every pixel. */
  function edgeFlags(k) {
    const { w, h } = k, E = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (k.m[y * w + x] && (!k.get(x + 1, y) || !k.get(x - 1, y) || !k.get(x, y + 1) || !k.get(x, y - 1))) E[y * w + x] = 1;
    return E;
  }

  // Light comes from the upper left and a little in front, the same for every sprite.
  const LIGHT = (() => { const v = [-0.55, -0.72, 0.78]; const l = Math.hypot(...v); return v.map((n) => n / l); })();
  /** Shade a mask like a soft pillow: a height field from the distance to its edge, lit from the upper left. */
  function emboss(k, ramp, o = {}) {
    const { w, h } = k;
    const cap = o.cap ?? 3, depth = o.depth ?? 1.3, gain = o.gain ?? 5.5;
    const base = o.base ?? Math.round((ramp.length - 1) * 0.55);
    const d = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) d[i] = k.m[i] ? 1e6 : 0;
    const D = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (d[i]) d[i] = Math.min(d[i], D(x - 1, y) + 1, D(x, y - 1) + 1, D(x - 1, y - 1) + 1.414, D(x + 1, y - 1) + 1.414); }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (d[i]) d[i] = Math.min(d[i], D(x + 1, y) + 1, D(x, y + 1) + 1, D(x + 1, y + 1) + 1.414, D(x - 1, y + 1) + 1.414); }
    const H = (x, y) => Math.min(D(x, y), cap) / cap;
    const flat = LIGHT[2];
    const out = new Bmp(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!k.get(x, y)) continue;
      let nx = (H(x - 1, y) - H(x + 1, y)) * depth, ny = (H(x, y - 1) - H(x, y + 1)) * depth, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const diff = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / l;
      let idx = Math.round(base + (diff - flat) * gain + (o.tilt ? o.tilt(x, y) : 0));
      out.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, idx))]);
    }
    return out;
  }
  /** Shade a sphere-like disc with a soft terminator and a highlight. */
  function sphere(r, ramp, o = {}) {
    const s = Math.ceil(r * 2 + 1), b = new Bmp(s, s), c = (s - 1) / 2, lo = o.lo ?? 0.6;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = (x - c) / r, dy = (y - c) / r, dd = dx * dx + dy * dy;
      if (dd > 1.02) continue;
      const nz = Math.sqrt(Math.max(0, 1 - dd));
      const lum = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]);
      const band = o.band ? o.band(x, y, dx, dy) : 0;
      const idx = Math.round(lo + lum * (ramp.length - 1 - lo) * (o.k ?? 1.05) + band);
      b.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, idx))]);
    }
    return b;
  }
  const disc = (r) => { const s = Math.ceil(r * 2 + 1), c = (s - 1) / 2; return Mask.fn(s, s, (x, y) => (x - c) ** 2 + (y - c) ** 2 <= r * r + 0.35); };
  const ellipse = (w, h, cx, cy, rx, ry) => Mask.fn(w, h, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0);
  /** Rounded rectangle ring or fill as a mask; t = 0 fills it. */
  function roundRect(w, h, x0, y0, x1, y1, r, t = 0) {
    const inside = (x, y, inset) => {
      const ax = x0 + inset, ay = y0 + inset, bx = x1 - inset, by = y1 - inset, rr = Math.max(0, r - inset);
      if (x < ax || x > bx || y < ay || y > by) return false;
      const cx = x < ax + rr ? ax + rr : x > bx - rr ? bx - rr : x, cy = y < ay + rr ? ay + rr : y > by - rr ? by - rr : y;
      return (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr + 0.5;
    };
    return Mask.fn(w, h, (x, y) => inside(x, y, 0) && (!t || !inside(x, y, t)));
  }
  /** A thick quadratic stroke as a mask. */
  function strokeQuad(w, h, p0, p1, p2, wid) {
    const k = new Mask(w, h), r = wid / 2;
    for (let i = 0; i <= 80; i++) {
      const t = i / 80, a = (1 - t) * (1 - t), b2 = 2 * (1 - t) * t, c2 = t * t;
      const x = a * p0[0] + b2 * p1[0] + c2 * p2[0], y = a * p0[1] + b2 * p1[1] + c2 * p2[1];
      const rr = typeof wid === 'function' ? wid(t) / 2 : r;
      for (let yy = Math.floor(y - rr - 1); yy <= y + rr + 1; yy++) for (let xx = Math.floor(x - rr - 1); xx <= x + rr + 1; xx++) if ((xx + 0.5 - x - 0.5) ** 2 + (yy + 0.5 - y - 0.5) ** 2 <= rr * rr) k.set(xx, yy);
    }
    return k;
  }
  /** Brighten (f > 1) or darken (f < 1) a colour by a factor. */
  const shade = (hex, f) => { const [r, g, bl] = hexRGBA(hex); const h = (v) => Math.round(Math.min(255, v * f)).toString(16).padStart(2, '0'); return `#${h(r)}${h(g)}${h(bl)}`; };
  /** A seeded random stream from a string (decoration only: specks, texture). Same string, same stream. */
  function rng(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    let s = h >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ------------------------------------------------------------ Ember digits: the number face, drawn on the art grid
  // S is 5x7 with 2-px stems, L is 7x11, XL is L redrawn twice as fine with the EPX pixel-art rule.
  const GLYPH_S = {
    0: '.###.|##.##|##.##|##.##|##.##|##.##|.###.',
    1: '.##..|###..|.##..|.##..|.##..|.##..|####.',
    2: '.###.|##.##|...##|..##.|.##..|##...|#####',
    3: '####.|...##|...##|.###.|...##|...##|####.',
    4: '...##|..###|.####|##.##|#####|...##|...##',
    5: '#####|##...|####.|...##|...##|##.##|.###.',
    6: '.###.|##...|##...|####.|##.##|##.##|.###.',
    7: '#####|...##|..##.|..##.|.##..|.##..|.##..',
    8: '.###.|##.##|##.##|.###.|##.##|##.##|.###.',
    9: '.###.|##.##|##.##|.####|...##|...##|.###.',
    $: '..#..|.####|##.#.|.###.|.#.##|####.|..#..',
    '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
    '-': '.....|.....|.....|####.|.....|.....|.....',
    x: '.....|##.##|.###.|..#..|.###.|##.##|.....',
    '/': '...##|...##|..##.|..#..|.##..|##...|##...',
    ',': '..|..|..|..|..|##|.#',
    '.': '..|..|..|..|..|##|##',
    ' ': '...|...|...|...|...|...|...',
    A: '.###.|##.##|##.##|#####|##.##|##.##|##.##',
    K: '##.##|##.##|####.|###..|####.|##.##|##.##',
    Q: '.###.|##.##|##.##|##.##|##.##|##.#.|.##.#',
    J: '...##|...##|...##|...##|##.##|##.##|.###.',
    T: '#.###|#.#.#|#.#.#|#.#.#|#.#.#|#.#.#|#.###', // the "10" index
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
    ',': '...|...|...|...|...|...|...|...|###|.##|.#.',
    '.': '...|...|...|...|...|...|...|...|...|###|###',
    ' ': '....|....|....|....|....|....|....|....|....|....|....',
  };
  const parseGlyph = (s) => s.split('|').map((r) => [...r].map((ch) => ch === '#'));
  // EPX / Scale2x: doubles the resolution and rounds the diagonals, so XL is new art at the same pixel size.
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
  // XXL: XL redrawn twice as fine again (the total on the plaque, twice the Blind score), with a lit bevel
  FONTS.XXL = { g: Object.fromEntries(Object.entries(FONTS.XL.g).map(([k, v]) => [k, epx(v)])), gap: 4, bevel: true };

  // Text styles: fill shades from the top row to the bottom row, then a coloured rim (never a hard black drop).
  const TEXT = {
    cream: { ramp: ['#FFFFFF', '#FFF6E8', '#FFE7C8', '#F7CFA2'], ol: '#4A1A36' },
    score: { ramp: ['#FFFFFF', '#FFF8EC', '#FFEACB', '#FFD29A', '#FFB874'], ol: '#5E1E12' },
    chips: { ramp: ['#FFFFFF', '#EEF1FF', '#CDD5FF', '#A9B8FF'], ol: '#3346D6' },
    mult: { ramp: ['#FFFFFF', '#FFEEE8', '#FFCBBD', '#FFA38A'], ol: '#C8262F' },
    // money is flat yellow with one amber rim: no cream-to-gold ramp, so cash never reads as a gold trim
    money: { ramp: ['#FFCE3B'], ol: '#D18A1D' },
    coin: { ramp: ['#FFFDEB', '#FFF0A0', '#FFDE5C', '#FFC53A'], ol: '#6E3A0A' }, // the dollar drawn into Joker art only
    ember: { ramp: ['#FFF4E2', '#FFD29C', '#FFA458', '#FF8436'], ol: '#5E1E0C' },
    pink: { ramp: ['#FFEEF6', '#FFB2D6', '#FF80BA', '#FF5AA4'], ol: '#5E0F38' },
    lime: { ramp: ['#F7FFE0', '#E2FFA6', '#C3F26E', '#A6E44A'], ol: '#2A4E10' },
    blue: { ramp: ['#F2F4FF', '#CDD5FF', '#A9B8FF', '#7C8FFF'], ol: '#141A5E' },
    red: { ramp: ['#FFF1EC', '#FFCBBD', '#FFA38A', '#FF7F68'], ol: '#5C0D1B' },
    total: { ramp: ['#FFFFFF', '#FFFBF0', '#FFF0D6', '#FFDCAA', '#FFC27E'], ol: '#6E2A10' },
    soft: { ramp: ['#F7DCCB', '#EBC6B0', '#DDB09A'], ol: null },
  };
  deepFreeze(TEXT);
  const glyphsOf = (str, F) => [...String(str)].map((ch) => F.g[ch] || F.g[ch.toUpperCase()] || F.g['?'] || F.g[' ']);
  function textBmp(str, size = 'S', style = 'cream') {
    const F = FONTS[size], st = typeof style === 'string' ? TEXT[style] : style;
    const chars = glyphsOf(str, F);
    const h = chars[0].length;
    const w = chars.reduce((s, g) => s + g[0].length, 0) + F.gap * (chars.length - 1);
    const pad = st.ol ? 1 : 0;
    const b = new Bmp(w + pad * 2, h + pad * 2);
    const n = st.ramp.length;
    let cx = pad;
    chars.forEach((g) => {
      const on = (x, y) => y >= 0 && y < g.length && x >= 0 && x < g[0].length && g[y][x];
      g.forEach((row, y) => row.forEach((px, x) => {
        if (!px) return;
        const t = (y + 0.5) / h;
        let c = st.ramp[Math.min(n - 1, Math.floor(t * n))];
        // the big face carries a lit bevel: a highlight on edges facing the upper left, a shade on the lower right
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
  /** The size textBmp(str, size, style) will have, without drawing it. */
  function textSize(str, size = 'S', style = 'cream') {
    const F = FONTS[size], st = typeof style === 'string' ? TEXT[style] : style;
    const chars = glyphsOf(str, F), pad = st.ol ? 2 : 0;
    return { w: chars.reduce((s, g) => s + g[0].length, 0) + F.gap * (chars.length - 1) + pad, h: chars[0].length + pad };
  }
  /** A number or short string in the Ember digit face, as a bitmap (Lit's num() returned an <img>). */
  const num = (str, size = 'S', style = 'cream') => textBmp(str, size, style);

  // ------------------------------------------------------------ suits
  const PIP5 = {
    H: ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'],
    D: ['..X..', '.XXX.', 'XXXXX', '.XXX.', '..X..'],
    S: ['..X..', '.XXX.', 'XXXXX', 'XXXXX', '..X..'],
    C: ['.XXX.', '.XXX.', 'XXXXX', 'XX.XX', '..X..'],
  };
  const PIP7 = {
    H: ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
    D: ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
    S: ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', 'XX.X.XX', '..XXX..'],
    C: ['..XXX..', '..XXX..', 'XXXXXXX', 'XXXXXXX', 'XX.X.XX', '...X...', '..XXX..'],
  };
  deepFreeze(PIP5); deepFreeze(PIP7);
  // the big pips for Aces: drawn from shape equations at 15 x 15
  function bigPipMask(suit) {
    const N = 15, c = 7;
    const heart = (x, y, flip) => {
      const X = (x - c) / 6.25, Y = (flip ? (y - 7.2) : (7.8 - y)) / 6.25;
      const a = X * X + Y * Y - 1;
      return a * a * a - X * X * Y * Y * Y <= 0;
    };
    if (suit === 'H') return Mask.fn(N, N, (x, y) => heart(x, y, false));
    if (suit === 'D') return Mask.fn(N, N, (x, y) => Math.abs(x - c) / 6.2 + Math.abs(y - c) / 7.45 <= 1);
    if (suit === 'S') {
      const k = Mask.fn(N, N, (x, y) => y <= 11 && heart(x, y + 1.2, true));
      for (let y = 10; y < 15; y++) for (let x = 0; x < N; x++) { const hw = y < 12 ? 0.6 : y < 13 ? 1.6 : y < 14 ? 2.6 : 3.6; if (Math.abs(x - c) <= hw) k.set(x, y); }
      return k;
    }
    const k = Mask.fn(N, N, (x, y) => (x - 7) ** 2 + (y - 3.6) ** 2 <= 11.2 || (x - 3.4) ** 2 + (y - 8.1) ** 2 <= 11.2 || (x - 10.6) ** 2 + (y - 8.1) ** 2 <= 11.2);
    for (let y = 6; y < 15; y++) for (let x = 0; x < N; x++) { const hw = y < 12 ? 0.6 : y < 13 ? 1.6 : y < 14 ? 2.6 : 3.6; if (Math.abs(x - c) <= hw) k.set(x, y); }
    return k;
  }
  const SUIT_RAMP = Object.freeze({ H: R.red, D: R.red, S: R.dark, C: R.dark });
  // Colour-coded suits (the fourColor option): Clubs and Diamonds get inks of their own, shade for shade against the
  // two-colour inks (Clubs against R.dark, Diamonds against R.red); Spades and Hearts keep theirs. Clubs are a deep
  // green (lime, with plum in the two deepest shadows, as every ramp's shadows lean to plum), Diamonds a royal blue
  // (chips). Read by lightness and the blue-yellow axis, the four make a two-by-two (dark: Spades and Clubs; light:
  // Hearts and Diamonds; blue: Spades and Diamonds; warm: Hearts and Clubs), so they stay apart under protanopia and
  // deuteranopia too.
  const SUIT_INK4 = deepFreeze({
    C: [R.plum[1], R.plum[2], R.lime[0], R.lime[1], R.lime[2], R.lime[3], R.lime[4]],
    D: R.chips.slice(2, 9),
  });
  /** A face drawn in the two-colour inks, re-inked for four-colour suits: each shade of the suit's two-colour ramp
      becomes the same shade of its four-colour ink (index, pips, Ace mark and the court motifs drawn in the suit ink).
      Spades and Hearts come back as they are. Changes b in place and returns it. */
  function fourColorFace(b, suit) {
    const ink = SUIT_INK4[suit];
    if (!ink) return b;
    const map = {};
    SUIT_RAMP[suit].forEach((c, i) => { map[c] = ink[i]; });
    return b.recolor(map);
  }
  // Each of the 16 pips is shaded once and handed out as a copy (a card face asks for up to 12 of them).
  const PIP_CACHE = new Map();
  const pipBmp = (suit, size = 7, flip = false) => {
    const key = `${suit}${size === 5 ? 5 : 7}${flip ? 'f' : ''}`;
    let b = PIP_CACHE.get(key);
    if (!b) {
      let k = Mask.rows(size === 5 ? PIP5[suit] : PIP7[suit]);
      if (flip) k = k.flipY();
      b = emboss(k, SUIT_RAMP[suit], { cap: size === 5 ? 1.6 : 2.2, base: 3, gain: 4.2, depth: 1.1 });
      PIP_CACHE.set(key, b);
    }
    return b.clone();
  };
  const RANK_CH = Object.freeze({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T' });

  // ------------------------------------------------------------ card base: 41 x 55 art px, corners rounded on a 4-px curve
  const CW = 41, CH = 55;
  const CORNER = Object.freeze([4, 2, 1, 1]);
  const cornerAt = (y, h) => (y < CORNER.length ? CORNER[y] : y >= h - CORNER.length ? CORNER[h - 1 - y] : 0);
  const cardMask = (w = CW, h = CH) => Mask.fn(w, h, (x, y) => { const r = cornerAt(y, h); return x >= r && x < w - r; });
  // the default card silhouette and its edge flags, made once (private: cardShape only reads them)
  const CARD_K = cardMask(), CARD_E = edgeFlags(CARD_K);
  /** The card body: an inked edge, a lit top-left rim, a shaded right side and a thickness lip at the bottom.
      o.mask (added) shapes it differently, e.g. the Voucher's scalloped ticket. */
  function cardShape(o = {}) {
    const face = o.face || C.cream, hi = o.hi || C.white, shade = o.shade || C.cream2, lip = o.lip || C.cream3, ol = o.ol || C.edge;
    const k = o.mask || CARD_K, b = new Bmp(k.w, k.h), E = o.mask ? edgeFlags(k) : CARD_E;
    const edge = (x, y) => x >= 0 && y >= 0 && x < k.w && y < k.h && E[y * k.w + x] === 1;
    for (let y = 0; y < k.h; y++) for (let x = 0; x < k.w; x++) {
      if (!k.get(x, y)) continue;
      if (edge(x, y)) { b.set(x, y, ol); continue; }
      let c = face;
      if (edge(x, y + 1)) c = lip;
      else if (edge(x + 1, y) || edge(x, y + 2)) c = shade;
      else if (edge(x, y - 1) || edge(x - 1, y)) c = hi;
      b.set(x, y, c);
    }
    return b;
  }
  /** The rank and suit in two corners; the lower one is turned around but keeps its light from the top. */
  function drawIndex(b, rank, suit) {
    const ramp = SUIT_RAMP[suit];
    const g = parseGlyph(GLYPH_S[RANK_CH[rank] || rank]);
    const shadeRow = (y) => (y < 2 ? ramp[4] : y < 5 ? ramp[3] : ramp[2]);
    g.forEach((row, y) => row.forEach((on, x) => { if (on) b.set(3 + x, 3 + y, shadeRow(y)); }));
    g.forEach((row, y) => row.forEach((on, x) => { if (on) b.set(CW - 4 - x, CH - 4 - y, shadeRow(6 - y)); }));
    b.blit(pipBmp(suit, 5), 3, 12);
    b.blit(pipBmp(suit, 5, true), CW - 8, CH - 17, { flipX: true });
  }
  // Pip layouts: [column, top, flipped]. Columns: 0 = left (x 10), 1 = centre (x 17), 2 = right (x 24).
  const COLX = Object.freeze([10, 17, 24]);
  const L4 = [6, 18, 30, 42], L3 = [6, 24, 42];
  const side = (ys, flipFrom) => ys.flatMap((y, i) => [[0, y, i >= flipFrom], [2, y, i >= flipFrom]]);
  const PIPS = deepFreeze({
    2: [[1, 6, false], [1, 42, true]],
    3: [[1, 6, false], [1, 24, false], [1, 42, true]],
    4: side([6, 42], 1),
    5: side([6, 42], 1).concat([[1, 24, false]]),
    6: side(L3, 2),
    7: side(L3, 2).concat([[1, 15, false]]),
    8: side(L3, 2).concat([[1, 15, false], [1, 33, true]]),
    9: side(L4, 2).concat([[1, 24, false]]),
    10: side(L4, 2).concat([[1, 12, false], [1, 36, true]]),
  });
  /** A number card's face (index and pips) drawn onto b: the card stock is whatever b already holds. */
  function numberFace(b, rank, suit) {
    drawIndex(b, rank, suit);
    PIPS[rank].forEach(([col, y, fl]) => b.blit(pipBmp(suit, 7, fl), COLX[col], y));
    return b;
  }
  function numberCard(rank, suit) { return numberFace(cardShape(), rank, suit); }
  // Ace: the Ember mark, a big pip on a lit lozenge with a soft halo stepped in four shades and four sparks
  function aceFace(b, suit) {
    drawIndex(b, 14, suit);
    const cx = 20, cy = 27;
    const halo = ['#FFF6E6', '#FFE6C2', '#FFD29C', '#FFB774', '#FF9A4E'];
    for (let y = 4; y < CH - 4; y++) for (let x = 9; x < CW - 9; x++) {
      const d = Math.abs(x - cx) + Math.abs(y - cy) * 0.78;
      if (d > 15.2) continue;
      const ring = d > 14 ? 4 : d > 12.6 ? 3 : d > 11 ? 2 : d > 8.8 ? 1 : 0;
      if (ring === 4) b.set(x, y, '#F07A36');
      else b.set(x, y, halo[ring]);
    }
    const pip = emboss(bigPipMask(suit), SUIT_RAMP[suit], { cap: 3.2, base: 3, gain: 4.6, depth: 1.25 });
    const big = new Bmp(17, 17); big.blit(pip, 1, 1); big.outline(C.edge);
    b.blit(big, cx - 8, cy - 8);
    const spark = ['..e..', '..o..', 'eovoe', '..o..', '..e..'];
    [[10, 10], [26, 10], [10, 40], [26, 40]].forEach(([x, y]) => b.draw(spark, x, y, { e: '#FFB774', o: '#FF8A3C', v: C.white }));
    return b;
  }
  function aceCard(suit) { return aceFace(cardShape(), suit); }

  // ------------------------------------------------------------ court portraits: a hand-drawn head on a shaded robe
  // Head keys: u/y/Y crown, g gem, h/H/j hair, s/S/t skin, e eye, m mouth, n blush, l/r/R cap (Jack), k ink.
  const HEAD = deepFreeze({
    K: grid([
      '....u....u....u....',
      '...uyu..uyu..uyu...',
      '...yyY..yyY..yyY...',
      '...yyyY.yyY.yyyY...',
      '...yyyyyyyyyyyyY...',
      '...ygyyuyyyuyygY...',
      '...yyyyyyyyyyyyY...',
      '..hYYYYYYYYYYYYYh..',
      '..hhtssssssssSShh..',
      '..hhsHHsssssHHShh..',
      '..hhssesssssesShh..',
      '..hhtssssSssssShh..',
      '..hhsnhhhhhhhnShh..',
      '..hhhhhhmmmhhhhhh..',
      '...hhhhhhhhhhhhH...',
      '....Hhhhhhhhhhh....',
      '......HhhhhhH......',
    ]),
    Q: grid([
      '.........u.........',
      '....u...uyu...u....',
      '....yu..yyY..uY....',
      '....yyyyygyyyyY....',
      '...hYYYYYYYYYYYh...',
      '..hhhhhhhhhhhhhHh..',
      '.hhhhtssssssSShhhh.',
      '.hhhhsHHsssHHShhhh.',
      '.hhhhssesssesShhhh.',
      '.hhhhtsssSsssShhhh.',
      '.hhhhsnsssssnShhhh.',
      '.hhhhsssmmmssShhhh.',
      '.hhhhhssssssShhhhh.',
      '.hhhhhhhssssShhhhh.',
      '..hhhhhhsssShhhhh..',
      '..hhhhh.....hhhhh..',
      '..Hhhh.......hhhH..',
      '...HH.........HH...',
    ]),
    J: grid([
      '.............nm....',
      '............nmm....',
      '...........nmM.....',
      '....llllllllmM.....',
      '...llrrrrrrrrrl....',
      '..lrrrrrrrrrrrrR...',
      '..RRyRRRRRRRRyRRR..',
      '...hhhhhhhhhhhhh...',
      '...htssssssssSSh...',
      '...hsHHsssssHHSh...',
      '...hssesssssesSh...',
      '...htssssSssssSh...',
      '...hsnsssssssnSh...',
      '....sssmmmmmsSS....',
      '.....sssssssSS.....',
      '.......sssSS.......',
    ]),
  });
  // Robe ramps per suit (four distinct families) and the pale ground behind each figure, top to bottom.
  const ROBE = deepFreeze({
    S: { ramp: ['#141236', '#211F52', '#2E2C6E', '#3C3A86', '#5452A8', '#7674C8', '#A2A0E2'], ground: ['#E8E5F8', '#DFDBF4', '#D5D0EE', '#CBC5E8'], dot: '#C2BBE4' },
    H: { ramp: ['#460A1C', '#73122C', '#9C1B3A', '#C42645', '#E04868', '#F27A92', '#FFB0BE'], ground: ['#FFE8EB', '#FFDDE2', '#FCD1D8', '#F6C5CE'], dot: '#F7BCC6' },
    C: { ramp: ['#10301A', '#1E4E24', '#2A6A2E', '#3A8838', '#58A846', '#82C866', '#B4E496'], ground: ['#E8F5E0', '#DEEFD4', '#D3E8C8', '#C8E0BC'], dot: '#BEDCAE' },
    D: { ramp: ['#541E08', '#8A3A12', '#B25218', '#D9701F', '#EF9038', '#FAB264', '#FFD49C'], ground: ['#FFEEDA', '#FFE4C8', '#FCD8B4', '#F6CCA2'], dot: '#F4C496' },
  });
  Object.values(ROBE).forEach((r) => Object.values(r).forEach((v) => Object.isFrozen(v) || Object.freeze(v)));
  const PEOPLE = deepFreeze({
    K: { skin: ['#4A2A1C', '#6A4029', '#8C5A3C', '#A9734F', '#C99068'], hair: ['#8C7A6C', '#BFAE9C', '#E8DCCD', '#FFF8EE'], mouth: '#4A1F18', blush: '#A9584A' },
    Q: { skin: ['#A8645A', '#D59A80', '#F6CBA8', '#FFE2C8', '#FFF0E0'], hair: ['#3E1210', '#5E1E18', '#7A2E25', '#9E4634', '#C4664A'], mouth: '#B3284A', blush: '#F59AA8' },
    J: { skin: ['#7E4A2E', '#B07448', '#E2A574', '#F5C79A', '#FFE0BC'], hair: ['#6A2A0C', '#A8461A', '#E06A26', '#F79244', '#FFBE7A'], mouth: '#8A2E2E', blush: '#F38E86' },
  });
  Object.values(PEOPLE).forEach((p) => Object.values(p).forEach((v) => Object.isFrozen(v) || Object.freeze(v)));
  const COURT_WHO = Object.freeze({ 11: 'J', 12: 'Q', 13: 'K' });
  function headKey(who, robe) {
    const P = PEOPLE[who];
    return {
      u: R.gold[6], y: R.gold[4], Y: R.gold[3], g: R.pink[5],
      h: P.hair[2], H: P.hair[1], j: P.hair[3],
      s: P.skin[2], S: P.skin[1], t: P.skin[3], e: C.edge, m: P.mouth, n: P.blush, k: C.edge,
      l: robe.ramp[5], r: robe.ramp[3], R: robe.ramp[2],
      M: R.pink[3],
    };
  }
  /** A robe as a shaded mask, widening from the shoulders; returns the bitmap to compose under the head. */
  function body(who, suit) {
    const robe = ROBE[suit], RR = robe.ramp, W = 19, Hh = 45;
    const f = new Bmp(W, Hh);
    const trim = R.cream, gold = R.gold;
    if (who === 'K') {
      const k = Mask.fn(W, Hh, (x, y) => y >= 14 && Math.abs(x - 9) <= (y === 14 ? 5 : y === 15 ? 8 : 9));
      f.blit(emboss(k, RR, { cap: 4, base: 3, gain: 4 }), 0, 0);
      // deep folds either side of the panel
      for (let y = 20; y < 41; y++) { f.set(3, y, RR[1]); f.set(15, y, RR[1]); f.set(4, y, RR[2]); }
      // the cream panel down the front, bevelled
      const panel = Mask.fn(7, 22, () => true);
      f.blit(emboss(panel, trim, { cap: 2, base: 5, gain: 3 }), 6, 18);
      // ermine collar over the shoulders: white with ink tails
      const collar = Mask.fn(W, 5, (x, y) => (y === 0 ? Math.abs(x - 9) <= 7 : y < 4 ? true : Math.abs(x - 9) >= 3));
      f.blit(emboss(collar, ['#9C8C86', '#CFC3BC', '#EFE6DE', '#FFFCF5', '#FFFFFF'], { cap: 2, base: 3, gain: 3 }), 0, 15);
      [[2, 17], [6, 16], [12, 16], [16, 17], [9, 18], [4, 18], [14, 18]].forEach(([x, y]) => f.set(x, y, C.edge));
      // gold belt with a buckle, and the hem in ermine
      for (let x = 0; x < W; x++) { f.set(x, 31, gold[4]); f.set(x, 32, gold[2]); }
      f.draw(['YyyY', 'yuuy', 'YyyY'], 7, 30, { y: gold[4], Y: gold[2], u: gold[6] });
      const hem = Mask.fn(W, 4, () => true);
      f.blit(emboss(hem, ['#9C8C86', '#CFC3BC', '#EFE6DE', '#FFFCF5', '#FFFFFF'], { cap: 1.5, base: 3, gain: 3 }), 0, 41);
      for (let x = 1; x < W; x += 4) f.set(x, 42 + (x % 8 === 1 ? 0 : 1), C.edge);
      // hands at the panel, and a sceptre with an ember jewel
      f.draw(['tS', 'SS'], 4, 27, { t: PEOPLE.K.skin[3], S: PEOPLE.K.skin[2] });
      for (let y = 15; y < 33; y++) f.set(16, y, y % 3 === 0 ? gold[2] : gold[4]);
      f.draw(['.e.', 'eoe', 'EoE', '.E.'], 15, 11, { e: R.ember[7], o: R.ember[5], E: R.ember[3] });
      f.draw(['tS', 'SS'], 15, 26, { t: PEOPLE.K.skin[3], S: PEOPLE.K.skin[2] });
    } else if (who === 'Q') {
      const k = Mask.fn(W, Hh, (x, y) => {
        if (y < 15) return false;
        const half = y < 17 ? 6 : Math.min(9, 6 + Math.floor((y - 17) / 7));
        return Math.abs(x - 9) <= half;
      });
      f.blit(emboss(k, RR, { cap: 4, base: 3, gain: 4 }), 0, 0);
      // square neckline in skin, a lace edge, the bodice panel and a pendant
      f.rect(7, 15, 5, 2, PEOPLE.Q.skin[2]); f.set(7, 15, PEOPLE.Q.skin[3]); f.rect(7, 16, 5, 1, PEOPLE.Q.skin[1]);
      for (let x = 6; x <= 12; x++) f.set(x, 17, x % 2 ? trim[7] : trim[5]);
      const panel = Mask.fn(5, 14, (x, y) => y < 12 || Math.abs(x - 2) <= 13 - y);
      f.blit(emboss(panel, trim, { cap: 2, base: 5, gain: 3 }), 7, 18);
      f.draw(['.g.', 'gGg', '.g.'], 8, 15, { g: R.pink[5], G: R.pink[7] });
      // skirt folds and a scalloped hem
      for (let y = 26; y < 41; y++) { f.set(4, y, RR[2]); f.set(14, y, RR[1]); }
      for (let x = 0; x < W; x++) { f.set(x, 41, trim[6]); f.set(x, 42, x % 3 === 1 ? trim[4] : trim[6]); f.set(x, 43, RR[1]); f.set(x, 44, RR[0]); }
      // hands holding a pink flower with a lime stem
      f.draw(['tS', 'SS'], 5, 28, { t: PEOPLE.Q.skin[3], S: PEOPLE.Q.skin[2] });
      f.draw(['tS', 'SS'], 12, 28, { t: PEOPLE.Q.skin[3], S: PEOPLE.Q.skin[2] });
      f.draw(['.ab.', 'abbc', 'bbcc', '.cc.'], 13, 22, { a: R.pink[7], b: R.pink[5], c: R.pink[3] });
      for (let y = 26; y < 31; y++) f.set(14, y, R.lime[4]);
      f.set(15, 28, R.lime[6]); f.set(13, 29, R.lime[3]);
    } else {
      const k = Mask.fn(W, Hh, (x, y) => {
        if (y < 15) return false;
        if (y >= 39) return (x >= 4 && x <= 7) || (x >= 11 && x <= 14);
        const half = y === 15 ? 5 : y < 28 ? 8 : 9;
        return Math.abs(x - 9) <= half;
      });
      f.blit(emboss(k, RR, { cap: 4, base: 3, gain: 4 }), 0, 0);
      // hose and shoes
      for (let y = 39; y < 43; y++) for (const x of [4, 5, 6, 7, 11, 12, 13, 14]) f.set(x, y, x === 4 || x === 11 ? R.plum[5] : x === 7 || x === 14 ? R.plum[3] : R.plum[4]);
      for (const x of [3, 4, 5, 6, 7, 11, 12, 13, 14, 15]) { f.set(x, 43, R.wood[3]); f.set(x, 44, R.wood[1]); }
      // cream collar, a gold belt, the tunic hem
      f.draw(['wwwwwww', '.wwvww.', '..wWw..'], 6, 15, { w: trim[6], v: trim[7], W: trim[4] });
      for (let x = 1; x < 18; x++) { f.set(x, 27, gold[4]); f.set(x, 28, gold[2]); }
      f.draw(['Yy', 'uy'], 8, 27, { y: gold[4], Y: gold[2], u: gold[6] });
      for (let x = 0; x < W; x++) { if (x % 2 === 0) f.set(x, 38, RR[1]); }
      for (let y = 18; y < 27; y++) f.set(9, y, RR[2]);
      // a little lantern held out, its glass lit
      f.draw(['tS', 'SS'], 14, 24, { t: PEOPLE.J.skin[3], S: PEOPLE.J.skin[2] });
      f.draw(['.kk.', 'kook', 'kOOk', 'kook', '.kk.'], 14, 29, { k: C.edge, o: R.ember[7], O: R.ember[5] });
      f.set(15, 28, C.edge); f.set(16, 28, C.edge);
    }
    return f;
  }
  /** Lit's court figure: the robe, the hand-drawn head and the suit on the chest (K), bodice (Q) or tunic (J).
      19 x 45, not yet outlined (the court frame adds the ink). */
  function courtFigure(who, suit) {
    const robe = ROBE[suit];
    const fig = body(who, suit);
    fig.draw(HEAD[who], 0, 0, headKey(who, robe));
    const pip = pipBmp(suit, 5);
    if (who === 'K') fig.blit(pip, 7, 21);
    if (who === 'Q') fig.blit(pip, 7, 19);
    if (who === 'J') { const cp = emboss(Mask.rows(PIP5[suit]), R.cream, { cap: 1.6, base: 5, gain: 3 }); fig.blit(cp, 3, 19); }
    return fig;
  }
  /** A placeholder court figure: a faceless mannequin in the suit's robe with a question mark for a face, meant to
      look unfinished. Kept for tests and for a file that wants an obvious stand-in (register it with temp: true);
      a court nobody registers falls back to Lit's person instead (TEMP_COURT below). */
  function tempFigure(who, suit) {
    const robe = ROBE[suit], W = 19, Hh = 45, f = new Bmp(W, Hh);
    const robeMask = Mask.fn(W, Hh, (x, y) => y >= 15 && y <= 44 && Math.abs(x - 9) <= (y === 15 ? 4 : y === 16 ? 6 : y < 22 ? 7 : 8));
    f.blit(emboss(robeMask, robe.ramp, { cap: 4, base: 3, gain: 4 }), 0, 0);
    f.rect(8, 13, 3, 3, R.cream[4]);
    const head = emboss(Mask.fn(W, 14, (x, y) => (x - 9) ** 2 + ((y - 7) / 1.15) ** 2 <= 30), R.cream, { cap: 3, base: 4, gain: 3.4 });
    f.blit(head, 0, 0);
    f.draw(GLYPH_S['?'].split('|'), 7, 3, { '#': C.edge });
    f.blit(pipBmp(suit, 5), 7, 22);
    // a crown, a coif or a cap outline, so the rank still reads at a glance
    if (who === 'K') f.draw(['k.k.k', 'kkkkk'], 7, 0, { k: R.gold[3] });
    if (who === 'Q') f.draw(['..k..', '.kkk.'], 7, 0, { k: R.gold[3] });
    if (who === 'J') f.draw(['kkkkkkk'], 6, 0, { k: robe.ramp[2] });
    // a dashed hem: unfinished on purpose
    for (let x = 1; x < W; x += 2) f.set(x, 40, R.cream[6]);
    return f;
  }
  /** The court window: an inked frame with an arched top (x 9..31, y 3..51). */
  const courtWindow = () => Mask.fn(CW, CH, (x, y) => {
    if (x < 9 || x > 31 || y < 3 || y > 51) return false;
    const r = y === 3 ? 3 : y === 4 ? 1 : y === 5 ? 1 : 0;
    return x >= 9 + r && x <= 31 - r;
  });
  const WIN_K = courtWindow(), WIN_E = edgeFlags(WIN_K); // private: courtFace only reads them
  /** A court's face drawn onto b: index, the window over a pale ground lit from above, the figure (spec.figure,
      outlined in ink and clipped to the window), then the window re-inked so the figure sits inside it. */
  function courtFace(b, rank, suit, spec = {}) {
    drawIndex(b, rank, suit);
    const who = COURT_WHO[rank];
    const robe = ROBE[suit];
    const ground = spec.ground || robe.ground, dot = spec.dot || robe.dot;
    const win = WIN_K;
    const isEdge = (x, y) => WIN_E[y * CW + x] === 1;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      if (!win.get(x, y)) continue;
      if (isEdge(x, y)) { b.set(x, y, C.edge); continue; }
      const band = Math.min(3, Math.floor(((y - 4) / 47) * 4));
      b.set(x, y, (x * 3 + y) % 7 === 0 && y % 3 === 0 ? dot : ground[band]);
    }
    const ctx = { rank, suit, who, robe, people: PEOPLE[who] };
    const fig = spec.figure ? spec.figure(kit, ctx) : tempFigure(who, suit);
    const at = spec.at || [10, 4];
    if (spec.outline === false) b.blit(fig, at[0] + 1, at[1] + 1, { clip: (x, y) => win.get(x, y) });
    else { const out = new Bmp(fig.w + 2, fig.h + 2); out.blit(fig, 1, 1); out.outline(C.edge); b.blit(out, at[0], at[1], { clip: (x, y) => win.get(x, y) }); }
    // re-ink the window frame so the figure sits inside it
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (win.get(x, y) && isEdge(x, y)) b.set(x, y, C.edge);
    if (spec.over) spec.over(kit, b, ctx);
    return b;
  }
  /** A whole court card on plain stock; spec defaults to Lit's own figure for that rank and suit. */
  function faceCard(rank, suit, spec) {
    return courtFace(cardShape(), rank, suit, spec || { figure: (k, c) => courtFigure(c.who, c.suit) });
  }

  // ------------------------------------------------------------ card back: warm bands under a lit wick
  const BAND_ORDER = Object.freeze([0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0]);
  /** The back's shared base: card stock, a field inside an inset frame (x 4..36, y 4..50) and the frame
      (ink, a dark lip on top, a lit lip at the bottom). o: { bands, order, field(x, y) -> colour, lipTop, lip, stock } */
  function backBase(o = {}) {
    const b = cardShape(o.stock);
    const band = o.bands || C.bands, order = o.order || BAND_ORDER;
    const y0 = 4, y1 = 50;
    const inner = Mask.fn(CW, CH, (x, y) => x >= 4 && x <= 36 && y >= y0 && y <= y1 && !((x === 4 || x === 36) && (y === y0 || y === y1)));
    for (let y = y0; y <= y1; y++) for (let x = 4; x <= 36; x++) {
      if (!inner.get(x, y)) continue;
      if (o.field) { b.set(x, y, o.field(x, y)); continue; }
      const t = ((y - y0) / (y1 - y0 + 1)) * order.length;
      const i = Math.floor(t), f = t - i;
      const a = band[order[i]], nb = band[order[Math.min(order.length - 1, i + 1)]];
      b.set(x, y, f > 0.8 && (x + y) % 2 === 0 ? nb : a);
    }
    // inset frame: dark on top and left, a lit lip on the bottom and right
    for (let x = 4; x <= 36; x++) { b.set(x, y0 - 1, C.edge); b.set(x, y1 + 1, C.edge); }
    for (let y = y0; y <= y1; y++) { b.set(3, y, C.edge); b.set(37, y, C.edge); }
    for (let x = 5; x <= 35; x++) b.set(x, y0, o.lipTop || '#1C0A18');
    for (let x = 5; x <= 35; x++) b.set(x, y1, o.lip || '#E8783A');
    return b;
  }
  /** A stepped lozenge medallion centred on (cx, cy): ink rim, three glow steps, a cream heart. */
  function lozenge(b, cx = 20, cy = 27, o = {}) {
    const st = o.steps || [C.edge, '#FF9A4E', '#FFD29C', '#FFEBD0', C.cream];
    const r = o.r || [12.2, 11.2, 10.2, 9, 7.2], sq = o.squash ?? 0.86;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const d = Math.abs(x - cx) + Math.abs(y - cy) * sq;
      if (d > r[0]) continue;
      b.set(x, y, d > r[1] ? st[0] : d > r[2] ? st[1] : d > r[3] ? st[2] : d > r[4] ? st[3] : st[4]);
    }
    return b;
  }
  /** Gold four-point sparkles in the back's four corners. */
  function cornerStars(b, o = {}) {
    const star = ['..u..', '.uyu.', 'uyvyu', '.uyu.', '..u..'];
    (o.at || [[8, 8], [28, 8], [8, 42], [28, 42]]).forEach(([x, y]) => b.draw(star, x, y, o.key || { u: R.gold[3], y: R.gold[5], v: C.white }));
    return b;
  }
  /** Lit's medallion: the lozenge, a lit wick on a candle top, and gold sparkles in the corners. */
  function backMedallion(b) {
    const cx = 20, cy = 27;
    lozenge(b, cx, cy);
    b.draw(flameFrames()[0], cx - 3, cy - 7, FLAME_KEY);
    b.draw(['kk', 'KK'], cx - 1, cy + 4, { k: C.edge, K: '#5A2A1A' });
    b.draw(['wwwww', 'WwwwV', '.VVV.'], cx - 2, cy + 6, { w: C.cream, W: C.white, V: C.cream3 });
    cornerStars(b);
    return b;
  }
  /** Lit's deck back, whole: warm bands under a lit wick. */
  function cardBack() { return backMedallion(backBase()); }

  // ------------------------------------------------------------ flame: three frames, stepped like hand-animated pixel art
  const FLAME_KEY = Object.freeze({ r: '#E8461C', o: '#FF7A2B', a: '#FFA458', y: '#FFD84A', u: '#FFF2B0', v: '#FFFFFF', k: C.edge });
  function flameFrames() {
    return [
      grid(['...r...', '...o...', '..ooo..', '..oao..', '.oayao.', '.oyuyo.', 'roauaor', '.oavao.', '..ooo..', '...k...']),
      grid(['...r...', '..ro...', '..oo...', '..oao..', '.oayao.', '.ayuyo.', 'roauaor', '.oavao.', '..ooo..', '...k...']),
      grid(['....r..', '...or..', '..ooo..', '..oaoo.', '.oayao.', '.oyuya.', 'roauaor', '.oavao.', '..ooo..', '...k...']),
    ];
  }
  /** The three flame frames side by side in one strip (21 x 10), stepped through by CSS. */
  function flameStrip(key = FLAME_KEY) {
    const fr = flameFrames(), b = new Bmp(7 * 3, 10);
    fr.forEach((g, i) => b.draw(g, i * 7, 0, key));
    return b;
  }

  // ------------------------------------------------------------ joker, tarot, planet and spectral cards
  const RARITY = deepFreeze({
    common: { ramp: R.peach, gems: 1, gem: R.cream },
    uncommon: { ramp: R.lime, gems: 2, gem: R.lime },
    rare: { ramp: R.pink, gems: 3, gem: R.pink },
    legendary: { ramp: R.vio, gems: 4, gem: R.ember, frame: 'legendary' },
  });
  const normRarity = (r) => { const k = String(r || 'common').toLowerCase(); return RARITY[k] ? k : 'common'; };
  /** Shared frame: a rarity-coloured body, a recessed art window and a dark name plate. */
  function frameCard(ramp, o = {}) {
    const n = ramp.length;
    const b = cardShape({ face: ramp[n - 4], hi: ramp[n - 2], shade: ramp[n - 5], lip: ramp[n - 6], mask: o.mask });
    // art window 31 x 31 at (5, 7): an inked rim, a dark top lip and a lit bottom lip so it reads as recessed
    b.rect(4, 6, 33, 33, C.edge);
    b.rect(5, 7, 31, 31, o.win || C.plum);
    for (let x = 4; x <= 36; x++) b.set(x, 39, ramp[n - 2]);
    // name plate 35 x 11 at (3, 41)
    b.rect(3, 41, 35, 11, C.edge);
    b.rect(4, 42, 33, 9, o.plate || '#2E1328');
    b.rect(4, 42, 33, 1, o.plateLine || '#5A2D4C');
    b.rect(4, 50, 33, 1, '#1E0B1A');
    return b;
  }
  function gems(b, n, ramp) {
    const w = n * 6 - 1, x0 = 20 - Math.floor(w / 2);
    const gm = emboss(Mask.rows(['.XXX.', 'XXXXX', 'XXXXX', '.XXX.']), ramp, { cap: 1.5, base: 4, gain: 4 });
    for (let i = 0; i < n; i++) { const g = new Bmp(7, 6); g.blit(gm, 1, 1); g.outline(C.edge); b.blit(g, x0 + i * 6 - 1, 0); }
  }
  /** Legendary gets its own frame in the same language: a deep violet body, a raised ember rim round the art window
      and the plate that matches its gems (lit above and left, shaded below and right), ember gems set in a dark
      arched crest, and a spark in each top corner. */
  function legendaryFrame() {
    const ramp = R.vio, n = ramp.length;
    const b = cardShape({ face: ramp[3], hi: ramp[6], shade: ramp[2], lip: ramp[1] });
    // the raised rim, an ember bevel that matches the gems: lit above and left of the window and plate, shaded below
    // and right (the violet body stays, so it never reads as a Tarot)
    const E = R.ember;
    for (let y = 5; y <= 52; y++) { b.set(2, y, E[6]); b.set(38, y, E[3]); }
    for (let x = 2; x <= 38; x++) { b.set(x, 5, E[6]); b.set(x, 52, E[3]); }
    b.set(38, 5, E[5]); b.set(2, 52, E[5]);
    b.rect(3, 6, 35, 46, ramp[4]);
    // art window 31 x 31 at (5, 7), as on every Joker
    b.rect(4, 6, 33, 33, C.edge);
    b.rect(5, 7, 31, 31, C.plum);
    for (let x = 4; x <= 36; x++) b.set(x, 39, ramp[n - 2]);
    // name plate 35 x 11 at (3, 41)
    b.rect(3, 41, 35, 11, C.edge);
    b.rect(4, 42, 33, 9, '#1A0A36');
    b.rect(4, 42, 33, 1, ramp[5]);
    b.rect(4, 50, 33, 1, '#10061E');
    // the arched crest the gems sit in (dark, with a lit top edge), and a spark in each top corner
    [[12, 1, 17], [9, 2, 23], [8, 3, 25], [8, 4, 25]].forEach(([x, y, w]) => b.rect(x, y, w, 1, ramp[1]));
    [[12, 1, 17], [10, 2, 2], [29, 2, 2], [9, 3, 1], [31, 3, 1]].forEach(([x, y, w]) => b.rect(x, y, w, 1, ramp[5]));
    b.set(11, 1, C.edge); b.set(29, 1, C.edge); b.set(9, 2, C.edge); b.set(31, 2, C.edge); b.set(8, 3, C.edge); b.set(32, 3, C.edge);
    const spark = ['.s.', 'svs', '.s.'];
    [[3, 1], [35, 1]].forEach(([x, y]) => b.draw(spark, x, y, { s: ramp[7], v: C.white }));
    return b;
  }
  /** A content draw() must give a kit Bmp no bigger than its window: a bigger one would be cropped silently. */
  function checkFigure(fig, w, h) {
    if (!(fig instanceof Bmp)) throw new Error(`draw() must return a kit.Bmp, not ${fig === null ? 'null' : typeof fig}`);
    if (fig.w > w || fig.h > h) throw new Error(`draw() returned ${fig.w}x${fig.h}; the window takes at most ${w}x${h}`);
    return fig;
  }
  /** Joker art window: a ground lit from the top in four bands, a pool of light behind the figure stepped in
      two shades, a few seeded specks, then the 31 x 31 figure. art: { ground: [4, dark to light], glow: [x, y, r],
      speck: [colours], draw(kit, ctx) -> Bmp } */
  function artWindow(b, art, id, x0 = 5, y0 = 7, ctx = {}) {
    for (let y = 0; y < 31; y++) for (let x = 0; x < 31; x++) b.set(x0 + x, y0 + y, art.ground[3 - Math.min(3, Math.floor((y / 31) * 4))]);
    const [gx, gy, gr] = art.glow || [15, 15, 12];
    for (let y = 0; y < 31; y++) for (let x = 0; x < 31; x++) {
      const d = Math.hypot(x - gx, (y - gy) * 1.1);
      if (d < gr * 0.62) b.set(x0 + x, y0 + y, shade(art.ground[3], 1.34));
      else if (d < gr) b.set(x0 + x, y0 + y, shade(art.ground[3], 1.16));
    }
    const rnd = rng(id);
    const speck = art.speck && art.speck.length ? art.speck : [C.white];
    for (let i = 0; i < 16; i++) { const x = Math.floor(rnd() * 31), y = Math.floor(rnd() * 31); b.set(x0 + x, y0 + y, speck[i % speck.length]); }
    const fig = checkFigure(art.draw(kit, ctx), 31, 31);
    if (art.outline !== false) fig.outline(C.edge);
    for (let y = 0; y < Math.min(31, fig.h); y++) for (let x = 0; x < Math.min(31, fig.w); x++) { const c = fig.get(x, y); if (c) b.set(x0 + x, y0 + y, c); }
  }
  /** A whole Joker card: the rarity frame, its gems and the art window. art.seed seeds the specks (default the id). */
  function jokerCard(id, rarity, art) {
    const key = normRarity(rarity), Rr = RARITY[key];
    const b = Rr.frame === 'legendary' ? legendaryFrame() : frameCard(Rr.ramp);
    gems(b, Rr.gems, Rr.gem);
    artWindow(b, art, art.seed || id, 5, 7, { id, rarity: key });
    if (art.overlay) art.overlay(kit, b, { id, rarity: key });
    return b;
  }

  // Tarot: a violet card with an arched window over a night sky, and a sun-eye above it.
  const tarotArch = (x, y) => { const dx = x - 20, dy = y - 21; return y >= 21 || dx * dx + dy * dy <= 15.6 * 15.6; };
  function tarotFrame() {
    const b = frameCard(R.vio, { plate: '#24104A', plateLine: '#6A44B8' });
    const arch = tarotArch;
    for (let y = 7; y < 38; y++) for (let x = 5; x < 36; x++) {
      if (!arch(x, y)) { b.set(x, y, R.vio[4]); continue; }
      const t = (y - 7) / 31, i = Math.min(4, Math.floor(t * 5));
      b.set(x, y, ['#221A66', '#2C2078', '#38288C', '#45309E', '#5238AE'][i]);
    }
    for (let y = 6; y < 38; y++) for (let x = 4; x < 37; x++) if (!arch(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => arch(x + dx, y + dy) && x + dx >= 5 && x + dx <= 35 && y + dy >= 7)) b.set(x, y, C.edge);
    [[9, 16], [30, 13], [12, 24], [33, 21], [17, 10], [27, 30], [8, 31]].forEach(([x, y], i) => b.set(x, y, i % 2 ? R.money[7] : C.white));
    // the sun-eye above the arch
    b.draw(['.u.u.u.u.', 'uyyyyyyyu', '.yvvkvvy.', '.yykkkyy.', '..yyyyy..'], 16, 0, { u: R.gold[5], y: R.gold[4], v: C.white, k: C.edge });
    return { b, clip: (x, y) => arch(x, y) };
  }
  // Planet: a deep-blue card with a round window, a dotted orbit and stars; the world itself is the item's.
  function planetFrame() {
    const b = frameCard(R.chips.slice(0, 7), { plate: '#10133E', plateLine: '#3346D6' });
    const cx = 20, cy = 22;
    for (let y = 7; y < 38; y++) for (let x = 5; x < 36; x++) b.set(x, y, R.night[2]);
    for (let y = 6; y < 39; y++) for (let x = 4; x < 37; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= 15.2) b.set(x, y, d > 14.3 ? C.edge : R.night[Math.max(0, 5 - Math.floor(d / 3))]);
    }
    for (let a = 0; a < 360; a += 10) {
      const x = Math.round(cx + Math.cos((a * Math.PI) / 180) * 12.5), y = Math.round(cy + Math.sin((a * Math.PI) / 180) * 5);
      b.set(x, y, a % 30 === 0 ? R.chips[8] : R.chips[6]);
    }
    [[9, 13], [31, 15], [11, 31], [29, 30], [20, 9], [25, 12]].forEach(([x, y]) => b.set(x, y, C.white));
    b.draw(['.c.', 'cvc', '.c.'], 5, 1, { c: R.chips[7], v: C.white }); b.draw(['.c.', 'cvc', '.c.'], 33, 1, { c: R.chips[7], v: C.white });
    return { b, clip: (x, y) => Math.hypot(x - cx, y - cy) <= 14.3 };
  }
  // Spectral: a dark card with a wavering pale border, ghostly specks and a mark at the top.
  const SPECTRAL_RAMP = Object.freeze(['#0C0F2A', '#141A44', '#1E2658', '#283270', '#344088', '#4652A0', '#5C6AB8']);
  function spectralFrame() {
    const b = frameCard(SPECTRAL_RAMP, { plate: '#0C1030', plateLine: '#3B4F8C' });
    for (let y = 7; y < 38; y++) for (let x = 5; x < 36; x++) b.set(x, y, (x * 7 + y * 3) % 13 === 0 ? '#25306A' : y < 18 ? '#141A44' : y < 28 ? '#18204E' : '#1C2658');
    for (let x = 4; x < 37; x++) { b.set(x, 5 + ((x >> 1) % 2), R.ghost[5]); b.set(x, 39 - ((x >> 1) % 2), R.ghost[5]); }
    [[28, 12], [30, 19], [26, 26], [9, 14], [8, 24]].forEach(([x, y]) => b.set(x, y, R.ghost[3]));
    b.draw(['h.h', '.v.', 'h.h'], 19, 0, { h: R.ghost[3], v: R.ghost[6] });
    return { b, clip: (x, y) => x >= 5 && x <= 35 && y >= 7 && y <= 37 };
  }
  const CONSUMABLE_FRAMES = { tarot: tarotFrame, planet: planetFrame, spectral: spectralFrame };
  // Lit outlined the Tarot and Spectral figures as a whole; the Planet's world carries its own outline.
  const CONSUMABLE_OUTLINE = { tarot: true, planet: false, spectral: true };
  /** A whole consumable card: the kind's frame, then the item's 31 x 31 illustration at the window (5, 7),
      clipped to the window's shape, then the item's optional overlay over the whole card. */
  function consumableCard(kind, id, art) {
    const { b, clip } = CONSUMABLE_FRAMES[kind]();
    const ctx = { id, kind };
    if (art.draw) {
      const f = checkFigure(art.draw(kit, ctx), 31, 31);
      if (art.outline ?? CONSUMABLE_OUTLINE[kind]) f.outline(C.edge);
      for (let y = 0; y < Math.min(31, f.h); y++) for (let x = 0; x < Math.min(31, f.w); x++) { const c = f.get(x, y); if (c && clip(5 + x, 7 + y)) b.set(5 + x, 7 + y, c); }
    }
    if (art.overlay) art.overlay(kit, b, ctx);
    return b;
  }

  // ------------------------------------------------------------ Voucher: a cream ticket stub (new for the game)
  /** The ticket: the card silhouette with round bites 2 px deep down both long sides, the lowest two either side of
      the tear line (y 40) that parts the stub from the plate. */
  function voucherMask() {
    const k = cardMask();
    for (const cy of [10, 19, 28, 40, 48]) for (const cx of [0, CW - 1]) for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= 4.6) k.set(x, y, 0);
    return k;
  }
  const VOUCHER_GROUND = Object.freeze(['#341024', '#43162E', '#521C38', '#622444']);
  /** A cream ticket stub: bitten sides, a gold punch hole at the top, the 31 x 31 art window at (5, 7), a perforated
      tear line across the ticket between the window's lip and the plate, and a dark name plate at (3, 41) like a
      Joker's, so the UI sets the name the same way. */
  function voucherFrame() {
    const b = frameCard(R.cream, { mask: voucherMask(), plate: '#3A1426', plateLine: '#7A3450' });
    // the punch hole: a gold grommet round a dark hole, set into the top edge
    const hole = new Bmp(7, 7);
    hole.draw(['.uyy.', 'uhhhy', 'yhhhY', 'yhhhY', '.YYY.'], 1, 1, { u: R.gold[5], y: R.gold[4], Y: R.gold[2], h: C.ink0 });
    hole.outline(C.edge);
    b.blit(hole, 17, 0);
    // the perforation: alternate pricked and pale pixels across the row between the window's lip and the plate
    for (let x = 3; x <= 37; x++) if (b.get(x, 40) && b.get(x, 40) !== C.edge) b.set(x, 40, x % 2 ? C.cream4 : C.cream1);
    return b;
  }
  function voucherCard(id, art) {
    const b = voucherFrame();
    const a = { ...art, ground: art.ground || VOUCHER_GROUND, speck: art.speck || [R.cream[6], R.gold[5]] };
    artWindow(b, a, art.seed || id, 5, 7, { id });
    if (art.overlay) art.overlay(kit, b, { id });
    return b;
  }

  // ------------------------------------------------------------ Booster Pack: a sliding matchbox (new for the game)
  const PACK_SIZES = Object.freeze(['normal', 'jumbo', 'mega']);
  const PACK_LABEL = 19; // the label's picture area, the same on every size: up to 19 x 19
  /** One matchbox drawn into b: the sleeve in the kind's ramp lit from the upper left, the tray peeking out on
      top, a burnt-orange striker strip down the right side and a cream label (21 x 21 with its ink rim) holding
      the kind's picture. Needs w >= 32 for the label; o.label === false leaves it off (a box seen behind). */
  function matchbox(b, x0, y0, w, h, ramp, label, o = {}) {
    const n = ramp.length;
    // the tray, pulled up out of the sleeve
    if (o.tray !== false) {
      const tray = new Bmp(w - 6, 4);
      tray.rect(0, 0, w - 6, 4, R.cream[4]); tray.rect(0, 0, w - 6, 1, R.cream[6]); tray.rect(w - 7, 0, 1, 4, R.cream[3]);
      for (let x = 1; x < w - 7; x++) tray.set(x, 3, R.cream[2]);
      const t = new Bmp(tray.w + 2, tray.h + 2); t.blit(tray, 1, 1); t.outline(C.edge);
      b.blit(t, x0 + 2, y0 - 4);
    }
    const k = roundRect(w, h, 0, 0, w - 1, h - 1, 2);
    const sleeve = emboss(k, ramp, { cap: 2, base: Math.max(1, n - 4), gain: 3.2 });
    const s = new Bmp(w + 2, h + 2); s.blit(sleeve, 1, 1); s.outline(C.edge);
    b.blit(s, x0 - 1, y0 - 1);
    // the striker: a rough burnt-orange strip with a grain of darker and lighter pixels
    const sx = x0 + w - 6, rnd = rng(`striker:${w}x${h}`);
    for (let y = y0 + 3; y < y0 + h - 3; y++) for (let x = sx; x < sx + 4; x++) {
      const r = rnd();
      b.set(x, y, r < 0.2 ? R.ember[1] : r > 0.84 ? R.ember[4] : x === sx ? R.ember[3] : R.ember[2]);
    }
    for (let y = y0 + 3; y < y0 + h - 3; y++) b.set(sx - 1, y, C.edge);
    // the label: a cream card with an inked rim, a lit top row and a shaded bottom row, the picture centred
    const lx = x0 + 3, ly = y0 + 4, lw = PACK_LABEL + 2, lh = PACK_LABEL + 2;
    if (o.label !== false) {
      b.rect(lx, ly, lw, lh, C.edge);
      b.rect(lx + 1, ly + 1, lw - 2, lh - 2, o.labelGround || R.cream[6]);
      b.rect(lx + 1, ly + lh - 2, lw - 2, 1, R.cream[4]);
      b.rect(lx + 1, ly + 1, lw - 2, 1, C.white);
      if (label) {
        const px = lx + 1 + Math.floor((lw - 2 - label.w) / 2), py = ly + 1 + Math.floor((lh - 2 - label.h) / 2);
        b.blit(label, px, py, { clip: (x, y) => x > lx && x < lx + lw - 1 && y > ly && y < ly + lh - 1 });
      }
      // two printed rules below the label
      const ry = ly + lh + 2;
      if (ry + 3 < y0 + h - 2) for (let x = lx; x < lx + lw; x++) { b.set(x, ry, ramp[n - 2]); if (x % 2) b.set(x, ry + 2, ramp[n - 2]); }
    }
    return { lx, ly, lw, lh, sx };
  }
  /** A whole pack: one matchbox (normal), a thick one with a gold band (jumbo) or two tied with gold twine
      and a gold star at the knot (mega). art: { ramp, label(kit, ctx) -> Bmp up to 19 x 19, labelGround } */
  function packCard(kind, size, art) {
    const b = new Bmp(CW, CH);
    const ramp = art.ramp || R.cream;
    const ctx = { kind, size };
    const label = art.label ? art.label(kit, ctx) : null;
    if (size === 'mega') {
      matchbox(b, 8, 5, 31, 40, ramp.map((c) => shade(c, 0.78)), null, { label: false });
      matchbox(b, 2, 13, 32, 40, ramp, label, { labelGround: art.labelGround, tray: false });
      // gold twine round both boxes below the label (never across it), a knot and a star tucked under it
      for (let x = 1; x < 40; x++) if (b.get(x, 43)) { b.set(x, 43, R.gold[4]); b.set(x, 44, R.gold[2]); }
      const star = new Bmp(9, 9);
      star.draw(['...u...', '..uyu..', 'uuyvyuu', '.uyyyu.', '.uy.yu.', '.u...u.'], 1, 1, { u: R.gold[3], y: R.gold[5], v: C.white });
      star.outline(C.edge);
      b.blit(star, 13, 39);
    } else if (size === 'jumbo') {
      // the box's side, so it reads thick: a shaded face stepping back up the right edge
      const sideRamp = ramp.map((c) => shade(c, 0.7));
      for (let y = 7; y < 53; y++) for (let i = 0; i < 3; i++) { const yy = y - i; if (yy >= 4) b.set(36 + i, yy, i === 0 ? sideRamp[2] : sideRamp[3]); }
      for (let y = 4; y < 51; y++) b.set(39, y, C.edge);
      for (let i = 0; i < 4; i++) b.set(36 + i, 6 - i, C.edge);
      matchbox(b, 3, 7, 32, 46, ramp, label, { labelGround: art.labelGround });
      // one gold band round the box
      for (let x = 2; x < 40; x++) if (b.get(x, 40)) { b.set(x, 39, R.gold[5]); b.set(x, 40, R.gold[4]); b.set(x, 41, R.gold[2]); }
    } else {
      matchbox(b, 4, 7, 33, 46, ramp, label, { labelGround: art.labelGround });
    }
    if (art.overlay) art.overlay(kit, b, ctx);
    return b;
  }

  // ------------------------------------------------------------ round tokens: Tags and Stakes (new for the game)
  // Pixel circles are stepped by hand (row widths), so no single-pixel nubs stick out at the four sides.
  const ROUND = Object.freeze({
    17: [7, 11, 13, 15, 15, 17, 17, 17, 17, 17, 17, 17, 15, 15, 13, 11, 7],
    15: [7, 11, 13, 13, 15, 15, 15, 15, 15, 15, 15, 13, 13, 11, 7],
    11: [5, 9, 9, 11, 11, 11, 11, 11, 9, 9, 5],
    9: [5, 7, 9, 9, 9, 9, 9, 7, 5],
  });
  /** A hand-stepped disc of diameter n (9, 11, 15 or 17) at (x0, y0) in a w x h mask. */
  function roundMask(w, h, n, x0 = 0, y0 = 0) {
    const rows = ROUND[n];
    return Mask.fn(w, h, (x, y) => { const j = y - y0; if (j < 0 || j >= n) return false; const half = (rows[j] - 1) / 2, c = x0 + (n - 1) / 2; return Math.abs(x - c) <= half; });
  }
  /** A coin's rim lit from the upper left: its outer half bright where it faces the light, its inner half bright
      where it faces away (the inside wall of a lip), a glint at the top left. */
  function litRim(b, ring, c, ramp, o = {}) {
    const n = ramp.length, base = o.base ?? n - 3, spread = o.spread ?? 2, mid = o.mid ?? c - 1.5;
    const L = Math.hypot(LIGHT[0], LIGHT[1]), lx = LIGHT[0] / L, ly = LIGHT[1] / L;
    for (let y = 0; y < ring.h; y++) for (let x = 0; x < ring.w; x++) {
      if (!ring.get(x, y)) continue;
      const dx = x - c, dy = y - c, d = Math.hypot(dx, dy) || 1, face = (dx * lx + dy * ly) / d;
      const lit = d >= mid ? face : -face;
      b.set(x, y, ramp[Math.max(0, Math.min(n - 1, Math.round(base + lit * spread)))]);
    }
    return b;
  }
  /** Draw a round token: ink edge, lit rim, a field of ground bands with a shadow along its top left, the
      picture clipped to the field. */
  function roundToken(S, F, rimRamp, art, id) {
    const c = (S - 1) / 2, f0 = (S - F) / 2, b = new Bmp(S, S);
    const outer = roundMask(S, S, S), field = roundMask(S, S, F, f0, f0);
    const ring = Mask.fn(S, S, (x, y) => outer.get(x, y) && !field.get(x, y));
    litRim(b, ring, c, rimRamp, art.rimLight);
    const ground = art.ground || ['#3C2132', '#2A1423'];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!field.get(x, y)) continue;
      const g = ground[Math.min(ground.length - 1, Math.floor(((y - f0) / F) * ground.length))];
      b.set(x, y, !field.get(x, y - 1) || !field.get(x - 1, y) ? shade(g, 0.72) : g);
    }
    if (art.draw) {
      const p = art.draw(kit, { id });
      if (art.outline) p.outline(C.edge);
      b.blit(p, Math.round(c - p.w / 2 + 0.5), Math.round(c - p.h / 2 + 0.5), { clip: (x, y) => field.get(x, y) });
    }
    const OE = edgeFlags(outer);
    for (let i = 0; i < S * S; i++) if (OE[i]) b.set(i % S, Math.floor(i / S), C.edge);
    if (art.overlay) art.overlay(kit, b, { id });
    return b;
  }
  /** Tag: a round brass token, 17 x 17, with an enamel picture in an 11 x 11 round field.
      art: { ground: [colours top to bottom], draw(kit) -> up to 11 x 11 (centred, clipped), outline?, overlay? } */
  const tagToken = (id, art) => roundToken(17, 11, R.brass, art, id);
  /** Stake: a round chip, 15 x 15, a smooth rim in the stake's own ramp (no spots or dashes: not a casino chip)
      round a 9 x 9 face showing the stake's sky. art: { rim: ramp, ground?: [colours], draw?(kit) -> up to 9 x 9 } */
  const stakeChip = (id, art) => roundToken(15, 9, art.rim || R.cream, art, id);

  // ------------------------------------------------------------ Blind emblems: candles
  function candleWax(tall) {
    const wax = tall ? 22 : 14, w = 17, h = wax + 6;
    const b = new Bmp(w, h);
    // the wax: a cylinder lit from the left
    const col = [C.white, C.cream, C.cream, C.cream1, C.cream1, C.cream2, C.cream3];
    for (let y = 0; y < wax; y++) for (let i = 0; i < 7; i++) b.set(5 + i, y, col[i]);
    b.set(5, 0, C.cream1); b.set(11, 0, C.cream3);
    // a pink drip running down
    b.rect(5, 0, 7, 1, R.pink[7]); b.rect(5, 1, 2, 3, R.pink[7]); b.set(5, 4, R.pink[6]); b.rect(9, 1, 2, 2, R.pink[7]); b.set(10, 3, R.pink[6]);
    // the dish
    const dish = Mask.fn(w, 4, (x, y) => (y === 0 ? x >= 2 && x <= 14 : y === 1 ? x >= 1 && x <= 15 : y === 2 ? x >= 1 && x <= 15 : x >= 3 && x <= 13));
    b.blit(emboss(dish, R.pink, { cap: 1.3, base: 5, gain: 3.6 }), 0, wax);
    b.outline(C.edge);
    return b;
  }

  // ------------------------------------------------------------ Seal, icons
  // Encore Seal: a swallowtail ribbon tucked over the card's top edge (never a round blob).
  function encoreRibbon() {
    const k = Mask.rows([
      'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX',
      'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXX.XXX', 'XX...XX', 'X.....X',
    ]);
    const r = emboss(k, R.pink, { cap: 2.2, base: 5, gain: 3.6 });
    const b = new Bmp(9, 17); b.blit(r, 1, 1);
    // the fold where it tucks over the edge, and a little loop mark in white
    for (let x = 1; x < 8; x++) b.set(x, 3, R.pink[3]);
    b.draw(['.vv.', 'v..v', 'v.vv', '.v..'], 3, 6, { v: C.white });
    b.outline(C.edge);
    return b;
  }
  // 9 x 9 line icons in one colour (k); the deck icon adds cream (w) and red (x). v marks a transparent knockout.
  // info, options and replay are Lit's; the rest are drawn for the game in the same weight. The deck icon is Lit's two
  // cards with a small heart on the front one (Lit's red plus on a white card read as a first-aid cross).
  const ICONS = deepFreeze({
    info: ['..kkkkk..', '.kvvvvvk.', 'kvvvkvvvk', 'kvvvvvvvk', 'kvvvkvvvk', 'kvvvkvvvk', 'kvvvkvvvk', '.kvvvvvk.', '..kkkkk..'],
    options: ['..kk.....', 'kkkkkkkkk', '..kk.....', '.........', '......kk.', 'kkkkkkkkk', '......kk.', '.........', '.........'],
    replay: ['...kkkk..', '..k....kk', '.k....kkk', 'k.....kkk', 'k........', 'k.......k', '.k.....k.', '..k...k..', '...kkk...'],
    deck: ['.kkkkkk..', 'kwwwwwk..', 'kwkkkkkkk', 'kwkwwwwwk', 'kwkwxwxwk', 'kwkwxxxwk', '.kkwwxwwk', '..kwwwwwk', '..kkkkkkk'],
    sell: ['kkkkk....', 'k...kk...', 'k.k..kk..', 'k.....kk.', 'kk.....kk', '.kk.....k', '..kk...kk', '...kk.kk.', '....kkk..'],
    use: ['......k..', '.....kkk.', '......k..', '....k...k', '...kk....', '..kk.....', '.kk......', 'kk.......', 'k........'],
    lock: ['..kkkkk..', '.kk...kk.', '.k.....k.', 'kkkkkkkkk', 'k.......k', 'k...k...k', 'k...k...k', 'k.......k', 'kkkkkkkkk'],
    close: ['k.......k', 'kk.....kk', '.kk...kk.', '..kk.kk..', '...kkk...', '..kk.kk..', '.kk...kk.', 'kk.....kk', 'k.......k'],
    back: ['..k......', '.kk......', 'kkkkkkk..', '.kk....k.', '..k.....k', '........k', '........k', '.......k.', '..kkkkk..'],
    sound: ['...k.....', '..kk...k.', 'kkkk.k..k', 'kkkk..k.k', 'kkkk..k.k', 'kkkk..k.k', 'kkkk.k..k', '..kk...k.', '...k.....'],
    music: ['...kkkkkk', '...kkkkkk', '...k....k', '...k....k', '...k....k', '.kkk..kkk', 'kkkk.kkkk', 'kkkk.kkkk', '.kk...kk.'],
    speed: ['.........', 'k...k....', 'kk..kk...', 'kkk.kkk..', 'kkkkkkkk.', 'kkk.kkk..', 'kk..kk...', 'k...k....', '.........'],
    check: ['.........', '........k', '.......kk', '......kk.', 'k....kk..', 'kk..kk...', '.kkkk....', '..kk.....', '.........'],
    plus: ['.........', '....k....', '....k....', '....k....', '.kkkkkkk.', '....k....', '....k....', '....k....', '.........'],
    minus: ['.........', '.........', '.........', '.........', '.kkkkkkk.', '.........', '.........', '.........', '.........'],
    'arrow-left': ['.........', '...k.....', '..kk.....', '.kkk.....', 'kkkkkkkkk', '.kkk.....', '..kk.....', '...k.....', '.........'],
    'arrow-right': ['.........', '.....k...', '.....kk..', '.....kkk.', 'kkkkkkkkk', '.....kkk.', '.....kk..', '.....k...', '.........'],
  });
  const ICON_LIGHT = '#FFE6CC'; // the table's light icon colour (Lit's left column)
  function icon(name, col = C.edge) {
    const g = ICONS[name];
    if (!g) throw new Error(`no icon "${name}"`);
    const b = new Bmp(g[0].length, g.length);
    b.draw(g, 0, 0, { k: col, v: 'rgba(0,0,0,0)', w: C.cream, x: R.red[3] });
    b.p = b.p.map((c) => (c === 'rgba(0,0,0,0)' ? null : c));
    return b;
  }

  // ------------------------------------------------------------ UI chrome, used as CSS border-image (9-slice)
  /** A panel: rounded on a 3-px curve, a translucent warm fill, a crisp lit top rim and a darker lower rim. */
  function panel(o = {}) {
    const S = 9, r = [3, 1, 1];
    const k = Mask.fn(S, S, (x, y) => { const c = y < 3 ? r[y] : y > S - 4 ? r[S - 1 - y] : 0; return x >= c && x < S - c; });
    const b = new Bmp(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!k.get(x, y)) continue;
      const up = !k.get(x, y - 1), dn = !k.get(x, y + 1), lf = !k.get(x - 1, y), rt = !k.get(x + 1, y);
      let c = o.fill;
      if (up) c = o.top;
      else if (dn) c = o.bottom;
      else if (lf || rt) c = o.side;
      else if (o.inner && !k.get(x, y - 2)) c = o.inner;
      b.set(x, y, c);
    }
    return b;
  }
  /** A lit panel: rounded on a 3-px curve, a warm lip of light two art px thick along the top (ember light,
      then plum), and a translucent fill that runs to the sides and bottom with no hairline; the soft tinted
      shadow (CSS) draws the bottom edge. Each panel can carry its own fill temperature. */
  function lipPanel(o = {}) {
    const S = 9, r = [3, 1, 1];
    const k = Mask.fn(S, S, (x, y) => { const c = y < 3 ? r[y] : y > S - 4 ? r[S - 1 - y] : 0; return x >= c && x < S - c; });
    const b = new Bmp(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!k.get(x, y)) continue;
      const first = !k.get(x, y - 1), second = !first && !k.get(x, y - 2);
      b.set(x, y, first ? o.lip0 : second ? o.lip1 : o.fill);
    }
    return b;
  }
  /** Pixel shards for the total's burst: a lit corner, a body and a shaded corner, on the art grid. */
  function shard(ramp, w, h, kind) {
    const n = ramp.length;
    if (kind === 'diag' || kind === 'anti') {
      // a diagonal streak drawn as a pixel staircase two pixels thick (so it never needs rotating)
      const b = new Bmp(w + 1, w);
      for (let k = 0; k < w; k++) {
        const y = kind === 'diag' ? k : w - 1 - k;
        b.set(k, y, k === 0 ? ramp[n - 1] : ramp[n - 3]);
        b.set(k + 1, y, ramp[n - 4]);
      }
      return b;
    }
    const b = new Bmp(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // lit along the top and left, shaded along the bottom and right, like every sprite on the table
      const c = x === 0 && y === 0 ? ramp[n - 1] : y === 0 || x === 0 ? ramp[n - 3] : y === h - 1 || x === w - 1 ? ramp[n - 5] : ramp[n - 4];
      b.set(x, y, c);
    }
    return b;
  }
  /** A pill label: an opaque face, a highlight row and a shade row. */
  function pill(ramp) {
    const n = ramp.length, S = 7, r = [2, 1];
    const k = Mask.fn(S, S, (x, y) => { const c = y < 2 ? r[y] : y > S - 3 ? r[S - 1 - y] : 0; return x >= c && x < S - c; });
    const b = new Bmp(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!k.get(x, y)) continue;
      const up = !k.get(x, y - 1), dn = !k.get(x, y + 1);
      b.set(x, y, up ? ramp[n - 2] : dn ? ramp[n - 6] : y === S - 2 ? ramp[n - 5] : ramp[n - 4]);
    }
    return b;
  }
  /** A button: a lit face, a crisp top highlight, and a lip that sinks when pressed. */
  function button(ramp, pressed) {
    const n = ramp.length, S = 9, Hh = 10, r = [3, 1, 1];
    const top = pressed ? 1 : 0, lip = pressed ? 1 : 2;
    const b = new Bmp(S, Hh);
    const k = Mask.fn(S, Hh, (x, y) => {
      if (y < top) return false;
      const yy = y - top, hh = Hh - top;
      const c = yy < 3 ? r[yy] : yy > hh - 4 ? r[hh - 1 - yy] : 0;
      return x >= c && x < S - c;
    });
    for (let y = 0; y < Hh; y++) for (let x = 0; x < S; x++) {
      if (!k.get(x, y)) continue;
      const fromBottom = Hh - 1 - y;
      const up = !k.get(x, y - 1);
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
  // empty slot: a faint recessed card shape with a dotted rim
  function slot() {
    const k = CARD_K, b = new Bmp(CW, CH);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      if (!k.get(x, y)) continue;
      const edge = CARD_E[y * CW + x] === 1;
      if (edge) { if ((x + y) % 3 !== 0) b.set(x, y, y < 3 ? '#F0BE9638' : '#F0BE9660'); } else b.set(x, y, '#12060E30');
    }
    return b;
  }
  const PLUM_BTN = Object.freeze(['#13070F', '#1E0D19', '#2A1423', '#3C2132', '#4D2B40', '#5A334C', '#6A3D55', '#7A4A62']);

  // ------------------------------------------------------------ Glitch Edition
  // The face stays crisp and in register; only its outline and the rank corners carry a red plate slipped
  // 1 art px left and a blue plate slipped 1 art px right (a fringe, not a doubled face).
  /** Lit's fringe: a (w + 2) x h bitmap meant to sit 1 art px left of the card. o.mask and o.regions (rects
      [x0, y0, x1, y1] whose dark pixels also get the fringe) default to the playing card's. The dark test reads
      bmp: pass the face layer (index and pips on a transparent ground) so a dark card stock is never marked. */
  function glitchFringe(bmp, o = {}) {
    const w = bmp.w, h = bmp.h, k = o.mask || (w === CW && h === CH ? CARD_K : cardMask(w, h));
    const inE = new Uint8Array(w * h);
    const mark = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) inE[y * w + x] = 1; };
    // the card's inked outline
    const KE = k === CARD_K ? CARD_E : edgeFlags(k);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < k.w && y < k.h && KE[y * k.w + x]) mark(x, y);
    // the rank corners: index glyph and small pip, top left and bottom right (anything darker than the card stock)
    const dark = (c) => { const [r, g, bl] = hexRGBA(c); return r + g + bl < 420; };
    const corner = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = bmp.get(x, y); if (c && dark(c)) mark(x, y); } };
    (o.regions || [[2, 2, 8, 18], [w - 9, h - 19, w - 3, h - 3]]).forEach((r) => corner(...r));
    const out = new Bmp(w + 2, h);
    const Rd = '#FF2E4AE0', B = '#4A62FFE0';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inE[y * w + x]) continue;
      const lx = x - 1, rx = x + 1;
      if (!(lx >= 0 && inE[y * w + lx])) out.set(lx + 1, y, Rd);
      if (!(rx < w && inE[y * w + rx])) out.set(rx + 1, y, B);
    }
    return out;
  }
  /** The fringe baked into the card itself, inside its silhouette only. What falls outside the 41 x 55 card
      (the plates 1 px beyond the left and right edges, the corner steps) is the UI's: CSS class ed-fourcolor
      draws it as two 1-art-px drop shadows (red left, blue right), which match Lit's outer fringe exactly.
      o.face (the face layer, as an Edition's ctx.face) decides which corner pixels are dark, so the fringe
      follows the index and pips on any stock; without it the finished card b is read, as Lit did. */
  function bakeFringe(b, o = {}) {
    const fr = glitchFringe(o.face || b, o), k = o.mask || (b.w === CW && b.h === CH ? CARD_K : cardMask(b.w, b.h)), out = b.clone();
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const c = fr.get(x + 1, y); if (c && k.get(x, y)) out.mix(x, y, c); }
    return out;
  }
  /** A small card for badges: 11 x 15 with 2-1 corners, inked, lit like the big one. */
  const miniMask = (w = 11, h = 15) => Mask.fn(w, h, (x, y) => { const r = y === 0 || y === h - 1 ? 2 : y === 1 || y === h - 2 ? 1 : 0; return x >= r && x < w - r; });
  function miniCard(o = {}) { return cardShape({ ...o, mask: o.mask || miniMask(o.w, o.h) }); }

  // ------------------------------------------------------------ the kit: everything above, for the content files
  const kit = Object.freeze({
    C, R, LIGHT, hexRGBA, blendHex, grid, Bmp, Mask, emboss, sphere, disc, ellipse, roundRect, strokeQuad, shade, rng, epx,
    GLYPH_S, GLYPH_L, parseGlyph, FONTS, TEXT, textBmp, textSize, num,
    PIP5, PIP7, bigPipMask, SUIT_RAMP, SUIT_INK4, fourColorFace, pipBmp, RANK_CH,
    CW, CH, CORNER, cornerAt, cardMask, cardShape, drawIndex, COLX, PIPS, numberFace, numberCard, aceFace, aceCard,
    HEAD, ROBE, PEOPLE, COURT_WHO, headKey, body, courtFigure, tempFigure, courtWindow, courtFace, faceCard,
    BAND_ORDER, backBase, lozenge, cornerStars, backMedallion, cardBack,
    FLAME_KEY, flameFrames, flameStrip,
    RARITY, frameCard, gems, legendaryFrame, artWindow, jokerCard,
    tarotArch, tarotFrame, planetFrame, spectralFrame, SPECTRAL_RAMP, consumableCard,
    voucherMask, voucherFrame, VOUCHER_GROUND, voucherCard, PACK_SIZES, PACK_LABEL, matchbox, packCard, ROUND, roundMask, litRim, roundToken, tagToken, stakeChip,
    candleWax, encoreRibbon, ICONS, ICON_LIGHT, icon, panel, lipPanel, shard, pill, button, slot, PLUM_BTN,
    glitchFringe, bakeFringe, miniMask, miniCard,
    SEAL_TOP: -4, SEAL_RIGHT: 38,
  });
  // Frozen all the way down (tables, ramps, glyphs, pip layouts, the light vector) and the two bitmap classes'
  // methods too: one stray in-place .reverse() or assignment in a content file would otherwise change other
  // files' sprites depending on draw order. In strict mode such a write throws instead.
  const freezeAll = (o, seen = new Set()) => {
    if (!o || typeof o !== 'object' || ArrayBuffer.isView(o) || seen.has(o)) return o;
    seen.add(o); Object.freeze(o); Object.values(o).forEach((v) => freezeAll(v, seen));
    return o;
  };
  freezeAll(kit); Object.freeze(Bmp.prototype); Object.freeze(Mask.prototype);

  // ------------------------------------------------------------ the registry
  const DEFS = new Map(); // id -> { id, kind, w, h, make, meta, data }
  const fail = (msg) => { throw new Error(`TW.Art: ${msg}`); };
  const isInt = (v) => Number.isInteger(v) && v > 0;
  /** Register a sprite. Lazy: make(kit) runs once, the first time someone asks for its pixels. */
  function define(id, spec) {
    if (typeof id !== 'string' || !id) fail('define(id, spec): id must be a non-empty string');
    if (DEFS.has(id)) fail(`define: duplicate sprite id "${id}"`);
    if (!spec || typeof spec.make !== 'function') fail(`define("${id}"): spec.make must be a function`);
    if (!isInt(spec.w) || !isInt(spec.h)) fail(`define("${id}"): spec.w and spec.h must be whole numbers above 0`);
    const meta = { ...(spec.meta || {}) };
    if (spec.temp) meta.temp = true;
    if (spec.name) meta.name = spec.name;
    DEFS.set(id, { id, kind: spec.kind || id.split(':')[0], w: spec.w, h: spec.h, make: spec.make, meta, data: null });
    return id;
  }
  function renderDef(d) {
    let out;
    // name the sprite in the error, so one failing Joker among 120 is easy to find (the cause keeps the stack)
    try { out = d.make(kit); } catch (e) { throw new Error(`TW.Art: "${d.id}" failed to draw: ${e && e.message}`, { cause: e }); }
    let bm;
    if (out instanceof Bmp) bm = { w: out.w, h: out.h, data: out.rgba() };
    // a frozen record is another sprite's cache (shared on purpose: one PNG); any other buffer is copied, so
    // the producer writing to it later can't change this sprite
    else if (out && out.data && typeof out.w === 'number') bm = Object.isFrozen(out) ? out : { w: out.w, h: out.h, data: Uint8ClampedArray.from(out.data) };
    else fail(`"${d.id}": make() returned no bitmap`);
    if (bm.w !== d.w || bm.h !== d.h) fail(`"${d.id}" drew ${bm.w}x${bm.h} but was declared ${d.w}x${d.h}`);
    if (bm.data.length !== bm.w * bm.h * 4) fail(`"${d.id}": pixel data is ${bm.data.length} bytes, not ${bm.w * bm.h * 4}`);
    return bm;
  }
  const has = (id) => DEFS.has(id);
  const ids = (prefix = '') => [...DEFS.keys()].filter((id) => id.startsWith(prefix));
  /** The sprite's pixels, { w, h, data: Uint8ClampedArray RGBA } (cached), or null for an unknown id. The record
      is frozen and shared by every caller: never write to its data (a typed array cannot be frozen). */
  function bitmap(id) {
    const d = DEFS.get(id);
    if (!d) return null;
    if (!d.data) d.data = Object.freeze(renderDef(d));
    return d.data;
  }
  /** A fresh render that skips the cache (tests and tools: determinism checks). */
  function render(id) { const d = DEFS.get(id); return d ? renderDef(d) : null; }
  const URLS = new Map(), URL_BY_DATA = new WeakMap(), URL_FAILED = new Set();
  /** PNG data URL for a sprite, made once through a canvas. Browser only: null when there is no document.
      A sprite whose make() throws gives null (logged once, and not drawn again on the next call), so the UI can
      show its placeholder instead. */
  function url(id) {
    if (URLS.has(id)) return URLS.get(id);
    const doc = globalThis.document;
    if (!doc || typeof doc.createElement !== 'function') return null;
    let bm;
    try { bm = bitmap(id); } catch (e) {
      if (!URL_FAILED.has(id)) { URL_FAILED.add(id); if (globalThis.console) globalThis.console.error(e); }
      URLS.set(id, null); // a failed sprite is not redrawn on every call; court() clears it when the figure changes
      return null;
    }
    if (!bm) return null;
    let u = URL_BY_DATA.get(bm.data);
    if (!u) {
      const cv = doc.createElement('canvas');
      cv.width = bm.w; cv.height = bm.h;
      // CPU-backed: a sprite is encoded to PNG once, and a GPU canvas would stall on every read-back
      const g = cv.getContext('2d', { willReadFrequently: true });
      if (!g) return null;
      const im = g.createImageData(bm.w, bm.h);
      im.data.set(bm.data);
      g.putImageData(im, 0, 0);
      u = cv.toDataURL('image/png');
      URL_BY_DATA.set(bm.data, u);
    }
    URLS.set(id, u);
    return u;
  }
  /** Draw and encode sprites ahead of need, in idle time, a few milliseconds per slice, so dealing a fresh hand
      or opening the Shop doesn't stall on first draws. list: sprite ids, or a prefix string ('card:'). o.budget:
      ms per slice (default 10). Resolves with how many were warmed; 0 at once in Node or when all are cached.
      Typical use: the 52 faces and the run's back at boot, then the next Shop's items while the Blind is played. */
  function warm(list, o = {}) {
    const all = typeof list === 'string' ? ids(list) : [...(list || [])];
    const queue = all.filter((id) => DEFS.has(id) && !URLS.has(id)), budget = Math.max(1, o.budget ?? 10);
    const doc = globalThis.document;
    if (!doc || typeof doc.createElement !== 'function' || !queue.length) return Promise.resolve(0);
    const now = () => (globalThis.performance ? globalThis.performance.now() : Date.now());
    const idle = typeof globalThis.requestIdleCallback === 'function'
      ? (f) => globalThis.requestIdleCallback(f, { timeout: 2000 })
      : (f) => setTimeout(() => f({ timeRemaining: () => budget }), 50);
    let n = 0;
    return new Promise((done) => {
      const slice = (dl) => {
        const end = now() + Math.max(1, Math.min(budget, dl && dl.timeRemaining ? dl.timeRemaining() : budget));
        do { try { url(queue.shift()); n++; } catch (e) { /* a canvas that can't encode skips that sprite */ } } while (queue.length && now() < end);
        if (queue.length) idle(slice); else done(n);
      };
      idle(slice);
    });
  }
  /** What the registry knows about a sprite: { id, kind, w, h, temp, ... } or null. */
  function meta(id) {
    const d = DEFS.get(id);
    if (!d) return null;
    const m = { id, kind: d.kind, w: d.w, h: d.h, ...d.meta, temp: !!d.meta.temp };
    // a playing card (two- or four-colour) is temporary while its court figure or one of its mods is
    const cm = /^card4?:(\d+)([SHCD])(?:\|([^|]*)\|([^|]*)\|([^|]*))?$/.exec(id);
    if (cm) {
      const r = Number(cm[1]);
      if (r >= 11 && r <= 13) { const ct = COURTS.get(cm[1] + cm[2]); if (!ct || ct.temp) m.temp = true; }
      [[ENHANCEMENTS, cm[3]], [SEALS, cm[4]], [EDITIONS, cm[5]]].forEach(([reg, part]) => { if (part && reg.get(part) && reg.get(part).temp) m.temp = true; });
    }
    return m;
  }

  // ------------------------------------------------------------ playing cards: courts, card mods and composition
  const SUITS = 'SHCD';
  const COURTS = new Map(); // '11S' -> spec
  const ENHANCEMENTS = new Map(), SEALS = new Map(), EDITIONS = new Map();
  const normRank = (r) => {
    const n = typeof r === 'string' ? ({ A: 14, K: 13, Q: 12, J: 11, T: 10 }[r.toUpperCase()] || Number(r)) : r;
    if (!Number.isInteger(n) || n < 2 || n > 14) fail(`card: rank must be 2 to 14, not ${JSON.stringify(r)}`);
    return n;
  };
  const normSuit = (s) => { const u = String(s || '').toUpperCase(); if (u.length !== 1 || !SUITS.includes(u)) fail(`card: suit must be S, H, C or D, not ${JSON.stringify(s)}`); return u; };
  /** Register the figure for a court (rank 11, 12 or 13). spec: { figure(kit, ctx) -> Bmp up to 19 x 45 (not yet
      outlined), ground?: [4 colours top to bottom], dot?, at?: [x, y], outline?: true, over?(kit, b, ctx), temp? }
      A temporary court may be replaced by a later call; a finished one may not. A temporary court registered after
      a finished one is ignored, so placeholders never depend on load order. */
  function court(rank, suit, spec) {
    const r = normRank(rank), s = normSuit(suit);
    if (r < 11 || r > 13) fail(`court: rank must be 11, 12 or 13, not ${rank}`);
    if (!spec || typeof spec.figure !== 'function') fail(`court(${r}, ${s}): spec.figure must be a function`);
    const prev = COURTS.get(`${r}${s}`);
    if (prev && !prev.temp) {
      if (spec.temp) return `card:${r}${s}`; // a placeholder never displaces a finished figure, whatever the load order
      fail(`court(${r}, ${s}) is already drawn; edit the file that drew it`);
    }
    COURTS.set(`${r}${s}`, { ...spec, temp: !!spec.temp });
    // forget anything already drawn with the old figure: the face and every composition of it, in both inks
    FACES.delete(`${r}${s}`); FACES4.delete(`${r}${s}`);
    const base = `card:${r}${s}`, base4 = `card4:${r}${s}`;
    for (const [id, d] of DEFS) if (id === base || id.startsWith(`${base}|`) || id === base4 || id.startsWith(`${base4}|`)) { d.data = null; URLS.delete(id); URL_FAILED.delete(id); }
    return base;
  }
  // A court nobody registered falls back to Lit's own person for that rank in the suit's robe, still flagged
  // temporary (the gallery's dashed outline, art-coverage --strict), so the game never shows a blank figure.
  const TEMP_COURT = Object.freeze({ temp: true, figure: (k, ctx) => courtFigure(ctx.who, ctx.suit) });
  /** The face of a playing card (index, pips, Ace mark or court) on a transparent layer. Drawn once per card and
      handed out as a copy (every composition of a card shares it); court() forgets a court's face. */
  const FACES = new Map();
  function playingFace(rank, suit) {
    const key = `${rank}${suit}`;
    let f = FACES.get(key);
    if (!f) {
      f = new Bmp(CW, CH);
      if (rank === 14) aceFace(f, suit);
      else if (rank >= 11) courtFace(f, rank, suit, COURTS.get(key) || TEMP_COURT);
      else numberFace(f, rank, suit);
      FACES.set(key, f);
    }
    return f.clone();
  }
  /** The same face in the four-colour inks (fourColorFace): drawn once per card, handed out as a copy. */
  const FACES4 = new Map();
  function playingFace4(rank, suit) {
    const key = `${rank}${suit}`;
    let f = FACES4.get(key);
    if (!f) { f = fourColorFace(playingFace(rank, suit), suit); FACES4.set(key, f); }
    return f.clone();
  }
  /** Stock (by Enhancement), then face, then the Enhancement's overlay, the Edition's pixels and the Seal. four: the
      face in the four-colour inks (ctx.fourColor tells the mods). */
  function composeCard(rank, suit, enh, seal, ed, four = false) {
    const ctx = { rank, suit, who: COURT_WHO[rank] || null, enhancement: enh || '', seal: seal || '', edition: ed || '', fourColor: !!four };
    const E = enh ? ENHANCEMENTS.get(enh) : null, D = ed ? EDITIONS.get(ed) : null, S = seal ? SEALS.get(seal) : null;
    let b = E && E.stock ? E.stock(kit, ctx) : cardShape();
    if (!(b instanceof Bmp) || b.w !== CW || b.h !== CH) fail(`enhancement "${enh}": stock() must return a ${CW}x${CH} Bmp`);
    const face = four ? playingFace4(rank, suit) : playingFace(rank, suit);
    ctx.face = face;
    b.blit(face, 0, 0);
    if (E && E.over) E.over(kit, b, ctx);
    if (D && D.apply) { const r = D.apply(kit, b, ctx); if (r) b = r; }
    if (S) {
      if (S.draw) S.draw(kit, b, ctx);
      else { const bd = bitmapBmp(`seal:${seal}`); const at = S.at || [kit.SEAL_RIGHT - bd.w, kit.SEAL_TOP]; b.blit(bd, at[0], at[1]); }
    }
    if (!(b instanceof Bmp) || b.w !== CW || b.h !== CH) fail(`card ${rank}${suit}: an Edition returned a bitmap that is not ${CW}x${CH}`);
    return b;
  }
  // badges are kept as Bmps too, so a Seal can be stamped onto a card
  const BADGE_BMP = new Map();
  function bitmapBmp(id) { if (!BADGE_BMP.has(id)) BADGE_BMP.set(id, DEFS.get(id).make(kit)); return BADGE_BMP.get(id); }
  /** Spades and Hearts keep their inks, so their four-colour picture is the two-colour one (one record, one PNG). */
  const SAME_IN_FOUR = (s) => s === 'S' || s === 'H';
  /** The plain face of a playing card: 'card:{rank}{suit}', or with fourColor 'card4:{rank}{suit}' (Clubs and
      Diamonds in their own inks). 10-cards.js registers all 52 of each. */
  function cardFace(rank, suit, fourColor = false) {
    const r = normRank(rank), s = normSuit(suit);
    if (!fourColor) return define(`card:${r}${s}`, { w: CW, h: CH, kind: 'card', make: () => composeCard(r, s, '', '', '') });
    return define(`card4:${r}${s}`, {
      w: CW, h: CH, kind: 'card', meta: { fourColor: true },
      make: () => (SAME_IN_FOUR(s) && DEFS.has(`card:${r}${s}`) ? bitmap(`card:${r}${s}`) : composeCard(r, s, '', '', '', true)),
    });
  }
  // A mod TW.Content knows but no art file has drawn yet: said once on the console (art-coverage and the gallery's
  // missing list name its badge too), and the card is drawn without it.
  const WARNED = new Set();
  function modPart(reg, table, what, v) {
    if (!v) return '';
    if (reg.has(v)) return v;
    const rows = TW.Content && TW.Content[table];
    if (!WARNED.has(`${what}:${v}`) && Array.isArray(rows) && rows.some((row) => row && row.id === v)) {
      WARNED.add(`${what}:${v}`);
      if (globalThis.console) globalThis.console.warn(`TW.Art: ${what} "${v}" has no art yet; cards are drawn without it`);
    }
    return '';
  }
  /** Compose a playing card with its Enhancement, Seal and Edition into one cached sprite and return its id,
      'card:{rank}{suit}|{enh}|{seal}|{edition}'. Accepts an engine card. A part with no art registered is left out
      (and warned about once when TW.Content knows it). With fourColor: true (the colour-coded suits option) the id is
      'card4:{rank}{suit}|{enh}|{seal}|{edition}' and Clubs and Diamonds are drawn in their own inks (SUIT_INK4); a
      Spade or a Heart shares its two-colour picture. */
  function card(o) {
    if (!o) fail('card({ rank, suit, enhancement, seal, edition, fourColor }) needs a card');
    const r = normRank(o.rank), s = normSuit(o.suit);
    const enh = modPart(ENHANCEMENTS, 'ENHANCEMENTS', 'enhancement', o.enhancement);
    const seal = modPart(SEALS, 'SEALS', 'seal', o.seal);
    const ed = modPart(EDITIONS, 'EDITIONS', 'edition', o.edition);
    const four = !!o.fourColor, parts = `${r}${s}|${enh}|${seal}|${ed}`;
    const id = `${four ? 'card4' : 'card'}:${parts}`;
    if (!DEFS.has(id)) {
      const plain = !enh && !seal && !ed;
      if (!four) define(id, { w: CW, h: CH, kind: 'card', make: () => (plain && DEFS.has(`card:${r}${s}`) ? bitmap(`card:${r}${s}`) : composeCard(r, s, enh, seal, ed)) });
      else {
        const twin = SAME_IN_FOUR(s) ? card({ rank: r, suit: s, enhancement: enh, seal, edition: ed }) : null;
        define(id, {
          w: CW, h: CH, kind: 'card', meta: { fourColor: true },
          make: () => (twin ? bitmap(twin) : plain && DEFS.has(`card4:${r}${s}`) ? bitmap(`card4:${r}${s}`) : composeCard(r, s, enh, seal, ed, true)),
        });
      }
    }
    return id;
  }
  /** The bare stock of a composed playing card, for the UI's moving Edition light (ed-gloss's sweep, ed-benday's
      hum): 'mask:{card id}', 41 x 55, white where the card shows its plain stock and clear on the ink edge, the
      index, pips, Ace mark, court, an Enhancement's marks and the Seal, so the light lands where the baked band does
      (ART.md section 11). Built from the card without its Edition. Null for an id that is not a playing card. */
  function stockMask(id) {
    const m = /^(card4?):(\d+)([SHCD])(?:\|([^|]*)\|([^|]*)\|([^|]*))?$/.exec(String(id || ''));
    if (!m) return null;
    const mid = `mask:${m[0]}`;
    if (!DEFS.has(mid)) {
      const four = m[1] === 'card4', r = normRank(Number(m[2])), s = m[3];
      const enh = ENHANCEMENTS.has(m[4] || '') ? m[4] : '', seal = SEALS.has(m[5] || '') ? m[5] : '';
      define(mid, {
        w: CW, h: CH, kind: 'mask',
        make: () => {
          const E = enh ? ENHANCEMENTS.get(enh) : null, S = seal ? SEALS.get(seal) : null;
          const ctx = { rank: r, suit: s, who: COURT_WHO[r] || null, enhancement: enh, seal, edition: '', fourColor: four };
          const stock = E && E.stock ? E.stock(kit, ctx) : cardShape();
          const shown = composeCard(r, s, enh, seal, '', four), face = four ? playingFace4(r, s) : playingFace(r, s), out = new Bmp(CW, CH);
          const edge = (x, y) => !stock.get(x + 1, y) || !stock.get(x - 1, y) || !stock.get(x, y + 1) || !stock.get(x, y - 1);
          for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const c = stock.get(x, y); if (c && !edge(x, y) && !face.get(x, y) && shown.get(x, y) === c) out.set(x, y, '#FFFFFF'); }
          if (S) { // the Seal's stamp, even where a pixel of it matches the stock under it
            const bd = bitmapBmp(`seal:${seal}`), at = S.at || [kit.SEAL_RIGHT - bd.w, kit.SEAL_TOP];
            for (let y = 0; y < bd.h; y++) for (let x = 0; x < bd.w; x++) if (bd.get(x, y)) out.del(at[0] + x, at[1] + y);
          }
          return out;
        },
      });
    }
    return mid;
  }
  const badgeSpec = (what, id, spec) => {
    if (!spec || typeof spec.badge !== 'function') fail(`${what}("${id}"): spec.badge(kit) must draw its small badge`);
    if (!isInt(spec.w) || !isInt(spec.h) || spec.w > 17 || spec.h > 17) fail(`${what}("${id}"): spec.w and spec.h give the badge size, at most 17 x 17`);
  };
  /** An Enhancement: { w, h, badge(kit) -> Bmp (enh:{id}), stock?(kit, ctx) -> 41 x 55 card body,
      over?(kit, b, ctx) drawn after the face (ctx.face is the face layer), temp? } */
  function enhancement(id, spec) {
    badgeSpec('enhancement', id, spec);
    if (ENHANCEMENTS.has(id)) fail(`enhancement "${id}" is already registered`);
    define(`enh:${id}`, { w: spec.w, h: spec.h, kind: 'enh', temp: spec.temp, make: (k) => spec.badge(k) });
    ENHANCEMENTS.set(id, spec);
    return `enh:${id}`;
  }
  /** A Seal: { w, h, badge(kit) -> Bmp (seal:{id}), at?: [x, y], draw?(kit, b, ctx), temp? }. By default the badge
      is stamped at the Seal spot: its right edge at x 38, its top 4 px above the card (clipped to the card). */
  function seal(id, spec) {
    badgeSpec('seal', id, spec);
    if (SEALS.has(id)) fail(`seal "${id}" is already registered`);
    const at = Object.freeze([...(spec.at || [kit.SEAL_RIGHT - spec.w, kit.SEAL_TOP])]); // meta(id).at hands out this array
    define(`seal:${id}`, { w: spec.w, h: spec.h, kind: 'seal', temp: spec.temp, meta: { at }, make: (k) => spec.badge(k) });
    SEALS.set(id, { ...spec, at });
    return `seal:${id}`;
  }
  /** An Edition: { w, h, badge(kit) -> Bmp (edition:{id}), apply?(kit, b, ctx) -> Bmp | undefined, temp? }.
      apply bakes the Edition's pixels into the card; moving light is CSS class ed-{id}, owned by the UI. */
  function edition(id, spec) {
    badgeSpec('edition', id, spec);
    if (EDITIONS.has(id)) fail(`edition "${id}" is already registered`);
    define(`edition:${id}`, { w: spec.w, h: spec.h, kind: 'edition', temp: spec.temp, make: (k) => spec.badge(k) });
    EDITIONS.set(id, spec);
    return `edition:${id}`;
  }

  // ------------------------------------------------------------ helpers for the content files (ART.md)
  const needDraw = (what, id, spec) => { if (!spec || typeof spec.draw !== 'function') fail(`${what}("${id}"): spec.draw(kit) must return its illustration`); };
  /** The Joker's rarity: TW.Content's row when it has one, else spec.rarity, else common. */
  function jokerRarity(id, spec) {
    const t = TW.Content && TW.Content.JOKERS;
    const row = t && (t[id] || (Array.isArray(t) ? t.find((j) => j.id === id) : null));
    return normRarity((row && row.rarity) || spec.rarity);
  }
  /** joker(id, { ground: [4], glow?: [x, y, r], speck: [colours], seed?, rarity?, draw(kit) -> 31 x 31, outline?, overlay? }) */
  function joker(id, spec) {
    needDraw('joker', id, spec);
    if (!Array.isArray(spec.ground) || spec.ground.length < 4) fail(`joker("${id}"): spec.ground needs 4 colours, dark to light`);
    return define(`joker:${id}`, { w: CW, h: CH, kind: 'joker', temp: spec.temp, make: () => jokerCard(id, jokerRarity(id, spec), spec) });
  }
  const consumable = (kind) => (id, spec) => {
    needDraw(kind, id, spec);
    return define(`${kind}:${id}`, { w: CW, h: CH, kind, temp: spec.temp, make: () => consumableCard(kind, id, spec) });
  };
  /** voucher(id, { draw(kit) -> 31 x 31, ground?: [4], glow?, speck?, overlay? }) */
  function voucher(id, spec) {
    needDraw('voucher', id, spec);
    return define(`voucher:${id}`, { w: CW, h: CH, kind: 'voucher', temp: spec.temp, make: () => voucherCard(id, spec) });
  }
  /** pack(kind, { ramp, label(kit, ctx) -> Bmp up to 19 x 19, labelGround?, overlay? }) defines
      pack:{kind}normal, pack:{kind}jumbo and pack:{kind}mega. */
  function pack(kind, spec) {
    if (!spec || typeof spec.label !== 'function') fail(`pack("${kind}"): spec.label(kit, ctx) must draw the label picture`);
    return PACK_SIZES.map((size) => define(`pack:${kind}${size}`, { w: CW, h: CH, kind: 'pack', temp: spec.temp, meta: { packKind: kind, size }, make: () => packCard(kind, size, spec) }));
  }
  /** tag(id, { draw(kit) -> up to 11 x 11, ground?: [colours top to bottom], outline?, overlay? }) */
  function tag(id, spec) {
    needDraw('tag', id, spec);
    return define(`tag:${id}`, { w: 17, h: 17, kind: 'tag', temp: spec.temp, make: () => tagToken(id, spec) });
  }
  /** boss(id, { w, h, draw(kit) -> Bmp, outline?: true }): its own emblem, at most 31 x 31 after the outline. With
      outline on (the default) draw() returns (w - 2) x (h - 2) and the core inks it, as Lit did for The Smudge. */
  function boss(id, spec) {
    needDraw('boss', id, spec);
    if (!isInt(spec.w) || !isInt(spec.h) || spec.w > 31 || spec.h > 31) fail(`boss("${id}"): spec.w and spec.h give the emblem size, at most 31 x 31`);
    return define(`boss:${id}`, {
      w: spec.w, h: spec.h, kind: 'boss', temp: spec.temp,
      make: (k) => {
        const f = spec.draw(k, { id });
        if (spec.outline === false) return f;
        const o = new Bmp(f.w + 2, f.h + 2); o.blit(f, 1, 1); o.outline(C.edge);
        return o;
      },
    });
  }
  /** stake(id, { rim: ramp, ground?: [colours top to bottom], draw?(kit) -> up to 9 x 9, overlay? }) */
  function stake(id, spec) {
    if (!spec || !Array.isArray(spec.rim)) fail(`stake("${id}"): spec.rim must be a colour ramp, dark to light`);
    return define(`stake:${id}`, { w: 15, h: 15, kind: 'stake', temp: spec.temp, make: () => stakeChip(id, spec) });
  }
  /** back(deckId, { bands?: [7 colours], order?, field?(x, y), lip?, lipTop?, draw(kit, b, ctx) }): the shared back
      (stock, field, inset frame), then the deck's own medallion or pattern drawn by draw(). */
  function back(deckId, spec) {
    if (!spec || typeof spec.draw !== 'function') fail(`back("${deckId}"): spec.draw(kit, b) must draw the deck's medallion`);
    return define(`back:${deckId}`, {
      w: CW, h: CH, kind: 'back', temp: spec.temp,
      make: (k) => { const b = backBase(spec); spec.draw(k, b, { id: deckId }); return b; },
    });
  }

  // ------------------------------------------------------------ chrome sprites ('ui:*', 'icon:*'), from Lit's frames()
  const LIP = { lip0: '#FFD29CA8', lip1: '#8C5671B8' };
  const UI = {
    panel: [9, 9, () => lipPanel({ ...LIP, fill: '#2E0F249E' })],
    'panel-warm': [9, 9, () => lipPanel({ lip0: '#FFDCA8C0', lip1: '#A2566AC0', fill: '#4A1A2CA8' })],
    'panel-deep': [9, 9, () => lipPanel({ lip0: '#FFD29C90', lip1: '#6A3D55C0', fill: '#170612C4' })],
    'panel-rack': [9, 9, () => lipPanel({ ...LIP, fill: '#2A0D2288' })],
    well: [9, 9, () => panel({ top: '#0A02088C', side: '#FFD6B41A', bottom: '#FFDCBE40', fill: '#14050F80' })],
    // the wells are opaque: a mote drifting behind never shows through a number
    chips: [9, 9, () => panel({ top: '#05082EFF', side: '#2A3AB0FF', bottom: '#8C9EFFFF', fill: '#121860FF', inner: '#060A38FF' })],
    mult: [9, 9, () => panel({ top: '#2E040CFF', side: '#8A1A24FF', bottom: '#FF9A84FF', fill: '#5A0C1CFF', inner: '#30040EFF' })],
    tip: [9, 9, () => lipPanel({ lip0: '#FFE2BCD0', lip1: '#8C5671E0', fill: '#24091CF2' })],
    plaque: [9, 9, () => lipPanel({ lip0: '#FFE6C0F0', lip1: '#B8607AE8', fill: '#2A0C20EE' })],
    dialog: [9, 9, () => lipPanel({ lip0: '#FFE6C0F0', lip1: '#A2566AF0', fill: '#2A0C20F6' })],
    boss: [9, 9, () => lipPanel({ lip0: '#CDA8FFE0', lip1: '#6F33C9E0', fill: '#1E0B42F0' })],
    'btn-ghost': [9, 9, () => lipPanel({ lip0: '#FFD29C80', lip1: '#8C567190', fill: '#3A132C8C' })],
    slot: [CW, CH, slot],
    flame: [21, 10, () => flameStrip()],
  };
  const BTN_RAMPS = { ember: R.ember, pink: R.pink, cream: R.cream, yellow: R.money, plum: PLUM_BTN, lime: R.lime, vio: R.vio, blue: R.chips, red: R.mult };
  Object.entries(BTN_RAMPS).forEach(([n, ramp]) => {
    UI[`pill-${n}`] = [7, 7, () => pill(ramp)];
    UI[`btn-${n}`] = [9, 10, () => button(ramp)];
    UI[`btn-${n}-down`] = [9, 10, () => button(ramp, true)];
  });
  Object.entries(UI).forEach(([n, [w, h, make]]) => define(`ui:${n}`, { w, h, kind: 'ui', make }));
  Object.keys(ICONS).forEach((n) => {
    define(`icon:${n}`, { w: 9, h: 9, kind: 'icon', make: () => icon(n) });
    define(`icon:${n}:light`, { w: 9, h: 9, kind: 'icon', make: () => icon(n, ICON_LIGHT) });
  });

  // on-demand sprites: digits and shards, defined the first time they are asked for
  /** The Ember digit face as a sprite: 'num:{size}:{style}:{text}' (sizes S, L, XL, XXL; styles in kit.TEXT). */
  function numId(text, size = 'S', style = 'cream') {
    const str = String(text === '' || text == null ? ' ' : text);
    if (!FONTS[size]) fail(`num: size must be one of ${Object.keys(FONTS).join(', ')}`);
    if (!TEXT[style]) fail(`num: style must be one of ${Object.keys(TEXT).join(', ')}`);
    const id = `num:${size}:${style}:${str}`;
    if (!DEFS.has(id)) { const { w, h } = textSize(str, size, style); define(id, { w, h, kind: 'num', make: () => textBmp(str, size, style) }); }
    return id;
  }
  /** A payout shard: 'fx:shard:{colour}:{w}x{h}:{kind}' (colour: a ramp name such as chips, mult, lime, pink). */
  function shardId(col, w, h, kind = '') {
    if (!R[col]) fail(`shard: no ramp "${col}"`);
    const id = `fx:shard:${col}:${w}x${h}:${kind}`;
    if (!DEFS.has(id)) define(id, { w: kind === 'diag' || kind === 'anti' ? w + 1 : w, h: kind === 'diag' || kind === 'anti' ? w : h, kind: 'fx', make: () => shard(R[col], w, h, kind) });
    return id;
  }

  // content tables behind each sprite prefix (the gallery and tools/art-coverage.mjs read this)
  const TABLES = Object.freeze({
    joker: 'JOKERS', tarot: 'TAROTS', planet: 'PLANETS', spectral: 'SPECTRALS', boss: 'BOSSES', voucher: 'VOUCHERS',
    tag: 'TAGS', pack: 'PACKS', back: 'DECKS', stake: 'STAKES', enh: 'ENHANCEMENTS', seal: 'SEALS', edition: 'EDITIONS', blind: 'BLINDS',
  });

  TW.Art = {
    // ARCH section 4
    define, has, ids, bitmap, url, card, kit,
    // the bare stock of a composed playing card, the mask of the UI's moving Edition light
    stockMask,
    // helpers for the content files
    joker, tarot: consumable('tarot'), planet: consumable('planet'), spectral: consumable('spectral'),
    voucher, pack, tag, boss, stake, back, court, cardFace,
    enhancement, seal, edition,
    // reading the registry
    meta, render, warm, num: numId, shard: shardId,
    enhancements: () => [...ENHANCEMENTS.keys()], seals: () => [...SEALS.keys()], editions: () => [...EDITIONS.keys()],
    courts: () => [...COURTS.entries()].map(([k, v]) => ({ id: `card:${k}`, rank: Number(k.slice(0, -1)), suit: k.slice(-1), temp: !!v.temp })),
    TABLES,
    /** Shared helpers between content files (the kit itself is frozen): put them here, e.g. TW.Art.lib.miniCard. */
    lib: {},
  };
})();
