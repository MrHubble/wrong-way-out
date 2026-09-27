import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });
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
  await shot("01-title-final");
  await click("start:0");
  await sleep(350);
  await shot("02-courtyard-final");
  await go(-1.1, 1.1);
  assert.equal((await state()).action.kind, "lift");
  await tap("KeyF");
  assert.equal((await state()).carried, "crate");
  await go(2, -2.6);
  await face(2, -5);
  console.log("placement", await state());
  await tap("KeyF");
  assert.equal((await state()).carried, undefined);
  const placed = (await state()).props[0].position;
  await go(placed.x, placed.z, { jump: true });
  await sleep(350);
  console.log("on crate", await state());
  await tap("KeyF");
  await sleep(1800);
  await go(2, -6);
  assert.equal((await state()).screen, "win");
  console.log("PASS courtyard");
  await shot("03-courtyard-complete");
  await click("start:1");
  await go(1, 2.7);
  await tap("KeyF");
  assert.equal((await state()).shovel, true);
  for (let scoop = 0; scoop < 5; scoop++) {
    await go(scoop < 3 ? -0.5 : -2.5, -0.5, { jump: true });
    assert.equal((await state()).action.kind, "dig");
    await tap("KeyF");
    assert.equal((await state()).soil.carried, 1);
    await go(2.1, -1.26, { jump: true, tolerance: 0.12 });
    await face(2.5, -2.5);
    let s = await state();
    console.log("soil preview", s.action, s.feet);
    assert.equal(s.action.valid, true);
    assert.equal(s.action.target, "2.5,-2.5");
    await tap("KeyF");
    assert.equal((await state()).soil.total, 12);
  }
  await shot("04-window-mound");
  await go(2.5, -2.5, { jump: true });
  await sleep(450);
  console.log("on mound", await state());
  await go(2.3, -5.8, { jump: true });
  await sleep(650);
  await go(2, -6);
  assert.equal((await state()).screen, "win");
  console.log("PASS high window");
  await click("start:2");
  await go(1.4, 1.24);
  await face(1.8, 0);
  console.log("pack preview", (await state()).action);
  await tap("KeyF");
  await sleep(250);
  assert.equal((await state()).plate, true);
  await go(2, -6);
  assert.equal((await state()).screen, "win");
  console.log("PASS weight");
  await click("start:3");
  await go(-2, 0.9);
  await face(-2, -2);
  await keysHold(["KeyW", "KeyD", "Space"], 160);
  await sleep(300);
  assert.ok((await state()).feet.z < 0);
  await go(-2, -3.5);
  assert.equal((await state()).screen, "win");
  console.log("PASS seam shortcut");
  await click("start:4");
  await go(0.05, 2.75);
  await tap("KeyF");
  assert.equal((await state()).carried, "crate");
  await go(0.75, 0.9);
  await face(-2, 1.5);
  console.log("garden crate", (await state()).action);
  await tap("KeyF");
  const crate = (await state()).props[0].position;
  await go(crate.x, crate.z, { jump: true });
  await sleep(1000);
  await go(-2, 1.45, { jump: true });
  await sleep(1000);
  await shot("05-garden-plank");
  console.log("on plank", await state());
  await tap("Space");
  await sleep(1000);
  console.log("launch landing", await state());
  assert.ok((await state()).feet.y > 2.35, "Launch lands on the wall top");
  await go(-2, -3.5, { jump: true });
  assert.equal((await state()).screen, "win");
  console.log("PASS garden launch");
  await shot("06-finale");
  await fs.mkdir("test-results", { recursive: true });
  await page.context().storageState({ path: "test-results/completed.json" });
  await fs.writeFile(
    "docs/browser-progress.json",
    JSON.stringify({ state: await state(), errors }, null, 2),
  );
} catch (e) {
  console.error(e);
  await shot("failure");
  await fs.writeFile(
    "docs/browser-progress.json",
    JSON.stringify({ state: await state(), error: String(e), errors }, null, 2),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
