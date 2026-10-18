import { motion } from "framer-motion";
import { Check, LoaderCircle } from "lucide-react";
import type { BidVerifyStatus } from "@shared/types";

const SIZES = {
  sm: "h-6 px-2 text-[12px] gap-1",
  md: "h-7 px-2.5 text-[12.5px] gap-1.5",
  lg: "h-9 px-3.5 text-[15px] gap-1.5",
};

/** Status: Checking… (dim) → Verified (green soft) or Withdrawn: misrepresentation (oxblood soft, scales 1.08 → 1). */
export function VerifyStamp({
  status,
  size = "md",
  lieLabel = "Withdrawn: misrepresentation",
  okLabel = "Verified",
}: {
  status: BidVerifyStatus;
  size?: keyof typeof SIZES;
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

/** Gold "Hammer" badge for the winning paddle. */
export function PickBadge({ className = "", label = "Hammer" }: { className?: string; label?: string }) {
  return <span className={`inline-flex h-6 shrink-0 items-center rounded-full bg-accent-soft px-2.5 text-[12px] font-semibold text-[#7d5f30] ${className}`}>{label}</span>;
}

export function BribeBadge({ className = "", label = "Bribe ignored" }: { className?: string; label?: string }) {
  return <span className={`inline-flex h-5 shrink-0 items-center rounded-full bg-fee-soft px-2 text-[11.5px] font-semibold text-fee ${className}`}>{label}</span>;
}
