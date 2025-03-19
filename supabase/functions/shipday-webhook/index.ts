
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

// Define interfaces for the webhook payload
interface ShipdayWebhookPayload {
  timestamp: number;
  event: ShipdayEventType;
  order_status: ShipdayOrderStatus;
  order: ShipdayOrder;
  company: ShipdayCompany;
  delivery_details: ShipdayDeliveryDetails;
  pickup_details: ShipdayPickupDetails;
  carrier?: ShipdayCarrier;
  thirdPartyDeliveryOrder?: ShipdayThirdPartyDelivery;
}

type ShipdayEventType = 
  | "ORDER_ASSIGNED"
  | "ORDER_ACCEPTED_AND_STARTED"
  | "ORDER_ONTHEWAY"
  | "ORDER_COMPLETED"
  | "ORDER_FAILED"
  | "ORDER_INCOMPLETE"
  | "ORDER_DELETE"
  | "ORDER_INSERTED"
  | "ORDER_PIKEDUP"
  | "ORDER_UNASSIGNED"
  | "ORDER_PIKEDUP_REMOVED"
  | "ORDER_ONTHEWAY_REMOVED";

type ShipdayOrderStatus = 
  | "NOT_ASSIGNED"
  | "NOT_ACCEPTED"
  | "NOT_STARTED_YET"
  | "STARTED"
  | "PICKED_UP"
  | "READY_TO_DELIVER"
  | "ALREADY_DELIVERED"
  | "INCOMPLETE"
  | "FAILED_DELIVERY";

interface ShipdayOrder {
  id: number;
  order_number: string;
  provider?: string;
  order_item?: string;
  delivery_note?: string;
  order_source?: string;
  auto_assignment_status?: string;
  parent_id?: number;
  order_sequence_number?: number;
  payment_method?: string;
  total_cost?: number;
  delivery_fee?: number;
  predefined_tip?: number;
  cash_tip?: number;
  discount_amount?: number;
  tax?: number;
  podUrls?: string[];
  driving_duration?: number;
  eta?: number;
  driving_distance?: number;
  placement_time?: number;
  expected_pickup_time?: number;
  expected_delivery_time?: number;
  assigned_time?: number;
  start_time?: number;
  pickedup_time?: number;
  arrived_time?: number;
  delivery_time?: number;
}

interface ShipdayCompany {
  id: number;
  name: string;
  description?: string;
  address?: string;
  principal_area_id?: number;
  order_acceptance_timeout?: number;
  average_speed_mps?: number;
  fixed_driver_fee?: number;
  order_activation_time_mins?: number;
  currency_code?: number;
  schedule_order_lead_time_sec?: number;
  max_assigned_order?: number;
  routing?: number;
  country?: number;
  admin_area?: string;
  routing_cost?: string;
}

interface ShipdayDeliveryDetails {
  id?: number;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  formatted_address?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

interface ShipdayPickupDetails {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  formatted_address?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

interface ShipdayCarrier {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  status?: string;
  current_order?: number;
  plate_number?: string;
  vehicle_description?: string;
}

interface ShipdayThirdPartyDelivery {
  orderId: number;
  thirdPartyName: string;
  referenceId: string;
  status: string;
  insertedAt: number;
  thirdPartyFee?: number;
  driverName?: string;
  driverPhone?: string;
}

// The fixed webhook security token to verify requests
const WEBHOOK_TOKEN = Deno.env.get("SHIPDAY_WEBHOOK_TOKEN") || "";

// Set up CORS headers for preflight requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  console.log("Shipday webhook received request:", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      console.error(`Method not allowed: ${req.method}`);
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
      );
    }

    // Verify token if configured
    if (WEBHOOK_TOKEN) {
      const requestToken = req.headers.get("token");
      console.log(`Verifying webhook token: received=${requestToken}, expected=${WEBHOOK_TOKEN}`);
      
      if (requestToken !== WEBHOOK_TOKEN) {
        console.error("Invalid webhook token");
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }
    } else {
      console.warn("No webhook token configured, skipping token verification");
    }

    // Clone the request before reading the body
    const reqClone = req.clone();
    
    // Try to parse webhook payload
    let payload: ShipdayWebhookPayload;
    try {
      payload = await req.json();
      console.log("Received Shipday webhook payload:", JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error("Failed to parse webhook payload:", parseError);
      
      // Log the raw body for debugging
      try {
        const rawBody = await reqClone.text();
        console.error("Raw request body:", rawBody);
      } catch (e) {
        console.error("Could not read raw request body:", e);
      }
      
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Extract order_number and event information
    const { event, order_status, order, timestamp } = payload;
    const orderNumber = order.order_number;
    
    console.log(`Processing order: ${orderNumber}, event: ${event}, status: ${order_status}`);
    
    // The orderNumber from Shipday will be in the format "{orderId}-PICKUP" or "{orderId}-DELIVERY"
    // Extract the order ID from our system
    const orderIdMatch = orderNumber.match(/^([0-9a-f-]+)-/);
    if (!orderIdMatch) {
      console.error("Could not extract order ID from order number:", orderNumber);
      return new Response(
        JSON.stringify({ error: "Invalid order number format" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Extract our order ID from the Shipday order number
    const extractedOrderId = orderIdMatch[1];
    console.log(`Extracted order ID: ${extractedOrderId}`);
    
    // Parse full order ID (may be partial in the order number)
    let fullOrderId = extractedOrderId;
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase credentials:", { 
        supabaseUrl: supabaseUrl ? "Set" : "Missing", 
        supabaseKey: supabaseKey ? "Set" : "Missing" 
      });
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    console.log("Initializing Supabase client with:", { 
      supabaseUrl: supabaseUrl.substring(0, 15) + "...", 
      keyLength: supabaseKey.length 
    });
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Look up the full order ID if we only have a partial
    if (extractedOrderId.length < 36) { // UUID is 36 chars
      console.log(`Looking up full order ID for partial ID: ${extractedOrderId}`);
      const { data: matchingOrders, error: lookupError } = await supabase
        .from("orders")
        .select("id")
        .like("id", `${extractedOrderId}%`)
        .limit(1);
        
      if (lookupError) {
        console.error("Error looking up order:", lookupError);
        return new Response(
          JSON.stringify({ error: "Database lookup error", details: lookupError.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      if (!matchingOrders || matchingOrders.length === 0) {
        console.error("Could not find order with partial ID:", extractedOrderId);
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }
      
      fullOrderId = matchingOrders[0].id;
      console.log(`Found full order ID: ${fullOrderId}`);
    }
    
    // Get the current order
    console.log(`Fetching order details for ID: ${fullOrderId}`);
    const { data: currentOrder, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", fullOrderId)
      .single();
      
    if (orderError) {
      console.error("Error fetching order:", orderError);
      return new Response(
        JSON.stringify({ error: "Order fetch error", details: orderError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
      
    if (!currentOrder) {
      console.error(`Order not found with ID: ${fullOrderId}`);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }
    
    console.log(`Found order: ${currentOrder.id}, current status: ${currentOrder.status}`);
    
    // Determine if this is for pickup or delivery based on the order number suffix
    const isPickup = orderNumber.endsWith("-PICKUP");
    const isDelivery = orderNumber.endsWith("-DELIVERY");
    const legType = isPickup ? "pickup" : isDelivery ? "delivery" : "unknown";
    console.log(`Order leg type: ${legType}`);
    
    // Map Shipday status to our system status
    let newOrderStatus = currentOrder.status;
    let trackingEvents = currentOrder.tracking_events || [];
    
    // Create a new tracking event
    const newEvent = {
      timestamp: new Date(timestamp).toISOString(),
      shipdayEvent: event,
      shipdayStatus: order_status,
      legType: legType,
      details: {
        carrier: payload.carrier,
        eta: order.eta ? new Date(order.eta).toISOString() : null,
        pickedUpTime: order.pickedup_time ? new Date(order.pickedup_time).toISOString() : null,
        deliveryTime: order.delivery_time ? new Date(order.delivery_time).toISOString() : null,
      }
    };
    
    console.log("Created new tracking event:", JSON.stringify(newEvent, null, 2));
    
    // Add the event to tracking history
    trackingEvents.push(newEvent);
    
    // Update order status based on the event
    console.log(`Analyzing event: ${event} for leg: ${legType} with current status: ${newOrderStatus}`);
    
    const previousStatus = newOrderStatus;
    if (event === "ORDER_COMPLETED" && isDelivery) {
      newOrderStatus = "delivered";
      console.log("Setting status to delivered due to ORDER_COMPLETED on delivery leg");
    } else if (event === "ORDER_PIKEDUP" && isPickup) {
      newOrderStatus = "shipped";
      console.log("Setting status to shipped due to ORDER_PIKEDUP on pickup leg");
    } else if (event === "ORDER_ONTHEWAY") {
      // Always set to shipped when on the way regardless of current status
      newOrderStatus = "shipped";
      console.log("Setting status to shipped due to ORDER_ONTHEWAY event");
    } else if ((event === "ORDER_ASSIGNED" || event === "ORDER_ACCEPTED_AND_STARTED") && newOrderStatus === "scheduled") {
      newOrderStatus = "shipped";
      console.log(`Setting status to shipped due to ${event} event from scheduled status`);
    }
    
    if (previousStatus !== newOrderStatus) {
      console.log(`Status change: ${previousStatus} -> ${newOrderStatus}`);
    } else {
      console.log(`Status unchanged: ${newOrderStatus}`);
    }
    
    // Update the order in the database
    console.log(`Updating order ${fullOrderId} with new status: ${newOrderStatus}`);
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        status: newOrderStatus,
        tracking_events: trackingEvents,
        updated_at: new Date().toISOString()
      })
      .eq("id", fullOrderId)
      .select()
      .single();
      
    if (updateError) {
      console.error("Error updating order:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update order", details: updateError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    console.log(`Successfully updated order ${fullOrderId} with new status: ${newOrderStatus}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook processed successfully",
        orderId: fullOrderId,
        previousStatus: previousStatus,
        newStatus: newOrderStatus,
        eventProcessed: event
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (err) {
    console.error("Unhandled error processing webhook:", err);
    
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err.message || "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
