import { motion } from "framer-motion";
import { Check, LoaderCircle, ShieldAlert } from "lucide-react";
import type { Bid, BidVerifyStatus } from "@shared/types";
import { withdrawal } from "@/lib/lot";

const SIZES = {
  sm: "h-6 px-2 text-[12px] gap-1",
  md: "h-7 px-2.5 text-[12.5px] gap-1.5",
  lg: "h-9 px-3.5 text-[15px] gap-1.5",
};
type Size = keyof typeof SIZES;

/** Status: Checking… (dim) → Verified (green soft) or Withdrawn: misrepresentation (oxblood soft, scales 1.08 → 1). */
export function VerifyStamp({
  status,
  size = "md",
  lieLabel = "Withdrawn: misrepresentation",
  okLabel = "Verified",
}: {
  status: BidVerifyStatus;
  size?: Size;
  lieLabel?: string;
  okLabel?: string;
}) {
  const icon = size === "lg" ? 16 : 13;
  if (status === "pending") {
    return (
      <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-medium text-dim ${SIZES[size]}`}>
        <LoaderCircle size={icon} className="animate-spin" />
        Checking…
      </span>
    );
  }
  const ok = status === "verified";
  return (
    <motion.span
      key={status}
      initial={ok ? { opacity: 0, scale: 0.96 } : { opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold ${SIZES[size]} ${ok ? "bg-money-soft text-money" : "bg-lie-soft text-lie"}`}
    >
      {ok && <Check size={icon} strokeWidth={3} />}
      {ok ? okLabel : lieLabel}
    </motion.span>
  );
}

/** Oxblood (filled) variant for a pitch that tried to instruct the buying agent. */
export function BlockedBadge({ size = "md", label = "Prompt injection blocked" }: { size?: Size; label?: string }) {
  const icon = size === "lg" ? 16 : 13;
  return (
    <motion.span
      initial={{ opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-lie font-semibold text-[#FFFDF7] ${SIZES[size]}`}
    >
      <ShieldAlert size={icon} strokeWidth={2.4} />
      {label}
    </motion.span>
  );
}

/**
 * The right status for a bid: Checking… / Verified / Withdrawn: misrepresentation / Prompt injection blocked.
 * `short` uses one-word labels for tight mobile rows.
 */
export function BidStamp({ b, size = "md", short = false }: { b: Bid; size?: Size; short?: boolean }) {
  const w = withdrawal(b);
  if (w?.kind === "injection") return <BlockedBadge size={size} label={short ? "Blocked" : w.label} />;
  return <VerifyStamp status={b.verify_status} size={size} lieLabel={short ? "Withdrawn" : w?.label ?? "Withdrawn: misrepresentation"} />;
}

/** Green "Sold": the agent actually bought this paddle (an order exists). */
export function SoldBadge({ size = "md", className = "" }: { size?: Size; className?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-money font-semibold text-[#FFFDF7] ${SIZES[size]} ${className}`}
    >
      Sold
    </motion.span>
  );
}

/** Gold "Hammer" badge: No. 1 verified paddle at close. */
export function PickBadge({ className = "", label = "Hammer", size = "md" }: { className?: string; label?: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-accent-soft font-semibold text-[#7d5f30] ${size === "sm" ? "h-5 px-2 text-[11.5px]" : "h-6 px-2.5 text-[12px]"} ${className}`}
    >
      {label}
    </span>
  );
}

export function BribeBadge({ className = "", label = "Bribe ignored" }: { className?: string; label?: string }) {
  return <span className={`inline-flex h-5 shrink-0 items-center rounded-full bg-fee-soft px-2 text-[11.5px] font-semibold text-fee ${className}`}>{label}</span>;
}
