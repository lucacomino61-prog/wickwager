// The playing-card art (src/art/10-cards.js): twelve finished courts that are twelve different people, Lit's kept
// sprites still pixel-identical to the kit's Lit drawings, every Enhancement, Seal, Edition, Deck back and Stake
// in TW.Content drawn, Enhancements that never touch the index or pips, and Seals at the one Seal spot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const ART_FILES = readdirSync(new URL('src/art/', root)).filter((f) => f.endsWith('.js')).sort();
function load() {
  const ctx = vm.createContext({ console });
  vm.runInContext(read('src/content.js'), ctx, { filename: 'src/content.js' });
  for (const f of ART_FILES) vm.runInContext(read(`src/art/${f}`), ctx, { filename: `src/art/${f}` });
  return ctx.TW;
}
const TW = load(), A = TW.Art, K = A.kit, CONTENT = TW.Content;
const px = (bm, x, y) => bm.data.slice((y * bm.w + x) * 4, (y * bm.w + x) * 4 + 4).join(',');
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const SUITS = ['S', 'H', 'C', 'D'];

test('all twelve courts are finished, and no two courts of a rank share a figure', () => {
  const courts = A.courts();
  assert.equal(courts.length, 12);
  assert.deepEqual([...courts.filter((c) => c.temp).map((c) => c.id)], [], 'no temporary court is left');
  for (const s of SUITS) for (let r = 11; r <= 13; r++) assert.equal(A.meta(`card:${r}${s}`).temp, false, `card:${r}${s}`);
  // The window with each suit's robe ramp and pale ground mapped to neutral tokens: the same person re-robed in
  // another suit then compares as (nearly) identical. Lit's own re-robed pairs differ by 6 to 19 px this way,
  // mostly the suit pip on the chest; different people differ by hundreds.
  const canon = (bm, s) => {
    const robe = K.ROBE[s], tok = new Map();
    robe.ramp.forEach((c, i) => tok.set(K.hexRGBA(c).join(','), `robe${i}`));
    [...robe.ground, robe.dot].forEach((c) => tok.set(K.hexRGBA(c).join(','), 'ground'));
    const win = K.courtWindow(), out = [];
    for (let y = 4; y < 51; y++) for (let x = 10; x < 31; x++) if (win.get(x, y)) { const c = px(bm, x, y); out.push(tok.get(c) || c); }
    return out;
  };
  const diff = (a, b) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);
  const asBm = (b) => ({ w: b.w, h: b.h, data: b.rgba() });
  assert.ok(diff(canon(asBm(K.faceCard(12, 'S')), 'S'), canon(asBm(K.faceCard(12, 'H')), 'H')) < 40, 'the measure sees through a re-robe');
  for (let r = 11; r <= 13; r++) {
    const c = SUITS.map((s) => canon(A.bitmap(`card:${r}${s}`), s));
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const d = diff(c[i], c[j]);
      assert.ok(d >= 150, `rank ${r}: ${SUITS[i]} and ${SUITS[j]} are different people, not one figure re-robed (${d} px differ)`);
    }
  }
});

test("Lit's kept sprites are pixel-identical to the kit's Lit drawings", () => {
  const eq = (id, bmp) => assert.ok(same([...A.bitmap(id).data], [...bmp.rgba()]), `${id} is Lit's`);
  for (const s of SUITS) for (let r = 2; r <= 10; r++) eq(`card:${r}${s}`, K.numberCard(r, s));
  for (const s of SUITS) eq(`card:14${s}`, K.aceCard(s));
  eq('card:11S', K.faceCard(11, 'S'));
  eq('card:13S', K.faceCard(13, 'S'));
  eq('card:12H', K.faceCard(12, 'H'));
  eq('back:firstissue', K.cardBack());
  eq('seal:encore', K.encoreRibbon());
});

test('every Enhancement, Seal, Edition, Deck and Stake in TW.Content has finished art', () => {
  const kinds = [['ENHANCEMENTS', 'enh'], ['SEALS', 'seal'], ['EDITIONS', 'edition'], ['DECKS', 'back'], ['STAKES', 'stake']];
  for (const [table, prefix] of kinds) {
    assert.ok(Array.isArray(CONTENT[table]) && CONTENT[table].length, `TW.Content.${table}`);
    for (const row of CONTENT[table]) {
      const id = `${prefix}:${row.id}`;
      assert.ok(A.has(id), `${id} (${row.name}) is drawn`);
      assert.equal(A.meta(id).temp, false, `${id} is finished art`);
    }
  }
  assert.deepEqual([...A.enhancements()].sort(), [...CONTENT.ENHANCEMENTS.map((r) => r.id)].sort());
  assert.deepEqual([...A.seals()].sort(), [...CONTENT.SEALS.map((r) => r.id)].sort());
  assert.deepEqual([...A.editions()].sort(), [...CONTENT.EDITIONS.map((r) => r.id)].sort());
});

test('Enhancements keep rank and suit readable: no face pixel of any card is touched', () => {
  const stock = K.cardShape().rgba();
  for (const e of A.enhancements()) for (const s of SUITS) for (let r = 2; r <= 14; r++) {
    const plain = A.bitmap(`card:${r}${s}`), mod = A.bitmap(A.card({ rank: r, suit: s, enhancement: e }));
    let touched = 0;
    for (let i = 0; i < plain.data.length; i += 4) {
      const isFace = plain.data[i] !== stock[i] || plain.data[i + 1] !== stock[i + 1] || plain.data[i + 2] !== stock[i + 2] || plain.data[i + 3] !== stock[i + 3];
      if (isFace && (plain.data[i] !== mod.data[i] || plain.data[i + 1] !== mod.data[i + 1] || plain.data[i + 2] !== mod.data[i + 2] || plain.data[i + 3] !== mod.data[i + 3])) touched++;
    }
    assert.equal(touched, 0, `${e} on ${r}${s} leaves the index, pips and figure as they are`);
  }
});

test('Seals are four different shapes at the one Seal spot over the top edge', () => {
  const masks = [];
  for (const s of A.seals()) {
    const m = A.meta(`seal:${s}`), bm = A.bitmap(`seal:${s}`);
    assert.deepEqual([...m.at], [K.SEAL_RIGHT - m.w, K.SEAL_TOP], `seal:${s} sits at the Seal spot`);
    assert.ok(m.w <= 17 && m.h <= 17);
    masks.push([s, Array.from({ length: 17 * 17 }, (_, i) => { const x = i % 17, y = Math.floor(i / 17); return x < bm.w && y < bm.h && bm.data[(y * bm.w + x) * 4 + 3] ? 1 : 0; })]);
  }
  for (let i = 0; i < masks.length; i++) for (let j = i + 1; j < masks.length; j++) assert.ok(!same(masks[i][1], masks[j][1]), `${masks[i][0]} and ${masks[j][0]} have different outlines`);
});

// ---- colour-coded suits (the fourColor option): 'card4:' faces with Clubs and Diamonds in their own inks
const hexKey = (c) => K.hexRGBA(c).slice(0, 3).join(',');
const rgbAt = (bm, i) => `${bm.data[i]},${bm.data[i + 1]},${bm.data[i + 2]}`;

test('colour-coded suits: each four-colour face differs from its two-colour face only for Clubs and Diamonds, shade for shade', () => {
  for (const s of SUITS) {
    // each shade of the two-colour ink maps to the same shade of the suit's own ink; nothing else may change
    const swap = new Map(s === 'C' || s === 'D' ? K.SUIT_RAMP[s].map((c, i) => [hexKey(c), hexKey(K.SUIT_INK4[s][i])]) : []);
    for (let r = 2; r <= 14; r++) {
      const two = A.bitmap(`card:${r}${s}`), four = A.bitmap(`card4:${r}${s}`);
      let changed = 0, stray = 0;
      for (let i = 0; i < two.data.length; i += 4) {
        if (rgbAt(two, i) === rgbAt(four, i) && two.data[i + 3] === four.data[i + 3]) continue;
        changed++;
        if (swap.get(rgbAt(two, i)) !== rgbAt(four, i) || four.data[i + 3] !== 255) stray++;
      }
      if (s === 'S' || s === 'H') assert.equal(changed, 0, `card4:${r}${s} is the two-colour face`);
      else {
        assert.ok(changed >= 40, `card4:${r}${s} redraws its index and pips in the ${s === 'C' ? 'Clubs' : 'Diamonds'} ink (${changed} px)`);
        assert.equal(stray, 0, `card4:${r}${s}: every changed pixel is a suit-ink shade swapped for its four-colour twin`);
      }
    }
  }
  // the court motifs drawn in the suit ink follow it (the Queens' and Kings' pips, the Vault King's great diamond, the
  // Chatelaine's tiara); the Jacks' cream pips are not in the ink and stay cream
  const win = K.courtWindow(), inWindow = (id) => { let n = 0; const a = A.bitmap(`card:${id}`), b = A.bitmap(`card4:${id}`); for (let y = 4; y < 51; y++) for (let x = 10; x < 31; x++) if (win.get(x, y) && px(a, x, y) !== px(b, x, y)) n++; return n; };
  for (const id of ['12C', '13C', '12D', '13D']) assert.ok(inWindow(id) >= 10, `card4:${id}: the figure's suit motifs follow the ink (${inWindow(id)} px)`);
  for (const id of ['11C', '11D']) assert.equal(inWindow(id), 0, `card4:${id}: the Jack's cream pip stays cream`);
});

test('colour-coded suits: drawing every four-colour card leaves the two-colour bitmaps as they were', () => {
  const B = load().Art, mods = [{}, ...B.enhancements().map((e) => ({ enhancement: e })), ...B.seals().map((x) => ({ seal: x })), ...B.editions().map((d) => ({ edition: d }))];
  const before = new Map();
  for (const s of SUITS) for (let r = 2; r <= 14; r++) for (const m of mods) { const id = B.card({ rank: r, suit: s, ...m }); before.set(id, Uint8ClampedArray.from(B.bitmap(id).data)); }
  for (const s of SUITS) for (let r = 2; r <= 14; r++) { B.bitmap(`card4:${r}${s}`); for (const m of mods) B.bitmap(B.card({ rank: r, suit: s, ...m, fourColor: true })); }
  for (const [id, bytes] of before) {
    assert.ok(same([...B.bitmap(id).data], [...bytes]), `${id}: the cached two-colour bitmap is untouched`);
    assert.ok(same([...B.render(id).data], [...bytes]), `${id}: and a fresh render draws it the same`);
  }
  // and the two-colour faces are still the ones the first sandbox drew
  for (const s of SUITS) for (let r = 2; r <= 14; r++) assert.ok(same([...B.bitmap(`card:${r}${s}`).data], [...A.bitmap(`card:${r}${s}`).data]), `card:${r}${s}`);
});

test('colour-coded suits: a Spade or a Heart composes as in two colours; a Club or a Diamond keeps its mods', () => {
  for (const m of [...A.enhancements().map((e) => ({ enhancement: e })), ...A.seals().map((x) => ({ seal: x })), ...A.editions().map((d) => ({ edition: d }))]) {
    for (const [r, s] of [[9, 'S'], [12, 'H']]) assert.ok(same([...A.bitmap(A.card({ rank: r, suit: s, ...m, fourColor: true })).data], [...A.bitmap(A.card({ rank: r, suit: s, ...m })).data]), `${r}${s} ${JSON.stringify(m)}`);
    for (const [r, s] of [[9, 'C'], [12, 'D']]) {
      const four = A.bitmap(A.card({ rank: r, suit: s, ...m, fourColor: true }));
      assert.ok(!same([...four.data], [...A.bitmap(A.card({ rank: r, suit: s, ...m })).data]), `${r}${s} ${JSON.stringify(m)} is drawn in the suit's own ink`);
      assert.ok(!same([...four.data], [...A.bitmap(`card4:${r}${s}`).data]), `${r}${s} ${JSON.stringify(m)} still shows the mod`);
    }
  }
});

test('colour-coded suits: Enhancements leave the four-colour index, pips and figures as they are too', () => {
  const stock = K.cardShape().rgba();
  for (const e of A.enhancements()) for (const s of ['C', 'D']) for (let r = 2; r <= 14; r++) {
    const plain = A.bitmap(`card4:${r}${s}`), mod = A.bitmap(A.card({ rank: r, suit: s, enhancement: e, fourColor: true }));
    let touched = 0;
    for (let i = 0; i < plain.data.length; i += 4) {
      const isFace = plain.data[i] !== stock[i] || plain.data[i + 1] !== stock[i + 1] || plain.data[i + 2] !== stock[i + 2] || plain.data[i + 3] !== stock[i + 3];
      if (isFace && (plain.data[i] !== mod.data[i] || plain.data[i + 1] !== mod.data[i + 1] || plain.data[i + 2] !== mod.data[i + 2] || plain.data[i + 3] !== mod.data[i + 3])) touched++;
    }
    assert.equal(touched, 0, `${e} on card4:${r}${s}`);
  }
});

test('colour-coded suits: the four suit inks stay apart for protanopia and deuteranopia as well as full colour', () => {
  // each suit's mean ink colour over its 13 four-colour faces (the pixels drawn in a suit ink), simulated with
  // Machado, Oliveira and Fernandes (2009) at full severity on linear RGB, compared in CIELAB (CIE76)
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const M = {
    normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  };
  const lab = ([r, g, b]) => {
    const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116), c = (v) => Math.max(0, Math.min(1, v));
    [r, g, b] = [r, g, b].map(c);
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  };
  const mean = {};
  for (const s of SUITS) {
    const ink = new Set((s === 'C' || s === 'D' ? K.SUIT_INK4[s] : K.SUIT_RAMP[s]).map(hexKey)), acc = [0, 0, 0];
    let n = 0;
    for (let r = 2; r <= 14; r++) { const bm = A.bitmap(`card4:${r}${s}`); for (let i = 0; i < bm.data.length; i += 4) if (bm.data[i + 3] && ink.has(rgbAt(bm, i))) { for (let k = 0; k < 3; k++) acc[k] += lin(bm.data[i + k]); n++; } }
    mean[s] = acc.map((v) => v / n);
  }
  for (const [kind, m] of Object.entries(M)) {
    const L = Object.fromEntries(SUITS.map((s) => [s, lab(m.map((row) => row[0] * mean[s][0] + row[1] * mean[s][1] + row[2] * mean[s][2]))]));
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const d = Math.hypot(...L[SUITS[i]].map((v, k) => v - L[SUITS[j]][k]));
      assert.ok(d >= 20, `${kind}: ${SUITS[i]} and ${SUITS[j]} are ${d.toFixed(1)} apart (want 20 or more)`);
    }
  }
});

test('Editions each change the composed card in their own way; backs and stakes are all different', () => {
  const ids = A.editions().map((d) => A.card({ rank: 7, suit: 'D', edition: d }));
  const plain = A.bitmap('card:7D').data;
  ids.forEach((id) => assert.ok(!same([...A.bitmap(id).data], [...plain]), `${id} changes the card`));
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) assert.ok(!same([...A.bitmap(ids[i]).data], [...A.bitmap(ids[j]).data]));
  for (const prefix of ['back:', 'stake:']) {
    const all = A.ids(prefix).map((id) => [...A.bitmap(id).data]);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(!same(all[i], all[j]), `${prefix} sprites ${i} and ${j} differ`);
  }
});

// Added in the final pass (2026-11-24): the UI masked Sheen's sweep with the face's own luminance, which let about a
// third of the band onto red pips and the index (measured on the running game: pips inside the band gained ~21 levels,
// the cream stock ~2). TW.Art.stockMask gives the bare stock as a mask: white on plain stock, clear on everything else.
test('stockMask: white on the bare stock of a composed card, clear on its ink edge, index, pips, court, Enhancement marks and Seal', () => {
  const stock = K.cardShape().rgba(), W = 41, H = 55;
  const inStock = (x, y) => x >= 0 && y >= 0 && x < W && y < H && stock[(y * W + x) * 4 + 3] === 255;
  const edge = (i) => { const x = (i / 4) % W, y = Math.floor(i / 4 / W); return !inStock(x + 1, y) || !inStock(x - 1, y) || !inStock(x, y + 1) || !inStock(x, y - 1); };
  const isFace = (plain, i) => plain.data[i] !== stock[i] || plain.data[i + 1] !== stock[i + 1] || plain.data[i + 2] !== stock[i + 2] || plain.data[i + 3] !== stock[i + 3];
  // no Enhancement or Seal: the mask is the stock inside its ink edge, minus the face (a court's figure has a few
  // pixels drawn in the stock's own cream; they are face too, so they stay clear although they look like stock)
  for (const four of [false, true]) for (const s of SUITS) for (let r = 2; r <= 14; r++) {
    const id = A.card({ rank: r, suit: s, edition: 'gloss', fourColor: four });
    const mid = A.stockMask(id);
    assert.equal(mid, `mask:${id}`);
    const m = A.bitmap(mid), plain = A.bitmap(`${four ? 'card4' : 'card'}:${r}${s}`);
    let extra = 0, missing = 0, open = 0;
    for (let i = 0; i < m.data.length; i += 4) {
      const want = stock[i + 3] === 255 && !edge(i) && !isFace(plain, i), on = m.data[i + 3] === 255;
      if (m.data[i + 3] && !on) extra++;
      if (on) { open++; if (!want) extra++; } else if (want) missing++;
    }
    assert.equal(extra, 0, `${mid} is open only on the stock inside its ink edge, never on the face`);
    // a number card or an Ace: exactly; a court: up to 60 px of its figure drawn in the stock's cream (43 at most today)
    assert.ok(r >= 11 && r <= 13 ? missing <= 60 : missing === 0, `${mid} covers the bare stock (${missing} px left clear)`);
    assert.ok(open > 700, `${mid} leaves the sweep room on the stock (${open} px)`);
  }
  // with each Enhancement and each Seal: never open on a face pixel or on the Seal
  for (const e of A.enhancements()) for (const seal of A.seals()) for (const [r, s] of [[10, 'H'], [12, 'C'], [14, 'S']]) {
    const id = A.card({ rank: r, suit: s, enhancement: e, seal, edition: 'gloss' });
    const m = A.bitmap(A.stockMask(id)), plain = A.bitmap(`card:${r}${s}`), sb = A.bitmap(`seal:${seal}`), at = A.meta(`seal:${seal}`).at;
    let onFace = 0, onSeal = 0, open = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const i = (y * m.w + x) * 4;
      if (m.data[i + 3] !== 255) continue;
      open++;
      if (isFace(plain, i)) onFace++;
      const sx = x - at[0], sy = y - at[1];
      if (sx >= 0 && sy >= 0 && sx < sb.w && sy < sb.h && sb.data[(sy * sb.w + sx) * 4 + 3]) onSeal++;
    }
    assert.equal(onFace, 0, `${id}: the mask is clear on the index, pips and court`);
    assert.equal(onSeal, 0, `${id}: the mask is clear on the Seal`);
    assert.ok(open > 300, `${id}: some stock is left for the sweep (${open} px)`);
  }
  assert.equal(A.stockMask('joker:jinglejester'), null, 'a Joker has no stock mask');
  assert.equal(A.stockMask(null), null);
  assert.equal(A.stockMask('card:10H|||gloss'), A.stockMask('card:10H|||gloss'), 'registered once, then reused');
});
