// End-to-end check of the table (a tools/cdp.mjs scenario). It plays through the real UI with real clicks:
//   1. a seeded run: New run, Start run (setup), Play the Small Blind, play the best hand until the Blind is beaten
//      (discarding to dig for a better hand when the best is weak), Collect $N, reach the Shop;
//   2. a second seeded run lost on purpose (one low card per hand) to reach Game Over.
// cdp.mjs fails the run on any console error or exception, so "zero console errors" is part of the check.
// That the cash-out never shows the cash-out label of the originality list is checked against that list
// (tests/local/originality.json, local-only): without it that one check is skipped and the result says so.
//
// Usage (serve the project root first: node tools/serve.mjs . 5180):
//   node tools/cdp.mjs run "http://localhost:5180/?seed=WICKTEST" tests/e2e/table.mjs
//   node tools/cdp.mjs run "http://localhost:5180/?test=1&seed=WICKTEST" tests/e2e/table.mjs
//   node tools/cdp.mjs run "http://localhost:5180/?seed=WICKTEST" tests/e2e/table.mjs 390x844 --mobile
//   SHOTS=1 node tools/cdp.mjs run "http://localhost:5180/?seed=WICKTEST" tests/e2e/table.mjs
//     (also writes shots/ui/table-*.png, or table-phone-*.png at phone width; the shot run adds three
//      Jokers and a Planet card through the engine's test hooks so the table looks like a run in progress)
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { ORIGINALITY, skipOriginality } from '../local-data.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = resolve(HERE, '../../shots/ui');
const WIN_SEEDS = ['WICKTEST', 'SEEDA', 'SEEDC', 'TABLE1', 'EMBERLIT', 'SEEDB'];

export default async function table(page, { url }) {
  const SHOTS = process.env.SHOTS === '1';
  const log = [];
  const skipped = [];
  const cashOutSkipped = skipOriginality(skipped, 'the cash-out never shows the label of the originality list');
  const fail = (msg, extra) => { throw new Error(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`); };
  const state = async () => JSON.parse(await page.eval('JSON.stringify(window.__wick ? window.__wick.state() : null)'));
  const until = async (what, test, ms = 20000) => {
    const end = Date.now() + ms;
    let s = null;
    while (Date.now() < end) { s = await state(); if (s && test(s)) return s; await page.sleep(80); }
    fail(`timed out waiting for ${what}`, s);
  };
  const screen = (name, ms) => until(`screen ${name}`, (s) => s.screen === name && !s.busy, ms);
  const idle = (ms) => until('the table to settle', (s) => !s.busy, ms);
  // the screen has caught up with the run's phase (the payout hands over to the cash-out a moment after it settles)
  const caughtUp = (x) => !x.busy && ((x.phase === 'play' && x.screen === 'play' && x.hand.length > 0) || (x.phase !== 'play' && x.screen !== 'play'));
  const test = /[?&]test=1/.test(url);
  const settle = (ms) => page.sleep(test ? 60 : ms);
  const phone = (await page.eval('TW.UI.MQ.phone.matches'));
  const shot = async (name) => {
    if (!SHOTS) return;
    mkdirSync(SHOT_DIR, { recursive: true });
    await page.screenshot(resolve(SHOT_DIR, `table-${phone ? 'phone-' : ''}${name}.png`));
    log.push(`shot ${name}`);
  };
  const withSeed = (seed) => url.replace(/([?&])seed=[^&]*/, `$1seed=${seed}`) + (/[?&]seed=/.test(url) ? '' : `${url.includes('?') ? '&' : '?'}seed=${seed}`);
  /** New run opens the run setup (Deck, Stake, seed): start it as it comes (?seed= still seeds the run). */
  async function startRun() {
    await screen('setup');
    await settle(700); // the setup plate rises
    await page.click('[data-action="start-run"]');
  }
  /** Click a hand card on its visible strip (on a phone the hand overlaps). */
  async function clickCard(uid) {
    const p = await page.eval(`(() => {
      const n = document.querySelector('#hand .card[data-uid="${uid}"]');
      if (!n) return null;
      n.scrollIntoView({ block: 'nearest' });
      const r = n.getBoundingClientRect(), next = n.nextElementSibling ? n.nextElementSibling.getBoundingClientRect() : null;
      const right = next ? Math.min(r.right, next.left) : r.right;
      return { x: Math.round((r.left + right) / 2), y: Math.round(r.top + Math.min(40, r.height / 3)) };
    })()`);
    if (!p) fail(`no card ${uid} in the hand`);
    await page.mouse(p.x, p.y);
  }
  /** The best legal hand by base Chips x Mult, plus the cards worth discarding when it is weak. */
  const plan = () => page.eval(`(() => {
    const run = __wick.run(), E = TW.Engine, hand = run.blind.hand.slice();
    const combos = (arr, k, s = 0, cur = [], out = []) => { if (cur.length === k) { out.push(cur.slice()); return out; } for (let i = s; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, out); cur.pop(); } return out; };
    let best = null;
    for (let k = 1; k <= 5; k++) for (const c of combos(hand, k)) {
      if (!E.canPlay(run, c).ok) continue;
      const pv = E.preview(run, c); if (!pv) continue;
      const v = pv.chips * pv.mult;
      if (!best || v > best.v) best = { v, c, name: pv.name, handId: pv.handId, scoring: pv.scoringUids };
    }
    const b = run.blind;
    const weak = best && ['high', 'pair'].includes(best.handId) && b.discardsLeft > 0 && b.handsLeft > 1 && b.score + best.v * 1.0 < b.target;
    const rank = (u) => run.cards.find((x) => x.uid === u).rank;
    const toss = weak ? hand.filter((u) => !best.scoring.includes(u)).sort((a, z) => rank(a) - rank(z)).slice(0, 5) : [];
    return { best, toss, handsLeft: b.handsLeft, score: b.score, target: b.target };
  })()`);

  // ------------------------------------------------------------ 1. win the Small Blind and reach the Shop
  let won = false;
  for (const seed of WIN_SEEDS) {
    await page.goto(withSeed(seed), { wait: 300 });
    await until('the title', (s) => s.screen === 'title');
    await settle(1200); // the title's menu rises into place first: a click aims where the button rests
    await page.click('[data-action="new-run"]');
    await startRun();
    await screen('blind-select');
    await settle(900); // the Blinds spring in; click once they rest
    if (SHOTS) {
      await page.eval(`(() => {
        const run = __wick.run(), E = TW.Engine, J = TW.Content.JOKERS;
        const drawn = J.filter((j) => TW.Art && TW.Art.has && TW.Art.has('joker:' + j.id));
        const pool = drawn.length >= 3 ? drawn : J;
        const want = [pool.find((j) => (j.effects || []).some((e) => e.on === 'hand' && e.chips && !e.when)), pool.find((j) => (j.effects || []).some((e) => e.on === 'held')), pool.find((j) => (j.effects || []).some((e) => e.on === 'hand' && e.mult && !e.when))];
        const ids = [];
        for (const j of want.concat(pool)) { if (j && !ids.includes(j.id)) ids.push(j.id); if (ids.length === 3) break; }
        ids.forEach((id) => E.addJoker(run, id, 0, null));
        const P = TW.Content.PLANETS.find((p) => TW.Art && TW.Art.has && TW.Art.has('planet:' + p.id)) || TW.Content.PLANETS[1];
        run.consumables.push({ uid: 'k' + run.nextUid++, kind: 'planet', id: P.id });
        TW.UI.refresh();
        return ids;
      })()`).then((ids) => log.push({ staged: ids }));
      await settle(900);
      await shot('blind-select');
    }
    await page.click('[data-action="start-blind"]');
    await screen('play');
    await settle(1300);
    let s = await state();
    if (s.hand.length < 1) fail('no hand was dealt', s);
    let hands = 0;
    while (s.screen === 'play' && hands < 8) {
      const p = await plan();
      if (!p.best) fail('no playable hand', p);
      if (p.toss.length) {
        for (const u of p.toss) await clickCard(u);
        await settle(250);
        const sel = (await state()).selected;
        if (sel.length !== p.toss.length) fail('selection did not follow the clicks', { sel, toss: p.toss });
        await page.click('[data-action="discard"]');
        await until('the discard to settle', caughtUp);
        await settle(700);
        log.push({ seed, discarded: p.toss.length });
        s = await state();
        continue;
      }
      for (const u of p.best.c) await clickCard(u);
      await settle(300);
      const sel = (await state()).selected;
      if (sel.length !== p.best.c.length) fail('selection did not follow the clicks', { sel, want: p.best.c });
      const label = await page.eval(`document.querySelector('#handName') ? document.querySelector('#handName').textContent : ''`);
      if (!label.startsWith(p.best.name)) fail('the hand panel does not show the preview', { label, want: p.best.name });
      if (SHOTS && hands === 0) { await page.mouse(4, 4); await settle(900); await shot('select'); }
      if (SHOTS && hands === 0) await page.eval(`window.__peak = __wick.hold('peak'); 1`);
      await page.click('[data-action="play-hand"]');
      hands++;
      if (SHOTS && hands === 1) {
        await page.eval('window.__peak');
        await page.sleep(40);
        await shot('payout');
        await page.eval('__wick.release(); 1');
      }
      s = await until('the payout to finish', caughtUp, 30000);
      await settle(400);
      s = await state();
      log.push({ seed, hand: hands, played: p.best.name, score: s.score, screen: s.screen });
    }
    if (s.screen === 'cashout') {
      won = true;
      const dlg = await page.eval(`(() => { const b = document.querySelector('.beaten [data-action="collect"]'); return b ? b.textContent.trim() : null; })()`);
      if (!dlg || !/^Collect \$\d+/.test(dlg)) fail('the cash-out has no "Collect $N" button', { dlg });
      if (!cashOutSkipped) {
        const [src, flags] = ORIGINALITY.patterns.cashOutText;
        if (await page.eval(`new RegExp(${JSON.stringify(src)}, ${JSON.stringify(flags)}).test(document.body.innerText)`)) fail('the cash-out shows the label of the originality list');
      }
      await settle(1500);
      await shot('cashout');
      const before = (await state()).money;
      await page.click('[data-action="collect"]');
      const shop = await screen('shop');
      await settle(600);
      if (shop.money <= before) fail('Collect did not add the money', { before, after: shop.money });
      if (!(await page.exists('[data-action="leave-shop"]'))) fail('the Shop has no Next Blind button');
      log.push({ seed, collected: shop.money - before, screen: shop.screen });
      break;
    }
    if (s.screen !== 'gameover') fail('the Blind ended on an unexpected screen', s);
    log.push({ seed, lost: true });
  }
  if (!won) fail('no seed beat the Small Blind', log);

  // ------------------------------------------------------------ 2. lose a run on purpose and reach Game Over
  await page.goto(withSeed('E2ELOSE'), { wait: 300 });
  await until('the title', (s) => s.screen === 'title');
  await settle(1200); // the title's menu rises into place first: a click aims where the button rests
  await page.click('[data-action="new-run"]');
  await startRun();
  await screen('blind-select');
  await settle(900); // the Blinds spring in; click once they rest
  await page.click('[data-action="start-blind"]');
  await screen('play');
  await settle(1000);
  let s = await state();
  let plays = 0;
  while (s.screen === 'play' && plays < 10) {
    const low = await page.eval(`(() => { const run = __wick.run(); const h = run.blind.hand.map((u) => run.cards.find((c) => c.uid === u)); h.sort((a, b) => a.rank - b.rank); return h[0].uid; })()`);
    await clickCard(low);
    await settle(200);
    await page.click('[data-action="play-hand"]');
    plays++;
    s = await until('the losing hand to finish', caughtUp, 30000);
    await settle(300);
    s = await state();
  }
  if (s.screen !== 'gameover') fail('the lost run did not reach Game Over', s);
  if (!(await page.exists('[data-action="new-run"]'))) fail('Game Over has no New run button');
  log.push({ lost: true, plays, screen: s.screen });
  if (skipped.length) log.push({ skipped });
  return log;
}
