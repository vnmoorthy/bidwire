import { useState } from "react";
import { motion } from "framer-motion";
import type { Merchant } from "@shared/types";
import { PaddleChip } from "@/components/MerchantDot";
import { useLive } from "@/lib/store";

const CAP = 8;
const COLS = "grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_40px_40px]";

/** Merchant standing: every merchant (bots, people in the room, merchant agents) by trust, as thin gold bars. */
export function TrustBoard({ onOpen, className = "" }: { onOpen: (id: string) => void; className?: string }) {
  const merchants = useLive((s) => s.merchants);
  const [all, setAll] = useState(false);
  const sorted = [...merchants].sort((a, b) => b.trust - a.trust || b.wins - a.wins || a.name.localeCompare(b.name));
  const shown = all ? sorted : sorted.slice(0, CAP);
  const hidden = sorted.slice(CAP);
  const hiddenRoom = hidden.filter((m) => m.kind === "human").length;
  const hiddenAgents = hidden.filter((m) => m.kind === "agent").length;
  const room = merchants.filter((m) => m.kind === "human").length;
  const agents = merchants.filter((m) => m.kind === "agent").length;

  return (
    <section className={`card flex min-h-0 flex-col overflow-hidden ${className}`}>
      <div className="flex items-baseline gap-2 border-b border-line px-5 py-3">
        <h2 className="serif text-[24px] leading-7">Merchant standing</h2>
        <span className="truncate text-[13px] text-muted">
          {merchants.length} paddles
          {room > 0 ? ` · ${room} in the room` : ""}
          {agents > 0 ? ` · ${agents} agent${agents === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      <div className={`grid ${COLS} items-center gap-x-3 px-5 pt-2 smallcaps`}>
        <span>Paddle</span>
        <span>Standing</span>
        <span className="text-right" title="Bids withdrawn (lies, prompt injection)">Lies</span>
        <span className="text-right" title="Lots sold">Sold</span>
      </div>
      <div className={`min-h-0 flex-1 pb-1 ${all ? "max-h-[360px] overflow-y-auto" : ""}`}>
        {shown.map((m) => (
          <Row key={m.id} m={m} onOpen={onOpen} />
        ))}
      </div>
      {hidden.length > 0 && (
        <button onClick={() => setAll((v) => !v)} className="border-t border-line px-5 py-2 text-left text-[13px] text-muted hover:bg-raised/60 hover:text-ink">
          {all ? (
            "Show top 8"
          ) : (
            <>
              +{hidden.length} more
              {hiddenRoom > 0 ? ` · ${hiddenRoom} in the room` : ""}
              {hiddenAgents > 0 ? ` · ${hiddenAgents} agent${hiddenAgents === 1 ? "" : "s"}` : ""}
            </>
          )}
        </button>
      )}
    </section>
  );
}

function Row({ m, onOpen }: { m: Merchant; onOpen: (id: string) => void }) {
  const low = m.trust < 45;
  return (
    <motion.button
      layout="position"
      onClick={() => onOpen(m.id)}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`grid w-full ${COLS} items-center gap-x-3 px-5 py-[5px] text-left hover:bg-raised/60`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <PaddleChip id={m.id} color={m.color} size="sm" />
        <span className="truncate text-[14px] font-medium text-ink" title={m.name}>
          {m.name}
        </span>
        {m.kind === "human" && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold leading-[18px] text-[#7d5f30]">Room</span>}
        {m.kind === "agent" && <span className="shrink-0 rounded-full bg-agent-soft px-1.5 text-[11px] font-semibold leading-[18px] text-agent">Agent</span>}
      </span>
      <span className="flex items-center gap-2.5">
        <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-line">
          <motion.span
            className={`absolute inset-y-0 left-0 rounded-full ${low ? "bg-lie" : "bg-accent"}`}
            initial={false}
            animate={{ width: `${Math.max(2, Math.min(100, m.trust))}%` }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          />
        </span>
        <span className={`serif tnum w-7 text-right text-[18px] leading-none ${low ? "text-lie" : "text-ink"}`}>{Math.round(m.trust)}</span>
      </span>
      <span className={`tnum text-right text-[14px] ${m.lies_caught ? "font-semibold text-lie" : "text-dim"}`}>{m.lies_caught}</span>
      <span className={`tnum text-right text-[14px] ${m.wins ? "font-semibold text-ink" : "text-dim"}`}>{m.wins}</span>
    </motion.button>
  );
}
