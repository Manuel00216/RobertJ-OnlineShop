import Link from "next/link";
import type { Metadata } from "next";

import { buttonVariants } from "@/components/ui/button";
import { RJ_CARD } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ROUTES } from "@/constants/routes";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { ConnectedAccounts } from "@/features/account/components/ConnectedAccounts";
import { ProfileForm } from "@/features/account/components/ProfileForm";
import { mapOAuthCallbackError } from "@/features/auth";
import { cn } from "@/lib/utils/cn";
import { getMyProfile, listUserIdentities, requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Profile" };

interface ProfilePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const user = await requireSessionUser();
  const [profile, identities] = await Promise.all([getMyProfile(), listUserIdentities()]);

  const errorParam = typeof params.error === "string" ? params.error : null;
  const linkError = mapOAuthCallbackError(errorParam);

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="My Account"
        title="Profile"
        description="Keep your account details up to date."
      />
      {profile ? (
        <div className="flex max-w-xl flex-col gap-8">
          <ProfileForm profile={profile} email={user.email} />
          {linkError ? <ErrorState title="Couldn't connect that account" message={linkError} /> : null}
          <div className={cn(RJ_CARD, "flex flex-wrap items-center justify-between gap-3 p-5")}>
            <div>
              <p className="text-sm font-semibold text-rj-black">Addresses</p>
              <p className="mt-0.5 text-xs text-rj-gray-600">
                Manage the delivery addresses saved to your account.
              </p>
            </div>
            <Link
              href={ROUTES.addresses}
              className={cn(buttonVariants({ variant: "rjOutline", size: "rjSm" }))}
            >
              Manage addresses
            </Link>
          </div>
          <ConnectedAccounts identities={identities} />
        </div>
      ) : (
        <ErrorState message="We couldn't load your profile. Try signing out and back in." />
      )}
    </div>
  );
}
