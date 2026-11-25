// Accessibility audit (a tools/cdp.mjs scenario), screen by screen: the title, run setup, Blind select, the table
// with cards selected, the cash-out, the Shop, an open pack with its dealt hand, Options, Pause, Overview, the deck,
// How to play, Records, the Collection, Game Over and You win!. On each it checks:
//   1. names: every visible button, input, switch, radio, slider and link has an accessible name;
//   2. contrast: every visible run of text against the pixels actually behind it. All text is made transparent
//      for one capture, that capture is decoded in the page, and each text box is measured against the lighter
//      tail of its background (the 85th percentile of luminance for light text, the 15th for dark text). Text
//      needs 4.5:1, large text (24 px, or 18.66 px bold) 3:1; the Ember digit face is drawn art with its own rim
//      and is checked as large text where it carries a value (the Blind score, money, the targets);
//   3. focus: Tab moves through the screen and every stop shows a ring (outline or a ring of light).
// Then it plays one hand at real speed with Reduce motion on and checks the payout moves nothing: every running
// animation it samples changes opacity only (no transform, translate or filter), and the room holds still.
//
// Usage: node tools/cdp.mjs run "http://localhost:5184/?test=1" tests/e2e/a11y.mjs [390x844 --mobile]
// Returns the counts per screen and every failure; it fails when any check fails.

export default async function a11y(page, { url }) {
  const out = { screens: {}, failures: [] };
  const js = (e) => page.eval(e);
  const fail = (msg, extra) => { throw new Error(`${msg}${extra ? ' ' + JSON.stringify(extra).slice(0, 2400) : ''}`); };
  const state = async () => JSON.parse(await js('JSON.stringify(__wick.state())'));
  const until = async (what, f, ms = 15000) => { const end = Date.now() + ms; let s; while (Date.now() < end) { s = await state(); if (f(s)) return s; await page.sleep(40); } fail(`timed out: ${what}`, s); };
  const runJs = (body) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${body} })()`);
  const phone = (await js('TW.UI.MQ.phone.matches'));

  // ------------------------------------------------------------ 1. names
  const names = () => js(`(() => {
    const vis = (n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== 'hidden' && !n.closest('[aria-hidden="true"], [inert], .route-ghost, .route-ghost-main'); };
    const name = (n) => {
      const lb = n.getAttribute('aria-labelledby');
      if (lb) { const t = lb.split(/\\s+/).map((id) => { const x = document.getElementById(id); return x ? x.textContent : ''; }).join(' ').trim(); if (t) return t; }
      const al = n.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
      if (n.id) { const l = document.querySelector('label[for="' + n.id + '"]'); if (l && l.textContent.trim()) return l.textContent.trim(); }
      const t = (n.innerText || n.textContent || '').trim(); if (t) return t;
      const img = n.querySelector('img[alt]:not([alt=""])'); if (img) return img.alt;
      return (n.getAttribute('title') || n.getAttribute('placeholder') || '').trim();
    };
    const bad = [];
    document.querySelectorAll('button, input, select, textarea, a[href], [role="button"], [role="switch"], [role="radio"], [role="slider"], [role="tab"], [tabindex]:not([tabindex="-1"])').forEach((n) => {
      if (!vis(n)) return;
      if (!name(n)) bad.push(n.outerHTML.slice(0, 140));
    });
    return bad;
  })()`);

  // ------------------------------------------------------------ 2. contrast against the real pixels
  const luminanceJs = `
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);`;
  async function contrast(label) {
    // the text boxes and colours, then every text made transparent for one capture (a tooltip that keyboard focus
    // opened is closed first: it is measured where it shows, not over the text it covers)
    const boxes = await js(`(() => {
      TW.UI.hideTip();
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      // under a modal dialog the page behind is dimmed and inert: only the dialog's own text counts then
      const modal = document.querySelector('#dialogs .overlay:not(.clear)');
      let t;
      while ((t = walker.nextNode())) {
        const el = t.parentElement;
        if (!el || seen.has(el) || !t.textContent.trim()) continue;
        if (modal && !el.closest('#dialogs')) continue;
        if (el.closest('.sr, script, style, noscript, .route-ghost, .route-ghost-main, #tip, #toasts, [hidden]')) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || Number(cs.opacity) === 0 || cs.color === 'rgba(0, 0, 0, 0)') continue;
        let op = 1, p = el;
        while (p && p !== document.body) { op *= Number(getComputedStyle(p).opacity); p = p.parentElement; }
        if (op < 0.05) continue;
        const range = document.createRange(); range.selectNodeContents(t);
        // clipped by a scrolling or clipping ancestor (a dialog body scrolled past it): not on screen
        const clips = [];
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (s.overflowX !== 'visible' || s.overflowY !== 'visible') clips.push(a.getBoundingClientRect()); }
        const inside = (r) => clips.every((c) => r.left + r.width / 2 > c.left && r.left + r.width / 2 < c.right && r.top + r.height / 2 > c.top && r.top + r.height / 2 < c.bottom);
        const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && inside(r));
        if (!rects.length) continue;
        seen.add(el);
        const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
        out.push({ text: t.textContent.trim().slice(0, 40), color: cs.color, size: px, large: px >= 24 || (bold && px >= 18.66), op, rects: rects.slice(0, 3).map((r) => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]), cls: el.className && String(el.className).slice(0, 40) });
      }
      const st = document.createElement('style'); st.id = 'a11yHide';
      st.textContent = '*, *::before, *::after { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; caret-color: transparent !important; }';
      document.head.append(st);
      document.documentElement.classList.add('frame-mode');
      return out;
    })()`);
    await page.sleep(80);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    const res = await js(`(async () => {
      document.getElementById('a11yHide').remove();
      document.documentElement.classList.remove('frame-mode');
      ${luminanceJs}
      const img = new Image(); img.src = 'data:image/png;base64,${data}';
      await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const k = img.naturalWidth / innerWidth;
      const boxes = ${JSON.stringify(boxes)};
      const bad = [];
      let n = 0;
      for (const b of boxes) {
        const m = b.color.match(/[\\d.]+/g).map(Number);
        const a = (m[3] == null ? 1 : m[3]) * b.op;
        const ls = [];
        let sr = 0, sg = 0, sb = 0, cnt = 0;
        for (const [x, y, w, h] of b.rects) {
          const d = g.getImageData(Math.max(0, Math.round(x * k)), Math.max(0, Math.round(y * k)), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))).data;
          for (let i = 0; i < d.length; i += 4) { ls.push(lum(d[i], d[i + 1], d[i + 2])); sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; cnt++; }
        }
        if (!cnt) continue;
        ls.sort((p, q) => p - q);
        const mean = [sr / cnt, sg / cnt, sb / cnt];
        // text over its own mean background (a translucent colour is mixed with what is behind it)
        const tc = [0, 1, 2].map((i) => m[i] * a + mean[i] * (1 - a));
        const lt = lum(tc[0], tc[1], tc[2]);
        // the dominant background (the median under the text box) decides; the lighter or darker tail (a pill's lit
        // top row, a spark) is reported alongside so a near miss can be looked at
        const median = ls[Math.floor(ls.length / 2)];
        const light = lt > median;
        const tail = light ? ls[Math.floor(ls.length * 0.85)] : ls[Math.floor(ls.length * 0.15)];
        const r = ratio(lt, median), rt = ratio(lt, tail);
        const need = b.large ? 3 : 4.5;
        n++;
        if (r < need) bad.push({ text: b.text, ratio: Math.round(r * 100) / 100, tail: Math.round(rt * 100) / 100, need, color: b.color, behind: 'rgb(' + mean.map(Math.round).join(', ') + ')', size: b.size, cls: b.cls, at: b.rects[0], shot: [img.naturalWidth, img.naturalHeight] });
      }
      return { n, bad };
    })()`);
    // keep the textless capture of a screen that failed, next to the report, to look at
    if (res.bad.length && process.env.A11Y_OUT) { const { writeFileSync } = await import('node:fs'); writeFileSync(`${process.env.A11Y_OUT}.${label}.png`, Buffer.from(data, 'base64')); }
    return res;
  }

  // ------------------------------------------------------------ 3. focus rings
  async function focusRings(max = 40) {
    await js('document.activeElement && document.activeElement.blur && document.activeElement.blur(), 1');
    const bad = [], seen = new Set();
    for (let i = 0; i < max; i++) {
      await page.key('Tab');
      const f = await js(`(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        const cs = getComputedStyle(a);
        const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || /rgba?\\(/.test(cs.boxShadow) && cs.boxShadow !== 'none';
        return { key: a.outerHTML.slice(0, 90), ring, visible: a.matches(':focus-visible') };
      })()`);
      if (!f) continue;
      if (seen.has(f.key)) break;
      seen.add(f.key);
      if (!f.visible || !f.ring) bad.push(f);
    }
    return { stops: seen.size, bad };
  }

  /** Wait until every finite animation has ended (entrances, rings, bursts); the room's endless loops keep going. */
  const quiet = async (ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const n = await js(`document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming && a.effect.getTiming().iterations !== Infinity).length`);
      if (!n) return;
      await page.sleep(100);
    }
  };
  async function audit(label, o = {}) {
    if (!o.overlay) { await page.mouse(2, 2); await page.sleep(120); }
    await quiet();
    const s = await state();
    const nm = await names();
    const ct = await contrast(label);
    const fr = o.focus === false ? { stops: 0, bad: [] } : await focusRings(o.tabs || 40);
    out.screens[label] = { screen: s.screen, controls: nm.length ? `${nm.length} unnamed` : 'all named', texts: ct.n, lowContrast: ct.bad.length, focusStops: fr.stops, noRing: fr.bad.length };
    nm.forEach((x) => out.failures.push({ screen: label, unnamed: x }));
    ct.bad.forEach((x) => out.failures.push(Object.assign({ screen: label, contrast: true }, x)));
    fr.bad.forEach((x) => out.failures.push({ screen: label, focus: x }));
  }

  // ------------------------------------------------------------ the screens
  await page.goto(url, { wait: 300 });
  await until('the title', (s) => s.screen === 'title');
  await js(`(() => { TW.UI.store.remove('run'); return 1; })()`);
  await audit('title');
  await page.click('[data-action="new-run"]');
  await until('setup', (s) => s.screen === 'setup');
  await audit('setup');
  await page.click('[data-action="start-run"]');
  await until('blind select', (s) => s.screen === 'blind-select' && !s.busy);
  // a run in progress: Jokers and a consumable in the racks
  await runJs(`
    const ids = Cn.JOKERS.filter((j) => j.rarity !== 'legendary' && TW.Art && TW.Art.has('joker:' + j.id)).slice(0, 3).map((j) => j.id);
    ids.forEach((id, i) => E.addJoker(run, id, 0, i === 1 ? (Cn.EDITIONS[0] || {}).id || null : null));
    run.consumables.push({ uid: 'k' + run.nextUid++, kind: 'planet', id: Cn.PLANETS[0].id });
    UI.saveRun(); UI.update(); return 1;`);
  await page.sleep(200);
  await audit('blind-select');
  await page.click('[data-action="start-blind"]');
  await until('play', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
  await page.key('1'); await page.key('2');
  await page.sleep(100);
  await audit('play');
  for (const [name, label] of [['options', 'options'], ['pause', 'pause'], ['run-info', 'run-info'], ['deck', 'deck'], ['help', 'help']]) {
    await js(`(() => { TW.UI.openOverlay('${name}'); return 1; })()`);
    await page.sleep(150);
    await audit(label, { tabs: 30, overlay: true });
    await js(`(() => { TW.UI.closeAllDialogs(); return 1; })()`);
    await page.sleep(80);
  }
  // the cash-out: the target staged to 1, the hand played with a real click
  await runJs('run.blind.target = 1; UI.update(); return 1;');
  await page.sleep(80);
  await page.key('1');
  await page.sleep(60);
  await page.click('[data-action="play-hand"]');
  await until('cash-out', (s) => s.screen === 'cashout' && !s.busy, 30000);
  await page.sleep(300);
  await audit('cashout', { tabs: 8 });
  await page.click('[data-action="collect"]');
  await until('shop', (s) => s.screen === 'shop' && !s.busy);
  await runJs('run.money = 40; UI.update(); return 1;');
  await page.sleep(200);
  await audit('shop');
  // a Tarot pack (it deals a hand)
  const i = await runJs(`const k = run.shop.items.findIndex((x) => x && x.slot === 'pack'); const row = Cn.PACKS.find((p) => p.kind === 'tarot' && p.size === 'normal'); Object.assign(run.shop.items[k], { kind: 'pack', id: row.id, price: row.price, size: row.size, sold: false }); UI.update(); return k;`);
  await page.sleep(150);
  await page.click(`[data-action="buy"][data-index="${i}"]`);
  await until('pack', (s) => s.screen === 'pack' && !s.busy);
  await page.key('1');
  await page.sleep(120);
  await audit('pack');
  await page.click('[data-action="pack-skip"]');
  await until('back in the shop', (s) => s.screen === 'shop' && !s.busy);
  await js(`(() => { TW.UI.saveRun(); TW.UI.setRun(null); TW.UI.show('records'); return 1; })()`);
  await page.sleep(200);
  await audit('records', { tabs: 20 });
  await js(`(() => { TW.UI.show('collection'); return 1; })()`);
  await page.sleep(300);
  await audit('collection', { tabs: 20 });
  await js(`(() => { TW.UI.continueRun(); return 1; })()`);
  await until('the run back', (s) => s.screen === 'shop');
  await runJs(`run.phase = 'gameover'; UI.refresh(); return 1;`);
  await until('game over', (s) => s.screen === 'gameover');
  await page.sleep(300);
  await audit('gameover', { tabs: 10 });
  await runJs(`run.phase = 'win'; run.won = true; UI.refresh(); return 1;`);
  await until('win', (s) => s.screen === 'win');
  await page.sleep(300);
  await audit('win', { tabs: 10 });

  // ------------------------------------------------------------ reduced motion: one payout at real speed moves nothing
  if (!/[?&]test=1/.test(url)) {
    await js(`(() => { TW.UI.setSetting('motion', 'reduced'); __wick.newRun({ seed: 'REDUCE1' }); return 1; })()`);
    await until('blind select', (s) => s.screen === 'blind-select' && !s.busy);
    await page.sleep(300);
    await page.click('[data-action="start-blind"]');
    await until('play', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
    await page.sleep(300);
    await page.key('1'); await page.key('2'); await page.key('3');
    await page.sleep(100);
    await js(`(() => { window.__moved = []; window.__sampler = setInterval(() => {
      for (const a of document.getAnimations()) {
        const t = a.effect && a.effect.target; if (!t || a.playState !== 'running') continue;
        const kf = a.effect.getKeyframes ? a.effect.getKeyframes() : [];
        const props = new Set(); kf.forEach((k) => Object.keys(k).forEach((p) => { if (!['offset', 'easing', 'composite', 'computedOffset'].includes(p)) props.add(p); }));
        const moving = [...props].filter((p) => p !== 'opacity');
        if (moving.length) window.__moved.push((t.className && String(t.className).slice(0, 30)) + ': ' + moving.join(',') + (a.animationName ? ' @' + a.animationName : ''));
      }
    }, 40); return 1; })()`);
    await page.click('[data-action="play-hand"]');
    await until('the payout to end', (s) => !s.busy && (s.screen !== 'play' || s.hand.length > 0), 30000);
    await page.sleep(300);
    const moved = await js('clearInterval(window.__sampler), [...new Set(window.__moved)]');
    out.reducedMotion = moved.length ? moved : 'opacity only';
    moved.forEach((m) => out.failures.push({ reducedMotion: m }));
    await js(`(() => { TW.UI.setSetting('motion', 'auto'); return 1; })()`);
  }
  out.viewport = phone ? 'phone' : 'desktop';
  if (process.env.A11Y_OUT) { const { writeFileSync } = await import('node:fs'); writeFileSync(process.env.A11Y_OUT, JSON.stringify(out, null, 1)); }
  if (out.failures.length) fail(`${out.failures.length} accessibility failures (A11Y_OUT=file writes them all)`, out.failures.slice(0, 6));
  return out;
}
