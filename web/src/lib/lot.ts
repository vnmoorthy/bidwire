import type { Approval, Auction, Bid, Order } from "@shared/types";
import { claimedTotal } from "./format";

/* Pure helpers that say what is actually true about a lot. No store imports (store.ts uses these). */

export type WithdrawalKind = "injection" | "misrepresentation";

export interface Withdrawal {
  kind: WithdrawalKind;
  /** status badge text */
  label: string;
  /** banner / ticker title prefix */
  title: string;
  /** human-facing evidence line */
  detail: string;
}

/**
 * Why a bid was withdrawn, for HUMAN-facing UI.
 * A failing "Pitch safety" check is a blocked prompt injection: show that check's detail (it quotes the snippet),
 * not evidence.summary (which withholds the text from agents).
 */
export function withdrawal(b: Bid): Withdrawal | null {
  if (b.verify_status !== "mismatch") return null;
  const checks = b.evidence?.checks ?? [];
  const pitch = checks.find((c) => !c.ok && c.name.trim().toLowerCase() === "pitch safety");
  if (pitch) {
    const others = checks.filter((c) => !c.ok && c !== pitch && c.name !== "In stock").map((c) => c.detail);
    return { kind: "injection", label: "Prompt injection blocked", title: "Prompt injection blocked", detail: [pitch.detail, ...others].join(" · ") };
  }
  return {
    kind: "misrepresentation",
    label: "Withdrawn: misrepresentation",
    title: "Bid withdrawn",
    detail: b.evidence?.summary || "The claim didn't match the merchant's real checkout",
  };
}

/** No. 1 verified paddle once the lot has closed. Says nothing about whether the agent bought it. */
export function isHammer(a: Auction, b: Bid): boolean {
  return a.status === "closed" && b.rank === 1 && b.verify_status !== "mismatch";
}

export interface LotState {
  closed: boolean;
  /** No. 1 verified paddle at close */
  hammer: Bid | null;
  /** the purchase, once the agent actually bought */
  order: Order | null;
  /** the paddle that was bought (usually the hammer; not after an out-of-stock recovery) */
  soldBid: Bid | null;
  sold: boolean;
  /** this lot's approval request: the pending one if any, else the latest */
  approval: Approval | null;
  /** cheapest verified paddle so far (the hammer once closed) */
  best: Bid | null;
}

export function lotState(a: Auction, orders: Order[], approvals: Approval[]): LotState {
  const bids = a.bids ?? [];
  const closed = a.status === "closed";
  const hammer = closed ? bids.find((b) => b.rank === 1 && b.verify_status !== "mismatch") ?? null : null;
  const order = orders.find((o) => o.auction_id === a.id && o.status !== "failed") ?? null;
  // winner_bid_id is written by the server only when an order is committed (polling snapshots carry it; SSE has order.created).
  const soldId = order?.bid_id ?? a.winner_bid_id ?? null;
  const soldBid = soldId ? bids.find((b) => b.id === soldId) ?? null : null;
  const mine = approvals.filter((p) => p.auction_id === a.id);
  const approval = mine.find((p) => p.status === "pending") ?? mine.sort((x, y) => y.created_at - x.created_at)[0] ?? null;
  const verified = bids.filter((b) => b.verify_status === "verified");
  const cheapest = verified.length ? [...verified].sort((x, y) => claimedTotal(x) - claimedTotal(y))[0] : null;
  return { closed, hammer, order, soldBid, sold: !!soldId, approval, best: hammer ?? cheapest };
}
