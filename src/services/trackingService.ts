
/**
 * Tracking Service
 * Provides functions for validating and regenerating tracking numbers
 */

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
    // Call the Supabase function to generate a tracking number
    const { data, error } = await fetch(`https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/generate-tracking-numbers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ 
        generateSingle: true,
        senderName,
        receiverZipCode
      }),
    }).then(res => res.json());

    if (error || !data?.trackingNumber) {
      console.error("Error generating tracking number:", error);
      throw new Error("Failed to generate tracking number");
    }
    
    return data.trackingNumber;
  } catch (error) {
    console.error("Error calling tracking number generation:", error);
    throw error;
  }
};

// Regenerate tracking numbers for orders that have invalid tracking numbers
export const regenerateTrackingNumber = async (orderId: string): Promise<boolean> => {
  try {
    // Call the Supabase function to regenerate tracking number
    const { data, error } = await fetch(`https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/generate-tracking-numbers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ 
        forceAll: false,
        specificOrderId: orderId 
      }),
    }).then(res => res.json());

    if (error) {
      console.error("Error regenerating tracking number:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error calling tracking number regeneration:", error);
    return false;
  }
};
