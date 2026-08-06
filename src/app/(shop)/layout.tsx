import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

/**
 * Application chrome for the transactional side of the app (products, cart,
 * sign-in, …). The marketing/landing surface uses its own full-bleed layout,
 * so this header/footer no longer live in the root layout. `bg-rj-white` is
 * explicit here (mirroring `(marketing)/layout.tsx`) because the root
 * layout's `bg-background` token flips to near-black under
 * `prefers-color-scheme: dark` — without this override, every shop page goes
 * black for anyone on a dark-mode OS/browser.
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
