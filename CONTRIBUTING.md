# Contributing to Bidwire

Thanks for helping build the exchange agents can trust. Bug reports, new merchant strategies, verifier checks, client integrations and docs fixes are all welcome.

## Set up

You need Node.js 22.13 or newer (Bidwire uses the built-in `node:sqlite`).

```bash
git clone https://github.com/vnmoorthy/bidwire.git
cd bidwire
npm install
npm run build     # builds the web app once
npm run dev       # server on :8787, restarts on changes
npm run web       # optional: Vite on :5173 with hot reload, proxying to :8787
```

No API keys are needed. State lives in `data/bidwire.db`; `POST /api/demo/reset` (or deleting the file) re-seeds it.

## Test

With the server running:

```bash
npm test                                          # 24 end-to-end checks against http://localhost:8787
BIDWIRE_URL=https://your-host npm test            # or against another deployment
```

CI (`.github/workflows/ci.yml`) builds the web app, starts the server and runs the same suite on every push and pull request.

## Where things live

| You want to… | Look at |
| --- | --- |
| add or change an MCP tool | `server/src/tools.ts`: one registry serves MCP, the `/api/tools` playground and the demo agent |
| change verification, ranking, approvals or the ledger | `server/src/exchange.ts` |
| add a merchant bot strategy | `server/src/bots.ts` and the personas in `server/src/catalog.ts` |
| add products or categories | `server/src/catalog.ts` |
| change resources or prompts | `server/src/mcp.ts` |
| change the HTTP API or SSE events | `server/src/http.ts`, `server/src/bus.ts` and `shared/types.ts` |
| work on the web app | `web/src`, following `docs/DESIGN.md` |

## Guidelines

- **Write tools for agents.** Clear titles, descriptions that say when to call the tool and what to call next, zod schemas with `.describe()` on every argument, and accurate annotations (`readOnly`, `destructive`, `openWorld`).
- **Make errors actionable.** Throw `BidwireError(code, message, hint)` so the agent gets a stable `error` code and a `hint` it can follow.
- **Money is integer cents; timestamps are epoch milliseconds.** Every ledger transaction must sum to zero.
- **Keep the exchange honest.** Changes must never let a fee change rank beyond the tie-break, or let an unverified claim reach the ranking or the charge.
- **Update the docs** (README MCP reference, `docs/API.md`, `docs/ARCHITECTURE.md`) when you change tools, endpoints or events.
- Never commit secrets. `.env` is git-ignored; document new settings in `.env.example`.

## Pull requests

1. Fork and branch from `main`.
2. Keep the change focused and describe the behavior before and after.
3. Make sure `npm test` passes against a fresh server.
4. Open the PR. Screenshots or a short clip help for UI changes.

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
