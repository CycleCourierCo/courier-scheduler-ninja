
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
      );
    }

    // Verify token if configured
    if (WEBHOOK_TOKEN) {
      const requestToken = req.headers.get("token");
      if (requestToken !== WEBHOOK_TOKEN) {
        console.error("Invalid webhook token");
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }
    }

    // Parse webhook payload
    const payload: ShipdayWebhookPayload = await req.json();
    console.log("Received Shipday webhook:", JSON.stringify(payload, null, 2));

    // Extract order_number and event information
    const { event, order_status, order, timestamp } = payload;
    const orderNumber = order.order_number;
    
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
    
    // Parse full order ID (may be partial in the order number)
    let fullOrderId = extractedOrderId;
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Look up the full order ID if we only have a partial
    if (extractedOrderId.length < 36) { // UUID is 36 chars
      const { data: matchingOrders, error: lookupError } = await supabase
        .from("orders")
        .select("id")
        .like("id", `${extractedOrderId}%`)
        .limit(1);
        
      if (lookupError || !matchingOrders || matchingOrders.length === 0) {
        console.error("Could not find order with partial ID:", extractedOrderId);
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }
      
      fullOrderId = matchingOrders[0].id;
    }
    
    // Get the current order
    const { data: currentOrder, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", fullOrderId)
      .single();
      
    if (orderError || !currentOrder) {
      console.error("Error fetching order:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }
    
    // Determine if this is for pickup or delivery based on the order number suffix
    const isPickup = orderNumber.endsWith("-PICKUP");
    const isDelivery = orderNumber.endsWith("-DELIVERY");
    const legType = isPickup ? "pickup" : isDelivery ? "delivery" : "unknown";
    
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
    
    // Add the event to tracking history
    trackingEvents.push(newEvent);
    
    // Update order status based on the event
    // Note: This is a simplified mapping - update according to your business logic
    if (event === "ORDER_COMPLETED" && isDelivery) {
      newOrderStatus = "delivered";
    } else if (event === "ORDER_PIKEDUP" && isPickup) {
      newOrderStatus = "shipped";
    } else if ((event === "ORDER_ASSIGNED" || event === "ORDER_ACCEPTED_AND_STARTED" || event === "ORDER_ONTHEWAY") && newOrderStatus === "scheduled") {
      newOrderStatus = "shipped";
    }
    
    // Update the order in the database
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
        JSON.stringify({ error: "Failed to update order" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    console.log(`Successfully updated order ${fullOrderId} with new status: ${newOrderStatus}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook processed successfully",
        orderId: fullOrderId,
        status: newOrderStatus
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
    
  } catch (err) {
    console.error("Error processing webhook:", err);
    
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
