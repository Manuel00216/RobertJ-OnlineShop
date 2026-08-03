import Link from "next/link";

import { AccountMenu } from "@/features/account/components/AccountMenu";
import { Button } from "@/components/ui/button";
import { CartIndicator } from "@/components/navigation/CartIndicator";
import { MainNav } from "@/components/navigation/MainNav";
import { ROUTES } from "@/constants/routes";
import { siteConfig } from "@/config/site";
import { getSessionUser } from "@/lib/supabase/queries";

/** Server Component: reads the session directly, no client fetch needed. */
export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href={ROUTES.home} className="text-sm font-semibold">
            {siteConfig.name}
          </Link>
          <MainNav />
        </div>

        <div className="flex items-center gap-2">
          <CartIndicator />
          {user ? (
            <AccountMenu user={user} />
          ) : (
            <Link href={ROUTES.signIn}>
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
