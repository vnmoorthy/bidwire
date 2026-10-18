import { QRCodeSVG } from "qrcode.react";
import { useLive } from "@/lib/store";

export function joinUrl(publicUrl: string | undefined) {
  const base = (publicUrl || window.location.origin).replace(/\/+$/, "");
  return `${base}/merchant`;
}

export function JoinCard({ big = false }: { big?: boolean }) {
  const publicUrl = useLive((s) => s.config?.public_url);
  const url = joinUrl(publicUrl);
  const size = big ? 168 : 112;
  return (
    <section className="card flex shrink-0 items-center gap-5 p-5">
      <div className="shrink-0 rounded-xl border border-line bg-panel p-2">
        <QRCodeSVG value={url} size={size} bgColor="#FFFFFF" fgColor="#0E0E10" level="M" marginSize={0} />
      </div>
      <div className="min-w-0">
        <div className="card-title">Open a store</div>
        <div className="mt-1 text-[14px] leading-[20px] text-muted">Scan to sell to the agents in this room. Try lying about your price: we check your real checkout.</div>
        <a href={url} target="_blank" rel="noreferrer" className="mt-2 block break-all font-mono text-[12.5px] leading-snug text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
          {url.replace(/^https?:\/\//, "")}
        </a>
      </div>
    </section>
  );
}
