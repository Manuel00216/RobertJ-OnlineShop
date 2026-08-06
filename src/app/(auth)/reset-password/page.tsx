import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { ROUTES } from "@/constants/routes";
import { AuthButton } from "@/features/auth/components/AuthButton";
import { AuthSuccessState } from "@/features/auth/components/feedback/AuthSuccessState";
import { AuthLayout } from "@/features/auth/components/layout/AuthLayout";
import { ResetPasswordForm } from "@/features/auth/components/forms/ResetPasswordForm";
import { getSessionUser } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Reset password" };

/**
 * Reached only via the PKCE callback after a recovery-link click. Without an
 * active session the recovery link has expired or was never opened — show the
 * §6.B guard state instead of the form.
 */
export default async function ResetPasswordPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <AuthLayout>
        <AuthSuccessState
          icon={TriangleAlert}
          tone="danger"
          animate={false}
          headline="This Link Has Expired"
          body="Password reset links expire after 1 hour for your security. Request a new one below."
          action={
            <Link href={ROUTES.forgotPassword}>
              <AuthButton>Request New Link</AuthButton>
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
