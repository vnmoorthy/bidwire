import { AnimatePresence, motion } from "framer-motion";
import { Phone } from "lucide-react";
import { ClientBadge } from "@/components/ClientBadge";
import { Empty } from "@/components/Section";
import { useLive } from "@/lib/store";
import { clock, compact } from "@/lib/format";

/** Agent bidders: live MCP calls, styled like a saleroom phone-bank log. */
export function AgentWire({ limit = 30 }: { limit?: number }) {
  const calls = useLive((s) => s.toolCalls);
  const total = useLive((s) => s.stats.tool_calls);
  const list = calls.slice(0, limit);
  return (
    <section className="card flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-baseline gap-2 border-b border-line px-5 py-3">
        <h2 className="serif text-[24px] leading-7">Agent bidders</h2>
        <span className="text-[13px] text-muted">Live MCP calls</span>
        <span className="tnum ml-auto text-[13px] text-muted">{total.toLocaleString()} calls</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <Empty icon={<Phone size={20} />} title="The phone bank is quiet">
            Every MCP call from Claude, ChatGPT, Codex and others is logged here.
          </Empty>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {list.map((t) => (
                <motion.li
                  key={t.id}
                  layout="position"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="border-b border-line px-5 py-2.5 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="tnum w-[62px] shrink-0 text-[12px] text-dim">{clock(t.ts)}</span>
                    <ClientBadge client={t.client} size="sm" />
                    <span className="truncate text-[14px] font-medium text-ink">{t.caller}</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2 pl-[70px]">
                    <span className={`shrink-0 font-mono text-[13px] ${t.ok ? "text-ink" : "text-lie"}`}>{t.tool}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-muted" title={t.summary}>
                      {t.summary}
                    </span>
                  </div>
                  <div className="tnum mt-0.5 flex gap-3 pl-[70px] text-[12px] text-dim">
                    <span>{t.ms.toLocaleString()} ms</span>
                    <span>~{compact(t.tokens)} tokens</span>
                    {!t.ok && <span className="text-lie">error</span>}
                    <span className="ml-auto capitalize">{t.role}</span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}
