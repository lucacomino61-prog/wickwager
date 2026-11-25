// Regression checks for the UI fix pass of 2026-11-24 (a tools/cdp.mjs scenario, best in test mode at 1440 x 900):
//   1. an item's sheet never sells, uses or buys on Enter: focus lands on its title; moving a Joker keeps the sheet
//      open with focus on the arrow just pressed;
//   2. The Squeeze limits plays only: five cards can be chosen and discarded, Play hand says why it is unavailable;
//   3. the cash-out plate follows the window (desktop to phone and back) and never strands off-screen;
//   4. the table fits laptop windows (1366 x 657, 1280 x 720, 1440 x 789): the hand and its buttons are in view;
//   5. one purchase rebuilds the Shop once (a click that spans a second rebuild was lost);
//   6. Colour-coded suits: the Options switch, 'card4:' faces in the hand, and back again;
//   7. reduced motion: no Boss emblem bloom and no Edition sweep keep moving;
//   8. name plates never clip mid-letter, for every Joker, Tarot, Planet, Spectral card and Voucher, at both pixel sizes;
//   9. the words: an unlit Blind, the Shop's way out, a won run's Continue line, at most two toasts;
// and for the final pass (2026-11-24):
//  10. the wording ruling: Target, Blind score and Overview where the player meets them, each fitting its pill, panel
//      or button at 1440 x 900, 1024 x 768 and 390 x 844, and none of the three old labels anywhere (those are on the
//      originality list, tests/local/originality.json: local-only, so without it that check is skipped and the
//      result's skipped list says so);
//  11. small screens: a landscape phone (844 x 390) and a short phone (360 x 640) show the table, the Blind select,
//      the Shop with Night Market and a Tarot Pack with no page scroll, the hand and its buttons in view;
//  12. Night Market on the table layout (1440 x 900, 1366 x 768, 1024 x 768): the lower row stays one row and the
//      Shop's shelves never scroll; every Buy is in view;
//  13. deep in Endless mode (Antes 13 to 36) the targets stay inside the Blind select's cards and the Blind plate at
//      all five sizes, and the screen reader still hears every digit (added by the final integration pass).
// Usage: node tools/cdp.mjs run "http://localhost:5187/?test=1&seed=FIXCHECK" tests/e2e/fixes.mjs
import { ORIGINALITY, skipOriginality } from '../local-data.mjs';

export default async function fixes(page, { url }) {
  const skipped = [];
  const js = (e) => page.eval(e);
  const runJs = (body) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${body} })()`);
  const state = async () => JSON.parse(await js('JSON.stringify(__wick.state())'));
  const fail = (m, x) => { throw new Error(m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 1200) : '')); };
  const until = async (what, f, ms = 10000) => { const end = Date.now() + ms; let s; while (Date.now() < end) { s = await state(); if (f(s)) return s; await page.sleep(40); } fail('timed out: ' + what, s); };
  const ok = (cond, msg, x) => { if (!cond) fail(msg, x); checks.push(msg); };
  const checks = [];
  const inView = (sel) => js(`(() => { const n = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => x.getClientRects().length); if (!n) return null; const r = n.getBoundingClientRect(); return r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; })()`);
  /** Wait for the finite animations to end (an entrance, a deal): a click aims at where a control rests. */
  const quiet = async (ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { const n = await js(`document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming && a.effect.getTiming().iterations !== Infinity).length`); if (!n) return; await page.sleep(80); } };
  const fresh = async (seed) => {
    await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); __wick.newRun({ seed: '${seed}' }); return 1; })()`);
    await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
    await quiet();
  };
  const toPlay = async () => {
    await quiet();
    await page.click('[data-action="start-blind"]');
    await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
    await quiet();
  };

  await page.viewport(1440, 900, false);
  await page.goto(url, { wait: 400 });
  await until('the title', (s) => s.screen === 'title');

  // ------------------------------------------------------------ 1. sheets never sell, use or buy on Enter
  await fresh('FIXSHEET');
  await runJs(`const ids = Cn.JOKERS.filter((j) => j.rarity === 'common').slice(0, 3).map((j) => j.id); ids.forEach((id) => E.addJoker(run, id)); run.consumables.push({ uid: 'k' + run.nextUid++, kind: 'tarot', id: Cn.TAROTS[0].id }); UI.saveRun(); UI.update(); return 1;`);
  await toPlay();
  await page.key('1'); await page.key('2');
  const before = await runJs('return { money: run.money, jokers: run.jokers.map((j) => j.uid), hands: run.blind.handsLeft };');
  await page.click(`.jk[data-joker-uid="${before.jokers[0]}"]`);
  await page.waitFor('#dialogs .sheet');
  await page.sleep(50);
  const focus1 = await js(`(() => { const a = document.activeElement; return a ? (a.className + '|' + (a.dataset.action || '')) : ''; })()`);
  ok(/s-name/.test(focus1), 'a Joker sheet opens with focus on its title, not on Sell', focus1);
  await page.key('Enter');
  await page.sleep(150);
  const after1 = await runJs('return { money: run.money, jokers: run.jokers.map((j) => j.uid) };');
  ok(after1.jokers.length === before.jokers.length && after1.money === before.money, 'Enter on an open Joker sheet sells nothing', { before, after1 });
  // keyboard: Tab to Right, Enter moves the Joker; the sheet stays open on Right; Enter again moves it again
  await page.key('Tab');
  let f = await js(`document.activeElement && document.activeElement.getAttribute('aria-label')`);
  if (!/right/i.test(f || '')) { await page.key('Tab'); f = await js(`document.activeElement && document.activeElement.getAttribute('aria-label')`); }
  ok(/right/i.test(f || ''), 'Tab reaches the Move right button', f);
  await page.key('Enter');
  await page.sleep(150);
  const mv1 = await runJs('return run.jokers.map((j) => j.uid);');
  const still = await js(`(() => ({ open: !!document.querySelector('#dialogs .sheet'), focus: document.activeElement && document.activeElement.getAttribute('aria-label') }))()`);
  ok(mv1[1] === before.jokers[0] && still.open && /right/i.test(still.focus || ''), 'moving a Joker keeps its sheet open with focus on the arrow', { mv1, still });
  await page.key('Enter');
  await page.sleep(150);
  const mv2 = await runJs('return { order: run.jokers.map((j) => j.uid), money: run.money };');
  ok(mv2.order[2] === before.jokers[0] && mv2.money === before.money, 'a second Enter moves it again, and still sells nothing', mv2);
  await page.key('Escape');
  await page.sleep(100);
  // the Tarot card's sheet: Enter does not use it on the selected cards
  const k = await runJs('return run.consumables[0].uid;');
  await page.click(`.jk[data-consumable-uid="${k}"]`);
  await page.waitFor('#dialogs .sheet');
  await page.sleep(50);
  await page.key('Enter');
  await page.sleep(150);
  ok(await runJs(`return run.consumables.some((c) => c.uid === '${k}');`), 'Enter on an open consumable sheet uses nothing');
  await page.key('Escape');
  await page.sleep(80);

  // ------------------------------------------------------------ 2. The Squeeze limits plays, not discards
  await fresh('FIXSQZ');
  await toPlay();
  await runJs(`run.blind.boss = 'squeeze'; run.blind.kind = 'boss'; UI.update(); return 1;`);
  await page.sleep(80);
  for (const key of ['1', '2', '3', '4', '5']) await page.key(key);
  await page.sleep(80);
  const sq = await js(`(() => { const p = document.querySelector('[data-action="play-hand"]'); return { sel: __wick.state().selected.length, playOff: p.getAttribute('aria-disabled'), why: p.dataset.why || '' }; })()`);
  ok(sq.sel === 5, 'five cards can be chosen under The Squeeze', sq);
  ok(sq.playOff === 'true' && /4/.test(sq.why), 'Play hand is unavailable over the limit and says why', sq);
  const d0 = await runJs('return run.blind.discardsLeft;');
  await page.key('d');
  await until('the discard', (s) => !s.busy && s.discardsLeft === d0 - 1, 15000);
  checks.push('a five-card discard works under The Squeeze');

  // ------------------------------------------------------------ 3. the cash-out follows the window
  await fresh('FIXCASH');
  await toPlay();
  await runJs('run.blind.target = 1; UI.update(); return 1;');
  await page.key('1'); await page.key('Enter');
  await until('the cash-out', (s) => s.screen === 'cashout' && !s.busy, 30000);
  await quiet();
  ok(await inView('#dialogs .beaten'), 'the cash-out is in view at 1440 x 900');
  await page.viewport(390, 844, true);
  await page.sleep(400);
  ok(await inView('#dialogs .beaten') && await inView('[data-action="collect"]'), 'after a resize to a phone the cash-out and Collect are in view');
  await page.viewport(1440, 900, false);
  await page.sleep(400);
  const back = await js(`(() => ({ over: document.querySelector('#dialogs .overlay').classList.contains('over-stage') }))()`);
  ok(await inView('#dialogs .beaten') && back.over, 'back on desktop it sits over the field again', back);
  const pill = await js(`document.querySelector('#dialogs .beaten .p-head .tag').textContent`);
  ok(/cleared$/i.test(pill.trim()) && !(await js(`!!document.querySelector('#dialogs .beaten .head .vs .lbl:not(.t)')`)), 'the pill names the Blind and no line repeats it', pill);
  ok(await js(`getComputedStyle(document.querySelector('.cashout li .who')).fontFamily.includes('Tiny5')`), 'cash-out labels are pixel labels (Tiny5)');

  // ------------------------------------------------------------ 5. one purchase, one Shop rebuild
  await page.click('[data-action="collect"]');
  await until('the Shop', (s) => s.screen === 'shop' && !s.busy);
  await quiet();
  await runJs(`const J = Cn.JOKERS.filter((j) => j.rarity === 'common' && !run.jokers.some((x) => x.id === j.id)); const c = run.shop.items.find((x) => x && x.slot === 'card'); Object.assign(c, { kind: 'joker', id: J[5].id, price: 2, edition: null, sold: false }); run.money = 30; UI.update(); return 1;`);
  await page.sleep(150);
  await quiet();
  await js(`(() => { window.__rebuilds = 0; const main = document.querySelector('#main'); window.__mo = new MutationObserver((ms) => { ms.forEach((m) => [...m.addedNodes].forEach((n) => { if (n.id === 'shop') window.__rebuilds++; })); }); window.__mo.observe(main, { childList: true }); return 1; })()`);
  const bi = await runJs(`return run.shop.items.findIndex((x) => x && x.kind === 'joker' && !x.sold);`);
  await page.click(`[data-action="buy"][data-index="${bi}"]`);
  await page.sleep(600);
  const rb = await js('window.__mo.disconnect(), window.__rebuilds');
  ok(rb === 1, 'one purchase rebuilds the Shop once', rb);
  ok(await js(`document.querySelector('[data-action="leave-shop"]').textContent.trim()`) === 'Next Blind', 'the Shop\'s way out says Next Blind');

  // ------------------------------------------------------------ 9a. an unlit Blind, at most two toasts
  await quiet();
  await page.click('[data-action="leave-shop"]');
  await until('the next Blind select', (s) => s.screen === 'blind-select' && !s.busy);
  await quiet();
  const unlit = await js(`[...document.querySelectorAll('.blind-card.is-upcoming .bc-status .tag')].map((t) => t.textContent.trim())`);
  ok(unlit.length && unlit.every((t) => t === 'Unlit') && !(await js(`[...document.querySelectorAll('.blind-card.is-upcoming .candle')].some((c) => !c.classList.contains('is-out'))`)), 'Blinds still to come wait unlit', unlit);
  await js(`(() => { for (let i = 0; i < 5; i++) TW.UI.toast('Note ' + i); return 1; })()`);
  ok(await js(`document.querySelectorAll('#toasts .toast').length`) <= 2, 'never more than two toasts at once');

  // ------------------------------------------------------------ 4. laptop windows fit the table
  for (const [w, h] of [[1366, 657], [1280, 720], [1440, 789], [1536, 730]]) {
    await page.viewport(w, h, false);
    await page.sleep(300);
    if ((await state()).screen !== 'play') { await toPlay(); }
    const fit = await js(`(() => ({ px: TW.UI.PX(), doc: document.scrollingElement.scrollHeight, vh: innerHeight }))()`);
    ok(fit.px === 2 && fit.doc <= fit.vh + 1, `the table fits ${w} x ${h} at 2 px an art pixel`, fit);
    ok(await inView('[data-action="play-hand"]') && await inView('[data-action="discard"]') && await inView('#hand .card:last-child'), `Play hand, Discard and the hand are in view at ${w} x ${h}`);
  }
  await page.viewport(1440, 900, false);
  await page.sleep(300);
  ok(await js('TW.UI.PX()') === 3, 'a 1440 x 900 window keeps 3 px an art pixel');

  // ------------------------------------------------------------ 6. Colour-coded suits
  await js(`(() => { TW.UI.openOverlay('options'); return 1; })()`);
  await page.waitFor('#dialogs [data-action="toggle-four-color"]');
  const sw0 = await js(`document.querySelector('[data-action="toggle-four-color"]').getAttribute('aria-checked')`);
  ok(sw0 === 'false', 'Colour-coded suits is off by default', sw0);
  const hintOk = await js(`(() => { const h = document.querySelector('#opSuitsHint'); return !!h && h.textContent.length > 20 && parseFloat(getComputedStyle(h).fontSize) >= 15; })()`);
  ok(hintOk, 'the switch has its help text (15 px or more)');
  const srcs0 = await js(`[...document.querySelectorAll('#hand .card .face')].map((n) => n.getAttribute('src') || '')`);
  await page.click('#dialogs [data-action="toggle-four-color"]');
  await page.sleep(200);
  const on = await js(`({ setting: TW.UI.settings().fourColor, cls: document.documentElement.classList.contains('four-color'), sw: document.querySelector('[data-action="toggle-four-color"]').getAttribute('aria-checked') })`);
  ok(on.setting === true && on.cls && on.sw === 'true', 'the switch turns Colour-coded suits on', on);
  const ids = await runJs(`return run.blind.hand.map((u) => UI.cardSpriteId(E.getCard(run, u)));`);
  ok(ids.length && ids.every((id) => id.startsWith('card4:')), 'every card in hand asks for its four-colour face', ids);
  const srcs1 = await js(`[...document.querySelectorAll('#hand .card .face')].map((n) => n.getAttribute('src') || '')`);
  const suits = await runJs(`return run.blind.hand.map((u) => E.getCard(run, u).suit);`);
  const changed = suits.map((s, i) => (s === 'C' || s === 'D') ? srcs0[i] !== srcs1[i] : srcs0[i] === srcs1[i]);
  ok(changed.every(Boolean), 'the hand is redrawn: Clubs and Diamonds change face, Spades and Hearts keep theirs', { suits, changed });
  await page.click('#dialogs [data-action="toggle-four-color"]');
  await page.sleep(200);
  ok((await runJs(`return run.blind.hand.map((u) => UI.cardSpriteId(E.getCard(run, u)));`)).every((id) => id.startsWith('card:')), 'and back to the two-colour faces');
  await page.key('Escape');
  await page.sleep(100);

  // ------------------------------------------------------------ 7. reduced motion stops the emblem bloom and the sweep
  await js(`(() => { TW.UI.setSetting('motion', 'reduced'); return 1; })()`);
  await runJs(`const j = run.jokers[0] || E.addJoker(run, Cn.JOKERS[3].id); j.edition = 'gloss'; run.blind.boss = 'squeeze'; run.blind.kind = 'boss'; UI.update(); return 1;`);
  await page.sleep(300);
  const moving = await js(`document.getAnimations().filter((a) => a.playState === 'running' && /^(bloom|ed-sheen|ed-phantom|ed-dither)/.test(a.animationName || '')).map((a) => a.animationName)`);
  ok(!moving.length, 'under reduced motion no bloom, sweep or flicker loops run', moving);
  await js(`(() => { TW.UI.setSetting('motion', 'auto'); return 1; })()`);

  // ------------------------------------------------------------ 8. name plates never clip mid-letter
  const clipped = await js(`(async () => {
    await TW.UI.fontsReady;
    const Cn = TW.Content, rows = [].concat(Cn.JOKERS, Cn.TAROTS, Cn.PLANETS, Cn.SPECTRALS, Cn.VOUCHERS);
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;display:flex;flex-wrap:wrap';
    host.innerHTML = rows.map((r) => '<span class="jk" style="position:relative">' + TW.UI.plateHTML(r.name) + '</span>').join('');
    document.body.append(host);
    const bad = [...host.querySelectorAll('.plate')].filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent);
    host.remove();
    return bad;
  })()`);
  ok(!clipped.length, 'no plate clips at 3 px an art pixel', clipped);
  await page.viewport(390, 844, true);
  await page.sleep(400);
  const clippedPhone = await js(`(async () => {
    const Cn = TW.Content, rows = [].concat(Cn.JOKERS, Cn.TAROTS, Cn.PLANETS, Cn.SPECTRALS, Cn.VOUCHERS);
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;display:flex;flex-wrap:wrap';
    host.innerHTML = rows.map((r) => '<span class="jk" style="position:relative">' + TW.UI.plateHTML(r.name) + '</span>').join('');
    document.body.append(host);
    const all = [...host.querySelectorAll('.plate')];
    const bad = all.filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent);
    const shortened = all.filter((p) => /\\.$/.test(p.textContent)).map((p) => p.textContent);
    host.remove();
    return { bad, shortened, n: all.length };
  })()`);
  ok(!clippedPhone.bad.length, 'no plate clips at 2 px an art pixel', clippedPhone);
  await page.viewport(1440, 900, false);
  await page.sleep(300);

  // ------------------------------------------------------------ 10. the wording ruling: Target, Blind score, Overview
  /** Each match's text, and whether it sits inside its pill, button, panel or dialog (and does not overflow itself). */
  const words = (sel) => js(`[...document.querySelectorAll(${JSON.stringify(sel)})].filter((n) => n.getClientRects().length).map((n) => {
    const r = n.getBoundingClientRect(), box = n.parentElement.closest('.tag, .btn, .panel, .dlg') || n.parentElement, b = box.getBoundingClientRect();
    return { text: n.textContent.trim(), label: n.getAttribute('aria-label') || '', fit: n.scrollWidth <= n.clientWidth + 1 && r.left >= b.left - 1 && r.right <= b.right + 1 };
  })`);
  // the three old labels, from the originality list (local-only): without it the two checks for them are skipped
  const noOldSkipped = skipOriginality(skipped, 'section 10, no old label on the Blind select, the table, Pause or Overview');
  const OLD = ORIGINALITY ? ORIGINALITY.patterns.oldLabels : null;
  const noOld = () => js(`(() => { const t = document.body.innerText + ' ' + [...document.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label')).join(' ') + ' ' + __wick.live(); const old = new RegExp(${JSON.stringify(OLD && OLD[0])}, ${JSON.stringify(OLD && OLD[1])}); return old.test(t) ? t.match(new RegExp('.{0,30}(' + old.source + ').{0,30}', old.flags))[0] : ''; })()`);
  for (const [w, h, m] of [[1440, 900, false], [1024, 768, false], [390, 844, true]]) {
    const at = `${w} x ${h}`;
    await page.viewport(w, h, m);
    await fresh('FIXWORDS');
    const bc = await words('.blind-card .bc-target .lbl');
    ok(bc.length === 3 && bc.every((x) => x.text === 'Target' && x.fit), `the Blind select says Target for each Blind, in its plate, at ${at}`, bc);
    const col = await words('#blindPanel .target > .lbl');
    ok(col.length === 1 && col[0].text === 'Target' && col[0].fit, `the Blind panel says Target at ${at}`, col);
    const tab = await words('#scoreTab');
    ok(tab.length === 1 && tab[0].text === 'Blind score' && tab[0].fit && await js(`document.querySelector('.w-score').getAttribute('aria-label')`) === 'Blind score', `the score panel says Blind score, in its pill, at ${at}`, tab);
    const ov = await words(m ? '.r-counts [data-action="open-run-info"]' : '.r-btns [data-action="open-run-info"] .t');
    ok(ov.length === 1 && (m ? ov[0].label === 'Overview' : ov[0].text === 'Overview') && ov[0].fit, `the table's Overview button at ${at}`, ov);
    ok(await js(`!!document.querySelector('${m ? '.r-counts' : '.r-btns'} [data-action="open-run-info"] .spr, ${m ? '.r-counts' : '.r-btns'} [data-action="open-run-info"] .ph')`), `it keeps the info icon at ${at}`);
    if (!noOldSkipped) ok(!(await noOld()), `no old label on the Blind select at ${at}`, await noOld());
    // every announcement from here on is kept, so the check sees the Blind's start line even when a later one follows
    await js(`(() => { window.__said = []; const live = document.querySelector('#live'); window.__liveMo = new MutationObserver(() => { if (live.textContent) window.__said.push(live.textContent); }); window.__liveMo.observe(live, { childList: true, characterData: true, subtree: true }); return 1; })()`);
    await toPlay();
    await page.sleep(120);
    const said = await js(`(window.__liveMo.disconnect(), window.__said.join(' | '))`);
    ok(/started\. Target \d/.test(said), `the start of a Blind is announced with its Target at ${at}`, said);
    await page.key('Escape');
    await page.waitFor('#dialogs .pz-dlg');
    const pz = await words('#dialogs .pz-menu [data-action="open-run-info"]');
    ok(pz.length === 1 && pz[0].text === 'Overview' && pz[0].fit, `the Pause menu says Overview at ${at}`, pz);
    await page.click('#dialogs .pz-menu [data-action="open-run-info"]');
    await page.waitFor('#dialogs .ri-dlg');
    await page.sleep(80);
    const title = await words('#dialogs .ri-dlg .p-head .tag');
    ok(title.length >= 1 && title[0].text === 'Overview' && title[0].fit, `the dialog is titled Overview, in its pill, at ${at}`, title);
    const ri = await words('#dialogs .ri-bl-n > .lbl:first-child');
    ok(ri.length === 3 && ri.every((x) => x.text === 'Target' && x.fit), `Overview lists each Blind's Target at ${at}`, ri);
    if (!noOldSkipped) ok(!(await noOld()), `no old label on the table, Pause or Overview at ${at}`, await noOld());
    await page.key('Escape'); await page.sleep(60); await page.key('Escape'); await page.sleep(80);
    await js(`(() => { TW.UI.closeAllDialogs(); return 1; })()`);
    await page.key('i');
    await page.waitFor('#dialogs .ri-dlg');
    checks.push(`the I key still opens Overview at ${at}`);
    await js(`(() => { TW.UI.closeAllDialogs(); return 1; })()`);
  }

  // ------------------------------------------------------------ 11 and 12. small screens, and Night Market on the table layout
  const docFits = () => js(`document.scrollingElement.scrollHeight <= innerHeight + 1 && document.scrollingElement.scrollWidth <= innerWidth + 1`);
  const allInView = async (sel, max = 99) => { const n = await js(`document.querySelectorAll(${JSON.stringify(sel)}).length`); for (let i = 0; i < Math.min(n, max); i++) { if (!(await js(`(() => { const x = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; const r = x.getBoundingClientRect(); return r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; })()`))) return false; } return n > 0; };
  const toShop = async (seed) => {
    await fresh(seed);
    await runJs(`Cn.JOKERS.filter((j) => j.rarity === 'common').slice(0, 4).forEach((j) => E.addJoker(run, j.id)); run.consumables.push({ uid: 'k' + run.nextUid++, kind: 'planet', id: Cn.PLANETS[2].id }); if (!run.vouchers.includes('spinnerrack')) run.vouchers.push('spinnerrack'); run.money = 30; UI.saveRun(); UI.update(); return 1;`);
    await quiet();
    return true;
  };
  const playToShop = async () => {
    await runJs('run.blind.target = 1; UI.update(); return 1;');
    await page.key('1'); await page.key('Enter');
    await until('the cash-out', (s) => s.screen === 'cashout' && !s.busy, 30000);
    await quiet();
    await js(`document.querySelector('[data-action="collect"]').click(), 1`);
    await until('the Shop', (s) => s.screen === 'shop' && !s.busy);
    await runJs(`const packs = run.shop.items.filter((x) => x && x.slot === 'pack'); const rowT = Cn.PACKS.find((p) => p.kind === 'tarot' && p.size === 'normal'); Object.assign(packs[0], { kind: 'pack', id: rowT.id, price: rowT.price, size: rowT.size, sold: false }); run.money = 40; UI.update(); return 1;`);
    await page.sleep(120);
    await quiet();
  };
  const openTarotPack = async () => {
    const pk = await runJs(`return run.shop.items.findIndex((x) => x && x.slot === 'pack' && !x.sold);`);
    await js(`document.querySelector('[data-action="buy"][data-index="${pk}"]').click(), 1`);
    await until('the pack', (s) => s.screen === 'pack' && !s.busy);
    await quiet();
  };
  for (const [w, h] of [[844, 390], [360, 640]]) {
    const at = `${w} x ${h}`;
    await page.viewport(w, h, true);
    await toShop('FIXSMALL');
    ok(await docFits() && await inView('.blind-card.is-current [data-action="start-blind"]'), `the Blind select fits ${at} with its Play button in view`);
    await toPlay();
    for (const k of ['1', '2']) await page.key(k);
    await page.sleep(80);
    ok(await docFits(), `the table fits ${at} with no page scroll`, await js('[document.scrollingElement.scrollHeight, innerHeight]'));
    ok(await allInView('#hand .card') && await inView('[data-action="play-hand"]') && await inView('[data-action="discard"]') && await inView('[data-action="sort-rank"]'), `the whole hand, Play hand, Sort and Discard are in view at ${at}`);
    ok(await inView('#score') && await inView('#target') && await inView('#hands') && await inView('#discards') && await inView('#money') && await inView('[data-action="open-options"]'), `the target, Blind score, hands, discards, money and Options are in view at ${at}`);
    await playToShop();
    ok(await docFits(), `the Shop with Night Market fits ${at} with no page scroll`, await js('[document.scrollingElement.scrollHeight, innerHeight]'));
    ok(await inView('[data-action="reroll"]') && await inView('[data-action="leave-shop"]') && await allInView('#racks .rack'), `Reroll, Next Blind and the racks are in view at ${at}`);
    ok(await allInView('#shop [data-action="buy"]', w > h ? 6 : 99), `${w > h ? 'six Buy buttons (the seventh is a sideways scroll away)' : 'every Buy'} in view at ${at}`);
    await openTarotPack();
    ok(await docFits(), `a Tarot Pack fits ${at} with no page scroll`, await js('[document.scrollingElement.scrollHeight, innerHeight]'));
    ok(await allInView('#hand .card') && await inView('[data-action="pack-skip"]') && await allInView('[data-action="pack-pick"]', 3) && await inView('#pkDetail'), `its dealt hand, Skip, the first Use buttons and the reading plate are in view at ${at}`);
    await js(`document.querySelector('[data-action="pack-skip"]').click(), 1`);
    await until('the Shop again', (s) => s.screen === 'shop' && !s.busy);
  }
  for (const [w, h] of [[1440, 900], [1366, 768], [1024, 768]]) {
    const at = `${w} x ${h}`;
    await page.viewport(w, h, false);
    await toShop('FIXNIGHT');
    await toPlay();
    await playToShop();
    const nm = await js(`(() => { const g = document.querySelector('.shop-grid'), tops = new Set([...document.querySelectorAll('.s-lower > .si')].map((n) => Math.round(n.getBoundingClientRect().top))); return { n: document.querySelectorAll('.s-lower > .si').length, rows: tops.size, cards: document.querySelectorAll('.s-cards > .si').length, scroll: g.scrollHeight - g.clientHeight, dense: document.querySelector('#shop').classList.contains('dense') }; })()`);
    ok(nm.dense && nm.cards === 3 && nm.n === 4 && nm.rows === 1, `Night Market's four lower items stay one row at ${at}`, nm);
    ok(nm.scroll <= 1 && await docFits() && await allInView('#shop [data-action="buy"]'), `the Shop's shelves never scroll and every Buy is in view at ${at}`, nm);
  }
  await page.viewport(1440, 900, false);
  await page.sleep(300);

  // ------------------------------------------------------------ 13. deep in Endless mode the targets stay in their panels
  // (final pass, integration: the Blind select's targets left their cards on a phone from Ante 13, the Blind plate's
  // from Ante 22 on the table layout; they now take the smaller face, then the short exponent)
  for (const [w, h, m] of [[1440, 900, false], [1024, 768, false], [390, 844, true], [844, 390, true], [360, 640, true]]) {
    const at = `${w} x ${h}`;
    await page.viewport(w, h, m);
    await fresh('FIXDEEP');
    for (const ante of [13, 17, 22, 29, 36]) {
      await runJs(`run.ante = ${ante}; run.endless = true; UI.update(); return 1;`);
      await page.sleep(40);
      const fit = await js(`(() => {
        const out = (n, box) => { const r = n.getBoundingClientRect(), b = box.getBoundingClientRect(); return Math.round(Math.max(r.right - b.right, b.left - r.left)); };
        const cards = [...document.querySelectorAll('.blind-card')].map((c) => out(c.querySelector('.bc-target .num-img'), c));
        const col = out(document.querySelector('#target .num-img'), document.querySelector('#blindPanel'));
        const heard = [...document.querySelectorAll('.bc-target .sr, #target .sr')].map((n) => n.textContent);
        return { cards, col, heard };
      })()`);
      const full = await runJs(`return E.blindsForAnte(run).map((b) => b.target.toLocaleString('en-US'));`);
      ok(fit.cards.every((x) => x <= 0) && fit.col <= 0, `Ante ${ante}'s targets stay inside the Blind select's cards and the Blind plate at ${at}`, { fit, full });
      ok(full.every((t) => fit.heard.includes(t)), `the screen reader still hears every digit of Ante ${ante}'s targets at ${at}`, { heard: fit.heard, full });
    }
    // and a Blind beaten at Ante 36: the Blind score and the cash-out's score stay in their panels too
    await toPlay();
    await runJs('run.blind.score = run.blind.target - 1; UI.update(); return 1;');
    await page.key('1'); await page.key('Enter');
    await until('the deep cash-out', (s) => s.screen === 'cashout' && !s.busy, 30000);
    await quiet();
    const deep = await js(`(() => {
      const out = (n, box) => { const r = n.getBoundingClientRect(), b = box.getBoundingClientRect(); return Math.round(Math.max(r.right - b.right, b.left - r.left)); };
      return { score: out(document.querySelector('#score .num-img'), document.querySelector('.w-score')), plate: out(document.querySelector('#dialogs .beaten .head .vs .num-img'), document.querySelector('#dialogs .beaten')),
        heard: [document.querySelector('#score .sr').textContent, document.querySelector('#dialogs .beaten .head .vs .sr').textContent] };
    })()`);
    const sc = await runJs(`return run.blind.score.toLocaleString('en-US');`);
    ok(deep.score <= 0 && deep.plate <= 0 && deep.heard.every((t) => t === sc), `a Blind beaten at Ante 36 keeps its score inside the Blind score panel and the cash-out at ${at}`, { deep, sc });
  }
  await page.viewport(1440, 900, false);
  await page.sleep(300);

  // ------------------------------------------------------------ 9b. a won run's Continue line
  await runJs(`run.phase = 'win'; run.won = true; UI.saveRun(); UI.setRun(null); UI.show('title'); return 1;`);
  await until('the title', (s) => s.screen === 'title');
  const line = await js(`(document.querySelector('#ttSaved') || {}).textContent || ''`);
  ok(/You win!/.test(line) && /Endless/.test(line), 'a won run\'s Continue line offers Endless mode', line);
  await js(`(() => { TW.UI.store.remove('run'); return 1; })()`);
  return { checks: checks.length, list: checks, skipped, shortenedPlates: clippedPhone.shortened };
}
