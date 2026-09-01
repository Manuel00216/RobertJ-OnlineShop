import Link from "next/link";

import { ROUTES } from "@/constants/routes";

export default function AdminOrderNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 p-5 py-16 text-center lg:p-7">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-500">404</p>
      <h1 className="text-2xl font-semibold text-gray-900">Order not found</h1>
      <p className="max-w-sm text-sm leading-relaxed text-gray-500">
        We couldn&apos;t find that order. It may belong to a different shop or may no longer be
        available.
      </p>
      <Link
        href={ROUTES.adminOrders}
        className="mt-2 inline-flex items-center rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
      >
        View orders
      </Link>
    </div>
  );
}
