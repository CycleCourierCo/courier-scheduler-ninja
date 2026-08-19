/**
 * Customer-provided alternate collection/delivery details captured on the
 * availability pages: a neighbour house number (instruction only) and an
 * optional workplace address with the days/times it can be used.
 */

export interface AltWorkAddress {
  street: string;
  city: string;
  state?: string;
  zipCode: string;
  lat?: number | null;
  lon?: number | null;
}

export interface AltWindow {
  /** JS day numbers: 0 = Sunday ... 6 = Saturday */
  days: number[];
  /** HH:MM */
  start: string;
  /** HH:MM */
  end: string;
}

export interface AltLocation {
  neighbour_number?: string | null;
  work_address?: AltWorkAddress | null;
  work_windows?: AltWindow[];
  home_windows?: AltWindow[];
}

export const EMPTY_ALT_WINDOW: AltWindow = { days: [], start: "09:00", end: "17:00" };

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const formatAltAddress = (address?: AltWorkAddress | null): string => {
  if (!address) return "";
  const state = [address.state, address.zipCode].filter(Boolean).join(" ").trim();
  return [address.street, address.city, state].filter(Boolean).join(", ");
};

export const parseAltLocation = (raw: any): AltLocation | null => {
  if (!raw || typeof raw !== "object") return null;
  const alt: AltLocation = {
    neighbour_number: typeof raw.neighbour_number === "string" ? raw.neighbour_number : null,
    work_address: raw.work_address && typeof raw.work_address === "object" ? raw.work_address : null,
    work_windows: Array.isArray(raw.work_windows) ? raw.work_windows : [],
    home_windows: Array.isArray(raw.home_windows) ? raw.home_windows : [],
  };
  if (!alt.neighbour_number && !alt.work_address) return null;
  return alt;
};

export const hasWorkAddress = (alt?: AltLocation | null): boolean =>
  Boolean(alt?.work_address && (alt.work_address.street || alt.work_address.zipCode));

const toMinutes = (time?: string): number | null => {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const windowMatches = (windows: AltWindow[] | undefined, date: Date, timeHHMM: string): boolean => {
  if (!windows || windows.length === 0) return false;
  const day = date.getDay();
  const slotStart = toMinutes(timeHHMM);
  if (slotStart === null) return false;
  return windows.some((w) => {
    if (!Array.isArray(w.days) || !w.days.includes(day)) return false;
    const start = toMinutes(w.start);
    const end = toMinutes(w.end);
    if (start === null || end === null) return true;
    return slotStart >= start && slotStart <= end;
  });
};

export type AddressSource = "home" | "work";

export interface ResolvedStopAddress {
  source: AddressSource;
  /** Human readable address for the chosen source (empty for home = use the order address) */
  workAddress: string;
  lat?: number | null;
  lon?: number | null;
  neighbourNumber?: string | null;
}

/**
 * Decide which address a stop should use for a given date + arrival time.
 * Work wins when the slot falls inside a work window; otherwise home.
 */
export const resolveStopAddress = (
  alt: AltLocation | null | undefined,
  date: Date | undefined,
  timeHHMM: string | undefined,
): ResolvedStopAddress => {
  const neighbourNumber = alt?.neighbour_number || null;
  if (!alt || !hasWorkAddress(alt) || !date || !timeHHMM) {
    return { source: "home", workAddress: "", neighbourNumber };
  }

  const useWork = windowMatches(alt.work_windows, date, timeHHMM);
  if (!useWork) return { source: "home", workAddress: "", neighbourNumber };

  return {
    source: "work",
    workAddress: formatAltAddress(alt.work_address),
    lat: alt.work_address?.lat ?? null,
    lon: alt.work_address?.lon ?? null,
    neighbourNumber,
  };
};

export const describeWindows = (windows?: AltWindow[]): string => {
  if (!windows || windows.length === 0) return "";
  return windows
    .filter((w) => w.days?.length)
    .map((w) => `${w.days.slice().sort().map((d) => DAY_LABELS[d]).join(", ")} ${w.start}-${w.end}`)
    .join("; ");
};
