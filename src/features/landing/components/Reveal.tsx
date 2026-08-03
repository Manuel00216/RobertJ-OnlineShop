"use client";

import type { ReactNode } from "react";

import { useReveal } from "@/features/landing/hooks/useReveal";

type RevealDirection = "up" | "left" | "right" | "none";

export interface RevealProps {
  children: ReactNode;
  /** Entrance direction. Mirrors the Figma section reveals. */
  direction?: RevealDirection;
  /** Stagger delay in milliseconds. */
  delayMs?: number;
  className?: string;
}

/** Hidden-state transform per direction, matching the design's reveals. */
const HIDDEN_TRANSFORM: Record<RevealDirection, string> = {
  up: "translate-y-6",
  left: "-translate-x-8",
  right: "translate-x-8",
  none: "",
};

/**
 * Scroll-reveal wrapper. Uses a native IntersectionObserver + CSS transition
 * (the same approach as the approved design) so it degrades gracefully: content
 * is real in the DOM and simply fades/slides into place once in view. Reduced
 * motion is respected globally via the transition-suppressing media query in
 * globals.css.
 */
export function Reveal({
  children,
  direction = "up",
  delayMs = 0,
  className,
}: RevealProps) {
  const { ref, inView } = useReveal();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        inView ? "translate-x-0 translate-y-0 opacity-100" : `opacity-0 ${HIDDEN_TRANSFORM[direction]}`
      } ${className ?? ""}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}
