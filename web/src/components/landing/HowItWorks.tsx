import { Check, Gavel, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Approval, Auction, Bid } from "@shared/types";
import { claimedTotal, money } from "@/lib/format";
import { useLive } from "@/lib/store";
import { AgentBadge, deliveredCents, liedOffers, lotLabel, lotNo, orderedOffers, paddleNo, pickShowcase } from "./data";
import { Container, LiveDot, LogoMark, PaddleChip, Reveal, SectionHeading, SmallCaps, Tool, cx } from "./ui";

const SHEET = "rounded-[6px] border border-line bg-panel";

/* ------------------------------------------------------------------ No. 1: the tool call opens a lot */

function FindVisual({ a, seconds, lot }: { a: Auction | null; seconds: number; lot: number | null }) {
  const need = a?.need ?? "noise cancelling headphones for long flights";
  const short = need.length > 26 ? need.slice(0, 25).trimEnd() + "…" : need;
  const budget = a ? a.budget_cents / 100 : 400;
  const within = a ? a.deliver_within_days : 5;
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className={cx(SHEET, "w-full max-w-[284px] overflow-hidden")}>
        <div className="flex h-9 items-center justify-between gap-2 border-b border-line px-3">
          <AgentBadge client={a?.client ?? "claude"} />
          <SmallCaps className="text-[10px] text-dim">MCP tool call</SmallCaps>
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
      <span className="inline-flex h-8 items-center gap-2 rounded-full bg-board px-3.5 text-board-text">
        <LiveDot color="bg-board-amber" />
        <SmallCaps className="text-[10.5px] text-board-text/90">
          {lot ? lotLabel(lot) : "Lot"} opens · {seconds}s
        </SmallCaps>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ No. 2: paddles go up, claims get checked */

interface VRow {
  id: string;
  name: string;
  merchantId: string;
  color: string;
  claimed: number;
  checkout: number;
  ok: boolean;
}

const FALLBACK_ROWS: VRow[] = [
  { id: "a", name: "Parcel & Pine", merchantId: "m_parcel_pine", color: "#5B8CFF", claimed: 36899, checkout: 36899, ok: true },
  { id: "b", name: "Northwind Electronics", merchantId: "m_northwind", color: "#36E3A0", claimed: 33899, checkout: 33899, ok: true },
  { id: "c", name: "DealDrop Direct", merchantId: "m_dealdrop", color: "#FF4D5E", claimed: 31599, checkout: 34499, ok: false },
];

function verifyRows(a: Auction | null): VRow[] {
  if (!a) return FALLBACK_ROWS;
  const toRow = (b: Bid, ok: boolean): VRow => ({
    id: b.id,
    name: b.merchant_name,
    merchantId: b.merchant_id,
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

const VGRID = "grid grid-cols-[34px_minmax(0,1fr)_58px_62px_16px] items-center gap-x-2";

function VerifyVisual({ a }: { a: Auction | null }) {
  const rows = verifyRows(a);
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className={cx(SHEET, "w-full max-w-[304px] overflow-hidden")}>
        <div className={cx(VGRID, "h-8 border-b border-line bg-raised px-3")}>
          <SmallCaps className="col-span-2 text-[10px] text-muted">Paddle</SmallCaps>
          <SmallCaps className="text-right text-[10px] text-muted">Claimed</SmallCaps>
          <SmallCaps className="text-right text-[10px] text-muted">Checkout</SmallCaps>
          <span />
        </div>
        {rows.map((r) => (
          <div key={r.id} className={cx(VGRID, "h-11 border-b border-line px-3 last:border-b-0")}>
            <PaddleChip n={paddleNo(r.merchantId)} color={r.color} size="sm" />
            <span className="truncate text-[12px] font-semibold text-ink">{r.name}</span>
            <span className={cx("text-right text-[12px] tabular-nums text-muted", !r.ok && "line-through decoration-lie")}>{money(r.claimed)}</span>
            <span className={cx("text-right text-[12px] font-semibold tabular-nums", r.ok ? "text-ink" : "text-lie")}>{money(r.checkout)}</span>
            <span
              className={cx("grid size-4 place-items-center rounded-full", r.ok ? "bg-money-soft text-money" : "bg-lie-soft text-lie")}
              aria-label={r.ok ? "Verified" : "Withdrawn"}
            >
              {r.ok ? <Check className="size-2.5" strokeWidth={3.5} /> : <X className="size-2.5" strokeWidth={3.5} />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ No. 3: sold, within your human's limits */

function BuyVisual({ approval }: { approval: Approval | null }) {
  const ap = approval;
  const reason = ap?.reason ?? "Sennheiser Momentum 4 Wireless from Parcel & Pine";
  const amount = ap?.amount_cents ?? 36899;
  const limit = ap?.limit_cents ?? 30000;
  const code = ap?.code ?? "7019";
  const approved = ap ? ap.status === "approved" : true;
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className={cx(SHEET, "w-full max-w-[292px] p-3")}>
        <div className="flex items-center gap-2 text-[11px]">
          <LogoMark size={16} />
          <span className="font-semibold text-ink">Bidwire</span>
          <span className="text-dim">Text to your human</span>
        </div>
        <p className="mt-2.5 rounded-[14px] rounded-bl-[4px] bg-raised px-3 py-2 text-[11.5px] leading-[17px] text-ink">
          Your agent wants to buy <b className="font-semibold">{reason}</b> for <b className="font-semibold tabular-nums">{money(amount)}</b>{" "}
          (your limit is {money(limit)}). Reply YES {code} to approve.
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={cx("inline-flex items-center gap-1.5 text-[11px] font-semibold", approved ? "text-money" : "text-lie")}>
            {approved ? <Gavel className="size-3" strokeWidth={2.5} /> : <X className="size-3" strokeWidth={3} />}
            {approved ? "Sold · paid from wallet" : "Declined · nothing charged"}
          </span>
          <span className="rounded-[14px] rounded-br-[4px] bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-panel">
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
      <article className="flex h-full flex-col overflow-hidden rounded-[6px] border border-line bg-panel">
        <div className="h-[232px] border-b border-line bg-raised/45">{children}</div>
        <div className="flex flex-1 flex-col p-6">
          <p className="font-serif text-[22px] italic leading-none text-accent">No. {n}</p>
          <h3 className="mt-3 text-[17px] font-semibold leading-6 tracking-[-0.01em] text-ink">{title}</h3>
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
  const total = useLive((s) => s.stats.auctions);
  const showcase = pickShowcase(auctions);
  const seconds = Math.round((config?.auction_ms ?? 12000) / 1000);
  const lot = showcase ? lotNo(showcase, auctions, Math.max(total, auctions.length)) : null;
  // Only show approvals a human has already answered (never a live code).
  const decided = approvals.find((a) => a.status === "approved") ?? approvals.find((a) => a.status === "denied") ?? null;

  return (
    <section id="how" className="scroll-mt-16">
      <Container className="py-24 md:py-32">
        <Reveal>
          <SectionHeading
            eyebrow="How a lot sells"
            title="From need to hammer in one short auction."
            sub="Your agent asks once. Merchants raise paddles for that exact purchase, Bidwire checks every claim against the real checkout, and the best verified offer wins."
          />
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-6 md:mt-16 lg:grid-cols-3">
          <Step
            n={1}
            delay={0}
            title={
              <>
                The agent calls <Tool>find_offers</Tool>
              </>
            }
            body={`One MCP call with the need, a budget and a deadline puts a lot on the block: a ${seconds}-second live auction for that exact purchase. No browsing, no sponsored results.`}
          >
            <FindVisual a={showcase} seconds={seconds} lot={lot} />
          </Step>
          <Step
            n={2}
            delay={0.06}
            title="Paddles go up. Every claim is checked."
            body="Merchants bid a delivered price, delivery time and specs. Bidwire checks each claim against the merchant's own product page and checkout, and withdraws any bid that misrepresents."
          >
            <VerifyVisual a={showcase} />
          </Step>
          <Step
            n={3}
            delay={0.12}
            title="Sold, within your human's limits."
            body={
              <>
                The best verified offer takes the hammer. <Tool>buy_offer</Tool> pays from a prepaid wallet, and anything over the limit is
                texted to a human for a yes first.
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
