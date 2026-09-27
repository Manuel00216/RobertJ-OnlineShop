"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { resolveSellerOrderByNumberAction } from "@/features/orders/actions/order.actions";
import { cn } from "@/lib/utils/cn";

/** Minimal shape of ZXing's IScannerControls we use — kept inline so the
 * `@zxing/browser` module is never statically imported (it loads on demand). */
type ScannerControls = { stop: () => void };

type Phase =
  | "starting"
  | "scanning"
  | "resolving"
  | "error"
  | "denied"
  | "no-camera"
  | "unsupported";

export interface BarcodeScannerModalProps {
  onClose: () => void;
}

/**
 * Camera-based Code 128 scanner for the seller. Dynamically imports
 * `@zxing/browser` only when opened, restricts decoding to Code 128, prefers
 * the rear camera on mobile (integrated webcam on desktop), decodes the
 * `order_number`, and navigates to the existing seller order-detail page.
 * Read-only: it never changes any order/fulfilment state. Cleans up the camera
 * stream on success, close, and unmount, and guards against duplicate scans.
 */
export function BarcodeScannerModal({ onClose }: BarcodeScannerModalProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const hasScannedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Bumped to (re)start the camera; the start effect keys off this (not
  // `phase`), so moving starting → scanning never tears down a live stream.
  const [attempt, setAttempt] = useState(0);

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      // controls may already be torn down — safe to ignore.
    }
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const resolve = useCallback(
    async (decoded: string) => {
      setPhase("resolving");
      const result = await resolveSellerOrderByNumberAction(decoded);
      if (result.success) {
        router.push(ROUTES.sellerOrderDetail(result.data.orderId));
        return;
      }
      setErrorMessage(result.error);
      setPhase("error");
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Yield first so every setState below runs asynchronously (never
      // synchronously within the effect body).
      await Promise.resolve();
      if (cancelled) return;

      if (
        typeof window === "undefined" ||
        !window.isSecureContext ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setPhase("unsupported");
        return;
      }

      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] =
          await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        if (cancelled) return;

        const videoEl = videoRef.current;
        if (!videoEl) return;

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
        const reader = new BrowserMultiFormatReader(hints);

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoEl,
          (result) => {
            if (!result || hasScannedRef.current) return;
            hasScannedRef.current = true;
            stopCamera();
            void resolve(result.getText());
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setPhase("scanning");
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setPhase("denied");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setPhase("no-camera");
        } else {
          setErrorMessage("The camera couldn't be started.");
          setPhase("error");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [attempt, resolve, stopCamera]);

  function handleClose() {
    stopCamera();
    onClose();
  }

  function handleRetry() {
    hasScannedRef.current = false;
    setErrorMessage(null);
    setPhase("starting");
    setAttempt((value) => value + 1);
  }

  const showVideo = phase === "starting" || phase === "scanning" || phase === "resolving";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan order barcode"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-rj-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-rj-black">Scan order barcode</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close scanner"
            className="rounded-md p-1 text-rj-gray-500 hover:bg-rj-gray-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4">
          {/* Always mounted so the ref exists before the start effect runs; hidden unless active. */}
          <div className={cn("overflow-hidden rounded-lg bg-black", showVideo ? "block" : "hidden")}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-square w-full object-cover"
            />
          </div>

          {phase === "starting" ? (
            <p className="mt-3 text-sm text-rj-gray-600">Starting camera…</p>
          ) : null}
          {phase === "scanning" ? (
            <p className="mt-3 text-sm text-rj-gray-600">
              Point the camera at the Code 128 barcode on the shipping label.
            </p>
          ) : null}
          {phase === "resolving" ? (
            <p className="mt-3 text-sm text-rj-gray-600">Opening order…</p>
          ) : null}

          {phase === "denied" ? (
            <p className="mt-1 text-sm text-rj-gray-700">
              Camera access was blocked. Enable camera permission for this site, or use manual search.
            </p>
          ) : null}
          {phase === "no-camera" ? (
            <p className="mt-1 text-sm text-rj-gray-700">
              No camera was found. Use manual search instead.
            </p>
          ) : null}
          {phase === "unsupported" ? (
            <p className="mt-1 text-sm text-rj-gray-700">
              Camera scanning isn&apos;t available in this browser. Use manual search instead.
            </p>
          ) : null}
          {phase === "error" ? (
            <p className="mt-1 text-sm text-rj-red-dark">{errorMessage}</p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {phase === "error" || phase === "denied" ? (
            <Button type="button" variant="primary" size="rjSm" onClick={handleRetry}>
              Scan again
            </Button>
          ) : null}
          <button
            type="button"
            onClick={handleClose}
            className={cn(buttonVariants({ variant: "outline", size: "rjSm" }))}
          >
            Use manual search
          </button>
        </div>
      </div>
    </div>
  );
}
