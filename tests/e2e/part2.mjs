// Regression checks for the final pass, part 2 (UI code, play and design fixes, 2026-11-24), a tools/cdp.mjs scenario.
// Run it in test mode; it sets its own window sizes and plays one stretch at real speed (section 8). It checks:
//   1. C1  storage is full: the player is told once, and Save and quit, then Continue, bring back the run as it is;
//   2. C4  crossing a breakpoint (1024 x 768 to 1024 x 900 and back) keeps an open dialog open with its focus, and on
//          Game Over neither the sound nor the announcement comes again; the lettering is drawn again for the new size;
//   3. C5  in a pack a Tag opened at the Blind select, the column's count is the next Blind's;
//   4. P1  The Lid at Ante 5: the table's Blind plate shows the rule with its live cap, as the Blind select does;
//   5. P2  Tall Tale's new Legendary Joker with an Edition is announced with its Edition, never "A Joker became ...";
//   6. D2, D3  the Collection at 390 x 844, 1024 x 768 and 1440 x 900: every tab whole (no scroller), locked tiles in
//          warm plum (no filter, no near-black);
//   7. I1, I3  a phone's fanned hand shows every Seal whole and once; a 360 x 640 Tarot Pack shows its four options and
//          every reading whole (no sideways scroll, no cut line);
//   8. P3, C3, C2  at real speed: input waits while the hand is dealt (busy is '1' until the last card lands); muted,
//          the audio context rests with no scheduler, and wakes unmuted; the drawn numbers stay under their cap.
// cdp.mjs fails the run on any console error or exception.
// Usage: node tools/cdp.mjs run "http://localhost:5200/?test=1&seed=PARTTWO1" tests/e2e/part2.mjs
export default async function part2(page, { url }) {
  const js = (e) => page.eval(e);
  const runJs = (body) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${body} })()`);
  const state = async () => JSON.parse(await js('JSON.stringify(__wick.state())'));
  const fail = (m, x) => { throw new Error(m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 1500) : '')); };
  const checks = [];
  const ok = (cond, msg, x) => { if (!cond) fail(msg, x); checks.push(msg); };
  const until = async (what, f, ms = 15000) => { const end = Date.now() + ms; let s; while (Date.now() < end) { s = await state(); if (f(s)) return s; await page.sleep(40); } fail('timed out: ' + what, s); };
  const quiet = async (ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { const n = await js(`document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming && a.effect.getTiming().iterations !== Infinity).length`); if (!n) return; await page.sleep(60); } };
  const fresh = async (seed) => {
    await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); __wick.newRun({ seed: '${seed}' }); return 1; })()`);
    await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
    await quiet();
  };
  const toPlay = async () => {
    await page.click('[data-action="start-blind"]');
    await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
    await quiet();
  };
  const test = /[?&]test=1(&|$)/.test(url);
  // ONLY=2,8 runs those sections alone (to show what one of them finds on an older build)
  const ONLY = String(process.env.ONLY || '').split(',').filter(Boolean).map(Number);
  const on = (n) => !ONLY.length || ONLY.includes(n);
  const out = {};

  await page.viewport(1440, 900, false);
  await page.goto(url, { wait: 400 });
  await until('the title', (s) => s.screen === 'title');

  if (on(1)) {
  // ------------------------------------------------------------ 1. C1: a full storage
  await fresh('QAQUOTA1');
  await js(`(() => {
    const set = Storage.prototype.setItem;
    window.__quota = { on: false };
    Storage.prototype.setItem = function (k, v) { if (window.__quota.on && /ember:run/.test(k)) { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); } return set.call(this, k, v); };
    return 1; })()`);
  await js(`(() => { window.__quota.on = true; return 1; })()`);
  await toPlay();
  await page.key('1'); await page.key('2'); await page.key('Enter');
  await until('the hand to be played', (s) => !s.busy && s.screen === 'play' && s.handsLeft < 4, 20000);
  const playedAt = await state();
  await page.sleep(100);
  const toasts = await js(`[...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent)`);
  ok(toasts.filter((t) => /storage is full/.test(t)).length === 1, 'a full storage is said once, in a toast', toasts);
  ok((await js(`TW.UI.store.unsaved().join()`)) === 'test:ember:run', 'the run lives in memory only');
  await page.key('Escape');
  await page.waitFor('#dialogs [data-action="save-quit"]');
  await page.click('#dialogs [data-action="save-quit"]');
  await until('the title', (s) => s.screen === 'title');
  await page.click('[data-action="continue"]');
  const back = await until('the run to come back', (s) => s.screen === 'play' && !s.busy);
  ok(back.handsLeft === playedAt.handsLeft && back.score === playedAt.score, 'Continue brings back the run as it was at Save and quit (it brought back the Blind select before)', { back, playedAt });
  await js(`(() => { window.__quota.on = false; TW.UI.saveRun(); return 1; })()`);
  ok((await js(`TW.UI.store.unsaved().length`)) === 0, 'a write that gets through again ends it');

  }
  if (on(2)) {
  // ------------------------------------------------------------ 2. C4: a breakpoint keeps dialogs, Game Over says it once
  await page.viewport(1024, 768, false);
  await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); TW.UI.setRun(null); TW.UI.show('title'); return 1; })()`);
  await until('the title', (s) => s.screen === 'title');
  await quiet();
  for (const [action, name] of [['open-options', 'Options'], ['open-help', 'How to play']]) {
    await page.click(`.scr-title [data-action="${action}"]`);
    await page.waitFor('#dialogs .dlg');
    await page.sleep(150);
    const wm0 = await js(`(() => { const w = document.querySelector('.wm .pw'); w.__old = 1; return w.className; })()`);
    const f0 = await js(`(() => { const a = document.activeElement; return !!(a && a.closest('#dialogs')); })()`);
    await page.viewport(1024, 900, false); // crosses (max-height: 869px): the pixel size goes from 2 to 3
    await page.sleep(300);
    const after = await js(`(() => { const a = document.activeElement, w = document.querySelector('.wm .pw'); return { px: TW.UI.PX(), dialogs: __wick.state().dialogs, focusIn: !!(a && a.closest('#dialogs')), redrawn: !!w && !w.__old, cls: w && w.className }; })()`);
    ok(after.px === 3 && after.dialogs === 1 && f0 && after.focusIn, `${name} stays open with its focus across the breakpoint (it closed before)`, after);
    ok(after.redrawn, `the wordmark is drawn again for the new pixel size`, { wm0, after });
    await page.key('Escape');
    await page.sleep(150);
    await page.viewport(1024, 768, false);
    await page.sleep(300);
  }
  await fresh('QALOSE01');
  await runJs(`UI.act('startBlind'); const b = run.blind; b.handsLeft = 1; b.target = 1e9; return 1;`);
  await until('play', (s) => s.screen === 'play' && !s.busy);
  await runJs(`UI.act('playHand', [run.blind.hand[0]]); return 1;`);
  await until('Game Over', (s) => s.screen === 'gameover');
  await quiet();
  await js(`(() => { window.__said = []; const a = TW.UI.announce; TW.UI.announce = (t) => { window.__said.push(String(t)); return a(t); }; return 1; })()`);
  const loses = async () => (await js(`__wick.sfx(0).filter((e) => e.name === 'lose').length`));
  const l0 = await loses();
  await page.sleep(4300); // the end screen plays its sound again after 4 s when it is mounted anew
  const es0 = await js(`(() => { const w = document.querySelector('.es-word .pw'); w.__old = 1; return 1; })()`);
  void es0;
  await page.viewport(1024, 900, false);
  await page.sleep(400);
  await page.viewport(1024, 768, false);
  await page.sleep(400);
  const go = await js(`({ said: window.__said, redrawn: !document.querySelector('.es-word .pw').__old, screen: __wick.screen() })`);
  ok((await loses()) === l0, 'Game Over does not sound again when the window crosses a breakpoint', { l0, now: await loses() });
  ok(!go.said.some((t) => /Game Over/.test(t)), 'nor is Game Over announced again', go.said);
  ok(go.redrawn && go.screen === 'gameover', 'the headline is drawn again for the new pixel size', go);
  await page.viewport(1440, 900, false);

  }
  if (on(3)) {
  // ------------------------------------------------------------ 3. C5: the count in a pack a Tag opened at the Blind select
  await fresh('QACOUNT1');
  const sky = await runJs(`const t = Cn.TAGS.find((x) => x.pack && Cn.PACKS.find((p) => p.id === x.pack && p.kind !== 'tarot' && p.kind !== 'ghost')); run.tags[run.ante + '-0'] = t.id; UI.update(); return t.id;`);
  await quiet();
  const countText = () => js(`(() => { const n = [...document.querySelectorAll('[aria-label="Blind count"]')].find((x) => x.getClientRects().length); return n ? n.textContent.replace(/[^0-9]/g, '') : null; })()`);
  ok((await countText()) === '1', 'Blind 1 at the first Blind select');
  await page.click('[data-action="skip-blind"]');
  await until('the Tag\'s pack', (s) => s.screen === 'pack' && !s.busy);
  ok((await countText()) === '2', `in the pack the Tag (${sky}) opened, the count is the next Blind's: 2 (it said 1)`, await countText());
  await page.click('[data-action="pack-skip"]');
  await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
  ok((await countText()) === '2', 'and the Blind select after it agrees');

  }
  if (on(4)) {
  // ------------------------------------------------------------ 4. P1: The Lid's live cap on the table's Blind plate
  await fresh('QALID005');
  await runJs(`run.ante = 5; run.blindIndex = 2; run.bosses[5] = 'lid'; run.blindStatus = { '5-0': 'cleared', '5-1': 'cleared' }; UI.saveRun(); UI.refresh(); return 1;`);
  await quiet();
  const sel = await js(`(() => { const n = document.querySelector('.blind-card.is-current .bc-rule .copy'); return n ? n.textContent : null; })()`);
  const want = await runJs(`return E.currentBlindInfo(run).boss.text;`);
  await toPlay();
  const plate = await js(`document.querySelector('#blindPanel .boss-rule .copy').textContent`);
  ok(/\(now 24\)\.$/.test(want) && sel === want && plate === want, 'The Lid at Ante 5 reads the same, with "(now 24)", on the Blind select and on the table\'s Blind plate', { sel, plate, want });

  }
  if (on(5)) {
  // ------------------------------------------------------------ 5. P2: Tall Tale's Joker wears its Edition in its sentence
  await fresh('QACONS44');
  await toPlay();
  await runJs(`E.addJoker(run, 'jinglejester'); E.addJoker(run, 'papercrown'); run.consumables = [{ uid: 'k' + run.nextUid++, kind: 'spectral', id: 'originstory' }]; run.money = 10; run.plays.pair = 2; UI.saveRun(); UI.refresh(); return 1;`);
  await quiet();
  const before = await runJs(`return run.jokers.map((j) => j.uid + ':' + (j.edition || ''));`);
  await page.click('#racks .jk[data-consumable-uid]');
  await page.waitFor('#dialogs [data-action="use-consumable"]');
  await page.sleep(100);
  await page.click('#dialogs [data-action="use-consumable"]');
  await until('the card to be used', (s) => !s.busy && s.dialogs === 0);
  await page.sleep(200);
  const tale = await runJs(`const made = run.jokers.find((j) => !${JSON.stringify(before)}.some((b) => b.startsWith(j.uid + ':'))); return { made: made && { id: made.id, edition: made.edition, name: Cn.JOKERS.find((x) => x.id === made.id).name, ed: made.edition ? Cn.EDITIONS.find((e) => e.id === made.edition).name : null }, said: [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).join(' | ') + ' || ' + document.querySelector('#live').textContent, kept: run.jokers.filter((j) => ${JSON.stringify(before)}.includes(j.uid + ':' + (j.edition || ''))).length };`);
  ok(tale.made && tale.kept === 2, 'Tall Tale made one Joker and left the two the player had as they were', tale);
  ok(!/A Joker became/.test(tale.said), 'no Joker the player had is said to have changed', tale.said);
  if (tale.made.edition) ok(tale.said.includes(`${tale.made.name} (${tale.made.ed}) joins your Jokers.`), 'the new Joker\'s Edition is in the sentence that brings it', tale);
  else ok(tale.said.includes(`${tale.made.name} joins your Jokers.`), 'the new Joker joins (this seed rolled no Edition)', tale);
  out.tale = tale.said;

  }
  if (on(6)) {
  // ------------------------------------------------------------ 6. D2, D3: the Collection
  for (const [w, h, mobile] of [[390, 844, true], [1024, 768, false], [1440, 900, false]]) {
    await page.viewport(w, h, mobile);
    await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.setRun(null); const R = TW.UI.records(); R.discovered = Object.assign({}, R.discovered, { jokers: TW.Content.JOKERS.slice(0, 5).map((j) => j.id) }); TW.UI.show('collection'); return 1; })()`);
    await until('the Collection', (s) => s.screen === 'collection');
    await quiet();
    const co = await js(`(async () => {
      const box = document.querySelector('.co-tabs'), plate = document.querySelector('.co-plate'), b = box.getBoundingClientRect(), p = plate.getBoundingClientRect();
      const cut = [...document.querySelectorAll('.co-tab')].filter((t) => { const r = t.getBoundingClientRect(); return !(r.left >= b.left - 0.5 && r.right <= b.right + 0.5 && r.left >= p.left && r.right <= p.right && r.width > 0); }).map((t) => t.textContent);
      const img = document.querySelector('.co-item.is-locked .co-card img.face');
      const i = new Image(); i.src = img.src; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      const d = g.getImageData(0, 0, i.width, i.height).data; let n = 0, dark = 0, sum = 0;
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      for (let k = 0; k < d.length; k += 4) { if (d[k + 3] < 200) continue; const L = 0.2126 * lin(d[k]) + 0.7152 * lin(d[k + 1]) + 0.0722 * lin(d[k + 2]); n++; sum += L; if (L < 0.006) dark++; }
      return { tabs: document.querySelectorAll('.co-tab').length, cut, scroller: box.scrollWidth > box.clientWidth + 1 || getComputedStyle(box).overflowX !== 'visible', filter: getComputedStyle(img).filter, meanL: sum / n, darkShare: dark / n };
    })()`);
    ok(co.tabs === 7 && !co.cut.length && !co.scroller, `the Collection's seven tabs show whole at ${w} x ${h}, with no hidden scroller`, co);
    ok(co.filter === 'none' && co.meanL > 0.02 && co.darkShare < 0.2, `a locked tile is warm plum at ${w} x ${h}: no filter, no near-black wall`, co);
  }
  await js(`(() => { TW.UI.show('title'); return 1; })()`);

  }
  if (on(7)) {
  // ------------------------------------------------------------ 7. I1, I3: a phone's fanned hand; a 360 x 640 Tarot Pack
  await page.viewport(390, 844, true);
  await fresh('QALAYERS');
  await toPlay();
  await runJs(`const spec = [{ rank: 14, suit: 'S', seal: 'encore' }, { rank: 5, suit: 'H', seal: 'paid' }, { rank: 8, suit: 'D', seal: 'airmail' }, { rank: 12, suit: 'C', seal: 'cameo' }, { rank: 9, suit: 'C' }, { rank: 10, suit: 'H', seal: 'encore' }, { rank: 3, suit: 'S' }, { rank: 7, suit: 'D', seal: 'paid' }];
    run.blind.hand.slice(0, 8).forEach((u, i) => { const c = E.getCard(run, u), s = spec[i]; Object.assign(c, { rank: s.rank, suit: s.suit, enhancement: null, edition: null, seal: s.seal || null }); });
    run.sortMode = 'manual'; UI.update(); return 1;`);
  await quiet();
  const sealCheck = () => runJs(`
    const hand = document.querySelector('#hand'), cards = [...hand.querySelectorAll('.card')];
    const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return { fanned: hand.classList.contains('is-fanned'), seals: cards.map((n, i) => {
      const c = E.getCard(run, n.dataset.uid); if (!c.seal) return null;
      const b = n.querySelector('.seal-badge'); if (!b) return { i, badge: false };
      const r = b.getBoundingClientRect(); let hid = 0; cards.slice(i + 1).forEach((m) => { hid = Math.max(hid, inter(r, m.getBoundingClientRect())); });
      const bare = n.querySelector('img.face').getAttribute('src') === TW.Art.url(UI.cardSpriteId(Object.assign({}, c, { seal: null })));
      return { i, shown: Math.round((1 - hid / (r.width * r.height)) * 100) / 100, bare, last: i === cards.length - 1 };
    }).filter(Boolean) };`);
  for (const lift of [false, true]) {
    if (lift) { await page.key('1'); await page.key('2'); await page.sleep(100); }
    const sc = await sealCheck();
    ok(sc.fanned && sc.seals.length === 6 && sc.seals.every((s) => s.shown >= 0.99), `on a phone's fanned hand every Seal shows whole${lift ? ', two cards chosen' : ''} (they showed 6 to 41 % before)`, sc);
    ok(sc.seals.every((s) => s.bare === !s.last), 'each covered card\'s picture leaves its Seal out, so none shows twice; the last card is drawn whole', sc);
  }
  await page.viewport(360, 640, true);
  await fresh('FIXSMALL');
  await runJs(`Cn.JOKERS.filter((j) => j.rarity === 'common').slice(0, 4).forEach((j) => E.addJoker(run, j.id)); run.money = 30; UI.saveRun(); UI.update(); return 1;`);
  await toPlay();
  await runJs('run.blind.target = 1; UI.update(); return 1;');
  await page.key('1'); await page.key('Enter');
  await until('the cash-out', (s) => s.screen === 'cashout' && !s.busy, 30000);
  await quiet();
  await js(`document.querySelector('[data-action="collect"]').click(), 1`);
  await until('the Shop', (s) => s.screen === 'shop' && !s.busy);
  await runJs(`const packs = run.shop.items.filter((x) => x && x.slot === 'pack'); const rowT = Cn.PACKS.find((p) => p.kind === 'tarot' && p.size === 'normal'); Object.assign(packs[0], { kind: 'pack', id: rowT.id, price: rowT.price, size: rowT.size, sold: false }); run.money = 40; UI.update(); return 1;`);
  await quiet();
  const pk = await runJs(`return run.shop.items.findIndex((x) => x && x.slot === 'pack' && !x.sold);`);
  await js(`document.querySelector('[data-action="buy"][data-index="${pk}"]').click(), 1`);
  await until('the pack', (s) => s.screen === 'pack' && !s.busy);
  await quiet();
  const pack = await js(`(() => {
    const o = [...document.querySelectorAll('.pk-opt')].map((n) => { const r = n.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5; });
    const row = document.querySelector('.pk-opts'), cs = getComputedStyle(row);
    return { n: o.length, inView: o.filter(Boolean).length, scroller: cs.overflowX !== 'visible' && row.scrollWidth > row.clientWidth + 1, page: [document.scrollingElement.scrollHeight, innerHeight, document.scrollingElement.scrollWidth, innerWidth] };
  })()`);
  ok(pack.n === 4 && pack.inView === 4 && !pack.scroller, 'a 360 x 640 Tarot Pack shows its four options whole, with no sideways scroll (the fourth was a scroll away)', pack);
  ok(pack.page[0] <= pack.page[1] + 1 && pack.page[2] <= pack.page[3] + 1, 'and no page scroll', pack.page);
  const reads = await runJs(`
    const det = () => document.querySelector('#pkDetail'), list = Cn.TAROTS.map((x) => ['tarot', x.id]).concat(Cn.SPECTRALS.map((x) => ['spectral', x.id])), bad = [];
    for (const [kind, id] of list) {
      run.pack.options = run.pack.options.map(() => ({ kind, id }));
      UI.update();
      const d = det(), r = d.getBoundingClientRect(), last = d.lastElementChild.getBoundingClientRect();
      if (d.scrollHeight > d.clientHeight + 1 || last.bottom > r.bottom - parseFloat(getComputedStyle(d).paddingBottom) + 1) bad.push(id);
    }
    return { n: list.length, bad };`);
  ok(reads.n > 30 && !reads.bad.length, `every Tarot and Spectral reading shows whole on the 360 x 640 pack's plate (${reads.n} readings; the third line was cut before)`, reads);
  await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); TW.UI.setRun(null); TW.UI.show('title'); return 1; })()`);
  await page.viewport(1440, 900, false);

  }
  if (on(8)) {
  // ------------------------------------------------------------ 8. at real speed: the deal holds input; mute rests the audio
  const real = url.replace(/([?&])test=1&?/, '$1').replace(/[?&]$/, '');
  await page.goto(real, { wait: 600 });
  await until('the title (real speed)', (s) => s.screen === 'title');
  ok(!(await js('TW.UI.TEST')), 'section 8 runs at real speed');
  await js(`(() => { TW.UI.setSetting('muted', false); TW.UI.setSetting('music', 40); TW.UI.setSetting('speed', 2); TW.UI.store.remove('run'); __wick.newRun({ seed: 'QADEAL01' }); return 1; })()`);
  await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
  await quiet();
  await page.click('[data-action="start-blind"]');
  // sample from the click: while a card of the hand is still flying in, busy is '1' and a number key chooses nothing
  const samples = [];
  let pressed = false;
  for (let k = 0; k < 40; k++) {
    const s = await js(`(() => { const cards = [...document.querySelectorAll('#hand .card')]; const flying = cards.filter((c) => c.getAnimations().some((a) => a.playState === 'running')).length; return { flying, busy: document.body.dataset.busy, sel: TW.UI.table.selected().length }; })()`);
    samples.push(s);
    if (s.flying && !pressed) { await page.key('1'); await page.key('2'); await page.key('Enter'); pressed = true; }
    if (!s.flying && samples.some((x) => x.flying)) break;
    await page.sleep(30);
  }
  const dealt = await until('the deal to land', (s) => s.screen === 'play' && !s.busy, 8000);
  ok(samples.some((s) => s.flying) && samples.every((s) => !s.flying || s.busy === '1'), 'busy is \'1\' for as long as a card of the hand is in flight (it stayed \'0\')', samples);
  ok(pressed && dealt.handsLeft === 4 && dealt.selected.length === 0, 'keys pressed mid-deal choose and play nothing (a hand was played mid-deal before)', dealt);
  await page.key('1');
  await page.sleep(80);
  ok((await state()).selected.length === 1, 'once the cards have landed, a key chooses a card');
  // the audio: music plays; Mute all rests the context and stops the scheduler; unmuted, it wakes
  await page.sleep(1200);
  const a0 = await js('TW.Audio.state()');
  await js(`(() => { TW.UI.setSetting('muted', true); return 1; })()`);
  await page.sleep(7000); // the sounds still playing ring out first
  const a1 = await js('TW.Audio.state()');
  await js(`(() => { TW.UI.setSetting('muted', false); return 1; })()`);
  await page.sleep(400);
  const a2 = await js('TW.Audio.state()');
  out.audio = { before: [a0.context, a0.music.scheduler], muted: [a1.context, a1.music.scheduler], after: [a2.context, a2.music.scheduler] };
  if (a0.supported && a0.ready) {
    ok(a0.context === 'running' && a0.music.scheduler, 'music plays at the table', a0);
    ok(a1.context === 'suspended' && !a1.music.scheduler && a1.muted, 'Mute all: the audio context is suspended and the music scheduler stops (they kept running before)', a1);
    ok(a2.context === 'running' && a2.music.scheduler && a2.music.songs >= 1, 'unmuted, it wakes and the music carries on', a2);
  }
  // the drawn numbers stay under their cap after a payout or two
  for (let k = 0; k < 2; k++) {
    const s = await state();
    if (s.screen !== 'play') break;
    if (!s.selected.length) await page.key('1');
    await page.key('Enter');
    await until('the payout to end', (x) => !x.busy && (x.screen !== 'play' || x.handsLeft < s.handsLeft), 40000);
    await quiet(8000);
  }
  const cached = await js('[TW.UI.paint.numCached(), TW.UI.paint.NUM_CAP]');
  ok(cached[0] > 0 && cached[0] <= cached[1], 'the drawn numbers stay under their cap', cached);
  await js(`(() => { TW.UI.setSetting('music', 40); TW.UI.store.remove('run'); return 1; })()`);
  }
  return { checks: checks.length, list: checks, out, test };
}
