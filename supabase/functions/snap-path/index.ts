// Road-snaps a van's recorded tracker path for the Live Map (fleet staff only). Cached per van/day.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { snapBatches, type SnapPt } from "../_shared/snapBatch.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
type Line = [number, number][];

async function snapBatch(batch: SnapPt[], lovable: string, gm: string): Promise<Line> {
  const path = batch.map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join("|");
  const r = await fetch(`${GATEWAY_URL}/roads/v1/snapToRoads?interpolate=true&path=${encodeURIComponent(path)}`, {
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": gm },
  });
  if (!r.ok) throw new Error(`roads ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json();
  return (d.snappedPoints ?? []).map((s: any) => [s.location.latitude, s.location.longitude]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser(auth.slice(7));
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isFleet } = await userClient.rpc("is_fleet_staff", { _uid: u.user.id });
    if (!isFleet) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const reg = typeof body.registration === "string" ? body.registration.replace(/\s+/g, "").toUpperCase().slice(0, 12) : "";
    const date = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : "";
    const from = Date.parse(body.from), to = Date.parse(body.to);
    if (!reg || !date || !Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 26 * 3600_000) return json({ error: "Invalid input" }, 400);

    const LOVABLE = Deno.env.get("LOVABLE_API_KEY"), GM = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!LOVABLE || !GM) return json({ error: "Missing Google Maps credentials" }, 500);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cache } = await admin.from("fleet_snapped_paths").select("last_point_at, points").eq("registration", reg).eq("path_date", date).maybeSingle();
    const since = cache ? cache.last_point_at : new Date(from).toISOString();

    const raw: SnapPt[] = [];
    for (let off = 0; ; off += 1000) {
      const { data, error } = await admin.from("fleet_position_history").select("registration, lat, lon, recorded_at")
        .gte("recorded_at", since).lt("recorded_at", new Date(to).toISOString()).order("recorded_at").range(off, off + 999);
      if (error) throw error;
      for (const h of data ?? []) if (String(h.registration).replace(/\s+/g, "").toUpperCase() === reg) raw.push({ lat: h.lat, lon: h.lon, t: Date.parse(h.recorded_at) });
      if (!data || data.length < 1000) break;
    }

    const segments: Line[] = (cache?.points as Line[] | undefined) ?? [];
    if (raw.length > 1) {
      const fresh: Line[] = [];
      for (const seg of snapBatches(raw)) {
        const line: Line = [];
        for (const b of seg) line.push(...await snapBatch(b, LOVABLE, GM));
        if (line.length > 1) fresh.push(line);
      }
      // Join the first new segment to the cached tail when it starts at the cached last point.
      if (cache && fresh.length && segments.length) { segments[segments.length - 1].push(...fresh.shift()!); }
      segments.push(...fresh);
      await admin.from("fleet_snapped_paths").upsert({
        registration: reg, path_date: date, last_point_at: new Date(raw[raw.length - 1].t).toISOString(), points: segments, updated_at: new Date().toISOString(),
      });
    }
    return json({ segments });
  } catch (e) {
    console.error("snap-path failed", String((e as Error)?.message ?? e).slice(0, 300));
    return json({ error: "Snapping failed" }, 502);
  }
});
