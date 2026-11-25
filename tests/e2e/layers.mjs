// The CSS layers over the art, in the running game at REAL speed (a tools/cdp.mjs scenario; added in the final pass,
// 2026-11-24). A run is staged through the hooks with one playing card and one Joker of each Edition (Sheen, Dither,
// Glitch, Phantom) and one card of each Seal; then:
//   1. every Edition loop runs and advances, on the cards and on the Jokers;
//   2. six frames 120 ms apart of each layer, twice: "live" (the wall clock, started at the loop's phase, each
//      frame labelled with the animation's own time) and "seek" (the layer's loops paused and stepped exactly
//      120 ms); written as frames and as strips;
//   3. Sheen: the sweep is warm and lands on the card's stock only, never on the index or pips (each art pixel of
//      the face is compared with a rest frame: the stock inside the band brightens, the ink not at all); Dither: the
//      hum never touches the index or pips either;
//   4. Phantom: opaque at rest (its baked card has no see-through pixel), a 0.55 dip in the loop (0.78 and 0.5 on a
//      Joker);
//   5. each Seal badge sits at TW.Art.meta('seal:' + id).at; on a phone's fanned hand (final pass, part 2), a covered
//      card's badge stands at the top of the strip that shows, whole, and its picture leaves the Seal out;
//   6. Options > Colour-coded suits redraws the hand (the faces, the Glitch slices) and the deck view, and back;
//   7. reduced motion, from Options and from the system setting: no Edition loop runs and six frames of the field
//      120 ms apart hold still.
// cdp.mjs fails the run on any console error or exception.
//
// Usage (serve the project root first: node tools/serve.mjs . 5193):
//   node tools/cdp.mjs run "http://localhost:5193/?seed=QALAYERS" tests/e2e/layers.mjs
//   node tools/cdp.mjs run "http://localhost:5193/?seed=QALAYERS" tests/e2e/layers.mjs 390x844 --mobile
//   SHOTS_DIR writes the frames somewhere else (default shots/qa: {size}-{edition}-{card|joker}-{live|seek}-f{k}.png,
//   their -strip.png, {size}-seals.png, {size}-suits-before-after.png, {size}-reduced-*.png).
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = process.env.SHOTS_DIR ? resolve(process.env.SHOTS_DIR) : resolve(HERE, '../../shots/qa');
const EDS = ['gloss', 'benday', 'fourcolor', 'inverted'];
// each loop's name, length and the moment its six frames start (where it moves: the sweep crossing, a dither step,
// the Glitch slip, a Phantom dip)
const LOOPS = {
  gloss: { anim: 'ed-sheen', dur: 3200, base: 180 },
  benday: { anim: 'ed-dither', dur: 2400, base: 200 },
  fourcolor: { anim: 'slice-a', dur: 3400, base: 3170 },
  inverted: { anim: 'ed-phantom', janim: 'ed-phantom-jk', dur: 2400, base: 600 },
};

export default async function layers(page, { url }) {
  mkdirSync(DIR, { recursive: true });
  const js = (e) => page.eval(e);
  const runJs = (body) => js(`(() => { const run = __wick.run(), E = TW.Engine, Cn = TW.Content, UI = TW.UI; ${body} })()`);
  const state = async () => JSON.parse(await js('JSON.stringify(__wick.state())'));
  const fail = (m, x) => { throw new Error(m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 1500) : '')); };
  const checks = [], notes = {}, files = [];
  const ok = (cond, msg, x) => { if (!cond) fail(msg, x); checks.push(msg); };
  const until = async (what, f, ms = 30000) => { const end = Date.now() + ms; let s; while (Date.now() < end) { s = await state(); if (f(s)) return s; await page.sleep(50); } fail('timed out: ' + what, s); };
  const quiet = async (ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { const n = await js(`document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming && a.effect.getTiming().iterations !== Infinity).length`); if (!n) return; await page.sleep(80); } };
  const park = () => page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 }); // no hover lift or glint on a card
  if (/[?&]test=1/.test(url)) fail('layers.mjs needs real speed: test mode stops every animation');
  const W = await js('innerWidth'), H = await js('innerHeight'), size = `${W}x${H}`;
  const PX = await js('TW.UI.PX()'), SCALE = 6 / PX; // 6 image px per art px at both pixel sizes

  const capture = async (clip, scale = SCALE) => {
    const p = { format: 'png' };
    if (clip) p.clip = { x: clip.x, y: clip.y, width: clip.w, height: clip.h, scale };
    return (await page.send('Page.captureScreenshot', p)).data;
  };
  const save = (name, b64) => { const f = join(DIR, name); writeFileSync(f, Buffer.from(b64, 'base64')); files.push(f); return f; };
  const strip = async (name, list, labels) => save(name, await js(`(async () => {
    const srcs = ${JSON.stringify(list)}, labels = ${JSON.stringify(labels)};
    const imgs = await Promise.all(srcs.map(async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); return i; }));
    const gap = 10, top = 22, w = imgs.reduce((a, i) => a + i.width, 0) + gap * (imgs.length - 1), h = Math.max(...imgs.map((i) => i.height)) + top;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = '#101018'; g.fillRect(0, 0, w, h); g.fillStyle = '#E8E8E8'; g.font = '14px monospace';
    let x = 0; imgs.forEach((i, k) => { g.drawImage(i, x, top); g.fillText(labels[k] || '', x + 2, 15); x += i.width + gap; });
    return c.toDataURL('image/png').split(',')[1];
  })()`));
  const rectOf = (sel) => js(`(() => { const n = document.querySelector(${JSON.stringify(sel)}); if (!n) return null; if (n.closest('.rack-in')) n.scrollIntoView({ block: 'nearest', inline: 'center' }); const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const pad = (r, p = 6 * PX, top = 8 * PX) => ({ x: Math.max(0, r.x - p), y: Math.max(0, r.y - top), w: Math.min(W, r.w + 2 * p), h: Math.min(H, r.h + p + top) });
  /** Each frame against a reference, art pixel by art pixel of the host's face (only pixels nothing covers): how far
      the light stock (luminance above 0.72) and the ink (below 0.5) moved. Run while the host's loops are paused. */
  const measure = (frames, ref, faceId, sel, clip) => js(`(async () => {
    const frames = ${JSON.stringify(frames)}, ref = ${JSON.stringify(ref)}, clip = ${JSON.stringify(clip)}, scale = ${SCALE}, px = ${PX};
    const host = document.querySelector(${JSON.stringify(sel)}), face = host.querySelector('.face').getBoundingClientRect();
    const bm = TW.Art.bitmap(${JSON.stringify(faceId)});
    const dec = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
    const R = await dec(ref), F = await Promise.all(frames.map(dec));
    const at = (img, ax, ay) => { const o = (Math.floor((face.top - clip.y + (ay + 0.5) * px) * scale) * img.width + Math.floor((face.left - clip.x + (ax + 0.5) * px) * scale)) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
    const seen = (ax, ay) => { const e = document.elementFromPoint(face.left + (ax + 0.5) * px, face.top + (ay + 0.5) * px); return !!(e && (e === host || host.contains(e))); };
    const px2 = []; let hidden = 0;
    for (let ay = 0; ay < bm.h; ay++) for (let ax = 0; ax < bm.w; ax++) {
      const o = (ay * bm.w + ax) * 4; if (bm.data[o + 3] < 255) continue;
      if (!seen(ax, ay)) { hidden++; continue; }
      const L = (0.2126 * bm.data[o] + 0.7152 * bm.data[o + 1] + 0.0722 * bm.data[o + 2]) / 255;
      if (L > 0.72 || L < 0.5) px2.push({ ax, ay, ink: L < 0.5 });
    }
    return { hidden, frames: F.map((img) => {
      const out = { litMax: 0, inkMax: 0, litGain: 0, litN: 0, warm: [0, 0, 0] };
      for (const p of px2) {
        const a = at(img, p.ax, p.ay), b = at(R, p.ax, p.ay), d = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
        if (p.ink) out.inkMax = Math.max(out.inkMax, d);
        else { out.litMax = Math.max(out.litMax, d); if (d > 8) { out.litN++; out.litGain += (a[0] + a[1] + a[2] - b[0] - b[1] - b[2]) / 3; [0, 1, 2].forEach((c) => { out.warm[c] += a[c]; }); } }
      }
      if (out.litN) { out.litGain = +(out.litGain / out.litN).toFixed(1); out.warm = out.warm.map((v) => Math.round(v / out.litN)); }
      return out;
    }) };
  })()`);

  // ------------------------------------------------------------ the staged run
  await until('the title', (s) => s.screen === 'title');
  await js(`(() => { TW.UI.setSetting('motion', 'auto'); TW.UI.setSetting('fourColor', false); return 1; })()`);
  ok(await js(`!document.documentElement.classList.contains('reduce-motion')`), 'full motion to start with');
  await js(`(() => { __wick.newRun({ seed: 'QALAYERS' }); return 1; })()`);
  await until('the Blind select', (s) => s.screen === 'blind-select' && !s.busy);
  await quiet();
  await page.click('[data-action="start-blind"]');
  await park();
  await until('the deal', (s) => s.screen === 'play' && !s.busy && s.hand.length >= 8);
  await quiet();
  // the Seals first and the Editions last, so on a phone's fanned hand the Sheen card lies on top, whole
  const staged = await runJs(`
    const spec = [
      { rank: 14, suit: 'S', seal: 'encore' }, { rank: 5, suit: 'H', seal: 'paid' }, { rank: 8, suit: 'D', seal: 'airmail' }, { rank: 12, suit: 'C', seal: 'cameo' },
      { rank: 9, suit: 'C', edition: 'benday' }, { rank: 13, suit: 'D', edition: 'fourcolor' }, { rank: 7, suit: 'S', edition: 'inverted' }, { rank: 10, suit: 'H', edition: 'gloss' },
    ];
    run.blind.hand.slice(0, 8).forEach((u, i) => { const c = E.getCard(run, u), s = spec[i]; Object.assign(c, { rank: s.rank, suit: s.suit, enhancement: null, edition: s.edition || null, seal: s.seal || null, grow: 0 }); });
    run.sortMode = 'manual';
    run.jokers = [];
    Cn.JOKERS.filter((j) => j.rarity === 'common').slice(0, 4).forEach((j, i) => E.addJoker(run, j.id, 0, ${JSON.stringify(EDS)}[i]));
    UI.saveRun(); UI.update();
    return { editions: Cn.EDITIONS.map((e) => e.id), seals: Cn.SEALS.map((e) => e.id),
      cards: run.blind.hand.map((u) => { const c = E.getCard(run, u); return { uid: u, suit: c.suit, edition: c.edition, seal: c.seal, id: UI.cardSpriteId(c) }; }),
      jokers: run.jokers.map((j) => ({ uid: j.uid, id: j.id, edition: j.edition })) };`);
  ok(EDS.every((e) => staged.editions.includes(e)) && staged.editions.length === 4 && staged.seals.length === 4, 'the engine has these 4 Editions and 4 Seals', staged);
  ok(staged.jokers.map((j) => j.edition).join() === EDS.join(), 'one Joker of each Edition is in the rack', staged.jokers);
  await page.sleep(300);
  await quiet();
  await page.sleep(400);
  save(`${size}-context.png`, await capture(null, 1));

  // ------------------------------------------------------------ 1. the loops run
  const ANIMS = `document.getAnimations().filter((a) => /^(ed-|slice-)/.test(a.animationName || '')).map((a) => { const t = a.effect && a.effect.target, h = t && t.closest('[data-uid],[data-joker-uid]'); return { name: a.animationName, state: a.playState, t: Math.round(a.currentTime), host: h ? (h.dataset.uid ? 'card:' + h.dataset.uid : 'joker:' + h.dataset.jokerUid) : null }; })`;
  const a0 = await js(ANIMS);
  await page.sleep(400);
  const a1 = await js(ANIMS);
  const hosts = [...staged.cards.filter((c) => c.edition).map((c) => ['card:' + c.uid, c.edition, false]), ...staged.jokers.map((j) => ['joker:' + j.uid, j.edition, true])];
  for (const [h, ed, jk] of hosts) {
    const name = jk && LOOPS[ed].janim ? LOOPS[ed].janim : LOOPS[ed].anim;
    const x0 = a0.find((a) => a.host === h && a.name === name), x1 = a1.find((a) => a.host === h && a.name === name);
    ok(x0 && x1 && x1.state === 'running' && x1.t > x0.t, `${h} (${ed}) runs ${name} and it advances`, { x0, x1 });
  }

  // ------------------------------------------------------------ 2-4. six frames 120 ms apart of each layer
  const results = {};
  for (const ed of EDS) for (const who of ['card', 'joker']) {
    const L = LOOPS[ed], host = who === 'card' ? staged.cards.find((c) => c.edition === ed) : staged.jokers.find((j) => j.edition === ed);
    const sel = who === 'card' ? `#hand .card[data-uid="${host.uid}"]` : `#jokerRack .jk[data-joker-uid="${host.uid}"]`;
    const name = who === 'joker' && L.janim ? L.janim : L.anim, tag = `${ed}-${who}`;
    const r = await rectOf(sel);
    ok(!!r, `${tag} is on screen`);
    const clip = pad(r);
    const pick = `document.getAnimations().filter((a) => /^(ed-|slice-)/.test(a.animationName || '') && a.effect && a.effect.target && a.effect.target.closest(${JSON.stringify(sel)}))`;
    const hop = `document.getAnimations().filter((a) => a.animationName === 'sway-card' && a.effect && a.effect.target && a.effect.target.closest(${JSON.stringify(sel)}))`;
    const phase = `(() => { const a = ${pick}.find((x) => x.animationName === '${name}'); return a ? Math.round(a.currentTime % ${L.dur}) : -1; })()`;
    // live: from the loop's phase, a frame every 120 ms of the wall clock
    for (let end = Date.now() + 8000; Date.now() < end;) { const d = (L.base - (await js(phase)) + L.dur) % L.dur; if (d < 25) break; await page.sleep(Math.max(0, Math.min(d - 20, 400))); }
    const live = [], liveT = [], t0 = Date.now();
    for (let k = 0; k < 6; k++) { const w = t0 + 120 * k - Date.now(); if (w > 0) await page.sleep(w); liveT.push(await js(phase)); live.push(await capture(clip)); }
    live.forEach((b, k) => save(`${size}-${tag}-live-f${k + 1}.png`, b));
    await strip(`${size}-${tag}-live-strip.png`, live, liveT.map((t) => `t=${t}`));
    // seek: the host's loops (and its idle hop) paused, stepped exactly 120 ms
    await js(`(() => { ${pick}.forEach((a) => a.pause()); ${hop}.forEach((a) => a.pause()); return 1; })()`);
    const seekAt = async (t) => js(`(async () => { ${pick}.forEach((a) => { a.currentTime = ${t}; }); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return 1; })()`);
    const seek = [], seekT = [], opacity = [];
    for (let k = 0; k < 6; k++) {
      const t = (L.base + 120 * k) % L.dur;
      await seekAt(t);
      seek.push(await capture(clip)); seekT.push(t);
      opacity.push(await js(`+getComputedStyle(document.querySelector(${JSON.stringify(sel + ' .face')})).opacity`));
    }
    seek.forEach((b, k) => save(`${size}-${tag}-seek-f${k + 1}.png`, b));
    await strip(`${size}-${tag}-seek-strip.png`, seek, seekT.map((t) => `t=${t}`));
    results[tag] = { liveT, seekT, opacity };
    if (ed === 'inverted') {
      const rest = who === 'card' ? 1 : 0.78;
      ok(opacity[0] === rest && opacity.some((o) => o < rest), `Phantom ${who}: rests at ${rest} and dips in the loop`, opacity);
    }
    if (who === 'card' && (ed === 'gloss' || ed === 'benday')) {
      let ref = seek[0];
      if (ed === 'gloss') { await seekAt(2000); ref = await capture(clip); save(`${size}-${tag}-rest.png`, ref); } // the band rests off the card
      const m = await measure(seek, ref, host.id, sel, clip);
      results[tag].measure = m;
      if (ed === 'gloss') ok(m.hidden === 0, 'the Sheen card lies whole on top', m.hidden); // a phone fans the hand: the Dither card shows its left part
      ok(m.frames.every((f) => f.inkMax <= 2), `${ed === 'gloss' ? 'Sheen\'s sweep' : 'Dither\'s hum'} never lands on the index or pips (ink moves at most 2 levels)`, m.frames.map((f) => f.inkMax));
      if (ed === 'gloss') {
        const band = m.frames.filter((f) => f.litN > 20);
        ok(band.length >= 2, 'the sweep crosses the stock in the middle frames', m.frames.map((f) => f.litN));
        ok(band.every((f) => f.warm[0] >= f.warm[1] && f.warm[1] >= f.warm[2]), 'the sweep is warm (red over green over blue where it lies)', band.map((f) => f.warm));
      } else ok(m.frames.some((f) => f.litMax > 0), 'the hum moves on the stock');
    }
    await js(`(() => { ${pick}.forEach((a) => a.play()); ${hop}.forEach((a) => a.play()); return 1; })()`);
  }

  // ------------------------------------------------------------ 4. Phantom's baked card is opaque
  const ph = await runJs(`
    const c = run.blind.hand.map((u) => E.getCard(run, u)).find((x) => x.edition === 'inverted');
    const a = TW.Art.bitmap(UI.cardSpriteId(c)), b = TW.Art.bitmap(UI.cardSpriteId(Object.assign({}, c, { edition: null })));
    let see = 0, card = 0;
    for (let i = 3; i < a.data.length; i += 4) if (b.data[i] === 255) { card++; if (a.data[i] < 255) see++; }
    return { card, see };`);
  ok(ph.card > 1500 && ph.see === 0, 'the Phantom card is opaque wherever the card is', ph);

  // ------------------------------------------------------------ 5. Seals at their spot (on a fanned hand, in the strip that shows)
  const seals = await runJs(`
    const hand = document.querySelector('#hand'), cards = [...hand.querySelectorAll('.card')], fanned = hand.classList.contains('is-fanned');
    const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return cards.map((n, i) => {
      const c = E.getCard(run, n.dataset.uid); if (!c || !c.seal) return null;
      const b = n.querySelector('.seal-badge'), f = n.querySelector('.face'), at = TW.Art.meta('seal:' + c.seal).at, p = UI.PX();
      if (!b) return { seal: c.seal, badge: false };
      const fr = f.getBoundingClientRect(), br = b.getBoundingClientRect(), covered = fanned && i < cards.length - 1;
      let hidden = 0;
      cards.slice(i + 1).forEach((m) => { hidden = Math.max(hidden, inter(br, m.getBoundingClientRect())); });
      return { seal: c.seal, covered, at: covered ? [10, 5 - br.height / p] : [...at], dx: (br.left - fr.left) / p, dy: (br.top - fr.top) / p,
        shown: Math.round((1 - hidden / (br.width * br.height)) * 100) / 100, bareFace: f.getAttribute('src') === TW.Art.url(UI.cardSpriteId(Object.assign({}, c, { seal: null }))) };
    }).filter(Boolean);`);
  notes.seals = seals;
  ok(seals.length === 4 && seals.every((s) => s.badge !== false && Math.abs(s.dx - s.at[0]) < 0.01 && Math.abs(s.dy - s.at[1]) < 0.01), 'each Seal badge sits at TW.Art.meta(seal).at (a covered card\'s, on a fanned hand, at the top of the strip that shows)', seals);
  ok(seals.every((s) => s.shown >= 0.99), 'every Seal shows whole: none lies under the next card', seals);
  ok(seals.every((s) => s.bareFace === s.covered), 'a covered card\'s picture leaves its Seal out (the badge carries it), so no Seal shows twice', seals);
  const sealShots = [];
  for (const c of staged.cards.filter((x) => x.seal)) sealShots.push(await capture(pad(await rectOf(`#hand .card[data-uid="${c.uid}"]`))));
  await strip(`${size}-seals.png`, sealShots, staged.cards.filter((x) => x.seal).map((x) => x.seal));

  // ------------------------------------------------------------ 6. Colour-coded suits redraws the cards
  const handClip = pad(await rectOf('#hand'), 4 * PX, 10 * PX);
  const faces = () => js(`[...document.querySelectorAll('#hand .card')].map((n) => ({ face: n.querySelector('.face').getAttribute('src'), slice: (n.querySelector('.slice') || {}).src || null }))`);
  const toggleSuits = async () => {
    await js(`(() => { TW.UI.openOverlay('options'); return 1; })()`);
    await page.waitFor('#dialogs [data-action="toggle-four-color"]');
    await page.sleep(300);
    await page.click('#dialogs [data-action="toggle-four-color"]');
    await page.sleep(300);
    await page.key('Escape');
    await park();
    await page.sleep(400);
    await quiet();
  };
  const before = await capture(handClip, 1), f0 = await faces();
  await toggleSuits();
  const after = await capture(handClip, 1), f1 = await faces();
  ok((await runJs(`return run.blind.hand.map((u) => UI.cardSpriteId(E.getCard(run, u)));`)).every((id) => id.startsWith('card4:')), 'with Colour-coded suits every card asks for a card4: face');
  ok(staged.cards.every((c, i) => ((c.suit === 'C' || c.suit === 'D') ? f0[i].face !== f1[i].face : f0[i].face === f1[i].face)), 'the hand is redrawn: Clubs and Diamonds change face, Spades and Hearts keep theirs');
  const gi = staged.cards.findIndex((c) => c.edition === 'fourcolor');
  ok(f1[gi].slice && f1[gi].slice === f1[gi].face && f0[gi].slice !== f1[gi].slice, 'the Glitch slices follow the new face');
  await strip(`${size}-suits-before-after.png`, [before, after], ['two-colour', 'colour-coded']);
  await js(`(() => { TW.UI.openOverlay('deck'); return 1; })()`);
  await page.sleep(500);
  const deck = await runJs(`return { imgs: document.querySelectorAll('#dialogs img').length, ids: E.deckView(run).cards.filter((c) => c.suit === 'C' || c.suit === 'D').map((c) => UI.cardSpriteId(c)) };`);
  ok(deck.imgs > 0 && deck.ids.every((id) => id.startsWith('card4:')), 'the deck view draws the four-colour faces', deck.ids.slice(0, 3));
  save(`${size}-deck-fourcolor.png`, await capture(null, 1));
  await page.key('Escape');
  await park();
  await page.sleep(300);
  await toggleSuits();
  ok((await faces()).every((x, i) => x.face === f0[i].face), 'switched off, the hand is back to the two-colour faces');

  // ------------------------------------------------------------ 7. reduced motion stops them all
  const still = async (label) => {
    const loops = await js(`document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming && a.effect.getTiming().iterations === Infinity).map((a) => (a.animationName || 'waapi') + (a.effect.pseudoElement || ''))`);
    const field = (await rectOf('#main')) || { x: 0, y: 0, w: W, h: H };
    const fr = [], t0 = Date.now();
    for (let k = 0; k < 6; k++) { const w = t0 + 120 * k - Date.now(); if (w > 0) await page.sleep(w); fr.push(await capture(field, 1)); }
    fr.forEach((b, k) => save(`${size}-reduced-${label}-f${k + 1}.png`, b));
    // still: no pixel moves more than 4 levels (a re-raster can shift a soft glow by 1 or 2; anything that moves, far more)
    const maxd = await js(`(async () => {
      const dec = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
      const all = await Promise.all(${JSON.stringify(fr)}.map(dec));
      return all.map((d) => { let m = 0; for (let i = 0; i < d.length; i++) { if ((i & 3) !== 3) m = Math.max(m, Math.abs(d[i] - all[0][i])); } return m; });
    })()`);
    return { ed: loops.filter((l) => /^(ed-|slice-)/.test(l)), loops, maxd };
  };
  await js(`(() => { TW.UI.openOverlay('options'); return 1; })()`);
  await page.waitFor('#dialogs [data-action="set-motion"][data-value="reduced"]');
  await page.sleep(300);
  await page.click('#dialogs [data-action="set-motion"][data-value="reduced"]');
  await page.sleep(300);
  await page.key('Escape');
  await park();
  await page.sleep(600);
  await quiet();
  const rm = await still('option');
  notes.reducedOption = rm;
  ok(await js(`document.documentElement.classList.contains('reduce-motion')`), 'Motion: Reduced sets the reduce-motion class');
  ok(rm.ed.length === 0, 'under Motion: Reduced no Edition loop runs', rm.ed);
  ok(rm.maxd.every((d) => d <= 4), 'under Motion: Reduced six frames of the field 120 ms apart hold still', rm);
  await js(`(() => { TW.UI.setSetting('motion', 'auto'); return 1; })()`);
  await page.sleep(400);
  ok((await js(ANIMS)).filter((a) => a.state === 'running').length >= 8, 'back on Auto the Edition loops run again');
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.sleep(600);
  await quiet();
  let os = await still('os');
  if (!os.maxd.every((d) => d <= 4)) { notes.osFirstTry = os.maxd; await page.sleep(1500); os = await still('os'); }
  notes.reducedOS = os;
  ok(await js(`document.documentElement.classList.contains('reduce-motion')`), 'the system setting (Motion: Auto) sets the reduce-motion class');
  ok(os.ed.length === 0, 'under the system setting no Edition loop runs', os.ed);
  ok(os.maxd.every((d) => d <= 4), 'under the system setting six frames of the field 120 ms apart hold still', os);
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await js(`(() => { TW.UI.setSetting('motion', 'auto'); return 1; })()`);

  return { size, px: PX, checks: checks.length, list: checks, results, notes, files: files.length, dir: DIR };
}
