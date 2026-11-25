/* Wickwager Shop and Booster Packs (ARCH.md section 5; SPEC.md 2.8 to 2.10 and 6.1): the Shop, an open Booster
   Pack (with the hand a Tarot or Ghost Pack deals), buying, selling and using from the racks in the Shop and in
   a pack, rerolls, Vouchers, and Tags: the beat when one triggers and the Tags that wait for the next Blind or
   Shop (shown here and injected into the table's Blind select).
   Built in the Ember Lit language (mockups/ember-lit): lit pixel cards on the table, price tags in cream with
   dark amber figures (cash never reads as gold), springs for everything that lands, one light sweep per beat.
   Names and texts always come from TW.Content and the engine at run time; nothing here names an item.

   Screens: 'shop' and 'pack' (shell screens: the left column and the racks stay put).
   Actions: buy, reroll, leave-shop, pack-pick, pack-skip, and skip-blind (it replaces the table's handler with
   the same behaviour plus the Tag beat and a busy guard against a double skip). In the Shop and in an open pack
   the rack items open this file's sheets, so a sale or a use updates the Shop and shows the Jokers that react.
   API: TW.UI.shop = { buy(i), reroll(), leave(), pick(i), skip(), sellJoker(uid), sellConsumable(uid),
        useConsumable(uid), jokerEvents(events, delay), levelBeat(handId, from, to), tagsStatus(run),
        itemInfo(item), optionInfo(option), selected(), select(uids), render() } */
(() => {
  'use strict';
  const TW = (globalThis.TW = globalThis.TW || {});
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const UI = TW.UI;
  if (!UI) return;
  const { $, $$, el, esc, fmt, fmtMult, num, numHTML, anim, transient, punch, flare, EASE, C } = UI;
  const PX = () => UI.PX();
  const R = () => UI.run();
  const q = (...a) => UI.q(...a);
  /** The table's shared effects (sweep, popNum, hangtag, burst, ring, dealIn, layoutHand, describeEffect ...). */
  const T = () => UI.table || {};
  /** A gameplay timer at game speed (0 in test mode). */
  const later = (ms, fn) => setTimeout(fn, UI.dur(ms));
  const centre = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };
  const rich = (s) => UI.richText(s || '');
  const phase = () => (R() ? R().phase : null);

  const S = {
    shopKey: null, // the Shop visit the entrance (and a Sale Tag's beat) played for
    packKey: null, // the pack the opening played for
    sel: new Set(), // selected cards in a pack's dealt hand
    cur: -1, // the pack option the reading plate shows
    picks: 0, // picks made in the open pack (the pick sound climbs with them)
    moneySeq: 0, // the money count that is current
  };
  const SPARK = {
    cream: ['#FFF3E0', '#FFE7C8', '#FFD29C'], lime: ['#F4FFD6', '#C3F26E', '#9EE03C'], vio: ['#FBF4FF', '#CDA8FF', '#AC7BFF'],
    blue: ['#F2F4FF', '#A9B8FF', '#7C8FFF'], pink: ['#FFEEF6', '#FF80BA', '#FFB2D6'], ember: ['#FFF0D8', '#FFA458', '#FF7A2B'], ghost: ['#FFFFFF', '#D9F4FF', '#AED8F0'],
  };
  // the light and sparks of each pack kind (rings are 'r, g, b')
  const PACK_TONE = {
    card: { pill: 't-ember', ring: '255, 210, 156', sparks: SPARK.ember },
    tarot: { pill: 't-vio', ring: '172, 123, 255', sparks: SPARK.vio },
    planet: { pill: 't-blue', ring: '124, 143, 255', sparks: SPARK.blue },
    joker: { pill: 't-pink', ring: '255, 128, 186', sparks: SPARK.pink },
    ghost: { pill: 't-cream', ring: '200, 236, 255', sparks: SPARK.ghost },
  };

  // ================================================================== content helpers (names and texts from TW.Content)
  const KIND_WORD = { tarot: 'Tarot card', planet: 'Planet card', spectral: 'Spectral card' };
  const CONS = ['tarot', 'planet', 'spectral'];
  const edRow = (id) => (id ? C.edition(id) : null);
  const edName = (id) => { const r = edRow(id); return r ? r.name || id : ''; };
  /** An Edition's pill colour from what it does: Chips blue, Mult red, a free slot violet. */
  function edTone(id) {
    const r = edRow(id);
    if (!r) return 't-cream';
    if (r.slot) return 't-vio';
    if (r.chips) return 't-blue';
    if (r.mult || r.xmult) return 't-red';
    return 't-ember';
  }
  const sizeWord = (size) => (size && size !== 'normal' ? String(size).charAt(0).toUpperCase() + String(size).slice(1) : '');
  const vouchersOwned = (run) => (run && Array.isArray(run.vouchers) ? run.vouchers : []);
  const voucherSum = (run, field) => vouchersOwned(run).reduce((s, v) => s + (Number(C.voucher(v)[field]) || 0), 0);
  const voucherAny = (run, field) => vouchersOwned(run).some((v) => !!C.voucher(v)[field]);
  const handNow = (id) => (q('handTable') || []).find((h) => h.handId === id) || null;
  const cardName = (c) => `${UI.rankWord(c.rank)} of ${UI.suitName(c.suit)}`;

  /** What a Shop item is, for its plate, tooltip, sheet and labels. */
  function itemInfo(item) {
    const run = R();
    if (!item) return { name: '', kind: '', kindCls: '', text: '', lines: [], art: '', artKind: 'card', plate: false };
    if (item.kind === 'joker') {
      const row = C.joker(item.id), ed = edRow(item.edition);
      return {
        name: row.name, kind: `${C.rarity(row.rarity)} Joker${ed ? ', ' + ed.name : ''}`, kindCls: 'rar-' + (row.rarity || 'common'), text: row.text || '',
        lines: ed ? [`${ed.name}: ${ed.jokerText || ed.text || ''}`] : [], art: 'joker:' + item.id, artKind: 'joker', rarity: row.rarity, plate: true,
      };
    }
    if (CONS.includes(item.kind)) {
      const row = C.consumable(item.kind, item.id);
      const lines = [];
      if (item.kind === 'planet' && row.hand) { const h = handNow(row.hand); if (h) lines.push(`${h.name} is level ${h.level} now.`); }
      return { name: row.name, kind: KIND_WORD[item.kind], kindCls: 'kind-' + item.kind, text: row.text || '', lines, art: `${item.kind}:${item.id}`, artKind: item.kind, plate: true };
    }
    if (item.kind === 'pack') {
      const row = C.pack(item.id), sz = sizeWord(row.size || item.size);
      const shown = (Number(row.shown) || 0) + voucherSum(run, 'packShown');
      const pick = `Pick ${row.picks || 1} of ${shown || '?'}`;
      return {
        name: row.name, kind: sz ? `${sz} Booster Pack` : 'Booster Pack', kindCls: 'kind-pack', text: row.text || '', lines: [],
        // the pick line is shown on its own only when a Voucher changed what the pack's text says
        pick, pickNote: row.text && String(row.text).indexOf(pick) === 0 ? '' : pick,
        art: 'pack:' + item.id, artKind: 'pack', plate: false, packKind: row.kind || 'card',
      };
    }
    if (item.kind === 'voucher') {
      const row = C.voucher(item.id);
      return { name: row.name, kind: 'Voucher, lasts the whole run', kindCls: 'kind-voucher', text: row.text || '', lines: [], art: 'voucher:' + item.id, artKind: 'voucher', plate: true };
    }
    return { name: UI.titleCase(item.id), kind: '', kindCls: '', text: '', lines: [], art: '', artKind: 'card', plate: false };
  }
  /** What an open pack's option is, for its face and the reading plate. */
  function optionInfo(o) {
    if (!o) return { name: '', kind: '', kindCls: '', text: '', lines: [], verb: 'Pick' };
    if (o.kind === 'card' && o.card) {
      const c = o.card;
      const mods = [c.enhancement && C.enhancement(c.enhancement).name, c.edition && edName(c.edition), c.seal && C.seal(c.seal).name].filter(Boolean);
      return {
        name: cardName(c), kind: mods.length ? mods.join(', ') : 'Playing card', kindCls: mods.length ? 'kind-enh' : '',
        text: 'Joins your deck for the rest of the run.', lines: (q('cardText', c) || []).slice(1), verb: 'Pick', done: 'Picked',
      };
    }
    if (o.kind === 'joker') {
      const info = itemInfo({ kind: 'joker', id: o.id, edition: o.edition || null });
      return Object.assign(info, { verb: 'Pick', done: 'Picked' });
    }
    if (CONS.includes(o.kind)) {
      const info = itemInfo({ kind: o.kind, id: o.id });
      return Object.assign(info, { verb: 'Use', done: 'Used' });
    }
    return { name: UI.titleCase(o.id || o.kind), kind: '', kindCls: '', text: '', lines: [], verb: 'Pick', done: 'Picked' };
  }

  // ================================================================== faces: the same lit layers as the table's cards
  // layers, Edition light, name plates and Seal badges are 00-core.js's shared helpers (one rule everywhere)
  const layers = (inner, i) => UI.layersHTML(inner, i);
  const edFx = (edition, faceId) => UI.edFxHTML(edition, faceId);
  const plateHTML = (name) => UI.plateHTML(name);
  const sealHTML = (c) => (c && c.seal ? UI.sealBadgeHTML(c.seal) : '');
  /** The face of a Shop item or a pack option: its art (or the Lit placeholder), Edition light and name plate. */
  function faceHTML(info, edition) {
    const face = UI.spriteHTML(info.art, { kind: info.artKind, rarity: info.rarity, name: info.name, cls: 'face', plate: info.plate ? false : undefined });
    return face + edFx(edition, info.art) + (info.plate ? plateHTML(info.name) : '');
  }
  function cardFaceHTML(c) {
    const id = UI.cardSpriteId(c);
    return UI.spriteHTML(id, { kind: 'card', card: c, cls: 'face' }) + sealHTML(c) + edFx(c.edition, id);
  }
  const cardLabel = (c) => (T().cardLabel ? T().cardLabel(c) : cardName(c));

  // ================================================================== the left column (the table's), redrawn from the run
  /** The table's Blind panel reads "Blind cleared" whenever a pack is open; a pack a Tag opened at the Blind
      select comes before that Blind, so its panel reads "Target" with the candle lit (asked of the
      table in REQUESTS.md; harmless once it does this itself). */
  function patchCol() {
    const run = R();
    if (!run || run.phase !== 'pack' || !run.pack || run.pack.returnTo !== 'blind-select') return;
    const panel = $('#blindPanel');
    if (!panel || !panel.classList.contains('is-cleared')) return;
    panel.classList.remove('is-cleared');
    const lbl = $('.target .lbl', panel);
    if (lbl) lbl.textContent = 'Target';
    const candle = $('.candle', panel);
    if (candle) candle.classList.remove('is-out');
  }
  function renderCol() {
    if (!UI.shell || typeof UI.shell.renderCol !== 'function') return;
    UI.shell.renderCol();
    patchCol();
  }

  // ================================================================== the money readout in the left column
  function setMoney(v) {
    const node = $('#money');
    if (!node) return;
    const text = '$' + fmt(v);
    const box = node.closest('.w-money');
    const w = UI.boxWidth(box, 'money'); // measured once per viewport: a money count redraws 14 times
    const size = UI.fitSize(text, w ? w - 9 * PX() : 100 * PX(), ['L', 'S']);
    node.innerHTML = numHTML(text, size, 'money');
    node.dataset.v = text;
    node.dataset.sz = `${size}:money`;
  }
  function countMoney(from, to, ms = 420) {
    const seq = ++S.moneySeq;
    if (!UI.motionOK() || UI.dur(ms) === 0 || from === to) { setMoney(to); return; }
    const n = 14, ease = (p) => 1 - Math.pow(1 - p, 3);
    for (let i = 1; i <= n; i++) later((ms * i) / n, () => { if (seq === S.moneySeq) setMoney(Math.round(from + (to - from) * ease(i / n))); });
  }
  /** Money moved: the readout counts from the old value, the panel swells and a "+$N" or "-$N" rises from it. */
  function moneyBeat(from) {
    const run = R();
    if (!run || from == null || run.money === from) return;
    const to = run.money;
    setMoney(from);
    countMoney(from, to, 420);
    const box = $('.w-money');
    if (box) {
      punch(box, 380, 1.06);
      if (T().popNum) T().popNum(box, (to > from ? '+$' : '-$') + fmt(Math.abs(to - from)), 'money', true);
    }
  }

  // ================================================================== small beats: jiggle, sweep, landing, flying copies
  const JIGGLE = [
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(3%) scale(1.07, .9)', offset: 0.14 },
    { transform: 'translateY(-12%) scale(.94, 1.08) rotate(-4deg)', offset: 0.4 },
    { transform: 'translateY(1%) scale(1.04, .97) rotate(1.5deg)', offset: 0.7 },
    { transform: 'translateY(0) scale(1)' },
  ];
  const jiggle = (node, ms = 460) => { const l = node && $('.lift', node); return l ? anim(l, JIGGLE, { d: ms, e: EASE.out }) : null; };
  const sweep = (node, ms = 640, delay = 0) => (node && T().sweep ? T().sweep(node, ms, delay) : null);
  // a node with no box has nowhere to burst from: while a pack deals its hand on a phone or a window 760 px tall or
  // less the racks step aside, and a Joker reacting there (or a card a Spectral card makes) would spark, ring or hang
  // its tag at the screen's top-left corner (final pass, part 3)
  const shown = (n) => !!(n && n.getClientRects && n.getClientRects().length);
  const burstAt = (node, cols, n = 10, spread = 0.8) => { if (!shown(node) || !T().burst) return; const c = centre(node); T().burst(c.x, c.y, cols, n, spread, [1, 2]); };
  const ringAt = (node, rgb, r = 70, ms = 720, delay = 0) => { if (!shown(node) || !T().ring) return; const c = centre(node); T().ring(c.x, c.y, r * PX(), ms, delay, rgb); };
  const rackJoker = (uid) => $(`#racks .jk[data-joker-uid="${uid}"]`);
  const rackCons = (uid) => $(`#racks .jk[data-consumable-uid="${uid}"]`);
  /** Something arrived: it swells, a light sweep crosses it and a few cream sparks rise. */
  function landed(node, cols = SPARK.cream) {
    if (!node) return;
    punch(node, 380, 1.08);
    sweep(node, 600);
    burstAt(node, cols, 10, 0.7);
  }
  /** A copy of a sprite on the fx layer, to fly over the table (a div, so it never takes focus). */
  function flyer(node, rect) {
    const fx = $('#fx');
    if (!fx || !node || !UI.motionOK()) return null;
    const r = rect || node.getBoundingClientRect();
    if (!r || !r.width) return null;
    const g = el('div', { class: `${node.className} flyer`, 'aria-hidden': 'true' });
    g.innerHTML = node.innerHTML;
    // a copy is a picture: no ids, no actions, nothing to focus or click
    g.inert = true;
    $$('[id]', g).forEach((n) => n.removeAttribute('id'));
    $$('[data-action], [data-index], [data-shop-art], [data-opt-art], [tabindex]', g).forEach((n) => { ['data-action', 'data-index', 'data-shop-art', 'data-opt-art', 'tabindex'].forEach((a) => n.removeAttribute(a)); });
    g.style.cssText = `left:${Math.round(r.left)}px;top:${Math.round(r.top)}px;width:${Math.round(r.width)}px;height:${Math.round(r.height)}px;margin:0`;
    fx.append(g);
    return g;
  }
  /** Fly a copy to a rectangle on an arc; it turns a little in the air and lands square. Removed at the end. */
  function flyTo(g, to, o = {}) {
    if (!g) return null;
    const r = g.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (r.left + r.width / 2), dy = to.top + to.height / 2 - (r.top + r.height / 2);
    const k = o.scale != null ? o.scale : to.width && r.width ? to.width / r.width : 1;
    const lift = (o.arc != null ? o.arc : 16) * PX();
    const a = anim(g, [
      { transform: 'translate(0px, 0px) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.round(dx * 0.45)}px, ${Math.round(dy * 0.45 - lift)}px) scale(${((1 + k) / 2 + 0.06).toFixed(3)}) rotate(${o.tilt != null ? o.tilt : -3}deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(${k.toFixed(3)}) rotate(0deg)`, opacity: o.fade ? 0 : 1 },
    ], { d: o.d || 560, delay: o.delay || 0, e: o.e || EASE.inOut, fill: 'forwards' });
    if (a) { const kill = () => g.remove(); a.finished.then(kill, kill); } else g.remove();
    return a;
  }
  /** A rack item that just arrived: its flying copy lands on it, then it shows (a swell, a sweep, sparks). */
  function landGhost(ghost, dest, cols, d = 560) {
    if (!shown(dest)) { if (ghost) ghost.remove(); return; }
    if (!ghost) { landed(dest, cols); return; }
    dest.style.opacity = '0';
    const a = flyTo(ghost, dest.getBoundingClientRect(), { d });
    const done = () => { dest.style.opacity = ''; landed(dest, cols); };
    if (a) a.finished.then(done, done); else done();
  }
  /** A rack item leaves: it lifts and fades (the table's leave). */
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
  /** A light from the room behind a beat (the table's flash, smaller). */
  function roomFlash(node, k = 0.6) {
    if (!shown(node) || !UI.motionOK() || !UI.room || typeof UI.room.flashAt !== 'function') return; // reduced motion: no flashes
    const c = centre(node);
    const f = UI.room.flashAt(c.x, c.y);
    if (f) anim(f, [{ opacity: 0 }, { opacity: Math.min(1, 0.9 * k) }, { opacity: Math.min(1, 0.5 * k), offset: 0.5 }, { opacity: 0 }], { d: 1000, e: 'linear', always: true });
  }
  /** Hang a short tag from a rack item (a pill that pops on a phone, where a hanging tag would cover the Shop). */
  function tagOn(node, text, cls, ms = 1500) {
    if (!shown(node) || !text) return;
    if (UI.MQ.phone.matches || !T().hangtag) { if (T().notePop) T().notePop(node, text, cls, { ms: 1100 }); return; }
    const t = T().hangtag(node, text, cls);
    if (t) later(ms, () => { if (!t.isConnected) return; const a = anim(t, [{ opacity: 1 }, { opacity: 0, transform: `translateY(${-2 * PX()}px)` }], { d: 220, fill: 'both' }); transient(t, a, 220); });
  }

  // ================================================================== Jokers that react (the engine's jokerEvents)
  /** A short label for one Joker event, or null when the bump says it all. Unknown kinds get the bump only. */
  function eventLabel(ev) {
    const n = (v) => Number(v) || 0;
    switch (ev.op) {
      case 'state': {
        const d = n(ev.to) - n(ev.from);
        if (typeof ev.to !== 'number' || !d) return null;
        if (ev.key === 'chips') return { text: `${d > 0 ? '+' : ''}${fmtMult(d)} Chips`, cls: 't-blue', sfx: 'chip' };
        if (ev.key === 'mult') return { text: `${d > 0 ? '+' : ''}${fmtMult(d)} Mult`, cls: 't-red', sfx: 'mult' };
        if (ev.key === 'x' || ev.key === 'xmult') return { text: `×${fmtMult(ev.to)} Mult`, cls: 't-red', sfx: 'xmult' };
        if (ev.key === 'money') return { text: `${d > 0 ? '+' : '-'}$${fmt(Math.abs(d))}`, cls: 't-cash', sfx: 'money' };
        return null;
      }
      case 'money': return n(ev.amount) ? { text: `${n(ev.amount) > 0 ? '+' : '-'}$${fmt(Math.abs(n(ev.amount)))}`, cls: 't-cash', sfx: 'money' } : null;
      case 'extraHand': return { text: `+${n(ev.hands) || 1} hand`, cls: 't-ember', sfx: 'again' };
      case 'gainTag': return { text: 'Tag', cls: 't-lime', sfx: 'tag' };
      case 'createPlanet': case 'createTarot': case 'createSpectral': {
        const k = (ev.created || []).length;
        return k ? { text: `+${k} ${UI.plural(k, 'card')}`, cls: 't-vio', sfx: 'use' } : null;
      }
      case 'enhanceAdded': return { text: 'Enhanced', cls: 't-lime', sfx: 'use' };
      case 'editionDeckCards': return { text: 'Edition', cls: 't-ember', sfx: 'use' };
      case 'sealHandCard': return { text: 'Seal', cls: 't-pink', sfx: 'tag' };
      case 'rankUpScored': return { text: 'Rank up', cls: 't-cream', sfx: 'flip' };
      case 'handSizeThisBlind': return { text: `+${n(ev.handSize) || 1} hand size`, cls: 't-cream', sfx: 'deal' };
      case 'copy': return { text: 'Copied', cls: 't-vio', sfx: 'flip' };
      case 'forgot': return { text: 'Forgot', cls: 't-plum', sfx: 'flip' };
      default: return null;
    }
  }
  /** Show what the Jokers' events did: each Joker bumps in turn (a jiggle, a light sweep) with its label.
      Returns how long the beats take (base ms). */
  function jokerEvents(events, delay = 0) {
    const list = (Array.isArray(events) ? events : []).filter((e) => e && e.uid);
    list.forEach((ev, k) => later(delay + k * 170, () => {
      if (ev.op === 'gainTag' && T().describeGain) {
        const tg = C.tag(ev.tag);
        if (tg) UI.toast(T().describeGain(tg, ev.gained || {}), 'good', 3200);
      }
      const jk = rackJoker(ev.uid);
      if (!jk) return;
      jiggle(jk);
      sweep(jk, 600);
      const lb = eventLabel(ev);
      if (lb) tagOn(jk, lb.text, lb.cls);
      UI.sfx(lb && lb.sfx ? lb.sfx : 'flip', { index: k });
    }));
    if (list.length) {
      const names = [...new Set(list.map((e) => C.joker(e.id).name).filter(Boolean))];
      if (names.length) later(delay, () => UI.announce(`${UI.listJoin(names)} ${names.length === 1 ? 'reacts' : 'react'}.`));
    }
    return list.length ? delay + list.length * 170 + 320 : 0;
  }
  /** Jokers whose rules (their own, or what they copy) carry a word, for the beats where a rule acts. */
  function jokersWithRule(word) {
    const run = R();
    if (!run) return [];
    return run.jokers.filter((j) => {
      const own = C.joker(j.id).rules;
      if (own && own[word]) return true;
      const copies = q('jokerCopies', j.uid) || [];
      return copies.some((cp) => { const r = C.joker(cp.id).rules; return !!(r && r[word]); });
    });
  }

  // ================================================================== the level-up beat (a Planet card, a Tag), in the hand panel
  function setWell(node, v, style) {
    if (!node) return;
    const text = style === 'mult' ? fmtMult(v) : fmt(v);
    const box = node.parentElement;
    const w = UI.boxWidth(box, 'well-' + style); // the same key the table uses for this well
    const size = UI.fitSize(text, w ? w - 8 * PX() : 80 * PX(), ['XL', 'L', 'S']);
    node.innerHTML = numHTML(text, size, style);
    // the table's readouts skip a redraw of the value they already show: keep what this one shows on record
    node.dataset.v = text;
    node.dataset.sz = `${size}:${style}`;
  }
  function countWell(node, from, to, style, ms = 380) {
    if (!UI.motionOK() || UI.dur(ms) === 0) { setWell(node, to, style); return; }
    const n = 10, whole = Number.isInteger(from) && Number.isInteger(to);
    for (let i = 1; i <= n; i++) later((ms * i) / n, () => { const v = from + ((to - from) * i) / n; setWell(node, whole ? Math.round(v) : v, style); });
  }
  /** A hand gains levels: the hand panel shows it at its old level, the level ticks over, then Chips and Mult
      count up with their "+N" (Lit's pulse, ring and flare). The column is restored afterwards. Returns base ms. */
  function levelBeat(handId, from, to, o = {}) {
    const row = C.hand(handId);
    const name = $('#handName'), cw = $('#chips'), mw = $('#mult');
    if (!row || !name || !cw || !mw || !(to > from)) return 0;
    const val = (L) => ({ c: (Number(row.chips) || 0) + Math.max(0, L - 1) * (Number(row.lchips) || 0), m: (Number(row.mult) || 0) + Math.max(0, L - 1) * (Number(row.lmult) || 0) });
    const a = val(from), b = val(to);
    const panel = $('.w-hand');
    name.innerHTML = `${esc(row.name)}<span class="lv">lv.${from}</span>`;
    setWell(cw, a.c, 'chips');
    setWell(mw, a.m, 'mult');
    if (panel) { punch(panel, 420, 1.03); sweep(panel, 640); }
    later(320, () => {
      if (!name.isConnected) return;
      name.innerHTML = `${esc(row.name)}<span class="lv">lv.${to}</span>`;
      const tab = $('#handTab');
      if (tab) { punch(tab, 460, 1.18); ringAt(tab, '196, 242, 110', 44, 640); }
      UI.sfx('again');
    });
    later(520, () => {
      if (!cw.isConnected) return;
      countWell(cw, a.c, b.c, 'chips');
      if (T().popNum) T().popNum(cw.parentElement, '+' + fmt(b.c - a.c), 'blue');
      flare(cw.parentElement, 1.8, 520);
      ringAt(cw.parentElement, '128, 148, 255', 40, 620);
      UI.sfx('chip', { index: 3 });
    });
    later(760, () => {
      if (!mw.isConnected) return;
      countWell(mw, a.m, b.m, 'mult');
      if (T().popNum) T().popNum(mw.parentElement, '+' + fmtMult(b.m - a.m), 'red');
      flare(mw.parentElement, 1.8, 520);
      ringAt(mw.parentElement, '255, 112, 92', 40, 620);
      UI.sfx('mult', { index: 4 });
    });
    const hold = o.hold != null ? o.hold : 900;
    // the column goes back to what it shows on this screen (at the table: the selected cards' hand, or "Select cards")
    later(760 + 380 + hold, () => { if (UI.shell && ['shop', 'pack', 'blind-select', 'play'].includes(UI.screen()) && !UI.isBusy()) renderCol(); });
    UI.announce(`${row.name} is now level ${to}.`);
    return 1200;
  }

  // ================================================================== Tags: what waits for the next Blind or Shop
  /** The Tags whose effect is still to come ('next-blind', 'next-shop') or applies right now ('in-use'), read
      from the run: the Blinds skipped since the last cleared one, their Tags' fields, and run.pending. */
  function tagsStatus(run) {
    if (!run || !run.blindStatus) return [];
    const out = [];
    const ord = (k) => { const [a, i] = String(k).split('-').map(Number); return (a || 0) * 3 + (i || 0); };
    const keys = Object.keys(run.blindStatus);
    let last = -1;
    keys.forEach((k) => { if (run.blindStatus[k] === 'cleared' && ord(k) > last) last = ord(k); });
    const pend = run.pending || {};
    keys.filter((k) => run.blindStatus[k] === 'skipped' && ord(k) > last).sort((x, y) => ord(x) - ord(y)).forEach((k) => {
      const row = C.tag(run.tags && run.tags[k]);
      if (!row) return;
      if ((row.hands && pend.extraHands > 0) || (row.targetMult && pend.targetMult < 1) || (row.discards && pend.extraDiscards > 0)) out.push({ id: row.id, row, state: 'next-blind', key: k });
      else if (row.discount && pend.sale) out.push({ id: row.id, row, state: 'next-shop', key: k });
    });
    const inShop = run.phase === 'shop' || (run.phase === 'pack' && run.pack && run.pack.returnTo === 'shop');
    if (inShop && run.shop && run.shop.discount > 0) {
      const row = (TW.Content && Array.isArray(TW.Content.TAGS) ? TW.Content.TAGS : []).find((t) => t && t.discount);
      if (row) out.push({ id: row.id, row, state: 'in-use', key: 'shop' });
    }
    return out;
  }
  const TAG_STATE = { 'next-blind': 'Next Blind', 'next-shop': 'Next Shop', 'in-use': 'In use here' };
  function tagsStripHTML(list, cls = '') {
    if (!list.length) return '';
    const items = list.map((t) => {
      const name = t.row.name || UI.titleCase(t.id);
      return `<span class="tw-tag is-${t.state}" role="listitem" tabindex="0" data-wait-tag="${esc(t.id)}" data-wait-state="${esc(t.state)}" aria-label="${esc(`${name}, ${TAG_STATE[t.state]}: ${t.row.text || ''}`)}"><span class="tw-tok">${UI.spriteHTML('tag:' + t.id, { kind: 'tag', name })}</span><span class="tw-txt"><b>${esc(name)}</b><span class="lbl">${esc(TAG_STATE[t.state])}</span></span></span>`;
    }).join('');
    return `<div class="tags-waiting ${cls}" role="list" aria-label="Tags waiting"><span class="lbl tw-head">Tags</span>${items}</div>`;
  }
  // the table's Blind select is not ours: the strip is laid into its main area whenever it renders
  const WATCH = { main: null, obs: null };
  function injectWaiting() {
    const main = UI.shell && UI.shell.el ? UI.shell.el().main : null;
    if (!main || !main.isConnected) return;
    const strip = main.querySelector(':scope > .tags-waiting');
    if (UI.screen() !== 'blind-select' || main.dataset.screen !== 'blind-select') { if (strip && !strip.classList.contains('in-shop')) strip.remove(); return; }
    const list = tagsStatus(R());
    const sig = list.map((t) => `${t.id}:${t.state}:${t.key}`).join('|');
    if (!list.length) { if (strip) strip.remove(); return; }
    if (strip && strip.dataset.sig === sig) return;
    const wrap = el('div');
    wrap.innerHTML = tagsStripHTML(list, 'on-blinds');
    const fresh = wrap.firstElementChild;
    fresh.dataset.sig = sig;
    if (strip) strip.replaceWith(fresh); else main.prepend(fresh);
  }
  function watchMain() {
    const main = UI.shell && UI.shell.el ? UI.shell.el().main : null;
    if (main && main !== WATCH.main && typeof MutationObserver === 'function') {
      if (WATCH.obs) WATCH.obs.disconnect();
      WATCH.main = main;
      WATCH.obs = new MutationObserver(() => injectWaiting());
      WATCH.obs.observe(main, { childList: true });
    }
    injectWaiting();
  }
  if (typeof MutationObserver === 'function' && document.body) {
    new MutationObserver(() => watchMain()).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
  }

  // ================================================================== the Shop
  const shopMain = () => (UI.shell && UI.shell.el ? UI.shell.el().main : null);
  const shopKeyOf = (run) => `${run.seed}:${run.ante}:${run.blindIndex}:${run.stats ? run.stats.blindsCleared : 0}`;
  const NOT_ENOUGH = 'Not enough money.';
  // the way out of the Shop names where it leads (PRODUCT.md: the genre's system words, and the game's own labels)
  const NEXT_WORD = 'Next Blind';
  function rerollState(run) {
    const shop = run.shop || {};
    const cost = q('rerollCost');
    const price = cost == null ? shop.rerollCost || 0 : cost;
    const free = price === 0;
    const flat = voucherAny(run, 'flatRerolls');
    const step = (TW.Content && TW.Content.SHOP && TW.Content.SHOP.rerollStep) || 1;
    const freeLeft = Number(shop.freeRerolls) || 0;
    const note = free ? `${freeLeft} free ${UI.plural(freeLeft, 'reroll')}` : flat ? 'Price stays the same' : `+$${step} after each`;
    return { price, free, can: free || run.money >= price, note };
  }
  function rerollHTML(run) {
    const st = rerollState(run);
    const why = st.can ? '' : NOT_ENOUGH;
    return `<span class="lbl ctl-note">${esc(st.note)}</span><button class="btn b-pink" type="button" data-action="reroll"${why ? ` aria-disabled="true" data-why="${esc(why)}"` : ''} aria-label="${esc(st.free ? 'Reroll the cards for sale, free' : `Reroll the cards for sale for $${st.price}`)}"><span>Reroll</span><span class="r-cost">${st.free ? 'Free' : '$' + fmt(st.price)}</span></button>`;
  }
  /** One Shop item, the same for every kind: its art under a cream price tag; its name, kind and text; and Buy in a
      row of its own at the foot of the item (or why it can't be bought). */
  function itemHTML(item, i, run) {
    if (!item) return '';
    if (item.sold) return soldHTML(item, i);
    const info = itemInfo(item);
    const can = q('canBuy', i) || { ok: false, error: '' };
    const ed = item.kind === 'joker' && item.edition ? edRow(item.edition) : null;
    const sale = item.kind === 'joker' && run.shop && run.shop.discount > 0 ? Math.round(run.shop.discount * 100) : 0;
    const price = `$${fmt(item.price)}`;
    const art = `<button class="jk si-face${item.edition ? ' ed-' + esc(item.edition) : ''}" type="button" data-shop-art="${i}" aria-label="${esc(`${info.name}, details`)}">${layers(faceHTML(info, item.edition), i + 2)}</button>`;
    const tags = `<span class="tag t-cash price" aria-hidden="true">${esc(price)}</span>${sale ? `<span class="tag t-lime sale" aria-hidden="true">-${sale}%</span>` : ''}${ed ? `<span class="tag ${edTone(item.edition)} ed-pill" aria-hidden="true">${esc(ed.name)}</span>` : ''}`;
    const verb = item.kind === 'pack' ? `Buy and open ${info.name}` : `Buy ${info.name}`;
    const buy = `<div class="si-buy"><button class="btn b-cream" type="button" data-action="buy" data-index="${i}"${can.ok ? '' : ` aria-disabled="true" data-why="${esc(can.error || NOT_ENOUGH)}"`} aria-label="${esc(`${verb} for ${price}`)}">Buy</button>${can.ok ? '' : `<p class="copy si-why">${esc(can.error || '')}</p>`}</div>`;
    const infoHTML = `<div class="si-info"><b class="si-name">${esc(info.name)}</b><span class="si-kind ${info.kindCls}">${esc(info.kind)}</span><p class="copy si-text">${rich(info.text)}</p>${info.pickNote ? `<p class="copy si-pick">${esc(info.pickNote)}.</p>` : ''}</div>`;
    return `<article class="si si-${esc(item.kind)}${info.plate ? ' has-plate' : ''}${can.ok ? '' : ' is-short'}" role="listitem" data-shop-index="${i}" data-kind="${esc(item.kind)}" aria-label="${esc(`${info.name}, ${info.kind}, ${price}`)}"><div class="si-art">${art}${tags}</div>${infoHTML}${buy}</article>`;
  }
  function soldHTML(item, i) {
    const word = item.kind === 'voucher' ? 'Redeemed' : 'Sold';
    return `<article class="si is-sold si-${esc(item.kind)}" role="listitem" data-shop-index="${i}" data-kind="${esc(item.kind)}" aria-label="${word}"><div class="si-art">${UI.paint.imgTag(UI.paint.slot(), 'slot')}<span class="tag t-plum sold-mark">${word}</span></div></article>`;
  }
  /** The Voucher slot when there is nothing to offer: one was redeemed this Ante, or every Voucher is owned. */
  function noVoucherHTML(run) {
    const all = TW.Content && Array.isArray(TW.Content.VOUCHERS) ? TW.Content.VOUCHERS.length : 0;
    const word = all && vouchersOwned(run).length >= all ? 'All owned' : 'Next Ante';
    return `<article class="si is-sold si-voucher" role="listitem" aria-label="${esc(`Voucher: ${word}`)}"><div class="si-art">${UI.paint.imgTag(UI.paint.slot(), 'slot')}<span class="tag t-plum sold-mark">${word}</span></div><div class="si-info"><span class="si-kind kind-voucher">Voucher</span><p class="copy si-text k-dim">${esc(word === 'All owned' ? 'Every Voucher is yours.' : 'A new Voucher comes with the next Ante.')}</p></div></article>`;
  }
  function footHTML(run) {
    const own = vouchersOwned(run);
    const tags = tagsStatus(run);
    if (!own.length && !tags.length) return '';
    const v = own.length
      ? `<div class="own-v" role="list" aria-label="Vouchers owned"><span class="lbl">Vouchers</span>${own.map((id) => { const row = C.voucher(id); return `<span class="tag t-cream own-pill" role="listitem" tabindex="0" data-own-voucher="${esc(id)}" aria-label="${esc(`${row.name}: ${row.text || ''}`)}">${esc(row.name)}</span>`; }).join('')}</div>`
      : '';
    return `<div class="sh-foot">${v}${tagsStripHTML(tags, 'in-shop')}</div>`;
  }
  function shopHTML(run) {
    const items = (run.shop.items || []).map((it, i) => ({ it, i })).filter((x) => x.it);
    const cards = items.filter((x) => x.it.slot === 'card');
    const packs = items.filter((x) => x.it.slot === 'pack');
    const vouch = items.filter((x) => x.it.slot === 'voucher');
    const lower = packs.map((x) => itemHTML(x.it, x.i, run)).join('') + (vouch.length ? vouch.map((x) => itemHTML(x.it, x.i, run)).join('') : noVoucherHTML(run));
    // a row of four (Night Market's extra card and pack slots): the rows share one four-column grid and the items'
    // text columns narrow to fit, so nothing wraps into the scroller (50-shop.css .shop.dense)
    const dense = Math.max(cards.length, packs.length + 1) > 3;
    // the two controls live in the Shop's head row on every layout, always in view: Reroll (pink) for the cards for
    // sale, and the way out (ember); the items below share one layout, so every Buy sits in the same place
    return `<section class="panel warm shop${dense ? ' dense' : ''}" id="shop" aria-labelledby="shopTitle">
        <div class="p-head sh-head"><h2 class="tag t-ember" id="shopTitle">Shop</h2>
          <div class="sh-ctls"><div class="sh-ctl c-reroll">${rerollHTML(run)}</div><div class="sh-ctl c-next"><button class="btn b-ember" type="button" data-action="leave-shop">${esc(NEXT_WORD)}</button></div></div>
        </div>
        <div class="shop-grid">
          <div class="shelf s-cards" role="list" aria-label="Cards for sale">${cards.map((x) => itemHTML(x.it, x.i, run)).join('')}</div>
          <div class="shelf s-lower" role="list" aria-label="Booster Packs and Voucher">${lower}</div>
          ${footHTML(run)}
        </div>
      </section>`;
  }
  /** What the Shop shows that a rack change can alter: each item's price and whether it is sold. */
  const shopSig = (run) => (run && run.shop && Array.isArray(run.shop.items) ? run.shop.items.map((it) => (it ? `${it.id}:${it.price}${it.sold ? 's' : ''}` : '')).join(',') : '');
  const focusKey = (n) => {
    if (!n || !n.closest || !n.closest('#shop')) return null;
    if (n.dataset.action) return `[data-action="${n.dataset.action}"]${n.dataset.index != null ? `[data-index="${n.dataset.index}"]` : ''}`;
    if (n.dataset.shopArt != null) return `[data-shop-art="${n.dataset.shopArt}"]`;
    if (n.dataset.ownVoucher) return `[data-own-voucher="${n.dataset.ownVoucher}"]`;
    return null;
  };
  /** Draw the Shop into the main area. o.entrance: 'full' (a new visit), 'back' (from a pack) or nothing. */
  function renderShop(o = {}) {
    const main = shopMain(), run = R();
    if (!main || !run || !run.shop) return null;
    const active = document.activeElement;
    const key = focusKey(active);
    const fromBuy = active && active.dataset && active.dataset.action === 'buy' ? Number(active.dataset.index) : null;
    main.innerHTML = shopHTML(run);
    const box = $('#shop', main);
    // what this Shop shows, so the racks' watcher (below) redraws it only when a price really changed
    if (box) box.dataset.sig = shopSig(run);
    bindShop(box);
    // a new visit's entrance starts once the Shop is laid out (one frame's work, not one long task)
    if (o.entrance === 'full') { $$('.si, .sh-ctl .btn', box).forEach((n) => { n.style.opacity = '0'; }); UI.afterLayout(box, () => { $$('.si, .sh-ctl .btn', box).forEach((n) => { n.style.opacity = ''; }); enterShop(box); }); }
    else if (o.entrance === 'back') anim(box, [{ opacity: 0, transform: `translateY(${4 * PX()}px)` }, { opacity: 1, transform: 'none' }], { d: 320, e: EASE.out, fill: 'backwards' });
    if (key) {
      // focus stays where it was; a bought item's Buy is gone, so it moves on to the next thing for sale
      let n = $(key, box);
      if (!n && fromBuy != null) {
        const buys = $$('[data-action="buy"]', box).filter((b) => b.getAttribute('aria-disabled') !== 'true');
        n = buys.find((b) => Number(b.dataset.index) > fromBuy) || buys[0] || $('[data-action="reroll"]', box);
      }
      if (!n) n = $('[data-action="leave-shop"]', box);
      if (n) UI.focusQuiet(n);
    }
    if (UI.shell && UI.shell.placeLight) UI.shell.placeLight();
    return box;
  }
  /** The Shop rises from the table, its items deal in with a stagger, the price tags drop on the bouncy spring. */
  function enterShop(box) {
    if (!box) return;
    const p = PX();
    anim(box, [{ opacity: 0, transform: `translateY(${14 * p}px)` }, { opacity: 1, transform: 'translateY(0)' }], { d: 560, e: EASE.spring, fill: 'backwards' });
    $$('.si', box).forEach((n, i) => anim(n, [{ opacity: 0, transform: `translateY(${10 * p}px) scale(.96)` }, { opacity: 1, transform: 'none' }], { d: 560, delay: 140 + i * 65, e: EASE.spring, fill: 'backwards' }));
    $$('.si .price', box).forEach((n, i) => anim(n, [{ opacity: 0, transform: `translateY(${-6 * p}px) scale(.8)` }, { opacity: 1, transform: 'none' }], { d: 620, delay: 360 + i * 65, e: EASE.bouncy, fill: 'backwards' }));
    $$('.si-face', box).forEach((n, i) => sweep(n, 640, 420 + i * 80));
    $$('.sh-ctl .btn', box).forEach((n, i) => anim(n, [{ opacity: 0, transform: `translateY(${4 * p}px)` }, { opacity: 1, transform: 'none' }], { d: 480, delay: 260 + i * 90, e: EASE.spring, fill: 'backwards' }));
  }
  function bindShop(box) {
    if (!box) return;
    box.addEventListener('click', (e) => {
      const art = e.target.closest && e.target.closest('[data-shop-art]');
      if (!art || UI.isBusy()) return;
      UI.sfx('button');
      itemSheet(Number(art.dataset.shopArt), art);
    });
  }
  /** The item's sheet (a tap on a phone, a click on desktop): its full text, Edition, and Buy. */
  function itemSheet(i, anchor) {
    const run = R();
    const item = run && run.shop && run.shop.items[i];
    if (!item || item.sold) return null;
    const info = itemInfo(item);
    const can = q('canBuy', i) || { ok: false, error: '' };
    const body = `<p class="s-text copy">${rich(info.text)}</p>${info.lines.map((l) => `<p class="s-line copy">${rich(l)}</p>`).join('')}${info.pick ? `<p class="s-line copy k-dim">${esc(info.pick)}.</p>` : ''}${can.ok ? '' : `<p class="s-why copy">${esc(can.error || '')}</p>`}`;
    return UI.sheet({
      title: info.name, kind: info.kind, kindCls: info.kindCls, body, anchor,
      actions: [{ label: `Buy $${fmt(item.price)}`, cls: 'b-ember', action: 'buy', data: { index: String(i) }, why: can.ok ? '' : can.error || NOT_ENOUGH, onClick: (h) => { h.close(); buy(i); } }],
    });
  }
  const snapshot = (run) => ({
    money: run.money, jokers: run.jokers.map((j) => j.uid), eds: Object.fromEntries(run.jokers.map((j) => [j.uid, j.edition || null])),
    cons: run.consumables.map((k) => k.uid), levels: Object.assign({}, run.levels), cards: run.cards.length,
  });
  /** Buy the item at index i: it flies to its rack (or the Voucher is stamped, or the pack opens). */
  function buy(i) {
    const run = R();
    if (!run || run.phase !== 'shop' || UI.isBusy()) return;
    const item = run.shop && run.shop.items[i];
    if (!item || item.sold) return;
    const chk = q('canBuy', i);
    if (chk && !chk.ok) { UI.error(chk.error); return; }
    const node = $(`#shop .si[data-shop-index="${i}"]`);
    const art = node && $('.si-face', node);
    const rect = art ? art.getBoundingClientRect() : null;
    const ghost = art ? flyer(art, rect) : null; // made now: the Shop redraws under it
    const before = snapshot(run);
    const nItems = run.shop.items.length;
    const info = itemInfo(item);
    const res = UI.call('buy', i);
    if (!res || !res.ok) { if (ghost) ghost.remove(); return; }
    UI.hideTip();
    UI.sfx('buy');
    if (res.opened || phase() === 'pack') {
      UI.announce(`Bought ${info.name} for $${fmt(item.price)}.`);
      S.packKey = null;
      // the bought pack's own face is the flying copy now: the one left in the Shop must not show in its fade
      if (art) art.style.visibility = 'hidden';
      UI.show('pack', { from: rect, ghost, tone: info.packKind });
      UI.afterLayout(document.body, () => moneyBeat(before.money));
      jokerEvents(res.jokerEvents, 700);
      return;
    }
    UI.shell.renderRacks();
    renderCol();
    moneyBeat(before.money);
    renderShop();
    const after = R();
    if (item.kind === 'joker') {
      const uid = after.jokers.map((j) => j.uid).find((u) => !before.jokers.includes(u));
      landGhost(ghost, uid && rackJoker(uid), SPARK.pink);
      UI.announce(`Bought ${info.name} for $${fmt(item.price)}. It joins your Jokers.`);
    } else if (CONS.includes(item.kind)) {
      const uid = after.consumables.map((k) => k.uid).find((u) => !before.cons.includes(u));
      landGhost(ghost, uid && rackCons(uid), SPARK.vio);
      UI.announce(`Bought ${info.name} for $${fmt(item.price)}.`);
    } else if (item.kind === 'voucher') {
      stampVoucher(ghost);
      UI.toast(`${info.name} redeemed.`, 'good', { say: false });
      UI.announce(`${info.name} redeemed. ${info.text}`);
      // a Voucher that adds slots to this Shop: the new items deal in
      $$('#shop .si').forEach((n, k) => {
        if (Number(n.dataset.shopIndex) < nItems) return;
        anim(n, [{ opacity: 0, transform: `translateY(${-8 * PX()}px) scale(.96)` }, { opacity: 1, transform: 'none' }], { d: 560, delay: 260 + k * 40, e: EASE.spring, fill: 'backwards' });
        sweep($('.si-face', n), 600, 520);
      });
      const pill = $(`#shop [data-own-voucher="${item.id}"]`);
      if (pill) { anim(pill, [{ opacity: 0, transform: `translateY(${4 * PX()}px) scale(.8)` }, { opacity: 1, transform: 'none' }], { d: 560, delay: 380, e: EASE.bouncy, fill: 'backwards' }); }
    } else if (ghost) ghost.remove();
    jokerEvents(res.jokerEvents, 420);
  }
  /** A Voucher is redeemed: its card swells on the bouncy spring, a cream ring and a flash, then it fades. */
  function stampVoucher(ghost) {
    if (!ghost) return;
    const p = PX();
    ringAt(ghost, '255, 226, 190', 90, 820, 120);
    burstAt(ghost, SPARK.cream, 18, 1.1);
    roomFlash(ghost, 0.5);
    const a = anim(ghost, [
      { transform: 'scale(1)', opacity: 1, easing: EASE.out },
      { transform: `translateY(${-6 * p}px) scale(1.12)`, opacity: 1, offset: 0.28, easing: EASE.bouncy },
      { transform: `translateY(${-6 * p}px) scale(1.04)`, opacity: 1, offset: 0.62 },
      { transform: `translateY(${-14 * p}px) scale(1.1)`, opacity: 0 },
    ], { d: 900, e: 'linear', fill: 'forwards' });
    if (a) { const kill = () => ghost.remove(); a.finished.then(kill, kill); } else ghost.remove();
  }
  /** Reroll the cards for sale: the old ones fold away, the new ones unfold in a stagger. */
  function reroll() {
    const run = R();
    if (!run || run.phase !== 'shop' || UI.isBusy()) return;
    const st = rerollState(run);
    if (!st.can) { UI.error(NOT_ENOUGH); return; }
    const from = run.money;
    const old = $$('#shop .s-cards .si').map((n) => ({ n, r: n.getBoundingClientRect() }));
    // folded copies of the old cards, so the fold plays while the new ones are already in place
    const ghosts = UI.motionOK() ? old.map(({ n, r }) => flyer(n, r)).filter(Boolean) : [];
    const res = UI.call('reroll');
    if (!res || !res.ok) { ghosts.forEach((g) => g.remove()); return; }
    UI.hideTip();
    UI.sfx('reroll');
    renderCol();
    moneyBeat(from);
    renderShop();
    ghosts.forEach((g, k) => { const a = anim(g, [{ transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(.06)', opacity: 0.6 }], { d: 150, delay: k * 50, e: EASE.out, fill: 'forwards' }); if (a) { const kill = () => g.remove(); a.finished.then(kill, kill); } else g.remove(); });
    $$('#shop .s-cards .si').forEach((n, k) => {
      anim(n, [{ transform: 'scaleX(.06)', opacity: 0 }, { transform: 'scaleX(.06)', opacity: 1, offset: 0.01 }, { transform: 'scaleX(1)', opacity: 1 }], { d: 460, delay: 150 + k * 70, e: EASE.spring, fill: 'backwards' });
      sweep($('.si-face', n), 600, 300 + k * 70);
    });
    const btn = $('#shop [data-action="reroll"]');
    if (btn) punch(btn, 300, 1.05);
    // Jokers whose rules act on a reroll (a cheaper paid reroll) bump as it happens
    if (!res.free) jokersWithRule('rerollDiscount').forEach((j, k) => later(120 + k * 160, () => { const jk = rackJoker(j.uid); if (jk) { jiggle(jk); sweep(jk); } }));
    const names = $$('#shop .s-cards .si:not(.is-sold) .si-name').map((n) => n.textContent);
    UI.announce(`${res.free ? 'Free reroll' : `Rerolled for $${fmt(res.cost)}`}. For sale: ${UI.listJoin(names)}.`);
  }
  function leaveShop() {
    const run = R();
    if (!run || run.phase !== 'shop' || UI.isBusy()) return;
    const res = UI.act('leaveShop');
    if (res && res.ok) UI.announce('On to the next Blind.');
  }
  /** The Sale Tag (or any Tag that discounts) applies to this Shop: its token pops, the cut prices flash. */
  function saleBeat(box) {
    const run = R();
    const st = tagsStatus(run).find((t) => t.state === 'in-use');
    if (!st || !box) return;
    const pct = Math.round((run.shop.discount || 0) * 100);
    const free = Number(run.shop.freeRerolls) || 0;
    later(520, () => {
      const tok = $(`[data-wait-tag="${st.id}"]`, box);
      if (tok) { punch(tok, 520, 1.25); ringAt(tok, '196, 242, 110', 60, 720); burstAt(tok, SPARK.lime, 12, 0.9); }
      $$('.si .sale', box).forEach((n, k) => { punch(n, 460, 1.3); flare(n, 1.6, 520, k * 60); });
      const rr = $('[data-action="reroll"]', box);
      if (rr && free) punch(rr, 420, 1.06);
      UI.sfx('tag');
      UI.toast(`${st.row.name}: Jokers ${pct}% off${free ? `, and ${free} free ${UI.plural(free, 'reroll')}` : ''} in this Shop.`, 'good', 3400);
    });
  }
  UI.register('shop', {
    shell: true,
    mount(main, props = {}) {
      const run = R();
      if (!run || !run.shop) { main.innerHTML = `<div class="shop-empty"><p class="copy">The Shop is closed.</p><button class="btn b-ember big" type="button" data-action="leave-shop">${esc(NEXT_WORD)}</button></div>`; return; }
      const key = shopKeyOf(run);
      const fresh = S.shopKey !== key;
      S.shopKey = key;
      const draw = () => {
        const box = renderShop({ entrance: props.entrance || (fresh ? 'full' : 'back') });
        if (fresh) {
          saleBeat(box);
          const n = run.shop.items.filter((x) => x && !x.sold).length;
          UI.announce(`Shop. You have $${fmt(run.money)}. ${n} ${UI.plural(n, 'thing')} for sale.`);
        }
        const nx = box && $('[data-action="leave-shop"]', box);
        if (nx && !UI.TEST) setTimeout(() => { if (!UI.topDialog() && (!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected)) UI.focusQuiet(nx); }, UI.dur(500));
      };
      // a new visit's shelves are built once the screen change has had its frame (the column, the racks and the
      // table's fading copy are painted first): built in the same task, the two made one frame of 50 to 100 ms in half
      // the measured entrances (final pass, part 4, P6). Input waits for them; test mode draws at once.
      if (!fresh || UI.TEST) { draw(); return; }
      UI.setBusy(true);
      UI.afterLayout(main, () => setTimeout(() => { UI.clearBusy(); if (UI.screen() === 'shop' && main.isConnected && !$('#shop', main)) draw(); }, 0));
    },
    update() { if (UI.isBusy()) return; renderCol(); UI.shell.renderRacks(); renderShop(); },
    unmount() { clearFx(); },
  });

  // ================================================================== the open Booster Pack
  const packRow = (run) => (run && run.pack ? C.pack(run.pack.id) : null);
  /** Where keyboard focus is in the open pack, as a selector that finds the same control once the pack is drawn anew
      (a breakpoint, an update), as the Shop's focusKey does: a button by its action and index, an option's art, a card
      of the dealt hand by its uid, or the hand group. */
  const packFocusKey = (n) => {
    if (!n || !n.closest || !n.closest('.pack-view')) return null;
    const q1 = (v) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(v)) : String(v));
    if (n.dataset.action) return `.pack-view [data-action="${q1(n.dataset.action)}"]${n.dataset.index != null ? `[data-index="${q1(n.dataset.index)}"]` : ''}`;
    if (n.dataset.optArt != null) return `.pack-view [data-opt-art="${q1(n.dataset.optArt)}"]`;
    if (n.dataset.uid) return `#hand .card[data-uid="${q1(n.dataset.uid)}"]`;
    if (n.id === 'hand') return '#hand';
    return null;
  };
  const dealsHand = (run) => !!(run && run.pack && ((run.pack.hand && run.pack.hand.length) || (packRow(run) || {}).dealsHand));
  const handEl = () => $('#hand');
  const handNodes = () => { const h = handEl(); return h ? $$('.card', h) : []; };
  const packSelected = () => { const run = R(); const p = run && run.pack; return p && Array.isArray(p.hand) ? p.hand.filter((u) => S.sel.has(u)) : []; };
  const canPick = (i) => q('canPackPick', i, packSelected()) || { ok: false, error: '' };
  const firstOpen = (p) => { const k = (p.options || []).findIndex((o) => o && !o.picked); return k < 0 ? 0 : k; };
  function optionHTML(o, i, p) {
    const info = optionInfo(o);
    const isCard = o.kind === 'card' && o.card;
    const ed = isCard ? o.card.edition : o.edition;
    const face = isCard ? cardFaceHTML(o.card) : faceHTML(info, ed);
    const edCls = ed ? ' ed-' + esc(ed) : '';
    const edPill = !isCard && ed && edRow(ed) ? `<span class="tag ${edTone(ed)} ed-pill" aria-hidden="true">${esc(edName(ed))}</span>` : '';
    if (o.picked) {
      return `<div class="pk-opt is-picked" role="listitem" data-opt="${i}" aria-label="${esc(`${info.name}, ${info.done.toLowerCase()}`)}"><div class="pk-art"><span class="${isCard ? 'card' : 'jk'} pk-face${edCls}" aria-hidden="true">${layers(face, i + 1)}</span></div><span class="tag t-plum pk-done">${esc(info.done)}</span></div>`;
    }
    const faceBtn = `<button class="${isCard ? 'card' : 'jk'} pk-face${edCls}" type="button" data-opt-art="${i}" aria-label="${esc(`${info.name}, ${info.kind}`)}" aria-describedby="pkDetail">${layers(face, i + 1)}</button>`;
    const can = canPick(i);
    const cur = S.cur === i;
    return `<div class="pk-opt${cur ? ' is-cur' : ''}${can.ok ? '' : ' is-blocked'}" role="listitem" data-opt="${i}"><div class="pk-art">${faceBtn}${edPill}</div><button class="btn ${can.ok ? (cur ? 'b-ember' : 'b-cream') : 'b-cream'} pk-pick" type="button" data-action="pack-pick" data-index="${i}"${can.ok ? '' : ` aria-disabled="true" data-why="${esc(can.error || '')}"`} aria-label="${esc(`${info.verb} ${info.name}`)}">${esc(info.verb)}</button></div>`;
  }
  function detailHTML(p) {
    const i = S.cur;
    const o = p.options[i];
    if (!o) return '<p class="copy k-dim pd-text">Nothing left to pick in this pack.</p>';
    const info = optionInfo(o);
    const can = o.picked ? { ok: true } : canPick(i);
    const sel = packSelected().length;
    const row = CONS.includes(o.kind) ? C.consumable(o.kind, o.id) : null;
    const usesCards = !!(row && Array.isArray(row.select) && row.select[1] > 0);
    const lines = info.lines.slice();
    // a "this Blind" effect picked from a pack waits for the next Blind (SPEC 2.9)
    if (row && (row.hands || row.discards || row.handSize) && !R().blind) lines.push('From a pack, it counts in your next Blind.');
    let status = '';
    if (o.picked) status = `<p class="copy pd-ok">${esc(info.done)}.</p>`;
    else if (!can.ok) status = `<p class="copy pd-why">${esc(can.error || '')}</p>`;
    else if (usesCards && sel) status = `<p class="copy pd-ok">${esc(`Ready: it acts on your ${sel} selected ${UI.plural(sel, 'card')}.`)}</p>`;
    return `<div class="pd-head"><b class="pd-name">${esc(info.name)}</b><span class="pd-kind ${info.kindCls}">${esc(info.kind)}</span></div><p class="copy pd-text">${rich(info.text)}</p>${lines.map((l) => `<p class="copy pd-line">${rich(l)}</p>`).join('')}${status}`;
  }
  function packCardHTML(c, i) {
    const sel = S.sel.has(c.uid);
    return `<button class="card${c.edition ? ' ed-' + esc(c.edition) : ''}" type="button" data-uid="${esc(c.uid)}" aria-pressed="${sel}" aria-label="${esc(cardLabel(c))}">${layers(cardFaceHTML(c), i)}</button>`;
  }
  function deckCount(run) {
    const p = run.pack;
    const total = run.cards.length;
    return dealsHand(run) && p && Array.isArray(p.draw) ? `${p.draw.length}/${total}` : `${total}/${total}`;
  }
  function packHTML(run) {
    const p = run.pack, row = packRow(run) || { name: 'Booster Pack' };
    const tone = PACK_TONE[p.kind] || PACK_TONE.card;
    const hand = dealsHand(run);
    const back = UI.spriteHTML('back:' + (run.deckId || 'firstissue'), { kind: 'back' });
    const total = (p.options || []).length;
    // the reading plate sits under the cards, or beside the dealt hand when there is one (its "select" line
    // belongs next to the cards it asks for, and the stage keeps its height for the options)
    const detail = `<div class="panel deep pk-detail" id="pkDetail">${detailHTML(p)}</div>`;
    const deck = `<div class="deck pk-deck"><button class="deck-btn" type="button" data-action="open-deck" aria-label="${esc(`Deck, ${run.cards.length} cards`)}"><span class="stack" aria-hidden="true">${back}${back}${back}</span><span class="deck-count n g-cream" id="pkDeckN">${numHTML(deckCount(run), 'S', 'cream')}</span></button></div>`;
    const handZone = `<div class="pk-handzone">${detail}<div class="pk-handcol"><span class="lbl on-room pk-hand-lbl" id="pkHandLbl">Your hand for this pack</span><div class="hand pk-hand" id="hand" role="group" aria-labelledby="pkHandLbl">${(p.hand || []).map((u) => q('getCard', u)).filter(Boolean).map(packCardHTML).join('')}</div></div>${deck}</div>`;
    return `<section class="pack-view k-${esc(p.kind)}${hand ? ' has-hand' : ''}" aria-labelledby="packTitle">
        <div class="pk-stage">
          <div class="pk-head">
            <h2 class="tag ${tone.pill}" id="packTitle">${esc(row.name)}</h2>
            <span class="pk-picks"><span class="lbl">Picks left</span><span class="n g-cream" id="pkPicks">${numHTML(String(p.picksLeft), 'L', 'cream')}</span></span>
            <button class="btn b-ghost pk-skip" type="button" data-action="pack-skip" aria-label="Skip the rest of this pack">Skip</button>
          </div>
          <div class="pk-opts${total > 4 ? ' is-many' : ''}" role="list" aria-label="${esc(row.name)}" style="--n:${Math.max(1, total)}">${(p.options || []).map((o, i) => optionHTML(o, i, p)).join('')}</div>
          ${hand ? '' : detail}
        </div>
        ${hand ? handZone : deck}
      </section>`;
  }
  /** Redraw the parts of the pack that change after a pick or a selection: options, picks left, the plate. */
  function refreshPack() {
    const run = R(), p = run && run.pack;
    const box = $('.pack-view');
    if (!p || !box) return;
    if (S.cur < 0 || !p.options[S.cur] || p.options[S.cur].picked) S.cur = firstOpen(p);
    const opts = $('.pk-opts', box);
    const hadFocus = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('.pk-opts'));
    if (opts) opts.innerHTML = p.options.map((o, i) => optionHTML(o, i, p)).join('');
    const det = $('#pkDetail');
    if (det) det.innerHTML = detailHTML(p);
    const pk = $('#pkPicks');
    if (pk) { pk.innerHTML = numHTML(String(p.picksLeft), 'L', 'cream'); punch(pk, 380, 1.2); }
    const dn = $('#pkDeckN');
    if (dn) dn.innerHTML = numHTML(deckCount(run), 'S', 'cream');
    // the picked option's button is gone: keyboard focus moves on to the current option
    if (hadFocus || document.activeElement === document.body) { const n = $(`.pk-opt[data-opt="${S.cur}"] .pk-pick`, box) || $('.pk-skip', box); if (n) UI.focusQuiet(n); }
  }
  /** Update only what a selection changes: which options can be used, their buttons, the reading plate. */
  function refreshChecks() {
    const run = R(), p = run && run.pack;
    if (!p) return;
    $$('.pk-opt').forEach((n) => {
      const i = Number(n.dataset.opt);
      const o = p.options[i];
      if (!o || o.picked) return;
      const can = canPick(i);
      n.classList.toggle('is-blocked', !can.ok);
      n.classList.toggle('is-cur', S.cur === i);
      const b = $('.pk-pick', n);
      if (!b) return;
      b.className = `btn ${can.ok && S.cur === i ? 'b-ember' : 'b-cream'} pk-pick`;
      if (can.ok) { b.removeAttribute('aria-disabled'); delete b.dataset.why; } else { b.setAttribute('aria-disabled', 'true'); b.dataset.why = can.error || ''; }
    });
    const det = $('#pkDetail');
    if (det) det.innerHTML = detailHTML(p);
  }
  function setCurrent(i) {
    const run = R(), p = run && run.pack;
    if (!p || !p.options[i] || i === S.cur) return;
    S.cur = i;
    refreshChecks();
  }
  function toggleCard(uid) {
    const run = R(), p = run && run.pack;
    if (!p || UI.isBusy() || !p.hand.includes(uid)) return;
    const n = $(`#hand .card[data-uid="${uid}"]`);
    if (S.sel.has(uid)) { S.sel.delete(uid); UI.sfx('deselect', { index: S.sel.size }); }
    else if (S.sel.size < 5) { S.sel.add(uid); UI.sfx('select', { index: S.sel.size }); }
    else { if (n) anim(n, [{ transform: 'translateX(0)' }, { transform: `translateX(${-PX()}px)` }, { transform: `translateX(${PX()}px)` }, { transform: 'translateX(0)' }], { d: 180, add: true }); UI.announce('Select up to 5 cards.'); return; }
    if (n) { n.setAttribute('aria-pressed', String(S.sel.has(uid))); if (S.sel.has(uid)) sweep(n, 560, 60); }
    refreshChecks();
    sayPicked(uid, S.sel.has(uid), n);
  }
  const PSAY = { timer: 0, on: [], off: [] };
  function hushPicked() { clearTimeout(PSAY.timer); PSAY.timer = 0; PSAY.on.length = 0; PSAY.off.length = 0; }
  function sayPicked(uid, on, n) {
    if (!(n && document.activeElement === n)) {
      const list = on ? PSAY.on : PSAY.off, other = on ? PSAY.off : PSAY.on;
      const k = other.indexOf(uid);
      if (k >= 0) other.splice(k, 1); else list.push(uid);
    }
    clearTimeout(PSAY.timer);
    PSAY.timer = setTimeout(() => {
      const ons = PSAY.on.splice(0), offs = PSAY.off.splice(0);
      PSAY.timer = 0;
      if (UI.screen() !== 'pack' || UI.isBusy()) return;
      const words = (us) => UI.listJoin(us.map((u) => q('getCard', u)).filter(Boolean).map(cardName));
      const parts = [];
      if (ons.length) parts.push(`${words(ons)} selected.`);
      if (offs.length) parts.push(`${words(offs)} put back.`);
      const k = S.sel.size;
      parts.push(k ? `${k} ${UI.plural(k, 'card')} chosen.` : 'No cards chosen.');
      UI.announce(parts.join(' '));
    }, 260);
  }
  function selectCards(uids) {
    const run = R(), p = run && run.pack;
    S.sel = new Set((uids || []).filter((u) => p && p.hand.includes(u)).slice(0, 5));
    handNodes().forEach((n) => n.setAttribute('aria-pressed', String(S.sel.has(n.dataset.uid))));
    refreshChecks();
  }
  /** Redraw the dealt hand from the run: cards that stay glide to their places, new ones deal in. */
  function redrawHand(o = {}) {
    const hand = handEl(), run = R(), p = run && run.pack;
    if (!hand || !p) return [];
    const old = new Map(handNodes().map((n) => [n.dataset.uid, n.getBoundingClientRect()]));
    S.sel = new Set([...S.sel].filter((u) => p.hand.includes(u)));
    hand.innerHTML = p.hand.map((u) => q('getCard', u)).filter(Boolean).map(packCardHTML).join('');
    if (T().layoutHand) T().layoutHand();
    const fresh = [];
    handNodes().forEach((n) => {
      const a = old.get(n.dataset.uid);
      if (!a) { fresh.push(n); return; }
      const b = n.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) anim(n, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { d: 520, e: EASE.spring, add: true, fill: 'backwards' });
    });
    if (fresh.length && T().dealIn) T().dealIn(fresh, o.delay || 0);
    const dn = $('#pkDeckN');
    if (dn) dn.innerHTML = numHTML(deckCount(run), 'S', 'cream');
    return fresh;
  }
  function bindPack(box) {
    if (!box) return;
    box.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      const card = t.closest('#hand .card');
      if (card) { toggleCard(card.dataset.uid); return; }
      const art = t.closest('[data-opt-art]');
      if (art) { UI.sfx('flip'); setCurrent(Number(art.dataset.optArt)); const o = $(`.pk-opt[data-opt="${art.dataset.optArt}"]`); if (o) punch($('.pk-art', o), 260, 1.04); }
    });
    // the plate follows the pointer and the keyboard
    box.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const o = e.target.closest && e.target.closest('.pk-opt:not(.is-picked)');
      if (o) setCurrent(Number(o.dataset.opt));
    });
    box.addEventListener('focusin', (e) => { const o = e.target.closest && e.target.closest('.pk-opt:not(.is-picked)'); if (o) setCurrent(Number(o.dataset.opt)); });
  }
  /** The pack opens on the stage: the pack flies in from where it was bought (or the Tag that gave it),
      bursts in a flash of its own light, and its cards deal out on the spring; a dealt hand follows. */
  function openingBeat(box, props) {
    const run = R(), p = run.pack;
    const tone = PACK_TONE[p.kind] || PACK_TONE.card;
    const opts = $$('.pk-opt', box);
    const row = $('.pk-opts', box);
    if (!UI.motionOK() || !row) {
      // no flight and no burst, but the pack still tears open and its hand is still dealt (sound is not motion)
      UI.sfx('pack');
      if (handNodes().length) UI.sfx('deal', { index: 0, delay: UI.dur(120) });
      if (props.ghost && props.ghost.isConnected) props.ghost.remove();
      anim(box, [{ opacity: 0 }, { opacity: 1 }], { d: 240, always: true });
      return 0;
    }
    const target = row.getBoundingClientRect();
    const mid = { left: target.left + target.width / 2 - 2, top: target.top + target.height * 0.4 - 2, width: 4, height: 4 };
    let t0 = 120;
    const g = props.ghost && props.ghost.isConnected ? props.ghost : null;
    if (g) {
      const r = g.getBoundingClientRect();
      const to = { left: mid.left - r.width / 2 + 2, top: mid.top - r.height / 2 + 2, width: r.width, height: r.height };
      const a = flyTo(g, to, { d: 440, scale: 1.08, arc: 24, tilt: -4, e: EASE.inOut });
      void a;
      t0 = 440;
    }
    UI.sfx('pack');
    // the burst: a flash of the room, a ring in the pack's light, sparks in its colours
    later(t0, () => {
      const c = { x: mid.left + 2, y: mid.top + 2 };
      if (T().ring) { T().ring(c.x, c.y, 120 * PX(), 820, 0, tone.ring); T().ring(c.x, c.y, 70 * PX(), 640, 90, '255, 226, 190'); }
      if (T().burst) T().burst(c.x, c.y, tone.sparks.concat(SPARK.cream), 26, 1.25, [1, 2]);
      if (row) roomFlash(row, 0.7);
    });
    opts.forEach((n, i) => {
      const r = n.getBoundingClientRect();
      const dx = Math.round(mid.left + 2 - (r.left + r.width / 2)), dy = Math.round(mid.top + 2 - (r.top + r.height / 2));
      anim(n, [
        { transform: `translate(${dx}px, ${dy}px) scale(.55)`, opacity: 0 },
        { transform: `translate(${dx}px, ${dy}px) scale(.55)`, opacity: 1, offset: 0.02 },
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      ], { d: 620, delay: t0 + 40 + i * 70, e: EASE.spring, fill: 'backwards' });
      const art = $('.pk-face', n);
      if (art) sweep(art, 620, t0 + 380 + i * 70);
    });
    $$('.pk-pick, .pk-done', box).forEach((b, i) => anim(b, [{ opacity: 0, transform: `translateY(${3 * PX()}px)` }, { opacity: 1, transform: 'none' }], { d: 420, delay: t0 + 360 + i * 70, e: EASE.out, fill: 'backwards' }));
    $$('.pk-head > *, .pk-detail', box).forEach((n, i) => anim(n, [{ opacity: 0, transform: `translateY(${-3 * PX()}px)` }, { opacity: 1, transform: 'none' }], { d: 420, delay: 60 + i * 50, e: EASE.out, fill: 'backwards' }));
    later(t0 + 60, () => UI.sfx('deal'));
    const cards = handNodes();
    if (cards.length && T().dealIn) T().dealIn(cards, t0 + 260 + opts.length * 40);
    return t0 + 420 + opts.length * 70;
  }
  function mountPack(main, props = {}) {
    const run = R(), p = run && run.pack;
    if (!p) { main.innerHTML = '<div class="shop-empty"><p class="copy">No Booster Pack is open.</p></div>'; return; }
    // a pack is known by its cards, which never change while it is open (only their picked flags do)
    const key = `${run.seed}:${p.id}:${p.options.map((o) => (o.card ? o.card.uid : o.id)).join(',')}`;
    const fresh = S.packKey !== key;
    if (fresh) { S.packKey = key; S.sel.clear(); S.picks = 0; S.cur = firstOpen(p); }
    if (S.cur < 0 || !p.options[S.cur]) S.cur = firstOpen(p);
    main.innerHTML = packHTML(run);
    // the compact top bar shows the hand panel in a Planet Pack, where a pick levels a hand there (50-shop.css)
    document.body.dataset.pack = p.kind || '';
    const box = $('.pack-view', main);
    bindPack(box);
    patchCol();
    if (T().layoutHand && $('#hand', box)) T().layoutHand();
    if (UI.shell && UI.shell.placeLight) UI.shell.placeLight();
    if (fresh) {
      UI.setBusy(true);
      const row = packRow(run) || {};
      const n = p.options.length;
      UI.announce(`${row.name || 'Booster Pack'} opened: ${n} ${UI.plural(n, 'card')}, pick ${p.picksLeft}.${dealsHand(run) ? ` Your hand for this pack has ${p.hand.length} cards.` : ''}`);
      // the opening measures where the pack's cards landed: it starts once the browser has laid them out
      UI.afterLayout(box, () => {
        const ms = box.isConnected ? openingBeat(box, props) : 0;
        later(ms, () => UI.clearBusy());
        if (!UI.TEST) later(ms, () => { const b = $('.pk-opt:not(.is-blocked) .pk-pick') || $('.pk-pick'); if (b && !UI.topDialog() && (!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected)) UI.focusQuiet(b); });
      });
    } else if (props.ghost && props.ghost.isConnected) props.ghost.remove();
  }
  /** Take option i. Each kind has its beat: a card flies to the deck, a Joker to its rack, a Planet card levels
      a hand in the hand panel, a Tarot or Spectral card acts on the selected cards of the dealt hand. */
  function pick(i) {
    const run = R(), p = run && run.pack;
    if (!p || run.phase !== 'pack' || UI.isBusy()) return;
    const o = p.options[i];
    if (!o || o.picked) return;
    const sel = packSelected();
    const chk = q('canPackPick', i, sel);
    if (chk && !chk.ok) { UI.error(chk.error); return; }
    const optEl = $(`.pk-opt[data-opt="${i}"]`);
    const face = optEl && $('.pk-face', optEl);
    const rect = face ? face.getBoundingClientRect() : null;
    const ghost = face ? flyer(face, rect) : null;
    const before = snapshot(run);
    const hand0 = p.hand.slice();
    const info = optionInfo(o);
    const res = UI.call('packPick', i, sel);
    if (res && res.ok) hushPicked();
    if (!res || !res.ok) { if (ghost) ghost.remove(); return; }
    UI.hideTip();
    UI.sfx('pick', { index: S.picks++ });
    UI.setBusy(true);
    S.sel.clear();
    if (face) face.style.opacity = '0';
    let wait = 420;
    if (o.kind === 'card') wait = cardPicked(ghost, o, info);
    else if (o.kind === 'joker') wait = jokerPicked(ghost, res, info, before);
    else wait = cardUsed(ghost, o, res, info, before, hand0);
    const ev = jokerEvents(res.jokerEvents, Math.min(wait, 520));
    later(Math.max(wait, ev), () => {
      UI.clearBusy();
      const now = R();
      if (res.closed || !now || now.phase !== 'pack') { finishPack(); return; }
      refreshPack();
      renderCol();
    });
  }
  function finishPack() {
    UI.setBusy(true);
    $$('.pack-view .pk-opt, .pack-view .pk-hand .card').forEach((n, i) => anim(n, [{ opacity: 1 }, { opacity: 0, transform: `translateY(${6 * PX()}px)` }], { d: 200, delay: i * 25, e: EASE.out, fill: 'forwards' }));
    later(UI.motionOK() ? 240 : 0, () => { UI.clearBusy(); UI.refresh(); });
  }
  function cardPicked(ghost, o, info) {
    const deck = $('.pk-deck .stack');
    const to = deck && deck.offsetParent ? deck.getBoundingClientRect() : { left: innerWidth - 70, top: innerHeight - 90, width: 41 * PX(), height: 55 * PX() };
    if (ghost) {
      const a = flyTo(ghost, to, { d: 560, arc: 20, tilt: 6, fade: false });
      const done = () => { const d = $('.pk-deck'); if (d) { punch(d, 380, 1.08); burstAt(d, SPARK.cream, 10, 0.6); } const dn = $('#pkDeckN'); const run = R(); if (dn && run) dn.innerHTML = numHTML(deckCount(run), 'S', 'cream'); };
      if (a) a.finished.then(done, done); else done();
    }
    // the card flying into the deck says it; the live region says it aloud (no toast over the pack)
    if (!ghost) UI.toast(`${info.name} joins your deck.`, 'good', { say: false });
    UI.announce(`${info.name} joins your deck for the rest of the run.`);
    return 600;
  }
  function jokerPicked(ghost, res, info, before) {
    UI.shell.renderRacks();
    const run = R();
    const uid = res.uid || run.jokers.map((j) => j.uid).find((u) => !before.jokers.includes(u));
    landGhost(ghost, uid && rackJoker(uid), SPARK.pink, 600);
    // the Joker landing in its rack says it (a toast would cover the pack's head and picks)
    if (!ghost) UI.toast(`${info.name} joins your Jokers.`, 'good', { say: false });
    UI.announce(`${info.name} joins your Jokers.`);
    return 660;
  }
  /** A Tarot, Planet or Spectral card used from the pack (or from a slot while the pack is open). */
  function cardUsed(ghost, o, res, info, before, hand0) {
    const eff = res.effect || {};
    const msg = T().describeEffect ? T().describeEffect({ name: info.name }, eff) : `${info.name} used.`;
    UI.sfx('use');
    if (eff.handId && eff.level && o.kind === 'planet') {
      // the card flies into the hand panel, then the level ticks over
      const panel = $('.w-hand');
      if (ghost && panel) flyTo(ghost, panel.getBoundingClientRect(), { d: 460, scale: 0.4, fade: true, arc: 10, tilt: 4 });
      else if (ghost) ghost.remove();
      const from = Math.max(1, eff.level - (Number(eff.levels) || 1));
      later(ghost ? 380 : 0, () => levelBeat(eff.handId, from, eff.level, { hold: 500 }));
      // the level ticks over in the hand panel; the sentence goes to the live region rather than over the pack
      UI.announce(msg);
      return (ghost ? 380 : 0) + 1300;
    }
    // the card glows and is spent: it rises, flares and fades where it was
    if (ghost) {
      const p = PX();
      const a = anim(ghost, [
        { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'brightness(1)' },
        { transform: `translateY(${-10 * p}px) scale(1.06)`, opacity: 1, filter: 'brightness(1.5)', offset: 0.35 },
        { transform: `translateY(${-18 * p}px) scale(1.1)`, opacity: 0, filter: 'brightness(1.8)' },
      ], { d: 520, e: EASE.out, fill: 'forwards' });
      ringAt(ghost, '205, 168, 255', 70, 700, 120);
      burstAt(ghost, SPARK.vio, 14, 0.9);
      if (a) { const kill = () => ghost.remove(); a.finished.then(kill, kill); } else ghost.remove();
    }
    UI.toast(msg, 'good', 3200);
    return 360 + afterEffect(eff, before, hand0, 300);
  }
  /** What an effect did to the hand, the racks and the money, shown after delay. Returns base ms. */
  function afterEffect(eff, before, hand0, delay = 0) {
    const destroyed = (eff.destroyed || []).filter((u) => hand0.includes(u));
    destroyed.forEach((u) => { const n = $(`#hand .card[data-uid="${u}"]`); if (n) anim(n, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: `translateY(${-10 * PX()}px) scale(.8)` }], { d: 360, delay: delay * 0.5, e: EASE.inOut, fill: 'forwards' }); });
    later(delay + (destroyed.length ? 200 : 0), () => {
      const now = R();
      if (!now) return;
      UI.shell.renderRacks();
      renderCol();
      if (before && now.money !== before.money) moneyBeat(before.money);
      if (handEl()) {
        redrawHand();
        const touched = new Set([].concat(eff.uids || [], eff.created || [], eff.sourceUid ? [eff.sourceUid] : [], eff.sourceUids || []));
        touched.forEach((u) => { const n = $(`#hand .card[data-uid="${u}"]`); if (n) { sweep(n, 640); burstAt(n, ['#FFF3E0', '#CDA8FF', '#FFD29C'], 10, 0.8); } });
      }
      if (before) {
        now.jokers.filter((j) => !before.jokers.includes(j.uid)).forEach((j) => landed(rackJoker(j.uid), SPARK.pink));
        now.jokers.filter((j) => before.jokers.includes(j.uid) && (j.edition || null) !== (before.eds[j.uid] || null)).forEach((j) => { const n = rackJoker(j.uid); landed(n, SPARK.ember); ringAt(n, '255, 210, 156', 60); });
        now.consumables.filter((k) => !before.cons.includes(k.uid)).forEach((k) => landed(rackCons(k.uid), SPARK.vio));
      }
      if (eff.handId && eff.level) levelBeat(eff.handId, Math.max(1, eff.level - (Number(eff.levels) || 1)), eff.level);
    });
    return delay + (eff.handId && eff.level ? 1300 : 700);
  }
  function skipPack() {
    const run = R();
    if (!run || run.phase !== 'pack' || UI.isBusy()) return;
    const res = UI.call('packSkip');
    if (!res || !res.ok) return;
    UI.sfx('skip');
    UI.announce('Pack skipped.');
    UI.setBusy(true);
    $$('.pack-view .pk-opt, .pack-view .pk-hand .card').forEach((n, i) => anim(n, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: `translateY(${10 * PX()}px)` }], { d: 220, delay: i * 25, e: EASE.out, fill: 'forwards' }));
    later(UI.motionOK() ? 260 : 0, () => { UI.clearBusy(); UI.refresh(); });
  }
  UI.register('pack', {
    shell: true,
    mount(main, props) { mountPack(main, props || {}); },
    update() {
      if (UI.isBusy()) return;
      const main = shopMain();
      if (!main) return;
      // the pack is drawn anew: keyboard focus stays on the control it was on (final pass, part 3: it fell to the page)
      const key = packFocusKey(document.activeElement);
      renderCol(); UI.shell.renderRacks(); main.innerHTML = packHTML(R()); bindPack($('.pack-view', main)); if (T().layoutHand && $('#hand', main)) T().layoutHand();
      const n = key && $(key, main);
      if (n) UI.focusQuiet(n);
    },
    unmount() { clearFx(); S.sel.clear(); delete document.body.dataset.pack; },
    key(e) {
      const run = R(), p = run && run.pack;
      if (!p) return false;
      if (!UI.shortcuts()) return false;
      if (/^[1-9]$/.test(e.key)) { const u = (p.hand || [])[Number(e.key) - 1]; if (u) { toggleCard(u); return true; } return false; }
      return false;
    },
  });

  // ================================================================== the racks in the Shop and in a pack: this file's sheets
  function jokerSheet(uid) {
    const run = R();
    const j = run && run.jokers.find((x) => x.uid === uid);
    if (!j) return null;
    const row = C.joker(j.id);
    const idx = run.jokers.indexOf(j);
    const text = q('jokerText', uid) || row.text || '';
    const ed = j.edition ? edRow(j.edition) : null;
    const sell = q('jokerSellValue', uid) || 0;
    const canSell = q('canSell') || { ok: false };
    const body = el('div');
    body.innerHTML = `<p class="s-text copy">${rich(text)}</p>${ed ? `<p class="s-line copy"><span class="k-name">${esc(ed.name)}:</span> ${rich(ed.jokerText || ed.text || '')}</p>` : ''}`;
    let h = null;
    const left = el('button', { type: 'button', class: 'btn b-ghost', 'aria-label': `Move ${row.name} left`, disabled: idx <= 0 });
    const right = el('button', { type: 'button', class: 'btn b-ghost', 'aria-label': `Move ${row.name} right`, disabled: idx >= run.jokers.length - 1 });
    // moving a Joker keeps its sheet open beside it, with focus on the arrow just pressed (never on Sell)
    const mv = (dir) => {
      const order = run.jokers.map((x) => x.uid);
      const k = order.indexOf(uid), to = k + dir;
      if (to < 0 || to >= order.length) return;
      [order[k], order[to]] = [order[to], order[k]];
      const res = UI.call('reorderJokers', order);
      if (!res.ok) return;
      UI.shell.renderRacks();
      UI.sfx('flip');
      UI.announce(`${row.name} moved ${dir < 0 ? 'left' : 'right'}.`);
      afterRack();
      const now = run.jokers.findIndex((x) => x.uid === uid);
      left.disabled = now <= 0;
      right.disabled = now >= run.jokers.length - 1;
      if (h) h.reanchor(rackJoker(uid));
      UI.focusQuiet(dir < 0 ? (left.disabled ? right : left) : (right.disabled ? left : right));
    };
    if (run.jokers.length > 1) {
      const move = el('div', { class: 's-move' });
      left.innerHTML = `${UI.iconHTML('arrow-left', 'light')}<span>Left</span>`;
      left._onAct = () => mv(-1);
      right.innerHTML = `<span>Right</span>${UI.iconHTML('arrow-right', 'light')}`;
      right._onAct = () => mv(1);
      move.append(left, right);
      body.append(move);
    }
    h = UI.sheet({
      title: row.name, kind: `${C.rarity(row.rarity)} Joker${ed ? ', ' + ed.name : ''}`, kindCls: 'rar-' + (row.rarity || 'common'), body, anchor: rackJoker(uid),
      actions: [{ label: `Sell $${sell}`, cls: 'b-pink', action: 'sell-joker', data: { uid }, why: canSell.ok ? '' : canSell.error || "You can't sell right now.", onClick: (hh) => { hh.close(); sellJoker(uid); } }],
    });
    return h;
  }
  function consSheet(uid) {
    const run = R();
    const k = run && run.consumables.find((x) => x.uid === uid);
    if (!k) return null;
    const info = q('consumableInfo', uid) || {};
    const row = C.consumable(k.kind, k.id);
    const inPack = run.phase === 'pack';
    const sel = inPack ? packSelected() : [];
    const can = q('canUseConsumable', uid, sel) || { ok: false, error: "You can't use that right now." };
    const canSell = q('canSell') || { ok: false };
    const sell = q('consumableSellValue', uid) || info.sell || 0;
    const range = info.select || row.select;
    let need = '';
    if (Array.isArray(range) && range[1] > 0) need = range[0] === range[1] ? `Select ${range[0]} ${UI.plural(range[0], 'card')} ${inPack ? 'in the pack\'s hand' : 'in your hand'} first.` : `Select ${range[0]} to ${range[1]} cards ${inPack ? 'in the pack\'s hand' : 'in your hand'} first.`;
    const where = (info.where || row.where) === 'blind' ? ', during a Blind' : '';
    const body = `<p class="s-text copy">${rich(info.text || row.text || '')}</p>${need ? `<p class="s-line copy k-dim">${esc(need)}</p>` : ''}${!can.ok && can.error ? `<p class="s-why copy">${esc(can.error)}</p>` : ''}`;
    return UI.sheet({
      title: info.name || row.name, kind: (KIND_WORD[k.kind] || 'Card') + where, kindCls: 'kind-' + k.kind, body, anchor: rackCons(uid),
      actions: [
        { label: 'Use', cls: 'b-ember', action: 'use-consumable', data: { uid }, why: can.ok ? '' : can.error || "You can't use that right now.", onClick: (h) => { h.close(); useConsumable(uid); } },
        { label: `Sell $${sell}`, cls: 'b-pink', action: 'sell-consumable', data: { uid }, why: canSell.ok ? '' : canSell.error || "You can't sell right now.", onClick: (h) => { h.close(); sellConsumable(uid); } },
      ],
    });
  }
  const refocusRack = (kind, at) => { if (T().refocusRack) T().refocusRack(kind, at); };
  /** After the racks changed in the Shop or a pack: prices, slots and reasons may have changed. */
  function afterRack() {
    if (UI.screen() === 'shop') renderShop();
    else if (UI.screen() === 'pack') refreshChecks();
  }
  function sellJoker(uid) {
    const run = R();
    const j = run && run.jokers.find((x) => x.uid === uid);
    if (!j || UI.isBusy()) return;
    const node = rackJoker(uid);
    const from = run.money, at = run.jokers.indexOf(j);
    const res = UI.call('sellJoker', uid);
    if (!res || !res.ok) return;
    UI.sfx('sell');
    if (node && T().popNum) T().popNum(node, '+$' + fmt(res.money), 'money');
    UI.announce(`Sold ${C.joker(j.id).name} for $${fmt(res.money)}.`);
    leaveRack(node, () => { UI.shell.renderRacks(); renderCol(); moneyBeat(from); afterRack(); jokerEvents(res.jokerEvents, 60); refocusRack('joker', at); });
  }
  function sellConsumable(uid) {
    const run = R();
    const k = run && run.consumables.find((x) => x.uid === uid);
    if (!k || UI.isBusy()) return;
    const node = rackCons(uid);
    const from = run.money, at = run.consumables.indexOf(k);
    const res = UI.call('sellConsumable', uid);
    if (!res || !res.ok) return;
    UI.sfx('sell');
    if (node && T().popNum) T().popNum(node, '+$' + fmt(res.money), 'money');
    UI.announce(`Sold ${C.consumable(k.kind, k.id).name} for $${fmt(res.money)}.`);
    leaveRack(node, () => { UI.shell.renderRacks(); renderCol(); moneyBeat(from); afterRack(); refocusRack('cons', at); });
  }
  /** Use a Tarot, Planet or Spectral card from its slot in the Shop or on an open pack's dealt hand. */
  function useConsumable(uid) {
    const run = R();
    const k = run && run.consumables.find((x) => x.uid === uid);
    if (!k || UI.isBusy()) return;
    const sel = run.phase === 'pack' ? packSelected() : [];
    const can = q('canUseConsumable', uid, sel);
    if (!can || !can.ok) { UI.error((can && can.error) || "You can't use that right now."); return; }
    const info = q('consumableInfo', uid) || { name: C.consumable(k.kind, k.id).name };
    const node = rackCons(uid), at = run.consumables.indexOf(k);
    const before = snapshot(run);
    const hand0 = run.pack && Array.isArray(run.pack.hand) ? run.pack.hand.slice() : [];
    const range = info.select || C.consumable(k.kind, k.id).select;
    const res = UI.call('useConsumable', uid, sel);
    if (!res || !res.ok) return;
    hushPicked();
    UI.sfx('use');
    // only a card that worked on the selected cards uses the selection up
    if (Array.isArray(range) && range[1] > 0) S.sel.clear();
    const eff = res.effect || {};
    const msg = T().describeEffect ? T().describeEffect(info, eff) : `${info.name} used.`;
    UI.toast(msg, 'good', 3200);
    if (node) { ringAt(node, '205, 168, 255', 60, 640); burstAt(node, SPARK.vio, 12, 0.8); }
    leaveRack(node, () => {
      if (res.lost || UI.screenForPhase(phase()) !== UI.screen()) { UI.refresh(); return; }
      afterEffect(eff, before, hand0, 0);
      later(40, () => { afterRack(); refocusRack('cons', at); });
      jokerEvents(res.jokerEvents, 200);
    });
  }
  // a click on a rack item in the Shop or an open pack opens this file's sheet (the table's would not update
  // the Shop or use the pack's dealt hand); a drag that just ended keeps its click swallowed as before
  document.addEventListener('click', (e) => {
    const scr = UI.screen();
    if (scr !== 'shop' && scr !== 'pack') return;
    const t = e.target;
    if (!t || !t.closest || t.closest('#dialogs')) return;
    const jk = t.closest('#racks .jk[data-joker-uid], #racks .jk[data-consumable-uid]');
    if (!jk) return;
    if (Date.now() < UI.drag.suppressUntil) return;
    e.stopPropagation();
    if (UI.isBusy()) return;
    UI.sfx('button');
    if (jk.dataset.jokerUid) jokerSheet(jk.dataset.jokerUid); else consSheet(jk.dataset.consumableUid);
  }, true);
  // a drag-reorder in the Shop can re-price the Voucher (a Joker's rule): redraw the Shop when the racks change and
  // a price really did. Every renderShop() stamps the prices it drew, so a purchase (which redraws the Shop itself)
  // never sets off a second rebuild; and no rebuild lands under a press, which would swallow its click
  let rackTimer = 0, pressing = false;
  document.addEventListener('pointerdown', () => { pressing = true; }, true);
  const released = () => { pressing = false; };
  document.addEventListener('pointerup', released, true);
  document.addEventListener('pointercancel', released, true);
  document.addEventListener('click', released, true);
  window.addEventListener('blur', released);
  if (typeof MutationObserver === 'function') {
    let racksSeen = null, racksObs = null;
    const check = () => {
      clearTimeout(rackTimer);
      rackTimer = setTimeout(() => {
        const run = R();
        if (!run || !run.shop || UI.screen() !== 'shop') return;
        if (UI.isBusy() || pressing) { check(); return; }
        const sig = shopSig(run);
        const box = $('#shop');
        if (box && box.dataset.sig !== sig) renderShop();
      }, 80);
    };
    const watchRacks = () => {
      const racks = UI.shell && UI.shell.el ? UI.shell.el().racks : null;
      if (!racks || racks === racksSeen) return;
      if (racksObs) racksObs.disconnect();
      racksSeen = racks;
      racksObs = new MutationObserver(() => { if (UI.screen() === 'shop') check(); });
      racksObs.observe(racks, { childList: true, subtree: true });
    };
    new MutationObserver(() => watchRacks()).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
  }

  // ================================================================== skipping a Blind: the Tag beat
  /** The Tag token on the skipped Blind pops in lime light. */
  function tagPop(tok) {
    if (!tok) return;
    punch(tok, 520, 1.35);
    ringAt(tok, '196, 242, 110', 64, 760);
    burstAt(tok, SPARK.lime.concat(SPARK.cream), 16, 1);
    later(80, () => UI.sfx('tag'));
  }
  /** What a Tag gave, shown where it landed: money counts up, a new Joker or card lands in its rack, a hand
      gains its level, a Joker's new Edition shines, a waiting Tag joins the strip. */
  function gainBeats(snap, res) {
    const run = R();
    if (!run) return;
    const g = res.gained || {};
    if (run.money !== snap.money) moneyBeat(snap.money);
    run.jokers.filter((j) => !snap.jokers.includes(j.uid)).forEach((j) => landed(rackJoker(j.uid), SPARK.pink));
    run.jokers.filter((j) => snap.jokers.includes(j.uid) && (j.edition || null) !== (snap.eds[j.uid] || null)).forEach((j) => { const n = rackJoker(j.uid); landed(n, SPARK.ember); ringAt(n, '255, 210, 156', 60); });
    run.consumables.filter((k) => !snap.cons.includes(k.uid)).forEach((k, i) => later(i * 120, () => landed(rackCons(k.uid), SPARK.vio)));
    if (g.handId && run.levels && snap.levels) levelBeat(g.handId, snap.levels[g.handId] || 1, run.levels[g.handId] || 1);
    later(60, () => {
      injectWaiting();
      const tok = res.tag && $(`.tags-waiting [data-wait-tag="${res.tag.id}"]`);
      if (tok) { anim(tok, [{ opacity: 0, transform: `translateY(${-6 * PX()}px) scale(.8)` }, { opacity: 1, transform: 'none' }], { d: 560, e: EASE.bouncy, fill: 'backwards' }); ringAt(tok, '196, 242, 110', 50, 640, 120); }
    });
  }
  UI.registerAction('skip-blind', () => {
    const run = R();
    if (!run || run.phase !== 'blind-select' || UI.isBusy()) return;
    const cur = $('.blind-card.is-current');
    const tok = cur && $('.tag-tok', cur);
    const rect = tok ? tok.getBoundingClientRect() : null;
    const snap = snapshot(run);
    const res = UI.call('skipBlind');
    if (!res || !res.ok) return;
    UI.sfx('skip');
    // a Tag that waits says so; one that acted says what it gave
    const waits = !!(res.tag && tagsStatus(R()).some((t) => t.id === res.tag.id && t.state !== 'in-use'));
    const msg = waits ? `${res.tag.name} is waiting. ${res.tag.text || ''}` : T().describeGain ? T().describeGain(res.tag, res.gained) : (res.tag ? res.tag.name : 'Tag');
    // the toast shows what the Tag gave; the live region says it with the skip, in one line
    UI.toast(msg, 'good', { ms: 3600, say: false });
    UI.announce(`Blind skipped. ${msg}`);
    UI.setBusy(true);
    tagPop(tok);
    const ghost = tok && UI.motionOK() ? flyer(tok, rect) : null;
    const go = () => {
      UI.clearBusy();
      const now = R();
      if (now && now.phase === 'pack') { S.packKey = null; UI.show('pack', { from: rect, ghost }); jokerEvents(res.jokerEvents, 700); return; }
      if (ghost) ghost.remove();
      if (UI.screenForPhase(now ? now.phase : null) !== 'blind-select') { UI.refresh(); return; }
      UI.update();
      gainBeats(snap, res);
      jokerEvents(res.jokerEvents, 200);
    };
    if (cur && UI.motionOK()) {
      const a = anim(cur, [{ opacity: 1, transform: `translateY(${-8 * PX()}px)` }, { opacity: 0, transform: `translate(${-10 * PX()}px, ${8 * PX()}px)` }], { d: 300, delay: 160, e: EASE.inOut, fill: 'forwards' });
      if (a) a.finished.then(go, go); else go();
    } else later(0, go);
  });

  // ================================================================== tooltips
  UI.registerTip('.si-face[data-shop-art]', (n) => {
    const run = R();
    const i = Number(n.dataset.shopArt);
    const item = run && run.shop && run.shop.items[i];
    if (!item || item.sold) return null;
    const info = itemInfo(item);
    const can = q('canBuy', i) || { ok: true };
    return UI.tipHTML({ name: info.name, kind: info.kind, kindCls: info.kindCls, text: info.text, lines: info.lines.concat(info.pick ? [info.pick + '.'] : []).concat([`Costs $${fmt(item.price)}.`]), warn: can.ok ? '' : can.error });
  });
  UI.registerTip('[data-own-voucher]', (n) => { const row = C.voucher(n.dataset.ownVoucher); return row ? UI.tipHTML({ name: row.name, kind: 'Voucher, redeemed', kindCls: 'kind-voucher', text: row.text }) : null; });
  UI.registerTip('[data-wait-tag]', (n) => {
    const row = C.tag(n.dataset.waitTag);
    if (!row) return null;
    const st = n.dataset.waitState;
    return UI.tipHTML({ name: row.name, kind: st === 'in-use' ? 'Tag, in use in this Shop' : `Tag, waiting for the ${st === 'next-shop' ? 'next Shop' : 'next Blind'}`, kindCls: 'kind-tag', text: row.text });
  });

  // ================================================================== cleanup, actions, API (the Shop loop plays from core's router)
  // hanging tags belong to the screen that hung them; flying copies remove themselves when they land
  function clearFx() { $$('.hangtag').forEach((n) => n.remove()); }
  UI.registerAction('buy', (b) => buy(Number(b.dataset.index)));
  UI.registerAction('reroll', () => reroll());
  UI.registerAction('leave-shop', () => leaveShop());
  UI.registerAction('pack-pick', (b) => pick(Number(b.dataset.index)));
  UI.registerAction('pack-skip', () => skipPack());

  // crossing a breakpoint (the layout or the pixel size) draws the Shop or the open pack again, as the table redraws
  // its racks: each name plate's text is chosen for the pixel size it is drawn at (00-core.js plateHTML), so a plate
  // drawn at 3 px would clip mid-letter at 2 (final pass, part 2). While something runs (a purchase's flight, a pack's
  // opening) the redraw waits for it to end, as the table's relayout does, rather than being dropped (part 3)
  let rd = 0;
  const redrawForBreakpoint = () => {
    clearTimeout(rd);
    const s = UI.screen();
    if (s !== 'shop' && s !== 'pack') return;
    if (UI.isBusy()) { rd = setTimeout(redrawForBreakpoint, 250); return; }
    UI.update();
  };
  UI.onBreakpoint(() => { clearTimeout(rd); rd = setTimeout(redrawForBreakpoint, 0); });
  UI.shop = {
    buy, reroll, leave: leaveShop, pick, skip: skipPack, sellJoker, sellConsumable, useConsumable, jokerEvents, levelBeat,
    tagsStatus, itemInfo, optionInfo, selected: packSelected, select: selectCards, packFocusKey, render: () => (UI.screen() === 'shop' ? renderShop() : null),
  };
})();
