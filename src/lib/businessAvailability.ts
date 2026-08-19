import { addDays, format, startOfDay } from "date-fns";
import { DAY_NAMES, DEFAULT_OPENING_HOURS, OpeningHours } from "@/types/user";

/**
 * Normalise a possibly-null opening hours JSON blob into a full OpeningHours object.
 */
export const normaliseOpeningHours = (raw: any): OpeningHours => {
  if (!raw || typeof raw !== "object") return DEFAULT_OPENING_HOURS;
  const result = { ...DEFAULT_OPENING_HOURS } as OpeningHours;
  for (const day of DAY_NAMES) {
    const value = raw[day];
    if (value && typeof value === "object") {
      result[day] = {
        open: Boolean(value.open),
        start: typeof value.start === "string" ? value.start : "",
        end: typeof value.end === "string" ? value.end : "",
        is24h: Boolean(value.is24h),
      };
    }
  }
  return result;
};

const dayKeyForDate = (date: Date): keyof OpeningHours =>
  DAY_NAMES[(date.getDay() + 6) % 7];

/**
 * Returns the next `count` days (starting tomorrow) on which the business is open,
 * skipping any date the calendar itself disables (holidays, blocked Fridays, etc.).
 */
export const getNextOpenDays = (
  hours: OpeningHours,
  count = 7,
  isDateDisabled?: (date: Date) => boolean,
  maxLookaheadDays = 60
): Date[] => {
  const result: Date[] = [];
  const today = startOfDay(new Date());

  for (let offset = 1; offset <= maxLookaheadDays && result.length < count; offset++) {
    const date = addDays(today, offset);
    const day = hours[dayKeyForDate(date)];
    if (!day?.open) continue;
    if (isDateDisabled?.(date)) continue;
    result.push(date);
  }

  return result;
};

const formatDayWindow = (day: OpeningHours[keyof OpeningHours]): string => {
  if (day.is24h) return "24 hours";
  if (day.start && day.end) return `${day.start}-${day.end}`;
  return "business hours";
};

/**
 * Human readable summary of the collection windows for the given dates.
 */
export const describeOpeningWindows = (hours: OpeningHours, dates: Date[]): string => {
  if (dates.length === 0) return "";
  const lines = dates.map((date) => {
    const day = hours[dayKeyForDate(date)];
    return `${format(date, "EEE d MMM")}: ${formatDayWindow(day)}`;
  });
  return `Bike is available now — collect within business hours:\n${lines.join("\n")}`;
};
