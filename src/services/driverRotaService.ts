import { supabase } from "@/integrations/supabase/client";
import { fetchHolidays } from "@/services/holidayService";

const db = supabase as any;

export type AbsenceType = "holiday" | "sick" | "unpaid" | "other";
export type AbsenceStatus = "pending" | "approved" | "declined" | "cancelled";

export const ABSENCE_LABELS: Record<AbsenceType, string> = {
  holiday: "Holiday", sick: "Sick", unpaid: "Unpaid leave", other: "Other",
};
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** We operate Sunday to Thursday. */
export const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4];

export interface WeeklyAvailability {
  driver_id: string; weekday: number; is_available: boolean;
  start_time: string | null; end_time: string | null;
}
export interface AvailabilityOverride {
  id?: string; driver_id: string; date: string; is_available: boolean;
  start_time: string | null; end_time: string | null; note: string | null;
}
export interface AbsenceRequest {
  id: string; driver_id: string; type: AbsenceType; start_date: string; end_date: string;
  note?: string | null; status: AbsenceStatus; cancel_requested: boolean;
  decided_by?: string | null; decided_at?: string | null; decision_reason?: string | null;
  created_by?: string | null; created_at?: string;
}

// ---------- date helpers (plain YYYY-MM-DD, no timezone drift) ----------
export const toISO = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
export const parseISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const addDays = (s: string, n: number) => { const d = parseISO(s); d.setUTCDate(d.getUTCDate() + n); return toISO(d); };
export const weekdayOf = (s: string) => parseISO(s).getUTCDay();
export const londonToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
export const weekStartSunday = (s: string) => addDays(s, -weekdayOf(s));
export const eachDay = (from: string, to: string) => {
  const out: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out;
};
export const fmtDay = (s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  parseISO(s).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });

// ---------- availability ----------
export async function getWeeklyAvailability(driverIds?: string[]): Promise<WeeklyAvailability[]> {
  let q = db.from("driver_weekly_availability").select("driver_id, weekday, is_available, start_time, end_time");
  if (driverIds?.length) q = q.in("driver_id", driverIds);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveWeeklyAvailability(driverId: string, rows: Omit<WeeklyAvailability, "driver_id">[]) {
  const { error } = await db.from("driver_weekly_availability").upsert(
    rows.map((r) => ({ ...r, driver_id: driverId, start_time: r.start_time || null, end_time: r.end_time || null })),
    { onConflict: "driver_id,weekday" },
  );
  if (error) throw error;
}

export async function getOverrides(from: string, to: string, driverIds?: string[]): Promise<AvailabilityOverride[]> {
  let q = db.from("driver_availability_overrides").select("*").gte("date", from).lte("date", to).order("date");
  if (driverIds?.length) q = q.in("driver_id", driverIds);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function upsertOverride(o: AvailabilityOverride) {
  const { error } = await db.from("driver_availability_overrides").upsert(
    { driver_id: o.driver_id, date: o.date, is_available: o.is_available,
      start_time: o.start_time || null, end_time: o.end_time || null, note: o.note || null },
    { onConflict: "driver_id,date" },
  );
  if (error) throw error;
}

export async function deleteOverride(id: string) {
  const { error } = await db.from("driver_availability_overrides").delete().eq("id", id);
  if (error) throw error;
}

/** Resolve whether a driver works a given date: override > weekly pattern > default Sun–Thu. */
export function resolveDay(
  driverId: string, date: string, weekly: WeeklyAvailability[], overrides: AvailabilityOverride[],
): { works: boolean; start: string | null; end: string | null; override?: AvailabilityOverride } {
  const ov = overrides.find((o) => o.driver_id === driverId && o.date === date);
  if (ov) return { works: ov.is_available, start: ov.start_time, end: ov.end_time, override: ov };
  const wd = weekdayOf(date);
  const mine = weekly.filter((w) => w.driver_id === driverId);
  if (!mine.length) return { works: DEFAULT_WORKING_DAYS.includes(wd), start: null, end: null };
  const row = mine.find((w) => w.weekday === wd);
  return { works: !!row?.is_available, start: row?.start_time ?? null, end: row?.end_time ?? null };
}

// ---------- absence requests ----------
export async function getMyRequests(driverId: string): Promise<AbsenceRequest[]> {
  const { data, error } = await db.from("driver_absence_requests").select("*")
    .eq("driver_id", driverId).order("start_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllRequests(filter: { statuses?: AbsenceStatus[]; from?: string } = {}): Promise<AbsenceRequest[]> {
  let q = db.from("driver_absence_requests").select("*").order("start_date");
  if (filter.statuses?.length) q = q.in("status", filter.statuses);
  if (filter.from) q = q.gte("end_date", filter.from);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Rota-safe absences (no notes) — available to admins and route planners. */
export async function getRotaAbsences(from: string, to: string): Promise<AbsenceRequest[]> {
  const { data, error } = await db.rpc("get_rota_absences", { p_from: from, p_to: to });
  if (error) throw error;
  return data || [];
}

export async function createRequest(input: {
  driver_id: string; type: AbsenceType; start_date: string; end_date: string; note?: string; status?: AbsenceStatus;
}): Promise<AbsenceRequest> {
  const { data, error } = await db.from("driver_absence_requests")
    .insert({ ...input, note: input.note?.trim() || null }).select().single();
  if (error) throw error;
  return data;
}

export async function updateRequest(id: string, patch: Partial<AbsenceRequest>) {
  const { data, error } = await db.from("driver_absence_requests").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as AbsenceRequest;
}

export async function notifyAbsence(requestId: string, event: "submitted" | "decided" | "cancel_requested") {
  try {
    await supabase.functions.invoke("driver-absence-notify", { body: { requestId, event } });
  } catch (e) {
    console.warn("Absence notification failed", e);
  }
}

// ---------- settings ----------
export async function getMinDrivers(): Promise<number> {
  const { data } = await db.from("rota_settings").select("min_drivers_per_day").eq("id", 1).maybeSingle();
  return data?.min_drivers_per_day ?? 3;
}
export async function setMinDrivers(n: number) {
  const { error } = await db.from("rota_settings").upsert({ id: 1, min_drivers_per_day: n });
  if (error) throw error;
}

export async function saveLeaveSettings(driverId: string, patch: { annual_leave_days?: number; leave_year_start?: string; depot_id?: string | null }) {
  const { error } = await db.from("profiles").update(patch).eq("id", driverId);
  if (error) throw error;
}

// ---------- allowance ----------
export function leaveYear(leaveYearStart: string, today = londonToday()): { from: string; to: string } {
  const [m, d] = (leaveYearStart || "01-01").split("-").map(Number);
  const y = Number(today.slice(0, 4));
  let from = toISO(new Date(Date.UTC(y, (m || 1) - 1, d || 1)));
  if (from > today) from = toISO(new Date(Date.UTC(y - 1, (m || 1) - 1, d || 1)));
  const next = parseISO(from); next.setUTCFullYear(next.getUTCFullYear() + 1);
  return { from, to: addDays(toISO(next), -1) };
}

/** Working days a request consumes (normal working days, excluding bank holidays). */
export function countLeaveDays(
  req: { driver_id: string; start_date: string; end_date: string },
  weekly: WeeklyAvailability[], overrides: AvailabilityOverride[], bankHolidays: Set<string>,
  clampFrom?: string, clampTo?: string,
): number {
  const from = clampFrom && clampFrom > req.start_date ? clampFrom : req.start_date;
  const to = clampTo && clampTo < req.end_date ? clampTo : req.end_date;
  if (to < from) return 0;
  return eachDay(from, to).filter((d) => !bankHolidays.has(d) && resolveDay(req.driver_id, d, weekly, overrides).works).length;
}

export async function getBankHolidaySet(): Promise<Set<string>> {
  const hols = await fetchHolidays().catch(() => []);
  return new Set(hols.map((h) => h.date));
}

export interface Allowance { entitlement: number; used: number; pending: number; remaining: number; from: string; to: string }

export async function computeAllowance(
  driver: { id: string; annual_leave_days: number; leave_year_start: string },
  requests?: AbsenceRequest[],
): Promise<Allowance> {
  const { from, to } = leaveYear(driver.leave_year_start);
  const [weekly, overrides, bank, reqs] = await Promise.all([
    getWeeklyAvailability([driver.id]), getOverrides(from, to, [driver.id]), getBankHolidaySet(),
    requests ? Promise.resolve(requests) : getMyRequests(driver.id),
  ]);
  let used = 0, pending = 0;
  for (const r of reqs) {
    if (r.driver_id !== driver.id || r.type !== "holiday") continue;
    const n = countLeaveDays(r, weekly, overrides, bank, from, to);
    if (r.status === "approved") used += n; else if (r.status === "pending") pending += n;
  }
  return { entitlement: driver.annual_leave_days, used, pending, remaining: driver.annual_leave_days - used, from, to };
}

export const errorText = (e: unknown) =>
  (e as any)?.message || (e as any)?.error_description || "Something went wrong";
