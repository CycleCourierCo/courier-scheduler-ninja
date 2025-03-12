
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

    // Extract order details
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

    // Create Shipday order payload
    const shipdayPayload = {
      orderNumber: order.id,
      customerName: receiver.name,
      customerEmail: receiver.email,
      customerPhone: receiver.phone,
      customerAddress: `${receiver.address.street}, ${receiver.address.city}, ${receiver.address.state} ${receiver.address.zipCode}`,
      pickupName: sender.name,
      pickupAddress: `${sender.address.street}, ${sender.address.city}, ${sender.address.state} ${sender.address.zipCode}`,
      pickupPhone: sender.phone,
      pickupEmail: sender.email,
      pickupTime: scheduledPickupDate,
      deliveryTime: scheduledDeliveryDate
    };

    console.log("Creating Shipday order with payload:", shipdayPayload);

    // Get the Shipday API key from environment variables
    const shipdayApiKey = Deno.env.get("SHIPDAY_API_KEY");
    
    if (!shipdayApiKey) {
      console.error("Shipday API key is not set in environment variables");
      return new Response(
        JSON.stringify({ error: "Shipday API key is not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    // Make the actual API call to Shipday
    const response = await fetch("https://api.shipday.com/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${shipdayApiKey}:`)}`
      },
      body: JSON.stringify(shipdayPayload)
    });
    
    // Check for API call success
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Shipday API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: "Failed to create order in Shipday", 
          details: errorText,
          status: response.status 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    const shipdayResponse = await response.json();
    console.log("Shipday API response:", shipdayResponse);
    
    // Extract tracking number from the Shipday response
    // Note: Adjust the property name based on what Shipday actually returns
    const trackingNumber = shipdayResponse.trackingNumber || 
                          shipdayResponse.tracking || 
                          `SD-${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`;

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
        message: "Order created in Shipday", 
        trackingNumber,
        shipdayResponse 
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
