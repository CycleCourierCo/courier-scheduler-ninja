import { requireOpsAuth, createAuthErrorResponse } from "../_shared/auth.ts";
import { trackedFetch } from "../_shared/integrationLog.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
  try { parsed = text ? JSON.parse(text) : null; } catch { /* non-JSON response */ }

  if (!res.ok) {
    const message = (parsed?.errorMessage || parsed?.message || parsed?.error || text || `HTTP ${res.status}`).toString().slice(0, 300);
    return { ok: false as const, error: message };
  }

  return { ok: true as const, id: extractId(parsed), name: String(body.name) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Admin only — this creates real driver records in Shipday
  const auth = await requireOpsAuth(req, ['admin']);
  if (!auth.success) {
    return createAuthErrorResponse(auth.error!, auth.status!);
  }

  try {
    const apiKey = Deno.env.get('SHIPDAY_API_KEY');
    if (!apiKey) return json({ error: 'Shipday API key not configured' }, 500);

    const body = await req.json().catch(() => ({}));
    const fullName = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';

    if (!fullName || fullName.length > 120) return json({ error: 'A driver name is required' }, 400);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'A valid driver email is required' }, 400);

    const first = firstNameOf(fullName);
    const slug = first.toLowerCase().replace(/[^a-z0-9]/g, '') || 'driver';
    const suffix = Math.random().toString(36).slice(2, 7);

    const mainPhone = digitsOnly(phone) || '+440000000000';

    const main = await createCarrier(apiKey, 'create carrier', {
      name: first,
      email,
      phoneNumber: mainPhone,
    });

    const temp = await createCarrier(apiKey, 'create temp carrier', {
      name: `${first} - Temp`,
      email: `${slug}.temp.${suffix}@cyclecourierco.com`,
      phoneNumber: '+440000000000',
    });

    return json({
      main: main.ok ? { id: main.id, name: main.name } : null,
      mainError: main.ok ? null : main.error,
      temp: temp.ok ? { id: temp.id, name: temp.name } : null,
      tempError: temp.ok ? null : temp.error,
    });
  } catch (error) {
    console.error('create-shipday-carrier failed:', (error as Error)?.name);
    return json({ error: 'Internal server error' }, 500);
  }
});
