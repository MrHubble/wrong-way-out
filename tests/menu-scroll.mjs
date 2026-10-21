// Trusted single-finger scrolling and held-control release on the real build.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ??
    "/Users/mark/sites/watch-out-below/node_modules/@playwright/test/index.mjs"
);
const name = JSON.parse(fs.readFileSync("package.json")).name,
  game = {
    "the-wrong-way-out": "wrong",
    "rooftop-web-runner": "roof",
    paperbound: "paper",
    "never-turn-back": "never",
  }[name];
const cfg = {
  wrong: {
    start: '[data-action^="start:"].primary',
    pause: "[data-action=pause]",
    scroll: ".modal",
    move: "#stick",
    action: ".touch-jump",
  },
  roof: {
    start: "#enter",
    pause: "#pause",
    scroll: "#builder",
    move: "[data-action=left]",
    action: "[data-action=jump]",
  },
  paper: {
    start: "#menu-play",
    pause: "#open-menu",
    scroll: ".menu-sheet",
    move: null,
  },
  never: {
    start: "#start",
    pause: "#pause",
    scroll: ".dialog",
    move: "#joystick",
    action: "#jump",
  },
}[game];
const out = "docs/menu-zoom-review",
  phase = process.env.SCROLL_URL ? "live" : "local";
fs.mkdirSync(out, { recursive: true });
let server,
  base = process.env.SCROLL_URL;
if (!base) {
  const root = path.resolve("dist"),
    types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".glb": "model/gltf-binary",
    };
  server = http.createServer((req, res) => {
    const f = path.resolve(
      root,
      "." +
        (req.url === "/"
          ? "/index.html"
          : new URL(req.url, "http://localhost").pathname),
    );
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
const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
  }),
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  }),
  page = await context.newPage(),
  cdp = await context.newCDPSession(page),
  checks = [],
  errors = [];
let exception = null;
const observations = {};
page.on("pageerror", (e) => errors.push(String(e)));
const check = (label, ok, detail) => {
  checks.push({ label, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) throw Error(label);
};
const point = async (selector, id) =>
    page
      .locator(selector)
      .first()
      .evaluate((e, id) => {
        const r = e.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, id };
      }, id),
  tap = async (s) => {
    const p = await point(s, 1);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(150);
  },
  send = (type, points = []) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator(cfg.start).first().waitFor();
  if (game === "never")
    await page.waitForFunction(() => window.__adventure?.worldReady);
  await tap(cfg.start);
  if (game === "paper") {
    const before = await page.evaluate(() => window.__paperbound.state().fold);
    await tap("#fold-auto");
    await page.waitForTimeout(1700);
    const after = await page.evaluate(() => window.__paperbound.state().fold);
    observations.fold = { before, after };
    check(
      "trusted Fold control advances the actual paper model",
      JSON.stringify(before) !== JSON.stringify(after),
      observations.fold,
    );
  } else {
    const a = await point(cfg.move, 11),
      b = await point(cfg.action, 12),
      moved = { ...a, x: a.x + 12, y: a.y - 25 };
    await send("touchStart", [a]);
    await send("touchMove", [moved]);
    await send("touchStart", [moved, b]);
    await page.waitForTimeout(200);
    const held = await page.evaluate(
      (game) =>
        game === "roof"
          ? document.querySelectorAll("#touch .pressed").length === 2
          : !!document.querySelector(
              game === "wrong" ? "#stick>div" : "#stick-knob",
            ).style.transform,
      game,
    );
    check(
      "trusted opposite-edge movement and action handlers both receive the hold",
      held,
    );
    await send("touchCancel");
    await page.waitForTimeout(120);
    const released = await page.evaluate(
      (game) =>
        game === "roof"
          ? !document.querySelector("#touch .pressed")
          : !document.querySelector(
              game === "wrong" ? "#stick>div" : "#stick-knob",
            ).style.transform,
      game,
    );
    check("trusted cancellation releases actual held control state", released);
  }
  await tap(cfg.pause);
  if (game === "roof") {
    await page
      .getByRole("button", { name: "LEVELS / BUILD TRACK", exact: true })
      .first()
      .tap();
    await tap("#build");
  }
  await page.setViewportSize({
    width: 390,
    height: game === "never" ? 200 : 260,
  });
  await page.waitForTimeout(250);
  const container = page.locator(cfg.scroll).first(),
    before = await container.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return {
        top: e.scrollTop,
        height: e.clientHeight,
        total: e.scrollHeight,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        touchAction: getComputedStyle(e).touchAction,
        viewport: {
          width: visualViewport.width,
          height: visualViewport.height,
          left: visualViewport.offsetLeft,
          top: visualViewport.offsetTop,
          scale: visualViewport.scale,
        },
      };
    });
  observations.scrollBefore = before;
  check(
    "short-height menu has real vertical overflow and pan-y ownership",
    before.total > before.height + 5 && before.touchAction === "pan-y",
    before,
  );
  await page.evaluate(() => {
    window.__scrollTouches = [];
    document.addEventListener(
      "touchmove",
      (e) =>
        window.__scrollTouches.push({
          trusted: e.isTrusted,
          prevented: e.defaultPrevented,
          count: e.touches.length,
        }),
      { capture: true, passive: true },
    );
  });
  const r = before.rect,
    a = {
      x: r.x + r.width * 0.2 - before.viewport.left,
      y: Math.min(r.y + 90 - before.viewport.top, before.viewport.height * 0.4),
      id: 51,
    },
    distance = Math.max(50, Math.min(170, a.y - Math.max(r.y + 20, 20)));
  observations.anchor = { ...a, distance };
  observations.layoutMetrics = await cdp.send("Page.getLayoutMetrics");
  console.log(
    JSON.stringify({ anchor: observations.anchor, viewport: before.viewport }),
  );
  await cdp.send("Input.synthesizeScrollGesture", {
    x: a.x,
    y: a.y,
    yDistance: -distance,
    speed: 500,
    preventFling: true,
    gestureSourceType: "touch",
  });
  await page.waitForTimeout(250);
  const after = await container.evaluate((e) => ({
      top: e.scrollTop,
      scale: visualViewport.scale,
    })),
    events = await page.evaluate(() => window.__scrollTouches);
  observations.scrollAfter = after;
  observations.trustedTouches = events;
  check(
    "trusted native single-finger pan scrolls the menu without page zoom",
    after.top > before.top && after.scale === 1,
    { before, after },
  );
  check(
    "scroll path retains trusted uncancelled single-touch moves",
    events.some((e) => e.trusted && !e.prevented && e.count === 1),
    events,
  );
  const buttonPoint = await container.evaluate((e) => {
    const v = visualViewport;
    for (const b of e.querySelectorAll("button:not(:disabled)")) {
      const r = b.getBoundingClientRect();
      if (r.top >= 10 && r.bottom <= v.height - 5)
        return {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          text: b.textContent,
        };
    }
    return null;
  });
  check(
    "scrolling menu exposes a real enabled button for the swipe-start probe",
    !!buttonPoint,
    buttonPoint,
  );
  const topBeforeButton = await container.evaluate((e) => e.scrollTop);
  await page.evaluate(() => {
    window.__menuScrollClicks = [];
    document.addEventListener(
      "click",
      (e) =>
        window.__menuScrollClicks.push({
          trusted: e.isTrusted,
          detail: e.detail,
          target: e.target.textContent,
        }),
      true,
    );
  });
  await cdp.send("Input.synthesizeScrollGesture", {
    x: buttonPoint.x,
    y: buttonPoint.y,
    yDistance: 60,
    speed: 400,
    gestureSourceType: "touch",
  });
  await page.waitForTimeout(220);
  const buttonScroll = await container.evaluate((e) => ({
    top: e.scrollTop,
    scale: visualViewport.scale,
    clicks: window.__menuScrollClicks,
  }));
  observations.buttonScroll = {
    before: topBeforeButton,
    point: buttonPoint,
    after: buttonScroll,
  };
  check(
    "trusted swipe beginning on a menu button scrolls without activating it",
    buttonScroll.top < topBeforeButton &&
      buttonScroll.clicks.length === 0 &&
      buttonScroll.scale === 1,
    buttonScroll,
  );
  await page.screenshot({
    path: path.join(out, `scroll-${phase}.jpg`),
    type: "jpeg",
    quality: 82,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  check("menu scrolling adds no page errors", errors.length === 0, errors);
} catch (e) {
  exception = String(e.stack ?? e);
  checks.push({
    label: "scroll verification completes",
    ok: false,
    detail: exception,
  });
  console.log(exception);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    path.join(out, `scroll-${phase}.json`),
    JSON.stringify(
      {
        game,
        date: new Date().toISOString(),
        base,
        browser: browser.version(),
        method:
          "Trusted Chrome native touch scroll synthesis and opposite-edge CDP controls; no game-state injection or performance claims",
        checks,
        observations,
        errors,
        exception,
      },
      null,
      2,
    ) + "\n",
  );
  await browser.close();
  if (server) await new Promise((r) => server.close(r));
}
console.log(`${checks.filter((c) => c.ok).length}/${checks.length} passed`);
