import { NavLink } from "react-router-dom";
import { Wordmark } from "./Logo";
import { LivePill } from "./LivePill";

const NAV = [
  { to: "/exchange", label: "Saleroom" },
  { to: "/connect", label: "Connect" },
  { to: "/ledger", label: "Ledger" },
  { to: "/director", label: "Auctioneer" },
];

export const TOPBAR_H = 60;

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 h-[60px] border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1880px] items-center gap-4 px-4 md:gap-10 md:px-6">
        <NavLink to="/" className="shrink-0" aria-label="Bidwire home">
          <Wordmark />
        </NavLink>
        <nav className="no-scrollbar flex h-full min-w-0 items-stretch gap-1 overflow-x-auto">
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `relative flex items-center px-3 text-[14.5px] font-medium transition-colors ${isActive ? "text-ink" : "text-muted hover:text-ink"}`}>
              {({ isActive }) => (
                <>
                  {label}
                  {isActive && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-accent" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-3">
          <LivePill />
          <NavLink to="/merchant" className={({ isActive }) => `hidden px-2 py-1.5 text-[14px] font-medium md:block ${isActive ? "text-ink" : "text-muted hover:text-ink"}`}>
            Merchant app
          </NavLink>
          <NavLink to="/phone" className={({ isActive }) => `hidden px-2 py-1.5 text-[14px] font-medium md:block ${isActive ? "text-ink" : "text-muted hover:text-ink"}`}>
            Approver phone
          </NavLink>
        </div>
      </div>
    </header>
  );
}
