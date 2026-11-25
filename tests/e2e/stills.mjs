// Regression checks for the final pass, part 2, from the final agent's review stills (2026-11-24), a tools/cdp.mjs
// scenario. Run it in test mode; it sets its own window sizes. It checks:
//   1. the reading plate beside a Tarot or Ghost Pack's dealt hand holds every Tarot and Spectral reading whole (its
//      effect, a note and the status: no Joker and three Jokers, 0, 1 or 2 cards chosen) at 1024 x 768, 1366 x 657,
//      1440 x 900, 390 x 844, 768 x 1024 and 360 x 640, with no page scroll, the pack's head clear of the racks and
//      the hand in view. Capped at the hand's height it cut 30 of the 36 readings at 1024 x 768, 9 at 1440 x 900 and
//      16 at 390 x 844 (I3 was fixed at 360 x 640 only). The landscape phones and the wide compact windows 760 px
//      tall or less are checked by tests/e2e/part3.mjs section 2 (part 3: their plate scrolled or the page did);
//   2. crossing a breakpoint (1440 x 900 to 1024 x 768 and back) draws the open pack's and the Shop's name plates
//      again for the new pixel size: a name that fits whole at 3 px is shortened at 2 px, never clipped mid-letter;
//   3. How to play's tab row wraps on a phone (390 x 844, 360 x 640) and a window 760 px wide or less, as the
//      Collection's does since D3: every tab whole, no hidden-scrollbar scroller (it cut UPGRADES mid-word and hid TAGS).
// cdp.mjs fails the run on any console error or exception.
// Usage: node tools/cdp.mjs run "http://localhost:5204/index.html?test=1&seed=PLATES01" tests/e2e/stills.mjs
export default async function stills(page) {
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
  const toShop = async (seed) => {
    await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); __wick.newRun({ seed: '${seed}' }); return 1; })()`);
    await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
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

  await page.viewport(1440, 900, false);
  await until('the title', (s) => s.screen === 'title');

  if (on(1)) {
    // ------------------------------------------------------------ 1. every reading whole, at every size
    await toShop('PLATES01');
    for (const packId of ['ghostnormal', 'tarotmega']) {
      await page.viewport(1440, 900, false);
      await page.sleep(100);
      await openPack(packId);
      for (const [w, h, m] of [[1024, 768, false], [1366, 657, false], [1440, 900, false], [390, 844, true], [768, 1024, true], [360, 640, true]]) {
        await page.viewport(w, h, m);
        await page.sleep(250);
        const r = await runJs(`
          const list = Cn.TAROTS.map((x) => ['tarot', x.id, x.name]).concat(Cn.SPECTRALS.map((x) => ['spectral', x.id, x.name]));
          const keep = run.pack.options.map((o) => Object.assign({}, o)), hand = run.pack.hand.slice(), jk = run.jokers.slice();
          const three = Cn.JOKERS.filter((j) => j.rarity === 'common').slice(0, 3).map((j) => j.id);
          // how far the plate's last line runs past its inner bottom edge (it scrolls inside itself when > 0)
          const past = () => { const d = document.querySelector('#pkDetail'), b = d.getBoundingClientRect(), cs = getComputedStyle(d), kids = [...d.children], last = kids[kids.length - 1].getBoundingClientRect(); return Math.round(last.bottom - (b.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom))); };
          const cut = new Set(); let worst = -999;
          for (const withJ of [false, true]) {
            run.jokers = [];
            if (withJ) three.forEach((id) => E.addJoker(run, id));
            for (const [kind, id, name] of list) {
              run.pack.options = run.pack.options.map(() => ({ kind, id }));
              for (const n of [0, 1, 2]) { UI.shop.select(hand.slice(0, n)); UI.update(); const c = past(); worst = Math.max(worst, c); if (c > 1) cut.add(name); }
            }
          }
          run.jokers = jk; run.pack.options = keep; UI.shop.select([]); UI.update();
          const box = (sel) => { const n = document.querySelector(sel); if (!n || !n.getClientRects().length) return null; const q = n.getBoundingClientRect(); return { t: q.top, b: q.bottom }; };
          const racks = box('.racks'), head = box('.pk-head'), hz = box('.pk-handzone'), handCol = box('.pk-handcol') || box('.pk-hand');
          return { readings: list.length, cut: [...cut], worst, page: [document.scrollingElement.scrollWidth, innerWidth, document.scrollingElement.scrollHeight, innerHeight],
            headClear: !racks || !head || head.t >= racks.b - 1, handIn: !handCol || handCol.b <= innerHeight + 1, plateH: Math.round(document.querySelector('#pkDetail').getBoundingClientRect().height) };`);
        const at = `${w} x ${h}`;
        ok(r.readings === 36 && !r.cut.length, `${packId} at ${at}: every Tarot and Spectral reading shows whole on the plate beside the dealt hand (${r.plateH} px tall)`, r);
        ok(r.page[0] <= r.page[1] + 1 && r.page[2] <= r.page[3] + 1, `${packId} at ${at}: and the page does not scroll`, r.page);
        ok(r.headClear && r.handIn, `${packId} at ${at}: the pack's head stays clear of the racks and the hand in view`, r);
        out[`${packId}@${at}`] = { plate: r.plateH, worst: r.worst };
      }
      await page.viewport(1440, 900, false);
      await page.sleep(200);
      await js(`document.querySelector('[data-action="pack-skip"]').click(), 1`);
      await until('the Shop again', (s) => s.screen === 'shop' && !s.busy);
    }
  }

  if (on(2)) {
    // ------------------------------------------------------------ 2. a breakpoint draws the pack's and the Shop's plates again
    await page.viewport(1440, 900, false);
    await toShop('PLATES02');
    const plateText = (html) => { const m = /<[^>]*class="plate[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/.exec(html); return m ? m[1].replace(/<[^>]+>/g, '').trim() : null; };
    // a Tarot whose name is whole on a plate at 3 px but not at 2 px
    const whole3 = await js(`TW.Content.TAROTS.map((t) => [t.id, t.name, TW.UI.plateHTML(t.name)])`);
    await page.viewport(1024, 768, false);
    await page.sleep(300);
    const at2 = await js(`TW.Content.TAROTS.map((t) => [t.id, TW.UI.plateHTML(t.name)])`);
    const pick = whole3.find(([id, name, h3]) => plateText(h3) === name && plateText(at2.find((x) => x[0] === id)[1]) !== name);
    ok(!!pick, 'a Tarot name is whole at 3 px and shortened at 2 px', { whole3: whole3.map((x) => plateText(x[2])).slice(0, 8) });
    const [tid, tname] = pick;
    await page.viewport(1440, 900, false);
    await page.sleep(300);
    await openPack('tarotmega');
    await runJs(`run.pack.options[0] = { kind: 'tarot', id: '${tid}' }; UI.update(); return 1;`);
    await page.sleep(100);
    const plates = () => js(`(() => { const ps = [...document.querySelectorAll('.pk-opts .plate, #shop .plate, .racks .plate')].filter((p) => p.getClientRects().length); return { first: (document.querySelector('.pk-opt[data-opt="0"] .plate') || {}).textContent || null, clipped: ps.filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent) }; })()`);
    const p3 = await plates();
    ok(p3.first && p3.first.trim() === tname && !p3.clipped.length, `at 3 px the pack's first plate reads ${tname} whole`, p3);
    await page.viewport(1024, 768, false);
    await page.sleep(400);
    const p2 = await plates();
    ok(p2.first && p2.first.trim() !== tname && !p2.clipped.length, 'crossing to 2 px draws the plates again: the name is shortened, nothing clipped mid-letter (it stayed whole and clipped before)', p2);
    await js(`document.querySelector('[data-action="pack-skip"]').click(), 1`);
    await until('the Shop again', (s) => s.screen === 'shop' && !s.busy);
    await runJs(`const k = run.shop.items.findIndex((x) => x && x.slot === 'card'); Object.assign(run.shop.items[k], { kind: 'tarot', id: '${tid}', price: 3, edition: null, sold: false }); UI.update(); return 1;`);
    await page.sleep(100);
    const s2 = await js(`(() => { const ps = [...document.querySelectorAll('#shop .plate')].filter((p) => p.getClientRects().length); return { texts: ps.map((p) => p.textContent.trim()), clipped: ps.filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent) }; })()`);
    ok(!s2.texts.includes(tname) && !s2.clipped.length, 'the Shop at 2 px shows the short name', s2);
    await page.viewport(1440, 900, false);
    await page.sleep(400);
    const s3 = await js(`(() => { const ps = [...document.querySelectorAll('#shop .plate')].filter((p) => p.getClientRects().length); return { texts: ps.map((p) => p.textContent.trim()), clipped: ps.filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent) }; })()`);
    ok(s3.texts.includes(tname) && !s3.clipped.length, 'crossing back to 3 px, the Shop draws its plates again with the whole name', s3);
    out.breakpoint = { tarot: tname, at2: p2.first };
  }
  if (on(3)) {
    // ------------------------------------------------------------ 3. How to play's tab row wraps on a phone
    await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); TW.UI.setRun(null); TW.UI.show('title'); return 1; })()`);
    await until('the title', (s) => s.screen === 'title');
    for (const [w, h, m] of [[390, 844, true], [360, 640, true], [700, 900, false]]) {
      await page.viewport(w, h, m);
      await page.sleep(250);
      await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.openOverlay('help'); return 1; })()`);
      await page.waitFor('#dialogs .hp-dlg .hp-tabs');
      await page.sleep(150);
      const r = await js(`(() => { const row = document.querySelector('#dialogs .hp-tabs'), b = row.getBoundingClientRect(), cs = getComputedStyle(row); const tabs = [...row.querySelectorAll('.hp-tab')]; return { n: tabs.length, cut: tabs.filter((t) => { const q = t.getBoundingClientRect(); return !(q.width > 0 && q.left >= b.left - 0.5 && q.right <= b.right + 0.5 && q.right <= innerWidth && t.scrollWidth <= t.clientWidth + 1); }).map((t) => t.textContent.trim()), scroller: cs.overflowX !== 'visible' || row.scrollWidth > row.clientWidth + 1, rows: new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().top))).size, short: tabs.filter((t) => t.getBoundingClientRect().height < 44).length }; })()`);
      ok(r.n === 7 && !r.cut.length && !r.scroller && !r.short, `How to play's seven tabs show whole at ${w} x ${h} (${r.rows} rows), with no hidden scroller and 44 px targets`, r);
    }
    await js(`(() => { TW.UI.closeAllDialogs(); return 1; })()`);
    await page.viewport(1440, 900, false);
  }
  await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); TW.UI.setRun(null); TW.UI.show('title'); return 1; })()`);
  return { checks: checks.length, list: checks, out };
}
