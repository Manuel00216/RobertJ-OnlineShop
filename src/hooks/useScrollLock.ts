"use client";

import { useEffect } from "react";

/**
 * Locks background page scroll while `locked` is true (an open modal, bottom
 * sheet, or lightbox), restoring the previous `overflow` on unlock/unmount.
 * Ref-counted so multiple simultaneously-open overlays don't fight over the
 * body style — the lock lifts only once the last one releases it.
 */
let lockCount = 0;
let previousOverflow = "";

export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [locked]);
}
