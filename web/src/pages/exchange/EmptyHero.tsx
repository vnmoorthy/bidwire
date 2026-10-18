import { useState } from "react";
import { Gavel, Play } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { api, errMsg } from "@/lib/api";
import { toast, toastError } from "@/lib/fx";
import { useLive } from "@/lib/store";

export const DEMO_NEED = "noise cancelling headphones for flights";

/** Idle saleroom: the board waits for the first lot. */
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <section className="relative overflow-hidden rounded-[10px] bg-board px-10 py-12 text-board-text">
        <div className="pointer-events-none absolute inset-[6px] rounded-[6px] border border-[rgba(176,137,79,0.42)]" />
        <div className="relative flex flex-col items-center text-center">
          <div className="smallcaps text-[#b9a47c]">Lot — · The saleroom is open</div>
          <div className="mt-5 flex size-16 items-center justify-center rounded-full border border-[rgba(233,180,76,0.45)]">
            <Gavel size={30} className="text-board-amber" strokeWidth={1.6} />
          </div>
          <h1 className="serif mt-5 text-[52px] italic leading-[56px]">Waiting for an agent to shop</h1>
          <p className="mt-3 max-w-[660px] text-[17px] leading-7 text-[#cfc3aa]">
            When Claude, ChatGPT or Codex needs to buy something, it calls <span className="font-mono text-[15px] text-board-text">find_offers</span> once. Merchants raise
            paddles, every claim is checked against the real checkout, and the lot goes on merit.
          </p>
          {mcpUrl && (
            <div className="mt-7 flex max-w-full items-center gap-3 rounded-full border border-[rgba(243,233,210,0.18)] py-1.5 pl-5 pr-1.5">
              <span className="smallcaps text-[#b9a47c]">MCP</span>
              <span className="truncate font-mono text-[14px] text-board-text">{mcpUrl}</span>
              <CopyButton text={mcpUrl} />
            </div>
          )}
          <button
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border border-[rgba(233,180,76,0.6)] px-5 text-[15px] font-semibold text-board-amber transition-colors hover:bg-[rgba(233,180,76,0.12)] disabled:opacity-50"
            onClick={run}
            disabled={busy || !buyer}
          >
            <Play size={15} fill="currentColor" />
            {busy ? "Starting the agent…" : buyer ? `Run the demo agent as ${buyer.name}` : "Run the demo agent"}
          </button>
          <div className="mt-2.5 text-[13px] text-[#8d826c]">Asks for “{DEMO_NEED}” with a $250 budget</div>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { n: "I", t: "One call opens a lot", d: "find_offers starts a short live auction and merchants race to raise a paddle." },
          { n: "II", t: "Every claim is checked", d: "We fetch the storefront and the real checkout total. Misrepresented bids are withdrawn." },
          { n: "III", t: "The hammer falls on merit", d: "Price, specs, delivery, trust and returns. Commission only breaks ties." },
        ].map(({ n, t, d }) => (
          <div key={t} className="card p-5">
            <div className="serif text-[22px] italic text-[#9c7d4b]">{n}</div>
            <div className="mt-1 text-[16px] font-semibold">{t}</div>
            <div className="mt-1 text-[14px] leading-[20px] text-muted">{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
