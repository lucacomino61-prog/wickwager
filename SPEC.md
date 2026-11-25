# Build spec v3

> **v3, 2026-11-23.** Replaces the v2 spec ("Tidewager"). The game is a poker roguelike that uses the genre's system words. Its working title is **Wickwager** (`BUILD-LOG.md`); the title appears only in the game's text, so this spec says "the game".
>
> What changed from v2:
> - The genre's system words replace the sea words (§1).
> - The tide (Day/Night, High/Low) mechanic is gone, with every item that depended on it.
> - Added: Editions, Seals, Spectral cards, Legendary Jokers, Booster Pack sizes, Vouchers, Tags, Decks and Stakes from `content/systems.json`.
>
> Two owner decisions override `content/systems.json` where they differ. `content/systems-v3.json` (decisions `packpicks` and `jokersell`) records how they apply, and this spec follows it:
> - Tarot, Planet and Spectral cards picked from a Booster Pack are used at once and never stored. Tarot and Spectral cards act on a hand of cards dealt from the deck while the pack is open, as in the genre (§2.9).
> - Every Joker sells for half its cost, rounded down (minimum $1). That includes Legendary Jokers and Jokers gained for free. The High Roller Deck keeps its twist on the same basis: its Jokers sell for their full cost (§2.8).
>
> **2026-11-23 (Jokers).** The content pass and the Joker vocabulary are in:
> - Every name and text in `src/content.js` now comes from `content/content-plan.json` by id, with its three number decisions: Sequined (`popout`) gives ×1.4 Mult, Second Look (`secondlook`) keeps the reroll price flat (`flatRerolls`), and Wickwisp (`spellbound`) follows decision `wickwisp` (§3.8).
> - The Joker vocabulary (§3.4) has the 70 words the 120 Jokers of `content/content-plan.json` need, the copy mechanism of Stand-In, Old Flame and The Puppet Master included. `Engine.jokerProblems` accepts all 120 `engine` rows.
> - The Joker table is the 120 Jokers of `content/content-plan.json` (§3.4): 60 common, 40 uncommon, 15 rare and 5 Legendary, each with its plan `engine` row. 27 of them rename the v2 charms through `oldId`; records and saved runs that still hold a v2 Joker id map through it (§4.2).
> - The engine reconcile (2026-11-23 (Jokers)): §3.4 lists all 120 Jokers with their words and rows; a Shop item or pack option that names no content row is refused instead of taking the money (§4.2); `addJoker`, `serialize` and `applyRunToRecords` never throw (§4); the fuzz and a scoring benchmark are in §7.
>
> **2026-11-24 (final pass).** The wording follows the UI, and the wording ruling (REQUESTS.md): the genre's system words stay, and every other UI word is the game's own.
> - UI words (§1, §2.8, §2.13, §6): **Target**, **Blind score**, **Overview**, **Next Blind**, **Unlit**, **Brightest hand** and **Favourite hand** on the end screens, and the Blind count **Blind n**. The Blind texts say "Reach the Ante target".
> - The retrigger note reads `'Encore!'` (§1, §2.4, §4.3).
> - The Squeeze limits plays only, never the selection or a discard (§2.3, §6.2).
> - An Endless run's history entry follows the run to the Ante it reaches, and history entries keep the run's seed (§4.2).
> - Part 2 (no rule changed; the spec follows what the UI ships): §6.7 describes every layout, the landscape phone and the short upright phone among them; a full storage keeps the newest copy in memory and says so once (§5); input waits for the deal (§6.2); on a focused card Enter chooses it, Shift with an arrow moves the focused card and the Move pair the chosen one, and Esc closes a tooltip first (§6.4, `move-card` in §6.5); Options gains Mute all sound and Keyboard shortcuts (§6.6).
> - Part 3 (no rule changed; the spec follows what the UI ships): the Blind select's button says *Play* in the UI too (§6.1); Save and quit says when the run could not be saved (§5); the table's buttons come back once input is free, a tip keeps clear of the Move pair and a press on a tip only closes it (§6.2); `S` keeps focus on a focused card, and closing a dialog hands focus to its opener or to the control drawn in its place, opening no tip (§6.4); §6.7 adds the landscape phone's two-column pack, the racks stepping aside for packs on a compact window from 600 px wide and 760 px tall or less, what crossing a breakpoint draws again, the Seal tab on a narrow or a chosen strip, the short upright phone's lift, the Joker rack's room for the focus ring and the fanned hand's strips, the one tap target under 44 px; an unlock is said once (§6.8).

This file is the contract. Every module is built against it. Where it is ambiguous, pick the simplest reading that keeps the game readable and fun, and report the choice. Do not change the public APIs in §4 or §6.5 without saying so. `ARCH.md` holds the shared build contract (file layout, owners, the art and UI contracts).

**Where things live:**
- The rules and numbers live in this spec, the engine (`src/engine.js`) and the content tables (`src/content.js`).
- The design they come from is `content/content-plan.json` (readable: `CONTENT.md`; what was checked: `content/CHECKS.md`; `content/` and `CONTENT.md` stay on the build PC, outside the repo). It merges `content/systems-v3.json` (the systems in the Ember look, from `content/systems.json`, with the owner decisions applied), the 120-Joker design and the content check, and keeps every id of `content/systems.json`.
- The display names and texts live in `content/content-plan.json` and `src/content.js`. A re-theme may change names and texts, never ids or numbers. Everything is keyed by id.

---

## 0. Ground rules

- **Direction from the owner: follow the genre's game design.** That means its structure and mechanics, and its system words: Chips, Mult, Ante, Small Blind, Big Blind, Boss Blind, Joker, Tarot card, Planet card, Spectral card, Voucher, Tag, Booster Pack, Stake, Enhancement, Edition, Seal, Deck, Shop, run, Game Over, You win!, Endless mode, Legendary.
- **Never copy another game's items or look:**
  - No item name from the off-limits list (the items whose names and effects the game must not take; `ORIGINALITY.local.md` points to it, and both stay on the build PC, outside the repo). That covers every kind: Jokers, Blinds, Decks, Stakes, Tarot, Planet and Spectral cards, Vouchers, Tags, Enhancements, Editions, Seals and Booster Packs.
  - No item that matches an item on that list in both effect and number, across item kinds too (a Voucher that plays like a listed Joker, an Enhancement like a listed Edition).
  - Not another game's name, logo, pixel art (its cards, Jokers and sprites), fonts, panels, effects, music or menu copy. Pixel art as such is allowed: the owner approved the Ember pixel look and its pixel fonts.
  - The §0 content test (`tests/engine.test.mjs`) checks every content name and text against the off-limits list wherever the list is present.
- **Files** (ARCH.md §3 has the owners):
  - `src/content.js`, `src/art/*.js`, `src/engine.js`, `src/audio.js`, `src/ui/*.js`, `src/styles/*.css` and `src/shell.html`.
  - `node tools/build.mjs` inlines them in this order: `src/styles/*.css` (file-name order) into the shell, then content → art (name order) → engine → audio → ui (name order).
  - The result is one HTML file, **`index.html`** in the project root (BUILD-LOG.md decision: not named after the title, so a rename is a find-and-replace). It opens straight from disk.
  - The shell needs the markers `<!-- @style -->` (in `<head>`) and `<!-- @scripts -->` (end of `<body>`).
  - The `TW` namespace stays.
- **No libraries and no network.** Plain JS and CSS. Fonts and every other asset are embedded (ARCH.md §2); the build refuses a network URL. No image files: sprites are drawn in code.
- **Script format.** Each JS file is a classic script (not an ES module) wrapped in an IIFE that attaches to a shared namespace:
  `(() => { const TW = (globalThis.TW = globalThis.TW || {}); … })();`
- `content.js`, the art files (except `TW.Art.url`) and `engine.js` must run in Node with no DOM: no `window`, `document`, `localStorage` or `Date`. `Math.random` is allowed only in `Engine.randomSeed()`.
- Never write a literal `</script` inside JS (write `<\/script`).
- **Animation:** native CSS transitions and animations, and the Web Animations API only; no `requestAnimationFrame` loops (ARCH.md §2).

## 1. Terminology (UI text uses exactly these words)

| Concept | Word |
|---|---|
| Score round | **Blind**: Small Blind, Big Blind, Boss Blind (three per Ante) |
| Level of three Blinds | **Ante** (Ante 1 … Ante 8; Endless mode after) |
| The Boss Blind's twist | **Boss Blind** (each has a name and a rule) |
| Base points | **Chips** |
| Multiplier | **Mult** |
| Hand score | **Chips × Mult** |
| Passive modifier | **Joker** (5 Joker slots; rarities common, uncommon, rare, Legendary) |
| Consumables | **Tarot cards**, **Planet cards** and **Spectral cards**, sharing **2 consumable slots** |
| Card upgrades | **Enhancement**, **Edition** (also on Jokers), **Seal** |
| Permanent run upgrade | **Voucher** |
| Reward for skipping a Blind | **Tag** |
| Pack | **Booster Pack**: Card, Tarot, Planet, Joker and Ghost Packs, each Normal, Jumbo or Mega |
| Shop | **Shop** |
| Starting deck choice | **Deck** |
| Difficulty | **Stake** |
| One playthrough | **run** |
| Losing | **Game Over** |
| Winning | **You win!**, then **Endless mode** |
| A card scoring again | **retrigger**, shown as "Encore!" (final pass) |
| The score a Blind asks for | **Target** (final pass) |
| The score so far in a Blind | **Blind score** (final pass; "Blind beaten" once it is beaten) |
| The overlay with the hand levels, this Ante, the Deck, Stake, Vouchers and seed | **Overview** (final pass) |
| A Blind's status | **Cleared**, **Skipped**, or **Unlit** for one still to come (final pass) |
| Leaving the Shop | **Next Blind** (final pass) |
| Starting the raised Blind at the Blind select | **Play** (final pass, part 3) |
| The count of Blinds played or skipped, +1 | **Blind n** (final pass) |

Money is written `$12`. The suits are Spades, Hearts, Diamonds and Clubs. Every other label, button, status word and callout is the game's own, and the content check and the unit tests keep the UI to it (§7).

---

## 2. Rules

### 2.1 Cards
- The standard deck has 52 cards: ranks 2–14 (11 = J, 12 = Q, 13 = K, 14 = A) and suits `'S'`, `'H'`, `'D'`, `'C'`.
- Card object: `{ uid:'c7', rank:12, suit:'H', enhancement:null|enhancementId, edition:null|editionId, seal:null|sealId, grow:0 }`.
  - A card holds at most one of each. Applying another of the same kind replaces it.
  - `grow` is the Chips a Vintage card has stored.
- **Uids:** `'c' + run.nextUid++` for cards, `'h' + n` for Jokers and `'k' + n` for consumables, all from the same counter. A uid is unique within a run.
- Joker instance: `{ uid:'h4', id, state:{…}, paid, edition:null|editionId }`. Consumable: `{ uid:'k9', kind:'tarot'|'planet'|'spectral', id }`.
- **Card Chips:** ranks 2–10 give their rank; J, Q and K give 10; A gives 11. Face cards are J, Q and K.
- Suit order for sorting and display: S, H, C, D.

### 2.2 Poker hands
Strongest first. Columns: id, name, base Chips, base Mult, Chips per extra level, Mult per extra level. The per-level values are new in v3; the base values are unchanged.

| id | name | Chips | Mult | +Chips/lv | +Mult/lv |
|---|---|---|---|---|---|
| straightflush | Straight Flush | 110 | 8 | 45 | 4 |
| four | Four of a Kind | 64 | 6 | 32 | 3 |
| fullhouse | Full House | 44 | 4 | 27 | 2 |
| flush | Flush | 38 | 4 | 18 | 2 |
| straight | Straight | 34 | 4 | 32 | 3 |
| three | Three of a Kind | 32 | 3 | 22 | 2 |
| twopair | Two Pair | 22 | 2 | 22 | 1 |
| pair | Pair | 12 | 2 | 16 | 1 |
| high | High Card | 5 | 1 | 12 | 1 |

Hands start at level 1. At level L the value is `base + (L − 1) × perLevel`.

**Detection** over the played cards (1–5 cards, in play order):
- **Straight:** exactly 5 cards with 5 distinct ranks in a run. An Ace plays high (10-J-Q-K-A) or low (A-2-3-4-5). No wrap-around.
- **Flush:** exactly 5 cards of one suit. A **Masked** card matches any suit, unless The Wash-Out is active. So the other cards all share one suit, or every card is Masked.
- **Straight Flush:** both of the above.
- Otherwise use the rank counts, strongest first: four or more of one rank → Four of a Kind; three plus two → Full House; then Flush; then Straight; three → Three of a Kind; two plus two → Two Pair; two → Pair; anything else → High Card.
- **Joker rule words that change detection** (§3.4; added 2026-11-23 (Jokers)). They come from the active Jokers, copies included, and apply the same way in scoring and in `Engine.preview`:
  - `wrapStraights` (Merry-Go-Round): a Straight may also run on the loop … Q-K-A-2-3 …, so J-Q-K-A-2, Q-K-A-2-3 and K-A-2-3-4 count. In one suit it is a Straight Flush.
  - `fourCardFlush` (Fan Dancer): a hand of 4 or 5 cards with at least 4 cards of one suit is a Flush, and only the cards of that suit score. A 5-card Straight with at least 4 cards of one suit is a Straight Flush, and all 5 score. Full House and Four of a Kind still win.
  - `wildJacks` (Jack of All Trades): each Jack may stand in for any one rank (2 to Ace), chosen to make the strongest hand: the strongest hand first, then the most scoring cards, then the highest standing-in ranks among them (when two Jacks could take different ranks, the earlier one in play order takes the lower rank). A Jack keeps its own Chips (10) and stays a Jack and a face card for every other rule. Five cards of one rank are a Four of a Kind, and all five score. The engine tries only the ranks that can matter: for a Straight, the ranks each run of five (the loop with `wrapStraights`) is missing, and otherwise the other cards' ranks plus the highest ranks none of them has, one per Jack; the answer is the one the search over every rank gives (changed 2026-11-23 (Jokers, engine fix), for speed: five Jacks took 6,188 classifications, about 15 ms per `Engine.preview`; now at most 139).
  - `everySuit` (Sir Motley): every card counts as every suit, for detection and every suit check, and The Wash-Out does not switch it off. Every 5-card hand is at least a Flush.
- **Scoring cards:**
  - Straight, Full House and Straight Flush: all 5 cards. Flush: all 5 cards, or the cards of the Flush's suit with `fourCardFlush`.
  - Four of a Kind: the cards of that rank. Three of a Kind: the three. Two Pair: the four. Pair: the two.
  - High Card: the single highest rank.
  - **Cameo Seal:** every other played card with a Cameo Seal also scores (unless The Blackout), kept in play order. It never changes the hand type.
  - Other played cards are *unscored*. They are still played and discarded, but add nothing.

### 2.3 A Blind
- **Start** (`startBlind`, from `'blind-select'`):
  1. The draw pile is every deck card, shuffled by the run's RNG.
  2. `handsLeft = max(1, run.hands + pending.extraHands + (Boss Blind ? Midnight Oil's +1 : 0) + (The Short Fuse ? −2 : 0))`.
  3. `discardsLeft = max(0, run.discards + pending.extraDiscards)`, and `blind.handSizeDelta = pending.handSizeDelta` (normally 0).
  4. The target uses `pending.targetMult` (§2.6), and `score = 0`.
  5. Pending Blind effects are used up. `pending.sale` stays for the next Shop.
  6. The Spoilsport marks its hand, The Wet Blanket marks the leftmost Joker, and The Smudge sets `blind.hideRanks`.
  7. Draw `handSizeNow` cards; the phase is now `'play'`.
  8. Every active Stand-In picks a new target (§3.4, copy), then the Jokers' `blindStart` events fire (Fortune Cookie re-rolls its rank, Doorman pays $1, Thimble seals a card in hand, Moonstruck creates a Planet card when it is a Boss Blind; balance 2026-11-23). Changed 2026-11-23 (Jokers): the events come after the deal, so they can see the hand; the deal uses no RNG, so every seed plays as before.
- **Hand size:** `handSizeNow = max(1, run.handSize + (Boss Blind ? Long Sleeves's +1 : 0) + blind.handSizeDelta)`. Outside a Blind it is `max(1, run.handSize)`.
- **Play** 1–5 cards from the hand (The Squeeze: 1–4; changed 2026-11-23 (Jokers, balance): was 1–3). Play order is their order in the hand. The Squeeze limits plays only: a discard still takes 1–5 cards, so the hand may always hold 5 selected cards (§6.2).
  1. **The Fade:** if this is not the Blind's first hand, the score first drops: `score = floor(score × 0.85)`. The engine applies it once the hand has scored, which gives the same numbers (scoring never reads the Blind's score), so a refused or failed hand never fades the score (changed 2026-11-23 (Jokers, engine fix)).
  2. Score the hand (§2.4), add the total, and add the step money.
  3. Apply the Vintage growth the score reports (`result.grow`).
  4. Bookkeeping: the Joker gains counted during scoring are stored (`result.jokerGains`, §2.4); `handsLeft −1`; the played cards go to the discard pile; the Jokers' `afterHand` events run (Lamplighter, Dripping Candle, Heads or Tails, Coronation). A Joker eaten there leaves the rack (`eaten`).
  5. If the Blind is neither cleared nor lost, draw back up to `handSizeNow` from the draw pile. There is no reshuffle. The Shuffler and The Big Finish instead sweep every hand card back into the draw pile, shuffle, and draw a fresh hand.
- **Discard** 1–5 cards:
  1. The Tollbooth charges $2 and blocks discarding below $2.
  2. The Fumble adds 1 random unselected card from the hand (if any). It is a discard in every way.
  3. For each discarded card, in hand order:
     - Crumpled gives +$1, unless The Wash-Out.
     - A Comet Seal creates a Planet card for the most-played hand when a consumable slot is free, unless The Blackout. With nothing played yet, it picks a random hand.
  4. `discardsLeft −1`, unless the discard is free:
     - `freeFirstDiscard` (the v2 Fishhook row): the first discard of a Blind is free.
     - `freeSmallDiscard: n` (Sleight of Hand, n = 2): once per Blind, a discard of at most n selected cards is free (The Fumble's extra card is not counted). `blind.freeDiscardUsed` records that it was used; one Joker or copy with the rule gives one free discard, never more.
     - A free discard still needs at least 1 discard left, and The Tollbooth still charges its $2.
  5. The Jokers' `discard` events run (Magpie, Face Value, Palm Reader, Carpetbag), then the hand draws back up.
- **Cleared:** the moment `score ≥ target` after a hand.
  1. The cards still in hand are recorded (`blind.heldAtClear`, for Paid Seals).
  2. The Jokers' `blindCleared` events run (Gingerbread Fool, Poker Face, Dragon Tamer, Nail-Biter, Hot Cocoa, Shoeshine, Night Moth). A Joker eaten there leaves the rack.
  3. Then the cash-out (§2.7).
- **Lost:** phase `'gameover'`. That happens when `handsLeft` reaches 0 with `score < target`, or when nothing is left to play (hand and draw pile both empty).
- **Sorting:** the hand is kept sorted by `run.sortMode`.
  - `'rank'`: rank descending, then suit order.
  - `'suit'`: suit order, then rank descending.
  - Reordering a hand by hand sets `'manual'`; new cards are then appended on the right.
- The same hand rules (draw, sort, reorder) apply to a Booster Pack's dealt hand (§2.9).

### 2.4 Scoring order (this produces the step trace)
1. **base:** the hand's Chips and Mult at its level, note `'<name> lv.<n>'`.
2. **Boss pre-pass:** The Heckler boos the highest-ranked scoring card, the leftmost on ties, Cameo cards included. It adds the note `'Booed'`. That card skips step 3 entirely, retriggers included.
3. **Scoring cards**, left to right in play order. A Cameo card that the hand itself does not score first gets a note `'Cameo'`.
   - `passes = 1 + extra passes`:
     - an Encore Seal adds 1, unless The Blackout;
     - then each Joker's `retrigger` effect adds its `times`, Jokers left to right.
   - Every pass after the first starts with a note `'Encore!'` (via `'retrigger'`). The note names the Seal or the Joker the pass came from.
   - Each pass runs, in order:
     - **(a) rank:** +card Chips. A Phantom card gives the same amount as Mult instead, unless The Blackout.
     - **(b) Enhancement,** unless The Wash-Out: Waxed +35 Chips; Kindled +5 Mult; Gilt-Edged +$1; Sequined ×1.4 Mult; Masked +10 Chips. Vintage stores +4 Chips for good, then gives everything stored, so the passes give +4, +8, +12 and so on.
     - **(c) Edition,** unless The Blackout: Sheen +40 Chips, Dither +8 Mult, Glitch ×1.6 Mult.
     - **(d) Jokers:** each active Joker's on-card effects, Jokers left to right.
     - **(e)** the Jokers' `cardScored` events (Jack-in-the-Box): state gains on a per-hand copy of the state, so this hand's later steps already see them.
4. **Held cards** (the cards still in hand), left to right.
   - Each pass gives Spotlit +3 Mult (unless The Wash-Out), then each active Joker's on-held effects.
   - Passes are counted as in step 3, from Joker `retrigger` effects with `of:'held'`. A held card whose first pass gives nothing gets no extra passes.
5. **Jokers**, left to right, skipping the one The Wet Blanket switched off.
   - First, once, the Jokers' `handScored` events (Accordion), gains as in 3(e).
   - In order: the Joker's Edition first (Sheen +40 Chips or Dither +8 Mult), then its hand effects, then Glitch ×1.6 Mult. A copier's hand effects are its targets' (§3.4); its Edition is its own.
   - Edition steps fire even when the Joker's own effect gives nothing. There are none under The Blackout. A Phantom Joker has no Edition step.
6. **Boss post-pass:**
   - The Lid caps Mult at 12, plus 6 for each Ante after Ante 3 (`'Capped at 18'` at Ante 4; only when Mult is above the cap). Changed 2026-11-23 (Jokers, balance): the cap was 12 at every Ante (§3.9).
   - The Spoilsport gives ×0.5 on the marked hand (`'Half Mult'`).
   - The Warm-Up gives ×0.5 on the Blind's first hand (`'Warm-up: half'`).
7. `total = floor(Chips × Mult + 1e-9)`.

How the numbers combine:
- "+Chips" and "+Mult" add; "×Mult" multiplies the running Mult. Mult is rounded to 6 decimals after every operation (from 1e15 up it is left as it is: no decimals are left to round).
- Chips, Mult, the total and the Blind's score never pass the largest finite number (`Number.MAX_VALUE`, about 1.8e308); they stop there instead of becoming Infinity, which JSON would save as null (added 2026-11-23 (Jokers, engine fix)).
- `scoreCards` is pure. It simulates Vintage growth in order (a retriggered Vintage card grows twice in one hand) and returns it as `result.grow`. Money from steps is added only when the hand is played.
- It simulates Joker gains the same way (`cardScored`, `handScored`): it reports them in `result.jokerGains` and `playHand` stores them (added 2026-11-23 (Jokers)).
- A Joker switched off by The Wet Blanket does nothing at all during that Blind, its Edition included. A Phantom one still takes no slot.
- Rule words that change scoring (§3.4; added 2026-11-23 (Jokers)):
  - `editionsTwice` (Kaleidoscope): every Edition step fires twice in a row: a card's Sheen, Dither or Glitch on every pass, a Phantom card's rank-as-Mult step, and a Joker's Sheen, Dither (before) and Glitch (after). Nothing under The Blackout; a Phantom Joker has no step to double.
  - `blindMoneyX: x` (Golden Hour): during a Blind, money steps from cards and Jokers are worth x times as much (the step shows the multiplied amount), and so are Crumpled's discard money and the Jokers' event money (Face Value, Doorman, Crystal Gazer). Cash-out lines, Tarot and Spectral cards, Paid Seals and sell prices are not changed.
  - `acesAreFaces` (Court Ace): every face-card check (the `face` condition, `perFace`) also counts Aces.

### 2.5 (No tide)
v2's tide is gone. There is no tide state, no turning, no Tide Clock and no Lighthouse Deck, and the four tide Jokers are removed. The section number is kept so the other sections keep theirs.

### 2.6 Antes, Blinds, targets, rewards
- Base target by Ante: `[300, 700, 1700, 4000, 8500, 16000, 28000, 45000]`. For an endless Ante n > 8: `round(45000 × 1.75^(n−8) / 100) × 100`, exactly, at every Ante (changed 2026-11-23 (Jokers, engine fix): from Ante 47 the rounding drifted, by +200 at Ante 47 and +195,600 at Ante 60). The engine works it out in integer arithmetic (1.75 is 7/4, halves round up) and takes the nearest number once (changed 2026-11-24 (final review): the floating-point product still landed on the neighbouring multiple of 100 at 387 Antes from Ante 60 on, 195519935576272500 instead of …400 at Ante 60). A target too large for a number stops at `Number.MAX_VALUE` instead of becoming Infinity: on the Twilight Stake the Boss Blind from Ante 1256, the Big Blind from Ante 1257 and every Blind from Ante 1258 (corrected 2026-11-24 (final review): this said 1257 for the Boss Blind; the engine was right). On the other Stakes the Small Blind gets there at Ante 1257, and on the Last Candle Stake the Big Blind at Ante 1256.
- Blinds: Small Blind ×1, reward $3, skippable; Big Blind ×1.5, $4, skippable; Boss Blind ×2, $5, never skippable.
- Further multipliers: the Stake's, The Big Finish ×1.5, The Short Fuse ×0.75, the Head Start Tag ×0.75 (`pending.targetMult`), and for a Boss Blind the rule word `bossTargetMult` (Smooth Talker ×0.8; added 2026-11-23 (Jokers)). The Boss Blind's target is fixed when it starts; Blind select previews (`blindsForAnte`, `blindTarget`) use the Jokers owned now. Under The Wet Blanket the leftmost Joker gives no rule, in the preview too.
- `target = round(product / 10) × 10`.
- The High Roller Deck gets $1 less on each reward (minimum $0).
- **You win!** when Ante 8's Boss Blind is beaten outside Endless mode. The phase is `'win'`, with the cash-out ready. The player may then choose Endless mode (cash-out, Shop, then Ante 9 and beyond) or return to the title.

### 2.7 Cash-out
After a cleared Blind, the lines below appear in this order. Lines worth $0 are left out.
1. `'<Blind name>'` → the reward.
2. `'Hands to spare'` → $1 for each hand left.
3. `'Paid Seals'` → $2 for each Paid Seal card in hand when the Blind was beaten. None under The Blackout.
4. `'Interest'` → $1 per full $5 held before this payout (step money from the clearing hand included); with the rule word `interestStep: n` (Brass Abacus) $1 per full $n. The cap is $5, plus $3 with Savings Bond. The Last Candle Stake caps it at $3 before Savings Bond.
5. Joker lines, labelled with the Joker's name, in Joker order: Coupon Clipper gives +$1 per unused discard, Early Bird +$1 per hand left, Prize Rosette $3 after a Boss Blind, Dartboard $3 when the first hand beat the Blind, Paymaster $1 per other Joker. A copy's line is labelled with the copier and its target, e.g. `'Stand-In (as Early Bird)'`.

`collect` adds the total, sets `run.blind` to null and opens the Shop.

### 2.8 Shop
Opened after every collected cash-out.
- **Card slots:** 2, plus 1 with Night Market.
  - Each slot rolls its kind: Joker 70, Tarot 15, Planet 15, and Spectral 5 only with the Spooky Deck or Haunted Stall. Tall Tale is never sold.
  - Joker rarity weights: common 70, uncommon 25, rare 5, Legendary 0. Legendary Jokers are never in the Shop.
  - Each Shop Joker rolls an Edition. One number r in [0,1) walks Sheen 3%, Dither 2%, Glitch 0.5% and Phantom 0.5%, in that order. Shimmer Dust multiplies every chance by 3 and the Mirrorball Deck by 2; both together give ×6.
  - The Shop never offers a Joker the player owns or one already on offer. If a rarity's pool is empty, it rolls another rarity. If every pool is empty, it offers a Planet card instead.
- **Booster Pack slots:** 2, plus 1 with Night Market.
  - Each slot rolls the kind (Card 32, Tarot 24, Planet 24, Joker 14, Ghost 6), then the size (Normal 70, Jumbo 22, Mega 8).
  - Ghost Packs weigh 0 in Ante 1 (they start at Ante 2), and 12 with the Spooky Deck.
- **Voucher:** 1 slot. It is rolled at the Ante's first Shop from the Vouchers not owned, and stays on offer through that Ante until bought. There is none when every Voucher is owned.
- **Reroll** re-rolls the card slots only.
  - It costs $5 and rises by $1 after each paid reroll in this visit. The price resets on the next visit.
  - `shop.freeRerolls` are spent first and do not raise the price. The Sale Tag gives 1.
  - Second Look (`flatRerolls`, content check): while it is owned a paid reroll does not raise the price, so every paid reroll costs the base $5. Bought mid-visit, it puts the price back to the base at once.
  - The rule word `rerollDiscount: n` (Spinning Top): every paid reroll costs $n less than `shop.rerollCost`, never below $1; the price still rises as usual. `Engine.rerollCost` reports what the next reroll charges.
- **Prices**, in order:
  1. Base: a Joker's listed cost plus its Edition surcharge (Sheen $2, Dither $3, Glitch $4, Phantom $4). Tarot card $3 ($2 on the Seer's Deck); Planet card $3; Spectral card $4; packs per the pack table (§3.12); Voucher $10, times the rule word `voucherPriceMult` rounded up (Usher: $5). Unsold Vouchers are re-priced at once when such a Joker joins or leaves the rack in the Shop.
  2. The Sale Tag: Jokers only, `max(1, round(price × 0.75))`, halves up.
  3. The Season Pass: every item, pack and Voucher, `max(1, price − 1)`. Unsold items are re-priced at once when it is bought.
- **Buying** needs enough money.
  - A Joker needs a free Joker slot unless it is Phantom, and you can't already own it.
  - Tarot, Planet and Spectral cards need a free consumable slot.
  - A Voucher applies at once and is not offered again this Ante. Night Market adds a card slot and a pack slot to the current Shop at once.
  - A pack opens the pack screen (§2.9). The rule word `firstPackExtraPick: n` (Lucky Dip) gives the first pack bought in each Shop visit n more picks, never more than it shows (`shop.packsBought` counts the packs bought this visit; added 2026-11-23 (Jokers)).
  - Every purchase with a price above $0 fires the Jokers' `purchase` event (Big Spender), except on the Joker just bought.
  - Sold slots stay visible as sold.
- **Joker slots:** only Jokers without the Phantom Edition count. The rack count reads "3/5", plus "+1" for each Phantom Joker (`Engine.jokerSlotsUsed`).
- **Selling** is allowed in the Shop, at Blind select, during a Blind between hands, and while a pack is open.
  - A Joker sells for `max(1, floor(cost / 2))`, where cost is its listed cost plus its current Edition's surcharge. That holds whatever was paid (Sale Tag and Season Pass prices don't lower it), free Jokers and Legendary Jokers included. `paid` is kept for the records only.
  - Selling fires the sold Joker's own `sold` events (Last Laugh: +1 hand during a Blind), then the other Jokers' `jokerSold` events (Pawnbroker); then every Old Flame takes on the sold Joker (§3.4, copy) and a Stand-In whose target it was picks again.
  - On the High Roller Deck (`sellFull`) a Joker sells for its full cost, `max(1, cost)`.
  - A Tarot or Planet card sells for $1, a Spectral card for $2.
- **Leave** (*Next Blind*; final pass, 2026-11-24) goes to the next Blind select.

### 2.9 Booster Packs
- A pack shows N cards and lets you pick up to K, per its row in §3.12. Baker's Dozen shows 1 more card in every pack.
- Picks happen one at a time. The pack closes when its picks are used up, when nothing is left to pick, or on Skip. A picked card stays listed with `picked: true`.
- **Card Pack** cards:
  - Random rank and suit.
  - An Enhancement 35% of the time, picked uniformly.
  - An Edition roll: Sheen 4%, Dither 3%, Glitch 1% (×3 with Shimmer Dust), never Phantom.
  - A Seal 10% of the time (40% with Ribbon Box), picked uniformly.
  - The pick joins the deck for good.
- **Tarot Pack:** distinct Tarot cards. Each slot has a 0.5% chance to be Tall Tale instead (at most one per pack).
- **Planet Pack:** distinct Planet cards.
- **Joker Pack:** Jokers you don't own and that aren't on offer in the Shop, distinct within the pack, with the Shop's rarity and Edition odds, never Legendary. A pick needs a free Joker slot unless it is Phantom. A picked Joker is free (paid 0) and keeps its Edition.
- **Ghost Pack:** distinct Spectral cards other than Tall Tale. Each slot has a 2% chance to be Tall Tale instead (at most one per pack).
- **Tarot, Planet and Spectral picks are used at once (owner decision)** and never go into a consumable slot.
  - Tarot and Ghost Packs deal a hand while they are open. It holds `max(1, run.handSize)` cards (or the whole deck, if it holds fewer) from a freshly shuffled copy of the deck, in `pack.hand`, with the rest in `pack.draw`. No Boss Blind or "this Blind" hand-size change applies to it. For the other packs both lists stay empty.
  - Picks that need selected cards act on that hand: `packPick(run, i, selectedUids)`.
  - Cards destroyed there leave the deck for good, and the pack hand draws back up. Copies go into the deck, and into `pack.draw` at a random position. Cards added by Graveyard Shift join the deck and the pack hand.
  - The pack hand is thrown away when the pack closes.
  - A consumable from the slots may also be used on the pack hand while such a pack is open.
  - A pick that creates a consumable (Launch Pad, Copycat) still needs a free consumable slot for it. A pick that can't be used right now can't be taken, and `canPackPick` gives the reason.
- **"This Blind" effects used outside a Blind** act on the next Blind started, through `run.pending`: Overtime adds 1 to `pending.extraHands` and Apparition and Wickwisp take 1 from it; Do-Over adds 2 to `pending.extraDiscards` and Starfall takes 1 from it; Foxfire takes 1 from `pending.handSizeDelta`. The effect then carries `nextBlind: true`. `startBlind` applies and clears them (§2.3).
  - "Needs at least 2 hands left" (Apparition, Wickwisp) counts only during a Blind. The next Blind still keeps at least 1 hand.
- Opening any pack, bought or free from a Tag, fires the Jokers' `packOpened` event (Pack Rat). A Card Pack pick fires `cardAdded` (Patchwork Doll, Makeover); a Tarot, Planet or Spectral pick fires `consumableUsed` (Tea Leaves, Stargazer, Crystal Gazer) after it is used.
- The pack remembers where it was opened (`returnTo`: `'shop'` or `'blind-select'`).

### 2.10 Skipping and Tags
- Small and Big Blinds can be skipped for their Tag. Boss Blinds never can.
- Each skippable Blind's Tag is rolled uniformly from the Tags whose `fromAnte` ≤ that Ante (the Ghost Tag starts at Ante 2). Tags are rolled when the run is created (Antes 1–8) and when an endless Ante begins.
- Skipping grants the Tag and goes straight to the next Blind select, with no cash-out and no Shop.
- Pending effects:
  - `pending.extraHands` (Second Wind), `pending.targetMult` (Head Start), and the pack picks' `pending.extraHands`, `pending.extraDiscards` and `pending.handSizeDelta` (§2.9) are used up by the next `startBlind`.
  - `pending.sale` (Sale Tag) is used up by the next Shop: discount 0.25 and +1 free reroll.
- The Grab Bag, Ghost and Sky Tags open their free Jumbo pack at once, with `returnTo: 'blind-select'`.

### 2.11 Defaults
- Start with $4, 4 hands, 3 discards, hand size 8, 5 Joker slots and 2 consumable slots. The Deck and Stake adjust these (§3.13, §3.14).
- Hands are at least 1, discards at least 0 and hand size at least 1 (Tall Tale and Foxfire respect that).
- Money never goes below $0: Cursed Coin and Eclipse take only what you have.
- An unknown Deck or Stake id falls back to the first row (`firstissue`, `sunny`).

### 2.12 Discovery
- `run.discovered = { jokers:[], consumables:[], bosses:[], vouchers:[], tags:[] }` holds the ids the player has *seen* this run.
- An id counts as seen when:
  - it is offered in the Shop or a pack;
  - it is gained in any way;
  - (Boss Blinds and Tags) it is shown on a Blind select screen, meaning the current Ante's Boss Blind and two Tags.
- Records merge these sets for the Collection. Enhancements, Editions and Seals are always listed in the Collection.

### 2.13 End of run
Both *Game Over* and *You win!* show: the Ante reached, the best hand (name and score, labelled "Brightest hand"), the most played hand ("Favourite hand"), hands played, cards discarded, Blinds cleared, Blinds skipped, money earned and the seed (`Engine.stats`; the labels follow the wording ruling of the final pass, 2026-11-24).

---

## 3. Content (`src/content.js` → `TW.Content`)

**How the tables work:**
- Every table is an Array in table order that also answers by id: `TW.Content.JOKERS.pipsqueak`, or `TW.Content.byId('JOKERS', 'pipsqueak')`.
- Every row has at least `id`, `name` and `text`, so the UI can render it without knowing the rules.
- A row's `oldId` is the v2 id it renames or replaces. It is used only to migrate saved data: version 1 records, and (added 2026-11-23 (Jokers)) the Joker ids of version 2 records and saved runs from before the 120-Joker table (§4.2).
- The ids and numbers below are binding. The names and texts are display copy, kept in `content/` and `src/content.js`.

### 3.1 Enhancements (`ENHANCEMENTS`, 8)
| id | name | rule fields | effect |
|---|---|---|---|
| inked | Waxed | chips 35 | +35 Chips when scored |
| punchy | Kindled | mult 5 | +5 Mult when scored |
| dimestore | Gilt-Edged | money 1 | +$1 when scored |
| popout | Sequined | xmult 1.4 | ×1.4 Mult when scored |
| scribbled | Masked | anySuit, chips 10 | counts as every suit; +10 Chips when scored |
| spotlit | Spotlit | heldMult 3 | +3 Mult while held in hand |
| vintage | Vintage | grow 4 | each scoring pass stores +4 Chips for good, then gives all stored (`card.grow`) |
| crumpled | Crumpled | discardMoney 1 | +$1 when discarded |

The Wash-Out switches all of them off, Masked's any-suit rule included.

### 3.2 Editions (`EDITIONS`, 4)
Each row has `text`, `jokerText` and `cardText` (tooltip lines), a `surcharge`, and `odds: { joker, card }`. The step fields are `chips`, `mult` or `xmult`, with `timing: 'before'|'after'` for when a Joker's Edition step comes; Phantom has `slot` and `rankAsMult` instead. An Edition roll draws one number r in [0,1) and walks the rows in table order.

| id | name | on a Joker | on a playing card | Joker odds | Card Pack odds | surcharge |
|---|---|---|---|---|---|---|
| gloss | Sheen | +40 Chips before the Joker acts | +40 Chips when scored | 3% | 4% | $2 |
| benday | Dither | +8 Mult before the Joker acts | +8 Mult when scored | 2% | 3% | $3 |
| fourcolor | Glitch | ×1.6 Mult after the Joker acts | ×1.6 Mult when scored | 0.5% | 1% | $4 |
| inverted | Phantom | takes no Joker slot (`slot`) | its rank scores as Mult (`rankAsMult`) | 0.5% | never | $4 |

The Blackout switches every Edition step off, and a Phantom card then scores Chips as normal. A Phantom Joker still takes no slot. Weighted picks of "Sheen, Dither or Glitch" use weights 50 / 35 / 15 (Happy Accident, Foxfire, Glimmer Tag).

### 3.3 Seals (`SEALS`, 4)
| id | name | rule field | effect |
|---|---|---|---|
| encore | Encore Seal | retrigger 1 | one extra pass when scored, and one when held (held cards only if they give something) |
| paid | Paid Seal | clearMoney 2 | +$2 at cash-out while in hand when the Blind is beaten |
| airmail | Comet Seal | discardCreates 'planet' | discarding it creates a Planet card for the most-played hand (needs a free slot) |
| cameo | Cameo Seal | joinsScoring | always scores when played; never changes the hand type; The Heckler can boo it |

The Blackout switches every Seal off.

### 3.4 Jokers (`JOKERS`, 120)
- **The table** (changed 2026-11-23 (Jokers): it held the 27 v2 charms) is the `jokers` array of `content/content-plan.json`, in plan order: 60 common, 40 uncommon, 15 rare and 5 Legendary.
  - Each row is `{ id, oldId?, name, rarity, cost, text }` plus the Joker's plan `engine` row in the vocabulary below. Every row passes `Engine.jokerProblems`.
  - Two rows drop the plan's placeholder `state: { used: false }`: Sleight of Hand and Lucky Dip. The engine keeps their once-per-Blind and once-per-Shop flags on `run.blind.freeDiscardUsed` and `run.shop.packsBought`, so the rule word alone carries the row.
- **Legendary Jokers** (`candleking` The Candle King, `madameecho` Madame Echo, `puppetmaster` The Puppet Master, `sirmotley` Sir Motley, `ringmaster` The Ringmaster; $20 each): the rarity weighs 0, so the Shop and Joker Packs never offer one, and only Tall Tale (`originstory`) creates one. Doppelganger may copy one you already own, since its text copies your leftmost Joker whatever it is, so two of the same Legendary are possible that way (decided 2026-11-23 (Jokers, engine fix)). Like every Joker they sell for half their cost ($10).
- **The v2 charms:** 27 rows rename them (`oldId`); the four tide charms `mudskipper`, `moonjelly`, `tidemill` and `stormglass` are gone. They keep their numbers, except Sleight of Hand (content check: once per Blind a discard of 1 or 2 cards is free; v2 Fishhook freed the first discard of each Blind), Old Stager, which gained a live value, and two the balance pass re-tuned (decision `balance`, 2026-11-23 (Jokers, engine fix)): Magpie (v2 `netmender`) is capped at +50 Chips (was +100), and Chimney Sweep (v2 `bilgerat`) gives +1 Mult for every 2 cards discarded this Blind (was every card). Records and saved runs that still hold a v2 id map through `oldId` (§4.2):

  | v2 id | Joker | v2 id | Joker | v2 id | Joker |
  |---|---|---|---|---|---|
  | anchor | Jingle Jester (`jinglejester`) | gull | Pipsqueak (`pipsqueak`) | biscuit | Gingerbread Fool (`gingerbreadfool`) |
  | whistle | Party Horn (`partyhorn`) | coralcrown | Paper Crown (`papercrown`) | sanddollar | Coupon Clipper (`couponclipper`) |
  | raft | Empty Seats (`emptyseats`) | compassrose | Pinwheel (`pinwheel`) | fishhook | Sleight of Hand (`sleightofhand`) |
  | reefknot | Double Act (`doubleact`) | quill | Tally Owl (`tallyowl`) | netmender | Magpie (`magpie`) |
  | kraken | Sable Knave (`sableknave`) | lobsterpot | Red-Handed (`redhanded`) | lighthouse | Conga Line (`congaline`) |
  | stormpetrel | Moneybags (`moneybags`) | figurehead | Opening Act (`openingact`) | crosscurrent | Final Bow (`finalbow`) |
  | bilgerat | Chimney Sweep (`chimneysweep`) | goldtooth | Gold Tooth (`goldtooth`) | soundingline | Old Stager (`oldstager`) |
  | kelpforest | The Paperclip (`paperclip`) | mermaidcomb | Lamplighter (`lamplighter`) | leviathan | Big Top (`bigtop`) |
  | ghostship | Poker Face (`pokerface`) | seaserpent | Dragon Tamer (`dragontamer`) | treasuremap | Fortune Cookie (`fortunecookie`) |

  This spec names Jokers by these names.
- **Text:** `Engine.jokerText()` appends live values in parentheses, joined with ", ", such as "(now +45 Chips)", "(now ×1.25)", "(named: Queens)" or "(copying: Tin Drum)" (the formats below).

**The Joker vocabulary.** A Joker's behaviour is data in its row, interpreted by the engine. A new Joker that uses these words needs only a content row; a new word is one small entry in the engine's tables. The words marked † were added on 2026-11-23 (Jokers), for the 120 Jokers (CONTENT.md, section "Joker vocabulary", is the design source; the Joker after each word is an example).

**Effects:** `effects: [{ on, when, chips|mult|xmult|money, per, linear, of, times }]`
- `on` says when the effect fires:
  - `'card'`: each scoring pass of a scored card.
  - `'held'`: each pass of a held card.
  - `'hand'`: after the cards (step 5).
  - `'cashout'`: a cash-out line (money only).
  - `'retrigger'`: extra passes, with `of: 'scored'|'held'` (default `'scored'`) and `times` (default 1). It needs no amount.
- The amount is a number, or `{ state: key }` for the Joker's own state.
- `per` multiplies the amount by a count, or raises it to that power for `xmult`. It is a counter name; `{ count, every }` for `floor(counter / every)`; or † `{ state: key, every }` (perState, Stargazer) for `floor(state[key] / every)`.
- † `linear: true` (Ticket Collector) with `xmult` and `per`: ×(1 + amount × count) instead of amount to the power of the count.
- An effect worth +0 or ×1 makes no step, and an ×Mult of 0 or less (only a broken state can give one) never fires. An unknown word never fires.
- A state amount that is missing or not a finite number (an older or edited save, or a copy of a broken state) reads as the row's starting value, so a Poker Face with `state: {}` gives ×1, not ×0 (added 2026-11-23 (Jokers, engine fix)).

**Conditions** (`when`; all must hold; a boolean word also takes `false` for "not"):

| word | meaning |
|---|---|
| `maxPlayed` / `minPlayed` | n played cards (scoring or not). |
| `firstHand` | the Blind's first hand. |
| `hands` | a list of hand ids: the evaluated hand is one of them (with † `handsContain`, also a hand that contains one). |
| `face` | a face card (J, Q, K; with † `acesAreFaces` also an Ace). |
| `suit` / `suits` | the card counts as that suit (Masked counts unless The Wash-Out; † `everySuit` makes every card count). |
| `rank` / `ranks` | the card's rank. |
| `first` / `last` | the first or last scoring card (a booed card keeps its place). |
| `stateRank` | the card's rank equals the state key's value. |
| `noDiscards` | no discard this Blind. |
| `bossBlind` | a Boss Blind. |
| † `scoredSuitCount` | `{ suit, min }`: at least `min` scored cards count as that suit (Jewel Box). |
| † `highestHeld` | held effects: this is the highest-ranked card held in hand, leftmost on ties (Top Hat). |
| † `heldRank` | rank r: a card of that rank is held in hand; once per hand however many (Ace Up the Sleeve). |
| † `clearedOnFirstHand` | cash-out: the Blind was beaten by its first hand, `blind.handsPlayed` 1 (Dartboard). |
| † `clearedOnLastHand` | `blindCleared`: the hand that beat the Blind left `handsLeft` at 0 (Nail-Biter). |
| † `kind` | `consumableUsed`: the used card's kind, `'tarot'`, `'planet'` or `'spectral'` (or a list), pack picks included (Tea Leaves, Stargazer, Crystal Gazer). |
| † `enhanced` | the card has an Enhancement and The Wash-Out is not active (Fancy Dress, Reprise). |
| † `allEnhanced` | at least one card is scored and every scored card has an Enhancement, not under The Wash-Out (Gala Night). |
| † `seal` | a Seal id or `'any'`: the card has that Seal and The Blackout is not active (Bravo Bouquet, Maypole). |
| † `lastHand` | `handsLeft` is 1 before this hand (Grand Finale). |
| † `evenHand` | the Blind's 2nd, 4th, 6th … hand: `blind.handsPlayed` is odd before it (Seesaw). |
| † `maxMoney` | money is at most n before this hand earns anything (Penniless Poet). |
| † `oneColour` | at least one card is scored and they are all red or all black; a Masked card fits either unless The Wash-Out (Colour Guard). |
| † `noConsumables` | no card in any consumable slot (Pocket Lint). |
| † `mostPlayed` | the hand is the most-played hand before this one, ties to the stronger, Pair when nothing is played, as The Spoilsport picks it; † `handsContain` widens it like `hands` (Signature Move). |
| † `stateIs` | `{ key: value }`: the Joker's state key equals value (Heads or Tails). |
| † `heldSameRank` | a card of this scored card's exact rank is held in hand (Call and Response). |
| † `firstOrLast` | the first or the last scoring card; a lone scoring card qualifies once (Bookends). |
| † `pairDiscard` | `discard`: exactly 2 cards were selected and they share a rank; The Fumble's card is not counted (Palm Reader). |
| † `sum21` | the scored cards add up to exactly 21: 2–10 at face value, J/Q/K 10, each Ace 1 or 11; each card once (Blackjack). |

**Counters** (`per`):

| word | count |
|---|---|
| `emptyJokerSlots` | free Joker slots (a Phantom Joker takes none). |
| `scoredSuits` | different suits among scored cards (a card that counts as every suit makes it 4). |
| `scoredPairs` | `floor(count / 2)` per rank among scored cards, added up. |
| `playedCards` | played cards. |
| `handsPlayed` | hands played this run, before this hand. |
| `money` | money held. |
| `cardsDiscarded` | cards discarded this Blind (none outside a Blind). |
| `discardsLeft` | discards left. |
| `ante` | the Ante. |
| † `cardRank` | the card's rank: 2–10, J 11, Q 12, K 13, A 14 (Top Hat). |
| † `heldPairs` | `floor(count / 2)` per rank among the cards held in hand (Peek-a-Boo). |
| † `handsLeft` | hands left (at the cash-out: when the Blind was beaten) (Early Bird). |
| † `unscoredCards` | played cards minus scoring cards; a Cameo card scores, a booed card is still a scoring card (Understudy). |
| † `otherCommonJokers` | the other Jokers (not this one) whose rarity is common (Jester Parade). |
| † `sealedCards` | cards in the full deck with any Seal, counted even under The Blackout (Signet Ring). |
| † `levelsAbove1` | the played hand's level minus 1 (Orrery). |
| † `editionJokers` | Jokers with any Edition, this one included, counted even under The Blackout (Velvet Rope). |
| † `otherJokers` | the other Jokers, Phantom ones included (Paymaster, The Ringmaster). |
| † `vouchers` | Vouchers owned (Ticket Collector). |

**State and events.** `state` is the starting state, copied for each instance. `events: { <event>: [ entry ] }`, where each entry has an optional `when` and then runs, in this order: `set`, `add`, `max`, `eatenAt`, `enhanceScored`, then the † operations in the table order below. An event fires on every active Joker, left to right (a switched-off Joker hears nothing).

| event | when it fires |
|---|---|
| `gained` | the Joker joins the rack (any way). |
| `blindStart` | a Blind starts, after its first hand is dealt (§2.3). |
| `blindCleared` | a Blind is beaten, before the cash-out (a skipped Blind is not). |
| `discard` | after a discard; `perCard` counts every discarded card, The Fumble's included. |
| `afterHand` | after a hand is scored and booked. |
| † `cardScored` | each scoring pass of a scored card, inside `scoreCards`: state operations only, on a per-hand copy; reported in `result.jokerGains` and stored by `playHand` (Jack-in-the-Box). |
| † `handScored` | once per scored hand, before the Joker pass, inside `scoreCards`, like `cardScored` (Accordion). |
| † `packOpened` | a Booster Pack opens, bought or free from a Tag (Pack Rat). |
| † `jokerSold` | you sell another Joker; a destroyed Joker is not sold (Pawnbroker). |
| † `sold` | this Joker is sold (Last Laugh). |
| † `consumableUsed` | a Tarot, Planet or Spectral card was used, from a slot or as a pack pick (Tea Leaves). |
| † `cardAdded` | playing cards joined the deck: a Card Pack pick, copies, cards created into the hand; `perCard` counts them (Patchwork Doll, Makeover). |
| † `cardDestroyed` | playing cards you own were destroyed; `perCard` counts them (Brazier). |
| † `purchase` | you bought something in the Shop for more than $0 (not a reroll, and not on the Joker just bought) (Big Spender). |

| operation | what it does |
|---|---|
| `set: { key: value \| setter }` | sets state keys; a text value names a setter: `randomRank` (2–14 from the run's RNG), † `coinFlip` (`'heads'` or `'tails'`, 1 in 2 from the run's RNG; Heads or Tails). |
| `add: { key: n }` | adds to state keys, times the cards with `perCard`, or † times the face cards discarded with `perFace` (Face Value). |
| `max: { key: cap }` | caps state keys. |
| `eatenAt: { key: n }` | the Joker leaves the rack when the key falls to n or less (for Old Flame's copy: Old Flame goes back to nothing). |
| `enhanceScored: { suit, to, onlyPlain }` | scored cards of that suit get the Enhancement (Lamplighter). The card's own suit counts, not Masked's any-suit (`onlyPlain` keeps Masked cards out anyway); with † `everySuit` (Sir Motley) every scored card counts (decided 2026-11-23 (Jokers, engine fix): Sir Motley's "every Joker and rule that checks suits" wins). |
| † `money: n` | pay $n at once (times `perCard` / `perFace`); × `blindMoneyX` during a Blind (Doorman, Crystal Gazer). |
| † `extraHand: n` | +n hands this Blind; nothing outside a Blind (Last Laugh). |
| † `gainTag: tagId` | gain that Tag as if you had skipped for it; a Tag that opens a pack can't be gained this way (Hot Cocoa). |
| † `editionDeckCards: { count, weights }` | that many random deck cards with no Edition each roll one by weight, never Phantom (Shoeshine). |
| † `sealHandCard: n` | n random cards in hand with no Seal get a random Seal (Thimble). |
| † `createPlanet: 'mostPlayed'` | the Planet card for the most-played hand (Pair when none), if a consumable slot is free (Moonstruck, with `when: { bossBlind: true }` since the balance pass of 2026-11-23). |
| † `createTarot: n` / † `createSpectral: n` | n random distinct Tarot / Spectral cards (never Tall Tale), as many as fit (Palm Reader, Night Moth). |
| † `handSizeThisBlind: { add, max }` | `blind.handSizeDelta` + add, at most max from this Joker per Blind (`blind.handSizeBy`), then draw up; only during a Blind (Carpetbag). |
| † `enhanceAdded: 'random'` | each added card with no Enhancement gets a random one (Makeover). |
| † `rankUpScored: { from: to }` | every scored card of rank from becomes rank to, all at once (no chain) (Coronation). |

`cardScored` and `handScored` accept only `when`, `set` (plain values), `add`, `max` and `perCard`; `jokerProblems` names anything else. What the operations did is reported in the action's `jokerEvents` (§4.2).

**Rules** (`rules: { word: value }`): passive flags, read from the active Jokers and their copies. One Joker or copy turns a rule on, and more copies add nothing (the leftmost value is used).

| word | meaning |
|---|---|
| `freeFirstDiscard` | the first discard of each Blind is free (the v2 Fishhook row). |
| † `freeSmallDiscard: n` | once per Blind, a discard of at most n selected cards is free (§2.3; Sleight of Hand). The once-per-Blind flag is `blind.freeDiscardUsed`; the row's `state.used` is not needed. |
| † `rerollDiscount: n` | every paid reroll costs $n less, never below $1 (§2.8; Spinning Top). |
| † `interestStep: n` | interest is $1 per full $n held instead of $5; the cap is unchanged (§2.7; Brass Abacus). |
| † `wrapStraights` | Straights may wrap past the Ace (§2.2; Merry-Go-Round). |
| † `acesAreFaces` | every face-card check also counts Aces (Court Ace). |
| † `fourCardFlush` | 4-card Flushes (§2.2; Fan Dancer). |
| † `handsContain` | the `hands` and `mostPlayed` conditions also accept a hand that contains the named one: Pair in Two Pair, Three of a Kind, Full House and Four of a Kind; Two Pair in Full House; Three of a Kind in Full House and Four of a Kind; Straight and Flush in Straight Flush. High Card, Full House, Four of a Kind and Straight Flush accept only themselves (Nesting Dolls). |
| † `tarotSelectPlus: n` | a Tarot card that uses selected cards takes n more (`select [min, max + n]`), in a Tarot Pack too; `copies` then copies each selected card (Helping Hand). |
| † `firstPackExtraPick: n` | the first pack bought in each Shop visit gets n more picks, never more than it shows (§2.8; Lucky Dip). The count is `shop.packsBought`; the row's `state.used` is not needed. |
| † `bossTargetMult: x` | Boss Blind targets × x (§2.6; Smooth Talker). |
| † `voucherPriceMult: x` | Voucher prices × x, rounded up, before Season Pass (§2.8; Usher). |
| † `wildJacks` | Jacks stand in for any rank in hand detection (§2.2; Jack of All Trades). |
| † `editionsTwice` | every Edition step fires twice (§2.4; Kaleidoscope). |
| † `blindMoneyX: x` | money from cards and Jokers during a Blind × x (§2.4; Golden Hour). |
| † `everySuit` | every card counts as every suit, not switched off by The Wash-Out (§2.2; Sir Motley). |
| † `copy` | `'random'`, `'lastSold'` or `'neighbours'`: the copy mechanism below (Stand-In, Old Flame, The Puppet Master). |

**Copies** († `copy`). A copier acts through its targets' rows; its own Edition is its own.
- `'random'` (Stand-In, `state.target`: a Joker uid): it copies a random other Joker you own, never another Stand-In. It picks when gained, as soon as another Joker joins while it has no target (changed 2026-11-23 (Jokers, engine fix): it used to wait for the next Blind; an empty pool draws no RNG), when each Blind starts (before the `blindStart` events), and at once when its target leaves the rack. It acts as the target at every scoring point (hand, scored card, held card, retrigger) and on the cash-out, with the target's rules, reading the target's state (this hand's gains included). It runs the target's event operations except the state ones (`set`, `add`, `max`, `eatenAt`), so gains don't fire twice and a copy is never eaten: a Stand-In copying Doorman also pays $1 when a Blind starts, one copying Thimble seals a second card, one copying Face Value pays again for each face card discarded (changed 2026-11-23 (Jokers, engine fix): a copy used to run none of its target's events). Its `jokerEvents` entries carry its own uid and `copyOf` (§4.2).
- `'neighbours'` (The Puppet Master): it acts as the Joker directly to its left, then as the one directly to its right, each the way Stand-In does; at an end of the rack only its one neighbour.
- `'lastSold'` (Old Flame, `state.copy`: null or `{ id, state }`): when you sell another Joker it takes on that Joker's id and a copy of its state (not its Edition); selling another Joker replaces it. It then acts exactly as that Joker, events included, on its own copied state (so it keeps growing or burning down on its own). An ability that would eat itself leaves Old Flame with nothing instead (`state.copy` back to null).
- Copying a copier follows the chain to the final target (The Puppet Master next to a Stand-In copies the Stand-In's target; Old Flame that took on a Stand-In copies that Stand-In's target). A loop, a missing target or a chain longer than 8 steps resolves to nothing, so nothing can recurse forever.
- A copier's steps keep the copier as their source (`source: 'joker'`, `uid` = the copier) and name the target: `copyOf` = the target's Joker id, `jokerName` = e.g. `'Stand-In (as Jingle Jester)'` (§4.3). Its cash-out lines are labelled the same way. `Engine.jokerCopies(run, uid)` lists what a copier acts as right now.
- A copy works even when its target is the Joker The Wet Blanket switched off (the copier is not switched off; only the target's own abilities are). A switched-off copier does nothing.
- Each copier counts as its own Joker for a per-Joker limit (decided 2026-11-23 (Jokers, engine fix)): a Stand-In or The Puppet Master copying Carpetbag adds its own +1 hand size per discard, up to its own +3 (`blind.handSizeBy` per uid), and each Old Flame that took on Carpetbag or Last Laugh acts as one more of them (an Old Flame holding Last Laugh gives +1 hand when it is sold during a Blind). Each costs a Joker slot and its own price, so the stacking is the player's to buy.

**Live values** (`jokerText`):
- `live: true`: from the first effect with a state amount or a `per` counter: "now +N Chips", "now +N Mult", "now ×N" or "now +$N", plus " per card" for an on-card effect (Old Stager: "now +6 Chips per card"). Nothing when the counter can't be read (outside a Blind for `cardsDiscarded`). Changed 2026-11-23 (Jokers): the unit was added (was "now +N").
- `live: { rank: key }`: "named: <Ranks>" (Fortune Cookie; was "marked:"), during a Blind only (changed 2026-11-23 (Jokers, engine fix): each Blind names a new rank, so between Blinds the last one would mislead).
- † From the words themselves, with no `live` field: `freeSmallDiscard` "free discard: ready" or "free discard: used" (during a Blind); `evenHand` "next hand: on" or "next hand: off" (during a Blind); `mostPlayed` and `createPlanet: 'mostPlayed'` "most-played: <Hand>"; `stateIs` with a text value "now <Value>" ("now Heads"); `handSizeThisBlind` "now +N hand size" (during a Blind); `copy` "copying: <name>" or "copying: nothing" (Stand-In), "copying: <left> and <right>" (The Puppet Master), "now: <name>" or "nothing yet" (Old Flame, followed by the copied Joker's own live value). A Stand-In's and The Puppet Master's names are the final targets after any copy chain, as `jokerCopies` and the step names give them, each once: "copying: Tin Drum and Ember Imp" for a Stand-In copying The Puppet Master that sits between them, "copying: nothing" when the chain ends at an Old Flame that holds nothing (changed 2026-11-23 (Jokers, engine fix): they named the next Joker in the chain).

**Checking rows.** A switched-off Joker (The Wet Blanket) runs no effects, events, rules or cash-out lines that Blind. An unknown word never fires. `Engine.VOCABULARY` lists the known words (`on`, `conditions`, `counters`, `events`, `eventOps`, `setters`, `rules`, and † `amounts`), and `Engine.jokerProblems(row)` names every unknown or misused word in a row (also: `linear` without `xmult` and `per`, a non-state operation or setter in `cardScored`/`handScored`, an unknown or pack-opening `gainTag`, a `createPlanet` other than `'mostPlayed'`, an unknown `copy`). The engine suite checks every Joker row with it, `tests/vocab.test.mjs` checks all 120 rows of the plan, and `tests/jokers.test.mjs` all 120 rows of the table.

<!-- jokers-table:begin -->
**The 120 Jokers** (added 2026-11-23 (Jokers)), in table order: id, name, rarity and cost, the vocabulary words the row uses, and the row itself (its `engine` part, as in `src/content.js`). Generated from `src/content.js` by `node tools/engine-fuzz/spec-jokers.mjs <root>`; `tests/jokers.test.mjs` checks that it matches the table.

| # | id | name | rarity, cost | words | row |
|---|---|---|---|---|---|
| 1 | `jinglejester` | Jingle Jester | common, $4 | hand, chips, mult | `{ effects: [{ on: 'hand', chips: 15 }, { on: 'hand', mult: 3 }] }` |
| 2 | `pipsqueak` | Pipsqueak | common, $4 | hand, chips, maxPlayed | `{ effects: [{ on: 'hand', when: { maxPlayed: 2 }, chips: 45 }] }` |
| 3 | `gingerbreadfool` | Gingerbread Fool | common, $4 | hand, chips, state, blindCleared, add, eatenAt, live | `{ state: { chips: 60 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { blindCleared: [{ add: { chips: -15 }, eatenAt: { chips: 0 } }] }, live: true }` |
| 4 | `partyhorn` | Party Horn | common, $4 | hand, mult, firstHand | `{ effects: [{ on: 'hand', when: { firstHand: true }, mult: 8 }] }` |
| 5 | `papercrown` | Paper Crown | common, $4 | card, chips, face | `{ effects: [{ on: 'card', when: { face: true }, chips: 12 }] }` |
| 6 | `couponclipper` | Coupon Clipper | common, $4 | cashout, money, discardsLeft | `{ effects: [{ on: 'cashout', money: 1, per: 'discardsLeft' }] }` |
| 7 | `emptyseats` | Empty Seats | common, $4 | hand, mult, emptyJokerSlots, live | `{ effects: [{ on: 'hand', mult: 2, per: 'emptyJokerSlots' }], live: true }` |
| 8 | `pinwheel` | Pinwheel | common, $4 | hand, mult, scoredSuits | `{ effects: [{ on: 'hand', mult: 3, per: 'scoredSuits' }] }` |
| 9 | `sleightofhand` | Sleight of Hand | common, $4 | freeSmallDiscard | `{ rules: { freeSmallDiscard: 2 } }` |
| 10 | `doubleact` | Double Act | common, $4 | hand, mult, scoredPairs | `{ effects: [{ on: 'hand', mult: 4, per: 'scoredPairs' }] }` |
| 11 | `tallyowl` | Tally Owl | common, $5 | hand, mult, handsPlayed, every, live | `{ effects: [{ on: 'hand', mult: 1, per: { count: 'handsPlayed', every: 4 } }], live: true }` |
| 12 | `magpie` | Magpie | common, $5 | hand, chips, state, discard, add, perCard, max, live | `{ state: { chips: 0 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { discard: [{ add: { chips: 2 }, perCard: true, max: { chips: 50 } }] }, live: true }` |
| 13 | `tindrum` | Tin Drum | common, $3 | hand, chips | `{ effects: [{ on: 'hand', chips: 40 }] }` |
| 14 | `emberimp` | Ember Imp | common, $3 | hand, mult | `{ effects: [{ on: 'hand', mult: 5 }] }` |
| 15 | `solofiddler` | Solo Fiddler | common, $4 | hand, mult, hands | `{ effects: [{ on: 'hand', when: { hands: ['high'] }, mult: 8 }] }` |
| 16 | `matchingsocks` | Matching Socks | common, $4 | hand, chips, hands, mult | `{ effects: [{ on: 'hand', when: { hands: ['pair'] }, chips: 25 }, { on: 'hand', when: { hands: ['pair'] }, mult: 4 }] }` |
| 17 | `squaredance` | Square Dance | common, $4 | hand, chips, hands | `{ effects: [{ on: 'hand', when: { hands: ['twopair'] }, chips: 60 }] }` |
| 18 | `hattrick` | Hat Trick | common, $4 | hand, chips, hands, mult | `{ effects: [{ on: 'hand', when: { hands: ['three'] }, chips: 30 }, { on: 'hand', when: { hands: ['three'] }, mult: 6 }] }` |
| 19 | `tightrope` | Tightrope | common, $4 | hand, chips, hands | `{ effects: [{ on: 'hand', when: { hands: ['straight'] }, chips: 70 }] }` |
| 20 | `peacock` | Peacock | common, $4 | hand, mult, hands | `{ effects: [{ on: 'hand', when: { hands: ['flush'] }, mult: 9 }] }` |
| 21 | `clowncar` | Clown Car | common, $4 | hand, chips, hands, mult | `{ effects: [{ on: 'hand', when: { hands: ['fullhouse'] }, chips: 20 }, { on: 'hand', when: { hands: ['fullhouse'] }, mult: 10 }] }` |
| 22 | `quartet` | Quartet | common, $3 | hand, mult, hands | `{ effects: [{ on: 'hand', when: { hands: ['four'] }, mult: 20 }] }` |
| 23 | `rednose` | Red Nose | common, $5 | card, mult, suits | `{ effects: [{ on: 'card', when: { suits: ['H', 'D'] }, mult: 2 }] }` |
| 24 | `blackcat` | Black Cat | common, $5 | card, chips, suits | `{ effects: [{ on: 'card', when: { suits: ['S', 'C'] }, chips: 15 }] }` |
| 25 | `jewelbox` | Jewel Box | common, $6 | hand, money, scoredSuitCount | `{ effects: [{ on: 'hand', when: { scoredSuitCount: { suit: 'D', min: 3 } }, money: 2 }] }` |
| 26 | `luckysevens` | Lucky Sevens | common, $5 | card, mult, rank | `{ effects: [{ on: 'card', when: { rank: 7 }, mult: 7 }] }` |
| 27 | `anklebiters` | Ankle Biters | common, $4 | card, chips, ranks | `{ effects: [{ on: 'card', when: { ranks: [2, 3, 4, 5] }, chips: 12 }] }` |
| 28 | `jackinthebox` | Jack-in-the-Box | common, $5 | hand, mult, state, cardScored, rank, add, live | `{ state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { cardScored: [{ when: { rank: 11 }, add: { mult: 0.5 } }] }, live: true }` |
| 29 | `tophat` | Top Hat | common, $4 | held, chips, highestHeld, cardRank | `{ effects: [{ on: 'held', when: { highestHeld: true }, chips: 3, per: 'cardRank' }] }` |
| 30 | `aceupthesleeve` | Ace Up the Sleeve | common, $4 | hand, mult, heldRank | `{ effects: [{ on: 'hand', when: { heldRank: 14 }, mult: 10 }] }` |
| 31 | `portraitgallery` | Portrait Gallery | common, $5 | held, mult, face | `{ effects: [{ on: 'held', when: { face: true }, mult: 2 }] }` |
| 32 | `peekaboo` | Peek-a-Boo | common, $4 | hand, chips, heldPairs | `{ effects: [{ on: 'hand', chips: 20, per: 'heldPairs' }] }` |
| 33 | `earlybird` | Early Bird | common, $4 | cashout, money, handsLeft | `{ effects: [{ on: 'cashout', money: 1, per: 'handsLeft' }] }` |
| 34 | `prizerosette` | Prize Rosette | common, $4 | cashout, money, bossBlind | `{ effects: [{ on: 'cashout', when: { bossBlind: true }, money: 3 }] }` |
| 35 | `doorman` | Doorman | common, $3 | blindStart, money | `{ events: { blindStart: [{ money: 1 }] } }` |
| 36 | `spinningtop` | Spinning Top | common, $4 | rerollDiscount | `{ rules: { rerollDiscount: 1 } }` |
| 37 | `brassabacus` | Brass Abacus | common, $3 | interestStep | `{ rules: { interestStep: 4 } }` |
| 38 | `lastlaugh` | Last Laugh | common, $4 | sold, extraHand | `{ events: { sold: [{ extraHand: 1 }] } }` |
| 39 | `dartboard` | Dartboard | common, $4 | cashout, money, clearedOnFirstHand | `{ effects: [{ on: 'cashout', when: { clearedOnFirstHand: true }, money: 3 }] }` |
| 40 | `accordion` | Accordion | common, $5 | hand, chips, state, handScored, minPlayed, add, live | `{ state: { chips: 0 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { handScored: [{ when: { minPlayed: 5 }, add: { chips: 3 } }] }, live: true }` |
| 41 | `packrat` | Pack Rat | common, $5 | hand, mult, state, packOpened, add, live | `{ state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { packOpened: [{ add: { mult: 1 } }] }, live: true }` |
| 42 | `pawnbroker` | Pawnbroker | common, $5 | hand, mult, state, jokerSold, add, live | `{ state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { jokerSold: [{ add: { mult: 2 } }] }, live: true }` |
| 43 | `tealeaves` | Tea Leaves | common, $4 | hand, chips, state, consumableUsed, kind, add, live | `{ state: { chips: 0 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { consumableUsed: [{ when: { kind: 'tarot' }, add: { chips: 6 } }] }, live: true }` |
| 44 | `stargazer` | Stargazer | common, $5 | hand, mult, perState, consumableUsed, kind, add, live | `{ state: { planets: 0 }, effects: [{ on: 'hand', mult: 1, per: { state: 'planets', every: 2 } }], events: { consumableUsed: [{ when: { kind: 'planet' }, add: { planets: 1 } }] }, live: true }` |
| 45 | `drippingcandle` | Dripping Candle | common, $4 | hand, mult, state, afterHand, add, eatenAt, live | `{ state: { mult: 15 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { afterHand: [{ add: { mult: -1 }, eatenAt: { mult: 0 } }] }, live: true }` |
| 46 | `merrygoround` | Merry-Go-Round | common, $5 | wrapStraights | `{ rules: { wrapStraights: true } }` |
| 47 | `courtace` | Court Ace | common, $4 | acesAreFaces | `{ rules: { acesAreFaces: true } }` |
| 48 | `highfive` | High Five | common, $4 | hand, mult, minPlayed | `{ effects: [{ on: 'hand', when: { minPlayed: 5 }, mult: 5 }] }` |
| 49 | `understudy` | Understudy | common, $4 | hand, mult, unscoredCards | `{ effects: [{ on: 'hand', mult: 3, per: 'unscoredCards' }] }` |
| 50 | `jesterparade` | Jester Parade | common, $4 | hand, chips, otherCommonJokers, live | `{ effects: [{ on: 'hand', chips: 12, per: 'otherCommonJokers' }], live: true }` |
| 51 | `fancydress` | Fancy Dress | common, $4 | card, mult, enhanced | `{ effects: [{ on: 'card', when: { enhanced: true }, mult: 2 }] }` |
| 52 | `signetring` | Signet Ring | common, $4 | hand, chips, sealedCards, live | `{ effects: [{ on: 'hand', chips: 10, per: 'sealedCards' }], live: true }` |
| 53 | `bravobouquet` | Bravo Bouquet | common, $4 | card, chips, seal | `{ effects: [{ on: 'card', when: { seal: 'encore' }, chips: 20 }] }` |
| 54 | `grandfinale` | Grand Finale | common, $4 | hand, chips, lastHand | `{ effects: [{ on: 'hand', when: { lastHand: true }, chips: 60 }] }` |
| 55 | `hotcocoa` | Hot Cocoa | common, $3 | blindCleared, bossBlind, gainTag | `{ events: { blindCleared: [{ when: { bossBlind: true }, gainTag: 'secondwind' }] } }` |
| 56 | `nightwatchman` | Night Watchman | common, $4 | hand, mult, bossBlind | `{ effects: [{ on: 'hand', when: { bossBlind: true }, mult: 12 }] }` |
| 57 | `seesaw` | Seesaw | common, $4 | hand, mult, evenHand | `{ effects: [{ on: 'hand', when: { evenHand: true }, mult: 10 }] }` |
| 58 | `pennilesspoet` | Penniless Poet | common, $4 | hand, mult, maxMoney | `{ effects: [{ on: 'hand', when: { maxMoney: 5 }, mult: 9 }] }` |
| 59 | `orrery` | Orrery | common, $5 | hand, mult, levelsAbove1 | `{ effects: [{ on: 'hand', mult: 2, per: 'levelsAbove1' }] }` |
| 60 | `patchworkdoll` | Patchwork Doll | common, $4 | hand, chips, state, cardAdded, add, perCard, live | `{ state: { chips: 0 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { cardAdded: [{ add: { chips: 4 }, perCard: true }] }, live: true }` |
| 61 | `sableknave` | Sable Knave | uncommon, $6 | card, xmult, suit | `{ effects: [{ on: 'card', when: { suit: 'S' }, xmult: 1.1 }] }` |
| 62 | `redhanded` | Red-Handed | uncommon, $6 | held, mult, suits | `{ effects: [{ on: 'held', when: { suits: ['H', 'D'] }, mult: 2 }] }` |
| 63 | `congaline` | Conga Line | uncommon, $6 | hand, xmult, hands | `{ effects: [{ on: 'hand', when: { hands: ['straight', 'straightflush'] }, xmult: 1.5 }] }` |
| 64 | `moneybags` | Moneybags | uncommon, $6 | hand, mult, money, every, live | `{ effects: [{ on: 'hand', mult: 1, per: { count: 'money', every: 4 } }], live: true }` |
| 65 | `openingact` | Opening Act | uncommon, $6 | card, chips, first, mult | `{ effects: [{ on: 'card', when: { first: true }, chips: 20 }, { on: 'card', when: { first: true }, mult: 2 }] }` |
| 66 | `finalbow` | Final Bow | uncommon, $7 | card, xmult, last | `{ effects: [{ on: 'card', when: { last: true }, xmult: 1.5 }] }` |
| 67 | `chimneysweep` | Chimney Sweep | uncommon, $6 | hand, mult, cardsDiscarded, every, live | `{ effects: [{ on: 'hand', mult: 1, per: { count: 'cardsDiscarded', every: 2 } }], live: true }` |
| 68 | `goldtooth` | Gold Tooth | uncommon, $6 | card, money, rank | `{ effects: [{ on: 'card', when: { rank: 14 }, money: 1 }] }` |
| 69 | `oldstager` | Old Stager | uncommon, $6 | card, chips, ante, live | `{ effects: [{ on: 'card', chips: 2, per: 'ante' }], live: true }` |
| 70 | `paperclip` | The Paperclip | uncommon, $6 | held, chips | `{ effects: [{ on: 'held', chips: 5 }] }` |
| 71 | `lamplighter` | Lamplighter | uncommon, $7 | afterHand, enhanceScored | `{ events: { afterHand: [{ enhanceScored: { suit: 'H', to: 'punchy', onlyPlain: true } }] } }` |
| 72 | `fandancer` | Fan Dancer | uncommon, $7 | fourCardFlush | `{ rules: { fourCardFlush: true } }` |
| 73 | `maypole` | Maypole | uncommon, $7 | retrigger, seal | `{ effects: [{ on: 'retrigger', when: { seal: 'any' } }] }` |
| 74 | `callandresponse` | Call and Response | uncommon, $6 | retrigger, heldSameRank | `{ effects: [{ on: 'retrigger', when: { heldSameRank: true } }] }` |
| 75 | `bookends` | Bookends | uncommon, $6 | retrigger, firstOrLast | `{ effects: [{ on: 'retrigger', when: { firstOrLast: true } }] }` |
| 76 | `onemanband` | One-Man Band | uncommon, $7 | retrigger, maxPlayed, times | `{ effects: [{ on: 'retrigger', when: { maxPlayed: 1 }, times: 3 }] }` |
| 77 | `colourguard` | Colour Guard | uncommon, $6 | hand, xmult, oneColour | `{ effects: [{ on: 'hand', when: { oneColour: true }, xmult: 1.5 }] }` |
| 78 | `threesacrowd` | Three's a Crowd | uncommon, $6 | hand, xmult, minPlayed, maxPlayed | `{ effects: [{ on: 'hand', when: { minPlayed: 3, maxPlayed: 3 }, xmult: 1.75 }] }` |
| 79 | `twoscompany` | Two's Company | uncommon, $6 | hand, xmult, hands | `{ effects: [{ on: 'hand', when: { hands: ['twopair'] }, xmult: 2 }] }` |
| 80 | `pocketlint` | Pocket Lint | uncommon, $6 | hand, xmult, noConsumables | `{ effects: [{ on: 'hand', when: { noConsumables: true }, xmult: 1.5 }] }` |
| 81 | `signaturemove` | Signature Move | uncommon, $7 | hand, xmult, mostPlayed | `{ effects: [{ on: 'hand', when: { mostPlayed: true }, xmult: 1.5 }] }` |
| 82 | `headsortails` | Heads or Tails | uncommon, $6 | hand, xmult, stateIs, afterHand, set, coinFlip | `{ state: { side: 'heads' }, effects: [{ on: 'hand', when: { stateIs: { side: 'heads' } }, xmult: 2 }], events: { afterHand: [{ set: { side: 'coinFlip' } }] } }` |
| 83 | `velvetrope` | Velvet Rope | uncommon, $6 | hand, xmult, editionJokers, live | `{ effects: [{ on: 'hand', xmult: 1.25, per: 'editionJokers' }], live: true }` |
| 84 | `shoeshine` | Shoeshine | uncommon, $6 | blindCleared, bossBlind, editionDeckCards | `{ events: { blindCleared: [{ when: { bossBlind: true }, editionDeckCards: { count: 2, weights: { gloss: 50, benday: 35, fourcolor: 15 } } }] } }` |
| 85 | `thimble` | Thimble | uncommon, $7 | blindStart, sealHandCard | `{ events: { blindStart: [{ sealHandCard: 1 }] } }` |
| 86 | `moonstruck` | Moonstruck | uncommon, $7 | blindStart, bossBlind, createPlanet | `{ events: { blindStart: [{ when: { bossBlind: true }, createPlanet: 'mostPlayed' }] } }` |
| 87 | `palmreader` | Palm Reader | uncommon, $6 | discard, pairDiscard, createTarot | `{ events: { discard: [{ when: { pairDiscard: true }, createTarot: 1 }] } }` |
| 88 | `crystalgazer` | Crystal Gazer | uncommon, $6 | consumableUsed, kind, money | `{ events: { consumableUsed: [{ when: { kind: 'tarot' }, money: 2 }] } }` |
| 89 | `paymaster` | Paymaster | uncommon, $6 | cashout, money, otherJokers, live | `{ effects: [{ on: 'cashout', money: 1, per: 'otherJokers' }], live: true }` |
| 90 | `facevalue` | Face Value | uncommon, $6 | discard, money, perFace | `{ events: { discard: [{ money: 1, perFace: true }] } }` |
| 91 | `carpetbag` | Carpetbag | uncommon, $7 | discard, handSizeThisBlind | `{ events: { discard: [{ handSizeThisBlind: { add: 1, max: 3 } }] } }` |
| 92 | `helpinghand` | Helping Hand | uncommon, $5 | tarotSelectPlus | `{ rules: { tarotSelectPlus: 1 } }` |
| 93 | `nestingdolls` | Nesting Dolls | uncommon, $5 | handsContain | `{ rules: { handsContain: true } }` |
| 94 | `makeover` | Makeover | uncommon, $6 | cardAdded, enhanceAdded | `{ events: { cardAdded: [{ enhanceAdded: 'random' }] } }` |
| 95 | `luckydip` | Lucky Dip | uncommon, $7 | firstPackExtraPick | `{ rules: { firstPackExtraPick: 1 } }` |
| 96 | `bigspender` | Big Spender | uncommon, $6 | hand, mult, state, purchase, add, live | `{ state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { purchase: [{ add: { mult: 0.5 } }] }, live: true }` |
| 97 | `nailbiter` | Nail-Biter | uncommon, $6 | hand, mult, state, blindCleared, clearedOnLastHand, add, live | `{ state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { blindCleared: [{ when: { clearedOnLastHand: true }, add: { mult: 4 } }] }, live: true }` |
| 98 | `smoothtalker` | Smooth Talker | uncommon, $8 | bossTargetMult | `{ rules: { bossTargetMult: 0.8 } }` |
| 99 | `coronation` | Coronation | uncommon, $5 | afterHand, rankUpScored | `{ events: { afterHand: [{ rankUpScored: { 11: 12, 12: 13 } }] } }` |
| 100 | `usher` | Usher | uncommon, $5 | voucherPriceMult | `{ rules: { voucherPriceMult: 0.5 } }` |
| 101 | `bigtop` | Big Top | rare, $8 | hand, xmult, hands | `{ effects: [{ on: 'hand', when: { hands: ['fullhouse', 'four', 'straightflush'] }, xmult: 2.5 }] }` |
| 102 | `pokerface` | Poker Face | rare, $8 | hand, xmult, state, blindCleared, noDiscards, add, live | `{ state: { x: 1 }, effects: [{ on: 'hand', xmult: { state: 'x' } }], events: { blindCleared: [{ when: { noDiscards: true }, add: { x: 0.25 } }] }, live: true }` |
| 103 | `dragontamer` | Dragon Tamer | rare, $9 | hand, xmult, state, blindCleared, bossBlind, add, live | `{ state: { x: 1 }, effects: [{ on: 'hand', xmult: { state: 'x' } }], events: { blindCleared: [{ when: { bossBlind: true }, add: { x: 0.5 } }] }, live: true }` |
| 104 | `fortunecookie` | Fortune Cookie | rare, $8 | card, money, stateRank, gained, set, randomRank, blindStart, live rank | `{ state: { rank: 2 }, effects: [{ on: 'card', when: { stateRank: 'rank' }, money: 2 }], events: { gained: [{ set: { rank: 'randomRank' } }], blindStart: [{ set: { rank: 'randomRank' } }] }, live: { rank: 'rank' } }` |
| 105 | `standin` | Stand-In | rare, $9 | copy 'random' | `{ state: { target: null }, rules: { copy: 'random' } }` |
| 106 | `oldflame` | Old Flame | rare, $8 | copy 'lastSold' | `{ state: { copy: null }, rules: { copy: 'lastSold' } }` |
| 107 | `jackofalltrades` | Jack of All Trades | rare, $8 | wildJacks | `{ rules: { wildJacks: true } }` |
| 108 | `nightmoth` | Night Moth | rare, $7 | blindCleared, bossBlind, createSpectral | `{ events: { blindCleared: [{ when: { bossBlind: true }, createSpectral: 1 }] } }` |
| 109 | `ticketcollector` | Ticket Collector | rare, $8 | hand, xmult, vouchers, linear, live | `{ effects: [{ on: 'hand', xmult: 0.25, per: 'vouchers', linear: true }], live: true }` |
| 110 | `reprise` | Reprise | rare, $9 | retrigger, enhanced | `{ effects: [{ on: 'retrigger', when: { enhanced: true } }] }` |
| 111 | `kaleidoscope` | Kaleidoscope | rare, $8 | editionsTwice | `{ rules: { editionsTwice: true } }` |
| 112 | `galanight` | Gala Night | rare, $8 | hand, xmult, allEnhanced | `{ effects: [{ on: 'hand', when: { allEnhanced: true }, xmult: 2 }] }` |
| 113 | `brazier` | Brazier | rare, $7 | hand, xmult, state, cardDestroyed, add, perCard, live | `{ state: { x: 1 }, effects: [{ on: 'hand', xmult: { state: 'x' } }], events: { cardDestroyed: [{ add: { x: 0.2 }, perCard: true }] }, live: true }` |
| 114 | `goldenhour` | Golden Hour | rare, $8 | blindMoneyX | `{ rules: { blindMoneyX: 2 } }` |
| 115 | `blackjack` | Blackjack | rare, $7 | hand, xmult, sum21 | `{ effects: [{ on: 'hand', when: { sum21: true }, xmult: 3 }] }` |
| 116 | `candleking` | The Candle King | Legendary, $20 | card, xmult | `{ effects: [{ on: 'card', xmult: 1.25 }] }` |
| 117 | `madameecho` | Madame Echo | Legendary, $20 | retrigger | `{ effects: [{ on: 'retrigger' }] }` |
| 118 | `puppetmaster` | The Puppet Master | Legendary, $20 | copy 'neighbours' | `{ rules: { copy: 'neighbours' } }` |
| 119 | `sirmotley` | Sir Motley | Legendary, $20 | everySuit | `{ rules: { everySuit: true } }` |
| 120 | `ringmaster` | The Ringmaster | Legendary, $20 | hand, xmult, otherJokers, live | `{ effects: [{ on: 'hand', xmult: 1.3, per: 'otherJokers' }], live: true }` |
<!-- jokers-table:end -->

### 3.5 Consumables: shared rules
- Kinds: `'tarot'`, `'planet'`, `'spectral'`. `select: [min, max]` is how many selected hand cards a card needs. The rule word `tarotSelectPlus: n` (Helping Hand) raises max by n for a Tarot card with max > 0 (`canUseConsumable`, `canPackPick` and `consumableInfo` use the raised range).
- **Where:**
  - `where: 'blind'` needs a hand of cards: during a Blind, or in an open Tarot or Ghost Pack (its dealt hand).
  - `where: 'any'` works at Blind select, during a Blind, in the Shop and in an open pack.
  - Nothing can be used at cash-out, at You win! or after Game Over.
- **Using from a slot:** the card leaves its slot first, so a card that creates a consumable has room, and Copycat never copies itself. A pack pick is used at once and needs a free slot for anything it creates.
- **Operation fields.** A row's operation fields apply in this fixed order:
  1. Card changes: `enhancement`, `seal`, `cardEdition` (an id or `{ weights }`), `rankDelta` (ranks stay within 2–14), `suitFromLeftmost` (`'selected'` or `'hand'`: those cards take the suit of the leftmost of them), `suitFromSelected` (`'hand'` or `'selected'`: those cards take the suit of the first selected card; added 2026-11-23 for Wickwisp).
  2. `copies`: copies of each selected card join the deck and the draw pile at random positions (one selected card unless Helping Hand allows more). A copy keeps Enhancement, Edition, Seal and grow.
  3. Destroying: `destroy` (the selected cards, plus `moneyEach`), `destroyOthers` (random unselected hand cards), `destroyRandom` (random hand cards).
  4. `addCards`: random rank and suit, a random Enhancement and Seal, no Edition, into the hand and the deck.
  5. Money: `money` (+ `perAnte`, at most `maxMoney`), `moneyLoss`, `loseHalfMoney`.
  6. "This Blind": `hands`, `discards`, `handSize`. During a Blind they change `blind.handsLeft` (at least 1), `blind.discardsLeft` (at least 0) and `blind.handSizeDelta`. Outside a Blind they go to `pending.extraHands`, `pending.extraDiscards` and `pending.handSizeDelta`, and the effect gets `nextBlind: true`.
  7. For good: `discardsForGood`, `handSizeForGood`.
  8. Jokers: `jokerEdition` (an id or `{ weights }`, with `jokerTarget` `'randomPlain'` or `'leftmostPlain'` (never the rightmost Joker) and an optional `chance`), `destroyJoker` (`'leftmost'|'rightmost'`), `createJoker` (a rarity, with `fallbackRarity`; `rollEdition` uses the Shop odds; never an owned Joker or one it just destroyed), `copyJoker` (`'leftmost'`: a fresh copy with no Edition, a new state and paid 0).
  9. Levels: `hand` (a Planet card; 2 levels with Sky Atlas), `levelsAll`.
  10. Creating consumables: `createPlanet` (most-played hand, or a random hand when none has been played), `copyConsumable` (the leftmost other card of the listed kinds in the slots).
- After cards are destroyed in a hand, it draws back up. If a Blind hand ends up empty with nothing to draw, the run is lost.
- Then the Jokers' events fire: `cardDestroyed` for the playing cards it destroyed, `cardAdded` for the ones it added (copies, `addCards`), and `consumableUsed` for the card itself (§3.4).
- **Needs** (checked before anything happens, with the §4.4 sentence):
  - `needJokers`; `needHands` (hands left, checked only during a Blind); `needCards` (cards in the hand);
  - a target for `jokerEdition`;
  - a free Joker slot after the card's own destroy, for `createJoker` and `copyJoker`;
  - a Joker left to create;
  - another Tarot or Planet card for `copyConsumable`;
  - consumable room for `createPlanet` and `copyConsumable`.

### 3.6 Tarot cards (`TAROTS`, 20; price $3, sell $1)
| id (name) | select | where | operation |
|---|---|---|---|
| inkpot (The Candlemaker) · boxingglove (Fire-Eater) · crayon (Masquerade) · spotlight (Spotlight) · backissues (Heirloom) | 1–2 | blind | Enhancement inked (Waxed) · punchy (Kindled) · scribbled (Masked) · spotlit · vintage |
| pricegun (Gold Leaf) · threedglasses (The Seamstress) | 1 | blind | Enhancement dimestore (Gilt-Edged) · popout (Sequined) |
| scrunch (Tinderbox) | 1–3 | blind | Enhancement crumpled |
| eraser (Candle Snuffer) | 1–2 | blind | destroy, +$1 each |
| ladder (The Ladder) · shrinkray (The Slide) | 1–3 | blind | rank +1 (Aces stay) · −1 (2s stay) |
| paintbucket (The Tailor) | 2–3 | blind | suit of the leftmost selected card |
| carboncopy (Carbon Copy) | 1 | blind | 1 copy |
| paperroute (Busker's Hat) | 0 | any | $3 + $1 per Ante, at most $10 |
| gueststar (Late Arrival) | 0 | any | create a common Joker |
| overtime (Overtime) · doover (Do-Over) | 0 | blind | +1 hand · +2 discards this Blind |
| happyaccident (Happy Accident) | 0 | any | 1 in 3: Sheen/Dither/Glitch on a random Joker without an Edition |
| launchpad (Launch Pad) | 0 | any | a Planet card for the most-played hand |
| reprint (Copycat) | 0 | any | a copy of the leftmost other Tarot or Planet card held |

Changing ranks or suits re-sorts the hand unless the sort is manual.

### 3.7 Planet cards (`PLANETS`, 9; price $3, sell $1)
One per hand: `blip` Pipkin (high), `boing` Twindle (pair), `zipzap` Marmalon (twopair), `kerplunk` Cinderon (three), `zoom` Quintara (straight), `swoosh` Ochrelle (flush), `kaboom` Hearthon (fullhouse), `thwack` Tetralune (four), `bigbang` Regalis (straightflush).
- Using one gives its hand +1 level, or +2 with Sky Atlas.
- Each text is "Level up <Hand>. (+Chips / +Mult per level)" with the §2.2 values.

### 3.8 Spectral cards (`SPECTRALS`, 16; price $4 when the Shop offers one, sell $2)
| id (name) | select | where | operation and cost |
|---|---|---|---|
| curtaincall (Curtain Call) | 1 | blind | Encore Seal; destroy 1 random other hand card |
| cursedcoin (Cursed Coin) | 1–2 | blind | Paid Seal; lose $5 |
| deadletter (Starfall) | 1–2 | blind | Comet Seal; −1 discard this Blind |
| apparition (Apparition) | 1–2 | blind | Cameo Seal; −1 hand this Blind; needs 2 hands left (during a Blind) |
| phantomink (Foxfire) | 1 | blind | Sheen/Dither/Glitch on the card; −1 hand size this Blind |
| upsidedown (Shadow Play) | 1 | blind | Phantom on the card; destroy 2 random other hand cards |
| hauntedpress (Poltergeist) | 0 | any | Glitch on the leftmost Joker without an Edition (not the rightmost); destroy the rightmost Joker; needs 2 Jokers |
| midnightedition (Witching Hour) | 0 | any | Phantom on a random Joker without an Edition; −1 discard for good |
| wormhole (Eclipse) | 0 | any | every hand +1 level (Sky Atlas does not double it); lose floor(money / 2) |
| vanishingact (Vanishing Act) | 1–4 | blind | destroy, +$4 each |
| ghostwriter (Ghost Writer) | 0 | any | destroy the leftmost Joker; create a rare one (uncommon if none left); needs 1 Joker |
| doppelganger (Doppelganger) | 0 | any | destroy the rightmost Joker, copy the leftmost; needs 2 Jokers |
| spellbound (Wickwisp) | 1 | blind | every card in hand takes the selected card's suit (`suitFromSelected: 'hand'`); −1 hand this Blind (`hands: -1`); needs 2 hands left (during a Blind). Decision `wickwisp` (2026-11-23): was select 0, the leftmost card's suit and lose $4. From a Booster Pack the −1 hand goes to the next Blind. |
| graveyardshift (Graveyard Shift) | 0 | blind | destroy 2 random hand cards; add 2 with an Enhancement and a Seal; needs 2 cards |
| hallofmirrors (Hall of Mirrors) | 1 | blind | 3 copies; destroy 2 random other hand cards |
| originstory (Tall Tale) | 0 | any | create a Legendary Joker not owned (a rare one if none is left), Edition at Shop odds; −1 hand size for good; needs a free slot |

**Where Spectral cards come from:** Ghost Packs, Tall Tale slots in Tarot and Ghost Packs, the Shop (only with the Spooky Deck or Haunted Stall, never Tall Tale), the Ghost Tag, and the Spooky Deck's Curtain Call.

### 3.9 Boss Blinds (`BOSSES`, 15)
Boss rows carry rule flags. The engine reads the flags, not the ids. Error sentences use the row's name.

| id (name) | from Ante | flag | rule |
|---|---|---|---|
| heckler (The Heckler) | 1 | boos | the highest-ranked scoring card scores nothing (`'Booed'`) |
| lid (The Lid) | 3 | cap 12, capPerAnte 6 | Mult can't go above 12, plus 6 for each Ante after Ante 3 (18 at Ante 4, 36 at Ante 7, 48 at Ante 9), after Joker Editions |
| shuffler (The Shuffler) | 1 | sweep | after every hand, the whole hand is shuffled back and redrawn |
| fade (The Fade) | 2 | keep 0.85 | before each later hand, `score = floor(score × 0.85)` |
| tollbooth (The Tollbooth) | 1 | discardCost 2 | each discard costs $2; blocked below $2 |
| smudge (The Smudge) | 1 | hideRanks | the UI hides the ranks of unselected cards |
| squeeze (The Squeeze) | 2 | maxPlay 4 | play at most 4 cards (changed 2026-11-23 (Jokers, balance): was 3) |
| washout (The Wash-Out) | 2 | noEnhancements | Enhancements do nothing |
| wetblanket (The Wet Blanket) | 2 | wetLeftmost | the Joker leftmost at Blind start does nothing all Blind |
| grudge (The Spoilsport) | 2 | mostPlayedX 0.5 | the hand most played at Blind start (ties to the stronger; Pair if none) scores ×0.5 |
| censor (The Blackout) | 3 | noEditionsSeals | Editions and Seals do nothing |
| warmup (The Warm-Up) | 1 | firstHandX 0.5 | the first hand scores ×0.5 |
| fumble (The Fumble) | 1 | extraDiscard 1 | each discard also drops 1 random unselected card |
| shortfuse (The Short Fuse) | 2 | handsDelta −2, targetMult 0.75 | 2 fewer hands (at least 1), target ×0.75 |
| bigfinish (The Big Finish) | 8 | finale, targetMult 1.5, sweep | Ante 8 only; target ×1.5; sweep |

- Antes 1–7 each roll a distinct Boss Blind with `fromAnte` ≤ that Ante (and, for a row with `toAnte`, that Ante ≤ `toAnte`) when the run is created. Ante 8 is always `bigfinish`.
- Endless Antes roll any of the other 14 when the Ante begins (a row's `toAnte` holds there too).
- Fields added 2026-11-23 (Jokers, balance): `capPerAnte` (The Lid, 6): the cap rises by this much for each Ante after `fromAnte`, so `cap + capPerAnte × max(0, Ante − fromAnte)`; the step label names the cap ("Capped at 24"), and `BlindInfo.boss.text` adds the cap at that Ante, "(now 24)" (§4.2). `toAnte`: the last Ante a Boss Blind can be rolled at; no row uses it.
- **Balance** (decision `balance` in `content/content-plan.json`, 2026-11-23): a greedy-bot simulation (100 seeds × 11 forced Jokers) found that The Lid's flat cap of 12 ended 44% of the runs that met it at Ante 4 and 95–100% at Antes 5–7, whatever the rack (the other Boss Blinds: 7–29%). With the rising cap it ends 9% at Ante 4, 32% at Ante 5 and 63–69% at Antes 6–7. The Squeeze, at most 3 cards, ended 43% at Ante 2, 56% at Ante 4 and 61–84% at Antes 5–7; at most 4 cards (Two Pair and Four of a Kind come back, 5-card hands stay out) it ends 30%, 36% and 42–58%, still the hardest Boss Blind for 5-card builds. Both changes together: the 1,100 runs (no forced Joker and 10 strong ones, 100 seeds each) reach mean Ante 5.41 instead of 5.11 and win 10.2% instead of 6.4% (3.90 instead of 3.85 with no forced Joker alone). Not taken: The Lid only up to Ante 4 (`toAnte: 4` leaves Ante 4's 44% as it is) and The Squeeze from Ante 3 on top of the 4 cards (simulated: no gain).

### 3.10 Vouchers (`VOUCHERS`, 13; $10 each)
- Each row has a `price` and its effect fields. `mods` raise run fields at once. The other fields are summed over owned Vouchers (`editionOdds` is multiplied, `planetLevels` and `sealOdds` take the highest, `spectralInShop` and `flatRerolls` are flags). The Shop always has one Voucher slot.
- The table:
  - `musclecourse` (Long Sleeves): `mods.handSize` +1; `bossHandSize` +1 more in Boss Blinds.
  - `speedcourse` (Midnight Oil): `mods.hands` +1; `bossHands` +1 more in Boss Blinds.
  - `springcleaning` (Spring Cleaning): `mods.discards` +2.
  - `extrapanel` (Pull Up a Chair): `mods.jokerSlots` +1.
  - `skyatlas` (Sky Atlas): `planetLevels` 2 (Planet cards give 2 levels).
  - `savingsbond` (Savings Bond): `interestCap` +$3.
  - `spinnerrack` (Night Market): `cardSlots` +1 and `packSlots` +1.
  - `secondlook` (Second Look): `flatRerolls` (paid rerolls don't raise the price). `freeRerolls` stays a Voucher field the engine sums, for a future row.
  - `slickpaper` (Shimmer Dust): `editionOdds` ×3 (Shop and pack Jokers, Card Pack cards).
  - `stampalbum` (Ribbon Box): `sealOdds` 0.4 (Card Pack Seals 40%).
  - `mailorderghost` (Haunted Stall): `spectralInShop` (Spectral cards in the Shop).
  - `bonuspages` (Baker's Dozen): `packShown` +1 (every pack shows 1 more card).
  - `dollaroff` (Season Pass): `priceOff` $1 (everything $1 less, minimum $1).

### 3.11 Tags (`TAGS`, 12)
Each row has `fromAnte`. Operation fields apply in this order: `money`, `joker` (a rarity, with `fallbackMoney`), `tarots`, `levels`, `hands`, `targetMult`, `discount` (with `freeRerolls`), `jokerEdition` (an id or `{ weights }`, with `fallbackMoney`), `seals`, `pack` (a pack id, opened last).
- `piggybank` (Piggy Bank Tag): +$6.
- `buddy` (Buddy Tag): a common Joker you don't own (paid 0), or $4 when the slots are full or none is left.
- `tarot` (Tarot Tag): 2 random Tarot cards, as many as fit.
- `fanfavorite` (Crowd Pleaser Tag): the most-played hand +1 level (a random hand when none has been played).
- `secondwind` (Second Wind Tag): +1 hand in the next Blind.
- `headstart` (Head Start Tag): next Blind target ×0.75.
- `sale` (Sale Tag): next Shop Jokers 25% off, +1 free reroll.
- `grabbag` (Grab Bag Tag): a free Jumbo Card Pack.
- `collector` (Glimmer Tag): Sheen/Dither/Glitch on a random Joker without an Edition, or $4.
- `ghost` (Ghost Tag, from Ante 2): a free Jumbo Ghost Pack.
- `stamp` (Ribbon Tag): a random Seal on 2 random unsealed deck cards.
- `sky` (Sky Tag): a free Jumbo Planet Pack.

### 3.12 Booster Packs (`PACKS`, 15 rows: 5 kinds × 3 sizes)
| kind | Normal (shown/picks/price) | Jumbo | Mega | deals a hand | from Ante |
|---|---|---|---|---|---|
| card | 4 / 1 / $4 | 6 / 1 / $6 | 6 / 2 / $9 | no | 1 |
| tarot | 4 / 1 / $4 | 6 / 1 / $6 | 6 / 2 / $9 | yes | 1 |
| planet | 4 / 1 / $4 | 6 / 1 / $6 | 6 / 2 / $9 | no | 1 |
| joker | 2 / 1 / $6 | 3 / 1 / $8 | 4 / 2 / $10 | no | 1 |
| ghost | 2 / 1 / $5 | 3 / 1 / $7 | 4 / 2 / $10 | yes | 2 |

Row ids are kind + size: `cardnormal`, `cardjumbo`, `cardmega`, `tarotnormal`, …, `ghostmega`. Row fields: `id, kind, size, name, text, shown, picks, price, fromAnte, dealsHand` (and `oldId` where a v2 crate is renamed).

### 3.13 Decks (`DECKS`, 10)
Each row has `mods`, `unlock` text and `unlockedBy`.

| id (name) | effect | unlocked by |
|---|---|---|
| firstissue (House Deck) | the standard deck | start |
| speedlines (Firefly Deck) | hands +1, discards −1 | start |
| sketchbook (Seer's Deck) | discards +1; Tarot cards $1 cheaper (`tarotPriceDelta`) | start |
| panorama (Candelabra Deck) | handSize +1, discards −1 | best Ante 3 |
| bargainbin (Rags to Riches Deck) | 6 random Gilt-Edged cards (`startEnhancement`); $0 | best Ante 4 |
| studio (Parlour Deck) | consumableSlots +1; starts with inkpot, boxingglove, spotlight | best Ante 5 |
| rubberstamp (Gift-Wrapped Deck) | 8 random cards get a random Seal (`startSeals`) | best Ante 6 |
| mintcondition (High Roller Deck) | $12 (`money`); Jokers sell for their full cost (`sellFull`); rewards −$1 (`rewardDelta`) | any win |
| halftone (Mirrorball Deck) | Shop and Joker Pack Joker Edition odds ×2 (`editionOdds`); starts with a random common Joker with Sheen (`startJoker`) | best Ante 7 |
| spooky (Spooky Deck) | Spectral cards in the Shop; Ghost Pack weight ×2 (`ghostPackWeight`); starts with curtaincall | a win on uhoh, gulp or yikes (Nightfall Stake or higher) |

### 3.14 Stakes (`STAKES`, 4)
Each row has `targetMult`, `mods`, an optional `interestCap`, `unlock` text and `unlockedBy` (`{ type:'start' }` or `{ type:'win', on: stakeId }`).
- `sunny` (Twilight Stake): targets ×1. Unlocked from the start.
- `uhoh` (Nightfall Stake): targets ×1.2. Unlocked by a win on `sunny`.
- `gulp` (Moonless Stake): targets ×1.2, discards −1. Unlocked by a win on `uhoh`.
- `yikes` (Last Candle Stake): targets ×1.4, discards −1, interest cap $3. Unlocked by a win on `gulp`.

### 3.15 Other tables
- `HANDS`: §2.2 rows `{ id, name, chips, mult, lchips, lmult, text }`.
- `BLINDS`: `{ id, kind, name, text, mult, reward, skippable }` for `small`, `big` and `boss`.
- `ANTE_TARGETS`: the §2.6 array.
- Name tables:
  - `RANK_NAMES`: `{2:'2', …, 11:'J', 12:'Q', 13:'K', 14:'A'}`.
  - `RANK_WORDS`: `Two … Ace`, with plurals in `RANK_PLURALS`.
  - `SUIT_NAMES`: `{S:'Spades', H:'Hearts', D:'Diamonds', C:'Clubs'}`.
  - `SUIT_ORDER`: `['S','H','C','D']`.
- `RARITIES`: `{ common:{ name:'Common', weight:70 }, uncommon:{ name:'Uncommon', weight:25 }, rare:{ name:'Rare', weight:5 }, legendary:{ name:'Legendary', weight:0 } }`.
- `DEFAULTS` (§2.11), `SHOP` (slots, weights, prices, sell values, reroll, Card Pack and Tall Tale odds) and `ECONOMY` (interest, hand bonus, endless growth).

---

## 4. Engine API: `src/engine.js` → `TW.Engine`

- All state lives in one plain-JSON **run** object, with no functions, Sets or Maps.
- Mutating functions change the run in place and return a result object.
- **Invalid player actions never throw.** They return `{ ok:false, error:'<sentence for the player>' }`. Successful calls return `{ ok:true, … }`.
- A failed action leaves the run exactly as it was, and each check gives the same answer and sentence as its action: `canPlay` and `canDiscard` (with uids), `canUseConsumable`, `canBuy` and `canPackPick`; when `canSell` refuses, so does the sale (added 2026-11-23 (Jokers); the fuzz checks it after every action, §7).
  - That holds for internal errors too: every action, and `Engine.addJoker`, takes the run's JSON before it starts and puts it back on the same run object when it fails inside (added 2026-11-23 (Jokers, engine fix); about 0.1–0.3 ms per action). A selected uid that is in the hand but has no valid card behind it (a stale or edited save) is refused by every check with the action's own sentence, "Select cards from your hand." (changed 2026-11-23 (Jokers, engine fix): `canPlay` said yes and `playHand` then failed, fading the score under The Fade).
  - Such a uid that is not selected is skipped by everything that picks among or changes the hand's cards (added 2026-11-24 (final review): `canDiscard` and `canUseConsumable` said yes, then The Fumble's extra card or Wickwisp hit the missing card and the action failed with "That didn't work."): The Fumble's extra card is a real card; a `'hand'` suit change (`suitFromSelected`, `suitFromLeftmost`; Wickwisp) changes the real cards and lists only them in `effect.uids`; the random destroys (`destroyOthers`, `destroyRandom`) pick real cards; and `needCards` counts only real cards. `deserialize` drops such uids altogether (§4.2).
- A missing or malformed run gives a failed result, or an empty answer for queries. `Engine.addJoker`, `Engine.serialize` and `Engine.applyRunToRecords` never throw either (added 2026-11-23 (Jokers)): on an internal error they give null, null and `{ records: Engine.normalizeRecords(records), unlocked: [] }`.
- **Ids** (added 2026-11-24 (final review)). An id names a row only if the table has that row of its own, so an id named after an `Object.prototype` member (`'constructor'`, `'toString'`, `'valueOf'`, `'__proto__'`, …) is unknown like any other, wherever an id is read: `newRun` and `deserialize` fall back to the first Deck and Stake (§2.11); the Shop and packs refuse such an item or option (§4.2); `addJoker` returns null; a `bestHand` with such a hand id is null in a run, in `Engine.stats` and in the records; a card's Enhancement, Edition, Seal or suit with such an id does nothing and has no name or line; a Tag or Boss Blind id is no Tag or Boss Blind; and `jokerProblems` reports such a condition, counter, setter or Tag as unknown (in play it never fires). An id is a string: `newRun({ deckId: ['speedlines'] })` falls back too, and `addJoker(run, ['jinglejester'])` is null. (Before: `STAKE.toString` and `DECK.constructor` counted as rows, so every target was NaN, no hand could beat one and the save after it did not load; a Joker with id `constructor` was for sale, sold for NaN and left `run.money` NaN.)
- `Engine.debug = true` rethrows internal errors, for development.

### 4.1 Run object shape (fields the UI may read)
```js
run = {
  version: 3,
  seed: 'K7Q2M9TX', rng: <uint32 state>, nextUid: 53,
  deckId: 'firstissue', stake: 'sunny',
  ante: 1, blindIndex: 0,                 // 0 Small, 1 Big, 2 Boss
  phase: 'blind-select' | 'play' | 'cashout' | 'shop' | 'pack' | 'win' | 'gameover',
  endless: false, won: false, recorded: false,
  money: 4,
  hands: 4, discards: 3, handSize: 8, jokerSlots: 5, consumableSlots: 2,
  cards: [card],                          // every card the player owns (§2.1)
  jokers: [{ uid:'h1', id:'gingerbreadfool', state:{ chips:60 }, paid:4, edition:null }],
                                          // state holds the row's state keys; Stand-In adds target (a uid | null),
                                          // Old Flame copy (null | { id, state }) (§3.4; added 2026-11-23 (Jokers))
  consumables: [{ uid:'k1', kind:'tarot'|'planet'|'spectral', id:'inkpot' }],
  levels: { high:1, pair:1, ... },        // every hand id
  plays:  { high:0, pair:0, ... },
  vouchers: ['musclecourse'],
  bosses: { 1:'heckler', 2:'smudge', ..., 8:'bigfinish' },
  tags: { '1-0':'piggybank', '1-1':'headstart', ... },  // `${ante}-${blindIndex}`
  blindStatus: { '1-0':'cleared' | 'skipped' },
  pending: { extraHands:0, extraDiscards:0, handSizeDelta:0, targetMult:1, sale:false },
  sortMode: 'rank' | 'suit' | 'manual',
  discovered: { jokers:[], consumables:[], bosses:[], vouchers:[], tags:[] },
  blind: null | {
    kind:'small'|'big'|'boss', index, boss: null|bossId,
    target, score, handsLeft, discardsLeft, handSizeDelta,
    draw:[uid], hand:[uid], discardPile:[uid],
    handsPlayed, discardsUsed, cardsDiscarded,   // the first hand is handsPlayed === 0
    hideRanks:false, wetJoker:null|jokerUid, grudgeHand:null|handId,
    heldAtClear:[uid],                      // cards in hand when the Blind was beaten
    log:[{ handId, name, level, chips, mult, total, scoreAfter }],
    freeDiscardUsed:false,                  // added 2026-11-23 (Jokers): freeSmallDiscard used this Blind
    handSizeBy:{ [jokerUid]: n }            // added 2026-11-23 (Jokers): hand size each Joker's handSizeThisBlind added
  },
  shop: null | {
    items:[{ slot:'card'|'pack'|'voucher', kind:'joker'|'tarot'|'planet'|'spectral'|'pack'|'voucher',
             id, price, sold:false, edition:null|editionId, size:null|'normal'|'jumbo'|'mega' }],
    rerollCost, rerolls, freeRerolls, discount,
    packsBought                             // added 2026-11-23 (Jokers): packs bought this visit (firstPackExtraPick)
  },
  anteVoucher: null | voucherId, anteVoucherAnte: 0,
  pack: null | {
    id:'tarotjumbo', kind:'card'|'tarot'|'planet'|'joker'|'ghost', size, picksLeft, returnTo:'shop'|'blind-select',
    options:[ {kind:'card', card, picked} | {kind:'tarot'|'planet'|'spectral', id, picked} | {kind:'joker', id, edition, picked} ],
    hand:[uid], draw:[uid]                  // the dealt hand of a Tarot or Ghost Pack; empty for the others
  },
  cashout: null | { lines:[{ label, amount }], total },
  stats: { handsPlayed, cardsPlayed, cardsDiscarded, blindsCleared, blindsSkipped, moneyEarned, consumablesUsed, rerolls, bestHand:{ handId, score } | null },
}
```
Older saved runs without the 2026-11-23 fields load and play: a missing field reads as unused (false, empty or 0).

### 4.2 Functions
**Constants:** `Engine.VERSION` (3, the run version), `Engine.RECORDS_VERSION` (2) and `Engine.HAND_IDS` (the nine hand ids, strongest first).

**Creation and storage**
- `Engine.randomSeed() → string`: 8 characters from `A–Z` and `2–9` (no O, I, 0 or 1).
- `Engine.newRun({ deckId='firstissue', stake='sunny', seed }) → run`:
  - The run starts in phase `'blind-select'`, Ante 1, `blindIndex` 0.
  - All randomness comes from a seeded PRNG kept in `run.rng`. The same seed plus the same actions always gives the same run.
- `Engine.serialize(run) → string` and `Engine.deserialize(str) → run | null`. Deserialize returns null for bad JSON, a wrong `version` (a v2 run) or a broken shape.
  - A run saved before the 120-Joker table names its Jokers by the 27 v2 ids. Deserialize maps them through `oldId` in `run.jokers`, Old Flame's `state.copy`, `run.discovered.jokers`, the Shop's Joker items and a Joker Pack's options; the renamed rows keep their state keys, so the run plays on (added 2026-11-23 (Jokers)). A current save comes back unchanged.
  - It also repairs the numbers the actions read, since JSON saves NaN and Infinity as null and an edited save may hold anything (added 2026-11-23 (Jokers, engine fix)). A value that is not a finite number goes back to its starting value: money, `plays`, the `stats` counts, the Blind's score and counters and `pending`'s counts 0 (`pending.targetMult` 1, and a broken `stats.bestHand` null); `hands`, `discards`, `handSize` and the slots their defaults; Ante 1; levels 1; the Blind's hands left 1; the Shop's `rerollCost` the base $5, its rerolls and free rerolls 0, its discount 0 and a broken item price the item's price; a cash-out line $0. `nextUid` is raised above every uid in use. Each Joker's state gets its row's missing keys, along Old Flame's copy. A Blind whose target is not a finite number above 0 makes deserialize return null, since any hand would beat it.
  - Added 2026-11-24 (final review): an unknown Deck or Stake id (an id named after an `Object.prototype` member included) becomes the first row, `firstissue` or `sunny`, as the rules already read it (§2.11). Hand, draw-pile and discard-pile uids that name no card in `run.cards` are dropped, the Blind's and an open pack's; a hand in play (the Blind's, or the dealt hand of an open Tarot or Ghost Pack) that lost one refills from its draw pile up to the hand size, as after a play. A current save still comes back unchanged.

**Queries** (pure, never mutate)
- **Lookups:**
  - `Engine.getCard(run, uid) → card | null`.
  - `Engine.blindsForAnte(run) → [BlindInfo ×3]` and `Engine.currentBlindInfo(run) → BlindInfo`, where BlindInfo is `{ index, kind, name, target, reward, boss: null|{id,name,text}, tag: null|{id,name,text}, status: 'cleared'|'skipped'|'current'|'upcoming' }` (the status values are ids; the UI shows `'upcoming'` as "Unlit", §6.1). For a Boss Blind whose cap rises with the Ante (The Lid), `boss.text` ends with the cap at that Ante: "Mult can't go above 12, plus 6 for each Ante after Ante 3 (now 18)." (added 2026-11-23 (Jokers, balance)); every other text is the row's.
  - `Engine.blindTarget(run, ante, index) → number`, `Engine.anteBaseTarget(ante)` and `Engine.handSizeNow(run)`. Targets include `bossTargetMult` for a Boss Blind (§2.6).
- **Hands and scoring:**
  - `Engine.evaluate(cards, { washout=false, censor=false, wrapStraights, fourCardFlush, wildJacks, everySuit }={}) → { handId, scoringUids } | null`. It takes card objects in play order and returns null for 0 or more than 5 cards. The last four options (added 2026-11-23 (Jokers)) are the detection rule words (§2.2), for evaluating without a run.
  - `Engine.preview(run, uids) → null | { handId, name, level, chips, mult, scoringUids }`. Base values only, for showing while cards are selected. It works on the Blind hand or a pack hand, and uses the same detection as scoring, the active Jokers' rule words included.
  - `Engine.scoreCards(run, playedCards, heldCards) → ScoreResult`. Pure scoring using the run's levels, Jokers (copies and rule words included), Boss Blind and Ante. Used by `playHand` and by tests.
  - `Engine.handTable(run) → [{ handId, name, level, chips, mult, plays }]`, strongest first.
  - `Engine.deckView(run) → { cards:[card], remaining:[uid] }`. Cards are in suit order, then rank descending. `remaining` is the draw pile during a Blind, else every uid.
- **Jokers and consumables:**
  - `Engine.jokerText(run, uid) → string` (text plus live values) and `Engine.jokerSellValue(run, uid) → number` (§2.8: `max(1, floor(cost / 2))`, or `max(1, cost)` on the High Roller Deck; 0 for an unknown uid).
  - `Engine.jokerSlotsUsed(run) → number`: the Jokers without the Phantom Edition.
  - `Engine.jokerCopies(run, uid) → [{ id, uid }]` (added 2026-11-23 (Jokers)): what a copier acts as right now, final targets after any chain, in order (The Puppet Master: left, then right). `uid` is the copied Joker's uid in the rack, or null for Old Flame's remembered Joker. `[]` for a Joker that copies nothing or is not a copier.
  - `Engine.consumableInfo(run, uid) → { uid, kind, id, name, text, where, select:[min,max], sell }` and `Engine.consumableSellValue(run, uid)`. `select` includes `tarotSelectPlus` (Helping Hand).
- **Cards:**
  - `Engine.cardText(run, uidOrCard) → [line]`: the card's name ("Queen of Hearts"), then its Enhancement, Edition and Seal lines ("Vintage: … (stored +8, next +12)": what it has stored and what its next scoring pass gives, since it stores +4 first; changed 2026-11-23 (Jokers, engine fix): it said "(now +8)" for a card whose next pass gives +12). It accepts a pack option's card object too.
  - `Engine.editionInfo(id) → { id, name, text, jokerText, cardText, surcharge } | null` and `Engine.sealInfo(id) → { id, name, text } | null`.
- **Checks**, each `→ { ok, error? }`, with the same sentences the actions give:
  - `Engine.canUseConsumable(run, uid, selectedUids)`, `Engine.canBuy(run, itemIndex)` and `Engine.canPackPick(run, optionIndex, selectedUids)`.
  - A Shop item whose id names no content row, or whose price is not a number of $0 or more, is "There is nothing for sale there."; a pack option that names no row, or a card option that is not a valid new card, is "Pick one of the pack's cards." (added 2026-11-23 (Jokers): `buy` used to take the money for a Joker id the table no longer has and add nothing). Only a stale or edited run can hold such an item.
  - `Engine.canPlay(run, uids?)` and `Engine.canDiscard(run, uids?)`. Without uids they check only the phase, hands, discards and costs.
  - `Engine.canSell(run)`.
- **Money and the end of a run:**
  - `Engine.interestPreview(run) → number` (the interest if cashing out now; `interestStep` included) and `Engine.rerollCost(run) → number` (what the next reroll charges: 0 while a free reroll is left, else `shop.rerollCost` less `rerollDiscount`, at least $1; the base $5 less the discount outside the Shop).
  - `Engine.stats(run) → { ante, bestHand:{handId,name,score}|null, mostPlayed:{handId,name,plays}|null, handsPlayed, cardsDiscarded, blindsCleared, blindsSkipped, moneyEarned, seed }`.
- **Helpers:** `Engine.cardChips(card)`, `Engine.cardName(card)`, and `Engine.formatNumber(n)` (at most 2 decimals, trailing zeros trimmed; whole numbers and anything from 1e15 up print as they are, changed 2026-11-23 (Jokers, engine fix): `1e21` printed as 999999999999999900000).
- **Joker rows:** `Engine.VOCABULARY` (the §3.4 words: `on`, `conditions`, `counters`, `events`, `eventOps`, `setters`, `rules`, and `amounts`, added 2026-11-23 (Jokers)) and `Engine.jokerProblems(row) → [sentence]` (empty when the row is sound).
- **`jokerText` live values** follow §3.4 (changed 2026-11-23 (Jokers): "now +N Chips" instead of "now +N", "named:" instead of "marked:", and the new live values).

**Actions** (mutate the run)
- **Blinds:**
  - `Engine.startBlind(run) → { ok, drawn:[uid], lost, jokerEvents }`. From `'blind-select'`; it deals the hand and the phase becomes `'play'`; then the Stand-Ins pick and the `blindStart` events fire (§2.3).
  - `Engine.skipBlind(run) → { ok, tag:{id,name,text}, gained:{ money?, jokerId?, jokerUid?, consumableIds?, handId?, edition?, uids?, seals?, pack? }, jokerEvents }`.
- **Playing:**
  - `Engine.playHand(run, uids) → { ok, result: ScoreResult, fade: null|{ before, after }, cleared, lost, won, drawn:[uid], money, eaten:[jokerUid], enhanced:[uid], score, jokerEvents }`.
    - `money` is the step money of the hand. `eaten` lists the Jokers that left the rack after the hand or when the Blind was beaten (changed 2026-11-23 (Jokers): it used to list only the Blind-beaten ones).
    - When `cleared`, the phase becomes `'cashout'` (or `'win'` for Ante 8's Boss Blind outside Endless mode) and `run.cashout` is filled.
    - When `lost`, the phase becomes `'gameover'`.
  - `Engine.discard(run, uids) → { ok, drawn:[uid], cost, free, extra: uid|null, money, created:[consumableUid], lost, jokerEvents }`. `money` is the cards' (Crumpled) and `created` the Comet Seals' Planet cards; Joker money and Joker-created cards are in `jokerEvents`. `drawn` includes the cards a Joker's `handSizeThisBlind` drew.
  - `Engine.useConsumable(run, uid, selectedUids) → { ok, effect, lost, jokerEvents }`. The effect is `{ kind, id, … }` with whichever of these apply: `uids`, `enhancement`, `seal`, `edition`, `suit`, `sourceUid`, `destroyed:[uid]` (cards or Jokers), `created:[uid]` (cards or consumables), `drawn`, `money`, `moneyLost`, `hands`, `discards`, `handSize`, `discardsForGood`, `handSizeForGood`, `jokerId`, `jokerUid`, `hit` (Happy Accident), `handId`, `levels`, `level`, `levelsAll`, `sourceUids` (added 2026-11-23: every copied card when Helping Hand lets Carbon Copy take 2), and `nextBlind: true` when a "this Blind" part waits for the next Blind (§2.9).
- **The rack and the hand:**
  - `Engine.sellJoker(run, uid) → { ok, money, jokerEvents }` and `Engine.sellConsumable(run, uid) → { ok, money }`.
  - `Engine.setSort(run, 'rank'|'suit') → { ok }` re-sorts now.
  - `Engine.reorderHand(run, uids) → { ok }` works on the Blind or pack hand and sets `sortMode` to `'manual'`.
  - `Engine.reorderJokers(run, uids) → { ok }`.
- **Shop and packs:**
  - `Engine.collect(run) → { ok, total }`. From `'cashout'`: it adds the money and builds the Shop. The phase becomes `'shop'` and `run.blind` becomes null.
  - `Engine.buy(run, itemIndex) → { ok, item, opened:boolean, jokerEvents }`. `opened` is true when a pack opened (phase `'pack'`).
  - `Engine.reroll(run) → { ok, cost, free }`.
  - `Engine.packPick(run, optionIndex, selectedUids?) → { ok, kind, picksLeft, closed, uid?, id?, effect?, jokerEvents }`. Tarot, Planet and Spectral picks are used at once (`effect` as in `useConsumable`).
  - `Engine.packSkip(run) → { ok }`. Both pack actions return to `run.pack.returnTo` when the pack closes.
  - `Engine.leaveShop(run) → { ok }`. Advances to the next Blind (or Ante) and sets phase `'blind-select'`.
- `Engine.goEndless(run) → { ok }`. From `'win'`: sets `endless = true` and phase `'cashout'`.
- **`jokerEvents`** (added 2026-11-23 (Jokers)): what the Jokers' events did during the action, in order, so the UI can show it (a toast, a Joker bump). Each entry is `{ uid, id, copyOf, event, op, … }`: `uid`/`id` the Joker, `copyOf` the copied Joker's id when it came through Old Flame's copy, or through a Stand-In's or The Puppet Master's copy (added 2026-11-23 (Jokers, engine fix); else null), `event` the event name (`'discard'`, `'blindStart'`, …), `op` what happened, plus its fields:
  - `'state'` `{ key, from, to }`: a state key changed (`set`, `add`, `max`);
  - `'money'` `{ amount }`; `'extraHand'` `{ hands }`; `'gainTag'` `{ tag, gained }`;
  - `'editionDeckCards'` `{ uids, editions }`; `'sealHandCard'` `{ uids, seals }`; `'enhanceAdded'` `{ uids }`; `'rankUpScored'` `{ uids }`;
  - `'createPlanet'`, `'createTarot'`, `'createSpectral'` `{ created:[consumableUid] }`; `'handSizeThisBlind'` `{ handSize, drawn }`;
  - `'forgot'` `{}`: Old Flame's copied ability would have eaten itself, so Old Flame has nothing now;
  - `'copy'` `{ from }` (event `'jokerSold'`): an Old Flame took on the sold Joker (`copyOf` its id, `from` its uid).
  Eaten Jokers are listed in `playHand`'s `eaten`, Lamplighter's cards in `enhanced`.
- **For tests and internal use:**
  - `Engine.addJoker(run, id, paid=0, edition=null) → Joker | null`. Null when the slots are full (a Phantom Joker always fits) or the id is unknown. It allows duplicates. Like a bought or created Joker, it lets a Stand-In that has no target pick one (§3.4; added 2026-11-23 (Jokers, engine fix)).
  - `Engine.makeCard(rank, suit, { enhancement, edition, seal, grow } | enhancementId) → card`, with uid `'x' + n`.

**Records** (the UI stores them; version 2)
- `Engine.defaultRecords() → { version:2, runs:0, wins:0, bestAnte:0, bestHand:null|{handId,name,score}, unlockedDecks:['firstissue','speedlines','sketchbook'], unlockedStakes:['sunny'], wonOn:[], history:[], discovered:{ jokers:[], consumables:[], bosses:[], vouchers:[], tags:[] } }`.
- `Engine.normalizeRecords(records) → records`. It fills missing fields.
  - It migrates version 1 records by renaming fields (`voyages` → `runs`, `unlockedSeaStates` → `unlockedStakes`, `seaState` → `stake`, `discovered.charms` → `jokers`).
  - It maps old ids to new ones through the content `oldId` columns, and drops unknown ids from the lists. A history entry is kept, with an unknown Deck or Stake id set to null.
  - Version 2 records go through the same maps for their `discovered` lists (added 2026-11-23 (Jokers)): today's ids are kept, an old id becomes its new id (a v2 Joker id saved before the 120-Joker table, such as `anchor`, becomes `jinglejester`), and an id no table knows is dropped, as are duplicates. `applyRunToRecords` records a run's discovered ids the same way.
  - Any other version gives fresh records.
  - Every version is then cleaned the same way (added 2026-11-23 (Jokers, engine fix): version 2 records kept junk): `unlockedDecks`, `unlockedStakes` and `wonOn` keep only known ids, once each; `history` entries are rebuilt field by field (anything that is not an object is dropped, the last 12 are kept); `bestHand` needs a poker hand id and a finite score, else it is null; `runs`, `wins` and `bestAnte` are counts of 0 or more.
  - A history entry keeps its `seed` when it is a non-empty string, and has no `seed` otherwise; an entry saved before entries kept one loads exactly as it was (added 2026-11-24 (final pass); the records stay version 2).
- `Engine.applyRunToRecords(records, run, { final=false, now='' }) → { records, unlocked:[{ type:'deck'|'stake', id, name }] }`. It returns a new records object.
  - Always: update `bestAnte` and `bestHand`, merge `run.discovered`, and unlock Decks by best Ante (panorama 3, bargainbin 4, studio 5, rubberstamp 6, halftone 7).
  - Always, for a run in Endless mode that is already recorded (`run.endless && run.recorded`; it was filed when it was won): its history entry follows it. The entry's `ante` rises to `run.ante` and its `bestScore` to the run's best hand, never down, so Past runs shows the last Ante of a run that ends in Endless mode, or is saved and left there (added 2026-11-24 (final pass): the final call at its Game Over returned early, and the entry kept Ante 8 and the win's best hand). The entry is the newest win with the run's `seed`, Deck and Stake; an entry filed before entries kept a seed counts only when it is the newest entry and a win on the run's Deck and Stake, and it then takes the run's seed. No other entry changes, and a run with no entry of its own (records erased since its win) changes none; nothing is counted again.
  - When `final` and `!run.recorded`:
    - Count the run.
    - If `run.won`: count a win, unlock `mintcondition`, unlock `spooky` on a win on uhoh, gulp or yikes, and unlock the next Stake.
    - Push `{ at: now, deckId, stake, ante, won, bestScore, seed }` onto `history` (keep the last 12). `seed` is the run's seed (added 2026-11-24 (final pass)).
    - Set `run.recorded = true`.

### 4.3 ScoreResult and trace steps
```js
ScoreResult = {
  handId, name, level,
  playedUids:[uid], scoringUids:[uid], booedUid: null|uid,
  steps:[Step], chips, mult, total,
  grow:[{ uid, by }],                     // Vintage growth this hand (playHand stores it)
  jokerGains:[{ uid, path, key, from, to, cardUid, at }]   // added 2026-11-23 (Jokers): state gains counted
                                          // during scoring (cardScored, handScored), in order. uid: the Joker holding the
                                          // state; path: [] or ['copy','state'] (Old Flame's copy); cardUid: the scored card
                                          // (cardScored) or null; at: the number of steps before it. playHand stores them.
}
Step = {
  source: 'base' | 'card' | 'held' | 'joker' | 'boss',
  uid: null | cardUid | jokerUid,         // what to point at in the UI
  cardUid: null | cardUid,                // for Joker effects triggered by a card: that card
  kind: 'chips' | 'mult' | 'xmult' | 'money' | 'note',
  amount: number,                         // +chips, +mult, ×factor, +$; 0 for notes
  label: '+35' | '+5' | '×1.5' | '+$1' | 'Encore!' | 'Booed' | 'Cameo' | 'Capped at 12' (or the cap at that Ante, §3.9) | 'Half Mult' | 'Warm-up: half' | 'Pair lv.2',
  via: null | 'rank' | 'enhancement' | 'edition' | 'seal' | 'joker' | 'retrigger' | 'boss',
  enhancement: null | enhancementId,      // on Enhancement steps
  edition: null | editionId,              // on Edition steps, and on a Phantom card's rank step
  seal: null | sealId,                    // on the 'Encore!' note of an Encore Seal, and the 'Cameo' note
  jokerUid: null | jokerUid,              // on an 'Encore!' note a Joker caused
  copyOf: null | jokerId,                 // added 2026-11-23 (Jokers): a copier's step: the Joker whose ability it is
  jokerName: null | string,               // added 2026-11-23 (Jokers): on a Joker's steps and the 'Encore!' notes it causes:
                                          // its name, or 'Stand-In (as Jingle Jester)' for a copy
  runningChips: number, runningMult: number      // after this step
}
```
- The first step is always `{ source:'base', kind:'note', via:null, label:'<name> lv.<n>' }`, with the base values as running values.
- Each effect is its own step, so a Joker with +15 Chips and +3 Mult makes two steps.
- Joker Edition steps use source `'joker'`, the Joker's uid and via `'edition'`.
- A copier's steps use its own uid as `uid` (it is the source), with `copyOf` and `jokerName` naming the target (§3.4).
- Every step has every field (null when it does not apply).
- The `'Booed'` note has source `'boss'` and the booed card's uid.
- Mult may be fractional; the UI shows at most 2 decimals with trailing zeros trimmed.

### 4.4 Error sentences
Keep them short and specific.
- Generic: "That didn't work."
- Blinds: "There is no Blind to start right now." · "You can't skip a Blind right now." · "Boss Blinds can't be skipped."
- Playing:
  - "You can't play a hand right now." · "Select 1 to 5 cards to play." · "No hands left this Blind." · "The Squeeze: play at most 4 cards." (3 before the balance pass of 2026-11-23)
  - "You can't discard right now." · "Select 1 to 5 cards to discard." · "No discards left this Blind." · "The Tollbooth: each discard costs $2."
  - "Select cards from your hand."
- Selecting: "Select exactly 1 card." · "Select 1 or 2 cards." · "Select 2 or 3 cards." · "Select 1 to 3 cards." · "Select 1 to 4 cards." · "Select 2 to 4 cards." (The Tailor with Helping Hand; added 2026-11-23 (Jokers)).
- Money and slots: "Not enough money." · "Your Joker slots are full." · "You need a free Joker slot." · "Your consumable slots are full."
- Consumables:
  - "Only usable during a Blind." · "You can't use that right now." · "That card isn't in your consumable slots."
  - "There are no common Jokers left to find." · "There are no Jokers left to find."
  - "You need at least 1 Joker." · "You need at least 2 Jokers." · "You need a Joker without an Edition." · "You need at least 2 hands left." · "You need another Tarot or Planet card." · "You need at least 2 cards in hand."
- The rack and the hand: "You can't sell right now." · "That Joker isn't in your rack." · "Sort by rank or suit." · "That order doesn't match your hand." · "That order doesn't match your Jokers."
- Shop: "There is nothing to cash out." · "The Shop is closed." · "There is nothing for sale there." · "Already sold." · "You already have that Joker." · "You already have that Voucher." · "You're not in the Shop."
- Packs: "No Booster Pack is open." · "Pick one of the pack's cards." · "You already took that card."
- End of run: "The run isn't won yet."

The Squeeze and Tollbooth sentences are built from the Boss Blind's name and number.

---

## 5. Persistence (owned by the UI, `src/ui/00-core.js`)
- The built game is one file, `index.html` (§0; BUILD-LOG.md decision), and its storage keys use the prefix `ember:`, which does not depend on the working title, so a rename keeps everyone's saves.
- Every `localStorage` call sits inside try/catch. The game still works fully when storage is missing or throws.
- A write that fails (storage full or missing) keeps the value in memory, and that copy is newer than anything stored: every read of the key takes it until a write gets through again, so Continue in the same session brings the run back as it is, never an older save that happened to fit. A full storage is told once, in a toast, that the game can't save (changed 2026-11-24 (final pass, part 2): a read took the stored copy first).
- *Save and quit* says "Run saved. Continue it from the title screen." only when the run reached storage. When the run's last write failed it says "Your browser's storage is full, so the run could not be saved. It lasts until you close the page: continue it from the title screen." (with no storage at all: "The run could not be saved in this browser. It lasts until …"); when it is the first write to meet a full storage, that line stands for the toast above (changed 2026-11-25 (final pass, part 3): it said "Run saved" right after that toast, and a reload lost the run).
- `ember:settings`: the settings object (§6.6).
- `ember:run`: `Engine.serialize(run)`. Written after every engine action, and removed once a run ends and is recorded.
- `ember:records`: the records object (§4.2), read through `Engine.normalizeRecords`.
- Old `tidewager:*` keys are ignored. A version 2 run fails `deserialize` and is dropped. Version 1 records would migrate through `normalizeRecords` if read.
- In test mode the keys get a `test:` prefix (§6.5).

---

## 6. UI (`src/shell.html`, `src/styles/*.css`, `src/ui/*.js`; uses `TW.Art` and `TW.Audio`)
The look is Ember Lit (`mockups/ember-lit/`, chosen 2026-11-23) with the grafts in ARCH.md §1; ARCH.md §5 has the UI file layout. The screens, test hooks and behaviour below are the contract it must meet.

### 6.1 Screens and layout
`document.body.dataset.screen` always holds the current screen name. On every in-run screen (blind-select, play, cashout, shop, pack), the **left panel** is present. From top to bottom it holds:
1. The Blind plate: the Blind name, the Boss Blind's emblem with name and rule on a Boss Blind, "Target" plus the target, and the reward.
2. The Blind score ("Blind beaten" once the Blind is beaten).
3. The selection plate: hand name and level, then the **Chips plate × Mult plate**.
4. Hands left and discards left.
5. Money, then Ante x/8 and "Blind n" (the count of Blinds played or skipped, +1).
6. *Overview* and *Options* buttons.

The **playfield** sits to the right of it:
- Along its top run the Joker rack (slots with a count such as "3/5", plus "+1" per Phantom Joker) and, at the top right, the consumable slots (count 1/2).
- The hand runs along the bottom, with *Play hand*, *Sort* (Rank/Suit) and *Discard* under it.
- The deck sits at bottom right with "44/52".
- The centre is the stage for whatever the phase needs.

The screens:
- **title:** the game's name and menu: *Continue run* (only when a save exists), *New run*, *Collection*, *Records*, *Options* and *How to play*. Past runs come from `records.history`.
- **setup:** a Deck picker with previous/next arrows (each Deck's back, name, text, and unlock condition when locked), a Stake picker with arrows (locked ones show their condition), an optional seed field, *Start run* and *Back*.
- **blind-select:** the Ante's three Blinds side by side, each with name, "Target", reward and status (Cleared / Skipped / Unlit: an unlit candle is a Blind still to come).
  - The Boss Blind shows its emblem, name and rule.
  - The current Blind is raised, with *Play* (start-blind; its name starts with the word it shows: "Play the Small Blind, target 300"), plus *Skip* on a skippable Blind showing the Tag it grants (ARCH.md §1; final pass, part 3, 2026-11-25).
  - Jokers and consumables stay in their racks, usable and sellable where allowed.
- **play:** the full table.
  - Under The Smudge, unselected cards in hand show their suit only.
  - The Joker switched off by The Wet Blanket is visibly switched off.
  - Cards show their Enhancement, Edition and Seal.
- **cashout:** a cash-out plate headed by a pill, "<Blind name> cleared" (the heading, with no second line under it), lists each line with its amount, the total, and one big *Collect $N* button (ARCH.md §1).
- **shop:**
  - The top row holds the cards for sale with a *Reroll $N* button (or *Free*).
  - The bottom row holds the Booster Packs (with size) and the Voucher, beside a *Next Blind* button.
  - Each item shows its art, name, price, Edition and text, plus *Buy*.
  - When something can't be bought, Buy is disabled and the reason is shown (`canBuy`): under Buy from 600 px wide (two lines; three in the one-row Shop of a compact window under 870 px tall, §6.7), whole on the item's sheet, and as a toast when Buy is pressed.
- **pack:** the opened Booster Pack.
  - Cards are drawn as playing cards, the others as their cards or Joker faces.
  - Tarot and Ghost Packs show their dealt hand, selectable as in play.
  - Each option has *Pick* (a playing card or a Joker) or *Use* (a Tarot, Planet or Spectral card, used at once); one that can't be taken says why, from `canPackPick`. Plus "Picks left: n" and *Skip*.
- **win:** a *You win!* plate with the stats (§2.13), *Endless mode* and *Return to title*.
- **gameover:** a *Game Over* plate with the stats, *New run* and *Return to title*.

**Overlays.** Esc closes them; focus is trapped while open and restored on close.
- *Overview*: the poker hand table (hand, level, Chips, Mult, times played), this Ante's Blinds and Boss Blind, Deck, Stake, Vouchers owned and seed.
- *Deck*: every card grouped by suit. During a Blind, cards already drawn are dimmed, with "N of M left".
- *Options* (§6.6).
- *Pause*: Resume, Overview, Options, How to play, Save and quit, and Abandon run (with a confirm step).
- *How to play*: a short rules sheet with the hand table.
- *Records*: runs, wins, best Ante, the best hand ("Brightest hand"), unlocks and history.
- *Collection*: tabs for Jokers, Consumables, Boss Blinds, Vouchers, Tags, Decks, and Enhancements, Editions and Seals. Undiscovered entries show a locked silhouette with "?".

### 6.2 Cards, selection and hand
- Clicking or tapping a card toggles it, up to 5 at once; a Boss Blind's play limit (The Squeeze's `maxPlay`) disables *Play hand* with its reason (`canPlay`: "The Squeeze: play at most 4 cards."), never the choice, so a 5-card discard stays possible (changed 2026-11-24 (final pass): the choice was capped at 4, which blocked a legal discard). Selected cards lift. The selection plate shows the hand name, level and base Chips × Mult (`preview`).
- Cards can be reordered by dragging (pointer events; touch works), with a movement threshold so a tap is still a tap. Jokers can be reordered by dragging too, because order matters.
- Hovering, focusing or long-pressing any card, Joker or consumable shows a tooltip plate: name, text (`cardText` / `jokerText`), Edition and Seal lines, and sell value.
  - The tip can be hovered too: it stays while the pointer is on it or on what it belongs to. Focus the game places (a dialog opening or closing, a card kept in focus through a sort) opens no tip.
  - A press that starts on a tip, hovered or pinned by a long press, only closes it: its click reaches no control under it (changed 2026-11-25 (final pass, part 3): a tap on a pinned tip played the hand).
  - A tip keeps clear of the Move pair (§6.4): a card's tip stands above the pair, or beside it where there is no room above (part 3: the chosen card's tip lay over both arrows).
- Inputs are ignored while an animation runs. `document.body.dataset.busy` is `'1'` during animations and `'0'` otherwise. The deal counts: busy stays `'1'` until the last card dealt has landed (changed 2026-11-24 (final pass, part 2): the deal left it `'0'`). So does a new visit to the Shop: its shelves are built in a task of their own once the screen change has had its frame, and busy stays `'1'` until they are; test mode builds them at once (changed 2026-11-25 (final pass, part 4, P6): built in the same task, the two made one frame of 50 to 100 ms in half the measured entrances). Once input is free, the table sets its buttons afresh, so *Rank*, *Suit*, *Play hand* and *Discard* never stay switched off after a deal (changed 2026-11-25 (final pass, part 3): they stayed off after every deal's hold).

### 6.3 The scoring moment
On *Play hand*, the UI reads the card objects first, then calls `Engine.playHand` and animates `result.steps` in order:
1. The played cards fly to the centre stage: scoring cards slightly raised, unscored ones dimmed.
2. For each step:
   - Its source pops: a card, a held card, a Joker, or the Boss Blind plate.
   - A label rises from it in its colour. `via` and the `edition` / `seal` fields pick the flourish: an Edition shine, a Seal stamp, an "Encore!" burst (a `via: 'retrigger'` note).
   - The Chips and Mult plates roll to `runningChips` and `runningMult`, and a tick sounds, rising in pitch with the step index.
3. Chips × Mult resolve into the total, which drops onto the Blind score.
4. On `cleared` comes a celebration, then the cash-out plate. On `lost`, Game Over.
5. Played cards slide off to the discard side, and drawn cards deal in with a stagger.

All durations scale with game speed. In test mode they are 0. With reduced motion, numbers jump to their final values and only opacity fades remain.

### 6.4 Keyboard
- `1`–`9` toggle the nth card in hand. `D` discards. `S` toggles the sort between rank and suit; a focused card keeps focus through the sort, as with Shift and an arrow, and its tip closes (changed 2026-11-25 (final pass, part 3): focus fell to the page, so the next `Enter` played the hand).
- `Enter` plays the hand from the table: with focus on the page, or on the hand group, where focus lands when *Play* at the Blind select is pressed from the keyboard. On a focused card, button or field it is that control's own key, so on a hand card it chooses the card, as Space does (changed 2026-11-24 (final pass, part 2): it played the chosen hand).
- `I` opens the Overview. `Esc` first closes a tooltip that shows; otherwise it opens Pause or closes the open overlay.
- Closing a dialog hands focus back to its opener (in a dialog still open under it, to its button there), or to the control drawn in its place when a breakpoint redrew the screen under the dialog; a sheet stays by its item the same way. That focus opens no tooltip, so after Pause is closed with `Esc` the next `Esc` opens it again (changed 2026-11-25 (final pass, part 3): focus fell to the page, and the restored card's tip took that `Esc`).
- Shift with ArrowLeft or ArrowRight moves the focused hand card one place along the hand (`Engine.reorderHand`, as a drag does). While exactly one card is chosen, a Move pair over the hand does the same with a click or a tap (§6.5 `move-card`).
- The one-key shortcuts (`1`–`9`, `Enter` on the table, `D`, `S` and `I`) work only while Keyboard shortcuts is on (§6.6; WCAG 2.1.4). `Esc`, `Tab`, Shift with an arrow and a focused control's own keys always work.
- Every control is a real `<button>`, or an input with a visible focus ring.
- No box that scrolls inside itself cuts that ring: a dialog body, the compact Joker rack, the Shop's shelves and its rows that scroll sideways, a pack's options and the run setup's Deck and Stake keep room for it (6 px in most, given back by a negative margin so nothing moves), and a landscape pack's dealt hand stands 6 art pixels clear of the window's foot. A control the keyboard focuses there that its box shows only in part is scrolled whole into view, ring included, and a pack row's soft snap holds off while one of its options has keyboard focus; a control already whole in view never moves, and a press never scrolls (changed 2026-11-25 (final pass, part 4, P3): rings were cut by up to 85 px at 720 × 450 and 844 × 390).

### 6.5 Test hooks (required)
- `?test=1`: every animation duration is 0, audio and music are muted, there is no shake, and storage keys get a `test:` prefix.
- `?seed=ABC`: new runs use this seed.
- `window.TW.app = { getRun(), getSettings(), newRun({ deckId, stake, seed }), screen() }`.
- Every actionable control carries `data-action`:
  - Title and setup: `continue`, `new-run`, `open-collection`, `open-records`, `open-options`, `open-help`, `deck-prev`, `deck-next`, `stake-prev`, `stake-next`, `start-run`, `back`.
  - Blind select and play: `start-blind`, `skip-blind`, `play-hand`, `discard`, `sort-rank`, `sort-suit`, `move-card` (+`data-dir`, -1 or 1: the Move pair, §6.4), `use-consumable` (+`data-uid`), `sell-consumable` (+`data-uid`), `sell-joker` (+`data-uid`).
  - Cash-out, Shop and packs: `collect`, `buy` (+`data-index`), `reroll`, `leave-shop`, `pack-pick` (+`data-index`), `pack-skip`.
  - End of run and menus: `endless`, `to-title`, `open-run-info` (it opens the Overview; the action name stays), `open-deck`, `open-pause`, `close-overlay`, `resume`, `save-quit`, `abandon`, `confirm-abandon`.
- Hand cards are `button.card[data-uid]` with `aria-pressed`. Jokers carry `data-joker-uid` and consumables `data-consumable-uid`.

### 6.6 Options
- Game speed: 1 Relaxed, 2 Normal (default), 3 Fast, 4 Blazing. Durations are divided by 1, 1.6, 2.6 and 4.5 respectively.
- Sound effects volume (0–100, default 60) and music volume (0–100, default 40).
- Screen shake: on (default) or off.
- Motion: Auto (follows `prefers-reduced-motion`), Reduced, or Full.
- Colour-coded suits: off by default. When on, Diamonds and Clubs get their own colours. The label is "Colour-coded suits" (it must not sound like an Edition).
- Mute all sound: off by default (`muted`).
- Keyboard shortcuts: on (default) or off, kept in `ember:settings` as `keys` (boolean). Off, the one-key shortcuts (`1`–`9`, `Enter` on the table, `D`, `S` and `I`) do nothing (WCAG 2.1.4); `Esc`, `Tab` and Shift with an arrow stay (§6.4). Its hint lists the shortcuts (added 2026-11-24 (final pass, part 2)).
- Erase records, with a confirm step.

### 6.7 Layout
Two layouts, the table layout and the compact one, from the queries of `TW.UI.MQ` (`src/ui/00-core.js`); the compact layout has a variant for each small screen below. The pixel size keeps its one query, `TW.UI.MQ.px2` (mirrored in `src/styles/10-tokens.css`): one whole-number size per breakpoint (ARCH.md §2). (Rewritten 2026-11-24 (final pass, part 2) to describe the layouts the UI ships; no rule changed.)
- **The table layout**, 1024 px wide or more: the left panel plus playfield of §6.1, the left panel 104 art pixels wide. An art pixel is 3 CSS px on a window 870 px tall or more (a 312 px panel) and 2 px on a shorter one (208 px), a laptop's browser such as 1024 × 768, 1280 × 720 or 1366 × 768, so the hand and its buttons stay above the fold.
  - **The narrow 3 px table** (1024 to 1279 px wide, 870 px tall or more: 1024 × 900, an iPad Pro held upright at 1024 × 1366): a pack of six (a Jumbo or Mega Card, Tarot or Planet Pack) scrolls its row sideways inside the field where it does not fit, with a thin scrollbar and no snapping (four of six whole at 1024 px wide and five at 1100 px; all six from 1180 px). Beside a Tarot or Ghost Pack's dealt hand the reading plate is 70 art pixels wide and 100 tall and the deck steps aside, so the hand's strips are 44 px at 1024 px wide. *Play hand* and *Discard* keep their label's width, so the controls stay under the hand. The Shop's shelves hold two items a row and scroll inside the panel where they are taller than it (at 1024 × 900 one *Buy* of the five, and four of Night Market's seven, are a scroll of the shelves away). (Final pass, part 4, P2: the strips were 16 px, a Mega pack's sixth card ran off the window with its *Use*, and the controls lay over the column's *Options* at 1024 × 900.)
  - **A short laptop window** (under 870 px tall): the Shop keeps three lines of each item's text at 760 px tall or less (at 820 px or less with Night Market, whose rows of four are taller) and two at 700 px or less, where the kind line steps aside and the shelves sit closer; the whole text is on the item's sheet. At 700 px tall or less (1366 × 620, 1024 × 600) a Boss's name also leaves its rule (the Blind's pill names it), the column's panels sit an art pixel closer, the Blind score's panel is 40 art pixels tall instead of 48 and the Chips and Mult wells 32 instead of 34. (Final pass, part 4, P1: on a Boss Blind *Overview* and *Options* fell 29 to 49 px below the fold, and three of the Shop's five *Buy* buttons sat below its panel's fold at 1366 × 620 and 1024 × 600.)
- **The compact layout**, below 1024 px wide (a phone held either way, a tablet, a narrow window), at 2 px an art pixel:
  - The left panel collapses into a compact top bar: the Blind (its pill names the Ante; the candle and the Boss emblem step aside) with the target and reward, the Blind score, Chips × Mult, money, hands, discards, Ante and the Blind count, and icon buttons for the Overview and Options. The Joker rack scrolls sideways, keeping 6 px of room on its top and sides so a Joker's focus ring shows whole, and while it holds no Joker it is no Tab stop (final pass, part 3). The deck is a chip with its count.
  - Below 600 px wide the bar takes three rows, and the hand runs edge to edge, overlapping to fit, with the buttons stretched across under it. From 600 px wide (a tablet, a narrow window) the bar takes two rows, and the hand and its buttons keep the table's measure.
  - At 820 px tall or less the stage gives up room, so *Play hand* and *Discard* stay in view.
  - In the Shop and an open pack the bar keeps one row: money, Ante, the Blind count, Overview and Options (a Planet Pack keeps the selection plate too, where its pick levels a hand). Below 600 px wide each Shop item stands as a column (its art, a two-line taste of its effect, *Buy*); from 600 px it stands as on the table layout on a window 870 px tall or more, and in the one-row Shop below on a shorter one (a landscape phone's Shop has its own bullet).
  - Sheets rise from the bottom of the screen. The menus, dialogs and sheets keep 44 px targets at every compact width, a landscape phone and a tablet included. At 960 px wide or less the title, setup and Overview plates stack; at 760 px wide or less the menus take one column.
- **A short phone held upright**, below 600 px wide and 760 px tall or less (360 × 640, 375 × 667): the top bar tightens so the table fits one screen.
  - The target sits beside its label, and hands and discards read on one line beside the two buttons. Ante and the Blind count step aside (on the table the Blind's pill names the Ante). Before a Blind the Chips × Mult panel has nothing to show, so it gives its row to the money.
  - In the Shop and a pack the bar is one line, the money beside the two buttons. The Shop's shelves scroll inside its panel, never the page, and the taste of each effect, the Vouchers owned and the Tags at work step aside (the item's sheet and the Overview show them).
  - While a Tarot or Ghost Pack deals its hand the racks step aside, as on a landscape phone, so the reading plate holds every Tarot and Spectral reading whole and the cards never move.
  - A chosen card rises 10 art pixels, as on the table and on every compact window 760 px tall or less (14 elsewhere in the compact layout): the stage over the hand is too short to raise the Move pair, so the chosen card's Seal stays below it (final pass, part 3).
  - At 700 px tall or less the Blind select's candles and Boss emblem step aside (the pills name the Blinds).
- **A compact window under 870 px tall, from 600 px wide** (every one but a landscape phone: 600 × 800, 700 × 700, 900 × 650): the Shop keeps its head row (its pill, *Reroll* and *Next Blind*) and stands its items in one row under it, the cards, then the packs and the Voucher, each as on a phone held upright: the price tag over the art, a pack's name, a two-line taste of its effect, *Buy*, and up to three lines of why it can't be bought (the whole text is on the item's sheet). The items of a shelf share its rows, so every *Buy* stands at one height, and the Vouchers owned and the Tags at work sit under the row. Night Market's seven items scroll the row sideways where they don't fit (two are a swipe away at 600 px wide and at 700 px held wide, one at 700 px held upright and at 800 px held wide; all seven fit at 800 px held upright and from 900 px). The Shop stands at the field's foot, as at the table. (Final pass, part 4, P1: two rows of items beside their text scrolled the page by 59 to 526 px and put three of the five *Buy* buttons below the fold; final agent C: a *Buy* beside one that showed its reason dropped 39 px out of the row, and "Your consumable slots are full." read "Your consumabl…".)
- **A compact window held upright, from 600 px wide and under 870 px tall** (600 × 800, 700 × 700, 600 × 650): the top bar's two rows are set out again so neither grows. The first holds the Blind (half the bar: the target beside its label, a Boss rule in two lines whose tip and the Overview hold it whole), the Blind score and money; the second, Chips × Mult beside hands, discards, Overview and Options. Ante and the Blind count step aside on the table (the Blind's pill names the Ante); the Shop's and a pack's bar keeps them. (Final pass, part 4, P1: three narrow panels in a row of four wrapped the Blind's pill, ran "Blind score" out of its pill and gave a Boss rule five lines, so the bar grew by up to 70 px and pushed *Play hand* below the fold.)
  - At 760 px tall or less (700 × 700, 600 × 650) the stage gives up the rest of its room, as on a short phone, and a chosen card rises 10 art pixels. At the Blind select the candles and the Boss emblem step aside (the pills name the Blinds), and a Boss rule leaves the bar and keeps up to four lines on its Blind, three under 620 px tall, where the Blinds have no room for a fourth; its tip and the Overview show it whole (final agent C: at three lines the longest rule lost its last word from 600 to 639 px wide; with four the page scrolled by 18 px at 600 × 600).
  - At 760 px tall or less the racks also step aside while a Tarot or Ghost Pack deals its hand, or while a Planet Pack is open (its bar keeps the selection plate, where its pick levels a hand), so no pack scrolls the page; the dealt hand rests at the foot of the screen, as at the table (final pass, part 3: a dealt hand scrolled the page by 26 to 106 px, a Mega Planet Pack by 33). Part 4 keeps this, though a held consumable can't be used or sold while they are away (P4): at 700 × 700 the racks (152 px) with the pack and its dealt hand (the options, the reading plate and the hand) need about 740 px, more than the window has; kept, they scroll the page by 42 px at 700 × 700 and by 92 px at 600 × 650, where the dealt hand falls below the fold, and no page scroll is traded for them. The short upright and landscape phones send the racks aside for a dealt hand too; a short window held wide keeps them for every pack (below).
- **A short window held wide**, below 1024 px wide, wider than tall and 601 px to 760 px tall (1000 × 700, 900 × 650, 800 × 620: a browser window shrunk on a laptop): the landscape phone's layout below, with the height a phone lacks given back (final pass, part 4, P1: its two-row top bar left *Play hand* and *Discard* 13 to 81 px below the fold, and up to 172 px more on a Boss Blind).
  - At the Blind select, on the table and at the cash-out the status column stands in §6.1's order: the Blind with its candle or the Boss's emblem and the whole Boss rule, the Blind score, Chips × Mult, hands and discards, money beside Ante and the Blind count, then *Overview* and *Options* with their names at the column's foot. In the Shop and a pack it keeps the landscape phone's narrow column.
  - The Blind select keeps its candles (and the Boss's emblem) and the waiting Tags, its Blinds stand at the stage's foot as at the table, and a Boss rule keeps up to four lines on its Blind.
  - The Shop is the one-row Shop above.
  - The racks stay over every pack, so a held Tarot can be used on a Tarot or Ghost Pack's dealt hand, and a Joker or consumable sold, while it is open (P4: they had stepped aside for every pack that deals a hand and for every Planet Pack). A Tarot or Ghost Pack takes the landscape phone's two columns (a Mega pack's row scrolls where its options don't fit: a Mega Tarot Pack's six below 900 px wide, five whole at 800 px and three at 700, and a Mega Ghost Pack's four at 700 px, three whole). A pack with no dealt hand (a Card, Planet or Joker Pack) stands its name, picks left and *Skip* in a row over its cards, which take the field's width, with the reading plate under them.
  - A toast sits under the racks, centred over the field (84 art pixels down): flush under them over a pack with no dealt hand (80 down), and over the options' column beside a dealt hand, so it covers none of the hand, the Shop's *Buy* row or a pack's head and cards (final agent C: at the foot of the screen it lay over all of them).
- **A landscape phone**, below 1024 px wide, wider than tall and 600 px tall or less (844 × 390, 932 × 430, 667 × 375): a top bar would leave the hand no room, so the left panel comes back as a narrow status column, 112 art pixels wide.
  - The column holds the Blind and its target, the Blind score beside the money, Chips × Mult, then hands and discards beside the Overview and Options buttons (Ante and the Blind count step aside; the Blind's pill names the Ante). Hands and discards take the width their labels need (final pass, part 4: "Discards" ran 9 px out of its panel). A long Boss rule keeps two lines; its tip and the Overview show it whole.
  - The racks stay over the stage, and *Play hand*, *Sort* and *Discard* stand in a column beside the hand, so the whole table fits one screen. At the Blind select the candles and the Boss emblem step aside, and each Blind's buttons sit side by side. The notch and the home bar keep their safe areas.
  - In the Shop and a pack the column narrows to 64 art pixels: money, Ante, the Blind count and the two buttons. The Shop's pill, *Reroll* and *Next Blind* stand in a column at its left, and its items run in one row (the cards, then the packs and the Voucher), each art over its price and *Buy*; the rest is on the item's sheet. Night Market's seventh item scrolls the row sideways, as a Jumbo pack's cards do.
  - A pack's name, picks left and *Skip* stand at the left of its cards (a long name, such as Mega Planet Pack, takes two lines in its pill), the reading plate at their right. A Tarot or Ghost Pack's dealt hand needs the racks' room, so they step aside while it is open, and the pack takes two columns: at the left its name over picks left and *Skip*, and under them the reading plate, which runs to the foot of the hand and holds every reading whole with no inner scroll; at the right the options stand over the dealt hand. A pack of six there (a Jumbo or Mega Tarot Pack) scrolls its row sideways, as the compact layout's packs of six do: one card is a swipe away at 844 × 390, three at 667 × 375, and all six fit at 932 × 430, while a Mega Ghost Pack's four fit but at 667 × 375, where one is a swipe away (final pass, part 3: the plate stood at the hand's left as tall as a card and cut 22 of the 36 readings by up to 81 px). A Planet Pack keeps the racks: its cards fit beside them, so the Jokers and consumables stay in reach while it is open.
- **Night Market** (four items to a row): on the table layout the Shop's two rows share one grid of four columns, and each item's text column narrows, never its art; on the narrow 3 px table its shelves hold two items a row, as every Shop's do there. On a phone held upright and on a compact window 870 px tall or more a row holds four items, below 600 px wide each as wide as its card (the taste of its effect is a tap away, on its sheet); on a landscape phone and in the one-row Shop of a shorter compact window all seven stand in one row (the bullets above).
- **Booster Packs on a phone held upright** (below 600 px wide): a pack of four cards or fewer (every Normal pack, and every Joker and Ghost Pack) fits one row edge to edge with no sideways scroll; a pack of six (a Jumbo or Mega Card, Tarot or Planet Pack) scrolls sideways.
- **The reading plate beside a Tarot or Ghost Pack's dealt hand** keeps one height that holds the longest reading whole (its effect, a note and the status), so it never scrolls and the cards never move while the options are read. On the table layout it is 84 art pixels tall and may stand taller than the hand (70 art pixels wide and 100 tall on the narrow 3 px table, where the deck steps aside); at 2 px (a window under 870 px tall) it is 120 art pixels wide and 104 tall, since the copy does not grow with the pixel size. Over the hand in the compact layout it is 62 art pixels tall below 600 px wide and 52 from 600 px, a compact window held upright 760 px tall or less included (the short upright phone's is 66). On a landscape phone and a short window held wide it fills the pack's left column down to the foot of the hand (the landscape phone bullet). (Final pass, parts 2 and 3: the wide window 760 px tall or less kept 44 art pixels, which cut 4 of the 36 readings.)
- **The waiting Tags** strip over the Blind select steps aside on a landscape phone and a short upright phone (a short window held wide keeps it); the skip's toast tells the Tag, and the Overview lists it under Waiting.
- **The run setup and the end screens on a short window**: from 600 px wide on a window 700 px tall or less the run setup's plate is the window's height and its Deck and Stake scroll inside it, so the starting stats, *Back* and *Start run* stay in view; at 700 px tall or less, at any width, the end screens draw their rows in, and from 600 to 760 px wide their six counts stand three a row again, so *Game Over* and *You win!* fit a window from 600 px wide and 600 px tall whole (a landscape phone and 720 × 450 still scroll them, as before part 4) (final pass, part 4, P1: the setup scrolled the page by 17 to 117 px and put *Start run* up to 54 px below the fold).
- **Toasts** stay 2.8 s unless they say otherwise (an unlock's 3.6), and taps pass through them. On the title, setup, Records, the Collection and the end screens they sit at the top, at every width (changed 2026-11-25 (final pass, part 4): on a compact end screen from 761 px wide an unlock's toast lay over *Endless mode* and *Return to title*). In a run they sit over the field just under the racks, never over the Jokers, on the table layout and on a short window held wide (its bullet); elsewhere in the compact layout they sit 30 art pixels over the foot of the screen, and over an open pack 118 art pixels down, under the racks (on a phone held upright a Planet Pack's taller bar pushes the racks down to there: at 390 × 844 the toast lies on them, as final agent B measured).
- **A fanned hand** (the next card covers the Seal's spot: a phone's eight cards, or a long hand on a wide window): every covered card wears its Seal badge as a tab over the top edge of the strip that shows (at x 10 art pixels, clear of the index and the pips), and its picture is the face without the Seal, so the Seal shows whole and once. The last card, and every hand that is not fanned, keeps the art's spot (ARCH.md §4).
  - On a strip narrower than 19 art pixels (15 on the smallest landscape phone) the tab moves left to end at the strip's edge, and once it reaches the index's columns (x 3 to 7) its foot sits 3 art pixels below the card's top edge instead of 5, so it stays whole and never covers the rank (final pass, part 3: the next card hid 8 × 16 px of every tab at 667 × 375).
  - A chosen covered card rises clear of the next one, so it wears its Seal on its strip at the art's own height (4 art pixels over its top edge), below the Move pair (final pass, part 3: the pair hid up to 71 % of a chosen card's tab at 360 × 640).
  - Each covered card's strip is one whole tap target: 44 px at 390 × 844, 42 at 375 × 667, 40 at 360 × 640 and 30 on the smallest landscape phone (667 × 375), the narrowest anywhere, and WCAG 2.5.8's 24 px holds in all of them; 44 px at 667 × 375 would need about 100 px more hand than that width has, and the status column, the button column and the stage row over the hand have none to give (final pass, part 3; the strips as final agent B measured them in part 4).
- **Crossing a breakpoint** (a window resized or snapped, a phone turned: the layout or the pixel size changes) draws again only what is drawn for one pixel size. The table draws its column and racks again, and the Shop and an open pack are drawn anew with keyboard focus kept on the same control; a redraw asked for while something runs waits for it to end. A menu or end screen is never mounted anew, so an open dialog stays open with its focus and Game Over neither sounds nor announces again: its lettering and its pool of light are drawn again. Every other name plate, on the page or in an open dialog (the Collection's tiles, How to play's cards), is set again in place for the new pixel size, and a sheet by its item is placed again (final pass, parts 2 and 3: a plate chosen at 3 px was cut mid-letter at 2). After any resize, one that crosses no breakpoint included (a window narrowed inside one layout, or turned between the compact ones), the column's figures (the target, the Blind score and money) are fitted to their panels again, never while a payout runs or input is held (final pass, part 4, final agent C: the cash-out's Blind score kept its XL face and ran 3 px out of its panel at 600 × 650).
- It must work down to 360 × 640 with no horizontal page scroll, tap targets ≥ 44 px (the fanned hand's strips aside, above) and eight cards readable. Text never overflows its container at any width.

### 6.8 Accessibility
- Suits are told apart by shape (their pixel pips) as well as colour.
- Card buttons get an `aria-label` such as "Queen of Hearts, Kindled, Sheen, Encore Seal, selected". A Joker reads like "Jingle Jester, Sheen, common Joker".
- A polite `aria-live` region announces results ("Flush, 38 × 4 … 452. Score 1,204 of 2,550.") and errors.
  - A toast is said there too, once, unless a fuller line says the same thing. Once the keys or taps that choose cards settle, it says the hand the choice makes ("Eight of Hearts and Eight of Clubs selected. Pair, level 1: 12 Chips times 2 Mult."; final pass, part 2).
  - An unlock is said as a sentence of its own when it comes ("Unlocked: <name>."). Once the run has ended its toast is quiet, and the end screen says the run's unlocks once, after the result (changed 2026-11-25 (final pass, part 3): a win said each unlock twice, the first time ahead of the hand's score and *You win!*).
- Contrast: text ≥ 4.5:1, large numerals ≥ 3:1.
- Reduced motion is honoured as described in §6.3.

### 6.9 Audio (`src/audio.js` → `TW.Audio`)
- `TW.Audio.init()` creates the AudioContext lazily on the first user gesture. It never throws, even without Web Audio.
- `TW.Audio.setVolume(v)` and `TW.Audio.setMusicVolume(v)` take 0..1. `TW.Audio.setMuted(bool)` mutes everything.
- `TW.Audio.play(name, opts)` takes these names: `select, deselect, deal, slide, chips, mult, xmult, money, pop, bell, tickets, discard, whoosh, buy, sell, error, lose, win, button, again` (a retrigger), `stamp` (a Seal fires), `shine` (an Edition fires) and `spooky` (a Spectral card is used). `opts.step` (0..n) raises the pitch through a scoring sequence.
- `TW.Audio.music(on)` starts or stops an original generated loop that fits the chosen look, at the music volume.
- Everything is synthesised; there are no audio files. Nothing plays before a user gesture, and the mix stays below clipping.

### 6.10 Art (`src/art/*.js` → `TW.Art`)
The art contract is ARCH.md §4: pixel sprites drawn from grids and masks into bitmaps (`TW.Art.define`, `has`, `ids`, `bitmap`, `url`, `card`), one sprite per content id (`joker:{id}`, `tarot:{id}`, `planet:{id}`, `spectral:{id}`, `voucher:{id}`, `pack:{id}`, `tag:{id}`, `boss:{id}`, `stake:{id}`, `back:{deckId}`, `card:…`). Every id that `src/content.js` names must have a sprite (`tests/art.test.mjs`). Everything except `TW.Art.url` runs in Node with no DOM.

---

## 7. Tests
- `node --test "tests/*.test.mjs"` runs everything. Run it from the project root; `node --test tests/` fails on Node 24.
- `tests/engine.test.mjs` is the engine suite.
  - It uses `node:test` and `node:assert/strict`, and loads `src/content.js` and `src/engine.js` into one `vm` context. A second context adds test-only Jokers before the engine loads, to cover Legendary Jokers, Joker retriggers and the Joker vocabulary (the v2 rule word `freeFirstDiscard` among them); a third drops the Legendary rows, for Tall Tale's fallback.
  - Its tests for the 27 v2 charms use their 120-Joker ids (`oldId`) and keep every number the plan kept; Sleight of Hand follows the plan's new rule and says so (2026-11-23 (Jokers)).
  - It covers:
    - Content: the §0 checks; every content table by id with its numbers.
    - Hands and scoring: hand detection (Masked, The Wash-Out, Cameo Seals, The Blackout), the new per-level values, and the scoring order and trace (Enhancements, Editions on cards and Jokers, Seals, "Encore!" retriggers, Vintage growth).
    - Run content: every Joker, every Boss Blind, targets for every Ante, Blind and Stake, cash-out with Paid Seals and interest caps.
    - Shop and packs: Shop weights, Edition rolls and surcharges, prices with the Sale Tag and Season Pass, sell values, slot counting, Booster Pack kinds and sizes and their contents, immediate-use picks on a dealt hand.
    - Consumables and the rest: every Tag, Deck, Stake, Voucher, Tarot, Planet and Spectral card; discovery; stats.
    - The API: run shape, serialization and determinism, pure queries, error results instead of throws (a Shop item or pack option with no content row; `addJoker`, `serialize` and `applyRunToRecords` on a malformed run), and records v2 with the version 1 migration, the v2 Joker ids in version 2 records and saved runs included.
    - The final review's findings (added 2026-11-24): ten ids named after `Object.prototype` members, each against an unknown id in every place an id is read (§4, Ids); pile uids with no card under `deserialize`, The Fumble, Wickwisp and the random destroys; and the Endless base targets of Antes 9 to 1300 against the same formula in BigInt.
    - The final pass (added 2026-11-24): an Endless run's history entry (§4.2): the repro (a run won at Ante 8 and lost at Ante 9 in Endless mode kept "Ante 8" and the win's best hand; it failed before the fix), the entry following the run on every call, other runs' entries left alone, and records saved before entries kept a seed (they load unchanged, and the newest seedless win takes the Endless run's Ante); and the wording ruling's retrigger note, "Encore!".
    - The final pass, part 2 (added 2026-11-24): the documents follow what ships. §6.7 names every width and height a layout turns on (each `@media` query of `src/styles/*.css` and `TW.UI.MQ`) and the landscape phone, and the Jingle Jester's art line in `content/content-plan.json` and `CONTENT.md` describes the sprite `src/art/40-jokers-lit.js` draws (its `JINGLE_JESTER_STYLE` switch); both failed before the fix.
    - The final pass, part 3 (added 2026-11-25): `content/CHECKS.md` shows the validator's last result and every check of its `checks.json`, and names the project's folder of the check; every planted fault of `probe.mjs` names a check the validator runs, and `probe.json` records each as caught. Both failed before the fix (CHECKS.md said 91 of 91 and named a session scratchpad; the probe's engine fault expected a check name from before the engine reconcile).
- `tests/v3.test.mjs` is an independent black-box suite written from this spec and the design.
- `tests/vocab.test.mjs` (added 2026-11-23 (Jokers)) tests every Joker vocabulary word of §3.4 with test-only Joker rows in a separate `vm` context: a positive and a negative case each, the trace steps, state carried across hands and Blinds, the JSON round trip of the new state, and `jokerProblems` on all 120 `engine` rows of `content/content-plan.json`.
- `tests/jokers.test.mjs` (added 2026-11-23 (Jokers)) is the white-box suite for the 120 Jokers of the table: the table against the plan, `jokerProblems` on every row, and at least two tests per Joker (its effect when it applies, nothing when it does not), with exact traces for more than 30 of them; growth, end or reset and the JSON round trip of every scaling Joker; each event Joker's event and `jokerEvents` entry; money at the right moment; each rule's effect; and the three copiers copying a hand, card and event Joker, a copier, a Legendary Joker and nothing. A last test checks that coverage. It also checks that the §3.4 list in this spec matches the table (added 2026-11-23 (Jokers)).
- `tests/jokers-bb.test.mjs` and `tests/jokers-bb-interactions.test.mjs` (with `tests/jokers-bb-harness.mjs`) are a black-box suite for the 120 Jokers, written from the design, run against the 120-Joker table.
- `tests/art.test.mjs`, `tests/audio.test.mjs` and `tests/ui*.test.mjs` belong to the art and UI workflows.
- `tools/engine-fuzz/fuzz.mjs <root> [seed] [--seeds=1,2,3,4,5,6] [--games=400] [--steps=400] [--set=5] [--plan] [--jobs=N] [--box=50] [--hard=1000] [--corrupt=300] [--only=G] [--json]` is a random-play stress test with `Engine.debug` on (rewritten 2026-11-23 (Jokers)). The defaults play 6 seeds × 400 games in worker threads.
  - Every game: a random Deck and Stake, random Boss Blinds (any of the 15 at any Ante, in half the games, plus jumps to the Boss Blind), a random set of N distinct Jokers from all 120 (a copier in most games; Legendary Jokers through the `Engine.addJoker` test hook; random Editions, Phantom included), random Enhancements, Editions and Seals on deck cards, then up to 400 random actions in every phase, about 3% of them calls with bad arguments. `--plan` loads the plan's own rows instead of the table.
  - After every call: a failed action gives a §4.4 sentence and leaves the run unchanged; the checks agree with their actions (§4); queries change nothing; `scoreCards` equals what `playHand` scores; the step trace adds up (running values, `total = floor(Chips × Mult)`, the step money; no +0 or ×1 step); the card piles are exactly the deck; Joker and consumable slots, money (a whole number ≥ 0), uids (unique, below `nextUid`), ids, Stand-In targets, Old Flame copies and the Blind counters are sound; and the run round-trips through `serialize`/`deserialize` unchanged.
  - After every game the whole log is replayed in a second engine instance with other module state, which takes over the first instance's JSON halfway: every state and result must be identical (deterministic replay; the JSON holds the whole run).
  - Time box: an engine call over `--box` ms is re-run from its snapshot (after a short pause, so a stall of the whole machine passes) and fails when all 4 runs are over it; a watchdog stops a worker whose call runs past `--hard` ms and reports the hang.
  - Then `--corrupt` malformed runs per seed (random fields deleted or set to junk) with `Engine.debug` off: no function may throw.
- `tools/engine-fuzz/perf.mjs <root> [--hands=1000] [--budget=2]` times `Engine.scoreCards` on 1000 five-card hands (three in four score all 5 cards) with 5 Jokers: Madame Echo, The Puppet Master (copying Madame Echo and Bookends), Bookends, Stand-In (copying Madame Echo) and Old Flame (as The Candle King), with Editions, Encore Seals and random Enhancements (added 2026-11-23 (Jokers)). The best round's mean must stay under the budget (2 ms). A second rack times wild Jacks (Jack of All Trades, Fan Dancer, Merry-Go-Round): `Engine.preview` and `Engine.scoreCards` on 5, 4 and 3 selected Jacks, each under the same budget (added 2026-11-23 (Jokers, engine fix)).
- `tools/engine-fuzz/spec-jokers.mjs <root> [--check]` writes the §3.4 list of the 120 Jokers from `src/content.js`; `tests/jokers.test.mjs` checks it (added 2026-11-23 (Jokers)).
- `tools/engine-fuzz/vocab-check.mjs <root>` checks that the engine accepts every `engine` row of the plan and knows every declared need. `tools/engine-fuzz/gen-jokers.mjs content/content-plan.json src/content.js [--check]` writes the JOKERS table from the plan (or, with `--check`, checks that it still matches; added 2026-11-23 (Jokers)).
- The content check, in `tools/checks/content-check/` (kept on the build PC, outside the repo; added here 2026-11-24 (final pass)): `node build.mjs <root>` writes `content/content-plan.json` from the three source designs (it reproduces the file exactly), `node validate.mjs <root>` runs the 94 checks on the plan, `src/content.js` and the engine, and `node md.mjs <root>` writes `CONTENT.md` (and `content/CHECKS.md`; a second run writes the same bytes). `node probe.mjs <root>` plants 17 faults one at a time in a copy of the plan and checks that the validator's named check fails on each; every validator run it makes rewrites `checks.json`, so it goes before `validate.mjs` (final pass, part 3: its engine fault still expected the check's name from before the engine reconcile, so a re-run counted it missed). The final pass added three checks: every item name and text, UI glossary row, term, rules row and label keeps to the wording ruling (the phrases it checks for stay with the check); `src/content.js`'s names and texts are the plan's, by id; and no string in `src/content.js` is one of those phrases.
- A browser smoke test (`tools/cdp.mjs run`) comes back with the UI rewrite. It loads the built file with `?test=1&seed=SMOKE123`, plays an Ante through the real UI including the Shop and a pack, and checks for zero console errors.
