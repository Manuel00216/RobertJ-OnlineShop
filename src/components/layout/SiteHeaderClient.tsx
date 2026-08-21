"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AccountMenu } from "@/features/account/components/AccountMenu";
import { Wordmark } from "@/components/brand/Wordmark";
import { ROUTES } from "@/constants/routes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCart } from "@/features/cart/hooks/useCart";
import { searchProductSuggestionsAction } from "@/features/products/actions/product.actions";
import type { Category } from "@/features/categories/types/category.types";
import type { SessionUser } from "@/types/common.types";
import type { ProductSuggestion } from "@/lib/supabase/queries";

export interface SiteHeaderClientProps {
  user: SessionUser | null;
  categories: Category[];
}

/**
 * Interactive shell for the shared site header. Categories and search are
 * both real, wired controls (not decorative) — search submits to
 * `/products?search=` rather than live-filtering, since this header renders
 * on every page (including checkout), where a debounced auto-navigate on
 * keystroke would be actively harmful. A lightweight suggestions dropdown
 * (title-only matches, `searchProductSuggestionsAction`) is layered on top
 * of that same input — it only ever navigates on an explicit click into a
 * specific product, never on typing.
 */
export function SiteHeaderClient({ user, categories }: SiteHeaderClientProps) {
  const router = useRouter();
  const { itemCount } = useCart();

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const debouncedSearchValue = useDebouncedValue(searchValue, 250);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!categoriesOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (categoriesRef.current && !categoriesRef.current.contains(event.target as Node)) {
        setCategoriesOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCategoriesOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [categoriesOpen]);

  // Suggestions only — this never navigates on its own. Submitting the form
  // (Enter / the search button) is still the only thing that goes to the
  // results page; see the class comment for why auto-navigate-on-keystroke
  // was rejected here.
  useEffect(() => {
    if (debouncedSearchValue.trim().length < 2) return;
    let cancelled = false;
    searchProductSuggestionsAction(debouncedSearchValue).then((result) => {
      if (!cancelled && result.success) setSuggestions(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearchValue]);

  function submitSearch(value: string) {
    const trimmed = value.trim();
    router.push(trimmed ? `${ROUTES.products}?search=${encodeURIComponent(trimmed)}` : ROUTES.products);
    setMenuOpen(false);
    setMobileSearchOpen(false);
    setShowSuggestions(false);
  }

  function goToSuggestion(slug: string) {
    router.push(ROUTES.productDetail(slug));
    setSearchValue("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-rj-white/96 shadow-[0_1px_0_#EBEBEB] backdrop-blur-lg"
          : "bg-rj-white"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-5 md:px-8">
        <Wordmark />

        {/* Categories dropdown — desktop */}
        <div ref={categoriesRef} className="relative hidden md:block">
          <button
            type="button"
            onClick={() => setCategoriesOpen((v) => !v)}
            aria-expanded={categoriesOpen}
            aria-haspopup="menu"
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-rj-gray-600 transition-colors hover:bg-rj-gray-100 hover:text-rj-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
          >
            Categories
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${categoriesOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {categoriesOpen ? (
            <div
              role="menu"
              aria-label="Categories"
              className="absolute left-0 top-full z-50 mt-2 w-60 rounded-2xl border border-rj-gray-100 bg-rj-white p-2 shadow-lg"
            >
              <Link
                href={ROUTES.categories}
                role="menuitem"
                onClick={() => setCategoriesOpen(false)}
                className="block rounded-xl px-3 py-2 text-[13px] font-semibold text-rj-black transition-colors hover:bg-rj-gray-100"
              >
                All Categories
              </Link>
              {categories.length > 0 ? (
                <div className="mt-1 border-t border-rj-gray-100 pt-1">
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={ROUTES.categoryDetail(category.slug)}
                      role="menuitem"
                      onClick={() => setCategoriesOpen(false)}
                      className="block rounded-xl px-3 py-2 text-[13px] text-rj-gray-600 transition-colors hover:bg-rj-gray-100 hover:text-rj-black"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Search — desktop, always visible, real submit */}
        <div className="relative hidden max-w-md flex-1 md:block">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch(searchValue);
            }}
            className="flex items-center gap-2 rounded-full border border-rj-gray-200 px-4 py-2 transition-colors focus-within:border-rj-black"
          >
            <label htmlFor="site-search" className="sr-only">
              Search products
            </label>
            <input
              id="site-search"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search for anything…"
              className="w-full bg-transparent text-[13px] text-rj-black outline-none placeholder:text-rj-gray-400"
            />
            <button
              type="submit"
              aria-label="Search"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rj-red text-white transition-colors hover:bg-rj-red-dark"
            >
              <Search className="h-3 w-3" aria-hidden="true" />
            </button>
          </form>

          {showSuggestions && debouncedSearchValue.trim().length >= 2 && suggestions.length > 0 ? (
            <div
              role="listbox"
              aria-label="Search suggestions"
              className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-rj-gray-100 bg-rj-white shadow-lg"
            >
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={() => goToSuggestion(suggestion.slug)}
                  className="block w-full truncate px-4 py-2.5 text-left text-[13px] text-rj-gray-700 transition-colors hover:bg-rj-gray-100 hover:text-rj-black"
                >
                  {suggestion.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Search — mobile icon trigger */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen((v) => !v)}
            aria-label="Open search"
            aria-expanded={mobileSearchOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-rj-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30 md:hidden"
          >
            <Search className="h-4 w-4 text-rj-black" aria-hidden="true" />
          </button>

          <Link
            href={ROUTES.cart}
            aria-label={`Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
            className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-rj-gray-100"
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

          {user ? (
            <AccountMenu user={user} />
          ) : (
            <Link
              href={ROUTES.signIn}
              className="ml-1 hidden items-center rounded-full bg-rj-black px-4 py-1.5 text-[13px] font-semibold text-rj-white transition-colors hover:bg-rj-red md:inline-flex"
            >
              Sign In
            </Link>
          )}

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-rj-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30 md:hidden"
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

      {/* Mobile search — collapses below the header when opened */}
      <AnimatePresence>
        {mobileSearchOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-rj-gray-100 px-5 py-3 md:hidden"
          >
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch(searchValue);
              }}
              className="flex items-center gap-2 rounded-full border border-rj-gray-200 px-4 py-2"
            >
              <Search className="h-[13px] w-[13px] text-rj-gray-400" aria-hidden="true" />
              <label htmlFor="site-search-mobile" className="sr-only">
                Search products
              </label>
              <input
                id="site-search-mobile"
                type="search"
                autoFocus
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search for anything…"
                className="w-full bg-transparent text-sm text-rj-black outline-none placeholder:text-rj-gray-400"
              />
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

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
            <Link
              href={ROUTES.categories}
              onClick={() => setMenuOpen(false)}
              className="text-sm font-semibold text-rj-black"
            >
              All Categories
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={ROUTES.categoryDetail(category.slug)}
                onClick={() => setMenuOpen(false)}
                className="-mt-2 text-sm text-rj-gray-600"
              >
                {category.name}
              </Link>
            ))}
            <Link
              href={`${ROUTES.products}?sort=newest`}
              onClick={() => setMenuOpen(false)}
              className="text-sm font-semibold text-rj-black"
            >
              New Arrivals
            </Link>
            {!user ? (
              <Link
                href={ROUTES.signIn}
                onClick={() => setMenuOpen(false)}
                className="rounded-full bg-rj-black px-4 py-2.5 text-center text-sm font-semibold text-rj-white transition-colors hover:bg-rj-red"
              >
                Sign In
              </Link>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
