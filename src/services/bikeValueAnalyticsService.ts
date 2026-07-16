import { Order } from "@/types/order";

export interface BikeValueRange {
  start: Date;
  end: Date;
}

export interface DailyBikeValuePoint {
  date: string; // YYYY-MM-DD
  label: string; // dd MMM
  totalValue: number;
  bikeCount: number;
  avgValuePerBike: number;
}

export interface BikeValueMetrics {
  totalValueMoved: number;
  totalBikes: number;
  valuedBikes: number; // bikes that had a numeric value
  avgValuePerBike: number;
  avgValuePerDay: number;
  avgBikesPerDay: number;
  activeDays: number;
  highestValueDay: { date: string; value: number } | null;
  highestValueBike: {
    value: number;
    orderId: string;
    brand: string;
    model: string;
  } | null;
  valueByBikeType: Array<{ label: string; totalValue: number; count: number }>;
  valueByBrand: Array<{ label: string; totalValue: number; count: number }>;
}

const parseNumber = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
};

const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

interface FlatBike {
  orderId: string;
  date: Date;
  value: number; // 0 if unknown
  hasValue: boolean;
  brand: string;
  model: string;
  type: string;
}

/**
 * Flattens an orders array into one row per bike, using the `bikes` JSONB
 * snapshot when present and falling back to the legacy flat fields.
 * Cancelled orders are excluded.
 */
const flattenBikes = (orders: Order[]): FlatBike[] => {
  const rows: FlatBike[] = [];
  for (const o of orders) {
    if (!o || o.status === "cancelled") continue;
    const date = new Date(o.createdAt);
    if (isNaN(date.getTime())) continue;

    if (Array.isArray(o.bikes) && o.bikes.length > 0) {
      for (const b of o.bikes) {
        const raw = (b as any)?.value;
        const value = parseNumber(raw);
        rows.push({
          orderId: o.id,
          date,
          value,
          hasValue: raw != null && String(raw).trim() !== "" && value > 0,
          brand: (b?.brand || o.bikeBrand || "Unknown").trim(),
          model: (b?.model || o.bikeModel || "").trim(),
          type: (b?.type || o.bikeType || "Unknown").trim(),
        });
      }
      continue;
    }

    // Legacy fallback
    const qty = Math.max(1, o.bikeQuantity || 1);
    const perBike = o.bikeValue ? Number(o.bikeValue) / qty : 0;
    for (let i = 0; i < qty; i++) {
      rows.push({
        orderId: o.id,
        date,
        value: perBike,
        hasValue: perBike > 0,
        brand: (o.bikeBrand || "Unknown").trim(),
        model: (o.bikeModel || "").trim(),
        type: (o.bikeType || "Unknown").trim(),
      });
    }
  }
  return rows;
};

const inRange = (d: Date, r?: BikeValueRange) => {
  if (!r) return true;
  return d >= r.start && d <= r.end;
};

const topN = <T extends { totalValue: number }>(arr: T[], n = 8): T[] =>
  [...arr].sort((a, b) => b.totalValue - a.totalValue).slice(0, n);

export const getBikeValueMetrics = (
  orders: Order[],
  range?: BikeValueRange,
): BikeValueMetrics => {
  const all = flattenBikes(orders);
  const scoped = all.filter((b) => inRange(b.date, range));

  const totalValueMoved = scoped.reduce((s, b) => s + b.value, 0);
  const totalBikes = scoped.length;
  const valuedBikes = scoped.filter((b) => b.hasValue).length;

  const byDay = new Map<string, { total: number; count: number }>();
  for (const b of scoped) {
    const key = b.date.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { total: 0, count: 0 };
    entry.total += b.value;
    entry.count += 1;
    byDay.set(key, entry);
  }
  const activeDays = byDay.size || 1;

  let highestValueDay: BikeValueMetrics["highestValueDay"] = null;
  for (const [date, v] of byDay) {
    if (!highestValueDay || v.total > highestValueDay.value) {
      highestValueDay = { date, value: v.total };
    }
  }

  let highestValueBike: BikeValueMetrics["highestValueBike"] = null;
  for (const b of scoped) {
    if (!highestValueBike || b.value > highestValueBike.value) {
      highestValueBike = {
        value: b.value,
        orderId: b.orderId,
        brand: b.brand,
        model: b.model,
      };
    }
  }
  if (highestValueBike && highestValueBike.value <= 0) highestValueBike = null;

  const bucket = (key: (b: FlatBike) => string) => {
    const map = new Map<string, { totalValue: number; count: number }>();
    for (const b of scoped) {
      const k = key(b) || "Unknown";
      const e = map.get(k) ?? { totalValue: 0, count: 0 };
      e.totalValue += b.value;
      e.count += 1;
      map.set(k, e);
    }
    return topN(
      Array.from(map.entries()).map(([label, v]) => ({ label, ...v })),
    );
  };

  return {
    totalValueMoved,
    totalBikes,
    valuedBikes,
    avgValuePerBike: valuedBikes > 0 ? totalValueMoved / valuedBikes : 0,
    avgValuePerDay: totalValueMoved / activeDays,
    avgBikesPerDay: totalBikes / activeDays,
    activeDays: byDay.size,
    highestValueDay,
    highestValueBike,
    valueByBikeType: bucket((b) => b.type),
    valueByBrand: bucket((b) => b.brand),
  };
};

export const getDailyBikeValueSeries = (
  orders: Order[],
  range?: BikeValueRange,
): DailyBikeValuePoint[] => {
  const rows = flattenBikes(orders).filter((b) => inRange(b.date, range));
  const map = new Map<
    string,
    { date: Date; total: number; count: number; valued: number }
  >();
  for (const b of rows) {
    const key = b.date.toISOString().slice(0, 10);
    const d = new Date(key + "T00:00:00");
    const e = map.get(key) ?? { date: d, total: 0, count: 0, valued: 0 };
    e.total += b.value;
    e.count += 1;
    if (b.hasValue) e.valued += 1;
    map.set(key, e);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      label: fmtDay(v.date),
      totalValue: Math.round(v.total),
      bikeCount: v.count,
      avgValuePerBike: v.valued > 0 ? Math.round(v.total / v.valued) : 0,
    }));
};

export const getAllTimeBikeValueStats = (orders: Order[]) =>
  getBikeValueMetrics(orders);

export const formatGBP = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);

export const formatGBPPrecise = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n);
