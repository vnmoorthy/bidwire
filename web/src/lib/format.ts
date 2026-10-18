import type { Bid, Listing } from "@shared/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Integer cents -> "$1,234.56" */
export function money(cents: number | null | undefined): string {
  const c = typeof cents === "number" && Number.isFinite(cents) ? cents : 0;
  return usd.format(c / 100);
}

/** Integer cents -> "$1,234" when whole dollars, else "$1,234.56" */
export function moneySmart(cents: number | null | undefined): string {
  const c = typeof cents === "number" && Number.isFinite(cents) ? cents : 0;
  return Math.round(c) % 100 === 0 ? usd0.format(c / 100) : usd.format(c / 100);
}

export function int(n: number | null | undefined): string {
  return Math.round(n ?? 0).toLocaleString("en-US");
}

export function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "k";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(Math.round(n));
}

export function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** What the merchant claimed the delivered total is. */
export function claimedTotal(b: Bid): number {
  if (b.evidence && typeof b.evidence.claimed_total_cents === "number") return b.evidence.claimed_total_cents;
  return (b.claimed_price_cents ?? 0) + (b.claimed_shipping_cents ?? 0);
}

/** The real checkout total for a listing (price + shipping + fees revealed at checkout). */
export function listingTotal(l: Pick<Listing, "price_cents" | "shipping_cents" | "hidden_fee_cents">): number {
  return (l.price_cents ?? 0) + (l.shipping_cents ?? 0) + (l.hidden_fee_cents ?? 0);
}

/** "#3DD9EB" + 0.2 -> "rgba(61,217,235,0.2)". Non-hex colors are returned unchanged. */
export function hexA(color: string | null | undefined, alpha: number): string {
  if (!color) return `rgba(138,150,166,${alpha})`;
  let h = color.trim();
  if (!h.startsWith("#")) return h;
  h = h.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return color;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return color;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function titleCase(s: string): string {
  return s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function trustColor(t: number): string {
  if (t >= 70) return "#12805C";
  if (t >= 45) return "#A15C07";
  return "#D93036";
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Darken (amount<0) or lighten (amount>0) a hex color by mixing with black/white. */
export function shade(color: string | null | undefined, amount: number): string {
  if (!color || !color.startsWith("#")) return color ?? "#5D5D66";
  let h = color.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return color;
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `rgb(${r},${g},${b})`;
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "?").replace(/[^\p{L}\p{N}\s&]/gu, " ").split(/\s+/).filter((w) => w && w !== "&");
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function days(n: number | null | undefined): string {
  if (n == null) return "any time";
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** Sequential lot number: the newest auction is lot `total`, the one before it `total - 1`, … */
export function lotNumber(auctions: { id: string }[], total: number, id: string): number {
  const i = auctions.findIndex((a) => a.id === id);
  const n = Math.max(total, auctions.length);
  return i >= 0 ? Math.max(1, n - i) : n;
}

export function lotLabel(n: number): string {
  return `Lot ${String(n).padStart(2, "0")}`;
}
