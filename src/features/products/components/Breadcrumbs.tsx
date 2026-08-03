import Link from "next/link";

export interface BreadcrumbsProps {
  items: Array<{ label: string; href?: string }>;
}

/** rj breadcrumb trail. The last item renders as the current (unlinked) crumb. */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <span aria-hidden="true" className="text-rj-gray-200">
                  /
                </span>
              ) : null}
              {isLast || !item.href ? (
                <span className="text-[11px] font-medium tracking-wide text-rj-black">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-[11px] font-medium tracking-wide text-rj-gray-400 hover:text-rj-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
