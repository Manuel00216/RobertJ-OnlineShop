"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils/cn";

export interface SocialButtonProps {
  icon: ReactNode;
  label: string;
}

/**
 * Submit button for a single-provider OAuth form. Pending state comes from
 * `useFormStatus`, which only reports its nearest parent `<form>` — each
 * provider must be its own `<form>` (see `SocialLoginButtons`), or both
 * buttons would show pending together.
 */
export function SocialButton({ icon, label }: SocialButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-xl border border-rj-gray-600",
        "bg-rj-white px-4 py-3.5 text-sm font-semibold text-rj-black shadow-sm",
        "transition-opacity disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      {pending ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        icon
      )}
      <span>{label}</span>
    </button>
  );
}
