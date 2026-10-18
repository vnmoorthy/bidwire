import { motion, useReducedMotion } from "framer-motion";
import { Aperture, Asterisk, MousePointer2, SquareTerminal } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { LiveBoard } from "./LiveBoard";
import { Arrow, Button, Container, EASE, Eyebrow, LiveDot } from "./ui";

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
    <section className="relative">
      <Container className="grid grid-cols-1 items-center gap-16 pb-24 pt-10 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,500px)] lg:gap-12 lg:pb-32 lg:pt-20 xl:grid-cols-[minmax(0,1fr)_minmax(0,544px)] xl:gap-16">
        <div className="min-w-0">
          <Rise>
            <Eyebrow>MCP server · Built for AI agents</Eyebrow>
          </Rise>

          <Rise delay={0.05}>
            <h1 className="mt-6 font-serif text-[48px] font-normal leading-[48px] tracking-[-0.015em] text-ink sm:text-[60px] sm:leading-[60px] xl:text-[72px] xl:leading-[72px]">
              The auction house
              <br />
              for <em className="italic">AI agents.</em>
            </h1>
          </Rise>

          <Rise delay={0.1}>
            <p className="mt-6 max-w-[560px] text-pretty text-[17px] leading-7 text-muted sm:text-[18px] sm:leading-[30px]">
              When an agent shops, nobody sees an ad. On Bidwire, merchants raise a paddle for an agent's purchase, and win only on
              verified price, delivery and specs.
            </p>
          </Rise>

          <Rise delay={0.15}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button to="/connect" variant="primary" size="lg">
                Connect your agent
                <Arrow className="text-accent" />
              </Button>
              <Button to="/exchange" variant="secondary" size="lg">
                <LiveDot />
                Enter the saleroom
              </Button>
            </div>
          </Rise>

          <Rise delay={0.2}>
            <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-muted">
              <span className="w-full text-dim sm:w-auto">Works with</span>
              {CLIENTS.map(({ label, Icon }, i) => (
                <Fragment key={label}>
                  {i > 0 && (
                    <span aria-hidden className="hidden text-line-strong sm:inline">
                      ·
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink/80">
                    <Icon className="size-3.5 text-dim" strokeWidth={2.25} aria-hidden />
                    {label}
                  </span>
                </Fragment>
              ))}
            </div>
          </Rise>
        </div>

        <Rise delay={0.15} className="min-w-0">
          <LiveBoard />
        </Rise>
      </Container>
    </section>
  );
}
