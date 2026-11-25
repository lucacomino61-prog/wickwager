/* Jokers, set c (Joker artist c): 29 uncommons, in content-plan order.
 * Each entry is the shape of Lit's JOKER_ART (see 40-jokers-lit.js and ART.md, "Joker"): a ground (4 colours, dark
 * to light), an optional glow pool [x, y, r], speck colours and draw(kit) -> the 31 x 31 figure. The core adds the
 * rarity frame, gems, ground bands, glow, specks, the ink outline and the empty name plate.
 * Helpers shared by this file live in TW.Art.lib.c (the kit itself is frozen). Light that must not be inked (a
 * spotlight, sparks, a glow) goes through L.lit(): the figure is drawn and inked as usual, then the light is laid
 * over the ground only, never over the figure.
 * Every draw() ends with finish(f): after the core's ink, no colour pixel may stand alone between ink and empty (a
 * crumb that shows as dust at 2x); deliberate glints are listed so the pass leaves them. Coins are flat money yellow
 * with one amber rim (never a gold ramp, never a $). Headwear varies on purpose: the two-point cap appears on at most
 * three Jokers here (Final Bow, Old Stager, One-Man Band); the rest wear berets, shakos, hoods, visors, turbans,
 * top and flat caps, single points and three-point caps.
 */
(() => {
  'use strict';
  const A = globalThis.TW.Art;
  const L = (A.lib.c = A.lib.c || {});
  const { Bmp, Mask, R, C, emboss, strokeQuad, ellipse, disc, roundRect, GLYPH_S, parseGlyph, PIP5 } = A.kit;
  const W = 31, INK = C.edge;

  // ------------------------------------------------------------ helpers (TW.Art.lib.c)
  /** A 31 x 31 mask from a test on pixel (x, y). */
  const M = (fn) => Mask.fn(W, W, fn);
  /** A polygon mask: vertices on pixel corners; a pixel is in when its centre is. */
  const poly = (pts) => M((x, y) => {
    let c = false; const px = x + 0.5, py = y + 0.5;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  });
  const circ = (cx, cy, r) => M((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.35);
  const ell = (cx, cy, rx, ry) => ellipse(W, W, cx, cy, rx, ry);
  const rr = (x0, y0, x1, y1, r = 0) => roundRect(W, W, x0, y0, x1, y1, r);
  const quad = (p0, p1, p2, wd) => strokeQuad(W, W, p0, p1, p2, wd);
  const seg = (p0, p1, wd) => strokeQuad(W, W, p0, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], p1, wd);
  const union = (...ms) => { const m = new Mask(W, W); ms.forEach((k) => m.or(k)); return m; };
  const minus = (a, ...bs) => { const m = new Mask(W, W).or(a); bs.forEach((k) => m.sub(k)); return m; };
  const rows = (g) => Mask.rows(g);
  /** Shade a mask from a ramp (emboss) and lay it on f. With ink (the default) the part gets its own 1-px ink edge
      first, so it reads apart from whatever it overlaps. */
  const put = (f, m, ramp, o = {}, ink = true, dx = 0, dy = 0) => {
    const b = emboss(m, ramp, { cap: 2, gain: 4, ...o });
    if (ink) { const p = new Bmp(b.w + 2, b.h + 2); p.blit(b, 1, 1); p.outline(INK); f.blit(p, dx - 1, dy - 1); } else f.blit(b, dx, dy);
    return f;
  };
  const fill = (f, m, c) => { for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y)) f.set(x, y, c); return f; };
  const dots = (f, pts, c) => { pts.forEach(([x, y]) => f.set(x, y, c)); return f; };
  /** An Ember rank glyph (5 x 7) in one colour, or shaded top to bottom from a ramp slice. */
  const glyph = (f, ch, x, y, col) => { parseGlyph(GLYPH_S[ch]).forEach((row, j) => row.forEach((on, i) => { if (on) f.set(x + i, y + j, Array.isArray(col) ? col[Math.min(col.length - 1, Math.floor((j / 7) * col.length))] : col); })); return f; };
  /** A small pip (5 x 5) shaded from a ramp. */
  const pip = (suit, ramp, o = {}) => emboss(Mask.rows(PIP5[suit]), ramp, { cap: 1.6, base: 3, gain: 4.2, depth: 1.1, ...o });
  /** A small playing card w x h inside a 1-px ink edge, lit from the upper left; returns (w + 2) x (h + 2). */
  function card(w, h, o = {}) {
    const face = o.face || C.cream, hi = o.hi || C.white, lo = o.lo || C.cream3, b = new Bmp(w + 2, h + 2);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!o.square && (i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;
      b.set(i + 1, j + 1, i === w - 1 || j === h - 1 ? lo : i === 0 || j === 0 ? hi : face);
    }
    return b.outline(INK);
  }
  /** A slanted card: a parallelogram-ish quad mask filled like a card (lit rim on the upper left), inked. */
  function cardQuad(f, pts, o = {}) {
    const m = poly(pts), b = new Bmp(W, W);
    const face = o.face || C.cream, hi = o.hi || C.white, lo = o.lo || C.cream3;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (!m.get(x, y)) continue;
      const c = !m.get(x + 1, y) || !m.get(x, y + 1) ? lo : !m.get(x - 1, y) || !m.get(x, y - 1) ? hi : face;
      b.set(x, y, c);
    }
    b.outline(INK);
    f.blit(b, 0, 0);
    return m;
  }
  /** A gold bell, r 2.6 (5 x 5) or 1.5 (4 x 4), with its slit and a glint; returns the inked sprite. */
  function bell(r = 2.6) {
    const d = emboss(disc(r), R.gold, { cap: 2, base: 4, gain: 4.6 }), b = new Bmp(d.w + 2, d.h + 2);
    b.blit(d, 1, 1);
    const n = d.w;
    if (n >= 7) { b.set(3, n - 1, INK); b.set(4, n - 1, INK); b.set(2, 2, C.white); } else { b.set(2, n - 1, INK); b.set(3, n - 1, INK); b.set(2, 2, C.white); }
    return b.outline(INK);
  }
  /** A coin face-on: flat money yellow with one amber rim on its lower right and a glint (never a gold ramp, never a
      $). r 3 is 8 x 8, r 2 is 6 x 6; returns it inked (2 px bigger). */
  function coin(r = 3) {
    const m = disc(r === 3 ? 3.2 : 2.2), n = m.w, b = new Bmp(n + 2, n + 2);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (!m.get(x, y)) continue;
      const rim = !m.get(x + 1, y) || !m.get(x, y + 1) || !m.get(x + 1, y + 1);
      b.set(x + 1, y + 1, rim ? R.money[3] : R.money[5]);
    }
    b.set(r === 3 ? 3 : 2, r === 3 ? 3 : 2, R.money[7]);
    if (r === 3) b.set(3, 4, R.money[6]);
    return b.outline(INK);
  }
  /** A jester cap prong: a shaded tube from p0 bending through p1 to p2, thinning from w0 to w1. */
  const prong = (f, p0, p1, p2, ramp, w0 = 5, w1 = 2.4, ink = false) => put(f, quad(p0, p1, p2, (t) => w0 - t * (w0 - w1)), ramp, { cap: 2, base: Math.min(5, ramp.length - 3), gain: 4.4 }, ink);
  /** A ruff of scallops along a row: centres xs at height y, radius r, shaded cream (or a given ramp). */
  const ruff = (f, xs, y, r = 2.6, ramp = R.cream, o = {}) => put(f, M((x, yy) => Math.abs(yy - y) <= r && xs.some((c) => (x - c) ** 2 + (yy - y) ** 2 <= r * r + 0.6)), ramp, { cap: 2, base: ramp.length - 3, gain: 3.6, ...o }, o.ink !== false);

  // skin ramps, dark to light (the first is Lit's jester; the others extend the court people's)
  const SKIN = {
    tan: ['#6A2A1C', '#94442E', '#C06446', '#DE845C', '#F2A272', '#FCC090', '#FFDDB8'],
    deep: ['#2E160E', '#4A2A1C', '#6A4029', '#8C5A3C', '#A9734F', '#C99068', '#E2AE82'],
    pale: ['#7A3E3A', '#A8645A', '#D59A80', '#F6CBA8', '#FFE2C8', '#FFF0E0', '#FFF8F0'],
    gold: ['#5A3020', '#7E4A2E', '#B07448', '#E2A574', '#F5C79A', '#FFE0BC', '#FFF0DA'],
  };
  const FACE = { mouth: '#5A1024', throat: '#3E0A1A', tongue: '#E8384A', tongueHi: '#FF6F7E', blush: '#FF8FB4', blushHi: '#FFB8D0', brow: '#8C3A2A' };
  // a saturated plum for cloth (the kit's plum is the ink-and-shadow family, too grey for a sack or a stool)
  const PLUM = ['#2A0E26', '#3E1636', '#552048', '#6E2C5C', '#8A3C70', '#A85486', '#C6749E', '#E2A0BC'];
  const skin = (f, m, s = SKIN.tan, o = {}) => put(f, m, s, { cap: 3.5, base: 3, gain: 4.6, ...o }, o.ink !== false);

  /** Light that is not inked: draw() makes the figure as usual; overlay(fx) lays light over the ground only.
      fx(kit, b, free, X, Y) paints the card b; free(x, y) is true where the window shows ground (no figure, no ink);
      X and Y turn window coordinates into card coordinates. */
  function lit(spec, fx) {
    return {
      ...spec,
      overlay(k, b, ctx) {
        const fig = spec.draw(k, ctx); fig.outline(INK);
        const free = (x, y) => x >= 5 && y >= 7 && x < 36 && y < 38 && !fig.get(x - 5, y - 7);
        fx(k, b, free, (x) => x + 5, (y) => y + 7);
      },
    };
  }
  /** Mix a colour with alpha over the window where it is free (window coordinates). */
  const glowAt = (b, free, pts, col) => pts.forEach(([x, y]) => { if (free(x + 5, y + 7)) b.mix(x + 5, y + 7, col); });
  /** A four-point sparkle (window coordinates): a white core and arms in a colour, over the ground only. */
  const sparkle = (b, free, x, y, arm, big = false) => {
    glowAt(b, free, [[x, y]], C.white);
    glowAt(b, free, [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]], arm);
    if (big) glowAt(b, free, [[x - 2, y], [x + 2, y], [x, y - 2], [x, y + 2]], arm + '99');
  };

  /** The crumb pass, the last step of every draw(): after the core's ink, a colour pixel whose four neighbours are all
      ink or empty is a crumb (dust at 2x), so it becomes ink. keep lists [x, y] pixels to leave alone (glints). */
  function finish(f, keep = []) {
    const K = new Set(keep.map(([x, y]) => x + ',' + y));
    for (let pass = 0; pass < 2; pass++) {
      const g = f.clone(); g.outline(INK);
      const lone = (x, y) => { const c = g.get(x, y); return c && c !== INK && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => { const q = g.get(x + dx, y + dy); return !q || q === INK; }); };
      const out = [];
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (!K.has(x + ',' + y) && lone(x, y)) out.push([x, y]);
      if (!out.length) break;
      out.forEach(([x, y]) => f.set(x, y, INK));
    }
    return f;
  }
  /** A ruff of separate scallops, each its own inked disc laid left to right, so every frill shows its edge. */
  const frills = (f, xs, y, r = 2.4, ramp = R.cream) => { xs.forEach((c) => put(f, circ(c, y, r), ramp, { cap: 1.6, base: ramp.length - 3, gain: 3.4 })); return f; };
  /** A 2 x 2 eye in ink with a glint in one corner ('l' upper left, 'r' upper right, '' none). */
  const eye = (f, x, y, glint = 'l', g = C.white) => { f.rect(x, y, 2, 2, INK); if (glint) f.set(glint === 'l' ? x : x + 1, y, g); return f; };
  /** A brow: pixels in ink-brown. */
  const brow = (f, pts, c = FACE.brow) => dots(f, pts, c);
  /** Small skin hands, each a rows mask (X = skin) to shade and ink: open (fingers up), point (index up), fist. */
  const HANDS = {
    open: ['X.X.X', 'X.X.X', 'XXXXX', 'XXXXX', '.XXX.'],
    point: ['.X..', '.X..', '.XX.', 'XXXX', 'XXXX', '.XX.'],
    fist: ['XXX', 'XXXX', 'XXXX', '.XX.'],
  };
  const hand = (f, kind, x, y, s = SKIN.tan, o = {}) => {
    const g = HANDS[kind], n = Math.max(...g.map((r) => r.length));
    const rowsOf = g.map((r) => { const p = r.padEnd(n, '.'); return o.flip ? [...p].reverse().join('') : p; });
    return skin(f, new Mask(W, W).or(Mask.rows(o.flipY ? rowsOf.slice().reverse() : rowsOf), x, y), s, { cap: 1.2, base: 4, gain: 3, ...o });
  };

  Object.assign(L, { W, M, poly, circ, ell, rr, quad, seg, union, minus, put, fill, dots, glyph, pip, card, cardQuad, bell, coin, prong, ruff, SKIN, FACE, PLUM, skin, lit, glowAt, sparkle, finish, frills, eye, brow, HANDS, hand });

  // ------------------------------------------------------------ the Jokers

  // ---- Sable Knave: a cocky young page in sable, a short shoulder cape with a dagged hem and puffed, slashed sleeves,
  // gold only on the hem and the buttons; a slouched beret with a cream feather and one chip-blue spade pip glowing on
  // it, its light rimming his beret and shoulder. He leans on a little garden spade held across him on a diagonal,
  // from his fist at the shoulder to the blade planted at the bottom right, its blade shaped like a spade pip.
  // Mauve-rose ground, lifted so the sable reads.
  A.joker('sableknave', {
    rarity: 'uncommon',
    ground: ['#5A2448', '#6E2E58', '#823A6A', '#96467C'], glow: [12, 13, 12], speck: [R.chips[7], R.gold[5]],
    draw(k) {
      const f = new Bmp(W, W), SAB = { cap: 3, base: 1, gain: 3.2 };
      // the body: a sable tunic, gold buttons and a gold hem
      put(f, rr(4, 20, 18, 34, 4), R.dark, SAB);
      dots(f, [[11, 23], [11, 26], [11, 29]], R.gold[5]);
      fill(f, M((x, y) => y === 30 && x >= 5 && x <= 17), R.gold[3]);
      // the far arm akimbo, a puffed sleeve slashed with chip blue
      put(f, union(circ(4.5, 21, 2.8), seg([3.5, 23], [1.5, 27], 2.6), seg([1.5, 27], [5, 29], 2.4)), R.dark, SAB);
      dots(f, [[4, 20], [5, 21]], R.chips[5]);
      // the short shoulder cape with a dagged hem, trimmed in gold
      put(f, M((x, y) => y >= 17 && y <= 22 && x >= 3 && x <= 19 && (y <= 20 || ((x + 1) % 3 !== 0 && y <= 21) || (x + 1) % 3 === 1)), R.dark.slice(1), { cap: 2, base: 2, gain: 3 });
      fill(f, M((x, y) => y === 21 && x >= 4 && x <= 18 && (x + 1) % 3 !== 0), R.gold[3]);
      // the spade across him: a D-grip above his fist, a 2-px ash handle, a steel blade shaped like a spade pip
      put(f, union(seg([20.5, 10], [25.5, 22], 2.2)), R.wood.slice(2), { cap: 1, base: 3, gain: 3 });
      put(f, M((x, y) => { const d = Math.hypot(x + 0.5 - 20, y + 0.5 - 6.5); return d <= 2.6 && d >= 1.2 && y <= 8; }), R.wood.slice(2), { cap: 1, base: 3, gain: 3 });
      const blade = new Mask(W, W).or(Mask.rows(['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', '.X.X.X.', '...X...']), 22, 21);
      put(f, blade, R.steel, { cap: 1.6, base: 3, gain: 3.4 });
      // the near arm up to the handle, a puffed sleeve, the fist round the shaft just under the grip
      put(f, union(circ(17, 19.5, 2.8), seg([17, 19], [19.5, 12.5], 2.6)), R.dark, SAB);
      dots(f, [[16, 18], [17, 19]], R.chips[5]);
      hand(f, 'fist', 19, 9, SKIN.gold);
      // the head, chin up, a sly sideways look and a smirk
      skin(f, ell(11, 12, 5, 5.4), SKIN.gold, { cap: 3 });
      put(f, union(ell(6.6, 12.5, 1.4, 2.2)), R.wood.slice(0, 5), { cap: 1.5, base: 2, gain: 3 });
      brow(f, [[8, 9], [9, 9], [12, 9], [13, 8]], R.wood[1]);
      eye(f, 9, 11, 'r'); eye(f, 13, 11, 'r');
      dots(f, [[10, 15], [11, 15], [12, 15], [13, 14]], FACE.mouth);
      // the slouched beret, its chip-blue light rimming the beret and his shoulder; a cream feather; the glowing pip
      put(f, union(ell(10, 6.6, 7.4, 2.4), ell(11, 4.8, 5, 2.2)), R.dark, { cap: 2, base: 2, gain: 3.6 });
      put(f, quad([6, 5], [1.5, 2.5], [-1, 6.5], (t) => 3 - t * 1.6), R.cream.slice(1), { cap: 1, base: 5, gain: 3 });
      dots(f, [[5, 4], [4, 4], [3, 4], [2, 5]], R.cream[3]);
      fill(f, M((x, y) => f.get(x, y) && f.get(x, y) !== INK && R.dark.includes(f.get(x, y)) && (!f.get(x, y - 1) || f.get(x, y - 1) === INK) && y <= 6 && x >= 8), R.chips[6]);
      fill(f, M((x, y) => (y === 17 && x >= 13 && x <= 18)), R.chips[6]);
      const sp = emboss(Mask.rows(A.kit.PIP7.S), R.chips, { cap: 2.2, base: 5, gain: 4.2 }), p = new Bmp(9, 9); p.blit(sp, 1, 1); p.outline(INK); f.blit(p, 13, 0);
      return finish(f);
    },
  });

  // ---- Red-Handed: a sheepish jester caught with both hands up, palms glowing mult red, a fan of heart and diamond
  // cards still peeking out from behind his back. Dark maroon ground.
  A.joker('redhanded', {
    rarity: 'uncommon',
    ground: ['#2C0918', '#3A0D20', '#4A1229', '#5C1832'], glow: [15, 14, 10], speck: [R.mult[6], R.cream[6]],
    ...lit({
      draw(k) {
        const f = new Bmp(W, W);
        // the cards fanned out from behind his back
        [[17, 19, 'D'], [20, 18, 'H'], [23, 18, 'D']].forEach(([x, y, s], i) => { const c = card(7, 10); c.blit(pip(s, R.red), 2, 3); f.blit(c, x, y + i); });
        // tunic, and arms up: upper arms out, forearms straight up
        put(f, rr(9, 21, 21, 34, 5), R.vio, { cap: 3, base: 4, gain: 4 });
        put(f, union(seg([11, 23.5], [4.5, 22], 3.8), seg([4.5, 22.5], [4, 15], 3.6)), R.vio, { cap: 2, base: 4, gain: 4 });
        put(f, union(seg([19, 23.5], [26.5, 22], 3.8), seg([26.5, 22.5], [27, 15], 3.6)), R.vio, { cap: 2, base: 4, gain: 4 });
        // splayed red hands, thumbs in
        const hand = rows(['..X.X...', 'X.X.X.X.', 'X.X.X.X.', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXX.', '.XXXXX..', '..XXX...']);
        put(f, hand, R.mult, { cap: 1.4, base: 5, gain: 3.6 }, true, 0, 8);
        put(f, hand.flipX(), R.mult, { cap: 1.4, base: 5, gain: 3.6 }, true, 23, 8);
        // a pointed collar
        put(f, M((x, y) => y >= 19 && y <= 22 && x >= 10 && x <= 21 && (y <= 20 || Math.abs(((x - 10) % 4) - 1.5) <= (22 - y) * 0.9)), R.cream.slice(1), { cap: 1, base: 5, gain: 3 });
        // the head: brows up, eyes sliding sideways, a wobbly grimace, a bead of sweat
        skin(f, ell(15.5, 13.5, 6, 6), SKIN.tan);
        dots(f, [[11, 10], [12, 9], [18, 9], [19, 10]], FACE.brow);
        dots(f, [[12, 12], [13, 12], [18, 12], [19, 12], [12, 13], [18, 13]], C.white);
        dots(f, [[12, 12], [12, 13], [18, 12], [18, 13]], INK);
        dots(f, [[13, 16], [14, 17], [15, 16], [16, 17], [17, 16], [18, 17]], INK);
        dots(f, [[10, 15], [11, 15], [20, 15], [21, 15]], FACE.blush);
        dots(f, [[9, 9], [9, 10], [8, 10]], R.ghost[5]);
        // the cap: one long floppy prong falling to his left, a bell at its tip
        put(f, M((x, y) => y >= 7 && y <= 8 && x >= 10 && x <= 21), R.pink, { cap: 1, base: 5, gain: 3 });
        prong(f, [15.5, 7], [17, -1], [24, 2], R.pink, 6.4, 2.6);
        f.blit(bell(1.5), 23, 1);
        return finish(f);
      },
    }, (k, b, free) => {
      // the red glow round both palms, in two steps
      [[3, 12], [27, 12]].forEach(([cx, cy]) => {
        for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) {
          const d = Math.hypot(x - cx, (y - cy) * 0.9);
          if (d <= 6.2) glowAt(b, free, [[x, y]], d <= 4.6 ? '#FF5A4A70' : '#FF5A4A38');
        }
      });
    }),
  });

  // ---- Conga Line: three big jesters in profile dancing up a rising diagonal like a Straight, each with both hands on
  // the waist of the one ahead and the back leg kicked out in unison; a fourth is cut off by the left edge and the
  // front one's arm runs off the right, so the line goes on off the card. The front one's cap trails a lime streamer.
  // Burnt-orange ground.
  A.joker('congaline', {
    rarity: 'uncommon',
    ground: ['#6A2610', '#843014', '#9C3C18', '#B2481C'], glow: [16, 15, 13], speck: [R.money[6], R.cream[6]],
    draw(k) {
      const f = new Bmp(W, W);
      const TIGHTS = R.dark.slice(1), SHOE = R.plum.slice(2);
      /** One dancer facing right, the standing foot at (fx, fy), drawn as one inked sticker over the ones ahead. */
      const dancer = (fx, fy, o) => {
        const d = new Bmp(W, W), sh = { cap: 1, gain: 3 };
        // the back leg kicked out at 45 degrees, the standing leg, the shoes
        put(d, union(seg([fx - 0.5, fy - 6.5], [fx - 4, fy - 3], 2.4), rr(fx, fy - 6, fx + 1, fy - 1)), TIGHTS, { ...sh, base: 3 }, false);
        put(d, union(rr(fx - 6, fy - 3, fx - 4, fy - 2, 1), rr(fx, fy - 1, fx + 3, fy)), SHOE, { ...sh, base: 3 }, false);
        // the tunic in one flat colour, the arm reaching forward and its hand
        put(d, union(rr(fx - 2, fy - 12, fx + 3, fy - 5, 2), seg([fx + 1.5, fy - 10.5], o.reach, 2.4)), o.tunic, { cap: 2, base: o.tunic.length - 4, gain: 3 }, false);
        put(d, circ(o.reach[0] + 0.8, o.reach[1], 1.3), o.skin, { ...sh, base: 4 }, false);
        // the head in profile with a nose bump, a small cap on the crown and its one floppy point swinging back
        put(d, union(circ(fx + 1, fy - 16, 3.7), circ(fx + 4.8, fy - 16.6, 1.1)), o.skin, { cap: 2.4, base: 3, gain: 3.4 }, false);
        put(d, union(quad([fx + 0.5, fy - 20], [fx - 3, fy - 22], o.tip, (t) => 3.8 - t * 1.8), ell(fx + 1, fy - 19.6, 3.4, 1.4)), o.cap, { cap: 1.4, base: o.cap.length - 4, gain: 3.4 }, false);
        d.outline(INK);
        // the face: an eye, an open O mouth, a blush; a little bell at the cap's tip
        dots(d, [[fx + 3, fy - 17], [fx + 3, fy - 16]], INK);
        dots(d, [[fx + 3, fy - 14], [fx + 4, fy - 14]], FACE.throat); dots(d, [[fx + 3, fy - 13], [fx + 4, fy - 13]], INK);
        dots(d, [[fx, fy - 15], [fx + 1, fy - 15]], FACE.blush);
        const b = new Bmp(5, 5); b.draw(['ab', 'bc'], 1, 1, { a: R.gold[5], b: R.gold[4], c: R.gold[2] }); d.blit(b.outline(INK), Math.round(o.tip[0]) - 3, Math.round(o.tip[1]) - 1);
        f.blit(d, 0, 0);
      };
      // front to back, so each hand lies on the back of the dancer ahead
      dancer(24, 22, { tunic: R.pink, cap: R.vio, skin: SKIN.tan, reach: [31, 11], tip: [19, 2.5] });
      dancer(14, 26, { tunic: R.chips, cap: R.cream.slice(1), skin: SKIN.deep, reach: [21, 15.5], tip: [9, 8] });
      dancer(4, 30, { tunic: R.cream.slice(1), cap: R.pink, skin: SKIN.pale, reach: [11, 19.5], tip: [-1, 12] });
      dancer(-4, 35, { tunic: R.lime, cap: R.pink, skin: SKIN.gold, reach: [1.5, 24], tip: [-9, 17] });
      // the lime streamer from the front cap's tip, one clean S over the line
      put(f, union(quad([17, 2.5], [13, -1.5], [9, 2], 2), quad([9, 2], [5, 5.5], [-1, 4], 2)), R.lime, { cap: 1, base: 5, gain: 3 });
      return finish(f);
    },
  });

  // ---- Moneybags: a fat plum money sack that is a character: its gathered top flops into a jester's two belled
  // points, round coins peek out of the drawstring, and on its belly a smug face balances one coin on its nose, both
  // eyes crossed up at it. No $. Wine ground, lifted so the sack stands out.
  A.joker('moneybags', {
    rarity: 'uncommon',
    ground: ['#42101C', '#5A1828', '#78223A', '#96304C'], glow: [15, 19, 12], speck: [R.money[6], R.pink[6]],
    draw(k) {
      const f = new Bmp(W, W), P = PLUM;
      // the gathered top flopping into two points, a bell on each
      prong(f, [13, 10], [8, 3], [4, 7], P, 5, 2.4, true);
      prong(f, [18, 10], [23, 3], [27, 7], P, 5, 2.4, true);
      f.blit(bell(1.5), 1, 6); f.blit(bell(1.5), 25, 6);
      // round coins peeking up out of the neck
      f.blit(coin(2), 9, 5); f.blit(coin(3), 14, 2);
      // the fat round sack under its gathered neck, the cream drawstring pulled tight with a loose end
      put(f, union(circ(15.5, 21, 9.4), poly([[11, 9], [21, 9], [20, 13], [11, 13]])), P, { cap: 4, base: 4, gain: 4 });
      fill(f, M((x, y) => y >= 9 && y <= 10 && (x === 13 || x === 17)), P[2]);
      put(f, rr(9, 11, 22, 12), R.cream.slice(1), { cap: 1, base: 4, gain: 3 });
      put(f, quad([21, 12.5], [24, 14], [23, 17], 1.6), R.cream.slice(1), { cap: 1, base: 4, gain: 3 });
      // its face: eyes crossed up at the coin balanced on its little nose, a smug closed smile
      const E = (x, y, px) => { f.rect(x, y, 2, 3, C.white); f.set(x, y + 2, INK); f.set(x + 1, y + 2, INK); f.rect(px, y, 1, 2, INK); };
      E(10, 19, 11); E(20, 19, 20);
      dots(f, [[9, 18], [10, 17], [11, 17]], P[1]); dots(f, [[20, 17], [21, 17], [22, 18]], P[1]);
      put(f, ell(15.5, 21, 1.4, 1.8), P.slice(2), { cap: 1, base: 4, gain: 3 });
      f.blit(coin(3), 11, 11);
      dots(f, [[12, 25], [13, 26], [14, 26], [15, 26], [16, 26], [17, 26], [18, 25], [19, 24]], P[0]);
      dots(f, [[9, 23], [10, 23], [21, 23], [22, 23]], R.pink[4]);
      return finish(f);
    },
  });

  // ---- Opening Act: a small jester in a three-point cap stepping out through a gap in maroon velvet curtains, a cream
  // card held high, in a beam of ember-orange light. Plum ground.
  A.joker('openingact', {
    rarity: 'uncommon',
    ground: ['#24102A', '#2E1534', '#3A1B40', '#46214C'], glow: [15, 22, 7], speck: [R.ember[6], R.cream[6]],
    ...lit({
      draw(k) {
        const f = new Bmp(W, W), MR = R.maroon.slice(0, 7);
        const pleat = (x) => (((x % 4) + 4) % 4 < 2 ? 0.8 : -0.7);
        // the stage boards, a pool of the spotlight on them
        put(f, rr(0, 28, 30, 30), R.wood, { cap: 1, base: 3, gain: 3 }, false);
        fill(f, M((x, y) => y === 28), R.wood[5]);
        fill(f, M((x, y) => y >= 28 && Math.abs(x + 0.5 - 15.5) <= 8 - (y - 28)), R.ember[6]);
        fill(f, M((x, y) => y === 28 && Math.abs(x + 0.5 - 15.5) <= 6), R.ember[7]);
        // the drapes, pulled back to the sides
        put(f, poly([[0, 0], [9, 0], [6, 10], [3, 19], [5, 28], [0, 28]]), MR, { cap: 3, base: 2, gain: 3, tilt: (x) => pleat(x) });
        put(f, poly([[22, 0], [31, 0], [31, 28], [26, 28], [28, 19], [25, 10]]), MR, { cap: 3, base: 2, gain: 3, tilt: (x) => pleat(x + 1) });
        put(f, M((x, y) => y <= 1 || (y === 2 && ((x + 1) % 5) > 1)), MR.slice(1), { cap: 1.5, base: 2, gain: 3 });
        // the jester stepping out: legs mid-stride in pink tights, a lime tunic, one arm thrown wide
        put(f, union(seg([14, 23], [11, 27], 2.6), seg([17, 23], [20, 27], 2.6)), R.pink, { cap: 1, base: 4, gain: 3 });
        put(f, union(rr(9, 26, 12, 27, 1), rr(19, 26, 22, 27, 1)), R.plum.slice(2), { cap: 1, base: 3, gain: 3 });
        put(f, seg([12, 18], [7, 15], 2.8), R.lime, { cap: 1, base: 5, gain: 3 });
        skin(f, circ(6.5, 14.5, 1.5), SKIN.pale, { cap: 1, base: 4 });
        put(f, poly([[10, 17], [21, 17], [23, 24], [8, 24]]), R.lime, { cap: 2, base: 5, gain: 3.6 });
        fill(f, M((x, y) => y === 23 && x >= 9 && x <= 22 && x % 3 === 0), R.pink[5]);
        // the raised arm and the card held high in the light
        put(f, seg([19, 18], [22, 10], 2.8), R.lime, { cap: 1, base: 5, gain: 3 });
        const c = card(7, 9); c.blit(pip('H', R.red), 2, 3); f.blit(c, 19, 1);
        skin(f, rr(21, 8, 23, 10, 1), SKIN.pale, { cap: 1, base: 4 });
        ruff(f, [12, 15, 18], 17, 2.1);
        // the head: wide eyes on the crowd, a big hello of a smile; a three-point cap, a bell on each point
        skin(f, circ(15.5, 12, 4.6), SKIN.pale, { cap: 2.8 });
        eye(f, 13, 11, 'l'); eye(f, 17, 11, 'l');
        fill(f, M((x, y) => y >= 14 && y <= 15 && Math.abs(x - 15.5) <= 2.5 - (y - 14)), FACE.throat);
        fill(f, M((x, y) => y === 14 && Math.abs(x - 15.5) <= 2.5), C.white);
        dots(f, [[12, 14], [19, 14]], FACE.blush);
        put(f, union(ell(15.5, 7.8, 4.8, 1.6), quad([12, 7.5], [9, 3.5], [7.5, 6], (t) => 3.2 - t * 1.4), quad([15, 7], [13, 2.5], [11.5, 1.5], (t) => 3.2 - t * 1.4), quad([18.5, 7.5], [19.5, 3], [17.5, 1], (t) => 3 - t * 1.4)), R.pink, { cap: 1.4, base: 5, gain: 3.4 });
        f.blit(bell(1.5), 5, 5); f.blit(bell(1.5), 9, 0); f.blit(bell(1.5), 15, -1);
        return finish(f);
      },
    }, (k, b, free) => {
      // the beam: a hard-edged cone of ember light from the top onto him
      for (let y = 2; y < 28; y++) for (let x = 0; x < 31; x++) {
        const hw = 3.5 + (y - 2) * 0.24, d = Math.abs(x + 0.5 - 15.5);
        if (d <= hw) glowAt(b, free, [[x, y]], d <= hw - 2.5 ? '#FFB06878' : '#FFA45838');
      }
    }),
  });

  // ---- Final Bow: a jester in strict side profile folded into a deep bow, an upside-down L: straight legs in pink and
  // cream tights, a level back in two motley colours, the head hanging below the shoulders (eyes shut, smiling), the
  // near arm folded across his waist, the far arm swept back and up to an open hand; both cap points hang straight
  // down, their bells on the boards. A maroon curtain hem with a gold fringe drops across the top; a few gold sparks.
  // Maroon ground.
  A.joker('finalbow', {
    rarity: 'uncommon',
    ground: ['#4A0E16', '#5E141C', '#721A22', '#86222A'], glow: [15, 16, 12], speck: [R.gold[5], R.money[7]],
    ...lit({
      draw(k) {
        const f = new Bmp(W, W);
        // the boards, a lit lip
        put(f, rr(0, 26, 30, 30), R.wood.slice(0, 6), { cap: 1.4, base: 2, gain: 3 });
        fill(f, M((x, y) => y === 26 && x >= 1 && x <= 29), R.wood[4]);
        dots(f, [[7, 28], [7, 29], [16, 27], [16, 28], [26, 28], [26, 29]], R.wood[1]);
        // the legs, straight and side by side: far leg pink, near leg cream; shoes on the boards, pointing left
        put(f, rr(20, 12, 21, 23), R.pink, { cap: 1, base: 4, gain: 3 });
        put(f, rr(23, 12, 24, 23), R.cream.slice(1), { cap: 1, base: 4, gain: 3 });
        put(f, union(rr(17, 24, 21, 25, 1), rr(20, 24, 24, 25, 1)), R.plum.slice(2), { cap: 1, base: 3, gain: 3 });
        // the far arm swept back and up behind him, an open hand at its end
        put(f, quad([13, 9], [18, 6], [24, 6], 2.4), R.vio, { cap: 1, base: 5, gain: 3 });
        hand(f, 'open', 24, 3, SKIN.tan, { flip: true });
        // the back: a level slab from the hips to the shoulders, split lengthwise into two motley colours
        put(f, rr(10, 9, 25, 13, 2), R.vio, { cap: 2, base: 5, gain: 3.4 });
        fill(f, M((x, y) => y >= 11 && y <= 12 && x >= 11 && x <= 24 && !(x === 24 && y === 12)), R.lime[5]);
        fill(f, M((x, y) => y === 13 && x >= 12 && x <= 23), R.lime[3]);
        // the near arm folded across his waist
        put(f, quad([13, 12], [15, 16.5], [19, 14.5], 2.4), R.vio, { cap: 1, base: 5, gain: 3 });
        skin(f, rr(18, 13, 20, 15, 1), SKIN.tan, { cap: 1, base: 4, gain: 3 });
        // the head hanging below the shoulders, in profile, nose to the boards: an eye shut, a smile
        ruff(f, [10, 13], 13.5, 1.9);
        skin(f, union(circ(8.5, 17, 4.2), circ(7, 21.4, 1.1)), SKIN.tan, { cap: 2.6 });
        dots(f, [[7, 17], [8, 18], [9, 18], [10, 17]], INK);
        dots(f, [[9, 20], [10, 20], [11, 19]], FACE.mouth);
        dots(f, [[10, 17], [11, 17]], FACE.blush);
        // the cap on his crown, its two points hanging straight down, the bells resting on the boards
        put(f, union(ell(5, 16.2, 1.2, 2.6), quad([4.5, 18], [3.5, 20.5], [3.5, 23], (t) => 2.4 - t * 0.6), quad([6, 18.5], [6.5, 21], [7.5, 23], (t) => 2.2 - t * 0.6)), R.pink, { cap: 1.2, base: 5, gain: 3.2 });
        f.blit(bell(1.5), 1, 21); f.blit(bell(1.5), 6, 21);
        // the curtain hem across the top, a gold fringe under it
        const pleat = (x) => (((x % 4) + 4) % 4 < 2 ? 0.7 : -0.6);
        put(f, rr(0, 0, 30, 2), R.maroon.slice(1), { cap: 1.4, base: 3, gain: 3, tilt: (x) => pleat(x) });
        fill(f, M((x, y) => y === 3), R.gold[3]);
        fill(f, M((x, y) => y === 3 && x % 4 === 1), R.gold[5]);
        fill(f, M((x, y) => y === 4 && x % 2 === 0), R.gold[4]);
        return finish(f);
      },
    }, (k, b, free) => {
      // three gold sparks drifting down
      [[3, 9, 1], [28, 15, 0], [16, 21, 0]].forEach(([x, y, big]) => sparkle(b, free, x, y, R.gold[4], !!big));
    }),
  });

  // ---- Chimney Sweep: a soot-smudged sweep in a battered top hat and a pointed jester collar popping out of a plum
  // brick chimney, his round brush raised; three discarded cards tumble out of a charcoal puff of soot. Burnt-orange
  // ground.
  A.joker('chimneysweep', {
    rarity: 'uncommon',
    ground: ['#7E3412', '#9A4116', '#B24E1A', '#C85C20'], glow: [15, 12, 11], speck: [R.ember[7], R.cream[5]],
    draw(k) {
      const f = new Bmp(W, W);
      // a charcoal puff of soot, three cards tumbling out of it
      put(f, union(circ(4, 11, 3.8), circ(5, 5, 3.2), circ(2, 16, 2.4), circ(8, 9, 2.4)), R.dark.slice(1, 6), { cap: 2, base: 2, gain: 3 });
      // the brush: a pole up to a round head of black bristles
      put(f, seg([22, 15], [26, 6], 1.6), R.wood, { cap: 1, base: 4, gain: 3 });
      put(f, M((x, y) => { const d = Math.hypot(x - 26.5, y - 4), a = Math.atan2(y - 4, x - 26.5); return d <= 2.6 + (Math.cos(a * 6) > 0.2 ? 1.8 : 0); }), R.dark.slice(0, 6), { cap: 1.2, base: 2, gain: 3.4 });
      dots(f, [[26, 4], [27, 4], [26, 3]], R.dark[0]);
      // shoulders in a sooty coat, the pointed lime jester collar
      put(f, rr(7, 17, 24, 26, 4), R.plum.slice(1), { cap: 2, base: 3, gain: 3.4 });
      put(f, M((x, y) => y >= 16 && y <= 19 && x >= 9 && x <= 22 && (y <= 17 || Math.abs(((x - 9) % 4) - 1.5) <= (19 - y) * 0.9)), R.lime, { cap: 1, base: 5, gain: 3 });
      // the near arm raising the brush, a fist round the pole
      put(f, seg([20, 20], [23, 15], 3), R.plum.slice(1), { cap: 1, base: 3, gain: 3 });
      hand(f, 'fist', 21, 13, SKIN.pale);
      // the head: sooty smudges, white eyes, a grin
      skin(f, circ(15.5, 12, 5), SKIN.pale, { cap: 3 });
      dots(f, [[11, 13], [12, 14], [18, 9], [19, 10], [13, 16]], R.dark[3]);
      dots(f, [[12, 13], [17, 15]], R.dark[2]);
      dots(f, [[12, 11], [13, 11], [17, 11], [18, 11]], C.white);
      dots(f, [[13, 11], [18, 11]], INK);
      dots(f, [[13, 14], [14, 15], [15, 15], [16, 15], [17, 14]], FACE.mouth);
      dots(f, [[14, 14], [15, 14], [16, 14]], C.white);
      // the battered top hat, a red band
      put(f, union(poly([[10, 0], [20, 1], [19, 7], [11, 7]]), rr(8, 6, 22, 7)), R.dark, { cap: 2, base: 1, gain: 3 });
      fill(f, M((x, y) => y === 5 && x >= 11 && x <= 19), R.mult[4]);
      // the chimney: a plum brick stack with a lit coping, his far hand gripping its edge
      put(f, rr(6, 22, 25, 31), R.plum.slice(2), { cap: 2, base: 3, gain: 3 });
      for (let y = 25; y <= 30; y += 3) fill(f, M((x, yy) => yy === y && x >= 7 && x <= 24), R.plum[2]);
      [[11, 23], [19, 23], [8, 26], [15, 26], [22, 26], [11, 29], [19, 29]].forEach(([x, y]) => { f.set(x, y, R.plum[2]); f.set(x, y + 1, R.plum[2]); });
      put(f, rr(4, 20, 27, 22), R.plum.slice(3), { cap: 1.5, base: 3, gain: 3.4 });
      skin(f, rr(5, 18, 8, 21, 1), SKIN.pale, { cap: 1, base: 3 });
      // three discarded cards tumbling up out of the soot
      const card5 = (x, y, s) => { const c = card(5, 7); c.blit(pip(s, s === 'H' || s === 'D' ? R.red : R.dark), 1, 2); f.blit(c, x, y); };
      card5(0, 9, 'C'); card5(6, 3, 'D'); card5(0, -1, 'H');
      return finish(f);
    },
  });

  // ---- Gold Tooth: a rogue jester in three-quarter view turned right, head tipped back mid-laugh, eyes squeezed shut,
  // his open mouth showing one solid gold front tooth with a white twinkle, the brightest spot on the card; an Ace of
  // Spades tucked behind his ear, one long cap point hanging down his back to its bell. Red-violet ground (his own:
  // chip blue is Lit's Paperclip's), and no ruff (a row of frills under the face read as a second set of teeth).
  A.joker('goldtooth', {
    rarity: 'uncommon',
    ground: ['#4A1240', '#5C1850', '#6E1E60', '#802670'], glow: [16, 13, 13], speck: [R.money[6], R.cream[6]],
    draw(k) {
      const f = new Bmp(W, W), S = SKIN.gold;
      // the cap's one long point, hanging down his back to its bell
      put(f, quad([6, 4], [1, 9], [2, 21], (t) => 4.4 - t * 2.2), R.lime, { cap: 1.6, base: 5, gain: 3.4 });
      f.blit(bell(), 0, 21);
      // shoulders in ember and pink motley, which are his collar, the neck stretched back
      put(f, rr(5, 25, 28, 34, 6), R.ember, { cap: 3, base: 4, gain: 3.4 });
      fill(f, M((x, y) => y >= 27 && x >= 17 && x <= 27 && f.get(x, y) && f.get(x, y) !== INK), R.pink[5]);
      skin(f, rr(11, 18, 18, 25, 2), S, { cap: 2, base: 2, gain: 3 });
      // the head tipped back: the skull, the face turned up and right, the jaw dropped open
      const head = union(ell(15, 11.5, 7.6, 7.2), poly([[11, 17], [17, 21.5], [22.5, 19.5], [24, 14], [21, 9]]), circ(23.4, 10.6, 1.4));
      skin(f, head, S, { cap: 3.4 });
      // the open laugh, tilted with the head: the upper lip line, a row of teeth, the throat, the tongue
      const mouth = poly([[16, 15], [23, 12.6], [23.4, 15.6], [21.6, 18.4], [17.6, 19]]);
      fill(f, mouth, FACE.throat);
      fill(f, M((x, y) => mouth.get(x, y) && !mouth.get(x, y - 1)), C.white);
      fill(f, M((x, y) => mouth.get(x, y) && !mouth.get(x, y + 1) && x >= 18 && x <= 21), FACE.tongue);
      fill(f, M((x, y) => mouth.get(x, y) && !mouth.get(x, y + 1) && !mouth.get(x, y + 2) && x >= 19 && x <= 20), FACE.tongueHi);
      fill(f, M((x, y) => !mouth.get(x, y) && mouth.get(x, y + 1) && head.get(x, y)), FACE.mouth);
      // the gold tooth among the top teeth: a 3 x 3 block, flat yellow on an amber foot, one glint
      f.rect(19, 14, 3, 2, R.money[5]); f.rect(19, 16, 3, 1, R.money[3]); f.set(19, 14, C.white); f.set(20, 14, R.money[7]);
      // eyes squeezed shut with laughter, tilted with the head; brows up; cheeks pushed up
      dots(f, [[14, 10], [15, 9], [16, 9], [17, 10]], INK);
      dots(f, [[20, 8], [21, 7], [22, 8]], INK);
      brow(f, [[14, 7], [15, 6], [16, 6], [20, 5], [21, 5]]);
      dots(f, [[14, 12], [15, 12], [16, 13]], FACE.blush);
      // the Ace of Spades tucked behind his ear: an A over a little spade
      const ace = card(7, 13); glyph(ace, 'A', 2, 2, INK); ace.blit(pip('S', R.dark), 2, 9); f.blit(ace, 2, 0);
      skin(f, ell(9.6, 14.6, 1.8, 2.6), S, { cap: 1.4, base: 3, gain: 3.4 });
      dots(f, [[10, 14], [10, 15]], S[2]);
      // the cap's band, pushed back on his head
      put(f, M((x, y) => { const yy = y + (x - 12) * 0.25; return yy >= 3.4 && yy <= 5.6 && x >= 11 && x <= 20; }), R.lime, { cap: 1.2, base: 5, gain: 3 });
      return finish(f);
    },
    overlay(k, b) {
      // a twinkle on the gold tooth, crossing the upper lip: the brightest spot on the card
      const X = (x) => x + 5, Y = (y) => y + 7;
      b.set(X(21), Y(13), C.white); [[20, 13], [22, 13], [21, 12], [21, 14]].forEach(([x, y]) => b.set(X(x), Y(y), '#FFF6C8'));
    },
  });

  // ---- Old Stager: an old jester stooped over a crooked cane gripped by its crook, a long white beard down to his belt,
  // in faded but warm motley (rose and ember halves, one paler pink patch); his faded plum cap has a band of four gold
  // stars and two long thin points hanging past his shoulders, their bells tarnished lime; a glint in one eye under
  // bushy white brows. Maroon ground.
  A.joker('oldstager', {
    rarity: 'uncommon',
    ground: ['#4A1226', '#5E1830', '#74203C', '#8A2848'], glow: [14, 13, 12], speck: [R.gold[5], R.lime[4]],
    draw(k) {
      const f = new Bmp(W, W);
      const ROSE = ['#3A1020', '#5A1A30', '#7A2A44', '#9A3C58', '#B4566E', '#CA7286', '#DE96A4'];
      const RUST = ['#3A1408', '#5A2210', '#7E3418', '#A04A22', '#BC6232', '#D27E48', '#E49C66'];
      // the cane: a long stick with a clear crook at the top
      put(f, union(seg([25.5, 30], [25.5, 15], 2), quad([25.5, 15], [25.5, 10.5], [28.5, 10.5], 2), seg([28.5, 10.5], [29, 13.5], 2)), R.wood, { cap: 1, base: 4, gain: 3 });
      dots(f, [[25, 21], [25, 26]], R.wood[2]);
      // the stooped body in faded motley: rose on his right, rust on his left, one paler pink patch
      put(f, rr(4, 17, 22, 34, 6), ROSE, { cap: 3, base: 4, gain: 3.2 });
      for (let y = 18; y < W; y++) for (let x = 13; x < W; x++) { const i = ROSE.indexOf(f.get(x, y)); if (i >= 0) f.set(x, y, RUST[i]); }
      f.rect(6, 23, 5, 5, R.pink[6]); f.rect(7, 24, 3, 3, R.pink[7]);
      [[6, 23], [8, 23], [10, 23], [6, 25], [10, 25], [6, 27], [8, 27], [10, 27]].forEach(([x, y]) => f.set(x, y, R.pink[4]));
      // the near arm out to the cane, a knobbly hand gripping the crook
      put(f, quad([18, 21], [22, 19], [24, 14], 3.2), RUST, { cap: 1.6, base: 4, gain: 3 });
      skin(f, rr(23, 11, 27, 15, 2), SKIN.pale, { cap: 1.4, base: 3 });
      dots(f, [[24, 13], [25, 13]], SKIN.pale[2]);
      // the long white beard, forked at the tip
      put(f, poly([[8, 13], [20, 13], [19, 21], [16, 29], [14.5, 26], [13, 29], [9, 21]]), R.cream.slice(2), { cap: 2.6, base: 4, gain: 3.4 });
      dots(f, [[12, 19], [12, 22], [16, 20], [16, 23], [14, 25]], R.cream[3]);
      // the face: kind crinkled eyes (a glint in one) under bushy white brows, a round nose, a drooping moustache
      skin(f, ell(14, 10.5, 5.8, 4.6), SKIN.pale, { cap: 3 });
      dots(f, [[10, 10], [11, 11], [12, 10]], INK);
      eye(f, 16, 10, 'l');
      dots(f, [[9, 12], [19, 12]], FACE.blush);
      put(f, union(rr(9, 7, 12, 8, 1), rr(16, 7, 19, 8, 1)), R.cream.slice(4), { cap: 1, base: 2, gain: 2 });
      put(f, union(quad([14, 14], [10, 13.5], [8.5, 16], 2.4), quad([14, 14], [18, 13.5], [19.5, 16], 2.4)), R.cream.slice(3), { cap: 1, base: 3, gain: 3 });
      put(f, circ(14, 12.5, 1.6), SKIN.pale, { cap: 1, base: 4, gain: 3 });
      // the faded plum cap: two long thin points hanging past his shoulders to tarnished lime bells
      const FP = ['#2E1028', '#44183C', '#5C2450', '#763464', '#904678', '#A85C8C', '#C078A2'];
      prong(f, [9.5, 4.5], [2.5, 3], [2, 18], FP, 3.6, 1.8, true);
      prong(f, [18.5, 4.5], [26.5, 3], [22.5, 17], FP, 3.6, 1.8, true);
      put(f, ell(14, 3.6, 6.4, 3), FP, { cap: 2, base: 4, gain: 3.4 });
      // the band, with four plus-shaped gold stars on it
      put(f, rr(7, 5, 21, 7), FP.slice(1), { cap: 1, base: 2, gain: 3 });
      [9, 12, 15, 18].forEach((x, i) => { const y = 6; f.set(x + (i > 1 ? 1 : 0), y, R.gold[5]); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => f.set(x + (i > 1 ? 1 : 0) + dx, y + dy, R.gold[3])); });
      const tb = (x, y) => { const t = new Bmp(6, 6); t.blit(emboss(disc(1.5), R.lime.slice(1, 6), { cap: 1.5, base: 2, gain: 3 }), 1, 1); t.set(2, 2, R.lime[5]); f.blit(t.outline(INK), x, y); };
      tb(0, 17); tb(20, 16);
      return finish(f, [[16, 10]]);
    },
  });

  // ---- Lamplighter: a jester on tiptoe in a lamplighter's peaked cap (one bell at its back) reaching a long brass taper
  // up to a heart-shaped street lamp, the lamp flaring ember orange. Indigo ground.
  A.joker('lamplighter', {
    rarity: 'uncommon',
    ground: ['#1E1438', '#281A48', '#322058', '#3E2868'], glow: [22, 7, 9], speck: [R.ember[6], R.money[7]],
    ...lit({
      draw(k) {
        const f = new Bmp(W, W);
        // the lamppost, iron, with a cross-arm
        put(f, union(rr(25, 12, 26, 31), rr(24, 29, 28, 31)), R.dark, { cap: 1, base: 2, gain: 3 });
        // the heart-shaped lamp: an iron cap, a glowing heart of glass
        const heart = M((x, y) => { const X = (x - 23) / 5.4, Y = (7 - y) / 5.2; const a = X * X + Y * Y - 1; return a * a * a - X * X * Y * Y * Y <= 0; });
        put(f, heart, R.ember.slice(2), { cap: 2.4, base: 4, gain: 3.4 });
        put(f, M((x, y) => { const X = (x - 23) / 3, Y = (6.5 - y) / 2.8; const a = X * X + Y * Y - 1; return a * a * a - X * X * Y * Y * Y <= 0; }), R.money.slice(4), { cap: 1, base: 2, gain: 2 }, false);
        put(f, union(rr(21, 0, 25, 1), rr(22, 2, 24, 2)), R.dark, { cap: 1, base: 3, gain: 3 });
        put(f, rr(22, 12, 24, 13), R.dark, { cap: 1, base: 3, gain: 3 });
        // the jester on tiptoe: one leg stretched down to its toe, the other kicked up behind
        put(f, union(seg([8, 22], [8.5, 30], 2.4), seg([6, 22], [2, 25.5], 2.4)), R.pink, { cap: 1, base: 4, gain: 3 });
        put(f, union(rr(8, 29, 10, 30), rr(0, 25, 2, 27)), R.plum.slice(2), { cap: 1, base: 3, gain: 3 });
        put(f, rr(4, 15, 11, 23, 3), R.chips, { cap: 2, base: 5, gain: 3.6 });
        // the long brass taper held up in both hands, its wick touching the lamp
        put(f, seg([10, 21], [19.5, 10], 1.6), R.brass, { cap: 1, base: 4, gain: 3 });
        dots(f, [[19, 9], [20, 9], [20, 10]], R.ember[6]);
        put(f, union(seg([9, 17], [13, 17], 2.4), seg([6, 18], [11, 20], 2.4)), R.chips, { cap: 1, base: 5, gain: 3 });
        skin(f, union(circ(13.5, 16.5, 1.5), circ(11.5, 19.5, 1.5)), SKIN.gold, { cap: 1, base: 4 });
        ruff(f, [5, 8, 11], 15, 1.8);
        // the head tipped back, eyes on the flame
        skin(f, circ(8, 10.5, 4.2), SKIN.gold, { cap: 2.8 });
        dots(f, [[10, 9], [11, 9], [10, 10]], INK);
        dots(f, [[10, 12], [11, 12], [12, 11]], FACE.mouth);
        dots(f, [[7, 12], [8, 12]], FACE.blush);
        // a lamplighter's peaked cap: a round crown, a stiff peak jutting toward the lamp, one bell at the back
        put(f, union(ell(7.4, 6, 4.8, 2.6), poly([[9, 6.5], [14, 5.5], [14, 7.5], [9, 8]])), R.lime, { cap: 1.4, base: 5, gain: 3.4 });
        fill(f, M((x, y) => y === 7 && x >= 4 && x <= 10), R.lime[2]);
        f.blit(bell(1.5), 0, 6);
        return finish(f);
      },
    }, (k, b, free) => {
      // the lamp's flare: two steps of ember light round the heart
      for (let y = 0; y < 20; y++) for (let x = 12; x < 31; x++) {
        const d = Math.hypot(x - 23, (y - 7) * 1.05);
        if (d <= 10) glowAt(b, free, [[x, y]], d <= 7.6 ? '#FF7A2B60' : '#FF7A2B2C');
      }
    }),
  });

  // ---- Fan Dancer: a dancer turned three-quarter to the left, hip out, her pink and cream skirt flaring; she holds a
  // fan of four heart cards up and out at arm's length beside her head like a feather fan, spread a quarter turn, her
  // face clear of it with a coy wink; the gold bell on her cap catches a white glint. Maroon ground.
  A.joker('fandancer', {
    rarity: 'uncommon',
    ground: ['#4E1230', '#62183C', '#761E48', '#8A2654'], glow: [14, 14, 12], speck: [R.pink[6], R.money[7]],
    draw(k) {
      const f = new Bmp(W, W), S = SKIN.tan;
      // the fan of four hearts, spread a quarter turn from her raised hand
      const P = [20.5, 13];
      [0, 30, 60, 90].forEach((deg) => {
        const a = (deg * Math.PI) / 180, s = Math.sin(a), c = Math.cos(a);
        const at = (u, v) => [P[0] + u * c + v * s, P[1] + u * s - v * c];
        cardQuad(f, [at(-3.4, 2), at(3.4, 2), at(3.4, 13.5), at(-3.4, 13.5)]);
        const [hx, hy] = at(0, 10.2);
        f.blit(pip('H', R.red), Math.round(hx - 2.5), Math.round(hy - 2.5));
      });
      // the raised arm out to the fan, her hand at its pivot
      put(f, seg([15.5, 14.5], [19.5, 13.5], 2.4), SKIN.tan, { cap: 1, base: 4, gain: 3 });
      skin(f, circ(20.5, 13, 1.6), S, { cap: 1, base: 4, gain: 3 });
      // the skirt flaring out, pink and cream panels, the hip out to the right
      const skirt = poly([[10, 17], [17, 17], [24, 27], [16, 28.5], [8, 28], [4, 26]]);
      put(f, skirt, R.pink, { cap: 2.6, base: 5, gain: 3.4 });
      fill(f, M((x, y) => skirt.get(x, y) && y >= 19 && ((x * 2 - y + 40) % 8) < 3 && f.get(x, y) !== INK), R.cream[5]);
      // a leg below, its toe pointed
      put(f, union(seg([13, 28], [12, 30.5], 2.2)), R.cream.slice(1), { cap: 1, base: 4, gain: 3 });
      // the bodice, the other hand on her hip
      put(f, poly([[10, 11], [16, 11], [17, 18], [10, 18]]), R.pink.slice(1), { cap: 2, base: 5, gain: 3.4 });
      fill(f, M((x, y) => y === 17 && x >= 10 && x <= 17), R.gold[4]);
      put(f, union(seg([10.5, 12.5], [7, 15.5], 2.2), seg([7, 15.5], [10, 17.5], 2.2)), SKIN.tan, { cap: 1, base: 4, gain: 3 });
      // her head, turned three-quarter left: dark hair, a coy wink, a small smile
      put(f, union(ell(12.5, 7, 5.4, 5), ell(16.5, 9.5, 2, 3.4)), R.wood.slice(0, 5), { cap: 2.4, base: 2, gain: 3 });
      skin(f, ell(11.5, 8, 4, 4.4), S, { cap: 2.6 });
      dots(f, [[9, 7], [10, 6], [11, 7]], INK);
      eye(f, 13, 6, 'r'); dots(f, [[12, 5], [15, 5]], INK);
      dots(f, [[10, 10], [11, 11], [12, 10]], FACE.mouth);
      dots(f, [[8, 9], [14, 9]], FACE.blush);
      // her little cap and its one gold bell, a white glint on it
      put(f, ell(12.5, 2.6, 4.4, 1.8), R.cream.slice(1), { cap: 1.4, base: 5, gain: 3 });
      f.blit(bell(1.5), 4, 0);
      f.set(6, 1, C.white);
      put(f, quad([9.5, 2], [7, 0], [6.5, 2.5], (t) => 2.2 - t), R.cream.slice(1), { cap: 1, base: 5, gain: 3 });
      return finish(f, [[6, 1]]);
    },
  });

  // ---- Maypole: a striped maypole whirling with pink, lime, gold and chip-blue ribbons, a tiny jester swinging from
  // the longest one. Violet ground.
  A.joker('maypole', {
    rarity: 'uncommon',
    ground: ['#341470', '#3E1A84', '#482098', '#5428AC'], glow: [15, 13, 12], speck: [R.pink[6], R.lime[6], R.money[6]],
    draw(k) {
      const f = new Bmp(W, W);
      // the ribbons streaming from the crown of the pole
      const rib = (p1, p2, ramp, w = 2.2) => put(f, quad([15.5, 5], p1, p2, w), ramp, { cap: 1, base: ramp.length - 4, gain: 3 });
      rib([6, 4], [2, 16], R.pink);
      rib([25, 3], [29, 14], R.lime);
      rib([8, 14], [5, 26], R.money);
      rib([22, 12], [24, 21], R.chips);
      // the pole: cream and pink stripes winding down it, on a little green mound
      put(f, M((x, y) => y >= 28 && ((x - 15.5) / 9) ** 2 + ((y - 31) / 3) ** 2 <= 1), R.lime.slice(0, 6), { cap: 1.5, base: 3, gain: 3 });
      const pole = rr(14, 4, 17, 29);
      put(f, pole, R.cream.slice(1), { cap: 1.6, base: 4, gain: 3 });
      fill(f, M((x, y) => pole.get(x, y) && x >= 14 && x <= 17 && ((y + x) % 5 + 5) % 5 < 2), R.pink[4]);
      fill(f, M((x, y) => pole.get(x, y) && x === 17 && ((y + x) % 5 + 5) % 5 < 2), R.pink[3]);
      // the gold crown on top
      put(f, union(circ(15.5, 2.5, 2.2), rr(13, 4, 18, 5)), R.gold, { cap: 1.5, base: 4, gain: 3.6 });
      // the tiny jester swinging from the blue ribbon
      skin(f, circ(25, 22, 2.2), SKIN.tan, { cap: 1.6 });
      put(f, rr(23, 24, 27, 27, 1), R.pink, { cap: 1, base: 4, gain: 3 });
      put(f, union(seg([24, 27.5], [22.5, 29.5], 1.6), seg([26, 27.5], [28, 29], 1.6)), R.cream.slice(1), { cap: 1, base: 4, gain: 3 });
      put(f, seg([24.5, 20], [24, 18], 1.4), SKIN.tan, { cap: 1, base: 4, gain: 3 });
      prong(f, [25.5, 20.5], [28, 18], [29, 21], R.lime, 2.6, 1.4, true);
      dots(f, [[26, 22]], INK);
      return finish(f);
    },
  });

  // ---- Call and Response: two jesters in profile facing each other from either edge, mouths wide open, singing to
  // each other across the glow. A matching pair of 4s (portrait cards) glows above them, the call's card higher.
  // Different caps and tunics. No sound arcs: drawn between the mouths they read as the letters 'D' and 'C'.
  // Burnt-orange ground.
  A.joker('callandresponse', {
    rarity: 'uncommon',
    ground: ['#7A3A0C', '#94480E', '#AC5612', '#C26416'], glow: [15, 19, 9], speck: [R.cream[6], R.gold[5]],
    ...lit({
      draw(k) {
        const f = new Bmp(W, W);
        // a matching pair of 4s, the call's card higher
        const four = (x, y) => { const c = card(7, 9); glyph(c, '4', 2, 1, R.red[2]); f.blit(c, x, y); };
        four(5, 0); four(15, 3);
        // the call, on the left edge facing right: chip-blue shoulders, a cream ruff, a pink cap, its point down his back
        put(f, rr(-6, 26, 7, 34, 4), R.chips, { cap: 3, base: 5, gain: 3.4 });
        frills(f, [-1, 3, 7], 25.5, 2.2);
        skin(f, union(circ(1, 18, 7), circ(8.4, 16.6, 1.4)), SKIN.tan, { cap: 3.6 });
        put(f, union(ell(0.6, 11, 6, 2), circ(-2, 12, 2.4)), R.pink, { cap: 1.4, base: 5, gain: 3.2 });
        brow(f, [[3, 13], [4, 13], [5, 14]]);
        eye(f, 4, 15, 'r');
        put(f, rr(5, 19, 8, 22, 1), [FACE.throat, FACE.throat, FACE.mouth], { cap: 1, base: 0, gain: 1 });
        fill(f, M((x, y) => y === 22 && x >= 6 && x <= 7), FACE.tongue);
        dots(f, [[1, 19], [2, 19]], FACE.blush);
        // the response, on the right edge facing left, a little lower: pink shoulders, a pale face, a lime cap
        put(f, rr(24, 28, 37, 36, 4), R.pink, { cap: 3, base: 5, gain: 3.4 });
        frills(f, [24, 28, 32], 27.5, 2.2);
        skin(f, union(circ(30, 20, 7), circ(22.6, 18.6, 1.4)), SKIN.pale, { cap: 3.6 });
        put(f, union(ell(30.4, 13, 6, 2), quad([26, 12.5], [24, 10], [24.5, 8], (t) => 3 - t * 1.2), quad([30, 12], [30, 9.5], [31, 7.5], (t) => 3 - t * 1.2)), R.lime, { cap: 1.4, base: 5, gain: 3.2 });
        f.blit(bell(1.5), 23, 5);
        brow(f, [[25, 15], [26, 15], [27, 16]]);
        eye(f, 25, 17, 'l');
        put(f, rr(23, 21, 26, 24, 1), [FACE.throat, FACE.throat, FACE.mouth], { cap: 1, base: 0, gain: 1 });
        fill(f, M((x, y) => y === 24 && x >= 24 && x <= 25), FACE.tongue);
        dots(f, [[28, 21], [29, 21]], FACE.blush);
        return finish(f);
      },
    }, (k, b, free) => {
      // the pair of 4s glows
      [[9, 4], [19, 7]].forEach(([cx, cy]) => { for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 8; x <= cx + 8; x++) { const d = Math.hypot(x - cx, (y - cy) * 0.9); if (d <= 6.6) glowAt(b, free, [[x, y]], d <= 5.4 ? '#FFE07A38' : '#FFE07A1C'); } });
    }),
  });

  // ---- Bookends: a row of four cream cards of different heights standing on a shelf like books, one pip each (spade,
  // heart, club, diamond), held up by two dark bronze bookends, each a jester bust in profile facing in, an enamelled
  // three-point cap on its head and a palm pressed flat against the row; the first and last cards lean on them, lit
  // warm round their edges. The busts stand at different heights so the pair never reads as a face. Dusty lilac
  // ground, so the dark bronze and the warm glow both stand out.
  A.joker('bookends', {
    rarity: 'uncommon',
    ground: ['#4A3A7A', '#56468C', '#62529E', '#6E5EB0'], glow: [15, 18, 11], speck: [R.gold[5], R.cream[6]],
    ...lit({
      draw(k) {
        const f = new Bmp(W, W), BZ = R.wood.slice(0, 6), H = R.brass;
        // the shelf
        put(f, rr(0, 27, 30, 30), R.wood, { cap: 1.5, base: 3, gain: 3 });
        fill(f, M((x, y) => y === 27), R.wood[5]);
        // a bookend: a bronze plate down the outer edge to a foot on the shelf, a bust on top in profile facing in,
        // an enamelled three-point cap, a flat palm pressed against the row; brass where the light catches
        const end = (flip, dy) => {
          const g = new Bmp(W, W);
          put(g, union(rr(-2, 10 + dy, 1, 27, 1), rr(-3, 24, 4, 27, 1)), BZ, { cap: 1.6, base: 3, gain: 3.4 });
          put(g, union(seg([0, 19], [3.5, 19.5], 2.6), rr(3, 17, 4, 22, 1)), BZ, { cap: 1, base: 4, gain: 3 });
          put(g, union(circ(3, 9 + dy, 4.8), circ(8.4, 8.6 + dy, 1.3), ell(2.4, 14 + dy, 3.2, 1.6)), BZ, { cap: 2.8, base: 3, gain: 3.6 });
          put(g, quad([0.5, 4.5 + dy], [-1.5, 1.5 + dy], [-2.5, 3.5 + dy], (t) => 3 - t * 1.4), R.pink, { cap: 1.2, base: 5, gain: 3 });
          put(g, quad([3, 4 + dy], [3.5, 0.5 + dy], [6.5, 0 + dy], (t) => 3 - t * 1.4), R.lime, { cap: 1.2, base: 5, gain: 3 });
          put(g, quad([1.5, 4 + dy], [0.5, 0 + dy], [2.5, -1 + dy], (t) => 2.6 - t * 1.2), R.chips, { cap: 1.2, base: 5, gain: 3 });
          put(g, ell(3, 5 + dy, 4.6, 1.6), BZ, { cap: 1.2, base: 4, gain: 3 });
          dots(g, [[0, 5 + dy], [1, 5 + dy], [2, 5 + dy], [3, 5 + dy], [4, 5 + dy], [0, 8 + dy], [1, 11 + dy], [3, 18], [4, 18], [-1, 15 + dy]], H[5]);
          dots(g, [[0, 9 + dy], [3, 20]], H[4]);
          eye(g, 5, 8 + dy, 'l'); dots(g, [[5, 12 + dy], [6, 12 + dy], [7, 11 + dy]], R.wood[0]);
          g.set(6, -1 + dy, R.gold[5]); g.set(7, -1 + dy, R.gold[4]);
          f.blit(g, flip ? 30 - (W - 1) : 0, 0, { flipX: flip });
        };
        end(false, 0); end(true, 5);
        // the row, like books of different heights: the first and last lean out onto the bookends
        const red = (s) => (s === 'H' || s === 'D' ? R.red : R.dark);
        const face = (x, y, h, s) => { const c = card(5, h); c.blit(pip(s, red(s)), 1, 3); f.blit(c, x, y); };
        face(10, 17, 9, 'H'); face(16, 14, 12, 'C');
        cardQuad(f, [[5, 27], [11, 27], [10, 14], [3, 14]]); f.blit(pip('S', red('S')), 4, 17);
        cardQuad(f, [[21, 27], [27, 27], [29, 17], [22, 17]]); f.blit(pip('D', red('D')), 23, 20);
        return finish(f);
      },
    }, (k, b, free) => {
      // a warm glow round the first and last cards' edges
      [[6.5, 20], [24.5, 22]].forEach(([cx, cy]) => { for (let y = 6; y < 27; y++) for (let x = Math.floor(cx - 7); x <= cx + 7; x++) { const d = Math.max(Math.abs(x - cx) * 1.25, Math.abs(y - cy) * 0.7); if (d <= 6.6) glowAt(b, free, [[x, y]], d <= 5.2 ? '#FFC07060' : '#FFC07030'); } });
    }),
  });

  // ---- One-Man Band: a jester behind a big bass drum strapped across his front, seen three-quarter (a cream head, a
  // chip-blue shell with gold hoops) with one Ace pinned to its head (an A over a red heart); his cheeks puffed round a silver horn with a big
  // flared bell, a beater on a stick over his shoulder and cymbals clashing between his knees. Gold ground.
  A.joker('onemanband', {
    rarity: 'uncommon',
    ground: ['#A8661A', '#BA7424', '#CA822E', '#D89038'], glow: [14, 15, 13], speck: [R.cream[6], R.money[7]],
    draw(k) {
      const f = new Bmp(W, W);
      // the beater on its stick, poking up over his shoulder
      put(f, seg([8, 13], [3.5, 5], 1.6), R.wood, { cap: 1, base: 4, gain: 3 });
      put(f, circ(3, 4, 2), R.cream.slice(1), { cap: 1.4, base: 5, gain: 3 });
      // legs, knees apart, and the cymbals clashing between them
      put(f, union(seg([11, 25], [8, 30], 2.4), seg([17, 25], [20, 30], 2.4)), R.vio, { cap: 1, base: 5, gain: 3 });
      put(f, union(rr(5, 29, 9, 30, 1), rr(19, 29, 23, 30, 1)), R.plum.slice(2), { cap: 1, base: 3, gain: 3 });
      put(f, union(ell(11.4, 27.6, 1.4, 3.6), ell(15.6, 27.6, 1.4, 3.6)), R.gold, { cap: 1, base: 5, gain: 3.4 });
      // shoulders behind the drum, in pink motley
      put(f, rr(6, 11, 23, 20, 4), R.pink, { cap: 2, base: 5, gain: 3.4 });
      // the bass drum, three-quarter: the chip-blue shell on the right between two gold hoops, the head on the left
      const far = ell(17.5, 19, 6.2, 7.8), head = ell(12.5, 19, 6.4, 7.8);
      put(f, union(far, M((x, y) => x >= 12.5 && x <= 17.5 && Math.abs(y - 19) <= 7.8)), R.chips, { cap: 2, base: 5, gain: 3.4 });
      fill(f, M((x, y) => far.get(x, y) && !far.get(x + 1, y) && x > 18), R.gold[4]);
      fill(f, M((x, y) => far.get(x, y) && !far.get(x + 1, y) && !far.get(x + 2, y) && x > 18), R.gold[5]);
      put(f, head, R.cream.slice(0, 6), { cap: 2.6, base: 3, gain: 2.6 });
      fill(f, M((x, y) => head.get(x, y) && !(head.get(x - 1, y) && head.get(x + 1, y) && head.get(x, y - 1) && head.get(x, y + 1))), R.gold[4]);
      fill(f, M((x, y) => head.get(x, y) && (!head.get(x - 1, y) || !head.get(x, y - 1))), R.gold[5]);
      // the strap over his shoulder
      put(f, seg([7.5, 12.5], [12, 11.5], 2), R.wood.slice(0, 5), { cap: 1, base: 2, gain: 3 });
      // the Ace pinned to the drum head: a big solid A over a small red heart (a dark spade under the A read as a keyhole)
      const ace = card(7, 11); glyph(ace, 'A', 2, 2, INK); ace.draw(['X.X', 'XXX', '.X.'], 3, 10, { X: R.red[3] }); f.blit(ace, 8, 13);
      dots(f, [[12, 13]], R.gold[5]);
      // the head: cheeks puffed into two round pink balls round the horn's mouthpiece
      skin(f, circ(13, 6.5, 4.8), SKIN.gold, { cap: 3 });
      put(f, union(circ(10.6, 8.2, 1.6), circ(16, 8.2, 1.6)), [FACE.blush, FACE.blush, FACE.blushHi], { cap: 1, base: 1, gain: 1 }, false);
      dots(f, [[11, 5], [12, 5], [15, 5], [16, 5]], INK);
      brow(f, [[11, 3], [12, 3], [15, 3], [16, 3]]);
      // the silver horn from his lips to a big flared bell, its rim and dark mouth inside the window
      put(f, union(seg([14, 9], [21, 7], 2), poly([[20, 5.5], [25, 1.5], [28.5, 1.5], [28.5, 12.5], [25, 12.5], [20, 9]])), R.steel, { cap: 1.4, base: 3, gain: 3.4 });
      put(f, ell(27, 7, 1.6, 4.6), [R.dark[1], R.dark[0], R.dark[2]], { cap: 1, base: 0, gain: 1 }, false);
      dots(f, [[23, 4], [22, 5]], C.white);
      // his cap: two points, both flopping back over the beater side, bells on the tips
      put(f, union(ell(12.5, 2.4, 4.8, 1.8), quad([10, 2], [6, -1], [5, 3], (t) => 3 - t * 1.4), quad([14, 1.5], [12, -2], [8.5, 0], (t) => 2.6 - t * 1.2)), R.lime, { cap: 1.2, base: 5, gain: 3.2 });
      f.blit(bell(1.5), 3, 2);
      return finish(f);
    },
  });

  // ---- Colour Guard: a jester mid-step in a tall plumed shako, swinging one big mult-red flag overhead in a wide arc
  // to the upper right (a cream motion arc trailing it), the other red flag held low across his body to the lower left,
  // gold bells on both poles; the black flag folded into a neat triangle under his arm, for later. Indigo ground.
  A.joker('colourguard', {
    rarity: 'uncommon',
    ground: ['#1E1660', '#261C74', '#2E2288', '#38289C'], glow: [15, 16, 12], speck: [R.mult[6], R.cream[6]],
    ...lit({
      draw(k) {
        const f = new Bmp(W, W), S = SKIN.deep;
        // a flag: rippling folds across it, lit on their upper-left faces, inked round
        const flag = (pts, ph = 0) => {
          const m = poly(pts), b = new Bmp(W, W);
          for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
            if (!m.get(x, y)) continue;
            const u = ((x + ph - y * 0.5) % 5 + 5) % 5, edge = !m.get(x + 1, y) || !m.get(x, y + 1);
            b.set(x, y, edge ? R.mult[3] : u < 1 ? R.mult[7] : u < 2 ? R.mult[6] : u < 3.8 ? R.mult[5] : R.mult[4]);
          }
          f.blit(b.outline(INK), 0, 0);
        };
        const fin = () => { const b = new Bmp(6, 6); b.blit(emboss(disc(1.5), R.gold, { cap: 1.5, base: 4, gain: 4 }), 1, 1); b.set(2, 2, C.white); return b.outline(INK); };
        // the high flag: a pole from his raised hand up to a bell, the flag rippling out to the upper right
        put(f, seg([17.5, 12], [21, 2.5], 1.6), R.wood, { cap: 1, base: 4, gain: 3 });
        flag([[21, 2.5], [25, 0.5], [31, 2], [31, 9.5], [26, 8], [20.5, 10.5]]);
        f.blit(fin(), 18, -1);
        // the low flag, held across his body toward the lower left, its bell at the pole's end
        put(f, seg([11, 21], [3.5, 28.5], 1.6), R.wood, { cap: 1, base: 4, gain: 3 });
        flag([[9, 23], [5.5, 26.5], [0, 26], [-0.5, 20.5], [3.5, 21.5], [6.5, 19.5]]);
        f.blit(fin(), 1, 26);
        // legs mid-step in cream, black shoes
        put(f, union(seg([12, 22.5], [9.5, 29], 2.6), seg([15.5, 22.5], [18, 29], 2.6)), R.cream.slice(1), { cap: 1, base: 4, gain: 3 });
        put(f, union(rr(7, 29, 10, 30, 1), rr(17, 29, 20, 30, 1)), R.dark, { cap: 1, base: 2, gain: 3 });
        // the tunic, ember with cream cross-belts
        put(f, rr(9, 14, 18, 23, 3), R.ember, { cap: 2, base: 5, gain: 3.4 });
        fill(f, M((x, y) => y >= 15 && y <= 22 && (Math.abs((x - 9.5) - (y - 15)) < 0.6 || Math.abs((17.5 - x) - (y - 15)) < 0.6) && f.get(x, y) && f.get(x, y) !== INK), R.cream[5]);
        // the black flag folded into a triangle, tucked under his near arm; the arm up to the high pole
        put(f, poly([[17, 15], [23.5, 15], [17, 21]]), R.dark.slice(1), { cap: 1.4, base: 2, gain: 3 });
        fill(f, M((x, y) => x + y === 37 && x >= 18 && x <= 21), R.dark[4]);
        put(f, seg([16.5, 15.5], [17.5, 12.5], 2.6), R.ember, { cap: 1, base: 5, gain: 3 });
        hand(f, 'fist', 16, 10, S);
        // the far arm down across his body to the low pole
        put(f, seg([10, 16], [10.5, 20.5], 2.6), R.ember, { cap: 1, base: 5, gain: 3 });
        hand(f, 'fist', 9, 20, S);
        // the head: a broad grin under the shako's peak
        skin(f, circ(13.5, 10.5, 4.2), S, { cap: 2.8 });
        eye(f, 12, 9, 'l'); eye(f, 15, 9, 'l');
        fill(f, M((x, y) => y >= 12 && y <= 13 && Math.abs(x - 13.5) <= 2 - (y - 12)), FACE.throat);
        fill(f, M((x, y) => y === 12 && Math.abs(x - 13.5) <= 2), C.white);
        // the shako: a tall cream drum with a gold band, a black peak and a pink plume
        put(f, poly([[9.5, 7.5], [17.5, 7.5], [16.5, 1.5], [10.5, 1.5]]), R.cream.slice(1), { cap: 1.6, base: 5, gain: 3 });
        fill(f, M((x, y) => y === 5 && x >= 10 && x <= 16), R.gold[4]);
        put(f, rr(9, 7, 18, 8, 1), R.dark, { cap: 1, base: 2, gain: 3 });
        put(f, union(circ(13.5, 0.5, 1.8), circ(12, 0, 1.2)), R.pink, { cap: 1, base: 5, gain: 3 });
        return finish(f);
      },
    }, (k, b, free) => {
      // a cream motion arc trailing the high flag's swing
      for (let y = 0; y < 31; y++) for (let x = 0; x < 31; x++) { const dx = x + 0.5 - 17.5, dy = y + 0.5 - 12.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) * 180 / Math.PI; if (d >= 12.6 && d < 13.6 && a >= -165 && a <= -118) glowAt(b, free, [[x, y]], '#FFF3E0D0'); }
    }),
  });

  // ---- Three's a Crowd: three jesters crammed onto one tiny plum stool: the two behind press in from the sides,
  // elbows out and cross (one in a hood, one in a beret), and the one squashed in front between them, lower, cheeks
  // pushed up and eyes screwed shut, has his tricorn knocked askew. Ochre-orange ground.
  A.joker('threesacrowd', {
    rarity: 'uncommon',
    ground: ['#7E3410', '#984214', '#B05018', '#C65E1E'], glow: [15, 14, 13], speck: [R.cream[6], R.money[7]],
    draw(k) {
      const f = new Bmp(W, W);
      // the left one, behind: a chip-blue tunic, a 2-px elbow jabbing in, a pink hood round a cross face
      put(f, rr(-3, 19, 9, 34, 4), R.chips, { cap: 3, base: 5, gain: 3.4 });
      put(f, union(seg([5, 20], [10, 21.5], 2.4)), R.chips, { cap: 1, base: 5, gain: 3 });
      put(f, union(circ(5.5, 11.5, 6.4), poly([[1, 8], [4, 1], [6, 0], [9, 6]])), R.pink, { cap: 2.4, base: 5, gain: 3.4 });
      skin(f, ell(6.5, 12.5, 4, 4.2), SKIN.gold, { cap: 2.4 });
      brow(f, [[4, 10], [5, 11], [8, 11], [9, 10]], INK);
      dots(f, [[5, 12], [8, 12]], INK);
      dots(f, [[5, 15], [6, 14], [7, 14], [8, 15]], FACE.mouth);
      // the right one, behind: a lime tunic, an elbow jabbing in, a violet beret pulled down, a cross face
      put(f, rr(22, 19, 34, 34, 4), R.lime, { cap: 3, base: 5, gain: 3.4 });
      put(f, union(seg([26, 20], [21, 21.5], 2.4)), R.lime, { cap: 1, base: 5, gain: 3 });
      skin(f, circ(25.5, 12.5, 5.4), SKIN.deep, { cap: 3 });
      put(f, union(ell(25, 7.8, 6.6, 2.4), circ(24, 5.6, 1)), R.vio, { cap: 1.6, base: 5, gain: 3.4 });
      brow(f, [[22, 11], [23, 12], [26, 12], [27, 11]], INK);
      dots(f, [[23, 13], [26, 13]], INK);
      dots(f, [[23, 16], [24, 15], [25, 15], [26, 16]], FACE.mouth);
      // the one squashed in front, lower: a cream tunic on the stool, cheeks pushed up, eyes screwed shut
      put(f, rr(10, 21, 21, 26, 3), R.cream.slice(1), { cap: 2, base: 5, gain: 3 });
      // under him the tiny stool, whole: a round plum seat on three splayed legs
      put(f, union(seg([12, 27], [9.5, 30.5], 1.8), seg([19, 27], [21.5, 30.5], 1.8), seg([15.5, 27], [15.5, 30.5], 1.8)), PLUM.slice(1), { cap: 1, base: 3, gain: 3 });
      put(f, ell(15.5, 26.4, 5.6, 1.6), PLUM, { cap: 1.4, base: 5, gain: 3.4 });
      skin(f, ell(15.5, 17, 5.6, 5), SKIN.tan, { cap: 3 });
      dots(f, [[12, 15], [13, 16], [12, 17], [19, 15], [18, 16], [19, 17]], INK);
      put(f, union(circ(12, 18.6, 1.6), circ(19, 18.6, 1.6)), [FACE.blush, FACE.blush, FACE.blushHi], { cap: 1, base: 1, gain: 1 }, false);
      dots(f, [[14, 20], [15, 19], [16, 20], [17, 19]], FACE.mouth);
      // his tricorn, knocked askew: a three-cornered hat tilted off to one side, a gold bell at each corner
      put(f, poly([[9.5, 12], [15, 7.5], [22, 7], [21, 11.5], [15.5, 9.5]]), R.dark, { cap: 1.4, base: 3, gain: 3.4 });
      fill(f, M((x, y) => (x === 15 && y === 9) || (x === 16 && y === 9) || (x === 17 && y === 9)), R.gold[4]);
      [[8, 11], [14, 5], [21, 5]].forEach(([x, y]) => f.blit(bell(1.5), x - 1, y - 1));
      return finish(f);
    },
  });

  // ---- Two's Company: two jesters leaning in from either side to share one tall cream milkshake (a cherry on top)
  // through two pink straws, eyes shut in bliss, one head higher than the other; each wears a brimmed cap with a
  // matching pair of little cards tucked in its band. Soda-pink ground.
  A.joker('twoscompany', {
    rarity: 'uncommon',
    ground: ['#6E1A48', '#86245A', '#9E2E6C', '#B63A7E'], glow: [15, 16, 11], speck: [R.cream[6], R.lime[6]],
    draw(k) {
      const f = new Bmp(W, W);
      const pair = (x, y, mark) => [0, 3].forEach((dx, i) => { const c = card(4, 6); c.draw(mark, 1, 2, { X: R.red[3] }); f.blit(c, x + dx, y - i); });
      // the glass: tall and tapered, the cream shake inside, whipped cream and a cherry on top
      put(f, union(poly([[11.5, 15], [19.5, 15], [18.5, 25], [12.5, 25]]), rr(14, 25, 17, 27), rr(11, 28, 20, 29, 1)), R.ghost.slice(1, 6), { cap: 1.5, base: 3, gain: 3 });
      put(f, poly([[12.5, 16], [18.5, 16], [17.8, 24], [13.2, 24]]), R.cream.slice(1), { cap: 1.6, base: 4, gain: 2.6 }, false);
      put(f, union(circ(13.5, 14, 2), circ(17.5, 14, 2), circ(15.5, 12.4, 2.3)), R.cream.slice(2), { cap: 1.8, base: 5, gain: 3 });
      put(f, circ(15.5, 9.4, 1.6), R.mult, { cap: 1.4, base: 5, gain: 3.4 });
      f.set(16, 6, R.lime[3]); f.set(16, 7, R.lime[3]);
      // two pink straws, one from each mouth down into the shake
      put(f, seg([9.5, 14.5], [13.5, 10.5], 2), R.pink, { cap: 1, base: 5, gain: 3 });
      put(f, seg([21.5, 18.5], [17.5, 10.5], 2), R.pink, { cap: 1, base: 5, gain: 3 });
      // the left one, higher: chip-blue shoulders, a tan face, a pink brimmed cap with its pair of hearts
      put(f, rr(-3, 21, 8, 34, 4), R.chips, { cap: 3, base: 5, gain: 3.4 });
      skin(f, union(circ(4, 13, 5.6), ell(-1.1, 13.5, 1.4, 2)), SKIN.tan, { cap: 3.4 });
      pair(0, 1, ['X.X', 'XXX', '.X.']);
      put(f, union(ell(3.5, 8.2, 5.8, 2.2), rr(3, 8.6, 10, 9.6, 1)), R.pink, { cap: 1.4, base: 5, gain: 3.2 });
      dots(f, [[4, 10], [6, 10], [7, 10]], R.wood[1]);
      dots(f, [[4, 12], [5, 11], [6, 12]], INK);
      dots(f, [[2, 15], [3, 15]], FACE.blush);
      dots(f, [[8, 15], [9, 15]], FACE.mouth);
      // the right one, lower: lime shoulders, a deep-skinned face, a violet brimmed cap with its pair of diamonds
      put(f, rr(23, 25, 34, 34, 4), R.lime, { cap: 3, base: 5, gain: 3.4 });
      skin(f, union(circ(27, 17, 5.6), ell(32.1, 17.5, 1.4, 2)), SKIN.deep, { cap: 3.4 });
      pair(23, 5, ['.X.', 'XXX', '.X.']);
      put(f, union(ell(27.5, 12.2, 5.8, 2.2), rr(21, 12.6, 28, 13.6, 1)), R.vio, { cap: 1.4, base: 5, gain: 3.2 });
      dots(f, [[24, 14], [25, 14], [27, 14]], R.wood[0]);
      dots(f, [[25, 16], [26, 15], [27, 16]], INK);
      dots(f, [[28, 19], [29, 19]], FACE.blush);
      dots(f, [[22, 19], [23, 19]], FACE.mouth);
      return finish(f);
    },
  });

  // ---- Pocket Lint: one big patch pocket turned out, showing its pale cream lining in pink running stitch, its plum
  // flap folded open; a round puff of lint peeks out of it, worried, all that is left inside, while a chip-blue button
  // tumbles out to the left with a few tufts. Ember-orange ground. (A plum pocket made it Moneybags' twin.)
  A.joker('pocketlint', {
    rarity: 'uncommon',
    ground: ['#8A3410', '#A44014', '#BC4E18', '#D25C1E'], glow: [17, 14, 12], speck: [R.cream[6], R.ember[7]],
    draw(k) {
      const f = new Bmp(W, W);
      const LINT = ['#4A3A54', '#6A5A76', '#8A7C98', '#AAA0B8', '#CCC4D8', '#E4DEEA'];
      // the flap, folded up and open above the pocket's mouth: we see its paler lining, a buttonhole at its point
      put(f, poly([[8, 12], [28, 12], [28, 8], [18, 3], [8, 8]]), PLUM.slice(2), { cap: 2, base: 4, gain: 3 });
      dots(f, [[17, 5], [18, 5], [19, 5]], PLUM[0]);
      // the lint puff, round with a tufted edge, peeking out of the mouth
      const puff = union(circ(18, 10, 4.6), ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => { const a = (i / 10) * Math.PI * 2; return circ(18 + Math.cos(a) * 4.8, 10 + Math.sin(a) * 4.8, 1.1); }));
      put(f, puff, LINT, { cap: 2.6, base: 4, gain: 2.4 });
      // the pocket, turned out: its cream lining, rounded bottom corners, a pink running stitch round it
      const pocket = M((x, y) => x >= 8 && x <= 27 && y >= 13 && y <= 28 && !(y > 24 && ((x < 12 && (x - 12) ** 2 + (y - 24) ** 2 > 16.5) || (x > 23 && (x - 23) ** 2 + (y - 24) ** 2 > 16.5))));
      put(f, pocket, R.cream.slice(0, 7), { cap: 3, base: 4, gain: 3.4 });
      fill(f, M((x, y) => y === 13 && x >= 9 && x <= 26), R.cream[6]);
      const inset = M((x, y) => pocket.get(x, y) && pocket.get(x - 2, y) && pocket.get(x + 2, y) && pocket.get(x, y - 2) && pocket.get(x, y + 2));
      fill(f, M((x, y) => inset.get(x, y) && !(inset.get(x - 1, y) && inset.get(x + 1, y) && inset.get(x, y - 1) && inset.get(x, y + 1)) && (x + y) % 2 === 0), R.pink[6]);
      // the puff's worried face: raised brows, two dot eyes, a wobbly little mouth
      dots(f, [[15, 7], [16, 6], [20, 6], [21, 7]], LINT[1]);
      dots(f, [[16, 8], [20, 8], [16, 9], [20, 9]], INK);
      dots(f, [[17, 11], [18, 10], [19, 11]], INK);
      // the button tumbling out to the left, two thread holes, and a few tufts of lint after it
      const btn = new Bmp(9, 9); btn.blit(emboss(disc(2.6), R.chips, { cap: 1.4, base: 5, gain: 3.4 }), 1, 1); btn.set(3, 4, R.chips[1]); btn.set(5, 4, R.chips[1]);
      f.blit(btn.outline(INK), -1, 15);
      put(f, union(circ(5, 10.5, 1.3), circ(3, 25.5, 1.3)), LINT, { cap: 1, base: 4, gain: 2.4 });
      return finish(f);
    },
  });

  // ---- Signature Move: a jester in his trademark pose, up on one toe with the other leg bent up behind, one finger
  // pointing straight up, the other fist on his hip, chin up and grinning; a pink scarf wraps his waist once and
  // streams off in one S, and his signature, a bold gold flourish (a big loop and a small one, no letters), sweeps
  // from the raised hand down behind him to a sparkle. Violet ground.
  A.joker('signaturemove', {
    rarity: 'uncommon',
    ground: ['#3C0E4A', '#4A125A', '#58186A', '#681E7C'], glow: [14, 14, 12], speck: [R.pink[6], R.gold[5]],
    draw(k) {
      const f = new Bmp(W, W);
      // the signature, behind him: from the raised hand round a big loop on the right, down behind his legs into a
      // small loop, then off to a four-point sparkle
      // a smooth path through hand-placed points (Catmull-Rom), stroked 2 px wide
      const P = [[20, 1], [26, 1.5], [29, 6], [26.5, 10.5], [23, 8], [25, 5], [28.5, 9], [28, 15], [24.5, 18.5], [26, 23], [29, 24.5], [28.5, 21], [25.5, 22.5], [24.5, 26.5], [21.5, 27.5]];
      const sig = new Mask(W, W);
      for (let i = 0; i < P.length - 1; i++) {
        const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
        let last = p1;
        for (let s = 1; s <= 12; s++) {
          const t = s / 12, t2 = t * t, t3 = t2 * t;
          const q = [0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3));
          sig.or(seg(last, q, 2.1)); last = q;
        }
      }
      put(f, sig, R.gold, { cap: 1, base: 4, gain: 3.4 });
      const star = new Bmp(7, 7); star.draw(['..a..', '..a..', 'aabaa', '..a..', '..a..'], 1, 1, { a: R.gold[5], b: C.white });
      f.blit(star.outline(INK), 15, 24);
      // the standing leg up on its toe (cream) and the other bent up behind him (chip blue)
      put(f, rr(13, 20, 14, 28), R.cream.slice(1), { cap: 1, base: 4, gain: 3 });
      put(f, union(seg([16, 20.5], [19.5, 24.5], 2.4), seg([19.5, 24.5], [23, 20.5], 2.4)), R.chips, { cap: 1, base: 5, gain: 3 });
      put(f, union(rr(13, 28, 14, 30), rr(23, 19, 25, 21, 1)), R.plum.slice(2), { cap: 1, base: 3, gain: 3 });
      // the tunic, half chip-blue and half cream
      put(f, rr(10, 12, 18, 21, 3), R.chips, { cap: 2, base: 5, gain: 3.4 });
      fill(f, M((x, y) => x >= 14 && x <= 17 && y >= 13 && y <= 20 && !(x === 17 && (y === 13 || y === 20))), R.cream[5]);
      fill(f, M((x, y) => x === 17 && y >= 14 && y <= 19), R.cream[3]);
      // the fist on his hip, the elbow out
      put(f, union(seg([10.5, 13.5], [6.5, 16.5], 2.4), seg([6.5, 16.5], [9, 19.5], 2.4)), R.chips, { cap: 1, base: 5, gain: 3 });
      hand(f, 'fist', 8, 18, SKIN.gold);
      // the arm straight up, the index finger pointing at the sky
      put(f, rr(18, 5, 19, 13, 1), R.cream.slice(1), { cap: 1, base: 5, gain: 3 });
      hand(f, 'point', 17, 0, SKIN.gold);
      // the scarf: one pink ribbon round his waist, streaming off in a single S
      put(f, union(rr(9, 18, 18, 20, 1), quad([10, 19], [5, 20], [5, 24], 3), quad([5, 24], [5, 28], [0, 27], 2.6)), R.pink, { cap: 1.2, base: 5, gain: 3.2 });
      // the head, chin up: eyes on the finger, brows up, a big toothy grin
      skin(f, circ(13.5, 8, 4.6), SKIN.gold, { cap: 3 });
      brow(f, [[11, 4], [12, 4], [15, 4], [16, 4]]);
      eye(f, 11, 5, 'r'); eye(f, 15, 5, 'r');
      fill(f, M((x, y) => y >= 9 && y <= 11 && ((x - 13.5) / 3.4) ** 2 + ((y - 9) / 2.6) ** 2 <= 1), FACE.throat);
      fill(f, M((x, y) => y === 9 && x >= 11 && x <= 16), C.white);
      dots(f, [[10, 8], [17, 8]], FACE.blush);
      // a cap with one point curling off to the left, a bell at its tip
      put(f, union(ell(13, 3.4, 4.6, 1.8), quad([10, 3], [5, 0], [4, 5], (t) => 3.6 - t * 1.6)), R.lime, { cap: 1.4, base: 5, gain: 3.4 });
      f.blit(bell(1.5), 1, 4);
      return finish(f);
    },
  });

  // ---- Heads or Tails: a big coin spinning up off a jester's thumb, caught mid-turn as an ellipse with its edge
  // showing; its face is struck with a three-point bell cap (no face, no $); a cream flick trail rises from the thumb
  // and ends in a tight curl, the monkey's tail of the brief. The fist is in profile in a pink cuff. Violet ground.
  A.joker('headsortails', {
    rarity: 'uncommon',
    ground: ['#2A1060', '#36167A', '#421C92', '#5024AA'], glow: [15, 11, 12], speck: [R.money[6], R.cream[6]],
    ...lit({
      draw(k) {
        const f = new Bmp(W, W), Mo = R.money;
        // the coin mid-spin: its edge band showing on the lower right, then the face
        put(f, ell(16.5, 11.5, 8.5, 6.5), Mo.slice(1, 5), { cap: 1, base: 2, gain: 2 });
        const face = ell(15.5, 10, 8.5, 6.5);
        const b = new Bmp(W, W);
        for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (face.get(x, y)) b.set(x, y, !face.get(x + 1, y) || !face.get(x, y + 1) ? Mo[4] : !face.get(x - 1, y) || !face.get(x, y - 1) ? Mo[7] : Mo[5]);
        // the struck emblem: a three-point bell cap, its lines sunk in amber, lit on their lower-right lips
        const cap = ['X.....X..', '.X..X..X.', '.XX.X.XX.', '..XXXXX..', '..XXXXX..', '.XXXXXXX.', '.........'];
        cap.forEach((row, j) => [...row].forEach((c, i) => { if (c === 'X') { b.set(11 + i, 6 + j, Mo[3]); if (cap[j + 1] && cap[j + 1][i] !== 'X') b.set(11 + i, 7 + j, Mo[7]); } }));
        [[11, 6], [17, 6], [15, 7]].forEach(([x, y]) => { b.set(x, y - 1, Mo[3]); b.set(x + 1, y - 1, Mo[7]); });
        f.blit(b.outline(INK), 0, 0);
        // the fist below in profile: knuckles to the left, the thumb straight up under the coin, a pink cuff
        skin(f, union(rr(10, 21, 18, 28, 3)), SKIN.tan, { cap: 2.4 });
        skin(f, rr(16, 16, 18, 22, 1), SKIN.tan, { cap: 1.2, base: 4, gain: 3 });
        dots(f, [[15, 22], [15, 23], [14, 23], [13, 23]], INK);
        dots(f, [[11, 24], [11, 26]], SKIN.tan[2]);
        put(f, poly([[18, 22], [24, 26], [21, 32], [16, 29]]), R.pink, { cap: 2, base: 5, gain: 3.4 });
        put(f, union(circ(18.5, 23, 1.4), circ(17.5, 25.5, 1.4), circ(16.5, 28, 1.4)), R.cream.slice(1), { cap: 1, base: 5, gain: 3 });
        return finish(f);
      },
    }, (k, b, free) => {
      // the flick: a cream trail rising from the thumb up past the coin's edge, ending in a tight curl
      const pts = [];
      for (let i = 0; i <= 50; i++) { const t = i / 50; pts.push([19 + t * 7, 18.5 - t * t * 9]); }
      for (let i = 0; i <= 50; i++) { const a = Math.PI + (i / 50) * Math.PI * 1.7, r = 2.6 - i * 0.03; pts.push([28.4 + Math.cos(a) * r, 8.4 + Math.sin(a) * r]); }
      const seen = new Set();
      pts.forEach(([x, y]) => [[0, 0], [1, 0]].forEach(([dx, dy]) => { const X = Math.round(x) + dx, Y = Math.round(y) + dy, key = X + ',' + Y; if (!seen.has(key)) { seen.add(key); glowAt(b, free, [[X, Y]], '#FFF3E0E0'); } }));
      // spin marks either side of the coin
      [[4, 7], [4, 8], [3, 11], [3, 12], [4, 15]].forEach(([x, y]) => glowAt(b, free, [[x, y]], '#FFF3E0A0'));
    }),
  });

  // ---- Velvet Rope: a plush red velvet rope sagging between two brass posts, guarding a tall Joker card that carries
  // an Edition: our Glitch plates (a red one and a blue one a pixel off its sides) and a sheen band, no rainbow; in its
  // window a tiny grinning jester in a three-point cap. Plum ground.
  A.joker('velvetrope', {
    rarity: 'uncommon',
    ground: ['#2A0A1E', '#380E28', '#461432', '#561A3C'], glow: [15, 10, 12], speck: [R.cream[6], R.gold[5]],
    draw(k) {
      const f = new Bmp(W, W);
      // the guarded card: 13 x 19 with a pink frame, its Glitch plates and a cream window
      const cx = 9, cy = 0, cw = 13, ch = 19;
      for (let y = cy + 2; y < cy + ch - 2; y++) { f.set(cx - 1, y, '#FF2E4A'); f.set(cx + cw, y, '#4A62FF'); }
      f.blit(card(cw - 2, ch - 2, { face: R.pink[5], hi: R.pink[7], lo: R.pink[3] }), cx, cy);
      const win = rr(cx + 2, cy + 2, cx + cw - 3, cy + ch - 5, 1);
      put(f, win, R.cream.slice(2), { cap: 1, base: 4, gain: 2 }, false);
      // the tiny jester in the window: a three-point cap with gold bells, two eyes and a grin
      const j = new Bmp(W, W), x0 = cx + 6.5, y0 = cy + 10;
      put(j, circ(x0, y0, 3), SKIN.tan, { cap: 2, base: 3, gain: 3.4 }, false);
      put(j, union(rr(x0 - 3.5, y0 - 3.5, x0 + 3.5, y0 - 2.5), seg([x0 - 2.5, y0 - 3], [x0 - 4, y0 - 6], 1.6), seg([x0, y0 - 3.5], [x0, y0 - 7], 1.6), seg([x0 + 2.5, y0 - 3], [x0 + 4, y0 - 6], 1.6)), R.lime, { cap: 1, base: 5, gain: 3 }, false);
      j.outline(INK);
      dots(j, [[x0 - 4.5, y0 - 6.5], [x0 - 0.5, y0 - 7.5], [x0 + 3.5, y0 - 6.5]].map(([x, y]) => [Math.round(x), Math.round(y)]), R.gold[5]);
      dots(j, [[x0 - 1.5, y0 - 1], [x0 + 1.5, y0 - 1]].map(([x, y]) => [Math.round(x), Math.round(y)]), INK);
      dots(j, [[x0 - 2, y0 + 1], [x0 - 1, y0 + 2], [x0, y0 + 2], [x0 + 1, y0 + 2], [x0 + 2, y0 + 1]].map(([x, y]) => [Math.round(x), Math.round(y)]), FACE.mouth);
      f.blit(j, 0, 0, { clip: (x, y) => win.get(x, y) || (y >= cy + 2 && y <= cy + ch - 5 && x >= cx + 1 && x <= cx + cw - 2) });
      // the sheen: a diagonal band of light across the card
      for (let i = 0; i < 16; i++) { const x = cx + 1 + i, y = cy + 20 - i; [[x, y], [x + 1, y]].forEach(([a, b]) => { if (f.get(a, b) && f.get(a, b) !== INK && a < cx + cw - 1) f.set(a, b, '#FFFCF5'); }); }
      // two brass posts with ball tops, a glint on each ball
      const post = (x) => {
        put(f, union(rr(x, 13, x + 2, 27, 1), rr(x - 2, 27, x + 4, 29, 1)), R.brass, { cap: 1.4, base: 4, gain: 3.4 });
        put(f, circ(x + 1, 10.5, 2.2), R.brass, { cap: 1.6, base: 4, gain: 4 });
        f.set(x, 9, C.white);
      };
      post(2); post(26);
      // the plush red rope, sagging deep between them, lit along its top; gold clips at its ends
      const rope = quad([5, 15], [15.5, 33], [26, 15], 3.2);
      put(f, rope, R.mult, { cap: 1.6, base: 5, gain: 3.6 });
      fill(f, M((x, y) => rope.get(x, y) && !rope.get(x, y - 1) && x > 6 && x < 25), R.mult[7]);
      put(f, union(rr(4, 13, 6, 16, 1), rr(25, 13, 27, 16, 1)), R.gold, { cap: 1, base: 4, gain: 3.4 });
      return finish(f, [[2, 9], [26, 9]]);
    },
  });

  // ---- Shoeshine: a jester shoeshiner in a flat cap (a little bell on its button) buffing a cream card standing in his
  // wooden box with a cloth, cream with one red stripe, bunched in his fist with a corner flapping, until it sparkles;
  // a tiny tin of polish with a gold star on its lid at his feet. Burnt-orange ground.
  A.joker('shoeshine', {
    rarity: 'uncommon',
    ground: ['#6A2016', '#82281A', '#9A301E', '#B03A22'], glow: [21, 12, 10], speck: [R.cream[6], R.money[7]],
    ...lit({
      draw(k) {
        const f = new Bmp(W, W);
        // the shoeshine box, the card standing up in its slot
        put(f, union(rr(16, 23, 29, 29, 1), rr(18, 21, 27, 23)), R.wood, { cap: 2, base: 3, gain: 3.4 });
        fill(f, M((x, y) => y === 26 && x >= 17 && x <= 28), R.wood[1]);
        const c = card(9, 14); c.blit(emboss(Mask.rows(A.kit.PIP7.H), R.red, { cap: 2.2, base: 3, gain: 4.2 }), 2, 4); f.blit(c, 18, 6);
        dots(f, [[25, 8], [24, 9], [25, 9], [26, 9], [25, 10]], C.white);
        // the jester at the left, leaning in to his work: a pink tunic, a cream ruff
        put(f, rr(-2, 18, 11, 34, 4), R.pink, { cap: 2, base: 4, gain: 3.4 });
        frills(f, [0, 4, 8], 18, 2);
        skin(f, union(circ(6.5, 13, 4.6), circ(11, 13, 1.1)), SKIN.gold, { cap: 3 });
        eye(f, 8, 12, 'r');
        dots(f, [[8, 16], [9, 16], [10, 15]], FACE.mouth);
        dots(f, [[5, 15], [6, 15]], FACE.blush);
        // his flat cap: a round crown, a short peak to the front, a little gold bell on the button
        put(f, union(ell(6, 9.4, 5.2, 2.2), rr(8, 9, 13, 10, 1)), R.vio, { cap: 1.6, base: 5, gain: 3.4 });
        f.blit(bell(1.5), 4, 4);
        // the arm out to the card, the fist bunching the cloth: cream with one red stripe, a corner flapping free
        put(f, seg([9, 21], [16, 17], 3), R.pink, { cap: 1, base: 4, gain: 3 });
        const cloth = poly([[15, 13], [20, 12.5], [21.5, 16], [19, 19.5], [14.5, 18.5]]);
        put(f, cloth, R.cream.slice(0, 7), { cap: 1.6, base: 4, gain: 3 });
        fill(f, M((x, y) => cloth.get(x, y) && Math.abs(x + y - 33) < 1), R.mult[4]);
        put(f, poly([[20, 16], [24, 18], [22.5, 20.5], [19.5, 19]]), R.cream.slice(0, 7), { cap: 1, base: 4, gain: 3 });
        fill(f, M((x, y) => (x === 21 && y === 18) || (x === 22 && y === 19)), R.mult[4]);
        hand(f, 'fist', 14, 16, SKIN.gold);
        // the little tin of polish, a gold star on its lid
        put(f, rr(11, 26, 16, 29, 1), R.steel, { cap: 1.4, base: 3, gain: 3 });
        put(f, ell(13.5, 25.5, 3.2, 1.4), R.gold, { cap: 1, base: 3, gain: 3.4 });
        dots(f, [[13, 25], [14, 25]], R.gold[6]);
        return finish(f);
      },
    }, (k, b, free) => {
      // the shine: sparkles round the card
      sparkle(b, free, 29, 5, R.money[6], true);
      sparkle(b, free, 17, 3, R.money[6]);
      sparkle(b, free, 29, 15, R.money[6]);
    }),
  });

  // ---- Thimble: a silver thimble sitting on a plump pink pincushion, a coil of lime ribbon unspooling from it with a
  // jester's bell sewn to its end. Apricot ground, so the silver and the pink sit on something light.
  A.joker('thimble', {
    rarity: 'uncommon',
    ground: ['#A0482A', '#B85A36', '#CC6E44', '#DE8454'], glow: [14, 13, 12], speck: [R.cream[7], R.money[7]],
    draw(k) {
      const f = new Bmp(W, W);
      // the ribbon unspooling up and away, its bell at the end
      put(f, union(quad([22, 22], [30, 21], [27, 13], 2.4), quad([27, 13], [24, 8], [27, 5], 2.2)), R.lime, { cap: 1, base: 5, gain: 3 });
      f.blit(bell(), 23, 0);
      // the pincushion: a plump pink tomato of a cushion, its segments pinched in, two pins in it
      put(f, ell(14.5, 22, 11.4, 7.4), R.pink, { cap: 3.4, base: 4, gain: 3.8 });
      [[7, 15.5, 6, 28.5], [14.5, 14.5, 14.5, 29.5], [22, 15.5, 23, 28.5]].forEach(([x0, y0, x1, y1]) => {
        const m = quad([x0, y0], [(x0 + x1) / 2 + (x0 < 14 ? -2 : x0 > 15 ? 2 : 0), (y0 + y1) / 2], [x1, y1], 1);
        fill(f, M((x, y) => m.get(x, y) && f.get(x, y) && f.get(x, y) !== INK), R.pink[3]);
      });
      [[4, 17, R.chips, 1], [25, 16, R.mult, -1]].forEach(([x, y, ramp, dir]) => { fill(f, seg([x, y], [x + 2 * dir, y + 3], 1), R.steel[4]); put(f, circ(x, y, 1.3), ramp, { cap: 1, base: 5, gain: 3 }); });
      // the coil of ribbon wound round the cushion's foot
      put(f, quad([4, 26], [14, 32], [22, 22], 2.2), R.lime, { cap: 1, base: 5, gain: 3 });
      // the thimble: steel, dimpled, its rolled rim sitting in the cushion
      put(f, union(poly([[9, 17], [20, 17], [19, 6], [10, 6]]), ell(14.5, 6, 4.6, 2.6)), R.steel, { cap: 3, base: 3, gain: 3.6 });
      for (let y = 5; y <= 14; y += 2) for (let x = 10 + (y % 4 === 1 ? 1 : 0); x <= 19; x += 2) if (f.get(x, y) && f.get(x, y) !== INK && Math.abs(x - 14.5) < 4.4) f.set(x, y, R.steel[x < 13 ? 2 : 1]);
      put(f, rr(8, 16, 21, 18, 1), R.steel, { cap: 1, base: 3, gain: 3.2 });
      return finish(f);
    },
  });

  // ---- Moonstruck: a dreamy jester sitting on a plum rooftop at the right, chin in his hands, gazing up-left at a
  // huge cream moon with soft oval craters; his cap has one long point with a crescent charm, and a tiny orange ringed
  // planet circles it. Night-blue ground.
  A.joker('moonstruck', {
    rarity: 'uncommon',
    ground: ['#0E1130', '#141844', '#1B2058', '#232A6B'], glow: [9, 9, 11], speck: [C.white, R.cream[6], R.chips[7]],
    draw(k) {
      const f = new Bmp(W, W), S = SKIN.tan;
      // the moon at the upper left, its craters soft ovals: a shadow on the upper-left inner edge, a lit lower-right lip
      const moon = circ(8.5, 8.5, 8.2);
      put(f, moon, R.cream.slice(2), { cap: 3, base: 5, gain: 3 });
      [[7, 6, 2.6, 1.5], [12, 11.5, 1.6, 1.1], [5, 12.5, 1.2, 1.1]].forEach(([cx, cy, rx, ry]) => {
        const c = ell(cx, cy, rx, ry);
        fill(f, M((x, y) => c.get(x, y) && moon.get(x, y)), R.cream[4]);
        fill(f, M((x, y) => c.get(x, y) && (!c.get(x - 1, y) || !c.get(x, y - 1))), R.cream[3]);
        fill(f, M((x, y) => !c.get(x, y) && c.get(x - 1, y - 1) && (c.get(x - 1, y) || c.get(x, y - 1)) && moon.get(x, y)), R.cream[6]);
      });
      // the rooftop: plum tiles sloping down to the left
      put(f, poly([[31, 22], [21, 20], [-1, 26], [-1, 31], [31, 31]]), PLUM, { cap: 2, base: 3, gain: 3 });
      for (let x = 2; x < 31; x += 4) fill(f, M((xx, yy) => xx === x && yy >= 22 + Math.round((21 - x) * 0.27) && yy <= 30 && f.get(xx, yy) && f.get(xx, yy) !== INK), PLUM[1]);
      fill(f, M((x, y) => y === 27 && x <= 29 && f.get(x, y) && f.get(x, y) !== INK), PLUM[1]);
      // the jester sitting hugging his knees, chin in his hands, face turned up to the moon
      put(f, rr(19, 16, 28, 23, 3), R.lime, { cap: 2, base: 5, gain: 3.4 });
      put(f, seg([20, 21], [16, 18.5], 3), R.cream.slice(1), { cap: 1.4, base: 4, gain: 3 });
      put(f, rr(14, 17, 17, 20, 1), R.plum.slice(2), { cap: 1, base: 3, gain: 3 });
      skin(f, union(circ(23, 11, 5.6), circ(17.4, 10.4, 1.3)), S, { cap: 3.4 });
      skin(f, union(rr(19, 15, 22, 17, 1)), S, { cap: 1, base: 4, gain: 3 });
      brow(f, [[18, 7], [19, 6], [20, 6], [22, 6], [23, 7]]);
      eye(f, 19, 8, 'l'); eye(f, 22, 8, 'l');
      dots(f, [[19, 13], [20, 13]], FACE.mouth);
      dots(f, [[22, 12], [23, 12], [24, 12]], FACE.blush);
      // his cap: a crown and one long point curling back, a gold crescent charm at its tip
      put(f, union(ell(23.5, 5.6, 5.2, 1.8), quad([26, 5], [30, 3], [29, 9], (t) => 3.4 - t * 1.6)), R.pink, { cap: 1.4, base: 5, gain: 3.4 });
      const cres = new Bmp(6, 6); cres.draw(['.cc.', 'c...', 'c...', '.cc.'], 1, 1, { c: R.gold[5] }); f.blit(cres.outline(INK), 26, 8);
      // the tiny ringed planet circling his cap: a 3-px ball and a clean 1-px ring
      const pl = new Bmp(9, 7); pl.draw(['.ooo.', 'ooooo', '.ooo.'], 2, 2, { o: R.ember[5] }); pl.set(3, 2, R.ember[7]);
      pl.draw(['XX.....XX'], 0, 3, { X: R.ember[7] });
      f.blit(pl.outline(INK), 13, 0);
      return finish(f);
    },
  });

  // ---- Palm Reader: a jester's big open palm, fingers up, at the lower right, two matching 5s resting in it and
  // glowing; a reader in a violet shawl leans in from the upper left, eyes cast down on it, a knowing smile; a candle
  // burns beside her. Candlelit ember-maroon ground.
  A.joker('palmreader', {
    rarity: 'uncommon',
    ground: ['#4A1A14', '#5E2218', '#742C1C', '#8A3822'], glow: [22, 21, 10], speck: [R.gold[5], R.ember[6]],
    ...lit({
      draw(k) {
        const f = new Bmp(W, W), P = SKIN.pale;
        // the reader: a violet shawl over her head and shoulders, falling to the bottom left
        put(f, union(ell(8.5, 9, 8, 8), rr(-2, 12, 13, 34, 5)), R.vio, { cap: 3, base: 4, gain: 3.4 });
        fill(f, M((x, y) => (x * 2 + y) % 9 === 0 && y >= 2 && f.get(x, y) && f.get(x, y) !== INK && f.get(x, y) !== R.vio[2]), R.vio[3]);
        // her face in the shawl's opening, turned down to the hand: lids lowered, a knowing smile
        skin(f, ell(9.5, 10.5, 4.2, 4.6), SKIN.gold, { cap: 2.6 });
        dots(f, [[7, 10], [8, 10], [11, 10], [12, 10]], INK);
        dots(f, [[7, 9], [8, 9], [11, 9], [12, 9]], SKIN.gold[2]);
        dots(f, [[9, 13], [10, 13], [11, 12]], FACE.mouth);
        dots(f, [[6, 12], [13, 12]], FACE.blush);
        // the candle beside her, its flame
        put(f, rr(3, 24, 6, 29, 1), R.cream.slice(1), { cap: 1.4, base: 5, gain: 3 });
        put(f, rr(2, 29, 7, 30), R.brass, { cap: 1, base: 3, gain: 3 });
        f.draw(['.r.', '.o.', 'oao', 'oyo', '.o.'], 3, 18, { r: '#E8461C', o: R.ember[5], a: R.ember[6], y: R.money[6] });
        // the jester's open hand, palm to us, fingers up (each its own inked finger), the thumb out to the left
        skin(f, union(rr(17, 17, 28, 32, 3), seg([17.5, 23], [14, 18.5], 3)), P, { cap: 3 });
        [[18, 11], [21, 9], [24, 10], [27, 12]].forEach(([x, y]) => skin(f, rr(x - 1, y, x, 18, 1), P, { cap: 1, base: 4, gain: 3 }));
        // two palm lines in red
        fill(f, M((x, y) => (y === 19 && x >= 21 && x <= 25) || (y === 20 && x >= 19 && x <= 20)), R.mult[3]);
        // two matching 5s resting in the palm
        const five = (x, y) => { const c = card(5, 7); glyph(c, '5', 1, 1, R.red[2]); f.blit(c, x, y); };
        five(17, 22); five(23, 21);
        return finish(f);
      },
    }, (k, b, free) => {
      // candlelight round the flame
      for (let y = 12; y < 31; y++) for (let x = 0; x < 12; x++) { const d = Math.hypot(x - 4, y - 20); if (d <= 5.5) glowAt(b, free, [[x, y]], d <= 3.6 ? '#FFA45858' : '#FFA4582A'); }
      // the cards glow warm
      for (let y = 6; y < 31; y++) for (let x = 12; x < 31; x++) { const d = Math.hypot(x - 22, (y - 24) * 1.1); if (d <= 10.5) glowAt(b, free, [[x, y]], d <= 8.5 ? '#FFE07A3C' : '#FFE07A1E'); }
    }),
  });

  // ---- Crystal Gazer: a jester in a gold-starred violet turban (two gold bells on its tail) and a cream ruff, hands
  // spread round a glowing crystal orb on a velvet cushion; the orb lights his face from below in ghost blue, its glow
  // in his wide eyes, brows up, mouth open in awe; a tiny Tarot card floats inside. Violet ground, kept cool.
  A.joker('crystalgazer', {
    rarity: 'uncommon',
    ground: ['#24124A', '#2E1860', '#3A1E76', '#46268C'], glow: [15, 21, 10], speck: [R.ghost[5], R.gold[5]],
    ...lit({
      draw(k) {
        const f = new Bmp(W, W), S = SKIN.tan, G = R.ghost;
        // shoulders in a navy robe, a cream ruff
        put(f, rr(2, 15, 29, 34, 6), R.navy, { cap: 3, base: 4, gain: 3.4 });
        frills(f, [11, 15, 19], 14.5, 2.2);
        // the turban's tail hanging down by his right cheek, two gold bells on its end
        put(f, quad([20, 4], [24, 7], [23, 12], (t) => 3.4 - t * 1.2), R.vio, { cap: 1.4, base: 5, gain: 3.4 });
        f.blit(bell(1.5), 20, 11); f.blit(bell(1.5), 24, 11);
        // the head, lit from below by the orb: ghost-blue light on the chin, the cheekbones and the brow ridge
        skin(f, ell(15.5, 8.5, 5.6, 5), S, { cap: 3 });
        dots(f, [[14, 13], [15, 13], [16, 13], [17, 13]], G[5]);
        dots(f, [[11, 11], [20, 11], [10, 10], [21, 10]], G[5]);
        // eyes wide with the orb's glow in them, brows raised, the mouth an awed O
        f.rect(13, 8, 2, 2, G[6]); f.rect(17, 8, 2, 2, G[6]); f.set(13, 8, C.white); f.set(17, 8, C.white); f.set(14, 9, G[4]); f.set(18, 9, G[4]);
        brow(f, [[12, 6], [13, 5], [14, 5], [17, 5], [18, 5], [19, 6]], INK);
        dots(f, [[13, 7], [14, 7], [17, 7], [18, 7]], G[5]);
        f.rect(15, 11, 2, 2, FACE.throat); dots(f, [[15, 10], [16, 10]], FACE.mouth);
        // the turban: violet folds, a gold star and a red jewel on its front
        put(f, union(ell(15.5, 3.6, 6.6, 2.8), circ(15.5, 1.8, 3)), R.vio, { cap: 2.4, base: 5, gain: 3.6, tilt: (x, y) => ((x + y) % 4 < 2 ? 0.5 : -0.4) });
        f.draw(['.s.', 'sss', '.s.'], 9, 1, { s: R.gold[5] }); f.draw(['.s.', 'sss', '.s.'], 19, 0, { s: R.gold[5] });
        put(f, circ(15.5, 4.6, 1.3), R.mult, { cap: 1, base: 5, gain: 3 });
        // the velvet cushion with gold tassels
        put(f, ell(15.5, 28, 11, 3), R.vio.slice(0, 6), { cap: 2, base: 3, gain: 3.4 });
        f.blit(bell(1.5), 2, 26); f.blit(bell(1.5), 25, 26);
        // hands spread either side of the orb, lit blue on their inner edges
        skin(f, union(ell(6.5, 21, 2, 3.4), ell(24.5, 21, 2, 3.4)), S, { cap: 1.6 });
        dots(f, [[8, 20], [8, 21], [8, 22], [23, 20], [23, 21], [23, 22]], G[5]);
        // the orb, the brightest thing on the card, a tiny Tarot card floating inside it
        put(f, circ(15.5, 21, 6.6), G, { cap: 4, base: 4, gain: 3.6 });
        const t = card(3, 5, { face: R.vio[5], hi: R.vio[7], lo: R.vio[3] }); t.set(2, 3, R.money[7]); f.blit(t, 14, 19);
        dots(f, [[12, 17], [11, 18], [12, 18]], C.white);
        return finish(f, [[13, 8], [17, 8]]);
      },
    }, (k, b, free) => {
      // the orb's glow, two steps of ghost blue round it
      for (let y = 8; y < 31; y++) for (let x = 2; x < 30; x++) { const d = Math.hypot(x - 15.5, y - 21); if (d <= 11 && d > 7.4) glowAt(b, free, [[x, y]], d <= 9.2 ? '#AED8F058' : '#AED8F028'); }
    }),
  });

  // ---- Paymaster: a stern jester clerk at a little desk under a lime eyeshade visor, sleeve garters on his arms, a
  // quill tucked behind his ear, dropping coins into a row of five tiny cream pay envelopes beside a stack of coins.
  // Purple ground: the steel-blue counting house read as navy plus money, and the brief's maroon made him Pawnbroker's
  // twin (a man at a wooden counter, yellow balls at the upper left).
  A.joker('paymaster', {
    rarity: 'uncommon',
    ground: ['#40145A', '#4E1A6C', '#5C207E', '#6A2890'], glow: [15, 12, 13], speck: [R.money[6], R.cream[6]],
    draw(k) {
      const f = new Bmp(W, W), S = SKIN.deep;
      // the quill behind his ear
      put(f, quad([22, 13], [26, 6], [29, 1], 2.6), R.cream.slice(2), { cap: 1, base: 4, gain: 3 });
      fill(f, seg([22, 13], [28, 2], 1), R.cream[3]);
      // shoulders: a plum waistcoat over a cream shirt, arms in shirtsleeves with red garters
      put(f, rr(3, 18, 27, 34, 5), R.cream.slice(1), { cap: 3, base: 4, gain: 3 });
      put(f, union(poly([[5, 19], [12, 19], [15, 26], [5, 30]]), poly([[26, 19], [19, 19], [16, 26], [26, 30]])), PLUM, { cap: 2, base: 4, gain: 3.4 });
      dots(f, [[14, 22], [15, 24]], R.gold[5]);
      fill(f, M((x, y) => y === 21 && ((x >= 3 && x <= 6) || (x >= 24 && x <= 27))), R.mult[4]);
      // the head: stern brows, eyes on his work, a flat mouth; hair at the sides
      skin(f, union(circ(15.5, 11.5, 5.8), ell(21.6, 12, 1.4, 2)), S, { cap: 3.4 });
      put(f, union(ell(10.2, 11, 1.4, 3), ell(20.6, 10, 1.2, 2.4)), R.wood.slice(0, 4), { cap: 1, base: 2, gain: 3 });
      brow(f, [[11, 9], [12, 9], [13, 10], [18, 10], [19, 9], [20, 9]], INK);
      f.rect(12, 11, 2, 2, C.white); f.rect(18, 11, 2, 2, C.white); dots(f, [[12, 12], [13, 12], [18, 12], [19, 12]], INK);
      dots(f, [[14, 15], [15, 15], [16, 15], [17, 15]], INK); dots(f, [[15, 16], [16, 16]], FACE.mouth);
      dots(f, [[13, 16], [18, 16]], S[2]);
      // the eyeshade: a lime visor band round his brow, its translucent peak casting a green shade
      put(f, union(ell(15.5, 6.6, 7.2, 2), rr(8, 5, 23, 6)), R.lime, { cap: 1.4, base: 5, gain: 3.2 });
      fill(f, M((x, y) => y === 8 && x >= 10 && x <= 21 && f.get(x, y) && f.get(x, y) !== INK), S[3]);
      // the desk, a stack of coins at the left, five tiny pay envelopes in a row
      put(f, rr(0, 23, 30, 30), R.wood, { cap: 2, base: 3, gain: 3.4 });
      fill(f, M((x, y) => y === 23 && x >= 1 && x <= 29), R.wood[5]);
      [0, 1, 2, 3].forEach((i) => put(f, rr(1, 21 - i * 2, 6, 22 - i * 2, 1), R.money, { cap: 1, base: 5, gain: 3 }));
      const env = (x, y) => { const e = card(4, 4, { face: C.cream, hi: C.white, lo: C.cream2, square: true }); e.set(1, 2, C.cream4); e.set(2, 3, C.cream4); e.set(3, 3, C.cream4); e.set(4, 2, C.cream4); f.blit(e, x, y); };
      [9, 13, 17, 21, 25].forEach((x, i) => env(x, 24 + (i % 2)));
      // his hand dropping a coin into the middle one
      hand(f, 'fist', 17, 18, S);
      f.blit(coin(2), 17, 20);
      return finish(f);
    },
  });

  // ---- Face Value: a brass balance scale tipped down on the left, where a King, a Queen and a Jack stand in the pan
  // (the King's crown tipping off); the right pan rides high with a heap of coins. No $, no machine. Burnt-orange ground.
  A.joker('facevalue', {
    rarity: 'uncommon',
    ground: ['#5E200C', '#762A10', '#8E3414', '#A43E18'], glow: [15, 15, 13], speck: [R.money[6], R.cream[6]],
    draw(k) {
      const f = new Bmp(W, W);
      // the wooden foot and the brass post
      put(f, union(rr(11, 29, 20, 30, 1), rr(13, 27, 18, 28, 1)), R.wood, { cap: 1.4, base: 3, gain: 3.4 });
      put(f, rr(15, 4, 16, 26), R.brass, { cap: 1, base: 4, gain: 3 });
      // the right pan rides high on two cords, a heap of three coins in it
      f.line(24, 4, 18, 22, INK); f.line(24, 4, 29, 22, INK);
      put(f, ell(23.5, 22.6, 6.2, 1.5), R.brass, { cap: 1, base: 4, gain: 3.4 });
      [[17, 13], [22, 13], [19, 7]].forEach(([x, y]) => f.blit(coin(3), x, y));
      // the left pan sinks: its cords hide behind the cards; the Queen and the Jack stand in front, the King behind
      f.line(9, 7, 3, 25, INK); f.line(9, 7, 15, 25, INK);
      const face = (x, y, ch, col, h = 9) => { const c = card(7, h); glyph(c, ch, 2, 2, col); f.blit(c, x, y); };
      face(5, 7, 'K', R.red[2], 8);
      face(1, 16, 'Q', R.red[2]);
      face(9, 16, 'J', R.dark[1]);
      put(f, ell(9, 26.6, 7.4, 1.6), R.brass, { cap: 1, base: 4, gain: 3.4 });
      // the King's crown tipping off up-left, a pixel clear of his card: three points, a band and a red jewel
      const crown = new Bmp(7, 6);
      crown.draw(['a.a.a', 'bbbbb', 'brcrb', 'ddddd'], 1, 1, { a: R.gold[5], b: R.gold[4], c: R.gold[5], r: R.mult[5], d: R.gold[2] });
      f.blit(crown.outline(INK), 0, 0);
      // the beam, tipped down on the left, a knob on each end and a finial on the pivot
      put(f, union(seg([9.5, 5.4], [24, 2.6], 2.2), circ(9.2, 5.5, 1.3), circ(24.4, 2.4, 1.3)), R.brass, { cap: 1.2, base: 4, gain: 3.4 });
      put(f, circ(15.5, 3.2, 1.5), R.brass, { cap: 1.2, base: 5, gain: 3.4 });
      return finish(f);
    },
  });
})();
