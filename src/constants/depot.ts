// Depot location for Cycle Courier
// Lawden Road, Birmingham, B10 0AD
export const DEPOT_LOCATION = {
  address: 'Lawden Road, Birmingham, B10 0AD',
  postcode: 'B10 0AD',
  lat: 52.4690197,
  lon: -1.8757663
};

// Receiver block used for Box My Bike orders: the bike is delivered to our depot
// and boxed there, so the depot becomes the delivery contact/address.
export const DEPOT_RECEIVER = {
  name: 'Cycle Courier Depot',
  email: 'info@cyclecourierco.com',
  phone: '+441217980767',
  address: {
    street: 'Lawden Road',
    city: 'Birmingham',
    state: 'West Midlands',
    zipCode: DEPOT_LOCATION.postcode,
    country: 'United Kingdom',
    lat: DEPOT_LOCATION.lat,
    lon: DEPOT_LOCATION.lon,
  },
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
  lat: 53.4713,
  lon: -2.3049,
};

// Proximity threshold in meters
// If delivery is within this distance from depot on same-day collection,
// bike must be loaded as driver won't have it yet
export const DEPOT_PROXIMITY_THRESHOLD_METERS = 500;

