import { supabase } from "@/integrations/supabase/client";

export interface TimeslipRow {
  id: string;
  date: string;
  mileage: number | null;
  driver_id: string;
}

export interface WeeklyVehicleStat {
  week: string;
  label: string;
  miles: number;
  routes: number;
  drivers: number;
}

export const fetchTimeslipsForAnalytics = async (): Promise<TimeslipRow[]> => {
  const all: TimeslipRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("timeslips")
      .select("id,date,mileage,driver_id")
      .eq("status", "approved")
      .order("date", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as TimeslipRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
};

// Get ISO week start (Monday) as YYYY-MM-DD
const getWeekStart = (dateStr: string): Date => {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const fmtWeekLabel = (d: Date): string =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

export const getWeeklyVehicleStats = (rows: TimeslipRow[]): WeeklyVehicleStat[] => {
  const map = new Map<string, { miles: number; routes: number; drivers: Set<string>; date: Date }>();
  for (const r of rows) {
    if (!r.date) continue;
    const ws = getWeekStart(r.date);
    const key = ws.toISOString().slice(0, 10);
    if (!map.has(key)) {
      map.set(key, { miles: 0, routes: 0, drivers: new Set(), date: ws });
    }
    const entry = map.get(key)!;
    entry.miles += Number(r.mileage) || 0;
    entry.routes += 1;
    if (r.driver_id) entry.drivers.add(r.driver_id);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({
      week,
      label: fmtWeekLabel(v.date),
      miles: Math.round(v.miles),
      routes: v.routes,
      drivers: v.drivers.size,
    }));
};

export const getVehicleTotals = (weekly: WeeklyVehicleStat[]) => {
  const weeks = weekly.length || 1;
  const totalMiles = weekly.reduce((s, w) => s + w.miles, 0);
  const totalRoutes = weekly.reduce((s, w) => s + w.routes, 0);
  const allDrivers = new Set<string>();
  weekly.forEach((w) => {
    // approximate unique drivers across all weeks by max in single week is inaccurate;
    // expose avg drivers/week instead
  });
  const avgDriversPerWeek =
    weekly.reduce((s, w) => s + w.drivers, 0) / weeks;
  return {
    totalMiles,
    totalRoutes,
    avgMilesPerWeek: Math.round(totalMiles / weeks),
    avgRoutesPerWeek: Math.round(totalRoutes / weeks),
    avgDriversPerWeek: Math.round(avgDriversPerWeek * 10) / 10,
  };
};
