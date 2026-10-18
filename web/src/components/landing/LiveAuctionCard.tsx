import { AnimatePresence, motion } from "framer-motion";
import { Check, Play, Radio, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Auction, Bid } from "@shared/types";
import { api, errMsg } from "@/lib/api";
import { ago, claimedTotal, money, moneySmart } from "@/lib/format";
import { useLive, useNow } from "@/lib/store";
import { AgentBadge, cardRows, days, deliveredCents, isLive, lieReason, pickShowcase } from "./data";
import { Arrow, Badge, Button, EASE, LiveDot, MerchantAvatar, Spinner, cx } from "./ui";

/* The hero's "Live from the exchange" card, driven entirely by the live store. */

// Mobile: merchant | price+status stacked. ≥sm: rank | merchant | delivered | status.
const GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[28px_minmax(0,1fr)_88px_96px]";

const ROWS = 4;

export function LiveAuctionCard({ className }: { className?: string }) {
  const auctions = useLive((s) => s.auctions);
  const hydrated = useLive((s) => s.hydrated);
  const live = auctions.find(isLive) ?? null;

  // Once an auction has been watched live, keep it on screen after it closes (no jumping back).
  const [pinned, setPinned] = useState<string | null>(null);
  useEffect(() => {
    if (live) setPinned(live.id);
  }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = live ?? (pinned ? auctions.find((a) => a.id === pinned) : undefined) ?? pickShowcase(auctions);

  return (
    <div className={cx("relative", className)}>
      {/* two ghost sheets underneath for depth */}
      <div aria-hidden className="absolute inset-x-8 -bottom-4 top-8 rounded-[16px] border border-line bg-panel/60" />
      <div aria-hidden className="absolute inset-x-4 -bottom-2 top-4 rounded-[16px] border border-line bg-panel/90" />

      <div className="relative overflow-hidden rounded-[16px] border border-line bg-panel shadow-[0_1px_2px_rgba(14,14,16,0.04),0_24px_60px_-28px_rgba(14,14,16,0.18)]">
        <div className="flex h-12 items-center justify-between gap-3 border-b border-line px-5">
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
            <LiveDot />
            Live from the exchange
          </span>
          {shown ? (
            <AuctionClock a={shown} />
          ) : (
            <span className="text-[12px] font-medium text-dim">{hydrated ? "Waiting for an agent" : "Connecting…"}</span>
          )}
        </div>

        {!hydrated ? (
          <CardSkeleton />
        ) : shown ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={shown.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <AuctionBody a={shown} />
            </motion.div>
          </AnimatePresence>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ header clock */

function Ring({ p }: { p: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="-rotate-90" aria-hidden>
      <circle cx="8" cy="8" r={r} fill="none" stroke="#E9E8E3" strokeWidth="2" />
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        stroke="#F2561D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, p)))}
        style={{ transition: "stroke-dashoffset 250ms linear" }}
      />
    </svg>
  );
}

function AuctionClock({ a }: { a: Auction }) {
  const now = useNow(a.status === "open" ? 250 : 1000);
  if (a.status === "open") {
    const total = Math.max(1, a.closes_at - a.opened_at);
    const left = Math.max(0, a.closes_at - now);
    return (
      <span className="inline-flex items-center gap-2 text-[12px] font-medium tabular-nums text-muted">
        <Ring p={left / total} />
        Closes in {Math.ceil(left / 1000)}s
      </span>
    );
  }
  if (a.status === "verifying")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted">
        <Spinner className="size-3" />
        Ranking offers
      </span>
    );
  return <span className="text-[12px] font-medium tabular-nums text-dim">Closed · {ago(a.closed_at ?? a.closes_at, now)}</span>;
}

/* ------------------------------------------------------------------ body */

function Sep() {
  return (
    <span aria-hidden className="text-line-strong">
      ·
    </span>
  );
}

function AuctionBody({ a }: { a: Auction }) {
  const rows = cardRows(a, ROWS);
  const bids = a.bids ?? [];
  const verified = bids.filter((b) => b.verify_status === "verified").length;
  const lied = bids.filter((b) => b.verify_status === "mismatch").length;
  const pending = bids.length - verified - lied;
  const bribes = bids.filter((b) => b.bribe_ignored).length;

  return (
    <>
      <div className="px-5 pb-5 pt-5">
        <p className="line-clamp-2 text-balance text-[20px] font-semibold leading-7 tracking-[-0.015em] text-ink">“{a.need}”</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] text-muted">
          <AgentBadge client={a.client} />
          <span className="hidden font-mono text-[12px] text-ink sm:inline">find_offers</span>
          <span className="hidden sm:inline">
            <Sep />
          </span>
          <span>
            Budget <b className="font-semibold tabular-nums text-ink">{moneySmart(a.budget_cents)}</b>
          </span>
          {a.deliver_within_days != null && (
            <>
              <Sep />
              <span>
                Within <b className="font-semibold text-ink">{days(a.deliver_within_days)}</b>
              </span>
            </>
          )}
          {a.must_have.slice(0, 2).map((m) => (
            <span key={m} className="inline-flex h-[22px] items-center rounded-[6px] bg-raised px-2 text-[12px] font-medium text-ink">
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className={cx(GRID, "h-9 border-y border-line bg-raised px-5 text-[12px] font-semibold text-muted")}>
        <span className="hidden sm:block">Rank</span>
        <span>Merchant</span>
        <span className="text-right">Delivered</span>
        <span className="hidden text-right sm:block">Status</span>
      </div>

      <ul className="min-h-[240px]">
        {rows.length === 0 ? (
          <SkeletonRows label="Merchants are bidding…" />
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((b) => (
              <BidRow key={b.id} b={b} a={a} />
            ))}
          </AnimatePresence>
        )}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-[#FCFCFB] px-5 py-3 text-[12.5px] text-muted">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Stat dot="bg-money" n={verified} label="verified" />
          {lied > 0 && <Stat dot="bg-lie" n={lied} label="caught lying" />}
          {pending > 0 && <Stat dot="bg-dim" n={pending} label="checking" />}
          {bribes > 0 && <Stat dot="bg-fee" n={bribes} label={bribes === 1 ? "bribe ignored" : "bribes ignored"} />}
        </div>
        <Link to="/exchange" className="group inline-flex items-center gap-1 font-semibold text-ink transition-colors hover:text-accent">
          Open exchange
          <Arrow className="size-3.5" />
        </Link>
      </div>
    </>
  );
}

function Stat({ dot, n, label }: { dot: string; n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={cx("size-1.5 rounded-full", dot)} aria-hidden />
      <b className="font-semibold tabular-nums text-ink">{n}</b> {label}
    </span>
  );
}

function BidRow({ b, a }: { b: Bid; a: Auction }) {
  const lied = b.verify_status === "mismatch";
  const pick = !lied && b.rank === 1;
  const bought = a.winner_bid_id === b.id;
  const lie = lied ? lieReason(b) : null;
  const bribe = !lied && b.bribe_ignored;

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: EASE }}
      className={cx(
        GRID,
        "relative min-h-[60px] border-b border-line px-5 py-2.5 last:border-b-0",
        pick && "bg-[linear-gradient(90deg,#FFF6F1,#FFFFFF_70%)]",
        lied && "bg-[#FFFCFC]",
      )}
    >
      {pick && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
      <span className={cx("hidden text-[14px] font-semibold tabular-nums sm:block", pick ? "text-accent" : "text-dim")}>
        {b.rank != null && !lied ? `#${b.rank}` : "—"}
      </span>

      <div className="flex min-w-0 items-center gap-3">
        <MerchantAvatar name={b.merchant_name} color={b.merchant_color} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14.5px] font-semibold leading-5 text-ink">{b.merchant_name}</span>
            {pick && (
              <Badge tone="accent" className="hidden h-5 px-2 text-[11px] sm:inline-flex">
                #1 pick
              </Badge>
            )}
            {bribe && (
              <Badge tone="fee" className="hidden h-5 px-2 text-[11px] sm:inline-flex">
                Bribe ignored
              </Badge>
            )}
          </div>
          <p className={cx("mt-0.5 truncate text-[12.5px] leading-[18px]", lied ? "text-lie" : bribe ? "text-fee" : "text-muted")}>
            {lie ? (
              lie.checkout != null ? (
                <>
                  Checkout says <b className="font-semibold tabular-nums">{money(lie.checkout)}</b>
                  {lie.fee && <span className="hidden sm:inline"> ({lie.fee})</span>}
                </>
              ) : (
                lie.text
              )
            ) : bribe ? (
              `Offered ${money(b.fee_cents)} per sale · still #${b.rank}`
            ) : (
              b.product_title
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 sm:contents">
        <span className="text-right text-[15px] font-semibold tabular-nums text-ink">
          {lied ? (
            <s className="text-muted decoration-lie decoration-2">{money(claimedTotal(b))}</s>
          ) : b.verify_status === "pending" ? (
            <span className="text-muted">{money(claimedTotal(b))}</span>
          ) : (
            money(deliveredCents(b))
          )}
        </span>
        <span className="flex justify-end">
          <StatusBadge b={b} bought={bought} />
        </span>
      </div>
    </motion.li>
  );
}

function StatusBadge({ b, bought }: { b: Bid; bought: boolean }) {
  const key = bought ? "bought" : b.verify_status;
  return (
    <motion.span
      key={key}
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: EASE }}
      className="inline-flex"
    >
      {b.verify_status === "pending" ? (
        <Badge tone="neutral">
          <Spinner className="size-3" />
          Checking
        </Badge>
      ) : b.verify_status === "mismatch" ? (
        <Badge tone="lie">
          Lied
          <X className="size-3" strokeWidth={3} aria-hidden />
        </Badge>
      ) : (
        <Badge tone="money">
          {bought ? "Bought" : "Verified"}
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </Badge>
      )}
    </motion.span>
  );
}

/* ------------------------------------------------------------------ skeleton and empty */

function SkeletonRows({ label, still = false }: { label?: string; still?: boolean }) {
  const pulse = still ? "" : "animate-pulse";
  return (
    <>
      {Array.from({ length: ROWS }, (_, i) => (
        <li key={i} className={cx(GRID, "relative min-h-[60px] border-b border-line px-5 py-2.5 last:border-b-0")}>
          <span className={cx("hidden h-3 w-5 rounded-[4px] bg-raised sm:block", pulse)} />
          <div className="flex min-w-0 items-center gap-3">
            <span className={cx("size-7 shrink-0 rounded-full bg-raised", pulse)} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className={cx("h-3 rounded-[4px] bg-raised", pulse)} style={{ width: `${62 - i * 9}%` }} />
              <div className={cx("h-2.5 rounded-[4px] bg-raised/70", pulse)} style={{ width: `${80 - i * 7}%` }} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 sm:contents">
            <span className={cx("ml-auto h-3 w-14 rounded-[4px] bg-raised", pulse)} />
            <span className={cx("ml-auto h-6 w-20 rounded-full bg-raised", pulse)} />
          </div>
          {i === 1 && label && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-[12px] font-medium text-muted shadow-[0_1px_2px_rgba(14,14,16,0.04)]">
                <Spinner className="size-3" />
                {label}
              </span>
            </span>
          )}
        </li>
      ))}
    </>
  );
}

function SkeletonHead({ still = false }: { still?: boolean }) {
  const pulse = still ? "" : "animate-pulse";
  return (
    <>
      <div className="px-5 pb-5 pt-5">
        <div className={cx("h-5 w-4/5 rounded-[6px] bg-raised", pulse)} />
        <div className="mt-4 flex gap-2">
          <span className={cx("h-6 w-20 rounded-full bg-raised", pulse)} />
          <span className={cx("h-6 w-24 rounded-[6px] bg-raised", pulse)} />
          <span className={cx("h-6 w-16 rounded-[6px] bg-raised", pulse)} />
        </div>
      </div>
      <div className="h-9 border-y border-line bg-raised" />
    </>
  );
}

function CardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the live exchange">
      <SkeletonHead />
      <ul className="min-h-[240px]">
        <SkeletonRows />
      </ul>
      <div className="h-11 border-t border-line bg-[#FCFCFB]" />
    </div>
  );
}

function EmptyState() {
  const [state, setState] = useState<"idle" | "starting" | "error">("idle");
  const [err, setErr] = useState("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function run() {
    setState("starting");
    setErr("");
    try {
      await api.runScenario("flight-headphones");
      // The auction shows up over the live stream; re-enable the button if it never does.
      timer.current = window.setTimeout(() => setState("idle"), 30_000);
    } catch (e) {
      setState("error");
      setErr(errMsg(e));
    }
  }

  return (
    <div className="relative">
      <div aria-hidden className="opacity-60">
        <SkeletonHead still />
        <ul className="min-h-[240px]">
          <SkeletonRows still />
        </ul>
        <div className="h-11 border-t border-line bg-[#FCFCFB]" />
      </div>
      <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(180deg,rgba(255,255,255,0.55),rgba(255,255,255,0.92)_45%,#FFFFFF)] px-6">
        <div className="max-w-[320px] text-center">
          <span className="mx-auto grid size-10 place-items-center rounded-full bg-raised text-muted">
            <Radio className="size-[18px]" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-ink">No auction running right now</p>
          <p className="mt-1 text-[13px] leading-5 text-muted">
            Start one and watch merchants bid, get checked against real checkouts and ranked, in about 15 seconds.
          </p>
          <Button onClick={run} variant="primary" className="mt-5" disabled={state === "starting"}>
            {state === "starting" ? <Spinner /> : <Play className="size-3.5 fill-current" aria-hidden />}
            {state === "starting" ? "Starting the auction…" : "Run a live demo"}
          </Button>
          {state === "error" && <p className="mt-3 text-[12px] text-lie">{err}</p>}
        </div>
      </div>
    </div>
  );
}
