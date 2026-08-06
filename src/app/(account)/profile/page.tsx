import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/ErrorState";
import { CatalogHeader } from "@/features/products/components/CatalogHeader";
import { ProfileForm } from "@/features/account/components/ProfileForm";
import { getMyProfile, requireSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireSessionUser();
  const profile = await getMyProfile();

  return (
    <div className="flex flex-col gap-8">
      <CatalogHeader
        eyebrow="My Account"
        title="Profile"
        description="Keep your account details up to date."
      />
      {profile ? (
        <div className="max-w-xl">
          <ProfileForm profile={profile} email={user.email} />
        </div>
      ) : (
        <ErrorState message="We couldn't load your profile. Try signing out and back in." />
      )}
    </div>
  );
}
