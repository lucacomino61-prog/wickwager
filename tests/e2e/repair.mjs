// Regression checks for the final pass, part 3, repair round (2026-11-25): each confirmed review finding's repro, a
// tools/cdp.mjs scenario. Run it in test mode; it sets its own window sizes (desktop, and phones with touch), and its
// last section goes to real speed itself. Each section failed on build 013fa41f, before the repair. It checks:
//   1. R3  crossing a breakpoint (1440 x 900 to 1440 x 860) sets every Collection plate and an open How to play's
//          plates for 2 px, in place: none is cut mid-letter (51 of 120 were), focus and the scroll stay put;
//   2. R4  at the 2 px laptop sizes (1024 x 768, 1280 x 720, 1366 x 768) the chosen card's hover tip stands clear of
//          the Move pair, and the first click on Move moves the card (it landed on the tip);
//   3. R5  in the Shop, an item's sheet stays by its item across a breakpoint and Esc hands focus back to the item;
//          Pause opened from Reroll, or from the column's Options, hands focus back to it after a breakpoint (both
//          fell to the page, and the sheet jumped to the screen's centre);
//   4. R6  Esc closing Pause hands focus back to the hand card with no tip, so the next Esc opens Pause again (the
//          card's tip popped and took that Esc);
//   5. Q1  touch: a tap on a pinned tip closes it and does nothing else: no hand played under a consumable's tip on a
//          landscape phone, no card moved or chosen under a card's tip at 360 x 640;
//   6. Q2  storage full: Save and quit says the run could not be saved, never "Run saved";
//   7. Q3  S with focus on a hand card keeps focus (and its ring) on that card, so Enter puts it back, never plays;
//   8. Q4  at a win the unlocks are said once, in the end screen's line after "You win!", never ahead of the score;
//          the unlocks said mid-run are sentences, each ending with a full stop;
//   9. Q5  on every phone size the chosen card's Seal shows whole, clear of the Move pair (it hid up to 71 %);
//  10. Q6  720 x 450 (200 % zoom) with the keyboard: each Joker's focus ring lies inside the rack's scroller, whole;
//  11. Q8  720 x 450 with no Joker: the empty rack is no Tab stop;
//  12. R1  at real speed, after a discard's deal and after a played hand's deal, Rank and Suit are on and a click (a
//          tap on a phone) on the other one sorts the hand (they stayed off until a card was chosen).
// cdp.mjs fails the run on any console error or exception. ONLY=n,m runs some sections; SOFT=1 records each failed
// check and goes on (to show what an older build fails).
// Usage: node tools/cdp.mjs run "http://localhost:5200/build/index.html?test=1&seed=REPAIR01" tests/e2e/repair.mjs
export default async function repair(page, { url }) {
  const js = (e) => page.eval(e);
  const runJs = (body) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${body} })()`);
  const state = async () => JSON.parse(await js('JSON.stringify(__wick.state())'));
  const SOFT = !!process.env.SOFT;
  const checks = [], failed = [];
  const fail = (m, x) => { throw new Error(m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 1500) : '')); };
  const ok = (cond, msg, x) => { if (!cond) { if (SOFT) { failed.push({ msg, x: JSON.stringify(x === undefined ? null : x).slice(0, 600) }); return; } fail(msg, x); } checks.push(msg); };
  const until = async (what, f, ms = 15000) => { const end = Date.now() + ms; let s; while (Date.now() < end) { s = await state(); if (f(s)) return s; await page.sleep(40); } fail('timed out: ' + what, s); };
  const ONLY = String(process.env.ONLY || '').split(',').filter(Boolean).map(Number);
  const on = (n) => !ONLY.length || ONLY.includes(n);
  const out = {};
  // ---- input: keys with modifiers (Shift 8), a real mouse, touch
  const CODES = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Tab: 9, Escape: 27, Enter: 13, ' ': 32 };
  const key = async (k, modifiers = 0) => {
    let code, kc, text;
    if (CODES[k] != null) { kc = CODES[k]; code = k === ' ' ? 'Space' : k; text = k === 'Enter' ? '\r' : k === ' ' ? ' ' : undefined; }
    else if (/^[0-9]$/.test(k)) { kc = k.charCodeAt(0); code = 'Digit' + k; text = k; }
    else { kc = k.toUpperCase().charCodeAt(0); code = 'Key' + k.toUpperCase(); text = k; }
    await page.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code, windowsVirtualKeyCode: kc, nativeVirtualKeyCode: kc, modifiers, text, unmodifiedText: text });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: kc, nativeVirtualKeyCode: kc, modifiers });
  };
  const mouseMove = (x, y) => page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  const mouseClick = async (x, y) => { await mouseMove(x, y); await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }); await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }); };
  const glide = async (a, b, n = 12) => { for (let i = 1; i <= n; i++) { await mouseMove(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n); await page.sleep(16); } };
  const tap = async (x, y, hold = 60) => {
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }] });
    await page.sleep(hold);
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const longPress = (x, y) => tap(x, y, 700);
  // ---- reading the page
  const boxOf = (sel, i = 0) => js(`(() => { const n = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((x) => x.getClientRects().length)[${i}]; if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; })()`);
  const tipBox = () => js(`(() => { const t = document.querySelector('#tip'); if (!t || t.hidden) return null; const r = t.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const active = () => js(`(() => { const a = document.activeElement; if (!a) return null; return { tag: a.tagName, id: a.id || '', action: (a.dataset && a.dataset.action) || '', uid: (a.dataset && (a.dataset.uid || a.dataset.jokerUid)) || '', art: (a.dataset && a.dataset.shopArt) || null, ring: a.matches(':focus-visible'), body: a === document.body, inDialog: !!a.closest('#dialogs') }; })()`);
  const listen = () => js(`(() => { window.__said = []; const live = document.querySelector('#live'); if (window.__liveMo) window.__liveMo.disconnect(); window.__liveMo = new MutationObserver(() => { if (live.textContent) window.__said.push(live.textContent); }); window.__liveMo.observe(live, { childList: true, characterData: true, subtree: true }); return 1; })()`);
  const said = () => js('(window.__said || []).slice()');
  const quiet = async (ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { const n = await js(`document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming && a.effect.getTiming().iterations !== Infinity).length`); if (!n) return true; await page.sleep(60); } return false; };
  const overlap = (a, b) => !!a && !!b && a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
  // ---- moving through a run
  const fresh = async (seed, setup = '') => {
    await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.hideTip(); TW.UI.store.remove('run'); __wick.newRun({ seed: '${seed}' }); return 1; })()`);
    await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
    if (setup) await runJs(`${setup}; UI.saveRun(); UI.update(); return 1;`);
    await quiet();
  };
  const toPlay = async () => {
    await js(`document.querySelector('.blind-card.is-current [data-action="start-blind"]').click(), 1`);
    await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
    await quiet();
  };
  const toShop = async (seed) => {
    await fresh(seed);
    await toPlay();
    await runJs('run.blind.target = 1; UI.update(); return 1;');
    await js(`(TW.UI.table.select([__wick.run().blind.hand[0]]), TW.UI.table.playHand(), 1)`);
    await until('the cash-out', (s) => s.screen === 'cashout' && !s.busy, 30000);
    await js(`document.querySelector('[data-action="collect"]').click(), 1`);
    await until('the Shop', (s) => s.screen === 'shop' && !s.busy);
    await quiet();
  };
  const home = () => js(`(() => { TW.UI.closeAllDialogs(); TW.UI.hideTip(); TW.UI.store.remove('run'); TW.UI.setRun(null); TW.UI.show('title'); return 1; })()`);
  const blur = () => js('(document.activeElement && document.activeElement.blur && document.activeElement.blur(), 1)');
  const tabTo = async (test, max = 60) => { for (let i = 0; i < max; i++) { await key('Tab'); if (await js(`(() => { const a = document.activeElement; return !!(a && (${test})(a)); })()`)) return i + 1; } return 0; };

  await page.viewport(1440, 900, false);
  await until('the title', (s) => s.screen === 'title');

  if (on(1)) {
    // ------------------------------------------------------------ 1. R3: plates across a breakpoint, in place
    const cut = (sel) => js(`(() => { const ps = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((p) => p.getClientRects().length); const bad = []; ps.forEach((p) => { const r = p.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(p); const t = rg.getBoundingClientRect(); if (t.width > r.width + 1) bad.push(p.textContent + ' ' + Math.round(t.width) + '>' + Math.round(r.width)); }); return { n: ps.length, cut: bad, px: TW.UI.PX() }; })()`);
    await page.viewport(1440, 900, false);
    await home();
    await js(`(() => { const r = TW.UI.records(); r.discovered = Object.assign({}, r.discovered, { jokers: TW.Content.JOKERS.map((j) => j.id) }); TW.UI.show('collection'); return 1; })()`);
    await page.sleep(400);
    const c3 = await cut('.co-card .plate');
    ok(c3.px === 3 && c3.n >= 100 && !c3.cut.length, `the Collection at 3 px: ${c3.n} Joker plates, none cut`, c3);
    // a keyboard player deep in the grid: a tile in the middle has focus (marked, to tell the same node from a new one)
    const before = await js(`(() => { const items = [...document.querySelectorAll('#coPanel .co-item')]; const n = items[60]; items.forEach((x) => { x.tabIndex = x === n ? 0 : -1; }); n.focus(); n.scrollIntoView({ block: 'center' }); n.__kept = 1; return { co: n.dataset.co, tab: document.querySelector('.co-tab[aria-selected="true"]').dataset.tab }; })()`);
    await page.viewport(1440, 860, false);
    await page.sleep(700);
    const c2 = await cut('.co-card .plate');
    const after = await js(`(() => { const a = document.activeElement; return { co: a && a.dataset.co, same: !!(a && a.__kept), tab: document.querySelector('.co-tab[aria-selected="true"]').dataset.tab }; })()`);
    ok(c2.px === 2 && c2.n === c3.n && !c2.cut.length, `crossing to 2 px: none of the ${c2.n} plates is cut mid-letter (51 were)`, c2);
    ok(after.co === before.co && after.same && after.tab === before.tab, 'and the same tile keeps focus, on the same tab (the screen is not drawn anew)', { before, after });
    await page.viewport(1440, 900, false);
    await page.sleep(500);
    ok(!(await cut('.co-card .plate')).cut.length, 'back at 3 px, whole again');
    // How to play, open across the breakpoint, its Jokers page showing
    await home();
    await page.sleep(200);
    await js(`(TW.UI.openOverlay('help', { page: 2 }), 1)`);
    await page.waitFor('#hpPanel .plate');
    await page.sleep(200);
    const h3 = await cut('#hpPanel .plate');
    const tab0 = await js(`document.activeElement && document.activeElement.id`);
    await page.viewport(1440, 860, false);
    await page.sleep(700);
    const h2 = await cut('#hpPanel .plate');
    const st = await state();
    ok(h3.n === 3 && !h3.cut.length && h2.px === 2 && h2.n === 3 && !h2.cut.length && st.dialogs === 1, 'How to play stays open across the breakpoint and its plates are set for 2 px: none cut (2 of 3 were)', { h3, h2, dialogs: st.dialogs });
    ok((await js(`document.activeElement && document.activeElement.id`)) === tab0, 'focus stays on its tab', tab0);
    await js('(TW.UI.closeAllDialogs(), 1)');
    await page.viewport(1440, 900, false);
    await page.sleep(300);
    out.R3 = { c3: c3.n, c2: c2.cut.length, help: h2.cut.length };
  }

  if (on(2)) {
    // ------------------------------------------------------------ 2. R4: the chosen card's tip and the Move pair
    for (const [w, h] of [[1024, 768], [1280, 720], [1366, 768], [1440, 900]]) {
      await page.viewport(w, h, false);
      await page.sleep(300);
      await fresh('REPAIRR4');
      await toPlay();
      await js('(TW.UI.hideTip(), 1)');
      await blur();
      await mouseMove(10, 10);
      await page.sleep(250);
      const n = (await state()).hand.length;
      const c = await boxOf('#hand .card', Math.floor(n / 2));
      const at = { x: c.x, y: c.t + c.h * 0.6 };
      await glide({ x: 10, y: 10 }, at, 8);
      await mouseClick(at.x, at.y);
      await page.sleep(800);
      const tb = await tipBox();
      const btns = await js(`[...document.querySelectorAll('#mover .mv-btn')].map((b) => { const r = b.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, x: r.left + r.width / 2, y: r.top + r.height / 2, dis: b.disabled }; })`);
      const sel = (await state()).selected;
      ok(sel.length === 1 && tb && btns.length === 2, `${w} x ${h}: a click chose the middle card and its tip opened over it`, { sel, tb });
      ok(btns.every((b) => !overlap(tb, b)), `${w} x ${h}: the tip stands clear of both Move arrows (it lay over them)`, { tb, btns });
      const target = btns.find((b) => !b.dis);
      await glide(at, target, 12);
      await page.sleep(400);
      const hit = await js(`(() => { const e = document.elementFromPoint(${target.x}, ${target.y}); return { onButton: !!(e && e.closest('#mover .mv-btn')), onTip: !!(e && e.closest('#tip')) }; })()`);
      const h0 = (await state()).hand.join();
      await mouseClick(target.x, target.y);
      await page.sleep(300);
      const h1 = (await state()).hand.join();
      ok(hit.onButton && !hit.onTip && h1 !== h0, `${w} x ${h}: the first click on Move moves the card (it landed on the tip, and only the second moved it)`, { hit, moved: h1 !== h0 });
      out[`R4@${w}x${h}`] = { tip: tb && [Math.round(tb.t), Math.round(tb.b)], mover: [Math.round(target.t), Math.round(target.b)] };
    }
    await home();
    await page.viewport(1440, 900, false);
  }

  if (on(3)) {
    // ------------------------------------------------------------ 3. R5: dialogs and sheets over a redraw
    await page.viewport(1440, 900, false);
    await page.sleep(200);
    await toShop('REPAIRR5');
    const sheetNow = () => js(`(() => { const h = TW.UI.topDialog(); if (!h) return null; const r = h.el.getBoundingClientRect(), a = document.querySelector('#shop [data-shop-art="0"]').getBoundingClientRect(), p = TW.UI.PX();
      const below = a.bottom + 4 * p + r.height <= innerHeight - 8, top = below ? a.bottom + 4 * p : Math.max(8, a.top - 4 * p - r.height), left = Math.min(Math.max(a.left + a.width / 2 - r.width / 2, 8), innerWidth - r.width - 8);
      return { at: [Math.round(r.left), Math.round(r.top)], want: [Math.round(left), Math.round(top)], centre: [Math.round((innerWidth - r.width) / 2), Math.round((innerHeight - r.height) / 2)], px: p }; })()`);
    // (a) an item's sheet by its art, across a breakpoint
    const art = await boxOf('#shop [data-shop-art="0"]');
    await mouseClick(art.x, art.y);
    await page.sleep(400);
    const s0 = await sheetNow();
    ok(s0 && Math.abs(s0.at[0] - s0.want[0]) <= 1 && Math.abs(s0.at[1] - s0.want[1]) <= 1, 'a Shop item\'s sheet opens by its art', s0);
    await page.viewport(1440, 860, false);
    await page.sleep(1000);
    const s1 = await sheetNow();
    ok(s1 && s1.px === 2 && Math.abs(s1.at[0] - s1.want[0]) <= 1 && Math.abs(s1.at[1] - s1.want[1]) <= 1, 'across the breakpoint (the Shop drawn anew under it) the sheet stays by its art (it jumped to the screen\'s centre)', s1);
    await key('Escape');
    await page.sleep(300);
    const a1 = await active();
    ok(a1 && a1.art === '0' && !a1.inDialog, 'Esc hands focus back to the item\'s art (it fell to the page)', a1);
    // (b) Pause from Reroll, then from the column's Options, across a breakpoint each
    for (const [opener, label] of [['[data-action="reroll"]', 'Reroll'], ['.r-btns [data-action="open-options"]', 'the column\'s Options']]) {
      await js(`(TW.UI.focusQuiet(document.querySelector('${opener}')), 1)`);
      if (opener.includes('options')) { await key('Enter'); } else { await key('Escape'); }
      await page.sleep(300);
      const d = (await state()).dialogs;
      const px0 = await js('TW.UI.PX()');
      await page.viewport(1440, px0 === 2 ? 900 : 860, false);
      await page.sleep(1000);
      await key('Escape');
      await page.sleep(300);
      const a2 = await js(`(() => { const a = document.activeElement; return { body: a === document.body, match: !!(a && a.matches('${opener}')), inDialog: !!(a && a.closest('#dialogs')), dialogs: TW.UI.topDialog() ? 1 : 0 }; })()`);
      ok(d === 1 && a2.dialogs === 0 && a2.match && !a2.body, `Pause opened from ${label}, a breakpoint, then Esc: focus is back on ${label} (it fell to the page)`, { d, a2 });
    }
    await home();
    await page.viewport(1440, 900, false);
  }

  if (on(4)) {
    // ------------------------------------------------------------ 4. R6: Esc after Pause opens no tip
    await page.viewport(1440, 900, false);
    await page.sleep(200);
    await fresh('REPAIRR6');
    await toPlay();
    await mouseMove(720, 160);
    await blur();
    const tabs = await tabTo((a) => a.matches('#hand .card'));
    await page.sleep(150);
    const card = await active();
    const t0 = await tipBox();
    ok(tabs > 0 && card.uid && card.ring && t0, 'Tab reaches a hand card, ring showing, its tip open', { tabs, card, t0 });
    const step = async () => { await key('Escape'); await page.sleep(250); const a = await active(); return { dialogs: (await state()).dialogs, tip: !!(await tipBox()), uid: a.uid, ring: a.ring }; };
    const e1 = await step();
    const e2 = await step();
    const e3 = await step();
    const e4 = await step();
    ok(!e1.tip && !e1.dialogs && e2.dialogs === 1, 'Esc closes the tip, the next opens Pause', { e1, e2 });
    ok(!e3.dialogs && e3.uid === card.uid && e3.ring && !e3.tip, 'Esc closes Pause: focus back on the card, ring showing, no tip (its tip popped)', e3);
    ok(e4.dialogs === 1, 'and the next Esc opens Pause again (it only closed that tip)', e4);
    await js('(TW.UI.closeAllDialogs(), TW.UI.hideTip(), 1)');
    await home();
  }

  if (on(5)) {
    // ------------------------------------------------------------ 5. Q1: a tap on a pinned tip
    const staged = `Cn.JOKERS.filter((j) => j.rarity === 'common').slice(0, 3).forEach((j) => E.addJoker(run, j.id)); run.consumables = [{ uid: 'k' + run.nextUid++, kind: 'tarot', id: Cn.TAROTS[0].id }, { uid: 'k' + run.nextUid++, kind: 'planet', id: Cn.PLANETS[0].id }]`;
    for (const [w, h] of [[844, 390], [360, 640]]) {
      await page.viewport(w, h, true);
      await page.sleep(300);
      await fresh('REPAIRQ1', staged);
      const st = await boxOf('.blind-card.is-current [data-action="start-blind"]');
      await tap(st.x, st.y);
      await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
      await quiet();
      const c1 = await boxOf('#hand .card', 1);
      await tap(c1.l + 8, c1.t + 20);
      await page.sleep(300);
      const s0 = await state();
      // a long-press pins a tip: the Tarot's (over Play hand on a landscape phone), a card's on an upright phone
      const pressAt = w > h ? await boxOf('.jk[data-consumable-uid]', 0) : await boxOf('#hand .card', 2);
      await longPress(w > h ? pressAt.x : pressAt.l + 8, w > h ? Math.min(pressAt.y, pressAt.t + 30) : pressAt.t + 20);
      await page.sleep(300);
      const tb = await tipBox();
      const pinned = await js('!!document.querySelector("#tip") && !document.querySelector("#tip").hidden');
      // tap the tip where it lies over a control: Play hand, a Move arrow, a card ... else its centre
      const spot = await js(`(() => { const t = document.querySelector('#tip').getBoundingClientRect(); const ctl = [...document.querySelectorAll('[data-action="play-hand"], #mover .mv-btn, #hand .card, [data-action="discard"]')].map((b) => b.getBoundingClientRect()).find((r) => { const x = r.left + r.width / 2, y = r.top + r.height / 2; return x > t.left + 4 && x < t.right - 4 && y > t.top + 4 && y < t.bottom - 4; });
        return ctl ? { x: ctl.left + ctl.width / 2, y: ctl.top + ctl.height / 2, over: true } : { x: t.left + t.width / 2, y: t.top + t.height / 2, over: false }; })()`);
      await listen();
      await tap(spot.x, spot.y);
      await page.sleep(500);
      const s1 = await state();
      ok(pinned && tb, `${w} x ${h}: a long-press pins a tip`, { tb });
      ok(!(await tipBox()) && s1.screen === 'play' && !s1.dialogs && s1.handsLeft === s0.handsLeft && s1.discardsLeft === s0.discardsLeft && s1.hand.join() === s0.hand.join() && s1.selected.join() === s0.selected.join(), `${w} x ${h}: a tap on it${spot.over ? ', where it lies over a control,' : ''} closes it and does nothing else (it played the hand, or moved the chosen card)`, { spot, before: { h: s0.handsLeft, sel: s0.selected }, after: { screen: s1.screen, dialogs: s1.dialogs, h: s1.handsLeft, sel: s1.selected, moved: s1.hand.join() !== s0.hand.join() }, said: await said() });
      // and the next tap works as a tap
      const c3 = await boxOf('#hand .card', 3);
      await tap(c3.l + 8, c3.t + 20);
      await page.sleep(300);
      ok((await state()).selected.length === s0.selected.length + 1, `${w} x ${h}: the next tap chooses a card as ever`);
    }
    await home();
    await page.viewport(1440, 900, false);
  }

  if (on(7)) {
    // ------------------------------------------------------------ 7. Q3: S keeps focus on the card
    for (const [w, h] of [[1440, 900], [1024, 768]]) {
      await page.viewport(w, h, false);
      await page.sleep(200);
      await fresh('REPAIRQ3');
      await toPlay();
      await mouseMove(720, 160);
      await blur();
      const tabs = await tabTo((a) => a === document.querySelectorAll('#hand .card')[1]);
      await key(' ');
      await page.sleep(150);
      const s0 = await state();
      const mode0 = await js('__wick.run().sortMode');
      const card = await active();
      await key('s');
      await page.sleep(250);
      const a1 = await active();
      const mode1 = await js('__wick.run().sortMode');
      ok(tabs > 0 && s0.selected.length === 1 && mode1 !== mode0 && a1.uid === card.uid && a1.ring, `${w} x ${h}: S sorts the hand and focus stays on the chosen card, ring showing (it fell to the page)`, { card, a1, mode0, mode1 });
      await key('Enter');
      await page.sleep(250);
      const s1 = await state();
      ok(s1.screen === 'play' && s1.handsLeft === s0.handsLeft && s1.selected.length === 0, `${w} x ${h}: Enter then puts the card back and plays nothing (it played the hand)`, { h0: s0.handsLeft, h1: s1.handsLeft, sel: s1.selected });
    }
    await home();
    await page.viewport(1440, 900, false);
  }

  if (on(8)) {
    // ------------------------------------------------------------ 8. Q4: unlocks said once, after the result
    await page.viewport(1440, 900, false);
    await page.sleep(200);
    await js(`(() => { const cur = TW.UI.records(), f = TW.Engine.defaultRecords(); Object.keys(cur).forEach((k) => { delete cur[k]; }); Object.assign(cur, f); TW.UI.saveRecords(); return 1; })()`);
    await fresh('REPAIRQ4', `run.ante = 8; run.blindStatus = { '8-0': 'cleared', '8-1': 'cleared' }; run.blindIndex = 2`);
    await listen();
    await toPlay();
    const atStart = await said();
    await listen();
    await runJs('run.blind.target = 1; UI.update(); return 1;');
    await blur();
    await key('1'); await key('Enter');
    await until('the cash-out or the win', (s) => ['cashout', 'win'].includes(s.screen) && !s.busy, 30000);
    if ((await state()).screen === 'cashout') { await js(`document.querySelector('[data-action="collect"]').click(), 1`); await until('the win', (s) => s.screen === 'win', 20000); }
    await page.sleep(400);
    const lines = await said();
    const end = lines.find((t) => /You win!/.test(t)) || '';
    const m = /Unlocked: (.+?)\.(?:\s|$)/.exec(end.slice(end.indexOf('You win!')));
    const names = m ? m[1].split(/, | and /) : [];
    const all = lines.join(' ');
    ok(end && names.length >= 2, 'the win\'s line says the run\'s unlocks after "You win!"', { lines });
    ok(!/Unlocked:/.test(end.slice(0, end.indexOf('You win!'))), 'no unlock is said ahead of the score and "You win!" (two were)', end);
    ok(names.every((n) => all.split(n).length === 2), 'each unlock is said once at the win (each was said twice in one line)', { names, lines });
    // each "Unlocked: <name>" ends with its own full stop, before the next unlock or the Blind's own line
    const mid = atStart.join(' ');
    const segs = mid.split('Unlocked: ').slice(1);
    ok(segs.length >= 1 && segs.every((s) => s.includes('.') && !/started|Target/.test(s.split('.')[0])), 'the unlocks said mid-run (the Decks a best Ante opens) are sentences, each ending with a full stop (they ran together into "... The Lid started")', { mid });
    out.Q4 = { end, mid };
    await home();
  }

  if (on(9)) {
    // ------------------------------------------------------------ 9. Q5: the chosen card's Seal and the Move pair
    for (const [w, h, m] of [[360, 640, true], [375, 667, true], [390, 844, true], [844, 390, true], [932, 430, true], [667, 375, true], [720, 450, false]]) {
      await page.viewport(w, h, m);
      await page.sleep(250);
      await fresh('REPAIRQ5');
      await toPlay();
      await runJs(`const seals = Cn.SEALS.map((s) => s.id); run.blind.hand.forEach((u, i) => { const c = E.getCard(run, u); c.seal = seals[i % seals.length]; }); UI.table.select([]); UI.update(); return 1;`);
      await page.sleep(100);
      const r = await js(`(() => {
        const run = __wick.run(), rows = [];
        run.blind.hand.forEach((u, i) => {
          TW.UI.table.select([u]);
          const cards = [...document.querySelectorAll('#hand .card')], card = cards[i], b = card.querySelector('.seal-badge'), mv = document.querySelector('#mover');
          const br = b.getBoundingClientRect(), parts = [...mv.querySelectorAll('.btn, .mv-lbl')].map((p) => p.getBoundingClientRect());
          let cov = 0; parts.forEach((p) => { cov += Math.max(0, Math.min(br.right, p.right) - Math.max(br.left, p.left)) * Math.max(0, Math.min(br.bottom, p.bottom) - Math.max(br.top, p.top)); });
          // a 5 x 5 grid over the badge: points where the Move pair or a later card lies over it (the badge itself takes no
          // pointer, so a point above the card's edge finds what is behind: the room, which hides nothing)
          let grid = 0; for (let a = 0; a < 5; a++) for (let d = 0; d < 5; d++) { const e = document.elementFromPoint(br.left + (a + 0.5) * br.width / 5, br.top + (d + 0.5) * br.height / 5); if (e && (e.closest('#mover') || cards.slice(i + 1).some((c) => c.contains(e)))) grid++; }
          // and the tabs of the cards at rest stay clear of the pair too
          const rest = cards.filter((c, k) => k !== i).map((c) => c.querySelector('.seal-badge')).filter(Boolean).map((x) => x.getBoundingClientRect());
          const restCov = rest.reduce((s, q) => s + parts.reduce((t, p) => t + Math.max(0, Math.min(q.right, p.right) - Math.max(q.left, p.left)) * Math.max(0, Math.min(q.bottom, p.bottom) - Math.max(q.top, p.top)), 0), 0);
          rows.push({ i, mover: !mv.hidden, share: Math.round(cov / (br.width * br.height) * 100), hidden: grid, rest: Math.round(restCov), inScreen: br.top >= 0 && br.left >= 0 && br.right <= innerWidth });
        });
        TW.UI.table.select([]);
        return { fanned: document.querySelector('#hand').classList.contains('is-fanned'), rows };
      })()`);
      const worst = r.rows.reduce((a, x) => (x.share > a.share || x.hidden > a.hidden ? x : a), r.rows[0]);
      ok(r.rows.every((x) => x.mover && x.share === 0 && x.hidden === 0 && x.inScreen), `${w} x ${h}${r.fanned ? ' (fanned)' : ''}: every chosen card's Seal shows whole, clear of the Move pair (it hid up to 71 % at 360 x 640)`, r.rows);
      ok(r.rows.every((x) => x.rest === 0), `${w} x ${h}: and no other card's Seal tab lies under the pair`, r.rows);
      out[`Q5@${w}x${h}`] = { worst: worst.share, fanned: r.fanned };
    }
    await home();
    await page.viewport(1440, 900, false);
  }

  if (on(10)) {
    // ------------------------------------------------------------ 10. Q6: 720 x 450, the Joker rack's scroller and the ring
    await page.viewport(720, 450, false);
    await page.sleep(250);
    await fresh('REPAIRQ6', `Cn.JOKERS.filter((j) => j.rarity === 'common').slice(0, 4).forEach((j) => E.addJoker(run, j.id))`);
    await mouseMove(5, 300);
    await blur();
    const tabs = await tabTo((a) => a.matches('#jokerRack .jk'));
    const rings = [];
    for (let k = 0; k < 4; k++) {
      if (k) await key('Tab');
      await page.sleep(200);
      rings.push(await js(`(() => { const a = document.activeElement, sc = document.getElementById('jokerRack'); if (!a || !a.matches('#jokerRack .jk')) return { onJoker: false }; const ar = a.getBoundingClientRect(), sr = sc.getBoundingClientRect(); const box = { l: sr.left + sc.clientLeft, t: sr.top + sc.clientTop, r: sr.left + sc.clientLeft + sc.clientWidth, b: sr.top + sc.clientTop + sc.clientHeight }; const cs = getComputedStyle(a); const reach = parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset);
        return { onJoker: true, ring: a.matches(':focus-visible'), reach, cut: { top: Math.round(box.t - (ar.top - reach)), left: Math.round(box.l - (ar.left - reach)), right: Math.round(ar.right + reach - box.r), bottom: Math.round(ar.bottom + reach - box.b) } }; })()`));
    }
    ok(tabs > 0 && rings.every((x) => x.onJoker && x.ring && x.reach >= 5), 'Tab walks the four Jokers, ring showing', rings);
    ok(rings.every((x) => x.cut.top <= 0 && x.cut.left <= 0 && x.cut.right <= 0 && x.cut.bottom <= 0), 'each Joker\'s ring lies inside the rack\'s scroller on all four sides (its top was cut on every Joker, its left on the first)', rings);
    out.Q6 = rings.map((x) => x.cut);
    await home();
  }

  if (on(11)) {
    // ------------------------------------------------------------ 11. Q8: 720 x 450, the empty Joker rack
    await page.viewport(720, 450, false);
    await page.sleep(250);
    await fresh('REPAIRQ8');
    const rack = await js(`(() => { const r = document.getElementById('jokerRack'); return { jokers: __wick.run().jokers.length, overflows: r.scrollWidth > r.clientWidth + 1, tabindex: r.getAttribute('tabindex') }; })()`);
    await mouseMove(5, 300);
    await blur();
    const stops = [];
    for (let i = 0; i < 8; i++) { await key('Tab'); stops.push(await js(`(() => { const a = document.activeElement; return a ? (a.id || a.dataset.action || a.className.split(' ')[0]) : null; })()`)); }
    ok(rack.jokers === 0 && rack.overflows, 'no Joker: the five empty slots overflow the rack, a scroller', rack);
    ok(!stops.includes('jokerRack') && stops.includes('start-blind'), 'Tab passes the empty rack by (it was an unnamed stop) and reaches Play', stops);
    await home();
    await page.viewport(1440, 900, false);
  }

  if (on(6)) {
    // ------------------------------------------------------------ 6. Q2: storage full, Save and quit (a fresh page after)
    await page.viewport(1440, 900, false);
    await page.sleep(200);
    const fill = await js(`(() => { let n = 0, size = 1 << 20; while (size >= 16) { try { localStorage.setItem('filler' + n, 'x'.repeat(size)); n++; } catch (e) { size >>= 1; } } let probe = 'ok'; try { localStorage.setItem('probe', 'y'); } catch (e) { probe = e.name; } return { probe }; })()`);
    await listen();
    await fresh('REPAIRQ2');
    await toPlay();
    await blur();
    await key('1'); await key('Enter');
    await until('the hand played', (s) => s.screen === 'play' && !s.busy && s.handsLeft < 4, 20000);
    const unsaved = await js('TW.UI.store.unsaved()');
    await key('Escape');
    await page.waitFor('#dialogs [data-action="save-quit"]');
    await page.sleep(150);
    await listen();
    const sq = await boxOf('#dialogs [data-action="save-quit"]');
    await mouseClick(sq.x, sq.y);
    await until('the title', (s) => s.screen === 'title');
    await page.sleep(200);
    const lines = await said();
    const toasts = await js(`[...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent.trim())`);
    ok(unsaved.some((k) => /ember:run/.test(k)), 'storage is full: the run lives only in memory', { fill, unsaved });
    ok(lines.some((t) => /could not be saved/.test(t)) && !lines.some((t) => /Run saved/.test(t)) && toasts.some((t) => /could not be saved/.test(t)) && !toasts.some((t) => /Run saved/.test(t)), 'Save and quit says the run could not be saved and lasts until the page closes (it said "Run saved")', { lines, toasts });
    ok(await js(`!!document.querySelector('[data-action="continue"]')`), 'and Continue still brings it back in this session');
    await js('(localStorage.clear(), 1)');
    await page.goto(url, { wait: 600 });
    await until('the title again', (s) => s.screen === 'title');
  }

  if (on(12)) {
    // ------------------------------------------------------------ 12. R1, at real speed: the Sort pair after a deal
    const u = new URL(url);
    u.searchParams.delete('test');
    await page.goto(u.toString(), { wait: 700 });
    await until('the title (real speed)', (s) => s.screen === 'title');
    ok(!(await js('TW.UI.TEST')), 'section 12 runs at real speed');
    await js(`(() => { TW.UI.setSetting('muted', true); TW.UI.setSetting('speed', 2); return 1; })()`);
    const ctl = () => js(`(() => { const q = (a) => document.querySelector('[data-action="' + a + '"]'); return { rank: q('sort-rank').disabled, suit: q('sort-suit').disabled, busy: document.body.dataset.busy, mode: __wick.run().sortMode, discards: __wick.run().blind.discardsLeft, hands: __wick.run().blind.handsLeft }; })()`);
    for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
      await page.viewport(w, h, m);
      await page.sleep(300);
      const press = (b) => (m ? tap(b.x, b.y) : mouseClick(b.x, b.y));
      const pressCard = async (i) => { const c = await boxOf('#hand .card', i); await (m ? tap(c.l + 8, c.t + 30) : mouseClick(c.l + 8, c.t + 30)); await page.sleep(200); };
      await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); __wick.newRun({ seed: 'REPAIRR1' }); return 1; })()`);
      await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy, 15000);
      await quiet();
      await press(await boxOf('.blind-card.is-current [data-action="start-blind"]'));
      await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0, 15000);
      await quiet();
      await page.sleep(300);
      // a discard and its deal
      await pressCard(0); await pressCard(1);
      const d0 = (await ctl()).discards;
      await press(await boxOf('[data-action="discard"]'));
      await until('the discard and its deal', (s) => s.screen === 'play' && !s.busy && s.discardsLeft < d0, 15000);
      await quiet();
      await page.sleep(500);
      const c1 = await ctl();
      const other1 = c1.mode === 'rank' ? 'sort-suit' : 'sort-rank';
      await press(await boxOf(`[data-action="${other1}"]`));
      await page.sleep(900);
      const c2 = await ctl();
      ok(c1.busy === '0' && !c1.rank && !c1.suit && c2.mode !== c1.mode, `${w} x ${h}, real speed: once the discard's cards have landed, Rank and Suit are on and a ${m ? 'tap' : 'click'} on ${other1 === 'sort-suit' ? 'Suit' : 'Rank'} sorts the hand (they stayed off)`, { c1, c2 });
      if (m) continue;
      // a played hand, its payout and its deal
      await pressCard(0); await pressCard(1);
      const h0 = (await ctl()).hands;
      await press(await boxOf('[data-action="play-hand"]'));
      await until('the payout and its deal', (s) => s.screen !== 'play' || (!s.busy && s.handsLeft < h0), 60000);
      if ((await state()).screen === 'play') {
        await quiet(10000);
        await page.sleep(600);
        const c3 = await ctl();
        const other2 = c3.mode === 'rank' ? 'sort-suit' : 'sort-rank';
        await press(await boxOf(`[data-action="${other2}"]`));
        await page.sleep(900);
        const c4 = await ctl();
        ok(c3.busy === '0' && !c3.rank && !c3.suit && c4.mode !== c3.mode, `${w} x ${h}, real speed: after a played hand's payout and deal, the same`, { c3, c4 });
      } else ok(false, 'the played hand left the table (expected the hand to go on)', await state());
    }
    await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); TW.UI.setRun(null); TW.UI.show('title'); return 1; })()`);
    await page.viewport(1440, 900, false);
  }
  return { checks: checks.length, failed: failed.length, failures: failed, list: checks, out };
}
