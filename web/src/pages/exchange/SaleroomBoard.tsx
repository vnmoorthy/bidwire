import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Gavel, Hourglass, LoaderCircle, Phone, PhoneOff } from "lucide-react";
import type { Auction, Bid } from "@shared/types";
import { PaddleChip, paddleNo } from "@/components/MerchantDot";
import { api, errMsg } from "@/lib/api";
import { toast, toastError } from "@/lib/fx";
import { claimedTotal, days, lotLabel, lotNumber, money, titleCase } from "@/lib/format";
import { playGavel } from "@/lib/gavel";
import type { LotState } from "@/lib/lot";
import { useLot } from "@/lib/useLot";
import { useLive, useNow } from "@/lib/store";
import { clientInfo } from "@/lib/clients";

const GOLD_DIM = "text-[#b9a47c]";
const RULE = "border-[rgba(243,233,210,0.12)]";

type Phase = "open" | "verifying" | "hammer" | "sold" | "passed";

function phaseOf(a: Auction, lot: LotState): Phase {
  if (lot.sold) return "sold";
  if (a.status === "open") return "open";
  if (a.status === "verifying") return "verifying";
  return lot.hammer ? "hammer" : "passed";
}

/**
 * The black lacquer saleroom board. It only says "Sold" when the lot really has an order;
 * at close it shows the hammer offer and what the sale is waiting on (the agent's buy_offer, or a human on the phone).
 * Key it by lot id so the gavel strikes only on a live sold transition.
 */
export function SaleroomBoard({ a }: { a: Auction }) {
  const auctions = useLive((s) => s.auctions);
  const total = useLive((s) => s.stats.auctions);
  const merchants = useLive((s) => s.merchants);
  const lot = useLot(a);
  const phase = phaseOf(a, lot);
  const lotNo = lotNumber(auctions, total, a.id);
  const bids = a.bids ?? [];
  const verified = bids.filter((b) => b.verify_status === "verified").length;
  const withdrawn = bids.filter((b) => b.verify_status === "mismatch").length;
  const featured: Bid | null = phase === "sold" ? lot.soldBid ?? lot.hammer : phase === "passed" ? null : lot.best;
  const soldPrice = lot.order?.amount_cents ?? (lot.soldBid ? claimedTotal(lot.soldBid) : null);

  // The gavel strikes (and knocks) only when this lot goes from unsold to sold while it is on screen.
  const [strike, setStrike] = useState(false);
  const wasSold = useRef(lot.sold);
  useEffect(() => {
    if (!wasSold.current && lot.sold) {
      setStrike(true);
      playGavel();
    }
    wasSold.current = lot.sold;
  }, [lot.sold]);

  const ap = lot.approval;
  const opener = clientInfo(a.client).label === a.buyer_name ? a.buyer_name : `${clientInfo(a.client).label} · ${a.buyer_name}`;
  const label =
    phase === "sold"
      ? `Sold to ${lot.order?.buyer_name ?? a.buyer_name} · paid, delivered`
      : phase === "hammer"
        ? "Hammer price · what the agent pays, delivered"
        : phase === "passed"
          ? "Passed · no paddle survived verification"
          : "Best verified price so far";

  // merchant line falls back to the order when the sold paddle isn't in this lot's bid list
  const soldMerchant = phase === "sold" && !featured && lot.order ? merchants.find((m) => m.id === lot.order!.merchant_id) : null;

  return (
    <section className="relative shrink-0 overflow-hidden rounded-[10px] bg-board text-board-text">
      <div className="pointer-events-none absolute inset-[6px] rounded-[6px] border border-[rgba(176,137,79,0.42)]" />
      <div className="relative px-8 pb-4 pt-4">
        {/* top line */}
        <div className={`flex flex-wrap items-center gap-x-2 smallcaps ${GOLD_DIM}`}>
          <span className="text-[#e3cf9f]">{lotLabel(lotNo)}</span>
          {a.category && <span>· {titleCase(a.category)}</span>}
          <span>· Opened by {opener}</span>
          <span className="ml-auto flex items-center gap-1.5">
            {phase === "open" ? (
              <>
                <span className="size-1.5 rounded-full bg-board-amber animate-pulse-dot" />
                <span className="text-board-amber">Bidding open</span>
              </>
            ) : phase === "verifying" ? (
              <span>Verifying paddles</span>
            ) : phase === "sold" ? (
              <span className="text-board-amber">Sold</span>
            ) : phase === "hammer" ? (
              <span className="text-[#e3cf9f]">{ap?.status === "pending" ? "Hammer · on the phone" : "Hammer · awaiting the buyer"}</span>
            ) : (
              <span>Passed</span>
            )}
          </span>
        </div>
        {/* lot title */}
        <h1 className="serif mt-2 line-clamp-2 text-[34px] italic leading-[40px] text-board-text 2xl:text-[40px] 2xl:leading-[46px]" title={a.need}>
          “{a.need}”
        </h1>

        <div className={`mt-3 flex items-end gap-8 border-t pt-3 ${RULE}`}>
          <div className="min-w-0 flex-1">
            <div className={`smallcaps ${phase === "sold" ? "text-[#e3cf9f]" : GOLD_DIM}`}>{label}</div>
            <AnimatePresence mode="wait" initial={false}>
              {phase === "sold" && soldPrice != null ? (
                <motion.div key="sold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.26 }} className="relative mt-1 inline-block">
                  <span className="serif tnum text-[64px] leading-[68px] 2xl:text-[72px] 2xl:leading-[76px]">
                    <span className="text-board-amber">Sold</span> · {money(soldPrice)}
                  </span>
                  <span className="gold-sweep absolute -bottom-1 left-0 h-[2px] w-full bg-accent" />
                </motion.div>
              ) : phase === "hammer" && lot.hammer ? (
                <motion.div key="hammer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.26 }} className="serif tnum mt-1 text-[64px] leading-[68px] 2xl:text-[72px] 2xl:leading-[76px]">
                  <span className="text-[#e3cf9f]">Hammer</span> · {money(claimedTotal(lot.hammer))}
                </motion.div>
              ) : featured && phase !== "passed" ? (
                <motion.div
                  key={`best-${featured.id}-${claimedTotal(featured)}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="serif tnum mt-1 text-[64px] leading-[68px] 2xl:text-[72px] 2xl:leading-[76px]"
                >
                  {money(claimedTotal(featured))}
                </motion.div>
              ) : (
                <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="serif mt-1 text-[40px] italic leading-[68px] text-[#8d826c] 2xl:leading-[76px]">
                  {phase === "passed" ? "No eligible offers" : a.status === "open" ? "Awaiting verified paddles…" : "Checking claims…"}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-1.5 flex min-h-[28px] min-w-0 items-center gap-3 text-[16px] text-[#d9ccb0]">
              {featured ? (
                <>
                  <PaddleChip id={featured.merchant_id} color={featured.merchant_color} />
                  <span className="truncate font-semibold text-board-text">{featured.merchant_name}</span>
                  <span className="shrink-0 text-[#8d826c]">Paddle {paddleNo(featured.merchant_id)}</span>
                  <span className="hidden min-w-0 truncate text-[#8d826c] lg:inline">
                    · {featured.product_emoji} {featured.product_title}
                  </span>
                </>
              ) : lot.order ? (
                <>
                  <PaddleChip id={lot.order.merchant_id} color={soldMerchant?.color ?? "#B0894F"} />
                  <span className="truncate font-semibold text-board-text">{lot.order.merchant_name}</span>
                  <span className="hidden min-w-0 truncate text-[#8d826c] lg:inline">· {lot.order.product_title}</span>
                </>
              ) : null}
            </div>
            {phase === "hammer" && <WaitingLine lot={lot} />}
            {phase === "sold" && lot.order && lot.soldBid && lot.hammer && lot.soldBid.id !== lot.hammer.id && (
              <div className="mt-1.5 flex items-center gap-2 text-[14px] text-[#b9a47c]">
                <Check size={15} /> Bought No. {lot.soldBid.rank ?? "—"} after No. 1 sold out: the agent recovered on its own
              </div>
            )}
          </div>
          <BoardClock a={a} phase={phase} strike={strike} onThePhone={ap?.status === "pending"} />
        </div>

        {/* bottom strip */}
        <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-2.5 smallcaps text-[#8d826c] ${RULE}`}>
          <span>Budget {money(a.budget_cents)}</span>
          <span>· {a.deliver_within_days ? `Within ${days(a.deliver_within_days)}` : "Any delivery time"}</span>
          {a.must_have?.length > 0 && <span>· Must have {a.must_have.join(", ")}</span>}
          <span className="ml-auto">
            {bids.length} paddles · <span className="text-[#9fc2a8]">{verified} verified</span> · <span className="text-[#d8908a]">{withdrawn} withdrawn</span>
          </span>
          <BuyAtHammer a={a} lot={lot} />
        </div>
      </div>
    </section>
  );
}

/** What a closed-but-unsold lot is waiting on. */
function WaitingLine({ lot }: { lot: LotState }) {
  const ap = lot.approval;
  if (ap?.status === "pending")
    return (
      <div className="mt-1.5 flex items-center gap-2 text-[15px] font-medium text-board-amber">
        <Phone size={16} className="animate-pulse-dot" /> Waiting for {ap.human_name} to approve on the phone
      </div>
    );
  if (ap?.status === "denied")
    return (
      <div className="mt-1.5 flex items-center gap-2 text-[15px] font-medium text-[#d8908a]">
        <PhoneOff size={16} /> {ap.human_name} declined on the phone · not sold
      </div>
    );
  if (ap?.status === "approved")
    return (
      <div className="mt-1.5 flex items-center gap-2 text-[15px] text-[#9fc2a8]">
        <Check size={16} /> Approved by {ap.human_name} · completing the purchase…
      </div>
    );
  if (ap?.status === "expired")
    return (
      <div className="mt-1.5 flex items-center gap-2 text-[15px] text-[#8d826c]">
        <PhoneOff size={16} /> Approval expired · not sold
      </div>
    );
  return (
    <div className="mt-1.5 flex items-center gap-2 text-[15px] text-[#b9a47c]">
      <Hourglass size={15} /> Awaiting the agent's <span className="font-mono text-[14px] text-[#d9ccb0]">buy_offer</span>
    </div>
  );
}

/** Amber ring with seconds ("Going once… / Going twice… / Fair warning…"), then a raised gavel that strikes when sold. */
function BoardClock({ a, phase, strike, onThePhone }: { a: Auction; phase: Phase; strike: boolean; onThePhone: boolean }) {
  const now = useNow(100);
  const open = phase === "open";
  const total = Math.max(1, a.closes_at - a.opened_at);
  const remaining = Math.max(0, a.closes_at - now);
  const secs = Math.ceil(remaining / 1000);
  const size = 112;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = open ? remaining / total : 1;
  const phrase = open
    ? remaining <= 1000
      ? "Fair warning…"
      : remaining <= 2000
        ? "Going twice…"
        : remaining <= 3000
          ? "Going once…"
          : null
    : phase === "verifying"
      ? "Checking claims…"
      : phase === "hammer"
        ? onThePhone
          ? "On the phone…"
          : "Hammer"
        : phase === "sold"
          ? "Sold"
          : phase === "passed"
            ? "Passed"
            : null;

  const gavelUp = phase === "hammer" || phase === "passed";
  return (
    <div className="flex w-[200px] shrink-0 flex-col items-center">
      {phase === "sold" || gavelUp ? (
        <div
          className={`relative flex size-[112px] items-center justify-center rounded-full border ${
            phase === "sold" ? "border-[rgba(233,180,76,0.55)]" : "border-[rgba(243,233,210,0.14)]"
          }`}
        >
          {phase === "sold" && strike ? (
            <motion.span
              key="strike"
              className="inline-flex"
              style={{ transformOrigin: "18% 82%" }}
              initial={{ rotate: -35 }}
              animate={{ rotate: [-35, 8, 0], x: [0, 0, -2, 2, 0] }}
              transition={{ duration: 0.42, ease: "easeOut", times: [0, 0.6, 1], x: { duration: 0.42, times: [0, 0.55, 0.7, 0.85, 1] } }}
            >
              <Gavel size={52} className="text-board-amber" strokeWidth={1.6} />
            </motion.span>
          ) : (
            <span className="inline-flex" style={{ transformOrigin: "18% 82%", transform: `rotate(${phase === "sold" ? 0 : -35}deg)` }}>
              <Gavel size={52} className={phase === "sold" ? "text-board-amber" : phase === "hammer" ? "text-[#b9a47c]" : "text-[#5f584a]"} strokeWidth={1.6} />
            </span>
          )}
        </div>
      ) : (
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(243,233,210,0.12)" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={open ? "var(--board-amber)" : "rgba(233,180,76,0.35)"}
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
          {phrase && (
            <motion.div
              key={phrase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`serif italic ${
                phrase === "Checking claims…" ? "text-[20px] text-[#b9a47c]" : phrase === "Passed" ? "text-[24px] text-[#8d826c]" : phrase === "Hammer" ? "text-[24px] text-[#e3cf9f]" : "text-[24px] text-board-amber"
              }`}
            >
              {phrase}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Presenter action: buy the hammer offer for the lot's agent when it didn't buy on its own (e.g. the room auction).
 * Over the agent's limit, the same call texts the human and waits (up to 50s) for the approval, then completes the sale.
 * After an approval that nobody completed, it finishes the purchase.
 */
function BuyAtHammer({ a, lot }: { a: Auction; lot: LotState }) {
  const [busy, setBusy] = useState(false);
  const hammer = lot.hammer;
  if (!hammer || lot.sold || busy) return null;
  const st = lot.approval?.bid_id === hammer.id ? lot.approval.status : null;
  if (st === "pending" || st === "denied") return null;

  const buy = async () => {
    setBusy(true);
    try {
      const r = await api.runTool("buy_offer", {
        args: { offer_id: hammer.id, idempotency_key: `exchange-${a.id}`, wait_for_approval_seconds: 50 },
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
      <Gavel size={14} />
      {st === "approved" ? "Complete the approved purchase" : "Buy at the hammer"} · {money(claimedTotal(hammer))}
    </button>
  );
}
