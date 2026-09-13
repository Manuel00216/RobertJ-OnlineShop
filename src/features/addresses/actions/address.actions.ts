"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { addressSchema } from "@/features/addresses/schemas/address.schema";
import type { Address } from "@/features/addresses/types/address.types";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";

/**
 * Every address mutation shares one rate-limit bucket per buyer — this is
 * account-management, not a checkout-critical path, so a single generous
 * limit across create/update/delete/set-default is enough to deter abuse
 * without needing per-action tuning.
 */
async function guardAddressMutation() {
  const user = await queries.requireSessionUser();
  await queries.requireRateLimit(`address:${user.id}`, 20, 60);
  return user;
}

export async function createAddressAction(
  input: unknown,
): Promise<ActionResult<Address>> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await guardAddressMutation();
    const address = await queries.createAddress(user.id, parsed.data);
    revalidatePath(ROUTES.addresses);
    revalidatePath(ROUTES.checkout);
    return ok(address);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not save address.",
    );
  }
}

export async function updateAddressAction(
  addressId: string,
  input: unknown,
): Promise<ActionResult<Address>> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await guardAddressMutation();
    const address = await queries.updateAddress(user.id, addressId, parsed.data);
    revalidatePath(ROUTES.addresses);
    revalidatePath(ROUTES.checkout);
    return ok(address);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update address.",
    );
  }
}

export async function deleteAddressAction(
  addressId: string,
): Promise<ActionResult<null>> {
  try {
    const user = await guardAddressMutation();
    await queries.deleteAddress(user.id, addressId);
    revalidatePath(ROUTES.addresses);
    revalidatePath(ROUTES.checkout);
    return ok(null);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not delete address.",
    );
  }
}

export async function setDefaultAddressAction(
  addressId: string,
): Promise<ActionResult<Address>> {
  try {
    const user = await guardAddressMutation();
    const address = await queries.setDefaultAddress(user.id, addressId);
    revalidatePath(ROUTES.addresses);
    revalidatePath(ROUTES.checkout);
    return ok(address);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not set default address.",
    );
  }
}
