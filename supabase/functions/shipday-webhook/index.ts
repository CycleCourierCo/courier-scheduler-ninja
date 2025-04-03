
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
    // Debug: Log all headers for troubleshooting
    const headersDebug: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersDebug[key] = value;
    });
    console.log("Received headers:", JSON.stringify(headersDebug, null, 2));

    // Check if we have SHIPDAY_WEBHOOK_TOKEN configured
    const expectedToken = Deno.env.get("SHIPDAY_WEBHOOK_TOKEN");
    
    // TEMPORARY DEVELOPMENT MODE:
    // During initial setup and testing, we'll accept all webhook calls
    // IMPORTANT: In production, always enable token validation!
    
    // Set this to true to enable token validation once everything is set up
    const enforceTokenValidation = false;
    
    if (enforceTokenValidation && expectedToken) {
      // Get token from the header Shipday is using
      const webhookToken = req.headers.get("x-webhook-token");
      
      if (!webhookToken || webhookToken !== expectedToken) {
        console.error("Invalid webhook token provided");
        console.log(`Received: "${webhookToken}", Expected: "${expectedToken}"`);
        
        // Log the payload anyway for debugging
        try {
          const requestClone = req.clone();
          const payload = await requestClone.json();
          console.log("Rejected payload:", JSON.stringify(payload, null, 2));
        } catch (e) {
          console.error("Could not parse rejected payload:", e);
        }
        
        return new Response(JSON.stringify({ error: "Invalid webhook token" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }
    } else {
      // In development mode, log that we're skipping token validation
      console.log("DEVELOPMENT MODE: Skipping webhook token validation");
    }

    const payload = await req.json();
    console.log("Received Shipday webhook payload:", JSON.stringify(payload, null, 2));

    // Extract the relevant information from the payload
    const { order, order_status, event } = payload;
    
    if (!order || !order_status) {
      return new Response(JSON.stringify({ error: "Missing required fields in payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get the order number which contains either -PICKUP or -DELIVERY suffix
    const orderNumber = order.order_number;
    console.log("Order number from webhook:", orderNumber);
    
    // Check if this is a pickup or delivery job
    const isPickup = orderNumber.endsWith("-PICKUP");
    const isDelivery = orderNumber.endsWith("-DELIVERY");
    
    if (!isPickup && !isDelivery) {
      console.error("Order number does not end with -PICKUP or -DELIVERY:", orderNumber);
      return new Response(JSON.stringify({ error: "Invalid order number format" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    // Get the base order ID (remove the -PICKUP or -DELIVERY suffix)
    const baseOrderNumber = orderNumber.replace(/-PICKUP$|-DELIVERY$/, "");
    console.log("Base order number:", baseOrderNumber);
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Find the order in the database
    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, tracking_events, shipday_pickup_id, shipday_delivery_id")
      .or(`tracking_number.eq.${baseOrderNumber}`)
      .limit(1);

    if (fetchError || !orders || orders.length === 0) {
      console.error("Error fetching order or no order found:", fetchError, baseOrderNumber);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const dbOrder = orders[0];
    console.log("Found order in database:", dbOrder);
    
    // Map Shipday status to application OrderStatus
    let newStatus = dbOrder.status;
    let statusDescription = "";

    // Handle status mapping based on Shipday event and order type
    if (isPickup) {
      if (order_status === "READY_TO_DELIVER" || event === "ORDER_ONTHEWAY") {
        newStatus = "driver_to_collection";
        statusDescription = "Driver is on the way to collect the bike";
      } else if (order_status === "ALREADY_DELIVERED" || event === "ORDER_DELIVERED") {
        newStatus = "collected";
        statusDescription = "Driver has collected the bike";
      }
    } else if (isDelivery) {
      if (order_status === "READY_TO_DELIVER" || event === "ORDER_ONTHEWAY") {
        newStatus = "driver_to_delivery";
        statusDescription = "Driver is on the way to deliver the bike";
      } else if (order_status === "ALREADY_DELIVERED" || event === "ORDER_DELIVERED") {
        newStatus = "delivered";
        statusDescription = "Driver has delivered the bike";
      }
    }

    console.log(`Mapping Shipday status "${order_status}" (event: ${event}) for ${isPickup ? "pickup" : "delivery"} to order status "${newStatus}"`);
    console.log(`Status description: "${statusDescription}"`);

    if (newStatus === dbOrder.status && !statusDescription) {
      console.log("No status change required, skipping update");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No status change required"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Update tracking events
    const trackingEvents = dbOrder.tracking_events || {};
    const shipdayEvents = trackingEvents.shipday || {
      pickup_id: dbOrder.shipday_pickup_id,
      delivery_id: dbOrder.shipday_delivery_id,
      updates: [],
    };

    shipdayEvents.last_status = order_status;
    shipdayEvents.last_updated = new Date().toISOString();
    shipdayEvents.updates = [
      ...(shipdayEvents.updates || []),
      {
        status: order_status,
        event: event,
        timestamp: new Date().toISOString(),
        orderId: order.id.toString(),
        description: statusDescription
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
      .eq("id", dbOrder.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating order:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update order" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log(`Successfully updated order ${dbOrder.id} status to ${newStatus}`);

    // Update jobs if available
    try {
      await updateJobStatuses(dbOrder.id, newStatus);
    } catch (jobError) {
      console.error("Error updating job statuses:", jobError);
      // Continue with response even if job update fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Order status updated to ${newStatus}`,
      orderId: dbOrder.id,
      statusDescription
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

// Helper function to update job statuses
async function updateJobStatuses(orderId: string, orderStatus: string): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
  
  // Map order status to appropriate job statuses
  let collectionStatus: string | null = null;
  let deliveryStatus: string | null = null;
  
  switch (orderStatus) {
    case 'scheduled':
      collectionStatus = 'scheduled';
      deliveryStatus = 'scheduled';
      break;
    case 'driver_to_collection':
      collectionStatus = 'in_progress';
      deliveryStatus = 'pending';
      break;
    case 'collected':
      collectionStatus = 'completed';
      deliveryStatus = 'pending';
      break;
    case 'driver_to_delivery':
      collectionStatus = 'completed';
      deliveryStatus = 'in_progress';
      break;
    case 'delivered':
      collectionStatus = 'completed';
      deliveryStatus = 'completed';
      break;
    default:
      return true; // No updates needed
  }
  
  // Update collection job
  if (collectionStatus) {
    const { error: collectionError } = await supabase
      .from("jobs")
      .update({ 
        status: collectionStatus 
      })
      .eq("order_id", orderId)
      .eq("type", 'collection');
    
    if (collectionError) throw collectionError;
  }
  
  // Update delivery job
  if (deliveryStatus) {
    const { error: deliveryError } = await supabase
      .from("jobs")
      .update({ 
        status: deliveryStatus 
      })
      .eq("order_id", orderId)
      .eq("type", 'delivery');
    
    if (deliveryError) throw deliveryError;
  }
  
  return true;
}
