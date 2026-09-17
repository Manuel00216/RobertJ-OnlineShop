import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * The `empty-state`/`empty-state__*` classes are theming hooks: the fixed rj-*
 * utilities here render the light-only Buyer look, and a scoped rule in
 * globals.css (`[data-theme-scope] .empty-state__title { … }`) remaps them to
 * theme tokens inside the Admin/Seller portals so this reads correctly in dark
 * mode without threading a prop through its many call sites.
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      className="empty-state flex flex-col items-center gap-2 rounded-2xl border border-dashed border-rj-gray-200 p-10 text-center"
      role="status"
    >
      <p className="empty-state__title text-sm font-medium text-rj-black">{title}</p>
      {description ? (
        <p className="empty-state__desc max-w-sm text-sm text-rj-gray-600">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
