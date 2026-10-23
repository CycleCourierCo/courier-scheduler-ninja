// Endpoint class: PUBLIC — tracking lookup for cyclecourierco.com (retail site).
// Reuses get_public_order / get_public_order_with_proof (sanitised, rate limited)
// and whitelists the response again. No names, contacts or addresses are returned.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const ALLOWED_ORIGINS = new Set([
  "https://cyclecourierco.com",
  "https://www.cyclecourierco.com",
  "https://booking.cyclecourierco.com",
]);

const cors = (origin: string | null): Record<string, string> => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://cyclecourierco.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  Vary: "Origin",
});

const Input = z.object({
  tracking: z.string().trim().toUpperCase().regex(/^CCC754\d{9}[A-Z]{3}[A-Z0-9]{1,3}$/),
  postcode: z.string().trim().min(2).max(10).optional(),
});

const SAFE_FIELDS = [
  "tracking_number", "status", "created_at", "updated_at", "bike_quantity",
  "bike_brand", "bike_model", "bike_type", "pickup_date", "delivery_date",
  "scheduled_pickup_date", "scheduled_delivery_date", "pickup_timeslot", "delivery_timeslot",
  "order_collected", "order_delivered", "sender_confirmed_at", "receiver_confirmed_at",
  "needs_inspection", "inspection_summary", "is_northern_ireland", "is_box_my_bike",
  "box_my_bike_status", "box_tracking_url", "revealed_side",
];

const cleanEvents = (events: any, revealed: boolean) => {
  const updates = Array.isArray(events?.shipday?.updates) ? events.shipday.updates : [];
  return updates.map((u: any) => ({
    leg: u.leg, event: u.event, timestamp: u.timestamp,
    description: typeof u.description === "string" ? u.description.replace(/^Driver\s+[^h]+?\s+has/i, "Driver has") : null,
    ...(revealed ? { pod_urls: u.pod_urls ?? u.podUrls ?? null, signature_url: u.signature_url ?? u.signatureUrl ?? null } : {}),
  }));
};

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get("Origin")), "Content-Type": "application/json" };
  const json = (b: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(b), { status, headers: { ...headers, ...extra } });

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    let raw: Record<string, unknown> = {};
    if (req.method === "GET") {
      const u = new URL(req.url);
      raw = { tracking: u.searchParams.get("tracking") ?? "", postcode: u.searchParams.get("postcode") ?? undefined };
    } else {
      raw = await req.json().catch(() => ({}));
    }
    const parsed = Input.safeParse(raw);
    if (!parsed.success) return json({ found: false, error: "Tracking number not found" }, 404);
    const { tracking, postcode } = parsed.data;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data, error } = postcode
      ? await supabase.rpc("get_public_order_with_proof", { p_identifier: tracking, p_postcode: postcode })
      : await supabase.rpc("get_public_order", { p_identifier: tracking });

    if (error) {
      console.error("public-track lookup failed", error.code);
      return json({ found: false, error: "Lookup failed, please try again" }, 500);
    }
    if (!data) return json({ found: false, error: "Tracking number not found" }, 404);

    const d = data as Record<string, any>;
    const order: Record<string, unknown> = {};
    for (const k of SAFE_FIELDS) if (k in d) order[k] = d[k];
    const verified = !!postcode && !d.verification_failed && !d.rate_limited;
    order.bikes = Array.isArray(d.bikes)
      ? d.bikes.map((b: any) => ({ brand: b?.brand ?? null, model: b?.model ?? null, type: b?.type ?? null }))
      : [];
    order.events = cleanEvents(d.tracking_events, verified);

    return json(
      { found: true, postcode_verified: verified, rate_limited: !!d.rate_limited, order },
      200,
      postcode ? { "Cache-Control": "no-store" } : { "Cache-Control": "public, max-age=60" },
    );
  } catch (_e) {
    console.error("public-track error");
    return json({ found: false, error: "Lookup failed, please try again" }, 500);
  }
});
