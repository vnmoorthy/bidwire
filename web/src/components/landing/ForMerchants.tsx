import { Gavel, ScanSearch, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { money } from "@/lib/format";
import { useLive } from "@/lib/store";
import { Arrow, Button, Container, Reveal, SectionHeading } from "./ui";

interface Tile {
  Icon: LucideIcon;
  title: string;
  body: string;
  fact: ReactNode | null;
}

export function ForMerchants() {
  const stats = useLive((s) => s.stats);
  const orders = useLive((s) => s.orders);
  const merchants = useLive((s) => s.merchants);
  const hydrated = useLive((s) => s.hydrated);

  const last = orders[0];
  const byTrust = [...merchants].sort((a, b) => b.trust - a.trust);
  const top = byTrust[0];
  const worst = [...merchants].filter((m) => m.lies_caught > 0).sort((a, b) => a.trust - b.trust)[0];

  const tiles: Tile[] = [
    {
      Icon: ScanSearch,
      title: "Claims checked, not trusted",
      body: "Your delivered price, shipping time and specs are checked against your live checkout. Honest paddles rank; misrepresented ones are withdrawn.",
      fact:
        hydrated && stats.bids > 0 ? (
          <>
            <b className="font-semibold text-ink tabular-nums">{stats.verified}</b> of {stats.bids} paddles verified on this exchange
          </>
        ) : null,
    },
    {
      Icon: Gavel,
      title: "Commission only at the hammer",
      body: "Name any commission per sale. It is charged only when an agent buys from you, and it never buys rank.",
      fact: last ? (
        <>
          Last sale <b className="font-semibold text-ink tabular-nums">{money(last.amount_cents)}</b> · commission{" "}
          <span className="tabular-nums text-fee">{money(last.fee_cents)}</span>
        </>
      ) : null,
    },
    {
      Icon: TrendingUp,
      title: "Standing that compounds",
      body: "Every verified sale raises your trust score for every agent on the exchange. Every withdrawn bid cuts it.",
      fact: top ? (
        <>
          {top.name} at <b className="font-semibold text-ink tabular-nums">{top.trust}</b>
          {worst && worst.id !== top.id ? (
            <>
              {" "}
              · {worst.name} at <b className="font-semibold tabular-nums text-lie">{worst.trust}</b>
            </>
          ) : null}
        </>
      ) : null,
    },
  ];

  return (
    <section id="merchants" className="scroll-mt-16 border-y border-line bg-panel">
      <Container className="py-24 md:py-32">
        <Reveal className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="For merchants"
            title="Pay only at the hammer."
            sub="No ad auctions, no keyword bidding. Raise a paddle on live purchase requests from agents with real budgets. Commission is charged only when an agent buys, and honest offers win more often."
          />
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <Button to="/merchant" variant="primary" size="lg">
              Open a store
              <Arrow className="text-accent" />
            </Button>
            {merchants.length > 0 && (
              <span className="text-[13px] text-muted">
                <b className="font-semibold tabular-nums text-ink">{merchants.length}</b> stores hold a paddle today
              </span>
            )}
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 md:mt-16 md:grid-cols-3">
          {tiles.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.06} className="h-full">
              <article className="flex h-full flex-col rounded-[6px] border border-line bg-bg/60 p-6">
                <span className="grid size-10 place-items-center rounded-full border border-line-strong bg-panel text-ink">
                  <t.Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-6 font-serif text-[26px] font-normal leading-[30px] text-ink">{t.title}</h3>
                <p className="mt-3 flex-1 text-[14.5px] leading-6 text-muted">{t.body}</p>
                {t.fact && (
                  <p className="mt-6 border-t border-line pt-4 text-[12.5px] leading-5 text-muted">
                    <span className="mr-2 inline-block size-1.5 -translate-y-px rounded-full bg-accent align-middle" aria-hidden />
                    {t.fact}
                  </p>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
