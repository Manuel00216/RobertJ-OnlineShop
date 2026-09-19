"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies `value` (the order number) to the clipboard, with a brief "copied" confirmation. */
export function CopyOrderIdButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the id is still visible to select/copy manually.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-sm font-semibold text-rj-red-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
    >
      {value}
      {copied ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span className="sr-only">{copied ? "Copied" : "Copy order ID"}</span>
    </button>
  );
}
