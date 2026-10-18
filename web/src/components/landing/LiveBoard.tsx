import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Gavel, Play, X } from "lucide-react";
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Auction, Bid } from "@shared/types";
import { api, errMsg } from "@/lib/api";
import { ago, claimedTotal, money, moneySmart } from "@/lib/format";
import { useLive, useNow } from "@/lib/store";
import {
  capitalize,
  cardRows,
  days,
  deliveredCents,
  department,
  isLive,
  leadingOffer,
  lieReason,
  lotLabel,
  lotNo,
  paddleNo,
  pickShowcase,
} from "./data";
import { Arrow, Badge, Button, EASE, LiveDot, PaddleChip, SmallCaps, Spinner, cx } from "./ui";

/* The hero's live mini saleroom: a black lacquer board over a paper paddle list,
   driven entirely by the live store. */

const ROWS = 4;
// Mobile: paddle | merchant | price+status stacked. ≥sm: rank | paddle | merchant | price | status.
const GRID =
  "grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[18px_42px_minmax(0,1fr)_88px_100px]";

export function LiveBoard({ className }: { className?: string }) {
  const auctions = useLive((s) => s.auctions);
  const hydrated = useLive((s) => s.hydrated);
  const total = useLive((s) => s.stats.auctions);
  const live = auctions.find(isLive) ?? null;

  // Once a lot has been watched live, keep it on the board after the hammer (no jumping back).
  const [pinned, setPinned] = useState<string | null>(null);
  useEffect(() => {
    if (live) setPinned(live.id);
  }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = live ?? (pinned ? auctions.find((a) => a.id === pinned) : undefined) ?? pickShowcase(auctions);
  const lot = shown ? lotNo(shown, auctions, Math.max(total, auctions.length)) : null;

  return (
    <div className={cx("relative", className)}>
      <Board a={shown ?? null} lot={lot} hydrated={hydrated} />
      <PaddleList a={shown ?? null} hydrated={hydrated} />
    </div>
  );
}

/* ------------------------------------------------------------------ the board */

function Board({ a, lot, hydrated }: { a: Auction | null; lot: number | null; hydrated: boolean }) {
  return (
    <div className="relative rounded-t-[10px] bg-board p-1.5 text-board-text">
      <div className="relative min-h-[264px] overflow-hidden rounded-[6px] border border-accent/40 px-5 pb-4 pt-4 sm:px-6">
        {!hydrated ? (
          <BoardIdle title="Connecting to the saleroom…" />
        ) : a ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={a.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <BoardLot a={a} lot={lot} />
            </motion.div>
          </AnimatePresence>
        ) : (
          <BoardEmpty />
        )}
      </div>
    </div>
  );
}

function BoardTopLine({ children, live = true }: { children: ReactNode; live?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <SmallCaps className="min-w-0 truncate text-accent">{children}</SmallCaps>
      {live && (
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <LiveDot color="bg-board-amber" />
          <SmallCaps className="text-board-amber">Live</SmallCaps>
        </span>
      )}
    </div>
  );
}

function BoardLot({ a, lot }: { a: Auction; lot: number | null }) {
  const lead = leadingOffer(a);
  const closed = a.status === "closed";
  const sold = closed && a.winner_bid_id ? (a.bids ?? []).find((b) => b.id === a.winner_bid_id) ?? null : null;
  const top = sold ?? lead;
  const dept = department(a.category);
  const label = sold ? "Sold" : closed ? (top ? "Hammer price" : "No verified offers") : top ? "Best verified offer" : "Awaiting paddles";

  const meta = [
    `Budget ${moneySmart(a.budget_cents)}`,
    a.deliver_within_days != null ? `Within ${days(a.deliver_within_days)}` : null,
    ...a.must_have.slice(0, 3),
  ].filter(Boolean) as string[];

  return (
    <>
      <BoardTopLine>
        {[lot ? lotLabel(lot) : null, dept, `Opened by ${a.buyer_name}`].filter(Boolean).join(" · ")}
      </BoardTopLine>
      <p className="mt-3 line-clamp-2 font-serif text-[22px] font-normal italic leading-[26px] text-board-text/85">“{capitalize(a.need)}”</p>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <SmallCaps className={sold ? "text-board-amber" : "text-board-text/50"}>{label}</SmallCaps>
          <div className="relative mt-1 h-[64px] sm:h-[72px]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={top ? `${top.id}:${deliveredCents(top)}` : "none"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.26, ease: EASE }}
                className="whitespace-nowrap font-serif text-[60px] font-normal leading-[64px] tracking-[-0.01em] tabular-nums text-board-text sm:text-[72px] sm:leading-[72px]"
              >
                {top ? money(deliveredCents(top)) : "—"}
              </motion.p>
            </AnimatePresence>
          </div>
          {sold && (
            <motion.span
              aria-hidden
              className="mt-1 block h-px origin-left bg-board-amber"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            />
          )}
          <p className="mt-2 truncate text-[14px] text-board-text/70">
            {top ? (
              <>
                <span className="font-medium text-board-text/90">{top.merchant_name}</span> · Paddle {paddleNo(top.merchant_id)}
              </>
            ) : closed ? (
              "Every paddle was withdrawn or unverified"
            ) : (
              "Merchants are raising paddles"
            )}
          </p>
        </div>
        <BoardClock a={a} />
      </div>

      <div className="mt-4 border-t border-board-text/10 pt-3">
        <SmallCaps className="block truncate text-board-text/45">{meta.join(" · ")}</SmallCaps>
      </div>
    </>
  );
}

function AmberRing({ p, children }: { p: number; children: ReactNode }) {
  const r = 25;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-14 shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(243,233,210,0.12)" strokeWidth="2" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="#E9B44C"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, p)))}
          style={{ transition: "stroke-dashoffset 250ms linear" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </div>
  );
}

function BoardClock({ a }: { a: Auction }) {
  const now = useNow(a.status === "open" ? 250 : 1000);
  const reduce = useReducedMotion();
  const prev = useRef(a.status);
  const [swing, setSwing] = useState(false);
  useEffect(() => {
    if (prev.current !== "closed" && a.status === "closed") setSwing(true);
    prev.current = a.status;
  }, [a.status]);

  if (a.status !== "closed") {
    const total = Math.max(1, a.closes_at - a.opened_at);
    const left = Math.max(0, a.closes_at - now);
    const secs = Math.ceil(left / 1000);
    const phrase = a.status === "verifying" || secs <= 1 ? "Sold…" : secs === 2 ? "Going twice…" : secs === 3 ? "Going once…" : null;
    return (
      <div className="flex shrink-0 flex-col items-end gap-2">
        <AnimatePresence mode="wait" initial={false}>
          {phrase ? (
            <motion.span
              key={phrase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="h-14 whitespace-nowrap font-serif text-[24px] italic leading-[56px] text-board-amber"
            >
              {phrase}
            </motion.span>
          ) : (
            <motion.span key="ring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <AmberRing p={left / total}>
                <span className="font-serif text-[20px] leading-none tabular-nums text-board-text">{secs}s</span>
              </AmberRing>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <span className="grid size-14 place-items-center rounded-full border border-accent/50 text-board-amber">
        <motion.span
          className="inline-flex origin-bottom-right"
          initial={swing && !reduce ? { rotate: -35 } : false}
          animate={swing && !reduce ? { rotate: [-35, 0, -4, 2, 0], x: [0, 0, 2, -2, 0] } : { rotate: 0 }}
          transition={{ duration: 0.42, times: [0, 0.55, 0.7, 0.85, 1], ease: "easeOut" }}
        >
          <Gavel className="size-6" strokeWidth={1.75} aria-hidden />
        </motion.span>
      </span>
      <SmallCaps className="whitespace-nowrap text-board-text/45">{ago(a.closed_at ?? a.closes_at, now)}</SmallCaps>
    </div>
  );
}

function BoardIdle({ title }: { title: string }) {
  return (
    <>
      <BoardTopLine live={false}>Bidwire saleroom</BoardTopLine>
      <div className="mt-4 h-6 w-3/4 animate-pulse rounded-[4px] bg-board-text/10" />
      <div className="mt-6 h-3 w-32 rounded-[3px] bg-board-text/10" />
      <div className="mt-3 h-14 w-56 animate-pulse rounded-[6px] bg-board-text/10" />
      <p className="mt-4 text-[13px] text-board-text/50">{title}</p>
    </>
  );
}

function BoardEmpty() {
  const [state, setState] = useState<"idle" | "starting" | "error">("idle");
  const [err, setErr] = useState("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function run() {
    setState("starting");
    setErr("");
    try {
      await api.runScenario("flight-headphones");
      // The lot arrives over the live stream; re-enable the button if it never does.
      timer.current = window.setTimeout(() => setState("idle"), 30_000);
    } catch (e) {
      setState("error");
      setErr(errMsg(e));
    }
  }

  return (
    <>
      <BoardTopLine>Bidwire saleroom</BoardTopLine>
      <p className="mt-6 font-serif text-[36px] font-normal italic leading-[40px] text-board-text">No lot on the block.</p>
      <p className="mt-2 max-w-[340px] text-[14px] leading-[22px] text-board-text/60">
        Open one and watch merchants raise paddles, get checked against real checkouts and hammered down in about 15 seconds.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={run} variant="onDark" size="md" disabled={state === "starting"}>
          {state === "starting" ? <Spinner /> : <Play className="size-3.5 fill-current" aria-hidden />}
          {state === "starting" ? "Opening the lot…" : "Run a live demo"}
        </Button>
        {state === "error" && <span className="text-[12px] text-[#E8A397]">{err}</span>}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ the paddle list */

function PaddleList({ a, hydrated }: { a: Auction | null; hydrated: boolean }) {
  const bids = a?.bids ?? [];
  const verified = bids.filter((b) => b.verify_status === "verified").length;
  const withdrawn = bids.filter((b) => b.verify_status === "mismatch").length;
  const rows = a ? cardRows(a, ROWS) : [];

  return (
    <div className="rounded-b-[10px] border-x border-b border-line bg-panel">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <SmallCaps className="text-muted">Paddles</SmallCaps>
        {a && bids.length > 0 && (
          <span className="truncate text-[12.5px] tabular-nums text-muted">
            {bids.length} raised · {verified} verified{withdrawn ? ` · ${withdrawn} withdrawn` : ""}
          </span>
        )}
      </div>

      <ul className="min-h-[240px]">
        {!hydrated ? (
          <SkeletonRows />
        ) : !a ? (
          <SkeletonRows still />
        ) : rows.length === 0 ? (
          <SkeletonRows label="Paddles going up…" />
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((b) => (
              <PaddleRow key={b.id} b={b} />
            ))}
          </AnimatePresence>
        )}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-[12.5px]">
        <span className="text-muted">Hammer price: what the agent pays, delivered.</span>
        <Link to="/exchange" className="group inline-flex items-center gap-1 font-medium text-ink transition-colors hover:text-[#7A5A2B]">
          Enter the saleroom
          <Arrow className="size-3.5 text-accent" />
        </Link>
      </div>
    </div>
  );
}

const PaddleRow = forwardRef<HTMLLIElement, { b: Bid }>(function PaddleRow({ b }, ref) {
  const reduce = useReducedMotion();
  const lied = b.verify_status === "mismatch";
  const hammer = !lied && b.rank === 1;
  const lie = lied ? lieReason(b) : null;
  const bribe = !lied && b.bribe_ignored;

  return (
    <motion.li
      ref={ref}
      layout="position"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.24, ease: EASE }}
      className={cx(
        GRID,
        "relative min-h-[60px] border-b border-line px-5 py-2.5 last:border-b-0",
        hammer && "bg-[linear-gradient(90deg,rgba(245,235,214,0.75),rgba(255,253,247,0)_70%)]",
      )}
    >
      {hammer && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
      <span className={cx("hidden font-serif text-[20px] leading-none tabular-nums sm:block", hammer ? "text-accent" : "text-dim")}>
        {b.rank != null && !lied ? b.rank : "–"}
      </span>
      <motion.span
        initial={reduce ? false : { rotate: -2, y: 2 }}
        animate={{ rotate: 0, y: 0 }}
        transition={{ duration: 0.26, ease: EASE }}
        className="inline-flex"
      >
        <PaddleChip n={paddleNo(b.merchant_id)} color={b.merchant_color} />
      </motion.span>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14.5px] font-semibold leading-5 text-ink">{b.merchant_name}</span>
          {bribe && (
            <Badge tone="fee" className="hidden h-5 px-2 text-[11px] sm:inline-flex">
              Bribe ignored
            </Badge>
          )}
        </div>
        <p className={cx("mt-0.5 truncate text-[12.5px] leading-[18px]", bribe ? "text-fee" : "text-muted")}>
          {bribe ? `Offered ${money(b.fee_cents)} commission · still No. ${b.rank}` : b.product_title}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 sm:contents">
        <span className="text-right font-serif text-[20px] leading-6 tabular-nums text-ink">
          {lied ? (
            <s className="text-muted decoration-lie decoration-[1.5px]">{money(claimedTotal(b))}</s>
          ) : b.verify_status === "pending" ? (
            <span className="text-muted">{money(claimedTotal(b))}</span>
          ) : (
            money(deliveredCents(b))
          )}
        </span>
        <span className="flex justify-end">
          <Status b={b} hammer={hammer} />
        </span>
      </div>

      {lie && (
        <p className="col-span-full -mt-0.5 pl-[54px] text-pretty text-[12.5px] leading-[18px] text-lie sm:pl-[84px]">
          <span className="font-semibold">Misrepresentation.</span>{" "}
          {lie.checkout != null ? (
            <>
              Claimed {money(claimedTotal(b))} delivered; checkout says{" "}
              <b className="font-semibold tabular-nums">{money(lie.checkout)}</b>
              {lie.fee ? ` (${lie.fee})` : ""}
            </>
          ) : (
            lie.text
          )}
        </p>
      )}
    </motion.li>
  );
});

function Status({ b, hammer }: { b: Bid; hammer: boolean }) {
  const key = hammer ? "hammer" : b.verify_status;
  const withdrawn = b.verify_status === "mismatch";
  return (
    <motion.span
      key={key}
      initial={withdrawn ? { scale: 1.08, opacity: 0 } : { opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.22, ease: EASE }}
      className="inline-flex"
    >
      {b.verify_status === "pending" ? (
        <Badge tone="neutral">
          <Spinner className="size-3" />
          Checking
        </Badge>
      ) : withdrawn ? (
        <Badge tone="lie">
          <X className="size-3" strokeWidth={3} aria-hidden />
          Withdrawn
        </Badge>
      ) : hammer ? (
        <Badge tone="hammer">
          <Gavel className="size-3" strokeWidth={2.5} aria-hidden />
          Hammer
        </Badge>
      ) : (
        <Badge tone="money">
          <Check className="size-3" strokeWidth={3} aria-hidden />
          Verified
        </Badge>
      )}
    </motion.span>
  );
}

function SkeletonRows({ label, still = false }: { label?: string; still?: boolean }) {
  const pulse = still ? "" : "animate-pulse";
  return (
    <>
      {Array.from({ length: ROWS }, (_, i) => (
        <li key={i} className={cx(GRID, "relative min-h-[60px] border-b border-line px-5 py-2.5 last:border-b-0")}>
          <span className={cx("hidden h-4 w-3 rounded-[3px] bg-raised sm:block", pulse)} />
          <span className={cx("h-7 w-[42px] rounded-[6px] bg-raised", pulse)} />
          <div className="min-w-0 space-y-2">
            <div className={cx("h-3 rounded-[3px] bg-raised", pulse)} style={{ width: `${62 - i * 9}%` }} />
            <div className={cx("h-2.5 rounded-[3px] bg-raised/70", pulse)} style={{ width: `${80 - i * 7}%` }} />
          </div>
          <div className="flex flex-col items-end gap-1.5 sm:contents">
            <span className={cx("ml-auto h-4 w-16 rounded-[3px] bg-raised", pulse)} />
            <span className={cx("ml-auto h-6 w-20 rounded-full bg-raised", pulse)} />
          </div>
          {i === 1 && label && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-[12px] font-medium text-muted">
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
