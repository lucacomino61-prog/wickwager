/* Jokers, set d (joker artist d): 30 uncommon, rare and legendary Jokers, in content-plan order from Carpetbag
 * to The Ringmaster. Each is A.joker(id, { ground, glow, speck, draw }) in the shape of 40-jokers-lit.js: draw()
 * returns only the 31 x 31 figure; the core adds the rarity frame, gems, ground bands, glow pool, specks, the
 * figure's ink outline and the empty name plate. Light comes from the upper left; parts that overlap are parted
 * with ink here. Un-inked light (a halo, sparks, a coin's flare) is laid over the window afterwards in overlay(),
 * only on ground pixels, in solid ramp colours stepped in rings (L.halo, L.glowOver): never alpha mixes, which go
 * grey over violet and navy. Grounds sit in Lit's range (darkest band at L >= 0.03, lightest near 0.08), and the
 * five Legendaries each get their own warm ground so a rack of them is not one violet strip. rarity repeats the
 * content plan's, for while TW.Content has no row yet. Helpers shared by this file live in TW.Art.lib.d (never in
 * the kit); L.cap2 is the two-point jester cap most of the set wears.
 */
(() => {
  'use strict';
  const A = globalThis.TW.Art, kit = A.kit;
  const { R, C } = kit;
  const L = (A.lib.d = A.lib.d || {});
  const W = 31;

  // ------------------------------------------------------------ helpers (TW.Art.lib.d)
  // Skin ramps, dark to light, lit like the classic Jingle Jester's face: peach, tan and deep.
  L.SKIN = {
    peach: ['#6A2A1C', '#94442E', '#C06446', '#DE845C', '#F2A272', '#FCC090', '#FFDDB8'],
    tan: ['#4A1E12', '#6E3220', '#93492C', '#B4633A', '#CF7F4E', '#E49D66', '#F3BC86'],
    deep: ['#2A1009', '#421A0F', '#5C2717', '#783622', '#94482D', '#AE5E3C', '#C67A52'],
  };
  L.fig = () => new kit.Bmp(W, W);
  /** Shade a mask with a ramp and lay it on f. */
  L.paint = (f, mask, ramp, o = {}, dx = 0, dy = 0) => f.blit(kit.emboss(mask, ramp, o), dx, dy);
  /** A shaded part with its own ink rim, so it parts from what it overlaps. */
  L.part = (f, mask, ramp, o = {}, dx = 0, dy = 0) => { const p = kit.emboss(mask, ramp, o); p.outline(C.edge); f.blit(p, dx, dy); return p; };
  /** A copy of b with a 1-px ink rim (b grows by 2). */
  L.ink = (b) => { const o = new kit.Bmp(b.w + 2, b.h + 2); o.blit(b, 1, 1); o.outline(C.edge); return o; };
  /** Lean a bitmap by stepping its rows: s > 0 leans the top right, s < 0 the top left. */
  L.shear = (b, s) => {
    const ext = Math.ceil(Math.abs(s) * (b.h - 1)), o = new kit.Bmp(b.w + ext, b.h);
    for (let y = 0; y < b.h; y++) { const off = s >= 0 ? Math.round((b.h - 1 - y) * s) : Math.round(y * -s); for (let x = 0; x < b.w; x++) { const c = b.get(x, y); if (c) o.set(x + off, y, c); } }
    return o;
  };
  /** A small cream playing card w x h, lit top-left, its corners cut, a 5-px pip in the middle (o.pip), leaned by
      o.shear, with its ink rim: returns (w + 2 + lean) x (h + 2). o.face/hi/shade recolour it (a Tarot back). */
  L.card = (w, h, o = {}) => {
    const face = o.face || C.cream, hi = o.hi || C.white, sh = o.shade || C.cream3;
    let c = new kit.Bmp(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;
      c.set(i, j, i === w - 1 || j === h - 1 ? sh : i === 0 || j === 0 ? hi : face);
    }
    if (o.draw) o.draw(c);
    const s = o.shear || 0;
    if (s) c = L.shear(c, s);
    if (o.pip) {
      const p = kit.pipBmp(o.pip, o.pipSize || 5), py = Math.floor((h - p.h) / 2) + (o.py || 0);
      const off = s >= 0 ? Math.round((h - 1 - (py + 2)) * s) : Math.round((py + 2) * -s);
      c.blit(p, Math.floor((w - p.w) / 2) + off + (o.px || 0), py);
    }
    return o.ink === false ? c : L.ink(c);
  };
  /** A rank glyph from the Ember digit face (S, 5 x 7) as a mask. */
  L.glyph = (ch) => { const g = kit.FONTS.S.g[ch]; return kit.Mask.fn(g[0].length, g.length, (x, y) => g[y][x]); };
  /** Stamp a mask in one colour. */
  L.fill = (f, mask, col, dx = 0, dy = 0) => { for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) if (mask.get(x, y)) f.set(x + dx, y + dy, col); return f; };
  /** A coin seen face-on: flat money yellow with one amber rim and a glint (never a gold ramp). */
  L.coin = (w = 5, h = 5) => {
    const m = kit.ellipse(w, h, (w - 1) / 2, (h - 1) / 2, w / 2 - 0.1, h / 2 - 0.1), b = new kit.Bmp(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m.get(x, y)) {
      const edge = !m.get(x + 1, y) || !m.get(x, y + 1);
      b.set(x, y, edge ? R.money[3] : R.money[5]);
    }
    b.set(Math.floor(w / 2) - 1, 1, R.money[8]);
    return b;
  };
  /** A coin seen edge-on in a stack: rows of yellow with amber between. */
  L.coinStack = (w, n) => { const b = new kit.Bmp(w, n * 2); for (let i = 0; i < n; i++) { b.rect(0, i * 2, w, 1, R.money[5]); b.rect(0, i * 2 + 1, w, 1, R.money[3]); b.set(0, i * 2, R.money[7]); } return b; };
  /** A golden jingle bell about 4 px round, with its slit. */
  L.bell = (f, x, y) => { f.blit(kit.emboss(kit.disc(1.6), R.gold, { cap: 1.5, base: 4, gain: 4.4 }), x, y); f.set(x + 1, y + 3, C.edge); f.set(x + 2, y + 3, C.edge); return f; };
  /** A plus-shaped spark (5 x 5): a white heart, money-yellow arms. */
  L.spark = (b, x, y, ox = 0, oy = 0, big = true) => {
    const s = (dx, dy, c) => b.set(ox + x + dx, oy + y + dy, c);
    s(0, 0, C.white); s(-1, 0, R.money[6]); s(1, 0, R.money[6]); s(0, -1, R.money[6]); s(0, 1, R.money[6]);
    if (big) { s(-2, 0, R.money[4]); s(2, 0, R.money[4]); s(0, -2, R.money[4]); s(0, 2, R.money[4]); }
  };
  /** Light laid over the art window after the figure is inked, only where the figure is empty: fn(x, y) -> colour
      (#RRGGBB or #RRGGBBAA, mixed over the ground) or null. fig is the inked figure. */
  L.glowOver = (b, fig, fn) => {
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (fig && fig.get(x, y)) continue;
      const c = fn(x, y);
      if (c) b.mix(5 + x, 7 + y, c);
    }
  };
  /** A two-point jester cap: a dome whose brim sits on y = by round x = cx, two points rising and flopping over
      outward, a bell hanging from each tip. s scales it (1 is 13 wide); lr are the two points' ramps, band the
      dome's (default the left ramp). Each part is inked so the points part from the dome. */
  L.cap2 = (f, cx, by, s = 1, lr = [R.pink, R.lime], band = null) => {
    const { Mask, strokeQuad } = kit;
    const pt = (dir) => strokeQuad(W, W, [cx + dir * 2 * s, by - 2 * s], [cx + dir * 5 * s, by - 9 * s], [cx + dir * 9 * s, by - 5 * s], (t) => (3.2 - t * 1.6) * Math.max(0.8, s));
    L.part(f, pt(-1), lr[0], { cap: 1.4, base: lr[0].length - 4, gain: 3.4 });
    L.part(f, pt(1), lr[1], { cap: 1.4, base: lr[1].length - 4, gain: 3.4 });
    const dome = Mask.fn(W, W, (x, y) => y >= by - 3 * s && y <= by && Math.hypot((x - cx) / (4.4 * s), (y - by - 0.5) / (3.6 * s)) <= 1);
    const br = band || lr[0];
    L.part(f, dome, br, { cap: 1.4, base: br.length - 4, gain: 3.4 });
    L.bell(f, Math.round(cx - 11 * s), Math.round(by - 5 * s)); L.bell(f, Math.round(cx + 7 * s), Math.round(by - 5 * s));
    return f;
  };
  /** A stepped halo laid over the ground round a light, never over the figure: solid ramp colours (no alpha),
      rings[i] = [radius, colour], innermost first; sy squashes it vertically. */
  L.halo = (b, fig, cx, cy, rings, sy = 1) => L.glowOver(b, fig, (x, y) => { const d = Math.hypot(x - cx, (y - cy) * sy); const r = rings.find(([rad]) => d <= rad); return r ? r[1] : null; });
  /** Keep the last drawn figure for an overlay (the core inks it in place before overlay runs). */
  L.keep = (spec) => { const draw = spec.draw; let last = null; spec.draw = (k, ctx) => (last = draw.call(spec, k, ctx)); spec.fig = () => last; return spec; };
  const keep = L.keep;

  // ------------------------------------------------------------ 1. Carpetbag: a bulging carpetbag in a maroon carpet weave
  // with a row of ember-and-gold paisley teardrops and lime border stripes, a brass frame mouth and two handles, far
  // too many cards fanned up out of it, a jester's curly pink slipper poking out of a side seam; ember-orange ground
  A.joker('carpetbag', {
    rarity: 'uncommon',
    ground: ['#A23A12', '#B44618', '#C5531E', '#D46026'], glow: [15, 12, 13], speck: [R.money[6], R.ember[7], R.cream[6]],
    draw(k) {
      const { Mask, strokeQuad } = k, f = L.fig();
      // the back handle, then the cards fanned up out of the mouth between the handles
      L.part(f, Mask.fn(W, W, (x, y) => { const d = Math.hypot((x - 15) / 7.4, (y - 12) / 8); return d <= 1 && d >= 1 - 2.2 / 8 && y <= 11; }), R.wood.slice(0, 5), { cap: 1, base: 3, gain: 3 });
      [[5, 1, 'S', -0.44], [9, -1, 'H', -0.2], [13, -2, 'C', 0.04], [17, 0, 'D', 0.3]].forEach(([x, y, s, sh]) => f.blit(L.card(7, 10, { pip: s, shear: sh, py: -2 }), x, y));
      // the bag: a doctor's-bag shape, a hinged frame top and a flat base, bulging at the sides
      const bag = Mask.fn(W, W, (x, y) => y >= 13 && y <= 29 && Math.abs(x - 15) <= 10 + Math.sin(((y - 13) / 16) * Math.PI) * 2.2 - (y === 29 ? 1 : 0));
      const body = kit.emboss(bag, R.maroon.slice(1), { cap: 4, base: 3, gain: 3.4 });
      // the carpet weave: maroon bands, lime border stripes, a row of ember-and-gold paisley teardrops with curled tips
      const lit = (x, y) => R.maroon.indexOf(body.get(x, y));
      for (let y = 13; y <= 29; y++) for (let x = 0; x < W; x++) if (bag.get(x, y)) {
        const l = lit(x, y);
        if (y === 16 || y === 26) body.set(x, y, l >= 4 ? R.lime[6] : R.lime[4]);
        else if (y === 15 || y === 27) body.set(x, y, R.maroon[Math.max(1, l - 1)]);
        else if ((x + y * 2) % 4 === 0 && y > 16 && y < 26) body.set(x, y, R.maroon[Math.max(1, l - 1)]);
      }
      const tear = ['..E', '.gG', 'gGg', '.g.'];
      [5, 10, 15, 20, 25].forEach((x, i) => body.draw(tear, x - 1, 19 + (i % 2), { g: i % 2 ? R.gold[5] : R.ember[5], G: i % 2 ? R.gold[3] : R.ember[3], E: R.money[6] }));
      body.outline(C.edge); f.blit(body, 0, 0);
      // the brass frame along the mouth, hinged at each end, and two handle arcs over it
      L.part(f, Mask.fn(W, W, (x, y) => y >= 12 && y <= 13 && x >= 4 && x <= 26), R.brass, { cap: 1, base: 4, gain: 3 });
      [[4, 12], [25, 12]].forEach(([x, y]) => L.part(f, Mask.rows(['xx', 'xx']), R.gold, { cap: 1, base: 4, gain: 3 }, x, y));
      const handle = (cx, ry) => Mask.fn(W, W, (x, y) => { const d = Math.hypot((x - cx) / 7.4, (y - 12) / ry); return d <= 1 && d >= 1 - 2.2 / ry && y <= 11; });
      L.part(f, handle(15, 6), R.wood, { cap: 1, base: 4, gain: 3 });
      // the curly slipper poking out of the side seam: a lime cuff, a pink toe curling up, a bell on its tip
      L.part(f, Mask.fn(W, W, (x, y) => x >= 24 && x <= 26 && y >= 19 && y <= 23), R.lime, { cap: 1, base: 5, gain: 3 });
      const toe = strokeQuad(W, W, [26, 21.5], [31, 22.5], [29.5, 17], (t) => 4.4 - t * 3);
      L.part(f, toe, R.pink, { cap: 1.6, base: 5, gain: 3.6 });
      L.bell(f, 27, 13);
      return f;
    },
  });

  // ------------------------------------------------------------ 2. Helping Hand: a jester's hand, in a lime sleeve from the
  // bottom edge, holding a fan of three cards, and a helper's pink kid glove with a ruff cuff reaching down from the
  // upper right to slot a fourth card, a cream-bordered Tarot with its gold sun-eye, into the fan; violet ground
  A.joker('helpinghand', keep({
    rarity: 'uncommon',
    ground: ['#3A1C86', '#44229A', '#4F29AE', '#5B30C4'], glow: [16, 13, 12], speck: [R.vio[7], R.money[7]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      const SK = L.SKIN.peach;
      // the jester's sleeve, in from the bottom edge, and a pink ruff at the wrist
      L.part(f, strokeQuad(W, W, [9, 33], [9, 28], [10.5, 24], 7), R.lime, { cap: 2.4, base: 5, gain: 3.4 });
      // the fan: three cards spreading from one grip, and the Tarot slotted in as the fourth
      f.blit(L.card(8, 12, { pip: 'S', shear: -0.45 }), 1, 8);
      f.blit(L.card(8, 12, { pip: 'H', shear: -0.15 }), 6, 6);
      f.blit(L.card(8, 12, { pip: 'C', shear: 0.15 }), 11, 6);
      const tarot = L.card(8, 12, {
        face: R.vio[4], hi: C.cream, shade: R.cream[4], shear: 0.45,
        draw: (c) => {
          for (let y = 1; y < 11; y++) { c.set(1, y, R.cream[6]); c.set(6, y, R.cream[4]); } for (let x = 1; x < 7; x++) { c.set(x, 1, R.cream[6]); c.set(x, 10, R.cream[4]); }
          c.draw(['.yy.', 'yYYy', 'yYky', '.yy.'], 2, 4, { y: R.gold[4], Y: R.gold[6], k: C.edge });
          c.set(3, 3, R.gold[5]); c.set(4, 3, R.gold[5]); c.set(3, 8, R.gold[3]); c.set(4, 8, R.gold[3]);
        },
      });
      f.blit(tarot, 15, 7);
      // the jester's hand gripping the fan: a pink ruff cuff, the palm, a thumb across the front
      L.part(f, Mask.fn(W, W, (x, y) => y >= 22 && y <= 26 && [6.5, 10, 13.5].some((c) => (x - c) ** 2 + (y - 24.5) ** 2 <= 3.4)), R.pink, { cap: 1.4, base: 5, gain: 3.4 });
      L.part(f, ellipse(W, W, 11, 19.5, 4.2, 3), SK, { cap: 2, base: 4, gain: 4 });
      L.part(f, strokeQuad(W, W, [8, 19], [9.5, 16.5], [12, 15.5], 2.4), SK, { cap: 1, base: 5, gain: 3 });
      // the helper's pink kid glove from the upper right: a ruff cuff, the hand, thumb and finger pinching the Tarot
      L.part(f, strokeQuad(W, W, [33, -2], [30, 1], [27, 4], 6), R.chips, { cap: 2, base: 5, gain: 3 });
      L.part(f, Mask.fn(W, W, (x, y) => Math.hypot(x - 26.5, y - 5) <= 3 + ((Math.round(Math.atan2(y - 5, x - 26.5) * 2.5) % 2) ? 0.6 : 0)), R.cream, { cap: 1.4, base: 5, gain: 3 });
      const glove = ellipse(W, W, 23.5, 7.5, 3.4, 3);
      glove.or(strokeQuad(W, W, [21.5, 6.5], [19.5, 7.5], [19.5, 11], 2.4));
      glove.or(strokeQuad(W, W, [23.5, 9.5], [23, 11], [23, 12.5], 2.4));
      L.part(f, glove, R.pink, { cap: 1.6, base: 5, gain: 3.4 });
      f.set(22, 6, R.pink[7]); f.set(23, 5, R.pink[7]);
      return f;
    },
    overlay(k, b) {
      // one stepped ring of glow round the Tarot, where it shows against the ground
      L.glowOver(b, this.fig(), (x, y) => { const d = Math.hypot(Math.max(0, 16 - x, x - 29), Math.max(0, 7 - y, y - 20)); return d > 0 && d <= 1.2 ? R.vio[5] : null; });
    },
  }));

  // ------------------------------------------------------------ 3. Nesting Dolls: four stout painted jester dolls in a
  // staircase, big to tiny, in pink, lime, gold and chip blue; the biggest split open, its top half lifted, and the
  // smallest peeking out of it with a wink; maroon ground
  A.joker('nestingdolls', {
    rarity: 'uncommon',
    ground: ['#5B1A42', '#6B214C', '#7A2755', '#8B2E5F'], glow: [12, 17, 13], speck: [R.pink[6], R.money[6]],
    draw(k) {
      const { Mask } = k, f = L.fig();
      const SK = L.SKIN.peach;
      // each doll: a round head over a fat egg of a body (its own grid), a face oval [x, y, w, h] with the eyes on its
      // first rows, an apron panel [x, y, w, h] with a heart
      const DOLLS = {
        big: { rows: ['....xxxxx....', '...xxxxxxx...', '..xxxxxxxxx..', '..xxxxxxxxx..', '..xxxxxxxxx..', '..xxxxxxxxx..', '...xxxxxxx...', '...xxxxxxx...', '..xxxxxxxxx..', '.xxxxxxxxxxx.', 'xxxxxxxxxxxxx', 'xxxxxxxxxxxxx', 'xxxxxxxxxxxxx', 'xxxxxxxxxxxxx', 'xxxxxxxxxxxxx', 'xxxxxxxxxxxxx', '.xxxxxxxxxxx.', '..xxxxxxxxx..'], face: [4, 2, 5, 4], apron: [4, 13, 5, 4] },
        mid: { rows: ['...xxxx...', '..xxxxxx..', '.xxxxxxxx.', '.xxxxxxxx.', '.xxxxxxxx.', '..xxxxxx..', '.xxxxxxxx.', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxxxxxxx', '.xxxxxxxx.', '..xxxxxx..'], face: [3, 2, 4, 3], apron: [3, 8, 4, 4] },
        small: { rows: ['..xxx..', '.xxxxx.', '.xxxxx.', '.xxxxx.', '..xxx..', '.xxxxx.', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.'], face: [2, 1, 3, 2], apron: [2, 6, 3, 3] },
        tiny: { rows: ['.xxxx.', 'xxxxxx', 'xxxxxx', '.xxxx.', 'xxxxxx', 'xxxxxx', '.xxxx.'], face: [1, 1, 4, 2] },
      };
      const doll = (kind, ramp, wink) => {
        const D = DOLLS[kind], m = Mask.rows(D.rows), w = m.w, h = m.h;
        const d = kit.emboss(m, ramp, { cap: 2.6, base: ramp.length - 4, gain: 3.6 });
        const [fx, fy, fw, fh] = D.face;
        for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) { if (fw > 3 && fh > 2 && (x === fx || x === fx + fw - 1) && (y === fy || y === fy + fh - 1)) continue; d.set(x, y, x < fx + fw / 2 ? SK[6] : SK[5]); }
        const ey = fy + (fh > 3 ? 1 : 0), el = fx + (fw > 4 ? 1 : 0), er = fx + fw - 1 - (fw > 4 ? 1 : 0);
        d.set(el, ey, C.edge);
        if (wink) { d.set(er, ey, C.edge); d.set(er - 1, ey, C.edge); } else d.set(er, ey, C.edge);
        d.set(fx, fy + fh - 1, R.pink[6]); d.set(fx + fw - 1, fy + fh - 1, R.pink[6]);
        if (fh > 3) d.set(fx + 2, fy + 3, R.mult[4]);
        if (D.apron) {
          const [ax, ay, aw, ah] = D.apron;
          for (let y = ay; y < ay + ah; y++) for (let x = ax; x < ax + aw; x++) d.set(x, y, y === ay || x === ax ? R.cream[7] : R.cream[5]);
          if (aw >= 5) d.draw(['hh.hh', 'hhhhh', '.hhh.'], ax, ay + 1, { h: R.red[3] });
          else if (aw >= 4) d.draw(['h..h', 'hhhh', '.hh.'], ax, ay + 1, { h: R.red[3] });
          else d.draw(['h.h', '.h.'], ax, ay + 1, { h: R.red[3] });
        }
        // the bell on the crown
        const o = new kit.Bmp(w, h + 2); o.blit(d, 0, 2);
        const bx = Math.floor((w - 1) / 2);
        o.set(bx, 1, R.gold[5]); o.set(bx + 1, 1, R.gold[3]);
        if (w >= 9) { o.set(bx, 0, R.gold[6]); o.set(bx + 1, 0, R.gold[4]); }
        return o;
      };
      const put = (d, x, y) => f.blit(L.ink(d), x - 1, y - 1);
      // the gold and lime dolls, stepping down to the right
      put(doll('small', R.gold), 23, 19);
      put(doll('mid', R.lime), 13, 15);
      // the biggest, pink, split at the waist: the smallest (chip blue) standing inside the bottom half, winking up out
      // of it, the top half lifted clear
      const big = doll('big', R.pink), CUT = 14, LIFT = 6;
      put(doll('tiny', R.chips, true), 3, 18);
      const bot = new kit.Bmp(big.w, big.h - CUT), top = new kit.Bmp(big.w, CUT);
      bot.blit(big, 0, -CUT); top.blit(big, 0, 0);
      for (let x = 0; x < big.w; x++) { if (bot.get(x, 0)) bot.set(x, 0, R.wood[5]); if (top.get(x, CUT - 1)) top.set(x, CUT - 1, R.wood[4]); }
      put(bot, 0, 11 + CUT);
      put(top, 0, 11 - LIFT);
      return f;
    },
  });

  // ------------------------------------------------------------ 4. Makeover: a startled cream card being powdered by a
  // stylist's puff before a round dressing-room mirror, warm bulbs of uneven brightness along its upper arc; soft round
  // puffs of pink powder rising from the puff; plum ground
  A.joker('makeover', {
    rarity: 'uncommon',
    ground: ['#52204E', '#60275C', '#6E2E6A', '#7D3579'], glow: [19, 11, 12], speck: [R.pink[7], R.cream[6]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      // the mirror: a brass ring round pale glass with a glint, pulled in clear of the window's edges
      const MX = 19.5, MY = 11;
      L.paint(f, Mask.fn(W, W, (x, y) => Math.hypot(x - MX, y - MY) <= 6.4), R.ghost, { cap: 3, base: 4, gain: 3 });
      [[15, 10], [16, 9], [17, 8], [18, 7], [16, 12], [17, 11], [18, 10], [19, 9]].forEach(([x, y], i) => f.set(x, y, i < 4 ? R.ghost[6] : R.ghost[5]));
      L.part(f, Mask.fn(W, W, (x, y) => { const d = Math.hypot(x - MX, y - MY); return d <= 8.2 && d > 6.4; }), R.brass, { cap: 1.2, base: 4, gain: 3.4 });
      // warm bulbs on the upper arc only, of uneven brightness
      [[-150, R.money[6]], [-122, C.white], [-95, R.money[7]], [-68, R.ember[7]], [-42, C.white], [-18, R.money[6]]].forEach(([deg, c]) => {
        const a = (deg * Math.PI) / 180, x = Math.round(MX + Math.cos(a) * 9.2 - 0.5), y = Math.round(MY + Math.sin(a) * 9.2 - 0.5);
        const b = new kit.Bmp(2, 2).rect(0, 0, 2, 2, c); b.set(1, 1, c === C.white ? R.money[7] : R.money[4]);
        f.blit(L.ink(b), x - 1, y - 1);
      });
      // the card, startled: brows flung up, round eyes, an O of a mouth, powder already on one cheek
      const card = L.card(13, 17, {
        draw: (c) => {
          c.draw(['h.h', 'hhh', '.h.'], 1, 1, { h: R.red[3] });
          c.set(3, 5, C.edge); c.set(4, 4, C.edge); c.set(8, 4, C.edge); c.set(9, 5, C.edge);
          c.rect(4, 6, 1, 2, C.edge); c.rect(8, 6, 1, 2, C.edge);
          c.draw(['.k.', 'kmk', 'kmk', '.k.'], 5, 9, { k: C.edge, m: R.mult[2] });
          c.rect(9, 9, 2, 1, R.pink[6]);
        },
      });
      f.blit(card, 7, 13);
      // the stylist's forearm from the lower left: a chip-blue sleeve, a cream cuff, the hand under the puff
      L.part(f, strokeQuad(W, W, [-2, 31], [1.5, 27], [4.5, 23], 5.6), R.chips, { cap: 1.6, base: 5, gain: 3.4 });
      L.part(f, ellipse(W, W, 5, 22, 2.4, 2.2), R.cream, { cap: 1.2, base: 5, gain: 3 });
      L.part(f, ellipse(W, W, 7, 20, 2.2, 1.9), L.SKIN.tan, { cap: 1.4, base: 4, gain: 3.6 });
      // the puff: a fluffy pale pad, its edge in tufts, a ribbon loop on top, pressed to the card's cheek
      const puff = Mask.fn(W, W, (x, y) => Math.hypot(x - 9, y - 17.5) <= 3.4 + ((Math.round(Math.atan2(y - 17.5, x - 9) * 2.2) % 2) ? 0.5 : 0));
      L.part(f, puff, R.pink.slice(3), { cap: 2.4, base: 3, gain: 3.4 });
      f.draw(['.r.r', 'r.rr'], 7, 12, { r: R.mult[4] });
      // the powder: soft round puffs rising from the pad in an arc, pale pink with a white highlight each
      [[2, 10, 5, 4], [1, 5, 4, 4], [5, 1, 4, 3], [10, 3, 3, 3]].forEach(([x, y, w, h]) => {
        const m = Mask.fn(w, h, (i, j) => w < 4 || !((i === 0 || i === w - 1) && (j === 0 || j === h - 1)));
        const p = kit.emboss(m, R.pink.slice(5), { cap: 1, base: 2, gain: 2 });
        p.set(1, 1, C.white);
        f.blit(L.ink(p), x - 1, y - 1);
      });
      return f;
    },
  });

  // ------------------------------------------------------------ 5. Lucky Dip: a jester's arm in a chip-blue sleeve plunged
  // into a Joker Pack (the maroon matchbox, its striker down the side, its tray pushed up), the fist coming up out of
  // the tray with two cards at once; gold sparks; burnt-orange ground
  A.joker('luckydip', keep({
    rarity: 'uncommon',
    ground: ['#7A2A0E', '#8C3412', '#9E3E16', '#B0481A'], glow: [17, 12, 12], speck: [R.money[6], R.ember[7]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      // the tray, pushed up out of the sleeve: its back rim, the dark inside, its lit front wall
      L.part(f, Mask.fn(W, W, (x, y) => x >= 7 && x <= 22 && y >= 11 && y <= 15), R.cream.slice(1), { cap: 1, base: 4, gain: 2 });
      for (let x = 8; x <= 21; x++) { f.set(x, 11, R.cream[5]); f.set(x, 12, R.maroon[1]); }
      // the sleeve: maroon, lit down its left side, the striker strip down its right, a cream label with a cap mark
      const sl = kit.emboss(Mask.fn(W, W, (x, y) => x >= 5 && x <= 24 && y >= 15), R.maroon.slice(1), { cap: 2, base: 4, gain: 3 });
      for (let y = 15; y < W; y++) { sl.set(5, y, R.maroon[6]); sl.set(6, y, R.maroon[5]); for (let x = 21; x <= 24; x++) sl.set(x, y, x === 21 ? C.edge : (x + y) % 2 ? R.ember[3] : R.ember[4]); }
      for (let x = 5; x <= 20; x++) sl.set(x, 15, R.maroon[6]);
      sl.outline(C.edge); f.blit(sl, 0, 0);
      L.part(f, Mask.fn(W, W, (x, y) => x >= 9 && x <= 18 && y >= 18 && y <= 27), R.cream, { cap: 1.4, base: 5, gain: 2.2 });
      f.draw([
        '.pp..pp.',
        'p.pp.p.p',
        'g.pppp.g',
        '..pppp..',
        '.PPPPPP.',
      ], 10, 20, { p: R.pink[5], P: R.pink[3], g: R.gold[5] });
      for (let x = 10; x <= 17; x += 2) f.set(x, 26, R.cream[3]);
      // the arm, plunged in from the upper left: a plain chip-blue sleeve and a pink ruff at the cuff
      L.part(f, strokeQuad(W, W, [-3, -3], [3, 2], [10, 9], 6.6), R.chips, { cap: 2.4, base: 5, gain: 3.4 });
      L.part(f, Mask.fn(W, W, (x, y) => Math.hypot(x - 11, y - 10) <= 3.4 + ((Math.round(Math.atan2(y - 10, x - 11) * 2.5) % 2) ? 0.6 : 0)), R.pink, { cap: 1.6, base: 5, gain: 3.4 });
      // the two cards, fanned apart, and the fist gripping them as it comes up out of the tray
      f.blit(L.card(7, 10, { pip: 'H', shear: -0.3 }), 12, 0);
      f.blit(L.card(7, 10, { pip: 'D', shear: 0.3 }), 17, 1);
      L.part(f, ellipse(W, W, 16, 11.5, 3.2, 2.6), L.SKIN.peach, { cap: 2, base: 4, gain: 4 });
      [[14, 10], [16, 10], [18, 11]].forEach(([x, y]) => f.set(x, y, L.SKIN.peach[2]));
      f.set(15, 10, L.SKIN.peach[6]); f.set(17, 10, L.SKIN.peach[6]);
      return f;
    },
    overlay(k, b) {
      // gold sparks flying round the cards, un-inked so they read as light
      [[9, 3, 1], [28, 6, 1], [26, 14, 0], [4, 13, 0], [22, 0, 0]].forEach(([x, y, big]) => L.spark(b, x, y, 5, 7, !!big));
    },
  }));

  // ------------------------------------------------------------ 6. Big Spender: a beaming jester in a gold-trimmed maroon
  // coat, both hands full of paper shopping bags (pink, lime, chip blue), a hat box at his feet, a price tag dangling,
  // a long cream receipt unspooling from his hand to the floor; plum ground
  A.joker('bigspender', {
    rarity: 'uncommon',
    ground: ['#4F2059', '#5C2866', '#6A3074', '#783882'], glow: [15, 12, 12], speck: [R.money[6], R.pink[6]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      const SK = L.SKIN.peach, COAT = R.maroon.slice(2);
      // the coat: the lit end of maroon, gold-trimmed lapels, a cream shirt front
      const ct = kit.emboss(Mask.fn(W, W, (x, y) => y >= 13 && y <= 30 && Math.abs(x - 15) <= 4.4 + (y - 13) * 0.3), COAT, { cap: 2.6, base: 3, gain: 3.4 });
      for (let y = 14; y <= 30; y++) { const w = Math.min(2, Math.floor((y - 13) * 0.4)); for (let x = 15 - w; x <= 15 + w; x++) ct.set(x, y, x === 15 - w || x === 15 + w ? R.gold[5] : R.cream[6]); }
      ct.outline(C.edge); f.blit(ct, 0, 0);
      // the head, beaming, and a two-point jester cap in pink and lime
      L.part(f, ellipse(W, W, 15, 9, 4.6, 4.4), SK, { cap: 3, base: 4, gain: 4.2 });
      L.cap2(f, 15, 5.5, 0.82, [R.pink, R.lime]);
      [[12, 8], [13, 7], [14, 8], [16, 8], [17, 7], [18, 8]].forEach(([x, y]) => f.set(x, y, C.edge));
      f.draw(['k....k', '.kWWk.', '..kk..'], 12, 10, { k: C.edge, W: C.white });
      f.set(11, 10, R.pink[5]); f.set(19, 10, R.pink[5]);
      // the arms out to each side, a hand on each bag's cords
      L.part(f, strokeQuad(W, W, [11, 15.5], [8, 15.5], [6.5, 17], 3), COAT, { cap: 1.4, base: 3, gain: 3 });
      L.part(f, strokeQuad(W, W, [19, 15.5], [21.5, 15], [23, 13.5], 3), COAT, { cap: 1.4, base: 3, gain: 3 });
      // the bags: paper with a folded top and cord handles
      const bag = (x, y, w, h, ramp) => {
        L.part(f, Mask.fn(W, W, (xx, yy) => Math.abs(Math.hypot(xx - (x + w / 2 - 0.5), (yy - y) * 1.3) - 2.4) < 0.75 && yy < y), R.cream.slice(2), { cap: 1, base: 3, gain: 2 });
        L.part(f, Mask.fn(W, W, (xx, yy) => xx >= x && xx < x + w && yy >= y && yy < y + h), ramp, { cap: 1.6, base: ramp.length - 4, gain: 3 });
        for (let xx = x; xx < x + w; xx++) f.set(xx, y + 1, ramp[ramp.length - 2]);
      };
      bag(0, 23, 8, 8, R.chips);
      bag(3, 19, 8, 9, R.pink);
      bag(19, 17, 8, 9, R.lime);
      L.part(f, ellipse(W, W, 6.5, 17, 1.6, 1.4), SK, { cap: 1, base: 4, gain: 3 });
      L.part(f, ellipse(W, W, 23, 14, 1.6, 1.4), SK, { cap: 1, base: 4, gain: 3 });
      // a price tag dangling from the pink bag's cord
      f.set(4, 16, R.cream[3]); f.set(3, 17, R.cream[3]);
      L.part(f, Mask.rows(['.xx', 'xxx', 'xxx']), R.cream, { cap: 1, base: 6, gain: 2 }, 0, 17);
      f.set(1, 19, R.mult[4]);
      // the hat box at his feet: a round box with a lid and a pink ribbon
      L.part(f, Mask.fn(W, W, (x, y) => y >= 26 && y <= 30 && x >= 11 && x <= 19), R.cream.slice(2), { cap: 1.6, base: 4, gain: 3 });
      L.part(f, Mask.fn(W, W, (x, y) => y === 25 && x >= 10 && x <= 20), R.cream.slice(2), { cap: 1, base: 4, gain: 2 });
      for (let y = 25; y <= 30; y++) f.set(15, y, R.pink[5]);
      f.draw(['p.p', '.p.'], 14, 23, { p: R.pink[5] });
      // the receipt: a 4-px cream strip unspooling from his right hand down to the floor, printed in dashes, torn off
      const rc = (y) => 26 + Math.round(Math.sin((y - 15) / 2.8) * 1.2);
      const rcp = Mask.fn(W, W, (x, y) => y >= 15 && y <= 30 && x >= rc(y) && x <= rc(y) + 3);
      const rb = kit.emboss(rcp, R.cream, { cap: 1, base: 6, gain: 1.6 });
      for (let y = 17; y <= 29; y += 2) { rb.set(rc(y) + 1, y, R.cream[3]); rb.set(rc(y) + 2, y, R.cream[3]); }
      rb.del(rc(30), 30); rb.del(rc(30) + 2, 30);
      rb.outline(C.edge); f.blit(rb, 0, 0);
      L.part(f, ellipse(W, W, 24.5, 14.5, 1.6, 1.4), SK, { cap: 1, base: 4, gain: 3 });
      return f;
    },
  });

  // ------------------------------------------------------------ 7. Nail-Biter: a jester in a mult-red hood behind the last
  // card of his hand, one hand gripping it and the other up at his mouth, two fingertips between his clenched teeth;
  // brows pinched up, pinpoint eyes glancing down at the card, a drop of sweat at his temple; maroon ground
  A.joker('nailbiter', {
    rarity: 'uncommon',
    ground: ['#631729', '#721D32', '#82243B', '#932B44'], glow: [15, 10, 12], speck: [R.ghost[5], R.mult[6]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      const SK = L.SKIN.tan;
      // shoulders in a lime tunic, then the hood with one drooping point and a bell
      L.part(f, Mask.fn(W, W, (x, y) => y >= 19 && Math.abs(x - 15) <= 9 + (y - 19) * 1.2), R.lime, { cap: 2.4, base: 4, gain: 3.4 });
      const hood = ellipse(W, W, 15, 9.5, 8.8, 9.2);
      hood.or(strokeQuad(W, W, [9, 3], [1, 2], [2, 12], (t) => 4.8 - t * 2.8));
      L.part(f, hood, R.mult, { cap: 2.4, base: 5, gain: 3.6 });
      L.bell(f, 0, 11);
      // the face: brows pinched up in the middle, wide eyes with pinpoint pupils glancing down, clenched teeth
      L.part(f, ellipse(W, W, 15, 10, 6.4, 6.2), SK, { cap: 3, base: 4, gain: 4 });
      [[10, 7, 11], [17, 7, 18]].forEach(([x, y, p]) => { f.rect(x, y, 3, 3, C.white); f.set(p, y + 2, C.edge); f.set(x + 2, y + 2, R.ghost[5]); });
      f.set(10, 5, SK[0]); f.set(11, 4, SK[0]); f.set(19, 5, SK[0]); f.set(18, 4, SK[0]);
      f.draw(['.kkkkkkk.', 'kWkWkWkWk', '.kkkkkkk.'], 11, 12, { k: C.edge, W: C.white });
      // the last card, front and centre, its bottom running out of the window, gripped along its top edge
      f.blit(L.card(13, 15, { pip: 'S', pipSize: 7, py: 1 }), 6, 17);
      [[7, 16], [9, 16], [11, 16]].forEach(([x, y]) => { L.part(f, Mask.fn(2, 4, () => true), SK.slice(1), { cap: 1, base: 3, gain: 2.4 }, x, y); f.set(x, y, SK[6]); f.set(x + 1, y, SK[5]); });
      // the other hand up at his mouth: the arm from the lower right, a fist, two fingertips between his teeth
      L.part(f, strokeQuad(W, W, [27, 31], [24, 23], [19.5, 18.5], 4), R.lime, { cap: 1.6, base: 4, gain: 3.2 });
      L.part(f, ellipse(W, W, 17.5, 17, 3, 2.4), SK, { cap: 1.6, base: 4, gain: 3.4 });
      L.part(f, Mask.fn(W, W, (x, y) => (x === 15 || x === 16) && y >= 13 && y <= 15), SK, { cap: 1, base: 4, gain: 2 });
      f.set(15, 13, SK[6]); f.set(16, 13, SK[5]);
      // a drop of sweat at his temple
      f.draw(['.d.', 'dDd', 'dWd', '.d.'], 21, 5, { d: R.ghost[3], D: R.ghost[5], W: R.ghost[6] });
      return f;
    },
  });

  // ------------------------------------------------------------ 8. Smooth Talker: a silver-tongued jester leaning in to
  // whisper to a grumpy violet boss blob; a little pink heart floats up between them; plum ground
  A.joker('smoothtalker', {
    rarity: 'uncommon',
    ground: ['#4A225F', '#57296D', '#65307B', '#74378A'], glow: [16, 15, 13], speck: [R.pink[6], R.acid[4]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      // the boss blob, lumpy and heavy
      const blob = Mask.fn(W, W, (x, y) => y <= 29 && (Math.hypot(x - 23, y - 20) <= 8.2 || Math.hypot(x - 26.5, y - 13) <= 4.4 || Math.hypot(x - 19.5, y - 14) <= 4.2 || Math.hypot(x - 23.5, y - 11) <= 4.2));
      L.part(f, blob, R.vio, { cap: 3.4, base: 4, gain: 4.4 });
      // grumpy: heavy lids over acid eyes glancing at the jester, brows down, a sagging mouth
      [[19, 17], [25, 17]].forEach(([x, y]) => { f.rect(x, y, 3, 1, R.vio[1]); f.rect(x, y + 1, 3, 1, R.acid[4]); f.set(x, y + 1, R.acid[1]); });
      [[18, 15], [19, 15], [20, 16], [26, 16], [27, 15], [28, 15]].forEach(([x, y]) => f.set(x, y, R.vio[1]));
      [[20, 24], [21, 23], [22, 23], [23, 23], [24, 23], [25, 24]].forEach(([x, y]) => f.set(x, y, R.vio[0]));
      // the jester: chip-blue shoulders under a cream ruff, a lean profile, a pink cap swept back with a bell
      L.part(f, Mask.fn(W, W, (x, y) => y >= 22 && x <= 12 && Math.abs(x - 6) <= 3 + (y - 22) * 0.9), R.chips, { cap: 2, base: 5, gain: 3.4 });
      L.part(f, Mask.fn(W, W, (x, y) => y >= 18 && y <= 22 && [4, 7.5, 11].some((c) => (x - c) ** 2 + (y - 20) ** 2 <= 3.6)), R.cream, { cap: 1.4, base: 5, gain: 3 });
      const SK = L.SKIN.peach;
      const head = new kit.Bmp(13, 10);
      head.draw([
        '..hhhhhh.....',
        '.hhhhsssss...',
        '.hhsssssbbs..',
        '.Shssssskks..',
        '.SShsssssssn.',
        '.SSssssssssnN',
        '..SSsssssssm.',
        '..SSSssmmmm..',
        '...SSSSsss...',
        '.....SSSS....',
      ], 0, 0, { h: SK[5], s: SK[4], S: SK[2], b: SK[1], k: C.edge, n: SK[5], N: SK[3], m: C.edge });
      head.set(9, 4, SK[2]);
      f.blit(L.ink(head), 2, 8);
      const cap = Mask.fn(W, W, (x, y) => y >= 7 && y <= 11 && x >= 3 && x <= 13 && Math.hypot((x - 8.5) / 5.4, (y - 11.5) / 4) <= 1);
      cap.or(strokeQuad(W, W, [6, 9], [1, 7], [1, 1.5], (t) => 4 - t * 2.2));
      L.part(f, cap, R.pink, { cap: 1.8, base: 5, gain: 3.6 });
      L.bell(f, 0, 0);
      // an ear, and the hand cupped beside his mouth
      f.set(5, 13, SK[2]); f.set(5, 14, SK[1]);
      L.part(f, Mask.rows(['xx.', 'xxx', 'xxx', '.xx']), SK, { cap: 1.2, base: 4, gain: 3 }, 16, 15);
      // a little heart rising between them
      L.part(f, Mask.rows(['XX.XX', 'XXXXX', 'XXXXX', '.XXX.', '..X..']), R.pink, { cap: 1.4, base: 5, gain: 4 }, 13, 3);
      return f;
    },
  });

  // ------------------------------------------------------------ 9. Coronation: a Jack card bowed on one knee, eyes shut,
  // while a taller Queen card holds a gold crown over his head in both hands; a mult-red runner with a gold edge
  // narrowing toward the back, its end rolled up at the left; violet ground
  A.joker('coronation', keep({
    rarity: 'uncommon',
    ground: ['#43197F', '#4F1F91', '#5C25A4', '#692CB9'], glow: [11, 10, 11], speck: [R.money[7], R.vio[7]],
    draw(k) {
      const { Mask, strokeQuad } = k, f = L.fig();
      // the runner: a red strip narrowing toward the back, a gold edge, its end rolled up at the left
      const rn = kit.emboss(Mask.fn(W, W, (x, y) => x >= 3 && y >= 26 && y <= 29 - (x > 16 ? 1 : 0) - (x > 25 ? 1 : 0)), R.mult, { cap: 1.4, base: 4, gain: 3 });
      for (let x = 3; x < W; x++) rn.set(x, 26, R.gold[4]);
      rn.outline(C.edge); f.blit(rn, 0, 0);
      L.part(f, Mask.fn(W, W, (x, y) => Math.hypot(x - 2, y - 27.5) <= 2.6), R.mult, { cap: 1.4, base: 4, gain: 3 });
      f.set(2, 27, R.mult[2]); f.set(2, 28, R.mult[1]); f.set(1, 26, R.gold[5]);
      const face = (c, x, y, shut) => { if (shut) { c.draw(['k.k'], x, y, { k: C.edge }); } else { c.set(x, y, C.edge); c.set(x + 2, y, C.edge); } c.set(x + 1, y + 2, R.mult[3]); };
      const glyph = (c, ch, ramp, x, y) => { const g = L.glyph(ch); for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) if (g.get(i, j)) c.set(x + i, y + j, j < 2 ? ramp[4] : ramp[3]); };
      // the Jack: bowed forward onto one knee, a cream fold at his foot, a small solemn face with its eyes shut
      const jack = L.card(9, 12, { ink: false, draw: (c) => { glyph(c, 'J', R.dark, 1, 1); c.blit(kit.pipBmp('S', 5), 3, 7); face(c, 5, 2, true); } });
      // bend it at the waist: the lower half upright on its knee, the upper half bowed forward
      const jk = new kit.Bmp(jack.w + 6, jack.h + 1);
      for (let y = 0; y < jack.h; y++) { const off = y < 7 ? Math.round((7 - y) * 0.62) : 0; for (let x = 0; x < jack.w; x++) { const c = jack.get(x, y); if (c) jk.set(x + off, y, c); } }
      jk.draw(['ccccc', 'CCCCc'], jack.w - 1, jack.h - 2, { c: C.cream, C: C.cream3 });
      f.blit(L.ink(jk), 2, 13);
      // the Queen: taller, upright, a face, two cream arms reaching over him to hold the crown
      f.blit(L.card(10, 18, { draw: (c) => { glyph(c, 'Q', R.red, 1, 1); c.blit(kit.pipBmp('H', 5), 3, 11); face(c, 5, 4, false); c.set(4, 5, R.pink[6]); c.set(8, 5, R.pink[6]); } }), 18, 7);
      L.part(f, strokeQuad(W, W, [19, 12], [16.5, 8.5], [14.5, 8], 2), R.cream.slice(1), { cap: 1, base: 5, gain: 2.4 });
      L.part(f, strokeQuad(W, W, [19, 15], [13.5, 11.5], [8, 8.5], 2), R.cream.slice(1), { cap: 1, base: 5, gain: 2.4 });
      // the crown: five points with gems, held over the Jack's head
      const crown = Mask.rows(['x.x.x.x.x', 'xxxxxxxxx', 'xxxxxxxxx', 'xxxxxxxxx']);
      const cr = kit.emboss(crown, R.gold, { cap: 1.6, base: 4, gain: 4 });
      cr.set(2, 2, R.pink[5]); cr.set(4, 2, R.chips[6]); cr.set(6, 2, R.pink[5]); [0, 4, 8].forEach((x) => cr.set(x, 0, R.gold[6]));
      f.blit(L.ink(cr), 6, 4);
      L.part(f, Mask.rows(['xx', 'xx']), L.SKIN.peach, { cap: 1, base: 4, gain: 3 }, 6, 8);
      L.part(f, Mask.rows(['xx', 'xx']), L.SKIN.peach, { cap: 1, base: 4, gain: 3 }, 14, 7);
      return f;
    },
    overlay(k, b) {
      // a glint of gold round the crown
      [[4, 3], [17, 4], [10, 1]].forEach(([x, y]) => L.spark(b, x, y, 5, 7, false));
    },
  }));

  // ------------------------------------------------------------ 10. Usher: a jester usher in a violet jacket, his cap a
  // ticket folded into two points with a perforated edge and a torn corner, a lit taper held low before him to light
  // the aisle, three half-torn stubs held out toward us in his other hand; maroon ground
  A.joker('usher', keep({
    rarity: 'uncommon',
    ground: ['#621830', '#701E38', '#802541', '#912C4B'], glow: [10, 17, 11], speck: [R.ember[7], R.cream[6]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      const SK = L.SKIN.peach;
      // the jacket: violet, a cream shirt front, gold buttons, a pink bow tie
      L.part(f, Mask.fn(W, W, (x, y) => y >= 16 && Math.abs(x - 15) <= Math.min(11, 5 + (y - 16) * 1.6)), R.vio, { cap: 2.6, base: 5, gain: 3.4 });
      for (let y = 17; y < W; y++) for (let x = 0; x < W; x++) if (Math.abs(x - 15) <= Math.min(2, (y - 16) * 0.5) && f.get(x, y) && f.get(x, y) !== C.edge) f.set(x, y, x < 15 ? C.white : C.cream);
      [[17, 22], [17, 26]].forEach(([x, y]) => { f.set(x + 1, y, R.gold[5]); f.set(x + 1, y + 1, R.gold[3]); });
      f.draw(['pp.pp', 'pPkPp', 'pp.pp'], 13, 15, { p: R.pink[5], P: R.pink[3], k: C.edge });
      // the head, a friendly face looking down at the flame
      L.part(f, ellipse(W, W, 15, 10.5, 4.8, 4.6), SK, { cap: 3, base: 4, gain: 4.2 });
      f.draw(['kk...kk'], 12, 10, { k: C.edge });
      f.set(13, 13, C.edge); f.set(14, 14, C.edge); f.set(15, 14, C.edge); f.set(16, 13, C.edge);
      f.set(11, 12, R.pink[6]); f.set(19, 12, R.pink[6]);
      // the cap: a cream ticket folded into two points, a dashed perforation along its edge, one corner torn off
      const cap = Mask.rows([
        '......x......',
        '.....xxx.....',
        '....xxxxx....',
        '...xxxxxxx...',
        '..xxxxxxxxx..',
        'xxxxxxxxxxxxx',
        'xxxxxxxxxxxxx',
      ]);
      const cb = kit.emboss(cap, R.cream, { cap: 2, base: 5, gain: 2.6 });
      for (let x = 3; x < 10; x++) cb.set(x, 3 + Math.abs(x - 6) > 5 ? 4 : 4, cb.get(x, 4) ? (x < 6 ? R.pink[5] : R.pink[4]) : null);
      for (let x = 0; x < 13; x += 2) cb.set(x, 6, R.cream[2]);
      cb.del(12, 5); cb.set(11, 5, R.cream[3]); cb.set(12, 6, R.cream[3]);
      for (let y = 0; y < 5; y++) cb.set(6 + y, y, cb.get(6 + y, y) ? R.cream[4] : null);
      cb.outline(C.edge); f.blit(cb, 8, 1);
      // the taper, held low before his chest: a cream stick in his fist, a burning wick
      L.part(f, Mask.fn(W, W, (x, y) => (x === 6 || x === 7) && y >= 17 && y <= 24), R.cream, { cap: 1, base: 5, gain: 2 });
      f.draw(['.e.', 'eYe', 'eWe', '.k.'], 5, 13, { e: R.ember[5], Y: R.ember[7], W: C.white, k: C.edge });
      L.part(f, strokeQuad(W, W, [10, 21], [8.5, 23.5], [7, 23], 3.2), R.vio, { cap: 1.2, base: 5, gain: 3 });
      L.part(f, ellipse(W, W, 6.5, 22.5, 2, 1.8), SK, { cap: 1.2, base: 4, gain: 3 });
      // three stubs held out toward us in his other hand: fanned, torn along their tops, a pink stripe across each
      const stub = (shear) => L.card(5, 9, { shear, draw: (c) => { c.del(1, 0); c.del(3, 0); c.set(2, 1, C.cream); for (let i = 0; i < 5; i++) { c.set(i, 5, R.pink[5]); c.set(i, 6, i % 2 ? R.cream[4] : C.cream); } } });
      f.blit(stub(-0.3), 18, 13); f.blit(stub(0), 21, 12); f.blit(stub(0.3), 23, 13);
      L.part(f, ellipse(W, W, 23.5, 22, 2.6, 2), SK, { cap: 1.2, base: 4, gain: 3 });
      L.part(f, strokeQuad(W, W, [20, 24], [22, 24.5], [23, 23.5], 3), R.vio, { cap: 1.2, base: 5, gain: 3 });
      return f;
    },
    overlay(k, b) {
      // the taper's warm halo, stepped in ember shades on the ground round the flame
      L.halo(b, this.fig(), 6, 14.5, [[3, R.ember[4]], [4.4, R.ember[3]]]);
    },
  }));

  // ------------------------------------------------------------ 11. Big Top: an ember-and-cream striped circus tent with
  // a lime pennant snapping on its peak, three cards marching in at its glowing doorway, the first already in it and
  // dark against the glow; night-plum ground
  A.joker('bigtop', {
    rarity: 'rare',
    ground: ['#3E256C', '#492C7E', '#553391', '#613AA5'], glow: [15, 14, 14], speck: [R.cream[7], R.money[6]],
    draw(k) {
      const { Mask } = k, f = L.fig();
      const stripe = (mask, a, b, fn, o) => { const A1 = kit.emboss(mask, a, o), B1 = kit.emboss(mask, b, o); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (mask.get(x, y)) f.set(x, y, fn(x, y) ? A1.get(x, y) : B1.get(x, y)); };
      // the walls
      const wall = Mask.fn(W, W, (x, y) => y >= 15 && y <= 29 && x >= 3 && x <= 27);
      stripe(wall, R.ember, R.cream, (x) => Math.floor((x - 3) / 3) % 2 === 0, { cap: 3, base: 5, gain: 3 });
      // the doorway, glowing from inside
      const door = Mask.fn(W, W, (x, y) => y >= 19 && y <= 29 && Math.abs(x - 15) <= 3.6 && !(y === 19 && Math.abs(x - 15) > 2));
      for (let y = 19; y <= 29; y++) for (let x = 11; x <= 19; x++) if (door.get(x, y)) { const d = Math.hypot(x - 15, (y - 25) * 0.8); f.set(x, y, d < 1.6 ? R.money[8] : d < 3 ? R.money[6] : d < 4.4 ? R.ember[6] : R.ember[4]); }
      for (let y = 19; y <= 29; y++) { f.set(11, y, C.edge); f.set(19, y, C.edge); }
      f.rect(12, 19, 7, 1, C.edge);
      // the roof: a cone of stripes from the peak, and a scalloped valance
      const roof = Mask.fn(W, W, (x, y) => y >= 4 && y <= 15 && Math.abs(x - 15) <= (y - 3.2) * 1.18);
      stripe(roof, R.ember, R.cream, (x, y) => { const u = (x - 15) / Math.max(1, (y - 3.2) * 1.18); return Math.floor((u + 1) * 3.5) % 2 === 0; }, { cap: 2.4, base: 5, gain: 3.4 });
      const val = Mask.fn(W, W, (x, y) => y >= 15 && y <= 17 && x >= 1 && x <= 29 && (y === 15 || Math.hypot(((x - 1) % 4) - 1.5, y - 15) <= 2));
      const vl = kit.emboss(val, R.ember, { cap: 1.2, base: 5, gain: 3 }); vl.outline(C.edge); f.blit(vl, 0, 0);
      for (let y = 4; y <= 15; y++) for (let x = 0; x < W; x++) if (roof.get(x, y) && !roof.get(x - 1, y)) f.set(x - 1, y, C.edge);
      // the pole and pennant
      f.rect(15, 0, 1, 4, R.wood[4]);
      f.draw(['ll...', 'lLll.', 'lLLll', 'll...'], 16, 0, { l: R.lime[6], L: R.lime[4] });
      // three cards marching in at the door, 5 x 7 with a pip and two-px legs: the first already in the doorway, dark
      // against the glow, the other two walking up to it
      const walker = (x, y, suit, dark) => {
        const c = new kit.Bmp(5, 9);
        for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (!((i === 0 || i === 4) && (j === 0 || j === 6))) c.set(i, j, dark ? (i === 0 || j === 0 ? R.plum[5] : R.plum[4]) : i === 4 || j === 6 ? C.cream3 : i === 0 || j === 0 ? C.white : C.cream);
        const p = kit.pipBmp(suit, 5);
        for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (p.get(i, j) && i > 0 && i < 4 && j > 0 && j < 4) c.set(i, j + 1, dark ? R.plum[2] : p.get(i, j));
        c.rect(1, 7, 1, 2, dark ? R.plum[3] : C.cream3); c.rect(3, 7, 1, 2, dark ? R.plum[3] : C.cream3);
        f.blit(L.ink(c), x - 1, y - 1);
      };
      walker(13, 21, 'S', true);
      walker(20, 21, 'H', false); walker(25, 22, 'D', false);
      return f;
    },
  });

  // ------------------------------------------------------------ 12. Poker Face: a tight bust of a jester in a deep plum
  // hood, its point and bell flopped to one side, his big face dead level (straight brows, level eyes, a flat mouth),
  // one ember glint in an unblinking eye; three cards held backs-out to his chest in a gloved hand; warm maroon ground
  A.joker('pokerface', {
    rarity: 'rare',
    ground: ['#6A1830', '#7A1E38', '#8A2440', '#9A2A48'], glow: [14, 12, 12], speck: [R.ember[6], R.cream[6]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      const SK = L.SKIN.peach, HOOD = R.plum.slice(2);
      // the hood and its cape over the shoulders, the point flopped to the right with a bell on its tip
      const hood = ellipse(W, W, 14, 13, 10.4, 11);
      hood.or(Mask.fn(W, W, (x, y) => y >= 20 && Math.abs(x - 14) <= 9 + (y - 20) * 0.9));
      hood.or(strokeQuad(W, W, [20, 5], [27.5, 3], [28.5, 11], (t) => 5 - t * 3.2));
      L.part(f, hood, HOOD, { cap: 3, base: 3, gain: 3.6 });
      L.bell(f, 27, 11);
      // a dagged pink trim round the face opening
      L.part(f, Mask.fn(W, W, (x, y) => { const d = Math.hypot((x - 14) / 8.2, (y - 14) / 8.8); return d <= 1 && d > 0.84 && y < 22; }), R.pink.slice(1), { cap: 1, base: 4, gain: 3 });
      // the face: big, dead level: straight 3-px brows, level eyes, a flat 4-px mouth; one ember glint
      L.part(f, ellipse(W, W, 14, 14, 7, 7.6), SK, { cap: 3.4, base: 4, gain: 4 });
      f.rect(9, 11, 3, 1, SK[0]); f.rect(16, 11, 3, 1, SK[0]);
      f.rect(9, 13, 3, 1, R.cream[5]); f.rect(16, 13, 3, 1, R.cream[5]); f.set(10, 13, C.edge); f.set(17, 13, C.edge);
      f.rect(9, 14, 3, 1, SK[3]); f.rect(16, 14, 3, 1, SK[3]);
      f.set(18, 13, R.ember[6]); f.set(18, 12, R.ember[8]);
      f.set(13, 16, SK[2]); f.set(14, 17, SK[2]);
      f.rect(12, 19, 4, 1, C.edge);
      // three cards held backs-out to his chest, a little fanned, each a red back with a cream border, in a gloved hand
      const back = () => L.card(7, 10, { face: R.mult[4], hi: C.cream, shade: R.cream[4], draw: (c) => { for (let y = 1; y < 9; y++) for (let x = 1; x < 6; x++) c.set(x, y, (x + y) % 3 === 0 ? R.mult[6] : (x + y) % 3 === 1 ? R.mult[4] : R.mult[3]); } });
      f.blit(back(), 15, 18); f.blit(back(), 18, 19); f.blit(back(), 21, 20);
      const glove = Mask.rows([
        '.xx.....',
        'xxx.....',
        'xxxx.xx.',
        'xxxxxxxx',
        'xxxxxxxx',
        '.xxxxxx.',
      ]);
      L.part(f, glove, R.vio.slice(2), { cap: 1.6, base: 3, gain: 3.4 }, 16, 25);
      f.set(17, 25, R.vio[7]); f.set(16, 26, R.vio[6]);
      return f;
    },
  });

  // ------------------------------------------------------------ 13. Dragon Tamer: a seated ember-orange dragon in a tiny
  // lime jester cap, its neck curved forward and its jaws open over the small jester below, who flicks a pink ribbon
  // whip up at its snout; one bat wing spread up behind its back, its tail curled along the floor; maroon ground
  A.joker('dragontamer', {
    rarity: 'rare',
    ground: ['#5C1C38', '#6C2241', '#7B2949', '#8C3053'], glow: [17, 13, 14], speck: [R.ember[6], R.pink[6]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      // the wing, spread up behind the back: three ember finger bones and a mult-red membrane in three scalloped lobes
      const SX = 24, SY = 16, bones = [[17.5, 1.5], [24.5, 0.5], [30.5, 3.5], [31.5, 12.5]];
      const ang = bones.map(([x, y]) => Math.atan2(y - SY, x - SX)), len = bones.map(([x, y]) => Math.hypot(x - SX, y - SY));
      const wing = Mask.fn(W, W, (x, y) => {
        const a = Math.atan2(y - SY, x - SX), r = Math.hypot(x - SX, y - SY);
        for (let i = 0; i < 3; i++) if (a >= ang[i] && a <= ang[i + 1]) { const t = (a - ang[i]) / (ang[i + 1] - ang[i]); return r <= len[i] + (len[i + 1] - len[i]) * t - Math.sin(t * Math.PI) * 3.6; }
        return false;
      });
      const wg = kit.emboss(wing, R.mult.slice(3), { cap: 2.4, base: 2, gain: 3 });
      bones.slice(0, 3).forEach(([tx, ty]) => { for (let t = 0.2; t <= 1.0001; t += 0.02) wg.set(Math.round(SX + (tx - SX) * t), Math.round(SY + (ty - SY) * t), R.ember[7]); });
      wg.outline(C.edge); f.blit(wg, 0, 0);
      // the tail, curling forward along the floor
      L.part(f, strokeQuad(W, W, [29.5, 26], [27, 31.5], [16, 29.6], (t) => 4.2 - t * 2), R.ember, { cap: 1.6, base: 5, gain: 3.4 });
      L.part(f, strokeQuad(W, W, [16.5, 29.6], [11.5, 29.8], [12.5, 26.5], 2.2), R.ember, { cap: 1, base: 5, gain: 3 });
      // the body, seated, and the neck in an S from the chest up and forward; cream-peach belly bands
      const body = ellipse(W, W, 23, 24.2, 6.2, 5.4);
      body.or(strokeQuad(W, W, [18.5, 8.5], [24.5, 11], [21.5, 19.5], 5.4));
      const bd = kit.emboss(body, R.ember, { cap: 3, base: 4, gain: 3.6 });
      for (let y = 12; y < W; y++) for (let x = 0; x < W; x++) if (body.get(x, y) && body.get(x - 1, y) && x <= 21 - (y > 25 ? (y - 25) * 0.9 : 0) && x >= 18.5 - (y - 12) * 0.1) bd.set(x, y, y % 2 ? (x < 20 ? R.peach[6] : R.peach[5]) : R.peach[3]);
      bd.outline(C.edge); f.blit(bd, 0, 0);
      L.part(f, ellipse(W, W, 26.5, 24.2, 3.6, 4.2), R.ember, { cap: 2.2, base: 5, gain: 3.4 });
      L.part(f, ellipse(W, W, 26, 28.6, 3.4, 1.4), R.ember, { cap: 1, base: 5, gain: 3 });
      // the foreleg, planted, three cream claws on the floor
      L.part(f, strokeQuad(W, W, [20, 21], [17.8, 25], [17.8, 28], 3.4), R.ember, { cap: 1.4, base: 5, gain: 3.2 });
      L.part(f, ellipse(W, W, 17.2, 28.7, 2.8, 1.4), R.ember, { cap: 1, base: 5, gain: 3 });
      [15, 17, 19].forEach((x) => f.set(x, 29, R.cream[6]));
      // the head, drawn on its own layer and set 2 px right: horns swept back, a long snout, jaws open on two fangs,
      // a slit-pupilled eye, its tiny lime jester cap; two puffs of smoke from the nostril
      const hb = new kit.Bmp(W, W);
      // the horns, swept back
      L.part(hb, strokeQuad(W, W, [17, 5], [20, 3], [23.5, 3], (t) => 2.6 - t * 1.6), R.cream.slice(2), { cap: 1, base: 4, gain: 2.4 });
      L.part(hb, strokeQuad(W, W, [18, 7.5], [21, 6.5], [24, 7], (t) => 2.4 - t * 1.4), R.cream.slice(2), { cap: 1, base: 4, gain: 2.4 });
      // the head, turned down at the tamer: a long snout, jaws open on two fangs, a slit-pupilled eye
      const jaw = Mask.fn(W, W, (x, y) => x >= 7 && x <= 16 && y >= 12 + (16 - x) * 0.16 && y <= 13.4 + (16 - x) * 0.16);
      L.part(hb, jaw, R.ember, { cap: 1, base: 4, gain: 3 });
      const head = ellipse(W, W, 14.8, 7.8, 4.3, 3.9);
      head.or(Mask.fn(W, W, (x, y) => x >= 6 && x <= 14 && y >= 6 + (14 - x) * 0.22 && y <= 10 && !(x === 6 && y === 10)));
      const hd = kit.emboss(head, R.ember, { cap: 2.4, base: 5, gain: 3.8 });
      hd.outline(C.edge); hb.blit(hd, 0, 0);
      for (let x = 8; x <= 14; x++) for (let y = 11; y < 12 + (16 - x) * 0.16; y++) hb.set(x, y, y === 11 ? R.mult[1] : R.mult[2]);
      hb.set(10, 12, R.pink[4]); hb.set(11, 12, R.pink[4]);
      hb.set(9, 11, R.cream[7]); hb.set(13, 11, R.cream[7]);
      hb.draw(['wwk', 'wkw', 'wkw'], 13, 6, { w: C.white, k: C.edge });
      hb.set(12, 5, R.ember[2]); hb.set(13, 5, R.ember[2]); hb.set(14, 5, R.ember[3]);
      hb.set(7, 7, C.edge); hb.set(8, 8, R.ember[3]);
      // its tiny lime jester cap, two points flopping over, a bell on each
      L.cap2(hb, 14.5, 4, 0.52, [R.lime, R.lime]);
      // two puffs of smoke from the nostril
      [[1, 3], [4, 0]].forEach(([x, y]) => L.part(hb, Mask.rows(['.xx.', 'xxxx', '.xx.']), R.steel, { cap: 1, base: 3, gain: 2 }, x, y));
      f.blit(hb, 2, 0);
      // the tamer: a small jester in a two-point cap and a pink-and-lime tunic, legs apart, one arm up with the whip
      const SK = L.SKIN.peach, TX = 4.5;
      L.part(f, Mask.fn(W, W, (x, y) => y >= 27 && y <= 29 && [2, 3, 6, 7].includes(x)), R.plum.slice(3), { cap: 1, base: 2, gain: 2 });
      L.part(f, Mask.fn(W, W, (x, y) => y === 30 && ((x >= 1 && x <= 3) || (x >= 6 && x <= 8))), R.maroon.slice(2), { cap: 1, base: 2, gain: 2 });
      const tunic = Mask.fn(W, W, (x, y) => y >= 23 && y <= 27 && Math.abs(x - TX) <= 2.4 + (y - 23) * 0.45);
      const tn = kit.emboss(tunic, R.pink, { cap: 2, base: 5, gain: 3.4 }), tl = kit.emboss(tunic, R.lime, { cap: 2, base: 5, gain: 3.4 });
      for (let y = 0; y < W; y++) for (let x = 5; x < W; x++) if (tl.get(x, y)) tn.set(x, y, tl.get(x, y));
      tn.outline(C.edge); f.blit(tn, 0, 0);
      L.part(f, strokeQuad(W, W, [7, 24], [9.5, 22.5], [9.5, 19.5], 2.4), R.pink, { cap: 1, base: 5, gain: 3 });
      L.part(f, Mask.fn(W, W, (x, y) => y === 22 && x >= 1 && x <= 8), R.cream, { cap: 1, base: 6, gain: 2 });
      [2, 4, 6, 8].forEach((x) => f.set(x, 22, R.cream[4]));
      L.part(f, ellipse(W, W, TX, 19.4, 2.9, 2.6), SK, { cap: 2, base: 4, gain: 4 });
      f.set(3, 18, C.edge); f.set(3, 19, C.edge); f.set(6, 18, C.edge); f.set(6, 19, C.edge); f.set(4, 21, R.mult[2]); f.set(5, 21, R.mult[2]);
      f.set(2, 20, R.pink[6]); f.set(7, 20, R.pink[6]);
      // his cap: a pink dome, its pink and lime points streaming back to gold bells as he flicks the whip
      L.part(f, strokeQuad(W, W, [TX + 0.5, 15.5], [TX - 0.5, 11], [TX - 3.4, 11.5], (t) => 2.6 - t * 1.2), R.lime, { cap: 1, base: 5, gain: 3.4 });
      L.part(f, strokeQuad(W, W, [TX - 1, 16], [TX - 3, 13.5], [TX - 4.4, 15], (t) => 2.6 - t * 1.2), R.pink, { cap: 1, base: 5, gain: 3.4 });
      L.part(f, Mask.fn(W, W, (x, y) => y >= 15 && y <= 17 && Math.abs(x - TX) <= 3 - (y === 15 ? 1 : 0)), R.pink, { cap: 1, base: 5, gain: 3.4 });
      [[0, 15], [0, 10]].forEach(([x, y]) => L.part(f, Mask.rows(['xx', 'xx']), R.gold, { cap: 1, base: 4, gain: 3 }, x, y));
      // the whip: a handle in his fist and a 2-px pink ribbon flicking up in an S to the dragon's snout
      L.part(f, Mask.fn(W, W, (x, y) => x === 10 && y >= 15 && y <= 18), R.wood, { cap: 1, base: 4, gain: 2 });
      L.part(f, ellipse(W, W, 10, 19.4, 1.4, 1.3), SK, { cap: 1, base: 4, gain: 3 });
      const rib = strokeQuad(W, W, [10.5, 14.5], [13, 13.5], [11.5, 11.5], 2);
      rib.or(strokeQuad(W, W, [11.5, 11.5], [9.5, 9.5], [8, 9.5], (t) => 2 - t * 0.5));
      L.part(f, rib, R.pink.slice(2), { cap: 1, base: 5, gain: 3 });
      return f;
    },
  });

  // ------------------------------------------------------------ 14. Fortune Cookie: one whole golden fortune cookie, the
  // folded crescent lit from the upper left, a zig-zag crack down its fold with the cream fortune sticking out and
  // curling, coins tumbling out below; burnt-orange ground
  A.joker('fortunecookie', {
    rarity: 'rare',
    ground: ['#6A2410', '#7A2C14', '#8A3418', '#9A3C1C'], glow: [15, 14, 13], speck: [R.money[6], R.ember[7]],
    draw(k) {
      const { Mask, strokeQuad } = k, f = L.fig();
      const BAKE = ['#5A2C0C', '#86461A', '#B26A28', '#D4903A', '#EAB056', '#F6CC7E', '#FFE6B0'];
      // the coins tumbling out of the crack, flat money yellow with an amber rim and a glint
      [[12, 19], [17, 22], [11, 25]].forEach(([x, y]) => f.blit(L.ink(L.coin(5, 5)), x, y));
      // the cookie: a plump crescent, its two ends folded down and in, a hollow under the fold
      const ck = Mask.fn(W, W, (x, y) => ((x - 15.5) / 12.6) ** 2 + ((y - 15.5) / 8.6) ** 2 <= 1 && ((x - 15.5) / 7) ** 2 + ((y - 25) / 7.6) ** 2 > 1);
      const cb = kit.emboss(ck, BAKE.slice(2), { cap: 3.6, base: 2, gain: 3.8 });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (ck.get(x, y)) {
        // the folded lip: a ridge following the top, a soft seam under it, and the hollow's shade along the inner curve
        const o = ((x - 15.5) / 12.6) ** 2 + ((y - 15.5) / 8.6) ** 2, i = ((x - 15.5) / 7) ** 2 + ((y - 25) / 7.6) ** 2;
        if (o > 0.42 && o < 0.56 && y < 17) cb.set(x, y, x < 15 ? BAKE[3] : BAKE[2]);
        if (i < 1.35) cb.set(x, y, i < 1.15 ? BAKE[1] : BAKE[2]);
        const mid = Math.abs(x - 15.5);
        if (mid < 1 && y > 9) cb.set(x, y, BAKE[2]);
      }
      cb.outline(C.edge); f.blit(cb, 0, 0);
      // the zig-zag crack down the fold
      [[15, 7], [16, 8], [15, 9], [16, 10], [15, 11], [16, 12], [15, 13], [16, 14], [15, 15], [16, 16]].forEach(([x, y]) => f.set(x, y, C.edge));
      // the fortune: a cream slip sticking out of the crack, curling over at its end, two red words on it
      const slip = strokeQuad(W, W, [16.5, 8], [18.5, 2], [24.5, 2.5], 2.6);
      slip.or(strokeQuad(W, W, [24.5, 2.5], [28.5, 3], [27, 6], (t) => 2.6 - t * 0.6));
      const sp = kit.emboss(slip, R.cream.slice(2), { cap: 1, base: 4, gain: 2 });
      [[20, 2], [21, 2], [23, 2], [24, 2]].forEach(([x, y]) => sp.set(x, y, R.mult[4]));
      sp.outline(C.edge); f.blit(sp, 0, 0);
      return f;
    },
  });

  // ------------------------------------------------------------ 15. Stand-In: a painted face-in-the-hole board cut to a
  // jester's shape, propped on a wooden strut, a real face peeking through the hole; a paint pot at its foot; violet
  A.joker('standin', {
    rarity: 'rare',
    ground: ['#4A1972', '#572084', '#642695', '#722DA8'], glow: [13, 13, 13], speck: [R.pink[6], R.vio[7]],
    draw(k) {
      const { Mask, strokeQuad } = k, f = L.fig();
      // a small shadow at the board's foot, and the strut propping it from behind, angled down to the floor
      L.part(f, Mask.fn(W, W, (x, y) => y >= 29 && x >= 4 && x <= 23), R.plum.slice(2, 5), { cap: 1, base: 1, gain: 1 });
      L.part(f, strokeQuad(W, W, [20, 13], [22.5, 21], [23.5, 29.5], 2.4), R.wood, { cap: 1, base: 4, gain: 3 });
      // the board, cut round a jester's cap and shoulders, cardboard-edged; painted cap, ruff and a lime-and-pink tunic
      const hole = (x, y) => Math.hypot(x - 12, y - 11) <= 3.5;
      const capM = Mask.fn(W, W, (x, y) => (y <= 11 && Math.hypot(x - 12, y - 11) <= 6.2));
      capM.or(strokeQuad(W, W, [9, 6], [5, 1], [2, 4], (t) => 3.6 - t * 1.8));
      capM.or(strokeQuad(W, W, [15, 6], [19, 1], [22, 4], (t) => 3.6 - t * 1.8));
      const board = Mask.fn(W, W, (x, y) => capM.get(x, y) || (x >= 3 && x <= 21 && y >= 12 && y <= 28 && !((x === 3 || x === 21) && y === 28)));
      const paint = (x, y) => {
        if (capM.get(x, y) && !(y >= 6 && Math.hypot(x - 12, y - 11) <= 5)) return x < 12 ? R.pink[5] : R.pink[4];
        if (y <= 15 && Math.hypot(x - 12, y - 11) <= 5) return R.peach[6];
        if (y >= 16 && y <= 18 && Math.abs(x - 12) <= 6) return (x % 2) ? R.cream[7] : R.cream[5];
        if (y >= 19 && Math.abs(x - 12) <= 5 + (y - 19) * 0.5) return x < 12 ? R.lime[5] : R.pink[5];
        return y < 19 ? R.chips[7] : R.vio[6];
      };
      // lit from the upper left: a cream edge along its top and left, each paint area darker along its lower right
      const shadeOf = (c) => { for (const r of [R.pink, R.peach, R.cream, R.lime, R.chips, R.vio]) { const i = r.indexOf(c); if (i > 0) return r[i - 1]; } return c; };
      const bd = new kit.Bmp(W, W);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (board.get(x, y) && !hole(x, y)) {
        const rim = !board.get(x + 1, y) || !board.get(x, y + 1), lit = !board.get(x - 1, y) || !board.get(x, y - 1);
        const p = paint(x, y), lo = (board.get(x + 1, y) && !hole(x + 1, y) && paint(x + 1, y) !== p) || (board.get(x, y + 1) && !hole(x, y + 1) && paint(x, y + 1) !== p);
        bd.set(x, y, rim ? R.cream[2] : lit ? R.cream[7] : lo ? shadeOf(p) : p);
      }
      bd.outline(C.edge); f.blit(bd, 0, 0);
      // painted bells on the cap's tips
      [[1, 4], [21, 4]].forEach(([x, y]) => { f.set(x, y, R.gold[5]); f.set(x + 1, y, R.gold[4]); f.set(x, y + 1, R.gold[4]); f.set(x + 1, y + 1, R.gold[3]); });
      // the real face in the hole: eyes slid sideways, a held-in smile, shadowed by the board's edge
      L.paint(f, Mask.fn(W, W, (x, y) => hole(x, y)), L.SKIN.tan, { cap: 2.4, base: 4, gain: 3.6 });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (hole(x, y) && !hole(x - 1, y - 1)) f.set(x, y, L.SKIN.tan[1]);
      f.set(10, 10, C.white); f.set(11, 10, C.edge); f.set(14, 10, C.white); f.set(15, 10, C.edge);
      f.set(10, 9, L.SKIN.tan[2]); f.set(14, 9, L.SKIN.tan[2]);
      f.set(11, 13, C.edge); f.set(12, 13, C.edge); f.set(13, 12, C.edge);
      // the paint pot at its foot, pink running down its side, a brush in it
      L.part(f, Mask.fn(W, W, (x, y) => x >= 25 && x <= 30 && y >= 24 && y <= 30), R.steel, { cap: 1.6, base: 3, gain: 2.6 });
      f.rect(25, 24, 6, 1, R.pink[5]); f.set(26, 25, R.pink[4]); f.set(26, 26, R.pink[4]); f.set(29, 25, R.pink[3]);
      L.part(f, strokeQuad(W, W, [28, 24], [29.5, 19], [30, 16], 1.6), R.wood, { cap: 1, base: 4, gain: 2 });
      return f;
    },
  });

  // ------------------------------------------------------------ 16. Old Flame: a faded portrait of an old jester friend in
  // an oval gold frame; in front of it a snuffed candle stub, its smoke curling up into a heart between them; plum
  A.joker('oldflame', {
    rarity: 'rare',
    ground: ['#56204E', '#62265A', '#702D68', '#7F3477'], glow: [20, 12, 12], speck: [R.ember[6], R.pink[7]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      // the portrait: an oval gold frame with a little scroll on top, round a faded rose-and-sepia likeness
      const FX = 20.5, FY = 12.5;
      L.part(f, ellipse(W, W, FX, FY, 7.6, 10.2), R.gold, { cap: 1.8, base: 4, gain: 3.4 });
      L.part(f, Mask.rows(['.x.x.', 'xxxxx']), R.gold, { cap: 1, base: 4, gain: 3 }, 18, 0);
      const SEP = ['#5E4048', '#7C5A5C', '#9C7670', '#B8927E', '#D2AE94', '#E6CAAC'], ROSE = ['#7A3C52', '#9A5068', '#B66A80', '#CE8A9A', '#E2AAB4'];
      const pic = new kit.Bmp(W, W), inner = ellipse(W, W, FX, FY, 5.8, 8.4);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (inner.get(x, y)) pic.set(x, y, Math.hypot((x - FX) / 5.8, (y - FY) / 8.4) > 0.8 ? SEP[1] : y < 12 ? SEP[3] : SEP[2]);
      // the old friend: a two-point cap with bells, a happy face, a ruff, all faded to rose and sepia
      const bust = new kit.Bmp(W, W);
      L.part(bust, Mask.fn(W, W, (x, y) => y >= 17 && Math.abs(x - FX) <= 3.4 + (y - 17) * 0.9), ROSE.slice(1), { cap: 1.6, base: 2, gain: 3 });
      L.part(bust, Mask.fn(W, W, (x, y) => y >= 15 && y <= 17 && [17, 19.5, 22, 24.5].some((c) => (x - c) ** 2 + (y - 16) ** 2 <= 2)), SEP.slice(3), { cap: 1, base: 2, gain: 2 });
      L.part(bust, ellipse(W, W, FX, 12, 3.3, 3.2), SEP.slice(3), { cap: 2, base: 2, gain: 2.6 });
      L.part(bust, strokeQuad(W, W, [19.5, 8.5], [18, 5], [17.5, 7.5], (t) => 2.4 - t * 1), ROSE, { cap: 1, base: 3, gain: 3 });
      L.part(bust, strokeQuad(W, W, [21.5, 8.5], [23, 5], [23.5, 7.5], (t) => 2.4 - t * 1), ROSE, { cap: 1, base: 3, gain: 3 });
      L.part(bust, Mask.fn(W, W, (x, y) => y >= 7 && y <= 9 && Math.abs(x - FX) <= 2.8 - (y === 7 ? 1 : 0)), ROSE, { cap: 1, base: 3, gain: 3 });
      [[17, 8], [23, 8]].forEach(([x, y]) => { bust.set(x, y, SEP[5]); bust.set(x + 1, y, SEP[4]); bust.set(x, y + 1, SEP[4]); bust.set(x + 1, y + 1, SEP[3]); });
      bust.draw(['kk..kk', '......', '.k..k.', '..kk..'], 18, 11, { k: SEP[0] });
      bust.set(17, 13, ROSE[3]); bust.set(24, 13, ROSE[3]);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const c = bust.get(x, y); if (c && inner.get(x, y)) pic.set(x, y, c === C.edge ? SEP[0] : c); }
      // a glint across the glass
      [[16, 7], [17, 6], [16, 8], [24, 17], [23, 18]].forEach(([x, y], i) => { if (inner.get(x, y)) pic.set(x, y, i < 3 ? C.white : SEP[5]); });
      f.blit(pic, 0, 0);
      // the candle stub in front, lower left: a brass holder with a ring handle, the wax, a black snuffed wick
      L.part(f, Mask.fn(W, W, (x, y) => Math.hypot(x - 14.5, y - 26.5) <= 2.2 && Math.hypot(x - 14.5, y - 26.5) >= 1), R.brass, { cap: 1, base: 4, gain: 3 });
      L.part(f, ellipse(W, W, 7.5, 28, 6.4, 1.9), R.brass, { cap: 1.4, base: 4, gain: 3.4 });
      const wax = Mask.fn(W, W, (x, y) => x >= 5 && x <= 10 && y >= 20 && y <= 27 && !(y === 20 && (x === 5 || x === 10)));
      const wx = kit.emboss(wax, R.cream, { cap: 2.4, base: 5, gain: 3 });
      wx.set(5, 21, R.cream[7]); wx.set(5, 22, R.cream[7]); wx.set(5, 23, R.cream[6]); wx.set(10, 21, R.cream[4]); wx.set(10, 22, R.cream[4]);
      wx.outline(C.edge); f.blit(wx, 0, 0);
      f.set(7, 19, C.edge); f.set(8, 19, C.edge); f.set(7, 18, C.edge); f.set(8, 20, R.cream[3]);
      // the smoke: a 2-px ribbon of pale ember curling up from the wick into a heart between the candle and portrait
      const smoke = strokeQuad(W, W, [7.5, 17.5], [4.5, 15.5], [7, 13.5], 2);
      smoke.or(strokeQuad(W, W, [7, 13.5], [9.5, 12], [8, 11], 2));
      smoke.or(Mask.rows([
        '.xx.xx.',
        'xxxxxxx',
        'xxxxxxx',
        '.xxxxx.',
        '..xxx..',
        '...x...',
      ], (ch) => ch === 'x'), 5, 6);
      L.part(f, smoke, R.ember.slice(5), { cap: 1.4, base: 2, gain: 2.4 });
      return f;
    },
  });

  // ------------------------------------------------------------ 17. Jack of All Trades: a young jester in a patched maroon
  // tunic and a pink-and-ember two-point cap, a hammer up in one hand and a steel ladle in the other, a fiddle and its
  // bow hanging at his hip, a Jack card tucked in his belt; burnt-orange ground
  A.joker('jackofalltrades', {
    rarity: 'rare',
    ground: ['#7A3410', '#8C3E14', '#9E4818', '#B0521C'], glow: [15, 12, 13], speck: [R.money[6], R.cream[6]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      const SK = L.SKIN.peach;
      // the arms, raised: a hammer in his right hand, a deep steel ladle in his left
      L.part(f, strokeQuad(W, W, [8.5, 17], [4.5, 15], [5, 11], 3.4), R.maroon, { cap: 1.4, base: 5, gain: 3 });
      L.part(f, strokeQuad(W, W, [21.5, 17], [25.5, 15], [25, 11], 3.4), R.maroon, { cap: 1.4, base: 5, gain: 3 });
      L.part(f, Mask.fn(W, W, (x, y) => (x === 4 || x === 5) && y >= 3 && y <= 10), R.wood, { cap: 1, base: 4, gain: 2 });
      L.part(f, Mask.fn(W, W, (x, y) => x >= 1 && x <= 8 && y >= 0 && y <= 2 && !(x === 8 && y === 2)), R.steel, { cap: 1, base: 3, gain: 3 });
      L.part(f, Mask.fn(W, W, (x, y) => (x === 25 && y >= 4 && y <= 10) || (x === 26 && y === 3)), R.steel, { cap: 1, base: 3, gain: 2 });
      const ladle = kit.emboss(Mask.rows(['xxxxx', 'xxxxx', '.xxx.']), R.steel, { cap: 1.4, base: 3, gain: 3 });
      ladle.set(1, 0, R.steel[0]); ladle.set(2, 0, R.steel[0]); ladle.set(3, 0, R.steel[1]);
      f.blit(L.ink(ladle), 25, 0);
      L.part(f, ellipse(W, W, 4.5, 11, 1.9, 1.7), SK, { cap: 1.2, base: 4, gain: 3 });
      L.part(f, ellipse(W, W, 25.5, 11, 1.9, 1.7), SK, { cap: 1.2, base: 4, gain: 3 });
      // the tunic: maroon, patched in lime and pink with cream stitches
      const tn = kit.emboss(Mask.fn(W, W, (x, y) => y >= 15 && Math.abs(x - 15) <= Math.min(9.5, 5 + (y - 15) * 1.4)), R.maroon, { cap: 3, base: 4, gain: 3.6 });
      const patch = (x0, y0, w, h, ramp) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (tn.get(x, y)) tn.set(x, y, x === x0 || y === y0 ? ramp[ramp.length - 3] : ramp[ramp.length - 4]); tn.set(x0, y0, C.cream); tn.set(x0 + w - 1, y0 + h - 1, C.cream); };
      patch(10, 18, 4, 4, R.lime); patch(17, 17, 3, 3, R.pink);
      tn.outline(C.edge); f.blit(tn, 0, 0);
      // the belt, a Jack card tucked in it, and a fiddle with its bow hanging at his hip
      L.part(f, Mask.fn(W, W, (x, y) => y >= 24 && y <= 25 && Math.abs(x - 15) <= 9), R.wood, { cap: 1, base: 3, gain: 2 });
      f.rect(14, 24, 3, 2, R.brass[5]); f.set(15, 24, R.brass[3]);
      const glyph = (c) => { const g = L.glyph('J'); for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g.get(i, j)) c.set(1 + i, 1 + j, j < 2 ? R.dark[4] : R.dark[3]); };
      f.blit(L.card(7, 10, { shear: 0.2, draw: glyph }), 18, 21);
      L.part(f, Mask.fn(W, W, (x, y) => (x === 3 || x === 4) && y >= 16 && y <= 21), R.wood.slice(0, 4), { cap: 1, base: 2, gain: 2 });
      L.part(f, Mask.rows(['xx', 'xx', '.x']), R.wood, { cap: 1, base: 4, gain: 2 }, 3, 14);
      const fid = Mask.rows(['.xxxx.', 'xxxxxx', 'xxxxxx', '.xxxx.', '.xxxx.', 'xxxxxx', 'xxxxxx', 'xxxxxx', '.xxxx.']);
      L.part(f, fid, R.wood, { cap: 1.6, base: 4, gain: 3 }, 1, 22);
      f.set(2, 26, C.edge); f.set(5, 26, C.edge); f.set(2, 27, C.edge); f.set(5, 27, C.edge);
      for (let y = 22; y <= 29; y++) f.set(y < 26 ? 3 : 4, y, R.wood[2]);
      L.part(f, strokeQuad(W, W, [9, 18], [5, 24], [0.5, 30.5], 1.2), R.cream.slice(3), { cap: 1, base: 3, gain: 2 });
      // the head: dark hair under a two-point jester cap in pink and ember
      L.part(f, ellipse(W, W, 15, 10.5, 5.4, 5.4), R.plum.slice(1, 7), { cap: 2.4, base: 2, gain: 3 });
      L.part(f, ellipse(W, W, 15, 12, 4.2, 4.2), SK, { cap: 2.6, base: 4, gain: 4 });
      L.cap2(f, 15, 7.5, 0.72, [R.pink, R.ember]);
      // a cheerful face: bright eyes, a grin to one side, a freckle or two
      f.set(13, 11, C.edge); f.set(17, 11, C.edge); f.set(13, 10, SK[2]); f.set(17, 10, SK[2]);
      f.set(14, 14, C.edge); f.set(15, 14, C.edge); f.set(16, 14, C.edge); f.set(17, 13, C.edge);
      f.set(12, 13, R.pink[6]); f.set(18, 13, R.pink[6]);
      return f;
    },
  });

  // ------------------------------------------------------------ 18. Night Moth: a big violet moth with ghost-blue eye-spots
  // circling a cream candle flame, two little Spectral cards tumbling off its wing tips; night-navy ground
  A.joker('nightmoth', keep({
    rarity: 'rare',
    ground: ['#1E297F', '#243292', '#2B3AA6', '#3143BB'], glow: [15, 20, 11], speck: [R.ghost[6], R.vio[7]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      // the candle below, its flame burning bright
      L.part(f, Mask.fn(W, W, (x, y) => x >= 13 && x <= 17 && y >= 23 && y <= 30), R.cream, { cap: 1.6, base: 5, gain: 2.6 });
      f.set(13, 23, R.cream[7]); f.set(14, 24, R.cream[7]);
      f.draw(['..e..', '.eYe.', '.YWY.', 'eYWYe', '.eYe.', '..k..'], 13, 17, { e: R.ember[5], Y: R.ember[7], W: C.white, k: C.edge });
      // the wings, mirrored: a pointed forewing and a round hindwing each side
      const fore = (x, y) => { const u = 15 - x; if (u < 1 || u > 14) return false; return y >= 6 - u * 0.4 && y <= 11.5 - u * 0.22 && u <= 14 - Math.max(0, y - 4) * 0.9; };
      const hind = (x, y) => { const u = 15 - x; return u >= 1 && Math.hypot((u - 6) / 5.2, (y - 14.5) / 4.2) <= 1; };
      const wingM = Mask.fn(W, W, (x, y) => fore(x, y) || fore(30 - x, y) || hind(x, y) || hind(30 - x, y));
      const wg = kit.emboss(wingM, R.vio, { cap: 2.4, base: 4, gain: 3.6 });
      // eye-spots: ghost-blue rings with dark pupils; a pale edge band along each forewing
      [[7, 6, 2.2], [23, 6, 2.2], [9, 15, 1.4], [21, 15, 1.4]].forEach(([cx, cy, r]) => {
        for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - cx, y - cy); if (wg.get(x, y) && d <= r + 0.4) wg.set(x, y, d <= r * 0.45 ? C.edge : d <= r - 0.3 ? R.ghost[5] : R.ghost[3]); }
        wg.set(Math.round(cx - r * 0.4), Math.round(cy - r * 0.4), C.white);
      });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (wg.get(x, y) && (fore(x, y) || fore(30 - x, y)) && !wingM.get(x, y - 1)) wg.set(x, y, R.vio[7]);
      wg.outline(C.edge); f.blit(wg, 0, 0);
      // the furry body, banded, and feathered antennae
      const bd = kit.emboss(ellipse(W, W, 15, 10, 1.9, 6.6), R.cream.slice(1), { cap: 1.6, base: 4, gain: 3 });
      for (let y = 6; y <= 16; y += 2) for (let x = 13; x <= 17; x++) if (bd.get(x, y)) bd.set(x, y, R.vio[3]);
      bd.outline(C.edge); f.blit(bd, 0, 0);
      L.part(f, ellipse(W, W, 15, 3.5, 1.8, 1.6), R.vio.slice(2), { cap: 1, base: 3, gain: 3 });
      [[13, 2], [12, 1], [11, 0], [17, 2], [18, 1], [19, 0]].forEach(([x, y]) => f.set(x, y, R.ghost[4]));
      f.set(14, 3, R.acid[4]); f.set(16, 3, R.acid[4]);
      // two little Spectral cards tumbling off the wing tips: a pale ghost border, a ghost-blue wisp on navy
      const spec = (lean) => L.card(5, 7, { face: R.navy[3], hi: R.ghost[6], shade: R.ghost[4], shear: lean, draw: (c) => { c.draw(['.w.', 'wWw', 'wWw', '.w.'], 1, 1, { w: R.ghost[4], W: R.ghost[6] }); c.set(2, 5, R.ghost[3]); } });
      f.blit(spec(-0.3), 0, 19); f.blit(spec(0.35), 24, 20);
      return f;
    },
    overlay(k, b) {
      // the candle's halo, stepped in ember shades on the ground round the flame
      L.halo(b, this.fig(), 15, 19.5, [[3.6, R.ember[4]], [5.4, R.ember[2]]], 0.9);
    },
  }));

  // ------------------------------------------------------------ 19. Ticket Collector: a moustached conductor jester in an
  // ember jacket piped in gold and a flat pillbox cap with ticket stubs tucked in its band, holding up one big cream
  // ticket and clipping a round hole in it with his pliers punch; one stub flutters free; maroon ground
  A.joker('ticketcollector', keep({
    rarity: 'rare',
    ground: ['#5E1D26', '#6D242C', '#7D2A33', '#8E323A'], glow: [19, 10, 12], speck: [R.cream[6], R.money[6]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      const SK = L.SKIN.peach, JK = R.ember.slice(1, 8);
      // the jacket: ember, gold piping down the front and round the collar, brass buttons
      const jk = kit.emboss(Mask.fn(W, W, (x, y) => y >= 20 && Math.abs(x - 11) <= 6 + (y - 20) * 1.3), JK, { cap: 2.6, base: 3, gain: 3.4 });
      for (let y = 20; y < W; y++) jk.set(11, y, R.gold[5]);
      for (let x = 0; x < W; x++) if (jk.get(x, 20)) jk.set(x, 20, R.gold[4]);
      [23, 26, 29].forEach((y) => { jk.set(13, y, R.brass[5]); jk.set(14, y, R.brass[3]); });
      jk.outline(C.edge); f.blit(jk, 0, 0);
      // the head and a fine curled moustache
      L.part(f, ellipse(W, W, 11, 14.5, 5, 5), SK, { cap: 3, base: 4, gain: 4 });
      f.draw(['m.mm.mm.m', 'mmMMmMMmm', '.m.....m.'], 7, 16, { m: R.wood[3], M: R.wood[2] });
      f.set(9, 13, C.edge); f.set(13, 13, C.edge); f.set(9, 12, SK[2]); f.set(13, 12, SK[2]); f.set(11, 15, SK[2]);
      f.set(11, 18, R.mult[3]);
      // the pillbox cap: flat-topped, ember with a gold band, three ticket stubs tucked into the band at angles
      [[7, 1, -0.3], [11, 2, 0.2]].forEach(([x, y, s]) => f.blit(L.card(4, 6, { shear: s, draw: (c) => { c.set(1, 1, R.pink[5]); c.set(2, 1, R.pink[5]); c.set(1, 3, R.cream[3]); } }), x, y));
      L.part(f, Mask.fn(W, W, (x, y) => y >= 6 && y <= 9 && Math.abs(x - 11) <= 5.5), JK, { cap: 1.4, base: 3, gain: 3 });
      for (let x = 5; x <= 17; x++) { f.set(x, 8, R.gold[5]); f.set(x, 9, R.gold[3]); }
      // the big ticket, held up: cream with a pink stripe, a perforated edge, a round hole punched through it
      const tk = new kit.Bmp(11, 8);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 11; x++) tk.set(x, y, y === 0 || x === 0 ? C.white : x === 10 || y === 7 ? C.cream3 : C.cream);
      for (let y = 0; y < 8; y++) tk.set(2, y, R.pink[5]);
      for (let y = 0; y < 8; y += 2) tk.set(4, y, R.cream[3]);
      tk.del(0, 0); tk.del(0, 7); tk.del(10, 0); tk.del(10, 7);
      [[7, 3], [8, 3], [7, 4], [8, 4]].forEach(([x, y]) => tk.del(x, y));
      tk.set(6, 3, R.cream[4]); tk.set(7, 2, R.cream[4]); tk.set(8, 2, R.cream[4]);
      f.blit(L.ink(tk), 18, 3);
      // the punch: plier jaws clamped on the ticket's bottom edge, two curved handles down to his raised fist
      L.part(f, Mask.rows(['xx.xx', 'xx.xx', '.xxx.']), R.steel, { cap: 1, base: 3, gain: 3 }, 24, 11);
      L.part(f, strokeQuad(W, W, [25, 14], [23.5, 16.5], [24, 19], 1.8), R.mult.slice(2), { cap: 1, base: 3, gain: 3 });
      L.part(f, strokeQuad(W, W, [27, 14], [29, 16.5], [27, 19], 1.8), R.mult.slice(2), { cap: 1, base: 3, gain: 3 });
      L.part(f, strokeQuad(W, W, [17, 23], [21.5, 22], [24.5, 20.5], 3), JK, { cap: 1.2, base: 3, gain: 3 });
      L.part(f, ellipse(W, W, 25.5, 20, 2, 1.8), SK, { cap: 1.2, base: 4, gain: 3 });
      // one stub fluttering free at the top left
      f.blit(L.card(4, 5, { shear: -0.5, draw: (c) => { c.set(1, 1, R.pink[5]); c.set(2, 1, R.pink[5]); c.set(1, 3, R.cream[3]); } }), 0, 0);
      return f;
    },
    overlay(k, b) {
      // the punched hole shows the ground through it: paint the ground back in, band and glow pool as the core lays them
      const g = this.ground, [gx, gy, gr] = this.glow;
      [[26, 7], [27, 7], [26, 8], [27, 8]].forEach(([x, y]) => {
        const d = Math.hypot(x - gx, (y - gy) * 1.1);
        b.set(5 + x, 7 + y, d < gr * 0.62 ? k.shade(g[3], 1.34) : d < gr ? k.shade(g[3], 1.16) : g[3 - Math.min(3, Math.floor((y / 31) * 4))]);
      });
    },
  }));

  // ------------------------------------------------------------ 20. Reprise: a brass gramophone playing a glowing,
  // gilt-edged heart card out of its lily horn, the card's pale chip-blue echo flying out a beat behind it; one note
  // doubled in the air; plum ground
  A.joker('reprise', keep({
    rarity: 'rare',
    ground: ['#5B1B41', '#6A224C', '#792857', '#892F63'], glow: [20, 9, 11], speck: [R.chips[7], R.money[7]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      // the gramophone box: maroon with a brass trim, a black record turning on top, the tone arm across it
      const bx = kit.emboss(Mask.fn(W, W, (x, y) => x >= 1 && x <= 13 && y >= 22 && y <= 29), R.maroon.slice(1), { cap: 2, base: 4, gain: 3 });
      for (let x = 1; x <= 13; x++) { bx.set(x, 22, R.maroon[6]); bx.set(x, 25, R.brass[4]); }
      bx.outline(C.edge); f.blit(bx, 0, 0);
      L.part(f, Mask.fn(W, W, (x, y) => x >= 3 && x <= 11 && y === 30), R.brass, { cap: 1, base: 4, gain: 2 });
      L.part(f, ellipse(W, W, 7, 20.5, 5.4, 1.8), R.dark.slice(0, 4), { cap: 1, base: 1, gain: 2 });
      f.set(7, 20, R.pink[5]); f.set(8, 20, R.pink[4]); f.set(4, 20, R.dark[4]); f.set(10, 21, R.dark[3]);
      L.part(f, strokeQuad(W, W, [12, 19.5], [10, 18.5], [8.5, 20], 1.4), R.brass, { cap: 1, base: 4, gain: 3 });
      // the lily horn: a brass neck rising from the box and flaring like a trumpet into a wide bell, opening up and right
      const horn = new k.Mask(W, W), P0 = [11.5, 21], P1 = [17.5, 20.5], P2 = [21, 11];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60, a = (1 - t) * (1 - t), b2 = 2 * (1 - t) * t, c2 = t * t;
        const cx = a * P0[0] + b2 * P1[0] + c2 * P2[0], cy = a * P0[1] + b2 * P1[1] + c2 * P2[1], r = 1.1 + 5.9 * t ** 2.4;
        for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) if (Math.hypot(x - cx, y - cy) <= r) horn.set(x, y);
      }
      const hn = kit.emboss(horn, R.brass, { cap: 2.4, base: 4, gain: 4 });
      // the bell's mouth: a lit rim round a dark throat
      const mouth = (x, y) => ((x - 21.5) / 6.6) ** 2 + ((y - 10) / 5.4) ** 2;
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (hn.get(x, y)) { const m = mouth(x, y); if (m <= 1) hn.set(x, y, m > 0.72 ? (x + y < 32 ? R.brass[6] : R.brass[4]) : m > 0.4 ? R.brass[2] : R.brass[1]); }
      hn.outline(C.edge); f.blit(hn, 0, 0);
      // the echo, a beat behind: the same card in pale chip blue, flying out up and to the right
      const paleHeart = (c) => { const p = kit.pipBmp('H', 5); for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (p.get(x, y)) c.set(1 + x, 3 + y, y < 2 ? R.chips[6] : R.chips[5]); };
      f.blit(L.card(7, 10, { face: R.chips[7], hi: R.chips[8], shade: R.chips[6], draw: paleHeart }), 22, 0);
      // the card itself, standing in the horn's mouth: gilt-edged, a heart in its middle
      f.blit(L.card(7, 10, { face: C.cream, hi: C.white, shade: R.gold[4], pip: 'H', draw: (c) => { for (let x = 1; x < 6; x++) { c.set(x, 1, R.gold[5]); c.set(x, 8, R.gold[3]); } for (let y = 1; y < 9; y++) { c.set(1, y, R.gold[5]); c.set(5, y, R.gold[3]); } } }), 16, 4);
      // one note, doubled: a pink note and its pale blue echo
      const note = (x, y, n, s) => f.draw(['...kk', '...kk', '...kk', 'nnnkk', 'nnnk.'], x, y, { k: s, n });
      note(2, 9, R.pink[5], R.pink[3]); note(6, 7, R.chips[7], R.chips[6]);
      return f;
    },
    overlay(k, b) {
      // a stepped gold glow round the card, where it shows against the ground
      L.glowOver(b, this.fig(), (x, y) => { const d = Math.hypot(Math.max(0, 16 - x, x - 24), Math.max(0, 4 - y, y - 15)); return d > 0 && d <= 1.2 ? R.money[4] : d > 0 && d <= 2.3 ? R.ember[3] : null; });
    },
  }));

  // ------------------------------------------------------------ 21. Kaleidoscope: a jester facing us with a brass
  // kaleidoscope held to one eye, its round end-ring showing a tiny eight-fold pattern, his other eye squeezed shut and
  // his tongue out in concentration; a big pink, lime and chip-blue rosette blooming behind his head like a halo; plum
  A.joker('kaleidoscope', {
    rarity: 'rare',
    ground: ['#4E205B', '#5C2669', '#6A2D77', '#793586'], glow: [15, 14, 13], speck: [R.lime[6], R.pink[6], R.chips[7]],
    draw(k) {
      const { Mask, ellipse } = k, f = L.fig();
      const SK = L.SKIN.peach;
      // the bloom behind his head: eight pointed petals, pink on the axes, chip blue on the diagonals, lime between,
      // built from |dx| and |dy| so it is exactly symmetric on the grid
      const MX = 15, MY = 14;
      const bloom = (dx, dy) => {
        const a = Math.max(Math.abs(dx), Math.abs(dy)), b = Math.min(Math.abs(dx), Math.abs(dy)), r = Math.hypot(dx, dy);
        const w = (s) => (s < 5 || s > 15.5 ? -1 : 3 * Math.sin((Math.PI * (s - 5)) / 10.5));
        const al = (a + b) / Math.SQRT2, pe = (a - b) / Math.SQRT2;
        if (b <= w(a)) return b < 0.9 ? R.pink[8] : b <= w(a) - 1 ? R.pink[7] : R.pink[6];
        if (pe <= w(al)) return pe < 0.8 ? R.chips[8] : pe <= w(al) - 1 ? R.chips[7] : R.chips[6];
        if (Math.abs(r - 10) <= 1.2 && Math.abs(Math.atan2(b, a) - Math.PI / 8) < 0.17) return R.lime[7];
        return r <= 5.5 ? R.vio[5] : null;
      };
      const bl = new kit.Bmp(W, W);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const c = bloom(x - MX, y - MY); if (c) bl.set(x, y, c); }
      bl.outline(C.edge); f.blit(bl, 0, 0);
      // shoulders in a lime tunic and a cream ruff
      L.part(f, Mask.fn(W, W, (x, y) => y >= 26 && Math.abs(x - 15) <= 7.5 + (y - 26) * 1.6), R.lime, { cap: 2.4, base: 5, gain: 3.4 });
      L.part(f, Mask.fn(W, W, (x, y) => y >= 23 && y <= 27 && [6.5, 10, 13.5, 17, 20.5, 24].some((c) => (x - c) ** 2 + (y - 25) ** 2 <= 3.6)), R.cream, { cap: 1.4, base: 5, gain: 3 });
      // the head, facing us, and his two-point cap in ember and violet
      L.part(f, ellipse(W, W, 15, 16.5, 6.4, 6), SK, { cap: 3, base: 4, gain: 4.2 });
      L.cap2(f, 15, 11, 0.84, [R.ember, R.vio]);
      // his right eye squeezed shut, a grin with the tongue poking out of its corner, a pink cheek
      f.set(17, 14, C.edge); f.set(18, 15, C.edge); f.set(19, 15, C.edge); f.set(20, 14, C.edge); f.set(18, 13, SK[2]); f.set(19, 13, SK[2]);
      f.draw(['k....k', '.kkkk.'], 14, 18, { k: C.edge });
      f.draw(['pp', 'Pk', 'k.'], 18, 20, { p: R.pink[6], P: R.pink[4], k: C.edge });
      f.set(20, 17, R.pink[6]); f.set(21, 17, R.pink[6]);
      // the kaleidoscope, held to his left eye, its end pointed straight at us: a brass ring lit from the top left,
      // the lens a tiny eight-fold pattern
      const ring = kit.emboss(Mask.fn(11, 11, (x, y) => Math.hypot(x - 5, y - 5) <= 5.2), R.brass, { cap: 2, base: 4, gain: 4 });
      const lens = (dx, dy) => { const a = Math.max(Math.abs(dx), Math.abs(dy)), b = Math.min(Math.abs(dx), Math.abs(dy)); if (a === 0) return C.white; if (b === 0) return a === 1 ? R.pink[6] : R.pink[5]; if (a === b) return R.lime[6]; return a === 2 ? R.chips[6] : R.vio[3]; };
      for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) { const d = Math.hypot(x - 5, y - 5); if (d <= 3.3) ring.set(x, y, lens(x - 5, y - 5)); else if (d <= 4.1) ring.set(x, y, C.edge); }
      ring.set(3, 1, R.brass[6]); ring.set(2, 2, R.brass[6]);
      f.blit(L.ink(ring), 4, 10);
      // his fingers curled round the ring
      L.part(f, Mask.rows(['xx.', 'xxx', 'xxx', '.xx']), SK, { cap: 1.2, base: 4, gain: 3 }, 3, 18);
      L.part(f, Mask.rows(['xxx', 'xxx']), SK, { cap: 1, base: 4, gain: 3 }, 11, 20);
      return f;
    },
  });

  // ------------------------------------------------------------ 22. Gala Night: three cream cards dressed for the gala, a
  // tailcoat and two gowns, posing on a red runner that recedes into the room, under a chandelier hung on its chain,
  // four uneven candles burning on its ring and crystal drops below; night-plum ground
  A.joker('galanight', keep({
    rarity: 'rare',
    ground: ['#392378', '#44298B', '#4F30A0', '#5B37B5'], glow: [15, 7, 12], speck: [R.cream[7], R.money[7]],
    draw(k) {
      const { Mask, ellipse } = k, f = L.fig();
      // the runner: mult red, receding into the room, gold-edged
      const rn = kit.emboss(Mask.fn(W, W, (x, y) => y >= 24 && Math.abs(x - 15.5) <= 6 + (y - 24) * 1.7), R.mult, { cap: 1.6, base: 4, gain: 3 });
      for (let y = 24; y < W; y++) for (let x = 0; x < W; x++) if (rn.get(x, y) && Math.abs(Math.abs(x - 15.5) - (6 + (y - 24) * 1.7)) < 1) rn.set(x, y, R.gold[4]);
      rn.outline(C.edge); f.blit(rn, 0, 0);
      // the chandelier: a two-px chain from the top edge to a brass ring, four candles of uneven height, crystal drops
      L.part(f, Mask.fn(W, W, (x, y) => (x === 15 || x === 16) && y >= 0 && y <= 6), R.gold, { cap: 1, base: 3, gain: 2 });
      for (let y = 0; y <= 6; y += 2) f.set(15, y, R.gold[5]);
      [[9, 4], [12, 3], [18, 5], [21, 3]].forEach(([x, h]) => {
        L.part(f, Mask.fn(W, W, (xx, yy) => (xx === x || xx === x + 1) && yy >= 8 - h && yy <= 7), R.cream, { cap: 1, base: 5, gain: 2 });
        f.draw(['.Y', 'YW', 'eY'], x, 5 - h, { Y: R.ember[7], W: C.white, e: R.ember[5] });
      });
      L.part(f, ellipse(W, W, 15.5, 8.5, 7, 1.8), R.brass, { cap: 1.2, base: 4, gain: 3.4 });
      [[12, 11], [19, 11]].forEach(([x, y]) => L.part(f, Mask.rows(['x', 'x']), R.ghost.slice(3), { cap: 1, base: 1, gain: 2 }, x, y));
      // three cards in their finery: the Spade in a tailcoat, the Heart and the Diamond in gowns
      const card = (x, y, suit) => f.blit(L.card(7, 9, { pip: suit, py: -1 }), x, y);
      card(2, 12, 'S'); card(11, 11, 'H'); card(20, 12, 'D');
      // the tailcoat: lit maroon, a cream shirt front, a pink bow tie, tails and trousers to the floor
      const tc = Mask.fn(W, W, (x, y) => (y >= 20 && y <= 24 && x >= 2 && x <= 10) || (y >= 24 && y <= 26 && (x === 3 || x === 4 || x === 8 || x === 9)) || (y >= 24 && y <= 27 && (x === 2 || x === 10)));
      const tcb = kit.emboss(tc, R.maroon.slice(2), { cap: 1.6, base: 3, gain: 3 });
      for (let y = 20; y <= 23; y++) { tcb.set(6, y, C.cream); if (y > 20) { tcb.set(5, y, y === 21 ? R.cream[6] : null); } }
      tcb.outline(C.edge); f.blit(tcb, 0, 0);
      f.draw(['p.p', 'pkp'], 5, 20, { p: R.pink[5], k: C.edge });
      // the gowns: a pinched waist under each card, then a lit hem flaring to the floor
      const gown = (cx, top, ramp) => {
        const g = Mask.fn(W, W, (x, y) => y >= top && y <= 27 && Math.abs(x - cx) <= (y < top + 2 ? 2.4 - (y - top) * 0.6 : 1.2 + (y - top - 2) * 0.9));
        const gb = kit.emboss(g, ramp, { cap: 2, base: ramp.length - 4, gain: 3.4 });
        for (let x = 0; x < W; x++) if (gb.get(x, 27)) gb.set(x, 27, ramp[ramp.length - 2]);
        gb.outline(C.edge); f.blit(gb, 0, 0);
      };
      gown(15, 20, R.pink); gown(24, 21, R.lime);
      return f;
    },
    overlay(k, b) {
      // glitter round the chandelier
      [[5, 3], [26, 2], [8, 11], [23, 11]].forEach(([x, y], i) => L.spark(b, x, y, 5, 7, i < 2));
    },
  }));

  // ------------------------------------------------------------ 23. Brazier: a black iron brazier on three legs, three
  // cards standing fanned in its bowl, charred and curling at their tops, ember flames leaping between and behind them;
  // a jester's open hands reaching in from both sides to warm at the glow; maroon ground
  A.joker('brazier', keep({
    rarity: 'rare',
    ground: ['#5E193B', '#6D1F45', '#7D2650', '#8D2D5C'], glow: [15, 11, 13], speck: [R.ember[6], R.money[6]],
    draw(k) {
      const { Mask, strokeQuad } = k, f = L.fig();
      const IRON = ['#120C12', '#1E161E', '#2C222C', '#3C3040', '#504454', '#6A5E6E'];
      // the flames, behind and between the cards: tongues of different heights, banded from an ember edge in to a
      // money-yellow heart, a small white core only at the base
      const tongue = (cx, top, bot, w) => Mask.fn(W, W, (x, y) => { if (y < top || y > bot) return false; const t = (y - top) / (bot - top); return Math.abs(x - (cx + Math.sin(t * 4) * 0.7)) <= w * Math.pow(Math.sin(t * Math.PI * 0.55), 1.2) + 0.3; });
      const fl = tongue(15.5, 0, 19, 6); fl.or(tongue(9, 5, 19, 3.4)); fl.or(tongue(22, 3, 19, 3.6)); fl.or(tongue(12, 2, 19, 2.6)); fl.or(tongue(19, 7, 19, 2.4));
      const fb = new kit.Bmp(W, W);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (fl.get(x, y)) {
        let n = 0; for (let d = 1; d <= 3; d++) if (fl.get(x - d, y) && fl.get(x + d, y) && fl.get(x, y - d)) n++;
        fb.set(x, y, n >= 3 ? (y >= 16 ? C.white : R.money[7]) : n === 2 ? R.ember[7] : n === 1 ? R.ember[6] : R.ember[5]);
      }
      fb.outline(C.edge); f.blit(fb, 0, 0);
      // three cards standing fanned in the bowl: cream with their pips, charred and curling at the top corners
      const card = (suit, shear) => L.card(7, 10, { pip: suit, shear, py: 1, draw: (c) => { c.set(0, 0, IRON[2]); c.set(1, 0, IRON[3]); c.set(0, 1, IRON[3]); c.set(6, 0, R.ember[4]); c.set(5, 0, IRON[3]); c.set(6, 1, IRON[2]); c.set(2, 0, R.ember[5]); } });
      f.blit(card('S', -0.3), 7, 10); f.blit(card('D', 0.3), 16, 10); f.blit(card('H', 0), 11, 9);
      // the iron bowl on three legs
      L.part(f, Mask.fn(W, W, (x, y) => y >= 19 && y <= 23 && Math.abs(x - 15) <= 10.5 - (y - 19) * 1.1), IRON, { cap: 2, base: 3, gain: 3 });
      for (let x = 5; x <= 25; x++) f.set(x, 19, IRON[5]);
      [[8, 24], [14.5, 24], [21, 24]].forEach(([x, y]) => L.part(f, Mask.fn(W, W, (xx, yy) => yy >= y && yy <= 30 && xx >= Math.floor(x) && xx <= Math.floor(x) + 1), IRON, { cap: 1, base: 3, gain: 2 }));
      // the jester's open hands, palms to the glow, on sleeves reaching in from both sides
      L.part(f, strokeQuad(W, W, [-3, 16], [0, 14.5], [3, 13.5], 4.4), R.pink, { cap: 1.6, base: 5, gain: 3 });
      L.part(f, strokeQuad(W, W, [34, 16], [31, 14.5], [28, 13.5], 4.4), R.lime, { cap: 1.6, base: 5, gain: 3 });
      const palm = Mask.rows(['.x.x...', '.x.x.x.', 'xx.x.x.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..']);
      L.part(f, palm, L.SKIN.peach, { cap: 1.2, base: 4, gain: 3 }, 1, 8);
      L.part(f, palm.flipX(), L.SKIN.peach, { cap: 1.2, base: 4, gain: 3 }, 23, 8);
      return f;
    },
    overlay(k, b) {
      // the glow off the fire, stepped on the ground round it, and two sparks rising
      L.halo(b, this.fig(), 15, 10, [[10, R.maroon[4]], [12.5, R.maroon[3]]], 0.85);
      [[10, 1], [21, 0]].forEach(([x, y]) => L.spark(b, x, y, 5, 7, false));
    },
  }));

  // ------------------------------------------------------------ 24. Golden Hour: a jester at a sunset window (upper left),
  // holding a coin up to the low sun so it flares; the light catches his upper-left edges, and his shadow stretches
  // long to the lower right across the sunlit boards; burnt-orange ground
  A.joker('goldenhour', keep({
    rarity: 'rare',
    ground: ['#6E2416', '#802C1A', '#92341E', '#A43C22'], glow: [6, 8, 10], speck: [R.money[7], R.ember[7]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      // the arched window: a wooden frame and cross, the sun low on the horizon in a pink-to-ember sky
      const arch = (x, y, i) => x >= 1 + i && x <= 12 - i && y >= 1 + i && y <= 16 && (y >= 7 || Math.hypot(x - 6.5, y - 7) <= 5.5 - i);
      const sky = (x, y) => {
        const s = Math.hypot(x - 6.5, (y - 12.5) * 1.15);
        if (y >= 13) return R.maroon[3];
        if (s <= 1.6) return C.white;
        if (s <= 2.8) return R.money[8];
        if (s <= 3.9) return R.money[6];
        return y <= 4 ? R.pink[5] : y <= 7 ? R.pink[6] : y <= 10 ? R.ember[6] : R.ember[7];
      };
      const wn = new kit.Bmp(W, W);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (arch(x, y, 0)) wn.set(x, y, !arch(x, y, 1) ? (x <= 6 && y <= 8 ? R.wood[5] : R.wood[3]) : y === 8 ? R.wood[3] : sky(x, y));
      wn.outline(C.edge); f.blit(wn, 0, 0);
      L.part(f, Mask.fn(W, W, (x, y) => y >= 17 && y <= 18 && x <= 14), R.wood, { cap: 1, base: 4, gain: 3 });
      for (let x = 0; x <= 14; x++) f.set(x, 17, R.wood[6]);
      // the floor: boards lit gold where the sun falls through, his long shadow stretching to the lower right
      const fl = kit.emboss(Mask.fn(W, W, (x, y) => y >= 28), R.wood, { cap: 1.6, base: 3, gain: 2 });
      for (let y = 28; y < W; y++) for (let x = 0; x < W; x++) {
        const lit = x <= 15 - (y - 28) * 2, sh = x >= 21 && y >= 29 && !(y === 30 && x < 24);
        fl.set(x, y, sh ? R.plum[2] : lit ? (y === 28 ? R.money[7] : R.ember[6]) : y === 28 ? R.wood[4] : R.wood[3]);
      }
      fl.outline(C.edge); f.blit(fl, 0, 0);
      // the jester, three-quarter view, facing the window: a warm plum tunic, a cream ruff, a lime-and-violet cap
      const BODY = R.plum.slice(3), SK = L.SKIN.peach;
      L.part(f, Mask.fn(W, W, (x, y) => y >= 24 && y <= 27 && (x === 19 || x === 20 || x === 24 || x === 25)), R.plum.slice(1, 5), { cap: 1, base: 2, gain: 2 });
      L.part(f, Mask.fn(W, W, (x, y) => y === 28 && ((x >= 17 && x <= 20) || (x >= 23 && x <= 26))), R.plum.slice(1, 5), { cap: 1, base: 2, gain: 2 });
      L.part(f, Mask.fn(W, W, (x, y) => y >= 16 && y <= 24 && Math.abs(x - 22) <= 4.4 + (y - 16) * 0.32), BODY, { cap: 2.4, base: 2, gain: 3.4 });
      L.part(f, Mask.fn(W, W, (x, y) => y >= 14 && y <= 17 && [17, 20, 23, 26].some((c) => (x - c) ** 2 + (y - 15.5) ** 2 <= 3.2)), R.cream, { cap: 1.4, base: 5, gain: 3 });
      L.part(f, ellipse(W, W, 22.5, 10, 4.6, 4.4), SK, { cap: 2.4, base: 4, gain: 4 });
      L.part(f, Mask.rows(['xx', 'xx', 'x.']), SK, { cap: 1, base: 5, gain: 3 }, 16, 9);
      // his arm raised toward the window, the coin held up against the sky
      L.part(f, strokeQuad(W, W, [18.5, 19], [14, 18], [12.5, 13.5], 3), BODY, { cap: 1.4, base: 2, gain: 3 });
      // the warm rim of light along his upper-left edges, facing the sun
      const rim = [];
      for (let y = 5; y < 28; y++) for (let x = 11; x < W; x++) { const c = f.get(x, y); if ((BODY.includes(c) || SK.includes(c)) && ((f.get(x - 1, y) === C.edge && !f.get(x - 2, y)) || (f.get(x, y - 1) === C.edge && !f.get(x, y - 2)))) rim.push([x, y]); }
      rim.forEach(([x, y]) => f.set(x, y, y < 14 ? R.money[7] : R.ember[6]));
      // his face: an eye on the sun, a brow, a smile, a warm cheek; then his cap
      f.rect(19, 8, 1, 2, C.edge); f.set(18, 7, SK[1]); f.set(19, 7, SK[1]); f.set(20, 7, SK[1]);
      f.set(18, 12, C.edge); f.set(19, 13, C.edge); f.set(20, 13, C.edge); f.set(21, 12, C.edge); f.set(21, 10, R.pink[5]); f.set(22, 10, R.pink[6]);
      L.cap2(f, 23.5, 6.5, 0.72, [R.lime, R.vio]);
      L.part(f, ellipse(W, W, 12.5, 12.5, 1.6, 1.5), SK, { cap: 1, base: 5, gain: 3 });
      f.blit(L.ink(L.coin(5, 5)), 8, 6);
      return f;
    },
    overlay(k, b) {
      // the coin flares: a white heart and four rays round it, un-inked so they read as light
      const X = 5 + 11, Y = 7 + 9;
      b.set(X, Y, C.white); b.set(X - 1, Y, R.money[8]); b.set(X, Y - 1, R.money[8]);
      [[0, -4], [0, -5], [4, 0], [5, 0], [0, 4], [-4, 0]].forEach(([dx, dy], i) => b.set(X + dx, Y + dy, i % 2 ? R.money[7] : R.money[8]));
    },
  }));

  // ------------------------------------------------------------ 25. Blackjack: a dealer jester in a lime eyeshade under
  // his cap, a sly half-smile, showing a natural 21 (the Ace of Spades and the King of Hearts) fanned in one raised hand
  // beside his face; a plain maroon table edge in front; maroon ground
  A.joker('blackjack', {
    rarity: 'rare',
    ground: ['#631821', '#721F27', '#82252E', '#932D35'], glow: [14, 12, 13], speck: [R.cream[6], R.lime[6]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      const SK = L.SKIN.deep.slice(2);
      // a violet jacket under a cream ruff
      L.part(f, Mask.fn(W, W, (x, y) => y >= 21 && Math.abs(x - 11) <= 5.5 + (y - 21) * 1.3), R.vio, { cap: 2.4, base: 4, gain: 3.4 });
      L.part(f, Mask.fn(W, W, (x, y) => y >= 19 && y <= 23 && [4, 7.5, 11, 14.5, 18].some((c) => (x - c) ** 2 + (y - 21) ** 2 <= 3.6)), R.cream, { cap: 1.4, base: 5, gain: 3 });
      // the head: dark hair at the back, a warm lit face
      L.part(f, ellipse(W, W, 10, 14, 5.4, 5.6), R.dark.slice(1), { cap: 2, base: 2, gain: 3 });
      L.part(f, ellipse(W, W, 11, 14.6, 4.7, 4.9), SK, { cap: 3, base: 3, gain: 4 });
      // the cap, then the lime eyeshade brim under it: two bands, no more
      L.cap2(f, 10.5, 8, 0.66, [R.pink, R.vio]);
      L.part(f, Mask.fn(W, W, (x, y) => (y === 9 && x >= 6 && x <= 15) || (y === 10 && x >= 7 && x <= 17)), R.lime, { cap: 1, base: 5, gain: 3 });
      // a sly face: 2 x 2 eyes with a cream catchlight, one brow cocked, a lopsided smile showing one tooth
      [[8, 13], [12, 13]].forEach(([x, y]) => { f.rect(x, y, 2, 2, C.edge); f.set(x, y, R.cream[6]); });
      f.set(8, 12, SK[0]); f.set(9, 12, SK[0]); f.set(12, 11, SK[0]); f.set(13, 12, SK[0]);
      f.set(11, 15, SK[1]);
      f.draw(['k...kk', '.kWmk.'], 8, 16, { k: C.edge, W: C.white, m: R.mult[1] });
      f.set(7, 15, R.pink[5]);
      // the natural 21: the Ace of Spades and the King of Hearts, fanned in his raised hand
      const card = (ch, suit, shear) => L.card(9, 13, { shear, pip: suit, pipSize: 5, px: -1, py: 4, draw: (c) => { const g = L.glyph(ch), ramp = kit.SUIT_RAMP[suit]; for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g.get(i, j)) c.set(1 + i, 1 + j, j < 2 ? ramp[4] : ramp[3]); } });
      L.part(f, strokeQuad(W, W, [16, 22], [19.5, 20.5], [20.5, 17.5], 3.4), R.vio, { cap: 1.2, base: 5, gain: 3 });
      f.blit(card('A', 'S', -0.18), 15, 1);
      f.blit(card('K', 'H', 0.18), 20, 3);
      L.part(f, ellipse(W, W, 21.5, 16.5, 2.4, 2.2), SK, { cap: 1.4, base: 3, gain: 3.4 });
      f.set(20, 15, SK[4]); f.set(22, 15, SK[4]);
      // a plain maroon table edge in front, his other hand resting on it
      const tb = kit.emboss(Mask.fn(W, W, (x, y) => y >= 27), R.maroon.slice(2), { cap: 1.4, base: 2, gain: 2 });
      for (let x = 0; x < W; x++) tb.set(x, 27, R.maroon[6]);
      tb.outline(C.edge); f.blit(tb, 0, 0);
      L.part(f, ellipse(W, W, 5, 26.5, 2.4, 1.6), SK, { cap: 1.2, base: 3, gain: 3 });
      return f;
    },
  });

  // ------------------------------------------------------------ 26. The Candle King: a tall cream candle wearing a gold
  // crown, wax dripping from under it, his wick flame rising from the crown's middle like its jewel; heavy-lidded eyes
  // and a curled wax moustache; a robe of ember flame tongues round him, white-hot at the hem; warm deep-maroon ground
  A.joker('candleking', keep({
    rarity: 'legendary',
    ground: ['#5B1A42', '#6E2040', '#82263C', '#942C36'], glow: [15, 15, 13], speck: [R.ember[6], R.money[7]],
    draw(k) {
      const { Mask, strokeQuad } = k, f = L.fig();
      // the robe of flame: tongues leaping up and out on each side, ember bodies, money-yellow tips, a white-hot hem
      const tongues = [];
      [[13, 1.5], [17, 3], [21, 5], [25, 7.5], [29, 10]].forEach(([y, out]) => {
        tongues.push(strokeQuad(W, W, [12, y + 2], [10 - out * 0.6, y + 1], [9.5 - out, y - 4 - out * 0.15], (t) => 4.6 - t * 3.6));
        tongues.push(strokeQuad(W, W, [18, y + 2], [20 + out * 0.6, y + 1], [20.5 + out, y - 4 - out * 0.15], (t) => 4.6 - t * 3.6));
      });
      const robe = Mask.fn(W, W, (x, y) => y >= 12 && y <= 30 && Math.abs(x - 15) <= 3 + (y - 12) * 0.62);
      tongues.forEach((t) => robe.or(t));
      const rb = new kit.Bmp(W, W);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (robe.get(x, y)) {
        const up = !robe.get(x, y - 1), up2 = !robe.get(x, y - 2);
        rb.set(x, y, y >= 29 ? (y === 29 ? R.money[8] : C.white) : up ? R.money[7] : up2 ? R.money[6] : y >= 27 ? R.ember[7] : (x + y) % 7 === 0 ? R.ember[6] : R.ember[5]);
      }
      rb.outline(C.edge); f.blit(rb, 0, 0);
      // the candle: tall cream wax, lit from the upper left, parted from the flames with ink
      const wax = Mask.fn(W, W, (x, y) => x >= 10 && x <= 20 && y >= 9 && y <= 30);
      const wx = kit.emboss(wax, R.cream, { cap: 3, base: 5, gain: 3.2 });
      wx.outline(C.edge); f.blit(wx, 0, 0);
      // wax spilling from under the crown down both sides, two px wide, lit on the left, parted with ink
      const drips = Mask.fn(W, W, (x, y) => ((x === 9 || x === 10) && y >= 9 && y <= 16 - (x === 9 ? 1 : 0)) || ((x === 20 || x === 21) && y >= 9 && y <= 13 + (x === 21 ? 0 : 1)) || ((x === 14 || x === 15) && y >= 9 && y <= 12));
      const dp = new kit.Bmp(W, W);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (drips.get(x, y)) dp.set(x, y, x === 9 || x === 14 || x === 20 ? R.cream[7] : R.cream[5]);
      dp.outline(C.edge); f.blit(dp, 0, 0);
      // his face: heavy-lidded eyes and a curled moustache in a darker wax tone
      [[11, 15], [17, 15]].forEach(([x, y]) => { f.rect(x, y, 3, 1, R.cream[3]); f.rect(x, y + 1, 3, 1, C.edge); f.set(x + 2, y + 1, R.cream[2]); });
      f.draw(['m.......m', 'mm.mmm.mm', '.mm...mm.'], 11, 18, { m: R.peach[4] });
      f.set(15, 20, R.peach[3]);
      // the crown: a gold band with five points, pink and chip-blue gems
      const crown = Mask.rows([
        'x..x..x..x..x',
        'xx.x.xxx.x.xx',
        'xxxxxxxxxxxxx',
        'xxxxxxxxxxxxx',
        'xxxxxxxxxxxxx',
      ]);
      const cr = kit.emboss(crown, R.gold, { cap: 1.6, base: 4, gain: 4 });
      [[2, 3, R.pink[5]], [6, 3, R.chips[6]], [10, 3, R.pink[5]]].forEach(([x, y, c]) => { cr.set(x, y, c); cr.set(x + 1, y, c === R.pink[5] ? R.pink[3] : R.chips[4]); });
      [0, 3, 9, 12].forEach((x) => cr.set(x, 0, R.gold[6]));
      cr.outline(C.edge); f.blit(cr, 9, 5);
      // the wick flame rising from the crown's middle, its jewel: ember with a white core
      f.draw([
        '..e..',
        '.eYe.',
        '.YWY.',
        'eYWYe',
        'eYWYe',
        '.eYe.',
        '..k..',
      ], 13, 0, { e: R.ember[5], Y: R.ember[7], W: C.white, k: C.edge });
      return f;
    },
    overlay(k, b) {
      // the flame's halo, stepped in ember shades on the ground round it
      L.halo(b, this.fig(), 15, 3, [[4.2, R.ember[4]], [5.8, R.ember[3]]], 1.1);
    },
  }));

  // ------------------------------------------------------------ 27. Madame Echo: an opera diva jester in a violet gown and
  // a gold tiara, arms flung wide on a high note; up and to her right her ghost-blue twin sings the same note a beat
  // behind, arms a little lower; every note doubled in the air, pink beside pale blue; rose-pink ground
  A.joker('madameecho', {
    rarity: 'legendary',
    ground: ['#6A1A4C', '#7C2058', '#8E2664', '#A02C70'], glow: [12, 14, 13], speck: [R.ghost[5], R.pink[7]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      /** A singer's figure as masks, head at (hx, hy): arms flung up and out to (lx, ly) and (rx, ry). */
      const singer = (hx, hy, lx, ly, rx, ry, waist) => {
        const body = Mask.fn(W, W, (x, y) => y >= hy + 5 && y <= waist && Math.abs(x - hx) <= 2.6 + (y - hy - 5) * 0.62);
        body.or(strokeQuad(W, W, [hx - 2, hy + 6.5], [lx + 1.5, hy + 4.5], [lx, ly], 2.2));
        body.or(strokeQuad(W, W, [hx + 2, hy + 6.5], [rx - 1.5, hy + 4.5], [rx, ry], 2.2));
        return body;
      };
      // the twin, up and to the right, a beat behind: the same pose in the ghost ramp, waist up, arms a little lower
      const TX = 21.5, TY = 6;
      const tw = kit.emboss(singer(TX, TY, 14.5, 4, 29, 5, 22), R.ghost.slice(1), { cap: 2.4, base: 3, gain: 3 });
      const th = kit.emboss(ellipse(W, W, TX, TY, 4, 4.2), R.ghost.slice(2), { cap: 2.4, base: 3, gain: 3.4 });
      tw.blit(th, 0, 0);
      for (let x = Math.round(TX) - 3; x <= Math.round(TX) + 3; x++) for (let y = TY - 5; y <= TY - 3; y++) if (Math.hypot((x - TX) / 3.6, (y - TY + 3.4) / 2.4) <= 1) tw.set(x, y, R.ghost[2]);
      tw.draw(['k.k..k.k', '.k....k.'], 18, 5, { k: R.ghost[0] });
      tw.draw(['kk', 'kk', 'kk'], 21, 8, { k: R.ghost[0] });
      tw.outline(C.edge); f.blit(tw, 0, 0);
      // the diva: a violet gown flaring to the floor, arms flung wide, a cream ruff
      const DX = 10, DY = 12;
      const gown = singer(DX, DY, 2, 4, 17.5, 4.5, 30);
      gown.or(Mask.fn(W, W, (x, y) => y >= 22 && y <= 30 && Math.abs(x - DX) <= 5 + (y - 22) * 0.75));
      const g = kit.emboss(gown, R.vio, { cap: 2.6, base: 4, gain: 3.6 });
      const sk = kit.emboss(gown, L.SKIN.peach, { cap: 2, base: 4, gain: 3.6 });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (g.get(x, y) && y < DY + 6 && Math.abs(x - DX) > 2.5) g.set(x, y, sk.get(x, y));
      g.outline(C.edge); f.blit(g, 0, 0);
      L.part(f, Mask.fn(W, W, (x, y) => y >= DY + 4 && y <= DY + 6 && Math.abs(x - DX) <= 4.6), R.cream, { cap: 1, base: 5, gain: 3 });
      [DX - 4, DX - 2, DX, DX + 2, DX + 4].forEach((x) => f.set(x, DY + 6, R.cream[4]));
      // her head, radius 4.6: hair piled high under a gold tiara, eyes shut in two arcs, the mouth an open 2 x 3
      L.part(f, ellipse(W, W, DX - 0.5, DY - 4.8, 4.2, 3.2), R.maroon.slice(1), { cap: 2, base: 3, gain: 3 });
      L.part(f, ellipse(W, W, DX, DY, 4.6, 4.6), L.SKIN.peach, { cap: 3, base: 4, gain: 4.2 });
      L.part(f, Mask.rows(['x.x.x', 'xxxxx']), R.gold, { cap: 1, base: 4, gain: 3 }, DX - 2, DY - 6);
      f.set(DX, DY - 6, R.pink[6]);
      f.draw(['k..k', '.kk.'], DX - 4, DY - 1, { k: C.edge }); f.draw(['k..k', '.kk.'], DX + 1, DY - 1, { k: C.edge });
      f.draw(['kk', 'mm', 'kk'], DX - 0.5 | 0, DY + 1, { k: C.edge, m: R.mult[2] });
      f.set(DX - 3, DY + 1, R.pink[6]); f.set(DX + 3, DY + 1, R.pink[6]);
      // a gold necklace on the ruff
      [DX - 2, DX, DX + 2].forEach((x) => f.set(x, DY + 5, R.gold[5]));
      // the notes, each one doubled: a pink note beside its pale ghost-blue echo
      const note = (x, y, n, s) => f.draw(['...kk', '...kk', '...kk', '...kk', 'nnnkk', 'nnnk.'], x, y, { k: s, n });
      note(19, 22, R.pink[5], R.pink[3]); note(24, 21, R.ghost[5], R.ghost[3]);
      note(23, 13, R.pink[5], R.pink[3]); note(27, 12, R.ghost[5], R.ghost[3]);
      return f;
    },
  });

  // ------------------------------------------------------------ 28. The Puppet Master: a showman puppeteer in a deep
  // violet jester coat with a dagged, gold-trimmed collar, arms raised to two plain wooden bars, working a marionette
  // jester on gold strings at each side; his own cap dangling upside-down on a string above him; deep-red stage ground
  A.joker('puppetmaster', keep({
    rarity: 'legendary',
    ground: ['#680F1F', '#791524', '#8A1B29', '#9C202F'], glow: [15, 12, 12], speck: [R.gold[5], R.pink[7]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      const SK = L.SKIN.tan, COAT = R.vio.slice(1, 8);
      // the coat: deep violet, gold trim down the front
      const ct = kit.emboss(Mask.fn(W, W, (x, y) => y >= 17 && Math.abs(x - 15) <= 3.6 + (y - 17) * 0.36), COAT, { cap: 2.4, base: 3, gain: 3.4 });
      for (let y = 18; y < W; y++) ct.set(15, y, y % 3 ? R.gold[4] : R.gold[5]);
      ct.outline(C.edge); f.blit(ct, 0, 0);
      // his arms raised to the bars, the hands gripping them from above
      L.part(f, strokeQuad(W, W, [12.5, 19.5], [8, 17], [6, 10], 3), COAT, { cap: 1.2, base: 3, gain: 3 });
      L.part(f, strokeQuad(W, W, [17.5, 19.5], [22, 17], [24, 10], 3), COAT, { cap: 1.2, base: 3, gain: 3 });
      [[1, 10], [21, 10]].forEach(([x, y]) => L.part(f, Mask.fn(W, W, (xx, yy) => yy >= y && yy <= y + 1 && xx >= x && xx <= x + 8), R.wood, { cap: 1, base: 4, gain: 2.4 }));
      L.part(f, ellipse(W, W, 5.5, 9.4, 1.8, 1.4), SK, { cap: 1, base: 4, gain: 3 });
      L.part(f, ellipse(W, W, 24.5, 9.4, 1.8, 1.4), SK, { cap: 1, base: 4, gain: 3 });
      // the dagged collar: points round the neck, gold on their tips
      const col = Mask.fn(W, W, (x, y) => y >= 15 && Math.abs(x - 15) <= 5.6 && y <= 16 + (1.5 - Math.abs(((x - 15 + 30) % 3) - 1)) * 1.6);
      const cl = kit.emboss(col, COAT, { cap: 1.4, base: 4, gain: 3 });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (cl.get(x, y) && !col.get(x, y + 1)) cl.set(x, y, R.gold[5]);
      cl.outline(C.edge); f.blit(cl, 0, 0);
      // the head: dark hair, a sly grin, arched brows
      L.part(f, ellipse(W, W, 15, 11, 4.2, 4.2), R.dark.slice(1), { cap: 2, base: 2, gain: 3 });
      L.part(f, ellipse(W, W, 15, 12, 3.6, 3.6), SK, { cap: 2.6, base: 4, gain: 4 });
      f.set(13, 12, C.edge); f.set(17, 12, C.edge); f.set(12, 10, SK[1]); f.set(13, 10, SK[1]); f.set(17, 10, SK[1]); f.set(18, 10, SK[1]);
      f.draw(['k...k', '.kWk.'], 13, 14, { k: C.edge, W: C.white });
      // the marionettes: little wooden jesters with caps of their own, jointed arms up to the strings, legs dangling
      const puppet = (cx, top, ramp, cap) => {
        const P = { cap: 1.2, base: ramp.length - 4, gain: 3 };
        L.part(f, strokeQuad(W, W, [cx - 1, top + 9], [cx - 2.6, top + 11], [cx - 1.5, top + 14], 1.7), ramp, P);
        L.part(f, strokeQuad(W, W, [cx + 1, top + 9], [cx + 2.6, top + 11], [cx + 1.5, top + 14], 1.7), ramp, P);
        L.part(f, strokeQuad(W, W, [cx - 1.5, top + 6], [cx - 3.5, top + 7.5], [cx - 3.5, top + 4], 1.6), ramp, P);
        L.part(f, strokeQuad(W, W, [cx + 1.5, top + 6], [cx + 3.5, top + 7.5], [cx + 3.5, top + 4], 1.6), ramp, P);
        L.part(f, Mask.fn(W, W, (x, y) => y >= top + 5 && y <= top + 9 && Math.abs(x - cx) <= 1.6 + (y - top - 5) * 0.2), ramp, P);
        L.part(f, Mask.rows(['.xxx.', 'xxxxx', 'xxxxx', '.xxx.']), R.wood.slice(2), { cap: 1.2, base: 3, gain: 3 }, cx - 2, top + 1);
        f.set(cx - 1, top + 2, C.edge); f.set(cx + 1, top + 2, C.edge); f.set(cx, top + 4, R.mult[2]);
        L.part(f, Mask.rows(['x...x', 'xx.xx', 'xxxxx']), cap, { cap: 1, base: 5, gain: 3 }, cx - 2, top - 2);
        f.set(cx - 2, top - 3, R.gold[5]); f.set(cx + 2, top - 3, R.gold[5]);
      };
      puppet(5, 16, R.pink, R.lime); puppet(25, 16, R.lime, R.pink);
      // his own cap, hanging upside-down above him on a gold string: the brim on top, the points dangling to bells
      L.part(f, strokeQuad(W, W, [13, 3], [10.5, 4.5], [10.5, 6.5], (t) => 2.8 - t * 1.2), R.pink, { cap: 1.2, base: 5, gain: 3.4 });
      L.part(f, strokeQuad(W, W, [17, 3], [19.5, 4.5], [19.5, 6.5], (t) => 2.8 - t * 1.2), R.lime, { cap: 1.2, base: 5, gain: 3.4 });
      L.part(f, Mask.fn(W, W, (x, y) => y >= 1 && y <= 4 && Math.hypot((x - 15) / 3.8, (y - 1) / 3.4) <= 1), R.ember, { cap: 1.2, base: 5, gain: 3.4 });
      L.bell(f, 8, 6); L.bell(f, 18, 6);
      return f;
    },
    overlay(k, b) {
      const fig = this.fig();
      const string = (x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n); if (!fig.get(x, y)) b.set(5 + x, 7 + y, R.gold[5]); } };
      // gold strings from each bar's ends and middle to the marionette's hands and head, and one to his own cap
      string(1, 12, 1, 20); string(5, 12, 5, 13); string(9, 12, 9, 20);
      string(21, 12, 21, 20); string(25, 12, 25, 13); string(29, 12, 29, 20);
      string(15, 0, 15, 0);
    },
  }));

  // ------------------------------------------------------------ 29. Sir Motley: a gallant jester knight in a pink-and-lime
  // tabard, domed steel pauldrons and a gold gorget, his helm crested with a jester's two curling points, his face
  // winking out of the open visor, his shield quartered in mult red, chip blue, lime and gold with a different suit in
  // each quarter; his own ultramarine ground (not Lit Paperclip's chip blue), kept cool rather than the brief's violet,
  // which would vanish into the violet Legendary frame
  A.joker('sirmotley', {
    rarity: 'legendary',
    ground: ['#24207E', '#2C2892', '#3430A6', '#3C38BA'], glow: [15, 12, 13], speck: [R.money[6], R.pink[6]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      const SK = L.SKIN.peach;
      // the tabard: pink and lime halves over his chest
      const tab = Mask.fn(W, W, (x, y) => y >= 16 && y <= 30 && Math.abs(x - 15) <= Math.min(12, 7 + (y - 16) * 1.4));
      const tp = kit.emboss(tab, R.pink, { cap: 2.6, base: 5, gain: 3.2 }), tl = kit.emboss(tab, R.lime, { cap: 2.6, base: 5, gain: 3.2 });
      for (let y = 0; y < W; y++) for (let x = 15; x < W; x++) if (tl.get(x, y)) tp.set(x, y, tl.get(x, y));
      tp.outline(C.edge); f.blit(tp, 0, 0);
      // steel only on the two domed pauldrons, a rivet in each, and a gold gorget at the neck
      [[5, 18], [25, 18]].forEach(([cx, cy]) => { L.part(f, ellipse(W, W, cx, cy, 4, 3.2), R.steel, { cap: 2, base: 3, gain: 3.4 }); f.set(cx, cy, R.steel[0]); f.set(cx - 1, cy - 1, R.steel[5]); });
      L.part(f, Mask.fn(W, W, (x, y) => y >= 15 && y <= 16 && Math.abs(x - 15) <= 4.5), R.gold, { cap: 1, base: 4, gain: 3 });
      // the helm, visor up, and the crest: two curling points, pink and lime, with bells
      L.part(f, strokeQuad(W, W, [14, 4], [8, -1], [4, 4], (t) => 3.6 - t * 1.8), R.pink, { cap: 1.4, base: 5, gain: 3.6 });
      L.part(f, strokeQuad(W, W, [16, 4], [22, -1], [26, 4], (t) => 3.6 - t * 1.8), R.lime, { cap: 1.4, base: 5, gain: 3.6 });
      L.bell(f, 2, 4); L.bell(f, 25, 4);
      L.part(f, ellipse(W, W, 15, 10, 6, 6.4), R.steel, { cap: 2.8, base: 3, gain: 3.4 });
      L.part(f, Mask.fn(W, W, (x, y) => x >= 12 && x <= 17 && y >= 9 && y <= 13 && !((x === 12 || x === 17) && y === 13)), SK, { cap: 2.4, base: 4, gain: 4 });
      L.part(f, Mask.fn(W, W, (x, y) => y >= 6 && y <= 7 && x >= 10 && x <= 20), R.steel.slice(1), { cap: 1, base: 3, gain: 2 });
      // a gallant face: one eye open, the other shut in a wink, a curled smile
      f.set(13, 10, C.edge); f.set(13, 9, SK[2]); f.set(15, 10, C.edge); f.set(16, 10, C.edge);
      f.draw(['k...k', '.kkk.'], 12, 11, { k: C.edge }); f.set(17, 11, R.pink[6]);
      // the shield: a heater shape quartered in the four suit colours, a cream pip in each quarter
      const sh = Mask.fn(W, W, (x, y) => y >= 15 && y <= 30 && Math.abs(x - 15) <= (y <= 23 ? 7.4 : 7.4 - (y - 23) * 1.05));
      const Q = [[R.mult, 'H'], [R.chips, 'S'], [R.lime, 'C'], [R.gold, 'D']];
      const shd = new kit.Bmp(W, W);
      const rampAt = (x, y) => Q[(x < 15 ? 0 : 1) + (y < 22 ? 0 : 2)][0];
      const lit = kit.emboss(sh, [0, 1, 2, 3, 4, 5, 6].map(String), { cap: 3, base: 4, gain: 3 });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (sh.get(x, y)) {
        const r = rampAt(x, y), i = +lit.get(x, y);
        shd.set(x, y, x === 15 || y === 22 ? R.gold[4] : r[Math.min(r.length - 1, r.length - 7 + i)]);
      }
      shd.outline(C.edge); f.blit(shd, 0, 0);
      const pip = (suit, x, y) => { const m = Mask.rows(kit.PIP5[suit]); for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (m.get(i, j)) f.set(x + i, y + j, j < 2 ? C.white : C.cream); };
      pip('H', 9, 16); pip('S', 17, 16); pip('C', 9, 23); pip('D', 17, 23);
      return f;
    },
  });

  // ------------------------------------------------------------ 30. The Ringmaster: a ringmaster jester in a tall hat and
  // a gold-buttoned maroon tailcoat with a pointed, belled collar, cracking a whip of sparks; three tiny Jokers bowing
  // on the striped curb of the circus ring at his feet; ember ground
  A.joker('ringmaster', keep({
    rarity: 'legendary',
    ground: ['#86300E', '#9A3A12', '#AE4416', '#C04E1A'], glow: [14, 11, 12], speck: [R.money[7], R.cream[7]],
    draw(k) {
      const { Mask, strokeQuad, ellipse } = k, f = L.fig();
      const SK = L.SKIN.peach, COAT = R.maroon.slice(1, 8);
      // the ring's curb across the bottom: a curved band striped in cream and mult red
      const curb = Mask.fn(W, W, (x, y) => { const top = 27 - ((x - 15) / 15) ** 2 * 2.6; return y >= top && y <= top + 2.6; });
      const cb = kit.emboss(curb, R.cream, { cap: 1.2, base: 5, gain: 2 });
      const cr = kit.emboss(curb, R.mult, { cap: 1.2, base: 5, gain: 2 });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (curb.get(x, y) && Math.floor((x + 2) / 4) % 2) cb.set(x, y, cr.get(x, y));
      cb.outline(C.edge); f.blit(cb, 0, 0);
      // the tailcoat: maroon, dagged tails, gold-buttoned lapels, a cream shirt front
      const coat = Mask.fn(W, W, (x, y) => y >= 15 && y <= 24 && Math.abs(x - 14) <= Math.min(7.5, 4.5 + (y - 15) * 1.2) && !(y >= 22 && Math.abs(((x - 14 + 30) % 3) - 1) < 0.6 && Math.abs(x - 14) > 2));
      const ct = kit.emboss(coat, COAT, { cap: 2.6, base: 3, gain: 3.6 });
      for (let y = 16; y <= 24; y++) for (let x = 0; x < W; x++) if (ct.get(x, y) && Math.abs(x - 14) <= Math.min(2, (y - 15) * 0.4)) ct.set(x, y, C.cream);
      [[10, 18], [10, 21], [18, 18], [18, 21]].forEach(([x, y]) => { ct.set(x, y, R.gold[5]); ct.set(x, y + 1, R.gold[3]); });
      ct.outline(C.edge); f.blit(ct, 0, 0);
      // legs in white breeches and black boots, planted on the curb
      L.part(f, Mask.fn(W, W, (x, y) => y >= 24 && y <= 26 && (x === 11 || x === 12 || x === 16 || x === 17)), R.cream, { cap: 1, base: 5, gain: 2 });
      // the head, a grand grin, and the pointed collar with a bell on each point
      L.part(f, ellipse(W, W, 14, 11, 4.4, 4.2), SK, { cap: 3, base: 4, gain: 4.2 });
      f.set(12, 10, C.edge); f.set(16, 10, C.edge); f.set(11, 9, SK[1]); f.set(17, 9, SK[1]);
      f.draw(['k.....k', '.kWWWk.', '..kkk..'], 11, 12, { k: C.edge, W: C.white });
      L.part(f, Mask.rows(['x.........x', 'xxx.....xxx', '.xxxx.xxxx.', '..xxxxxxx..']), R.pink, { cap: 1, base: 5, gain: 3 }, 9, 14);
      L.bell(f, 7, 13); L.bell(f, 18, 13);
      // the tall hat: maroon with a gold band, lit along its upper-left edges
      const hat = kit.emboss(Mask.fn(W, W, (x, y) => (y >= 0 && y <= 6 && x >= 10 && x <= 18) || (y === 7 && x >= 8 && x <= 20)), COAT, { cap: 1.6, base: 3, gain: 3 });
      for (let x = 10; x <= 18; x++) { hat.set(x, 5, R.gold[5]); hat.set(x, 6, R.gold[3]); }
      for (let y = 0; y <= 6; y++) hat.set(10, y, R.maroon[7]);
      for (let x = 8; x <= 12; x++) hat.set(x, 7, R.maroon[6]);
      hat.outline(C.edge); f.blit(hat, 0, 0);
      // his whip arm raised to the right
      L.part(f, strokeQuad(W, W, [20, 17], [23.5, 15], [24.5, 11], 3), COAT, { cap: 1.2, base: 4, gain: 3 });
      L.part(f, ellipse(W, W, 24.5, 10, 1.7, 1.6), SK, { cap: 1, base: 4, gain: 3 });
      L.part(f, Mask.fn(W, W, (x, y) => x === 25 && y >= 5 && y <= 8), R.wood, { cap: 1, base: 4, gain: 2 });
      // three tiny Jokers bowing on the curb: cream card bodies, two-point pink and lime caps with bells
      const tiny = (x, y, lean) => {
        const t = new kit.Bmp(5, 7);
        t.draw(['g...g', 'pp.ll', '.pPl.', 'ckckc', 'ccmcc', 'ccccc', 'cCCCc'], 0, 0, { g: R.gold[5], p: R.pink[5], P: R.pink[3], l: R.lime[5], c: C.cream, C: R.cream[4], k: C.edge, m: R.pink[6] });
        f.blit(L.ink(L.shear(t, lean)), x, y);
      };
      tiny(0, 20, 0.5); tiny(5, 21, 0.34); tiny(24, 20, -0.5);
      return f;
    },
    overlay(k, b) {
      // the lash: a crackling arc of sparks over his head, from the whip's tip off to the left
      const fig = this.fig();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, x = Math.round((1 - t) * (1 - t) * 25 + 2 * (1 - t) * t * 16 + t * t * 3), y = Math.round((1 - t) * (1 - t) * 4 + 2 * (1 - t) * t * -4 + t * t * 8);
        if (!fig.get(x, y)) b.set(5 + x, 7 + y, i % 5 === 0 ? C.white : R.money[6]);
      }
      [[3, 6], [8, 0], [21, 1]].forEach(([x, y]) => L.spark(b, x, y, 5, 7, false));
    },
  }));

})();
