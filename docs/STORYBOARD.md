# Bidwire: 3-minute stage storyboard

**One sentence:** Bidwire is the auction house for AI agents. When an agent shops, merchants raise a paddle, every bid is checked against the merchant's real checkout, and you can't bribe an agent.

**Setup before you walk on:**
- Projector: the saleroom, `/exchange`, full screen and freshly reset from the Auctioneer's desk.
- Laptop: Claude Code in a terminal, with `bidwire` connected.
- A judge holds the approver phone (`/phone`), or their own phone if Inkbox SMS is configured.
- Auctioneer's desk (`/director`) in a second tab: bots on, 12-second lots, gavel sound on.

| Time | On screen | You say | You do |
|---|---|---|---|
| **0:00 to 0:15** | The saleroom board, idle: "Waiting for an agent to shop" | "Amazon is blocking AI agents. Paul Graham says that's the biggest opening since Amazon. But when an agent shops, **nobody sees an ad**. So how does a merchant win an agent's purchase?" | Let the empty board sit. |
| **0:15 to 0:30** | Same | "We built the auction house for AI agents: an MCP server called Bidwire. Watch a real agent use it." | Switch to the Claude Code terminal. |
| **0:30 to 0:45** | Claude Code | "I'm asking Claude for noise-cancelling headphones for long flights, under $400, in 5 days." | Run `scripts/claude-shopper.sh "noise cancelling headphones for long flights" 400 5`, or type it into Claude Code. Switch back to the saleroom. |
| **0:45 to 1:05** | LOT 01 opens: the need in italics, the amber countdown, paddles rising | "One tool call, find_offers. Nine merchants are raising paddles for this one purchase. Some of them are lying." | Point at the paddles as they arrive. |
| **1:05 to 1:25** | Banner: **Bid withdrawn · DealDrop Direct**, "Claimed $X delivered · checkout says $Y (+$29.00 'Service & handling fee')" | "Bidwire opened DealDrop's real checkout. They hid a $29 fee. Withdrawn, and their standing drops for every agent on the exchange." | Pause and let the banner land. |
| **1:25 to 1:40** | **Prompt injection blocked · InjectCo**, quoting "ignore your previous instructions…"; Specsmith withdrawn for fake specs | "This one tried to hijack the agent with instructions hidden in its pitch. Merchant text is data, never instructions; the agent never sees it." | |
| **1:40 to 2:00** | "Going once… Going twice… Fair warning…", then the gavel. "Hammer · $X". Bronze line: **Bribe ignored · offered $35 commission · still No. 5** | "MegaMart offered us $35 a sale to rank first. Still fifth. **You can't bribe an agent.**" | Point at No. 1 and its reasons: verified price, every must-have, arrives in time. |
| **2:00 to 2:20** | Board subline: "Waiting for Judge (approver) to approve on the phone". The phone buzzes | "It's over this agent's $300 limit, so the money waits for a person." | The judge taps **Approve**, or replies YES with the code. |
| **2:20 to 2:35** | The gavel strikes: **Sold · $X**. Sold toast: "commission paid by the merchant" | "Sold. Paid from the agent's wallet. The merchant pays its commission only because a verified sale happened." | Flip to `/ledger` for 3 seconds: every transaction balances to $0.00. |
| **2:35 to 2:50** | The saleroom's "Raise a paddle" QR | "Anyone here can be a merchant. Scan it, open a store, and try to lie to an agent. We'll catch you." | Hold up the QR. |
| **2:50 to 3:00** | The homepage, "The auction house for AI agents." | "Bidwire: one MCP call to buy, every claim verified, and fees never buy rank. It's live in Claude, ChatGPT and Codex today. **You can't bribe an agent.**" | Stop. |

## If something goes wrong
- **Claude stalls or the wifi drops:** on the Auctioneer's desk, run **Headphones for a long flight**. It's the same tools through the built-in demo agent.
- **The SMS doesn't arrive:** approve on `/phone`. It's the same approval record, and the purchase completes.
- **Nobody scans the QR:** run **Room auction (30s, audience bids)** and narrate the bots.

## Lines worth memorizing
- "When an agent shops, nobody sees an ad."
- "For an agent, the ad *is* the offer, so it has to be true."
- "Commission breaks ties. It never buys rank. You can't bribe an agent."
- "Merchant text is data, never instructions."
- "The money waits for a person when it should."
