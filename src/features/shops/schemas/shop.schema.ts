import { z } from "zod";

/** Payload for creating a shop. `slug` is always server-derived from `name` (see `queries.createShop`). */
export const createShopSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
});

/** Payload for editing a shop's name. */
export const updateShopSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "Name is required.").max(80),
});

/** Payload for toggling a shop's active status — a plain-argument action, not a form (see `toggleShopActiveAction`). */
export const toggleShopActiveSchema = z.object({
  shopId: z.uuid(),
  active: z.boolean(),
});

export type CreateShopInput = z.infer<typeof createShopSchema>;
export type UpdateShopInput = z.infer<typeof updateShopSchema>;
export type ToggleShopActiveInput = z.infer<typeof toggleShopActiveSchema>;
