
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

// Function to generate a custom order ID
// Format: CCC + 754 + 9-digit sequence + first 3 letters of sender name + first 3 letters of receiver zipcode
const generateCustomOrderId = (senderName: string, receiverZipCode: string): string => {
  // Create a random 9-digit number
  const randomDigits = Math.floor(100000000 + Math.random() * 900000000);
  
  // Get first 3 letters of sender name (uppercase)
  const senderPrefix = senderName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  
  // Get first 3 characters of receiver zipcode
  const zipSuffix = (receiverZipCode || '').substring(0, 3).toUpperCase();
  
  // Combine all parts
  return `CCC754${randomDigits}${senderPrefix}${zipSuffix}`;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get orders without tracking numbers or with tracking numbers that include "P:" and "D:"
    // which indicates they were generated with the wrong format
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .or("tracking_number.is.null,tracking_number.like.P:%,tracking_number.like.SD-%");

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`Found ${orders?.length || 0} orders that need correct tracking numbers`);

    // Process each order
    const results = [];
    for (const order of orders || []) {
      try {
        // Safe access to potentially missing properties
        const sender = order.sender as any || {};
        const receiver = order.receiver as any || {};
        const senderName = sender?.name || "UNKNOWN";
        const receiverZipCode = receiver?.address?.zipCode || "000";

        // Generate a tracking number
        const trackingNumber = generateCustomOrderId(senderName, receiverZipCode);
        
        // Update the order with the new tracking number
        const { error: updateError } = await supabase
          .from("orders")
          .update({ tracking_number: trackingNumber })
          .eq("id", order.id);

        if (updateError) {
          results.push({ 
            id: order.id, 
            success: false, 
            error: updateError.message 
          });
        } else {
          results.push({ 
            id: order.id, 
            success: true, 
            trackingNumber 
          });
        }
      } catch (err) {
        console.error(`Error processing order ${order.id}:`, err);
        results.push({ 
          id: order.id, 
          success: false, 
          error: err.message 
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${orders?.length || 0} orders`, 
        results 
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
