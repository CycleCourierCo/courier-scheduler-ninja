
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { corsHeaders } from "../_shared/cors.ts";

interface OrderRequest {
  orderNumber: string;
  customerName: string;
  customerAddress: string;
  customerEmail?: string;
  customerPhoneNumber: string;
  restaurantName: string;
  restaurantAddress: string;
  expectedPickupTime?: string;   // Start of time window
  expectedDeliveryTime?: string; // End of time window
  orderType?: string;
  expectedDeliveryDate?: string;
  expectedPickupDate?: string;
  deliveryInstruction?: string;
}

const formatDateForShipday = (date: Date | null) => {
  if (!date) return undefined;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const formatDateOnly = (date: Date | null) => {
  if (!date) return undefined;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

const formatTimeOnly = (date: Date | null) => {
  if (!date) return undefined;
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = "00";
  
  return `${hours}:${minutes}:${seconds}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("Error parsing request body:", e);
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { orderId, jobType } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Order ID is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return new Response(
        JSON.stringify({ error: error?.message || "Order not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const shipdayApiKey = Deno.env.get("SHIPDAY_API_KEY");
    
    if (!shipdayApiKey) {
      return new Response(
        JSON.stringify({ error: "Shipday API key is not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const sender = order.sender;
    const receiver = order.receiver;

    const senderAddress = `${sender.address.street}, ${sender.address.city}, ${sender.address.state} ${sender.address.zipCode}`;
    
    const receiverAddress = `${receiver.address.street}, ${receiver.address.city}, ${receiver.address.state} ${receiver.address.zipCode}`;

    // Parse timeslots and create 3-hour windows (same as send-timeslot-whatsapp)
    const parseTimeSlot = (timeslot: string | null | undefined): { start: string; end: string } => {
      if (!timeslot) {
        // Default to 09:00 if no timeslot set
        return { start: '09:00:00', end: '12:00:00' };
      }
      
      // Handle both "HH:MM" and "HH:MM:SS" formats
      const [hourStr, minuteStr] = timeslot.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10) || 0;
      
      const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
      const endHour = Math.min(23, hour + 3); // 3-hour window, capped at 23:00
      const endTime = `${endHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
      
      return { start: startTime, end: endTime };
    };

    // Get the actual timeslots from the order
    const pickupWindow = parseTimeSlot(order.pickup_timeslot);
    const deliveryWindow = parseTimeSlot(order.delivery_timeslot);
    
    console.log('Pickup timeslot from order:', order.pickup_timeslot, '-> Window:', pickupWindow);
    console.log('Delivery timeslot from order:', order.delivery_timeslot, '-> Window:', deliveryWindow);

    // Get DATE portion from scheduled dates, default to tomorrow if not set
    let expectedPickupDateFormatted: string;
    let expectedDeliveryDateFormatted: string;
    
    if (order.scheduled_pickup_date) {
      expectedPickupDateFormatted = formatDateOnly(new Date(order.scheduled_pickup_date)) || '';
    } else {
      expectedPickupDateFormatted = formatDateOnly(new Date(Date.now() + 24 * 60 * 60 * 1000)) || '';
    }
    
    if (order.scheduled_delivery_date) {
      expectedDeliveryDateFormatted = formatDateOnly(new Date(order.scheduled_delivery_date)) || '';
    } else {
      expectedDeliveryDateFormatted = formatDateOnly(new Date(Date.now() + 24 * 60 * 60 * 1000)) || '';
    }
    
    console.log("Expected pickup date:", expectedPickupDateFormatted);
    console.log("Expected delivery date:", expectedDeliveryDateFormatted);

    // Build comprehensive delivery instructions with all order details
    const bikeInfo = order.bike_brand && order.bike_model 
      ? `Bike: ${order.bike_brand} ${order.bike_model}` 
      : order.bike_brand 
        ? `Bike: ${order.bike_brand}` 
        : order.bike_model 
          ? `Bike: ${order.bike_model}` 
          : '';

    // Build common order details array
    const orderDetails = [];
    if (bikeInfo) orderDetails.push(bikeInfo);
    if (order.customer_order_number) orderDetails.push(`Order #: ${order.customer_order_number}`);
    if (order.collection_code) orderDetails.push(`eBay Code: ${order.collection_code}`);
    if (order.needs_payment_on_collection) orderDetails.push('Payment required on collection');
    if (order.is_ebay_order) orderDetails.push('eBay Order');
    if (order.is_bike_swap) orderDetails.push('Bike Swap');

    const baseDeliveryInstructions = order.delivery_instructions || '';
    const senderNotes = order.sender_notes || '';
    const pickupInstructions = [
      ...orderDetails,
      baseDeliveryInstructions,
      senderNotes
    ].filter(Boolean).join(' | ');
    
    const receiverNotes = order.receiver_notes || '';
    const deliveryInstructions = [
      ...orderDetails,
      baseDeliveryInstructions,
      receiverNotes
    ].filter(Boolean).join(' | ');

    const orderReference = order.tracking_number || orderId.substring(0, 8);

    // Create pickup order with correct timeslot window
    const pickupOrderData: OrderRequest = {
      orderNumber: `${orderReference}-PICKUP`,
      customerName: sender.name,
      customerPhoneNumber: sender.phone,
      customerEmail: sender.email || undefined,
      customerAddress: senderAddress,
      restaurantName: "Cycle Courier Co.",
      restaurantAddress: "Lawden road, birmingham, b100ad, united kingdom",
      orderType: "PICKUP",
      expectedPickupTime: pickupWindow.start,  // Start of 3-hour window
      expectedDeliveryTime: pickupWindow.end,  // End of 3-hour window
      expectedPickupDate: expectedPickupDateFormatted,
      expectedDeliveryDate: expectedPickupDateFormatted,
      deliveryInstruction: pickupInstructions
    };

    // Create delivery order with correct timeslot window
    const deliveryOrderData: OrderRequest = {
      orderNumber: `${orderReference}-DELIVERY`,
      customerName: receiver.name,
      customerPhoneNumber: receiver.phone,
      customerEmail: receiver.email || undefined,
      customerAddress: receiverAddress,
      restaurantName: "Cycle Courier Co.",
      restaurantAddress: "Lawden road, birmingham, b100ad, united kingdom",
      orderType: "DELIVERY",
      expectedPickupTime: deliveryWindow.start,  // Start of 3-hour window
      expectedDeliveryTime: deliveryWindow.end,  // End of 3-hour window
      expectedDeliveryDate: expectedDeliveryDateFormatted,
      deliveryInstruction: deliveryInstructions
    };

    const authHeader = `Basic ${shipdayApiKey}`;
    
    let pickupResponse = null;
    let pickupResponseData = null;
    let deliveryResponse = null;
    let deliveryResponseData = null;
    
    const createPickup = !jobType || jobType === 'pickup';
    const createDelivery = !jobType || jobType === 'delivery';
    
    if (createPickup) {
      console.log("Creating Shipday pickup order with payload:", JSON.stringify(pickupOrderData, null, 2));
      
      try {
        const response = await fetch("https://api.shipday.com/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader
          },
          body: JSON.stringify(pickupOrderData)
        });
        
        const responseText = await response.text();
        console.log(`Shipday pickup API response status: ${response.status}`);
        console.log(`Shipday pickup API response body: ${responseText}`);
        
        try {
          pickupResponseData = responseText ? JSON.parse(responseText) : { status: response.status };
        } catch (e) {
          pickupResponseData = { 
            rawResponse: responseText,
            status: response.status,
            parseError: e instanceof Error ? e.message : 'Parse error'
          };
        }
        
        pickupResponse = response;
      } catch (e) {
        console.error("Error sending pickup request to Shipday:", e);
        pickupResponseData = {
          error: e instanceof Error ? e.message : 'Network error',
          networkError: true
        };
      }
    }
    
    if (createDelivery) {
      console.log("Creating Shipday delivery order with payload:", JSON.stringify(deliveryOrderData, null, 2));
      
      try {
        const response = await fetch("https://api.shipday.com/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader
          },
          body: JSON.stringify(deliveryOrderData)
        });
        
        const responseText = await response.text();
        console.log(`Shipday delivery API response status: ${response.status}`);
        console.log(`Shipday delivery API response body: ${responseText}`);
        
        try {
          deliveryResponseData = responseText ? JSON.parse(responseText) : { status: response.status };
        } catch (e) {
          deliveryResponseData = { 
            rawResponse: responseText,
            status: response.status,
            parseError: e instanceof Error ? e.message : 'Parse error'
          };
        }
        
        deliveryResponse = response;
      } catch (e) {
        console.error("Error sending delivery request to Shipday:", e);
        deliveryResponseData = {
          error: e instanceof Error ? e.message : 'Network error',
          networkError: true
        };
      }
    }
    
    const pickupFailed = createPickup && (!pickupResponse || !pickupResponse.ok);
    const deliveryFailed = createDelivery && (!deliveryResponse || !deliveryResponse.ok);
    
    if (pickupFailed || deliveryFailed) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to create orders in Shipday", 
          pickup_status: pickupResponse?.status,
          pickup_response: pickupResponseData,
          delivery_status: deliveryResponse?.status,
          delivery_response: deliveryResponseData
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    const shipdayPickupId = createPickup && pickupResponseData ? 
                           (pickupResponseData?.orderId || 
                           `SD-P-${pickupResponseData?.id}` || 
                           pickupResponseData?.trackingNumber || 
                           `SD-P-${Date.now()}`) : null;
    
    const shipdayDeliveryId = createDelivery && deliveryResponseData ? 
                             (deliveryResponseData?.orderId || 
                             `SD-D-${deliveryResponseData?.id}` || 
                             deliveryResponseData?.trackingNumber || 
                             `SD-D-${Date.now()}`) : null;
    
    const trackingEvents = order.tracking_events || {};
    
    if (!trackingEvents.shipday) {
      trackingEvents.shipday = {};
    }
    
    if (createPickup && shipdayPickupId) {
      trackingEvents.shipday.pickup_id = shipdayPickupId;
    }
    
    if (createDelivery && shipdayDeliveryId) {
      trackingEvents.shipday.delivery_id = shipdayDeliveryId;
    }
    
    trackingEvents.shipday.created_at = new Date().toISOString();

    const updateData: Record<string, any> = {
      tracking_events: trackingEvents,
      updated_at: new Date().toISOString()
    };
    
    if (createPickup && shipdayPickupId) {
      updateData.shipday_pickup_id = shipdayPickupId;
    }
    
    if (createDelivery && shipdayDeliveryId) {
      updateData.shipday_delivery_id = shipdayDeliveryId;
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Orders created in Shipday successfully", 
        shipdayPickupId,
        shipdayDeliveryId,
        trackingNumber: order.tracking_number,
        pickup_response: pickupResponseData,
        delivery_response: deliveryResponseData
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("Error processing request:", err);
    
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
