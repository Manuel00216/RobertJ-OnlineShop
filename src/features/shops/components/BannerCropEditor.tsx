"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/** Matches the "Recommended: 1500×500px (3:1 ratio)" hint — the cropped
 * output is always exactly this size/ratio, so the buyer-facing `aspect-[3/1]
 * object-cover` box never has to crop it further. */
const OUTPUT_WIDTH = 1500;
const OUTPUT_HEIGHT = 500;
const MAX_ZOOM = 4;

interface Size {
  width: number;
  height: number;
}

interface Offset {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The scale at which the image, at zoom=1, exactly covers the container
 * with no empty space — the same computation `object-cover` does natively,
 * done by hand here so it can be combined with a user-controlled zoom and
 * later converted back into an exact source-pixel crop rectangle. */
function computeBaseScale(natural: Size, container: Size): number {
  if (!natural.width || !natural.height || !container.width || !container.height) return 1;
  return Math.max(container.width / natural.width, container.height / natural.height);
}

/** Keeps the image covering the container at all times — the offset can
 * never reveal empty space at the edges, regardless of zoom. */
function clampOffset(offset: Offset, natural: Size, container: Size, scale: number): Offset {
  const dispW = natural.width * scale;
  const dispH = natural.height * scale;
  const maxX = Math.max(0, (dispW - container.width) / 2);
  const maxY = Math.max(0, (dispH - container.height) / 2);
  return { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) };
}

export interface BannerCropEditorProps {
  file: File;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
  /** Disables interaction while the parent is uploading the confirmed crop. */
  isSaving?: boolean;
}

/**
 * Interactive 3:1 banner crop: drag to reposition, slider to zoom, always
 * covering the box (never letterboxed, never stretched — only ever panned/
 * scaled uniformly). On confirm, draws the exact visible rectangle into a
 * 1500×500 canvas and hands the caller a real `File` — the crop happens
 * entirely client-side before any network request, so the existing upload
 * action/validation/storage/RLS see a perfectly ordinary image file.
 */
export function BannerCropEditor({ file, onCancel, onConfirm, isSaving }: BannerCropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragState = useRef<{ startX: number; startY: number; origin: Offset } | null>(null);

  const [containerSize, setContainerSize] = useState<Size>({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);

  // The object URL is assigned directly to the DOM node (imperatively), not
  // held in React state — React's Strict Mode (on by default in Next.js dev)
  // deliberately runs an effect's cleanup and then re-runs its setup once,
  // to catch effects that don't tolerate being restarted. An earlier version
  // created the URL during render and only revoked it in the effect's
  // cleanup: Strict Mode's extra cleanup pass revoked the blob URL the
  // `<img>` was already pointing at, moments after creating it, so the image
  // could never load and the box stayed permanently blank. Creating it fresh
  // inside the effect and setting `img.src` directly means the extra Strict
  // Mode remount simply creates a second, equally-valid URL and points the
  // `<img>` at that one instead — and since nothing here is React state,
  // there's no state to revert when the remount's cleanup runs.
  useLayoutEffect(() => {
    const url = URL.createObjectURL(file);
    const img = imgRef.current;
    if (img) img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Measures synchronously before paint (not just via the async
  // ResizeObserver callback below) so there's never a frame where the
  // container's real size is unknown and the image stays hidden waiting for
  // it — `aspect-[3/1]` gives the box a real size the instant it's in the
  // DOM, no need to wait for an observer round trip.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function applyNaturalSize(width: number, height: number) {
    setNaturalSize({ width, height });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setLoadError(null);
  }

  const baseScale = computeBaseScale(naturalSize, containerSize);
  const displayScale = baseScale * zoom;
  const displayWidth = naturalSize.width * displayScale;
  const displayHeight = naturalSize.height * displayScale;
  const ready = naturalSize.width > 0 && containerSize.width > 0;

  function handleImageLoad() {
    const img = imgRef.current;
    if (!img) return;
    applyNaturalSize(img.naturalWidth, img.naturalHeight);
  }

  function handleZoomChange(nextZoom: number) {
    setZoom(nextZoom);
    setOffset((prev) => clampOffset(prev, naturalSize, containerSize, baseScale * nextZoom));
  }

  function handleReset() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLImageElement>) {
    if (!ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = { startX: event.clientX, startY: event.clientY, origin: offset };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLImageElement>) {
    if (!dragState.current) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    setOffset(
      clampOffset(
        { x: dragState.current.origin.x + dx, y: dragState.current.origin.y + dy },
        naturalSize,
        containerSize,
        displayScale,
      ),
    );
  }

  function handlePointerUp() {
    dragState.current = null;
  }

  function handleConfirm() {
    const img = imgRef.current;
    if (!img || !ready) return;

    // The exact source-pixel rectangle currently visible in the 3:1 window —
    // always itself exactly 3:1, since `containerSize` is (a rendering of)
    // the 3:1 box, so drawing it into a 1500×500 canvas is a uniform scale,
    // never a stretch.
    const sWidth = Math.min(naturalSize.width, containerSize.width / displayScale);
    const sHeight = Math.min(naturalSize.height, containerSize.height / displayScale);
    const sx = clamp(
      naturalSize.width / 2 - (containerSize.width / 2 + offset.x) / displayScale,
      0,
      naturalSize.width - sWidth,
    );
    const sy = clamp(
      naturalSize.height / 2 - (containerSize.height / 2 + offset.y) / displayScale,
      0,
      naturalSize.height - sHeight,
    );

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onConfirm(new File([blob], "banner.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="relative aspect-[3/1] w-full overflow-hidden rounded-md border border-border bg-muted"
        style={{ touchAction: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- needs direct
            pixel control (drag/zoom transform + canvas source) that next/image
            doesn't expose; this is a transient client-side editor, not the
            final rendered image. */}
        <img
          ref={imgRef}
          alt=""
          draggable={false}
          onLoad={handleImageLoad}
          onError={() => setLoadError("Couldn't load this image. Try a different file.")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute left-1/2 top-1/2 max-w-none cursor-grab select-none active:cursor-grabbing"
          style={{
            width: displayWidth || undefined,
            height: displayHeight || undefined,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            visibility: ready ? "visible" : "hidden",
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Zoom</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          disabled={!ready || isSaving}
          onChange={(event) => handleZoomChange(Number(event.target.value))}
          className="w-full accent-rj-black"
          aria-label="Zoom banner image"
        />
        <Button type="button" variant="ghost" size="sm" disabled={!ready || isSaving} onClick={handleReset}>
          Reset
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Drag to reposition, use the slider to zoom. This is exactly how it will look once saved.
      </p>

      {loadError ? (
        <p className="text-xs text-danger" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" isLoading={isSaving} disabled={!ready} onClick={handleConfirm}>
          Save banner
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={isSaving} onClick={onCancel}>
          Choose a different image
        </Button>
      </div>
    </div>
  );
}
