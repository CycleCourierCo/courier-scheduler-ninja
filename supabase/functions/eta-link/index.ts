// ETA links: fleet staff send a public link showing a van's live (Radius) position and either
// its road route back to the depot, or its ETA to one stop on a saved route
// (drive time + 15 min per remaining stop before it). Public "view" reads by token.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@2.0.0";
import { emailShell, EMAIL_BRAND } from "../_shared/emailLayout.ts";
import { computeStopEtas, isPositionFresh, wasVisited, stopCompletion, type Leg } from "../_shared/stopEta.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DEPOT = { lat: 52.4690197, lon: -1.8757663, address: "Lawden Road, Birmingham, B10 0AD" };
const APP_URL = "https://booking.cyclecourierco.com";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const MAX_INTERMEDIATES = 25;
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const normReg = (r: unknown) => String(r ?? "").replace(/\s+/g, "").toUpperCase();
const uuidRe = /^[0-9a-f-]{36}$/i;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
type Pt = { lat: number; lon: number };

const viewCache = new Map<string, { at: number; body: unknown }>();
const londonToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

/** Road route origin → points (last point = destination). Returns polyline + per-leg times. */
async function roadRoute(origin: Pt, points: Pt[]) {
  const key = Deno.env.get("LOVABLE_API_KEY"), gm = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key || !gm || !points.length) return null;
  const wp = (p: Pt) => ({ location: { latLng: { latitude: p.lat, longitude: p.lon } } });
  const pts = points.slice(0, MAX_INTERMEDIATES + 1);
  const r = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`, "X-Connection-Api-Key": gm, "Content-Type": "application/json",
      "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration,routes.legs.duration,routes.legs.distanceMeters",
    },
    body: JSON.stringify({
      origin: wp(origin), destination: wp(pts[pts.length - 1]), intermediates: pts.slice(0, -1).map(wp),
      travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE",
    }),
  });
  if (!r.ok) { console.error("eta route failed", r.status); return null; }
  const route = (await r.json())?.routes?.[0];
  if (!route?.polyline?.encodedPolyline) return null;
  const secs = (d: unknown) => { const n = parseFloat(String(d ?? "0")); return Number.isFinite(n) ? n : 0; };
  const legs: Leg[] = (route.legs ?? []).map((l: any) => ({ seconds: secs(l.duration), meters: l.distanceMeters ?? 0 }));
  return { polyline: route.polyline.encodedPolyline as string, miles: (route.distanceMeters ?? 0) / 1609.344, seconds: secs(route.duration), legs };
}

async function latestPosition(db: any, registration: string) {
  const { data } = await db.from("fleet_position_history").select("lat, lon, recorded_at")
    .eq("registration", registration).order("recorded_at", { ascending: false }).limit(1).maybeSingle();
  return data ? { lat: Number(data.lat), lon: Number(data.lon), at: data.recorded_at as string } : null;
}

/** Planned stops for a saved route on a date (timeslip snapshot first, else the saved route). */
async function routeStops(db: any, savedRouteId: string, date: string) {
  const { data: ts } = await db.from("timeslips").select("planned_snapshot, driver_id")
    .eq("saved_route_id", savedRouteId).eq("date", date).limit(1).maybeSingle();
  let raw: any[] | null = Array.isArray(ts?.planned_snapshot?.stops) ? ts.planned_snapshot.stops : null;
  if (!raw) {
    const { data: sr } = await db.from("saved_routes").select("job_data").eq("id", savedRouteId).maybeSingle();
    raw = Array.isArray(sr?.job_data) ? sr.job_data : [];
  }
  const stops = (raw ?? []).filter((s) => s?.lat != null && s?.lon != null)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => ({ lat: Number(s.lat), lon: Number(s.lon), type: String(s.type ?? "stop"), orderId: typeof s.orderId === "string" ? s.orderId : null }));
  let driverFirst: string | null = null;
  if (ts?.driver_id) {
    const { data: p } = await db.from("profiles").select("name").eq("id", ts.driver_id).maybeSingle();
    driverFirst = (p?.name ?? "").trim().split(/\s+/)[0] || null;
  }
  return { stops, driverFirst };
}

async function sendWhatsApp(phone: string, text: string) {
  const apiKey = Deno.env.get("SENDZEN_API_KEY");
  if (!apiKey) return false;
  const digits = phone.replace(/[^\d]/g, "").replace(/^0/, "44");
  const r = await fetch("https://api.sendzen.io/v1/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "441217980767", to: `+${digits}`, type: "text", text: { body: text, preview_url: true } }),
  });
  if (!r.ok) console.error("eta whatsapp failed", r.status);
  return r.ok;
}

/** Stop indexes whose order leg is finished (delivery → delivered, else collected). */
async function completedStops(db: any, stops: { type: string; orderId: string | null }[]) {
  const ids = [...new Set(stops.map((s) => s.orderId).filter((x): x is string => !!x && uuidRe.test(x)))];
  const done = new Map<number, string>();
  if (!ids.length) return done;
  const { data } = await db.from("orders").select("id, order_collected, order_delivered").in("id", ids);
  const byId = new Map((data ?? []).map((o: any) => [o.id, o]));
  stops.forEach((s, i) => {
    const o: any = s.orderId ? byId.get(s.orderId) : null;
    const c = stopCompletion(s.type, o);
    if (c) done.set(i, c);
  });
  return done;
}

async function viewStopLink(db: any, link: any, token: string) {
  const pos = await latestPosition(db, link.registration);
  const { stops, driverFirst } = await routeStops(db, link.saved_route_id, link.route_date);
  const target = stops[link.stop_index];
  if (!target) return { status: 404, body: { error: "This stop is no longer on the route" } };
  const base = { kind: "stop", registration: link.registration, driver: driverFirst, stop: { lat: target.lat, lon: target.lon, type: target.type }, expires_at: link.expires_at };
  const finished = await completedStops(db, stops);
  if (finished.has(link.stop_index)) {
    // Bike collected/delivered: close the link for good and stop sharing the van's position.
    await db.from("fleet_eta_links").update({ expires_at: new Date().toISOString(), closed_status: finished.get(link.stop_index) }).eq("token", token);
    return { status: 200, body: { ...base, done: true, closed: true, completed: finished.get(link.stop_index), position: null } };
  }
  const start = new Date(`${link.route_date}T00:00:00Z`).getTime() - 3600_000;
  const { data: hist } = await db.from("fleet_position_history").select("lat, lon")
    .eq("registration", link.registration).gte("recorded_at", new Date(start).toISOString()).limit(5000);
  const path = (hist ?? []).map((h: any) => ({ lat: Number(h.lat), lon: Number(h.lon) }));
  if (wasVisited(target, path)) return { status: 200, body: { ...base, done: true, position: pos } };
  if (!pos || !isPositionFresh(pos.at, Date.now())) return { status: 200, body: { ...base, position: pos, unavailable: true } };
  const before = stops.slice(0, link.stop_index).filter((s, i) => !finished.has(i) && !wasVisited(s, path));
  const route = await roadRoute(pos, [...before, target]);
  if (!route) return { status: 200, body: { ...base, position: pos, unavailable: true } };
  const eta = computeStopEtas(route.legs, Date.now()).at(-1)!;
  return { status: 200, body: { ...base, position: pos, route: { polyline: route.polyline, miles: eta.miles, minutes: eta.minutes, eta: eta.eta, stopsBefore: eta.stopsBefore } } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.action === "view") {
      const token = String(body.token ?? "");
      if (!uuidRe.test(token)) return json({ error: "Link not found" }, 404);
      const hit = viewCache.get(token);
      if (hit && Date.now() - hit.at < 110_000) return json(hit.body);
      const db = admin();
      const { data: link } = await db.from("fleet_eta_links")
        .select("registration, expires_at, saved_route_id, route_date, stop_index, closed_status").eq("token", token).maybeSingle();
      if (!link) return json({ error: "Link not found" }, 404);
      if (link.closed_status) return json({ kind: "stop", done: true, closed: true, completed: link.closed_status, position: null, registration: link.registration, driver: null, stop: null });
      if (new Date(link.expires_at).getTime() < Date.now()) return json({ error: "This link has expired" }, 410);
      if (link.saved_route_id && link.route_date && link.stop_index != null) {
        const r = await viewStopLink(db, link, token);
        if (r.status === 200) viewCache.set(token, { at: Date.now(), body: r.body });
        return json(r.body, r.status);
      }
      const pos = await latestPosition(db, link.registration);
      if (!pos) return json({ error: "The van's location isn't available right now" }, 404);
      const route = await roadRoute(pos, [DEPOT]);
      const out = {
        kind: "depot",
        position: pos,
        depot: DEPOT,
        route: route ? { polyline: route.polyline, miles: Math.round(route.miles * 10) / 10, minutes: Math.round(route.seconds / 60), eta: new Date(Date.now() + route.seconds * 1000).toISOString() } : null,
        expires_at: link.expires_at,
      };
      viewCache.set(token, { at: Date.now(), body: out });
      return json(out);
    }

    // Everything below: fleet staff only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser(authHeader.slice(7));
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isFleet } = await userClient.rpc("is_fleet_staff", { _uid: u.user.id });
    if (!isFleet) return json({ error: "Forbidden" }, 403);
    const db = admin();
    const registration = normReg(body.registration);
    if (!registration || registration.length > 12) return json({ error: "Van registration required" }, 400);

    if (body.action === "route_etas") {
      // Live ETAs for a route's remaining stops, in order, from the van's Radius position.
      const stops: Pt[] = Array.isArray(body.stops) ? body.stops.slice(0, MAX_INTERMEDIATES + 1)
        .map((s: any) => ({ lat: Number(s?.lat), lon: Number(s?.lon) }))
        .filter((s: Pt) => Number.isFinite(s.lat) && Number.isFinite(s.lon) && Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180) : [];
      if (!stops.length) return json({ etas: [] });
      const pos = await latestPosition(db, registration);
      if (!pos || !isPositionFresh(pos.at, Date.now())) return json({ unavailable: true, position_at: pos?.at ?? null });
      const route = await roadRoute(pos, stops);
      if (!route) return json({ unavailable: true, position_at: pos.at });
      return json({ etas: computeStopEtas(route.legs, Date.now()), position_at: pos.at });
    }

    // send / copy a link
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";
    const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const copyOnly = body.copy === true;
    if (!copyOnly && !phone && !email) return json({ error: "Add a phone number or email" }, 400);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Email looks wrong" }, 400);
    if (phone && phone.replace(/\D/g, "").length < 10) return json({ error: "Phone number looks wrong" }, 400);

    const stop = body.stop && typeof body.stop === "object" ? body.stop : null;
    const row: Record<string, unknown> = { registration, created_by: u.user.id, sent_to_phone: phone || null, sent_to_email: email || null };
    if (stop) {
      const idx = Number(stop.stop_index);
      if (!uuidRe.test(String(stop.saved_route_id ?? "")) || !dateRe.test(String(stop.date ?? "")) || !Number.isInteger(idx) || idx < 0 || idx > 500) {
        return json({ error: "Stop details are wrong" }, 400);
      }
      if (stop.date !== londonToday()) return json({ error: "Stop links can only be sent for today's routes" }, 400);
      row.saved_route_id = stop.saved_route_id; row.route_date = stop.date; row.stop_index = idx;
      row.expires_at = new Date(`${stop.date}T23:59:00Z`).toISOString();
    }
    const { data: link, error } = await db.from("fleet_eta_links").insert(row).select("token").single();
    if (error) throw error;
    const url = `${APP_URL}/eta/${link.token}`;
    if (copyOnly) return json({ ok: true, url });

    const greet = name ? `Hi ${name}, ` : "Hi, ";
    const text = stop
      ? `${greet}your Cycle Courier Co. driver is on the way. Track them live and see your ETA:\n${url}\n\nThe link works until the end of today.`
      : `${greet}here's the live location of our Cycle Courier Co. van and its ETA back to the depot:\n${url}\n\nThe link works for 12 hours.`;
    const results = { whatsapp: false, email: false };
    if (phone) results.whatsapp = await sendWhatsApp(phone, text);
    if (email) {
      const rk = Deno.env.get("RESEND_API_KEY");
      if (rk) {
        const safeGreet = greet.replace(/</g, "&lt;");
        const html = stop
          ? emailShell(`<p>${safeGreet}your driver is on the way.</p>
<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:${EMAIL_BRAND.primary};color:${EMAIL_BRAND.primaryText};border-radius:6px;text-decoration:none">Track your driver</a></p>
<p>The link updates live and works until the end of today.</p>`)
          : emailShell(`<p>${safeGreet}here's the live location of our van and its estimated arrival back at the depot.</p>
<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:${EMAIL_BRAND.primary};color:${EMAIL_BRAND.primaryText};border-radius:6px;text-decoration:none">View van location &amp; ETA</a></p>
<p>The link works for 12 hours.</p>`);
        const r = await new Resend(rk).emails.send({
          from: "CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>", reply_to: "Info@cyclecourierco.com",
          to: [email], subject: stop ? "Your driver is on the way" : "Van location and ETA", html,
        });
        results.email = !r.error;
        if (r.error) console.error("eta email failed");
      }
    }
    if (!results.whatsapp && !results.email) return json({ error: "Couldn't send the link", url }, 502);
    return json({ ok: true, url, ...results });
  } catch (e) {
    console.error("eta-link error", (e as Error)?.message);
    return json({ error: "Something went wrong" }, 500);
  }
});
