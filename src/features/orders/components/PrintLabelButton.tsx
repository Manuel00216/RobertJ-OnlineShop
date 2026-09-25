"use client";

import { Button } from "@/components/ui/button";

/**
 * Triggers the browser's native print dialog for the shipping label. Marked
 * `.no-print` so the button itself never appears on the printed page. No PDF
 * library — the label is plain HTML printed via `window.print()`.
 */
export function PrintLabelButton() {
  return (
    <Button
      type="button"
      variant="primary"
      size="rjSm"
      className="no-print"
      onClick={() => window.print()}
    >
      Print label
    </Button>
  );
}
