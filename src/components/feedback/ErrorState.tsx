import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

/**
 * Title/border/background already resolve through the semantic `danger` tokens,
 * so they adapt to dark mode on their own. The message line is the one fixed
 * rj-* value; its `error-state__message` class is a theming hook a scoped rule
 * in globals.css remaps to `--muted-foreground` inside the Admin/Seller portals.
 *
 * Left-aligned icon + text rather than a centered block: a leading icon reads
 * as "error" at a glance, and a left-accent border is less visually heavy
 * than a box outlined on all four sides while still reading clearly as danger.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  action,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-danger/15 border-l-4 border-l-danger bg-danger/5 p-4"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-0.5 pt-0.5">
        <p className="text-sm font-semibold text-danger">{title}</p>
        <p className="error-state__message text-sm text-rj-gray-600">{message}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
