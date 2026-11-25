#!/usr/bin/env node
// Minimal, dependency-free headless Chrome driver over the DevTools protocol.
// Every launch() starts its own Chrome with its own profile and port, so several
// agents can drive browsers at the same time without sharing any state.
//
// Library use:
//   import { launch } from './tools/cdp.mjs';
//   const page = await launch({ width: 1440, height: 900 });
//   await page.goto('index.html?test=1');
//   await page.click('[data-action="new-voyage"]');
//   console.log(await page.eval('document.title'), page.errors());
//   await page.screenshot('out.png');
//   await page.close();
//
// CLI:
//   node tools/cdp.mjs shot <page> <out.png> [WxH] [--mobile] [--full] [--wait=ms] [--eval=js]
//   node tools/cdp.mjs run  <page> <scenario.mjs> [WxH] [--mobile]
//     (scenario.mjs default-exports: async (page, { url }) => result)
// Both print console errors and exceptions as JSON and exit 1 when there were any.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

export function toUrl(target) {
  if (/^(https?|file|about|data):/i.test(target)) return target;
  const [path, query] = target.split('?');
  return pathToFileURL(resolve(path)).href + (query ? `?${query}` : '');
}

const KEYS = {
  Enter: { code: 'Enter', keyCode: 13, text: '\r' },
  Escape: { code: 'Escape', keyCode: 27 },
  Backspace: { code: 'Backspace', keyCode: 8 },
  Tab: { code: 'Tab', keyCode: 9 },
  ' ': { code: 'Space', keyCode: 32, text: ' ' },
  ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
  ArrowUp: { code: 'ArrowUp', keyCode: 38 },
  ArrowRight: { code: 'ArrowRight', keyCode: 39 },
  ArrowDown: { code: 'ArrowDown', keyCode: 40 },
};

export async function launch({ width = 1440, height = 900, mobile = false, scale = 1 } = {}) {
  const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chrome) throw new Error('Chrome not found; set CHROME_PATH');
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), 'tw-chrome-'));
  const proc = spawn(chrome, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--mute-audio',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl;
  for (let i = 0; i < 200 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    if (!wsUrl) await sleep(100);
  }
  if (!wsUrl) { proc.kill(); throw new Error('Chrome did not expose a page target'); }

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('CDP socket failed to open'));
  });

  let seq = 0;
  const pending = new Map();
  const handlers = new Set();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { res, rej, method } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(`${method}: ${msg.error.message}`));
      else res(msg.result);
    } else if (msg.method) {
      for (const h of handlers) h(msg);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej, method });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const logs = [];
  handlers.add((m) => {
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push({ type: m.params.type, text: m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ') });
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logs.push({ type: 'exception', text: d.exception?.description || d.text });
    } else if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      logs.push({ type: e.level, text: e.text + (e.url ? ` (${e.url})` : '') });
    }
  });

  const waitFor = (method, timeout = 20000) => new Promise((res, rej) => {
    const t = setTimeout(() => { handlers.delete(h); rej(new Error(`timeout waiting for ${method}`)); }, timeout);
    const h = (m) => {
      if (m.method === method) { clearTimeout(t); handlers.delete(h); res(m.params); }
    };
    handlers.add(h);
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  const page = {
    send,
    logs,
    sleep,
    /** Console errors, failed loads and uncaught exceptions seen so far. */
    errors: () => logs.filter((l) => l.type === 'exception' || l.type === 'error'),
    async viewport(w, h, isMobile = false) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: isMobile });
      await send('Emulation.setTouchEmulationEnabled', { enabled: isMobile, maxTouchPoints: isMobile ? 5 : 1 });
    },
    async goto(target, { wait = 400 } = {}) {
      const loaded = waitFor('Page.loadEventFired');
      await send('Page.navigate', { url: toUrl(target) });
      await loaded;
      await sleep(wait);
    },
    async reload({ wait = 400 } = {}) {
      const loaded = waitFor('Page.loadEventFired');
      await send('Page.reload', {});
      await loaded;
      await sleep(wait);
    },
    /** Evaluate an expression in the page; promises are awaited, values returned by value. */
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async exists(selector) {
      return page.eval(`!!document.querySelector(${JSON.stringify(selector)})`);
    },
    async waitFor(selector, { timeout = 8000 } = {}) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if (await page.exists(selector)) return true;
        await sleep(60);
      }
      throw new Error(`waitFor: ${selector} did not appear within ${timeout}ms`);
    },
    /** Centre point and size of the first match, scrolled into view; null when absent. */
    async box(selector) {
      return page.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
      })()`);
    },
    /** Real pointer click (mouse events through the input pipeline) at the element's centre. */
    async click(selector) {
      const b = await page.box(selector);
      if (!b) throw new Error(`click: no element matches ${selector}`);
      await page.mouse(b.x, b.y);
      return b;
    },
    async mouse(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    },
    async drag(from, to, steps = 10) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', buttons: 1, clickCount: 1 });
      for (let i = 1; i <= steps; i++) {
        const x = from.x + ((to.x - from.x) * i) / steps;
        const y = from.y + ((to.y - from.y) * i) / steps;
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
        await sleep(16);
      }
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', buttons: 0, clickCount: 1 });
    },
    /** Press one key: 'Enter', 'Escape', 'd', '3', ' ' ... */
    async key(key) {
      const k = KEYS[key] || {
        code: /^[0-9]$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`,
        keyCode: key.toUpperCase().charCodeAt(0),
        text: key,
      };
      await send('Input.dispatchKeyEvent', {
        type: k.text ? 'keyDown' : 'rawKeyDown', key, code: k.code,
        windowsVirtualKeyCode: k.keyCode, nativeVirtualKeyCode: k.keyCode, text: k.text, unmodifiedText: k.text,
      });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: k.code, windowsVirtualKeyCode: k.keyCode, nativeVirtualKeyCode: k.keyCode });
    },
    async screenshot(path, { fullPage = false } = {}) {
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage });
      writeFileSync(path, Buffer.from(data, 'base64'));
      return path;
    },
    async close() {
      try { ws.close(); } catch { /* already closed */ }
      proc.kill();
      await sleep(400);
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold files */ }
    },
  };

  await page.viewport(width, height, mobile);
  return page;
}

// ---------------------------------------------------------------- CLI
async function cli() {
  const [cmd, target, third, ...rest] = process.argv.slice(2);
  if (!cmd || !target || !third) {
    console.log('usage:\n  node tools/cdp.mjs shot <page> <out.png> [WxH] [--mobile] [--full] [--wait=ms] [--eval=js]\n  node tools/cdp.mjs run <page> <scenario.mjs> [WxH] [--mobile]');
    process.exit(2);
  }
  const size = rest.find((a) => /^\d+x\d+$/.test(a));
  const [w, h] = size ? size.split('x').map(Number) : [1440, 900];
  const mobile = rest.includes('--mobile');
  const waitArg = rest.find((a) => a.startsWith('--wait='));
  const evalArg = rest.find((a) => a.startsWith('--eval='));
  const page = await launch({ width: w, height: h, mobile });
  let result;
  try {
    await page.goto(target, { wait: waitArg ? Number(waitArg.slice(7)) : 600 });
    if (cmd === 'shot') {
      if (evalArg) { result = await page.eval(evalArg.slice(7)); await sleep(400); }
      await page.screenshot(third, { fullPage: rest.includes('--full') });
      result = { screenshot: third, eval: result };
    } else if (cmd === 'run') {
      const mod = await import(pathToFileURL(resolve(third)).href);
      result = await mod.default(page, { url: toUrl(target) });
    } else {
      throw new Error(`unknown command ${cmd}`);
    }
  } catch (err) {
    result = { failed: String(err && err.stack || err) };
  }
  const errors = page.errors();
  await page.close();
  console.log(JSON.stringify({ result, errors }, null, 2));
  process.exit(errors.length || (result && result.failed) ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) cli();
