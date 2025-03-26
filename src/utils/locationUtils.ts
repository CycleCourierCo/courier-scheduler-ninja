
import { Order } from "@/types/order";

// Define the OrderContact type using the same structure as in the Order type
export type OrderContact = {
  name: string;
  email?: string;
  phone?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  };
};

// Helper function to extract the first part of a UK postcode (outward code)
export const extractOutwardCode = (postcode: string): string => {
  if (!postcode) return "";
  
  // Clean and format the postcode
  const cleanPostcode = postcode.trim().toUpperCase().replace(/\s+/g, "");
  
  // Extract the outward code (first part of the postcode)
  // Generally, this is the first 3-4 characters
  const match = cleanPostcode.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return match ? match[1] : cleanPostcode;
};

// Simple distance approximation based on outward postcodes
// This is a very simplified approach using the first digits of the outcode
export const getPostcodeProximity = (postcodeA: string, postcodeB: string): number => {
  const outcodeA = extractOutwardCode(postcodeA);
  const outcodeB = extractOutwardCode(postcodeB);
  
  // If the outward codes are the same, they're in the same area
  if (outcodeA === outcodeB) return 0;
  
  // If they start with the same letter(s), they're in the same region
  if (outcodeA.charAt(0) === outcodeB.charAt(0)) {
    // If they also have the same first number, they're closer
    if (outcodeA.match(/\d/) && outcodeB.match(/\d/) && 
        outcodeA.match(/\d/)?.[0] === outcodeB.match(/\d/)?.[0]) {
      return 30; // Rough estimate: ~30 miles apart
    }
    return 50; // Rough estimate: ~50 miles apart
  }
  
  // Different regions, likely >60 miles apart
  return 100;
};

// Function to determine if two contacts are within the proximity radius
export const areLocationsWithinRadius = (
  contact1: OrderContact, 
  contact2: OrderContact, 
  radiusMiles: number = 60
): boolean => {
  const postcode1 = contact1.address?.zipCode || "";
  const postcode2 = contact2.address?.zipCode || "";
  
  const distance = getPostcodeProximity(postcode1, postcode2);
  return distance <= radiusMiles;
};

// Get a simplified location name from a contact
export const getLocationName = (contact: OrderContact): string => {
  const postcode = contact.address?.zipCode || "";
  const outcode = extractOutwardCode(postcode);
  return `${contact.address?.city || "Unknown"} (${outcode})`;
};
