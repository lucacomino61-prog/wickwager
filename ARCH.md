# Wickwager: how the v3 build fits together

The shared contract for the overnight build (2026-11-23). Every agent reads this before touching code. Several workflows run at the same time, each owning its own files (§3). If you need a change in a file you don't own, write the request in `REQUESTS.md` (who it is for, what, and why) and work around it; the orchestrator routes requests between workflows.

## 1. What we're building

**Wickwager** is a single-file HTML poker roguelike. It uses the genre's game design and system words (Jokers, Small/Big/Boss Blind, Ante, Tarot, Planet and Spectral cards, Vouchers, Tags, Booster Packs, Stakes, Enhancements, Editions, Seals, Deck, Shop), but its look, names and items are its own.

- **Rules:** `src/engine.js` (pure, seeded, step traces). The engine API is SPEC.md §4 (v3).
- **Design data:** `content/content-plan.json` holds every item with its final name, text and art brief, the 120 Jokers, and the 294 UI copy rows (`ui`). `content/SYSTEMS-V3.md` is the readable version. `src/content.js` is what the game loads.
- **The look:** **Ember Lit**, `mockups/ember-lit/`, chosen by the orchestrator on 2026-11-23. Its `NOTES.md`, `lit.css`, `art.js`, `scene.js` and `play.js` are the visual source of truth: tokens, ramps, sprite style, room, light, motion and the payout timeline. Port them; don't reinvent them.
- **Grafts onto Lit:**
  1. **Long copy uses a readable text face.** Descriptions, tooltips, How to play, Overview and options help are set in **Bricolage Grotesque**, at least 15 px, with coloured keyword spans (Chips blue, Mult red, money yellow, etc.). It is already embedded in `mockups/ember-clean/fonts.css`. Labels, buttons, names, numbers and titles stay pixel: Jersey 10, Tiny5 and the Ember digit face.
  2. **Wording.** The cash-out button says **"Collect $N"**. The Blind's goal is the **Target**, the running total is the **Blind score**, the run summary is **Overview** and a retrigger says **Encore!**; the content check and the unit tests keep the UI to these words. The Blind select's button says **Play**, as SPEC 6.1 names it (orchestrator, 2026-11-25).
  3. **Review findings that already apply.** No rotated sprites at rest. No gold ramps or "jackpot" coding on money. Candle groups stay irregular, never bulb strips. The payout stays as juicy as the polished Lit peak or juicier.

## 2. Ground rules (all workflows)

- **The originality line.** Wickwager's look, words, art and items are its own:
  - **the look** is Ember Lit (§1): the candlelit room, its warm ramps, the lit 9-slice panels and pills, and the type of §1 (Jersey 10, Tiny5, the Ember digit face and Bricolage Grotesque), with light, glow and shadow as layers around the sprites (the pixel rules below);
  - **the words** on screen are the game's own (§1, the Wording graft), set around the genre's system words;
  - **the art** is drawn in code for this game: every card face, court, Joker, deck back, Stake chip, Seal and Edition (`src/art/ART.md` §9 is the art's own line);
  - **the items** have the game's own names and texts (`TW.Content`, §5), and no item has both the effect **and** the number of one on the off-limits list (SPEC §0).

  The genre's common words (Blind, Ante, Joker, Tarot, Planet, Spectral, Voucher, Tag, Stake, Deck, Chips, Mult, the poker hands' names and the rest of SPEC §1) are allowed. DESIGN.md's Don'ts and `src/art/ART.md` §9 list what the look never uses. The full rules are in `ORIGINALITY.local.md`, kept on the build PC, outside the repo, with the checks it points to in `tools/checks/` and `content/` (local only too).
- **No network, no new downloads.** Everything is embedded. Fonts come only from `mockups/ember-lit/fonts.css` (Jersey 10, Tiny5) and `mockups/ember-clean/fonts.css` (Bricolage Grotesque, Archivo), all OFL. Copy their licence lines into the credits. Do not fetch anything from the internet.
- **One animation engine.** CSS transitions, CSS animations and WAAPI (`element.animate`) only. No `requestAnimationFrame` loops, no animation libraries. One `GAME_SPEED` setting divides every duration. `?test=1` makes every duration 0, and `prefers-reduced-motion` plus the in-game Reduce motion option drop shakes, flashes and parallax.
- **Pixel rules.** Sprites are drawn from pixel grids or shape masks into bitmaps at 1:1. They are shown at one whole-number scale per breakpoint (`--px`: 3 CSS px on a desktop window at least 1024 px wide and 870 px tall; 2 below 1024 px wide (SPEC 6.7 compact layout: phones and tablets) and on any window under 870 px tall (laptop browsers such as 1024 x 768, 1280 x 720, 1366 x 768); one query, `TW.UI.MQ.px2`, mirrored in src/styles/10-tokens.css) with `image-rendering: pixelated`. A sprite is never smoothed, rotated or drawn at two pixel sizes on one screen. Glow, bloom, shadow and light are separate CSS layers around the sprites.
- **Determinism.** Only the engine rolls dice, through its seeded RNG. The UI and art use no `Math.random` for anything that matters; decoration may use a seeded hash.
- **Tests stay green.** `node --test "tests/*.test.mjs"` must pass when you finish. Add tests for what you build.
- **Browser checks.**
  1. Build with `node tools/build.mjs`.
  2. Serve with `node tools/serve.mjs . <port>`.
  3. Drive with `node tools/cdp.mjs shot|run ...`. It starts its own headless Chrome and closes it.

  Use only your workflow's port range (§3) so servers don't collide, and stop your server when you are done. Zero console errors is the bar.
- **Accessibility.** Every control is a real button with a name. Everything is reachable by keyboard. Focus is visible. Contrast is at least 4.5:1 for text. A live region announces scoring results. There are no hover-only actions; long-press or tap opens the same info.

## 3. Files and who owns them

| Path | Owner | Notes |
| --- | --- | --- |
| `src/content.js`, `src/engine.js`, `tests/engine.test.mjs`, `tests/v3.test.mjs`, `tests/vocab.test.mjs`, `tests/jokers*.test.mjs`, `tests/jokers-bb-harness.mjs`, `tools/engine-fuzz/*`, `tools/checks/content-check/*`, `SPEC.md` | **engine** workflow | DOM-free, clock-free |
| `src/art/*.js`, `src/art/ART.md`, `tests/art.test.mjs`, `tests/art-cards.test.mjs`, `tools/gallery.mjs`, `tools/art-coverage.mjs`, `gallery.html` | **art** workflows | DOM-free except `TW.Art.url` |
| `src/shell.html`, `src/styles/*.css`, `src/ui/*.js`, `src/audio.js`, `tests/ui*.test.mjs`, `tests/e2e/*` | **ui** workflow | |
| `tools/build.mjs`, `tools/serve.mjs`, `tools/cdp.mjs`, `ARCH.md`, `BUILD-LOG.md`, `REQUESTS.md` | orchestrator | ask through `REQUESTS.md` |
| `mockups/*`, `legacy/*`, `content/*` | read-only references | `legacy/v2/` is the old pier-arcade UI, kept only for logic you may reuse (storage, settings, keyboard, a11y) |

Port ranges: ui 5180–5189, art 5190–5194, QA 5195–5199.

Local only: `content/`, `mockups/`, `legacy/`, `tools/checks/`, `CONTENT.md`, `BUILD-LOG.md`, `REQUESTS.md` and `ORIGINALITY.local.md` stay on the build PC and are not in the public repo (`.gitignore`); the build reads only `src/`.

**Build order.**
- Styles: `src/styles/*.css`, in file-name order.
- Scripts: `src/content.js` → `src/art/*.js` (name order) → `src/engine.js` → `src/audio.js` → `src/ui/*.js` (name order).

Prefix files `00-`, `10-` and so on to set their order. The output is `index.html` in the project root. Every script is an IIFE that adds to `globalThis.TW` (`TW.Content`, `TW.Art`, `TW.Engine`, `TW.Audio`, `TW.UI`).

## 4. The art contract (`TW.Art`)

`src/art/00-core.js` ports the drawing kit from `mockups/ember-lit/art.js`:
- palette `C` and ramps `R`;
- `Bmp`, `Mask`, `emboss`, `sphere`, `shade`, `rng`, `pipBmp`;
- the 41 × 55 card shape, `frameCard`, `artWindow`, rarity frames and gems, the digit faces;
- the chrome pieces: panel, lip panel, pill, button, slot and icons.

It exposes a registry. Everything except `url` runs in Node with no DOM.

```js
TW.Art.define(id, { w, h, make: (kit) => Bmp })  // lazy; make() runs once, then cached
TW.Art.has(id) → boolean
TW.Art.ids(prefix?) → string[]
TW.Art.bitmap(id) → { w, h, data: Uint8ClampedArray } | null    // RGBA, 1:1
TW.Art.url(id) → 'data:image/png;base64,…' | null               // browser only, cached
TW.Art.card({ rank, suit, enhancement, seal, edition }) → id     // composes and registers a playing-card sprite on demand
TW.Art.kit                                                       // the drawing kit, for the content files
```

Content files register through helpers that `00-core.js` provides and documents in `src/art/ART.md`. Each item draws only its own illustration; the shared frame comes from the core:
- `TW.Art.joker(id, { ground, glow, speck, draw(kit) → 31×31 Bmp })`, the same shape as Lit's `JOKER_ART` entries;
- `TW.Art.tarot(id, …)`, `planet(id, …)`, `spectral(id, …)`, `voucher(id, …)`, `pack(kind, …)`, `tag(id, …)`, `boss(id, …)`, `stake(id, …)`, `back(deckId, …)`.

**Sprite ids** (all sizes in art px):

| Id | Size | What |
| --- | --- | --- |
| `card:{rank}{suit}` | 41×55 | Playing card face; rank 2–14, suit S/H/C/D, e.g. `card:14H` |
| `card:{rank}{suit}\|{enh}\|{seal}\|{edition}` | 41×55 | Composed by `TW.Art.card()`; empty parts stay empty, e.g. `card:7D\|gold\|\|` |
| `back:{deckId}` | 41×55 | Deck back, one per Deck |
| `joker:{id}` | 41×55 | Full Joker card: rarity frame, art window and an empty name plate. The UI sets the name as text over the plate (plate at x 3–37, y 41–51). |
| `tarot:{id}`, `planet:{id}`, `spectral:{id}` | 41×55 | Full consumable cards, with an empty plate like Jokers |
| `voucher:{id}` | 41×55 | Voucher card |
| `pack:{id}` | 41×55 | Booster Pack (one wrapper per kind, a size mark for Jumbo and Mega) |
| `tag:{id}` | 17×17 | Tag token |
| `blind:small`, `blind:big`, `boss:{id}` | ≤ 31×31 | Blind emblems. Small and Big are candles; each Boss is its own emblem. |
| `stake:{id}` | 15×15 | Stake chip |
| `seal:{id}`, `edition:{id}`, `enh:{id}` | ≤ 17×17 | Small badges for tooltips and the collection |
| `icon:{name}` | 9×9 | UI icons: info, options, replay, deck, sell, use, lock, close, back, sound, music, speed, check |
| `ui:{piece}` | varies | Chrome pieces, if the UI uses pixel 9-slices |

Every id that `content.js` names must have a sprite: every Joker, consumable, Boss, Voucher, Tag, Pack, Deck and Stake. `tests/art.test.mjs` checks this against `TW.Content` and checks that every bitmap has the right size and is not empty. `node tools/gallery.mjs` writes `gallery.html`, a page showing every sprite with its id and name, used for review shots.

**Editions** are part of the composed bitmap where they change pixels (the Glitch fringe). Moving light, such as a sweep or shimmer, comes from CSS classes `ed-{id}` that the UI owns. **Enhancements** change the card stock and are drawn by the art workflow. **Seals** are drawn at a fixed spot on the card (the Encore ribbon over the top edge). On a fanned hand the next card covers that spot, so the UI gives each covered card its Seal as a tab over the top edge of the strip that shows (on a strip narrower than 19 art px the tab moves onto the strip, clear of the rank). A chosen covered card, which rises clear of the next one, wears its Seal on its strip at the art's own height, below the Move pair. Either way the UI composes that card's face with `seal: null`, so the Seal shows whole and once; the last card and every hand that isn't fanned keep the art's spot (`fanCheck` in `src/ui/10-table.js`; orchestrator, 2026-11-25, after the part 3 repair).

## 5. The UI contract (`TW.UI`)

- **`src/ui/00-core.js`** holds the shared plumbing:
  - boot, the screen router (`TW.UI.show(name, props)`), storage (`ember:settings`, `ember:run`, `ember:records`) and settings;
  - motion tokens and `GAME_SPEED`, sprite URLs from `TW.Art.url` with a placeholder fallback;
  - dialogs and sheets, tooltips (hover and long-press), toasts, the live region and keyboard handling;
  - the test hooks `?test=1`, `?seed=`, `?speed=`, `?screen=` and `window.__wick` for scripted checks.
- **`10-table.js`:** Blind select, the play table, the payout (driven only by the engine's step trace, generalised from Lit's `play.js` timeline) and cash-out.
- **`20-shop.js`:** the Shop, Booster Packs (including the dealt hand for Tarot and Ghost Packs), buying, selling, using cards, Vouchers and Tags.
- **`30-screens.js`:**
  - title, run setup (Deck and Stake), options, pause, How to play;
  - Overview (hand levels, Vouchers, Tags, Boss), deck view, records and collection;
  - game over, the win screen and Endless mode.
- **`src/audio.js`:** a WebAudio synth with no samples; `TW.Audio` has sfx(name), music on/off and volume.

UI copy comes from the `ui` rows of `content/content-plan.json`, and item names and texts come from `TW.Content` at run time. Never hard-code an item name.

## 6. Done means

Done means four things:
1. A full run is playable from the title through 8 Antes to the win screen on desktop and phone, with zero console errors.
2. Every content item is drawn, in the game and in `gallery.html`.
3. All tests pass.
4. `node tools/build.mjs --strict` builds `index.html`, which opens straight from disk.
