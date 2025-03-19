import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

// Simplified interface for the required order fields
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
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get request data
    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Order ID is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get order data
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

    // Check if order already has a tracking number
    if (order.tracking_number) {
      console.log(`Order ${orderId} already has tracking number: ${order.tracking_number}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Order already exists in Shipday", 
          trackingNumber: order.tracking_number
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get Shipday API key from env
    const shipdayApiKey = Deno.env.get("SHIPDAY_API_KEY");
    
    if (!shipdayApiKey) {
      return new Response(
        JSON.stringify({ error: "Shipday API key is not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const sender = order.sender;
    const receiver = order.receiver;

    // Build sender address
    const senderAddress = `${sender.address.street}, ${sender.address.city}, ${sender.address.state} ${sender.address.zipCode}`;
    
    // Build receiver address
    const receiverAddress = `${receiver.address.street}, ${receiver.address.city}, ${receiver.address.state} ${receiver.address.zipCode}`;

    // Parse dates from the order
    let scheduledPickupDate = null;
    let scheduledDeliveryDate = null;
    
    if (order.scheduled_pickup_date) {
      scheduledPickupDate = new Date(order.scheduled_pickup_date);
    }
    
    if (order.scheduled_delivery_date) {
      scheduledDeliveryDate = new Date(order.scheduled_delivery_date);
    }
    
    // Format dates for Shipday (YYYY-MM-DD HH:MM:SS) for time fields
    const formatDateForShipday = (date: Date | null) => {
      if (!date) return undefined;
      
      // Format date to YYYY-MM-DD HH:MM:SS
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };
    
    // Format dates for Shipday (YYYY-MM-DD) for expectedDeliveryDate and expectedPickupDate
    const formatDateOnly = (date: Date | null) => {
      if (!date) return undefined;
      
      // Format date to YYYY-MM-DD (without time)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    };
    
    // Format time only for Shipday (HH:MM:SS) for expectedDeliveryTime
    const formatTimeOnly = (date: Date | null) => {
      if (!date) return undefined;
      
      // Format time to HH:MM:SS
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = "00"; // Default seconds to 00
      
      return `${hours}:${minutes}:${seconds}`;
    };
    
    // Format the delivery and pickup times for Shipday
    const pickupTimeFormatted = formatDateForShipday(scheduledPickupDate);
    const pickupTimeOnlyFormatted = formatTimeOnly(scheduledPickupDate); // Add time-only format for pickup
    const deliveryTimeFormatted = formatTimeOnly(scheduledDeliveryDate); // Changed to use time-only format
    
    // Format expected dates (date only without time) for Shipday API requirements
    const expectedDeliveryDateFormatted = formatDateOnly(scheduledDeliveryDate);
    const expectedPickupDateFormatted = formatDateOnly(scheduledPickupDate);
    
    console.log("Formatted pickup time:", pickupTimeFormatted);
    console.log("Formatted pickup time (HH:MM:SS):", pickupTimeOnlyFormatted);
    console.log("Formatted delivery time (HH:MM:SS):", deliveryTimeFormatted);
    console.log("Expected delivery date (date only):", expectedDeliveryDateFormatted);
    console.log("Expected pickup date (date only):", expectedPickupDateFormatted);

    // Create the pickup order
    const pickupOrderData: OrderRequest = {
      orderNumber: `${orderId.substring(0, 8)}-PICKUP`,
      customerName: sender.name,
      customerPhoneNumber: sender.phone,
      customerEmail: sender.email || undefined,
      customerAddress: senderAddress,
      restaurantName: "Cycle Courier Co.",
      restaurantAddress: "Lawden road, birmingham, b100ad, united kingdom",
      orderType: "PICKUP",
      pickupTime: pickupTimeFormatted, // Use exact time from user input
      expectedDeliveryTime: pickupTimeOnlyFormatted, // Added expectedDeliveryTime for pickup order
      expectedPickupDate: expectedPickupDateFormatted, // Date only format
      expectedDeliveryDate: expectedPickupDateFormatted // Set expected delivery date to pickup date
    };

    // Create the delivery order with delivery time
    const deliveryOrderData: OrderRequest = {
      orderNumber: `${orderId.substring(0, 8)}-DELIVERY`,
      customerName: receiver.name,
      customerPhoneNumber: receiver.phone,
      customerEmail: receiver.email || undefined,
      customerAddress: receiverAddress,
      restaurantName: "Cycle Courier Co.",
      restaurantAddress: "Lawden road, birmingham, b100ad, united kingdom",
      orderType: "DELIVERY",
      expectedDeliveryTime: deliveryTimeFormatted, // Changed from deliveryTime to expectedDeliveryTime with HH:MM:SS format
      expectedDeliveryDate: expectedDeliveryDateFormatted // Date only format for Shipday
    };

    console.log("Creating Shipday pickup order with payload:", JSON.stringify(pickupOrderData, null, 2));
    console.log("Creating Shipday delivery order with payload:", JSON.stringify(deliveryOrderData, null, 2));

    try {
      // Basic Auth - Correctly formatted per Shipday documentation
      const authHeader = `Basic ${shipdayApiKey}`;
      
      // Make the API calls to Shipday
      const pickupResponse = await fetch("https://api.shipday.com/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify(pickupOrderData)
      });
      
      const pickupResponseText = await pickupResponse.text();
      console.log(`Shipday pickup API response status: ${pickupResponse.status}`);
      console.log(`Shipday pickup API response body: ${pickupResponseText}`);
      
      let pickupResponseData;
      try {
        pickupResponseData = JSON.parse(pickupResponseText);
      } catch (e) {
        pickupResponseData = { rawResponse: pickupResponseText };
      }

      // Now create the delivery order
      const deliveryResponse = await fetch("https://api.shipday.com/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify(deliveryOrderData)
      });
      
      const deliveryResponseText = await deliveryResponse.text();
      console.log(`Shipday delivery API response status: ${deliveryResponse.status}`);
      console.log(`Shipday delivery API response body: ${deliveryResponseText}`);
      
      let deliveryResponseData;
      try {
        deliveryResponseData = JSON.parse(deliveryResponseText);
      } catch (e) {
        deliveryResponseData = { rawResponse: deliveryResponseText };
      }
      
      // Check if either API call failed
      if (!pickupResponse.ok || !deliveryResponse.ok) {
        return new Response(
          JSON.stringify({ 
            error: "Failed to create orders in Shipday", 
            pickup_status: pickupResponse.status,
            pickup_response: pickupResponseData,
            delivery_status: deliveryResponse.status,
            delivery_response: deliveryResponseData
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      // Extract tracking numbers from the Shipday responses
      const pickupTrackingNumber = pickupResponseData.orderId || 
                                 `SD-P-${pickupResponseData.id}` || 
                                 pickupResponseData.trackingNumber;
      
      const deliveryTrackingNumber = deliveryResponseData.orderId || 
                                   `SD-D-${deliveryResponseData.id}` || 
                                   deliveryResponseData.trackingNumber;
      
      // Combine tracking numbers
      const combinedTrackingNumber = `P:${pickupTrackingNumber},D:${deliveryTrackingNumber}`;

      console.log("Successfully created orders in Shipday with tracking numbers:", combinedTrackingNumber);

      // Update the order with the tracking numbers but keep the current status
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          tracking_number: combinedTrackingNumber,
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
          trackingNumber: combinedTrackingNumber,
          pickup_response: pickupResponseData,
          delivery_response: deliveryResponseData
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } catch (apiError) {
      console.error("Error calling Shipday API:", apiError);
      
      return new Response(
        JSON.stringify({ 
          error: "Error calling Shipday API", 
          details: apiError.message
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
  } catch (err) {
    console.error("Error processing request:", err);
    
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
