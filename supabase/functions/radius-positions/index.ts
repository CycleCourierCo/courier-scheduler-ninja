// Live van positions from Radius Velocity, trimmed for fleet staff.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BASE = "https://www.velocityfleet.com";
const TOKEN_MAX_AGE_MS = 25 * 24 * 3600 * 1000;
let cache: { at: number; body: unknown } | null = null;

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

class RadiusAuthError extends Error {}

async function newAccessToken(): Promise<string> {
  const refresh = Deno.env.get("RADIUS_REFRESH_TOKEN");
  if (!refresh) throw new RadiusAuthError("missing refresh token");
  const form = new FormData();
  form.append("token", refresh);
  const res = await fetch(`${BASE}/vapi/v1/accounts/users/oauth2/refresh/`, { method: "POST", body: form });
  if (!res.ok) throw new RadiusAuthError(`refresh failed ${res.status}`);
  const data = await res.json();
  if (!data?.token) throw new RadiusAuthError("no token returned");
  await admin().from("fleet_integration_tokens").upsert({ provider: "radius", token: data.token, fetched_at: new Date().toISOString() });
  return data.token;
}

async function accessToken(force = false): Promise<string> {
  if (!force) {
    const { data } = await admin().from("fleet_integration_tokens").select("token, fetched_at").eq("provider", "radius").maybeSingle();
    if (data && Date.now() - new Date(data.fetched_at).getTime() < TOKEN_MAX_AGE_MS) return data.token;
  }
  return newAccessToken();
}

async function fetchPositions(token: string) {
  const customer = encodeURIComponent(Deno.env.get("RADIUS_CUSTOMER_ID") ?? "");
  return fetch(`${BASE}/api/mobile/kinesis/device-live-positions/?customer=${customer}&useUTC`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

const normReg = (r: unknown) => String(r ?? "").toUpperCase().replace(/\s+/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Daily keep-alive from cron so the refresh token is never left unused.
    const cron = req.headers.get("X-Cron-Secret");
    if (cron) {
      if (cron !== Deno.env.get("CRON_SECRET")) return json({ error: "Unauthorized" }, 401);
      await newAccessToken();
      return json({ ok: true });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser(authHeader.slice(7));
    if (uErr || !u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isFleet } = await userClient.rpc("is_fleet_staff", { _uid: u.user.id });
    if (!isFleet) return json({ error: "Forbidden" }, 403);

    if (cache && Date.now() - cache.at < 20_000) return json(cache.body);

    let res = await fetchPositions(await accessToken());
    if (res.status === 401 || res.status === 403) res = await fetchPositions(await accessToken(true));
    if (res.status === 401 || res.status === 403) return json({ error: "radius_auth", message: "Radius connection needs a new token" }, 502);
    if (!res.ok) return json({ error: "radius_error", message: `Radius returned ${res.status}` }, 502);

    const raw = await res.json();
    const devices = (Array.isArray(raw?.devices) ? raw.devices : [])
      .filter((d: any) => !d?.private && d?.lat != null && d?.lon != null)
      .map((d: any) => ({
        id: d.id,
        registration: normReg(d.vehicle_registration),
        lat: Number(d.lat),
        lon: Number(d.lon),
        ignition: d.ignition === "Y" || d.ignition === true,
        speed: Number(d.speed ?? 0),
        direction: d.direction != null ? Number(d.direction) : null,
        street: d.street ?? null,
        town: d.town ?? null,
        post_code: d.post_code ?? null,
        driver_name: d.driver_name_list_display || d.driver_name || null,
        timestamp: d.timestamp ? Number(d.timestamp) : null,
      }));
    const body = { devices, fetched_at: new Date().toISOString() };
    cache = { at: Date.now(), body };
    return json(body);
  } catch (e) {
    if (e instanceof RadiusAuthError) return json({ error: "radius_auth", message: "Radius connection needs a new token" }, 502);
    console.error("radius-positions failed", e instanceof Error ? e.name : "unknown");
    return json({ error: "internal" }, 500);
  }
});
