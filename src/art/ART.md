# Wickwager art: how to add a sprite

`src/art/00-core.js` creates `TW.Art`. It holds the Ember Lit drawing kit and a sprite registry. The kit is ported from `mockups/ember-lit/art.js` with its behaviour unchanged. The content files after it register sprites under content ids. Every sprite the Lit mockup drew is seeded here and is byte-identical to Lit. ARCH.md §4 is the contract; this page is the how-to.

- **Load order:** `src/content.js`, then `src/art/*.js` in name order, then the engine and the UI. Every file is an IIFE that reads `globalThis.TW.Art`.
- **DOM-free:** the kit and every `make`/`draw` work on bitmaps and run in Node. Only `TW.Art.url(id)` touches the DOM, and it returns `null` when there is no `document`. Never use `document`, `window`, a canvas or `Math.random` in an art file.
- **Lazy:** registering a sprite draws nothing. Pixels are made the first time someone asks for them, then cached. Don't ask for bitmaps while the files are still loading; there is no need. (A court replaced later is redrawn anyway, with every composition of it.)
- **One script:** the build puts every file in one `<script>`, so an exception thrown while a file loads (a duplicate id, a bad spec) stops the whole game, engine and UI included. Run `node --test tests/art.test.mjs` before you finish. A `make` that throws later only loses its own sprite: `url()` returns `null` (logged once, never redrawn on the next call) and the UI shows a placeholder. The error names the sprite: `TW.Art: "joker:tindrum" failed to draw: …`.
- **Determinism:** the same id always gives the same bytes. Texture and specks come from `kit.rng(seedString)`.
- **Read-only:** the kit is frozen all the way down (ramps, glyphs, pip layouts, the light vector, and the `Bmp` and `Mask` methods). Copy before you change anything (`R.pink.slice().reverse()`, `{ ...FLAME_KEY, w: … }`); an in-place write throws. Bitmaps from `bitmap()` are shared too (see §1).

## 1. The registry (ARCH §4)

```js
TW.Art.define(id, { w, h, make: (kit) => Bmp })   // lazy; make() runs once, then cached. Throws on a duplicate id.
TW.Art.has(id) → boolean
TW.Art.ids(prefix?) → string[]                     // definition order
TW.Art.bitmap(id) → { w, h, data: Uint8ClampedArray } | null   // RGBA, 1:1, frozen and shared: never write to data
TW.Art.url(id) → 'data:image/png;base64,…' | null  // browser only, cached (a failure too)
TW.Art.card({ rank, suit, enhancement, seal, edition }) → 'card:{rank}{suit}|{enh}|{seal}|{edition}'
TW.Art.card({ rank, suit, enhancement, seal, edition, fourColor: true }) → 'card4:{rank}{suit}|{enh}|{seal}|{edition}'   // colour-coded suits (§11)
TW.Art.kit                                         // the drawing kit (frozen all the way down)
TW.Art.warm(ids | prefix, { budget }) → Promise<number>   // draw and encode ahead of need, in idle time
```

`bitmap()` returns the cached record itself, frozen, to every caller (a plain composed card even shares its face's record, so both get one PNG). A typed array cannot be frozen, so the rule is yours: never write to `data`; copy it (`Uint8ClampedArray.from(bm.data)`) if you need to change pixels. A `{ w, h, data }` that `make` returns is copied when it is cached, so its producer can't change the sprite later.

**Warming.** The first `url()` of a sprite draws it and encodes a PNG: about 1 to 5 ms on a desktop, several times that on a mid-range phone, so a fresh hand or a Shop full of new sprites can drop frames. `TW.Art.warm(list)` does that work in idle time (`requestIdleCallback`, else `setTimeout`), at most `budget` ms per slice (default 10), and resolves with the number warmed (0 at once in Node, or when everything is cached). The UI should warm the 52 faces and the run's back at boot (`warm('card:')` also covers composed cards already registered, and `warm('card4:')` does the same for colour-coded suits), then the next Shop's items while a Blind is played.

Also on `TW.Art`:

| Call | What it does |
| --- | --- |
| `meta(id)` | `{ id, kind, w, h, temp, … }` or `null`. `temp` is true for placeholder art (a temporary court, or a sprite registered with `temp: true`). For a Seal, `at` is its spot (a frozen array). |
| `render(id)` | A fresh render that skips the cache (tests and tools). |
| `warm(ids \| prefix, { budget })` | Draws and encodes sprites in idle time, ahead of need (above). |
| `num(text, size = 'S', style = 'cream')` | Registers the Ember digit face on demand and returns its id, `num:{size}:{style}:{text}`. Sizes: S, L, XL, XXL. Styles: `kit.TEXT` (cream, score, chips, mult, money, coin, ember, pink, lime, blue, red, total, soft). |
| `shard(ramp, w, h, kind?)` | A payout shard on demand: `fx:shard:{ramp}:{w}x{h}:{kind}`. `kind` is `''`, `'diag'` or `'anti'`. |
| `stockMask(cardId)` | The bare stock of a composed playing card, on demand: `mask:{cardId}`, 41×55, white where the card (without its Edition) shows its plain stock, clear on the index, pips, Ace mark, court, an Enhancement's marks and the Seal. The UI masks the Sheen sweep and the Dither hum with it (§11). `null` for an id that is not a playing card. Added in the final pass (2026-11-24): the face's own luminance let about a third of the sweep onto red pips. |
| `enhancements()`, `seals()`, `editions()` | The ids of the card mods registered so far. |
| `courts()` | `[{ id, rank, suit, temp }]` for every registered court. |
| `TABLES` | Sprite prefix → `TW.Content` table (`joker: 'JOKERS'`, `back: 'DECKS'` and so on). |
| `lib` | A plain object for helpers shared between content files (the kit itself is frozen). |

`make` may return a kit `Bmp` or `{ w, h, data }`. The size it draws must equal the declared `w × h`, or `bitmap()` throws. A helper's `draw` must return a kit `Bmp` no bigger than its window (31 × 31 for Jokers, Vouchers and consumables), or the sprite fails to draw with that reason instead of being cropped without a word.

## 2. Sprite ids and sizes

| Id | Size (art px) | Registered by |
| --- | --- | --- |
| `card:{rank}{suit}` | 41×55 | `TW.Art.cardFace(rank, suit)` in 10-cards.js; rank 2–14, suit S/H/C/D, e.g. `card:14H` |
| `card:{rank}{suit}\|{enh}\|{seal}\|{edition}` | 41×55 | `TW.Art.card()`, on demand. A part with no art registered is left out of the id and the picture; when `TW.Content` knows that mod, the console says so once (`art-coverage` and the gallery's missing list name its badge too). |
| `card4:{rank}{suit}` | 41×55 | Colour-coded suits (§11): `cardFace(rank, suit, true)` in 10-cards.js registers all 52. Clubs and Diamonds in their own inks; a Spade or a Heart shares its `card:` picture. |
| `card4:{rank}{suit}\|{enh}\|{seal}\|{edition}` | 41×55 | `TW.Art.card({ …, fourColor: true })`, on demand, the same parts as `card:` |
| `back:{deckId}` | 41×55 | `back()` |
| `joker:{id}` | 41×55 | `joker()`: rarity frame, gems, art window and an empty name plate |
| `tarot:{id}`, `planet:{id}`, `spectral:{id}` | 41×55 | `tarot()`, `planet()`, `spectral()`: frame, window and an empty plate |
| `voucher:{id}` | 41×55 | `voucher()`: a cream ticket stub with bitten sides, a tear line and an empty plate |
| `pack:{kind}{size}` | 41×55 | `pack(kind, …)` defines `normal`, `jumbo` and `mega`, e.g. `pack:cardjumbo` |
| `tag:{id}` | 17×17 | `tag()` |
| `blind:small`, `blind:big` | 17×20, 17×28 | `define()` in 30-run.js (the candle's wax and dish; the flame is `ui:flame`) |
| `boss:{id}` | ≤ 31×31 | `boss()` |
| `stake:{id}` | 15×15 | `stake()` |
| `enh:{id}`, `seal:{id}`, `edition:{id}` | ≤ 17×17 | the badges of `enhancement()`, `seal()`, `edition()` |
| `icon:{name}`, `icon:{name}:light` | 9×9 | the core: ink `#2B1220` and the table's light `#FFE6CC`. Names: info, options, replay, deck, sell, use, lock, close, back, sound, music, speed, check, plus, minus, arrow-left, arrow-right |
| `ui:{piece}` | varies | the core, see §6 |
| `num:…`, `fx:shard:…` | varies | on demand, see §1 |
| `mask:card:…`, `mask:card4:…` | 41×55 | `stockMask(cardId)`, on demand, see §1 (a mask, not a picture: white and clear only) |

The name plate on Jokers, consumables and Vouchers is at x 3–37, y 41–51 (ink rim, dark fill). The UI sets the name as text over it at x 4–36, y 42–50. Never draw a name into a sprite.

## 3. How to add each kind

Every helper takes the content id and a spec, and returns the sprite id(s). A content file looks like this (the examples below assume `A` and `kit`):

```js
(() => {
  'use strict';
  const A = globalThis.TW.Art, kit = A.kit;
  A.joker('tindrum', { /* … */ });
})();
```

 Each item draws only its own illustration; the frame comes from the core. A `draw` gets `(kit, ctx)` and returns a `kit.Bmp`. Any spec may carry `temp: true` to mark placeholder art: the gallery shows it with a dashed outline and `art-coverage --strict` counts it as missing.

### Joker: `joker(id, spec)` → `joker:{id}`

The same shape as Lit's `JOKER_ART`. `ground` is 4 colours, dark to light, drawn in four bands lit from the top. `glow` is `[x, y, r]` for the pool of light behind the figure (default `[15, 15, 12]`). `speck` lists the colours of 16 seeded specks. `draw` returns the 31×31 figure; the core inks its outline (`outline: false` turns that off). Rarity comes from the `TW.Content.JOKERS` row, then `spec.rarity`, then common. `seed` overrides the speck seed (the default is the id). `overlay(kit, b, ctx)` may draw over the whole card afterwards.

```js
A.joker('tindrum', {
  ground: ['#5A1A41', '#6A2048', '#7A2850', '#8A3058'], glow: [15, 17, 12], speck: [kit.R.money[5], kit.C.white],
  draw(k) {
    const f = new k.Bmp(31, 31);
    f.blit(k.emboss(k.ellipse(31, 31, 15, 18, 10, 7), k.R.mult, { cap: 3, base: 5, gain: 4 }), 0, 0);
    return f;
  },
});
```

### Tarot, Planet, Spectral: `tarot(id, spec)`, `planet(id, spec)`, `spectral(id, spec)`

`draw` returns the 31×31 illustration in window coordinates (the window's top-left is card pixel (5, 7)). It is clipped to the window's shape: the Tarot arch, the Planet porthole (radius 14.3 round card pixel (20, 22), window pixel (15, 15)) or the Spectral rectangle. The frame brings the night sky, stars, the sun-eye, the dotted orbit, the wavering ghost border and the plate. Tarot and Spectral figures are outlined by the core. Planet figures are not: draw the world with its own ink, as Cinderon does. `overlay(kit, b, ctx)` draws over the whole card.

```js
A.tarot('inkpot', { draw(k) { const f = new k.Bmp(31, 31); f.rect(10, 12, 11, 14, k.R.wood[4]); return f; } });
A.planet('blip', { draw(k) { const f = new k.Bmp(31, 31), s = k.sphere(5, k.R.lime); const o = new k.Bmp(s.w + 2, s.h + 2); o.blit(s, 1, 1); o.outline(k.C.edge); f.blit(o, 9, 9); return f; } });
A.spectral('curtaincall', { draw(k) { const f = new k.Bmp(31, 31); f.rect(4, 3, 23, 24, k.R.mult[3]); return f; } });
```

### Voucher: `voucher(id, spec)` → `voucher:{id}`

A cream ticket stub: round bites 2 px deep down both long sides (at y 10, 19, 28, 40 and 48), a gold punch hole at the top, the 31×31 art window at (5, 7), a perforated tear line across the stub at y 40 (between the window's lip and the plate, a bite at each end) and a dark plate at (3, 41). The bites and the tear line keep it from reading as a common Joker's peach frame. The window works like a Joker's. `ground` defaults to a warm maroon (`kit.VOUCHER_GROUND`), `speck` to cream and gold, and `glow` and `seed` are optional.

```js
A.voucher('skyatlas', { ground: ['#08091F', '#0E1130', '#141844', '#1B2058'], draw(k) { const f = new k.Bmp(31, 31); f.rect(5, 8, 21, 15, k.R.night[5]); return f; } });
```

### Booster Pack: `pack(kind, spec)` → `pack:{kind}normal`, `pack:{kind}jumbo`, `pack:{kind}mega`

A sliding matchbox in the kind's `ramp` (dark to light), with the tray peeking out on top, a burnt-orange striker strip and a cream label. `label(kit, { kind, size })` returns the label picture, up to 19×19, centred in a 19×19 area that is the same on every size. The core draws the size marks: Jumbo is one thick box with its side showing and a gold band, Mega is two boxes tied with gold twine and a gold star at the knot. `labelGround` changes the label's cream.

```js
A.pack('planet', { ramp: kit.R.night, label(k) { const s = k.sphere(6, k.R.ember); const f = new k.Bmp(15, 15); f.blit(s, 1, 1); f.outline(k.C.edge); return f; } });
```

The kinds are `card`, `tarot`, `planet`, `joker` and `ghost`. The added ramps `kit.R.maroon` (Joker Pack) and `kit.R.navy` (Ghost Pack) are there for these packs.

### Tag: `tag(id, spec)` → `tag:{id}`

A round brass token, 17×17: an ink edge, a 2-px brass rim lit like a coin, and an 11×11 round enamel field with a shadow along its top left. `ground` lists the enamel's colours, top to bottom. `draw` returns the picture, up to 11×11; it is centred and clipped to the field. Set `outline: true` to ink it.

```js
A.tag('piggybank', { ground: ['#40173F', '#2C1535'], draw(k) { const f = new k.Bmp(9, 7); f.blit(k.emboss(k.ellipse(9, 7, 4, 3, 4, 3), k.R.pink, { cap: 2 }), 0, 0); return f; } });
```

### Boss Blind: `boss(id, spec)` → `boss:{id}`

Each Boss is its own emblem, at most 31×31. `w` and `h` give the final size. With the default `outline: true`, `draw` returns `(w − 2) × (h − 2)` and the core inks it, as Lit did for The Smudge (29×25 drawn, 31×27 shown). With `outline: false`, `draw` returns `w × h`.

```js
A.boss('lid', { w: 31, h: 25, draw(k) { const f = new k.Bmp(29, 23); f.blit(k.emboss(k.roundRect(29, 23, 2, 4, 26, 12, 3), k.R.gold, { cap: 2 }), 0, 0); return f; } });
```

### Stake: `stake(id, spec)` → `stake:{id}`

A round chip, 15×15: a smooth rim in the stake's own `rim` ramp, lit like a coin, with no spots or dashes (not a casino chip). Inside it is a 9×9 round face. `ground` lists the face's sky colours, top to bottom. `draw` is optional and returns up to 9×9, centred and clipped.

```js
A.stake('sunny', { rim: kit.R.peach, ground: ['#C65A26', '#922B35', '#5A1A41', '#40173F'], draw(k) { return new k.Bmp(9, 9).set(6, 2, k.R.gold[5]); } });
```

### Deck back: `back(deckId, spec)` → `back:{deckId}`

The core draws the cream card stock, a field inside an inset frame (x 4–36, y 4–50) and the frame itself: ink, a dark lip on top (`lipTop`) and a lit lip below (`lip`). The field is Lit's mirrored bands from `bands` (7 colours; default `kit.C.bands`) in `order`, or any `field(x, y)` → colour. Then `draw(kit, b, ctx)` draws the deck's medallion on the whole 41×55 card. The kit helps with `lozenge(b, cx, cy, o)`, `cornerStars(b, o)` and Lit's whole `backMedallion(b)`.

```js
A.back('sketchbook', { bands: ['#1E0B42', '#2E1160', '#3E1880', '#5320A0', '#6F33C9', '#8B46EE', '#AC7BFF'], draw(k, b) { k.lozenge(b); k.cornerStars(b); } });
```

### Court figure: `court(rank, suit, spec)` (for `card:11..13{suit}`)

`rank` is 11, 12 or 13 (`'J'`, `'Q'`, `'K'` work too). `figure(kit, ctx)` returns the figure, up to 19×45 and not yet outlined. `ctx` is `{ rank, suit, who: 'J' | 'Q' | 'K', robe, people }`, where `robe` is `kit.ROBE[suit]` (ramp, ground, dot) and `people` is `kit.PEOPLE[who]` (skin, hair, mouth, blush). The core draws the index, the arched window (x 9–31, y 3–51) over the pale `ground` with its `dot` speckle, inks the figure and places it at (10, 4) (`at` moves it, `outline: false` skips the ink). It clips the figure to the window, then re-inks the frame. `over(kit, b, ctx)` draws afterwards.

Lit's people are in the kit: `HEAD`, `body(who, suit)`, `headKey(who, robe)` and `courtFigure(who, suit)`. The face sprites look their court up when they are first drawn, so a court can be registered from any file, in any order:
- a court registered with `temp: true` may be replaced by a later `court()` call, and is redrawn with every composition of it;
- a finished court may not be replaced (`court()` throws "already drawn"; edit the file that drew it);
- a `temp: true` court registered after a finished one is ignored, so a placeholder never displaces a finished figure, whichever file loads first;
- a court nobody registers falls back to Lit's own person for that rank in the suit's robe (`courtFigure`), flagged `temp`, so the game never shows a blank figure while the gallery and `art-coverage --strict` still flag it.

```js
A.court(11, 'C', { figure: (k, ctx) => k.courtFigure(ctx.who, ctx.suit) });  // Lit's Jack in a Clubs robe
```

All twelve courts are drawn in 10-cards.js (§11), so none is temporary and no later file can replace one. `tempFigure` (a faceless mannequin with a `?` for a face) stays in the kit for tests and for a file that wants an obvious stand-in.

### Card mods: `enhancement(id, spec)`, `seal(id, spec)`, `edition(id, spec)`

Every mod has a badge for tooltips and the collection: `badge(kit)` returns a `Bmp` of the declared `w × h` (at most 17×17). This registers `enh:{id}`, `seal:{id}` or `edition:{id}`. A composed card draws in this order:

1. **Stock**: `enhancement.stock(kit, ctx)` → a 41×55 card body (default `kit.cardShape()`, cream).
2. **Face**: the index and pips, the Ace mark or the court, drawn on a transparent layer and laid on the stock.
3. **Enhancement overlay**: `enhancement.over(kit, b, ctx)`. `ctx.face` is the face layer, so you can recolour only the pips or only the stock.
4. **Edition**: `edition.apply(kit, b, ctx)` bakes its pixels and may return a new 41×55 `Bmp`. Moving light (sweeps, shimmer, a slip) is CSS class `ed-{id}`, owned by the UI.
5. **Seal**: by default the badge is stamped at the Seal spot: its right edge at x 38, its top 4 px above the card, clipped to the card (`at: [x, y]` moves it; `draw(kit, b, ctx)` replaces the stamp). The spot is in `TW.Art.meta('seal:{id}').at`, so the UI can lay the badge over the card to show the part that sticks up above the top edge, as Lit did.

`ctx` is `{ rank, suit, who, enhancement, seal, edition, fourColor, face }`. `fourColor` is true when the card is drawn for colour-coded suits (§11); `face` is then already in the four-colour inks.

```js
A.enhancement('example', {
  w: 11, h: 15, badge: (k) => k.miniCard(),
  // a wax drip off the top edge, on the plain stock, stopping where the face begins
  over: (k, b, ctx) => { for (let y = 1; y < 8 && !ctx.face.get(30, y); y++) b.set(30, y, k.R.chips[6]); },
});
A.seal('example', { w: 9, h: 15, badge: (k) => new k.Bmp(9, 15).rect(1, 1, 7, 13, k.R.pink[5]).outline(k.C.edge) });
A.edition('example', { w: 11, h: 15, badge: (k) => k.miniCard(), apply: (k, b, ctx) => { const o = b.clone(); if (!ctx.face.get(20, 27)) o.mix(20, 27, '#FFFFFF80'); return o; } });
```

All eight Enhancements, four Seals and four Editions are drawn in 10-cards.js. §11 lists them and says what the UI adds to each.

### Anything else: `define(id, spec)`

```js
A.define('blind:small', { w: 17, h: 20, make: (k) => k.candleWax(false) });
```

## 4. The kit (`TW.Art.kit`)

Everything from Lit's `art.js`, the canvas parts removed, plus the new frames:

- **Palette:** `C` (named colours), `R` (ramps), `TEXT` (digit styles), `LIGHT` (the light vector).
- **Bitmaps:** `Bmp(w, h)` with `set get del rect draw(grid, x, y, key) line blit(src, x, y, { flipX, flipY, clip }) outline(col, diag) mask recolor`. The game adds `mix(x, y, '#RRGGBBAA')` (alpha over), `clone()` and `rgba()`. Also `Mask(w, h)` with `Mask.fn`, `Mask.rows`, `or`, `sub`, `and`, `flipX`, `flipY`. And `grid`, `hexRGBA`, `blendHex`.
- **Shading:** `emboss(mask, ramp, { cap, base, gain, depth, tilt })` shades a mask like a soft pillow lit from the upper left. `sphere(r, ramp, { lo, k, band })`. Masks: `disc(r)`, `ellipse(w, h, cx, cy, rx, ry)`, `roundRect(w, h, x0, y0, x1, y1, r, t)`, `strokeQuad(w, h, p0, p1, p2, width | t → width)`. Also `shade(hex, factor)` and `rng(seedString)`.
- **Digits:** `textBmp(str, size, style)` and `num` (the same), `textSize`, `epx`, `GLYPH_S`, `GLYPH_L`, `FONTS`.
- **Cards:** `CW` = 41, `CH` = 55, `cardMask`, `cardShape({ face, hi, shade, lip, ol, mask })`, `drawIndex`, `pipBmp(suit, 5 | 7, flip)`, `bigPipMask`, `PIP5`, `PIP7`, `SUIT_RAMP`, `SUIT_INK4` and `fourColorFace(b, suit)` (colour-coded suits, §11), `numberFace`, `numberCard`, `aceFace`, `aceCard`, `courtWindow`, `courtFace`, `faceCard`, `tempFigure`, `miniMask`, `miniCard({ w, h, face, … })` (an 11×15 card for badges).
- **Courts:** `HEAD`, `ROBE`, `PEOPLE`, `COURT_WHO`, `headKey`, `body`, `courtFigure`.
- **Backs:** `backBase`, `lozenge`, `cornerStars`, `backMedallion`, `cardBack`, `BAND_ORDER`.
- **Frames:** `RARITY` (common, uncommon, rare, legendary), `frameCard(ramp, { win, plate, plateLine, mask })`, `gems(b, n, ramp)`, `legendaryFrame` (a deep violet body, an ember bevel round the window and plate that matches its ember gems, so the top rarity never reads as a darker Tarot), `artWindow`, `jokerCard`, `tarotFrame`, `planetFrame`, `spectralFrame` (each returns `{ b, clip }`), `consumableCard`, `voucherFrame`, `voucherMask`, `voucherCard`, `matchbox`, `packCard`, `PACK_LABEL`, `roundMask(w, h, 9 | 11 | 15 | 17, x0, y0)`, `litRim`, `roundToken`, `tagToken`, `stakeChip`.
- **Pieces:** `candleWax(tall)`, `FLAME_KEY`, `flameFrames()`, `flameStrip()`, `encoreRibbon()`, `glitchFringe(bmp, { mask, regions })`, `bakeFringe(bmp, { face, mask })` (pass an Edition's `ctx.face`: the fringe then follows the index and pips on any stock, never a darker stock itself; pass `mask: b.mask()` so it follows the card's own silhouette, as the Glitch does, and never lands in a cut such as Vintage's dog-ear).
- **Chrome:** `panel(o)`, `lipPanel(o)`, `pill(ramp)`, `button(ramp, pressed)`, `slot()`, `shard(ramp, w, h, kind)`, `ICONS`, `icon(name, colour)`, `PLUM_BTN`.

## 5. Palette and ramps

Every ramp runs dark to light and is hue-shifted: shadows lean toward plum and red, highlights toward warm white. Pick shades by position from the light end (`ramp[n - 2]` is a highlight, `ramp[n - 4]` a face, `ramp[n - 6]` a lip), as `frameCard`, `pill` and `button` do.

| Ramp | Shades | Job |
| --- | --- | --- |
| `cream` | 8 | Card stock, ruffs, wax, labels. Base `#FFF3E0`. |
| `chips` | 9 | Chips blue (`#4A62FF`): Planet frames, chip things |
| `mult` | 9 | Mult red (`#E9382B`) |
| `money` | 9 | Yellow `#FFCE3B`. Cash in the UI is flat yellow with one amber rim, never a gold ramp. |
| `lime` | 9 | Uncommon, the Blind score |
| `pink` | 9 | Jokers, Discard, the Encore ribbon, Rare |
| `ember` | 9 | Burnt orange `#FF7A2B`: flames, Play hand, Legendary gems and bevel, striker strips |
| `vio` | 9 | Violet `#8B46EE`: Tarot, consumables, Legendary, the boss panel |
| `acid` | 7 | Acid green `#CFFF2F`: Boss eyes and highlights |
| `peach` | 8 | Common frame |
| `red`, `dark` | 7 | Suit inks: Hearts and Diamonds; Spades and Clubs. With colour-coded suits Clubs take `lime` and Diamonds `chips` (`kit.SUIT_INK4`, §11). |
| `wood`, `steel`, `ghost`, `night`, `plum`, `gold` | 6–8 | Ladders and shoes; blades; wisps and Spectral; Planet skies; ink, plum and robes; crowns, bells and grommets (never money) |
| `brass`, `maroon`, `navy` | 7–8 | Added for the game: Tag tokens, the Joker Pack and plates, the Ghost Pack |

- **Ink edge:** `C.edge` `#2B1220`, 1 art px, round every figure and part. Never pure black.
- **Ground bands** (`C.bands`, top to bottom): `#2C1535 #40173F #5A1A41 #761F3C #922B35 #AE402C #C65A26`.

## 6. Chrome for the UI (`ui:*`)

These are Lit's `frames()` under the CSS names Lit used (`--f-{name}`). They are 9-slices for `border-image`:

| Id | Size | Slice (as in lit.css) |
| --- | --- | --- |
| `ui:panel`, `ui:panel-warm`, `ui:panel-deep`, `ui:panel-rack`, `ui:tip`, `ui:plaque`, `ui:dialog`, `ui:boss`, `ui:btn-ghost` | 9×9 | `4 fill / calc(4 * var(--px))` |
| `ui:well`, `ui:chips`, `ui:mult` (opaque wells) | 9×9 | `4 fill / calc(4 * var(--px))` |
| `ui:pill-{ramp}` | 7×7 | `3 fill / calc(3 * var(--px))` |
| `ui:btn-{ramp}`, `ui:btn-{ramp}-down` | 9×10 | `4 4 5 fill / calc(4 * var(--px)) calc(4 * var(--px)) calc(5 * var(--px))` |
| `ui:slot` | 41×55 | an empty card slot (shown whole) |
| `ui:flame` | 21×10 | the candle flame: three 7×10 frames in a strip, stepped by CSS as Lit does (`background-position` 0 to −14 art px, `steps(3, jump-none)`, 0.9 s) |

The ramps are `ember`, `pink`, `cream`, `yellow`, `plum` (Lit's buttons; yellow is for the sort toggle only, and plum is the disabled button), plus `lime`, `vio`, `blue` and `red`. Pills come in every ramp.

Glow, bloom, rings, light pools and shadows are CSS layers, not sprites (ARCH §2). Lit's `glowCanvas`, `lightCanvas` and `ringURL` were DOM canvases, so they are not in the kit.

**For the UI:**
- **Glitch Edition** (`ed-fourcolor`): the composed card holds the fringe inside its silhouette. Lit's plates 1 px beyond the card's left and right edges are two drop shadows: `filter: drop-shadow(calc(-1 * var(--px)) 0 0 #FF2E4AE0) drop-shadow(var(--px) 0 0 #4A62FFE0)`. Together they match Lit exactly. Lit's slip (two bands shift for about 150 ms every 3.4 s) is CSS too.
- **Encore and other Seals:** the composed card is clipped at its top edge. To show the 4 px that stick up above it, as Lit did, lay the `seal:{id}` badge over the card at `meta.at` (in art px from the card's top-left).
- **Candle tokens:** set `ui:flame` over the wick of `blind:small` or `blind:big` (a 7×10 wick box centred on the candle, sitting 1 art px into the wax).

## 7. Style rules (from Lit's NOTES.md)

- Light comes from the upper left and a little in front, the same for every sprite. Lit edges facing up-left, shade the lower right. `emboss` and `sphere` do it for you.
- Use ramps of 6–9 hue-shifted shades and pick from them; don't invent one-off colours mid-sprite.
- A 1-art-px ink edge (`#2B1220`) goes round every figure. The core outlines Joker, Tarot, Spectral and Voucher figures for you; inside a figure, separate parts with ink where they meet.
- **Art windows:** four ground bands lit from the top, a two-step pool of light behind the figure, and a few seeded specks. The figure stands in front, centred on the pool.
- **Silhouettes must read at 2 CSS px per art px** (the phone scale). Check your sprite at `gallery.html?scale=2`: if you can't tell what it is from its outline and two or three colour masses, simplify. Avoid lone single pixels of detail, and keep important features at least 2 px wide.
- Crisp pixels only. No smoothing, no anti-aliasing, no rotated sprites; every sprite is shown at one whole-number scale. Diagonals are stepped by hand or with `line`/`strokeQuad`.
- Card corners step 4-2-1-1, panels 3-1-1, pills 2-1.
- No text in sprites except the Ember digits and the rank glyphs. Names are set by the UI.
- Keep it warm: plum, maroon and burnt orange, cream cards, candlelight. Gold is for crowns, bells and grommets, never coded as money.

## 8. File plan

| File | Owner | What |
| --- | --- | --- |
| `00-core.js` | art-core | Kit, registry, frames, chrome, icons. Other agents don't edit it; ask in `REQUESTS.md`. |
| `10-cards.js` | cards | The 52 faces, courts, deck backs, Enhancements, Seals, Editions |
| `20-consumables.js` | consumables | Tarot, Planet, Spectral |
| `30-run.js` | run | Blinds, Boss Blinds, Vouchers, Tags, Booster Packs, Stakes |
| `40-jokers-lit.js` | art-core (seed) | The Paperclip and Coupon Clipper (Lit's, pixel-identical: leave as is), and the Jingle Jester, redrawn in the final pass (2026-11-24) as a candle-world bell-ringer; Lit's capped jester stays in the file behind its one-line switch, `const JINGLE_JESTER_STYLE = 'candle'; // or 'classic'` (§9) |
| `41-jokers-*.js` … `44-jokers-*.js` | jokers | The other 117 Jokers, in content-plan order: 41 commons 1–30, 42 commons 31–60, 43 uncommons, 44 rares and legendaries |

Files may be split further (`11-mods.js`, `31-bosses.js` and so on); names set the load order. Content ids are stable; register under the ids in `content/content-plan.json`, never under display names.

## 9. Originality line for art

Every sprite is the game's own, and nothing may resemble another game's art (`ORIGINALITY.local.md` has the full rules):
- no copies or near-copies of another game's card faces, court figures, Joker art, deck backs or stake chips;
- the Seals are ours: a pink ribbon, a paper price tag, a navy pennant and a pearl-and-maroon cameo at the top edge, never a wax blob or a round disc, and no Seal is gold, which reads as a coin;
- the Editions are ours: a pixel fringe, a dither, a warm sheen in one corner and a pale ghost card, never darker than the table;
- an Enhancement changes the card with an object or a treatment (wax, fire, gilding, a mask, light, age, creases), never by turning the whole stock one suit or chip colour, and gold is never money;
- no filter over the scene and no hard drop shadow under lettering; the room behind the sprites is DESIGN.md's.

Also no harlequin diamonds or commedia masks. Our jesters wear belled caps and ruffs; a mask, where a brief asks for one, is a gold masquerade mask, never a commedia half-mask. When an idea starts to look like a stock jester (a plain grinning jester face, a red-and-blue harlequin), change the composition, not just the colours.

The Jingle Jester is the worked example. Lit's drawing (a grinning face under a three-pointed bell cap in lime, pink and blue, a ruff) was the one Joker two reviews found drifting toward a stock jester and the harlequin look, so it was redrawn as a figure from the candle world: one of the table's own candles come alive (cream wax lit from the left, pink wax over the rim, Lit's table flame, the Blind candles' pink dish), winking and ringing a big gold handbell held up on a wooden grip, the ring drawn as un-inked gold strokes. It has no cap, ruff or mask and none of the cap's lime or chip blue; the bell carries "jingle". Setting `JINGLE_JESTER_STYLE` to `'classic'` brings Lit's drawing back, byte-identical; `tests/art.test.mjs` checks both settings.

## 10. Checking your work

- `node --test tests/art.test.mjs` must always pass. It checks:
  - every registered sprite renders at its declared size, isn't empty and is deterministic; ids are unique;
  - **coverage:** every id `TW.Content` names has a finished (not `temp`) sprite, as ARCH §4 asks;
  - **Lit fidelity:** every sprite Lit drew (the number cards and Aces, Lit's three court people, the kit's Lit figure for all twelve courts, the Glitch fringe, the House back, the three Lit Jokers (the Jingle Jester with its switch set to `'classic'`), The Ladder, Cinderon, Wickwisp, the candles, The Smudge, Encore, the Lit icons info, options and replay, the chrome, shards and digits) is byte-identical to `mockups/ember-lit/art.js`. (Lit's deck icon was redrawn on purpose: its red plus on a white card read as a first-aid cross, so the front card now carries a small heart.) If you redraw one of them on purpose, take it out of that test and out of its file's header;
  - cards compose with every mod and each mod changes the card; the kit is frozen; bitmaps are read-only; courts behave in any load order.
- `tests/art-cards.test.mjs` checks the playing cards (§11).
- `node tools/art-coverage.mjs` lists every content id without a sprite. It exits 0 when all are drawn, 1 if any are missing (`--strict` also counts temporary art), and 2 when the art did not load at all (an art file threw while loading), so a gate can tell a broken build from unfinished art.
- `node tools/gallery.mjs` writes `gallery.html` (`--out=` takes a path relative to the project root or an absolute one): every sprite at 3× (`?scale=6`, `?scale=2`), grouped by kind (`?kind=joker,tarot`), the missing list in red, and composed cards. Serve it with `node tools/serve.mjs . 5190` (ports 5190–5194) and shoot it with `node tools/cdp.mjs shot http://localhost:5190/gallery.html out.png 1440x900 --full`.

## 11. Playing cards: what 10-cards.js draws, and what the UI adds

**Courts.** Every court is its own person, in its suit's robe (`kit.ROBE`) with the suit on the costume, and each suit carries one motif: Spades carry light into the night, Hearts carry flowers, Clubs carry candles and Diamonds carry keys. Lit drew three people and re-robed them for seven cards; Lit's three now keep only the suit their prop fits and stay pixel-identical to Lit. `tests/art-cards.test.mjs` fails if two courts of one rank are the same figure in another robe.

| Court | Who |
| --- | --- |
| J♠ | Lit's Jack: a feathered cap, a lit lantern at his hip |
| Q♠ | The Night Queen: blue-black hair, a silver crescent on its side pinned at the left of her hair, a starry mantle over a moonlit gown, a lantern carried at her side (ring handle, ink cap, gold bars, a lit pane) |
| K♠ | Lit's King: a white beard, ermine, the ember sceptre |
| J♥ | The Gardener: a straw hat with a rose in its band, a linen apron, a potted rose |
| Q♥ | Lit's Queen: auburn hair, a pink flower |
| K♥ | The Rose King: a crown of roses, a copper beard, light copper brows, a long-stemmed rose held high on the pale ground beside his crown |
| J♣ | The Chandler's boy: a green beret, a leather apron (lit edge, two folds) dripping wax, a chamberstick raised beside his head, three tapers tied at his belt |
| Q♣ | The Candle-Crown Queen: a wreath of lit candles, copper braids, green over cream |
| K♣ | The Candelabra King: a domed crown, a long black beard with lit strands, a sable collar, a three-branch candelabra held at his side below the collar |
| J♦ | The Key-keeper: a maroon hood, a great brass key on his shoulder (a round bow, a two-px shaft, a stepped bit), two little keys on a ring at his belt |
| Q♦ | The Chatelaine: a high bun, a diamond tiara, maroon sleeves, a maroon overskirt open in a V over a pleated orange underskirt, a locked casket, keys on a chain |
| K♦ | The Vault King: a crown set with a great red diamond, a solid curled moustache and a goatee, a pleated orange robe round a cream fur placket, a key for a sceptre |

**Enhancements** never touch a face pixel (index, pips, Ace mark, court): the test checks all 52 cards with each of the eight. An emblem, where there is one, sits in the free left margin (x 1 to 8, which is clear on every card), so a Seal never hides it. None of them tints the whole stock in a suit or chip colour.

| Id | Name | Look |
| --- | --- | --- |
| `inked` | Waxed | Plain cream stock; a three-row band of blue wax poured over the top edge, drips of uneven length each ending in a round bead, a pale blue shadow beside the wax |
| `punchy` | Kindled | Plain cream stock; Lit's flame on a scorched patch in the lower-left corner, a singed bottom edge with three sparks, a crisp ember line on the lower-left side of each pip (the side facing the flame) |
| `dimestore` | Gilt-Edged | Plain cream stock gilded like a book: a gold cap on each corner (lit outside, darker body, an ink line inside) and a gilt fore-edge of page lines down the right side |
| `popout` | Sequined | Pink and gold sequins (2 × 2 with a white glint) scattered clear of the pips |
| `scribbled` | Masked | Warm lilac stock; a carnival mask held on a stick in the left margin (violet, gold rim, almond eye-holes, a pink plume, a wooden stick), held rather than worn |
| `spotlit` | Spotlit | A cone of light from above; outside it the stock sinks through peach to plum in the corners |
| `vintage` | Vintage | Aged peach stock browned two px deep along the top and right, up to ten foxing blotches (a dark core in a paler rim), the lower-left corner dog-eared (cut, folded flap, shadow) |
| `crumpled` | Crumpled | Five creases radiating from a point by the coin (each a dark valley with a pale ridge on its upper-left side), the facets between them shaded as planes; a `$` in the money face, lower left |

**Seals** share the one Seal spot (right edge at x 38, top 4 px above the card) and are four different shapes and colours, never a blob or a disc. All are 9 px wide, like Encore, so none hides more of the top-right pip than Lit's ribbon did (every `meta.at` is `[29, -4]`). Lay the badge over the card at `meta.at`, as §6 says for Encore.
- **Encore**: Lit's pink swallowtail tab, 9 × 17.
- **Paid**: a cream paper price tag on a red string looped over the edge through its punch hole, a `$` printed on it in the money amber, 9 × 17. The loop has its own ink edge, so the part above the card's edge (all of it that shows in a fanned hand) reads as a dark-ringed red loop on any band of the table.
- **Comet** (`airmail`): a night-navy pennant notched at its tip, an ember comet (a pale core, a cream tail trailing up to the right), 9 × 16.
- **Cameo**: an oval brooch in a pearl rim, a bright cream left-facing profile (brow, nose, lip notch, chin, neck, a bun) on a dark maroon shell ground, 9 × 15. No gold: a gold rim round a warm ground read as a coin at the phone scale. The brooch on Apparition (the Spectral that gives Cameo Seals) matches it.

**Editions** bake their pixels into the composed card (`TW.Art.card()`). The UI adds the motion with class `ed-{id}`. Move only in whole art pixels with `steps()` timing, never rotate, and divide every duration by `GAME_SPEED`. Reduced motion and still frames keep the baked look and drop the motion.

| Id | Name | Baked into the card | The UI's `ed-{id}` |
| --- | --- | --- | --- |
| `fourcolor` | Glitch | A red and a blue fringe inside the silhouette, following the index, pips and outline (never the stock, however dark). The silhouette is the card's own: on a Vintage card the fringe follows the dog-ear's fold line and never lands in the cut-away corner. Every pixel is opaque, the badge's plates too. | The two drop shadows and Lit's slip (§6) |
| `gloss` | Sheen | Candlelight on varnish: a warm glare band across the top-left corner (x + y = 7 to 11: peach edges, a warm-white core), a thin line at 14 and a glossy L along the lit top and left edges (the pixel inside the ink white, the next one ember), on bare stock only, so the index, pips, court, wax, gilt, emblems and the Seal spot stay clear. The L is what tells a still Sheen card from a plain one at 2×. | **A sweep.** A `::after`, clipped to the card's stepped silhouette, with a hard-edged 45° band about 6 art px wide in the same warm white (about 60 %) between peach rows (about 50 %), never pale blue. It crosses from the top left to the bottom right in about 0.9 s, then rests off the card: `ed-sheen 3.2s steps(24) infinite`. Mask it off the face where you can (the court window, the pips), as the baked band is: the UI masks it with `stockMask(cardId)` (§1), scaled in whole pixels. |
| `benday` | Dither | An ordered dither of Mult red and pink, dense to 3 px in and thinner to 6 px in (two clean steps, no lone pixels), kept 1 px clear of the face | **The hum.** A `::after` with the same checkerboard (2 × 2 art px, pink and red), masked to the border band. Its opacity steps 0, 0.45, 0: `ed-dither 1.2s steps(2, jump-none) infinite alternate`. (As built, the UI's hum is a field of light dots stepping in whole art pixels; on a playing card `stockMask(cardId)` keeps it off the face, §1.) |
| `inverted` | Phantom | A pale ghost, never darker than the table: an opaque pale ghost-blue stock lit from the upper left, the ink edge kept, a wavering ghost-blue line one px inside it, every face pixel re-inked in mid tones by its lightness (blue for Spades and Clubs, ghost pink for Hearts and Diamonds, so suits still sort and each pip keeps its highlight; the index reads at 3:1 to 4.7:1 on the pale stock in both; with colour-coded suits a Club's or Diamond's marks keep a ghost green or blue), an Enhancement's marks in ghost blue, and stepped mist curling up from the bottom | **The flicker.** Opacity 1, dropping to 0.55 for one 120 ms frame twice per loop at uneven points, like a candle in a draught (`ed-phantom 2.4s steps(1) infinite`). Add a 1-art-px glow: `drop-shadow(0 0 var(--px) #AED8F0B0)`. The see-through feel is this flicker; the baked card is opaque. |

The baked pixels exist only on composed playing cards. On a Joker the UI uses the same class over the sprite:
- **Sheen and Dither:** the overlay.
- **Glitch:** the drop shadows and the slip.
- **Phantom:** opacity 0.78, the ghost-blue glow and the flicker.

**Colour-coded suits** (Options › Colour-coded suits, `settings.fourColor`, class `four-color` on `:root`). With the option on, the UI asks for every playing card with `TW.Art.card({ rank, suit, enhancement, seal, edition, fourColor: true })`, which returns `card4:{rank}{suit}|{enh}|{seal}|{edition}` (the same parts as `card:`), and warms `'card4:'` instead of `'card:'`. The plain `card:` ids and pictures are unchanged.
- **Inks** (`kit.SUIT_INK4`, seven shades each, shade for shade against the two-colour inks): Clubs a deep green (`lime[0..4]`, with `plum[1]` and `plum[2]` in the two deepest shadows, as every ramp's shadows lean to plum); Diamonds a royal blue (`chips[2..8]`). Spades and Hearts keep theirs, so their `card4:` pictures are their `card:` pictures (one record, one PNG).
- **Why these:** read by lightness and the blue-yellow axis (what protanopes and deuteranopes keep), the four make a two-by-two: dark Spades and Clubs against light Hearts and Diamonds, blue Spades and Diamonds against warm Hearts and Clubs. On the rendered faces the closest pair is 19 to 21 apart (CIEDE2000, the suits' mean ink) under protanopia, deuteranopia and full colour alike; in two colours Clubs and Spades, and Diamonds and Hearts, share an ink. `tests/art-cards.test.mjs` checks the separation with the Machado (2009) simulation.
- **How:** `kit.fourColorFace(b, suit)` re-inks a two-colour face, each shade of `R.dark` (Clubs) or `R.red` (Diamonds) becoming the same shade of the suit's own ink: the index, the pips, the Ace's mark and every court motif drawn in the suit ink (the Queens' and Kings' pips, the Vault King's great diamond, the Chatelaine's tiara) follow it; the Jacks' cream pips stay cream. Enhancements, Seals and Editions compose on it as on a two-colour face (`ctx.fourColor` is true); Phantom keeps the suit's green or blue on a Club's or Diamond's marks.

**Deck backs** (`back:{deckId}`) share the stock and the inset frame (§3); each has its own colourway and medallion.

| Deck | Back |
| --- | --- |
| House | Lit's back |
| Firefly | Lit's plum bands, a dozen lime fireflies (a 2 × 2 glow with a halo on two sides), one in a corked jar standing in a two-step pool of lime light |
| Seer's | Violet, a gold sun-eye, three tiny Tarot cards on cream stock in a stepped fan beneath |
| Candelabra | Maroon, a tiered gold candelabra with five flames |
| Rags to Riches | A basket weave of burlap in two hues, lighter round a coin sewn on, lime and pink patches cross-stitched in cream, a loose peach thread |
| Parlour | Plum wallpaper in 3-px stripes with gold sprigs, a lozenge of warm candlelight where a round table with a lit candle and three cards reads dark on light |
| Gift-Wrapped | Cream and pink stripes, a pink ribbon and bow, a gold tag on a string |
| High Roller | Maroon bands in the standard frame, one big ivory die (a lit top, a shaded side, five maroon pips) on a lozenge of candlelight, cream sparkles: no gold rule, no tokens |
| Mirrorball | Violet, a mirrorball on a chain whose 2 × 2 facets catch the room (cream and white, lilac with pink and ember candlelight, plum), cross glints on its upper left |
| Spooky | Night bands shifting to violet inside a wavering ghost-blue border, the Wickwisp: a guttering candle in a brass chamberstick, its flame an acid-green wisp with two ink eyes, smoke curling up, a pool of acid light |

**Stakes** (`stake:{id}`, 15 × 15) run from twilight to the last candle, each with its own rim and mark:
- **Twilight:** a peach rim, a violet-to-orange sky and a gold star.
- **Nightfall:** a pink rim, a plum sky, a cream crescent and stars.
- **Moonless:** a violet rim, a near-black sky, three small plus-shaped stars and a dark plum horizon with a hill line.
- **Last Candle:** an acid rim, pitch dark, one candle stub and its flame.
