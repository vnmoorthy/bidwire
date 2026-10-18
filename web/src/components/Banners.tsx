import { AnimatePresence, motion } from "framer-motion";
import { Gavel, ShieldAlert, X } from "lucide-react";
import { dismissBanner, useFx } from "@/lib/fx";

/** Paper banners sliding from the top: Bid withdrawn (oxblood edge) and Bribe ignored (bronze edge). */
export function Banners({ top = 60 }: { top?: number }) {
  const banners = useFx((s) => s.banners);
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[55] flex flex-col items-center gap-2 px-4 pt-3" style={{ top }}>
      <AnimatePresence initial={false}>
        {banners.map((b) => {
          const lie = b.kind === "lie";
          const Icon = lie ? ShieldAlert : Gavel;
          return (
            <motion.div
              key={b.id}
              layout
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className={`pointer-events-auto relative flex w-full max-w-[1080px] items-start gap-4 overflow-hidden rounded-[6px] border border-line bg-panel py-4 pl-6 pr-5 shadow-[0_18px_40px_rgba(22,19,14,0.12)]`}
            >
              <span className={`absolute inset-y-0 left-0 w-[5px] ${lie ? "bg-lie" : "bg-fee"}`} />
              <Icon size={22} className={`mt-1 shrink-0 ${lie ? "text-lie" : "text-fee"}`} />
              <div className="min-w-0 flex-1">
                <div className={`serif text-[26px] leading-8 ${lie ? "text-lie" : "text-fee"}`}>{b.title}</div>
                {b.sub && <div className="mt-0.5 text-[15px] leading-6 text-ink/80">{b.sub}</div>}
              </div>
              <button className="mt-1 text-muted hover:text-ink" onClick={() => dismissBanner(b.id)} aria-label="Dismiss">
                <X size={16} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
