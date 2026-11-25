/* Playing cards (the CARDS art workflow): the 52 faces with twelve court characters, the ten Deck backs, the
 * eight Enhancements, the four Seals, the four Editions and the four Stake chips, in Ember Lit's sprite style
 * (mockups/ember-lit): 41 x 55 cards, hue-shifted ramps of 6 to 9 shades lit from the upper left, a 1-art-px ink
 * edge (#2B1220), crisp pixels. Every make() here is DOM-free and deterministic.
 *
 * Kept from Lit, pixel-identical: the number cards and Aces (the core's numberFace and aceFace), Lit's three court
 * people (the Jack of Spades with his lantern, the King of Spades with his ember sceptre, the Queen of Hearts with
 * her flower), the House Deck back, the Encore ribbon and the Glitch fringe.
 *
 * Courts. Lit drew three people and re-robed them for seven cards; here every court is its own person. Lit's three
 * keep the suit whose motif matches what they hold, and nine new people complete the deck. Each suit carries a
 * motif from the candlelit room: Spades carry light into the night (lanterns), Hearts carry flowers, Clubs carry
 * candles, Diamonds carry keys. The robes keep Lit's four suit families (kit.ROBE); the index and pips keep the
 * suit inks (Spades and Clubs dark, Hearts and Diamonds red). Full-length, single-ended figures in an arched
 * window: nothing from a casino deck's double-ended courts or from any other card game's.
 *
 * Colour-coded suits (the fourColor option): the same 52 faces again as 'card4:{rank}{suit}', Clubs in a deep green
 * and Diamonds in a royal blue (kit.SUIT_INK4, shade for shade against the two-colour inks), the court motifs drawn
 * in the suit ink following it. Spades and Hearts are the two-colour faces.
 *
 * Card mods (ARCH section 4, ART.md section 3): Enhancements change the stock or add a treatment that keeps clear
 * of the index and pips; their emblems sit in the free lower-left corner, so a Seal (top right) never hides them.
 * Seals are four distinct shapes at the one Seal spot over the top edge (never a round wax blob). Editions bake
 * their pixels into the composed card; their motion is CSS class ed-{id}, which the UI owns (ART.md section 11).
 */
(() => {
  'use strict';
  const A = globalThis.TW.Art;
  const K = A.kit;
  const { Bmp, Mask, R, C, emboss, ROBE } = K;

  // ---- people: skin and hair ramps, dark to light (index 1 shade, 2 base, 3 highlight), hue-shifted like Lit's
  const SKIN = {
    fair: ['#A8645A', '#D59A80', '#F6CBA8', '#FFE2C8', '#FFF0E0'],
    rosy: ['#94564C', '#C47E6C', '#EAAE94', '#FBCDB4', '#FFE6D6'],
    tan: ['#7E4A2E', '#B07448', '#E2A574', '#F5C79A', '#FFE0BC'],
    olive: ['#5E3A22', '#8A5A36', '#B8834F', '#D6A46C', '#EFC58E'],
    brown: ['#4A2A1C', '#6A4029', '#8C5A3C', '#A9734F', '#C99068'],
  };
  const HAIR = {
    night: ['#120C1E', '#1E1630', '#2E2446', '#4A3C6E', '#6A5A94'],
    black: ['#140A10', '#24121C', '#38202C', '#56364A', '#74506A'],
    brown: ['#2A140C', '#46241A', '#643828', '#865038', '#A86C4C'],
    copper: ['#5A1E10', '#8A3418', '#B85224', '#D8743A', '#F09A5C'],
    blonde: ['#7A4E18', '#AE7C2C', '#DCAA48', '#F2CC70', '#FFE8A8'],
  };
  const STRAW = ['#6A4418', '#946628', '#C08E40', '#DCB062', '#F0D08A', '#FFEAB8'];
  const FUR = ['#9C8C86', '#CFC3BC', '#EFE6DE', '#FFFCF5', '#FFFFFF']; // Lit's ermine white
  const SABLE = ['#2E140A', '#4A2213', '#6A331B', '#8E4826', '#B0623A'];
  const FL = K.FLAME_KEY; // r o a y u v k
  const W = 19, H = 45;
  const face = (skin, hair, extra = {}) => ({ h: hair[2], H: hair[1], j: hair[3], s: skin[2], S: skin[1], t: skin[3], e: C.edge, k: C.edge, ...extra });
  const hand = (f, x, y, sk) => f.draw(['tS', 'SS'], x, y, { t: sk[3], S: sk[2] });
  const robe = (mask, ramp, o = {}) => emboss(mask, ramp, { cap: 4, base: 3, gain: 4, ...o });
  const creamPip = (suit) => emboss(Mask.rows(K.PIP5[suit]), R.cream, { cap: 1.6, base: 5, gain: 3 });
  const stamp = (f, g, x, y, key) => { const b = new Bmp(g[0].length, g.length); b.draw(g, 0, 0, key); f.blit(b, x, y); return b; };

  // ================================================================ SPADES: night and lanterns
  // Queen of Spades: the Night Queen. Blue-black hair, a silver crescent, a star-flecked mantle over a
  // moonlit gown, a lantern held up in both hands.
  function queenSpades(k, ctx) {
    const RR = ctx.robe.ramp, sk = SKIN.olive, hr = HAIR.night, f = new Bmp(W, H);
    const LILAC = ['#3A3A6A', '#55558C', '#7474AE', '#9898CC', '#BCBCE6', '#DCDCF6', '#F2F2FF'];
    const gown = Mask.fn(W, H, (x, y) => { if (y < 15) return false; const half = y === 15 ? 5 : y < 23 ? 6 : Math.min(9, 6 + Math.floor((y - 22) / 5)); return Math.abs(x - 9) <= half; });
    f.blit(robe(gown, RR), 0, 0);
    const panel = Mask.fn(W, H, (x, y) => y >= 17 && y <= 41 && Math.abs(x - 9) <= (y < 26 ? 2 : 2 + Math.floor((y - 26) / 6)));
    f.blit(emboss(panel, LILAC, { cap: 2, base: 4, gain: 3 }), 0, 0);
    for (let y = 17; y <= 41; y++) { const hw = y < 26 ? 2 : 2 + Math.floor((y - 26) / 6); f.set(9 - hw - 1, y, RR[1]); f.set(9 + hw + 1, y, RR[1]); }
    // stars on the mantle
    [[2, 19], [15, 21], [1, 27], [16, 30], [3, 35], [14, 37], [5, 24], [13, 26], [2, 41], [16, 40]].forEach(([x, y]) => { if (f.get(x, y)) f.set(x, y, R.cream[6]); });
    // neckline, the silver hem
    f.rect(7, 15, 5, 1, sk[2]); f.set(7, 15, sk[3]); f.rect(8, 16, 3, 1, sk[1]);
    for (let x = 0; x < W; x++) if (f.get(x, 42)) { f.set(x, 42, R.steel[4]); f.set(x, 43, x % 2 ? R.steel[2] : R.steel[3]); f.set(x, 44, RR[0]); }
    f.blit(K.pipBmp('S', 5), 7, 34);
    hand(f, 6, 26, sk); // her other hand at the gown's front
    f.draw([
      '...................',
      '...................',
      '...................',
      '.....hhhhxhhhh.....',
      '....hhhhhjhhhhH....',
      '...hhvvvvvvvvvhhH..',
      '...hhtssssssSShhH..',
      '...hhsHHsssHHShhH..',
      '...hhssesssesShhH..',
      '...hhtsssSsssShhH..',
      '...hhsnsssssnShhH..',
      '...hhsssmmmssShhH..',
      '...hhhssssssShhhH..',
      '...hhhhssssShhhhH..',
      '...hhhhhtsShhhhhH..',
      '...hhh.......hhhH..',
      '...hhh.......hhhH..',
      '...hhh.......hhH...',
      '...Hhh.......hhH...',
      '....Hh.......hH....',
      '....H.........H....',
    ], 0, 0, face(sk, hr, { w: R.steel[5], v: R.steel[4], V: R.steel[3], x: R.steel[2], m: '#8A2E4A', n: '#C97A5E' }));
    // a silver crescent on its side, opening to the right, pinned at the left of her hair (lit upper left)
    stamp(f, ['.aat', 'aa..', 'ab..', 'ab..', 'bc..', '.cct'], 3, 0, { a: R.steel[5], b: R.steel[4], c: R.steel[3], t: R.steel[4] });
    // the lantern, carried at her side: a ring handle, an ink cap, gold side bars round a lit pane; a hand under it
    stamp(f, ['..k..', '.k.k.', 'kkkkk', 'YoooY', 'YouoY', 'YouoY', 'YoooY', 'kkkkk'], 12, 20, { k: C.edge, Y: R.gold[2], o: '#FFD84A', u: '#FFF2B0' });
    hand(f, 13, 28, sk);
    return f;
  }

  // ================================================================ HEARTS: flowers
  // Jack of Hearts: the Gardener. A wide straw hat with a rose in its band, a linen apron, a potted rose.
  function jackHearts(k, ctx) {
    const RR = ctx.robe.ramp, sk = SKIN.rosy, hr = HAIR.blonde, f = new Bmp(W, H);
    const tunic = Mask.fn(W, H, (x, y) => { if (y < 14) return false; if (y >= 39) return (x >= 4 && x <= 7) || (x >= 11 && x <= 14); const half = y === 14 ? 4 : y === 15 ? 6 : y < 28 ? 7 : 8; return Math.abs(x - 9) <= half; });
    f.blit(robe(tunic, RR), 0, 0);
    for (let y = 39; y < 43; y++) for (const x of [4, 5, 6, 7, 11, 12, 13, 14]) f.set(x, y, x === 4 || x === 11 ? R.plum[5] : x === 7 || x === 14 ? R.plum[3] : R.plum[4]);
    for (const x of [3, 4, 5, 6, 7, 11, 12, 13, 14, 15]) { f.set(x, 43, R.wood[3]); f.set(x, 44, R.wood[1]); }
    // the linen apron: a bib on two straps, a pocket, the heart sewn on the bib
    const apron = Mask.fn(W, H, (x, y) => (y >= 19 && y <= 36 && Math.abs(x - 9) <= (y < 26 ? 3 : 5)));
    f.blit(emboss(apron, R.cream, { cap: 2, base: 5, gain: 3 }), 0, 0);
    for (let y = 15; y < 19; y++) { f.set(6, y, R.cream[5]); f.set(12, y, R.cream[4]); }
    for (let x = 4; x <= 14; x++) f.set(x, 26, R.cream[3]);
    f.draw(['wwwww', 'w...w', 'wWWWw'], 7, 30, { w: R.cream[3], W: R.cream[4] });
    f.blit(K.pipBmp('H', 5), 7, 20);
    f.rect(7, 14, 5, 1, sk[1]);
    // the potted rose, carried on his right
    hand(f, 4, 27, sk);
    stamp(f, [
      '..lpRl.',
      '.lrRRLl',
      'lLlpRlL',
      '.lLLlL.',
      'cccccCk',
      '.oooOk.',
      '.oooOk.',
      '..ooO..',
    ], 12, 23, { l: R.lime[4], L: R.lime[2], p: R.red[5], r: R.red[3], R: R.red[2], c: R.ember[6], C: R.ember[4], o: R.ember[3], O: R.ember[2], k: C.edge });
    hand(f, 12, 29, sk);
    f.draw([
      '......xzzzzzZ......',
      '.....xzzzzzzzZ.....',
      '.....zzzzzzzzZ.....',
      '.....rrprRrrrR.....',
      '.xzzzzzzzzzzzzzzzZ.',
      '..ZZZZZZZZZZZZZZZ..',
      '...hhSSSSSSSSShh...',
      '..hhhsHHsssHHShhh..',
      '..hhhssesssesShhh..',
      '..hhhtsssSsssShhh..',
      '..hhhsnnsssnnShhh..',
      '...hhsssmmmssShh...',
      '....hhssssssShh....',
      '........tsS........',
    ], 0, 0, face(sk, hr, { x: STRAW[5], z: STRAW[3], Z: STRAW[1], r: R.red[3], R: R.red[2], p: R.red[5], m: '#9A3A3A', n: '#E58A80' }));
    return f;
  }

  // King of Hearts: the Rose King. A crown of roses, a copper beard, a rose-sprigged panel and a long-stemmed rose.
  function kingHearts(k, ctx) {
    const RR = ctx.robe.ramp, sk = SKIN.fair, hr = HAIR.copper, f = new Bmp(W, H);
    const body = Mask.fn(W, H, (x, y) => y >= 14 && Math.abs(x - 9) <= (y === 14 ? 5 : y === 15 ? 8 : 9));
    f.blit(robe(body, RR), 0, 0);
    // a cape falling from the shoulders (darker), lined in cream at its front edges
    for (let y = 17; y < 42; y++) { f.set(0, y, RR[2]); f.set(1, y, RR[1]); f.set(17, y, RR[1]); f.set(18, y, RR[0]); }
    // the cream panel sprigged with roses
    const panel = Mask.fn(7, 23, () => true);
    f.blit(emboss(panel, R.cream, { cap: 2, base: 5, gain: 3 }), 6, 18);
    [[7, 25], [10, 29], [7, 34], [10, 38]].forEach(([x, y]) => f.draw(['pr', 'rR', 'L.'], x, y, { p: R.red[5], r: R.red[3], R: R.red[2], L: R.lime[3] }));
    f.blit(K.pipBmp('H', 5), 7, 19);
    // fur collar, belt, hem
    const collar = Mask.fn(W, 4, (x, y) => (y === 0 ? Math.abs(x - 9) <= 7 : y < 3 ? true : Math.abs(x - 9) >= 3));
    f.blit(emboss(collar, FUR, { cap: 2, base: 3, gain: 3 }), 0, 15);
    for (let x = 0; x < W; x++) { f.set(x, 31, R.gold[4]); f.set(x, 32, R.gold[2]); }
    f.draw(['YyyY', 'yrry', 'YyyY'], 7, 30, { y: R.gold[4], Y: R.gold[2], r: R.red[4] });
    const hem = Mask.fn(W, 3, () => true);
    f.blit(emboss(hem, FUR, { cap: 1.5, base: 3, gain: 3 }), 0, 42);
    // the long-stemmed rose sceptre on his right side (viewer's left): the stem runs up past his hair to a rose
    // held high on the pale window ground beside the crown (pink on pale, not red on his red robe)
    for (let y = 4; y < 36; y++) f.set(1, y, y % 5 === 2 ? R.lime[2] : R.lime[4]);
    f.set(0, 6, R.lime[5]); f.set(0, 7, R.lime[3]); // one leaf
    hand(f, 1, 27, sk);
    f.draw([
      '...prR..prR..prR...',
      '...rRR..rRR..rRR...',
      '...yyY..yyY..yyY...',
      '...yyyY.yyY.yyyY...',
      '...yyyyyyyyyyyyY...',
      '...ygyyuyyyuyygY...',
      '...yyyyyyyyyyyyY...',
      '..hYYYYYYYYYYYYYh..',
      '..hhtssssssssSShh..',
      '..hhsbbbsssbbbShh..',
      '..hhsseesssseeShh..',
      '..hhtnnssSssnnShh..',
      '..hhsjhhhhhhhjShh..',
      '..hhhhhhmmmhhhhhh..',
      '...hhhhhhhhhhhhH...',
      '....Hhhhhhhhhhh....',
      '.....HHhhhhhHH.....',
    ], 0, 0, face(sk, hr, { u: R.gold[6], y: R.gold[4], Y: R.gold[3], g: R.red[4], p: R.red[5], r: R.red[3], R: R.red[2], m: '#7A2620', n: '#F0907E', b: hr[3] }));
    // the rose at the top of the sceptre, lit on its upper left (the core inks its outline with the figure's)
    stamp(f, ['.ab.', 'abbc', 'bcdc', '.dd.'], 0, 0, { a: R.pink[6], b: R.pink[5], c: R.pink[4], d: R.pink[3] });
    return f;
  }

  // ================================================================ CLUBS: candles
  // Jack of Clubs: the Chandler's boy. A green beret, a leather apron, a chamberstick raised high, tapers at his belt.
  function jackClubs(k, ctx) {
    const RR = ctx.robe.ramp, sk = SKIN.brown, hr = HAIR.black, f = new Bmp(W, H);
    const tunic = Mask.fn(W, H, (x, y) => { if (y < 13) return false; if (y >= 39) return (x >= 4 && x <= 7) || (x >= 11 && x <= 14); const half = y === 13 ? 4 : y === 14 ? 6 : y < 28 ? 7 : 8; return Math.abs(x - 9) <= half; });
    f.blit(robe(tunic, RR), 0, 0);
    for (let y = 39; y < 43; y++) for (const x of [4, 5, 6, 7, 11, 12, 13, 14]) f.set(x, y, x === 4 || x === 11 ? RR[3] : x === 7 || x === 14 ? RR[1] : RR[2]);
    for (const x of [3, 4, 5, 6, 7, 11, 12, 13, 14, 15]) { f.set(x, 43, R.wood[3]); f.set(x, 44, R.wood[1]); }
    // leather apron, lit down its left edge, two folds, drips of wax from the belt
    const apron = Mask.fn(W, H, (x, y) => y >= 24 && y <= 37 && Math.abs(x - 9) <= 5);
    f.blit(emboss(apron, R.wood, { cap: 2, base: 4, gain: 3 }), 0, 0);
    for (let y = 24; y <= 37; y++) f.set(4, y, R.wood[5]);
    for (let y = 30; y <= 37; y++) { f.set(7, y, R.wood[2]); f.set(11, y, R.wood[2]); }
    [[5, 24, 2], [7, 24, 1]].forEach(([x, y, n]) => { for (let i = 0; i < n; i++) f.set(x, y + i, R.cream[6]); f.set(x, y + n, R.cream[4]); });
    for (let x = 2; x <= 16; x++) { f.set(x, 23, R.wood[1]); }
    f.blit(creamPip('C'), 7, 17);
    // three tapers hanging from his belt, tied with a cord: separate sticks with apron between them, the middle
    // one's wick still glowing
    for (let y = 24; y <= 29; y++) { f.set(10, y, R.cream[6]); f.set(12, y, R.cream[6]); f.set(14, y, R.cream[5]); }
    f.set(12, 24, R.ember[5]); f.set(10, 29, R.cream[4]); f.set(12, 29, R.cream[4]); f.set(14, 29, R.cream[3]);
    for (let x = 9; x <= 15; x++) f.set(x, 26, R.wood[1]);
    // the raised arm and hand; the chamberstick itself goes on after the head (below)
    f.rect(2, 16, 2, 6, RR[4]); f.set(2, 16, RR[5]); f.rect(4, 16, 1, 6, RR[2]);
    hand(f, 2, 14, sk);
    f.draw([
      '.........l.........',
      '......llrrrR.......',
      '....lrrrrrrrrrR....',
      '...lrrrrrrrrrrrR...',
      '...hRRRRRRRRRRRRh..',
      '...hhsHHsssHHShh...',
      '...hhssesssesShh...',
      '...hhtsssSsssShh...',
      '...hhsnsssssnShh...',
      '....hsssmmmssSh....',
      '......ssssssS......',
      '........tsS........',
    ], 0, 0, face(sk, hr, { l: RR[5], r: RR[3], R: RR[2], m: '#4A1A1A', n: '#A85A44' }));
    // the chamberstick raised beside his head, in front of his hair, with pale ground round its flame
    stamp(f, ['..r..', '.ooa.', '.oyo.', '.ayu.', '..k..', '.www.', '.wwW.', '.wwW.', 'YyyyY', '.YYY.'], 1, 4, { ...FL, w: R.cream[6], W: R.cream[4], y: R.gold[4], Y: R.gold[2] });
    return f;
  }

  // Queen of Clubs: the Candle-Crown Queen. A wreath of lit candles, copper braids, a green gown over cream.
  function queenClubs(k, ctx) {
    const RR = ctx.robe.ramp, sk = SKIN.rosy, hr = HAIR.copper, f = new Bmp(W, H);
    const gown = Mask.fn(W, H, (x, y) => { if (y < 15) return false; const half = y < 17 ? 6 : Math.min(9, 6 + Math.floor((y - 17) / 7)); return Math.abs(x - 9) <= half; });
    f.blit(robe(gown, RR), 0, 0);
    // the cream underdress showing down the front, a dark green girdle
    const under = Mask.fn(W, H, (x, y) => y >= 16 && y <= 41 && Math.abs(x - 9) <= (y < 27 ? 2 : 2 + Math.floor((y - 27) / 5)));
    f.blit(emboss(under, R.cream, { cap: 2, base: 5, gain: 3 }), 0, 0);
    for (let x = 3; x <= 15; x++) { f.set(x, 26, RR[1]); f.set(x, 27, RR[2]); }
    f.blit(K.pipBmp('C', 5), 7, 18);
    f.rect(7, 15, 5, 1, sk[2]); f.set(7, 15, sk[3]); f.rect(8, 16, 3, 1, sk[1]);
    for (let x = 0; x < W; x++) if (f.get(x, 42)) { f.set(x, 42, R.cream[6]); f.set(x, 43, x % 3 === 1 ? R.cream[4] : R.cream[6]); f.set(x, 44, RR[0]); }
    hand(f, 6, 28, sk); hand(f, 11, 28, sk);
    // two copper braids over the shoulders, tied with red
    for (let y = 14; y < 30; y++) { f.set(3, y, y % 2 ? hr[2] : hr[3]); f.set(4, y, y % 2 ? hr[3] : hr[1]); f.set(14, y, y % 2 ? hr[2] : hr[3]); f.set(15, y, y % 2 ? hr[3] : hr[1]); }
    f.draw(['rr', 'RR'], 3, 30, { r: R.red[3], R: R.red[2] }); f.draw(['rr', 'RR'], 14, 30, { r: R.red[3], R: R.red[2] });
    f.draw([
      '....o....o....o....',
      '...oyo..oyo..oyo...',
      '...wkW..wkW..wkW...',
      '...wwW..wwW..wwW...',
      '..gLgggLgbgLgggLg..',
      '..GgGbGgGgGgGbGgG..',
      '...hhhhhhjhhhhhH...',
      '..hhhtssssssSShhh..',
      '..hhhsHHsssHHShhh..',
      '..hhhssesssesShhh..',
      '..hhhtsssSsssShhh..',
      '..hhhsnsssssnShhh..',
      '..hhhsssmmmssShhh..',
      '..hhhhssssssShhhh..',
      '...hh...tsS...hh...',
    ], 0, 0, face(sk, hr, { o: FL.o, y: FL.y, w: R.cream[7], W: R.cream[4], g: RR[4], G: RR[2], L: RR[6], b: R.red[3], m: '#B3284A', n: '#F59AA8' }));
    return f;
  }

  // King of Clubs: the Candelabra King. A domed crown, a long black beard, a sable collar, a candelabra held high.
  function kingClubs(k, ctx) {
    const RR = ctx.robe.ramp, sk = SKIN.olive, hr = HAIR.black, f = new Bmp(W, H);
    const body = Mask.fn(W, H, (x, y) => y >= 14 && Math.abs(x - 9) <= (y === 14 ? 5 : y === 15 ? 8 : 9));
    f.blit(robe(body, RR), 0, 0);
    for (let y = 20; y < 41; y++) { f.set(3, y, RR[1]); f.set(15, y, RR[1]); f.set(4, y, RR[2]); }
    const collar = Mask.fn(W, 5, (x, y) => (y === 0 ? Math.abs(x - 9) <= 7 : y < 4 ? true : Math.abs(x - 9) >= 3));
    f.blit(emboss(collar, SABLE, { cap: 2, base: 3, gain: 3 }), 0, 15);
    // a gold chain of office with the club on a cream medallion
    [[5, 20], [6, 21], [7, 22], [11, 22], [12, 21], [13, 20]].forEach(([x, y]) => f.set(x, y, R.gold[4]));
    f.draw(['.yyyyy.', 'yw...wy', 'yw...wy', 'yw...wy', 'yw...wy', '.yyyyy.'], 6, 22, { y: R.gold[3], w: R.cream[6] });
    f.rect(7, 23, 5, 4, R.cream[6]);
    f.blit(K.pipBmp('C', 5), 7, 22);
    for (let x = 0; x < W; x++) { f.set(x, 31, R.wood[3]); f.set(x, 32, R.wood[1]); }
    f.draw(['YyyY', 'yuuy', 'YyyY'], 7, 30, { y: R.gold[4], Y: R.gold[2], u: R.gold[6] });
    const hem = Mask.fn(W, 4, () => true);
    f.blit(emboss(hem, SABLE, { cap: 1.5, base: 3, gain: 3 }), 0, 41);
    hand(f, 4, 27, sk);
    // brows (b) and the beard's lit edge and two strands (J) a step lighter than the beard, so the eyes, brows,
    // beard and mouth read as separate shapes at 2 px per art px; a pale lower lip (n) under the mouth
    f.draw([
      '.........u.........',
      '......lllylll......',
      '....llrrryrrrrR....',
      '...yrrrrryrrrrRY...',
      '...yyyyyyyyyyyyY...',
      '...ygyyyyuyyyygY...',
      '..hYYYYYYYYYYYYYh..',
      '..hhtssssssssSShh..',
      '..hhsbbbsssbbbShh..',
      '..hhssesssssesShh..',
      '..hhtssssSssssShh..',
      '..hhssJjhhhjhsShh..',
      '..hhhhhhmmmhhhhhh..',
      '...JhhhJhnhJhhhh...',
      '....JhhJhhhJhhh....',
      '.....JhhJhJhhh.....',
      '......Jhhhhhh......',
      '.......Jhhhh.......',
      '........Jhh........',
      '.........h.........',
    ], 0, 0, face(sk, hr, { u: R.gold[6], y: R.gold[4], Y: R.gold[3], g: R.lime[5], l: RR[5], r: RR[3], R: RR[2], m: '#5A1A1A', n: '#B86A4A', b: hr[3], J: hr[4] }));
    // the candelabra, held at his side below the sable collar (viewer's right), clear of his face and the medallion
    stamp(f, ['..r..', 'r.o.r', 'o.f.o', 'f.w.f', 'w.w.w', 'yyyyY', '..y..', '..y..', '..Y..'], 14, 19,
      { r: FL.r, o: FL.o, f: FL.y, w: R.cream[6], y: R.gold[4], Y: R.gold[2] });
    hand(f, 15, 27, sk);
    return f;
  }

  // ================================================================ DIAMONDS: keys
  // Jack of Diamonds: the Key-keeper. A hood and capelet, a great brass key on his shoulder, a ring of keys at his belt.
  function jackDiamonds(k, ctx) {
    const RR = ctx.robe.ramp, sk = SKIN.fair, hr = HAIR.brown, f = new Bmp(W, H);
    const tunic = Mask.fn(W, H, (x, y) => { if (y < 13) return false; if (y >= 39) return (x >= 4 && x <= 7) || (x >= 11 && x <= 14); const half = y === 13 ? 6 : y < 19 ? 8 : y < 28 ? 7 : 8; return Math.abs(x - 9) <= half; });
    f.blit(robe(tunic, RR), 0, 0);
    // the capelet, a shade deeper, with a scalloped edge
    const cap = Mask.fn(W, H, (x, y) => y >= 13 && y < 19 && f.get(x, y) && !(y === 18 && x % 3 === 1));
    f.blit(emboss(cap, R.maroon, { cap: 2, base: 4, gain: 3 }), 0, 0);
    for (let y = 39; y < 43; y++) for (const x of [4, 5, 6, 7, 11, 12, 13, 14]) f.set(x, y, x === 4 || x === 11 ? R.maroon[5] : x === 7 || x === 14 ? R.maroon[3] : R.maroon[4]);
    for (const x of [3, 4, 5, 6, 7, 11, 12, 13, 14, 15]) { f.set(x, 43, R.wood[3]); f.set(x, 44, R.wood[1]); }
    for (let x = 1; x < 18; x++) { f.set(x, 27, R.wood[3]); f.set(x, 28, R.wood[1]); }
    f.blit(creamPip('D'), 7, 20);
    // a ring on the belt with two little keys hanging from it, each a round bow on a short shaft with a bit
    stamp(f, ['..rRr..', '..R.R..', '..RdR..', 'aab.aab', 'a.d.a.d', 'bbd.bbd', '.a...a.', '.ad..ad', '.a...a.', '.ad..ad'], 10, 27,
      { r: R.brass[6], R: R.brass[5], a: R.brass[6], b: R.brass[4], d: R.brass[1] });
    f.draw([
      '.......lrrrR.......',
      '.....lrrrrrrrR.....',
      '...lrrrrrrrrrrrR...',
      '..lrrrrrrrrrrrrrR..',
      '..rrrhhhhhhhhhrrR..',
      '..rrrhjhhhjhhhrrR..',
      '..rrrsHHsssHHSrrR..',
      '..rrrssesssesSrrR..',
      '..rrrtsssSsssSrrR..',
      '..rrrsnsssssnSrrR..',
      '..rrrsssmmmssSrrR..',
      '...rrrssssssSrrR...',
      '...RrrrrtsSrrrrR...',
    ], 0, 0, face(sk, hr, { l: R.maroon[6], r: R.maroon[4], R: R.maroon[2], m: '#9A3A3A', n: '#F29A90' }));
    // the great key, shouldered on his right (viewer's left), all of it inside the window: a round bow with a dark
    // hole on the capelet's edge (inked off the hood), a two-px shaft down his side, a stepped bit at its foot
    const bow = new Bmp(7, 7);
    bow.draw(['.aab.', 'aabbc', 'abkbc', 'bbbcc', '.ccc.'], 1, 1, { a: R.brass[5], b: R.brass[4], c: R.brass[3], k: C.edge });
    bow.outline(C.edge);
    f.blit(bow, 0, 12);
    for (let y = 18; y <= 27; y++) { f.set(2, y, R.brass[5]); f.set(3, y, R.brass[2]); }
    f.draw(['bb.', 'bbb', 'b.b'], 4, 25, { b: R.brass[3] });
    hand(f, 2, 19, sk);
    return f;
  }

  // Queen of Diamonds: the Chatelaine. A high bun with a diamond tiara, gold drops, a locked casket in her hands,
  // keys on a chain at her hip.
  function queenDiamonds(k, ctx) {
    const RR = ctx.robe.ramp, sk = SKIN.brown, hr = HAIR.black, f = new Bmp(W, H);
    const gown = Mask.fn(W, H, (x, y) => { if (y < 14) return false; const half = y < 16 ? 6 : Math.min(9, 6 + Math.floor((y - 16) / 6)); return Math.abs(x - 9) <= half; });
    f.blit(robe(gown, RR), 0, 0);
    const stom = Mask.fn(W, H, (x, y) => y >= 16 && y <= 30 && Math.abs(x - 9) <= Math.max(0, 3 - Math.floor((y - 16) / 5)));
    f.blit(emboss(stom, R.cream, { cap: 2, base: 5, gain: 3 }), 0, 0);
    // a maroon overskirt opening in an inverted V from the waist, a gold edge along the V, and the orange
    // underskirt inside it in pleats (a shade line every 3 px with a highlight left of it)
    const open = (y) => Math.floor((y - 30) * 0.42);
    const over = Mask.fn(W, H, (x, y) => y >= 30 && y <= 42 && gown.get(x, y) && Math.abs(x - 9) > open(y));
    f.blit(emboss(over, R.maroon, { cap: 3, base: 4, gain: 3 }), 0, 0);
    for (let y = 31; y <= 42; y++) {
      const o = open(y);
      f.set(9 - o - 1, y, R.gold[4]); f.set(9 + o + 1, y, R.gold[3]);
      for (let x = 9 - o; x <= 9 + o; x++) { const p = (x - 9 + 30) % 3; f.set(x, y, p === 0 ? RR[2] : p === 2 ? RR[4] : RR[3]); }
    }
    for (let x = 0; x < W; x++) if (f.get(x, 43)) { f.set(x, 43, R.gold[4]); f.set(x, 44, R.maroon[1]); }
    // sleeves from the shoulders to the hands at the casket, lit on their upper left
    for (let y = 16; y <= 24; y++) {
      const l = y <= 20 ? 3 : 4, r = y <= 20 ? 13 : 12;
      f.set(l, y, R.maroon[5]); f.set(l + 1, y, R.maroon[4]); f.set(l + 2, y, R.maroon[3]);
      f.set(r, y, R.maroon[5]); f.set(r + 1, y, R.maroon[4]); f.set(r + 2, y, R.maroon[3]);
    }
    f.rect(6, 14, 7, 2, sk[2]); f.set(6, 14, sk[3]); f.rect(7, 15, 5, 1, sk[1]);
    for (let x = 5; x <= 13; x++) f.set(x, 16, x % 2 ? R.gold[5] : R.gold[3]);
    f.blit(K.pipBmp('D', 5), 7, 17);
    // the chatelaine: a gold chain from her waist, three keys
    for (let y = 29; y < 33; y++) f.set(14, y, y % 2 ? R.gold[3] : R.gold[5]);
    stamp(f, ['uyy', 'y.Y', 'yYY', '.Y.', '.Y.', '.YY', '.Y.', '.YY'], 13, 33, { u: R.gold[6], y: R.gold[4], Y: R.gold[2] });
    // the casket held before her
    hand(f, 5, 25, sk); hand(f, 12, 25, sk);
    stamp(f, ['kkkkkkk', 'kwWWWwk', 'kkkkkkk', 'kWwyWWk', 'kWWYWWk', 'kkkkkkk'], 6, 23, { k: C.edge, w: R.wood[6], W: R.wood[4], y: R.gold[5], Y: R.gold[2] });
    f.draw([
      '.......hhhhh.......',
      '......hjhhhhH......',
      '.......hhdhh.......',
      '....hyyydDdyyyH....',
      '...hhYYYYdYYYYhhH..',
      '...hhtssssssSShhH..',
      '...hhsHHsssHHShhH..',
      '...hhssesssesShhH..',
      '...hhtsssSsssShhH..',
      '...hysnsssssnSyhH..',
      '...hYsssmmmssSYh...',
      '....hhssssssShh....',
      '.......tsssS.......',
    ], 0, 0, face(sk, hr, { y: R.gold[4], Y: R.gold[3], d: R.red[4], D: R.red[2], m: '#5E1424', n: '#B0604A' }));
    return f;
  }

  // King of Diamonds: the Vault King. A crown set with a great red diamond, a curled moustache and goatee,
  // a maroon cape on cream fur, a key for a sceptre.
  function kingDiamonds(k, ctx) {
    const RR = ctx.robe.ramp, sk = SKIN.tan, hr = HAIR.brown, f = new Bmp(W, H);
    const body = Mask.fn(W, H, (x, y) => y >= 14 && Math.abs(x - 9) <= (y === 14 ? 5 : y === 15 ? 8 : 9));
    f.blit(robe(body, RR), 0, 0);
    const cape = Mask.fn(W, H, (x, y) => y >= 16 && y < 44 && (x <= 3 || x >= 15));
    f.blit(emboss(cape, R.maroon, { cap: 2, base: 3, gain: 3 }), 0, 0);
    const collar = Mask.fn(W, 4, (x, y) => (y === 0 ? Math.abs(x - 9) <= 7 : y < 3 ? true : Math.abs(x - 9) >= 2));
    f.blit(emboss(collar, FUR, { cap: 2, base: 3, gain: 3 }), 0, 15);
    // the orange front in vertical pleats (a shade line with a highlight left of it) either side of a cream fur
    // placket down the centre, like the other kings' centre panels
    for (let y = 19; y < 42; y++) for (const x of [6, 13]) { f.set(x, y, RR[2]); f.set(x - 1, y, RR[4]); }
    f.blit(emboss(Mask.fn(3, 23, () => true), FUR, { cap: 1.5, base: 3, gain: 3 }), 8, 19);
    f.blit(K.pipBmp('D', 5), 7, 20);
    for (let x = 4; x < 15; x++) { f.set(x, 30, R.gold[4]); f.set(x, 31, R.gold[2]); }
    f.draw(['.y.', 'ydy', '.y.'], 8, 29, { y: R.gold[5], d: R.red[4] });
    const hem = Mask.fn(W, 3, () => true);
    f.blit(emboss(hem, FUR, { cap: 1.5, base: 3, gain: 3 }), 0, 42);
    // the key sceptre at his left (viewer's right)
    for (let y = 19; y < 38; y++) f.set(16, y, y % 3 === 0 ? R.gold[2] : R.gold[4]);
    f.draw(['yy.', 'yY.', 'y..', 'yY.'], 16, 34, { y: R.gold[4], Y: R.gold[2] });
    stamp(f, ['.uyy.', 'uy.yY', 'y...Y', 'yy.YY', '.YYY.'], 14, 14, { u: R.gold[6], y: R.gold[4], Y: R.gold[2] });
    hand(f, 15, 25, sk);
    // a solid curled moustache (M, lit N on its upper left, both ends hooking up) with clean skin between it and
    // the side hair, the mouth under it, and a solid goatee (G) under the mouth: no stray hair on the cheeks
    f.draw([
      '...u..u..d..u..u...',
      '...yu.yudDdyu.yY...',
      '...yyyyydDdyyyyY...',
      '...yyyyyyDyyyyyY...',
      '..hYYYYYYYYYYYYYh..',
      '..hhtssssssssSShh..',
      '..hhsHHHsssHHHShh..',
      '..hhssesssssesShh..',
      '..hhtsNssSssMsShh..',
      '..hhssNNMMMMMsShh..',
      '..hhtsMMMMMMMsShh..',
      '...hhsssmmmssShh...',
      '....hsssNGGsSSh....',
      '......ssGGGS.......',
      '........GGG........',
    ], 0, 0, face(sk, hr, { u: R.gold[6], y: R.gold[4], Y: R.gold[3], d: R.red[5], D: R.red[3], m: '#5A2018', n: '#D88A6A', M: hr[2], N: hr[3], G: hr[2] }));
    return f;
  }

  /** Ink the 1-px pockets of window ground boxed in between a king's shoulders and the window's sides, so no pale
      pixel is left trapped in ink (Lit's own King keeps his, pixel for pixel). */
  const sealPockets = (k, b, ctx) => {
    const ground = new Set([...ctx.robe.ground, ctx.robe.dot]);
    for (const x of [10, 30]) for (let y = 5; y < 50; y++) {
      if (!ground.has(b.get(x, y))) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => b.get(x + dx, y + dy) === C.edge).length >= 3) b.set(x, y, C.edge);
    }
  };
  const lit = (k, ctx) => k.courtFigure(ctx.who, ctx.suit);
  A.court(11, 'S', { figure: lit });
  A.court(12, 'S', { figure: queenSpades });
  A.court(13, 'S', { figure: lit });
  A.court(11, 'H', { figure: jackHearts });
  A.court(12, 'H', { figure: lit });
  A.court(13, 'H', { figure: kingHearts, over: sealPockets });
  A.court(11, 'C', { figure: jackClubs });
  A.court(12, 'C', { figure: queenClubs });
  A.court(13, 'C', { figure: kingClubs, over: sealPockets });
  A.court(11, 'D', { figure: jackDiamonds });
  A.court(12, 'D', { figure: queenDiamonds });
  A.court(13, 'D', { figure: kingDiamonds, over: sealPockets });
  for (const s of ['S', 'H', 'C', 'D']) for (let r = 2; r <= 14; r++) A.cardFace(r, s);
  // the colour-coded suits option: the same 52 faces with Clubs and Diamonds in their own inks ('card4:{rank}{suit}')
  for (const s of ['S', 'H', 'C', 'D']) for (let r = 2; r <= 14; r++) A.cardFace(r, s, true);
})();

(() => {
  'use strict';
  const A = globalThis.TW.Art;
  const K = A.kit;
  const { Bmp, Mask, R, C, emboss, CW, CH } = K;
  const FL = K.FLAME_KEY;
  const MONEY = '#FFCE3B', MONEY_RIM = '#D18A1D'; // cash: flat yellow, one amber rim (never a gold ramp)
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const CARD = K.cardMask();
  const edgeOf = (k, x, y) => k.get(x, y) && N4.some(([dx, dy]) => !k.get(x + dx, y + dy));
  const inCard = (x, y) => CARD.get(x, y) && !edgeOf(CARD, x, y);
  /** True when no face pixel (index, pips, Ace mark, court) is within m px: treatments keep clear of the face. */
  const clear = (face, x, y, m = 1) => { if (!face) return true; for (let dy = -m; dy <= m; dy++) for (let dx = -m; dx <= m; dx++) if (face.get(x + dx, y + dy)) return false; return true; };
  const stamp = (b, g, x, y, key, o) => { const s = new Bmp(g[0].length, g.length); s.draw(g, 0, 0, key); b.blit(s, x, y, o); return s; };
  const lum = (c) => { const [r, g, bl] = K.hexRGBA(c); return (0.299 * r + 0.587 * g + 0.114 * bl) / 255; };
  const inked = (bmp) => { const o = new Bmp(bmp.w + 2, bmp.h + 2); o.blit(bmp, 1, 1); o.outline(C.edge); return o; };

  // ================================================================ deck backs
  // The House Deck keeps Lit's back. Every other Deck gets its own colourway and medallion on the same stock and frame.
  A.back('firstissue', { draw: (k, b) => k.backMedallion(b) });

  /** A two-step pool of light on a back's field round (cx, cy): the inner colour within r, the outer 2 px beyond. */
  const pool = (b, cx, cy, r, inner, outer, sy = 0.85) => {
    for (let y = 5; y <= 49; y++) for (let x = 4; x <= 36; x++) {
      const d = Math.hypot(x - cx, (y - cy) * sy);
      if (d < r) b.set(x, y, inner); else if (d < r + 2) b.set(x, y, outer);
    }
  };

  // Firefly Deck: Lit's plum bands, a dozen lime fireflies (a 2 x 2 glow with a halo on two sides), one caught in a
  // corked jar that stands in a two-step pool of its own lime light
  A.back('speedlines', {
    bands: ['#2C1535', '#341638', '#3A163B', '#40173F', '#481840', '#511941', '#5A1A41'],
    lip: '#8C5671', lipTop: '#13070F',
    draw(k, b) {
      pool(b, 20, 27, 9.5, '#4E6A2A', '#3A4A2A');
      const fly = (x, y, i) => {
        b.set(x, y, R.lime[7]); b.set(x + 1, y, R.lime[5]); b.set(x, y + 1, R.lime[5]); b.set(x + 1, y + 1, R.lime[5]);
        // the halo on two sides, turning from fly to fly
        if (i % 2) { b.set(x - 1, y, R.lime[3]); b.set(x - 1, y + 1, R.lime[3]); b.set(x, y + 2, R.lime[3]); b.set(x + 1, y + 2, R.lime[3]); }
        else { b.set(x + 2, y, R.lime[3]); b.set(x + 2, y + 1, R.lime[3]); b.set(x, y - 1, R.lime[3]); b.set(x + 1, y - 1, R.lime[3]); }
      };
      [[7, 8], [29, 7], [11, 15], [32, 16], [6, 25], [33, 29], [8, 37], [30, 39], [12, 45], [27, 46], [20, 7], [19, 46]].forEach(([x, y], i) => fly(x, y, i));
      // the jar: a glass jar with a cork, a firefly glowing in it
      const jar = new Bmp(13, 17);
      jar.draw([
        '...wwwwwww...',
        '...WwwwwwW...',
        '....kkkkk....',
        '..kgggggggk..',
        '.kgGggggggGk.',
        'kgGgggggggggk',
        'kgGgggllggggk',
        'kgGggllLlgggk',
        'kgGgglLvLlggk',
        'kgGggllLlgggk',
        'kgGgggllggggk',
        'kgGgggggggggk',
        'kgGgggggggggk',
        '.kgGggggggGk.',
        '..kkkkkkkkk..',
      ], 0, 1, { w: R.wood[5], W: R.wood[3], k: C.edge, g: '#3E5A6E', G: '#9FD0E0', l: R.lime[5], L: R.lime[7], v: '#FFFFFF' });
      for (let y = 4; y < 15; y++) for (let x = 1; x < 12; x++) if (jar.get(x, y) === '#3E5A6E' && (x + y) % 5 === 0) jar.set(x, y, '#4E6E82');
      b.blit(inked(jar), 13, 18);
    },
  });

  // Seer's Deck: violet, a gold sun-eye, three tiny Tarot cards fanned beneath it
  A.back('sketchbook', {
    bands: R.vio.slice(0, 7), lip: R.vio[6], lipTop: '#14062E',
    draw(k, b) {
      const eye = new Bmp(17, 11);
      eye.draw([
        '..u....u....u....',
        '...u...u...u.....',
        '.u..yyyyyyy..u...',
        '..yyywwwwwyyy....',
        'uyywwwkkkwwwyyu..',
        '..yyywwwwwyyy....',
        '.u..yyyyyyy..u...',
        '...u...u...u.....',
        '..u....u....u....',
      ], 0, 1, { u: R.gold[5], y: R.gold[4], w: C.white, k: R.vio[0] });
      // centre the 15-wide eye on the card
      b.blit(eye, 13, 12);
      b.set(20, 17, R.vio[5]);
      // three tiny Tarot cards on cream stock, so they stand off the violet: an arched violet window with a gold
      // sun dot, a violet plate line, a cream lip on the lower right, inked. A stepped fan: the outer two 3 px
      // lower, overlapping 2 px, the middle one drawn last with ink between them.
      const tc = () => new Bmp(9, 12).draw([
        'kkkkkkkkk',
        'kwwwwwwwk',
        'kwwvvvwLk',
        'kwvvyvvLk',
        'kwvvvvvLk',
        'kwvvvvvLk',
        'kwvvvvvLk',
        'kwvvvvvLk',
        'kwwwwwwLk',
        'kwpppppLk',
        'kLLLLLLLk',
        'kkkkkkkkk',
      ], 0, 0, { k: C.edge, w: R.cream[7], L: R.cream[4], v: R.vio[3], y: R.gold[5], p: R.vio[2] });
      b.blit(tc(), 9, 33); b.blit(tc(), 23, 33); b.blit(tc(), 16, 30);
      k.cornerStars(b, { key: { u: R.gold[3], y: R.gold[5], v: C.white } });
    },
  });

  // Candelabra Deck: maroon, a gold five-armed candelabra, all five flames lit
  A.back('panorama', {
    bands: R.maroon.slice(0, 7), lip: R.maroon[6], lipTop: '#1C040C',
    draw(k, b) {
      const cb = new Bmp(25, 27), y4 = R.gold[4];
      const cup = (x, y) => { cb.rect(x - 1, y, 3, 1, y4); cb.rect(x, y - 3, 1, 3, R.cream[6]); };
      cup(12, 6); cup(7, 10); cup(17, 10); cup(2, 14); cup(22, 14);
      for (let y = 7; y < 23; y++) cb.set(12, y, y4);
      cb.rect(11, 12, 3, 2, y4);
      [[7, 11], [8, 12], [9, 13], [10, 14], [11, 15]].forEach(([x, y]) => { cb.set(x, y, y4); cb.set(24 - x, y, y4); });
      [[2, 15], [2, 16], [3, 17], [4, 18], [5, 19], [6, 19], [7, 20], [8, 20], [9, 20], [10, 20], [11, 20]].forEach(([x, y]) => { cb.set(x, y, y4); cb.set(24 - x, y, y4); });
      cb.rect(11, 22, 3, 1, y4); cb.rect(10, 23, 5, 1, y4); cb.rect(8, 24, 9, 1, y4); cb.rect(7, 25, 11, 1, R.gold[2]);
      for (let y = 0; y < cb.h; y++) for (let x = 0; x < cb.w; x++) if (cb.get(x, y) === y4 && (!cb.get(x - 1, y) || !cb.get(x, y - 1))) cb.set(x, y, R.gold[5]);
      for (let y = 0; y < cb.h; y++) for (let x = 0; x < cb.w; x++) if (cb.get(x, y) === y4 && !cb.get(x + 1, y + 1)) cb.set(x, y, R.gold[3]);
      [[12, 0], [7, 4], [17, 4], [2, 8], [22, 8]].forEach(([x, y]) => cb.draw(['.o.', 'oyo', '.u.'], x - 1, y, { o: FL.o, y: FL.y, u: FL.u }));
      b.blit(inked(cb), 7, 13);
      k.cornerStars(b, { at: [[6, 6], [30, 6]] });
    },
  });

  // Rags to Riches Deck: a real basket weave of burlap in two hues (ochre over umber, a pale thread every fourth
  // row), lighter round the coin sewn on in the middle, two cross-stitched patches (lime and pink), a loose thread
  A.back('bargainbin', {
    lip: '#C99068', lipTop: '#2E1A0E',
    field: (x, y) => {
      // 2 x 2 blocks of strands, alternately across (ochre, lit on top, a pale thread every fourth row) and down
      // (umber, lit on the left), so the strands pass over and under each other
      const across = (((x >> 1) + (y >> 1)) & 1) === 0;
      let c = across ? (y % 4 === 0 ? '#C99068' : y % 2 ? '#8E6238' : '#A8743E') : x % 2 ? '#6E4A2C' : '#7E5634';
      const d = Math.hypot(x - 20, (y - 27) * 0.85);
      return d < 9.5 ? K.shade(c, 1.24) : d < 11.5 ? K.shade(c, 1.12) : c;
    },
    draw(k, b) {
      // two patches of other cloth, cross-stitched on: the stitches zigzag over the patch's edge every 2 px
      const patch = (x0, y0, w, h, a, c, st) => {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.set(x0 + x, y0 + y, (x + y) % 3 === 0 ? c : a);
        for (let x = 0; x < w; x++) { b.set(x0 + x, x % 2 ? y0 - 1 : y0, st); b.set(x0 + x, x % 2 ? y0 + h : y0 + h - 1, st); }
        for (let y = 0; y < h; y++) { b.set(y % 2 ? x0 - 1 : x0, y0 + y, st); b.set(y % 2 ? x0 + w : x0 + w - 1, y0 + y, st); }
      };
      patch(7, 7, 9, 8, R.lime[4], R.lime[3], R.cream[6]);
      patch(25, 38, 9, 9, R.pink[5], R.pink[4], R.cream[6]);
      // the coin, sewn on with four stitches
      const coin = new Bmp(15, 15);
      const disc = K.roundMask(15, 15, 15);
      for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (disc.get(x, y)) coin.set(x, y, edgeOf(disc, x, y) ? MONEY_RIM : MONEY);
      const dollar = K.textBmp('$', 'S', { ramp: [MONEY_RIM], ol: null });
      coin.blit(dollar, 5, 4);
      coin.outline(C.edge);
      b.blit(coin, 13, 20);
      [[12, 27], [28, 27], [20, 19], [20, 35]].forEach(([x, y]) => { b.set(x, y, R.cream[6]); });
      // a peach thread hanging loose from the bottom patch
      [[26, 47], [25, 48], [25, 49], [26, 50]].forEach(([x, y]) => b.set(x, y, R.peach[6]));
    },
  });

  // Parlour Deck: plum wallpaper in 3-px stripes with gold sprigs, and a lozenge of warm candlelight (Lit's House
  // steps) where a round table with a lit candle and three cards reads dark on light
  A.back('studio', {
    lip: '#8C5671', lipTop: '#13070F',
    field: (x, y) => {
      const u = (x - 4) % 8, v = (y - 4 + ((Math.floor((x - 4) / 8) % 2) * 4)) % 8;
      const sprig = (v === 2 && (u === 2 || u === 4)) || (v === 3 && u >= 2 && u <= 4) || (v === 4 && u === 3);
      if (sprig) return v === 2 ? R.gold[5] : v === 3 ? R.gold[4] : R.gold[2];
      return Math.floor((x - 4) / 3) % 2 ? '#5A1A41' : '#40173F';
    },
    draw(k, b) {
      k.lozenge(b, 20, 28, { r: [13.2, 12.2, 11.2, 10.2, 8.6] });
      // the round table, seen from the side: top, rim, pedestal
      const t = new Bmp(15, 15);
      t.draw([
        '......o........',
        '.....oyo.......',
        '......u........',
        '......w........',
        '..c..cwc..c....',
        '.ccc.ccc.ccc...',
        'ttttttttttttt..',
        'TTTTTTTTTTTTT..',
        '.....TtT.......',
        '......t........',
        '......t........',
        '.....TTT.......',
        '....TTTTT......',
      ], 1, 1, { o: FL.o, y: FL.y, u: FL.u, w: R.cream[6], c: R.cream[7], t: R.wood[4], T: R.wood[2] });
      b.blit(inked(t), 13, 21);
      k.cornerStars(b, { key: { u: R.gold[2], y: R.gold[4], v: R.cream[7] } });
    },
  });

  // Gift-Wrapped Deck: cream and pink stripes, a pink ribbon tied in a bow, a gold tag hanging from the knot
  A.back('rubberstamp', {
    lip: R.pink[3], lipTop: '#5E0F38',
    field: (x, y) => (Math.floor((x - 4) / 3) % 2 ? '#FFE3F0' : '#FFF3E0'),
    draw(k, b) {
      for (let y = 5; y < 50; y++) { b.set(19, y, R.pink[6]); b.set(20, y, R.pink[5]); b.set(21, y, R.pink[3]); }
      for (let x = 5; x < 36; x++) { b.set(x, 26, R.pink[6]); b.set(x, 27, R.pink[5]); b.set(x, 28, R.pink[3]); }
      const bow = new Bmp(17, 11);
      bow.draw([
        '.ppp.......ppp...',
        'pPPpp.....ppPPp..',
        'pPqqpp...ppqqPp..',
        'pPqqqpp.ppqqqPp..',
        'pPqqqqpkpqqqqPp..',
        'pPqqqpp.ppqqqPp..',
        '.pPqpp...ppqPp...',
        '..ppp.....ppp....',
      ], 0, 1, { p: R.pink[4], P: R.pink[6], q: R.pink[5], k: R.pink[2] });
      b.blit(inked(bow), 11, 21);
      b.draw(['ppp', 'pqp', 'ppp'], 19, 26, { p: R.pink[3], q: R.pink[6] });
      // the tag on a string
      [[22, 30], [23, 31], [24, 32]].forEach(([x, y]) => b.set(x, y, R.cream[4]));
      const tag = new Bmp(7, 9);
      tag.draw(['..y..', '.yYy.', 'yyhyy', 'yyyyy', 'yyyyy', 'yyyyy', 'YYYYY'], 1, 1, { y: R.gold[4], Y: R.gold[2], h: C.edge });
      b.blit(inked(tag), 23, 32);
    },
  });

  // High Roller Deck: the standard frame on rich maroon bands, one big ivory die (front face, a lit top bevel and a
  // shaded side, five maroon pips) standing on a lozenge of warm candlelight, cream sparkles in the corners. No gold
  // rule and no token stack: nothing casino.
  A.back('mintcondition', {
    bands: ['#2A0714', '#36091A', '#43101F', '#501426', '#5E1A2C', '#6C2032', '#7A2638'], lip: R.maroon[6], lipTop: '#1C040C',
    draw(k, b) {
      k.lozenge(b, 20, 27);
      const die = new Bmp(13, 13).draw([
        '..TTTTTTTTTTT',
        '.TTTTTTTTTTTS',
        'FFFFFFFFFFFSS',
        'FFFFFFFFFFFSS',
        'FFppFFFFppFSS',
        'FFppFFFFppFSS',
        'FFFFFFFFFFFSS',
        'FFFFFppFFFFSS',
        'FFFFFppFFFFSS',
        'FFFFFFFFFFFSS',
        'FFppFFFFppFSS',
        'FFppFFFFppFS.',
        'FFFFFFFFFFF..',
      ], 0, 0, { T: R.cream[6], F: R.cream[7], S: R.cream[4], p: R.maroon[1] });
      b.blit(inked(die), 13, 20);
      k.cornerStars(b, { key: { u: R.cream[3], y: R.cream[6], v: C.white } });
    },
  });

  // Mirrorball Deck: violet, a faceted mirrorball on a chain. Its 2 x 2 facets catch the room: cream and white on
  // the upper left, lilac with pink and ember candlelight in the middle, plum on the lower right; cross glints on
  // its upper left and white, pink and pale-blue glints thrown round the card.
  A.back('halftone', {
    bands: ['#1E0B42', '#2A1058', '#36146C', '#421A80', '#4E2094', '#5A26A6', '#662EB6'], lip: R.vio[6], lipTop: '#14062E',
    draw(k, b) {
      const glint = (x, y, c) => { b.set(x, y, C.white); b.set(x - 1, y, c); b.set(x + 1, y, c); b.set(x, y - 1, c); b.set(x, y + 1, c); };
      [[8, 9, R.pink[6]], [32, 11, R.ghost[4]], [7, 22, R.ghost[4]], [34, 24, R.pink[6]], [9, 40, R.pink[6]], [31, 43, R.ghost[4]], [15, 46, C.white], [26, 7, R.pink[6]], [13, 33, R.ghost[4]], [29, 34, R.pink[6]]].forEach(([x, y, c]) => glint(x, y, c));
      for (let y = 5; y < 15; y++) b.set(20, y, y % 2 ? R.steel[2] : R.steel[4]);
      const r = 7.5, ball = new Bmp(17, 17);
      for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) {
        const dx = x - 8, dy = y - 8;
        if (dx * dx + dy * dy > r * r + 2) continue;
        const fx = (x + 1) >> 1, fy = (y + 1) >> 1, ex = fx * 2 - 8.5, ey = fy * 2 - 8.5; // the facet and its centre
        const lit = (-ex * 0.6 - ey * 0.8) / r, h = (fx * 7 + fy * 13) % 5;
        let c = lit > 0.42 ? ((fx + fy) % 2 ? C.white : R.cream[7]) : lit < -0.38 ? ((fx + fy) % 2 ? '#5A1A41' : '#2C1535') : h === 0 ? R.pink[6] : h === 2 ? R.ember[6] : '#BAC0E6';
        if (x % 2 === 0 && y % 2 === 0 && lit <= 0.42) c = K.shade(c, 0.82); // the seams between facets
        ball.set(x, y, c);
      }
      ball.outline(C.edge);
      b.blit(ball, 12, 15);
      // three cross glints on its upper left
      [[16, 19, 1], [12, 15, 0], [19, 16, 0]].forEach(([x, y, big]) => { b.set(x, y, C.white); b.set(x - 1, y, R.cream[6]); b.set(x + 1, y, R.cream[6]); b.set(x, y - 1, R.cream[6]); b.set(x, y + 1, R.cream[6]); if (big) { b.set(x - 2, y, R.ghost[5]); b.set(x + 2, y, R.ghost[5]); } });
    },
  });

  // Spooky Deck: hue-shifted night bands inside a wavering ghost-blue border, and our own Wickwisp: a short guttering
  // candle in a brass chamberstick whose flame is an acid-green wisp with two ink eyes, leaning right, its smoke
  // curling up in a stepped spiral, a two-step pool of acid light behind it
  A.back('spooky', {
    bands: ['#10143A', '#141742', '#1A194C', '#241C5A', '#2C1F64', '#33216A', '#3A2470'], lip: R.ghost[3], lipTop: '#06081A',
    draw(k, b) {
      pool(b, 21, 22, 4, '#2C4E2E', '#1F3A2A', 1.1);
      for (let x = 6; x <= 34; x++) { b.set(x, 7 + ((x >> 1) % 2), R.ghost[4]); b.set(x, 47 - ((x >> 1) % 2), R.ghost[4]); }
      for (let y = 7; y <= 47; y++) { b.set(6 + ((y >> 1) % 2), y, R.ghost[4]); b.set(34 - ((y >> 1) % 2), y, R.ghost[4]); }
      // the smoke: a 1-px curl stepping up from the flame's tip in three turns, stopping short of the border
      [[23, 16], [24, 15], [24, 14], [23, 13], [22, 12], [22, 11], [23, 10], [24, 10], [25, 11]].forEach(([x, y]) => b.set(x, y, R.ghost[4]));
      // the candle (lit on its left, two drips down its right) in its chamberstick (a dish and a ring handle)
      const cs = new Bmp(13, 13).draw([
        '..aWaWa......',
        '..abbcd......',
        '..abbcdd.....',
        '..abbcdd.....',
        '..abbcd......',
        '..abbcdd.....',
        '..abbcdd.....',
        '..abbcd......',
        '..abbcd..rr..',
        'LLLLLLLLLr.r.',
        'LHHHHHHHHrr..',
        '.DDDDDDD.....',
      ], 0, 0, { a: R.cream[7], W: R.cream[5], b: R.cream[6], c: R.cream[5], d: R.cream[4], L: R.brass[5], H: R.brass[4], D: R.brass[2], r: R.brass[4] });
      b.blit(inked(cs), 15, 25);
      // the wisp: an acid-green flame leaning right, with a pale core and two ink eyes, on its wick
      const wisp = new Bmp(5, 8).draw(['....A', '...aA', '..aAA', '.aAAA', 'akAkA', 'aAvvA', '.aAA.', '..k..'], 0, 0, { a: R.acid[3], A: R.acid[5], v: R.acid[6], k: C.edge });
      b.blit(inked(wisp), 18, 17);
    },
  });

  // ================================================================ Enhancements (each changes the stock or adds a treatment)
  const mini = (o) => K.miniCard(o);
  /** A stock that is the same on every card is drawn once and handed out as a copy. */
  const once = (make) => { let b = null; return (k) => (b || (b = make(k))).clone(); };
  const MINI = K.miniMask();
  const miniIn = (x, y) => MINI.get(x, y) && !edgeOf(MINI, x, y);

  // ---- Waxed (inked): thick blue wax poured over the top edge of the plain cream stock, running down in drips of
  // uneven length, each ending in a round bead; a pale blue shadow beside the wax. Drips stop short of the face.
  // the bead at a drip's foot, 4 x 3 round under the 2-px run (x from one px left of the run): a glint top left
  const BEAD = ['.gb.', 'bbbd', '.dd.'];
  const BEAD_KEY = { g: C.white, b: R.chips[6], d: R.chips[4] };
  function pourWax(b, inside, face, drips, band = 3) {
    const free = (x, y) => inside(x, y) && clear(face, x, y, 0);
    const wax = new Set(), put = (x, y, c) => { if (free(x, y)) { b.set(x, y, c); wax.add(y * b.w + x); } };
    // the band: the top row lighter, a highlight along its upper left, two rows below it
    for (let y = 1; y <= band; y++) for (let x = 0; x < b.w; x++) put(x, y, y > 1 ? R.chips[6] : x < b.w * 0.4 ? R.chips[8] : R.chips[7]);
    for (const [x0, len] of drips) {
      // the longest run up to len, two px wide, that leaves room for its bead clear of the face
      const fits = (n) => {
        for (let y = band + 1; y <= band + n; y++) if (!free(x0, y) || !free(x0 + 1, y)) return false;
        return BEAD.every((row, j) => [...row].every((ch, i) => ch === '.' || free(x0 - 1 + i, band + n + 1 + j)));
      };
      let n = len;
      while (n >= 0 && !fits(n)) n--;
      if (n < 0) continue;
      for (let y = band + 1; y <= band + n; y++) { put(x0, y, R.chips[7]); put(x0 + 1, y, R.chips[6]); }
      BEAD.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') put(x0 - 1 + i, band + n + 1 + j, BEAD_KEY[ch]); }));
    }
    // the shadow on the stock: to the right of the wax and under the band
    for (let y = 1; y < b.h; y++) for (let x = 1; x < b.w; x++) {
      if (wax.has(y * b.w + x) || !free(x, y)) continue;
      if (wax.has(y * b.w + x - 1) || (y === band + 1 && wax.has((y - 1) * b.w + x))) b.set(x, y, '#C2CCFF');
    }
  }
  A.enhancement('inked', {
    w: 11, h: 15,
    badge(k) { const m = mini(); pourWax(m, miniIn, null, [[5, 5]], 2); return m; },
    over: (k, b, ctx) => pourWax(b, inCard, ctx.face, [[8, 7], [13, 3], [19, 5], [25, 4], [34, 9]], 3),
  });

  // ---- Kindled (punchy): the fire is the thing you see. Lit's flame stands in the free lower-left corner on a
  // scorched patch, the bottom edge is singed with three sparks above it, and each pip catches the firelight in
  // one crisp ember line on its lower-left side (the side facing the flame). Plain cream stock, no halos.
  const KINDLE = ['..r..', '..o..', '.oao.', 'oayao', 'oyuyo', 'oauao', '.ooo.', '..k..'];
  const CHAR = { c: R.ember[1], C: R.wood[1], e: R.ember[2] };
  const indexZone = (x, y) => (x <= 8 && y <= 18) || (x >= 32 && y >= 36);
  function kindle(b, face, rank) {
    const free = (x, y) => inCard(x, y) && clear(face, x, y, 0);
    const put = (g, x0, y0, key) => g.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.' && free(x0 + i, y0 + j)) b.set(x0 + i, y0 + j, key[ch]); }));
    // the scorched patch under the flame, ragged, 4 px either side of its wick, and the singe running on along the
    // bottom edge to x 16
    put(['.cC.C.Cc.', 'cCcCcCcCc', '.c.CCc.c.'], 1, 50, CHAR);
    put(['e.ee..e', 'CeCeeCe'], 10, 51, { ...CHAR });
    b.draw(K.flameFrames()[0], 2, 41, FL);
    // three sparks rising off the singe, where they are clear of the pips
    let n = 0;
    for (const [x, y] of [[11, 48], [14, 47], [16, 49], [12, 46], [15, 45], [18, 48]]) if (n < 3 && free(x, y) && clear(face, x, y, 1)) { b.set(x, y, R.ember[6]); n++; }
    // firelight: one ember line on the lower-left side of each pip of a number card
    if (rank >= 2 && rank <= 10) for (const [col, py] of K.PIPS[rank]) {
      const px = K.COLX[col];
      for (let y = py + 3; y <= py + 7; y++) for (let x = px - 1; x <= px + 2; x++) {
        if (!free(x, y) || indexZone(x, y)) continue;
        if (face.get(x + 1, y) || face.get(x, y - 1)) b.set(x, y, R.ember[6]);
      }
    }
  }
  A.enhancement('punchy', {
    w: 11, h: 15,
    badge(k) {
      const m = mini();
      [['.cC.Cc.', 2, 11], ['c.C.c', 3, 12]].forEach(([row, x0, y]) => [...row].forEach((ch, i) => { if (ch !== '.' && miniIn(x0 + i, y)) m.set(x0 + i, y, CHAR[ch]); }));
      m.draw(KINDLE, 3, 3, FL);
      return m;
    },
    over: (k, b, ctx) => kindle(b, ctx.face, ctx.rank),
  });

  // ---- Gilt-Edged (dimestore): gilded the way a book is, on plain cream stock: a gold cap on each corner (its
  // outer pixels lit on the top and left, shaded on the bottom and right, a darker body, an ink line inside) and
  // a gilt fore-edge down the right side in stacked page lines. Gold here is a binding, never money.
  function gilt(b, k, face, o) {
    const { w, h } = b, d = new Int16Array(w * h).fill(-1), q = [];
    // each pixel's distance from the card's ink edge (1 = touching it), stepping round the corners
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (k.get(x, y) && edgeOf(k, x, y)) { d[y * w + x] = 0; q.push(x, y); }
    for (let i = 0; i < q.length; i += 2) {
      const x = q[i], y = q[i + 1];
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (k.get(nx, ny) && d[ny * w + nx] < 0) { d[ny * w + nx] = d[y * w + x] + 1; q.push(nx, ny); } }
    }
    const free = (x, y) => clear(face, x, y, 0);
    const near = (x, y, dx, dy) => d[(y + dy) * w + x + dx] === 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = d[y * w + x];
      if (v < 1 || v > o.depth || !free(x, y)) continue;
      const cx = x <= o.arm ? 0 : x >= w - 1 - o.arm ? 1 : -1, cy = y <= o.arm ? 0 : y >= h - 1 - o.arm ? 1 : -1;
      if (cx < 0 || cy < 0) continue; // only the four corners
      if (v === o.depth) { b.set(x, y, C.edge); continue; }
      if (v > 1) { b.set(x, y, R.gold[3]); continue; }
      b.set(x, y, near(x, y, 0, -1) || near(x, y, -1, 0) ? R.gold[5] : R.gold[2]);
    }
    // the fore-edge: page lines of light and dark gold down the right side
    const [fx0, fx1, fy0, fy1] = o.fore;
    for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) if (free(x, y)) b.set(x, y, y % 2 ? R.gold[2] : R.gold[4]);
    return b;
  }
  A.enhancement('dimestore', {
    w: 11, h: 15,
    badge: (k) => gilt(mini(), MINI, null, { arm: 3, depth: 2, fore: [8, 8, 4, 10] }),
    over: (k, b, ctx) => gilt(b, CARD, ctx.face, { arm: 8, depth: 3, fore: [37, 38, 9, 45] }),
  });

  // ---- Sequined (popout): pink and gold sequins scattered over the stock, clear of the pips
  const SEQ = (() => { const r = K.rng('sequins'), out = []; for (let row = 0; row < 10; row++) for (let x = 3 + (row % 2) * 3, y = 4 + row * 5; x < 37; x += 6) out.push([x + Math.floor(r() * 3) - 1, y + Math.floor(r() * 3) - 1]); return out; })();
  const SEQ_KEYS = [{ v: C.white, p: R.pink[6], P: R.pink[4] }, { v: C.white, p: R.gold[5], P: R.gold[3] }];
  A.enhancement('popout', {
    w: 11, h: 15,
    badge(k) { const m = mini(); [[2, 3, 0], [6, 2, 1], [4, 7, 1], [7, 10, 0], [2, 11, 0]].forEach(([x, y, c]) => m.draw(['vp', 'pP'], x, y, SEQ_KEYS[c])); return m; },
    over(k, b, ctx) {
      let n = 0;
      SEQ.forEach(([x, y]) => {
        if (![[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dy]) => inCard(x + dx, y + dy) && clear(ctx.face, x + dx, y + dy, 1))) return;
        if (indexZone(x, y) || indexZone(x + 1, y + 1)) return;
        b.draw(['vp', 'pP'], x, y, SEQ_KEYS[n++ % 2]);
      });
    },
  });

  // ---- Masked (scribbled): a warm lilac stock (not Phantom's ghost blue) and a carnival mask held on a stick in the
  // free left margin: violet, lit on its upper left, a gold rim and upswept corners, almond eye-holes showing the
  // stock, a pink plume from its right temple and a wooden stick, all inked. Held, not worn: no commedia half-mask.
  const LILAC = { face: '#F3E4FA', hi: '#FBF6FF', shade: '#E2C6EE', lip: '#C79BDB' };
  const MASK_KEY = { y: R.gold[4], Y: R.gold[2], v: R.vio[4], V: R.vio[6], w: R.vio[3], o: LILAC.face, p: R.pink[6], q: R.pink[5], r: R.pink[4], s: R.wood[3] };
  const MASK_BIG = ['......pq', '.....pqr', '.....pqr', '......qr', 'y......Y', 'yVVvvvvY', 'Voovvoow', 'vvovvoww', '.vvvvww.', '.s......', '.s......', 's.......', 's.......', 's.......'];
  const MASK_SMALL = ['.....pq', '.....qr', 'y.....Y', 'yVvvvvY', 'Voovoow', '.vvvvw.', '.s.....', 's......', 's......'];
  /** The mask on its stick, inked, stamped with its top-left art pixel at (x0, y0), clear of the face. */
  const maskOn = (b, g, x0, y0, face) => {
    const m = new Bmp(g[0].length, g.length).draw(g, 0, 0, MASK_KEY);
    b.blit(inked(m), x0 - 1, y0 - 1, { clip: (x, y) => clear(face, x, y, 0) });
  };
  A.enhancement('scribbled', {
    w: 11, h: 15,
    badge(k) { const m = mini(LILAC); maskOn(m, MASK_SMALL, 2, 3, null); return m; },
    stock: once((k) => k.cardShape(LILAC)),
    over(k, b, ctx) { maskOn(b, MASK_BIG, 1, 36, ctx.face); },
  });

  // ---- Spotlit (spotlit): a cone of warm light from above; outside it the stock sinks toward plum in the corners
  const SPOT = ['#FFFCF5', '#FFF3E0', '#FBE7CB', '#F2D3AE', '#DDB08A', '#B98272', '#8C5671'];
  function spotlight(b, inside, w, h, o = {}) {
    const cx = (w - 1) / 2, top = o.top ?? -3, spread = o.spread ?? 0.34, half0 = o.half ?? 4;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const half = half0 + (y - top) * spread, d = Math.abs(x - cx) - half;
      let i = d <= 0 ? 0 : d < 2 ? 2 : d < 5 ? 3 : 4;
      const corner = Math.min(Math.hypot(x, h - 1 - y), Math.hypot(w - 1 - x, y), Math.hypot(w - 1 - x, h - 1 - y));
      if (corner < (o.corner ?? 9)) i = Math.max(i, corner < (o.corner ?? 9) * 0.55 ? 6 : 5);
      if (o.clamp && o.clamp(x, y)) i = Math.min(i, 3);
      if (d <= 0 && y < (o.hot ?? 6)) i = 0;
      b.set(x, y, SPOT[i]);
    }
    return b;
  }
  A.enhancement('spotlit', {
    w: 11, h: 15,
    badge(k) { const m = spotlight(mini(), miniIn, 11, 15, { top: -2, spread: 0.3, half: 1.5, corner: 4, hot: 3 }); m.blit(k.pipBmp('H', 5), 3, 7); return m; },
    stock: once((k) => spotlight(k.cardShape(), inCard, CW, CH, { clamp: indexZone })),
  });

  // ---- Vintage (vintage): aged to soft peach, browned two px deep along the top and right edges, foxed with 8 to 10
  // blotches (a dark core in a paler rim), the lower-left corner dog-eared
  const AGED = { face: '#F6DDBE', hi: '#FCEBD2', shade: '#E8C29C', lip: '#D19C76' };
  const BROWNED = '#E8C29C';
  const FOX_SHAPES = [['cr', 'rr'], ['rcr', 'rr.'], ['rc', 'rr'], ['.rc', 'rcr']];
  const FOX = (() => { const r = K.rng('foxing'), out = []; for (let i = 0; i < 40; i++) out.push([2 + Math.floor(r() * 35), 3 + Math.floor(r() * 44), Math.floor(r() * 4)]); return out; })();
  /** Brown the aged stock b along the top and right, inside the ink (the face covers it where it lies). */
  function browned(b, inside) {
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (inside(x, y) && (y <= 2 || x >= b.w - 3)) b.set(x, y, BROWNED);
    return b;
  }
  /** Up to n foxing blotches from the seeded list, each wholly clear of the face and of the dog-ear. */
  function foxing(b, face, list, n, skip) {
    let drawn = 0;
    for (const [x0, y0, s] of list) {
      if (drawn >= n) break;
      const g = FOX_SHAPES[s];
      const cells = [];
      g.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') cells.push([x0 + i, y0 + j, ch]); }));
      if (!cells.every(([x, y]) => inCard(x, y) && clear(face, x, y, 1) && !(skip && skip(x, y)))) continue;
      cells.forEach(([x, y, ch]) => b.set(x, y, ch === 'c' ? '#C98858' : '#DDB08A'));
      drawn++;
    }
  }
  function dogEar(b, d, x0, y1) {
    // the corner folded over at the lower left: the cut, the fold line, the flap and its shadow
    for (let y = y1 - d; y <= y1; y++) for (let x = x0; x <= x0 + d; x++) {
      const s = (x - x0) + (y1 - y);
      if (s < d) b.del(x, y);
      else if (s === d) b.set(x, y, C.edge);
    }
    for (let y = y1 - d; y <= y1; y++) for (let x = x0; x <= x0 + d; x++) {
      const s = (x - x0) + (y1 - y);
      if (s <= d || s > 2 * d) continue;
      const leg = x === x0 + d || y === y1 - d;
      b.set(x, y, leg ? C.edge : (y - (y1 - d)) < (x0 + d - x) ? '#E2B790' : '#D3A47E');
    }
    for (let y = y1 - d + 1; y <= y1 - 1; y++) if (b.get(x0 + d + 1, y)) b.set(x0 + d + 1, y, '#C99572');
    for (let x = x0 + 1; x <= x0 + d; x++) if (b.get(x, y1 - d - 1) && b.get(x, y1 - d - 1) !== C.edge) b.set(x, y1 - d - 1, '#E8C29C');
  }
  A.enhancement('vintage', {
    w: 11, h: 15,
    badge(k) {
      const m = browned(mini(AGED), miniIn);
      [[3, 4, 0], [6, 8, 2]].forEach(([x, y, s]) => FOX_SHAPES[s].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') m.set(x + i, y + j, ch === 'c' ? '#C98858' : '#DDB08A'); })));
      dogEar(m, 4, 0, 14);
      return m;
    },
    stock: once((k) => browned(k.cardShape(AGED), inCard)),
    over(k, b, ctx) {
      foxing(b, ctx.face, FOX, 10, (x, y) => x <= 9 && y >= 45);
      dogEar(b, 7, 0, 54);
    },
  });

  // ---- Crumpled (crumpled): crushed and smoothed out again. Five creases radiate from one point by the coin in the
  // lower-left corner, each a dark valley with a pale ridge on its upper-left side, and the facets between them are
  // shaded as planes (facing the upper left, flat, facing the lower right), alternating across each crease.
  const CRUMPLE = { at: [9, 44], to: [[0, 20], [14, 0], [32, 0], [40, 22], [40, 47]] };
  const PLANES = ['#FBE7CB', '#FFF8EC', '#E8C29C', '#FFF8EC', '#E8C29C', '#FBE7CB']; // by sector round the point
  function crumple(b, inside, P, ends) {
    const ang = (x, y) => Math.atan2(y - P[1], x - P[0]);
    const cut = ends.map(([x, y]) => ang(x, y)).sort((a, c) => a - c);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      if (!inside(x, y) || b.get(x, y) !== C.cream) continue;
      const a = ang(x, y);
      b.set(x, y, PLANES[cut.filter((c) => c < a).length]);
    }
    for (const [ex, ey] of ends) {
      const t = new Bmp(b.w, b.h).line(P[0], P[1], ex, ey, '#C99572');
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
        if (!t.get(x, y) || !inside(x, y)) continue;
        b.set(x, y, '#C99572');
        if (inside(x - 1, y - 1) && !t.get(x - 1, y - 1) && !t.get(x - 1, y) && !t.get(x, y - 1)) b.set(x - 1, y - 1, '#FFFCF5');
      }
    }
    return b;
  }
  const DOLLAR = K.textBmp('$', 'S', 'money');
  A.enhancement('crumpled', {
    w: 11, h: 15,
    badge(k) { const m = crumple(mini(), miniIn, [2, 12], [[0, 4], [5, 0], [10, 3], [10, 12]]); m.blit(K.textBmp('$', 'S', 'money'), 2, 4); return m; },
    stock: once((k) => crumple(k.cardShape(), inCard, CRUMPLE.at, CRUMPLE.to)),
    over(k, b) { b.blit(DOLLAR, 2, 43); },
  });

  // ================================================================ Seals: distinct shapes at the Seal spot over the top edge
  // Encore: Lit's pink swallowtail ribbon
  A.seal('encore', { w: 9, h: 17, badge: (k) => k.encoreRibbon() });

  // Paid: a cream paper price tag hanging over the top edge on a red string looped through its punch hole, a '$' in
  // the Ember digit face printed on it in the money amber (a filled, rimmed digit would read as a coin at this size).
  // Paper, not a disc.
  A.seal('paid', {
    w: 9, h: 17,
    badge(k) {
      const b = new Bmp(9, 17);
      // the tag: top corners clipped, lit cream, shaded on its right and bottom
      for (let y = 5; y <= 15; y++) for (let x = 1; x <= 7; x++) if (!(y === 5 && (x === 1 || x === 7))) b.set(x, y, x === 7 || y === 15 ? R.cream[4] : R.cream[6]);
      b.blit(K.textBmp('$', 'S', { ramp: [MONEY_RIM], ol: null }), 2, 8);
      b.outline(C.edge);
      b.set(4, 6, C.edge); // the punch hole
      // the string: through the hole, up over the card's edge in a loop (lit on its left), a row below the badge's top
      // so it gets an ink edge of its own: above the card's edge (and in a fanned hand that is all of it that shows)
      // it reads as a dark-ringed red loop on any band of the table
      [[4, 5, 4], [3, 4, 4], [5, 4, 3], [2, 3, 5], [6, 3, 3], [2, 2, 5], [6, 2, 3], [3, 1, 5], [4, 1, 4], [5, 1, 4]].forEach(([x, y, i]) => b.set(x, y, R.mult[i]));
      const STRING = new Set(R.mult);
      for (let y = 0; y <= 5; y++) for (let x = 0; x < 9; x++) if (!b.get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => STRING.has(b.get(x + dx, y + dy)))) b.set(x, y, C.edge);
      return b;
    },
  });

  // Comet (airmail): a night-navy pennant over the edge, notched at its tip so it reads as a flag, an ember comet
  // streaking down it (a 2 x 2 head with a pale core, a cream tail trailing up to the right)
  A.seal('airmail', {
    w: 9, h: 16,
    badge(k) {
      const m = Mask.rows(['XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '.XXXXX.', '.XXXXX.', '.XXXXX.', '..XXX..', '..XXX..', '..XXX..', '..X.X..', '..X.X..']);
      const b = new Bmp(9, 16);
      b.blit(emboss(m, R.night, { cap: 2.2, base: 4, gain: 3.6 }), 1, 1);
      for (let x = 1; x < 8; x++) b.set(x, 3, R.night[1]);
      b.draw(['.....w', '....wW', '...wW.', '.cu...', '.ec...'], 1, 5, { w: R.cream[6], W: R.cream[4], c: R.ember[6], u: '#FFF2B0', e: R.ember[5] });
      b.outline(C.edge);
      return b;
    },
  });

  // Cameo: an oval brooch pinned at the top edge in a pearl rim: a bright cream left-facing profile (brow, nose tip,
  // lip notch, chin, a neck curving into the shoulder, a bun at the back) carved on a dark maroon shell ground. No
  // gold: a gold rim round a warm ground read as a coin stamped '1' at the phone scale.
  A.seal('cameo', {
    w: 9, h: 15,
    badge(k) {
      const b = new Bmp(9, 15);
      b.draw([
        '..uyy..',
        '.uLLLY.',
        'uLLccGY',
        'yLcccbY',
        'ycccsBY',
        'yLccsGY',
        'ycccsGY',
        'yLccGDY',
        'yGccGDY',
        'yGGcsDY',
        'yGcccsY',
        '.yDDDY.',
        '..YYY..',
      ], 1, 1, { u: R.cream[7], y: R.cream[5], Y: R.cream[3], L: R.maroon[5], G: R.maroon[4], D: R.maroon[3], c: R.cream[7], s: R.cream[4], b: R.cream[5], B: R.cream[3] });
      b.outline(C.edge);
      return b;
    },
  });

  // ================================================================ Editions: pixel treatments baked into the composed card
  // Glitch (fourcolor): Lit's 1-px red and blue fringe, baked inside the card's silhouette
  A.edition('fourcolor', {
    w: 13, h: 15,
    badge(k) {
      const m = k.miniCard();
      m.blit(k.pipBmp('H', 5), 3, 5);
      const fr = k.glitchFringe(m, { mask: k.miniMask(), regions: [[0, 0, m.w - 1, m.h - 1]] });
      const b = new Bmp(m.w + 2, m.h);
      b.blit(m, 1, 0);
      // over the card the plate blends in; beside it, where nothing is under it, the plate is opaque (no
      // half-transparent pixels in a sprite)
      for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) { const c = fr.get(x, y); if (c) b.mix(x, y, b.get(x, y) ? c : c.slice(0, 7)); }
      return b;
    },
    // the face layer decides which corner pixels get the fringe, so a darker stock is never fringed itself; the card's
    // own silhouette (b.mask(): a Vintage dog-ear is cut away) decides where it may land, so nothing floats in a cut
    apply: (k, b, ctx) => k.bakeFringe(b, { face: ctx.face, mask: b.mask() }),
  });

  // Sheen (gloss): candlelight on varnish: a warm glare band across the top-left corner (x + y = 7 to 11,
  // its edges peach, its core warm white), a thin second line at x + y = 14 and a glossy L along the lit top and left
  // edges (white, then ember), laid on the stock only, so the index, pips and court stay clear under it. The middle
  // of the card stays clean; the UI's sweep does the rest.
  function sheen(b, inside, face, s0, w, s1) {
    const o = b.clone();
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      if (!inside(x, y) || !o.get(x, y) || (face && face.get(x, y))) continue;
      const s = x + y;
      // opaque enough to tell from a plain card in a still frame (reduced motion keeps only this)
      if (s >= s0 && s < s0 + w) o.mix(x, y, s === s0 || s === s0 + w - 1 ? '#FFC890' : '#FFFFFF');
      else if (s === s1) o.mix(x, y, '#FFD9B0');
    }
    // a glossy L along the lit top and left edges, on bare stock only (never over an index, wax, gilt, an emblem or
    // the Seal spot): the pixel inside the ink white, the one inside that warm, so a still frame (and reduced motion)
    // tells Sheen from a plain card at the phone scale
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      if (!inside(x, y) || !SHEEN_BARE.has(o.get(x, y)) || (face && face.get(x, y))) continue;
      const top = !inside(x, y - 1) || !inside(x, y - 2), left = !inside(x - 1, y) || !inside(x - 2, y), rim1 = !inside(x, y - 1) || !inside(x - 1, y);
      if ((top && x <= Math.floor(b.w * 0.68)) || (left && y <= Math.floor(b.h * 0.6))) o.set(x, y, rim1 ? C.white : R.ember[6]);
    }
    return o;
  }
  /** The stocks the glossy L may lie on: plain cream, Masked's lilac, Vintage's aged peach, Spotlit's falloff and
      Crumpled's planes. */
  const SHEEN_BARE = new Set([C.white, C.cream, C.cream1, C.cream2, C.cream3, ...Object.values(LILAC), ...Object.values(AGED), BROWNED, ...SPOT, ...PLANES]);
  A.edition('gloss', {
    w: 11, h: 15,
    badge: (k) => { const m = k.miniCard(), f = new Bmp(11, 15); f.blit(k.pipBmp('S', 5), 3, 5); const o = sheen(m, miniIn, f, 4, 3, 8); o.blit(f, 0, 0); return o; },
    apply: (k, b, ctx) => sheen(b, inCard, ctx.face, 7, 5, 14),
  });

  // Dither (benday): an ordered dither of Mult red and pink, dense at the edge and thinning inward in two clean
  // steps (no sparse third step, which left lone pixels), kept clear of the face
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function dither(b, inside, face, w, h, reach) {
    const o = b.clone();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y) || (face && !clear(face, x, y, 1))) continue;
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      const density = d <= reach * 0.5 ? 0.56 : d <= reach ? 0.4 : 0;
      if ((BAYER[y % 4][x % 4] + 0.5) / 16 < density) o.set(x, y, ((x >> 1) + (y >> 1)) % 2 ? R.pink[6] : R.mult[6]);
    }
    return o;
  }
  A.edition('benday', {
    w: 11, h: 15,
    badge: (k) => { const m = k.miniCard(); const f = new Bmp(11, 15); f.blit(k.pipBmp('D', 5), 3, 5); const o = dither(m, miniIn, f, 11, 15, 4); o.blit(f, 0, 0); return o; },
    apply: (k, b, ctx) => dither(b, inCard, ctx.face, CW, CH, 6),
  });

  // Phantom (inverted): the card turns to a pale ghost, never darker than the table. The stock
  // is an opaque pale ghost-blue, lit from the upper left, with the ink edge kept and a wavering ghost-blue line one
  // px inside it; every face pixel is re-inked in mid tones by its lightness (blue for Spades and Clubs, ghost pink
  // for Hearts and Diamonds; never lighter than the stock, so each pip keeps its upper-left highlight and courts
  // stay readable; with colour-coded suits a Club's or Diamond's marks keep their own green or blue); an
  // Enhancement's marks turn ghost blue the same way; stepped mist curls up from the bottom. The see-through feel is
  // the UI's flicker (ed-inverted), not baked alpha.
  const PHANTOM = { face: '#EAF4FF', hi: '#FFFFFF', shade: '#C8DCF0', lip: '#9AB0D6' };
  // the ghost inks, by lightness: [dark, mid, light]. The pink is a step darker than it was, so a red index keeps 3:1
  // to 4.6:1 on the pale stock, like the blue one
  const GHOST_INK = { dark: [R.ghost[2], R.ghost[3], '#A6C4E6'], red: ['#A8507E', '#C27098', '#E8A8C8'] };
  // colour-coded suits: Clubs' and Diamonds' marks in their own families (lime, chips), in the same three steps. The
  // Diamonds' blue is a vivid two-tone beside the Spades' flat ghost blue (same hue); a deeper blue measured closer to
  // it under protanopia and deuteranopia (CIEDE2000), so keep it this light
  const GHOST_INK4 = { C: [R.lime[2], R.lime[3], R.lime[6]], D: [R.chips[5], R.chips[6], R.chips[7]] };
  const MIST = '#DCEBFA';
  function phantom(b, face, k, inside, suit, o = {}) {
    const w = b.w, h = b.h, out = K.cardShape({ ...PHANTOM, mask: k });
    const ink = GHOST_INK[suit === 'H' || suit === 'D' ? 'red' : 'dark'];
    // colour-coded suits: the marks drawn in a Club's or Diamond's own ink (index, pips, court motifs) take that ink's
    // ghost tones; the rest of the face keeps the two-colour family's, so a court stays a dusty ghost
    const ink4 = (o.fourColor && GHOST_INK4[suit]) || null, marks = ink4 ? new Set(K.SUIT_INK4[suit]) : null;
    const tone = (ramp, c) => { const L = lum(c); return ramp[L < 0.4 ? 0 : L < 0.7 ? 1 : 2]; };
    const plain = K.cardShape({ mask: k }); // where b still shows bare cream stock, the ghost stock shows
    const stockish = (c, x, y) => c === plain.get(x, y) || lum(c) > 0.8;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const c = b.get(x, y);
      if (!c) continue;
      const fc = face && face.get(x, y);
      if (fc) out.set(x, y, tone(marks && marks.has(fc) ? ink4 : ink, fc));
      else if (!stockish(c, x, y)) out.set(x, y, tone(GHOST_INK.dark, c));
    }
    const STOCK = new Set([PHANTOM.face, PHANTOM.hi, PHANTOM.shade, PHANTOM.lip]);
    const bare = (x, y) => inside(x, y) && !(face && face.get(x, y)) && STOCK.has(out.get(x, y));
    // the wavering line one px inside the ink edge, all the way round
    const m = o.margin ?? 2;
    for (let x = m + 2; x < w - m - 2; x++) for (const y of [m + ((x >> 1) % 2), h - 1 - m - ((x >> 1) % 2)]) if (bare(x, y)) out.set(x, y, R.ghost[4]);
    for (let y = m + 2; y < h - m - 2; y++) for (const x of [m + ((y >> 1) % 2), w - 1 - m - ((y >> 1) % 2)]) if (bare(x, y)) out.set(x, y, R.ghost[4]);
    // mist curling up from the bottom margin in steps
    if (o.mist) for (let x = 0; x < w; x++) { const top = h - 3 - [0, 1, 2, 2, 1, 0, 0, 1][(x >> 1) % 8]; for (let y = top; y < h - 2; y++) if (bare(x, y)) out.set(x, y, MIST); }
    return out;
  }
  A.edition('inverted', {
    w: 11, h: 15,
    badge: (k) => { const m = k.miniCard(), f = new Bmp(11, 15); f.blit(k.pipBmp('C', 5), 3, 5); m.blit(f, 0, 0); return phantom(m, f, MINI, miniIn, 'C', { margin: 1 }); },
    apply: (k, b, ctx) => phantom(b, ctx.face, CARD, inCard, ctx.suit, { mist: true, fourColor: ctx.fourColor }),
  });

  // ================================================================ Stakes: from twilight to the last candle
  A.stake('sunny', {
    rim: R.peach, ground: ['#3E1880', '#5320A0', '#761F3C', '#AE402C', '#E8611F'],
    draw: (k) => new Bmp(9, 9).draw(['.y.', 'yvy', '.y.'], 1, 1, { y: R.gold[4], v: R.gold[6] }),
  });
  A.stake('uhoh', {
    rim: R.pink, ground: ['#2A1423', '#341A2C', '#3C2132'],
    draw: (k) => new Bmp(9, 9).draw(['.....cc..', '......cc.', '.......cc', '.......cc', '......cc.', '.....cc..', '.........'], 0, 1, { c: R.cream[6] }).set(2, 2, R.cream[7]).set(3, 6, R.cream[5]).set(1, 4, R.cream[4]),
  });
  // Moonless: no moon, but readable: three small plus-shaped stars over a dark plum horizon with a hill line
  A.stake('gulp', {
    rim: R.vio, ground: ['#120810', '#0E060C', '#0A0408'],
    draw: (k) => {
      const b = new Bmp(9, 9);
      for (let x = 0; x < 9; x++) { b.set(x, 7, '#2C1535'); b.set(x, 8, '#2C1535'); }
      [[0, 7], [1, 6], [2, 6], [3, 6], [4, 7], [5, 7], [6, 6], [7, 6], [8, 7]].forEach(([x, y]) => b.set(x, y, '#40173F'));
      // a step brighter than the review's plum[5] / plum[3], which still vanished at the phone scale
      [[2, 2], [6, 1], [5, 4]].forEach(([x, y]) => b.draw(['.a.', 'aca', '.a.'], x - 1, y - 1, { a: R.plum[5], c: R.plum[7] }));
      return b;
    },
  });
  A.stake('yikes', {
    rim: R.acid, ground: ['#0A0408', '#080306'],
    draw: (k) => new Bmp(9, 9).draw(['...r.', '..oa.', '..ay.', '...k.', '..ww.', '..wW.'], 2, 2, { ...FL, w: R.cream[6], W: R.cream[4] }),
  });
})();
