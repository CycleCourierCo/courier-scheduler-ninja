
import { supabase } from "@/integrations/supabase/client";
import { CreateOrderFormData, Order } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";

export const createOrder = async (data: CreateOrderFormData): Promise<Order> => {
  // Get current user ID from Supabase auth session
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.user?.id) {
    throw new Error("User not authenticated");
  }

  // Format delivery instructions to include bike swap and payment status
  let formattedDeliveryInstructions = data.deliveryInstructions || '';
  
  // Add bike swap information
  if (data.isBikeSwap) {
    formattedDeliveryInstructions = `[BIKE SWAP] ${formattedDeliveryInstructions}`;
  }
  
  // Add payment information
  if (data.needsPaymentOnCollection) {
    formattedDeliveryInstructions = `[PAYMENT REQUIRED ON COLLECTION] ${formattedDeliveryInstructions}`;
  }

  // Create the item name by combining brand and model
  const itemName = `${data.bikeBrand} ${data.bikeModel}`.trim();
  
  // Create an item object
  const item = {
    name: itemName,
    quantity: 1,
    price: 0
  };

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: session.session.user.id,
      sender: data.sender,
      receiver: data.receiver,
      bike_brand: data.bikeBrand,
      bike_model: data.bikeModel,
      customer_order_number: data.customerOrderNumber,
      needs_payment_on_collection: data.needsPaymentOnCollection,
      is_bike_swap: data.isBikeSwap,
      delivery_instructions: formattedDeliveryInstructions,
      status: "created",
      pickup_date: null,  // Will be set when sender confirms availability
      delivery_date: null // Will be set when receiver confirms availability
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
        emailType: "sender",
        item: item
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
