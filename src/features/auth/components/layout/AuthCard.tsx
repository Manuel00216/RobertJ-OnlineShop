import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * The auth card/page content container.
 * - Mobile (<768): no card chrome — the page IS the card (white, full-bleed).
 * - Tablet (md: 768–1023): `rounded-3xl shadow-xl border-rj-gray-100` card on
 *   the `rj-gray-50` section background, matching the landing's hero-weight
 *   card.
 * - Desktop (lg:): chrome is stripped back off — the reference layout has no
 *   card box, just plain stacked content beside the photo column.
 */
export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[440px] flex-col gap-6",
        "md:rounded-3xl md:border md:border-rj-gray-100 md:bg-rj-white md:p-8 md:shadow-xl",
        "lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
