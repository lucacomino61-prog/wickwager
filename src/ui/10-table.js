/* Wickwager table (ARCH.md section 5): the table shell (left column, racks), Blind select, the play table,
   the payout and the cash-out. Ported from mockups/ember-lit/play.js and generalised to the engine:
   the payout walks Engine.playHand's step trace (SPEC 4.3) and plays Lit's timeline beats for every step it
   finds, with a generic beat for step kinds it does not know. Names and texts come from TW.Content and the
   engine at run time; nothing here names an item.

   Screens: 'blind-select', 'play', 'cashout' (all shell screens: the column and the racks stay put).
   Shell API (other screens use it): TW.UI.shell.ensure() → main area, .renderCol(), .renderRacks(), .el()
   Table API: TW.UI.table = { selected(), select(uids), playHand(), discard(), sortBy(mode), openJoker(uid),
              openConsumable(uid), describeEffect(info, effect), describeGain(gained), cardLabel(card), layoutHand(),
              nextBlindCounts(run) (the hands and discards the next Blind will deal, shown outside a Blind),
              bossRule(bossId) and bossText(run, bossId) (a Boss Blind's rule as the engine words it for this Ante),
              moveCard(uid, dir) (a card one place along the hand without a drag: Shift+arrow, or the Move pair),
              refocusRack(kind, index) (focus to the rack item now in a sold or used one's place),
              markClamped(root) (a Boss rule the layout cuts short opens its tip, and takes focus, with the whole rule) } */
(() => {
  'use strict';
  const TW = (globalThis.TW = globalThis.TW || {});
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const UI = TW.UI;
  if (!UI) return;
  const { $, $$, el, esc, fmt, fmtMult, num, numHTML, anim, transient, punch, flare, EASE, C } = UI;
  const PX = () => UI.PX();
  const E = () => UI.engine();
  const R = () => UI.run();
  const B = () => { const r = R(); return r ? r.blind : null; };
  const q = (...a) => UI.q(...a);

  const T = {
    root: null, col: null, field: null, racks: null, main: null, tfx: null,
    selected: new Set(), tl: null, kit: null, seed: UI.rng('payout'), warmed: false,
  };

  // ================================================================== small helpers
  /** A readout in the digit face; the same value at the same size is left as it is (no new image, no relayout). */
  const setNum = (node, text, size, style) => {
    if (!node) return;
    const key = `${size}:${style}`;
    if (node.dataset.v === text && node.dataset.sz === key && node.firstChild) return;
    node.innerHTML = numHTML(text, size, style);
    node.dataset.v = text;
    node.dataset.sz = key;
  };
  const centre = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };
  const fx = () => $('#fx');
  const fxl = () => $('#fxl');
  const later = (ms, fn) => setTimeout(fn, UI.dur(ms));
  /** Schedule inside the running payout when there is one (so a held still pauses it), else on a timer. */
  const after = (ms, fn) => { if (T.tl && !T.tl.cancelled && T.tl.done) T.tl.after(ms, fn); else later(ms, fn); };
  /** The lift, the idle hop and the light over a face (00-core.js layersHTML, shared with the Shop and the menus). */
  const layers = (inner, i) => UI.layersHTML(inner, i);
  const bossRow = () => { const b = B(); return b && b.boss ? C.boss(b.boss) : null; };
  const phase = () => (R() ? R().phase : null);
  const cardEl = (uid) => (T.root ? T.root.querySelector(`.card[data-uid="${uid}"]`) : null);
  const handEl = () => $('#hand');
  const handNodes = () => { const h = handEl(); return h ? $$('.card', h) : []; };
  const jokerEl = (uid) => (T.root ? T.root.querySelector(`.jk[data-joker-uid="${uid}"]`) : null);
  const consEl = (uid) => (T.root ? T.root.querySelector(`.jk[data-consumable-uid="${uid}"]`) : null);
  const selectedInOrder = () => { const b = B(); return b ? b.hand.filter((u) => T.selected.has(u)) : []; };
  const getCard = (uid) => q('getCard', uid);
  /** What the Jokers' events did (the engine's jokerEvents): each Joker bumps with its label and sound. The beats
      live in 20-shop.js and serve the whole table. Returns their length in base ms. */
  const jokerEvents = (events, delay = 0) => (UI.shop && typeof UI.shop.jokerEvents === 'function' && events && events.length ? UI.shop.jokerEvents(events, delay) : 0);
  /** After a hand or a discard the control that had focus may be gone or switched off: focus lands on the card now in
      the place of a card that was played or tossed, or on the hand when a button it was on is off (Play hand, with no
      card chosen). Focus that was on the page itself (a player on the number keys and Enter) stays there, so Enter
      keeps playing the hand; it never lands on a card, where Enter chooses the card. prev: what had focus before. */
  function refocusHand(index, prev) {
    const a = document.activeElement;
    if (a && a !== document.body && a.isConnected && !a.disabled) return;
    if (!prev || prev === document.body || prev === document.documentElement) return;
    const cards = handNodes();
    if (prev.classList && prev.classList.contains('card') && cards.length) { UI.focusQuiet(cards[Math.max(0, Math.min(cards.length - 1, index || 0))]); return; }
    const h = handEl();
    if (h) UI.focusQuiet(h);
  }
  const focusIndex = () => { const a = document.activeElement; const i = a ? handNodes().indexOf(a) : -1; return i < 0 ? 0 : i; };

  // ================================================================== the table shell
  function buildTable() {
    const app = $('#app');
    app.replaceChildren();
    T.root = el('div', { class: 'table', id: 'page' });
    T.col = el('aside', { class: 'col', id: 'col', 'aria-label': 'Run status' });
    T.field = el('main', { class: 'field', id: 'field', 'aria-label': 'Table' });
    T.racks = el('div', { class: 'racks', id: 'racks' });
    T.main = el('div', { class: 'main', id: 'main' });
    T.field.append(T.racks, T.main);
    T.tfx = el('div', { class: 'table-fx', id: 'tfx', 'aria-hidden': 'true' });
    T.root.append(T.col, T.field, T.tfx);
    app.append(T.root);
    T.kit = null;
    // once the first deal has settled, the table gets a layer of its own, so a shake never repaints it
    setTimeout(() => { if (T.root) T.root.style.willChange = 'transform'; }, UI.dur(1100) + 1);
    warmSprites();
  }
  /** The table arrives from a menu: the column's panels slide in from the left one after another and the racks
      drop in from above, on Lit's spring (the menu that left fades over them). Reduced motion keeps the fades. */
  function enterTable() {
    if (UI.TEST) return;
    const p = PX();
    $$(':scope > *', T.col).forEach((n, i) => anim(n, [{ opacity: 0, transform: `translateX(${-8 * p}px)` }, { opacity: 1, transform: 'none' }], { d: 560, delay: 40 + i * 45, e: EASE.spring, fill: 'backwards' }));
    $$(':scope > .rack', T.racks).forEach((n, i) => anim(n, [{ opacity: 0, transform: `translateY(${-6 * p}px)` }, { opacity: 1, transform: 'none' }], { d: 560, delay: 80 + i * 70, e: EASE.spring, fill: 'backwards' }));
  }
  UI.shell = {
    /** Builds the table when it is missing, refreshes the column and the racks, and returns the main area. */
    ensure() {
      const fresh = !T.root || !T.root.isConnected;
      if (fresh) buildTable();
      renderCol(); renderRacks();
      if (fresh) enterTable();
      // plate names are measured in the pixel face: measure again once it has loaded
      if (!T.fontHook && UI.fontsReady) { T.fontHook = true; UI.fontsReady.then(() => { if (T.root && T.root.isConnected) renderRacks({ force: true }); }); }
      return T.main;
    },
    remove() { cancelPayout(); if (T.root && T.root.parentNode) T.root.remove(); T.root = null; T.kit = null; },
    renderCol: () => renderCol(),
    renderRacks: (o) => renderRacks(o),
    placeLight: () => placeLight(),
    el: () => ({ table: T.root, col: T.col, field: T.field, racks: T.racks, main: T.main, fx: T.tfx }),
  };

  // ================================================================== numbers in the left column
  /** The largest digit face that fits a readout's box (its width is measured once per viewport, never per redraw). */
  const fitIn = (box, text, sizes, pad, key) => { const w = UI.boxWidth(box, key); return UI.fitSize(text, w ? w - pad * PX() : 100 * PX(), sizes); };
  /** The short exponent the digit face already shows past a trillion (fmt), for a number its box can't hold whole. */
  const shortNum = (v) => (Number(v) || 0).toExponential(2).replace('+', '');
  function setWell(kind, v) {
    const node = $('#' + kind);
    if (!node) return;
    const text = kind === 'mult' ? fmtMult(v) : fmt(v);
    setNum(node, text, fitIn(node.parentElement, text, ['XL', 'L', 'S'], 8, 'well-' + kind), kind);
  }
  function setScore(v) {
    const node = $('#score');
    if (!node) return;
    // past what the smaller face can hold (eleven digits on a phone) the short exponent, every digit for the screen reader
    const w = UI.boxWidth(node.closest('.score-n'), 'score'), room = w ? w - 4 * PX() : 100 * PX();
    const text = UI.numWidth(fmt(v), 'S') * PX() > room ? shortNum(v) : fmt(v);
    setNum(node, text, UI.fitSize(text, room, ['XL', 'L', 'S']), 'score');
    const sr = $('.sr', node);
    if (sr) sr.textContent = fmt(v);
  }
  function setMoney(v) {
    const node = $('#money');
    if (!node) return;
    const text = '$' + fmt(v);
    setNum(node, text, fitIn(node.closest('.w-money'), text, ['L', 'S'], 9, 'money'), 'money');
  }
  /** The Blind plate's target: deep in Endless mode it runs to nine digits and more, so it takes the smaller face
      rather than leave the plate, and past that the short exponent (the screen reader still hears every digit).
      key names the room beside the Blind's token (a candle, or that Boss's emblem). */
  function setTarget(v, key) {
    const node = $('#target');
    if (!node) return;
    const w = UI.boxWidth(node.closest('.target'), key), room = w ? w - PX() : 100 * PX();
    const text = UI.numWidth(fmt(v), 'S') * PX() > room ? shortNum(v) : fmt(v);
    setNum(node, text, UI.fitSize(text, room, ['L', 'S']), 'cream');
    const sr = $('.sr', node);
    if (sr) sr.textContent = fmt(v);
  }
  function setCount(id, v, style) { const node = $('#' + id); if (node) setNum(node, String(v), 'L', style); }
  /** Count a readout from one value to another in 18 eased steps (inside the payout when one is running). */
  // the latest count per readout wins: a count still running never writes over a newer value (a purchase made
  // while the money is still counting up from the cash-out)
  const COUNTS = new Map();
  function countTo(from, to, ms, set) {
    const seq = (COUNTS.get(set) || 0) + 1;
    COUNTS.set(set, seq);
    if (!UI.motionOK() || UI.dur(ms) === 0) { set(to); return; }
    const ease = (p) => 1 - Math.pow(1 - p, 3);
    const n = 18;
    for (let i = 1; i <= n; i++) after((ms * i) / n, () => { if (COUNTS.get(set) === seq) set(Math.round(from + (to - from) * ease(i / n))); });
  }
  /** A readout set straight to a value also ends any count still running on it. */
  const setNow = (set, v) => { COUNTS.set(set, (COUNTS.get(set) || 0) + 1); set(v); };

  // ================================================================== the left column (Lit's renderCol, from the run)
  function blindNow(run) {
    const info = q('currentBlindInfo') || { kind: 'small', target: 0, reward: 0, boss: null, status: 'current', index: 0 };
    const b = run.blind;
    return {
      kind: b ? b.kind : info.kind, index: b ? b.index : info.index, target: b ? b.target : info.target, reward: info.reward,
      bossId: b ? b.boss : info.boss && info.boss.id, status: info.status, score: b ? b.score : 0,
    };
  }
  function candleHTML(kind, out) {
    const tall = kind === 'big';
    const art = UI.artSprite('blind:' + (tall ? 'big' : 'small'));
    const wax = art ? UI.paint.imgTag(art) : UI.paint.imgTag(UI.paint.candle(tall));
    return `<div class="candle${out ? ' is-out' : ''}" aria-hidden="true"><div class="wick"><span class="bloom"></span><span class="flame"></span></div>${wax}</div>`;
  }
  function emblemHTML(bossId) {
    const row = C.boss(bossId);
    return `<div class="emblem" data-boss-id="${esc(bossId)}"><span class="bloom" aria-hidden="true"></span>${UI.spriteHTML('boss:' + bossId, { kind: 'boss', name: row ? row.name : '', alt: row ? row.name : '' })}</div>`;
  }
  /** A Boss Blind's rule as the engine words it for this Ante (a cap that climbs with the Ante says what it is now:
      The Lid's "(now 24)", as on the Blind select), else the content row's text. */
  function bossRule(bossId) {
    const row = C.boss(bossId);
    if (!row) return '';
    const cur = q('currentBlindInfo');
    if (cur && cur.boss && cur.boss.id === bossId && cur.boss.text) return cur.boss.text;
    const hit = (q('blindsForAnte') || []).find((x) => x && x.boss && x.boss.id === bossId);
    return (hit && hit.boss.text) || row.text || '';
  }
  /** The rule the Blind plate shows: the live rule, plus what the Boss Blind picked this Blind in brackets. */
  function bossText(run, bossId) {
    let text = bossRule(bossId);
    const b = run && run.blind;
    if (b && b.grudgeHand) text += ` (${C.hand(b.grudgeHand).name})`;
    if (b && b.wetJoker) { const j = run.jokers.find((x) => x.uid === b.wetJoker); if (j) text += ` (${C.joker(j.id).name})`; }
    return text;
  }
  function bossLine(run, bossId) {
    const row = C.boss(bossId);
    if (!row) return '';
    return `<div class="boss-rule" data-rule="${esc(bossId)}"><span class="b-name">${esc(row.name)}</span><p class="copy">${UI.richText(bossText(run, bossId))}</p></div>`;
  }
  /** Where the layout cuts a Boss Blind's rule to two lines and hides its emblem (a landscape phone, or 720 x 450: a
      laptop at 200 % zoom), the whole rule would be readable nowhere on the screen (WCAG 1.4.4). A rule that is cut
      opens the Boss Blind's tip with the whole rule on hover, on a tap and on keyboard focus (it becomes a stop of its
      own, named with the whole rule). Measured once laid out; a rule that fits is plain text again. */
  function markClamped(root) {
    if (!root || !root.isConnected) return;
    UI.afterLayout(root, () => $$('[data-rule]', root).forEach((n) => {
      const copy = $('.copy', n), id = n.dataset.rule;
      if (!copy || !id || !n.isConnected) return;
      if (copy.scrollHeight > copy.clientHeight + 1) {
        if (n.classList.contains('is-cut')) return;
        const name = $('.b-name', n);
        n.classList.add('is-cut');
        n.dataset.bossId = id;
        n.setAttribute('tabindex', '0');
        n.setAttribute('role', 'group');
        n.setAttribute('aria-label', `${name ? name.textContent : ''}: ${copy.textContent}`);
      } else if (n.classList.contains('is-cut')) {
        n.classList.remove('is-cut');
        delete n.dataset.bossId;
        ['tabindex', 'role', 'aria-label'].forEach((a) => n.removeAttribute(a));
      }
    }));
  }
  /** Outside a Blind (Blind select, the Shop, an open pack) the column shows what the next Blind will deal, the way
      Engine.startBlind works it out (SPEC 2.3 step 2, the engine's newBlind): the run's hands and discards plus what
      waits in run.pending, and for a Boss Blind the owned Vouchers' bossHands (Midnight Oil) and the Boss Blind's own
      handsDelta (The Short Fuse). In the Shop, and in a pack bought there, the next Blind is the one after the Blind
      just beaten (leaveShop advances blindIndex); at the Blind select, and in a pack a Tag opened there, it is the
      current one. */
  function nextBlindCounts(run) {
    const D = (TW.Content && TW.Content.DEFAULTS) || {};
    const pend = run.pending || {};
    const afterShop = run.phase === 'shop' || (run.phase === 'pack' && !!run.pack && run.pack.returnTo === 'shop');
    const blinds = (TW.Content && TW.Content.BLINDS) || [];
    const i = afterShop ? run.blindIndex + 1 : run.blindIndex;
    const kind = i > 2 ? 'small' : ((blinds[i] && blinds[i].kind) || ['small', 'big', 'boss'][i] || 'small');
    let hands = (Number(run.hands) || 0) + (Number(pend.extraHands) || 0);
    if (kind === 'boss') {
      hands += (run.vouchers || []).reduce((s, id) => s + (Number((C.row('VOUCHERS', id) || {}).bossHands) || 0), 0);
      const bossId = run.bosses ? run.bosses[run.ante] : null;
      const row = bossId ? C.row('BOSSES', bossId) : null;
      hands += (row && Number(row.handsDelta)) || 0;
    }
    return {
      hands: Math.max(D.minHands != null ? D.minHands : 1, hands),
      discards: Math.max(D.minDiscards != null ? D.minDiscards : 0, (Number(run.discards) || 0) + (Number(pend.extraDiscards) || 0)),
    };
  }
  function renderCol() {
    if (!T.col) return;
    const run = R();
    if (!run) { T.col.replaceChildren(); return; }
    const info = blindNow(run);
    const b = run.blind;
    const ph = run.phase;
    const boss = info.bossId ? C.boss(info.bossId) : null;
    const blindName = info.kind === 'boss' && boss ? boss.name : C.blind(info.kind).name;
    // a pack a Tag opened at the Blind select comes before that Blind: its candle stays lit
    const cleared = !b && (info.status === 'cleared' || ph === 'shop' || (ph === 'pack' && !!run.pack && run.pack.returnTo === 'shop'));
    const next = b ? null : nextBlindCounts(run);
    const hands = b ? b.handsLeft : next.hands;
    const discards = b ? b.discardsLeft : next.discards;
    const ante = run.ante > 8 ? String(run.ante) : `${run.ante}/8`;
    const round = UI.roundNumber(run);
    const icon = (n) => UI.iconHTML(n, 'light');
    const token = info.kind === 'boss' && info.bossId ? emblemHTML(info.bossId) : candleHTML(info.kind, cleared);
    // the readouts are plain text in their labelled panels, never live regions: a payout's count-up writes into them
    // dozens of times, and #live alone says what a hand scored (once, in words)
    T.col.innerHTML = `
      <section class="panel ${info.kind === 'boss' ? 'boss' : 'warm'} w-blind${cleared ? ' is-cleared' : ''}" aria-label="Blind" id="blindPanel">
        <div class="p-head"><h2 class="tag ${info.kind === 'boss' ? 't-vio' : 't-ember'}" id="blindTag"><span class="tw">Ante ${run.ante} · ${esc(blindName)}</span></h2></div>
        <div class="blind-body">
          ${token}
          <div class="target">
            <span class="lbl">${cleared ? 'Blind cleared' : 'Target'}</span>
            <span class="n g-cream" id="target"></span>
            <span class="reward"><span class="lbl">Reward</span><span class="n g-money" id="reward"></span></span>
          </div>
        </div>
        ${info.kind === 'boss' && info.bossId ? bossLine(run, info.bossId) : ''}
      </section>
      <section class="panel deep w-score" aria-label="Blind score">
        <div class="p-head"><h2 class="tag t-lime" id="scoreTab">${b && b.score >= b.target && ph !== 'play' ? 'Blind beaten' : 'Blind score'}</h2></div>
        <div class="score-n"><span class="n g-score" id="score"></span></div>
      </section>
      <section class="panel w-hand" aria-label="Selected hand">
        <div class="p-head"><h2 class="tag t-cream" id="handTab"><span id="handName">${ph === 'play' ? 'Select cards' : 'Hand'}</span></h2></div>
        <div class="cxm">
          <div class="well-n chips" id="chipsBox"><span class="sr">Chips</span><span class="n g-chips" id="chips"></span></div>
          <span class="times" aria-hidden="true">${num('x', 'S', 'cream')}</span>
          <div class="well-n mult" id="multBox"><span class="sr">Mult</span><span class="n g-mult" id="mult"></span></div>
        </div>
      </section>
      <div class="row r-counts">
        <section class="panel w-count w-hands" aria-label="Hands left"><span class="lbl">Hands</span><span class="n g-ember" id="hands"></span></section>
        <section class="panel w-count w-discards" aria-label="Discards left"><span class="lbl">Discards</span><span class="n g-pink" id="discards"></span></section>
        <section class="panel w-small ph-only" aria-label="Ante"><span class="lbl">Ante</span><span class="n">${numHTML(ante, 'S', 'cream')}</span></section>
        <section class="panel w-small ph-only" aria-label="Blind count"><span class="lbl">Blind</span><span class="n">${numHTML(String(round), 'S', 'cream')}</span></section>
        <button class="btn b-ghost ph-only" type="button" data-action="open-run-info" aria-label="Overview">${icon('info')}</button>
        <button class="btn b-ghost ph-only" type="button" data-action="open-options" aria-label="Options">${icon('options')}</button>
      </div>
      <div class="row r-money">
        <section class="panel w-money" aria-label="Money"><span class="lbl">Money</span><span class="n g-money" id="money"></span></section>
        <section class="panel w-small" aria-label="Ante"><span class="lbl">Ante</span><span class="n">${numHTML(ante, 'S', 'cream')}</span></section>
        <section class="panel w-small" aria-label="Blind count"><span class="lbl">Blind</span><span class="n">${numHTML(String(round), 'S', 'cream')}</span></section>
      </div>
      <div class="row r-btns">
        <button class="btn b-ghost" type="button" data-action="open-run-info" aria-label="Overview">${icon('info')}<span class="t">Overview</span></button>
        <button class="btn b-ghost" type="button" data-action="open-options" aria-label="Options">${icon('options')}<span class="t">Options</span></button>
      </div>`;
    setTarget(info.target, 'target-' + (info.bossId || info.kind));
    setNum($('#reward'), '$' + fmt(info.reward), 'S', 'money');
    setNow(setScore, b ? b.score : 0);
    setCount('hands', hands, 'ember');
    setCount('discards', discards, 'pink');
    setNow(setMoney, run.money);
    if (ph === 'play') updateSelection(); else { setWell('chips', 0); setWell('mult', 0); }
    if (info.kind === 'boss' && info.bossId) markClamped(T.col);
  }

  // ================================================================== the racks: Jokers and consumables
  // name plates and Edition light are shared helpers in 00-core.js (one rule for the table, the Shop and the menus)
  const plateHTML = (name) => UI.plateHTML(name);
  const edFx = (edition, faceId) => UI.edFxHTML(edition, faceId);
  const editionName = (id) => (id ? (C.edition(id) || {}).name || id : '');
  function jokerLabel(j) {
    const row = C.joker(j.id);
    const parts = [row.name];
    if (j.edition) parts.push(editionName(j.edition));
    parts.push(`${C.rarity(row.rarity)} Joker`);
    const text = q('jokerText', j.uid) || row.text || '';
    return parts.join(', ') + (text ? '. ' + text : '');
  }
  function jokerHTML(j, i) {
    const row = C.joker(j.id);
    const id = 'joker:' + j.id;
    const b = B();
    const off = !!(b && b.wetJoker === j.uid && phase() === 'play');
    const inv = j.edition && (C.edition(j.edition) || {}).slot;
    const face = UI.spriteHTML(id, { kind: 'joker', rarity: row.rarity, name: row.name, cls: 'face' });
    return `<button class="jk${j.edition ? ' ed-' + esc(j.edition) : ''}${off ? ' is-off' : ''}" type="button" data-joker-uid="${esc(j.uid)}" data-joker="${esc(j.id)}" aria-label="${esc(jokerLabel(j))}${off ? '. Switched off this Blind.' : ''}">${layers(face + edFx(j.edition, id) + plateHTML(row.name), i + 3)}${off ? '<span class="tag t-plum off-mark" aria-hidden="true">Off</span>' : ''}${inv ? '<span class="tag t-vio inv-mark" aria-hidden="true">+1</span>' : ''}</button>`;
  }
  const KIND_WORD = { tarot: 'Tarot card', planet: 'Planet card', spectral: 'Spectral card' };
  function consHTML(k, i) {
    const row = C.consumable(k.kind, k.id);
    const id = `${k.kind}:${k.id}`;
    const face = UI.spriteHTML(id, { kind: k.kind, name: row.name, cls: 'face' });
    return `<button class="jk cons" type="button" data-consumable-uid="${esc(k.uid)}" aria-label="${esc(`${row.name}, ${KIND_WORD[k.kind] || 'card'}. ${row.text || ''}`)}">${layers(face + plateHTML(row.name), i + 9)}</button>`;
  }
  function renderRacks(o = {}) {
    if (!T.racks) return;
    const run = R();
    if (!run) { T.racks.replaceChildren(); return; }
    const used = q('jokerSlotsUsed') ?? run.jokers.length;
    const inv = run.jokers.filter((j) => j.edition && (C.edition(j.edition) || {}).slot).length;
    const slot = UI.paint.imgTag(UI.paint.slot(), 'slot');
    const jok = run.jokers.map(jokerHTML).join('') + slot.repeat(Math.max(0, run.jokerSlots - used));
    const cons = run.consumables.map(consHTML).join('') + slot.repeat(Math.max(0, run.consumableSlots - run.consumables.length));
    // in the compact layout the Joker rack scrolls sideways; with no Joker in it, only its empty slots overflow it, and
    // a browser makes a scroller with nothing to focus a Tab stop of its own, unnamed (final pass, part 3: 720 x 450):
    // an empty rack is kept out of the Tab order (its section still says "Jokers, 0 of 5")
    const html = `
      <section class="panel rack r-jokers" aria-label="Jokers, ${used} of ${run.jokerSlots}" style="--n:${Math.max(2, run.jokers.length + Math.max(0, run.jokerSlots - used))}">
        <div class="p-head"><h2 class="tag t-pink">Jokers <span class="cnt">${used}/${run.jokerSlots}${inv ? ` +${inv}` : ''}</span></h2></div>
        <div class="rack-in" id="jokerRack"${run.jokers.length ? '' : ' tabindex="-1"'}>${jok}</div>
      </section>
      <section class="panel rack r-cons" aria-label="Consumables, ${run.consumables.length} of ${run.consumableSlots}">
        <div class="p-head"><h2 class="tag t-vio"><span class="tw">Consumables</span> <span class="cnt">${run.consumables.length}/${run.consumableSlots}</span></h2></div>
        <div class="rack-in" id="consRack">${cons}</div>
      </section>`;
    // a screen change redraws the racks; when nothing in them changed, the built ones stay (no restyle, no relayout)
    if (html === T.racksHTML && T.racks.firstElementChild && !o.force) return;
    T.racksHTML = html;
    T.racks.innerHTML = html;
  }

  // ================================================================== cards in the hand
  /** A card's accessible name: rank and suit, then its Enhancement, Edition and Seal. st (cardState) adds what the
      Boss Blind has switched off, as the card shows it greyed: "... Switched off by The Wash-Out: Kindled." The
      card's effect is its description while its tip shows (registerTip below, describe). */
  function cardLabel(c, hidden, st) {
    if (!c) return 'Card';
    if (hidden) return `Hidden card, ${UI.suitName(c.suit)}`;
    const enh = c.enhancement ? C.enhancement(c.enhancement).name : '', ed = c.edition ? editionName(c.edition) : '', seal = c.seal ? C.seal(c.seal).name : '';
    const label = [`${UI.rankWord(c.rank)} of ${UI.suitName(c.suit)}`, enh, ed, seal].filter(Boolean).join(', ');
    const off = [st && st.washed ? enh : '', st && st.censored ? ed : '', st && st.censored ? seal : ''].filter(Boolean);
    if (!off.length) return label;
    const boss = bossRow();
    return `${label}. Switched off by ${boss ? boss.name : 'the Boss Blind'}: ${UI.listJoin(off)}.`;
  }
  function cardState(c) {
    const b = B(), boss = bossRow();
    const smudged = !!(b && b.hideRanks) && !T.selected.has(c.uid);
    const washed = !!(boss && boss.noEnhancements) && !!c.enhancement;
    const censored = !!(boss && boss.noEditionsSeals) && !!(c.edition || c.seal);
    return { smudged, washed, censored };
  }
  /** A Seal's badge laid over the card at its spot, so the part that sticks up above the top edge shows (Lit's ribbon). */
  const sealHTML = (c, off) => (!c || !c.seal || off ? '' : UI.sealBadgeHTML(c.seal));
  function cardHTML(c, i) {
    const st = cardState(c);
    const id = UI.cardSpriteId(c);
    const face = UI.spriteHTML(id, { kind: 'card', card: c, cls: 'face' }) + sealHTML(c, st.censored);
    const ed = c.edition && !st.censored ? c.edition : null;
    const b = B();
    const smudge = b && b.hideRanks ? smudgeHTML(id) : '';
    const sel = T.selected.has(c.uid);
    return `<button class="card${ed ? ' ed-' + esc(ed) : ''}${st.washed ? ' is-washed' : ''}${st.censored ? ' is-censored' : ''}" type="button" data-uid="${esc(c.uid)}" aria-pressed="${sel}" aria-label="${esc(cardLabel(c, st.smudged, st))}">${layers(face + edFx(ed, id) + smudge, i)}</button>`;
  }
  /** The Smudge's smear: the rank and pips vanish under violet ink; a window keeps the small suit pip in view. */
  function smudgeHTML(faceId) {
    const s = UI.artSprite(faceId);
    const peek = s ? `<span class="suit-peek"><img class="spr" src="${s.url}" style="--w:${s.w};--h:${s.h}" alt="" aria-hidden="true" draggable="false"></span>` : '';
    return `<span class="smudge" aria-hidden="true">${peek}${num('?', 'L', 'vio')}</span>`;
  }
  function layoutHand() {
    const hand = handEl();
    if (!hand) return;
    const cards = $$('.card', hand);
    const n = cards.length;
    hand.style.setProperty('--n', String(Math.max(2, n)));
    const phone = UI.MQ.phone.matches, p = PX();
    // a held arc without rotation: the centre of the hand rides higher, in whole art pixels
    cards.forEach((c, i) => {
      const m = i - (n - 1) / 2;
      c.style.setProperty('--arc', Math.round(m * m * (phone ? 0.56 : 0.5)) * p + 'px');
      c.style.zIndex = String(i + 1);
    });
    fanCheck(hand);
  }
  // TW.Art stamps a Seal at the card's top right (its right edge at x 38, art px); once the step from one card to the
  // next is shorter than this, the next card covers most of it
  const SEAL_REACH = 34;
  // every Seal badge is 9 art px wide (seal:encore, paid, airmail, cameo)
  const SEAL_TAB_W = 9;
  /** A fanned hand (a phone's eight cards, or many more on a wide one): every card the next one covers wears its
      Seal badge in the strip that shows (.hand.is-fanned in 40-table.css), and its picture is the face without the
      Seal (TW.Art composes it), so the Seal is never seen twice: the art's own would peek over a lower neighbour or
      at a lifted card's corner. The last card shows its whole face as drawn. Read once the hand is laid out. */
  function fanCheck(hand) {
    UI.afterLayout(hand, () => {
      if (!hand.isConnected) return;
      const cards = $$('.card', hand);
      const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : Infinity;
      const fanned = step < SEAL_REACH * PX();
      hand.classList.toggle('is-fanned', fanned);
      // the tab stands whole on its strip: at x 10 (art px), clear of the index and the pips, while the strip is 19 art
      // px wide or more; on a narrower strip (15 art px at 667 x 375) it moves left to end at the strip's edge, where
      // the next card never covers it, and once it reaches the index's columns (x 3 to 7) it rides two art px higher,
      // over the top border and the stock only, so it never covers the rank (final pass, part 3: the next card hid
      // 8 by 16 px of every tab at 667 x 375)
      const tx = Math.max(1, Math.min(10, Math.floor(step / PX()) - SEAL_TAB_W));
      hand.style.setProperty('--tab-x', String(tx));
      hand.style.setProperty('--tab-b', String(tx >= 8 ? 5 : 3));
      cards.forEach((n, i) => {
        const img = n.querySelector('img.face');
        const c = img && n.querySelector('.seal-badge') ? getCard(n.dataset.uid) : null;
        if (!c || !c.seal) return;
        const s = UI.artSprite(UI.cardSpriteId(fanned && i < cards.length - 1 ? Object.assign({}, c, { seal: null }) : c));
        if (!s) return;
        [img, ...n.querySelectorAll('.ed-fx .slice')].forEach((p) => { if (p.getAttribute('src') !== s.url) p.setAttribute('src', s.url); });
      });
    });
  }
  function renderHand() {
    const hand = handEl(), b = B();
    if (!hand) return;
    if (!b) { hand.replaceChildren(); return; }
    const cards = b.hand.map((u) => getCard(u)).filter(Boolean);
    hand.innerHTML = cards.map(cardHTML).join('');
    layoutHand();
  }
  /** Centre the room's pool of candlelight on the stage. It reads the stage's place only once layout has run (a
      ResizeObserver fires after layout and before paint): reading it right after a screen is built would force a
      second, synchronous layout of everything just added. */
  function placeLight() {
    const st = $('#stage') || T.main;
    if (!st || !UI.room) return;
    UI.afterLayout(st, () => { if (st.isConnected) UI.room.placePool(st.getBoundingClientRect()); });
  }
  /** FLIP: move nodes from where they were to where a DOM change put them, on the spring. */
  function flip(nodes, mutate, o = {}) {
    const first = new Map(nodes.map((n) => [n, n.getBoundingClientRect()]));
    mutate();
    nodes.forEach((n, i) => {
      if (!n.isConnected) return;
      const a = first.get(n), b = n.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      anim(n, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { d: o.d || 520, delay: (o.stagger || 0) * i, e: EASE.spring, add: true, fill: 'backwards' });
    });
  }
  function dealOrigin() {
    const chip = $('.deck-chip');
    if (chip && chip.offsetParent) return chip.getBoundingClientRect();
    const st = $('.deck .stack');
    if (st && st.offsetParent) return st.getBoundingClientRect();
    return { left: innerWidth - 60, top: innerHeight - 60, width: 40, height: 40 };
  }
  function dealIn(nodes, startDelay = 0) {
    if (!nodes.length) return;
    const d = dealOrigin();
    const rects = nodes.map((n) => n.getBoundingClientRect());
    const flights = [];
    nodes.forEach((n, i) => {
      const r = rects[i];
      const dx = d.left + d.width / 2 - (r.left + r.width / 2), dy = d.top + d.height / 2 - (r.top + r.height / 2);
      flights.push(anim(n, [
        { transform: `translate(${dx}px, ${dy}px) rotate(12deg) scale(.92)`, opacity: 0 },
        { transform: `translate(${dx}px, ${dy}px) rotate(12deg) scale(.92)`, opacity: 1, offset: 0.01 },
        { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
      ], { d: 640, delay: startDelay + i * 55, e: EASE.spring, add: true, fill: 'backwards' }));
    });
    // input waits until the last card has landed (SPEC 6.2): nothing is chosen or played while the cards fly in
    UI.busyWhile(flights, UI.dur(startDelay + (nodes.length - 1) * 55 + 640));
    // one snap per card, on the audio clock with the stagger (each one a little different)
    rects.slice(0, 12).forEach((r, i) => UI.sfx('deal', { index: i, delay: UI.dur(startDelay + i * 55), pan: panAt(r) * 0.5 }));
  }
  /** Where a rectangle sits across the viewport, -1 (left) to 1 (right), for stereo placement. */
  const panAt = (r) => (r ? Math.max(-1, Math.min(1, ((r.left + r.width / 2) / Math.max(1, innerWidth)) * 2 - 1)) : 0);
  /** Re-render the hand from the run: cards that stay glide to their places, new ones deal in from the deck. */
  function redrawHand(o = {}) {
    const hand = handEl(), b = B();
    if (!hand || !b) return [];
    const nodes = handNodes();
    const fresh = [];
    flip(nodes, () => {
      const keep = new Map(nodes.map((n) => [n.dataset.uid, n]));
      hand.innerHTML = '';
      b.hand.forEach((u, i) => {
        const c = getCard(u);
        if (!c) return;
        const old = keep.get(u);
        if (old && !o.rebuild) { hand.append(old); return; }
        hand.insertAdjacentHTML('beforeend', cardHTML(c, i));
        if (!old) fresh.push(u);
      });
      layoutHand();
    });
    const freshNodes = fresh.map((u) => cardEl(u)).filter(Boolean);
    dealIn(freshNodes, o.delay || 0);
    updateDeck();
    return freshNodes;
  }
  function deckCountText() {
    const run = R(), b = run && run.blind;
    const total = run ? run.cards.length : 0;
    const left = b ? b.draw.length : total;
    return `${left}/${total}`;
  }
  function updateDeck() {
    const t = deckCountText();
    $$('.deck-count-n').forEach((n) => setNum(n, t, 'S', 'cream'));
    // the desktop deck and the phone's deck chip both say what they show: the count left of the deck
    $$('.deck-btn, .deck-chip').forEach((d) => d.setAttribute('aria-label', `Deck, ${t.replace('/', ' of ')} cards left`));
  }
  function deckHTML() {
    const run = R();
    const back = UI.spriteHTML('back:' + (run ? run.deckId : 'firstissue'), { kind: 'back' });
    return `<div class="deck"><button class="deck-btn" type="button" data-action="open-deck" aria-label="Deck"><span class="stack" aria-hidden="true">${back}${back}${back}</span><span class="deck-count n g-cream deck-count-n"></span></button></div>`;
  }

  // ================================================================== selection, preview and the controls
  // Up to 5 cards can always be chosen: a Boss Blind's play limit (The Squeeze's maxPlay) limits plays only, so a
  // 5-card discard stays possible. Over the limit, Play hand is unavailable and says why (canPlay's sentence).
  const MAX_SELECT = 5;
  const maxSelect = () => MAX_SELECT;
  function sweep(node, ms = 640, delay = 0) {
    const band = node && $('.sheen i', node);
    if (!band || !UI.motionOK()) return null;
    return anim(band, [
      { transform: 'translateX(-130%) skewX(-14deg)', opacity: 0 },
      { opacity: 1, offset: 0.18 },
      { opacity: 1, offset: 0.7 },
      { transform: 'translateX(230%) skewX(-14deg)', opacity: 0 },
    ], { d: ms, delay, e: EASE.out });
  }
  function toggle(uid) {
    if (UI.isBusy() || phase() !== 'play') return;
    const b = B();
    if (!b || !b.hand.includes(uid)) return;
    const n = cardEl(uid);
    // the tine climbs with each card chosen and steps down as they are put back
    if (T.selected.has(uid)) { T.selected.delete(uid); UI.sfx('deselect', { index: T.selected.size }); }
    else if (T.selected.size < maxSelect()) { T.selected.add(uid); UI.sfx('select', { index: T.selected.size }); }
    else {
      anim(n, [{ transform: 'translateX(0)' }, { transform: `translateX(${-PX()}px)` }, { transform: `translateX(${PX()}px)` }, { transform: 'translateX(0)' }], { d: 180, add: true });
      UI.sfx('error');
      UI.announce(`Select up to ${maxSelect()} cards.`);
      return;
    }
    const on = T.selected.has(uid);
    if (n) {
      n.setAttribute('aria-pressed', String(on));
      const c = getCard(uid);
      const st = cardState(c);
      n.setAttribute('aria-label', cardLabel(c, st.smudged, st));
      if (on) sweep(n, 560, 60);
    }
    updateSelection();
    saySelection(uid, on);
  }
  function select(uids) {
    T.selected = new Set((uids || []).slice(0, maxSelect()));
    handNodes().forEach((n) => { const on = T.selected.has(n.dataset.uid); n.setAttribute('aria-pressed', String(on)); const c = getCard(n.dataset.uid), st = cardState(c); n.setAttribute('aria-label', cardLabel(c, st.smudged, st)); });
    updateSelection();
  }
  /** A card's short name for speech: rank and suit, or "A hidden card" while the Boss Blind hides its rank. */
  const cardWord = (c) => (!c ? 'A card' : cardState(c).smudged ? 'A hidden card' : `${UI.rankWord(c.rank)} of ${UI.suitName(c.suit)}`);
  // ---- what choosing cards says (WCAG 4.1.3): once the keys or taps settle, one short line in #live with the hand the
  // choice makes now. A card that has focus says its own new state (aria-pressed), so only a card changed from
  // elsewhere (a number key) is named. A play, a discard or a used card hushes a line still waiting.
  const SAY = { timer: 0, on: [], off: [] };
  function hushSelection() { clearTimeout(SAY.timer); SAY.timer = 0; SAY.on = []; SAY.off = []; }
  function saySelection(uid, on) {
    const n = cardEl(uid);
    if (!(n && document.activeElement === n)) {
      const list = on ? SAY.on : SAY.off, other = on ? SAY.off : SAY.on;
      const k = other.indexOf(uid);
      if (k >= 0) other.splice(k, 1); else list.push(uid);
    }
    clearTimeout(SAY.timer);
    SAY.timer = setTimeout(() => {
      const ons = SAY.on.slice(), offs = SAY.off.slice();
      hushSelection();
      if (phase() !== 'play' || UI.isBusy()) return;
      const words = (us) => UI.listJoin(us.map((u) => getCard(u)).filter(Boolean).map(cardWord));
      const sel = selectedInOrder();
      const pv = sel.length ? q('preview', sel) : null;
      const parts = [];
      if (ons.length) parts.push(`${words(ons)} selected.`);
      if (offs.length) parts.push(`${words(offs)} put back.`);
      parts.push(pv ? `${pv.name}, level ${pv.level}: ${fmt(pv.chips)} Chips times ${fmtMult(pv.mult)} Mult.` : 'No cards selected.');
      UI.announce(parts.join(' '));
    }, 260);
  }
  // ---- moving a card along the hand without a drag (WCAG 2.1.1, 2.5.7): Shift with an arrow key on a focused card, or
  // the Move pair over the hand while exactly one card is chosen. The order matters (a Joker that scores the first
  // card, a rule that reads the leftmost one); the engine keeps it as the hand's manual order, as a drag does.
  function moveCard(uid, dir, o = {}) {
    const run = R(), b = B();
    if (!run || !b || run.phase !== 'play' || UI.isBusy() || !dir) return false;
    const order = b.hand.slice();
    const i = order.indexOf(uid), k = i + dir;
    if (i < 0 || k < 0 || k >= order.length) return false;
    [order[i], order[k]] = [order[k], order[i]];
    const nodes = handNodes();
    const res = UI.call('reorderHand', order);
    if (!res || !res.ok) return false;
    UI.sfx('flip');
    // a tip on a card would stand where the card was
    UI.hideTip();
    const hand = handEl();
    flip(nodes, () => { B().hand.forEach((u) => { const n = nodes.find((x) => x.dataset.uid === u); if (n) hand.appendChild(n); }); layoutHand(); }, { d: 360 });
    UI.announce(`${cardWord(getCard(uid))} moved ${dir < 0 ? 'left' : 'right'}, ${k + 1} of ${order.length}.`);
    updateControls();
    // a card moved from the keyboard keeps focus (the move took it out of the page for a moment); the Move pair keeps
    // it on the arrow pressed, or on the other one once the card reaches the end
    if (o.focus) UI.focusQuiet(cardEl(uid));
    if (o.from && o.from.isConnected) {
      const other = $$('#mover .mv-btn').find((x) => x !== o.from);
      UI.focusQuiet(o.from.disabled && other && !other.disabled ? other : o.from);
    }
    return true;
  }
  /** The Move pair over the hand: shown while exactly one card is chosen (and nothing runs), named for that card. */
  function updateMover() {
    const mv = $('#mover');
    if (!mv) return;
    const b = B(), sel = selectedInOrder();
    const uid = b && phase() === 'play' && sel.length === 1 ? sel[0] : null;
    if (!uid) {
      if (mv.hidden) return;
      const was = mv.dataset.uid, had = mv.contains(document.activeElement);
      mv.hidden = true;
      delete mv.dataset.uid;
      // focus on an arrow that goes away lands on the card it was moving (or the hand), never on the page
      if (had) UI.focusQuiet(cardEl(was) || handEl());
      return;
    }
    const i = b.hand.indexOf(uid), name = cardWord(getCard(uid));
    mv.dataset.uid = uid;
    mv.setAttribute('aria-label', `Move ${name}`);
    $$('.mv-btn', mv).forEach((x) => {
      const dir = Number(x.dataset.dir);
      x.setAttribute('aria-label', `Move ${name} ${dir < 0 ? 'left' : 'right'}`);
      x.disabled = dir < 0 ? i <= 0 : i >= b.hand.length - 1;
    });
    mv.hidden = false;
  }
  function updateSelection() {
    if (phase() !== 'play') return;
    const sel = selectedInOrder();
    const pv = sel.length ? q('preview', sel) : null;
    const name = $('#handName');
    if (name) {
      if (pv) name.innerHTML = `${esc(pv.name)}<span class="lv">lv.${pv.level}</span>`;
      else name.textContent = 'Select cards';
    }
    setWell('chips', pv ? pv.chips : 0);
    setWell('mult', pv ? pv.mult : 0);
    updateControls();
  }
  function setBtn(btn, ok, why, off) {
    if (!btn) return;
    btn.disabled = !!off;
    if (!off && !ok && why) { btn.setAttribute('aria-disabled', 'true'); btn.dataset.why = why; }
    else { btn.removeAttribute('aria-disabled'); delete btn.dataset.why; }
  }
  function updateControls() {
    const run = R(), b = B();
    const busy = UI.isBusy();
    const sel = selectedInOrder();
    const play = $('[data-action="play-hand"]'), disc = $('[data-action="discard"]');
    updateMover();
    if (!run || !b || phase() !== 'play') { setBtn(play, false, '', true); setBtn(disc, false, '', true); return; }
    const cp = sel.length ? E().canPlay(run, sel) : E().canPlay(run);
    const cd = sel.length ? E().canDiscard(run, sel) : E().canDiscard(run);
    setBtn(play, cp.ok, cp.error, busy || !sel.length || (!cp.ok && b.handsLeft <= 0));
    setBtn(disc, cd.ok, cd.error, busy || !sel.length || (!cd.ok && b.discardsLeft <= 0));
    // a selection the Boss Blind won't let you play (too many cards under The Squeeze) says why on hover too
    if (play) { if (sel.length && !cp.ok && cp.error) play.dataset.tip = cp.error; else delete play.dataset.tip; }
    const boss = bossRow();
    if (disc && boss && boss.discardCost) disc.dataset.tip = `${boss.name}: each discard costs $${boss.discardCost}.`;
    $$('.seg [data-action^="sort-"]').forEach((x) => { x.setAttribute('aria-pressed', String(x.dataset.action === 'sort-' + run.sortMode)); x.disabled = busy; });
  }
  // the controls are drawn while a deal still holds input (a discard, the end of a payout and a used card redraw the
  // hand, then set the buttons, in one task): once the cards have landed and input is free, they are set again, so
  // Rank, Suit, Play hand and Discard never stay switched off (final pass, part 3)
  UI.onIdle(() => { if (phase() === 'play') updateControls(); });

  // ================================================================== drag to reorder: the hand and the Joker rack
  const DRAG = { d: null };
  function startDrag(e, node, container, kind) {
    if (e.button !== 0 || UI.isBusy()) return;
    const d = { node, container, kind, id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, dragging: false, grabX: 0 };
    DRAG.d = d;
    const move = (ev) => onDragMove(ev, d), up = (ev) => onDragEnd(ev, d, false), cancel = (ev) => onDragEnd(ev, d, true);
    d.cleanup = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }
  const dragItems = (d) => Array.from(d.container.children).filter((n) => n !== d.node && n.matches(d.kind === 'hand' ? '.card' : '.jk'));
  function onDragMove(e, d) {
    if (e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.dragging) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) { if (Math.hypot(dx, dy) > 14) { d.cleanup(); DRAG.d = null; } return; }
      d.dragging = true;
      UI.dragging = true;
      UI.hideTip();
      try { d.node.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
      d.node.classList.add('is-dragging');
      d.grabX = d.x0 - d.node.getBoundingClientRect().left;
      d.base = d.node.getBoundingClientRect().left - (parseFloat(getComputedStyle(d.node).getPropertyValue('--drag-x')) || 0);
    }
    const sibs = dragItems(d);
    const want = e.clientX - d.grabX + d.node.offsetWidth / 2;
    let index = 0;
    for (const s of sibs) { const r = s.getBoundingClientRect(); if (r.left + r.width / 2 < want) index++; }
    const cur = Array.from(d.container.children).filter((n) => n.matches(d.kind === 'hand' ? '.card' : '.jk')).indexOf(d.node);
    if (index !== cur) {
      const first = new Map(sibs.map((n) => [n, n.getBoundingClientRect()]));
      const before = sibs[index] || null;
      if (before) d.container.insertBefore(d.node, before); else { const last = sibs[sibs.length - 1]; if (last) last.after(d.node); }
      if (d.kind === 'hand') layoutHand();
      sibs.forEach((n) => { const a = first.get(n), b = n.getBoundingClientRect(); if (Math.abs(a.left - b.left) > 0.5) anim(n, [{ transform: `translate(${a.left - b.left}px, 0)` }, { transform: 'translate(0, 0)' }], { d: 200, e: EASE.out, add: true }); });
      UI.sfx('flip');
    }
    const r = d.node.getBoundingClientRect();
    const cx = parseFloat(d.node.dataset.dx || '0');
    const tx = cx + (e.clientX - d.grabX - r.left);
    d.node.dataset.dx = String(tx);
    d.node.style.translate = `${tx.toFixed(1)}px ${(dy * 0.2).toFixed(1)}px`;
  }
  function onDragEnd(e, d, cancelled) {
    if (e.pointerId !== d.id) return;
    d.cleanup();
    DRAG.d = null;
    if (!d.dragging) return;
    UI.dragging = false;
    UI.drag.suppressUntil = Date.now() + 350;
    d.node.classList.remove('is-dragging');
    const tr = d.node.style.translate;
    d.node.style.translate = '';
    delete d.node.dataset.dx;
    if (tr) anim(d.node, [{ translate: tr }, { translate: '0 0' }], { d: 220, e: EASE.out });
    try { d.node.releasePointerCapture(e.pointerId); } catch (err) { /* released */ }
    if (d.kind === 'hand') {
      const order = $$('.card', d.container).map((n) => n.dataset.uid);
      if (cancelled) { renderHand(); return; }
      const res = UI.call('reorderHand', order);
      if (!res.ok) renderHand();
      updateControls();
    } else {
      const order = $$('.jk', d.container).map((n) => n.dataset.jokerUid);
      if (cancelled) { renderRacks({ force: true }); return; }
      const res = UI.call('reorderJokers', order);
      if (!res.ok) renderRacks({ force: true });
      else UI.announce('Jokers reordered.');
    }
  }

  // ================================================================== effects: embers, trails, rings, pops, tags, light (Lit)
  const BLUE = ['#FFFFFF', '#A9B8FF', '#6E86FF'], RED = ['#FFFFFF', '#FFB9A6', '#FF5A3D'], HOT = ['#FFF6F0', '#FF9A7C', '#FF3A2A', '#FFD3C4'], CASH = ['#FFF3E0', '#FFE7C8', '#F7CFA2'];
  function burst(x, y, cols, n, spread = 1, size = [1, 2], life = 1) {
    if (!UI.motionOK() || !fxl()) return;
    const p = PX();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + T.seed() * 0.6, sp = (14 + T.seed() * 22) * spread;
      const dx = Math.round(Math.cos(a) * sp) * p, dy = Math.round(Math.sin(a) * sp * 0.8 - 8 * spread) * p;
      const s = size[0] + Math.floor(T.seed() * (size[1] - size[0] + 1));
      const d = el('div', { class: 'pt' });
      d.style.cssText = `--s:${s * p}px;--g:${(2 + s * 2) * p}px;--c:${cols[i % cols.length]};left:${Math.round(x / p) * p}px;top:${Math.round(y / p) * p}px`;
      fxl().append(d);
      const ms = (560 + T.seed() * 320) * life;
      const a2 = anim(d, [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 1, offset: 0.48, easing: EASE.fall },
        { transform: `translate(${Math.round((dx * 1.15) / p) * p}px, ${Math.round((dy + 18 * p * spread) / p) * p}px) scale(.8)`, opacity: 0.9, offset: 0.82 },
        { transform: `translate(${Math.round((dx * 1.2) / p) * p}px, ${Math.round((dy + 22 * p * spread) / p) * p}px) scale(.5)`, opacity: 0 },
      ], { d: ms, e: EASE.out, fill: 'both' });
      transient(d, a2, ms);
    }
  }
  function trail(from, to, cols, ms = 300) {
    if (!UI.motionOK() || !from || !to || !fxl()) return;
    const a = centre(from), b = centre(to), p = PX();
    const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 50;
    const pt = (t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y });
    for (let k = 0; k < 6; k++) {
      const d = el('div', { class: 'pt' });
      const s = k === 0 ? 3 : 2;
      d.style.cssText = `--s:${s * p}px;--g:${(k === 0 ? 4 : 3) * p}px;--c:${cols[k % cols.length]};left:0;top:0;opacity:0`;
      fxl().append(d);
      const kf = [0, 0.25, 0.5, 0.75, 1].map((t) => { const qp = pt(t); return { transform: `translate(${Math.round(qp.x / p) * p}px, ${Math.round(qp.y / p) * p}px)`, offset: t }; });
      kf[0].opacity = 1; kf[kf.length - 1].opacity = 0.3;
      const an = anim(d, kf, { d: ms, delay: k * 26, e: EASE.inOut, fill: 'both' });
      transient(d, an, ms + 160);
    }
  }
  const RING_KF = [{ transform: 'scale(.25)', opacity: 0, easing: EASE.out }, { transform: 'scale(.62)', opacity: 1, offset: 0.14, easing: EASE.out }, { transform: 'scale(1)', opacity: 0.7, offset: 0.55, easing: 'ease-in' }, { transform: 'scale(1.18)', opacity: 0 }];
  function ring(x, y, r, ms = 720, delay = 0, rgb = '255, 214, 170') {
    if (!UI.motionOK() || !fxl()) return;
    const d = el('img', { class: 'ring', alt: '', 'aria-hidden': 'true' });
    d.src = UI.paint.ringURL(rgb);
    d.style.cssText = `--r:${Math.round(r)}px;left:${Math.round(x)}px;top:${Math.round(y)}px;opacity:0`;
    fxl().append(d);
    const a = anim(d, RING_KF, { d: ms, delay, e: 'linear', fill: 'both' });
    transient(d, a, ms + delay);
  }
  /** Screen shake in whole art pixels, proportional to the hit; none under reduced motion or with shake off. */
  function shake(artPx, ms = 260) {
    if (!UI.shakeOK() || !T.root) return null;
    const p = PX(), k = [];
    for (let i = 0; i < 7; i++) {
      const f = 1 - i / 7, a = Math.max(1, Math.round(artPx * f));
      k.push({ transform: `translate(${(i % 2 ? 1 : -1) * a * p}px, ${((i % 3) - 1) * Math.round(a * 0.6) * p}px)` });
    }
    k.push({ transform: 'translate(0, 0)' });
    return anim(T.root, k, { d: ms, e: 'linear' });
  }
  const JIGGLE = [
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(3%) scale(1.07, .9)', offset: 0.14 },
    { transform: 'translateY(-12%) scale(.94, 1.08) rotate(-4deg)', offset: 0.4 },
    { transform: 'translateY(1%) scale(1.04, .97) rotate(1.5deg)', offset: 0.7 },
    { transform: 'translateY(0) scale(1)' },
  ];
  const jiggle = (node, ms = 460) => { const l = node && $('.lift', node); return l ? anim(l, JIGGLE, { d: ms, e: EASE.out }) : null; };
  /** A number in the digit face that pops above a source, glowing in its colour, and floats up. */
  function popNum(src, text, style, small) {
    if (!src || !fx()) return;
    const c = centre(src);
    const glow = { blue: 'g-chips', red: 'g-mult', hot: 'g-mult', money: 'g-money', vio: 'g-vio' }[style] || 'g-cream';
    const s = el('div', { class: 'pop ' + glow, html: num(text, small ? 'S' : 'L', style) });
    fx().append(s);
    const w = s.offsetWidth, h = s.offsetHeight, p = PX();
    s.style.left = Math.round((c.x - w / 2) / p) * p + 'px';
    s.style.top = Math.round((c.r.top - h - (small ? 3 : 5) * p) / p) * p + 'px';
    const a = anim(s, [
      { transform: `translateY(${3 * p}px) scale(.7)`, opacity: 0, easing: EASE.bouncy },
      { transform: `translateY(${-3 * p}px) scale(1)`, opacity: 1, offset: 0.4, easing: 'linear' },
      { transform: `translateY(${-4 * p}px) scale(1)`, opacity: 1, offset: 0.66, easing: EASE.out },
      { transform: `translateY(${-10 * p}px) scale(1)`, opacity: 0 },
    ], { d: small ? 620 : 820, e: 'linear', fill: 'both' });
    transient(s, a, 820);
  }
  /** A word in a lit pill that pops over a source ("Encore!", "Booed", a Boss Blind's note). */
  function notePop(src, text, cls = 't-ember', o = {}) {
    if (!src || !fx()) return;
    const c = centre(src), p = PX();
    const n = el('div', { class: 'note-pop' }, el('span', { class: `tag ${cls}`, text }));
    fx().append(n);
    const w = n.offsetWidth, h = n.offsetHeight;
    n.style.left = Math.round(Math.min(innerWidth - w - 4, Math.max(4, c.x - w / 2)) / p) * p + 'px';
    n.style.top = Math.round(Math.max(4, (o.below ? c.r.bottom + 3 * p : c.r.top - h - 4 * p)) / p) * p + 'px';
    const a = anim(n, [
      { transform: `translateY(${4 * p}px) scale(.86)`, opacity: 0, easing: EASE.bouncy },
      { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.3 },
      { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.78, easing: EASE.out },
      { transform: `translateY(${-3 * p}px) scale(1)`, opacity: 0 },
    ], { d: o.ms || 900, e: 'linear', fill: 'both' });
    transient(n, a, o.ms || 900);
  }
  /** A lit tag that drops from a Joker on a string and settles with a spring. */
  function hangtag(jk, text, cls) {
    if (!jk || !fx()) return null;
    const key = jk.dataset.jokerUid || jk.dataset.consumableUid || '';
    $$(`.hangtag[data-for="${key}"]`).forEach((n) => n.remove());
    const r = jk.getBoundingClientRect(), p = PX();
    const t = el('div', { class: 'hangtag', html: `<span class="str"></span><span class="tag ${cls}">${esc(text)}</span>` });
    t.dataset.for = key;
    fx().append(t);
    t.style.left = Math.round((r.left + r.width / 2 - t.offsetWidth / 2) / p) * p + 'px';
    t.style.top = Math.round((r.bottom + 1 * p) / p) * p + 'px';
    anim(t, [{ transform: `translateY(${-8 * p}px) rotate(-12deg)`, opacity: 0 }, { transform: 'translateY(0) rotate(0deg)', opacity: 1 }], { d: 620, e: EASE.bouncy, fill: 'both' });
    if (!UI.motionOK()) later(1400, () => t.remove());
    return t;
  }
  function dropTags(key, ms = 200) {
    $$(key ? `.hangtag[data-for="${key}"]` : '.hangtag').forEach((b) => { const a = anim(b, [{ opacity: 1 }, { opacity: 0, transform: `translateY(${-2 * PX()}px)` }], { d: ms, fill: 'both' }); transient(b, a, ms); });
  }
  function lightFlash(x, y, k = 1) {
    if (!UI.motionOK()) return; // reduced motion: no flashes
    const f = UI.room && UI.room.flashAt(x, y);
    if (f) anim(f, [{ opacity: 0 }, { opacity: Math.min(1, 0.9 * k) }, { opacity: Math.min(1, 0.55 * k), offset: 0.55 }, { opacity: 0 }], { d: 1300, e: 'linear', always: true });
    const pool = UI.room && UI.room.pool && UI.room.pool();
    if (pool) anim(pool, [{ transform: 'scale(1)' }, { transform: 'scale(1.2)', offset: 0.2 }, { transform: 'scale(1)' }], { d: 1300, e: EASE.out });
  }
  /** Run a job in idle time (or now, in test mode). */
  function soon(fn, timeout = 700) {
    if (UI.TEST || !('requestIdleCallback' in window)) { fn(); return; }
    requestIdleCallback(() => fn(), { timeout: UI.dur(timeout) || 1 });
  }

  // ------------------------------------------------------------ the total's light and debris, made ahead of the moment
  const SHARD_COLS = ['chips', 'mult', 'lime', 'pink'];
  const SHARD_N = 32;
  const BIG_RING_KF = [{ transform: 'scale(.3)', opacity: 0, easing: EASE.out }, { transform: 'scale(.66)', opacity: 1, offset: 0.12, easing: EASE.out }, { transform: 'scale(1)', opacity: 0.92, offset: 0.6, easing: 'ease-in' }, { transform: 'scale(1.16)', opacity: 0 }];
  function prepKit() {
    const host = T.tfx;
    if (!host) return null;
    if (T.kit && T.kit.host === host && T.kit.bloom.isConnected) { placeKit(); return T.kit; }
    const L = UI.paint.lightCanvas;
    const bloom = L(128, [[0, 'rgba(255, 226, 176, .9)'], [0.34, 'rgba(255, 176, 104, .56)'], [0.62, 'rgba(255, 128, 60, .24)'], [0.84, 'rgba(255, 110, 50, .07)'], [1, 'rgba(255, 110, 50, 0)']]);
    bloom.className = 'kit bloom';
    const ringOf = (rc) => {
      const mix = rc.map((v, i) => Math.round(v * 0.62 + [255, 244, 228][i] * 0.38)).join(', '), c = rc.join(', ');
      const cv = L(192, [[0, `rgba(${c}, 0)`], [0.55, `rgba(${c}, 0)`], [0.63, `rgba(${c}, .34)`], [0.71, `rgba(${mix}, 1)`], [0.79, `rgba(${c}, .46)`], [1, `rgba(${c}, 0)`]]);
      cv.className = 'kit ringc';
      return cv;
    };
    const rings = [ringOf([255, 122, 43]), ringOf([255, 76, 155])]; // ember first, then pink
    const rnd = UI.rng('shards');
    const shards = [];
    for (let i = 0; i < SHARD_N; i++) {
      const a = (i / SHARD_N) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
      const c = Math.cos(a), s = Math.sin(a), k = rnd();
      let spr;
      if (k < 0.5) {
        if (Math.abs(c) > 0.88) spr = UI.paint.shard(SHARD_COLS[i % 4], 6 + Math.floor(rnd() * 3), 2);
        else if (Math.abs(s) > 0.88) spr = UI.paint.shard(SHARD_COLS[i % 4], 2, 6 + Math.floor(rnd() * 3));
        else spr = UI.paint.shard(SHARD_COLS[i % 4], 5 + Math.floor(rnd() * 2), 0, c * s > 0 ? 'diag' : 'anti');
      } else if (k < 0.82) spr = UI.paint.shard(SHARD_COLS[i % 4], 4, 4);
      else spr = UI.paint.shard(SHARD_COLS[i % 4], Math.abs(c) > Math.abs(s) ? 5 : 3, Math.abs(c) > Math.abs(s) ? 3 : 5);
      const n = el('div', { class: 'shard kit', html: UI.paint.imgTag(spr) });
      shards.push({ n, a, dist: 10 + rnd() * 28, fall: 5 + rnd() * 9, ms: 1000 + rnd() * 420, delay: rnd() * 60 });
    }
    host.replaceChildren(bloom, ...rings, ...shards.map((x) => x.n));
    T.kit = { host, bloom, rings, shards };
    placeKit();
    return T.kit;
  }
  function placeKit() {
    const kit = T.kit;
    if (!kit || !T.root) return;
    const st = $('#stage') || T.main;
    if (!st) return;
    const s = st.getBoundingClientRect(), t = T.root.getBoundingClientRect(), p = PX();
    const cx = Math.round(s.left - t.left + s.width / 2), cy = Math.round(s.top - t.top + s.height / 2);
    const bw = Math.round(Math.min(s.width * 0.92, 300 * p)), bh = Math.round(bw * 0.78);
    Object.assign(kit.bloom.style, { width: bw + 'px', height: bh + 'px', left: cx + 'px', top: cy + 'px' });
    [236, 158].forEach((r, i) => Object.assign(kit.rings[i].style, { width: r * p + 'px', height: r * p + 'px', left: cx + 'px', top: cy + 'px' }));
    kit.shards.forEach((sh) => Object.assign(sh.n.style, { left: cx + 'px', top: cy + 'px' }));
  }
  /** Put a number on a baked glow (a canvas behind the crisp sprite, flaring by opacity). */
  function glowNum(host, text, size, style, rgb, o) {
    const s = UI.numSprite(text, size, style);
    host.append(UI.paint.glowCanvas(s, PX(), rgb, o));
    host.insertAdjacentHTML('beforeend', UI.paint.imgTag(s, 'num-img'));
    return s;
  }
  const TOTAL_GLOW = { core: '255, 214, 160', r1: 2.5, r2: 12, a1: 0.85, a2: 0.9 };
  /** The plaque, made hidden in advance: hand name, Chips x Mult in their wells, and the total on its glow. */
  function prepPlaque(r) {
    const stage = $('#stage');
    if (!stage) return null;
    const key = `${r.handId}:${r.total}`;
    const old = $('.plaque', stage);
    if (old && old.dataset.key === key) return old;
    if (old) old.remove();
    const p = PX();
    const pl = el('div', { class: 'plaque', role: 'img' });
    pl.innerHTML = `<span class="hn">${esc(r.name)}</span>
      <div class="eq"><div class="well-n chips"><span class="glow-n" data-g="chips"></span></div><span class="times">${num('x', 'S', 'cream')}</span><div class="well-n mult"><span class="glow-n" data-g="mult"></span></div></div>
      <div class="tot glow-n" id="plaqueTotal"></div>`;
    const totalText = fmt(r.total);
    const avail = Math.min(stage.clientWidth, innerWidth) - 24 * p;
    const tSize = UI.fitSize(totalText, avail, ['XXL', 'XL', 'L']);
    const cmSize = UI.fitSize(`${fmt(r.chips)}x${fmtMult(r.mult)}`, avail - 30 * p, ['L', 'S']);
    glowNum($('[data-g="chips"]', pl), fmt(r.chips), cmSize, 'chips', '74, 98, 255', { core: '160, 176, 255', r1: 1.2, r2: 5.5 });
    glowNum($('[data-g="mult"]', pl), fmtMult(r.mult), cmSize, 'mult', '233, 56, 43', { core: '255, 170, 150', r1: 1.2, r2: 5.5 });
    glowNum($('.tot', pl), totalText, tSize, 'total', '255, 128, 52', TOTAL_GLOW);
    pl.dataset.key = key;
    pl.dataset.size = tSize;
    pl.setAttribute('aria-label', `${r.name}: ${fmt(r.chips)} Chips times ${fmtMult(r.mult)} Mult makes ${totalText}`);
    pl.style.opacity = '0';
    stage.append(pl);
    pl.style.left = Math.round((stage.clientWidth - pl.offsetWidth) / 2 / p) * p + 'px';
    // a phone's stage is shorter than the plaque: it hangs from the stage's top, never over the Joker rack
    const room = stage.clientHeight - pl.offsetHeight;
    pl.style.top = (room < 0 ? 0 : Math.round(room / 2 / p) * p) + 'px';
    // the copy of the total that flies into the Blind score waits on its own layer too
    $$('.pop.fly').forEach((n) => n.remove());
    const fly = el('div', { class: 'pop fly glow-n' });
    glowNum(fly, totalText, tSize, 'total', '255, 128, 52', TOTAL_GLOW);
    fly.style.opacity = '0';
    if (fx()) fx().append(fly);
    return pl;
  }
  function flingShards(pl, big) {
    const kit = T.kit;
    if (!UI.motionOK() || !kit) return;
    const p = PX(), hw = pl.offsetWidth / 2, hh = pl.offsetHeight / 2;
    kit.shards.forEach((sh) => {
      const c = Math.cos(sh.a), s = Math.sin(sh.a);
      const t = Math.min(hw / Math.max(1e-3, Math.abs(c)), hh / Math.max(1e-3, Math.abs(s)));
      const g = (v) => Math.round(v / p) * p;
      const x0 = g(c * t), y0 = g(s * t);
      const d = sh.dist * big * p;
      const x1 = g(x0 + c * d), y1 = g(y0 + s * d * 0.8 - 4 * p), y2 = g(y1 + sh.fall * p);
      anim(sh.n, [
        { transform: `translate(${x0}px, ${y0}px)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0}px)`, opacity: 1, offset: 0.03, easing: EASE.bouncy },
        { transform: `translate(${x1}px, ${y1}px)`, opacity: 1, offset: 0.62, easing: 'cubic-bezier(.45, 0, .8, .6)' },
        { transform: `translate(${g(x1 + c * 2 * p)}px, ${y2}px)`, opacity: 0 },
      ], { d: sh.ms, delay: sh.delay, e: 'linear', fill: 'both' });
    });
  }
  /** Draw the sprites the first payout needs while the page is idle, so no frame waits on a canvas. */
  function warmSprites() {
    if (T.warmed || UI.TEST || !('requestIdleCallback' in window)) return;
    T.warmed = true;
    const jobs = [];
    ['128, 148, 255', '255, 112, 92', '196, 242, 110', '255, 90, 61'].forEach((c) => jobs.push(() => UI.paint.ringURL(c)));
    for (let v = 0; v <= 99; v++) jobs.push(() => UI.numSprite(String(v), 'XL', 'chips'));
    for (let v = 0; v <= 30; v++) jobs.push(() => UI.numSprite(String(v), 'XL', 'mult'));
    for (let v = 1; v <= 12; v++) jobs.push(() => UI.numSprite('+' + v, 'L', 'blue'), () => UI.numSprite('+' + v, 'L', 'red'));
    ['+15', '+20', '+30', '+35', '+40', '+50'].forEach((t) => jobs.push(() => UI.numSprite(t, 'L', 'blue')));
    // every shard the total's burst can fling (prepKit picks among these sizes), so the first kit costs no painting
    SHARD_COLS.forEach((c) => {
      [6, 7, 8].forEach((w) => jobs.push(() => UI.paint.shard(c, w, 2), () => UI.paint.shard(c, 2, w)));
      [5, 6].forEach((w) => jobs.push(() => UI.paint.shard(c, w, 0, 'diag'), () => UI.paint.shard(c, w, 0, 'anti')));
      jobs.push(() => UI.paint.shard(c, 4, 4), () => UI.paint.shard(c, 5, 3), () => UI.paint.shard(c, 3, 5));
    });
    ['255, 162, 88', '172, 123, 255', '196, 242, 110', '255, 210, 156', '255, 226, 190', '205, 168, 255', '124, 143, 255', '255, 128, 186', '200, 236, 255'].forEach((c) => jobs.push(() => UI.paint.ringURL(c)));
    const step = (dl) => { do { const j = jobs.shift(); if (j) j(); } while (jobs.length && dl.timeRemaining() > 2); if (jobs.length) requestIdleCallback(step); };
    requestIdleCallback(step, { timeout: 2000 });
  }

  // ================================================================== the payout: Lit's timeline, walked over the engine's step trace
  /** A sound placed where its source sits on the table (stereo pan from the node's centre). */
  const sfxAt = (name, node, opts = {}) => { let pan = 0; if (node && node.getBoundingClientRect) { const r = node.getBoundingClientRect(); pan = Math.max(-1, Math.min(1, ((r.left + r.width / 2) / Math.max(1, innerWidth)) * 2 - 1)) * 0.6; } UI.sfx(name, Object.assign({ pan }, opts)); };
  const KIND = {
    chips: { pop: 'blue', sparks: BLUE, ring: '128, 148, 255', box: 'chips', tag: 't-blue', word: 'Chips', sfx: 'chip' },
    mult: { pop: 'red', sparks: RED, ring: '255, 112, 92', box: 'mult', tag: 't-red', word: 'Mult', sfx: 'mult' },
    xmult: { pop: 'hot', sparks: HOT, ring: '255, 90, 61', box: 'mult', tag: 't-red', word: 'Mult', sfx: 'xmult' },
    money: { pop: 'money', sparks: CASH, ring: '255, 226, 190', box: 'money', tag: 't-cash', word: '', sfx: 'money' },
  };
  const boxOf = (kind) => (kind === 'money' ? $('.w-money') : kind === 'chips' ? $('#chipsBox') : $('#multBox'));
  function cancelPayout() { if (T.tl) { T.tl.cancel(); T.tl = null; } }
  function playHand() {
    const run = R(), b = B();
    if (UI.isBusy() || !run || !b || run.phase !== 'play') return;
    const uids = selectedInOrder();
    if (!uids.length) { UI.error('Select 1 to 5 cards to play.'); return; }
    const check = E().canPlay(run, uids);
    if (!check.ok) { UI.error(check.error); return; }
    const before = { money: run.money, score: b.score, hands: b.handsLeft, target: b.target, kind: b.kind, hand: b.hand.slice(), focus: focusIndex(), prev: document.activeElement };
    UI.hideTip();
    const res = UI.call('playHand', uids);
    if (!res || !res.ok) return;
    hushSelection();
    UI.setBusy(true);
    T.selected.clear();
    updateControls();
    T.seed = UI.rng('payout:' + run.seed + ':' + run.stats.handsPlayed);
    const tl = buildPayout(res, uids, before);
    T.tl = tl;
    tl.run().then(() => { if (T.tl === tl) T.tl = null; });
  }
  function buildPayout(res, played, before) {
    const tl = new UI.Timeline();
    const at = (t, fn) => tl.at(t, fn);
    const r = res.result;
    const steps = Array.isArray(r.steps) ? r.steps : [];
    const scoring = new Set((r.scoringUids || []).filter((u) => u !== r.booedUid));
    const run = R(), b = B();
    let money = before.money;
    const nodeOf = (st) => {
      if (!st) return null;
      if (st.source === 'joker' && st.uid) return jokerEl(st.uid);
      if (st.source === 'boss') return st.uid ? cardEl(st.uid) : $('#blindPanel .emblem') || $('#blindPanel');
      if (st.uid) return cardEl(st.uid);
      return $('#handTab');
    };
    /** The name of what a step points at, for steps the table does not know how to draw. */
    const sourceName = (st) => {
      if (st.source === 'joker' && st.uid) { const j = run.jokers.find((x) => x.uid === st.uid); if (j) return C.joker(j.id).name; }
      if (st.source === 'boss') { const bo = bossRow(); return bo ? bo.name : C.blind('boss').name; }
      const c = st.uid ? getCard(st.uid) : null;
      return c ? `${UI.rankWord(c.rank)} of ${UI.suitName(c.suit)}` : '';
    };
    const genericLabel = (st) => String(st.label || [sourceName(st), st.amount ? (st.kind === 'xmult' ? '×' : '+') + fmtMult(st.amount) : ''].filter(Boolean).join(' ') || st.kind || '');
    /** Move the Chips and Mult wells to a step's running values (a step without numbers leaves them be). */
    const follow = (st) => { if (Number.isFinite(st.runningChips)) setWell('chips', st.runningChips); if (Number.isFinite(st.runningMult)) setWell('mult', st.runningMult); };
    const arrive = (st, kind) => () => {
      follow(st);
      const k = kind === 'xmult' ? 'mult' : kind;
      if (k === 'chips' || k === 'mult') { punch(boxOf(k), 380); flare(boxOf(k), kind === 'xmult' ? 2.2 : 1.8); }
    };
    // 1. the played cards fly to the middle of the table and land; the held cards close ranks
    at(0, () => {
      setCount('hands', b ? b.handsLeft : Math.max(0, before.hands - 1), 'ember');
      punch($('.w-hands'), 380);
      UI.sfx('play');
      if (res.fade && res.fade.before !== res.fade.after) {
        countTo(res.fade.before, res.fade.after, 420, setScore);
        const boss = bossRow();
        notePop($('.w-score'), boss ? boss.name : '-15%', 't-vio', { below: true });
      }
      const stage = $('#stage');
      if (!stage) return;
      $$('.stage-row', stage).forEach((n) => n.remove());
      // the row knows its count, so on a stage narrower than the cards (a phone) they overlap like the hand
      const row = el('div', { class: 'stage-row', style: `--n:${Math.max(2, played.length)}` });
      stage.append(row);
      const playedNodes = played.map((u) => cardEl(u)).filter(Boolean);
      const heldNodes = handNodes().filter((n) => !played.includes(n.dataset.uid));
      const firsts = playedNodes.map((n) => n.getBoundingClientRect());
      const heldFirst = new Map(heldNodes.map((n) => [n, n.getBoundingClientRect()]));
      playedNodes.forEach((n) => {
        n.setAttribute('aria-pressed', 'false'); n.disabled = true; n.tabIndex = -1;
        $$('.smudge', n).forEach((s) => s.remove());
        if (!scoring.has(n.dataset.uid)) n.classList.add('is-unscored'); else n.classList.add('is-scoring');
        row.append(n);
      });
      layoutHand();
      playedNodes.forEach((n, i) => {
        const a = firsts[i], bb = n.getBoundingClientRect();
        const dx = a.left - bb.left, dy = a.top - bb.top - 10 * PX();
        anim(n, [
          { transform: `translate(${dx}px, ${dy}px) rotate(${-3 + i * 5}deg)`, easing: 'cubic-bezier(.3, 0, .5, 1)' },
          { transform: `translate(${dx * 0.45}px, ${Math.min(dy * 0.45, dy) - 26 * PX()}px) rotate(${-7 + i * 7}deg) scale(1.08)`, offset: 0.52, easing: 'cubic-bezier(.5, 0, .9, .5)' },
          { transform: 'translate(0, 0) scale(1.05, .92)', offset: 0.84, easing: EASE.out },
          { transform: 'translate(0, 0) scale(1)' },
        ], { d: 480, delay: i * 40, e: 'linear', fill: 'backwards' });
      });
      heldNodes.forEach((n, i) => {
        const a = heldFirst.get(n), bb = n.getBoundingClientRect();
        anim(n, [{ transform: `translate(${a.left - bb.left}px, ${a.top - bb.top}px)` }, { transform: 'translate(0, 0)' }], { d: 560, delay: 60 + i * 16, e: EASE.spring, add: true, fill: 'backwards' });
      });
      prepKit();
      soon(() => prepPlaque(r), 600);
    });
    at(460, () => {
      shake(1, 180);
      $$('.stage-row .card').forEach((n) => { const c = centre(n); burst(c.x, c.r.bottom - 6, ['#FFE2C0', '#FFC687'], 7, 0.35, [1, 1]); });
    });
    at(580, () => {
      const name = $('#handName');
      if (name) name.innerHTML = `${esc(r.name)}<span class="lv">lv.${r.level}</span>`;
      const base = steps[0] && steps[0].source === 'base' ? steps[0] : null;
      setWell('chips', base ? base.runningChips : steps.length ? steps[0].runningChips : r.chips);
      setWell('mult', base ? base.runningMult : steps.length ? steps[0].runningMult : r.mult);
      punch($('#handTab'), 420); punch($('#chipsBox'), 360); punch($('#multBox'), 360);
    });
    // 2-3. every step after the base: scored cards, held cards, Jokers, the Boss Blind
    let t = 780;
    let lastSrc = '';
    const firstTag = new Set();
    steps.forEach((st, i) => {
      if (i === 0 && st.source === 'base') return;
      const k = i > 10 ? Math.max(0.45, Math.pow(0.93, i - 10)) : 1; // long hands speed up
      const srcKey = `${st.source}:${st.uid}`;
      const repeat = srcKey === lastSrc;
      lastSrc = srcKey;
      const kind = KIND[st.kind] ? st.kind : null;
      const label = KIND[st.kind] || st.kind === 'note' ? String(st.label || '') : genericLabel(st);
      if (st.kind === 'note' || !kind) {
        // notes and anything unknown: a word in a pill over the source, and the readouts follow the running values
        at(t, () => {
          const n = nodeOf(st);
          const lc = label.toLowerCase();
          let cls = 't-cream';
          if (st.via === 'retrigger' || lc.startsWith('encore')) cls = 't-ember';
          else if (st.source === 'boss' || lc === 'booed') cls = st.source === 'boss' && st.uid ? 't-pink' : 't-vio';
          else if (st.via === 'seal') cls = 't-pink';
          if (st.via === 'retrigger') {
            const lift = n && $('.lift', n);
            if (lift) anim(lift, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(0, ${-6 * PX()}px) scale(1.08)`, offset: 0.4 }, { transform: 'translate(0,0) scale(1)' }], { d: 320, e: EASE.out });
            if (st.jokerUid) { const jk = jokerEl(st.jokerUid); jiggle(jk, 420); sweep(jk, 560); }
            const seal = n && $('.seal-badge', n);
            if (seal && st.seal) punch(seal, 320, 1.3);
            if (n) { const c = centre(n); ring(c.x, c.y, 40 * PX(), 520, 0, '255, 162, 88'); }
            sfxAt('again', n, { step: i });
          } else if (st.source === 'boss') {
            const em = $('#blindPanel .emblem') || $('#blindPanel');
            punch(em, 420, 1.16);
            if (st.uid && n) {
              n.classList.add('is-booed');
              anim(n, [{ transform: 'translateX(0)' }, { transform: `translateX(${-2 * PX()}px)` }, { transform: `translateX(${2 * PX()}px)` }, { transform: `translateX(${-1 * PX()}px)` }, { transform: 'translateX(0)' }], { d: 300, add: true });
            }
            sfxAt('boss', em, { step: i, intensity: 0.3 });
          } else sfxAt('tag', n, { step: i });
          // a word about a card on the stage hangs under it, so it never covers the number popping above it
          const onStage = !!(n && n.closest && n.closest('.stage-row'));
          if (label) notePop(st.source === 'boss' && !st.uid ? $('#multBox') : n || $('#handTab'), label, cls, { below: onStage });
          follow(st);
        });
        t += (st.source === 'boss' ? 420 : 280) * k;
        return;
      }
      const K = KIND[kind];
      if (st.source === 'card') {
        at(t, () => {
          const n = cardEl(st.uid);
          if (!n) return;
          if (!repeat) {
            anim($('.lift', n), [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(0, ${2 * PX()}px) scale(.95, 1.04)`, offset: 0.14 }, { transform: `translate(0, ${-10 * PX()}px) scale(1.12) rotate(-3deg)`, offset: 0.42 }, { transform: 'translate(0,0) scale(1)' }], { d: 380, e: EASE.out });
            sweep(n, 520);
          } else anim($('.lift', n), [{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.3 }, { transform: 'scale(1)' }], { d: 260, e: EASE.out });
          popNum(n, label || '+' + fmtMult(st.amount), K.pop);
          sfxAt(K.sfx, n, { step: i });
          const c = centre(n);
          burst(c.x, c.y - 12 * PX(), K.sparks, kind === 'xmult' ? 18 : 14, kind === 'xmult' ? 1.25 : 1.05, [1, 2]);
          ring(c.x, c.y - 4 * PX(), (kind === 'xmult' ? 56 : 46) * PX(), 560, 0, K.ring);
          if (st.via === 'edition') { sweep(n, 600, 80); }
          if (kind === 'money') moneyStep(st, n); else trail(n, boxOf(K.box), K.sparks, 300);
        });
        if (kind !== 'money') at(t + 300 * k, arrive(st, kind));
        t += (repeat ? 300 : 350) * k;
        return;
      }
      if (st.source === 'held' || (st.source === 'joker' && st.cardUid)) {
        const fromJoker = st.source === 'joker';
        const cardUid = fromJoker ? st.cardUid : st.uid;
        const onHeld = !played.includes(cardUid);
        const first = fromJoker && !firstTag.has(st.uid + ':' + kind);
        if (fromJoker) firstTag.add(st.uid + ':' + kind);
        at(t, () => {
          const n = cardEl(cardUid);
          if (n) {
            if (onHeld) anim(n, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(0, ${-7 * PX()}px) scale(1.06) rotate(2deg)`, offset: 0.42 }, { transform: 'translate(0,0) scale(1)' }], { d: 300, e: EASE.out, add: true });
            else anim($('.lift', n), [{ transform: 'scale(1)' }, { transform: `translate(0, ${-4 * PX()}px) scale(1.07)`, offset: 0.35 }, { transform: 'scale(1)' }], { d: 300, e: EASE.out });
            popNum(n, label || '+' + fmtMult(st.amount), K.pop, onHeld);
          }
          if (fromJoker) {
            const jk = jokerEl(st.uid);
            jiggle(jk, onHeld ? 300 : 420);
            if (first && jk) { hangtag(jk, `${label} ${K.word}`.trim(), K.tag); sweep(jk, 620); }
          }
          if (kind === 'money') moneyStep(st, n); else if (n) trail(n, boxOf(K.box), K.sparks, onHeld ? 240 : 300);
          sfxAt(K.sfx, n || jokerEl(st.uid), { step: i });
        });
        if (kind !== 'money') at(t + (onHeld ? 240 : 300) * k, arrive(st, kind));
        t += (onHeld ? 150 : 320) * k;
        return;
      }
      if (st.source === 'joker') {
        at(t, () => {
          dropTags(st.uid);
          const jk = jokerEl(st.uid);
          if (!jk) return;
          jiggle(jk, 460);
          sweep(jk, 600);
          if (st.via === 'edition') sweep(jk, 700, 120);
          hangtag(jk, `${label} ${K.word}`.trim(), K.tag);
          const c = centre(jk);
          burst(c.x, c.y, K.sparks, kind === 'xmult' ? 16 : 12, 0.9, [1, 2]);
          ring(c.x, c.y, (kind === 'xmult' ? 72 : 60) * PX(), 620, 0, K.ring);
          if (kind === 'money') moneyStep(st, jk); else trail(jk, boxOf(K.box), K.sparks, 320);
          sfxAt(K.sfx, jk, { step: i });
        });
        if (kind !== 'money') at(t + 320 * k, arrive(st, kind));
        t += 440 * k;
        return;
      }
      // the Boss Blind (Half Mult, Warm-up) and any other source: the emblem pulses, a note pops by the readout
      at(t, () => {
        const em = st.source === 'boss' ? $('#blindPanel .emblem') || $('#blindPanel') : nodeOf(st);
        punch(em, 420, 1.16);
        notePop(boxOf(K.box) || $('#handTab'), label || genericLabel(st), st.source === 'boss' ? 't-vio' : K.tag);
        sfxAt(st.source === 'boss' ? 'boss' : K.sfx, em, { step: i, intensity: 0.3 });
        if (kind === 'money') moneyStep(st, em);
      });
      if (kind !== 'money') at(t + 300 * k, arrive(st, kind));
      t += 420 * k;
    });
    function moneyStep(st, node) {
      money += Number(st.amount) || 0;
      const m = $('#money');
      if (node) popNum(node, st.label || '+$' + st.amount, 'money', true);
      setMoney(money);
      punch($('.w-money'), 380);
      if (m) flare(m, 1.6, 420);
    }
    t += 180;
    const tTotal = t, tPlaque = t + 280, tFly = tPlaque + 1120, tTick = tFly + 380, tEnd = tTick + 840;
    // 4. the total: Chips and Mult lock in, then the plaque drops onto the table in a burst of light
    at(tTotal, () => {
      dropTags(null, 240);
      setWell('chips', r.chips); setWell('mult', r.mult);
      punch($('#chipsBox'), 420); punch($('#multBox'), 420); flare($('#chipsBox'), 2); flare($('#multBox'), 2);
      const row = $('.stage-row');
      if (row) anim(row, [{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: `translateY(${-4 * PX()}px) scale(1.05)`, opacity: 1, offset: 0.35 }, { transform: 'translateY(0) scale(.7)', opacity: 0 }], { d: 320, e: EASE.inOut, fill: 'forwards' });
      if (row && !UI.motionOK()) row.style.opacity = '0';
      setMoney(R().money);
    });
    at(tPlaque, () => {
      const p = PX();
      const pl = prepPlaque(r);
      if (!pl) return;
      const kit = prepKit();
      pl.style.opacity = '';
      const big = Math.min(2.2, 1 + r.total / Math.max(1, before.target) / 2);
      if (kit) {
        anim(kit.bloom, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.28 }, { transform: 'scale(1)', opacity: 0.8 }], { d: 900, e: EASE.out, fill: 'both' });
        anim(kit.rings[0], BIG_RING_KF, { d: 1150, e: 'linear', fill: 'both' });
        anim(kit.rings[1], BIG_RING_KF, { d: 1000, delay: 130, e: 'linear', fill: 'both' });
      }
      anim(pl, [
        { transform: `translateY(${-22 * p}px) scale(.86)`, opacity: 0 },
        { transform: `translateY(${-22 * p}px) scale(.86)`, opacity: 1, offset: 0.04 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ], { d: 620, e: EASE.bouncy, fill: 'both' });
      anim(pl, [{ transform: 'scale(1)', easing: EASE.out }, { transform: 'scale(1.06)', offset: 0.18, easing: EASE.bouncy }, { transform: 'scale(1)' }], { d: 660, delay: 260, e: 'linear', add: true });
      const tot = $('.tot', pl);
      anim($('.num-img', tot), [{ transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { d: 640, delay: 120, e: EASE.bouncy, fill: 'backwards' });
      $$('.glow-bake', pl).forEach((g, i) => anim(g, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1.12)', offset: 0.3 }, { opacity: 0.9, transform: 'scale(1)' }], { d: 820, delay: i === 2 ? 120 : 60, e: EASE.out, fill: 'both' }));
      flingShards(pl, Math.min(1.5, big));
      shake(Math.round(1 + 1.5 * big), 400);
      const c = centre(pl);
      lightFlash(c.x, c.y, big / 1.6);
      UI.sfx('total', { intensity: Math.min(1, (big - 1) / 1.2 + 0.25) });
      UI.announce(`${r.name}: ${fmt(r.chips)} Chips times ${fmtMult(r.mult)} Mult, ${fmt(r.total)}. Score ${fmt(res.score)} of ${fmt(before.target)}.`);
    });
    at(tPlaque + 520, () => { UI.checkHold('peak', tl); });
    // 5. the total flies into the Blind score, which counts up
    at(tFly, () => {
      const pl = $('.plaque'), numEl = $('#plaqueTotal .num-img'), cl = $('.pop.fly'), target = $('#score');
      if (numEl && cl && target && UI.motionOK()) {
        const rr = numEl.getBoundingClientRect(), tg = target.getBoundingClientRect();
        Object.assign(cl.style, { left: Math.round(rr.left) + 'px', top: Math.round(rr.top) + 'px', opacity: '' });
        const tx = tg.left + tg.width / 2 - (rr.left + rr.width / 2), ty = tg.top + tg.height / 2 - (rr.top + rr.height / 2);
        const sz = pl && pl.dataset.size;
        const scale = sz === 'XXL' ? 0.5 : sz === 'XL' ? 1 : 1;
        const a = anim(cl, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${tx * 0.35}px, ${ty * 0.35 - 70}px) scale(${(1 + scale) / 2})`, opacity: 1, offset: 0.45 }, { transform: `translate(${tx}px, ${ty}px) scale(${scale})`, opacity: 1, offset: 0.92 }, { transform: `translate(${tx}px, ${ty}px) scale(${scale * 0.9})`, opacity: 0 }], { d: 380, e: EASE.inOut, fill: 'both' });
        transient(cl, a, 380);
        numEl.parentElement.style.visibility = 'hidden';
      } else if (cl) cl.remove();
      if (pl) { const a = anim(pl, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.94)', opacity: 0 }], { d: 260, delay: 80, fill: 'both' }); transient(pl, a, 340); }
      if (T.kit) anim(T.kit.bloom, [{ opacity: 0.8 }, { opacity: 0 }], { d: 420, fill: 'both', always: true });
    });
    at(tTick, () => {
      const from = res.fade ? res.fade.after : before.score;
      countTo(from, res.score, 640, setScore);
      punch($('.w-score'), 460); flare($('#score'), 1.8, 760);
      const sc = $('.w-score');
      if (sc) { const c = centre(sc); burst(c.x, c.y, ['#F4FFD6', '#C3F26E', '#FFF3E0'], 14, 0.9, [1, 2]); ring(c.x, c.y, sc.offsetWidth * 1.2, 700, 0, '196, 242, 110'); }
    });
    // the label turns once the count has passed the target, not before
    at(tTick + 660, () => {
      setScore(res.score);
      if (!res.cleared) return;
      const tb = $('#scoreTab');
      if (tb) { tb.textContent = 'Blind beaten'; punch(tb, 420); flare(tb, 1.5, 520); }
      UI.sfx('beaten', { intensity: Math.min(1, res.score / Math.max(1, before.target) / 3) });
    });
    at(tEnd, () => endOfHand(res, played, before));
    return tl;
  }
  function endOfHand(res, played, before = {}) {
    const stage = $('#stage');
    if (res.eaten && res.eaten.length) {
      res.eaten.forEach((u) => {
        const jk = jokerEl(u);
        if (!jk) return;
        const a = anim(jk, [{ transform: 'scale(1)', opacity: 1 }, { transform: `translateY(${-6 * PX()}px) scale(1.08)`, opacity: 1, offset: 0.3 }, { transform: 'scale(.6)', opacity: 0 }], { d: 520, e: EASE.inOut, fill: 'forwards' });
        if (!a) jk.style.opacity = '0';
        // the Joker's own text says how it goes (one melts, one is eaten): the toast follows TW.Content's words
        const jr = C.joker(jk.dataset.joker), said = String(jr.text || '');
        const gone = /\bmelts?\b/i.test(said) ? 'melted' : /\beaten\b/i.test(said) ? 'was eaten' : 'is gone';
        UI.toast(`${jr.name} ${gone}.`, 'info');
      });
    }
    if (res.enhanced && res.enhanced.length) {
      const c = getCard(res.enhanced[0]);
      const enh = c && c.enhancement ? C.enhancement(c.enhancement).name : '';
      res.enhanced.forEach((u) => { const n = cardEl(u); if (n) sweep(n, 600); });
      if (enh) UI.toast(`${res.enhanced.length} ${UI.plural(res.enhanced.length, 'card')} turned ${enh}.`, 'info');
    }
    if (res.cleared || res.won) {
      UI.clearBusy();
      later(res.eaten && res.eaten.length ? 420 : 0, () => {
        UI.refresh();
        // the Jokers that react to the Blind being beaten bump over the cash-out
        jokerEvents(res.jokerEvents, 520);
      });
      return;
    }
    if (res.lost || phase() === 'gameover') {
      const tb = $('#scoreTab');
      if (tb) { tb.textContent = 'Out of hands'; tb.className = 'tag t-pink'; punch(tb, 420); }
      shake(2, 320);
      UI.sfx('lose');
      UI.announce('Out of hands. The Blind was not beaten.');
      later(1100, () => { UI.clearBusy(); UI.refresh(); });
      return;
    }
    // the hand goes on: the played cards slide off to the discard side, the hand draws back up
    const row = stage && $('.stage-row', stage);
    if (row) { const a = anim(row, [{ opacity: 0.35 }, { transform: `translate(${40 * PX()}px, 0) rotate(10deg)`, opacity: 0 }], { d: 340, e: EASE.inOut, fill: 'both' }); transient(row, a, 340); }
    later(360, () => {
      $$('.stage-row, .plaque', stage || document).forEach((n) => n.remove());
      UI.clearBusy();
      renderCol();
      renderRacks();
      redrawHand();
      updateSelection();
      placeLight();
      refocusHand(before.focus, before.prev);
      jokerEvents(res.jokerEvents, 120);
    });
  }

  // ================================================================== discard and sort
  function discard() {
    const run = R(), b = B();
    if (UI.isBusy() || !run || !b || run.phase !== 'play') return;
    const sel = selectedInOrder();
    if (!sel.length) { UI.error('Select 1 to 5 cards to discard.'); return; }
    const chk = E().canDiscard(run, sel);
    if (!chk.ok) { UI.error(chk.error); return; }
    const fi = focusIndex(), prev = document.activeElement;
    const res = UI.call('discard', sel);
    if (!res || !res.ok) return;
    hushSelection();
    UI.setBusy(true);
    UI.hideTip();
    UI.sfx('discard');
    T.selected.clear();
    const gone = sel.concat(res.extra && !sel.includes(res.extra) ? [res.extra] : []);
    setCount('discards', B() ? B().discardsLeft : 0, 'pink');
    punch($('.w-discards'), 380);
    if (res.cost || res.money) { setMoney(R().money); punch($('.w-money'), 380); }
    if (res.free) UI.toast('That discard was free.', 'good');
    gone.forEach((u, i) => {
      const n = cardEl(u);
      if (!n) return;
      n.setAttribute('aria-pressed', 'false');
      const a = anim(n, [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(${50 + i * 6}vw, ${-12 * PX()}px) rotate(${20 + i * 6}deg)`, opacity: 0 }], { d: 360, delay: i * 40, e: EASE.inOut, add: true, fill: 'both' });
      if (!a) n.style.opacity = '0';
    });
    if (res.created && res.created.length) { renderRacks(); UI.toast(`${res.created.length === 1 ? 'A Planet card' : res.created.length + ' Planet cards'} arrived.`, 'good'); }
    later(420, () => {
      gone.forEach((u) => { const n = cardEl(u); if (n) n.remove(); });
      UI.clearBusy();
      if (res.lost || phase() === 'gameover') { UI.sfx('lose'); UI.announce('Nothing left to play. The Blind was not beaten.'); UI.refresh(); return; }
      redrawHand();
      updateSelection();
      refocusHand(fi, prev);
      const n = B() ? B().discardsLeft : 0;
      UI.announce(`Discarded ${gone.length} ${UI.plural(gone.length, 'card')}. ${n} ${UI.plural(n, 'discard')} left.`);
      jokerEvents(res.jokerEvents, 80);
    });
  }
  function sortBy(mode) {
    const run = R();
    if (UI.isBusy() || !run || run.phase !== 'play' || run.sortMode === mode) return;
    const nodes = handNodes();
    // the sort moves every card node, which takes a focused card out of the page for a moment: it keeps focus (as
    // Shift with an arrow does), so the next Enter acts on that card, never plays the hand (final pass, part 3);
    // a tip on a card would stand where the card was, so it closes
    const had = nodes.includes(document.activeElement) ? document.activeElement : null;
    const res = UI.call('setSort', mode);
    if (!res || !res.ok) return;
    UI.sfx('shuffle');
    UI.hideTip();
    const hand = handEl();
    flip(nodes, () => {
      B().hand.forEach((u) => { const n = nodes.find((x) => x.dataset.uid === u); if (n) hand.appendChild(n); });
      layoutHand();
    }, { d: 620, stagger: 22 });
    if (had && document.activeElement !== had) UI.focusQuiet(had);
    updateControls();
  }

  // ================================================================== info sheets: Jokers and consumables
  function jokerSheet(uid) {
    const run = R();
    const j = run && run.jokers.find((x) => x.uid === uid);
    if (!j) return null;
    const row = C.joker(j.id);
    const idx = run.jokers.indexOf(j);
    const text = q('jokerText', uid) || row.text || '';
    const ed = j.edition ? C.edition(j.edition) : null;
    const sell = q('jokerSellValue', uid) || 0;
    const canSell = q('canSell') || { ok: false };
    const b = B();
    const off = !!(b && b.wetJoker === uid && run.phase === 'play');
    const body = el('div');
    body.innerHTML = `<p class="s-text copy">${UI.richText(text)}</p>${ed ? `<p class="s-line copy"><span class="k-name">${esc(ed.name)}:</span> ${UI.richText(ed.jokerText || ed.text || '')}</p>` : ''}${off ? `<p class="s-why copy">${esc(`Switched off by ${(bossRow() || {}).name || 'the Boss Blind'} for this Blind.`)}</p>` : ''}`;
    const move = el('div', { class: 's-move' });
    // moving a Joker keeps its sheet open beside it, with focus on the arrow just pressed (never on Sell)
    const mv = (dir) => {
      const order = run.jokers.map((x) => x.uid);
      const i = order.indexOf(uid), k = i + dir;
      if (k < 0 || k >= order.length) return;
      [order[i], order[k]] = [order[k], order[i]];
      const res = UI.call('reorderJokers', order);
      if (!res.ok) return;
      renderRacks();
      UI.sfx('flip');
      UI.announce(`${row.name} moved ${dir < 0 ? 'left' : 'right'}.`);
      const now = run.jokers.findIndex((x) => x.uid === uid);
      left.disabled = now <= 0;
      right.disabled = now >= run.jokers.length - 1;
      h.reanchor(jokerEl(uid));
      const keep = dir < 0 ? (left.disabled ? right : left) : (right.disabled ? left : right);
      UI.focusQuiet(keep);
    };
    const left = el('button', { type: 'button', class: 'btn b-ghost', 'aria-label': `Move ${row.name} left`, disabled: idx <= 0 || UI.isBusy() });
    left.innerHTML = `${UI.iconHTML('arrow-left', 'light')}<span>Left</span>`;
    left._onAct = () => mv(-1);
    const right = el('button', { type: 'button', class: 'btn b-ghost', 'aria-label': `Move ${row.name} right`, disabled: idx >= run.jokers.length - 1 || UI.isBusy() });
    right.innerHTML = `<span>Right</span>${UI.iconHTML('arrow-right', 'light')}`;
    right._onAct = () => mv(1);
    if (run.jokers.length > 1) { move.append(left, right); body.append(move); }
    const h = UI.sheet({
      title: row.name,
      kind: `${C.rarity(row.rarity)} Joker${ed ? ', ' + ed.name : ''}`,
      kindCls: 'rar-' + (row.rarity || 'common'),
      body,
      anchor: jokerEl(uid),
      actions: [{ label: `Sell $${sell}`, cls: 'b-pink', action: 'sell-joker', data: { uid }, why: canSell.ok && !UI.isBusy() ? '' : canSell.error || "You can't sell right now.", onClick: (hh) => { hh.close(); sellJoker(uid); } }],
    });
    return h;
  }
  function consSheet(uid) {
    const run = R();
    const k = run && run.consumables.find((x) => x.uid === uid);
    if (!k) return null;
    const info = q('consumableInfo', uid) || {};
    const row = C.consumable(k.kind, k.id);
    const sel = selectedInOrder();
    const can = q('canUseConsumable', uid, sel) || { ok: false, error: "You can't use that right now." };
    const canSell = q('canSell') || { ok: false };
    const sell = q('consumableSellValue', uid) || info.sell || 0;
    const range = info.select || row.select;
    let need = '';
    if (Array.isArray(range) && range[1] > 0) need = range[0] === range[1] ? `Select ${range[0]} ${UI.plural(range[0], 'card')} in your hand first.` : `Select ${range[0]} to ${range[1]} cards in your hand first.`;
    const where = (info.where || row.where) === 'blind' ? ', during a Blind' : '';
    const body = el('div');
    body.innerHTML = `<p class="s-text copy">${UI.richText(info.text || row.text || '')}</p>${need ? `<p class="s-line copy k-dim">${esc(need)}</p>` : ''}${!can.ok && can.error ? `<p class="s-why copy">${esc(can.error)}</p>` : ''}`;
    return UI.sheet({
      title: info.name || row.name,
      kind: (KIND_WORD[k.kind] || 'Card') + where,
      kindCls: 'kind-' + k.kind,
      body,
      anchor: consEl(uid),
      actions: [
        { label: 'Use', cls: 'b-ember', action: 'use-consumable', data: { uid }, why: can.ok && !UI.isBusy() ? '' : can.error || "You can't use that right now.", onClick: (h) => { h.close(); useConsumable(uid); } },
        { label: `Sell $${sell}`, cls: 'b-pink', action: 'sell-consumable', data: { uid }, why: canSell.ok && !UI.isBusy() ? '' : canSell.error || "You can't sell right now.", onClick: (h) => { h.close(); sellConsumable(uid); } },
      ],
    });
  }
  function openJoker(uid) { UI.sfx('button'); return jokerSheet(uid); }
  function openConsumable(uid) { UI.sfx('button'); return consSheet(uid); }
  /** A rack item leaves (sold or used): it lifts and fades; input waits for it (SPEC 6.2), then done() redraws. */
  function leaveRack(node, done) {
    if (!node) { done(); return; }
    const a = anim(node, [{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: `translateY(${-8 * PX()}px) scale(1.04)`, opacity: 1, offset: 0.3 }, { transform: `translateY(${-14 * PX()}px) scale(.9)`, opacity: 0 }], { d: 360, e: EASE.inOut, fill: 'forwards' });
    if (!a) { done(); return; }
    UI.setBusy(true);
    let once = false;
    const end = () => { if (once) return; once = true; UI.setBusy(false); done(); };
    a.finished.then(end, end);
  }
  /** A rack item that held focus has gone (sold or used): focus moves to the item now in its place, else the last one,
      else the rack itself, so it never drops to the page (WCAG 2.4.3). Focus that was elsewhere is left alone. */
  function refocusRack(kind, index) {
    const a = document.activeElement;
    if (a && a !== document.body && a.isConnected) return;
    if (UI.topDialog()) return;
    const rack = $(kind === 'joker' ? '#jokerRack' : '#consRack');
    if (!rack) return;
    const items = $$('.jk', rack);
    const n = items[Math.max(0, Math.min(items.length - 1, index || 0))];
    if (n) { UI.focusQuiet(n); return; }
    const sec = rack.closest('.rack');
    if (sec) { sec.setAttribute('tabindex', '-1'); UI.focusQuiet(sec); }
  }
  function sellJoker(uid) {
    const run = R();
    const j = run && run.jokers.find((x) => x.uid === uid);
    if (!j || UI.isBusy()) return;
    const node = jokerEl(uid);
    const from = run.money, at = run.jokers.indexOf(j);
    const res = UI.call('sellJoker', uid);
    if (!res || !res.ok) return;
    UI.sfx('sell');
    if (node) popNum(node, '+$' + res.money, 'money');
    UI.announce(`Sold ${C.joker(j.id).name} for $${res.money}.`);
    leaveRack(node, () => { renderRacks(); renderCol(); afterRackChange(from); jokerEvents(res.jokerEvents, 60); if (UI.screen() === 'blind-select') UI.update(); refocusRack('joker', at); });
  }
  function sellConsumable(uid) {
    const run = R();
    const k = run && run.consumables.find((x) => x.uid === uid);
    if (!k || UI.isBusy()) return;
    const node = consEl(uid);
    const from = run.money, at = run.consumables.indexOf(k);
    const res = UI.call('sellConsumable', uid);
    if (!res || !res.ok) return;
    UI.sfx('sell');
    if (node) popNum(node, '+$' + res.money, 'money');
    UI.announce(`Sold ${C.consumable(k.kind, k.id).name} for $${res.money}.`);
    leaveRack(node, () => { renderRacks(); afterRackChange(from); refocusRack('cons', at); });
  }
  function afterRackChange(moneyFrom) {
    const run = R();
    if (!run) return;
    if (moneyFrom != null && run.money !== moneyFrom) { countTo(moneyFrom, run.money, 420, setMoney); punch($('.w-money'), 380); }
    if (UI.screen() === 'play') { updateControls(); }
  }
  function useConsumable(uid) {
    const run = R();
    const k = run && run.consumables.find((x) => x.uid === uid);
    if (!k || UI.isBusy()) return;
    const sel = selectedInOrder();
    const can = q('canUseConsumable', uid, sel);
    if (!can || !can.ok) { UI.error((can && can.error) || "You can't use that right now."); return; }
    const info = q('consumableInfo', uid) || { name: C.consumable(k.kind, k.id).name };
    const range = info.select || C.consumable(k.kind, k.id).select;
    const usesSelection = Array.isArray(range) && range[1] > 0;
    const node = consEl(uid);
    const from = run.money, at = run.consumables.indexOf(k);
    const handBefore = B() ? B().hand.slice() : [];
    const res = UI.call('useConsumable', uid, sel);
    if (!res || !res.ok) return;
    hushSelection();
    UI.sfx('use');
    // a card that worked on the selection uses it up; one that didn't (a Planet card, money, a Joker) leaves the
    // chosen cards chosen, so the hand you were building is still there
    if (usesSelection) T.selected.clear();
    const eff = res.effect || {};
    const msg = describeEffect(info, eff);
    UI.toast(msg, 'good');
    leaveRack(node, () => {
      if (res.lost || UI.screenForPhase(phase()) !== UI.screen()) { if (res.lost) UI.sfx('lose'); UI.refresh(); return; }
      renderRacks();
      renderCol();
      afterRackChange(from);
      refocusRack('cons', at);
      if (UI.screen() === 'play') {
        const touched = new Set([].concat(eff.uids || [], eff.created || [], eff.sourceUid ? [eff.sourceUid] : [], eff.sourceUids || []));
        const destroyed = (eff.destroyed || []).filter((u) => handBefore.includes(u));
        destroyed.forEach((u) => { const n = cardEl(u); if (n) { const a = anim(n, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: `translateY(${-10 * PX()}px) scale(.8)` }], { d: 360, e: EASE.inOut, fill: 'forwards' }); if (!a) n.remove(); } });
        later(destroyed.length ? 380 : 0, () => {
          const bNow = B();
          T.selected = new Set([...T.selected].filter((u) => bNow && bNow.hand.includes(u)));
          redrawHand({ rebuild: true });
          touched.forEach((u) => { const n = cardEl(u); if (n) { sweep(n, 640); const c = centre(n); burst(c.x, c.y, ['#FFF3E0', '#CDA8FF', '#FFD29C'], 10, 0.8, [1, 2]); } });
          updateSelection();
          // a Planet card used at the table levels its hand in the hand panel, as it does in the Shop
          if (eff.handId && eff.level && UI.shop && UI.shop.levelBeat && !selectedInOrder().length) UI.shop.levelBeat(eff.handId, Math.max(1, eff.level - (Number(eff.levels) || 1)), eff.level, { hold: 700 });
        });
      } else if (UI.screen() === 'blind-select') {
        UI.update();
        if (eff.handId && eff.level && UI.shop && UI.shop.levelBeat) UI.shop.levelBeat(eff.handId, Math.max(1, eff.level - (Number(eff.levels) || 1)), eff.level, { hold: 700 });
      }
      jokerEvents(res.jokerEvents, 240);
    });
  }
  /** The name of a Joker the run owns, by uid ('' when it is gone or unknown). */
  const ownJokerName = (uid) => { const run = R(); const j = uid && run ? run.jokers.find((x) => x.uid === uid) : null; return j ? C.joker(j.id).name : ''; };
  /** One short sentence for what a used Tarot, Planet or Spectral card did (names from TW.Content). */
  function describeEffect(info, eff) {
    const name = (info && info.name) || 'The card';
    const parts = [];
    const n = (eff.uids || []).length;
    const cards = (k) => `${k} ${UI.plural(k, 'card')}`;
    const row = eff.kind && eff.id ? C.consumable(eff.kind, eff.id) : null;
    const run = R();
    // uids name what they are: 'c' cards, 'h' Jokers, 'k' consumables (SPEC 2.1)
    const kindOf = (u) => (/^h/.test(u) ? 'joker' : /^k/.test(u) ? 'cons' : 'card');
    const consWord = (u) => { const k = run && run.consumables.find((x) => x.uid === u); return k ? ({ tarot: 'Tarot card', planet: 'Planet card', spectral: 'Spectral card' }[k.kind] || 'card') : 'card'; };
    const countOf = (list, word, many) => `${list.length === 1 ? (/^[AEIOU]/i.test(word) ? 'an' : 'a') : list.length} ${list.length === 1 ? word : many || word + 's'}`;
    if (eff.handId && eff.level) parts.push(`${C.hand(eff.handId).name} is now level ${eff.level}.`);
    else if (eff.levelsAll) parts.push('Every hand gains a level.');
    if (eff.enhancement && n) parts.push(`${cards(n)} became ${C.enhancement(eff.enhancement).name}.`);
    if (eff.seal && n) parts.push(`${cards(n)} got the ${C.seal(eff.seal).name}.`);
    if (eff.edition && n && !eff.jokerUid) parts.push(`${cards(n)} became ${editionName(eff.edition)}.`);
    if (eff.suit && n) parts.push(`${cards(n)} became ${UI.suitName(eff.suit)}.`);
    // a rank change (The Ladder, The Slide) says which way the cards went
    const delta = row && Number(row.rankDelta);
    if (delta && n && !eff.enhancement && !eff.seal && !eff.suit) parts.push(`${cards(n)} ranked ${delta > 0 ? 'up' : 'down'}.`);
    const destroyed = eff.destroyed || [];
    const lostCards = destroyed.filter((u) => kindOf(u) === 'card'), lostJokers = destroyed.filter((u) => kindOf(u) === 'joker');
    if (lostCards.length) parts.push(`${cards(lostCards.length)} destroyed.`);
    if (lostJokers.length) parts.push(`${lostJokers.length} ${UI.plural(lostJokers.length, 'Joker')} destroyed.`);
    const created = (eff.created || []).filter((u) => !(eff.jokerUid && u === eff.jokerUid));
    const newCards = created.filter((u) => kindOf(u) === 'card'), newCons = created.filter((u) => kindOf(u) === 'cons');
    const copied = !!(eff.sourceUid || (eff.sourceUids && eff.sourceUids.length));
    if (newCards.length) parts.push(copied ? `${newCards.length} ${UI.plural(newCards.length, 'copy', 'copies')} added to your deck.` : `${cards(newCards.length)} added to your hand.`);
    if (newCons.length) {
      const words = [...new Set(newCons.map(consWord))];
      parts.push(words.length === 1 ? `${countOf(newCons, words[0])} created.` : `${newCons.length} cards created.`);
    }
    // a Joker made by the card wears its Edition in the sentence that brings it (Tall Tale's Legendary Joker); an
    // Edition on a Joker already owned (Happy Accident, Poltergeist, Witching Hour) names that Joker
    if (eff.jokerId) parts.push(`${C.joker(eff.jokerId).name}${eff.edition && eff.jokerUid ? ` (${editionName(eff.edition)})` : ''} joins your Jokers.`);
    else if (eff.edition && eff.jokerUid) parts.push(`${ownJokerName(eff.jokerUid) || 'A Joker'} became ${editionName(eff.edition)}.`);
    if (eff.hit === false) parts.push('Nothing happened this time.');
    if (eff.money) parts.push(`+$${eff.money}.`);
    if (eff.moneyLost) parts.push(`-$${eff.moneyLost}.`);
    const nb = eff.nextBlind ? 'in your next Blind' : 'this Blind';
    if (eff.hands) parts.push(`${eff.hands > 0 ? '+' : ''}${eff.hands} ${UI.plural(Math.abs(eff.hands), 'hand')} ${nb}.`);
    if (eff.discards) parts.push(`${eff.discards > 0 ? '+' : ''}${eff.discards} ${UI.plural(Math.abs(eff.discards), 'discard')} ${nb}.`);
    if (eff.handSize) parts.push(`${eff.handSize > 0 ? '+' : ''}${eff.handSize} hand size ${nb}.`);
    if (eff.discardsForGood) parts.push(`${eff.discardsForGood > 0 ? '+' : ''}${eff.discardsForGood} ${UI.plural(Math.abs(eff.discardsForGood), 'discard')} for good.`);
    if (eff.handSizeForGood) parts.push(`${eff.handSizeForGood > 0 ? '+' : ''}${eff.handSizeForGood} hand size for good.`);
    return parts.length ? `${name}: ${parts.join(' ')}` : `${name} used.`;
  }
  /** One short sentence for what a skipped Blind's Tag gave. */
  function describeGain(tag, g) {
    const parts = [];
    g = g || {};
    if (g.money) parts.push(`+$${g.money}`);
    if (g.jokerId) parts.push(`${C.joker(g.jokerId).name} joins your Jokers`);
    if (g.consumableIds && g.consumableIds.length) parts.push(g.consumableIds.map((id) => (C.row('TAROTS', id) || C.row('PLANETS', id) || C.row('SPECTRALS', id) || { name: id }).name).join(' and ') + (g.consumableIds.length > 1 ? ' join your consumables' : ' joins your consumables'));
    if (g.handId) parts.push(`${C.hand(g.handId).name} gains a level`);
    if (g.edition && !g.jokerId) parts.push(`${ownJokerName(g.jokerUid) || 'a Joker'} became ${editionName(g.edition)}`);
    if (g.seals || (g.uids && g.uids.length)) parts.push(`${(g.uids || []).length || g.seals} ${UI.plural((g.uids || []).length || g.seals, 'card')} got a Seal`);
    if (g.pack) parts.push(`a ${C.pack(g.pack).name} opens`);
    return `${tag ? tag.name : 'Tag'}: ${parts.length ? parts.join(', ') + '.' : (tag && tag.text) || ''}`;
  }

  // ================================================================== tooltips
  UI.registerTip('#hand .card[data-uid], .stage .card[data-uid]', (n) => {
    const c = getCard(n.dataset.uid);
    if (!c) return null;
    const st = cardState(c);
    const boss = bossRow();
    if (st.smudged && n.closest('#hand')) return UI.tipHTML({ name: 'Hidden card', kind: UI.suitName(c.suit), text: `${boss ? boss.name : 'The Boss Blind'} hides this rank until you select the card.` });
    const lines = (q('cardText', c.uid) || []).slice(1);
    const chips = E() && E().cardChips ? E().cardChips(c) : 0;
    const kind = [c.enhancement && C.enhancement(c.enhancement).name, c.edition && editionName(c.edition), c.seal && C.seal(c.seal).name].filter(Boolean).join(', ');
    return UI.tipHTML({
      name: `${UI.rankWord(c.rank)} of ${UI.suitName(c.suit)}`, kind: kind || `+${chips} Chips when scored`, kindCls: kind ? 'kind-enh' : '',
      lines: kind ? lines : [], warn: st.washed && boss ? `${boss.name}: Enhancements do nothing this Blind.` : st.censored && boss ? `${boss.name}: Editions and Seals do nothing this Blind.` : '',
    });
  }, { describe: true });
  UI.registerTip('.jk[data-joker-uid]', (n) => {
    const run = R();
    const j = run && run.jokers.find((x) => x.uid === n.dataset.jokerUid);
    if (!j) return null;
    const row = C.joker(j.id), ed = j.edition ? C.edition(j.edition) : null;
    const b = B();
    const off = !!(b && b.wetJoker === j.uid && run.phase === 'play');
    return UI.tipHTML({
      name: row.name, kind: `${C.rarity(row.rarity)} Joker${ed ? ', ' + ed.name : ''}`, kindCls: 'rar-' + (row.rarity || 'common'),
      text: q('jokerText', j.uid) || row.text, lines: ed ? [`${ed.name}: ${ed.jokerText || ed.text || ''}`] : [],
      warn: off ? `Switched off by ${(bossRow() || {}).name || 'the Boss Blind'} for this Blind.` : '', sell: q('jokerSellValue', j.uid),
    });
  });
  UI.registerTip('.jk[data-consumable-uid]', (n) => {
    const run = R();
    const k = run && run.consumables.find((x) => x.uid === n.dataset.consumableUid);
    if (!k) return null;
    const info = q('consumableInfo', k.uid) || {};
    const row = C.consumable(k.kind, k.id);
    return UI.tipHTML({ name: info.name || row.name, kind: (KIND_WORD[k.kind] || 'Card') + ((info.where || row.where) === 'blind' ? ', during a Blind' : ''), kindCls: 'kind-' + k.kind, text: info.text || row.text, sell: q('consumableSellValue', k.uid) });
  });
  // the Blind plate's rule says what the Boss Blind picked this Blind too (a hand, a Joker), as its copy does
  UI.registerTip('[data-boss-id]', (n) => { const row = C.boss(n.dataset.bossId); return row ? UI.tipHTML({ name: row.name, kind: C.blind('boss').name, kindCls: 'kind-boss', text: n.closest('#blindPanel') ? bossText(R(), row.id) : bossRule(row.id) }) : null; });
  UI.registerTip('[data-tag-id]', (n) => { const row = C.tag(n.dataset.tagId); return row ? UI.tipHTML({ name: row.name, kind: 'Tag for skipping', kindCls: 'kind-tag', text: row.text }) : null; });

  // ================================================================== Blind select
  function blindCardHTML(info, run) {
    const cur = info.status === 'current';
    const boss = info.kind === 'boss' && info.boss ? info.boss : null;
    const name = C.blind(info.kind).name;
    // every Blind is a candle: the one to play burns, the ones still to come wait unlit, the beaten ones are out
    const statusWord = { cleared: 'Cleared', skipped: 'Skipped', upcoming: 'Unlit', current: '' }[info.status] || '';
    const pill = info.kind === 'boss' ? 't-vio' : info.kind === 'big' ? 't-pink' : 't-ember';
    const emblem = boss
      ? `<div class="emblem" data-boss-id="${esc(boss.id)}"><span class="bloom" aria-hidden="true"></span>${UI.spriteHTML('boss:' + boss.id, { kind: 'boss', name: boss.name, alt: boss.name })}</div>`
      : candleHTML(info.kind, info.status !== 'current');
    let extra = '';
    if (boss) extra = `<div class="bc-sep"></div><div class="bc-rule" data-rule="${esc(boss.id)}"><span class="b-name">${esc(boss.name)}</span><p class="copy">${UI.richText(boss.text || '')}</p></div>`;
    else if (info.tag) extra = `<div class="bc-sep"></div><div class="bc-tag"><span class="lbl">Or skip for</span><span class="tag-tok" data-tag-id="${esc(info.tag.id)}" tabindex="0" role="img" aria-label="${esc(`${info.tag.name}: ${info.tag.text || ''}`)}">${UI.spriteHTML('tag:' + info.tag.id, { kind: 'tag', name: info.tag.name, alt: info.tag.name })}</span><span class="t-text"><b>${esc(info.tag.name)}</b><span class="copy">${UI.richText(info.tag.text || '')}</span></span></div>`;
    const canSkip = cur && !boss && info.tag;
    // the raised Blind's button says Play (SPEC 6.1; ARCH.md section 1, the wording ruling), and its name starts with the
    // word it shows
    const acts = cur
      ? `<div class="bc-acts"><button class="btn b-ember big" type="button" data-action="start-blind" aria-label="Play the ${esc(name)}, target ${fmt(info.target)}">Play</button>${canSkip ? `<button class="btn b-cream" type="button" data-action="skip-blind" aria-label="Skip for ${esc(info.tag.name)}">Skip</button>` : ''}</div>`
      : `<div class="bc-status"><span class="tag ${info.status === 'cleared' ? 't-lime' : 't-plum'}">${esc(statusWord)}</span></div>`;
    return `<section class="panel blind-card b-${info.kind} is-${info.status}" role="group" aria-label="${esc(boss ? `${name}: ${boss.name}` : name)}, ${esc(statusWord || 'up next')}">
        <div class="p-head"><h3 class="tag ${pill}">${esc(name)}</h3></div>
        <div class="bc-emblem">${emblem}</div>
        <div class="bc-target"><span class="lbl">Target</span><span class="n g-cream" data-v="${Number(info.target) || 0}">${numHTML(fmt(info.target), 'L', 'cream')}</span></div>
        <div class="bc-reward"><span class="lbl">Reward</span><span class="n g-money">${numHTML('$' + fmt(info.reward), 'S', 'money')}</span></div>
        ${extra}
        ${acts}
      </section>`;
  }
  function mountBlindSelect(main) {
    const run = R();
    if (!run) return;
    const infos = q('blindsForAnte') || [];
    main.innerHTML = `<div class="blinds" role="group" aria-label="Ante ${run.ante} Blinds">${infos.map((i) => blindCardHTML(i, run)).join('')}</div>`;
    const cards = $$('.blind-card', main);
    // a long target (on a phone from Ante 13 of Endless mode) takes the smaller digit face rather than leave its card,
    // and past that (Ante 17) the short exponent; the screen reader still hears every digit
    UI.afterLayout(main, () => cards.forEach((c) => {
      const n = $('.bc-target .n', c);
      if (!n || !c.isConnected) return;
      const fits = () => { const img = $('.num-img', n), cr = c.getBoundingClientRect(), m = 3 * PX(); if (!img) return true; const nr = img.getBoundingClientRect(); return nr.left >= cr.left + m && nr.right <= cr.right - m; };
      if (fits()) return;
      n.innerHTML = numHTML(fmt(n.dataset.v), 'S', 'cream');
      if (fits()) return;
      n.innerHTML = numHTML(shortNum(n.dataset.v), 'S', 'cream');
      const sr = $('.sr', n);
      if (sr) sr.textContent = fmt(n.dataset.v);
    }));
    cards.forEach((c, i) => anim(c, [{ opacity: 0, transform: `translateY(${16 * PX()}px)` }, { opacity: 1, transform: c.classList.contains('is-current') ? `translateY(${(UI.MQ.phone.matches ? -4 : -8) * PX()}px)` : 'translateY(0)' }], { d: 560, delay: 60 + i * 70, e: EASE.spring, fill: 'backwards' }));
    placeLight();
    markClamped(main);
    // the Boss Blind is revealed once per Ante, when it becomes the Blind to beat: its gong, its emblem swells
    const cur = infos.find((x) => x.status === 'current');
    const key = `${run.seed}:${run.ante}`;
    if (cur && cur.kind === 'boss' && cur.boss && T.bossShown !== key) {
      T.bossShown = key;
      later(320, () => {
        const em = $('.blind-card.is-current .emblem', main);
        if (em && em.isConnected) { punch(em, 560, 1.2); const c = centre(em); ring(c.x, c.y, 64 * PX(), 820, 0, '172, 123, 255'); burst(c.x, c.y, ['#EBDDFF', '#CDA8FF', '#AC7BFF'], 14, 0.9, [1, 2]); }
        UI.sfx('boss', { intensity: 0.75 });
      });
      UI.announce(`Boss Blind: ${cur.boss.name}. ${cur.boss.text || ''} Target ${fmt(cur.target)}.`);
    }
    const sel = $('[data-action="start-blind"]', main);
    if (sel && !UI.TEST) setTimeout(() => { if (!UI.topDialog() && (!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected)) UI.focusQuiet(sel); }, UI.dur(500));
  }
  UI.register('blind-select', {
    shell: true,
    mount(main) { T.selected.clear(); mountBlindSelect(main); },
    update() { renderCol(); renderRacks(); mountBlindSelect(T.main); },
    unmount() {},
  });
  UI.registerAction('start-blind', () => {
    const run = R();
    if (!run || run.phase !== 'blind-select' || UI.isBusy()) return;
    const res = UI.call('startBlind');
    if (!res || !res.ok) return;
    UI.sfx('shuffle');
    const b = B();
    const name = b && b.kind === 'boss' && b.boss ? C.boss(b.boss).name : C.blind(b ? b.kind : 'small').name;
    UI.announce(`${name} started. Target ${fmt(b ? b.target : 0)}.`);
    if (res.lost) { UI.sfx('lose'); UI.refresh(); return; }
    UI.show('play', { deal: true });
    // the Jokers that act when a Blind starts (after the deal, so they can see the hand) bump once it has landed
    jokerEvents(res.jokerEvents, 760);
    // while the Blind is played, what the next Shop can offer is drawn in idle time
    if (UI.warmNextShop) UI.warmNextShop(R());
  });
  UI.registerAction('skip-blind', () => {
    const run = R();
    if (!run || run.phase !== 'blind-select' || UI.isBusy()) return;
    const cur = $('.blind-card.is-current');
    const res = UI.call('skipBlind');
    if (!res || !res.ok) return;
    UI.sfx('skip');
    const msg = describeGain(res.tag, res.gained);
    // the toast shows the Tag's gift; the live region says it with the skip, in one line
    UI.toast(msg, 'good', { ms: 3600, say: false });
    UI.announce(`Blind skipped. ${msg}`);
    later(80, () => UI.sfx('tag'));
    const go = () => { if (UI.screenForPhase(phase()) !== 'blind-select') UI.refresh(); else { renderCol(); renderRacks(); mountBlindSelect(T.main); } };
    if (cur && UI.motionOK()) {
      const a = anim(cur, [{ opacity: 1, transform: `translateY(${-8 * PX()}px)` }, { opacity: 0, transform: `translate(${-10 * PX()}px, ${8 * PX()}px)` }], { d: 300, e: EASE.inOut, fill: 'forwards' });
      if (a) a.finished.then(go, go); else go();
    } else go();
  });

  // ================================================================== the play table
  function playLayout(main) {
    main.innerHTML = `
      <div class="stage" id="stage"><button class="deck-chip" type="button" data-action="open-deck" aria-label="Deck">${UI.iconHTML('deck', 'light')}<span class="n g-cream deck-count-n"></span></button></div>
      <div class="handzone"><div class="hand" id="hand" role="group" aria-label="Your hand" tabindex="-1"></div>
        <div class="seg mover" id="mover" role="group" aria-label="Move the chosen card" hidden><span class="lbl mv-lbl" aria-hidden="true">Move</span><button class="btn b-cream mv-btn" type="button" data-action="move-card" data-dir="-1" aria-label="Move left">${UI.iconHTML('arrow-left', 'dark')}</button><button class="btn b-cream mv-btn" type="button" data-action="move-card" data-dir="1" aria-label="Move right">${UI.iconHTML('arrow-right', 'dark')}</button></div>
        ${deckHTML()}</div>
      <div class="controls">
        <button class="btn b-ember big" type="button" data-action="play-hand">Play hand</button>
        <div class="seg" role="group" aria-label="Sort hand"><span class="lbl sort-lbl" aria-hidden="true">Sort</span><button class="btn b-cream" type="button" data-action="sort-rank" aria-pressed="false">Rank</button><button class="btn b-cream" type="button" data-action="sort-suit" aria-pressed="false">Suit</button></div>
        <button class="btn b-pink big" type="button" data-action="discard">Discard</button>
      </div>`;
    renderHand();
    updateDeck();
    updateSelection();
    updateControls();
  }
  function mountPlay(main, props = {}) {
    T.selected.clear();
    hushSelection();
    playLayout(main);
    placeLight();
    // the deal measures where each card landed: once the new table is laid out, before it is painted
    if (props.deal || props.deal === undefined) UI.afterLayout(main, () => dealIn(handNodes(), 120));
    UI.later(UI.dur(200), () => { placeLight(); prepKit(); });
    // a keyboard player who pressed Play at the Blind select lands on the hand that was dealt, never on the page
    // (WCAG 2.4.3): the hand group, where the number keys choose and Enter plays, and Tab walks the cards; after a
    // click focus stays put
    const a = document.activeElement;
    if (UI.lastInput() === 'key' && !UI.topDialog() && (!a || a === document.body || !a.isConnected)) UI.focusQuiet(handEl());
  }
  UI.register('play', {
    shell: true,
    mount(main, props) { mountPlay(main, props); },
    update() {
      if (UI.isBusy()) return;
      renderCol(); renderRacks();
      if (!$('#hand')) playLayout(T.main); else { renderHand(); updateDeck(); updateSelection(); }
    },
    unmount(next) { if (next !== 'cashout') cancelPayout(); $$('#fx > *, #fxl > *').forEach((n) => n.remove()); },
    key(e) {
      if (phase() !== 'play') return false;
      const k = e.key, t = e.target;
      const onCard = t && t.closest ? t.closest('#hand .card') : null;
      // Shift with an arrow moves the focused card one place along the hand (a key of the card's own, so it stays
      // on when the one-key shortcuts are off)
      if (onCard && e.shiftKey && (k === 'ArrowLeft' || k === 'ArrowRight')) { moveCard(onCard.dataset.uid, k === 'ArrowLeft' ? -1 : 1, { focus: true }); return true; }
      // the one-key shortcuts (SPEC 6.4) work only while Options leaves them on (WCAG 2.1.4)
      if (!UI.shortcuts()) return false;
      if (/^[1-9]$/.test(k)) { const u = (B() ? B().hand : [])[Number(k) - 1]; if (u) { toggle(u); return true; } return false; }
      if (UI.isBusy()) return false;
      // Enter plays the hand from the table; on a card, a button or a field it is that control's own key (a card is
      // chosen with it, as with Space, and never plays the hand behind it)
      if (k === 'Enter') { if (t && t.closest && t.closest('button, a, [role="button"], input, select, textarea')) return false; playHand(); return true; }
      if (k === 'd' || k === 'D') { discard(); return true; }
      if (k === 's' || k === 'S') { sortBy(R().sortMode === 'rank' ? 'suit' : 'rank'); return true; }
      return false;
    },
  });
  UI.registerAction('move-card', (b) => { const mv = $('#mover'); if (mv && mv.dataset.uid) moveCard(mv.dataset.uid, Number(b.dataset.dir) || 0, { from: b }); });
  UI.registerAction('play-hand', () => playHand());
  UI.registerAction('discard', () => discard());
  UI.registerAction('sort-rank', () => sortBy('rank'));
  UI.registerAction('sort-suit', () => sortBy('suit'));
  UI.registerAction('sell-joker', (b) => sellJoker(b.dataset.uid));
  UI.registerAction('sell-consumable', (b) => sellConsumable(b.dataset.uid));
  UI.registerAction('use-consumable', (b) => useConsumable(b.dataset.uid));

  // ================================================================== the cash-out (Lit's Blind-beaten dialog with the engine's lines)
  function showCashout() {
    const run = R(), b = B();
    if (!run || !run.cashout) return null;
    const co = run.cashout;
    const total = co.total;
    const boss = b && b.boss ? C.boss(b.boss) : null;
    const kind = b ? b.kind : 'small';
    // the pill is the heading: it names the Blind ("<Blind name> cleared", the plan's cash-out heading), so no
    // second line repeats it; the score sits on one baseline with its target
    const blindName = boss ? boss.name : C.blind(kind).name;
    const head = `<div class="head">${boss ? emblemHTML(boss.id) : candleHTML(kind)}<div class="vs"><span class="n g-score">${numHTML(fmt(b ? b.score : 0), 'L', 'score')}</span><span class="lbl t">target ${esc(fmt(b ? b.target : 0))}</span></div></div>`;
    const jokerByName = new Map(run.jokers.map((j) => [C.joker(j.id).name, j.uid]));
    const lines = co.lines.map((l) => {
      const ju = jokerByName.get(l.label);
      return `<li${ju ? ` data-joker-line="${esc(ju)}"` : ''}><span class="who lbl">${esc(l.label)}</span><span class="n g-money">${numHTML('$' + fmt(l.amount), 'S', 'money')}</span></li>`;
    }).join('');
    const body = `${head}<ul class="cashout" aria-label="Cash-out">${lines}<li class="total"><span>Total</span><span class="n g-money">${numHTML('$' + fmt(total), 'L', 'money')}</span></li></ul>`;
    const h = UI.dialog({
      title: `${blindName} cleared`, tag: 'lime', cls: 'beaten', wrapCls: 'over-stage', dismissible: false, body,
      actions: [{ label: `Collect $${fmt(total)}`, cls: 'b-ember', action: 'collect', onClick: (hh) => collect(hh) }],
      focus: '[data-action="collect"]',
    });
    const win = h.el;
    // a score of ten digits or more (deep in Endless mode) takes the smaller face, then the short exponent, rather than
    // leave the plate; the screen reader still hears every digit
    const vsn = $('.head .vs .n', win);
    if (vsn) {
      const v = b ? b.score : 0, room = vsn.parentElement.clientWidth - PX();
      const text = UI.numWidth(fmt(v), 'S') * PX() > room ? shortNum(v) : fmt(v), size = UI.fitSize(text, room, ['L', 'S']);
      if (size !== 'L' || text !== fmt(v)) { vsn.innerHTML = numHTML(text, size, 'score'); const sr = $('.sr', vsn); if (sr) sr.textContent = fmt(v); }
    }
    const lift = UI.paint.lightCanvas(96, [[0, 'rgba(255, 150, 80, .3)'], [0.55, 'rgba(255, 128, 64, .12)'], [1, 'rgba(255, 110, 50, 0)']]);
    lift.className = 'lift-light';
    h.wrap.prepend(lift);
    /** Lay the plate out for the current window: centred over the play field between the racks and the hand on the
        table layout (never touching the hand), centred on screen in the compact one. Called again on every resize
        and breakpoint change (a phone turned, a window snapped narrow), so it never strands off-screen. */
    const place = () => {
      if (!win.isConnected) return;
      if (!UI.MQ.phone.matches && T.field && T.field.isConnected) {
        h.wrap.classList.add('over-stage');
        const field = T.field.getBoundingClientRect(), racks = T.racks.getBoundingClientRect(), p = PX();
        const handTop = Math.min(...handNodes().map((n) => n.getBoundingClientRect().top), innerHeight);
        const w = win.offsetWidth, ht = win.offsetHeight;
        const payer = co.lines.map((l) => jokerByName.get(l.label)).find(Boolean);
        const payerEl = payer && jokerEl(payer);
        const lo = Math.max(racks.bottom + 3 * p, payerEl ? payerEl.getBoundingClientRect().bottom + 19 * p : 0), hi = handTop - 6 * p;
        const top = Math.max(8, Math.min(hi - ht, Math.max(lo, Math.round((racks.bottom + hi) / 2 - ht / 2))));
        const left = Math.max(8, Math.min(innerWidth - w - 8, Math.round((field.left + field.width / 2 - w / 2) / p) * p));
        win.style.left = left + 'px';
        win.style.top = Math.min(Math.max(8, innerHeight - ht - 8), Math.round(top / p) * p) + 'px';
      } else {
        h.wrap.classList.remove('over-stage');
        win.style.left = ''; win.style.top = '';
      }
      const wr = win.getBoundingClientRect();
      Object.assign(lift.style, { left: Math.round(wr.left + wr.width / 2) + 'px', top: Math.round(wr.top + wr.height / 2) + 'px', width: Math.round(wr.width * 2.3) + 'px', height: Math.round(wr.height * 1.9) + 'px' });
    };
    h.place = place;
    place();
    const sc = $('.w-score .score-n');
    if (sc) sc.classList.add('beaten-out');
    $$('.cashout li', win).forEach((li, i) => {
      const delay = 380 + i * 170;
      anim(li, [{ opacity: 0, transform: `translateX(${-5 * PX()}px)` }, { opacity: 1, transform: 'translateX(0)' }], { d: 520, delay, e: EASE.spring, fill: 'backwards' });
      const n = $('.n', li);
      if (n) flare(n, 1.7, 560, delay + 60);
      const total = li.classList.contains('total');
      // each line ticks two beads, climbing; the total lands a step higher
      UI.sfx('money', { index: total ? co.lines.length + 2 : i, delay: UI.dur(delay) });
      if (li.dataset.jokerLine) {
        const jk = jokerEl(li.dataset.jokerLine);
        const amt = co.lines[i] ? co.lines[i].amount : 0;
        later(delay, () => { if (jk) { jiggle(jk, 460); sweep(jk, 600); if (!UI.MQ.phone.matches) hangtag(jk, '+$' + amt, 't-cash'); } });
      }
    });
    const acts = $('.acts', win);
    if (acts) anim(acts, [{ opacity: 0, transform: `translateY(${3 * PX()}px)` }, { opacity: 1, transform: 'translateY(0)' }], { d: 520, delay: 380 + co.lines.length * 170 + 170, e: EASE.spring, fill: 'backwards' });
    const c = centre(win);
    burst(c.x, c.r.top + 12, ['#FF80BA', '#C3F26E', '#A9B8FF', '#FFA458', '#CDA8FF'], 24, 1.2, [1, 2]);
    UI.announce(`Blind beaten. Collect $${total}.`);
    return h;
  }
  function collect(h) {
    const run = R();
    if (!run || run.phase !== 'cashout') return;
    const from = run.money;
    const res = UI.call('collect');
    if (!res || !res.ok) return;
    UI.sfx('collect');
    dropTags(null, 160);
    const to = R() ? R().money : from;
    // said before the Shop says itself, so the merged line runs in order: "Collected $6. Shop. You have $10. ..." (the
    // Shop's line gives the money; any other screen hears it here)
    UI.announce(`Collected $${res.total}.${R() && R().phase === 'shop' ? '' : ` Money $${to}.`}`);
    if (h) h.close();
    UI.refresh();
    if (to !== from) {
      setMoney(from);
      // the money counts up once the Shop is laid out: the count and its flare are the next frame's work
      UI.afterLayout(T.col || document.body, () => { countTo(from, to, 460, setMoney); punch($('.w-money'), 420); const m = $('#money'); if (m) flare(m, 1.8, 600); });
    }
  }
  UI.registerAction('collect', () => collect(UI.topDialog()));
  UI.register('cashout', {
    shell: true,
    keepMain: true,
    mount(main) {
      if (!$('#hand', main)) { playLayout(main); placeLight(); }
      updateControls();
      showCashout();
    },
    update() { renderCol(); renderRacks(); },
    unmount() { $$('.hangtag').forEach((n) => n.remove()); },
  });

  // ================================================================== pointer: hand clicks, rack sheets, drag, the glint
  document.addEventListener('click', (e) => {
    if (Date.now() < UI.drag.suppressUntil) return;
    const t = e.target;
    if (!t || !t.closest || t.closest('#dialogs')) return;
    const card = t.closest('#hand .card');
    if (card) { toggle(card.dataset.uid); return; }
    const jk = t.closest('.jk[data-joker-uid]');
    if (jk && !UI.isBusy()) { openJoker(jk.dataset.jokerUid); return; }
    const cs = t.closest('.jk[data-consumable-uid]');
    if (cs && !UI.isBusy()) { openConsumable(cs.dataset.consumableUid); }
  });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (!t || !t.closest || UI.isBusy()) return;
    const card = t.closest('#hand .card');
    if (card && phase() === 'play') { startDrag(e, card, card.parentElement, 'hand'); return; }
    const jk = t.closest('#jokerRack .jk');
    if (jk && e.pointerType !== 'touch') startDrag(e, jk, jk.parentElement, 'rack');
  });
  // a glint of candlelight follows the pointer across a card or Joker (fine pointers only); the sprite never tilts
  document.addEventListener('pointermove', (e) => {
    if (!UI.MQ.fine.matches || !UI.motionOK() || DRAG.d) return;
    const card = e.target && e.target.closest ? e.target.closest('#hand .card, .jk') : null;
    $$('.glinting').forEach((n) => { if (n !== card) n.classList.remove('glinting'); });
    if (!card || UI.isBusy()) return;
    const b = $('.sheen b', card);
    if (!b) return;
    const r = $('.sheen', card).getBoundingClientRect();
    card.classList.add('glinting');
    b.style.transform = `translate(${Math.round(e.clientX - r.left)}px, ${Math.round(e.clientY - r.top)}px)`;
  }, { passive: true });
  /** The column's figures take the largest face their panel holds, its width measured once per window size: a window
      resized inside one layout (700 x 700 to 600 x 650) or turned between the compact ones (800 x 620 to 700 x 700),
      which crosses no breakpoint, fits them to the panels again; never while a payout runs or input is held (final
      pass, part 4, final agent C: the cash-out's Blind score kept its XL face and ran 3 px out of its panel). */
  const refitCol = () => {
    const run = R();
    if (!run || !T.col || !T.col.isConnected || !$('#score', T.col) || UI.isBusy() || T.tl) return;
    const info = blindNow(run);
    setTarget(info.target, 'target-' + (info.bossId || info.kind));
    setNow(setScore, run.blind ? run.blind.score : 0);
    setNow(setMoney, run.money);
  };
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layoutHand(); placeLight(); placeKit(); markClamped(T.root); refitCol(); }, 120); });
  // crossing a breakpoint (the layout or the pixel size) redraws the column's numbers and the racks' plates for the
  // new size; while a payout runs that waits for it to end, so the column never jumps to the final score mid-count
  let rl = 0;
  const relayout = () => {
    clearTimeout(rl);
    if (!T.root) return;
    if (UI.isBusy() || T.tl) { rl = setTimeout(relayout, 250); return; }
    renderCol(); renderRacks({ force: true }); layoutHand(); placeLight(); placeKit();
    if (UI.screen() === 'cashout') { const sc = $('.w-score .score-n'); if (sc && UI.topDialog()) sc.classList.add('beaten-out'); }
  };
  UI.onBreakpoint(() => { layoutHand(); placeLight(); relayout(); });

  // the payout's numbers, shards and rings are painted while the title is up, not when the first hand is played
  setTimeout(() => { if (!UI.TEST) warmSprites(); }, 1200);

  UI.table = {
    selected: () => selectedInOrder(), select, playHand, discard, sortBy, openJoker, openConsumable, useConsumable, sellJoker, sellConsumable,
    describeEffect, describeGain, cardLabel, layoutHand, renderHand, redrawHand, dealIn, popNum, notePop, hangtag, burst, ring, sweep, shake,
    nextBlindCounts, bossRule, bossText, moveCard, refocusRack, markClamped, toggle, blindCardHTML,
  };
})();
