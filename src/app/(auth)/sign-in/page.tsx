import type { Metadata } from "next";

import { AuthLayout } from "@/features/auth/components/layout/AuthLayout";
import { LoginForm } from "@/features/auth/components/forms/LoginForm";
import { AUTH_COPY } from "@/features/auth/constants/auth.constants";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthLayout
      editorial={{
        eyebrow: AUTH_COPY.signIn.eyebrow,
        title: (
          <>
            One Place.
            <br />
            <em className="not-italic text-rj-red">Every</em> Style.
          </>
        ),
        description: AUTH_COPY.signIn.supporting,
      }}
    >
      <LoginForm />
    </AuthLayout>
  );
}
