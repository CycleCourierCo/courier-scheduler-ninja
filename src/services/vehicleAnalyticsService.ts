import { supabase } from "@/integrations/supabase/client";

export interface TimeslipRow {
  id: string;
  date: string;
  mileage: number | null;
  driver_id: string;
  vehicle_id: string | null;
}

export interface WeeklyVehicleStat {
  week: string;
  label: string;
  miles: number;
  routes: number;
  drivers: number;
}

export interface DateRange {
  start: string;
  end: string;
}

export const fetchTimeslipsForAnalytics = async (range?: DateRange): Promise<TimeslipRow[]> => {
  const all: TimeslipRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    let query = supabase
      .from("timeslips")
      .select("id,date,mileage,driver_id,vehicle_id")
      .eq("status", "approved")
      .order("date", { ascending: true })
      .range(from, from + pageSize - 1);
    if (range) {
      query = query.gte("date", range.start).lte("date", range.end);
    }
    const { data, error } = await query;
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

// Sum mileage grouped by vehicle_id, regardless of date range filter applied at fetch
export const getMileageByVehicle = (rows: TimeslipRow[]): Record<string, number> => {
  const totals: Record<string, number> = {};
  for (const r of rows) {
    if (!r.vehicle_id) continue;
    totals[r.vehicle_id] = (totals[r.vehicle_id] || 0) + (Number(r.mileage) || 0);
  }
  return totals;
};

export interface VehicleLeaderboardRow {
  vehicle_id: string;
  registration: string;
  miles: number;
  routes: number;
  activeDays: number;
}

export const getVehicleLeaderboard = (
  rows: TimeslipRow[],
  vehicleLookup: Record<string, { registration: string }>,
): VehicleLeaderboardRow[] => {
  const map = new Map<string, { miles: number; routes: number; days: Set<string> }>();
  for (const r of rows) {
    if (!r.vehicle_id) continue;
    if (!map.has(r.vehicle_id)) {
      map.set(r.vehicle_id, { miles: 0, routes: 0, days: new Set() });
    }
    const e = map.get(r.vehicle_id)!;
    e.miles += Number(r.mileage) || 0;
    e.routes += 1;
    if (r.date) e.days.add(r.date);
  }
  return Array.from(map.entries())
    .map(([vehicle_id, v]) => ({
      vehicle_id,
      registration: vehicleLookup[vehicle_id]?.registration ?? "Unknown",
      miles: Math.round(v.miles),
      routes: v.routes,
      activeDays: v.days.size,
    }))
    .sort((a, b) => b.miles - a.miles);
};

export interface WeeklyMileageByVehicleRow {
  week: string;
  label: string;
  [registration: string]: string | number;
}

export const getWeeklyMileageByVehicle = (
  rows: TimeslipRow[],
  vehicleIds: string[],
  vehicleLookup: Record<string, { registration: string }>,
): WeeklyMileageByVehicleRow[] => {
  const selected = new Set(vehicleIds);
  const weekMap = new Map<string, { date: Date; perReg: Record<string, number> }>();
  for (const r of rows) {
    if (!r.vehicle_id || !selected.has(r.vehicle_id) || !r.date) continue;
    const reg = vehicleLookup[r.vehicle_id]?.registration ?? "Unknown";
    const ws = getWeekStart(r.date);
    const key = ws.toISOString().slice(0, 10);
    if (!weekMap.has(key)) weekMap.set(key, { date: ws, perReg: {} });
    const entry = weekMap.get(key)!;
    entry.perReg[reg] = (entry.perReg[reg] || 0) + (Number(r.mileage) || 0);
  }
  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => {
      const row: WeeklyMileageByVehicleRow = { week, label: fmtWeekLabel(v.date) };
      // Ensure every selected vehicle has a numeric value (0 if absent) for clean lines
      for (const id of vehicleIds) {
        const reg = vehicleLookup[id]?.registration ?? "Unknown";
        row[reg] = Math.round(v.perReg[reg] || 0);
      }
      return row;
    });
};
