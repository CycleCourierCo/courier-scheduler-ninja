export const pricingData = [
  { type: "Boxed Kids Bikes", price: 35 },
  { type: "Wheelset/Frameset", price: 35 },
  { type: "Kids Bikes", price: 40 },
  { type: "BMX Bikes", price: 40 },
  { type: "Bike Rack", price: 40 },
  { type: "Turbo Trainer", price: 40 },
  { type: "Folding Bikes", price: 40 },
  { type: "Non-Electric Bikes", price: 60 },
  { type: "Travel Bike Boxes", price: 60 },
  { type: "Electric Bikes under 25kg", price: 70 },
  { type: "Electric Bikes over 25kg", price: 130 },
  { type: "Longtail Cargo Bikes", price: 130 },
  { type: "Stationary Bikes", price: 70 },
  { type: "Tandem Bikes", price: 110 },
  { type: "Recumbent", price: 130 },
  { type: "Small Trike", price: 150 },
  { type: "Large Trike", price: 180 },
  { type: "Double Seat/Platform/Cargo Trikes", price: 225 },
];

// Maps order bike_type values to their full delivery price
const bikeTypePriceMap: Record<string, number> = {
  // Exact matches from order bike_type values
  "Boxed Kids Bikes": 35,
  "Wheelset/Frameset": 35,
  "Kids Bikes": 40,
  "BMX Bikes": 40,
  "Bike Rack": 40,
  "Turbo Trainer": 40,
  "Folding Bikes": 40,
  "Non-Electric - Mountain Bike": 60,
  "Non-Electric - Road Bike": 60,
  "Non-Electric - Hybrid": 60,
  "Non-Electric Bikes": 60,
  "Travel Bike Box": 60,
  "Travel Bike Boxes": 60,
  "Electric Bike - Under 25kg": 70,
  "Electric Bikes under 25kg": 70,
  "Stationary Bike": 70,
  "Stationary Bikes": 70,
  "Tandem": 110,
  "Tandem Bikes": 110,
  "Electric Bike - Over 25kg": 130,
  "Electric Bikes over 25kg": 130,
  "Electric Bike - Over 50kg": 130,
  "Longtail Cargo Bike": 130,
  "Longtail Cargo Bikes": 130,
  "Recumbent": 130,
  "Small Trike": 150,
  "Large Trike": 180,
  "Cargo Bike": 225,
  "Double Seat/Platform/Cargo Trikes": 225,
};

/**
 * Returns the revenue per stop for a given bike type (half the full delivery price).
 * Each order has two stops (collection + delivery), so we halve the price.
 * Falls back to £30 per stop (half of £60) for unknown types.
 */
export const getRevenuePerStopForBikeType = (bikeType: string | null | undefined): number => {
  if (!bikeType) return 30; // fallback: half of £60

  // Try exact match first
  const exactPrice = bikeTypePriceMap[bikeType];
  if (exactPrice !== undefined) return exactPrice / 2;

  // Try case-insensitive match
  const lowerType = bikeType.toLowerCase();
  for (const [key, price] of Object.entries(bikeTypePriceMap)) {
    if (key.toLowerCase() === lowerType) return price / 2;
  }

  // Try partial matching for Non-Electric subtypes
  if (lowerType.startsWith("non-electric")) return 60 / 2;
  if (lowerType.startsWith("electric")) return 70 / 2;

  return 30; // default fallback
};
