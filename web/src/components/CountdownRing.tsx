import { Check, LoaderCircle } from "lucide-react";
import type { AuctionStatus } from "@shared/types";
import { useNow } from "@/lib/store";

/** Thin circular progress plus seconds remaining. */
export function CountdownRing({
  openedAt,
  closesAt,
  status,
  size = 56,
  stroke = 3,
}: {
  openedAt: number;
  closesAt: number;
  status: AuctionStatus;
  size?: number;
  stroke?: number;
}) {
  const now = useNow(100);
  const total = Math.max(1, closesAt - openedAt);
  const remaining = Math.max(0, closesAt - now);
  const open = status === "open";
  const pct = open ? remaining / total : 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = open ? "var(--accent)" : status === "closed" ? "var(--money)" : "var(--muted)";
  const secs = Math.ceil(remaining / 1000);
  const big = size >= 64;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={open ? `${secs}s left to bid` : status}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2D9C6" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 120ms linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {open ? (
          <span className={`tnum font-semibold leading-none text-ink ${big ? "text-[24px]" : "text-[15px]"}`}>
            {secs}
            <span className={`font-medium text-muted ${big ? "text-[13px]" : "text-[10px]"}`}>s</span>
          </span>
        ) : status === "verifying" ? (
          <LoaderCircle size={big ? 22 : 15} className="animate-spin text-muted" />
        ) : (
          <Check size={big ? 22 : 15} className="text-money" strokeWidth={2.6} />
        )}
      </div>
    </div>
  );
}
