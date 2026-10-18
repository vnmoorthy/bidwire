import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Approval, Auction, Bid } from "@shared/types";
import { claimedTotal, money } from "@/lib/format";
import { useLive } from "@/lib/store";
import { AgentBadge, deliveredCents, liedOffers, orderedOffers, pickShowcase } from "./data";
import { Container, LiveDot, LogoMark, MerchantAvatar, Reveal, SectionHeading, Tool, cx } from "./ui";

/* ------------------------------------------------------------------ step 1: the tool call */

function FindVisual({ a, seconds }: { a: Auction | null; seconds: number }) {
  const need = a?.need ?? "noise cancelling headphones for long flights";
  const short = need.length > 26 ? need.slice(0, 25).trimEnd() + "…" : need;
  const budget = a ? a.budget_cents / 100 : 400;
  const within = a ? a.deliver_within_days : 5;
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-[280px] overflow-hidden rounded-[10px] border border-line bg-panel shadow-[0_1px_2px_rgba(14,14,16,0.04),0_8px_24px_-12px_rgba(14,14,16,0.10)]">
        <div className="flex h-9 items-center justify-between gap-2 border-b border-line px-3">
          <AgentBadge client={a?.client ?? "claude"} />
          <span className="text-[11px] font-medium text-dim">MCP tool call</span>
        </div>
        <pre className="overflow-hidden px-3 py-3 font-mono text-[11.5px] leading-[18px] text-ink">
          <span className="font-semibold">find_offers</span>
          {"({\n  "}
          <span className="text-agent">need</span>
          {": "}
          <span className="text-money">"{short}"</span>
          {",\n  "}
          <span className="text-agent">budget_usd</span>
          {": "}
          <span className="text-fee">{budget}</span>
          {within != null ? (
            <>
              {",\n  "}
              <span className="text-agent">deliver_within_days</span>
              {": "}
              <span className="text-fee">{within}</span>
            </>
          ) : null}
          {"\n})"}
        </pre>
      </div>
      <span aria-hidden className="h-5 w-px bg-line-strong" />
      <span className="inline-flex h-7 items-center gap-2 rounded-full border border-line bg-panel px-3 text-[12px] font-medium text-ink shadow-[0_1px_2px_rgba(14,14,16,0.04)]">
        <LiveDot />
        Auction open for {seconds}s
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ step 2: verification */

interface VRow {
  id: string;
  name: string;
  color: string;
  claimed: number;
  checkout: number;
  ok: boolean;
}

const FALLBACK_ROWS: VRow[] = [
  { id: "a", name: "Parcel & Pine", color: "#5B8CFF", claimed: 36899, checkout: 36899, ok: true },
  { id: "b", name: "Northwind Electronics", color: "#36E3A0", claimed: 33899, checkout: 33899, ok: true },
  { id: "c", name: "DealDrop Direct", color: "#FF4D5E", claimed: 31599, checkout: 34499, ok: false },
];

function verifyRows(a: Auction | null): VRow[] {
  if (!a) return FALLBACK_ROWS;
  const toRow = (b: Bid, ok: boolean): VRow => ({
    id: b.id,
    name: b.merchant_name,
    color: b.merchant_color,
    claimed: claimedTotal(b),
    checkout: ok ? deliveredCents(b) : (b.evidence?.actual_total_cents ?? claimedTotal(b)),
    ok,
  });
  const priceLie = liedOffers(a).find((b) => b.evidence && b.evidence.actual_total_cents > b.evidence.claimed_total_cents);
  const ok = orderedOffers(a).filter((b) => b.verify_status === "verified");
  const rows = [...ok.slice(0, priceLie ? 2 : 3).map((b) => toRow(b, true)), ...(priceLie ? [toRow(priceLie, false)] : [])];
  return rows.length >= 2 ? rows : FALLBACK_ROWS;
}

function VerifyVisual({ a }: { a: Auction | null }) {
  const rows = verifyRows(a);
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-[300px] overflow-hidden rounded-[10px] border border-line bg-panel shadow-[0_1px_2px_rgba(14,14,16,0.04),0_8px_24px_-12px_rgba(14,14,16,0.10)]">
        <div className="grid h-8 grid-cols-[minmax(0,1fr)_60px_64px_16px] items-center gap-x-2 border-b border-line bg-raised px-3 text-[11px] font-semibold text-muted">
          <span>Bid</span>
          <span className="text-right">Claimed</span>
          <span className="text-right">Checkout</span>
          <span />
        </div>
        {rows.map((r) => (
          <div
            key={r.id}
            className={cx(
              "grid h-11 grid-cols-[minmax(0,1fr)_60px_64px_16px] items-center gap-x-2 border-b border-line px-3 last:border-b-0",
              !r.ok && "bg-[#FFFCFC]",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <MerchantAvatar name={r.name} color={r.color} size={20} />
              <span className="truncate text-[12px] font-semibold text-ink">{r.name}</span>
            </span>
            <span className={cx("text-right text-[12px] tabular-nums", r.ok ? "text-muted" : "text-muted line-through decoration-lie")}>
              {money(r.claimed)}
            </span>
            <span className={cx("text-right text-[12px] font-semibold tabular-nums", r.ok ? "text-ink" : "text-lie")}>{money(r.checkout)}</span>
            <span
              className={cx("grid size-4 place-items-center rounded-full", r.ok ? "bg-money-soft text-money" : "bg-lie-soft text-lie")}
              aria-label={r.ok ? "Verified" : "Lied"}
            >
              {r.ok ? <Check className="size-2.5" strokeWidth={3.5} /> : <X className="size-2.5" strokeWidth={3.5} />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ step 3: buying within limits */

function BuyVisual({ approval }: { approval: Approval | null }) {
  const ap = approval;
  const reason = ap?.reason ?? "Sennheiser Momentum 4 Wireless from Parcel & Pine";
  const amount = ap?.amount_cents ?? 36899;
  const limit = ap?.limit_cents ?? 30000;
  const code = ap?.code ?? "7019";
  const approved = ap ? ap.status === "approved" : true;
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="w-full max-w-[288px] rounded-[12px] border border-line bg-panel p-3 shadow-[0_1px_2px_rgba(14,14,16,0.04),0_8px_24px_-12px_rgba(14,14,16,0.10)]">
        <div className="flex items-center gap-2 text-[11px]">
          <LogoMark size={16} />
          <span className="font-semibold text-ink">Bidwire</span>
          <span className="text-dim">Text to your human</span>
        </div>
        <p className="mt-2.5 rounded-[14px] rounded-bl-[6px] bg-raised px-3 py-2 text-[11.5px] leading-[17px] text-ink">
          Your agent wants to buy <b className="font-semibold">{reason}</b> for <b className="font-semibold tabular-nums">{money(amount)}</b>{" "}
          (your limit is {money(limit)}). Reply YES {code} to approve.
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={cx("inline-flex items-center gap-1 text-[11px] font-semibold", approved ? "text-money" : "text-lie")}>
            {approved ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
            {approved ? "Approved · paid from wallet" : "Declined · nothing charged"}
          </span>
          <span className="rounded-[14px] rounded-br-[6px] bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-white">
            {approved ? "YES" : "NO"} {code}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ section */

function Step({ n, title, body, children, delay }: { n: number; title: ReactNode; body: ReactNode; children: ReactNode; delay: number }) {
  return (
    <Reveal delay={delay} className="h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-[14px] border border-line bg-panel shadow-[0_1px_2px_rgba(14,14,16,0.04),0_1px_0_rgba(14,14,16,0.02)]">
        <div className="h-[232px] border-b border-line bg-[#FBFBF9]">{children}</div>
        <div className="flex flex-1 flex-col p-6">
          <p className="text-[13px] font-semibold tabular-nums text-dim">Step {n}</p>
          <h3 className="mt-2 text-[17px] font-semibold leading-6 tracking-[-0.01em] text-ink">{title}</h3>
          <p className="mt-2 text-[14.5px] leading-6 text-muted">{body}</p>
        </div>
      </article>
    </Reveal>
  );
}

export function HowItWorks() {
  const auctions = useLive((s) => s.auctions);
  const approvals = useLive((s) => s.approvals);
  const config = useLive((s) => s.config);
  const showcase = pickShowcase(auctions);
  const seconds = Math.round((config?.auction_ms ?? 12000) / 1000);
  // Only show approvals a human has already answered (never a live code).
  const decided = approvals.find((a) => a.status === "approved") ?? approvals.find((a) => a.status === "denied") ?? null;

  return (
    <section id="how" className="scroll-mt-16">
      <Container className="py-24 md:py-32">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="One auction per purchase. Every claim checked."
            sub="Your agent asks once. Merchants compete for that exact purchase, Bidwire verifies every offer against the real checkout, and your agent buys the best one."
          />
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-6 md:mt-16 lg:grid-cols-3">
          <Step
            n={1}
            delay={0}
            title={
              <>
                Your agent calls <Tool>find_offers</Tool>
              </>
            }
            body={`One MCP call with the need, a budget and a deadline opens a ${seconds}-second live auction for that exact purchase. No browsing, no sponsored results.`}
          >
            <FindVisual a={showcase} seconds={seconds} />
          </Step>
          <Step
            n={2}
            delay={0.06}
            title="Merchants bid. Bidwire checks every claim."
            body="Each bid's delivered price, shipping time and specs are checked against the merchant's own product page and checkout. Hidden fees and stretched specs get the bid excluded."
          >
            <VerifyVisual a={showcase} />
          </Step>
          <Step
            n={3}
            delay={0.12}
            title="Your agent buys the best offer, within your limits."
            body={
              <>
                Offers come back ranked with reasons. <Tool>buy_offer</Tool> pays from a prepaid wallet, and anything over your limit
                texts you for a yes first.
              </>
            }
          >
            <BuyVisual approval={decided} />
          </Step>
        </div>
      </Container>
    </section>
  );
}
