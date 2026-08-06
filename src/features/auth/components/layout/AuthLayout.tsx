import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/Wordmark";

import { AuthCard } from "./AuthCard";
import { EditorialPanel, type EditorialPanelProps } from "./EditorialPanel";

export interface AuthLayoutProps {
  /** Optional override for the desktop editorial panel's photo. */
  editorial?: EditorialPanelProps;
  children: ReactNode;
}

/**
 * Shared responsive auth shell. Breakpoint behavior:
 * - Mobile (<768): full-bleed white page, no card chrome.
 * - Tablet (md: 768–1023): centered card on `rj-gray-50`.
 * - Desktop (lg: ≥1024): a page-level logo bar above a centered two-column
 *   grid — photo block (58%) + plain, chrome-less content column (42%),
 *   vertically centered against the photo, mirroring the reference sign-in
 *   layout's proportions and alignment.
 */
export function AuthLayout({ editorial, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-rj-white font-sans text-rj-black md:bg-rj-gray-50 lg:bg-rj-white">
      <header className="hidden lg:flex lg:items-center lg:px-10 lg:pb-2 lg:pt-6">
        <Wordmark />
      </header>

      <div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-7xl lg:grid lg:grid-cols-[58fr_42fr] lg:items-center lg:gap-x-50 lg:px-10 lg:pb-10">
        <div className="hidden lg:block">
          <EditorialPanel {...editorial} />
        </div>

        <main className="flex w-full flex-1 items-center justify-center px-6 py-10 md:py-16 lg:justify-start lg:px-0 lg:py-0">
          <AuthCard>{children}</AuthCard>
        </main>
      </div>
    </div>
  );
}
