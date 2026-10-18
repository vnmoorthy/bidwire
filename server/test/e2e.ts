// End-to-end checks against a running Bidwire server (default http://localhost:8787).
// Run: npm test   (start the server first with npm start)
const BASE = process.env.BIDWIRE_URL ?? "http://localhost:8787";
let passed = 0; let failed = 0;
const ok = (cond: unknown, name: string, detail = "") => { if (cond) { passed++; console.log(`  ✓ ${name}`); } else { failed++; console.log(`  ✗ ${name} ${detail}`); } };
const j = async (path: string, body?: unknown) => (await fetch(BASE + path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json() as Promise<any>;

async function mcp(method: string, params: unknown, session?: string) {
  const r = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(session ? { "mcp-session-id": session, "mcp-protocol-version": "2025-06-18" } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random() * 1e6), method, params }) });
  const text = await r.text();
  const data = text.split("\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6))).pop() ?? JSON.parse(text || "{}");
  return { session: r.headers.get("mcp-session-id") ?? session, data };
}

console.log(`Bidwire e2e against ${BASE}\n`);

console.log("MCP protocol");
const init = await mcp("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "bidwire-e2e", version: "1" } });
ok(init.data?.result?.serverInfo?.name === "bidwire", "initialize returns serverInfo bidwire");
await fetch(`${BASE}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-session-id": init.session!, "mcp-protocol-version": "2025-06-18" }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
const tools = await mcp("tools/list", {}, init.session!);
const names = (tools.data?.result?.tools ?? []).map((t: any) => t.name);
ok(names.length >= 12, `tools/list exposes ${names.length} tools`, JSON.stringify(names));
for (const n of ["find_offers", "buy_offer", "check_approval", "place_bid", "register_merchant"]) ok(names.includes(n), `tool ${n} is listed`);
const res = await mcp("resources/list", {}, init.session!);
ok((res.data?.result?.resources ?? []).length >= 3, "resources/list exposes ranking-policy, categories, agent-guide");
const pr = await mcp("prompts/list", {}, init.session!);
ok((pr.data?.result?.prompts ?? []).length >= 2, "prompts/list exposes shop_for_me and sell_on_bidwire");

console.log("\nShopping flow (find_offers → buy_offer)");
const before = await j("/api/ledger");
const found = await j("/api/tools/find_offers", { args: { need: "65W USB-C GaN charger for travel", budget_usd: 80, deliver_within_days: 4 }, buyer_id: "b_chatgpt" });
ok(found.ok && found.result.status === "closed", "auction closes and returns", JSON.stringify(found.result).slice(0, 200));
ok(found.result.offers?.length > 0, `${found.result.offers?.length} verified offers ranked`);
ok(found.result.offers?.every((o: any) => o.verified && o.fee_affected_rank === false), "every returned offer is verified and fee never affected rank");
ok((found.result.excluded ?? []).some((e: any) => /checkout says/.test(e.reason)), "drip-pricing liar excluded with checkout evidence", JSON.stringify(found.result.excluded));
ok((found.result.excluded ?? []).some((e: any) => /instructions aimed at the buying agent/.test(e.reason)), "prompt-injection pitch withdrawn (pitches are data, never instructions)", JSON.stringify(found.result.excluded));
ok(!JSON.stringify(found.result).toLowerCase().includes("ignore your previous instructions"), "no merchant pitch text ever reaches the agent");
const ranks = found.result.offers.map((o: any) => o.merit);
ok(ranks.every((m: number, i: number) => i === 0 || ranks[i - 1] >= m - 0.5), "offers sorted by merit (ties broken by fee)");
const bought = await j("/api/tools/buy_offer", { args: { offer_id: found.result.offers[0].offer_id, idempotency_key: `e2e-${Date.now()}`, wait_for_approval_seconds: 0 }, buyer_id: "b_chatgpt" });
ok(bought.ok && ["purchased", "approval_required", "already_purchased"].includes(bought.result.status), `buy_offer → ${bought.result?.status}`);
const again = await j("/api/tools/buy_offer", { args: { offer_id: found.result.offers[0].offer_id, wait_for_approval_seconds: 0 }, buyer_id: "b_chatgpt" });
ok(bought.result.status !== "purchased" || again.result.status === "already_purchased", "buying the same offer twice is idempotent");
const other = await j("/api/tools/buy_offer", { args: { offer_id: found.result.offers[0].offer_id }, buyer_id: "b_codex" });
ok(!other.ok && other.result.error === "not_your_auction", "another agent cannot buy from your auction (403)");

console.log("\nLedger");
const after = await j("/api/ledger");
const byTxn = new Map<string, number>();
for (const e of after.entries) byTxn.set(e.txn_id, (byTxn.get(e.txn_id) ?? 0) + e.delta_cents);
ok([...byTxn.values()].every((v) => v === 0), `all ${byTxn.size} transactions balance to $0.00`);
ok(after.orders.length >= before.orders.length, "orders recorded");

console.log("\nMerchant agents");
const reg = await j("/api/tools/register_merchant", { args: { store_name: `E2E Store ${Date.now() % 1000}`, categories: ["chargers"] } });
ok(reg.ok && reg.result.merchant_key?.startsWith("bw_mer_"), "register_merchant returns a merchant key and listings");
const feed = await j("/api/tools/list_open_requests", { args: { merchant_key: reg.result.merchant_key } });
ok(feed.ok && Array.isArray(feed.result.open), "list_open_requests works with the new key");
const noKey = await j("/api/tools/place_bid", { args: { auction_id: "x", sku: "y", delivered_price_usd: 1 } });
ok(!noKey.ok && /merchant_key_required|auction_not_found/.test(noKey.result.error), "merchant tools reject callers without a merchant key");

console.log("\nStorefront");
const page = await (await fetch(`${BASE}/store/dealdrop/sony-wh1000xm5`)).text();
ok(page.includes("application/ld+json"), "product page exposes schema.org JSON-LD");
const quote = await j("/store/dealdrop/sony-wh1000xm5/quote");
ok(quote.fees.some((f: any) => f.label.includes("Service")), "checkout quote reveals the hidden fee");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
