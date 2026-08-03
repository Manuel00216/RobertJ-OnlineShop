"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Wordmark } from "@/components/brand/Wordmark";
import { ROUTES } from "@/constants/routes";
import { useCart } from "@/features/cart/hooks/useCart";
import { NAV_LINKS } from "@/features/landing/constants/landing.constants";
import type { SessionUser } from "@/types/common.types";

/**
 * Landing navbar. `user` is passed down from the server-rendered marketing
 * layout (no client auth hook) so the auth entry flips between Sign In and
 * My Account without a session round-trip.
 */
export function LandingNavbar({ user = null }: { user?: SessionUser | null }) {
  const { itemCount } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-rj-white/96 shadow-[0_1px_0_#EBEBEB] backdrop-blur-lg"
          : "bg-rj-white"
      }`}
    >
      <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
        <Wordmark />

        {/* Desktop nav */}
        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((item) => (
            <Link
              key={item}
              href={ROUTES.products}
              className="group relative py-1 text-[13px] font-medium text-rj-gray-600 transition-colors hover:text-rj-black"
            >
              {item === "Sale" ? <span className="text-rj-red">{item}</span> : item}
              <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-rj-red transition-all duration-200 group-hover:w-full" />
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          {/* Search */}
          <div
            className={`hidden items-center overflow-hidden transition-all duration-300 md:flex ${
              searchOpen ? "w-52" : "w-8"
            }`}
          >
            {searchOpen ? (
              <div className="flex w-full items-center gap-2 rounded-full border border-rj-gray-200 px-3.5 py-1.5">
                <Search className="h-[13px] w-[13px] text-rj-gray-400" aria-hidden="true" />
                <input
                  ref={searchRef}
                  placeholder="Search…"
                  onBlur={() => setSearchOpen(false)}
                  aria-label="Search items or shops"
                  className="w-full bg-transparent text-[13px] text-rj-black outline-none placeholder:text-rj-gray-400"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Open search"
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-rj-gray-100"
              >
                <Search className="h-4 w-4 text-rj-black" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Cart */}
          <Link
            href={ROUTES.cart}
            aria-label={`Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
            className="relative flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-rj-gray-100"
          >
            <ShoppingBag className="h-[18px] w-[18px] text-rj-black" aria-hidden="true" />
            {itemCount > 0 ? (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rj-red px-0.5 text-[9px] font-bold text-white"
                style={{ animation: "pop 0.2s ease" }}
              >
                {itemCount}
              </span>
            ) : null}
          </Link>

          {/* Sign In */}
          <Link
            href={ROUTES.signIn}
            className="ml-1 hidden items-center rounded-full bg-rj-black px-4 py-1.5 text-[13px] font-semibold text-rj-white transition-colors hover:bg-rj-red md:inline-flex"
          >
            Sign In
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-rj-gray-100 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? (
              <X className="h-[18px] w-[18px] text-rj-black" aria-hidden="true" />
            ) : (
              <Menu className="h-[18px] w-[18px] text-rj-black" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-col gap-5 overflow-hidden border-t border-rj-gray-100 bg-rj-white px-5 py-5 md:hidden"
        >
          {NAV_LINKS.map((item) => (
            <Link
              key={item}
              href={ROUTES.products}
              onClick={() => setMenuOpen(false)}
              className={`text-sm font-semibold ${
                item === "Sale" ? "text-rj-red" : "text-rj-black"
              }`}
            >
              {item}
            </Link>
          ))}
          <div className="flex items-center gap-2 rounded-full border border-rj-gray-100 px-4 py-2">
            <Search className="h-[13px] w-[13px] text-rj-gray-400" aria-hidden="true" />
            <input
              placeholder="Search items or shops…"
              aria-label="Search items or shops"
              className="w-full bg-transparent text-sm text-rj-black outline-none placeholder:text-rj-gray-400"
            />
          </div>
          <Link
            href={ROUTES.signIn}
            className="rounded-full bg-rj-black px-4 py-2.5 text-center text-sm font-semibold text-rj-white transition-colors hover:bg-rj-red"
          >
            Sign In
          </Link>
        </motion.div>
        ) : null}
      </AnimatePresence>
    </nav>
  );
}
