"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Admin Portal error boundary — mirrors `dashboard/error.tsx`, styled for the admin shell's light content area. */
export default function AdminError({ reset }: AdminErrorProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-danger">Something went wrong</p>
      <h1 className="text-2xl font-semibold text-foreground">We couldn&apos;t load this page</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Please try again, or head back to the admin dashboard.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
        >
          Try again
        </button>
        <Link
          href={ROUTES.adminDashboard}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
