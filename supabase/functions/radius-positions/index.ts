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

let custCache: { at: number; ids: string[]; info: { name: string; product: string }[] } | null = null;
class NoTelematicsError extends Error {}

async function telematicsCustomers(token: string, force = false) {
  if (!force && custCache && Date.now() - custCache.at < 3600_000) return custCache;
  const r = await fetch(`${BASE}/vapi/v1/accounts/users/customers`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) throw new RadiusAuthError("customers 401");
  if (!r.ok) throw new Error(`customers ${r.status}`);
  const j = (await r.json()) ?? {};
  const all = Object.entries(j as Record<string, any>);
  const tele = all.filter(([, c]) => /telematics/i.test(String(c?.product ?? "")));
  const saved = Deno.env.get("RADIUS_CUSTOMER_ID")?.trim();
  const ids = saved && tele.some(([k]) => k === saved) ? [saved] : tele.map(([k]) => k);
  custCache = { at: Date.now(), ids, info: all.map(([, c]) => ({ name: String(c?.name ?? ""), product: String(c?.product ?? "") })) };
  return custCache;
}

/** Fetch positions for every Telematics customer; returns a Response-like object. */
async function fetchPositions(token: string, force = false): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<any> }> {
  const { ids } = await telematicsCustomers(token, force);
  if (!ids.length) throw new NoTelematicsError();
  const results = await Promise.all(ids.map((id) =>
    fetch(`${BASE}/api/mobile/kinesis/device-live-positions/?customer=${encodeURIComponent(id)}&useUTC`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    })));
  const bad = results.find((r) => !r.ok);
  if (bad) return bad;
  const seen = new Map<number, any>();
  for (const r of results) for (const d of ((await r.json())?.devices ?? [])) seen.set(d.id, d);
  const merged = { devices: [...seen.values()] };
  return { ok: true, status: 200, text: async () => JSON.stringify(merged), json: async () => merged };
}

const normReg = (r: unknown) => String(r ?? "").toUpperCase().replace(/\s+/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Daily keep-alive from cron so the refresh token is never left unused.
    const cron = req.headers.get("X-Cron-Secret");
    if (cron) {
      if (cron !== Deno.env.get("CRON_SECRET")) return json({ error: "Unauthorized" }, 401);
      const t = await newAccessToken();
      let body: any = {};
      try { body = await req.json(); } catch { /* none */ }
      if (body?.action === "diagnose") {
        const r = await fetchPositions(t);
        const text = await r.text();
        let detail: unknown = null;
        try { const j = JSON.parse(text); detail = j?.detail ?? j?.message ?? j?.error ?? (Array.isArray(j?.devices) ? `devices: ${j.devices.length}` : Object.keys(j ?? {})); } catch { detail = text.slice(0, 200); }
        return json({ ok: r.ok, status: r.status, detail, customers: custCache?.info ?? [] });
      }
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
    if (res.status === 401 || res.status === 403) res = await fetchPositions(await accessToken(true), true);
    if (!res.ok) {
      const text = await res.text();
      let reason = "";
      try { const j = JSON.parse(text); reason = String(j?.detail ?? j?.message ?? j?.error ?? "").slice(0, 160); } catch { reason = text.replace(/<[^>]*>/g, " ").trim().slice(0, 160); }
      console.error("radius positions rejected", res.status, reason);
      const hint = res.status === 401 ? "Radius didn't accept the sign-in" : res.status === 403 ? "Radius says this account can't see that customer's vans (check the customer ID)" : res.status === 404 ? "Radius couldn't find that customer ID" : "Radius returned an error";
      return json({ error: "radius_error", status: res.status, message: `${hint} (code ${res.status})${reason ? `: ${reason}` : ""}` }, 502);
    }

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
    if (e instanceof NoTelematicsError) return json({ error: "radius_no_telematics", message: "This Radius token isn't for Telematics. Create a Telematics refresh token in the Radius portal.", customers: custCache?.info ?? [] }, 502);
    if (e instanceof RadiusAuthError) return json({ error: "radius_auth", message: "Radius connection needs a new token" }, 502);
    console.error("radius-positions failed", e instanceof Error ? e.name : "unknown");
    return json({ error: "internal" }, 500);
  }
});
