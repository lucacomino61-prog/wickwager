/* Jokers, artist b: thirty Commons, in the Ember Lit style of 40-jokers-lit.js.
 * Each entry is a 31 x 31 figure on a 4-colour ground (dark to light, drawn light at the top), a glow pool
 * [x, y, r] and speck colours. The core adds the rarity frame, gems, ground, glow, specks, the ink outline
 * round the figure and the empty name plate. Inside a figure, parts that meet are separated with ink.
 * Helpers shared by this file live in TW.Art.lib.b.
 */
(() => {
  'use strict';
  const A = globalThis.TW.Art;
  const { Bmp, Mask, R, C, emboss, disc, ellipse, roundRect, strokeQuad } = A.kit;
  const W = 31;

  // ------------------------------------------------------------ helpers (TW.Art.lib.b)
  const lib = (A.lib.b = A.lib.b || {});
  const M = (fn) => Mask.fn(W, W, fn);
  const ell = (cx, cy, rx, ry) => ellipse(W, W, cx, cy, rx, ry);
  const box = (x0, y0, x1, y1, r = 0, t = 0) => roundRect(W, W, x0, y0, x1, y1, r, t);
  const tube = (p0, p1, p2, w) => strokeQuad(W, W, p0, p1, p2, w);
  const seg = (x0, y0, x1, y1, w) => strokeQuad(W, W, [x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2], [x1, y1], w);
  const or = (...ms) => M((x, y) => ms.some((m) => m.get(x, y)));
  const minus = (a, ...bs) => M((x, y) => a.get(x, y) && !bs.some((b) => b.get(x, y)));
  /** Shade a mask with a ramp, lit from the upper left. */
  const fill = (f, m, ramp, o) => f.blit(emboss(m, ramp, o || {}), 0, 0);
  /** Paint a mask one flat colour. */
  const flat = (f, m, c) => { for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y)) f.set(x, y, c); return f; };
  /** Ink the pixels just outside a mask (4-neighbours), over whatever is there: separates a part from what is behind it. */
  const ring = (f, m, c = C.edge) => {
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.get(x, y)) continue;
      if (m.get(x + 1, y) || m.get(x - 1, y) || m.get(x, y + 1) || m.get(x, y - 1)) f.set(x, y, c);
    }
    return f;
  };
  /** A part in front: inked round, then shaded. */
  const part = (f, m, ramp, o) => { ring(f, m); return fill(f, m, ramp, o); };
  /** Several flat pixels. */
  const pix = (f, list, c) => { list.forEach(([x, y]) => f.set(x, y, c)); return f; };
  /** A mask shaded with two ramps by a pattern (stripes, bands): one height field, so the light runs on unbroken. */
  const fill2 = (f, m, rampA, rampB, pick, o = {}, o2 = o) => {
    const a = emboss(m, rampA, o), b = emboss(m, rampB, o2);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y)) f.set(x, y, pick(x, y) ? b.get(x, y) : a.get(x, y));
    return f;
  };
  /** A jester-cap prong: a shaded tube that thins toward its tip (as the classic Jingle Jester's). */
  const prong = (f, p0, p1, p2, ramp, w0 = 5.2, w1 = 2.6) => fill(f, tube(p0, p1, p2, (t) => w0 - t * (w0 - w1)), ramp, { cap: 2, base: 5, gain: 4.4 });
  /** A gold bell, 5 x 5 with its top-left at (x, y): a shaded ball with a glint and a dark slit. Made on first use. */
  let BELL = null;
  const bell = (f, x, y, inked = true) => {
    BELL = BELL || emboss(disc(2.6), R.gold, { cap: 2, base: 4, gain: 4.6 });
    if (inked) ring(f, M((i, j) => !!BELL.get(i - x + 1, j - y + 1)));
    f.blit(BELL, x - 1, y - 1);
    f.set(x + 1, y + 1, R.gold[6]); f.set(x + 1, y + 3, C.edge); f.set(x + 2, y + 3, C.edge);
    return f;
  };
  /** A 3 x 3 bell for small figures. */
  const bellS = (f, x, y) => { ring(f, M((i, j) => i >= x && i <= x + 2 && j >= y && j <= y + 2)); f.rect(x, y, 3, 3, R.gold[4]); f.set(x, y, R.gold[6]); f.set(x + 2, y + 2, R.gold[2]); f.set(x + 1, y + 2, C.edge); return f; };
  /** Skin ramps, dark to light (peach is the classic Jingle Jester's). */
  const SKIN = {
    peach: ['#6A2A1C', '#94442E', '#C06446', '#DE845C', '#F2A272', '#FCC090', '#FFDDB8'],
    tan: ['#4A2216', '#6E3620', '#94502E', '#B46A3C', '#CC844E', '#E2A066', '#F2BE88'],
    brown: ['#2A120C', '#46200F', '#62301C', '#7E4428', '#985A36', '#B07246', '#C88C5C'],
    rose: ['#7A3A34', '#A85A4E', '#D08070', '#E8A08A', '#F6BCA4', '#FFD6C2', '#FFEDE0'],
  };
  /** A warm grey for fur, whiskers and moth wings. */
  const GREY = ['#2E2630', '#463C46', '#5E545C', '#7A6E74', '#968A8C', '#B4A8A6', '#D2C8C2', '#EEE6E0'];
  /** A small playing card (w x h, cream, inked edge, 1-px cut corners) with a rank glyph top left and a 7 x 7 pip
      low on the right, clear of the glyph. */
  const miniCard = (w, h, glyph, suit) => {
    const m = Mask.fn(w, h, (i, j) => !((i === 0 || i === w - 1) && (j === 0 || j === h - 1)));
    const c = A.kit.cardShape({ mask: m });
    const col = suit === 'H' || suit === 'D' ? R.red[3] : R.dark[2];
    if (glyph) A.kit.FONTS.S.g[glyph].forEach((row, j) => row.forEach((on, i) => { if (on) c.set(2 + i, 2 + j, col); }));
    if (suit) c.blit(A.kit.pipBmp(suit, 7), w - 9, h - 8);
    return c;
  };
  /** Window-space pixel for overlays (the art window's top-left is card pixel (5, 7)), clipped to the window. */
  const win = (b, x, y, c) => { if (x >= 0 && y >= 0 && x < 31 && y < 31) b.mix(5 + x, 7 + y, c); };
  /** A jester's hood on a head centred (cx, cy) with radii (rx, ry): a dome in two colours split down the middle,
      down to the brow row, with a 2-row band along its rim. Draw prongs first (behind it). Returns the dome mask. */
  const hood = (f, cx, cy, rx, ry, brow, rampL, rampR, band = R.gold) => {
    const dome = M((x, y) => y <= brow && ((x - cx) / (rx + 0.7)) ** 2 + ((y - cy) / (ry + 0.9)) ** 2 <= 1);
    ring(f, dome);
    fill2(f, dome, rampL, rampR, (x) => x > cx, { cap: 2.5, base: 5, gain: 4 });
    if (band) fill(f, M((x, y) => dome.get(x, y) && y >= brow - 1), band, { cap: 1, base: 4, gain: 3.2 });
    return dome;
  };
  /** A cream ruff of scallops along a row: centres every `step` px from x0 to x1 at row y, radius r. */
  const ruff = (f, x0, x1, y, r = 2.6, step = 4, ramp = R.cream) => {
    const cs = []; for (let x = x0; x <= x1 + 0.01; x += step) cs.push(x);
    const m = M((x, yy) => yy >= y - r + 0.6 && cs.some((c) => (x - c) ** 2 + (yy - y) ** 2 <= r * r + 0.4));
    part(f, m, ramp, { cap: 1.6, base: ramp.length - 3, gain: 3.4 });
    return m;
  };
  Object.assign(lib, { M, ell, box, tube, seg, or, minus, fill, flat, ring, part, pix, fill2, prong, bell, bellS, SKIN, GREY, miniCard, win, hood, ruff });

  // ------------------------------------------------------------ 1. Portrait Gallery: three gilt frames hung salon-style on a
  // maroon wall, each on a cord from a nail: the King centre-top, the Queen and a Jack poking his tongue out below
  A.joker('portraitgallery', {
    ground: ['#3A0C20', '#4C142C', '#5E1C38', '#702644'], glow: [15, 14, 15], speck: [R.money[6], R.pink[6]],
    draw() {
      const f = new Bmp(W, W), sk = SKIN.peach;
      /** A gilt frame (2-px gold, a 1-px dark inner lip, lit corner bosses) round an 8 x 8 painting. */
      const frame = (x0, y0, bg, rows, key) => {
        const x1 = x0 + 13, y1 = y0 + 13;
        ring(f, box(x0, y0, x1, y1));
        fill(f, box(x0, y0, x1, y1, 0, 2), R.gold, { cap: 1, base: 4, gain: 3 });
        for (let y = y0 + 2; y <= y1 - 2; y++) for (let x = x0 + 2; x <= x1 - 2; x++) f.set(x, y, R.gold[0]);
        for (let y = y0 + 3; y <= y1 - 3; y++) for (let x = x0 + 3; x <= x1 - 3; x++) f.set(x, y, y === y0 + 3 || x === x0 + 3 ? bg[0] : bg[1]);
        f.draw(rows, x0 + 3, y0 + 3, key);
        [[x0, y0], [x1 - 1, y0], [x0, y1 - 1], [x1 - 1, y1 - 1]].forEach(([x, y]) => { f.rect(x, y, 2, 2, R.gold[5]); f.set(x, y, R.gold[6]); f.set(x + 1, y + 1, R.gold[3]); });
      };
      const cord = (pts) => pts.forEach(([x, y]) => f.set(x, y, R.gold[3]));
      const nail = (x, y) => { f.rect(x, y, 2, 1, R.steel[3]); f.set(x, y, R.steel[5]); };
      const face = { s: sk[4], S: sk[3], e: C.edge, k: C.edge };
      // the Queen, below left, on a cord from a nail beside the King
      cord([[2, 13], [3, 13], [3, 12], [4, 12], [4, 11], [5, 11]]); nail(5, 10);
      frame(0, 14, ['#0E3016', '#1A4622'], [
        '..yuuy..',
        '.hhyyhh.',
        '.hssssh.',
        '.hesseh.',
        '.hssssh.',
        '.hsmmsh.',
        'hhhsshhh',
        'hHppppHh',
      ], { ...face, y: R.gold[4], u: R.gold[6], h: '#8A3A28', H: '#5E1E18', m: R.mult[4], p: R.pink[5] });
      // the Jack, below right, his tongue out
      cord([[28, 14], [27, 14], [27, 13], [26, 13], [26, 12], [25, 12]]); nail(24, 11);
      frame(17, 15, ['#3E0A16', '#56101E'], [
        '..rrrrl.',
        '.RRRRRRl',
        '.hsssssh',
        '.hkkssks',
        '.ssssss.',
        '..smmms.',
        '...tt...',
        '.cccccc.',
      ], { ...face, l: R.lime[6], r: R.chips[5], R: R.chips[3], h: '#A8461A', m: '#3E0A1A', t: R.pink[5], c: R.cream[6] });
      // the King, centre top, on a cord from the top nail
      cord([[10, 1], [11, 1], [12, 1], [13, 1], [13, 0], [19, 1], [18, 1], [17, 1], [16, 1], [16, 0]]); nail(14, 0);
      frame(8, 2, ['#10143C', '#1B2058'], [
        '.u.uu.u.',
        '.yygyyy.',
        '.ssssss.',
        '.sesses.',
        '.wsssSw.',
        '.wwmmww.',
        'rwwwwwwr',
        'rrwwwwrr',
      ], { ...face, y: R.gold[4], u: R.gold[5], g: R.pink[5], w: R.cream[7], W: R.cream[4], m: '#7A2A22', r: R.mult[4] });
      return f;
    },
  });

  // ------------------------------------------------------------ 2. Peek-a-Boo: a jester peeking over a pair of nines,
  // one black and one red, on a red-plum ground
  A.joker('peekaboo', {
    ground: ['#2E0E26', '#3E1432', '#4E1A3E', '#5E224A'], glow: [15, 11, 13], speck: [R.chips[7], R.pink[6]],
    draw() {
      const f = new Bmp(W, W), sk = SKIN.rose;
      // the hood's two prongs curl out to bells in the top corners
      prong(f, [12, 6], [6, 6], [4, 4], R.pink, 5, 2.8);
      prong(f, [18, 6], [24, 6], [26, 4], R.lime, 5, 2.8);
      bell(f, 1, 1); bell(f, 25, 1);
      // her head, only the top showing over the cards
      fill(f, ell(15, 12, 8.5, 7.5), sk, { cap: 3, base: 4, gain: 4.2 });
      hood(f, 15, 12, 8.5, 7.5, 9, R.pink, R.lime);
      // wide eyes peeking, looking right
      [[9, 11], [18, 11]].forEach(([x, y]) => {
        f.rect(x, y, 4, 3, C.white); f.set(x, y + 2, '#E8D6DC');
        f.rect(x + 2, y, 2, 3, C.edge); f.set(x + 2, y, '#5A2D4C');
        pix(f, [[x - 1, y], [x - 1, y + 1], [x, y - 1], [x + 1, y - 1], [x + 2, y - 1], [x + 3, y - 1], [x + 4, y]], C.edge);
      });
      pix(f, [[22, 12], [23, 11]], C.edge);
      // the pair: two nines, one black and one red, fanned
      f.blit(miniCard(14, 16, '9', 'C'), 2, 15);
      f.blit(miniCard(14, 17, '9', 'D'), 15, 14);
      // fingertips curled over the top edges
      [[4, 14], [7, 14], [23, 13], [26, 13]].forEach(([x, y]) => {
        f.rect(x, y, 2, 2, sk[4]); f.set(x, y, sk[5]);
        pix(f, [[x - 1, y], [x - 1, y + 1], [x + 2, y], [x + 2, y + 1], [x, y - 1], [x + 1, y - 1]], C.edge);
      });
      return f;
    },
  });

  // ------------------------------------------------------------ 3. Early Bird: a round orange songbird in a striped
  // nightcap perched on a brass alarm clock at midnight, one sleepy eye half open
  A.joker('earlybird', {
    ground: ['#20106A', '#2A167E', '#341E92', '#3E26A4'], glow: [15, 14, 14], speck: [R.money[7], R.vio[7]],
    draw() {
      const f = new Bmp(W, W);
      // the alarm clock: two bells on its top corners, a brass rim round a cream face, both hands at twelve, feet
      [[8, 29], [17, 29]].forEach(([x, y]) => part(f, box(x, y - 1, x + 1, y), R.brass, { cap: 1, base: 3, gain: 3 }));
      [[8.5, 18.6], [17.5, 18.6]].forEach(([x, y]) => part(f, M((i, j) => ((i - x) / 2.8) ** 2 + ((j - y) / 2.4) ** 2 <= 1 && j <= y + 0.6), R.gold, { cap: 1.5, base: 4, gain: 4 }));
      part(f, ell(13, 23.4, 5.6, 5.4), R.brass, { cap: 2, base: 4, gain: 4 });
      fill(f, ell(13, 23.4, 3.9, 3.7), R.cream, { cap: 1.5, base: 6, gain: 2.2 });
      ring(f, ell(13, 23.4, 3.9, 3.7), R.brass[2]);
      f.rect(13, 20, 1, 4, C.edge); f.set(14, 23, C.edge);
      pix(f, [[16, 23], [13, 26], [10, 23]], R.cream[2]);
      // the tail, flicked up behind
      part(f, tube([21, 13], [25, 12], [27, 8], (t) => 3.6 - t * 1.6), R.ember.slice(1, 7), { cap: 1.5, base: 3, gain: 3.2 });
      // the bird: a round orange body, a pale breast, a darker wing
      const body = ell(15.5, 12.2, 7, 5.2);
      part(f, body, R.ember.slice(1, 8), { cap: 4, base: 4, gain: 3.4 });
      fill(f, M((x, y) => body.get(x, y) && ((x - 12) / 4.4) ** 2 + ((y - 14) / 3.4) ** 2 <= 1), R.ember.slice(4), { cap: 2, base: 2, gain: 2.4 });
      part(f, M((x, y) => ((x - 18.5) / 4) ** 2 + ((y - 12) / 2.8) ** 2 <= 1 && x >= 15), R.ember.slice(0, 6), { cap: 1.5, base: 3, gain: 3 });
      pix(f, [[17, 13], [18, 13], [19, 12], [20, 12]], R.ember[1]);
      // feet gripping the clock's top
      pix(f, [[12, 17], [14, 17], [11, 18], [12, 18], [14, 18], [15, 18]], R.money[3]);
      // a big sleepy eye, half lidded, and a short wedge beak pointing left
      f.rect(10, 10, 3, 1, C.edge); f.set(10, 11, C.white); f.rect(11, 11, 2, 1, C.edge);
      const beak = M((x, y) => (y === 12 && x >= 6 && x <= 8) || (y === 13 && x >= 7 && x <= 8));
      ring(f, beak); pix(f, [[6, 12], [7, 12], [8, 12]], R.money[6]); pix(f, [[7, 13], [8, 13]], R.money[3]);
      f.rect(11, 13, 2, 1, R.pink[6]);
      // the striped nightcap, flopped back over the head, its pom-pom hanging behind
      const cap = or(M((x, y) => body.get(x, y) && y <= 8 && x >= 10), tube([14, 6], [19, 1.5], [22, 7], (t) => 5.6 - t * 3.2));
      ring(f, cap);
      fill2(f, cap, R.pink, R.cream, (x, y) => ((x + y) % 6) < 3, { cap: 2, base: 5, gain: 3.6 }, { cap: 2, base: 6, gain: 3.2 });
      part(f, M((x, y) => body.get(x, y) && y >= 7 && y <= 8 && x >= 10), R.cream, { cap: 1, base: 6, gain: 2.4 });
      part(f, ell(22.6, 8.6, 2.1, 2.1), R.cream, { cap: 2, base: 6, gain: 3 });
      return f;
    },
  });

  // ------------------------------------------------------------ 4. Prize Rosette: an ember and ivory rosette with a flat
  // yellow coin at its heart (no $, no gold ramp round the money), two ribbon tails, ember and gold, ending in bells
  A.joker('prizerosette', {
    ground: ['#3E1016', '#52181E', '#662028', '#7A2A32'], glow: [15, 11, 13], speck: [R.money[6], R.ember[7]],
    draw() {
      const f = new Bmp(W, W), cx = 15, cy = 11;
      const ang = (x, y) => Math.atan2(y - cy, x - cx), rad = (x, y) => Math.hypot(x - cx, y - cy);
      // the tails, behind
      part(f, M((x, y) => y >= 17 && y <= 26 && x >= 11 - (y - 17) * 0.55 && x <= 15 - (y - 17) * 0.55), R.ember, { cap: 1.5, base: 5, gain: 3.4 });
      part(f, M((x, y) => y >= 17 && y <= 26 && x >= 16 + (y - 17) * 0.55 && x <= 20 + (y - 17) * 0.55), R.gold, { cap: 1.5, base: 4, gain: 3.4 });
      bell(f, 4, 25); bell(f, 21, 25);
      // the pleated outer ring, scalloped
      const N = 16, pleat = (x, y, n) => Math.floor(((ang(x, y) + Math.PI) / (2 * Math.PI)) * n) % 2;
      const outer = M((x, y) => rad(x, y) <= 10.4 - 0.7 * Math.cos(ang(x, y) * N));
      part(f, outer, R.ember, { cap: 4, base: 5, gain: 3.6, tilt: (x, y) => (pleat(x, y, N) ? 0.7 : -0.5) });
      const mid = M((x, y) => rad(x, y) <= 6.6);
      part(f, mid, R.cream, { cap: 3, base: 5, gain: 3.6, tilt: (x, y) => (pleat(x, y, 12) ? 0.6 : -0.6) });
      // the coin: flat money yellow, one amber rim, a glint (cash is never a gold ramp, and never a $)
      const coin = M((x, y) => rad(x, y) <= 4.3);
      ring(f, coin);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (coin.get(x, y)) f.set(x, y, rad(x, y) > 3.3 ? R.money[2] : R.money[5]);
      f.set(cx - 2, cy - 2, C.white); f.set(cx - 1, cy - 2, R.money[7]);
      return f;
    },
  });

  // ------------------------------------------------------------ 5. Doorman: a smiling doorman in a violet livery coat and a
  // peaked cap with one belled point, holding a door open on a warm lit doorway, a coin glinting in his gloved palm
  A.joker('doorman', {
    ground: ['#2C0812', '#3C0C1A', '#4A1020', '#5A1426'], glow: [21, 15, 13], speck: [R.money[6], R.cream[6]],
    draw() {
      const f = new Bmp(W, W), sk = SKIN.peach;
      // the doorway: a wooden frame round a narrow lit opening, dimmed so the doorman stays the brightest thing
      fill(f, box(0, 2, 9, 30), R.wood, { cap: 1, base: 3, gain: 3 });
      const light = ['#FFE0B0', '#FFD29C', '#FFC07A', '#FFA458', '#E8863C'];
      for (let y = 4; y <= 30; y++) for (let x = 2; x <= 7; x++) f.set(x, y, light[Math.min(4, Math.floor((y - 4) / 6))]);
      // the door leaf swung open toward us, with a brass knob
      part(f, M((x, y) => x >= 8 && x <= 12 && y >= 3 - (x - 8) * 0.5 && y <= 30), R.wood, { cap: 1.5, base: 4, gain: 3.4 });
      f.rect(10, 6, 2, 8, R.wood[3]); f.rect(10, 18, 2, 10, R.wood[3]);
      f.rect(8, 16, 2, 2, R.gold[5]); f.set(9, 17, R.gold[2]);
      // the violet livery coat, two rows of 2 x 2 gold buttons, gold braid at the cuffs
      const coat = M((x, y) => y >= 19 && y <= 30 && x >= 16 - (y - 19) * 0.2 && x <= 27 + (y - 19) * 0.15);
      part(f, coat, R.vio.slice(0, 7), { cap: 3, base: 4, gain: 3.4 });
      f.line(21, 20, 21, 30, R.vio[2]);
      [21, 25, 29].forEach((y) => [18, 23].forEach((x) => { f.rect(x, y, 2, 2, R.gold[4]); f.set(x, y, R.gold[6]); f.set(x + 1, y + 1, R.gold[2]); }));
      // the arm to the door, gloved hand on its edge
      part(f, seg(18, 21, 14, 23, 3), R.vio, { cap: 1.5, base: 4, gain: 3 });
      fill(f, M((x, y) => x === 15 && y >= 21 && y <= 24), R.gold, { cap: 1, base: 4, gain: 3 });
      part(f, box(11, 21, 13, 24, 1), R.cream, { cap: 1, base: 6, gain: 2.6 });
      f.set(18, 22, C.edge);
      // the other arm bent, a coin glinting on the gloved palm
      part(f, tube([25, 20], [30, 22], [28, 25], 3), R.vio, { cap: 1.5, base: 4, gain: 3 });
      fill(f, M((x, y) => y === 24 && x >= 27 && x <= 29), R.gold, { cap: 1, base: 4, gain: 3 });
      part(f, box(23, 25, 29, 26, 0), R.cream, { cap: 1, base: 6, gain: 2.6 });
      part(f, ell(25.5, 23, 1.6, 1.6), R.money, { cap: 1, base: 5, gain: 4 });
      // the ruff, the head: raised brows, a waxed moustache over a welcoming smile, rosy cheeks
      ruff(f, 17, 26, 19, 1.9, 2);
      fill(f, ell(21.5, 14, 4.3, 4.6), sk, { cap: 2.5, base: 4, gain: 4 });
      pix(f, [[19, 13], [19, 14], [24, 13], [24, 14]], C.edge);
      pix(f, [[18, 11], [19, 11], [24, 11], [25, 11]], R.wood[1]);
      f.rect(19, 16, 2, 1, '#6A331B'); f.rect(22, 16, 2, 1, '#6A331B'); pix(f, [[18, 15], [24, 15], [21, 16]], '#6A331B');
      pix(f, [[19, 17], [20, 18], [21, 18], [22, 18], [23, 17]], C.edge);
      pix(f, [[17, 16], [25, 16]], '#FF8FB4');
      // the peaked livery cap: a violet crown, a gold band, a dark peak, one short point flopping back to a bell
      part(f, tube([24, 8], [27.5, 6], [28, 9.5], (t) => 3.6 - t * 1.6), R.pink, { cap: 1.5, base: 5, gain: 3.4 });
      bellS(f, 27, 10);
      part(f, box(17, 6, 25, 9, 1), R.vio, { cap: 2, base: 5, gain: 3.6 });
      part(f, M((x, y) => y === 9 && x >= 17 && x <= 25), R.gold, { cap: 1, base: 4, gain: 3 });
      part(f, M((x, y) => y === 10 && x >= 15 && x <= 23), R.navy, { cap: 1, base: 2, gain: 2 });
      return f;
    },
    overlay(k, b) {
      // the coin's glint
      [[27, 21], [28, 20], [26, 20], [28, 22]].forEach(([x, y], i) => win(b, x, y, i ? '#FFFCF570' : '#FFFCF5E0'));
    },
  });

  // ------------------------------------------------------------ 6. Spinning Top: a red-and-cream top whirling, a jester's
  // face painted on its belly, a blur at its tip
  A.joker('spinningtop', {
    ground: ['#8A3010', '#A43E16', '#BE4C1C', '#D45A22'], glow: [15, 14, 13], speck: [R.ember[8], R.money[7]],
    draw() {
      const f = new Bmp(W, W), cx = 15;
      const hw = (y) => (y < 5 ? -1 : y <= 13 ? 11.5 * Math.sqrt(Math.max(0, 1 - ((13 - y) / 8.6) ** 2)) : y <= 26 ? 11.5 * Math.pow((26 - y) / 13, 0.8) : -1);
      const body = M((x, y) => Math.abs(x - cx) <= hw(y));
      // the stem and knob
      part(f, box(13, 0, 17, 3, 1), R.mult, { cap: 1.5, base: 5, gain: 3.4 });
      part(f, box(14, 3, 16, 6), R.cream, { cap: 1, base: 5, gain: 3 });
      // the body in bands
      ring(f, body);
      const cream = (x, y) => (y >= 8 && y <= 9) || (y >= 12 && y <= 17) || (y >= 21 && y <= 22);
      fill2(f, body, R.mult, R.cream, cream, { cap: 6, base: 5, gain: 4 }, { cap: 6, base: 6, gain: 3.4 });
      // the tip
      f.rect(15, 26, 1, 3, R.steel[3]); f.set(14, 26, R.steel[1]); f.set(16, 26, R.steel[1]);
      // the painted face on the belly: shut happy eyes, rosy cheeks, a grin
      pix(f, [[10, 14], [11, 13], [12, 13], [13, 14], [17, 14], [18, 13], [19, 13], [20, 14]], C.edge);
      f.draw(['k.......k', '.kmmmmmk.', '..kkkkk..'], 11, 15, { k: C.edge, m: R.mult[3] });
      f.rect(7, 15, 2, 1, R.pink[5]); f.rect(22, 15, 2, 1, R.pink[5]);
      return f;
    },
    overlay(k, b) {
      // the blur at its tip, and speed lines round its sides
      [[11, 28], [13, 29], [17, 29], [19, 28], [9, 27], [21, 27]].forEach(([x, y], i) => win(b, x, y, i % 2 ? '#FFF0D8C0' : '#FFD29CC0'));
      [[12, 29], [18, 29], [10, 28], [20, 28]].forEach(([x, y]) => win(b, x, y, '#FFF0D870'));
      for (let y = 9; y <= 14; y++) { win(b, 1, y, '#FFF0D860'); win(b, 29, y + 3, '#FFF0D860'); }
      for (let y = 11; y <= 13; y++) { win(b, 2, y + 6, '#FFF0D890'); win(b, 28, y - 2, '#FFF0D890'); }
    },
  });

  // ------------------------------------------------------------ 7. Brass Abacus: a brass-framed abacus on two feet, round
  // gold and pink beads on steel rods, four pink beads slid to one side, a jester's bell dangling from a pink ribbon
  A.joker('brassabacus', {
    ground: ['#3A1062', '#481676', '#561E8A', '#64269C'], glow: [13, 14, 15], speck: [R.money[7], R.pink[6]],
    draw() {
      const f = new Bmp(W, W);
      // the feet, the frame and a warm wooden backing, four steel rods lit along the top
      [[3, 27], [21, 27]].forEach(([x, y]) => part(f, box(x, y, x + 3, y + 1, 1), R.brass, { cap: 1, base: 3, gain: 3 }));
      flat(f, box(1, 2, 25, 25), R.wood[2]);
      for (let y = 4; y <= 23; y++) for (let x = 3; x <= 23; x++) if ((x + y * 2) % 7 === 0) f.set(x, y, R.wood[1]);
      fill(f, minus(box(0, 1, 26, 26, 1), box(2, 3, 24, 24)), R.brass, { cap: 1.5, base: 4, gain: 3.6 });
      const RODS = [6, 11, 16, 21];
      for (const y of RODS) for (let x = 2; x <= 24; x++) { f.set(x, y, R.steel[5]); f.set(x, y + 1, R.steel[3]); }
      // round beads, 5 x 4, each with a glint: gold at the right, and on the second rod four pink beads slid left
      const bead = (x, y, ramp) => {
        part(f, M((i, j) => i >= x && i <= x + 4 && j >= y - 1 && j <= y + 2 && !((i === x || i === x + 4) && (j === y - 1 || j === y + 2))), ramp, { cap: 1.5, base: 5, gain: 4.2 });
        f.set(x + 1, y - 1, C.white);
      };
      [[6, R.money, [13, 19]], [11, R.pink, [2, 7, 12, 17]], [16, R.money, [8, 14, 20]], [21, R.money, [20]]].forEach(([y, ramp, xs]) => xs.forEach((x) => bead(x, y, ramp)));
      // a pink ribbon from the top corner, and the bell dangling from it
      part(f, tube([26, 3], [29, 4], [28.5, 8], 2), R.pink, { cap: 1, base: 5, gain: 3 });
      bell(f, 26, 10);
      return f;
    },
  });

  // ------------------------------------------------------------ 8. Last Laugh: a jester rolling on the floor, seen from the
  // side: flat on his back, head thrown back laughing, legs kicking in a V, his three-pointed cap tumbling off
  A.joker('lastlaugh', {
    ground: ['#2A1028', '#381634', '#461E40', '#54264C'], glow: [14, 17, 14], speck: [R.chips[7], R.money[6]],
    draw() {
      const f = new Bmp(W, W), sk = SKIN.peach;
      // the floorboards, lit along the top
      fill(f, box(0, 26, 30, 30), R.wood, { cap: 1, base: 3, gain: 3 });
      f.rect(0, 26, 31, 1, R.wood[6]); f.rect(0, 27, 31, 1, R.wood[4]);
      [6, 15, 25].forEach((x) => f.rect(x, 28, 1, 3, R.wood[1]));
      // both legs kicking up in a V from the hip, pink and violet hose, pointed shoes with curled toes
      part(f, seg(21, 23, 26, 13, 3.4), R.vio, { cap: 1.5, base: 5, gain: 3.4 });
      part(f, seg(20, 22, 18, 11, 3.4), R.pink, { cap: 1.5, base: 5, gain: 3.4 });
      part(f, tube([16.5, 10], [21, 10.5], [22, 7], (t) => 3.4 - t * 1.4), R.vio, { cap: 1, base: 5, gain: 3.2 });
      part(f, tube([25, 13.5], [29.5, 13.5], [29.5, 10], (t) => 3.4 - t * 1.4), R.pink, { cap: 1, base: 5, gain: 3.2 });
      pix(f, [[22, 6], [29, 9]], R.lime[7]);
      // the body flat on the floor in a lime suit, hands clutching the belly
      part(f, ell(16, 22.4, 6.2, 3.6), R.lime, { cap: 3, base: 5, gain: 3.8 });
      part(f, seg(12, 21, 14, 19, 2), R.lime, { cap: 1, base: 4, gain: 3 });
      part(f, box(14, 17, 15, 18), sk, { cap: 1, base: 4, gain: 3 });
      part(f, box(17, 17, 18, 18), sk, { cap: 1, base: 4, gain: 3 });
      // the ruff at his neck
      part(f, M((x, y) => [19.6, 22.6].some((c) => (x - 11.6) ** 2 + (y - c) ** 2 <= 3.2)), R.cream, { cap: 1.4, base: 5, gain: 3.2 });
      // the head in profile, face to the sky: the jaw dropped open in a wedge with its teeth and tongue showing,
      // the nose up, an eye squeezed shut, hair at the crown
      const hx = 6, hy = 20.5, deg = (x, y) => (Math.atan2(y - hy, x - hx) * 180) / Math.PI;
      const head = M((x, y) => (x - hx) ** 2 + (y - hy) ** 2 <= 26 || (x === 4 && y === 15) || (x === 5 && y >= 14 && y <= 15));
      const gape = M((x, y) => head.get(x, y) && Math.hypot(x - hx, y - hy) >= 1.2 && deg(x, y) >= -84 && deg(x, y) <= -18);
      part(f, minus(head, gape), sk, { cap: 3, base: 4, gain: 4.2 });
      flat(f, gape, '#3E0A1A');
      ring(f, gape);
      pix(f, [[7, 16], [7, 17], [8, 15]], C.white);
      pix(f, [[8, 18], [9, 18], [9, 19], [10, 19]], '#E8384A');
      pix(f, [[2, 18], [3, 17], [4, 17], [5, 18]], C.edge);
      f.rect(2, 20, 2, 1, '#FF8FB4');
      fill(f, M((x, y) => head.get(x, y) && deg(x, y) >= 118 && deg(x, y) <= 200 && Math.hypot(x - hx, y - hy) >= 3.2), [R.ember[1], R.ember[2], R.ember[3], R.ember[4]], { cap: 1, base: 2, gain: 2 });
      // a tear of laughter flying up
      f.rect(1, 14, 1, 2, R.chips[7]); f.set(1, 14, R.chips[8]);
      // the cap tumbling upside down above him: a band, a dome, three points hanging with bells
      part(f, box(2, 1, 11, 2, 1), R.pink, { cap: 1, base: 5, gain: 3 });
      part(f, M((x, y) => y >= 3 && y <= 4 && x >= 3 + (y - 3) && x <= 10 - (y - 3)), R.vio, { cap: 1.5, base: 5, gain: 3.4 });
      prong(f, [4, 4], [1.5, 4.5], [1.5, 7], R.vio, 2.8, 2);
      prong(f, [6.5, 4], [6.5, 6], [6.5, 7.5], R.lime, 2.8, 2);
      prong(f, [9, 4], [11.5, 4.5], [11.5, 7], R.vio, 2.8, 2);
      const bell2 = (x, y) => { ring(f, box(x, y, x + 1, y + 1)); f.rect(x, y, 2, 2, R.gold[4]); f.set(x, y, R.gold[6]); f.set(x + 1, y + 1, R.gold[2]); };
      bell2(1, 8); bell2(6, 9); bell2(11, 8);
      return f;
    },
    overlay(k, b) {
      // the cap's tumble and the kick: a few motion ticks
      [[14, 2], [15, 3], [15, 5], [0, 5], [17, 4], [16, 9], [25, 0], [29, 2]].forEach(([x, y]) => win(b, x, y, '#FFE3F0A0'));
    },
  });

  // ------------------------------------------------------------ 9. Dartboard: an ember, cream and maroon board, a pink-
  // feathered dart in the bull, a jester cap hung on the dart's tail with its belled points dangling past the board
  A.joker('dartboard', {
    ground: ['#2C0E5A', '#3A146E', '#481A82', '#562294'], glow: [13, 17, 14], speck: [R.pink[6], R.cream[6]],
    draw() {
      const f = new Bmp(W, W), cx = 12, cy = 18;
      const ang = (x, y) => Math.atan2(y - cy, x - cx), rad = (x, y) => Math.hypot(x - cx, y - cy);
      const wedge = (x, y) => Math.floor(((ang(x, y) + Math.PI) / (2 * Math.PI)) * 16 + 0.5) % 2;
      const board = M((x, y) => rad(x, y) <= 12.4);
      fill(f, board, R.maroon, { cap: 2.5, base: 3, gain: 3.4 });
      // singles alternate ember and cream between maroon treble and double rings; a cream ring round a red bull
      const em = emboss(board, R.ember, { cap: 12, base: 5, gain: 2.4 }), cr = emboss(board, R.cream, { cap: 12, base: 6, gain: 2.4 });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const r = rad(x, y);
        if (r > 10.4) continue;
        f.set(x, y, r <= 1.5 ? R.mult[5] : r <= 3.1 ? R.cream[6] : (r > 6 && r <= 7.2) || r > 9.2 ? R.maroon[2] : wedge(x, y) ? em.get(x, y) : cr.get(x, y));
      }
      ring(f, board);
      f.set(11, 17, C.white); f.set(13, 19, R.mult[3]);
      // the dart: a steel point into the bull, a brass barrel, a shaft, pink flights at its tail
      part(f, or(seg(23, 1, 29, 7, 2.6), seg(23, 7, 29, 1, 2.6)), R.pink, { cap: 1.2, base: 5, gain: 3.4 });
      part(f, seg(19, 11, 26, 4, 1.6), R.steel.slice(1), { cap: 1, base: 3, gain: 2.4 });
      part(f, seg(15, 15, 20, 10, 2.6), R.brass, { cap: 1, base: 4, gain: 3.2 });
      part(f, seg(13.4, 16.6, 15.4, 14.6, 2), R.steel, { cap: 1, base: 4, gain: 2 });
      // a jester cap hooked over the shaft by the flights, its two points dangling past the board's edge to bells
      prong(f, [24, 9], [27.5, 10], [28, 14], R.chips, 3.6, 2.2);
      prong(f, [20.5, 9.5], [23, 13], [25, 16], R.lime, 3.6, 2.2);
      bellS(f, 27, 14); bellS(f, 24, 16);
      const dome = M((x, y) => y <= 9 && ((x - 22.2) / 3.9) ** 2 + ((y - 9.5) / 4.2) ** 2 <= 1);
      ring(f, dome); fill2(f, dome, R.lime, R.chips, (x) => x > 22, { cap: 2, base: 5, gain: 4 });
      fill(f, M((x, y) => dome.get(x, y) && y === 9), R.gold, { cap: 1, base: 4, gain: 3 });
      return f;
    },
  });

  // ------------------------------------------------------------ 10. Accordion: a red-and-cream accordion stretched wide,
  // gold buttons down one end, a bell dangling from each
  A.joker('accordion', {
    ground: ['#24101E', '#32182A', '#402036', '#4E2842'], glow: [15, 11, 15], speck: [R.chips[7], R.money[6]],
    draw() {
      const f = new Bmp(W, W);
      // the bellows: pleats in cream and red with a zigzag edge, bowed up in the middle as it stretches
      const arch = (x) => Math.round(((x - 15) / 9) ** 2 * 2.4);
      const Z = [0, 1, 2, 1, 0, 1, 2, 1];
      const bel = M((x, y) => x >= 6 && x <= 24 && y >= 3 + arch(x) + Z[(x - 6) % 8] && y <= 17 + arch(x) - Z[(x - 6) % 8]);
      ring(f, bel);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (bel.get(x, y)) {
        const k = (x - 6) % 8, d = Math.max(0, Math.min(2, Math.floor((y - 3 - arch(x)) / 5)));
        const lit = k === 0 || k === 1 || k === 4 || k === 5, cream = k < 4;
        f.set(x, y, cream ? R.cream[(lit ? 7 : 4) - d] : R.mult[(lit ? 6 : 4) - d]);
        if (k === 3 || k === 7) f.set(x, y, cream ? R.cream[2] : R.mult[2]);
      }
      // the two ends, red boxes tilted with the bow
      const sl = (x) => (x <= 6 ? Math.round((6 - x) * 0.5) : Math.round((x - 24) * 0.5));
      const ends = M((x, y) => (x <= 6 || x >= 24) && y >= 3 + sl(x) && y <= 18 + sl(x) && !((x === 0 || x === 30) && (y === 3 + sl(x) || y === 18 + sl(x))));
      part(f, ends, R.mult, { cap: 2, base: 5, gain: 3.6 });
      // gold buttons in two rows down the left end
      [6, 9, 12, 15].forEach((y, i) => [1, 4].forEach((x) => { const xx = x + (i % 2), yy = y + sl(xx); f.rect(xx, yy, 2, 2, R.gold[4]); f.set(xx, yy, R.gold[6]); f.set(xx + 1, yy + 1, R.gold[2]); }));
      // a cream grille with dark slots on the right end
      for (let x = 25; x <= 29; x++) for (let y = 5; y <= 16; y++) f.set(x, y + sl(x), [7, 10, 13].includes(y) && x >= 26 && x <= 28 ? R.mult[2] : x === 25 || y === 5 ? R.cream[7] : R.cream[5]);
      // a bell dangling on a short cord from each end, the ground showing between
      [[2, 22], [2, 23], [2, 24], [28, 22], [28, 23], [28, 24]].forEach(([x, y]) => f.set(x, y, y === 22 ? R.cream[3] : R.cream[5]));
      bell(f, 0, 26); bell(f, 26, 26);
      return f;
    },
  });

  // ------------------------------------------------------------ 11. Pack Rat: a grey rat in a lime jester collar sitting on
  // his hoard, a pile of opened Booster Packs (maroon sleeves, cream trays, ember strikers), cards spilling out
  A.joker('packrat', {
    ground: ['#A84A18', '#C05A1E', '#D66A26', '#E87A30'], glow: [14, 12, 14], speck: [R.ember[8], R.lime[7]],
    draw() {
      const f = new Bmp(W, W);
      /** A Booster Pack lying flat: a maroon sleeve, an ember striker strip at its right end, a cream label. */
      const pack = (x0, y0, x1, y1, lx0, lx1) => {
        part(f, box(x0, y0, x1, y1, 1), R.maroon, { cap: 2, base: 4, gain: 3.4 });
        for (let y = y0 + 1; y <= y1 - 1; y++) for (let x = x1 - 3; x <= x1 - 1; x++) f.set(x, y, (x + y * 3) % 5 === 0 ? R.ember[1] : x === x1 - 3 ? R.ember[3] : R.ember[2]);
        for (let y = y0 + 1; y <= y1 - 1; y++) f.set(x1 - 4, y, C.edge);
        part(f, box(lx0, y0 + 2, lx1, y1 - 2), R.cream, { cap: 1, base: 6, gain: 2 });
      };
      const card = (x, y, w, h, suit) => { const c = A.kit.cardShape({ mask: Mask.fn(w, h, (i, j) => !((i === 0 || i === w - 1) && (j === 0 || j === h - 1))) }); c.blit(A.kit.pipBmp(suit, 5), (w - 5) >> 1, (h - 5) >> 1); f.blit(c, x, y); };
      // the pile: two packs, the upper one with its cream tray pulled out sideways and cards spilling from it
      pack(3, 23, 29, 30, 9, 17);
      f.blit(A.kit.pipBmp('H', 5), 11, 25);
      part(f, box(2, 18, 10, 21), R.cream, { cap: 1, base: 4, gain: 2.6 });
      f.rect(3, 19, 7, 1, R.cream[6]);
      pack(9, 16, 27, 22, 13, 19);
      card(0, 22, 7, 9, 'D');
      // the long bare tail hanging down the side of the pile in an S
      part(f, tube([21, 15], [29, 14], [27, 20], 2), R.pink.slice(2), { cap: 1, base: 4, gain: 2.6 });
      part(f, tube([27, 20], [24, 24], [29.5, 29], (t) => 2 - t * 0.6), R.pink.slice(2), { cap: 1, base: 4, gain: 2.6 });
      // the rat, sitting up on his hoard in profile: a grey body and haunch, a long pointed snout, a small ear,
      // a beady eye
      part(f, ell(17.5, 10.8, 5.4, 5.6), GREY, { cap: 3, base: 4, gain: 3.4 });
      fill(f, ell(14.6, 12, 2.6, 3.6), GREY.slice(2), { cap: 1.5, base: 3, gain: 2.4 });
      part(f, ell(20, 13.4, 3.2, 2.8), GREY, { cap: 2, base: 3, gain: 3.2 });
      part(f, box(15, 15, 19, 16, 1), R.pink.slice(3), { cap: 1, base: 3, gain: 2.6 });
      part(f, or(ell(12.5, 5.4, 3.8, 3.1), tube([11, 5.6], [7, 6.4], [3.5, 7.6], (t) => 4.2 - t * 2.8)), GREY, { cap: 2.5, base: 5, gain: 3.4 });
      part(f, ell(3.4, 7.6, 1.1, 1.1), R.pink.slice(3), { cap: 1, base: 3, gain: 2 });
      part(f, ell(14.8, 2.6, 1.7, 1.6), GREY, { cap: 1.5, base: 5, gain: 3 });
      fill(f, ell(14.8, 2.7, 0.8, 0.8), R.pink.slice(4), { cap: 1, base: 2, gain: 2 });
      f.rect(10, 4, 2, 2, C.edge); f.set(10, 4, C.white);
      pix(f, [[5, 9], [6, 9], [7, 10]], GREY[6]);
      // the lime jester collar: a two-row band round the neck, three short points over the chest with tiny bells
      part(f, M((x, y) => (y === 8 || y === 9) && x >= 10 && x <= 17 && !(y === 8 && x === 10)), R.lime, { cap: 1, base: 5, gain: 3 });
      part(f, M((x, y) => (y === 10 && [10, 11, 13, 14, 16, 17].includes(x)) || (y === 11 && [10, 13, 16].includes(x))), R.lime, { cap: 1, base: 5, gain: 3 });
      [[9, 12], [12, 12], [15, 12]].forEach(([x, y]) => { ring(f, box(x, y, x + 1, y + 1)); f.rect(x, y, 2, 2, R.gold[4]); f.set(x, y, R.gold[6]); f.set(x + 1, y + 1, R.gold[2]); });
      // the front paws
      part(f, box(10, 14, 11, 15), R.pink.slice(3), { cap: 1, base: 3, gain: 2.6 });
      return f;
    },
  });

  // ------------------------------------------------------------ 12. Pawnbroker: a whiskered pawnbroker in a violet waistcoat
  // under three gold balls, a jester's cap lying on his lit counter, a price tag tied to one of its points
  A.joker('pawnbroker', {
    ground: ['#3E1414', '#521C1A', '#662420', '#7A2E28'], glow: [19, 12, 14], speck: [R.money[6], R.mult[7]],
    draw() {
      const f = new Bmp(W, W), sk = SKIN.peach;
      // the sign: an iron bracket and three gold balls, two above and one below
      f.rect(0, 0, 12, 2, R.steel[1]); f.rect(0, 0, 12, 1, R.steel[2]);

      const ball = (x, y) => { const s = A.kit.sphere(2.6, R.gold); ring(f, M((i, j) => !!s.get(i - x, j - y))); f.blit(s, x, y); };
      ball(-1, 1); ball(6, 1); ball(2.5 | 0, 6);
      // the pawnbroker's shoulders: a cream shirt, a plum waistcoat with gold buttons and a watch chain
      const body = M((x, y) => y >= 16 && ((x - 20) / 9.5) ** 2 + ((y - 24) / 7.6) ** 2 <= 1);
      part(f, body, R.vio, { cap: 3, base: 4, gain: 3.2 });
      part(f, M((x, y) => y >= 16 && y <= 24 && Math.abs(x - 20) <= 2.6 - (y - 16) * 0.3), R.cream, { cap: 1, base: 6, gain: 2.4 });
      pix(f, [[23, 19], [23, 21], [17, 19], [17, 21]], R.gold[5]); f.line(24, 20, 27, 21, R.gold[4]);
      // head: bald, bushy grey whiskers, round spectacles
      fill(f, ell(20, 11, 5, 5.6), sk, { cap: 3, base: 4, gain: 4 });
      f.set(18, 7, sk[6]); f.set(19, 7, sk[6]);
      // mutton-chop whiskers and a drooping moustache, pale grey
      part(f, M((x, y) => ((x >= 14 && x <= 16) || (x >= 24 && x <= 26)) && y >= 10 && y <= 15 && ell(20, 11.5, 6.4, 5.4).get(x, y)), GREY.slice(3), { cap: 1.5, base: 3, gain: 3 });
      part(f, M((x, y) => (y === 13 && x >= 18 && x <= 22) || (y === 14 && (x === 17 || x === 18 || x === 22 || x === 23))), GREY.slice(3), { cap: 1, base: 3, gain: 2.6 });
      f.rect(19, 15, 3, 1, sk[1]); f.set(20, 16, sk[2]);
      // round spectacles
      [[16, 9], [21, 9]].forEach(([x, y]) => { f.draw(['kkk', 'kwk', 'kkk'], x, y, { k: C.edge, w: '#CFE0FF' }); });
      f.set(19, 10, C.edge); f.set(20, 10, C.edge);
      f.set(17, 10, C.white); f.set(22, 10, C.white);
      // the counter: a lit top edge, the top, a dark front with a panel line, a kick line at the foot
      part(f, box(0, 22, 30, 30), R.wood, { cap: 1, base: 2, gain: 2.4 });
      f.rect(0, 22, 31, 1, R.wood[6]); f.rect(0, 23, 31, 1, R.wood[5]); f.rect(0, 24, 31, 1, R.wood[1]);
      for (let y = 25; y <= 29; y++) for (let x = 0; x <= 30; x++) f.set(x, y, x % 10 === 4 ? R.wood[1] : y === 25 ? R.wood[3] : R.wood[2]);
      f.rect(0, 30, 31, 1, R.wood[0]);
      // the jester's cap lying on the counter, its points and bells resting on the top
      prong(f, [5, 20.5], [2.5, 20], [1.6, 21], R.lime, 3.4, 2.4);
      prong(f, [11, 20.5], [13.5, 20], [15.4, 21], R.pink, 3.4, 2.4);
      bellS(f, 0, 20); bellS(f, 15, 20);
      const dome = M((x, y) => y <= 21 && y >= 16 && ((x - 8) / 4.4) ** 2 + ((y - 21.4) / 5) ** 2 <= 1);
      ring(f, dome); fill2(f, dome, R.lime, R.pink, (x) => x > 8, { cap: 2, base: 5, gain: 4 });
      fill(f, M((x, y) => dome.get(x, y) && y >= 20), R.gold, { cap: 1, base: 4, gain: 3 });
      // the price tag on a cream string from the pink point, hanging over the counter's edge
      pix(f, [[15, 23], [15, 24]], R.cream[6]);
      part(f, box(13, 25, 17, 28), R.cream, { cap: 1, base: 6, gain: 2 });
      f.set(14, 26, R.cream[3]); f.rect(15, 26, 2, 2, R.mult[4]); f.set(15, 26, R.mult[6]);
      return f;
    },
  });

  // ------------------------------------------------------------ 13. Tea Leaves: a cream teacup on its saucer, the leaves
  // settled into a star at the bottom, a curl of steam
  A.joker('tealeaves', {
    ground: ['#4A2A8A', '#58349C', '#6640AE', '#744CBE'], glow: [14, 15, 14], speck: [R.cream[7], R.chips[7]],
    draw() {
      const f = new Bmp(W, W), cx = 14;
      // the saucer
      part(f, ell(cx, 26, 13.5, 3.8), R.cream, { cap: 2, base: 5, gain: 3.4 });
      fill(f, ell(cx, 25.5, 8, 1.8), R.cream.slice(0, 6), { cap: 1, base: 3, gain: 2 });
      // the handle, the foot, then the round bowl with a chip-blue band
      part(f, minus(ell(25, 15, 3.8, 4.2), ell(25.4, 15, 1.6, 2.2)), R.cream, { cap: 1.5, base: 5, gain: 3 });
      part(f, box(cx - 4, 21, cx + 4, 25, 1), R.cream, { cap: 1.5, base: 5, gain: 3 });
      const bowl = M((x, y) => y >= 10 && ((x - cx) / 10.8) ** 2 + ((y - 10) / 12.6) ** 2 <= 1);
      part(f, bowl, R.cream, { cap: 4, base: 5, gain: 3.6 });
      fill(f, M((x, y) => bowl.get(x, y) && (y === 15 || y === 16)), R.chips, { cap: 1, base: 5, gain: 3 });
      // the lip, lit, and the inside: the far wall in shade, the bottom stained with tea, the leaves in a star
      part(f, ell(cx, 10, 10.8, 4.4), R.cream, { cap: 1.5, base: 6, gain: 3 });
      const inside = ell(cx, 10.4, 9, 3.2);
      const tea = ['#8A5E3A', '#A87850', '#C49468', '#DDB08A'];
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (inside.get(x, y)) f.set(x, y, y <= 8 ? tea[0] : y <= 9 ? tea[1] : y <= 11 ? tea[2] : tea[3]);
      f.draw(['..l..', 'lllll', '.lLl.', '.l.l.'], cx - 2, 9, { l: '#3A2410', L: '#24160A' });
      return f;
    },
    overlay(k, b) {
      // a curl of steam rising
      [[15, 5], [16, 4], [16, 3], [15, 2], [14, 1], [14, 0], [12, 4], [11, 3], [11, 2], [12, 1]].forEach(([x, y], i) => win(b, x, y, i < 6 ? '#FFFCF5C0' : '#FFFCF570'));
    },
  });

  // ------------------------------------------------------------ 14. Stargazer: a jester in a star-spotted nightcap peering
  // through a brass telescope at a small orange planet with a pink ring, a bell tied to the eyepiece
  A.joker('stargazer', {
    ground: ['#160C22', '#20122E', '#2C183E', '#3A2250'], glow: [23, 7, 12], speck: [R.money[7], C.white, R.chips[7]],
    draw() {
      const f = new Bmp(W, W), sk = SKIN.rose;
      // twinkling stars round the planet
      [[15, 2], [29, 12], [28, 1]].forEach(([x, y]) => { pix(f, [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]], R.cream[5]); f.set(x, y, C.white); });
      // the planet and its ring
      const ringM = (front) => M((x, y) => { const d = ((x - 23.5) / 6) ** 2 + ((y - 7) / 1.7) ** 2; return d <= 1 && d >= 0.4 && (front ? y >= 7 : y < 7); });
      fill(f, ringM(false), R.pink, { cap: 1, base: 4, gain: 3 });
      const planet = A.kit.sphere(3, R.ember);
      ring(f, M((x, y) => !!planet.get(x - 20, y - 4)));
      f.blit(planet, 20, 4);
      pix(f, [[21, 8], [25, 7]], R.ember[3]);
      ring(f, ringM(true)); fill(f, ringM(true), R.pink, { cap: 1, base: 6, gain: 3 });
      // the robe, the ruff and the hand on the telescope
      part(f, ell(9, 31, 10, 6.5), R.vio.slice(1), { cap: 2.5, base: 4, gain: 3.4 });
      ruff(f, 3, 15, 25, 2, 3);
      // the telescope, widening toward the sky, with dark bands
      const scope = tube([12, 19], [17, 16], [22, 13], (t) => 2.6 + t * 1.8);
      part(f, scope, R.brass, { cap: 1.5, base: 4, gain: 3.6 });
      [[15, 17], [16, 17], [19, 15], [20, 15], [20, 14]].forEach(([x, y]) => f.set(x, y, R.brass[1]));
      part(f, box(14, 19, 16, 21, 1), sk, { cap: 1, base: 4, gain: 3 });
      // head in profile, one eye at the eyepiece, a smile
      fill(f, ell(8, 19.5, 5, 5), sk, { cap: 3, base: 4, gain: 4 });
      pix(f, [[10, 18], [11, 19], [12, 18]], C.edge); pix(f, [[13, 20], [13, 21]], sk[3]); pix(f, [[9, 22], [10, 23], [11, 23], [12, 22]], sk[0]);
      f.rect(6, 20, 2, 1, '#FF8FB4');
      // the nightcap: navy, gold stars, flopping back to a pom-pom
      const cap = or(M((x, y) => y <= 17 && ((x - 8) / 5.6) ** 2 + ((y - 19.5) / 5.8) ** 2 <= 1), tube([6, 15], [1, 12], [2, 6], (t) => 6 - t * 3.4));
      part(f, cap, R.chips.slice(3), { cap: 2, base: 3, gain: 3.4 });
      [[4, 14], [9, 13], [2, 9], [12, 15]].forEach(([x, y]) => { f.rect(x, y, 2, 2, R.money[6]); f.set(x + 1, y + 1, R.money[4]); });
      part(f, ell(2.5, 4.5, 2, 2), R.cream, { cap: 1, base: 6, gain: 3 });
      // a bell tied to the eyepiece; the cap is bright chip blue with yellow stars, the planet small with a pink ring
      f.set(12, 21, R.pink[5]); bellS(f, 12, 22);
      return f;
    },
  });

  // ------------------------------------------------------------ 15. Dripping Candle: a short cream candle with a jester's
  // face, slumping as it melts: its pink wax cap sagging over the sides in two drooping points, pink wax running down
  // into a puddle in the brass dish, a woozy face
  A.joker('drippingcandle', {
    ground: ['#2C0A0C', '#3E1012', '#50161A', '#621E20'], glow: [17, 9, 13], speck: [R.ember[7], R.money[7]],
    draw(k) {
      const f = new Bmp(W, W);
      const wax = ['#8F6150', '#BD8C6C', '#DDB08A', '#F2D3AE', '#FBE7CB', '#FFF3E0', '#FFFCF5'];
      const pk = R.pink.slice(2);
      // the brass dish, a wide pink puddle spreading across it
      part(f, ell(15, 27.6, 14.2, 3.1), R.brass, { cap: 1.5, base: 4, gain: 3.4 });
      fill(f, ell(15, 27.4, 11.5, 1.6), R.brass.slice(0, 4), { cap: 1, base: 2, gain: 2 });
      part(f, M((x, y) => ell(15.5, 26.4, 9.6, 1.6).get(x, y) || ell(6, 27.2, 2.6, 1.1).get(x, y)), pk, { cap: 1.5, base: 4, gain: 2.8 });
      // the pillar, slumped and leaning to the right, bulging at its foot
      const lean = (y) => Math.round((26 - y) * 0.2);
      const pillar = M((x, y) => y >= 11 && y <= 26 && x >= 10 + lean(y) - (y >= 23 ? 1 : 0) && x <= 20 + lean(y) + (y >= 23 ? 1 : 0));
      part(f, pillar, wax, { cap: 4, base: 4, gain: 3.2 });
      // its top carved as a jester's cap in pink wax: a low dome sagging over both sides in two drooping points,
      // a round drop at each tip, pink runs down the wax into the puddle
      const dome = M((x, y) => y >= 8 && y <= 13 && ((x - 17) / 6.6) ** 2 + ((y - 13.4) / 5) ** 2 <= 1);
      const flopL = tube([12.5, 11.5], [9.5, 11.5], [9, 15.5], (t) => 3.4 - t * 1.4), flopR = tube([21.5, 11], [24.5, 11], [24.5, 14.5], (t) => 3.4 - t * 1.4);
      const runs = M((x, y) => (x >= 13 && x <= 14 && y >= 12 && y <= 15) || (x === 14 && y === 16)
        || (x >= 19 && x <= 20 && y >= 12 && y <= 17) || (x === 20 && y >= 18 && y <= 19)
        || (x === 10 && y >= 17 && y <= 25) || (x === 11 && y >= 21 && y <= 25) || (x === 22 && y >= 16 && y <= 25) || (x === 21 && y >= 23 && y <= 25));
      part(f, or(dome, flopL, flopR, runs), R.pink, { cap: 2, base: 5, gain: 3.4 });
      part(f, ell(9, 16.8, 1.6, 1.6), R.pink, { cap: 1, base: 5, gain: 3 });
      part(f, ell(24.6, 15.8, 1.6, 1.6), R.pink, { cap: 1, base: 5, gain: 3 });
      // a woozy face: one eye squeezed shut, one drooping, a wobbly mouth, rosy cheeks, a bead of sweat
      pix(f, [[13, 18], [14, 19], [13, 20]], C.edge);
      f.rect(17, 19, 2, 2, C.edge); f.rect(17, 18, 2, 1, wax[1]); f.set(17, 19, wax[2]);
      pix(f, [[13, 23], [14, 22], [15, 23], [16, 22], [17, 23]], C.edge);
      f.rect(12, 21, 1, 1, R.pink[7]); f.rect(19, 21, 1, 1, R.pink[7]);
      part(f, M((x, y) => (x === 21 && y === 19) || (x >= 20 && x <= 21 && y === 20)), R.chips.slice(4), { cap: 1, base: 2, gain: 2 });
      // the wick and a small flame, leaning
      f.rect(17, 6, 1, 2, wax[0]);
      f.draw([
        '...r.',
        '..ror',
        '.royo',
        '.oyyo',
        'royuo',
        '.oyu.',
      ], 15, 0, { r: '#E8461C', o: '#FF7A2B', y: '#FFD84A', u: C.white });
      return f;
    },
  });

  // ------------------------------------------------------------ 16. Merry-Go-Round: a little carousel under a round scalloped
  // roof of pink and cream panels ringed with bulbs, two cream horses with gold manes galloping on gold poles, a jester
  // riding the big one backwards, his cap streaming
  A.joker('merrygoround', {
    ground: ['#261458', '#321A6C', '#3E2080', '#4A2892'], glow: [15, 16, 14], speck: [R.money[7], R.pink[6]],
    draw() {
      const f = new Bmp(W, W), sk = SKIN.peach;
      // the platform and the poles
      part(f, ell(15, 27.6, 14.6, 2.8), R.wood, { cap: 1.5, base: 4, gain: 3.4 });
      f.rect(2, 28, 27, 1, R.brass[3]); for (let x = 3; x <= 27; x += 3) f.set(x, 28, R.money[6]);
      [11, 24].forEach((x) => { f.rect(x, 5, 1, 21, R.gold[4]); f.set(x, 5, R.gold[6]); });
      /** A carousel horse galloping right: an arched neck, the head up, front legs tucked, hind legs back, a gold
          mane and tail. (ox, oy) is the middle of its back, s its size. */
      const horse = (ox, oy, s, saddle, hide) => {
        const P = (x, y) => [ox + x * s, oy + y * s];
        const leg = (a, b) => part(f, seg(...P(...a), ...P(...b), 2), hide, { cap: 1, base: 4, gain: 2.6 });
        leg([-4, 3], [-7, 6.6]); leg([-2.6, 3.4], [-4.4, 7]);
        leg([3.4, 3], [6, 4]); leg([6, 4], [5.6, 6.4]);
        part(f, tube(P(-5.6, 0.6), P(-8, 1), P(-9, 4.4), Math.max(2, 2.4 * s)), R.gold, { cap: 1, base: 4, gain: 3 });
        part(f, or(ell(...P(0, 1.4), 6.4 * s, 2.8 * s), tube(P(3.6, 0.6), P(5.6, -1.4), P(5.8, -4.4), 3.6 * s), ell(...P(6.8, -4.8), 2.4 * s, 1.7 * s), tube(P(6.8, -4.8), P(8.8, -4.6), P(9.2, -3), 2.4 * s)), hide, { cap: 3, base: 5, gain: 3.4 });
        part(f, tube(P(2.6, 0), P(4.6, -2.4), P(5, -6), Math.max(2, 2 * s)), R.gold, { cap: 1, base: 4, gain: 3 });
        const [ex, ey] = P(7.4, -5.2); f.set(Math.round(ex), Math.round(ey), C.edge);
        if (s > 0.8) { const [bx, by] = P(8.6, -4.2); f.set(Math.round(bx), Math.round(by), saddle[4]); f.set(Math.round(bx) - 1, Math.round(by) + 1, saddle[4]); }
        const [sx0, sy0] = P(-2.4, -1.2), [sx1, sy1] = P(1.8, -0.2);
        part(f, box(Math.round(sx0), Math.round(sy0), Math.round(sx1), Math.round(sy1)), saddle, { cap: 1, base: 5, gain: 3 });
      };
      horse(24, 15.6, 0.62, R.lime, R.peach);
      horse(11, 18.4, 1, R.pink, R.cream);
      // the jester sitting the big horse backwards, facing its tail, his cap streaming out in front of him
      part(f, box(8, 12, 13, 17, 1), R.lime, { cap: 1.5, base: 5, gain: 3.2 });
      fill(f, box(8, 11, 13, 12), R.cream, { cap: 1, base: 6, gain: 2.4 });
      fill(f, box(8, 14, 9, 15), sk, { cap: 1, base: 4, gain: 3 });
      fill(f, ell(11, 9, 2.4, 2.4), sk, { cap: 1.5, base: 4, gain: 3.4 });
      f.set(9, 9, C.edge); f.set(9, 10, '#FF8FB4');
      part(f, or(M((x, y) => ell(11.2, 8.6, 2.9, 2.9).get(x, y) && (y <= 7 || x >= 13)), tube([10, 7], [6.4, 6.4], [4, 8.6], (t) => 2.8 - t * 1.2)), R.vio, { cap: 1.5, base: 5, gain: 3.4 });
      bellS(f, 2, 8);
      // the roof: pink and cream panels fanning from a gold finial, a rim of bulbs, a scalloped valance, a pennant
      const roof = M((x, y) => y >= 1 && y <= 4 && Math.abs(x - 15) <= Math.min(13, y * 3.4 + 0.6));
      ring(f, roof);
      fill2(f, roof, R.pink, R.cream, (x, y) => Math.floor(((x - 15) / Math.max(1, y)) * 1.2 + 20) % 2 === 0, { cap: 2, base: 5, gain: 3.4 }, { cap: 2, base: 6, gain: 3 });
      const val = M((x, y) => (y === 5 && x >= 2 && x <= 28) || (y === 6 && x >= 2 && x <= 28 && (x - 2) % 3 !== 2));
      part(f, val, R.pink, { cap: 1, base: 4, gain: 3 });
      for (let x = 3; x <= 27; x += 3) f.set(x, 5, R.money[6]);
      part(f, M((x, y) => (y === 0 && x >= 16 && x <= 18) || (y === 1 && x === 16)), R.lime, { cap: 1, base: 5, gain: 3 });
      f.set(15, 0, R.gold[5]);
      return f;
    },
  });

  // ------------------------------------------------------------ 17. Court Ace: our Ace of Hearts (its A index and the Ember
  // mark, a heart on a lit lozenge) wearing a tiny gold crown askew and an ermine-trimmed wine robe, holding a sceptre
  A.joker('courtace', {
    ground: ['#B05418', '#C86420', '#DC7428', '#EE8634'], glow: [15, 12, 14], speck: [R.cream[7], R.money[7]],
    draw() {
      const f = new Bmp(W, W);
      // the card standing up
      const CWD = 19, CHT = 26, cx0 = 5, cy0 = 3;
      f.blit(A.kit.cardShape({ mask: Mask.fn(CWD, CHT, (i, j) => { const r = [2, 1][Math.min(j, CHT - 1 - j)] ?? 0; return i >= r && i < CWD - r; }) }), cx0, cy0);
      // the Ember mark: a lozenge halo stepped in four shades with an orange rim, clear of the index, and a spark
      const hx = 15, hy = 15, halo = ['#FFF6E6', '#FFE6C2', '#FFD29C', '#FFB774'];
      for (let y = cy0 + 2; y <= cy0 + CHT - 3; y++) for (let x = cx0 + 2; x <= cx0 + CWD - 3; x++) {
        const d = Math.abs(x - hx) + Math.abs(y - hy) * 0.8;
        if (d > 8.2 || (x <= cx0 + 7 && y <= cy0 + 9)) continue;
        f.set(x, y, d > 7.3 ? '#F07A36' : halo[d > 6.3 ? 3 : d > 5.2 ? 2 : d > 4 ? 1 : 0]);
      }
      f.draw(['..e..', '..o..', 'eovoe', '..o..', '..e..'], 17, 4, { e: '#FFB774', o: '#FF8A3C', v: C.white });
      // the A index, shaded like the cards' own
      A.kit.FONTS.S.g.A.forEach((row, j) => row.forEach((on, i) => { if (on) f.set(cx0 + 2 + i, cy0 + 2 + j, j < 2 ? R.red[4] : j < 5 ? R.red[3] : R.red[2]); }));
      // the sceptre, held up past the card's edge, an orb on top
      part(f, seg(21, 14, 27, 5, 1.6), R.gold, { cap: 1, base: 4, gain: 3 });
      part(f, ell(27.6, 3.6, 1.8, 1.8), R.gold, { cap: 1.2, base: 4, gain: 3.4 });
      f.set(27, 3, C.white);
      // the heart with a little face, a hand on the sceptre
      const HEART = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
      part(f, M((x, y) => y >= 11 && y < 19 && x >= 11 && x < 20 && HEART[y - 11][x - 11] === 'X'), R.red, { cap: 3, base: 3, gain: 2.6 });
      f.rect(13, 13, 1, 2, C.edge); f.rect(17, 13, 1, 2, C.edge); f.set(13, 13, C.white); f.set(17, 13, C.white);
      pix(f, [[14, 16], [15, 16], [16, 16]], R.cream[6]);
      part(f, box(20, 14, 21, 15), R.red, { cap: 1, base: 3, gain: 3 });
      // the wine robe falling from the card's shoulders, ermine trim with dark tails
      const robe = M((x, y) => y >= 21 && Math.abs(x - 14) <= 8 + (y - 21) * 0.7);
      part(f, robe, R.maroon, { cap: 3, base: 4, gain: 3.4 });
      const ermine = M((x, y) => robe.get(x, y) && (y <= 22 || Math.abs(x - 14) <= 1));
      fill(f, ermine, R.cream, { cap: 1, base: 6, gain: 2.4 });
      pix(f, [[8, 21], [12, 22], [16, 21], [20, 22], [13, 25], [14, 28]], C.edge);
      // a tiny crown, set askew on the card's top edge
      const crown = M((x, y) => (x >= 9 && x <= 15 && y >= 3 + (x <= 11 ? 1 : 0) && y <= 4 + (x <= 11 ? 1 : 0)) || ([[10, 2], [10, 3], [12, 1], [12, 2], [14, 0], [14, 1]].some(([a, b]) => a === x && b === y)));
      part(f, crown, R.gold, { cap: 1.2, base: 4, gain: 3.6 });
      f.set(12, 3, R.pink[5]);
      return f;
    },
  });

  // ------------------------------------------------------------ 18. High Five: two white-gloved hands slapping a high five,
  // a shower of ember sparks where the palms meet
  A.joker('highfive', {
    ground: ['#321028', '#421634', '#521E40', '#62264C'], glow: [15, 8, 13], speck: [R.ember[7], R.money[7]],
    draw() {
      const f = new Bmp(W, W);
      const glove = R.cream;
      // one gloved hand, drawn for the left and mirrored for the right
      const hand = (sleeve) => {
        const h = new Bmp(W, W);
        const P = (m, ramp, o) => { ring(h, m); h.blit(emboss(m, ramp, o), 0, 0); };
        P(tube([-3, 33], [2, 26], [7, 21], 7.5), sleeve, { cap: 2.5, base: 5, gain: 3.4 });
        P(ell(8, 19.5, 4, 2.6), glove, { cap: 1.5, base: 4, gain: 3 });
        P(tube([6, 15], [3, 13], [3, 9], 3.2), glove, { cap: 1.5, base: 5, gain: 3.4 });
        P(ell(10, 14, 4.4, 4.6), glove, { cap: 2.5, base: 5, gain: 3.4 });
        [[[8, 11], [7.4, 7], [7.6, 4]], [[10, 10], [10.4, 6], [11, 3]], [[12, 11], [12.6, 7], [13, 4.6]]].forEach(([a, b, c]) => P(tube(a, b, c, 3), glove, { cap: 1.5, base: 5, gain: 3.4 }));
        h.line(9, 15, 9, 17, glove[2]); h.line(11, 15, 11, 17, glove[2]);
        return h;
      };
      f.blit(hand(R.pink), 0, 0);
      f.blit(hand(R.lime), 0, 2, { flipX: true });
      // the slap: a cream-white star where the palms meet, ember rays, four ember sparks flying out
      const star = M((i, j) => (Math.abs(i - 15) <= 1 && Math.abs(j - 13) <= 4) || (Math.abs(j - 13) <= 1 && Math.abs(i - 15) <= 3) || (Math.abs(i - 15) === Math.abs(j - 13) && Math.abs(i - 15) <= 2));
      part(f, star, R.ember.slice(3), { cap: 1, base: 3, gain: 2 });
      pix(f, [[15, 10], [15, 11], [15, 12], [15, 13], [15, 14], [15, 15], [14, 13], [16, 13], [13, 13], [17, 13], [14, 12], [16, 12], [14, 14], [16, 14]], R.cream[6]);
      pix(f, [[15, 12], [15, 13], [14, 13], [16, 13]], C.white);
      const spark = (x, y) => { part(f, M((i, j) => Math.abs(i - x) + Math.abs(j - y) <= 1), R.ember, { cap: 1, base: 6, gain: 2 }); f.set(x, y, R.money[8]); };
      spark(15, 5); spark(10, 2); spark(21, 3); spark(23, 9);
      return f;
    },
  });

  // ------------------------------------------------------------ 19. Understudy: a nervous jester peeking out of the wings
  // behind a heavy magenta velvet curtain held by a gold rope, clutching a script tied with pink ribbon
  A.joker('understudy', {
    ground: ['#220A1C', '#2E0E26', '#3A1230', '#48183C'], glow: [21, 12, 12], speck: [R.pink[6], R.money[6]],
    draw() {
      const f = new Bmp(W, W), sk = SKIN.rose;
      // the jester: one prong of his cap poking up, his head round the curtain's edge
      prong(f, [23, 7], [27, 5], [27, 1], R.lime, 4.2, 2.4);
      bell(f, 25, 0);
      part(f, M((x, y) => y >= 18 && y <= 30 && x >= 15 && x <= 26), R.vio, { cap: 3, base: 5, gain: 3.4 });
      ruff(f, 16, 26, 18, 2, 2.5);
      fill(f, ell(21, 12.5, 5.2, 5.4), sk, { cap: 3, base: 4, gain: 4 });
      hood(f, 21, 12.5, 5.2, 5.4, 9, R.vio, R.lime);
      // wide worried eyes, a wobbly mouth, a bead of sweat
      [[18, 11], [22, 11]].forEach(([x, y]) => { f.rect(x, y, 3, 3, C.white); f.set(x + 1, y + 1, C.edge); f.set(x + 1, y + 2, C.edge); pix(f, [[x, y - 1], [x + 1, y - 1], [x + 2, y - 1]], C.edge); });
      pix(f, [[19, 16], [20, 15], [21, 16], [22, 15], [23, 16]], C.edge);
      part(f, M((x, y) => (x === 27 && y >= 11 && y <= 13) || (x === 26 && (y === 12 || y === 13))), R.chips.slice(5), { cap: 1, base: 1, gain: 2 });
      // the script: a rolled cream scroll tied with a pink bow, a hand at each end
      part(f, box(16, 21, 29, 24, 1), R.cream, { cap: 1.5, base: 6, gain: 2.6 });
      f.rect(16, 22, 1, 2, R.cream[3]); f.rect(29, 22, 1, 2, R.cream[3]);
      part(f, M((x, y) => (x >= 21 && x <= 23 && y >= 20 && y <= 25) || (y === 25 && (x === 20 || x === 24)) || (y === 26 && (x === 19 || x === 25))), R.pink, { cap: 1, base: 5, gain: 3 });
      part(f, box(26, 20, 28, 22, 1), sk, { cap: 1, base: 4, gain: 3 });
      // the heavy curtain, its folds catching the light, a gold tieback
      const edge = (y) => 15.5 + Math.sin(y * 0.45) * 0.9 + (y > 18 ? (y - 18) * 0.25 : 0);
      const cur = M((x, y) => x <= edge(y));
      ring(f, cur);
      // velvet: wide dark troughs, narrow bright crests with one highlight each, lighter at the top, falling off below
      const pinch = (y) => (y >= 15 && y <= 21 ? 1 - Math.abs(y - 18) / 4 : 0);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (cur.get(x, y)) {
        const k = (((x + Math.round(pinch(y) * (x - 8) * -0.3)) % 5) + 5) % 5;
        const v = (k === 1 ? 3 : k === 2 ? 2 : k === 0 ? 2 : 1) + (y < 10 ? 1 : 0) - (y > 23 ? 1 : 0);
        f.set(x, y, k === 1 && y >= 2 && y <= 14 ? R.pink[5] : R.pink[Math.max(0, Math.min(4, v))]);
      }
      part(f, M((x, y) => y <= 1 && x <= 17), R.gold, { cap: 1, base: 4, gain: 3 });
      for (let x = 0; x <= 16; x++) { f.set(x, 29, R.gold[x % 2 ? 3 : 5]); if (x % 2 === 0) f.set(x, 30, R.gold[3]); }
      // the gold rope tie-back across the velvet, a tassel at its end
      const rope = M((x, y) => x <= edge(y) && (y === 18 || y === 19) && x >= 0);
      ring(f, rope);
      for (let x = 0; x < W; x++) for (let y = 18; y <= 19; y++) if (rope.get(x, y)) f.set(x, y, (x + y) % 2 ? R.gold[5] : R.gold[3]);
      part(f, M((x, y) => (x === 13 && y >= 20 && y <= 21) || (x >= 12 && x <= 14 && y >= 22 && y <= 24)), R.gold, { cap: 1, base: 4, gain: 3 });
      return f;
    },
  });

  // ------------------------------------------------------------ 20. Jester Parade: three jesters marching right in profile
  // up a rising diagonal, knees high, caps flopping back: the leader in front with a bass drum on his chest and a
  // stick raised, then one shouldering a lime pennant, then the smallest at the back; caps in chip blue, pink and lime.
  // On plum, not the brief's ember orange: on orange it was a twin of Conga Line (43-jokers-c.js), which keeps orange.
  A.joker('jesterparade', {
    ground: ['#3C1052', '#4A1664', '#581C76', '#662488'], glow: [19, 14, 14], speck: [R.ember[7], R.money[7]],
    draw() {
      const f = new Bmp(W, W);
      const bell2 = (x, y) => { ring(f, box(x, y, x + 1, y + 1)); f.rect(x, y, 2, 2, R.gold[4]); f.set(x, y, R.gold[6]); f.set(x + 1, y + 1, R.gold[2]); };
      /** A face in profile looking right: an eye, a nose, a smile, a rosy cheek. */
      const face = (ex, ey, tall, sk) => { f.set(ex, ey, C.edge); if (tall) f.set(ex, ey + 1, C.edge); f.set(ex - 2, ey + 2, '#FF8FB4'); f.set(ex + 1, ey + (tall ? 3 : 2), sk[1]); };
      // ---- the smallest, at the back and highest: a lime cap, a blue tunic
      part(f, seg(3.6, 11, 3, 14.5, 2), R.navy, { cap: 1, base: 3, gain: 3 });
      part(f, or(seg(5.6, 11, 7.6, 12, 2), seg(7.6, 12, 7.6, 14.5, 2)), R.navy, { cap: 1, base: 5, gain: 3 });
      part(f, box(1, 15, 3, 15), R.lime, { cap: 1, base: 5, gain: 3 }); part(f, box(7, 15, 9, 15), R.lime, { cap: 1, base: 5, gain: 3 });
      part(f, box(3, 8, 7, 11, 1), R.chips, { cap: 1.5, base: 5, gain: 3.2 });
      part(f, box(3, 7, 7, 7), R.cream, { cap: 1, base: 6, gain: 2 });
      part(f, ell(5.2, 4.8, 2, 2), SKIN.brown, { cap: 1.5, base: 4, gain: 3.2 });
      f.set(6, 4, C.edge); f.set(7, 6, SKIN.brown[1]);
      part(f, or(M((x, y) => ell(5, 4.6, 2.5, 2.5).get(x, y) && (y <= 3 || x <= 3)), tube([3.5, 3], [1.2, 2.6], [1, 6], (t) => 2.4 - t * 1)), R.lime, { cap: 1.5, base: 5, gain: 3.4 });
      bell2(0, 6);
      // ---- the pennant bearer: a pink cap, a lime tunic, a lime pennant on a pole over his shoulder
      part(f, seg(11, 16, 10, 20.5, 2.2), R.navy, { cap: 1, base: 3, gain: 3 });
      part(f, or(seg(13.4, 16, 15.8, 17.4, 2.2), seg(15.8, 17.4, 15.8, 20.5, 2.2)), R.navy, { cap: 1, base: 5, gain: 3 });
      part(f, box(7, 21, 10, 21), R.pink, { cap: 1, base: 5, gain: 3 }); part(f, box(15, 21, 18, 21), R.pink, { cap: 1, base: 5, gain: 3 });
      part(f, box(10, 11, 15, 16, 1), R.lime, { cap: 1.5, base: 5, gain: 3.2 });
      part(f, M((x, y) => x === 17 && y >= 1 && y <= 13), R.wood.slice(2), { cap: 1, base: 3, gain: 2 });
      part(f, M((x, y) => x >= 18 && x <= 23 && y >= 1 + Math.floor((x - 18) * 0.5) && y <= 5 - Math.floor((x - 18) * 0.5)), R.lime, { cap: 1.5, base: 5, gain: 3 });
      part(f, box(16, 12, 17, 13), SKIN.rose, { cap: 1, base: 4, gain: 3 });
      part(f, box(10, 10, 15, 10), R.cream, { cap: 1, base: 6, gain: 2 });
      part(f, ell(13.2, 7.6, 2.6, 2.5), SKIN.rose, { cap: 2, base: 4, gain: 3.4 });
      face(14, 7, true, SKIN.rose);
      part(f, or(M((x, y) => ell(12.8, 7.2, 3.1, 3.1).get(x, y) && (y <= 6 || x <= 10)), tube([10.6, 5.6], [8.2, 5.2], [8, 9], (t) => 2.8 - t * 1.2)), R.pink, { cap: 1.5, base: 5, gain: 3.4 });
      bell2(7, 9);
      // ---- the leader, in front and biggest: a chip-blue cap, a pink tunic, the bass drum
      part(f, seg(21.6, 21, 20, 26.6, 2.8), R.navy, { cap: 1, base: 3, gain: 3 });
      part(f, or(seg(23.6, 21, 26.8, 23.4, 2.8), seg(26.8, 23.4, 26.8, 26.6, 2.8)), R.navy, { cap: 1, base: 5, gain: 3 });
      part(f, box(16, 27, 20, 28, 1), R.chips, { cap: 1, base: 5, gain: 3 }); part(f, box(25, 27, 29, 28, 1), R.chips, { cap: 1, base: 5, gain: 3 });
      part(f, box(20, 14, 26, 21, 1), R.pink, { cap: 2, base: 5, gain: 3.4 });
      part(f, ell(25.8, 18.6, 4.5, 4.5), R.mult, { cap: 2, base: 5, gain: 3.4 });
      fill(f, ell(25.8, 18.6, 3.1, 3.1), R.cream, { cap: 1.5, base: 6, gain: 2.4 });
      ring(f, ell(25.8, 18.6, 3.1, 3.1), R.mult[2]);
      pix(f, [[23, 14], [28, 14], [30, 18], [28, 22], [23, 22], [21, 18]], R.gold[5]);
      part(f, seg(22, 15.5, 26.5, 12.5, 2.4), R.pink, { cap: 1, base: 5, gain: 3 });
      part(f, seg(27.6, 12, 29.4, 6.4, 2), R.wood.slice(1), { cap: 1, base: 4, gain: 2.4 });
      part(f, box(26, 11, 27, 12), SKIN.peach, { cap: 1, base: 4, gain: 3 });
      part(f, ell(24.6, 13.6, 3.4, 1.4), R.cream, { cap: 1, base: 6, gain: 2.4 });
      part(f, or(ell(24.2, 9.8, 3.3, 3.2), M((x, y) => x === 28 && y === 10)), SKIN.peach, { cap: 2, base: 4, gain: 3.6 });
      face(26, 9, true, SKIN.peach);
      part(f, or(M((x, y) => ell(23.8, 9.4, 3.9, 3.9).get(x, y) && (y <= 7 || x <= 21)), tube([21, 7.6], [18.2, 6.8], [17.6, 11], (t) => 3.4 - t * 1.6)), R.chips, { cap: 2, base: 5, gain: 3.6 });
      bellS(f, 16, 11);
      return f;
    },
  });

  // ------------------------------------------------------------ 21. Fancy Dress: a dressmaker's form half dressed in a pink
  // and gold jester costume, a yellow tape measure over its shoulders, pins in its bare side, a tomato pincushion
  A.joker('fancydress', {
    ground: ['#3E0E58', '#4E146A', '#5E1A7C', '#6E228E'], glow: [14, 13, 14], speck: [R.pink[6], R.money[7]],
    draw() {
      const f = new Bmp(W, W);
      const linen = ['#5A4034', '#7A5A48', '#9C7A62', '#BC9A7E', '#D6B898', '#EAD2B4', '#F6E6CE'];
      // the stand: a turned pole and three feet
      part(f, or(seg(13.5, 20, 13.5, 28, 2.2), seg(13.5, 27, 7.5, 30, 2), seg(13.5, 27, 19.5, 30, 2)), R.wood, { cap: 1, base: 4, gain: 3 });
      // the form: a wooden cap on the neck, sloped shoulders with the armholes cut in, a nipped waist, round hips
      const hw = (y) => (y < 5 ? -1 : y <= 7 ? 4 + (y - 5) * 2 : y <= 9 ? 7.4 : y <= 13 ? 7 - (y - 9) * 0.7 : y <= 17 ? 4.2 + (y - 13) * 0.6 : y <= 19 ? 6.6 - (y - 17) * 1.2 : -1);
      const arm = (x, y) => ((x - 5.5) / 1.8) ** 2 + ((y - 9.5) / 2.4) ** 2 <= 1 || ((x - 21.5) / 1.8) ** 2 + ((y - 9.5) / 2.4) ** 2 <= 1;
      const form = M((x, y) => Math.abs(x - 13.5) <= hw(y) && !arm(x, y));
      part(f, box(12, 3, 15, 5), linen, { cap: 1, base: 4, gain: 3 });
      part(f, box(11, 1, 16, 2, 1), R.wood, { cap: 1, base: 4, gain: 3 });
      part(f, form, linen, { cap: 4, base: 4, gain: 3.4 });
      // the costume, sewn on the left half: pink panels, gold piping, half a ruff, a short scalloped skirt with gold trim
      const sewn = M((x, y) => form.get(x, y) && x <= 13);
      fill2(f, sewn, R.pink, R.gold, (x, y) => x === 13 || y === 14, { cap: 4, base: 5, gain: 3.4 }, { cap: 1, base: 4, gain: 3 });
      const skirt = M((x, y) => y >= 16 && y <= 23 && x <= 13 && x >= 13 - (6 + (y - 16) * 0.55) && !(y === 23 && x % 3 === 1) && !(y === 22 && x % 3 === 1 && x < 8));
      part(f, skirt, R.pink, { cap: 2, base: 5, gain: 3.4 });
      for (let x = 0; x <= 13; x++) for (let y = 21; y <= 23; y++) if (skirt.get(x, y) && !skirt.get(x, y + 1)) f.set(x, y, R.gold[5]);
      ruff(f, 6.5, 13, 6.4, 1.7, 2);
      // stitches down the middle seam
      for (let y = 8; y <= 18; y += 2) f.set(14, y, C.edge);
      // pins in the bare side: round heads, steel shafts
      [[19, 9, R.chips], [18, 14, R.lime]].forEach(([x, y, ramp]) => { f.rect(x - 1, y + 2, 1, 1, R.steel[3]); f.rect(x - 2, y + 3, 1, 1, R.steel[2]); part(f, box(x, y, x + 1, y + 1), ramp, { cap: 1, base: 5, gain: 3 }); f.set(x, y, ramp[7]); });
      // the yellow tape measure hung round the neck, ticked every two px, a steel tab on one end
      const tape = M((x, y) => (y === 4 && x >= 11 && x <= 16) || ((x === 10 || x === 11) && y >= 5 && y <= 11) || ((x === 16 || x === 17) && y >= 5 && y <= 9));
      part(f, tape, R.money, { cap: 1, base: 5, gain: 2 });
      for (let y = 6; y <= 11; y += 2) { if (tape.get(10, y)) { f.set(10, y, R.money[2]); f.set(11, y, R.money[3]); } if (tape.get(16, y)) { f.set(16, y, R.money[2]); f.set(17, y, R.money[3]); } }
      part(f, box(10, 12, 11, 12), R.steel, { cap: 1, base: 3, gain: 2.4 });
      // a tomato pincushion at its foot: red segments, a lime leaf, three pins stuck in at angles
      [[22, 20, 23, 23], [26, 19, 26, 22], [29, 21, 28, 23]].forEach(([x0, y0, x1, y1]) => { f.line(x0, y0, x1, y1, R.steel[3]); });
      const tom = ell(25, 26, 5, 3.6);
      part(f, tom, R.mult, { cap: 3, base: 5, gain: 3.6 });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (tom.get(x, y) && [22, 25, 28].some((c) => x === c) && y >= 24 && y <= 28) f.set(x, y, R.mult[3]);
      part(f, M((x, y) => (y === 22 && x >= 24 && x <= 27) || (y === 21 && (x === 25 || x === 27))), R.lime, { cap: 1, base: 5, gain: 3 });
      [[21, 19, R.chips], [26, 18, R.cream], [29, 20, R.pink]].forEach(([x, y, ramp]) => { part(f, box(x, y, x + 1, y + 1), ramp, { cap: 1, base: 5, gain: 3 }); f.set(x, y, ramp[7]); });
      return f;
    },
  });

  // ------------------------------------------------------------ 22. Signet Ring: a big gold signet ring with a cameo bezel
  // (a jester's profile on violet) standing on a card that wears Lit's pink Encore tab, on a wine-violet ground
  A.joker('signetring', {
    ground: ['#3A0C34', '#4A1242', '#5C1A52', '#6E2260'], glow: [8, 10, 12], speck: [R.pink[6], R.gold[5]],
    draw(k) {
      const f = new Bmp(W, W);
      // the card lying flat, a heart on its face, the ring's shadow falling across it
      f.blit(A.kit.cardShape({ mask: Mask.fn(29, 13, (i, j) => !((i === 0 || i === 28) && (j === 0 || j === 12))) }), 1, 18);
      f.blit(A.kit.pipBmp('H', 7), 12, 22);
      pix(f, [[12, 21], [13, 21], [14, 21], [15, 21]], R.cream[3]);
      // the Encore Seal over the card's top edge
      f.blit(k.encoreRibbon(), 21, 14);
      // the ring standing on the card: a round band, the bezel on top
      part(f, minus(ell(8, 15.2, 7.1, 6.4), ell(8, 15.8, 4.3, 3.7)), R.gold, { cap: 1.6, base: 4, gain: 3.8 });
      // the bezel: a cameo, a violet oval (9 x 7) in a gold rim with a cream jester in profile, three soft cap points
      const OVAL = ['..xxxxx..', '.xxxxxxx.', 'xxxxxxxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..'];
      const ox = 4, oy = 3, oval = M((x, y) => (OVAL[y - oy] || '')[x - ox] === 'x');
      part(f, M((x, y) => oval.get(x, y) || oval.get(x - 1, y) || oval.get(x + 1, y) || oval.get(x, y - 1) || oval.get(x, y + 1)), R.gold, { cap: 1.5, base: 4, gain: 4 });
      fill(f, oval, R.vio.slice(1, 6), { cap: 2, base: 2, gain: 2.4 });
      f.draw([
        '..c.c.c..',
        '..ccccc..',
        '..cCCc...',
        '..cCCCc..',
        '..cCCC...',
        '...cC....',
        '..cccc...',
      ], ox, oy, { c: R.cream[7], C: R.cream[5] });
      return f;
    },
    overlay(k, b) {
      // glints on the bezel's rim and the band
      [[5, 2], [6, 2], [2, 12], [2, 13]].forEach(([x, y], i) => win(b, x, y, i % 2 ? '#FFFCF5A0' : '#FFFCF5E0'));
    },
  });

  // ------------------------------------------------------------ 23. Bravo Bouquet: three red roses in a cream paper cone tied
  // with a pink bow, landed on the stage boards, one petal drifting down, on a rose-maroon ground
  A.joker('bravobouquet', {
    ground: ['#4A1028', '#601838', '#782246', '#8E3058'], glow: [19, 11, 14], speck: [R.mult[7], R.cream[6]],
    draw() {
      const f = new Bmp(W, W);
      const leaf = ['#1C3A0A', '#2F5A12', '#3F7317', '#5A9A1F', '#7CC12C', '#9EE03C'];
      // the stage: planks with a lit top edge, a seam, and a dark front lip
      fill(f, box(0, 25, 30, 30), R.wood, { cap: 1, base: 3, gain: 2.4 });
      f.rect(0, 25, 31, 1, R.wood[6]); f.rect(0, 26, 31, 2, R.wood[4]); f.rect(0, 28, 31, 1, R.wood[2]); f.rect(0, 29, 31, 1, R.wood[3]); f.rect(0, 30, 31, 1, R.wood[1]);
      [9, 23].forEach((x) => f.rect(x, 26, 1, 2, R.wood[2])); f.rect(16, 29, 1, 1, R.wood[1]);
      // leaves peeking out of the cone's mouth
      [[[12, 13], [10, 9], [11, 6]], [[17, 17], [21, 20], [24, 20]], [[15, 12], [18, 5], [23, 4]]].forEach(([a, b, c]) => part(f, tube(a, b, c, (t) => 3 - t * 1.6), leaf, { cap: 1, base: 3, gain: 3 }));
      // the paper cone, lying on the stage, its upper side lit, a fold down its length
      const tip = [2, 27], mouth = [16, 14], ax = [(mouth[0] - tip[0]) / 19.8, (mouth[1] - tip[1]) / 19.8];
      const cone = M((x, y) => { const u = (x - tip[0]) * ax[0] + (y - tip[1]) * ax[1], v = (x - tip[0]) * ax[1] - (y - tip[1]) * ax[0]; return u >= 0 && u <= 19.8 && Math.abs(v) <= 0.8 + u * 0.27; });
      part(f, cone, R.cream, { cap: 2.5, base: 5, gain: 3.4 });
      for (let u = 3; u <= 18; u++) { const x = Math.round(tip[0] + ax[0] * u + ax[1] * 1.2), y = Math.round(tip[1] + ax[1] * u - ax[0] * 1.2); if (cone.get(x, y)) f.set(x, y, R.cream[3]); }
      // three cupped red roses at the mouth: a light outer ring, a dark spiral, a pale highlight up-left
      const ROSE = ['.hoo.', 'hoddo', 'odcdo', 'oddoo', '.ooo.'];
      const ROSE6 = ['.Hhoo.', 'Hhddoo', 'hdoddo', 'odcdoo', 'oddooo', '.oooo.'];
      const rose = (x, y, g) => {
        const m = M((i, j) => (g[j - y] || '')[i - x] && g[j - y][i - x] !== '.');
        ring(f, m);
        f.draw(g, x, y, { H: R.mult[7], h: R.mult[6], o: R.mult[5], d: R.mult[3], c: R.mult[2] });
      };
      rose(13, 6, ROSE6); rose(19, 9, ROSE6); rose(15, 12, ROSE6); rose(21, 3, ROSE);
      // the pink bow round the cone: two loops, a knot, two tails falling to the boards
      part(f, or(M((x, y) => Math.abs(x - 4.5) + Math.abs(y - 18.5) * 1.2 <= 2.4), M((x, y) => Math.abs(x - 10.5) + Math.abs(y - 22.5) * 1.2 <= 2.4)), R.pink, { cap: 1.5, base: 5, gain: 3.2 });
      part(f, or(M((x, y) => x === 6 && y >= 22 && y <= 24), M((x, y) => x === 7 && y >= 23 && y <= 25), M((x, y) => x === 9 && y >= 24 && y <= 25)), R.pink.slice(2), { cap: 1, base: 3, gain: 2.6 });
      part(f, box(7, 20, 8, 21), R.pink, { cap: 1, base: 6, gain: 2 });
      pix(f, [[4, 18], [10, 22]], R.pink[2]);
      // one petal drifting down
      part(f, box(4, 5, 5, 6), R.mult, { cap: 1, base: 5, gain: 3 }); f.set(4, 5, R.mult[7]);
      return f;
    },
  });

  // ------------------------------------------------------------ 24. Grand Finale: a jester with his arms flung wide under
  // a shower of gold and ember sparks, the last card of the night tossed high above him
  A.joker('grandfinale', {
    ground: ['#1E0C46', '#2A1258', '#36186A', '#421E7C'], glow: [15, 14, 14], speck: [R.money[7], R.ember[7]],
    draw() {
      const f = new Bmp(W, W), sk = SKIN.peach;
      // the card, tossed high
      const card = A.kit.cardShape({ mask: Mask.fn(7, 9, (i, j) => !((i === 0 || i === 6) && (j === 0 || j === 8))) });
      card.blit(A.kit.pipBmp('H', 5), 1, 2);
      f.blit(card, 12, 0);
      // legs apart, pointed gold shoes
      part(f, seg(13, 24, 10, 29, 2.6), R.pink, { cap: 1, base: 5, gain: 3 });
      part(f, seg(17, 24, 20, 29, 2.6), R.vio, { cap: 1, base: 5, gain: 3 });
      part(f, box(7, 29, 10, 30), R.gold, { cap: 1, base: 4, gain: 3 }); part(f, box(20, 29, 23, 30), R.gold, { cap: 1, base: 4, gain: 3 });
      // arms flung wide, open hands
      part(f, tube([12, 20], [7, 19], [3, 15], 2.8), R.vio, { cap: 1.2, base: 5, gain: 3 });
      part(f, tube([18, 20], [23, 19], [27, 15], 2.8), R.pink, { cap: 1.2, base: 5, gain: 3 });
      part(f, ell(2.5, 13.5, 1.8, 1.8), sk, { cap: 1, base: 4, gain: 3 }); part(f, ell(27.5, 13.5, 1.8, 1.8), sk, { cap: 1, base: 4, gain: 3 });
      // the tunic in two colours, a ruff
      const tunic = box(11, 18, 19, 25, 2);
      ring(f, tunic); fill2(f, tunic, R.vio, R.pink, (x) => x > 15, { cap: 2.5, base: 5, gain: 3.4 });
      ruff(f, 11, 19, 18, 1.9, 2);
      // the head tipped back, eyes shut, a wide cheer
      fill(f, ell(15, 13.5, 4.2, 4), sk, { cap: 2.5, base: 4, gain: 3.8 });
      pix(f, [[12, 13], [13, 12], [14, 13], [16, 13], [17, 12], [18, 13]], C.edge);
      f.draw(['.kk.', 'kmmk', 'kmtk', '.kk.'], 14, 15, { k: C.edge, m: '#5A1024', t: '#FF6F7E' });
      f.rect(11, 15, 2, 1, '#FF8FB4'); f.rect(18, 15, 2, 1, '#FF8FB4');
      // the cap: two prongs flaring up beside the card, bells, a dome
      prong(f, [12, 11], [9, 9], [8, 5], R.vio, 3.6, 2.2);
      prong(f, [18, 11], [21, 9], [22, 5], R.pink, 3.6, 2.2);
      bellS(f, 6, 3); bellS(f, 22, 3);
      hood(f, 15, 13.5, 4.2, 4, 11, R.vio, R.pink);
      // sparks raining down round him
      const spark = (x, y, ramp) => { part(f, M((i, j) => Math.abs(i - x) + Math.abs(j - y) <= 1), ramp, { cap: 1, base: 6, gain: 2 }); f.set(x, y, ramp[8]); };
      spark(3, 4, R.money); spark(27, 4, R.ember); spark(4, 23, R.ember); spark(26, 23, R.money);
      return f;
    },
    overlay(k, b) {
      [[9, 1], [21, 1], [1, 9], [29, 9], [7, 18], [24, 18], [2, 28], [28, 28]].forEach(([x, y], i) => win(b, x, y, i % 2 ? '#FFD84AD0' : '#FFA458D0'));
    },
  });

  // ------------------------------------------------------------ 25. Hot Cocoa: an ember enamel mug with a cream heart, full
  // of cocoa with a foam swirl, a marshmallow jester bobbing in it (belled cap points), a striped candy stirrer, steam
  A.joker('hotcocoa', {
    ground: ['#28102E', '#36163C', '#441C4A', '#522458'], glow: [12, 14, 14], speck: [R.cream[7], R.pink[6]],
    draw() {
      const f = new Bmp(W, W);
      const stick = seg(16, 12, 26, 2, 2.6);
      const stripes = (x, y) => ((x + y) % 4) < 2;
      // the candy stirrer, leaning out of the mug
      ring(f, stick); fill2(f, stick, R.mult, R.cream, stripes, { cap: 1, base: 5, gain: 3 }, { cap: 1, base: 6, gain: 3 });
      part(f, ell(26.5, 1.6, 1.8, 1.8), R.mult, { cap: 1, base: 5, gain: 3 });
      // the handle and the enamel mug, a cream heart on its side
      part(f, minus(ell(23, 19.5, 4.4, 5), ell(23.6, 19.5, 2, 2.8)), R.ember, { cap: 1.5, base: 5, gain: 3 });
      const mug = M((x, y) => x >= 3 && x <= 21 && y >= 11 && y <= 28 && !(y === 28 && (x <= 4 || x >= 20)) && !(y === 27 && (x === 3 || x === 21)));
      part(f, mug, R.ember, { cap: 4, base: 5, gain: 3.4 });
      for (let x = 3; x <= 21; x++) if (mug.get(x, 27) || mug.get(x, 28)) f.set(x, mug.get(x, 28) ? 28 : 27, R.ember[3]);
      f.draw(['.cc.cc.', 'cccccCc', 'cccccCc', '.cccCc.', '..cCc..', '...c...'], 9, 17, { c: R.cream[7], C: R.cream[5] });
      // the rim and the cocoa: a dark disc with a cream swirl of foam
      part(f, ell(12, 11, 9.4, 2.8), R.cream, { cap: 1, base: 6, gain: 2.4 });
      fill(f, ell(12, 11.3, 8, 1.9), R.wood.slice(1, 5), { cap: 1, base: 1, gain: 2 });
      pix(f, [[14, 11], [15, 11], [16, 12], [17, 11], [18, 11], [8, 12], [9, 12]], R.cream[5]);
      // the stirrer again where it rises out of the cocoa, in front of the rim
      fill2(f, M((x, y) => stick.get(x, y) && y <= 11), R.mult, R.cream, stripes, { cap: 1, base: 5, gain: 3 }, { cap: 1, base: 6, gain: 3 });
      // the marshmallow jester bobbing in the cocoa: a soft cream block, a happy face, two cap points with bells
      part(f, or(tube([8, 5.6], [3.6, 2.6], [2.6, 6], (t) => 2.6 - t * 0.6), tube([11.5, 5.6], [16, 2.6], [17, 6], (t) => 2.6 - t * 0.6)), R.pink, { cap: 1, base: 5, gain: 3 });
      [[2, 7], [16, 7]].forEach(([x, y]) => { ring(f, box(x, y, x + 1, y + 1)); f.rect(x, y, 2, 2, R.gold[4]); f.set(x, y, R.gold[6]); f.set(x + 1, y + 1, R.gold[2]); });
      part(f, box(6, 5, 13, 11, 2), R.cream, { cap: 2, base: 6, gain: 2.6 });
      pix(f, [[8, 7], [11, 7]], C.edge); f.draw(['k..k', '.kk.'], 8, 9, { k: C.edge });
      pix(f, [[7, 9], [12, 9]], R.pink[6]);
      return f;
    },
    overlay(k, b) {
      // steam rising in two soft curls, 2 px wide
      [[17, 7], [18, 6], [18, 5], [17, 4], [17, 3], [18, 2], [1, 8], [2, 7], [2, 6], [1, 5]].forEach(([x, y], i) => { const a = i % 5 < 3 ? 'B0' : '68'; win(b, x, y, '#FFFCF5' + a); win(b, x + 1, y, '#FFFCF5' + (i % 5 < 3 ? '70' : '40')); });
    },
  });

  // ------------------------------------------------------------ 26. Night Watchman: a watchman in a deep violet hooded cloak,
  // its hood ending in one long belled point, holding up a glowing candle lamp that rims him in warm light, his long
  // shadow stretching away behind him; still a night scene, lifted a step off near-black so more than the lamp reads
  A.joker('nightwatchman', {
    ground: ['#24104E', '#2E1660', '#3A1C74', '#462488'], glow: [8, 10, 13], speck: [R.vio[6], R.ember[6]],
    draw() {
      const f = new Bmp(W, W), sk = SKIN.peach, rim = R.ember[6];
      /** Light the edges that face the lamp (up and to the left) with a 1-px warm rim. */
      const lit = (m, c = rim) => { for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (m.get(x, y) && (!m.get(x - 1, y) || (!m.get(x, y - 1) && !m.get(x - 1, y - 1)))) f.set(x, y, c); };
      const coatRamp = R.vio.slice(1, 7);
      // boots, then the long cloak, buttoned, its lamp side rimmed in warm light
      f.rect(16, 29, 3, 2, C.edge); f.rect(22, 29, 3, 2, C.edge); f.rect(16, 29, 2, 1, R.wood[2]); f.rect(22, 29, 2, 1, R.wood[1]);
      const coat = M((x, y) => y >= 14 && y <= 28 && x >= 16 - (y - 14) * 0.25 && x <= 25 + (y - 14) * 0.3);
      part(f, coat, coatRamp, { cap: 3, base: 3, gain: 3.2 });
      f.line(21, 16, 21, 28, R.vio[1]); [18, 21, 24].forEach((y) => { f.set(22, y, R.gold[5]); });
      lit(coat);
      // the arm raised to the lamp, its top lit
      const arm = tube([18, 16], [12.5, 15], [11, 10.5], 3.4);
      part(f, arm, coatRamp, { cap: 1.5, base: 3, gain: 3 });
      lit(arm);
      // the lamp: a brass hood and base, glass glowing round a candle flame, a ring to hold it by
      part(f, M((x, y) => (Math.abs(x - 8) <= 1 && y === 4) || (x === 7 && y === 5) || (x === 9 && y === 5)), R.brass, { cap: 1, base: 4, gain: 3 });
      part(f, M((x, y) => y >= 6 && y <= 7 && Math.abs(x - 8) <= 3 - (y === 6 ? 1 : 0)), R.brass, { cap: 1, base: 4, gain: 3 });
      const glass = box(5, 8, 11, 14);
      ring(f, glass);
      for (let y = 8; y <= 14; y++) for (let x = 5; x <= 11; x++) f.set(x, y, Math.abs(x - 8) + Math.abs(y - 11) * 0.7 <= 2.2 ? '#FFF2B0' : Math.abs(x - 8) + Math.abs(y - 11) * 0.7 <= 3.6 ? '#FFD84A' : '#FFA458');
      f.draw(['.r.', 'oyo', '.u.'], 7, 9, { r: '#E8461C', o: '#FF7A2B', y: '#FFD84A', u: C.white });
      pix(f, [[5, 8], [11, 8], [5, 14], [11, 14]], R.brass[3]);
      part(f, box(5, 15, 11, 16), R.brass, { cap: 1, base: 4, gain: 3 });
      part(f, box(10, 9, 12, 11, 1), sk.slice(2), { cap: 1, base: 4, gain: 3 });
      // the hood round his face, rimmed on the lamp side, its point flopping back to a bell
      part(f, tube([22, 5.5], [27.6, 1.6], [29, 6], (t) => 4.2 - t * 2.4), coatRamp, { cap: 1.5, base: 3, gain: 3 });
      bellS(f, 28, 6);
      const hood = M((x, y) => ((x - 20.4) / 5.2) ** 2 + ((y - 9.6) / 5.4) ** 2 <= 1 && y <= 15);
      part(f, hood, coatRamp, { cap: 2, base: 3, gain: 3.4 });
      lit(hood);
      // the face in the hood: its lamp side warm and lit, the far side in shadow, eyes with a glint
      const face = ell(19.4, 10.6, 3.2, 3.4);
      ring(f, face, R.vio[0]);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (face.get(x, y)) f.set(x, y, x <= 17 ? sk[6] : x <= 19 ? sk[5] : x <= 20 ? sk[3] : sk[2]);
      pix(f, [[17, 10], [20, 10]], C.edge); pix(f, [[17, 9], [20, 9]], C.white);
      f.rect(18, 13, 2, 1, sk[1]); f.set(16, 12, '#FF8FB4');
      return f;
    },
    overlay(k, b) {
      // his long shadow, thrown away from the lamp across the floor
      for (let x = 17; x <= 30; x++) for (let y = 28; y <= 30; y++) if (y - 28 <= (x - 15) * 0.25) win(b, x, y, '#05020EA0');
      win(b, 30, 27, '#05020E70'); win(b, 29, 27, '#05020E50');
    },
  });

  // ------------------------------------------------------------ 27. Seesaw: a wooden seesaw, a stack of plain chip-blue
  // tokens on the low end, a jester launched off the high end in a star jump, his stocking cap tumbling away
  A.joker('seesaw', {
    ground: ['#9A4012', '#B44E18', '#CC5E20', '#E06E28'], glow: [22, 9, 13], speck: [R.ember[8], R.chips[7]],
    draw() {
      const f = new Bmp(W, W), sk = SKIN.peach;
      // the fulcrum, dark at its foot
      const fulcrum = M((x, y) => y >= 23 && y <= 30 && Math.abs(x - 15) <= (y - 22) * 0.75);
      part(f, fulcrum, R.wood, { cap: 1.5, base: 3, gain: 3.4 });
      for (let x = 0; x < W; x++) { if (fulcrum.get(x, 30)) f.set(x, 30, R.wood[0]); if (fulcrum.get(x, 29)) f.set(x, 29, R.wood[1]); }
      // the stack of tokens on the low end: one cylinder, a lit top, rims between the four tokens, no spots
      const stack = box(1, 13, 9, 25, 2);
      ring(f, stack);
      for (let y = 13; y <= 25; y++) for (let x = 1; x <= 9; x++) if (stack.get(x, y)) f.set(x, y, R.chips[[6, 6, 5, 5, 5, 4, 4, 3, 2][x - 1]]);
      fill(f, ell(5, 14, 3.6, 1.2), R.chips.slice(5), { cap: 1, base: 2, gain: 2 });
      [17, 20, 23].forEach((y) => { for (let x = 2; x <= 8; x++) f.set(x, y + (x >= 4 && x <= 6 ? 1 : 0), R.chips[2]); });
      // the plank, low on the left: a lit top edge, a dark underside
      const plank = seg(1, 27, 29, 19, 3);
      part(f, plank, R.wood, { cap: 1.5, base: 4, gain: 3.4 });
      for (let x = 0; x < W; x++) {
        let top = -1, bot = -1;
        for (let y = 0; y < W; y++) if (plank.get(x, y)) { if (top < 0) top = y; bot = y; }
        if (top >= 0) { f.set(x, top, R.wood[6]); f.set(x, bot, R.wood[1]); }
      }
      // the jester in a star jump over the high end: arms and legs flung wide, mouth an O
      part(f, seg(22, 11, 18, 15, 2.4), R.lime, { cap: 1, base: 5, gain: 3 });
      part(f, seg(24, 11, 28, 15, 2.4), R.pink, { cap: 1, base: 5, gain: 3 });
      part(f, seg(21, 8, 17, 4, 2.4), R.pink, { cap: 1, base: 5, gain: 3 });
      part(f, seg(25, 8, 29, 4, 2.4), R.lime, { cap: 1, base: 5, gain: 3 });
      [[16, 2], [28, 2]].forEach(([x, y]) => part(f, box(x, y, x + 1, y + 1), sk, { cap: 1, base: 4, gain: 3 }));
      [[16, 15], [28, 15]].forEach(([x, y]) => part(f, box(x, y, x + 1, y + 1), R.vio, { cap: 1, base: 5, gain: 3 }));
      const tunic = box(20, 7, 26, 11, 2);
      ring(f, tunic); fill2(f, tunic, R.lime, R.pink, (x) => x > 23, { cap: 2, base: 5, gain: 3.4 });
      fill(f, ell(23, 4, 2.6, 2.6), sk, { cap: 2, base: 4, gain: 3.6 });
      f.draw(['.h.h.', 'hhhhh'], 21, 1, { h: R.ember[2] });
      pix(f, [[22, 4], [24, 4]], C.edge); f.set(23, 5, C.edge); f.set(23, 6, '#7A1A2A');
      // his stocking cap tumbling off up-left: a band, one long point curling to a bell
      part(f, tube([15, 7.5], [10, 9], [9, 4], (t) => 4.6 - t * 2.4), R.vio, { cap: 2, base: 5, gain: 3.6 });
      part(f, M((x, y) => (x === 15 || x === 16) && y >= 5 && y <= 10), R.cream, { cap: 1, base: 5, gain: 2.6 });
      bellS(f, 8, 1);
      return f;
    },
    overlay(k, b) {
      // whoosh ticks between him and his cap, and under him
      [[17, 7], [18, 8], [17, 9], [19, 11], [20, 13], [22, 15], [24, 15]].forEach(([x, y]) => win(b, x, y, '#FFF0D8A0'));
    },
  });

  // ------------------------------------------------------------ 28. Penniless Poet: a thin poet jester, head bowed, both
  // pockets turned inside out, holding one out as a moth flutters up from it, a rolled verse scroll under his other arm;
  // a red beret with a quill in its band and one short point curling up to a bell
  A.joker('pennilesspoet', {
    ground: ['#4A1436', '#5C1A42', '#6E2050', '#82285E'], glow: [15, 13, 14], speck: [R.cream[6], R.vio[7]],
    draw() {
      const f = new Bmp(W, W), sk = SKIN.rose, coat = R.vio.slice(1);
      // thin legs in dark hose, worn shoes
      part(f, seg(13.5, 23, 12.5, 28, 2.4), R.navy, { cap: 1, base: 3, gain: 3 });
      part(f, seg(16.5, 23, 17.5, 28, 2.4), R.navy, { cap: 1, base: 5, gain: 3 });
      part(f, box(9, 28, 12, 29), R.wood, { cap: 1, base: 3, gain: 3 }); part(f, box(18, 28, 21, 29), R.wood, { cap: 1, base: 3, gain: 3 });
      // the long violet coat
      part(f, M((x, y) => y >= 14 && y <= 24 && Math.abs(x - 15) <= 3.6 + (y - 14) * 0.2), coat, { cap: 3, base: 4, gain: 3.2 });
      // the pockets, turned out: cream linings hanging from the hips, the coat's dark pocket mouth above each
      const lining = (x, y) => {
        part(f, M((i, j) => i >= x && i <= x + 2 && j >= y && j <= y + 3 && !(j === y + 3 && i !== x + 1)), R.cream, { cap: 1, base: 6, gain: 2.2 });
        f.rect(x, y - 1, 3, 1, R.vio[0]); f.set(x + 2, y + 1, R.cream[4]); f.set(x + 2, y + 2, R.cream[4]);
      };
      // the rolled verse scroll clamped under his left arm, tied with a red ribbon
      part(f, box(5, 17, 13, 19, 1), R.cream.slice(1, 7), { cap: 1.5, base: 4, gain: 2.6 });
      f.set(5, 18, R.cream[2]); f.set(6, 18, R.cream[4]); f.rect(8, 17, 1, 3, R.mult[4]);
      // the left arm down at his side over the scroll, the right held out from the hip with the other lining
      part(f, tube([12, 14.6], [10.6, 17], [10.6, 20.4], 2.6), coat, { cap: 1, base: 4, gain: 3 });
      part(f, box(10, 20, 11, 21), sk, { cap: 1, base: 4, gain: 3 });
      lining(8, 22);
      part(f, tube([18, 15], [20.5, 17], [22, 19.6], 2.6), coat, { cap: 1, base: 4, gain: 3 });
      lining(22, 21);
      part(f, box(22, 19, 23, 20), sk, { cap: 1, base: 4, gain: 3 });
      // the ruff, the head bowed: eyes cast down, brows sad, a small frown
      ruff(f, 11, 19, 13, 1.7, 2);
      fill(f, ell(14.6, 9.6, 3.6, 4), sk, { cap: 2.5, base: 4, gain: 4 });
      pix(f, [[11, 10], [12, 10], [15, 10], [16, 10]], C.edge);
      pix(f, [[11, 8], [12, 7], [16, 7], [17, 8]], sk[1]);
      pix(f, [[13, 12], [14, 12], [15, 12]], sk[0]); pix(f, [[12, 13], [16, 13]], sk[1]);
      f.set(13, 11, sk[2]); f.set(17, 11, '#FF8FB4');
      // the beret, tilted, with one short point curling up to a bell above his head, and a quill in its band
      part(f, tube([18.5, 4.6], [22.5, 2.4], [24.6, 3], (t) => 3.2 - t * 1.4), R.mult, { cap: 1.5, base: 5, gain: 3.4 });
      bellS(f, 24, 1);
      part(f, M((x, y) => ((x - 14.6) / 6.4) ** 2 + ((y - 5.2) / 2.6) ** 2 <= 1), R.mult, { cap: 2, base: 5, gain: 3.6 });
      part(f, M((x, y) => y === 7 && x >= 10 && x <= 19), R.mult.slice(0, 5), { cap: 1, base: 2, gain: 2 });
      part(f, tube([11, 5.6], [8, 2.4], [5.4, 0.6], (t) => 2.4 - t * 0.8), R.cream, { cap: 1, base: 6, gain: 2.4 });
      pix(f, [[10, 5], [9, 4], [8, 3], [7, 2]], R.cream[3]);
      // the moth fluttering up out of the right pocket: two pale pairs of wings, a dark body
      const MOTH = ['.WW.WW.', 'WWWkWWW', 'WWWkWWW', '.wwkww.', '..w.w..'];
      const moth = M((x, y) => (MOTH[y - 12] || '')[x - 23] && MOTH[y - 12][x - 23] !== '.');
      ring(f, moth);
      f.draw(MOTH, 23, 12, { W: GREY[7], w: GREY[5], k: C.edge });
      pix(f, [[24, 12], [27, 12]], C.white);
      return f;
    },
    overlay(k, b) {
      // a trail of moth dust rising from the pocket
      [[24, 19], [25, 18], [25, 17]].forEach(([x, y], i) => win(b, x, y, i ? '#FFFCF570' : '#FFFCF5A0'));
    },
  });

  // ------------------------------------------------------------ 29. Orrery: a brass orrery, an orange ringed planet and two
  // small moons on curved arms, a tiny one-pointed jester cap on its top finial
  A.joker('orrery', {
    ground: ['#1A1450', '#241A62', '#2E2074', '#382886'], glow: [15, 13, 14], speck: [R.money[7], R.cream[7]],
    draw() {
      const f = new Bmp(W, W);
      // the stepped base and the column
      part(f, box(8, 27, 22, 30, 1), R.brass, { cap: 1.5, base: 4, gain: 3.4 });
      part(f, box(11, 24, 19, 27, 1), R.brass, { cap: 1.5, base: 5, gain: 3.4 });
      part(f, box(14, 17, 16, 24), R.brass, { cap: 1, base: 4, gain: 3 });
      // the curved arms out to the moons
      part(f, tube([14, 20], [5, 20], [4, 11], 1.6), R.brass, { cap: 1, base: 4, gain: 3 });
      part(f, tube([16, 21], [26, 22], [26, 16], 1.6), R.brass, { cap: 1, base: 4, gain: 3 });
      const moon = (x, y, ramp) => { const s = A.kit.sphere(2.2, ramp); ring(f, M((i, j) => !!s.get(i - x, j - y))); f.blit(s, x, y); };
      moon(1, 6, R.cream); moon(23, 11, R.pink);
      // the planet and its ring, held in a brass hoop
      part(f, minus(ell(15, 12, 7.5, 7.5), ell(15, 12, 6.3, 6.3)), R.brass, { cap: 1, base: 4, gain: 3 });
      const ringM = (front) => M((x, y) => { const d = ((x - 15) / 7.4) ** 2 + ((y - 12) / 2) ** 2; return d <= 1 && d >= 0.45 && (front ? y >= 12 : y < 12); });
      fill(f, ringM(false), R.cream, { cap: 1, base: 4, gain: 3 });
      const planet = A.kit.sphere(4.2, R.ember);
      ring(f, M((x, y) => !!planet.get(x - 10, y - 7))); f.blit(planet, 10, 7);
      pix(f, [[11, 12], [12, 13], [18, 10], [19, 11]], R.ember[3]);
      ring(f, ringM(true)); fill(f, ringM(true), R.cream, { cap: 1, base: 6, gain: 3 });
      // the finial and its tiny jester cap: a pink stocking cap with a lime band, its one point flopping to a bell
      part(f, box(14, 3, 16, 4), R.brass, { cap: 1, base: 4, gain: 3 });
      part(f, M((x, y) => (y >= 0 && y <= 2 && x >= 13 && x <= 17 && !(y === 0 && (x === 13 || x === 17))) || (y === 1 && x >= 18 && x <= 19) || (y === 2 && x >= 20 && x <= 21)), R.pink, { cap: 1.5, base: 5, gain: 3.2 });
      fill(f, M((x, y) => y === 2 && x >= 13 && x <= 17), R.lime, { cap: 1, base: 5, gain: 3 });
      bellS(f, 20, 4);
      return f;
    },
  });

  // ------------------------------------------------------------ 30. Patchwork Doll: a floppy cream rag doll sitting slumped,
  // legs straight out in front, arms limp, head tilted, stitched patches in pink, lime, chip blue and ember, orange
  // yarn hair with one floppy patch point, one button eye and the other hanging loose on a thread from an X-stitched socket
  A.joker('patchworkdoll', {
    ground: ['#2E1210', '#3C1A16', '#4A221A', '#5A2A20'], glow: [14, 13, 15], speck: [R.cream[6], R.ember[7]],
    draw() {
      const f = new Bmp(W, W);
      const cloth = R.cream.slice(1);
      /** A 4 x 4 patch with a stitched seam round it (every other pixel of the border is a stitch). */
      const patch = (x, y, ramp) => {
        f.blit(emboss(M((i, j) => i >= x && i <= x + 3 && j >= y && j <= y + 3), ramp, { cap: 1.5, base: 5, gain: 2.6 }), 0, 0);
        for (let i = -1; i <= 4; i++) for (let j = -1; j <= 4; j++) if ((i === -1 || i === 4 || j === -1 || j === 4) && (i + j) % 2 === 0 && f.get(x + i, y + j)) f.set(x + i, y + j, R.cream[1]);
      };
      // legs straight out in front, a little apart, soles toward us
      part(f, or(tube([11.4, 22], [9.4, 25], [7.6, 28], 5), tube([17.6, 22], [19.6, 25], [21.4, 28], 5)), cloth, { cap: 2, base: 4, gain: 3 });
      patch(6, 24, R.chips); patch(19, 24, R.ember);
      part(f, ell(6.6, 28.8, 2.6, 1.8), R.pink.slice(2), { cap: 1, base: 4, gain: 3 });
      part(f, ell(22.4, 28.8, 2.6, 1.8), R.pink.slice(2), { cap: 1, base: 4, gain: 3 });
      // the arms hanging limp to the floor
      part(f, tube([10, 16.5], [6.6, 19], [5.6, 23.4], 3.4), cloth, { cap: 1.5, base: 4, gain: 3 });
      part(f, tube([19, 16.5], [22.4, 19], [23.4, 23.4], 3.4), cloth, { cap: 1.5, base: 4, gain: 3 });
      part(f, ell(5.4, 24, 1.8, 1.6), cloth, { cap: 1, base: 4, gain: 3 }); part(f, ell(23.6, 24, 1.8, 1.6), cloth, { cap: 1, base: 4, gain: 3 });
      // the slumped body, patched, a pink ruff
      part(f, box(9, 15, 20, 24, 3), cloth, { cap: 3, base: 4, gain: 3.4 });
      patch(10, 17, R.pink); patch(15, 19, R.lime);
      ruff(f, 10, 19, 15, 1.6, 2.2, R.pink.slice(1));
      // the floppy patch point (lime, stitched), then the head tilted, orange yarn hair
      part(f, tube([18, 3.4], [24, 0.6], [26, 6], (t) => 4 - t * 2), R.lime, { cap: 1.5, base: 5, gain: 3.2 });
      [[20, 2], [22, 1], [24, 2], [25, 4]].forEach(([x, y]) => f.set(x, y, R.lime[2]));
      bellS(f, 25, 7);
      part(f, ell(14.4, 9, 6.2, 5.8), cloth, { cap: 3, base: 4, gain: 3.6 });
      const yarn = M((x, y) => [[9, 4.6], [11.4, 3], [14.2, 2.6], [17, 3], [19.4, 4.8], [8, 7.4], [20.6, 7.4], [7.8, 10.4]].some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= 2.6));
      part(f, yarn, R.ember, { cap: 1.5, base: 5, gain: 3.4 });
      pix(f, [[10, 3], [13, 2], [16, 2], [8, 6]], R.ember[7]);
      // the face, tilted: a sewn dark button eye, an X-stitched socket with the other button hanging loose on a cream
      // thread, rosy cheeks, a stitched smile curving up
      part(f, box(10, 8, 12, 10), R.dark.slice(1), { cap: 1, base: 3, gain: 2.6 }); pix(f, [[10, 9], [12, 9]], R.dark[5]); f.set(10, 8, R.dark[6]);
      pix(f, [[16, 6], [18, 6], [17, 7], [16, 8], [18, 8]], R.cream[1]);
      f.rect(17, 9, 1, 2, C.white);
      part(f, box(16, 11, 18, 13), R.chips, { cap: 1, base: 5, gain: 2.6 }); pix(f, [[16, 12], [18, 12]], R.chips[1]); f.set(16, 11, R.chips[7]);
      pix(f, [[9, 12], [14, 10]], R.pink[6]); f.set(9, 11, R.pink[5]);
      pix(f, [[11, 12], [12, 13], [13, 13], [14, 12]], R.cream[1]);
      return f;
    },
  });

})();
