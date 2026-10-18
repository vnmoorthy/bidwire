// In-process event bus fanned out to browsers over Server-Sent Events.
import type { BidwireEvent } from "../../shared/types.js";

type Client = { id: number; send: (chunk: string) => void; close: () => void };
const clients = new Map<number, Client>();
let nextId = 1;

export function emit<T extends BidwireEvent["type"]>(type: T, data: Extract<BidwireEvent, { type: T }>["data"]) {
  const payload = `data: ${JSON.stringify({ type, ts: Date.now(), data })}\n\n`;
  for (const c of clients.values()) {
    try { c.send(payload); } catch { c.close(); clients.delete(c.id); }
  }
}

export function sseResponse(hello: () => unknown): Response {
  const enc = new TextEncoder();
  let client: Client | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const cid = nextId++;
      client = {
        id: cid,
        send: (chunk) => controller.enqueue(enc.encode(chunk)),
        close: () => { try { controller.close(); } catch { /* already closed */ } },
      };
      clients.set(cid, client);
      controller.enqueue(enc.encode(`retry: 1500\n\n`));
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "hello", ts: Date.now(), data: hello() })}\n\n`));
      ping = setInterval(() => { try { controller.enqueue(enc.encode(`: ping\n\n`)); } catch { /* closed */ } }, 15000);
    },
    cancel() {
      if (ping) clearInterval(ping);
      if (client) clients.delete(client.id);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}

export const sseClientCount = () => clients.size;
