import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/** Explicit staff roles; new roles get no business-action access until added. */
export const STAFF_ROLES = [
  'admin', 'loader', 'route_planner', 'sales', 'driver', 'mechanic',
  'timeslip_admin', 'cs_agent', 'fleet_manager', 'tech', 'project_manager',
] as const;

export const isStaffRole = (role: string) => (STAFF_ROLES as readonly string[]).includes(role);

export interface CallerInfo {
  kind: 'service' | 'cron' | 'user';
  userId?: string;
  email?: string;
  roles: string[];
  isStaff: boolean;
}

/**
 * Identifies the caller: service-role key, valid X-Cron-Secret, or a signed-in
 * user (with their roles). Returns null when nobody valid is calling.
 */
export async function identifyCaller(req: Request): Promise<CallerInfo | null> {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  const cron = req.headers.get('X-Cron-Secret');
  if (cron) {
    const envSecret = Deno.env.get('CRON_SECRET');
    let ok = !!envSecret && cron === envSecret;
    if (!ok) {
      const { data } = await admin.rpc('get_cron_secret');
      ok = typeof data === 'string' && data.length > 0 && cron === data;
    }
    if (ok) return { kind: 'cron', roles: [], isStaff: true };
  }

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  if (serviceKey && token === serviceKey) return { kind: 'service', roles: [], isStaff: true };

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return null;
  const { data: rows, error: rolesError } = await admin.from('user_roles').select('role').eq('user_id', user.id);
  if (rolesError) return null;
  const roles = (rows || []).map((r: any) => String(r.role));
  return {
    kind: 'user',
    userId: user.id,
    email: user.email?.toLowerCase(),
    roles,
    isStaff: roles.some(isStaffRole),
  };
}
