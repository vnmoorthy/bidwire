import { useLive } from "@/lib/store";

const LABEL = { live: "Live", polling: "Live · polling", connecting: "Connecting", reconnecting: "Reconnecting" } as const;

export function LivePill({ className = "" }: { className?: string }) {
  const conn = useLive((s) => s.conn);
  const ok = conn === "live" || conn === "polling";
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-semibold ${
        ok ? "border-line-strong bg-panel text-ink" : "border-[#e3cfa6] bg-fee-soft text-fee"
      } ${className}`}
      title={
        conn === "live"
          ? "Streaming live from /api/stream"
          : conn === "polling"
            ? "Live via polling /api/state every 1.5s (the stream is buffered on this network)"
            : "Connection lost: reconnecting…"
      }
    >
      <span className={`inline-block size-2 rounded-full ${ok ? "bg-accent animate-pulse-dot" : "bg-fee"}`} />
      {LABEL[conn]}
    </span>
  );
}
