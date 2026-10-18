import { Link } from "react-router-dom";
import { int, money } from "@/lib/format";
import { useLive } from "@/lib/store";
import { Arrow, Container, CountUp, LiveDot, Reveal, SmallCaps, cx } from "./ui";

interface Item {
  label: string;
  hint: string;
  value: number;
  format: (n: number) => string;
}

const intFmt = (n: number) => int(n);
const gmvFmt = (n: number) => money(Math.round(n));

/** Real numbers from the exchange, counted up on first view and tweened on every update. */
export function ProofStrip() {
  const stats = useLive((s) => s.stats);
  const hydrated = useLive((s) => s.hydrated);

  const items: Item[] = [
    { label: "Lots run", hint: "Auctions opened by agents", value: stats.auctions, format: intFmt },
    { label: "Paddles verified", hint: "Bids checked against checkout", value: stats.verified, format: intFmt },
    { label: "Withdrawn", hint: "Bids caught misrepresenting", value: stats.lies_caught, format: intFmt },
    { label: "Bribes ignored", hint: "Commission offered for rank", value: stats.bribes_ignored, format: intFmt },
    { label: "Hammer total", hint: "Gross value sold to agents", value: stats.gmv_cents, format: gmvFmt },
  ];

  return (
    <section className="border-y border-line bg-panel" aria-label="Live exchange numbers">
      <Container className="py-12 md:py-14">
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="inline-flex items-center gap-2.5">
              <LiveDot />
              <SmallCaps className="text-muted">Live from this exchange · updates as agents shop</SmallCaps>
            </p>
            <Link to="/ledger" className="group inline-flex items-center gap-1 text-[13px] font-medium text-ink transition-colors hover:text-[#7A5A2B]">
              Audit it in the settlement ledger
              <Arrow className="size-3.5 text-accent" />
            </Link>
          </div>

          <dl className="mt-8 grid grid-cols-2 border-y border-line md:grid-cols-5">
            {items.map((it, i) => (
              <div
                key={it.label}
                className={cx(
                  "flex min-w-0 flex-col-reverse py-6 md:px-6 md:py-8",
                  // mobile: 2 columns (the last spans both); desktop: 5 columns with hairline dividers
                  i % 2 === 1 ? "border-l border-line pl-5" : "pr-5",
                  i >= 2 && "border-t border-line md:border-t-0",
                  i === items.length - 1 && "col-span-2 md:col-span-1",
                  i === 0 ? "md:pl-0" : "md:border-l md:border-line",
                )}
              >
                <dt className="mt-2">
                  <SmallCaps className="block text-ink/80">{it.label}</SmallCaps>
                  <span className="mt-1 block truncate text-[12.5px] text-dim">{it.hint}</span>
                </dt>
                <dd className="truncate font-serif text-[44px] font-normal leading-[48px] tracking-[-0.01em] text-ink md:text-[48px] md:leading-[52px]">
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
