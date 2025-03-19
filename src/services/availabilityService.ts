
import { supabase } from "@/integrations/supabase/client";
import { Order, OrderStatus } from "@/types/order";
import { mapDbOrderToOrderType } from "./utils/orderMappers";

/**
 * Updates sender availability dates
 */
export const updateSenderAvailability = async (
  id: string, 
  dates: Date[]
): Promise<Order> => {
  const formattedDates = dates.map(date => date.toISOString());

  const { data, error } = await supabase
    .from("orders")
    .update({
      pickup_date: formattedDates,
      status: "receiver_availability_pending" as OrderStatus,
      updated_at: new Date().toISOString(),
      sender_confirmed_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating sender availability:", error);
    throw new Error(error.message);
  }

  // Send email to receiver after sender confirms availability
  try {
    const baseUrl = window.location.origin;
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: data.receiver.email,
        name: data.receiver.name || "Recipient",
        orderId: id,
        baseUrl,
        emailType: "receiver" 
      }
    });
    
    if (response.error) {
      console.error("Error sending email to receiver:", response.error);
    } else {
      console.log("Email sent successfully to receiver:", data.receiver.email);
    }
  } catch (emailError) {
    console.error("Failed to send email to receiver:", emailError);
    // Don't throw here - we don't want to fail the order update if email fails
  }

  return mapDbOrderToOrderType(data);
};

/**
 * Updates receiver availability dates
 */
export const updateReceiverAvailability = async (
  id: string, 
  dates: Date[]
): Promise<Order> => {
  const formattedDates = dates.map(date => date.toISOString());

  const { data, error } = await supabase
    .from("orders")
    .update({
      delivery_date: formattedDates,
      status: "receiver_availability_confirmed" as OrderStatus,
      updated_at: new Date().toISOString(),
      receiver_confirmed_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating receiver availability:", error);
    throw new Error(error.message);
  }

  return mapDbOrderToOrderType(data);
};
