import { supabase } from "@/integrations/supabase/client";
import type { UserRole } from "@/types/user";

export interface ActiveUser {
  id: string;
  name: string | null;
  email: string | null;
  is_active: boolean;
  depot_id: string | null;
  annual_leave_days: number;
  leave_year_start: string;
}

/**
 * Single source of truth for "people pickers". Returns users holding a role
 * (via user_roles or the legacy profiles.role column). Inactive accounts are
 * hidden unless includeInactive is set — use that only for history filters.
 */
export async function getActiveUsers(
  role: UserRole | UserRole[],
  opts: { includeInactive?: boolean } = {},
): Promise<ActiveUser[]> {
  const roles = Array.isArray(role) ? role : [role];
  const [rolesRes, legacyRes] = await Promise.all([
    supabase.from("user_roles").select("user_id").in("role", roles as any),
    supabase.from("profiles").select("id").in("role", roles as any),
  ]);
  if (rolesRes.error) throw rolesRes.error;
  if (legacyRes.error) throw legacyRes.error;

  const ids = Array.from(new Set([
    ...(rolesRes.data || []).map((r: any) => r.user_id as string),
    ...(legacyRes.data || []).map((p: any) => p.id as string),
  ].filter(Boolean)));
  if (!ids.length) return [];

  const out: ActiveUser[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await (supabase as any)
      .from("profiles")
      .select("id, name, email, is_active, depot_id, annual_leave_days, leave_year_start")
      .in("id", ids.slice(i, i + 200));
    if (error) throw error;
    for (const p of data || []) {
      const active = p.is_active !== false;
      if (!active && !opts.includeInactive) continue;
      out.push({
        id: p.id, name: p.name, email: p.email, is_active: active,
        depot_id: p.depot_id ?? null,
        annual_leave_days: Number(p.annual_leave_days ?? 28),
        leave_year_start: p.leave_year_start || "01-01",
      });
    }
  }
  return out.sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""));
}

export const displayName = (u: { name?: string | null; email?: string | null; is_active?: boolean }) =>
  `${u.name || u.email || "Unknown"}${u.is_active === false ? " (inactive)" : ""}`;
