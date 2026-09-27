"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  FILTER_CHIP_ACTIVE_THEMED as CHIP_ACTIVE,
  FILTER_CHIP_IDLE_THEMED as CHIP_IDLE,
} from "@/components/ui/filter-chip";
import { ROLE_LABELS } from "@/constants/roles";
import { FILTERABLE_USER_ROLES } from "@/features/users/constants/user.constants";

/** All/Buyers/Sellers/Administrators chips for the admin Users list — mirrors `OrderStatusFilter`'s shape. */
export function UserRoleFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeRole = searchParams.get("role") ?? "";

  function updateParams(role: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (role) {
      params.set("role", role);
    } else {
      params.delete("role");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter users by role">
      <button
        type="button"
        aria-pressed={!activeRole}
        className={!activeRole ? CHIP_ACTIVE : CHIP_IDLE}
        onClick={() => updateParams(null)}
      >
        All
      </button>
      {FILTERABLE_USER_ROLES.map((role) => (
        <button
          key={role}
          type="button"
          aria-pressed={activeRole === role}
          className={activeRole === role ? CHIP_ACTIVE : CHIP_IDLE}
          onClick={() => updateParams(role)}
        >
          {ROLE_LABELS[role]}s
        </button>
      ))}
    </div>
  );
}
