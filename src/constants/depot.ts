// Depot location for Cycle Courier
// Lawden Road, Birmingham, B10 0AD
export const DEPOT_LOCATION = {
  address: 'Lawden Road, Birmingham, B10 0AD',
  postcode: 'B10 0AD',
  lat: 52.4690197,
  lon: -1.8757663
};

// Proximity threshold in meters
// If delivery is within this distance from depot on same-day collection,
// bike must be loaded as driver won't have it yet
export const DEPOT_PROXIMITY_THRESHOLD_METERS = 500;
