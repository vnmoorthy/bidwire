import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, CircleCheck, CircleX, Landmark, Receipt, ShoppingBag, Store, Wallet } from "lucide-react";
import type { Buyer, LedgerEntry, Merchant } from "@shared/types";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { ClientBadge } from "@/components/ClientBadge";
import { Money } from "@/components/Money";
import { api, errMsg, type LedgerData } from "@/lib/api";
import { useLive } from "@/lib/store";
import { clock, money } from "@/lib/format";

function accountInfo(account: string, buyers: Buyer[], merchants: Merchant[]) {
  const [kind, id, sub] = account.split(":");
  if (kind === "buyer") {
    const b = buyers.find((x) => x.id === id);
    return { group: "Buyer wallets", label: `${b?.name ?? id}`, sub: sub ?? "wallet", client: b?.client };
  }
  if (kind === "merchant") {
    const m = merchants.find((x) => x.id === id);
    return { group: "Merchants", label: `${m?.name ?? id}`, sub: sub ?? "", color: m?.color };
  }
  if (kind === "platform") return { group: "Bidwire platform", label: "Bidwire", sub: id ?? "" };
  if (kind === "funding") {
    const b = buyers.find((x) => x.id === id);
    return { group: "Funding (outside money)", label: `Top-up for ${b?.name ?? id}`, sub: "funding" };
  }
  return { group: "Other", label: account, sub: "" };
}

const GROUP_ORDER = ["Buyer wallets", "Merchants", "Bidwire platform", "Funding (outside money)", "Other"];

export default function Ledger() {
  const ledgerVersion = useLive((s) => s.ledgerVersion);
  const stats = useLive((s) => s.stats);
  const buyers = useLive((s) => s.buyers);
  const merchants = useLive((s) => s.merchants);
  const [data, setData] = useState<LedgerData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      api
        .ledger()
        .then((d) => {
          if (!alive) return;
          setData(d);
          setErr(null);
        })
        .catch((e) => alive && setErr(errMsg(e)));
    }, 150);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [ledgerVersion]);

  const balances = data?.balances ?? [];
  const sum = (pred: (a: string) => boolean) => balances.filter((b) => pred(b.account)).reduce((n, b) => n + b.cents, 0);
  const walletsTotal = sum((a) => a.startsWith("buyer:"));
  const merchantTotal = sum((a) => a.startsWith("merchant:"));
  const grand = balances.reduce((n, b) => n + b.cents, 0);

  const groups = useMemo(() => {
    const g = new Map<string, { account: string; cents: number; info: ReturnType<typeof accountInfo> }[]>();
    for (const b of balances) {
      const info = accountInfo(b.account, buyers, merchants);
      if (!g.has(info.group)) g.set(info.group, []);
      g.get(info.group)!.push({ ...b, info });
    }
    return GROUP_ORDER.filter((k) => g.has(k)).map((k) => ({ name: k, rows: g.get(k)!.sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents)) }));
  }, [balances, buyers, merchants]);

  const txns = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    for (const e of data?.entries ?? []) {
      if (!map.has(e.txn_id)) map.set(e.txn_id, []);
      map.get(e.txn_id)!.push(e);
    }
    return [...map.entries()]
      .map(([id, entries]) => ({ id, entries, ts: Math.max(...entries.map((e) => e.ts)), total: entries.reduce((n, e) => n + e.delta_cents, 0) }))
      .sort((a, b) => b.ts - a.ts);
  }, [data]);

  const orders = data?.orders ?? [];
  const allBalanced = txns.every((t) => t.total === 0);

  return (
    <div className="mx-auto max-w-[1840px] px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="eyebrow">Settlement</div>
          <h1 className="serif mt-1 text-[46px] leading-[50px]">Settlement ledger</h1>
          <p className="mt-1 text-[16px] text-muted">A double-entry ledger: every sale moves real money between accounts, and every transaction sums to exactly $0.00.</p>
        </div>
        <div
          className={`ml-auto flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold ${
            allBalanced && grand === 0 ? "bg-money-soft text-money" : "bg-lie-soft text-lie"
          }`}
        >
          {allBalanced && grand === 0 ? <CircleCheck size={18} /> : <CircleX size={18} />}
          {txns.length} transactions · Σ all accounts = <span className="font-mono tnum">{money(grand)}</span>
        </div>
      </div>
      {err && <div className="mt-4 rounded-[10px] bg-lie-soft px-4 py-2 text-sm text-lie">{err}</div>}

      <div className="card mt-6 grid grid-cols-2 gap-px overflow-hidden bg-line lg:grid-cols-5">
        <Kpi icon={<ShoppingBag size={16} />} label="Hammer total (GMV)" color="text-money" value={<AnimatedNumber value={stats.gmv_cents} format={(n) => money(Math.round(n))} />} />
        <Kpi icon={<Receipt size={16} />} label="Commission" color="text-ink" value={<AnimatedNumber value={stats.platform_fees_cents} format={(n) => money(Math.round(n))} />} />
        <Kpi icon={<BookOpen size={16} />} label="Sold" color="text-ink" value={<AnimatedNumber value={stats.orders} />} />
        <Kpi icon={<Wallet size={16} />} label="Buyer wallets" color="text-ink" value={<AnimatedNumber value={walletsTotal} format={(n) => money(Math.round(n))} />} />
        <Kpi icon={<Store size={16} />} label="Merchant balances" color="text-ink" value={<AnimatedNumber value={merchantTotal} format={(n) => money(Math.round(n))} />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* orders */}
          <section className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3">
              <ShoppingBag size={15} className="text-muted" />
              <h2 className="card-title">Orders</h2>
              <span className="tnum ml-auto text-[13px] text-muted">{orders.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-[14px]">
                <thead className="text-[12px] text-muted">
                  <tr className="border-b border-line bg-raised">
                    <th className="px-5 py-2 font-semibold">Time</th>
                    <th className="px-3 py-2 font-semibold">Buyer</th>
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 font-semibold">Merchant</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2 text-right font-semibold">Fee</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-5 py-2 font-semibold">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const b = buyers.find((x) => x.id === o.buyer_id);
                    const m = merchants.find((x) => x.id === o.merchant_id);
                    return (
                      <motion.tr key={o.id} initial={{ backgroundColor: "rgba(18,128,92,0.08)" }} animate={{ backgroundColor: "rgba(18,128,92,0)" }} transition={{ duration: 1.5 }} className="h-14 border-b border-line last:border-0 hover:bg-raised">
                        <td className="tnum px-5 py-2.5 text-[13px] text-muted">{clock(o.created_at)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {b && <ClientBadge client={b.client} size="sm" />}
                            <span className="truncate">{o.buyer_name}</span>
                          </div>
                        </td>
                        <td className="max-w-[280px] truncate px-3 py-2.5 text-ink">{o.product_title}</td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="inline-block size-2 rounded-full" style={{ background: m?.color ?? "#8A96A6" }} />
                            {o.merchant_name}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Money cents={o.amount_cents} className="font-semibold text-money" />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Money cents={o.fee_cents} className="text-fee" />
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold capitalize ${
                              o.status === "paid" ? "bg-money-soft text-money" : o.status === "refunded" ? "bg-fee-soft text-fee" : "bg-lie-soft text-lie"
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-[12px] text-muted">{o.receipt_channel ? (o.receipt_channel === "inkbox" ? "Inkbox email" : "simulated") : "–"}</td>
                      </motion.tr>
                    );
                  })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-muted">
                        No orders yet. When an agent buys, the sale and the merchant's fee post here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* journal */}
          <section className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3">
              <BookOpen size={15} className="text-muted" />
              <h2 className="card-title">Journal</h2>
              <span className="text-[12px] text-dim">grouped by transaction</span>
              <span className="tnum ml-auto text-[13px] text-muted">{data?.entries.length ?? 0} entries</span>
            </div>
            <div className="max-h-[760px] divide-y divide-line overflow-y-auto">
              {txns.map((t) => (
                <div key={t.id} className="px-5 py-3">
                  <div className="mb-1.5 flex items-center gap-3">
                    <span className="font-mono text-[12px] text-dim">{t.id}</span>
                    <span className="tnum text-[13px] text-muted">{clock(t.ts)}</span>
                    {t.entries[0]?.order_id && <span className="font-mono text-[12px] text-muted">order {t.entries[0].order_id}</span>}
                    <span
                      className={`ml-auto inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold ${
                        t.total === 0 ? "bg-money-soft text-money" : "bg-lie-soft text-lie"
                      }`}
                    >
                      {t.total === 0 ? <CircleCheck size={12} /> : <CircleX size={12} />}
                      {t.total === 0 ? "Balanced" : `Off by ${money(t.total)}`}
                    </span>
                  </div>
                  <table className="w-full text-[14px]">
                    <tbody>
                      {t.entries.map((e) => {
                        const info = accountInfo(e.account, buyers, merchants);
                        return (
                          <tr key={e.id}>
                            <td className="w-[42%] py-0.5 pr-3">
                              <span className="text-ink">{info.label}</span>
                              <span className="ml-2 font-mono text-[11px] text-dim">{e.account}</span>
                            </td>
                            <td className="py-0.5 pr-3 text-muted">{e.memo}</td>
                            <td className="w-[120px] py-0.5 text-right">
                              <Money cents={e.delta_cents} sign className={e.delta_cents >= 0 ? "text-money" : "text-ink"} />
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t border-line">
                        <td colSpan={2} className="pt-1 text-right text-[12px] text-muted">
                          Σ
                        </td>
                        <td className="pt-1 text-right">
                          <Money cents={t.total} className={t.total === 0 ? "font-semibold text-money" : "font-semibold text-lie"} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
              {txns.length === 0 && <div className="px-5 py-8 text-center text-muted">{data ? "No ledger entries yet." : "Loading ledger…"}</div>}
            </div>
          </section>
        </div>

        {/* balances */}
        <section className="panel h-fit overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Landmark size={15} className="text-muted" />
            <h2 className="card-title">Balances by account</h2>
          </div>
          <div className="divide-y divide-line">
            {groups.map((g) => {
              const total = g.rows.reduce((n, r) => n + r.cents, 0);
              return (
                <div key={g.name} className="px-5 py-3">
                  <div className="mb-1.5 flex items-center">
                    <span className="text-[13px] font-semibold text-ink">{g.name}</span>
                    <Money cents={total} className="ml-auto text-[14px] font-semibold text-ink" />
                  </div>
                  {g.rows.map((r) => (
                    <div key={r.account} className="flex items-center gap-2 py-1 text-[14px]">
                      {"color" in r.info && r.info.color ? <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: r.info.color }} /> : null}
                      {"client" in r.info && r.info.client ? <ClientBadge client={r.info.client} size="sm" /> : null}
                      <span className="min-w-0 truncate text-ink">{r.info.label}</span>
                      <span className="shrink-0 font-mono text-[11px] text-dim">{r.info.sub}</span>
                      <Money cents={r.cents} className={`ml-auto shrink-0 ${r.cents < 0 ? "text-muted" : "text-ink"}`} />
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="flex items-center gap-2 bg-raised px-5 py-3 text-[14px]">
              {grand === 0 ? <CircleCheck size={16} className="text-money" /> : <CircleX size={16} className="text-lie" />}
              <span className="font-semibold">Σ every account</span>
              <Money cents={grand} className={`ml-auto font-bold ${grand === 0 ? "text-money" : "text-lie"}`} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="bg-panel px-5 py-4">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <span className="text-dim">{icon}</span>
        {label}
      </div>
      <div className={`mt-1 text-[28px] font-semibold leading-8 tracking-[-0.01em] ${color}`}>{value}</div>
    </div>
  );
}
