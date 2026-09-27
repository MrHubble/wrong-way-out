import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
// Playwright normally forces every page to stay focused/visible. A disposable,
// ordinary Chromium profile lets this test observe a real background tab.
const profile = await fs.mkdtemp(
  path.join(os.tmpdir(), "wrong-way-out-visibility-"),
);
const chrome = spawn(
  chromium.executablePath(),
  [
    "--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore" },
);
let browser;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = (
        await fs.readFile(path.join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  assert.ok(port, "Chromium opened its test-only debugging endpoint");
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
    noDefaults: true,
  });
  const context = browser.contexts()[0];
  await context.setStorageState("test-results/completed.json");
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5173");
  await page.bringToFront();
  await page.getByRole("button", { name: "Choose a chapter" }).click();
  await page.locator('[data-action="timed:3"]').click();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(100);
  await page.keyboard.up("KeyW");
  assert.equal(await page.evaluate(() => window.__game.valid), true);
  const other = await context.newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await page.waitForTimeout(250);
  const hidden = await page.evaluate(() => ({
    visibility: document.visibilityState,
    state: window.__game,
  }));
  assert.equal(hidden.visibility, "hidden");
  assert.equal(hidden.state.screen, "pause");
  assert.equal(hidden.state.valid, false);
  await fs.writeFile(
    "docs/visibility-results.json",
    JSON.stringify(
      {
        passed: true,
        visibility: hidden.visibility,
        screen: hidden.state.screen,
        runValid: hidden.state.valid,
      },
      null,
      2,
    ),
  );
  console.log("PASS real tab hiding pauses and invalidates the timed attempt");
} finally {
  await browser?.close();
  chrome.kill();
  await new Promise((r) => setTimeout(r, 300));
  await fs.rm(profile, { recursive: true, force: true });
}
