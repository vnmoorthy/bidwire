// Visual self-review: screenshots of every page at projector and phone sizes.
// Usage: node scripts/shots.mjs [baseUrl] [only]
import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] || "http://localhost:5173";
const only = process.argv[3];
const outDir = fileURLToPath(new URL("../screenshots/", import.meta.url));
mkdirSync(outDir, { recursive: true });

function findChromium() {
  const root = join(homedir(), "Library/Caches/ms-playwright");
  if (!existsSync(root)) return undefined;
  const shells = readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse();
  for (const d of shells) {
    for (const sub of ["chrome-headless-shell-mac-arm64", "chrome-headless-shell-mac-x64", "chrome-headless-shell-linux64"]) {
      const p = join(root, d, sub, "chrome-headless-shell");
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const pages = [
  { name: "exchange", path: "/exchange", w: 1920, h: 1080 },
  { name: "ledger", path: "/ledger", w: 1920, h: 1080 },
  { name: "connect", path: "/connect", w: 1920, h: 1080 },
  { name: "director", path: "/director", w: 1920, h: 1080 },
  { name: "phone-desktop", path: "/phone", w: 1920, h: 1080 },
  { name: "merchant", path: "/merchant", w: 390, h: 844, mobile: true },
  { name: "phone", path: "/phone", w: 390, h: 844, mobile: true },
  { name: "exchange-mobile", path: "/exchange", w: 390, h: 844, mobile: true },
];

const browser = await chromium.launch({ executablePath: findChromium() });
for (const p of pages) {
  if (only && !p.name.includes(only)) continue;
  const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 1, isMobile: !!p.mobile, hasTouch: !!p.mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + p.path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(outDir, `${p.name}.png`), fullPage: false });
  if (p.full) await page.screenshot({ path: join(outDir, `${p.name}-full.png`), fullPage: true });
  console.log(`${p.name}: ok${errors.length ? "  ERRORS: " + errors.slice(0, 5).join(" | ") : ""}`);
  await ctx.close();
}
await browser.close();
