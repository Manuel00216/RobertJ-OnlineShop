import {
  AnnouncementBar,
  BackToTop,
  LandingFooter,
  LandingNavbar,
} from "@/features/landing";

/**
 * Full-bleed layout for the marketing/landing surface. Hosts the landing chrome
 * (announcement bar, sticky navbar, footer, back-to-top); each landing section
 * owns its own full-width background, so there is no constrained container here.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-col bg-rj-white font-sans text-rj-black">
      <AnnouncementBar />
      <LandingNavbar />
      <main className="flex-1">{children}</main>
      <LandingFooter />
      <BackToTop />
    </div>
  );
}
