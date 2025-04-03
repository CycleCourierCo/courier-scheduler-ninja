
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Regenerates tracking numbers for orders that don't have the correct format
 * @param forceAll If true, regenerates tracking numbers for all orders
 * @returns Result of the tracking number generation
 */
export const regenerateTrackingNumbers = async (forceAll: boolean = false) => {
  try {
    const { data, error } = await supabase.functions.invoke("generate-tracking-numbers", {
      body: { forceAll }
    });

    if (error) {
      console.error("Error regenerating tracking numbers:", error);
      toast.error("Failed to regenerate tracking numbers");
      throw error;
    }

    console.log("Tracking number generation results:", data);
    
    if (data.success) {
      toast.success(`Successfully processed ${data.results?.length || 0} tracking numbers`);
    } else {
      toast.error("Failed to regenerate tracking numbers");
    }

    return data;
  } catch (err) {
    console.error("Error in regenerateTrackingNumbers:", err);
    toast.error("An unexpected error occurred while regenerating tracking numbers");
    throw err;
  }
};

/**
 * Checks if a tracking number follows the expected format (CCC754...)
 * @param trackingNumber The tracking number to validate
 * @returns True if the tracking number is valid, false otherwise
 */
export const isValidTrackingNumber = (trackingNumber?: string): boolean => {
  if (!trackingNumber) return false;
  return trackingNumber.startsWith('CCC754');
};
