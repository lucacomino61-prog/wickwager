// Regression checks for the final pass, part 4 (the small-windows round, 2026-11-25), a tools/cdp.mjs scenario. Run it
// once in test mode; it sets its own window sizes. tests/e2e/windows.mjs is the round's sweep of every screen at every
// size (P1, P2); this file checks what a sweep at rest cannot:
//   1. P3  the two-tone focus ring shows whole on every control the keyboard reaches in the rows that scroll inside
//          themselves (the landscape Shop's row, the Shop's one row on a short window, a pack's options, a Mega pack's
//          row on the narrow 3 px table) and on a pack's dealt hand: Tab walks each screen and, for every control it
//          focuses, no scrolling ancestor and no window edge cuts the ring (5 px out). A control partly out of its row's
//          view is scrolled whole into view as it takes focus (before: a ring cut by 5 px on the landscape Shop's first
//          item, by up to 33 px on an item the row had half in view, 1 px under a pack's Use buttons and 3 px under the
//          dealt hand's outer cards at the window's foot; 720 x 450 and 844 x 390);
//   2. P4  on a short window held wide (1000 x 700, 900 x 650, 800 x 620) the racks stay in reach while a Tarot, Ghost or
//          Planet Pack is open, so a held consumable can be used on the pack's dealt hand and a Joker sold: the racks
//          are shown, a held Tarot's Use works on the dealt hand's chosen cards, and the page does not scroll (before:
//          the racks stepped aside for those packs on every compact window 760 px tall or less);
//   3. a toast on an end screen of the compact layout sits at the top, off the end screen's buttons (from 761 px wide an
//          unlock's toast lay over Endless mode and Title);
//   4. what final agent C fixed after the final shots: the one-row Shop (a compact window under 870 px tall) keeps every
//          Buy at one height beside an item that shows why it can't be bought, and shows that reason whole (a Buy dropped
//          39 px, and "Your consumable slots are full." read "Your consumabl…"); on a short window held wide Overview and
//          Options sit at the column's foot and a toast sits under the racks, off the hand, the Shop's items and a pack's
//          head, cards and dealt hand (it lay over the hand and the Buy row); the cash-out's Blind score takes the face a
//          redraw gives after the window turns or narrows inside the compact layouts (it ran 3 px out of its panel); the
//          longest Boss rule shows whole on its Blind from 600 px wide on a short upright window (three lines cut it).
// cdp.mjs fails the run on any console error or exception. ONLY=1,2 picks sections; SOFT=1 reports instead of failing.
// Usage: node tools/cdp.mjs run "http://localhost:5220/index.html?test=1&seed=PARTFOUR" tests/e2e/part4.mjs
export default async function part4(page) {
  const js = (e) => page.eval(e);
  const runJs = (body) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${body} })()`);
  const state = async () => JSON.parse(await js('JSON.stringify(__wick.state())'));
  const SOFT = process.env.SOFT === '1';
  const notes = [];
  const fail = (m, x) => { const t = m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 2000) : ''); if (SOFT) { notes.push(t); return; } throw new Error(t); };
  const checks = [];
  const ok = (cond, msg, x) => { if (!cond) fail(msg, x); else checks.push(msg); };
  const until = async (what, f, ms = 15000) => { const end = Date.now() + ms; let s; while (Date.now() < end) { s = await state(); if (f(s)) return s; await page.sleep(40); } throw new Error('timed out: ' + what + ' ' + JSON.stringify(s).slice(0, 300)); };
  const ONLY = String(process.env.ONLY || '').split(',').filter(Boolean).map(Number);
  const on = (n) => !ONLY.length || ONLY.includes(n);
  const out = {};
  const tab = async () => {
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  };
  // the focused control's ring (outline width plus offset) against every ancestor that clips, and the window's edges
  const ringCut = () => js(`(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const cs = getComputedStyle(a), reach = (parseFloat(cs.outlineWidth) || 0) + (parseFloat(cs.outlineOffset) || 0);
    const id = a.id || (a.dataset.action ? a.dataset.action + (a.dataset.index != null ? '#' + a.dataset.index : '') : '') || (a.dataset.shopArt != null ? 'art' + a.dataset.shopArt : '') || (a.dataset.optArt != null ? 'opt' + a.dataset.optArt : '') || (a.dataset.uid ? 'card ' + a.dataset.uid : '') || (a.dataset.jokerUid ? 'joker' : '') || a.className.split(' ')[0];
    if (cs.outlineStyle === 'none' || reach <= 0) return { id, noRing: true };
    const r = a.getBoundingClientRect(), ring = { l: r.left - reach, t: r.top - reach, r: r.right + reach, b: r.bottom + reach };
    let worst = 0, by = null;
    const edge = { l: -ring.l, t: -ring.t, r: ring.r - innerWidth, b: ring.b - innerHeight };
    for (const [k, v] of Object.entries(edge)) if (v > worst + 0.5) { worst = v; by = 'window ' + k; }
    for (let p = a.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const q = p.getBoundingClientRect(), box = { l: q.left + p.clientLeft, t: q.top + p.clientTop, r: q.left + p.clientLeft + p.clientWidth, b: q.top + p.clientTop + p.clientHeight };
      const c = { l: s.overflowX !== 'visible' ? box.l - ring.l : 0, r: s.overflowX !== 'visible' ? ring.r - box.r : 0, t: s.overflowY !== 'visible' ? box.t - ring.t : 0, b: s.overflowY !== 'visible' ? ring.b - box.b : 0 };
      for (const [k, v] of Object.entries(c)) if (v > worst + 0.5) { worst = v; by = (p.id || p.className.split(' ')[0]) + ' ' + k; }
    }
    return { id, cut: Math.round(worst), by };
  })()`);
  const walk = async (n, label) => {
    const cuts = [];
    let seen = 0;
    for (let i = 0; i < n; i++) {
      await tab(); await page.sleep(50);
      const m = await ringCut();
      if (!m) continue;
      seen++;
      if (m.cut > 0) cuts.push(m);
    }
    out[label] = { seen, cuts };
    return cuts;
  };
  const fresh = async (seed) => {
    await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); __wick.newRun({ seed: '${seed}' }); return 1; })()`);
    await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
    await runJs(`Cn.JOKERS.filter((j) => j.rarity === 'common').slice(0, 4).forEach((j) => E.addJoker(run, j.id)); run.consumables = [{ uid: 'k' + run.nextUid++, kind: 'tarot', id: Cn.TAROTS.find((t) => Array.isArray(t.select) && t.select[1] >= 1 && t.select[0] <= 1).id }]; UI.saveRun(); UI.update(); return 1;`);
  };
  const toShop = async (voucher) => {
    if (voucher) await runJs(`if (!run.vouchers.includes('${voucher}')) run.vouchers.push('${voucher}'); UI.saveRun(); UI.update(); return 1;`);
    await js(`document.querySelector('.blind-card.is-current [data-action="start-blind"]').click(), 1`);
    await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
    await runJs('run.blind.target = 1; UI.update(); UI.table.select([run.blind.hand[0]]); UI.table.playHand(); return 1;');
    await until('the cash-out', (s) => s.screen === 'cashout' && !s.busy, 30000);
    await js(`document.querySelector('#dialogs [data-action="collect"]').click(), 1`);
    await until('the Shop', (s) => s.screen === 'shop' && !s.busy);
    await runJs('run.money = 99; UI.update(); return 1;');
  };
  const openPack = async (packId) => {
    await runJs(`const k = run.shop.items.findIndex((x) => x && x.slot === 'pack'); const row = Cn.PACKS.find((p) => p.id === '${packId}'); Object.assign(run.shop.items[k], { kind: 'pack', id: row.id, price: row.price, size: row.size, sold: false }); run.money = Math.max(run.money, 40); UI.update(); return 1;`);
    const i = await runJs(`return run.shop.items.findIndex((x) => x && x.slot === 'pack' && !x.sold);`);
    await js(`document.querySelector('[data-action="buy"][data-index="${i}"]').click(), 1`);
    await until(`the ${packId}`, (s) => s.screen === 'pack' && !s.busy);
  };
  const skipPack = async () => {
    await js(`document.querySelector('[data-action="pack-skip"]').click(), 1`);
    await until('the Shop again', (s) => s.screen === 'shop' && !s.busy);
  };
  const blur = () => js('(document.activeElement && document.activeElement.blur(), 1)');

  await page.viewport(1440, 900, false);
  await until('the title', (s) => s.screen === 'title');

  if (on(1)) {
    // ------------------------------------------------------------ 1. P3: whole focus rings in the rows that scroll
    for (const [w, h] of [[720, 450], [844, 390], [900, 650], [700, 620], [600, 800], [1024, 900]]) {
      const at = `${w}x${h}`;
      await page.viewport(w, h, false);
      await page.sleep(150);
      await fresh('PARTFOUR');
      await toShop('spinnerrack');
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
      await blur();
      // Night Market's seven items: a row that scrolls sideways on the narrower windows
      const shopCuts = await walk(34, `shop@${at}`);
      ok(!shopCuts.length, `${at}: the Shop's focus rings show whole as Tab walks it (Night Market's seven items)`, shopCuts);
      for (const packId of ['tarotmega', 'cardmega']) {
        await openPack(packId);
        await blur();
        const packCuts = await walk(30, `${packId}@${at}`);
        ok(!packCuts.length, `${at}: a ${packId === 'tarotmega' ? 'Mega Tarot Pack\'s options and dealt hand' : 'Mega Card Pack\'s options'} keep their focus rings whole`, packCuts);
        await skipPack();
      }
      // a control partly out of its row's view comes whole into view as it takes focus
      const rowCheck = await js(`(() => {
        const row = [...document.querySelectorAll('.shop-grid')].find((g) => getComputedStyle(g).overflowX !== 'visible' && g.scrollWidth > g.clientWidth + 1);
        if (!row) return { scrolls: false };
        row.scrollLeft = 0;
        const box = row.getBoundingClientRect();
        const buys = [...row.querySelectorAll('[data-action="buy"]')];
        const half = buys.find((b) => { const r = b.getBoundingClientRect(); return r.left < box.right - 2 && r.right > box.right + 2; });
        return { scrolls: true, half: half ? half.dataset.index : null };
      })()`);
      if (rowCheck.scrolls && rowCheck.half != null) {
        // focus the button before it with the mouse's input state cleared, then Tab onto the half-shown one
        await js(`(() => { const b = document.querySelector('[data-action="buy"][data-index="${rowCheck.half}"]'); const all = [...document.querySelectorAll('#shop button')]; const prev = all[all.indexOf(b) - 1]; prev.focus({ preventScroll: true }); return 1; })()`);
        await tab(); await page.sleep(80);
        const m = await ringCut();
        ok(m && m.id === `buy#${rowCheck.half}` && m.cut === 0, `${at}: a Buy the row had half in view is scrolled whole into view, ring and all, as Tab reaches it`, m);
      } else checks.push(`${at}: no item of the Shop's row stood half in view (${JSON.stringify(rowCheck)})`);
    }
    await page.viewport(1440, 900, false);
  }

  if (on(2)) {
    // ------------------------------------------------------------ 2. P4: the racks stay in reach during a pack on a short wide window
    for (const [w, h] of [[1000, 700], [900, 650], [800, 620]]) {
      const at = `${w}x${h}`;
      await page.viewport(w, h, false);
      await page.sleep(150);
      await fresh('PARTFOUR');
      await toShop();
      for (const packId of ['tarotmega', 'ghostmega', 'planetmega']) {
        await openPack(packId);
        const r = await js(`(() => { const racks = document.querySelector('#racks'), cons = document.querySelector('#racks [data-consumable-uid]'), jk = document.querySelector('#racks [data-joker-uid]'); const vis = (n) => { if (!n || !n.getClientRects().length) return false; const q = n.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight && q.left >= 0 && q.right <= innerWidth; }; return { racks: getComputedStyle(racks).display, cons: vis(cons), joker: vis(jk), pageY: document.scrollingElement.scrollHeight - innerHeight }; })()`);
        ok(r.racks !== 'none' && r.cons && r.joker && r.pageY <= 1, `${at}: a ${packId} keeps the racks in reach (a held consumable and the Jokers in view) and the page still`, r);
        if (packId === 'tarotmega') {
          // the held Tarot acts on the pack's dealt hand: choose the cards it asks for and use it from the rack
          const used = await runJs(`const k = run.consumables[0], row = Cn.TAROTS.find((t) => t.id === k.id); UI.shop.select(run.pack.hand.slice(0, Math.max(1, row.select[0]))); const before = run.consumables.length; const can = E.canUseConsumable(run, k.uid, UI.shop.selected()); return { can: can.ok, why: can.error || '', before };`);
          ok(used.can, `${at}: the held Tarot can be used on the Mega Tarot Pack's dealt hand`, used);
          await js(`(() => { const n = document.querySelector('#racks [data-consumable-uid]'); n.click(); return 1; })()`);
          await page.sleep(150);
          const sheet = await js(`!!document.querySelector('#dialogs [data-action="use-consumable"]')`);
          ok(sheet, `${at}: a click on the held Tarot in its rack opens its sheet with Use`);
          await js(`(() => { TW.UI.closeAllDialogs(); return 1; })()`);
          await runJs('UI.shop.select([]); return 1;');
        }
        await skipPack();
      }
    }
    await page.viewport(1440, 900, false);
  }

  if (on(3)) {
    // ------------------------------------------------------------ 3. a toast on a compact end screen sits off its buttons
    for (const [w, h] of [[800, 620], [1000, 700]]) {
      const at = `${w}x${h}`;
      await page.viewport(w, h, false);
      await page.sleep(150);
      await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); __wick.newRun({ seed: 'PARTFOUR' }); return 1; })()`);
      await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
      await runJs(`run.ante = 8; run.blindIndex = 2; UI.refresh(); return 1;`);
      await until('the Boss Blind', (s) => s.screen === 'blind-select' && !s.busy);
      await runJs(`__wick.act('startBlind'); __wick.run().blind.target = 1; return 1;`);
      await runJs(`return __wick.act('playHand', [__wick.run().blind.hand[0]]).ok;`);
      await until('You win!', (s) => s.screen === 'win');
      await js(`TW.UI.toast('Unlocked: a test toast.', 'good'), 1`);
      await page.sleep(100);
      const r = await js(`(() => { const t = document.querySelector('#toasts .toast'), acts = [...document.querySelectorAll('.es-acts .btn')]; if (!t) return { toast: false }; const a = t.getBoundingClientRect(); const over = acts.some((b) => { const q = b.getBoundingClientRect(); return a.left < q.right && a.right > q.left && a.top < q.bottom && a.bottom > q.top; }); return { toast: true, over, top: Math.round(a.top) }; })()`);
      ok(r.toast && !r.over, `${at}: a toast on You win! lies clear of Endless mode and Title`, r);
    }
    await page.viewport(1440, 900, false);
  }

  if (on(4)) {
    // ------------------------------------------------------------ 4. final agent C: the one-row Shop's Buy row, a Boss
    // rule on a short upright window, the band's column foot and toasts, the column's figures after a resize
    const size = async (w, h) => { await page.viewport(w, h, false); await page.sleep(250); };
    // a toast's box against what it must leave clear, and the racks' foot
    const toastOver = (sels) => js(`(() => {
      document.querySelectorAll('#toasts .toast').forEach((n) => n.remove());
      const t = TW.UI.toast('Not enough money.', 'err', 4000), a = t.getBoundingClientRect();
      const hit = (n) => { if (!n.getClientRects().length) return false; const q = n.getBoundingClientRect(); return a.left < q.right && a.right > q.left && a.top < q.bottom && a.bottom > q.top; };
      const hits = ${JSON.stringify(sels)}.filter((s) => [...document.querySelectorAll(s)].some(hit));
      const racks = [...document.querySelectorAll('#racks .rack')].filter((n) => n.getClientRects().length).map((n) => n.getBoundingClientRect().bottom);
      t.remove();
      return { top: Math.round(a.top), bottom: Math.round(a.bottom), racksFoot: racks.length ? Math.round(Math.max(...racks)) : null, hits };
    })()`);
    await size(1440, 900);
    await fresh('PARTFOUR');
    await toShop();
    // a Joker that can be bought beside a Tarot that can't (the consumable slots are full: a reason of three lines)
    await runJs(`
      const cards = run.shop.items.filter((x) => x && x.slot === 'card');
      const jk = Cn.JOKERS.find((j) => j.rarity === 'common' && !run.jokers.some((x) => x.id === j.id));
      Object.assign(cards[0], { kind: 'joker', id: jk.id, price: jk.cost, edition: null, sold: false });
      Object.assign(cards[1], { kind: 'tarot', id: Cn.TAROTS[0].id, price: 3, edition: null, sold: false });
      run.consumables = [{ uid: 'k' + run.nextUid++, kind: 'tarot', id: Cn.TAROTS[1].id }, { uid: 'k' + run.nextUid++, kind: 'tarot', id: Cn.TAROTS[2].id }];
      run.money = 24; UI.saveRun(); UI.update(); return 1;`);
    const buyRow = () => js(`(() => {
      const top = (si) => Math.round(si.querySelector('[data-action="buy"]').getBoundingClientRect().top);
      const items = [...document.querySelectorAll('#shop .si:not(.is-sold)')];
      const cards = [...document.querySelectorAll('#shop .s-cards .si:not(.is-sold)')].map(top), all = items.map(top);
      const whys = [...document.querySelectorAll('#shop .si-why')].map((w) => ({ text: w.textContent, whole: w.scrollHeight <= w.clientHeight + 1 }));
      return { cards, spread: Math.max(...all) - Math.min(...all), whys, pageY: Math.round(document.scrollingElement.scrollHeight - innerHeight) };
    })()`);
    for (const [w, h] of [[900, 650], [800, 620], [1023, 601], [600, 650], [700, 700]]) {
      await size(w, h);
      const r = await buyRow();
      out[`buyRow@${w}x${h}`] = r;
      ok(r.cards.length === 2 && r.cards[0] === r.cards[1] && r.spread <= 2 && r.whys.length && r.whys.every((x) => x.whole) && r.pageY <= 1,
        `${w}x${h}: the one-row Shop's Buy buttons stand at one height beside an item that shows its reason, which shows whole (it dropped 39 px, and read "Your consumabl…")`, r);
    }
    await size(900, 650);
    const shopToast = await toastOver(['#shop [data-action="buy"]', '#shop .si-art', '#shop .sh-head', '#racks .rack']);
    ok(!shopToast.hits.length && shopToast.top >= shopToast.racksFoot, '900x650: a toast in the Shop sits under the racks, off the items and their Buy buttons', shopToast);
    await openPack('planetnormal');
    const packToast = await toastOver(['.pk-head', '.pk-opt', '#pkDetail', '#racks .rack']);
    ok(!packToast.hits.length && packToast.top >= packToast.racksFoot, '900x650: a toast over a Planet Pack sits under the racks, off the pack\'s head and cards', packToast);
    await skipPack();
    await openPack('tarotnormal');
    const handToast = await toastOver(['.pk-head', '.pk-opt', '#pkDetail', '#hand .card', '#racks .rack']);
    ok(!handToast.hits.length && handToast.top >= handToast.racksFoot, '900x650: a toast over a Tarot Pack\'s dealt hand sits under the racks, off the head\'s column, the options and the hand', handToast);
    await skipPack();
    // the table on a short window held wide: Overview and Options at the column's foot, a toast under the racks
    await size(1440, 900);
    await fresh('PARTFOUR');
    await js(`document.querySelector('.blind-card.is-current [data-action="start-blind"]').click(), 1`);
    await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
    for (const [w, h] of [[900, 650], [1023, 760], [800, 620]]) {
      await size(w, h);
      const foot = await js(`(() => { const col = document.getElementById('col'), b = col.querySelector('.r-btns'); const c = col.getBoundingClientRect(), q = b.getBoundingClientRect(); return { colBottom: Math.round(c.bottom - parseFloat(getComputedStyle(col).paddingBottom)), btnsBottom: Math.round(q.bottom), shown: !!b.getClientRects().length }; })()`);
      ok(foot.shown && Math.abs(foot.colBottom - foot.btnsBottom) <= 1, `${w}x${h}: Overview and Options sit at the column's foot, as on the table`, foot);
      const t = await toastOver(['#hand .card', '.controls .btn', '#racks .rack', '#col .panel']);
      ok(!t.hits.length && t.top >= t.racksFoot, `${w}x${h}: a toast on the table sits under the racks, off the hand and its buttons (it lay over the hand)`, t);
    }
    // the cash-out's Blind score after the window turns and narrows inside the compact layouts: the face a redraw gives
    await size(800, 620);
    await runJs('run.blind.target = 1; run.blind.score = 3770; UI.update(); UI.table.select([run.blind.hand[0]]); UI.table.playHand(); return 1;');
    await until('the cash-out', (s) => s.screen === 'cashout' && !s.busy, 30000);
    const fig = () => js(`(() => { const p = document.querySelector('#col .w-score'), n = p && p.querySelector('#score'); return n ? { w: Math.round(n.getBoundingClientRect().width), panel: p.clientWidth } : null; })()`);
    for (const [w, h] of [[700, 700], [660, 700], [600, 650], [1000, 700]]) {
      await size(w, h);
      const now = await fig();
      await js('(TW.UI.shell.renderCol(), 1)');
      const drawn = await fig();
      ok(now && drawn && now.w === drawn.w && now.w <= now.panel, `${w}x${h}: after a resize the cash-out's Blind score has the face a redraw gives, inside its panel (it kept the face of 800 x 620 and ran out of its panel)`, { now, drawn });
    }
    await js(`document.querySelector('#dialogs [data-action="collect"]') && document.querySelector('#dialogs [data-action="collect"]').click(), 1`);
    await until('the Shop', (s) => s.screen === 'shop' && !s.busy);
    // the longest Boss rule on a short upright window from 600 px wide: four lines on its Blind, whole
    await size(1440, 900);
    await fresh('PARTFOUR');
    await runJs(`const id = Cn.BOSSES.slice().sort((a, b) => b.text.length - a.text.length)[0].id; run.bosses[run.ante] = id; run.blindStatus[run.ante + '-0'] = 'cleared'; run.blindStatus[run.ante + '-1'] = 'cleared'; run.blindIndex = 2; UI.saveRun(); UI.refresh(); return 1;`);
    await until('the Boss Blind select', (s) => s.screen === 'blind-select' && !s.busy && s.blindIndex === 2);
    for (const [w, h] of [[600, 650], [620, 700], [600, 620]]) {
      await size(w, h);
      const r = await js(`(() => { const p = document.querySelector('.blind-card.is-current .bc-rule p'), b = document.querySelector('.blind-card.is-current [data-action="start-blind"]'); const q = b.getBoundingClientRect(); return { whole: p.scrollHeight <= p.clientHeight + 1, gap: Math.round(q.top - p.getBoundingClientRect().bottom), playIn: q.bottom <= innerHeight, pageY: Math.round(document.scrollingElement.scrollHeight - innerHeight) }; })()`);
      ok(r.whole && r.gap >= 0 && r.playIn && r.pageY <= 1, `${w}x${h}: the longest Boss rule shows whole on its Blind, over Play (it lost its last word at three lines)`, r);
    }
    await size(1440, 900);
  }

  return { checks: checks.length, notes, out };
}
