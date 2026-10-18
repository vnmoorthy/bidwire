import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Ban, CircleAlert, Gavel, Info, MessageSquareText, Store, X } from "lucide-react";
import { dismissToast, useFx, type ToastKind } from "@/lib/fx";
import { money } from "@/lib/format";

const STYLE: Record<ToastKind, { icon: typeof Info; tint: string }> = {
  sold: { icon: Gavel, tint: "bg-accent-soft text-[#7d5f30]" },
  approval: { icon: MessageSquareText, tint: "bg-agent-soft text-agent" },
  approved: { icon: BadgeCheck, tint: "bg-money-soft text-money" },
  denied: { icon: Ban, tint: "bg-lie-soft text-lie" },
  fail: { icon: CircleAlert, tint: "bg-lie-soft text-lie" },
  error: { icon: CircleAlert, tint: "bg-lie-soft text-lie" },
  merchant: { icon: Store, tint: "bg-accent-soft text-accent" },
  info: { icon: Info, tint: "bg-raised text-muted" },
  success: { icon: BadgeCheck, tint: "bg-money-soft text-money" },
};

export function Toasts({ bottom = 20 }: { bottom?: number }) {
  const toasts = useFx((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-5 z-[60] flex w-[min(400px,calc(100vw-2.5rem))] flex-col gap-2.5" style={{ bottom }}>
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const st = STYLE[t.kind] ?? STYLE.info;
          const Icon = st.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-[6px] border bg-panel px-4 py-3.5 shadow-[0_18px_40px_rgba(22,19,14,0.12)] ${t.kind === "sold" ? "border-accent" : "border-line"}`}
            >
              <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${st.tint}`}>
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={t.kind === "sold" ? "serif text-[21px] leading-7 text-ink" : "text-[15px] font-semibold text-ink"}>{t.title}</span>
                  {typeof t.amount === "number" && <span className="serif tnum text-[21px] leading-7 text-[#7d5f30]">{money(t.amount)}</span>}
                </div>
                {t.body && <div className="mt-0.5 text-[13px] leading-[18px] text-muted">{t.body}</div>}
                {typeof t.fee === "number" && (
                  <div className="mt-1 text-[13px] text-muted">
                    Commission <span className="tnum font-semibold text-fee">{money(t.fee)}</span> paid by the merchant
                  </div>
                )}
              </div>
              <button className="text-dim hover:text-ink" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
