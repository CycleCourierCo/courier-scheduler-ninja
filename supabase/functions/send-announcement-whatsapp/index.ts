import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `+${digits}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { phone, message, templateName, langCode, parameters } = body;

    if (!phone || typeof phone !== "string" || phone.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Valid phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isTemplateMode = !!templateName;

    if (!isTemplateMode) {
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "Message text is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (message.length > 4096) {
        return new Response(
          JSON.stringify({ error: "Message exceeds 4096 character limit" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      if (!langCode) {
        return new Response(
          JSON.stringify({ error: "Language code is required for template messages" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const SENDZEN_API_KEY = Deno.env.get("SENDZEN_API_KEY");
    if (!SENDZEN_API_KEY) {
      console.error("SENDZEN_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "WhatsApp service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    const fromNumber = "441217980767";

    const sendWhatsApp = async () => {
      try {
        let payload: Record<string, unknown>;

        if (isTemplateMode) {
          const components: Record<string, unknown>[] = [];
          if (parameters && Array.isArray(parameters) && parameters.length > 0) {
            components.push({
              type: "body",
              parameters: parameters.map((p: { parameter_name: string; text: string }) => ({
                type: "text",
                parameter_name: p.parameter_name,
                text: p.text || "N/A",
              })),
            });
          }

          payload = {
            to: normalizedPhone,
            from: fromNumber,
            type: "template",
            template: {
              name: templateName,
              lang_code: langCode,
              components,
            },
          };
        } else {
          payload = {
            to: normalizedPhone,
            from: fromNumber,
            type: "text",
            text: { body: message.trim() },
          };
        }

        console.log(`Sending WhatsApp ${isTemplateMode ? "template" : "text"} to ${normalizedPhone.slice(0, 6)}***`);

        const response = await fetch("https://api.sendzen.io/v1/messages", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SENDZEN_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`SendZen API error: status ${response.status}`);
          console.error(`Response: ${errorText}`);
        } else {
          console.log(`WhatsApp sent successfully to ${normalizedPhone.slice(0, 6)}***`);
        }
      } catch (err) {
        console.error("Failed to send WhatsApp announcement:", err);
      }
    };

    // @ts-ignore: Deno Deploy API
    EdgeRuntime.waitUntil(sendWhatsApp());

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-announcement-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
