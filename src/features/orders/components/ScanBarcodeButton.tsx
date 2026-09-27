"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";

// Client-only + code-split: the scanner modal and its `@zxing/browser` import
// are only fetched when the seller actually opens the scanner.
const BarcodeScannerModal = dynamic(
  () =>
    import("@/features/orders/components/BarcodeScannerModal").then(
      (mod) => mod.BarcodeScannerModal,
    ),
  { ssr: false },
);

/**
 * "Scan barcode" entry point beside the seller order search. Opens the
 * camera scanner; manual search remains available as the fallback.
 */
export function ScanBarcodeButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="rjSm"
        onClick={() => setOpen(true)}
        className="shrink-0"
      >
        <ScanLine className="mr-2 h-4 w-4" aria-hidden="true" />
        Scan barcode
      </Button>
      {open ? <BarcodeScannerModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
