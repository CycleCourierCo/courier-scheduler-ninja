/** Shared route costing constants so Get Timeslots and Generate Routes stay in step. */
export const COST_PER_MILE = 0.45;
export const DRIVER_HOURLY_RATE = 11;

export const formatGBP = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
