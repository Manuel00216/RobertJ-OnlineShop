import type { ReactNode } from "react";

import type { UserIdentity } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { FacebookIcon, GoogleIcon, type OAuthProvider } from "@/features/auth";
import { linkIdentityAction } from "@/features/account/actions/account.actions";
import { UnlinkIdentityButton } from "@/features/account/components/UnlinkIdentityButton";

const PROVIDER_META: Record<
  OAuthProvider,
  { label: string; icon: ReactNode; autoLinkNote: string }
> = {
  google: {
    label: "Google",
    icon: <GoogleIcon />,
    autoLinkNote: "Signing in with Google automatically connects here when your Google email is verified — which Google always is.",
  },
  facebook: {
    label: "Facebook",
    icon: <FacebookIcon />,
    autoLinkNote:
      "Signing in with Facebook only connects here automatically if Facebook confirms your email. If it can't, Facebook sign-in creates a separate account instead of joining this one — use “Connect” below (while signed in here) to link it safely.",
  },
};

/**
 * `/profile` — lets a signed-in user see which methods reach this account
 * and manually connect Google/Facebook when automatic linking couldn't
 * (Supabase only auto-links a provider whose email it can verify; see
 * `queries.linkOAuthIdentity`). Never implies two accounts were merged
 * automatically when they weren't — connecting here only changes what
 * happens on *future* sign-ins, it does not move past orders from an
 * already-separate account.
 */
export function ConnectedAccounts({ identities }: { identities: UserIdentity[] }) {
  const hasPassword = identities.some((identity) => identity.provider === "email");
  const canDisconnect = identities.length > 1;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-rj-gray-200 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-rj-black">Connected accounts</h2>
        <p className="text-sm text-rj-gray-600">
          Email/password, Google, and Facebook can all sign you into this one account. Connecting
          here only affects future sign-ins — it never moves past orders from a separate account.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-rj-gray-100 p-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Email &amp; password</span>
        </div>
        <span className="text-xs font-medium text-rj-gray-600">
          {hasPassword ? "Connected" : "Not set up"}
        </span>
      </div>

      {(Object.keys(PROVIDER_META) as OAuthProvider[]).map((provider) => {
        const identity = identities.find((i) => i.provider === provider);
        const meta = PROVIDER_META[provider];

        return (
          <div key={provider} className="flex flex-col gap-1.5 rounded-xl border border-rj-gray-100 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {meta.icon}
                <span className="text-sm font-medium">{meta.label}</span>
              </div>
              {identity ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-rj-green">Connected</span>
                  <UnlinkIdentityButton
                    identityId={identity.identity_id}
                    disabled={!canDisconnect}
                    disabledReason="You need at least one other way to sign in before disconnecting this one."
                  />
                </div>
              ) : (
                <form action={linkIdentityAction}>
                  <input type="hidden" name="provider" value={provider} />
                  <Button type="submit" variant="outline" size="sm">
                    Connect
                  </Button>
                </form>
              )}
            </div>
            <p className="text-xs text-rj-gray-600">{meta.autoLinkNote}</p>
          </div>
        );
      })}
    </section>
  );
}
