import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendZenRequest {
  orderId: string;
  type: "collection_timeslots" | "delivery_timeslot" | "grouped_timeslot" | "review";
  recipientType: "sender" | "receiver";
  deliveryTime?: string; // "HH:MM"
  collectionJobList?: string;
  deliveryJobList?: string;
}

function formatDateForTemplate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const localDate = new Date(year, month, day);
  return localDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function calculateEndTime(startTime: string): string {
  const [h, m] = startTime.split(":").map(Number);
  const endHour = Math.min(23, h + 3);
  return `${String(endHour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `+${digits}`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      orderId,
      type,
      recipientType,
      deliveryTime,
      collectionJobList,
      deliveryJobList,
    }: SendZenRequest = await req.json();

    console.log(`SendZen request: type=${type}, orderId=${orderId}, recipientType=${recipientType}`);

    const sendzenApiKey = Deno.env.get("SENDZEN_API_KEY");
    if (!sendzenApiKey) {
      return new Response(
        JSON.stringify({ error: "SendZen API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order not found:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get contact based on recipientType
    const contact = recipientType === "sender" ? order.sender : order.receiver;
    if (!contact?.phone) {
      return new Response(
        JSON.stringify({ error: `No phone number found for ${recipientType}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phone = normalizePhone(contact.phone);
    const fromNumber = "441217980767";

    // Build the SendZen API request based on template type
    let sendzenBody: any;

    if (type === "collection_timeslots" || type === "delivery_timeslot") {
      // Individual timeslot templates
      const scheduledDate = recipientType === "sender"
        ? order.scheduled_pickup_date
        : order.scheduled_delivery_date;

      if (!scheduledDate || !deliveryTime) {
        return new Response(
          JSON.stringify({ error: "Missing scheduled date or delivery time" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedDate = formatDateForTemplate(scheduledDate);
      const startTime = deliveryTime;
      const endTime = calculateEndTime(deliveryTime);
      const bikeBrand = order.bike_brand || "bike";
      const bikeModel = order.bike_model || "";
      const trackingUrl = order.tracking_number
        ? `https://cyclecourierco.com/tracking/${order.tracking_number}`
        : "https://cyclecourierco.com";

      sendzenBody = {
        to: phone,
        from: fromNumber,
        type: "template",
        template: {
          name: type,
          lang_code: "en_GB",
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: contact.name || "Customer", parameter_name: "contact_name" },
                { type: "text", text: bikeBrand, parameter_name: "bike_brand" },
                { type: "text", text: bikeModel, parameter_name: "bike_model" },
                { type: "text", text: formattedDate, parameter_name: "date" },
                { type: "text", text: startTime, parameter_name: "start_time" },
                { type: "text", text: endTime, parameter_name: "end_time" },
              ],
            },
            {
              type: "button",
              sub_type: "url",
              index: 0,
              parameters: [
                { type: "text", text: trackingUrl, parameter_name: "tracking_url" },
              ],
            },
          ],
        },
      };
    } else if (type === "grouped_timeslot") {
      // Grouped location template
      const scheduledDate = recipientType === "sender"
        ? order.scheduled_pickup_date
        : order.scheduled_delivery_date;

      if (!scheduledDate || !deliveryTime) {
        return new Response(
          JSON.stringify({ error: "Missing scheduled date or delivery time" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formattedDate = formatDateForTemplate(scheduledDate);
      const startTime = deliveryTime;
      const endTime = calculateEndTime(deliveryTime);

      sendzenBody = {
        to: phone,
        from: fromNumber,
        type: "template",
        template: {
          name: "grouped_timeslot",
          lang_code: "en_GB",
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: contact.name || "Customer", parameter_name: "contact_name" },
                { type: "text", text: formattedDate, parameter_name: "date" },
                { type: "text", text: startTime, parameter_name: "start_time" },
                { type: "text", text: endTime, parameter_name: "end_time" },
                { type: "text", text: collectionJobList || "No collections", parameter_name: "collection_job_list" },
                { type: "text", text: deliveryJobList || "No deliveries", parameter_name: "delivery_job_list" },
              ],
            },
          ],
        },
      };
    } else if (type === "review") {
      // Review template
      sendzenBody = {
        to: phone,
        from: fromNumber,
        type: "template",
        template: {
          name: "review",
          lang_code: "en_GB",
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: contact.name || "Customer", parameter_name: "customer_name" },
              ],
            },
          ],
        },
      };
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown template type: ${type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sending SendZen request:", JSON.stringify({ template: type, to: phone }));

    // Call SendZen API
    const sendzenResponse = await fetch("https://api.sendzen.io/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sendzenApiKey}`,
      },
      body: JSON.stringify(sendzenBody),
    });

    const responseText = await sendzenResponse.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!sendzenResponse.ok) {
      console.error("SendZen API error:", sendzenResponse.status, responseData);
      return new Response(
        JSON.stringify({
          success: false,
          error: `SendZen API returned ${sendzenResponse.status}`,
          details: responseData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("SendZen message sent successfully");

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("SendZen edge function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
