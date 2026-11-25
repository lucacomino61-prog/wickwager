/* The three Jokers of the Ember Lit mockup: Jingle Jester, The Paperclip, Coupon Clipper.
 * The Paperclip and Coupon Clipper are Lit's, pixel-identical. The Jingle Jester was redrawn in the final pass
 * (2026-11-24) as a figure from the candle world; Lit's drawing stays below behind JINGLE_JESTER_STYLE.
 * Each entry is the shape of Lit's JOKER_ART: a ground (4 colours, dark to light, drawn light at the top), an
 * optional glow pool [x, y, r], speck colours, and draw(kit) -> the 31 x 31 figure. The core adds the rarity
 * frame, gems, ground, glow, specks, the ink outline and the empty name plate.
 * seed keeps Lit's speck positions (its ids had hyphens); new Jokers leave it out and are seeded by their id.
 */
(() => {
  'use strict';
  const A = globalThis.TW.Art;

  // ---- Jingle Jester. The one-line switch: 'candle' (the default) is the candle-world bell-ringer; 'classic' brings
  // back Lit's grinning jester in a three-pointed bell cap, pixel-identical to the mockup. Any other value is 'candle'.
  const JINGLE_JESTER_STYLE = 'candle'; // or 'classic'

  // 'classic': a grinning jester in a three-pointed bell cap (lime, pink and blue points, gold bells),
  // eyes squeezed shut with laughter, a white ruff, on a violet ground (Lit's, unchanged)
  const JINGLE_CLASSIC = {
    rarity: 'common', seed: 'jingle-jester',
    ground: ['#3E1880', '#4A1F94', '#5726A6', '#6430B4'], speck: [A.kit.R.pink[5], A.kit.R.lime[5], A.kit.R.money[5], A.kit.R.chips[7]],
    glow: [15, 16, 13],
    draw(k) {
      const { Bmp, Mask, R, C, emboss, strokeQuad, ellipse, disc } = k;
      const W = 31, f = new Bmp(W, W);
      // three cap prongs curling out to bells: lime, pink, blue, each a shaded tube that thins to its tip
      const prong = (p0, p1, p2, ramp) => f.blit(emboss(strokeQuad(W, W, p0, p1, p2, (t) => 5.2 - t * 2.6), ramp, { cap: 2, base: 5, gain: 4.4 }), 0, 0);
      prong([10.5, 12], [3, 3], [2.5, 10], R.lime);
      prong([20.5, 12], [28, 3], [28.5, 10], R.chips);
      prong([15.5, 11], [13.5, 4], [18.5, 2], R.pink);
      // the cap band across the brow, with studs in two colours
      f.blit(emboss(Mask.fn(W, W, (x, y) => y >= 10 && y <= 13 && Math.abs(x - 15.5) <= 9.5 - (y === 10 ? 1.5 : 0)), R.gold, { cap: 1.5, base: 4, gain: 3.4 }), 0, 0);
      [8, 11, 14, 17, 20, 23].forEach((x, i) => { f.set(x, 11, i % 2 ? R.pink[6] : R.chips[7]); f.set(x, 12, i % 2 ? R.pink[4] : R.chips[5]); });
      // the face: a lit oval, eyes shut with laughter, raised brows and a wide grin
      const skin = ['#6A2A1C', '#94442E', '#C06446', '#DE845C', '#F2A272', '#FCC090', '#FFDDB8'];
      f.blit(emboss(ellipse(W, W, 15.5, 19, 8.3, 7), skin, { cap: 3.5, base: 3, gain: 4.6 }), 0, 0);
      [[10, 17], [11, 16], [12, 16], [13, 17], [18, 17], [19, 16], [20, 16], [21, 17]].forEach(([x, y]) => f.set(x, y, C.edge));
      [[10, 14], [11, 14], [12, 14], [19, 14], [20, 14], [21, 14]].forEach(([x, y]) => f.set(x, y, '#8C3A2A'));
      f.rect(8, 19, 3, 2, '#FF8FB4'); f.rect(21, 19, 3, 2, '#FF8FB4'); f.set(8, 19, '#FFB8D0'); f.set(21, 19, '#FFB8D0');
      f.set(15, 18, '#D97A5E'); f.set(16, 19, '#D97A5E');
      const mouth = Mask.fn(W, W, (x, y) => y >= 21 && ((x - 15.5) / 5.4) ** 2 + ((y - 21) / 4) ** 2 <= 1);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (mouth.get(x, y)) f.set(x, y, y === 21 ? C.white : y === 22 ? '#5A1024' : '#3E0A1A');
      f.rect(13, 24, 6, 1, '#E8384A'); f.rect(14, 23, 4, 1, '#FF6F7E');
      // bells on the prong tips, with a slit and a glint
      const bell = emboss(disc(2.6), R.gold, { cap: 2, base: 4, gain: 4.6 });
      [[0, 8], [26, 8], [16, 0]].forEach(([x, y]) => { f.blit(bell, x, y); f.set(x + 2, y + 4, C.edge); f.set(x + 3, y + 4, C.edge); f.set(x + 1, y + 1, C.white); });
      // the ruff: scallops in cream and pale pink, a second row peeking behind
      const back = Mask.fn(W, W, (x, y) => y >= 24 && y <= 28 && [5.5, 10.5, 15.5, 20.5, 25.5].some((c) => (x - c) ** 2 + (y - 26) ** 2 <= 8));
      f.blit(emboss(back, R.pink.slice(2), { cap: 2, base: 4, gain: 3.4 }), 0, 0);
      const ruff = Mask.fn(W, W, (x, y) => y >= 26 && y <= 30 && [3, 8, 13, 18, 23, 28].some((c) => (x - c) ** 2 + (y - 28.5) ** 2 <= 9.5));
      f.blit(emboss(ruff, R.cream, { cap: 2, base: 5, gain: 3.6 }), 0, 0);
      return f;
    },
  };

  // 'candle': the court's bell-ringer, one of the table's own candles come alive: cream wax lit from the left with
  // pink wax run over its rim, Lit's table flame on its wick, standing in its pink dish like the Blind candles. It
  // winks and rings a big gold handbell held up on a wooden grip, the clapper swinging, a glint of the ring above the
  // bell's shoulders. No cap, no ruff, no mask, no harlequin colours; violet ground, specks in gold, cream and ember
  let jingleFig = null;
  const JINGLE_CANDLE = {
    rarity: 'common',
    ground: ['#3E1880', '#4A1F94', '#5726A6', '#6430B4'], speck: [A.kit.R.gold[5], A.kit.C.cream, A.kit.R.ember[6]],
    glow: [8, 6, 12],
    draw(k) {
      const { Bmp, Mask, R, C, emboss, strokeQuad } = k;
      const W = 31, f = new Bmp(W, W);
      const M = (fn) => Mask.fn(W, W, fn);
      /** a shaded part with its own ink rim, so it parts from what it overlaps */
      const part = (m, ramp, o) => { const p = emboss(m, ramp, o); p.outline(C.edge); f.blit(p, 0, 0); return p; };
      // the handbell: a wooden grip with a round knob, the bell row by row from crown to lip (even widths round
      // x 22.5), the clapper swung one pixel left, a glint on the lit shoulder
      const BX = 23, BY = 12, ROWS = [4, 6, 6, 8, 8, 8, 8, 10, 12, 14];
      part(M((x, y) => y >= BY - 7 && y < BY && x >= BX - 1 && x <= BX), R.wood, { cap: 1, base: 4, gain: 3 });
      part(M((x, y) => (y === BY - 9 && x >= BX - 1 && x <= BX) || (y === BY - 8 && x >= BX - 2 && x <= BX + 1)), R.wood, { cap: 1, base: 5, gain: 3 });
      part(M((x, y) => y >= BY + ROWS.length && y <= BY + ROWS.length + 1 && x >= BX - 2 && x <= BX - 1), R.gold.slice(0, 5), { cap: 1, base: 3, gain: 3 });
      part(M((x, y) => { const r = y - BY; return r >= 0 && r < ROWS.length && x >= BX - ROWS[r] / 2 && x < BX + ROWS[r] / 2; }), R.gold, { cap: 2.4, base: 4, gain: 4.2 });
      f.set(BX - 2, BY + 2, R.gold[6]);
      // the wax arm that rings it, and the fist round the grip
      part(strokeQuad(W, W, [13, 20], [18, 18], [20.5, 9.5], 2), R.cream, { cap: 1.2, base: 5, gain: 3 });
      part(M((x, y) => (x + 0.5 - 21.5) ** 2 + (y + 0.5 - 8.5) ** 2 <= 2.3), R.cream, { cap: 1.2, base: 5, gain: 3 });
      // the candle: wax lit from the left (Lit's candle), pink wax pooled round the wick and run over the rim
      const X0 = 3, X1 = 13, TOP = 11, BOT = 26;
      const SH = [C.white, C.cream, C.cream, C.cream, C.cream1, C.cream1, C.cream1, C.cream2, C.cream2, C.cream3, C.cream4];
      const body = new Bmp(W, W);
      for (let y = TOP; y <= BOT; y++) for (let x = X0; x <= X1; x++) body.set(x, y, SH[x - X0]);
      for (let x = X0; x <= X1; x++) body.set(x, TOP, R.pink[x >= 7 && x <= 9 ? 6 : 7]);
      [[4, 2], [11, 2], [12, 3]].forEach(([x, len]) => { for (let y = TOP + 1; y < TOP + len; y++) body.set(x, y, R.pink[7]); body.set(x, TOP + len, R.pink[6]); });
      body.outline(C.edge);
      f.blit(body, 0, 0);
      // the pink dish it stands in
      part(M((x, y) => (y === BOT + 1 && x >= X0 - 1 && x <= X1 + 1) || (y === BOT + 2 && x >= X0 - 2 && x <= X1 + 2) || (y === BOT + 3 && x >= X0 && x <= X1)), R.pink, { cap: 1.3, base: 5, gain: 3.6 });
      // the face: a wink, a sly open smile, rosy cheeks
      [[5, 16], [6, 15], [7, 16], [10, 15], [10, 16], [7, 18], [8, 19], [9, 19], [10, 18]].forEach(([x, y]) => f.set(x, y, C.edge));
      f.set(8, 18, R.mult[3]); f.set(9, 18, R.mult[3]);
      f.set(5, 17, R.pink[6]); f.set(11, 17, R.pink[6]);
      // the wick and Lit's table flame
      f.draw(['...r...', '...o...', '..ooo..', '..oao..', '.oayao.', '.oyuyo.', 'roauaor', '.oavao.', '..ooo..', '...k...'], 5, 1,
        { r: '#E8461C', o: '#FF7A2B', a: '#FFA458', y: '#FFD84A', u: '#FFF2B0', v: '#FFFFFF', k: C.edge });
      jingleFig = f;
      return f;
    },
    overlay(k, b) {
      // the ring of the bell: short gold strokes off its shoulders, un-inked so they read as light, on the ground only
      [[27, 9], [28, 8], [29, 11], [30, 11], [17, 9], [16, 8]].forEach(([x, y]) => { if (!(jingleFig && jingleFig.get(x, y))) b.set(5 + x, 7 + y, k.R.gold[6]); });
    },
  };

  A.joker('jinglejester', JINGLE_JESTER_STYLE === 'classic' ? JINGLE_CLASSIC : JINGLE_CANDLE);

  // ---- The Paperclip: a big pink paperclip clamped on a stack of cream cards, on a deep chip-blue ground
  A.joker('paperclip', {
    rarity: 'uncommon',
    ground: ['#1E2A8C', '#2534A0', '#2D3EB2', '#3448C0'], speck: [A.kit.R.chips[7], A.kit.C.white],
    draw(k) {
      const { Bmp, Mask, R, C, emboss, pipBmp } = k;
      const W = 31, f = new Bmp(W, W);
      const mini = (x, y, suit) => {
        const m = Mask.fn(13, 18, (i, j) => !((i === 0 || i === 12) && (j === 0 || j === 17)));
        const c = new Bmp(13, 18);
        for (let j = 0; j < 18; j++) for (let i = 0; i < 13; i++) if (m.get(i, j)) c.set(i, j, i === 12 || j === 17 ? C.cream3 : i === 0 || j === 0 ? C.white : C.cream);
        if (suit) c.blit(pipBmp(suit, 7), 2, 5);
        const o = new Bmp(15, 20); o.blit(c, 1, 1); o.outline(C.edge);
        f.blit(o, x - 1, y - 1);
      };
      mini(2, 12, null); mini(5, 10, null); mini(8, 8, 'H');
      // the clip, clamped on the stack's right edge: three legs of pink vinyl wire, a small bend on top and a big one below
      const X0 = 18, Y0 = 1;
      const clip = Mask.fn(W, W, (x, y) => {
        const u = x - X0, v = y - Y0;
        if (u < 0 || u > 10 || v < 0 || v > 28) return false;
        const leg = (a, from, to) => (u === a || u === a + 1) && v >= from && v <= to;
        if (leg(0, 9, 23) || leg(4, 4, 20) || leg(8, 4, 23)) return true;
        const dt = Math.hypot(u - 5.5, v - 4.5);
        if (v <= 4.5 && dt >= 1.6 && dt <= 3.6) return true;
        const db = Math.hypot(u - 4.5, v - 23);
        return v >= 23 && db >= 3.5 && db <= 5.6;
      });
      f.blit(emboss(clip, R.pink, { cap: 1, base: 5, gain: 3.2 }), 0, 0);
      return f;
    },
  });

  // ---- Coupon Clipper: steel scissors with red ring handles snipping a cream money-off slip with a big gold $,
  // its cut corner flying away, on a gold ground
  A.joker('couponclipper', {
    rarity: 'common', seed: 'coupon-clipper',
    ground: ['#C87A1C', '#D8882A', '#E39634', '#ECA442'], speck: [A.kit.R.money[8], A.kit.R.money[6]],
    draw(k) {
      const { Bmp, Mask, R, C, emboss, strokeQuad, textBmp } = k;
      const W = 31, f = new Bmp(W, W);
      // the coupon, a corner already snipped off, a dashed cut line and a big dollar sign
      const coupon = Mask.fn(W, W, (x, y) => x >= 1 && x <= 18 && y >= 7 && y <= 24 && !(x + (24 - y) > 34));
      f.blit(emboss(coupon, R.cream, { cap: 2, base: 5, gain: 3 }), 0, 0);
      for (let x = 3; x <= 16; x++) if (x % 2) { f.set(x, 9, C.edge); f.set(x, 22, C.edge); }
      for (let y = 11; y <= 20; y++) if (y % 2) { f.set(3, y, C.edge); f.set(16, y, C.edge); }
      f.blit(textBmp('$', 'L', 'coin'), 5, 10);
      f.draw(['www', '.ww', '..w'], 21, 2, { w: C.cream });
      // scissors: two steel blades open around the coupon edge, red ring handles below right
      const blade = (p0, p1) => f.blit(emboss(strokeQuad(W, W, p0, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], p1, (t) => 3.2 - t * 2.4), R.steel, { cap: 1.2, base: 3, gain: 3 }), 0, 0);
      blade([22, 17], [12, 5]); blade([22, 17], [11, 13]);
      const ring = (cx, cy) => { const m = Mask.fn(W, W, (x, y) => { const d = Math.hypot(x - cx, y - cy); return d <= 3.4 && d >= 1.6; }); f.blit(emboss(m, R.mult, { cap: 1.2, base: 5, gain: 3 }), 0, 0); };
      ring(26, 22); ring(20, 26);
      f.line(22, 18, 24, 20, R.mult[5]); f.line(21, 19, 21, 23, R.mult[5]);
      f.set(22, 17, C.edge); f.set(23, 17, '#7A869E');
      return f;
    },
  });
})();
