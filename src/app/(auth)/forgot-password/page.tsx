import type { Metadata } from "next";

import { AuthLayout } from "@/features/auth/components/layout/AuthLayout";
import { ForgotPasswordForm } from "@/features/auth/components/forms/ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
