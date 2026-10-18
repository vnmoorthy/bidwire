import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { money } from "@/lib/format";
import { useLive } from "@/lib/store";
import { capitalize, findBribe, paddleNo, pickShowcase } from "./data";
import { Badge, Container, EASE, LiveDot, PaddleChip, Reveal, SectionHeading, SmallCaps } from "./ui";

// Mirrors RANKING_WEIGHTS on the server (server/src/exchange.ts).
const WEIGHTS = [
  { label: "Price", value: 40, fill: "#16130E", text: "#FFFDF7" },
  { label: "Must-haves", value: 25, fill: "#4A443A", text: "#FFFDF7" },
  { label: "Delivery", value: 15, fill: "#7D7466", text: "#FFFDF7" },
  { label: "Trust", value: 15, fill: "#ADA48F", text: "#16130E" },
  { label: "Returns", value: 5, fill: "#D9D0BC", text: "#16130E" },
];

const POINTS = [
  "Commission is paid only at the hammer, when an agent actually buys",
  "It only breaks a near-tie, within 0.5 merit points",
  "Every rank comes back to the agent with its reasons",
];

function WeightsBar() {
  const reduce = useReducedMotion();
  return (
    <div
      className="flex h-11 gap-[2px] overflow-hidden rounded-[4px]"
      role="img"
      aria-label="Ranking weights: price 40, must-haves 25, delivery 15, trust 15, returns 5"
    >
      {WEIGHTS.map((w, i) => (
        <motion.div
          key={w.label}
          className="flex min-w-0 items-center overflow-hidden px-2.5 font-serif text-[18px] tabular-nums"
          style={{ background: w.fill, color: w.text }}
          initial={reduce ? false : { width: "0%" }}
          whileInView={{ width: `${w.value}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.06 }}
        >
          {w.value >= 15 ? w.value : ""}
        </motion.div>
      ))}
    </div>
  );
}

function BribeExample() {
  const auctions = useLive((s) => s.auctions);
  const found = findBribe(auctions, pickShowcase(auctions));
  if (!found) return null;
  const { auction, bid } = found;
  const first = (auction.bids ?? []).find((b) => b.rank === 1);
  const ratio = first && first.fee_cents > 0 ? bid.fee_cents / first.fee_cents : 0;
  const ratioText = ratio >= 1.5 ? `${Number.isInteger(ratio) ? ratio : ratio.toFixed(1)}× the No. 1 paddle's` : null;

  return (
    <div className="border-t border-line bg-raised/40 px-6 py-5 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <p className="inline-flex shrink-0 items-center gap-2">
          <LiveDot />
          <SmallCaps className="text-muted">From a real lot</SmallCaps>
        </p>
        <p className="min-w-0 truncate font-serif text-[15px] italic text-muted">“{capitalize(auction.need)}”</p>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <PaddleChip n={paddleNo(bid.merchant_id)} color={bid.merchant_color} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[14.5px] font-semibold text-ink">{bid.merchant_name}</span>
            <Badge tone="fee">Bribe ignored</Badge>
          </div>
          <p className="mt-1 text-[13px] leading-5 text-muted">
            Offered <b className="font-semibold tabular-nums text-fee">{money(bid.fee_cents)}</b> commission per sale
            {ratioText ? `, ${ratioText}` : ""}. Still No. <b className="font-semibold tabular-nums text-ink">{bid.rank}</b>.
          </p>
        </div>
      </div>
    </div>
  );
}

export function NoBribes() {
  return (
    <section id="ranking" className="scroll-mt-16 border-y border-line bg-panel">
      <Container className="grid grid-cols-1 items-center gap-12 py-24 md:py-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-16">
        <Reveal>
          <SectionHeading
            eyebrow="Ranking"
            title="You can't bribe an agent."
            sub="Lots are won only on what the buyer cares about: delivered price, must-haves, delivery, merchant trust and returns. A merchant can offer a commission, and it never moves their paddle up the list."
          />
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] leading-6 text-ink">
                <span className="mt-[3px] grid size-[18px] shrink-0 place-items-center rounded-full bg-money-soft text-money">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.08} className="min-w-0">
          <div className="overflow-hidden rounded-[6px] border border-line bg-panel">
            <div className="p-6 md:p-8">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-serif text-[26px] font-normal leading-7 text-ink">How a lot is decided</h3>
                <SmallCaps className="text-dim">Merit weights</SmallCaps>
              </div>
              <div className="mt-6">
                <WeightsBar />
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {WEIGHTS.map((w) => (
                  <li key={w.label} className="inline-flex items-center gap-2 text-[13px]">
                    <span className="size-2 rounded-[2px]" style={{ background: w.fill }} aria-hidden />
                    <span className="font-medium text-ink">{w.label}</span>
                    <span className="tabular-nums text-muted">{w.value}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 border-t border-line pt-6">
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <span className="font-semibold text-ink">Merchant commission</span>
                  <span className="text-muted">
                    <b className="font-serif text-[18px] font-normal tabular-nums text-ink">0</b> · only breaks ties
                  </span>
                </div>
                <div className="relative mt-3 h-3 rounded-full border border-dashed border-line-strong bg-raised/40">
                  <span className="absolute left-[-1px] top-1/2 size-3 -translate-y-1/2 rounded-full bg-fee ring-4 ring-fee-soft" aria-hidden />
                </div>
              </div>
            </div>
            <BribeExample />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
