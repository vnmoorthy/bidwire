import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  ExternalLink,
  Inbox,
  LoaderCircle,
  LogOut,
  Minus,
  Plus,
  Scale,
  ShieldAlert,
  Store,
  Trophy,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import type { Auction, Bid } from "@shared/types";
import { PhoneFrame } from "@/components/PhoneFrame";
import { paddleNo } from "@/components/MerchantDot";
import { LogoMark } from "@/components/Logo";
import { LivePill } from "@/components/LivePill";
import { ClientBadge } from "@/components/ClientBadge";
import { CountdownRing } from "@/components/CountdownRing";
import { Money } from "@/components/Money";
import { VerifyStamp } from "@/components/VerifyStamp";
import { api, ApiError, errMsg, type ListingWithProduct, type MerchantFeed, type MerchantProfile } from "@/lib/api";
import { useLive } from "@/lib/store";
import { claimedTotal, listingTotal, money, titleCase, trustColor } from "@/lib/format";

const LS_KEY = "bidwire.merchant";
export const RESET_NOTE = "The exchange was reset — open your store again.";

/** 401 bad_merchant_key / 404 merchant_not_found mean the store was wiped (Director reset). */
function storeGone(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  return e.status === 401 || e.status === 404 || /bad_merchant_key|merchant_not_found/i.test(e.message);
}

interface Saved {
  merchant_id: string;
  key: string;
}

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.merchant_id === "string" && typeof v.key === "string" ? v : null;
  } catch {
    return null;
  }
}

export function savedMerchant(): Saved | null {
  return loadSaved();
}

export default function MerchantApp() {
  const [saved, setSaved] = useState<Saved | null>(loadSaved);
  const [notice, setNotice] = useState<string | null>(null);
  const [initialListings, setInitialListings] = useState<ListingWithProduct[] | null>(null);

  const leave = useCallback((why?: string) => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
    setSaved(null);
    setInitialListings(null);
    setNotice(why ?? null);
  }, []);

  return (
    <PhoneFrame
      caption={
        <div>
          <div className="eyebrow">Merchant app</div>
          <h1 className="mt-2 text-[40px] font-semibold leading-tight tracking-tight">Anyone in the room can open a store and bid.</h1>
          <p className="mt-4 text-[18px] leading-relaxed text-muted">
            Requests from shopping agents land here live. Pick a listing, set your advertised delivered price and the fee you'd pay per sale.
            Bidwire fetches your real storefront and checkout before an agent ever sees your offer.
          </p>
        </div>
      }
    >
      {saved ? (
        <MerchantHome
          key={saved.merchant_id}
          saved={saved}
          initialListings={initialListings}
          onLeave={leave}
        />
      ) : (
        <JoinScreen
          notice={notice}
          onJoined={(s, listings) => {
            try {
              localStorage.setItem(LS_KEY, JSON.stringify(s));
            } catch {
              /* ignore */
            }
            setInitialListings(listings);
            setNotice(null);
            setSaved(s);
          }}
        />
      )}
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ join */

function JoinScreen({ notice, onJoined }: { notice: string | null; onJoined: (s: Saved, listings: ListingWithProduct[]) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.join(n);
      onJoined({ merchant_id: r.merchant.id, key: r.key }, r.listings ?? []);
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col px-6 pb-8 pt-14 lg:min-h-[844px]">
      <div className="flex items-center gap-2.5">
        <LogoMark size={28} />
        <div className="text-[18px] font-semibold tracking-[-0.01em]">
          <span className="serif text-[24px] font-normal">Bidwire</span> <span className="font-normal text-muted">Paddle</span>
        </div>
      </div>
      <div className="mt-12">
        <h1 className="serif text-[44px] leading-[46px]">Register as a bidder</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">
          Open a store, take a paddle, and bid on what AI agents are buying right now. Every claim is checked against your real checkout.
        </p>
      </div>
      {notice && <div className="mt-6 rounded-[12px] bg-fee-soft px-4 py-3 text-[14px] font-medium text-fee">{notice}</div>}
      <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
        <label className="text-[14px] font-semibold text-ink" htmlFor="store-name">
          Store name
        </label>
        <input
          id="store-name"
          className="input h-12 text-[17px]"
          placeholder="e.g. Moorthy's Gadget Hut"
          value={name}
          maxLength={40}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary mt-2 h-14 text-[17px]" disabled={busy || !name.trim()}>
          {busy ? <LoaderCircle size={20} className="animate-spin" /> : <Store size={20} />}
          {busy ? "Registering…" : "Register and take a paddle"}
        </button>
        {err && <div className="rounded-[10px] bg-lie-soft px-3 py-2 text-[14px] text-lie">{err}</div>}
      </form>
      <div className="mt-auto pt-10">
        <div className="grid grid-cols-3 gap-2 text-center text-[12px] text-muted">
          <div className="rounded-[12px] bg-raised px-2 py-3">
            <div className="text-[18px]">⚡️</div>Live lots
          </div>
          <div className="rounded-[12px] bg-raised px-2 py-3">
            <div className="text-[18px]">🔍</div>Verified bids
          </div>
          <div className="rounded-[12px] bg-raised px-2 py-3">
            <div className="text-[18px]">⚖️</div>Merit ranking
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ home */

function MerchantHome({ saved, initialListings, onLeave }: { saved: Saved; initialListings: ListingWithProduct[] | null; onLeave: (why?: string) => void }) {
  const live = useLive((s) => s.merchants.find((m) => m.id === saved.merchant_id));
  const auctions = useLive((s) => s.auctions);
  const auctionVersion = useLive((s) => s.auctionVersion);
  const orders = useLive((s) => s.orders);
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [feed, setFeed] = useState<MerchantFeed | null>(null);
  const [feedErr, setFeedErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null); // auction id
  const [placed, setPlaced] = useState<Record<string, Bid>>({}); // bids placed this session, by auction id
  const seenAuctions = useRef<Set<string>>(new Set());
  const resetVersion = useLive((s) => s.resetVersion);
  const firstReset = useRef(resetVersion);
  useEffect(() => {
    if (resetVersion === firstReset.current) return;
    const st = useLive.getState();
    if (st.hydrated && !st.merchants.some((m) => m.id === saved.merchant_id)) onLeave(RESET_NOTE);
  }, [resetVersion, saved.merchant_id, onLeave]);

  // Profile (listings, bids)
  const trustKey = live ? `${live.trust}|${live.bids}|${live.wins}` : "";
  useEffect(() => {
    let alive = true;
    api
      .merchant(saved.merchant_id)
      .then((p) => alive && setProfile(p))
      .catch((e) => {
        if (!alive) return;
        if (storeGone(e)) onLeave(RESET_NOTE);
      });
    return () => {
      alive = false;
    };
  }, [saved.merchant_id, trustKey, onLeave]);

  // Requests feed: poll every 2s and immediately when an auction opens
  const loadFeed = useCallback(async () => {
    try {
      const f = await api.feed(saved.merchant_id, saved.key);
      setFeed(f);
      setFeedErr(null);
      const fresh = f.open.filter((a) => !seenAuctions.current.has(a.id));
      if (fresh.length && seenAuctions.current.size > 0) navigator.vibrate?.(60);
      for (const a of f.open) seenAuctions.current.add(a.id);
      if (seenAuctions.current.size === 0) seenAuctions.current.add("__init");
    } catch (e) {
      if (storeGone(e)) {
        onLeave(RESET_NOTE);
        return;
      }
      setFeedErr(errMsg(e));
    }
  }, [saved.merchant_id, saved.key, onLeave]);

  useEffect(() => {
    loadFeed();
    const id = window.setInterval(loadFeed, 2000);
    return () => window.clearInterval(id);
  }, [loadFeed]);
  useEffect(() => {
    if (auctionVersion > 0) loadFeed();
  }, [auctionVersion, loadFeed]);

  const listings = profile?.listings ?? initialListings ?? [];
  const merchant = live ?? profile?.merchant;

  // Live version of every auction (SSE beats polling)
  const liveAuction = useCallback((a: Auction) => auctions.find((x) => x.id === a.id) ?? a, [auctions]);
  const openRequests = (feed?.open ?? []).map(liveAuction).filter((a) => a.status === "open" || a.status === "verifying");

  // My bids: merge feed.my_bids, profile bids and bids placed this session, preferring the live SSE copy.
  const myBids = useMemo(() => {
    const map = new Map<string, Bid>();
    for (const b of profile?.bids ?? []) map.set(b.id, b);
    for (const b of feed?.my_bids ?? []) map.set(b.id, b);
    for (const b of Object.values(placed)) if (!map.has(b.id)) map.set(b.id, b);
    for (const a of auctions) for (const b of a.bids ?? []) if (b.merchant_id === saved.merchant_id) map.set(b.id, b);
    return [...map.values()].sort((x, y) => y.created_at - x.created_at);
  }, [profile, feed, placed, auctions, saved.merchant_id]);

  const myBidFor = (auctionId: string) => myBids.find((b) => b.auction_id === auctionId);
  const sheetAuction = sheet ? auctions.find((a) => a.id === sheet) ?? feed?.open.find((a) => a.id === sheet) ?? null : null;

  return (
    <div className="min-h-[100dvh] bg-bg pb-10 lg:min-h-[844px]">
      {/* header */}
      <div className="sticky top-0 z-20 border-b border-line bg-panel/95 px-5 pb-3 pt-12 backdrop-blur-md lg:pt-14">
        <div className="flex items-center gap-2">
          <LogoMark size={22} />
          <span className="text-[15px] font-semibold text-ink"><span className="serif text-[21px] font-normal">Bidwire</span> <span className="font-normal text-muted">Paddle</span></span>
          <LivePill className="ml-auto" />
        </div>
      </div>

      <div className="px-5 pt-4">
        {/* store card */}
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <div className="smallcaps">Your paddle</div>
              <div className="serif tnum text-[64px] leading-[60px]" style={{ color: merchant?.color ? undefined : undefined }}>
                {paddleNo(saved.merchant_id)}
              </div>
            </div>
            <div className="min-w-0 flex-1 pt-5">
              <div className="truncate text-[18px] font-semibold leading-tight">{merchant?.name ?? "Your store"}</div>
              <div className="truncate text-[13px] text-muted">@{merchant?.handle ?? "…"}</div>
            </div>
            <div className="pt-1 text-right">
              <div className="text-[12px] text-muted">Standing</div>
              <div className="serif tnum text-[34px] leading-none" style={{ color: trustColor(merchant?.trust ?? 0) }}>
                {merchant ? Math.round(merchant.trust) : "–"}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Mini label="Balance" value={<Money cents={merchant?.balance_cents ?? 0} />} />
            <Mini label="Earned" value={<Money cents={merchant?.earned_cents ?? 0} className="text-money" />} />
            <Mini label="Commission" value={<Money cents={merchant?.fees_paid_cents ?? 0} className="text-fee" />} />
          </div>
          <div className="tnum mt-3 flex gap-4 px-1 text-[13px] text-muted">
            <span>{merchant?.bids ?? 0} paddles raised</span>
            <span>{merchant?.wins ?? 0} hammers</span>
            <span className={merchant?.lies_caught ? "text-lie" : ""}>{merchant?.lies_caught ?? 0} withdrawn</span>
          </div>
        </div>

        {/* requests */}
        <div className="mt-6 flex items-center gap-2">
          <span className="inline-flex size-2 rounded-full bg-accent animate-pulse-dot" />
          <h2 className="serif text-[26px] leading-7">Live lots</h2>
          <span className="tnum ml-auto text-[13px] text-muted">{openRequests.length} open</span>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {openRequests.map((a) => (
              <RequestCard key={a.id} a={a} myBid={myBidFor(a.id)} onBid={() => setSheet(a.id)} />
            ))}
          </AnimatePresence>
          {openRequests.length === 0 && (
            <div className="rounded-[14px] border border-dashed border-line-strong px-5 py-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-raised text-muted"><Inbox size={22} /></div>
              <div className="mt-3 text-[15px] font-medium text-ink">No open lots in your categories</div>
              <div className="mt-1 text-[13px] text-muted">Keep this open. Lots appear the second an agent starts shopping.</div>
              {feedErr && <div className="mt-2 text-[12px] text-lie">{feedErr}</div>}
            </div>
          )}
        </div>

        {/* my bids */}
        {myBids.length > 0 && (
          <>
            <h2 className="serif mt-7 text-[26px] leading-7">Your paddles</h2>
            <div className="mt-3 flex flex-col gap-2">
              {myBids.slice(0, 8).map((b) => {
                const a = auctions.find((x) => x.id === b.auction_id);
                const order = orders.find((o) => o.bid_id === b.id);
                return <MyBidRow key={b.id} b={b} a={a} feeCharged={order?.fee_cents} sold={!!order} onOpen={() => setSheet(b.auction_id)} />;
              })}
            </div>
          </>
        )}

        {/* storefront */}
        <h2 className="serif mt-7 text-[26px] leading-7">Your storefront</h2>
        <div className="mt-3 flex flex-col gap-2">
          {listings.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-[12px] border border-line bg-panel p-3">
              <span className="text-[26px]">{l.product?.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{l.product?.title ?? l.sku}</div>
                <div className="mt-0.5 text-[12px] text-muted">
                  <Money cents={l.price_cents} className="text-ink" /> + <Money cents={l.shipping_cents} /> shipping
                  {l.hidden_fee_cents > 0 && <span className="text-fee"> + {money(l.hidden_fee_cents)} fee</span>} · {l.ship_days} {l.ship_days === 1 ? "day" : "days"} ·{" "}
                  {titleCase(l.product?.category ?? "")}
                </div>
              </div>
              <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-[10px] border border-line-strong px-2.5 py-1.5 text-[13px] font-medium text-ink">
                Page <ExternalLink size={12} />
              </a>
            </div>
          ))}
          {listings.length === 0 && <div className="shimmer h-14 rounded-xl" />}
        </div>

        <button className="btn btn-ghost mt-8 w-full text-muted" onClick={() => onLeave()}>
          <LogOut size={16} /> Leave the saleroom
        </button>
      </div>

      <AnimatePresence>
        {sheetAuction && (
          <BidSheet
            key={sheetAuction.id}
            a={liveAuction(sheetAuction)}
            listings={listings}
            saved={saved}
            existing={myBidFor(sheetAuction.id) ?? placed[sheetAuction.id]}
            feeCharged={(() => {
              const b = myBidFor(sheetAuction.id);
              return b ? orders.find((o) => o.bid_id === b.id)?.fee_cents : undefined;
            })()}
            onPlaced={(b) => setPlaced((p) => ({ ...p, [b.auction_id]: b }))}
            onClose={() => setSheet(null)}
            onStoreGone={() => onLeave(RESET_NOTE)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[12px] bg-raised px-3 py-2">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 truncate text-[15px] font-semibold">{value}</div>
    </div>
  );
}

function RequestCard({ a, myBid, onBid }: { a: Auction; myBid?: Bid; onBid: () => void }) {
  const open = a.status === "open";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`rounded-[14px] border p-4 ${open ? "border-[#f8c9b5] bg-panel shadow-[0_1px_2px_rgba(14,14,16,0.04),0_0_0_3px_rgba(242,86,29,0.08)]" : "border-line bg-panel"}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ClientBadge client={a.client} size="sm" />
            <span className="truncate text-[12px] text-muted">{a.buyer_name}</span>
          </div>
          <div className="serif mt-2 text-[24px] italic leading-7">{a.need}</div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 text-[13px] text-muted">
            <span>
              budget <Money cents={a.budget_cents} smart className="font-semibold text-ink" />
            </span>
            <span className="flex items-center gap-1">
              <CalendarClock size={12} /> {a.deliver_within_days ? `within ${a.deliver_within_days} ${a.deliver_within_days === 1 ? "day" : "days"}` : "any time"}
            </span>
            <span>{a.bids.length} paddles</span>
          </div>
          {a.must_have.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {a.must_have.map((m) => (
                <span key={m} className="rounded-full bg-raised px-2 py-[1px] text-[12px] font-medium text-ink">
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
        <CountdownRing openedAt={a.opened_at} closesAt={a.closes_at} status={a.status} size={52} stroke={5} />
      </div>
      {myBid ? (
        <button onClick={onBid} className="mt-3 flex w-full items-center justify-between rounded-[12px] border border-line bg-raised px-3 py-2.5">
          <span className="text-[13px] text-muted">
            Your paddle <Money cents={claimedTotal(myBid)} className="font-semibold text-ink" />
          </span>
          <VerifyStamp status={myBid.verify_status} size="sm" lieLabel="Withdrawn" />
        </button>
      ) : open ? (
        <button onClick={onBid} className="btn btn-primary mt-3 h-12 w-full text-[16px]">
          Raise paddle <ArrowRight size={17} />
        </button>
      ) : (
        <div className="mt-3 text-center text-[13px] text-muted">Bidding closed · verifying offers…</div>
      )}
    </motion.div>
  );
}

function MyBidRow({ b, a, feeCharged, sold, onOpen }: { b: Bid; a?: Auction; feeCharged?: number; sold: boolean; onOpen: () => void }) {
  const closed = a?.status === "closed";
  const lied = b.verify_status === "mismatch";
  const won = !!a && !lied && (a.winner_bid_id ? a.winner_bid_id === b.id : closed && b.rank === 1);
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-[12px] border border-line bg-panel px-3 py-2.5 text-left">
      <span className="text-[22px]">{b.product_emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-muted">{a?.need ?? b.product_title}</div>
        <div className="flex items-center gap-2 text-[14px]">
          <Money cents={claimedTotal(b)} className={`font-semibold ${lied ? "text-lie line-through" : ""}`} />
          {b.rank != null && !lied && <span className="tnum text-[13px] text-muted">Rank #{b.rank}</span>}
          {sold && feeCharged != null && <span className="tnum text-[13px] text-fee">Fee {money(feeCharged)}</span>}
        </div>
      </div>
      {closed || lied ? (
        lied ? (
          <span className="rounded-full bg-lie-soft px-2.5 py-1 text-[12px] font-semibold text-lie">Withdrawn</span>
        ) : won ? (
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-[#7d5f30]">Hammer</span>
        ) : (
          <span className="rounded-full bg-raised px-2.5 py-1 text-[12px] font-semibold text-muted">Outbid</span>
        )
      ) : (
        <VerifyStamp status={b.verify_status} size="sm" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ bid sheet */

function BidSheet({
  a,
  listings,
  saved,
  existing,
  feeCharged,
  onPlaced,
  onClose,
  onStoreGone,
}: {
  a: Auction;
  listings: ListingWithProduct[];
  saved: Saved;
  existing?: Bid;
  feeCharged?: number;
  onPlaced: (b: Bid) => void;
  onClose: () => void;
  onStoreGone: () => void;
}) {
  const eligible = useMemo(
    () => (a.category ? listings.filter((l) => l.product?.category === a.category) : listings),
    [a.category, listings],
  );
  const [listingId, setListingId] = useState<string | null>(eligible[0]?.id ?? null);
  const listing = eligible.find((l) => l.id === listingId) ?? eligible[0] ?? null;
  const real = listing ? listingTotal(listing) : 0;
  const [price, setPrice] = useState<number>(real);
  const [shipDays, setShipDays] = useState<number>(listing?.ship_days ?? 3);
  const [fee, setFee] = useState<number>(200);
  const [pitch, setPitch] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [placedBid, setPlacedBid] = useState<Bid | null>(existing ?? null);

  // re-prefill when the chosen listing changes
  useEffect(() => {
    if (!listing) return;
    setPrice(listingTotal(listing));
    setShipDays(listing.ship_days);
  }, [listing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!listingId && eligible[0]) setListingId(eligible[0].id);
  }, [eligible, listingId]);

  const liveBid = placedBid ? a.bids.find((b) => b.id === placedBid.id) ?? existing ?? placedBid : null;
  const lying = price < real;
  const min = Math.max(100, Math.round((real * 0.5) / 100) * 100);
  const max = Math.max(real * 1.5, a.budget_cents * 1.2, real + 2000);

  const submit = async () => {
    if (!listing) return;
    setBusy(true);
    setErr(null);
    try {
      const b = await api.placeBid(saved.merchant_id, {
        key: saved.key,
        auction_id: a.id,
        listing_id: listing.id,
        advertised_price_cents: Math.round(price),
        ship_days: shipDays,
        fee_cents: fee,
        pitch: pitch.trim() || undefined,
      });
      setPlacedBid(b);
      onPlaced(b);
      navigator.vibrate?.(40);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onStoreGone();
        return;
      }
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <motion.div className="fixed inset-0 z-30 bg-[rgba(14,14,16,0.28)] lg:absolute lg:rounded-[46px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-40 max-h-[92dvh] overflow-y-auto rounded-t-[24px] bg-panel px-5 pb-8 pt-3 shadow-[0_-12px_32px_rgba(14,14,16,0.12)] lg:absolute lg:max-h-[88%]"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 330 }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong" />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ClientBadge client={a.client} size="sm" />
              <span className="truncate text-[12px] text-muted">{a.buyer_name}</span>
            </div>
            <div className="serif mt-1.5 text-[26px] italic leading-8">{a.need}</div>
            <div className="mt-1 text-[13px] text-muted">
              Budget <Money cents={a.budget_cents} smart className="text-ink" /> · {a.deliver_within_days ? `deliver within ${a.deliver_within_days} ${a.deliver_within_days === 1 ? "day" : "days"}` : "any delivery time"}
            </div>
          </div>
          <CountdownRing openedAt={a.opened_at} closesAt={a.closes_at} status={a.status} size={52} stroke={5} />
          <button className="-mr-1 rounded-full p-1.5 text-muted hover:text-ink" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {liveBid ? (
          <BidStatus b={liveBid} a={a} feeCharged={feeCharged} />
        ) : eligible.length === 0 ? (
          <div className="mt-6 rounded-[12px] bg-raised p-4 text-[14px] text-muted">
            You don't carry {a.category ? titleCase(a.category) : "this category"}. Watch for the next request.
          </div>
        ) : a.status !== "open" ? (
          <div className="mt-6 rounded-[12px] bg-raised p-4 text-[14px] text-muted">Bidding closed for this request. Watch for the next one.</div>
        ) : (
          <>
            {/* listing picker */}
            <div className="mt-5 text-[14px] font-semibold text-ink">Lot item from your storefront</div>
            <div className="mt-2 flex flex-col gap-2">
              {eligible.map((l) => {
                const on = l.id === listing?.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => setListingId(l.id)}
                    className={`flex items-center gap-3 rounded-[12px] border p-3 text-left transition-colors ${on ? "border-ink bg-panel " : "border-line bg-panel"}`}
                  >
                    <span className="text-[24px]">{l.product?.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{l.product?.title ?? l.sku}</div>
                      <div className="text-[12px] text-muted">
                        Checkout {money(listingTotal(l))} · ships in {l.ship_days} {l.ship_days === 1 ? "day" : "days"} · {l.stock > 0 ? `${l.stock} in stock` : "out of stock"}
                      </div>
                    </div>
                    <span className={`size-4 shrink-0 rounded-full border-2 ${on ? "border-ink bg-ink shadow-[inset_0_0_0_3px_#fff]" : "border-line-strong"}`} />
                  </button>
                );
              })}
            </div>

            {/* price */}
            <div className="mt-6 flex items-end justify-between">
              <div className="text-[14px] font-semibold text-ink">Your delivered price <span className="font-normal text-muted">(what the agent pays)</span></div>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button className="btn size-12 rounded-full p-0" onClick={() => setPrice((p) => Math.max(min, p - 100))} aria-label="Lower price by $1">
                <Minus size={18} />
              </button>
              <div className={`tnum flex-1 text-center text-[38px] font-semibold tracking-[-0.02em] ${lying ? "text-lie" : "text-ink"}`}>{money(price)}</div>
              <button className="btn size-12 rounded-full p-0" onClick={() => setPrice((p) => Math.min(max, p + 100))} aria-label="Raise price by $1">
                <Plus size={18} />
              </button>
            </div>
            <input
              type="range"
              className={`range mt-3 ${lying ? "lie" : ""}`}
              min={min}
              max={max}
              step={50}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <span className="text-muted">
                Real checkout total <Money cents={real} className="font-semibold text-money" />
              </span>
              {price !== real && (
                <button className="font-medium text-ink underline decoration-line-strong underline-offset-2" onClick={() => setPrice(real)}>
                  reset
                </button>
              )}
            </div>
            {listing && (
              <div className="mt-1 text-[12px] text-dim">
                price {money(listing.price_cents)} + shipping {money(listing.shipping_cents)}
                {listing.hidden_fee_cents > 0 ? ` + ${listing.hidden_fee_label ?? "fee"} ${money(listing.hidden_fee_cents)}` : ""}
              </div>
            )}
            <AnimatePresence>
              {lying && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 flex items-start gap-2 overflow-hidden rounded-[12px] bg-lie-soft px-3 py-2.5 text-[14px] font-medium text-lie"
                >
                  <TriangleAlert size={17} className="mt-[1px] shrink-0" />
                  Lower than your real checkout price — the verifier will catch this.
                </motion.div>
              )}
            </AnimatePresence>

            {/* ship days + fee */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Stepper
                label="Ship days"
                value={`${shipDays} ${shipDays === 1 ? "day" : "days"}`}
                onMinus={() => setShipDays((d) => Math.max(1, d - 1))}
                onPlus={() => setShipDays((d) => Math.min(21, d + 1))}
                hint={listing ? `You really ship in ${listing.ship_days} ${listing.ship_days === 1 ? "day" : "days"}` : undefined}
                warn={!!listing && shipDays < listing.ship_days}
              />
              <Stepper
                label="Commission per sale"
                value={money(fee)}
                valueClass="text-fee"
                onMinus={() => setFee((f) => Math.max(0, f - 100))}
                onPlus={() => setFee((f) => Math.min(4000, f + 100))}
              />
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[13px] text-fee">
              <Scale size={14} /> Commission never buys rank — it only breaks ties.
            </div>

            <input className="input mt-5" placeholder="Pitch (optional)" maxLength={120} value={pitch} onChange={(e) => setPitch(e.target.value)} />

            <button className={`btn mt-5 h-14 w-full text-[17px] ${lying ? "border-lie bg-lie text-white hover:bg-[#c2282e]" : "btn-primary"}`} disabled={busy || !listing} onClick={submit}>
              {busy ? <LoaderCircle size={20} className="animate-spin" /> : null}
              {busy ? "Raising your paddle…" : lying ? `Raise paddle at ${money(price)} anyway` : `Raise paddle at ${money(price)}`}
            </button>
            {err && <div className="mt-3 rounded-lg border border-[#f3c4c6] bg-lie-soft px-3 py-2 text-[14px] text-lie">{err}</div>}
          </>
        )}
      </motion.div>
    </>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  hint,
  warn,
  valueClass = "",
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  hint?: string;
  warn?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="rounded-[12px] border border-line bg-panel p-3">
      <div className="text-[12px] font-medium text-muted">{label}</div>
      <div className="mt-2 flex items-center justify-between">
        <button className="btn size-9 rounded-full p-0" onClick={onMinus} aria-label={`Decrease ${label}`}>
          <Minus size={15} />
        </button>
        <span className={`tnum text-[20px] font-semibold ${warn ? "text-lie" : valueClass}`}>{value}</span>
        <button className="btn size-9 rounded-full p-0" onClick={onPlus} aria-label={`Increase ${label}`}>
          <Plus size={15} />
        </button>
      </div>
      {hint && <div className={`mt-1.5 text-center text-[11px] ${warn ? "text-lie" : "text-dim"}`}>{hint}</div>}
    </div>
  );
}

function BidStatus({ b, a, feeCharged }: { b: Bid; a: Auction; feeCharged?: number }) {
  const lied = b.verify_status === "mismatch";
  const closed = a.status === "closed";
  const won = !lied && (a.winner_bid_id ? a.winner_bid_id === b.id : closed && b.rank === 1);
  return (
    <div className="mt-6">
      <div className={`rounded-[14px] border p-5 text-center ${lied ? "border-[#f3c4c6] bg-lie-soft" : b.verify_status === "verified" ? "border-[#bfe5d3] bg-money-soft" : "border-line bg-raised"}`}>
        <div className="text-[13px] text-muted">Your paddle · {paddleNo(b.merchant_id)}</div>
        <div className={`tnum mt-1 text-[34px] font-semibold tracking-[-0.02em] ${lied ? "text-lie line-through" : ""}`}>{money(claimedTotal(b))}</div>
        <div className="text-[13px] text-muted">
          {b.product_emoji} {b.product_title} · ships in {b.claimed_ship_days} {b.claimed_ship_days === 1 ? "day" : "days"} · {money(b.fee_cents)} commission
        </div>
        <div className="mt-4 flex justify-center">
          <VerifyStamp status={b.verify_status} size="lg" lieLabel="Withdrawn: misrepresentation" />
        </div>
        {b.evidence && <div className={`mt-3 text-[14px] ${lied ? "text-lie" : "text-muted"}`}>{b.evidence.summary}</div>}
      </div>

      <div className="mt-4 rounded-[14px] border border-line bg-panel p-4">
        {!closed ? (
          <div className="flex items-center gap-2 text-[14px] text-muted">
            <LoaderCircle size={16} className="animate-spin text-muted" />
            {a.status === "open" ? "Bidding is open. The lot is ranked when the hammer falls." : "Checking every claim before the hammer…"}
          </div>
        ) : lied ? (
          <div className="flex items-start gap-2 text-[14px] text-lie">
            <ShieldAlert size={17} className="mt-[1px] shrink-0" /> Withdrawn for misrepresentation: it never reached the agent, and your standing took a hit.
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {won ? (
              <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[15px] font-semibold text-[#7d5f30]">
                <Trophy size={15} /> Hammer
              </span>
            ) : (
              <span className="rounded-full bg-raised px-3 py-1.5 text-[15px] font-semibold text-muted">Outbid</span>
            )}
            <div className="text-[14px]">
              <div>
                Ranked <span className="serif tnum text-[18px]">No. {b.rank ?? "—"}</span>
                {b.merit != null && <span className="text-muted"> · merit {Math.round(b.merit)}/100</span>}
              </div>
              {feeCharged != null ? (
                <div className="text-fee">Sold at the hammer · commission {money(feeCharged)} charged</div>
              ) : won ? (
                <div className="text-muted">Waiting for the agent to complete the purchase…</div>
              ) : null}
            </div>
          </div>
        )}
        {b.why.length > 0 && closed && (
          <ul className="mt-3 space-y-1 border-t border-line pt-3 text-[13px] text-muted">
            {b.why.slice(0, 3).map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        )}
      </div>
      {b.bribe_ignored && (
        <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-fee-soft px-3 py-2 text-[13px] text-fee">
          <Wallet size={14} /> Your {money(b.fee_cents)} commission didn't change your rank. Merit decides.
        </div>
      )}
    </div>
  );
}
