import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireOpsAuth, createAuthErrorResponse } from "../_shared/auth.ts";
import { trackedFetch } from "../_shared/integrationLog.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const ROLE_PRIORITY = ['admin', 'route_planner', 'loader', 'mechanic', 'sales', 'driver', 'b2b_customer', 'b2c_customer'];

const firstNameOf = (name: string) => (name || '').trim().split(/\s+/)[0] || 'Driver';
const digitsOnly = (v: string) => (v || '').replace(/[^\d+]/g, '');

const extractId = (payload: any): string | null => {
  if (payload == null) return null;
  if (typeof payload === 'number' || typeof payload === 'string') {
    const s = String(payload).trim();
    return /^\d+$/.test(s) ? s : null;
  }
  const candidate = payload.id ?? payload.carrierId ?? payload.personelId ?? payload.carrier?.id;
  return candidate == null ? null : String(candidate);
};

async function createCarrier(apiKey: string, label: string, body: Record<string, unknown>) {
  const res = await trackedFetch("shipday", label, 'https://api.shipday.com/carriers', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }

  if (!res.ok) {
    const message = (parsed?.errorMessage || parsed?.message || parsed?.error || text || `HTTP ${res.status}`)
      .toString().slice(0, 300);
    return { ok: false as const, error: message };
  }
  return { ok: true as const, id: extractId(parsed), name: String(body.name) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireOpsAuth(req, ['admin']);
  if (!auth.success) {
    return createAuthErrorResponse(auth.error!, auth.status!);
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));

    // Second phase: record licence document paths against an existing driver
    if (body?.action === 'attachLicence') {
      const userId = typeof body.userId === 'string' ? body.userId : '';
      const paths = (body.paths && typeof body.paths === 'object') ? body.paths : {};
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'A valid user id is required' }, 400);

      const allowed = ['licence_front_path', 'licence_back_path', 'licence_check_code_path'];
      const updates: Record<string, any> = {};
      for (const key of allowed) {
        const value = (paths as any)[key];
        if (typeof value === 'string' && value.length > 0 && value.length < 300) updates[key] = value;
      }
      if (Object.keys(updates).length === 0) return json({ success: true, updated: 0 });
      updates.licence_updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select('id');
      if (error) throw error;
      return json({ success: true, updated: data?.length ?? 0 });
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const role = typeof body?.role === 'string' ? body.role : '';

    if (!name || name.length > 120) return json({ error: 'A name is required' }, 400);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'A valid email is required' }, 400);
    if (!password || password.length < 8) return json({ error: 'A password of at least 8 characters is required' }, 400);
    if (!ROLE_PRIORITY.includes(role)) return json({ error: 'Unknown role' }, 400);

    const isDriver = role === 'driver';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const num = (v: unknown) => {
      if (v === '' || v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n < 1000 ? n : null;
    };

    // 1. Create the login
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });
    if (createError || !created?.user) {
      const message = createError?.message || 'Could not create this login';
      return json({ error: message }, 400);
    }
    const userId = created.user.id;

    // 2. Role (user_roles is the source of truth, profiles.role mirrors it)
    const warnings: string[] = [];
    const { error: roleDeleteError } = await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    if (roleDeleteError) warnings.push('Existing roles could not be cleared');
    const { error: roleInsertError } = await supabaseAdmin.from('user_roles').insert({ user_id: userId, role });
    if (roleInsertError) warnings.push('Role could not be assigned');

    const profileUpdates: Record<string, any> = { role, name, email };
    if (phone) profileUpdates.phone = phone;

    let shipday: { main: any; temp: any; mainError: string | null; tempError: string | null } | null = null;

    if (isDriver) {
      profileUpdates.hourly_rate = num(body?.hourly_rate);
      profileUpdates.workshop_hourly_rate = num(body?.workshop_hourly_rate);
      profileUpdates.licence_number = typeof body?.licence_number === 'string' && body.licence_number.trim()
        ? body.licence_number.trim().toUpperCase().slice(0, 32)
        : null;
      profileUpdates.licence_expiry = typeof body?.licence_expiry === 'string' && body.licence_expiry
        ? body.licence_expiry
        : null;

      // 3. Shipday carriers: main + Temp
      const apiKey = Deno.env.get('SHIPDAY_API_KEY');
      if (!apiKey) {
        warnings.push('Shipday API key is not configured, so no Shipday drivers were created');
      } else {
        const first = firstNameOf(name);
        const slug = first.toLowerCase().replace(/[^a-z0-9]/g, '') || 'driver';
        const suffix = Math.random().toString(36).slice(2, 7);

        const main = await createCarrier(apiKey, 'create carrier', {
          name: first,
          email,
          phoneNumber: digitsOnly(phone) || '+440000000000',
        });
        const temp = await createCarrier(apiKey, 'create temp carrier', {
          name: `${first} - Temp`,
          email: `${slug}.temp.${suffix}@cyclecourierco.com`,
          phoneNumber: '+440000000000',
        });

        if (main.ok && main.id) {
          profileUpdates.shipday_driver_id = String(main.id);
          profileUpdates.shipday_driver_name = main.name;
        } else {
          warnings.push(`Shipday driver not created${main.ok ? '' : `: ${main.error}`}`);
        }
        if (temp.ok && temp.id) {
          profileUpdates.shipday_temp_driver_id = String(temp.id);
          profileUpdates.shipday_temp_driver_name = temp.name;
        } else {
          warnings.push(`Shipday "Temp" driver not created${temp.ok ? '' : `: ${temp.error}`}`);
        }

        shipday = {
          main: main.ok ? { id: main.id, name: main.name } : null,
          temp: temp.ok ? { id: temp.id, name: temp.name } : null,
          mainError: main.ok ? null : main.error,
          tempError: temp.ok ? null : temp.error,
        };
      }
    }

    // 4. Save everything onto the profile (row is created by the handle_new_user trigger)
    const { data: updatedRows, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId)
      .select('id');

    if (profileError || !updatedRows?.length) {
      console.error('Driver profile update failed:', profileError?.message || 'no rows updated');
      warnings.push('Pay and licence details could not be saved');
    }

    return json({ success: true, userId, warnings, shipday });
  } catch (error) {
    console.error('create-driver-user failed:', (error as Error)?.name);
    return json({ error: 'Internal server error' }, 500);
  }
});
