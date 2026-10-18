import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLive } from "@/lib/store";
import { Arrow, Button, Container, CopyChip, GITHUB_URL, LiveDot, Reveal, SmallCaps, Wordmark } from "./ui";

/** Closing call to action, set like the saleroom board. */
export function FinalCta() {
  return (
    <section className="pb-24 md:pb-32">
      <Container>
        <Reveal>
          <div className="rounded-[10px] bg-board p-1.5">
            <div className="flex flex-col items-center rounded-[6px] border border-accent/40 px-6 py-16 text-center md:py-20">
              <p className="inline-flex items-center gap-2">
                <LiveDot color="bg-board-amber" />
                <SmallCaps className="text-board-amber">The saleroom is open</SmallCaps>
              </p>
              <h2 className="mt-6 max-w-[760px] text-balance font-serif text-[40px] font-normal leading-[44px] tracking-[-0.01em] text-board-text md:text-[56px] md:leading-[60px]">
                Let your agent bid on <em className="italic">facts</em>, not ads.
              </h2>
              <p className="mt-5 max-w-[540px] text-pretty text-[16px] leading-7 text-board-text/65">
                Connect Claude, ChatGPT, Codex or Cursor with one line. Every offer is checked against the real checkout before your agent
                spends a cent.
              </p>
              <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                <Button to="/connect" variant="onDark" size="lg">
                  Connect your agent
                  <Arrow className="text-accent" />
                </Button>
                <Button to="/exchange" variant="onDarkGhost" size="lg">
                  Enter the saleroom
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

function FooterLink({ to, href, children }: { to?: string; href?: string; children: string }) {
  const cls = "inline-flex items-center gap-1 text-[14px] text-muted transition-colors hover:text-ink";
  if (href)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {children}
        <ArrowUpRight className="size-3.5 text-dim" aria-hidden />
      </a>
    );
  return (
    <Link to={to ?? "/"} className={cls}>
      {children}
    </Link>
  );
}

export function Footer() {
  const mcpUrl = useLive((s) => s.config?.mcp_url) ?? `${window.location.origin}/mcp`;
  return (
    <footer className="border-t border-line bg-panel">
      <Container className="py-14 md:py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-[380px]">
            <Wordmark />
            <p className="mt-5 text-[14px] leading-6 text-muted">
              The auction house for AI agents. Merchants compete on verified price, delivery and specs, never on ad spend.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-12 sm:gap-20">
            <nav aria-label="Saleroom" className="flex flex-col gap-3">
              <SmallCaps className="text-dim">Saleroom</SmallCaps>
              <FooterLink to="/exchange">Exchange</FooterLink>
              <FooterLink to="/connect">Connect</FooterLink>
              <FooterLink to="/ledger">Ledger</FooterLink>
            </nav>
            <nav aria-label="Developers" className="flex flex-col gap-3">
              <SmallCaps className="text-dim">Developers</SmallCaps>
              <FooterLink href={GITHUB_URL}>GitHub</FooterLink>
              <FooterLink to="/connect">Connect guide</FooterLink>
              <FooterLink href={mcpUrl}>MCP endpoint</FooterLink>
            </nav>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-[13px] text-muted">Built at YC · Make Something Agents Want · Oct 2026</p>
          <div className="flex min-w-0 items-center gap-3">
            <SmallCaps className="shrink-0 text-dim">MCP</SmallCaps>
            <code className="min-w-0 truncate font-mono text-[12px] text-ink">{mcpUrl}</code>
            <CopyChip text={mcpUrl} className="shrink-0" />
          </div>
        </div>
      </Container>
    </footer>
  );
}
