"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import { FormField } from "@/components/forms/FormField";
import { ROUTES } from "@/constants/routes";
import { updateProfileAction } from "@/features/account/actions/account.actions";
import type { Profile } from "@/features/account/types/account.types";
import type { ActionResult } from "@/types/action.types";

/**
 * `/profile` edit form. Wired to `updateProfileAction` via `useActionState`;
 * on success the action revalidates and this shows an inline banner (no
 * navigation). Email is read-only — it lives in `auth.users`, surfaced via the
 * session, and there is no direct grant to edit it.
 */
export function ProfileForm({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  const [state, formAction, isPending] = useActionState<
    ActionResult<Profile> | null,
    FormData
  >(updateProfileAction, null);

  const fieldErrors =
    state && !state.success ? state.fieldErrors : undefined;
  const formError =
    state && !state.success && !state.fieldErrors ? state.error : undefined;

  return (
    <form
      action={formAction}
      noValidate
      aria-busy={isPending}
      className="flex flex-col gap-5"
    >
      {formError ? (
        <ErrorState title="Couldn't save your profile" message={formError} />
      ) : null}
      {state?.success ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-rj-green/30 bg-rj-green/5 p-4 text-sm font-medium text-rj-green"
        >
          Your profile was updated.
        </div>
      ) : null}

      <FormField
        name="fullName"
        label="Full name"
        tone="brand"
        defaultValue={profile.fullName ?? ""}
        placeholder="Your full name"
        errors={fieldErrors?.fullName}
      />
      <FormField
        name="username"
        label="Username"
        tone="brand"
        defaultValue={profile.username ?? ""}
        placeholder="3–30 characters: lowercase, numbers, underscores"
        hint="Your public profile handle."
        errors={fieldErrors?.username}
      />
      <FormField
        name="phone"
        label="Phone"
        type="tel"
        tone="brand"
        defaultValue={profile.phone ?? ""}
        placeholder="+63 912 345 6789"
        errors={fieldErrors?.phone}
      />
      <FormField
        name="avatarUrl"
        label="Avatar URL"
        type="url"
        tone="brand"
        defaultValue={profile.avatarUrl ?? ""}
        placeholder="https://…"
        hint="A hosted image link — uploads aren't available yet."
        errors={fieldErrors?.avatarUrl}
      />
      <FormField
        name="bio"
        label="Bio"
        tone="brand"
        defaultValue={profile.bio ?? ""}
        placeholder="Tell buyers a little about yourself…"
        errors={fieldErrors?.bio}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="profile-email"
          type="email"
          value={email}
          readOnly
          disabled
          className="h-10 rounded-md border border-rj-gray-100 bg-rj-gray-50 px-3 text-sm text-rj-gray-600"
        />
        <p className="text-xs text-rj-gray-600">
          Your email is set at sign-up and can&apos;t be changed here. Reset your
          password through the{" "}
          <Link
            href={ROUTES.forgotPassword}
            className="font-semibold text-rj-red-dark hover:underline"
          >
            forgot password
          </Link>{" "}
          flow.
        </p>
      </div>

      <Button
        type="submit"
        variant="rj"
        size="rj"
        isLoading={isPending}
        className="w-full sm:w-auto"
      >
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
