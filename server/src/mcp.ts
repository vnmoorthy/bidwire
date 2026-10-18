// The Bidwire MCP server (mcp-use v2): tools, resources and prompts for shopping agents and merchant agents.
import { MCPServer } from "mcp-use";
import { z } from "zod";
import { TOOLS, callTool, type Caller } from "./tools.js";
import { buyerByKey, getBuyer, merchantByKey, RANKING_WEIGHTS } from "./exchange.js";
import { CATEGORIES, PRODUCTS } from "./catalog.js";
import { config } from "./env.js";

export const server = new MCPServer({
  name: "bidwire",
  title: "Bidwire: the ad exchange for AI agents",
  version: "1.0.0",
  description: "Shopping agents call find_offers once; merchants bid live; every bid is verified against the merchant's real checkout; offers are ranked on merit, never on fees.",
  host: "0.0.0.0",
} as any);

export function normalizeClient(raw?: string | null): string {
  const n = (raw ?? "").toLowerCase();
  if (!n) return "mcp-client";
  if (n.includes("claude-code") || n === "claude-code") return "claude-code";
  if (n.includes("claude")) return "claude";
  if (n.includes("openai") || n.includes("chatgpt")) return "chatgpt";
  if (n.includes("codex")) return "codex";
  if (n.includes("cursor")) return "cursor";
  if (n.includes("inspector")) return "mcp-inspector";
  return n.slice(0, 32);
}

export function resolveCaller(key: string | null | undefined, client: string): Caller {
  if (key) {
    const b = buyerByKey(key); if (b) return { role: "buyer", buyer: b };
    const m = merchantByKey(key); if (m) return { role: "merchant", merchant: m };
  }
  // Zero-config first call: well-known clients shop as their demo agent, everything else as the guest agent.
  const id = client.startsWith("claude") ? "b_claude" : client === "chatgpt" ? "b_chatgpt" : client === "codex" ? "b_codex" : "b_guest";
  return { role: "buyer", buyer: getBuyer(id)! };
}

function keyFrom(ctx: any): string | null {
  const req = ctx?.req ?? ctx?.request;
  const auth = req?.header?.("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return bearer || req?.header?.("x-bidwire-key") || req?.query?.("key") || null;
}

for (const t of TOOLS) {
  server.tool(
    {
      name: t.name, title: t.title, description: t.description, inputSchema: t.input,
      annotations: { readOnlyHint: !!t.readOnly, destructiveHint: !!t.destructive, openWorldHint: !!t.openWorld, idempotentHint: !!t.readOnly },
    } as any,
    (async (input: any, ctx: any) => {
      let raw: string | undefined;
      try { raw = ctx?.client?.info?.()?.name; } catch { raw = undefined; }
      const client = normalizeClient(raw ?? ctx?.req?.header?.("user-agent"));
      const key = keyFrom(ctx);
      const caller = resolveCaller(key, client);
      const r = await callTool(t.name, input, caller, client, key?.startsWith("bw_mer_") ? key : null);
      return r.ok
        ? { content: [{ type: "text", text: r.text }], structuredContent: r.result }
        : { isError: true, content: [{ type: "text", text: r.text }] };
    }) as any,
  );
}

const rankingPolicy = () => `# How Bidwire ranks offers for agents

Every bid is verified before it can be ranked:
1. Bidwire fetches the merchant's public product page and reads its schema.org Offer.
2. It requests the merchant's checkout quote: the real delivered total, including any fee that only appears at checkout.
3. It compares the merchant's claim (delivered price, delivery days, features) with what the page and checkout say.
Bids that understate the price, overstate speed, claim features the product does not have, or carry a pitch with instructions aimed at the buying agent (prompt injection) are **excluded** and the merchant's trust score drops for every agent on the exchange.

Verified offers are ranked by merit (0-100):
- Price: ${RANKING_WEIGHTS.price * 100}% (cheapest verified delivered total = full marks)
- Must-have features: ${RANKING_WEIGHTS.specs * 100}%
- Delivery vs your deadline: ${RANKING_WEIGHTS.delivery * 100}% (missing the deadline scores 0)
- Merchant trust: ${RANKING_WEIGHTS.trust * 100}%
- Return window: ${RANKING_WEIGHTS.returns * 100}%
Offers over budget are discounted 15%; out-of-stock offers are discounted 50%.

**Merchant fees never buy rank.** A merchant's fee per sale is only paid if an agent buys from it, and it only breaks ties within 0.5 merit points. When a higher-fee offer ranks lower, Bidwire marks it "bribe ignored".

Merchant pitches are never passed to agents as instructions; offers returned by find_offers contain only verified facts.

Spending is governed by your human: per-purchase and daily limits. Above them, buy_offer texts your human and waits for YES.
`;

const agentGuide = () => `# Bidwire for agents

Endpoint: ${config.publicUrl}/mcp (streamable HTTP). Auth is optional: send \`Authorization: Bearer <buyer key>\` to shop as a specific agent; with no key you shop as the guest agent (limit $150).

## Shopping (2 calls)
1. find_offers { need, budget_usd, deliver_within_days?, must_have? } → ranked, verified offers (about 12 seconds; merchants bid live).
2. buy_offer { offer_id } → order + receipt. Above your human's limit it texts them and waits for YES.
Recovery: buy_offer returns out_of_stock with next_offer when a merchant sells out; approval_required with an approval_id (use check_approval) when your human has not answered yet.

## Selling (merchant agents)
register_merchant → list_open_requests → place_bid → get_my_results. Your claims are checked against your own storefront.

Categories: ${Object.entries(CATEGORIES).map(([k, v]) => `${k} (${Object.keys(v.features).join(", ")})`).join("; ")}.
`;

server.resource({ name: "ranking-policy", uri: "bidwire://ranking-policy", title: "How offers are verified and ranked", mimeType: "text/markdown", description: "The exact verification checks and merit weights Bidwire applies. Fees never buy rank." },
  async (uri: URL) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: rankingPolicy() }] }) as any);
server.resource({ name: "categories", uri: "bidwire://categories", title: "Categories and feature tags", mimeType: "application/json", description: "What agents can buy on the exchange today and the feature tags usable in must_have." },
  async (uri: URL) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(Object.fromEntries(Object.entries(CATEGORIES).map(([k, v]) => [k, { label: v.label, feature_tags: Object.keys(v.features), example_products: PRODUCTS.filter((p) => p.category === k).map((p) => p.title) }])), null, 2) }] }) as any);
server.resource({ name: "agent-guide", uri: "bidwire://agent-guide", title: "Agent quickstart", mimeType: "text/markdown", description: "How to shop and sell on Bidwire in as few calls as possible." },
  async (uri: URL) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: agentGuide() }] }) as any);

server.prompt({ name: "shop_for_me", title: "Shop for me", description: "Buy something for the user through Bidwire, safely.", schema: z.object({ need: z.string(), budget_usd: z.string() }) } as any,
  (async ({ need, budget_usd }: any) => ({ messages: [{ role: "user", content: { type: "text", text:
    `Buy "${need}" for me with a budget of $${budget_usd} using Bidwire. Call find_offers once with my need and budget. Show me the top 3 verified offers with their delivered price, delivery time and why each ranked where it did, and mention any merchant that was excluded for lying. Then buy the #1 offer with buy_offer. If it needs my approval, tell me to check my phone. If it sold out, buy the next offer it suggests.` } }] })) as any);
server.prompt({ name: "sell_on_bidwire", title: "Sell on Bidwire", description: "Run a merchant agent that bids honestly for agents' purchases.", schema: z.object({ store_name: z.string() }) } as any,
  (async ({ store_name }: any) => ({ messages: [{ role: "user", content: { type: "text", text:
    `Open a store called "${store_name}" with register_merchant. Then every few seconds call list_open_requests; for each open request where you have an eligible listing, call place_bid with its real delivered price (never understate it: Bidwire checks your checkout) and a modest fee. Report wins and losses with get_my_results.` } }] })) as any);
