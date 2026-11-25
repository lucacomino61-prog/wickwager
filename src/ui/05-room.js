/* Wickwager room: the candlelit room behind every screen, in three depths (ported from mockups/ember-lit/scene.js).
   Far:   irregular groups of candles on short ledges, jars, books, bottles and one candelabra, drawn on the art
          grid and blurred once into a canvas, so it reads as depth of field (no live filter while it drifts).
   Mid:   crisp pixel haze and smoke strata on the same art grid as the sprites.
   Near:  embers rising at three depths, added together like light.
   Light: a hearth glow from below, a pool of candlelight over the stage, a warm plum falloff at the edges.
   The layers drift slowly and lean away from the pointer with a spring-like CSS transition. No
   requestAnimationFrame: drawing happens once per size, motion is CSS and WAAPI. Reduced motion and test mode
   hold it still (no drift, no motes, no parallax).
   API: TW.UI.room = { build(host), placePool(rect), flashAt(x, y) → element, lean(nx, ny), redraw() } */
(() => {
  'use strict';
  const TW = (globalThis.TW = globalThis.TW || {});
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const UI = TW.UI;
  if (!UI) return;
  const OVER = 12; // art px of overscan on every side: room for drift and parallax
  let root = null, far, mid, near, flashEl, poolEl;
  let focus = null; // { x, w }: the stage's centre and width in viewport px

  // ------------------------------------------------------------ far: a candlelit room, out of focus
  function drawFar(cv, W, H, room) {
    const px = UI.PX(), AW = Math.ceil(W / px), AH = Math.ceil(H / px);
    const a = document.createElement('canvas');
    a.width = AW; a.height = AH;
    const g = a.getContext('2d');
    const flames = [];
    const fill = (rgba, x, y, w, h) => { g.fillStyle = rgba; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const ledge = (x0, x1, y, thick, dim) => {
      fill(`rgba(28, 8, 26, ${0.8 * dim})`, x0, y, x1 - x0, thick);
      fill(`rgba(255, 168, 110, ${0.34 * dim})`, x0, y, x1 - x0, 1);
      fill(`rgba(20, 4, 16, ${0.45 * dim})`, x0 + 1, y + thick, x1 - x0 - 2, Math.max(2, thick));
      fill(`rgba(24, 6, 20, ${0.7 * dim})`, x0 + 2, y + thick, 2, 3 + thick);
      fill(`rgba(24, 6, 20, ${0.7 * dim})`, x1 - 4, y + thick, 2, 3 + thick);
    };
    const flameAt = (fx, fy, s, dim, bloom) => {
      fill(`rgba(255, 150, 60, ${dim})`, fx - 1, fy - 2, 2, 3);
      fill(`rgba(255, 246, 210, ${dim})`, fx, fy - 1, 1, 2);
      flames.push({ x: fx + 0.5, y: fy - 0.5, s, dim, bloom });
    };
    const candle = (x, y, w, h, lit, dim, bloom, s) => {
      fill(`rgba(236, 200, 166, ${(lit ? 0.84 : 0.5) * dim})`, x, y - h, w, h);
      fill(`rgba(255, 236, 214, ${(lit ? 0.76 : 0.32) * dim})`, x, y - h, 1, h);
      fill(`rgba(150, 90, 80, ${0.6 * dim})`, x + w - 1, y - h, 1, h);
      if (lit) flameAt(x + Math.floor(w / 2), y - h - 1, s, dim, bloom);
      else fill(`rgba(40, 14, 26, ${0.8 * dim})`, x + Math.floor(w / 2), y - h - 2, 1, 2); // a burnt wick
    };
    const jar = (x, y, w, h, dim) => {
      fill(`rgba(44, 14, 40, ${0.86 * dim})`, x, y - h, w, h);
      fill(`rgba(255, 170, 120, ${0.28 * dim})`, x + 1, y - h, w - 2, 1);
      fill(`rgba(255, 190, 150, ${0.18 * dim})`, x + 1, y - h + 1, 1, h - 2);
    };
    const bottle = (x, y, w, h, dim) => {
      const neck = Math.max(2, Math.round(w / 3)), nh = Math.round(h * 0.36);
      fill(`rgba(36, 10, 34, ${0.9 * dim})`, x, y - h + nh, w, h - nh);
      fill(`rgba(36, 10, 34, ${0.9 * dim})`, x + Math.floor((w - neck) / 2), y - h, neck, nh);
      fill(`rgba(255, 180, 140, ${0.34 * dim})`, x + 1, y - h + nh + 2, 1, h - nh - 4);
      fill(`rgba(255, 196, 150, ${0.22 * dim})`, x + Math.floor((w - neck) / 2), y - h, neck, 1);
    };
    const books = (x, y, n, r, dim) => {
      let bx = x;
      for (let i = 0; i < n; i++) {
        const w = 2 + Math.floor(r() * 2), h = 6 + Math.floor(r() * 7);
        const c = [[74, 24, 58], [92, 34, 44], [58, 26, 72], [84, 44, 30]][Math.floor(r() * 4)];
        fill(`rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.9 * dim})`, bx, y - h, w, h);
        fill(`rgba(255, 200, 150, ${0.2 * dim})`, bx, y - h, w, 1);
        bx += w;
      }
      return bx - x;
    };
    const candelabra = (cx, y, dim, bloom) => {
      const m = `rgba(30, 10, 24, ${0.86 * dim})`, hi = `rgba(255, 176, 120, ${0.3 * dim})`;
      fill(m, cx - 5, y - 2, 11, 2); fill(m, cx - 3, y - 4, 7, 2);
      fill(m, cx, y - 20, 2, 16); fill(hi, cx, y - 20, 1, 16);
      fill(m, cx - 9, y - 14, 20, 2); fill(hi, cx - 9, y - 14, 20, 1);
      fill(m, cx - 9, y - 18, 2, 4); fill(m, cx + 9, y - 18, 2, 4);
      [[-10, 4], [-1, 5], [8, 4]].forEach(([dx, cw]) => fill(m, cx + dx, y + (dx === -1 ? -22 : -19), cw, 1));
      candle(cx - 9, y - 19, 2, 7, true, dim, bloom, 1);
      candle(cx, y - 22, 2, 9, true, dim, bloom, 1.15);
      candle(cx + 9, y - 19, 2, 6, true, dim, bloom, 1);
    };
    const r = UI.rng('far-room-' + room.seed);
    const yA = (f) => Math.round((room.top + room.h * f) / px);
    const xA = (cssX) => Math.round(cssX / px);
    room.groups.forEach((gr) => {
      const y = yA(gr.y), dim = gr.dim, bloom = gr.y > 0.52 ? 0.6 : 1; // low groups bloom 40 % less
      const x0 = xA(gr.x0), x1 = Math.max(x0 + 10, xA(gr.x1));
      ledge(x0 - 2, x1 + 2, y, gr.y > 0.52 ? 3 : 2, dim);
      if (gr.candelabra) { candelabra(Math.round((x0 + x1) / 2), y, dim, bloom); return; }
      let x = x0 + 1;
      while (x < x1 - 2) {
        const k = r();
        if (gr.bottle && k < 0.18) { const w = 4 + Math.floor(r() * 2); bottle(x, y, w, 11 + Math.floor(r() * 6), dim); x += w + 2; continue; }
        if (k < 0.66) {
          const s = gr.y > 0.52 ? 1.15 : 0.85;
          const w = Math.max(2, Math.round((2 + r() * 2) * s)), h = Math.round((3 + r() * 11) * s);
          candle(x, y, w, h, r() > 0.24, dim, bloom, s * (0.8 + r() * 0.5));
          x += w + 1 + Math.floor(r() * 4);
        } else if (k < 0.82) { const w = 4 + Math.floor(r() * 3); jar(x, y, w, 5 + Math.floor(r() * 5), dim); x += w + 2; }
        else x += books(x, y, 2 + Math.floor(r() * 2), r, dim) + 2;
      }
    });
    // scale up on the art grid, then blur once: depth of field
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.filter = `blur(${(UI.MQ.phone.matches ? 3.5 : 5) * dpr}px)`;
    c.drawImage(a, 0, 0, AW * px * dpr, AH * px * dpr);
    c.filter = 'none';
    // the stage centre sits in a soft shadow, a quiet ground for the total
    if (room.focus != null) {
      const fx = room.focus * dpr, fy = (room.top + room.h * 0.47) * dpr, R = room.fw * 0.62 * dpr;
      const sh = c.createRadialGradient(fx, fy, 0, fx, fy, R);
      sh.addColorStop(0, 'rgba(26, 4, 18, 0.24)'); sh.addColorStop(0.6, 'rgba(26, 4, 18, 0.1)'); sh.addColorStop(1, 'rgba(26, 4, 18, 0)');
      c.fillStyle = sh;
      c.save(); c.translate(fx, fy); c.scale(1, 0.62); c.translate(-fx, -fy); c.fillRect(fx - R, fy - R, R * 2, R * 2); c.restore();
    }
    // bloom: every lit flame gets a soft glow and an out-of-focus highlight, added like light
    c.globalCompositeOperation = 'lighter';
    flames.forEach((f) => {
      const x = f.x * px * dpr, y = f.y * px * dpr, k = UI.MQ.phone.matches ? 0.75 : 1;
      const R1 = (26 + 22 * f.s) * dpr * k;
      const gl = c.createRadialGradient(x, y, 0, x, y, R1);
      gl.addColorStop(0, `rgba(255, 196, 120, ${0.36 * f.dim * f.bloom})`);
      gl.addColorStop(0.35, `rgba(255, 140, 70, ${0.15 * f.dim * f.bloom})`);
      gl.addColorStop(1, 'rgba(255, 110, 50, 0)');
      c.fillStyle = gl; c.fillRect(x - R1, y - R1, R1 * 2, R1 * 2);
      const R2 = (5 + 5 * f.s) * dpr * k;
      const bk = c.createRadialGradient(x, y, 0, x, y, R2);
      bk.addColorStop(0, `rgba(255, 236, 200, ${0.56 * f.dim * (0.5 + 0.5 * f.bloom)})`);
      bk.addColorStop(0.7, `rgba(255, 200, 140, ${0.3 * f.dim * (0.5 + 0.5 * f.bloom)})`);
      bk.addColorStop(1, 'rgba(255, 170, 110, 0)');
      c.fillStyle = bk; c.fillRect(x - R2, y - R2, R2 * 2, R2 * 2);
    });
    c.globalCompositeOperation = 'source-over';
  }
  /** Irregular groups at mixed heights and widths either side of the dark stage centre; the middle 40 % stays empty. */
  function roomGroups(W, fx, fw) {
    const fL = Math.max(0, fx - fw / 2), fR = Math.min(W, fx + fw / 2);
    const dL = fx - fw * 0.2, dR = fx + fw * 0.2;
    const G = [];
    const put = (a, b, f0, f1, y, dim, o = {}) => { const x0 = a + (b - a) * f0, x1 = a + (b - a) * f1; if (x1 - x0 > 20) G.push({ x0, x1, y, dim, ...o }); };
    put(fL, dL, 0.04, 0.4, 0.3, 0.8);
    put(fL, dL, 0.08, 0.36, 0.5, 0.9);
    put(fL, dL, 0.6, 0.84, 0.57, 1, { candelabra: true });
    put(dR, fR, 0.06, 0.44, 0.34, 0.85, { bottle: true });
    put(dR, fR, 0.5, 0.97, 0.6, 1);
    if (fL > 160) {
      put(0, fL, 0.1, 0.62, 0.44, 0.8);
      put(0, fL, 0.3, 0.86, 0.74, 0.9, { bottle: true });
    }
    return G;
  }

  // ------------------------------------------------------------ mid: pixel haze and smoke strata on the art grid
  function drawMid(cv, W, H) {
    const px = UI.PX(), AW = Math.ceil(W / px), AH = Math.ceil(H / px);
    cv.width = AW; cv.height = AH;
    cv.style.width = AW * px + 'px'; cv.style.height = AH * px + 'px';
    const g = cv.getContext('2d');
    const r = UI.rng('mid-haze');
    [[0.2, 9, [255, 190, 150], 0.05], [0.47, 14, [255, 150, 120], 0.05], [0.74, 11, [255, 170, 100], 0.06]].forEach(([yf, h, col, al]) => {
      const y0 = Math.round(AH * yf);
      for (let x = 0; x < AW; x++) {
        const top = y0 + Math.round(Math.sin(x * 0.045 + yf * 9) * 3 + Math.sin(x * 0.13) * 1.2);
        const bot = top + h + Math.round(Math.sin(x * 0.06 + 2) * 2);
        g.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${al})`;
        g.fillRect(x, top, 1, bot - top);
        g.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${al * 1.6})`;
        g.fillRect(x, top, 1, 1);
      }
    });
    const tints = ['255, 198, 135', '240, 190, 150', '255, 76, 155', '205, 168, 255', '255, 140, 70'];
    for (let k = 0; k < Math.round((AW * AH) / 1400); k++) {
      const y = Math.floor(r() * AH), x0 = Math.floor(r() * AW), len = 8 + Math.floor(r() * 30);
      g.fillStyle = `rgba(${tints[k % tints.length]}, ${0.08 + r() * 0.08})`;
      g.fillRect(x0, y, len, 1);
      if (r() > 0.55) g.fillRect(x0 + 3, y + 1, Math.max(1, len - 6), 1);
    }
  }

  // ------------------------------------------------------------ motes: embers at three depths
  function buildMotes(host, depth, n, seed) {
    const r = UI.rng(seed);
    const H = innerHeight, px = UI.PX();
    const cols = {
      far: ['#FFC687', '#FF9A4E', '#FFB2D6', '#CDA8FF', '#FFD29C'],
      mid: ['#FFF0C8', '#FFD29C', '#FF8A3C', '#FFE070', '#FFB2D6'],
      near: ['rgba(255, 196, 130, .9)', 'rgba(255, 150, 90, .85)', 'rgba(255, 128, 180, .7)', 'rgba(255, 214, 150, .85)'],
    }[depth];
    let html = '';
    for (let i = 0; i < n; i++) {
      const d = depth === 'far' ? 24 + r() * 14 : depth === 'mid' ? 12 + r() * 9 : 15 + r() * 10;
      const s = depth === 'far' ? px : depth === 'mid' ? px * (r() > 0.7 ? 2 : 1) : Math.round(14 + r() * 22);
      const rise = Math.round(H * (0.5 + r() * 0.6));
      const y = Math.round(H * (0.55 + r() * 0.55));
      const sx = depth === 'near' ? 14 : depth === 'mid' ? 7 : 4;
      html += `<span class="mote ${depth}" style="--x:${(r() * 100).toFixed(1)}%;--y:${y}px;--d:${d.toFixed(1)}s;--delay:${(-r() * d).toFixed(2)}s;--rise:${rise}px;--s:${s}px;--sx:${sx}px;--sw:${(2.6 + r() * 2.2).toFixed(1)}s;--c:${cols[i % cols.length]}"><i></i></span>`;
    }
    host.insertAdjacentHTML('beforeend', html);
  }

  // ------------------------------------------------------------ assembly, sizing, parallax
  function size() {
    if (!root) return;
    const px = UI.PX(), o = OVER * px;
    const W = innerWidth + o * 2, H = innerHeight + o * 2;
    const phone = UI.MQ.phone.matches;
    const fx = (focus ? focus.x : innerWidth * (phone ? 0.5 : 0.62)) + o;
    const fw = focus ? focus.w : innerWidth * (phone ? 1 : 0.75);
    drawFar(far.querySelector('canvas'), W, H, { seed: 0, top: 0, h: H, focus: fx, fw, groups: roomGroups(W, fx, fw) });
    drawMid(mid.querySelector('canvas'), W, H);
  }
  function motes() {
    if (!root) return;
    const few = UI.MQ.phone.matches;
    root.querySelectorAll('.motes').forEach((m) => { m.innerHTML = ''; });
    if (UI.TEST) return;
    buildMotes(root.querySelector('.m-far'), 'far', few ? 7 : 11, 'motes-far');
    buildMotes(root.querySelector('.m-near'), 'mid', few ? 10 : 15, 'motes-mid');
    buildMotes(root.querySelector('.m-near'), 'near', few ? 3 : 5, 'motes-near');
  }
  function lean(nx, ny) {
    if (!far) return;
    const p = UI.PX();
    far.style.transform = `translate3d(${(-nx * 2 * p).toFixed(1)}px, ${(-ny * 1.5 * p).toFixed(1)}px, 0)`;
    mid.style.transform = `translate3d(${(-nx * 5 * p).toFixed(1)}px, ${(-ny * 3 * p).toFixed(1)}px, 0)`;
    near.style.transform = `translate3d(${(-nx * 9 * p).toFixed(1)}px, ${(-ny * 5 * p).toFixed(1)}px, 0)`;
  }
  function build(host) {
    root = host;
    if (!root) return;
    root.innerHTML = `
      <div class="layer far"><div class="drift"><canvas></canvas><div class="motes m-far"></div></div></div>
      <div class="light hearth"></div>
      <div class="layer mid"><div class="drift"><canvas></canvas></div></div>
      <div class="light pool"></div>
      <div class="layer near"><div class="drift"><div class="motes m-near"></div></div></div>
      <div class="vignette"></div>`;
    far = root.querySelector('.layer.far'); mid = root.querySelector('.layer.mid'); near = root.querySelector('.layer.near');
    poolEl = root.querySelector('.light.pool');
    // the room's flash at the total: a small soft canvas the compositor stretches (no full-screen layer to paint)
    flashEl = UI.paint.lightCanvas(96, [[0, 'rgba(255, 214, 160, .55)'], [0.45, 'rgba(255, 150, 80, .2)'], [0.75, 'rgba(255, 120, 60, .05)'], [1, 'rgba(255, 120, 60, 0)']]);
    flashEl.className = 'light flash';
    root.append(flashEl);
    size();
    motes();
    let t = 0;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { size(); }, 160); });
    // the room is drawn on the art grid: a new pixel size or layout redraws it and its embers
    if (typeof UI.onBreakpoint === 'function') UI.onBreakpoint(() => { size(); motes(); });
    else if (UI.MQ.phone.addEventListener) UI.MQ.phone.addEventListener('change', () => { size(); motes(); });
    if (!UI.TEST) {
      addEventListener('pointermove', (e) => {
        if (!UI.MQ.fine.matches || UI.reduced()) return;
        lean(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
      }, { passive: true });
      document.documentElement.addEventListener('pointerleave', () => lean(0, 0));
    }
  }
  /** Centre the pool of candlelight on a rectangle (the stage), and keep the far room's dark centre behind it. */
  function placePool(rect) {
    if (!poolEl || !rect) return;
    poolEl.style.setProperty('--pool-x', Math.round(rect.left + rect.width / 2) + 'px');
    poolEl.style.setProperty('--pool-y', Math.round(rect.top + rect.height / 2) + 'px');
    poolEl.style.setProperty('--pool-w', Math.round(Math.max(rect.width * 1.25, 420)) + 'px');
    poolEl.style.setProperty('--pool-h', Math.round(Math.max(rect.height * 1.5, 360)) + 'px');
    const next = { x: Math.round(rect.left + rect.width / 2), w: Math.round(rect.width) };
    if (!focus || Math.abs(focus.x - next.x) > 8 || Math.abs(focus.w - next.w) > 16) { focus = next; size(); }
  }
  function flashAt(x, y) {
    if (!flashEl) return null;
    Object.assign(flashEl.style, { left: Math.round(x) + 'px', top: Math.round(y) + 'px', width: Math.round(innerWidth * 0.8) + 'px', height: Math.round(innerHeight * 0.92) + 'px' });
    return flashEl;
  }
  UI.room = { build, placePool, flashAt, lean, redraw: size, pool: () => poolEl };
})();
