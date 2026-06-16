import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ShipdayApiOrder = {
  orderId: number | string;
  orderNumber?: string;
  orderStatus?: any;
  carrier?: { name?: string } | null;
  podUrls?: string[] | null;
  signatureUrl?: string | null;
};

function extractStatus(o: ShipdayApiOrder): string {
  const os: any = o.orderStatus;
  const candidates: any[] = [
    os?.orderState,
    os?.orderStatus,
    typeof os === "string" ? os : null,
    (o as any).order_status,
    (o as any).status,
  ];
  if (os && typeof os === "object" && os.incomplete === true) {
    candidates.push("INCOMPLETE");
  }
  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c).length > 0) {
      return String(c).toUpperCase();
    }
  }
  return "";
}

async function fetchActive(apiKey: string): Promise<ShipdayApiOrder[]> {
  const res = await fetch("https://api.shipday.com/orders", {
    headers: { Authorization: `Basic ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) {
    console.warn(`Shipday GET /orders HTTP ${res.status}`);
    return [];
  }
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

async function fetchByStatus(
  apiKey: string,
  orderStatus: string,
  startTime: string,
  endTime: string
): Promise<ShipdayApiOrder[]> {
  const all: ShipdayApiOrder[] = [];
  const batch = 100;
  let cursor = 1;
  for (let i = 0; i < 50; i++) {
    const res = await fetch("https://api.shipday.com/orders/query", {
      method: "POST",
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        orderStatus,
        startTime,
        endTime,
        startCursor: cursor,
        endCursor: cursor + batch - 1,
      }),
    });
    if (!res.ok) {
      console.warn(`Shipday /orders/query ${orderStatus} HTTP ${res.status}`);
      break;
    }
    const json = await res.json();
    const items: ShipdayApiOrder[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.orders)
      ? json.orders
      : [];
    if (items.length === 0) break;
    all.push(...items);
    if (items.length < batch) break;
    cursor += batch;
  }
  return all;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SHIPDAY_API_KEY = Deno.env.get("SHIPDAY_API_KEY");
    if (!SHIPDAY_API_KEY) {
      return new Response(JSON.stringify({ error: "SHIPDAY_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Auth: admin only ----
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const hours = Math.min(Math.max(Number(body?.hours) || 24, 1), 168);
    const suppressEmails: boolean = body?.suppressEmails === true;

    const now = new Date();
    const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const startTime = start.toISOString().replace(/\.\d{3}Z$/, "Z");
    const endTime = now.toISOString().replace(/\.\d{3}Z$/, "Z");

    console.log(`Reconcile window ${startTime} → ${endTime}`);

    const [active, completed, incomplete] = await Promise.all([
      fetchActive(SHIPDAY_API_KEY),
      fetchByStatus(SHIPDAY_API_KEY, "ALREADY_DELIVERED", startTime, endTime),
      fetchByStatus(SHIPDAY_API_KEY, "INCOMPLETE", startTime, endTime),
    ]);

    // Diagnostic: log one sample order per endpoint so we can see actual payload shape
    if (active[0]) console.log("Sample active order:", JSON.stringify(active[0]));
    if (completed[0]) console.log("Sample completed order:", JSON.stringify(completed[0]));
    if (incomplete[0]) console.log("Sample incomplete order:", JSON.stringify(incomplete[0]));

    // Dedupe by orderId, preferring most recent (completed/incomplete > active for same id)
    const merged = new Map<string, ShipdayApiOrder>();
    for (const o of active) merged.set(String(o.orderId), o);
    for (const o of completed) merged.set(String(o.orderId), o);
    for (const o of incomplete) merged.set(String(o.orderId), o);

    console.log(
      `Fetched Shipday: active=${active.length}, completed=${completed.length}, incomplete=${incomplete.length}, merged=${merged.size}`
    );

    const shipdayIds = [...merged.keys()];

    // Pull local orders matching any of these shipday IDs (chunked to keep URLs small)
    type DbOrder = {
      id: string;
      status: string;
      tracking_events: any;
      shipday_pickup_id: string | null;
      shipday_delivery_id: string | null;
      pickup_date: string[] | null;
      delivery_date: string[] | null;
      order_collected: boolean | null;
      order_delivered: boolean | null;
      collection_confirmation_sent_at: string | null;
      delivery_confirmation_sent_at: string | null;
    };
    const byPickup = new Map<string, DbOrder>();
    const byDelivery = new Map<string, DbOrder>();

    const chunkSize = 100;
    for (let i = 0; i < shipdayIds.length; i += chunkSize) {
      const chunk = shipdayIds.slice(i, i + chunkSize);
      const { data, error } = await admin
        .from("orders")
        .select(
          "id, status, tracking_events, shipday_pickup_id, shipday_delivery_id, pickup_date, delivery_date, order_collected, order_delivered, collection_confirmation_sent_at, delivery_confirmation_sent_at"
        )
        .or(
          `shipday_pickup_id.in.(${chunk.join(",")}),shipday_delivery_id.in.(${chunk.join(",")})`
        );
      if (error) {
        console.error("DB lookup error:", error);
        continue;
      }
      for (const row of (data || []) as DbOrder[]) {
        if (row.shipday_pickup_id) byPickup.set(String(row.shipday_pickup_id), row);
        if (row.shipday_delivery_id) byDelivery.set(String(row.shipday_delivery_id), row);
      }
    }

    let scanned = 0;
    let updated = 0;
    let skippedNoMatch = 0;
    let skippedAlreadySynced = 0;
    let skippedUnknownStatus = 0;
    const errors: Array<{ shipdayId: string; error: string }> = [];
    const changes: Array<{ shipdayId: string; orderId: string; leg: string; from: string; to: string; event: string }> = [];
    const emailsTriggered = { collection: 0, delivery: 0 };
    let extractDebugLogged = 0;

    for (const [sid, sOrder] of merged) {
      scanned++;
      let isPickup = byPickup.has(sid);
      let dbOrder = isPickup ? byPickup.get(sid)! : byDelivery.get(sid);
      if (!dbOrder) {
        skippedNoMatch++;
        continue;
      }
      if (!isPickup) isPickup = false; // it's delivery

      const sStatus = extractStatus(sOrder);
      if (extractDebugLogged < 5) {
        console.log(`extractStatus sample: shipdayId=${sid} status="${sStatus}"`);
        extractDebugLogged++;
      }

      // Map Shipday canonical status to (event, newStatus)
      let event: string | null = null;
      let newStatus: string = dbOrder.status;
      let description = "";

      if (
        sStatus === "ALREADY_DELIVERED" ||
        sStatus === "COMPLETED" ||
        sStatus === "DELIVERED" ||
        sStatus === "PICKED_UP"
      ) {
        event = "ORDER_COMPLETED";
        newStatus = isPickup ? "collected" : "delivered";
        description = isPickup ? "Driver has collected the bike" : "Driver has delivered the bike";
      } else if (
        sStatus === "STARTED" ||
        sStatus === "ON_THE_WAY" ||
        sStatus === "DISPATCHED" ||
        sStatus === "ACCEPTED_AND_STARTED"
      ) {
        event = "ORDER_ONTHEWAY";
        newStatus = isPickup ? "driver_to_collection" : "driver_to_delivery";
        description = isPickup
          ? "Driver is on the way to collect the bike"
          : "Driver is on the way to deliver the bike";
      } else if (
        sStatus === "INCOMPLETE" ||
        sStatus === "FAILED_DELIVERY" ||
        sStatus === "FAILED" ||
        sStatus === "CANCELLED"
      ) {
        event = "ORDER_FAILED";
        const pickupDates = dbOrder.pickup_date;
        const deliveryDates = dbOrder.delivery_date;
        const senderSet = Array.isArray(pickupDates) && pickupDates.length > 0;
        const receiverSet = Array.isArray(deliveryDates) && deliveryDates.length > 0;
        const isCollected = dbOrder.order_collected === true || dbOrder.status === "collected";
        const revert = (includeCollected: boolean) => {
          if (includeCollected && isCollected) return "collected";
          if (senderSet && receiverSet) return "scheduled_dates_pending";
          if (!senderSet) return "sender_availability_pending";
          return "receiver_availability_pending";
        };
        newStatus = isPickup ? revert(false) : revert(true);
        description = isPickup
          ? "Collection attempt failed - rescheduling required"
          : "Delivery attempt failed - rescheduling required";
      } else if (
        sStatus === "ACTIVE" ||
        sStatus === "ASSIGNED" ||
        sStatus === "NOT_ASSIGNED" ||
        sStatus === "NOT_STARTED_YET" ||
        sStatus === ""
      ) {
        skippedUnknownStatus++;
        continue;
      } else {
        console.log(`Unmapped Shipday status "${sStatus}" for shipdayId=${sid} — skipping`);
        skippedUnknownStatus++;
        continue;
      }

      // Idempotency: skip if this (orderId, event) already recorded
      const existingUpdates: any[] = dbOrder.tracking_events?.shipday?.updates || [];
      const alreadyRecorded = existingUpdates.some(
        (u) => String(u.orderId) === sid && u.event === event
      );
      if (alreadyRecorded) {
        skippedAlreadySynced++;
        continue;
      }

      // Build new tracking_events
      const trackingEvents = dbOrder.tracking_events || {};
      const shipdayEvents = trackingEvents.shipday || {
        pickup_id: dbOrder.shipday_pickup_id,
        delivery_id: dbOrder.shipday_delivery_id,
        updates: [],
      };
      shipdayEvents.updates = [
        ...(shipdayEvents.updates || []),
        {
          status: sStatus,
          event,
          timestamp: new Date().toISOString(),
          orderId: sid,
          leg: isPickup ? "pickup" : "delivery",
          description,
          driverName: sOrder.carrier?.name || null,
          source: "reconcile",
        },
      ];
      trackingEvents.shipday = shipdayEvents;

      const updateData: Record<string, unknown> = {
        status: newStatus,
        tracking_events: trackingEvents,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "collected" || newStatus === "driver_to_delivery") {
        updateData.order_collected = true;
      }
      if (newStatus === "delivered") {
        updateData.order_collected = true;
        updateData.order_delivered = true;
      }

      // Suppress retroactive confirmation emails: stamp sent_at so the next
      // legitimate trigger doesn't re-send a day-late confirmation.
      if (newStatus === "collected" && !dbOrder.collection_confirmation_sent_at) {
        updateData.collection_confirmation_sent_at = new Date().toISOString();
      }
      if (newStatus === "delivered" && !dbOrder.delivery_confirmation_sent_at) {
        updateData.delivery_confirmation_sent_at = new Date().toISOString();
      }

      if (event === "ORDER_FAILED") {
        if (isPickup) {
          updateData.scheduled_pickup_date = null;
          updateData.pickup_timeslot = null;
          updateData.shipday_pickup_id = null;
          shipdayEvents.pickup_id = null;
        } else {
          updateData.scheduled_delivery_date = null;
          updateData.delivery_timeslot = null;
          updateData.shipday_delivery_id = null;
          shipdayEvents.delivery_id = null;
        }
        updateData.tracking_events = trackingEvents;
      }

      const { error: upErr } = await admin.from("orders").update(updateData).eq("id", dbOrder.id);
      if (upErr) {
        errors.push({ shipdayId: sid, error: upErr.message });
        continue;
      }

      updated++;
      changes.push({
        shipdayId: sid,
        orderId: dbOrder.id,
        leg: isPickup ? "pickup" : "delivery",
        from: dbOrder.status,
        to: newStatus,
        event,
      });
    }

    const summary = {
      success: true,
      windowHours: hours,
      scanned,
      updated,
      skipped_already_synced: skippedAlreadySynced,
      skipped_no_local_match: skippedNoMatch,
      skipped_unknown_status: skippedUnknownStatus,
      errors,
      changes,
    };
    console.log("Reconcile summary:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Reconcile failed:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
