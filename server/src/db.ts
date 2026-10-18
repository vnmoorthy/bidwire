// SQLite persistence (node:sqlite, no native deps). Every piece of state lives in rows, not process memory,
// so the MCP server is restart-safe and the ledger is auditable.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_PATH = resolve(process.env.BIDWIRE_DB ?? "data/bidwire.db");
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  sku TEXT PRIMARY KEY, title TEXT NOT NULL, brand TEXT NOT NULL, category TEXT NOT NULL,
  specs TEXT NOT NULL, features TEXT NOT NULL, msrp_cents INTEGER NOT NULL, emoji TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, handle TEXT UNIQUE NOT NULL, kind TEXT NOT NULL, strategy TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL, trust REAL NOT NULL, color TEXT NOT NULL, categories TEXT NOT NULL,
  balance_cents INTEGER NOT NULL DEFAULT 0, earned_cents INTEGER NOT NULL DEFAULT 0, fees_paid_cents INTEGER NOT NULL DEFAULT 0,
  bids INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, lies_caught INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS trust_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id TEXT NOT NULL, ts INTEGER NOT NULL, trust REAL NOT NULL, reason TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY, merchant_id TEXT NOT NULL REFERENCES merchants(id), sku TEXT NOT NULL REFERENCES products(sku),
  price_cents INTEGER NOT NULL, shipping_cents INTEGER NOT NULL, hidden_fee_cents INTEGER NOT NULL DEFAULT 0, hidden_fee_label TEXT,
  ship_days INTEGER NOT NULL, stock INTEGER NOT NULL, returns_days INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS buyers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, client TEXT NOT NULL, key TEXT UNIQUE NOT NULL, human_name TEXT NOT NULL,
  phone TEXT, email TEXT, per_purchase_limit_cents INTEGER NOT NULL, daily_limit_cents INTEGER NOT NULL,
  wallet_cents INTEGER NOT NULL, spent_today_cents INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auctions (
  id TEXT PRIMARY KEY, buyer_id TEXT NOT NULL REFERENCES buyers(id), client TEXT NOT NULL, need TEXT NOT NULL,
  category TEXT, must_have TEXT NOT NULL, budget_cents INTEGER NOT NULL, deliver_within_days INTEGER,
  status TEXT NOT NULL, opened_at INTEGER NOT NULL, closes_at INTEGER NOT NULL, closed_at INTEGER, winner_bid_id TEXT
);
CREATE TABLE IF NOT EXISTS bids (
  id TEXT PRIMARY KEY, auction_id TEXT NOT NULL REFERENCES auctions(id), merchant_id TEXT NOT NULL REFERENCES merchants(id),
  listing_id TEXT NOT NULL REFERENCES listings(id), claimed_price_cents INTEGER NOT NULL, claimed_shipping_cents INTEGER NOT NULL,
  claimed_ship_days INTEGER NOT NULL, claimed_features TEXT NOT NULL, fee_cents INTEGER NOT NULL, pitch TEXT NOT NULL,
  created_at INTEGER NOT NULL, verify_status TEXT NOT NULL, evidence TEXT, merit REAL, rank INTEGER, why TEXT NOT NULL DEFAULT '[]',
  bribe_ignored INTEGER NOT NULL DEFAULT 0, UNIQUE(auction_id, merchant_id)
);
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY, code TEXT NOT NULL, buyer_id TEXT NOT NULL, auction_id TEXT NOT NULL, bid_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL, limit_cents INTEGER NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL, channel TEXT NOT NULL,
  created_at INTEGER NOT NULL, decided_at INTEGER, decided_via TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, auction_id TEXT NOT NULL, bid_id TEXT UNIQUE NOT NULL, buyer_id TEXT NOT NULL, merchant_id TEXT NOT NULL,
  sku TEXT NOT NULL, amount_cents INTEGER NOT NULL, fee_cents INTEGER NOT NULL, status TEXT NOT NULL,
  receipt_channel TEXT, idempotency_key TEXT UNIQUE, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY, ts INTEGER NOT NULL, txn_id TEXT NOT NULL, order_id TEXT, account TEXT NOT NULL,
  delta_cents INTEGER NOT NULL, memo TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, ts INTEGER NOT NULL, channel TEXT NOT NULL, direction TEXT NOT NULL, to_addr TEXT NOT NULL,
  from_addr TEXT NOT NULL, subject TEXT, body TEXT NOT NULL, related_id TEXT, provider TEXT NOT NULL, status TEXT NOT NULL, error TEXT
);
CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY, ts INTEGER NOT NULL, client TEXT NOT NULL, caller TEXT NOT NULL, role TEXT NOT NULL, tool TEXT NOT NULL,
  args TEXT NOT NULL, ok INTEGER NOT NULL, summary TEXT NOT NULL, ms INTEGER NOT NULL, tokens INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, ts INTEGER NOT NULL, bid_id TEXT NOT NULL, buyer_id TEXT NOT NULL, issue TEXT NOT NULL, outcome TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_bids_auction ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_txn ON ledger(txn_id);
`;
db.exec(SCHEMA);

const TABLES = ["reports", "tool_calls", "messages", "ledger", "orders", "approvals", "bids", "auctions", "buyers", "listings", "trust_history", "merchants", "products", "settings"];

export function wipe() {
  db.exec("PRAGMA foreign_keys = OFF;");
  for (const t of TABLES) db.exec(`DELETE FROM ${t};`);
  db.exec("PRAGMA foreign_keys = ON;");
}

type Param = string | number | null | bigint;
export const all = <T = any>(sql: string, ...p: Param[]) => db.prepare(sql).all(...p) as T[];
export const get = <T = any>(sql: string, ...p: Param[]) => db.prepare(sql).get(...p) as T | undefined;
export const run = (sql: string, ...p: Param[]) => db.prepare(sql).run(...p);
export function tx<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
}

export function setting(k: string): string | undefined { return get<{ v: string }>("SELECT v FROM settings WHERE k = ?", k)?.v; }
export function setSetting(k: string, v: string) { run("INSERT INTO settings(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", k, v); }

let counter = 0;
export function id(prefix: string) {
  counter = (counter + 1) % 1296;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(2, "0")}${Math.random().toString(36).slice(2, 6)}`;
}
