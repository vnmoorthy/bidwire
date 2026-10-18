// End-to-end visual QA against a running server: a merchant joins from a phone, a scenario runs,
// the merchant bids (lying), the approver approves on /phone. Screenshots land in web/screenshots/flow-*.png.
// Usage: node scripts/flow.mjs [baseUrl] [scenarioId]
import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] || "http://localhost:8787";
const scenario = process.argv[3] || "flight-headphones";
const out = fileURLToPath(new URL("../screenshots/", import.meta.url));
mkdirSync(out, { recursive: true });

function findChromium() {
  const root = join(homedir(), "Library/Caches/ms-playwright");
  if (!existsSync(root)) return undefined;
  for (const d of readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse()) {
    for (const sub of ["chrome-headless-shell-mac-arm64", "chrome-headless-shell-mac-x64", "chrome-headless-shell-linux64"]) {
      const p = join(root, d, sub, "chrome-headless-shell");
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const errors = [];
const browser = await chromium.launch({ executablePath: findChromium() });
const mk = async (w, h, mobile, path) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${path}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${path}: ${m.text()}`));
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  return page;
};
const shot = (page, name) => page.screenshot({ path: join(out, `flow-${name}.png`) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const desk = await mk(1920, 1080, false, "/exchange");
const merchant = await mk(390, 844, true, "/merchant");
const phone = await mk(390, 844, true, "/phone");
await sleep(1500);

// A. merchant opens a store
if (await merchant.locator("#store-name").count()) {
  await merchant.fill("#store-name", "QA Gadget Hut");
  await merchant.getByRole("button", { name: /register and take a paddle|open my store/i }).click();
}
await merchant.getByText(/your storefront/i).waitFor({ timeout: 10000 });
await sleep(800);
await shot(merchant, "merchant-home");

// B. run the scenario
const r = await fetch(`${base}/api/demo/scenario`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: scenario }) });
console.log("scenario:", r.status, (await r.text()).slice(0, 120));

// C. bids streaming on the big screen
await sleep(2600);
await shot(desk, "exchange-bidding");

// D. merchant bids, lying about the price
try {
  await merchant.getByRole("button", { name: /raise paddle|bid on this/i }).first().click({ timeout: 8000 });
  await sleep(500);
  await shot(merchant, "bid-sheet");
  for (let i = 0; i < 25; i++) await merchant.getByRole("button", { name: /lower price by \$1/i }).click();
  await sleep(300);
  await shot(merchant, "bid-sheet-lying");
  await merchant.getByRole("button", { name: /raise paddle at|place bid/i }).click();
  await sleep(2500);
  await shot(merchant, "bid-status");
} catch (e) {
  console.log("merchant bid step skipped:", String(e).split("\n")[0]);
}

await sleep(1500);
await shot(desk, "exchange-after-lie");

// E. close + ranking
await sleep(9000);
await shot(desk, "exchange-closed");
await shot(merchant, "bid-result");

// F. approval on the phone
try {
  await phone.getByRole("button", { name: /^approve$/i }).last().waitFor({ timeout: 20000 });
  await sleep(400);
  await shot(phone, "phone-approval");
  await phone.getByRole("button", { name: /^approve$/i }).last().click();
  await sleep(2500);
  await shot(phone, "phone-approved");
} catch (e) {
  console.log("approval step skipped:", String(e).split("\n")[0]);
}
await sleep(2500);
await shot(desk, "exchange-sold");

console.log(errors.length ? "ERRORS:\n" + errors.slice(0, 12).join("\n") : "no console errors");
await browser.close();
