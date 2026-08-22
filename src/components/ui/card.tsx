import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The brand card convention — buyer-facing surfaces (cart, checkout, orders,
 * payments, reviews, notifications) all hand-rolled this exact string
 * independently rather than using `<Card>`, because many of those spots are
 * `<section aria-label>` landmarks or `<li>` list items, not plain `<div>`s —
 * `<Card>` can't stand in for them without breaking semantics or putting a
 * `<div>` inside a `<ul>`. Exporting the class string lets every one of those
 * elements share one definition (`cn(RJ_CARD, "p-5", ...)`) without forcing
 * them through a specific element type. `<Card tone="rj">` uses the same
 * constant for the plain-`<div>` cases where that's the right fit.
 */
export const RJ_CARD = "rounded-2xl border border-rj-gray-100 bg-rj-white text-rj-black";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `default`: generic shadcn look (dashboard/admin surfaces). `rj`: see `RJ_CARD`. */
  tone?: "default" | "rj";
}

export function Card({ className, tone = "default", ...props }: CardProps) {
  return (
    <div
      className={cn(
        tone === "rj"
          ? RJ_CARD
          : "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-base font-semibold leading-tight", className)} {...props} />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-2 p-4 pt-0", className)} {...props} />
  );
}
