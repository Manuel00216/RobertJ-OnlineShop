"use client";

import { useEffect, useRef, useState } from "react";

export interface UseRevealOptions {
  /** IntersectionObserver visibility threshold. Mirrors the Figma source. */
  amount?: number;
  /**
   * Safety net: reveal after this many ms even if the observer never fires
   * (e.g. no IntersectionObserver, or a non-painting environment). Keeps
   * content from ever being stuck hidden. Below-the-fold content that reveals
   * off-screen simply appears already-shown when scrolled to.
   */
  fallbackMs?: number;
}

/**
 * Reveal-on-scroll trigger built on a native IntersectionObserver — the same
 * mechanism as the approved design. Returns a ref to attach and a one-way
 * `inView` flag that flips true the first time the element enters the viewport.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>({
  amount = 0.2,
  fallbackMs = 2000,
}: UseRevealOptions = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;

    let observer: IntersectionObserver | undefined;

    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer?.disconnect();
          }
        },
        { threshold: amount },
      );
      observer.observe(element);
    }

    // Fires when the observer never does (no IO support, non-painting env),
    // guaranteeing content is never left hidden.
    const fallback = window.setTimeout(() => {
      setInView(true);
      observer?.disconnect();
    }, fallbackMs);

    return () => {
      observer?.disconnect();
      window.clearTimeout(fallback);
    };
  }, [amount, fallbackMs, inView]);

  return { ref, inView };
}
