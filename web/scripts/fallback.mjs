// QA for the polling fallback + reset handling.
// Blocks /api/stream (like a tunnel that buffers SSE), checks the pill says "Live · polling",
// runs a scenario, counts UI effects, then resets from the Director and checks the merchant
// phone falls back to the join screen. Usage: node scripts/fallback.mjs [baseUrl]
import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] || "http://localhost:8787";
const out = fileURLToPath(new URL("../screenshots/", import.meta.url));
function findChromium() {
  const root = join(homedir(), "Library/Caches/ms-playwright");
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse())
    for (const sub of ["chrome-headless-shell-mac-arm64", "chrome-headless-shell-mac-x64", "chrome-headless-shell-linux64"]) {
      const p = join(root, d, sub, "chrome-headless-shell");
      if (existsSync(p)) return p;
    }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const browser = await chromium.launch({ executablePath: findChromium() });
async function open(path, w, h, { blockSse = false, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  if (blockSse) await page.route("**/api/stream", (r) => r.abort());
  page.on("pageerror", (e) => errors.push(`${path}: ${e}`));
  page.on("console", (m) => m.type() === "error" && !/api\/stream|ERR_FAILED/.test(m.text()) && errors.push(`${path}: ${m.text()}`));
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  return page;
}

const desk = await open("/exchange", 1920, 1080, { blockSse: true });
const merchant = await open("/merchant", 390, 844, { blockSse: true, mobile: true });
await sleep(5500);
const pill = await desk.locator("header").getByText(/^Live|Reconnecting|Connecting/).first().textContent();
console.log("desk pill (SSE blocked):", pill);

if (await merchant.locator("#store-name").count()) {
  await merchant.fill("#store-name", "Polling Test Store");
  await merchant.getByRole("button", { name: /open my store/i }).click();
}
await merchant.getByText(/your storefront/i).waitFor({ timeout: 10000 });

const r = await fetch(`${base}/api/demo/scenario`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "travel-charger" }) });
console.log("scenario travel-charger:", r.status);
let maxLie = 0, maxBribe = 0, maxSold = 0;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  maxLie = Math.max(maxLie, await desk.getByText(/^Caught lying · /).count());
  maxBribe = Math.max(maxBribe, await desk.getByText(/^Bribe ignored · /).count());
  maxSold = Math.max(maxSold, await desk.locator("text=/^Sold$/").count());
  if (i === 6) await desk.screenshot({ path: join(out, "fallback-polling-bids.png") });
}
console.log(`effects while polling: lie banners max ${maxLie}, bribe banners max ${maxBribe}, sold toasts max ${maxSold}`);
await desk.screenshot({ path: join(out, "fallback-polling-closed.png") });

// Reset from the Director (two clicks: arm + confirm), then the merchant phone should show the join screen.
const director = await open("/director", 1600, 1000);
await sleep(1500);
await director.getByRole("button", { name: /reset demo/i }).click();
await director.getByRole("button", { name: /click again to confirm/i }).click();
await sleep(4500);
const note = await merchant.getByText(/exchange was reset/i).count();
console.log("merchant shows reset note:", note > 0);
await merchant.screenshot({ path: join(out, "fallback-merchant-after-reset.png") });
await desk.screenshot({ path: join(out, "exchange-after-reset.png") });
console.log(errors.length ? "ERRORS:\n" + errors.slice(0, 10).join("\n") : "no console errors");
await browser.close();
