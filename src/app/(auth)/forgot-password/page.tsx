import type { Metadata } from "next";

import { AuthLayout } from "@/features/auth/components/layout/AuthLayout";
import { ForgotPasswordForm } from "@/features/auth/components/forms/ForgotPasswordForm";
import { AUTH_COPY } from "@/features/auth/constants/auth.constants";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      editorial={{
        eyebrow: AUTH_COPY.forgotPassword.eyebrow,
        title: (
          <>
            Forgot Your
            <br />
            Password?
          </>
        ),
        description: AUTH_COPY.forgotPassword.supporting,
      }}
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
