
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
    console.log("Received headers:", Object.fromEntries(req.headers.entries()));
    
    const expectedToken = Deno.env.get("SHIPDAY_WEBHOOK_TOKEN");
    const enforceTokenValidation = false;
    
    if (enforceTokenValidation && expectedToken) {
      const webhookToken = req.headers.get("x-webhook-token");
      if (!webhookToken || webhookToken !== expectedToken) {
        console.error("Invalid webhook token");
        return new Response(JSON.stringify({ error: "Invalid webhook token" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }
    }

    const payload = await req.json();
    console.log("Received Shipday webhook payload:", JSON.stringify(payload, null, 2));

    const { order, event } = payload;
    
    if (!order) {
      return new Response(JSON.stringify({ error: "Missing required fields in payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

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

    const shipdayOrderId = order.id.toString();
    console.log(`Looking for order with ${isPickup ? "shipday_pickup_id" : "shipday_delivery_id"} = ${shipdayOrderId}`);
    
    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, tracking_events")
      .or(
        isPickup 
          ? `shipday_pickup_id.eq.${shipdayOrderId}` 
          : `shipday_delivery_id.eq.${shipdayOrderId}`
      )
      .limit(1);

    if (fetchError || !orders || orders.length === 0) {
      console.error("Error fetching order:", fetchError);
      const baseOrderNumber = orderNumber.replace(/-PICKUP$|-DELIVERY$/, "");
      
      const { data: fallbackOrders, error: fallbackError } = await supabase
        .from("orders")
        .select("id, status, tracking_events")
        .eq("tracking_number", baseOrderNumber)
        .limit(1);
        
      if (fallbackError || !fallbackOrders || fallbackOrders.length === 0) {
        console.error("Fallback lookup failed:", fallbackError);
        return new Response(JSON.stringify({ error: "Order not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }
      
      console.log("Found order using fallback lookup:", fallbackOrders[0]);
      var dbOrder = fallbackOrders[0];
      
      if (isPickup && !dbOrder.shipday_pickup_id) {
        await supabase
          .from("orders")
          .update({ shipday_pickup_id: shipdayOrderId })
          .eq("id", dbOrder.id);
      } else if (isDelivery && !dbOrder.shipday_delivery_id) {
        await supabase
          .from("orders")
          .update({ shipday_delivery_id: shipdayOrderId })
          .eq("id", dbOrder.id);
      }
    } else {
      var dbOrder = orders[0];
    }

    // Map Shipday status to application OrderStatus based on event type
    let newStatus = dbOrder.status;
    let statusDescription = "";

    // Process ORDER_ONTHEWAY, ORDER_COMPLETED, ORDER_FAILED, and ORDER_POD_UPLOAD events
    if (event === "ORDER_ONTHEWAY") {
      if (isPickup) {
        newStatus = "driver_to_collection";
        statusDescription = "Driver is on the way to collect the bike";
      } else {
        newStatus = "driver_to_delivery";
        statusDescription = "Driver is on the way to deliver the bike";
      }
    } else if (event === "ORDER_COMPLETED") {
      if (isPickup) {
        newStatus = "collected";
        statusDescription = "Driver has collected the bike";
      } else {
        newStatus = "delivered";
        statusDescription = "Driver has delivered the bike";
      }
    } else if (event === "ORDER_FAILED") {
      if (isPickup) {
        newStatus = "scheduled_dates_pending";
        statusDescription = "Collection attempted (date rescheduled)";
      } else {
        newStatus = "collected";
        statusDescription = "Delivery attempted (date rescheduled)";
      }
    } else if (event === "ORDER_POD_UPLOAD") {
      // Check if this POD upload should be treated as completion
      const existingUpdates = (dbOrder.tracking_events?.shipday?.updates || []);
      const hasCompletionEvent = existingUpdates.some(update => 
        update.orderId === shipdayOrderId && update.event === "ORDER_COMPLETED"
      );
      
      // If no prior completion event exists, treat POD upload as completion
      if (!hasCompletionEvent) {
        if (isPickup) {
          newStatus = "collected";
          statusDescription = "Bike collected (proof uploaded)";
        } else {
          newStatus = "delivered";
          statusDescription = "Bike delivered (proof uploaded)";
        }
        console.log(`POD upload treated as completion for ${isPickup ? "pickup" : "delivery"} order ${shipdayOrderId}`);
      } else {
        // Keep current status if completion already recorded
        newStatus = dbOrder.status;
        statusDescription = isPickup ? "Proof of collection uploaded" : "Proof of delivery uploaded";
        console.log(`Processing POD upload for ${isPickup ? "pickup" : "delivery"} order ${shipdayOrderId}`);
      }
    } else if (event === "ORDER_ACCEPTED_AND_STARTED") {
      // Handle driver acceptance and start - keep current status, just log the event
      statusDescription = isPickup ? "Driver has accepted and started collection" : "Driver has accepted and started delivery";
      newStatus = dbOrder.status; // Don't change status
    } else if (event === "ORDER_ASSIGNED") {
      // Handle driver assignment - update status based on job type
      if (isPickup) {
        newStatus = "collection_scheduled";
        statusDescription = "Driver assigned for collection";
      } else {
        newStatus = "delivery_scheduled";
        statusDescription = "Driver assigned for delivery";
      }
    }
    } else {
      console.log(`Ignoring event: ${event} as it's not a supported event type`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Event ignored - unsupported event type: ${event}`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`Mapping Shipday event "${event}" for ${isPickup ? "pickup" : "delivery"} to order status "${newStatus}"`);
    console.log(`Status description: "${statusDescription}"`);

    // Update tracking events
    const trackingEvents = dbOrder.tracking_events || {};
    const shipdayEvents = trackingEvents.shipday || {
      pickup_id: dbOrder.shipday_pickup_id,
      delivery_id: dbOrder.shipday_delivery_id,
      updates: [],
    };

    // Extract POD URLs and signature URL from various places in payload
    const podUrls = payload.pods || payload.order?.podUrls || [];
    const signatureUrl = payload.signatures?.[0] || payload.order?.signatureUrl || null;

    if (event === "ORDER_POD_UPLOAD") {
      // For POD uploads, update the most recent matching event with POD data
      const existingUpdates = shipdayEvents.updates || [];
      let updatedExistingEvent = false;

      // Find the most recent COMPLETED event for this order ID and update it with POD data
      for (let i = existingUpdates.length - 1; i >= 0; i--) {
        if (existingUpdates[i].orderId === shipdayOrderId && existingUpdates[i].event === "ORDER_COMPLETED") {
          existingUpdates[i].podUrls = podUrls;
          existingUpdates[i].signatureUrl = signatureUrl;
          updatedExistingEvent = true;
          console.log(`Updated existing COMPLETED event with POD data for order ${shipdayOrderId}`);
          break;
        }
      }

      // If no existing COMPLETED event found, create a new event
      if (!updatedExistingEvent) {
        // If we're treating this POD upload as completion (newStatus changed), create a COMPLETED event
        const eventType = (newStatus === "collected" || newStatus === "delivered") ? "ORDER_COMPLETED" : event;
        
        shipdayEvents.updates = [
          ...existingUpdates,
          {
            status: order.order_status,
            event: eventType,
            timestamp: new Date().toISOString(),
            orderId: shipdayOrderId,
            description: statusDescription,
            podUrls: podUrls,
            signatureUrl: signatureUrl
          },
        ];
        console.log(`Created new ${eventType} event for order ${shipdayOrderId}`);
      }
    } else {
      // For other events, add the new update to the updates array
      shipdayEvents.updates = [
        ...(shipdayEvents.updates || []),
        {
          status: order.order_status,
          event: event,
          timestamp: new Date().toISOString(),
          orderId: shipdayOrderId,
          description: statusDescription,
          podUrls: podUrls,
          signatureUrl: signatureUrl
        },
      ];
    }

    trackingEvents.shipday = shipdayEvents;

    // Update the order
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: newStatus,
        tracking_events: trackingEvents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dbOrder.id);

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
    }

    // Send delivery confirmation emails if status is "delivered"
    if (newStatus === "delivered") {
      try {
        console.log("Sending delivery confirmation emails for order:", dbOrder.id);
        
        const emailResponse = await supabase.functions.invoke("send-email", {
          body: {
            meta: {
              action: "delivery_confirmation",
              orderId: dbOrder.id
            }
          }
        });
        
        if (emailResponse.error) {
          console.error("Error triggering delivery confirmation emails:", emailResponse.error);
        } else {
          console.log("Successfully triggered delivery confirmation emails");
        }
      } catch (emailError) {
        console.error("Error sending delivery confirmation emails:", emailError);
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
  
  let collectionStatus: string | null = null;
  let deliveryStatus: string | null = null;
  
  switch (orderStatus) {
    case 'scheduled':
      collectionStatus = 'scheduled';
      deliveryStatus = 'scheduled';
      break;
    case 'scheduled_dates_pending':
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
      return true;
  }
  
  if (collectionStatus) {
    const { error: collectionError } = await supabase
      .from("jobs")
      .update({ status: collectionStatus })
      .eq("order_id", orderId)
      .eq("type", 'collection');
    
    if (collectionError) throw collectionError;
  }
  
  if (deliveryStatus) {
    const { error: deliveryError } = await supabase
      .from("jobs")
      .update({ status: deliveryStatus })
      .eq("order_id", orderId)
      .eq("type", 'delivery');
    
    if (deliveryError) throw deliveryError;
  }
  
  return true;
}
