
import { supabase } from "@/integrations/supabase/client";
import { Order, CreateOrderFormData, OrderStatus } from "@/types/order";
import { mapDbOrderToOrderType } from "./utils/orderMappers";

/**
 * Creates a new order in the database
 */
export const createOrder = async (data: CreateOrderFormData): Promise<Order> => {
  // Get current user ID from Supabase auth - improved error handling
  const { data: sessionData, error: userError } = await supabase.auth.getSession();
  
  if (userError || !sessionData.session) {
    throw new Error("User not authenticated");
  }

  // Create the order in the database using the exact pattern provided
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: sessionData.session.user.id,
      sender: data.sender,
      receiver: data.receiver,
      bike_brand: data.bikeBrand,
      bike_model: data.bikeModel,
      customer_order_number: data.customerOrderNumber,
      needs_payment_on_collection: data.needsPaymentOnCollection,
      is_bike_swap: data.isBikeSwap,
      delivery_instructions: data.deliveryInstructions,
      status: "created" as OrderStatus
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating order:", error);
    throw new Error(error.message);
  }

  // Send email to sender after order creation
  try {
    const baseUrl = window.location.origin;
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: data.sender.email,
        name: data.sender.name,
        orderId: order.id,
        baseUrl,
        emailType: "sender" 
      }
    });
    
    if (response.error) {
      console.error("Error sending email:", response.error);
    } else {
      console.log("Email sent successfully to sender:", data.sender.email);
    }
  } catch (emailError) {
    console.error("Failed to send email:", emailError);
    // Don't throw here - we don't want to fail the order creation if email fails
  }

  return mapDbOrderToOrderType(order);
};
