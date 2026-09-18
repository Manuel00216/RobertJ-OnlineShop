"use client";

import Link from "next/link";
import { useActionState, useId, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ROUTES } from "@/constants/routes";
import { AvatarUploader } from "@/features/account/components/AvatarUploader";
import { updateProfileAction } from "@/features/account/actions/account.actions";
import type { Profile } from "@/features/account/types/account.types";
import type { ActionResult } from "@/types/action.types";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;

const FIELD_CLASS =
  "h-9 w-full max-w-sm rounded-md border border-rj-gray-200 bg-rj-white px-3 text-sm text-rj-black outline-none transition-colors placeholder:text-rj-gray-400 focus-visible:border-rj-black focus-visible:ring-2 focus-visible:ring-rj-red/30";
const DISABLED_FIELD_CLASS =
  "h-9 w-full max-w-sm rounded-md border border-rj-gray-100 bg-rj-gray-50 px-3 text-sm text-rj-gray-500";

/** One compact label|field row — Shopee's alignment (fixed label column, field to its right), not the app's usual stacked `FormField`. */
function ProfileRow({
  label,
  htmlFor,
  children,
  hint,
  error,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-6">
      <label
        htmlFor={htmlFor}
        className="pt-2 text-sm text-rj-gray-600 sm:w-28 sm:shrink-0"
      >
        {label}
      </label>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {children}
        {hint ? <p className="text-xs text-rj-gray-500">{hint}</p> : null}
        {error ? (
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * `/profile` edit form — a compact, Shopee-style label|field list (not the
 * app's usual stacked, sectioned dashboard form), matched to the reference
 * layout: fields on the left, avatar on the right behind a divider, one
 * "Save Changes" action. Wired to the same `updateProfileAction` and
 * `Profile` data flow as before; nothing about validation or persistence
 * changed beyond what's documented below, only the layout.
 *
 * Username is editable until the buyer's first change; once
 * `profile.usernameChangedAt` is set (server-stamped by the
 * `profiles_enforce_username_change_once` trigger — enforced there, not just
 * here), the field becomes permanently disabled. Its current value still
 * rides along via a hidden input while disabled, so saving other fields can
 * never accidentally submit an empty username.
 *
 * `bio` (no longer shown here — the reference has no field for it) rides
 * along the same way, via a hidden input pre-filled with its current value,
 * so saving this compact form can never silently blank out an existing bio.
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
  const ids = {
    username: useId(),
    fullName: useId(),
    email: useId(),
    phone: useId(),
    dateOfBirth: useId(),
  };

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const formError = state && !state.success && !state.fieldErrors ? state.error : undefined;
  const displayName = profile.fullName ?? email;
  const usernameLocked = Boolean(profile.usernameChangedAt);

  return (
    <div className="rounded-2xl border border-rj-gray-100 bg-rj-white p-6 sm:p-8">
      <div className="flex flex-col lg:flex-row lg:gap-10">
        <div className="min-w-0 flex-1">
          {formError ? (
            <div className="mb-5">
              <ErrorState title="Couldn't save your profile" message={formError} />
            </div>
          ) : null}
          {state?.success ? (
            <div
              role="status"
              aria-live="polite"
              className="mb-5 rounded-xl border border-rj-green/30 bg-rj-green/5 p-3 text-sm font-medium text-rj-green"
            >
              Your profile was updated.
            </div>
          ) : null}

          <form action={formAction} noValidate aria-busy={isPending} className="flex flex-col gap-5">
            <input type="hidden" name="bio" value={profile.bio ?? ""} />

            <ProfileRow
              label="Username"
              htmlFor={ids.username}
              error={fieldErrors?.username?.[0]}
              hint={
                usernameLocked
                  ? "Username can only be changed once."
                  : "You can change your username once — choose carefully."
              }
            >
              {usernameLocked ? (
                <>
                  <input type="hidden" name="username" value={profile.username ?? ""} />
                  <input
                    id={ids.username}
                    value={profile.username ?? ""}
                    disabled
                    readOnly
                    className={DISABLED_FIELD_CLASS}
                  />
                </>
              ) : (
                <input
                  id={ids.username}
                  name="username"
                  defaultValue={profile.username ?? ""}
                  placeholder="lowercase, numbers, underscores"
                  className={FIELD_CLASS}
                />
              )}
            </ProfileRow>

            <ProfileRow label="Name" htmlFor={ids.fullName} error={fieldErrors?.fullName?.[0]}>
              <input
                id={ids.fullName}
                name="fullName"
                defaultValue={profile.fullName ?? ""}
                placeholder="Your full name"
                className={FIELD_CLASS}
              />
            </ProfileRow>

            <ProfileRow label="Email">
              <input
                id={ids.email}
                type="email"
                value={email}
                readOnly
                disabled
                className={DISABLED_FIELD_CLASS}
              />
              <p className="text-xs text-rj-gray-500">
                Set at sign-up.{" "}
                <Link
                  href={ROUTES.forgotPassword}
                  className="font-semibold text-rj-red-dark hover:underline"
                >
                  Reset your password
                </Link>{" "}
                to change how you sign in.
              </p>
            </ProfileRow>

            <ProfileRow label="Phone Number" htmlFor={ids.phone} error={fieldErrors?.phone?.[0]}>
              <input
                id={ids.phone}
                name="phone"
                type="tel"
                defaultValue={profile.phone ?? ""}
                placeholder="+63 912 345 6789"
                className={FIELD_CLASS}
              />
            </ProfileRow>

            <ProfileRow label="Gender">
              <div className="flex items-center gap-5 pt-2" role="radiogroup" aria-label="Gender">
                {GENDER_OPTIONS.map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-1.5 text-sm text-rj-gray-700"
                  >
                    <input
                      type="radio"
                      name="gender"
                      value={value}
                      defaultChecked={profile.gender === value}
                      className="h-4 w-4 accent-rj-red"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </ProfileRow>

            <ProfileRow
              label="Date of Birth"
              htmlFor={ids.dateOfBirth}
              error={fieldErrors?.dateOfBirth?.[0]}
            >
              <input
                id={ids.dateOfBirth}
                name="dateOfBirth"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                defaultValue={profile.dateOfBirth ?? ""}
                className={FIELD_CLASS}
              />
            </ProfileRow>

            <div className="pt-2 sm:pl-[calc(7rem+1.5rem)]">
              <Button type="submit" variant="rj" size="rj" isLoading={isPending}>
                {isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>

        <div className="mt-8 flex justify-center border-t border-rj-gray-100 pt-8 lg:mt-0 lg:w-52 lg:shrink-0 lg:justify-start lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <AvatarUploader currentUrl={profile.avatarUrl} name={displayName} />
        </div>
      </div>
    </div>
  );
}
