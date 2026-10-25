// ETA links: fleet staff send a public link showing a van's live position,
// road route back to the depot, miles and ETA. Public "view" reads by token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { emailShell } from "../_shared/emailLayout.ts";

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
const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const normReg = (r: unknown) => String(r ?? "").replace(/\s+/g, "").toUpperCase();
const uuidRe = /^[0-9a-f-]{36}$/i;

const viewCache = new Map<string, { at: number; body: unknown }>();

async function routeToDepot(lat: number, lon: number) {
  const key = Deno.env.get("LOVABLE_API_KEY"), gm = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key || !gm) return null;
  const wp = (a: number, b: number) => ({ location: { latLng: { latitude: a, longitude: b } } });
  const r = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`, "X-Connection-Api-Key": gm, "Content-Type": "application/json",
      "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify({ origin: wp(lat, lon), destination: wp(DEPOT.lat, DEPOT.lon), travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE" }),
  });
  if (!r.ok) { console.error("eta route failed", r.status); return null; }
  const route = (await r.json())?.routes?.[0];
  if (!route?.polyline?.encodedPolyline) return null;
  const secs = parseFloat(String(route.duration ?? "0"));
  return { polyline: route.polyline.encodedPolyline as string, miles: (route.distanceMeters ?? 0) / 1609.344, seconds: Number.isFinite(secs) ? secs : 0 };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.action === "view") {
      const token = String(body.token ?? "");
      if (!uuidRe.test(token)) return json({ error: "Link not found" }, 404);
      const hit = viewCache.get(token);
      if (hit && Date.now() - hit.at < 60_000) return json(hit.body);
      const db = admin();
      const { data: link } = await db.from("fleet_eta_links").select("registration, expires_at").eq("token", token).maybeSingle();
      if (!link) return json({ error: "Link not found" }, 404);
      if (new Date(link.expires_at).getTime() < Date.now()) return json({ error: "This link has expired" }, 410);
      const { data: pos } = await db.from("fleet_position_history").select("lat, lon, recorded_at")
        .eq("registration", link.registration).order("recorded_at", { ascending: false }).limit(1).maybeSingle();
      if (!pos) return json({ error: "The van's location isn't available right now" }, 404);
      const route = await routeToDepot(Number(pos.lat), Number(pos.lon));
      const out = {
        position: { lat: Number(pos.lat), lon: Number(pos.lon), at: pos.recorded_at },
        depot: DEPOT,
        route: route ? { polyline: route.polyline, miles: Math.round(route.miles * 10) / 10, minutes: Math.round(route.seconds / 60), eta: new Date(Date.now() + route.seconds * 1000).toISOString() } : null,
        expires_at: link.expires_at,
      };
      viewCache.set(token, { at: Date.now(), body: out });
      return json(out);
    }

    // send: fleet staff only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser(authHeader.slice(7));
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isFleet } = await userClient.rpc("is_fleet_staff", { _uid: u.user.id });
    if (!isFleet) return json({ error: "Forbidden" }, 403);

    const registration = normReg(body.registration);
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";
    const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (!registration || registration.length > 12) return json({ error: "Van registration required" }, 400);
    if (!phone && !email) return json({ error: "Add a phone number or email" }, 400);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Email looks wrong" }, 400);
    if (phone && phone.replace(/\D/g, "").length < 10) return json({ error: "Phone number looks wrong" }, 400);

    const db = admin();
    const { data: link, error } = await db.from("fleet_eta_links")
      .insert({ registration, created_by: u.user.id, sent_to_phone: phone || null, sent_to_email: email || null })
      .select("token").single();
    if (error) throw error;
    const url = `${APP_URL}/eta/${link.token}`;
    const greet = name ? `Hi ${name}, ` : "Hi, ";
    const text = `${greet}here's the live location of our Cycle Courier Co. van and its ETA back to the depot:\n${url}\n\nThe link works for 12 hours.`;

    const results = { whatsapp: false, email: false };
    if (phone) results.whatsapp = await sendWhatsApp(phone, text);
    if (email) {
      const rk = Deno.env.get("RESEND_API_KEY");
      if (rk) {
        const html = emailShell(`<p>${greet.replace(/</g, "&lt;")}here's the live location of our van and its estimated arrival back at the depot.</p>
<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#4D6863;color:#ffffff;border-radius:6px;text-decoration:none">View van location &amp; ETA</a></p>
<p>The link works for 12 hours.</p>`);
        const r = await new Resend(rk).emails.send({
          from: "CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>", reply_to: "Info@cyclecourierco.com",
          to: [email], subject: "Van location and ETA", html,
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
