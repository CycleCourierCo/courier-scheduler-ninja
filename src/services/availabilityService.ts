import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Order } from "@/types/order";
import { mapDbOrderToOrderType } from "./orderServiceUtils";
import { resendReceiverAvailabilityEmail, sendSenderDatesConfirmedEmail, sendReceiverDatesConfirmedEmail } from "./emailService";
import { fetchHolidayDates } from "./holidayService";
import { fetchAllowedFridayDates } from "./allowedFridaysService";

// Format date as YYYY-MM-DD using local date parts (no timezone shift)
const toDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Filter out disallowed Fridays and holiday dates
const filterInvalidDates = (dates: Date[], holidayDates: string[], allowedFridayDates: string[] = []): Date[] => {
  return dates.filter(date => {
    const dateStr = toDateString(date);
    // Filter Fridays (day 5) unless explicitly allowed
    if (date.getDay() === 5 && !allowedFridayDates.includes(dateStr)) return false;
    // Filter holidays
    if (holidayDates.includes(dateStr)) return false;
    return true;
  });
};

export const confirmSenderAvailability = async (orderId: string, dateStrings: string[]): Promise<boolean> => {
  try {
    console.log("Confirming sender availability for order:", orderId);
    console.log("Selected dates:", dateStrings);
    
    if (!dateStrings || dateStrings.length === 0) {
      console.error("No dates selected for confirmation");
      return false;
    }
    
    // Submit availability via secure RPC (handles dates, notes, confirmed_at, status atomically)
    const { error } = await supabase.rpc("set_order_availability" as any, {
      p_order_id: orderId,
      p_side: "sender",
      p_dates: dateStrings,
      p_notes: null,
    });

    if (error) {
      console.error("Error confirming sender availability:", error);
      return false;
    }

    console.log("Sender availability confirmed.");

    // Send confirmation email to sender with their selected dates
    try {
      const confirmEmailSent = await sendSenderDatesConfirmedEmail(orderId, dateStrings);
      console.log("Sender dates confirmed email sent:", confirmEmailSent);
    } catch (confirmError) {
      console.error("Error sending sender dates confirmed email:", confirmError);
    }

    // The RPC sets status to either sender_availability_confirmed (needs_inspection)
    // or receiver_availability_pending. In the non-inspection case, trigger the receiver email.
    const publicOrder = await supabase.rpc("get_public_order" as any, { p_identifier: orderId });
    const needsInspection = (publicOrder.data as any)?.needs_inspection === true;

    if (needsInspection) {
      console.log("Order needs inspection - skipping receiver availability email.");
      return true;
    }

    
    // Send receiver availability email
    try {
      const emailSent = await resendReceiverAvailabilityEmail(orderId);
      console.log("Receiver availability email sent:", emailSent);
      
      if (!emailSent) {
        console.error("Failed to send receiver availability email");
      }
    } catch (emailError) {
      console.error("Error sending receiver availability email:", emailError);
    }
    
    return true;
  } catch (error) {
    console.error("Unexpected error in confirmSenderAvailability:", error);
    return false;
  }
};

export const confirmReceiverAvailability = async (orderId: string, dateStrings: string[]): Promise<boolean> => {
  try {
    console.log("Confirming receiver availability for order:", orderId);
    console.log("Selected dates:", dateStrings);
    
    if (!dateStrings || dateStrings.length === 0) {
      console.error("No dates selected for confirmation");
      return false;
    }
    
    const { error } = await supabase.rpc("set_order_availability" as any, {
      p_order_id: orderId,
      p_side: "receiver",
      p_dates: dateStrings,
      p_notes: null,
    });

    if (error) {
      console.error("Error confirming receiver availability:", error);
      return false;
    }

    console.log("Receiver availability confirmed successfully");

    // Send confirmation email to receiver with their selected dates
    try {
      const confirmEmailSent = await sendReceiverDatesConfirmedEmail(orderId, dateStrings);
      console.log("Receiver dates confirmed email sent:", confirmEmailSent);
    } catch (confirmError) {
      console.error("Error sending receiver dates confirmed email:", confirmError);
    }


    
    return true;
  } catch (error) {
    console.error("Unexpected error in confirmReceiverAvailability:", error);
    return false;
  }
};

export const updateSenderAvailability = async (orderId: string, dates: Date[], notes: string): Promise<Order | null> => {
  try {
    if (!orderId || !dates || dates.length === 0) {
      console.error("Invalid parameters for updateSenderAvailability");
      return null;
    }
    
    console.log(`Updating sender availability for order ${orderId}`);
    console.log(`Selected dates: ${dates.map(d => d.toISOString())}`);
    
    // Fetch holidays and filter invalid dates
    const holidayDates = await fetchHolidayDates();
    const allowedFridayDates = await fetchAllowedFridayDates();
    const validDates = filterInvalidDates(dates, holidayDates, allowedFridayDates);
    
    if (validDates.length < 7) {
      console.error(`Only ${validDates.length} valid dates after filtering (need 7)`);
      toast.error("Not enough valid dates. Please select at least 7 valid dates.");
      return null;
    }
    
    // Format dates as YYYY-MM-DD strings (no timezone shift)
    const dateStrings = validDates.map(toDateString);
    
    // Submit availability via secure RPC. The RPC reads needs_inspection server-side
    // and atomically writes dates, notes, confirmed_at, and the appropriate next status.
    const { data: rpcData, error } = await supabase.rpc("set_order_availability" as any, {
      p_order_id: orderId,
      p_side: "sender",
      p_dates: dateStrings,
      p_notes: notes.trim(),
    });

    if (error) {
      console.error("Error updating sender availability:", error);
      return null;
    }

    const order = mapDbOrderToOrderType(rpcData);
    const needsInspection = order.needsInspection === true;

    console.log("Sender availability confirmed.", needsInspection ? "Inspection required - deferring receiver notification." : "Proceeding to notify receiver.");


    
    // Send confirmation email to sender with their selected dates
    try {
      const confirmEmailSent = await sendSenderDatesConfirmedEmail(orderId, dateStrings);
      console.log("Sender dates confirmed email sent:", confirmEmailSent);
    } catch (confirmError) {
      console.error("Error sending sender dates confirmed email:", confirmError);
    }
    
    // Send receiver availability email — skip when inspection is required.
    // It will be triggered after the inspection completes (repairs done or all declined).
    if (!needsInspection) {
      try {
        const emailSent = await resendReceiverAvailabilityEmail(orderId);
        console.log("Receiver availability email sent:", emailSent);

        if (!emailSent) {
          console.error("Failed to send receiver availability email");
        }
      } catch (emailError) {
        console.error("Error sending receiver availability email:", emailError);
      }
    } else {
      console.log("Skipping receiver availability email - order needs inspection. Will send once inspection is complete.");
    }
    
    return order;
  } catch (error) {
    console.error("Unexpected error in updateSenderAvailability:", error);
    return null;
  }
};

export const updateReceiverAvailability = async (orderId: string, dates: Date[], notes: string): Promise<Order | null> => {
  try {
    if (!orderId || !dates || dates.length === 0) {
      console.error("Invalid parameters for updateReceiverAvailability");
      return null;
    }
    
    console.log(`Updating receiver availability for order ${orderId}`);
    console.log(`Selected dates: ${dates.map(d => d.toISOString())}`);
    console.log(`Notes: ${notes}`);
    console.log(`Auth UID: ${JSON.stringify((await supabase.auth.getUser()).data.user?.id)}`);
    
    // Fetch holidays and filter invalid dates
    const holidayDates = await fetchHolidayDates();
    const allowedFridayDates = await fetchAllowedFridayDates();
    const validDates = filterInvalidDates(dates, holidayDates, allowedFridayDates);
    
    if (validDates.length < 7) {
      console.error(`Only ${validDates.length} valid dates after filtering (need 7)`);
      toast.error("Not enough valid dates. Please select at least 7 valid dates.");
      return null;
    }
    
    // Format dates as YYYY-MM-DD strings (no timezone shift)
    const dateStrings = validDates.map(toDateString);
    
    // Update the order with all receiver availability data in one transaction
    const { data, error } = await supabase
      .from("orders")
      .update({
        delivery_date: dateStrings,
        receiver_notes: notes.trim(),
        receiver_confirmed_at: new Date().toISOString(),
        status: "scheduled_dates_pending",
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .select()
      .single();
    
    if (error) {
      console.error("Error updating receiver availability:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return null;
    }
    
    console.log("Receiver availability confirmed successfully");
    
    // Send confirmation email to receiver with their selected dates
    try {
      const confirmEmailSent = await sendReceiverDatesConfirmedEmail(orderId, dateStrings);
      console.log("Receiver dates confirmed email sent:", confirmEmailSent);
    } catch (confirmError) {
      console.error("Error sending receiver dates confirmed email:", confirmError);
    }
    
    // Map the database response to our Order type
    const order = mapDbOrderToOrderType(data);
    
    return order;
  } catch (error) {
    console.error("Unexpected error in updateReceiverAvailability:", error);
    return null;
  }
};

export const getSenderAvailability = async (orderId: string) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("sender_notes, pickup_date")
      .eq("id", orderId)
      .single();

    if (error) {
      console.error("Error fetching sender availability:", error);
      toast.error("Failed to fetch sender availability.");
      return null;
    }

    // Safely convert the JSON array to Date objects with type checking
    const dates: Date[] = [];
    if (Array.isArray(data.pickup_date)) {
      for (const dateItem of data.pickup_date) {
        if (typeof dateItem === 'string') {
          try {
            dates.push(new Date(dateItem));
          } catch (e) {
            console.error("Invalid date format in pickup_date:", dateItem);
          }
        }
      }
    }

    return {
      notes: data.sender_notes || "",
      dates: dates
    };
  } catch (error) {
    console.error("Unexpected error fetching sender availability:", error);
    toast.error("Unexpected error fetching sender availability.");
    return null;
  }
};

export const getReceiverAvailability = async (orderId: string) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("receiver_notes, delivery_date")
      .eq("id", orderId)
      .single();

    if (error) {
      console.error("Error fetching receiver availability:", error);
      toast.error("Failed to fetch receiver availability.");
      return null;
    }

    // Safely convert the JSON array to Date objects with type checking
    const dates: Date[] = [];
    if (Array.isArray(data.delivery_date)) {
      for (const dateItem of data.delivery_date) {
        if (typeof dateItem === 'string') {
          try {
            dates.push(new Date(dateItem));
          } catch (e) {
            console.error("Invalid date format in delivery_date:", dateItem);
          }
        }
      }
    }

    return {
      notes: data.receiver_notes || "",
      dates: dates
    };
  } catch (error) {
    console.error("Unexpected error fetching receiver availability:", error);
    toast.error("Unexpected error fetching receiver availability.");
    return null;
  }
};
