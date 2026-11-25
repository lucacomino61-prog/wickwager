// Performance probe (a tools/cdp.mjs scenario): long tasks (the Long Tasks API, every main-thread task over 50 ms) and
// the layout and style work Chrome reports (CDP Performance.getMetrics) during the moments that matter: the first deal,
// a full payout with Jokers firing, the cash-out, the Shop's entrance and a pack opening. It fails when any long task
// lands inside the payout or the Shop's entrance (one bar for both), and reports everything else.
//
// It measures where players meet the game: at real speed, at the default game speed (Normal) and at the fastest a
// player can pick (Blazing, where the payout's steps come closest together), with the same bar for both. Given a
// test-mode URL (?test=1, as the e2e matrix runs every scenario) it drops test=1 and keeps the seed. Test mode is not
// measured: there every duration is 0, so the payout's whole timeline fires in one task by construction (about 45 to
// 50 ms of work at 1440 x 900), which no player ever meets; measured there the bar was a coin toss (3 of 12 runs saw
// one 50 or 51 ms task; final pass, part 3).
//
// The Shop's entrance (final pass, part 4, P6): measured five times a speed at 1440 x 900 it made a long task in 5 of
// 10 entrances on the build 6d8fe47a (61 to 78 ms). Its art was never the cause (every sprite is drawn ahead, in idle
// time, by then): Long Animation Frame entries put it in the frame that painted the new Shop, the column, the racks
// and the table's fading copy at once (script 15 to 40 ms, style, layout and paint 40 to 90 ms). The shelves are now
// built in a task of their own once that frame is out (20-shop.js), and the fading copy drops its cards' blended light
// (00-core.js ghostOf). P6's protocol on 2026-11-25 (RUNS=5 at Normal and Blazing, at 1440 x 900, 1024 x 768 and
// 390 x 844, each size on both builds in turn): the Shop's entrance made a long task in 2 of 30 entrances (49 and
// 62 ms, at 1440 x 900) where 6d8fe47a made them in 5 of 30 (55 to 127 ms, at 1440 x 900), while the payout, which
// part 4 did not touch, made them in 5 and 4 of 30; Long Animation Frame entries then saw one task over 50 ms in 16
// entrances at 1440 x 900 (51 ms: 6 ms of script, 35 of style and layout). So the Shop's entrance takes the payout's
// bar. Both bars measure the main thread of a headless Chrome without a GPU on the owner's PC, so a machine busy with
// other work shows long tasks the game did not make: on 2026-11-25 the build 6d8fe47a itself failed the payout's bar
// in 1 of 10, then 3 of 4 runs. Compare a failing run with the previous build on the same machine before reading it as
// the game's.
//
// Usage: node tools/cdp.mjs run "http://localhost:5184/?seed=PERF1" tests/e2e/perf.mjs [1440x900]
//   RUNS=3 repeats the measurement on fresh runs at each speed and reports each.
//   SPEEDS=2,4 the speed settings measured (Options' Game speed: 1 Relaxed, 2 Normal, 3 Fast, 4 Blazing).

import { writeFileSync } from 'node:fs';

export default async function perf(page, { url }) {
  const js = (e) => page.eval(e);
  const fail = (m, x) => { throw new Error(m + (x ? ' ' + JSON.stringify(x).slice(0, 1600) : '')); };
  const state = async () => JSON.parse(await js('JSON.stringify(__wick.state())'));
  const until = async (what, f, ms = 40000) => { const end = Date.now() + ms; let s; while (Date.now() < end) { s = await state(); if (f(s)) return s; await page.sleep(50); } fail('timed out: ' + what, s); };
  const runJs = (body) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${body} })()`);
  // real speed: the same page and seed without test mode
  const u = new URL(url);
  const given = u.searchParams.get('test') === '1';
  u.searchParams.delete('test');
  const real = u.toString();
  await page.send('Performance.enable', { timeDomain: 'timeTicks' });
  const metrics = async () => Object.fromEntries((await page.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const install = () => js(`(() => {
    window.__lt = [];
    if (!window.__ltObs) { window.__ltObs = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ start: Math.round(e.startTime), ms: Math.round(e.duration) }); }); window.__ltObs.observe({ type: 'longtask' }); }
    window.__mark = performance.now();
    return 1; })()`);
  const window_ = async (label, fn) => {
    await install();
    const m0 = await metrics();
    const t0 = await js('performance.now()');
    await fn();
    const t1 = await js('performance.now()');
    await page.sleep(120); // let the observer deliver
    const m1 = await metrics();
    const lt = await js(`window.__lt.filter((e) => e.start >= ${t0 - 5} && e.start <= ${t1 + 5})`);
    const d = (k) => Math.round(((m1[k] || 0) - (m0[k] || 0)) * 1000 * 10) / 10;
    return {
      label, ms: Math.round(t1 - t0), longTasks: lt.length, longest: lt.reduce((x, e) => Math.max(x, e.ms), 0), tasks: lt,
      layouts: (m1.LayoutCount || 0) - (m0.LayoutCount || 0), layoutMs: d('LayoutDuration'),
      styleRecalcs: (m1.RecalcStyleCount || 0) - (m0.RecalcStyleCount || 0), styleMs: d('RecalcStyleDuration'), scriptMs: d('ScriptDuration'),
    };
  };
  const out = { viewport: await js('innerWidth + "x" + innerHeight'), given: given ? 'test mode, measured at real speed instead' : 'real speed', url: real, runs: [] };
  const runs = Number(process.env.RUNS) || 1;
  const speeds = String(process.env.SPEEDS || '2,4').split(',').map(Number).filter((n) => n >= 1 && n <= 4);
  for (const speed of speeds) {
    for (let k = 0; k < runs; k++) {
      const r = { speed };
      await page.goto(real, { wait: 1200 });
      await until('the title', (s) => s.screen === 'title');
      if (await js('TW.UI.TEST')) fail('the probe must run at real speed', { url: real });
      await js(`(() => { TW.UI.setSetting('speed', ${speed}); return 1; })()`);
      if ((await js('TW.UI.settings().speed')) !== speed) fail(`the game speed setting ${speed} did not take`);
      await page.sleep(1500); // the title's flame catches; idle time follows
      await page.click('[data-action="new-run"]');
      await until('setup', (s) => s.screen === 'setup');
      await page.sleep(900);
      await page.click('[data-action="start-run"]');
      await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
      await page.sleep(1500);
      // a run in progress: three Jokers that fire on the hand (from the content table at run time)
      await runJs(`
        const pick = (f) => Cn.JOKERS.filter((j) => j.rarity !== 'legendary' && f(j)).map((j) => j.id);
        const want = [...new Set([].concat(pick((j) => (j.effects || []).some((e) => e.on === 'hand' && e.mult)).slice(0, 1), pick((j) => (j.effects || []).some((e) => e.on === 'card')).slice(0, 1), pick((j) => (j.effects || []).some((e) => e.on === 'hand' && e.chips)).slice(0, 1)))];
        want.slice(0, 3).forEach((id) => E.addJoker(run, id, 0, null));
        UI.saveRun(); UI.update(); return want;`);
      await page.sleep(1500);
      r.deal = await window_('first deal', async () => {
        await page.click('[data-action="start-blind"]');
        await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
        await page.sleep(1400);
      });
      await page.sleep(1500); // idle: the payout's sprites are made now
      // the best five-card hand by the engine's own scoring
      const best = await runJs(`
        const b = run.blind, hand = b.hand.slice(), card = (u) => E.getCard(run, u);
        const combos = (arr, k, s = 0, cur = [], o = []) => { if (cur.length === k) { o.push(cur.slice()); return o; } for (let i = s; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, o); cur.pop(); } return o; };
        let best = null;
        for (const c of combos(hand, 5)) { const res = E.scoreCards(run, c.map(card), hand.filter((u) => !c.includes(u)).map(card)); if (res && (!best || res.steps.length > best.n)) best = { c, n: res.steps.length, total: res.total }; }
        return best;`);
      for (const uid of best.c) { const i = await js(`__wick.run().blind.hand.indexOf('${uid}') + 1`); await page.key(String(i)); await page.sleep(120); }
      await page.sleep(800);
      r.payout = await window_(`payout (${best.n} steps)`, async () => {
        await page.click('[data-action="play-hand"]');
        await until('the payout to end', (s) => !s.busy && (s.screen !== 'play' || s.hand.length > 0), 60000);
      });
      r.payout.steps = best.n;
      r.payout.total = best.total;
      const s = await state();
      if (s.screen === 'cashout') {
        r.cashout = await window_('cash-out', async () => { await page.sleep(2200); });
        r.shop = await window_('Shop entrance', async () => {
          await page.click('[data-action="collect"]');
          await until('the Shop', (x) => x.screen === 'shop' && !x.busy);
          await page.sleep(1400);
        });
        const i = await runJs(`const k = run.shop.items.findIndex((x) => x && x.slot === 'pack'); const row = Cn.PACKS.find((p) => p.kind === 'tarot' && p.size === 'normal'); Object.assign(run.shop.items[k], { kind: 'pack', id: row.id, price: row.price, size: row.size, sold: false }); run.money = Math.max(run.money, 20); UI.update(); return k;`);
        await page.sleep(800);
        r.pack = await window_('pack opening', async () => {
          await page.click(`[data-action="buy"][data-index="${i}"]`);
          await until('the pack', (x) => x.screen === 'pack' && !x.busy);
          await page.sleep(600);
        });
      }
      out.runs.push(r);
    }
  }
  // the browser profile is the scenario's own; still, leave the default speed behind
  await js(`(() => { TW.UI.setSetting('speed', 2); return 1; })()`);
  out.payoutLongTasks = out.runs.reduce((n, r) => n + r.payout.longTasks, 0);
  out.shopLongTasks = out.runs.reduce((n, r) => n + (r.shop ? r.shop.longTasks : 0), 0);
  out.bySpeed = Object.fromEntries(speeds.map((sp) => [sp, out.runs.filter((r) => r.speed === sp).map((r) => ({ steps: r.payout.steps, longTasks: r.payout.longTasks, longest: r.payout.longest, ms: r.payout.ms }))]));
  // one line a run, so a failure shows every run (the whole record is long)
  out.summary = out.runs.map((r) => `speed ${r.speed}: payout ${r.payout.longTasks} (${r.payout.longest} ms), Shop entrance ${r.shop ? `${r.shop.longTasks} (${r.shop.longest} ms)` : '-'}, pack ${r.pack ? `${r.pack.longTasks} (${r.pack.longest} ms)` : '-'}, deal ${r.deal.longTasks}`);
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
  if (out.payoutLongTasks || out.shopLongTasks) fail(`long tasks during ${[out.payoutLongTasks ? 'the payout' : '', out.shopLongTasks ? "the Shop's entrance" : ''].filter(Boolean).join(' and ')}`, out.summary);
  return out;
}
