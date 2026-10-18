# Bidwire design system v3: "Saleroom"

**Concept:** Bidwire should look like real-world bidding: a modern Sotheby's / Christie's saleroom, rebuilt for AI agents.
- Every purchase an agent makes is a **Lot**.
- Merchants hold **paddles**.
- The live price shows on a black **saleroom board**.
- Liars are **withdrawn**.
- Each auction ends with **"Going once… going twice… Sold"** and a gavel strike.

The visual references are an auction catalogue (ivory paper, serif typography, hairline rules) combined with the saleroom board (black lacquer, warm glowing numerals). It should look elegant, expensive and unmistakably about bidding: no neon, no glows, no terminal look.

## Tokens (Tailwind v4 `@theme` + `:root`)

| Token | Value | Use |
|---|---|---|
| bg | `#F4EFE4` | page: warm ivory catalogue paper |
| panel | `#FFFDF7` | cards: paper white |
| raised | `#EFE8D9` | subtle fills, table header, hover |
| line | `#E2D9C6` | hairline rules |
| line-strong | `#CFC3AA` | inputs, emphasized rules |
| ink | `#16130E` | primary text, primary buttons |
| muted | `#6E6658` | secondary text |
| dim | `#9C937F` | captions |
| accent | `#B0894F` | **gold**: hammer price, #1 pick, live, focus |
| accent-soft | `#F5EBD6` | gold tint |
| money | `#2D6A48` | verified, sold, money in: catalogue green |
| money-soft | `#E5F0E8` | |
| lie | `#8E2A22` | **oxblood**: withdrawn, misrepresentation |
| lie-soft | `#F6E3DF` | |
| fee | `#94641F` | bronze: commission / fee |
| fee-soft | `#F6EBD6` | |
| agent | `#233F6E` | navy: AI agents (the bidders' clients) |
| agent-soft | `#E6ECF6` | |
| board | `#0F0E0C` | saleroom board background |
| board-2 | `#1A1814` | board rows |
| board-text | `#F3E9D2` | board numerals (warm white) |
| board-amber | `#E9B44C` | board highlights (current best, countdown) |

- **Radii:** cards 6px (catalogue, not bubbly), buttons 999px (pill) or 6px; the board is 10px.
- **Shadows:** cards have none, only a 1px line border, with paper-on-paper depth from the `raised` header. Use a soft elevated shadow only for drawers and toasts: `0 18px 40px rgba(22,19,14,.12)`.
- **Background:** flat `bg`, plus an optional ultra-subtle paper grain (an SVG noise at 3% opacity). Never a grid.

## Typography
- **Display & numerals:** **Instrument Serif** (`@fontsource/instrument-serif`, 400 + italic). Use it for headings, the lot title, the hammer price and the big board numbers. Italic for the lot "need" text, which feels like a catalogue entry.
- **UI text:** **Inter** (400/500/600), body 15/24.
- **Labels:** small caps, e.g. `LOT 08` and `PADDLE 214` (Inter 600, 11–12px, tracking 0.12em, uppercase, dim). Use them sparingly.
- **Code, tool names, IDs:** JetBrains Mono 13px.
- **Scale:**
  - Display 64/64 serif (landing).
  - Lot title 44/48 serif italic.
  - Board price 72/72 serif tabular.
  - H2 28/32 serif.
  - H3 16/22 Inter 600.

## Signature components
1. **Saleroom board** (the live centerpiece on `/exchange`). A black lacquer panel (`board`) with a thin gold inner rule.
   - **Top line:** `LOT 08 · Audio · Opened by Claude · Judge's agent`, in small caps with dim gold.
   - **Middle:** "Best verified offer", with the price in Instrument Serif 72px `board-text`; the merchant name and "Paddle 214" under it.
   - **Right:** the countdown, as a thin amber ring with seconds. In the last 3 seconds it shows **"Going once…" → "Going twice…" → "Sold"** (serif italic, fades).
   - **Bottom strip:** the lot's budget, deadline and must-haves as dim small caps.
   - When the auction closes, a **gavel** icon swings down. lucide `Gavel`, animated rotate -35° → 0° with a small impact shake. The board then shows `SOLD · $319.99 · Parcel & Pine`, with a gold underline sweep.
2. **Paddle list** (the bids): catalogue-style rows on paper with hairline rules.
   - **Each row:** paddle chip (a rounded tag with a 3-digit number derived from the merchant id, in the merchant's color), merchant name (Inter 600), product (muted), delivered price (serif tabular 22px, right), arrives (e.g. "2 days"), commission/fee (bronze, small), and status.
   - **Status:** `Checking…` (dim), `Verified` (green soft badge), or `Withdrawn: misrepresentation` (oxblood soft badge; the row's price is struck through, and the evidence is shown under the row in oxblood small text).
   - **After close:** the rank appears as a serif numeral, `No. 1` gets a gold left rule and a "Hammer" badge, and "Bribe ignored" appears as a bronze badge, e.g. `Offered $35 commission · still No. 5`.
3. **Withdrawn banner** (liar caught): a paper banner sliding from the top with an oxblood left edge. Heading `Bid withdrawn · DealDrop Direct`, line `Claimed $315.99 delivered · the checkout says $344.99 (+$29.00 "Service & handling fee")`.
4. **Sold toast:** a gold-edged paper card: `Sold to Claude · Judge's agent · $319.99`, with "commission $5.00 paid by merchant".
5. **Lot catalogue** (previous auctions): small cards like catalogue entries, `LOT 07` over the italic serif need and `Hammer $36.98 · Specsmith`.
6. **App shell:** a 60px paper top bar with a hairline bottom rule.
   - **Left:** a small gavel mark in an ink circle plus the "Bidwire" wordmark (Instrument Serif 26px).
   - **Nav:** text links (Inter 500), active = ink plus a gold underline.
   - **Right:** a "Live" chip (a small gold pulsing dot plus "Live"), "Merchant app" and "Approver phone".
7. **Buttons:**
   - Primary: ink pill with paper text.
   - Secondary: paper pill with a line-strong border.
   - Landing hero CTA: ink pill with a gold arrow.
   - Never use bright orange or blue buttons.

## Pages
- `/`: landing page (see below).
- `/exchange`: the saleroom, at ≥1280px.
  - **Top:** a KPI strip as one paper card with hairline dividers. Labels: Lots, Paddles raised, Verified, Withdrawn (lies), Bribes ignored, Sold, Hammer total (GMV), Commission. Numbers in serif 30px.
  - **Main, left 8 columns:** the **Saleroom board** with the **Paddle list** below it.
  - **Main, right 4 columns:** "Agent bidders" (live MCP calls styled as a saleroom phone-bank log: client badge, tool, result) and "Merchant standing" (trust as a thin gold bar). Below them, the QR card "Raise a paddle: scan to open a store".
  - **Below:** the lot catalogue.
  - Everything key fits at 1920×1080.
- `/merchant`: a mobile "Paddle" app.
  - **Join:** "Register as a bidder" (store name).
  - **Store:** your paddle number as a big serif number.
  - **Live lots:** the bid sheet, which works like raising a paddle: price, delivery, commission, and a warning when the claim is below the real checkout.
  - **Results:** shown as Hammer / Outbid / Withdrawn.
- `/phone`: an approver phone, iMessage-style bubbles on a light background. The approval card: "Your agent wants to bid $319.99 on Lot 08 · Limit $300" with Approve (ink) and Decline.
- `/connect`, `/ledger` ("Settlement ledger"), `/director` ("Auctioneer's desk"): the same shell and catalogue styling.

## Landing `/` (company site)
- **Hero:**
  - Eyebrow: "MCP server · Built for AI agents".
  - Display serif: **"The auction house for AI agents."**
  - Sub: "When an agent shops, nobody sees an ad. On Bidwire, merchants raise a paddle for an agent's purchase, and win only on verified price, delivery and specs."
  - CTAs: "Connect your agent" (ink) and "Enter the saleroom" (secondary → /exchange).
  - Right side: a live mini saleroom board fed by real data.
- **Then:**
  - The proof strip (real stats).
  - How a lot sells: 1 the agent calls `find_offers`, 2 paddles go up and every claim is checked against the real checkout, 3 sold within your human's limits.
  - "You can't bribe an agent." (ranking weights bar; commission 0 → only breaks ties).
  - For agents (tools and connect snippets).
  - For merchants ("Pay only at the hammer").
  - Trust & safety.
  - Footer: "Built at YC · Make Something Agents Want · Oct 2026".

## Motion
- Paddles rise in: rows slide up 8px and fade, and the paddle chip does a tiny 2° lift.
- The withdrawn stamp scales 1.08 → 1.
- At the gavel, the board price cross-fades to SOLD.
- Durations 180–260ms ease-out. The gavel is 420ms with a 2px shake.
- Optional gavel "knock" sound, synthesized with WebAudio, toggled in Director; it defaults to off.

## Copy
Use auction vocabulary consistently but keep it clear:
- Lot (auction), Paddle (merchant bid), Hammer price (winning delivered price).
- Withdrawn: misrepresentation (lied), Commission (merchant fee).
- Sold to (order), Settlement ledger (ledger), Auctioneer's desk (director).
- Keep plain-English subtitles where a judge might not know a term, e.g. "Hammer price: what the agent pays, delivered".
