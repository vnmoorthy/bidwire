import { useState } from "react";
import { CalendarClock, LoaderCircle, ShoppingCart, Wallet } from "lucide-react";
import type { Auction } from "@shared/types";
import { ClientBadge } from "@/components/ClientBadge";
import { CountdownRing } from "@/components/CountdownRing";
import { Money } from "@/components/Money";
import { api, errMsg } from "@/lib/api";
import { toast, toastError } from "@/lib/fx";
import { ago, claimedTotal, days, money, titleCase } from "@/lib/format";
import { useLive, useNow } from "@/lib/store";
import { useMedia } from "@/lib/useMedia";
import { BidTable, isWinner } from "./BidBoard";

function StatusBadge({ status }: { status: Auction["status"] }) {
  if (status === "open")
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-[12.5px] font-semibold text-accent">
        <span className="size-1.5 rounded-full bg-accent animate-pulse-dot" />
        Live · bidding
      </span>
    );
  if (status === "verifying")
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-raised px-2.5 text-[12.5px] font-semibold text-muted">
        <LoaderCircle size={12} className="animate-spin" />
        Verifying offers
      </span>
    );
  return <span className="inline-flex h-6 items-center rounded-full bg-money-soft px-2.5 text-[12.5px] font-semibold text-money">Closed</span>;
}

/** The current-auction card: need as H1, meta row, countdown, then the bid table. */
export function AuctionCard({ a, onOpenBid }: { a: Auction; onOpenBid: (bidId: string) => void }) {
  const now = useNow(1000);
  const wide = useMedia("(min-width: 768px)");
  const bids = a.bids ?? [];
  const verified = bids.filter((b) => b.verify_status === "verified").length;
  const lies = bids.filter((b) => b.verify_status === "mismatch").length;
  return (
    <section className="card flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="px-5 pb-4 pt-4">
        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <StatusBadge status={a.status} />
              <span className="text-[13px] text-muted">
                Current auction · opened {ago(a.opened_at, now)}
              </span>
              <span className="hidden font-mono text-[12px] text-dim lg:inline">{a.id}</span>
            </div>
            <h1 className="mt-2 line-clamp-2 text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink md:text-[34px] 2xl:text-[38px]" title={a.need}>
              “{a.need}”
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-muted">
              <span className="flex min-w-0 items-center gap-2">
                <ClientBadge client={a.client} size="lg" />
                <span className="truncate font-medium text-ink">{a.buyer_name}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Wallet size={15} />
                Budget <Money cents={a.budget_cents} smart className="font-semibold text-ink" />
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarClock size={15} />
                {a.deliver_within_days ? (
                  <>
                    Within <span className="font-semibold text-ink">{days(a.deliver_within_days)}</span>
                  </>
                ) : (
                  "Any delivery time"
                )}
              </span>
              {a.category && <span className="text-[14px]">{titleCase(a.category)}</span>}
              {a.must_have?.map((m) => (
                <span key={m} className="inline-flex h-6 items-center rounded-full bg-raised px-2.5 text-[13px] font-medium text-ink">
                  {m}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3">
            <CountdownRing openedAt={a.opened_at} closesAt={a.closes_at} status={a.status} size={wide ? 64 : 48} stroke={3} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
          <span>
            <span className="tnum font-semibold text-ink">{bids.length}</span> bids
          </span>
          <span>
            <span className="tnum font-semibold text-money">{verified}</span> verified
          </span>
          <span>
            <span className="tnum font-semibold text-lie">{lies}</span> caught lying
          </span>
          <span className="hidden sm:inline">Ranked on merit. Fees only break ties.</span>
          <BuyWinner a={a} />
        </div>
      </div>
      <BidTable a={a} onOpenBid={onOpenBid} />
    </section>
  );
}

/** Lets the presenter buy the #1 pick for the auction's agent when the agent didn't auto-buy (e.g. the room auction). */
function BuyWinner({ a }: { a: Auction }) {
  const orders = useLive((s) => s.orders);
  const approvals = useLive((s) => s.approvals);
  const [busy, setBusy] = useState(false);
  if (a.status !== "closed") return null;
  const winner = a.bids.find((b) => isWinner(a, b));
  if (!winner) return null;
  if (orders.some((o) => o.auction_id === a.id)) return null;
  if (approvals.some((p) => p.auction_id === a.id && (p.status === "pending" || p.status === "denied"))) return null;

  const buy = async () => {
    setBusy(true);
    try {
      const r = await api.runTool("buy_offer", {
        args: { offer_id: winner.id, idempotency_key: `exchange-${a.id}`, wait_for_approval_seconds: 0 },
        buyer_id: a.buyer_id,
      });
      if (!r.ok) toastError("Purchase didn't go through", r.text?.slice(0, 200));
      else if (!/order|purchas|approval/i.test(r.text ?? "")) toast({ kind: "info", title: "buy_offer", body: r.text?.slice(0, 200) });
    } catch (e) {
      toastError("Couldn't buy the #1 pick", errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={buy} disabled={busy} className="btn btn-primary ml-auto" title={`Calls buy_offer as ${a.buyer_name}`}>
      {busy ? <LoaderCircle size={15} className="animate-spin" /> : <ShoppingCart size={15} />}
      Buy #1 pick for {money(claimedTotal(winner))}
    </button>
  );
}
