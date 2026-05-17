import type { UserRole } from "@/types/user";

/**
 * Returns the list of roles assigned to a user profile.
 * Prefers the `roles` array (from public.user_roles), falling back to the
 * legacy single `role` column on profiles for back-compat.
 */
export const getRoles = (profile: any | null | undefined): UserRole[] => {
  if (!profile) return [];
  if (Array.isArray(profile.roles) && profile.roles.length) return profile.roles as UserRole[];
  return profile.role ? [profile.role as UserRole] : [];
};

export const hasRole = (profile: any | null | undefined, role: UserRole): boolean =>
  getRoles(profile).includes(role);

export const hasAnyRole = (profile: any | null | undefined, roles: UserRole[]): boolean => {
  const owned = getRoles(profile);
  return roles.some((r) => owned.includes(r));
};

export const ALL_ROLES: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "route_planner", label: "Route Planner" },
  { value: "loader", label: "Loader" },
  { value: "mechanic", label: "Mechanic" },
  { value: "sales", label: "Sales" },
  { value: "driver", label: "Driver" },
  { value: "b2b_customer", label: "B2B Customer" },
  { value: "b2c_customer", label: "B2C Customer" },
];
