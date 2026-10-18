import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Copy, Gavel, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { copyText } from "@/lib/format";

/* Landing-page primitives for the "Saleroom" system (docs/DESIGN.md v3).
   Self-contained so the marketing site does not depend on app chrome. */

export const GITHUB_URL = "https://github.com/vnmoorthy/bidwire";
export const EASE = [0.16, 1, 0.3, 1] as const;

export function cx(...c: Array<string | false | null | undefined>): string {
  return c.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ layout */

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("mx-auto w-full max-w-[1248px] px-4 sm:px-6", className)}>{children}</div>;
}

/** Small caps label: Inter 600, 11–12px, tracking 0.12em. */
export function SmallCaps({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("text-[11px] font-semibold uppercase leading-4 tracking-[0.12em]", className)}>{children}</span>;
}

/** Section eyebrow: a short gold rule plus a small-caps label. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("flex items-center gap-3", className)}>
      <span aria-hidden className="h-px w-6 bg-accent" />
      <SmallCaps className="text-muted">{children}</SmallCaps>
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  center = false,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("max-w-[640px]", center && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow className={center ? "justify-center" : undefined}>{eyebrow}</Eyebrow>}
      <h2 className="mt-5 text-balance font-serif text-[40px] font-normal leading-[42px] tracking-[-0.01em] text-ink md:text-[52px] md:leading-[54px]">
        {title}
      </h2>
      {sub && <p className="mt-5 text-pretty text-[17px] leading-7 text-muted">{sub}</p>}
    </div>
  );
}

/** Fades content up 12px the first time it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 12,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -64px 0px" }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Ultra-subtle paper grain (SVG noise at ~3%), fixed behind the content. */
export function PaperGrain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.035] mix-blend-multiply"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.09  0 0 0 0 0.07  0 0 0 0 0.05  0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

/* ------------------------------------------------------------------ buttons (pills) */

type Variant = "primary" | "secondary" | "onDark" | "onDarkGhost";
type Size = "sm" | "md" | "lg";

const BTN_BASE =
  "group inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,border-color,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/35 active:translate-y-px disabled:pointer-events-none disabled:opacity-60";

const BTN_VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-panel hover:bg-[#2B261E]",
  secondary: "border border-line-strong bg-panel text-ink hover:border-[#BCAE92] hover:bg-[#FFFEFA]",
  onDark: "bg-board-text text-ink hover:bg-white",
  onDarkGhost: "border border-board-text/25 text-board-text hover:border-board-text/50 hover:bg-white/[0.04]",
};

const BTN_SIZE: Record<Size, string> = {
  sm: "h-9 px-4 text-[14px]",
  md: "h-10 px-5 text-[14px]",
  lg: "h-12 px-6 text-[15px]",
};

export function Arrow({ className }: { className?: string }) {
  return (
    <ArrowRight
      aria-hidden
      strokeWidth={2.25}
      className={cx("size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5", className)}
    />
  );
}

export function Button({
  to,
  href,
  onClick,
  variant = "primary",
  size = "md",
  className,
  children,
  disabled,
  title,
}: {
  to?: string;
  href?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  const cls = cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className);
  if (to)
    return (
      <Link to={to} className={cls} onClick={onClick} title={title}>
        {children}
      </Link>
    );
  if (href)
    return (
      <a href={href} className={cls} onClick={onClick} target="_blank" rel="noreferrer" title={title}>
        {children}
      </a>
    );
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ badges and marks */

export type Tone = "money" | "lie" | "accent" | "fee" | "agent" | "neutral" | "hammer";

const TONE: Record<Tone, string> = {
  money: "bg-money-soft text-money",
  lie: "bg-lie-soft text-lie",
  accent: "bg-accent-soft text-[#7A5A2B]",
  fee: "bg-fee-soft text-fee",
  agent: "bg-agent-soft text-agent",
  neutral: "bg-raised text-muted",
  hammer: "bg-ink text-board-amber",
};

export function Badge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold leading-none",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cx("size-3.5 animate-spin", className)} />;
}

/** The small gold LIVE dot: the only element on the page that pulses continuously. */
export function LiveDot({ className, color = "bg-accent" }: { className?: string; color?: string }) {
  return (
    <span className={cx("relative inline-flex size-2 shrink-0", className)} aria-hidden>
      <span className={cx("absolute inset-0 animate-ping rounded-full opacity-50", color)} style={{ animationDuration: "1.8s" }} />
      <span className={cx("relative inline-flex size-2 rounded-full", color)} />
    </span>
  );
}

/** The mark: a small gavel in an ink circle. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("grid shrink-0 place-items-center rounded-full bg-ink text-board-text", className)}
      style={{ width: size, height: size }}
    >
      <Gavel style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2} />
    </span>
  );
}

export function Wordmark({ className, size = 26 }: { className?: string; size?: number }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={Math.round(size * 1.08)} />
      <span className="font-serif font-normal leading-none tracking-[-0.01em] text-ink" style={{ fontSize: size }}>
        Bidwire
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ paddle chip */

function parseHex(hex: string): [number, number, number] | null {
  let h = (hex ?? "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const PAPER: [number, number, number] = [255, 253, 247];
const INK: [number, number, number] = [22, 19, 14];

/** Merchant colors were picked for a dark UI; tint them for paper and deepen the text. */
export function tint(color: string): { bg: string; fg: string; rule: string } {
  const rgb = parseHex(color);
  if (!rgb) return { bg: "#EFE8D9", fg: "#6E6658", rule: "#CFC3AA" };
  return { bg: mix(rgb, PAPER, 0.82), fg: mix(rgb, INK, 0.55), rule: mix(rgb, PAPER, 0.45) };
}

/** A rounded tag with the merchant's 3-digit paddle number, in the merchant's color. */
export function PaddleChip({ n, color, className, size = "md" }: { n: number; color: string; className?: string; size?: "sm" | "md" }) {
  const t = tint(color);
  const style: CSSProperties = { background: t.bg, color: t.fg, boxShadow: `inset 0 0 0 1px ${t.rule}` };
  return (
    <span
      className={cx(
        "inline-grid shrink-0 place-items-center rounded-[6px] font-semibold tabular-nums tracking-[0.02em]",
        size === "sm" ? "h-5 min-w-[34px] px-1 text-[10.5px]" : "h-7 min-w-[42px] px-1.5 text-[12px]",
        className,
      )}
      style={style}
      aria-label={`Paddle ${n}`}
    >
      {n}
    </span>
  );
}

/* ------------------------------------------------------------------ numbers */

/** Counts up from 0 the first time it is visible, then tweens between live values. */
export function CountUp({
  value,
  format,
  ready = true,
  className,
}: {
  value: number;
  format: (n: number) => string;
  ready?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const reduce = useReducedMotion();
  const current = useRef(0);
  const started = useRef(false);
  const fmt = useRef(format);
  fmt.current = format;
  const [text, setText] = useState(() => format(0));

  useEffect(() => {
    if (!inView || !ready) return;
    if (reduce) {
      current.current = value;
      setText(fmt.current(value));
      return;
    }
    const from = current.current;
    const first = !started.current;
    started.current = true;
    if (from === value) {
      setText(fmt.current(value));
      return;
    }
    const controls = animate(from, value, {
      duration: first ? 1.4 : 0.8,
      ease: EASE,
      onUpdate: (v) => {
        current.current = v;
        setText(fmt.current(v));
      },
    });
    return () => controls.stop();
  }, [inView, ready, value, reduce]);

  return (
    <span ref={ref} className={cx("tabular-nums", className)}>
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ copy */

export function CopyChip({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        }
      }}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-panel px-3 text-[12px] font-medium text-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/35",
        className,
      )}
      aria-label={done ? "Copied" : label}
    >
      {done ? <Check className="size-3.5 text-money" strokeWidth={2.5} /> : <Copy className="size-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

/* ------------------------------------------------------------------ code highlighting (tiny, JSON-ish) */

const TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b|(\/\/.*$|^\s*#.*$)/g;

export function highlightLine(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(line))) {
    if (m[0] === "") {
      TOKEN.lastIndex++;
      continue;
    }
    if (m.index > last) out.push(line.slice(last, m.index));
    const k = `t${i++}`;
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        out.push(
          <span key={k} className="text-agent">
            {m[1]}
          </span>,
          m[2],
        );
      } else
        out.push(
          <span key={k} className="text-money">
            {m[1]}
          </span>,
        );
    } else if (m[3] !== undefined || m[4] !== undefined)
      out.push(
        <span key={k} className="text-fee">
          {m[3] ?? m[4]}
        </span>,
      );
    else if (m[5] !== undefined)
      out.push(
        <span key={k} className="text-dim">
          {m[5]}
        </span>,
      );
    last = TOKEN.lastIndex;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function CodeLines({ code, className }: { code: string; className?: string }) {
  const lines = code.split("\n");
  return (
    <pre className={cx("font-mono text-[12.5px] leading-[20px] text-ink", className)}>
      <code>
        {lines.map((l, i) => (
          <span key={i} className="block min-h-[20px]">
            {highlightLine(l)}
          </span>
        ))}
      </code>
    </pre>
  );
}

/** Small inline code token, e.g. `find_offers`. */
export function Tool({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code className={cx("rounded-[4px] border border-line bg-raised/70 px-1.5 py-px font-mono text-[0.84em] font-medium text-ink", className)}>
      {children}
    </code>
  );
}
