import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { requireAuth, requireAdminAuth, createAuthErrorResponse } from '../_shared/auth.ts';

// Function to generate a custom order ID
// Format: CCC + 754 + 9-digit sequence + first 3 letters of sender name + first 3 letters of receiver zipcode
const generateCustomOrderId = (senderName: string, receiverZipCode: string): string => {
  // Create a random 9-digit number
  const randomDigits = Math.floor(100000000 + Math.random() * 900000000);
  
  // Get first 3 letters of sender name (uppercase)
  const senderPrefix = senderName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  
  // Get first 3 characters of receiver zipcode
  const zipSuffix = (receiverZipCode || '').substring(0, 3).toUpperCase();
  
  // Combine all parts - ensure we use the correct prefix CCC754 and trim any spaces
  return `CCC754${randomDigits}${senderPrefix}${zipSuffix}`.trim().replace(/\s+/g, '');
};

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
    // Parse request body first to determine auth level needed
    const reqBody = await req.json().catch(() => ({}));
    console.log("Request body:", JSON.stringify(reqBody));
    
    // Handle single tracking number generation (no database update)
    // Allow any authenticated user for this operation
    if (reqBody.generateSingle === true) {
      // Allow service role key (used when called from other edge functions like orders)
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '') || '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

      if (token === serviceRoleKey) {
        console.log('Authenticated via service role key for single tracking generation');
      } else {
        const authResult = await requireAuth(req);
        if (!authResult.success) {
          return createAuthErrorResponse(authResult.error!, authResult.status!);
        }
        console.log('Authenticated user for single tracking generation:', authResult.userId);
      }
      
      console.log("Generating single tracking number");
      const senderName = reqBody.senderName || "UNKNOWN";
      const receiverZipCode = reqBody.receiverZipCode || "000";
      
      const trackingNumber = generateCustomOrderId(senderName, receiverZipCode);
      console.log("Generated tracking number:", trackingNumber);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          trackingNumber
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    
    // For all other operations (bulk update, specific order update)
    // Require admin authentication
    const authResult = await requireAdminAuth(req);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult.error!, authResult.status!);
    }
    console.log('Authenticated admin:', authResult.userId);

    console.log("Received request to generate tracking numbers");
    
    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get specific order ID if provided
    const specificOrderId = reqBody.specificOrderId;
    const forceAll = reqBody.forceAll === true;

    // Build query for orders
    let query = supabase.from("orders").select("*");
    
    // If specific order ID is provided, only get that order
    if (specificOrderId) {
      query = query.eq("id", specificOrderId);
    }
    // If not forcing all and no specific ID, only get orders with problematic tracking numbers
    else if (!forceAll) {
      query = query.or(
        "tracking_number.is.null,tracking_number.ilike.P:%,tracking_number.ilike.SD-%,tracking_number.not.ilike.CCC754%"
      );
    }
    
    const { data: orders, error } = await query;

    if (error) {
      console.error("Error fetching orders:", error);
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

        // Generate a tracking number - ensure it has no spaces
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
            error: updateError.message,
            oldTrackingNumber: order.tracking_number
          });
        } else {
          results.push({ 
            id: order.id, 
            success: true, 
            trackingNumber,
            oldTrackingNumber: order.tracking_number
          });
        }
      } catch (err) {
        console.error(`Error processing order ${order.id}:`, err);
        results.push({ 
          id: order.id, 
          success: false, 
          error: err instanceof Error ? err.message : 'Unknown error',
          oldTrackingNumber: order.tracking_number
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
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
