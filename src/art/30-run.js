/* The run: Blind emblems, Boss Blinds, Vouchers, Tags and Booster Packs.
 * Seeded from the Ember Lit mockup, pixel-identical: the Small and Big Blind candles and The Smudge.
 *
 * The candles are the wax and dish only. The flame is 'ui:flame' (three 7 x 10 frames in a 21 x 10 strip),
 * stepped by CSS and set over the wick: Lit's .candle .wick is 7 x 10 art px, centred on the candle, with a
 * margin of -1 art px below it so the flame's ink tip meets the wick.
 *
 * Boss emblems are characters and objects, never round chips: each has its own silhouette and colours, and
 * each carries some of the acid green that marks a Boss (The Smudge's eyes). Vouchers draw only the picture
 * in the ticket's window, Tags only the enamel picture, Packs only the matchbox ramp and the label picture;
 * the core draws the stub, the brass token and the boxes (with the Jumbo and Mega marks).
 * Shared helpers live in TW.Art.lib.run.
 */
(() => {
  'use strict';
  const A = globalThis.TW.Art;
  const K = A.kit;
  const { Bmp, Mask, R, C, emboss } = K;

  // ------------------------------------------------------------ helpers (TW.Art.lib.run)
  const L = (A.lib.run = A.lib.run || {});
  /** Lit's skin ramp (the classic Jingle Jester's face, 40-jokers-lit.js), dark to light. */
  L.SKIN = Object.freeze(['#6A2A1C', '#94442E', '#C06446', '#DE845C', '#F2A272', '#FCC090', '#FFDDB8']);
  /** Emboss a mask in a ramp and lay it on f; with ink (the default) the part gets its own 1-px edge, so it
      separates from whatever it overlaps. Returns the shaded part. */
  L.layer = (f, mask, ramp, o = {}, ink = true) => { const p = emboss(mask, ramp, o); if (ink) p.outline(C.edge); f.blit(p, 0, 0); return p; };
  /** A copy of b one px bigger each side, inked. */
  L.inkedCopy = (b) => { const o = new Bmp(b.w + 2, b.h + 2); o.blit(b, 1, 1); return o.outline(C.edge); };
  /** Shade one mask in several ramps and pick a ramp per pixel: band(x, y) -> index into ramps (stripes). */
  L.bands = (mask, ramps, band, o = {}) => {
    const sh = ramps.map((r) => emboss(mask, r, o)), b = new Bmp(mask.w, mask.h);
    for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) if (mask.get(x, y)) b.set(x, y, sh[band(x, y)].get(x, y));
    return b;
  };
  /** A rectangle of half-size (hw, hh) round (cx, cy), turned by ang radians (drawn, not a rotated sprite). */
  L.rotRect = (w, h, cx, cy, hw, hh, ang) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    return Mask.fn(w, h, (x, y) => { const dx = x - cx, dy = y - cy; return Math.abs(dx * c + dy * s) <= hw && Math.abs(-dx * s + dy * c) <= hh; });
  };
  /** 3 x 3 pips for small cards (h heart: red; s spade, c club: dark). There is no diamond: at 3 x 3 it is a plus,
      and a small red plus reads as a first-aid cross. A diamond needs K.pipBmp('D', 5) on a card 7 px wide or more. */
  L.PIP3 = Object.freeze({ h: ['x.x', 'xxx', '.x.'], s: ['.x.', 'xxx', 'x.x'], c: ['xxx', 'xxx', '.x.'] });
  L.PIP_COL = Object.freeze({ h: R.red[3], s: R.dark[3], c: R.dark[3] });
  /** A small upright playing card at (x, y), w x h with its ink edge: white top-left rim, cream face, shaded
      right and bottom, an optional 3 x 3 pip in the middle. o: { face, hi, shade, pip, pipC, ink } */
  L.card = (f, x, y, w, h, o = {}) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;
      let c = o.face || C.cream;
      if (i === 0 || j === 0 || i === w - 1 || j === h - 1) c = o.ink || C.edge;
      else if (i === w - 2 || j === h - 2) c = o.shade || C.cream3;
      else if (i === 1 || j === 1) c = o.hi || C.white;
      f.set(x + i, y + j, c);
    }
    if (o.pip) f.draw(L.PIP3[o.pip], x + Math.floor((w - 3) / 2), y + Math.floor((h - 3) / 2), { x: o.pipC || L.PIP_COL[o.pip] });
    return f;
  };
  /** A card turned by ang radians round (cx, cy): pillow-shaded cream with its own ink, optional pip on top. */
  L.tiltCard = (f, cx, cy, hw, hh, ang, o = {}) => {
    const m = L.rotRect(f.w, f.h, cx, cy, hw, hh, ang);
    const p = emboss(m, o.ramp || R.cream, { cap: 1.2, base: 5, gain: 3 });
    p.outline(C.edge);
    f.blit(p, 0, 0);
    if (o.pip) f.draw(L.PIP3[o.pip], Math.round(cx - 1), Math.round(cy - 1), { x: o.pipC || L.PIP_COL[o.pip] });
    return f;
  };
  /** A Boss eye: 3 x 3 acid green with an ink pupil at (px, py); lid rows of ink from the top (a stern or sleepy look). */
  L.eye = (f, x, y, o = {}) => {
    f.rect(x, y, 3, 3, o.c || R.acid[4]);
    if (o.glint !== false) f.set(x, y, o.glintC || R.acid[6]);
    f.set(x + (o.px ?? 1), y + (o.py ?? 1), C.edge);
    if (o.lid) f.rect(x, y, 3, o.lid, o.lidC || C.edge);
    return f;
  };
  /** An angry brow over a 3-wide eye at (x, y): ink, its inner end low. inner: 'r' (right) or 'l'. */
  L.brow = (f, x, y, inner, c = C.edge) => {
    if (inner === 'r') f.set(x - 1, y - 2, c).set(x, y - 2, c).set(x + 1, y - 2, c).set(x + 2, y - 1, c).set(x + 3, y - 1, c);
    else f.set(x - 1, y - 1, c).set(x, y - 1, c).set(x + 1, y - 2, c).set(x + 2, y - 2, c).set(x + 3, y - 2, c);
    return f;
  };
  /** A spark: a plus with a bright centre (5 x 5 at (x, y)), or a small one (3 x 3) with small: true. */
  L.spark = (f, x, y, col, core = C.white, small = false) => (small ? f.draw(['.c.', 'cvc', '.c.'], x, y, { c: col, v: core }) : f.draw(['..c..', '..c..', 'ccvcc', '..c..', '..c..'], x, y, { c: col, v: core }));

  // ---- Small Blind: a short cream candle on a pink dish; Big Blind: a tall one (17 x 20 and 17 x 28)
  A.define('blind:small', { w: 17, h: 20, make: (k) => k.candleWax(false) });
  A.define('blind:big', { w: 17, h: 28, make: (k) => k.candleWax(true) });

  // ---- The Smudge (boss smudge): a violet smudge creature with acid-green eyes and a worried mouth, purple
  // finger smears trailing off to its right. 29 x 25 drawn; the core inks it to 31 x 27.
  A.boss('smudge', {
    w: 31, h: 27,
    draw(k) {
      const { Bmp, Mask, R, C, emboss } = k;
      const W = 29, Hh = 25, b = new Bmp(W, Hh);
      const blob = Mask.fn(W, Hh, (x, y) => {
        const dx = (x - 13) / 11.5, dy = (y - 10.5) / 9.5;
        const wob = Math.sin(x * 0.9) * 0.08;
        if (dx * dx + dy * dy <= 1 + wob) return true;
        return y >= 14 && y <= 21 && [5, 9, 14, 18, 21].some((c, i) => x === c || (x === c + 1 && y < 20 - i));
      });
      b.blit(emboss(blob, R.vio, { cap: 4, base: 4, gain: 4.2 }), 0, 0);
      // smears trailing off to the right
      [[23, 5, 4], [24, 8, 4], [24, 11, 3]].forEach(([x, y, n]) => { for (let i = 0; i < n; i++) b.set(x + i, y, i === n - 1 ? R.vio[2] : R.vio[3]); });
      // acid eyes and a worried mouth
      b.draw(['aaa', 'aKa', 'aaa'], 7, 7, { a: R.acid[4], K: C.edge });
      b.draw(['aaa', 'aKa', 'aaa'], 15, 7, { a: R.acid[4], K: C.edge });
      b.draw(['kkkkkkk', '.kIIIk.'], 9, 13, { k: C.edge, I: R.vio[2] });
      return b;
    },
  });

  // ================================================================== Boss Blinds
  // Each draw() returns (w - 2) x (h - 2); the core inks the whole emblem.

  // ---- The Heckler (heckler): a fan in a striped bobble cap bawling through a brass megaphone, acid-green boos
  // coming out of the bell and a rotten tomato flying overhead.
  A.boss('heckler', {
    w: 31, h: 29,
    draw(k) {
      const W = 29, H = 27, f = new Bmp(W, H), M = (fn) => Mask.fn(W, H, fn);
      // shoulders in a blue jersey, then the head
      L.layer(f, k.roundRect(W, H, 0, 22, 13, 30, 4), R.chips, { cap: 2, base: 4, gain: 3 });
      L.layer(f, k.ellipse(W, H, 6.5, 16, 6, 6.2), L.SKIN, { cap: 3, base: 4, gain: 3.6 });
      // the bobble cap, blue and cream stripes
      const cap = M((x, y) => y <= 11 && y >= 4 && ((x - 6.5) / 7) ** 2 + ((y - 11.5) / 7.2) ** 2 <= 1);
      const cb = L.bands(cap, [R.chips, R.cream], (x, y) => ((y >= 6 && y <= 7) || y >= 10 ? 1 : 0), { cap: 2, base: 5, gain: 3 });
      cb.outline(C.edge); f.blit(cb, 0, 0);
      L.layer(f, k.ellipse(W, H, 6, 2.5, 2.2, 2.2), R.cream, { cap: 1.5, base: 5, gain: 3 });
      // angry eyes on the megaphone, a red cheek
      L.eye(f, 3, 13, { px: 2 }); L.eye(f, 8, 13, { px: 2 });
      L.brow(f, 3, 13, 'r'); L.brow(f, 8, 13, 'l');
      f.rect(2, 18, 2, 1, R.pink[6]);
      // the megaphone: a brass cone from his mouth to a lit bell, a dark ring at the mouthpiece
      const cone = M((x, y) => x >= 11 && x <= 23 && Math.abs(y - 17) <= 1.6 + (x - 11) * 0.5);
      L.layer(f, cone, R.brass, { cap: 2, base: 4, gain: 3.4 });
      for (let y = 0; y < H; y++) { if (cone.get(13, y)) f.set(13, y, R.brass[2]); if (cone.get(23, y)) f.set(23, y, R.brass[6]); if (cone.get(22, y)) f.set(22, y, R.brass[5]); }
      // his fist round the handle
      L.layer(f, k.ellipse(W, H, 15, 22, 2.2, 1.8), L.SKIN, { cap: 1.5, base: 4, gain: 3 });
      // the boos: acid arcs out of the bell
      [[25, 13, 21], [27, 10, 24]].forEach(([x, y0, y1]) => { for (let y = y0 + 1; y < y1; y++) f.set(x, y, R.acid[4]); f.set(x - 1, y0, R.acid[4]); f.set(x - 1, y1, R.acid[4]); });
      // the rotten tomato, its leaf and a brown spot, flying with two streaks behind it
      f.blit(L.inkedCopy(k.sphere(3.2, R.mult, { lo: 1, k: 1.05 })), 18, 0);
      f.rect(19, 1, 2, 1, R.lime[4]); f.set(20, 2, R.lime[3]);
      f.set(23, 5, R.lime[1]); f.set(22, 5, R.wood[2]);
      for (let x = 12; x <= 16; x++) { f.set(x, 2, R.cream[4]); if (x > 13) f.set(x, 5, R.cream[4]); }
      return f;
    },
  });

  // ---- The Lid (lid): a heavy brass lid with a stern face, wire-clamped down on a glass jar that holds a
  // mult-red flame pressed flat against it; a thin curl of smoke escapes from under the rim.
  A.boss('lid', {
    w: 31, h: 31,
    draw(k) {
      const W = 29, H = 29, f = new Bmp(W, H), M = (fn) => Mask.fn(W, H, fn);
      // the jar: dark inside, its glass lit down the left and along the shoulder
      const jar = k.roundRect(W, H, 4, 10, 24, 28, 4);
      const jb = new Bmp(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!jar.get(x, y)) continue;
        const edgeL = !jar.get(x - 1, y) || !jar.get(x - 2, y), edgeR = !jar.get(x + 1, y), edgeB = !jar.get(x, y + 1), top = !jar.get(x, y - 2);
        jb.set(x, y, edgeL ? (jar.get(x - 1, y) ? R.ghost[3] : R.ghost[4]) : edgeR || edgeB ? R.ghost[2] : top ? R.ghost[3] : C.ink2);
      }
      jb.outline(C.edge); f.blit(jb, 0, 0);
      // a candle stub on the bottom and its flame, spread flat under the lid
      f.rect(12, 24, 5, 3, C.cream1); f.rect(12, 24, 1, 3, C.white); f.rect(16, 24, 1, 3, C.cream3);
      for (let y = 12; y <= 23; y++) for (let x = 6; x <= 22; x++) {
        const t = (23 - y) / 11, half = 1.2 + 7 * Math.pow(t, 0.6) + Math.sin(y * 1.9) * 0.9 * t, d = Math.abs(x - 14) / half;
        if (d > 1 || (y === 12 && Math.abs(x - 14) > 2 && (x + 1) % 3 === 0)) continue;
        const heat = (1 - d) * 0.9 + (1 - t) * 0.4;
        f.set(x, y, heat > 0.98 ? R.money[8] : heat > 0.74 ? R.money[6] : heat > 0.5 ? R.ember[5] : heat > 0.26 ? R.mult[5] : R.mult[3]);
      }
      // the lid: a thick brass cap, milled round its lower edge, with a heavy-lidded glare
      const cap = k.roundRect(W, H, 2, 2, 26, 9, 2);
      const cb = emboss(cap, R.brass, { cap: 2, base: 4, gain: 3.4 });
      for (let x = 3; x <= 25; x++) if (x % 2 === 0) { if (cb.get(x, 8)) cb.set(x, 8, R.brass[2]); if (cb.get(x, 7)) cb.set(x, 7, R.brass[3]); }
      cb.outline(C.edge); f.blit(cb, 0, 0);
      L.eye(f, 8, 4, { lid: 1 }); L.eye(f, 18, 4, { lid: 1 });
      f.rect(7, 3, 5, 1, R.brass[1]); f.rect(17, 3, 5, 1, R.brass[1]);
      // the wire clamp: a bail over the lid, down to the jar's neck on both sides
      for (let x = 5; x <= 23; x++) f.set(x, 1, R.steel[3]);
      for (let y = 1; y <= 12; y++) { f.set(4, y, y < 10 ? R.steel[3] : R.steel[2]); f.set(24, y, y < 10 ? R.steel[2] : R.steel[1]); }
      f.set(4, 1, C.edge); f.set(24, 1, C.edge);
      // smoke curling up from under the rim
      [[26, 9], [27, 8], [27, 7], [26, 6], [26, 5], [27, 4], [28, 3], [28, 2], [27, 1], [27, 0]].forEach(([x, y]) => f.set(x, y, R.steel[3]));
      return f;
    },
  });

  // ---- The Shuffler (shuffler): a grinning cardsharp in an acid-green eyeshade and a striped maroon waistcoat,
  // riffling a deck from hand to hand in an arch of cream card edges.
  A.boss('shuffler', {
    w: 31, h: 31,
    draw(k) {
      const W = 29, H = 29, f = new Bmp(W, H), M = (fn) => Mask.fn(W, H, fn);
      // the waistcoat over a cream shirt, pinstriped
      const vest = k.roundRect(W, H, 3, 15, 25, 32, 5);
      const vb = emboss(vest, R.maroon, { cap: 3, base: 4, gain: 3.5 });
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (vb.get(x, y) && x % 3 === 1) vb.set(x, y, R.maroon[2]);
      vb.outline(C.edge); f.blit(vb, 0, 0);
      L.layer(f, M((x, y) => y >= 15 && Math.abs(x - 14) <= Math.max(0, (22 - y) / 2.2)), R.cream, { cap: 1, base: 5, gain: 2 });
      // the head: slick dark hair, the eyeshade's brim, sly half-shut eyes, a thin moustache and a grin
      L.layer(f, k.ellipse(W, H, 14, 9, 5.4, 6), L.SKIN, { cap: 3, base: 4, gain: 3.6 });
      L.layer(f, M((x, y) => y <= 4 && ((x - 14) / 5.6) ** 2 + ((y - 5.5) / 5.4) ** 2 <= 1), R.plum.slice(2), { cap: 2, base: 3, gain: 3 });
      L.layer(f, M((x, y) => y >= 4 && y <= 6 && Math.abs(x - 14) <= 8.5 - (y === 4 ? 2 : 0)), R.acid, { cap: 1, base: 3, gain: 3 });
      f.draw(['KKK', 'aKa'], 10, 8, { K: C.edge, a: R.acid[4] }); f.draw(['KKK', 'aKa'], 16, 8, { K: C.edge, a: R.acid[4] });
      f.draw(['K.......K', '.KKK.KKK.'], 10, 11, { K: C.edge });
      f.draw(['KKKKK', 'vvgvv', '.KKK.'], 12, 12, { K: C.edge, v: C.white, g: R.gold[4] });
      // the bridge: an arch of card edges flying from one half of the deck to the other, low between his hands
      // (at collar height it read as a white yoke), every other card's edge a shade darker so the seams show
      const arch = M((x, y) => { const d = Math.hypot(x - 14, (y - 31) * 1.05); return y <= 26 && d >= 9.4 && d <= 12.4; });
      const ab = emboss(arch, R.cream, { cap: 1.2, base: 5, gain: 2.5 });
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ab.get(x, y) && Math.round(Math.atan2(31 - y, x - 14) * 9) % 2 === 0) ab.set(x, y, R.cream[2]);
      ab.outline(C.edge); f.blit(ab, 0, 0);
      // the two halves of the deck in his hands
      [[0, 20], [22, 20]].forEach(([x, y]) => { L.card(f, x, y, 7, 7, { face: C.cream }); f.rect(x + 1, y + 3, 5, 1, C.cream3); });
      L.layer(f, k.ellipse(W, H, 3, 26.5, 3, 2), L.SKIN, { cap: 1.5, base: 4, gain: 3 });
      L.layer(f, k.ellipse(W, H, 25, 26.5, 3, 2), L.SKIN, { cap: 1.5, base: 4, gain: 3 });
      return f;
    },
  });

  // ---- The Fade (fade): a block score number dissolving from right to left into the dark, its last digit only a
  // few loose flakes drifting up and away. It dissolves in 2 x 2 blocks and only what is left of the number is
  // inked (outline: false), so the fading half never breaks into a field of lone inked pixels.
  A.boss('fade', {
    w: 31, h: 25, outline: false,
    draw(k) {
      const W = 31, H = 25, f = new Bmp(W, H), ox = 1, oy = 8;
      const n = k.textBmp('300', 'L', 'score'); // 25 x 13 with its rim
      const solid = new Bmp(W, H);
      for (let y = 0; y < n.h; y++) for (let x = 0; x < n.w; x++) if (n.get(x, y)) { solid.set(x + ox + 2, y + oy + 2, R.maroon[2]); solid.set(x + ox + 1, y + oy + 1, R.maroon[4]); }
      solid.blit(n, ox, oy);
      // an ordered dither eats the number from the right, a 2 x 2 block at a time
      const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
      const keep = new Bmp(W, H), rnd = k.rng('boss:fade'), lost = [];
      for (let by = 0; by < H; by += 2) for (let bx = 0; bx < W; bx += 2) {
        const t = Math.max(0, Math.min(1, (bx - 10) / 14));
        const on = (BAYER[(by >> 1) % 4][(bx >> 1) % 4] + 0.5) / 16 >= t * 1.12;
        let any = false;
        for (let y = by; y < by + 2; y++) for (let x = bx; x < bx + 2; x++) { const c = solid.get(x, y); if (!c) continue; any = true; if (on) keep.set(x, y, c); }
        if (!on && any) lost.push([bx, by, t]);
      }
      f.blit(keep.clone().outline(C.edge), 0, 0);
      // what fades drifts up and away as loose 2 x 2 flakes, cooling from ember through pink to plum
      lost.forEach(([x, y, t]) => {
        if (rnd() > 0.34) return;
        const up = 3 + Math.floor(rnd() * (2 + 6 * t)), xx = Math.min(W - 2, x + 2 + Math.floor(rnd() * 3)), yy = Math.max(0, y - up);
        if (f.get(xx, yy) || f.get(xx + 1, yy + 1)) return;
        f.rect(xx, yy, 2, 2, yy < 4 ? R.plum[7] : yy < 8 ? R.pink[6] : R.ember[6]);
      });
      // the Boss's acid glints caught in the drift
      L.spark(f, 24, 0, R.acid[4], R.acid[6], true); L.spark(f, 27, 5, R.acid[4], R.acid[6], true);
      return f;
    },
  });

  // ---- The Tollbooth (tollbooth): a cream booth with a red roof and a $2 sign, a keeper's acid eyes in its dark
  // window over a brass coin slot, and a striped red-and-cream arm down across a pile of discarded cards.
  A.boss('tollbooth', {
    w: 31, h: 29,
    draw(k) {
      const W = 29, H = 27, f = new Bmp(W, H);
      // the discarded cards behind the arm
      L.card(f, 14, 18, 7, 9, { pip: 'h' }); L.card(f, 18, 17, 7, 9, { pip: 's' }); L.card(f, 22, 19, 7, 8, { pip: 'h' });
      // the booth
      L.layer(f, k.roundRect(W, H, 1, 11, 11, 26, 0), R.cream, { cap: 2, base: 5, gain: 3 });
      L.layer(f, k.roundRect(W, H, 0, 9, 12, 11, 1), R.mult, { cap: 1, base: 5, gain: 3 });
      f.rect(3, 13, 7, 5, C.ink); f.rect(3, 13, 7, 1, C.edge);
      f.rect(4, 15, 2, 2, R.acid[4]); f.rect(7, 15, 2, 2, R.acid[4]); f.set(5, 16, C.edge); f.set(8, 16, C.edge);
      L.layer(f, k.roundRect(W, H, 3, 20, 9, 23, 1), R.brass, { cap: 1, base: 4, gain: 3 });
      f.rect(5, 21, 3, 1, C.edge);
      // the arm, striped, on a brass hub
      const arm = k.roundRect(W, H, 11, 12, 28, 14, 1);
      const ab = L.bands(arm, [R.mult, R.cream], (x) => (Math.floor((x - 11) / 3) % 2 ? 1 : 0), { cap: 1, base: 5, gain: 2.5 });
      ab.outline(C.edge); f.blit(ab, 0, 0);
      f.blit(L.inkedCopy(k.sphere(2, R.brass, { lo: 1 })), 9, 10);
      // the $2 sign on the roof
      f.blit(k.textBmp('$2', 'S', 'money'), 0, 0);
      return f;
    },
  });

  // ---- The Squeeze (squeeze): two maroon brick walls with glaring acid eyes pressing in from both sides, three
  // cream cards squashed upright between them, the middle one popping up.
  A.boss('squeeze', {
    w: 31, h: 25,
    draw(k) {
      const W = 29, H = 23, f = new Bmp(W, H);
      // the cards, the outer two bowed by the squeeze
      const bowCard = (x0, top, bow, pip) => {
        const m = Mask.fn(W, H, (x, y) => { if (y < top || y > 21) return false; const t = (y - top) / (21 - top); const off = Math.round(Math.sin(t * Math.PI) * bow); return x >= x0 + off && x <= x0 + 4 + off; });
        const p = emboss(m, R.cream, { cap: 1, base: 5, gain: 2.5 }); p.outline(C.edge); f.blit(p, 0, 0);
        f.draw(L.PIP3[pip], x0 + 1 + bow, Math.round((top + 21) / 2) - 1, { x: L.PIP_COL[pip] });
      };
      // all three in full between the walls (the middle one last, popping up), every pip a heart: a 3 x 3 diamond
      // is a plus and reads as a first-aid cross
      bowCard(7, 5, -1, 'h'); bowCard(17, 5, 1, 'h'); bowCard(12, 1, 0, 'h');
      // the walls, narrow enough to leave the cards room
      [[0, 5, 'r'], [23, 28, 'l']].forEach(([x0, x1, side]) => {
        const wall = k.roundRect(W, H, x0, 0, x1, 22, 1);
        const wb = emboss(wall, R.maroon, { cap: 2, base: 4, gain: 3 });
        for (let y = 0; y < H; y++) for (let x = x0; x <= x1; x++) {
          if (!wb.get(x, y)) continue;
          const row = Math.floor(y / 4), brick = (x - x0 + (row % 2) * 2) % 5;
          if (y % 4 === 3 || brick === 0) wb.set(x, y, R.maroon[2]);
        }
        wb.outline(C.edge); f.blit(wb, 0, 0);
        const ex = side === 'r' ? x0 + 2 : x0 + 1;
        f.rect(ex - 1, 6, 5, 5, R.maroon[3]);
        L.eye(f, ex, 7, { px: side === 'r' ? 2 : 0 });
        L.brow(f, ex, 7, side);
      });
      return f;
    },
  });

  // ---- The Wash-Out (washout): a grinning tin pail tipping water over a card, the card's colours running off it
  // in pink and gold drips.
  A.boss('washout', {
    w: 31, h: 31,
    draw(k) {
      const W = 29, H = 29, f = new Bmp(W, H), M = (fn) => Mask.fn(W, H, fn);
      // the card being washed: pale, its heart running down in pink and gold drips that fall (a column, a gap and a
      // drop) rather than standing on the card like little feet
      L.card(f, 16, 13, 12, 12, { face: C.cream1 });
      f.draw(['x.x', 'xxx', '.x.'], 20, 16, { x: R.pink[6] });
      f.set(21, 19, R.pink[6]); f.set(21, 20, R.pink[7]); f.set(21, 22, R.pink[7]);
      [[18, 26, R.pink[5]], [21, 27, R.gold[4]], [24, 25, R.pink[5]], [26, 26, R.gold[4]]].forEach(([x, y1, c]) => { for (let y = 24; y <= y1; y++) f.set(x, y, c); if (y1 + 2 < H) f.set(x, y1 + 2, c); });
      // the water pouring out, a stream that thins as it falls, and its spray
      L.layer(f, k.strokeQuad(W, H, [14, 11], [20, 9], [22, 13], (t) => 4 - t * 1.8), R.ghost.slice(2), { cap: 1.5, base: 3, gain: 3 });
      [[25, 12], [24, 15], [27, 10]].forEach(([x, y]) => f.set(x, y, R.ghost[5]));
      // the pail, tipped toward the card: a dark open mouth inside a rolled rim, two hoops and a wire handle
      const th = 0.62, dx = Math.cos(th), dy = Math.sin(th), U = (x, y) => (x - 1) * dx + (y - 2) * dy, V = (x, y) => -(x - 1) * dy + (y - 2) * dx;
      const pail = M((x, y) => { const u = U(x, y), v = V(x, y); return u >= 0 && u <= 14 && Math.abs(v) <= 3.4 + u * 0.3; });
      const pb = emboss(pail, R.steel, { cap: 2, base: 3, gain: 3 });
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!pb.get(x, y)) continue;
        const u = U(x, y), v = V(x, y);
        if (u > 12) pb.set(x, y, Math.abs(v) > 3.4 + u * 0.3 - 1.2 ? R.steel[5] : C.ink2);
        else if (u > 11) pb.set(x, y, R.steel[5]);
        else if (Math.abs(u - 3) < 0.6 || Math.abs(u - 8.5) < 0.6) pb.set(x, y, R.steel[1]);
      }
      pb.outline(C.edge); f.blit(pb, 0, 0);
      [[10, 0], [11, 0], [12, 1], [13, 2], [14, 3]].forEach(([x, y]) => f.set(x, y, R.steel[2]));
      // its face, grinning at what it did
      L.eye(f, 3, 8, { px: 2, py: 2 }); L.eye(f, 8, 4, { px: 2, py: 2 });
      f.draw(['K....', 'KK...', '.KKKK'], 7, 11, { K: C.edge });
      return f;
    },
  });

  // ---- The Wet Blanket (wetblanket): a soggy grey plaid blanket with mopey eyes, draped over a Joker card whose
  // peach frame shows under the hem, a little rain cloud above it and one blue drip falling.
  A.boss('wetblanket', {
    w: 31, h: 31,
    draw(k) {
      const W = 29, H = 29, f = new Bmp(W, H), M = (fn) => Mask.fn(W, H, fn);
      // the Joker card under it: peach frame, dark window with the jester's ruff at its foot, dark name plate
      const cx0 = 9, cy0 = 10, cw = 16, ch = 19;
      L.card(f, cx0, cy0, cw, ch, { face: R.peach[4], hi: R.peach[6], shade: R.peach[2] });
      f.rect(cx0 + 2, cy0 + 2, cw - 4, 10, C.plum); f.rect(cx0 + 2, cy0 + 12, cw - 4, 1, R.peach[6]);
      f.draw(['.cc.cc.cc.', 'cccccccccc'], cx0 + 3, cy0 + 10, { c: C.cream2 });
      f.rect(cx0 + 2, cy0 + 14, cw - 4, 3, C.plum2); f.rect(cx0 + 2, cy0 + 14, cw - 4, 1, C.plum4);
      // the blanket: a grey plaid (so it never reads as a sheet ghost), slumped low over the card's top, hanging
      // long down its left side and short on its right, a pink stripe along the sodden hem and a fringe of tassels
      const hem = (x) => Math.round(26 - (x - 3) * 0.45 + Math.sin(x * 1.3) * 0.6);
      const blanket = M((x, y) => x >= 3 && x <= 26 && y >= 9 + (x < 6 ? 6 - x : 0) + (x > 24 ? x - 24 : 0) && y <= hem(x));
      const bl = emboss(blanket, R.steel, { cap: 3, base: 2, gain: 3.4 });
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!bl.get(x, y)) continue;
        if (y === hem(x) - 2) bl.set(x, y, R.pink[4]); else if (y === hem(x) - 1) bl.set(x, y, R.pink[2]);
        else if (x % 6 === 2 || y % 6 === 2) bl.set(x, y, R.steel[1]);
        else if (x % 6 === 4) bl.set(x, y, R.pink[3]);
      }
      bl.outline(C.edge); f.blit(bl, 0, 0);
      for (let x = 4; x <= 26; x += 2) { const y = hem(x) + 1; f.set(x, y, R.steel[2]); f.set(x, y + 1, R.steel[2]); }
      // the mopey face
      L.eye(f, 11, 12, { lid: 1, lidC: R.steel[0], py: 2 }); L.eye(f, 17, 12, { lid: 1, lidC: R.steel[0], py: 2 });
      f.draw(['.KKK.', 'K...K'], 13, 16, { K: C.edge });
      // the rain cloud and its one drip
      const cloud = M((x, y) => (x - 12) ** 2 + (y - 3) ** 2 <= 7 || (x - 16.5) ** 2 + (y - 2) ** 2 <= 8 || (x - 21) ** 2 + (y - 3) ** 2 <= 7 || (y >= 3 && y <= 5 && x >= 11 && x <= 22));
      L.layer(f, cloud, R.ghost, { cap: 2, base: 3, gain: 3 });
      f.draw(['.b.', 'bbb', 'bBb'], 16, 6, { b: R.chips[6], B: R.chips[4] });
      return f;
    },
  });

  // ---- The Spoilsport (grudge): a sulking deep-plum storm cloud with glaring acid eyes and a deep frown, looking
  // down at one poker hand and spoiling it with an acid bolt. (Crossed arms under the face read as a grin and a
  // moustache at 2 px, so the sulk is all in the brows and the frown.)
  A.boss('grudge', {
    w: 31, h: 29,
    draw(k) {
      const W = 29, H = 27, f = new Bmp(W, H), M = (fn) => Mask.fn(W, H, fn);
      // the poker hand below, fanned
      [-0.62, -0.31, 0, 0.31, 0.62].forEach((a, i) => L.tiltCard(f, 14 + Math.sin(a) * 9, 30 - Math.cos(a) * 8.6, 2.6, 3.6, a, { pip: ['h', 's', 'h', 'c', 'h'][i] }));
      // the cloud: four puffs over a flat underside
      const cloud = M((x, y) => (x - 6) ** 2 + (y - 9) ** 2 <= 20 || (x - 11.5) ** 2 + (y - 6) ** 2 <= 30 || (x - 18) ** 2 + (y - 5.5) ** 2 <= 30 || (x - 23) ** 2 + (y - 9) ** 2 <= 20 || (y >= 8 && y <= 14 && x >= 2 && x <= 27 && !((x === 2 || x === 27) && y === 14)));
      L.layer(f, cloud, R.plum, { cap: 3.5, base: 6, gain: 3.5 });
      // glaring down: heavy brows, pupils low, a deep frown
      L.eye(f, 9, 7, { px: 1, py: 2 }); L.eye(f, 17, 7, { px: 1, py: 2 });
      L.brow(f, 9, 7, 'r'); L.brow(f, 17, 7, 'l');
      f.draw(['..KKK..', '.K...K.', 'K.....K'], 11, 11, { K: C.edge });
      // the acid bolt it throws at the hand
      const bolt = new Bmp(5, 7).draw(['..aaa', '.aaa.', 'aaaa.', '..aa.', '.aa..', '.a...', 'a....'], 0, 0, { a: R.acid[4] });
      bolt.set(2, 0, R.acid[6]).set(1, 1, R.acid[6]);
      f.blit(L.inkedCopy(bolt), 3, 13);
      return f;
    },
  });

  // ---- The Blackout (censor): a pull-cord light bulb gone dark, asleep over a black card; the only glow is a tiny
  // acid-green spark left in its filament.
  A.boss('censor', {
    w: 31, h: 31,
    draw(k) {
      const W = 29, H = 29, f = new Bmp(W, H), M = (fn) => Mask.fn(W, H, fn);
      // the black card below, lit enough to read on the violet boss panel
      L.card(f, 0, 16, 11, 13, { face: R.dark[3], hi: R.dark[4], shade: R.dark[2] });
      f.draw(['..x..', '.xxx.', 'xxxxx', 'x.x.x', '..x..'], 3, 20, { x: R.dark[5] });
      // the flex from the top edge and the brass screw cap, threaded
      f.rect(15, 0, 1, 3, R.plum[6]);
      const cap = k.roundRect(W, H, 12, 3, 18, 8, 1);
      const cb = emboss(cap, R.brass, { cap: 1.5, base: 4, gain: 3 });
      for (const y of [5, 7]) for (let x = 12; x <= 18; x++) if (cb.get(x, y)) cb.set(x, y, R.brass[2]);
      cb.outline(C.edge); f.blit(cb, 0, 0);
      // the dead glass: a pear-shaped bulb, its neck tapering up into the cap (a round globe on a short collar
      // read as a bomb), a white glint on its upper left
      const glass = M((x, y) => (x - 15) ** 2 + (y - 19) ** 2 <= 7.2 * 7.2 || (y >= 9 && y <= 14 && Math.abs(x - 15) <= 2.6 + Math.pow((y - 9) / 5, 1.6) * 4.2));
      const gb = emboss(glass, R.steel, { cap: 4, base: 3, gain: 3 });
      gb.outline(C.edge); f.blit(gb, 0, 0);
      f.draw(['..hh', '.h..', 'h...', 'h...'], 9, 13, { h: C.white });
      // the dead filament: two posts down from the neck and a coil, its last acid spark in the middle
      for (let y = 11; y <= 16; y++) { f.set(13, y, R.plum[5]); f.set(17, y, R.plum[5]); }
      f.draw(['k.k.k.k.k', '.k.k.k.k.'], 11, 16, { k: R.plum[5] });
      f.rect(14, 16, 3, 2, R.acid[4]); f.set(15, 16, R.acid[6]);
      // asleep, low on the globe
      f.draw(['K...K', '.KKK.'], 9, 20, { K: C.edge }); f.draw(['K...K', '.KKK.'], 17, 20, { K: C.edge });
      // the pull cord from the cap, a brass bead at its end
      for (let y = 7; y <= 23; y++) f.set(23, y, R.steel[4]);
      [[19, 6], [20, 6], [21, 6], [22, 7]].forEach(([x, y]) => f.set(x, y, R.steel[4]));
      f.blit(L.inkedCopy(k.sphere(1.2, R.brass, { lo: 1 })), 21, 23);
      return f;
    },
  });

  // ---- The Warm-Up (warmup): a little cream candle in a pink sweatband stretching both arms up, its ember flame
  // only half lit.
  A.boss('warmup', {
    w: 31, h: 31,
    draw(k) {
      const W = 29, H = 29, f = new Bmp(W, H), M = (fn) => Mask.fn(W, H, fn);
      // arms raised in a V, pink wristbands and cream fists
      const arm = (p0, p1, p2) => L.layer(f, k.strokeQuad(W, H, p0, p1, p2, 2.4), R.cream, { cap: 1.2, base: 5, gain: 3 });
      arm([11, 19], [6, 16], [5, 9]); arm([18, 19], [23, 16], [24, 9]);
      L.layer(f, k.roundRect(W, H, 3, 8, 7, 9, 0), R.pink, { cap: 1, base: 5, gain: 3 });
      L.layer(f, k.roundRect(W, H, 22, 8, 26, 9, 0), R.pink, { cap: 1, base: 5, gain: 3 });
      L.layer(f, k.ellipse(W, H, 5, 5.5, 2.2, 2.2), R.cream, { cap: 1.5, base: 5, gain: 3 });
      L.layer(f, k.ellipse(W, H, 24, 5.5, 2.2, 2.2), R.cream, { cap: 1.5, base: 5, gain: 3 });
      // the dish and the wax, lit from the left like the Blind candles
      const dish = M((x, y) => (y === 25 && x >= 8 && x <= 20) || ((y === 26 || y === 27) && x >= 7 && x <= 21) || (y === 28 && x >= 9 && x <= 19));
      L.layer(f, dish, R.pink, { cap: 1.3, base: 5, gain: 3.6 });
      const col = [C.white, C.cream, C.cream, C.cream1, C.cream1, C.cream2, C.cream2, C.cream3, C.cream3];
      const wax = new Bmp(W, H);
      for (let y = 11; y <= 24; y++) for (let i = 0; i < 9; i++) wax.set(10 + i, y, col[i]);
      wax.outline(C.edge); f.blit(wax, 0, 0);
      // the sweatband with its tails, the face
      L.layer(f, k.roundRect(W, H, 9, 12, 19, 14, 1), R.pink, { cap: 1, base: 5, gain: 3 });
      f.rect(10, 13, 9, 1, R.pink[7]);
      f.draw(['pp.', 'ppp', '.pp'], 20, 13, { p: R.pink[5] });
      L.eye(f, 11, 16, { lid: 1 }); L.eye(f, 15, 16, { lid: 1 });
      f.draw(['K...K', '.KKK.'], 12, 20, { K: C.edge });
      // the wick and its half-lit flame: the left half burning, the right half not yet caught
      f.rect(14, 9, 1, 2, C.edge);
      f.draw(['..o..', '.ooo.', '.oyd.', 'oyudd', 'oyudd', '.oud.', '..d..'], 12, 2, { o: R.ember[5], y: R.money[6], u: R.money[8], d: R.plum[6] });
      return f;
    },
  });

  // ---- The Fumble (fumble): two jester-gloved hands, one with a pink cuff and one with a lime cuff, fumbling a
  // pair of cards; one tumbles away end over end with a pink trail.
  A.boss('fumble', {
    w: 31, h: 29,
    draw(k) {
      const W = 29, H = 27, f = new Bmp(W, H);
      // the card tumbling away and its trail
      for (let i = 0; i < 7; i++) { const t = i / 6, x = Math.round(12 + t * 9), y = Math.round(15 - t * 8 - Math.sin(t * Math.PI) * 3); f.set(x, y, i % 2 ? R.pink[6] : R.pink[4]); f.set(x, y + 1, R.pink[3]); }
      L.tiltCard(f, 22.5, 5, 3.2, 4.4, 0.75, { pip: 'h' });
      // the card slipping between the hands
      L.tiltCard(f, 14, 17, 3, 4.2, -0.4, { pip: 's' });
      // the gloves: palm, three splayed fingers and a thumb, frilled cuff
      const glove = (cx, flip, cuff) => {
        const g = new Bmp(W, H);
        const m = Mask.fn(W, H, (x, y) => {
          const u = flip ? 2 * cx - x : x;
          if (((u - cx) / 4.6) ** 2 + ((y - 20.5) / 3.6) ** 2 <= 1) return true;
          if ((u === cx - 4 || u === cx - 3) && y >= 14 && y <= 19) return true;
          if ((u === cx - 1 || u === cx) && y >= 12 && y <= 18) return true;
          if ((u === cx + 2 || u === cx + 3) && y >= 13 && y <= 18) return true;
          return (u === cx + 5 || u === cx + 4) && y >= 17 && y <= 20;
        });
        g.blit(emboss(m, R.cream, { cap: 1.6, base: 5, gain: 3 }), 0, 0);
        g.outline(C.edge);
        f.blit(g, 0, 0);
        const cm = Mask.fn(W, H, (x, y) => Math.abs(x - cx) <= 4 && y >= 23 && y <= 26 - ((x + (flip ? 1 : 0)) % 2));
        L.layer(f, cm, cuff, { cap: 1, base: 5, gain: 3 });
      };
      glove(6, false, R.pink); glove(23, true, R.acid);
      return f;
    },
  });

  // ---- The Short Fuse (shortfuse): a fat red firework with an angry face and gold bands, its very short fuse
  // already lit and spitting gold and ember sparks.
  A.boss('shortfuse', {
    w: 31, h: 31,
    draw(k) {
      const W = 29, H = 29, f = new Bmp(W, H);
      // the drum
      const drum = k.roundRect(W, H, 5, 11, 23, 28, 2);
      const db = emboss(drum, R.mult, { cap: 3, base: 5, gain: 3.5 });
      for (let x = 5; x <= 23; x++) for (const y of [14, 15, 25, 26]) if (db.get(x, y)) db.set(x, y, y === 14 || y === 25 ? R.gold[5] : R.gold[3]);
      // the drum's last px each side of the paper top, in the shadow red, so no lit sliver pokes out there
      db.set(5, 13, R.mult[4]); db.set(23, 13, R.mult[4]);
      db.outline(C.edge); f.blit(db, 0, 0);
      L.layer(f, k.ellipse(W, H, 14, 11, 9.4, 2.4), R.cream, { cap: 1, base: 4, gain: 2.5 });
      // the angry face: acid eyes under hard brows, clenched teeth
      L.eye(f, 9, 17, { px: 1, py: 1 }); L.eye(f, 17, 17, { px: 1, py: 1 });
      L.brow(f, 9, 17, 'r'); L.brow(f, 17, 17, 'l');
      f.draw(['KKKKKKK', 'KvKvKvK', 'KKKKKKK'], 11, 21, { K: C.edge, v: C.cream });
      // the stub of fuse and its sparks
      f.rect(14, 7, 2, 3, R.wood[2]);
      L.spark(f, 12, 1, R.gold[5], C.white);
      [[8, 3, R.ember[5]], [19, 2, R.gold[4]], [17, 6, R.ember[6]], [9, 7, R.gold[5]]].forEach(([x, y, c]) => L.spark(f, x, y, c, R.money[8], true));
      return f;
    },
  });

  // ---- The Big Finish (bigfinish): the grand finale. Theatre-red curtains swagged back under a gold-fringed
  // valance (maroon sank into the violet boss panel), a pool of ember light on the boards, the Boss's acid eyes
  // glaring out of the dark stage, and a burst of ember, pink and gold fireworks over it.
  A.boss('bigfinish', {
    w: 31, h: 31,
    draw(k) {
      const W = 29, H = 29, f = new Bmp(W, H), M = (fn) => Mask.fn(W, H, fn);
      // the stage: dark back wall, plank floor
      f.rect(2, 3, 25, 23, C.ink2);
      for (let x = 2; x <= 26; x++) { f.set(x, 25, R.wood[4]); f.set(x, 26, R.wood[3]); f.set(x, 27, R.wood[2]); if (x % 6 === 0) { f.set(x, 26, R.wood[1]); f.set(x, 27, R.wood[1]); } }
      // a pool of light on the boards, the rest of the stage left dark for the Boss
      for (let x = 6; x <= 22; x++) { const d = Math.abs(x - 14); f.set(x, 25, d < 4 ? R.ember[7] : d < 7 ? R.ember[6] : R.ember[5]); if (d < 5) f.set(x, 26, R.ember[5]); }
      // the Boss in the dark: acid eyes under hard brows
      L.eye(f, 9, 17); L.eye(f, 17, 17);
      L.brow(f, 9, 17, 'r'); L.brow(f, 17, 17, 'l');
      // the firework burst
      const cx = 14, cy = 9;
      const rays = [[0, -1, R.gold], [1, -1, R.pink], [1, 0, R.ember], [1, 1, R.gold], [0, 1, R.pink], [-1, 1, R.ember], [-1, 0, R.gold], [-1, -1, R.pink]];
      rays.forEach(([dx, dy, r]) => { for (let i = 2; i <= 5; i++) f.set(cx + dx * i, cy + dy * i, i < 4 ? r[6] : r[5]); });
      f.rect(cx - 1, cy - 1, 3, 3, R.money[7]); f.set(cx, cy, C.white);
      [[6, 6, R.pink], [22, 6, R.acid], [21, 13, R.ember]].forEach(([x, y, r]) => L.spark(f, x - 1, y - 1, r[4], C.white, true));
      // the curtains, swagged back at a gold tie
      [[0, 1], [28, -1]].forEach(([x0, d]) => {
        const m = M((x, y) => { const u = (x - x0) * d; const wide = y < 16 ? 7 - (y / 16) * 3.5 : 3.5 + ((y - 16) / 12) * 3; return u >= 0 && u <= wide; });
        const cb = emboss(m, R.mult, { cap: 2, base: 4, gain: 3 });
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cb.get(x, y) && ((x - x0) * d) % 3 === 2) cb.set(x, y, R.mult[2]);
        cb.outline(C.edge); f.blit(cb, 0, 0);
        f.rect(x0 + (d > 0 ? 0 : -4), 16, 5, 2, R.gold[4]);
      });
      // the valance, scalloped, with a gold fringe
      const val = M((x, y) => y <= 2 || (y <= 4 && (x % 6 >= 1 && x % 6 <= 4)));
      const vb = emboss(val, R.mult, { cap: 1.5, base: 4, gain: 3 });
      vb.outline(C.edge); f.blit(vb, 0, 0);
      for (let x = 0; x < W; x++) if (f.get(x, 5) === C.edge) f.set(x, 5, x % 2 ? R.gold[5] : R.gold[3]);
      return f;
    },
  });

  // ================================================================== Vouchers
  // The core draws the cream ticket stub, the window's ground, glow and specks, and inks each picture.
  /** A 5 x 7 Ember digit (or $, +, -) in one colour at (x, y). */
  L.glyph = (f, ch, x, y, col) => { K.parseGlyph(K.GLYPH_S[ch]).forEach((row, j) => row.forEach((on, i) => { if (on) f.set(x + i, y + j, col); })); return f; };
  /** A disc mask of radius r round (cx, cy) in a w x h frame. */
  L.round = (w, h, cx, cy, r) => Mask.fn(w, h, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3);
  const NIGHT = ['#141844', '#1B2058', '#232A6B', '#2E3780'];
  const VIOLET = ['#1E0B42', '#2E1160', '#3E1880', '#5320A0'];
  const NAVY = ['#0C0F2A', '#141A44', '#1E2658', '#283270'];
  const ROSE = ['#3E0824', '#5E0F38', '#87154C', '#9C1A5A'];
  const MOSS = ['#1C3A0A', '#2A4E10', '#3A6614', '#4A7E1A'];
  const DEEP = ['#0D1140', '#141A5E', '#1C2489', '#2430A8'];

  // ---- Long Sleeves (musclecourse): a jester's long pink-and-lime striped sleeve, a cream frill at the cuff and a
  // hand gripping three extra cards fanned out of it (without the hand, the striped tube read as a party popper).
  A.voucher('musclecourse', {
    ground: ['#2E1160', '#3E1880', '#4A1F94', '#5726A6'], glow: [19, 12, 12], speck: [R.pink[6], R.lime[6], C.cream],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      // the cards first, fanned out of the cuff, so the cuff covers their ends
      const big = (cx, cy, a, suit) => { L.tiltCard(f, cx, cy, 3.4, 5, a); f.blit(K.pipBmp(suit, 5), Math.round(cx - 2), Math.round(cy - 2)); };
      big(14.5, 7, 0.1, 'H'); big(25, 14.5, 1.35, 'D'); big(20.5, 8.5, 0.72, 'S');
      const ax = -3, ay = 33, bx = 14, by = 17, len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
      const along = (x, y) => (x - ax) * ux + (y - ay) * uy, across = (x, y) => -(x - ax) * uy + (y - ay) * ux;
      const sleeve = Mask.fn(W, W, (x, y) => { const a = along(x, y), c = across(x, y); return a >= 0 && a <= len - 2 && Math.abs(c) <= 5.2; });
      const sb = L.bands(sleeve, [R.pink, R.lime], (x, y) => Math.floor(along(x, y) / 3.4) % 2, { cap: 3, base: 4, gain: 3.4 });
      sb.outline(C.edge); f.blit(sb, 0, 0);
      // the hand gripping the fan: a fist and a thumb up the cards
      L.layer(f, k.ellipse(W, W, 16.5, 14.5, 3.4, 3), L.SKIN, { cap: 2, base: 4, gain: 3.4 });
      L.layer(f, k.roundRect(W, W, 17, 10, 19, 14, 1), L.SKIN, { cap: 1.2, base: 5, gain: 3 });
      // the frilled cuff, a cream ruffle
      const cuff = Mask.fn(W, W, (x, y) => { const a = along(x, y), c = across(x, y); return a >= len - 4 && a <= len - 0.5 + (Math.round(c) % 2 === 0 ? 1 : 0) && Math.abs(c) <= 6.6; });
      L.layer(f, cuff, R.cream.slice(1), { cap: 1.4, base: 5, gain: 3 });
      return f;
    },
  });

  // ---- Midnight Oil (speedcourse): a brass oil lamp burning beside a clock at midnight, an extra card glowing in
  // its light.
  A.voucher('speedcourse', {
    ground: NIGHT, glow: [22, 15, 12], speck: [R.gold[5], C.cream],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      // the clock at twelve
      L.layer(f, L.round(W, W, 10, 10, 8.4), R.brass, { cap: 2, base: 4, gain: 3 });
      const face = emboss(L.round(W, W, 10, 10, 6.5), R.cream, { cap: 2, base: 6, gain: 2 }); face.outline(C.edge); f.blit(face, 0, 0);
      [[10, 5], [15, 10], [10, 15], [5, 10]].forEach(([x, y]) => f.set(x, y, C.cream5));
      for (let y = 5; y <= 10; y++) f.set(10, y, C.edge);
      f.rect(9, 7, 3, 4, C.edge); f.set(10, 10, R.brass[5]);
      // the extra card, warm in the lamplight
      L.card(f, 3, 19, 9, 12, { pip: 'h', face: C.cream });
      // the lamp: brass foot and font, a glass chimney with the flame inside
      L.layer(f, k.roundRect(W, W, 17, 27, 29, 30, 1), R.brass, { cap: 1, base: 4, gain: 3 });
      L.layer(f, k.ellipse(W, W, 23, 23.5, 5.4, 3.4), R.brass, { cap: 2, base: 4, gain: 3.4 });
      const glass = Mask.fn(W, W, (x, y) => ((x - 23) / 4.6) ** 2 + ((y - 14.5) / 5.6) ** 2 <= 1 || (y >= 5 && y <= 10 && Math.abs(x - 23) <= 2));
      const g = new Bmp(W, W);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (glass.get(x, y)) g.set(x, y, !glass.get(x - 1, y) || !glass.get(x, y - 1) ? R.ghost[6] : !glass.get(x + 1, y) ? R.ghost[3] : R.dark[3]);
      g.outline(C.edge); f.blit(g, 0, 0);
      f.draw(['..r..', '.rar.', '.aya.', 'rauar', 'rauar', '.ryr.', '..k..'], 21, 12, { r: R.ember[5], a: R.ember[6], y: R.money[6], u: R.money[8], k: C.edge });
      return f;
    },
  });

  // ---- Spring Cleaning (springcleaning): a broom with a pink flower in its band, sweeping two cards into a
  // dustpan.
  A.voucher('springcleaning', {
    ground: MOSS, glow: [15, 17, 12], speck: [R.pink[6], C.cream],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      // the dustpan: a tin scoop open toward the broom, its handle up behind
      L.layer(f, k.strokeQuad(W, W, [27, 21], [29, 17], [30, 13], 2.2), R.mult, { cap: 1, base: 5, gain: 3 });
      const pan = Mask.fn(W, W, (x, y) => y <= 29 && x <= 28 && y >= 29 - (x - 17) * 0.75 && x >= 17);
      const pb = emboss(pan, R.steel, { cap: 2, base: 3, gain: 3 });
      for (let x = 17; x <= 28; x++) { if (pb.get(x, 29)) pb.set(x, 29, R.steel[1]); }
      pb.outline(C.edge); f.blit(pb, 0, 0);
      // two swept cards, one already sliding into the pan
      L.tiltCard(f, 13.5, 26, 3, 4.2, 1.25, { pip: 'h' });
      L.tiltCard(f, 20, 24, 3, 4.2, 0.9, { pip: 'h' });
      // the broom: a wooden handle, a pink band with a flower, a fan of straw
      L.layer(f, k.strokeQuad(W, W, [29, 0], [21, 8], [12, 16], 2.6), R.wood, { cap: 1, base: 4, gain: 3 });
      const th = Math.atan2(16 - 0, 12 - 29), ux = Math.cos(th), uy = Math.sin(th);
      const straw = Mask.fn(W, W, (x, y) => { const a = (x - 12) * ux + (y - 16) * uy, c = -(x - 12) * uy + (y - 16) * ux; return a >= 0 && a <= 11 && Math.abs(c) <= 2.6 + a * 0.45; });
      const sb = emboss(straw, R.peach, { cap: 2, base: 5, gain: 3 });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (sb.get(x, y) && Math.round(-(x - 12) * uy + (y - 16) * ux) % 2 === 0) sb.set(x, y, R.peach[3]);
      sb.outline(C.edge); f.blit(sb, 0, 0);
      L.layer(f, Mask.fn(W, W, (x, y) => { const a = (x - 12) * ux + (y - 16) * uy, c = -(x - 12) * uy + (y - 16) * ux; return a >= -0.5 && a <= 2 && Math.abs(c) <= 3.2; }), R.pink, { cap: 1, base: 5, gain: 3 });
      f.draw(['.p.', 'pyp', '.p.'], 13, 12, { p: R.pink[7], y: R.money[6] });
      return f;
    },
  });

  // ---- Pull Up a Chair (extrapanel): an empty wooden chair pulled up to a plum card table, a jester's belled hat
  // already waiting on its seat. On violet: wood on the maroon default ground turned to brown mush at 2 px.
  A.voucher('extrapanel', {
    ground: VIOLET, glow: [13, 16, 13],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      // the card table, its plum cloth hanging over the edge, a card on it
      L.layer(f, k.roundRect(W, W, 26, 17, 27, 31, 0), R.wood, { cap: 1, base: 3, gain: 3 });
      L.layer(f, k.roundRect(W, W, 21, 12, 32, 17, 1), R.plum.slice(3), { cap: 1.5, base: 4, gain: 3 });
      f.rect(22, 12, 10, 1, R.plum[7]);
      for (let x = 22; x <= 30; x += 2) f.set(x, 17, R.plum[4]);
      f.rect(23, 11, 6, 1, C.cream); f.set(23, 11, C.white);
      // the chair: rear post, slats, seat, legs
      const wood = (x0, y0, x1, y1) => L.layer(f, k.roundRect(W, W, x0, y0, x1, y1, 0), R.wood, { cap: 1, base: 4, gain: 3 });
      wood(13, 4, 14, 17); wood(13, 19, 14, 29);
      wood(5, 5, 14, 6); wood(5, 9, 14, 10); wood(5, 13, 14, 14);
      wood(4, 2, 6, 29);
      L.layer(f, k.roundRect(W, W, 4, 17, 21, 19, 1), R.wood, { cap: 1.5, base: 4, gain: 3 });
      wood(19, 20, 20, 30); wood(7, 24, 19, 24);
      f.draw(['.ww.', 'wwww'], 3, 0, { w: R.wood[5] });
      // the belled hat on the seat: a pink point and a lime point curling to gold bells
      const hp = (p0, p1, p2, ramp) => L.layer(f, k.strokeQuad(W, W, p0, p1, p2, (t) => 5.4 - t * 3), ramp, { cap: 1.8, base: 5, gain: 3.6 });
      hp([10.5, 13.5], [5.5, 8], [8, 4], R.pink); hp([17, 13.5], [23, 7], [20, 3.5], R.lime);
      L.layer(f, k.roundRect(W, W, 8, 12, 19, 16, 2), R.cream, { cap: 1.2, base: 5, gain: 3 });
      [[6, 1], [19, 0]].forEach(([x, y]) => { f.blit(L.inkedCopy(k.sphere(1.6, R.gold, { lo: 1 })), x, y); });
      // pulled up: two scrape marks behind the legs
      f.rect(0, 26, 3, 1, R.cream[3]); f.rect(0, 29, 2, 1, R.cream[3]);
      return f;
    },
  });

  // ---- Sky Atlas (skyatlas): an open star atlas bound in ember leather (a maroon cover vanished into the maroon
  // ground), night-blue pages, a ringed ember planet on one and a planet on a dotted orbit on the other.
  A.voucher('skyatlas', {
    glow: [15, 16, 14],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      // the cover and the page edges
      L.layer(f, k.roundRect(W, W, 1, 6, 29, 26, 1), R.ember.slice(0, 7), { cap: 1.5, base: 4, gain: 3 });
      for (let x = 2; x <= 28; x++) { f.set(x, 25, C.cream2); f.set(x, 24, C.cream); }
      // the pages, bowed up to the spine
      const page = Mask.fn(W, W, (x, y) => x >= 2 && x <= 28 && x !== 15 && y <= 23 && y >= 7 - (Math.abs(x - 15) < 4 ? 1 : 0) + (Math.abs(x - 15) > 11 ? 1 : 0));
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (page.get(x, y)) f.set(x, y, y < 9 ? R.night[5] : (x * 3 + y * 5) % 17 === 0 ? R.night[5] : R.night[3]);
      for (let y = 6; y <= 24; y++) f.set(15, y, C.edge);
      f.set(14, 7, R.night[6]); f.set(16, 7, R.night[6]);
      // left page: a ringed ember world
      f.blit(L.inkedCopy(k.sphere(3.6, R.ember, { lo: 1.2, k: 1.1 })), 4, 11);
      for (let x = 3; x <= 13; x++) { const y = Math.round(16 + (x - 8) * -0.3); if (Math.abs(x - 8.5) > 2.5 || y > 15) f.set(x, y, C.cream); }
      // right page: a dotted orbit and its little world, two stars
      for (let a = 0; a < 360; a += 24) { const x = Math.round(22 + Math.cos((a * Math.PI) / 180) * 5), y = Math.round(16 + Math.sin((a * Math.PI) / 180) * 3); f.set(x, y, R.chips[7]); }
      f.blit(L.inkedCopy(k.sphere(1.6, R.lime, { lo: 1 })), 24, 11);
      [[19, 11], [27, 20]].forEach(([x, y]) => f.draw(['.s.', 'sws', '.s.'], x - 1, y - 1, { s: R.gold[4], w: C.white }));
      return f;
    },
  });

  // ---- Savings Bond (savingsbond): an engraved cream bond with a smiling pink piggy face in its corner medallion.
  A.voucher('savingsbond', {
    ground: VIOLET, glow: [14, 14, 13],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      L.layer(f, k.roundRect(W, W, 2, 5, 27, 24, 0), R.cream, { cap: 1.5, base: 6, gain: 2 });
      // the engraved border and the lines of copy
      for (let x = 4; x <= 25; x++) { f.set(x, 7, x % 2 ? R.maroon[5] : R.maroon[3]); f.set(x, 22, x % 2 ? R.maroon[5] : R.maroon[3]); }
      for (let y = 7; y <= 22; y++) { f.set(4, y, y % 2 ? R.maroon[5] : R.maroon[3]); f.set(25, y, y % 2 ? R.maroon[5] : R.maroon[3]); }
      f.rect(8, 10, 14, 2, R.maroon[4]);
      [[7, 14, 10], [7, 17, 7], [7, 20, 5]].forEach(([x, y, n]) => { for (let i = 0; i < n; i++) if (i % 3 !== 2) f.set(x + i, y, C.cream4); });
      // the medallion: a scalloped rosette with a smiling pink piggy face in it
      const ros = Mask.fn(W, W, (x, y) => { const d = Math.hypot(x - 22, y - 19), a = Math.atan2(y - 19, x - 22); return d <= 6.6 + Math.cos(a * 8) * 0.7; });
      L.layer(f, ros, R.maroon, { cap: 1.5, base: 5, gain: 3 });
      L.layer(f, L.round(W, W, 22, 19.5, 4.4), R.pink, { cap: 2, base: 6, gain: 2.6 });
      f.draw(['ee.....ee', 'e.......e'], 18, 14, { e: R.pink[4] });
      f.set(20, 18, C.edge); f.set(24, 18, C.edge);
      f.draw(['.sss.', 'snsns', '.sss.'], 20, 19, { s: R.pink[7], n: R.pink[3] });
      f.draw(['k...k', '.kkk.'], 20, 22, { k: R.pink[3] });
      return f;
    },
  });

  // ---- Night Market (spinnerrack): three striped market stalls under a string of paper lanterns, the third just
  // rolling up its shutter.
  A.voucher('spinnerrack', {
    ground: NIGHT, glow: [15, 18, 13], speck: [R.ember[6], C.cream],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      // the lantern string
      for (let x = 0; x <= 30; x++) f.set(x, Math.round(2 + Math.sin((x / 30) * Math.PI) * 2), R.cream[3]);
      [[5, R.ember], [15, R.pink], [25, R.lime]].forEach(([x, r]) => { const y = Math.round(3 + Math.sin((x / 30) * Math.PI) * 2); L.layer(f, k.roundRect(W, W, x - 1, y, x + 1, y + 3, 1), r, { cap: 1, base: 6, gain: 2.5 }); });
      // three stalls: striped awning, a lit opening with cards for sale, a wooden counter
      [[1, R.pink], [11, R.lime], [21, R.ember]].forEach(([x0, r], i) => {
        f.rect(x0, 13, 9, 11, R.plum[3]);
        f.rect(x0 + 1, 14, 7, 9, R.ember[7]);
        f.rect(x0 + 1, 14, 7, 1, R.ember[6]);
        L.card(f, x0 + 1, 16, 4, 6, {}); L.card(f, x0 + 4, 17, 4, 6, {});
        if (i === 2) { for (let y = 13; y <= 18; y++) for (let x = x0; x < x0 + 9; x++) f.set(x, y, y % 2 ? R.steel[2] : R.steel[3]); f.rect(x0, 19, 9, 1, R.steel[1]); }
        const aw = Mask.fn(W, W, (x, y) => x >= x0 - 1 && x <= x0 + 9 && y >= 8 && y <= 12 + (((x - x0) & 1) ? 0 : 1));
        const ab = L.bands(aw, [r, R.cream], (x) => ((x - x0 + 1) >> 1) % 2, { cap: 1, base: 5, gain: 2.5 });
        ab.outline(C.edge); f.blit(ab, 0, 0);
        L.layer(f, k.roundRect(W, W, x0 - 1, 24, x0 + 9, 26, 0), R.wood, { cap: 1, base: 4, gain: 3 });
        f.rect(x0, 27, 1, 3, R.wood[2]); f.rect(x0 + 8, 27, 1, 3, R.wood[2]);
      });
      return f;
    },
  });

  // ---- Second Look (secondlook): a brass magnifying glass over a row of three identical $5 price tags.
  A.voucher('secondlook', {
    glow: [15, 16, 12],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      const AMBER = '#7E4A0E';
      // three tags on their strings
      [2, 12, 22].forEach((x0) => {
        for (let y = 2; y < 13; y++) f.set(x0 + 3, y, R.cream[3]);
        const tag = Mask.fn(W, W, (x, y) => x >= x0 && x <= x0 + 6 && y >= 12 && y <= 25 && !(y === 12 && (x === x0 || x === x0 + 6)) && !(y === 13 && (x === x0 || x === x0 + 6) && false));
        L.layer(f, tag, R.cream, { cap: 1.2, base: 6, gain: 2 });
        f.set(x0 + 3, 14, C.edge);
        L.glyph(f, '5', x0 + 1, 17, AMBER);
      });
      // the magnifier over the middle tag: a brass ring, a pale lens, a wooden handle
      L.layer(f, k.strokeQuad(W, W, [21, 25], [25, 27], [29, 30], 3), R.wood, { cap: 1, base: 4, gain: 3 });
      const ring = Mask.fn(W, W, (x, y) => { const d = Math.hypot(x - 15, y - 19); return d <= 7.4 && d >= 5.4; });
      const lens = Mask.fn(W, W, (x, y) => Math.hypot(x - 15, y - 19) < 5.4);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (lens.get(x, y)) { if (!f.get(x, y)) f.set(x, y, R.plum[3]); f.mix(x, y, '#D9F4FF66'); }
      f.mix(12, 16, '#FFFFFFB0'); f.mix(13, 16, '#FFFFFF90'); f.mix(12, 17, '#FFFFFF90');
      L.layer(f, ring, R.brass, { cap: 1.2, base: 4, gain: 3 });
      return f;
    },
  });

  // ---- Shimmer Dust (slickpaper): a small violet drawstring pouch spilling glittering dust that flashes white,
  // pink and pale blue. On rose, so the violet pouch stands off its ground; a gathered frill above the cord and
  // the dust fanning out to the right and down (sparks up the line of the neck read as a lit fuse on a bomb).
  A.voucher('slickpaper', {
    ground: ROSE, glow: [17, 14, 13], speck: [C.white, R.pink[7], R.ghost[5]],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      // the pouch, tipped up to the right, its neck gathered with a cream cord and frilled above it
      L.layer(f, k.ellipse(W, W, 10, 21.5, 7.5, 6.8), R.vio, { cap: 3.5, base: 5, gain: 3.6 });
      const neck = Mask.fn(W, W, (x, y) => { const a = (x - 14) * 0.7 - (y - 15) * 0.7, c = (x - 14) * 0.7 + (y - 15) * 0.7; return a >= -1 && a <= 4.5 && Math.abs(c) <= 2.2 + a * 0.5; });
      L.layer(f, neck, R.vio, { cap: 1.5, base: 6, gain: 3 });
      [[16, 10], [19, 12], [18, 9]].forEach(([x, y]) => L.layer(f, k.ellipse(W, W, x, y, 1.8, 1.8), R.vio.slice(3), { cap: 1, base: 4, gain: 3 }));
      f.draw(['..cc', '.cc.', 'cc..'], 13, 14, { c: C.cream2 });
      f.draw(['c.', 'c.', '.c'], 11, 17, { c: C.cream2 });
      // the dust: sparks of white, pink and pale blue streaming out
      [[22, 9, C.white, 0], [26, 4, R.pink[6], 0], [27, 13, R.ghost[5], 1], [23, 2, R.ghost[5], 1], [25, 18, R.pink[6], 1], [28, 1, C.white, 1], [21, 15, R.pink[6], 1]].forEach(([x, y, c, s]) => L.spark(f, x - (s ? 1 : 2), y - (s ? 1 : 2), c, C.white, !!s));
      [[20, 12], [22, 13], [25, 8], [21, 7], [27, 8], [23, 5]].forEach(([x, y], i) => f.set(x, y, [C.white, R.pink[7], R.ghost[5]][i % 3]));
      return f;
    },
  });

  // ---- Ribbon Box (stampalbum): an open wooden sewing box with four spools of ribbon in pink, gold, chip blue and
  // violet standing in it, the pink ribbon unwound over the front. Each spool shows whole, a wooden flange above
  // and below its wound ribbon, and is inked as one piece so the flanges step out past the ribbon: a bobbin's
  // silhouette. (With the box front covering the lower flanges they read as gems or paint pots in a chest.)
  A.voucher('stampalbum', {
    ground: ROSE, glow: [15, 14, 13],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      // the open lid behind, lined in cream
      L.layer(f, k.roundRect(W, W, 2, 2, 28, 12, 1), R.wood, { cap: 1.5, base: 3, gain: 3 });
      f.rect(4, 4, 23, 7, C.cream2); f.rect(4, 4, 23, 1, C.cream3);
      // four spools: flanges top and bottom, the ribbon wound between them with two wind lines
      const FL = R.wood.slice(2);
      [[2, R.pink], [9, R.gold], [16, R.chips], [23, R.vio]].forEach(([x0, r]) => {
        const s = new Bmp(W, W);
        s.blit(emboss(k.roundRect(W, W, x0 + 1, 11, x0 + 4, 16, 0), r, { cap: 1.5, base: 5, gain: 3.2 }), 0, 0);
        for (const y of [13, 15]) for (let x = x0 + 1; x <= x0 + 4; x++) s.set(x, y, r[3]);
        s.blit(emboss(k.roundRect(W, W, x0, 9, x0 + 5, 10, 0), FL, { cap: 1, base: 3, gain: 2 }), 0, 0);
        s.blit(emboss(k.roundRect(W, W, x0, 17, x0 + 5, 18, 0), FL, { cap: 1, base: 2, gain: 2 }), 0, 0);
        s.outline(C.edge); f.blit(s, 0, 0);
      });
      // the box front, low enough to show the spools' lower flanges, and its brass clasp
      L.layer(f, k.roundRect(W, W, 1, 20, 29, 29, 1), R.wood, { cap: 2, base: 4, gain: 3 });
      f.rect(2, 21, 27, 1, R.wood[6]);
      f.blit(L.inkedCopy(k.sphere(1.3, R.brass, { lo: 1 })), 13, 22);
      // the pink ribbon, unwound off its spool, over the front edge and hanging down it
      L.layer(f, k.strokeQuad(W, W, [5, 16], [1, 21], [5, 28], 2.2), R.pink, { cap: 1, base: 5, gain: 3 });
      return f;
    },
  });

  // ---- Haunted Stall (mailorderghost): a little market stall kept by a friendly ghost-blue sheet ghost, Spectral
  // cards pinned up behind it.
  A.voucher('mailorderghost', {
    ground: NAVY, glow: [15, 15, 12], speck: [R.ghost[5], C.cream],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      // the Spectral cards pinned behind, each marked with a wisp drop (a 3 x 3 plus by a ghost reads as a grave)
      [[3, 10], [22, 9]].forEach(([x, y]) => {
        L.card(f, x, y, 7, 9, { face: R.navy[3], hi: R.navy[5], shade: R.navy[1] });
        f.draw(['.g.', 'ggg', 'ggg', '.g.'], x + 2, y + 3, { g: R.ghost[5] });
        f.set(x + 3, y + 1, R.gold[5]);
      });
      // the ghost: a sheet with a wavy hem, two dark eyes and a smile, its hands on the counter
      const ghost = Mask.fn(W, W, (x, y) => ((x - 15) / 6.2) ** 2 + ((y - 13) / 6.5) ** 2 <= 1 || (y >= 13 && y <= 22 && Math.abs(x - 15) <= 6.2));
      L.layer(f, ghost, R.ghost, { cap: 3, base: 4, gain: 3.4 });
      f.rect(12, 12, 2, 3, C.edge); f.rect(17, 12, 2, 3, C.edge); f.set(12, 12, R.ghost[2]); f.set(17, 12, R.ghost[2]);
      f.draw(['K...K', '.KKK.'], 13, 16, { K: C.edge });
      // the striped awning
      const aw = Mask.fn(W, W, (x, y) => y >= 1 && y <= 6 + ((x & 2) ? 1 : 0) && x >= 0 && x <= 30);
      const ab = L.bands(aw, [R.maroon, R.cream], (x) => (x >> 2) % 2, { cap: 1.5, base: 5, gain: 2.5 });
      ab.outline(C.edge); f.blit(ab, 0, 0);
      // the counter, with the ghost's hands resting on it
      L.layer(f, k.roundRect(W, W, 1, 21, 29, 30, 1), R.wood, { cap: 2, base: 4, gain: 3 });
      f.rect(2, 22, 27, 1, R.wood[6]);
      for (let x = 5; x <= 25; x += 5) f.rect(x, 24, 1, 6, R.wood[2]);
      L.layer(f, k.ellipse(W, W, 10, 21, 2, 1.4), R.ghost, { cap: 1, base: 5, gain: 2 });
      L.layer(f, k.ellipse(W, W, 20, 21, 2, 1.4), R.ghost, { cap: 1, base: 5, gain: 2 });
      return f;
    },
  });

  // ---- Baker's Dozen (bonuspages): a baker's tray of twelve golden buns stacked five, four and three, with a
  // thirteenth balanced on top. On night blue, and baked golden (wood shadows up to ember-lit tops): dark wood
  // buns on the maroon default ground were brown mush at 2 px.
  const BUN = Object.freeze([R.wood[1], R.wood[3], R.wood[4], R.wood[5], R.wood[6], R.ember[7]]);
  A.voucher('bonuspages', {
    ground: NIGHT, glow: [15, 16, 14], speck: [C.cream, R.peach[6]],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      L.layer(f, k.roundRect(W, W, 0, 27, 30, 29, 1), R.steel, { cap: 1, base: 3, gain: 3 });
      const bun = (x, y) => {
        const m = Mask.fn(W, W, (i, j) => ((i - x - 2.5) / 3.1) ** 2 + ((j - y - 3) / 3) ** 2 <= 1 && j <= y + 4);
        const b = emboss(m, BUN, { cap: 2, base: 3, gain: 3.4 });
        b.outline(C.edge); f.blit(b, 0, 0);
        f.set(x + 1, y + 1, BUN[5]); f.set(x + 2, y + 1, C.cream);
      };
      for (let i = 0; i < 5; i++) bun(i * 6, 22);
      for (let i = 0; i < 4; i++) bun(3 + i * 6, 17);
      for (let i = 0; i < 3; i++) bun(6 + i * 6, 12);
      bun(13, 7);
      L.spark(f, 20, 3, R.gold[5], C.white, true);
      return f;
    },
  });

  // ---- Season Pass (dollaroff): a carnival season pass on a pink lanyard, a $1-off star stuck on its corner.
  A.voucher('dollaroff', {
    ground: DEEP, glow: [15, 16, 13], speck: [R.pink[6], C.cream],
    draw(k) {
      const W = 31, f = new Bmp(W, W);
      // the lanyard: two pink straps down to a steel clip
      L.layer(f, k.strokeQuad(W, W, [4, -2], [9, 5], [14, 10], 2.6), R.pink, { cap: 1, base: 5, gain: 3 });
      L.layer(f, k.strokeQuad(W, W, [26, -2], [21, 5], [16, 10], 2.6), R.pink, { cap: 1, base: 5, gain: 3 });
      L.layer(f, k.roundRect(W, W, 13, 9, 17, 12, 1), R.steel, { cap: 1, base: 3, gain: 3 });
      // the pass: cream card, a pink header with a punched slot, a little big top and two lines
      L.layer(f, k.roundRect(W, W, 7, 12, 23, 30, 1), R.cream, { cap: 1.5, base: 6, gain: 2 });
      f.rect(8, 13, 15, 4, R.pink[5]); f.rect(8, 13, 15, 1, R.pink[6]); f.rect(13, 14, 5, 1, C.edge);
      f.draw(['...r...', '..rcr..', '.rcrcr.', 'rcrcrcr', '.c.c.c.'], 9, 19, { r: R.mult[5], c: C.cream2 });
      f.rect(9, 26, 8, 1, C.cream4); f.rect(9, 28, 5, 1, C.cream4);
      // the $1-off star: flat yellow with one amber rim, like cash, and an amber 1
      const star = new Bmp(13, 13);
      star.draw(['......y......', '.....yyy.....', '.....yyy.....', 'yyyyyyyyyyyyy', '.yyyyyyyyyyy.', '..yyyyyyyyy..', '...yyyyyyy...', '...yyyyyyy...', '..yyyyyyyyy..', '..yyyy.yyyy..', '.yyy.....yyy.', '.yy.......yy.', '.............'], 0, 0, { y: '#FFCE3B' });
      star.outline('#D18A1D');
      L.glyph(star, '1', 4, 3, '#7E4A0E');
      f.blit(star, 18, 17);
      return f;
    },
  });

  // ================================================================== Tags
  // The core draws the round brass token and its enamel field (11 x 11, round: rows 5, 9, 9, 11 x 5, 9, 9, 5 wide)
  // with a shadow along its top left. Each picture is a hand-placed 11 x 11 grid, bright on dark enamel.
  /** A picture from grid rows and a colour key. */
  L.pic = (rows, key) => { const g = K.grid(rows); return new Bmp(g[0].length, g.length).draw(g, 0, 0, key); };
  const CASH = '#FFCE3B', CASH_RIM = '#D18A1D';

  // ---- Piggy Bank Tag (piggybank): a pink piggy bank, a coin dropping into its slot.
  A.tag('piggybank', {
    ground: ['#5320A0', '#3E1880', '#2E1160'],
    draw: () => L.pic([
      '....yyy....',
      '.pp.YYY.pp.',
      '.pphkkkhpp.',
      'phhhhhhhhpp',
      'ppekpppekpP',
      'pppsssssppP',
      'pppsnsnspPP',
      'pppsssssPPP',
      '.pppppppPP.',
      '..PPPPPPP..',
      '...........',
    ], { y: CASH, Y: CASH_RIM, p: R.pink[5], h: R.pink[6], P: R.pink[3], s: R.pink[7], n: R.pink[2], e: C.white, k: C.edge }),
  });

  // ---- Buddy Tag (buddy): two little jesters side by side, one in a peach cap and one in a lime cap tipped at a
  // jaunty angle, white ruffs.
  A.tag('buddy', {
    ground: ['#7A2638', '#5E1A2C', '#43101F'],
    draw: () => L.pic([
      '.......g..g',
      '..g..g.l..l',
      '..p..p.llll',
      '.pppppLLLL.',
      '.PPPP.ffff.',
      '.ffff.fefe.',
      '.fefe.ffff.',
      '.ffff.wwww.',
      '.wwww......',
      '...........',
      '...........',
    ], { g: R.gold[5], p: R.peach[5], P: R.peach[3], l: R.lime[5], L: R.lime[3], f: L.SKIN[5], e: C.edge, w: C.white }),
  });

  // ---- Tarot Tag (tarot): two violet Tarot cards fanned under a gold sun-eye.
  A.tag('tarot', {
    ground: ['#2E3780', '#1B2058', '#141844'],
    draw: () => L.pic([
      '....u.u....',
      '...uyKyu...',
      '....yyy....',
      '.LLLLL.....',
      '.LvvvLKKKK.',
      '.LvvvKMMMMK',
      '.LvvvKMvsvK',
      '.LvvvKMsssK',
      '.ddddKMvsvK',
      '.....KMvvvK',
      '......KKKK.',
    ], { u: R.gold[5], y: R.gold[4], K: C.edge, L: R.vio[6], v: R.vio[4], d: R.vio[2], M: R.vio[7], s: R.gold[5] }),
  });

  // ---- Crowd Pleaser Tag (fanfavorite): a small pink heart over a pair of cream hands clapping up at it, gold
  // sparkles between. (A heart filling the field is the Hearts suit mark and promised a Hearts effect.)
  A.tag('fanfavorite', {
    ground: ['#7A2638', '#5E1A2C', '#43101F'],
    draw: () => L.pic([
      '...........',
      '.g.pp.pp.g.',
      '..ppphpp...',
      '...ppppP...',
      '....ppP....',
      '.....P.....',
      '.c.......c.',
      'cc.g...g.cc',
      'ccc.....ccc',
      '.ccc...ccc.',
      '..cc...cc..',
    ], { g: R.gold[5], p: R.pink[5], h: R.pink[7], P: R.pink[3], c: C.cream }),
  });

  // ---- Second Wind Tag (secondwind): a puffing pale cloud blowing a candle flame sideways without putting it out.
  A.tag('secondwind', {
    ground: ['#2E3780', '#1B2058', '#141844'],
    draw: () => L.pic([
      '...........',
      '.ww........',
      'wWwww...oo.',
      'wwwwww.ooyo',
      'wwkwwk..oyo',
      '.wwkk.-ooo.',
      '..ww.-..ccc',
      '.....-..ccc',
      '........ccc',
      '........ccc',
      '...........',
    ], { w: R.ghost[5], W: C.white, k: R.ghost[2], o: R.ember[5], y: R.money[7], c: C.cream, '-': R.ghost[4] }),
  });

  // ---- Head Start Tag (headstart): a running shoe dashing over a chalk start line, speed lines behind it.
  A.tag('headstart', {
    ground: ['#3F7317', '#2F5A12', '#1C3A0A'],
    draw: () => L.pic([
      '.......w...',
      '.......w...',
      '..RRR......',
      '..rrrr.....',
      '-.rrrrww...',
      '--rrrrrrww.',
      '-.rrrrrrrrr',
      '-.ccccccccc',
      '...........',
      '.......w...',
      '.......w...',
    ], { r: R.ember[5], R: R.ember[3], w: C.white, c: C.cream, '-': R.lime[6] }),
  });

  // ---- Sale Tag (sale): a red price tag lying on its side, pointing left, its punched hole at the point and a
  // loop of string through it. (Stood upright under its loop it read as a handbag or a padlock.)
  A.tag('sale', {
    ground: ['#4D2B40', '#3C2132', '#2A1423'],
    draw: () => L.pic([
      '...........',
      '.s.........',
      's.sRRRRRR..',
      's.RRRRRRRr.',
      '.RRkRwwwRr.',
      'RRRRRRRRRr.',
      '.RRRRwwwRr.',
      '..RRRRRRRr.',
      '...rrrrrrr.',
      '...........',
      '...........',
    ], { s: C.cream2, R: R.mult[5], r: R.mult[3], k: C.edge, w: R.mult[7] }),
  });

  // ---- Grab Bag Tag (grabbag): a striped paper grab bag with a crimped top, an inked cream card rising out of
  // it and another behind. (Two cards side by side with centred pips over vertical stripes read as a grinning
  // face: eyes over teeth.)
  A.tag('grabbag', {
    ground: ['#4D2B40', '#3C2132', '#2A1423'],
    draw: () => L.pic([
      '....kkkkk..',
      '...kccccck.',
      '..kkcxcxck.',
      '.kcckxxxck.',
      '.kcckcxcck.',
      'pPpPpPpPpPp',
      '.ppppppppp.',
      '.wwwwwwwww.',
      '.ppppppppp.',
      '..PPPPPPP..',
      '...........',
    ], { c: C.cream, x: R.red[3], k: C.edge, p: R.pink[5], P: R.pink[3], w: C.cream1 }),
  });

  // ---- Glimmer Tag (collector): a Joker card with a white sheen sweeping across it and two sparkles at its corners.
  A.tag('collector', {
    ground: ['#5320A0', '#3E1880', '#2E1160'],
    draw: () => L.pic([
      '...........',
      '.FFFFFF....',
      '.FdddwF..s.',
      '.FddwwF.sWs',
      '.FdwwdF..s.',
      '.FwwddF....',
      '.wwFFFF..s.',
      '.FkkkkF.sWs',
      '.FFFFFF..s.',
      '...........',
      '...........',
    ], { s: R.money[7], W: C.white, F: R.peach[5], d: C.plum, w: C.white, k: C.plum2 }),
  });

  // ---- Ghost Tag (ghost): a cheerful ghost-blue sheet ghost holding up a lit candle.
  A.tag('ghost', {
    ground: ['#344088', '#1E2658', '#141A44'],
    draw: () => L.pic([
      '.......o...',
      '...ggg.y...',
      '..ggggg.c..',
      '.gkgkggGc..',
      '.gkgkgg.c..',
      '.ggggggg...',
      '.gmmmgg....',
      '.ggggggg...',
      '.gggggg....',
      '.g.gg.g....',
      '...........',
    ], { g: R.ghost[5], G: R.ghost[4], k: C.edge, m: R.ghost[3], o: R.ember[5], y: R.money[7], c: C.cream }),
  });

  // ---- Ribbon Tag (stamp): a pink swallowtail ribbon tied in a bow round two cards.
  A.tag('stamp', {
    ground: ['#7A2638', '#5E1A2C', '#43101F'],
    draw: () => L.pic([
      '...........',
      '....ccccc..',
      '..ccccccc..',
      '..cccccc...',
      '.pp.ppcc...',
      'ppppppppppp',
      '.pp.ppcc...',
      '..cpcpccc..',
      '..pccpccc..',
      '..ccccccc..',
      '...........',
    ], { c: C.cream, p: R.pink[5] }),
  });

  // ---- Sky Tag (sky): a ringed ember planet on a night-blue field scattered with gold stars.
  A.tag('sky', {
    ground: ['#232A6B', '#1B2058', '#0E1130'],
    draw(k) {
      const f = new Bmp(11, 11);
      f.blit(k.sphere(3.1, R.ember, { lo: 1.2, k: 1.1 }), 2, 2);
      for (let x = 0; x <= 10; x++) { const y = Math.round(6 + (x - 5) * -0.35); if (Math.abs(x - 5.5) > 2.5 || y > 5) f.set(x, y, C.cream); }
      [[1, 1], [9, 2], [8, 9], [2, 9]].forEach(([x, y]) => f.set(x, y, R.gold[5]));
      return f;
    },
  });

  // ================================================================== Booster Packs
  // The core draws the sliding matchbox in the kind's ramp (tray, striker, cream label) and the Jumbo and Mega
  // marks; each kind gives its ramp and the label picture (up to 19 x 19, centred on the label).
  const LBL = 19;

  // ---- Card Pack: a cream matchbox; on its label a fan of three cream playing cards with red and plum pips.
  A.pack('card', {
    ramp: R.cream, labelGround: R.ember[7],
    label(k) {
      const f = new Bmp(LBL, LBL);
      [[-0.5, 'H'], [0.5, 'D'], [0, 'S']].forEach(([a, suit]) => {
        const cx = 9 + Math.sin(a) * 8, cy = 10.5 - Math.cos(a) * 1.5 + Math.abs(a) * 2.4;
        L.tiltCard(f, cx, cy, 3.6, 5.4, a);
        f.blit(K.pipBmp(suit, 5), Math.round(cx - 2 + Math.sin(a) * 1.6), Math.round(cy - 3 - Math.abs(a) * 1.2));
      });
      return f;
    },
  });

  // ---- Tarot Pack: a violet matchbox; on its label a gold sun-eye over an arched night-sky window.
  A.pack('tarot', {
    ramp: R.vio,
    label(k) {
      const f = new Bmp(LBL, LBL);
      const arch = (x, y) => y >= 10 ? x >= 3 && x <= 15 : (x - 9) ** 2 + (y - 10) ** 2 <= 6.4 * 6.4;
      for (let y = 4; y < 19; y++) for (let x = 2; x <= 16; x++) {
        if (!arch(x, y)) continue;
        const ring = !arch(x - 1, y) || !arch(x + 1, y) || !arch(x, y - 1) || y === 18;
        f.set(x, y, ring ? R.vio[5] : ['#221A66', '#2C2078', '#38288C', '#45309E'][Math.min(3, Math.floor((y - 4) / 3.6))]);
      }
      f.outline(C.edge);
      [[6, 10, C.white], [12, 8, R.money[7]], [10, 14, C.white], [5, 15, R.money[7]], [13, 16, C.white]].forEach(([x, y, c]) => f.set(x, y, c));
      f.draw(['.u.u.u.u.', 'uyyyyyyyu', '.yvvkvvy.', '.yykkkyy.', '..yyyyy..'], 5, 0, { u: R.gold[5], y: R.gold[4], v: C.white, k: C.edge });
      return f;
    },
  });

  // ---- Planet Pack: a blue matchbox (the Planet cards' chip blue, so it never matches the navy Ghost Pack); on
  // its label a ringed ember planet on a dotted orbit.
  A.pack('planet', {
    ramp: R.chips.slice(0, 8),
    label(k) {
      const f = new Bmp(LBL, LBL);
      for (let a = 0; a < 360; a += 15) {
        const x = Math.round(9 + Math.cos((a * Math.PI) / 180) * 8.6), y = Math.round(10 + Math.sin((a * Math.PI) / 180) * 4);
        f.set(x, y, a % 45 === 0 ? R.chips[5] : R.chips[6]);
      }
      const pl = L.inkedCopy(k.sphere(5, R.ember, { lo: 1.2, k: 1.1, band: (x, y) => (Math.floor((y + 0.4 * (x - 5)) / 2.6) % 2 ? -0.7 : 0.2) }));
      f.blit(pl, 3, 4);
      for (let x = 1; x <= 17; x++) {
        const y = Math.round(10 + (x - 9) * -0.3);
        if (Math.abs(x - 9) > 4 || y > 9) { f.set(x, y, x % 4 === 0 ? C.cream2 : C.cream); f.set(x, y + 1, '#C98C6A'); }
      }
      [[16, 3], [2, 16]].forEach(([x, y]) => f.draw(['.s.', 'sws', '.s.'], x - 1, y - 1, { s: R.chips[6], w: C.white }));
      return f;
    },
  });

  // ---- Joker Pack: a maroon matchbox; on its label the jester's empty belled cap: a pink point and a lime point
  // curling to gold bells over a violet crown, a pink band and a cream frill. No face: a plain grinning jester
  // face is the stock composition that ART.md section 9 rules out, so the label shows only the cap.
  A.pack('joker', {
    ramp: R.maroon,
    label(k) {
      const W = LBL, f = new Bmp(W, W);
      const prong = (p0, p1, p2, ramp) => L.layer(f, k.strokeQuad(W, W, p0, p1, p2, (t) => 6 - t * 3.8), ramp, { cap: 1.8, base: 5, gain: 3.6 }, false);
      prong([6, 13], [0, 9], [2, 3], R.pink); prong([13, 13], [19, 9], [17, 3], R.lime);
      L.layer(f, Mask.fn(W, W, (x, y) => ((x - 9.5) / 4.6) ** 2 + ((y - 12) / 5) ** 2 <= 1 && y <= 13), R.vio.slice(2), { cap: 2, base: 4, gain: 3.4 }, false);
      L.layer(f, k.roundRect(W, W, 2, 13, 17, 16, 1), R.pink.slice(1), { cap: 1.2, base: 5, gain: 3 }, false);
      f.draw(['.c.c.c.c.c.c.c.', 'ccccccccccccccc'], 2, 17, { c: C.cream });
      f.outline(C.edge);
      [[0, 0], [14, 0], [7, 4]].forEach(([x, y]) => f.blit(L.inkedCopy(k.sphere(1.3, R.gold, { lo: 1 })), x, y));
      return f;
    },
  });

  // ---- Ghost Pack: a navy matchbox; on its label a ghost-blue wisp burning on a cream candle stub (Lit's
  // Wickwisp), with two dark eyes, inside a wavering pale border on a dark field, like a little Spectral card.
  // (On its own the wisp was an upright blue teardrop and read as a water drop.)
  A.pack('ghost', {
    ramp: R.navy,
    label(k) {
      const W = LBL, f = new Bmp(W, W);
      f.rect(1, 1, 17, 17, R.navy[1]);
      for (let i = 1; i <= 17; i++) {
        const o = (i >> 1) % 2;
        f.set(i, 1 + o, R.ghost[5]); f.set(i, 17 - o, R.ghost[5]); f.set(1 + o, i, R.ghost[5]); f.set(17 - o, i, R.ghost[5]);
      }
      // the candle stub, lit from the left like the Blind candles
      const wax = new Bmp(W, W);
      for (let y = 12; y <= 15; y++) for (let i = 0; i < 5; i++) wax.set(7 + i, y, [C.white, C.cream, C.cream1, C.cream2, C.cream3][i]);
      wax.outline(C.edge); f.blit(wax, 0, 0);
      // the wisp burning on it
      const wisp = Mask.fn(W, W, (x, y) => {
        if ((x - 9) ** 2 + (y - 8) ** 2 <= 3.6 * 3.6) return true;
        if (y < 2 || y > 8) return false;
        const t = (y - 2) / 6;
        return Math.abs(x - 9 - Math.sin(y * 0.9) * 1.2 * (1 - t)) <= t * 3.3;
      });
      L.layer(f, wisp, R.ghost, { cap: 2.4, base: 4, gain: 3.6 });
      f.rect(7, 7, 1, 2, C.edge); f.rect(11, 7, 1, 2, C.edge);
      f.set(9, 11, C.edge);
      return f;
    },
  });
})();
