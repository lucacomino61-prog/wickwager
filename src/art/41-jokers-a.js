/* Jokers, set a (joker artist a): 28 commons, drawn in the Ember Lit style of 40-jokers-lit.js.
 * Each A.joker() draws only the 31 x 31 figure; the core adds the rarity frame, gems, ground bands, glow pool,
 * specks, the figure's ink outline and the empty name plate. Helpers shared by this file live in TW.Art.lib.a.
 */
(() => {
  'use strict';
  const A = globalThis.TW.Art, kit = A.kit;
  const { Bmp, Mask, R, C, emboss, strokeQuad } = kit;
  const N = 31;

  // ------------------------------------------------------------ helpers (TW.Art.lib.a)
  const L = (A.lib.a = A.lib.a || {});
  const M = (fn) => Mask.fn(N, N, fn);
  const circ = (cx, cy, r) => M((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
  const oval = (cx, cy, rx, ry) => M((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
  const box = (x0, y0, x1, y1) => M((x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  /** A polygon mask; vertices are in pixel-edge coordinates (pixel x covers x..x+1). */
  const poly = (P) => M((x, y) => inPoly(x + 0.5, y + 0.5, P));
  const tube = (p0, p1, p2, w) => strokeQuad(N, N, p0, p1, p2, w);
  const U = (...ms) => { const k = new Mask(N, N); ms.forEach((m) => k.or(m)); return k; };
  const cut = (a, ...bs) => { const k = new Mask(N, N).or(a); bs.forEach((b) => k.sub(b)); return k; };
  const meet = (a, b) => M((x, y) => a.get(x, y) && b.get(x, y));
  /** Emboss a mask in a ramp and lay it on f. ink: the part gets its own ink ring, to separate it from what it covers. */
  const lay = (f, m, ramp, o = {}, ink = false) => { const b = emboss(m, ramp, o); if (ink) b.outline(C.edge); f.blit(b, 0, 0); return b; };
  const fill = (f, m, col) => { for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y)) f.set(x, y, col); return f; };
  const dots = (f, pts, col) => { pts.forEach(([x, y]) => f.set(Math.round(x), Math.round(y), col)); return f; };
  /** A rank glyph from the Ember S face (5 x 7), shaded top to bottom like a card index. */
  const glyph = (b, ch, x, y, ramp) => { kit.parseGlyph(kit.GLYPH_S[ch]).forEach((row, j) => row.forEach((on, i) => { if (on) b.set(x + i, y + j, j < 2 ? ramp[4] : j < 5 ? ramp[3] : ramp[2]); })); return b; };
  /** A small playing card w x h at (x, y): corners cut, lit top-left, shaded bottom-right (as Lit's Paperclip), inked.
      o.pip: suit letter (o.size 5 or 7, o.at [x, y] inside the card, default centred); o.rank: a glyph at o.rankAt;
      o.paint(c, ox, oy): draw on the card (card pixel (0, 0) is c's (ox, oy)); o.clip(x, y): keep only these pixels. */
  function card(f, x, y, w, h, o = {}) {
    const c = new Bmp(w + 2, h + 2);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;
      c.set(i + 1, j + 1, i === w - 1 || j === h - 1 ? C.cream3 : i === 0 || j === 0 ? C.white : C.cream);
    }
    if (o.pip) {
      const p = kit.pipBmp(o.pip, o.size || 7, o.flip);
      const [px, py] = o.at || [Math.floor((w - p.w) / 2), Math.floor((h - p.h) / 2)];
      c.blit(p, 1 + px, 1 + py);
    }
    if (o.rank) glyph(c, o.rank, 1 + o.rankAt[0], 1 + o.rankAt[1], kit.SUIT_RAMP[o.suit || 'S']);
    if (o.paint) o.paint(c, 1, 1);
    c.outline(C.edge);
    f.blit(c, x - 1, y - 1, o.clip ? { clip: o.clip } : undefined);
    return c;
  }
  /** A tilted playing card w x h centred on (cx, cy), turned deg clockwise; each edge lit or shaded by the side it
      faces, inked. o.pip (o.size, o.off [dx, dy]) sets an upright pip at its middle; o.keep(x, y) drops pixels. */
  function tcard(f, cx, cy, w, h, deg, o = {}) {
    const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const m = M((x, y) => {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      if (Math.abs(u) > w / 2 || Math.abs(v) > h / 2) return false;
      return !(Math.abs(u) > w / 2 - 1 && Math.abs(v) > h / 2 - 1);
    });
    const c = new Bmp(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!m.get(x, y)) continue;
      c.set(x, y, !m.get(x, y + 1) || !m.get(x + 1, y) ? C.cream3 : !m.get(x, y - 1) || !m.get(x - 1, y) ? C.white : C.cream);
    }
    if (o.pip) { const p = kit.pipBmp(o.pip, o.size || 7); const [ox, oy] = o.off || [0, 0]; c.blit(p, Math.round(cx - p.w / 2 + ox), Math.round(cy - p.h / 2 + oy)); }
    if (o.rank) glyph(c, o.rank, o.rankAt[0], o.rankAt[1], kit.SUIT_RAMP[o.suit || 'S']);
    if (o.keep) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (c.get(x, y) && !o.keep(x, y)) c.del(x, y);
    c.outline(C.edge);
    f.blit(c, 0, 0);
    return m;
  }
  /** A gold bell of radius r with its centre at (cx, cy): a slit below and a glint on the upper left. */
  function bell(f, cx, cy, r = 1.8, ramp = R.gold) {
    const d = kit.disc(r), s = d.w, b = emboss(d, ramp, { cap: 1.5, base: Math.min(4, ramp.length - 2), gain: 4.4 });
    const x0 = Math.round(cx - (s - 1) / 2), y0 = Math.round(cy - (s - 1) / 2);
    f.blit(b, x0, y0);
    if (s >= 5) { f.set(x0 + Math.floor(s / 2), y0 + s - 2, C.edge); f.set(x0 + 1, y0 + 1, C.white); } else f.set(x0, y0 + (s > 3 ? 1 : 0), ramp[ramp.length - 1]);
    return f;
  }
  /** A four-point sparkle: plus arms in col around a white heart (size 3 or 5). */
  const sparkle = (f, x, y, col, big) => (big ? f.draw(['..s..', '..s..', 'sswss', '..s..', '..s..'], x - 2, y - 2, { s: col, w: C.white }) : f.draw(['.s.', 'sws', '.s.'], x - 1, y - 1, { s: col, w: C.white }));
  // skin ramps, dark to light: the classic Jingle Jester's warm tone, a deep brown and a tan
  const SKIN = ['#6A2A1C', '#94442E', '#C06446', '#DE845C', '#F2A272', '#FCC090', '#FFDDB8'];
  const SKIN2 = ['#2E120C', '#4A2014', '#6A321E', '#8A4A2C', '#A8643C', '#C4824E', '#DCA266'];
  const SKIN3 = ['#4A2216', '#6E3620', '#94502E', '#B46C40', '#CC8A56', '#E2AA74', '#F2C898'];
  const BLUSH = '#FF8FB4';
  Object.assign(L, { M, circ, oval, box, poly, tube, U, cut, meet, lay, fill, dots, glyph, card, tcard, bell, sparkle, SKIN, SKIN2, SKIN3, BLUSH });

  /** Fill a mask so it glows from inside: dark at the edge, bright in the core, still lit a little from the upper left. */
  function glowFill(f, m, ramp, o = {}) {
    const d = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) d[i] = m.m[i] ? 1e6 : 0;
    const D = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : d[y * N + x]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (d[i]) d[i] = Math.min(d[i], D(x - 1, y) + 1, D(x, y - 1) + 1, D(x - 1, y - 1) + 1.4, D(x + 1, y - 1) + 1.4); }
    for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) { const i = y * N + x; if (d[i]) d[i] = Math.min(d[i], D(x + 1, y) + 1, D(x, y + 1) + 1, D(x + 1, y + 1) + 1.4, D(x - 1, y + 1) + 1.4); }
    const base = o.base ?? 2, step = o.step ?? 1.2;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!m.get(x, y)) continue;
      const lit = (!m.get(x - 1, y) || !m.get(x, y - 1) ? 1 : 0) - (!m.get(x + 1, y) || !m.get(x, y + 1) ? 1 : 0);
      f.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(base + (D(x, y) - 1) * step + lit)))]);
    }
    return f;
  }
  /** The mask without its small loose crumbs: 4-connected pieces under min pixels are dropped. */
  function keepBig(m, min = 6) {
    const out = new Mask(N, N), seen = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) {
      if (!m.m[i] || seen[i]) continue;
      const piece = [], stack = [i]; seen[i] = 1;
      while (stack.length) {
        const j = stack.pop(), x = j % N, y = (j - x) / N; piece.push(j);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy, k = ny * N + nx; if (nx >= 0 && ny >= 0 && nx < N && ny < N && m.m[k] && !seen[k]) { seen[k] = 1; stack.push(k); } });
      }
      if (piece.length >= min) piece.forEach((j) => { out.m[j] = 1; });
    }
    return out;
  }
  /** The window's own ground at (x, y) as the core paints it under a Joker (the four bands and the two-step pool of
      light, without specks), for a figure that tints it, such as a spotlight. */
  function groundAt(spec, x, y) {
    const [gx, gy, gr] = spec.glow || [15, 15, 12], d = Math.hypot(x - gx, (y - gy) * 1.1);
    if (d < gr * 0.62) return kit.shade(spec.ground[3], 1.34);
    if (d < gr) return kit.shade(spec.ground[3], 1.16);
    return spec.ground[3 - Math.min(3, Math.floor((y / 31) * 4))];
  }
  /** The core's 16 seeded specks for this Joker: fn(x, y, colour) for each, in the order the core lays them. */
  function specksAt(spec, seed, fn) {
    const rnd = kit.rng(seed), sp = spec.speck && spec.speck.length ? spec.speck : [C.white];
    for (let i = 0; i < 16; i++) { const x = Math.floor(rnd() * 31), y = Math.floor(rnd() * 31); fn(x, y, sp[i % sp.length]); }
  }
  Object.assign(L, { glowFill, keepBig, groundAt, specksAt });
  /** A playing card's corner index: a 3 x 5 rank in its suit's ink, as small as a card's own corner mark. */
  const MINI = {
    A: ['.x.', 'x.x', 'xxx', 'x.x', 'x.x'], K: ['x.x', 'xx.', 'x..', 'xx.', 'x.x'], 2: ['xx.', '..x', '.x.', 'x..', 'xxx'],
    3: ['xx.', '..x', '.x.', '..x', 'xx.'], 5: ['xxx', 'x..', 'xx.', '..x', 'xx.'], 7: ['xxx', '..x', '.x.', '.x.', '.x.'], 9: ['.x.', 'x.x', '.xx', '..x', '.x.'],
  };
  const mini = (f, rank, suit, x, y) => f.draw(MINI[rank], x, y, { x: kit.SUIT_RAMP[suit][3] });
  Object.assign(L, { MINI, mini });

  // every Joker in this set is a common; the core prefers the TW.Content row's rarity when there is one
  const joker = (id, spec) => A.joker(id, { rarity: 'common', ...spec });

  // ------------------------------------------------------------ 1. Pipsqueak: a tiny cream mouse in a pink jester
  // collar hugging two playing cards taller than itself, one ear folded over, on burnt orange
  joker('pipsqueak', {
    ground: ['#6E200C', '#842A10', '#983414', '#AC3E18'], glow: [15, 13, 13], speck: [R.ember[7], R.cream[6]],
    draw() {
      const f = new Bmp(N, N);
      const fur = R.cream.slice(0, 5);
      // two playing cards standing behind it, both far taller than the mouse: a spade behind, a heart in front
      card(f, 9, 2, 12, 20, { pip: 'S', size: 7, at: [2, 3] });
      card(f, 17, 5, 12, 20, { pip: 'H', size: 7, at: [3, 4] });
      // the tail, one pink line curling out over the ground
      const tail = new Bmp(N, N);
      tail.line(6, 28, 3, 29, R.pink[5]); tail.line(3, 29, 1, 27, R.pink[5]); tail.line(1, 27, 1, 25, R.pink[5]); tail.set(2, 24, R.pink[5]);
      tail.outline(C.edge); f.blit(tail, 0, 0);
      // the body, hugging the front card's lower corner, a pink paw on the card's face
      lay(f, oval(10, 25, 4.8, 4), fur, { cap: 3, base: 3, gain: 3.2 }, true);
      lay(f, tube([12.5, 23.5], [15.5, 24.5], [17.5, 22.5], 2.2), fur, { cap: 1, base: 3, gain: 2.4 }, true);
      f.rect(17, 21, 2, 2, R.pink[6]); f.set(17, 21, R.pink[7]);
      lay(f, U(oval(7.5, 29.4, 1.6, 1), oval(12.5, 29.4, 1.6, 1)), R.pink.slice(3), { cap: 1, base: 3, gain: 2 }, true);
      // big round ears lined pink: the far one whole, the near one with its top flopped forward over its own lining
      lay(f, circ(4.5, 13, 3.3), fur, { cap: 2, base: 3, gain: 3 }, true);
      fill(f, circ(4.5, 13, 1.8), R.pink[5]); f.set(4, 12, R.pink[6]);
      lay(f, cut(circ(11, 11.5, 3.8), box(0, 0, 30, 9)), fur, { cap: 2, base: 3, gain: 3 }, true);
      fill(f, circ(11, 13.2, 1.8), R.pink[5]); f.set(10, 12, R.pink[6]);
      lay(f, M((x, y) => y >= 10 && y <= 12 && (x - 11) ** 2 + (19 - y - 11.5) ** 2 <= 14.4), fur.slice(1, 4), { cap: 1, base: 2, gain: 2 }, true);
      // the head in three-quarter view, facing right: a pointed snout, a pink nose, two buck teeth, a bright eye
      lay(f, U(circ(8.5, 17.5, 3.6), tube([9.5, 17.5], [12.5, 18.5], [15, 19], (t) => 4 - t * 2.4)), fur, { cap: 2.5, base: 3, gain: 3.4 }, true);
      f.rect(15, 18, 2, 2, R.pink[5]); f.set(15, 18, R.pink[7]);
      dots(f, [[13, 20], [13, 21], [14, 20], [14, 21]], C.white);
      f.rect(10, 15, 2, 2, C.edge); f.set(10, 15, C.white);
      f.set(8, 19, BLUSH);
      // the pink jester collar: zigzag points and a gold bell
      lay(f, poly([[5, 20.5], [13, 20.5], [12.6, 22.8], [11.1, 21.8], [9, 23.8], [6.9, 21.8], [5.4, 22.8]]), R.pink, { cap: 1.2, base: 5, gain: 3 }, true);
      bell(f, 9, 24, 1.2);
      return f;
    },
  });

  // ------------------------------------------------------------ 2. Gingerbread Fool: a gingerbread jester cookie, piped
  // round its arms, legs and cap points with white icing, icing bells and three gumdrop buttons, a big scalloped bite out
  // of one hat point with two crumbs falling, on a strawberry bakery pink
  joker('gingerbreadfool', {
    ground: ['#4E0C2C', '#62123A', '#761848', '#8A1E56'], glow: [15, 15, 13], speck: [R.cream[7], R.pink[6]],
    draw() {
      const f = new Bmp(N, N);
      const hat = U(
        tube([12.5, 7], [7, 0.5], [3, 6], (t) => 5.4 - t * 2.4),
        tube([15.5, 6], [15.5, 3.5], [15.5, 1.8], (t) => 4.8 - t * 2),
        tube([18.5, 7], [24, 0.5], [28, 6], (t) => 5.4 - t * 2.4),
        box(10, 6, 21, 9),
      );
      const body = U(
        circ(15.5, 12, 5.2), hat,
        poly([[10.5, 16], [21.5, 16], [21, 25], [11, 25]]),
        tube([11.5, 18], [7, 19], [3.5, 21.5], 5), tube([19.5, 18], [24, 19], [27.5, 21.5], 5),
        tube([13.5, 23], [12.5, 26], [11, 28.5], 5), tube([17.5, 23], [18.5, 26], [20, 28.5], 5),
      );
      // the bite: a crescent out of the right hat point, its edge scalloped by three tooth marks
      const bite = U(circ(26.5, 2, 3.6), circ(22.8, 2.6, 1.3), circ(23.6, 5.4, 1.3), circ(26, 7.4, 1.3));
      const cookie = keepBig(cut(body, bite));
      const warm = R.wood.slice(2);
      lay(f, cookie, warm, { cap: 3, base: 2, gain: 3.4 });
      const edge = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !cookie.get(x + dx, y + dy));
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (cookie.get(x, y) && edge(x, y) && (!cookie.get(x, y - 1) || !cookie.get(x - 1, y)) && !bite.get(x + 1, y) && !bite.get(x, y - 1)) f.set(x, y, R.ember[6]);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (cookie.get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => bite.get(x + dx, y + dy))) f.set(x, y, R.cream[4]);
      // two crumbs falling from the bite
      [[27, 11], [25, 14]].forEach(([x, y]) => lay(f, box(x, y, x + 1, y + 1), warm, { cap: 1, base: 2, gain: 2 }, true));
      // icing piped just inside the edge of the arms, legs and cap points
      const ice = R.cream[7], ice2 = R.cream[5];
      const limb = (x, y) => x <= 9 || x >= 22 || y >= 26 || (y <= 5 && x !== 15 && x !== 16);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!cookie.get(x, y) || edge(x, y) || !limb(x, y)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => edge(x + dx, y + dy) && cookie.get(x + dx, y + dy) && !bite.get(x + dx * 2, y + dy * 2))) f.set(x, y, ice);
      }
      for (let x = 10; x <= 21; x++) f.set(x, x % 2 ? 9 : 10, x % 2 ? ice : ice2);
      [[3, 7], [15.5, 1.5]].forEach(([x, y]) => { const b = emboss(kit.disc(1.6), R.cream.slice(2), { cap: 1.2, base: 4, gain: 3 }); b.set(2, 3, C.edge); b.outline(C.edge); f.blit(b, Math.round(x) - 2, Math.round(y) - 2); });
      // face: icing eyes and a smile
      f.rect(12, 11, 2, 2, ice); f.rect(18, 11, 2, 2, ice); f.set(13, 12, C.edge); f.set(19, 12, C.edge);
      dots(f, [[12, 14], [13, 15], [14, 15], [15, 15], [16, 15], [17, 15], [18, 15], [19, 14]], ice);
      // three gumdrop buttons
      [[17, R.pink], [20, R.lime], [23, R.chips]].forEach(([y, ramp]) => f.draw(['.ab.', 'bccd', 'cddd'], 14, y - 1, { a: ramp[8], b: ramp[6], c: ramp[5], d: ramp[3] }));
      return f;
    },
  });

  // ------------------------------------------------------------ 3. Party Horn: a jester in profile, cheek ballooned,
  // lips pursed on a pink-and-cream striped blower that unrolls straight out and curls up at the end, a gold tassel
  // flicking off its tip, on plum
  joker('partyhorn', {
    ground: ['#2C1028', '#3A1634', '#481C40', '#56224C'], glow: [14, 15, 13], speck: [R.pink[6], R.money[6]],
    draw() {
      const f = new Bmp(N, N);
      const shade = { cap: 2, base: 5, gain: 4 };
      // the cap's prongs: a lime one flopping back, an ember one arching up and over, each to a bell
      lay(f, tube([4.5, 11.5], [0.5, 9.5], [1.5, 14.5], (t) => 4 - t * 2.2), R.lime, shade, true);
      lay(f, tube([8, 10], [9.5, 3.5], [4.5, 3.5], (t) => 4 - t * 2.2), R.ember, shade, true);
      bell(f, 1.8, 16, 1.6); bell(f, 3.5, 4.5, 1.6);
      // the ruff, cropped by the window's corner
      lay(f, M((x, y) => y >= 23 && [1.5, 6, 10.5].some((c) => (x - c) ** 2 + (y - 27) ** 2 <= 10)), R.cream, { cap: 2, base: 5, gain: 3.4 }, true);
      // the head in profile, facing right, the near cheek ballooned out with the effort of blowing
      lay(f, U(circ(8, 16, 5), circ(12, 18.5, 3.7), box(13, 14, 14, 15)), SKIN, { cap: 3.5, base: 4, gain: 4.2 }, true);
      // the cap's crown over the back of the head and its gold band
      lay(f, M((x, y) => y <= 13 && ((x - 7.5) / 5.8) ** 2 + ((y - 13.5) / 4.2) ** 2 <= 1), R.ember, shade, true);
      lay(f, box(3, 13, 12, 13), R.gold, { cap: 1, base: 4, gain: 2 }, true);
      // an eye squeezed shut, a furrowed brow, blush on the puffed cheek, lips pursed on the mouthpiece
      dots(f, [[9, 15], [10, 16], [11, 15]], C.edge); dots(f, [[9, 14], [10, 14]], SKIN[1]);
      f.rect(12, 20, 2, 1, BLUSH); f.set(12, 20, R.pink[7]);
      dots(f, [[15, 17], [15, 19]], R.pink[4]); f.set(16, 18, R.pink[5]);
      // the blower: four pixels thick, cream with diagonal pink stripes, straight out then curling up at its end
      const horn = U(tube([17, 18], [21, 18], [24.5, 18], 4), tube([24, 18.5], [28.5, 18.5], [27.5, 14], (t) => 4 - t * 1.6));
      const hb = emboss(horn, R.cream, { cap: 1.2, base: 5, gain: 2.6 });
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (horn.get(x, y) && Math.floor((x + y) / 2) % 2 === 0) hb.set(x, y, y >= 19 ? R.pink[4] : R.pink[5]);
      hb.outline(C.edge); f.blit(hb, 0, 0);
      // the rolled-up tip, a little coil
      lay(f, circ(27.5, 13, 1.8), R.pink.slice(2), { cap: 1, base: 4, gain: 2.4 }, true);
      f.set(27, 13, R.pink[1]);
      // the gold mouthpiece
      lay(f, box(16, 16, 17, 20), R.money.slice(2), { cap: 1, base: 4, gain: 2 }, true);
      // the tassel: a gold cord flicking up off the tip to a fringe
      lay(f, tube([28, 11], [29, 9], [28.5, 7.5], 2), R.gold, { cap: 1, base: 4, gain: 2 }, true);
      f.draw(['h.h', 'hgh', 'gGg', 'ggg'], 27, 3, { g: R.gold[5], G: R.gold[6], h: R.gold[3] });
      return f;
    },
  });

  // ------------------------------------------------------------ 4. Paper Crown: a cream paper crown, one band curving
  // round with three folded points rising from it (the outer two leaning out) marked J, Q and K, the K point patched
  // with a torn strip of gold tape, little suit pips printed round the band, on ember orange (its lightest band leans
  // red, and so does the glow pool's core)
  joker('papercrown', {
    ground: ['#A64A10', '#BC5C16', '#CE6E1E', '#DC7C34'], glow: [15, 13, 13], speck: [R.ember[8], R.cream[7]],
    draw() {
      const f = new Bmp(N, N);
      const top = (x) => 16 + 1.4 * (1 - ((x - 15) / 14) ** 2), back = (x) => 16 - 1.6 * (1 - ((x - 15) / 14) ** 2);
      // the inside of the band at the back, a darker sliver showing between the points
      lay(f, M((x, y) => x >= 1 && x <= 29 && y >= back(x) && y <= top(x) + 1), R.cream.slice(1, 5), { cap: 1, base: 2, gain: 1.6 }, true);
      // three folded points, no gaps between them: each lit left of its crease and shaded right of it
      const point = (x0, x1, ax, ay, ch, ramp, glyphAt) => {
        const m = poly([[x0, 17.5], [ax, ay], [x1 + 1, 17.5]]);
        const b = new Bmp(N, N);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          if (!m.get(x, y)) continue;
          const crease = ax + 0.5 + ((x0 + x1 + 1) / 2 - ax - 0.5) * ((y - ay) / (17.5 - ay));
          const left = x + 0.5 < crease, edge = !m.get(x - 1, y) || !m.get(x, y - 1);
          b.set(x, y, left ? (edge ? C.white : R.cream[6]) : Math.abs(x + 0.5 - crease) < 1 ? R.cream[3] : !m.get(x + 1, y) ? R.cream[3] : R.cream[5]);
        }
        b.outline(C.edge); f.blit(b, 0, 0);
        glyph(f, ch, glyphAt[0], glyphAt[1], ramp);
      };
      point(10, 21, 15, 0, 'Q', R.red, [13, 9]);
      point(1, 12, 4, 1, 'J', R.dark, [3, 9]);
      point(19, 29, 26, 1, 'K', R.dark, [22, 9]);
      // the Q's tail, two pixels long, so it reads at the phone scale
      dots(f, [[17, 15], [18, 16]], R.red[2]);
      // the gold tape across the K point, its right end torn
      lay(f, poly([[20.5, 8.6], [28.6, 5.2], [29.6, 5.6], [29, 6.4], [30, 7], [29.2, 7.6], [21.2, 10.8]]), R.gold, { cap: 1, base: 4, gain: 3 }, true);
      // the band round the front, with a row of small suit pips printed on it
      lay(f, M((x, y) => x >= 1 && x <= 29 && y >= top(x) && y <= top(x) + 6), R.cream.slice(2), { cap: 2, base: 4, gain: 2.4 }, true);
      const PIPS = { S: ['.x.', 'xxx', 'x.x'], H: ['x.x', 'xxx', '.x.'], C: ['.x.', 'xxx', '.x.'], D: ['.x.', 'xxx', '.x.'] };
      ['S', 'H', 'C', 'D'].forEach((s, i) => { const x = 5 + i * 6, y = Math.round(top(x + 1)) + 2; f.draw(PIPS[s], x, y, { x: kit.SUIT_RAMP[s][3] }); });
      return f;
    },
  });

  // ------------------------------------------------------------ 5. Empty Seats: three violet velvet theatre seats, every
  // seat folded up (nobody in them), gold armrests between them, a jester's cap left hanging over the middle back
  // under a wide spotlight, on maroon (lifted from near-black so the seats read)
  joker('emptyseats', {
    ground: ['#5A1228', '#6C1832', '#7E1E3C', '#902646'], glow: [15, 12, 13], speck: [R.money[6], R.pink[6]],
    draw() {
      const f = new Bmp(N, N);
      const X = [2, 12, 22];
      // the iron standards at both ends and between the seats, on little feet
      [0.5, 10, 20, 29.5].forEach((x) => lay(f, U(box(Math.round(x - 0.5), 16, Math.round(x + 0.5), 26), box(Math.round(x - 1.5), 26, Math.round(x + 1.5), 27)), R.plum.slice(2, 7), { cap: 1, base: 2, gain: 2 }, true));
      // three seat backs, 7 wide with a curved top and a tufted seam, ground showing between them
      X.forEach((x0) => {
        lay(f, kit.roundRect(N, N, x0, 9, x0 + 6, 21, 3), R.vio.slice(1, 8), { cap: 2.5, base: 4, gain: 3.2 }, true);
        for (let x = x0 + 1; x <= x0 + 5; x++) f.set(x, 14, R.vio[3]);
        f.set(x0 + 2, 13, R.vio[6]); f.set(x0 + 4, 13, R.vio[6]);
      });
      // every seat folded up: a slab in front of the back's foot, darker, its top edge catching the light
      X.forEach((x0) => {
        lay(f, box(x0, 19, x0 + 6, 22), R.vio.slice(0, 6), { cap: 1.5, base: 3, gain: 2.4 }, true);
        for (let x = x0; x <= x0 + 6; x++) f.set(x, 19, R.vio[6]);
      });
      // gold armrests, only between the seats
      [10, 20].forEach((x) => { lay(f, kit.roundRect(N, N, x - 2, 17, x + 2, 18, 1), R.gold, { cap: 1, base: 4, gain: 2 }, true); f.set(x - 1, 17, R.gold[6]); });
      // the jester's cap left hanging over the middle back: the crown on top, a point down each side to its bell
      lay(f, tube([13, 8], [11, 10], [12.8, 14.5], (t) => 2.8 - t * 1.2), R.lime, { cap: 1.2, base: 5, gain: 3 }, true);
      lay(f, tube([17, 8], [19, 10], [17.2, 14.5], (t) => 2.8 - t * 1.2), R.pink, { cap: 1.2, base: 5, gain: 3 }, true);
      lay(f, cut(oval(15, 9, 4.2, 3.6), box(0, 10, 30, 30)), R.lime, { cap: 1.5, base: 5, gain: 3.4 }, true);
      lay(f, box(11, 9, 19, 9), R.gold, { cap: 1, base: 4, gain: 2 }, true);
      bell(f, 13, 16, 1.5); bell(f, 17, 16, 1.5);
      return f;
    },
  });

  // ------------------------------------------------------------ 6. Pinwheel: a paper pinwheel, four cream blades painted
  // with a spade, heart, club and diamond, each curled edge pink or ember, on a red-and-cream stick, sparks off the tips,
  // on violet
  joker('pinwheel', {
    ground: ['#361672', '#421C86', '#4E229A', '#5A2AAC'], glow: [15, 12, 13], speck: [R.money[7], R.pink[7]],
    draw() {
      const f = new Bmp(N, N);
      const cx = 15.5, cy = 12.5;
      // the stick, candy-striped in Mult red and cream
      const stick = box(14, 13, 16, 30);
      const sb = new Bmp(N, N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (stick.get(x, y)) sb.set(x, y, Math.floor((y - x) / 2) % 2 === 0 ? (x === 14 ? C.white : x === 16 ? R.cream[4] : R.cream[6]) : (x === 14 ? R.mult[6] : x === 16 ? R.mult[3] : R.mult[5]));
      sb.outline(C.edge); f.blit(sb, 0, 0);
      // four paper blades: each the triangle centre - corner - next mid-side, turning clockwise. The face is cream
      // paper with a suit painted in its ink; the curled leading edge shows the coloured back (pink, ember, pink, ember).
      const s = 11.5;
      const corner = [[cx - s, cy - s], [cx + s, cy - s], [cx + s, cy + s], [cx - s, cy + s]];
      const mid = [[cx, cy - s], [cx + s, cy], [cx, cy + s], [cx - s, cy]];
      const blades = [[R.pink, 'S'], [R.ember, 'H'], [R.pink, 'C'], [R.ember, 'D']];
      blades.forEach(([back, suit], i) => {
        const m = poly([[cx, cy], corner[i], mid[i]]);
        const b = emboss(m, R.cream, { cap: 2.5, base: 5, gain: 3 });
        const [kx, ky] = [corner[i][0] + (mid[i][0] - corner[i][0]) * 0.42, corner[i][1] + (mid[i][1] - corner[i][1]) * 0.42];
        const curl = poly([[cx, cy], corner[i], [kx, ky]]);
        const bb = emboss(m, back, { cap: 2.5, base: 5, gain: 3 });
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m.get(x, y) && curl.get(x, y)) b.set(x, y, bb.get(x, y));
        b.outline(C.edge); f.blit(b, 0, 0);
        const gx = (cx + corner[i][0] + mid[i][0] * 1.3) / 3.3, gy = (cy + corner[i][1] + mid[i][1] * 1.3) / 3.3;
        const p = Mask.rows(kit.PIP5[suit]), ink = kit.SUIT_RAMP[suit];
        for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (p.get(x, y)) f.set(Math.round(gx - 2.5) + x, Math.round(gy - 2.5) + y, y < 2 ? ink[4] : ink[3]);
      });
      bell(f, 15.5, 12.5, 1.6);
      // sparks off the blade tips
      [[2, 1], [29, 1], [29, 24], [1, 24]].forEach(([x, y], i) => sparkle(f, x, y, i % 2 ? R.pink[6] : R.money[6]));
      return f;
    },
  });

  // ------------------------------------------------------------ 7. Sleight of Hand: a white-gloved magician's hand in
  // three-quarter view, reaching up from a plum sleeve, one card pinched between the first two fingers, a second fanned
  // behind the ring finger, a third vanishing in pink sparkles, a gold diamond cufflink, on ember orange
  joker('sleightofhand', {
    ground: ['#9E3018', '#B43C1C', '#C64822', '#D45428'], glow: [15, 14, 13], speck: [R.cream[7], R.pink[7]],
    draw() {
      const f = new Bmp(N, N);
      const glove = R.steel, fold = { cap: 1.5, base: 4, gain: 3 };
      const tilt = Math.atan(0.5) * (180 / Math.PI);
      // the vanishing card, top right: its upper corner already gone along a clean stair, sparkles on the cut
      card(f, 22, 2, 8, 11, { pip: 'D', size: 5, at: [1, 4], clip: (x, y) => x - y <= 22 });
      sparkle(f, 27, 3, R.pink[6], true); sparkle(f, 29, 7, R.pink[6]); sparkle(f, 24, 0, R.pink[7]);
      // the card fanned behind the ring finger
      tcard(f, 24, 18, 7, 10, tilt, { pip: 'S', size: 5, off: [0, -1] });
      // the middle finger, then the card pinched between it and the index finger, then the index finger
      lay(f, tube([16.5, 18], [18.5, 13], [20.5, 9.5], 2.8), glove, fold, true);
      tcard(f, 16.5, 7, 7, 10, -tilt, { pip: 'H', size: 5, off: [0, -1] });
      lay(f, tube([13.5, 17.5], [13.5, 12.5], [14, 9], 2.8), glove, fold, true);
      // the ring and little fingers curled toward the palm, the back of the hand, the thumb tucked under
      lay(f, U(tube([18.5, 19.5], [21, 17.5], [21.5, 15], 2.6), tube([19, 21.5], [21, 21], [21.5, 19.5], 2.4)), glove, fold, true);
      lay(f, poly([[9, 21], [12.5, 15.5], [19.5, 18], [16.5, 24.5], [12, 25]]), glove, { cap: 2.5, base: 4, gain: 3 }, true);
      [[13, 19], [15, 20], [17, 21]].forEach(([x, y]) => f.line(x, y, x - 1, y + 2, glove[2]));
      lay(f, tube([11, 23], [13.5, 24.5], [16, 23.5], 2.4), glove, fold, true);
      // the cuff, the cufflink (a gold diamond) and the plum sleeve running out of the corner
      lay(f, tube([2, 33], [4, 29], [7.5, 26], 8), R.plum.slice(1, 8), { cap: 2, base: 4, gain: 2.6 }, true);
      lay(f, tube([5, 22], [8, 25], [11, 28], 3), R.cream.slice(2), { cap: 1, base: 4, gain: 2 }, true);
      f.draw(['.g.', 'gGg', '.g.'], 7, 24, { g: R.gold[4], G: R.gold[6] });
      return f;
    },
  });

  // ------------------------------------------------------------ 8. Double Act: two jesters back to back, busts, each in
  // three-quarter profile looking out with a sly eye and a grin, motley split pink and cream, lime and cream; the points
  // of their caps arc up and meet over their heads in one shared gold bell, on plum
  joker('doubleact', {
    ground: ['#30102A', '#401636', '#501C42', '#60224E'], glow: [15, 14, 13], speck: [R.pink[7], R.lime[7]],
    draw() {
      const f = new Bmp(N, N);
      const shade = { cap: 1.5, base: 5, gain: 3.6 };
      const split = (m, a, b, at) => { const pa = emboss(m, a, shade), pb = emboss(m, b, shade); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m.get(x, y) && x >= at) pa.set(x, y, pb.get(x, y)); pa.outline(C.edge); f.blit(pa, 0, 0); };
      // side -1: the left jester, looking left; side 1 mirrors him about x 15 for the right one
      const one = (side, cap, outer, skin) => {
        const X = (x) => (side < 0 ? x : 30 - x), P = ([x, y]) => [X(x), y];
        const mx = (m) => M((x, y) => m.get(X(x), y));
        // the cap's point, from the back of the crown arcing up to the middle
        lay(f, mx(tube([11, 12], [12.5, 6], [14.5, 4.6], (t) => 3.4 - t * 1.6)), cap, shade, true);
        // shoulders, split down the middle: the outer half in his colour, the inner half cream
        const sh = mx(kit.roundRect(N, N, 1, 24, 15, 34, 5));
        if (side < 0) split(sh, outer, R.cream, 8); else split(sh, R.cream, outer, 23);
        lay(f, mx(M((x, y) => y >= 22 && y <= 24 && [5, 8, 11].some((c) => (x - c) ** 2 + (y - 23) ** 2 <= 2.4))), R.cream, { cap: 1.5, base: 5, gain: 3 }, true);
        // the head in three-quarter profile, looking out: an ear at the back, a pointed nose in front
        lay(f, mx(U(circ(8.5, 17.5, 4.4), box(3, 17, 3, 18), circ(12.6, 18, 1.4))), skin, { cap: 2.5, base: 5, gain: 3 }, true);
        // a sly eye (a heavy lid over a pupil turned outward), a cocked brow, a wide grin up toward the cheek, blush
        dots(f, [P([4, 15]), P([5, 15]), P([6, 14])], skin[0]);
        dots(f, [P([4, 16]), P([5, 16]), P([6, 16])], C.edge); f.set(...P([5, 17]), C.edge); f.set(...P([6, 17]), C.white);
        dots(f, [P([4, 20]), P([5, 20]), P([6, 20]), P([7, 20]), P([8, 19])], C.edge); dots(f, [P([5, 21]), P([6, 21])], R.mult[2]);
        f.set(...P([9, 19]), BLUSH);
        // the crown of the cap over his head, with a gold band
        lay(f, mx(M((x, y) => y <= 14 && ((x - 8.5) / 4.8) ** 2 + ((y - 14.5) / 3.4) ** 2 <= 1)), cap, shade, true);
        lay(f, mx(box(4, 14, 13, 14)), R.gold, { cap: 1, base: 4, gain: 2 }, true);
      };
      one(-1, R.pink, R.pink, SKIN);
      one(1, R.lime, R.lime, SKIN3);
      // the shared bell where the two points meet, and a pink sparkle on it
      bell(f, 15, 4, 2);
      sparkle(f, 19, 2, R.pink[6]);
      return f;
    },
  });

  // ------------------------------------------------------------ 9. Tally Owl: a round brown owl in a tiny jester
  // collar holding a quill over a slate of chalk tally marks, one eye winking, on warm plum (the brief's violet would
  // pair it with Early Bird, another round bird, in a rack)
  joker('tallyowl', {
    ground: ['#3A1430', '#4A1A3E', '#5A204C', '#6A285A'], glow: [15, 11, 13], speck: [R.cream[7], R.money[6]],
    draw() {
      const f = new Bmp(N, N);
      const brown = R.wood, disc = ['#6A331B', '#8E4826', '#B0623A', '#D08A52', '#ECB57E', '#F8D4A4', '#FFEACB'];
      // ear tufts, the round body, the pale belly
      lay(f, U(poly([[7.5, 5.5], [4, 1], [10.5, 4]]), poly([[23.5, 5.5], [27, 1], [20.5, 4]])), brown.slice(1), { cap: 1, base: 3, gain: 2.6 }, true);
      lay(f, oval(15.5, 11.5, 8.8, 8.6), brown, { cap: 3.5, base: 4, gain: 3.6 }, true);
      lay(f, oval(15.5, 16, 5.4, 4.2), disc.slice(2), { cap: 2, base: 3, gain: 2.6 });
      // the facial disc: one eye open (amber, dark pupil), one winking shut; a little beak
      lay(f, U(circ(12, 8.5, 3.8), circ(19, 8.5, 3.8)), disc, { cap: 2, base: 5, gain: 2.4 });
      fill(f, circ(12, 8.5, 2.3), R.money[5]); fill(f, M((x, y) => (x - 12) ** 2 + (y - 8.5) ** 2 <= 5.3 && y >= 9), R.money[4]);
      f.rect(12, 8, 2, 2, C.edge); f.set(12, 8, C.white);
      dots(f, [[17, 9], [18, 8], [19, 8], [20, 8], [21, 9]], C.edge);
      dots(f, [[17, 10], [21, 10]], disc[2]);
      f.draw(['ab', 'bc', '.c'], 15, 10, { a: R.ember[7], b: R.ember[5], c: R.ember[3] });
      // the tiny jester collar at the throat: pink and lime points, a bell in the middle
      const collar = poly([[9, 15], [22, 15], [21.4, 18], [19.6, 16.4], [17.6, 18.6], [15.5, 16.6], [13.4, 18.6], [11.4, 16.4], [9.6, 18]]);
      const cp = emboss(collar, R.pink, { cap: 1.2, base: 5, gain: 3 }), cl = emboss(collar, R.lime, { cap: 1.2, base: 5, gain: 3 });
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (collar.get(x, y)) cp.set(x, y, (x <= 11 || (x >= 15 && x <= 17) || x >= 21 ? cl : cp).get(x, y));
      cp.outline(C.edge); f.blit(cp, 0, 0);
      // the slate, chalked with one full tally and two more marks
      lay(f, kit.roundRect(N, N, 2, 19, 28, 29, 1), R.wood.slice(2), { cap: 1.5, base: 3, gain: 2.6 }, true);
      fill(f, box(4, 21, 26, 27), R.dark[2]); fill(f, box(4, 21, 26, 21), R.dark[1]); fill(f, box(4, 21, 4, 27), R.dark[1]);
      const chalk = R.cream[6];
      [6, 8, 10, 12].forEach((x) => f.rect(x, 22, 1, 5, chalk));
      f.line(5, 26, 13, 22, C.white);
      [16, 18].forEach((x) => f.rect(x, 22, 1, 5, chalk));
      // the wing holding a quill to the slate, and the feet gripping its frame
      lay(f, oval(22.5, 13, 3.2, 4.8), brown.slice(1), { cap: 2, base: 3, gain: 3 }, true);
      lay(f, tube([27, 3], [25.5, 10], [22, 19.5], (t) => 3.4 - t * 2.2), R.cream.slice(2), { cap: 1, base: 4, gain: 2.6 }, true);
      for (let y = 5; y <= 18; y++) f.set(Math.round(26.6 - (y - 4) * 0.3), y, R.cream[3]);
      dots(f, [[22, 20], [22, 21]], C.edge);
      lay(f, oval(23.5, 15, 1.8, 1.6), brown.slice(2), { cap: 1, base: 3, gain: 2 }, true);
      lay(f, U(box(11, 19, 13, 20), box(17, 19, 19, 20)), R.ember.slice(2), { cap: 1, base: 3, gain: 2 }, true);
      bell(f, 15.5, 18.6, 1.2);
      return f;
    },
  });

  // ------------------------------------------------------------ 10. Magpie: a black-and-white magpie in a jester ruff,
  // perched on a nest of discarded cards stuck in at all angles (one face down), a flat gold coin in its beak, on burnt
  // orange
  joker('magpie', {
    ground: ['#8A3410', '#A04016', '#B44C1A', '#C4581E'], glow: [15, 11, 12], speck: [R.cream[7], R.money[6]],
    draw() {
      const f = new Bmp(N, N);
      const black = R.dark.slice(0, 5), white = R.steel.slice(2);
      const tilt = Math.atan(0.5) * (180 / Math.PI);
      // the nest's far rim of twigs
      lay(f, oval(15, 25, 14, 4), R.wood.slice(0, 5), { cap: 1.5, base: 2, gain: 2 }, true);
      // the discarded cards, stuck in at steep angles, rank corners showing; one lies face down, its pink back up
      tcard(f, 6.5, 19, 7, 10, -tilt, { pip: 'H', size: 5, off: [1, 1] });
      mini(f, '2', 'H', 2, 15);
      card(f, 10, 13, 7, 10, { paint: (c, ox, oy) => { for (let j = 1; j < 9; j++) for (let i = 1; i < 6; i++) c.set(ox + i, oy + j, (i + j) % 2 ? R.pink[5] : R.pink[4]); c.set(ox + 3, oy + 4, R.cream[6]); } });
      card(f, 16, 14, 7, 10, { pip: 'C', size: 5, at: [1, 4] });
      mini(f, '5', 'C', 17, 15);
      tcard(f, 24.5, 19, 7, 10, tilt, { pip: 'D', size: 5, off: [0, 2] });
      mini(f, '9', 'D', 23, 14);
      // the nest's near rim, woven
      lay(f, M((x, y) => y >= 24 && ((x - 15) / 14.5) ** 2 + ((y - 25) / 5.5) ** 2 <= 1), R.wood, { cap: 2, base: 3, gain: 3 }, true);
      [[3, 26, 10, 29], [12, 30, 21, 26], [19, 29, 27, 26], [6, 30, 14, 27]].forEach(([a, b, c, d]) => f.line(a, b, c, d, R.wood[5]));
      [[8, 28, 13, 25], [17, 27, 23, 30]].forEach(([a, b, c, d]) => f.line(a, b, c, d, R.wood[2]));
      // the long tail angled down to the left, a chip-blue sheen along it
      lay(f, tube([10, 8.5], [5, 11], [1.5, 15.5], (t) => 3.6 - t * 1.4), black, { cap: 1.5, base: 3, gain: 3 }, true);
      for (let i = 0; i < 4; i++) { const x = Math.round(7 - i * 1.5); f.set(x, 10 + i, R.chips[4]); f.set(x + 1, 10 + i, R.chips[5]); }
      // legs down to the cards
      dots(f, [[13, 11], [13, 12], [16, 11], [16, 12]], black[4]);
      // the rounded body: black, a white belly and a white shoulder patch
      lay(f, oval(14, 7.5, 4.8, 3.4), black, { cap: 2.5, base: 3, gain: 3.4 }, true);
      lay(f, M((x, y) => ((x - 15) / 3.4) ** 2 + ((y - 9) / 2) ** 2 <= 1 && y >= 8), white, { cap: 1.5, base: 3, gain: 2.4 });
      lay(f, oval(12.5, 6.5, 2.2, 1.2), white, { cap: 1, base: 3, gain: 2 });
      // the head turned right, the jester ruff at its neck, the beak holding a flat gold coin
      lay(f, M((x, y) => y >= 7 && y <= 9 && [17.5, 20, 22.5].some((c) => (x - c) ** 2 + (y - 8.2) ** 2 <= 2.6)), R.cream, { cap: 1.5, base: 5, gain: 3 }, true);
      lay(f, circ(20.5, 4.5, 2.7), black, { cap: 2, base: 3, gain: 3.4 }, true);
      f.set(21, 4, C.white); f.set(22, 4, black[0]);
      lay(f, poly([[23, 3.6], [26.5, 4.6], [23, 5.8]]), black.slice(1), { cap: 1, base: 3, gain: 2 }, true);
      const coin = new Bmp(7, 7);
      coin.draw(['.rrr.', 'ryyyr', 'ryyyr', 'ryyyr', '.rrr.'], 1, 1, { r: R.money[3], y: R.money[5] }); coin.set(2, 2, C.white); coin.outline(C.edge);
      f.blit(coin, 24, 4);
      sparkle(f, 29, 2, C.white);
      return f;
    },
  });

  // ------------------------------------------------------------ 11. Tin Drum: a tin drum with a red-and-cream zigzag
  // band and two crossed drumsticks on top, a small dent in its rim, on maroon
  joker('tindrum', {
    ground: ['#300A14', '#400E1C', '#501424', '#601A2C'], glow: [15, 13, 13], speck: [R.cream[7], R.money[6]],
    draw() {
      const f = new Bmp(N, N);
      const cx = 15, rx = 11.5, ry = 3.6, top = 12, bot = 24;
      const front = (x) => ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
      // the shell: red triangles hanging from the top hoop, cream ones rising from the bottom hoop
      const shell = new Bmp(N, N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (Math.abs(x - cx) > rx || y < top || y > bot + front(x)) continue;
        const u = (x - cx) / rx, light = Math.round(-u * 1.6 + (Math.abs(u) > 0.86 ? -1 : 0));
        const yy = y - front(x), ph = ((x - 2) % 6 + 6) % 6, zig = 15 + (ph < 3 ? ph : 6 - ph) * 2.6;
        const ramp = yy < zig ? R.mult : R.cream;
        shell.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, 5 + light))]);
      }
      shell.outline(C.edge); f.blit(shell, 0, 0);
      // steel hoops top and bottom, following the front of the shell; the top one dented in at the front left
      const dent = (x) => (x === 8 || x === 10 ? 1 : x === 9 ? 2 : 0);
      for (let x = 4; x <= 26; x++) {
        const u = (x - cx) / rx, s = R.steel[Math.max(0, Math.min(5, 3 + Math.round(-u * 1.6)))], s2 = R.steel[Math.max(0, Math.min(5, 2 + Math.round(-u * 1.6)))];
        const yt = Math.round(top + front(x)) + dent(x), yb = Math.round(bot + front(x));
        f.set(x, yt, dent(x) ? R.steel[1] : s); f.set(x, yt + 1, dent(x) === 2 ? R.steel[5] : s2); f.set(x, yt + 2, C.edge);
        if (dent(x)) for (let y = yt - dent(x); y < yt; y++) f.set(x, y, R.steel[dent(x) === 2 && y === yt - 1 ? 0 : 2]);
        f.set(x, yb - 1, C.edge); f.set(x, yb, s); f.set(x, yb + 1, s2);
      }
      // the drum skin
      lay(f, oval(cx, top, rx - 0.5, ry), R.cream.slice(1), { cap: 3, base: 5, gain: 2 }, true);
      // two drumsticks crossed on top, cream knobs
      lay(f, tube([5.5, 3], [13, 7.5], [21, 12.5], 2.2), R.wood.slice(2), { cap: 1, base: 3, gain: 2.4 }, true);
      lay(f, tube([25.5, 3], [18, 7.5], [10, 12.5], 2.2), R.wood.slice(2), { cap: 1, base: 3, gain: 2.4 }, true);
      [[5, 3], [25.5, 3]].forEach(([x, y]) => { const b = kit.sphere(1.6, R.cream.slice(2)); const o = new Bmp(b.w + 2, b.h + 2); o.blit(b, 1, 1); o.outline(C.edge); f.blit(o, Math.round(x) - 2, y - 2); });
      return f;
    },
  });

  // ------------------------------------------------------------ 12. Ember Imp: a tiny imp of glowing embers in a two-point
  // jester cap, grinning, a trail of orange sparks from its curly tail, on plum
  joker('emberimp', {
    ground: ['#1E0C20', '#2A122C', '#361838', '#421E44'], glow: [15, 16, 13], speck: [R.ember[6], R.money[7]],
    draw() {
      const f = new Bmp(N, N);
      const fire = R.ember.slice(2);
      // the curly tail and its sparks
      lay(f, U(tube([19, 24], [27, 27], [26.5, 20], 2.2), poly([[25, 18], [28.8, 17.6], [27, 21]])), R.ember.slice(1), { cap: 1, base: 4, gain: 3 }, true);
      sparkle(f, 28, 14, R.ember[6], true); sparkle(f, 27, 9, R.money[7]);
      // stubby legs, the body, arms (one waving)
      lay(f, U(box(11, 24, 13, 28), box(17, 24, 19, 28)), R.ember.slice(1), { cap: 1, base: 3, gain: 2.4 }, true);
      glowFill(f, oval(15, 21, 5.6, 5), fire, { base: 1, step: 1.3 });
      lay(f, U(tube([10.5, 19], [6, 19], [5, 14.5], 2.4), tube([20, 20], [23, 21], [23.5, 23.5], 2.4)), R.ember.slice(1), { cap: 1, base: 4, gain: 2.6 }, true);
      // the head with pointed ears
      const head = U(circ(15, 11.5, 5.4), poly([[9.5, 9], [6, 8], [10, 12]]), poly([[20.5, 9], [24, 8], [20, 12]]));
      glowFill(f, head, fire, { base: 1, step: 1.1 });
      // a wide grin and slanted eyes
      fill(f, M((x, y) => y >= 13 && y <= 15 && ((x - 15) / 4.6) ** 2 + ((y - 12.6) / 2.6) ** 2 <= 1), C.edge);
      dots(f, [[12, 13], [14, 13], [16, 13], [18, 13]], R.cream[6]);
      dots(f, [[11, 10], [12, 10], [12, 11], [13, 11], [19, 10], [18, 10], [18, 11], [17, 11]], C.edge);
      dots(f, [[12, 11], [18, 11]], R.money[7]);
      // the two-point jester cap
      lay(f, tube([12, 7], [7, 1], [3.5, 4.5], (t) => 4.2 - t * 2.2), R.vio, { cap: 1.5, base: 5, gain: 3.6 }, true);
      lay(f, tube([18, 7], [23, 1], [26.5, 4.5], (t) => 4.2 - t * 2.2), R.chips, { cap: 1.5, base: 5, gain: 3.6 }, true);
      lay(f, cut(oval(15, 8, 5.6, 3.6), box(0, 9, 30, 30)), R.vio, { cap: 1.5, base: 5, gain: 3.4 }, true);
      bell(f, 3.5, 5.5, 1.6); bell(f, 26.5, 5.5, 1.6);
      return f;
    },
  });

  // ------------------------------------------------------------ 13. Solo Fiddler: a lanky jester in pink-and-cream
  // motley and a lime cap, eyes shut, a little violin tucked under his chin, the bow drawn across it, alone in a warm
  // spotlight on a violet stage; one ember note floats off the bow
  const fiddler = {
    ground: ['#2E1160', '#3E1880', '#4A1F94', '#5726A6'], glow: [14, 12, 11], speck: [R.cream[7], R.vio[7]],
    // the spotlight is tinted ground, so the core must not ink it: the figure is inked here instead
    outline: false,
    draw() {
      const f = new Bmp(N, N);
      // the spotlight: a cone from above and a pool on the floor, the window's own ground warmed toward cream
      const lit = (x, y) => Math.abs(x - 14.5) <= 3.2 + y * 0.27, pool = (x, y) => ((x - 14.5) / 9.5) ** 2 + ((y - 28.5) / 2.2) ** 2 <= 1;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (pool(x, y)) f.set(x, y, kit.blendHex(groundAt(fiddler, x, y), '#FFE2C266'));
        else if (lit(x, y)) f.set(x, y, kit.blendHex(groundAt(fiddler, x, y), '#FFE2C238'));
      }
      specksAt(fiddler, 'solofiddler', (x, y, c) => { if (pool(x, y) || lit(x, y)) f.set(x, y, kit.blendHex(c, '#FFE2C238')); });
      const g = new Bmp(N, N);
      const shade = { cap: 1.5, base: 5, gain: 3.4 };
      const split = (m, a, b, at) => { const pa = emboss(m, a, shade), pb = emboss(m, b, shade); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m.get(x, y) && x >= at) pa.set(x, y, pb.get(x, y)); pa.outline(C.edge); g.blit(pa, 0, 0); };
      // long legs in motley, pointed shoes curling out
      lay(g, U(tube([11.5, 28.5], [9, 29.5], [8, 27.5], 2.2), tube([15.5, 28.5], [18, 29.5], [19, 27.5], 2.2)), R.vio.slice(2), { cap: 1, base: 4, gain: 2.4 }, true);
      lay(g, box(11, 20, 12, 28), R.pink, shade, true);
      lay(g, box(15, 20, 16, 28), R.cream.slice(1), { cap: 1.5, base: 4, gain: 3 }, true);
      // the narrow tunic, split pink and cream, and a small ruff
      split(poly([[10, 13], [17, 13], [17.5, 21], [9.5, 21]]), R.pink, R.cream, 14);
      lay(g, M((x, y) => y >= 12 && y <= 14 && [10.5, 13.5, 16.5].some((c) => (x - c) ** 2 + (y - 13.2) ** 2 <= 2.4)), R.cream, { cap: 1.5, base: 5, gain: 3 }, true);
      // the neck arm (cream) out to the violin's neck; the violin under his chin: a figure-8 body, a light top plate,
      // a string line down its middle, a neck and scroll
      lay(g, tube([17, 15], [22, 16], [25.5, 12.5], 2.4), R.cream.slice(1), { cap: 1, base: 4, gain: 2.4 }, true);
      const body = M((x, y) => { const u = x - 18.5, v = y - 12.5, half = Math.abs(u) < 1.2 ? 2 : 3; return (u / 4.6) ** 2 + (v / half) ** 2 <= 1; });
      lay(g, U(body, tube([22, 12], [25, 10.5], [27.5, 9.5], 1.8), circ(28, 9, 1.2)), R.ember.slice(1, 7), { cap: 2, base: 3, gain: 3 }, true);
      g.line(14, 12, 27, 10, R.ember[0]); g.line(15, 12, 22, 12, R.cream[5]);
      dots(g, [[26, 11], [27, 11], [26, 12]], SKIN[5]);
      // the bow arm (pink) down to the right hand, the bow drawn up across the strings at 45 degrees
      lay(g, tube([10, 15], [7.5, 17], [8, 19.5], 2.4), R.pink.slice(1), { cap: 1, base: 4, gain: 2.4 }, true);
      g.line(6, 22, 17, 11, C.edge); g.line(7, 22, 18, 11, R.cream[6]);
      dots(g, [[7, 19], [8, 19], [7, 20], [8, 20]], SKIN[5]);
      // the head tipped onto the violin, eyes shut, a small smile; the lime cap and its two belled points
      lay(g, circ(13, 9, 3.3), SKIN, { cap: 2.5, base: 4, gain: 3.6 }, true);
      dots(g, [[11, 9], [12, 9], [14, 10], [15, 10]], C.edge);
      dots(g, [[12, 11], [13, 12], [14, 12]], R.mult[2]); g.set(15, 11, BLUSH);
      lay(g, tube([10.5, 6.5], [6, 3], [4, 7], (t) => 3.2 - t * 1.4), R.lime, shade, true);
      lay(g, tube([13, 5.5], [12, 1], [8.5, 1.5], (t) => 3.2 - t * 1.4), R.lime.slice(1), shade, true);
      lay(g, M((x, y) => y <= 7 && ((x - 13) / 4) ** 2 + ((y - 7.4) / 2.8) ** 2 <= 1), R.lime, shade, true);
      bell(g, 4, 8, 1.4); bell(g, 8, 2, 1.4);
      // the single ember note floating off the bow's tip
      lay(g, U(oval(20, 7, 1.6, 1.2), box(21, 2, 21, 6), box(22, 3, 23, 3)), R.ember.slice(3), { cap: 1, base: 3, gain: 2.6 }, true);
      g.outline(C.edge);
      f.blit(g, 0, 0);
      return f;
    },
  };
  joker('solofiddler', fiddler);

  // ------------------------------------------------------------ 14. Matching Socks: a pair of pink-and-cream striped
  // jester socks with bells on the toes, pegged to a line, one with a heart-shaped darn, on plum
  joker('matchingsocks', {
    ground: ['#2A1030', '#36163E', '#421C4C', '#4E2258'], glow: [15, 14, 13], speck: [R.pink[7], R.cream[7]],
    draw() {
      const f = new Bmp(N, N);
      // the line, sagging a little
      lay(f, M((x, y) => y === Math.round(3 + Math.sin((x / 30) * Math.PI) * 1.4)), R.cream.slice(2), { cap: 1, base: 4, gain: 1 }, true);
      const sock = (x0, darn) => {
        const leg = box(x0, 5, x0 + 5, 18);
        const foot = U(oval(x0 + 4.5, 19.5, 4.6, 2.9), tube([x0 + 6, 21], [x0 + 12, 22.5], [x0 + 12, 15.5], (t) => 4.4 - t * 3));
        const m = U(leg, foot);
        const b = emboss(m, R.cream, { cap: 2.5, base: 5, gain: 3 }), bp = emboss(m, R.pink, { cap: 2.5, base: 5, gain: 3 });
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          if (!m.get(x, y)) continue;
          const stripe = y >= 8 && y <= 17 && Math.floor((y - 8) / 2) % 2 === 0, toe = x >= x0 + 8, heel = y > 17 && x >= x0 + 3 && x <= x0 + 4;
          if (stripe || toe || heel) b.set(x, y, bp.get(x, y));
        }
        for (let x = x0; x <= x0 + 5; x++) { b.set(x, 5, R.cream[7]); b.set(x, 6, x % 2 ? R.cream[5] : R.cream[6]); b.set(x, 7, R.cream[4]); }
        if (darn) {
          // a heart-shaped darn: a red patch woven over the stripes, cream stitches across it
          const h = Mask.rows(kit.PIP5.H);
          for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (h.get(x, y)) b.set(x0 + 1 + x, 11 + y, (x + y) % 2 ? R.mult[5] : R.mult[4]);
          dots(b, [[x0 + 2, 12], [x0 + 4, 12], [x0 + 3, 14]], R.cream[7]);
        }
        b.outline(C.edge); f.blit(b, 0, 0);
        bell(f, x0 + 12, 14, 1.8);
        // a wooden peg on the line
        lay(f, box(x0 + 2, 1, x0 + 3, 7), R.wood.slice(1), { cap: 1, base: 4, gain: 2 }, true);
      };
      sock(15, false);
      sock(1, true);
      return f;
    },
  });

  // ------------------------------------------------------------ 15. Square Dance: two couples of jesters dancing side by
  // side, partners' arms hooked at the elbow, outer legs kicking up dust, all four caps swinging the same way; pink and
  // cream, lime and chip blue; on burnt orange, chip-blue motley (a Chips Joker). On chip blue it twinned Quartet.
  joker('squaredance', {
    ground: ['#7A2A10', '#94360F', '#AC4414', '#C2521A'], glow: [15, 16, 14], speck: [R.cream[7], R.money[7]],
    draw() {
      const f = new Bmp(N, N);
      const shade = { cap: 1.2, base: 5, gain: 3 };
      const split = (m, a, b, at) => { const pa = emboss(m, a, shade), pb = emboss(m, b, shade); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m.get(x, y) && x >= at) pa.set(x, y, pb.get(x, y)); f.blit(pa, 0, 0); };
      // [centre x, facing (1 right, -1 left), left motley, right motley, skin]
      const D = [[4, 1, R.pink, R.cream, SKIN], [11, -1, R.cream, R.pink, SKIN3], [20, 1, R.lime, R.chips, SKIN2], [27, -1, R.chips, R.lime, SKIN]];
      // dust kicked up by the outer feet
      [[0.5, 27.5], [14.5, 27.5], [16.5, 27.5], [30, 27.5]].forEach(([x, y]) => lay(f, U(circ(x, y, 1.2), circ(x + (x < 15 ? 1 : -1) * 0.8, y - 1, 0.9)), R.cream.slice(3), { cap: 1, base: 3, gain: 2 }, true));
      D.forEach(([cx, d, a, b, skin]) => {
        const o = -d;
        // legs (one planted, the outer one kicked out) and the tunic, one garment: only the figure's edge is inked
        lay(f, U(box(cx + d, 24, cx + d + 1, 28), tube([cx + o * 0.5, 24], [cx + o * 2, 26], [cx + o * 3.5, 26.5], 2)), d > 0 ? b : a, { cap: 1, base: 4, gain: 2.4 });
        split(kit.roundRect(N, N, cx - 2, 18, cx + 2, 24, 1), a, b, cx + (d > 0 ? 0 : 1));
      });
      // arms hooked at the elbow between partners
      [[6, 9], [22, 25]].forEach(([x0, x1]) => lay(f, tube([x0, 20], [(x0 + x1) / 2, 18.5], [x1, 20], 2), R.cream.slice(1), { cap: 1, base: 4, gain: 2 }, true));
      D.forEach(([cx, d, a, b, skin]) => {
        // the head: eyes on the partner, an open smile
        lay(f, circ(cx, 14.5, 2.8), skin, { cap: 2, base: 4, gain: 3.4 }, true);
        dots(f, [[cx - 1 + d, 13], [cx - 1 + d, 14], [cx + 1 + d, 13], [cx + 1 + d, 14]], C.edge);
        dots(f, [[cx - 1 + d, 16], [cx + d, 16], [cx + 1 + d, 16]], R.mult[1]); f.set(cx + d, 17, R.pink[5]);
        // the cap: one point swinging up and right to its bell, the same way on all four
        const main = d > 0 ? a : b;
        lay(f, tube([cx + 0.5, 11], [cx + 1.8, 6.8], [cx + 3.2, 8.2], (t) => 2.6 - t * 1.1), main, shade, true);
        lay(f, M((x, y) => y <= 12 && ((x - cx) / 3.2) ** 2 + ((y - 12.4) / 2.6) ** 2 <= 1), main, shade, true);
        bell(f, cx + 3.3, 9.5, 1.3);
      });
      return f;
    },
  });

  // ------------------------------------------------------------ 16. Hat Trick: three bell caps stacked on a jester's
  // head, pink, lime and gold, each smaller and further right, the gold one sliding off; the jester below, in three-
  // quarter view, eyes crossed up at the tower, tongue out, one hand flung out in a ta-da; on red-violet
  joker('hattrick', {
    ground: ['#3A1048', '#4A1658', '#5A1C68', '#6A2278'], glow: [14, 13, 13], speck: [R.cream[7], R.money[7]],
    draw() {
      const f = new Bmp(N, N);
      const shade = { cap: 1.5, base: 5, gain: 3.6 };
      // the ta-da arm, flung out to the right, an open hand at its end
      lay(f, tube([16, 29], [22, 28], [24.5, 24.5], 3), R.pink, { cap: 1, base: 5, gain: 2.6 }, true);
      lay(f, U(circ(25.5, 23, 2), tube([26, 22], [27.5, 20.5], [28, 19.5], 1.4), tube([26.5, 23], [28.5, 22.5], [29.5, 22], 1.4), tube([25, 21.5], [25.2, 20], [25.6, 19], 1.4)), SKIN3, { cap: 1, base: 4, gain: 2.6 }, true);
      // shoulders in motley, pink and cream split down the middle
      const tunic = oval(10.5, 32, 10, 4.6);
      const tb = emboss(tunic, R.pink, shade), tc = emboss(tunic, R.cream, shade);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (tunic.get(x, y) && x >= 11) tb.set(x, y, tc.get(x, y));
      tb.outline(C.edge); f.blit(tb, 0, 0);
      // the head in three-quarter view, facing right and up: an ear behind, a nose in front
      lay(f, U(circ(10, 24, 4.6), circ(5.6, 24.5, 1.5), box(15, 23, 15, 24)), SKIN3, { cap: 3, base: 4, gain: 4 }, true);
      // eyes crossed, looking up at the stack: white eyes with the pupils turned in and up; brows raised
      f.rect(9, 22, 2, 2, C.white); f.rect(12, 22, 2, 2, C.white);
      f.set(10, 22, C.edge); f.set(12, 22, C.edge);
      dots(f, [[9, 21], [10, 21], [12, 21], [13, 21]], SKIN3[1]);
      // an open grin with the tongue tip out, blush on the cheek
      f.rect(10, 26, 4, 1, C.edge); f.set(11, 27, C.edge); f.set(12, 27, R.pink[6]); f.set(13, 27, R.pink[5]); f.set(12, 28, R.pink[4]);
      f.set(14, 25, BLUSH); f.set(7, 25, BLUSH);
      // a cap: a dome and its one floppy point (from the shoulder, tapering to a bell), shaded as one piece; each cap
      // smaller than the one under it and further right; the top one tilts as it slides off
      const cap = (cx, yb, rx, ry, ramp, pt, w0, bl, tilt = 0) => {
        const dome = M((x, y) => { const u = x - (yb - y) * tilt; return y <= yb && ((u - cx) / rx) ** 2 + ((y - yb - 0.5) / ry) ** 2 <= 1; });
        const b = emboss(U(dome, tube(...pt, (t) => w0 - t * (w0 - 1.5))), ramp, shade);
        for (let x = 0; x < N; x++) if (dome.get(x, yb)) b.set(x, yb, ramp[3]);
        b.outline(C.edge); f.blit(b, 0, 0);
        bell(f, bl[0], bl[1], 1.6);
      };
      cap(10.5, 19, 6.2, 6.4, R.pink, [[15, 15], [20.5, 13], [22, 18]], 3, [22.5, 19.5]);
      lay(f, box(4, 19, 16, 20), R.gold, { cap: 1, base: 4, gain: 2 }, true);
      cap(12.5, 12, 4.6, 5.4, R.lime, [[9.5, 9], [5, 7.5], [4, 12]], 2.8, [4, 13.5]);
      cap(14.5, 6, 3.2, 4.8, R.gold, [[16.5, 3], [20, 1.5], [22.5, 4.5]], 2.4, [23, 6], 0.45);
      // the gold cap sliding off to the right: two motion ticks at its left
      dots(f, [[9, 2], [10, 1], [9, 5], [10, 4]], R.cream[6]);
      return f;
    },
  });

  // ------------------------------------------------------------ 17. Tightrope: a jester walking a taut rope under a
  // pink parasol, one foot on the rope and the other leg out behind; four cream cards pegged along the rope, each two
  // pixels higher than the last and each with one more pip (a Straight climbs), on maroon
  joker('tightrope', {
    ground: ['#3A1014', '#4C161A', '#5E1C20', '#702226'], glow: [13, 12, 13], speck: [R.cream[7], R.pink[7]],
    draw() {
      const f = new Bmp(N, N);
      const ry = (x) => 21 - (x * 2) / 7, shade = { cap: 1.5, base: 5, gain: 3.4 };
      // four cards, each clipped under the rope by a peg, each 2 px higher than the last and with one more pip
      const DOTS = [[[2, 3]], [[2, 1], [2, 5]], [[1, 1], [2, 3], [3, 5]], [[1, 1], [3, 1], [1, 5], [3, 5]]];
      const X0 = [3, 10, 17, 24];
      ['H', 'S', 'D', 'C'].forEach((s, i) => {
        const x0 = X0[i], r = Math.round(ry(x0 + 2.5)), ink = kit.SUIT_RAMP[s];
        card(f, x0, r + 3, 6, 8, { paint: (c, ox, oy) => DOTS[i].forEach(([dx, dy]) => { c.rect(ox + dx, oy + dy, 2, 2, ink[3]); c.set(ox + dx, oy + dy, ink[4]); }) });
      });
      // the taut rope: two pixels thick, lit on top
      const rb = new Bmp(N, N);
      for (let x = 0; x < N; x++) { const y = Math.round(ry(x)); rb.set(x, y, x % 4 === 0 ? R.cream[5] : R.cream[6]); rb.set(x, y + 1, R.cream[3]); }
      rb.outline(C.edge); f.blit(rb, 0, 0);
      X0.forEach((x0) => { const xc = x0 + 2, r = Math.round(ry(xc + 0.5)); lay(f, box(xc, r + 1, xc + 1, r + 3), R.wood.slice(3), { cap: 1, base: 2, gain: 1.6 }, true); });
      // the jester: the standing foot on the rope, the other leg out behind, a split lime-and-cream tunic, a small ruff
      lay(f, U(box(8, 15, 9, 18), box(7, 18, 10, 18)), R.lime.slice(1), { cap: 1, base: 4, gain: 2.4 }, true);
      lay(f, tube([7, 15], [5, 16.5], [3.5, 15.5], 2), R.cream.slice(1), { cap: 1, base: 4, gain: 2.4 }, true);
      const tunic = kit.roundRect(N, N, 6, 10, 11, 15, 1);
      const tl = emboss(tunic, R.lime, shade), tc = emboss(tunic, R.cream, shade);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (tunic.get(x, y) && x >= 9) tl.set(x, y, tc.get(x, y));
      tl.outline(C.edge); f.blit(tl, 0, 0);
      // arms out for balance: the left one wide, the right one up to the parasol's handle
      lay(f, tube([6.5, 11], [4, 10.5], [2.5, 8.5], 1.8), R.lime.slice(1), { cap: 1, base: 4, gain: 2 }, true);
      lay(f, tube([11, 11], [13, 10], [13.5, 7.5], 1.8), R.cream.slice(1), { cap: 1, base: 4, gain: 2 }, true);
      dots(f, [[2, 7], [2, 8], [13, 6], [14, 6]], SKIN[5]);
      lay(f, M((x, y) => y >= 9 && y <= 11 && [6.5, 8.5, 10.5].some((c) => (x - c) ** 2 + (y - 10) ** 2 <= 1.6)), R.cream, { cap: 1, base: 5, gain: 2 }, true);
      // the head: eyes on the rope ahead, a nervous little smile; the cap's point flopping back to a bell
      lay(f, circ(8.5, 6.5, 3.2), SKIN, { cap: 2.5, base: 4, gain: 3.6 }, true);
      dots(f, [[9, 6], [9, 7], [11, 6], [11, 7]], C.edge);
      dots(f, [[8, 9], [9, 9], [10, 8]], R.mult[2]);
      lay(f, tube([7, 3.5], [4, 1.5], [3, 4.5], (t) => 2.6 - t * 1.1), R.lime, shade, true);
      lay(f, M((x, y) => y <= 4 && ((x - 8.5) / 3.6) ** 2 + ((y - 4.4) / 2.4) ** 2 <= 1), R.lime, shade, true);
      bell(f, 3, 5.6, 1.2);
      // the pink parasol held up in the right hand: a scalloped dome, its ribs, on a thin handle
      const ph = new Bmp(N, N); ph.line(14, 6, 18, 3, R.wood[4]); ph.outline(C.edge); f.blit(ph, 0, 0);
      const dome = M((x, y) => { const u = (x - 19.5) / 5.6, v = (4.5 - y) / 3.6; if (y === 5) return Math.abs(x - 19.5) <= 5 && ((x + 0) % 3) !== 0; return y <= 4 && u * u + v * v <= 1; });
      const db = emboss(dome, R.pink, { cap: 2.5, base: 5, gain: 3.4 });
      [[17, 2], [16, 3], [15, 4], [22, 2], [23, 3], [24, 4]].forEach(([x, y]) => { if (dome.get(x, y)) db.set(x, y, R.pink[4]); });
      db.outline(C.edge); f.blit(db, 0, 0);
      return f;
    },
  });

  // ------------------------------------------------------------ 18. Peacock: a blue peacock in profile in a jester collar,
  // its lime fan spread behind it like a wheel, five matching hearts for the eyespots (a dark eye and a gold glint in
  // each), on plum
  joker('peacock', {
    ground: ['#2C0E2C', '#3A1438', '#481A44', '#562050'], glow: [17, 17, 14], speck: [R.money[7], R.lime[7]],
    draw() {
      const f = new Bmp(N, N);
      const cx = 17.5, cy = 18.5, rr = 11.4;
      const at = (d, r) => [cx + r * Math.sin((d * Math.PI) / 180), cy - r * Math.cos((d * Math.PI) / 180)];
      // the fan: a lime wheel of feathers spread behind the bird, scalloped at the rim, each feather a darker quill
      const quills = [-90, -67.5, -45, -22.5, 0, 22.5, 45, 67.5, 90, 112.5, 135];
      const fan = U(M((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr && y <= 27), ...quills.map((d) => circ(...at(d, rr), 2.1)));
      const fb = emboss(fan, R.lime.slice(1, 8), { cap: 3, base: 3, gain: 2.4 });
      quills.forEach((d) => { const [tx, ty] = at(d, rr); const q = new Bmp(N, N); q.line(cx, cy, tx, ty, R.lime[2]); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (q.get(x, y) && fan.get(x, y) && (x - cx) ** 2 + (y - cy) ** 2 > 12) fb.set(x, y, R.lime[2]); });
      fb.outline(C.edge); f.blit(fb, 0, 0);
      // five matching hearts round the rim, the eyespots of the fan, each with a dark blue eye and a gold glint
      const heart = Mask.rows(kit.PIP5.H);
      [-40, 0, 40, 80, 120].forEach((d) => {
        const [x, y] = at(d, 9.6);
        const hb = emboss(heart, R.mult, { cap: 1.6, base: 5, gain: 3.4 });
        const o = new Bmp(9, 9); o.blit(hb, 2, 2);
        o.draw(['g', 'c'], 4, 3, { g: R.gold[6], c: R.chips[2] });
        o.outline(C.edge);
        f.blit(o, Math.round(x - 4.5), Math.round(y - 4.5));
      });
      // the bird in profile, facing left: a round blue body, a slender neck curving up to a small head with a white
      // eye stripe and a gold beak, a crest of three blue dots on stalks; the pink and lime jester collar at the neck
      lay(f, oval(10.5, 24.5, 4.6, 4), R.chips, { cap: 3, base: 4, gain: 3.4 }, true);
      lay(f, tube([10, 22], [6.5, 19], [6, 14.5], 2.4), R.chips, { cap: 1.2, base: 5, gain: 3 }, true);
      lay(f, U(circ(5.5, 12.5, 2.4), box(3, 12, 3, 13)), R.chips, { cap: 1.5, base: 5, gain: 3.4 }, true);
      lay(f, box(1, 12, 2, 13), R.money.slice(2, 8), { cap: 1, base: 4, gain: 2 }, true);
      dots(f, [[5, 12], [6, 12], [7, 12]], C.white); f.set(4, 12, C.edge);
      [[3.5, 7.5], [5.5, 7], [7.5, 8]].forEach(([x, y]) => { f.line(5.5, 10, x, y + 1, R.chips[3]); f.rect(Math.round(x) - 1, Math.round(y) - 1, 2, 2, R.chips[6]); f.set(Math.round(x) - 1, Math.round(y) - 1, R.chips[7]); });
      const collar = poly([[5.5, 19], [11, 19], [10.6, 21.4], [9.5, 20.2], [8.2, 22], [7, 20.2], [5.9, 21.4]]);
      const cp = emboss(collar, R.pink, { cap: 1.2, base: 5, gain: 3 }), cl = emboss(collar, R.lime.slice(2), { cap: 1.2, base: 5, gain: 3 });
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (collar.get(x, y) && (x === 8 || x === 9)) cp.set(x, y, cl.get(x, y));
      cp.outline(C.edge); f.blit(cp, 0, 0);
      // two gold feet
      dots(f, [[9, 29], [12, 29]], R.gold[4]);
      return f;
    },
  });

  // ------------------------------------------------------------ 19. Clown Car: a tiny red clown car crammed with five
  // jesters, caps poking out of every window, two grinning faces at the glass, the front wheel wonky, on ember orange
  // (its lightest band leans red, and so does the glow pool's ring)
  joker('clowncar', {
    ground: ['#B85C14', '#CC6E1A', '#DC8022', '#E6863A'], glow: [15, 14, 13], speck: [R.cream[7], R.money[7]],
    draw() {
      const f = new Bmp(N, N);
      const shade = { cap: 1.2, base: 5, gain: 3.2 };
      // caps poking out above the roof and out of the windows, each to a bell
      const capTip = (p0, p1, p2, ramp, bx, by) => { lay(f, tube(p0, p1, p2, (t) => 3 - t * 1.4), ramp, shade, true); bell(f, bx, by, 1.3); };
      capTip([9, 9], [5, 5], [3, 8], R.lime, 3, 9);
      capTip([12, 7], [11, 1], [7, 2], R.pink, 6.5, 2.5);
      capTip([16, 6], [17, 0.5], [21, 2], R.chips, 21.5, 2.5);
      capTip([19, 8], [24, 4], [26.5, 7], R.vio, 27, 8);
      capTip([14, 7], [14.5, 2], [15, 0.5], R.money, 15, 1);
      // the car body, the bubble cab and the hood
      const body = U(kit.roundRect(N, N, 2, 15, 28, 24, 3), poly([[21, 15], [27, 16], [28, 20], [21, 20]]));
      lay(f, body, R.mult, { cap: 2.5, base: 5, gain: 3.4 }, true);
      lay(f, kit.roundRect(N, N, 6, 7, 22, 17, 4), R.mult, { cap: 2.5, base: 5, gain: 3.4 }, true);
      // windows, each with a face in it
      [[8, 9, 12, 15, SKIN], [15, 9, 20, 15, SKIN3]].forEach(([x0, y0, x1, y1, skin]) => {
        fill(f, box(x0, y0, x1, y1), R.ghost[5]); fill(f, box(x0, y0, x1, y0), R.ghost[6]); f.rect(x0, y1, x1 - x0 + 1, 1, R.ghost[4]);
        lay(f, circ((x0 + x1) / 2, y1 - 1.5, 2.6), skin, { cap: 2, base: 4, gain: 3 }, false);
        const cx = Math.round((x0 + x1) / 2);
        dots(f, [[cx - 1, y1 - 2], [cx + 1, y1 - 2]], C.edge);
        f.rect(cx - 1, y1, 3, 1, R.mult[1]); f.set(cx, y1, R.pink[5]);
      });
      for (let y = 8; y <= 16; y++) f.set(14, y, C.edge);
      // trim stripe, bumpers, a headlight
      for (let x = 3; x <= 27; x++) f.set(x, 18, x % 2 ? R.cream[6] : R.cream[5]);
      lay(f, U(box(27, 20, 29, 22), box(1, 20, 2, 22)), R.steel, { cap: 1, base: 3, gain: 2 }, true);
      lay(f, box(26, 16, 27, 17), R.money.slice(4), { cap: 1, base: 2, gain: 1 }, true);
      // wheels: the back one round; the front one wonky, wider at the top than at the foot and leaning out, wobbling
      const wheel = (m, cx, cy) => { lay(f, m, R.plum.slice(1), { cap: 1.5, base: 3, gain: 2.4 }, true); lay(f, circ(cx, cy, 1.2), R.steel, { cap: 1, base: 3, gain: 2 }, false); };
      wheel(circ(8, 25, 3.6), 8, 25);
      wheel(M((x, y) => { const t = (y - 21) / 8, rx = 3.4 - t * 1.2, cx = 23 - t; return ((x - cx) / rx) ** 2 + ((y - 25) / 3.8) ** 2 <= 1; }), 22.5, 25);
      dots(f, [[28, 24], [29, 23], [28, 27], [29, 28]], R.cream[6]);
      return f;
    },
  });

  // ------------------------------------------------------------ 20. Quartet: four jesters singing in a barbershop arc
  // (the outer two lower), round mouths wide open, brows up, tall floppy caps in four colours, each holding a King at
  // his chest, two ember notes over them, on violet
  joker('quartet', {
    ground: ['#2A1E74', '#342688', '#3E309A', '#483AAA'], glow: [15, 14, 14], speck: [R.cream[7], R.money[7]],
    draw() {
      const f = new Bmp(N, N);
      const shade = { cap: 1.2, base: 5, gain: 3 };
      // [centre x, head centre y, motley, skin, suit, which way the cap's tip flops]: inner two first (they stand behind)
      const Q = [[12, 13, R.lime, SKIN3, 'H', -1], [19, 13, R.chips, SKIN2, 'C', 1], [5, 16, R.pink, SKIN, 'S', -1], [26, 16, R.ember, SKIN, 'D', 1]];
      Q.forEach(([cx, cy, ramp, skin, suit, d]) => {
        const x = Math.round(cx);
        // shoulders, then the head: brows up, eyes open, a round singing mouth (teeth, dark, a pink tongue)
        lay(f, kit.roundRect(N, N, x - 4, cy + 4, x + 4, 33, 3), ramp, shade, true);
        lay(f, circ(x, cy, 3.3), skin, { cap: 2, base: 4, gain: 3.4 }, true);
        dots(f, [[x - 3, cy - 2], [x - 2, cy - 2], [x + 2, cy - 2], [x + 3, cy - 2]], skin[1]);
        dots(f, [[x - 2, cy - 1], [x - 2, cy], [x + 2, cy - 1], [x + 2, cy]], C.edge);
        f.draw(['www', 'mmm', 'mpm'], x - 1, cy + 1, { w: C.white, m: R.mult[1], p: R.pink[5] });
        // a tall floppy cap, its tip leaning out to one side with a bell
        lay(f, tube([x, cy - 4], [x + d * 0.5, cy - 9], [x + d * 2.6, cy - 9.5], (t) => 4.4 - t * 3), ramp, shade, true);
        lay(f, M((px, py) => py <= cy - 3 && ((px - x) / 3.6) ** 2 + ((py - (cy - 2.6)) / 2.4) ** 2 <= 1), ramp, shade, true);
        bell(f, x + d * 3, cy - 8.4, 1.2);
        // the King he holds at his chest, his hand over its foot
        card(f, x - 3, cy + 6, 7, 9, { rank: 'K', suit, rankAt: [1, 1] });
        lay(f, oval(x - d * 1.5, cy + 13, 2, 1.4), skin, { cap: 1, base: 4, gain: 2 }, true);
      });
      // two ember notes over the group
      const note = ['.xx.', '.x.x', '.x..', 'xx..', 'xx..'];
      [[0, 1], [27, 0]].forEach(([x, y]) => { const n = new Bmp(N, N); n.draw(note, x, y, { x: R.ember[6] }); n.set(x + 1, y + 3, R.ember[7]); n.outline(C.edge); f.blit(n, 0, 0); });
      return f;
    },
  });

  // ------------------------------------------------------------ 21. Red Nose: a big glossy red clown nose resting in a low
  // brass dish, its slack cream elastic trailing down to the dish, one bright white glint on top, on violet so the red
  // pops (on maroon it was red on red). (The brief's cream-and-maroon striped ground broke the dark-to-light ground and
  // turned the nose into a crystal ball; dropped.)
  joker('rednose', {
    ground: ['#2C1A6C', '#362080', '#402894', '#4A30A8'], glow: [15, 12, 13], speck: [R.pink[6], R.cream[6]],
    draw() {
      const f = new Bmp(N, N);
      // the dish: a low brass saucer, its far rim behind the nose
      lay(f, oval(15, 23, 9.5, 2), R.brass.slice(0, 6), { cap: 1.5, base: 2, gain: 2 }, true);
      // the nose: a big glossy red ball, shaded so its lit side stays red, a soft highlight and one bright glint
      const s = kit.sphere(8.6, R.mult.slice(0, 6), { lo: 1 });
      const o = new Bmp(s.w + 2, s.h + 2); o.blit(s, 1, 1); o.outline(C.edge);
      f.blit(o, 15 - Math.floor(o.w / 2), 3);
      f.rect(9, 7, 3, 2, R.mult[6]); f.set(12, 7, R.mult[6]);
      f.rect(10, 6, 2, 1, C.white); f.set(10, 7, C.white);
      // the dish's near lip in front of the nose's foot
      lay(f, M((x, y) => y >= 23 && ((x - 15) / 10.5) ** 2 + ((y - 23) / 3.4) ** 2 <= 1), R.brass, { cap: 1.5, base: 4, gain: 2.6 }, true);
      for (let x = 6; x <= 24; x++) if (f.get(x, 23) && f.get(x, 23) !== C.edge) f.set(x, 23, R.brass[6]);
      // the elastic: a slack cream loop, out from both sides of the nose and down onto the dish
      const band = new Bmp(N, N);
      band.line(24, 13, 26, 16, R.cream[6]); band.line(26, 16, 27, 19, R.cream[6]); band.line(27, 19, 26, 22, R.cream[6]);
      band.line(6, 13, 4, 16, R.cream[5]); band.line(4, 16, 3, 19, R.cream[5]); band.line(3, 19, 4, 22, R.cream[5]);
      band.outline(C.edge); f.blit(band, 0, 0);
      return f;
    },
  });

  // ------------------------------------------------------------ 22. Black Cat: a black cat in a pink jester collar with a
  // gold bell, curled around a chip-blue spade pip (its Chips), green eyes half closed, on ember orange
  joker('blackcat', {
    ground: ['#A8441A', '#BE5220', '#D06026', '#DE6E2C'], glow: [17, 12, 13], speck: [R.cream[7], R.money[7]],
    draw() {
      const f = new Bmp(N, N);
      const fur = ['#0C0912', '#141019', '#1C1724', '#262031', '#332B42', '#463C5A', '#5E5278'];
      // the spade the cat curls round (the Ace's spade, as on the cards)
      const sp = kit.bigPipMask('S'), spade = new Mask(N, N).or(sp, 10, 3);
      lay(f, spade, R.chips, { cap: 3.2, base: 5, gain: 3.6 }, true);
      // the curled body round the spade's foot, the tail up its right side
      lay(f, U(oval(15, 24.5, 12, 4.8), tube([25, 23], [29.5, 18], [27, 10.5], (t) => 3.4 - t * 1.4)), fur, { cap: 3, base: 3, gain: 3 }, true);
      for (let x = 6; x <= 24; x += 3) f.set(x, 22, fur[5]);
      // the head, resting on the left: ears, half-shut green eyes, a pink nose
      lay(f, U(circ(7, 17.5, 4.6), poly([[2.5, 15], [2.5, 9.5], [6.5, 13.5]]), poly([[7.5, 13], [11, 9.5], [11.8, 15]])), fur, { cap: 3, base: 3, gain: 3.2 }, true);
      dots(f, [[3, 12], [4, 13], [10, 12], [10, 13]], R.pink[4]);
      f.rect(4, 17, 2, 1, R.lime[5]); f.rect(8, 17, 2, 1, R.lime[5]);
      dots(f, [[4, 16], [5, 16], [8, 16], [9, 16]], fur[0]); dots(f, [[5, 17], [9, 17]], R.lime[7]);
      dots(f, [[6, 19], [7, 19]], R.pink[5]);
      // the pink collar and its gold bell
      lay(f, tube([3.5, 21], [7, 23], [11, 21.5], 2), R.pink, { cap: 1, base: 5, gain: 2.4 }, true);
      bell(f, 7.5, 24, 1.6);
      return f;
    },
  });

  // ------------------------------------------------------------ 23. Jewel Box: an open violet velvet jewel box heaped
  // with cream diamond pips (a few blushing pink or pale blue), some tumbling over its front; in the lid's pale mirror a
  // tiny jester ballerina twirls on a gold pin, arms up; on maroon
  joker('jewelbox', {
    ground: ['#2E0A16', '#3E0E1E', '#4E1426', '#5E1A2E'], glow: [15, 13, 13], speck: [R.cream[7], R.pink[7]],
    draw() {
      const f = new Bmp(N, N);
      const velvet = R.vio.slice(1, 8);
      // the lid, open and leaning back: a velvet frame round a pale blue mirror
      lay(f, kit.roundRect(N, N, 6, 1, 24, 16, 3), velvet, { cap: 2, base: 3, gain: 3 }, true);
      lay(f, oval(15, 8.5, 6.6, 6), R.ghost.slice(2), { cap: 3, base: 3, gain: 2.4 }, true);
      for (let x = 11; x <= 13; x++) f.set(x, x - 7, R.ghost[6]);
      // the figurine in front of the mirror: a pink tutu, arms up over a tiny belled cap, up on one toe on a gold pin
      const fig = new Bmp(N, N);
      fig.draw([
        '.a...a.',
        '.a.c.a.',
        '..ahha.',
        '...hh..',
        '...bb..',
        '.ttttt.',
        'ttTTTtt',
        '...l...',
      ], 12, 3, { a: SKIN[5], c: R.lime[5], h: SKIN[4], b: R.pink[4], t: R.pink[5], T: R.pink[7], l: SKIN[3] });
      fig.set(14, 3, R.gold[5]); fig.set(16, 3, R.gold[5]);
      fig.outline(C.edge); f.blit(fig, 0, 0);
      f.rect(15, 11, 1, 3, R.gold[4]); f.set(15, 13, R.gold[2]);
      // the box's dark inside at the rim
      lay(f, box(4, 17, 26, 19), velvet.slice(0, 3), { cap: 1, base: 1, gain: 1 }, true);
      // the heap of diamonds rising over the rim, back to front; ink only where a stone lies over another
      const stones = [[7, 14, 5, 0], [12, 12, 7, 0], [18, 12, 7, 1], [24, 14, 5, 0], [9, 16, 5, 2], [15, 15, 7, 0], [21, 16, 5, 1], [5, 18, 5, 0], [25, 18, 5, 2], [12, 18, 5, 0], [18, 18, 5, 0]];
      const tints = [R.cream.slice(2), R.pink.slice(3), R.ghost.slice(1)];
      const heap = new Mask(N, N);
      const stone = ([x, y, s, t]) => {
        const m = new Mask(N, N).or(Mask.rows(s === 7 ? kit.PIP7.D : kit.PIP5.D), x, y);
        const b = emboss(m, tints[t], { cap: 1.6, base: tints[t].length - 3, gain: 3.4 });
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (b.get(i, j)) f.set(i, j, b.get(i, j));
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (!m.get(i, j) && heap.get(i, j) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.get(i + dx, j + dy))) f.set(i, j, C.edge);
        f.set(x + (s === 7 ? 3 : 2), y + 1, C.white);
        heap.or(m);
      };
      stones.forEach(stone);
      // the box front: velvet, gold trim at top and bottom, a gold clasp
      lay(f, kit.roundRect(N, N, 3, 20, 27, 28, 1), velvet, { cap: 2, base: 4, gain: 3 }, true);
      for (let x = 3; x <= 27; x++) { f.set(x, 20, R.gold[5]); f.set(x, 28, R.gold[3]); }
      lay(f, box(14, 21, 16, 23), R.gold, { cap: 1, base: 4, gain: 2 }, true);
      // three stones tumbling over the front edge
      [[6, 22, 5, 0], [21, 23, 5, 1], [24, 26, 5, 0]].forEach(([x, y, s, t]) => {
        const o = new Bmp(s + 2, s + 2); o.blit(emboss(Mask.rows(kit.PIP5.D), tints[t], { cap: 1.6, base: tints[t].length - 3, gain: 3.4 }), 1, 1); o.set(3, 2, C.white); o.outline(C.edge); f.blit(o, x - 1, y - 1);
      });
      return f;
    },
  });

  // ------------------------------------------------------------ 24. Lucky Sevens: two red 7s just tossed high, pink and
  // ember sparkles round them, the jester below with his arms flung up in a V, head tipped back to watch, on violet
  joker('luckysevens', {
    ground: ['#30106E', '#3C1484', '#481A98', '#5420AA'], glow: [15, 12, 14], speck: [R.money[7], R.cream[7]],
    draw() {
      const f = new Bmp(N, N);
      const shade = { cap: 1.5, base: 5, gain: 3.6 };
      // two cards flying high, upright, one higher than the other: a red 7 over a small heart
      const seven = (x, y) => card(f, x, y, 9, 13, { rank: '7', suit: 'H', rankAt: [2, 1], paint: (c, ox, oy) => c.draw(['x.x', 'xxx', '.x.'], ox + 3, oy + 9, { x: kit.SUIT_RAMP.H[3] }) });
      seven(1, 5); seven(21, 2);
      // speed dashes under each card, from the hand that threw it
      [[3, 20], [7, 21], [23, 17], [27, 18]].forEach(([x, y]) => { f.set(x, y, R.cream[6]); f.set(x, y + 1, R.cream[4]); });
      sparkle(f, 15, 4, R.pink[6], true); sparkle(f, 11, 1, R.ember[6]); sparkle(f, 8, 21, R.ember[6]); sparkle(f, 27, 24, R.pink[6], true);
      // the jester: motley shoulders, arms flung up in a V from them, the hands open under the cards
      const split = (m, a, b, at) => { const pa = emboss(m, a, shade), pb = emboss(m, b, shade); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m.get(x, y) && x >= at) pa.set(x, y, pb.get(x, y)); pa.outline(C.edge); f.blit(pa, 0, 0); };
      lay(f, tube([9, 28], [4.5, 26], [4, 21], 3), R.pink, shade, true);
      lay(f, tube([21, 28], [25.5, 25], [25.5, 18.5], 3), R.lime, shade, true);
      lay(f, U(circ(4, 19.5, 1.8), circ(25.5, 17, 1.8)), SKIN, { cap: 1, base: 4, gain: 2.6 }, true);
      split(oval(15, 31.5, 8.6, 4.4), R.pink, R.lime, 15);
      // a dagged collar, the head tipped back to watch the cards: eyes turned up after the high one, brows up, an open
      // mouth; a fool's cap with one curly point and its bell
      split(poly([[9, 25], [21, 25], [20, 28], [18, 26.6], [16.5, 28.6], [15, 26.6], [13.5, 28.6], [12, 26.6], [10, 28]]), R.lime, R.pink, 15);
      lay(f, circ(15, 21, 4.3), SKIN3, { cap: 3, base: 4, gain: 4 }, true);
      f.rect(12, 19, 2, 2, C.white); f.rect(16, 19, 2, 2, C.white); f.set(13, 19, C.edge); f.set(17, 19, C.edge);
      dots(f, [[12, 18], [13, 18], [16, 18], [17, 18]], SKIN3[1]);
      f.rect(14, 22, 2, 2, R.mult[1]); f.set(15, 23, R.pink[5]); f.set(14, 21, SKIN3[3]);
      lay(f, tube([14, 15], [10.5, 9.5], [15.5, 8.5], (t) => 4 - t * 2.4), R.pink, shade, true);
      lay(f, M((x, y) => y <= 17 && ((x - 15) / 4.9) ** 2 + ((y - 17.5) / 3.6) ** 2 <= 1), R.pink, shade, true);
      lay(f, box(10, 17, 20, 17), R.lime, { cap: 1, base: 5, gain: 2 }, true);
      bell(f, 17, 9, 1.6);
      return f;
    },
  });

  // ------------------------------------------------------------ 25. Ankle Biters: three scrappy puppies in tiny jester
  // collars tugging at one cream card, one puppy's ear flipped inside out, on burnt orange
  joker('anklebiters', {
    ground: ['#943812', '#A44216', '#B44C1A', '#C2561E'], glow: [15, 11, 13], speck: [R.cream[7], R.ember[7]],
    draw() {
      const f = new Bmp(N, N);
      const tan = R.wood.slice(1), white = R.cream.slice(2), choc = R.wood.slice(0, 5), muzzle = R.cream.slice(2, 7);
      // the card they all want, upright: a low rank, a 3 of Spades
      card(f, 11, 2, 9, 14, { rank: '3', suit: 'S', rankAt: [1, 1], pip: 'S', size: 5, at: [3, 8] });
      // a pup's head in profile, jaws clamped on the card's edge: [skull centre, facing (1 right, -1 left), fur, ear, collar]
      const side = (hx, hy, d, fur, earRamp, collar, patch) => {
        const X = (x) => hx + d * x, bx = (a, y0, b, y1) => box(Math.min(X(a), X(b)), y0, Math.max(X(a), X(b)), y1);
        lay(f, bx(-3, hy + 3, 0, hy + 7), fur, { cap: 1.5, base: 4, gain: 2.4 }, true);
        lay(f, bx(-3, hy + 4, 0, hy + 5), collar, { cap: 1, base: 5, gain: 2 }, true);
        lay(f, U(circ(hx, hy, 4.2), kit.roundRect(N, N, Math.min(X(2), X(7)), hy - 1, Math.max(X(2), X(7)), hy + 3, 1)), fur, { cap: 2.5, base: 4, gain: 3.2 }, true);
        f.line(X(3), hy + 1, X(7), hy + 1, C.edge);
        dots(f, [[X(7), hy - 1], [X(6), hy - 1], [X(7), hy]], C.edge);
        if (patch) fill(f, M((x, y) => (x - X(1.5)) ** 2 + (y - (hy - 1.5)) ** 2 <= 4.6), patch);
        f.rect(Math.min(X(1), X(2)), hy - 2, 2, 2, C.edge); f.set(X(d > 0 ? 1 : 2), hy - 2, C.white);
        dots(f, [[X(4), hy + 2], [X(4), hy + 3]], R.pink[6]); f.set(X(5), hy + 3, R.pink[4]);
        return X;
      };
      // left: a tan pup, its floppy ear dark; right: a white pup with a black eye patch, its ear flipped inside out
      side(5, 8, 1, tan, null, R.pink, null);
      lay(f, oval(2.5, 9, 1.8, 3.4), R.wood.slice(0, 4), { cap: 1, base: 2, gain: 2 }, true);
      side(25, 10, -1, white, null, R.lime, R.dark[2]);
      lay(f, poly([[25, 7], [29.5, 2.5], [29.5, 7.5]]), R.pink.slice(3), { cap: 1, base: 3, gain: 2.4 }, true);
      // bottom: the smallest pup, chocolate with a tan muzzle and tan brows, front on, paws up on the card's foot
      lay(f, U(oval(10.5, 22.5, 1.8, 3.4), oval(20.5, 22.5, 1.8, 3.4)), choc.slice(0, 4), { cap: 1, base: 2, gain: 2 }, true);
      lay(f, circ(15.5, 22.5, 4.8), choc, { cap: 2.5, base: 4, gain: 3.2 }, true);
      lay(f, box(11, 27, 20, 28), R.chips.slice(2), { cap: 1, base: 4, gain: 2 }, true);
      lay(f, oval(15.5, 24.6, 2.8, 2), muzzle, { cap: 1, base: 3, gain: 2 }, false);
      f.rect(13, 20, 2, 2, C.edge); f.rect(17, 20, 2, 2, C.edge); f.set(13, 20, C.white); f.set(17, 20, C.white);
      dots(f, [[13, 18], [14, 18], [17, 18], [18, 18]], muzzle[3]);
      dots(f, [[15, 23], [16, 23]], C.edge);
      dots(f, [[14, 25], [15, 25], [16, 25], [17, 25]], R.mult[1]); dots(f, [[15, 26], [16, 26]], R.pink[6]);
      lay(f, U(oval(12.5, 16.5, 1.8, 1.3), oval(18.5, 16.5, 1.8, 1.3)), choc.slice(1), { cap: 1, base: 3, gain: 2 }, true);
      dots(f, [[12, 16], [18, 16]], choc[1]);
      return f;
    },
  });

  // ------------------------------------------------------------ 26. Jack-in-the-Box: a red-and-gold box, a jester springing
  // out of it on a coiled spring, the crank handle mid-turn, on plum
  joker('jackinthebox', {
    ground: ['#3A1634', '#4A1E42', '#5A2650', '#6A2E5E'], glow: [14, 11, 13], speck: [R.money[7], R.pink[7]],
    draw() {
      const f = new Bmp(N, N);
      // the box: a lit front, a shaded side, gold trim, a gold J on the front, the lid flung back
      lay(f, poly([[5, 9.5], [9, 13], [9, 19], [5, 17]]), R.mult.slice(1), { cap: 1, base: 3, gain: 2 }, true);
      lay(f, poly([[19, 19], [24, 16], [24, 26], [19, 29]]), R.mult.slice(0, 6), { cap: 1.5, base: 3, gain: 2.4 }, true);
      lay(f, box(5, 19, 19, 29), R.mult, { cap: 2, base: 5, gain: 3 }, true);
      for (let x = 5; x <= 19; x++) { f.set(x, 19, R.gold[5]); f.set(x, 29, R.gold[3]); }
      for (let y = 19; y <= 29; y++) { f.set(5, y, R.gold[5]); f.set(19, y, R.gold[3]); }
      glyph(f, 'J', 10, 21, R.gold.slice(1));
      // the crank on the side, caught mid-turn
      lay(f, U(tube([21.5, 22], [25, 21], [27.5, 18.5], 1.6), circ(28, 17.5, 1.6)), R.gold, { cap: 1, base: 4, gain: 2.6 }, true);
      lay(f, circ(21.5, 22.5, 1.4), R.gold.slice(1), { cap: 1, base: 3, gain: 2 }, true);
      // the coiled spring
      const spring = new Bmp(N, N);
      for (let i = 0; i < 4; i++) { const y = 18 - i * 2; spring.line(9, y, 15, y - 1, R.steel[4]); spring.line(15, y - 1, 9, y - 2, R.steel[2]); }
      spring.outline(C.edge); f.blit(spring, 0, 0);
      // the jester springing up: arms flung wide, eyes wide, a huge grin, a two-belled cap
      lay(f, U(tube([10, 11], [5, 9], [3, 5], 2.4), tube([15, 11], [20, 9], [22, 5], 2.4)), R.lime, { cap: 1, base: 5, gain: 2.6 }, true);
      dots(f, [[2, 4], [3, 4], [22, 4], [23, 4]], SKIN[5]);
      lay(f, M((x, y) => y >= 10 && y <= 12 && [9.5, 12.5, 15.5].some((c) => (x - c) ** 2 + (y - 11) ** 2 <= 2.4)), R.cream, { cap: 1, base: 5, gain: 2 }, true);
      lay(f, circ(12.5, 6.5, 3.8), SKIN, { cap: 2.5, base: 4, gain: 3.6 }, true);
      f.rect(10, 5, 2, 2, C.white); f.rect(14, 5, 2, 2, C.white); dots(f, [[11, 6], [15, 6]], C.edge);
      fill(f, M((x, y) => y >= 8 && y <= 9 && Math.abs(x - 12.5) <= (y === 8 ? 2.5 : 1.5)), R.mult[1]); dots(f, [[11, 8], [13, 8]], C.white);
      lay(f, tube([10, 3.5], [7, -0.5], [5.5, 2.5], (t) => 3 - t * 1.4), R.vio, { cap: 1.2, base: 5, gain: 3 }, true);
      lay(f, tube([15, 3.5], [18, -0.5], [19.5, 2.5], (t) => 3 - t * 1.4), R.pink, { cap: 1.2, base: 5, gain: 3 }, true);
      lay(f, cut(oval(12.5, 3.8, 3.6, 2.2), box(0, 4, 30, 30)), R.vio, { cap: 1.2, base: 5, gain: 3 }, true);
      bell(f, 5.5, 3.5, 1.3); bell(f, 19.5, 3.5, 1.3);
      return f;
    },
  });

  // ------------------------------------------------------------ 27. Top Hat: a tall plum top hat with a cream band and an
  // Ace tucked into it, soft puffs of smoke rising from the crown, on ember orange
  joker('tophat', {
    ground: ['#A0361A', '#B6421E', '#C84E24', '#D65A2A'], glow: [15, 14, 13], speck: [R.cream[7], R.ember[8]],
    draw() {
      const f = new Bmp(N, N);
      const felt = ['#14070F', '#1E0D19', '#2C1426', '#3E1E36', '#52284A', '#6A3660', '#84467A', '#A0628E'];
      // three soft puffs of smoke rising off the crown and drifting left, paling as they go, and one ember spark
      lay(f, U(circ(15.5, 6, 2.2), circ(13.5, 5.5, 1.6)), R.ember.slice(5), { cap: 1.5, base: 2, gain: 2 }, true);
      lay(f, U(circ(10, 3.5, 1.7), circ(8.5, 4, 1.2)), [R.ember[6], R.ember[7], R.ember[8], R.cream[7]], { cap: 1.5, base: 2, gain: 2 }, true);
      lay(f, circ(4.5, 1.5, 1.2), [R.ember[8], R.cream[6], R.cream[7]], { cap: 1, base: 1, gain: 1.6 }, true);
      f.rect(20, 2, 2, 2, R.ember[6]); f.set(20, 2, R.ember[8]);
      // the brim, the tall crown and its top
      lay(f, oval(15, 26, 13.5, 3.4), felt, { cap: 2, base: 4, gain: 3 }, true);
      lay(f, U(box(7, 8, 23, 25), oval(15, 25, 8, 1.6)), felt, { cap: 3, base: 4, gain: 3.2 }, true);
      lay(f, oval(15, 8, 8, 2.2), felt.slice(2), { cap: 1.5, base: 3, gain: 2 }, true);
      for (let y = 10; y <= 22; y++) f.set(9, y, felt[6]);
      // the cream band round its foot
      lay(f, U(box(7, 19, 23, 23), oval(15, 23, 8, 1.4)), R.cream.slice(1), { cap: 1.5, base: 4, gain: 2.4 }, true);
      // the Ace of Spades tucked in the band
      tcard(f, 20.5, 14.5, 8, 11, 14, { rank: 'A', suit: 'S', rankAt: [17, 10], pip: 'S', size: 5, off: [1, 3], keep: (x, y) => y < 20 || x > 23 });
      lay(f, box(7, 20, 23, 21), R.cream.slice(1), { cap: 1, base: 4, gain: 1.6 }, false);
      return f;
    },
  });

  // ------------------------------------------------------------ 28. Ace Up the Sleeve: a forearm raised on the diagonal
  // in a pink-and-cream striped sleeve, the other hand tugging the cuff back toward the elbow (the stripes bunch), an Ace
  // of Spades sliding out of the cuff along the wrist; the sly jester's face in the corner, one brow cocked, on violet
  joker('aceupthesleeve', {
    ground: ['#22104A', '#2C165C', '#361C6E', '#40227E'], glow: [17, 14, 13], speck: [R.cream[7], R.pink[7]],
    draw() {
      const f = new Bmp(N, N);
      const shade = { cap: 1.5, base: 5, gain: 3.6 };
      // the bare wrist and hand at the top right (the sleeve is pulled off it)
      lay(f, tube([15, 18], [19.5, 13.5], [24, 9], 3.6), SKIN3, { cap: 1.5, base: 4, gain: 3 }, true);
      lay(f, circ(25, 8, 2.8), SKIN3, { cap: 1.5, base: 4, gain: 3 }, true);
      dots(f, [[24, 9], [25, 10], [26, 10]], SKIN3[1]);
      // the Ace of Spades sliding out of the cuff along the wrist, its top half showing
      tcard(f, 18, 14, 8, 13, 45, { rank: 'A', suit: 'S', rankAt: [17, 8] });
      // the sleeve, pink and cream stripes across the forearm from the elbow in the corner up to the cuff; the stripes
      // bunch where the other hand has tugged the cuff back
      const sleeve = tube([2, 32], [8, 25], [15.5, 18], 7.4);
      const sp = emboss(sleeve, R.pink, shade), sc = emboss(sleeve, R.cream, shade);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!sleeve.get(x, y)) continue;
        const s = x - y + 32, band = s > 30 ? Math.floor(s / 1.5) : Math.floor(s / 3);
        if (band % 2) sp.set(x, y, sc.get(x, y));
      }
      sp.outline(C.edge); f.blit(sp, 0, 0);
      // the cuff's rolled edge
      lay(f, tube([11.5, 16], [14.5, 19], [17.5, 22], 2.2), R.cream.slice(2), { cap: 1, base: 4, gain: 2 }, true);
      // the other hand, up from the foot of the window, pinching the cuff and pulling it back
      lay(f, tube([22, 33], [21.5, 28], [19.5, 24], 4), R.vio.slice(2), { cap: 1.5, base: 4, gain: 3 }, true);
      lay(f, U(circ(18.5, 22.5, 2.4), tube([17, 21.5], [15.5, 20.5], [14.5, 20], 1.6), tube([17.5, 23.5], [16, 23], [15, 22.5], 1.6)), SKIN, { cap: 1.5, base: 4, gain: 3 }, true);
      // the sly face, smaller, in the top left: one brow cocked high, one eye narrowed, a sideways smirk
      lay(f, M((x, y) => y >= 13 && y <= 15 && [3, 6, 9].some((c) => (x - c) ** 2 + (y - 14) ** 2 <= 2.6)), R.cream, { cap: 1.5, base: 5, gain: 3 }, true);
      lay(f, circ(6, 9.5, 3.9), SKIN3, { cap: 3, base: 4, gain: 4 }, true);
      dots(f, [[3, 7], [4, 6], [5, 6]], SKIN3[0]); dots(f, [[7, 8], [8, 8], [9, 8]], SKIN3[0]);
      f.rect(4, 8, 2, 2, C.edge); f.set(4, 8, C.white);
      dots(f, [[7, 9], [8, 9], [9, 9]], C.edge);
      dots(f, [[4, 12], [5, 12], [6, 12], [7, 11], [8, 11]], R.mult[1]);
      f.set(9, 11, BLUSH);
      // the cap: pink and lime points to bells, kept inside the window
      lay(f, tube([3.5, 5.5], [1.5, 3], [1.5, 1.5], (t) => 3.2 - t * 1.6), R.pink, shade, true);
      lay(f, tube([8.5, 5.5], [11, 2.5], [13, 3.5], (t) => 3.2 - t * 1.6), R.lime, shade, true);
      lay(f, M((x, y) => y <= 6 && ((x - 6) / 4.2) ** 2 + ((y - 6.5) / 2.8) ** 2 <= 1), R.pink, shade, true);
      lay(f, box(2, 6, 10, 6), R.gold, { cap: 1, base: 4, gain: 2 }, true);
      bell(f, 2, 2, 1.3); bell(f, 13.5, 4, 1.3);
      return f;
    },
  });
})();
