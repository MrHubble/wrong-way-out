import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1200, height: 750 },
  storageState: "test-results/completed.json",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await fs.mkdir("docs/screenshots", { recursive: true });
const state = () => page.evaluate(() => window.__game);
const sleep = (ms) => page.clock.runFor(ms);
async function tap(key) {
  await page.keyboard.down(key);
  await sleep(35);
  await page.keyboard.up(key);
  await sleep(55);
}
async function keysHold(keys, ms) {
  for (const k of keys) await page.keyboard.down(k);
  await sleep(ms);
  for (const k of keys) await page.keyboard.up(k);
  await sleep(20);
}
async function go(x, z, { jump = false, tolerance = 0.18, limit = 80 } = {}) {
  for (let i = 0; i < limit; i++) {
    const s = await state();
    if (s.screen !== "play") return;
    const dx = x - s.feet.x,
      dz = z - s.feet.z,
      dist = Math.hypot(dx, dz);
    if (dist < tolerance) return;
    const lx = dx * Math.cos(s.angle) - dz * Math.sin(s.angle),
      lz = dx * Math.sin(s.angle) + dz * Math.cos(s.angle);
    const angle = Math.atan2(lz, lx);
    const dirs = [
      ["KeyD"],
      ["KeyD", "KeyS"],
      ["KeyS"],
      ["KeyS", "KeyA"],
      ["KeyA"],
      ["KeyA", "KeyW"],
      ["KeyW"],
      ["KeyW", "KeyD"],
    ];
    const keys = dirs[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
    if (jump && s.grounded && i % 2 === 0) keys.push("Space");
    await keysHold(keys, Math.min(100, Math.max(25, dist * 180)));
  }
  throw new Error(
    "Could not reach " + x + "," + z + " " + JSON.stringify(await state()),
  );
}
async function face(x, z) {
  const s = await state(),
    dx = x - s.feet.x,
    dz = z - s.feet.z,
    lx = dx * Math.cos(s.angle) - dz * Math.sin(s.angle),
    lz = dx * Math.sin(s.angle) + dz * Math.cos(s.angle);
  const dirs = [
    ["KeyD"],
    ["KeyD", "KeyS"],
    ["KeyS"],
    ["KeyS", "KeyA"],
    ["KeyA"],
    ["KeyA", "KeyW"],
    ["KeyW"],
    ["KeyW", "KeyD"],
  ];
  await keysHold(
    dirs[(Math.round(Math.atan2(lz, lx) / (Math.PI / 4)) + 8) % 8],
    25,
  );
}
async function shot(name) {
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
}
async function click(action) {
  await page.locator(`[data-action="${action}"]`).click({ force: true });
  await sleep(180);
}
try {
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__game?.screen === "title");
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await click("levels");
  await click("start:3");
  await go(3.5, 1);
  await go(3.5, -3.85);
  await go(-2, -3.85);
  assert.equal((await state()).screen, "win");
  console.log("PASS ordinary seam route");
  await click("start:4");
  await go(3.5, 2.8);
  await go(3.5, -3.85);
  await go(-2, -3.85);
  assert.equal((await state()).screen, "win");
  console.log("PASS ordinary garden route");
  await click("levels");
  await click("timed:3");
  assert.equal((await state()).elapsed, 0);
  await sleep(1000);
  assert.equal((await state()).elapsed, 0);
  await go(-2, 0.9);
  await face(-2, -2);
  await keysHold(["KeyW", "KeyD", "Space"], 160);
  await sleep(300);
  await go(-2, -3.5);
  assert.equal((await state()).screen, "win");
  assert.ok(await page.getByText("A NEW PERSONAL BEST").count());
  await shot("07-personal-best");
  console.log("PASS timed personal best");
  await click("timed:3");
  await keysHold(["KeyW"], 100);
  assert.equal((await state()).ghostVisible, true);
  await shot("08-ghost");
  await tap("Escape");
  assert.equal((await state()).valid, false);
  await click("resume");
  await click("restart");
  assert.equal((await state()).valid, true);
  assert.equal((await state()).elapsed, 0);
  await click("levels");
  await click("start:3");
  assert.equal((await state()).ghostVisible, false);
  console.log("PASS ghost visibility and timing policy");
  // Rotation must retain the original basis until all movement is released.
  await page.keyboard.down("KeyW");
  await sleep(100);
  const a = await state();
  await tap("KeyE");
  await sleep(100);
  const b = await state();
  await page.keyboard.up("KeyW");
  assert.ok(b.feet.z < a.feet.z);
  assert.ok(b.feet.x < a.feet.x);
  await sleep(40);
  await keysHold(["KeyW"], 100);
  const c = await state();
  assert.ok(c.feet.x < b.feet.x);
  assert.ok(c.feet.z > b.feet.z);
  console.log("PASS held movement during rotation");
  await click("levels");
  await click("start:2");
  await go(1.8, 0);
  assert.equal((await state()).plate, true);
  await go(1.4, 1.24);
  await face(1.8, 0);
  await tap("KeyF");
  await sleep(200);
  assert.equal((await state()).plate, true);
  await tap("KeyF");
  await go(-1, 1);
  assert.equal((await state()).plate, false);
  await face(-4, 1);
  await tap("KeyF");
  await go(1.8, 0);
  assert.equal((await state()).plate, false);
  console.log("PASS player and backpack weights");
  await click("levels");
  await click("start:1");
  await go(1, 2.7);
  await tap("KeyF");
  await go(-0.5, -0.5);
  await tap("KeyF");
  await go(2.1, -1.26);
  await face(2.5, -2.5);
  await tap("KeyF");
  assert.equal((await state()).soil.total, 12);
  await go(2.5, -1.65);
  assert.equal((await state()).action.kind, "retrieve");
  await tap("KeyF");
  assert.equal((await state()).soil.carried, 1);
  assert.equal((await state()).soil.piles.length, 0);
  await go(2.1, 1.74);
  await face(2.5, 0.5);
  assert.equal((await state()).action.valid, true);
  await tap("KeyF");
  assert.equal((await state()).soil.total, 12);
  assert.equal((await state()).soil.piles[0][0], "2.5,0.5");
  await click("recover");
  assert.deepEqual((await state()).soil.patches, [3, 3, 3, 3]);
  assert.equal((await state()).soil.piles.length, 0);
  assert.equal((await state()).shovel, false);
  console.log("PASS misplaced soil retrieval and complete recovery");
  for (let i = 0; i < 4; i++) {
    await click("restart");
    assert.equal((await state()).soil.total, 12);
    assert.equal((await state()).soil.piles.length, 0);
  }
  await click("levels");
  await click("start:0");
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(500);
  await shot("09-phone-gameplay");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const cdp = await context.newCDPSession(page);
  const stick = await page.locator("#stick").boundingBox();
  const jump = await page.locator(".touch-jump").boundingBox();
  const sx = stick.x + stick.width / 2,
    sy = stick.y + stick.height / 2,
    jx = jump.x + jump.width / 2,
    jy = jump.y + jump.height / 2;
  const before = await state();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: sx, y: sy, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: sx + 35, y: sy, id: 1 }],
  });
  await sleep(100);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: sx + 35, y: sy, id: 1 },
      { x: jx, y: jy, id: 2 },
    ],
  });
  await sleep(180);
  const during = await state();
  assert.ok(during.feet.y > before.feet.y + 0.5);
  assert.ok(during.feet.x > before.feet.x + 0.2);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await sleep(800);
  const released = await state();
  await sleep(250);
  assert.ok(
    Math.hypot(
      (await state()).feet.x - released.feet.x,
      (await state()).feet.z - released.feet.z,
    ) < 0.02,
  );
  console.log("PASS simultaneous touch movement and jump / release");
  await click("restart");
  await go(-1.1, 1.1);
  const actionButton = await page.locator("#context").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: actionButton.x + 80, y: actionButton.y + 20, id: 3 }],
  });
  await sleep(100);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await sleep(200);
  assert.equal((await state()).carried, "crate");
  console.log("PASS single touch lift");
  await click("recover");
  assert.equal((await state()).carried, undefined);
  await click("hint");
  assert.equal(await page.getByText("A LITTLE NUDGE · 1 / 3").count(), 1);
  await click("more-hint");
  await click("more-hint");
  assert.equal(await page.getByText("A LITTLE NUDGE · 3 / 3").count(), 1);
  await click("resume");
  await tap("Escape");
  await click("settings");
  await click("toggle:audio");
  await click("toggle:reduced");
  await click("back");
  await click("title");
  await shot("10-phone-title");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("wrong-way-out-v1")),
  );
  assert.equal(saved.audio, false);
  assert.equal(saved.reduced, true);
  assert.ok(saved.completed.every(Boolean));
  assert.ok(saved.best[3] > 0);
  assert.ok(saved.ghosts[3].length > 0);
  await page.reload();
  await sleep(500);
  assert.ok(await page.getByRole("button", { name: "Unmute audio" }).count());
  assert.ok((await state()).completed.every(Boolean));
  console.log("PASS hints, settings and save/load");
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "docs/extended-results.json",
    JSON.stringify(
      {
        passed: true,
        errors,
        checks: [
          "ordinary routes",
          "timed best",
          "ghost",
          "pause/reset policy",
          "camera movement basis",
          "pressure weights",
          "soil recovery",
          "repeated restart",
          "phone layout",
          "simultaneous touch",
          "single-tap action",
          "hints",
          "save/load",
        ],
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e);
  await shot("extended-failure");
  await fs.writeFile(
    "docs/extended-results.json",
    JSON.stringify({ state: await state(), error: String(e), errors }, null, 2),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
