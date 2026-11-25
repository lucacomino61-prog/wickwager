// End-to-end check of the Shop, Booster Packs and Tags (a tools/cdp.mjs scenario). It plays through the real UI
// with real clicks; the engine's test hooks only stage things a seed would take long to find (a Tag on a Blind,
// money, an item kind in a slot):
//   1. a seeded run: skip the Small Blind for a Tag that opens a pack (the pack returns to the Blind select),
//      then skip the Big Blind for a Tag that waits for the next Shop (shown on the Blind select);
//   2. play the Boss Blind (its target staged to 1), Collect $N, reach the Shop with that Tag in use;
//   3. buy a Joker and a Planet card, use the Planet card from its slot, reroll (free, then paid), sell a Joker
//      from the rack, buy the Voucher, then buy and pick from one pack of each kind (Card, Tarot, Planet, Joker,
//      Ghost; Tarot and Ghost Packs act on cards selected in their dealt hand);
//   4. Next Blind, and start the next Blind.
// cdp.mjs fails the run on any console error or exception, so "zero console errors" is part of the check.
//
// Usage (serve the project root first: node tools/serve.mjs . 5182):
//   node tools/cdp.mjs run "http://localhost:5182/?test=1" tests/e2e/shop.mjs
//   node tools/cdp.mjs run "http://localhost:5182/" tests/e2e/shop.mjs
//   node tools/cdp.mjs run "http://localhost:5182/" tests/e2e/shop.mjs 390x844 --mobile
//   MOTION=reduced node tools/cdp.mjs run "http://localhost:5182/" tests/e2e/shop.mjs
//   SHOTS=1 node tools/cdp.mjs run "http://localhost:5182/" tests/e2e/shop.mjs
//     (also writes shots/ui/shop-*.png: the Shop, each pack kind open, the Tags on the Blind select; shop-phone-*
//      at phone width)
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = resolve(HERE, '../../shots/ui');
const SEED = 'SHOPE2E';
const KINDS = ['card', 'tarot', 'planet', 'joker', 'ghost'];

export default async function shop(page, { url }) {
  const SHOTS = process.env.SHOTS === '1';
  const log = [];
  const fail = (msg, extra) => { throw new Error(`${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`); };
  const js = async (expr) => page.eval(expr);
  const state = async () => JSON.parse(await js('JSON.stringify(window.__wick ? window.__wick.state() : null)'));
  const until = async (what, test, ms = 25000) => {
    const end = Date.now() + ms;
    let s = null;
    while (Date.now() < end) { s = await state(); if (s && test(s)) return s; await page.sleep(70); }
    fail(`timed out waiting for ${what}`, s);
  };
  const screen = (name, ms) => until(`screen ${name}`, (s) => s.screen === name && !s.busy, ms);
  const test = /[?&]test=1/.test(url);
  const settle = (ms) => page.sleep(test ? 80 : ms);
  const phone = (await js('TW.UI.MQ.phone.matches'));
  const run = (expr) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${expr} })()`);
  const noSideScroll = async (where) => {
    const w = await js('[document.documentElement.scrollWidth, innerWidth]');
    if (w[0] > w[1]) fail(`horizontal scroll ${where}`, w);
  };
  const shot = async (name, o = {}) => {
    if (!SHOTS) return;
    mkdirSync(SHOT_DIR, { recursive: true });
    await page.mouse(4, 4);
    await settle(500);
    // a product shot waits for the toasts to go (they are transient and would cover the top of the Shop)
    if (o.clean) { const end = Date.now() + 6000; while (Date.now() < end && (await js(`document.querySelectorAll('#toasts .toast').length`))) await page.sleep(100); }
    await page.screenshot(resolve(SHOT_DIR, `shop-${phone ? 'phone-' : ''}${name}.png`), { fullPage: phone });
    // a full-page capture resizes the phone's viewport for a moment: let the layout settle before the next click
    if (phone) { await js('scrollTo(0, 0)'); await page.sleep(600); }
    log.push(`shot ${name}`);
  };
  /** Click a card of the hand on its visible strip (the hand overlaps, more so on a phone). */
  async function clickCard(uid) {
    const p = await js(`(() => {
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
  /** Pick or use something the engine accepts from the open pack, selecting its cards in the dealt hand first. */
  async function pickFromPack(kind) {
    const plan = await run(`
      const p = run.pack, hand = p.hand.slice();
      const sets = [];
      hand.forEach((a, i) => { sets.push([a]); hand.slice(i + 1).forEach((b) => sets.push([a, b])); });
      const table = { tarot: Cn.TAROTS, spectral: Cn.SPECTRALS };
      const usesCards = (o) => { const r = (table[o.kind] || []).find((x) => x.id === o.id); return !!(r && r.select && r.select[1] > 0); };
      const open = p.options.map((o, i) => ({ o, i })).filter((x) => !x.o.picked);
      // with a dealt hand, a card that acts on selected cards first (that is the path to check), then anything
      for (const s of sets) for (const { o, i } of open) if (usesCards(o) && E.canPackPick(run, i, s).ok) return { i, sel: s, opt: o.kind, picks: p.picksLeft };
      for (const s of [[]].concat(sets)) for (const { o, i } of open) if (E.canPackPick(run, i, s).ok) return { i, sel: usesCards(o) ? s : [], opt: o.kind, picks: p.picksLeft };
      return null;`);
    if (!plan) { log.push({ kind, pick: 'none possible, skipped' }); await page.click('[data-action="pack-skip"]'); return null; }
    if (plan.sel.length) {
      // the first card by keyboard (1-9 toggle the dealt hand, as in play), the rest by clicking
      const first = await run(`return run.pack.hand.indexOf('${plan.sel[0]}') + 1;`);
      if (first >= 1 && first <= 9) await page.key(String(first)); else await clickCard(plan.sel[0]);
      for (const u of plan.sel.slice(1)) await clickCard(u);
      await settle(250);
      const sel = await js('TW.UI.shop.selected()');
      if (sel.length !== plan.sel.length) fail('the dealt hand did not follow the selection', { sel, want: plan.sel });
    }
    if (SHOTS) await shot(`pack-${kind}`);
    const before = await run('return { cards: run.cards.length, jokers: run.jokers.length, levels: JSON.stringify(run.levels), picks: run.pack.picksLeft };');
    // a Jumbo pack's row scrolls sideways on a phone: bring the button into view and let the row settle first
    const sel = `[data-action="pack-pick"][data-index="${plan.i}"]`;
    await js(`(() => { const b = document.querySelector('${sel.replace(/'/g, "\\'")}'); if (b) b.scrollIntoView({ block: 'center', inline: 'center' }); return 1; })()`);
    await page.sleep(phone ? 350 : 60);
    const at = await page.click(sel);
    const said = await js(`[...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent)`);
    // the pick registered: the pack closed or a pick was spent
    const end = Date.now() + 6000;
    while (Date.now() < end && (await run(`return !!run.pack && run.pack.picksLeft === ${before.picks};`))) await page.sleep(60);
    if (await run(`return !!run.pack && run.pack.picksLeft === ${before.picks};`)) {
      const hit = await js(`(() => { const n = document.elementFromPoint(${Math.round(at.x)}, ${Math.round(at.y)}); return n ? n.outerHTML.slice(0, 160) : null; })()`);
      const why = await run(`return { busy: UI.isBusy(), sel: UI.shop.selected(), can: E.canPackPick(run, ${plan.i}, UI.shop.selected()), toasts: [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent) };`);
      fail(`the ${kind} pick did not register`, { at, hit, plan, why, said });
    }
    await until(`the ${kind} pick to land`, (s) => !s.busy && ((s.phase === 'pack' && s.screen === 'pack') || (s.phase !== 'pack' && s.screen !== 'pack')), 15000);
    const after = await run('return { cards: run.cards.length, jokers: run.jokers.length, levels: JSON.stringify(run.levels), phase: run.phase };');
    if (plan.opt === 'card' && after.cards !== before.cards + 1) fail('the picked card did not join the deck', { before, after });
    if (plan.opt === 'joker' && after.jokers !== before.jokers + 1) fail('the picked Joker did not join the rack', { before, after });
    if (plan.opt === 'planet' && after.levels === before.levels) fail('the Planet card levelled nothing', { before, after });
    log.push({ kind, picked: plan.i, option: plan.opt, selected: plan.sel.length });
    return plan;
  }

  // ------------------------------------------------------------ 1. a seeded run; skip both Blinds for Tags
  await page.goto(url, { wait: 300 });
  await until('the game to boot', (s) => !!s.screen && s.screen !== 'boot');
  // MOTION=reduced (or full) runs the same flow under that Motion option
  if (process.env.MOTION) await js(`(() => { TW.UI.setSetting('motion', '${process.env.MOTION}'); return 1; })()`);
  await js(`(() => { __wick.newRun({ seed: '${SEED}' }); return 1; })()`);
  await screen('blind-select');
  await settle(900);
  const tags = await run(`
    const packTag = Cn.TAGS.find((t) => t.pack && (Cn.PACKS.find((p) => p.id === t.pack) || {}).kind === 'planet') || Cn.TAGS.find((t) => t.pack);
    const waitTag = Cn.TAGS.find((t) => t.discount);
    run.tags['1-0'] = packTag.id; run.tags['1-1'] = waitTag.id;
    UI.update();
    return { pack: packTag.id, wait: waitTag.id };`);
  await settle(700);
  await page.click('[data-action="skip-blind"]');
  await screen('pack', 15000);
  const ret = await run('return run.pack && run.pack.returnTo;');
  if (ret !== 'blind-select') fail('a pack from a Tag must return to the Blind select', { ret });
  await settle(1200);
  await pickFromPack('from-tag');
  await screen('blind-select', 15000);
  log.push({ tagPack: tags.pack, back: 'blind-select' });
  await settle(900);
  await page.click('[data-action="skip-blind"]');
  await until('the Boss Blind select', (s) => s.screen === 'blind-select' && s.blindIndex === 2 && !s.busy);
  await settle(1200);
  const waiting = await js(`[...document.querySelectorAll('.tags-waiting [data-wait-tag]')].map((n) => n.dataset.waitTag + ':' + n.dataset.waitState)`);
  if (!waiting.includes(`${tags.wait}:next-shop`)) fail('the waiting Tag is not shown on the Blind select', { waiting });
  await noSideScroll('on the Blind select with a waiting Tag');
  await shot('blind-tags');

  // ------------------------------------------------------------ 2. the Boss Blind, then the Shop
  await page.click('[data-action="start-blind"]');
  await until('the Boss Blind to deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
  await settle(1300);
  await run('run.blind.target = 1; return 1;');
  const best = await run(`
    const hand = run.blind.hand.slice();
    const combos = (arr, k, s = 0, cur = [], out = []) => { if (cur.length === k) { out.push(cur.slice()); return out; } for (let i = s; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, out); cur.pop(); } return out; };
    let best = null;
    for (let k = 1; k <= 5; k++) for (const c of combos(hand, k)) { if (!E.canPlay(run, c).ok) continue; const pv = E.preview(run, c); if (pv && (!best || pv.chips * pv.mult > best.v)) best = { v: pv.chips * pv.mult, c }; }
    return best && best.c;`);
  for (const u of best) await clickCard(u);
  await settle(300);
  await page.click('[data-action="play-hand"]');
  await until('the cash-out', (s) => s.screen === 'cashout' && !s.busy, 40000);
  await settle(1600);
  await page.click('[data-action="collect"]');
  await screen('shop', 15000);
  await settle(1400);
  const sale = await run(`return { discount: run.shop.discount, free: run.shop.freeRerolls, strip: [...document.querySelectorAll('#shop [data-wait-tag]')].map((n) => n.dataset.waitState) };`);
  if (!(sale.discount > 0) || !sale.strip.includes('in-use')) fail('the Sale Tag is not in use in the Shop', sale);
  log.push({ shop: 'open', sale });

  // ------------------------------------------------------------ 3. stage the Shop, then buy, use, reroll, sell, redeem
  const staged = await run(`
    const drawn = (p, rows) => rows.filter((r) => TW.Art && TW.Art.has && TW.Art.has(p + ':' + r.id));
    const J = drawn('joker', Cn.JOKERS).filter((j) => j.rarity !== 'legendary');
    const pool = J.length >= 6 ? J : Cn.JOKERS.filter((j) => j.rarity !== 'legendary');
    const own = pool.slice(0, 2).map((j) => j.id).filter((id) => !run.jokers.some((x) => x.id === id));
    own.forEach((id) => E.addJoker(run, id, 0, null));
    const sale = pool.find((j) => !run.jokers.some((x) => x.id === j.id));
    const P = drawn('planet', Cn.PLANETS)[0] || Cn.PLANETS[0];
    run.money = 260;
    const cards = run.shop.items.filter((x) => x && x.slot === 'card');
    Object.assign(cards[0], { kind: 'joker', id: sale.id, price: Math.max(1, Math.round(sale.cost * 0.75)), edition: 'gloss', sold: false });
    Object.assign(cards[1], { kind: 'planet', id: P.id, price: 3, edition: null, sold: false });
    if (!run.shop.items.some((x) => x && x.slot === 'voucher')) {
      const v = Cn.VOUCHERS.find((x) => !run.vouchers.includes(x.id));
      run.shop.items.push({ slot: 'voucher', kind: 'voucher', id: v.id, price: v.price, sold: false, edition: null, size: null });
    }
    UI.update();
    return { owned: run.jokers.map((j) => j.id), joker: sale.id, planet: P.id, items: run.shop.items.map((x) => x.slot + ':' + x.kind + ':' + x.id) };`);
  log.push({ staged });
  await settle(600);
  await noSideScroll('in the Shop');
  await shot('main', { clean: true });

  const idx = async (pred) => run(`return run.shop.items.findIndex((x) => x && !x.sold && (${pred}));`);
  // a Joker
  let i = await idx(`x.kind === 'joker'`);
  let before = await run('return { money: run.money, jokers: run.jokers.length };');
  await page.click(`[data-action="buy"][data-index="${i}"]`);
  await until('the Joker to land', (s) => !s.busy && s.jokers.length === before.jokers + 1);
  let after = await run(`return { money: run.money, sold: run.shop.items[${i}].sold, slot: !!document.querySelector('#shop .si[data-shop-index="${i}"].is-sold') };`);
  if (!after.sold || !after.slot || after.money >= before.money) fail('buying the Joker did not take', { before, after });
  log.push({ bought: 'joker', money: after.money });
  await settle(700);
  // a Planet card, then use it from its slot (levels a hand in the hand panel)
  i = await idx(`x.kind === 'planet'`);
  await page.click(`[data-action="buy"][data-index="${i}"]`);
  await until('the Planet card to land', (s) => !s.busy);
  const kuid = await run(`return (run.consumables.find((k) => k.kind === 'planet') || {}).uid || null;`);
  if (!kuid) fail('the Planet card is not in a consumable slot');
  await settle(700);
  const lv0 = await run('return JSON.stringify(run.levels);');
  await page.click(`#racks .jk[data-consumable-uid="${kuid}"]`);
  await page.waitFor('#dialogs [data-action="use-consumable"]');
  await settle(300);
  await page.click('#dialogs [data-action="use-consumable"]');
  await until('the Planet card to be used', (s) => !s.busy);
  await settle(test ? 100 : 1600);
  if ((await run('return JSON.stringify(run.levels);')) === lv0) fail('using the Planet card levelled nothing');
  log.push({ used: 'planet from its slot' });
  // the Jokers' events show on the rack (a synthetic event: the content may have no Joker that reacts here)
  await run(`const j = run.jokers[0]; UI.shop.jokerEvents([{ uid: j.uid, id: j.id, copyOf: null, event: 'purchase', op: 'state', key: 'mult', from: 0, to: 1 }, { uid: j.uid, id: j.id, copyOf: null, event: 'purchase', op: 'somethingNew' }]); return 1;`);
  await settle(800);
  // reroll: the Sale Tag's free one, then a paid one
  for (let k = 0; k < 2; k++) {
    before = await run('return { money: run.money, cost: E.rerollCost(run), cards: run.shop.items.filter((x) => x.slot === "card").map((x) => x.id).join() };');
    await page.click('[data-action="reroll"]');
    await until('the reroll', (s) => !s.busy);
    after = await run('return { money: run.money, cards: run.shop.items.filter((x) => x.slot === "card").map((x) => x.id).join() };');
    if (before.money - after.money !== before.cost) fail('the reroll charged the wrong price', { before, after });
    log.push({ reroll: before.cost === 0 ? 'free' : `$${before.cost}`, cards: after.cards });
    await settle(700);
  }
  // sell a Joker from the rack (the Shop's own sheet)
  const juid = await run('return run.jokers[run.jokers.length - 1].uid;');
  before = await run('return { money: run.money, jokers: run.jokers.length, value: E.jokerSellValue(run, run.jokers[run.jokers.length - 1].uid) };');
  await page.click(`#racks .jk[data-joker-uid="${juid}"]`);
  await page.waitFor('#dialogs [data-action="sell-joker"]');
  await settle(300);
  await page.click('#dialogs [data-action="sell-joker"]');
  await until('the sale', (s) => !s.busy && s.jokers.length === before.jokers - 1);
  after = await run('return { money: run.money };');
  if (after.money !== before.money + before.value) fail('selling paid the wrong amount', { before, after });
  log.push({ sold: juid, for: before.value });
  await settle(600);
  // the Voucher
  i = await idx(`x.kind === 'voucher'`);
  if (i < 0) fail('no Voucher on offer');
  const vid = await run(`return run.shop.items[${i}].id;`);
  await page.click(`[data-action="buy"][data-index="${i}"]`);
  await until('the Voucher', (s) => !s.busy);
  await settle(500);
  const owned = await run(`return { has: run.vouchers.includes('${vid}'), pill: !!document.querySelector('#shop [data-own-voucher="${vid}"]') };`);
  if (!owned.has || !owned.pill) fail('the Voucher was not redeemed or is not shown as owned', owned);
  log.push({ voucher: vid });
  await settle(700);

  // ------------------------------------------------------------ 3b. one Booster Pack of each kind
  for (const kind of KINDS) {
    if (kind === 'joker') await run('while (E.jokerSlotsUsed(run) >= run.jokerSlots && run.jokers.length) E.sellJoker(run, run.jokers[0].uid); UI.update(); return 1;');
    i = await run(`
      const k = run.shop.items.findIndex((x) => x && x.slot === 'pack');
      const row = Cn.PACKS.find((p) => p.kind === '${kind}' && p.size === 'normal');
      Object.assign(run.shop.items[k], { kind: 'pack', id: row.id, price: row.price, size: row.size, sold: false });
      run.money = Math.max(run.money, 60);
      UI.update();
      return k;`);
    await settle(400);
    await page.click(`[data-action="buy"][data-index="${i}"]`);
    await screen('pack', 15000);
    await settle(1100);
    await noSideScroll(`in a ${kind} pack`);
    const open = await run('return { kind: run.pack.kind, n: run.pack.options.length, hand: run.pack.hand.length, title: document.querySelector("#packTitle").textContent };');
    if (open.kind !== kind) fail('the wrong pack opened', open);
    if ((kind === 'tarot' || kind === 'ghost') && !open.hand) fail(`a ${kind} pack must deal a hand`, open);
    await pickFromPack(kind);
    await screen('shop', 15000);
    await settle(600);
  }

  // ------------------------------------------------------------ 4. Next Blind, and the next Blind starts
  await page.click('[data-action="leave-shop"]');
  await screen('blind-select');
  const next = await state();
  if (next.ante !== 2 || next.blindIndex !== 0) fail('Next Blind did not lead to the next Ante', next);
  await settle(900);
  await page.click('[data-action="start-blind"]');
  await until('the next Blind to deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
  log.push({ next: 'Ante 2 Small Blind started' });
  return log;
}
