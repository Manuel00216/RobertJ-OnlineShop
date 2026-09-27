import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

/**
 * Application chrome for the transactional/buyer side of the app (products,
 * cart, sign-in, …). The marketing/landing surface uses its own full-bleed
 * layout, so this header/footer no longer live in the root layout.
 *
 * Role separation is enforced per-surface, NOT by a blanket redirect here:
 * seller/admin may freely browse the read-only storefront (products,
 * categories, product details), so this layout stays open to every role and
 * guest. The buyer-only *transaction* routes (cart, checkout, checkout/resume,
 * wishlist) each guard themselves (redirecting seller/admin), and the buyer
 * transaction controls are hidden for seller/admin in the header/tiles/PDP.
 * The authoritative boundary remains the server actions + `create_order`/RLS.
 */
export default function ShopLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-rj-white font-sans text-rj-black">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
