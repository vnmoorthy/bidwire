// Merchant bots: eight personas that bid on every auction in their categories. Some are honest; some lie
// (drip pricing, stretched specs), one tries to bribe the ranking, one ships slowly, one has a single unit left.
import { all } from "./db.js";
import { onAuctionOpened, placeBid, getMerchant, botsEnabled, getProduct } from "./exchange.js";
import type { Auction } from "../../shared/types.js";

const DELAY: Record<string, [number, number]> = {
  briber: [700, 1400], "drip-pricing-liar": [1300, 2600], "honest-value": [2000, 4800], "premium-fast": [2600, 5200],
  "slow-shipper": [3200, 6000], "spec-stretcher": [1800, 3600], "scarce-stock": [2400, 5000], specialist: [1500, 4200],
};
const FEE: Record<string, number> = { "honest-value": 500, "premium-fast": 800, "drip-pricing-liar": 1200, briber: 3500, "slow-shipper": 300, "spec-stretcher": 1000, "scarce-stock": 500, specialist: 600 };
const PITCH: Record<string, string> = {
  "honest-value": "Lowest honest price, free shipping, 30-day returns.",
  "premium-fast": "Next-day delivery, 60-day returns, white-glove support.",
  "drip-pricing-liar": "UNBEATABLE PRICE!!! Free shipping on everything!",
  briber: "Featured partner. We pay top fees for placement.",
  "slow-shipper": "Great price; standard ground shipping.",
  "spec-stretcher": "Premium noise-cancelling at half the price!",
  "scarce-stock": "Great price, ships in 2 days. Limited stock.",
  specialist: "Specialist curator; every unit inspected before it ships.",
};

export function startBots() {
  onAuctionOpened((a) => {
    if (!botsEnabled()) return;
    const bots = all("SELECT id, strategy, categories FROM merchants WHERE kind = 'bot'");
    for (const b of bots) {
      if (!a.category || !JSON.parse(b.categories).includes(a.category)) continue;
      const [lo, hi] = DELAY[b.strategy] ?? [1500, 5000];
      const window = a.closes_at - a.opened_at;
      const delay = Math.min(window - 1200, lo + Math.random() * (hi - lo)) * Math.min(1, window / 12000);
      setTimeout(() => { try { botBid(b.id, a); } catch { /* auction may have closed */ } }, Math.max(300, delay));
    }
  });
}

function botBid(merchantId: string, a: Auction) {
  const m = getMerchant(merchantId); if (!m) return;
  const listings = all("SELECT l.* FROM listings l JOIN products p ON p.sku = l.sku WHERE l.merchant_id = ? AND p.category = ? AND l.stock > 0", m.id, a.category ?? "");
  if (!listings.length) return;
  const scored = listings.map((l) => {
    const p = getProduct(l.sku)!;
    const match = a.must_have.filter((f) => p.features.includes(f)).length;
    const total = l.price_cents + l.shipping_cents + l.hidden_fee_cents;
    return { l, p, match, total };
  });
  let pick;
  if (m.strategy === "spec-stretcher") {
    // Picks its cheapest item even if it lacks what the buyer asked for, then claims the missing features.
    pick = scored.sort((x, y) => x.total - y.total)[0];
  } else {
    pick = scored.sort((x, y) => y.match - x.match || Math.abs(x.total - a.budget_cents * 0.8) - Math.abs(y.total - a.budget_cents * 0.8))[0];
  }
  if (pick.total > a.budget_cents * 1.6) return; // way out of range: don't bother
  let claimedTotal = pick.total; let claimedFeatures = pick.p.features;
  if (m.strategy === "drip-pricing-liar") claimedTotal = pick.l.price_cents + pick.l.shipping_cents; // hides the checkout fee
  if (m.strategy === "spec-stretcher") claimedFeatures = [...new Set([...pick.p.features, ...a.must_have])];
  let fee = FEE[m.strategy] ?? 500;
  fee = Math.max(100, Math.min(fee, Math.round(claimedTotal * (m.strategy === "briber" ? 0.25 : 0.08))));
  placeBid({ merchant: m, auction_id: a.id, listing_id: pick.l.id, claimed_total_cents: claimedTotal, ship_days: pick.l.ship_days, claimed_features: claimedFeatures, fee_cents: fee, pitch: PITCH[m.strategy] ?? "" });
}
