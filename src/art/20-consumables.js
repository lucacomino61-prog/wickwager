/* Tarot, Planet and Spectral cards. The frames (arched night window, round porthole, wavering ghost border,
 * plates) come from the core; each card here draws only its 31 x 31 illustration, in window coordinates
 * (the window's top-left is card pixel (5, 7)).
 * Seeded from the Ember Lit mockup, pixel-identical: The Ladder, Cinderon and Wickwisp.
 */
(() => {
  'use strict';
  const A = globalThis.TW.Art;

  // ---- The Ladder (tarot ladder): a wooden ladder, three cream cards each one rung higher, lime arrows up.
  // The core outlines the figure and clips it to the arch.
  A.tarot('ladder', {
    draw(k) {
      const { Bmp, R, C, pipBmp } = k;
      const f = new Bmp(31, 31);
      const rail = (x) => { for (let y = 2; y < 31; y++) { f.set(x, y, R.wood[5]); f.set(x + 1, y, R.wood[3]); } };
      rail(4); rail(11);
      for (let y = 5; y < 31; y += 5) { for (let x = 6; x < 11; x++) { f.set(x, y, R.wood[5]); f.set(x, y + 1, R.wood[2]); } }
      const mini = (x, y, suit) => {
        for (let j = 0; j < 9; j++) for (let i = 0; i < 7; i++) f.set(x + i, y + j, i === 6 || j === 8 ? C.cream3 : i === 0 || j === 0 ? C.white : C.cream);
        f.blit(pipBmp(suit, 5), x + 1, y + 2);
      };
      mini(14, 20, 'H'); mini(18, 12, 'S'); mini(22, 4, 'D');
      const arrow = ['..g..', '.ggg.', 'ggggg', '.gGg.', '.gGg.'];
      f.draw(arrow, 15, 13, { g: R.lime[6], G: R.lime[4] });
      f.draw(arrow, 19, 5, { g: R.lime[6], G: R.lime[4] });
      return f;
    },
  });

  // ---- Cinderon (planet kerplunk): a banded ember world with a pale cream ring passing in front of it.
  // The porthole, orbit and stars are the frame's; the world carries its own ink (planets are not outlined).
  A.planet('kerplunk', {
    draw(k) {
      const { Bmp, R, C, sphere } = k;
      const f = new Bmp(31, 31), cx = 15, cy = 15; // the porthole's centre, card (20, 22)
      const pl = sphere(8.2, R.ember, { lo: 1.2, k: 1.1, band: (x, y) => (Math.floor((y + 0.4 * (x - 8)) / 2.6) % 2 ? -0.7 : 0.2) });
      const plb = new Bmp(pl.w + 2, pl.h + 2); plb.blit(pl, 1, 1); plb.outline(C.edge);
      f.blit(plb, Math.round(cx - plb.w / 2 + 0.5), Math.round(cy - plb.h / 2 + 0.5));
      // the ring: it passes behind the world at the top middle and in front everywhere else
      for (let x = 2; x <= 28; x++) {
        const y = Math.round(cy + (x - cx) * -0.2);
        if (Math.abs(x - cx) > 3 || y > cy) { f.set(x, y, (x + 5) % 4 === 0 ? C.cream2 : C.cream); f.set(x, y + 1, '#C98C6A'); }
      }
      return f;
    },
  });

  // ---- Wickwisp (spectral spellbound): a ghost-blue wisp with two dark eyes burning as the flame of a cream
  // candle on a plum dish. The core outlines it.
  A.spectral('spellbound', {
    draw(k) {
      const { Bmp, Mask, R, C, emboss } = k;
      const f = new Bmp(31, 31);
      const wisp = Mask.fn(31, 31, (x, y) => {
        if ((x - 15) ** 2 + (y - 11) ** 2 <= 5.4 * 5.4) return true;
        if (y < 1 || y > 11) return false;
        const t = (y - 1) / 10;
        return Math.abs(x - 15 - Math.sin(y * 0.75) * 1.6 * (1 - t)) <= t * 4.8;
      });
      f.blit(emboss(wisp, R.ghost, { cap: 2.6, base: 4, gain: 3.8 }), 0, 0);
      f.rect(12, 10, 2, 2, C.edge); f.rect(17, 10, 2, 2, C.edge); f.set(12, 10, R.ghost[2]); f.set(17, 10, R.ghost[2]);
      f.rect(14, 14, 3, 1, R.ghost[2]);
      f.set(15, 16, C.edge);
      const wax = Mask.fn(31, 31, (x, y) => x >= 11 && x <= 19 && y >= 17 && y <= 26);
      f.blit(emboss(wax, R.cream, { cap: 2, base: 5, gain: 3 }), 0, 0);
      f.draw(['.www.', '.wWw.', '..w..'], 13, 17, { w: C.white, W: C.cream });
      for (let x = 7; x <= 23; x++) { f.set(x, 27, R.plum[5]); f.set(x, 28, R.plum[3]); }
      return f;
    },
  });
})();

/* The rest of the Tarot, Planet and Spectral cards, drawn for the game in Lit's language.
 * Each is one clear emblem tied to the card's name and effect, drawn from ramps lit from the upper left. Light
 * that falls round things (a lamp's beam, a ghost's glow, a door's spill) is laid over the finished card by overlay(),
 * clipped to the window, in two hard steps and on background pixels only, so it never washes out a figure or the
 * core's ink. Where a thing is itself see-through (a ghost stepping out of a wall, a jester fading), the veil is
 * laid over that thing alone.
 * Shared helpers live in TW.Art.lib.consumables.
 */
(() => {
  'use strict';
  const A = globalThis.TW.Art, K = A.kit;
  const { Bmp, Mask, R, C, emboss, strokeQuad, pipBmp } = K;
  const L = (A.lib.consumables = A.lib.consumables || {});
  const W = 31;

  // ------------------------------------------------------------ helpers
  /** A part with its own ink: padded by 1 px and outlined, so parts that overlap keep an ink line between them. */
  L.inked = (b) => { const o = new Bmp(b.w + 2, b.h + 2); o.blit(b, 1, 1); o.outline(C.edge); return o; };
  /** Lay an inked part so that its own pixels land at (x, y) (its ink one pixel outside). */
  L.put = (f, b, x, y, o) => f.blit(L.inked(b), x - 1, y - 1, o);
  /** Shade a window-sized mask with a ramp (emboss) and lay it down. */
  L.lay = (f, m, ramp, o) => f.blit(emboss(m, ramp, o), 0, 0);
  /** The same, with its own ink edge: for a part that sits in front of others. */
  L.layInk = (f, m, ramp, o) => { const p = emboss(m, ramp, o); p.outline(C.edge); f.blit(p, 0, 0); };
  /** A window-sized mask from a test on window pixels. */
  L.mask = (fn) => Mask.fn(W, W, fn);
  /** Card stocks: [highlight, face, shade, lip]. */
  L.STOCK = Object.freeze({
    cream: [C.white, C.cream, C.cream1, C.cream3],
    lit: [C.white, C.white, C.cream, C.cream2],
    peach: [R.peach[7], R.peach[6], R.peach[5], R.peach[3]],
    carbon: [R.chips[4], R.chips[3], R.chips[2], R.chips[1]],
    wax: [R.chips[8], R.chips[7], R.chips[6], R.chips[5]],
    ghost: [R.ghost[6], R.ghost[5], R.ghost[4], R.ghost[3]],
  });
  /** A small playing card, w x h, lit from the upper left, its corners nipped. o: { pip, big, px, py, stock } */
  L.card = (w, h, o = {}) => {
    const [hi, face, sh, lip] = o.stock || L.STOCK.cream;
    const b = new Bmp(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue;
      b.set(x, y, x === w - 1 || y === h - 1 ? lip : x === 0 || y === 0 ? hi : w > 9 && (x === w - 2 || y === h - 2) ? sh : face);
    }
    if (o.pip) { const p = pipBmp(o.pip, o.big ? 7 : 5); b.blit(p, o.px ?? Math.floor((w - p.w) / 2), o.py ?? Math.floor((h - p.h) / 2)); }
    return b;
  };
  /** A coin, flat yellow with one amber rim on its lower right and a glint (cash is never a gold ramp). */
  L.coin = (d) => {
    const b = new Bmp(d, d), c = (d - 1) / 2, r = d / 2;
    const on = (x, y) => (x - c) ** 2 + (y - c) ** 2 <= r * r - (d <= 5 ? 0.6 : 0.2);
    for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
      if (!on(x, y)) continue;
      const edge = !on(x + 1, y) || !on(x, y + 1) || !on(x + 1, y + 1);
      b.set(x, y, edge && x + y >= d - 1 ? R.money[3] : R.money[5]);
    }
    b.set(Math.round(c - r / 2), Math.round(c - r / 2), R.money[8]);
    return b;
  };
  /** A coin lying flat, seen from a little above: a yellow oval over an amber edge. */
  L.coinFlat = () => new Bmp(6, 3).draw(['.vyyy.', 'yyyyyy', '.aaaa.'], 0, 0, { v: R.money[8], y: R.money[5], a: R.money[3] });
  /** A coin seen edge-on, mid-flip: a narrow upright lozenge. */
  L.coinEdge = (h) => { const b = new Bmp(3, h); for (let y = 1; y < h - 1; y++) { b.set(0, y, R.money[5]); b.set(1, y, R.money[6]); b.set(2, y, R.money[3]); } b.set(1, 0, R.money[5]); b.set(1, h - 1, R.money[3]); return b; };
  /** A four-point spark: c arms round a v centre. */
  L.spark = (f, x, y, c, v = C.white) => f.draw(['.c.', 'cvc', '.c.'], x - 1, y - 1, { c, v });
  /** A taller twinkle: arms two long. */
  L.twinkle = (f, x, y, c, v = C.white) => f.draw(['..c..', '..c..', 'ccvcc', '..c..', '..c..'], x - 2, y - 2, { c, v });
  /** A soft curl of smoke along a quadratic, thinning as it rises (ramp dark to light). */
  L.smoke = (f, p0, p1, p2, ramp, w0 = 2.6, w1 = 1.2) => L.lay(f, strokeQuad(W, W, p0, p1, p2, (t) => w0 + (w1 - w0) * t), ramp, { cap: 1.2, base: ramp.length - 3, gain: 2.6 });
  /** Round puffs of smoke or mist: discs [x, y, r], shaded together as one soft mass lit from the upper left. */
  L.puffs = (f, discs, ramp, o = {}) => L.lay(f, L.mask((x, y) => discs.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r)), ramp, { cap: 1.8, base: ramp.length - 3, gain: 3, ...o });
  /** Crumpled paper: the mask shaded like a pillow, then split into seeded facets, each tilted toward or away
      from the light, with a crease three shades darker where two facets meet, and a white glint on the two
      facets that face the light most. */
  L.crumple = (m, seed, ramp = R.cream) => {
    const rnd = K.rng(seed), cells = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y)) cells.push([x, y]);
    const n = Math.max(3, Math.round(cells.length / 10));
    const pts = Array.from({ length: n }, () => { const [x, y] = cells[Math.floor(rnd() * cells.length)]; return { x: x + rnd() - 0.5, y: y + rnd() - 0.5, t: rnd() }; });
    const base = emboss(m, ramp, { cap: 2.4, base: ramp.length - 3, gain: 3 });
    const b = new Bmp(m.w, m.h), owner = new Map();
    for (const [x, y] of cells) {
      let best = 1e9, second = 1e9, bi = 0;
      pts.forEach((p, i) => { const d = (x - p.x) ** 2 + (y - p.y) ** 2; if (d < best) { second = best; best = d; bi = i; } else if (d < second) second = d; });
      const at = ramp.indexOf(base.get(x, y));
      let idx = at + Math.round((pts[bi].t - 0.5) * 3);
      const crease = Math.sqrt(second) - Math.sqrt(best) < 0.7;
      if (crease) idx = Math.min(idx, at) - 3;
      b.set(x, y, ramp[Math.max(2, Math.min(ramp.length - 1, idx))]);
      if (!crease) owner.set(x + ',' + y, bi);
    }
    // the glints: on the two facets facing the light (most tilted toward it, in the upper-left half), the pixel
    // nearest each facet's seed
    let cx = 0, cy = 0; cells.forEach(([x, y]) => { cx += x; cy += y; }); cx /= cells.length; cy /= cells.length;
    pts.map((p, i) => ({ ...p, i })).filter((p) => p.x + p.y < cx + cy).sort((a, b2) => b2.t - a.t).slice(0, 2).forEach((p) => {
      let bx = -1, by = -1, bd = 1e9;
      owner.forEach((i, key) => { if (i !== p.i) return; const [x, y] = key.split(',').map(Number); const d = (x - p.x) ** 2 + (y - p.y) ** 2; if (d < bd) { bd = d; bx = x; by = y; } });
      if (bx >= 0) b.set(bx, by, C.white);
    });
    return b;
  };
  /** Fire: colour a flame mask by its heat, white-hot round (hx, hy), through yellow and orange to red tips. */
  L.fire = (f, m, hx, hy, scale = 1) => {
    const steps = [[2.2, R.ember[8]], [4.2, R.ember[7]], [6.2, R.ember[6]], [8.4, R.ember[5]], [1e9, R.mult[4]]];
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      if (!m.get(x, y)) continue;
      const d = Math.hypot(x - hx, (y - hy) * 1.15) / scale;
      f.set(x, y, steps.find(([r]) => d < r)[1]);
    }
  };
  /** The ladder's lime arrow, pointing up (or down with flip). */
  L.arrow = (f, x, y, down = false) => f.draw(['..g..', '.ggg.', 'ggggg', '.gGg.', '.gGg.'], x, y, { g: R.lime[6], G: R.lime[4] }, { flipY: down });

  // The windows in card pixels, for overlays: the Tarot arch, the Planet porthole, the Spectral rectangle.
  const IN = {
    tarot: (x, y) => x >= 5 && x <= 35 && y >= 7 && y <= 37 && K.tarotArch(x, y),
    planet: (x, y) => Math.hypot(x - 20, y - 22) <= 14.3,
    spectral: (x, y) => x >= 5 && x <= 35 && y >= 7 && y <= 37,
  };
  L.IN = IN;
  /** Lay light over the finished card inside its window: fn(x, y) in window pixels returns '#RRGGBBAA' or null. */
  L.light = (b, kind, fn) => { for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { if (!IN[kind](x + 5, y + 7)) continue; const c = fn(x, y); if (c) b.mix(x + 5, y + 7, c); } };
  // The bare frames, to tell the background (pixels the item left as the frame drew them) from the figure. The
  // background of a card is measured once, the first time an overlay asks, before any light has been laid on it.
  const FRAME = { tarot: K.tarotFrame, planet: K.planetFrame, spectral: K.spectralFrame }, BARE = {}, BG = new WeakMap();
  L.bare = (kind) => BARE[kind] || (BARE[kind] = FRAME[kind]().b);
  /** True where the finished card still shows its bare frame at window pixel (x, y): the night, not the figure. */
  L.isBg = (b, kind, x, y) => {
    if (!BG.has(b)) { const fr = L.bare(kind); BG.set(b, Mask.fn(W, W, (i, j) => b.get(i + 5, j + 7) === fr.get(i + 5, j + 7))); }
    return !!BG.get(b).get(x, y);
  };
  /** Light on the background only: fn(x, y) -> '#RRGGBBAA' or null, skipped wherever the figure is. */
  L.bgLight = (b, kind, fn) => L.light(b, kind, (x, y) => (L.isBg(b, kind, x, y) ? fn(x, y) : null));
  /** A pool of light round a figure, in two hard steps, on the background only (c is '#RRGGBB'). */
  L.glow = (b, kind, cx, cy, r, c, a = ['30', '1A'], sy = 1) => L.bgLight(b, kind, (x, y) => { const d = Math.hypot(x - cx, (y - cy) * sy); return d < r * 0.6 ? c + a[0] : d < r ? c + a[1] : null; });

  /** A jester's head in profile (never the front-facing grin): a cap with a band whose point rises above the crown,
      then flops back and down to a bell behind the head. o: { skin, cap, band (ramps), open (mouth open), fore (a
      second point flopping forward over the brow to its own bell), left (looking left) } -> 20 x 22 (24 x 22 with
      fore), not inked. Looking right, the face is at x 13 to 19 and the eye at (14, 14); looking left, mirror x.
      A head looking left is drawn from mirrored masks, not flipped pixels, so its light still falls from the upper
      left. */
  L.jesterHead = (o = {}) => {
    const w = o.fore ? 24 : 20, h = 22, b = new Bmp(w, h);
    const X = o.left ? (x) => w - 1 - x : (x) => x;
    const M = (fn) => Mask.fn(w, h, (x, y) => fn(X(x), y));
    const Q = (p0, p1, p2, wid) => { const m = strokeQuad(w, h, p0, p1, p2, wid); return o.left ? m.flipX() : m; };
    const px = (x, y, c) => b.set(X(x), y, c);
    const rect = (x, y, rw, rh, c) => b.rect(o.left ? w - x - rw : x, y, rw, rh, c);
    const skin = o.skin || R.peach, cap = o.cap || R.mult, band = o.band || R.gold;
    const head = M((x, y) => ((x - 12) / 5.5) ** 2 + ((y - 15) / 6) ** 2 <= 1 || ((x - 17.6) / 1.7) ** 2 + ((y - 15) / 1.5) ** 2 <= 1);
    b.blit(emboss(head, skin, { cap: 2.5, base: skin.length - 3, gain: 3.5 }), 0, 0);
    const capM = M((x, y) => y <= 12 && ((x - 12) / 6.6) ** 2 + ((y - 12.5) / 6.8) ** 2 <= 1);
    capM.or(Q([10, 8], [5, -4.5], [3.5, 11], (t) => 3.8 - t * 2));
    if (o.fore) capM.or(Q([15, 7], [21, -1], [21.5, 7.5], (t) => 3.4 - t * 1.8));
    b.blit(emboss(capM, cap, { cap: 2, base: cap.length - 4, gain: 3.5 }), 0, 0);
    for (let x = 6; x <= 18; x++) { px(x, 12, band[band.length - 2]); px(x, 13, band[band.length - 4]); }
    const bell = ['.bb.', 'bBBb', 'bBBb', '.kk.'], key = { b: band[band.length - 3], B: band[band.length - 2], k: C.edge };
    b.draw(bell, o.left ? w - 6 : 2, 10, key);
    if (o.fore) b.draw(bell, o.left ? 0 : 20, 7, key);
    rect(14, 14, 1, 2, C.edge);
    rect(13, 17, 2, 1, R.pink[6]);
    if (o.open) { rect(16, 17, 2, 2, R.mult[0]); b.del(X(17), 17); b.del(X(17), 18); px(16, 19, R.mult[1]); }
    else rect(16, 18, 2, 1, C.edge);
    return b;
  };
  /** The same head looking left. */
  L.jesterLeft = (o = {}) => L.jesterHead({ ...o, left: true });

  // ============================================================ TAROT
  // A violet card, an arched window on a night sky, the sun-eye above. Each picture is one emblem of what the card
  // does, in warm colours that stand out on the violet sky. The core inks the figure and clips it to the arch, so
  // every part stays inside it: the arch's top corners are cut away above window row 10.

  // ---- The Candlemaker (inkpot): makes cards Waxed. A candle-dipping rack: a wooden rod with a cream card hanging
  // from its middle and a taper either side, all three dipped pale blue at the bottom, over a tall copper pot of
  // wax that one drip is falling back into.
  A.tarot('inkpot', {
    draw() {
      const f = new Bmp(W, W);
      const COPPER = R.ember.slice(0, 7);
      // the pot: tall and narrow, a rolled rim, loop ears, its mouth full of pale-blue wax
      [[6, 23], [22, 23]].forEach(([x, y]) => f.draw(['cc.', 'c.c', 'cc.'], x, y, { c: COPPER[3] }, { flipX: x > 15 }));
      L.lay(f, L.mask((x, y) => y >= 21 && y <= 30 && Math.abs(x - 15) <= 6 - Math.max(0, y - 28) * 1.2), COPPER, { cap: 3, base: 3, gain: 4 });
      L.lay(f, L.mask((x, y) => ((x - 15) / 7.6) ** 2 + ((y - 20.5) / 1.7) ** 2 <= 1), COPPER, { cap: 1, base: 5, gain: 1.5 });
      for (let x = 10; x <= 20; x++) { f.set(x, 20, x <= 12 ? R.chips[8] : R.chips[7]); if (Math.abs(x - 15) <= 3) f.set(x, 21, R.chips[6]); }
      // the drip, falling from the card's bottom edge back into the pot
      f.rect(15, 17, 1, 2, R.chips[7]); f.set(15, 17, R.chips[8]);
      // the rack: a wooden rod, lit along its top
      for (let x = 6; x <= 24; x++) { f.set(x, 1, R.wood[5]); f.set(x, 2, R.wood[3]); }
      // two tapers on their wicks, one near each end of the rod, dipped at the tips
      const taper = new Bmp(3, 11);
      for (let y = 0; y < 11; y++) { const dip = y >= 8; taper.set(0, y, dip ? R.chips[8] : C.white); taper.set(1, y, dip ? R.chips[7] : C.cream); taper.set(2, y, dip ? R.chips[6] : C.cream3); }
      taper.del(0, 10); taper.del(2, 10);
      [6, 24].forEach((x) => { f.set(x, 3, C.cream4); L.put(f, taper, x - 1, 4); });
      // the card on its wick, cream above and glazed blue below a dipping line that runs in little drips
      f.rect(15, 3, 1, 2, C.cream4);
      const card = L.card(9, 10, { pip: 'H', py: 1 });
      const line = [6, 6, 7, 8, 7, 6, 7, 8, 7];
      for (let x = 0; x < 9; x++) for (let y = line[x] - 1; y < 10; y++) if (card.get(x, y)) card.set(x, y, x === 0 ? R.chips[8] : x === 8 || y === 9 ? R.chips[5] : R.chips[7]);
      L.put(f, card, 11, 5);
      return f;
    },
  });

  // ---- Fire-Eater (boxingglove): makes cards Kindled. A jester fire-eater in a red-and-gold cap breathing a curl
  // of ember flame out over two cards, whose tops glow from the heat.
  A.tarot('boxingglove', {
    draw() {
      const f = new Bmp(W, W);
      // the two cards, lower right, their top edges warmed ember
      const warm = (c) => { for (let x = 1; x < c.w - 1; x++) { c.set(x, 0, R.ember[6]); c.set(x, 1, R.ember[7]); } return c; };
      L.put(f, warm(L.card(8, 11, { pip: 'H', py: 4 })), 17, 20);
      L.put(f, warm(L.card(8, 11, { pip: 'D', py: 4 })), 23, 21);
      // the fire-eater, his cap's point rising clear of the arch
      L.put(f, L.jesterHead({ open: true }), -1, 2);
      // the flame: a jet from the mouth bursting into a fireball whose tongues lick upward
      const jet = strokeQuad(W, W, [16, 19], [19, 18], [21, 15.5], 3);
      L.fire(f, L.mask((x, y) => {
        if (((x - 23.5) / 5.6) ** 2 + ((y - 13) / 4.4) ** 2 <= 1 || jet.get(x, y)) return true;
        return [[18.5, 12, 4, 1.8], [21.5, 10, 7, 2.4], [25, 10, 6.5, 2.2], [28, 12, 4.5, 1.6]].some(([cx, by, ht, hw]) => y <= by && y >= by - ht && Math.abs(x - cx - (by - y) * 0.15) <= hw * (y - (by - ht)) / ht);
      }), 22, 15);
      return f;
    },
  });

  // ---- Gold Leaf (pricegun): makes a card Gilt-Edged. A sheet of gold leaf lifting off a little wooden booklet
  // onto a tall cream card gilded the way a Gilt-Edged card is (gold caps on its corners, a gilt fore-edge down its
  // right side; the rest stays cream, so gold never fills the card), one flake drifting free.
  A.tarot('pricegun', {
    draw() {
      const f = new Bmp(W, W);
      // the card: cream, a gold cap on each corner (lit on its outer top and left edges, shaded on the bottom and
      // right) and page lines of gilt down the fore-edge
      const card = L.card(13, 19, { pip: 'D', big: true });
      for (let y = 0; y < 19; y++) for (let x = 0; x < 13; x++) {
        if (!card.get(x, y)) continue;
        const cap = (x <= 2 || x >= 10) && (y <= 2 || y >= 16) && (x <= 1 || x >= 11 || y <= 1 || y >= 17);
        if (cap) card.set(x, y, (x === 0 || y === 0) && x < 10 && y < 16 ? R.gold[5] : x >= 11 || y >= 17 ? R.gold[2] : R.gold[4]);
        else if (x === 11 && y >= 4 && y <= 14) card.set(x, y, y % 2 ? R.gold[2] : R.gold[4]);
      }
      L.put(f, card, 15, 6);
      // the leaf: a gold leaf taken at its word, a pointed blade with a vein and a stem, drifting down onto the
      // card's edge, and a smaller one still falling
      const blade = L.mask((x, y) => { const u = (x - 8) * 0.8 + (y - 18) * 0.6, v = -(x - 8) * 0.6 + (y - 18) * 0.8; return Math.abs(v) <= 3.6 * Math.max(0, 1 - (u / 7.4) ** 2) ** 0.8 && Math.abs(u) <= 7.4; });
      L.layInk(f, blade, R.gold, { cap: 1.8, base: 4, gain: 3.2 });
      for (let t = -5; t <= 5; t++) f.set(Math.round(8 + t * 0.8), Math.round(18 + t * 0.6), R.gold[3]);
      [[-2, 1], [1, 1], [-2, -1], [1, -1]].forEach(([t, s]) => f.set(Math.round(8 + t * 0.8 - s * 0.6 * 2), Math.round(18 + t * 0.6 + s * 0.8 * 2), R.gold[3]));
      f.line(2, 13, 0, 11, R.gold[2]);
      const small = L.mask((x, y) => { const u = (x - 6) * 0.6 - (y - 6) * 0.8, v = (x - 6) * 0.8 + (y - 6) * 0.6; return Math.abs(v) <= 1.8 * Math.max(0, 1 - (u / 3.6) ** 2) && Math.abs(u) <= 3.6; });
      L.layInk(f, small, R.gold, { cap: 1, base: 4, gain: 2.5 });
      return f;
    },
  });

  // ---- The Seamstress (threedglasses): makes a card Sequined. A cream card with a heart sewn on it in pink and
  // gold sequins, a steel needle trailing a loop of pink thread, and a pink tomato pincushion bristling with pins.
  A.tarot('threedglasses', {
    draw() {
      const f = new Bmp(W, W);
      const card = L.card(15, 20);
      // the sequins, round discs with a white glint, set along a heart's outline
      [[4, 4], [10, 4], [7, 6], [2, 8], [12, 8], [4, 12], [10, 12], [7, 15]].forEach(([x, y], i) => card.draw(['.s.', 'sWs', '.s.'], x - 1, y - 1, { s: i % 2 ? R.gold[4] : R.pink[5], W: C.white }));
      L.put(f, card, 4, 7);
      // the thread: a loose pink loop from the needle's eye, out to its left and back down onto the card
      const thread = strokeQuad(W, W, [23, 5], [12, 0.5], [16, 10], 1.2);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (thread.get(x, y)) f.set(x, y, R.pink[6]);
      // the needle, on a long diagonal, its eye at the upper right and its point glinting
      L.lay(f, strokeQuad(W, W, [26, 4], [20.5, 10.5], [12, 21], (t) => 2.6 - t * 1.4), R.steel, { cap: 1, base: 3, gain: 2.5 });
      f.set(25, 5, C.edge); f.set(24, 6, C.edge);
      L.spark(f, 12, 21, R.steel[5]);
      // the pincushion: a pink tomato with creases down it and a lime leaf cap, four pins fanned out of it
      [[20, 25, 17, 19, R.gold], [23, 23, 22, 17, R.lime], [25, 23, 27, 17, R.chips], [27, 24, 29, 20, null]].forEach(([x0, y0, x1, y1, r]) => {
        f.line(x0, y0, x1, y1, R.steel[4]);
        if (r) { f.rect(x1 - 1, y1 - 1, 2, 2, r === R.chips ? r[6] : r[5]); f.set(x1 - 1, y1 - 1, r === R.chips ? r[8] : r[6]); } else { f.rect(x1 - 1, y1 - 1, 2, 2, C.white); f.set(x1, y1, C.cream2); }
      });
      L.layInk(f, L.mask((x, y) => ((x - 24) / 5.4) ** 2 + ((y - 26.5) / 3.8) ** 2 <= 1), R.pink, { cap: 2, base: 5, gain: 3.5 });
      for (let y = 24; y <= 29; y++) { const dx = Math.round((y - 24) * 0.35); if (f.get(21 - dx, y) !== C.edge) f.set(21 - dx, y, R.pink[3]); if (f.get(26 + dx, y) !== C.edge) f.set(26 + dx, y, R.pink[3]); }
      f.draw(['.ll.', 'lLLl'], 22, 22, { l: R.lime[5], L: R.lime[6] });
      return f;
    },
  });

  // ---- Masquerade (crayon): makes cards Masked. A gold masquerade mask with almond cat-eyes, held up on a stick,
  // a pink plume at its temple, in front of two cream cards; the night shows through the eye-holes.
  A.tarot('crayon', {
    draw() {
      const f = new Bmp(W, W);
      // two cards behind, above the mask
      L.put(f, L.card(9, 11, { pip: 'H', big: true }), 9, 2);
      L.put(f, L.card(9, 11, { pip: 'S', big: true }), 17, 3);
      // the stick, from the right lobe's lower edge down to the right
      L.lay(f, strokeQuad(W, W, [22, 19], [25, 25], [27, 31], 2.4), R.gold.slice(1), { cap: 1, base: 3, gain: 2 });
      // the mask: two lobes joined over the nose, upswept points at the temples, almond eye-holes
      const mask = L.mask((x, y) => {
        const lobe = (cx) => ((x - cx) / 7.2) ** 2 + ((y - 16) / 4.3) ** 2 <= 1;
        return (lobe(9) || lobe(21)) && !(y >= 18 && Math.abs(x - 15) <= (y - 17) * 0.9);
      });
      mask.or(strokeQuad(W, W, [5, 15], [1.5, 14], [2, 8.5], (t) => 3.8 - t * 2.8));
      mask.or(strokeQuad(W, W, [25, 15], [28.5, 14], [28, 8.5], (t) => 3.8 - t * 2.8));
      const eyes = new Mask(W, W);
      eyes.or(Mask.rows(['XX......', '.XXXXXX.', '..XXXXXX', '..XXXXX.', '....XX..']), 5, 13);
      eyes.or(Mask.rows(['......XX', '.XXXXXX.', 'XXXXXX..', '.XXXXX..', '..XX....']), 17, 13);
      mask.sub(eyes);
      const gm = emboss(mask, R.gold, { cap: 2, base: 4, gain: 3.5 });
      gm.outline(C.edge);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (eyes.get(x, y) && gm.get(x, y) !== C.edge) gm.del(x, y);
      f.blit(gm, 0, 0);
      // a pink jewel on the bridge
      f.rect(14, 13, 2, 2, R.pink[5]); f.set(14, 13, R.pink[7]);
      // the plume: a pink feather rising from the left temple and curling over at its tip, a pale quill down it
      const P = [[5, 14], [1.5, 7], [7.5, 1.5]];
      L.layInk(f, strokeQuad(W, W, ...P, (t) => 1.4 + 3.6 * Math.sin(Math.PI * Math.min(1, t * 1.1))), R.pink, { cap: 1.6, base: 5, gain: 3 });
      for (let i = 2; i <= 15; i++) { const t = i / 20, x = (1 - t) ** 2 * P[0][0] + 2 * (1 - t) * t * P[1][0] + t * t * P[2][0], y = (1 - t) ** 2 * P[0][1] + 2 * (1 - t) * t * P[1][1] + t * t * P[2][1]; f.set(Math.round(x + 0.4), Math.round(y), R.pink[7]); }
      return f;
    },
  });

  // ---- Spotlight (spotlight): makes cards Spotlit. A brass stage lamp on a tripod throwing a cone of light onto one
  // bright card. The cone is laid over the night only, so the card keeps its ink and its pip.
  A.tarot('spotlight', {
    draw() {
      const f = new Bmp(W, W);
      // the tripod: three steel legs
      f.line(8, 14, 3, 30, R.steel[2]); f.line(8, 14, 8, 30, R.steel[3]); f.line(9, 14, 13, 30, R.steel[1]);
      // the lamp: a brass can tipped toward the lower right, its lens glowing
      f.draw([
        '..bbBB....',
        '.bBBBBBb..',
        'bBBBBBBBl.',
        'bBBBBBBlLl',
        '.bBBBBBlLL',
        '..dBBBdlLl',
        '...dddd.l.',
      ], 2, 7, { b: R.brass[4], B: R.brass[5], d: R.brass[2], l: R.ember[7], L: C.white });
      f.rect(6, 6, 2, 1, R.brass[3]);
      // the card, standing in the light, its stock lit white
      L.put(f, L.card(10, 13, { pip: 'S', stock: L.STOCK.lit }), 19, 14);
      return f;
    },
    overlay(k, b) {
      // the cone: from the lens down to the card and the floor round it, two steps of warm light on the night
      const ox = 11.5, oy = 11, a0 = Math.atan2(30 - oy, 15 - ox), a1 = Math.atan2(13 - oy, 31 - ox);
      L.bgLight(b, 'tarot', (x, y) => {
        const a = Math.atan2(y - oy, x - ox), d = Math.hypot(x - ox, y - oy);
        if (d < 2 || a < a1 || a > a0) return null;
        const mid = (a0 + a1) / 2, core = Math.abs(a - mid) < (a0 - a1) * 0.26;
        return core ? '#FFE6C288' : '#FFE6C24C';
      });
      // where it lands: a pool on the floor under the card
      L.bgLight(b, 'tarot', (x, y) => { const d = Math.hypot((x - 24) / 7, (y - 29.5) / 1.6); return d < 0.62 ? '#FFE6C266' : d < 1 ? '#FFE6C233' : null; });
    },
  });

  // ---- Heirloom (backissues): makes cards Vintage. A wooden keepsake box with gold corners, its lid open on a
  // bundle of peach-aged cards tied with string.
  A.tarot('backissues', {
    draw() {
      const f = new Bmp(W, W);
      // the lid, open behind: a wooden frame lined with maroon velvet, gold caps at its top corners
      const lid = new Bmp(23, 10);
      lid.rect(0, 0, 23, 10, R.wood[3]); lid.rect(0, 0, 23, 1, R.wood[5]); lid.rect(0, 0, 1, 10, R.wood[4]);
      lid.rect(2, 2, 19, 7, R.maroon[3]); lid.rect(2, 2, 19, 1, R.maroon[1]); lid.rect(3, 3, 1, 5, R.maroon[4]);
      lid.rect(0, 0, 3, 2, R.gold[5]); lid.set(0, 2, R.gold[4]); lid.rect(20, 0, 3, 2, R.gold[4]); lid.set(22, 2, R.gold[3]);
      L.put(f, lid, 4, 6);
      // the bundle of aged cards standing in the box, foxed with burnt-orange spots, a band of twine round them
      const aged = (pip) => { const c = L.card(9, 13, { stock: L.STOCK.peach, pip, py: 2 }); c.set(6, 8, R.ember[3]); c.set(2, 10, R.ember[4]); return c; };
      L.put(f, aged('S'), 7, 9); L.put(f, aged('D'), 15, 9); L.put(f, aged('H'), 11, 7);
      f.rect(7, 15, 17, 1, R.cream[3]); f.rect(7, 16, 17, 1, R.cream[2]);
      f.draw(['t.t', '.T.', 't.t'], 14, 14, { t: R.cream[4], T: R.cream[2] });
      // the box: a wooden front with a darker plank seam, gold corner caps and a clasp
      const box = new Bmp(23, 11);
      for (let y = 0; y < 11; y++) for (let x = 0; x < 23; x++) box.set(x, y, y === 0 ? R.wood[5] : x === 0 ? R.wood[4] : x === 22 || y === 10 ? R.wood[1] : y === 5 ? R.wood[2] : R.wood[3]);
      [[0, 0], [20, 0], [0, 8], [20, 8]].forEach(([x, y], i) => { box.rect(x, y, 3, 3, i % 2 ? R.gold[3] : R.gold[4]); box.set(x + (i % 2 ? 2 : 0), y + (i > 1 ? 2 : 0), R.gold[5]); });
      box.rect(10, 0, 3, 4, R.gold[4]); box.set(10, 0, R.gold[6]); box.set(11, 2, C.edge);
      L.put(f, box, 4, 19);
      return f;
    },
  });

  // ---- Tinderbox (scrunch): makes cards Crumpled. An open tin tinderbox stuffed with crumpled cream cards, one
  // ember spark landing on the top one and scorching it. Tin, not wood, so it never twins Heirloom's wooden chest.
  A.tarot('scrunch', {
    draw() {
      const f = new Bmp(W, W);
      // the lid, hinged open behind: tin, dark inside
      const lid = new Bmp(23, 7);
      lid.rect(0, 0, 23, 7, R.steel[2]); lid.rect(0, 0, 23, 1, R.steel[4]); lid.rect(0, 0, 1, 7, R.steel[3]); lid.rect(22, 0, 1, 7, R.steel[1]);
      lid.rect(2, 2, 19, 4, R.plum[2]); lid.rect(2, 2, 19, 1, R.plum[1]);
      L.put(f, lid, 4, 11);
      // the crumpled cards: balled-up sheets with jagged outlines, folded into facets, two still showing a pip
      const ball = (cx, cy, rx, ry, seed, pip) => {
        const rnd = K.rng('tinder' + seed), n = 9, rad = Array.from({ length: n }, () => 0.72 + rnd() * 0.42);
        const m = L.mask((x, y) => {
          const a = (Math.atan2((y - cy) / ry, (x - cx) / rx) / (Math.PI * 2) + 1) % 1 * n, i = Math.floor(a), t = a - i;
          return Math.hypot((x - cx) / rx, (y - cy) / ry) <= rad[i] * (1 - t) + rad[(i + 1) % n] * t;
        });
        const p = L.crumple(m, 'scrunch' + seed);
        if (pip) p.blit(pipBmp(pip[0], 5), pip[1], pip[2]);
        p.outline(C.edge);
        return p;
      };
      f.blit(ball(8, 17, 5, 4.2, 1, ['S', 4, 15]), 0, 0);
      f.blit(ball(22, 17, 5, 4.2, 4), 0, 0);
      f.blit(ball(15, 14, 5.6, 4.8, 2, ['H', 13, 12]), 0, 0);
      // the box's front: tin with a lit rim, two pressed seams, a brass hasp
      const box = new Bmp(23, 10);
      for (let y = 0; y < 10; y++) for (let x = 0; x < 23; x++) box.set(x, y, y === 0 ? R.steel[5] : x === 0 ? R.steel[4] : x === 22 || y === 9 ? R.steel[1] : y === 2 || y === 7 ? R.steel[2] : R.steel[3]);
      box.rect(10, 0, 3, 2, R.brass[4]); box.set(10, 0, R.brass[6]); box.set(12, 1, R.brass[2]);
      L.put(f, box, 4, 20);
      // the spark landing on the top ball, a short trail behind it, a scorch where it touches
      let top = 0; while (top < W && !f.get(15, top)) top++;
      f.set(15, top + 1, R.ember[6]); f.set(16, top + 1, R.ember[5]);
      f.draw(['..o..', '..y..', 'oyvyo', '..y..', '..o..'], 13, top - 4, { o: R.ember[5], y: R.ember[7], v: C.white });
      f.set(12, top - 4, R.ember[4]); f.set(11, top - 5, R.ember[3]);
      return f;
    },
  });

  // ---- Candle Snuffer (eraser): destroys cards for $1 each. A brass snuffer on a straight handle with a ring at its
  // end, held just above a card whose top edge is burnt ragged; smoke escapes from under its rim.
  A.tarot('eraser', {
    draw() {
      const f = new Bmp(W, W);
      const SMOKE = [R.steel[1], R.steel[2], R.steel[3], R.steel[4], R.steel[5]];
      // the card, its top burnt away in a ragged line, char along it with embers still glowing
      const card = L.card(11, 15, { pip: 'S', big: true, py: 6 });
      const cut = [1, 2, 1, 0, 1, 2, 2, 1, 0, 1, 1];
      for (let x = 0; x < 11; x++) {
        for (let y = 0; y < cut[x]; y++) card.del(x, y);
        card.set(x, cut[x], (x * 7) % 3 ? R.plum[2] : R.plum[1]);
      }
      card.set(2, cut[2], R.ember[6]); card.set(6, cut[6], R.ember[6]); card.set(9, cut[9], R.ember[5]);
      L.put(f, card, 9, 16);
      // the smoke: round puffs curling up in an S from the rim's left end, and two threads escaping under it
      L.puffs(f, [[7, 10, 2.2], [4.6, 6.6, 1.9], [7.3, 3.6, 1.6]], SMOKE);
      [[7, 13], [6, 13], [21, 13], [22, 13], [23, 12]].forEach(([x, y]) => f.set(x, y, R.steel[4]));
      f.set(8, 12, R.steel[3]); f.set(20, 12, R.steel[3]);
      // the handle: a straight brass rod from the bell's side, a ring at its end
      for (let x = 18; x <= 23; x++) { f.set(x, 6, R.brass[5]); f.set(x, 7, R.brass[3]); }
      f.draw(['.bb.', 'b..b', 'b..B', '.BB.'], 24, 4, { b: R.brass[5], B: R.brass[3] });
      // the snuffer's bell, lifted clear of the card, a knob on top, a dark rim
      const bell = L.mask((x, y) => (y >= 3 && y <= 10 && Math.abs(x - 14) <= 1.6 + (y - 3) * 0.62) || (y === 2 && Math.abs(x - 14) <= 1));
      L.layInk(f, bell, R.brass, { cap: 2, base: 4, gain: 3.5 });
      for (let x = 8; x <= 20; x++) if (bell.get(x, 10)) f.set(x, 10, R.brass[2]);
      return f;
    },
  });

  // ---- The Slide (shrinkray): lowers cards one rank. A carnival slide striped pink and cream, three cards riding
  // down it, lime arrows pointing down (the Ladder's mirror).
  A.tarot('shrinkray', {
    draw() {
      const f = new Bmp(W, W);
      // the wooden trestle under the chute
      f.rect(5, 15, 2, 16, R.wood[3]); f.rect(5, 15, 1, 16, R.wood[4]);
      f.rect(14, 24, 2, 7, R.wood[3]); f.rect(14, 24, 1, 7, R.wood[4]);
      // the chute: a band from the top left, swooping down to a flat run-out, striped across its length
      const p0 = [1, 11], p1 = [12, 29], p2 = [31, 27];
      const chute = strokeQuad(W, W, p0, p1, p2, 5);
      const at = (x, y) => { let bt = 0, bd = 1e9; for (let i = 0; i <= 60; i++) { const t = i / 60, a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t; const d = (x - (a * p0[0] + b * p1[0] + c * p2[0])) ** 2 + (y - (a * p0[1] + b * p1[1] + c * p2[1])) ** 2; if (d < bd) { bd = d; bt = t; } } return bt; };
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        if (!chute.get(x, y)) continue;
        const pink = Math.floor(at(x, y) * 11) % 2 === 0;
        const top = !chute.get(x, y - 1), low = !chute.get(x, y + 1) || !chute.get(x, y + 2);
        f.set(x, y, top ? (pink ? R.pink[7] : C.white) : low ? (pink ? R.pink[3] : C.cream3) : pink ? R.pink[5] : C.cream);
      }
      // three cards riding down it, each lower than the last, with arrows pointing down
      const mini = (x, y, suit) => L.put(f, L.card(7, 9, { pip: suit }), x, y);
      mini(5, 3, 'D'); mini(13, 11, 'S'); mini(22, 15, 'H');
      L.arrow(f, 12, 1, true); L.arrow(f, 21, 7, true);
      return f;
    },
  });

  // ---- The Tailor (paintbucket): turns cards to the leftmost one's suit. Three cards in a row wearing the same
  // heart: two already have it, the third is being chalked in by a flat block of pink tailor's chalk; a tape measure
  // runs along the bottom.
  A.tarot('paintbucket', {
    draw() {
      const f = new Bmp(W, W);
      L.put(f, L.card(9, 13, { pip: 'H', py: 3 }), 1, 7);
      L.put(f, L.card(9, 13, { pip: 'H', py: 3 }), 11, 6);
      const third = L.card(9, 13);
      third.draw(['.c.c.', 'c.c.c', 'c...c', '.c.c.', '..c..'], 2, 3, { c: R.red[4] });
      // the chalk's line, drawn solid down the heart's right side from where the chalk touches it
      third.draw(['...pp', '....p', '....p'], 2, 3, { p: R.pink[6] });
      L.put(f, third, 21, 7);
      // the tailor's chalk: a flat block, stepped a pixel a row, its lower corner on the heart's top right
      f.draw([
        '...tttt',
        '..PPPPd',
        '.PPPPd.',
        'PPPPd..',
      ], 20, 4, { t: R.pink[7], P: R.pink[5], d: R.pink[3] });
      // the tape measure along the bottom: a flat yellow band, a tick every 3 px and a long one every 6, a brass tab
      const tape = strokeQuad(W, W, [0, 27], [13, 28.6], [28, 25], 3.4);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (tape.get(x, y)) f.set(x, y, !tape.get(x, y + 1) ? R.gold[3] : R.gold[5]);
      for (let x = 1; x < 28; x++) {
        let y = 0; while (y < W && !tape.get(x, y)) y++;
        if (y >= W) continue;
        f.set(x, y, R.gold[6]);
        if (x % 3 === 0) f.set(x, y, C.edge);
        if (x % 6 === 0) f.set(x, y + 1, C.edge);
      }
      f.draw(['bbb', 'bBb', 'bbb', 'bbb'], 27, 22, { b: R.brass[3], B: R.brass[5] });
      return f;
    },
  });

  // ---- Carbon Copy (carboncopy): adds a copy of a card. A cream card and its carbon-blue twin peeling away behind
  // it, the twin's corner curling and still smoking.
  A.tarot('carboncopy', {
    draw() {
      const f = new Bmp(W, W);
      const SMOKE = [R.steel[1], R.steel[2], R.steel[3], R.steel[4], R.steel[5]];
      // two little puffs of smoke rising off the curled corner
      L.puffs(f, [[25.5, 7.5, 2.2], [23.5, 4, 1.7]], SMOKE);
      // the twin: carbon-paper blue, its spade printed pale, its top right corner curled forward
      const twin = L.card(13, 19, { stock: L.STOCK.carbon });
      twin.blit(emboss(Mask.rows(K.PIP7.S), [R.chips[5], R.chips[6], R.chips[7]], { cap: 2.2, base: 1, gain: 2 }), 3, 6);
      twin.draw(['....kk', '...kWw', '..kWwk', '.kWwk.', 'kkkk..'], 7, 0, { k: C.edge, W: R.chips[6], w: R.chips[5] });
      for (let y = 0; y < 4; y++) for (let x = 13 - (4 - y); x < 13; x++) twin.del(x, y);
      L.put(f, twin, 15, 10);
      // the cream original in front
      L.put(f, L.card(13, 19, { pip: 'S', big: true }), 3, 4);
      return f;
    },
  });

  // ---- Busker's Hat (paperroute): gain money. An upturned brown felt top hat catching coins, one dropping in and
  // one mid-flip with a white glint.
  A.tarot('paperroute', {
    draw() {
      const f = new Bmp(W, W);
      const FELT = R.wood.slice(0, 6);
      // the crown, upside down below the brim: a narrow felt drum with rounded corners
      L.lay(f, L.mask((x, y) => y >= 20 && y <= 29 && Math.abs(x - 15) <= (y <= 27 ? 6.4 : y === 28 ? 5.4 : 4)), FELT, { cap: 3, base: 3, gain: 3.5 });
      // the brim, seen from above: a wide oval ring, its hollow dark and holding coins
      const outer = (x, y) => ((x - 15) / 14) ** 2 + ((y - 19) / 3.6) ** 2 <= 1, inner = (x, y) => ((x - 15) / 9.8) ** 2 + ((y - 18.6) / 2.2) ** 2 <= 1;
      L.layInk(f, L.mask((x, y) => outer(x, y) && !inner(x, y)), FELT, { cap: 1.5, base: 3, gain: 3 });
      for (let y = 15; y < 23; y++) for (let x = 4; x < 27; x++) if (inner(x, y)) f.set(x, y, y <= 17 ? R.plum[1] : R.plum[2]);
      // the maroon band round the crown just under the brim, tied in a bow at the side
      for (let x = 8; x <= 22; x++) { if (f.get(x, 24) && f.get(x, 24) !== C.edge) f.set(x, 24, R.maroon[5]); if (f.get(x, 25) && f.get(x, 25) !== C.edge) f.set(x, 25, R.maroon[3]); }
      f.draw(['mm.mm', 'mMkMm', 'm...m'], 16, 23, { m: R.maroon[5], M: R.maroon[6], k: R.maroon[2] });
      // coins lying flat in the hollow
      const flat = L.coinFlat();
      L.put(f, flat, 8, 18); L.put(f, flat, 16, 18); L.put(f, flat, 12, 17);
      // a coin dropping in, another mid-flip with a glint
      L.put(f, L.coin(6), 19, 7);
      L.put(f, L.coinEdge(6), 11, 4);
      L.twinkle(f, 8, 4, R.money[7]);
      return f;
    },
  });

  // ---- Late Arrival (gueststar): creates a common Joker. A wooden door open a crack on a warm room, a jester
  // peeking out round its edge (cap, eye and nose), his gloved hand curled round the door, light spilling across
  // the floor.
  A.tarot('gueststar', {
    draw() {
      const f = new Bmp(W, W);
      // the frame and the warm room behind the crack
      f.rect(8, 3, 21, 28, R.wood[1]);
      f.rect(10, 5, 6, 26, R.ember[6]); f.rect(10, 5, 1, 26, R.ember[7]); f.rect(15, 5, 1, 26, R.ember[5]);
      // the jester peeking out of the crack, looking left: the door hides the back of his head
      const head = L.jesterLeft({ fore: true });
      L.put(f, head, -3, 3);
      // the door, swung almost shut: panels, a brass knob
      const door = new Bmp(13, 26);
      for (let y = 0; y < 26; y++) for (let x = 0; x < 13; x++) door.set(x, y, x === 0 ? R.wood[5] : y === 0 ? R.wood[5] : x === 12 ? R.wood[2] : R.wood[3]);
      [[2, 2, 9, 9], [2, 14, 9, 9]].forEach(([x, y, w, h]) => { door.rect(x, y, w, h, R.wood[2]); door.rect(x + 1, y + 1, w - 1, h - 1, R.wood[4]); door.rect(x + 1, y + 1, w - 2, h - 2, R.wood[3]); });
      door.rect(9, 12, 2, 2, R.brass[5]); door.set(10, 13, R.brass[3]);
      L.put(f, door, 17, 5);
      // his gloved hand curled round the door's edge
      const hand = new Bmp(3, 8);
      hand.draw(['ccc', 'cCs', 'sss', 'ccc', 'cCs', 'sss', 'ccc', 'cCs'], 0, 0, { c: C.cream, C: C.white, s: C.cream3 });
      L.put(f, hand, 17, 14);
      return f;
    },
    overlay(k, b) {
      // the glow spilling out of the crack across the floor, a fan widening to the left in two steps
      L.bgLight(b, 'tarot', (x, y) => {
        if (y < 25 || x > 15) return null;
        const reach = (y - 24) * 2.6;
        return x >= 15 - reach * 0.55 ? '#FFC99A70' : x >= 15 - reach ? '#FFC99A38' : null;
      });
    },
  });

  // ---- Overtime (overtime): +1 hand this Blind. A brass alarm clock ringing just past midnight, its twin bells
  // shaking, a candle stub burning low beside it.
  A.tarot('overtime', {
    draw() {
      const f = new Bmp(W, W);
      const cx = 14.5, cy = 17; // the face's centre sits between pixels 14 and 15
      // the candle stub, lower right
      L.put(f, (() => { const c = new Bmp(5, 7); c.rect(0, 0, 5, 7, C.cream); c.rect(0, 0, 1, 7, C.white); c.rect(4, 0, 1, 7, C.cream3); c.rect(0, 0, 5, 1, R.pink[7]); c.rect(0, 1, 1, 2, R.pink[7]); return c; })(), 25, 23);
      f.draw(['.r.', 'rar', 'ryr', '.k.'], 26, 19, { r: R.ember[5], a: R.ember[7], y: R.ember[8], k: C.edge });
      // the bells and their hammer
      const bell = emboss(L.mask((x, y) => ((x - 3) / 3.6) ** 2 + ((y - 3.6) / 3.3) ** 2 <= 1 && y <= 4), R.brass, { cap: 1.6, base: 4, gain: 3 });
      L.put(f, bell, 5, 4); L.put(f, bell, 17, 4);
      f.rect(14, 5, 2, 4, R.brass[3]);
      // the body: a brass ring round a cream face, two feet
      f.rect(7, 26, 3, 3, R.brass[2]); f.rect(19, 26, 3, 3, R.brass[2]);
      L.layInk(f, L.mask((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= 9.6 ** 2), R.brass, { cap: 2.4, base: 4, gain: 3.5 });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= 7.2) f.set(x, y, d > 6.3 ? C.cream3 : x + y < cx + cy - 2 ? C.white : C.cream); }
      // the twelve hours: bold 2 x 2 ticks at twelve, three, six and nine, a brass dot at each of the rest
      [[14, 11], [14, 22], [9, 16], [19, 16]].forEach(([x, y]) => f.rect(x, y, 2, 2, C.edge));
      for (let h = 0; h < 12; h++) { if (h % 3 === 0) continue; const a = (h / 12) * Math.PI * 2; f.set(Math.round(cx + Math.sin(a) * 5.4), Math.round(cy - Math.cos(a) * 5.4), R.brass[3]); }
      // the hands just past twelve: a short hour hand, the minute hand out to the rim
      f.rect(14, 13, 2, 4, C.edge);
      f.line(15, 16, 17, 11, C.edge); f.set(17, 11, R.mult[4]);
      f.rect(14, 16, 2, 2, R.mult[4]);
      // the ringing: short strokes beside the bells, inside the arch
      f.draw(['k..', '.k.', 'k..'], 2, 6, { k: R.money[7] }); f.draw(['..k', '.k.', '..k'], 25, 6, { k: R.money[7] });
      return f;
    },
  });

  // ---- Do-Over (doover): +2 discards this Blind. A looping lime arrow sweeping two flying cards back onto a card
  // table with a maroon felt top.
  A.tarot('doover', {
    draw() {
      const f = new Bmp(W, W);
      // the table: maroon felt with a lit back edge, a wooden lip in front, two legs
      L.lay(f, L.mask((x, y) => y >= 22 && y <= 25 && Math.abs(x - 15) <= 12 + (y - 22) * 0.7), [R.maroon[3], R.maroon[4], R.maroon[5]], { cap: 1.5, base: 1, gain: 1.5 });
      for (let x = 3; x <= 27; x++) f.set(x, 22, R.maroon[6]);
      for (let x = 1; x <= 29; x++) { f.set(x, 26, R.wood[5]); f.set(x, 27, R.wood[4]); }
      f.rect(3, 28, 2, 3, R.wood[2]); f.rect(26, 28, 2, 3, R.wood[2]);
      // two cards on their way back down
      L.put(f, L.card(9, 12, { pip: 'C' }), 8, 8);
      L.put(f, L.card(9, 12, { pip: 'H' }), 15, 12);
      // the loop: a lime band round most of a circle, clockwise from the table up and over, its head pointing down
      const loop = L.mask((x, y) => { const d = Math.hypot(x - 15, y - 12.5), a = Math.atan2(y - 12.5, x - 15); return d >= 9.4 && d <= 12.4 && !(a > 0.2 && a < 1.9) && y <= 20; });
      loop.or(L.mask((x, y) => y >= 16 && y <= 21 && Math.abs(x - 25) <= 21 - y));
      L.layInk(f, loop, R.lime, { cap: 1.4, base: 5, gain: 3 });
      return f;
    },
  });

  // ---- Happy Accident (happyaccident): 1 in 3 to give a Joker an Edition. A candle tipped on its side, still lit,
  // its pink wax dripping onto a card in a perfect heart.
  A.tarot('happyaccident', {
    draw() {
      const f = new Bmp(W, W);
      // the card, the wax heart glossy on it
      const card = L.card(13, 17);
      card.blit(emboss(K.bigPipMask('H'), R.pink, { cap: 2.6, base: 5, gain: 3.4 }).clone(), -1, 1);
      L.put(f, card, 9, 13);
      // the drip from the candle's lip to the heart's top lobe: two wide, then one, then a bead
      f.rect(16, 12, 2, 1, R.pink[5]); f.set(17, 13, R.pink[6]); f.set(17, 14, R.pink[7]);
      // the candle on its side: a cream cylinder, its round base at the left, the wick at its right end, the flame
      // still burning and bending upward, the wax it melts running pink down the front and over the lip
      const wax = new Bmp(16, 7);
      for (let y = 0; y < 7; y++) for (let x = 2; x < 16; x++) wax.set(x, y, y === 0 ? C.white : y <= 2 ? C.cream : y === 3 ? C.cream1 : y <= 5 ? C.cream2 : C.cream3);
      wax.rect(15, 0, 1, 7, C.cream3);
      wax.draw(['.c', 'ce', 'ce', 'ce', 'ce', 'ce', '.c'], 0, 0, { c: C.cream2, e: C.cream3 });
      wax.set(2, 0, C.cream1); wax.set(2, 6, C.cream3);
      wax.draw(['vP', '.P', '.P', '.P', 'pP', '.P', '.p'], 12, 0, { v: R.pink[7], P: R.pink[6], p: R.pink[5] });
      L.put(f, wax, 4, 5);
      f.rect(21, 8, 2, 1, C.edge);
      f.draw(['...r..', '..rar.', '.rayar', '.rywa.', '..ry..'], 20, 3, { r: R.ember[5], a: R.ember[7], y: R.ember[8], w: C.white });
      return f;
    },
  });

  // ---- Launch Pad (launchpad): creates a Planet card. A striped firework rocket on a little wooden stand, its fuse
  // lit, and a tiny ringed world waiting in the sky above.
  A.tarot('launchpad', {
    draw() {
      const f = new Bmp(W, W);
      // the waiting world, top right, a little ember planet with a cream ring
      const pl = K.sphere(3.2, R.ember, { lo: 1.2, k: 1.1 });
      L.put(f, pl, 21, 3);
      for (let x = 18; x <= 30; x++) if (Math.abs(x - 24.5) > 2.5) f.set(x, 6 + (x < 24 ? 1 : 0), C.cream1);
      // the stand: a wooden A-frame
      f.line(7, 19, 3, 30, R.wood[4]); f.line(8, 19, 4, 30, R.wood[2]);
      f.line(16, 19, 20, 30, R.wood[3]); f.line(15, 19, 19, 30, R.wood[2]);
      f.rect(5, 25, 13, 2, R.wood[3]); f.rect(5, 25, 13, 1, R.wood[5]);
      // the rocket: a pointed red nose, a body striped pink and cream, two fins
      const body = new Bmp(7, 21);
      const nose = ['...r...', '..rRr..', '..rRr..', '.rrRrr.', '.rrRrr.'];
      body.draw(nose, 0, 0, { r: R.mult[5], R: R.mult[6] });
      for (let y = 5; y < 17; y++) for (let x = 0; x < 7; x++) { const pink = Math.floor((y - 5) / 3) % 2 === 0; body.set(x, y, x === 0 ? (pink ? R.pink[6] : C.white) : x === 6 ? (pink ? R.pink[3] : C.cream3) : pink ? R.pink[5] : C.cream); }
      body.draw(['f.....f', 'ff...ff', 'ff...ff', 'f.....f'], 0, 17, { f: R.mult[4] });
      body.rect(2, 17, 3, 2, C.cream3);
      L.put(f, body, 9, 3);
      // the fuse: a short curl under the rocket, its end spitting a spark
      f.line(12, 24, 13, 27, C.cream4); f.line(13, 27, 11, 29, C.cream4);
      L.spark(f, 10, 29, R.ember[6]);
      return f;
    },
  });

  // ---- Copycat (reprint): copies a Tarot or Planet you hold. A grinning ginger tabby in a jester's collar, holding a
  // perfect copy of the little violet card beside it up against its chest.
  A.tarot('reprint', {
    draw() {
      const f = new Bmp(W, W);
      // a little violet Tarot: a gold sun-eye on top, a dark arched window, a dark plate
      const vio = () => {
        const c = new Bmp(9, 12);
        c.rect(0, 0, 9, 12, R.vio[6]); c.rect(0, 0, 9, 1, R.vio[7]); c.rect(0, 0, 1, 12, R.vio[7]); c.rect(8, 0, 1, 12, R.vio[4]); c.rect(0, 11, 9, 1, R.vio[4]);
        c.rect(2, 3, 5, 5, R.vio[1]); c.set(2, 3, R.vio[6]); c.set(6, 3, R.vio[6]); c.set(5, 5, C.white);
        c.rect(3, 1, 3, 1, R.gold[5]); c.set(4, 1, R.gold[6]);
        c.rect(1, 9, 7, 1, R.vio[2]);
        return c;
      };
      // the original, beside the cat
      L.put(f, vio(), 20, 8);
      // the body under the head
      const GINGER = R.ember.slice(2);
      L.put(f, emboss(L.mask((x, y) => y >= 20 && Math.abs(x - 10.5) <= 7 - Math.max(0, 22 - y)), GINGER, { cap: 2, base: 2, gain: 3 }), 0, 0);
      // the cat: a ginger head with tall pointed ears, tabby stripes on the brow, a cream muzzle, squinting with
      // delight and grinning
      const ear = (tx, bx0, bx1) => (x, y) => y >= 3 && y <= 11 && x >= Math.min(tx, bx0) - 0.5 && x <= Math.max(tx, bx1) + 0.5
        && (x - tx) >= (bx0 - tx) * (y - 3) / 7 - 0.5 && (x - tx) <= (bx1 - tx) * (y - 3) / 7 + 0.5;
      const lE = ear(5, 4, 10), rE = ear(16, 11, 17);
      const head = L.mask((x, y) => ((x - 10.5) / 7) ** 2 + ((y - 14) / 5.8) ** 2 <= 1 || lE(x, y) || rE(x, y));
      const cat = emboss(head, GINGER, { cap: 3, base: 3, gain: 3.5 });
      cat.rect(6, 7, 2, 3, R.pink[6]); cat.rect(14, 7, 2, 3, R.pink[6]);
      [[8, 10], [10, 9], [12, 10]].forEach(([x, y]) => cat.rect(x, y, 1, 2, R.ember[3]));
      cat.blit(emboss(L.mask((x, y) => ((x - 10.5) / 3.6) ** 2 + ((y - 17) / 2.3) ** 2 <= 1), R.cream, { cap: 1.5, base: 5, gain: 2.5 }), 0, 0);
      cat.draw(['k..k', '.kk.'], 5, 13, { k: C.edge }); cat.draw(['k..k', '.kk.'], 13, 13, { k: C.edge });
      cat.draw(['.pp.', 'k..k', '.kk.'], 9, 15, { p: R.pink[5], k: C.edge });
      cat.rect(2, 16, 3, 1, C.cream2); cat.rect(16, 16, 3, 1, C.cream2);
      L.put(f, cat, 0, 0);
      // the jester collar: pointed lappets in pink and lime
      const collar = new Bmp(17, 5);
      for (let i = 0; i < 5; i++) { const ramp = i % 2 ? R.lime : R.pink; collar.draw(['aaaa', 'aAAa', '.aa.', '.a..'], i * 4 - 2, 0, { a: ramp[5], A: ramp[6] }); }
      L.put(f, collar, 2, 19);
      // the copy, held up against its chest, the paw over its lower edge
      L.put(f, vio(), 7, 18);
      const paw = new Bmp(5, 4);
      paw.draw(['.ppp.', 'ppppp', 'pkpkp', '.ppp.'], 0, 0, { p: C.cream, k: C.cream3 });
      paw.rect(1, 0, 3, 1, C.white);
      L.put(f, paw, 9, 26);
      return f;
    },
  });

  // ============================================================ PLANETS
  // A deep-blue card with a round porthole on the night, a dotted orbit and stars. Each world is its own: a colour
  // family, a size, and one mark of its hand (a glowing crater, a pair, two pairs, a line of five, one even colour, a
  // house, four moons, a crown). The set runs through rose, lilac, orange, ember, lime, ochre, brick, cream and gold,
  // so a pack is never a row of orange balls. Planets carry their own ink, as Cinderon does; the core does not
  // outline them. Everything stays inside the porthole (radius 14.3 round window (15, 15)).

  /** A world: a shaded sphere of radius r in a ramp, with its own ink edge. o goes to sphere (lo, k, band). */
  L.world = (r, ramp, o = {}) => { const s = K.sphere(r, ramp, { lo: 1.1, k: 1.08, ...o }); const b = new Bmp(s.w + 2, s.h + 2); b.blit(s, 1, 1); b.outline(C.edge); return b; };
  /** Lay a bitmap centred on (cx, cy). */
  L.centre = (f, b, cx, cy) => f.blit(b, Math.round(cx - b.w / 2 + 0.5), Math.round(cy - b.h / 2 + 0.5));
  // Small round moons are stepped by hand: below about 7 px a sphere() rounds to a square.
  const MOON = {
    3: ['.x.', 'xxx', '.x.'],
    4: ['.xx.', 'xxxx', 'xxxx', '.xx.'],
    5: ['.xxx.', 'xxxxx', 'xxxxx', 'xxxxx', '.xxx.'],
    6: ['.xxxx.', 'xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx', '.xxxx.'],
    7: ['..xxx..', '.xxxxx.', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..'],
  };
  /** A small moon n px across (3 to 7), lit from the upper left, with its own ink. */
  L.moon = (n, ramp) => { const m = Mask.rows(MOON[n]); const s = emboss(m, ramp, { cap: n / 2.6, base: ramp.length - 3, gain: 3.2 }); return L.inked(s); };

  // ---- Pipkin (blip): High Card. A small lone rose world with one crater shaped like a diamond pip, glowing hot.
  A.planet('blip', {
    draw() {
      const f = new Bmp(W, W);
      const w = L.world(6, R.pink.slice(2), { lo: 1.2, k: 1.0 });
      // the crater: a diamond pit, its upper-left wall in shadow, its floor glowing ember, white-hot at the centre
      w.draw([
        '...d...',
        '..dyo..',
        '.dyyyo.',
        'dyvvyyo',
        '.dyyyo.',
        '..oyo..',
        '...o...',
      ], 4, 4, { d: R.pink[1], o: R.ember[4], y: R.ember[6], v: R.ember[8] });
      L.centre(f, w, 15, 15);
      return f;
    },
  });

  // ---- Twindle (boing): Pair. Two matching lilac moons circling each other, an ember spark twinkling over each
  // one's pole.
  A.planet('boing', {
    draw() {
      const f = new Bmp(W, W);
      const w = L.world(4.6, R.vio.slice(3), { lo: 1.4 });
      [[9.5, 18.5], [20.5, 11.5]].forEach(([cx, cy]) => { L.centre(f, w, cx, cy); L.spark(f, Math.round(cx - 4), Math.round(cy - 7), R.ember[6], R.ember[8]); });
      return f;
    },
  });

  // ---- Marmalon (zipzap): Two Pair. A marmalade-orange world with a little leaf and stem at its top, like the fruit,
  // two pairs of cream moons on opposite sides, one pair above and one below like a bow tie.
  A.planet('zipzap', {
    draw() {
      const f = new Bmp(W, W);
      const w = L.world(6.6, R.ember, { lo: 1.4, k: 1.0 });
      L.centre(f, w, 15, 15);
      // the stem and leaf at the top, with their own ink
      L.put(f, new Bmp(5, 4).draw(['.lLL.', 'llLLL', 's.ll.', 's....'], 0, 0, { l: R.lime[5], L: R.lime[6], s: R.wood[3] }), 15, 4);
      const moon = L.moon(5, R.cream.slice(1));
      L.centre(f, moon, 6.5, 9); L.centre(f, moon, 11, 5.5);
      L.centre(f, moon, 19.5, 24.5); L.centre(f, moon, 23.5, 21);
      return f;
    },
  });

  // ---- Quintara (zoom): Straight. A lime-green world leading five moons in a straight line across the porthole,
  // cream and peach in turn, each its own disc with a pixel of ink between it and the next, so all five can be
  // counted; they step down in size toward the back.
  A.planet('zoom', {
    draw() {
      const f = new Bmp(W, W);
      // the line runs gently down to the lower left through the middle of the porthole; the world rides above its
      // front end
      const sizes = [5, 5, 4, 4, 4], ux = -0.95, uy = 0.31, off = [0];
      for (let i = 1; i < 5; i++) off.push(off[i - 1] + (sizes[i - 1] + sizes[i]) / 2 + 1);
      const mid = off[4] / 2 - 0.25, x0 = 15.5 - ux * mid, y0 = 17 - uy * mid;
      for (let i = 4; i >= 0; i--) L.centre(f, L.moon(sizes[i], i % 2 ? R.peach.slice(1) : R.cream.slice(1)), x0 + ux * off[i], y0 + uy * off[i]);
      L.centre(f, L.world(4, R.lime, { lo: 1.2 }), 19.5, 8);
      return f;
    },
  });

  // ---- Ochrelle (swoosh): Flush. A big, smooth ochre world in one even colour all over, glossy, its only mark a pink
  // rim of light along one side.
  A.planet('swoosh', {
    draw() {
      const f = new Bmp(W, W);
      const r = 9, s = K.sphere(r, R.brass.slice(1), { lo: 1.0, k: 1.0 });
      const c = (s.w - 1) / 2;
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        if (!s.get(x, y)) continue;
        const dx = (x - c) / r, dy = (y - c) / r, dd = Math.hypot(dx, dy), face = (dx * 0.8 + dy * 0.6) / (dd || 1);
        if (dd > 0.76 && face > 0.5) s.set(x, y, dd > 0.9 ? R.pink[7] : R.pink[6]);
      }
      const w = new Bmp(s.w + 2, s.h + 2); w.blit(s, 1, 1); w.outline(C.edge);
      // the gloss: a white highlight at the upper left
      const hx = Math.round(1 + c - r * 0.48), hy = Math.round(1 + c - r * 0.5);
      w.rect(hx, hy, 2, 2, C.white); w.set(hx + 2, hy + 1, R.brass[6]); w.set(hx, hy + 2, R.brass[6]);
      // two glints along the pink rim
      [[0.62, 0.62], [0.9, 0.18]].forEach(([ux, uy]) => w.set(Math.round(1 + c + ux * r), Math.round(1 + c + uy * r), R.pink[8]));
      L.centre(f, w, 15, 15);
      return f;
    },
  });

  // ---- Hearthon (kaboom): Full House. A brick-red world laid in courses of brick, a tiny chimney on top with a
  // thin wisp of smoke, three moons on one side and two on the other.
  A.planet('kaboom', {
    draw() {
      const f = new Bmp(W, W);
      // a thin wisp of smoke curling right from the chimney's top
      L.smoke(f, [13, 5], [12.5, 1.5], [18, 2.5], R.cream.slice(1), 2.2, 1.2);
      const w = L.world(6.8, R.mult.slice(1, 8), { lo: 1.6, k: 0.85 });
      // mortar: courses every three rows, the joints staggered, a step lighter than the brick round it
      for (let y = 2; y < w.h - 1; y++) for (let x = 1; x < w.w - 1; x++) {
        const c = w.get(x, y), i = R.mult.indexOf(c);
        if (i < 0) continue;
        if (y % 3 === 0 || (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0) w.set(x, y, i >= 5 ? R.peach[5] : R.peach[i >= 3 ? 3 : 2]);
      }
      L.centre(f, w, 15, 17);
      // the chimney standing on the world's shoulder
      const stack = new Bmp(5, 6);
      stack.rect(0, 0, 5, 2, R.peach[4]); stack.rect(0, 0, 5, 1, R.peach[6]);
      stack.rect(1, 2, 3, 4, R.mult[4]); stack.rect(1, 2, 1, 4, R.mult[5]); stack.rect(3, 2, 1, 4, R.mult[3]); stack.rect(1, 4, 3, 1, R.peach[3]);
      L.put(f, stack, 11, 6);
      // the moons: three on the left, two on the right
      [[5, 10], [4, 16], [6, 22]].forEach(([x, y]) => L.centre(f, L.moon(4, R.cream.slice(1)), x, y));
      [[25, 12], [25, 21]].forEach(([x, y]) => L.centre(f, L.moon(4, R.cream.slice(1)), x, y));
      return f;
    },
  });

  // ---- Tetralune (thwack): Four of a Kind. A big cream world with four small coral moons hugging it at its corners.
  A.planet('thwack', {
    draw() {
      const f = new Bmp(W, W);
      L.centre(f, L.world(7.6, R.cream, { lo: 2, k: 0.95 }), 15, 15);
      const moon = L.moon(4, R.mult.slice(3));
      [[7, 8], [23, 8], [7, 22], [23, 22]].forEach(([x, y]) => L.centre(f, moon, x, y));
      return f;
    },
  });

  // ---- Regalis (bigbang): Straight Flush. The largest world, banded gold and ember, wearing a ring of gold crown
  // points round its middle, a pearl on the tallest points, one white sparkle on its rim.
  A.planet('bigbang', {
    draw() {
      const f = new Bmp(W, W);
      const cx = 15, cy = 18;
      // the world: banded gold and ember
      const w = L.world(9.4, R.gold, { lo: 0.9, band: (x, y) => (Math.floor((y + 0.3 * x) / 3) % 2 ? -1.6 : 0) });
      for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) { const c = w.get(x, y); const i = R.gold.indexOf(c); if (i >= 0 && i <= 2) w.set(x, y, R.ember[i + 3]); }
      L.centre(f, w, cx, cy);
      // the crown it wears: a gold band curving round its brow, five points rising past its top, jewels in the band
      const band = (x) => 11 + ((x - cx) / 9) ** 2 * 2.6;
      const crown = L.mask((x, y) => {
        if (x < 5 || x > 25) return false;
        const b = band(x);
        if (y >= b && y <= b + 2.4) return true;
        return [5.5, 10, 15, 20, 24.5].some((px, i) => { const top = band(px) - (i === 2 ? 6 : i % 4 === 0 ? 3.6 : 5); return y >= top && y < band(px) && Math.abs(x - px) <= 0.6 + (y - top) * 0.42; });
      });
      L.layInk(f, crown, R.gold, { cap: 1.3, base: 4, gain: 2.8 });
      // the pearls, seated on the three tallest tips, each with its own ink
      const pearl = new Bmp(2, 2).draw(['wc', 'cC'], 0, 0, { w: C.white, c: C.cream, C: C.cream2 });
      [10, 15, 20].forEach((px) => { let y = 0; while (y < W && !crown.get(px, y)) y++; L.put(f, pearl, px === 15 ? 14 : px === 10 ? 9 : 20, y - 2); });
      f.rect(14, 12, 2, 2, R.chips[6]); f.set(14, 12, R.chips[8]);
      f.rect(9, 12, 2, 2, R.pink[5]); f.set(9, 12, R.pink[7]); f.rect(20, 12, 2, 2, R.pink[5]); f.set(20, 12, R.pink[7]);
      L.twinkle(f, 23, 23, R.gold[6]);
      return f;
    },
  });

  // ============================================================ SPECTRAL
  // A dark navy card with a wavering ghost-blue border. Each picture is lit by ghost light: pale blue rims, wisps,
  // and see-through things laid over the finished card by overlay() so the night shows through them.
  const GHOST = R.ghost;
  /** A ghost wisp along a quadratic, thinning as it goes. */
  L.wisp = (f, p0, p1, p2, w0 = 3, w1 = 1.2, ramp = GHOST) => L.lay(f, strokeQuad(W, W, p0, p1, p2, (t) => w0 + (w1 - w0) * t), ramp, { cap: 1.4, base: ramp.length - 3, gain: 3 });
  /** A soft pool of light in two steps over the background of the finished card (window pixels; c is '#RRGGBB'). */
  L.pool = (b, kind, cx, cy, r, c, a = ['30', '1A'], sy = 1) => L.glow(b, kind, cx, cy, r, c, a, sy);
  /** A see-through shape over the finished card: fn(x, y) in window pixels -> '#RRGGBBAA' or null. */
  L.veil = (b, fn) => L.light(b, 'spectral', fn);

  // ---- Curtain Call (curtaincall): an Encore Seal, and a card lost. Maroon velvet curtains parting on a ghost-blue
  // gloved hand holding up a pink swallowtail ribbon from below, taking its bow.
  A.spectral('curtaincall', {
    draw() {
      const f = new Bmp(W, W);
      // the stage boards
      for (let y = 27; y < W; y++) for (let x = 0; x < W; x++) f.set(x, y, y === 27 ? R.wood[4] : (x + (y === 29 ? 3 : 0)) % 7 === 0 ? R.wood[1] : R.wood[2]);
      // the curtains: velvet in vertical folds, tied back at the middle, a scalloped pelmet across the top
      const fold = (x) => [R.maroon[2], R.maroon[4], R.maroon[5], R.maroon[3]][((x % 4) + 4) % 4];
      for (let y = 0; y < 27; y++) {
        const tie = 14, w = y < tie ? 9 - Math.round((y / tie) * 4) : 5 + Math.round(((y - tie) / 13) * 5);
        for (let x = 0; x < w; x++) { f.set(x, y, fold(x)); f.set(30 - x, y, fold(x + 2)); }
      }
      [[3, 14], [27, 14]].forEach(([x, y]) => f.draw(['ggg', 'gGg'], x - 1, y, { g: R.gold[4], G: R.gold[6] }));
      for (let x = 0; x < W; x++) { const s = (x % 6) < 3 ? 3 : 4; for (let y = 0; y < s; y++) f.set(x, y, y === 0 ? R.maroon[6] : R.maroon[4]); f.set(x, s, R.gold[4]); }
      // the ribbon, held up
      const ribbon = new Bmp(7, 14);
      ribbon.blit(emboss(Mask.rows(['XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXX.XXX', 'XX...XX', 'X.....X']), R.pink, { cap: 2.2, base: 5, gain: 3.6 }), 0, 0);
      ribbon.draw(['.vv.', 'v..v', 'v.vv', '.v..'], 2, 2, { v: C.white });
      L.put(f, ribbon, 12, 5);
      // the gloved hand, its fingers closed over the ribbon's tails, the thumb out to the left, a cuff at the wrist
      const hand = new Bmp(11, 11);
      hand.draw([
        '..ff.ff.ff.',
        '.ffsffsffsf',
        '.ffsffsffsf',
        'tffsffsffsf',
        'ttffffffff.',
        '.tffffffff.',
        '..ffffffF..',
        '...fffffF..',
        '...cccccc..',
        '...cccccc..',
        '....ffff...',
      ], 0, 0, { f: GHOST[5], F: GHOST[4], s: GHOST[3], t: GHOST[5], c: GHOST[3] });
      for (let y = 1; y <= 7; y++) { const x = [3, 1, 1, 1, 1, 1, 2, 3][y]; if (hand.get(x, y)) hand.set(x, y, GHOST[6]); }
      hand.set(2, 0, GHOST[6]); hand.set(5, 0, GHOST[6]); hand.set(8, 0, GHOST[6]); hand.set(0, 3, GHOST[6]);
      L.put(f, hand, 10, 16);
      return f;
    },
    overlay(k, b) { L.pool(b, 'spectral', 15, 20, 10, '#D9F4FF', ['2C', '16'], 0.8); },
  });

  // ---- Cursed Coin (cursedcoin): Paid Seals, for $5. A big coin standing on its rim, a raised amber ring struck in
  // its face and a jagged crack down its right half, ghost blue down its shadowed side and round it, ghost light in
  // the crack, two wisps curling up and away from its shoulders. No face: a face on a yellow coin reads as a smiley.
  // No '$' either: a '$' coin is the casino coding an earlier review took out (BUILD-LOG, 23:20); the ring reads coin.
  A.spectral('cursedcoin', {
    draw() {
      const f = new Bmp(W, W);
      // the rim, seen past the face's right edge: one amber band
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (((x - 17.5) / 7.4) ** 2 + ((y - 19) / 9.6) ** 2 <= 1) f.set(x, y, R.money[3]);
      // the face: flat yellow, lit along its upper-left edge, a ghost-blue cast on its lower right
      const face = L.mask((x, y) => ((x - 15.5) / 7.4) ** 2 + ((y - 19) / 9.6) ** 2 <= 1);
      const cast = (x, y) => (x - 15.5) * 0.7 + (y - 19) * 0.7;
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        if (!face.get(x, y)) continue;
        const edge = (!face.get(x - 1, y) || !face.get(x, y - 1)) && x <= 16 && y <= 20;
        const c = cast(x, y);
        f.set(x, y, edge ? R.money[7] : c > 6.5 ? GHOST[4] : c > 4 ? GHOST[5] : R.money[5]);
      }
      // no face and no '$': a raised ring struck into it in the coin's amber (ghost blue where the cast falls), and a
      // jagged crack down its right half with ghost light glowing out of it (the light sits right of each crack pixel,
      // so the wisps rise out of the crack)
      const ring = L.mask((x, y) => { const e = ((x - 15.5) / 5.4) ** 2 + ((y - 19) / 7.4) ** 2; return e <= 1 && e >= 0.72; });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (ring.get(x, y)) f.set(x, y, cast(x, y) > 4 ? GHOST[3] : R.money[3]);
      [[17, 10], [17, 11], [18, 12], [18, 13], [19, 14], [18, 15], [18, 16], [19, 17], [20, 18], [20, 19], [21, 20], [21, 21]].forEach(([x, y]) => {
        f.set(x, y, C.edge);
        if (f.get(x + 1, y) && f.get(x + 1, y) !== C.edge) f.set(x + 1, y, GHOST[6]);
      });
      return f;
    },
    overlay(k, b) {
      // two wisps curling up off its top rim like steam in a draught, one tall and one short, both leaning the same
      // way (one off each shoulder, curling outward, read as antlers), solid near the coin and fainter as they thin
      const wisps = [
        strokeQuad(W, W, [13, 9.5], [9, 6], [12, 3.5], (t) => 2.6 - t * 0.8), strokeQuad(W, W, [12, 3.5], [15, 1], [11, 0.5], (t) => 1.8 - t * 0.8),
        strokeQuad(W, W, [19, 10], [16.5, 7.5], [19.5, 6], (t) => 2.2 - t * 0.8),
      ];
      L.bgLight(b, 'spectral', (x, y) => (wisps.some((m) => m.get(x, y)) ? (y >= 5 ? GHOST[5] + 'C0' : GHOST[6] + '70') : null));
      // and its ghost glow on the night round it (not over the wisps, which are no longer background)
      L.bgLight(b, 'spectral', (x, y) => { if (wisps.some((m) => m.get(x, y))) return null; const d = Math.hypot(x - 16, y - 19); return d < 7.8 ? '#AED8F024' : d < 13 ? '#AED8F012' : null; });
    },
  });

  // ---- Starfall (deadletter): Comet Seals, for a discard. Ghost-blue stars falling past moonlit maroon rooftops with
  // one warm window, the brightest star trailing a chip-blue ribbon for a tail.
  A.spectral('deadletter', {
    draw() {
      const f = new Bmp(W, W);
      // the rooftops: two gables and a chimney, their ridges caught by the starlight
      const roof = L.mask((x, y) => (y >= 30 - Math.max(0, 9 - Math.abs(x - 8)) * 0.9 && y >= 21) || (y >= 31 - Math.max(0, 8 - Math.abs(x - 23)) * 0.8 && y >= 24) || (x >= 12 && x <= 14 && y >= 19));
      L.lay(f, roof, [R.maroon[1], R.maroon[2], R.maroon[3], R.maroon[4]], { cap: 1.5, base: 2, gain: 2.5 });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (roof.get(x, y) && !roof.get(x, y - 1)) f.set(x, y, GHOST[3]);
      for (let y = 20; y < W; y++) if (roof.get(12, y)) f.set(12, y, R.maroon[5]);
      // the window: lit warm
      f.rect(7, 25, 3, 3, R.ember[7]); f.set(7, 25, R.ember[8]);
      // the ribbon tail, waving up and away from the brightest star
      const tail = strokeQuad(W, W, [18, 12], [24, 9], [24, 4], 3.4);
      tail.or(strokeQuad(W, W, [24, 4], [24, 0], [30, 1], 2.6));
      L.lay(f, tail, R.chips.slice(3), { cap: 1.2, base: 3, gain: 2.5 });
      // the stars: the brightest with five points, two smaller falling with short trails
      f.draw(['...v...', '...v...', 'vvvVvvv', '.vVVVv.', '..vVv..', '.vv.vv.', '.v...v.'], 12, 10, { v: GHOST[5], V: C.white });
      [[4, 6], [24, 17]].forEach(([x, y]) => { L.spark(f, x, y, GHOST[4], GHOST[6]); f.set(x + 2, y - 2, GHOST[3]); f.set(x + 3, y - 3, GHOST[2]); });
      return f;
    },
  });

  // ---- Apparition (apparition): Cameo Seals, for a hand. A see-through gentleman in a top hat, smirking, stepping out
  // of a plum brick wall, a cameo brooch (a pearl rim, a maroon shell) pinned on his coat, his coat trailing off in
  // wisps.
  A.spectral('apparition', {
    draw() {
      const f = new Bmp(W, W);
      // the wall: plum brick, courses of three rows
      for (let y = 0; y < W; y++) for (let x = 0; x <= 10; x++) f.set(x, y, y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 3) % 6 === 5 ? R.plum[2] : x === 10 ? R.plum[3] : R.plum[4]);
      // the coat: ghost blue, broad at the shoulders, its skirts trailing off in two wavy tails that sweep back
      // toward the wall he came out of
      const coat = L.mask((x, y) => y >= 15 && y <= 24 && Math.abs(x - 17) <= 7 - Math.max(0, y - 21) * 0.6 - (y === 15 ? 2 : 0));
      [[[14, 23], [13, 28], [8.5, 28.5]], [[20, 23], [20.5, 29.5], [14.5, 30]]].forEach(([a, c, e]) => coat.or(strokeQuad(W, W, a, c, e, (t) => 3.6 - t * 1.8)));
      L.lay(f, coat, GHOST.slice(0, 6), { cap: 2.4, base: 3, gain: 3 });
      // lapels: a pale V from the collar, buttons down the front
      for (let i = 0; i < 6; i++) { f.set(13 + i * 0.7 | 0, 15 + i, GHOST[5]); f.set(21 - (i * 0.7 | 0), 15 + i, GHOST[5]); }
      [[17, 21], [17, 23]].forEach(([x, y]) => f.set(x, y, GHOST[6]));
      // the head: a pale oval, two dark eyes, one brow raised, a sly smile
      L.layInk(f, L.mask((x, y) => ((x - 17) / 3.6) ** 2 + ((y - 11) / 3.8) ** 2 <= 1), GHOST, { cap: 2, base: 5, gain: 2.5 });
      f.rect(15, 10, 1, 2, C.edge); f.rect(19, 10, 1, 2, C.edge);
      f.set(18, 8, GHOST[2]); f.set(19, 8, GHOST[2]); f.set(20, 7, GHOST[2]);
      f.set(16, 13, GHOST[2]); f.set(17, 13, GHOST[2]); f.set(18, 12, GHOST[2]);
      // the top hat: a tall crown with a band, a wide brim
      const hat = new Bmp(13, 8);
      hat.rect(2, 0, 9, 6, R.navy[2]); hat.rect(2, 0, 9, 1, R.navy[5]); hat.rect(2, 0, 1, 6, R.navy[4]); hat.rect(2, 4, 9, 1, R.maroon[5]);
      hat.rect(0, 6, 13, 2, R.navy[3]); hat.rect(0, 6, 13, 1, R.navy[5]);
      L.put(f, hat, 11, 0);
      // the cameo: a maroon oval in a pearl rim with a cream profile, as on the Cameo Seal
      f.draw(['.ggg.', 'gvcvg', 'gvccg', 'gvcvg', '.ggg.'], 18, 16, { g: R.cream[6], v: R.maroon[4], c: C.cream });
      return f;
    },
    overlay(k, b) {
      // where he is still inside the wall, the bricks show through him
      L.veil(b, (x, y) => (x >= 9 && x <= 11 && y >= 0 && y <= 30 ? '#4D2B40A0' : null));
    },
  });

  // ---- Foxfire (phantomink): an Edition, for hand size. A round old log, its bark ridged, clumps of acid-green and
  // ghost-blue foxfire glowing along it, motes of the glow drifting up off it.
  A.spectral('phantomink', {
    draw() {
      const f = new Bmp(W, W);
      // the log: a rounded cylinder lying across the bottom, its cut end showing rings
      const log = L.mask((x, y) => y >= 19 && y <= 27 && x >= 6 && x <= 29 - ((y - 23) / 4) ** 2 * 2.2 && !((y === 19 || y === 27) && x > 27));
      L.lay(f, log, R.wood, { cap: 3, base: 3, gain: 3.5 });
      for (let x = 7; x <= 28; x++) { if (log.get(x, 19)) f.set(x, 19, R.wood[5]); }
      [[8, 21, 6], [17, 21, 7], [11, 24, 8], [22, 24, 5], [9, 26, 4], [18, 26, 6]].forEach(([x, y, n]) => { for (let i = 0; i < n; i++) if (log.get(x + i, y)) { f.set(x + i, y, R.wood[1]); if (log.get(x + i, y + 1)) f.set(x + i, y + 1, R.wood[2]); } });
      const end = L.mask((x, y) => ((x - 5.5) / 4) ** 2 + ((y - 23) / 4.6) ** 2 <= 1);
      L.layInk(f, end, R.peach, { cap: 1.5, base: 5, gain: 2.5 });
      f.draw(['.rr.', 'r..r', 'r..r', '.rr.'], 4, 21, { r: R.peach[2] });
      // the foxfire: irregular glowing clumps along the bark, one trickling down the side; the bark beside each
      // clump is tinted by its light
      const clumps = [
        [['.aa.', 'aAAa', '.a..'], 10, 18, R.acid],
        [['gg.', 'gGg', '.g.'], 15, 19, GHOST],
        [['.aaa', 'aAAa', '..a.', '..a.', '..A.'], 20, 18, R.acid],
        [['.g.', 'gGg', 'gg.'], 25, 20, GHOST],
        [['aa.', 'aAa'], 14, 24, R.acid],
      ];
      const lit = new Map();
      clumps.forEach(([g, x, y, r]) => g.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => lit.set((x + i + dx) + ',' + (y + j + dy), r)); })));
      lit.forEach((r, key) => { const [x, y] = key.split(',').map(Number); const c = f.get(x, y); if (c && R.wood.includes(c) && log.get(x, y)) f.set(x, y, r === GHOST ? GHOST[2] : R.acid[1]); });
      clumps.forEach(([g, x, y, r]) => f.draw(g, x, y, { a: r[4], A: r[r.length - 1], g: r[4], G: r[r.length - 1] }));
      // the motes, drifting up, smaller as they rise
      [[13, 13, 'a', 2], [19, 10, 'g', 2], [24, 13, 'a', 2], [16, 5, 'g', 1], [22, 4, 'a', 1], [9, 8, 'g', 1]].forEach(([x, y, c, s]) => {
        const r = c === 'a' ? R.acid : GHOST;
        if (s === 2) f.draw(['.c.', 'cvc', '.c.'], x - 1, y - 1, { c: r[4], v: r[r.length - 1] }); else f.rect(x, y, 2, 2, r[4]);
      });
      return f;
    },
  });

  // ---- Shadow Play (upsidedown): makes a card Phantom, for two cards. A candle and two hands throw a jester's
  // shadow on a wall: the wall is lit in hard rings round the flame, the shadow is solid, the night stays in the
  // corners. The candle and the hands are laid last, with their own ink.
  A.spectral('upsidedown', {
    outline: false,
    draw() {
      const f = new Bmp(W, W);
      // the lit wall: hard rings round the flame, the night beyond them
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - 4, y - 21);
        const c = d < 9 ? R.peach[6] : d < 15 ? R.peach[5] : d < 21 ? R.peach[4] : d < 27 ? R.peach[2] : null;
        if (c) f.set(x, y, c);
      }
      // the shadow, one solid colour: a jester's head in profile facing right, a long pointed nose and chin, a cap
      // whose outer points flop down to round bells and whose middle one stands, a ruff of three round scallops
      const pts = [
        strokeQuad(W, W, [10, 8], [3, 2], [2.5, 10], (t) => 4 - t * 2),
        strokeQuad(W, W, [14.5, 6], [14, 0], [19, 0.5], (t) => 3.6 - t * 1.8),
        strokeQuad(W, W, [18.5, 7.5], [25, 1.5], [27, 5.5], (t) => 4 - t * 2),
      ];
      const bells = [[2.5, 12, 2.2], [21, 1.5, 1.9], [27.5, 7.6, 2.1]];
      const shadow = L.mask((x, y) => ((x - 14) / 5.2) ** 2 + ((y - 14) / 5.6) ** 2 <= 1
        || (y <= 11 && ((x - 14.5) / 6.4) ** 2 + ((y - 11) / 5) ** 2 <= 1)
        || (x >= 18 && x <= 27 && Math.abs(y - 13.5) <= (27.5 - x) * 0.2)
        || (y >= 16 && y <= 19 && x >= 12 && x <= 22 - (y - 16) * 0.8 && !(y === 16 && x >= 19))
        || (y >= 18 && y <= 21 && x >= 11 && x <= 17)
        || [[10.5, 22.2, 2.2], [14.5, 22.9, 2.4], [18.5, 22.2, 2.2]].some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r)
        || pts.some((p) => p.get(x, y)) || bells.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r));
      // a thread of lit wall under the cap's band, so the cap reads apart from the face (as a puppeteer leaves it)
      for (let x = 9; x <= 19; x++) shadow.set(x, 10, 0);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (shadow.get(x, y)) f.set(x, y, R.plum[1]);
      f.rect(16, 12, 2, 1, R.peach[5]);
      // the candle, lower left
      L.put(f, (() => { const c = new Bmp(4, 7); c.rect(0, 0, 4, 7, C.cream); c.rect(0, 0, 1, 7, C.white); c.rect(3, 0, 1, 7, C.cream3); c.rect(0, 0, 4, 1, R.pink[7]); return c; })(), 3, 24);
      f.draw(['.r.', 'rar', 'ryr', '.k.'], 3, 20, { r: R.ember[5], a: R.ember[7], y: R.ember[8], k: C.edge });
      // the hands, lower right: a fist, two fingers raised for the cap's points, the thumb out for the nose
      const hand = new Bmp(11, 12);
      hand.draw([
        '.ff...ff...',
        '.ff...ff...',
        '.fF..fF....',
        '.fF..fF....',
        '.fFffF.....',
        'ffffffff...',
        'fffffffffff',
        'ffffffffFF.',
        'Fffffff....',
        'FFfffff....',
        '.FFfff.....',
        '..FFF......',
      ], 0, 0, { f: C.cream1, F: C.cream3 });
      hand.rect(1, 7, 6, 1, C.cream3);
      L.put(f, hand, 20, 20);
      return f;
    },
  });

  // ---- Poltergeist (hauntedpress): Glitch on one Joker, another destroyed. A cheeky sheet ghost shaking a jester's
  // card so hard that red, green and blue copies of it jitter apart.
  A.spectral('hauntedpress', {
    draw() {
      const f = new Bmp(W, W);
      // the ghost: a sheet with a wavy hem, arms out, eyes squeezed and tongue out
      const ghost = L.mask((x, y) => (((x - 9) / 7) ** 2 + ((y - 11) / 7.5) ** 2 <= 1 && y <= 12) || (y > 11 && y <= 26 && Math.abs(x - 9) <= 7 + (y - 12) * 0.12 && !(y >= 24 && Math.sin(x * 1.3) * 2 + 25 < y)));
      ghost.or(strokeQuad(W, W, [14, 16], [17, 15], [19, 13], 3));
      L.lay(f, ghost, GHOST, { cap: 2.6, base: 4, gain: 3.2 });
      f.draw(['k...k', '.k.k.'], 5, 11, { k: C.edge }); f.draw(['k...k', '.k.k.'], 9, 11, { k: C.edge });
      f.draw(['kkkk', 'kppk', '.pp.'], 7, 15, { k: C.edge, p: R.pink[5] });
      // the card's jittered copies: red to the left, blue to the right, green above
      const silhouette = (c) => { const b = new Bmp(10, 13); for (let y = 0; y < 13; y++) for (let x = 0; x < 10; x++) if (!((x === 0 || x === 9) && (y === 0 || y === 12))) b.set(x, y, c); return b; };
      f.blit(silhouette(R.mult[4]), 17, 6); f.blit(silhouette(R.chips[5]), 21, 9); f.blit(silhouette(R.lime[4]), 19, 5);
      // the card itself: a little jester's card, a belled cap on its face
      const card = L.card(10, 13);
      card.draw(['p...l', 'pp.ll', 'ppgll', '.ggg.'], 2, 3, { p: R.pink[5], l: R.lime[5], g: R.gold[5] });
      L.put(f, card, 19, 7);
      // shake marks
      f.draw(['k', '.', 'k'], 30, 10, { k: GHOST[5] }); f.draw(['k', '.', 'k'], 30, 16, { k: GHOST[5] });
      return f;
    },
  });

  // ---- Witching Hour (midnightedition): a Joker turns Phantom, a discard lost for good. A phantom jester under a
  // small midnight clock and a thin crescent, his head fading to nothing from the back in two hard steps.
  const WITCH = { x: -1, y: 9, head: () => L.jesterHead({ cap: R.pink.slice(3), skin: GHOST, band: GHOST }) };
  A.spectral('midnightedition', {
    draw() {
      const f = new Bmp(W, W);
      // the crescent, upper left
      L.lay(f, L.mask((x, y) => Math.hypot(x - 5.5, y - 5.5) <= 4.6 && Math.hypot(x - 7.6, y - 3.8) > 3.8), [R.gold[3], R.gold[4], R.gold[5], R.gold[6]], { cap: 1, base: 2, gain: 2 });
      // the clock: a navy rim round a ghost-blue face, upper right
      const cx = 21.5, cy = 9.5;
      L.lay(f, L.mask((x, y) => Math.hypot(x - cx, y - cy) <= 8.2), R.navy, { cap: 2, base: 4, gain: 3 });
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= 6.4) f.set(x, y, x + y < 29 ? GHOST[6] : x + y < 34 ? GHOST[5] : GHOST[4]); }
      // the hours: bold strokes at twelve, three, six and nine, dots between
      [[21, 4], [21, 14], [16, 9], [26, 9]].forEach(([x, y]) => f.rect(x, y, 2, 2, C.edge));
      for (let h = 0; h < 12; h++) { if (h % 3 === 0) continue; const a = (h / 12) * Math.PI * 2; f.set(Math.round(cx + Math.sin(a) * 5.2 - 0.01), Math.round(cy - Math.cos(a) * 5.2 - 0.01), GHOST[2]); }
      // both hands straight up: midnight
      f.rect(21, 6, 2, 4, C.edge); f.rect(21, 9, 2, 2, R.mult[4]);
      // the phantom jester, looking up at it
      L.put(f, WITCH.head(), WITCH.x, WITCH.y);
      return f;
    },
    overlay(k, b) {
      // the fade: the back of his head goes first, in two hard steps, over his pixels only
      const ink = L.inked(WITCH.head());
      L.veil(b, (x, y) => {
        if (!ink.get(x - WITCH.x + 1, y - WITCH.y + 1)) return null;
        return x < 6 ? '#141A44C0' : x < 10 ? '#141A4470' : null;
      });
      L.glow(b, 'spectral', 21.5, 9.5, 12, '#AED8F0', ['18', '0C']);
    },
  });

  // ---- Eclipse (wormhole): every hand levels up, half your money gone. A dark moon sliding across a bright ember
  // world: two spheres, the moon taking a bite out of the world and leaving a fat lit crescent.
  A.spectral('wormhole', {
    draw() {
      const f = new Bmp(W, W);
      L.centre(f, L.world(8.6, R.ember, { lo: 1.2, k: 1.1 }), 17, 18);
      L.centre(f, L.world(6, R.navy, { lo: 1.0, k: 0.85 }), 12, 12.5);
      return f;
    },
  });

  // ---- Vanishing Act (vanishingact): destroys cards for $4 each. A magician's black top hat, ghost-blue smoke
  // pouring up out of it, two cards still flying and two already turned to coins.
  A.spectral('vanishingact', {
    draw() {
      const f = new Bmp(W, W);
      // the smoke billowing up out of the hat
      const puff = L.mask((x, y) => Math.hypot(x - 15, y - 15) <= 5 || Math.hypot(x - 10, y - 13) <= 3.6 || Math.hypot(x - 20, y - 12.5) <= 3.8 || Math.hypot(x - 15, y - 9.5) <= 3.4);
      L.lay(f, puff, GHOST, { cap: 2.4, base: 4, gain: 3.4 });
      // two cards flying out, two already coins
      L.put(f, L.card(6, 8, { pip: 'D' }), 3, 3);
      L.put(f, L.card(6, 8, { pip: 'S' }), 10, 1);
      L.put(f, L.coin(5), 18, 2);
      L.put(f, L.coin(5), 24, 5);
      [[16, 4], [22, 1], [28, 9]].forEach(([x, y]) => f.rect(x, y, 2, 1, R.money[6]));
      // the hat: a plum-black top hat, its flat crown seen a little from above, a sheen of ghost light down its
      // left side, a maroon band and a wide brim curling up at both ends
      const hat = new Bmp(21, 13);
      hat.draw([
        '....ttttttttttt......',
        '...tTTTTTTTTTTTt.....',
        '....ttttttttttt......',
        '....gccccccccccd.....',
        '....gccccccccccd.....',
        '....gccccccccccd.....',
        '....gccccccccccd.....',
        '....rRRRRRRRRRRr.....',
        '....rrrrrrrrrrrr.....',
        'b...gccccccccccd...b.',
        'bBBBBBBBBBBBBBBBBBBb.',
        '.bbbbbbbbbbbbbbbbbb..',
        '.....................',
      ], 0, 0, { t: R.plum[4], T: R.plum[5], g: GHOST[3], c: R.plum[2], d: R.plum[1], r: R.maroon[3], R: R.maroon[5], b: R.plum[2], B: R.plum[4] });
      L.put(f, hat, 5, 17);
      return f;
    },
  });

  // ---- Ghost Writer (ghostwriter): one Joker lost, a rare one made. A quill writing on its own across a cream sheet,
  // a jester's portrait sketching itself there in gold lines, the last line still running from the nib.
  A.spectral('ghostwriter', {
    draw() {
      const f = new Bmp(W, W);
      // the sheet, a corner curling
      const sheet = new Bmp(19, 23);
      for (let y = 0; y < 23; y++) for (let x = 0; x < 19; x++) sheet.set(x, y, x === 0 || y === 0 ? C.white : x === 18 || y === 22 ? C.cream3 : C.cream);
      for (let y = 19; y < 23; y++) for (let x = 15; x < 19; x++) if (x - 15 + y - 19 > 3) sheet.del(x, y); else if (x - 15 + y - 19 === 3) sheet.set(x, y, C.cream2);
      // the portrait, a gold line drawing in progress: a jester's head in profile, traced round its edge: the cap,
      // its point flopping back to a bell, the band, the brow and the long nose, down to where the nib is still
      // drawing; the chin and the back of the head are not drawn yet (and no features: a plain grinning face would
      // be the stock jester that ART.md section 9 rules out)
      const PW = 17, PH = 19;
      const head = Mask.fn(PW, PH, (x, y) => ((x - 9) / 4.6) ** 2 + ((y - 12) / 5) ** 2 <= 1 || ((x - 13.6) / 1.6) ** 2 + ((y - 12) / 1.3) ** 2 <= 1);
      const capM = Mask.fn(PW, PH, (x, y) => y <= 9 && ((x - 9) / 5.6) ** 2 + ((y - 9.5) / 5.8) ** 2 <= 1);
      capM.or(strokeQuad(PW, PH, [7.5, 5.5], [3.5, -3.5], [2.5, 7.5], (t) => 3.2 - t * 1.6));
      const all = new Mask(PW, PH); all.or(head); all.or(capM);
      for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
        if (!all.get(x, y) || (y > 13 && x < 13) || (y > 14)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !all.get(x + dx, y + dy))) sheet.set(x + 1, y + 1, R.gold[3]);
      }
      for (let x = 4; x <= 14; x++) if (all.get(x, 9)) sheet.set(x + 1, 10, R.gold[3]);
      sheet.draw(['.b.', 'bBb', '.b.'], 1, 8, { b: R.gold[3], B: R.gold[5] });
      L.put(f, sheet, 1, 7);
      // the quill, writing on its own: a ghost-white vane, its nib on the unfinished line
      const quill = strokeQuad(W, W, [29, 2], [22, 9], [15, 20], (t) => (t < 0.78 ? 2 + 4 * Math.sin(Math.PI * Math.min(1, t * 1.25)) : 1.4));
      L.layInk(f, quill, GHOST, { cap: 1.6, base: 5, gain: 3 });
      f.line(28, 3, 16, 19, GHOST[3]);
      f.rect(14, 20, 2, 2, C.edge);
      return f;
    },
    overlay(k, b) { L.pool(b, 'spectral', 22, 9, 10, '#D9F4FF', ['22', '10']); },
  });

  // ---- Doppelganger (doppelganger): the rightmost Joker becomes a copy of the leftmost. A jester nose to nose
  // with his see-through ghost-blue double, both in the same pink-belled cap, shaking hands below.
  const DOPPEL = { me: [-3, 0], at: [14, 0], twin: () => L.jesterLeft({ cap: R.pink.slice(3), skin: GHOST, band: GHOST }) };
  A.spectral('doppelganger', {
    draw() {
      const f = new Bmp(W, W);
      // the handshake: forearms rising from below, a pink sleeve and a ghost-blue one, hands clasped between
      L.layInk(f, strokeQuad(W, W, [5, 31], [8, 26], [12, 24], 5), R.pink, { cap: 1.8, base: 5, gain: 3 });
      L.layInk(f, strokeQuad(W, W, [25, 31], [22, 26], [18, 24], 5), GHOST, { cap: 1.8, base: 4, gain: 3 });
      const clasp = new Bmp(7, 5);
      clasp.draw(['.sssgg.', 'ssssggg', 'SsskSgg', 'SSkgggg', '.SSgGG.'], 0, 0, { s: R.peach[6], S: R.peach[4], g: GHOST[5], G: GHOST[4], k: C.edge });
      L.put(f, clasp, 12, 22);
      // the two heads, nose to nose
      L.put(f, L.jesterHead({ cap: R.pink }), DOPPEL.me[0], DOPPEL.me[1]);
      L.put(f, DOPPEL.twin(), DOPPEL.at[0], DOPPEL.at[1]);
      return f;
    },
    // the double is see-through: the night shows faintly through him (an even veil over his pixels, no dither: a
    // checker on his pink cap would read as a harlequin pattern)
    overlay(k, b) {
      const ink = L.inked(DOPPEL.twin());
      L.veil(b, (x, y) => (ink.get(x - DOPPEL.at[0] + 1, y - DOPPEL.at[1] + 1) && x >= 15 ? '#141A4440' : null));
    },
  });

  // ---- Graveyard Shift (graveyardshift): two cards destroyed, two better ones added. Card-shaped headstones on a
  // night hill under a brass lamp's beam, two new cards rising between them with ribbons on.
  A.spectral('graveyardshift', {
    draw() {
      const f = new Bmp(W, W);
      // the hill
      L.lay(f, L.mask((x, y) => y >= 25 + Math.abs(x - 15) * 0.12), [R.plum[2], R.plum[3], R.plum[4]], { cap: 1, base: 1, gain: 2 });
      // the headstones: grey stone cut like cards, a pip carved in each
      const stone = (pip) => {
        const s = new Bmp(8, 11);
        for (let y = 0; y < 11; y++) for (let x = 0; x < 8; x++) if (!(y === 0 && (x < 2 || x > 5)) && !(y === 1 && (x === 0 || x === 7))) s.set(x, y, x <= 1 || y <= 1 ? R.steel[3] : x === 7 ? R.steel[1] : R.steel[2]);
        s.blit(emboss(Mask.rows(K.PIP5[pip]), [R.steel[0], R.steel[1]], { cap: 1, base: 0, gain: 1 }), 2, 3);
        return s;
      };
      L.put(f, stone('S'), 2, 16); L.put(f, stone('C'), 21, 17);
      // the two new cards rising, each with a ribbon over its top edge, sparks round them
      const risen = (pip, ramp) => { const c = L.card(8, 11, { pip, py: 4 }); c.rect(5, 0, 2, 4, ramp[5]); c.set(5, 0, ramp[7]); c.set(6, 3, ramp[3]); return c; };
      L.put(f, risen('H', R.pink), 10, 9); L.put(f, risen('D', R.chips), 14, 13);
      L.spark(f, 9, 7, GHOST[5]); L.spark(f, 24, 11, GHOST[5]);
      // the lamp, hanging at the top left: a brass frame round a warm glass
      f.draw(['..b..', '.bbb.', 'bgggb', 'bgygb', 'bgggb', '.bbb.'], 1, 0, { b: R.brass[4], g: R.ember[7], y: C.white });
      return f;
    },
    overlay(k, b) {
      // the lamp's beam sweeping down across the graves
      L.light(b, 'spectral', (x, y) => { const a = Math.atan2(y - 3, x - 3); return y > 5 && a > 0.45 && a < 0.95 ? (a > 0.58 && a < 0.82 ? '#FFD29C30' : '#FFD29C18') : null; });
    },
  });

  // ---- Hall of Mirrors (hallofmirrors): three copies of a card, two others lost. One cream card reflected down a
  // carnival corridor of mirrors framed pink, gold and maroon in turn, each copy smaller and paler than the last.
  A.spectral('hallofmirrors', {
    draw() {
      const f = new Bmp(W, W);
      // the corridor recedes to the upper right: every frame and every copy is the one in front, drawn smaller
      // and pulled toward that far point
      const vx = 25, vy = 5, T = [0, 0.38, 0.62, 0.8];
      const toward = ([x0, y0, x1, y1], t) => [x0 + (vx - x0) * t, y0 + (vy - y0) * t, x1 + (vx - x1) * t, y1 + (vy - y1) * t].map(Math.round);
      const arch = (x0, y0, x1, y1) => { const r = (x1 - x0) / 2; return (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && (y >= y0 + r || Math.hypot(x - (x0 + x1) / 2, y - (y0 + r)) <= r + 0.3); };
      const glass = [GHOST[2], R.navy[4], R.navy[3], R.navy[2]];
      const frame = [[R.pink[5], R.pink[3]], [R.gold[5], R.gold[3]], [R.maroon[5], R.maroon[3]], [R.pink[5], R.pink[3]]];
      T.forEach((t, i) => {
        const [x0, y0, x1, y1] = toward([1, 0, 29, 30], t), rim = i ? 1 : 2;
        const outer = arch(x0, y0, x1, y1), inner = arch(x0 + rim, y0 + rim, x1 - rim, y1 - (i ? 0 : 1));
        for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (outer(x, y)) f.set(x, y, inner(x, y) ? glass[i] : x - x0 + y - y0 < (x1 - x0) * 0.7 ? frame[i][0] : frame[i][1]);
      });
      // the card and its copies, back to front, each nearer one a little less pale
      const pale = [L.STOCK.cream, [C.cream, C.cream1, C.cream2, C.cream4], [GHOST[6], GHOST[5], GHOST[5], GHOST[4]], [GHOST[5], GHOST[4], GHOST[4], GHOST[3]]];
      for (let i = 3; i >= 0; i--) {
        const [x0, y0, x1, y1] = toward([4, 15, 13, 27], T[i]), w = x1 - x0 + 1, h = y1 - y0 + 1;
        const c = L.card(w, h, { stock: pale[i] });
        if (i < 2) c.blit(pipBmp('H', 5), Math.floor((w - 5) / 2), Math.floor((h - 5) / 2));
        else c.rect(Math.floor(w / 2) - 1, Math.floor(h / 2) - 1, 2, 2, i === 2 ? R.pink[6] : R.pink[7]);
        L.put(f, c, x0, y0);
      }
      return f;
    },
  });

  // ---- Tall Tale (originstory): a Legendary Joker made, a card of hand size lost for good. An old storybook lying
  // open, its pages glowing, ghost-blue smoke rising out of it in puffs that wind up into a gold crown.
  A.spectral('originstory', {
    draw() {
      const f = new Bmp(W, W);
      // the smoke: round puffs climbing in an S from the pages, each lit on its own, the lower ones in front, joined
      // by a thin wisp
      L.wisp(f, [15, 22], [9, 16], [14, 11], 1.6, 1.2);
      L.wisp(f, [14, 11], [20, 8], [16, 5], 1.4, 1.2);
      [[16, 5, 2.1], [18.5, 8.2, 2.4], [13.5, 10.8, 2.7], [10.5, 14.6, 3], [14, 18.6, 3.5]].forEach((p) => L.puffs(f, [p], GHOST, { cap: 1.6 }));
      // the crown seated on the top puff
      f.draw([
        'g....g....g',
        'gg..ggg..gg',
        'ggggggggggg',
        'gGgGgGgGgGg',
        'ddddddddddd',
      ], 10, 0, { g: R.gold[5], G: R.gold[6], d: R.gold[3] });
      f.set(15, 3, R.pink[5]); f.set(11, 3, R.chips[6]); f.set(19, 3, R.chips[6]);
      // sparks rising with the smoke
      L.spark(f, 22, 13, R.ember[6], R.ember[8]); f.rect(7, 9, 2, 2, R.gold[5]); f.set(7, 9, R.gold[6]);
      // the book: two glowing pages on a maroon cover, lines of a tale on each
      const book = new Bmp(29, 8);
      book.rect(0, 2, 29, 6, R.maroon[3]); book.rect(0, 7, 29, 1, R.maroon[1]);
      for (let x = 1; x < 28; x++) { const lift = x < 14 ? Math.round((13 - x) * 0.12) : Math.round((x - 15) * 0.12); for (let y = 2 - lift; y < 6; y++) book.set(x, y, x === 14 ? C.cream2 : y === 2 - lift ? C.white : Math.abs(x - 14) < 6 ? C.white : C.cream); }
      for (let x = 3; x < 12; x++) if (x % 4 !== 0) { book.set(x, 3, C.cream3); book.set(x, 5, C.cream3); }
      for (let x = 17; x < 26; x++) if (x % 5 !== 0) { book.set(x, 3, C.cream3); book.set(x, 5, C.cream3); }
      L.put(f, book, 1, 22);
      return f;
    },
    overlay(k, b) { L.glow(b, 'spectral', 15, 11, 13, '#AC7BFF', ['2A', '14'], 0.8); },
  });
})();
