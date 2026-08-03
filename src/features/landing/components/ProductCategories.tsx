import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ROUTES } from "@/constants/routes";
import { listActiveCategories } from "@/lib/supabase/queries";
import { Reveal } from "@/features/landing/components/Reveal";
import {
  CATEGORY_FALLBACK_IMAGES,
  CATEGORY_PLACEHOLDERS,
} from "@/features/landing/constants/landing.constants";

interface CategoryCard {
  key: string;
  name: string;
  countLabel: string;
  imageUrl: string;
  href: string;
}

/**
 * Bento grid of shoppable categories. Fetches real categories (with active
 * product counts); if the taxonomy is not seeded yet, it falls back to
 * clearly-marked placeholder tiles so the section never renders empty.
 */
export async function ProductCategories() {
  let cards: CategoryCard[];

  try {
    const categories = await listActiveCategories(4);
    cards =
      categories.length > 0
        ? categories.map((category, i) => ({
            key: category.id,
            name: category.name,
            countLabel: `${category.productCount.toLocaleString("en-US")} item${
              category.productCount === 1 ? "" : "s"
            }`,
            imageUrl:
              category.imageUrl ??
              CATEGORY_FALLBACK_IMAGES[i % CATEGORY_FALLBACK_IMAGES.length],
            href: ROUTES.categoryDetail(category.slug),
          }))
        : CATEGORY_PLACEHOLDERS.map((placeholder) => ({
            key: placeholder.name,
            name: placeholder.name,
            countLabel: placeholder.countLabel,
            imageUrl: placeholder.imageUrl,
            href: ROUTES.products,
          }));
  } catch {
    cards = CATEGORY_PLACEHOLDERS.map((placeholder) => ({
      key: placeholder.name,
      name: placeholder.name,
      countLabel: placeholder.countLabel,
      imageUrl: placeholder.imageUrl,
      href: ROUTES.products,
    }));
  }

  return (
    <section className="bg-rj-black py-24">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal className="mb-12">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red">
            Browse by Category
          </p>
          <h2 className="font-serif text-4xl leading-[1.05] text-rj-white md:text-[52px]">
            Shop Every Style
          </h2>
        </Reveal>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {cards.map((card, i) => (
            <Link
              key={card.key}
              href={card.href}
              className={`group relative overflow-hidden rounded-2xl ${
                i === 0 ? "md:col-span-2 md:row-span-2" : ""
              }`}
              style={{ minHeight: i === 0 ? 440 : 210 }}
            >
              <div className="absolute inset-0 bg-rj-gray-800">
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  sizes={i === 0 ? "(min-width: 768px) 50vw, 50vw" : "(min-width: 768px) 25vw, 50vw"}
                  className="object-cover opacity-65 transition-all duration-500 group-hover:scale-105 group-hover:opacity-85"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-rj-black/85 via-rj-black/20 to-transparent" />
              <div className="absolute inset-0 rounded-2xl border-2 border-rj-red/0 transition-all duration-300 group-hover:border-rj-red/40" />
              <div className="absolute bottom-0 left-0 p-5">
                <div className="mb-1 text-[10px] font-medium tracking-widest text-rj-gray-400">
                  {card.countLabel}
                </div>
                <h3 className="font-serif text-2xl text-rj-white transition-colors group-hover:text-rj-red">
                  {card.name}
                </h3>
                <div className="mt-2 flex translate-y-1 items-center gap-1 text-[11px] font-bold text-rj-red opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                  Shop now <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
