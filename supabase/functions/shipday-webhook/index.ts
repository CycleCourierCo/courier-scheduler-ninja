
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

    // Check if this is a pickup or delivery job based on order number suffix
    const orderNumber = order.order_number;
    console.log("Order number from webhook:", orderNumber);
    
    const isPickup = orderNumber.endsWith("-PICKUP");
    const isDelivery = orderNumber.endsWith("-DELIVERY");
    
    if (!isPickup && !isDelivery) {
      console.error("Order number does not end with -PICKUP or -DELIVERY:", orderNumber);
      return new Response(JSON.stringify({ error: "Invalid order number format" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Find the order in the database based on Shipday pickup_id or delivery_id
    const shipdayOrderId = order.id.toString();
    console.log(`Looking for order with ${isPickup ? "shipday_pickup_id" : "shipday_delivery_id"} = ${shipdayOrderId}`);
    
    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, tracking_events, shipday_pickup_id, shipday_delivery_id")
      .or(
        isPickup 
          ? `shipday_pickup_id.eq.${shipdayOrderId}` 
          : `shipday_delivery_id.eq.${shipdayOrderId}`
      )
      .limit(1);

    if (fetchError || !orders || orders.length === 0) {
      console.error("Error fetching order or no order found:", fetchError);
      console.error(`No order found with ${isPickup ? "shipday_pickup_id" : "shipday_delivery_id"} = ${shipdayOrderId}`);
      
      // Try fallback to tracking number if ID-based lookup failed
      const baseOrderNumber = orderNumber.replace(/-PICKUP$|-DELIVERY$/, "");
      console.log("Fallback: Looking up by tracking number:", baseOrderNumber);
      
      const { data: fallbackOrders, error: fallbackError } = await supabase
        .from("orders")
        .select("id, status, tracking_events, shipday_pickup_id, shipday_delivery_id")
        .eq("tracking_number", baseOrderNumber)
        .limit(1);
        
      if (fallbackError || !fallbackOrders || fallbackOrders.length === 0) {
        console.error("Fallback lookup also failed:", fallbackError);
        return new Response(JSON.stringify({ error: "Order not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }
      
      console.log("Found order using fallback lookup:", fallbackOrders[0]);
      var dbOrder = fallbackOrders[0];
      
      // Update the Shipday ID for future lookups
      if (isPickup && !dbOrder.shipday_pickup_id) {
        await supabase
          .from("orders")
          .update({ shipday_pickup_id: shipdayOrderId })
          .eq("id", dbOrder.id);
        console.log(`Updated shipday_pickup_id to ${shipdayOrderId}`);
      } else if (isDelivery && !dbOrder.shipday_delivery_id) {
        await supabase
          .from("orders")
          .update({ shipday_delivery_id: shipdayOrderId })
          .eq("id", dbOrder.id);
        console.log(`Updated shipday_delivery_id to ${shipdayOrderId}`);
      }
    } else {
      var dbOrder = orders[0];
      console.log("Found order in database:", dbOrder);
    }

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

    // Update tracking events
    const trackingEvents = dbOrder.tracking_events || {};
    const shipdayEvents = trackingEvents.shipday || {
      pickup_id: dbOrder.shipday_pickup_id,
      delivery_id: dbOrder.shipday_delivery_id,
      updates: [],
    };

    shipdayEvents.last_status = order_status;
    shipdayEvents.last_updated = new Date().toISOString();
    
    // Add the new update to the updates array
    shipdayEvents.updates = [
      ...(shipdayEvents.updates || []),
      {
        status: order_status,
        event: event,
        timestamp: new Date().toISOString(),
        orderId: shipdayOrderId,
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
    console.log("Updated tracking events:", JSON.stringify(trackingEvents, null, 2));

    // Update jobs if available
    try {
      await updateJobStatuses(dbOrder.id, newStatus);
    } catch (jobError) {
      console.error("Error updating job statuses:", jobError);
      // Continue with response even if job update fails
    }

    // Send delivery confirmation emails if status is "delivered"
    if (newStatus === "delivered") {
      try {
        console.log("Sending delivery confirmation emails for order:", dbOrder.id);
        await sendDeliveryConfirmationEmails(dbOrder.id, supabase);
      } catch (emailError) {
        console.error("Error sending delivery confirmation emails:", emailError);
        // Continue with response even if email sending fails
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Order status updated to ${newStatus}`,
      orderId: dbOrder.id,
      statusDescription,
      trackingEvents: trackingEvents
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

// New function to send delivery confirmation emails
async function sendDeliveryConfirmationEmails(orderId: string, supabase: any): Promise<boolean> {
  try {
    // Get order details first including sender and receiver information
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    
    if (error || !order) {
      console.error("Error fetching order details for email:", error);
      return false;
    }
    
    console.log("Preparing to send delivery confirmation emails for order:", orderId);
    
    // Send confirmation to sender
    if (order.sender && order.sender.email) {
      console.log("Sending delivery confirmation to sender:", order.sender.email);
      
      const senderResponse = await supabase.functions.invoke("send-email", {
        body: {
          to: order.sender.email,
          name: order.sender.name || "Sender",
          subject: "Your Bike Has Been Delivered",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Delivery Confirmation</h2>
              <p>Hello ${order.sender.name || "Customer"},</p>
              <p>We're pleased to inform you that your bike (${order.bike_brand} ${order.bike_model}) has been successfully delivered to ${order.receiver.name}.</p>
              <p>Thank you for using our service!</p>
              <p>Order details:</p>
              <ul>
                <li>Tracking Number: ${order.tracking_number}</li>
                <li>Status: Delivered</li>
              </ul>
              <p>Best regards,<br>The Cycle Courier Co. Team</p>
            </div>
          `
        }
      });
      
      if (senderResponse.error) {
        console.error("Error sending email to sender:", senderResponse.error);
      } else {
        console.log("Successfully sent delivery confirmation to sender");
      }
    }
    
    // Send confirmation to receiver
    if (order.receiver && order.receiver.email) {
      console.log("Sending delivery confirmation to receiver:", order.receiver.email);
      
      const receiverResponse = await supabase.functions.invoke("send-email", {
        body: {
          to: order.receiver.email,
          name: order.receiver.name || "Receiver",
          subject: "Your Bike Has Been Delivered",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Delivery Confirmation</h2>
              <p>Hello ${order.receiver.name || "Customer"},</p>
              <p>We're pleased to inform you that your bike (${order.bike_brand} ${order.bike_model}) has been successfully delivered to you.</p>
              <p>Thank you for using our service!</p>
              <p>Order details:</p>
              <ul>
                <li>Tracking Number: ${order.tracking_number}</li>
                <li>Status: Delivered</li>
              </ul>
              <p>Best regards,<br>The Cycle Courier Co. Team</p>
            </div>
          `
        }
      });
      
      if (receiverResponse.error) {
        console.error("Error sending email to receiver:", receiverResponse.error);
      } else {
        console.log("Successfully sent delivery confirmation to receiver");
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error in sendDeliveryConfirmationEmails:", error);
    return false;
  }
}
