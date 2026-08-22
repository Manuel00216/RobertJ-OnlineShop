import { z } from "zod";

/** Payload for promoting a buyer to seller and/or (re)assigning their shop. */
export const assignSellerShopSchema = z.object({
  userId: z.uuid(),
  shopId: z.uuid(),
});

export type AssignSellerShopInput = z.infer<typeof assignSellerShopSchema>;

/** Payload for activating/deactivating a buyer or seller account. */
export const setUserActiveSchema = z.object({
  userId: z.uuid(),
  isActive: z.boolean(),
});

export type SetUserActiveInput = z.infer<typeof setUserActiveSchema>;
