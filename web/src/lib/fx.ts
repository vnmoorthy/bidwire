import { create } from "zustand";

export type ToastKind = "sold" | "approval" | "approved" | "denied" | "fail" | "merchant" | "info" | "error" | "success";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  amount?: number;
  fee?: number;
}

export type BannerKind = "lie" | "bribe";

export interface BannerT {
  id: string;
  kind: BannerKind;
  title: string;
  sub?: string;
}

interface FxState {
  toasts: Toast[];
  banners: BannerT[];
}

export const useFx = create<FxState>(() => ({ toasts: [], banners: [] }));

let seq = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function dismissToast(id: string) {
  useFx.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function toast(t: Omit<Toast, "id">, ms = 5200): string {
  const id = nid("t");
  useFx.setState((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-5) }));
  window.setTimeout(() => dismissToast(id), ms);
  return id;
}

export function dismissBanner(id: string) {
  useFx.setState((s) => ({ banners: s.banners.filter((b) => b.id !== id) }));
}

export function banner(b: Omit<BannerT, "id">, ms = 4200): string {
  const id = nid("b");
  useFx.setState((s) => ({ banners: [...s.banners, { ...b, id }].slice(-2) }));
  window.setTimeout(() => dismissBanner(id), ms);
  return id;
}

export function toastError(title: string, body?: string) {
  toast({ kind: "error", title, body }, 6500);
}
