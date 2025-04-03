
/**
 * Tracking Service
 * Provides functions for generating and validating tracking numbers
 */

// Generate a custom order ID/tracking number
// Format: CCC + 754 + 9-digit sequence + first 3 letters of sender name + first 3 letters of receiver zipcode
export const generateTrackingNumber = (senderName: string, receiverZipCode: string): string => {
  // Create a random 9-digit number
  const randomDigits = Math.floor(100000000 + Math.random() * 900000000);
  
  // Get first 3 letters of sender name (uppercase)
  const senderPrefix = senderName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  
  // Get first 3 characters of receiver zipcode
  const zipSuffix = (receiverZipCode || '').substring(0, 3).toUpperCase();
  
  // Combine all parts - ensure we use the correct prefix CCC754 and trim any spaces
  return `CCC754${randomDigits}${senderPrefix}${zipSuffix}`.trim().replace(/\s+/g, '');
};

// Check if a tracking number matches the custom format
export const isValidTrackingNumber = (trackingNumber: string): boolean => {
  if (!trackingNumber) return false;
  // Should start with CCC754 followed by 9 digits, then 3 letters, then 3 alphanumeric characters
  const regex = /^CCC754\d{9}[A-Z]{3}[A-Z0-9]{1,3}$/;
  return regex.test(trackingNumber);
};

// Regenerate tracking numbers for orders that have invalid tracking numbers
export const regenerateTrackingNumber = async (orderId: string): Promise<boolean> => {
  try {
    // Call the Supabase function to regenerate tracking number
    const { data, error } = await fetch(`https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/generate-tracking-numbers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
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
