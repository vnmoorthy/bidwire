// Bidwire UI QA: opens every page, clicks every safe button, runs the core demo flows through the real UI,
// and reports console errors, page crashes and failed API calls. Usage: node scripts/qa.mjs [baseUrl]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(new URL("../web/package.json", import.meta.url));
const { chromium } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:8787";
const OUT = "/tmp/bw-qa"; mkdirSync(OUT, { recursive: true });
const issues = []; const notes = [];
const api = async (p, body) => (await fetch(BASE + p, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: "chrome", headless: true });
function watch(page, label) {
  page.on("console", (m) => { if (m.type() === "error") issues.push(`[${label}] console error: ${m.text().slice(0, 220)}`); });
  page.on("pageerror", (e) => issues.push(`[${label}] page crash: ${String(e).slice(0, 220)}`));
  page.on("response", (r) => { const u = r.url(); if (u.includes("/api/") && r.status() >= 400 && !u.includes("/feed")) issues.push(`[${label}] ${r.request().method()} ${u.replace(BASE, "")} → ${r.status()}`); });
}

// 1) Every page renders without errors, at desktop and phone sizes.
const ROUTES = ["/", "/exchange", "/connect", "/ledger", "/director", "/merchant", "/phone"];
for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  for (const r of ROUTES) {
    const page = await ctx.newPage(); watch(page, `${tag} ${r}`);
    await page.goto(BASE + r, { waitUntil: "domcontentloaded" });
    await sleep(1800);
    const text = (await page.locator("body").innerText()).trim();
    if (text.length < 40) issues.push(`[${tag} ${r}] page looks empty (${text.length} chars)`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    if (overflow) issues.push(`[${tag} ${r}] horizontal overflow (page wider than the screen)`);
    await page.screenshot({ path: `${OUT}/${tag}${r === "/" ? "-home" : r.replace(/\//g, "-")}.png` });
    await page.close();
  }
  await ctx.close();
}

// 2) Click every safe button on each product page (skip destructive/navigation ones).
const SKIP = /reset|leave|delete|clear|log ?out|deny|decline|approve|place bid|buy|open my store|register|join|bots|window|seconds|\b\d+s\b|sound|run demo|start agent/i;
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const r of ["/exchange", "/connect", "/ledger", "/director"]) {
  const page = await ctx.newPage(); watch(page, `click ${r}`);
  await page.goto(BASE + r, { waitUntil: "domcontentloaded" }); await sleep(1500);
  const buttons = page.locator("button:visible");
  const n = await buttons.count(); let clicked = 0;
  for (let i = 0; i < Math.min(n, 40); i++) {
    const b = buttons.nth(i);
    const label = ((await b.innerText().catch(() => "")) || (await b.getAttribute("aria-label").catch(() => "")) || "").trim();
    if (SKIP.test(label) || /^run$/i.test(label) && r === "/director") continue;
    try { await b.click({ timeout: 1500 }); clicked++; await sleep(250); await page.keyboard.press("Escape"); } catch { /* covered or detached */ }
  }
  notes.push(`${r}: clicked ${clicked}/${n} buttons`);
  await page.close();
}

// 3) Demo flow through the UI: Director scenario → auction closes → purchase lands.
{
  const page = await ctx.newPage(); watch(page, "flow director");
  const before = (await api("/api/state")).stats;
  await page.goto(BASE + "/director", { waitUntil: "domcontentloaded" }); await sleep(1500);
  const card = page.locator("text=65W travel charger").first();
  if (await card.count()) {
    const runBtn = page.locator(":is(div,li,article,section):has-text('65W travel charger') >> button:has-text('Run')").last();
    await runBtn.click({ timeout: 3000 }).catch(() => issues.push("[flow director] could not click Run on the travel-charger scenario"));
  } else issues.push("[flow director] scenario list not visible");
  await sleep(18000);
  const after = (await api("/api/state")).stats;
  if (after.auctions <= before.auctions) issues.push("[flow director] running a scenario did not open an auction");
  if (after.orders <= before.orders) notes.push("director scenario: no new order (may need approval) — check");
  await page.close();
}

// 4) Exchange: the live board updates and the auction drawer opens.
{
  const page = await ctx.newPage(); watch(page, "flow exchange");
  await page.goto(BASE + "/exchange", { waitUntil: "domcontentloaded" }); await sleep(1200);
  await api("/api/demo/scenario", { id: "flight-headphones" });
  await sleep(4000);
  const live = await page.locator("body").innerText();
  if (!/noise cancelling headphones/i.test(live)) issues.push("[flow exchange] new auction did not appear live on the Exchange within 4s");
  await sleep(14000);
  const closed = await page.locator("body").innerText();
  if (!/withdrawn|misrepresentation|lied|caught/i.test(closed)) issues.push("[flow exchange] no withdrawn/lied marker visible after the auction closed");
  await page.screenshot({ path: `${OUT}/flow-exchange-closed.png` });
  await page.close();
}

// 5) Approver phone: approve the pending purchase from the UI.
{
  const page = await ctx.newPage(); watch(page, "flow phone");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + "/phone", { waitUntil: "domcontentloaded" }); await sleep(2000);
  const pending = (await api("/api/approvals")).filter((a) => a.status === "pending");
  if (pending.length) {
    const btn = page.getByRole("button", { name: /approve/i }).first();
    await btn.click({ timeout: 4000 }).catch(() => issues.push("[flow phone] no Approve button for a pending approval"));
    await sleep(2500);
    const ap = (await api("/api/approvals")).find((a) => a.id === pending[0].id);
    if (ap?.status !== "approved") issues.push(`[flow phone] approval still ${ap?.status} after tapping Approve`);
    await page.screenshot({ path: `${OUT}/flow-phone.png` });
  } else notes.push("phone: no pending approval to test");
  await page.close();
}

// 6) Merchant phone: open a store, bid on a live lot (lying), get withdrawn.
{
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await mctx.newPage(); watch(page, "flow merchant");
  await page.goto(BASE + "/merchant", { waitUntil: "domcontentloaded" }); await sleep(1500);
  const input = page.locator("input").first();
  await input.fill(`QA Store ${Date.now() % 1000}`).catch(() => issues.push("[flow merchant] no store-name input"));
  await page.getByRole("button", { name: /open|join|register|start/i }).first().click({ timeout: 3000 }).catch(() => issues.push("[flow merchant] no open-store button"));
  await sleep(2000);
  await api("/api/demo/scenario", { id: "room-auction" });
  await sleep(5000);
  const lot = page.locator("text=/waterproof travel backpack/i").first();
  if (await lot.count()) {
    await lot.click({ timeout: 3000 }).catch(() => {});
    await sleep(800);
    await page.screenshot({ path: `${OUT}/flow-merchant-sheet.png` });
    const bid = page.getByRole("button", { name: /place bid|raise|bid/i }).last();
    await bid.click({ timeout: 3000 }).catch(() => issues.push("[flow merchant] could not submit a bid from the sheet"));
    await sleep(3000);
    await page.screenshot({ path: `${OUT}/flow-merchant-after.png` });
  } else issues.push("[flow merchant] live lot did not appear in the merchant feed within 5s");
  await mctx.close();
}

// 7) Connect playground: run a tool from the browser.
{
  const page = await ctx.newPage(); watch(page, "flow connect");
  await page.goto(BASE + "/connect", { waitUntil: "domcontentloaded" }); await sleep(1500);
  const body = await page.locator("body").innerText();
  if (!/claude mcp add/i.test(body)) issues.push("[flow connect] Claude Code snippet not visible");
  const run = page.getByRole("button", { name: /^run|run tool|call/i }).first();
  if (await run.count()) { await run.click().catch(() => {}); await sleep(2500); const t = await page.locator("body").innerText(); if (!/wallet|result|offers|error/i.test(t)) issues.push("[flow connect] playground run showed no result"); }
  else issues.push("[flow connect] no Run button in the playground");
  await page.close();
}

await ctx.close(); await browser.close();
console.log(`\nNOTES:\n${notes.map((n) => "  - " + n).join("\n")}`);
console.log(`\nISSUES (${issues.length}):\n${[...new Set(issues)].map((i) => "  - " + i).join("\n") || "  none"}`);
console.log(`\nScreenshots: ${OUT}`);
