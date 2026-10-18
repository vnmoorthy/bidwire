# Bidwire: 3-minute stage storyboard

**One sentence:** Bidwire is the ad exchange for AI agents. When an agent shops, merchants bid live, every bid is checked against the merchant's real checkout, and you can't bribe an agent.

**Setup before you walk on:**
- Live exchange (`/exchange`) full screen on the projector; the landing page (`/`) open in a second tab for the opening line.
- Claude Code in a terminal on the laptop, connected to Bidwire (`claude mcp add ...` from `/connect`).
- The approver phone (`/phone`) open on your real phone or in a second window.
- Director (`/director`) on a second screen: auction window 12s, bots on, demo reset.

| Time | On screen | You say (word for word is fine) | You do |
|---|---|---|---|
| **0:00 to 0:15** | Exchange, idle hero | "Amazon is blocking agents. Paul Graham says that's the biggest opening since Amazon. But when an agent shops, nobody sees an ad. So how does a merchant win an agent's purchase?" | Nothing yet. Let the empty board sit. |
| **0:15 to 0:30** | Exchange | "We rebuilt Google Ads for agents. It's an MCP server called Bidwire. Watch a real agent use it." | Switch to the Claude Code terminal. |
| **0:30 to 0:45** | Claude Code terminal | "I'm asking Claude for noise-cancelling headphones for long flights, under $400, by Friday." | Type: `find me noise cancelling headphones for long flights under $400, delivered in 5 days, and buy the best one`. Press Enter and switch back to the Exchange. |
| **0:45 to 1:05** | Exchange: the auction opens, the countdown ring spins, bids stream in | "Claude made one tool call, find_offers. Eight merchants are now bidding live for this one purchase. Some of them are lying." | Point at the bid rows as they arrive. |
| **1:05 to 1:25** | Red **LIAR CAUGHT** banner: DealDrop claimed $X, checkout says $Y (+$29 "Service & handling fee") | "Bidwire just loaded DealDrop's real checkout page. They advertised one price and hid a $29 fee at checkout. They're excluded, and their trust score drops for every agent on the exchange." | Pause and let the banner land. |
| **1:25 to 1:40** | Second flag: Specsmith claims noise cancelling on headphones without it | "This one claimed noise cancelling. Its own product page says no. Excluded." | |
| **1:40 to 2:00** | Auction closes, ranking animates; amber **BRIBE IGNORED** banner: MegaMart offered $35 per sale and is still ranked #5 | "MegaMart offered us $35 per sale to rank first. It's still #5. Merchant fees only break exact ties. **You can't bribe an agent.**" | Point at the #1 pick and its reasons: lowest verified price, all must-haves, arrives in 2 days. |
| **2:00 to 2:20** | Toast: "Asking Judge to approve $319.99". The phone buzzes (Inkbox SMS, or the on-screen phone) | "$319 is over this agent's $300 limit, so Bidwire texts its human. The money waits for a person." | Hand the phone to a judge, or tap Approve. **Reply YES.** |
| **2:20 to 2:35** | Green **SOLD** toast; the Agent Wire shows buy_offer purchased; the receipt email arrives | "Approved. Paid from the agent's wallet. The merchant pays its fee only because a verified sale happened. The receipt is already in the inbox." | Flip to `/ledger` for 3 seconds: every transaction balances to $0.00. |
| **2:35 to 2:50** | Exchange: QR card "Join as a merchant" | "Anyone here can be a merchant: scan this, open a store, and try to lie to the agent. We'll catch you." | Hold up the QR. |
| **2:50 to 3:00** | Logo slide or Exchange | "Bidwire: the ad exchange for agents. One MCP call to buy, verified offers, and you can't bribe it. It's live in Claude, ChatGPT and Codex today." | Smile and stop. |

## If something goes wrong
- **Claude stalls or the wifi drops:** in Director, run the scenario **"Headphones for a long flight"**. It drives the exact same tools through the built-in demo agent.
- **The SMS doesn't arrive:** approve on `/phone`. It's the same approval record, and the purchase continues instantly.
- **Nobody scans the QR:** run the scenario **"Room auction (30s, audience bids)"** and narrate the bots bidding.

## Lines worth memorizing
- "When an agent shops, nobody sees an ad."
- "For an agent, the ad *is* the offer, so it has to be true."
- "Fees break ties. They never buy rank. You can't bribe an agent."
- "The money waits for a person when it should."
