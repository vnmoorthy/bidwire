// Seed data: a real-world product catalog, eight merchant personas (honest and not), and four buyer agents.
import { run, all, id, tx, wipe, setSetting } from "./db.js";
import { config } from "./env.js";
import type { Product } from "../../shared/types.js";

const usd = (d: number) => Math.round(d * 100);

export const PRODUCTS: Product[] = [
  // Headphones
  { sku: "sony-wh1000xm5", title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones", brand: "Sony", category: "headphones", emoji: "🎧", msrp_cents: usd(399.99),
    specs: { type: "over-ear", anc: true, battery_hours: 30, connector: "USB-C", multipoint: true, weight_g: 250 }, features: ["anc", "wireless", "over-ear", "usb-c", "multipoint", "30h-battery"] },
  { sku: "bose-qc-ultra", title: "Bose QuietComfort Ultra Headphones", brand: "Bose", category: "headphones", emoji: "🎧", msrp_cents: usd(429),
    specs: { type: "over-ear", anc: true, battery_hours: 24, connector: "USB-C", multipoint: true, weight_g: 254 }, features: ["anc", "wireless", "over-ear", "usb-c", "multipoint"] },
  { sku: "sennheiser-momentum-4", title: "Sennheiser Momentum 4 Wireless", brand: "Sennheiser", category: "headphones", emoji: "🎧", msrp_cents: usd(379.95),
    specs: { type: "over-ear", anc: true, battery_hours: 60, connector: "USB-C", multipoint: true, weight_g: 293 }, features: ["anc", "wireless", "over-ear", "usb-c", "multipoint", "30h-battery", "60h-battery"] },
  { sku: "apple-airpods-max", title: "Apple AirPods Max (USB-C)", brand: "Apple", category: "headphones", emoji: "🎧", msrp_cents: usd(549),
    specs: { type: "over-ear", anc: true, battery_hours: 20, connector: "USB-C", multipoint: false, weight_g: 385 }, features: ["anc", "wireless", "over-ear", "usb-c"] },
  { sku: "soundcore-space-q45", title: "Soundcore Space Q45 Adaptive ANC Headphones", brand: "Anker", category: "headphones", emoji: "🎧", msrp_cents: usd(149.99),
    specs: { type: "over-ear", anc: true, battery_hours: 50, connector: "USB-C", multipoint: true, weight_g: 295 }, features: ["anc", "wireless", "over-ear", "usb-c", "multipoint", "30h-battery"] },
  { sku: "jbl-tune-720bt", title: "JBL Tune 720BT Wireless Headphones", brand: "JBL", category: "headphones", emoji: "🎧", msrp_cents: usd(89.95),
    specs: { type: "over-ear", anc: false, battery_hours: 76, connector: "USB-C", multipoint: true, weight_g: 220 }, features: ["wireless", "over-ear", "usb-c", "multipoint", "30h-battery"] },
  // Chargers
  { sku: "anker-prime-100w", title: "Anker Prime 100W GaN Charger (3 ports)", brand: "Anker", category: "chargers", emoji: "🔌", msrp_cents: usd(84.99),
    specs: { watts: 100, ports: 3, gan: true, foldable_plug: true }, features: ["usb-c", "gan", "100w", "65w", "multi-port", "travel"] },
  { sku: "ugreen-nexode-65w", title: "UGREEN Nexode 65W USB-C GaN Charger", brand: "UGREEN", category: "chargers", emoji: "🔌", msrp_cents: usd(42.99),
    specs: { watts: 65, ports: 3, gan: true, foldable_plug: true }, features: ["usb-c", "gan", "65w", "multi-port", "travel"] },
  { sku: "apple-35w-dual", title: "Apple 35W Dual USB-C Port Compact Power Adapter", brand: "Apple", category: "chargers", emoji: "🔌", msrp_cents: usd(59),
    specs: { watts: 35, ports: 2, gan: false, foldable_plug: true }, features: ["usb-c", "multi-port", "travel"] },
  { sku: "belkin-boostcharge-108w", title: "Belkin BoostCharge Pro 108W 4-Port GaN Charger", brand: "Belkin", category: "chargers", emoji: "🔌", msrp_cents: usd(79.99),
    specs: { watts: 108, ports: 4, gan: true, foldable_plug: false }, features: ["usb-c", "gan", "100w", "65w", "multi-port"] },
  // Keyboards
  { sku: "logitech-mx-keys-s", title: "Logitech MX Keys S Wireless Keyboard", brand: "Logitech", category: "keyboards", emoji: "⌨️", msrp_cents: usd(109.99),
    specs: { switch: "scissor", backlit: true, devices: 3 }, features: ["wireless", "low-profile", "mac-layout", "backlit", "multi-device"] },
  { sku: "keychron-k2-v2", title: "Keychron K2 Wireless Mechanical Keyboard", brand: "Keychron", category: "keyboards", emoji: "⌨️", msrp_cents: usd(89.99),
    specs: { switch: "Gateron Brown", backlit: true, hot_swap: true }, features: ["mechanical", "wireless", "hot-swap", "mac-layout", "backlit"] },
  { sku: "keychron-q1-pro", title: "Keychron Q1 Pro Wireless Custom Mechanical Keyboard", brand: "Keychron", category: "keyboards", emoji: "⌨️", msrp_cents: usd(199),
    specs: { switch: "K Pro Red", backlit: true, hot_swap: true, case: "aluminum" }, features: ["mechanical", "wireless", "hot-swap", "mac-layout", "backlit"] },
  { sku: "apple-magic-keyboard-touchid", title: "Apple Magic Keyboard with Touch ID", brand: "Apple", category: "keyboards", emoji: "⌨️", msrp_cents: usd(149),
    specs: { switch: "scissor", backlit: false, touch_id: true }, features: ["wireless", "low-profile", "mac-layout", "touch-id"] },
  // Backpacks
  { sku: "peak-design-everyday-20l", title: "Peak Design Everyday Backpack 20L", brand: "Peak Design", category: "backpacks", emoji: "🎒", msrp_cents: usd(279.95),
    specs: { liters: 20, laptop_in: 16, weatherproof: true }, features: ["laptop-16", "waterproof", "carry-on"] },
  { sku: "aer-travel-pack-3", title: "Aer Travel Pack 3", brand: "Aer", category: "backpacks", emoji: "🎒", msrp_cents: usd(249),
    specs: { liters: 35, laptop_in: 16, weatherproof: true }, features: ["laptop-16", "waterproof", "carry-on", "travel"] },
  { sku: "osprey-farpoint-40", title: "Osprey Farpoint 40 Travel Pack", brand: "Osprey", category: "backpacks", emoji: "🎒", msrp_cents: usd(185),
    specs: { liters: 40, laptop_in: 15, weatherproof: false }, features: ["carry-on", "travel"] },
  { sku: "tnf-borealis", title: "The North Face Borealis Backpack", brand: "The North Face", category: "backpacks", emoji: "🎒", msrp_cents: usd(99),
    specs: { liters: 28, laptop_in: 15, weatherproof: false }, features: ["laptop-15"] },
  // Coffee
  { sku: "onyx-southern-weather", title: "Onyx Coffee Lab Southern Weather, Whole Bean 12oz", brand: "Onyx", category: "coffee", emoji: "☕", msrp_cents: usd(21),
    specs: { roast: "medium", origin: "blend", weight_oz: 12 }, features: ["whole-bean", "espresso"] },
  { sku: "counter-culture-hologram", title: "Counter Culture Hologram, Whole Bean 12oz", brand: "Counter Culture", category: "coffee", emoji: "☕", msrp_cents: usd(18.95),
    specs: { roast: "medium", origin: "blend", weight_oz: 12, organic: true }, features: ["whole-bean", "organic"] },
  { sku: "intelligentsia-black-cat", title: "Intelligentsia Black Cat Classic Espresso, 12oz", brand: "Intelligentsia", category: "coffee", emoji: "☕", msrp_cents: usd(21.95),
    specs: { roast: "medium-dark", origin: "blend", weight_oz: 12 }, features: ["whole-bean", "espresso"] },
  { sku: "stumptown-hair-bender", title: "Stumptown Hair Bender, Whole Bean 12oz", brand: "Stumptown", category: "coffee", emoji: "☕", msrp_cents: usd(19.99),
    specs: { roast: "medium", origin: "blend", weight_oz: 12 }, features: ["whole-bean", "espresso"] },
  // Monitors
  { sku: "dell-u2723qe", title: "Dell UltraSharp 27 4K USB-C Hub Monitor (U2723QE)", brand: "Dell", category: "monitors", emoji: "🖥️", msrp_cents: usd(579.99),
    specs: { size_in: 27, resolution: "3840x2160", panel: "IPS Black", usb_c_watts: 90, refresh_hz: 60 }, features: ["4k", "27in", "usb-c", "ips"] },
  { sku: "lg-27uk850", title: "LG 27UK850-W 27\" 4K UHD IPS USB-C Monitor", brand: "LG", category: "monitors", emoji: "🖥️", msrp_cents: usd(449.99),
    specs: { size_in: 27, resolution: "3840x2160", panel: "IPS", usb_c_watts: 60, refresh_hz: 60 }, features: ["4k", "27in", "usb-c", "ips"] },
  { sku: "asus-proart-pa278cv", title: "ASUS ProArt PA278CV 27\" WQHD USB-C Monitor", brand: "ASUS", category: "monitors", emoji: "🖥️", msrp_cents: usd(329),
    specs: { size_in: 27, resolution: "2560x1440", panel: "IPS", usb_c_watts: 65, refresh_hz: 75 }, features: ["27in", "usb-c", "ips", "1440p"] },
  { sku: "samsung-odyssey-g5", title: "Samsung Odyssey G5 27\" QHD 165Hz Monitor", brand: "Samsung", category: "monitors", emoji: "🖥️", msrp_cents: usd(279.99),
    specs: { size_in: 27, resolution: "2560x1440", panel: "VA", refresh_hz: 165 }, features: ["27in", "1440p", "144hz"] },
];

export const CATEGORIES: Record<string, { label: string; words: string[]; features: Record<string, string[]> }> = {
  headphones: { label: "Headphones", words: ["headphone", "headphones", "headset", "earphones", "noise cancel", "anc", "earbuds", "cans"],
    features: { anc: ["noise cancel", "noise-cancel", "anc", "quiet"], wireless: ["wireless", "bluetooth"], "over-ear": ["over-ear", "over ear"], "usb-c": ["usb-c", "usb c"], multipoint: ["multipoint", "two devices"], "30h-battery": ["long battery", "30h", "30 hour", "long flight", "flights", "flight"] } },
  chargers: { label: "Chargers", words: ["charger", "charging", "power adapter", "gan", "brick", "adapter"],
    features: { "usb-c": ["usb-c", "usb c"], gan: ["gan"], "65w": ["65w", "65 w", "laptop"], "100w": ["100w", "100 w"], "multi-port": ["multi-port", "multiport", "ports", "multiple devices"], travel: ["travel", "trip", "foldable"] } },
  keyboards: { label: "Keyboards", words: ["keyboard", "keyboards", "keeb"],
    features: { mechanical: ["mechanical"], wireless: ["wireless", "bluetooth"], "low-profile": ["low profile", "low-profile", "slim"], "hot-swap": ["hot-swap", "hot swap"], "mac-layout": ["mac", "macbook"], backlit: ["backlit", "backlight"], "touch-id": ["touch id", "touch-id"] } },
  backpacks: { label: "Backpacks", words: ["backpack", "bag", "travel pack", "daypack"],
    features: { "laptop-16": ["16", "laptop", "macbook pro"], waterproof: ["waterproof", "weatherproof", "rain"], "carry-on": ["carry-on", "carry on", "flight", "travel"], travel: ["travel", "trip"] } },
  coffee: { label: "Coffee", words: ["coffee", "beans", "espresso", "roast"],
    features: { "whole-bean": ["whole bean", "whole-bean", "beans"], espresso: ["espresso"], organic: ["organic"] } },
  monitors: { label: "Monitors", words: ["monitor", "display", "screen"],
    features: { "4k": ["4k", "uhd"], "27in": ["27"], "usb-c": ["usb-c", "usb c", "single cable"], ips: ["ips", "color accurate"], "144hz": ["144hz", "165hz", "gaming", "high refresh"], "1440p": ["1440p", "qhd"] } },
};

type Persona = { name: string; handle: string; strategy: string; trust: number; color: string; categories: string[]; priceFactor: number; shipping: number; ship_days: number; returns: number; stock: number; hiddenFee?: number; hiddenLabel?: string };

export const PERSONAS: Persona[] = [
  { name: "Northwind Electronics", handle: "northwind", strategy: "honest-value", trust: 84, color: "#36E3A0", categories: ["headphones", "chargers", "keyboards", "monitors"], priceFactor: 0.9, shipping: 0, ship_days: 3, returns: 30, stock: 25 },
  { name: "Parcel & Pine", handle: "parcel-pine", strategy: "premium-fast", trust: 91, color: "#5B8CFF", categories: ["headphones", "backpacks", "coffee", "keyboards"], priceFactor: 0.99, shipping: 0, ship_days: 1, returns: 60, stock: 25 },
  { name: "DealDrop Direct", handle: "dealdrop", strategy: "drip-pricing-liar", trust: 76, color: "#FF4D5E", categories: ["headphones", "chargers", "monitors", "keyboards"], priceFactor: 0.8, shipping: 0, ship_days: 4, returns: 14, stock: 50, hiddenFee: 2900, hiddenLabel: "Service & handling fee" },
  { name: "MegaMart Ads Co.", handle: "megamart", strategy: "briber", trust: 71, color: "#FFB547", categories: ["headphones", "chargers", "keyboards", "backpacks", "coffee", "monitors"], priceFactor: 1.05, shipping: 799, ship_days: 5, returns: 30, stock: 99 },
  { name: "Sundial Supply", handle: "sundial", strategy: "slow-shipper", trust: 80, color: "#B98CFF", categories: ["headphones", "backpacks", "coffee", "chargers"], priceFactor: 0.86, shipping: 0, ship_days: 9, returns: 30, stock: 30 },
  { name: "Specsmith", handle: "specsmith", strategy: "spec-stretcher", trust: 73, color: "#FF8A4C", categories: ["headphones", "chargers", "monitors"], priceFactor: 0.75, shipping: 499, ship_days: 3, returns: 14, stock: 40 },
  { name: "Last Unit Labs", handle: "last-unit", strategy: "scarce-stock", trust: 86, color: "#3DD9EB", categories: ["headphones", "keyboards", "chargers"], priceFactor: 0.85, shipping: 0, ship_days: 2, returns: 30, stock: 1 },
  { name: "Bean & Byte", handle: "bean-byte", strategy: "specialist", trust: 88, color: "#E8C872", categories: ["coffee", "keyboards", "backpacks"], priceFactor: 0.93, shipping: 0, ship_days: 2, returns: 30, stock: 20 },
  { name: "InjectCo", handle: "injectco", strategy: "prompt-injector", trust: 74, color: "#C2410C", categories: ["headphones", "chargers", "keyboards"], priceFactor: 0.97, shipping: 0, ship_days: 3, returns: 30, stock: 30 },
];

export const BUYERS = () => [
  { id: "b_claude", name: "Claude · Judge's agent", client: "claude", key: "bw_buy_claude_demo", human_name: "Judge (approver)", phone: config.approverPhone, email: config.receiptEmail, limit: 30000, daily: 150000, wallet: 300000 },
  { id: "b_chatgpt", name: "ChatGPT shopper", client: "chatgpt", key: "bw_buy_chatgpt_demo", human_name: "Priya (approver)", phone: config.approverPhone, email: config.receiptEmail, limit: 25000, daily: 100000, wallet: 200000 },
  { id: "b_codex", name: "Codex procurement bot", client: "codex", key: "bw_buy_codex_demo", human_name: "Ops lead (approver)", phone: config.approverPhone, email: config.receiptEmail, limit: 50000, daily: 200000, wallet: 500000 },
  { id: "b_guest", name: "Guest agent", client: "guest", key: "bw_buy_guest", human_name: "Guest owner", phone: null, email: null, limit: 15000, daily: 50000, wallet: 50000 },
];

export function seed() {
  tx(() => {
    wipe();
    const now = Date.now();
    for (const p of PRODUCTS) run("INSERT INTO products VALUES (?,?,?,?,?,?,?,?)", p.sku, p.title, p.brand, p.category, JSON.stringify(p.specs), JSON.stringify(p.features), p.msrp_cents, p.emoji);
    for (const m of PERSONAS) {
      const mid = `m_${m.handle.replace(/-/g, "_")}`;
      run("INSERT INTO merchants(id,name,handle,kind,strategy,key,trust,color,categories,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        mid, m.name, m.handle, "bot", m.strategy, `bw_mer_${m.handle}`, m.trust, m.color, JSON.stringify(m.categories), now);
      run("INSERT INTO trust_history(merchant_id, ts, trust, reason) VALUES (?,?,?,?)", mid, now, m.trust, "Starting trust");
      for (const p of PRODUCTS.filter((p) => m.categories.includes(p.category))) {
        // Each persona prices around MSRP with a little per-item variance so offers differ.
        const jitter = 1 + (((p.sku.length * 7 + m.handle.length * 13) % 9) - 4) / 100;
        const price = Math.round((p.msrp_cents * m.priceFactor * jitter) / 100) * 100 - 1;
        run("INSERT INTO listings VALUES (?,?,?,?,?,?,?,?,?,?)", id("l"), mid, p.sku, price, m.shipping, m.hiddenFee ?? 0, m.hiddenLabel ?? null, m.ship_days, m.stock, m.returns);
      }
    }
    for (const b of BUYERS()) run("INSERT INTO buyers VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", b.id, b.name, b.client, b.key, b.human_name, b.phone, b.email, b.limit, b.daily, b.wallet, 0, now);
    // Opening balances so the ledger starts balanced: wallets are funded from the "funding" account.
    const txn = id("txn");
    for (const b of BUYERS()) {
      run("INSERT INTO ledger VALUES (?,?,?,?,?,?,?)", id("le"), now, txn, null, `buyer:${b.id}:wallet`, b.wallet, `Prepaid wallet funded for ${b.name}`);
      run("INSERT INTO ledger VALUES (?,?,?,?,?,?,?)", id("le"), now, txn, null, `funding:${b.id}`, -b.wallet, `Owner top-up for ${b.name}`);
    }
    setSetting("auction_ms", String(config.auctionMs));
    setSetting("bots_enabled", "1");
  });
}

export function ensureSeeded() {
  const n = all("SELECT sku FROM products LIMIT 1").length;
  if (!n) seed();
}

export const ROOM_PRICE_FACTORS = [0.88, 0.92, 0.95, 0.97, 1.0];
