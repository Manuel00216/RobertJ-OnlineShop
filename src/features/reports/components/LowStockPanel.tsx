import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { InventoryItem } from "@/features/inventory/types/inventory.types";
import { getLowStockReport } from "@/lib/supabase/queries";

/**
 * Low- and out-of-stock products, reusing the RLS-scoped inventory read (no new
 * SQL). Not date-scoped — it reflects current stock, so it takes no filters.
 * `showShop` labels the owning shop when an admin is viewing across shops.
 */
export async function LowStockPanel({ showShop }: { showShop: boolean }) {
  let items: InventoryItem[];
  try {
    items = await getLowStockReport();
  } catch {
    return <ErrorState message="We couldn't load the low-stock report right now." />;
  }

  return (
    <Card className="border-rj-gray-100">
      <CardContent className="flex flex-col gap-4 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rj-gray-400">
          Low &amp; out of stock
        </p>
        {items.length > 0 ? (
          <ul className="flex flex-col divide-y divide-rj-gray-50">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-rj-black">{item.productTitle}</p>
                  {showShop && item.shopName ? (
                    <p className="truncate text-xs text-rj-gray-500">{item.shopName}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm tabular-nums text-rj-gray-600">
                    {item.quantity} left
                  </span>
                  <Badge tone={item.stockStatus === "out_of_stock" ? "danger" : "warning"}>
                    {item.stockStatus === "out_of_stock" ? "Out of stock" : "Low stock"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Stock looks healthy"
            description="No products are at or below their low-stock threshold."
          />
        )}
      </CardContent>
    </Card>
  );
}
