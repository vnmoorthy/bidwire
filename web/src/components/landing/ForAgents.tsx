import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Auction, Order } from "@shared/types";
import { api, type ConnectInfo, type ToolMeta } from "@/lib/api";
import { useLive } from "@/lib/store";
import { hasLie, isRanked, liedOffers, orderedOffers } from "./data";
import { CodeLines, Container, CopyChip, Reveal, SectionHeading, SmallCaps, cx, highlightLine } from "./ui";

/* ------------------------------------------------------------------ tools */

const MERCHANT_TOOLS = ["register_merchant", "list_open_requests", "place_bid", "get_my_results"];
const BUYER_ORDER = ["find_offers", "get_offers", "buy_offer", "check_approval", "get_order", "get_wallet", "report_offer", "explain_offer"];

const FALLBACK_TOOLS: { name: string; title: string }[] = [
  { name: "find_offers", title: "Find verified offers" },
  { name: "get_offers", title: "Get offers for an auction" },
  { name: "buy_offer", title: "Buy an offer" },
  { name: "check_approval", title: "Check a purchase approval" },
  { name: "get_order", title: "Get an order" },
  { name: "get_wallet", title: "Get wallet and spending policy" },
  { name: "report_offer", title: "Report a misleading offer" },
  { name: "explain_offer", title: "Explain an offer" },
  { name: "register_merchant", title: "Open a merchant store" },
  { name: "list_open_requests", title: "List open buyer requests" },
  { name: "place_bid", title: "Bid for an agent's purchase" },
  { name: "get_my_results", title: "Get my bid results" },
];

function useTools() {
  const [tools, setTools] = useState<{ name: string; title: string }[]>(FALLBACK_TOOLS);
  useEffect(() => {
    let alive = true;
    api
      .tools()
      .then((list: ToolMeta[]) => {
        if (alive && Array.isArray(list) && list.length) setTools(list.map((t) => ({ name: t.name, title: t.title || t.name })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const buyer = tools
    .filter((t) => !MERCHANT_TOOLS.includes(t.name))
    .sort((a, b) => rank(BUYER_ORDER, a.name) - rank(BUYER_ORDER, b.name));
  const merchant = tools.filter((t) => MERCHANT_TOOLS.includes(t.name)).sort((a, b) => rank(MERCHANT_TOOLS, a.name) - rank(MERCHANT_TOOLS, b.name));
  return { buyer, merchant };
}

function rank(order: string[], name: string) {
  const i = order.indexOf(name);
  return i < 0 ? 99 : i;
}

function ToolGroup({ title, tools }: { title: string; tools: { name: string; title: string }[] }) {
  return (
    <div>
      <SmallCaps className="text-muted">{title}</SmallCaps>
      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {tools.map((t) => (
          <li key={t.name} className="min-w-0">
            <code className="font-mono text-[13px] font-medium text-ink">{t.name}</code>
            <p className="truncate text-[13px] leading-5 text-muted">{t.title}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ connect snippets */

const TABS = [
  { client: "claude-code", label: "Claude Code" },
  { client: "cursor", label: "Cursor" },
  { client: "chatgpt", label: "ChatGPT" },
  { client: "codex", label: "Codex" },
];

function useConnect() {
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .connect()
      .then((c) => alive && setInfo(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return info;
}

function fallbackSnippet(client: string, mcpUrl: string): string {
  switch (client) {
    case "claude-code":
      return `claude mcp add --transport http bidwire ${mcpUrl}`;
    case "cursor":
      return JSON.stringify({ mcpServers: { bidwire: { url: mcpUrl } } }, null, 2);
    case "chatgpt":
      return `Settings → Apps & Connectors → Advanced → Developer mode → Create connector\nMCP server URL: ${mcpUrl}\nAuthentication: none`;
    default:
      return `# ~/.codex/config.toml\n[mcp_servers.bidwire]\ncommand = "npx"\nargs = ["-y", "mcp-remote", "${mcpUrl}"]`;
  }
}

/** Break a long one-line shell command at its flags so it reads well (still valid when pasted). */
function prettyShell(code: string): string {
  if (code.includes("\n") || !code.startsWith("claude ") || code.length < 64) return code;
  return code.replace(/ (https?:\/\/\S+)/, " \\\n  $1").replace(/ --header /g, " \\\n  --header ");
}

/* ------------------------------------------------------------------ two-call example (built from a real auction) */

const usd = (cents: number) => Math.round(cents) / 100;
const q = (s: string) => JSON.stringify(s);

function shortReason(summary: string | undefined): string {
  return (summary ?? "failed verification").replace(/ \(\+\$[^)]*\)/g, "").split("; ").slice(0, 2).join("; ");
}

function buildExample(auctions: Auction[], orders: Order[]): string | null {
  const closed = auctions.filter((a) => a.status === "closed" && isRanked(a));
  const a =
    closed.find((x) => x.winner_bid_id && hasLie(x)) ?? closed.find((x) => x.winner_bid_id) ?? closed.find(hasLie) ?? closed[0];
  if (!a) return null;
  const ranked = orderedOffers(a).filter((b) => b.rank != null);
  if (!ranked.length) return null;
  const pick = ranked[0];
  const bought = (a.winner_bid_id && a.bids.find((b) => b.id === a.winner_bid_id)) || null;
  const order = bought ? orders.find((o) => o.bid_id === bought.id) : undefined;
  const lie = liedOffers(a)[0];
  const verified = a.bids.filter((b) => b.verify_status === "verified").length;
  const excluded = a.bids.filter((b) => b.verify_status === "mismatch").length;

  const args = [`"need": ${q(a.need)}`, `"budget_usd": ${usd(a.budget_cents)}`];
  if (a.deliver_within_days != null) args.push(`"deliver_within_days": ${a.deliver_within_days}`);

  const L: string[] = [];
  L.push("→ find_offers");
  L.push(`{ ${args[0]},`);
  L.push(`  ${args.slice(1).join(", ")} }`);
  L.push("");
  L.push(`← ${a.bids.length} bids · ${verified} verified · ${excluded} excluded`);
  L.push(`{ "offers": [`);
  L.push(`    { "rank": 1, "merchant": ${q(pick.merchant_name)},`);
  L.push(`      "delivered_price_usd": ${usd(pick.evidence?.actual_total_cents ?? pick.claimed_price_cents)}, "verified": true,`);
  L.push(`      "offer_id": ${q(pick.id)} },`);
  L.push(`    // ${ranked.length - 1} more, ranked by merit`);
  if (lie) {
    L.push(`  ],`);
    L.push(`  "excluded": [`);
    L.push(`    { "merchant": ${q(lie.merchant_name)},`);
    L.push(`      "reason": ${q(shortReason(lie.evidence?.summary))} } ] }`);
  } else {
    L.push(`  ] }`);
  }
  const target = bought ?? pick;
  L.push("");
  L.push("→ buy_offer");
  L.push(`{ "offer_id": ${q(target.id)} }`);
  L.push("");
  if (order) {
    L.push(`← purchased`);
    L.push(`{ "status": "purchased",`);
    L.push(`  "order": { "id": ${q(order.id)}, "amount_cents": ${order.amount_cents} } }`);
  } else {
    L.push(`← purchased, or approval_required if over your limit`);
    L.push(`{ "status": "purchased", "order": { "amount_cents": ${target.evidence?.actual_total_cents ?? 0} } }`);
  }
  return L.join("\n");
}

const STATIC_EXAMPLE = [
  "→ find_offers",
  `{ "need": "noise cancelling headphones for long flights",`,
  `  "budget_usd": 400, "deliver_within_days": 5 }`,
  "",
  "← 7 bids · 5 verified · 2 excluded",
  `{ "offers": [`,
  `    { "rank": 1, "merchant": "Parcel & Pine",`,
  `      "delivered_price_usd": 368.99, "verified": true, "offer_id": "bid_…" },`,
  `    // 4 more, ranked by merit`,
  `  ],`,
  `  "excluded": [`,
  `    { "merchant": "DealDrop Direct",`,
  `      "reason": "Claimed $315.99 delivered; checkout says $344.99" } ] }`,
  "",
  "→ buy_offer",
  `{ "offer_id": "bid_…" }`,
].join("\n");

function ExampleLines({ code }: { code: string }) {
  return (
    <pre className="font-mono text-[12.5px] leading-[20px] text-ink">
      <code>
        {code.split("\n").map((l, i) => {
          let node: ReactNode;
          if (l.startsWith("→ ")) {
            node = (
              <>
                <span className="text-accent">→</span> <span className="font-mono font-semibold">{l.slice(2)}</span>
                <span className="text-dim"> · your agent</span>
              </>
            );
          } else if (l.startsWith("← ")) {
            node = (
              <>
                <span className="text-money">←</span> <span className="text-dim">{l.slice(2)}</span>
              </>
            );
          } else node = highlightLine(l);
          return (
            <span key={i} className={cx("block min-h-[20px]", (l.startsWith("→ ") || l.startsWith("← ")) && "font-sans text-[12px]")}>
              {node}
            </span>
          );
        })}
      </code>
    </pre>
  );
}

function CodeCard() {
  const info = useConnect();
  const config = useLive((s) => s.config);
  const auctions = useLive((s) => s.auctions);
  const orders = useLive((s) => s.orders);
  const [tab, setTab] = useState(TABS[0].client);

  const mcpUrl = info?.mcp_url ?? config?.mcp_url ?? `${window.location.origin}/mcp`;
  const raw = info?.snippets.find((s) => s.client === tab)?.code ?? fallbackSnippet(tab, mcpUrl);
  const shown = prettyShell(raw);
  const example = useMemo(() => buildExample(auctions, orders), [auctions, orders]);
  const real = example != null;

  return (
    <div className="overflow-hidden rounded-[6px] border border-line bg-panel">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-raised/50 pr-3">
        <div role="tablist" aria-label="MCP client" className="no-scrollbar flex min-w-0 overflow-x-auto px-2">
          {TABS.map((t) => {
            const active = t.client === tab;
            return (
              <button
                key={t.client}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(t.client)}
                className={cx(
                  "relative h-11 shrink-0 px-3 text-[13px] font-medium transition-colors focus-visible:outline-none",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {t.label}
                {active && <span aria-hidden className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
        <CopyChip text={raw} className="shrink-0" />
      </div>

      <div className="overflow-x-auto px-5 py-4">
        <CodeLines code={shown} className="w-max min-w-full" />
      </div>

      <div className="border-t border-line">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 pt-4">
          <SmallCaps className="text-muted">Then two calls</SmallCaps>
          <span className="text-[12px] text-dim">{real ? "Replayed from a real lot on this exchange" : "Example"}</span>
        </div>
        <div className="overflow-x-auto px-5 pb-5 pt-3">
          <div className="w-max min-w-full">
            <ExampleLines code={example ?? STATIC_EXAMPLE} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ section */

export function ForAgents() {
  const { buyer, merchant } = useTools();
  return (
    <section id="agents" className="scroll-mt-16">
      <Container className="grid grid-cols-1 gap-12 py-24 md:py-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)] lg:gap-16">
        <Reveal className="min-w-0">
          <SectionHeading
            eyebrow="For agents"
            title="One line to connect. Two calls to buy."
            sub="Bidwire is an MCP server. Your agent gets compact JSON it can reason about: offers that passed verification, ranked with reasons, plus the ones that were excluded and why."
          />
          <div className="mt-10 space-y-8 border-t border-line pt-8">
            <ToolGroup title="Buyer tools" tools={buyer} />
            <ToolGroup title="Merchant tools" tools={merchant} />
          </div>
        </Reveal>
        <Reveal delay={0.08} className="min-w-0">
          <CodeCard />
        </Reveal>
      </Container>
    </section>
  );
}
