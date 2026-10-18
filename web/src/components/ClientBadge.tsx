import { clientInfo } from "@/lib/clients";

const SIZES = {
  sm: { pill: "h-5 gap-1 pl-0.5 pr-2 text-[11.5px]", dot: "size-4 text-[9px]" },
  md: { pill: "h-6 gap-1.5 pl-0.5 pr-2.5 text-[12px]", dot: "size-5 text-[10px]" },
  lg: { pill: "h-7 gap-1.5 pl-1 pr-3 text-[13px]", dot: "size-5 text-[10.5px]" },
};

const GLYPH: Record<string, string> = {
  claude: "✳",
  chatgpt: "◎",
  codex: "›_",
  cursor: "▲",
  playground: "▷",
  guest: "G",
  demo: "D",
};

/** Agent client badge: agent-soft background, agent text, with a small client glyph. */
export function ClientBadge({ client, size = "md", className = "" }: { client: string; size?: keyof typeof SIZES; className?: string }) {
  const c = clientInfo(client);
  const s = SIZES[size];
  const glyph = GLYPH[c.key] ?? c.label.slice(0, 1).toUpperCase();
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-agent-soft font-semibold text-agent ${s.pill} ${className}`} title={client}>
      <span className={`inline-flex items-center justify-center rounded-full bg-white font-bold leading-none text-agent ${s.dot}`}>{glyph}</span>
      {c.label}
    </span>
  );
}
