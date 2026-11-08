import { corsHeaders } from "../_shared/cors.ts";
import { requireOpsAuth, createAuthErrorResponse } from "../_shared/auth.ts";
import { trackedFetch } from "../_shared/integrationLog.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireOpsAuth(req, ['admin', 'route_planner']);
  if (!auth.success) {
    return createAuthErrorResponse(auth.error!, auth.status!);
  }

  try {
    const { shipdayIds } = await req.json();

    if (!Array.isArray(shipdayIds) || shipdayIds.length === 0) {
      return new Response(
        JSON.stringify({ results: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("SHIPDAY_API_KEY");
    if (!apiKey) {
      throw new Error("SHIPDAY_API_KEY not configured");
    }

    // Fetch all active orders in one call
    const response = await trackedFetch("shipday", "list orders", "https://api.shipday.com/orders", {
      method: "GET",
      headers: {
        "Authorization": `Basic ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Shipday API returned HTTP ${response.status}`);
    }

    const activeOrders = await response.json();
    console.log(`Shipday returned ${Array.isArray(activeOrders) ? activeOrders.length : 0} active orders`);

    // Build a Set of active orderId strings
    const activeIdSet = new Set<string>(
      Array.isArray(activeOrders)
        ? activeOrders.map((o: any) => String(o.orderId))
        : []
    );

    // Keep the pickup ("restaurant") address per job so callers can spot jobs
    // pointing at the wrong place (e.g. an inbound NI collection created against
    // the Northern Irish address instead of the ferry hand-off point).
    const pickupAddressById = new Map<string, string>();
    if (Array.isArray(activeOrders)) {
      for (const o of activeOrders) {
        const addr =
          o?.pickup?.address?.street ||
          o?.pickup?.address ||
          o?.restaurantAddress ||
          o?.restaurant?.address ||
          "";
        pickupAddressById.set(String(o.orderId), typeof addr === "string" ? addr : JSON.stringify(addr));
      }
    }

    // Keep the planned day per job so the route builder can spot a job that is
    // on Shipday but still sitting on an older day (e.g. left over from a
    // previous route) and move it onto the route's date.
    const dateById = new Map<string, string>();
    if (Array.isArray(activeOrders)) {
      for (const o of activeOrders) {
        const raw =
          o?.activityLog?.expectedDeliveryDate ||
          o?.expectedDeliveryDate ||
          o?.activityLog?.expectedPickupDate ||
          o?.expectedPickupDate ||
          "";
        const match = typeof raw === "string" ? raw.match(/^\d{4}-\d{2}-\d{2}/) : null;
        if (match) dateById.set(String(o.orderId), match[0]);
      }
    }

    const results: Record<string, boolean> = {};
    const pickupAddresses: Record<string, string> = {};
    const expectedDates: Record<string, string> = {};
    for (const id of shipdayIds) {
      results[id] = activeIdSet.has(String(id));
      const addr = pickupAddressById.get(String(id));
      if (addr) pickupAddresses[id] = addr;
      const day = dateById.get(String(id));
      if (day) expectedDates[id] = day;
    }

    return new Response(
      JSON.stringify({ results, pickupAddresses, expectedDates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error verifying Shipday orders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
