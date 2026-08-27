import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { corsHeaders } from "../_shared/cors.ts";
import { initSentry, captureException } from "../_shared/sentry.ts";

/**
 * Bridge that lets a signed-in customer's freshly booked order be pushed to
 * Shipday without granting the customer any operational privileges.
 *
 * The caller only has to prove they own the order (or are staff). The actual
 * Shipday mutation is then performed by an internal service-role call to
 * `create-shipday-order`, whose staff-only gate stays untouched.
 */
serve(async (req) => {
  initSentry("sync-order-shipday");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Internal service-to-service invocation is allowed as-is.
    const isInternal = token === serviceKey;

    let userId: string | null = null;
    if (!isInternal) {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data?.user) {
        console.error("Auth failed: invalid or expired token");
        return json({ error: "Unauthorized" }, 401);
      }
      userId = data.user.id;
    }

    let body: { orderId?: string; jobType?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body" }, 400);
    }

    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const jobType =
      body.jobType === "pickup" || body.jobType === "delivery" ? body.jobType : undefined;

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(orderId)) {
      return json({ error: "A valid orderId is required" }, 400);
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, user_id, shipday_pickup_id, shipday_delivery_id, is_box_my_bike, status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error("Failed to load order for Shipday sync");
      return json({ error: "Failed to load order" }, 500);
    }
    if (!order) return json({ error: "Order not found" }, 404);

    // Ownership / staff check
    if (!isInternal) {
      let allowed = order.user_id === userId;
      if (!allowed) {
        for (const role of ["admin", "route_planner", "loader", "sales", "cs_agent"]) {
          const { data: ok } = await admin.rpc("has_role", { _user_id: userId, _role: role });
          if (ok) {
            allowed = true;
            break;
          }
        }
      }
      if (!allowed) {
        console.error("Shipday sync denied: caller does not own the order");
        return json({ error: "Forbidden" }, 403);
      }
    }

    // Nothing to do when both required legs already exist.
    const needsPickup = !order.shipday_pickup_id;
    const needsDelivery = order.is_box_my_bike === true ? false : !order.shipday_delivery_id;
    if (!jobType && !needsPickup && !needsDelivery) {
      return json({ success: true, skipped: true, reason: "already_synced" });
    }

    const effectiveJobType =
      jobType ?? (needsPickup && needsDelivery ? undefined : needsPickup ? "pickup" : "delivery");

    const response = await fetch(`${supabaseUrl}/functions/v1/create-shipday-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ orderId, jobType: effectiveJobType }),
    });

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      console.error("Shipday creation failed", { orderId, status: response.status });
      return json({ error: "Failed to create Shipday jobs", details: payload }, 502);
    }

    return json({ success: true, result: payload });
  } catch (err) {
    console.error("sync-order-shipday failed:", err instanceof Error ? err.message : "unknown");
    captureException(err as Error, { context: "sync_order_shipday" });
    return json({ error: "Internal server error" }, 500);
  }
});
