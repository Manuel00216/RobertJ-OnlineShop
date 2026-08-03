import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { ROUTES } from "@/constants/routes";
import {
  FOOTER_COLUMNS,
  FOOTER_LEGAL_LINKS,
  FOOTER_TRUST_BADGES,
} from "@/features/landing/constants/landing.constants";

/*
 * Instagram / Facebook / TikTok have no Lucide glyphs in this version, so they
 * are the documented exception to the "use Lucide" rule and ship as inline SVGs
 * copied from the approved design.
 */
const SOCIALS: { label: string; icon: ReactNode }[] = [
  {
    label: "Instagram",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" />
        <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "TikTok",
    icon: (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9 12a4 4 0 104 4V4a5 5 0 005 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function LandingFooter() {
  return (
    <footer className="bg-[#0A0A0A] pb-8 pt-20 text-rj-white">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mb-16 grid grid-cols-1 gap-10 border-b border-rj-gray-800 pb-16 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-baseline gap-0.5">
              <span className="font-serif text-2xl">RobertJ</span>
              <span className="ml-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-rj-red">
                Marketplace
              </span>
            </div>
            <p className="mb-7 max-w-xs text-[13px] leading-relaxed text-rj-gray-600">
              A centralized multi-shop clothing marketplace for modern Filipino
              shoppers. Verified sellers, quality products, one seamless
              experience.
            </p>
            <div className="mb-8 flex gap-3">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-rj-gray-800 text-rj-gray-600 transition-all hover:border-rj-red hover:text-rj-red"
                >
                  {social.icon}
                </a>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {FOOTER_TRUST_BADGES.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-1.5 rounded-full bg-[#1A1A1A] px-3 py-1.5"
                >
                  <ShieldCheck className="h-2.5 w-2.5 text-rj-green" aria-hidden="true" />
                  <span className="text-[10px] text-rj-gray-600">{badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h4 className="mb-5 text-[10px] font-bold uppercase tracking-[0.25em] text-rj-gray-600">
                {column.heading}
              </h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link}>
                    <Link
                      href={ROUTES.products}
                      className="text-[13px] text-rj-gray-400 transition-colors hover:text-rj-white"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-[11px] text-rj-gray-600">
            © {new Date().getFullYear()} RobertJ Marketplace. All rights reserved.
          </p>
          <div className="flex gap-6">
            {FOOTER_LEGAL_LINKS.map((link) => (
              <a
                key={link}
                href="#"
                className="text-[11px] text-rj-gray-600 transition-colors hover:text-rj-white"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
