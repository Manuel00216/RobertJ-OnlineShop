import type { ReactNode } from "react";

import { AuthCard } from "./AuthCard";
import { EditorialPanel, type EditorialPanelProps } from "./EditorialPanel";

export interface AuthLayoutProps {
  /** Per-screen copy for the desktop editorial panel. */
  editorial: EditorialPanelProps;
  children: ReactNode;
}

/**
 * Shared responsive auth shell (frozen spec §2). The single place breakpoint
 * behavior and backgrounds live:
 * - Mobile (<768): full-bleed white page, no card chrome.
 * - Tablet (md: 768–1023): centered card on `rj-gray-50`.
 * - Desktop (lg: ≥1024): `Hero.tsx`-style split — black editorial panel
 *   (45%) + white card column (55%).
 */
export function AuthLayout({ editorial, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-rj-white font-sans text-rj-black md:bg-rj-gray-50 lg:bg-rj-white">
      <EditorialPanel {...editorial} />
      <main className="flex w-full flex-1 items-start justify-center px-6 py-10 md:items-center md:py-16 lg:px-8">
        <AuthCard>{children}</AuthCard>
      </main>
    </div>
  );
}
