import { hexA, initials, shade } from "@/lib/format";

export function MerchantDot({ color, size = 8, className = "" }: { color: string; size?: number; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ background: color, width: size, height: size }} />;
}

/** 28px circle with the merchant's initials on a soft tint of its color. */
export function MerchantAvatar({ name, color, size = 28, className = "" }: { name: string; color: string; size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
      style={{ width: size, height: size, background: hexA(color, 0.16), color: shade(color, -0.45), fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Stable 3-digit paddle number derived from the merchant id. */
export function paddleNo(id: string | null | undefined): number {
  let h = 2166136261;
  for (const c of id ?? "") h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return 100 + (Math.abs(h) % 900);
}

/** A rounded tag with the merchant's paddle number in its color. */
export function PaddleChip({ id, color, size = "md", className = "" }: { id: string; color: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = size === "lg" ? "h-9 min-w-[52px] text-[17px]" : size === "sm" ? "h-5 min-w-[34px] text-[11.5px]" : "h-7 min-w-[44px] text-[14px]";
  return (
    <span
      className={`tnum inline-flex shrink-0 items-center justify-center rounded-[5px] border px-1.5 font-semibold ${s} ${className}`}
      style={{ color: shade(color, -0.42), borderColor: hexA(color, 0.55), background: hexA(color, 0.13) }}
      title={`Paddle ${paddleNo(id)}`}
    >
      {paddleNo(id)}
    </span>
  );
}
