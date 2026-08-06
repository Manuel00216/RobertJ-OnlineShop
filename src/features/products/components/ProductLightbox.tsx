"use client";

import Image from "next/image";
import { motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ProductImage } from "@/features/products/types/product.types";

export interface ProductLightboxProps {
  images: ProductImage[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  title: string;
}

const ZOOM_LEVELS = [1, 2, 3];
const SWIPE_THRESHOLD_PX = 80;

const ICON_BUTTON =
  "flex h-10 w-10 items-center justify-center rounded-full bg-rj-white/10 text-rj-white transition-colors hover:bg-rj-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-white/50 disabled:pointer-events-none disabled:opacity-30";

/**
 * Full-screen product image viewer: swipe/arrow navigation, a button-driven
 * zoom (1x/2x/3x) with drag-to-pan while zoomed, and a thumbnail strip.
 * Custom-built on the framer-motion already in this project (no new
 * dependency) — true two-finger pinch-zoom is intentionally out of scope.
 * Focus management mirrors the pattern already established in
 * `CancelOrderButton`'s confirm panel (focus in on open, Escape to close,
 * focus returns to the trigger), extended here with a Tab focus trap since
 * this covers the full viewport.
 */
export function ProductLightbox({
  images,
  activeIndex,
  onIndexChange,
  onClose,
  title,
}: ProductLightboxProps) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const active = images[activeIndex] ?? null;
  const zoom = ZOOM_LEVELS[zoomIndex];
  const isZoomed = zoom > 1;

  function goTo(index: number) {
    const next = ((index % images.length) + images.length) % images.length;
    onIndexChange(next);
    setZoomIndex(0);
  }

  useEffect(() => {
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (!isZoomed && event.key === "ArrowLeft") {
        goTo(activeIndex - 1);
        return;
      }
      if (!isZoomed && event.key === "ArrowRight") {
        goTo(activeIndex + 1);
        return;
      }
      if (event.key === "Tab") {
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // Re-bind per activeIndex/isZoomed so Arrow/Tab handling always sees
    // current values without needing a ref-based escape hatch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isZoomed]);

  function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (isZoomed) return; // dragging pans instead of navigating while zoomed
    if (info.offset.x < -SWIPE_THRESHOLD_PX) goTo(activeIndex + 1);
    else if (info.offset.x > SWIPE_THRESHOLD_PX) goTo(activeIndex - 1);
  }

  function cycleZoom() {
    setZoomIndex((index) => (index + 1) % ZOOM_LEVELS.length);
  }

  if (!active) return null;

  const panBound = 160 * (zoom - 1);

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-[100] flex flex-col bg-rj-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — image viewer`}
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <p className="text-xs font-semibold text-rj-white" aria-live="polite">
          Image {activeIndex + 1} of {images.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
            className={ICON_BUTTON}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            aria-label="Zoom in"
            className={ICON_BUTTON}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close image viewer"
            className={ICON_BUTTON}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
        {images.length > 1 ? (
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            aria-label="Previous image"
            className={`absolute left-2 z-10 ${ICON_BUTTON}`}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
        ) : null}

        <motion.div
          key={active.id}
          drag={isZoomed ? true : "x"}
          dragElastic={isZoomed ? 0.15 : 0.3}
          dragConstraints={{
            left: isZoomed ? -panBound : 0,
            right: isZoomed ? panBound : 0,
            top: isZoomed ? -panBound : 0,
            bottom: isZoomed ? panBound : 0,
          }}
          onDragEnd={handleDragEnd}
          onTap={cycleZoom}
          animate={{ scale: zoom }}
          transition={{ type: "tween", duration: 0.2 }}
          className="relative aspect-[3/4] w-full max-w-md touch-none"
          style={{ cursor: isZoomed ? "zoom-out" : "zoom-in" }}
        >
          <Image
            src={active.url}
            alt={active.altText ?? title}
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-contain"
            draggable={false}
          />
        </motion.div>

        {images.length > 1 ? (
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            aria-label="Next image"
            className={`absolute right-2 z-10 ${ICON_BUTTON}`}
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div
          className="flex flex-wrap justify-center gap-2 p-4"
          role="list"
          aria-label="Product image thumbnails"
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => goTo(index)}
              aria-pressed={index === activeIndex}
              aria-label={`View image ${index + 1}`}
              className={`relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                index === activeIndex
                  ? "border-rj-white"
                  : "border-rj-white/20 hover:border-rj-white/50"
              }`}
            >
              <Image
                src={image.url}
                alt={image.altText ?? `${title} ${index + 1}`}
                fill
                sizes="48px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
