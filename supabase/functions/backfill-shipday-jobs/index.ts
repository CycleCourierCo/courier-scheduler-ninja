import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { corsHeaders } from "../_shared/cors.ts";
import { initSentry, captureException } from "../_shared/sentry.ts";
import { requireAdminOrCronAuth, createAuthErrorResponse } from "../_shared/auth.ts";

/**
 * Self-healing safety net: finds recent, active orders that are missing a
 * required Shipday leg and creates only the missing leg.
 *
 * Rules honoured (so nothing is duplicated or wrongly created):
 *  - Box My Bike orders only ever get a pickup leg.
 *  - Orders already collected only get the delivery leg.
 *  - Cancelled/delivered orders and test accounts are skipped.
 */
const TERMINAL_STATUSES = new Set([
  "cancelled",
  "delivered",
  "delivered_by_3p",
  "delivered_ni",
]);

serve(async (req) => {
  initSentry("backfill-shipday-jobs");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const auth = await requireAdminOrCronAuth(req);
  if (!auth.success) return createAuthErrorResponse(auth.error!, auth.status!);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const days = Math.min(Math.max(Number(body?.days) || 30, 1), 365);
    const dryRun = body?.dryRun === true;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Server-side filtered + paginated so we never hit the 1,000-row ceiling.
    const pageSize = 500;
    const candidates: Array<Record<string, any>> = [];
    for (let page = 0; page < 20; page++) {
      const { data, error } = await admin
        .from("orders")
        .select(
          "id, tracking_number, status, user_id, is_box_my_bike, order_collected, shipday_pickup_id, shipday_delivery_id, created_at"
        )
        .gte("created_at", since)
        .or("shipday_pickup_id.is.null,shipday_delivery_id.is.null")
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (error) {
        console.error("Failed to page orders for Shipday backfill");
        return json({ error: "Failed to load orders" }, 500);
      }
      if (!data || data.length === 0) break;
      candidates.push(...data);
      if (data.length < pageSize) break;
    }

    // Exclude test accounts in one lookup.
    const userIds = [...new Set(candidates.map((o) => o.user_id).filter(Boolean))];
    const testAccounts = new Set<string>();
    for (let i = 0; i < userIds.length; i += 200) {
      const chunk = userIds.slice(i, i + 200);
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, is_test_account")
        .in("id", chunk);
      for (const p of profiles || []) {
        if (p.is_test_account) testAccounts.add(p.id);
      }
    }

    const work: Array<{ id: string; tracking_number: string | null; jobType?: "pickup" | "delivery" }> = [];

    for (const order of candidates) {
      if (TERMINAL_STATUSES.has(String(order.status))) continue;
      if (order.user_id && testAccounts.has(order.user_id)) continue;

      const collected = order.order_collected === true;
      const boxMyBike = order.is_box_my_bike === true;

      const needsPickup = !order.shipday_pickup_id && !collected;
      const needsDelivery = !boxMyBike && !order.shipday_delivery_id;

      if (!needsPickup && !needsDelivery) continue;

      work.push({
        id: order.id,
        tracking_number: order.tracking_number,
        jobType: needsPickup && needsDelivery ? undefined : needsPickup ? "pickup" : "delivery",
      });
    }

    if (dryRun) {
      return json({ success: true, dryRun: true, missing: work.length, orders: work });
    }

    let created = 0;
    let failed = 0;
    const failures: Array<{ tracking_number: string | null; status: number }> = [];

    // Bounded concurrency so we never hammer Shipday.
    const concurrency = 3;
    for (let i = 0; i < work.length; i += concurrency) {
      const batch = work.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (item) => {
          try {
            const res = await fetch(`${supabaseUrl}/functions/v1/create-shipday-order`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({ orderId: item.id, jobType: item.jobType }),
            });
            if (res.ok) {
              created++;
            } else {
              failed++;
              failures.push({ tracking_number: item.tracking_number, status: res.status });
            }
            await res.text().catch(() => "");
          } catch (e) {
            failed++;
            failures.push({ tracking_number: item.tracking_number, status: 0 });
            console.error("Shipday backfill call failed for an order");
            captureException(e as Error, { context: "backfill_shipday_jobs_call" });
          }
        })
      );
    }

    console.log(`Shipday backfill complete: scanned=${candidates.length} missing=${work.length} created=${created} failed=${failed}`);

    return json({ success: true, scanned: candidates.length, missing: work.length, created, failed, failures });
  } catch (err) {
    console.error("backfill-shipday-jobs failed:", err instanceof Error ? err.message : "unknown");
    captureException(err as Error, { context: "backfill_shipday_jobs" });
    return json({ error: "Internal server error" }, 500);
  }
});
