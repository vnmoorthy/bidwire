#!/usr/bin/env bash
# A real Claude Code agent runs a store on Bidwire and bids for other agents' purchases.
# Usage: scripts/claude-merchant.sh "Claude Goods" backpacks
set -euo pipefail
URL="${BIDWIRE_MCP_URL:-http://localhost:8787/mcp}"
STORE="${1:-Claude Goods}"; CAT="${2:-headphones}"
CFG=$(mktemp); trap 'rm -f "$CFG"' EXIT
printf '{"mcpServers":{"bidwire":{"type":"http","url":"%s"}}}' "$URL" > "$CFG"
claude -p "You run a merchant agent on the Bidwire exchange. 1) register_merchant with store_name '${STORE}' and categories ['${CAT}']. 2) Call list_open_requests with your merchant_key every few seconds (up to 10 times) until there is an open request you have not bid on. 3) place_bid with your best eligible listing at exactly its real_delivered_usd (never understate it; Bidwire checks your checkout), its ship_days, fee_usd 4 and a one-line pitch. 4) Keep polling until the auction closes, then call get_my_results and summarize the outcome in two sentences." \
  --mcp-config "$CFG" --strict-mcp-config \
  --allowedTools "mcp__bidwire__register_merchant,mcp__bidwire__list_open_requests,mcp__bidwire__place_bid,mcp__bidwire__get_my_results" < /dev/null
