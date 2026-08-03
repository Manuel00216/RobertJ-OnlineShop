import type { Metadata } from "next";

import { AuthLayout } from "@/features/auth/components/layout/AuthLayout";
import { RegisterForm } from "@/features/auth/components/forms/RegisterForm";
import { AUTH_COPY } from "@/features/auth/constants/auth.constants";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthLayout
      editorial={{
        eyebrow: AUTH_COPY.signUp.eyebrow,
        title: (
          <>
            Every Shop.
            <br />
            One Account.
          </>
        ),
        description: AUTH_COPY.signUp.supporting,
      }}
    >
      <RegisterForm />
    </AuthLayout>
  );
}
