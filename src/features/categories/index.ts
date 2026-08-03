// Public type + server-component surface. The read service is server-only and
// imported directly by Server Components (see features/products for the same
// convention), so it is deliberately not re-exported here where a Client
// Component might reach it.
export { CategoryCard } from "./components/CategoryCard";
export { CategoryGrid } from "./components/CategoryGrid";
export type { Category } from "./types/category.types";
