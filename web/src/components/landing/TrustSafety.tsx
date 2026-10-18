import { BookOpenCheck, MessageSquareText, ScrollText, ShieldCheck, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { int, money, plural } from "@/lib/format";
import { useLive } from "@/lib/store";
import { Arrow, Container, Reveal, SectionHeading } from "./ui";

interface Tile {
  Icon: LucideIcon;
  title: string;
  body: string;
  fact: ReactNode | null;
  link?: { to: string; label: string };
}

export function TrustSafety() {
  const stats = useLive((s) => s.stats);
  const buyers = useLive((s) => s.buyers);
  const hydrated = useLive((s) => s.hydrated);

  const tiles: Tile[] = [
    {
      Icon: ShieldCheck,
      title: "Checked against the live checkout",
      body: "For every paddle, Bidwire fetches the merchant's product page and checkout quote. Drip pricing and stretched specs are withdrawn before an agent ever sees them.",
      fact: hydrated ? (
        <>
          <b className="font-semibold tabular-nums text-ink">{int(stats.lies_caught)}</b> misrepresentations caught so far
        </>
      ) : null,
    },
    {
      Icon: MessageSquareText,
      title: "Limits, with approval by text",
      body: "Per-purchase and daily limits on every agent wallet. Anything above them is texted to a human, who approves with a one-word reply.",
      fact:
        buyers.length > 0 ? (
          <>
            <b className="font-semibold tabular-nums text-ink">{buyers.length}</b> agent wallets with spending limits
          </>
        ) : null,
    },
    {
      Icon: BookOpenCheck,
      title: "Double-entry settlement ledger",
      body: "Every sale and commission posts as balanced entries that sum to zero, so wallets, revenue and fees reconcile to the cent.",
      fact: hydrated ? (
        <>
          <b className="font-semibold tabular-nums text-ink">{int(stats.orders)}</b> {stats.orders === 1 ? "sale" : "sales"} settled ·{" "}
          {money(stats.platform_fees_cents)} commission
        </>
      ) : null,
      link: { to: "/ledger", label: "Open the ledger" },
    },
    {
      Icon: ScrollText,
      title: "An audit trail of every tool call",
      body: "Each MCP call is logged with the agent, its arguments, the result and the latency, so any purchase can be explained after the fact.",
      fact: hydrated ? (
        <>
          <b className="font-semibold tabular-nums text-ink">{int(stats.tool_calls)}</b> tool {stats.tool_calls === 1 ? "call" : "calls"} from{" "}
          {plural(stats.agents_seen, "agent")}
        </>
      ) : null,
    },
  ];

  return (
    <section id="trust" className="scroll-mt-16">
      <Container className="py-24 md:py-32">
        <Reveal>
          <SectionHeading
            eyebrow="Trust & safety"
            title="Safe to let an agent spend."
            sub="Every claim is checked, every dollar is accounted for, and every action is on the record."
          />
        </Reveal>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 md:mt-16 lg:grid-cols-4">
          {tiles.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.05} className="h-full">
              <article className="flex h-full flex-col rounded-[6px] border border-line bg-panel p-6">
                <span className="grid size-10 place-items-center rounded-full border border-line-strong bg-bg text-ink">
                  <t.Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-6 text-[16px] font-semibold leading-[22px] text-ink">{t.title}</h3>
                <p className="mt-2 flex-1 text-[14px] leading-[22px] text-muted">{t.body}</p>
                {(t.fact || t.link) && (
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[12.5px] leading-5 text-muted">
                    {t.fact && (
                      <span>
                        <span className="mr-2 inline-block size-1.5 -translate-y-px rounded-full bg-accent align-middle" aria-hidden />
                        {t.fact}
                      </span>
                    )}
                    {t.link && (
                      <Link to={t.link.to} className="group inline-flex items-center gap-1 font-medium text-ink hover:text-[#7A5A2B]">
                        {t.link.label}
                        <Arrow className="size-3.5 text-accent" />
                      </Link>
                    )}
                  </div>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
