"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils/cn";

export interface AuthSuccessStateProps {
  icon: LucideIcon;
  /** Tint + tone of the icon circle. `danger` = the expired-link guard, no pop. */
  tone?: "success" | "warning" | "danger";
  headline: string;
  body: ReactNode;
  action?: ReactNode;
  /** Pop-in on mount. Disabled for non-celebratory states (expired guard). */
  animate?: boolean;
}

/**
 * Shared success/blocked state used by Forgot Password ("Check Your Inbox"),
 * Reset Password ("Password Updated") and the expired-link guard. Frozen
 * spec §5/§6 — written once, parameterized via icon/tone/headline/body/action.
 * On mount it moves focus to the heading (WCAG 2.4.3) — spec §10.1.
 */
export function AuthSuccessState({
  icon: Icon,
  tone = "success",
  headline,
  body,
  action,
  animate = true,
}: AuthSuccessStateProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const circle = cn(
    "flex h-16 w-16 items-center justify-center rounded-full",
    tone === "success" && "bg-rj-green/15 text-rj-green",
    tone === "warning" && "bg-rj-gold/15 text-rj-gold",
    tone === "danger" && "bg-rj-red/15 text-rj-red",
  );

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
      className="flex flex-col items-center gap-4 text-center"
    >
      <span className={circle} style={animate ? { animation: "pop 0.7s ease both" } : undefined}>
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-serif text-2xl leading-tight text-rj-black outline-none"
      >
        {headline}
      </h2>

      <p className="text-sm text-rj-gray-600">{body}</p>

      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
