// Regression checks for the final pass's accessibility batch (2026-11-24), a tools/cdp.mjs scenario. Run it in test
// mode; it sets its own window sizes, and its last section looks at the motion at real speed. Sections (ONLY=3,9 runs
// those alone, to show what one of them finds on an older build):
//   1. P5   the title at load: focus is left alone, and the first Tab lands on its first control with the ring showing;
//   2. A1   the column's readouts are plain text, not live regions; the Collect line is said before the Shop's;
//   3. A2   the focus ring is two-tone (pale yellow outside, dark plum inside) and shows whole all round a hand card,
//          which comes up over its neighbour, and round the Sort button on the lit floor (pixels read from a capture);
//   4. A3   Shift with an arrow moves the focused card; the Move pair moves the one chosen card with a click;
//   5. A4   Enter on a card chooses it and plays nothing; Options switches the one-key shortcuts off (and on);
//          Options and How to play list the keys;
//   6. A5   a hover tip can be hovered and closes once the pointer has left; Esc closes a tip on its own (no Pause);
//   7. A6   at 720 x 450 the Deck view's body is a named stop the keys scroll; its cards are a grid of one stop;
//   8. A7   focus goes back to Pause's button after Options, Overview and How to play; to the next Joker after a sale;
//          to the hand after Play at the Blind select; and a hand played from the page (1, Enter) leaves it there, so Enter plays again;
//   9. A8   toasts are said: Save and quit, Run abandoned; an error is said once;
//  10. A9   choosing cards with the number keys says the cards and the hand they make;
//  11. A10  the pressed segment of a toggle group carries a bar under its label (Sort, Game speed), not hue alone;
//  12. A11  names: How to play's Back, the phone's deck chip, the phone's Consumables heading;
//  13. A15  a phone with text-spacing overrides: the Blind pill keeps its whole name;
//  14. A16  720 x 450: a Boss rule cut to two lines is a stop whose tip shows the whole rule;
//  15. A17  a card's name says what The Wash-Out and The Blackout switch off; a focused card is described by its tip;
//  16. A14  at real speed with Reduce motion: the switch knob and the Stake chips have no transition;
//  17. 1.4.3 every pill tone keeps 4.5:1 between its ink and its fill (the Mult and Chips pills read at 3.8 and 4.3:1;
//          found by a11y.mjs while this batch was checked). Section 17 runs before 16, which leaves test mode.
// cdp.mjs fails the run on any console error or exception.
// Usage: node tools/cdp.mjs run "http://localhost:5205/build/index.html?test=1&seed=ACCESS01" tests/e2e/access.mjs
export default async function access(page, { url }) {
  const js = (e) => page.eval(e);
  const runJs = (body) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${body} })()`);
  const state = async () => JSON.parse(await js('JSON.stringify(__wick.state())'));
  const fail = (m, x) => { throw new Error(m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 1500) : '')); };
  const checks = [];
  const ok = (cond, msg, x) => { if (!cond) fail(msg, x); checks.push(msg); };
  const until = async (what, f, ms = 15000) => { const end = Date.now() + ms; let s; while (Date.now() < end) { s = await state(); if (f(s)) return s; await page.sleep(40); } fail('timed out: ' + what, s); };
  const quiet = async (ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { const n = await js(`document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming && a.effect.getTiming().iterations !== Infinity).length`); if (!n) return; await page.sleep(60); } };
  const fresh = async (seed) => {
    await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.hideTip(); TW.UI.store.remove('run'); __wick.newRun({ seed: '${seed}' }); return 1; })()`);
    await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
    await quiet();
  };
  const toPlay = async () => {
    await page.click('[data-action="start-blind"]');
    await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
    await quiet();
  };
  const hover = (x, y) => page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  const CODES = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, PageDown: 34, PageUp: 33, Home: 36, End: 35 };
  /** A key with modifiers (Shift 8), or one cdp.mjs's page.key does not know (PageDown). */
  const keyMod = async (key, modifiers = 0) => {
    const k = CODES[key];
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: k, nativeVirtualKeyCode: k, modifiers });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: k, nativeVirtualKeyCode: k, modifiers });
  };
  /** Keyboard focus on a node: a key press first, so the page's focus is a keyboard player's (:focus-visible). */
  const kbdFocus = async (sel, i = 0) => {
    await js(`(() => { const a = document.activeElement; if (a && a.blur) a.blur(); return 1; })()`);
    await keyMod('ArrowDown'); // a key that does nothing here, so the page counts the keyboard as in use
    return js(`(() => { const n = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!n) return null; n.focus(); return n.matches(':focus-visible'); })()`);
  };
  /** Every line #live says from now on. */
  const listen = () => js(`(() => { window.__said = []; const live = document.querySelector('#live'); if (window.__liveMo) window.__liveMo.disconnect(); window.__liveMo = new MutationObserver(() => { if (live.textContent) window.__said.push(live.textContent); }); window.__liveMo.observe(live, { childList: true, characterData: true, subtree: true }); return 1; })()`);
  const said = () => js('(window.__said || []).slice()');
  const active = () => js(`(() => { const a = document.activeElement; return a ? { tag: a.tagName, id: a.id, action: a.dataset ? a.dataset.action || '' : '', uid: a.dataset ? a.dataset.uid || a.dataset.jokerUid || '' : '', cls: String(a.className || ''), visible: a.matches(':focus-visible'), label: a.getAttribute('aria-label') || '' } : null; })()`);
  const tip = () => js(`(() => { const t = document.querySelector('#tip'); const r = t.getBoundingClientRect(); return { hidden: t.hidden, text: t.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, pe: getComputedStyle(t).pointerEvents }; })()`);
  /** The pixels of a part of the screen, read in the page from a capture: { at(x, y) -> [r, g, b] } as an array grid. */
  const capture = async (clip) => {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: Object.assign({ scale: 1 }, clip) });
    return js(`(async () => { const img = new Image(); img.src = 'data:image/png;base64,${data}'; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); window.__px = g.getImageData(0, 0, c.width, c.height); return [c.width, c.height]; })()`);
  };
  const pxAt = (x, y) => js(`(() => { const d = window.__px, i = (${Math.round(y)} * d.width + ${Math.round(x)}) * 4; return [d.data[i], d.data[i + 1], d.data[i + 2]]; })()`);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const test = /[?&]test=1(&|$)/.test(url);
  const ONLY = String(process.env.ONLY || '').split(',').filter(Boolean).map(Number);
  const on = (n) => !ONLY.length || ONLY.includes(n);
  const out = {};

  await page.viewport(1440, 900, false);
  await page.goto(url, { wait: 500 });
  await until('the title', (s) => s.screen === 'title');

  if (on(1)) {
    // ------------------------------------------------------------ 1. P5: the title at load
    await page.sleep(200);
    const load = await active();
    ok(load && load.tag === 'BODY', 'at load the title leaves focus alone (it focused New run with no ring before)', load);
    await page.key('Tab');
    const first = await js(`(() => { const a = document.activeElement, b = document.querySelector('.tt-go .btn'); return { same: a === b, action: a && a.dataset.action, visible: !!a && a.matches(':focus-visible'), outline: a ? getComputedStyle(a).outlineStyle : '' }; })()`);
    ok(first.same && /^(continue|new-run)$/.test(first.action) && first.visible && first.outline === 'solid', 'the first Tab lands on the title\'s first control, ring showing (it skipped to the seed field before)', first);
  }

  if (on(2)) {
    // ------------------------------------------------------------ 2. A1: plain readouts; the Collect line in order
    await fresh('ACCESS02');
    await toPlay();
    const outs = await js(`['score', 'chips', 'mult', 'hands', 'discards', 'money'].map((id) => { const n = document.getElementById(id); return { id, tag: n && n.tagName, live: !!(n && n.closest('[aria-live], output, [role="status"], [role="log"]')) }; })`);
    ok(outs.every((o) => o.tag === 'SPAN' && !o.live), 'the six column readouts are plain text, never live regions (they were <output> status regions)', outs);
    await page.send('Accessibility.enable');
    const ax = await page.send('Accessibility.getFullAXTree');
    await page.send('Accessibility.disable');
    const status = (ax.nodes || []).filter((n) => n.role && n.role.value === 'status').length;
    ok(status === 0, 'the accessibility tree has no status regions on the table (it had six)', { status });
    const names = await js(`[...document.querySelectorAll('#chipsBox > .sr, #multBox > .sr')].map((n) => n.textContent)`);
    ok(names.join() === 'Chips,Mult', 'the wells still say what they hold', names);
    await runJs('run.blind.target = 1; UI.update(); return 1;');
    await page.key('1'); await page.key('Enter');
    await until('the cash-out', (s) => s.screen === 'cashout' && !s.busy, 30000);
    await quiet();
    await listen();
    await page.click('[data-action="collect"]');
    await until('the Shop', (s) => s.screen === 'shop' && !s.busy);
    await page.sleep(150);
    const lines = await said();
    ok(lines.some((t) => /Collected \$\d+\. Shop\. You have \$\d+\./.test(t) && !/Shop\..*Collected/.test(t)), 'the Collect line comes first, then the Shop\'s (it read "Shop ... Collected $6. Money $10.")', lines);
  }

  if (on(3)) {
    // ------------------------------------------------------------ 3. A2: the two-tone ring, whole all round
    await page.viewport(1440, 900, false);
    await fresh('ACCESS03');
    await toPlay();
    const ringAt = async (sel, i, label) => {
      ok(await kbdFocus(sel, i), `${label} has keyboard focus`);
      await js('TW.UI.hideTip(), 1');
      await page.sleep(80);
      const st = await js(`(() => { const n = document.activeElement, cs = getComputedStyle(n), r = n.getBoundingClientRect(); return { outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, offset: cs.outlineOffset, shadow: cs.boxShadow, z: cs.zIndex, r: [r.left, r.top, r.right, r.bottom] }; })()`);
      ok(/solid 2px rgb\(255, 240, 160\)/.test(st.outline) && /rgb\(43, 18, 32\)/.test(st.shadow), `${label}: a pale yellow ring with a dark plum band inside it`, st);
      const [l, t, rr, b] = st.r, pad = 12, x0 = Math.floor(l) - pad, y0 = Math.floor(t) - pad;
      await capture({ x: x0, y: y0, width: Math.ceil(rr) - x0 + pad, height: Math.ceil(b) - y0 + pad });
      // the band sits 0 to 3 px outside the box, the ring 3 to 5 px: midway along each side, the darkest pixel of the
      // band's span and the brightest of the ring's (the edges may fall between pixels)
      const cx = (l + rr) / 2 - x0, cy = (t + b) / 2 - y0;
      const along = { left: (d) => [l - x0 - d, cy], right: (d) => [rr - x0 + d, cy], top: (d) => [cx, t - y0 - d], bottom: (d) => [cx, b - y0 + d] };
      const got = {};
      for (const [k, at] of Object.entries(along)) {
        const band = [], ring = [];
        for (const d of [0.6, 1.2, 1.8, 2.4]) band.push(await pxAt(...at(d)));
        for (const d of [3.4, 4, 4.6]) ring.push(await pxAt(...at(d)));
        got[k] = { band: band.reduce((m, p) => (lum(p) < lum(m) ? p : m)), ring: ring.reduce((m, p) => (lum(p) > lum(m) ? p : m)) };
      }
      const bad = Object.entries(got).filter(([, v]) => !(lum(v.band) < 0.03 && lum(v.ring) > 0.6 && ratio(v.band, v.ring) >= 3));
      ok(!bad.length, `${label}: the ring shows on all four sides, dark band and pale ring at 3:1 or more to each other (one of the two always clears 3:1 on what is behind)`, { got, bad: bad.map(([k]) => k) });
      return st;
    };
    const card = await ringAt('#hand .card', 3, 'a hand card');
    ok(card.z === '30', 'the focused card comes up over its neighbours, so the next card no longer covers its ring', card.z);
    await ringAt('.controls [data-action="sort-rank"]', 0, 'the Sort button on the lit floor');
    await ringAt('.r-btns [data-action="open-options"]', 0, 'the column\'s Options button');
  }

  if (on(4)) {
    // ------------------------------------------------------------ 4. A3: reorder without a drag
    await page.viewport(1440, 900, false);
    await fresh('ACCESS04');
    await toPlay();
    const h0 = (await state()).hand;
    ok(await kbdFocus('#hand .card', 2), 'the third card has keyboard focus');
    await listen();
    await keyMod('ArrowLeft', 8);
    await page.sleep(150);
    const h1 = (await state()).hand;
    ok(h1[1] === h0[2] && h1[2] === h0[1], 'Shift+ArrowLeft moves the focused card one place left (no key moved a card before)', { h0, h1 });
    ok(await runJs(`return run.blind.hand.join() === '${h1.join()}' && run.sortMode === 'manual';`), 'the engine keeps the new order, as a drag does');
    const a1 = await active();
    ok(a1 && a1.uid === h0[2] && a1.visible, 'focus stays on the moved card, ring showing', a1);
    await page.sleep(100);
    ok((await said()).some((t) => /moved left, 2 of \d+\./.test(t)), 'the move is said with the card\'s new place', await said());
    await keyMod('ArrowRight', 8);
    await page.sleep(120);
    ok((await state()).hand[2] === h0[2], 'Shift+ArrowRight moves it back');
    // the Move pair: a click moves the one chosen card
    await js('document.activeElement.blur(), 1');
    ok(await js(`document.querySelector('#mover').hidden`), 'no Move pair while no card is chosen');
    await page.key('5');
    await page.sleep(80);
    const mv = await js(`(() => { const m = document.querySelector('#mover'), r = m.getBoundingClientRect(); return { hidden: m.hidden, labels: [...m.querySelectorAll('.mv-btn')].map((b) => b.getAttribute('aria-label')), r: [r.left, r.top, r.width, r.height], hand: document.querySelector('#hand').getBoundingClientRect().top }; })()`);
    ok(!mv.hidden && mv.labels.length === 2 && /^Move .+ left$/.test(mv.labels[0]) && /^Move .+ right$/.test(mv.labels[1]) && mv.r[1] + mv.r[3] <= mv.hand, 'with one card chosen, a Move pair named for that card stands over the hand', mv);
    const sel = (await state()).selected[0];
    await page.click('#mover .mv-btn[data-dir="1"]');
    await page.sleep(150);
    const h2 = (await state()).hand;
    ok(h2.indexOf(sel) === 5, 'a click on Move right moves the chosen card one place right (only a drag could before)', { h2, sel });
    const a2 = await active();
    ok(a2 && a2.action === 'move-card', 'focus stays on the arrow pressed', a2);
    await page.key('1');
    await page.sleep(80);
    ok(await js(`document.querySelector('#mover').hidden`), 'with two cards chosen the pair steps aside');
  }

  if (on(5)) {
    // ------------------------------------------------------------ 5. A4: Enter on a card; the shortcuts switch
    await page.viewport(1440, 900, false);
    await fresh('ACCESS05');
    await toPlay();
    // the finding's repro: two cards chosen by key, then Enter with focus on another card
    await page.key('2'); await page.key('3');
    const s0 = await state();
    ok(s0.selected.length === 2, 'two cards chosen by key');
    ok(await kbdFocus('#hand .card', 0), 'the first card has keyboard focus');
    await page.key('Enter');
    await page.sleep(120);
    const s1 = await state();
    ok(s1.selected.length === 3 && s1.selected.includes(s0.hand[0]) && s1.handsLeft === s0.handsLeft, 'Enter on a focused card chooses it, as Space does, and plays nothing (it played the chosen hand before)', s1);
    await page.key('Enter');
    await page.sleep(80);
    ok((await state()).selected.length === 2, 'and Enter again puts it back');
    await js('TW.UI.hideTip(), document.activeElement.blur(), TW.UI.openOverlay("options"), 1');
    await page.waitFor('#dialogs .op-dlg [data-action="toggle-keys"]');
    const hint = await js(`document.querySelector('#opKeysHint').textContent`);
    ok(/1 to 9/.test(hint) && /D discards/.test(hint) && /I opens the Overview/.test(hint), 'Options lists the one-key shortcuts under their switch', hint);
    ok(await js(`document.querySelector('[data-action="toggle-keys"]').getAttribute('aria-checked')`) === 'true', 'the shortcuts are on by default');
    await page.click('#dialogs [data-action="toggle-keys"]');
    await page.sleep(60);
    const off = await js(`({ checked: document.querySelector('[data-action="toggle-keys"]').getAttribute('aria-checked'), keys: TW.UI.settings().keys, stored: JSON.parse(TW.UI.store.get('settings')).keys })`);
    ok(off.checked === 'false' && off.keys === false && off.stored === false, 'Options switches them off, and the choice is kept', off);
    await page.key('Escape');
    await page.sleep(80);
    const b0 = await state(), sort0 = await runJs('return run.sortMode;');
    await page.key('5'); await page.key('d'); await page.key('s'); await page.key('i');
    await page.sleep(120);
    const s2 = await state();
    ok(s2.selected.join() === b0.selected.join() && s2.discardsLeft === b0.discardsLeft && s2.hand.join() === b0.hand.join() && s2.dialogs === 0 && (await runJs('return run.sortMode;')) === sort0, 'with them off, 5, D, S and I do nothing: two cards chosen, and a stray "d" spends no discard (it did before)', s2);
    await js('TW.UI.setSetting("keys", true), 1');
    await page.key('5');
    await page.sleep(60);
    ok((await state()).selected.length === 3, 'switched on again, the number keys choose');
    await js('TW.UI.openOverlay("help", { page: 0 }), 1');
    await page.waitFor('#dialogs .hp-dlg');
    const help = await js(`document.querySelector('#hpPanel').textContent`);
    ok(/1 to 9 choose cards/.test(help) && /Options can switch the one-key shortcuts off/.test(help), 'How to play lists the keys', help.slice(0, 200));
    await js('TW.UI.closeAllDialogs(), 1');
  }

  if (on(6) && !(await js('TW.UI.MQ.phone.matches'))) {
    // ------------------------------------------------------------ 6. A5: a tip that can be hovered, and Esc
    await page.viewport(1440, 900, false);
    await fresh('ACCESS06');
    await runJs(`const id = Cn.JOKERS.find((j) => j.rarity === 'common').id; E.addJoker(run, id); E.addJoker(run, Cn.JOKERS.filter((j) => j.rarity === 'common')[1].id); UI.saveRun(); UI.update(); return 1;`);
    await quiet();
    const jb = await page.box('#jokerRack .jk');
    await hover(5, 450);
    await page.sleep(100);
    await hover(jb.x, jb.y);
    await page.sleep(700);
    const t0 = await tip();
    ok(!t0.hidden && t0.pe === 'auto', 'hovering a Joker shows its tip, which takes the pointer', t0);
    for (let k = 1; k <= 6; k++) { await hover(jb.x + ((t0.x - jb.x) * k) / 6, jb.y + ((t0.y - jb.y) * k) / 6); await page.sleep(30); }
    await page.sleep(450);
    ok(!(await tip()).hidden, 'moving the pointer onto the tip keeps it open (it closed before)');
    await hover(5, 450);
    await page.sleep(450);
    ok((await tip()).hidden, 'once the pointer has left the tip and its Joker, it closes');
    await hover(jb.x, jb.y);
    await page.sleep(700);
    const t1 = await tip();
    for (let k = 1; k <= 6; k++) { await hover(jb.x + ((t1.x - jb.x) * k) / 6, jb.y + ((t1.y - jb.y) * k) / 6); await page.sleep(30); }
    await page.mouse(t1.x, t1.y);
    await page.sleep(120);
    ok((await tip()).hidden && (await state()).dialogs === 0, 'a press on the tip closes it and does nothing else (it never keeps a control under it from the next click)');
    await hover(5, 450);
    await page.sleep(100);
    await hover(jb.x, jb.y);
    await page.sleep(700);
    ok(!(await tip()).hidden, 'hovered again, it shows');
    await page.key('Escape');
    await page.sleep(100);
    const e1 = await state();
    ok((await tip()).hidden && e1.dialogs === 0, 'Esc closes the tip on its own: Pause does not open (it opened before)', e1);
    await hover(5, 450);
    ok(await kbdFocus('#jokerRack .jk', 0), 'the Joker has keyboard focus');
    await page.sleep(60);
    ok(!(await tip()).hidden, 'its tip shows on focus');
    await page.key('Escape');
    await page.sleep(100);
    const a = await active(), e2 = await state();
    ok((await tip()).hidden && e2.dialogs === 0 && /jk/.test(a.cls), 'Esc closes the focus tip alone; focus stays on the Joker (Pause opened and took focus before)', { a, e2 });
    await page.key('Escape');
    await page.sleep(100);
    ok((await state()).dialogs === 1, 'the next Esc opens Pause');
    await js('TW.UI.closeAllDialogs(), 1');
  }

  if (on(7)) {
    // ------------------------------------------------------------ 7. A6: the Deck view at 720 x 450 (200 % zoom)
    await page.viewport(720, 450, false);
    await fresh('ACCESS07');
    await toPlay();
    await js('TW.UI.openOverlay("deck"), 1');
    await page.waitFor('#dialogs .dv-dlg');
    await page.sleep(300);
    const body = await js(`(() => { const b = document.querySelector('.dv-dlg .dlg-body'), t = document.getElementById(b.getAttribute('aria-labelledby')); return { over: b.scrollHeight > b.clientHeight + 1, tab: b.getAttribute('tabindex'), role: b.getAttribute('role'), name: t ? t.textContent : b.getAttribute('aria-label') }; })()`);
    ok(body.over && body.tab === '0' && body.role === 'region' && /^Deck/.test(body.name), 'the Deck view\'s body is taller than its room, and a named region the keyboard can reach', body);
    await page.key('Tab');
    const a = await active();
    ok(a && /dlg-body/.test(a.cls) && a.visible, 'Tab reaches the body (focus only cycled Close before)', a);
    await keyMod('ArrowDown'); await keyMod('ArrowDown'); await keyMod('PageDown');
    await page.sleep(200);
    const top = await js(`document.querySelector('.dv-dlg .dlg-body').scrollTop`);
    ok(top > 40, 'the arrow and page keys scroll it (it stayed at 0)', { top });
    await page.key('Tab');
    const c1 = await active();
    ok(c1 && /dv-card/.test(c1.cls) && c1.visible && !(await tip()).hidden, 'the next stop is the first card, its tip showing', c1);
    await keyMod('ArrowRight');
    await page.sleep(60);
    const c2 = await active();
    ok(c2 && /dv-card/.test(c2.cls) && c2.uid !== c1.uid && (await tip()).text.length > 0, 'the arrow keys walk the cards, each tip on focus', { c1, c2 });
    const desc = await js(`(() => { const a = document.activeElement, ids = (a.getAttribute('aria-describedby') || '').split(' ').filter(Boolean); return ids.map((id) => (document.getElementById(id) || {}).textContent || '').join(' '); })()`);
    ok(/Chips when scored|Drawn this Blind|[A-Z]/.test(desc) && desc.length > 5, 'a focused card is described by its tip (what it does)', desc);
    await js('TW.UI.closeAllDialogs(), TW.UI.hideTip(), 1');
    await page.viewport(1440, 900, false);
  }

  if (on(8)) {
    // ------------------------------------------------------------ 8. A7: focus never drops to the page
    await page.viewport(1440, 900, false);
    await fresh('ACCESS08');
    await toPlay();
    for (const [action, sel] of [['pause-options', '.op-dlg'], ['open-run-info', '.ri-dlg'], ['open-help', '.hp-dlg']]) {
      await js('TW.UI.hideTip(), 1');
      await page.key('Escape');
      await page.waitFor('#dialogs .pz-dlg');
      await page.sleep(60);
      ok(await kbdFocus(`#dialogs .pz-dlg [data-action="${action}"]`), `Pause's ${action} button has keyboard focus`);
      await page.key('Enter');
      await page.waitFor(`#dialogs ${sel}`);
      await page.sleep(80);
      for (let k = 0; k < 3 && (await state()).dialogs > 1; k++) { await page.key('Escape'); await page.sleep(80); }
      const a = await active(), s = await state();
      ok(s.dialogs === 1 && a && a.action === action && a.visible, `closing ${sel.slice(1)} opened from Pause puts focus back on its button in Pause (it dropped to the page)`, { a, s });
      await page.key('Escape');
      await page.sleep(80);
    }
    // a Joker sold from its sheet: focus goes to the Joker now in its place
    await runJs(`Cn.JOKERS.filter((j) => j.rarity === 'common').slice(0, 2).forEach((j) => E.addJoker(run, j.id)); UI.saveRun(); UI.update(); return 1;`);
    await page.sleep(100);
    const jk = await runJs('return run.jokers.map((j) => j.uid);');
    ok(await kbdFocus('#jokerRack .jk', 0), 'the first Joker has keyboard focus');
    await js('TW.UI.hideTip(), 1');
    await page.key('Enter');
    await page.waitFor('#dialogs .sheet');
    await page.sleep(60);
    for (let k = 0; k < 6; k++) { if ((await active()).action === 'sell-joker') break; await page.key('Tab'); }
    ok((await active()).action === 'sell-joker', 'Tab reaches Sell in the Joker\'s sheet');
    await page.key('Enter');
    await until('the sale', (s) => s.jokers.length === 1 && !s.busy && s.dialogs === 0);
    await page.sleep(100);
    const a1 = await active();
    ok(a1 && a1.uid === jk[1] && a1.visible, 'after the sale, focus is on the Joker now in its place (it was on the page)', a1);
    // Play from the keyboard at the Blind select: focus lands on the dealt hand
    await fresh('ACCESS8B');
    ok(await kbdFocus('[data-action="start-blind"]'), 'Play (the Blind select) has keyboard focus');
    await page.key('Enter');
    await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
    const a2 = await active();
    ok(a2 && a2.id === 'hand' && a2.visible, 'after Play the dealt hand has focus (it was on the page)', a2);
    await page.key('1'); await page.key('2');
    await page.sleep(60);
    const before = (await state()).handsLeft;
    await page.key('Enter');
    await until('the hand to be played', (s) => s.handsLeft === before - 1 && !s.busy, 20000);
    checks.push('from the hand, the number keys choose and Enter plays');
    await page.key('Tab');
    const a3 = await active();
    ok(a3 && /card/.test(a3.cls), 'and Tab walks into the cards', a3);
    // a player on the number keys and Enter from the page: after a hand focus stays on the page, so Enter plays again
    // (it never lands on a card, where Enter now chooses the card)
    await fresh('ACCESS8C');
    await toPlay();
    await js('document.activeElement && document.activeElement.blur(), 1');
    for (let k = 0; k < 2; k++) {
      const h0 = (await state()).handsLeft;
      await page.key('1'); await page.key('Enter');
      await until(`hand ${k + 1} to be played`, (s) => s.handsLeft === h0 - 1 && !s.busy, 20000);
      const f = await active();
      ok(f && f.tag === 'BODY', `after hand ${k + 1} focus stays on the page, so 1 and Enter play the next one`, f);
    }
  }

  if (on(9)) {
    // ------------------------------------------------------------ 9. A8: toasts are said
    await page.viewport(1440, 900, false);
    await fresh('ACCESS09');
    await toPlay();
    await listen();
    await page.key('d');
    await page.sleep(150);
    const e = await said();
    ok(e.filter((t) => t.includes('Select 1 to 5 cards to discard.')).length === 1 && !/discard\..*Select 1 to 5 cards to discard/.test(e.join(' ')), 'an error toast is said, and once', e);
    await page.key('Escape');
    await page.waitFor('#dialogs [data-action="save-quit"]');
    await page.click('#dialogs [data-action="save-quit"]');
    await until('the title', (s) => s.screen === 'title');
    await page.sleep(120);
    ok((await said()).some((t) => t.includes('Run saved. Continue it from the title screen.')), 'Save and quit\'s toast is said (it was seen only)', await said());
    await page.click('[data-action="continue"]');
    await until('the run back', (s) => s.screen === 'play');
    await page.key('Escape');
    await page.waitFor('#dialogs [data-action="abandon"]');
    await page.click('#dialogs [data-action="abandon"]');
    await page.waitFor('#dialogs [data-action="confirm-abandon"]');
    await page.click('#dialogs [data-action="confirm-abandon"]');
    await until('the title', (s) => s.screen === 'title');
    await page.sleep(120);
    ok((await said()).some((t) => t.includes('Run abandoned.')), 'Run abandoned is said', await said());
    ok(await js(`document.querySelector('#toasts').getAttribute('aria-hidden')`) === 'true', 'the toasts stay hidden from assistive tech, so nothing is heard twice');
  }

  if (on(10)) {
    // ------------------------------------------------------------ 10. A9: choosing cards is said
    await page.viewport(1440, 900, false);
    await fresh('ACCESS10');
    await toPlay();
    await js('document.activeElement && document.activeElement.blur(), 1');
    await page.sleep(120);
    await listen();
    await page.key('2'); await page.key('3');
    await page.sleep(500);
    const one = (await said()).filter((t) => /selected|put back/.test(t));
    ok(one.length === 1 && /^\S.* of \S+ and \S.* of \S+ selected\. .+, level \d+: [\d,]+ Chips times [\d.]+ Mult\.$/.test(one[0]), 'two cards chosen by key: one line names them and the hand they make (nothing was said)', one);
    await page.key('2');
    await page.sleep(500);
    const two = await said();
    ok(/put back\. .+, level \d+: /.test(two[two.length - 1]), 'putting one back says so, with the hand now', two);
  }

  if (on(11)) {
    // ------------------------------------------------------------ 11. A10: the pressed segment has a bar
    await page.viewport(1440, 900, false);
    await fresh('ACCESS11');
    await toPlay();
    await page.click('[data-action="sort-rank"]');
    await page.sleep(60);
    const seg = await js(`[...document.querySelectorAll('.controls .seg .btn')].map((b) => ({ p: b.getAttribute('aria-pressed'), d: getComputedStyle(b).textDecorationLine }))`);
    ok(seg.every((x) => (x.p === 'true') === /underline/.test(x.d)), 'the pressed Sort button, and only it, carries a bar under its label (hue alone told them apart)', seg);
    await js('TW.UI.openOverlay("options"), 1');
    await page.waitFor('#dialogs .op-dlg');
    const sp = await js(`[...document.querySelectorAll('[data-action="set-speed"], [data-action="set-motion"]')].map((b) => ({ p: b.getAttribute('aria-pressed'), d: getComputedStyle(b).textDecorationLine }))`);
    ok(sp.filter((x) => x.p === 'true').length === 2 && sp.every((x) => (x.p === 'true') === /underline/.test(x.d)), 'Game speed and Motion mark their choice the same way', sp);
    await js('TW.UI.closeAllDialogs(), 1');
  }

  if (on(12)) {
    // ------------------------------------------------------------ 12. A11: names match what shows
    await page.viewport(390, 844, true);
    await fresh('ACCESS12');
    await runJs(`run.consumables.push({ uid: 'k' + run.nextUid++, kind: 'planet', id: Cn.PLANETS[0].id }); UI.saveRun(); UI.update(); return 1;`);
    await toPlay();
    const n = await js(`(() => { const chip = document.querySelector('.deck-chip'), h = document.querySelector('.rack.r-cons h2'), tw = h.querySelector('.tw'); return { chip: chip.getAttribute('aria-label'), shown: chip.textContent.trim(), head: h.textContent.replace(/\\s+/g, ' ').trim(), twDisplay: getComputedStyle(tw).display, twWidth: tw.getBoundingClientRect().width }; })()`);
    ok(/^Deck, \d+ of \d+ cards left$/.test(n.chip), 'the phone\'s deck chip is named with the count it shows (it was only "Deck")', n);
    ok(/^Consumables \d+\/\d+$/.test(n.head) && n.twDisplay !== 'none' && n.twWidth <= 1, 'the phone\'s Consumables heading keeps its word for a screen reader, out of sight (it read "1/2")', n);
    await js('TW.UI.openOverlay("help"), 1');
    await page.waitFor('#dialogs .hp-dlg');
    const back = await js(`(() => { const b = document.querySelector('[data-action="help-prev"]'); return { shown: b.textContent.trim(), name: b.getAttribute('aria-label') }; })()`);
    ok(back.name.toLowerCase().startsWith(back.shown.toLowerCase()), 'How to play\'s Back is named with the word it shows (it was "Previous page")', back);
    await js('TW.UI.closeAllDialogs(), 1');
  }

  if (on(13)) {
    // ------------------------------------------------------------ 13. A15: text spacing on a phone
    await page.viewport(390, 844, true);
    await fresh('ACCESS13');
    await toPlay();
    const spacing = `(() => { const s = document.createElement('style'); s.id = 'ts'; s.textContent = '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }'; document.head.append(s); return 1; })()`;
    await js(spacing);
    await page.sleep(150);
    const pill = async () => js(`(() => { const p = document.querySelector('#blindTag'), t = p.querySelector('.tw'), r = p.getBoundingClientRect(), q = t.getBoundingClientRect(); return { text: t.textContent, tw: [t.scrollWidth, t.clientWidth], pill: [p.scrollWidth, p.clientWidth], inside: q.right <= r.right + 1 && q.left >= r.left - 1 }; })()`);
    const p1 = await pill();
    ok(p1.tw[0] <= p1.tw[1] + 1 && p1.pill[0] <= p1.pill[1] + 1 && p1.inside, 'with the text-spacing overrides the Blind pill keeps its whole name (it showed "SMALL BLI")', p1);
    await runJs(`run.blind.kind = 'boss'; run.blind.boss = 'shuffler'; UI.update(); return 1;`);
    await page.sleep(100);
    const p2 = await pill();
    ok(p2.tw[0] <= p2.tw[1] + 1 && p2.pill[0] <= p2.pill[1] + 1 && p2.inside, 'and a Boss Blind\'s name too', p2);
    await js(`document.getElementById('ts').remove(), 1`);
    await page.sleep(100);
    const h = await js(`document.querySelector('#blindTag').getBoundingClientRect().height`);
    ok(Math.abs(h - 18) <= 0.5, 'without them the pill keeps its own height (nine art px)', h);
    await page.viewport(1440, 900, false);
  }

  if (on(14)) {
    // ------------------------------------------------------------ 14. A16: a cut Boss rule opens the whole rule
    await page.viewport(720, 450, false);
    await fresh('ACCESS14');
    await runJs(`run.bosses[run.ante] = 'shuffler'; UI.saveRun(); UI.update(); return 1;`);
    await page.sleep(300);
    const full = await runJs(`return (E.blindsForAnte(run).find((b) => b.boss) || {}).boss.text;`);
    const r = await js(`(() => { const n = document.querySelector('.blind-card.b-boss .bc-rule'), c = n.querySelector('.copy'); return { cut: c.scrollHeight > c.clientHeight + 1, cls: n.className, tab: n.getAttribute('tabindex'), name: n.getAttribute('aria-label') || '' }; })()`);
    ok(r.cut && /is-cut/.test(r.cls) && r.tab === '0' && r.name.includes(full), 'at 720 x 450 the Boss rule cut to two lines is a stop named with the whole rule', r);
    ok(await kbdFocus('.blind-card.b-boss .bc-rule'), 'the cut rule takes keyboard focus');
    await page.sleep(60);
    const t = await tip();
    ok(!t.hidden && t.text.includes(full), 'focused, it shows the whole rule in its tip (the rule was readable nowhere on the screen)', { t, full });
    await js('TW.UI.hideTip(), document.activeElement.blur(), 1');
    await page.viewport(1440, 900, false);
    await page.sleep(300);
    const wide = await js(`(() => { const n = document.querySelector('.blind-card.b-boss .bc-rule'); return { cls: n.className, tab: n.getAttribute('tabindex') }; })()`);
    ok(!/is-cut/.test(wide.cls) && wide.tab === null, 'on a wide window the whole rule shows, and it is plain text again', wide);
  }

  if (on(15)) {
    // ------------------------------------------------------------ 15. A17: names under The Wash-Out and The Blackout
    await page.viewport(1440, 900, false);
    await fresh('ACCESS15');
    await toPlay();
    const lab = await runJs(`
      const b = run.blind, c0 = E.getCard(run, b.hand[0]), c1 = E.getCard(run, b.hand[1]);
      c0.enhancement = 'punchy'; c1.edition = 'gloss'; c1.seal = 'encore';
      b.kind = 'boss'; b.boss = 'washout'; UI.update();
      const n = (i) => document.querySelectorAll('#hand .card')[i].getAttribute('aria-label');
      const wash = [n(0), n(1)];
      b.boss = 'censor'; UI.update();
      return { wash, censor: [n(0), n(1)], names: [Cn.BOSSES.find((x) => x.id === 'washout').name, Cn.BOSSES.find((x) => x.id === 'censor').name, Cn.ENHANCEMENTS.find((x) => x.id === 'punchy').name] };`);
    ok(lab.wash[0].endsWith(`Switched off by ${lab.names[0]}: ${lab.names[2]}.`) && !/Switched off/.test(lab.wash[1]), 'under The Wash-Out a card\'s name says its Enhancement is switched off (it read as if it worked)', lab);
    ok(/Switched off by .+: .+ and .+\.$/.test(lab.censor[1]) && lab.censor[1].includes(lab.names[1]) && !/Switched off/.test(lab.censor[0]), 'under The Blackout it says its Edition and Seal are', lab);
    ok(await kbdFocus('#hand .card', 1), 'that card has keyboard focus');
    await page.sleep(60);
    const d = await js(`(() => { const a = document.activeElement, ids = (a.getAttribute('aria-describedby') || '').split(' ').filter(Boolean); return { ids, text: ids.map((id) => (document.getElementById(id) || {}).textContent || '').join(' | ') }; })()`);
    ok(d.ids.length > 0 && /do nothing this Blind/.test(d.text), 'while its tip shows, the tip describes the focused card (its effect and the Boss Blind\'s note)', d);
    await js('TW.UI.hideTip(), 1');
    ok(!(await js(`document.querySelectorAll('#hand .card')[1].hasAttribute('aria-describedby')`)), 'the link goes when the tip closes');
  }

  if (on(17)) {
    // ------------------------------------------------------------ 17. 1.4.3: the Chips and Mult pills keep 4.5:1
    // (found while running a11y.mjs for this batch: a Shop item's Mult Edition pill, light ink on the bright red step, read
    // at 3.84:1; the Chips pill at 4.3:1)
    for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
      await page.viewport(w, h, m);
      await page.sleep(150);
      for (const tone of ['t-red', 't-blue', 't-vio', 't-ember', 't-pink', 't-lime', 't-cream', 't-cash', 't-plum']) {
        const box = await js(`(() => { const old = document.getElementById('pillTest'); if (old) old.remove(); const p = document.createElement('span'); p.id = 'pillTest'; p.className = 'tag ${tone}'; p.textContent = 'Dither'; p.style.cssText = 'position:fixed;left:40px;top:40px;z-index:99'; document.body.append(p); const ink = getComputedStyle(p).color; p.style.color = 'transparent'; const r = p.getBoundingClientRect(); return { ink, r: [r.left, r.top, r.width, r.height] }; })()`);
        await page.sleep(60);
        const [l, t, bw, bh] = box.r;
        await capture({ x: Math.round(l), y: Math.round(t), width: Math.round(bw), height: Math.round(bh) });
        // the pill's own colour: the commonest pixel of its middle rows (the text is transparent for this capture)
        const fill = await js(`(() => { const d = window.__px, seen = new Map(); for (let y = Math.floor(d.height * 0.35); y < Math.ceil(d.height * 0.65); y++) for (let x = Math.floor(d.width * 0.25); x < Math.ceil(d.width * 0.75); x++) { const i = (y * d.width + x) * 4, k = d.data[i] + ',' + d.data[i + 1] + ',' + d.data[i + 2]; seen.set(k, (seen.get(k) || 0) + 1); } return [...seen.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number); })()`);
        const ink = box.ink.match(/\d+/g).slice(0, 3).map(Number);
        const cr = ratio(ink, fill);
        ok(cr >= 4.5, `the ${tone} pill's ink keeps 4.5:1 on its fill at ${w} x ${h} (${cr.toFixed(2)}:1)`, { ink, fill, cr });
      }
    }
    await js(`document.getElementById('pillTest').remove(), 1`);
    await page.viewport(1440, 900, false);
  }

  if (on(16)) {
    // ------------------------------------------------------------ 16. A14: Reduce motion, at real speed
    const real = url.replace(/([?&])test=1&?/, '$1').replace(/[?&]$/, '');
    await page.viewport(1440, 900, false);
    await page.goto(real, { wait: 600 });
    await until('the title (real speed)', (s) => s.screen === 'title');
    await js(`(() => { TW.UI.setSetting('motion', 'reduced'); TW.UI.openOverlay('options'); return 1; })()`);
    await page.waitFor('#dialogs .sw-knob');
    const knob = await js(`(() => { const cs = getComputedStyle(document.querySelector('.sw-knob')); return { reduced: document.documentElement.classList.contains('reduce-motion'), d: cs.transitionDuration, p: cs.transitionProperty }; })()`);
    ok(knob.reduced && /^0s(, 0s)*$/.test(knob.d), 'with Reduce motion the switch knob has no transition (it slid over 100 ms)', knob);
    await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.show('setup'); return 1; })()`);
    await page.waitFor('.stk');
    const stk = await js(`[...document.querySelectorAll('.stk')].map((n) => getComputedStyle(n).transitionDuration)`);
    ok(stk.every((d) => /^0s(, 0s)*$/.test(d)), 'and the Stake chips have none (one lifted on the spring)', stk);
    await js(`(() => { TW.UI.setSetting('motion', 'auto'); TW.UI.show('title'); return 1; })()`);
  }

  return { checks: checks.length, list: checks, out, test };
}
