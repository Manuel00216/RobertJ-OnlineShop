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
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  action,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-2xl border border-danger/40 bg-danger/5 p-10 text-center"
    >
      <p className="text-sm font-medium text-danger">{title}</p>
      <p className="error-state__message max-w-sm text-sm text-rj-gray-600">{message}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
