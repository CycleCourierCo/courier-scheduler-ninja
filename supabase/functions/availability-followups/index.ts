// Sends the follow-up messages after a customer submits availability dates.
// Runs on the server so closing the page right after Submit cannot lose them.
// Public (called from availability pages), but only acts when that side's
// dates were confirmed in the last 15 minutes, and reads dates from the order.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FERRY = { displayName: "Ferry hand-off", email: "Operations.man@cityairexpress.com" };
const WINDOW_MS = 15 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isNiAddress = (a: any) =>
  String(a?.region || a?.state || "").toLowerCase().includes("northern ireland") ||
  /^bt\d/i.test(String(a?.zipCode || "").replace(/\s+/g, ""));

const niDirection = (o: any): "outbound" | "inbound" | null => {
  if (o.ni_direction === "outbound" || o.ni_direction === "inbound") return o.ni_direction;
  if (isNiAddress(o.receiver?.address)) return "outbound";
  if (isNiAddress(o.sender?.address)) return "inbound";
  if (o.is_northern_ireland === true) return "outbound";
  return null;
};

const toDates = (v: any): string[] =>
  (Array.isArray(v) ? v : []).filter((d) => typeof d === "string").map((d: string) => d.slice(0, 10));

async function invoke(fn: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`${fn} failed`, res.status);
  await res.text().catch(() => "");
}

async function run(o: any, side: "sender" | "receiver", baseUrl: string) {
  const dir = niDirection(o);
  const niReceiver = { name: o.receiver?.name, email: o.receiver?.email, phone: o.receiver?.phone, address: o.receiver?.address };
  const tasks: Promise<void>[] = [];

  if (side === "sender") {
    if (o.sender?.email) {
      tasks.push(invoke("send-email", {
        to: dir === "inbound" ? [o.sender.email, FERRY.email] : [o.sender.email],
        emailType: "sender_dates_confirmed",
        name: o.sender.name || "Customer",
        trackingNumber: o.tracking_number,
        selectedDates: toDates(o.pickup_date),
        baseUrl,
      }));
    }
    if (o.needs_inspection !== true && o.receiver?.email) {
      const out = dir === "outbound";
      tasks.push(invoke("send-email", {
        to: out ? FERRY.email : o.receiver.email,
        name: out ? FERRY.displayName : (o.receiver.name || "Receiver"),
        orderId: o.id,
        baseUrl,
        emailType: "receiver",
        item: { name: `${o.bike_brand || ""} ${o.bike_model || ""}`.trim(), quantity: 1, price: 0 },
        trackingNumber: o.tracking_number,
        niDirection: out ? "outbound" : undefined,
        niReceiver: out ? niReceiver : undefined,
      }));
    }
    if (dir === "inbound") tasks.push(invoke("send-ferry-partner-notification", { orderId: o.id }));
  } else if (o.receiver?.email) {
    const out = dir === "outbound";
    tasks.push(invoke("send-email", {
      to: out ? FERRY.email : o.receiver.email,
      emailType: "receiver_dates_confirmed",
      name: out ? FERRY.displayName : (o.receiver.name || "Customer"),
      trackingNumber: o.tracking_number,
      selectedDates: toDates(o.delivery_date),
      baseUrl,
      niDirection: out ? "outbound" : undefined,
      niReceiver: out ? niReceiver : undefined,
    }));
  }
  const results = await Promise.allSettled(tasks);
  console.log("availability-followups done", side, results.map((r) => r.status).join(","));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, side } = body ?? {};
    let baseUrl = typeof body?.baseUrl === "string" ? body.baseUrl : "";
    if (typeof orderId !== "string" || !UUID.test(orderId) || (side !== "sender" && side !== "receiver")) {
      return json({ error: "orderId and side are required" }, 400);
    }
    if (!/^https:\/\/([a-z0-9-]+\.)*(cyclecourierco\.com|lovable\.app)$/i.test(baseUrl)) {
      baseUrl = "https://booking.cyclecourierco.com";
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: o, error } = await db.from("orders")
      .select("id, tracking_number, sender, receiver, needs_inspection, ni_direction, is_northern_ireland, bike_brand, bike_model, pickup_date, delivery_date, sender_confirmed_at, receiver_confirmed_at")
      .eq("id", orderId).maybeSingle();
    if (error || !o) return json({ error: "Order not found" }, 404);

    const confirmedAt = side === "sender" ? o.sender_confirmed_at : o.receiver_confirmed_at;
    if (!confirmedAt || Date.now() - new Date(confirmedAt).getTime() > WINDOW_MS) {
      return json({ skipped: "not_recently_confirmed" }, 409);
    }

    // @ts-ignore EdgeRuntime is provided by Supabase
    EdgeRuntime.waitUntil(run(o, side, baseUrl));
    return json({ accepted: true }, 202);
  } catch (e) {
    console.error("availability-followups error", (e as Error).message);
    return json({ error: "Internal error" }, 500);
  }
});
