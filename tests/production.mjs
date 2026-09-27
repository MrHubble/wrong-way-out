import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });
const errors = [],
  failures = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("requestfailed", (r) => failures.push(r.url()));
page.on("response", (r) => {
  if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
});
try {
  await page.goto("http://127.0.0.1:4173/");
  await page.getByRole("button", { name: "Let’s find a way" }).waitFor();
  await page.getByRole("button", { name: "Let’s find a way" }).press("Space");
  await page.getByRole("heading", { name: "The Courtyard" }).waitFor();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(300);
  await page.keyboard.up("KeyW");
  await page.keyboard.press("Space");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "docs/screenshots/production-desktop.png" });
  assert.equal(await page.evaluate(() => typeof window.__game), "undefined");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "docs/screenshots/production-phone.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  await fs.writeFile(
    "docs/production-results.json",
    JSON.stringify(
      {
        passed: true,
        assetFailures: failures,
        pageErrors: errors,
        viewportSizes: ["1200x750", "390x844"],
        readOnlyDiagnosticsAbsent: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS production root assets, keyboard start, real-time movement/jump smoke, desktop and phone layouts",
  );
} finally {
  await browser.close();
}
