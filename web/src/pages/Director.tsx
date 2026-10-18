import { useEffect, useState } from "react";
import {
  Bot,
  CircleCheck,
  CircleDashed,
  Clapperboard,
  Gavel,
  ExternalLink,
  ListChecks,
  LoaderCircle,
  Mail,
  MessageSquareText,
  Play,
  Power,
  RotateCcw,
  Timer,
  Wallet,
} from "lucide-react";
import { ClientBadge } from "@/components/ClientBadge";
import { gavelSoundOn, playGavel, setGavelSound } from "@/lib/gavel";
import { LivePill } from "@/components/LivePill";
import { api, errMsg, type Scenario } from "@/lib/api";
import { toast, toastError } from "@/lib/fx";
import { useLive } from "@/lib/store";
import { useLocalStorage } from "@/lib/useMedia";

const WINDOWS = [8, 12, 20, 30];

const RUN_OF_SHOW = [
  { t: "Open the saleroom on the projector", d: "Stats at zero, Live pill on, “Raise a paddle” QR visible." },
  { t: "Connect Claude to the MCP server", d: "Show the Claude Code snippet on Connect, run it, list Bidwire's tools." },
  { t: "First find_offers from Claude", d: "The need appears big, bids stream in, Agent activity logs the call." },
  { t: "Liar caught", d: "A drip-pricing bot claims a low price; the “Bid withdrawn” banner shows claimed vs checkout." },
  { t: "Bribe ignored", d: "MegaMart's big commission doesn't move its rank; the “Bribe ignored” banner appears." },
  { t: "A merchant joins from a phone", d: "The audience scans the QR, takes a paddle, bids (and tries to cheat)." },
  { t: "Over-budget approval on the phone", d: "Purchase above the limit texts the human; approve on /phone (or Inkbox SMS)." },
  { t: "Purchase + receipt", d: "The hammer falls, the “Sold to…” card shows price and commission; the receipt goes out by email." },
  { t: "Out-of-stock recovery", d: "Run “Sold out mid-purchase”: buy_offer returns the next best offer; the agent recovers." },
  { t: "Ledger balanced", d: "Open the settlement ledger: every transaction sums to $0.00; hammer total and commission match." },
  { t: "Merchant trust drop", d: "Open the liar's profile: its standing drops after each withdrawn bid." },
  { t: "Multi-client: ChatGPT and Codex", d: "Same tools from different clients, each with its badge in Agent activity." },
  { t: "Tools, resources and prompts in Connect", d: "Walk the tool list grouped by role; show llms.txt." },
  { t: "Playground", d: "Run explain_offer on the winner to show evidence an agent can cite." },
  { t: "Close", d: "You can't bribe an agent. Merchants pay only when a sale happens." },
];

export default function Director() {
  const config = useLive((s) => s.config);
  const buyers = useLive((s) => s.buyers);
  const stats = useLive((s) => s.stats);
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [scErr, setScErr] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Record<string, number>>({});

  useEffect(() => {
    api
      .scenarios()
      .then(setScenarios)
      .catch((e) => setScErr(errMsg(e)));
  }, []);

  const runScenario = async (s: Scenario) => {
    setRunning(s.id);
    try {
      await api.runScenario(s.id);
      setLastRun((r) => ({ ...r, [s.id]: Date.now() }));
      toast({ kind: "success", title: `Scenario started`, body: s.title }, 3000);
    } catch (e) {
      toastError(`Couldn't run “${s.title}”`, errMsg(e));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1700px] px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <Clapperboard size={13} /> Presenter
          </div>
          <h1 className="serif mt-1 text-[46px] leading-[50px]">Auctioneer's desk</h1>
          <p className="mt-1 text-[16px] text-muted">The demo director: open lots, reset the room and keep the show on time. Everything here calls the real server. Keep this on your laptop; put the saleroom on the projector.</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <a className="btn" href="/exchange" target="_blank" rel="noreferrer">
            Saleroom <ExternalLink size={14} />
          </a>
          <a className="btn" href="/phone" target="_blank" rel="noreferrer">
            Phone <ExternalLink size={14} />
          </a>
          <a className="btn" href="/merchant" target="_blank" rel="noreferrer">
            Merchant <ExternalLink size={14} />
          </a>
          <LivePill />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        {/* controls */}
        <div className="flex flex-col gap-5">
          <section className="panel p-5">
            <h2 className="serif text-[26px] leading-7">The room</h2>
            <div className="mt-4 flex flex-col gap-4">
              <ResetButton />
              <BotsToggle enabled={!!config?.bots_enabled} />
              <GavelToggle />
              <div>
                <div className="flex items-center gap-2 text-[14px] font-medium">
                  <Timer size={16} className="text-muted" /> Auction window
                  <span className="tnum ml-auto text-[13px] text-muted">{config ? `${Math.round(config.auction_ms / 1000)} seconds now` : "…"}</span>
                </div>
                <WindowPicker current={config ? Math.round(config.auction_ms / 1000) : null} />
              </div>
            </div>
          </section>
          <section className="panel p-5">
            <h2 className="serif text-[26px] leading-7">Providers</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 text-[14px]">
              <Status ok={config?.providers.messaging === "inkbox"} icon={<MessageSquareText size={15} />} label="Messaging" value={config?.providers.messaging === "inkbox" ? "Inkbox (real SMS + email)" : "Simulated (on-screen phone)"} />
              <Status ok icon={<Wallet size={15} />} label="Payments" value={config ? `${config.providers.payments} (double-entry, prepaid wallets)` : "…"} />
              <Status ok={!!config?.approver_phone_set} icon={<MessageSquareText size={15} />} label="Approver phone" value={config?.approver_phone_set ? "set" : "not set (approvals go to /phone)"} />
              <Status ok={!!config?.receipt_email_set} icon={<Mail size={15} />} label="Receipt email" value={config?.receipt_email_set ? "set" : "not set (receipts simulated)"} />
            </div>
            <div className="mt-3 space-y-1 border-t border-line pt-3 text-[13px] text-muted">
              <div className="break-all">Public URL <span className="font-mono text-[12px] text-ink">{config?.public_url ?? "…"}</span></div>
              <div className="break-all">MCP <span className="font-mono text-[12px] text-ink">{config?.mcp_url ?? "…"}</span></div>
              <div>
                {stats.auctions} auctions · {stats.bids} bids · {stats.orders} orders · {stats.approvals_pending} approvals pending
              </div>
            </div>
          </section>
        </div>

        {/* scenarios + agent */}
        <div className="flex flex-col gap-5">
          <section className="panel p-5">
            <h2 className="serif text-[26px] leading-7">Lots to run</h2>
            {scErr && <div className="mt-3 text-sm text-lie">{scErr}</div>}
            {!scenarios && !scErr && <div className="shimmer mt-3 h-40 rounded-[6px]" />}
            <div className="mt-3 flex flex-col gap-2">
              {(scenarios ?? []).map((s) => (
                <div key={s.id} className="flex items-start gap-3 rounded-[6px] border border-line bg-panel p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">{s.title}</div>
                    <div className="mt-0.5 text-[13px] leading-snug text-muted">{s.description}</div>
                    {lastRun[s.id] && <div className="mt-1 text-[12px] text-money">Started {new Date(lastRun[s.id]).toLocaleTimeString()}</div>}
                  </div>
                  <button className="btn btn-primary shrink-0" disabled={!!running} onClick={() => runScenario(s)}>
                    {running === s.id ? <LoaderCircle size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />}
                    Run
                  </button>
                </div>
              ))}
            </div>
          </section>
          <AgentForm buyers={buyers} />
        </div>

        {/* run of show */}
        <RunOfShow />
      </div>
    </div>
  );
}

function ResetButton() {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  const click = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    try {
      await api.reset();
      setArmed(false);
    } catch (e) {
      toastError("Reset failed", errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3">
      <button className={`btn ${armed ? "border-lie bg-lie text-white hover:bg-[#c2282e]" : "btn-danger"} min-w-[200px]`} onClick={click} disabled={busy}>
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : <RotateCcw size={16} />}
        {busy ? "Resetting…" : armed ? "Click again to confirm" : "Reset demo"}
      </button>
      <span className="text-[13px] text-muted">{armed ? "Wipes auctions, orders, stores and wallets." : "Re-seeds merchants, buyers and wallets."}</span>
    </div>
  );
}

function BotsToggle({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await api.bots(!enabled);
      // reflect immediately even if the server's config event is delayed
      const cfg = useLive.getState().config;
      if (cfg) useLive.setState({ config: { ...cfg, bots_enabled: !enabled } });
    } catch (e) {
      toastError("Couldn't toggle bots", errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={busy}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${enabled ? "border-ink bg-ink" : "border-line-strong bg-raised"}`}
        aria-pressed={enabled}
        aria-label="Toggle merchant bots"
      >
        <span className={`absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(14,14,16,0.25)] transition-all ${enabled ? "left-[23px]" : "left-[3px]"}`} />
      </button>
      <div className="flex items-center gap-2 text-[14px] font-medium">
        <Bot size={16} className="text-muted" />
        Merchant bots {enabled ? "on" : "off"}
      </div>
      <span className="text-[13px] text-muted">{enabled ? "8 bot merchants bid on every request." : "Only humans and merchant agents bid."}</span>
    </div>
  );
}

function WindowPicker({ current }: { current: number | null }) {
  const [busy, setBusy] = useState<number | null>(null);
  const pick = async (s: number) => {
    setBusy(s);
    try {
      await api.setConfig({ auction_ms: s * 1000 });
      const cfg = useLive.getState().config;
      if (cfg) useLive.setState({ config: { ...cfg, auction_ms: s * 1000 } });
    } catch (e) {
      toastError("Couldn't change the auction window", errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mt-2 grid grid-cols-4 gap-2">
      {WINDOWS.map((s) => (
        <button
          key={s}
          onClick={() => pick(s)}
          disabled={busy !== null}
          className={`btn tnum h-10 text-[15px] ${current === s ? "border-ink bg-ink text-white hover:bg-ink" : ""}`}
        >
          {busy === s ? <LoaderCircle size={14} className="animate-spin" /> : null}
          {s}s
        </button>
      ))}
    </div>
  );
}

function Status({ ok, icon, label, value }: { ok: boolean; icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[6px] border border-line bg-panel px-3 py-2">
      <span className={ok ? "text-money" : "text-muted"}>{icon}</span>
      <span className="font-medium">{label}</span>
      <span className={`ml-auto text-right text-[13px] ${ok ? "text-money" : "text-muted"}`}>{value}</span>
    </div>
  );
}

function AgentForm({ buyers }: { buyers: ReturnType<typeof useLive.getState>["buyers"] }) {
  const [buyerId, setBuyerId] = useState("");
  const [need, setNeed] = useState("noise cancelling headphones for flights");
  const [budget, setBudget] = useState("250");
  const [days, setDays] = useState("5");
  const [autoBuy, setAutoBuy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!buyerId && buyers[0]) setBuyerId(buyers[0].id);
  }, [buyers, buyerId]);

  const buyer = buyers.find((b) => b.id === buyerId);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const budgetUsd = Number(budget);
    if (!buyerId || !need.trim() || !(budgetUsd > 0)) return;
    setBusy(true);
    try {
      const d = days.trim() ? Number(days) : undefined;
      const r = await api.demoAgent({
        buyer_id: buyerId,
        need: need.trim(),
        budget_usd: budgetUsd,
        deliver_within_days: d && d > 0 ? d : undefined,
        auto_buy: autoBuy,
      });
      setRunId(r.run_id);
      toast({ kind: "success", title: `${buyer?.name ?? "Agent"} is shopping`, body: `“${need.trim()}” · $${budgetUsd}` }, 3500);
    } catch (e2) {
      toastError("Couldn't start the demo agent", errMsg(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-5">
      <h2 className="serif text-[26px] leading-7">Send in an agent</h2>
      <p className="mt-1 text-[13px] text-muted">Calls the real MCP tools: find_offers → buy_offer → check_approval. Progress shows in Agent activity.</p>
      <form onSubmit={submit} className="mt-3 grid grid-cols-2 gap-3">
        <label className="col-span-2 text-[13px] font-medium text-muted">
          Buyer agent
          <select className="input mt-1 text-[14px] text-ink" value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · limit ${(b.per_purchase_limit_cents / 100).toFixed(0)} · wallet ${(b.wallet_cents / 100).toFixed(0)}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-[13px] font-medium text-muted">
          Need
          <input className="input mt-1 text-[14px]" value={need} onChange={(e) => setNeed(e.target.value)} />
        </label>
        <label className="text-[13px] font-medium text-muted">
          Budget (USD)
          <input className="input mt-1 font-mono text-[14px]" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))} />
        </label>
        <label className="text-[13px] font-medium text-muted">
          Deliver within (days)
          <input className="input mt-1 font-mono text-[14px]" inputMode="numeric" value={days} placeholder="any" onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))} />
        </label>
        <label className="col-span-2 flex cursor-pointer items-center gap-3 text-[14px]">
          <input type="checkbox" className="size-4 accent-[#0E0E10]" checked={autoBuy} onChange={(e) => setAutoBuy(e.target.checked)} />
          Auto-buy the #1 offer
          {buyer && <ClientBadge client={buyer.client} className="ml-auto" />}
        </label>
        <button type="submit" className="btn btn-primary col-span-2 h-11 text-[15px]" disabled={busy || !buyerId || !need.trim() || !(Number(budget) > 0)}>
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
          {busy ? "Starting…" : "Run demo agent"}
        </button>
        {runId && <div className="col-span-2 text-[13px] text-muted">Run <span className="font-mono text-[12px]">{runId}</span> started</div>}
      </form>
    </section>
  );
}

function RunOfShow() {
  const [done, setDone] = useLocalStorage<Record<number, boolean>>("bidwire.runofshow", {});
  const count = RUN_OF_SHOW.filter((_, i) => done[i]).length;
  return (
    <section className="panel h-fit p-5">
      <div className="flex items-center gap-2">
        <ListChecks size={15} className="text-muted" />
        <h2 className="serif text-[26px] leading-7">Run of show</h2>
        <span className="tnum ml-auto text-[13px] text-muted">
          {count}/{RUN_OF_SHOW.length}
        </span>
        <button className="text-[12px] text-dim hover:text-ink" onClick={() => setDone({})}>
          reset
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${(count / RUN_OF_SHOW.length) * 100}%` }} />
      </div>
      <ol className="mt-3 flex flex-col gap-1">
        {RUN_OF_SHOW.map((s, i) => {
          const on = !!done[i];
          return (
            <li key={i}>
              <button
                onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
                className={`flex w-full items-start gap-3 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-raised ${on ? "opacity-60" : ""}`}
              >
                {on ? <CircleCheck size={18} className="mt-[1px] shrink-0 text-money" /> : <CircleDashed size={18} className="mt-[1px] shrink-0 text-dim" />}
                <span className="min-w-0">
                  <span className={`block text-[14px] font-medium ${on ? "line-through decoration-muted" : ""}`}>
                    <span className="tnum mr-1.5 text-[12px] text-dim">{String(i + 1).padStart(2, "0")}</span>
                    {s.t}
                  </span>
                  <span className="block text-[12.5px] leading-snug text-muted">{s.d}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[12px] text-dim">
        <Power size={12} /> Checkboxes are saved in this browser.
      </div>
    </section>
  );
}

function GavelToggle() {
  const [on, setOn] = useState(gavelSoundOn);
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => {
          const next = !on;
          setGavelSound(next);
          setOn(next);
          if (next) playGavel();
        }}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${on ? "border-ink bg-ink" : "border-line-strong bg-raised"}`}
        aria-pressed={on}
        aria-label="Toggle the gavel sound"
      >
        <span className={`absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(22,19,14,0.25)] transition-all ${on ? "left-[23px]" : "left-[3px]"}`} />
      </button>
      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[14px] font-medium">
        <Gavel size={16} className="text-muted" />
        Gavel sound {on ? "on" : "off"}
      </div>
      <span className="text-[13px] text-muted">A knock when the hammer falls, on screens opened in this browser.</span>
    </div>
  );
}
