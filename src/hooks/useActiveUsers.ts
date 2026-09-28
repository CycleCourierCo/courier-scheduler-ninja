import { useQuery } from "@tanstack/react-query";
import { getActiveUsers } from "@/services/activeUsersService";
import type { UserRole } from "@/types/user";

export const useActiveUsers = (
  role: UserRole | UserRole[],
  opts: { includeInactive?: boolean; enabled?: boolean } = {},
) => {
  const roles = Array.isArray(role) ? role : [role];
  return useQuery({
    queryKey: ["active-users", [...roles].sort().join(","), !!opts.includeInactive],
    queryFn: () => getActiveUsers(roles, { includeInactive: opts.includeInactive }),
    staleTime: 5 * 60 * 1000,
    enabled: opts.enabled ?? true,
  });
};
