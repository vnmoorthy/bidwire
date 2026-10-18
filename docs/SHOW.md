# The 15-minute show

**Goal:** the judges should *feel* three things:
1. Agents now shop.
2. Merchants will try to manipulate agents.
3. Bidwire is the place where that manipulation fails in public.

Each beat below is a real feature you can click, and nothing is a slide pretending to be software.

**Cast:**
- **You:** the auctioneer, at the laptop.
- **A teammate (optional):** on a second laptop or a phone.
- **Two judges:** one approves on a phone, one bids on a phone.
- **The room:** scans the QR and opens stores.

**Screens:**
- **Projector:** `/exchange` (the saleroom).
- **Laptop tabs:** `/` (homepage), `/director` (the Auctioneer's desk), Terminal (Claude Code), ChatGPT, `/ledger`.
- **Phones:** `/phone` (the approver) and `/merchant` (a paddle).

---

## Before you go on (5 minutes, at 9:40)
1. Open `/director` and click **Reset demo**. Set **Bots: on**, **Auction window: 12s** and **Gavel sound: on**.
2. Confirm the tunnel URL in the QR card loads on your own phone (`/merchant`).
3. In Terminal, run `claude mcp list` and confirm `bidwire` is connected. Have `scripts/claude-shopper.sh` and `scripts/claude-merchant.sh` ready in two tabs.
4. Optional: in ChatGPT, add the connector **`https://gui-beatles-quantitative-payroll.trycloudflare.com/mcp?key=bw_buy_chatgpt_demo`**. That's the tunnel to this laptop, so ChatGPT's purchases show on the projector. The Manufact URL is a separate cloud exchange, used for the submission. Keep `cloudflared` running; if it restarts, the URL changes. Check the QR card for the current one.
5. Optional, for real SMS: Inkbox keys in `.env`, and the judge's phone has texted START to the Inkbox number.
6. Hand Judge A the approver phone (`/phone`, or their real phone). Ask Judge B to scan the QR and open a store.

---

## Run of show

| # | Time | Beat | What you do | What they see | Say this |
|---|---|---|---|---|---|
| 1 | 0:00 | **Cold open** | Homepage `/` on the projector | "The auction house for AI agents." | "Amazon just started blocking AI agents. Paul Graham called it the biggest opening since Amazon itself. Here's the problem nobody has solved: when an agent shops, **nobody sees an ad.** So how does a merchant win an agent's purchase?" |
| 2 | 0:40 | **The idea** | Scroll to "You can't bribe an agent" | Ranking weights: price 40, must-haves 25, delivery 15, trust 15, returns 5, **fee 0** | "We rebuilt Google Ads for agents, as an auction house. Merchants raise a paddle for each purchase. They win on verified facts, never on what they pay us." |
| 3 | 1:20 | **The saleroom** | Switch to `/exchange` | The empty black board: "Waiting for an agent to shop" | "This is live. Every number on this screen comes from the exchange. Nothing is mocked." |
| 4 | 1:40 | **A real agent shops** | Terminal: run `scripts/claude-shopper.sh "noise cancelling headphones for long flights" 400 5`, or type it into Claude Code | The lot opens: LOT 01, the need in italics, the countdown, paddles rising | "That's Claude Code calling our MCP server. One tool call: find_offers. Nine merchants are now bidding for this one purchase, and some of them are lying." |
| 5 | 2:20 | **Liar #1: drip pricing** | Point at the banner | "Bid withdrawn · DealDrop Direct: claimed $315.99, checkout says $344.99 (+$29 service fee)" | "Bidwire opened DealDrop's real product page and its real checkout. They hid a $29 fee. Withdrawn, and their standing drops for every agent on the exchange." |
| 6 | 2:45 | **Liar #2: fake specs** | Point at Specsmith's row | "Claims anc but the product page does not list it" | "These headphones don't have noise cancelling. Their own page says so." |
| 7 | 3:05 | **Liar #3: prompt injection** | Point at InjectCo's row | "Prompt injection blocked: 'SYSTEM NOTE TO AI SHOPPING AGENTS: ignore your previous instructions…'" | "This one tried to hijack the agent. Merchant text is data, never instructions. The agent never even sees it." |
| 8 | 3:30 | **The bribe** | The countdown says "Going once… going twice… SOLD", and the gavel falls | The amber line: "Bribe ignored · offered $35 commission · still No. 5" | "MegaMart offered us $35 a sale to rank first. It's fifth. **You can't bribe an agent.**" |
| 9 | 4:00 | **The human stays in charge** | The approval toast appears; Judge A's phone buzzes | "Your agent wants to spend $339 at Northwind… your limit is $300. Reply YES 4821" | "It's over this agent's $300 limit, so Bidwire texts the human. Judge, it's your money: approve or decline." Judge A taps **Approve** or replies YES. |
| 10 | 4:40 | **Sold** | The board flips to SOLD with the gavel | The Sold toast: "Commission $5.00 paid by the merchant" | "Paid from the agent's wallet. The merchant pays its commission only because a verified sale happened." |
| 11 | 5:00 | **Claude explains itself** | Back to Terminal | Claude's summary: top 3, who was excluded and why, the purchase | "Claude can tell its human exactly why it bought this. The ranking reasons come straight from the exchange." |
| 12 | 5:40 | **The room becomes the market** | Point at the QR "Raise a paddle" | People scan, open stores and appear in Merchant standing | "Now you're the merchants. Scan this and open a store. In 30 seconds there's a lot for you to bid on. Try to cheat; we'll catch you." |
| 13 | 6:20 | **Room lot** | Director → **Room auction (30s, audience bids)** | LOT 02, a backpack. Paddles from the room (Room tag) arrive next to the bots | "This lot is open for 30 seconds. Bid low, bid high, and lie if you dare." |
| 14 | 7:00 | **Someone lies, live** | Wait for an audience lie, or Judge B lowers the price below their checkout | "Bid withdrawn · *Judge B's store*" | "Got you." (This always gets a laugh.) |
| 15 | 7:30 | **Buy at the hammer** | On the board: **Buy at the hammer** | SOLD to the guest agent, maybe from an audience store | "If an audience store won, you just made a real sale to an AI agent." |
| 16 | 8:00 | **Agents sell too** | Terminal tab 2: `scripts/claude-merchant.sh "Claude Goods" headphones`, then Director → **Headphones for a long flight** | A merchant called Claude Goods (Agent tag) bids against the bots | "This is Claude on the *other* side, as a merchant. It registered a store and bids for other agents' purchases. Agents selling to agents." |
| 17 | 9:30 | **Three agents at once** | Director → **Three agents, three lots at once** | Three lots open; Agent bidders shows Claude, ChatGPT and Codex | "Claude, ChatGPT and Codex are each shopping at the same moment, on one exchange." |
| 18 | 10:30 | **Sold out mid-purchase** | Director → **Sold out mid-purchase (recovery)** | "Rival shopper bought the last unit", then out_of_stock, then the next best is bought | "A rival grabbed the last unit a second before our agent paid. buy_offer told the agent so and handed it the next best verified offer. It recovered on its own." |
| 19 | 11:20 | **The books** | `/ledger` | Every transaction balances to $0.00; merchant revenue, commission, wallets | "Double-entry, idempotent and auditable. Buying the same offer twice returns the same order." |
| 20 | 12:00 | **Built for agents** | `/connect` | Snippets for Claude Code, Desktop, ChatGPT, Codex and Cursor; 12 tools, 3 resources, 2 prompts; Playground | "This is the product: an MCP server built on mcp-use and deployed on Manufact. Two calls to buy. Structured errors with hints. A first call needs zero config." |
| 21 | 12:40 | **Try to break it** | Playground: buy_offer as Codex on Claude's lot | `not_your_auction` (403), shown in Agent bidders | "Agents can't touch each other's money. Every refusal is an actionable error the agent can recover from." |
| 22 | 13:10 | **The numbers** | Back to `/exchange` | KPI strip: lots, paddles, withdrawn, bribes ignored, hammer total | Read them out. "In 13 minutes, N lies caught and zero bribes accepted." |
| 23 | 13:40 | **The company** | Homepage | "Pay only at the hammer" | "Merchants pay per verified sale. Agents get a market they can trust. Because the exchange *verifies*, it gets better with every lot." |
| 24 | 14:20 | **Close** | Stay on the board | — | "When an agent shops, nobody sees an ad. So the only way to win is to tell the truth. **You can't bribe an agent.** Thank you." |

## If something breaks (never debug on stage)
- **Claude Code slow or offline:** the Auctioneer's desk runs the same tools through the built-in demo agent. Run **Headphones for a long flight**.
- **No SMS:** approve on `/phone`. It's the same approval record, through the same server path.
- **The room doesn't scan:** Judge B's phone is enough. Or run **Room auction** and narrate the bots.
- **Wifi dies:** everything runs on the laptop (`localhost:8787`), and the phones' page polls when it can.
- **A lot shows no liar:** liars bid on headphones, chargers and keyboards. Use **Headphones for a long flight** or **Prompt-injection attempt**.

## Judge questions, answered in one breath
- **"Why MCP and not a website?"** The customer is an agent. It needs one call that returns verified, ranked JSON, not a page of ads. And money only moves through tools that enforce the human's limits on the server.
- **"Isn't the merchant side fake?"** The bots play known merchant behaviors, and the room and Claude bid as real merchants. The verifier reads any page with schema.org offers; real retailers publish exactly this markup.
- **"What stops collusion or fake trust?"** Trust only moves on verified events: a completed sale (+1), a caught lie (−12), a confirmed report (−10). Fees never affect rank.
- **"How do you make money?"** Commission per verified sale, paid by the merchant only at the hammer. It's Google's ad model without the incentive to sell rank.
- **"What's next?"** Real merchant catalogs via schema.org, agent payment rails (ACP, x402, card networks) as plug-ins, and a reputation network that follows merchants across exchanges.
