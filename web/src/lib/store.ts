import { create } from "zustand";
import { useEffect, useState } from "react";
import type {
  Approval,
  Auction,
  Bid,
  BidwireEvent,
  Buyer,
  Merchant,
  Message,
  Order,
  Snapshot,
  Stats,
  ToolCall,
} from "@shared/types";
import { api } from "./api";
import { banner, toast } from "./fx";
import { claimedTotal, money } from "./format";
import { withdrawal } from "./lot";

/**
 * Live state.
 * - Hydrates from GET /api/state, then streams GET /api/stream (SSE).
 * - If SSE doesn't deliver `hello` within 4s (e.g. a tunnel that buffers SSE) or errors,
 *   falls back to polling GET /api/state every 1.5s, diffing snapshots to fire the same
 *   UI effects, and keeps probing SSE in the background so it can switch back.
 */

export type Conn = "connecting" | "live" | "polling" | "reconnecting";
export type Config = Snapshot["config"];

export type TickKind =
  | "auction"
  | "bid"
  | "verified"
  | "lie"
  | "closed"
  | "bribe"
  | "sold"
  | "fail"
  | "approval"
  | "merchant"
  | "tool"
  | "message"
  | "reset";

export interface TickerItem {
  id: string;
  ts: number;
  kind: TickKind;
  text: string;
}

export interface LiveState {
  hydrated: boolean;
  conn: Conn;
  /** server clock minus client clock (ms), applied only when skew is significant */
  offset: number;
  stats: Stats;
  config: Config | null;
  auctions: Auction[];
  merchants: Merchant[];
  buyers: Buyer[];
  orders: Order[];
  approvals: Approval[];
  messages: Message[];
  toolCalls: ToolCall[];
  ticker: TickerItem[];
  /** bumps whenever ledger entries may have changed (Ledger page refetches) */
  ledgerVersion: number;
  /** bumps whenever a new auction opens (merchant feed refetches) */
  auctionVersion: number;
  /** bumps on full replacement (first hydrate, demo reset) */
  resetVersion: number;
  lastEventAt: number;
}

export const EMPTY_STATS: Stats = {
  auctions: 0,
  bids: 0,
  verified: 0,
  lies_caught: 0,
  bribes_ignored: 0,
  orders: 0,
  gmv_cents: 0,
  platform_fees_cents: 0,
  tool_calls: 0,
  agents_seen: 0,
  approvals_pending: 0,
};

export const useLive = create<LiveState>(() => ({
  hydrated: false,
  conn: "connecting",
  offset: 0,
  stats: EMPTY_STATS,
  config: null,
  auctions: [],
  merchants: [],
  buyers: [],
  orders: [],
  approvals: [],
  messages: [],
  toolCalls: [],
  ticker: [],
  ledgerVersion: 0,
  auctionVersion: 0,
  resetVersion: 0,
  lastEventAt: 0,
}));

/* ------------------------------------------------------------------ helpers */

const MAX = { auctions: 30, orders: 80, approvals: 40, messages: 120, toolCalls: 80, ticker: 40 };

function upsert<T extends { id: string }>(list: T[], item: T, max: number, prepend = true): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) {
    const copy = list.slice();
    copy[i] = item;
    return copy;
  }
  const next = prepend ? [item, ...list] : [...list, item];
  return next.length > max ? next.slice(0, max) : next;
}

function byOpenedDesc(a: Auction, b: Auction) {
  return b.opened_at - a.opened_at;
}

const STATUS_RANK: Record<string, number> = { pending: 0, verified: 1, mismatch: 1 };

/** Merge an incoming bid over an existing one without regressing verification/ranking. */
function mergeBid(prev: Bid | undefined, next: Bid): Bid {
  if (!prev) return next;
  const regress = (STATUS_RANK[next.verify_status] ?? 0) < (STATUS_RANK[prev.verify_status] ?? 0);
  return {
    ...prev,
    ...next,
    verify_status: regress ? prev.verify_status : next.verify_status,
    evidence: next.evidence ?? prev.evidence,
    merit: next.merit ?? prev.merit,
    rank: next.rank ?? prev.rank,
    why: next.why && next.why.length ? next.why : prev.why,
    bribe_ignored: next.bribe_ignored || prev.bribe_ignored,
  };
}

function withBid(a: Auction, bid: Bid): Auction {
  const bids = a.bids ?? [];
  const i = bids.findIndex((b) => b.id === bid.id);
  if (i >= 0) {
    const copy = bids.slice();
    copy[i] = mergeBid(bids[i], bid);
    return { ...a, bids: copy };
  }
  return { ...a, bids: [...bids, bid] };
}

/* ------------------------------------------------------------------ ticker (deterministic ids => no duplicates) */

function tick(kind: TickKind, key: string, text: string, ts: number): TickerItem {
  return { id: `${kind}:${key}`, ts, kind, text };
}

const T = {
  auction: (a: Auction) => tick("auction", a.id, `New lot from ${a.buyer_name}: “${a.need}” (budget ${money(a.budget_cents)})`, a.opened_at),
  bid: (b: Bid) => tick("bid", b.id, `${b.merchant_name} raised a paddle at ${money(claimedTotal(b))} for ${b.product_title}`, b.created_at),
  verified: (b: Bid, ts: number) => tick("verified", b.id, `Verified ${b.merchant_name}: ${money(claimedTotal(b))} matches the real checkout`, ts),
  lie: (b: Bid, ts: number) => {
    const w = withdrawal(b);
    const text = `${w?.title ?? "Bid withdrawn"} · ${b.merchant_name}: ${w?.detail ?? "misrepresentation"}`;
    return tick("lie", b.id, text.length > 200 ? `${text.slice(0, 199)}…` : text, ts);
  },
  closed: (a: Auction, ts: number) => {
    const w = winnerOf(a);
    return tick(
      "closed",
      a.id,
      w ? `Hammer · ${money(claimedTotal(w))} · ${w.merchant_name} (${w.product_title})` : `Passed: no eligible offers for “${a.need}”`,
      ts,
    );
  },
  bribe: (b: Bid, ts: number) => tick("bribe", b.id, `Bribe ignored · ${b.merchant_name} offered ${money(b.fee_cents)} commission, still No. ${b.rank ?? "—"}`, ts),
  sold: (o: Order) => tick("sold", o.id, `Sold to ${o.buyer_name} · ${o.product_title} from ${o.merchant_name} · ${money(o.amount_cents)} (commission ${money(o.fee_cents)})`, o.created_at),
  approvalAsked: (ap: Approval) =>
    tick("approval", `ask:${ap.id}`, `${ap.buyer_name} asked ${ap.human_name} to approve ${money(ap.amount_cents)} (limit ${money(ap.limit_cents)})`, ap.created_at),
  approvalDecided: (ap: Approval) =>
    tick("approval", `decided:${ap.id}`, `${ap.human_name} ${ap.status} ${money(ap.amount_cents)} for ${ap.buyer_name}`, ap.decided_at ?? Date.now()),
  merchant: (m: Merchant) => tick("merchant", m.id, `${m.name} joined as a ${m.kind} merchant`, m.created_at),
  tool: (t: ToolCall) => tick("tool", t.id, `${t.caller} → ${t.tool}: ${t.summary}`, t.ts),
  message: (m: Message) =>
    tick(
      "message",
      m.id,
      `${m.channel.toUpperCase()} ${m.direction === "out" ? "to" : "from"} ${m.direction === "out" ? m.to : m.from}: ${m.subject ?? m.body}`.slice(0, 160),
      m.ts,
    ),
};

/** The hammer (No. 1 verified paddle at close). Whether it sold is told by order.created / T.sold. */
function winnerOf(a: Auction): Bid | undefined {
  return a.bids?.find((b) => b.rank === 1 && b.verify_status !== "mismatch");
}

function pushTicks(items: TickerItem[]) {
  if (!items.length) return;
  useLive.setState((s) => {
    const have = new Set(s.ticker.map((t) => t.id));
    const fresh = items.filter((t) => !have.has(t.id)).sort((a, b) => b.ts - a.ts);
    if (!fresh.length) return {};
    return { ticker: [...fresh, ...s.ticker].sort((a, b) => b.ts - a.ts).slice(0, MAX.ticker) };
  });
}

function seedTicker(s: Snapshot): TickerItem[] {
  const items: TickerItem[] = [];
  for (const a of s.auctions.slice(0, 8)) {
    items.push(T.auction(a));
    for (const b of a.bids ?? []) if (b.verify_status === "mismatch") items.push(T.lie(b, b.created_at));
    if (a.status === "closed") items.push(T.closed(a, a.closed_at ?? a.closes_at));
  }
  for (const o of s.orders.slice(0, 8)) items.push(T.sold(o));
  for (const t of s.tool_calls.slice(0, 10)) items.push(T.tool(t));
  for (const m of s.merchants.filter((m) => m.kind === "human").slice(0, 5)) items.push(T.merchant(m));
  return items.sort((a, b) => b.ts - a.ts).slice(0, MAX.ticker);
}

/* ------------------------------------------------------------------ UI effects (shared by SSE and polling) */

function fxFlagged(b: Bid) {
  const e = b.evidence;
  const w = withdrawal(b);
  let evidence: string;
  if (w?.kind === "injection") evidence = w.detail; // quotes the snippet: never rewrite inside it
  else if (e?.summary) evidence = e.summary.replace(/;\s*checkout says/i, " · the checkout says").replace(/;\s*/g, " · ");
  else if (e) evidence = `Claimed ${money(e.claimed_total_cents)} delivered · the checkout says ${money(e.actual_total_cents)}`;
  else evidence = "The claim didn't match the merchant's real checkout.";
  banner({ kind: "lie", title: `${w?.title ?? "Bid withdrawn"} · ${b.merchant_name}`, sub: evidence }, w?.kind === "injection" ? 6500 : 5000);
}

function fxClosed(a: Auction) {
  const bribes = (a.bids ?? []).filter((b) => b.bribe_ignored).sort((x, y) => y.fee_cents - x.fee_cents);
  if (!bribes.length) return [] as Bid[];
  const b = bribes[0];
  banner(
    {
      kind: "bribe",
      title: `Bribe ignored · ${b.merchant_name}`,
      sub: `Offered ${money(b.fee_cents)} commission and still No. ${b.rank ?? "—"}. Commission never buys rank: lots go on price, specs, delivery, trust and returns.`,
    },
    5000,
  );
  return bribes;
}

function fxOrder(o: Order) {
  toast({ kind: "sold", title: `Sold to ${o.buyer_name}`, body: `${o.product_title} · ${o.merchant_name}`, amount: o.amount_cents, fee: o.fee_cents }, 6500);
}

function fxApprovalRequested(ap: Approval) {
  toast({ kind: "approval", title: `Asking ${ap.human_name} to approve ${money(ap.amount_cents)}`, body: `${ap.buyer_name} is over its ${money(ap.limit_cents)} limit` }, 6500);
}

function fxApprovalDecided(ap: Approval) {
  if (ap.status === "pending") return;
  toast({
    kind: ap.status === "approved" ? "approved" : "denied",
    title: `${ap.human_name} ${ap.status} ${money(ap.amount_cents)}`,
    body: ap.decided_via ? `via ${ap.decided_via}` : undefined,
  });
}

function fxMerchantJoined(m: Merchant) {
  if (m.kind === "human") toast({ kind: "merchant", title: `${m.name} opened a store`, body: "Joined from a phone in the room" }, 4500);
}

function fxReset() {
  toast({ kind: "info", title: "Demo reset", body: "Fresh exchange, fresh wallets." }, 3000);
}

/* ------------------------------------------------------------------ apply */

interface SnapOpts {
  serverTs?: number;
  ticker: "replace" | "merge" | "keep";
  bumpLedger?: boolean;
  bumpAuction?: boolean;
  reset?: boolean;
}

function applySnapshot(snap: Snapshot, opts: SnapOpts) {
  const st = useLive.getState();
  let offset = st.offset;
  if (typeof opts.serverTs === "number" && Number.isFinite(opts.serverTs)) {
    const o = opts.serverTs - Date.now();
    offset = Math.abs(o) > 2000 ? o : 0;
  }
  const first = !st.hydrated;
  let ticker = st.ticker;
  if (opts.ticker === "replace" || first) ticker = seedTicker(snap);
  else if (opts.ticker === "merge") {
    const have = new Set(st.ticker.map((t) => t.id));
    ticker = [...st.ticker, ...seedTicker(snap).filter((t) => !have.has(t.id))].sort((a, b) => b.ts - a.ts).slice(0, MAX.ticker);
  }
  useLive.setState((s) => ({
    hydrated: true,
    offset,
    stats: snap.stats ?? EMPTY_STATS,
    config: snap.config ?? s.config,
    auctions: [...(snap.auctions ?? [])].sort(byOpenedDesc),
    merchants: snap.merchants ?? [],
    buyers: snap.buyers ?? [],
    orders: snap.orders ?? [],
    approvals: snap.approvals ?? [],
    messages: snap.messages ?? [],
    toolCalls: snap.tool_calls ?? [],
    ticker,
    resetVersion: first || opts.reset ? s.resetVersion + 1 : s.resetVersion,
    ledgerVersion: first || opts.reset || opts.bumpLedger ? s.ledgerVersion + 1 : s.ledgerVersion,
    auctionVersion: opts.bumpAuction ? s.auctionVersion + 1 : s.auctionVersion,
    lastEventAt: Date.now(),
  }));
}

const fetchingAuctions = new Set<string>();
function ensureAuction(id: string) {
  if (fetchingAuctions.has(id)) return;
  fetchingAuctions.add(id);
  api
    .auction(id)
    .then((a) => upsertAuction(a))
    .catch(() => {})
    .finally(() => fetchingAuctions.delete(id));
}

function upsertAuction(a: Auction) {
  useLive.setState((s) => {
    const prev = s.auctions.find((x) => x.id === a.id);
    let merged = a;
    if (prev && a.bids) {
      const bids = a.bids.map((b) => mergeBid(prev.bids?.find((p) => p.id === b.id), b));
      for (const pb of prev.bids ?? []) if (!bids.some((b) => b.id === pb.id)) bids.push(pb);
      merged = { ...a, bids };
    }
    return { auctions: upsert(s.auctions, merged, MAX.auctions).sort(byOpenedDesc) };
  });
}

function applyBid(bid: Bid) {
  const s = useLive.getState();
  const a = s.auctions.find((x) => x.id === bid.auction_id);
  if (!a) {
    ensureAuction(bid.auction_id);
    return;
  }
  useLive.setState({ auctions: s.auctions.map((x) => (x.id === bid.auction_id ? withBid(x, bid) : x)) });
}

/** Apply one SSE event. */
export function applyEvent(ev: BidwireEvent) {
  const ts = ev.ts ?? Date.now();
  useLive.setState({ lastEventAt: Date.now() });
  switch (ev.type) {
    case "hello":
      applySnapshot(ev.data, { serverTs: ev.ts, ticker: "merge", bumpLedger: true, bumpAuction: true });
      return;
    case "demo.reset":
      applySnapshot(ev.data, { serverTs: ev.ts, ticker: "replace", reset: true });
      pushTicks([tick("reset", String(ts), "Demo reset: fresh exchange, fresh wallets", ts)]);
      fxReset();
      return;
    case "auction.opened":
      upsertAuction(ev.data);
      useLive.setState((s) => ({ auctionVersion: s.auctionVersion + 1 }));
      pushTicks([T.auction(ev.data)]);
      return;
    case "bid.placed":
      applyBid(ev.data);
      pushTicks([T.bid(ev.data)]);
      return;
    case "bid.verified":
      applyBid(ev.data);
      pushTicks([T.verified(ev.data, ts)]);
      return;
    case "bid.flagged":
      applyBid(ev.data);
      fxFlagged(ev.data);
      pushTicks([T.lie(ev.data, ts)]);
      return;
    case "auction.closed": {
      upsertAuction(ev.data);
      const bribes = fxClosed(ev.data);
      pushTicks([T.closed(ev.data, ts), ...bribes.map((b) => T.bribe(b, ts))]);
      return;
    }
    case "approval.requested":
      useLive.setState((s) => ({ approvals: upsert(s.approvals, ev.data, MAX.approvals) }));
      fxApprovalRequested(ev.data);
      pushTicks([T.approvalAsked(ev.data)]);
      return;
    case "approval.decided":
      useLive.setState((s) => ({ approvals: upsert(s.approvals, ev.data, MAX.approvals) }));
      fxApprovalDecided(ev.data);
      pushTicks([T.approvalDecided(ev.data)]);
      return;
    case "order.created":
      useLive.setState((s) => ({ orders: upsert(s.orders, ev.data, MAX.orders) }));
      fxOrder(ev.data);
      pushTicks([T.sold(ev.data)]);
      return;
    case "order.failed":
      toast({ kind: "fail", title: "Order failed", body: ev.data.reason }, 6500);
      pushTicks([tick("fail", `${ev.data.bid_id}:${ts}`, `Order failed: ${ev.data.reason}`, ts)]);
      return;
    case "merchant.joined":
      useLive.setState((s) => ({ merchants: upsert(s.merchants, ev.data, 500, false) }));
      fxMerchantJoined(ev.data);
      pushTicks([T.merchant(ev.data)]);
      return;
    case "merchant.updated":
      useLive.setState((s) => ({ merchants: upsert(s.merchants, ev.data, 500, false) }));
      return;
    case "buyer.updated":
      useLive.setState((s) => ({ buyers: upsert(s.buyers, ev.data, 500, false) }));
      return;
    case "message":
      useLive.setState((s) => ({ messages: upsert(s.messages, ev.data, MAX.messages) }));
      pushTicks([T.message(ev.data)]);
      return;
    case "tool.call":
      useLive.setState((s) => ({ toolCalls: upsert(s.toolCalls, ev.data, MAX.toolCalls) }));
      pushTicks([T.tool(ev.data)]);
      return;
    case "ledger.posted":
      useLive.setState((s) => ({ ledgerVersion: s.ledgerVersion + 1 }));
      return;
    case "stats":
      useLive.setState({ stats: ev.data });
      return;
    case "config":
      useLive.setState({ config: ev.data });
      return;
    default:
      return;
  }
}

/** Polling fallback: diff the new snapshot against the current state, fire the same effects, then replace. */
function diffAndApply(next: Snapshot) {
  const prev = useLive.getState();
  if (!prev.hydrated) {
    applySnapshot(next, { ticker: "replace" });
    return;
  }
  const prevAuctions = new Map(prev.auctions.map((a) => [a.id, a]));
  const looksReset =
    (next.stats?.auctions ?? 0) < prev.stats.auctions ||
    (next.stats?.bids ?? 0) < prev.stats.bids ||
    (next.stats?.orders ?? 0) < prev.stats.orders;
  if (looksReset) {
    applySnapshot(next, { ticker: "replace", reset: true });
    fxReset();
    return;
  }

  const now = Date.now() + prev.offset;
  const recent = (t: number | null | undefined) => typeof t === "number" && now - t < 15_000;
  const ticks: TickerItem[] = [];
  const prevBids = new Map<string, Bid>();
  for (const a of prev.auctions) for (const b of a.bids ?? []) prevBids.set(b.id, b);

  let newAuction = false;
  let lieBanners = 0;
  for (const a of [...(next.auctions ?? [])].sort((x, y) => x.opened_at - y.opened_at)) {
    const pa = prevAuctions.get(a.id);
    if (!pa) {
      newAuction = true;
      ticks.push(T.auction(a));
    }
    for (const b of a.bids ?? []) {
      const pb = prevBids.get(b.id);
      if (!pb) ticks.push(T.bid(b));
      if (b.verify_status === "mismatch" && pb?.verify_status !== "mismatch") {
        if ((pb || recent(b.created_at)) && lieBanners < 2) {
          fxFlagged(b);
          lieBanners++;
        }
        ticks.push(T.lie(b, now));
      } else if (b.verify_status === "verified" && pb?.verify_status !== "verified") {
        ticks.push(T.verified(b, now));
      }
    }
    if (a.status === "closed" && (pa ? pa.status !== "closed" : recent(a.closed_at))) {
      const bribes = fxClosed(a);
      ticks.push(T.closed(a, a.closed_at ?? now), ...bribes.map((b) => T.bribe(b, a.closed_at ?? now)));
    }
  }

  const prevOrders = new Set(prev.orders.map((o) => o.id));
  for (const o of [...(next.orders ?? [])].reverse()) {
    if (prevOrders.has(o.id)) continue;
    fxOrder(o);
    ticks.push(T.sold(o));
  }

  const prevApprovals = new Map(prev.approvals.map((a) => [a.id, a]));
  for (const ap of [...(next.approvals ?? [])].reverse()) {
    const p = prevApprovals.get(ap.id);
    if (!p) {
      ticks.push(T.approvalAsked(ap));
      if (ap.status === "pending") fxApprovalRequested(ap);
      else {
        fxApprovalDecided(ap);
        ticks.push(T.approvalDecided(ap));
      }
    } else if (p.status === "pending" && ap.status !== "pending") {
      fxApprovalDecided(ap);
      ticks.push(T.approvalDecided(ap));
    }
  }

  const prevMerchants = new Set(prev.merchants.map((m) => m.id));
  for (const m of next.merchants ?? []) {
    if (prevMerchants.has(m.id)) continue;
    fxMerchantJoined(m);
    ticks.push(T.merchant(m));
  }

  const prevTools = new Set(prev.toolCalls.map((t) => t.id));
  for (const t of next.tool_calls ?? []) if (!prevTools.has(t.id)) ticks.push(T.tool(t));
  const prevMsgs = new Set(prev.messages.map((m) => m.id));
  for (const m of next.messages ?? []) if (!prevMsgs.has(m.id)) ticks.push(T.message(m));

  const s0 = prev.stats;
  const s1 = next.stats ?? EMPTY_STATS;
  const moneyMoved = s1.orders !== s0.orders || s1.gmv_cents !== s0.gmv_cents || s1.platform_fees_cents !== s0.platform_fees_cents;
  applySnapshot(next, { ticker: "keep", bumpLedger: moneyMoved, bumpAuction: newAuction });
  pushTicks(ticks);
}

/* ------------------------------------------------------------------ connection manager */

const EVENT_TYPES = [
  "hello",
  "auction.opened",
  "bid.placed",
  "bid.verified",
  "bid.flagged",
  "auction.closed",
  "approval.requested",
  "approval.decided",
  "order.created",
  "order.failed",
  "merchant.joined",
  "merchant.updated",
  "buyer.updated",
  // "message" is deliberately absent: unnamed SSE events already arrive via onmessage,
  // and a listener for "message" would process every event twice.
  "tool.call",
  "ledger.posted",
  "stats",
  "demo.reset",
  "config",
];

const HELLO_TIMEOUT_MS = 4000;
const POLL_MS = 1500;
const SSE_RETRY_MS = 30_000;

let mode: "sse" | "poll" = "sse";
let es: EventSource | null = null;
let helloTimer: number | undefined;
let probeTimer: number | undefined;
let pollGen = 0;
let started = false;

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function parseEvent(raw: string): BidwireEvent | null {
  if (!raw) return null;
  try {
    const ev = JSON.parse(raw);
    return ev && typeof ev === "object" && typeof ev.type === "string" ? (ev as BidwireEvent) : null;
  } catch {
    return null;
  }
}

function closeSse() {
  window.clearTimeout(helloTimer);
  if (es) {
    es.close();
    es = null;
  }
}

function scheduleProbe(ms: number) {
  window.clearTimeout(probeTimer);
  probeTimer = window.setTimeout(() => {
    if (mode === "poll") openSse(true);
  }, ms);
}

function fallBackToPolling(retryMs: number) {
  closeSse();
  startPolling();
  scheduleProbe(retryMs);
}

/** Open the SSE stream. As a probe (while polling), it only takes over once `hello` arrives. */
function openSse(probe = false) {
  closeSse();
  if (!probe) useLive.setState((s) => ({ conn: s.hydrated ? "reconnecting" : "connecting" }));
  let src: EventSource;
  try {
    src = new EventSource("/api/stream");
  } catch {
    fallBackToPolling(SSE_RETRY_MS);
    return;
  }
  es = src;
  let gotHello = false;

  const onMessage = (m: MessageEvent) => {
    if (es !== src) return;
    const ev = parseEvent(m.data);
    if (!ev) return;
    if (ev.type === "hello") {
      gotHello = true;
      window.clearTimeout(helloTimer);
      if (mode === "poll") {
        pollGen++; // stop the polling loop (discards any in-flight poll)
        window.clearTimeout(probeTimer);
      }
      mode = "sse";
      useLive.setState({ conn: "live" });
    }
    if (!gotHello) return; // only trust the stream once it has said hello
    try {
      applyEvent(ev);
    } catch (e) {
      console.error("[bidwire] failed to apply event", ev.type, e);
    }
  };
  src.onmessage = onMessage;
  for (const t of EVENT_TYPES) src.addEventListener(t, onMessage as EventListener);
  src.onerror = () => {
    if (es !== src) return;
    // Stream broke: keep the UI live by polling; retry SSE soon if it had been working.
    fallBackToPolling(gotHello ? 3000 : SSE_RETRY_MS);
  };
  helloTimer = window.setTimeout(() => {
    if (es !== src || gotHello) return;
    fallBackToPolling(SSE_RETRY_MS);
  }, HELLO_TIMEOUT_MS);
}

function startPolling() {
  if (mode === "poll") return;
  mode = "poll";
  const gen = ++pollGen;
  useLive.setState((s) => ({ conn: s.hydrated ? "polling" : "connecting" }));
  void (async () => {
    while (gen === pollGen) {
      const visible = document.visibilityState === "visible";
      if (visible || !useLive.getState().hydrated) {
        try {
          const snap = await api.state();
          if (gen !== pollGen) return;
          diffAndApply(snap);
          if (useLive.getState().conn !== "polling") useLive.setState({ conn: "polling" });
        } catch {
          if (gen !== pollGen) return;
          useLive.setState({ conn: "reconnecting" });
        }
      }
      await sleep(POLL_MS);
    }
  })();
}

export async function refreshState() {
  try {
    const snap = await api.state();
    diffAndApply(snap);
  } catch {
    /* the stream or the poller will catch up */
  }
}

export function startLive() {
  if (started) return;
  started = true;
  api
    .state()
    .then((snap) => {
      if (!useLive.getState().hydrated) applySnapshot(snap, { ticker: "replace" });
    })
    .catch(() => {});
  openSse(false);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (mode === "sse" && (!es || es.readyState === EventSource.CLOSED)) openSse(false);
    if (mode === "poll") void refreshState();
  });
  window.addEventListener("online", () => {
    if (mode === "poll") scheduleProbe(500);
    else if (!es || es.readyState === EventSource.CLOSED) openSse(false);
  });
}

/* ------------------------------------------------------------------ hooks */

export function serverNow(): number {
  return Date.now() + useLive.getState().offset;
}

/** Re-renders every `intervalMs` with the server-aligned clock. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function findBid(auctions: Auction[], bidId: string): { auction: Auction; bid: Bid } | null {
  for (const a of auctions) {
    const b = a.bids?.find((x) => x.id === bidId);
    if (b) return { auction: a, bid: b };
  }
  return null;
}
