import type { Stats } from "@shared/types";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useLive } from "@/lib/store";
import { money } from "@/lib/format";

const STATS: { key: keyof Stats; label: string; color?: string; money?: boolean }[] = [
  { key: "agents_seen", label: "Agents seen" },
  { key: "auctions", label: "Auctions" },
  { key: "bids", label: "Bids" },
  { key: "lies_caught", label: "Lies caught", color: "text-lie" },
  { key: "bribes_ignored", label: "Bribes ignored", color: "text-fee" },
  { key: "orders", label: "Orders" },
  { key: "gmv_cents", label: "GMV", color: "text-money", money: true },
  { key: "platform_fees_cents", label: "Platform fees", money: true },
];

/** One KPI card; tiles separated by vertical dividers. */
export function StatsStrip() {
  const stats = useLive((s) => s.stats);
  return (
    <section className="card shrink-0 overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4 xl:grid-cols-8">
        {STATS.map(({ key, label, color, money: isMoney }) => (
          <div key={key} className="min-w-0 bg-panel px-5 py-3.5">
            <div className="truncate text-[13px] text-muted">{label}</div>
            <div className={`mt-1 truncate text-[28px] font-semibold leading-8 tracking-[-0.01em] ${color ?? "text-ink"}`}>
              <AnimatedNumber value={(stats?.[key] as number) ?? 0} format={isMoney ? (n) => money(Math.round(n)) : undefined} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
