import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";

export interface WordmarkProps {
  /** Render for dark backgrounds (light text) instead of the default light background. */
  onDark?: boolean;
  className?: string;
}

/**
 * Shared RobertJ wordmark. Extracted from `LandingNavbar`'s private `Logo`
 * into the reusable branding library so the landing, auth, and future
 * dashboards all render a single source of truth.
 */
export function Wordmark({ onDark = false, className }: WordmarkProps) {
  return (
    <Link
      href={ROUTES.home}
      className={cn("group inline-flex flex-shrink-0 items-baseline gap-0.5", className)}
    >
      <span
        className={cn(
          "font-serif text-[32px] tracking-tight transition-colors",
          onDark ? "text-rj-white group-hover:text-rj-gray-200" : "text-rj-black group-hover:text-rj-red",
        )}
      >
        RobertJ
      </span>
      <span
        className={cn(
          "ml-2 text-[12px] font-bold uppercase leading-none tracking-[0.22em]",
          onDark ? "text-rj-gray-200" : "text-rj-red",
        )}
      >
        ONLINESHOP
      </span>
    </Link>
  );
}
