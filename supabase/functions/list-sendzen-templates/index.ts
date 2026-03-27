import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SENDZEN_API_KEY = Deno.env.get("SENDZEN_API_KEY");
    const WABA_ID = Deno.env.get("SENDZEN_WABA_ID");

    if (!SENDZEN_API_KEY || !WABA_ID) {
      console.error("Missing SENDZEN_API_KEY or SENDZEN_WABA_ID");
      return new Response(
        JSON.stringify({ error: "WhatsApp service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(
      `https://api.sendzen.io/v1/${WABA_ID}/message_templates`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${SENDZEN_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SendZen templates API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: "Failed to fetch templates" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Filter to only APPROVED templates and extract relevant fields
    const templates = (data.data || data || [])
      .filter((t: any) => t.status === "APPROVED")
      .map((t: any) => ({
        name: t.name,
        language: t.language,
        category: t.category,
        components: t.components,
      }));

    return new Response(
      JSON.stringify({ templates }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("list-sendzen-templates error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
