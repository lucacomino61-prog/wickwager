# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- One self-contained HTML file, `index.html`, built from `src/` by `node tools/build.mjs`. It opens straight from disk and loads nothing from the network.
- Plain JavaScript and CSS. Each part is a classic script that adds to `globalThis.TW`: the content tables (`TW.Content`), the sprites (`TW.Art`), the rules engine (`TW.Engine`), the sound (`TW.Audio`) and the screens (`TW.UI`). The file layout and owners are in `ARCH.md`; the rules and the engine API are in `SPEC.md`.
- Every sprite is pixel art drawn in code; every sound and both music loops are synthesised with Web Audio. There are no image, audio or font files apart from the three OFL fonts embedded in the stylesheet.
- One animation engine: CSS transitions and animations plus the Web Animations API. No `requestAnimationFrame` loops and no animation libraries.

## Users

The owner, and players like them: fans of poker-hand roguelike deckbuilders who play short runs (30 to 60 minutes) in a browser tab. Mostly desktop with mouse and keyboard; sometimes a phone held upright, with touch.

## Product Purpose

**Wickwager** (working title; earlier builds were called Tidewager and Kapow Poker) is an original poker-hand roguelike set at a candlelit card table.

You play poker hands from a 52-card deck to beat rising score targets, scoring Chips × Mult. Between Blinds you spend money in the Shop on Jokers, Tarot, Planet and Spectral cards, Booster Packs and Vouchers. Clear eight Antes to win, then keep going in Endless mode.

Success means a run feels tense and readable, and every scoring moment pays off.

## Positioning

The game is built on the genre's game design, with its systems and their names:
- **Structure:** Antes of three Blinds (Small Blind, Big Blind, Boss Blind), Chips × Mult scoring, hand levels, Endless mode.
- **Jokers:** five slots, bought and sold, common to Legendary. There are 120 of them, each with its own name, effect and pixel drawing.
- **Consumables:** Tarot, Planet and Spectral cards in two shared slots.
- **Card upgrades:** Enhancements, Editions and Seals.
- **Between rounds:** the Shop with Booster Packs (Card, Tarot, Planet, Joker and Ghost Packs in three sizes), Vouchers and rerolls; Tags for skipping a Blind; interest.
- **Choices and progress:** ten starting Decks, four Stakes, records and a Collection.
- **Screens:** the Blind select, the play table, the cash-out and the Shop, in the order a run meets them (SPEC.md §6.1).

Its look and its items are its own:
- its own name and logo, pixel art, cards and Jokers, music and menu copy, and the room, panels, type and colours of the Ember Lit look (DESIGN.md);
- no item takes a name from the off-limits list (SPEC.md §0), and no item has the same effect and the same number as one on it.

## Operating Context

Played in a browser tab, run after run. Sessions get interrupted, so a run in progress survives closing the tab: it is saved after every action and Continue brings it back at any phase (Blind select, mid-Blind, the cash-out, the Shop, an open pack). Played with a mouse on desktop and by touch on a phone, often in a small browser window: every screen of a run fits a window from 600 px wide and 600 px tall (1366 × 620, 1280 × 650, 900 × 650, 800 × 620, 600 × 800) with no page scroll and every button whole and in reach (in view, or a scroll of its own row away where a row outgrows the window: Night Market's seven items on a narrow window, a pack of six, the Shop's shelves on a window 1024 to 1279 px wide and 870 px tall or more).

## Capabilities and Constraints

- **Loop:** title, then New run (Deck, Stake and an optional seed), then choose a Blind or skip it for a Tag, play or discard hands, Collect $N at the cash-out, the Shop, the next Blind. Eight Antes of three Blinds, then Endless mode.
- **Screens:** title, run setup, Blind select, the play table, the cash-out, the Shop, an open Booster Pack (with the hand Tarot and Ghost Packs deal), Overview, the deck view, Options, Pause, How to play, Records, the Collection, Game Over and You win!.
- **Persistence:** `localStorage` keys `ember:settings`, `ember:run` and `ember:records` (a `test:` prefix in test mode). Every call is guarded; the game keeps working in memory when storage is unavailable, and then Save and quit says the run could not be saved and lasts until the page closes, never "Run saved".
- **Settings:** game speed (four paces), sound effects and music volume, mute, screen shake, motion (Auto, Reduced, Full), colour-coded suits, keyboard shortcuts (on by default).
- **Test hooks:** `?test=1` (no motion, no sound, separate storage), `?seed=`, `?speed=`, `?screen=`; `window.__wick` and `TW.app` for scripted checks. The scripted player in `tests/e2e/playthrough.mjs` plays whole runs through the real UI.

## Brand Commitments

- **Name.** Wickwager is a working title (a wick and a wager: the Blinds are candles, the Antes and Stakes are bets). It appears only in the game's text, so a rename is a find-and-replace; the save keys do not depend on it.
- **The look: Ember Lit** (`mockups/ember-lit/`, chosen 2026-11-23). The approved Ember pixel table, relit as a 2026 indie game: a warm plum, maroon and burnt-orange room in three depths, crisp pixel sprites shown at one whole-number scale (3 CSS px per art pixel on a window at least 1024 px wide and 870 px tall, 2 on a phone, a tablet and a shorter laptop window), and light, bloom, glow and depth as separate layers around them. Lit 9-slice panels with a warm lip, pills, damped-spring motion, and a payout that ends in a plaque, rings, pixel shards and a flash of the room.
- **Grafts onto Lit:** long copy (descriptions, tooltips, help, options) is set in Bricolage Grotesque at 15 px or more with coloured keywords; the cash-out button says "Collect $N", and the Blind select's button says "Play" (the orchestrator's ruling of 2026-11-25); nothing rotates at rest; candle groups stay irregular, never bulb strips; money is flat yellow with one amber rim, never gold or jackpot styling.
- **Rejected looks: standing don'ts.**
  - The parchment logbook.
  - The navy-and-gold pier arcade, for four reasons that stand as rules: it felt like a phone casino app; it was too dark and all one colour; the cards and art looked plain; scoring wasn't juicy enough.
  - Comic pop (picked, then replaced by the Ember look), and the cooler "Night" pixel look.
- **Language.** The genre's system words as they are: Chips, Mult, Ante, Small Blind, Big Blind, Boss Blind, Joker, Tarot, Planet, Spectral, Voucher, Tag, Booster Pack, Stake, Enhancement, Edition, Seal, Deck, Shop, Game Over, You win!, Endless mode. Item names and texts always come from `TW.Content`. Every other label is the game's own: **Target** (what a Blind asks), **Blind score**, **Blind beaten**, **Overview** (hand levels, this Ante and the run; the I key and the info icon), **Unlit** (a Blind still to come), **Next Blind** (the Shop's way out, announced "On to the next Blind."), **Play** (the Blind select's button, named "Play the Small Blind, target 300"), **Collect $N**, the **Blind** count beside the Ante (the Blinds played or skipped, plus one), **Encore!** (a retrigger, the engine's step label), and on the end screens **Brightest hand**, **Favourite hand** and **Cards tossed** (the orchestrator's wording ruling of 2026-11-24, 11:20).

## Evidence on Hand

None beyond the game itself. Everything is authored in code. Do not invent player counts, reviews or store pages.

## Product Principles

1. Every number the player needs is on screen at the moment they need it.
2. The scoring moment is the reward. It lands every time, and it is as juicy as the Lit mockup's peak or juicier.
3. The genre's design, our own content and look. Never a reskin of another game's items.
4. A run is short, can be interrupted at any moment, and makes you want one more.

## Accessibility & Inclusion

- Suits are told apart by their pixel pips' shapes, not only colour.
- Colour-coded suits (Options, off by default) draws Clubs in deep green and Diamonds in royal blue, so the four suits also part by colour for colour-blind players (ART.md section 11).
- Every control is a real button with a name that starts with the word it shows, and a whole Blind plays from the keyboard (1 to 9 select, Enter plays, D discards, S sorts, I opens Overview, Esc pauses). The one-key shortcuts can be switched off in Options (Keyboard shortcuts), and Options and How to play list them. On a focused card Enter chooses it, as Space does.
- The hand's order changes without a drag too: Shift with an arrow key moves the focused card, and while exactly one card is chosen a Move pair (left, right) stands over the hand for a click or a tap. A phone's Jokers move from their sheet.
- Focus shows a ring for keyboard players only, two-tone (pale yellow outside, the art's dark plum edge inside) so it reads on cream cards, the lit floor and plum panels alike; a focused card comes up over its neighbours. Focus never drops to the page: it goes back to the button that opened a dialog (also inside Pause, and to the one drawn in its place when a breakpoint redrew the screen under the dialog), to the rack item in a sold one's place, and to the dealt hand after Play at the Blind select; a card keeps it while S sorts the hand. Focus the game places opens no tooltip. A dialog body that scrolls is a stop the keys scroll, and a row that scrolls (the compact Joker rack, the Shop's row, a pack's options) keeps room for the whole ring; the keyboard brings a control the row has only partly in view whole into view.
- Tooltips open on hover, focus, a tap or a long press; they can be hovered, and Esc closes one on its own. A press on a tip only closes it (the click reaches nothing under it), and a tip never covers the Move pair.
- Text keeps 4.5:1 contrast against what is actually behind it (checked on the rendered pixels by `tests/e2e/a11y.mjs`); large numerals keep 3:1. With a reader's own text spacing nothing is cut: the Blind, Blind score and hand pills wrap, and a Boss rule the layout cuts short (to two, three or four lines) opens its whole rule in its tip.
- One polite live region speaks for the game: each hand's score, the Blind's result, the cash-out, Tags, Joker reactions, the end of the run, every toast (said once), and the cards chosen with the hand they make. The column's readouts are plain text, so a count-up is never spoken step by step.
- Reduced motion (the system setting, or Options) keeps fades only: no shakes, flashes, drift, parallax, slides or flourishes, and numbers land at once.
