
/**
 * Tracking Service
 * Provides functions for validating and regenerating tracking numbers
 */
import { supabase } from "@/integrations/supabase/client";

// Check if a tracking number matches the custom format
export const isValidTrackingNumber = (trackingNumber: string): boolean => {
  if (!trackingNumber) return false;
  // Should start with CCC754 followed by 9 digits, then 3 letters, then 3 alphanumeric characters
  const regex = /^CCC754\d{9}[A-Z]{3}[A-Z0-9]{1,3}$/;
  return regex.test(trackingNumber);
};

// Generate tracking number for a new order
export const generateTrackingNumber = async (senderName: string, receiverZipCode: string): Promise<string> => {
  try {
    console.log("Generating tracking number with parameters:", { senderName, receiverZipCode });
    
    // Call the edge function using the Supabase client instead of fetch
    const { data, error } = await supabase.functions.invoke('generate-tracking-numbers', {
      body: {
        generateSingle: true,
        senderName,
        receiverZipCode
      }
    });

    if (error) {
      console.error("Error generating tracking number:", error);
      throw new Error("Failed to generate tracking number");
    }
    
    if (!data?.trackingNumber) {
      console.error("No tracking number returned from function");
      throw new Error("Failed to generate tracking number");
    }
    
    console.log("Successfully generated tracking number:", data.trackingNumber);
    return data.trackingNumber;
  } catch (error) {
    console.error("Error calling tracking number generation:", error);
    throw error;
  }
};

// Regenerate tracking numbers for orders that have invalid tracking numbers
export const regenerateTrackingNumber = async (orderId: string): Promise<boolean> => {
  try {
    console.log("Regenerating tracking number for order:", orderId);
    
    // Call the edge function using the Supabase client instead of fetch
    const { data, error } = await supabase.functions.invoke('generate-tracking-numbers', {
      body: {
        forceAll: false,
        specificOrderId: orderId
      }
    });

    if (error) {
      console.error("Error regenerating tracking number:", error);
      return false;
    }
    
    console.log("Tracking number regeneration result:", data);
    return true;
  } catch (error) {
    console.error("Error calling tracking number regeneration:", error);
    return false;
  }
};
