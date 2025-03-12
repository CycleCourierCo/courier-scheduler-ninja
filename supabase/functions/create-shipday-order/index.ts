
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

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
    const scheduledPickupDate = order.scheduled_pickup_date;
    const scheduledDeliveryDate = order.scheduled_delivery_date;

    // Validate required fields
    if (!scheduledPickupDate || !scheduledDeliveryDate) {
      return new Response(
        JSON.stringify({ error: "Scheduled pickup and delivery dates are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Format dates for Shipday API
    const pickupDate = new Date(scheduledPickupDate);
    const deliveryDate = new Date(scheduledDeliveryDate);
    
    // Format date to YYYY-MM-DD
    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };
    
    // Format time to HH:MM:SS
    const formatTime = (date) => {
      return date.toTimeString().split(' ')[0];
    };

    // Create payload according to Shipday API documentation
    const payload = {
      orderNumber: order.id,
      customerName: receiver.name,
      customerAddress: `${receiver.address.street}, ${receiver.address.city}, ${receiver.address.state} ${receiver.address.zipCode}`,
      customerEmail: receiver.email || "",
      customerPhoneNumber: receiver.phone,
      
      restaurantName: sender.name,
      restaurantAddress: `${sender.address.street}, ${sender.address.city}, ${sender.address.state} ${sender.address.zipCode}`,
      restaurantPhoneNumber: sender.phone,
      
      expectedDeliveryDate: formatDate(deliveryDate),
      expectedPickupTime: formatTime(pickupDate),
      expectedDeliveryTime: formatTime(deliveryDate),
      
      // Optional fields
      deliveryFee: 0,
      tips: 0,
      tax: 0,
      totalOrderCost: 0,
      
      pickupInstruction: `Pickup from: ${sender.name}`,
      deliveryInstruction: `Deliver to: ${receiver.name}`,
      
      orderSource: "Courier App",
      
      paymentMethod: "cash"
    };

    console.log("Creating Shipday order with payload:", JSON.stringify(payload, null, 2));

    // Make the API call to Shipday
    const response = await fetch("https://api.shipday.com/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${shipdayApiKey}:`)}`
      },
      body: JSON.stringify(payload)
    });
    
    const responseText = await response.text();
    console.log(`Shipday API response status: ${response.status}`);
    console.log(`Shipday API response body: ${responseText}`);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { rawResponse: responseText };
    }
    
    // Check for API call success
    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to create order in Shipday", 
          shipday_error: {
            status: response.status,
            details: responseData
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: response.status }
      );
    }
    
    // Extract tracking number from the Shipday response
    const trackingNumber = responseData.id || responseData.orderId || responseData.trackingNumber;
    
    if (!trackingNumber) {
      return new Response(
        JSON.stringify({ 
          error: "Shipday API did not return a tracking number", 
          shipday_response: responseData 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("Successfully created order in Shipday with tracking number:", trackingNumber);

    // Update the order with the tracking number and change status to shipped
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        tracking_number: trackingNumber,
        status: "shipped",
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
        message: "Order created in Shipday successfully", 
        trackingNumber,
        shipday_response: responseData 
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
