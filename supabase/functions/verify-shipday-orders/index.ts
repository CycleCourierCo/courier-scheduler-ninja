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

    const results: Record<string, boolean> = {};

    // Check each Shipday order ID
    for (const id of shipdayIds) {
      try {
        const response = await fetch(`https://api.shipday.com/orders/${id}`, {
          method: "GET",
          headers: {
            "Authorization": `Basic ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.log(`Shipday order ${id}: HTTP ${response.status}`);
          results[id] = false;
          continue;
        }

        const body = await response.text();
        console.log(`Shipday order ${id} response: ${body.substring(0, 500)}`);

        try {
          const data = JSON.parse(body);
          if (!data || (Array.isArray(data) && data.length === 0)) {
            results[id] = false;
          } else if (Array.isArray(data)) {
            results[id] = data.length > 0 && !!data[0]?.orderId;
          } else if (typeof data === 'object') {
            results[id] = !!data.orderId;
          } else {
            results[id] = false;
          }
        } catch {
          results[id] = false;
        }
      } catch {
        results[id] = false;
      }
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
