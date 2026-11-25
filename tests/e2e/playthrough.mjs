// A scripted player (a tools/cdp.mjs scenario) that plays complete seeded runs through the real UI with real clicks
// and key presses: the title, the run setup, every Blind select (one Blind skipped for its Tag), every hand (a greedy
// choice over the engine's own scoring of every legal hand, discarding when the best is weak), the cash-out, every
// Shop (Jokers it can afford, Planet cards, one Booster Pack with its picks, the Voucher, a sale when the rack is
// full), the Tarot and Spectral cards in its slots, and on to the win (then one Blind of Endless mode) or the loss.
//
// After every settled action it checks:
//   - zero console errors (cdp.mjs fails the run on any, and the player stops at the first);
//   - no stuck state: the table settles, every screen offers a way forward, and the run makes progress;
//   - the DOM shows the engine's state: money, hands, discards, score, target, Ante, the hand's cards in order,
//     the Joker and consumable racks in order, the deck count, the Shop's items and reroll price, picks left,
//     the cash-out lines and "Collect $N", the end screen's stats;
//   - the sounds asked for (TW.UI's sfx log: in test mode nothing sounds, but every request is logged), the music
//     each screen wants, and the live region's announcements of scoring and results.
// It also reloads the page the first time it reaches each phase (Blind select, mid-Blind, cash-out, Shop, open
// pack), clicks Continue and checks the same run comes back on the same screen; and it plays the first Blind and
// the first Shop with the keyboard only (Tab, Enter, 1-9, D), checking that focus is visible where it lands.
//
// A greedy player rarely clears Ante 8 alone, so by default it gets help when its last hand would lose: the planned
// hand gains levels through the engine (as if Planet cards had been used) and the UI is refreshed. The result
// counts every assist. ASSIST=0 turns that off (the run then usually ends at Game Over, which is checked too).
//
// Usage (serve the project root first: node tools/serve.mjs . 5184):
//   node tools/cdp.mjs run "http://localhost:5184/?test=1" tests/e2e/playthrough.mjs
//   node tools/cdp.mjs run "http://localhost:5184/?test=1" tests/e2e/playthrough.mjs 390x844 --mobile
//   BLINDS=2 node tools/cdp.mjs run "http://localhost:5184/" tests/e2e/playthrough.mjs      (real speed, two Blinds)
// Environment: SEED (default PLAYTHRU), DECK, STAKE, BLINDS (stop after N cleared Blinds), ASSIST=0, RELOADS=0,
//   KEYS=0, SKIP=0 (never skip a Blind), MOTION=reduced|full, LOG=1 (print each step as it happens).

const SCREEN_FOR = { 'blind-select': 'blind-select', play: 'play', cashout: 'cashout', shop: 'shop', pack: 'pack', win: 'win', gameover: 'gameover' };
const MUSIC_FOR = (scr) => (scr === 'shop' || scr === 'pack' ? 'shop' : scr === 'gameover' ? null : 'table');

export default async function playthrough(page, { url }) {
  const env = process.env;
  const SEED = (env.SEED || 'PLAYTHRU').toUpperCase();
  const MAX_BLINDS = Number(env.BLINDS) || 0;
  const ASSIST = env.ASSIST !== '0';
  const RELOADS = env.RELOADS !== '0';
  const KEYS = env.KEYS !== '0';
  const SKIP = env.SKIP !== '0';
  const test = /[?&]test=1/.test(url);
  const t0 = Date.now();
  const log = [];
  const stats = { blinds: 0, hands: 0, discards: 0, skips: 0, assists: 0, bought: {}, packs: 0, picks: 0, used: 0, sold: 0, reloads: [], keyboardBlind: false, keyboardShop: false, checks: 0, sounds: new Set(), music: {}, announcements: 0 };
  const note = (x) => { log.push(x); if (env.LOG === '1') console.error(JSON.stringify(x)); };
  const fail = (msg, extra) => { throw new Error(`${msg}${extra ? ' ' + JSON.stringify(extra).slice(0, 1600) : ''}`); };
  const js = (expr) => page.eval(expr);
  const runJs = (body) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${body} })()`);
  const state = async () => JSON.parse(await js('JSON.stringify(window.__wick ? window.__wick.state() : null)'));
  let errSeen = 0;
  const noErrors = (where) => { const e = page.errors(); if (e.length > errSeen) fail(`console error ${where}`, e.slice(errSeen)); };
  const until = async (what, testFn, ms = test ? 15000 : 45000) => {
    const end = Date.now() + ms;
    let s = null;
    while (Date.now() < end) {
      s = await state();
      if (s && testFn(s)) return s;
      noErrors(`while waiting for ${what}`);
      await page.sleep(test ? 25 : 70);
    }
    fail(`stuck: timed out waiting for ${what}`, s);
  };
  // the screen has caught up with the run's phase and nothing animates that blocks input
  const caughtUp = (s) => !s.busy && s.screen === (SCREEN_FOR[s.phase] || 'title') && (s.phase !== 'play' || s.hand.length > 0);
  const settle = async (ms = 0) => { await until('the table to settle', caughtUp); await page.sleep(test ? 30 : ms); };
  const phone = (await js('TW.UI.MQ.phone.matches'));
  let since = 0;
  /** The sounds asked for since the last mark; each name seen is kept for the summary. */
  const heard = async () => { const l = await js(`__wick.sfx(${since})`); l.forEach((e) => stats.sounds.add(e.name)); return l.map((e) => e.name); };
  const mark = async () => { since = await js('Date.now()'); };
  const expectSounds = async (what, names) => {
    const got = await heard();
    const missing = names.filter((n) => (Array.isArray(n) ? !n.some((x) => got.includes(x)) : !got.includes(n)));
    if (missing.length) fail(`no sound for ${what}`, { missing, got });
  };

  // ------------------------------------------------------------ input helpers (real pointer and key events)
  async function clickCard(uid) {
    const p = await js(`(() => {
      const n = document.querySelector('#hand .card[data-uid="${uid}"]');
      if (!n) return null;
      n.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = n.getBoundingClientRect(), next = n.nextElementSibling ? n.nextElementSibling.getBoundingClientRect() : null;
      const right = next && next.left > r.left ? Math.min(r.right, next.left) : r.right;
      return { x: Math.round((r.left + right) / 2), y: Math.round(r.top + Math.min(40, r.height / 3)) };
    })()`);
    if (!p) fail(`no card ${uid} in the hand`);
    await page.mouse(p.x, p.y);
  }
  async function click(sel, what) {
    if (!(await page.exists(sel))) fail(`no control for ${what || sel}`);
    await page.click(sel);
  }
  /** Tab through the page until focus reaches sel; the ring must show there (a keyboard player sees it). */
  async function tabTo(sel, max = 80) {
    for (let i = 0; i < max; i++) {
      const at = await js(`(() => { const a = document.activeElement; return !!a && a.matches(${JSON.stringify(sel)}); })()`);
      // focus that a click or the screen put there shows no ring (that is right); a keyboard player Tabs round to it
      const ring = at ? await js(`(() => { const a = document.activeElement, cs = getComputedStyle(a); return { visible: a.matches(':focus-visible'), outline: cs.outlineStyle + ' ' + cs.outlineWidth }; })()`) : null;
      if (at && (ring.visible || i > 0)) {
        if (!ring.visible || /none|0px/.test(ring.outline)) fail(`no visible focus on ${sel}`, ring);
        return i;
      }
      await page.key('Tab');
    }
    fail(`Tab never reached ${sel}`);
  }
  const visible = (sel) => js(`(() => { const n = document.querySelector(${JSON.stringify(sel)}); if (!n) return false; const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !n.closest('[hidden]'); })()`);

  // ------------------------------------------------------------ checks
  /** Every difference between what the DOM shows and the engine's run (empty when they agree). */
  const domDiff = () => runJs(`
    const out = [], fmt = UI.fmt, scr = UI.screen();
    const dv = (sel) => { const n = document.querySelector(sel); return n ? n.dataset.v : null; };
    const want = (k, got, exp) => { if (String(got) !== String(exp)) out.push({ k, got, exp }); };
    if (['blind-select', 'play', 'cashout', 'shop', 'pack'].includes(scr)) {
      want('money', dv('#money'), '$' + fmt(run.money));
      const tag = document.querySelector('#blindTag');
      if (!tag || !tag.textContent.includes('Ante ' + run.ante)) out.push({ k: 'ante', got: tag && tag.textContent, exp: run.ante });
      const b = run.blind;
      const info = E.currentBlindInfo(run);
      want('target', dv('#target'), fmt(b ? b.target : info.target));
      if (b) want('score', dv('#score'), fmt(b.score));
      if (scr === 'play' && b) {
        want('hands', dv('#hands'), b.handsLeft);
        want('discards', dv('#discards'), b.discardsLeft);
        want('hand', [...document.querySelectorAll('#hand .card[data-uid]')].map((n) => n.dataset.uid).join(), b.hand.join());
        document.querySelectorAll('.deck-count-n').forEach((n) => want('deck', n.dataset.v, b.draw.length + '/' + run.cards.length));
        const sel = UI.table.selected();
        document.querySelectorAll('#hand .card[data-uid]').forEach((n) => want('pressed ' + n.dataset.uid, n.getAttribute('aria-pressed'), String(sel.includes(n.dataset.uid))));
      }
      want('jokers', [...document.querySelectorAll('#jokerRack .jk[data-joker-uid]')].map((n) => n.dataset.jokerUid).join(), run.jokers.map((j) => j.uid).join());
      want('consumables', [...document.querySelectorAll('#consRack .jk[data-consumable-uid]')].map((n) => n.dataset.consumableUid).join(), run.consumables.map((k) => k.uid).join());
      const cnt = document.querySelector('.r-jokers .cnt');
      if (cnt && !cnt.textContent.startsWith(E.jokerSlotsUsed(run) + '/' + run.jokerSlots)) out.push({ k: 'joker count', got: cnt.textContent, exp: E.jokerSlotsUsed(run) + '/' + run.jokerSlots });
    }
    if (scr === 'blind-select') {
      const infos = E.blindsForAnte(run);
      const cards = [...document.querySelectorAll('.blind-card')];
      want('blind cards', cards.length, 3);
      cards.forEach((c, i) => { const n = c.querySelector('.bc-target .sr'); want('blind target ' + i, n && n.textContent, fmt(infos[i].target)); });
      want('current', cards.findIndex((c) => c.classList.contains('is-current')), infos.findIndex((x) => x.status === 'current'));
    }
    if (scr === 'cashout' && run.cashout) {
      const lines = [...document.querySelectorAll('.cashout li:not(.total)')];
      want('cash-out lines', lines.map((l) => l.querySelector('.who').textContent + '=' + l.querySelector('.sr').textContent).join('|'), run.cashout.lines.map((l) => l.label + '=$' + fmt(l.amount)).join('|'));
      const btn = document.querySelector('[data-action="collect"]');
      want('collect', btn && btn.textContent.trim(), 'Collect $' + fmt(run.cashout.total));
    }
    if (scr === 'shop' && run.shop) {
      run.shop.items.forEach((it, i) => {
        const n = document.querySelector('#shop .si[data-shop-index="' + i + '"]');
        if (!n) { out.push({ k: 'shop item missing', i }); return; }
        want('sold ' + i, n.classList.contains('is-sold'), !!it.sold);
        if (!it.sold) { const p = n.querySelector('.price'); want('price ' + i, p && p.textContent, '$' + fmt(it.price)); }
      });
      const rc = document.querySelector('#shop [data-action="reroll"] .r-cost'), cost = E.rerollCost(run);
      want('reroll', rc && rc.textContent, cost === 0 ? 'Free' : '$' + fmt(cost));
    }
    if (scr === 'pack' && run.pack) {
      const pk = document.querySelector('#pkPicks .sr');
      want('picks', pk && pk.textContent, run.pack.picksLeft);
      want('pack options', document.querySelectorAll('.pk-opt').length, run.pack.options.length);
      want('pack hand', [...document.querySelectorAll('#hand .card[data-uid]')].map((n) => n.dataset.uid).join(), (run.pack.hand || []).join());
    }
    if (scr === 'gameover' || scr === 'win') {
      const st = E.stats(run);
      const cell = (label) => [...document.querySelectorAll('.es-cell')].find((c) => c.querySelector('dt') && c.querySelector('dt').textContent === label);
      const v = (label) => { const c = cell(label); const s = c && c.querySelector('dd .sr'); return s ? s.textContent : null; };
      want('ante reached', v('Ante reached'), fmt(st.ante));
      want('hands played', v('Hands played'), fmt(st.handsPlayed));
      want('blinds cleared', v('Blinds cleared'), fmt(st.blindsCleared));
      const seed = document.querySelector('.seed-val');
      want('seed', seed && seed.textContent, run.seed);
    }
    return out;`);
  /** A way forward on every screen: the control that moves the run on is there, visible and not disabled. */
  const FORWARD = {
    'blind-select': '[data-action="start-blind"]', play: '#hand .card', cashout: '[data-action="collect"]',
    shop: '[data-action="leave-shop"]', pack: '[data-action="pack-skip"]', gameover: '[data-action="new-run"]', win: '[data-action="endless"]',
  };
  async function check(where) {
    noErrors(where);
    const s = await state();
    const fwd = FORWARD[s.screen];
    if (fwd) {
      const ok = await js(`(() => { const n = document.querySelector(${JSON.stringify(fwd)}); if (!n) return 'missing'; if (n.disabled) return 'disabled'; const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? 'ok' : 'hidden'; })()`);
      if (ok !== 'ok') fail(`no way forward on ${s.screen} (${where}): ${fwd} is ${ok}`, s);
    }
    const diff = await domDiff();
    if (diff.length) fail(`the DOM does not match the run (${where})`, diff);
    const music = await js('__wick.music()');
    if (music !== MUSIC_FOR(s.screen)) fail(`the music on ${s.screen} is ${music}`, { want: MUSIC_FOR(s.screen) });
    stats.music[s.screen] = music;
    const scroll = await js('[document.documentElement.scrollWidth, innerWidth]');
    if (scroll[0] > scroll[1] + 1) fail(`sideways scroll on ${s.screen}`, scroll);
    stats.checks++;
    return s;
  }

  // ------------------------------------------------------------ reload and Continue, once per phase
  const reloaded = new Set();
  async function reloadCheck(s, label) {
    if (!RELOADS || reloaded.has(label)) return false;
    reloaded.add(label);
    const snap = await js('TW.Engine.serialize(__wick.run())');
    await page.reload({ wait: test ? 150 : 700 });
    await until('the title after a reload', (x) => x.screen === 'title', test ? 8000 : 20000);
    await page.sleep(test ? 40 : 900);
    await click('[data-action="continue"]', 'Continue after a reload');
    const want = SCREEN_FOR[s.phase];
    await until(`Continue to bring back ${want}`, (x) => x.screen === want && !x.busy);
    await page.sleep(test ? 40 : 900);
    const again = await js('TW.Engine.serialize(__wick.run())');
    if (again !== snap) fail(`Continue after a reload at ${label} did not restore the same run`);
    await installLiveLog();
    await check(`after Continue at ${label}`);
    stats.reloads.push(label);
    note({ reload: label, screen: want });
    return true;
  }
  const installLiveLog = () => js(`(() => { if (window.__liveLog) return 1; window.__liveLog = []; const n = document.querySelector('#live'); new MutationObserver(() => { if (n.textContent) window.__liveLog.push(n.textContent); }).observe(n, { childList: true, characterData: true, subtree: true }); return 1; })()`);
  const liveSince = async (k) => js(`window.__liveLog.slice(${k})`);
  const liveCount = () => js('window.__liveLog.length');

  // ------------------------------------------------------------ the greedy player's plans (the engine's own scoring)
  const planHand = () => runJs(`
    const b = run.blind, hand = b.hand.slice(), card = (u) => E.getCard(run, u);
    const combos = (arr, k, s = 0, cur = [], out = []) => { if (cur.length === k) { out.push(cur.slice()); return out; } for (let i = s; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, out); cur.pop(); } return out; };
    let best = null;
    for (let k = 1; k <= 5; k++) for (const c of combos(hand, k)) {
      if (!E.canPlay(run, c).ok) continue;
      const r = E.scoreCards(run, c.map(card), hand.filter((u) => !c.includes(u)).map(card));
      if (!r) continue;
      if (!best || r.total > best.v || (r.total === best.v && c.length < best.c.length)) best = { v: r.total, c, name: r.name, handId: r.handId, scoring: r.scoringUids };
    }
    const need = b.target - b.score;
    const rank = (u) => card(u).rank;
    let toss = [];
    if (best && best.v < need && b.discardsLeft > 0 && best.v * b.handsLeft < need && E.canDiscard(run).ok) {
      toss = hand.filter((u) => !best.scoring.includes(u)).sort((a, z) => rank(a) - rank(z)).slice(0, 5);
      if (toss.length && !E.canDiscard(run, toss).ok) toss = toss.slice(0, 1);
      if (toss.length && !E.canDiscard(run, toss).ok) toss = [];
    }
    return { best, toss, need, handsLeft: b.handsLeft, discardsLeft: b.discardsLeft, hand };`);
  /** The last hand would lose: the planned hand gains just enough levels (the engine's own numbers). */
  const assist = (c, handId, need) => runJs(`
    const b = run.blind, hand = b.hand.slice(), card = (u) => E.getCard(run, u);
    const c = ${JSON.stringify(c)}, id = ${JSON.stringify(handId)}, need = ${need};
    const total = () => E.scoreCards(run, c.map(card), hand.filter((u) => !c.includes(u)).map(card)).total;
    const base = run.levels[id];
    let lo = base, hi = base;
    while (total() < need && hi < base + 200000) { lo = hi; hi = base + Math.max(1, (hi - base) * 2); run.levels[id] = hi; }
    while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); run.levels[id] = m; if (total() >= need) hi = m; else lo = m; }
    run.levels[id] = Math.max(base, hi);
    UI.saveRun(); UI.update();
    return { from: base, to: run.levels[id], total: total() };`);

  async function selectCards(uids, viaKeys) {
    for (const u of uids) {
      if (viaKeys) {
        const k = await runJs(`return (run.blind ? run.blind.hand : run.pack.hand).indexOf('${u}') + 1;`);
        if (k < 1 || k > 9) fail('a card beyond the 9th cannot be picked by key', { u, k });
        await page.key(String(k));
      } else await clickCard(u);
      await page.sleep(test ? 10 : 140);
    }
    await page.sleep(test ? 20 : 200);
    const sel = await js(`(TW.UI.screen() === 'pack' ? TW.UI.shop.selected() : TW.UI.table.selected())`);
    if (sel.slice().sort().join() !== uids.slice().sort().join()) fail('the selection did not follow the input', { sel, want: uids });
  }

  // ------------------------------------------------------------ one turn at the table
  async function useSlots(where) {
    // Tarot, Planet and Spectral cards in the slots: use each one the engine accepts now (on the weakest cards)
    for (let guard = 0; guard < 4; guard++) {
      const plan = await runJs(`
        const b = run.blind, hand = b ? b.hand.slice() : [], card = (u) => E.getCard(run, u);
        const low = hand.slice().sort((a, z) => card(a).rank - card(z).rank);
        for (const k of run.consumables) {
          const info = E.consumableInfo(run, k.uid) || {};
          const [lo, hi] = info.select || [0, 0];
          const tries = hi > 0 ? [low.slice(0, hi), low.slice(0, Math.max(lo, 1))] : [[]];
          for (const sel of tries) if (sel.length >= lo && E.canUseConsumable(run, k.uid, sel).ok) return { uid: k.uid, kind: k.kind, sel };
        }
        return null;`);
      if (!plan) return;
      if (plan.sel.length) await selectCards(plan.sel, false);
      await mark();
      await click(`#racks .jk[data-consumable-uid="${plan.uid}"]`, 'a consumable in its slot');
      await page.waitFor('#dialogs [data-action="use-consumable"]');
      await page.sleep(test ? 20 : 300);
      await click('#dialogs [data-action="use-consumable"]', 'Use');
      await until('the card to be used', (s) => !s.busy && s.dialogs === 0);
      await settle(test ? 0 : 900);
      if (await runJs(`return run.consumables.some((k) => k.uid === '${plan.uid}');`)) fail('the used card is still in its slot', plan);
      await expectSounds(`using a ${plan.kind} card`, ['use']);
      stats.used++;
      note({ used: plan.kind, where });
      await check(`after using a ${plan.kind} card`);
    }
  }
  async function playTurn(viaKeys) {
    await useSlots('play');
    const p = await planHand();
    if (!p.best) fail('no playable hand in the hand', p);
    if (p.toss.length) {
      await selectCards(p.toss, viaKeys);
      await mark();
      if (viaKeys) await page.key('d'); else await click('[data-action="discard"]', 'Discard');
      await until('the discard to settle', caughtUp);
      await settle(600);
      await expectSounds('a discard', ['discard']);
      stats.discards++;
      note({ discard: p.toss.length });
      return check('after a discard');
    }
    if (ASSIST && p.best.v < p.need && p.handsLeft === 1) {
      const a = await assist(p.best.c, p.best.handId, p.need);
      stats.assists++;
      note({ assist: p.best.name, levels: `${a.from} -> ${a.to}`, total: a.total, need: p.need });
      await settle(200);
    }
    await selectCards(p.best.c, viaKeys);
    const label = await js(`document.querySelector('#handName') ? document.querySelector('#handName').textContent : ''`);
    if (!label.startsWith(p.best.name)) fail('the hand panel does not show the selected hand', { label, want: p.best.name });
    await expectSounds('selecting cards', ['select']);
    const k = await liveCount();
    await mark();
    if (viaKeys) await page.key('Enter'); else await click('[data-action="play-hand"]', 'Play hand');
    await until('the payout to finish', caughtUp, test ? 20000 : 90000);
    await settle(400);
    const s = await state();
    stats.hands++;
    const said = await liveSince(k);
    if (!said.some((t) => /Score [\d,]+ of [\d,]+/.test(t))) fail('the payout was not announced', said);
    stats.announcements++;
    await expectSounds('a hand', ['play', ['chip', 'mult', 'xmult', 'money', 'again', 'boss'], 'total']);
    if (s.phase === 'cashout' || s.phase === 'win') await expectSounds('the Blind beaten', ['beaten']);
    if (s.phase === 'gameover') await expectSounds('the run lost', ['lose']);
    note({ hand: p.best.name, total: p.best.v, score: s.score, target: s.target, screen: s.screen });
    return check('after a hand');
  }
  async function playBlind(viaKeys) {
    let s = await state();
    for (let turns = 0; s.screen === 'play' && turns < 40; turns++) {
      if (RELOADS && !reloaded.has('mid-Blind')) {
        const mid = await runJs('return run.blind && run.blind.handsPlayed >= 1;');
        if (mid) await reloadCheck(s, 'mid-Blind');
      }
      s = await playTurn(viaKeys);
    }
    if (s.screen === 'play') fail('a Blind never ended', s);
    return s;
  }

  // ------------------------------------------------------------ Blind select, cash-out, the Shop and packs
  async function blindSelect(viaKeys) {
    const s = await check('on the Blind select');
    const info = await runJs(`const b = E.currentBlindInfo(run); return { kind: b.kind, tag: b.tag && b.tag.id, ante: run.ante, boss: b.boss && b.boss.name };`);
    if (info.kind === 'boss') {
      await expectSounds('the Boss Blind revealed', ['boss']);
      const said = await liveSince(0);
      if (!said.some((t) => t.includes(`Boss Blind: ${info.boss}`))) fail('the Boss Blind was not announced', said.slice(-3));
    }
    await useSlots('blind-select');
    await mark();
    if (SKIP && !viaKeys && info.kind === 'small' && info.ante === 2 && !stats.skips) {
      await click('[data-action="skip-blind"]', 'Skip');
      await until('the skip to settle', caughtUp);
      await settle(600);
      await expectSounds('a skipped Blind', ['skip', 'tag']);
      stats.skips++;
      note({ skipped: 'Small Blind', tag: info.tag });
      return check('after a skip');
    }
    if (viaKeys) {
      const n = await tabTo('[data-action="start-blind"]');
      note({ keyboard: 'Play reached', tabs: n });
      await page.key('Enter');
    } else await click('[data-action="start-blind"]', 'Play');
    await until('the Blind to deal', (x) => x.screen === 'play' && !x.busy && x.hand.length > 0);
    await settle(1200);
    await expectSounds('the deal', ['shuffle', 'deal']);
    return check('after the deal');
  }
  async function cashout(viaKeys) {
    await settle(test ? 0 : 1600);
    await check('on the cash-out');
    const before = await runJs('return { money: run.money, total: run.cashout.total };');
    await mark();
    if (viaKeys) {
      const a = await js(`document.activeElement && document.activeElement.dataset.action`);
      if (a !== 'collect') fail('the cash-out does not put focus on Collect', { a });
      await page.key('Enter');
    } else await click('[data-action="collect"]', 'Collect');
    await until('the Shop', (x) => x.screen === 'shop' && !x.busy);
    await settle(900);
    const after = await runJs('return run.money;');
    if (after !== before.money + before.total) fail('Collect added the wrong amount', { before, after });
    await expectSounds('Collect', ['collect']);
    stats.blinds++;
    note({ collected: before.total, money: after, blinds: stats.blinds });
    return check('after Collect');
  }
  async function pickPack() {
    const plan = await runJs(`
      const p = run.pack, hand = (p.hand || []).slice(), card = (u) => E.getCard(run, u);
      const sets = [[]];
      const low = hand.slice().sort((a, z) => card(a).rank - card(z).rank);
      for (let k = 1; k <= Math.min(4, low.length); k++) sets.push(low.slice(0, k));
      const order = p.options.map((o, i) => ({ o, i })).filter((x) => !x.o.picked);
      const score = (o) => (o.kind === 'joker' ? 0 : o.kind === 'planet' ? 1 : o.kind === 'card' ? 2 : 3);
      order.sort((a, z) => score(a.o) - score(z.o));
      for (const { o, i } of order) for (const sel of sets) if (E.canPackPick(run, i, sel).ok) return { i, sel, kind: o.kind, picks: p.picksLeft };
      return null;`);
    if (!plan) {
      await mark();
      await click('[data-action="pack-skip"]', 'Skip the pack');
      await until('the pack to close', (x) => x.screen !== 'pack' && caughtUp(x));
      await expectSounds('a skipped pack', ['skip']);
      note({ pack: 'nothing to pick, skipped' });
      return;
    }
    if (plan.sel.length) await selectCards(plan.sel, false);
    const sel = `[data-action="pack-pick"][data-index="${plan.i}"]`;
    await js(`(() => { const b = document.querySelector('${sel}'); if (b) b.scrollIntoView({ block: 'center', inline: 'center' }); return 1; })()`);
    await page.sleep(test ? 20 : 350);
    await mark();
    await click(sel, 'Pick');
    await until('the pick to land', (x) => !x.busy && (x.phase !== 'pack' || x.screen === 'pack'));
    await page.sleep(test ? 30 : 500);
    const left = await runJs('return run.pack ? run.pack.picksLeft : -1;');
    if (left === plan.picks) fail('the pick did not register', plan);
    await expectSounds('a pick', ['pick']);
    stats.picks++;
    note({ picked: plan.kind, sel: plan.sel.length });
  }
  async function openPack(where) {
    await until('the pack to open', (x) => x.screen === 'pack' && !x.busy);
    await page.sleep(test ? 30 : 900);
    await expectSounds('a pack opening', ['pack']);
    stats.packs++;
    await check(`in a pack (${where})`);
    if (await reloadCheck(await state(), 'open pack')) await page.sleep(test ? 30 : 900);
    for (let g = 0; g < 12; g++) {
      const s = await state();
      if (s.screen !== 'pack') break;
      await pickPack();
      await settle(500);
      const now = await state();
      if (now.screen === 'pack') await check('after a pick');
    }
    await settle(600);
    return check(`after the pack (${where})`);
  }
  /** The next thing to buy: a Joker (best rarity), a Planet card, one Booster Pack per visit, then the Voucher. */
  const shopPlan = (packsBought, rerolls) => runJs(`
    const items = run.shop.items.map((it, i) => ({ it, i })).filter((x) => x.it && !x.it.sold && E.canBuy(run, x.i).ok);
    const rar = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
    const row = (id) => Cn.JOKERS.find((j) => j.id === id) || {};
    const jokers = items.filter((x) => x.it.kind === 'joker').sort((a, z) => (rar[row(a.it.id).rarity] ?? 4) - (rar[row(z.it.id).rarity] ?? 4));
    if (jokers.length) return { i: jokers[0].i, kind: 'joker' };
    const planet = items.find((x) => x.it.kind === 'planet');
    if (planet) return { i: planet.i, kind: 'planet' };
    const pack = items.find((x) => x.it.kind === 'pack');
    if (pack && ${packsBought} < 1) return { i: pack.i, kind: 'pack' };
    const v = items.find((x) => x.it.kind === 'voucher');
    if (v) return { i: v.i, kind: 'voucher' };
    // money to spare and nothing worth buying: one reroll per visit
    if (!${rerolls} && E.jokerSlotsUsed(run) < run.jokerSlots && run.money >= E.rerollCost(run) + 6) return { kind: 'reroll', cost: E.rerollCost(run) };
    // the rack is full and a Joker is for sale that money allows: sell the Joker that sells for least, once
    const full = E.jokerSlotsUsed(run) >= run.jokerSlots;
    const wanted = run.shop.items.findIndex((it) => it && !it.sold && it.kind === 'joker' && it.edition !== 'phantom' && run.money + Math.min(...run.jokers.map((j) => E.jokerSellValue(run, j.uid))) >= it.price);
    if (full && wanted >= 0 && run.jokers.length) {
      const cheapest = run.jokers.slice().sort((a, z) => E.jokerSellValue(run, a.uid) - E.jokerSellValue(run, z.uid))[0];
      return { sell: cheapest.uid, kind: 'sell' };
    }
    return null;`);
  async function shop(viaKeys) {
    await settle(900);
    await check('in the Shop');
    if (await reloadCheck(await state(), 'Shop')) await settle(600);
    let packsBought = 0, sold = 0, rerolls = 0;
    for (let g = 0; g < 14; g++) {
      const plan = await shopPlan(packsBought, rerolls);
      if (!plan || (plan.kind === 'sell' && sold)) break;
      if (plan.kind === 'reroll') {
        const before = await runJs('return run.money;');
        await mark();
        await click('#shop [data-action="reroll"]', 'Reroll');
        await until('the reroll', (x) => !x.busy && (x.money !== before || plan.cost === 0));
        await settle(700);
        const after = await runJs('return run.money;');
        if (before - after !== plan.cost) fail('the reroll charged the wrong price', { before, after, cost: plan.cost });
        await expectSounds('a reroll', ['reroll']);
        stats.rerolls = (stats.rerolls || 0) + 1; rerolls++;
        note({ reroll: plan.cost });
        await check('after a reroll');
        continue;
      }
      if (plan.kind === 'sell') {
        await mark();
        await click(`#racks .jk[data-joker-uid="${plan.sell}"]`, 'a Joker in the rack');
        await page.waitFor('#dialogs [data-action="sell-joker"]');
        await page.sleep(test ? 20 : 300);
        await click('#dialogs [data-action="sell-joker"]', 'Sell');
        await until('the sale', (x) => !x.busy && x.dialogs === 0 && !x.jokers.includes(plan.sell));
        await settle(700);
        await expectSounds('a sale', ['sell']);
        stats.sold++; sold++;
        note({ sold: plan.sell });
        await check('after a sale');
        continue;
      }
      const before = await runJs('return { money: run.money, jokers: run.jokers.length };');
      const sel = `[data-action="buy"][data-index="${plan.i}"]`;
      await mark();
      if (viaKeys && !stats.keyboardShop) {
        await tabTo(sel);
        await page.key('Enter');
        stats.keyboardShop = true;
      } else {
        await js(`(() => { const b = document.querySelector('#shop ${sel}'); if (b) b.scrollIntoView({ block: 'center' }); return 1; })()`);
        await page.sleep(test ? 10 : 250);
        await click(`#shop ${sel}`, `Buy (${plan.kind})`);
      }
      await until('the purchase', (x) => !x.busy && (x.phase !== 'shop' || x.money !== before.money));
      await expectSounds(`buying a ${plan.kind}`, ['buy']);
      stats.bought[plan.kind] = (stats.bought[plan.kind] || 0) + 1;
      note({ bought: plan.kind, money: (await state()).money });
      if ((await state()).phase === 'pack') { packsBought++; await openPack('bought in the Shop'); continue; }
      await settle(700);
      await check(`after buying a ${plan.kind}`);
    }
    await mark();
    if (viaKeys) { await tabTo('[data-action="leave-shop"]'); await page.key('Enter'); }
    else await click('[data-action="leave-shop"]', 'Next Blind');
    await until('the next Blind select', (x) => x.screen === 'blind-select' && !x.busy);
    await settle(1000);
  }

  // ------------------------------------------------------------ the run
  await page.goto(url, { wait: test ? 150 : 700 });
  await until('the title', (s) => s.screen === 'title');
  if (env.MOTION) await js(`(() => { TW.UI.setSetting('motion', '${env.MOTION}'); return 1; })()`);
  // start clean: no saved run from an earlier pass in this profile
  await js(`(() => { TW.UI.store.remove('run'); return 1; })()`);
  await page.reload({ wait: test ? 150 : 700 });
  await until('the title', (s) => s.screen === 'title');
  await installLiveLog();
  await check('on the title');
  await page.sleep(test ? 30 : 1200);
  await click('[data-action="new-run"]', 'New run');
  await until('the run setup', (s) => s.screen === 'setup');
  await page.sleep(test ? 30 : 900);
  await check('on the run setup');
  // the seed and, when asked, the Deck and Stake, typed and picked like a player would
  await click('#suSeed', 'the seed field');
  await js(`(() => { const i = document.querySelector('#suSeed'); i.select(); return 1; })()`);
  await page.key('Backspace');
  for (const ch of SEED) await page.key(ch);
  const typed = await js(`document.querySelector('#suSeed').value.toUpperCase()`);
  if (typed !== SEED) fail('the seed field did not take the typed seed', { typed });
  if (env.DECK) for (let g = 0; g < 12 && !(await js(`TW.UI.menus && document.querySelector('.car-main') && document.querySelector('#suDeckInfo .su-name').textContent === (TW.Content.DECKS.find((d) => d.id === '${env.DECK}') || {}).name`)); g++) { await click('[data-action="deck-next"]'); await page.sleep(test ? 10 : 250); }
  if (env.STAKE) await click(`[data-action="pick-stake"][data-stake="${env.STAKE}"]`);
  await mark();
  await click('[data-action="start-run"]', 'Start run');
  await until('the first Blind select', (s) => s.screen === 'blind-select' && !s.busy);
  await settle(1000);
  const run0 = await runJs('return { seed: run.seed, deck: run.deckId, stake: run.stake };');
  if (run0.seed !== SEED) fail('the typed seed did not seed the run', run0);
  note({ run: run0 });
  await reloadCheck(await state(), 'Blind select');

  let viaKeys = KEYS;
  let s = await state();
  let lastProgress = '', still = 0;
  for (let step = 0; step < 400; step++) {
    s = await state();
    const progress = await runJs('return [run.phase, run.ante, run.blindIndex, run.stats.handsPlayed, run.stats.cardsDiscarded, run.stats.blindsCleared, run.money, run.jokers.length, run.consumables.length, run.pack ? run.pack.picksLeft : -1].join();');
    if (progress === lastProgress) { if (++still > 3) fail('stuck: the run made no progress', { s, progress }); } else { still = 0; lastProgress = progress; }
    if (s.screen === 'blind-select') s = await blindSelect(viaKeys);
    else if (s.screen === 'pack') s = await openPack('from a Tag');
    else if (s.screen === 'play') {
      const kb = viaKeys;
      s = await playBlind(kb);
      if (kb) { stats.keyboardBlind = s.screen === 'cashout' || s.screen === 'win'; }
    } else if (s.screen === 'cashout') {
      await reloadCheck(s, 'cash-out');
      s = await cashout(viaKeys);
    } else if (s.screen === 'shop') {
      await shop(viaKeys);
      viaKeys = false;
      if (MAX_BLINDS && stats.blinds >= MAX_BLINDS) { note({ stop: `${MAX_BLINDS} Blinds cleared` }); break; }
    } else if (s.screen === 'win') {
      await settle(test ? 0 : 1500);
      await check('on You win!');
      await expectSounds('the win', ['win']);
      note({ won: true, ante: s.ante });
      // Endless mode: one more cash-out, Collect $N, the Shop, and the next Blind select
      await mark();
      await click('[data-action="endless"]', 'Endless mode');
      await until('the Endless cash-out', (x) => x.screen === 'cashout' && !x.busy);
      s = await cashout(false);
      await shop(false);
      const e = await state();
      if (e.ante !== 9) fail('Endless mode did not lead to Ante 9', e);
      note({ endless: 'Ante 9 Blind select' });
      break;
    } else if (s.screen === 'gameover') {
      await settle(test ? 0 : 1200);
      await check('on Game Over');
      note({ lost: true, ante: s.ante });
      break;
    } else fail(`an unexpected screen during the run: ${s.screen}`, s);
  }
  s = await state();
  const end = await runJs('return { phase: run && run.phase, ante: run && run.ante, money: run && run.money, jokers: run ? run.jokers.map((j) => j.id) : [], recorded: run && run.recorded };');
  // the records count a finished run
  if (s.screen === 'gameover' || (end.phase && end.phase !== 'gameover' && end.ante > 8)) {
    const rec = await js('TW.app.getRecords()');
    if (!(rec.runs >= 1)) fail('the records did not count the finished run', rec);
    if (s.screen !== 'gameover' && !(rec.wins >= 1)) fail('the records did not count the win', rec);
    note({ records: { runs: rec.runs, wins: rec.wins, bestAnte: rec.bestAnte } });
  }
  noErrors('at the end');
  return {
    seed: SEED, viewport: phone ? 'phone' : 'desktop', mode: test ? 'test' : 'real speed', seconds: Math.round((Date.now() - t0) / 1000),
    end, blinds: stats.blinds, hands: stats.hands, discards: stats.discards, skips: stats.skips, assists: stats.assists,
    bought: stats.bought, packs: stats.packs, picks: stats.picks, used: stats.used, sold: stats.sold, rerolls: stats.rerolls || 0,
    reloads: stats.reloads, keyboardBlind: stats.keyboardBlind, keyboardShop: stats.keyboardShop, checks: stats.checks,
    announcements: stats.announcements, music: stats.music, sounds: [...stats.sounds].sort(), steps: log.length,
    log: env.LOG === 'full' ? log : log.slice(-12),
  };
}
