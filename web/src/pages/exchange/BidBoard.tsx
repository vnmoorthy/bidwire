import { AnimatePresence, motion } from "framer-motion";
import { Inbox } from "lucide-react";
import type { Auction, Bid } from "@shared/types";
import { PaddleChip } from "@/components/MerchantDot";
import { Money } from "@/components/Money";
import { PickBadge, VerifyStamp } from "@/components/VerifyStamp";
import { claimedTotal, days, money } from "@/lib/format";
import { useLive } from "@/lib/store";

export function sortBids(a: Auction): Bid[] {
  const ranked = a.status === "closed" || (a.bids ?? []).some((b) => b.rank != null);
  return [...(a.bids ?? [])].sort((x, y) => {
    const lx = x.verify_status === "mismatch" ? 1 : 0;
    const ly = y.verify_status === "mismatch" ? 1 : 0;
    if (lx !== ly) return lx - ly;
    if (ranked) {
      const rx = x.rank ?? 9999;
      const ry = y.rank ?? 9999;
      if (rx !== ry) return rx - ry;
      if ((y.merit ?? -1) !== (x.merit ?? -1)) return (y.merit ?? -1) - (x.merit ?? -1);
    }
    return y.created_at - x.created_at;
  });
}

export function isWinner(a: Auction, b: Bid) {
  if (b.verify_status === "mismatch") return false;
  if (a.winner_bid_id) return a.winner_bid_id === b.id;
  return a.status === "closed" && b.rank === 1;
}

/** No. | paddle + merchant (min 220px) | lot item (truncates) | delivered | arrives | commission | status */
export const PADDLE_COLS =
  "md:grid md:grid-cols-[52px_minmax(220px,1fr)_minmax(0,1.35fr)_118px_80px_100px_minmax(140px,auto)] md:items-center md:gap-4";

/** The paddle list: catalogue-style rows on paper with hairline rules. */
export function PaddleList({ a, onOpenBid }: { a: Auction; onOpenBid: (bidId: string) => void }) {
  const bids = sortBids(a);
  return (
    <section className="card flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={`hidden border-b border-line bg-raised px-5 py-2 smallcaps ${PADDLE_COLS}`}>
        <span>No.</span>
        <span>Paddle</span>
        <span>Lot item</span>
        <span className="text-right">Delivered</span>
        <span className="text-right">Arrives</span>
        <span className="text-right">Commission</span>
        <span className="text-right">Status</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {bids.length === 0 ? (
          <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-raised text-muted">
              <Inbox size={22} />
            </div>
            <div className="serif text-[22px] italic text-ink">{a.status === "open" ? "Waiting for the first paddle…" : "No paddles were raised for this lot."}</div>
            {a.status === "open" && <div className="text-[14px] text-muted">Every bid is checked against the merchant's real checkout before it counts.</div>}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {bids.map((b) => (
              <PaddleRow key={b.id} a={a} b={b} onClick={() => onOpenBid(b.id)} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}

function PaddleRow({ a, b, onClick }: { a: Auction; b: Bid; onClick: () => void }) {
  const merchant = useLive((s) => s.merchants.find((m) => m.id === b.merchant_id));
  const lied = b.verify_status === "mismatch";
  const win = isWinner(a, b);
  const claimed = claimedTotal(b);
  const actual = b.evidence?.actual_total_cents;
  const priceLie = lied && typeof actual === "number" && actual !== claimed;
  const shipLie = lied && !!b.evidence && b.evidence.actual_ship_days !== b.evidence.claimed_ship_days;
  const ranked = b.merit != null && !lied;
  let subline: string = b.sku;
  let subCls = "text-muted";
  if (lied) {
    subline = b.evidence?.summary ?? "The claim didn't match the merchant's real checkout";
    subCls = "text-lie";
  } else if (b.bribe_ignored) {
    subline = `Bribe ignored · offered ${money(b.fee_cents)} commission · still No. ${b.rank ?? "—"}`;
    subCls = "text-fee font-medium";
  } else if (ranked) {
    subline = `Merit ${Math.round(b.merit ?? 0)}${b.why?.[0] ? ` · ${b.why[0]}` : ""}`;
  } else if (b.pitch) {
    subline = `“${b.pitch}”`;
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      onClick={onClick}
      className={`relative flex cursor-pointer flex-col gap-2 border-b border-line px-5 py-2.5 transition-colors last:border-b-0 md:min-h-[62px] ${PADDLE_COLS} ${
        win ? "bg-accent-soft/50 hover:bg-accent-soft/80" : "hover:bg-raised/60"
      }`}
    >
      {win && <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
      {/* rank */}
      <div className="hidden md:block">
        {b.rank != null && !lied ? (
          <span className={`serif tnum text-[26px] leading-none ${win ? "text-[#7d5f30]" : "text-ink"}`}>{b.rank}</span>
        ) : (
          <span className="serif text-[22px] leading-none text-dim">–</span>
        )}
      </div>
      {/* paddle + merchant */}
      <div className="flex min-w-0 items-center gap-3">
        <motion.span initial={{ rotate: 0, y: 0 }} animate={{ rotate: [0, -2, 0], y: [0, -2, 0] }} transition={{ duration: 0.3, ease: "easeOut" }}>
          <PaddleChip id={b.merchant_id} color={b.merchant_color} />
        </motion.span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`truncate text-[15px] font-semibold ${lied ? "text-muted" : "text-ink"}`} title={b.merchant_name}>
              {b.merchant_name}
            </span>
            {win && <PickBadge />}
          </div>
          <div className="truncate text-[13px] text-muted">
            {b.merchant_kind === "bot" ? "Bot" : b.merchant_kind === "human" ? "In the room" : "Merchant agent"}
            {merchant ? ` · standing ${Math.round(merchant.trust)}` : ""}
          </div>
        </div>
      </div>
      {/* lot item */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-[20px] leading-none">{b.product_emoji}</span>
        <div className="min-w-0">
          <div className={`truncate text-[15px] ${lied ? "text-dim" : "text-muted"}`} title={b.product_title}>
            {b.product_title}
          </div>
          <div className={`truncate text-[13px] ${subCls}`} title={subline}>
            {subline}
          </div>
        </div>
      </div>
      {/* delivered */}
      <div className="flex items-baseline justify-between gap-2 md:block md:text-right">
        <span className="text-[13px] text-muted md:hidden">Delivered</span>
        <div className="leading-tight">
          <Money cents={claimed} className={`serif text-[22px] ${priceLie ? "text-dim line-through decoration-lie" : win ? "text-[#7d5f30]" : "text-ink"}`} />
          {priceLie && <div className="tnum whitespace-nowrap text-[12px] font-semibold text-lie">Checkout {money(actual!)}</div>}
        </div>
      </div>
      {/* arrives */}
      <div className="flex items-baseline justify-between md:block md:text-right">
        <span className="text-[13px] text-muted md:hidden">Arrives</span>
        <div className="leading-tight">
          <span className={`tnum text-[15px] ${shipLie ? "text-dim line-through" : "text-ink"}`}>{days(b.claimed_ship_days)}</span>
          {shipLie && <div className="tnum text-[12px] text-lie">really {days(b.evidence!.actual_ship_days)}</div>}
        </div>
      </div>
      {/* commission */}
      <div className="flex items-baseline justify-between md:block md:text-right">
        <span className="text-[13px] text-muted md:hidden">Commission</span>
        <Money cents={b.fee_cents} className="text-[14px] font-medium text-fee" />
      </div>
      {/* status */}
      <div className="flex items-center justify-between md:justify-end">
        <span className="text-[13px] text-muted md:hidden">Status</span>
        <VerifyStamp status={b.verify_status} lieLabel="Withdrawn: misrepresentation" />
      </div>
    </motion.div>
  );
}
