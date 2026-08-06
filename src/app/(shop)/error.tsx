"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";

interface ShopErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Shop-group error boundary — rj-styled retry instead of the generic root page. */
export default function ShopError({ reset }: ShopErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-16 text-center"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red-dark">
        Something went wrong
      </p>
      <h1 className="font-serif text-3xl leading-[1.05] text-rj-black">
        We couldn&apos;t load this page
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-rj-gray-600">
        Please try again. If it keeps happening, come back a little later.
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
          href={ROUTES.home}
          className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
        >
          Back to shop
        </Link>
      </div>
    </div>
  );
}
