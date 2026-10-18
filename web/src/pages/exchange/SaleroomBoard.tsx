import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gavel, LoaderCircle } from "lucide-react";
import type { Auction, Bid } from "@shared/types";
import { PaddleChip, paddleNo } from "@/components/MerchantDot";
import { api, errMsg } from "@/lib/api";
import { toast, toastError } from "@/lib/fx";
import { claimedTotal, days, lotLabel, lotNumber, money, titleCase } from "@/lib/format";
import { playGavel } from "@/lib/gavel";
import { useLive, useNow } from "@/lib/store";
import { isWinner } from "./BidBoard";
import { clientInfo } from "@/lib/clients";

const GOLD_DIM = "text-[#b9a47c]";

function bestOffer(a: Auction): Bid | null {
  const w = a.bids.find((b) => isWinner(a, b));
  if (w) return w;
  const r1 = a.bids.find((b) => b.rank === 1 && b.verify_status !== "mismatch");
  if (r1) return r1;
  const verified = a.bids.filter((b) => b.verify_status === "verified").sort((x, y) => claimedTotal(x) - claimedTotal(y));
  return verified[0] ?? null;
}

/** The black lacquer saleroom board: lot, best verified offer, amber countdown, gavel at close. */
export function SaleroomBoard({ a }: { a: Auction }) {
  const auctions = useLive((s) => s.auctions);
  const total = useLive((s) => s.stats.auctions);
  const lot = lotNumber(auctions, total, a.id);
  const closed = a.status === "closed";
  const winner = closed ? a.bids.find((b) => isWinner(a, b)) ?? null : null;
  const best = bestOffer(a);
  const shown = closed ? winner : best;
  const bids = a.bids ?? [];
  const verified = bids.filter((b) => b.verify_status === "verified").length;
  const withdrawn = bids.filter((b) => b.verify_status === "mismatch").length;

  // knock once when this lot goes from open/verifying to closed while on screen
  const prev = useRef(a.status);
  useEffect(() => {
    if (prev.current !== "closed" && a.status === "closed") playGavel();
    prev.current = a.status;
  }, [a.status]);

  return (
    <section className="relative shrink-0 overflow-hidden rounded-[10px] bg-board text-board-text">
      <div className="pointer-events-none absolute inset-[6px] rounded-[6px] border border-[rgba(176,137,79,0.42)]" />
      <div className="relative px-8 pb-4 pt-4">
        {/* top line */}
        <div className={`flex flex-wrap items-center gap-x-2 smallcaps ${GOLD_DIM}`}>
          <span className="text-[#e3cf9f]">{lotLabel(lot)}</span>
          {a.category && <span>· {titleCase(a.category)}</span>}
          <span>· Opened by {clientInfo(a.client).label === a.buyer_name ? a.buyer_name : `${clientInfo(a.client).label} · ${a.buyer_name}`}</span>
          <span className="ml-auto flex items-center gap-1.5">
            {a.status === "open" ? (
              <>
                <span className="size-1.5 rounded-full bg-board-amber animate-pulse-dot" />
                <span className="text-board-amber">Bidding open</span>
              </>
            ) : a.status === "verifying" ? (
              <span>Verifying paddles</span>
            ) : (
              <span className="text-[#e3cf9f]">{winner ? "Sold" : "Passed"}</span>
            )}
          </span>
        </div>
        {/* lot title */}
        <h1 className="serif mt-2 line-clamp-2 text-[34px] italic leading-[40px] text-board-text 2xl:text-[40px] 2xl:leading-[46px]" title={a.need}>
          “{a.need}”
        </h1>

        <div className="mt-3 flex items-end gap-8 border-t border-[rgba(243,233,210,0.12)] pt-3">
          <div className="min-w-0 flex-1">
            <div className={`smallcaps ${GOLD_DIM}`}>{closed ? (winner ? "Hammer price · what the agent pays, delivered" : "Passed") : "Best verified price so far"}</div>
            <AnimatePresence mode="wait" initial={false}>
              {closed && winner ? (
                <motion.div key="sold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.26 }} className="relative mt-1 inline-block">
                  <span className="serif tnum text-[64px] leading-[68px] 2xl:text-[72px] 2xl:leading-[76px]">
                    <span className="text-board-amber">Sold</span> · {money(claimedTotal(winner))}
                  </span>
                  <span className="gold-sweep absolute -bottom-1 left-0 h-[2px] w-full bg-accent" />
                </motion.div>
              ) : shown ? (
                <motion.div
                  key={`best-${shown.id}-${claimedTotal(shown)}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="serif tnum mt-1 text-[64px] leading-[68px] 2xl:text-[72px] 2xl:leading-[76px]"
                >
                  {money(claimedTotal(shown))}
                </motion.div>
              ) : (
                <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="serif mt-1 text-[40px] italic leading-[68px] text-[#8d826c] 2xl:leading-[76px]">
                  {closed ? "No eligible offers" : a.status === "open" ? "Awaiting verified paddles…" : "Checking claims…"}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-1.5 flex min-h-[28px] min-w-0 items-center gap-3 text-[16px] text-[#d9ccb0]">
              {shown && (
                <>
                  <PaddleChip id={shown.merchant_id} color={shown.merchant_color} />
                  <span className="truncate font-semibold text-board-text">{shown.merchant_name}</span>
                  <span className="shrink-0 text-[#8d826c]">Paddle {paddleNo(shown.merchant_id)}</span>
                  <span className="hidden min-w-0 truncate text-[#8d826c] lg:inline">· {shown.product_emoji} {shown.product_title}</span>
                </>
              )}
            </div>
          </div>
          <BoardClock a={a} sold={!!winner} />
        </div>

        {/* bottom strip */}
        <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[rgba(243,233,210,0.12)] pt-2.5 smallcaps text-[#8d826c]`}>
          <span>Budget {money(a.budget_cents)}</span>
          <span>· {a.deliver_within_days ? `Within ${days(a.deliver_within_days)}` : "Any delivery time"}</span>
          {a.must_have?.length > 0 && <span>· Must have {a.must_have.join(", ")}</span>}
          <span className="ml-auto">
            {bids.length} paddles · <span className="text-[#9fc2a8]">{verified} verified</span> · <span className="text-[#d8908a]">{withdrawn} withdrawn</span>
          </span>
          <BuyWinner a={a} />
        </div>
      </div>
    </section>
  );
}

/** Amber ring with seconds; "Going once… / Going twice… / Sold" in the last 3 seconds; gavel at close. */
function BoardClock({ a, sold }: { a: Auction; sold: boolean }) {
  const now = useNow(100);
  const open = a.status === "open";
  const total = Math.max(1, a.closes_at - a.opened_at);
  const remaining = Math.max(0, a.closes_at - now);
  const secs = Math.ceil(remaining / 1000);
  const size = 112;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = open ? remaining / total : 1;
  const phrase = !open ? null : remaining <= 1000 ? "Sold" : remaining <= 2000 ? "Going twice…" : remaining <= 3000 ? "Going once…" : null;

  return (
    <div className="flex w-[200px] shrink-0 flex-col items-center">
      {a.status === "closed" ? (
        <motion.div
          key={`gavel-${a.id}`}
          initial={{ rotate: -35, y: -6, opacity: 0 }}
          animate={{ rotate: [-35, 0, 0, 0], x: [0, 0, -2, 2, 0], y: 0, opacity: 1 }}
          transition={{ duration: 0.42, ease: "easeOut", times: [0, 0.55, 0.7, 0.85, 1] }}
          style={{ originX: 0.85, originY: 0.85 }}
          className="flex size-[112px] items-center justify-center rounded-full border border-[rgba(233,180,76,0.45)]"
        >
          <Gavel size={52} className="text-board-amber" strokeWidth={1.6} />
        </motion.div>
      ) : (
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(243,233,210,0.12)" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--board-amber)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              style={{ transition: "stroke-dashoffset 120ms linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {open ? (
              <span className="serif tnum text-[46px] leading-none text-board-text">
                {secs}
                <span className="text-[20px] text-[#8d826c]">s</span>
              </span>
            ) : (
              <LoaderCircle size={26} className="animate-spin text-[#b9a47c]" />
            )}
          </div>
        </div>
      )}
      <div className="mt-1 h-8">
        <AnimatePresence mode="wait">
          {phrase ? (
            <motion.div key={phrase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="serif text-[24px] italic text-board-amber">
              {phrase}
            </motion.div>
          ) : a.status === "closed" ? (
            <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="serif text-[24px] italic text-board-amber">
              {sold ? "Sold" : "Passed"}
            </motion.div>
          ) : a.status === "verifying" ? (
            <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="serif text-[20px] italic text-[#b9a47c]">
              Checking claims…
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Presenter action: buy the hammer offer for the lot's agent when it didn't auto-buy (e.g. the room auction). */
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
      toastError("Couldn't buy the hammer offer", errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={buy}
      disabled={busy}
      className="inline-flex h-8 items-center gap-2 rounded-full border border-[rgba(233,180,76,0.6)] px-3.5 text-[13px] font-semibold normal-case tracking-normal text-board-amber transition-colors hover:bg-[rgba(233,180,76,0.12)] disabled:opacity-50"
      title={`Calls buy_offer as ${a.buyer_name}`}
    >
      {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Gavel size={14} />}
      Buy at the hammer · {money(claimedTotal(winner))}
    </button>
  );
}
