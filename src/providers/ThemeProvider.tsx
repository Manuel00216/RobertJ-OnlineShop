"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Global Light/Dark/System theme provider — mounted once for the whole app
 * (Buyer, Admin, and future Seller) so the underlying mechanism is shared,
 * even though only the Admin Portal exposes a visible toggle today. Actual
 * dark-mode CSS only takes effect inside `[data-theme-scope="admin"]` (see
 * `globals.css`), so toggling this has no visual effect on Buyer/Seller
 * surfaces regardless of the class this sets on `<html>`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
