import type { Metadata } from "next";

import { AuthLayout } from "@/features/auth/components/layout/AuthLayout";
import { RegisterForm } from "@/features/auth/components/forms/RegisterForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
