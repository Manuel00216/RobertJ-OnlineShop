"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Dashboard-group error boundary — mirrors `(account)/error.tsx`. Also
 * catches the admin-only pages' `requireRole` throw when a seller navigates
 * there directly, with friendly copy instead of a raw stack trace.
 */
export default function DashboardError({ reset }: DashboardErrorProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red-dark">
        Something went wrong
      </p>
      <h1 className="font-serif text-3xl leading-[1.05] text-rj-black">
        We couldn&apos;t load the dashboard
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-rj-gray-600">
        Please try again, or head back to the dashboard overview.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className={cn(buttonVariants({ variant: "rj", size: "rjSm" }))}
        >
          Try again
        </button>
        <Link
          href={ROUTES.dashboard}
          className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
