import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Activity, BadgeCheck, CircleAlert, Gavel, MessageSquareText, RotateCcw, Scale, ShieldAlert, ShoppingBag, Store, Terminal, Tag } from "lucide-react";
import { useLive, type TickerItem, type TickKind } from "@/lib/store";
import { clock } from "@/lib/format";

const KIND: Record<TickKind, { icon: typeof Activity; cls: string }> = {
  auction: { icon: Gavel, cls: "text-accent" },
  bid: { icon: Tag, cls: "text-dim" },
  verified: { icon: BadgeCheck, cls: "text-money" },
  lie: { icon: ShieldAlert, cls: "text-lie" },
  closed: { icon: Gavel, cls: "text-money" },
  bribe: { icon: Scale, cls: "text-fee" },
  sold: { icon: ShoppingBag, cls: "text-money" },
  fail: { icon: CircleAlert, cls: "text-lie" },
  approval: { icon: MessageSquareText, cls: "text-agent" },
  merchant: { icon: Store, cls: "text-accent" },
  tool: { icon: Terminal, cls: "text-agent" },
  message: { icon: MessageSquareText, cls: "text-dim" },
  reset: { icon: RotateCcw, cls: "text-dim" },
};

const SPEED = 60; // px per second
const MAX_QUEUE = 26;

/** A calm exchange ticker: new events enter from the right; older ones recycle while it's quiet. */
export function Ticker() {
  const ticker = useLive((s) => s.ticker);
  const mcpUrl = useLive((s) => s.config?.mcp_url);
  const [items, setItems] = useState<TickerItem[]>([]);
  const seen = useRef(new Set<string>());
  const trackRef = useRef<HTMLDivElement>(null);
  const offset = useRef<number | null>(null);
  const count = useRef(0);
  count.current = items.length;

  useEffect(() => {
    const fresh = ticker.filter((t) => !seen.current.has(t.id)).sort((a, b) => a.ts - b.ts);
    if (!fresh.length) return;
    for (const t of fresh) seen.current.add(t.id);
    setItems((q) => {
      let next = [...q, ...fresh];
      if (next.length > MAX_QUEUE) {
        const head = next.slice(0, 4);
        const tail = next.slice(4);
        const excess = next.length - MAX_QUEUE;
        const drop = new Set(
          tail
            .map((t, i) => ({ ts: t.ts, i }))
            .sort((a, b) => a.ts - b.ts)
            .slice(0, excess)
            .map((x) => x.i),
        );
        next = [...head, ...tail.filter((_, i) => !drop.has(i))];
      }
      return next;
    });
  }, [ticker]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const track = trackRef.current;
      if (track && count.current > 0) {
        if (offset.current === null) offset.current = 0;
        offset.current -= SPEED * dt;
        const first = track.firstElementChild as HTMLElement | null;
        if (first && first.offsetWidth > 0 && -offset.current >= first.offsetWidth) {
          const w = first.offsetWidth;
          flushSync(() => setItems((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q)));
          offset.current += w;
        }
        track.style.transform = `translate3d(${offset.current.toFixed(2)}px,0,0)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 h-10 overflow-hidden border-t border-line bg-panel">
      <div className="absolute left-0 top-0 z-10 flex h-full items-center gap-2 border-r border-line bg-panel px-4">
        <span className="size-2 rounded-full bg-accent animate-pulse-dot" />
        <span className="text-[13px] font-semibold text-ink">Live wire</span>
      </div>
      <div className="fade-x ml-[112px] h-full overflow-hidden">
        {items.length === 0 ? (
          <div className="flex h-full items-center gap-2 px-6 text-[14px] text-muted">
            Exchange online{mcpUrl ? ` · MCP endpoint ${mcpUrl}` : ""} · waiting for the first agent
          </div>
        ) : (
          <div ref={trackRef} className="flex h-full w-max items-center will-change-transform">
            {items.map((t) => {
              const k = KIND[t.kind] ?? KIND.tool;
              const Icon = k.icon;
              return (
                <span key={t.id} className="flex items-center gap-2 whitespace-nowrap pr-10 text-[14px]">
                  <span className="tnum text-[12px] text-dim">{clock(t.ts)}</span>
                  <Icon size={14} className={k.cls} />
                  <span className={t.kind === "lie" ? "text-lie" : t.kind === "bribe" ? "text-fee" : t.kind === "sold" ? "text-money" : "text-ink/80"}>{t.text}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
