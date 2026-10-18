import type { Auction } from "@shared/types";
import { ClientBadge } from "@/components/ClientBadge";
import { MerchantAvatar } from "@/components/MerchantDot";
import { useNow } from "@/lib/store";
import { ago, claimedTotal, money } from "@/lib/format";

export function HistoryStrip({ auctions, onOpen }: { auctions: Auction[]; onOpen: (id: string) => void }) {
  const now = useNow(5000);
  if (auctions.length === 0) return null;
  return (
    <section className="min-w-0 shrink-0">
      <div className="mb-2 flex items-baseline gap-2 px-0.5">
        <h3 className="card-title">Previous auctions</h3>
        <span className="text-[13px] text-muted">Click for the full ranking and evidence</span>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-0.5">
        {auctions.map((a) => {
          const winner = a.bids.find((b) => b.id === a.winner_bid_id) ?? a.bids.find((b) => b.rank === 1 && b.verify_status !== "mismatch");
          const lies = a.bids.filter((b) => b.verify_status === "mismatch").length;
          return (
            <button key={a.id} onClick={() => onOpen(a.id)} className="card w-[260px] shrink-0 px-4 py-3 text-left transition-colors hover:border-line-strong">
              <div className="flex items-center gap-2">
                <ClientBadge client={a.client} size="sm" />
                <span className="ml-auto shrink-0 text-[12px] text-dim">{ago(a.opened_at, now)}</span>
              </div>
              <div className="mt-1.5 truncate text-[14px] font-medium text-ink">{a.need}</div>
              <div className="mt-1.5 flex items-center gap-2 text-[13px]">
                {a.status !== "closed" ? (
                  <span className="text-accent">{a.status === "open" ? "Bidding…" : "Verifying…"}</span>
                ) : winner ? (
                  <>
                    <MerchantAvatar name={winner.merchant_name} color={winner.merchant_color} size={20} />
                    <span className="truncate text-muted">{winner.merchant_name}</span>
                    <span className="tnum ml-auto font-semibold text-ink">{money(claimedTotal(winner))}</span>
                  </>
                ) : (
                  <span className="text-muted">No eligible offer</span>
                )}
              </div>
              <div className="tnum mt-1 flex items-center gap-3 text-[12px] text-dim">
                <span>{a.bids.length} bids</span>
                {lies > 0 && <span className="text-lie">{lies} caught lying</span>}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
