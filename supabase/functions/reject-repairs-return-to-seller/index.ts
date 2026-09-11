import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";
import { trackedFetch, trackResend } from "../_shared/integrationLog.ts";
import { initSentry, captureException } from "../_shared/sentry.ts";

/**
 * Customer chose to decline every recommended repair and have the bike sent
 * back to the seller.
 *
 * In one step this:
 *  - declines every outstanding repair on the inspection and marks the
 *    inspection "ship as is" (no workshop work will be booked),
 *  - creates a return job for the same account with the legs swapped, already
 *    marked as collected and holding the original bay allocation,
 *  - cancels the original job and deletes its Shipday legs so nothing can
 *    re-create them,
 *  - emails the office so someone can plan the return leg.
 */

const SHIPDAY_API_KEY = Deno.env.get("SHIPDAY_API_KEY");
const BASE_URL = "https://booking.cyclecourierco.com";
const FROM = "CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>";
const REPLY_TO = "Info@cyclecourierco.com";
const ADMIN_TO = "Info@cyclecourierco.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

async function deleteShipdayJob(id: string, leg: "pickup" | "delivery") {
  const res = await trackedFetch("shipday", `delete ${leg}`, `https://api.shipday.com/orders/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${SHIPDAY_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (res.ok || res.status === 404) return { id, leg, deleted: true };
  return { id, leg, deleted: false, status: res.status };
}

serve(async (req) => {
  initSentry("reject-repairs-return-to-seller");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    let userId: string | null = null;
    if (token !== serviceRoleKey) {
      const { data: { user }, error: authError } = await admin.auth.getUser(token);
      if (authError || !user) return json({ error: "Unauthorized" }, 401);
      userId = user.id;
    }

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    const force = body?.force === true;
    if (!UUID.test(orderId)) return json({ error: "A valid orderId is required" }, 400);

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(
        "id, user_id, status, tracking_number, customer_order_number, sender, receiver, bikes, bike_quantity, bike_brand, bike_model, bike_type, bike_value, storage_locations, current_site_id, shipday_pickup_id, shipday_delivery_id, tracking_events, returned_to_seller_at, delivery_instructions"
      )
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json({ error: "Order not found" }, 404);

    // Owner, or internal staff acting on their behalf.
    if (userId && order.user_id !== userId) {
      const roles = ["admin", "customer_service", "mechanic"];
      const checks = await Promise.all(
        roles.map((role) => admin.rpc("has_role", { _user_id: userId, _role: role }))
      );
      const isStaff = checks.some((c) => c.data === true);
      if (!isStaff) return json({ error: "Forbidden" }, 403);
    }

    if (order.returned_to_seller_at) {
      const { data: existing } = await admin
        .from("orders")
        .select("id, tracking_number")
        .eq("returned_from_order_id", order.id)
        .maybeSingle();
      return json({
        success: true,
        alreadyReturned: true,
        returnOrderId: existing?.id ?? null,
        returnTrackingNumber: existing?.tracking_number ?? null,
      });
    }

    if (order.status === "cancelled") {
      return json({ error: "This job has already been cancelled" }, 409);
    }

    const nowIso = new Date().toISOString();

    // 1. Decline every repair that hasn't already been carried out.
    const { data: issues } = await admin
      .from("inspection_issues")
      .select("id, status, issue_description, estimated_cost")
      .eq("order_id", order.id);

    const outstanding = (issues || []).filter((i: any) =>
      ["pending", "approved"].includes(String(i.status))
    );

    if (outstanding.length > 0) {
      const { error: declineError } = await admin
        .from("inspection_issues")
        .update({
          status: "declined",
          customer_response: "Declined — returning to seller",
          customer_responded_at: nowIso,
        })
        .in("id", outstanding.map((i: any) => i.id));
      if (declineError) throw declineError;
    }

    // The bike leaves as it arrived — nothing gets repaired.
    const { data: inspection } = await admin
      .from("bicycle_inspections")
      .select("id, status")
      .eq("order_id", order.id)
      .maybeSingle();

    if (inspection?.id) {
      await admin
        .from("bicycle_inspections")
        .update({ status: "ship_as_is", updated_at: nowIso })
        .eq("id", inspection.id);
    }

    // 2. Create the return job (legs swapped) for the same account.
    const returnSender = order.receiver;
    const returnReceiver = order.sender;

    let returnTrackingNumber: string | null = null;
    try {
      const trackRes = await fetch(`${supabaseUrl}/functions/v1/generate-tracking-numbers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify({
          generateSingle: true,
          senderName: (returnSender as any)?.name || "RETURN",
          receiverZipCode: (returnReceiver as any)?.address?.zipCode || "000",
        }),
      });
      const trackData = await trackRes.json().catch(() => null);
      returnTrackingNumber = trackData?.trackingNumber || null;
    } catch (_e) {
      returnTrackingNumber = null;
    }

    if (!returnTrackingNumber) {
      return json({ success: false, error: "Couldn't create a reference for the return job" }, 502);
    }

    const { data: returnOrder, error: returnError } = await admin
      .from("orders")
      .insert({
        user_id: order.user_id,
        sender: returnSender,
        receiver: returnReceiver,
        bikes: order.bikes,
        bike_quantity: order.bike_quantity || 1,
        bike_brand: order.bike_brand,
        bike_model: order.bike_model,
        bike_type: order.bike_type,
        bike_value: order.bike_value,
        customer_order_number: order.customer_order_number
          ? `${order.customer_order_number}-RETURN`
          : null,
        delivery_instructions: `Return to seller after repairs were declined (original job #${order.tracking_number}).`,
        needs_inspection: false,
        needs_payment_on_collection: false,
        is_bike_swap: false,
        is_ebay_order: false,
        status: "collected",
        order_collected: true,
        storage_locations: order.storage_locations,
        current_site_id: order.current_site_id,
        returned_from_order_id: order.id,
        tracking_number: returnTrackingNumber,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id, tracking_number")
      .single();
    if (returnError) throw returnError;

    // 3. Tear down the original job's Shipday legs.
    const trackingEvents: Record<string, any> = order.tracking_events || {};
    const shipday: Record<string, any> = trackingEvents.shipday || {};
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
    if ((pickupIds.size || deliveryIds.size) && SHIPDAY_API_KEY) {
      for (const id of pickupIds) results.push(await deleteShipdayJob(id, "pickup"));
      for (const id of deliveryIds) results.push(await deleteShipdayJob(id, "delivery"));
    }
    const failedLegs = results.filter((r) => !r.deleted);

    const { error: cancelError } = await admin
      .from("orders")
      .update({
        status: "cancelled",
        shipday_pickup_id: null,
        shipday_delivery_id: null,
        storage_locations: null,
        returned_to_seller_at: nowIso,
        updated_at: nowIso,
        tracking_events: {
          ...trackingEvents,
          shipday: {
            ...shipday,
            pickup_id: null,
            delivery_id: null,
            cancelled_at: nowIso,
            deleted_ids: { pickup: [...pickupIds], delivery: [...deliveryIds] },
            ...(failedLegs.length > 0 ? { cancel_delete_failed: true } : {}),
          },
          returned_to_seller: {
            at: nowIso,
            return_order_id: returnOrder.id,
            return_tracking_number: returnOrder.tracking_number,
          },
        },
      })
      .eq("id", order.id);
    if (cancelError) throw cancelError;

    // 4. Tell the office, without holding up the customer's response.
    const notify = async () => {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return;
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("name, email, is_test_account")
          .eq("id", order.user_id)
          .maybeSingle();
        if (profile?.is_test_account === true) return;

        const bike = [order.bike_brand, order.bike_model].filter(Boolean).join(" ") || "the bike";
        const bays = Array.isArray(order.storage_locations)
          ? order.storage_locations
              .map((a: any) => a?.bay || a?.bay_name || a?.location || "")
              .filter(Boolean)
              .join(", ")
          : "";

        const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.5">
            <p><strong>The customer declined all repairs and asked for the bike to go back to the seller.</strong></p>
            <p>Original job <strong>#${esc(order.tracking_number)}</strong> — ${esc(bike)}<br/>
            Customer: ${esc(profile?.name || "Unknown")}</p>
            <p>Return job <strong>#${esc(returnOrder.tracking_number)}</strong> has been created and marked as collected${
              bays ? `, held in ${esc(bays)}` : ""
            }.</p>
            <p>${outstanding.length} repair${outstanding.length === 1 ? "" : "s"} declined. The original job has been cancelled${
              failedLegs.length > 0 ? " but its Shipday jobs could not all be deleted — please clear them manually" : " and removed from Shipday"
            }.</p>
            <p style="margin:20px 0"><a href="${BASE_URL}/order/${returnOrder.id}" style="background:#0f766e;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">Open the return job</a></p>
            <p style="font-size:13px;color:#4b5563">CCC - Cycle Courier Co.</p>
          </div>`;

        const resend = trackResend(new Resend(resendKey), "return to seller notification");
        await resend.emails.send({
          from: FROM,
          to: [ADMIN_TO],
          subject: `Returning to seller — job #${order.tracking_number}`,
          html,
          reply_to: REPLY_TO,
        });
      } catch (e) {
        console.error("Return-to-seller notification failed");
      }
    };

    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(notify());
    else await notify();

    return json({
      success: true,
      declined: outstanding.length,
      returnOrderId: returnOrder.id,
      returnTrackingNumber: returnOrder.tracking_number,
      shipdayCleared: failedLegs.length === 0,
      failedLegs: failedLegs.map((r) => ({ leg: r.leg, status: r.status ?? 0 })),
      force,
    });
  } catch (error) {
    console.error(
      "reject-repairs-return-to-seller failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    captureException(error as Error, { context: "reject_repairs_return_to_seller" });
    return json({ success: false, error: "Couldn't complete the return. Please try again." }, 500);
  }
});
