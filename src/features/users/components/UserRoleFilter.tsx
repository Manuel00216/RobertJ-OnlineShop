"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/constants/roles";

const CHIP_ACTIVE =
  "rounded-full border-[1.5px] border-rj-black bg-rj-black px-4 py-1.5 text-[11px] font-bold text-rj-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30";
const CHIP_IDLE =
  "rounded-full border-[1.5px] border-rj-gray-200 bg-transparent px-4 py-1.5 text-[11px] font-bold text-rj-gray-600 transition-all hover:border-rj-black hover:text-rj-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30";

/** All/Buyers/Sellers chips for the admin Users list — mirrors `OrderStatusFilter`'s shape. Admin accounts are never buyer/seller-promotable, so they're excluded from this filter entirely (still visible under "All"). */
const FILTERABLE_ROLES: readonly UserRole[] = [USER_ROLES.buyer, USER_ROLES.seller];

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
      {FILTERABLE_ROLES.map((role) => (
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
