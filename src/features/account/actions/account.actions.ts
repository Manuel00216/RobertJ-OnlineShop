"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { fail, fromZodError, ok } from "@/lib/utils/result";
import * as queries from "@/lib/supabase/queries";
import type { ActionResult } from "@/types/action.types";
import { updateProfileSchema } from "@/features/account/schemas/account.schema";
import type { Profile } from "@/features/account/types/account.types";

/** Updates the signed-in user's own profile row. RLS restricts the write to own row. */
export async function updateProfileAction(
  _prevState: ActionResult<Profile> | null,
  formData: FormData,
): Promise<ActionResult<Profile>> {
  const parsed = updateProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    const user = await queries.requireSessionUser();
    await queries.requireRateLimit(`updateProfile:${user.id}`, 5, 60);
    const profile = await queries.updateMyProfile(user.id, parsed.data);
    // Re-render the profile page and the shared header/identity surfaces.
    revalidatePath(ROUTES.profile, "layout");
    revalidatePath("/", "layout");
    return ok(profile);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update your profile.",
    );
  }
}
