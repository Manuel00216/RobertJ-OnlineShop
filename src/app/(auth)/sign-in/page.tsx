import type { Metadata } from "next";

import { AuthLayout } from "@/features/auth/components/layout/AuthLayout";
import { LoginForm } from "@/features/auth/components/forms/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
