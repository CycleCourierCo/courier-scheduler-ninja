// Depot location for Cycle Courier
// Lawden Road, Birmingham, B10 0AD
export const DEPOT_LOCATION = {
  address: 'Lawden Road, Birmingham, B10 0AD',
  postcode: 'B10 0AD',
  lat: 52.4690197,
  lon: -1.8757663
};

// Northern Ireland ferry hand-off point. NI deliveries are dropped here instead
// of the customer address for onward transport to Northern Ireland.
export const CITY_AIR_EXPRESS = {
  displayName: 'Ferry hand-off',
  name: 'City Air Express',
  email: 'Operations.man@cityairexpress.com',
  phone: '+44 7730 145621',
  address: {
    street: 'Unit 1 Ordinal Street, Trafford Park',
    city: 'Manchester',
    state: 'Greater Manchester',
    zipCode: 'M17 1GB',
    country: 'United Kingdom',
  },
  formatted: 'Unit 1 Ordinal Street, Trafford Park, Manchester, M17 1GB',
  lat: 53.4718,
  lon: -2.2960,
};

// Proximity threshold in meters
// If delivery is within this distance from depot on same-day collection,
// bike must be loaded as driver won't have it yet
export const DEPOT_PROXIMITY_THRESHOLD_METERS = 500;

