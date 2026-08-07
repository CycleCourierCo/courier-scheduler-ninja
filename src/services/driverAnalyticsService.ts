import { supabase } from "@/integrations/supabase/client";

export interface DriverOption {
  id: string;
  name: string;
  email: string | null;
  shipday_driver_name: string | null;
  hourly_rate: number | null;
  van_allowance: number | null;
  is_active: boolean | null;
  created_at: string | null;
}

export interface DriverTimeslipRow {
  id: string;
  driver_id: string;
  date: string;
  driving_hours: number | null;
  stop_hours: number | null;
  lunch_hours: number | null;
  custom_addon_hours: number | null;
  total_hours: number | null;
  hourly_rate: number | null;
  van_allowance: number | null;
  total_pay: number | null;
  total_stops: number | null;
  total_jobs: number | null;
  mileage: number | null;
  vehicle_id: string | null;
  job_locations: any;
}

export interface DriverOrderRow {
  id: string;
  bike_quantity: number | null;
  collection_driver_name: string | null;
  delivery_driver_name: string | null;
  scheduled_pickup_date: string | null;
  scheduled_delivery_date: string | null;
  pickup_timeslot: string | null;
  delivery_timeslot: string | null;
  tracking_events: any;
}

export interface DriverRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

const PAGE = 1000;

/** All users holding the driver role (via user_roles, not the legacy profile role). */
export const fetchDrivers = async (): Promise<DriverOption[]> => {
  const { data: roleRows, error: roleErr } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "driver");
  if (roleErr) throw roleErr;

  const ids = Array.from(new Set((roleRows || []).map((r) => r.user_id))).filter(Boolean);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,email,shipday_driver_name,hourly_rate,van_allowance,is_active,created_at")
    .in("id", ids);
  if (error) throw error;

  return (data || [])
    .map((p) => ({
      id: p.id,
      name: (p.name || p.email || "Unnamed driver") as string,
      email: p.email ?? null,
      shipday_driver_name: p.shipday_driver_name ?? null,
      hourly_rate: p.hourly_rate ?? null,
      van_allowance: p.van_allowance ?? null,
      is_active: p.is_active ?? null,
      created_at: p.created_at ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

/** Approved driver timeslips, paginated past the 1000-row cap. */
export const fetchDriverTimeslips = async (range?: DriverRange): Promise<DriverTimeslipRow[]> => {
  const all: DriverTimeslipRow[] = [];
  let from = 0;
  while (true) {
    let q = supabase
      .from("timeslips")
      .select(
        "id,driver_id,date,driving_hours,stop_hours,lunch_hours,custom_addon_hours,total_hours,hourly_rate,van_allowance,total_pay,total_stops,total_jobs,mileage,vehicle_id,job_locations",
      )
      .eq("status", "approved")
      .order("date", { ascending: true })
      .range(from, from + PAGE - 1);
    if (range) q = q.gte("date", range.start).lte("date", range.end);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as unknown as DriverTimeslipRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
};

/** Earliest approved timeslip date per driver (ignores the range filter). */
export const fetchDriverFirstDates = async (): Promise<Record<string, string>> => {
  const out: Record<string, string> = {};
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("timeslips")
      .select("driver_id,date")
      .eq("status", "approved")
      .order("date", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as any[]) {
      if (!r.driver_id || !r.date) continue;
      if (!out[r.driver_id] || r.date < out[r.driver_id]) out[r.driver_id] = r.date;
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
};

const SELECT_ORDERS =
  "id,bike_quantity,collection_driver_name,delivery_driver_name,scheduled_pickup_date,scheduled_delivery_date,pickup_timeslot,delivery_timeslot,tracking_events";

const pageOrders = async (
  column: "scheduled_pickup_date" | "scheduled_delivery_date",
  range: DriverRange,
): Promise<DriverOrderRow[]> => {
  const rows: DriverOrderRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select(SELECT_ORDERS)
      .gte(column, `${range.start}T00:00:00`)
      .lte(column, `${range.end}T23:59:59.999`)
      .order(column, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as DriverOrderRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
};

/** Orders scheduled for pickup or delivery inside the range (deduped). */
export const fetchOrdersForDrivers = async (range: DriverRange): Promise<DriverOrderRow[]> => {
  const [pickups, deliveries] = await Promise.all([
    pageOrders("scheduled_pickup_date", range),
    pageOrders("scheduled_delivery_date", range),
  ]);
  const map = new Map<string, DriverOrderRow>();
  [...pickups, ...deliveries].forEach((o) => map.set(o.id, o));
  return Array.from(map.values());
};

// ---------- helpers ----------

export const driverNameVariants = (d: Pick<DriverOption, "name" | "shipday_driver_name">): Set<string> => {
  const set = new Set<string>();
  if (d.shipday_driver_name) set.add(d.shipday_driver_name.trim().toLowerCase());
  if (d.name) {
    set.add(d.name.trim().toLowerCase());
    const first = d.name.trim().split(/\s+/)[0];
    if (first) set.add(first.toLowerCase());
  }
  return set;
};

const matches = (name: string | null | undefined, variants: Set<string>) =>
  !!name && variants.has(name.trim().toLowerCase());

const weekStart = (dateStr: string): Date => {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  d.setHours(0, 0, 0, 0);
  return d;
};

const weekKey = (dateStr: string) => {
  const ws = weekStart(dateStr);
  return `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, "0")}-${String(ws.getDate()).padStart(2, "0")}`;
};

const weekLabel = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

const num = (v: any) => Number(v) || 0;

export const formatTenure = (fromDate: string | null): string => {
  if (!fromDate) return "—";
  const start = new Date(`${fromDate.slice(0, 10)}T00:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} mo`;
  return rem === 0 ? `${years} yr` : `${years} yr ${rem} mo`;
};

// ---------- aggregations ----------

export interface WeeklyPayslip {
  week: string;
  label: string;
  days: number;
  hours: number;
  stops: number;
  bikes: number;
  miles: number;
  vanAllowance: number;
  pay: number;
  rows: DriverTimeslipRow[];
}

export const getWeeklyPayslips = (rows: DriverTimeslipRow[]): WeeklyPayslip[] => {
  const map = new Map<string, WeeklyPayslip>();
  for (const r of rows) {
    if (!r.date) continue;
    const key = weekKey(r.date);
    if (!map.has(key)) {
      map.set(key, {
        week: key,
        label: weekLabel(key),
        days: 0,
        hours: 0,
        stops: 0,
        bikes: 0,
        miles: 0,
        vanAllowance: 0,
        pay: 0,
        rows: [],
      });
    }
    const w = map.get(key)!;
    w.days += 1;
    w.hours += num(r.total_hours);
    w.stops += num(r.total_stops);
    w.bikes += num(r.total_jobs);
    w.miles += num(r.mileage);
    w.vanAllowance += num(r.van_allowance);
    w.pay += num(r.total_pay);
    w.rows.push(r);
  }
  return Array.from(map.values()).sort((a, b) => a.week.localeCompare(b.week));
};

export interface PayRatePoint {
  date: string;
  label: string;
  rate: number;
  vanAllowance: number;
}

export const getPayRateHistory = (rows: DriverTimeslipRow[]): PayRatePoint[] => {
  const byDate = new Map<string, { rate: number; van: number }>();
  for (const r of rows) {
    if (!r.date || r.hourly_rate == null) continue;
    byDate.set(r.date, { rate: num(r.hourly_rate), van: num(r.van_allowance) });
  }
  const sorted = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  const out: PayRatePoint[] = [];
  for (const [date, v] of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.rate === v.rate && prev.vanAllowance === v.van) continue;
    out.push({
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }),
      rate: v.rate,
      vanAllowance: v.van,
    });
  }
  // Add a trailing point so the step chart extends to the end of the range
  const last = sorted[sorted.length - 1];
  if (last && out.length > 0 && out[out.length - 1].date !== last[0]) {
    out.push({
      date: last[0],
      label: new Date(`${last[0]}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }),
      rate: last[1].rate,
      vanAllowance: last[1].van,
    });
  }
  return out;
};

export interface WeeklyBikeRow {
  week: string;
  label: string;
  collected: number;
  delivered: number;
}

export interface BikeCounts {
  collected: number;
  delivered: number;
  weekly: WeeklyBikeRow[];
}

export const getBikeCounts = (orders: DriverOrderRow[], variants: Set<string>): BikeCounts => {
  const weeks = new Map<string, WeeklyBikeRow>();
  let collected = 0;
  let delivered = 0;

  const bump = (dateStr: string, field: "collected" | "delivered", qty: number) => {
    const key = weekKey(dateStr);
    if (!weeks.has(key)) weeks.set(key, { week: key, label: weekLabel(key), collected: 0, delivered: 0 });
    weeks.get(key)![field] += qty;
  };

  for (const o of orders) {
    const qty = o.bike_quantity || 1;
    if (matches(o.collection_driver_name, variants) && o.scheduled_pickup_date) {
      collected += qty;
      bump(o.scheduled_pickup_date, "collected", qty);
    }
    if (matches(o.delivery_driver_name, variants) && o.scheduled_delivery_date) {
      delivered += qty;
      bump(o.scheduled_delivery_date, "delivered", qty);
    }
  }

  return {
    collected,
    delivered,
    weekly: Array.from(weeks.values()).sort((a, b) => a.week.localeCompare(b.week)),
  };
};

// --- on-time performance ---

const LONDON = "Europe/London";

/** Local (Europe/London) date + minutes-of-day for a UTC timestamp. */
const londonParts = (iso: string): { date: string; minutes: number } | null => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(hour) * 60 + Number(parts.minute),
  };
};

const timeslotMinutes = (slot: string | null): number | null => {
  if (!slot) return null;
  const [h, m] = slot.split(":").map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
};

const findCompletion = (
  o: DriverOrderRow,
  leg: "pickup" | "delivery",
  variants: Set<string>,
): { timestamp: string } | null => {
  const updates = o.tracking_events?.shipday?.updates;
  if (!Array.isArray(updates)) return null;
  const hits = updates.filter(
    (u: any) =>
      u?.event === "ORDER_COMPLETED" && u?.leg === leg && (!u?.driverName || matches(u.driverName, variants)),
  );
  if (hits.length === 0) return null;
  return { timestamp: hits[0].timestamp };
};

export interface OnTimeLeg {
  orderId: string;
  leg: "pickup" | "delivery";
  date: string;
  promisedStart: number;
  promisedEnd: number;
  actualMinutes: number;
  minutesLate: number;
  verdict: "early" | "ontime" | "late";
}

export interface OnTimeStats {
  onTime: number;
  late: number;
  early: number;
  noData: number;
  total: number;
  rate: number; // % of measurable legs on time
  avgMinutesLate: number;
  legs: OnTimeLeg[];
}

export const getOnTimeStats = (orders: DriverOrderRow[], variants: Set<string>): OnTimeStats => {
  const legs: OnTimeLeg[] = [];
  let noData = 0;

  const evaluate = (o: DriverOrderRow, leg: "pickup" | "delivery") => {
    const scheduled = leg === "pickup" ? o.scheduled_pickup_date : o.scheduled_delivery_date;
    const slot = leg === "pickup" ? o.pickup_timeslot : o.delivery_timeslot;
    if (!scheduled) return;
    const start = timeslotMinutes(slot);
    const completion = findCompletion(o, leg, variants);
    if (start == null || !completion) {
      noData += 1;
      return;
    }
    const actual = londonParts(completion.timestamp);
    if (!actual) {
      noData += 1;
      return;
    }
    const scheduledDate = scheduled.slice(0, 10);
    const dayOffset =
      (new Date(`${actual.date}T00:00:00`).getTime() - new Date(`${scheduledDate}T00:00:00`).getTime()) / 86400000;
    const actualMinutes = actual.minutes + dayOffset * 1440;
    const end = start + 180;
    const verdict = actualMinutes < start ? "early" : actualMinutes <= end ? "ontime" : "late";
    legs.push({
      orderId: o.id,
      leg,
      date: scheduledDate,
      promisedStart: start,
      promisedEnd: end,
      actualMinutes,
      minutesLate: Math.max(0, Math.round(actualMinutes - end)),
      verdict,
    });
  };

  for (const o of orders) {
    if (matches(o.collection_driver_name, variants)) evaluate(o, "pickup");
    if (matches(o.delivery_driver_name, variants)) evaluate(o, "delivery");
  }

  const onTime = legs.filter((l) => l.verdict === "ontime").length;
  const early = legs.filter((l) => l.verdict === "early").length;
  const late = legs.filter((l) => l.verdict === "late").length;
  const measurable = legs.length;
  const lateLegs = legs.filter((l) => l.verdict === "late");

  return {
    onTime,
    late,
    early,
    noData,
    total: measurable + noData,
    rate: measurable > 0 ? Math.round(((onTime + early) / measurable) * 1000) / 10 : 0,
    avgMinutesLate:
      lateLegs.length > 0 ? Math.round(lateLegs.reduce((s, l) => s + l.minutesLate, 0) / lateLegs.length) : 0,
    legs,
  };
};

// --- heat map points ---

export interface HeatPoint {
  lat: number;
  lng: number;
  type: "pickup" | "delivery";
}

export const getHeatPoints = (rows: DriverTimeslipRow[]): HeatPoint[] => {
  const pts: HeatPoint[] = [];
  for (const r of rows) {
    const locs = Array.isArray(r.job_locations) ? r.job_locations : [];
    for (const l of locs as any[]) {
      const lat = Number(l?.lat);
      const lng = Number(l?.lng);
      if (!lat || !lng) continue;
      pts.push({ lat, lng, type: l?.type === "delivery" ? "delivery" : "pickup" });
    }
  }
  return pts;
};

// --- summary ---

export interface DriverSummary {
  days: number;
  hours: number;
  stops: number;
  bikes: number;
  miles: number;
  pay: number;
  avgHoursPerDay: number;
  avgPayPerDay: number;
  avgStopsPerDay: number;
  stopsPerHour: number;
  milesPerStop: number;
  longestDay: number;
  shortestDay: number;
  missingMileageDays: number;
  noVehicleDays: number;
  vehicleSplit: { vehicle_id: string; days: number }[];
  currentRate: number | null;
  currentVanAllowance: number | null;
}

export const getDriverSummary = (rows: DriverTimeslipRow[]): DriverSummary => {
  const days = rows.length;
  const hours = rows.reduce((s, r) => s + num(r.total_hours), 0);
  const stops = rows.reduce((s, r) => s + num(r.total_stops), 0);
  const bikes = rows.reduce((s, r) => s + num(r.total_jobs), 0);
  const miles = rows.reduce((s, r) => s + num(r.mileage), 0);
  const pay = rows.reduce((s, r) => s + num(r.total_pay), 0);
  const dayHours = rows.map((r) => num(r.total_hours)).filter((h) => h > 0);
  const vehicleMap = new Map<string, number>();
  rows.forEach((r) => {
    if (r.vehicle_id) vehicleMap.set(r.vehicle_id, (vehicleMap.get(r.vehicle_id) || 0) + 1);
  });
  const latest = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1))[0];

  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    days,
    hours: round1(hours),
    stops,
    bikes,
    miles: Math.round(miles),
    pay: Math.round(pay),
    avgHoursPerDay: days ? round1(hours / days) : 0,
    avgPayPerDay: days ? Math.round(pay / days) : 0,
    avgStopsPerDay: days ? round1(stops / days) : 0,
    stopsPerHour: hours > 0 ? round1(stops / hours) : 0,
    milesPerStop: stops > 0 ? round1(miles / stops) : 0,
    longestDay: dayHours.length ? round1(Math.max(...dayHours)) : 0,
    shortestDay: dayHours.length ? round1(Math.min(...dayHours)) : 0,
    missingMileageDays: rows.filter((r) => !num(r.mileage)).length,
    noVehicleDays: rows.filter((r) => !r.vehicle_id).length,
    vehicleSplit: Array.from(vehicleMap.entries())
      .map(([vehicle_id, d]) => ({ vehicle_id, days: d }))
      .sort((a, b) => b.days - a.days),
    currentRate: latest?.hourly_rate != null ? num(latest.hourly_rate) : null,
    currentVanAllowance: latest?.van_allowance != null ? num(latest.van_allowance) : null,
  };
};

export interface DriverLeaderboardRow {
  driver_id: string;
  name: string;
  days: number;
  hours: number;
  stops: number;
  bikes: number;
  miles: number;
  pay: number;
  payPerBike: number;
  stopsPerHour: number;
  onTimeRate: number | null;
  collected: number;
  delivered: number;
}

export const getDriverLeaderboard = (
  drivers: DriverOption[],
  timeslips: DriverTimeslipRow[],
  orders: DriverOrderRow[],
): DriverLeaderboardRow[] => {
  return drivers
    .map((d) => {
      const rows = timeslips.filter((t) => t.driver_id === d.id);
      const variants = driverNameVariants(d);
      const summary = getDriverSummary(rows);
      const bikeCounts = getBikeCounts(orders, variants);
      const onTime = getOnTimeStats(orders, variants);
      return {
        driver_id: d.id,
        name: d.name,
        days: summary.days,
        hours: summary.hours,
        stops: summary.stops,
        bikes: summary.bikes,
        miles: summary.miles,
        pay: summary.pay,
        payPerBike: summary.bikes > 0 ? Math.round((summary.pay / summary.bikes) * 100) / 100 : 0,
        stopsPerHour: summary.stopsPerHour,
        onTimeRate: onTime.onTime + onTime.early + onTime.late > 0 ? onTime.rate : null,
        collected: bikeCounts.collected,
        delivered: bikeCounts.delivered,
      };
    })
    .filter((r) => r.days > 0 || r.collected > 0 || r.delivered > 0)
    .sort((a, b) => b.bikes - a.bikes);
};
