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

export const updateSenderAvailability = async (orderId: string, dates: Date[], notes: string, postcode?: string | null): Promise<Order | null> => {
  try {
    if (!orderId || !dates || dates.length === 0) {
      console.error("Invalid parameters for updateSenderAvailability");
      return null;
    }
    
    console.log(`Updating sender availability for order ${orderId}`);
    
    const holidayDates = await fetchHolidayDates();
    const allowedFridayDates = await fetchAllowedFridayDates();
    const validDates = filterInvalidDates(dates, holidayDates, allowedFridayDates);
    
    if (validDates.length < 7) {
      console.error(`Only ${validDates.length} valid dates after filtering (need 7)`);
      toast.error("Not enough valid dates. Please select at least 7 valid dates.");
      return null;
    }
    
    const dateStrings = validDates.map(toDateString);
    
    const { data: rpcData, error } = await supabase.rpc("set_order_availability" as any, {
      p_order_id: orderId,
      p_side: "sender",
      p_dates: dateStrings,
      p_notes: notes.trim(),
      p_postcode: postcode ?? null,
    });

    if (error) {
      console.error("Error updating sender availability:", error);
      if ((error as any).message?.toLowerCase().includes("postcode")) {
        toast.error("That postcode doesn't match the one on this order. Please check and try again.");
      } else if ((error as any).message?.toLowerCase().includes("too many")) {
        toast.error("Too many attempts. Please wait a few minutes and try again.");
      }
      return null;
    }

    const order = mapDbOrderToOrderType(rpcData);
    const needsInspection = order.needsInspection === true;

    try {
      await sendSenderDatesConfirmedEmail(orderId, dateStrings);
    } catch (confirmError) {
      console.error("Error sending sender dates confirmed email:", confirmError);
    }
    
    if (!needsInspection) {
      try {
        await resendReceiverAvailabilityEmail(orderId);
      } catch (emailError) {
        console.error("Error sending receiver availability email:", emailError);
      }
    }
    
    return order;
  } catch (error) {
    console.error("Unexpected error in updateSenderAvailability:", error);
    return null;
  }
};

export const updateReceiverAvailability = async (orderId: string, dates: Date[], notes: string, postcode?: string | null): Promise<Order | null> => {
  try {
    if (!orderId || !dates || dates.length === 0) {
      console.error("Invalid parameters for updateReceiverAvailability");
      return null;
    }
    
    const holidayDates = await fetchHolidayDates();
    const allowedFridayDates = await fetchAllowedFridayDates();
    const validDates = filterInvalidDates(dates, holidayDates, allowedFridayDates);
    
    if (validDates.length < 7) {
      toast.error("Not enough valid dates. Please select at least 7 valid dates.");
      return null;
    }
    
    const dateStrings = validDates.map(toDateString);
    
    const { data: rpcData, error } = await supabase.rpc("set_order_availability" as any, {
      p_order_id: orderId,
      p_side: "receiver",
      p_dates: dateStrings,
      p_notes: notes.trim(),
      p_postcode: postcode ?? null,
    });

    if (error) {
      console.error("Error updating receiver availability:", error);
      if ((error as any).message?.toLowerCase().includes("postcode")) {
        toast.error("That postcode doesn't match the one on this order. Please check and try again.");
      } else if ((error as any).message?.toLowerCase().includes("too many")) {
        toast.error("Too many attempts. Please wait a few minutes and try again.");
      }
      return null;
    }

    try {
      await sendReceiverDatesConfirmedEmail(orderId, dateStrings);
    } catch (confirmError) {
      console.error("Error sending receiver dates confirmed email:", confirmError);
    }

    return mapDbOrderToOrderType(rpcData);

  } catch (error) {
    console.error("Unexpected error in updateReceiverAvailability:", error);
    return null;
  }
};


const extractDates = (raw: any): Date[] => {
  const dates: Date[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") {
        try { dates.push(new Date(item)); } catch (e) { /* ignore */ }
      }
    }
  }
  return dates;
};

export const getSenderAvailability = async (orderId: string) => {
  try {
    const { data, error } = await supabase.rpc("get_public_order" as any, { p_identifier: orderId });
    if (error || !data) {
      console.error("Error fetching sender availability:", error);
      toast.error("Failed to fetch sender availability.");
      return null;
    }
    return {
      notes: (data as any).sender_notes || "",
      dates: extractDates((data as any).pickup_date),
    };
  } catch (error) {
    console.error("Unexpected error fetching sender availability:", error);
    toast.error("Unexpected error fetching sender availability.");
    return null;
  }
};

export const getReceiverAvailability = async (orderId: string) => {
  try {
    const { data, error } = await supabase.rpc("get_public_order" as any, { p_identifier: orderId });
    if (error || !data) {
      console.error("Error fetching receiver availability:", error);
      toast.error("Failed to fetch receiver availability.");
      return null;
    }
    return {
      notes: (data as any).receiver_notes || "",
      dates: extractDates((data as any).delivery_date),
    };
  } catch (error) {
    console.error("Unexpected error fetching receiver availability:", error);
    toast.error("Unexpected error fetching receiver availability.");
    return null;
  }
};


