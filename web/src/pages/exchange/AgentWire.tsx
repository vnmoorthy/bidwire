import { AnimatePresence, motion } from "framer-motion";
import { Terminal } from "lucide-react";
import { ClientBadge } from "@/components/ClientBadge";
import { CardHeader, Empty } from "@/components/Section";
import { useLive } from "@/lib/store";
import { clock, compact } from "@/lib/format";

/** Agent activity: every MCP tool call, newest first. */
export function AgentWire({ limit = 30 }: { limit?: number }) {
  const calls = useLive((s) => s.toolCalls);
  const total = useLive((s) => s.stats.tool_calls);
  const list = calls.slice(0, limit);
  return (
    <section className="card flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader title="Agent activity" subtitle="MCP tool calls" right={<span className="tnum text-[13px] text-muted">{total.toLocaleString()} total</span>} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <Empty icon={<Terminal size={20} />} title="No agent has called Bidwire yet">
            Every MCP tool call from Claude, ChatGPT, Codex and others shows up here.
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
                  className="border-b border-line px-5 py-3 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <ClientBadge client={t.client} size="sm" />
                    <span className="truncate text-[14px] font-medium text-ink">{t.caller}</span>
                    <span className="tnum ml-auto shrink-0 text-[12px] text-dim">{clock(t.ts)}</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className={`shrink-0 font-mono text-[13px] font-medium ${t.ok ? "text-ink" : "text-lie"}`}>{t.tool}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-muted" title={t.summary}>
                      {t.summary}
                    </span>
                  </div>
                  <div className="tnum mt-0.5 flex gap-3 text-[12px] text-dim">
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
