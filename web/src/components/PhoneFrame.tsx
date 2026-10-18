import type { ReactNode } from "react";
import { useMedia } from "@/lib/useMedia";

/** On phones: full screen. On desktop (lg+): an iPhone-style mockup centered on the page. Children mount once. */
export function PhoneFrame({ children, caption }: { children: ReactNode; caption?: ReactNode }) {
  const desktop = useMedia("(min-width: 1024px)");
  if (!desktop) return <div className="min-h-[100dvh] bg-panel">{children}</div>;
  return (
    <div className="mx-auto flex min-h-[calc(100vh-60px)] max-w-[1440px] items-center justify-center gap-20 px-10 py-8">
      {caption && <div className="max-w-[440px]">{caption}</div>}
      <div className="relative shrink-0 rounded-[56px] bg-[#16130E] p-[11px] shadow-[0_30px_60px_-20px_rgba(22,19,14,0.35),0_0_0_1px_rgba(14,14,16,0.08)]">
        <div className="pointer-events-none absolute left-1/2 top-[22px] z-20 h-[30px] w-[112px] -translate-x-1/2 rounded-full bg-[#16130E]" />
        <div className="phone-screen relative h-[844px] w-[390px] overflow-hidden rounded-[46px] bg-panel">
          <div className="h-full overflow-y-auto overflow-x-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}
