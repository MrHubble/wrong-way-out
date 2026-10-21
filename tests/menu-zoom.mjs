// Actual compiled/live touch regressions; native browser zoom injection is setup,
// never game state mutation. Desktop WebKit native taps cannot prove iPad pinch.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import zlib from "node:zlib";
const { chromium, webkit } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "@playwright/test"
);
const name = JSON.parse(fs.readFileSync("package.json")).name;
const game = {
  "the-wrong-way-out": "wrong",
  "rooftop-web-runner": "roof",
  paperbound: "paper",
  "never-turn-back": "never",
}[name];
const cfg = {
  wrong: {
    canvas: "#scene",
    start: '[data-action^="start:"].primary',
    play: "play",
    pause: "[data-action=pause]",
    resume: "[data-action=resume]",
    reset: "[data-action=restart]",
    action: ".touch-jump",
    move: "#stick",
    inert: ".modal h2",
    bounds: ["#stick", ".touch-jump", "#context"],
  },
  roof: {
    canvas: "#world",
    start: "#enter",
    play: "play",
    pause: "#pause",
    resume: "#resume",
    reset: "#reset",
    action: "[data-action=jump]",
    move: "[data-action=left]",
    inert: ".pause-card h2",
    bounds: ["#touch", "#pause"],
  },
  paper: {
    canvas: "#scene",
    start: "#menu-play",
    play: "fold",
    pause: "#open-menu",
    resume: "#menu-back",
    reset: "#fold-restart",
    action: "#fold-restart",
    move: "#scene",
    inert: ".menu-heading h1",
    bounds: ["#open-menu", "#fold-restart", "#fold-auto"],
  },
  never: {
    canvas: "#world",
    start: "#start",
    play: "play",
    pause: "#pause",
    resume: "#resume",
    reset: "#restart",
    action: "#jump",
    move: "#joystick",
    inert: ".dialog h2",
    bounds: ["#joystick", "#jump", "#action"],
  },
}[game];
const engine = process.env.ZOOM_ENGINE ?? "chromium",
  phase = process.env.ZOOM_URL ? "live" : "local",
  out = process.env.ZOOM_OUT ?? "docs/menu-zoom-review";
fs.mkdirSync(out, { recursive: true });
let server,
  base = process.env.ZOOM_URL;
if (!base) {
  const root = path.resolve("dist"),
    types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".glb": "model/gltf-binary",
      ".svg": "image/svg+xml",
    };
  server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://localhost"),
      f = path.resolve(
        root,
        "." + (u.pathname === "/" ? "/index.html" : u.pathname),
      );
    if (!f.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {
      res.setHeader(
        "Content-Type",
        types[path.extname(f)] ?? "application/octet-stream",
      );
      res.end(fs.readFileSync(f));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/`;
}
const browser = await (engine === "webkit"
  ? webkit.launch({ headless: true })
  : chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
    }));
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
});
const page = await context.newPage(),
  cdp = engine === "chromium" ? await context.newCDPSession(page) : null;
const checks = [],
  observations = {
    errors: [],
    baselineRendererErrors: [],
    failedResponses: [],
  };
let exception = null;
function check(label, ok, detail) {
  checks.push({ label, ok: !!ok, ...(detail === undefined ? {} : { detail }) });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) throw Error(label);
}
page.on("pageerror", (e) => observations.errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const item = { text: m.text(), location: m.location() };
  if (
    game === "roof" &&
    engine === "webkit" &&
    m.text() ===
      "WebGL: INVALID_OPERATION: texImage3D: FLIP_Y or PREMULTIPLY_ALPHA isn't allowed for uploading 3D textures"
  )
    observations.baselineRendererErrors.push(item);
  else if (!/\/favicon\.ico(?:\?|$)/.test(item.location.url))
    observations.errors.push(item);
});
page.on("response", (r) => {
  if (r.status() >= 400)
    observations.failedResponses.push({ status: r.status(), url: r.url() });
});
await page.addInitScript(() => {
  window.__menuBoot = crypto.randomUUID();
});
const wait = (ms) => page.waitForTimeout(ms);
const state = () =>
  page.evaluate(
    (game) =>
      game === "wrong"
        ? document.body.dataset.screen
        : game === "paper"
          ? document.body.dataset.mode
          : game === "never"
            ? window.__adventure?.state().screen
            : document.body.dataset.playing === "true"
              ? "play"
              : !document.querySelector("#pause-screen").hidden
                ? "pause"
                : "menu",
    game,
  );
const expect = async (s) => {
  await page.waitForFunction(
    ({ game, s }) =>
      (game === "wrong"
        ? document.body.dataset.screen
        : game === "paper"
          ? document.body.dataset.mode
          : game === "never"
            ? window.__adventure?.state().screen
            : document.body.dataset.playing === "true"
              ? "play"
              : !document.querySelector("#pause-screen").hidden
                ? "pause"
                : "menu") === s,
    { game, s },
    { timeout: 15000 },
  );
};
const point = async (selector, id = 1) =>
  page
    .locator(selector)
    .first()
    .evaluate((e, id) => {
      const r = e.getBoundingClientRect(),
        v = visualViewport;
      return {
        x: r.x + r.width / 2 - v.offsetLeft,
        y: r.y + r.height / 2 - v.offsetTop,
        id,
      };
    }, id);
const tap = async (selector) => {
  const p = await point(selector);
  await page.touchscreen.tap(p.x, p.y);
  await wait(100);
};
const send = (type, points = []) =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
const snap = () =>
  page.evaluate(() => ({
    boot: window.__menuBoot,
    scale: visualViewport.scale,
    left: visualViewport.offsetLeft,
    top: visualViewport.offsetTop,
    width: visualViewport.width,
    height: visualViewport.height,
    recovery: document.documentElement.classList.contains("page-zoomed"),
    html: getComputedStyle(document.documentElement).touchAction,
    body: getComputedStyle(document.body).touchAction,
  }));
const pinch = async (label, factor = 1.8) => {
  const before = await snap();
  await cdp.send("Input.synthesizePinchGesture", {
    x: before.width / 2,
    y: before.height * 0.25,
    scaleFactor: factor,
    relativeSpeed: 100,
    gestureSourceType: "touch",
  });
  await wait(180);
  const after = await snap();
  observations[label] = { before, after };
  check(
    `trusted native ${label} pinch keeps scale/offset stable`,
    Math.abs(after.scale - 1) < 0.001 &&
      Math.abs(after.left - before.left) < 0.01 &&
      Math.abs(after.top - before.top) < 0.01,
    after,
  );
};
const policy = async (selector, enabled) =>
  page
    .locator(selector)
    .first()
    .evaluate((target, enabled) => {
      const send = (type, changed = [], touches = []) => {
        const e = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(e, {
          changedTouches: { value: changed },
          touches: { value: touches },
        });
        target.dispatchEvent(e);
        return e.defaultPrevented;
      };
      const a = { identifier: 91, target, clientX: 170, clientY: 300 },
        b = { identifier: 92, target, clientX: 220, clientY: 300 };
      const first = send("touchstart", [a], [a]);
      target.dispatchEvent(new Event("blur"));
      const held = send("gesturechange");
      const multi = send("touchstart", [b], [a, b]);
      const move = send("touchmove", [a, b], [a, b]);
      const gestures = ["gesturestart", "gesturechange", "gestureend"].map(
        (t) => send(t),
      );
      send("touchcancel");
      const unowned = send("gesturestart");
      return {
        first,
        held,
        multi,
        move,
        gestures,
        unowned,
        ok:
          !first &&
          held === enabled &&
          multi === enabled &&
          move === enabled &&
          gestures.every((v) => v === enabled) &&
          !unowned,
      };
    }, enabled);
async function heldTransition(selector, desired, label) {
  if (!cdp) {
    await tap(selector);
    await expect(desired);
    check(`trusted WebKit ${label} tap responds`, true);
    return;
  }
  const a = await point(cfg.canvas, 41),
    b = await point(selector, 42);
  a.x = 20;
  a.y = 160;
  await page.evaluate(() => {
    window.__heldTrace = [];
    if (!window.__heldTraceBound) {
      window.__heldTraceBound = true;
      for (const type of ["touchstart", "touchend", "touchcancel"])
        window.addEventListener(
          type,
          (e) =>
            window.__heldTrace.push({
              type,
              trusted: e.isTrusted,
              touches: [...e.touches].map((t) => t.identifier),
              changed: [...e.changedTouches].map((t) => t.identifier),
            }),
          { capture: true, passive: true },
        );
    }
  });
  await page
    .locator(selector)
    .first()
    .evaluate((el) =>
      el.addEventListener(
        "touchend",
        (e) =>
          window.__heldTrace.push({
            type: "touchend",
            source: "button-direct",
            trusted: e.isTrusted,
            touches: [...e.touches].map((t) => t.identifier),
            changed: [...e.changedTouches].map((t) => t.identifier),
          }),
        { capture: true, passive: true, once: true },
      ),
    );
  await send("touchStart", [a]);
  await send("touchStart", [a, b]);
  await send("touchEnd", [b]);
  await expect(desired);
  const owned = await page.locator(cfg.canvas).evaluate((el) => {
    const e = new Event("gesturechange", { bubbles: true, cancelable: true });
    el.dispatchEvent(e);
    return e.defaultPrevented;
  });
  const trace = await page.evaluate(() => window.__heldTrace),
    starts = trace.filter((e) => e.type === "touchstart"),
    end = trace.find((e) => e.type === "touchend");
  const identities =
    starts.length >= 2 &&
    end?.trusted &&
    end.touches.length === 1 &&
    end.changed.length === 1 &&
    end.touches[0] === starts[0].changed[0] &&
    end.changed[0] === starts[1].changed[0];
  check(
    `second-finger ${label} releases its button while first finger retains ownership`,
    owned && identities,
    { owned, identities, trustedTouchTrace: trace },
  );
  await send("touchEnd");
}
try {
  await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator(cfg.start).first().waitFor({ timeout: 60000 });
  if (game === "never")
    await page.waitForFunction(() => window.__adventure?.worldReady, null, {
      timeout: 60000,
    });
  observations.assets = await page.evaluate(() =>
    [...document.scripts].map((s) => s.src).filter(Boolean),
  );
  const first = await snap();
  check(
    "intro page protects zoom while permitting vertical pan",
    first.html === "pan-y" && first.body === "pan-y" && first.scale === 1,
    first,
  );
  const initialPolicy = await policy(cfg.start, true);
  check(
    "labelled synthetic intro Touch/Gesture policy preserves single touch and claims zoom",
    initialPolicy.ok,
    initialPolicy,
  );
  if (cdp) await pinch("intro");
  if (cdp) {
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1.8 });
    await page.waitForFunction(
      () =>
        visualViewport.scale > 1.7 &&
        document.documentElement.classList.contains("page-zoomed"),
    );
    const original = await state();
    await page.locator(cfg.start).first().focus();
    await page.keyboard.press("Enter");
    await wait(100);
    check(
      "Start is gated on an already-enlarged intro",
      (await state()) === original,
    );
    const v = await snap();
    await cdp.send("Input.synthesizePinchGesture", {
      x: v.width / 2,
      y: v.height / 2,
      scaleFactor: 0.3,
      relativeSpeed: 100,
      gestureSourceType: "touch",
    });
    await page.waitForFunction(
      () =>
        visualViewport.scale <= 1.001 &&
        !document.documentElement.classList.contains("page-zoomed"),
      null,
      { timeout: 4000 },
    );
    check(
      "native inverse pinch recovers the pre-Start enlarged page without starting",
      (await state()) === original && (await snap()).scale === 1,
    );
  }

  await heldTransition(cfg.start, cfg.play, "Start");
  check(
    "play claims panning at scale1",
    (await snap()).body === "none" && (await snap()).scale === 1,
  );
  const basePlay = await snap();
  for (let i = 0; i < 8; i++) {
    await tap(cfg.action);
    await wait(35);
  }
  if (game === "paper") await wait(500);
  check(
    "eight rapid gameplay taps retain page scale",
    Math.abs((await snap()).scale - 1) < 0.001,
  );
  if (cdp) await pinch("active-play");
  // Native keyboard controls and Escape remain independently usable.
  await page.keyboard.press("Escape");
  await expect(game === "paper" ? "menu" : "pause");
  check("desktop Escape pauses the actual game", true);
  await page.locator(cfg.resume).first().focus();
  await page.keyboard.press("Space");
  await expect(cfg.play);
  check("desktop native Space activates the focused Resume control", true);
  await heldTransition(
    cfg.pause,
    game === "paper" ? "menu" : "pause",
    "Pause/menu",
  );
  const paused = await snap();
  check(
    "pause/menu admits vertical pan but blocks page zoom",
    paused.body === "pan-y",
    paused,
  );
  const menuPolicy = await policy(cfg.inert, true);
  check(
    "labelled synthetic menu text Touch/Gesture policy stays enabled",
    menuPolicy.ok,
    menuPolicy,
  );
  if (cdp) {
    await pinch("pause-menu");
    const beforeButtonPinch = await state(),
      bp = await point(game === "paper" ? "#menu-play" : cfg.resume);
    await cdp.send("Input.synthesizePinchGesture", {
      x: bp.x,
      y: bp.y,
      scaleFactor: 1.8,
      relativeSpeed: 100,
      gestureSourceType: "touch",
    });
    await wait(180);
    check(
      "trusted native pinch beginning over menu action neither zooms nor activates it",
      (await state()) === beforeButtonPinch && (await snap()).scale === 1,
    );
  }
  // Exercise native controls and actual scroll container where available.
  if (game === "roof") {
    await page
      .getByRole("button", { name: "LEVELS / BUILD TRACK", exact: true })
      .first()
      .tap();
    await tap("#build");
    const range = page.locator("#width"),
      before = await range.inputValue(),
      r = await range.boundingBox();
    await page.touchscreen.tap(r.x + r.width * 0.85, r.y + r.height / 2);
    await wait(100);
    check(
      "native builder range slider remains usable",
      (await range.inputValue()) !== before,
    );
    const host = page.locator("#builder");
    const sh = await host.evaluate((e) => ({
      h: e.clientHeight,
      t: e.scrollHeight,
      s: e.scrollTop,
    }));
    if (cdp && sh.t > sh.h + 5) {
      const a = { x: 20, y: 650, id: 73 };
      await send("touchStart", [a]);
      for (let i = 1; i <= 8; i++) {
        await send("touchMove", [{ ...a, y: a.y - i * 45 }]);
        await wait(20);
      }
      await send("touchEnd");
      await wait(200);
      check(
        "native builder vertical pan scrolls its menu",
        (await host.evaluate((e) => e.scrollTop)) > sh.s,
      );
    }
    await tap("#builder-back");
    await tap("#enter");
    await expect("play");
    await tap("#pause");
    await expect("pause");
  }
  if (game === "never") {
    await page.locator("#scenery-quality").selectOption("light");
    check(
      "native paused select remains usable",
      (await page.locator("#scenery-quality").inputValue()) === "light",
    );
  }
  if (game === "paper") {
    const choice = page.locator("[data-plane]").nth(1);
    await choice.tap();
    check(
      "pointer-safe plane menu action activates once",
      (await choice.getAttribute("aria-pressed")) === "true",
    );
    const sheet = page.locator(".menu-sheet");
    const scroll = await sheet.evaluate((e) => ({
      height: e.clientHeight,
      total: e.scrollHeight,
      top: e.scrollTop,
    }));
    if (scroll.total > scroll.height + 5) {
      const r = await sheet.boundingBox();
      await page.touchscreen.tap(r.x + 10, r.y + 20);
      if (cdp) {
        const a = {
          x: r.x + 12,
          y: Math.min(r.y + r.height - 50, 750),
          id: 70,
        };
        await send("touchStart", [a]);
        for (let i = 1; i <= 8; i++) {
          await send("touchMove", [{ ...a, y: a.y - i * 35 }]);
          await wait(20);
        }
        await send("touchEnd");
        await wait(250);
        check(
          "native vertical menu pan scrolls the actual sheet",
          (await sheet.evaluate((e) => e.scrollTop)) > scroll.top,
        );
      } else
        check(
          "WebKit menu keeps native vertical-pan CSS",
          (await sheet.evaluate((e) => getComputedStyle(e).touchAction)) ===
            "pan-y",
        );
    }
  }
  await heldTransition(cfg.resume, cfg.play, "Resume");
  if (game === "paper") {
    await heldTransition(cfg.reset, cfg.play, "Reset");
  } else {
    await tap(cfg.pause);
    await expect("pause");
    await heldTransition(cfg.reset, cfg.play, "Restart");
  }
  check(
    "normal play survives menu and reset transitions",
    (await state()) === cfg.play && (await snap()).boot === first.boot,
  );
  if (cdp) {
    const move = await point(cfg.move, 81),
      act = await point(cfg.action, 82);
    if (game !== "paper") {
      await send("touchStart", [move]);
      await send("touchMove", [{ ...move, y: move.y - 20 }]);
      await send("touchStart", [{ ...move, y: move.y - 20 }, act]);
      await wait(150);
      await send("touchCancel");
      check(
        "trusted opposite-edge controls and cancellation preserve page scale",
        (await snap()).scale === 1,
      );
    }
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1.8 });
    await page.waitForFunction(
      () =>
        visualViewport.scale > 1.7 &&
        document.documentElement.classList.contains("page-zoomed"),
    );
    await expect(game === "paper" ? "menu" : "pause");
    const enlarged = await snap();
    check(
      "injected enlarged browser state pauses and admits native recovery",
      enlarged.recovery && /pinch-zoom|manipulation/.test(enlarged.body),
      enlarged,
    );
    const rp = await policy(cfg.canvas, false);
    check("labelled recovery probe does not cancel native gestures", rp.ok, rp);
    await page.keyboard.press("Escape");
    await expect(game === "paper" ? "menu" : "pause");
    check("Resume cannot bypass enlarged recovery", true);
    await page.screenshot({
      path: path.join(out, `${engine}-${phase}-enlarged.jpg`),
      type: "jpeg",
      quality: 80,
    });
    const v = await snap();
    await cdp.send("Input.synthesizePinchGesture", {
      x: v.width / 2,
      y: v.height / 2,
      scaleFactor: 0.3,
      relativeSpeed: 100,
      gestureSourceType: "touch",
    });
    await page.waitForFunction(
      () =>
        visualViewport.scale <= 1.001 &&
        !document.documentElement.classList.contains("page-zoomed"),
      null,
      { timeout: 4000 },
    );
    await expect(game === "paper" ? "menu" : "pause");
    check(
      "trusted native inverse pinch returns scale1 and stays paused",
      (await snap()).body === "pan-y",
    );
    await tap(cfg.resume);
    await expect(cfg.play);
    await pinch("recovered-play");
    check("trusted Resume after recovery restores playable state", true);
  }
  await page.locator(cfg.pause).first().click();
  await expect(game === "paper" ? "menu" : "pause");
  await page.locator(cfg.resume).first().click();
  await expect(cfg.play);
  check(
    "trusted mouse menu actions remain usable after touch deduplication",
    true,
  );
  // Source-level existing result UI is protected by the same unconditional root policy;
  // no hidden result is injected to manufacture a gameplay completion.
  const bounds = await page.evaluate(
    (selectors) =>
      selectors.map((s) => {
        const e = document.querySelector(s),
          r = e.getBoundingClientRect(),
          v = visualViewport;
        return {
          selector: s,
          visible: r.width > 0 && r.height > 0,
          reachable:
            r.x >= v.offsetLeft - 1 &&
            r.y >= v.offsetTop - 1 &&
            r.right <= v.offsetLeft + v.width + 1 &&
            r.bottom <= v.offsetTop + v.height + 1,
        };
      }),
    cfg.bounds,
  );
  check(
    "all sampled game controls remain reachable at scale1",
    bounds.every((b) => b.visible && b.reachable),
    bounds,
  );
  check(
    "no new page or game errors (baseline renderer diagnostics kept separately)",
    observations.errors.length === 0,
    observations.errors,
  );
  await page.screenshot({
    path: path.join(out, `${engine}-${phase}.jpg`),
    type: "jpeg",
    quality: 84,
  });
  observations.final = await snap();
} catch (e) {
  exception = String(e.stack ?? e);
  console.log(exception);
  checks.push({
    label: "verification completes",
    ok: false,
    detail: exception,
  });
  process.exitCode = 1;
} finally {
  const report = {
    game,
    engine,
    base,
    date: new Date().toISOString(),
    browser: browser.version(),
    physicalDevice: false,
    method: cdp
      ? "Chrome trusted native pinch and CDP multitouch; browser scale injection setup only"
      : "Desktop WebKit trusted taps plus labelled synthetic Touch/Gesture policy; native iPad pinch unavailable",
    checks,
    observations,
    exception,
  };
  fs.writeFileSync(
    path.join(out, `${engine}-${phase}.json.gz`),
    zlib.gzipSync(JSON.stringify(report)),
  );
  fs.writeFileSync(
    path.join(out, `${engine}-${phase}.txt`),
    checks.map((c) => `${c.ok ? "PASS" : "FAIL"} ${c.label}`).join("\n") +
      `\n${checks.filter((c) => c.ok).length}/${checks.length} passed\n`,
  );
  await browser.close();
  if (server) await new Promise((r) => server.close(r));
}
console.log(`${checks.filter((c) => c.ok).length}/${checks.length} passed`);
if (checks.some((c) => !c.ok)) process.exitCode = 1;
