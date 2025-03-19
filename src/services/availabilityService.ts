
import { supabase } from "@/integrations/supabase/client";
import { Order, ContactInfo, Address } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";

export const updateSenderAvailability = async (
  id: string, 
  dates: Date[]
): Promise<Order> => {
  const formattedDates = dates.map(date => date.toISOString());

  const { data, error } = await supabase
    .from("orders")
    .update({
      pickup_date: formattedDates,
      status: "receiver_availability_pending",
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

  // Get the order details to send email to receiver
  try {
    // After sender confirms availability, send email to the receiver
    const baseUrl = window.location.origin;
    
    // Ensure receiver data is properly typed and accessible
    const receiverData = data.receiver as unknown as ContactInfo & { address: Address };
    
    // Validate receiver email before sending
    if (!receiverData?.email) {
      console.error("Receiver email not found in order data:", data.receiver);
      throw new Error("Receiver email not found");
    }
    
    console.log("Sending email to receiver:", receiverData.email);
    
    // Create the item from the bike details
    const item = {
      name: `${data.bike_brand} ${data.bike_model}`.trim(),
      quantity: 1,
      price: 0
    };
    
    // Send email to receiver with improved error handling
    const response = await supabase.functions.invoke("send-email", {
      body: {
        to: receiverData.email,
        name: receiverData.name || "Recipient",
        orderId: id,
        baseUrl,
        emailType: "receiver",
        item: item
      }
    });
    
    if (response.error) {
      console.error("Error sending email to receiver:", response.error);
      // Log detailed error information for debugging
      if (response.error.message) {
        console.error("Error message:", response.error.message);
      }
    } else {
      console.log("Email sent successfully to receiver:", receiverData.email);
    }
  } catch (emailError) {
    console.error("Failed to send email to receiver:", emailError);
    console.error("Error details:", emailError instanceof Error ? emailError.message : emailError);
    // Don't throw here - we don't want to fail the order update if email fails
  }

  return mapDbOrderToOrderType(data);
};

export const updateReceiverAvailability = async (
  id: string, 
  dates: Date[]
): Promise<Order> => {
  const formattedDates = dates.map(date => date.toISOString());

  const { data, error } = await supabase
    .from("orders")
    .update({
      delivery_date: formattedDates,
      status: "receiver_availability_confirmed",
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
