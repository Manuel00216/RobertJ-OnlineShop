import Link from "next/link";

import { ROUTES } from "@/constants/routes";

export default function SellerOrderNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 p-5 py-16 text-center lg:p-7">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-danger">404</p>
      <h1 className="text-2xl font-semibold text-foreground">Order not found</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        We couldn&apos;t find that order. It may no longer be available.
      </p>
      <Link
        href={ROUTES.sellerOrders}
        className="mt-2 inline-flex items-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        View orders
      </Link>
    </div>
  );
}
