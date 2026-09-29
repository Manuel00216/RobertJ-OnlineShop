"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Payment-method dropdown for the dashboard Payments table — sets `paymentMethodType`, always clears `page`. */
export function PaymentMethodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = searchParams.get("paymentMethodType") ?? "";

  function updateParams(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("paymentMethodType", value);
    else params.delete("paymentMethodType");
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <select
      value={active}
      onChange={(event) => updateParams(event.target.value)}
      aria-label="Filter by payment method"
      className="h-9 rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <option value="">All methods</option>
      <option value="cod">Cash on Delivery</option>
      <option value="xendit">Online Payment</option>
      <option value="qr_upload">QR Transfer (legacy)</option>
    </select>
  );
}
