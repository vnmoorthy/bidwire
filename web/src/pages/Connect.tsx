import { useEffect, useMemo, useRef, useState } from "react";
import { BookText, Braces, Eye, EyeOff, FileText, KeyRound, LoaderCircle, Play, Plug, Store, Wrench } from "lucide-react";
import { ClientBadge } from "@/components/ClientBadge";
import { CopyButton } from "@/components/CopyButton";
import { api, errMsg, type ConnectInfo, type ToolMeta, type ToolRunResult } from "@/lib/api";
import { useLive } from "@/lib/store";
import { useLocalStorage } from "@/lib/useMedia";

const ROLE_META: Record<string, { label: string; blurb: string; cls: string }> = {
  buyer: { label: "Buyer agents", blurb: "Shopping agents call these with a buyer key.", cls: "text-ink" },
  merchant: { label: "Merchant agents", blurb: "Selling agents bid with a merchant key.", cls: "text-ink" },
  public: { label: "Public", blurb: "No key needed.", cls: "text-ink" },
};

function savedMerchantKey(): { merchant_id: string; key: string } | null {
  try {
    const raw = localStorage.getItem("bidwire.merchant");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Connect() {
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [tools, setTools] = useState<ToolMeta[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const config = useLive((s) => s.config);

  useEffect(() => {
    api.connect().then(setInfo).catch((e) => setErr(errMsg(e)));
    api.tools().then(setTools).catch((e) => setErr(errMsg(e)));
  }, []);

  const mcpUrl = info?.mcp_url ?? config?.mcp_url ?? "";
  const llms = `${(config?.public_url || window.location.origin).replace(/\/+$/, "")}/llms.txt`;

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-6 md:px-6">
      <div className="eyebrow">Connect</div>
      <h1 className="serif mt-1 text-[46px] leading-[50px]">Connect your agent</h1>
      <p className="mt-1 max-w-[860px] text-[16px] text-muted">
        One MCP server is the door to the saleroom. Any agent that speaks MCP (Claude, ChatGPT, Codex, Cursor) can shop with a buyer key, or raise paddles with a merchant key.
      </p>
      {err && <div className="mt-4 rounded-[6px] bg-lie-soft px-4 py-2 text-sm text-lie">{err}</div>}

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="panel p-5">
          <div className="serif flex items-center gap-2 text-[24px] leading-7">
            <Plug size={15} className="text-muted" /> MCP endpoint
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[6px] border border-line bg-raised px-4 py-3">
            <span className="min-w-0 flex-1 break-all font-mono text-[17px] text-ink md:text-[19px]">{mcpUrl || "…"}</span>
            {mcpUrl && <CopyButton text={mcpUrl} />}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-muted">
            <span>Streamable HTTP · auth with <span className="font-mono text-[13px] text-ink">Authorization: Bearer &lt;key&gt;</span> or <span className="font-mono text-[13px] text-ink">?key=</span></span>
            <span>no key = guest buyer</span>
            <a className="inline-flex items-center gap-1 font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink" href="/llms.txt" target="_blank" rel="noreferrer">
              <FileText size={14} /> llms.txt
            </a>
            <span className="hidden font-mono text-[12px] text-dim md:inline">{llms}</span>
          </div>
          <Snippets info={info} />
        </section>

        <section className="panel p-5">
          <div className="serif flex items-center gap-2 text-[24px] leading-7">
            <KeyRound size={15} className="text-muted" /> Buyer keys
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {(info?.buyers ?? []).map((b) => (
              <BuyerKey key={b.id} b={b} />
            ))}
            {!info && !err && <div className="shimmer h-24 rounded-[6px]" />}
          </div>
          <MerchantKeyNote />
        </section>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <ToolList tools={tools} />
        <Playground tools={tools} buyers={info?.buyers ?? []} />
      </div>
    </div>
  );
}

function Snippets({ info }: { info: ConnectInfo | null }) {
  const snippets = info?.snippets ?? [];
  const [tab, setTab] = useState(0);
  const cur = snippets[Math.min(tab, Math.max(0, snippets.length - 1))];
  return (
    <div className="mt-5">
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line">
        {snippets.map((s, i) => (
          <button
            key={s.client + i}
            onClick={() => setTab(i)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[14px] font-medium transition-colors ${i === tab ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {s.title}
          </button>
        ))}
      </div>
      {cur ? (
        <div className="relative mt-3">
          <pre className="code max-h-[340px] whitespace-pre-wrap break-all pr-24">{cur.code}</pre>
          <div className="absolute right-2 top-2">
            <CopyButton text={cur.code} compact label="Copy" />
          </div>
        </div>
      ) : (
        <div className="shimmer mt-3 h-32 rounded-[6px]" />
      )}
    </div>
  );
}

function BuyerKey({ b }: { b: ConnectInfo["buyers"][number] }) {
  const [show, setShow] = useState(false);
  const buyer = useLive((s) => s.buyers.find((x) => x.id === b.id));
  return (
    <div className="flex items-center gap-3 rounded-[6px] border border-line bg-panel px-3 py-2.5">
      <ClientBadge client={b.client} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{b.name}</div>
        <div className="truncate font-mono text-[13px] text-muted">{show ? b.key : b.key.replace(/.(?=.{4})/g, "•")}</div>
        {buyer && (
          <div className="text-[12px] text-dim">
            limit ${(buyer.per_purchase_limit_cents / 100).toFixed(0)}/purchase · wallet ${(buyer.wallet_cents / 100).toFixed(2)} · approver {buyer.human_name}
          </div>
        )}
      </div>
      <button className="btn btn-ghost p-2" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide key" : "Show key"}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      <CopyButton text={b.key} compact label="" />
    </div>
  );
}

function MerchantKeyNote() {
  const saved = savedMerchantKey();
  return (
    <div className="mt-4 rounded-[6px] bg-raised p-3.5 text-[13px] text-muted">
      <div className="mb-0.5 flex items-center gap-2 font-semibold text-ink">
        <Store size={14} className="text-muted" /> Merchant keys
      </div>
      Merchants get a key when they open a store, from the <a className="font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink" href="/merchant">merchant app</a> or the{" "}
      <span className="font-mono text-ink/90">register_merchant</span> tool.
      {saved && <div className="mt-1">This browser has a merchant key saved; the playground can use it.</div>}
    </div>
  );
}

function ToolList({ tools }: { tools: ToolMeta[] | null }) {
  const groups = useMemo(() => {
    const g: Record<string, ToolMeta[]> = {};
    for (const t of tools ?? []) (g[t.role] ??= []).push(t);
    return ["buyer", "merchant", "public"].filter((r) => g[r]).map((r) => ({ role: r, tools: g[r] }));
  }, [tools]);
  return (
    <section className="panel p-5">
      <div className="serif flex items-center gap-2 text-[24px] leading-7">
        <Wrench size={15} className="text-muted" /> MCP tools
        <span className="tnum ml-auto font-sans text-[13px] font-normal text-muted">{tools?.length ?? 0} tools</span>
      </div>
      {!tools && <div className="shimmer mt-3 h-48 rounded-[6px]" />}
      <div className="mt-3 space-y-5">
        {groups.map((g) => (
          <div key={g.role}>
            <div className="flex items-baseline gap-2">
              <span className={`text-[14px] font-semibold ${ROLE_META[g.role]?.cls ?? "text-ink"}`}>{ROLE_META[g.role]?.label ?? g.role}</span>
              <span className="text-[12px] text-dim">{ROLE_META[g.role]?.blurb}</span>
            </div>
            <div className="mt-2 divide-y divide-line rounded-[6px] border border-line">
              {g.tools.map((t) => (
                <details key={t.name} className="group px-3 py-2.5">
                  <summary className="flex cursor-pointer list-none items-start gap-3">
                    <span className="mt-[1px] font-mono text-[13.5px] font-medium text-ink">{t.name}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-ink">{t.title}</span>
                      <span className="block text-[13px] text-muted group-open:hidden">{t.description.length > 140 ? t.description.slice(0, 140) + "…" : t.description}</span>
                    </span>
                    <Braces size={14} className="mt-1 shrink-0 text-dim" />
                  </summary>
                  <div className="mt-2 text-[13px] text-muted">{t.description}</div>
                  <ArgsTable schema={t.input_schema} />
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArgsTable({ schema }: { schema: any }) {
  const props = Object.entries<any>(schema?.properties ?? {});
  const req = new Set<string>(schema?.required ?? []);
  if (!props.length) return <div className="mt-2 font-mono text-[12px] text-dim">no arguments</div>;
  return (
    <div className="mt-2 overflow-x-auto">
    <table className="w-full text-[12.5px]">
      <tbody>
        {props.map(([k, p]) => (
          <tr key={k} className="align-top">
            <td className="whitespace-nowrap py-0.5 pr-3 font-mono text-ink/90">
              {k}
              {req.has(k) && <span className="text-lie">*</span>}
            </td>
            <td className="whitespace-nowrap py-0.5 pr-3 font-mono text-dim">{p?.type === "array" ? `${p.items?.type ?? "any"}[]` : p?.type ?? "any"}</td>
            <td className="py-0.5 text-muted [overflow-wrap:anywhere]">{p?.description ?? (p?.items?.enum ? `one of ${p.items.enum.join(", ")}` : "")}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

/* ------------------------------------------------------------------ playground */

function exampleArgs(tool: ToolMeta | undefined): Record<string, unknown> {
  if (!tool) return {};
  const st = useLive.getState();
  const props: Record<string, any> = tool.input_schema?.properties ?? {};
  const required = new Set<string>(tool.input_schema?.required ?? []);
  const auctions = st.auctions;
  const openAuction = auctions.find((a) => a.status === "open");
  const latest = auctions[0];
  const bestBid =
    latest?.bids.find((b) => b.id === latest.winner_bid_id) ?? latest?.bids.find((b) => b.verify_status === "verified") ?? latest?.bids[0];
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(props)) {
    switch (k) {
      case "need":
        out[k] = "noise cancelling headphones for flights";
        break;
      case "budget_usd":
        out[k] = 250;
        break;
      case "deliver_within_days":
        out[k] = 5;
        break;
      case "must_have":
        out[k] = ["anc"];
        break;
      case "max_results":
        out[k] = 3;
        break;
      case "auction_id":
        out[k] = (openAuction ?? latest)?.id ?? "";
        break;
      case "wait_seconds":
        out[k] = 0;
        break;
      case "offer_id":
        out[k] = bestBid?.id ?? "";
        break;
      case "wait_for_approval_seconds":
        out[k] = 0;
        break;
      case "approval_id":
        out[k] = st.approvals[0]?.id ?? "";
        break;
      case "order_id":
        out[k] = st.orders[0]?.id ?? "";
        break;
      case "issue":
        out[k] = "Checkout total is higher than the advertised delivered price";
        break;
      case "store_name":
        out[k] = "Playground Gadgets";
        break;
      case "categories":
        out[k] = ["headphones", "chargers"];
        break;
      case "sku":
        out[k] = bestBid?.sku ?? "";
        break;
      case "delivered_price_usd":
        out[k] = bestBid ? Math.round((bestBid.claimed_price_cents + bestBid.claimed_shipping_cents) / 100) : 99;
        break;
      case "ship_days":
        out[k] = 3;
        break;
      case "fee_usd":
        out[k] = 2;
        break;
      case "pitch":
        out[k] = "Verified price, ships fast";
        break;
      case "merchant_key":
      case "idempotency_key":
        break;
      default:
        if (!required.has(k)) break;
        out[k] = p?.type === "number" || p?.type === "integer" ? 0 : p?.type === "boolean" ? false : p?.type === "array" ? [] : p?.type === "object" ? {} : "";
    }
  }
  return out;
}

function Playground({ tools, buyers }: { tools: ToolMeta[] | null; buyers: ConnectInfo["buyers"] }) {
  const [name, setName] = useLocalStorage<string>("bidwire.pg.tool", "find_offers");
  const tool = tools?.find((t) => t.name === name) ?? tools?.[0];
  const [args, setArgs] = useState("{}");
  const [buyerId, setBuyerId] = useLocalStorage<string>("bidwire.pg.buyer", "");
  const [merchantKey, setMerchantKey] = useState<string>(() => savedMerchantKey()?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [res, setRes] = useState<ToolRunResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (tool) setArgs(JSON.stringify(exampleArgs(tool), null, 2));
    setRes(null);
    setErr(null);
  }, [tool?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!buyerId && buyers[0]) setBuyerId(buyers[0].id);
  }, [buyers, buyerId, setBuyerId]);

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setElapsed(Date.now() - startRef.current), 100);
    return () => window.clearInterval(id);
  }, [busy]);

  let parsed: unknown = null;
  let parseErr: string | null = null;
  try {
    parsed = JSON.parse(args || "{}");
  } catch (e) {
    parseErr = (e as Error).message;
  }

  const run = async () => {
    if (!tool || parseErr) return;
    setBusy(true);
    setErr(null);
    setRes(null);
    startRef.current = Date.now();
    setElapsed(0);
    try {
      const body: { args: unknown; buyer_id?: string; merchant_key?: string } = { args: parsed };
      if (tool.role === "merchant") body.merchant_key = merchantKey || undefined;
      else if (buyerId) body.buyer_id = buyerId;
      setRes(await api.runTool(tool.name, body));
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const resultText = res ? (res.result !== undefined && res.result !== null ? JSON.stringify(res.result, null, 2) : res.text) : "";

  return (
    <section className="panel flex flex-col p-5">
      <div className="serif flex items-center gap-2 text-[24px] leading-7">
        <Play size={15} className="text-muted" /> Playground
        <span className="ml-1 font-sans text-[13px] font-normal text-muted">Calls the same MCP tools, logged as client “playground”</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-[13px] font-medium text-muted">
          Tool
          <select className="input mt-1 font-mono text-[14px] text-ink" value={tool?.name ?? ""} onChange={(e) => setName(e.target.value)}>
            {["buyer", "merchant", "public"].map((role) => {
              const list = (tools ?? []).filter((t) => t.role === role);
              if (!list.length) return null;
              return (
                <optgroup key={role} label={ROLE_META[role]?.label ?? role}>
                  {list.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        {tool?.role === "merchant" ? (
          <label className="text-[13px] font-medium text-muted">
            Merchant key
            <input className="input mt-1 font-mono text-[14px]" placeholder="bw_merch_…" value={merchantKey} onChange={(e) => setMerchantKey(e.target.value)} />
          </label>
        ) : (
          <label className="text-[13px] font-medium text-muted">
            Act as buyer
            <select className="input mt-1 text-[14px] text-ink" value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.client})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {tool && <div className="mt-2 text-[13px] text-muted">{tool.description}</div>}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">Arguments (JSON)</span>
        <button className="text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-2" onClick={() => tool && setArgs(JSON.stringify(exampleArgs(tool), null, 2))}>
          refill example
        </button>
      </div>
      <textarea
        className={`code mt-1 min-h-[170px] w-full resize-y outline-none ${parseErr ? "border-lie/60" : "focus:border-agent"}`}
        spellCheck={false}
        value={args}
        onChange={(e) => setArgs(e.target.value)}
      />
      {parseErr && <div className="mt-1 text-[12px] text-lie">Invalid JSON: {parseErr}</div>}
      <div className="mt-3 flex items-center gap-3">
        <button className="btn btn-primary px-5" onClick={run} disabled={busy || !tool || !!parseErr}>
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
          {busy ? `Running… ${(elapsed / 1000).toFixed(1)}s` : `Run ${tool?.name ?? ""}`}
        </button>
        {tool?.name === "find_offers" && !busy && <span className="text-[12px] text-dim">opens a live auction (~12s); watch the Exchange</span>}
        {res && (
          <span className="ml-auto flex items-center gap-3 font-mono text-[13px]">
            <span className={res.ok ? "text-money" : "text-lie"}>{res.ok ? "ok" : "error"}</span>
            <span className="text-muted">{res.ms}ms</span>
          </span>
        )}
      </div>
      {err && <div className="mt-3 rounded-[6px] bg-lie-soft px-3 py-2 text-sm text-lie">{err}</div>}
      {res && (
        <div className="mt-3">
          {res.text && res.result !== undefined && res.result !== null && (
            <div className="mb-2 flex items-start gap-2 rounded-[6px] bg-raised px-3 py-2 text-[13px] text-ink">
              <BookText size={14} className="mt-[2px] shrink-0 text-muted" />
              <span className="line-clamp-3 whitespace-pre-wrap">{res.text}</span>
            </div>
          )}
          <div className="relative">
            <pre className="code max-h-[420px]">{resultText}</pre>
            <div className="absolute right-2 top-2">
              <CopyButton text={resultText} compact label="" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
