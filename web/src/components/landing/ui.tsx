import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Copy, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { copyText } from "@/lib/format";

/* Landing-page primitives. Self-contained so the marketing site does not depend on app chrome. */

export const GITHUB_URL = "https://github.com/vnmoorthy/bidwire";
export const EASE = [0.16, 1, 0.3, 1] as const;

export function cx(...c: Array<string | false | null | undefined>): string {
  return c.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ layout */

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("mx-auto w-full max-w-[1248px] px-4 sm:px-6", className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-[12px] font-semibold uppercase leading-4 tracking-[0.06em] text-dim", className)}>{children}</p>;
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
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-4 text-balance text-[30px] font-semibold leading-[36px] tracking-[-0.025em] text-ink md:text-[40px] md:leading-[48px]">
        {title}
      </h2>
      {sub && <p className="mt-4 text-pretty text-[17px] leading-7 text-muted">{sub}</p>}
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

/* ------------------------------------------------------------------ buttons */

type Variant = "accent" | "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const BTN_BASE =
  "group inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/25 active:translate-y-px disabled:pointer-events-none disabled:opacity-60";

const BTN_VARIANT: Record<Variant, string> = {
  accent:
    "bg-accent text-white shadow-[0_1px_2px_rgba(14,14,16,0.10),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-[#E04C15]",
  primary:
    "bg-ink text-white shadow-[0_1px_2px_rgba(14,14,16,0.10),inset_0_1px_0_rgba(255,255,255,0.10)] hover:bg-[#2A2A2F]",
  secondary:
    "border border-line-strong bg-panel text-ink shadow-[0_1px_2px_rgba(14,14,16,0.04)] hover:border-[#C8C7BF] hover:bg-[#FBFBF9]",
  ghost: "text-muted hover:text-ink",
};

const BTN_SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[14px]",
  md: "h-10 px-4 text-[14px]",
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

export type Tone = "money" | "lie" | "accent" | "fee" | "agent" | "neutral";

const TONE: Record<Tone, string> = {
  money: "bg-money-soft text-money",
  lie: "bg-lie-soft text-lie",
  accent: "bg-accent-soft text-accent",
  fee: "bg-fee-soft text-fee",
  agent: "bg-agent-soft text-agent",
  neutral: "bg-raised text-muted",
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

/** The brand LIVE dot: the only element on the page that pulses continuously. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cx("relative inline-flex size-2 shrink-0", className)} aria-hidden>
      <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-40" style={{ animationDuration: "1.8s" }} />
      <span className="relative inline-flex size-2 rounded-full bg-accent" />
    </span>
  );
}

/** 22px ink rounded square with the bid line and the orange dot. */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="#0E0E10" />
      <path
        d="M7 21.5 11.5 15l4 3.5L20 11h3.2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25" cy="11" r="2.9" fill="#F2561D" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <LogoMark size={22} />
      <span className="text-[16px] font-semibold tracking-[-0.015em] text-ink">Bidwire</span>
    </span>
  );
}

/* ------------------------------------------------------------------ merchant avatar */

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

const WHITE: [number, number, number] = [255, 255, 255];
const INK: [number, number, number] = [14, 14, 16];

/** Merchant colors were picked for a dark UI; tint them light and deepen the text for contrast. */
export function tint(color: string): { bg: string; fg: string } {
  const rgb = parseHex(color);
  if (!rgb) return { bg: "#F4F4F1", fg: "#5D5D66" };
  return { bg: mix(rgb, WHITE, 0.84), fg: mix(rgb, INK, 0.5) };
}

export function initials(name: string): string {
  const words = (name ?? "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function MerchantAvatar({ name, color, size = 28, className }: { name: string; color: string; size?: number; className?: string }) {
  const t = tint(color);
  const style: CSSProperties = { width: size, height: size, background: t.bg, color: t.fg, fontSize: size >= 28 ? 11 : 9.5 };
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-full font-bold tracking-[0.02em]", className)} style={style} aria-hidden>
      {initials(name)}
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
        "inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line bg-panel px-2.5 text-[12px] font-semibold text-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/25",
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
    } else if (m[3] !== undefined)
      out.push(
        <span key={k} className="text-fee">
          {m[3]}
        </span>,
      );
    else if (m[4] !== undefined)
      out.push(
        <span key={k} className="text-fee">
          {m[4]}
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
    <code className={cx("rounded-[6px] border border-line bg-raised px-1.5 py-0.5 font-mono text-[0.86em] font-medium text-ink", className)}>
      {children}
    </code>
  );
}
