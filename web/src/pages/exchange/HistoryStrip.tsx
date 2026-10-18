import type { Auction } from "@shared/types";
import { useLive, useNow } from "@/lib/store";
import { ago, claimedTotal, lotLabel, lotNumber, money } from "@/lib/format";

/** Lot catalogue: previous auctions as small catalogue entries. */
export function HistoryStrip({ auctions, onOpen }: { auctions: Auction[]; onOpen: (id: string) => void }) {
  const now = useNow(5000);
  const all = useLive((s) => s.auctions);
  const total = useLive((s) => s.stats.auctions);
  if (auctions.length === 0) return null;
  return (
    <section className="min-w-0 shrink-0">
      <div className="mb-2 flex items-baseline gap-2 px-0.5">
        <h3 className="serif text-[22px] leading-7">Lot catalogue</h3>
        <span className="text-[13px] text-muted">Earlier lots · click for the full ranking and evidence</span>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-0.5">
        {auctions.map((a) => {
          const winner = a.bids.find((b) => b.id === a.winner_bid_id) ?? a.bids.find((b) => b.rank === 1 && b.verify_status !== "mismatch");
          const lies = a.bids.filter((b) => b.verify_status === "mismatch").length;
          return (
            <button key={a.id} onClick={() => onOpen(a.id)} className="card w-[250px] shrink-0 px-4 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-[#fffaf0]">
              <div className="flex items-center gap-2">
                <span className="smallcaps text-[#9c7d4b]">{lotLabel(lotNumber(all, total, a.id))}</span>
                <span className="ml-auto text-[12px] text-dim">{ago(a.opened_at, now)}</span>
              </div>
              <div className="serif mt-0.5 truncate text-[19px] italic leading-6 text-ink">{a.need}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
                {a.status !== "closed" ? (
                  <span className="text-[#7d5f30]">{a.status === "open" ? "Bidding…" : "Checking claims…"}</span>
                ) : winner ? (
                  <span className="truncate">
                    Hammer <span className="tnum font-semibold text-ink">{money(claimedTotal(winner))}</span> · {winner.merchant_name}
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
