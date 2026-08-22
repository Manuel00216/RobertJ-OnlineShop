import { Badge } from "@/components/ui/badge";
import {
  STOCK_STATUS_LABELS,
  getStockStatusTone,
} from "@/features/inventory/constants/inventory.constants";
import type { StockStatus } from "@/features/inventory/types/inventory.types";

/** Stock status pill — mirrors `ProductStatusBadge`'s exact pattern. */
export function StockStatusBadge({ status }: { status: StockStatus }) {
  return (
    <Badge tone={getStockStatusTone(status)}>{STOCK_STATUS_LABELS[status]}</Badge>
  );
}
