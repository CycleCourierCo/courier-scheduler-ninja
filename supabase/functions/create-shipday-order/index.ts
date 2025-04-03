
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
  pickupTime?: string; 
  expectedDeliveryTime?: string;
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    // Parse request body
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

    const { orderId } = body;

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

    let scheduledPickupDate = null;
    let scheduledDeliveryDate = null;
    
    if (order.scheduled_pickup_date) {
      scheduledPickupDate = new Date(order.scheduled_pickup_date);
    }
    
    if (order.scheduled_delivery_date) {
      scheduledDeliveryDate = new Date(order.scheduled_delivery_date);
    }
    
    const pickupTimeFormatted = formatDateForShipday(scheduledPickupDate);
    const pickupTimeOnlyFormatted = formatTimeOnly(scheduledPickupDate);
    const deliveryTimeFormatted = formatTimeOnly(scheduledDeliveryDate);
    
    const expectedDeliveryDateFormatted = formatDateOnly(scheduledDeliveryDate);
    const expectedPickupDateFormatted = formatDateOnly(scheduledPickupDate);
    
    console.log("Formatted pickup time:", pickupTimeFormatted);
    console.log("Formatted pickup time (HH:MM:SS):", pickupTimeOnlyFormatted);
    console.log("Formatted delivery time (HH:MM:SS):", deliveryTimeFormatted);
    console.log("Expected delivery date (date only):", expectedDeliveryDateFormatted);
    console.log("Expected pickup date (date only):", expectedPickupDateFormatted);

    const baseDeliveryInstructions = order.delivery_instructions || '';
    const senderNotes = order.sender_notes || '';
    const pickupInstructions = [baseDeliveryInstructions, senderNotes].filter(Boolean).join(' | ');
    
    const receiverNotes = order.receiver_notes || '';
    const deliveryInstructions = [baseDeliveryInstructions, receiverNotes].filter(Boolean).join(' | ');

    // Use the tracking number as the order reference
    const orderReference = order.tracking_number || orderId.substring(0, 8);

    const pickupOrderData: OrderRequest = {
      orderNumber: `${orderReference}-PICKUP`,
      customerName: sender.name,
      customerPhoneNumber: sender.phone,
      customerEmail: sender.email || undefined,
      customerAddress: senderAddress,
      restaurantName: "Cycle Courier Co.",
      restaurantAddress: "Lawden road, birmingham, b100ad, united kingdom",
      orderType: "PICKUP",
      pickupTime: pickupTimeFormatted,
      expectedDeliveryTime: pickupTimeOnlyFormatted,
      expectedPickupDate: expectedPickupDateFormatted,
      expectedDeliveryDate: expectedPickupDateFormatted,
      deliveryInstruction: pickupInstructions
    };

    const deliveryOrderData: OrderRequest = {
      orderNumber: `${orderReference}-DELIVERY`,
      customerName: receiver.name,
      customerPhoneNumber: receiver.phone,
      customerEmail: receiver.email || undefined,
      customerAddress: receiverAddress,
      restaurantName: "Cycle Courier Co.",
      restaurantAddress: "Lawden road, birmingham, b100ad, united kingdom",
      orderType: "DELIVERY",
      expectedDeliveryTime: deliveryTimeFormatted,
      expectedDeliveryDate: expectedDeliveryDateFormatted,
      deliveryInstruction: deliveryInstructions
    };

    console.log("Creating Shipday pickup order with payload:", JSON.stringify(pickupOrderData, null, 2));
    console.log("Creating Shipday delivery order with payload:", JSON.stringify(deliveryOrderData, null, 2));

    const authHeader = `Basic ${shipdayApiKey}`;
    
    // Properly handle the pickup request with error handling
    let pickupResponse;
    let pickupResponseText;
    let pickupResponseData;
    
    try {
      pickupResponse = await fetch("https://api.shipday.com/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify(pickupOrderData)
      });
      
      pickupResponseText = await pickupResponse.text();
      console.log(`Shipday pickup API response status: ${pickupResponse.status}`);
      console.log(`Shipday pickup API response body: ${pickupResponseText}`);
      
      try {
        if (pickupResponseText) {
          pickupResponseData = JSON.parse(pickupResponseText);
        } else {
          pickupResponseData = { status: pickupResponse.status };
        }
      } catch (e) {
        console.error("Error parsing pickup response:", e);
        pickupResponseData = { 
          rawResponse: pickupResponseText,
          status: pickupResponse.status,
          parseError: e.message
        };
      }
    } catch (e) {
      console.error("Error sending pickup request to Shipday:", e);
      pickupResponseData = {
        error: e.message,
        networkError: true
      };
      pickupResponse = { ok: false, status: 500 };
    }

    // Similarly handle the delivery request with error handling
    let deliveryResponse;
    let deliveryResponseText;
    let deliveryResponseData;
    
    try {
      deliveryResponse = await fetch("https://api.shipday.com/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify(deliveryOrderData)
      });
      
      deliveryResponseText = await deliveryResponse.text();
      console.log(`Shipday delivery API response status: ${deliveryResponse.status}`);
      console.log(`Shipday delivery API response body: ${deliveryResponseText}`);
      
      try {
        if (deliveryResponseText) {
          deliveryResponseData = JSON.parse(deliveryResponseText);
        } else {
          deliveryResponseData = { status: deliveryResponse.status };
        }
      } catch (e) {
        console.error("Error parsing delivery response:", e);
        deliveryResponseData = { 
          rawResponse: deliveryResponseText,
          status: deliveryResponse.status,
          parseError: e.message
        };
      }
    } catch (e) {
      console.error("Error sending delivery request to Shipday:", e);
      deliveryResponseData = {
        error: e.message,
        networkError: true
      };
      deliveryResponse = { ok: false, status: 500 };
    }
    
    if ((!pickupResponse || !pickupResponse.ok) || (!deliveryResponse || !deliveryResponse.ok)) {
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
    
    // Store the individual tracking numbers from Shipday
    const shipdayPickupId = pickupResponseData?.orderId || 
                           `SD-P-${pickupResponseData?.id}` || 
                           pickupResponseData?.trackingNumber || 
                           `SD-P-${Date.now()}`;
    
    const shipdayDeliveryId = deliveryResponseData?.orderId || 
                             `SD-D-${deliveryResponseData?.id}` || 
                             deliveryResponseData?.trackingNumber || 
                             `SD-D-${Date.now()}`;
    
    // Now store IDs in both tracking_events and the new dedicated columns
    const trackingEvents = order.tracking_events || {};
    trackingEvents.shipday = {
      pickup_id: shipdayPickupId,
      delivery_id: shipdayDeliveryId,
      created_at: new Date().toISOString()
    };

    // Update the order with both tracking_events JSON and the new dedicated columns
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        tracking_events: trackingEvents,
        shipday_pickup_id: shipdayPickupId,
        shipday_delivery_id: shipdayDeliveryId,
        updated_at: new Date().toISOString()
      })
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
      JSON.stringify({ error: err.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
