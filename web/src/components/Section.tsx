import type { ReactNode } from "react";

/** Card header row: title (15px, 600), optional muted subtitle and right-aligned actions. */
export function CardHeader({ title, subtitle, right, icon, className = "" }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 border-b border-line px-5 py-3.5 ${className}`}>
      {icon && <span className="text-muted">{icon}</span>}
      <h2 className="card-title">{title}</h2>
      {subtitle && <span className="truncate text-[13px] text-muted">{subtitle}</span>}
      {right && <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function SectionTitle({ icon, children, right, className = "" }: { icon?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {icon && <span className="text-muted">{icon}</span>}
      <h3 className="card-title">{children}</h3>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

/** Empty state: a lucide icon in a raised circle, one sentence and an optional action. */
export function Empty({ icon, title, children, action, className = "" }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 px-6 py-10 text-center ${className}`}>
      {icon && <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-raised text-muted">{icon}</div>}
      <div className="text-[15px] font-medium text-ink">{title}</div>
      {children && <div className="max-w-sm text-[13px] leading-[18px] text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
