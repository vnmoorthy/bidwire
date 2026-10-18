import { motion } from "framer-motion";
import { PaddleChip } from "@/components/MerchantDot";
import { useLive } from "@/lib/store";

/** Merchant standing: trust as a thin gold bar. */
export function TrustBoard({ onOpen, className = "" }: { onOpen: (id: string) => void; className?: string }) {
  const merchants = useLive((s) => s.merchants);
  const sorted = [...merchants].sort((a, b) => b.trust - a.trust || b.wins - a.wins || a.name.localeCompare(b.name));
  return (
    <section className={`card flex min-h-0 flex-col overflow-hidden ${className}`}>
      <div className="flex items-baseline gap-2 border-b border-line px-5 py-3">
        <h2 className="serif text-[24px] leading-7">Merchant standing</h2>
        <span className="text-[13px] text-muted">Trust, withdrawn bids, hammers</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_40px_40px] items-center gap-x-3 px-5 pt-2 smallcaps">
        <span>Paddle</span>
        <span>Standing</span>
        <span className="text-right" title="Bids withdrawn for misrepresentation">Lies</span>
        <span className="text-right" title="Lots won at the hammer">Won</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-1.5">
        {sorted.map((m) => (
          <motion.button
            layout="position"
            key={m.id}
            onClick={() => onOpen(m.id)}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_40px_40px] items-center gap-x-3 px-5 py-1.5 text-left hover:bg-raised/60"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <PaddleChip id={m.id} color={m.color} size="sm" />
              <span className="truncate text-[14px] font-medium text-ink">{m.name}</span>
              {m.kind === "human" && <span className="shrink-0 text-[12px] text-[#7d5f30]">In the room</span>}
            </span>
            <span className="flex items-center gap-2.5">
              <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-line">
                <motion.span
                  className={`absolute inset-y-0 left-0 rounded-full ${m.trust >= 45 ? "bg-accent" : "bg-lie"}`}
                  initial={false}
                  animate={{ width: `${Math.max(2, Math.min(100, m.trust))}%` }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                />
              </span>
              <span className={`serif tnum w-7 text-right text-[18px] leading-none ${m.trust >= 45 ? "text-ink" : "text-lie"}`}>{Math.round(m.trust)}</span>
            </span>
            <span className={`tnum text-right text-[14px] ${m.lies_caught ? "font-semibold text-lie" : "text-dim"}`}>{m.lies_caught}</span>
            <span className={`tnum text-right text-[14px] ${m.wins ? "font-semibold text-ink" : "text-dim"}`}>{m.wins}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
