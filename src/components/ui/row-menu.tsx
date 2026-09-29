"use client";

import { MoreVertical } from "lucide-react";
import type { ReactNode } from "react";

export interface RowMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/** Table-row kebab menu — a button + absolutely-positioned panel, dismissed via blur (no document-level listener needed). Shared by the Products and Inventory dashboard tables. */
export function RowMenu({ open, onOpenChange, children }: RowMenuProps) {
  return (
    <div
      className="relative inline-block text-left"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onOpenChange(false);
      }}
    >
      <button
        type="button"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[170px] rounded-md border border-border bg-card p-1 text-left shadow-md"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
