"use client";

import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import { toggleWishlistAction } from "@/features/wishlist/actions/wishlist.actions";

export interface WishlistButtonProps {
  productId: string;
  initialSaved: boolean;
  /** Guests see the same heart everywhere; clicking it prompts sign-in
   * instead of silently failing or being hidden. */
  isAuthenticated: boolean;
  /** `tile`: small circular corner button for ProductTile/cards.
   * `pdp`: full-size bordered square button, matches the Add to Cart row. */
  variant?: "tile" | "pdp";
  className?: string;
}

/**
 * Saves/removes one product from the signed-in user's wishlist. Optimistic:
 * flips the heart immediately, reverts on failure. A guest is redirected to
 * sign-in with `redirectTo` pointing back at the current page — never a
 * silent no-op — per ADR-018's "guests see the action, saving requires an
 * account" decision.
 */
export function WishlistButton({
  productId,
  initialSaved,
  isAuthenticated,
  variant = "tile",
  className,
}: WishlistButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  function handleClick(event: React.MouseEvent) {
    // ProductTile wraps the whole card in a link — the corner button must
    // never trigger that navigation.
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      const redirectTo = encodeURIComponent(pathname || ROUTES.wishlist);
      router.push(`${ROUTES.signIn}?redirectTo=${redirectTo}`);
      return;
    }

    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      const result = await toggleWishlistAction(productId, next);
      if (!result.success) {
        setSaved(!next);
      }
    });
  }

  const label = saved ? "Remove from wishlist" : "Save to wishlist";

  if (variant === "pdp") {
    return (
      <Button
        type="button"
        variant="rjOutline"
        size="icon"
        aria-pressed={saved}
        aria-label={label}
        title={label}
        disabled={isPending}
        onClick={handleClick}
        className={cn(saved && "border-rj-red text-rj-red", className)}
      >
        <Heart
          className="h-5 w-5"
          fill={saved ? "currentColor" : "none"}
          aria-hidden="true"
        />
      </Button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      title={label}
      disabled={isPending}
      onClick={handleClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full bg-rj-white/90 shadow transition-colors hover:bg-rj-white disabled:opacity-60",
        className,
      )}
    >
      <Heart
        className={cn("h-3.5 w-3.5", saved ? "text-rj-red" : "text-rj-gray-400")}
        fill={saved ? "currentColor" : "none"}
        aria-hidden="true"
      />
    </button>
  );
}
