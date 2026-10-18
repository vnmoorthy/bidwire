import { useState } from "react";
import { useLive } from "@/lib/store";
import { StatsStrip } from "./exchange/StatsStrip";
import { AuctionCard } from "./exchange/AuctionHero";
import { AgentWire } from "./exchange/AgentWire";
import { TrustBoard } from "./exchange/TrustBoard";
import { JoinCard } from "./exchange/JoinCard";
import { HistoryStrip } from "./exchange/HistoryStrip";
import { AuctionDrawer } from "./exchange/AuctionDrawer";
import { MerchantDrawer } from "./exchange/MerchantDrawer";
import { EmptyHero } from "./exchange/EmptyHero";

/**
 * Live exchange (the demo big screen). At >=1280px: a 12-col grid fixed to the viewport.
 * Row 1: one KPI card. Row 2: left 8 cols = current auction + bid table (+ previous auctions),
 * right 4 cols = agent activity, merchant trust, "Open a store" QR card.
 */
export default function Exchange() {
  const auctions = useLive((s) => s.auctions);
  const hydrated = useLive((s) => s.hydrated);
  const [drawer, setDrawer] = useState<{ auctionId: string; bidId?: string } | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  const current = auctions[0];
  const previous = auctions.slice(1, 16);

  return (
    <div className="mx-auto max-w-[1880px] px-4 pb-14 pt-4 md:px-6 xl:flex xl:h-[calc(100vh-56px)] xl:flex-col xl:overflow-hidden">
      <StatsStrip />
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="flex min-h-0 min-w-0 flex-col gap-4 xl:col-span-8">
          {!hydrated ? (
            <div className="card shimmer min-h-[420px] flex-1" />
          ) : current ? (
            <>
              <div className="flex min-h-[420px] flex-1 flex-col xl:min-h-0">
                <AuctionCard a={current} onOpenBid={(bidId) => setDrawer({ auctionId: current.id, bidId })} />
              </div>
              <HistoryStrip auctions={previous} onOpen={(id) => setDrawer({ auctionId: id })} />
            </>
          ) : (
            <EmptyHero />
          )}
        </div>
        <div className="flex min-h-0 min-w-0 flex-col gap-4 xl:col-span-4">
          <div className="flex min-h-[300px] flex-1 flex-col xl:min-h-0">
            <AgentWire />
          </div>
          <TrustBoard onOpen={setMerchantId} className="max-h-[300px] shrink-0" />
          <JoinCard />
        </div>
      </div>
      <AuctionDrawer auctionId={drawer?.auctionId ?? null} focusBidId={drawer?.bidId} onClose={() => setDrawer(null)} />
      <MerchantDrawer merchantId={merchantId} onClose={() => setMerchantId(null)} />
    </div>
  );
}
