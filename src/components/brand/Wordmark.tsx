import Image from "next/image";
import Link from "next/link";

import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";

export interface WordmarkProps {
  /**
   * Unused by the image mark (it carries its own background/contrast) —
   * kept so existing `onDark` call sites don't need to change.
   */
  onDark?: boolean;
  className?: string;
}

/**
 * Shared RobertJ logo mark. Extracted from `LandingNavbar`'s private `Logo`
 * into the reusable branding library so the landing, auth, and future
 * dashboards all render a single source of truth.
 */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <Link href={ROUTES.home} className={cn("inline-flex flex-shrink-0 items-center", className)}>
      <Image
        src="/brand/logo.png"
        alt="RobertJ Shop"
        width={1254}
        height={1254}
        priority
        className="h-11 w-11 rounded-lg object-cover"
      />
    </Link>
  );
}
