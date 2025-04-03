
import { Order, OrderStatus, CreateOrderFormData } from "@/types/order";
import { supabase } from "@/integrations/supabase/client";
import { mapDbOrderToOrderType } from "./orderServiceUtils";
import { sendOrderCreationEmailToSender, sendOrderNotificationToReceiver, sendDeliveryConfirmationToSender, sendDeliveryConfirmationToReceiver } from "./emailService";
import { updateJobStatuses } from "./jobService";

/**
 * Fetches an order by tracking number
 * @param trackingNumber The tracking number of the order
 * @returns The order object
 */
export const getOrderByTrackingNumber = async (trackingNumber: string): Promise<Order> => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("tracking_number", trackingNumber)
    .single();

  if (error) {
    console.error("Error getting order by tracking number:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

/**
 * Polls for order updates
 * @param id The ID of the order to poll
 * @param interval The polling interval in ms (default: 10000)
 * @returns A cleanup function to stop polling
 */
export const pollOrderUpdates = (id: string, onUpdate: (order: Order) => void, interval = 10000) => {
  // Initial fetch
  const fetchOrder = async () => {
    try {
      const order = await getOrderById(id);
      if (order) {
        onUpdate(order);
      }
    } catch (error) {
      console.error("Error polling order:", error);
    }
  };

  // Set up polling
  fetchOrder(); // First immediate call
  const intervalId = setInterval(fetchOrder, interval);
  
  // Return cleanup function
  return () => clearInterval(intervalId);
};

/**
 * Fetches all orders from the database
 * @returns Array of orders
 */
export const getOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error getting orders:", error);
    throw new Error(error.message);
  }

  return data.map(mapDbOrderToOrderType);
};

/**
 * Fetches a single order by ID
 * @param id The order ID
 * @returns The order object
 */
export const getOrder = async (id: string): Promise<Order> => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error getting order:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

// Alias for getOrder to maintain compatibility with existing code
export const getOrderById = getOrder;

/**
 * Fetches a public order by ID, tracking number, or customer order number
 * @param id The order ID, tracking number, or customer order number
 * @returns The order object or null if not found
 */
export const getPublicOrder = async (id: string): Promise<Order | null> => {
  try {
    if (!id) {
      console.error("Invalid order ID provided:", id);
      console.error("Current domain:", window.location.origin);
      return null;
    }

    console.log(`Fetching public order with ID or tracking number: ${id} from domain: ${window.location.origin}`);
    
    // First try to fetch by UUID (id column)
    if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      console.log("ID looks like a UUID, trying to fetch by id column");
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();
  
      if (!error && data) {
        console.log("Order data retrieved successfully by UUID:", data.id);
        return mapDbOrderToOrderType(data);
      }
    }
    
    // Try to fetch by tracking_number (which should have the CCC754... format)
    console.log("Trying to fetch by tracking_number:", id);
    const { data: orderByTracking, error: trackingError } = await supabase
      .from("orders")
      .select("*")
      .eq("tracking_number", id)
      .single();
    
    if (!trackingError && orderByTracking) {
      console.log("Order data retrieved successfully by tracking number:", orderByTracking.id);
      return mapDbOrderToOrderType(orderByTracking);
    }
    
    // If tracking_number search failed, try to fetch by customer_order_number
    console.log("Trying to fetch by customer_order_number:", id);
    const { data: orderByCustomId, error: customIdError } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_order_number", id)
      .single();
    
    if (customIdError) {
      console.error("Error getting public order by customer_order_number:", customIdError);
      console.error("Error details:", JSON.stringify(customIdError));
      console.error("Domain information:", window.location.origin);
      console.error("Full URL:", window.location.href);
      
      return null;
    }

    if (!orderByCustomId) {
      console.error("No order found with ID:", id);
      console.error("Current domain:", window.location.origin);
      return null;
    }

    console.log("Order data retrieved successfully by custom ID:", orderByCustomId.id);
    return mapDbOrderToOrderType(orderByCustomId);
  } catch (err) {
    console.error("Unexpected error in getPublicOrder:", err);
    console.error("Error object:", JSON.stringify(err, null, 2));
    console.error("Domain information:", window.location.origin);
    return null;
  }
};

/**
 * Creates a new order
 * @param orderData The order data
 * @returns The created order
 */
export const createOrder = async (orderData: CreateOrderFormData): Promise<Order> => {
  try {
    // We'll generate a placeholder tracking number, which will be replaced
    // by the proper one from the generate-tracking-numbers function
    const trackingNumber = `CCC${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
    
    // Modified to use JSON structure for sender and receiver instead of flattened fields
    const { data, error } = await supabase
      .from("orders")
      .insert({
        tracking_number: trackingNumber,
        sender: {
          name: orderData.sender.name,
          email: orderData.sender.email,
          phone: orderData.sender.phone,
          address: {
            street: orderData.sender.address.street,
            city: orderData.sender.address.city,
            state: orderData.sender.address.state,
            zipCode: orderData.sender.address.zipCode,
            country: orderData.sender.address.country,
            lat: orderData.sender.address.lat,
            lon: orderData.sender.address.lon
          }
        },
        receiver: {
          name: orderData.receiver.name,
          email: orderData.receiver.email,
          phone: orderData.receiver.phone,
          address: {
            street: orderData.receiver.address.street,
            city: orderData.receiver.address.city,
            state: orderData.receiver.address.state,
            zipCode: orderData.receiver.address.zipCode,
            country: orderData.receiver.address.country,
            lat: orderData.receiver.address.lat,
            lon: orderData.receiver.address.lon
          }
        },
        bike_brand: orderData.bikeBrand,
        bike_model: orderData.bikeModel,
        customer_order_number: orderData.customerOrderNumber,
        needs_payment_on_collection: orderData.needsPaymentOnCollection,
        is_bike_swap: orderData.isBikeSwap,
        delivery_instructions: orderData.deliveryInstructions,
        status: "sender_availability_pending" as OrderStatus, // Set initial status to sender_availability_pending
        user_id: (await supabase.auth.getSession()).data.session?.user.id || '' // Get current user ID
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating order:", error);
      throw new Error(error.message);
    }

    // Send email only to sender
    try {
      await sendOrderCreationEmailToSender(data.id);
      console.log("Sender notification email sent successfully");
      // We no longer send an email to the receiver at this point
      // Will be sent after sender confirms availability
    } catch (emailError) {
      console.error("Error sending order creation email to sender:", emailError);
      // Continue even if email fails
    }

    // Generate proper tracking number format
    try {
      const response = await supabase.functions.invoke("generate-tracking-numbers", {
        body: { forceAll: false }
      });
      
      if (response.error) {
        console.error("Error generating tracking number:", response.error);
      } else {
        console.log("Generated tracking numbers:", response.data);
      }
    } catch (trackingError) {
      console.error("Failed to generate tracking number:", trackingError);
      // Continue even if tracking number generation fails
    }

    return mapDbOrderToOrderType(data);
  } catch (error) {
    console.error("Error in createOrder:", error);
    throw error;
  }
};

/**
 * Updates an order's status
 * @param id The order ID
 * @param status The new status
 * @returns The updated order
 */
export const updateOrderStatus = async (
  id: string,
  status: OrderStatus
): Promise<Order> => {
  // Use type assertion to ensure TypeScript compatibility with all enum values
  const safeStatus = status as unknown as OrderStatus;
  
  const { data, error } = await supabase
    .from("orders")
    .update({ status: safeStatus })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order status:", error);
    throw new Error(error.message);
  }

  // Update job statuses based on the new order status
  try {
    await updateJobStatuses(id, status);
  } catch (jobError) {
    console.error("Error updating job statuses:", jobError);
    // Continue with order update even if job update fails
  }

  const mappedOrder = mapDbOrderToOrderType(data);
  
  // If sender confirms availability, send notification to receiver
  if (status === "receiver_availability_pending") {
    try {
      console.log("Sender has confirmed availability for order:", id);
      console.log("Sending notification to receiver...");
      
      // Now is the appropriate time to notify the receiver
      const receiverEmailResult = await sendOrderNotificationToReceiver(id);
      console.log("Receiver notification email result:", receiverEmailResult);
      
      if (!receiverEmailResult) {
        console.error("Failed to send email to receiver");
      }
    } catch (emailError) {
      console.error("Error sending notification email to receiver:", emailError);
      // Don't throw here - we don't want to fail the order update if email fails
    }
  }

  // Send delivery confirmation emails if order status is "delivered"
  if (status === "delivered") {
    try {
      console.log("Sending delivery confirmation emails for order:", id);
      
      // Send confirmation to sender
      const senderEmailResult = await sendDeliveryConfirmationToSender(id);
      console.log("Sender delivery confirmation email result:", senderEmailResult);
      
      // Send confirmation to receiver
      const receiverEmailResult = await sendDeliveryConfirmationToReceiver(id);
      console.log("Receiver delivery confirmation email result:", receiverEmailResult);
      
      if (!senderEmailResult || !receiverEmailResult) {
        console.error("One or more delivery confirmation emails failed to send");
      }
    } catch (emailError) {
      console.error("Error sending delivery confirmation emails:", emailError);
      // Don't throw here - we don't want to fail the order update if email fails
    }
  }

  return mappedOrder;
};

/**
 * Updates an order's scheduled dates
 * @param id The order ID
 * @param scheduledPickupDate The scheduled pickup date
 * @param scheduledDeliveryDate The scheduled delivery date
 * @returns The updated order
 */
export const updateOrderScheduledDates = async (
  id: string,
  scheduledPickupDate: Date,
  scheduledDeliveryDate: Date
): Promise<Order> => {
  // Use type assertion to ensure TypeScript compatibility
  const status = "scheduled" as OrderStatus;

  const { data, error } = await supabase
    .from("orders")
    .update({
      scheduled_pickup_date: scheduledPickupDate.toISOString(),
      scheduled_delivery_date: scheduledDeliveryDate.toISOString(),
      status,
      scheduled_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order scheduled dates:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

// Alias for updateOrderScheduledDates to maintain compatibility with existing code
export const updateOrderSchedule = updateOrderScheduledDates;

/**
 * Updates a public order
 * @param id The order ID
 * @param pickup_date The pickup date array
 * @param status The new status
 * @returns The updated order
 */
export const updatePublicOrder = async (
  id: string,
  pickup_date: string[],
  status: OrderStatus
): Promise<Order> => {
  // Use type assertion to ensure TypeScript compatibility
  const safeStatus = status as unknown as OrderStatus;
  
  const { data, error } = await supabase
    .from("orders")
    .update({
      pickup_date,
      status: safeStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating public order:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};

/**
 * Updates an order's status manually by admin
 * @param id The order ID
 * @param status The new status
 * @returns The updated order
 */
export const updateAdminOrderStatus = async (
  id: string,
  status: OrderStatus
): Promise<Order> => {
  // Use type assertion to ensure TypeScript compatibility
  const safeStatus = status as unknown as OrderStatus;
  
  const { data, error } = await supabase
    .from("orders")
    .update({
      status: safeStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating order status by admin:", error);
    throw new Error(error.message);
  }

  // Update job statuses based on the new order status
  try {
    await updateJobStatuses(id, status);
  } catch (jobError) {
    console.error("Error updating job statuses:", jobError);
    // Continue with order update even if job update fails
  }

  const mappedOrder = mapDbOrderToOrderType(data);

  // Send delivery confirmation emails if order status is "delivered"
  if (status === "delivered") {
    try {
      console.log("Sending delivery confirmation emails for order:", id);
      
      // Send confirmation to sender
      const senderEmailResult = await sendDeliveryConfirmationToSender(id);
      console.log("Sender delivery confirmation email result:", senderEmailResult);
      
      // Send confirmation to receiver
      const receiverEmailResult = await sendDeliveryConfirmationToReceiver(id);
      console.log("Receiver delivery confirmation email result:", receiverEmailResult);
      
      if (!senderEmailResult || !receiverEmailResult) {
        console.error("One or more delivery confirmation emails failed to send");
      }
    } catch (emailError) {
      console.error("Error sending delivery confirmation emails:", emailError);
      // Don't throw here - we don't want to fail the order update if email fails
    }
  }

  return mappedOrder;
};

/**
 * Resends the sender availability email
 * @param id The order ID
 * @returns True if the email was sent successfully
 */
export const resendSenderAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Starting to resend sender availability email for order ID:", id);
    
    // Get the order details first
    const order = await getOrder(id);
    
    // Ensure the order exists and has a sender
    if (!order || !order.sender || !order.sender.email) {
      console.error("Order or sender information not found for ID:", id);
      return false;
    }
    
    // Use the current domain dynamically
    const baseUrl = window.location.origin;
    console.log("Using base URL for email:", baseUrl);
    
    // Create item from bike details
    const item = {
      name: `${order.bikeBrand} ${order.bikeModel}`.trim(),
      quantity: 1,
      price: 0
    };
    
    console.log("Sending sender email to:", order.sender.email);
    
    // Send email to sender with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.sender.email,
        name: order.sender.name || "Sender",
        orderId: id,
        baseUrl,
        emailType: "sender",
        item: item
      }
    });
    
    if (response.error) {
      console.error("Error resending email to sender:", response.error);
      return false;
    }
    
    console.log("Email resent successfully to sender:", order.sender.email);
    return true;
  } catch (error) {
    console.error("Failed to resend email:", error);
    return false;
  }
};

/**
 * Resends the receiver availability email
 * @param id The order ID
 * @returns True if the email was sent successfully
 */
export const resendReceiverAvailabilityEmail = async (id: string): Promise<boolean> => {
  try {
    console.log("Starting to send receiver availability email for order ID:", id);
    
    // Get the order details first
    const order = await getOrder(id);
    
    // Ensure the order exists and has a receiver
    if (!order || !order.receiver || !order.receiver.email) {
      console.error("Order or receiver information not found for ID:", id);
      return false;
    }
    
    // Use the current domain dynamically
    const baseUrl = window.location.origin;
    console.log("Using base URL for email:", baseUrl);
    
    // Create item from bike details
    const item = {
      name: `${order.bikeBrand} ${order.bikeModel}`.trim(),
      quantity: 1,
      price: 0
    };
    
    console.log("Sending receiver email to:", order.receiver.email);
    
    // Send email to receiver with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: order.receiver.email,
        name: order.receiver.name || "Receiver",
        orderId: id,
        baseUrl,
        emailType: "receiver",
        item: item
      }
    });
    
    if (response.error) {
      console.error("Error sending email to receiver:", response.error);
      console.error("Response error details:", JSON.stringify(response.error, null, 2));
      return false;
    }
    
    console.log("Email sent successfully to receiver:", order.receiver.email, "Response:", JSON.stringify(response.data));
    return true;
  } catch (error) {
    console.error("Failed to send email to receiver:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return false;
  }
};

