// Unit tests for what final agent C of the final pass, part 4 (2026-11-25) fixed after the final shots, as text: the
// stylesheets and src/ui/10-table.js. The browser half is tests/e2e/part4.mjs section 4.
//   1. the one-row Shop (a compact window under 870 px tall from 600 px wide, not a landscape phone): a card item beside
//      one that showed why it can't be bought took the extra height above its Buy, which dropped 39 px below the row,
//      and "Your consumable slots are full." read "Your consumabl…" in two lines;
//   2. the longest Boss rule lost its last word in three lines on a short upright window 600 to 639 px wide;
//   3. on a short window held wide (601 to 760 px tall) Overview and Options stood under the money row, not at the
//      column's foot as on the table, and a toast lay over the hand, the Shop's Buy row and a pack's head and cards;
//   4. the column's figures kept the face fitted to the window they were drawn at after a resize that crosses no
//      breakpoint (the cash-out's Blind score ran 3 px out of its panel at 600 x 650 after 700 x 700).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
/** One @media block's body (the first whose query is exactly q, nested or not), or null. */
function mediaBlock(css, q) {
  const at = css.indexOf(`@media ${q} {`);
  if (at < 0) return null;
  let i = css.indexOf('{', at) + 1, depth = 1;
  const start = i;
  for (; i < css.length && depth; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
  return css.slice(start, i - 1);
}
const BAND = '(max-width: 1023px) and (min-height: 601px) and (max-height: 760px) and (orientation: landscape)';
const LAND = '(max-width: 1023px) and (max-height: 760px) and (orientation: landscape)';
const n = (s, re) => { const m = re.exec(s); assert.ok(m, `no match for ${re}`); return Number(m[1]); };

test('the one-row Shop: the items of a shelf share its rows, so every Buy stands at one height; a reason keeps three lines', () => {
  const shop = read('src/styles/50-shop.css');
  const outer = mediaBlock(shop, '(min-width: 600px) and (max-width: 1023px) and (max-height: 869px)');
  const inner = outer && mediaBlock(outer, 'not all and (max-height: 600px) and (orientation: landscape)');
  assert.ok(inner, 'the one-row Shop\'s block');
  assert.match(inner, /\.shelf, \.shop\.dense \.shelf \{ display: grid; grid-auto-flow: column; grid-template-rows: auto auto auto;/, 'a shelf is one row of items over three shared rows');
  assert.match(inner, /\.si, \.shop\.dense \.si \{ grid-template-columns: calc\(var\(--card-w\) \+ 4 \* var\(--px\)\); grid-row: span 3; grid-template-rows: auto minmax\(0, 1fr\) auto; grid-template-rows: subgrid; grid-template-areas: "art" "info" "buy";/,
    'each item spans them as a subgrid (the old rows kept as the fallback where subgrid is unknown)');
  assert.match(inner, /\.si-buy \{ align-content: start; \}/, 'Buy stands at the top of the shared row, the reason under it');
  assert.match(inner, /\.si-why \{ display: -webkit-box; text-align: center; -webkit-line-clamp: 3; line-clamp: 3; \}/, 'the reason keeps three lines');
  // the sold slot keeps its own one row (no subgrid), still spanning the shelf's rows
  assert.match(inner, /\.si\.is-sold, \.shop\.dense \.si\.is-sold \{ grid-template-areas: "art"; grid-template-rows: auto; \}/);
  // the table layout's Shop and the landscape phone's keep two lines: their shelves have no row to spare
  assert.match(shop, /^\.si-why \{[^}]*-webkit-line-clamp: 2; line-clamp: 2;/m);
  assert.ok(!/line-clamp: 3/.test(mediaBlock(shop, LAND)), 'the landscape phone\'s Shop is unchanged');
});

test('a short upright window from 600 px wide gives a Boss rule four lines on its Blind', () => {
  const short = mediaBlock(read('src/styles/40-table.css'), '(min-width: 600px) and (max-width: 1023px) and (max-height: 760px) and (orientation: portrait)');
  assert.ok(short, 'the short upright window\'s block');
  assert.match(short, /\.blind-card \.bc-rule \.copy \{ display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; line-clamp: 4; overflow: hidden; \}/);
  // under 620 px tall there is no room for a fourth line (the page scrolled by 18 px at 600 x 600): three, and the tip
  assert.equal(mediaBlock(short, '(max-height: 619px)').trim(), '.blind-card .bc-rule .copy { -webkit-line-clamp: 3; line-clamp: 3; }');
  assert.ok(short.indexOf('@media (max-height: 619px)') > short.indexOf('-webkit-line-clamp: 4'), 'after the four-line rule, so it wins there');
});

test('a short window held wide stands Overview and Options at the column\'s foot, as on the table', () => {
  const table = read('src/styles/40-table.css'), band = mediaBlock(table, BAND);
  assert.ok(band, 'the band\'s block');
  const not = 'body:not\\(:is\\(\\[data-screen="shop"\\], \\[data-screen="pack"\\]\\)\\) ';
  assert.match(band, new RegExp(`${not}\\.col \\{ grid-template-rows: repeat\\(5, auto\\) 1fr; \\}`), 'the sixth row takes the height left over');
  assert.match(band, new RegExp(`${not}\\.col > \\.r-btns \\{ grid-area: 6 / 1 / 7 / 13; display: flex; \\}`), 'Overview and Options in the sixth row');
  assert.match(table, /^\.col > \.r-btns \{ margin-top: auto; \}/m, 'and at its foot');
});

test('a toast on a short window held wide sits under the racks, centred over the field (as on the table), clear of a pack\'s head', () => {
  const chrome = read('src/styles/20-chrome.css'), table = read('src/styles/40-table.css'), shop = read('src/styles/50-shop.css');
  const band = mediaBlock(chrome, BAND);
  assert.ok(band, 'the band\'s toast block');
  const compact = chrome.indexOf('@media (max-width: 1023px) {\n  .toasts { top: auto;');
  assert.ok(compact > 0 && chrome.indexOf(`@media ${BAND}`) > compact, 'it follows the compact rule (the foot, and 118 art px over a pack), so it wins in the band');
  assert.match(band, /body:is\(\[data-screen="blind-select"\], \[data-screen="play"\], \[data-screen="cashout"\], \[data-screen="shop"\], \[data-screen="pack"\]\) \.toasts \{\s*top: calc\(84 \* var\(--px\)\); bottom: auto; left: calc\(50% \+ 58 \* var\(--px\)\);/);
  // the offsets are the field's centre: the table's side padding, the status column and the gap, against the window's
  const land = mediaBlock(table, LAND);
  const pad = n(land, /padding: calc\(4 \* var\(--px\)\) max\(calc\((\d+) \* var\(--px\)\)/), col = n(land, /\.table \{ grid-template-columns: calc\((\d+) \* var\(--px\)\)/), gap = n(land, /minmax\(0, 1fr\); grid-template-rows: minmax\(0, 1fr\); gap: calc\((\d+) \* var\(--px\)\)/);
  const narrow = n(mediaBlock(table.slice(table.indexOf(`@media ${LAND} {`) + 10), LAND), /\.table \{ grid-template-columns: calc\((\d+) \* var\(--px\)\)/);
  const centre = (c) => pad + c + gap + 0 - (pad * 2 + c + gap) / 2; // the field's centre minus the window's, in art px
  assert.equal(centre(col), n(band, /\.toasts \{\s*top: calc\(84 \* var\(--px\)\); bottom: auto; left: calc\(50% \+ (\d+) \* var\(--px\)\)/), 'centred over the table\'s field');
  assert.equal(centre(narrow), n(band, /body:is\(\[data-screen="shop"\], \[data-screen="pack"\]\) \.toasts \{ left: calc\(50% \+ (\d+) \* var\(--px\)\); \}/), 'and over the Shop\'s and a pack\'s, beside the narrow column');
  // the racks' foot is the table's top padding and a rack's height, 4 + 76 art px (160 px; tests/e2e/part4.mjs section 4
  // measures the toast under it)
  assert.equal(n(land, /\.table \{[^}]*padding: calc\((\d+) \* var\(--px\)\)/), 4, 'the table\'s top padding');
  assert.match(band, /body\[data-screen="pack"\]:not\(:has\(\.pack-view\.has-hand\)\) \.toasts \{ top: calc\(80 \* var\(--px\)\); \}/, 'flush under the racks over a pack\'s head');
  // beside a dealt hand: centred over the options' column, right of the head's column (96 art px and a 5 px gap)
  const hand = mediaBlock(shop, LAND);
  const headCol = n(hand, /\.pack-view\.has-hand \{ grid-template-columns: calc\((\d+) \* var\(--px\)\)/), colGap = n(hand, /\.pack-view\.has-hand \{[^}]*column-gap: calc\((\d+) \* var\(--px\)\)/);
  const opts = Math.floor(pad + narrow + gap + headCol + colGap - (pad * 2 + narrow + gap + headCol + colGap) / 2);
  assert.equal(opts, n(band, /body\[data-screen="pack"\]:has\(\.pack-view\.has-hand\) \.toasts \{ left: calc\(50% \+ (\d+) \* var\(--px\)\);/), 'centred over the options\' column');
});

test('the column\'s figures are fitted to their panels again after any resize, never during a payout or while input is held', () => {
  const src = read('src/ui/10-table.js');
  const at = src.indexOf('const refitCol = () => {');
  assert.ok(at > 0, 'the refit');
  const body = src.slice(at, src.indexOf('};', at));
  assert.match(body, /UI\.isBusy\(\) \|\| T\.tl\) return;/, 'it waits out a payout and held input');
  assert.match(body, /setTarget\(info\.target, 'target-' \+ \(info\.bossId \|\| info\.kind\)\);/, 'the target, with the key renderCol uses');
  assert.match(body, /setNow\(setScore, run\.blind \? run\.blind\.score : 0\);/, 'the Blind score');
  assert.match(body, /setNow\(setMoney, run\.money\);/, 'the money');
  assert.match(src, /window\.addEventListener\('resize', \(\) => \{ clearTimeout\(rt\); rt = setTimeout\(\(\) => \{ layoutHand\(\); placeLight\(\); placeKit\(\); markClamped\(T\.root\); refitCol\(\); \}, 120\); \}\);/, 'on every resize, once it settles');
  // a box's width is kept per window size, so a refit measures the new one
  assert.match(read('src/ui/00-core.js'), /const k = `\$\{key \|\| node\.id \|\| node\.className\}@\$\{innerWidth\}x\$\{innerHeight\}`;/);
});
