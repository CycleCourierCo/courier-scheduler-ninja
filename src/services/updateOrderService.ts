
import { supabase } from "@/integrations/supabase/client";
import { Order, OrderStatus } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";
import { updateJobStatuses } from "./jobService";
import { sendDeliveryConfirmationToSender, sendDeliveryConfirmationToReceiver } from "./emailService";

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

// New function to update order status manually by admin
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
