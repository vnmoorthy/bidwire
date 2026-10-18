import { AnimatePresence, motion } from "framer-motion";
import { Inbox } from "lucide-react";
import type { Auction, Bid } from "@shared/types";
import { MerchantAvatar } from "@/components/MerchantDot";
import { Money } from "@/components/Money";
import { BribeBadge, PickBadge, VerifyStamp } from "@/components/VerifyStamp";
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

/** rank | merchant (min 200px) | offer (truncates) | delivered | ships | fee | merit | status */
export const BID_COLS =
  "md:grid md:grid-cols-[40px_minmax(200px,1.05fr)_minmax(0,1.5fr)_118px_74px_104px_112px_112px] md:items-center md:gap-4";

export function BidTable({ a, onOpenBid }: { a: Auction; onOpenBid: (bidId: string) => void }) {
  const bids = sortBids(a);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`hidden border-y border-line bg-raised px-5 py-2 text-[12px] font-medium text-muted ${BID_COLS}`}>
        <span>Rank</span>
        <span>Merchant</span>
        <span>Offer</span>
        <span className="text-right">Delivered</span>
        <span className="text-right">Ships</span>
        <span className="text-right">Fee per sale</span>
        <span>Merit</span>
        <span className="text-right">Status</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {bids.length === 0 ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-raised text-muted">
              <Inbox size={22} />
            </div>
            <div className="text-[16px] font-medium text-ink">{a.status === "open" ? "Merchants are pricing this request" : "No merchant bid on this request"}</div>
            {a.status === "open" && <div className="text-[14px] text-muted">Bids appear here the moment they land, then get checked against the real checkout.</div>}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {bids.map((b) => (
              <BidRow key={b.id} a={a} b={b} onClick={() => onOpenBid(b.id)} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function BidRow({ a, b, onClick }: { a: Auction; b: Bid; onClick: () => void }) {
  const merchant = useLive((s) => s.merchants.find((m) => m.id === b.merchant_id));
  const lied = b.verify_status === "mismatch";
  const win = isWinner(a, b);
  const claimed = claimedTotal(b);
  const actual = b.evidence?.actual_total_cents;
  const priceLie = lied && typeof actual === "number" && actual !== claimed;
  const shipLie = lied && !!b.evidence && b.evidence.actual_ship_days !== b.evidence.claimed_ship_days;
  const ranked = b.merit != null && !lied;
  const reason = b.why?.[0];
  const subline = lied
    ? b.evidence?.summary ?? "The claim didn't match the real checkout"
    : ranked && reason
      ? reason
      : b.pitch
        ? `“${b.pitch}”`
        : b.sku;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      onClick={onClick}
      className={`relative flex cursor-pointer flex-col gap-2 border-b border-line px-5 py-2.5 transition-colors last:border-b-0 md:min-h-[60px] ${BID_COLS} ${
        win ? "bg-accent-soft/70 hover:bg-accent-soft" : "hover:bg-raised"
      }`}
    >
      {win && <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
      {/* rank */}
      <div className="hidden md:block">
        {b.rank != null && !lied ? (
          <span className={`tnum text-[18px] font-semibold ${win ? "text-accent" : "text-ink"}`}>{b.rank}</span>
        ) : (
          <span className="text-[16px] text-dim">–</span>
        )}
      </div>
      {/* merchant */}
      <div className="flex min-w-0 items-center gap-3">
        <MerchantAvatar name={b.merchant_name} color={b.merchant_color} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`truncate text-[15px] font-semibold ${lied ? "text-muted" : "text-ink"}`} title={b.merchant_name}>
              {b.merchant_name}
            </span>
            {win && <PickBadge />}
          </div>
          <div className="truncate text-[13px] text-muted">
            {b.merchant_kind === "bot" ? "Bot" : b.merchant_kind === "human" ? "Human" : "Agent"}
            {merchant ? ` · trust ${Math.round(merchant.trust)}` : ""}
          </div>
        </div>
      </div>
      {/* offer */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-[22px] leading-none">{b.product_emoji}</span>
        <div className="min-w-0">
          <div className={`truncate text-[15px] ${lied ? "text-muted" : "text-ink"}`} title={b.product_title}>
            {b.product_title}
          </div>
          <div className={`truncate text-[13px] ${lied ? "text-lie" : "text-muted"}`} title={subline}>
            {subline}
          </div>
        </div>
      </div>
      {/* delivered */}
      <div className="flex items-baseline justify-between gap-2 md:block md:text-right">
        <span className="text-[13px] text-muted md:hidden">Delivered</span>
        <div className="leading-tight">
          <Money cents={claimed} className={`text-[18px] font-semibold ${priceLie ? "text-dim line-through" : "text-ink"}`} />
          {priceLie && <div className="tnum whitespace-nowrap text-[12px] font-semibold text-lie">Checkout {money(actual!)}</div>}
        </div>
      </div>
      {/* ships */}
      <div className="flex items-baseline justify-between md:block md:text-right">
        <span className="text-[13px] text-muted md:hidden">Ships</span>
        <div className="leading-tight">
          <span className={`tnum text-[15px] ${shipLie ? "text-dim line-through" : "text-ink"}`}>{days(b.claimed_ship_days)}</span>
          {shipLie && <div className="tnum text-[12px] text-lie">really {days(b.evidence!.actual_ship_days)}</div>}
        </div>
      </div>
      {/* fee */}
      <div className="flex items-baseline justify-between md:block md:text-right">
        <span className="text-[13px] text-muted md:hidden">Fee per sale</span>
        <div className="flex flex-col items-end gap-1 leading-tight">
          <Money cents={b.fee_cents} className="text-[15px] font-semibold text-fee" />
          {b.bribe_ignored && <BribeBadge />}
        </div>
      </div>
      {/* merit */}
      <div className="flex items-center gap-2.5">
        {ranked ? (
          <>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full ${win ? "bg-accent" : "bg-ink/70"}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(100, b.merit ?? 0))}%` }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            </div>
            <span className="tnum w-7 text-right text-[15px] font-semibold text-ink">{Math.round(b.merit ?? 0)}</span>
          </>
        ) : (
          <span className="text-[13px] text-dim">{lied ? "Excluded" : a.status === "closed" ? "Not ranked" : "At close"}</span>
        )}
      </div>
      {/* status */}
      <div className="flex items-center justify-between md:justify-end">
        <span className="text-[13px] text-muted md:hidden">Status</span>
        <VerifyStamp status={b.verify_status} />
      </div>
    </motion.div>
  );
}
