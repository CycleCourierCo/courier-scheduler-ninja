export interface OdometerReading {
  reading_date: string; // YYYY-MM-DD
  odometer_mi: number;
  created_at?: string;
}
export interface TimeslipMiles {
  date: string; // YYYY-MM-DD
  mileage: number | null;
}

/**
 * Work out a van's odometer. The newest manual reading wins; only approved
 * timeslip miles from days AFTER that reading are added on top. With no
 * reading, the purchase baseline plus every timeslip mile is used.
 */
export function effectiveOdometer(
  baselineMileage: number,
  timeslips: TimeslipMiles[],
  readings: OdometerReading[],
): { base: number; sinceMiles: number; total: number; lastReading: OdometerReading | null } {
  const last = [...readings].sort((a, b) =>
    a.reading_date === b.reading_date
      ? (b.created_at ?? "").localeCompare(a.created_at ?? "")
      : b.reading_date.localeCompare(a.reading_date),
  )[0] ?? null;
  const base = last ? last.odometer_mi : baselineMileage || 0;
  const sinceMiles = timeslips
    .filter((t) => !last || t.date > last.reading_date)
    .reduce((s, t) => s + (Number(t.mileage) || 0), 0);
  return { base, sinceMiles, total: base + sinceMiles, lastReading: last };
}
