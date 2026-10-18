import { useState } from "react";
import { BadgeCheck, Bot, Gavel, Play, Scale } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { api, errMsg } from "@/lib/api";
import { toast, toastError } from "@/lib/fx";
import { useLive } from "@/lib/store";

export const DEMO_NEED = "noise cancelling headphones for flights";

export function EmptyHero() {
  const mcpUrl = useLive((s) => s.config?.mcp_url);
  const buyer = useLive((s) => s.buyers[0]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!buyer) return;
    setBusy(true);
    try {
      await api.demoAgent({ buyer_id: buyer.id, need: DEMO_NEED, budget_usd: 250 });
      toast({ kind: "info", title: `${buyer.name} is shopping`, body: `“${DEMO_NEED}”, budget $250` }, 3500);
    } catch (e) {
      toastError("Couldn't start the demo agent", errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card flex min-h-[520px] flex-1 flex-col items-center justify-center px-8 py-12 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-raised text-muted">
        <Bot size={30} />
      </div>
      <h1 className="text-[32px] font-semibold leading-[38px] tracking-[-0.02em] md:text-[40px] md:leading-[46px]">Waiting for an agent to shop</h1>
      <p className="mt-3 max-w-[640px] text-[17px] leading-7 text-muted">
        When Claude, ChatGPT or Codex needs to buy something, it calls <span className="font-mono text-[15px] text-ink">find_offers</span> once. Merchants bid live, every
        bid is checked against the real checkout, and offers are ranked on merit.
      </p>
      {mcpUrl && (
        <div className="mt-7 flex max-w-full items-center gap-3 rounded-xl border border-line bg-raised py-1.5 pl-4 pr-1.5">
          <span className="text-[13px] font-medium text-muted">MCP</span>
          <span className="truncate font-mono text-[15px] text-ink">{mcpUrl}</span>
          <CopyButton text={mcpUrl} />
        </div>
      )}
      <button className="btn btn-primary mt-5 h-11 px-5 text-[15px]" onClick={run} disabled={busy || !buyer}>
        <Play size={16} fill="currentColor" />
        {busy ? "Starting agent…" : buyer ? `Run the demo agent as ${buyer.name}` : "Run the demo agent"}
      </button>
      <div className="mt-2.5 text-[13px] text-dim">Asks for “{DEMO_NEED}” with a $250 budget</div>
      <div className="mt-10 grid w-full max-w-[860px] grid-cols-1 gap-3 text-left sm:grid-cols-3">
        {[
          { icon: Gavel, t: "One call, a live auction", d: "find_offers opens a short auction and merchants race to bid." },
          { icon: BadgeCheck, t: "Every bid verified", d: "We fetch the storefront and the real checkout total. Drip pricing gets caught." },
          { icon: Scale, t: "Merit, not money", d: "Price, specs, delivery, trust and returns. Fees only break ties." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-[14px] border border-line p-4">
            <Icon size={18} className="text-ink" />
            <div className="mt-2 text-[15px] font-semibold">{t}</div>
            <div className="mt-1 text-[13px] leading-[18px] text-muted">{d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
