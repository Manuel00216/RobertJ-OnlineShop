import Link from "next/link";
import { Bell, Heart, MapPin, UserRound } from "lucide-react";

import { RJ_CARD } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";

const QUICK_LINKS = [
  {
    href: ROUTES.profile,
    label: "Profile",
    description: "Update your details",
    icon: UserRound,
  },
  {
    href: ROUTES.addresses,
    label: "Addresses",
    description: "Manage delivery addresses",
    icon: MapPin,
  },
  {
    href: ROUTES.wishlist,
    label: "Wishlist",
    description: "Products you've saved",
    icon: Heart,
  },
  {
    href: ROUTES.notifications,
    label: "Notifications",
    description: "Order & payment updates",
    icon: Bell,
  },
] as const;

/** Overview's quick-access cards to the rest of the account area. */
export function AccountQuickLinks() {
  return (
    <section aria-label="Quick links" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {QUICK_LINKS.map(({ href, label, description, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            RJ_CARD,
            "flex items-center gap-3 p-4 transition-all hover:border-rj-black hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30",
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rj-gray-100">
            <Icon className="h-4 w-4 text-rj-black" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-rj-black">{label}</span>
            <span className="block truncate text-xs text-rj-gray-600">{description}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}
