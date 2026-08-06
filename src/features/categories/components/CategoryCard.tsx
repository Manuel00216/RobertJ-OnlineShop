import { ROUTES } from "@/constants/routes";
import { CategoryTile } from "@/features/categories/components/CategoryTile";
import type { Category } from "@/features/categories/types/category.types";

export interface CategoryCardProps {
  category: Category;
}

/** Real-category tile for the /categories grid. Visual treatment lives in `CategoryTile`. */
export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <CategoryTile
      href={ROUTES.categoryDetail(category.slug)}
      imageUrl={category.imageUrl}
      name={category.name}
      countLabel={`${category.productCount.toLocaleString("en-US")} item(s)`}
    />
  );
}
