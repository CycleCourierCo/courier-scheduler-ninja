
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
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
      console.error("Invalid webhook token:", webhookToken);
      return new Response(JSON.stringify({ error: "Invalid or missing webhook token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const payload = await req.json();
    console.log("Received Shipday webhook payload:", JSON.stringify(payload, null, 2));

    const { orderId, status, timestamp } = payload;

    if (!orderId || !status) {
      console.error("Missing required fields in payload:", payload);
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    console.log(`Looking for order with shipday_pickup_id or shipday_delivery_id: ${orderId}`);
    
    // First try to find the order using the dedicated columns
    let { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .or(`shipday_pickup_id.eq.${orderId},shipday_delivery_id.eq.${orderId}`)
      .single();
    
    if (fetchError || !order) {
      console.log("Order not found with dedicated columns, trying JSON search:", fetchError);
      
      // Fallback to searching in tracking_events JSON
      const { data: ordersByJson, error: jsonError } = await supabase
        .from("orders")
        .select("*")
        .or(`tracking_events->shipday->pickup_id.eq.${orderId},tracking_events->shipday->delivery_id.eq.${orderId}`);
      
      if (jsonError || !ordersByJson || ordersByJson.length === 0) {
        console.error("Order not found for Shipday ID:", orderId, jsonError || "No results");
        return new Response(JSON.stringify({ error: "Order not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }
      
      order = ordersByJson[0];
      console.log(`Found order ${order.id} using JSON search`);
    } else {
      console.log(`Found order ${order.id} using dedicated columns`);
    }

    // Determine if this update is for pickup or delivery
    const isPickup = orderId === order.shipday_pickup_id || 
                    orderId === order.tracking_events?.shipday?.pickup_id;
    
    console.log(`Update is for ${isPickup ? 'pickup' : 'delivery'} order with status: ${status}`);

    // Map Shipday status to our OrderStatus
    let newStatus;
    const statusLower = status.toLowerCase();

    if (isPickup) {
      if (statusLower === "on-the-way") {
        newStatus = "driver_to_collection";
      } else if (statusLower === "picked-up") {
        newStatus = "collected";
      } else {
        newStatus = order.status; // Keep current status if no mapping
      }
    } else {
      if (statusLower === "on-the-way") {
        newStatus = "driver_to_delivery";
      } else if (statusLower === "delivered") {
        newStatus = "delivered";
      } else {
        newStatus = order.status; // Keep current status if no mapping
      }
    }

    console.log(`Mapped Shipday status "${status}" to order status "${newStatus}"`);

    // Update tracking events with Shipday status
    const trackingEvents = order.tracking_events || {};
    const shipdayTracking = trackingEvents.shipday || {
      pickup_id: order.shipday_pickup_id,
      delivery_id: order.shipday_delivery_id,
      created_at: order.created_at
    };
    
    const shipdayUpdates = shipdayTracking.updates || [];
    shipdayUpdates.push({
      status,
      timestamp: timestamp || new Date().toISOString(),
      orderId,
      mapped_status: newStatus
    });
    
    trackingEvents.shipday = {
      ...shipdayTracking,
      last_status: status,
      last_updated: timestamp || new Date().toISOString(),
      updates: shipdayUpdates
    };

    console.log(`Updating order ${order.id} with status ${newStatus}`);

    // Update the order in Supabase
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

    console.log(`Successfully updated order ${order.id} to status ${newStatus}`);
    return new Response(JSON.stringify({ 
      success: true, 
      orderId: order.id,
      newStatus,
      previousStatus: order.status
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
