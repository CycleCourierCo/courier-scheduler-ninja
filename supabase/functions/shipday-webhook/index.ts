
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    // Verify the webhook token
    const webhookToken = req.headers.get("x-webhook-token");
    const expectedToken = Deno.env.get("SHIPDAY_WEBHOOK_TOKEN");
    
    if (!webhookToken || webhookToken !== expectedToken) {
      console.error("Invalid webhook token");
      return new Response(JSON.stringify({ error: "Invalid webhook token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const payload = await req.json();
    console.log("Received Shipday webhook payload:", JSON.stringify(payload));

    const { orderId, status, timestamp } = payload;

    if (!orderId || !status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Find the order in the database
    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .or(`shipday_pickup_id.eq.${orderId},shipday_delivery_id.eq.${orderId}`)
      .limit(1);

    if (fetchError || !orders || orders.length === 0) {
      console.error("Error fetching order or no order found:", fetchError, orderId);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const order = orders[0];
    
    // Determine if this is for pickup or delivery
    const isPickup = orderId === order.shipday_pickup_id;

    // Map Shipday status to application OrderStatus
    let newStatus = order.status;
    const statusLower = status.toLowerCase();

    if (isPickup) {
      if (statusLower === "on-the-way") {
        newStatus = "driver_to_collection";
      } else if (statusLower === "picked-up" || statusLower === "delivered") {
        // Map both "picked-up" and "delivered" to "collected" for pickup orders
        newStatus = "collected";
      }
    } else {
      if (statusLower === "on-the-way") {
        newStatus = "driver_to_delivery";
      } else if (statusLower === "delivered") {
        newStatus = "delivered";
      }
    }

    console.log(`Mapping Shipday status "${status}" for ${isPickup ? "pickup" : "delivery"} to order status "${newStatus}"`);

    // Update tracking events
    const trackingEvents = order.tracking_events || {};
    const shipdayEvents = trackingEvents.shipday || {
      pickup_id: order.shipday_pickup_id,
      delivery_id: order.shipday_delivery_id,
      updates: [],
    };

    shipdayEvents.last_status = status;
    shipdayEvents.last_updated = timestamp || new Date().toISOString();
    shipdayEvents.updates = [
      ...(shipdayEvents.updates || []),
      {
        status,
        timestamp: timestamp || new Date().toISOString(),
        orderId,
      },
    ];

    trackingEvents.shipday = shipdayEvents;

    // Update the order
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: newStatus,
        tracking_events: trackingEvents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating order:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update order" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log(`Successfully updated order ${order.id} status to ${newStatus}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Order status updated to ${newStatus}`,
      orderId: order.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
