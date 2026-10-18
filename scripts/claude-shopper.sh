#!/usr/bin/env bash
# A real Claude Code agent shops on Bidwire over MCP.
# Usage: scripts/claude-shopper.sh "noise cancelling headphones for long flights" 400 5
set -euo pipefail
URL="${BIDWIRE_MCP_URL:-http://localhost:8787/mcp}"
NEED="${1:-noise cancelling headphones for long flights}"; BUDGET="${2:-400}"; DAYS="${3:-5}"
CFG=$(mktemp); trap 'rm -f "$CFG"' EXIT
printf '{"mcpServers":{"bidwire":{"type":"http","url":"%s","headers":{"Authorization":"Bearer %s"}}}}' "$URL" "${BIDWIRE_KEY:-bw_buy_claude_demo}" > "$CFG"
claude -p "You are my shopping agent. Use the bidwire MCP tools. Find me: ${NEED}. Budget ${BUDGET} dollars, delivered within ${DAYS} days. Show the top 3 verified offers with delivered price and why each ranked there, name anyone excluded for lying and why, then buy the #1 offer. If it needs my approval, tell me to check my phone and wait for it." \
  --mcp-config "$CFG" --strict-mcp-config \
  --allowedTools "mcp__bidwire__find_offers,mcp__bidwire__get_offers,mcp__bidwire__buy_offer,mcp__bidwire__check_approval,mcp__bidwire__get_wallet,mcp__bidwire__explain_offer,mcp__bidwire__report_offer" < /dev/null
