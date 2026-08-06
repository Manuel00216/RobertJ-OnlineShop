import { AnnouncementBar, BackToTop } from "@/features/landing";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

/**
 * Full-bleed layout for the marketing/landing surface. Uses the same
 * site-wide SiteHeader/SiteFooter as every other route group (see
 * ARCHITECTURE.md — the marketing and shop surfaces previously had two
 * disconnected chrome systems); each landing section still owns its own
 * full-width background, so there is no constrained container here. The
 * announcement bar is intentionally marketing-only, not sitewide — it's a
 * promo banner, not something checkout should show.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-col bg-rj-white font-sans text-rj-black">
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <BackToTop />
    </div>
  );
}
