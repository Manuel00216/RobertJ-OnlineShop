"use client";

import { useEffect, useState } from "react";

import { signInWithOAuthAction } from "@/features/auth/actions/auth.actions";

import { FacebookIcon, GoogleIcon } from "./icons";
import { SocialButton } from "./SocialButton";

/**
 * Google/Facebook sign-in. Each provider is its own `<form>` posting to
 * `signInWithOAuthAction` (see that action for why this isn't
 * `useActionState`-driven). `redirectTo` is read from `window.location.search`
 * in an effect, mirroring `LoginForm`'s pattern, so this stays SSR-friendly
 * (no `useSearchParams`/Suspense).
 *
 * Google auto-links to a matching existing account (its email is always
 * provider-verified). Facebook only auto-links when Facebook itself confirms
 * the email — see the caption below and `/profile`'s Connected Accounts
 * panel, which is the safe fallback when it can't.
 */
export function SocialLoginButtons() {
  const [redirectTo, setRedirectTo] = useState("");

  useEffect(() => {
    // Reads a browser-only value (window.location.search) after mount so the
    // server-rendered and first client-hydration passes match; there is no
    // way to compute this during render without risking a hydration
    // mismatch, which is what this effect exists to avoid.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRedirectTo(new URLSearchParams(window.location.search).get("redirectTo") ?? "");
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <form action={signInWithOAuthAction}>
        <input type="hidden" name="provider" value="google" />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <SocialButton icon={<GoogleIcon />} label="Continue with Google" />
      </form>
      <div className="flex flex-col gap-1.5">
        <form action={signInWithOAuthAction}>
          <input type="hidden" name="provider" value="facebook" />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <SocialButton icon={<FacebookIcon />} label="Continue with Facebook" />
        </form>
        <p className="text-center text-xs text-rj-gray-600">
          Works best if your Facebook account has a confirmed email.
        </p>
      </div>
    </div>
  );
}
