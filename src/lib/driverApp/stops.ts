export interface DriverStop {
  order: number;
  type: "pickup" | "delivery" | string;
  orderId?: string;
  address?: string;
  contactName?: string;
  phoneNumber?: string;
  estimatedTime?: string;
  lat?: number;
  lon?: number;
}

/** Only real stops with an order, in planned running order. */
export function normaliseStops(raw: unknown): DriverStop[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s: any) => s && typeof s === "object" && s.orderId && (s.type === "pickup" || s.type === "delivery"))
    .map((s: any) => s as DriverStop)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

export function navigateUrl(stop: DriverStop): string {
  const dest = stop.lat != null && stop.lon != null ? `${stop.lat},${stop.lon}` : encodeURIComponent(stop.address ?? "");
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

export const telUrl = (phone?: string) => (phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "");

/** Location is sent at most once every 90 seconds while on shift. */
export const POSITION_INTERVAL_MS = 90_000;
export function shouldSendPosition(lastSentAt: number | null, now: number): boolean {
  return lastSentAt == null || now - lastSentAt >= POSITION_INTERVAL_MS;
}

/** Live driver pins older than this are hidden on the Live Map. */
export const DRIVER_PIN_MAX_AGE_MIN = 15;
