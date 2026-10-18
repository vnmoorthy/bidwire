import type { Auction, Bid } from "@shared/types";
import { Aperture, Asterisk, Bot, Braces, MousePointer2, SquareTerminal, type LucideIcon } from "lucide-react";
import { claimedTotal, money } from "@/lib/format";

/* Pure selectors over the live store, shared by the landing sections. */

export function isLive(a: Auction): boolean {
  return a.status !== "closed";
}

export function hasLie(a: Auction): boolean {
  return (a.bids ?? []).some((b) => b.verify_status === "mismatch");
}

export function isRanked(a: Auction): boolean {
  return (a.bids ?? []).some((b) => b.rank != null);
}

/** What the agent would actually pay: the checkout truth once verified, otherwise the claim. */
export function deliveredCents(b: Bid): number {
  return b.evidence?.actual_total_cents ?? claimedTotal(b);
}

/* ------------------------------------------------------------------ auction-house vocabulary */

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A stable 3-digit paddle number for a merchant (100–999), derived from its id. */
export function paddleNo(merchantId: string): number {
  return 100 + (hash(merchantId ?? "") % 900);
}

/** Lot number: auctions are numbered in the order they opened (the store keeps the most recent ones). */
export function lotNo(a: Auction, auctions: Auction[], total: number): number {
  const i = auctions.findIndex((x) => x.id === a.id);
  const n = i >= 0 ? total - i : total;
  return Math.max(1, n);
}

export function lotLabel(n: number): string {
  return `Lot ${String(n).padStart(2, "0")}`;
}

const DEPARTMENTS: Record<string, string> = {
  headphones: "Audio",
  chargers: "Power",
  keyboards: "Keyboards",
  backpacks: "Travel",
  coffee: "Coffee",
  monitors: "Displays",
};

export function department(category: string | null | undefined): string | null {
  if (!category) return null;
  return DEPARTMENTS[category] ?? category.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/* ------------------------------------------------------------------ picking what to show */

/**
 * The lot to feature when nothing is live: the most recent one that tells the whole story
 * (ranked offers plus a withdrawn liar), looking back a few lots; otherwise the latest with bids.
 */
export function pickShowcase(auctions: Auction[]): Auction | null {
  const withBids = auctions.filter((a) => (a.bids?.length ?? 0) > 0);
  const recent = withBids.slice(0, 6);
  return recent.find((a) => isRanked(a) && hasLie(a)) ?? recent.find(isRanked) ?? withBids[0] ?? auctions[0] ?? null;
}

const STATUS_ORDER: Record<string, number> = { verified: 0, pending: 1, mismatch: 2 };

/** Ranked/verified offers first (by rank, then by delivered price while the lot is still open). */
export function orderedOffers(a: Auction): Bid[] {
  return (a.bids ?? [])
    .filter((b) => b.verify_status !== "mismatch")
    .slice()
    .sort((x, y) => {
      if (x.rank != null && y.rank != null) return x.rank - y.rank;
      if (x.rank != null) return -1;
      if (y.rank != null) return 1;
      const s = (STATUS_ORDER[x.verify_status] ?? 1) - (STATUS_ORDER[y.verify_status] ?? 1);
      if (s) return s;
      return deliveredCents(x) - deliveredCents(y);
    });
}

/** Withdrawn bids, the classic hidden-fee lie first (it tells the story best), then the rest by time. */
export function liedOffers(a: Auction): Bid[] {
  const weight = (b: Bid) => {
    const e = b.evidence;
    if (e && e.actual_total_cents > e.claimed_total_cents + 50) return 0;
    if (e?.checks?.some((c) => !c.ok && /pitch/i.test(c.name))) return 2;
    return 1;
  };
  return (a.bids ?? [])
    .filter((b) => b.verify_status === "mismatch")
    .sort((x, y) => weight(x) - weight(y) || x.created_at - y.created_at);
}

/** The offer leading the lot: No. 1 once ranked, otherwise the cheapest verified paddle so far. */
export function leadingOffer(a: Auction): Bid | null {
  const ok = orderedOffers(a);
  const ranked = ok.find((b) => b.rank === 1);
  if (ranked) return ranked;
  const verified = ok.filter((b) => b.verify_status === "verified").sort((x, y) => deliveredCents(x) - deliveredCents(y));
  return verified[0] ?? null;
}

/** Top offers plus (when one exists) a withdrawn liar, so the list always tells the full story. */
export function cardRows(a: Auction, max = 4): Bid[] {
  const ok = orderedOffers(a);
  const lies = liedOffers(a);
  const lieSlots = lies.length ? 1 : 0;
  const rows = ok.slice(0, max - lieSlots);
  const fill = Math.max(lieSlots, max - rows.length);
  return [...rows, ...lies.slice(0, fill)];
}

/** Short, human explanation of why a bid was withdrawn. */
export function lieReason(b: Bid): { title: string; checkout: number | null; fee: string | null; text: string } {
  const e = b.evidence;
  const failed = e?.checks?.filter((c) => !c.ok && c.name !== "In stock") ?? [];
  // Pitches are data, never instructions: say what happened without repeating the injected text.
  if (failed.some((c) => /pitch/i.test(c.name)))
    return { title: "Prompt injection.", checkout: null, fee: null, text: "Its pitch tried to give the buying agent instructions." };
  const priceLie = !!e && e.actual_total_cents > e.claimed_total_cents + 50;
  if (e && priceLie) {
    const m = (e.summary ?? "").match(/\+\$([\d,]+\.\d{2}) ["“]([^"”]+)["”]/);
    return {
      title: "Misrepresentation.",
      checkout: e.actual_total_cents,
      fee: m ? `+$${m[1]} “${m[2]}”` : null,
      text: `Checkout says ${money(e.actual_total_cents)}`,
    };
  }
  const raw = failed[0]?.detail ?? e?.summary ?? "Claim didn't match the merchant's own checkout";
  return { title: "Misrepresentation.", checkout: null, fee: null, text: raw.replace(/^Claims (\S+) but/, "Claims “$1” but") };
}

export function findBribe(auctions: Auction[], prefer?: Auction | null): { auction: Auction; bid: Bid } | null {
  const pool = prefer ? [prefer, ...auctions.filter((a) => a.id !== prefer.id)] : auctions;
  for (const a of pool) {
    const b = (a.bids ?? []).filter((x) => x.bribe_ignored && x.rank != null).sort((x, y) => y.fee_cents - x.fee_cents)[0];
    if (b) return { auction: a, bid: b };
  }
  return null;
}

/* ------------------------------------------------------------------ agent clients */

export interface AgentClient {
  key: string;
  label: string;
  Icon: LucideIcon;
}

export function agentClient(raw: string | null | undefined): AgentClient {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("claude") || s.includes("anthropic")) return { key: "claude", label: "Claude", Icon: Asterisk };
  if (s.includes("chatgpt") || s.includes("openai") || s === "gpt") return { key: "chatgpt", label: "ChatGPT", Icon: Aperture };
  if (s.includes("codex")) return { key: "codex", label: "Codex", Icon: SquareTerminal };
  if (s.includes("cursor")) return { key: "cursor", label: "Cursor", Icon: MousePointer2 };
  if (s.includes("playground")) return { key: "playground", label: "Playground", Icon: Braces };
  if (s.includes("demo") || s.includes("bidwire")) return { key: "demo", label: "Demo agent", Icon: Bot };
  if (s.includes("guest") || s === "anon" || !s) return { key: "guest", label: "Guest agent", Icon: Bot };
  return { key: s, label: raw!.length > 16 ? raw!.slice(0, 15) + "…" : raw!, Icon: Bot };
}

export function AgentBadge({ client, className = "" }: { client: string; className?: string }) {
  const c = agentClient(client);
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-agent-soft pl-1 pr-2.5 text-[12px] font-semibold text-agent ${className}`}
    >
      <span className="grid size-4 place-items-center rounded-full bg-agent text-panel">
        <c.Icon className="size-2.5" strokeWidth={3} aria-hidden />
      </span>
      {c.label}
    </span>
  );
}

export function days(n: number | null | undefined): string {
  const v = typeof n === "number" ? n : 0;
  return `${v} ${v === 1 ? "day" : "days"}`;
}
