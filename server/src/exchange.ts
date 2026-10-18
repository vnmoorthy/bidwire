// The Bidwire exchange: auctions for an agent's purchase, verified bids, merit ranking, spending policy,
// human approvals, orders and a double-entry ledger.
import { all, get, run, id, tx, setting, setSetting } from "./db.js";
import { emit } from "./bus.js";
import { config } from "./env.js";
import { CATEGORIES, PRODUCTS, ROOM_PRICE_FACTORS } from "./catalog.js";
import { sendSms, sendEmail, recordInbound, messagingProvider, recentMessages, setInboundHandler } from "./messaging.js";
import type { Auction, Bid, Buyer, Merchant, Listing, Product, Approval, Order, LedgerEntry, ToolCall, Stats, Snapshot, VerifyEvidence, Provider } from "../../shared/types.js";

export class BidwireError extends Error {
  constructor(public code: string, message: string, public hint?: string, public status = 400, public extra: Record<string, unknown> = {}) { super(message); }
}

const J = <T>(s: string | null | undefined, d: T): T => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
export const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

// ---------- mappers ----------
export const rowToProduct = (r: any): Product => ({ sku: r.sku, title: r.title, brand: r.brand, category: r.category, specs: J(r.specs, {}), features: J(r.features, []), msrp_cents: r.msrp_cents, emoji: r.emoji });
export const rowToMerchant = (r: any): Merchant => ({ id: r.id, name: r.name, handle: r.handle, kind: r.kind, strategy: r.strategy, trust: Math.round(r.trust * 10) / 10, color: r.color, categories: J(r.categories, []), balance_cents: r.balance_cents, earned_cents: r.earned_cents, fees_paid_cents: r.fees_paid_cents, bids: r.bids, wins: r.wins, lies_caught: r.lies_caught, created_at: r.created_at });
export const rowToBuyer = (r: any): Buyer => ({ id: r.id, name: r.name, client: r.client, human_name: r.human_name, phone: r.phone, email: r.email, per_purchase_limit_cents: r.per_purchase_limit_cents, daily_limit_cents: r.daily_limit_cents, wallet_cents: r.wallet_cents, spent_today_cents: r.spent_today_cents, created_at: r.created_at });
export const listingUrl = (handle: string, sku: string) => `${config.publicUrl}/store/${handle}/${sku}`;
export const rowToListing = (r: any, handle: string): Listing => ({ id: r.id, merchant_id: r.merchant_id, sku: r.sku, price_cents: r.price_cents, shipping_cents: r.shipping_cents, hidden_fee_cents: r.hidden_fee_cents, hidden_fee_label: r.hidden_fee_label, ship_days: r.ship_days, stock: r.stock, returns_days: r.returns_days, url: listingUrl(handle, r.sku) });

const BID_SELECT = `SELECT b.*, m.name AS m_name, m.color AS m_color, m.kind AS m_kind, p.title AS p_title, p.emoji AS p_emoji, l.sku AS l_sku
  FROM bids b JOIN merchants m ON m.id = b.merchant_id JOIN listings l ON l.id = b.listing_id JOIN products p ON p.sku = l.sku`;
export const rowToBid = (r: any): Bid => ({
  id: r.id, auction_id: r.auction_id, merchant_id: r.merchant_id, merchant_name: r.m_name, merchant_color: r.m_color, merchant_kind: r.m_kind,
  listing_id: r.listing_id, sku: r.l_sku, product_title: r.p_title, product_emoji: r.p_emoji, claimed_price_cents: r.claimed_price_cents,
  claimed_shipping_cents: r.claimed_shipping_cents, claimed_ship_days: r.claimed_ship_days, claimed_features: J(r.claimed_features, []),
  fee_cents: r.fee_cents, pitch: r.pitch, created_at: r.created_at, verify_status: r.verify_status, evidence: J(r.evidence, null),
  merit: r.merit, rank: r.rank, why: J(r.why, []), bribe_ignored: !!r.bribe_ignored,
});
export function getBid(bidId: string): Bid | undefined { const r = get(`${BID_SELECT} WHERE b.id = ?`, bidId); return r ? rowToBid(r) : undefined; }
function bidsFor(auctionId: string): Bid[] {
  return all(`${BID_SELECT} WHERE b.auction_id = ? ORDER BY CASE WHEN b.rank IS NULL THEN 1 ELSE 0 END, b.rank, b.created_at`, auctionId).map(rowToBid);
}
const AUCTION_SELECT = `SELECT a.*, u.name AS buyer_name FROM auctions a JOIN buyers u ON u.id = a.buyer_id`;
const rowToAuction = (r: any): Auction => ({
  id: r.id, buyer_id: r.buyer_id, buyer_name: r.buyer_name, client: r.client, need: r.need, category: r.category, must_have: J(r.must_have, []),
  budget_cents: r.budget_cents, deliver_within_days: r.deliver_within_days, status: r.status, opened_at: r.opened_at, closes_at: r.closes_at,
  closed_at: r.closed_at, winner_bid_id: r.winner_bid_id, bids: bidsFor(r.id),
});
export function getAuction(auctionId: string): Auction | undefined { const r = get(`${AUCTION_SELECT} WHERE a.id = ?`, auctionId); return r ? rowToAuction(r) : undefined; }
const rowToApproval = (r: any): Approval => ({ id: r.id, code: r.code, buyer_id: r.buyer_id, buyer_name: r.buyer_name, human_name: r.human_name, auction_id: r.auction_id, bid_id: r.bid_id, amount_cents: r.amount_cents, limit_cents: r.limit_cents, reason: r.reason, status: r.status, channel: r.channel, created_at: r.created_at, decided_at: r.decided_at, decided_via: r.decided_via });
const APPROVAL_SELECT = `SELECT ap.*, u.name AS buyer_name, u.human_name AS human_name FROM approvals ap JOIN buyers u ON u.id = ap.buyer_id`;
export function getApproval(aid: string): Approval | undefined { const r = get(`${APPROVAL_SELECT} WHERE ap.id = ?`, aid); return r ? rowToApproval(r) : undefined; }
const ORDER_SELECT = `SELECT o.*, u.name AS buyer_name, m.name AS merchant_name, p.title AS product_title FROM orders o JOIN buyers u ON u.id = o.buyer_id JOIN merchants m ON m.id = o.merchant_id JOIN products p ON p.sku = o.sku`;
const rowToOrder = (r: any): Order => ({ id: r.id, auction_id: r.auction_id, bid_id: r.bid_id, buyer_id: r.buyer_id, buyer_name: r.buyer_name, merchant_id: r.merchant_id, merchant_name: r.merchant_name, sku: r.sku, product_title: r.product_title, amount_cents: r.amount_cents, fee_cents: r.fee_cents, status: r.status, receipt_channel: r.receipt_channel, created_at: r.created_at });
export function getOrder(oid: string): Order | undefined { const r = get(`${ORDER_SELECT} WHERE o.id = ?`, oid); return r ? rowToOrder(r) : undefined; }
const rowToLedger = (r: any): LedgerEntry => ({ id: r.id, ts: r.ts, txn_id: r.txn_id, order_id: r.order_id, account: r.account, delta_cents: r.delta_cents, memo: r.memo });
const rowToToolCall = (r: any): ToolCall => ({ id: r.id, ts: r.ts, client: r.client, caller: r.caller, role: r.role, tool: r.tool, args: J(r.args, {}), ok: !!r.ok, summary: r.summary, ms: r.ms, tokens: r.tokens });

export const getMerchant = (mid: string) => { const r = get("SELECT * FROM merchants WHERE id = ?", mid); return r ? rowToMerchant(r) : undefined; };
export const merchantByKey = (key: string) => { const r = get("SELECT * FROM merchants WHERE key = ?", key); return r ? rowToMerchant(r) : undefined; };
export const merchantByHandle = (h: string) => { const r = get("SELECT * FROM merchants WHERE handle = ?", h); return r ? rowToMerchant(r) : undefined; };
export const getBuyer = (bid: string) => { const r = get("SELECT * FROM buyers WHERE id = ?", bid); return r ? rowToBuyer(r) : undefined; };
export const buyerByKey = (key: string) => { const r = get("SELECT * FROM buyers WHERE key = ?", key); return r ? rowToBuyer(r) : undefined; };
export const buyerKey = (bid: string) => get<{ key: string }>("SELECT key FROM buyers WHERE id = ?", bid)?.key;
export const merchantKey = (mid: string) => get<{ key: string }>("SELECT key FROM merchants WHERE id = ?", mid)?.key;
export const getProduct = (sku: string) => { const r = get("SELECT * FROM products WHERE sku = ?", sku); return r ? rowToProduct(r) : undefined; };

export function listingsFor(mid: string): (Listing & { product: Product })[] {
  const m = getMerchant(mid); if (!m) return [];
  return all("SELECT l.*, p.sku AS psku FROM listings l JOIN products p ON p.sku = l.sku WHERE l.merchant_id = ? ORDER BY p.category, l.price_cents", mid)
    .map((r) => ({ ...rowToListing(r, m.handle), product: getProduct(r.sku)! }));
}

// ---------- settings ----------
export const auctionMs = () => Number(setting("auction_ms") ?? config.auctionMs);
export const botsEnabled = () => setting("bots_enabled") !== "0";
export function setAuctionMs(ms: number) { setSetting("auction_ms", String(Math.max(4000, Math.min(60000, Math.round(ms))))); emitConfig(); }
export function setBots(on: boolean) { setSetting("bots_enabled", on ? "1" : "0"); emitConfig(); }
export function configView(): Snapshot["config"] {
  return { auction_ms: auctionMs(), bots_enabled: botsEnabled(), public_url: config.publicUrl, mcp_url: `${config.publicUrl}/mcp`,
    providers: { payments: "ledger", messaging: messagingProvider() }, approver_phone_set: !!config.approverPhone, receipt_email_set: !!config.receiptEmail };
}
const emitConfig = () => emit("config", configView());

// ---------- stats & snapshot ----------
export function stats(): Stats {
  const n = (sql: string) => (get<{ n: number }>(sql)?.n ?? 0);
  return {
    auctions: n("SELECT COUNT(*) n FROM auctions"), bids: n("SELECT COUNT(*) n FROM bids"),
    verified: n("SELECT COUNT(*) n FROM bids WHERE verify_status = 'verified'"), lies_caught: n("SELECT COUNT(*) n FROM bids WHERE verify_status = 'mismatch'"),
    bribes_ignored: n("SELECT COUNT(*) n FROM bids WHERE bribe_ignored = 1"), orders: n("SELECT COUNT(*) n FROM orders WHERE status = 'paid'"),
    gmv_cents: n("SELECT COALESCE(SUM(amount_cents),0) n FROM orders WHERE status = 'paid'"), platform_fees_cents: n("SELECT COALESCE(SUM(fee_cents),0) n FROM orders WHERE status = 'paid'"),
    tool_calls: n("SELECT COUNT(*) n FROM tool_calls"), agents_seen: n("SELECT COUNT(DISTINCT client || ':' || caller) n FROM tool_calls WHERE role = 'buyer'"),
    approvals_pending: n("SELECT COUNT(*) n FROM approvals WHERE status = 'pending'"),
  };
}
let statsTimer: ReturnType<typeof setTimeout> | null = null;
export function pushStats() { if (statsTimer) return; statsTimer = setTimeout(() => { statsTimer = null; emit("stats", stats()); }, 120); }

export function snapshot(): Snapshot {
  return {
    stats: stats(), config: configView(),
    auctions: all(`${AUCTION_SELECT} ORDER BY a.opened_at DESC LIMIT 20`).map(rowToAuction),
    merchants: all("SELECT * FROM merchants ORDER BY trust DESC").map(rowToMerchant),
    buyers: all("SELECT * FROM buyers ORDER BY created_at").map(rowToBuyer),
    orders: all(`${ORDER_SELECT} ORDER BY o.created_at DESC LIMIT 50`).map(rowToOrder),
    approvals: all(`${APPROVAL_SELECT} ORDER BY ap.created_at DESC LIMIT 20`).map(rowToApproval),
    messages: recentMessages(50),
    tool_calls: all("SELECT * FROM tool_calls ORDER BY ts DESC LIMIT 60").map(rowToToolCall),
  };
}

// ---------- tool-call log (the Agent Wire) ----------
export function logToolCall(t: Omit<ToolCall, "id" | "ts">) {
  const call: ToolCall = { id: id("tc"), ts: Date.now(), ...t };
  run("INSERT INTO tool_calls VALUES (?,?,?,?,?,?,?,?,?,?,?)", call.id, call.ts, call.client, call.caller, call.role, call.tool, JSON.stringify(call.args).slice(0, 2000), call.ok ? 1 : 0, call.summary.slice(0, 300), call.ms, call.tokens);
  emit("tool.call", call);
  pushStats();
  return call;
}

// ---------- need parsing ----------
export function parseNeed(need: string, mustHave: string[] = []) {
  const text = ` ${need.toLowerCase()} `;
  let best: string | null = null; let bestScore = 0;
  for (const [cat, def] of Object.entries(CATEGORIES)) {
    const score = def.words.reduce((s, w) => s + (text.includes(w) ? (w.length > 4 ? 2 : 1) : 0), 0);
    if (score > bestScore) { best = cat; bestScore = score; }
  }
  const features = new Set<string>();
  const norm = (f: string) => f.toLowerCase().trim().replace(/\s+/g, "-").replace(/^noise-cancell?ing$/, "anc").replace(/^active-noise-cancell?ation$/, "anc").replace(/^bluetooth$/, "wireless").replace(/^usb-?c$/, "usb-c");
  for (const f of mustHave) if (f.trim()) features.add(norm(f));
  if (best) for (const [feat, syns] of Object.entries(CATEGORIES[best].features)) if (syns.some((s) => text.includes(s))) features.add(feat);
  // Drop features the category cannot have (keeps agents' free-form must-haves from breaking matching).
  if (best) {
    const known = new Set(PRODUCTS.filter((p) => p.category === best).flatMap((p) => p.features));
    for (const f of [...features]) if (!known.has(f)) features.delete(f);
  }
  return { category: best, must_have: [...features] };
}

// ---------- auctions ----------
type Waiter = (a: Auction) => void;
const closeWaiters = new Map<string, Waiter[]>();
const closeTimers = new Map<string, ReturnType<typeof setTimeout>>();
let onOpenHook: ((a: Auction) => void) | null = null;
export function onAuctionOpened(fn: (a: Auction) => void) { onOpenHook = fn; }

export function openAuction(args: { buyer: Buyer; client: string; need: string; budget_cents: number; deliver_within_days?: number | null; must_have?: string[]; window_ms?: number }): Auction {
  const need = args.need.trim();
  if (need.length < 3) throw new BidwireError("need_too_short", "Describe what to buy in a few words.", 'Example: { "need": "noise cancelling headphones for long flights", "budget_usd": 350 }');
  if (!(args.budget_cents > 0)) throw new BidwireError("invalid_budget", "budget_usd must be greater than 0.");
  const parsed = parseNeed(need, args.must_have ?? []);
  if (!parsed.category) throw new BidwireError("unknown_category", `No merchants on the exchange sell anything matching "${need}" yet.`, `Supported categories: ${Object.keys(CATEGORIES).join(", ")}. Read resource bidwire://categories for the feature tags each one supports.`);
  const now = Date.now(); const window = args.window_ms ?? auctionMs();
  const aid = id("auc");
  run("INSERT INTO auctions(id,buyer_id,client,need,category,must_have,budget_cents,deliver_within_days,status,opened_at,closes_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    aid, args.buyer.id, args.client, need, parsed.category, JSON.stringify(parsed.must_have), Math.round(args.budget_cents), args.deliver_within_days ?? null, "open", now, now + window);
  const auction = getAuction(aid)!;
  emit("auction.opened", auction); pushStats();
  closeTimers.set(aid, setTimeout(() => { closeAuction(aid).catch((e) => console.error("close failed", e)); }, window));
  try { onOpenHook?.(auction); } catch (e) { console.error(e); }
  return auction;
}

export function waitForClose(auctionId: string, maxMs: number): Promise<Auction> {
  const a = getAuction(auctionId);
  if (!a) return Promise.reject(new BidwireError("auction_not_found", `No auction ${auctionId}.`, "Use the auction_id returned by find_offers.", 404));
  if (a.status === "closed" || maxMs <= 0) return Promise.resolve(a);
  return new Promise((resolve) => {
    const list = closeWaiters.get(auctionId) ?? []; closeWaiters.set(auctionId, list);
    const t = setTimeout(() => resolve(getAuction(auctionId)!), maxMs);
    list.push((x) => { clearTimeout(t); resolve(x); });
  });
}

// ---------- bids ----------
export function placeBid(args: { merchant: Merchant; auction_id: string; listing_id?: string; sku?: string; claimed_total_cents: number; ship_days?: number; claimed_features?: string[]; fee_cents: number; pitch?: string }): Bid {
  const a = getAuction(args.auction_id);
  if (!a) throw new BidwireError("auction_not_found", `No auction ${args.auction_id}.`, "Call list_open_requests to see auctions you can bid on.", 404);
  if (a.status !== "open" || Date.now() > a.closes_at) throw new BidwireError("auction_closed", "This auction has closed; bids are no longer accepted.", "Call list_open_requests for live auctions.", 409);
  const listing = args.listing_id ? get("SELECT * FROM listings WHERE id = ? AND merchant_id = ?", args.listing_id, args.merchant.id)
    : get("SELECT * FROM listings WHERE sku = ? AND merchant_id = ?", args.sku ?? "", args.merchant.id);
  if (!listing) throw new BidwireError("listing_not_found", "You can only bid with items in your own storefront.", "Call list_open_requests: it returns your eligible listings (sku) for each auction.", 404);
  const product = getProduct(listing.sku)!;
  if (product.category !== a.category) throw new BidwireError("wrong_category", `This buyer wants ${a.category}; ${product.title} is in ${product.category}.`, "Bid with a listing from the auction's category.");
  if (get("SELECT id FROM bids WHERE auction_id = ? AND merchant_id = ?", a.id, args.merchant.id)) throw new BidwireError("already_bid", "You already bid on this auction.", "One bid per merchant per auction; watch the result with get_my_results.", 409);
  const total = Math.round(args.claimed_total_cents);
  if (!(total > 0)) throw new BidwireError("invalid_price", "delivered_price_usd must be greater than 0.");
  const fee = Math.max(0, Math.min(10000, Math.round(args.fee_cents)));
  const shipDays = Math.max(0, Math.round(args.ship_days ?? listing.ship_days));
  const claimedShipping = Math.min(listing.shipping_cents, total);
  const bid_id = id("bid");
  run(`INSERT INTO bids(id,auction_id,merchant_id,listing_id,claimed_price_cents,claimed_shipping_cents,claimed_ship_days,claimed_features,fee_cents,pitch,created_at,verify_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, bid_id, a.id, args.merchant.id, listing.id, total - claimedShipping, claimedShipping, shipDays,
       JSON.stringify(args.claimed_features ?? product.features), fee, (args.pitch ?? "").slice(0, 160), Date.now(), "pending");
  run("UPDATE merchants SET bids = bids + 1 WHERE id = ?", args.merchant.id);
  const bid = getBid(bid_id)!;
  emit("bid.placed", bid); pushStats();
  // Verification runs out of band, against the merchant's real storefront and checkout.
  setTimeout(() => { verifyBid(bid_id).catch((e) => console.error("verify failed", e)); }, 500 + Math.floor(Math.random() * 700));
  return bid;
}

const verifying = new Map<string, Promise<void>>();
export function verifyBid(bidId: string): Promise<void> {
  const existing = verifying.get(bidId); if (existing) return existing;
  const p = (async () => {
    const r = get("SELECT b.*, l.sku, m.handle, m.id AS mid FROM bids b JOIN listings l ON l.id = b.listing_id JOIN merchants m ON m.id = b.merchant_id WHERE b.id = ?", bidId);
    if (!r) return;
    const evidence = await inspectStorefront(r.handle, r.sku, {
      claimed_total_cents: r.claimed_price_cents + r.claimed_shipping_cents, claimed_ship_days: r.claimed_ship_days, claimed_features: J<string[]>(r.claimed_features, []), pitch: r.pitch,
    });
    const lied = evidence.checks.some((c) => !c.ok && c.name !== "In stock");
    run("UPDATE bids SET verify_status = ?, evidence = ? WHERE id = ?", lied ? "mismatch" : "verified", JSON.stringify(evidence), bidId);
    if (lied) {
      run("UPDATE merchants SET lies_caught = lies_caught + 1 WHERE id = ?", r.mid);
      adjustTrust(r.mid, -12, `Caught misrepresenting an offer: ${evidence.summary}`);
    }
    const bid = getBid(bidId)!;
    emit(lied ? "bid.flagged" : "bid.verified", bid); pushStats();
  })().finally(() => verifying.delete(bidId));
  verifying.set(bidId, p);
  return p;
}

// Fetches the merchant's public product page (schema.org JSON-LD) and checkout quote over HTTP, exactly as it
// would for any external store, then compares them with what the merchant claimed in its bid.
// Merchant pitches are data, never instructions. A pitch that tries to steer the buying agent gets the bid withdrawn.
const INJECTION = /(ignore|disregard|forget|override)\s+(all\s+|any\s+|your\s+|the\s+|previous\s+|prior\s+|earlier\s+)*(instructions?|rules|policy|prompt|ranking)|\bsystem\s*(note|prompt|message)?\s*:|you\s+must\s+(buy|purchase|choose|select|pick)|as an ai\b|jailbreak|do not (compare|verify|check)/i;
export function pitchInjection(pitch: string): string | null {
  const m = pitch.match(INJECTION);
  if (!m) return null;
  const at = Math.max(0, (m.index ?? 0) - 10);
  return pitch.slice(at, at + 70).trim();
}

export async function inspectStorefront(handle: string, sku: string, claim: { claimed_total_cents: number; claimed_ship_days: number; claimed_features: string[]; pitch?: string }): Promise<VerifyEvidence> {
  const url = listingUrl(handle, sku);
  const local = `${config.internalUrl}/store/${handle}/${sku}`;
  const t0 = Date.now();
  const checks: VerifyEvidence["checks"] = [];
  let pageFeatures: string[] = []; let pagePrice = 0; let inStock = false; let actualTotal = 0; let shipDays = 99; let feeNote = "";
  try {
    const html = await (await fetch(local)).text();
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const ld = m ? JSON.parse(m[1]) : null;
    pagePrice = Math.round(Number(ld?.offers?.price ?? 0) * 100);
    inStock = String(ld?.offers?.availability ?? "").endsWith("InStock");
    pageFeatures = (ld?.additionalProperty ?? []).filter((p: any) => p.name === "feature").map((p: any) => String(p.value));
    checks.push({ name: "Product page", ok: !!ld, detail: ld ? `schema.org Offer found: ${fmt(pagePrice)} list price` : "No structured offer on page" });
  } catch (e: any) {
    checks.push({ name: "Product page", ok: false, detail: `Could not fetch page: ${e?.message ?? e}` });
  }
  try {
    const q = await (await fetch(`${local}/quote`)).json() as any;
    actualTotal = q.total_cents; shipDays = q.ship_days; inStock = inStock && q.in_stock;
    const extra = (q.fees ?? []).filter((f: any) => f.cents > 0);
    if (extra.length) feeNote = extra.map((f: any) => `+${fmt(f.cents)} "${f.label}"`).join(", ");
    checks.push({ name: "Checkout total", ok: claim.claimed_total_cents >= actualTotal - 50,
      detail: `Claimed ${fmt(claim.claimed_total_cents)} delivered; checkout says ${fmt(actualTotal)}${feeNote ? ` (${feeNote})` : ""}` });
  } catch (e: any) {
    checks.push({ name: "Checkout total", ok: false, detail: `Could not get checkout quote: ${e?.message ?? e}` });
  }
  checks.push({ name: "Delivery time", ok: claim.claimed_ship_days >= shipDays, detail: `Claimed ${claim.claimed_ship_days}d; store ships in ${shipDays}d` });
  const missing = claim.claimed_features.filter((f) => !pageFeatures.includes(f));
  checks.push({ name: "Features", ok: missing.length === 0, detail: missing.length ? `Claims ${missing.join(", ")} but the product page does not list ${missing.length > 1 ? "them" : "it"}` : `All claimed features are on the product page` });
  checks.push({ name: "In stock", ok: inStock, detail: inStock ? "Available" : "Out of stock at checkout" });
  if (claim.pitch) {
    const hit = pitchInjection(claim.pitch);
    checks.push({ name: "Pitch safety", ok: !hit, detail: hit ? `Pitch contained instructions aimed at the buying agent ("${hit}…")` : "Pitch is plain marketing text" });
  }
  const failed = checks.filter((c) => !c.ok && c.name !== "In stock");
  const summary = failed.length ? failed.map((c) => c.detail).join("; ") : `Verified: ${fmt(actualTotal)} delivered in ${shipDays}d${inStock ? "" : " (out of stock)"}`;
  return { url, fetched_ms: Date.now() - t0, claimed_total_cents: claim.claimed_total_cents, actual_total_cents: actualTotal, claimed_ship_days: claim.claimed_ship_days, actual_ship_days: shipDays, in_stock: inStock, checks, summary };
}

export function adjustTrust(mid: string, delta: number, reason: string) {
  const m = getMerchant(mid); if (!m) return;
  const next = Math.max(0, Math.min(99, m.trust + delta));
  run("UPDATE merchants SET trust = ? WHERE id = ?", next, mid);
  run("INSERT INTO trust_history(merchant_id, ts, trust, reason) VALUES (?,?,?,?)", mid, Date.now(), next, reason);
  emit("merchant.updated", getMerchant(mid)!);
}

// ---------- ranking ----------
export const RANKING_WEIGHTS = { price: 0.4, specs: 0.25, delivery: 0.15, trust: 0.15, returns: 0.05 };

export async function closeAuction(auctionId: string): Promise<Auction> {
  const t = closeTimers.get(auctionId); if (t) { clearTimeout(t); closeTimers.delete(auctionId); }
  const a0 = getAuction(auctionId); if (!a0) throw new BidwireError("auction_not_found", "No such auction", undefined, 404);
  if (a0.status === "closed") return a0;
  run("UPDATE auctions SET status = 'verifying' WHERE id = ? AND status = 'open'", auctionId);
  // Let in-flight verifications land (bounded), then verify anything still pending ourselves.
  const pending = all("SELECT id FROM bids WHERE auction_id = ? AND verify_status = 'pending'", auctionId).map((r) => r.id as string);
  await Promise.race([Promise.all(pending.map((b) => verifyBid(b))), new Promise((r) => setTimeout(r, 4000))]);
  rank(auctionId);
  run("UPDATE auctions SET status = 'closed', closed_at = ? WHERE id = ?", Date.now(), auctionId);
  const a = getAuction(auctionId)!;
  emit("auction.closed", a); pushStats();
  for (const w of closeWaiters.get(auctionId) ?? []) w(a);
  closeWaiters.delete(auctionId);
  return a;
}

function rank(auctionId: string) {
  const a = getAuction(auctionId)!;
  const rows = all(`SELECT b.*, l.stock, l.returns_days, l.sku, m.trust, m.name AS m_name FROM bids b JOIN listings l ON l.id = b.listing_id JOIN merchants m ON m.id = b.merchant_id WHERE b.auction_id = ?`, auctionId);
  type C = { id: string; total: number; ship: number; stock: number; returns: number; trust: number; fee: number; features: string[]; name: string; merit: number; why: string[] };
  const eligible: C[] = [];
  for (const r of rows) {
    const ev = J<VerifyEvidence | null>(r.evidence, null);
    if (r.verify_status !== "verified" || !ev) {
      run("UPDATE bids SET merit = NULL, rank = NULL, why = ? WHERE id = ?", JSON.stringify([r.verify_status === "mismatch" ? `Excluded: ${ev?.summary ?? "failed verification"}` : "Excluded: could not be verified before the auction closed"]), r.id);
      continue;
    }
    eligible.push({ id: r.id, total: ev.actual_total_cents, ship: ev.actual_ship_days, stock: ev.in_stock ? r.stock : 0, returns: r.returns_days, trust: r.trust, fee: r.fee_cents, features: getProduct(r.sku)!.features, name: r.m_name, merit: 0, why: [] });
  }
  const inStock = eligible.filter((c) => c.stock > 0);
  const minTotal = Math.min(...(inStock.length ? inStock : eligible).map((c) => c.total));
  for (const c of eligible) {
    const price = minTotal / c.total;
    const have = a.must_have.filter((f) => c.features.includes(f));
    const specs = a.must_have.length ? have.length / a.must_have.length : 1;
    let delivery: number;
    if (a.deliver_within_days != null) delivery = c.ship <= a.deliver_within_days ? 1 - 0.3 * (c.ship / Math.max(1, a.deliver_within_days)) : 0;
    else delivery = 1 - Math.min(c.ship, 10) / 20;
    const trust = c.trust / 100; const returns = Math.min(c.returns, 60) / 60;
    let merit = 100 * (RANKING_WEIGHTS.price * price + RANKING_WEIGHTS.specs * specs + RANKING_WEIGHTS.delivery * delivery + RANKING_WEIGHTS.trust * trust + RANKING_WEIGHTS.returns * returns);
    const why: string[] = [];
    if (c.total === minTotal) why.push(`Lowest verified delivered price (${fmt(c.total)})`); else why.push(`${fmt(c.total)} delivered (+${fmt(c.total - minTotal)} vs cheapest)`);
    if (a.must_have.length) why.push(have.length === a.must_have.length ? `Has every must-have: ${a.must_have.join(", ")}` : `Missing must-have: ${a.must_have.filter((f) => !have.includes(f)).join(", ")}`);
    if (a.deliver_within_days != null) why.push(c.ship <= a.deliver_within_days ? `Arrives in ${c.ship}d (you need ≤${a.deliver_within_days}d)` : `Ships in ${c.ship}d: misses your ${a.deliver_within_days}-day deadline`);
    else why.push(`Arrives in ${c.ship}d`);
    why.push(`Merchant trust ${Math.round(c.trust)}/100 · ${c.returns}-day returns`);
    if (c.total > a.budget_cents) { merit *= 0.85; why.push(`Over your budget by ${fmt(c.total - a.budget_cents)}`); }
    if (c.stock <= 0) { merit *= 0.5; why.push("Out of stock at checkout"); }
    c.merit = Math.round(merit * 10) / 10; c.why = why;
  }
  // Merit decides. A merchant's fee per sale only breaks near-ties (within 0.5 points).
  eligible.sort((x, y) => (Math.abs(y.merit - x.merit) >= 0.5 ? y.merit - x.merit : y.fee - x.fee));
  eligible.forEach((c, i) => {
    const outbidButBelow = eligible.slice(0, i).some((above) => c.fee >= Math.max(1000, 2 * above.fee) && above.merit - c.merit >= 0.5);
    if (c.fee > 0) c.why.push(outbidButBelow ? `Offered ${fmt(c.fee)}/sale to the exchange; fees never buy rank, so it stays #${i + 1}` : `Fee ${fmt(c.fee)}/sale (paid only if chosen; never affects rank)`);
    run("UPDATE bids SET merit = ?, rank = ?, why = ?, bribe_ignored = ? WHERE id = ?", c.merit, i + 1, JSON.stringify(c.why), outbidButBelow ? 1 : 0, c.id);
  });
}

// ---------- buyer view of offers (compact, token-efficient) ----------
export function offerView(b: Bid, a: Auction) {
  const ev = b.evidence;
  return {
    offer_id: b.id, rank: b.rank, merit: b.merit, merchant: b.merchant_name, merchant_id: b.merchant_id, product: b.product_title, sku: b.sku,
    delivered_price_usd: ev ? ev.actual_total_cents / 100 : null, arrives_in_days: ev?.actual_ship_days ?? null, in_stock: ev?.in_stock ?? null,
    verified: b.verify_status === "verified", over_budget: ev ? ev.actual_total_cents > a.budget_cents : false,
    merchant_fee_usd: b.fee_cents / 100, fee_affected_rank: false, why: b.why.slice(0, 4), storefront: ev?.url ?? null,
  };
}
export function offersResult(a: Auction, max = 5) {
  const ranked = a.bids.filter((b) => b.rank != null).sort((x, y) => x.rank! - y.rank!);
  const flagged = a.bids.filter((b) => b.verify_status === "mismatch");
  return {
    auction_id: a.id, status: a.status, need: a.need, category: a.category, must_have: a.must_have, budget_usd: a.budget_cents / 100,
    closes_in_ms: Math.max(0, a.closes_at - Date.now()), bids_received: a.bids.length,
    offers: ranked.slice(0, max).map((b) => offerView(b, a)),
    excluded: flagged.map((b) => ({ merchant: b.merchant_name, reason: b.evidence?.summary ?? "failed verification" })),
    next_step: ranked.length ? `Call buy_offer with offer_id "${ranked[0].id}" to buy the #1 pick.` : a.status === "closed" ? "No verified offers. Try a broader need or a higher budget." : "Auction still open; call get_offers with wait_seconds to wait for the result.",
  };
}

// ---------- approvals ----------
type AWaiter = (a: Approval) => void;
const approvalWaiters = new Map<string, AWaiter[]>();
export function waitForApproval(aid: string, maxMs: number): Promise<Approval> {
  const ap = getApproval(aid);
  if (!ap) return Promise.reject(new BidwireError("approval_not_found", `No approval ${aid}.`, undefined, 404));
  if (ap.status !== "pending" || maxMs <= 0) return Promise.resolve(ap);
  return new Promise((resolve) => {
    const list = approvalWaiters.get(aid) ?? []; approvalWaiters.set(aid, list);
    const t = setTimeout(() => resolve(getApproval(aid)!), maxMs);
    list.push((x) => { clearTimeout(t); resolve(x); });
  });
}

export function decideApproval(aid: string, decision: "approve" | "deny", via: string): Approval {
  const ap = getApproval(aid);
  if (!ap) throw new BidwireError("approval_not_found", `No approval ${aid}.`, undefined, 404);
  if (ap.status !== "pending") return ap;
  run("UPDATE approvals SET status = ?, decided_at = ?, decided_via = ? WHERE id = ?", decision === "approve" ? "approved" : "denied", Date.now(), via, aid);
  const next = getApproval(aid)!;
  emit("approval.decided", next); pushStats();
  for (const w of approvalWaiters.get(aid) ?? []) w(next);
  approvalWaiters.delete(aid);
  return next;
}

setInboundHandler((from, body, provider) => {
  const m = body.trim().match(/^(yes|y|approve|ok|no|n|deny|decline)\b\D*(\d{4})?/i);
  const pend = all(`${APPROVAL_SELECT} WHERE ap.status = 'pending' ORDER BY ap.created_at DESC`).map(rowToApproval);
  const target = m?.[2] ? pend.find((p) => p.code === m[2]) : pend[0];
  recordInbound(from, body, provider, target?.id ?? null);
  if (!m || !target) return;
  decideApproval(target.id, /^(yes|y|approve|ok)$/i.test(m[1]) ? "approve" : "deny", provider === "inkbox" ? `SMS reply from ${from}` : "phone reply");
});
// Used by the on-screen phone's reply box: goes through the same parser as real SMS replies.
export function simulateInbound(body: string) {
  const m = body.trim().match(/^(yes|y|approve|ok|no|n|deny|decline)\b\D*(\d{4})?/i);
  const pend = all(`${APPROVAL_SELECT} WHERE ap.status = 'pending' ORDER BY ap.created_at DESC`).map(rowToApproval);
  const target = m?.[2] ? pend.find((p) => p.code === m[2]) : pend[0];
  recordInbound("approver phone", body, "simulated", target?.id ?? null);
  if (m && target) decideApproval(target.id, /^(yes|y|approve|ok)$/i.test(m[1]) ? "approve" : "deny", "phone reply");
}

// ---------- buying ----------
export type BuyResult =
  | { status: "purchased" | "already_purchased"; order: Order; receipt: string }
  | { status: "approval_required"; approval_id: string; amount_usd: number; limit_usd: number; message: string }
  | { status: "approval_denied"; approval_id: string; message: string }
  | { status: "out_of_stock"; message: string; next_offer: ReturnType<typeof offerView> | null };

export async function buyOffer(args: { buyer: Buyer; offer_id: string; idempotency_key?: string; wait_for_approval_ms?: number }): Promise<BuyResult> {
  const bid = getBid(args.offer_id);
  if (!bid) throw new BidwireError("offer_not_found", `No offer ${args.offer_id}.`, "Use an offer_id from find_offers / get_offers.", 404);
  const a = getAuction(bid.auction_id)!;
  if (a.buyer_id !== args.buyer.id) throw new BidwireError("not_your_auction", "That offer belongs to another agent's auction.", "Only the agent that opened the auction can buy from it.", 403);
  if (a.status !== "closed") throw new BidwireError("auction_still_open", "This auction is still collecting bids.", `Call get_offers with auction_id "${a.id}" and wait_seconds: 20.`, 409);
  if (bid.verify_status !== "verified") throw new BidwireError("offer_not_verified", `That offer failed verification: ${bid.evidence?.summary ?? "unverified"}.`, "Buy a verified offer instead (verified: true in get_offers).", 409);
  const existing = get(`${ORDER_SELECT} WHERE o.bid_id = ?`, bid.id) ?? (args.idempotency_key ? get(`${ORDER_SELECT} WHERE o.idempotency_key = ?`, args.idempotency_key) : undefined);
  if (existing) { const o = rowToOrder(existing); return { status: "already_purchased", order: o, receipt: receiptText(o) }; }
  const listing = get("SELECT * FROM listings WHERE id = ?", bid.listing_id)!;
  if (listing.stock <= 0) {
    const next = a.bids.filter((b) => b.rank != null && b.id !== bid.id && (get("SELECT stock FROM listings WHERE id = ?", b.listing_id)?.stock ?? 0) > 0).sort((x, y) => x.rank! - y.rank!)[0];
    emit("order.failed", { auction_id: a.id, bid_id: bid.id, reason: `${bid.merchant_name} sold out of ${bid.product_title}` });
    return { status: "out_of_stock", message: `${bid.merchant_name} just sold its last unit. ${next ? `Next best verified offer is #${next.rank} from ${next.merchant_name}.` : "No other verified offers remain."}`, next_offer: next ? offerView(next, a) : null };
  }
  const amount = bid.evidence!.actual_total_cents;
  const buyer = getBuyer(args.buyer.id)!;
  if (amount > buyer.wallet_cents) throw new BidwireError("insufficient_funds", `Wallet has ${fmt(buyer.wallet_cents)}; this costs ${fmt(amount)}.`, "Ask your human to top up the wallet, or choose a cheaper offer.", 402);
  const overPurchase = amount > buyer.per_purchase_limit_cents;
  const overDaily = buyer.spent_today_cents + amount > buyer.daily_limit_cents;
  if (overPurchase || overDaily) {
    const approved = get("SELECT id FROM approvals WHERE bid_id = ? AND status = 'approved'", bid.id);
    if (!approved) {
      const denied = get("SELECT id FROM approvals WHERE bid_id = ? AND status = 'denied'", bid.id);
      if (denied) return { status: "approval_denied", approval_id: denied.id, message: `${buyer.human_name} declined this purchase. Do not retry it; pick a cheaper offer or ask your human.` };
      let ap = get(`${APPROVAL_SELECT} WHERE ap.bid_id = ? AND ap.status = 'pending'`, bid.id);
      let approval = ap ? rowToApproval(ap) : await requestApproval(buyer, a, bid, amount, overPurchase ? buyer.per_purchase_limit_cents : buyer.daily_limit_cents - buyer.spent_today_cents);
      if ((args.wait_for_approval_ms ?? 0) > 0) approval = await waitForApproval(approval.id, args.wait_for_approval_ms!);
      if (approval.status === "denied") return { status: "approval_denied", approval_id: approval.id, message: `${buyer.human_name} declined this purchase.` };
      if (approval.status !== "approved") return { status: "approval_required", approval_id: approval.id, amount_usd: amount / 100, limit_usd: approval.limit_cents / 100,
        message: `This purchase (${fmt(amount)}) is above your ${overPurchase ? "per-purchase" : "daily"} limit. ${buyer.human_name} was texted to approve. Call check_approval with approval_id "${approval.id}" (it can wait), then call buy_offer again.` };
    }
  }
  const order = commitOrder(buyer, a, bid, amount, args.idempotency_key ?? null);
  return { status: "purchased", order, receipt: receiptText(order) };
}

async function requestApproval(buyer: Buyer, a: Auction, bid: Bid, amount: number, limit: number): Promise<Approval> {
  const aid = id("apr"); const code = String(1000 + Math.floor(Math.random() * 9000));
  const channel: Provider = messagingProvider() === "inkbox" && buyer.phone ? "inkbox" : "simulated";
  run("INSERT INTO approvals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", aid, code, buyer.id, a.id, bid.id, amount, limit,
    `${bid.product_title} from ${bid.merchant_name}`, "pending", channel, Date.now(), null, null);
  const approval = getApproval(aid)!;
  emit("approval.requested", approval); pushStats();
  await sendSms(buyer.phone, `Bidwire: your agent "${buyer.name}" wants to buy ${bid.product_title} from ${bid.merchant_name} for ${fmt(amount)} (your limit is ${fmt(limit)}). Reply YES ${code} to approve or NO ${code} to decline.`, aid);
  return getApproval(aid)!;
}

function commitOrder(buyer: Buyer, a: Auction, bid: Bid, amount: number, idem: string | null): Order {
  const oid = id("ord");
  tx(() => {
    const now = Date.now();
    run("INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", oid, a.id, bid.id, buyer.id, bid.merchant_id, bid.sku, amount, bid.fee_cents, "paid", null, idem, now);
    const sale = id("txn"), fee = id("txn");
    const post = (txn: string, account: string, delta: number, memo: string) => run("INSERT INTO ledger VALUES (?,?,?,?,?,?,?)", id("le"), now, txn, oid, account, delta, memo);
    post(sale, `buyer:${buyer.id}:wallet`, -amount, `${buyer.name} paid for ${bid.product_title}`);
    post(sale, `merchant:${bid.merchant_id}:revenue`, amount, `Sale to ${buyer.name}`);
    if (bid.fee_cents > 0) {
      post(fee, `merchant:${bid.merchant_id}:revenue`, -bid.fee_cents, "Bidwire fee per sale (only charged because the agent bought)");
      post(fee, "platform:fees", bid.fee_cents, `Fee from ${bid.merchant_name}`);
    }
    run("UPDATE buyers SET wallet_cents = wallet_cents - ?, spent_today_cents = spent_today_cents + ? WHERE id = ?", amount, amount, buyer.id);
    run("UPDATE merchants SET earned_cents = earned_cents + ?, fees_paid_cents = fees_paid_cents + ?, balance_cents = balance_cents + ?, wins = wins + 1 WHERE id = ?", amount, bid.fee_cents, amount - bid.fee_cents, bid.merchant_id);
    run("UPDATE listings SET stock = stock - 1 WHERE id = ?", bid.listing_id);
    run("UPDATE auctions SET winner_bid_id = ? WHERE id = ?", bid.id, a.id);
  });
  adjustTrust(bid.merchant_id, 1, `Completed a verified sale to ${buyer.name}`);
  const order = getOrder(oid)!;
  emit("order.created", order);
  emit("ledger.posted", all("SELECT * FROM ledger WHERE order_id = ? ORDER BY ts", oid).map(rowToLedger));
  emit("buyer.updated", getBuyer(buyer.id)!);
  emit("merchant.updated", getMerchant(bid.merchant_id)!);
  pushStats();
  // Receipt goes out from the agent's identity without blocking the purchase.
  sendEmail(buyer.email, `Receipt: ${bid.product_title}`, receiptText(order), oid).then((m) => run("UPDATE orders SET receipt_channel = ? WHERE id = ?", m.provider, oid)).catch(() => {});
  return order;
}

export function receiptText(o: Order) {
  return `Bidwire receipt ${o.id}\n${o.product_title}\nSold by ${o.merchant_name} to ${o.buyer_name}\nTotal paid (delivered): ${fmt(o.amount_cents)}\nPrice verified against the merchant's live checkout before purchase.\nMerchant fee to Bidwire: ${fmt(o.fee_cents)} (paid by the merchant, not you).`;
}

// ---------- reports ----------
export async function reportOffer(buyer: Buyer, offerId: string, issue: string) {
  const bid = getBid(offerId);
  if (!bid) throw new BidwireError("offer_not_found", `No offer ${offerId}.`, undefined, 404);
  const r = get("SELECT l.sku, m.handle FROM bids b JOIN listings l ON l.id = b.listing_id JOIN merchants m ON m.id = b.merchant_id WHERE b.id = ?", offerId);
  const ev = await inspectStorefront(r.handle, r.sku, { claimed_total_cents: bid.claimed_price_cents + bid.claimed_shipping_cents, claimed_ship_days: bid.claimed_ship_days, claimed_features: bid.claimed_features });
  const confirmed = ev.checks.some((c) => !c.ok && c.name !== "In stock");
  run("INSERT INTO reports VALUES (?,?,?,?,?,?)", id("rep"), Date.now(), offerId, buyer.id, issue.slice(0, 300), confirmed ? "confirmed" : "not_reproduced");
  if (confirmed) adjustTrust(bid.merchant_id, -10, `Agent report confirmed by re-inspection: ${issue.slice(0, 80)}`);
  return { outcome: confirmed ? "confirmed" : "not_reproduced", evidence: ev.summary, merchant_trust_now: getMerchant(bid.merchant_id)!.trust };
}

// ---------- merchants joining (people in the room, or merchant agents) ----------
const COLORS = ["#7CF0C5", "#9FB7FF", "#FFD27A", "#FF9DB5", "#B6F36B", "#7FD7FF", "#E6A8FF", "#FFB38A", "#8EF0E8", "#F7E37A"];
export function joinMerchant(name: string, kind: "human" | "agent", categories?: string[]) {
  const clean = name.trim().slice(0, 40);
  if (clean.length < 2) throw new BidwireError("invalid_name", "Pick a store name with at least 2 characters.");
  const base = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "store";
  let handle = base; let i = 2;
  while (get("SELECT id FROM merchants WHERE handle = ?", handle)) handle = `${base}-${i++}`;
  const mid = id("m"); const key = `bw_mer_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
  const cats = (categories?.length ? categories.filter((c) => CATEGORIES[c]) : Object.keys(CATEGORIES));
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  tx(() => {
    run("INSERT INTO merchants(id,name,handle,kind,strategy,key,trust,color,categories,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", mid, clean, handle, kind, kind, key, 75, color, JSON.stringify(cats), Date.now());
    run("INSERT INTO trust_history(merchant_id, ts, trust, reason) VALUES (?,?,?,?)", mid, Date.now(), 75, "New merchant joined");
    for (const cat of cats) {
      const items = PRODUCTS.filter((p) => p.category === cat).sort(() => Math.random() - 0.5).slice(0, 2);
      for (const p of items) {
        const f = ROOM_PRICE_FACTORS[Math.floor(Math.random() * ROOM_PRICE_FACTORS.length)];
        run("INSERT INTO listings VALUES (?,?,?,?,?,?,?,?,?,?)", id("l"), mid, p.sku, Math.round((p.msrp_cents * f) / 100) * 100 - 1, 0, 0, null, 2 + Math.floor(Math.random() * 3), 5, 30);
      }
    }
  });
  const m = getMerchant(mid)!;
  emit("merchant.joined", m); pushStats();
  return { merchant: m, key, listings: listingsFor(mid) };
}

export function merchantProfile(mid: string) {
  const merchant = getMerchant(mid);
  if (!merchant) throw new BidwireError("merchant_not_found", `No merchant ${mid}.`, undefined, 404);
  return {
    merchant, listings: listingsFor(mid),
    bids: all(`${BID_SELECT} WHERE b.merchant_id = ? ORDER BY b.created_at DESC LIMIT 30`, mid).map(rowToBid),
    trust_history: all("SELECT ts, trust, reason FROM trust_history WHERE merchant_id = ? ORDER BY ts", mid),
  };
}

export function merchantFeed(mid: string) {
  const m = getMerchant(mid)!;
  const cats = m.categories;
  const open = all(`${AUCTION_SELECT} WHERE a.status = 'open' ORDER BY a.opened_at DESC LIMIT 20`).map(rowToAuction).filter((a) => a.category && cats.includes(a.category));
  const my_bids = all(`${BID_SELECT} WHERE b.merchant_id = ? ORDER BY b.created_at DESC LIMIT 20`, mid).map(rowToBid);
  return { open, my_bids };
}

export function ledgerView() {
  return {
    entries: all("SELECT * FROM ledger ORDER BY ts DESC, txn_id LIMIT 400").map(rowToLedger),
    balances: all("SELECT account, SUM(delta_cents) AS cents FROM ledger GROUP BY account ORDER BY account"),
    orders: all(`${ORDER_SELECT} ORDER BY o.created_at DESC LIMIT 100`).map(rowToOrder),
  };
}

export const listApprovals = () => all(`${APPROVAL_SELECT} ORDER BY ap.created_at DESC LIMIT 50`).map(rowToApproval);

// Restart safety: close any auction whose window already passed, re-arm timers for the rest.
export function resumeOpenAuctions() {
  for (const r of all("SELECT id, closes_at FROM auctions WHERE status IN ('open','verifying')")) {
    const ms = Math.max(0, r.closes_at - Date.now());
    closeTimers.set(r.id, setTimeout(() => { closeAuction(r.id).catch(() => {}); }, ms));
  }
}
