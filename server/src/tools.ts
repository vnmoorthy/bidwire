// The agent-facing tool surface. One registry powers the MCP server, the browser playground and the demo agent,
// so every path runs exactly the same code and is logged to the Agent Wire.
import { z } from "zod";
import {
  BidwireError, openAuction, waitForClose, offersResult, getAuction, buyOffer, getApproval, waitForApproval, getOrder, receiptText,
  reportOffer, getBuyer, joinMerchant, merchantByKey, merchantFeed, placeBid, getBid, logToolCall, auctionMs, listingsFor, fmt, getProduct, agentSafeEvidence,
} from "./exchange.js";
import { all } from "./db.js";
import { CATEGORIES } from "./catalog.js";
import type { Buyer, Merchant } from "../../shared/types.js";

export type Caller = { role: "buyer"; buyer: Buyer } | { role: "merchant"; merchant: Merchant } | { role: "anon" };
type Ctx = { caller: Caller; merchantKey?: string | null };

export interface ToolSpec {
  name: string; title: string; description: string; role: "buyer" | "merchant" | "public";
  input: z.ZodObject<any>; readOnly?: boolean; destructive?: boolean; openWorld?: boolean;
  handler: (args: any, ctx: Ctx) => Promise<any>;
}

const needBuyer = (ctx: Ctx): Buyer => {
  if (ctx.caller.role !== "buyer") throw new BidwireError("buyer_key_required", "This tool is for shopping agents.", "Connect with a buyer key (Authorization: Bearer bw_buy_...) or without any key to shop as the guest agent.", 401);
  return getBuyer(ctx.caller.buyer.id)!;
};
const needMerchant = (ctx: Ctx, argKey?: string): Merchant => {
  const k = argKey || ctx.merchantKey;
  const m = k ? merchantByKey(k) : ctx.caller.role === "merchant" ? ctx.caller.merchant : undefined;
  if (!m) throw new BidwireError("merchant_key_required", "This tool is for merchant agents.", "Call register_merchant to open a store and get a merchant_key, then pass it as merchant_key (or connect with Authorization: Bearer bw_mer_...).", 401);
  return m;
};

const usd = (v: number) => Math.round(v * 100);

export const TOOLS: ToolSpec[] = [
  {
    name: "find_offers", title: "Find verified offers", role: "buyer", readOnly: false, openWorld: true,
    description: "Start here when you need to buy something. Opens a short live auction (about 12s) where merchants bid for this purchase, verifies every bid against the merchant's real product page and checkout total, and returns offers ranked on merit (price, must-haves, delivery, trust, returns). Merchant fees never affect rank. Offers that lied are listed under `excluded`. Then call buy_offer with an offer_id.",
    input: z.object({
      need: z.string().min(3).describe('What to buy, in plain words. Example: "noise cancelling headphones for long flights"'),
      budget_usd: z.number().positive().describe("Most you want to spend, delivered (USD)"),
      deliver_within_days: z.number().int().min(0).max(60).optional().describe("Hard delivery deadline in days, if any"),
      must_have: z.array(z.string()).max(8).optional().describe('Feature tags that are required, e.g. ["anc","usb-c"]. See resource bidwire://categories'),
      max_results: z.number().int().min(1).max(10).optional().describe("How many ranked offers to return (default 5)"),
    }),
    handler: async (a, ctx) => {
      const buyer = needBuyer(ctx);
      const auction = openAuction({ buyer, client: clientOf(ctx), need: a.need, budget_cents: usd(a.budget_usd), deliver_within_days: a.deliver_within_days ?? null, must_have: a.must_have });
      const closed = await waitForClose(auction.id, auctionMs() + 8000);
      return offersResult(closed, a.max_results ?? 5);
    },
  },
  {
    name: "get_offers", title: "Get offers for an auction", role: "buyer", readOnly: true,
    description: "Return the ranked, verified offers for an auction you opened. If it is still open, waits up to wait_seconds for it to close.",
    input: z.object({ auction_id: z.string(), wait_seconds: z.number().int().min(0).max(45).optional().describe("Wait for the auction to close (default 20)"), max_results: z.number().int().min(1).max(10).optional() }),
    handler: async (a, ctx) => {
      const buyer = needBuyer(ctx);
      const auc = getAuction(a.auction_id);
      if (!auc) throw new BidwireError("auction_not_found", `No auction ${a.auction_id}.`, "Use the auction_id from find_offers.", 404);
      if (auc.buyer_id !== buyer.id) throw new BidwireError("not_your_auction", "That auction belongs to another agent.", undefined, 403);
      return offersResult(await waitForClose(a.auction_id, (a.wait_seconds ?? 20) * 1000), a.max_results ?? 5);
    },
  },
  {
    name: "buy_offer", title: "Buy an offer", role: "buyer", destructive: true,
    description: "Buy a verified offer from your auction with your prepaid wallet. Enforces your human's spending policy: purchases above the per-purchase or daily limit text your human for approval and wait for the reply (up to wait_for_approval_seconds). Idempotent: buying the same offer twice returns the existing order. If the merchant sold out, returns the next best offer so you can recover.",
    input: z.object({
      offer_id: z.string().describe("offer_id from find_offers / get_offers"),
      idempotency_key: z.string().max(80).optional().describe("Optional key so retries never double-buy"),
      wait_for_approval_seconds: z.number().int().min(0).max(55).optional().describe("If approval is needed, how long to wait for your human's reply in this call (default 40)"),
    }),
    handler: async (a, ctx) => {
      const buyer = needBuyer(ctx);
      return buyOffer({ buyer, offer_id: a.offer_id, idempotency_key: a.idempotency_key, wait_for_approval_ms: (a.wait_for_approval_seconds ?? 40) * 1000 });
    },
  },
  {
    name: "check_approval", title: "Check a purchase approval", role: "buyer", readOnly: true,
    description: "Check (and optionally wait for) your human's answer to a purchase approval request. When status is approved, call buy_offer again with the same offer_id.",
    input: z.object({ approval_id: z.string(), wait_seconds: z.number().int().min(0).max(55).optional().describe("Wait up to this long for a decision (default 25)") }),
    handler: async (a, ctx) => {
      const buyer = needBuyer(ctx);
      const ap = getApproval(a.approval_id);
      if (!ap || ap.buyer_id !== buyer.id) throw new BidwireError("approval_not_found", `No approval ${a.approval_id} for you.`, undefined, 404);
      const r = await waitForApproval(a.approval_id, (a.wait_seconds ?? 25) * 1000);
      return { approval_id: r.id, status: r.status, amount_usd: r.amount_cents / 100, decided_via: r.decided_via,
        next_step: r.status === "approved" ? `Call buy_offer with offer_id "${r.bid_id}".` : r.status === "denied" ? "Your human declined. Choose a cheaper offer or ask them." : "Still waiting for your human. Call check_approval again." };
    },
  },
  {
    name: "get_order", title: "Get an order", role: "buyer", readOnly: true,
    description: "Fetch one of your orders and its receipt.",
    input: z.object({ order_id: z.string() }),
    handler: async (a, ctx) => {
      const buyer = needBuyer(ctx);
      const o = getOrder(a.order_id);
      if (!o || o.buyer_id !== buyer.id) throw new BidwireError("order_not_found", `No order ${a.order_id} for you.`, "Use get_wallet to list your recent orders.", 404);
      return { order: o, receipt: receiptText(o) };
    },
  },
  {
    name: "get_wallet", title: "Get wallet and spending policy", role: "buyer", readOnly: true,
    description: "Your wallet balance, your human's spending limits (per purchase and per day), how much you spent today, and your recent orders.",
    input: z.object({}),
    handler: async (_a, ctx) => {
      const b = needBuyer(ctx);
      const orders = all("SELECT id, sku, amount_cents, created_at FROM orders WHERE buyer_id = ? ORDER BY created_at DESC LIMIT 10", b.id)
        .map((o) => ({ order_id: o.id, product: getProduct(o.sku)?.title, paid_usd: o.amount_cents / 100 }));
      return { agent: b.name, human: b.human_name, wallet_usd: b.wallet_cents / 100, per_purchase_limit_usd: b.per_purchase_limit_cents / 100,
        daily_limit_usd: b.daily_limit_cents / 100, spent_today_usd: b.spent_today_cents / 100, approvals_go_to: b.phone ? "SMS to your human" : "your human's Bidwire phone", recent_orders: orders };
    },
  },
  {
    name: "report_offer", title: "Report a misleading offer", role: "buyer",
    description: "Report an offer whose price, delivery or features look wrong. Bidwire re-inspects the merchant's live page and checkout; confirmed reports cut the merchant's trust score for every agent on the exchange.",
    input: z.object({ offer_id: z.string(), issue: z.string().min(3).max(300) }),
    handler: async (a, ctx) => reportOffer(needBuyer(ctx), a.offer_id, a.issue),
  },
  {
    name: "explain_offer", title: "Explain an offer", role: "public", readOnly: true,
    description: "Full verification evidence and ranking reasons for one offer: what the merchant claimed, what its live page and checkout actually say, and why it ranked where it did. Use it to justify a purchase to your human.",
    input: z.object({ offer_id: z.string() }),
    handler: async (a) => {
      const b = getBid(a.offer_id);
      if (!b) throw new BidwireError("offer_not_found", `No offer ${a.offer_id}.`, undefined, 404);
      return { offer_id: b.id, merchant: b.merchant_name, product: b.product_title, verify_status: b.verify_status, rank: b.rank, merit: b.merit,
        claimed_delivered_usd: (b.claimed_price_cents + b.claimed_shipping_cents) / 100, fee_per_sale_usd: b.fee_cents / 100, fee_affected_rank: false,
        evidence: agentSafeEvidence(b.evidence), why: b.why };
    },
  },
  // ---- merchant side ----
  {
    name: "register_merchant", title: "Open a merchant store", role: "public",
    description: "Merchant agents: open a store on the exchange in one call. Returns a merchant_key and your storefront listings (real product pages the verifier will check). Then poll list_open_requests and bid with place_bid.",
    input: z.object({ store_name: z.string().min(2).max(40), categories: z.array(z.enum(Object.keys(CATEGORIES) as [string, ...string[]])).optional() }),
    handler: async (a) => {
      const r = joinMerchant(a.store_name, "agent", a.categories);
      return { merchant_id: r.merchant.id, merchant_key: r.key, trust: r.merchant.trust,
        listings: r.listings.map((l) => ({ sku: l.sku, product: l.product.title, category: l.product.category, real_delivered_usd: (l.price_cents + l.shipping_cents + l.hidden_fee_cents) / 100, ship_days: l.ship_days, url: l.url })),
        next_step: "Call list_open_requests with your merchant_key." };
    },
  },
  {
    name: "list_open_requests", title: "List open buyer requests", role: "merchant", readOnly: true,
    description: "Live auctions in your categories that you can still bid on, with what the agent needs, its budget and deadline, and which of your listings are eligible.",
    input: z.object({ merchant_key: z.string().optional() }),
    handler: async (a, ctx) => {
      const m = needMerchant(ctx, a.merchant_key);
      const feed = merchantFeed(m.id); const mine = listingsFor(m.id);
      return { merchant: m.name, trust: m.trust, open: feed.open.map((x) => ({
        auction_id: x.id, need: x.need, category: x.category, must_have: x.must_have, budget_usd: x.budget_cents / 100, deliver_within_days: x.deliver_within_days,
        closes_in_seconds: Math.max(0, Math.round((x.closes_at - Date.now()) / 1000)), bids_so_far: x.bids.length,
        already_bid: x.bids.some((b) => b.merchant_id === m.id),
        your_eligible_listings: mine.filter((l) => l.product.category === x.category && l.stock > 0).map((l) => ({ sku: l.sku, product: l.product.title, real_delivered_usd: (l.price_cents + l.shipping_cents + l.hidden_fee_cents) / 100, ship_days: l.ship_days, features: l.product.features })),
      })) };
    },
  },
  {
    name: "place_bid", title: "Bid for an agent's purchase", role: "merchant",
    description: "Bid one of your listings on an open auction. delivered_price_usd is your claimed all-in price; it is checked against your real checkout total, and understating it gets the bid excluded and your trust cut. fee_usd is what you pay Bidwire only if the agent buys from you; it never improves your rank (it only breaks exact ties).",
    input: z.object({
      auction_id: z.string(), sku: z.string(), delivered_price_usd: z.number().positive(),
      ship_days: z.number().int().min(0).max(60).optional(), fee_usd: z.number().min(0).max(100).optional(), pitch: z.string().max(160).optional(), merchant_key: z.string().optional(),
    }),
    handler: async (a, ctx) => {
      const m = needMerchant(ctx, a.merchant_key);
      const b = placeBid({ merchant: m, auction_id: a.auction_id, sku: a.sku, claimed_total_cents: usd(a.delivered_price_usd), ship_days: a.ship_days, fee_cents: usd(a.fee_usd ?? 0), pitch: a.pitch });
      return { bid_id: b.id, status: "pending_verification", note: "Bidwire is checking your claim against your live product page and checkout now. Call get_my_results to see the outcome." };
    },
  },
  {
    name: "get_my_results", title: "Get my bid results", role: "merchant", readOnly: true,
    description: "Your recent bids: verification outcome (and evidence if you were flagged), rank, whether you won, and your trust score.",
    input: z.object({ merchant_key: z.string().optional() }),
    handler: async (a, ctx) => {
      const m = needMerchant(ctx, a.merchant_key);
      const feed = merchantFeed(m.id);
      return { merchant: m.name, trust: m.trust, earned_usd: m.earned_cents / 100, fees_paid_usd: m.fees_paid_cents / 100,
        bids: feed.my_bids.map((b) => ({ bid_id: b.id, auction_id: b.auction_id, product: b.product_title, verify_status: b.verify_status, evidence: b.evidence?.summary ?? null, rank: b.rank, why: b.why.slice(0, 3) })) };
    },
  },
];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

function clientOf(ctx: Ctx) { return (ctx as any).client ?? "mcp"; }
const callerName = (c: Caller) => (c.role === "buyer" ? c.buyer.name : c.role === "merchant" ? c.merchant.name : "anonymous");

function summarize(name: string, r: any): string {
  try {
    switch (name) {
      case "find_offers": case "get_offers": {
        const top = r.offers?.[0];
        return `${r.bids_received} bids → ${r.offers?.length ?? 0} verified${r.excluded?.length ? `, ${r.excluded.length} excluded for lying` : ""}${top ? `; #1 ${top.merchant} $${top.delivered_price_usd}` : ""}`;
      }
      case "buy_offer": return r.status === "purchased" || r.status === "already_purchased" ? `${r.status}: ${r.order.product_title} from ${r.order.merchant_name} for ${fmt(r.order.amount_cents)}` : r.status === "approval_required" ? `needs human approval for $${r.amount_usd}` : r.status === "out_of_stock" ? `sold out → next best: ${r.next_offer?.merchant ?? "none"}` : r.status;
      case "check_approval": return `approval ${r.status}`;
      case "place_bid": return `bid ${r.bid_id} pending verification`;
      case "register_merchant": return `store opened with ${r.listings.length} listings`;
      case "report_offer": return `report ${r.outcome}`;
      case "list_open_requests": return `${r.open.length} open requests`;
      default: return "ok";
    }
  } catch { return "ok"; }
}

export async function callTool(name: string, args: unknown, caller: Caller, client: string, merchantKey?: string | null) {
  const spec = TOOL_BY_NAME.get(name);
  const t0 = Date.now();
  if (!spec) throw new BidwireError("unknown_tool", `No tool ${name}.`, `Tools: ${TOOLS.map((t) => t.name).join(", ")}`, 404);
  let effective = caller;
  const k = (args as any)?.merchant_key || merchantKey;
  if (k) { const m = merchantByKey(k); if (m) effective = { role: "merchant", merchant: m }; }
  try {
    const parsed = spec.input.parse(args ?? {});
    const result = await spec.handler(parsed, { caller: effective, merchantKey, client } as any);
    const text = JSON.stringify(result);
    logToolCall({ client, caller: callerName(effective), role: effective.role, tool: name, args: redact(parsed), ok: true, summary: summarize(name, result), ms: Date.now() - t0, tokens: Math.ceil(text.length / 4) });
    return { ok: true as const, result, text };
  } catch (e: any) {
    const err = e instanceof BidwireError ? { error: e.code, message: e.message, hint: e.hint, ...e.extra }
      : e?.issues ? { error: "invalid_arguments", message: e.issues.map((i: any) => `${i.path.join(".") || "args"}: ${i.message}`).join("; "), hint: "Check the tool's input schema." }
      : { error: "internal_error", message: String(e?.message ?? e) };
    logToolCall({ client, caller: callerName(effective), role: effective.role, tool: name, args: redact(args as any), ok: false, summary: `${err.error}: ${err.message}`, ms: Date.now() - t0, tokens: 40 });
    return { ok: false as const, result: err, text: JSON.stringify(err) };
  }
}

const redact = (a: any) => { if (!a || typeof a !== "object") return {}; const { merchant_key, ...rest } = a; return merchant_key ? { ...rest, merchant_key: "bw_mer_…" } : rest; };

export function toolMeta() {
  return TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description, role: t.role, input_schema: z.toJSONSchema(t.input) }));
}
