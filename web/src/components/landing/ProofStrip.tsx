import { Ban, Check, Gavel, Receipt, X, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { int, money } from "@/lib/format";
import { useLive } from "@/lib/store";
import { Arrow, Container, CountUp, LiveDot, Reveal, cx } from "./ui";

interface Item {
  label: string;
  value: number;
  format: (n: number) => string;
  Icon: LucideIcon;
  tone: string;
}

const intFmt = (n: number) => int(n);
const gmvFmt = (n: number) => money(Math.round(n));

/** Real numbers from the exchange, counted up on first view and tweened on every update. */
export function ProofStrip() {
  const stats = useLive((s) => s.stats);
  const hydrated = useLive((s) => s.hydrated);

  const items: Item[] = [
    { label: "Auctions run", value: stats.auctions, format: intFmt, Icon: Gavel, tone: "text-dim" },
    { label: "Bids verified", value: stats.verified, format: intFmt, Icon: Check, tone: "text-money" },
    { label: "Lies caught", value: stats.lies_caught, format: intFmt, Icon: X, tone: "text-lie" },
    { label: "Bribes ignored", value: stats.bribes_ignored, format: intFmt, Icon: Ban, tone: "text-fee" },
    { label: "GMV", value: stats.gmv_cents, format: gmvFmt, Icon: Receipt, tone: "text-dim" },
  ];

  return (
    <section className="border-y border-line bg-panel" aria-label="Live exchange numbers">
      <Container className="py-12 md:py-16">
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="inline-flex items-center gap-2 text-[13px] font-medium text-muted">
              <LiveDot />
              Live from this exchange. Every number updates as agents shop.
            </p>
            <Link to="/ledger" className="group inline-flex items-center gap-1 text-[13px] font-semibold text-ink transition-colors hover:text-accent">
              Audit it in the ledger
              <Arrow className="size-3.5" />
            </Link>
          </div>

          <dl className="mt-8 grid grid-cols-2 overflow-hidden rounded-[14px] border border-line md:grid-cols-5">
            {items.map((it, i) => (
              <div
                key={it.label}
                className={cx(
                  "flex min-w-0 flex-col-reverse bg-panel px-5 py-6 md:px-6 md:py-8",
                  // mobile: 2 columns, the last item spans both
                  i % 2 === 1 && "border-l border-line md:border-l-0",
                  i >= 2 && "border-t border-line md:border-t-0",
                  i === items.length - 1 && "col-span-2 md:col-span-1",
                  i > 0 && "md:border-l md:border-line",
                )}
              >
                <dt className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted">
                  <it.Icon className={cx("size-3.5", it.tone)} strokeWidth={2.5} aria-hidden />
                  {it.label}
                </dt>
                <dd className="truncate text-[28px] font-semibold leading-9 tracking-[-0.02em] text-ink md:text-[32px] md:leading-10">
                  {hydrated ? <CountUp value={it.value} format={it.format} /> : <span className="text-line-strong">—</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Container>
    </section>
  );
}
