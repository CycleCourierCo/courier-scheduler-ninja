
import { supabase } from "@/integrations/supabase/client";
import { Order, ContactInfo, Address } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";

// Common type for availability updates
interface AvailabilityUpdate {
  dates: Date[];           // availability dates
  orderId: string;         // order ID
  updateFields: {          // fields to update in the order
    dateField: string;     // field name for availability dates (pickup_date or delivery_date)
    statusField: string;   // new status value
    confirmedAtField: string; // field for confirmation timestamp
  };
  emailRecipient?: 'sender' | 'receiver'; // recipient for notification email (optional)
}

/**
 * Core function to update availability (used by both sender and receiver)
 */
const updateAvailability = async ({
  dates,
  orderId,
  updateFields,
  emailRecipient
}: AvailabilityUpdate): Promise<Order> => {
  const formattedDates = dates.map(date => date.toISOString());
  
  // Prepare the update object dynamically
  const updateObject: Record<string, any> = {
    [updateFields.dateField]: formattedDates,
    status: updateFields.statusField,
    updated_at: new Date().toISOString(),
    [updateFields.confirmedAtField]: new Date().toISOString()
  };

  // Update the order in the database
  const { data, error } = await supabase
    .from("orders")
    .update(updateObject)
    .eq("id", orderId)
    .select()
    .single();

  if (error) {
    console.error(`Error updating availability:`, error);
    throw new Error(error.message);
  }

  // Send email notification if required
  if (emailRecipient && emailRecipient === 'receiver') {
    try {
      // Get necessary data for the email
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
      
      // Send email to receiver
      const response = await supabase.functions.invoke("send-email", {
        body: {
          to: receiverData.email,
          name: receiverData.name || "Recipient",
          orderId,
          baseUrl,
          emailType: "receiver",
          item: item
        }
      });
      
      if (response.error) {
        console.error("Error sending email to receiver:", response.error);
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
  }

  return mapDbOrderToOrderType(data);
};

/**
 * Update sender availability dates
 */
export const updateSenderAvailability = async (
  id: string, 
  dates: Date[]
): Promise<Order> => {
  return updateAvailability({
    dates,
    orderId: id,
    updateFields: {
      dateField: "pickup_date",
      statusField: "receiver_availability_pending",
      confirmedAtField: "sender_confirmed_at"
    },
    emailRecipient: "receiver" // Send email to receiver after sender confirms
  });
};

/**
 * Update receiver availability dates
 */
export const updateReceiverAvailability = async (
  id: string, 
  dates: Date[]
): Promise<Order> => {
  return updateAvailability({
    dates,
    orderId: id,
    updateFields: {
      dateField: "delivery_date",
      statusField: "receiver_availability_confirmed",
      confirmedAtField: "receiver_confirmed_at"
    }
    // No email recipient - we don't send emails after receiver confirms
  });
};
