// HTTP API for the web app (live board, merchant phones, approver phone, ledger, playground, director),
// storefront pages, llms.txt and the static web build. Mounted as Hono middleware on the mcp-use server.
import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { extname, join, resolve } from "node:path";
import {
  BidwireError, snapshot, getAuction, merchantProfile, joinMerchant, getMerchant, merchantKey, placeBid, merchantFeed, listApprovals,
  decideApproval, ledgerView, setBots, setAuctionMs, buyerKey, getBuyer, simulateInbound, merchantByKey, fmt,
} from "./exchange.js";
import { sseResponse, emit } from "./bus.js";
import { seed } from "./catalog.js";
import { productPage, quote } from "./storefront.js";
import { callTool, toolMeta } from "./tools.js";
import { resolveCaller } from "./mcp.js";
import { runDemoAgent, SCENARIOS, runScenario } from "./agent.js";
import { config } from "./env.js";
import { all } from "./db.js";

type C = any; // Hono context
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (e: any) => e instanceof BidwireError ? json({ error: e.code, message: e.message, hint: e.hint }, e.status) : (console.error(e), json({ error: "internal_error", message: String(e?.message ?? e) }, 500));
const body = async (c: C) => { try { return await c.req.json(); } catch { return {}; } };

type Route = [string, RegExp, (c: C, m: RegExpMatchArray) => Promise<Response> | Response];
const routes: Route[] = [
  ["GET", /^\/api\/state$/, () => json(snapshot())],
  ["GET", /^\/api\/stream$/, () => sseResponse(snapshot)],
  ["GET", /^\/api\/auctions\/([\w-]+)$/, (_c, m) => { const a = getAuction(m[1]); return a ? json(a) : json({ error: "auction_not_found" }, 404); }],
  ["GET", /^\/api\/merchants$/, () => json(snapshot().merchants)],
  ["GET", /^\/api\/merchants\/([\w-]+)$/, (_c, m) => json(merchantProfile(m[1]))],
  ["POST", /^\/api\/merchants\/join$/, async (c) => { const b = await body(c); return json(joinMerchant(String(b.name ?? ""), "human")); }],
  ["POST", /^\/api\/merchants\/([\w-]+)\/bids$/, async (c, m) => {
    const b = await body(c); const merchant = getMerchant(m[1]);
    if (!merchant || merchantKey(m[1]) !== b.key) throw new BidwireError("bad_merchant_key", "That store key is not valid on this exchange.", "Rejoin from the merchant page.", 401);
    return json(placeBid({ merchant, auction_id: String(b.auction_id), listing_id: String(b.listing_id), claimed_total_cents: Number(b.advertised_price_cents), ship_days: b.ship_days != null ? Number(b.ship_days) : undefined, fee_cents: Number(b.fee_cents ?? 0), pitch: b.pitch ? String(b.pitch) : "" }));
  }],
  ["GET", /^\/api\/merchants\/([\w-]+)\/feed$/, (c, m) => {
    if (merchantKey(m[1]) !== c.req.query("key")) throw new BidwireError("bad_merchant_key", "That store key is not valid on this exchange.", undefined, 401);
    return json(merchantFeed(m[1]));
  }],
  ["GET", /^\/api\/approvals$/, () => json(listApprovals())],
  ["POST", /^\/api\/approvals\/([\w-]+)\/decide$/, async (c, m) => { const b = await body(c); return json(decideApproval(m[1], b.decision === "deny" ? "deny" : "approve", String(b.via ?? "Bidwire phone"))); }],
  ["POST", /^\/api\/phone\/reply$/, async (c) => { const b = await body(c); const t = String(b.text ?? "").trim(); if (!t) throw new BidwireError("empty_reply", "Type a reply such as YES 1234."); simulateInbound(t.slice(0, 160)); return json({ ok: true }); }],
  ["GET", /^\/api\/ledger$/, () => json(ledgerView())],
  ["GET", /^\/api\/meta\/tools$/, () => json(toolMeta())],
  ["POST", /^\/api\/tools\/([\w-]+)$/, async (c, m) => {
    const b = await body(c);
    const key = b.merchant_key ? String(b.merchant_key) : b.buyer_id ? buyerKey(String(b.buyer_id)) ?? null : null;
    const caller = resolveCaller(key, "playground");
    const r = await callTool(m[1], b.args ?? {}, caller, "playground", b.merchant_key ?? null);
    return json({ ok: r.ok, result: r.result, text: r.text });
  }],
  ["POST", /^\/api\/demo\/reset$/, () => { seed(); const s = snapshot(); emit("demo.reset", s); return json(s); }],
  ["POST", /^\/api\/demo\/bots$/, async (c) => { const b = await body(c); setBots(!!b.enabled); return json({ ok: true, bots_enabled: !!b.enabled }); }],
  ["POST", /^\/api\/demo\/config$/, async (c) => { const b = await body(c); if (b.auction_ms) setAuctionMs(Number(b.auction_ms)); return json(snapshot().config); }],
  ["POST", /^\/api\/demo\/agent$/, async (c) => { const b = await body(c); return json(runDemoAgent({ buyer_id: String(b.buyer_id ?? "b_claude"), need: String(b.need ?? ""), budget_usd: Number(b.budget_usd ?? 0), deliver_within_days: b.deliver_within_days != null && b.deliver_within_days !== "" ? Number(b.deliver_within_days) : undefined, auto_buy: b.auto_buy !== false })); }],
  ["GET", /^\/api\/demo\/scenarios$/, () => json(SCENARIOS.map(({ id, title, description }) => ({ id, title, description })))],
  ["POST", /^\/api\/demo\/scenario$/, async (c) => { const b = await body(c); return json(runScenario(String(b.id))); }],
  ["GET", /^\/api\/connect$/, () => json(connectInfo())],
];

function connectInfo() {
  const mcp = `${config.publicUrl}/mcp`;
  const buyers = all("SELECT id, name, key, client FROM buyers ORDER BY created_at");
  const k = (id: string) => buyers.find((b) => b.id === id)?.key ?? "";
  return {
    mcp_url: mcp, buyers,
    snippets: [
      { client: "claude-code", title: "Claude Code", code: `claude mcp add --transport http bidwire ${mcp} --header "Authorization: Bearer ${k("b_claude")}"` },
      { client: "claude-desktop", title: "Claude Desktop", code: JSON.stringify({ mcpServers: { bidwire: { command: "npx", args: ["-y", "mcp-remote", mcp, "--header", `Authorization: Bearer ${k("b_claude")}`] } } }, null, 2) },
      { client: "chatgpt", title: "ChatGPT", code: `Settings → Apps & Connectors → Advanced → Developer mode → Create connector\nMCP server URL: ${mcp}?key=${k("b_chatgpt")}\nAuthentication: none\n(ChatGPT needs a public HTTPS URL: run \`npx mcp-use dev --tunnel\` or deploy to Manufact.)` },
      { client: "codex", title: "Codex", code: `# ~/.codex/config.toml\n[mcp_servers.bidwire]\ncommand = "npx"\nargs = ["-y", "mcp-remote", "${mcp}", "--header", "Authorization: Bearer ${k("b_codex")}"]` },
      { client: "cursor", title: "Cursor", code: JSON.stringify({ mcpServers: { bidwire: { url: mcp, headers: { Authorization: `Bearer ${k("b_guest")}` } } } }, null, 2) },
    ],
  };
}

// Phones on venue wifi poll /api/state; gzip cuts that ~100KB snapshot to ~15KB.
async function maybeGzip(c: C, res: Response): Promise<Response> {
  const type = res.headers.get("Content-Type") ?? "";
  if (!type.includes("application/json") || !(c.req.header("accept-encoding") ?? "").includes("gzip")) return res;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2048) return new Response(buf, { status: res.status, headers: res.headers });
  const headers = new Headers(res.headers); headers.set("Content-Encoding", "gzip"); headers.set("Vary", "Accept-Encoding");
  return new Response(gzipSync(buf), { status: res.status, headers });
}

const WEB_DIST = resolve("web/dist");
const UPDATING = `<!doctype html><meta http-equiv="refresh" content="1"><title>Bidwire</title><body style="font-family:Georgia,serif;background:#F4EFE4;color:#16130E;display:grid;place-items:center;height:100vh;margin:0"><p>Bidwire is updating… one moment.</p></body>`;
const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".webp": "image/webp", ".gif": "image/gif" };

export function mountHttp(server: any) {
  server.use("/api/*", async (c: C, next: () => Promise<void>) => {
    const path = new URL(c.req.url).pathname;
    for (const [method, re, h] of routes) {
      const m = path.match(re);
      if (m && c.req.method === method) {
        let res: Response;
        try { res = await h(c, m); } catch (e) { res = fail(e); }
        return maybeGzip(c, res);
      }
    }
    return json({ error: "not_found", message: `${c.req.method} ${path}` }, 404);
  });

  server.use("/store/*", async (c: C, next: () => Promise<void>) => {
    const parts = new URL(c.req.url).pathname.split("/").filter(Boolean); // store, handle, sku, [quote]
    if (parts.length === 4 && parts[3] === "quote") { const q = quote(parts[1], parts[2]); return q ? json(q) : json({ error: "not_found" }, 404); }
    if (parts.length === 3) { const html = productPage(parts[1], parts[2]); return html ? new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }) : new Response("Not found", { status: 404 }); }
    return next();
  });

  server.use("/llms.txt", async () => new Response(llms(), { headers: { "Content-Type": "text/plain; charset=utf-8" } }));

  server.use("*", async (c: C, next: () => Promise<void>) => {
    const path = new URL(c.req.url).pathname;
    if (c.req.method !== "GET" || path.startsWith("/mcp") || path.startsWith("/api") || path.startsWith("/inspector") || path.startsWith("/.well-known")) return next();
    if (!existsSync(WEB_DIST)) return path === "/" ? new Response(`<h1>Bidwire</h1><p>Web app not built yet. Run <code>npm run build</code>.</p><p>MCP endpoint: <code>/mcp</code></p>`, { headers: { "Content-Type": "text/html" } }) : next();
    try {
      const file = join(WEB_DIST, path);
      if (file.startsWith(WEB_DIST) && existsSync(file) && statSync(file).isFile()) {
        const ext = extname(file);
        return new Response(readFileSync(file), { headers: { "Content-Type": MIME[ext] ?? "application/octet-stream", "Cache-Control": path.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache" } });
      }
      if (extname(path)) return next();
      return new Response(readFileSync(join(WEB_DIST, "index.html")), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
    } catch {
      // The web build is being replaced (vite empties dist first): show a self-refreshing page instead of a 500.
      return new Response(UPDATING, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "1", "Cache-Control": "no-store" } });
    }
  });
}

function llms() {
  return `# Bidwire

> The ad exchange for AI agents. Shopping agents call one MCP tool and merchants bid live for the purchase. Every bid is verified against the merchant's real checkout, offers are ranked on merit, and fees never buy rank.

MCP endpoint: ${config.publicUrl}/mcp (streamable HTTP; optional Authorization: Bearer <key>)

## Tools (buyer agents)
- find_offers(need, budget_usd, deliver_within_days?, must_have?, max_results?): opens a ~12s live auction and returns verified, merit-ranked offers
- buy_offer(offer_id, idempotency_key?, wait_for_approval_seconds?): buys within your human's limits; texts them for approval above the limit
- check_approval(approval_id, wait_seconds?), get_offers(auction_id, wait_seconds?), get_order(order_id), get_wallet(), report_offer(offer_id, issue), explain_offer(offer_id)

## Tools (merchant agents)
- register_merchant(store_name, categories?), list_open_requests(merchant_key?), place_bid(auction_id, sku, delivered_price_usd, ship_days?, fee_usd?, pitch?), get_my_results(merchant_key?)

## Resources
- bidwire://ranking-policy, bidwire://categories, bidwire://agent-guide

## Prompts
- shop_for_me(need, budget_usd), sell_on_bidwire(store_name)
`;
}
