import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Drawer } from "@/components/Drawer";
import { KindBadge } from "@/components/KindBadge";
import { PaddleChip } from "@/components/MerchantDot";
import { Money } from "@/components/Money";
import { Sparkline } from "@/components/Sparkline";
import { BidStamp } from "@/components/VerifyStamp";
import { api, errMsg, type MerchantProfile } from "@/lib/api";
import { useLive } from "@/lib/store";
import { ago, claimedTotal, days, listingTotal, money, trustColor } from "@/lib/format";

export function MerchantDrawer({ merchantId, onClose }: { merchantId: string | null; onClose: () => void }) {
  const live = useLive((s) => (merchantId ? s.merchants.find((m) => m.id === merchantId) : undefined));
  const [p, setP] = useState<MerchantProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const version = live ? `${live.trust}|${live.bids}|${live.wins}|${live.lies_caught}` : "";

  useEffect(() => {
    if (!merchantId) {
      setP(null);
      return;
    }
    let alive = true;
    api
      .merchant(merchantId)
      .then((r) => {
        if (alive) {
          setP(r);
          setErr(null);
        }
      })
      .catch((e) => alive && setErr(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [merchantId, version]);

  useEffect(() => {
    setP(null);
    setErr(null);
  }, [merchantId]);

  const m = live ?? p?.merchant;
  const history = p?.trust_history ?? [];
  return (
    <Drawer
      open={!!merchantId}
      onClose={onClose}
      width={720}
      title={
        m ? (
          <div className="flex items-center gap-3">
            <PaddleChip id={m.id} color={m.color} size="lg" />
            <h2 className="serif text-[30px] leading-9">{m.name}</h2>
            <KindBadge kind={m.kind} />
          </div>
        ) : (
          "Merchant"
        )
      }
      subtitle={m ? <span className="font-mono">@{m.handle} · {m.strategy}</span> : null}
    >
      {err && !p && <div className="rounded-[6px] bg-lie-soft p-4 text-sm text-lie">{err}</div>}
      {!m && !err && <div className="shimmer h-40 rounded-[6px]" />}
      {m && (
        <div className="space-y-6">
          <div className="grid grid-cols-[auto_1fr] gap-6 rounded-[6px] border border-line p-4">
            <div>
              <div className="text-[13px] text-muted">Standing (trust)</div>
              <div className="serif tnum mt-1 text-[56px] leading-none" style={{ color: trustColor(m.trust) }}>
                {Math.round(m.trust)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="mb-1 text-[13px] text-muted">Trust history</div>
              {history.length > 0 ? (
                <Sparkline values={history.map((h) => h.trust)} width={400} height={64} color={trustColor(m.trust)} min={0} max={100} />
              ) : (
                <div className="text-sm text-muted">No trust changes yet.</div>
              )}
              {history.length > 0 && (
                <div className="mt-1 truncate text-[12px] text-muted">
                  latest: {history[history.length - 1].reason} ({ago(history[history.length - 1].ts)})
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Stat label="Balance" value={<Money cents={m.balance_cents} />} />
            <Stat label="Earned" value={<Money cents={m.earned_cents} className="text-money" />} />
            <Stat label="Commission paid" value={<Money cents={m.fees_paid_cents} className="text-fee" />} />
            <Stat label="Bids" value={<span className="tnum">{m.bids}</span>} />
            <Stat label="Hammers" value={<span className="tnum">{m.wins}</span>} />
            <Stat label="Withdrawn" value={<span className={`tnum ${m.lies_caught ? "text-lie" : ""}`}>{m.lies_caught}</span>} />
          </div>

          <div>
            <div className="mb-2 card-title">Storefront listings</div>
            <div className="space-y-2">
              {(p?.listings ?? []).map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-[6px] border border-line p-3">
                  <span className="text-[28px]">{l.product?.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{l.product?.title ?? l.sku}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-muted">
                      <span>Price <Money cents={l.price_cents} className="text-ink" /></span>
                      <span>Shipping <Money cents={l.shipping_cents} className="text-ink" /></span>
                      {l.hidden_fee_cents > 0 && (
                        <span className="text-fee">
                          + {money(l.hidden_fee_cents)} {l.hidden_fee_label ? `“${l.hidden_fee_label}”` : "fee"} at checkout
                        </span>
                      )}
                      <span>{days(l.ship_days)} delivery</span>
                      <span>{l.stock > 0 ? `${l.stock} in stock` : <span className="text-lie">out of stock</span>}</span>
                      <span>{days(l.returns_days)} returns</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] text-muted">Checkout</div>
                    <Money cents={listingTotal(l)} className="font-semibold" />
                  </div>
                  <a href={l.url} target="_blank" rel="noreferrer" className="btn btn-ghost p-2" title="Open the real storefront page">
                    <ExternalLink size={15} />
                  </a>
                </div>
              ))}
              {p && p.listings.length === 0 && <div className="text-sm text-muted">No listings.</div>}
              {!p && !err && <div className="shimmer h-16 rounded-[6px]" />}
            </div>
          </div>

          <div>
            <div className="mb-2 card-title">Recent bids</div>
            <div className="divide-y divide-line rounded-[6px] border border-line">
              {(p?.bids ?? []).slice(0, 12).map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-3 py-2 text-[14px]">
                  <span>{b.product_emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{b.product_title}</span>
                  <Money cents={claimedTotal(b)} className={b.verify_status === "mismatch" ? "text-dim line-through" : ""} />
                  <span className="tnum w-14 text-right text-[13px] text-muted">{b.rank ? `#${b.rank}` : "–"}</span>
                  <BidStamp b={b} size="sm" short />
                </div>
              ))}
              {p && p.bids.length === 0 && <div className="px-3 py-3 text-sm text-muted">No bids yet.</div>}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[6px] border border-line px-3 py-2">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold">{value}</div>
    </div>
  );
}
