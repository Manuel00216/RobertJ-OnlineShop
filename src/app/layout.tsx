import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";

import { siteConfig } from "@/config/site";
import { AppProviders } from "@/providers/AppProviders";

import "./globals.css";

/** Body typeface — variable, so no explicit weights needed. */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

/** Display typeface for headings. Only ships weight 400. */
const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmSerif.variable} h-full overflow-x-clip antialiased`}
    >
      {/* overflow-x-clip (not `hidden`) guards against transform-induced horizontal
          overflow — e.g. Reveal's pre-animation translate-x offsets — without
          breaking `position: sticky` descendants (the site header relies on it):
          `clip` doesn't establish a scroll-container the way `hidden`/`auto` do.
          Set on <html> (not just <body>): `document.documentElement.scrollWidth`
          measures <html>, and body's overflow doesn't reliably propagate to the
          viewport for the newer `clip` value across browsers. */}
      <body className="flex min-h-full flex-col overflow-x-clip bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
