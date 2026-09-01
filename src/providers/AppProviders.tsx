"use client";

import type { ReactNode } from "react";

import { CartProvider } from "@/features/cart/providers/CartProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";

/** Single mounting point for every client-side provider. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <CartProvider>{children}</CartProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
