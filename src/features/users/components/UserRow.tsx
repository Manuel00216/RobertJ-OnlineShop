"use client";

import { useRef, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmPanel } from "@/components/ui/confirm-panel";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/constants/roles";
import { assignSellerShopAction, setUserActiveAction } from "@/features/users/actions/user.actions";
import type { AdminUser } from "@/features/users/types/user.types";
import type { Shop } from "@/features/shops/types/shop.types";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";
import { getInitials } from "@/lib/utils/format";

const ROLE_TONE: Record<UserRole, "neutral" | "info" | "success"> = {
  buyer: "neutral",
  seller: "info",
  admin: "success",
};

export interface UserRowProps {
  user: AdminUser;
  /** Active shops for the assign dropdown — only admins fetch this, matching the Products/Inventory admin shop-picker precedent. */
  shops: Shop[];
}

/**
 * One user in the admin management list. Buyer/seller rows get an "Assign
 * shop" control — pick a shop, then an explicit confirm step (the shop
 * dropdown alone doesn't submit anything) — that promotes-and-assigns or
 * reassigns via one atomic action, mirroring `CancelOrderButton`'s
 * confirm-panel shape.
 */
export function UserRow({ user, shops }: UserRowProps) {
  const [assigning, setAssigning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [confirmingActiveChange, setConfirmingActiveChange] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [isActivePending, startActiveTransition] = useTransition();
  const activeTriggerRef = useRef<HTMLButtonElement>(null);

  // A deactivated admin account is a lockout risk the RPC itself refuses
  // (admin_set_user_active rejects any role='admin' target) — hide the
  // control entirely rather than show one that will always fail.
  const canDeactivate = user.role !== USER_ROLES.admin;
  const canAssignShop = user.role !== USER_ROLES.admin;
  const actionLabel = user.role === USER_ROLES.buyer ? "Promote to Seller" : "Reassign shop";
  const selectedShop = shops.find((shop) => shop.id === selectedShopId);

  function handleConfirm() {
    if (!selectedShopId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignSellerShopAction(user.id, selectedShopId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      setAssigning(false);
      setSelectedShopId("");
    });
  }

  function handleConfirmActiveChange() {
    setActiveError(null);
    startActiveTransition(async () => {
      const result = await setUserActiveAction(user.id, !user.isActive);
      if (!result.success) {
        setActiveError(result.error);
        return;
      }
      setConfirmingActiveChange(false);
    });
  }

  return (
    <Card className="border-rj-gray-100">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rj-gray-100 text-xs font-bold text-rj-black">
              {getInitials(user.fullName ?? user.email ?? "?")}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-rj-black">
                  {user.fullName ?? user.username ?? "Unnamed user"}
                </p>
                <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABELS[user.role]}</Badge>
                {user.isActive ? null : <Badge tone="danger">Inactive</Badge>}
              </div>
              <p className="mt-0.5 truncate text-xs text-rj-gray-600">
                {user.email ?? "No email"} · {user.shopName ?? "Unassigned"} · Joined{" "}
                {formatDate(user.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canAssignShop ? (
              assigning ? (
                <Button type="button" variant="outline" size="rjSm" onClick={() => setAssigning(false)}>
                  Cancel
                </Button>
              ) : (
                <Button type="button" variant="rj" size="rjSm" onClick={() => setAssigning(true)}>
                  {actionLabel}
                </Button>
              )
            ) : null}

            {canDeactivate && !confirmingActiveChange ? (
              <button
                type="button"
                ref={activeTriggerRef}
                className={cn(
                  buttonVariants({ variant: user.isActive ? "danger" : "outline", size: "rjSm" }),
                )}
                onClick={() => setConfirmingActiveChange(true)}
              >
                {user.isActive ? "Deactivate" : "Reactivate"}
              </button>
            ) : null}
          </div>
        </div>

        {error ? <ErrorState title="Couldn't assign the shop" message={error} /> : null}

        {assigning ? (
          <div className="rounded-2xl border border-rj-gray-100 bg-rj-gray-50 p-4">
            <label htmlFor={`shop-select-${user.id}`} className="text-sm font-medium">
              Shop
            </label>
            <select
              id={`shop-select-${user.id}`}
              value={selectedShopId}
              onChange={(event) => {
                setSelectedShopId(event.target.value);
                setConfirming(false);
              }}
              className="mt-1.5 h-10 w-full max-w-xs rounded-md border border-rj-gray-200 bg-rj-white px-3 text-sm text-rj-black outline-none transition-colors focus-visible:border-rj-black focus-visible:ring-2 focus-visible:ring-rj-red/30"
            >
              <option value="">Select a shop…</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>

            {selectedShopId && !confirming ? (
              <Button
                type="button"
                variant="rj"
                size="rjSm"
                className="mt-3"
                onClick={() => setConfirming(true)}
              >
                {actionLabel}
              </Button>
            ) : null}

            {confirming ? (
              <div className="mt-3">
                <ConfirmPanel
                  label={
                    user.role === USER_ROLES.buyer
                      ? `Promote ${user.fullName ?? user.email} to Seller`
                      : `Move ${user.fullName ?? user.email} to ${selectedShop?.name}`
                  }
                  title={
                    user.role === USER_ROLES.buyer
                      ? `Promote ${user.fullName ?? user.email} to Seller and assign them to ${selectedShop?.name}?`
                      : `Move ${user.fullName ?? user.email} to ${selectedShop?.name}?`
                  }
                  description={
                    user.role === USER_ROLES.buyer
                      ? "They'll gain seller dashboard access, scoped to this shop only."
                      : "Their previous shop membership will be removed."
                  }
                  tone="neutral"
                  confirmLabel="Confirm"
                  pendingLabel="Saving…"
                  cancelLabel="Back"
                  isPending={isPending}
                  onConfirm={handleConfirm}
                  onCancel={() => setConfirming(false)}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {activeError ? (
          <ErrorState title="Couldn't update this account's status" message={activeError} />
        ) : null}

        {confirmingActiveChange ? (
          <ConfirmPanel
            label={
              user.isActive
                ? `Deactivate ${user.fullName ?? user.email}`
                : `Reactivate ${user.fullName ?? user.email}`
            }
            title={
              user.isActive
                ? `Deactivate ${user.fullName ?? user.email}?`
                : `Reactivate ${user.fullName ?? user.email}?`
            }
            description={
              user.isActive
                ? "They'll be signed out and unable to sign in, place orders, or manage their shop. Their order history, products, and shop data are kept — nothing is deleted."
                : "They'll be able to sign in and perform actions again."
            }
            tone={user.isActive ? "danger" : "neutral"}
            confirmLabel={user.isActive ? "Deactivate" : "Reactivate"}
            pendingLabel="Saving…"
            isPending={isActivePending}
            triggerRef={activeTriggerRef}
            onConfirm={handleConfirmActiveChange}
            onCancel={() => setConfirmingActiveChange(false)}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
