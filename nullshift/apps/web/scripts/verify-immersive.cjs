const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const base = process.env.DEMO_BASE || "http://localhost:3109";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const output =
  process.env.DEMO_SCREENSHOTS ||
  fs.mkdtempSync(path.join(os.tmpdir(), "nullshift-verify-"));
console.log("Screenshots:", output);
(async () => {
  for (const [name, engine, width, reduced] of [
    ["desktop", chromium, 1440, "no-preference"],
    ["mobile", chromium, 390, "no-preference"],
    ["reduced", chromium, 1440, "reduce"],
    ["webkit", webkit, 1440, "no-preference"],
    ["webkit-mobile", webkit, 390, "reduce"],
  ]) {
    const browser = await engine.launch();
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: reduced,
    });
    const p = await context.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base, { waitUntil: "networkidle" });
    await p.waitForTimeout(3500);
    assert(await p.locator("h1").isVisible());
    assert.equal(await p.locator("[data-nextjs-dialog]").count(), 0);
    assert.equal(
      await p
        .locator('section[aria-label="Bespoke systems, built around you"] img')
        .evaluate((el) => el.complete && el.naturalWidth > 0),
      true
    );
    await p.screenshot({ path: `${output}/home-${name}.png` });
    for (let i = 0; i < 12; i++) {
      await p.mouse.wheel(0, 1500);
      await p.waitForTimeout(180);
      assert.equal(
        await p.evaluate(
          () =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth
        ),
        0,
        `${name} overflow`
      );
    }
    await p.goto(base + "/demo", { waitUntil: "networkidle" });
    const mutations = [];
    p.on("request", (req) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method())) mutations.push(req.url());
    });
    await p.getByRole("button", { name: "Simulate booking & payment" }).click();
    assert(await p.getByText("You’re on the list.").isVisible());
    await p.getByRole("button", { name: "Try the ticket scanner" }).click();
    await p.getByRole("button", { name: "Simulate scan", exact: true }).click();
    assert.match(await p.getByRole("status").innerText(), /Checked in — Sam Taylor/);
    await p.getByRole("button", { name: "Simulate scan", exact: true }).click();
    assert.match(await p.getByRole("status").innerText(), /Duplicate scan stopped/);
    await p.getByLabel("Demo ticket", { exact: true }).selectOption("DEMO-103");
    await p.getByRole("button", { name: "Simulate scan", exact: true }).click();
    assert.match(await p.getByRole("status").innerText(), /Payment outstanding/);
    await p.getByRole("button", { name: "View attendance" }).click();
    assert(
      await p.getByRole("button", { name: "Mark not arrived: Sam Taylor" }).isVisible()
    );
    await p.getByRole("button", { name: "Mark present: Alex Morgan" }).click();
    assert.match(await p.getByRole("status").innerText(), /Alex Morgan/);
    await p.screenshot({ path: `${output}/demo-${name}.png`, fullPage: true });
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      ),
      0
    );
    await p.getByRole("button", { name: "Reset demo" }).click();
    assert(
      await p.getByRole("button", { name: "Simulate booking & payment" }).isVisible()
    );
    assert.deepEqual(mutations, [], `${name} demo mutations`);
    await p.getByRole("link", { name: /^nullshift/ }).click();
    await p.waitForTimeout(2500);
    assert(await p.locator("h1").isVisible());
    assert.deepEqual(errors, [], name);
    console.log(
      JSON.stringify({
        name,
        home: "pass",
        demoFlow: "pass",
        routeReturn: "pass",
        errors,
        overflow: 0,
        mutationRequests: mutations,
      })
    );
    await browser.close();
  }
})();
