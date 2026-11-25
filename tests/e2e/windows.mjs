// The small-windows sweep (final pass, part 4, P1 and P2, 2026-11-25), a tools/cdp.mjs scenario. Run it once, in test
// mode: it sets its own window sizes, resizing one page (never reloading per size). The game is often played in a
// small browser window, so the short windows matter most.
//
// It walks a run's screens once each and, on each, steps through every size:
//   the title, setup, the Blind select, the table with a hand dealt and with a card chosen (the Move pair up), the
//   payout held at its peak, the cash-out, the Shop with 5 items and with Night Market's 7 (both with no money, so
//   every Buy shows why it can't be bought: the tallest form), every pack kind at its largest size (a Mega Card,
//   Tarot, Planet, Joker and Ghost Pack, the Tarot and Ghost ones with their dealt hand), the Blind select and the table
//   of a Boss Blind with the longest rule (it grew the top bar by four lines), Game Over and You win!. The run holds
//   five Jokers with long names and two consumables, and the Shop's items are the longest texts.
// At each size it checks:
//   - no page scroll either way;
//   - every action button ([data-action]: every Pick, Use and Buy among them) whole inside the window and not covered
//     (hit-tested at its centre and four corners). One in a row that scrolls inside itself (Night Market's seventh item
//     on a landscape phone, a Mega pack's row there) counts once that row is scrolled to it: a sideways swipe away;
//     the page itself is never scrolled. While a dialog is open only its controls count; at the payout's peak (input
//     held) the controls only have to be whole in the window;
//   - no plate's text cut: every name plate (.plate), pill (.tag), button label and panel of the column fits its box
//     ("Discards" ran 9 px out of its panel on a landscape phone), and a pack's reading
//     plate (#pkDetail) shows its reading whole, never scrolling inside itself; at the sizes in READ (P2's tablets and
//     narrow 3 px tables, the short windows, the phones) every Tarot and Spectral reading is tried, with no Joker and
//     with the five, and 0 to 2 cards chosen;
//   - a hand (the table's or a pack's dealt hand): every card inside the window and tappable on the strip that shows,
//     each strip 24 px or more (WCAG 2.5.8);
//   - the readouts (target, Blind score, Chips, Mult, hands, discards, money), the racks, the Blind cards, the plaque
//     and the cash-out plate whole inside the window where they are shown;
//   - the Shop with 5 items: every Buy in view at rest (no scroll of any kind) on P1's windows (600 to 1023 px wide and
//     601 to 869 px tall, or 1024 px wide or more and 600 to 869 px tall; P1: three of the five fell below the fold at
//     900 x 650 and 800 x 620).
// A screen size in KNOWN (below) failed before this round, lies outside P1's and P2's windows, and is logged in
// REQUESTS.md: it passes while it is no worse than it was.
// The sizes: P1's grid (widths 600 to 1440 against heights 600 to 869: the compact windows from 600 px wide and the
// 2 px table layout), P2's narrow 3 px tables and tablets, and the sizes that passed before and must not get worse
// (the 3 px table at 870 px tall or more, the laptops, the phones, the landscape phones, 720 x 450). SIZES (comma
// list, an "m" suffix for a touch phone or tablet) and SCREENS (comma list of the names above) narrow a run; SOFT=1
// reports instead of failing; OUT=dir writes the full table to <dir>/windows.json; SHOTS=dir saves a picture of
// each screen at each size there.
// cdp.mjs fails the run on any console error or exception.
// Usage: node tools/cdp.mjs run "http://localhost:5220/index.html?test=1&seed=WINDOWS1" tests/e2e/windows.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const GRID_W = [600, 700, 800, 900, 1000, 1023, 1024, 1180, 1280, 1366, 1440];
const GRID_H = [600, 620, 650, 700, 760, 800, 869];
const P2 = ['1024x900', '1024x1366', '1100x900', '1180x900', '1280x900', '1366x1024m', '1180x820m', '820x1180m', '768x1024m'];
const KEEP = ['1440x900', '1920x1080', '1366x768', '1280x720', '1024x768', '720x450', '390x844m', '360x640m', '375x667m', '414x896m', '844x390m', '932x430m', '667x375m'];
// where every Tarot and Spectral reading is tried on the plate beside or over the dealt hand
const READ = new Set(['1024x900', '1024x1366', '1100x900', '1180x900', '1280x900', '1366x1024m', '1180x820m', '820x1180m', '768x1024m',
  '1440x900', '1024x768', '1366x620', '1280x650', '1024x600', '1440x700', '1023x760', '1000x700', '900x650', '800x620', '700x700', '600x800', '600x600',
  '390x844m', '360x640m', '844x390m', '932x430m', '667x375m', '720x450']);
const ALL_SCREENS = ['title', 'setup', 'blinds', 'play', 'chosen', 'peak', 'cashout', 'shop5', 'cardmega', 'tarotmega', 'planetmega', 'jokermega', 'ghostmega', 'bossselect', 'boss', 'gameover', 'win', 'shop7'];
// Known before this round, outside P1's and P2's windows, and logged in REQUESTS.md for the review round (final pass,
// part 4): on a landscape phone and at 720 x 450 the title, Game Over and You win! scroll the page; a short phone held
// upright scrolls the run setup (its Start run is pinned in view); on a phone held upright a Boss Blind's rule takes four
// to nine lines, so the table and the Blind select of a Boss Blind scroll the page, and at 667 x 375 its column runs
// 15 px past the window; Game Over's and You win!'s plates run 8 px past a 360 px screen's edge. None may get worse:
// the page may scroll by no more than the number given, a control lie below the fold by no more than it, and no check
// of another kind may fail there.
const KNOWN = {
  'title@720x450': 101, 'title@844x390m': 154, 'title@932x430m': 114, 'title@667x375m': 176,
  'setup@360x640m': 77, 'setup@375x667m': 50,
  'bossselect@390x844m': 76, 'bossselect@360x640m': 138, 'bossselect@375x667m': 93, 'bossselect@414x896m': 24, 'bossselect@667x375m': 15,
  'boss@390x844m': 48, 'boss@360x640m': 71, 'boss@375x667m': 26, 'boss@667x375m': 15,
  'gameover@720x450': 97, 'gameover@844x390m': 153, 'gameover@932x430m': 113, 'gameover@667x375m': 172, 'gameover@360x640m': 0,
  'win@720x450': 149, 'win@844x390m': 205, 'win@932x430m': 165, 'win@667x375m': 224, 'win@360x640m': 0,
};
/** Whether a screen size's issues are all a known one's, and no worse than it was. */
function stillKnown(key, issues) {
  if (!(key in KNOWN)) return false;
  const max = KNOWN[key];
  return issues.every((t) => {
    const n = /page scrolls (\d+) px$/.exec(t) || / below the fold by (\d+) px$/.exec(t);
    if (n) return Number(n[1]) <= max;
    // what the same page scroll leaves out of the window (a hand pushed below the fold) is the known one too
    return / not whole in the window$/.test(t) || /^card \d+ off the window$/.test(t);
  });
}

/** Runs in the page: what one screen shows at the current size. o: { screen, busy, need: [selectors], buysAtRest } */
function measure(o) {
  const W = innerWidth, H = innerHeight, se = document.scrollingElement;
  const issues = [];
  const out = { pageY: Math.max(0, Math.round(se.scrollHeight - H)), pageX: Math.max(0, Math.round(se.scrollWidth - W)), px: TW.UI.PX() };
  if (out.pageY > 1) issues.push(`page scrolls ${out.pageY} px`);
  if (out.pageX > 1) issues.push(`page scrolls ${out.pageX} px sideways`);
  if (TW.UI.hideTip) TW.UI.hideTip();
  const R = (n) => n.getBoundingClientRect();
  const shown = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden' && !n.closest('.route-ghost, .route-ghost-main, [hidden], [inert]');
  const inWin = (r) => r.left >= -0.5 && r.top >= -0.5 && r.right <= W + 0.5 && r.bottom <= H + 0.5;
  const desc = (h) => (h ? (h.id ? '#' + h.id : (h.getAttribute('data-action') || String(h.className || h.tagName).split(' ')[0])) : 'nothing');
  /** the first of five points (centre, four corners inset 3 px) where something else is hit, or null */
  const hitBy = (n) => {
    const r = R(n), ix = Math.min(3, r.width / 4), iy = Math.min(3, r.height / 4);
    for (const [x, y] of [[r.left + r.width / 2, r.top + r.height / 2], [r.left + ix, r.top + iy], [r.right - ix, r.top + iy], [r.left + ix, r.bottom - iy], [r.right - ix, r.bottom - iy]]) {
      if (x < 0 || y < 0 || x > W || y > H) return { off: true };
      const h = document.elementFromPoint(x, y);
      if (!h || !(h === n || n.contains(h))) return { by: desc(h) };
    }
    return null;
  };
  const clipBox = (p) => { const q = R(p); return { l: q.left + p.clientLeft, t: q.top + p.clientTop, r: q.left + p.clientLeft + p.clientWidth, b: q.top + p.clientTop + p.clientHeight }; };
  /** the ancestor that cuts n off (overflow other than visible), or null */
  const cutBy = (n) => {
    const r = R(n);
    for (let p = n.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const c = clipBox(p);
      if ((s.overflowX !== 'visible' && (r.left < c.l - 0.5 || r.right > c.r + 0.5)) || (s.overflowY !== 'visible' && (r.top < c.t - 0.5 || r.bottom > c.b + 0.5))) return p;
    }
    return null;
  };
  /** the scrolling ancestors of n (not the page), innermost first */
  const scrollers = (n) => {
    const list = [];
    for (let p = n.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const s = getComputedStyle(p);
      const sx = /(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1, sy = /(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1;
      if (sx || sy) list.push({ p, sx, sy, left: p.scrollLeft, top: p.scrollTop, snap: p.style.scrollSnapType });
    }
    return list;
  };
  const dlg = [...document.querySelectorAll('#dialogs .overlay')].pop();
  const scope = dlg || document.getElementById('app') || document;
  const name = (n) => n.dataset.action + (n.dataset.index != null ? '#' + n.dataset.index : n.dataset.dir != null ? '#' + n.dataset.dir : '');
  // ------------------------------------------------------------ every action button
  // real controls only: the setup's side Deck backs are hidden shortcuts (aria-hidden) beside its arrow buttons
  const btns = [...scope.querySelectorAll('[data-action]')].filter((n) => shown(n) && n.matches('button, a[href], input, select, [role="button"]') && !n.closest('[aria-hidden="true"]'));
  const counts = { buttons: btns.length, atRest: 0, buy: 0, buyAtRest: 0, pick: 0, pickAtRest: 0 };
  for (const b of btns) {
    const act = b.dataset.action;
    const rest = inWin(R(b)) && (o.busy ? !cutBy(b) : !hitBy(b));
    if (rest) counts.atRest++;
    if (act === 'buy') { counts.buy++; if (rest) counts.buyAtRest++; }
    if (act === 'pack-pick') { counts.pick++; if (rest) counts.pickAtRest++; }
    if (rest) continue;
    // in a row that scrolls inside itself: scroll that row (never the page) to the button, then look again (its snap
    // held off meanwhile, so the row stays where it was sent)
    const sc = scrollers(b);
    for (const s of sc) {
      s.p.style.scrollSnapType = 'none';
      const c = clipBox(s.p), r = R(b);
      if (s.sx) { if (r.left < c.l) s.p.scrollLeft -= Math.ceil(c.l - r.left) + 2; else if (r.right > c.r) s.p.scrollLeft += Math.ceil(r.right - c.r) + 2; }
      if (s.sy) { if (r.top < c.t) s.p.scrollTop -= Math.ceil(c.t - r.top) + 2; else if (r.bottom > c.b) s.p.scrollTop += Math.ceil(r.bottom - c.b) + 2; }
    }
    const r = R(b), hit = o.busy ? null : hitBy(b), cut = cutBy(b);
    const ok = inWin(r) && !cut && !hit;
    if (!ok) {
      const why = r.bottom > H + 0.5 ? `below the fold by ${Math.round(r.bottom - H)} px` : r.top < -0.5 ? 'above the window' : (r.right > W + 0.5 || r.left < -0.5) ? 'off the window sideways'
        : cut ? `cut by ${desc(cut)}` : hit && hit.by ? `covered by ${hit.by}` : 'out of reach';
      issues.push(`${name(b)} ${why}`);
    }
    sc.forEach((s) => { s.p.scrollLeft = s.left; s.p.scrollTop = s.top; s.p.style.scrollSnapType = s.snap; });
  }
  Object.assign(out, counts);
  if (o.buysAtRest && counts.buyAtRest < counts.buy) issues.push(`${counts.buy - counts.buyAtRest} of ${counts.buy} Buy not in view at rest`);
  // ------------------------------------------------------------ text that runs out of its box
  for (const p of scope.querySelectorAll('.plate')) if (shown(p) && p.scrollWidth > p.clientWidth + 1) issues.push(`plate cut: ${p.textContent.trim()}`);
  for (const t of scope.querySelectorAll('.tag, .btn')) if (shown(t) && t.scrollWidth > t.clientWidth + 1) issues.push(`${t.classList.contains('tag') ? 'pill' : 'label'} runs out: ${t.textContent.trim().slice(0, 30)}`);
  // the column's readouts: a label or a figure wider than its panel runs out of it ("Discards" did on a landscape phone)
  for (const p of document.querySelectorAll('#col .panel')) if (shown(p) && p.scrollWidth > p.clientWidth + 1) issues.push(`runs out of its panel: ${p.getAttribute('aria-label') || p.className}`);
  const d = document.getElementById('pkDetail');
  if (d && shown(d)) {
    const b = R(d), cs = getComputedStyle(d), kids = [...d.children], last = kids.length ? R(kids[kids.length - 1]) : null;
    const past = last ? Math.round(last.bottom - (b.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom))) : 0;
    out.reading = [Math.round(b.width), Math.round(b.height)];
    if (past > 1) issues.push(`reading cut by ${past} px`);
    if (d.scrollHeight > d.clientHeight + 1) issues.push('reading scrolls');
    if (!inWin(b)) issues.push('reading plate off the window');
  }
  // ------------------------------------------------------------ the hand: in view, tappable strips of 24 px or more
  const hand = [...document.querySelectorAll('#hand .card')].filter(shown);
  if (hand.length && !dlg) {
    const rs = hand.map(R);
    const strips = rs.map((r, i) => Math.round((i < rs.length - 1 ? rs[i + 1].left : r.right) - r.left));
    out.strip = Math.min(...strips);
    if (out.strip < 24) issues.push(`hand strips ${out.strip} px`);
    hand.forEach((c, i) => {
      const r = rs[i];
      if (!inWin(r)) { issues.push(`card ${i + 1} off the window`); return; }
      if (o.busy) return;
      const right = i < rs.length - 1 ? rs[i + 1].left : r.right, h = document.elementFromPoint((r.left + right) / 2, r.top + r.height * 0.6);
      if (!h || !c.contains(h)) issues.push(`card ${i + 1} not tappable (${desc(h)})`);
    });
  }
  // ------------------------------------------------------------ what must be whole in the window
  for (const sel of o.need || []) {
    const list = [...document.querySelectorAll(sel)].filter(shown);
    if (!list.length) { issues.push(`missing ${sel}`); continue; }
    list.forEach((n, i) => { if (!inWin(R(n))) issues.push(`${sel}${list.length > 1 ? '[' + i + ']' : ''} not whole in the window`); });
  }
  out.issues = issues;
  return out;
}

/** Runs in the page: every Tarot and Spectral reading on the open pack's plate, with no Joker and with the run's own
    (five), and 0 to 2 cards of the dealt hand chosen; how many are cut or scroll. */
function readings() {
  const run = __wick.run(), Cn = TW.Content, UI = TW.UI;
  const list = Cn.TAROTS.map((x) => ['tarot', x.id, x.name]).concat(Cn.SPECTRALS.map((x) => ['spectral', x.id, x.name]));
  const keep = run.pack.options.map((o) => Object.assign({}, o)), hand = run.pack.hand.slice(), jk = run.jokers.slice();
  const past = () => { const d = document.querySelector('#pkDetail'), b = d.getBoundingClientRect(), cs = getComputedStyle(d), kids = [...d.children], last = kids[kids.length - 1].getBoundingClientRect(); return Math.round(last.bottom - (b.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom))); };
  const cut = new Set(); let worst = -999, scrolls = 0;
  for (const withJ of [false, true]) {
    run.jokers = withJ ? jk.slice() : [];
    for (const [kind, id, name] of list) {
      run.pack.options = run.pack.options.map(() => ({ kind, id }));
      for (const n of [0, 1, 2]) {
        UI.shop.select(hand.slice(0, n)); UI.update();
        const c = past(); if (c > 1) cut.add(name); if (c > worst) worst = c;
        const d = document.querySelector('#pkDetail'); if (d.scrollHeight > d.clientHeight + 1) scrolls++;
      }
    }
  }
  run.jokers = jk; run.pack.options = keep; UI.shop.select([]); UI.update();
  return { cut: cut.size, of: list.length, worst, scrolls, names: [...cut].slice(0, 6) };
}

export default async function windows(page) {
  const js = (e) => page.eval(e);
  const runJs = (body) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${body} })()`);
  const state = async () => JSON.parse(await js('JSON.stringify(__wick.state())'));
  const fail = (m, x) => { throw new Error(m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 3000) : '')); };
  const until = async (what, f, ms = 15000) => { const end = Date.now() + ms; let s; while (Date.now() < end) { s = await state(); if (f(s)) return s; await page.sleep(40); } fail('timed out: ' + what, s); };
  const parse = (s) => { const m = /^(\d+)x(\d+)(m?)$/.exec(s.trim()); return { label: s.trim(), w: Number(m[1]), h: Number(m[2]), m: !!m[3] }; };
  const SIZES = (process.env.SIZES ? process.env.SIZES.split(/[,;+]/) : [...GRID_W.flatMap((w) => GRID_H.map((h) => `${w}x${h}`)), ...P2, ...KEEP]).map(parse);
  const ONLY = process.env.SCREENS ? new Set(process.env.SCREENS.split(/[,;+]/)) : null;
  const on = (s) => !ONLY || ONLY.has(s);
  const SOFT = process.env.SOFT === '1';
  const SHOTS = process.env.SHOTS || '';
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const table = {}, fails = {}, known = {}, read = {};
  let checks = 0;
  const home = async () => { await page.viewport(1440, 900, false); await page.sleep(200); };
  /** step through every size on the screen that is up now */
  const sweep = async (screen, o = {}) => {
    if (!on(screen)) return;
    table[screen] = {};
    for (const sz of SIZES) {
      await page.viewport(sz.w, sz.h, sz.m);
      await page.sleep(o.settle || 220);
      if (o.before) await o.before(sz);
      // P1's windows (600 to 1023 px wide and 601 to 869 px tall, or 1024 px wide or more and 600 to 869 px tall; not a phone
      // or a tablet) hold the five Buy buttons at rest; at
      // 870 px or more the table layout lets its shelves scroll inside the Shop's panel, as it always has
      const buysAtRest = o.buysAtRest && !sz.m && sz.w >= 600 && sz.h >= (sz.w >= 1024 ? 600 : 601) && sz.h <= 869;
      const m = await js(`(${measure.toString()})(${JSON.stringify({ screen, busy: !!o.busy, need: o.need || [], buysAtRest })})`);
      if (SHOTS) await page.screenshot(join(SHOTS, `${screen}-${sz.label}.png`));
      if (o.after) await o.after(sz);
      if (o.readings && READ.has(sz.label)) {
        const r = await js(`(${readings.toString()})()`);
        read[`${screen}@${sz.label}`] = r;
        if (r.cut || r.scrolls) m.issues.push(`${r.cut} of ${r.of} readings cut (worst ${r.worst} px), ${r.scrolls} scroll`);
        await page.sleep(60);
      }
      checks++;
      table[screen][sz.label] = m;
      const key = `${screen}@${sz.label}`;
      if (m.issues.length) { if (stillKnown(key, m.issues)) known[key] = m.issues; else fails[key] = m.issues; }
    }
    await home();
  };

  // ------------------------------------------------------------ the run's setup: five long-named Jokers, two consumables
  const stock = async () => runJs(`
    const long = Cn.JOKERS.filter((j) => j.rarity !== 'legendary').sort((a, b) => b.name.length - a.name.length).slice(0, 5);
    run.jokers = [];
    long.forEach((j, i) => { E.addJoker(run, j.id); if (i === 1) run.jokers[run.jokers.length - 1].edition = 'gloss'; });
    run.consumables = [{ uid: 'k' + run.nextUid++, kind: 'tarot', id: 'inkpot' }, { uid: 'k' + run.nextUid++, kind: 'spectral', id: 'graveyardshift' }];
    UI.saveRun(); UI.update(); return run.jokers.length;`);
  /** the Shop's items at their longest: Jokers with the longest texts (one with an Edition), Mega packs, the Voucher
      with the longest text; no money, so every Buy says why it can't be bought */
  const stockShop = async () => runJs(`
    const J = Cn.JOKERS.filter((j) => j.rarity !== 'legendary' && !run.jokers.some((x) => x.id === j.id)).sort((a, b) => b.text.length - a.text.length);
    const V = Cn.VOUCHERS.filter((v) => !run.vouchers.includes(v.id)).sort((a, b) => b.text.length - a.text.length);
    const packs = ['tarotmega', 'planetmega', 'jokermega'].map((id) => Cn.PACKS.find((p) => p.id === id));
    let c = 0, k = 0;
    run.shop.items.forEach((it) => {
      if (!it) return;
      if (it.slot === 'card') { const j = J[c++ % J.length]; Object.assign(it, { kind: 'joker', id: j.id, price: j.cost, edition: c === 1 ? 'fourcolor' : null, sold: false }); }
      else if (it.slot === 'pack') { const p = packs[k++ % packs.length]; Object.assign(it, { kind: 'pack', id: p.id, price: p.price, size: p.size, sold: false }); }
      else if (it.slot === 'voucher') Object.assign(it, { kind: 'voucher', id: V[0].id, price: 10, sold: false });
    });
    run.money = 0; UI.saveRun(); UI.update(); return run.shop.items.filter((x) => x && !x.sold).length;`);
  const toShop = async () => {
    await js(`document.querySelector('.blind-card.is-current [data-action="start-blind"]').click(), 1`);
    await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
    await runJs('run.blind.target = 1; UI.update(); return 1;');
    await page.key('1'); await page.key('Enter');
    await until('the cash-out', (s) => s.screen === 'cashout' && !s.busy, 30000);
    await js(`document.querySelector('#dialogs [data-action="collect"]').click(), 1`);
    await until('the Shop', (s) => s.screen === 'shop' && !s.busy);
  };
  const fresh = async (seed, voucher) => {
    await js(`(() => { TW.UI.closeAllDialogs(); TW.UI.store.remove('run'); __wick.newRun({ seed: '${seed}' }); return 1; })()`);
    await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
    await stock();
    if (voucher) await runJs(`if (!run.vouchers.includes('${voucher}')) run.vouchers.push('${voucher}'); UI.saveRun(); UI.update(); return 1;`);
  };
  const PLAY_NEED = ['#target', '#score', '#chips', '#mult', '#hands', '#discards', '#money', '#racks .rack'];

  await home();
  await until('the title', (s) => s.screen === 'title');
  await until('the fonts', (s) => !!s.fonts);

  // ------------------------------------------------------------ the title and setup
  await sweep('title');
  await js(`document.querySelector('[data-action="new-run"]').click(), 1`);
  await until('setup', (s) => s.screen === 'setup');
  await page.sleep(200);
  await sweep('setup');

  // ------------------------------------------------------------ the Blind select, the table, the payout, the cash-out
  await fresh('WINDOWS1');
  await sweep('blinds', { need: ['.blind-card', '#money', '#racks .rack'] });
  await js(`document.querySelector('.blind-card.is-current [data-action="start-blind"]').click(), 1`);
  await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
  await sweep('play', { need: PLAY_NEED });
  await page.key('1');
  await until('a card chosen', (s) => s.selected.length === 1);
  await sweep('chosen', { need: PLAY_NEED.concat(['#mover']) });
  if (on('peak')) {
    // the peak is reached at each size (a payout started at one size and shown at another keeps the first size's
    // plates until it ends, by design: a redraw waits for the payout): one hand a size, a Blind that is never beaten
    await runJs('run.blind.target = 1e15; UI.update(); return 1;');
    await sweep('peak', {
      busy: true, need: ['.plaque', '#score', '#chips', '#mult', '#money'],
      before: async () => {
        await runJs('const b = run.blind; b.handsLeft = 4; b.draw.push(...b.discardPile.splice(0)); UI.update(); UI.table.select([b.hand[0]]); return 1;');
        await js(`window.__peak = __wick.hold('peak'); 1`);
        await js(`document.querySelector('[data-action="play-hand"]').click(), 1`);
        await js('window.__peak');
        await page.sleep(80);
      },
      after: async () => {
        await js('__wick.release(); 1');
        await until('the hand back', (s) => s.screen === 'play' && !s.busy, 30000);
      },
    });
  }
  await runJs('run.blind.target = 1; run.blind.handsLeft = Math.max(1, run.blind.handsLeft); UI.update(); UI.table.select([run.blind.hand[0]]); return 1;');
  await js(`document.querySelector('[data-action="play-hand"]').click(), 1`);
  await until('the cash-out', (s) => s.screen === 'cashout' && !s.busy, 30000);
  await sweep('cashout', { need: ['#dialogs .beaten'] });

  // ------------------------------------------------------------ the Shop with 5 items, then every Mega pack
  await js(`document.querySelector('#dialogs [data-action="collect"]').click(), 1`);
  await until('the Shop', (s) => s.screen === 'shop' && !s.busy);
  const five = await stockShop();
  if (five !== 5) fail('the Shop should offer 5 items', five);
  await sweep('shop5', { need: ['#shop', '#money'], buysAtRest: true });
  for (const packId of ['cardmega', 'tarotmega', 'planetmega', 'jokermega', 'ghostmega']) {
    if (!on(packId)) continue;
    await runJs(`const k = run.shop.items.findIndex((x) => x && x.slot === 'pack'); const row = Cn.PACKS.find((p) => p.id === '${packId}'); Object.assign(run.shop.items[k], { kind: 'pack', id: row.id, price: row.price, size: row.size, sold: false }); run.money = 40; UI.update(); return 1;`);
    const i = await runJs(`return run.shop.items.findIndex((x) => x && x.slot === 'pack' && !x.sold);`);
    await js(`document.querySelector('[data-action="buy"][data-index="${i}"]').click(), 1`);
    await until(`the ${packId}`, (s) => s.screen === 'pack' && !s.busy);
    const deals = await js(`!!document.querySelector('.pack-view.has-hand')`);
    await sweep(packId, { need: ['.pk-head', '#money'], readings: deals && /tarot|ghost/.test(packId) });
    await js(`document.querySelector('[data-action="pack-skip"]').click(), 1`);
    await until('the Shop again', (s) => s.screen === 'shop' && !s.busy);
  }

  // ------------------------------------------------------------ a Boss Blind with the longest rule: the Blind select and the table
  if (on('bossselect') || on('boss')) {
    await fresh('WINDOWSB');
    await runJs(`const id = Cn.BOSSES.slice().sort((a, b) => b.text.length - a.text.length)[0].id; run.bosses[run.ante] = id; run.blindStatus[run.ante + '-0'] = 'cleared'; run.blindStatus[run.ante + '-1'] = 'cleared'; run.blindIndex = 2; UI.saveRun(); UI.refresh(); return id;`);
    await until('the Boss Blind select', (s) => s.screen === 'blind-select' && !s.busy && s.blindIndex === 2);
    await sweep('bossselect', { need: ['.blind-card', '#money', '#racks .rack'] });
    await js(`document.querySelector('.blind-card.is-current [data-action="start-blind"]').click(), 1`);
    await until('the Boss deal', (s) => s.screen === 'play' && !s.busy && s.hand.length > 0);
    await sweep('boss', { need: PLAY_NEED.concat(['.w-blind .boss-rule']) });
  }

  // ------------------------------------------------------------ Game Over and You win!
  if (on('gameover')) {
    await fresh('LOSEWIN1');
    await runJs(`__wick.act('startBlind'); const b = __wick.run().blind; b.handsLeft = 1; b.target = 999999; return 1;`);
    await runJs(`return __wick.act('playHand', [__wick.run().blind.hand[0]]).ok;`);
    await until('Game Over', (s) => s.screen === 'gameover');
    await page.sleep(300);
    await sweep('gameover', { need: ['.es-plate'] });
  }
  if (on('win')) {
    await fresh('LOSEWIN2');
    await runJs(`run.ante = 8; run.blindIndex = 2; UI.refresh(); return 1;`);
    await until('the Boss Blind', (s) => s.screen === 'blind-select' && !s.busy);
    await runJs(`__wick.act('startBlind'); __wick.run().blind.target = 1; return 1;`);
    await runJs(`return __wick.act('playHand', [__wick.run().blind.hand[0]]).ok;`);
    await until('You win!', (s) => s.screen === 'win');
    await page.sleep(300);
    await sweep('win', { need: ['.es-plate'] });
  }

  // ------------------------------------------------------------ Night Market: the Shop with 7 items
  if (on('shop7')) {
    await fresh('WINDOWS7', 'spinnerrack');
    await toShop();
    const seven = await stockShop();
    if (seven !== 7) fail('Night Market should offer 7 items', seven);
    await sweep('shop7', { need: ['#shop', '#money'] });
  }

  // ------------------------------------------------------------ the summary
  const bySize = {};
  for (const k of Object.keys(fails)) { const sz = k.split('@')[1]; bySize[sz] = (bySize[sz] || 0) + 1; }
  const byScreen = {};
  for (const k of Object.keys(fails)) { const sc = k.split('@')[0]; byScreen[sc] = (byScreen[sc] || 0) + 1; }
  const summary = { sizes: SIZES.length, screens: Object.keys(table).length, measured: checks, failing: Object.keys(fails).length, known: Object.keys(known).length, byScreen, bySize };
  if (process.env.OUT) { mkdirSync(process.env.OUT, { recursive: true }); writeFileSync(join(process.env.OUT, 'windows.json'), JSON.stringify({ summary, fails, known, read, table }, null, 1)); }
  if (summary.failing && !SOFT) fail(`${summary.failing} of ${checks} screen sizes fail`, { byScreen, fails: Object.fromEntries(Object.entries(fails).slice(0, 40)) });
  return { summary, fails, known, read };
}
