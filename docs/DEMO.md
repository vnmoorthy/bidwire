# Bidwire live demo: run of show

A 15-minute live demo with real agents, a room full of merchants and a human approving by text, plus a [3-minute cut](#the-3-minute-cut) for a stage slot. For a word-for-word 3-minute script, see [STORYBOARD.md](STORYBOARD.md).

**The story in one line:** when an agent shops, nobody sees an ad, so merchants bid for the purchase itself, every claim is checked against the real checkout, and you can't bribe an agent.

## Screens

| Screen | URL | Where |
| --- | --- | --- |
| Live exchange | `/exchange` | Projector, full screen. |
| Landing page | `/` | Projector, for the opening. |
| Claude Code | terminal | Laptop, large font, next to the projector view. |
| Approver phone | `/phone` | Your real phone (or a second browser window). With Inkbox configured, the real SMS also arrives on the approver's phone. |
| Director | `/director` | Second screen or a tablet, never on the projector. |
| Ledger, Connect | `/ledger`, `/connect` | Tabs on the projector browser. |
| Merchant app | `/merchant` | The audience's phones, via the QR code on the Exchange. |

## Before the show (T−30 minutes)

1. **Make it reachable.** Phones in the room can't open `localhost`. Expose the server over HTTPS (for example `cloudflared tunnel --url http://localhost:8787`) or use your Manufact Cloud deployment, set `PUBLIC_URL` to that address in `.env`, and restart with `npm start`. The QR code, storefront links and `/connect` snippets all use `PUBLIC_URL`.
2. **Optional real texts.** Set `INKBOX_API_KEY`, `APPROVER_PHONE` (E.164) and `RECEIPT_EMAIL` in `.env`. Restart, then reset (next step): the phone number is copied onto the demo agents when the database is seeded. The Director's Providers card should say "Inkbox (real SMS + email)" and "Approver phone: set".
3. **Reset the exchange.** Director → Reset demo (click twice). Merchant bots on. Auction window 12s.
4. **Connect Claude Code** and confirm it sees the tools:

   ```bash
   claude mcp add --transport http bidwire https://<your-public-url>/mcp --header "Authorization: Bearer bw_buy_claude_demo"
   claude mcp list        # bidwire should show as connected
   ```

5. **Connect the extra clients.** ChatGPT: Settings → Apps & Connectors → Advanced → Developer mode → Create connector, URL `https://<your-public-url>/mcp?key=bw_buy_chatgpt_demo`, authentication none. Codex: add the `[mcp_servers.bidwire]` block from `/connect` to `~/.codex/config.toml`.
6. **Dry run once,** then reset again so the board, wallets and trust start clean.
7. **Arrange the windows:** `/` on the projector with `/exchange`, `/ledger` and `/connect` as tabs; the terminal beside it; `/phone` on your phone; `/director` on the second screen.

## The 15-minute run

| # | Time | Screen | Do | Say |
| ---: | --- | --- | --- | --- |
| 1 | 0:00 | Landing `/` | Open on the hero. | "When an agent shops, nobody sees an ad. So how does a merchant win an agent's purchase?" |
| 2 | 0:30 | Landing `/` | Scroll to "You can't bribe an agent" and its ranking weights: price 40, must-haves 25, delivery 15, trust 15, returns 5, merchant fee 0. | "Bidwire is Google Ads rebuilt for agents. Merchants still bid, but rank is earned. The fee only breaks ties." |
| 3 | 1:00 | `/exchange` | Click "Watch it live". Point at the KPIs, the empty auction card, agent activity, merchant trust and the QR card. | "This is the exchange. Everything you'll see is driven by MCP tool calls." |
| 4 | 1:20 | Terminal | Type: `find me noise cancelling headphones for long flights under $400, delivered in 5 days, and buy the best one`. Switch back to the projector. | "One request to Claude. Claude makes one tool call: `find_offers`." |
| 5 | 1:35 | `/exchange` | The auction opens: the need in big type, the countdown, the Claude badge, `find_offers` in agent activity. | "That opened a 12-second auction for this one purchase." |
| 6 | 1:45 | `/exchange` | Bids stream in from the seven bots that sell headphones. MegaMart usually bids first. Each row goes from checking to Verified or Lied within about a second. | "Seven merchants are bidding live for this one purchase, and some of them are lying." |
| 7 | 2:00 | `/exchange` | The "Caught lying · DealDrop Direct" banner. Read the evidence line: claimed versus checkout, +$29.00 "Service & handling fee". | "Bidwire opened DealDrop's real checkout. The low price had a $29 fee hiding behind it. Excluded, and its trust drops for every agent on the exchange." |
| 8 | 2:20 | `/exchange` | Specsmith's row flips to Lied: it claims `anc` on a product whose page doesn't list it. | "This one claimed noise cancelling. Its own product page says otherwise." |
| 9 | 2:35 | `/exchange` | The auction closes and ranks. Point at the #1 pick's reasons, Sundial missing the 5-day deadline, and MegaMart's "Bribe ignored" with its $35-per-sale offer. | "MegaMart offered us $35 a sale to rank first. It didn't move. You can't bribe an agent." |
| 10 | 2:55 | Terminal | Show Claude's summary: top 3 with delivered prices and reasons, and the merchants excluded for lying. | "Claude can cite every reason. The agent gets about 900 tokens of verified facts, not a page of ads." |
| 11 | 3:15 | `/exchange`, phone | The #1 offer is usually over Claude's $300 limit, so `buy_offer` asks for approval: a toast on the board, a text on the phone (or the approval card on `/phone`). | "Over the limit, the money waits for a person." |
| 12 | 3:35 | Phone | Hand the phone to someone in the front row: they reply `YES 1234` (the code in the text) or tap Approve. | "One human, one word." |
| 13 | 3:50 | `/exchange`, terminal | If the reply lands within the wait (40 s by default), the same `buy_offer` call completes; otherwise Claude checks the approval and buys again. Claude reports the order, the board shows the sale, the receipt goes out. | "Paid from the agent's wallet. The merchant pays its fee only because a verified sale happened." |
| 14 | 4:15 | `/ledger` | Show the order: a sale transaction and a fee transaction, both summing to $0.00, and the account balances. | "Double-entry, idempotent. A retry can never charge twice." |
| 15 | 5:00 | `/exchange` | Point at the QR card. Ask the room to scan it and open a store on `/merchant`. New stores appear on the trust board. | "Now you're the merchants. You get real listings. Try to lie to the agent." |
| 16 | 5:40 | Director, terminal | Set the auction window to 30s. In Claude Code: `buy me a waterproof travel backpack that fits a 16 inch laptop, under $300`. | "Thirty seconds this time, so the room can bid against the bots." |
| 17 | 6:00 | `/exchange` | The room bids from their phones. When someone understates their price, their bid gets the Lied badge live and their store's trust drops. | "Caught. Your checkout says otherwise." |
| 18 | 6:40 | `/exchange`, terminal | The auction closes. Claude buys the #1 pick, maybe from someone in the room. Read out the winning store. Set the window back to 12s. | "An agent just bought from one of you, on merit." |
| 19 | 7:20 | Director, `/exchange` | Run "Sold out mid-purchase (recovery)". A rival grabs the #1 merchant's last unit; agent activity shows `buy_offer` → `out_of_stock` with `next_offer` → purchased. | "Real inventory runs out. The agent recovers in one more call." |
| 20 | 8:20 | Director, phone | Run "Headphones for a long flight" (the demo agent, same tools). When the approval arrives, tap Decline (or reply `NO 1234`). | "And when the human says no, nothing moves." |
| 21 | 8:50 | `/exchange`, `/ledger` | Agent activity shows `approval_denied`; the ledger has no new order. | "The policy lives on the server, not in the prompt." |
| 22 | 9:20 | ChatGPT | Ask: "Use Bidwire to buy a 65W USB-C GaN travel charger under $80." It's under ChatGPT's $250 limit, so it buys right away. | "Same server, a different agent." |
| 23 | 10:20 | Terminal | Codex: `codex "use the bidwire tools: call get_wallet, then find_offers for a wireless mechanical keyboard for mac under $220 and summarize the top 3"`. | "Claude, ChatGPT, Codex: every call labeled by client." |
| 24 | 11:20 | Second terminal, Director | Run `scripts/claude-merchant.sh "Claude Goods" chargers`, then in Director run "65W travel charger". Claude Goods finds the request and bids at its real price; its row shows Verified. | "Agents sell too. This store is run by Claude, and it bids honestly because lying doesn't pay." |
| 25 | 12:40 | `/connect` | Show the one-line setup per client, then the playground: run `explain_offer` on MegaMart's offer and read its "fees never buy rank" reason next to the checkout evidence. | "Every number an agent sees is inspectable." |
| 26 | 13:30 | `/exchange` | Open DealDrop on the trust board: its trust history drops with every lie. | "Lying is expensive here, permanently." |
| 27 | 14:10 | `/exchange` | Close on the KPIs: auctions, bids verified, lies caught, bribes ignored, GMV. | "Bidwire: one MCP call to buy, verified offers, a human in control of the money. You can't bribe an agent." |

## If something goes wrong

| Problem | Do this |
| --- | --- |
| Claude Code stalls or the wifi drops | Director → "Headphones for a long flight". The built-in demo agent calls the exact same tools, so the board tells the same story. |
| The SMS doesn't arrive | Approve on `/phone`. It's the same approval record and the purchase continues instantly. |
| Nobody scans the QR | Director → "Room auction (30s, audience bids)" and narrate the bots bidding. |
| The room can't reach the merchant page | `PUBLIC_URL` is still `localhost`. Skip steps 15 to 18. |
| A client times out on a 30-second auction | Use 20s or 12s. `find_offers` returns when the auction closes. |
| ChatGPT can't connect | It needs a public HTTPS URL. Use the `/connect` playground as "ChatGPT shopper" instead. |
| The board is cluttered from rehearsals | Director → Reset demo before the show. Resetting mid-show clears the board, wallets and trust. |

## The 3-minute cut

Steps 3 to 15, compressed. Window 12s, bots on, Claude Code connected, `/exchange` on the projector.

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | `/exchange`, idle. | "When an agent shops, nobody sees an ad. So how does a merchant win an agent's purchase? We rebuilt Google Ads for agents." |
| 0:15 | Claude Code: `find me noise cancelling headphones for long flights under $400, delivered in 5 days, and buy the best one`. | "One request. One tool call: `find_offers`." |
| 0:30 | Bids stream in. | "Merchants are bidding live for this one purchase. Some are lying." |
| 0:45 | Liar-caught banner on DealDrop. | "Bidwire checked their real checkout: a $29 fee hiding behind the price. Excluded." |
| 1:05 | Specsmith flagged. | "This one claimed noise cancelling. Its own page says no." |
| 1:20 | Auction closes; "Bribe ignored" on MegaMart. | "MegaMart offered $35 a sale to rank first. Still not first. You can't bribe an agent." |
| 1:45 | Approval text arrives; a judge replies YES. | "Over the $300 limit, so Bidwire texts the human. The money waits for a person." |
| 2:10 | Sale on the board; Claude reports the order. | "Paid, receipt sent. The merchant pays a fee only because a verified sale happened." |
| 2:25 | `/ledger` for three seconds. | "Every transaction balances to zero." |
| 2:35 | Back to `/exchange`, hold up the QR. | "Anyone here can be a merchant. Try lying to the agent." |
| 2:50 | Stop. | "Bidwire: the ad exchange for AI agents. It's live in Claude, ChatGPT and Codex today." |

If Claude stalls at 0:15, run "Headphones for a long flight" from the Director and keep talking: the board is identical.
