// The art module (TW.Art, src/art/*.js), against ARCH section 4 and src/art/ART.md:
// - it loads with no DOM; every registered sprite renders at its declared size, is not empty and is deterministic;
//   ids are unique; playing cards compose with every registered Enhancement, Seal and Edition, and each changes the
//   card; colour-coded suits have their own id form ('card4:'), and the two-colour ids are unchanged;
// - coverage: every id TW.Content names has a finished sprite (ARCH section 4; tools/art-coverage.mjs lists them);
// - fidelity: every sprite the Ember Lit mockup drew is byte-identical when drawn through TW.Art (mockups/ember-lit/
//   art.js is loaded with a stub canvas), which guards the kit's light, emboss, pips and digits; the Jingle Jester,
//   redrawn in the final pass, is checked with its one-line switch set to 'classic';
// - the Jingle Jester's switch: 'candle' (the default) draws the candle-world bell-ringer in the same common frame,
//   with none of the colours on the originality list and none of the old cap's harlequin points; 'classic' brings
//   back Lit's drawing;
// - the registry's contract: frozen kit, read-only bitmaps, court load order, failures named and not redrawn.
// The mockup, the originality list and gallery.html are local-only (tests/local-data.mjs): the checks that read
// them skip, and say why, where they are absent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { ORIGINALITY, needs, needsOriginality } from './local-data.mjs';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const ART_FILES = readdirSync(new URL('src/art/', root)).filter((f) => f.endsWith('.js')).sort();

/** A fresh sandbox with src/content.js and every src/art/*.js in name order: no window, no document. */
function load(after, globals = {}) {
  const ctx = vm.createContext({ console, ...globals });
  vm.runInContext(read('src/content.js'), ctx, { filename: 'src/content.js' });
  for (const f of ART_FILES) vm.runInContext(read(`src/art/${f}`), ctx, { filename: `src/art/${f}` });
  if (after) after(ctx.TW.Art, ctx);
  return ctx.TW;
}
/** The Jingle Jester's one-line switch in src/art/40-jokers-lit.js. */
const JINGLE_SWITCH = /(const JINGLE_JESTER_STYLE = )'[a-z]+'/;
/** The same sandbox as load(), with the Jingle Jester's switch set to style ('candle', 'classic' or anything else). */
function loadJingle(style) {
  const ctx = vm.createContext({ console });
  vm.runInContext(read('src/content.js'), ctx, { filename: 'src/content.js' });
  for (const f of ART_FILES) {
    let src = read(`src/art/${f}`);
    if (f === '40-jokers-lit.js') {
      assert.match(src, JINGLE_SWITCH, `src/art/${f} has the JINGLE_JESTER_STYLE switch`);
      src = src.replace(JINGLE_SWITCH, `$1'${style}'`);
    }
    vm.runInContext(src, ctx, { filename: `src/art/${f}` });
  }
  return ctx.TW;
}
/** content.js and the core only: the registry's mechanics, whatever the content files have drawn so far. */
function loadCore(globals = {}) {
  const ctx = vm.createContext({ console, ...globals });
  vm.runInContext(read('src/content.js'), ctx, { filename: 'src/content.js' });
  vm.runInContext(read('src/art/00-core.js'), ctx, { filename: 'src/art/00-core.js' });
  return ctx.TW.Art;
}
/** A document whose canvas only counts what it encodes (enough for TW.Art.url and TW.Art.warm). */
function stubDocument() {
  const doc = { encoded: 0 };
  doc.createElement = () => ({ getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }), toDataURL: () => `data:image/png;base64,${++doc.encoded}` });
  return doc;
}
const isBytes = (d) => Object.prototype.toString.call(d) === '[object Uint8ClampedArray]';
const opaqueCount = (bm) => { let n = 0; for (let i = 3; i < bm.data.length; i += 4) if (bm.data[i]) n++; return n; };
const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const px = (bm, x, y) => [...bm.data.slice((y * bm.w + x) * 4, (y * bm.w + x) * 4 + 4)];
const changed = (a, b) => { const out = []; for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) out.push(i >> 2); return out; };
const SAMPLE_CARDS = [[2, 'S'], [7, 'D'], [10, 'H'], [11, 'C'], [12, 'S'], [13, 'H'], [14, 'D'], [14, 'S']];

test('the art module loads with no DOM and exposes the ARCH section 4 API', () => {
  const TW = load();
  assert.equal(typeof globalThis.document, 'undefined');
  const A = TW.Art;
  for (const fn of ['define', 'has', 'ids', 'bitmap', 'url', 'card', 'warm']) assert.equal(typeof A[fn], 'function', fn);
  for (const fn of ['joker', 'tarot', 'planet', 'spectral', 'voucher', 'pack', 'tag', 'boss', 'stake', 'back', 'court', 'enhancement', 'seal', 'edition']) assert.equal(typeof A[fn], 'function', `helper ${fn}`);
  assert.equal(typeof A.kit, 'object');
  assert.ok(A.ids().length > 0);
});

test('the drawing kit is exposed to the content files, frozen all the way down', () => {
  const { kit } = load().Art;
  const fns = ['hexRGBA', 'Bmp', 'Mask', 'grid', 'emboss', 'sphere', 'disc', 'ellipse', 'roundRect', 'strokeQuad', 'shade', 'rng', 'epx',
    'textBmp', 'num', 'pipBmp', 'bigPipMask', 'cardMask', 'cardShape', 'drawIndex', 'numberCard', 'aceCard', 'headKey', 'body', 'courtFigure',
    'tempFigure', 'courtFace', 'faceCard', 'backBase', 'backMedallion', 'cardBack', 'flameFrames', 'flameStrip', 'frameCard', 'gems', 'artWindow',
    'jokerCard', 'legendaryFrame', 'tarotFrame', 'planetFrame', 'spectralFrame', 'voucherFrame', 'packCard', 'tagToken', 'stakeChip',
    'candleWax', 'encoreRibbon', 'icon', 'panel', 'lipPanel', 'shard', 'pill', 'button', 'slot', 'glitchFringe', 'bakeFringe'];
  for (const f of fns) assert.equal(typeof kit[f], 'function', `kit.${f}`);
  for (const t of ['C', 'R', 'RARITY', 'ICONS', 'FONTS', 'TEXT', 'HEAD', 'ROBE', 'PEOPLE']) assert.equal(typeof kit[t], 'object', `kit.${t}`);
  for (const r of ['common', 'uncommon', 'rare', 'legendary']) assert.ok(kit.RARITY[r], `rarity ${r}`);
  assert.equal(kit.CW, 41);
  assert.equal(kit.CH, 55);
  assert.ok(Object.isFrozen(kit) && Object.isFrozen(kit.R.cream), 'the kit and its ramps are frozen');
  // one stray in-place write in a content file would change other files' sprites: every one is refused
  const writes = {
    'kit.LIGHT[0]': () => { kit.LIGHT[0] = 0.9; },
    'kit.GLYPH_S[7]': () => { kit.GLYPH_S[7] = '#####'; },
    'kit.FONTS.S.gap': () => { kit.FONTS.S.gap = 3; },
    'kit.FONTS.L.g.$': () => { kit.FONTS.L.g.$ = []; },
    'kit.TEXT.coin.ramp.reverse()': () => kit.TEXT.coin.ramp.reverse(),
    'kit.PIPS[2][0][1]': () => { kit.PIPS[2][0][1] = 9; },
    'kit.ROUND[17][0]': () => { kit.ROUND[17][0] = 1; },
    'kit.Bmp.prototype.outline': () => { kit.Bmp.prototype.outline = null; },
    'kit.Mask.prototype.or': () => { kit.Mask.prototype.or = null; },
  };
  // (the sandbox's TypeError is another realm's class, so match it by name)
  for (const [what, write] of Object.entries(writes)) assert.throws(write, (e) => e && e.name === 'TypeError', `${what} is read-only`);
  assert.equal(kit.FONTS.S.gap, 1);
  // a kit bitmap converts to RGBA bytes
  const b = new kit.Bmp(2, 1).set(0, 0, '#FF0000').set(1, 0, '#00FF0080');
  assert.deepEqual([...b.rgba()], [255, 0, 0, 255, 0, 255, 0, 128]);
});

test('sprite ids are unique and define() refuses a duplicate', () => {
  const A = load().Art;
  const ids = A.ids();
  assert.equal(new Set(ids).size, ids.length);
  assert.throws(() => A.define(ids[0], { w: 1, h: 1, make: (k) => new k.Bmp(1, 1) }), /duplicate/);
  assert.throws(() => A.define('test:bad-size', { w: 0, h: 1, make: () => null }), /whole numbers/);
  assert.equal(A.has('card:14S'), true);
  assert.equal(A.has('nothing:here'), false);
  assert.equal(A.bitmap('nothing:here'), null);
  assert.ok(A.ids('icon:').every((id) => id.startsWith('icon:')));
});

test('every registered sprite renders at its declared size and is not empty', () => {
  const A = load().Art;
  for (const id of A.ids()) {
    const m = A.meta(id), bm = A.bitmap(id);
    assert.ok(bm, `${id} has a bitmap`);
    assert.ok(isBytes(bm.data), `${id}: data is a Uint8ClampedArray`);
    assert.equal(bm.w, m.w, `${id} width`);
    assert.equal(bm.h, m.h, `${id} height`);
    assert.equal(bm.data.length, bm.w * bm.h * 4, `${id} byte count`);
    assert.ok(opaqueCount(bm) > 0, `${id} is not empty`);
  }
});

test('every sprite has the size its kind promises (ARCH section 4)', () => {
  const A = load().Art;
  const exact = { card: [41, 55], back: [41, 55], joker: [41, 55], tarot: [41, 55], planet: [41, 55], spectral: [41, 55], voucher: [41, 55], pack: [41, 55], tag: [17, 17], stake: [15, 15], icon: [9, 9] };
  const most = { blind: 31, boss: 31, seal: 17, edition: 17, enh: 17 };
  for (const id of A.ids()) {
    const { kind, w, h } = A.meta(id);
    if (exact[kind]) assert.deepEqual([w, h], exact[kind], `${id} is ${exact[kind].join('x')}`);
    if (most[kind]) assert.ok(w <= most[kind] && h <= most[kind], `${id} is at most ${most[kind]}x${most[kind]}`);
  }
});

test('every id TW.Content names has a finished sprite (ARCH section 4)', () => {
  const { Art: A, Content } = load();
  const missing = [], temporary = [];
  for (const [prefix, table] of Object.entries(A.TABLES)) {
    const rows = Content[table];
    assert.ok(Array.isArray(rows) && rows.length, `TW.Content.${table} has rows`);
    for (const row of rows) {
      if (prefix === 'blind' && row.id !== 'small' && row.id !== 'big') continue; // each Boss Blind is its own emblem
      const id = `${prefix}:${row.id}`;
      if (!A.has(id)) missing.push(`${id} (${row.name})`);
      else if (A.meta(id).temp) temporary.push(id);
    }
  }
  for (const s of 'SHCD') for (let r = 2; r <= 14; r++) {
    const id = `card:${r}${s}`;
    if (!A.has(id)) missing.push(id);
    else if (A.meta(id).temp) temporary.push(id);
  }
  assert.deepEqual(missing, [], `${missing.length} content ids have no sprite (node tools/art-coverage.mjs lists them)`);
  assert.deepEqual(temporary, [], `${temporary.length} content ids still have temporary art`);
});

test('sprites are deterministic: two renders are byte-identical, in one sandbox and across two', () => {
  const A = load().Art, B = load().Art;
  for (const id of A.ids()) {
    const a = A.bitmap(id), again = A.render(id), b = B.bitmap(id);
    assert.ok(sameBytes(a.data, again.data), `${id}: a second render differs`);
    assert.ok(b && sameBytes(a.data, b.data), `${id}: a second sandbox draws it differently`);
  }
});

test("the sprites Lit drew are byte-identical to the Ember Lit mockup (mockups/ember-lit/art.js)", { skip: needs('mockups/ember-lit/art.js') }, () => {
  const A = load().Art, K = A.kit;
  const canvas = () => ({ getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }), toDataURL: () => 'data:,' });
  const lctx = vm.createContext({ console, document: { createElement: canvas } });
  lctx.window = lctx;
  vm.runInContext(read('mockups/ember-lit/art.js'), lctx, { filename: 'mockups/ember-lit/art.js' });
  const L = lctx.Ember.Art;
  const litBytes = (b) => { const d = new Uint8ClampedArray(b.w * b.h * 4); b.p.forEach((c, i) => { if (c) d.set(K.hexRGBA(c), i * 4); }); return d; };
  const same = (label, bm, lit) => {
    assert.ok(bm, `${label} exists`);
    assert.deepEqual([bm.w, bm.h], [lit.w, lit.h], `${label} size`);
    const want = litBytes(lit);
    let bad = 0, first = -1;
    for (let i = 0; i < want.length; i++) if (want[i] !== bm.data[i]) { bad++; if (first < 0) first = i >> 2; }
    assert.equal(bad, 0, `${label}: ${bad} bytes differ from Lit (first at x ${first % bm.w}, y ${Math.floor(first / bm.w)}). ` +
      'It is declared pixel-identical to Lit; if it was redrawn on purpose, take it out of this test and out of its file header.');
  };
  const asBm = (b) => ({ w: b.w, h: b.h, data: b.rgba() });
  // the faces: number cards, Aces and the three courts Lit's people keep; the kit's Lit figure for all twelve
  for (const s of 'SHCD') for (let r = 2; r <= 14; r++) {
    if (r < 11 || r > 13 || ['11S', '13S', '12H'].includes(`${r}${s}`)) same(`card:${r}${s}`, A.bitmap(`card:${r}${s}`), L.card(r, s).bmp);
    if (r >= 11 && r <= 13) same(`kit.faceCard(${r}, ${s})`, asBm(K.faceCard(r, s)), L.card(r, s).bmp);
  }
  // the Glitch fringe baked inside a cream card is Lit's fringe laid over the card
  for (const [r, s] of [[7, 'D'], [14, 'S'], [10, 'H'], [12, 'H']]) {
    const card = L.card(r, s), fr = L.fringe(card, `${r}${s}`).bmp, want = new K.Bmp(41, 55), mask = K.cardMask();
    want.p = card.bmp.p.slice();
    for (let y = 0; y < 55; y++) for (let x = 0; x < 41; x++) { const c = fr.get(x + 1, y); if (c && mask.get(x, y)) want.mix(x, y, c); }
    same(`card:${r}${s}|||fourcolor`, A.bitmap(A.card({ rank: r, suit: s, edition: 'fourcolor' })), want);
  }
  same('back:firstissue', A.bitmap('back:firstissue'), L.back().bmp);
  // (the Jingle Jester was redrawn in the final pass; Lit's drawing stays behind the file's one-line switch)
  same("joker:jinglejester with JINGLE_JESTER_STYLE = 'classic'", loadJingle('classic').Art.bitmap('joker:jinglejester'), L.joker('jingle-jester', 'Common').bmp);
  same('joker:paperclip', A.bitmap('joker:paperclip'), L.joker('paperclip', 'Uncommon').bmp);
  same('joker:couponclipper', A.bitmap('joker:couponclipper'), L.joker('coupon-clipper', 'Common').bmp);
  same('tarot:ladder', A.bitmap('tarot:ladder'), L.tarot('ladder').bmp);
  same('planet:kerplunk', A.bitmap('planet:kerplunk'), L.planet('cinderon').bmp);
  same('spectral:spellbound', A.bitmap('spectral:spellbound'), L.spectral('wickwisp').bmp);
  same('blind:small', A.bitmap('blind:small'), L.candle(false).bmp);
  same('blind:big', A.bitmap('blind:big'), L.candle(true).bmp);
  same('boss:smudge', A.bitmap('boss:smudge'), L.smudge().bmp);
  same('seal:encore', A.bitmap('seal:encore'), L.ribbon().bmp);
  // (the deck icon was Lit's too, redrawn on purpose: Lit's red plus on a white card read as a first-aid cross)
  for (const n of ['info', 'options', 'replay']) { same(`icon:${n}`, A.bitmap(`icon:${n}`), L.icon(n).bmp); same(`icon:${n}:light`, A.bitmap(`icon:${n}:light`), L.icon(n, '#FFE6CC').bmp); }
  same('ui:slot', A.bitmap('ui:slot'), L.slot().bmp);
  same('ui:flame', A.bitmap('ui:flame'), L.flame().bmp);
  L.frames();
  const FR = { panel: 'panel', panelWarm: 'panel-warm', panelDeep: 'panel-deep', panelRack: 'panel-rack', well: 'well', chips: 'chips', mult: 'mult', tip: 'tip', plaque: 'plaque', dialog: 'dialog', boss: 'boss', btnGhost: 'btn-ghost' };
  for (const r of ['Ember', 'Pink', 'Lime', 'Cream', 'Yellow', 'Vio', 'Blue', 'Red']) FR['pill' + r] = 'pill-' + r.toLowerCase();
  for (const r of ['Ember', 'Pink', 'Cream', 'Yellow', 'Plum']) { FR['btn' + r] = 'btn-' + r.toLowerCase(); FR['btn' + r + 'Down'] = 'btn-' + r.toLowerCase() + '-down'; }
  for (const [lk, pk] of Object.entries(FR)) same(`ui:${pk}`, A.bitmap(`ui:${pk}`), L.sprite('frame:' + lk).bmp);
  for (const c of ['chips', 'mult', 'lime', 'pink']) for (const [w, h, k] of [[6, 2, ''], [2, 7, ''], [5, 0, 'diag'], [6, 0, 'anti'], [4, 4, '']]) same(`shard ${c} ${w}x${h} ${k}`, A.bitmap(A.shard(c, w, h, k)), L.shard(c, w, h, k).bmp);
  for (const [t, s, st] of [['0123456789', 'S', 'cream'], ['355', 'XL', 'score'], ['$9', 'L', 'money'], ['1,250', 'XXL', 'total'], ['x4.5/-', 'S', 'soft']]) same(`num ${t}`, A.bitmap(A.num(t, s, st)), L.numSprite(t, s, st).bmp);
});

test("the Jingle Jester: the candle-world bell-ringer by default, Lit's capped jester behind a one-line switch", () => {
  // the switch: one line, 'candle' as shipped
  const lines = read('src/art/40-jokers-lit.js').split('\n').filter((l) => /\bconst JINGLE_JESTER_STYLE\b/.test(l));
  assert.equal(lines.length, 1, 'one switch line');
  assert.match(lines[0], /^\s*const JINGLE_JESTER_STYLE = 'candle'; \/\/ or 'classic'$/, "the switch is set to 'candle'");
  const id = 'joker:jinglejester', def = load().Art;
  const candle = loadJingle('candle').Art.bitmap(id), classic = loadJingle('classic').Art.bitmap(id);
  assert.ok(sameBytes(def.bitmap(id).data, candle.data), "the file as shipped draws the 'candle' figure");
  assert.ok(sameBytes(loadJingle('cap').Art.bitmap(id).data, candle.data), "any other value draws the 'candle' figure");
  assert.ok(sameBytes(loadJingle('candle').Art.render(id).data, candle.data), "the 'candle' figure is deterministic");
  // both settings sit in the same common frame: outside the 31 x 31 art window (its ink rim and lip included), every
  // pixel is Coupon Clipper's, so nothing is drawn over the frame
  const ref = def.bitmap('joker:couponclipper'), inWindow = (x, y) => x >= 5 && x <= 35 && y >= 7 && y <= 37;
  for (const [name, bm] of [['candle', candle], ['classic', classic]]) {
    assert.deepEqual([bm.w, bm.h], [41, 55], `${name} size`);
    for (let y = 0; y < 55; y++) for (let x = 0; x < 41; x++) if (!inWindow(x, y)) assert.deepEqual(px(bm, x, y), px(ref, x, y), `${name}: frame pixel ${x},${y} is the common frame's`);
  }
  // a new picture, not a recolour: most of the 31 x 31 window changes
  let changedPx = 0;
  for (let y = 7; y < 38; y++) for (let x = 5; x < 36; x++) if (px(candle, x, y).join() !== px(classic, x, y).join()) changedPx++;
  assert.ok(changedPx > 961 * 0.6, `the redraw changes most of the art window (${changedPx} of 961 pixels)`);
  // the originality line: none of the old cap's lime and chip-blue points (and none of the colours on the
  // originality list anywhere: the next test, which needs that local-only list)
  const K = def.kit, hex = (p) => '#' + p.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const windowHex = []; for (let y = 7; y < 38; y++) for (let x = 5; x < 36; x++) windowHex.push(hex(px(candle, x, y)));
  const harlequin = new Set([...K.R.lime, ...K.R.chips]);
  assert.deepEqual(windowHex.filter((c) => harlequin.has(c)), [], 'no lime or chip blue in the art window');
  // it still reads as "jingle" in the candle world: a big gold bell, and the table's flame on the wick
  const gold = new Set(K.R.gold), flame = new Set(Object.values(K.FLAME_KEY).filter((c) => c !== K.C.edge));
  assert.ok(windowHex.filter((c) => gold.has(c)).length >= 80, 'a big gold bell');
  assert.ok(windowHex.filter((c) => flame.has(c)).length >= 25, "Lit's flame on the wick");
});

test("the Jingle Jester's candle figure uses none of the colours on the originality list, anywhere on the card", { skip: needsOriginality }, () => {
  const candle = loadJingle('candle').Art.bitmap('joker:jinglejester');
  const hex = (p) => '#' + p.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const cardHex = new Set(); for (let y = 0; y < 55; y++) for (let x = 0; x < 41; x++) if (px(candle, x, y)[3]) cardHex.add(hex(px(candle, x, y)));
  assert.ok(ORIGINALITY.colours.length >= 5, 'the originality list holds its colours');
  for (const c of ORIGINALITY.colours) assert.ok(!cardHex.has(c), `no listed colour ${c}`);
});

test('TW.Art.url returns null without a DOM, and TW.Art.warm resolves at once', async () => {
  const A = load().Art;
  assert.equal(A.url('card:14S'), null);
  assert.equal(A.url('ui:panel'), null);
  assert.equal(A.url('nothing:here'), null);
  assert.equal(await A.warm(['card:14S', 'card:2C']), 0);
  assert.equal(await A.warm('card:'), 0);
});

test('with a document, url() is cached, a failing sprite is drawn once, and warm() fills the cache ahead of need', async () => {
  const doc = stubDocument(), errors = [];
  const A = loadCore({ document: doc, setTimeout, console: { ...console, error: (e) => errors.push(e) } });
  let runs = 0;
  A.define('test:broken', { w: 1, h: 1, make: () => { runs++; throw new Error('no pixels'); } });
  for (let i = 0; i < 5; i++) assert.equal(A.url('test:broken'), null);
  assert.equal(runs, 1, 'make() is not run again on every call');
  assert.equal(errors.length, 1, 'the failure is logged once');
  assert.match(String(errors[0] && errors[0].message), /"test:broken" failed to draw: no pixels/);
  const u = A.url('ui:slot');
  assert.match(u, /^data:image\/png;base64,/);
  assert.equal(A.url('ui:slot'), u, 'cached');
  const before = doc.encoded;
  const n = await A.warm(['ui:panel', 'ui:well', 'ui:slot', 'nothing:here'], { budget: 50 });
  assert.equal(n, 2, 'two new sprites warmed (ui:slot was cached, nothing:here is unknown)');
  assert.equal(doc.encoded, before + 2);
  assert.equal(await A.warm(['ui:panel']), 0, 'nothing left to warm');
});

test('the registry hands out read-only records: shared bitmaps, copied buffers, a frozen Seal spot', () => {
  const A = load().Art;
  const bm = A.bitmap('card:14S');
  assert.ok(Object.isFrozen(bm), 'the cached record is frozen');
  assert.throws(() => { bm.w = 3; }, TypeError);
  assert.equal(A.bitmap('card:14S|||') === undefined, false);
  assert.equal(A.bitmap(A.card({ rank: 14, suit: 'S' })), bm, 'a plain composed card shares its face (one PNG)');
  // a raw buffer from make() is copied, so its producer can't change the sprite later
  const raw = { w: 1, h: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) };
  A.define('test:raw', { w: 1, h: 1, make: () => raw });
  const got = A.bitmap('test:raw');
  raw.data[0] = 99;
  assert.equal(got.data[0], 1);
  const at = A.meta('seal:encore').at;
  assert.ok(Object.isFrozen(at), 'meta(seal).at is frozen');
  assert.throws(() => { at[0] = 0; }, TypeError);
});

test('a sprite that fails to draw names itself, and a figure bigger than its window is refused', () => {
  const A = load((B) => {
    B.joker('test-big', { ground: ['#3E0824', '#5E0F38', '#87154C', '#B21F67'], speck: ['#FFFFFF'], draw: (k) => new k.Bmp(40, 40) });
    B.tarot('test-null', { draw: () => null });
  }).Art;
  assert.throws(() => A.bitmap('joker:test-big'), /"joker:test-big" failed to draw: .*40x40.*31x31/);
  assert.throws(() => A.bitmap('tarot:test-null'), /"tarot:test-null" failed to draw: draw\(\) must return a kit\.Bmp, not null/);
});

test('playing cards: all 52 faces and composition with every registered Enhancement, Seal and Edition', () => {
  const A = load().Art;
  for (const s of 'SHCD') for (let r = 2; r <= 14; r++) {
    const id = A.card({ rank: r, suit: s });
    assert.equal(id, `card:${r}${s}|||`);
    if (A.has(`card:${r}${s}`)) assert.ok(sameBytes(A.bitmap(id).data, A.bitmap(`card:${r}${s}`).data), `${id} equals the plain face`);
    assert.ok(opaqueCount(A.bitmap(id)) > 0);
  }
  const parts = [...A.enhancements().map((e) => ({ enhancement: e })), ...A.seals().map((s) => ({ seal: s })), ...A.editions().map((e) => ({ edition: e }))];
  const all = { enhancement: A.enhancements()[0], seal: A.seals()[0], edition: A.editions()[0] };
  for (const part of [...parts, all]) for (const [rank, suit] of SAMPLE_CARDS) {
    const id = A.card({ rank, suit, ...part });
    assert.match(id, /^card:\d{1,2}[SHCD]\|[^|]*\|[^|]*\|[^|]*$/);
    const [, e, s, d] = id.split('|');
    assert.equal(e, part.enhancement || '');
    assert.equal(s, part.seal || '');
    assert.equal(d, part.edition || '');
    const bm = A.bitmap(id);
    assert.equal(bm.w, 41);
    assert.equal(bm.h, 55);
    assert.ok(opaqueCount(bm) > 1500, `${id} is a whole card`);
    assert.ok(sameBytes(bm.data, A.render(id).data), `${id} is deterministic`);
    assert.equal(A.card({ rank, suit, ...part }), id, 'the same card gives the same id');
  }
  // every mod shows: each one changes at least one pixel of the 7 of Diamonds
  const plain = A.bitmap('card:7D');
  for (const part of parts) assert.ok(changed(plain, A.bitmap(A.card({ rank: 7, suit: 'D', ...part }))).length > 0, `${JSON.stringify(part)} changes card:7D`);
  // every registered mod has its badge, at most 17 x 17
  for (const e of A.enhancements()) assert.ok(A.has(`enh:${e}`));
  for (const s of A.seals()) assert.ok(A.has(`seal:${s}`));
  for (const e of A.editions()) assert.ok(A.has(`edition:${e}`));
});

test('card() takes engine cards, letter ranks and lower-case suits, warns once about a known mod without art, and refuses nonsense', () => {
  const warns = [];
  const TW = load((A, ctx) => { ctx.TW.Content.ENHANCEMENTS.push({ id: 'test-unpainted', name: 'Test' }); }, { console: { ...console, warn: (m) => warns.push(String(m)) } });
  const A = TW.Art;
  assert.equal(A.card({ rank: 'A', suit: 'h' }), 'card:14H|||');
  assert.equal(A.card({ rank: '10', suit: 'S', uid: 7, enhancement: null, seal: undefined }), 'card:10S|||');
  assert.equal(A.card({ rank: 9, suit: 'C', enhancement: 'no-such-thing' }), 'card:9C|||', 'a mod with no art is left out');
  assert.deepEqual(warns, [], 'an id TW.Content does not know is silently left out');
  assert.equal(A.card({ rank: 9, suit: 'C', enhancement: 'test-unpainted' }), 'card:9C|||');
  assert.equal(A.card({ rank: 3, suit: 'H', enhancement: 'test-unpainted' }), 'card:3H|||');
  assert.equal(warns.length, 1, 'a TW.Content mod with no art is said once');
  assert.match(warns[0], /enhancement "test-unpainted" has no art/);
  assert.throws(() => A.card({ rank: 1, suit: 'S' }), /rank/);
  assert.throws(() => A.card({ rank: 7, suit: 'X' }), /suit/);
});

test('colour-coded suits: card({ fourColor: true }) has its own id form, and the two-colour ids stay as they are', () => {
  const A = load().Art;
  const [enh, seal, ed] = [A.enhancements()[0], A.seals()[0], A.editions()[0]];
  // the two-colour form, unchanged, whether fourColor is left out or false
  assert.equal(A.card({ rank: 7, suit: 'D' }), 'card:7D|||');
  assert.equal(A.card({ rank: 7, suit: 'D', fourColor: false }), 'card:7D|||');
  assert.equal(A.card({ rank: 7, suit: 'D', enhancement: enh, seal, edition: ed }), `card:7D|${enh}|${seal}|${ed}`);
  // the four-colour form: 'card4:' and the same four parts
  assert.equal(A.card({ rank: 7, suit: 'D', fourColor: true }), 'card4:7D|||');
  assert.equal(A.card({ rank: 'A', suit: 'c', fourColor: true }), 'card4:14C|||');
  assert.equal(A.card({ rank: 12, suit: 'C', enhancement: enh, seal, edition: ed, fourColor: true }), `card4:12C|${enh}|${seal}|${ed}`);
  assert.equal(A.card({ rank: 9, suit: 'C', enhancement: 'no-such-thing', fourColor: true }), 'card4:9C|||', 'a mod with no art is left out here too');
  for (const id of [A.card({ rank: 12, suit: 'C', enhancement: enh, seal, edition: ed, fourColor: true }), 'card4:2S', 'card4:14D']) {
    assert.match(id, /^card4:\d{1,2}[SHCD](\|[^|]*\|[^|]*\|[^|]*)?$/);
    const m = A.meta(id), bm = A.bitmap(id);
    assert.equal(m.kind, 'card', `${id} is a playing card`);
    assert.equal(m.fourColor, true, `${id} says it is four-colour`);
    assert.deepEqual([bm.w, bm.h], [41, 55]);
  }
  // all 52 plain four-colour faces are registered up front (warm('card4:') covers them), and the prefixes don't mix
  for (const s of 'SHCD') for (let r = 2; r <= 14; r++) assert.ok(A.has(`card4:${r}${s}`), `card4:${r}${s}`);
  assert.ok(A.ids('card:').every((id) => id.startsWith('card:')) && A.ids('card4:').every((id) => id.startsWith('card4:')));
  assert.ok(!A.ids('card:').some((id) => id.startsWith('card4')));
  // shared pictures, one PNG each: a plain composed card shares its face; a Spade or a Heart its two-colour picture
  assert.equal(A.bitmap('card4:7D|||'), A.bitmap('card4:7D'));
  assert.equal(A.bitmap('card4:14S'), A.bitmap('card:14S'));
  assert.equal(A.bitmap(A.card({ rank: 9, suit: 'H', enhancement: enh, edition: ed, fourColor: true })), A.bitmap(A.card({ rank: 9, suit: 'H', enhancement: enh, edition: ed })));
  assert.notEqual(A.bitmap('card4:9C'), A.bitmap('card:9C'));
  // the inks are the kit's: Clubs and Diamonds each seven shades (none of them a colour on the originality list: the
  // next test, which needs that local-only list)
  const { SUIT_INK4, R } = A.kit;
  const kitColours = new Set(Object.values(R).flat());
  for (const s of ['C', 'D']) {
    assert.equal(SUIT_INK4[s].length, A.kit.SUIT_RAMP[s].length, `${s}: shade for shade`);
    for (const c of SUIT_INK4[s]) assert.ok(kitColours.has(c), `${s} ink ${c} comes from kit.R`);
  }
  assert.throws(() => { SUIT_INK4.C[0] = '#000000'; }, (e) => e && e.name === 'TypeError', 'the inks are frozen');
});

test('colour-coded suits: no Clubs or Diamonds ink is a colour on the originality list', { skip: needsOriginality }, () => {
  const { SUIT_INK4 } = load().Art.kit;
  assert.ok(ORIGINALITY.colours.length >= 5, 'the originality list holds its colours');
  for (const s of ['C', 'D']) for (const banned of ORIGINALITY.colours) assert.ok(!SUIT_INK4[s].includes(banned), `${s}: no ink is ${banned}`);
});

test('card mods registered from another file compose without touching the core', () => {
  const TW = load((A) => {
    const k = A.kit;
    A.enhancement('test-blue', {
      w: 11, h: 15,
      badge: (kk) => kk.miniCard({ face: '#3346D6' }),
      stock: (kk) => kk.cardShape({ face: '#3346D6', hi: '#7C8FFF', shade: '#2734B5', lip: '#1C2489' }),
      over: (kk, b, ctx) => { b.set(20, 50, '#00FF00'); assert.ok(ctx.face && ctx.face.w === 41, 'over() sees the face layer'); },
    });
    A.seal('test-dot', { w: 5, h: 5, badge: (kk) => new kk.Bmp(5, 5).rect(0, 0, 5, 5, '#FF00FF') });
    A.edition('test-tint', { w: 5, h: 5, badge: (kk) => new kk.Bmp(5, 5).rect(0, 0, 5, 5, '#00FFFF'), apply: (kk, b) => { const o = b.clone(); o.set(1, 30, '#FFFF00'); return o; } });
    assert.ok(k);
  });
  const A = TW.Art;
  const id = A.card({ rank: 7, suit: 'D', enhancement: 'test-blue', seal: 'test-dot', edition: 'test-tint' });
  assert.equal(id, 'card:7D|test-blue|test-dot|test-tint');
  const bm = A.bitmap(id);
  assert.deepEqual(px(bm, 2, 30), [0x33, 0x46, 0xD6, 255], 'the stock comes from the Enhancement');
  assert.deepEqual(px(bm, 20, 50), [0, 255, 0, 255], 'over() draws after the face');
  assert.deepEqual(px(bm, 1, 30), [255, 255, 0, 255], 'the Edition bakes its pixels');
  // the default Seal spot: right edge at x 38, top 4 px above the card, clipped to it
  assert.deepEqual(px(bm, 33, 0), [255, 0, 255, 255], 'the Seal sits at the top right');
  assert.deepEqual(px(bm, 32, 0)[3] === 255 && px(bm, 32, 0)[0] !== 255, true, 'and no wider than its badge');
  assert.deepEqual([...A.meta('seal:test-dot').at], [33, -4]);
  for (const s of 'SHCD') for (let r = 2; r <= 14; r++) assert.equal(A.bitmap(A.card({ rank: r, suit: s, enhancement: 'test-blue' })).w, 41);
  assert.throws(() => A.seal('test-dot', { w: 5, h: 5, badge: (kk) => new kk.Bmp(5, 5) }), /already/);
  assert.throws(() => A.enhancement('test-big', { w: 30, h: 30, badge: (kk) => new kk.Bmp(30, 30) }), /17/);
});

test('the Glitch fringe follows the index and pips, never a darker stock', () => {
  const A = load((B) => {
    B.enhancement('test-dark', { w: 11, h: 15, badge: (k) => k.miniCard(), stock: (k) => k.cardShape({ face: '#B07418', hi: '#E09A22', shade: '#7E4A0E', lip: '#4A2606' }) });
  }).Art;
  for (const [r, s] of [[7, 'D'], [10, 'S'], [14, 'H'], [12, 'C']]) {
    const cream = changed(A.bitmap(`card:${r}${s}`), A.bitmap(A.card({ rank: r, suit: s, edition: 'fourcolor' })));
    const dark = changed(A.bitmap(A.card({ rank: r, suit: s, enhancement: 'test-dark' })), A.bitmap(A.card({ rank: r, suit: s, enhancement: 'test-dark', edition: 'fourcolor' })));
    assert.ok(cream.length > 0);
    assert.deepEqual(dark, cream, `${r}${s}: the fringe lands on the same pixels on a dark stock as on cream`);
  }
});

test('courts: a temporary figure can be replaced later, a finished one cannot, and load order does not matter', () => {
  // the mechanism, on the core alone, so it holds whichever courts the content files have finished
  const finishedFig = (k) => new k.Bmp(19, 45).rect(0, 15, 19, 30, '#00AA00');
  const tempFig = (k, c) => k.tempFigure(c.who, c.suit);
  const A = loadCore();
  A.seal('test-dot', { w: 5, h: 5, badge: (k) => new k.Bmp(5, 5).rect(0, 0, 5, 5, '#FF00FF') });
  A.court(11, 'C', { figure: tempFig, temp: true });
  A.cardFace(11, 'C');
  A.cardFace(11, 'C', true);
  assert.equal(A.meta('card:11C').temp, true, 'a temporary court flags its face');
  assert.equal(A.meta('card4:11C').temp, true, 'and its four-colour face');
  const early = A.bitmap('card:11C'), earlyMod = A.bitmap(A.card({ rank: 11, suit: 'C', seal: 'test-dot' }));
  const early4 = A.bitmap('card4:11C'), early4Mod = A.bitmap(A.card({ rank: 11, suit: 'C', seal: 'test-dot', fourColor: true }));
  A.court(11, 'C', { figure: finishedFig });
  assert.equal(A.meta('card:11C').temp, false);
  assert.ok(!sameBytes(early.data, A.bitmap('card:11C').data), 'the face is redrawn with the new figure');
  assert.ok(!sameBytes(earlyMod.data, A.bitmap(A.card({ rank: 11, suit: 'C', seal: 'test-dot' })).data), 'so are its compositions');
  assert.ok(!sameBytes(early4.data, A.bitmap('card4:11C').data) && !sameBytes(early4Mod.data, A.bitmap(A.card({ rank: 11, suit: 'C', seal: 'test-dot', fourColor: true })).data), 'in both inks');
  assert.throws(() => A.court(11, 'C', { figure: finishedFig }), /already drawn/, 'once replaced, it is finished');
  // a placeholder registered after a finished court (an earlier file finished it) never displaces it
  const drawn = A.bitmap('card:11C');
  assert.doesNotThrow(() => A.court(11, 'C', { figure: tempFig, temp: true }));
  assert.equal(A.meta('card:11C').temp, false);
  assert.ok(sameBytes(drawn.data, A.bitmap('card:11C').data), 'the finished figure stays');
  assert.throws(() => A.court(7, 'S', { figure: finishedFig }), /11, 12 or 13/);
  // a court nobody registered falls back to Lit's person for that rank, flagged temporary
  A.cardFace(13, 'D');
  assert.equal(A.meta('card:13D').temp, true);
  assert.ok(sameBytes(A.bitmap('card:13D').data, A.kit.faceCard(13, 'D').rgba()), "the fallback is Lit's own figure, not a blank");
  // the shipped files: every registered court is finished and cannot be replaced
  const B = load().Art;
  for (const c of B.courts()) assert.equal(B.meta(c.id).temp, c.temp, `${c.id} flags its art`);
  const done = B.courts().find((c) => !c.temp);
  if (done) assert.throws(() => B.court(done.rank, done.suit, { figure: finishedFig }), /already drawn/);
});

test('the content helpers check their specs and draw the shared frames', () => {
  const TW = load((A) => {
    const fig = (k) => new k.Bmp(31, 31).rect(10, 10, 11, 11, '#FF4C9B');
    A.joker('test-legend', { rarity: 'legendary', ground: ['#1E0B42', '#2E1160', '#3E1880', '#5320A0'], speck: ['#FFFFFF'], draw: fig });
    A.tarot('test-t', { draw: fig }); A.planet('test-p', { draw: fig }); A.spectral('test-s', { draw: fig });
    A.voucher('test-v', { draw: fig });
    A.pack('test', { ramp: A.kit.R.vio, label: (k) => new k.Bmp(9, 9).rect(0, 0, 9, 9, '#FF7A2B') });
    A.tag('test', { draw: (k) => new k.Bmp(5, 5).rect(0, 0, 5, 5, '#FF4C9B') });
    A.stake('test', { rim: A.kit.R.peach, ground: ['#2C1535'] });
    A.boss('test', { w: 21, h: 11, draw: (k) => new k.Bmp(19, 9).rect(0, 0, 19, 9, '#8B46EE') });
    A.back('test', { bands: A.kit.C.bands, draw: (k, b) => k.lozenge(b) });
  });
  const A = TW.Art;
  for (const id of ['joker:test-legend', 'tarot:test-t', 'planet:test-p', 'spectral:test-s', 'voucher:test-v', 'pack:testnormal', 'pack:testjumbo', 'pack:testmega', 'back:test']) {
    const bm = A.bitmap(id);
    assert.deepEqual([bm.w, bm.h], [41, 55], id);
    assert.deepEqual(px(bm, 20, 22).slice(0, 3), id.startsWith('pack') || id.startsWith('back') ? px(bm, 20, 22).slice(0, 3) : [0xFF, 0x4C, 0x9B], `${id}: the illustration sits in the window`);
  }
  // the name plate is where ARCH says (x 3..37, y 41..51) on Jokers and consumables: an ink rim round a dark plate
  for (const id of ['joker:test-legend', 'tarot:test-t', 'planet:test-p', 'spectral:test-s', 'voucher:test-v']) {
    const bm = A.bitmap(id);
    assert.deepEqual(px(bm, 3, 46), [0x2B, 0x12, 0x20, 255], `${id} plate rim`);
    assert.ok(px(bm, 20, 46).slice(0, 3).reduce((s, v) => s + v, 0) < 200, `${id} plate is dark`);
  }
  assert.deepEqual([A.bitmap('tag:test').w, A.bitmap('stake:test').w, A.bitmap('boss:test').w], [17, 15, 21]);
  assert.throws(() => A.joker('nope', { ground: ['#000'], draw: () => null }), /ground/);
  assert.throws(() => A.tarot('nope', {}), /draw/);
  assert.throws(() => A.boss('nope', { w: 40, h: 40, draw: () => null }), /31/);
  assert.throws(() => A.stake('nope', {}), /rim/);
  assert.throws(() => A.pack('nope', {}), /label/);
});

test('Joker rarity comes from TW.Content when the row exists', () => {
  const TW = load((A, ctx) => {
    const rows = ctx.TW.Content.JOKERS;
    Object.defineProperty(rows, 'test-rare', { value: { id: 'test-rare', rarity: 'rare' }, enumerable: false });
    A.joker('test-rare', { rarity: 'common', ground: ['#3E0824', '#5E0F38', '#87154C', '#B21F67'], speck: ['#FFFFFF'], draw: (k) => new k.Bmp(31, 31) });
    A.joker('test-common', { rarity: 'common', ground: ['#3E0824', '#5E0F38', '#87154C', '#B21F67'], speck: ['#FFFFFF'], draw: (k) => new k.Bmp(31, 31) });
  });
  const A = TW.Art;
  // the frame's face colour beside the window: rare is pink (#FF4C9B), common is peach
  assert.notDeepEqual(px(A.bitmap('joker:test-rare'), 2, 25), px(A.bitmap('joker:test-common'), 2, 25));
  assert.deepEqual(px(A.bitmap('joker:test-rare'), 2, 25).slice(0, 3), [0xFF, 0x4C, 0x9B]);
});

test('on-demand digits and shards register once and draw at their size', () => {
  const A = load().Art;
  const id = A.num('355', 'XL', 'score');
  assert.equal(id, 'num:XL:score:355');
  assert.equal(A.num('355', 'XL', 'score'), id);
  const bm = A.bitmap(id), m = A.meta(id);
  assert.deepEqual([bm.w, bm.h], [m.w, m.h]);
  assert.ok(opaqueCount(bm) > 0);
  const sh = A.shard('chips', 5, 0, 'diag');
  assert.deepEqual([A.bitmap(sh).w, A.bitmap(sh).h], [6, 5]);
  assert.throws(() => A.num('1', 'Huge'), /size/);
});

// Added by the final pass (part 2, final agent, 2026-11-24), for I5: gallery.html shows each sprite's art brief on
// hover from the plan it embedded when it was written, so a brief the content check changes (the Jingle Jester's
// redraw) reaches the gallery only once `node tools/gallery.mjs` runs again. The table keys mirror tools/gallery.mjs.
// Both files are local-only (gallery.html is generated, the plan is a design source), so without them it skips: a
// gallery built afresh here would only check itself, not that the one on disk is current.
test("gallery.html shows the art briefs of content/content-plan.json (run node tools/gallery.mjs after a brief changes)", { skip: needs('gallery.html', 'content/content-plan.json') }, () => {
  const html = read('gallery.html');
  const m = /<script>window\.__PLAN = (\{.*?\});<\/script>/s.exec(html);
  assert.ok(m, 'gallery.html embeds window.__PLAN');
  const shown = JSON.parse(m[1]);
  const plan = JSON.parse(read('content/content-plan.json'));
  const KEYS = { JOKERS: 'jokers', TAROTS: 'tarot', PLANETS: 'planets', SPECTRALS: 'spectral', BOSSES: 'bosses', VOUCHERS: 'vouchers', TAGS: 'tags', PACKS: 'packs', DECKS: 'decks', STAKES: 'stakes', ENHANCEMENTS: 'enhancements', SEALS: 'seals', EDITIONS: 'editions', BLINDS: 'rounds' };
  const stale = [];
  for (const [table, key] of Object.entries(KEYS)) {
    const rows = plan[key] || [];
    assert.equal((shown[table] || []).length, rows.length, `${table}: the gallery lists every row of the plan`);
    for (const r of rows) {
      const g = (shown[table] || []).find((x) => x.id === r.id);
      if (!g || g.art !== (r.art || '') || g.name !== r.name) stale.push(`${table}:${r.id}`);
    }
  }
  assert.deepEqual(stale, [], 'every brief and name in gallery.html is the plan\'s own');
  assert.ok(!html.includes('A grinning jester in a three-pointed bell cap'), "the Jingle Jester's old brief is gone from the gallery");
});
