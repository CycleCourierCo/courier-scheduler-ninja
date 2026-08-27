import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { corsHeaders } from "../_shared/cors.ts";
import { requireOpsAuth, createAuthErrorResponse } from "../_shared/auth.ts";
import { trackedFetch } from "../_shared/integrationLog.ts";
import { initSentry, captureException } from "../_shared/sentry.ts";

/**
 * Cancels an order and tears down its Shipday legs in one atomic-ish step.
 *
 * Why this exists: the old flow deleted Shipday jobs client-side, left the
 * shipday_pickup_id/shipday_delivery_id columns populated and never marked the
 * order as intentionally cancelled — so the 15-minute backfill and the
 * reconcile job could re-create the legs afterwards.
 */
const SHIPDAY_API_KEY = Deno.env.get("SHIPDAY_API_KEY");

interface CancelRequest {
  orderId: string;
  /** Cancel the order even if a Shipday leg could not be deleted. */
  force?: boolean;
}

async function deleteShipdayJob(id: string, leg: "pickup" | "delivery") {
  const res = await trackedFetch("shipday", `delete ${leg}`, `https://api.shipday.com/orders/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${SHIPDAY_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  // 404 = already gone, treat as success.
  if (res.ok || res.status === 404) return { id, leg, deleted: true };
  return { id, leg, deleted: false, status: res.status };
}

serve(async (req) => {
  initSentry("cancel-order");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const auth = await requireOpsAuth(req, ["admin", "route_planner"]);
  if (!auth.success) return createAuthErrorResponse(auth.error!, auth.status!);

  try {
    const { orderId, force }: CancelRequest = await req.json();
    if (!orderId || typeof orderId !== "string") {
      return json({ success: false, error: "orderId is required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: order, error: fetchError } = await admin
      .from("orders")
      .select("id, status, shipday_pickup_id, shipday_delivery_id, tracking_events")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return json({ success: false, error: "Order not found" }, 404);
    }

    const trackingEvents: Record<string, any> = order.tracking_events || {};
    const shipday: Record<string, any> = trackingEvents.shipday || {};

    // Collect every id we know about: flat columns, the tracking block and any
    // ids that only ever appeared inside the webhook update history.
    const pickupIds = new Set<string>();
    const deliveryIds = new Set<string>();
    const add = (set: Set<string>, value: unknown) => {
      if (value === null || value === undefined) return;
      const str = String(value).trim();
      if (str && str !== "null" && str !== "undefined") set.add(str);
    };

    add(pickupIds, order.shipday_pickup_id);
    add(pickupIds, shipday.pickup_id);
    add(deliveryIds, order.shipday_delivery_id);
    add(deliveryIds, shipday.delivery_id);
    for (const update of Array.isArray(shipday.updates) ? shipday.updates : []) {
      if (!update?.orderId) continue;
      add(update.leg === "delivery" ? deliveryIds : pickupIds, update.orderId);
    }

    const results: Array<{ id: string; leg: string; deleted: boolean; status?: number }> = [];

    if ((pickupIds.size || deliveryIds.size) && !SHIPDAY_API_KEY) {
      return json({ success: false, error: "Shipday API key not configured" }, 500);
    }

    for (const id of pickupIds) {
      results.push(await deleteShipdayJob(id, "pickup"));
    }
    for (const id of deliveryIds) {
      results.push(await deleteShipdayJob(id, "delivery"));
    }

    const failedLegs = results.filter((r) => !r.deleted);

    if (failedLegs.length > 0 && !force) {
      return json(
        {
          success: false,
          shipdayCleared: false,
          error:
            "Couldn't remove this order from Shipday, so it hasn't been cancelled. Retry, or cancel anyway and remove it in Shipday manually.",
          failedLegs: failedLegs.map((r) => ({ leg: r.leg, status: r.status ?? 0 })),
        },
        502
      );
    }

    const nowIso = new Date().toISOString();
    const updatedShipday = {
      ...shipday,
      pickup_id: null,
      delivery_id: null,
      cancelled_at: nowIso,
      deleted_ids: {
        pickup: [...pickupIds],
        delivery: [...deliveryIds],
      },
      ...(failedLegs.length > 0 ? { cancel_delete_failed: true } : {}),
    };

    const { data: updated, error: updateError } = await admin
      .from("orders")
      .update({
        status: "cancelled",
        shipday_pickup_id: null,
        shipday_delivery_id: null,
        tracking_events: { ...trackingEvents, shipday: updatedShipday },
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to mark order cancelled");
      return json({ success: false, error: "Failed to update order status" }, 500);
    }

    return json({
      success: true,
      order: updated,
      shipdayCleared: failedLegs.length === 0,
      deleted: results.filter((r) => r.deleted).length,
      failedLegs: failedLegs.map((r) => ({ leg: r.leg, status: r.status ?? 0 })),
    });
  } catch (err) {
    console.error("cancel-order failed:", err instanceof Error ? err.message : "unknown");
    captureException(err as Error, { context: "cancel_order" });
    return json({ success: false, error: "Internal server error" }, 500);
  }
});
