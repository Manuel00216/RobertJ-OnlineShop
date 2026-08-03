import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface AuthFooterProps {
  children: ReactNode;
  className?: string;
}

/**
 * Small-print container at the bottom of an auth screen (legal microcopy,
 * back-links). Content varies per screen via `children`.
 */
export function AuthFooter({ children, className }: AuthFooterProps) {
  return <footer className={cn("text-center", className)}>{children}</footer>;
}
