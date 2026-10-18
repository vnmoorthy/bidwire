import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { Arrow, Button, Container, EASE, GITHUB_URL, LiveDot, Wordmark, cx } from "./ui";

const LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: "How it works", href: "#how" },
  { label: "For agents", href: "#agents" },
  { label: "For merchants", href: "#merchants" },
  { label: "Trust", href: "#trust" },
  { label: "GitHub", href: GITHUB_URL, external: true },
];

/** Smooth-scroll to an in-page section without involving the router. */
export function scrollToId(e: MouseEvent<HTMLElement>, href: string) {
  if (!href.startsWith("#")) return;
  const el = document.getElementById(href.slice(1));
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    window.history.replaceState(window.history.state, "", href);
  } catch {
    /* ignore */
  }
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || open;

  return (
    <header
      className={cx(
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200 ease-out",
        solid ? "border-line bg-panel/85 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <Container className="flex h-16 items-center gap-8">
        <Link to="/" className="rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/35" aria-label="Bidwire home">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={(e) => scrollToId(e, l.href)}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noreferrer" : undefined}
              className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[14px] font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/35"
            >
              {l.label}
              {l.external && <ArrowUpRight className="size-3.5 text-dim" aria-hidden />}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Button to="/exchange" variant="secondary" size="sm">
            <LiveDot />
            Live saleroom
          </Button>
          <Button to="/connect" variant="primary" size="sm">
            Connect your agent
            <Arrow className="size-3.5 text-accent" />
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto grid size-9 place-items-center rounded-full border border-line-strong bg-panel text-ink md:ml-0 xl:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </Container>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute inset-x-0 top-full border-b border-line bg-panel shadow-[0_18px_40px_rgba(22,19,14,0.12)] xl:hidden"
          >
            <Container className="py-2">
              <nav className="flex flex-col" aria-label="Mobile">
                {LINKS.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    onClick={(e) => {
                      scrollToId(e, l.href);
                      setOpen(false);
                    }}
                    target={l.external ? "_blank" : undefined}
                    rel={l.external ? "noreferrer" : undefined}
                    className="flex h-12 items-center justify-between border-b border-line text-[15px] font-medium text-ink last:border-b-0"
                  >
                    {l.label}
                    {l.external && <ArrowUpRight className="size-4 text-dim" aria-hidden />}
                  </a>
                ))}
              </nav>
              <div className="grid grid-cols-1 gap-2 pb-4 pt-2 sm:grid-cols-2 md:hidden">
                <Button to="/exchange" variant="secondary" size="md">
                  <LiveDot />
                  Live saleroom
                </Button>
                <Button to="/connect" variant="primary" size="md">
                  Connect your agent
                  <Arrow className="size-3.5 text-accent" />
                </Button>
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
