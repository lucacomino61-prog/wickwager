# Wickwager

Wickwager is a pixel-art poker roguelike in one HTML file, set at a candlelit card table. You play poker hands from a 52-card deck against Blinds, scoring Chips × Mult to reach each Blind's target, three Blinds an Ante (a Small Blind, a Big Blind and a Boss Blind with a rule of its own), for eight Antes; Endless mode goes on after that. Between Blinds you spend your money in the Shop on Jokers (120 of them), consumable cards (Tarot, Planet and Spectral cards), Booster Packs and Vouchers, and you can skip a Blind for a Tag. Ten starting Decks and four Stakes change how a run plays.

Everything in it is made by code: every sprite is pixel art drawn from pixel grids and masks, and every sound and both music loops are synthesised with Web Audio. The built file loads nothing from the network and opens straight from disk.

## Build

You need Node.js (the project is built and tested with Node 24). There are no dependencies to install.

```sh
node tools/build.mjs            # writes index.html in the project root
node tools/build.mjs --strict   # for a release: fails if any part is missing
```

The build inlines `src/` into `index.html`, which is not tracked in git.

## Play locally

Build, then serve the folder and open the page:

```sh
node tools/build.mjs
node tools/serve.mjs . 5178
```

Open http://localhost:5178/index.html (the built file also opens straight from disk). `?test=1` turns off motion and sound and keeps its own saves; `?seed=ABC` starts new runs from a seed.

## Tests

Unit tests, from the project root:

```sh
node --test "tests/*.test.mjs"
```

Add `--test-concurrency=1` on a machine short of memory. On Node 24, `node --test tests/` does not work; pass the pattern as above.

The end-to-end checks in `tests/e2e/` are scenarios for `tools/cdp.mjs`, a small headless Chrome driver with no dependencies. It needs Google Chrome (set `CHROME_PATH` if Chrome is not where it looks). Build, serve the folder, then run a scenario at a window size:

```sh
node tools/cdp.mjs run "http://localhost:5178/?test=1" tests/e2e/playthrough.mjs
node tools/cdp.mjs run "http://localhost:5178/?test=1" tests/e2e/playthrough.mjs 390x844 --mobile
```

Each scenario's header says what it checks. A few checks read design data that stays on the author's PC; elsewhere they skip and say so.

## A tour of `src/`

The build puts the stylesheets of `src/styles/` (the embedded fonts, the tokens, the chrome, the room, the table, the Shop and the other screens) into the page shell, `src/shell.html`, and then the scripts in this order: `src/content.js` (`TW.Content`, every hand, Joker, consumable, Boss Blind, Voucher, Tag, pack, Deck and Stake with its name, text and numbers), `src/art/*.js` (`TW.Art`, the drawing kit and every sprite; `src/art/ART.md` explains how to add one), `src/engine.js` (`TW.Engine`, the pure, seeded rules engine, which runs in Node with no DOM and returns every scored hand as a step trace), `src/audio.js` (`TW.Audio`, the synthesiser for the sound effects and the music) and `src/ui/*.js` (`TW.UI`, the screens, the payout, input, saving and the test hooks). Each script is a plain IIFE that adds to `globalThis.TW`; there are no libraries. `SPEC.md` holds the rules and the engine API, `ARCH.md` how the parts fit together, `DESIGN.md` the visual system and `PRODUCT.md` what the game is for.

## On phones

The next step is to ship Wickwager as an iPhone and Android app: the same single file in a native app shell, with the iPhone build made on a Mac from this repository. The game already plays by touch on a phone held either way, down to 360 × 640, and saves a run after every action.

## Copyright

The three embedded fonts are third-party works under the SIL Open Font License 1.1; their copyright and licence lines are in `src/styles/00-fonts.css` and in the game's Credits, and the licence text is in `src/styles/OFL.txt`.

Copyright (c) 2026 lucacomino61-prog. All rights reserved. No license is granted to copy, modify or distribute this work.
