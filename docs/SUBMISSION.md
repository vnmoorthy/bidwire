# Manufact track submission checklist (due 10:00 AM)

Track: **Best MCP server built for agents as the primary customer.** Submit at url.mcp-use.com/yc-submit with:
1. **MCP URL**: the Manufact Cloud URL from `npx mcp-use deploy` (or the public tunnel URL as a fallback).
2. **Org ID**: `npx mcp-use org` shows the active organization.
3. **Multi-client video**: 60 to 90 seconds showing the same server working in several clients.

## Multi-client video script (record with QuickTime: File → New Screen Recording)
1. **Claude Code**, 20 seconds. Run `claude mcp add --transport http bidwire <MCP URL> --header "Authorization: Bearer bw_buy_claude_demo"`, then ask: "find me noise cancelling headphones for long flights under $400 and buy the best one". Show the find_offers call, the excluded liar and the purchase.
2. **ChatGPT**, 20 seconds. Go to Settings → Apps & Connectors → Developer mode → Create connector, set the URL to `<MCP URL>?key=bw_buy_chatgpt_demo`, and ask: "Use Bidwire to buy a 65W USB-C GaN travel charger under $80."
3. **Codex or Cursor**, 15 seconds. Add the server from the `/connect` page snippet and ask it to call `get_wallet` or `find_offers`.
4. **Bidwire Exchange**, 15 seconds. The Agent Wire panel shows every call above, labeled by client (claude-code, chatgpt, codex), next to the live auctions.

## Why MCP, not a website (the judges' first question)
- The customer is an agent. It needs one tool call that returns verified, ranked, token-light JSON, not a page built for human eyes, ads or dark patterns.
- Money moves only through tools that enforce the human's policy server-side: limits, approvals, idempotency, and a 403 when an agent touches another agent's auction.
- The same exchange serves both sides as agents: shopping agents (find_offers, buy_offer) and merchant agents (register_merchant, place_bid).

## MCP quality points to show
- 12 tools with titles, descriptions written for LLMs, zod schemas, and annotations (readOnly, destructive, openWorld, idempotent).
- 3 resources (ranking policy, categories, agent guide) and 2 prompts (shop_for_me, sell_on_bidwire).
- Structured errors with an `error` code, `message` and actionable `hint`. Examples: buyer_key_required, auction_still_open, offer_not_verified, not_your_auction.
- Zero-config first call: no key means the guest agent, and Claude, ChatGPT and Codex auto-map to their demo agents.
- A 2-call happy path (find_offers, then buy_offer) with built-in recovery: out_of_stock comes back with next_offer, and approval_required comes back with check_approval.
- `npm test` runs 24 end-to-end checks over the real MCP protocol and HTTP API.
