---
name: Wickwager
description: "Ember Lit: a candlelit pixel card table, relit as a 2026 indie game."
colors:
  edge: "#2B1220"
  ink: "#1E0D19"
  ink-2: "#2A1423"
  plum: "#3C2132"
  plum-2: "#4D2B40"
  plum-3: "#6A3D55"
  plum-4: "#8C5671"
  cream: "#FFF3E0"
  cream-2: "#F2D3AE"
  cream-3: "#DDB08A"
  line: "#F0BE96"
  muted: "#EBC3AE"
  soft: "#D9A892"
  chip: "#4A62FF"
  chip-hi: "#A9B8FF"
  chip-lo: "#2734B5"
  chip-pill: "#3346D6"
  mult: "#E9382B"
  mult-hi: "#FFB9A6"
  mult-lo: "#A51A27"
  mult-pill: "#C8262F"
  money: "#FFCE3B"
  money-hi: "#FFF0A0"
  money-lo: "#D18A1D"
  money-ink: "#7E4A0E"
  ember: "#FF7A2B"
  ember-hi: "#FFD29C"
  pink: "#FF4C9B"
  pink-hi: "#FFB2D6"
  lime: "#9EE03C"
  lime-hi: "#E2FFA6"
  vio: "#8B46EE"
  vio-hi: "#CDA8FF"
  acid: "#CFFF2F"
  spectral: "#AED8F0"
  band-0: "#2C1535"
  band-1: "#40173F"
  band-2: "#5A1A41"
  band-3: "#761F3C"
  band-4: "#922B35"
  band-5: "#AE402C"
  band-6: "#C65A26"
  panel-fill: "#2E0F249E"
  panel-warm-fill: "#4A1A2CA8"
  panel-deep-fill: "#170612C4"
  panel-rack-fill: "#2A0D2288"
  ghost-fill: "#3A132C8C"
  dialog-fill: "#2A0C20F6"
  tip-fill: "#24091CF2"
  well-chips: "#121860"
  well-mult: "#5A0C1C"
  shadow-tint: "rgb(26, 4, 18)"
typography:
  title:
    fontFamily: "'Jersey 10', 'Tiny5', ui-monospace, monospace"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: ".03em"
  title-compact:
    fontFamily: "'Jersey 10', 'Tiny5', ui-monospace, monospace"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: ".03em"
  tag:
    fontFamily: "'Jersey 10', 'Tiny5', ui-monospace, monospace"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: ".03em"
  label:
    fontFamily: "'Tiny5', 'Jersey 10', ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "normal"
  copy:
    fontFamily: "'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.42
    letterSpacing: "0"
    fontVariation: "'wdth' 92"
  copy-small:
    fontFamily: "'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0"
    fontVariation: "'wdth' 92"
rounded:
  ring: "calc(2 * var(--px))"
  pill: "calc(3 * var(--px))"
  panel: "calc(4 * var(--px))"
spacing:
  ap-1: "calc(1 * var(--px))"
  ap-2: "calc(2 * var(--px))"
  ap-3: "calc(3 * var(--px))"
  ap-4: "calc(4 * var(--px))"
  ap-5: "calc(5 * var(--px))"
  ap-6: "calc(6 * var(--px))"
  ap-7: "calc(7 * var(--px))"
  ap-8: "calc(8 * var(--px))"
  touch: "44px"
components:
  button-ember:
    backgroundColor: "{colors.ember}"
    textColor: "#2A0A06"
    typography: "{typography.tag}"
    rounded: "{rounded.panel}"
    padding: "0 calc(4 * var(--px)) calc(1 * var(--px))"
    height: "calc(12 * var(--px))"
  button-ember-big:
    backgroundColor: "{colors.ember}"
    textColor: "#2A0A06"
    typography: "{typography.title}"
    rounded: "{rounded.panel}"
    padding: "0 calc(6 * var(--px)) calc(1 * var(--px))"
    height: "calc(16 * var(--px))"
  button-pink:
    backgroundColor: "{colors.pink}"
    textColor: "#2A0418"
    typography: "{typography.tag}"
    rounded: "{rounded.panel}"
    padding: "0 calc(4 * var(--px)) calc(1 * var(--px))"
  button-cream:
    backgroundColor: "{colors.cream-2}"
    textColor: "{colors.ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.panel}"
    padding: "0 calc(4 * var(--px)) calc(1 * var(--px))"
  button-yellow-pressed:
    backgroundColor: "{colors.money}"
    textColor: "#2A1404"
    typography: "{typography.tag}"
    rounded: "{rounded.panel}"
  button-ghost:
    backgroundColor: "{colors.ghost-fill}"
    textColor: "{colors.cream}"
    typography: "{typography.tag}"
    rounded: "{rounded.panel}"
  button-disabled:
    backgroundColor: "{colors.plum-2}"
    textColor: "#C9A2B4"
    typography: "{typography.tag}"
    rounded: "{rounded.panel}"
  pill-ember:
    backgroundColor: "{colors.ember}"
    textColor: "#2A0A06"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
    padding: "0 calc(4 * var(--px))"
    height: "calc(9 * var(--px))"
  pill-lime:
    backgroundColor: "{colors.lime}"
    textColor: "#12260A"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
    height: "calc(9 * var(--px))"
  pill-chips:
    backgroundColor: "{colors.chip-pill}"
    textColor: "#F4F6FF"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
  pill-mult:
    backgroundColor: "{colors.mult-pill}"
    textColor: "#FFF4F0"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
  pill-cash:
    backgroundColor: "{colors.cream-2}"
    textColor: "{colors.money-ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
  pill-vio:
    backgroundColor: "{colors.vio}"
    textColor: "#FFFAFF"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
  panel:
    backgroundColor: "{colors.panel-fill}"
    textColor: "{colors.cream}"
    rounded: "{rounded.panel}"
    padding: "calc(4 * var(--px)) calc(5 * var(--px)) calc(5 * var(--px))"
  panel-warm:
    backgroundColor: "{colors.panel-warm-fill}"
    textColor: "{colors.cream}"
    rounded: "{rounded.panel}"
  panel-deep:
    backgroundColor: "{colors.panel-deep-fill}"
    textColor: "{colors.cream}"
    rounded: "{rounded.panel}"
  panel-rack:
    backgroundColor: "{colors.panel-rack-fill}"
    textColor: "{colors.cream}"
    rounded: "{rounded.panel}"
    padding: "calc(4 * var(--px)) calc(5 * var(--px)) calc(6 * var(--px))"
  well-chips:
    backgroundColor: "{colors.well-chips}"
    textColor: "{colors.chip-hi}"
    rounded: "{rounded.panel}"
    height: "calc(34 * var(--px))"
  well-mult:
    backgroundColor: "{colors.well-mult}"
    textColor: "{colors.mult-hi}"
    rounded: "{rounded.panel}"
    height: "calc(34 * var(--px))"
  card:
    backgroundColor: "{colors.cream}"
    width: "calc(41 * var(--px))"
    height: "calc(55 * var(--px))"
  joker-plate:
    backgroundColor: "#2E1328"
    textColor: "#FFEBDC"
    typography: "{typography.label}"
    height: "calc(9 * var(--px))"
  tooltip:
    backgroundColor: "{colors.tip-fill}"
    textColor: "{colors.cream}"
    rounded: "{rounded.panel}"
    padding: "calc(4 * var(--px)) calc(5 * var(--px)) calc(5 * var(--px))"
    width: "max-content"
  dialog:
    backgroundColor: "{colors.dialog-fill}"
    textColor: "{colors.cream}"
    rounded: "{rounded.panel}"
    padding: "calc(4 * var(--px)) calc(7 * var(--px)) calc(6 * var(--px))"
    width: "min(calc(150 * var(--px)), 100%)"
---

# Design System: Wickwager

## Overview

**Creative North Star: "The Candlelit Table, Relit"**

Wickwager is a poker-hand roguelike played at a card table in a warm room lit by candles. The approved Ember pixel table is relit as a 2026 indie game: crisp pixel sprites sit at one whole-number scale, and light, bloom, glow, shadow and depth are separate layers around them, never baked into a smoothed sprite. The room has three depths behind every screen: a far wall of irregular candle groups out of focus, a middle layer of pixel haze, and embers rising near the glass. A hearth glow rises from below, a pool of candlelight sits over the stage, and the edges fall away into warm plum, never black.

Density is a game table's: every number the player needs (Target, Blind score, Chips × Mult, hands, discards, money) sits on screen in its own lit panel, each number glowing in its own colour. Chrome is soft pixel 9-slice panels with a two-pixel warm lip along the top, pills for labels, and buttons whose lip sinks when pressed. Things that land move on damped springs; the scoring moment, the payout, is the reward and ends in a plaque, rings, pixel shards and a flash of the room.

The owner rejected three earlier looks, and their reasons stand as rules: the parchment logbook; the navy-and-gold pier arcade (it felt like a phone casino app, was too dark and all one colour, its cards looked plain, and scoring wasn't juicy enough); and comic pop, along with the cooler "Night" pixel look. The game follows the genre's design and system words, and its look is its own.

**Key Characteristics:**
- One art-pixel size per screen (`--px` is 3 or 2 CSS px), `image-rendering: pixelated`, nothing rotated at rest.
- A warm plum-to-burnt-orange room in seven bands, with light as additive layers (`plus-lighter`).
- Every colour has a job: blue Chips, red Mult, flat yellow money, ember for the main action, pink for Discard and Jokers, lime for the Blind score, violet for consumables and the Boss.
- Three type faces with strict roles, plus the Ember digit face (a bitmap drawn in code) for every readout.
- Every shadow is tinted plum (`rgb(26 4 18)`), never grey or black.
- Damped springs sampled into `linear()`; one game speed divides every gameplay duration.

## Colors

A warm, saturated room of plum, maroon and burnt orange. Each accent belongs to one game quantity or action; the few places one shows outside its job are named in The One Job Rule.

### Primary
- **Hearth Ember** (`ember`): the way forward: Play hand, Play at the Blind select, Collect $N, Next Blind, Start run, Resume, Continue run, New run, How to play's Next, Use and Buy in an item's sheet, and the pick of the pack option being read. Also the column's Ante and Blind pill (violet for a Boss Blind), the Shop's pill and the Hands count; `ember-hi` lights the lip of the default, deep and rack panels (the warm panel, dialogs and tips take paler peach lips, the Boss a violet one). Dark ink `#2A0A06` on its face (7.1:1).

### Secondary
- **Chips Blue** (`chip`): Chips: the Chips well's glow and its numerals (white to `chip-hi`, rimmed in `chip-pill`), +Chips pops, blue rings. Planet cards, which level hands, share it (their frame, and their name in copy in `chip-hi`), and so does the Glitch edition's blue plate. Its pill steps one shade deeper (`chip-pill`) so light ink keeps 4.5:1 (6.5:1; cream on the base blue would be 4.3:1).
- **Mult Red** (`mult`): Mult only: the Mult well, +Mult and ×Mult pops. Its pill uses `mult-pill` (light ink 5.2:1; cream on the base red is 3.8:1).
- **Flat Money Yellow** (`money`): money figures, flat with one `money-lo` rim and a 2-px glow core only. On the cream pills (the cash pill, price tags, both on a `cream-2` face) the figures turn `money-ink`, because yellow there measures 1.0:1 and dark amber 5.1:1 (1.35:1 and 6.7:1 on card-stock `cream`). Outside money, yellow is only the pressed segment of a toggle group, and `money-hi` the outer colour of the focus ring.

### Tertiary
- **Discard Pink** (`pink`): Discard, Reroll, Sell and the confirm of Erase records and Abandon run; the Discards count, the Joker rack's pill and the Big Blind's pill at the Blind select; Rare rarity; Seal and warning keywords (`pink-hi`).
- **Score Lime** (`lime`): the Blind score pill, good news, Uncommon rarity, Tags (`lime-hi`), switches that are on.
- **Ritual Violet** (`vio`): consumables, Tarot, Legendary rarity and the Boss Blind (its panel frame, emblem bloom and rule name in `vio-hi`). Light ink on its pill is 4.8:1.
- **Acid** (`acid`): art only, never chrome: the Last Candle stake's rim, the Spooky deck's wisp, Foxfire's glow and the touch of green every Boss emblem carries (The Smudge's eyes).

### Neutral
- **Card Stock Cream** (`cream`): playing-card stock and the primary text colour on every plum surface (15.8:1 against the default fill's own colour; 9.7:1 where the bottom band shows through that translucent fill).
- **Warm Paper** (`cream-2`, `cream-3`): two and three steps under card stock on the cream ramp (`#FBE7CB` sits between): `cream-2` is the face of every cream button and pill (Skip, Pick or Use on a pack option not being read, Buy on the shelf, Back, Rank and Suit, the cash pill), `cream-3` their shade.
- **Muted Rose** (`muted`): small labels and secondary text on panels (10.7:1 against the default fill's own colour, 6.6:1 over the bottom band). On the lit floor it falls to about 2.1:1 (2.6:1 against the bottom band before the hearth's light, about 1.5:1 at the hearth's core), which is why a label on the open room rides on a plum pill or a plum pool.
- **Ink Edge** (`edge`): the one-art-pixel outline round every sprite and the inner band of the focus ring.
- **Plum ramp** (`plum` to `plum-4`): disabled buttons (their face is `plum-2`), switch tracks, scrollbar thumbs, sold slots.
- **Ground bands** (`band-0` to `band-6`): the room's vertical gradient, top to bottom; `band-2` is the page colour behind everything.
- **Panel fills** (`panel-*-fill`): translucent (alpha .53 to .77, kept in the 9-slice painter's own eight-digit hex), so the room shows through; ghost buttons have their own plum plate (`ghost-fill`, alpha .55); temperature changes with the job: default, warm (the Blind), deep (the Blind score), light (the racks). Dialogs, sheets, the plaque and tooltips are nearly opaque (`dialog-fill`, `tip-fill`). Wells are opaque (`well-chips`, `well-mult`).

### Named Rules
**The One Job Rule.** Each accent means one thing. Blue is always Chips, red always Mult, yellow always money, ember always the way forward. The shipped exceptions are few and fixed: a pressed toggle segment sinks in yellow and the focus ring's outer colour is pale yellow; Planet cards share the Chips blue; ember also marks the Hands count, a chosen tab's bar, a slider's fill and a chosen card's halo. A new screen never borrows an accent for decoration.

**The Flat Cash Rule.** Money is flat yellow with one amber rim. No gold ramp, no chrome trim, no coins, bulbs or jackpot banners on a money figure. In the art the gold ramp is ornament (crowns, bells, buttons, buckles, chains, gilt edges, sequins, a sun or a star), never coded as money, and the few coins drawn into items (Busker's Hat, Cursed Coin, the Rags to Riches Deck's sewn-on coin) are flat yellow with one amber rim as well.

**The Warm Shadow Rule.** Every shadow, scrim and vignette is the plum tint `rgb(26 4 18)` at some alpha; only the inset rims of the small wells (the seed field and its readout, a slider's track) take a deeper plum, `rgb(10 2 8)`. Nothing is grey, nothing is black.

## Typography

**Display Font:** Jersey 10 (fallback Tiny5, monospace)
**Label Font:** Tiny5 (fallback Jersey 10, monospace)
**Body Font:** Bricolage Grotesque (fallback ui-sans-serif, system-ui)
**Numbers:** the Ember digit face, a bitmap face drawn in code in four sizes (S 5 × 7, L 7 × 11, XL 14 × 22, XXL 28 × 44 art px), fixed width so counts never jitter.

**Character:** Two pixel faces carry every label, button and title and nearly every name, on their own grids; one warm, slightly condensed grotesque carries everything a player reads as sentences, and the names in the hand tables (Overview, How to play) and the run history (on the title and in Records). All three are OFL and embedded; nothing loads from the network.

### Hierarchy
- **Title** (Jersey 10, 400, 30 px at `--px` 3 / 20 px at `--px` 2, line-height 1): uppercase at .03em on big buttons (Play hand, Discard, Play, Start run, Resume), the Shop's Next Blind and the cash-out total (kept at 30 px in the compact layout); the plaque's hand name, uppercase, tracks .06em; sheet names, a pack's reading-plate name, the run setup's Deck name and How to play's page titles keep their own case at .02em. At the table layout price tags and the payout's hanging tags and note pops are set at this size too. Collect $N is a regular button, so it is set as Tag.
- **Tag** (Jersey 10, 400, 20 px): uppercase at .03em on pills, regular buttons, tabs and Boss names; Tag, Shop item and tooltip names keep their own case at .02em; section heads in Overview, Options and the run setup are uppercase at .04 to .08em.
- **Label** (Tiny5, 400, 16 px): small labels (Hands, Discards, Money, Ante), Joker and consumable plates, small buttons, tooltip kinds. 16 px is Tiny5's own grid everywhere, phone plates included.
- **Copy** (Bricolage Grotesque, 500, 16 px, line-height 1.42, width 92 %, antialiased): descriptions, tooltips, sheets, How to play, toasts. Bold keywords at 700 in their system colour (Chips `chip-hi`, Mult `mult-hi`, ×Mult `#FF8F78` at 800, money `money`, names `ember-hi`, Jokers and Seals `pink-hi`, Tarot and Boss `vio-hi`, Tags and Enhancements `lime-hi`).
- **Copy small** (Bricolage Grotesque, 500, 15 px, line-height 1.35; 1.25 to 1.32 in the tighter Shop, Blind select and Records texts): Boss rules, Tag texts, the sheet's "why" line, Shop item texts, Options hints, Overview's details, and the notes on the menus and end screens. Never smaller.
- **Wordmark and end headlines**: the game's own lettering drawn as sprites (the I of WICK is a candle with Lit's stepped flame and breathing bloom), never a font.

### Named Rules
**The Whole Grid Rule.** A pixel face is set only at a whole multiple of its own grid: Jersey 10 at 20 or 30 px, Tiny5 at 16 px. The button and title size drops from 30 to 20 px together with `--px`. The shipped exceptions set Jersey 10 at 16 px, off its grid: the compact Blind select's pills and Boss and Tag names, the waiting Tags' names in the compact layout, a phone title's four menu buttons, and a Joker's Off and +1 marks.

**The Fifteen Pixel Floor.** Long copy is Bricolage Grotesque at 15 px or more. Pixel faces never set a paragraph; Bricolage never sets a pill, a button, a small label or a readout (a number inside its sentences, such as +4 Mult, stays in the sentence's face).

## Layout

**The art pixel.** `--px` is 3 CSS px on a window at least 1024 px wide and 870 px tall, and 2 CSS px below 1024 px wide or under 870 px tall (one query, `(max-width: 1023px), (max-height: 869px)`, mirrored by `TW.UI.MQ.px2`). Every sprite size and nearly every gap, padding and resting offset is a whole number of art pixels: spacing runs `calc(n * var(--px))`, mostly with n from 1 to 8 (3 between cards, 5 or 6 inside panels, 6 or 7 between column panels; menu plates and the hand zone pad by up to 22). The exceptions: a few 1.5-art-px gaps between a label and its figure, the deck stack's middle card 1.5 art px down, and rows that overlap to fit their room (a fanned hand, a full Joker rack, a crowded stage, the Deck view), whose step divides the room evenly. Touch targets in the compact layout are at least 44 CSS px; the written exception is a fanned hand's visible strips (44 px at 390 × 844, 40 at 360 × 640, 30 at 667 × 375), each still a whole tap target and never under WCAG 2.5.8's 24 px, and a few tip-only marks that only explain themselves are smaller too (a Voucher pill in the Shop's foot is 16 px tall, the Blind select's Tag token 34 px).

**Desktop table (1440 × 900, `--px` 3).** Two columns: a left column 104 art px wide (the Blind with its candle, Target and reward; the Blind score capped at 48 art px; the hand name over the Chips × Mult wells, 34 art px tall; hands and discards; money, Ante and the Blind count; Overview and Options pinned to the foot, the spare height above them), and the field. The field puts the Joker rack (flexible, its cards overlap when full) and the consumables rack across the top, the stage in the middle, the hand (8 cards on a whole-pixel arc, 3 art px apart where the room allows; at 1440 × 900 the field leaves them 930 px, so they step 115 px and overlap by about 8) along the bottom with Play hand, Sort (Rank, Suit) and Discard under it, the deck at the bottom right. Blind select is three Blind panels 104 art px wide, the current one raised 8 art px on a warm frame. Toasts sit over the field below the racks, never over the Jokers.

**Narrow table (1024 to 1279 px wide, 870 px tall or more: 1024 × 900, 1024 × 1366).** The same table at `--px` 3 with less field. A pack of six scrolls its row sideways inside the field where it doesn't fit (four of six whole at 1024 px wide, five at 1100, all six from 1180), with a thin scrollbar and no snap; beside a Tarot or Ghost Pack's dealt hand the reading plate is 70 × 100 art px (narrower and taller than the table's 86 × 84) and the deck steps aside, so the hand's strips are 44 px at 1024 px wide. Play hand and Discard keep their label's width, and the Shop's shelves hold two items a row, scrolling inside the panel when they are taller than it.

**Short laptop (1024 × 768, 1366 × 768, 1366 × 620).** The same table layout at `--px` 2: buttons and titles at 20 px, the hand and its buttons above the fold. An open pack's reading plate keeps a fixed height here (104 art px) beside the dealt hand. The Shop's item texts keep three lines at 760 px tall or less (820 with Night Market) and two at 700 or less, where the kind line steps aside and the shelves draw closer. At 700 px tall or less (1366 × 620, 1024 × 600) a Boss's name also leaves its rule (the pill names it), the column's panels sit 5 art px apart, the Blind score's panel is 40 art px tall and the wells 32, so Overview and Options stay above the fold.

**Tablet and narrow window (600 to 1023 px wide).** The compact layout at `--px` 2: the column becomes a top bar of two rows on a 12-column grid (Blind, Blind score, Chips × Mult and money side by side over the counts and the Overview and Options buttons); the hand and buttons keep the table's measure, centred. On a window 870 px tall or more (a tablet, 768 × 1024) Shop items stand art beside text again. An open pack's reading plate runs nearly the window's width, 52 art px tall.

**Short compact window (600 to 1023 px wide, under 870 px tall: 600 × 800, 700 × 700, 900 × 650).** Unless it is a landscape phone, its Shop stands the items in one row under the head row, each as on a phone held upright (the price tag over the art, a pack's name, a two-line taste of its effect, Buy and up to three lines of why it can't be bought); the items of a shelf share its rows, so every Buy in the row stands at one height, and the Shop stands at the field's foot. Night Market's seven scroll sideways where they don't fit. Held upright, the top bar's rows are set out again: the Blind takes half the first row (the target beside its label, a Boss rule in two lines) beside the Blind score and money, and Chips × Mult shares the second with the counts, Overview and Options (Ante and the Blind count step aside on the table). Held upright at 760 px tall or less (700 × 700, 600 × 650), the stage gives up its room, a chosen card rises 10 art px, the Blind select's candles and Boss emblem step aside and its Boss rule keeps up to four lines on its Blind (three under 620 px tall), and the racks step aside while a Tarot or Ghost Pack deals its hand or while a Planet Pack is open (the top bar keeps the money and Overview), so the pack and its whole hand fit one screen, the hand resting at its foot and the plate keeping its 52 art px: with the racks the pack would need about 740 px at 700 × 700.

**Short window held wide (below 1024 px wide, wider than tall, 601 to 760 px tall: 1000 × 700, 900 × 650, 800 × 620).** The landscape phone's layout (below), with a window's height given back: the status column keeps the Blind's candle or the Boss's emblem and the whole Boss rule, and outside the Shop and packs stands in the table's order, Overview and Options named at its foot; the Blind select keeps its candles and the waiting Tags, its Blinds standing at the stage's foot; the Shop is the one-row Shop above; the racks stay over every pack, so a held Tarot can act on a dealt hand, and a pack with no dealt hand stands its head in a row over its cards across the field, the reading plate under them. Toasts sit under the racks, centred over the field, as at the table.

**Phone (below 600 px wide, 390 × 844).** The top bar takes three rows; the Joker rack scrolls sideways with snap, as in every compact layout (the consumables rack drops its empty slots and its pill shows only its count); the hand runs edge to edge, each covered card showing a 44 px strip at 390 × 844, a chosen card rising 14 art px; Play hand and Discard stretch either side of Rank and Suit (the Sort label steps aside); the deck becomes a count chip. In the Shop and packs the bar keeps only money, Ante, the Blind count, Overview and Options (a Planet Pack keeps the hand panel too). Sheets become bottom sheets; in a run a toast sits just above the buttons, over the foot of the hand (over an open pack, under the racks, though at 390 × 844 a Planet Pack's taller bar brings the racks down beneath it). A short phone (760 px tall or less, 360 × 640) tightens the bar: the target beside its label, hands and discards on one line. Its strips are 40 px, and a chosen card rises only 10 art px, as at the table, because the stage over the hand (36 px there) is too short to lift the Move pair out of its way. Its Shop and packs keep to one screen, and the racks step aside while a pack deals its hand.

**Landscape phone (compact, 600 px tall or less, 844 × 390).** The column returns as a narrow status column (112 art px) at the left, its hands and discards as wide as their labels need; Play hand, Sort and Discard stand in a column beside the hand; safe-area insets are respected. The hand's strips are 55 px at 844 × 390 and 30 px on the smallest (667 × 375), where the column, the button column and a stage row about 53 px tall leave the hand 289 px. In the Shop and packs the column narrows to 64 art px and holds only money, Ante, the Blind count and the two buttons (a Planet Pack adds the hand panel), and a long pack name (a Jumbo or Mega Card, Planet or Joker Pack) wraps to two lines in its pill. While a Tarot or Ghost Pack deals its hand the racks step aside and the pack takes two columns: at the left its name over picks left and Skip, with the reading plate under them running to the foot of the hand, so every reading shows whole without scrolling; at the right the options stand over the dealt hand (a Mega Tarot Pack's six scroll their row sideways at 844 × 390, one a swipe away, and at 667 × 375, three, and fit at 932 × 430; a Mega Ghost Pack's four scroll only at 667 × 375). A Planet Pack keeps the racks, so the Jokers and consumables stay in reach.

**Menus and end screens.** At 960 px wide or less the title, setup and Overview plates stack, and at 760 px or less the menus take one column. From 600 px wide on a window 700 px tall or less the run setup's plate is the window's height and its Deck and Stake scroll inside it, so the starting stats, Back and Start run stay in view; at 700 px tall or less the end screens draw their rows in (from 600 to 760 px wide their counts stand three a row), so Game Over and You win! fit whole on a window from 600 px wide and 600 px tall. A note on a menu or end screen sits at the top at every width, clear of Start run and the end screens' buttons.

**Motion of layout.** Route changes: a lifeless copy of the leaving view, its cards' wash, sweep and Edition light left out, fades out in place over the arriving one on the ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`), 180 ms for the whole view and 160 ms when only the table's main area changes (Blind select to play, the Shop to a pack), at every game speed and under reduced motion too. The main area's copy is fixed over its area, never in the page's flow, so the page never grows or flashes a scrollbar while it fades; the whole view's copy lies out of flow at the top of the page. The arriving view makes its own entrance on the springs; a new visit to the Shop builds its shelves a task later, once the screen change has had its frame, and input waits for them.

### Named Rules
**The One Scale Rule.** Never two art-pixel sizes on one screen at rest (a press, a pulse, a swell or the total's flight scales a sprite only while it moves), and no sprite rests between pixels except in the cases The art pixel names; the room's drifting layers glide freely. The one exception to the breakpoint's scale is the reference sheet (`gallery.html`), which shows every sprite at the one whole scale its page asks for (3 by default; 2 and 6 on its links).

**The Redraw In Place Rule.** Crossing a breakpoint (a window crossing 1024 px wide or 870 px tall, a phone turned) redraws only what was drawn for one pixel size: the name plates, lettering and pools of light on the menus and in an open dialog, the table's column and racks, the Shop or an open pack, and the room. Focus stays on the same control or the one drawn in its place, an open dialog stays open, and a redraw asked for while the game is busy waits for it instead of being dropped. Any resize, one that crosses no breakpoint too, fits the column's figures (the target, the Blind score, money) to their panels again, though never while a payout runs or input is held.

## Elevation & Depth

Depth is light, not lift. The room is three parallax layers (a fine pointer leans them up to 1, 2.5 and 4.5 art px at the screen's edge, far to near, a swing of 2, 5 and 9 across the screen, following it over 1400 ms at the Relaxed pace on the soft spring) with additive light pools. Chrome floats on soft plum shadows drawn on its own `::before` layer, so a panel can pulse without its shadow jumping. Cards sit on the table with two shadows that stay behind when the card lifts. Glow belongs to live numbers: a tight core plus a halo in the readout's own colour (`--glow-chips`, `--glow-mult`, `--glow-score`, `--glow-ember`), money keeping only its core.

### Shadow Vocabulary
- **Panel** (`box-shadow: 0 calc(4 * var(--px)) calc(9 * var(--px)) rgba(26,4,18,.46), 0 var(--px) var(--px) rgba(26,4,18,.42)`): every 9-slice panel; it also draws the bottom edge (no hairline on the sides or bottom).
- **Button** (`0 calc(3 * var(--px)) calc(8 * var(--px)) rgba(26,4,18,.45), 0 var(--px) calc(2 * var(--px)) rgba(26,4,18,.3)`): pressable buttons; fades to .35 when disabled.
- **Dialog** (`0 calc(7 * var(--px)) calc(20 * var(--px)) rgba(26,4,18,.65), …`): dialogs, the cash-out, over a `rgba(26,4,18,.55)` scrim with a warm pool of light behind.
- **Tip** (`0 calc(4 * var(--px)) calc(12 * var(--px)) rgba(26,4,18,.55)`): tooltips and toasts.
- **Pill** (`0 calc(2 * var(--px)) calc(4 * var(--px)) rgba(26,4,18,.4)`): every pill, on a plate inset 1 by 2 art px.
- **Card contact and ambient**: a tight dark ellipse under the card and a wide soft radial below it, both gradients (no blur filters), drawn on the table.
- **Chosen card**: a one-art-pixel peach rim (`#FFDDB0`) and an ember halo round the face, lifted 10 art px at the table, 14 in the compact layout, and 10 again on every compact window 760 px tall or less (a short upright phone, a compact window held upright, a landscape phone, a short window held wide).

### Named Rules
**The Light Layer Rule.** Light, glow, bloom and shadow are separate CSS layers or small stretched canvases around the sprites. A sprite's pixels are never blurred, smoothed or filtered for depth; the far room and the far and near embers are the only blurred art, by design.

## Shapes

Pixel silhouettes, stepped by hand: card corners step 4-2-1-1 art px (the shared `--card-clip` polygon, also used to clip washes, sweeps and Edition light); panels step 3-1-1 on 9×9 nine-slices; pills step 2-1 on 7×7; buttons are 9×10 nine-slices stepped 3-1-1 at every corner, lit by a highlight row along the top and a lighter left edge, with a two-row darker lip along the bottom that sinks to one row when pressed. No CSS border-radius rounds the 9-slice chrome (panels, pills, buttons, the seed field); radii appear only on shadow plates, the focus ring (`calc(2 * var(--px))`; 3 art px round tokens and tiles), the small dark wells in the menus (2 art px: Overview's Blinds, the end screen's cells, the seed readout), a slider's track (1 art px) and scrollbar thumbs (4 px). Hairline dividers inside panels are one art pixel of `rgba(255,214,180,.10–.16)`; the Boss rule's is violet, `rgba(205,168,255,.18)`.

## Components

### Buttons
Tactile and lit: a face, a crisp highlight row and a lip that sinks.
- **Shape:** 9-slice pixel button, 12 art px tall (big: 16); in the compact layout the table's Play hand and Discard are 22 art px, every menu and dialog button is at least 44 px, and the menus' big buttons are 24 art px on a window 760 px wide or less.
- **Ember (primary):** Play hand, Play at the Blind select (named "Play the Small Blind, target 300"), Collect $N, Next Blind, Start run, Resume, Continue run, New run, How to play's Next, Use and Buy in an item's sheet, and the pick of the pack option being read. **Pink:** Discard, Reroll, Sell, and the confirm of Erase records and Abandon run. **Cream:** secondary actions (Skip, Pick or Use on a pack option not being read, Buy on the shelf, Back, Rank and Suit, the Move pair) on a `cream-2` face. **Violet:** no button wears a violet face (none is painted); a consumable acts through Use (ember) and Sell (pink) in its sheet. **Ghost:** its own translucent plum plate (`ghost-fill`) for quiet controls (the × close, Overview and Options, a pack's Skip, Abandon run, Erase records); Credits wears the opaque plum plate instead, to keep 4.5:1 over the bright hearth. **Disabled:** the plum plate (a `plum-2` face), ink `#C9A2B4` (5.4:1).
- **Press:** the face swaps to its `-down` frame, the label drops one art px, scale .97, over 110 ms ease-out at the Relaxed pace (divided by the game speed, as every `--t-*` duration is). **Hover** (fine pointers only): brightness 1.07, saturate 1.05.
- **Toggle groups** (Sort, Game speed, Motion): the pressed segment sinks in yellow and its label carries a one-art-pixel underline, so the choice never relies on hue.

### Chips (Pills)
- **Style:** Jersey 10 at 20 px, uppercase, on a 7×7 pill 9 art px tall, one per ramp (ember, pink, lime, cream, vio, blue, red, plum) with the dark or light ink listed in the frontmatter. At the table layout price tags and the payout's hanging tags and note pops are 10 art px tall at title size; small marks (an Edition, which hangs over its card's foot in the Shop and a pack, a sale, a Voucher owned, an Overview Blind, a run's result) are 8 art px tall in Tiny5, in their own case. Panel headers carry one pill naming the panel and its count (Jokers 4/5, Consumables 2/2); hand pills add the level in Tiny5.
- **On the room:** a label that sits on the bright floor rides on a small plum pill or a feathered plum pool (Sort, Move) to keep 4.5:1.
- **Long names:** a pill whose name outgrows its column wraps to a second line and grows (the Blind's and the hand's at the table, the Blind score's in a narrow top bar, a long pack name in a landscape phone's pack column); a name never runs out of its pill.

### Cards / Containers
- **Panels:** lit 9-slice with the warm lip; fill by job (default, warm for the Blind, deep for the Blind score, light for racks, violet-lit for the Boss).
- **Wells:** opaque dark blue or red, a lit bottom lip, a radial pool of the number's own colour under glowing numerals (XL where they fit, else L or S).
- **Playing cards:** 41 × 55 art px, cream stock lit from the upper left, ranks and pips in the art's suit inks (an indigo ramp down to `#272152` for Spades and Clubs, a red one down to `#B31B3D` for Hearts and Diamonds; Colour-coded suits give Clubs a deep green and Diamonds a royal blue) inside the `edge` outline, a warm wash clipped to the stepped outline, a light sweep when the card scores, a candlelight glint that follows the pointer. Hover lifts 3 art px; the idle bob is a two-frame one-art-pixel hop (3.3 to 4.1 s, `steps(1)`).
- **Joker frames:** the same size and layers; rarity in the frame colour (Common peach, Uncommon lime, Rare pink, Legendary violet); the name set in Tiny5 16 px on the plate drawn into the sprite, shortened to its most telling word when narrow, never clipped mid-letter; when the pixel size changes, every plate on screen (an open dialog's included) is set again in place for the new size. A Joker the Boss switches off is greyed and wears an "Off" pill.
- **Undiscovered** (Collection): the card's shape in warm plum with a lit lip and an unlit candle, never a black tile.

### Editions and Seals
- **Editions** bake their pixels into the card; the UI adds moving light with `ed-{id}`, in whole art pixels with `steps()`, never rotating: **Glitch** (`fourcolor`) a red plate 1 art px left and a blue plate 1 art px right as drop shadows, and two bands that slip by whole pixels for about 150 ms every 3.4 s; **Sheen** (`gloss`) a hard-edged 45° warm-white band about 6 art px wide crossing in 24 steps every 3.2 s, masked to a playing card's bare stock (a Joker's face masks it); **Dither** (`benday`) a field of light dots stepping 0 to 3 art px every 2.4 s; **Phantom** (`inverted`) an opaque pale ghost card that dips to .55 opacity for 120 ms twice per 2.4 s loop, with a 1-art-px ghost-blue glow (`spectral`); a Phantom Joker rests at .78 and dips to .5. Edition light is ambient: not divided by game speed, held still under reduced motion.
- **Seals** are four shapes at one spot (right edge x 38, top 4 art px above the card), laid over the card so the part above the edge shows: Encore a pink swallowtail ribbon, Paid a cream price tag on a red string, Comet a navy pennant with an ember comet, Cameo a pearl-rimmed maroon brooch. In a fanned hand each covered card wears its Seal as a tab over the top edge of its visible strip, at x 10 between the index and the pips; on a strip narrower than 19 art px (667 × 375) the tab moves left to end at the strip's edge and, once over the index, rides 2 art px higher, so the next card never hides it and it never covers the rank. A chosen covered card, risen clear of the next one, wears its Seal on its strip at the art's own height instead, below the Move pair; the Seal glides there with the lift (at once under reduced motion).

### Inputs / Fields
- **Seed field:** a dark translucent well 9-slice (`#14050F` at .5 with a lit lower rim), digits in Jersey 10 at 20 px with .16em tracking, placeholder in Bricolage 15 px (`#D2AFC0`); its focus ring sits 2 px out.
- **Switch:** a plum pill track with a cream knob; on, the track turns lime and the knob slides 10 art px (160 ms ease-out at the Relaxed pace). 44 px tall.
- **Slider:** a dark well track that fills with ember from the left, a pixel knob.
- **Focus:** the shared two-tone ring.

### Navigation
- Menus are panels of stacked buttons (title, Pause). Tabs (How to play, Collection) are Jersey 10 labels at 20 px, uppercase, in `muted`, 44 px tall, over a one-art-pixel hairline; the chosen tab lights its label (`ember-hi`; `vio-hi` in the Collection) and stands on a lit one-art-pixel bar in ember (violet in the Collection) with a soft glow, and a hovered label turns cream. The Collection's tabs wrap, never a hidden scroller. Dialogs close with an × button (44 px in the compact layout) and Esc.

### The Payout (signature)
Driven by the engine's step trace. At the authored Relaxed pace: the played cards arc to the stage over 480 ms and land (at 460 ms a 1-art-px shake and embers); at 580 ms the hand pill and wells pulse; from 780 ms each step pops its source: a card hops with a sweep, a number in its colour and a ring, a Joker jiggles and hangs a tag, a Boss emblem punches (steps 150 to 440 ms apart: a held card's 150, a note's 280, a played card's 350, a Joker's 440; past the tenth step every gap shrinks by 0.93 a step to a floor of 0.45); after a 180 ms rest Chips and Mult lock in and the stage row lifts and fades (320 ms). 280 ms later the plaque drops 22 art px on the bouncy spring (620 ms), swells 6 % and settles (660 ms from +260 ms), with a bloom (900 ms), an ember ring then a pink ring (1150 ms, 1000 ms at +130), 32 pixel shards in Chips blue, Mult red, lime and pink flung from its edge on the bouncy spring (1000 to 1420 ms), a whole-art-pixel shake and a flash of the room scaled by how far the total beat the target. 1120 ms later the total flies into the Blind score over 380 ms (an XXL total at half size, an XL or L one at its own); 380 ms after that the Blind score counts up over 640 ms in 18 eased steps with a lime ring, and, when the Blind is beaten, the pill turns to "Blind beaten" as the count ends. The cash-out dialog then springs in over the field (centred in the compact layout) with Collect $N in ember.

### Tooltips, Sheets, Toasts
- **Tooltip:** a nearly opaque 9-slice plate (`tip-fill`) with a pale lip, up to 96 art px wide: name in Jersey 10, kind in Tiny5 `muted`, text in Bricolage. Opens on hover, focus, tap or long press; can be hovered; Esc closes it alone. A press that starts on a tip only closes it: its click reaches no control underneath. A tip never covers the Move pair (it moves past the pair, up when it hangs above its target and down when below, or beside it where there is no room), and focus the game places (a closed dialog handing focus back, a sort) opens none.
- **Sheet:** anchored to its item on desktop, and still by it when a breakpoint redraws the item; a bottom sheet with 44-px actions in the compact layout.
- **Toast:** a tip plate (a lime lip for good news, a pink lip for errors), copy at 16 px.

## Do's and Don'ts

### Do:
- **Do** size every sprite, gap and resting offset in whole art pixels (`calc(n * var(--px))`), with `--px` 3 at 1024 × 870 and up and 2 below either.
- **Do** give each accent its one job: Chips `#4A62FF`, Mult `#E9382B`, money `#FFCE3B` flat with a `#D18A1D` rim, ember `#FF7A2B` for the way forward.
- **Do** tint every shadow, scrim and vignette plum (`rgb(26 4 18)`).
- **Do** set labels in Jersey 10 (20/30 px) or Tiny5 (16 px), readouts in the Ember digit face, and sentences in Bricolage Grotesque at 15 px or more with coloured keywords.
- **Do** animate only transform, opacity and filter, with CSS transitions, CSS animations or WAAPI (the shipped exceptions: the candle flames and Dither's dots step their `background-position`, a tab label's hover colour eases over 160 ms, and a chosen fanned card's Seal glides its `top` with the lift); land things on the damped springs (spring zeta 0.62, soft 0.86, bouncy 0.42, sampled into `linear()`) and enter on `cubic-bezier(0.23, 1, 0.32, 1)`.
- **Do** divide every gameplay duration by the game speed (Relaxed 1, Normal 1.6 (default), Fast 2.6, Blazing 4.5); keep ambient loops (room drift 46 s and 31 s, hearth 7.5 s, pool 9 s, flame 0.9 s in three steps, bloom 2.6 s, Edition light) at their own pace; zero every duration in test mode.
- **Do** keep fades only under reduced motion (the system setting or Options): no shake, flash, drift, parallax, glint, sweep, shard or flicker, and numbers land at once.
- **Do** pair each payout beat with its sound: select, deselect, deal, play, chip, mult, xmult, again (Encore!), total, beaten, collect, money, discard, boss, tag, buy, sell, reroll, pack, pick, use, skip, shuffle, flip, button, error, lose, win; all synthesised in the key of D major (the Game Over line borrows D minor's F, the Boss Blind's gong a G-sharp tritone), scoring ticks climbing the D major pentatonic, panned to where the source sits.
- **Do** show focus as the two-tone ring (2 px `#FFF0A0` outside, an `#2B1220` band inside, 3 px gap) for keyboard users only; bring a focused card above its neighbours; return focus to the opener (or the control drawn in its place) when a dialog closes, without opening its tip; leave room for the ring inside everything that scrolls (6 px in most: a dialog body, the compact Joker rack, the Shop's shelves and rows, a pack's options, the run setup's Deck and Stake) so no ring is cut, and scroll a control the keyboard focuses there whole into view.
- **Do** keep every control a real button whose name starts with the word it shows, and the table playable from the keyboard (1 to 9, Enter, D, S, I, Esc; Shift with an arrow moves a card).
- **Do** keep text at 4.5:1 against the pixels actually behind it, large numerals at 3:1; step a pill one shade deeper or put a plum pool under a label rather than fade it.

### Don't:
- **Don't** lay a filter over the screen, give text a hard drop shadow, or borrow another game's look: the room, the type, the panels and the colours are this file's (Overview, Colors, Typography, Components).
- **Don't** copy another game's card, Joker, deck-back or stake art, or its logo, item names, text or menu copy, and never give an item the same effect and the same number as one on the off-limits list (SPEC.md §0).
- **Don't** draw a Seal as a wax blob or a round disc: the four Seals are the shapes of Editions and Seals, and none is gold.
- **Don't** give an Edition any look but its own (Editions and Seals: Glitch's fringe, Sheen's sweep, Dither's dots, Phantom's pale ghost), and let the score glow, never burn.
- **Don't** code money in gold: no gold ramps, chrome trims, coins, bulbs, jackpot banners or other casino cues.
- **Don't** set the room's candles in rows or bulb strips: candle groups stay irregular.
- **Don't** go all one colour or dark: the room stays plum to burnt orange and the edges fall into warm plum, never black.
- **Don't** make cards plain, or scoring quiet: the payout stays as juicy as Lit's peak or juicier.
- **Don't** rotate a sprite at rest, smooth or blur sprite pixels, or show two art-pixel sizes on one screen.
- **Don't** set long copy in a pixel face, or any copy below 15 px.
- **Don't** use harlequin diamonds or commedia half-masks, a parchment logbook, or the navy-and-gold pier arcade.
- **Don't** put any word on screen but the game's own and the genre's system words (SPEC.md §1): the goal is the Target, the running total the Blind score, the run summary Overview and a retrigger Encore!; the cash-out says "Collect $N" and the Blind select's button "Play".
- **Don't** add a `requestAnimationFrame` loop or an animation library.
