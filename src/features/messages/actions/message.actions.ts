"use server";

import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { revalidateOrderSurfaces } from "@/features/orders";
import { sendOrderMessageSchema } from "@/features/messages/schemas/message.schema";

/**
 * Sends a message in an order's buyer<->shop conversation. Authorization
 * (caller is an order participant) and the sender identity/role derivation all
 * happen inside the `send_order_message` RPC — this action validates input and
 * delegates. `requireSessionUser` here is defense-in-depth; the RPC re-checks
 * `auth.uid()` independently. Revalidates every order-detail surface so the new
 * message appears for the buyer and the shop's sellers/admin alike.
 */
export async function sendOrderMessageAction(
  _prevState: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = sendOrderMessageSchema.safeParse({
    orderId: formData.get("orderId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    await queries.requireSessionUser();
    await queries.sendOrderMessage(parsed.data.orderId, parsed.data.body);
    await revalidateOrderSurfaces(parsed.data.orderId);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not send your message.",
    );
  }
}
