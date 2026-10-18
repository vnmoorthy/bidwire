import { Bot, Cpu, User } from "lucide-react";
import type { MerchantKind } from "@shared/types";

const MAP: Record<MerchantKind, { label: string; cls: string; Icon: typeof Bot }> = {
  bot: { label: "Bot", cls: "bg-raised text-muted", Icon: Bot },
  human: { label: "Human", cls: "bg-accent-soft text-accent", Icon: User },
  agent: { label: "Agent", cls: "bg-agent-soft text-agent", Icon: Cpu },
};

export function KindBadge({ kind, className = "" }: { kind: MerchantKind; className?: string }) {
  const k = MAP[kind] ?? MAP.bot;
  const { Icon } = k;
  return (
    <span className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold ${k.cls} ${className}`}>
      <Icon size={11} strokeWidth={2.4} />
      {k.label}
    </span>
  );
}
