// The final review shots (a tools/cdp.mjs scenario), at real speed so the light, glows and room are as a player sees
// them: title, run setup, Blind select, cards selected, the payout held at its peak, the cash-out, the Shop, an open
// Tarot Pack with its dealt hand, Overview, the deck view, the Collection, Options, Game Over and You win!.
// A run in progress is staged through the engine's test hooks (three Jokers that have art, a Planet card, Shop
// items), then every screen is reached through real clicks. Each still waits for the finite animations to end.
// Writes shots/ui/final-<name>.png, or final-phone-<name>.png at phone width.
//
// Usage: node tools/cdp.mjs run "http://localhost:5184/?seed=FINAL1" tests/e2e/final-shots.mjs [390x844 --mobile]
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
// SHOTS_DIR writes the stills somewhere else (a scratch folder while the look is being tuned)
const DIR = process.env.SHOTS_DIR ? resolve(process.env.SHOTS_DIR) : resolve(HERE, '../../shots/ui');

export default async function finalShots(page, { url }) {
  mkdirSync(DIR, { recursive: true });
  const js = (e) => page.eval(e);
  const fail = (m, x) => { throw new Error(m + (x ? ' ' + JSON.stringify(x).slice(0, 800) : '')); };
  const state = async () => JSON.parse(await js('JSON.stringify(__wick.state())'));
  const until = async (what, f, ms = 40000) => { const end = Date.now() + ms; let s; while (Date.now() < end) { s = await state(); if (f(s)) return s; await page.sleep(60); } fail('timed out: ' + what, s); };
  const runJs = (body) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${body} })()`);
  const phone = (await js('TW.UI.MQ.phone.matches'));
  const shots = [];
  const quiet = async (ms = 6000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const n = await js(`document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming && a.effect.getTiming().iterations !== Infinity).length`);
      if (!n) return;
      await page.sleep(100);
    }
  };
  const shot = async (name, o = {}) => {
    if (!o.keepPointer) await page.mouse(2, 2);
    await quiet();
    if (o.wait) await page.sleep(o.wait);
    // toasts are transient: a still waits for them to go
    const end = Date.now() + 5000;
    while (!o.toasts && Date.now() < end && (await js(`document.querySelectorAll('#toasts .toast').length`))) await page.sleep(100);
    const file = resolve(DIR, `final-${phone ? 'phone-' : ''}${name}.png`);
    await page.screenshot(file, { fullPage: !!o.full });
    if (o.full) { await js('scrollTo(0, 0)'); await page.sleep(500); }
    shots.push(file);
  };
  /** Click the first match that is laid out at this width (a control can exist twice: one for phones, one for desktop). */
  const clickVisible = async (sel) => {
    const ok = await js(`(() => { document.querySelectorAll('[data-shot]').forEach((n) => n.removeAttribute('data-shot')); const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((n) => n.offsetParent && n.getBoundingClientRect().width > 0); if (!b) return false; b.setAttribute('data-shot', '1'); return true; })()`);
    if (!ok) fail('nothing visible matches ' + sel);
    await page.click('[data-shot="1"]');
  };
  const clickCard = async (uid) => {
    const p = await js(`(() => { const n = document.querySelector('#hand .card[data-uid="${uid}"]'); if (!n) return null; const r = n.getBoundingClientRect(), next = n.nextElementSibling ? n.nextElementSibling.getBoundingClientRect() : null; const right = next && next.left > r.left ? Math.min(r.right, next.left) : r.right; return { x: Math.round((r.left + right) / 2), y: Math.round(r.top + Math.min(40, r.height / 3)) }; })()`);
    if (!p) fail('no card ' + uid);
    await page.mouse(p.x, p.y);
  };

  // ------------------------------------------------------------ title and setup
  await page.goto(url, { wait: 800 });
  await until('the title', (s) => s.screen === 'title');
  await js(`(() => { TW.UI.store.remove('run'); return 1; })()`);
  await page.reload({ wait: 800 });
  await until('the title', (s) => s.screen === 'title' && s.fonts === 'ready');
  await page.sleep(2600); // the flame catches and the letters light
  await shot('title');
  await page.click('[data-action="new-run"]');
  await until('setup', (s) => s.screen === 'setup');
  await page.sleep(900);
  await shot('setup');
  await page.click('[data-action="start-run"]');
  await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);

  // ------------------------------------------------------------ a run in progress
  const staged = await runJs(`
    const drawn = (p, rows) => rows.filter((r) => TW.Art && TW.Art.has && TW.Art.has(p + ':' + r.id));
    // the review asked for the Jingle Jester (the approved mockup's Joker, the plainest jester of the set) not to lead the stills
    const J = drawn('joker', Cn.JOKERS).filter((j) => j.rarity !== 'legendary' && j.id !== 'jinglejester');
    const pick = (f) => J.find((j) => f(j) && !run.jokers.some((x) => x.id === j.id));
    const want = [...new Set([pick((j) => (j.effects || []).some((e) => e.on === 'card')), pick((j) => (j.effects || []).some((e) => e.on === 'hand' && e.chips)), pick((j) => (j.effects || []).some((e) => e.on === 'hand' && e.mult))].filter(Boolean))];
    want.forEach((j, i) => E.addJoker(run, j.id, 0, i === 1 ? ((Cn.EDITIONS.find((x) => x.chips) || {}).id || null) : null));
    const P = drawn('planet', Cn.PLANETS)[2] || Cn.PLANETS[0];
    run.consumables.push({ uid: 'k' + run.nextUid++, kind: 'planet', id: P.id });
    run.money = 11;
    UI.saveRun(); UI.update();
    return run.jokers.map((j) => j.id);`);
  await page.sleep(1500);
  await shot('blind-select');

  // ------------------------------------------------------------ the table: a selection, the payout's peak, the cash-out
  await page.click('[data-action="start-blind"]');
  await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
  await page.sleep(1800);
  const best = await runJs(`
    const b = run.blind, hand = b.hand.slice(), card = (u) => E.getCard(run, u);
    const combos = (arr, k, s = 0, cur = [], o = []) => { if (cur.length === k) { o.push(cur.slice()); return o; } for (let i = s; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, o); cur.pop(); } return o; };
    let best = null;
    for (let k = 2; k <= 5; k++) for (const c of combos(hand, k)) { if (!E.canPlay(run, c).ok) continue; const r = E.scoreCards(run, c.map(card), hand.filter((u) => !c.includes(u)).map(card)); if (r && (!best || r.total > best.v)) best = { v: r.total, c }; }
    b.target = Math.max(10, Math.floor(best.v * 0.8));
    UI.update();
    return best;`);
  await page.sleep(400);
  for (const u of best.c) { await clickCard(u); await page.sleep(160); }
  await page.sleep(400);
  await shot('select');
  await js(`window.__peak = __wick.hold('peak'); 1`);
  await page.click('[data-action="play-hand"]');
  await js('window.__peak');
  await page.sleep(60);
  await page.screenshot(resolve(DIR, `final-${phone ? 'phone-' : ''}payout.png`));
  shots.push(resolve(DIR, `final-${phone ? 'phone-' : ''}payout.png`));
  await js('__wick.release(); 1');
  await until('the cash-out', (s) => s.screen === 'cashout' && !s.busy, 40000);
  await page.sleep(2200);
  await shot('cashout', { keepPointer: true });

  // ------------------------------------------------------------ the Shop and a Tarot Pack
  await page.click('[data-action="collect"]');
  await until('the Shop', (s) => s.screen === 'shop' && !s.busy);
  await runJs(`
    const drawn = (p, rows) => rows.filter((r) => TW.Art && TW.Art.has && TW.Art.has(p + ':' + r.id));
    const J = drawn('joker', Cn.JOKERS).filter((j) => j.rarity !== 'legendary' && j.id !== 'jinglejester' && !run.jokers.some((x) => x.id === j.id));
    const cards = run.shop.items.filter((x) => x && x.slot === 'card');
    const jk = J.find((j) => j.rarity === 'uncommon') || J[0];
    Object.assign(cards[0], { kind: 'joker', id: jk.id, price: jk.cost, edition: null, sold: false });
    const T = drawn('tarot', Cn.TAROTS)[3] || Cn.TAROTS[0];
    if (cards[1]) Object.assign(cards[1], { kind: 'tarot', id: T.id, price: 3, edition: null, sold: false });
    const packs = run.shop.items.filter((x) => x && x.slot === 'pack');
    const rowT = Cn.PACKS.find((p) => p.kind === 'tarot' && p.size === 'normal'), rowJ = Cn.PACKS.find((p) => p.kind === 'joker' && p.size === 'jumbo');
    if (packs[0]) Object.assign(packs[0], { kind: 'pack', id: rowT.id, price: rowT.price, size: rowT.size, sold: false });
    if (packs[1]) Object.assign(packs[1], { kind: 'pack', id: rowJ.id, price: rowJ.price, size: rowJ.size, sold: false });
    run.money = Math.max(run.money, 24);
    UI.update(); return 1;`);
  await page.sleep(1500);
  await shot('shop', { full: phone });
  const pk = await runJs(`return run.shop.items.findIndex((x) => x && x.kind === 'pack' && x.id === Cn.PACKS.find((p) => p.kind === 'tarot' && p.size === 'normal').id);`);
  await js(`(() => { const b = document.querySelector('[data-action="buy"][data-index="${pk}"]'); if (b) b.scrollIntoView({ block: 'center' }); return 1; })()`);
  await page.sleep(400);
  await page.click(`[data-action="buy"][data-index="${pk}"]`);
  await until('the pack', (s) => s.screen === 'pack' && !s.busy);
  await page.sleep(900);
  const sel = await runJs(`const p = run.pack; const card = (u) => E.getCard(run, u); return p.hand.slice().sort((a, z) => card(a).rank - card(z).rank).slice(0, 2);`);
  for (const u of sel) { await clickCard(u); await page.sleep(150); }
  await page.sleep(500);
  await shot('pack', { full: phone });
  await page.click('[data-action="pack-skip"]');
  await until('back in the Shop', (s) => s.screen === 'shop' && !s.busy);
  await page.sleep(800);
  await page.click('[data-action="leave-shop"]');
  await until('the next Blind select', (s) => s.screen === 'blind-select' && !s.busy);
  await page.sleep(1200);

  // ------------------------------------------------------------ overlays: Overview, the deck, Options; the Collection
  await page.click('[data-action="start-blind"]');
  await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
  await page.sleep(1500);
  await clickVisible('[data-action="open-run-info"]');
  await page.waitFor('#dialogs .dlg');
  await page.sleep(700);
  await shot('run-info', { keepPointer: true });
  await page.key('Escape');
  await page.sleep(400);
  // the deck button that shows at this width (the stage's chip on a phone, the stack beside the hand on desktop)
  await clickVisible('.deck-btn, .deck-chip');
  await page.waitFor('#dialogs .dlg');
  await page.sleep(700);
  await shot('deck', { keepPointer: true });
  await page.key('Escape');
  await page.sleep(400);
  await js(`(() => { TW.UI.openOverlay('options'); return 1; })()`);
  await page.waitFor('#dialogs .dlg');
  await page.sleep(700);
  await shot('options', { keepPointer: true });
  await page.key('Escape');
  await page.sleep(400);

  // ------------------------------------------------------------ Game Over (this Blind, lost) and You win!
  await runJs(`run.blind.handsLeft = 1; run.blind.target = run.blind.score + 99990; UI.update(); return 1;`);
  await page.sleep(500);
  const low = await runJs(`const h = run.blind.hand.map((u) => E.getCard(run, u)); h.sort((a, b) => a.rank - b.rank); return h[0].uid;`);
  await clickCard(low);
  await page.sleep(300);
  await page.click('[data-action="play-hand"]');
  await until('Game Over', (s) => s.screen === 'gameover', 40000);
  await page.sleep(1800);
  await shot('gameover', { full: phone });
  // a won run: the last Boss Blind beaten (the engine's phase, the screen the router shows for it)
  await js(`(() => { __wick.newRun({ seed: 'FINALWIN', show: false }); return 1; })()`);
  await runJs(`
    E.startBlind(run);
    const b = run.blind;
    run.ante = 8; b.kind = 'boss'; b.boss = run.bosses[8] || null; b.index = 2; run.blindIndex = 2; b.target = 135000; b.score = 141220;
    run.stats.handsPlayed = 71; run.stats.blindsCleared = 24; run.stats.moneyEarned = 212; run.stats.cardsDiscarded = 88;
    run.stats.bestHand = { handId: 'flush', score: 48210 };
    run.levels.flush = 9; run.plays.flush = 23;
    run.phase = 'win'; run.won = true;
    UI.refresh(); return 1;`);
  await until('You win!', (s) => s.screen === 'win');
  await page.sleep(2600);
  await shot('win', { full: phone });
  await js(`(() => { TW.UI.store.remove('run'); TW.UI.setRun(null); TW.UI.show('collection'); return 1; })()`);
  await until('the Collection', (s) => s.screen === 'collection');
  await page.sleep(1500);
  await shot('collection', { full: phone });
  return { shots, staged };
}
