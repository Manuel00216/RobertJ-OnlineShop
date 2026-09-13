import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/ErrorState";
import { ConnectedAccounts } from "@/features/account/components/ConnectedAccounts";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { mapOAuthCallbackError } from "@/features/auth";
import { listUserIdentities, requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Privacy & Settings" };

interface PrivacyPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Account security/connections hub — currently just Connected Accounts,
 * moved here from `/profile` (not duplicated) since it's a security concern,
 * not a profile field. Room to grow without turning Profile into a catch-all.
 */
export default async function PrivacyPage({ searchParams }: PrivacyPageProps) {
  const params = await searchParams;
  await requireSessionUser();
  const identities = await listUserIdentities();

  const errorParam = typeof params.error === "string" ? params.error : null;
  const linkError = mapOAuthCallbackError(errorParam);

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="My Account"
        title="Privacy & Settings"
        description="Manage how you sign in to your account."
      />
      <div className="flex max-w-xl flex-col gap-8">
        {linkError ? (
          <ErrorState title="Couldn't connect that account" message={linkError} />
        ) : null}
        <ConnectedAccounts identities={identities} />
      </div>
    </div>
  );
}
