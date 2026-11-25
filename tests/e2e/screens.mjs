// End-to-end check of the menus and end screens (src/ui/30-screens.js), a tools/cdp.mjs scenario. It drives the
// real UI with real clicks and keys from the title:
//   1. the title (wordmark, no Continue without a save), How to play (every page), Credits, Records, the
//      Collection (every tab, discovered items with art and the rest as silhouettes);
//   2. Options: every option changed, then a reload proves each one persisted in ember:settings (mute included),
//      then everything is put back to the defaults and that persists too;
//   3. setup: a locked Deck refuses to start, then a run on a non-default Deck and Stake with a typed seed;
//   4. mid-run: Pause (Esc and the table's Options button), Overview stacked on Pause, Options and How to play
//      from Pause, the deck view during a Blind;
//   5. Save and quit, then Continue restores the same run; Abandon (with its confirm) counts a loss;
//   6. Game Over and You win! forced through the __wick hooks; Copy seed; Endless mode reaches the cash-out
//      ("Collect $N") and the Shop.
// On every screen: no horizontal page scroll, and on a phone no button under 44 px. cdp.mjs fails the run on any
// console error or exception, so "zero console errors" is part of the check.
//
// Usage (serve the project root first: node tools/serve.mjs . 5183):
//   node tools/cdp.mjs run "http://localhost:5183/?test=1" tests/e2e/screens.mjs
//   node tools/cdp.mjs run "http://localhost:5183/" tests/e2e/screens.mjs
//   node tools/cdp.mjs run "http://localhost:5183/" tests/e2e/screens.mjs 390x844 --mobile
//   SHOTS=1 node tools/cdp.mjs run "http://localhost:5183/" tests/e2e/screens.mjs   (writes shots/ui/screens-*.png,
//     or screens-phone-*.png at phone width; the shot run marks half of every kind discovered so the Collection
//     shows both states)
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = resolve(HERE, '../../shots/ui');

export default async function screens(page, { url }) {
  const SHOTS = process.env.SHOTS === '1';
  const log = [];
  const fail = (msg, extra) => { throw new Error(`${msg}${extra !== undefined ? ' ' + JSON.stringify(extra) : ''}`); };
  const ok = (cond, msg, extra) => { if (!cond) fail(msg, extra); };
  const J = (expr) => page.eval(`JSON.stringify((() => { ${expr} })())`).then((s) => (s === undefined ? undefined : JSON.parse(s)));
  const state = async () => JSON.parse(await page.eval('JSON.stringify(window.__wick ? window.__wick.state() : null)'));
  const until = async (what, test, ms = 15000) => {
    const end = Date.now() + ms;
    let s = null;
    while (Date.now() < end) { s = await state(); if (s && test(s)) return s; await page.sleep(70); }
    fail(`timed out waiting for ${what}`, s);
  };
  const test = /[?&]test=1/.test(url);
  const settle = (ms) => page.sleep(test ? 80 : ms);
  // screens rise into place when they open: click once they rest
  const onScreen = async (name, ms) => { const s = await until(`screen ${name}`, (x) => x.screen === name && !x.busy, ms); await settle(name === 'title' ? 500 : 0); return s; };
  const phone = (await page.eval('TW.UI.MQ.phone.matches'));
  const dialogs = () => page.eval('document.querySelectorAll("#dialogs .overlay").length');
  const waitDialog = async (sel, ms = 6000) => { await page.waitFor(`#dialogs ${sel}`, { timeout: ms }); await settle(560); };
  const noDialog = async () => { const end = Date.now() + 4000; while (Date.now() < end) { if (!(await dialogs())) return; await page.sleep(60); } fail('a dialog stayed open'); };
  const shot = async (name) => {
    if (!SHOTS) return;
    mkdirSync(SHOT_DIR, { recursive: true });
    await page.sleep(test ? 60 : 260);
    await page.screenshot(resolve(SHOT_DIR, `screens-${phone ? 'phone-' : ''}${name}.png`));
    log.push(`shot ${name}`);
  };
  /** Layout checks on whatever shows now: no sideways page scroll; on a phone every visible button is 44 px tall. */
  const layout = async (where) => {
    const r = await J(`
      const out = { scroll: document.documentElement.scrollWidth - innerWidth, small: [], clipped: [] };
      const roots = [...document.querySelectorAll('#app .scr, #dialogs .dlg')];
      roots.forEach((root) => root.querySelectorAll('button, [role="tab"], input').forEach((b) => {
        const rc = b.getBoundingClientRect();
        if (!rc.width || !rc.height || getComputedStyle(b).visibility === 'hidden') return;
        if (${phone} && rc.height < 43.5 && !b.closest('.co-tab, .hp-tab') ) out.small.push((b.dataset.action || b.className || b.tagName) + ':' + Math.round(rc.height));
        if (b.classList.contains('btn') && b.scrollWidth > b.clientWidth + 1) out.clipped.push(b.textContent.trim());
      }));
      return out;`);
    ok(r.scroll <= 0, `${where}: the page scrolls sideways`, r.scroll);
    ok(!r.small.length, `${where}: buttons under 44 px on a phone`, r.small);
    ok(!r.clipped.length, `${where}: button labels overflow`, r.clipped);
  };
  const press = async (key) => { await page.key(key); await settle(320); };

  // ------------------------------------------------------------ 1. the title, How to play, Credits, Records, the Collection
  await page.goto(url, { wait: 300 });
  await onScreen('title');
  await settle(1900); // the flame catches and the letters light up
  const wm = await J(`const w = document.querySelector('.scr-title h1.wm'); return w ? { letters: w.querySelectorAll('.pw-l').length, candle: !!w.querySelector('.pw-candle .pw-flame'), text: w.textContent.trim() } : null;`);
  ok(wm && wm.letters === 9 && wm.candle && wm.text === 'Wickwager', 'the wordmark: nine letters with a candle for the I', wm);
  ok(!(await page.exists('[data-action="continue"]')), 'no Continue run without a saved run');
  for (const a of ['new-run', 'open-collection', 'open-records', 'open-help', 'open-options', 'open-credits']) ok(await page.exists(`.scr-title [data-action="${a}"]`), `title button ${a}`);
  await layout('title');
  await shot('title');

  await page.click('.scr-title [data-action="open-help"]');
  await waitDialog('.hp-dlg');
  const pages = await page.eval('document.querySelectorAll(".hp-tab").length');
  ok(pages === 7, 'How to play has seven pages', pages);
  const titles = [];
  for (let i = 0; i < pages; i++) {
    titles.push(await page.eval('document.querySelector(".hp-title").textContent'));
    const art = await page.eval('document.querySelectorAll(".hp-ill .spr, .hp-ill .ph").length');
    ok(art > 0, `help page ${i + 1} is illustrated`, art);
    if (i === 0) { await layout('help'); await shot('help'); }
    if (i === 5) await shot('help-upgrades');
    if (i < pages - 1) { await page.click('#dialogs [data-action="help-next"]'); await settle(300); }
  }
  ok(new Set(titles).size === pages, 'each help page has its own heading', titles);
  await page.key('ArrowRight'); await settle(200); // keys wrap round to the first page
  ok((await page.eval('document.querySelector(".hp-title").textContent')) === titles[0], 'the arrow keys turn the pages');
  await press('Escape');
  await noDialog();

  await page.click('.scr-title [data-action="open-credits"]');
  await waitDialog('.cr-dlg');
  const cr = await page.eval('document.querySelector(".cr-dlg").textContent');
  for (const w of ['Jersey 10', 'Tiny5', 'Bricolage Grotesque', 'Open Font License']) ok(cr.includes(w), `credits name ${w}`);
  await shot('credits');
  await press('Escape');
  await noDialog();

  // a fixture marks half of every kind discovered (and unlocks a second Stake) so the screens show both states
  await J(`const r = TW.app.getRecords(), C = TW.Content, half = (a) => a.filter((_, i) => i % 2 === 0).map((x) => x.id);
    r.unlockedStakes = Array.from(new Set((r.unlockedStakes || []).concat([C.STAKES[0].id, C.STAKES[1].id])));
    r.discovered = { jokers: half(C.JOKERS), consumables: half(C.TAROTS).concat(half(C.PLANETS), half(C.SPECTRALS)), bosses: half(C.BOSSES), vouchers: half(C.VOUCHERS), tags: half(C.TAGS) };
    TW.UI.saveRecords(); return true;`);

  await page.click('.scr-title [data-action="open-records"]');
  await onScreen('records');
  await settle(700);
  ok(await page.exists('.rc-tiles .rc-tile'), 'records show their readouts');
  await layout('records');
  await shot('records');
  await page.click('.scr-records [data-action="back"]');
  await onScreen('title');

  await page.click('.scr-title [data-action="open-collection"]');
  await onScreen('collection');
  await settle(700);
  const tabs = await J(`return [...document.querySelectorAll('.co-tab')].map((t) => t.dataset.tab);`);
  ok(tabs.length === 7, 'the Collection has seven tabs', tabs);
  for (const t of tabs) {
    await page.click(`.co-tab[data-tab="${t}"]`);
    await settle(260);
    const c = await J(`const p = document.querySelector('#coPanel'); return { sel: document.querySelector('.co-tab[aria-selected="true"]').dataset.tab, items: p.querySelectorAll('.co-item').length, found: p.querySelectorAll('.co-item:not(.is-locked)').length, ups: p.querySelectorAll('.co-up').length };`);
    ok(c.sel === t, `tab ${t} selected`, c);
    ok(c.items > 0 || c.ups > 0, `tab ${t} lists its items`, c);
    if (t === 'jokers') { await layout('collection'); await shot('collection'); }
    if (t === 'bosses') await shot('collection-bosses');
    if (t === 'upgrades') await shot('collection-upgrades');
  }
  await page.click('.co-tab[data-tab="jokers"]');
  await settle(200);
  // discovered items say what they are; the rest keep their secret, even from a screen reader
  const lab = await J(`const p = document.querySelector('#coPanel'), J = TW.Content.JOKERS; return { found: p.querySelector('.co-item:not(.is-locked)').getAttribute('aria-label'), locked: p.querySelector('.co-item.is-locked').getAttribute('aria-label'), first: J[0].name, second: J[1].name, text: J[0].text };`);
  ok(lab.found.startsWith(lab.first) && lab.found.includes(lab.text), 'a discovered Joker reads its name and text', lab);
  ok(!lab.locked.includes(lab.second) && lab.locked.startsWith('Not discovered'), 'an undiscovered Joker keeps its name hidden', lab);
  if (!phone) {
    const b = await page.box('#coPanel .co-item:not(.is-locked)');
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y });
    await page.sleep(650); // tooltips wait 380 ms of real time before they open, in every mode
    const tip = await J(`const t = document.querySelector('#tip'); return { hidden: t.hidden, text: t.textContent };`);
    ok(!tip.hidden && tip.text.includes(lab.first), 'hovering a discovered Joker shows its tooltip', tip);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4 });
  }
  // keyboard: the grid moves focus with the arrows
  await page.eval(`document.querySelector('#coPanel .co-item').focus(); true`);
  await page.key('ArrowRight'); await settle(80);
  ok(await page.eval(`document.activeElement === document.querySelectorAll('#coPanel .co-item')[1]`), 'arrow keys move through the Collection grid');
  // the item the arrow reached shows its tip; Esc closes that tip on its own first (WCAG 1.4.13), then leaves
  if (!(await page.eval(`document.querySelector('#tip').hidden`))) {
    await press('Escape');
    ok(await page.eval(`document.querySelector('#tip').hidden && TW.UI.screen() === 'collection'`), 'Esc closes the focused item\'s tip on its own, and the Collection stays');
  }
  await press('Escape');
  await onScreen('title');

  // ------------------------------------------------------------ 2. Options: change everything, reload, check, restore
  await page.click('.scr-title [data-action="open-options"]');
  await waitDialog('.op-dlg');
  await layout('options');
  await shot('options');
  await page.click('#dialogs [data-action="set-speed"][data-value="3"]');
  await page.click('#dialogs [data-action="set-motion"][data-value="reduced"]');
  await page.click('#dialogs [data-action="toggle-shake"]');
  await page.click('#dialogs [data-action="toggle-mute"]');
  const setRange = (k, v) => page.eval(`(() => { const i = document.querySelector('#dialogs input[data-opt="${k}"]'); i.value = '${v}'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return i.value; })()`);
  await setRange('sfx', 25);
  await setRange('music', 70);
  // moving a slider unmutes (the player clearly wants sound): mute again
  if (await page.eval('TW.UI.menus.muted()') === false) await page.click('#dialogs [data-action="toggle-mute"]');
  let s = await page.eval('__wick.settings()');
  ok(s.speed === 3 && s.motion === 'reduced' && s.shake === false && s.sfx === 25 && s.music === 70, 'options apply at once', s);
  ok(await page.eval('TW.UI.menus.muted()') === true, 'mute is on');
  ok(await page.eval('document.documentElement.classList.contains("reduce-motion")'), 'Reduced motion reaches the page');
  const stored = await J(`return JSON.parse(TW.UI.store.get('settings'));`);
  ok(stored && stored.speed === 3 && stored.muted === true, 'options are stored in ember:settings', stored);
  await press('Escape');
  await page.reload({ wait: 300 });
  await onScreen('title');
  await settle(400);
  s = await page.eval('__wick.settings()');
  ok(s.speed === 3 && s.motion === 'reduced' && s.shake === false && s.sfx === 25 && s.music === 70, 'options persist after a reload', s);
  ok(await page.eval('TW.UI.menus.muted()') === true, 'mute persists after a reload');
  await page.click('.scr-title [data-action="open-options"]');
  await waitDialog('.op-dlg');
  const ui = await J(`const d = document.querySelector('#dialogs .op-dlg'), on = (sel) => d.querySelector(sel);
    return { speed: on('[data-action="set-speed"][aria-pressed="true"]').dataset.value, motion: on('[data-action="set-motion"][aria-pressed="true"]').dataset.value,
      shake: on('[data-action="toggle-shake"]').getAttribute('aria-checked'), mute: on('[data-action="toggle-mute"]').getAttribute('aria-checked'),
      sfx: on('input[data-opt="sfx"]').value, music: on('input[data-opt="music"]').value };`);
  ok(ui.speed === '3' && ui.motion === 'reduced' && ui.shake === 'false' && ui.mute === 'true' && ui.sfx === '25' && ui.music === '70', 'the reopened Options show the stored values', ui);
  // back to the defaults (Normal, Auto, shake on, sound on at 60 and 40)
  await page.click('#dialogs [data-action="set-speed"][data-value="2"]');
  await page.click('#dialogs [data-action="set-motion"][data-value="auto"]');
  await page.click('#dialogs [data-action="toggle-shake"]');
  await page.click('#dialogs [data-action="toggle-mute"]');
  await setRange('sfx', 60);
  await setRange('music', 40);
  // the erase step asks first, and Keep them leaves the records alone
  await page.click('#dialogs [data-action="erase-records"]');
  await settle(120);
  ok(await page.exists('#dialogs [data-action="confirm-erase"]'), 'erasing records asks first');
  await page.click('#dialogs [data-action="cancel-erase"]');
  await settle(120);
  await press('Escape');
  await page.reload({ wait: 300 });
  await onScreen('title');
  s = await page.eval('__wick.settings()');
  ok(s.speed === 2 && s.motion === 'auto' && s.shake === true && s.sfx === 60 && s.music === 40, 'the defaults persist too', s);
  ok(await page.eval('TW.UI.menus.muted()') === false, 'unmute persists');
  log.push('options: changed, reloaded, restored');

  // ------------------------------------------------------------ 3. setup: a locked Deck, then a non-default Deck and Stake
  await settle(1200);
  await page.click('.scr-title [data-action="new-run"]');
  await onScreen('setup');
  await settle(600);
  const decks = await J(`return TW.Content.DECKS.map((d) => d.id);`);
  const recs = await J(`return TW.app.getRecords();`);
  const lockedIdx = decks.findIndex((d) => !recs.unlockedDecks.includes(d));
  ok(lockedIdx > 0, 'a fresh profile has a locked Deck', recs.unlockedDecks);
  for (let i = 0; i < lockedIdx; i++) { await page.click('.scr-setup .car-arrow[data-action="deck-next"]'); await settle(120); }
  ok(await page.eval('document.querySelector(\'[data-action="start-run"]\').getAttribute("aria-disabled")') === 'true', 'Start run is held for a locked Deck');
  ok((await page.eval('document.querySelector("#suWhy").textContent')).includes('locked'), 'the setup says why');
  await page.click('.scr-setup [data-action="start-run"]');
  await settle(300);
  ok((await state()).screen === 'setup', 'a locked Deck does not start');
  // back to the second Deck (unlocked from the start) and the second Stake (unlocked by the fixture)
  for (let i = 0; i < lockedIdx - 1; i++) { await page.click('.scr-setup .car-arrow[data-action="deck-prev"]'); await settle(120); }
  await page.click('.scr-setup [data-action="stake-next"]');
  await settle(200);
  const pick = await J(`const s = document.querySelector('.scr-setup'); return { deck: s.querySelector('#suDeckInfo .su-name').textContent, stake: s.querySelector('#suStakeInfo .su-name').textContent, on: s.querySelector('.stk.is-on').dataset.stake };`);
  ok(pick.deck === (await J(`return TW.Content.DECKS[1].name;`)) && pick.on === (await J(`return TW.Content.STAKES[1].id;`)), 'the second Deck and Stake are chosen', pick);
  await page.click('#suSeed');
  for (const ch of 'screens1') await page.key(ch);
  await page.eval(`document.querySelector('#suSeed').blur(); true`);
  await settle(100);
  ok(await page.eval('document.querySelector("#suSeed").value') === 'SCREENS1', 'the seed field takes a seed in capitals');
  await layout('setup');
  await shot('setup');
  await page.click('.scr-setup [data-action="start-run"]');
  await onScreen('blind-select');
  let run = await J(`const r = __wick.run(); return { deckId: r.deckId, stake: r.stake, seed: r.seed };`);
  const want = await J(`return { deckId: TW.Content.DECKS[1].id, stake: TW.Content.STAKES[1].id };`);
  ok(run.deckId === want.deckId && run.stake === want.stake && run.seed === 'SCREENS1', 'the run starts on the chosen Deck, Stake and seed', run);
  log.push({ started: run });

  // ------------------------------------------------------------ 4. mid-run: Pause, Overview, Options, How to play, the deck view
  await settle(900);
  await press('Escape');
  await waitDialog('.pz-dlg');
  await layout('pause');
  await shot('pause');
  await page.click('#dialogs [data-action="open-run-info"]');
  await waitDialog('.ri-dlg');
  const ri = await J(`const d = document.querySelector('.ri-dlg'); return { hands: d.querySelectorAll('.ri-table tbody tr').length, blinds: d.querySelectorAll('.ri-blind').length, seed: d.querySelector('.ri-seed .seed-val').textContent, stake: d.querySelector('.ri-stake .v-name').textContent };`);
  ok(ri.hands === 9 && ri.blinds === 3 && ri.seed === 'SCREENS1', 'Overview: nine hands, three Blinds, the seed', ri);
  ok(await dialogs() === 2, 'Overview opens over Pause');
  await layout('run-info');
  await shot('run-info');
  await press('Escape');
  ok(await dialogs() === 1 && await page.exists('#dialogs .pz-dlg'), 'Esc closes Overview back to Pause');
  await page.click('#dialogs [data-action="pause-options"]');
  await waitDialog('.op-dlg');
  await press('Escape');
  await page.click('#dialogs [data-action="open-help"]');
  await waitDialog('.hp-dlg');
  await press('Escape');
  await page.click('#dialogs [data-action="resume"]');
  await noDialog();
  // the table's Options button opens Pause too
  await page.click(phone ? '.r-counts [data-action="open-options"]' : '.r-btns [data-action="open-options"]');
  await waitDialog('.pz-dlg');
  await page.click('#dialogs [data-action="resume"]');
  await noDialog();
  // I opens Overview straight from the table
  await page.key('i');
  await waitDialog('.ri-dlg');
  await press('Escape');
  await noDialog();
  // into the Blind, then the deck view
  await page.click('[data-action="start-blind"]');
  await onScreen('play');
  await until('the hand to be dealt', (x) => x.hand.length > 0 && !x.busy);
  await settle(1300);
  await page.click(phone ? '.deck-chip' : '.deck-btn');
  await waitDialog('.dv-dlg');
  const dv = await J(`const d = document.querySelector('.dv-dlg'), r = __wick.run(); return { cards: d.querySelectorAll('.dv-card').length, out: d.querySelectorAll('.dv-card.is-out').length, total: r.cards.length, inHand: r.blind.hand.length, sum: d.querySelector('.dv-sum').textContent };`);
  ok(dv.cards === dv.total && dv.out === dv.inHand && dv.sum.includes(`${dv.total - dv.inHand} of ${dv.total}`), 'the deck view: every card, the drawn ones dimmed, N of M left', dv);
  await layout('deck');
  await shot('deck');
  await press('Escape');
  await noDialog();

  // ------------------------------------------------------------ 5. Save and quit, Continue, Abandon
  const before = await J(`const r = __wick.run(); return { seed: r.seed, hand: r.blind.hand.slice(), money: r.money, phase: r.phase };`);
  await press('Escape');
  await waitDialog('.pz-dlg');
  await page.click('#dialogs [data-action="save-quit"]');
  await onScreen('title');
  await settle(1500);
  ok(await page.exists('.scr-title [data-action="continue"]'), 'the title offers Continue run after Save and quit');
  ok((await page.eval('document.querySelector("#ttSaved").textContent')).startsWith('Ante 1'), 'Continue says where the run stands');
  await layout('title with a save');
  await shot('title-continue');
  await page.click('.scr-title [data-action="continue"]');
  await onScreen('play');
  const after = await J(`const r = __wick.run(); return { seed: r.seed, hand: r.blind.hand.slice(), money: r.money, phase: r.phase };`);
  ok(JSON.stringify(after) === JSON.stringify(before), 'Continue restores the same run', { before, after });
  await settle(900);
  const runsBefore = await page.eval('TW.app.getRecords().runs');
  await press('Escape');
  await waitDialog('.pz-dlg');
  await page.click('#dialogs [data-action="abandon"]');
  await settle(150);
  ok(await page.exists('#dialogs [data-action="confirm-abandon"]'), 'Abandon run asks first');
  await page.click('#dialogs [data-action="cancel-abandon"]');
  await settle(150);
  ok(await page.exists('#dialogs [data-action="abandon"]') && (await state()).screen === 'play', 'Keep playing goes back to the menu');
  await page.click('#dialogs [data-action="abandon"]');
  await settle(150);
  await page.click('#dialogs [data-action="confirm-abandon"]');
  await onScreen('title');
  ok(!(await page.exists('.scr-title [data-action="continue"]')) && (await page.eval('TW.app.getRecords().runs')) === runsBefore + 1, 'an abandoned run counts and leaves no save');

  // ------------------------------------------------------------ 6. Game Over and You win! through the hooks, then Endless mode
  const startRun = async (seed) => {
    await page.click('.scr-title [data-action="new-run"]');
    await onScreen('setup');
    await settle(700); // the plate rises into place first
    await page.eval(`document.querySelector('#suSeed').value = '${seed}'; document.querySelector('#suSeed').dispatchEvent(new Event('input', { bubbles: true })); true`);
    await page.click('.scr-setup [data-action="start-run"]');
    await onScreen('blind-select');
  };
  await settle(900);
  await startRun('LOSEONE1');
  await J(`__wick.act('startBlind'); const b = __wick.run().blind; b.handsLeft = 1; b.target = 999999; return true;`);
  await J(`return __wick.act('playHand', [__wick.run().blind.hand[0]]).ok;`);
  await onScreen('gameover');
  await settle(900);
  const go = await J(`const p = document.querySelector('.es-plate'); return { title: p.querySelector('h1').textContent.trim(), cells: p.querySelectorAll('.es-cell').length, seed: p.querySelector('.seed-val').textContent, cause: !!p.querySelector('.es-cause'), acts: [...p.querySelectorAll('.es-acts [data-action]')].map((b) => b.dataset.action) };`);
  ok(go.title === 'Game Over' && go.cells === 8 && go.seed === 'LOSEONE1' && go.cause && go.acts.join() === 'new-run,to-title', 'Game Over: the cause, eight stats, the seed, New run and Title', go);
  await page.click('.es-plate [data-action="copy-seed"]');
  await settle(300);
  ok(await page.eval('document.querySelector("#toasts").textContent.includes("LOSEONE1")'), 'Copy seed answers with a toast');
  await layout('game over');
  await shot('gameover');
  await page.click('.es-plate [data-action="new-run"]');
  await onScreen('setup');
  await page.click('.scr-setup [data-action="back"]');
  await onScreen('title');
  await settle(900);

  await startRun('WINNING1');
  await J(`const r = __wick.run(); r.ante = 8; r.blindIndex = 2; TW.UI.refresh(); return true;`);
  await settle(300);
  await J(`__wick.act('startBlind'); __wick.run().blind.target = 1; return true;`);
  await J(`return __wick.act('playHand', [__wick.run().blind.hand[0]]).ok;`);
  await onScreen('win');
  await settle(1400);
  const wn = await J(`const p = document.querySelector('.es-plate'); return { title: p.querySelector('h1').textContent.trim(), acts: [...p.querySelectorAll('.es-acts [data-action]')].map((b) => b.dataset.action), won: __wick.run().won, phase: __wick.run().phase };`);
  ok(wn.title === 'You win!' && wn.acts.join() === 'endless,to-title' && wn.phase === 'win', 'You win!: Endless mode and Title', wn);
  await layout('win');
  await shot('win');
  await page.click('.es-plate [data-action="endless"]');
  await onScreen('cashout');
  await page.waitFor('#dialogs [data-action="collect"]');
  ok(/^Collect \$\d+$/.test((await page.eval('document.querySelector(\'#dialogs [data-action="collect"]\').textContent')).trim()), 'Endless mode goes on to the cash-out: Collect $N');
  await settle(1200);
  await page.click('#dialogs [data-action="collect"]');
  await onScreen('shop');
  ok(await page.eval('__wick.run().endless === true'), 'the run is in Endless mode');
  // Pause works from the Shop as well, and says where the run stands
  await settle(900);
  await press('Escape');
  await waitDialog('.pz-dlg');
  ok((await page.eval('document.querySelector(".pz-where").textContent')).includes('Shop'), 'Pause in the Shop says so');
  await page.click('#dialogs [data-action="resume"]');
  await noDialog();
  log.push('game over, win, endless: ok');
  return log;
}
