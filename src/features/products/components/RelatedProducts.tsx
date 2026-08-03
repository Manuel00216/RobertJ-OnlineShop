import { listRelatedProducts } from "@/lib/supabase/queries";
import { ProductGrid } from "@/features/products/components/ProductGrid";
import type { Product } from "@/features/products/types/product.types";

export interface RelatedProductsProps {
  product: Product;
}

/** Same-category listings, newest first; renders nothing when empty. */
export async function RelatedProducts({ product }: RelatedProductsProps) {
  const related = await listRelatedProducts(product, 4).catch(() => []);
  if (related.length === 0) return null;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red-dark">
          You may also like
        </p>
        <h2 className="font-serif text-3xl leading-[1.05] text-rj-black">
          More from this category
        </h2>
      </div>
      <ProductGrid products={related} />
    </section>
  );
}
