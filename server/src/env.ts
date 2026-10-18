import { existsSync } from "node:fs";

if (existsSync(".env")) {
  try { process.loadEnvFile(".env"); } catch { /* ignore malformed .env */ }
}

const port = Number(process.env.PORT || 8787);
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

export const config = {
  port,
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, ""),
  internalUrl: `http://127.0.0.1:${port}`,
  auctionMs: Number(process.env.AUCTION_MS || 12000),
  inkboxApiKey: clean(process.env.INKBOX_API_KEY),
  inkboxIdentity: clean(process.env.INKBOX_IDENTITY),
  approverPhone: clean(process.env.APPROVER_PHONE),
  receiptEmail: clean(process.env.RECEIPT_EMAIL),
  directorKey: clean(process.env.DIRECTOR_KEY) ?? `dk_${Math.random().toString(36).slice(2, 12)}`,
};
