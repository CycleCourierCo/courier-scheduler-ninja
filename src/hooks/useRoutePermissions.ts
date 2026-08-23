import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { APP_ROUTES, DEFAULT_PERMISSION_MATRIX, findRouteForPath, type AppRoute } from "@/config/routes";
import type { UserRole } from "@/types/user";

export interface RoutePermissionRow {
  role: UserRole;
  route_key: string;
  allowed: boolean;
}

export const routePermissionsQueryKey = ["role-route-permissions"];

export const fetchRoutePermissions = async (): Promise<RoutePermissionRow[]> => {
  const { data, error } = await supabase
    .from("role_route_permissions")
    .select("role, route_key, allowed");
  if (error) throw error;
  return (data ?? []) as RoutePermissionRow[];
};

/** Build key -> allowed roles map, falling back to registry defaults when unset */
export const buildMatrix = (rows: RoutePermissionRow[] | undefined): Record<string, Set<string>> => {
  const defaults = DEFAULT_PERMISSION_MATRIX();
  const matrix: Record<string, Set<string>> = {};

  const overridden = new Set<string>();
  for (const row of rows ?? []) overridden.add(`${row.route_key}`);

  for (const [key, roles] of Object.entries(defaults)) {
    matrix[key] = overridden.has(key) ? new Set<string>() : new Set(roles);
  }

  for (const row of rows ?? []) {
    if (!matrix[row.route_key]) matrix[row.route_key] = new Set<string>();
    if (row.allowed) matrix[row.route_key].add(row.role);
    else matrix[row.route_key].delete(row.role);
  }

  return matrix;
};

export const useRoutePermissions = (roles: UserRole[]) => {
  const { data, isLoading } = useQuery({
    queryKey: routePermissionsQueryKey,
    queryFn: fetchRoutePermissions,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const matrix = useMemo(() => buildMatrix(data), [data]);

  const isAllowedKey = (key: string) => {
    const allowed = matrix[key];
    if (!allowed) return false;
    return roles.some(r => allowed.has(r));
  };

  const canAccess = (pathname: string) => {
    const route = findRouteForPath(pathname);
    if (!route) return false;
    return isAllowedKey(route.key);
  };

  const allowedPages: AppRoute[] = useMemo(
    () => APP_ROUTES.filter(r => !r.hiddenInMenu && roles.some(role => matrix[r.key]?.has(role))),
    [matrix, roles]
  );

  return { matrix, isLoading, canAccess, isAllowedKey, allowedPages, rows: data };
};
