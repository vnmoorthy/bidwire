export interface ClientInfo {
  key: string;
  label: string;
  color: string;
}

const FALLBACK = ["#FF7EB6", "#C4B5FD", "#FDBA74", "#93C5FD", "#F9A8D4", "#A5F3FC"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Normalizes MCP clientInfo names ("claude-code", "openai-mcp", "codex-mcp-client"...) into a badge. */
export function clientInfo(raw: string | null | undefined): ClientInfo {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s) return { key: "unknown", label: "Unknown", color: "#8A96A6" };
  if (s.includes("claude") || s.includes("anthropic")) return { key: "claude", label: "Claude", color: "#E8865A" };
  if (s.includes("chatgpt") || s.includes("openai") || s === "gpt") return { key: "chatgpt", label: "ChatGPT", color: "#9BE15D" };
  if (s.includes("codex")) return { key: "codex", label: "Codex", color: "#DCE3EC" };
  if (s.includes("cursor")) return { key: "cursor", label: "Cursor", color: "#B4A3FF" };
  if (s.includes("playground")) return { key: "playground", label: "Playground", color: "#5B8CFF" };
  if (s.includes("guest") || s === "anon") return { key: "guest", label: "Guest", color: "#8A96A6" };
  if (s.includes("demo") || s.includes("bidwire")) return { key: "demo", label: "Demo agent", color: "#3DD9EB" };
  if (s.includes("gemini")) return { key: "gemini", label: "Gemini", color: "#93C5FD" };
  const label = raw!.length > 18 ? raw!.slice(0, 17) + "…" : raw!;
  return { key: s, label, color: FALLBACK[hash(s) % FALLBACK.length] };
}
