// Shared contract between the Bidwire server and the web app.
// All money is integer cents. All timestamps are epoch milliseconds.

export type Cents = number;

export type MerchantKind = "bot" | "human" | "agent";
export type BidVerifyStatus = "pending" | "verified" | "mismatch";
export type AuctionStatus = "open" | "verifying" | "closed";
export type ApprovalStatus = "pending" | "approved" | "denied" | "expired";
export type OrderStatus = "paid" | "failed" | "refunded";
export type MessageChannel = "sms" | "email";
export type Provider = "inkbox" | "simulated";

export interface Product {
  sku: string;
  title: string;
  brand: string;
  category: string;
  specs: Record<string, string | number | boolean>;
  features: string[]; // normalized feature tags, e.g. "anc", "usb-c", "wireless"
  msrp_cents: Cents;
  emoji: string;
}

export interface Listing {
  id: string;
  merchant_id: string;
  sku: string;
  price_cents: Cents; // the real price on the storefront page
  shipping_cents: Cents;
  hidden_fee_cents: Cents; // only revealed at checkout (drip pricing)
  hidden_fee_label: string | null;
  ship_days: number;
  stock: number;
  returns_days: number;
  url: string; // storefront page the verifier fetches
}

export interface Merchant {
  id: string;
  name: string;
  handle: string;
  kind: MerchantKind;
  strategy: string; // bot persona, "human" or "agent"
  trust: number; // 0..100
  color: string;
  categories: string[];
  balance_cents: Cents; // prepaid fee balance
  earned_cents: Cents;
  fees_paid_cents: Cents;
  bids: number;
  wins: number;
  lies_caught: number;
  created_at: number;
}

export interface Buyer {
  id: string;
  name: string; // agent name, e.g. "Claude (Judge 1)"
  client: string; // claude | chatgpt | codex | cursor | playground | guest
  human_name: string;
  phone: string | null;
  email: string | null;
  per_purchase_limit_cents: Cents;
  daily_limit_cents: Cents;
  wallet_cents: Cents;
  spent_today_cents: Cents;
  created_at: number;
}

export interface VerifyEvidence {
  url: string;
  fetched_ms: number;
  claimed_total_cents: Cents;
  actual_total_cents: Cents;
  claimed_ship_days: number;
  actual_ship_days: number;
  in_stock: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
  summary: string; // one line, e.g. "Claimed $149.00 delivered; checkout says $179.00 (+$30 'service fee')"
}

export interface Bid {
  id: string;
  auction_id: string;
  merchant_id: string;
  merchant_name: string;
  merchant_color: string;
  merchant_kind: MerchantKind;
  listing_id: string;
  sku: string;
  product_title: string;
  product_emoji: string;
  claimed_price_cents: Cents;
  claimed_shipping_cents: Cents;
  claimed_ship_days: number;
  claimed_features: string[];
  fee_cents: Cents; // what the merchant bids to pay per sale (CPA). Never buys rank.
  pitch: string;
  created_at: number;
  verify_status: BidVerifyStatus;
  evidence: VerifyEvidence | null;
  merit: number | null; // 0..100, null until ranked
  rank: number | null; // 1-based among eligible offers
  why: string[]; // human-readable ranking reasons
  bribe_ignored: boolean; // true when a higher fee did not change rank
}

export interface Auction {
  id: string;
  buyer_id: string;
  buyer_name: string;
  client: string;
  need: string;
  category: string | null;
  must_have: string[];
  budget_cents: Cents;
  deliver_within_days: number | null;
  status: AuctionStatus;
  opened_at: number;
  closes_at: number;
  closed_at: number | null;
  winner_bid_id: string | null;
  bids: Bid[];
}

export interface Approval {
  id: string;
  code: string; // 4-digit code included in the SMS
  buyer_id: string;
  buyer_name: string;
  human_name: string;
  auction_id: string;
  bid_id: string;
  amount_cents: Cents;
  limit_cents: Cents;
  reason: string;
  status: ApprovalStatus;
  channel: Provider;
  created_at: number;
  decided_at: number | null;
  decided_via: string | null;
}

export interface Order {
  id: string;
  auction_id: string;
  bid_id: string;
  buyer_id: string;
  buyer_name: string;
  merchant_id: string;
  merchant_name: string;
  sku: string;
  product_title: string;
  amount_cents: Cents;
  fee_cents: Cents;
  status: OrderStatus;
  receipt_channel: Provider | null;
  created_at: number;
}

export interface LedgerEntry {
  id: string;
  ts: number;
  txn_id: string; // entries sharing a txn_id always sum to zero
  order_id: string | null;
  account: string; // e.g. "buyer:b_123:wallet", "merchant:m_9:revenue", "platform:fees"
  delta_cents: Cents;
  memo: string;
}

export interface Message {
  id: string;
  ts: number;
  channel: MessageChannel;
  direction: "out" | "in";
  to: string;
  from: string;
  subject: string | null;
  body: string;
  related_id: string | null;
  provider: Provider;
  status: "sent" | "failed" | "received";
  error: string | null;
}

export interface ToolCall {
  id: string;
  ts: number;
  client: string; // MCP clientInfo name or "playground"
  caller: string; // buyer/merchant display name
  role: "buyer" | "merchant" | "anon";
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  summary: string;
  ms: number;
  tokens: number; // rough size of the result the agent had to read
}

export interface Stats {
  auctions: number;
  bids: number;
  verified: number;
  lies_caught: number;
  bribes_ignored: number;
  orders: number;
  gmv_cents: Cents;
  platform_fees_cents: Cents;
  tool_calls: number;
  agents_seen: number;
  approvals_pending: number;
}

export interface Snapshot {
  stats: Stats;
  config: {
    auction_ms: number;
    bots_enabled: boolean;
    public_url: string;
    mcp_url: string;
    providers: { payments: "ledger"; messaging: Provider };
    approver_phone_set: boolean;
    receipt_email_set: boolean;
  };
  auctions: Auction[]; // most recent first, max 20
  merchants: Merchant[];
  buyers: Buyer[];
  orders: Order[]; // most recent first, max 50
  approvals: Approval[]; // most recent first, max 20
  messages: Message[]; // most recent first, max 50
  tool_calls: ToolCall[]; // most recent first, max 60
}

// Server-sent events on GET /api/stream. Each SSE message is JSON: { type, ts, data }.
export type BidwireEvent =
  | { type: "hello"; ts: number; data: Snapshot }
  | { type: "auction.opened"; ts: number; data: Auction }
  | { type: "bid.placed"; ts: number; data: Bid }
  | { type: "bid.verified"; ts: number; data: Bid }
  | { type: "bid.flagged"; ts: number; data: Bid }
  | { type: "auction.closed"; ts: number; data: Auction }
  | { type: "approval.requested"; ts: number; data: Approval }
  | { type: "approval.decided"; ts: number; data: Approval }
  | { type: "order.created"; ts: number; data: Order }
  | { type: "order.failed"; ts: number; data: { auction_id: string; bid_id: string; reason: string } }
  | { type: "merchant.joined"; ts: number; data: Merchant }
  | { type: "merchant.updated"; ts: number; data: Merchant }
  | { type: "buyer.updated"; ts: number; data: Buyer }
  | { type: "message"; ts: number; data: Message }
  | { type: "tool.call"; ts: number; data: ToolCall }
  | { type: "ledger.posted"; ts: number; data: LedgerEntry[] }
  | { type: "stats"; ts: number; data: Stats }
  | { type: "demo.reset"; ts: number; data: Snapshot }
  | { type: "config"; ts: number; data: Snapshot["config"] };
