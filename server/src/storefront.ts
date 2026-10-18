// Merchant storefronts: real, public product pages with schema.org JSON-LD and a checkout quote endpoint.
// The verifier reads these exactly like it would read any external store. The drip-pricing fee only appears at checkout.
import { get } from "./db.js";
import { getProduct, merchantByHandle, fmt } from "./exchange.js";

export function quote(handle: string, sku: string) {
  const m = merchantByHandle(handle); if (!m) return null;
  const l = get("SELECT * FROM listings WHERE merchant_id = ? AND sku = ?", m.id, sku); if (!l) return null;
  const fees = [{ label: "Shipping", cents: l.shipping_cents }];
  if (l.hidden_fee_cents > 0) fees.push({ label: l.hidden_fee_label ?? "Fee", cents: l.hidden_fee_cents });
  return { merchant: m.name, sku, price_cents: l.price_cents, shipping_cents: l.shipping_cents, fees, total_cents: l.price_cents + l.shipping_cents + l.hidden_fee_cents, ship_days: l.ship_days, in_stock: l.stock > 0, stock: l.stock, returns_days: l.returns_days };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function productPage(handle: string, sku: string): string | null {
  const m = merchantByHandle(handle); if (!m) return null;
  const l = get("SELECT * FROM listings WHERE merchant_id = ? AND sku = ?", m.id, sku); if (!l) return null;
  const p = getProduct(sku)!;
  const price = (l.price_cents / 100).toFixed(2);
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.title, sku: p.sku, brand: { "@type": "Brand", name: p.brand }, category: p.category,
    additionalProperty: p.features.map((f) => ({ "@type": "PropertyValue", name: "feature", value: f })),
    offers: {
      "@type": "Offer", price, priceCurrency: "USD", availability: l.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: m.name },
      shippingDetails: { "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: (l.shipping_cents / 100).toFixed(2), currency: "USD" },
        deliveryTime: { "@type": "ShippingDeliveryTime", transitTime: { "@type": "QuantitativeValue", minValue: l.ship_days, maxValue: l.ship_days, unitCode: "DAY" } } },
      hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", merchantReturnDays: l.returns_days },
    },
  };
  const specs = Object.entries(p.specs).map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, " "))}</td><td>${esc(String(v === true ? "Yes" : v === false ? "No" : v))}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)} · ${esc(m.name)}</title>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
:root{--c:${m.color}}*{box-sizing:border-box}body{margin:0;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;background:#f6f7f9;color:#14171c}
header{background:#fff;border-bottom:1px solid #e6e8ec;padding:14px 24px;display:flex;align-items:center;gap:10px}
.dot{width:14px;height:14px;border-radius:4px;background:var(--c)}header b{font-size:18px}header span{color:#6b7280;font-size:13px;margin-left:auto}
main{max-width:980px;margin:28px auto;padding:0 20px;display:grid;grid-template-columns:1.1fr 1fr;gap:28px}
.hero{background:#fff;border:1px solid #e6e8ec;border-radius:16px;display:grid;place-items:center;font-size:120px;min-height:340px}
h1{font-size:26px;line-height:1.2;margin:0 0 6px}.brand{color:#6b7280;margin-bottom:14px}.price{font-size:34px;font-weight:700;margin:6px 0}
.meta{color:#374151;font-size:14px;margin:4px 0}.feat{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}.feat span{background:#eef1f5;border-radius:999px;padding:3px 10px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:10px}td{border-top:1px solid #eceef2;padding:7px 0}td:first-child{color:#6b7280;text-transform:capitalize}
button{margin-top:16px;background:#14171c;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-size:15px;cursor:pointer}
#q{margin-top:14px;background:#fff;border:1px solid #e6e8ec;border-radius:12px;padding:12px 14px;display:none;font-size:14px}#q div{display:flex;justify-content:space-between;padding:3px 0}
#q .t{font-weight:700;border-top:1px solid #eceef2;margin-top:6px;padding-top:8px}.fine{color:#9ca3af;font-size:12px;margin-top:8px}
.stock{display:inline-block;font-size:12px;padding:2px 8px;border-radius:6px;background:${l.stock > 0 ? "#e7f8ef;color:#137a4b" : "#fdecec;color:#b42318"}}
@media(max-width:760px){main{grid-template-columns:1fr}}
</style></head><body>
<header><div class="dot"></div><b>${esc(m.name)}</b><span>Storefront · listed on the Bidwire exchange</span></header>
<main><div class="hero">${p.emoji}</div><div>
<h1>${esc(p.title)}</h1><div class="brand">${esc(p.brand)} · SKU ${esc(p.sku)}</div>
<div class="price">$${price}</div><span class="stock">${l.stock > 0 ? `In stock` : "Out of stock"}</span>
<div class="meta">Shipping: ${l.shipping_cents ? fmt(l.shipping_cents) : "Free"} · Arrives in ${l.ship_days} day${l.ship_days === 1 ? "" : "s"}</div>
<div class="meta">${l.returns_days}-day returns</div>
<div class="feat">${p.features.map((f) => `<span>${esc(f)}</span>`).join("")}</div>
<table>${specs}</table>
<button onclick="go()">Proceed to checkout</button>
<div id="q"></div>
${l.hidden_fee_cents ? `<div class="fine">Additional fees may apply at checkout.</div>` : ""}
</div></main>
<script>
async function go(){const r=await fetch(location.pathname+'/quote');const q=await r.json();const el=document.getElementById('q');
const f=c=>'$'+(c/100).toFixed(2);el.style.display='block';
el.innerHTML='<div><span>Item</span><span>'+f(q.price_cents)+'</span></div>'+q.fees.map(x=>'<div><span>'+x.label+'</span><span>'+f(x.cents)+'</span></div>').join('')+'<div class="t"><span>Total</span><span>'+f(q.total_cents)+'</span></div>';}
</script></body></html>`;
}
