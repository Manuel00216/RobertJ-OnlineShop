import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-rj-gray-200 p-10 text-center"
      role="status"
    >
      <p className="text-sm font-medium text-rj-black">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-rj-gray-600">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
