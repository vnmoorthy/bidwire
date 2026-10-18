// Messaging: Inkbox (real SMS + email from the agent's own identity) with an on-screen simulated phone fallback.
// Every message, real or simulated, is stored in the messages table so the demo phone can render the thread.
import { Inkbox } from "@inkbox/sdk";
import { config } from "./env.js";
import { run, all, id } from "./db.js";
import { emit } from "./bus.js";
import type { Message, Provider } from "../../shared/types.js";

let identity: any = null;
let identityLabel = "Bidwire (simulated)";
let ready: Promise<void> | null = null;

export function messagingProvider(): Provider { return identity ? "inkbox" : "simulated"; }
export function messagingLabel() { return identityLabel; }

export function initMessaging(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    if (!config.inkboxApiKey) return;
    try {
      const inkbox = new Inkbox({ apiKey: config.inkboxApiKey });
      if (config.inkboxIdentity) identity = await inkbox.getIdentity(config.inkboxIdentity);
      else {
        const list = await inkbox.listIdentities();
        if (list.length) identity = await inkbox.getIdentity((list[0] as any).agentHandle ?? (list[0] as any).handle);
      }
      if (identity) {
        identityLabel = `Inkbox · ${identity.agentHandle ?? config.inkboxIdentity ?? "agent"}${identity.phoneNumber?.number ? " " + identity.phoneNumber.number : ""}`;
        console.log(`[messaging] Inkbox identity ready: ${identityLabel}`);
        startInboundPolling();
      }
    } catch (e: any) {
      console.warn(`[messaging] Inkbox unavailable, using simulated phone: ${e?.message ?? e}`);
      identity = null;
    }
  })();
  return ready;
}

export const rowToMessage = (r: any): Message => ({
  id: r.id, ts: r.ts, channel: r.channel, direction: r.direction, to: r.to_addr, from: r.from_addr, subject: r.subject,
  body: r.body, related_id: r.related_id, provider: r.provider, status: r.status, error: r.error,
});

function record(m: Omit<Message, "id" | "ts">): Message {
  const msg: Message = { id: id("msg"), ts: Date.now(), ...m };
  run("INSERT INTO messages VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", msg.id, msg.ts, msg.channel, msg.direction, msg.to, msg.from, msg.subject, msg.body, msg.related_id, msg.provider, msg.status, msg.error);
  emit("message", msg);
  return msg;
}

export async function sendSms(to: string | null, body: string, relatedId: string): Promise<Message> {
  await initMessaging();
  const dest = to ?? "simulated-phone";
  if (identity && to) {
    try {
      await identity.sendText({ to, text: body, idempotencyKey: `${relatedId}-sms` });
      return record({ channel: "sms", direction: "out", to, from: identityLabel, subject: null, body, related_id: relatedId, provider: "inkbox", status: "sent", error: null });
    } catch (e: any) {
      return record({ channel: "sms", direction: "out", to, from: identityLabel, subject: null, body, related_id: relatedId, provider: "inkbox", status: "failed", error: String(e?.message ?? e).slice(0, 300) });
    }
  }
  return record({ channel: "sms", direction: "out", to: dest, from: "Bidwire", subject: null, body, related_id: relatedId, provider: "simulated", status: "sent", error: null });
}

export async function sendEmail(to: string | null, subject: string, body: string, relatedId: string): Promise<Message> {
  await initMessaging();
  if (identity && to) {
    try {
      await identity.sendEmail({ to: [to], subject, bodyText: body });
      return record({ channel: "email", direction: "out", to, from: identityLabel, subject, body, related_id: relatedId, provider: "inkbox", status: "sent", error: null });
    } catch (e: any) {
      return record({ channel: "email", direction: "out", to, from: identityLabel, subject, body, related_id: relatedId, provider: "inkbox", status: "failed", error: String(e?.message ?? e).slice(0, 300) });
    }
  }
  return record({ channel: "email", direction: "out", to: to ?? "simulated-inbox", from: "receipts@bidwire", subject, body, related_id: relatedId, provider: "simulated", status: "sent", error: null });
}

export function recordInbound(from: string, body: string, provider: Provider, relatedId: string | null = null) {
  return record({ channel: "sms", direction: "in", to: identityLabel, from, subject: null, body, related_id: relatedId, provider, status: "received", error: null });
}

// Inbound SMS replies ("YES 4821") resolve approvals. The handler is injected by the exchange to avoid an import cycle.
let onInbound: ((from: string, body: string, provider: Provider) => void) | null = null;
export function setInboundHandler(fn: (from: string, body: string, provider: Provider) => void) { onInbound = fn; }

const seen = new Set<string>();
const startedAt = Date.now();
function startInboundPolling() {
  let first = true;
  const tick = async () => {
    try {
      const texts: any[] = await identity.listTexts({ limit: 30 });
      for (const t of texts) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        if (t.direction !== "inbound") continue;
        const ts = t.sentAt ? new Date(t.sentAt).getTime() : t.createdAt ? new Date(t.createdAt).getTime() : Date.now();
        if (first && ts < startedAt) continue;
        if (ts < startedAt - 5000) continue;
        const from = t.remotePhoneNumber ?? t.senderPhoneNumber ?? "unknown";
        onInbound?.(from, t.text ?? "", "inkbox");
        try { await identity.markTextRead(t.id); } catch { /* best effort */ }
      }
    } catch (e: any) {
      if (first) console.warn(`[messaging] inbound polling error: ${e?.message ?? e}`);
    }
    first = false;
  };
  tick();
  setInterval(tick, 3000);
}

export function recentMessages(limit = 50): Message[] {
  return all("SELECT * FROM messages ORDER BY ts DESC LIMIT ?", limit).map(rowToMessage);
}
