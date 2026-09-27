import { z } from "zod";

import { paginationSchema } from "@/lib/validations/common.schema";

/** Validates and normalises search params for the admin Users listing. */
export const userListParamsSchema = paginationSchema.extend({
  /** Name/username/email search; mirrors `buyerOrderListParamsSchema.search`'s shape. */
  search: z.string().trim().min(1).max(80).optional(),
});

export type UserListParams = z.infer<typeof userListParamsSchema>;

/** Payload for promoting a buyer to seller and/or (re)assigning their shop. */
export const assignSellerShopSchema = z.object({
  userId: z.uuid(),
  shopId: z.uuid(),
});

export type AssignSellerShopInput = z.infer<typeof assignSellerShopSchema>;

/** Payload for reversibly demoting a seller back to buyer (M3). */
export const demoteSellerToBuyerSchema = z.object({
  userId: z.uuid(),
});

export type DemoteSellerToBuyerInput = z.infer<typeof demoteSellerToBuyerSchema>;

/** Payload for activating/deactivating a buyer or seller account. */
export const setUserActiveSchema = z.object({
  userId: z.uuid(),
  isActive: z.boolean(),
});

export type SetUserActiveInput = z.infer<typeof setUserActiveSchema>;
