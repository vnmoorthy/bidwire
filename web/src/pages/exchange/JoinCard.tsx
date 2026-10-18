import { QRCodeSVG } from "qrcode.react";
import { useLive } from "@/lib/store";

export function joinUrl(publicUrl: string | undefined) {
  const base = (publicUrl || window.location.origin).replace(/\/+$/, "");
  return `${base}/merchant`;
}

export function JoinCard({ big = false }: { big?: boolean }) {
  const publicUrl = useLive((s) => s.config?.public_url);
  const url = joinUrl(publicUrl);
  const size = big ? 168 : 108;
  return (
    <section className="card flex shrink-0 items-center gap-5 p-4">
      <div className="shrink-0 rounded-[4px] border border-line bg-[#FFFDF7] p-2">
        <QRCodeSVG value={url} size={size} bgColor="#FFFDF7" fgColor="#16130E" level="M" marginSize={0} />
      </div>
      <div className="min-w-0">
        <div className="serif text-[26px] leading-7">Raise a paddle</div>
        <div className="mt-1 text-[14px] leading-[20px] text-muted">Scan to open a store and bid against the bots. Misstate your price and your paddle is withdrawn.</div>
        <a href={url} target="_blank" rel="noreferrer" className="mt-1.5 block break-all font-mono text-[12px] leading-snug text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
          {url.replace(/^https?:\/\//, "")}
        </a>
      </div>
    </section>
  );
}
