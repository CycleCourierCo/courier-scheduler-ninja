// Endpoint class: PUBLIC — tracking lookup for cyclecourierco.com (retail site).
// Reuses get_public_order / get_public_order_with_proof (sanitised, rate limited)
// and whitelists the response again. No names, contacts or addresses are returned.
// See TRACKING_SPEC.md for the full contract.
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
  "tracking_number", "customer_order_number", "status", "created_at", "updated_at", "bike_quantity",
  "bike_brand", "bike_model", "bike_type", "pickup_date", "delivery_date",
  "scheduled_pickup_date", "scheduled_delivery_date", "scheduled_at", "pickup_timeslot", "delivery_timeslot",
  "order_collected", "order_delivered", "sender_confirmed_at", "receiver_confirmed_at",
  "needs_inspection", "inspection_summary", "is_northern_ireland", "ni_direction", "is_box_my_bike",
  "box_my_bike_status", "box_tracking_url", "box_in_depot_at", "box_boxed_at", "box_label_printed_at",
  "box_collected_by_3p_at", "box_delivered_by_3p_at", "foam_status", "foam_foamed_at",
  "foam_delivered_to_ferry_at", "foam_crossed_to_ni_at", "foam_delivered_ni_at",
  "ni_inbound_status", "ni_inbound_collected_at", "ni_inbound_ferry_crossed_at", "ni_inbound_received_at",
  "has_foam_photos", "revealed_side",
];

const STATUS_LABELS: Record<string, string> = {
  created: "Created",
  sender_availability_pending: "Sender Confirmation Pending",
  sender_availability_confirmed: "Sender Confirmed",
  receiver_availability_pending: "Receiver Confirmation Pending",
  receiver_availability_confirmed: "Receiver Confirmed",
  scheduled_dates_pending: "Scheduled Dates Pending",
  pending_approval: "Scheduled Dates Pending",
  scheduled: "Scheduled",
  collection_scheduled: "Collection Scheduled",
  delivery_scheduled: "Delivery Scheduled",
  driver_to_collection: "Driver En Route to Pickup",
  collected: "Bike Collected",
  driver_to_delivery: "Driver En Route to Delivery",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// Removes driver names from Shipday descriptions ("Driver Abdul Hadi assigned…").
const scrubDriver = (s: unknown): string | null => {
  if (typeof s !== "string") return null;
  return s.replace(/^Driver\s+(?!(?:is|has)\b).+?\s+(?=(?:has|assigned|is|accepted)\b)/i, "Driver ");
};

const cleanEvents = (events: any) => {
  const updates = Array.isArray(events?.shipday?.updates) ? events.shipday.updates : [];
  return updates.map((u: any) => {
    const pod = u.podUrls ?? u.pod_urls ?? null;
    const sig = u.signatureUrl ?? u.signature_url ?? null;
    return {
      leg: u.leg ?? null, event: u.event, timestamp: u.timestamp,
      description: scrubDriver(u.description),
      has_pod: u.has_pod ?? (Array.isArray(pod) && pod.length > 0),
      has_signature: u.has_signature ?? (typeof sig === "string" && sig.length > 0),
      // URLs are only present when the RPC revealed this leg after a postcode match.
      pod_urls: Array.isArray(pod) ? pod : null,
      signature_url: typeof sig === "string" && sig ? sig : null,
    };
  });
};

const dateOnly = (v: unknown): string | null => (typeof v === "string" && v ? v.slice(0, 10) : null);

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
      raw = { tracking: u.searchParams.get("tracking") ?? u.searchParams.get("ref") ?? "", postcode: u.searchParams.get("postcode") ?? undefined };
    } else {
      raw = await req.json().catch(() => ({}));
    }
    // Retail themes use `ref`; preserve `tracking` for existing API callers.
    const parsed = Input.safeParse({ ...raw, tracking: raw?.tracking ?? raw?.ref });
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
    const rateLimited = !!d.rate_limited;
    const verified = !!postcode && !d.verification_failed && !rateLimited;
    order.bikes = Array.isArray(d.bikes)
      ? d.bikes.map((b: any) => ({ brand: b?.brand ?? null, model: b?.model ?? null, type: b?.type ?? null }))
      : [];
    order.events = cleanEvents(d.tracking_events);

    const status = String(d.status ?? "");
    const body = {
      found: true,
      postcode_verified: verified,
      rate_limited: rateLimited,
      ...(postcode && !verified
        ? { postcode_error: rateLimited ? "Too many attempts. Please try again in a few minutes." : "Incorrect postcode. Please try again." }
        : {}),
      // Flat convenience fields for simple themes; `order` keeps the full detail.
      tracking_number: d.tracking_number ?? tracking,
      status,
      status_label: STATUS_LABELS[status] ?? status,
      collected: !!d.order_collected,
      delivered: !!d.order_delivered || status === "delivered",
      collection_date: dateOnly(d.scheduled_pickup_date),
      delivery_date: dateOnly(d.scheduled_delivery_date),
      collection_timeslot: d.pickup_timeslot ?? null,
      delivery_timeslot: d.delivery_timeslot ?? null,
      order,
    };

    return json(
      body,
      rateLimited ? 429 : 200,
      postcode ? { "Cache-Control": "no-store" } : { "Cache-Control": "public, max-age=60" },
    );
  } catch (_e) {
    console.error("public-track error");
    return json({ found: false, error: "Lookup failed, please try again" }, 500);
  }
});
