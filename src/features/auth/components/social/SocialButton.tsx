import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export interface SocialButtonProps {
  icon: ReactNode;
  label: string;
}

/**
 * Visual-only social sign-in option — OAuth is not implemented (out of
 * scope, see README/MODULES.md), so this is inert markup, not a real action.
 */
export function SocialButton({ icon, label }: SocialButtonProps) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Coming soon"
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-xl border border-rj-gray-600",
        "bg-rj-white px-4 py-3.5 text-sm font-semibold text-rj-black shadow-sm",
        "cursor-not-allowed opacity-60",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
