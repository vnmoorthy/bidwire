import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, BatteryFull, Check, ChevronLeft, LoaderCircle, MessageSquareText, ShieldCheck, Signal, Wifi, X } from "lucide-react";
import type { Approval, Auction, Message } from "@shared/types";
import { PhoneFrame } from "@/components/PhoneFrame";
import { MerchantDot } from "@/components/MerchantDot";
import { api, errMsg } from "@/lib/api";
import { findBid, useLive, useNow } from "@/lib/store";
import { claimedTotal, clock, lotLabel, lotNumber, money } from "@/lib/format";
import { useMedia } from "@/lib/useMedia";

type Item = { kind: "msg"; ts: number; m: Message } | { kind: "approval"; ts: number; a: Approval };

export default function PhoneApp() {
  const messages = useLive((s) => s.messages);
  const approvals = useLive((s) => s.approvals);
  const config = useLive((s) => s.config);
  const desktop = useMedia("(min-width: 1024px)");
  const provider = config?.providers.messaging ?? "simulated";

  const items = useMemo<Item[]>(() => {
    const sms = messages.filter((m) => m.channel === "sms" && m.body?.trim());
    const list: Item[] = sms.map((m) => ({ kind: "msg", ts: m.ts, m }));
    for (const a of approvals) {
      // place the rich card right after the SMS that asked for it
      const related = sms.find((m) => m.related_id === a.id && m.direction === "out");
      list.push({ kind: "approval", ts: (related?.ts ?? a.created_at) + 0.5, a });
    }
    return list.sort((x, y) => x.ts - y.ts);
  }, [messages, approvals]);

  const pending = approvals.filter((a) => a.status === "pending").length;

  return (
    <PhoneFrame
      caption={
        <div>
          <div className="eyebrow">Human in the loop</div>
          <h1 className="serif mt-2 text-[52px] leading-[54px]">Over the limit? The agent asks its human.</h1>
          <p className="mt-4 text-[18px] leading-relaxed text-muted">
            Agents shop with a prepaid wallet and a per-purchase limit. Anything above it waits for a yes from a real person, by SMS or right here.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-[14px]">
            <span className={`rounded-full px-3 py-1 font-semibold ${provider === "inkbox" ? "bg-money-soft text-money" : "bg-raised text-muted"}`}>
              {provider === "inkbox" ? "via Inkbox SMS" : "simulated phone"}
            </span>
            <span className={`rounded-full px-3 py-1 font-medium ${config?.approver_phone_set ? "bg-money-soft text-money" : "bg-raised text-muted"}`}>
              approver phone {config?.approver_phone_set ? "set" : "not set"}
            </span>
            {pending > 0 && <span className="rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent">{pending} waiting for approval</span>}
          </div>
        </div>
      }
    >
      <Thread items={items} provider={provider} framed={desktop} />
    </PhoneFrame>
  );
}

function StatusBar() {
  const now = useNow(10_000);
  return (
    <div className="flex h-[54px] items-end justify-between px-8 pb-2 text-[15px] font-semibold">
      <span>{new Date(now).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M/, "")}</span>
      <span className="flex items-center gap-1.5">
        <Signal size={15} />
        <Wifi size={15} />
        <BatteryFull size={20} />
      </span>
    </div>
  );
}

function Thread({ items, provider, framed }: { items: Item[]; provider: string; framed: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  const last = items.length ? `${items.length}:${items[items.length - 1].ts}` : "0";
  const approvalsKey = items.filter((i) => i.kind === "approval").map((i) => (i.kind === "approval" ? i.a.status : "")).join(",");
  useEffect(() => {
    // wait for card layout animations to settle before following the thread
    const t = window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 260);
    return () => window.clearTimeout(t);
  }, [last, approvalsKey]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-panel lg:min-h-[844px]">
      <div className="sticky top-0 z-10 border-b border-line bg-[#F9F9F9]/95 backdrop-blur-md">
        {framed ? <StatusBar /> : <div className="h-3" />}
        <div className="flex items-center gap-3 px-4 pb-3 pt-1">
          <ChevronLeft size={24} className="text-agent" />
          <div className="flex size-10 items-center justify-center rounded-full bg-ink text-[16px] font-semibold text-white">B</div>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold leading-tight">Bidwire</div>
            <div className="text-[12px] text-muted">agent wallet approvals</div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${provider === "inkbox" ? "bg-money-soft text-money" : "bg-raised text-muted"}`}
          >
            {provider === "inkbox" ? "via Inkbox SMS" : "simulated phone"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-3 py-4">
        {items.length === 0 && (
          <div className="m-auto max-w-[280px] py-20 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-raised text-muted"><MessageSquareText size={22} /></div>
            <div className="mt-3 text-[15px] font-medium text-ink">No texts yet</div>
            <div className="mt-1 text-[13px] text-muted">When an agent tries to spend above its limit, the approval request lands here.</div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {items.map((it) =>
            it.kind === "msg" ? (
              <Bubble key={it.m.id} m={it.m} />
            ) : (
              <ApprovalCard key={it.a.id} a={it.a} />
            ),
          )}
        </AnimatePresence>
        <div ref={endRef} className="h-2" />
      </div>
      <ReplyBox pending={items.flatMap((i) => (i.kind === "approval" && i.a.status === "pending" ? [i.a] : []))} />
    </div>
  );
}

/** Secondary path: type a reply exactly like a real SMS ("YES 4821"); the server runs the same parser. */
function ReplyBox({ pending }: { pending: Approval[] }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const latest = pending[pending.length - 1];

  const send = async (value?: string) => {
    const body = (value ?? text).trim();
    if (!body) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await api.phoneReply(body);
      setText("");
      const msg = r && typeof r === "object" ? (r.reply ?? r.message ?? r.result ?? (r.error as string | undefined)) : null;
      if (r && typeof r === "object" && r.ok === false) setNote({ ok: false, text: String(msg ?? "Reply not understood") });
      else if (msg && typeof msg === "string") setNote({ ok: true, text: msg });
    } catch (e) {
      setNote({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sticky bottom-0 border-t border-line bg-[#F9F9F9]/95 px-3 pb-4 pt-2.5 backdrop-blur-md">
      {latest && (
        <div className="mb-2 flex gap-2">
          <button className="rounded-full bg-money-soft px-3 py-1 text-[13px] font-semibold text-money" disabled={busy} onClick={() => send(`YES ${latest.code}`)}>
            YES {latest.code}
          </button>
          <button className="rounded-full bg-lie-soft px-3 py-1 text-[13px] font-semibold text-lie" disabled={busy} onClick={() => send(`NO ${latest.code}`)}>
            NO {latest.code}
          </button>
          <span className="self-center text-[12px] text-muted">or tap Approve / Decline above</span>
        </div>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-full border border-line-strong bg-panel px-4 py-2.5 text-[15px] text-ink outline-none placeholder:text-dim focus:border-accent"
          placeholder={latest ? `Text message · e.g. YES ${latest.code}` : "Text message"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={160}
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !text.trim()} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-white disabled:opacity-30" aria-label="Send reply">
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowUp size={19} strokeWidth={2.6} />}
        </button>
      </form>
      {note && <div className={`mt-1.5 px-2 text-[12px] ${note.ok ? "text-muted" : "text-lie"}`}>{note.text}</div>}
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  const mine = m.direction === "in"; // a reply from the human's phone
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-[82%] whitespace-pre-wrap rounded-[20px] px-3.5 py-2 text-[15px] leading-snug ${
          mine ? "rounded-br-md bg-ink text-white" : "rounded-bl-md bg-[#E9E9EB] text-ink"
        }`}
      >
        {m.body}
      </div>
      <div className="mt-0.5 px-2 text-[10px] text-dim">
        {clock(m.ts)}
        {m.status === "failed" ? <span className="text-lie"> · failed{m.error ? `: ${m.error}` : ""}</span> : null}
      </div>
    </motion.div>
  );
}

function useApprovalContext(a: Approval) {
  const auctions = useLive((s) => s.auctions);
  const local = findBid(auctions, a.bid_id);
  const [fetched, setFetched] = useState<Auction | null>(null);
  useEffect(() => {
    if (local || fetched) return;
    let alive = true;
    api
      .auction(a.auction_id)
      .then((x) => alive && setFetched(x))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [a.auction_id, !!local]); // eslint-disable-line react-hooks/exhaustive-deps
  if (local) return local;
  const bid = fetched?.bids.find((b) => b.id === a.bid_id);
  return fetched && bid ? { auction: fetched, bid } : null;
}

function ApprovalCard({ a }: { a: Approval }) {
  const ctx = useApprovalContext(a);
  const auctions = useLive((s) => s.auctions);
  const totalLots = useLive((s) => s.stats.auctions);
  const ctxLot = auctions.some((x) => x.id === a.auction_id) ? lotLabel(lotNumber(auctions, totalLots, a.auction_id)) : null;
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const bid = ctx?.bid;

  const decide = async (d: "approve" | "deny") => {
    setBusy(d);
    setErr(null);
    try {
      await api.decide(a.id, d, "bidwire phone");
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const merchant = bid?.merchant_name;
  const product = bid?.product_title;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className={`mx-1 my-1 overflow-hidden rounded-[20px] border bg-panel ${
        a.status === "pending" ? "border-line shadow-[0_12px_32px_rgba(14,14,16,0.10)]" : "border-line shadow-[0_1px_2px_rgba(14,14,16,0.04)]"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <ShieldCheck size={15} className="text-accent" />
        <span className="text-[13px] font-semibold text-ink">Approval needed{ctxLot ? ` · ${ctxLot}` : ""}</span>
        <span className="ml-auto text-[12px] text-muted">Code <span className="font-mono">{a.code}</span></span>
      </div>
      <div className="px-4 py-3">
        <div className="text-[15px] leading-snug text-ink">
          Your agent <span className="font-semibold">{a.buyer_name}</span> wants to spend{" "}
          <span className="tnum font-semibold text-ink">{money(a.amount_cents)}</span>
          {merchant ? (
            <>
              {" "}
              at <span className="font-semibold">{merchant}</span>
            </>
          ) : null}
          {product ? (
            <>
              {" "}
              for <span className="font-semibold">{product}</span>
            </>
          ) : !merchant && a.reason ? (
            <> for {a.reason}</>
          ) : null}
          . Limit <span className="tnum">{money(a.limit_cents)}</span>.
        </div>
        {bid && (
          <div className="mt-3 flex items-center gap-3 rounded-[12px] bg-raised p-2.5">
            <span className="text-[26px]">{bid.product_emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{bid.product_title}</div>
              <div className="flex items-center gap-1.5 text-[12px] text-muted">
                <MerchantDot color={bid.merchant_color} size={7} /> {bid.merchant_name} · ships {bid.claimed_ship_days}d
              </div>
            </div>
            <div className="text-right">
              <div className="tnum text-[14px] font-semibold">{money(claimedTotal(bid))}</div>
              {bid.verify_status === "verified" && <div className="text-[12px] font-semibold text-money">Verified ✓</div>}
            </div>
          </div>
        )}
        <div className="mt-2 text-[12px] text-dim">
          Over the limit by <span className="tnum font-medium text-fee">{money(Math.max(0, a.amount_cents - a.limit_cents))}</span> · {clock(a.created_at)} · {a.channel === "inkbox" ? "sent via Inkbox SMS" : "simulated SMS"}
        </div>
      </div>
      {a.status === "pending" ? (
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <button className="btn h-12 text-[16px]" disabled={!!busy} onClick={() => decide("deny")}>
            {busy === "deny" ? <LoaderCircle size={17} className="animate-spin" /> : <X size={17} />} Decline
          </button>
          <button className="btn btn-primary h-12 text-[16px]" disabled={!!busy} onClick={() => decide("approve")}>
            {busy === "approve" ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} strokeWidth={3} />} Approve
          </button>
          {err && <div className="col-span-2 text-[12px] text-lie">{err}</div>}
        </div>
      ) : (
        <div
          className={`flex items-center gap-2 border-t px-4 py-3 text-[14px] font-semibold ${
            a.status === "approved" ? "border-line bg-money-soft text-money" : a.status === "denied" ? "border-line bg-lie-soft text-lie" : "border-line bg-raised text-muted"
          }`}
        >
          {a.status === "approved" ? <Check size={16} strokeWidth={3} /> : <X size={16} />}
          {a.status === "approved" ? "Approved" : a.status === "denied" ? "Declined" : "Expired"}
          <span className="ml-auto text-[12px] font-normal opacity-80">
            {a.decided_via ? `via ${a.decided_via}` : ""}
            {a.decided_at ? ` · ${clock(a.decided_at)}` : ""}
          </span>
        </div>
      )}
    </motion.div>
  );
}
