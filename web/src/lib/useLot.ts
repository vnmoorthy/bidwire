import { useMemo } from "react";
import type { Auction } from "@shared/types";
import { useLive } from "./store";
import { lotState, type LotState } from "./lot";

/** Live truth about one lot: hammer, order (sold), approval. Recomputes when orders or approvals change. */
export function useLot(a: Auction): LotState {
  const orders = useLive((s) => s.orders);
  const approvals = useLive((s) => s.approvals);
  return useMemo(() => lotState(a, orders, approvals), [a, orders, approvals]);
}
