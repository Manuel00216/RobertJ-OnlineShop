import type { ReactNode } from "react";

export interface CatalogHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * rj editorial page header for the catalog surfaces (listing, category pages).
 * Matches the landing section headers; the eyebrow uses the AA-safe
 * `rj-red-dark` for small red text (auth-spec rule), not `rj-red`.
 */
export function CatalogHeader({
  eyebrow,
  title,
  description,
  actions,
}: CatalogHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red-dark">
        {eyebrow}
      </p>
      <h1 className="font-serif text-4xl leading-[1.05] text-rj-black md:text-[52px]">
        {title}
      </h1>
      {description ? (
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-rj-gray-600">{description}</p>
      ) : null}
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
