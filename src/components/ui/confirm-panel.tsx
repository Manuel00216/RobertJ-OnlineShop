"use client";

import { useEffect, useRef, type RefObject } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const TONE_CLASSES: Record<"danger" | "neutral", string> = {
  danger: "border-danger/40 bg-danger/5",
  neutral: "border-rj-gray-200 bg-rj-gray-50",
};

export interface ConfirmPanelProps {
  /** aria-label for the alertdialog region — name the specific thing being confirmed. */
  label: string;
  title: string;
  description?: string;
  /** Visual tone: "danger" for destructive actions, "neutral" for anything else (promote, verify). */
  tone: "danger" | "neutral";
  confirmLabel: string;
  /** Shown on the confirm button instead of confirmLabel while isPending, if set. */
  pendingLabel?: string;
  cancelLabel?: string;
  /** Defaults to "danger" for a danger tone, "rj" otherwise. */
  confirmVariant?: ButtonProps["variant"];
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
  /** Element to return focus to when the panel closes via Escape or Cancel. */
  triggerRef?: RefObject<HTMLElement | null>;
}

/**
 * Shared inline confirm shape for one-shot/destructive actions (cancel order,
 * verify/reject payment, promote user, archive product) — focus moves into
 * the panel on open and back to the trigger on close/Escape.
 */
export function ConfirmPanel({
  label,
  title,
  description,
  tone,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  confirmVariant,
  onConfirm,
  onCancel,
  isPending = false,
  triggerRef,
}: ConfirmPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        triggerRef?.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open on mount, close on Escape; onCancel/triggerRef are stable per render cycle
  }, []);

  function handleCancelClick() {
    onCancel();
    triggerRef?.current?.focus();
  }

  return (
    <div
      ref={panelRef}
      role="alertdialog"
      aria-modal="false"
      aria-label={label}
      tabIndex={-1}
      className={cn("rounded-2xl border p-4 outline-none", TONE_CLASSES[tone])}
    >
      <p className="text-sm font-bold text-rj-black">{title}</p>
      {description ? <p className="mt-1 text-xs text-rj-gray-600">{description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={confirmVariant ?? (tone === "danger" ? "danger" : "rj")}
          size="rjSm"
          isLoading={isPending}
          onClick={onConfirm}
        >
          {isPending && pendingLabel ? pendingLabel : confirmLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="rjSm"
          disabled={isPending}
          onClick={handleCancelClick}
        >
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
