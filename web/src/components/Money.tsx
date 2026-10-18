import { money, moneySmart } from "@/lib/format";

/** Integer cents rendered as $1,234.56 in Inter tabular figures. */
export function Money({
  cents,
  className = "",
  smart = false,
  sign = false,
}: {
  cents: number | null | undefined;
  className?: string;
  smart?: boolean;
  sign?: boolean;
}) {
  const c = cents ?? 0;
  const s = smart ? moneySmart(c) : money(c);
  return (
    <span className={`tnum ${className}`}>
      {sign && c > 0 ? "+" : ""}
      {s}
    </span>
  );
}
