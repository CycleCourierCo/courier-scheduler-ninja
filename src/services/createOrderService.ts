
import { supabase } from "@/integrations/supabase/client";
import { CreateOrderFormData, Order } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";

// Function to generate a custom order ID
// Format: CCC + 754 + 9-digit sequence + first 3 letters of sender name + first 3 letters of receiver zipcode
export const generateCustomOrderId = (senderName: string, receiverZipCode: string): string => {
  // Create a random 9-digit number
  const randomDigits = Math.floor(100000000 + Math.random() * 900000000);
  
  // Get first 3 letters of sender name (uppercase)
  const senderPrefix = senderName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  
  // Get first 3 characters of receiver zipcode
  const zipSuffix = receiverZipCode.substring(0, 3).toUpperCase();
  
  // Combine all parts
  return `CCC754${randomDigits}${senderPrefix}${zipSuffix}`;
};

export const createOrder = async (data: CreateOrderFormData): Promise<Order> => {
  // Get current user ID from Supabase auth session
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.user?.id) {
    throw new Error("User not authenticated");
  }

  // Log the full data object to inspect all form values
  console.log("Full form data submitted:", JSON.stringify(data, null, 2));
  
  // Specifically log the sender and receiver address data to verify all fields including lat/lon
  console.log("Sender address with coordinates:", {
    street: data.sender.address.street,
    city: data.sender.address.city,
    lat: data.sender.address.lat,
    lon: data.sender.address.lon
  });
  
  console.log("Receiver address with coordinates:", {
    street: data.receiver.address.street,
    city: data.receiver.address.city,
    lat: data.receiver.address.lat,
    lon: data.receiver.address.lon
  });

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

  // Generate a custom tracking number (order ID)
  const customTrackingNumber = generateCustomOrderId(
    data.sender.name,
    data.receiver.address.zipCode
  );

  // Create sender and receiver objects with coordinates explicitly included
  const senderWithCoordinates = {
    name: data.sender.name,
    email: data.sender.email,
    phone: data.sender.phone,
    address: {
      street: data.sender.address.street,
      city: data.sender.address.city,
      state: data.sender.address.state,
      zipCode: data.sender.address.zipCode,
      country: data.sender.address.country,
      lat: data.sender.address.lat,
      lon: data.sender.address.lon
    }
  };

  const receiverWithCoordinates = {
    name: data.receiver.name,
    email: data.receiver.email,
    phone: data.receiver.phone,
    address: {
      street: data.receiver.address.street,
      city: data.receiver.address.city,
      state: data.receiver.address.state,
      zipCode: data.receiver.address.zipCode,
      country: data.receiver.address.country,
      lat: data.receiver.address.lat,
      lon: data.receiver.address.lon
    }
  };

  // Log the objects being sent to Supabase
  console.log("Sender object being sent to Supabase:", JSON.stringify(senderWithCoordinates, null, 2));
  console.log("Receiver object being sent to Supabase:", JSON.stringify(receiverWithCoordinates, null, 2));

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: session.session.user.id,
      sender: senderWithCoordinates,
      receiver: receiverWithCoordinates,
      bike_brand: data.bikeBrand,
      bike_model: data.bikeModel,
      customer_order_number: data.customerOrderNumber || null, // Keep customer order number separate
      tracking_number: customTrackingNumber, // Always set tracking number to the generated custom ID
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

  // Log the created order to verify lat/lon were included
  console.log("Order created in Supabase:", order);
  
  // Type assertion to safely access the nested properties
  const senderData = order.sender as any;
  const receiverData = order.receiver as any;
  
  console.log("Sender coordinates in created order:", 
    senderData.address?.lat, 
    senderData.address?.lon
  );
  console.log("Receiver coordinates in created order:", 
    receiverData.address?.lat, 
    receiverData.address?.lon
  );

  // Send email to sender after order creation
  try {
    // Get the current domain dynamically
    const baseUrl = window.location.origin;
    console.log("Using base URL for order creation email:", baseUrl);
    
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
