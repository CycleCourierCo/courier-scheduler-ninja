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

        results[id] = response.ok;
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
