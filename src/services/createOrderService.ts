
import { supabase } from "@/integrations/supabase/client";
import { Order, CreateOrderFormData, OrderStatus } from "@/types/order";
import { mapDbOrderToOrderType } from "./utils/orderMappers";

/**
 * Creates a new order in the database
 */
export const createOrder = async (data: CreateOrderFormData): Promise<Order> => {
  // Get current user ID from Supabase auth - improved error handling
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    throw new Error("User not authenticated");
  }

  const userId = userData.user.id;

  // Create the order in the database - include all fields from the form data
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      sender: data.sender,
      receiver: data.receiver,
      status: "created" as OrderStatus,
      bike_brand: data.bikeBrand,
      bike_model: data.bikeModel,
      customer_order_number: data.customerOrderNumber,
      needs_payment_on_collection: data.needsPaymentOnCollection,
      is_bike_swap: data.isBikeSwap,
      delivery_instructions: data.deliveryInstructions
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
