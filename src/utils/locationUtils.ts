
import { Address } from "@/types/order";

// Define a type for contact information that includes address
export type OrderContact = {
  name: string;
  email: string;
  phone: string;
  address: Address;
};

// Simple function to extract the outward code from a UK postcode
export const extractOutwardCode = (postcode: string): string => {
  if (!postcode) return '';
  
  // Standardize the postcode format
  const cleanPostcode = postcode.toUpperCase().replace(/\s+/g, '');
  
  // Extract the outward code (first part of the postcode)
  // UK postcodes format: AA9A 9AA or A9A 9AA or A9 9AA or A99 9AA
  const match = cleanPostcode.match(/^[A-Z]{1,2}[0-9][0-9A-Z]?/);
  return match ? match[0] : cleanPostcode.substring(0, Math.min(4, cleanPostcode.length));
};

// Get a displayable location name for grouping
export const getLocationName = (contact: OrderContact): string => {
  if (!contact?.address) return 'Unknown';
  
  const { city, zipCode } = contact.address;
  const outwardCode = extractOutwardCode(zipCode);
  
  return `${city} (${outwardCode})`;
};

// Approximate distance between postcodes based on outward codes
// This is a very simplified approach and doesn't use actual geocoding
export const areLocationsWithinRadius = (
  contact1: OrderContact | undefined,
  contact2: OrderContact | undefined,
  radiusMiles: number = 60
): boolean => {
  if (!contact1?.address?.zipCode || !contact2?.address?.zipCode) {
    return false;
  }
  
  // Get outward codes
  const outward1 = extractOutwardCode(contact1.address.zipCode);
  const outward2 = extractOutwardCode(contact2.address.zipCode);
  
  // If the outward codes are the same, they are definitely within radius
  if (outward1 === outward2) {
    return true;
  }
  
  // Check if the same city - likely within radius
  if (contact1.address.city.toLowerCase() === contact2.address.city.toLowerCase()) {
    return true;
  }
  
  // For more accurate distance calculation, we would need to use a geocoding service
  // or maintain a database of postcode coordinates.
  // This is a simplified approach:
  
  // Compare first letters - if different, likely far apart
  if (outward1[0] !== outward2[0]) {
    // Different first letter typically indicates different regions in UK
    return false;
  }
  
  // If we have the same first letter but different second character,
  // they might be in nearby areas (like B1 and B9)
  if (outward1.length > 1 && outward2.length > 1) {
    const num1 = parseInt(outward1.substring(1, 2), 10);
    const num2 = parseInt(outward2.substring(1, 2), 10);
    
    if (!isNaN(num1) && !isNaN(num2)) {
      // If the numeric part differs by more than 3, they may be far apart
      return Math.abs(num1 - num2) <= 3;
    }
  }
  
// Default - be inclusive rather than exclusive
  return true;
};

// Calculate distance between two coordinates using the Haversine formula
export const calculateDistanceInMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};
