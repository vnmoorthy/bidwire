# Bidwire HTTP API (for the web app)

Base URL: same origin as the web app (dev: the Vite dev server proxies `/api`, `/store` and `/mcp` to `http://localhost:8787`).
Types are in `shared/types.ts`. Money is integer cents. Errors: HTTP 4xx/5xx with `{ "error": string, "hint"?: string }`.

## Live state
- `GET /api/state` → `Snapshot`
- `GET /api/stream` → Server-Sent Events. Every message is `data: {"type": ..., "ts": ..., "data": ...}` (see `BidwireEvent`). The first event is `hello` with a full `Snapshot`. `demo.reset` also carries a full `Snapshot` (replace all client state).
- `GET /api/auctions/:id` → `Auction` (with all bids, evidence and ranking)

## Merchants (the room joins as merchants from their phones)
- `GET /api/merchants` → `Merchant[]`
- `GET /api/merchants/:id` → `{ merchant: Merchant, listings: (Listing & { product: Product })[], bids: Bid[], trust_history: { ts: number, trust: number, reason: string }[] }`
- `POST /api/merchants/join` body `{ name: string }` → `{ merchant: Merchant, key: string, listings: (Listing & { product: Product })[] }`. Save `key` in localStorage; it authorizes bids.
- `POST /api/merchants/:id/bids` body `{ key, auction_id, listing_id, advertised_price_cents, ship_days, fee_cents, pitch? }` → `Bid`. `advertised_price_cents` is what the merchant claims as the delivered total; the verifier compares it with the real checkout total of the listing. Advertising lower than the real total gets the bid flagged as a lie.
- `GET /api/merchants/:id/feed?key=...` → `{ open: Auction[], my_bids: Bid[] }` (open auctions in categories this merchant carries, newest first)

## Buyers' humans (approval phone)
- `GET /api/approvals` → `Approval[]`
- `POST /api/approvals/:id/decide` body `{ decision: "approve" | "deny", via?: string }` → `Approval`

## Ledger
- `GET /api/ledger` → `{ entries: LedgerEntry[], balances: { account: string, cents: number }[], orders: Order[] }`

## Tools playground (lets anyone call the same MCP tools from the browser)
- `GET /api/meta/tools` → `{ name, title, description, role: "buyer"|"merchant"|"public", input_schema: object }[]`
- `POST /api/tools/:name` body `{ args: object, buyer_id?: string, merchant_key?: string }` → `{ ok: boolean, result: any, text: string, ms: number }`. Logged as client `playground`.

## Demo director
- `POST /api/demo/reset` → `Snapshot` (re-seeds everything)
- `POST /api/demo/bots` body `{ enabled: boolean }`
- `POST /api/demo/config` body `{ auction_ms?: number }`
- `POST /api/demo/agent` body `{ buyer_id: string, need: string, budget_usd: number, deliver_within_days?: number, auto_buy?: boolean }` → starts the built-in demo agent (it calls the real MCP tools: find_offers → buy_offer → check_approval). Returns `{ run_id }`; progress appears as `tool.call` events.
- `GET /api/demo/scenarios` → `{ id, title, description }[]`; `POST /api/demo/scenario` body `{ id }` runs one.
- `GET /api/connect` → `{ mcp_url, buyers: { id, name, key, client }[], snippets: { client: string, title: string, code: string }[] }` (copy-paste configs for Claude Code, Claude Desktop, ChatGPT, Codex, Cursor)

## Storefronts (real pages the verifier fetches)
- `GET /store/:handle/:sku` → HTML product page with schema.org JSON-LD `Offer`
- `GET /store/:handle/:sku/quote` → `{ price_cents, shipping_cents, fees: {label, cents}[], total_cents, ship_days, in_stock }` (the checkout truth)

## MCP
- `POST/GET /mcp` — the MCP server (streamable HTTP). Auth: `Authorization: Bearer <key>` or `?key=<key>`; no key = guest buyer.
