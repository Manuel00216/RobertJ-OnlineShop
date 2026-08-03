"use client";

import { useEffect, useState } from "react";

import { useReveal } from "@/features/landing/hooks/useReveal";

export interface AnimatedCounterProps {
  to: number;
  prefix?: string;
  suffix?: string;
  /** Fractional digits (e.g. 1 renders 4.8). Defaults to 0. */
  decimals?: number;
}

/**
 * Counts up from zero to `to` the first time it scrolls into view. Uses an
 * interval-driven ramp (as in the approved design), so it runs anywhere timers
 * run and never leaves a stale zero on screen.
 */
export function AnimatedCounter({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
}: AnimatedCounterProps) {
  const { ref, inView } = useReveal<HTMLSpanElement>({ amount: 0.4 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const steps = 60;
    const increment = to / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= to) {
        setCount(to);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, 20);

    return () => clearInterval(timer);
  }, [inView, to]);

  const display =
    decimals > 0
      ? count.toFixed(decimals)
      : Math.floor(count).toLocaleString("en-US");

  return (
    <span ref={ref}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
