import { motion } from "framer-motion";
import { MerchantAvatar } from "@/components/MerchantDot";
import { CardHeader } from "@/components/Section";
import { useLive } from "@/lib/store";
import { trustColor } from "@/lib/format";

export function TrustBoard({ onOpen, className = "" }: { onOpen: (id: string) => void; className?: string }) {
  const merchants = useLive((s) => s.merchants);
  const sorted = [...merchants].sort((a, b) => b.trust - a.trust || b.wins - a.wins || a.name.localeCompare(b.name));
  return (
    <section className={`card flex min-h-0 flex-col overflow-hidden ${className}`}>
      <CardHeader title="Merchant trust" subtitle={`${merchants.length} merchants`} right={<span className="text-[12px] text-dim">Lies · Wins</span>} />
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {sorted.map((m) => (
          <motion.button
            layout="position"
            key={m.id}
            onClick={() => onOpen(m.id)}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_30px_30px] items-center gap-x-3 px-5 py-1.5 text-left hover:bg-raised"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <MerchantAvatar name={m.name} color={m.color} size={24} />
              <span className="truncate text-[14px] font-medium text-ink">{m.name}</span>
              {m.kind !== "bot" && <span className={`shrink-0 text-[12px] font-medium ${m.kind === "human" ? "text-accent" : "text-agent"}`}>{m.kind === "human" ? "Human" : "Agent"}</span>}
            </span>
            <span className="flex items-center gap-2.5">
              <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: trustColor(m.trust) }}
                  initial={false}
                  animate={{ width: `${Math.max(2, Math.min(100, m.trust))}%` }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                />
              </span>
              <span className="tnum w-7 text-right text-[14px] font-semibold" style={{ color: trustColor(m.trust) }}>
                {Math.round(m.trust)}
              </span>
            </span>
            <span className={`tnum text-right text-[14px] ${m.lies_caught ? "font-semibold text-lie" : "text-dim"}`}>{m.lies_caught}</span>
            <span className={`tnum text-right text-[14px] ${m.wins ? "font-semibold text-ink" : "text-dim"}`}>{m.wins}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
