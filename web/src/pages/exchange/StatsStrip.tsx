import type { Stats } from "@shared/types";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useLive } from "@/lib/store";
import { money } from "@/lib/format";

const STATS: { key: keyof Stats; label: string; hint: string; color?: string; money?: boolean }[] = [
  { key: "auctions", label: "Lots", hint: "Auctions agents opened" },
  { key: "bids", label: "Paddles raised", hint: "Merchant bids" },
  { key: "verified", label: "Verified", hint: "Bids that matched the real checkout", color: "text-money" },
  { key: "lies_caught", label: "Withdrawn (lies)", hint: "Bids caught misrepresenting", color: "text-lie" },
  { key: "bribes_ignored", label: "Bribes ignored", hint: "Higher fees that bought nothing", color: "text-fee" },
  { key: "orders", label: "Sold", hint: "Purchases completed" },
  { key: "gmv_cents", label: "Hammer total", hint: "GMV: what agents paid", money: true },
  { key: "platform_fees_cents", label: "Commission", hint: "Paid by merchants, only on a sale", money: true },
];

/** KPI strip: one paper card with hairline dividers, serif numerals. */
export function StatsStrip() {
  const stats = useLive((s) => s.stats);
  return (
    <section className="card shrink-0 overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4 xl:grid-cols-8">
        {STATS.map(({ key, label, hint, color, money: isMoney }) => (
          <div key={key} className="min-w-0 bg-panel px-5 py-3" title={hint}>
            <div className="truncate text-[13px] text-muted">{label}</div>
            <div className={`serif mt-0.5 truncate text-[30px] leading-[34px] ${color ?? "text-ink"}`}>
              <AnimatedNumber value={(stats?.[key] as number) ?? 0} format={isMoney ? (n) => money(Math.round(n)) : undefined} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
