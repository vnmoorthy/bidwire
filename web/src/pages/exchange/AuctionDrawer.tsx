import { useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, ExternalLink } from "lucide-react";
import type { Auction, Bid } from "@shared/types";
import { Drawer } from "@/components/Drawer";
import { ClientBadge } from "@/components/ClientBadge";
import { KindBadge } from "@/components/KindBadge";
import { PaddleChip } from "@/components/MerchantDot";
import { Money } from "@/components/Money";
import { BribeBadge, PickBadge, VerifyStamp } from "@/components/VerifyStamp";
import { api, errMsg } from "@/lib/api";
import { useLive } from "@/lib/store";
import { claimedTotal, clock, days, money } from "@/lib/format";
import { isWinner, sortBids } from "./BidBoard";

export function AuctionDrawer({ auctionId, focusBidId, onClose }: { auctionId: string | null; focusBidId?: string | null; onClose: () => void }) {
  const live = useLive((s) => (auctionId ? s.auctions.find((a) => a.id === auctionId) : undefined));
  const [fetched, setFetched] = useState<Auction | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFetched(null);
    setErr(null);
    if (!auctionId) return;
    let alive = true;
    api
      .auction(auctionId)
      .then((a) => alive && setFetched(a))
      .catch((e) => alive && setErr(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [auctionId]);

  // Prefer the live (SSE) copy, but fill in any evidence the fetched copy has.
  const a: Auction | null = live
    ? {
        ...live,
        bids: live.bids.map((b) => {
          const f = fetched?.bids.find((x) => x.id === b.id);
          return f && !b.evidence ? { ...b, evidence: f.evidence } : b;
        }),
      }
    : fetched;

  useEffect(() => {
    if (!focusBidId || !a) return;
    const t = window.setTimeout(() => {
      document.getElementById(`bid-${focusBidId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
    return () => window.clearTimeout(t);
  }, [focusBidId, !!a]); // eslint-disable-line react-hooks/exhaustive-deps

  const bids = a ? sortBids(a) : [];
  return (
    <Drawer
      open={!!auctionId}
      onClose={onClose}
      width={780}
      title={a ? <h2 className="serif text-[30px] italic leading-9">“{a.need}”</h2> : "Lot"}
      subtitle={
        a ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-2">
              <ClientBadge client={a.client} /> <span className="text-ink">{a.buyer_name}</span>
            </span>
            <span>
              budget <Money cents={a.budget_cents} className="text-ink" />
            </span>
            <span>Deliver within {days(a.deliver_within_days)}</span>
            <span className="font-mono text-dim">{a.id}</span>
            <span className="capitalize">{a.status}</span>
          </div>
        ) : null
      }
    >
      <div ref={scroller}>
        {!a && !err && <div className="shimmer h-40 rounded-[6px]" />}
        {err && !a && <div className="rounded-[6px] border border-lie/40 bg-lie/10 p-4 text-sm text-lie">{err}</div>}
        {a && (
          <>
            {a.must_have.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {a.must_have.map((m) => (
                  <span key={m} className="inline-flex h-6 items-center rounded-full bg-raised px-2.5 text-[13px] font-medium text-ink">
                    {m}
                  </span>
                ))}
              </div>
            )}
            <div className="mb-3 card-title">
              Full ranking <span className="font-normal text-muted">· {bids.length} paddles</span>
            </div>
            <div className="flex flex-col gap-3">
              {bids.map((b) => (
                <BidEvidence key={b.id} a={a} b={b} focus={b.id === focusBidId} />
              ))}
              {bids.length === 0 && <div className="text-muted">No bids were placed.</div>}
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

function BidEvidence({ a, b, focus }: { a: Auction; b: Bid; focus: boolean }) {
  const lied = b.verify_status === "mismatch";
  const win = isWinner(a, b);
  const e = b.evidence;
  return (
    <div
      id={`bid-${b.id}`}
      className={`scroll-mt-4 rounded-[6px] border p-4 ${
        win ? "border-[#f8c9b5] bg-accent-soft/60" : lied ? "border-[#f3c4c6] bg-lie-soft/50" : "border-line bg-panel"
      } ${focus ? "ring-[3px] ring-[rgba(242,86,29,0.25)]" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="tnum w-8 shrink-0 pt-0.5 text-center text-[20px] font-semibold">
          {lied ? <span className="text-lie">✗</span> : b.rank != null ? <span className={`serif ${win ? "text-[#7d5f30]" : "text-ink"}`}>{b.rank}</span> : <span className="text-dim">–</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PaddleChip id={b.merchant_id} color={b.merchant_color} />
            <span className="text-[16px] font-semibold">{b.merchant_name}</span>
            <KindBadge kind={b.merchant_kind} />
            {win && <PickBadge />}
            {b.bribe_ignored && <BribeBadge />}
            <span className="ml-auto">
              <VerifyStamp status={b.verify_status} size="sm" />
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[15px] text-ink">
            <span className="text-xl">{b.product_emoji}</span> {b.product_title}
            <span className="font-mono text-[12px] text-dim">{b.sku}</span>
          </div>
          {b.pitch && <div className="mt-1 text-[13px] italic text-muted">“{b.pitch}”</div>}

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Kv label="Claimed total" value={<Money cents={claimedTotal(b)} className={lied && e && e.actual_total_cents !== e.claimed_total_cents ? "text-dim line-through" : ""} />} />
            <Kv label="Checkout total" value={e ? <Money cents={e.actual_total_cents} className={lied && e.actual_total_cents !== e.claimed_total_cents ? "text-lie" : "text-money"} /> : <span className="text-dim">pending</span>} />
            <Kv label="Ships in" value={<span className="tnum">{days(b.claimed_ship_days)}{e && e.actual_ship_days !== e.claimed_ship_days ? <span className="text-lie"> → {days(e.actual_ship_days)}</span> : null}</span>} />
            <Kv label="Commission" value={<Money cents={b.fee_cents} className="text-fee" />} />
            <Kv label="Merit" value={<span className="tnum">{b.merit != null ? Math.round(b.merit) : "–"}<span className="text-dim">/100</span></span>} />
          </div>

          {b.bribe_ignored && (
            <div className="mt-3 rounded-[6px] bg-fee-soft px-3 py-2 text-[13px] text-fee">
              Bribe ignored: offered {money(b.fee_cents)} commission and still No. {b.rank ?? "—"}. Commission only breaks exact ties.
            </div>
          )}

          {b.why.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-[13px] font-semibold text-ink">Why this rank</div>
              <ul className="space-y-0.5 text-[14px] text-muted">
                {b.why.map((w, i) => (
                  <li key={i}>· {w}</li>
                ))}
              </ul>
            </div>
          )}

          {e && (
            <div className="mt-3 rounded-[6px] border border-line bg-raised/60 p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[13px] font-semibold text-ink">Verifier evidence</span>
                <span className="tnum text-[12px] text-dim">fetched in {e.fetched_ms} ms</span>
                <span className={`ml-1 text-[12px] font-semibold ${e.in_stock ? "text-money" : "text-lie"}`}>{e.in_stock ? "In stock" : "Out of stock"}</span>
                <a href={e.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                  Open storefront <ExternalLink size={12} />
                </a>
              </div>
              <div className={`mb-2 text-[14px] ${lied ? "font-medium text-lie" : "text-ink"}`}>{e.summary}</div>
              <ul className="space-y-1">
                {e.checks.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px]">
                    {c.ok ? <CircleCheck size={15} className="mt-[1px] shrink-0 text-money" /> : <CircleX size={15} className="mt-[1px] shrink-0 text-lie" />}
                    <span className={`font-medium ${c.ok ? "text-ink" : "text-lie"}`}>{c.name}</span>
                    <span className="text-muted">{c.detail}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 truncate font-mono text-[11px] text-dim">{e.url}</div>
            </div>
          )}
          <div className="mt-2 font-mono text-[11px] text-dim">bid {b.id} · {clock(b.created_at)}</div>
        </div>
      </div>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[6px] border border-line bg-panel px-3 py-2">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold">{value}</div>
    </div>
  );
}
