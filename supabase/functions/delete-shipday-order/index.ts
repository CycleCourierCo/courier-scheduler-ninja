import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SHIPDAY_API_KEY = Deno.env.get("SHIPDAY_API_KEY");

interface DeleteRequest {
  shipdayPickupId?: string;
  shipdayDeliveryId?: string;
}

interface DeleteResult {
  pickupDeleted: boolean;
  deliveryDeleted: boolean;
  pickupError?: string;
  deliveryError?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shipdayPickupId, shipdayDeliveryId }: DeleteRequest = await req.json();
    
    console.log("Delete Shipday jobs request:", { shipdayPickupId, shipdayDeliveryId });

    if (!SHIPDAY_API_KEY) {
      console.error("SHIPDAY_API_KEY is not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Shipday API key not configured" 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const result: DeleteResult = {
      pickupDeleted: false,
      deliveryDeleted: false,
    };

    // Delete pickup job if ID exists
    if (shipdayPickupId) {
      try {
        console.log(`Deleting Shipday pickup job: ${shipdayPickupId}`);
        const pickupResponse = await fetch(
          `https://api.shipday.com/orders/${shipdayPickupId}`,
          {
            method: "DELETE",
            headers: {
              "Authorization": `Basic ${SHIPDAY_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (pickupResponse.ok || pickupResponse.status === 404) {
          // 404 means already deleted - consider it success
          result.pickupDeleted = true;
          console.log(`Pickup job deleted successfully: ${shipdayPickupId}`);
        } else {
          const errorText = await pickupResponse.text();
          result.pickupError = `Failed to delete pickup (${pickupResponse.status}): ${errorText}`;
          console.error(result.pickupError);
        }
      } catch (error) {
        result.pickupError = `Error deleting pickup: ${error.message}`;
        console.error(result.pickupError);
      }
    }

    // Delete delivery job if ID exists
    if (shipdayDeliveryId) {
      try {
        console.log(`Deleting Shipday delivery job: ${shipdayDeliveryId}`);
        const deliveryResponse = await fetch(
          `https://api.shipday.com/orders/${shipdayDeliveryId}`,
          {
            method: "DELETE",
            headers: {
              "Authorization": `Basic ${SHIPDAY_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (deliveryResponse.ok || deliveryResponse.status === 404) {
          // 404 means already deleted - consider it success
          result.deliveryDeleted = true;
          console.log(`Delivery job deleted successfully: ${shipdayDeliveryId}`);
        } else {
          const errorText = await deliveryResponse.text();
          result.deliveryError = `Failed to delete delivery (${deliveryResponse.status}): ${errorText}`;
          console.error(result.deliveryError);
        }
      } catch (error) {
        result.deliveryError = `Error deleting delivery: ${error.message}`;
        console.error(result.deliveryError);
      }
    }

    // Return success if at least one job was deleted or if there were no jobs to delete
    const hasErrors = result.pickupError || result.deliveryError;
    const hasSuccesses = result.pickupDeleted || result.deliveryDeleted;
    const noJobsProvided = !shipdayPickupId && !shipdayDeliveryId;

    return new Response(
      JSON.stringify({ 
        success: !hasErrors || hasSuccesses || noJobsProvided,
        result 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error in delete-shipday-order function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
