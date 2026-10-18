import { motion, useReducedMotion } from "framer-motion";
import { Aperture, Asterisk, MousePointer2, Plug, SquareTerminal } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { LiveAuctionCard } from "./LiveAuctionCard";
import { Arrow, Button, Container, EASE, LiveDot } from "./ui";

const CLIENTS = [
  { label: "Claude", Icon: Asterisk },
  { label: "ChatGPT", Icon: Aperture },
  { label: "Codex", Icon: SquareTerminal },
  { label: "Cursor", Icon: MousePointer2 },
];

function Rise({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <Container className="grid grid-cols-1 items-center gap-16 pb-24 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-12 lg:pb-32 lg:pt-20 xl:grid-cols-[minmax(0,1fr)_minmax(0,540px)] xl:gap-16">
        <div className="min-w-0">
          <Rise>
            <span className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-panel pl-1.5 pr-3.5 text-[13px] font-medium text-muted shadow-[0_1px_2px_rgba(14,14,16,0.04)]">
              <span className="grid size-5 place-items-center rounded-full bg-agent-soft text-agent">
                <Plug className="size-3" strokeWidth={2.5} aria-hidden />
              </span>
              MCP server · Built for AI agents
            </span>
          </Rise>

          <Rise delay={0.05}>
            <h1 className="mt-6 text-[40px] font-semibold leading-[44px] tracking-[-0.03em] text-ink sm:text-[48px] sm:leading-[52px] xl:text-[56px] xl:leading-[60px]">
              The ad exchange
              <br />
              for AI agents.
            </h1>
          </Rise>

          <Rise delay={0.1}>
            <p className="mt-6 max-w-[620px] text-pretty text-[17px] leading-7 text-muted sm:text-[18px]">
              When an agent shops, nobody sees an ad. Bidwire lets merchants compete for an agent's purchase on verified
              price, delivery and specs, and nothing else.
            </p>
          </Rise>

          <Rise delay={0.15}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button to="/connect" variant="accent" size="lg">
                Connect your agent
                <Arrow />
              </Button>
              <Button to="/exchange" variant="secondary" size="lg">
                <LiveDot />
                Watch it live
              </Button>
            </div>
          </Rise>

          <Rise delay={0.2}>
            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-muted">
              <span className="w-full text-dim sm:w-auto">Works with</span>
              {CLIENTS.map(({ label, Icon }, i) => (
                <Fragment key={label}>
                  {i > 0 && (
                    <span aria-hidden className="hidden text-line-strong sm:inline">
                      ·
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Icon className="size-3.5 text-dim" strokeWidth={2.25} aria-hidden />
                    {label}
                  </span>
                </Fragment>
              ))}
            </div>
          </Rise>
        </div>

        <Rise delay={0.15} className="min-w-0">
          <LiveAuctionCard />
        </Rise>
      </Container>
    </section>
  );
}
