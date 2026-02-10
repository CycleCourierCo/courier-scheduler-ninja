import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const response = await fetch("https://api.shipday.com/orders", {
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

    const results: Record<string, boolean> = {};
    for (const id of shipdayIds) {
      results[id] = activeIdSet.has(String(id));
    }

    return new Response(
      JSON.stringify({ results }),
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
