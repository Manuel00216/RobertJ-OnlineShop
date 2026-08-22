import { Badge } from "@/components/ui/badge";
import { PRODUCT_STATUS_LABELS, type ProductStatus } from "@/constants/status";
import { getProductStatusTone } from "@/features/products/constants/product.constants";

/**
 * Product status pill — mirrors `OrderStatusBadge`'s exact pattern. The label
 * is the primary signal; tone is secondary so colour is never the only
 * differentiator (WCAG 2.2 AA).
 */
export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <Badge tone={getProductStatusTone(status)}>
      {PRODUCT_STATUS_LABELS[status]}
    </Badge>
  );
}
