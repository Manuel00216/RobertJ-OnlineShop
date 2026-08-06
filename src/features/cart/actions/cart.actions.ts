"use server";

import { fail, ok } from "@/lib/utils/result";
import { getClientIp } from "@/lib/utils/request";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { checkCartAvailabilitySchema } from "@/features/cart/schemas/cart.schema";
import type { ProductPriceAndStock } from "@/lib/supabase/queries";

/**
 * Revalidates a client-side cart's price/stock against the live `products`
 * table. Public — the cart is a guest-accessible feature (ADR-013), so this
 * intentionally does not call `requireSessionUser()`.
 */
export async function checkCartAvailabilityAction(
  productIds: string[],
): Promise<ActionResult<ProductPriceAndStock[]>> {
  const parsed = checkCartAvailabilitySchema.safeParse({ productIds });
  if (!parsed.success) {
    return fail("Could not check item availability.");
  }

  try {
    const ip = await getClientIp();
    await queries.requireRateLimit(`cartAvailability:${ip}`, 20, 60);
    const availability = await queries.getProductsPriceAndStock(
      parsed.data.productIds,
    );
    return ok(availability);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not check item availability.",
    );
  }
}
