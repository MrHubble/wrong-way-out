// Shared functional adapters for four Worker games. Native input checks, no FPS claims.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import http from 'node:http';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const name = JSON.parse(fs.readFileSync('package.json')).name;
const game = ({ 'the-wrong-way-out': 'wrong', 'paperbound': 'paper', 'rooftop-web-runner': 'roof', 'never-turn-back': 'never' })[name];
if (!game) throw new Error(`No touch adapter for ${name}`);
const engine = process.env.ZOOM_ENGINE ?? 'chromium';
const out = process.env.ZOOM_OUT ?? 'docs/touch-zoom-review';
fs.mkdirSync(out, { recursive: true });
let server, base = process.env.ZOOM_URL;
if (!base) {
  const root = path.resolve('dist');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
  server = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, `.${p === '/' ? '/index.html' : p}`);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try { const bytes = fs.readFileSync(file); res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream'); res.end(bytes); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/`;
}
const browser = engine === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader=false'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await context.newPage(), cdp = engine === 'chromium' ? await context.newCDPSession(page) : null;
const checks = [], observations = { consoleErrors: [], failedResponses: [], baselineRendererErrors: [] }, errors = []; let exception = null;
const check = (label, ok, detail) => { checks.push({ label, ok, ...(!ok ? { detail } : {}) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${!ok ? ': ' + JSON.stringify(detail) : ''}`); };
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') {
  const item = { text: m.text(), location: m.location() }; observations.consoleErrors.push(item);
  const known = game === 'roof' && engine === 'webkit' && item.text === "WebGL: INVALID_OPERATION: texImage3D: FLIP_Y or PREMULTIPLY_ALPHA isn't allowed for uploading 3D textures";
  if (known) observations.baselineRendererErrors.push(item);
  if (!known && !/\/favicon\.ico(?:\?|$)/.test(item.location.url)) errors.push(item);
} });
page.on('response', r => { if (r.status() >= 400) observations.failedResponses.push({ status: r.status(), url: r.url() }); });
await page.addInitScript(() => { window.__zoomBoot = crypto.randomUUID(); });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const canvas = game === 'wrong' || game === 'paper' ? '#scene' : '#world';
const sel = ({ wrong: { start: '[data-action^="start:"].primary', move: '#stick', action: '.touch-jump', pause: '[data-action="pause"]', resume: '[data-action="resume"]', bounds: ['#scene', '#stick', '.touch-jump', '#context'] },
  roof: { start: '#enter', move: '[data-action="left"]', action: '[data-action="jump"]', pause: '#pause', resume: '#resume', bounds: ['#world', '#touch', '#pause'] },
  paper: { start: '#menu-play', move: '#pad', action: '#fold-restart', pause: '#open-menu', resume: '#menu-back', bounds: ['#scene', '#open-menu', '#fold-restart'] },
  never: { start: '#start', move: '#joystick', action: '#jump', pause: '#pause', resume: '#resume', bounds: ['#world', '#joystick', '#jump', '#action'] } })[game];
async function centre(selector) { const b = await page.locator(selector).first().boundingBox(); if (!b) throw new Error(`Missing ${selector}`); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
async function tap(selector) { const p = await centre(selector); if (cdp) { await touch('touchStart', [{ ...p, id: 1 }]); await wait(35); await touch('touchEnd', []); } else await page.touchscreen.tap(p.x, p.y); await wait(70); }
async function screen() { return page.evaluate(game => game === 'wrong' ? document.body.dataset.screen : game === 'paper' ? document.body.dataset.mode : game === 'never' ? window.__adventure?.state().screen : document.body.dataset.playing === 'true' ? 'play' : !document.getElementById('pause-screen').hidden ? 'pause' : 'menu', game); }
async function awaitScreen(value) { for (let i = 0; i < (value === 'result' ? 600 : 150); i++) { if (await screen() === value) return; await wait(50); } throw new Error(`Expected ${value}, got ${await screen()}`); }
async function snapshot() { return page.evaluate(selectors => { const v = visualViewport; return { boot: window.__zoomBoot, scale: v?.scale, left: v?.offsetLeft, top: v?.offsetTop, width: innerWidth, height: innerHeight, scrollX, scrollY,
  bodyTouchAction: getComputedStyle(document.body).touchAction, bounds: selectors.map(selector => { const b = document.querySelector(selector).getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; }) }; }, sel.bounds); }
const stable = (a, b) => a.boot === b.boot && ['scale', 'left', 'top', 'width', 'height', 'scrollX', 'scrollY'].every(k => Math.abs(a[k] - b[k]) < .01)
  && a.bounds.every((v, i) => v.every((n, j) => Math.abs(n - b.bounds[i][j]) < 1));
async function policy(active) { return page.evaluate(({ canvas, active }) => { const el = document.querySelector(canvas), results = [];
  const before = new Event('gesturestart', { bubbles: true, cancelable: true }); el.dispatchEvent(before);
  results.push({ type: 'unowned-desktop-gesture', ok: !before.defaultPrevented });
  const points = [{ identifier: 71, target: el }, { identifier: 72, target: el }];
  for (const type of ['touchstart', 'touchmove', 'gesturestart', 'gesturechange', 'gestureend', 'touchend']) {
    const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperties(e, { touches: { value: type === 'touchend' ? [] : points }, changedTouches: { value: points } }); el.dispatchEvent(e);
    results.push({ type, prevented: e.defaultPrevented, ok: e.defaultPrevented === active });
  }
  return results;
}, { canvas, active }); }
async function pinch() { const a = { x: 210, y: 400, id: 31 }, b = { x: 295, y: 400, id: 32 }; await touch('touchStart', [a]); await touch('touchStart', [a, b]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ ...a, x: a.x - i * 5 }, { ...b, x: b.x + i * 5 }]); await wait(25); } await touch('touchEnd', []); }
try {
  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator(sel.start).first().waitFor({ timeout: 60000 });
  if (game === 'never') await page.waitForFunction(() => window.__adventure?.worldReady, null, { timeout: 60000 });
  observations.render = await page.evaluate(selector => { const gl = document.querySelector(selector).getContext('webgl2'), ext = gl?.getExtension('WEBGL_debug_renderer_info'); return { webgl: !!gl, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER), ua: navigator.userAgent }; }, canvas);
  check('actual WebGL game loads', observations.render.webgl, observations.render);
  if (cdp) check('Chrome uses the Mac Metal renderer', /Metal/.test(observations.render.renderer), observations.render);
  await tap(sel.start); await awaitScreen(game === 'paper' ? 'fold' : 'play');
  const baseline = observations.baseline = await snapshot();
  check('native title tap enters active play with touch-action none', baseline.bodyTouchAction === 'none', baseline);
  observations.playPolicy = await policy(true);
  check('synthetic Safari owned-touch and Gesture policy cancels only play defaults', observations.playPolicy.every(c => c.ok), observations.playPolicy);
  for (let i = 0; i < 8; i++) { await tap(sel.action); await wait(30); }
  if (game === 'paper') await wait(1700);
  check('rapid native gameplay taps preserve viewport scale and all control bounds', stable(baseline, await snapshot()));
  if (game === 'wrong' && await page.locator('[data-action="run"]').count()) { await tap('[data-action="run"]'); check('native Run pointer action toggles once', await page.locator('[data-action="run"]').getAttribute('aria-pressed') === 'true'); await tap('[data-action="run"]'); }
  if (game === 'roof') { const before = await page.locator('#auto-steer').getAttribute('aria-pressed'); await tap('#auto-steer'); check('native auto-steer pointer action toggles once', await page.locator('#auto-steer').getAttribute('aria-pressed') !== before); }
  if (game === 'never') { const order = []; for (let i = 0; i < 3; i++) { await tap('#camera'); order.push(await page.evaluate(() => window.__adventure.state().camera)); } check('native Camera retains First / Behind / Front order without double dispatch', order.join('/') === 'first/back/front', order); }
  if (game === 'paper') {
    await tap('#open-menu'); await awaitScreen('menu'); await tap('#menu-back'); await awaitScreen('fold');
    check('native Planes menu returns to the interrupted fold', true);
    for (let i = 0; i < 5 && !await page.evaluate(() => window.__paperbound.state().fold.done); i++) { await tap('#fold-auto'); await wait(1700); }
    await tap('#to-launch'); await awaitScreen('launch'); sel.bounds = ['#scene', '#open-menu', '#pad', '#launch']; observations.launchBaseline = await snapshot();
  }
  const activeBase = await snapshot();
  if (cdp) {
    const move = { ...await centre(sel.move), id: 11 }, moved = { ...move, y: move.y - (game === 'roof' ? 0 : 30), x: move.x + (game === 'roof' ? 0 : 15) };
    const action = { ...await centre(game === 'paper' ? '#launch' : sel.action), id: 12 };
    const before = game === 'never' ? await page.evaluate(() => window.__adventure.state().walkDistance) : null;
    await touch('touchStart', [move]); await touch('touchMove', [moved]); await touch('touchStart', [moved, action]); await wait(220);
    const held = await page.evaluate(game => game === 'paper' ? window.__paperbound.state().primaryHeld : game === 'roof' ? document.querySelector('[data-action="left"]').classList.contains('pressed') && document.querySelector('[data-action="jump"]').classList.contains('pressed') : game === 'never' ? window.__adventure.state().walkDistance : document.querySelector('#stick>div').style.transform, game);
    check('real Chrome two-thumb movement and action reach the game', game === 'never' ? held > before : !!held, held);
    await touch('touchCancel', []); await wait(100);
    check('real multi-touch cancellation clears held control visuals', await page.evaluate(game => game === 'paper' ? !document.querySelector('#launch').classList.contains('held') && !document.querySelector('#pad').classList.contains('held') : game === 'roof' ? !document.querySelector('#touch .pressed') : game === 'wrong' ? !document.querySelector('#stick>div').style.transform : !window.__adventure.state().running, game));
    if (game === 'paper') { await tap('#launch'); await awaitScreen('fly'); check('a real released Launch control throws and enters physical flight', await page.evaluate(() => !!window.__paperbound.state().flight)); await awaitScreen('result'); await tap('#open-menu'); await awaitScreen('menu'); check('the same native menu control remains usable after a physical flight result', true); await tap('#menu-back'); await awaitScreen('result'); await tap('#result-retry'); await awaitScreen('launch'); }
    const pinchBase = await snapshot(); await pinch(); await wait(100);
    check('real Chrome pinch keeps page scale, offsets and control bounds fixed', stable(pinchBase, await snapshot()));
    const stick = { ...await centre(sel.move), id: 21 }, pause = { ...await centre(sel.pause), id: 22 };
    await touch('touchStart', [stick]); await touch('touchMove', [{ ...stick, y: stick.y - 20 }]); await touch('touchStart', [{ ...stick, y: stick.y - 20 }, pause]); await wait(150); await touch('touchEnd', []);
    check('opposite-edge second-thumb Pause/menu works while movement remains held', ['pause', 'menu'].includes(await screen()), { screen: await screen(), hit: await page.evaluate(p => document.elementFromPoint(p.x,p.y)?.outerHTML, pause) });
  } else {
    check('WebKit native touch action still responds', game === 'paper' ? await page.evaluate(() => window.__paperbound.state().fold.done) : await screen() === 'play');
    if (game === 'paper') { await tap('#launch'); await awaitScreen('fly'); check('native WebKit Launch tap enters physical flight', await page.evaluate(() => !!window.__paperbound.state().flight)); await awaitScreen('result'); await tap('#open-menu'); await awaitScreen('menu'); check('native WebKit result menu still works after prior play touches', true); await tap('#menu-back'); await awaitScreen('result'); await tap('#result-retry'); await awaitScreen('launch'); }
    await tap(sel.pause);
  }
  await awaitScreen(game === 'paper' ? 'menu' : 'pause');
  observations.menuPolicy = await policy(false);
  check('paused/menu gestures remain native and stale play ownership is released', observations.menuPolicy.every(c => c.ok), observations.menuPolicy);
  if (game === 'roof') {
    await page.getByRole('button', { name: 'LEVELS / BUILD TRACK', exact: true }).first().tap(); await tap('#build');
    const input = page.locator('#width'), before = await input.inputValue(), p = await input.boundingBox();
    await page.touchscreen.tap(p.x + p.width * .8, p.y + p.height / 2); await wait(100);
    const after = await input.inputValue(); check('native builder range slider remains usable outside play', after !== before, { before, after });
    await tap('#builder-back'); const auto = await page.locator('#auto-steer').getAttribute('aria-pressed'); await tap('#auto-steer'); check('native intro auto-steer still works after its earlier play pointer action', await page.locator('#auto-steer').getAttribute('aria-pressed') !== auto); await tap('#enter'); await awaitScreen('play');
  } else if (game === 'never') {
    await page.locator('#scenery-quality').selectOption('light'); check('paused native quality selector remains usable', await page.evaluate(() => window.__adventure.state().quality) === 'light'); await tap(sel.resume); await awaitScreen('play');
  } else if (game === 'paper') {
    const choice = page.locator('[data-plane]').nth(1); await choice.tap(); check('native plane menu buttons remain usable', await choice.getAttribute('aria-pressed') === 'true'); await tap(sel.resume); await awaitScreen('launch');
  } else {
    await tap('[data-action="settings"]'); await tap('[data-action="toggle:reduced"]'); check('native paused settings remain usable', await screen() === 'settings'); await tap('[data-action="back"]'); await tap(sel.resume); await awaitScreen('play');
  }
  check('normal gameplay resumes after the native menu', await screen() === (game === 'paper' ? 'launch' : 'play'));
  observations.final = await snapshot();
  check('same document survives without page zoom or reload', observations.final.boot === baseline.boot && Math.abs(observations.final.scale - baseline.scale) < .01);
  check('no new gameplay errors (baseline diagnostics retained separately)', errors.length === 0, errors);
  if (!process.env.ZOOM_NO_SHOTS) await page.screenshot({ path: path.join(out, `${engine}-${process.env.ZOOM_URL ? 'live' : 'local'}.jpg`), type: 'jpeg', quality: 84, scale: 'css' });
} catch (e) { exception = String(e.stack ?? e); check('touch verification completes', false, exception); }
finally {
  const report = { game, engine, url: base, date: new Date().toISOString(), browser: browser.version(), viewport: '390x844', physicalDevice: false,
    method: cdp ? 'Trusted Chrome CDP multitouch plus separately labelled synthetic Safari policy checks; no performance claims' : 'Desktop Playwright WebKit trusted taps and separately labelled synthetic Touch/Gesture policy; native iOS pinch is not available in this port', checks, observations, errors, exception };
  const stem = `${engine}-${process.env.ZOOM_URL ? 'live' : 'local'}`;
  fs.writeFileSync(path.join(out, stem + '.json.gz'), zlib.gzipSync(JSON.stringify(report)));
  fs.writeFileSync(path.join(out, stem + '.txt'), checks.map(c => `${c.ok ? 'PASS' : 'FAIL'} ${c.label}`).join('\n') + `\n${checks.filter(c => c.ok).length}/${checks.length} passed\n`);
  await browser.close(); if (server) await new Promise(resolve => server.close(resolve));
}
console.log(`${checks.filter(c => c.ok).length}/${checks.length} passed`);
if (checks.some(c => !c.ok)) process.exitCode = 1;
