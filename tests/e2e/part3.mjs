// Regression checks for the final pass, part 3 (UI fixes F1 to F6, 2026-11-25), a tools/cdp.mjs scenario. Run it in
// test mode; it sets its own window sizes. It checks:
//   1. F1  the Blind select's raised Blind says Play (SPEC 6.1), named "Play the Small Blind, target 300" (the Boss
//          Blind too), at 1440 x 900, 844 x 390 and 390 x 844, and no Blind select button says the word of the
//          originality list (tests/local/originality.json: local-only, so without it that one
//          check is skipped and the result's skipped list says so);
//   2. F2, F3  a Ghost Pack and a Mega Tarot Pack with their dealt hand on a landscape phone (844 x 390, 932 x 430,
//          667 x 375) and on a wide compact window 760 px tall or less (1000 x 700, 900 x 650, 800 x 620, 700 x 700):
//          every Tarot and Spectral reading whole on a plate that never scrolls (no Joker and three Jokers, 0 to 2
//          cards chosen), no page scroll, the head clear of the racks, the whole hand in view and every card tappable,
//          no Use button covered, the plate clear of the options and the hand; a Use button a Mega pack's row hides is
//          a sideways scroll away. Before: 22 readings cut on the landscape phones, 4 and a page scroll of 26 to 106 px
//          on the wide windows (the hand partly below the fold at 900 x 650 and 800 x 620). A Mega Planet Pack (its
//          bar takes a second row for the hand panel) no longer scrolls the page on those wide windows (33 px at
//          800 x 620);
//   3. F5  the open pack drawn anew across a breakpoint keeps keyboard focus (a Use button, a card of the hand), and a
//          breakpoint crossed while the game is busy still draws the name plates for the new pixel size once it is
//          free (the redraw was dropped);
//   4. F6  at 667 x 375 the fanned hand's strips (30 px: no room for more at that width, see 40-table.css) are each
//          tappable and at least 24 px (WCAG 2.5.8), every Seal tab whole on its strip (the next card hid part of
//          each), with the Move pair, Play hand, Sort and Discard whole and in reach;
//   5. F2, F3  while the racks step aside for a pack's dealt hand (844 x 390, 700 x 700), a Joker that reacts to the
//          Tarot card used is announced and pops nothing at the screen's top-left corner (its note popped there);
//   6. at real speed (1440 x 900, 800 x 620): a change of the table's main area (Play at the Blind select) lays its
//          fading copy over the main area in place, and the page never grows (the copy fell into the page's flow
//          under the table and made the page a screen taller while it faded);
//   7. added by the final agent of part 3: a Planet Pack (Normal and Mega) on a landscape phone (844 x 390,
//          932 x 430, 667 x 375) keeps the racks, a Joker and a consumable in reach, as a short window held wide does
//          since part 4 (800 x 620, 900 x 650: the landscape layout, P4), while a compact window held upright (700 x 700)
//          still sends them aside (F3's block matched the landscape phones too and sent the racks
//          aside there for a Planet Pack as well, so no Joker or consumable could be seen, sold or used while it was
//          open); and the pack's name shows whole in its pill (a Jumbo or Mega Card, Planet or Joker Pack's name ran out
//          of its 56 art px column on a landscape phone and under the first card: "MEGA PLANET PA"). No page scroll and
//          no Use or Pick button covered at any of them. Section 7 runs before 6, which leaves test mode.
// cdp.mjs fails the run on any console error or exception.
// Usage: node tools/cdp.mjs run "http://localhost:5200/index.html?test=1&seed=PARTTHR1" tests/e2e/part3.mjs
import { ORIGINALITY, skipOriginality } from '../local-data.mjs';

export default async function part3(page, { url }) {
  const skipped = [];
  const js = (e) => page.eval(e);
  const runJs = (body) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${body} })()`);
  const state = async () => JSON.parse(await js('JSON.stringify(__wick.state())'));
  const fail = (m, x) => { throw new Error(m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 1500) : '')); };
  const checks = [];
  const ok = (cond, msg, x) => { if (!cond) fail(msg, x); checks.push(msg); };
  const until = async (what, f, ms = 15000) => { const end = Date.now() + ms; let s; while (Date.now() < end) { s = await state(); if (f(s)) return s; await page.sleep(40); } fail('timed out: ' + what, s); };
  const ONLY = String(process.env.ONLY || '').split(',').filter(Boolean).map(Number);
  const on = (n) => !ONLY.length || ONLY.includes(n);
  const out = {};
  const fresh = async (seed) => {
    await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); __wick.newRun({ seed: '${seed}' }); return 1; })()`);
    await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
  };
  const toShop = async (seed) => {
    await fresh(seed);
    await page.click('[data-action="start-blind"]');
    await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
    await runJs('run.blind.target = 1; UI.update(); return 1;');
    await page.key('1'); await page.key('Enter');
    await until('the cash-out', (s) => s.screen === 'cashout' && !s.busy, 30000);
    await js(`document.querySelector('[data-action="collect"]').click(), 1`);
    await until('the Shop', (s) => s.screen === 'shop' && !s.busy);
  };
  const openPack = async (packId) => {
    await runJs(`const k = run.shop.items.findIndex((x) => x && x.slot === 'pack'); const row = Cn.PACKS.find((p) => p.id === '${packId}'); Object.assign(run.shop.items[k], { kind: 'pack', id: row.id, price: row.price, size: row.size, sold: false }); run.money = Math.max(run.money, 40); UI.update(); return 1;`);
    const i = await runJs(`return run.shop.items.findIndex((x) => x && x.slot === 'pack' && !x.sold);`);
    await js(`document.querySelector('[data-action="buy"][data-index="${i}"]').click(), 1`);
    await until(`the ${packId} pack`, (s) => s.screen === 'pack' && !s.busy);
  };
  const skipPack = async () => {
    await js(`document.querySelector('[data-action="pack-skip"]').click(), 1`);
    await until('the Shop again', (s) => s.screen === 'shop' && !s.busy);
  };
  const home = () => js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); TW.UI.setRun(null); TW.UI.show('title'); return 1; })()`);

  await page.viewport(1440, 900, false);
  await until('the title', (s) => s.screen === 'title');

  if (on(1)) {
    // ------------------------------------------------------------ 1. F1: the Blind select's button says Play
    const selectSkipped = skipOriginality(skipped, 'section 1, no Blind select button says the word of the originality list');
    for (const [w, h, m] of [[1440, 900, false], [844, 390, true], [390, 844, true]]) {
      await page.viewport(w, h, m);
      await page.sleep(150);
      await fresh('PARTTHR1');
      const read = () => js(`(() => {
        const b = document.querySelector('.blind-card.is-current [data-action="start-blind"]'), r = b.getBoundingClientRect();
        const shown = b.textContent.trim(), name = b.getAttribute('aria-label') || '';
        const words = [...document.querySelectorAll('.blinds button')].map((n) => n.textContent.trim());
        return { shown, upper: getComputedStyle(b).textTransform, name, inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, fits: b.scrollWidth <= b.clientWidth + 1, words };
      })()`);
      const small = await read();
      const target = await runJs('return UI.fmt(E.blindsForAnte(run).find((x) => x.status === "current").target);');
      ok(small.shown === 'Play' && small.name === `Play the Small Blind, target ${target}` && small.inView && small.fits, `${w} x ${h}: the Small Blind's button says Play (since F1), named "${small.name}", whole and in view`, small);
      ok(small.name.toLowerCase().startsWith(small.shown.toLowerCase()), `${w} x ${h}: its name starts with the word it shows`, small);
      if (!selectSkipped) ok(!small.words.includes(ORIGINALITY.words.blindSelectButton), `${w} x ${h}: no Blind select button says the word of the originality list`, small);
      // the Boss Blind's turn
      await runJs(`run.blindStatus = { [run.ante + '-0']: 'cleared', [run.ante + '-1']: 'cleared' }; run.blindIndex = 2; UI.update(); return 1;`);
      await page.sleep(120);
      const boss = await read();
      const bt = await runJs('return UI.fmt(E.blindsForAnte(run).find((x) => x.status === "current").target);');
      ok(boss.shown === 'Play' && boss.name === `Play the Boss Blind, target ${bt}` && boss.inView, `${w} x ${h}: the Boss Blind's button says Play too`, boss);
      out[`blind@${w}x${h}`] = { small: small.name, boss: boss.name };
    }
    await home();
    await page.viewport(1440, 900, false);
  }

  if (on(2)) {
    // ------------------------------------------------------------ 2. F2, F3: the pack's reading plate and room
    await toShop('PARTTHR2');
    const SIZES = [[844, 390, true], [932, 430, true], [667, 375, true], [1000, 700, false], [900, 650, false], [800, 620, false], [700, 700, false]];
    for (const packId of ['ghostnormal', 'tarotmega']) {
      await page.viewport(1440, 900, false);
      await page.sleep(100);
      await openPack(packId);
      for (const [w, h, m] of SIZES) {
        await page.viewport(w, h, m);
        await page.sleep(250);
        const r = await runJs(`
          const list = Cn.TAROTS.map((x) => ['tarot', x.id, x.name]).concat(Cn.SPECTRALS.map((x) => ['spectral', x.id, x.name]));
          const keep = run.pack.options.map((o) => Object.assign({}, o)), hand = run.pack.hand.slice(), jk = run.jokers.slice();
          const three = Cn.JOKERS.filter((j) => j.rarity === 'common').slice(0, 3).map((j) => j.id);
          // how far the plate's last line runs past its inner bottom edge, and whether it scrolls inside itself
          const past = () => { const d = document.querySelector('#pkDetail'), b = d.getBoundingClientRect(), cs = getComputedStyle(d), kids = [...d.children], last = kids[kids.length - 1].getBoundingClientRect(); return Math.round(last.bottom - (b.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom))); };
          const cut = new Set(); let worst = -999, scrolls = 0;
          for (const withJ of [false, true]) {
            run.jokers = [];
            if (withJ) three.forEach((id) => E.addJoker(run, id));
            for (const [kind, id, name] of list) {
              run.pack.options = run.pack.options.map(() => ({ kind, id }));
              for (const n of [0, 1, 2]) { UI.shop.select(hand.slice(0, n)); UI.update(); const c = past(); worst = Math.max(worst, c); if (c > 1) cut.add(name); const d = document.querySelector('#pkDetail'); if (d.scrollHeight > d.clientHeight + 1) scrolls++; }
            }
          }
          run.jokers = jk; run.pack.options = keep; UI.shop.select([]); UI.update();
          const box = (sel) => { const n = document.querySelector(sel); if (!n || !n.getClientRects().length) return null; const q = n.getBoundingClientRect(); return { t: q.top, b: q.bottom, l: q.left, r: q.right }; };
          const racks = box('.racks'), head = box('.pk-head'), plate = box('#pkDetail'), handCol = box('.pk-handcol') || box('.pk-hand');
          const ov = (a, b) => a && b && a.l < b.right - 1 && a.r > b.left + 1 && a.t < b.bottom - 1 && a.b > b.top + 1;
          const row = document.querySelector('.pk-opts'), rr = row.getBoundingClientRect();
          const picks = [...document.querySelectorAll('.pk-opt .pk-pick')];
          let covered = 0, hidden = 0;
          picks.forEach((p) => { const q = p.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2; if (cx < rr.left || cx > rr.right) { hidden++; return; } const hit = document.elementFromPoint(cx, cy); if (!hit || !p.contains(hit)) covered++; });
          const cards = [...document.querySelectorAll('#hand .card')], cr = cards.map((n) => n.getBoundingClientRect());
          let untappable = 0;
          cr.forEach((q, i) => { const right = i < cr.length - 1 ? cr[i + 1].left : q.right; const hit = document.elementFromPoint((q.left + right) / 2, q.top + q.height * 0.6); if (!hit || !cards[i].contains(hit)) untappable++; });
          return { readings: list.length, cut: [...cut], worst, scrolls, page: [document.scrollingElement.scrollWidth, innerWidth, document.scrollingElement.scrollHeight, innerHeight],
            headClear: !racks || !head || head.t >= racks.b - 1, handIn: !!handCol && handCol.b <= innerHeight + 1 && cr.every((q) => q.left >= -1 && q.right <= innerWidth + 1 && q.bottom <= innerHeight + 1),
            untappable, cards: cards.length, covered, hidden, picks: picks.length, plateOverOptions: [...document.querySelectorAll('.pk-opt .pk-art')].some((n) => { const q = n.getBoundingClientRect(); return ov(plate, q); }),
            plateOverHand: cr.some((q) => ov(plate, q)), plateH: plate ? Math.round(plate.b - plate.t) : 0 };`);
        const at = `${w} x ${h}`;
        ok(r.readings === 36 && !r.cut.length && !r.scrolls, `${packId} at ${at}: every Tarot and Spectral reading shows whole on a plate that never scrolls (${r.plateH} px tall)`, r);
        ok(r.page[0] <= r.page[1] + 1 && r.page[2] <= r.page[3] + 1, `${packId} at ${at}: and the page does not scroll`, r.page);
        ok(r.headClear && r.handIn && r.cards === 8 && !r.untappable, `${packId} at ${at}: the head clear of the racks, the whole hand in view, every card tappable`, r);
        ok(!r.covered && !r.plateOverOptions && !r.plateOverHand, `${packId} at ${at}: no Use button covered, the plate clear of the options and the hand`, r);
        if (r.hidden) {
          // a Mega pack's row on a phone scrolls sideways: its last Use button is a scroll away, whole and free
          const end = await js(`(() => { const row = document.querySelector('.pk-opts'); row.scrollLeft = row.scrollWidth; const rr = row.getBoundingClientRect(), p = [...document.querySelectorAll('.pk-opt .pk-pick')].pop(), q = p.getBoundingClientRect(); const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); const res = { whole: q.left >= rr.left - 1 && q.right <= rr.right + 1, free: !!hit && p.contains(hit) }; row.scrollLeft = 0; return res; })()`);
          ok(packId === 'tarotmega' && end.whole && end.free, `${packId} at ${at}: the ${r.hidden} Use ${r.hidden > 1 ? 'buttons' : 'button'} out of the row's view ${r.hidden > 1 ? 'are' : 'is'} a sideways scroll away, whole and free`, end);
        }
        out[`${packId}@${at}`] = { plate: r.plateH, worst: r.worst, hidden: r.hidden };
      }
      await page.viewport(1440, 900, false);
      await page.sleep(200);
      await skipPack();
    }
    // a Planet Pack's bar takes a second row for the hand panel: on the short wide windows the racks step aside for it
    // too (a Mega one scrolled the page by 33 px at 800 x 620 and 3 px at 900 x 650)
    await openPack('planetmega');
    for (const [w, h, m] of SIZES.filter((s) => !s[2])) {
      await page.viewport(w, h, m);
      await page.sleep(250);
      const r = await js(`(() => {
        const vis = (n) => { const q = n.getBoundingClientRect(); return q.width > 0 && q.top >= -1 && q.bottom <= innerHeight + 1; };
        const picks = [...document.querySelectorAll('.pk-opt .pk-pick')];
        const free = picks.filter((p) => { const q = p.getBoundingClientRect(); const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !!hit && p.contains(hit); }).length;
        return { page: [document.scrollingElement.scrollHeight - innerHeight, document.scrollingElement.scrollWidth - innerWidth], picks: picks.length, free, plate: vis(document.querySelector('#pkDetail')), hand: vis(document.querySelector('.col > .w-hand')), skip: vis(document.querySelector('[data-action="pack-skip"]')) };
      })()`);
      ok(r.page[0] <= 1 && r.page[1] <= 1 && r.picks === 6 && r.free === 6 && r.plate && r.hand && r.skip, `planetmega at ${w} x ${h}: no page scroll, every Use button free, the plate, Skip and the hand panel in view`, r);
    }
    await page.viewport(1440, 900, false);
    await page.sleep(200);
    await skipPack();
  }

  if (on(3)) {
    // ------------------------------------------------------------ 3. F5: the pack drawn anew keeps focus; a busy breakpoint redraws later
    await page.viewport(1440, 900, false);
    await toShop('PARTTHR3');
    await openPack('tarotmega');
    await page.sleep(100);
    const focusOn = (sel) => js(`(() => { const n = document.querySelector(${JSON.stringify(sel)}); n.focus(); return document.activeElement === n; })()`);
    const active = () => js(`(() => { const a = document.activeElement; return a ? { tag: a.tagName, action: a.dataset.action || null, index: a.dataset.index || null, uid: a.dataset.uid || null, body: a === document.body } : null; })()`);
    // a Use button: 3 px to 2 px (the pack is drawn anew for the new pixel size)
    ok(await focusOn('.pk-opt[data-opt="1"] .pk-pick'), 'the second Use button has focus');
    const before = await js(`document.querySelector('.pk-opt[data-opt="1"] .pk-pick') !== null`);
    await page.viewport(1024, 768, false);
    await page.sleep(400);
    const a1 = await active();
    const redrawn = await js(`TW.UI.PX() === 2 && !!document.querySelector('.pk-opt[data-opt="1"] .pk-pick')`);
    ok(before && redrawn && a1 && a1.action === 'pack-pick' && a1.index === '1', 'crossing to 2 px draws the pack anew and focus stays on the second Use button (it fell to the page)', a1);
    // a card of the dealt hand: 2 px back to 3 px
    const uid = await js(`document.querySelectorAll('#hand .card')[2].dataset.uid`);
    ok(await focusOn(`#hand .card[data-uid="${uid}"]`), 'a card of the dealt hand has focus');
    await page.viewport(1440, 900, false);
    await page.sleep(400);
    const a2 = await active();
    ok(a2 && a2.uid === uid, 'crossing back to 3 px, focus stays on that card', a2);
    // a breakpoint crossed while the game is busy: the redraw waits for it, then draws the plates for the new size
    const plateText = (html) => { const m = /<[^>]*class="plate[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/.exec(html); return m ? m[1].replace(/<[^>]+>/g, '').trim() : null; };
    const whole3 = await js(`TW.Content.TAROTS.map((t) => [t.id, t.name, TW.UI.plateHTML(t.name)])`);
    await page.viewport(1024, 768, false);
    await page.sleep(300);
    const at2 = await js(`TW.Content.TAROTS.map((t) => [t.id, TW.UI.plateHTML(t.name)])`);
    const pick = whole3.find(([id, name, h3]) => plateText(h3) === name && plateText(at2.find((x) => x[0] === id)[1]) !== name);
    ok(!!pick, 'a Tarot name is whole at 3 px and shortened at 2 px', whole3.slice(0, 4));
    const [tid, tname] = pick;
    await page.viewport(1440, 900, false);
    await page.sleep(300);
    await runJs(`run.pack.options[0] = { kind: 'tarot', id: '${tid}' }; UI.update(); return 1;`);
    await page.sleep(100);
    const first = () => js(`(() => { const p = document.querySelector('.pk-opt[data-opt="0"] .plate'); return p ? { text: p.textContent.trim(), clipped: p.scrollWidth > p.clientWidth + 1 } : null; })()`);
    const p3 = await first();
    ok(p3 && p3.text === tname && !p3.clipped, `at 3 px the first option's plate reads ${tname} whole`, p3);
    await js('(TW.UI.setBusy(true), 1)');
    await page.viewport(1024, 768, false);
    await page.sleep(400);
    const held = await first();
    await js('(TW.UI.clearBusy(), 1)');
    await page.sleep(700);
    const p2 = await first();
    ok(held && held.text === tname && p2 && p2.text !== tname && !p2.clipped, 'a breakpoint crossed while busy draws the plates for 2 px once the game is free (the redraw was dropped, leaving the name clipped)', { held, p2 });
    await page.viewport(1440, 900, false);
    await page.sleep(300);
    await skipPack();
    await home();
  }

  if (on(4)) {
    // ------------------------------------------------------------ 4. F6: the fanned hand at 667 x 375
    await page.viewport(667, 375, true);
    await page.sleep(150);
    await fresh('PARTTHR4');
    await page.click('[data-action="start-blind"]');
    await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
    await runJs(`const seals = Cn.SEALS.map((s) => s.id); run.blind.hand.forEach((u, i) => { const c = E.getCard(run, u); if (c) c.seal = seals[i % seals.length]; }); UI.update(); return 1;`);
    await page.sleep(100);
    for (const chosen of [0, 1]) {
      await runJs(`UI.table.select(${chosen ? 'run.blind.hand.slice(3, 4)' : '[]'}); UI.update(); return 1;`);
      await page.sleep(120);
      const r = await js(`(() => {
        const hand = document.querySelector('#hand'), cards = [...hand.querySelectorAll('.card')], cr = cards.map((n) => n.getBoundingClientRect());
        const strips = cr.map((q, i) => Math.round((i < cr.length - 1 ? cr[i + 1].left : q.right) - q.left));
        let untappable = 0;
        cr.forEach((q, i) => { const right = i < cr.length - 1 ? cr[i + 1].left : q.right; const hit = document.elementFromPoint((q.left + right) / 2, q.top + q.height * 0.6); if (!hit || !cards[i].contains(hit)) untappable++; });
        // each covered card's Seal tab sits whole over the top edge of its own strip, inside the screen
        const tabs = cards.slice(0, -1).map((c, i) => { const s = c.querySelector('.seal-badge'); if (!s) return false; const b = s.getBoundingClientRect(); return b.left >= cr[i].left - 1 && b.right <= cr[i + 1].left + 1 && b.top >= 0; });
        const inView = (sel) => [...document.querySelectorAll(sel)].every((n) => { const q = n.getBoundingClientRect(); return q.width > 0 && q.top >= 0 && q.left >= 0 && q.bottom <= innerHeight && q.right <= innerWidth; });
        const mv = document.querySelector('#mover');
        const mover = mv && !mv.hidden ? [...mv.querySelectorAll('.btn')].map((b) => { const q = b.getBoundingClientRect(); const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { w: Math.round(q.width), h: Math.round(q.height), free: !!hit && b.contains(hit) }; }) : null;
        return { n: cards.length, fanned: hand.classList.contains('is-fanned'), strips, untappable, tabs: tabs.every(Boolean), controls: inView('.controls .btn'), mover, page: [document.scrollingElement.scrollHeight - innerHeight, document.scrollingElement.scrollWidth - innerWidth] };
      })()`);
      ok(r.n === 8 && r.fanned && Math.min(...r.strips) >= 24 && !r.untappable, `667 x 375${chosen ? ', one card chosen' : ''}: each of the fanned hand's strips is tappable and at least 24 px (${Math.min(...r.strips)} px)`, r);
      ok(r.tabs && r.controls && r.page[0] <= 1 && r.page[1] <= 1, `667 x 375${chosen ? ', one card chosen' : ''}: every Seal tab whole on its strip, Play hand, Sort and Discard in view, no page scroll`, r);
      if (chosen) ok(r.mover && r.mover.length === 2 && r.mover.every((b) => b.w >= 44 && b.h >= 44 && b.free), '667 x 375: the Move pair stands whole, 44 px keys free to tap', r.mover);
      out[`hand@667x375${chosen ? '+1' : ''}`] = { strips: Math.min(...r.strips) };
    }
    await home();
    await page.viewport(1440, 900, false);
  }
  if (on(5)) {
    // ------------------------------------------------------------ 5. F2, F3: a Joker reacting while the racks step aside
    // the racks step aside while a pack deals its hand (a landscape phone, and now a window 760 px tall or less): a Joker
    // that reacts to the Tarot card used there popped its note at the screen's top-left corner, from a rack with no box
    // (a short window held wide keeps its racks since part 4, P4: 700 x 700, held upright, still sends them aside)
    for (const [w, h, m] of [[844, 390, true], [700, 700, false]]) {
      await page.viewport(w, h, m);
      await page.sleep(150);
      await toShop('PARTTHR5');
      const jk = await runJs(`const j = Cn.JOKERS.find((x) => x.events && x.events.consumableUsed && x.events.consumableUsed.some((e) => e.when && e.when.kind === 'tarot' && e.add)); E.addJoker(run, j.id); UI.update(); return j.id;`);
      await openPack('tarotnormal');
      const racksHidden = await js(`!document.querySelector('#racks .jk') || !document.querySelector('#racks .jk').getClientRects().length`);
      const tarot = await runJs(`const t = Cn.TAROTS.find((x) => Array.isArray(x.select) && x.select[0] === 1 && x.enhancement); run.pack.options[0] = { kind: 'tarot', id: t.id }; UI.update(); UI.shop.select(run.pack.hand.slice(0, 1)); UI.update(); return t.id;`);
      await js(`(() => { window.__fxSeen = []; window.__said = []; const fx = document.querySelector('#fx'), live = document.querySelector('#live');
        window.__fxMo = new MutationObserver((recs) => recs.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType !== 1) return; const q = n.getBoundingClientRect(); window.__fxSeen.push({ cls: n.className, l: Math.round(q.left), t: Math.round(q.top), text: n.textContent }); })));
        window.__fxMo.observe(fx, { childList: true });
        window.__liveMo = new MutationObserver(() => { if (live.textContent) window.__said.push(live.textContent); }); window.__liveMo.observe(live, { childList: true, characterData: true, subtree: true });
        return 1; })()`);
      await js(`document.querySelector('[data-action="pack-pick"][data-index="0"]').click(), 1`);
      await until('the pick to settle', (s) => s.screen === 'pack' || s.screen === 'shop', 8000);
      await page.sleep(400);
      await until('the game to be free', (s) => !s.busy, 8000);
      const seen = await js(`(() => { window.__fxMo.disconnect(); window.__liveMo.disconnect(); return { fx: window.__fxSeen, said: window.__said }; })()`);
      const name = await js(`TW.Content.JOKERS.find((j) => j.id === '${jk}').name`);
      const corner = seen.fx.filter((n) => /note-pop|hangtag/.test(n.cls) && n.l <= 8 && n.t <= 8);
      ok(racksHidden && seen.said.some((t) => t.includes(name)) && !corner.length, `${w} x ${h}: ${name} reacts to ${tarot} while the racks step aside, and nothing pops at the screen's top-left corner (a note popped there)`, { racksHidden, seen });
      await home();
    }
    await page.viewport(1440, 900, false);
  }
  if (on(7)) {
    // ------------------------------------------------------------ 7. (final agent) a Planet Pack and a pack's name on a landscape phone
    // 50-shop.css's block for a wide compact window 760 px tall or less also matches the landscape phones from 600 px
    // wide, and its Planet Pack rule sent the racks aside there too; the pack fits beside them there (as before part 3)
    await toShop('PARTTHR7');
    await runJs(`Cn.JOKERS.filter((j) => j.rarity === 'common').slice(0, 3).forEach((j) => E.addJoker(run, j.id)); run.consumables = [{ uid: 'k' + run.nextUid++, kind: 'tarot', id: Cn.TAROTS[0].id }, { uid: 'k' + run.nextUid++, kind: 'planet', id: Cn.PLANETS[0].id }]; UI.saveRun(); UI.update(); return 1;`);
    for (const packId of ['planetnormal', 'planetmega', 'cardjumbo', 'jokermega']) {
      const planet = packId.startsWith('planet');
      await page.viewport(1440, 900, false);
      await page.sleep(100);
      await openPack(packId);
      for (const [w, h, m] of [[844, 390, true], [932, 430, true], [667, 375, true], [800, 620, false], [900, 650, false], [700, 700, false]]) {
        await page.viewport(w, h, m);
        await page.sleep(250);
        const r = await js(`(() => {
          const racks = document.querySelector('.racks');
          // in reach: shown, on screen, and the topmost thing at its middle
          const reach = (sel) => { const n = document.querySelector(sel); if (!n || !n.getClientRects().length) return false; const q = n.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2; if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return false; const hit = document.elementFromPoint(cx, cy); return !!hit && n.contains(hit); };
          const rr = document.querySelector('.pk-opts').getBoundingClientRect();
          let covered = 0;
          document.querySelectorAll('.pk-opt .pk-pick').forEach((p) => { const q = p.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2; if (cx < rr.left || cx > rr.right) return; const hit = document.elementFromPoint(cx, cy); if (!hit || !p.contains(hit)) covered++; });
          // the pack's name: every line of its text inside its pill, and the pill's corners the topmost thing there
          const pill = document.querySelector('.pk-head > .tag'), pr = pill.getBoundingClientRect(), rg = document.createRange();
          rg.selectNodeContents(pill);
          const lines = [...rg.getClientRects()].filter((q) => q.width > 0);
          // (a line's box is the font's whole content area, a little taller than the pill's nine art px: its middle counts)
          const inPill = lines.every((q) => q.left >= pr.left - 1 && q.right <= pr.right + 1 && (q.top + q.bottom) / 2 >= pr.top && (q.top + q.bottom) / 2 <= pr.bottom);
          const onTop = [[pr.left + 3, pr.top + 3], [pr.right - 3, pr.top + 3], [pr.left + 3, pr.bottom - 3], [pr.right - 3, pr.bottom - 3]].every(([x, y]) => { const hit = document.elementFromPoint(x, y); return !!hit && pill.contains(hit); });
          return { racks: racks ? getComputedStyle(racks).display : null, joker: reach('[data-joker-uid]'), consumable: reach('[data-consumable-uid]'), covered, scroll: [document.scrollingElement.scrollWidth - innerWidth, document.scrollingElement.scrollHeight - innerHeight],
            name: { text: pill.textContent.trim(), w: Math.round(pr.width), lines: lines.length, widest: Math.round(Math.max(...lines.map((q) => q.width))), inPill, onTop } };
        })()`);
        const at = `${w} x ${h}`;
        // the landscape layout (a landscape phone, and since part 4 a short window held wide) keeps the racks for a Planet
        // Pack; a compact window held upright and 760 px tall or less sends them aside, as F3 has it
        const wide = w > h;
        if (planet && wide) ok(r.racks !== 'none' && r.joker && r.consumable, `${packId} at ${at} (${m ? 'a landscape phone' : 'a short window held wide'}): the racks stay, a Joker and a consumable in reach (they stepped aside)`, r);
        else if (planet) ok(r.racks === 'none', `${packId} at ${at}: the racks step aside for it, as F3 has it`, r);
        ok(r.name.inPill && r.name.onTop, `${packId} at ${at}: the pack's name "${r.name.text}" shows whole in its pill (${r.name.lines} ${r.name.lines > 1 ? 'lines' : 'line'})`, r.name);
        ok(r.scroll[0] <= 1 && r.scroll[1] <= 1 && !r.covered, `${packId} at ${at}: the page does not scroll and no Use or Pick button is covered`, r);
        out[`s7:${packId}@${at}`] = { racks: r.racks, nameLines: r.name.lines };
      }
      await page.viewport(1440, 900, false);
      await page.sleep(200);
      await skipPack();
    }
    await home();
    await page.viewport(1440, 900, false);
  }
  if (on(6)) {
    // ------------------------------------------------------------ 6. at real speed: the main area's route copy
    // a change of the table's main area lays a fading copy of the view that leaves over the one that arrives; 40-table.css's
    // .main { position: relative } outranked its position: fixed, so the copy fell into the page's flow under the table,
    // out of sight, and the page grew by a screen while it faded (a scrollbar flashed at every change)
    const u = new URL(url);
    u.searchParams.delete('test');
    await page.goto(u.toString(), { wait: 600 });
    await until('the title (real speed)', (s) => s.screen === 'title');
    ok(!(await js('TW.UI.TEST')), 'section 6 runs at real speed');
    for (const [w, h, m] of [[1440, 900, false], [800, 620, false]]) {
      await page.viewport(w, h, m);
      await page.sleep(200);
      await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); __wick.newRun({ seed: 'PARTTHR6' }); return 1; })()`);
      await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
      await page.sleep(900);
      // sample the page's height and the copy from just before Play until well after its fade; the copy stands where the
      // Blind select's main area stood on the screen when Play was clicked (the new one may sit elsewhere: on a compact
      // window the table's bar is taller)
      await js(`(() => { window.__h = []; const t0 = performance.now(); window.__b = null; window.addEventListener('click', () => { window.__b = document.querySelector('#app .main').getBoundingClientRect(); }, { capture: true, once: true }); const tick = () => { const g = document.querySelector('.route-ghost-main'), b = window.__b; let ghost = null; if (g && b) { const a = g.getBoundingClientRect(); ghost = { pos: getComputedStyle(g).position, dx: Math.round(a.left - b.left), dy: Math.round(a.top - b.top), dw: Math.round(a.width - b.width) }; } window.__h.push({ sh: document.scrollingElement.scrollHeight, ih: innerHeight, ghost }); if (performance.now() - t0 < 700) setTimeout(tick, 10); }; tick(); return 1; })()`);
      const pre = await js('document.scrollingElement.scrollHeight');
      await page.click('[data-action="start-blind"]');
      await page.sleep(800);
      const hs = await js('window.__h');
      const post = await js('document.scrollingElement.scrollHeight');
      const ghosts = hs.filter((x) => x.ghost);
      // the page may be taller than the window on its own (the Blind select or the table at a short window): the copy adds nothing to it
      const grew = hs.filter((x) => x.sh > Math.max(x.ih, pre, post) + 1);
      ok(ghosts.length > 0 && ghosts.every((x) => x.ghost.pos === 'fixed' && Math.abs(x.ghost.dx) <= 1 && Math.abs(x.ghost.dy) <= 1 && Math.abs(x.ghost.dw) <= 1) && !grew.length, `${w} x ${h}: Play's route copy fades over the main area in place and the page never grows (it grew by a screen while the copy faded)`, { samples: hs.length, pre, post, ghosts: ghosts.slice(0, 3), grew: grew.slice(0, 3) });
      await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0, 15000);
    }
    await home();
    await page.viewport(1440, 900, false);
  }
  return { checks: checks.length, list: checks, skipped, out };
}
