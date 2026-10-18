import type { Auction } from "@shared/types";
import { useLive, useNow } from "@/lib/store";
import { ago, claimedTotal, lotLabel, lotNumber, money } from "@/lib/format";
import { lotState } from "@/lib/lot";

/** Lot catalogue: the other lots as catalogue entries. Lots still running show a live countdown and best price. */
export function HistoryStrip({ auctions, onOpen }: { auctions: Auction[]; onOpen: (id: string) => void }) {
  const now = useNow(1000);
  const all = useLive((s) => s.auctions);
  const total = useLive((s) => s.stats.auctions);
  const orders = useLive((s) => s.orders);
  const approvals = useLive((s) => s.approvals);
  if (auctions.length === 0) return null;
  const live = auctions.filter((a) => a.status !== "closed").length;
  return (
    <section className="min-w-0 shrink-0">
      <div className="mb-2 flex items-baseline gap-2 px-0.5">
        <h3 className="serif text-[22px] leading-7">Lot catalogue</h3>
        <span className="text-[13px] text-muted">
          {live > 0 ? `${live} more lot${live === 1 ? "" : "s"} live now · ` : ""}click a lot for the full ranking and evidence
        </span>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-0.5">
        {auctions.map((a) => {
          const lot = lotState(a, orders, approvals);
          const lies = a.bids.filter((b) => b.verify_status === "mismatch").length;
          const running = a.status !== "closed" && !lot.sold;
          const secs = Math.max(0, Math.ceil((a.closes_at - now) / 1000));
          return (
            <button
              key={a.id}
              onClick={() => onOpen(a.id)}
              className={`card w-[250px] shrink-0 px-4 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-[#fffaf0] ${running ? "border-accent" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="smallcaps text-[#9c7d4b]">{lotLabel(lotNumber(all, total, a.id))}</span>
                {running ? (
                  <span className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold text-[#7d5f30]">
                    <span className="size-1.5 rounded-full bg-accent animate-pulse-dot" />
                    {a.status === "open" ? `Live · ${secs}s` : "Checking claims"}
                  </span>
                ) : (
                  <span className="ml-auto text-[12px] text-dim">{ago(a.opened_at, now)}</span>
                )}
              </div>
              <div className="serif mt-0.5 truncate text-[19px] italic leading-6 text-ink">{a.need}</div>
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
                {lot.sold ? (
                  <span className="truncate">
                    <span className="font-semibold text-money">Sold</span>{" "}
                    <span className="tnum font-semibold text-ink">{money(lot.order?.amount_cents ?? (lot.soldBid ? claimedTotal(lot.soldBid) : 0))}</span> ·{" "}
                    {lot.order?.merchant_name ?? lot.soldBid?.merchant_name}
                  </span>
                ) : running ? (
                  <span className="truncate">
                    {lot.best ? (
                      <>
                        Best <span className="tnum font-semibold text-ink">{money(claimedTotal(lot.best))}</span> · {lot.best.merchant_name}
                      </>
                    ) : (
                      "Awaiting verified paddles…"
                    )}
                  </span>
                ) : lot.hammer ? (
                  <span className="truncate">
                    Hammer <span className="tnum font-semibold text-ink">{money(claimedTotal(lot.hammer))}</span> · {lot.hammer.merchant_name}
                    <span className="text-dim"> · {lot.approval?.status === "pending" ? "on the phone" : lot.approval?.status === "denied" ? "declined" : "not bought"}</span>
                  </span>
                ) : (
                  <span>Passed · no eligible offer</span>
                )}
              </div>
              <div className="tnum mt-0.5 text-[12px] text-dim">
                {a.bids.length} paddles{lies > 0 && <span className="text-lie"> · {lies} withdrawn</span>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
