import { Gavel } from "lucide-react";

/** Small gavel mark in an ink circle. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink text-[#F3E9D2]" style={{ width: size, height: size }} aria-hidden>
      <Gavel size={Math.round(size * 0.56)} strokeWidth={2.1} />
    </span>
  );
}

export function Wordmark({ size = 26, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <div className="leading-none">
        <div className="serif text-[26px] leading-none text-ink">Bidwire</div>
        {tagline && <div className="mt-1 text-[12px] text-muted">The auction house for AI agents</div>}
      </div>
    </div>
  );
}
