// Quick-clean rules for the Route Builder "Get Timeslots" bar.
// Pure functions (no React/Supabase) so Vitest checks the same rules the page uses.

/** Order stages that mean the bike has already been collected or is being collected now. */
const COLLECTED_OR_UNDER_WAY = new Set([
  'driver_to_collection',
  'collected',
  'driver_to_delivery',
  'shipped',
  'delivered',
  'in_depot_awaiting_boxing',
  'boxed_awaiting_label',
  'awaiting_3p_collection',
  'collected_by_3p',
  'delivered_by_3p',
  'delivered_to_ferry',
  'awaiting_trunk_to_scotland',
  'in_transit_to_scotland',
  'at_scotland_depot',
  'awaiting_trunk_to_depot',
  'in_transit_to_depot',
]);

/** Calendar day (YYYY-MM-DD) in Europe/London for a stored date or timestamp. */
export const londonDay = (value: string | Date): string => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
};

interface CleanJob {
  orderId: string;
  type: 'pickup' | 'delivery' | 'break' | string;
  orderData?: any;
  order?: any;
}

/**
 * "Remove not collected" should only remove a delivery when nothing will have
 * collected the bike by the route date. Keeps deliveries whose bike is:
 *  - already collected (flag, confirmation stamp or a collected/under-way stage),
 *  - being collected on this same route (pickup for the same order on the route),
 *  - scheduled for collection on or before the route date (e.g. today on another van).
 */
export const isRemovableUncollectedDelivery = (
  job: CleanJob,
  routeJobs: CleanJob[],
  routeDate: Date | string | undefined,
): boolean => {
  if (job.type !== 'delivery') return false;
  const od = job.orderData ?? {};
  const collected = od.order_collected ?? job.order?.order_collected;
  if (collected === true) return false;
  if (od.collection_confirmation_sent_at) return false;
  const status = od.status ?? job.order?.status;
  if (status && COLLECTED_OR_UNDER_WAY.has(status)) return false;
  if (routeJobs.some((j) => j.orderId === job.orderId && j.type === 'pickup')) return false;
  const sched = od.scheduled_pickup_date;
  if (sched && routeDate && londonDay(sched) <= londonDay(routeDate)) return false;
  return true;
};

/**
 * "Remove not customer dates" should only remove a stop when the customer has
 * given dates, none match the route date, and at least one is still to come on or
 * after the route date. Stops whose dates have all passed (expired) are kept —
 * planners deliberately schedule those to clear the backlog.
 */
export const isRemovableNotCustomerDate = (
  jobType: string,
  routeDate: Date | string | undefined,
  pickupDates?: string[] | null,
  deliveryDates?: string[] | null,
): boolean => {
  if (!routeDate || jobType === 'break') return false;
  const dates = jobType === 'pickup' ? pickupDates : deliveryDates;
  if (!dates || dates.length === 0) return false;
  const route = londonDay(routeDate);
  const days = dates.map(londonDay);
  if (days.includes(route)) return false;
  return days.some((d) => d > route);
};
