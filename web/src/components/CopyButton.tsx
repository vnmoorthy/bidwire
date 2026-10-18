import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { copyText } from "@/lib/format";

export function CopyButton({ text, label = "Copy", className = "", compact = false }: { text: string; label?: string; className?: string; compact?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`btn ${compact ? "px-2 py-1 text-xs" : ""} ${className}`}
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyText(text);
        if (ok) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        }
      }}
      title={`Copy ${text.length > 60 ? "" : text}`}
    >
      {done ? <Check size={14} className="text-money" /> : <Copy size={14} />}
      {!compact || label ? <span>{done ? "Copied" : label}</span> : null}
    </button>
  );
}
