import Link from "next/link";

import { ROUTES } from "@/constants/routes";

export default function ProductNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red-dark">404</p>
      <h1 className="font-serif text-4xl leading-[1.05] text-rj-black">Product not found</h1>
      <p className="max-w-sm text-sm leading-relaxed text-rj-gray-600">
        This listing may have been sold or removed. Browse the marketplace for what is
        available.
      </p>
      <Link
        href={ROUTES.products}
        className="mt-2 inline-flex items-center rounded-full border-[1.5px] border-rj-black px-8 py-3.5 text-[13px] font-bold text-rj-black transition-colors hover:bg-rj-black hover:text-rj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
      >
        Browse products
      </Link>
    </div>
  );
}
