import type {
  Approval,
  Auction,
  Bid,
  LedgerEntry,
  Listing,
  Merchant,
  Order,
  Product,
  Snapshot,
} from "@shared/types";

export class ApiError extends Error {
  status: number;
  hint?: string;
  constructor(message: string, status: number, hint?: string) {
    super(message);
    this.status = status;
    this.hint = hint;
  }
}

async function req<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError("Can't reach the Bidwire server", 0, String((e as Error)?.message ?? e));
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && data.error) || `HTTP ${res.status}`;
    throw new ApiError(String(msg), res.status, data && typeof data === "object" ? data.hint : undefined);
  }
  return data as T;
}

export type ListingWithProduct = Listing & { product: Product };

export interface MerchantProfile {
  merchant: Merchant;
  listings: ListingWithProduct[];
  bids: Bid[];
  trust_history: { ts: number; trust: number; reason: string }[];
}

export interface JoinResult {
  merchant: Merchant;
  key: string;
  listings: ListingWithProduct[];
}

export interface PlaceBidBody {
  key: string;
  auction_id: string;
  listing_id: string;
  advertised_price_cents: number;
  ship_days: number;
  fee_cents: number;
  pitch?: string;
}

export interface MerchantFeed {
  open: Auction[];
  my_bids: Bid[];
}

export interface LedgerData {
  entries: LedgerEntry[];
  balances: { account: string; cents: number }[];
  orders: Order[];
}

export interface ToolMeta {
  name: string;
  title: string;
  description: string;
  role: "buyer" | "merchant" | "public";
  input_schema: any;
}

export interface ToolRunResult {
  ok: boolean;
  result: any;
  text: string;
  ms: number;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
}

export interface ConnectInfo {
  mcp_url: string;
  buyers: { id: string; name: string; key: string; client: string }[];
  snippets: { client: string; title: string; code: string }[];
}

export interface DemoAgentBody {
  buyer_id: string;
  need: string;
  budget_usd: number;
  deliver_within_days?: number;
  auto_buy?: boolean;
}

const enc = encodeURIComponent;

export const api = {
  state: () => req<Snapshot>("GET", "/api/state"),
  auction: (id: string) => req<Auction>("GET", `/api/auctions/${enc(id)}`),
  merchants: () => req<Merchant[]>("GET", "/api/merchants"),
  merchant: (id: string) => req<MerchantProfile>("GET", `/api/merchants/${enc(id)}`),
  join: (name: string) => req<JoinResult>("POST", "/api/merchants/join", { name }),
  placeBid: (merchantId: string, body: PlaceBidBody) => req<Bid>("POST", `/api/merchants/${enc(merchantId)}/bids`, body),
  feed: (merchantId: string, key: string) =>
    req<MerchantFeed>("GET", `/api/merchants/${enc(merchantId)}/feed?key=${enc(key)}`),
  approvals: () => req<Approval[]>("GET", "/api/approvals"),
  decide: (id: string, decision: "approve" | "deny", via = "bidwire phone") =>
    req<Approval>("POST", `/api/approvals/${enc(id)}/decide`, { decision, via }),
  ledger: () => req<LedgerData>("GET", "/api/ledger"),
  tools: () => req<ToolMeta[]>("GET", "/api/meta/tools"),
  runTool: (name: string, body: { args: unknown; buyer_id?: string; merchant_key?: string }) =>
    req<ToolRunResult>("POST", `/api/tools/${enc(name)}`, body),
  reset: () => req<Snapshot>("POST", "/api/demo/reset"),
  bots: (enabled: boolean) => req<unknown>("POST", "/api/demo/bots", { enabled }),
  setConfig: (cfg: { auction_ms?: number }) => req<unknown>("POST", "/api/demo/config", cfg),
  demoAgent: (body: DemoAgentBody) => req<{ run_id: string }>("POST", "/api/demo/agent", body),
  scenarios: () => req<Scenario[]>("GET", "/api/demo/scenarios"),
  runScenario: (id: string) => req<unknown>("POST", "/api/demo/scenario", { id }),
  connect: () => req<ConnectInfo>("GET", "/api/connect"),
  /** Same parser as a real SMS reply, e.g. "YES 4821" / "NO 4821". */
  phoneReply: (text: string) => req<any>("POST", "/api/phone/reply", { text }),
};

export function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.hint ? `${e.message} (${e.hint})` : e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
