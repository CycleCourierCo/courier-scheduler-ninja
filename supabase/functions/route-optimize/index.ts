// Generates van routes across a set of chosen days using the Verso hosted VROOM
// API. Server-side only: Verso credentials never leave here.
//
// Shape of a good plan (owner's definition, see docs/ROUTE_PLANNING.md):
//  - at most one long (expedition) day per date, and only where a difficult
//    area genuinely needs it;
//  - every other route inside a 13 hour shift, depot to depot;
//  - at least 13 jobs per route, thin routes only when urgent work demands it;
//  - one part of the country per route.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const DEPOT = { lat: 52.4690197, lon: -1.8757663 };
const SERVICE_S = 900;
const HOURS = 3600;
const PRIMARY_CAP_H = 13;      // normal shift, depot to depot
const EXPEDITION_CAP_H = 15;   // difficult-area long day
const DEFAULT_CAPACITY = 10;
const STAFF_ROLES = ['admin', 'sales', 'route_planner'];
const MAX_DAYS = 10;
const VIRTUAL_VANS_PER_DAY = 2;
const TIME_BUDGET_MS = 90_000;
// Money, in whole pence, as VROOM demands integers.
const DRIVER_PENCE_PER_HOUR = 1100;          // £11/hour
const PENCE_PER_KM = 28;                     // £0.45/mile ÷ 1.609
const SHIFT_HOURS_CHARGED = 2;               // van shift charge = 2 hours' pay
const EXPEDITION_PREMIUM = 1.5;
const DEFAULT_MAX_LONG_DAYS = 1;
const DEFAULT_MIN_JOBS_TARGET = 13;
const DEFAULT_MIN_JOBS_FLOOR = 9;
const DEFAULT_PAIR_MAX_MI = 30;
const MAX_REDUCTION_STEPS = 8;
const MAX_TRIM_STEPS = 3;
// How far apart a day's stops may sit, worst pair to worst pair.
const MAX_SPREAD_MI = 120;
const MAX_SPREAD_LONG_MI = 220;
// Minimum difficult-area jobs before a long day is offered for that area.
const LONG_DAY_MIN_JOBS = 5;

/* ----------------------------- geography ---------------------------------- */

// 16 compass areas of 22.5° around the depot, plus a depot zone any van may work.
const SECTOR_NAMES = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const SECTOR_COUNT = SECTOR_NAMES.length;
const CENTRAL_SKILL = 20;
const sectorSkill = (idx: number) => 21 + idx;
const DIFFICULT_SKILL_BASE = 101;
const difficultSkill = (areaIdx: number) => DIFFICULT_SKILL_BASE + areaIdx;
const NEAR_RADIUS_MI = 45;

const milesBetween = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const R = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** null = inside the depot zone; otherwise the 22.5° area index (0 = due north). */
const sectorOf = (lat: number, lon: number): number | null => {
  if (milesBetween(DEPOT.lat, DEPOT.lon, lat, lon) <= NEAR_RADIUS_MI) return null;
  const y = Math.sin(((lon - DEPOT.lon) * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180);
  const x = Math.sin((lat * Math.PI) / 180) * Math.cos((DEPOT.lat * Math.PI) / 180)
    - Math.cos((lat * Math.PI) / 180) * Math.sin((DEPOT.lat * Math.PI) / 180) * Math.cos(((lon - DEPOT.lon) * Math.PI) / 180);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round(((bearing + 360) % 360) / 22.5) % SECTOR_COUNT;
};

const sectorLabel = (idx: number | null) => (idx === null ? 'Around the depot' : SECTOR_NAMES[idx]);
const neighbours = (idx: number) => [(idx + SECTOR_COUNT - 1) % SECTOR_COUNT, idx, (idx + 1) % SECTOR_COUNT];

/** Widest gap between any two stops on a route, in miles. */
const spreadMiles = (pts: { lat: number; lon: number }[]) => {
  let worst = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = milesBetween(pts[i].lat, pts[i].lon, pts[j].lat, pts[j].lon);
      if (d > worst) worst = d;
    }
  }
  return Math.round(worst);
};

/* ------------------------------ time helpers ------------------------------ */

const tzOffsetMs = (utcMs: number, tz: string) => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  const asUTC = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second),
  );
  return asUTC - utcMs;
};

/** Epoch seconds for a London wall-clock date + HH:MM. */
const londonEpoch = (dateStr: string, time: string): number => {
  const [h, m] = time.split(':').map(Number);
  const guess = Date.parse(`${dateStr}T00:00:00Z`) + (h || 0) * 3600_000 + (m || 0) * 60_000;
  return Math.round((guess - tzOffsetMs(guess, 'Europe/London')) / 1000);
};

const isoFromEpoch = (s: number) => new Date(s * 1000).toISOString();

const todayLondon = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());

const dateKey = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length < 10) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);
};

const daysUntil = (dateStr: string): number => {
  const diff = (Date.parse(`${dateStr}T12:00:00Z`) - Date.parse(`${todayLondon()}T12:00:00Z`)) / 86_400_000;
  return Math.max(1, Math.round(diff));
};

const daysSince = (dateStr: string): number => {
  const diff = (Date.parse(`${todayLondon()}T12:00:00Z`) - Date.parse(`${dateStr}T12:00:00Z`)) / 86_400_000;
  return Math.max(0, Math.round(diff));
};

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SHORT_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const weekdayIdx = (dateStr: string) => (new Date(`${dateStr}T12:00:00Z`).getUTCDay() + 6) % 7; // 0=Mon
const weekdayKey = (dateStr: string) => DAY_KEYS[weekdayIdx(dateStr)];
const shortWeekday = (dateStr: string) => SHORT_KEYS[weekdayIdx(dateStr)];

/* ------------------------------ geo helpers ------------------------------- */

type Ring = [number, number][];

const pointInRing = (lon: number, lat: number, ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
};

/* ------------------------------ bike spaces ------------------------------- */

const norm = (s: string) => s.trim().toLowerCase();

const spacesForType = (bikeType: string | null | undefined, map: Record<string, number>): number => {
  if (!bikeType) return 1;
  if (typeof map[bikeType] === 'number') return map[bikeType];
  const lower = norm(bikeType);
  for (const [k, v] of Object.entries(map)) if (norm(k) === lower) return v;
  for (const [k, v] of Object.entries(map)) {
    const kk = norm(k);
    if (lower.includes(kk) || kk.includes(lower)) return v;
  }
  return 1;
};

const orderSpaces = (order: any, map: Record<string, number>): number => {
  const bikes = Array.isArray(order?.bikes) ? order.bikes : null;
  if (bikes && bikes.length > 0) {
    const total = bikes.reduce((sum: number, bike: any) => {
      const type = bike?.type ?? bike?.bikeType ?? bike?.bike_type ?? null;
      const qty = Number(bike?.quantity ?? 1) || 1;
      return sum + spacesForType(type, map) * qty;
    }, 0);
    if (total > 0) return Math.round(total * 100) / 100;
  }
  const qty = order?.bike_quantity && order.bike_quantity > 0 ? order.bike_quantity : 1;
  return Math.round(spacesForType(order?.bike_type ?? null, map) * qty * 100) / 100;
};

/* --------------------------------- types ---------------------------------- */

interface Leg {
  key: string;
  jobId: number;
  orderId: string;
  legType: 'collection' | 'delivery';
  lat: number;
  lon: number;
  spaces: number;
  allDates: string[];        // every customer date (any day)
  windowDates: string[];     // customer dates inside the chosen days
  guaranteedDate: string | null;
  priority: number;
  lapsed: boolean;
  expiringInPlan: boolean;
  lastDate: string | null;
  difficult: boolean;
  /** Which difficult area (index into the stored list), when difficult. */
  areaIdx: number | null;
  sector: number | null;
  businessHours: Record<string, any> | null;
  label: string;
  needsUnlock: boolean;
  needsInspection: boolean;
  collectedAt: string | null;
  scheduledCollection: string | null;
}

type VanRole = 'group' | 'roam' | 'long';

interface VanDay {
  vehicleId: number; date: string; vanId: string; vanName: string; capacity: number;
  expedition: boolean; virtual: boolean; role: VanRole; sectors: number[]; areaIdx: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const runStarted = Date.now();
  const budgetLeft = () => TIME_BUDGET_MS - (Date.now() - runStarted);
  // Nothing is ever quietly skipped: whatever we could not finish is reported.
  const skipped: string[] = [];
  const debug: Record<string, any> = { solve_calls: 0, solve_ms: 0, notes: [] };

  try {
    const VERSO_API_URL = Deno.env.get('VERSO_API_URL');
    const VERSO_API_KEY = Deno.env.get('VERSO_API_KEY');
    if (!VERSO_API_URL || !VERSO_API_KEY) return json({ error: 'Verso credentials not configured' }, 500);

    const versoUrl = (endpoint: 'solve' | 'plan') => {
      const raw = VERSO_API_URL.trim().replace(/\/(?=\?|$)/, '');
      let url: URL;
      try { url = new URL(raw); } catch { return raw; }
      url.pathname = `${url.pathname.replace(/\/(solve|plan)$/i, '').replace(/\/$/, '')}/${endpoint}`;
      if (url.searchParams.has('api_key') && !url.searchParams.get('api_key')) {
        url.searchParams.set('api_key', VERSO_API_KEY);
      }
      return url.toString();
    };
    const solveUrl = versoUrl('solve');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: roleRows } = await admin.from('user_roles').select('role').eq('user_id', userData.user.id);
    const roles = (roleRows || []).map((r: any) => r.role);
    if (!roles.some((r: string) => STAFF_ROLES.includes(r))) return json({ error: 'forbidden' }, 403);

    /* ------------------------------- input -------------------------------- */

    const body = await req.json().catch(() => ({}));
    const shiftStart = /^\d{2}:\d{2}$/.test(body?.shift_start ?? '') ? body.shift_start : '09:00';
    const firmDays = Number.isFinite(Number(body?.firm_days)) ? Math.max(0, Math.min(10, Number(body.firm_days))) : 2;
    const inspectionLeadDays = Number.isFinite(Number(body?.inspection_lead_days))
      ? Math.max(0, Math.min(14, Number(body.inspection_lead_days))) : null;
    const mode: 'joint' | 'greedy' = body?.mode === 'greedy' ? 'greedy' : 'joint';
    const includeExpired = body?.include_expired === true;
    const maxLongDays = Number.isFinite(Number(body?.max_long_days))
      ? Math.max(0, Math.min(4, Math.round(Number(body.max_long_days))))
      : DEFAULT_MAX_LONG_DAYS;
    const minJobsTarget = Number.isFinite(Number(body?.min_jobs_target))
      ? Math.max(1, Math.min(30, Math.round(Number(body.min_jobs_target)))) : DEFAULT_MIN_JOBS_TARGET;
    const minJobsFloor = Number.isFinite(Number(body?.min_jobs_floor))
      ? Math.max(1, Math.min(minJobsTarget, Math.round(Number(body.min_jobs_floor)))) : Math.min(DEFAULT_MIN_JOBS_FLOOR, minJobsTarget);
    const pairMaxMiles = Number.isFinite(Number(body?.pair_max_distance_miles))
      ? Math.max(0, Math.min(200, Number(body.pair_max_distance_miles))) : DEFAULT_PAIR_MAX_MI;
    const shortfallOnly = body?.shortfall_only === true;

    const today = todayLondon();
    const selectedDates: string[] = [...new Set<string>(
      (Array.isArray(body?.selected_dates) ? body.selected_dates : [])
        .filter((d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)),
    )].sort().slice(0, MAX_DAYS);
    if (selectedDates.length === 0) return json({ error: 'Pick at least one day to plan' }, 400);

    const flatVanIds: string[] = Array.isArray(body?.van_ids) ? body.van_ids.filter((v: unknown) => typeof v === 'string') : [];
    const grid: Record<string, string[]> = {};
    if (body?.van_availability && typeof body.van_availability === 'object') {
      for (const [date, ids] of Object.entries(body.van_availability as Record<string, unknown>)) {
        if (selectedDates.includes(date) && Array.isArray(ids)) {
          grid[date] = ids.filter((v) => typeof v === 'string') as string[];
        }
      }
    }

    /* ---------------------------- reference data --------------------------- */

    const [spacesRes, settingsRes, areasRes, vehiclesRes, unavailRes] = await Promise.all([
      admin.from('bike_type_spaces').select('bike_type,spaces'),
      admin.from('workshop_settings').select('van_spaces_capacity,working_days,redate_mode').eq('id', 1).maybeSingle(),
      admin.rpc('difficult_areas_geojson'),
      admin.from('vehicles').select('id,registration,make,bike_spaces,status'),
      admin.from('van_unavailability').select('van_id,unavailable_on').in('unavailable_on', selectedDates),
    ]);

    const spaceMap: Record<string, number> = {};
    for (const row of (spacesRes.data as any[]) || []) spaceMap[row.bike_type] = Number(row.spaces);
    const defaultCapacity = Number((settingsRes.data as any)?.van_spaces_capacity) > 0
      ? Number((settingsRes.data as any).van_spaces_capacity) : DEFAULT_CAPACITY;
    const workingDays: string[] = Array.isArray((settingsRes.data as any)?.working_days)
      ? (settingsRes.data as any).working_days : ['sun', 'mon', 'tue', 'wed', 'thu'];

    // Each difficult area keeps its own identity, so a long day covers ONE of
    // them: no van is asked to do Cornwall and Carlisle on the same run.
    const difficultAreas: { name: string; rings: Ring[] }[] = [];
    for (const area of (areasRes.data as any[]) || []) {
      const coords = area?.geojson?.coordinates;
      const rings: Ring[] = [];
      if (Array.isArray(coords)) for (const ring of coords) if (Array.isArray(ring)) rings.push(ring as Ring);
      if (rings.length > 0) difficultAreas.push({ name: String(area?.name ?? `Area ${difficultAreas.length + 1}`), rings });
    }
    const difficultAreaIdx = (lat: number, lon: number): number | null => {
      for (let i = 0; i < difficultAreas.length; i++) {
        if (difficultAreas[i].rings.some((r) => pointInRing(lon, lat, r))) return i;
      }
      return null;
    };

    const allVans = ((vehiclesRes.data as any[]) || [])
      .filter((v) => v.status === 'in_use' || v.status === 'off_road')
      .map((v) => ({
        id: v.id as string,
        name: (v.registration || v.make || 'Van') as string,
        capacity: Number(v.bike_spaces) > 0 ? Number(v.bike_spaces) : defaultCapacity,
      }));
    if (allVans.length === 0) return json({ error: 'No vans available for planning' }, 400);

    const blocked = new Set(((unavailRes.data as any[]) || []).map((r) => `${r.van_id}:${dateKey(r.unavailable_on) ?? r.unavailable_on}`));

    const vansForDate: Record<string, typeof allVans> = {};
    for (const date of selectedDates) {
      const allowed = grid[date] ?? (flatVanIds.length > 0 ? flatVanIds : allVans.map((v) => v.id));
      vansForDate[date] = allVans.filter((v) => allowed.includes(v.id) && !blocked.has(`${v.id}:${date}`));
    }
    if (selectedDates.every((d) => vansForDate[d].length === 0)) {
      return json({ error: 'No vans are available on the days you picked' }, 400);
    }

    /* ------------------------------- orders ------------------------------- */

    const { data: orderRows, error: ordersErr } = await admin
      .from('orders')
      .select('id,tracking_number,user_id,created_at,status,sender,receiver,bikes,bike_type,bike_quantity,pickup_date,delivery_date,scheduled_pickup_date,scheduled_delivery_date,order_collected,order_delivered,needs_inspection,is_box_my_bike,ni_direction,guaranteed_delivery,guaranteed_delivery_date,bicycle_inspections(status)')
      .not('status', 'in', '(cancelled,delivered)');
    if (ordersErr) throw ordersErr;

    const businessIds = [...new Set(((orderRows as any[]) || []).map((o) => o.user_id).filter(Boolean))];
    const hoursByUser: Record<string, any> = {};
    if (businessIds.length > 0) {
      const { data: profileRows } = await admin
        .from('profiles').select('id,is_business,opening_hours').in('id', businessIds);
      for (const p of (profileRows as any[]) || []) {
        if (p.is_business && p.opening_hours) hoursByUser[p.id] = p.opening_hours;
      }
    }

    const { data: lockedRows } = await admin
      .from('route_plan_stops')
      .select('order_id,leg_type,route_plan_routes!inner(day_status,selected)')
      .in('route_plan_routes.day_status', ['locked', 'confirmed']);
    const locked = new Set(((lockedRows as any[]) || []).map((r) => `${r.order_id}:${r.leg_type}`));

    const { data: availRows } = await admin
      .from('order_leg_availability')
      .select('order_id,leg_type,availability_status,priority_boost,redate_requested_at');
    const availState: Record<string, any> = {};
    for (const r of (availRows as any[]) || []) availState[`${r.order_id}:${r.leg_type}`] = r;

    const selectedSet = new Set(selectedDates);
    const lastSelectedDate = selectedDates[selectedDates.length - 1] ?? '';
    const isWorkingDate = (d: string) => workingDays.includes(shortWeekday(d));

    const legs: Leg[] = [];
    const needsNewDates: any[] = [];
    const expiryUpserts: any[] = [];
    let nextJobId = 1;

    for (const order of ((orderRows as any[]) || [])) {
      if (order.ni_direction) continue; // NI / ferry work stays manual
      const status = String(order.status || '');
      if (status === 'cancelled' || status === 'on_hold' || status === 'pending_approval') continue;

      const spaces = orderSpaces(order, spaceMap);
      const inspectionStatus = (order.bicycle_inspections as any[] | null)?.[0]?.status ?? null;
      const inspectionDone = inspectionStatus === 'inspected' || inspectionStatus === 'repaired';
      const label = `${order.tracking_number || order.id.slice(0, 8)}`;
      const businessHours = hoursByUser[order.user_id] ?? null;

      const clean = (values: unknown) => [...new Set((Array.isArray(values) ? values : [])
        .map(dateKey).filter((d): d is string => !!d && isWorkingDate(d)))].sort();

      const pickupDates = clean(order.pickup_date);
      const deliveryDates = clean(order.delivery_date);

      const collectedDate = order.order_collected ? dateKey(order.scheduled_pickup_date) : null;
      const bookedCollection = !order.order_collected && order.scheduled_pickup_date
        ? dateKey(order.scheduled_pickup_date) : null;

      // Age counts for a little, capped, so long-waiting work isn't forgotten.
      const createdAt = dateKey(order.created_at);
      const ageBoost = createdAt ? Math.min(5, Math.floor(daysSince(createdAt) / 7)) : 0;

      // Priority decides only WHICH jobs are dropped when there isn't room.
      // Scarcity of dates and how soon the LAST date falls, never the first —
      // a job available every day for a month is not urgent.
      const buildPriority = (available: string[], guaranteed: string | null, boost: number) => {
        if (guaranteed) return 100;
        const future = available.filter((d) => d >= today);
        const R = Math.max(1, future.length);
        const dLast = future.length ? Math.max(1, daysUntil(future[future.length - 1])) : 1;
        return Math.max(1, Math.min(99, Math.round(60 / R + 40 / dLast) + boost));
      };

      const considerLeg = (
        legType: 'collection' | 'delivery',
        dates: string[],
        lat: number, lon: number,
        guaranteed: string | null,
        extra: { needsUnlock: boolean; eligible: boolean },
      ) => {
        const key = `${order.id}:${legType}`;
        if (locked.has(key) || !extra.eligible) return;
        const state = availState[key];
        const status = state?.availability_status ?? 'active';
        const boost = Math.min(20, Number(state?.priority_boost) || 0);
        const future = dates.filter((d) => d >= today);
        const expired = dates.length > 0 && future.length === 0;
        const lastDate = future.length ? future[future.length - 1] : null;
        const expiringInPlan = !!(lastDate && lastDate <= lastSelectedDate);

        const lapsed = (expired || dates.length === 0 || status !== 'active') && dates.length > 0;
        if (expired || dates.length === 0 || status !== 'active') {
          const neverDated = dates.length === 0;
          const guaranteedMissed = !!(guaranteed && guaranteed < today);
          const dateState: 'never_provided' | 'expired' | 'guaranteed_missed' =
            guaranteedMissed ? 'guaranteed_missed' : neverDated ? 'never_provided' : 'expired';
          const inDepot = legType === 'delivery' && !!order.order_collected;
          const severity = guaranteedMissed ? 1 : inDepot ? 2 : 3;
          const legWord = legType === 'delivery' ? 'delivery' : 'collection';
          needsNewDates.push({
            order_id: order.id,
            label,
            leg_type: legType,
            severity,
            date_state: dateState,
            reason: guaranteedMissed ? 'Guaranteed date missed'
              : neverDated
                ? `${inDepot ? 'Bike in depot, no' : 'No'} ${legWord} dates given yet`
              : status === 'awaiting_new_dates' ? 'Waiting on new dates from the customer'
              : inDepot ? 'Bike in depot, delivery dates expired'
              : `${legWord === 'delivery' ? 'Delivery' : 'Collection'} dates expired`,
            days_in_depot: legType === 'delivery' && collectedDate ? daysSince(collectedDate) : null,
            last_date: dates.length ? dates[dates.length - 1] : null,
            guaranteed_date: guaranteed,
            status: status === 'awaiting_new_dates' ? 'awaiting_new_dates' : 'expired',
            linked_leg_note: legType === 'collection' && deliveryDates.some((d) => d >= today)
              ? 'Delivery dates will likely lapse too — ask for both' : null,
          });
          if (dates.length > 0 && expired && status === 'active') {
            expiryUpserts.push({
              order_id: order.id, leg_type: legType,
              availability_status: 'expired', availability_expired_at: new Date().toISOString(),
            });
          }
          if (!includeExpired || dates.length === 0) return;
        }

        const windowDates = lapsed ? selectedDates.slice() : future.filter((d) => selectedSet.has(d));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        if (guaranteed) {
          if (!selectedSet.has(guaranteed)) return;
        } else if (windowDates.length === 0) return;

        const areaIdx = difficultAreaIdx(lat, lon);
        legs.push({
          key, jobId: nextJobId++, orderId: order.id, legType, lat, lon, spaces,
          allDates: dates,
          windowDates: guaranteed ? [guaranteed] : windowDates,
          guaranteedDate: guaranteed,
          priority: buildPriority(dates, guaranteed,
            boost + (lapsed ? 10 : 0) + (expiringInPlan ? 10 : 0) + ageBoost),
          lapsed,
          expiringInPlan: !lapsed && expiringInPlan,
          lastDate: lapsed ? null : lastDate,
          difficult: areaIdx !== null,
          areaIdx,
          sector: sectorOf(lat, lon),
          businessHours, label,
          needsUnlock: extra.needsUnlock,
          needsInspection: !!order.needs_inspection && !inspectionDone,
          collectedAt: collectedDate,
          scheduledCollection: bookedCollection,
        });
      };

      considerLeg(
        'collection', pickupDates,
        Number(order.sender?.address?.lat), Number(order.sender?.address?.lon),
        null,
        { needsUnlock: false, eligible: !order.order_collected && !order.scheduled_pickup_date },
      );

      const guaranteed = order.guaranteed_delivery && order.guaranteed_delivery_date
        ? dateKey(order.guaranteed_delivery_date) : null;
      const collectedBeforePlan = !!bookedCollection && bookedCollection < selectedDates[0];
      considerLeg(
        'delivery', deliveryDates,
        Number(order.receiver?.address?.lat), Number(order.receiver?.address?.lon),
        guaranteed,
        {
          needsUnlock: !order.order_collected && !collectedBeforePlan,
          eligible: !order.order_delivered && !order.scheduled_delivery_date && !order.is_box_my_bike,
        },
      );
    }

    if (expiryUpserts.length > 0) {
      await admin.from('order_leg_availability').upsert(expiryUpserts, { onConflict: 'order_id,leg_type' });
    }

    const legsById: Record<number, Leg> = {};
    for (const leg of legs) legsById[leg.jobId] = leg;

    /** A leg that must not be pushed out: guaranteed, or gone after this plan. */
    const isUrgent = (leg: Leg) =>
      !!leg.guaranteedDate || leg.lapsed || leg.expiringInPlan
      || !leg.lastDate || leg.lastDate <= lastSelectedDate;

    /* ---------------------------- solve helpers --------------------------- */

    // Distance costing is the thing that stops routes sprawling, so it is never
    // dropped silently: if Verso rejects it the run fails with a clear message.
    const postSolve = async (payload: any) => {
      const call = (bodyIn: any) => fetch(solveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VERSO_API_KEY}`, 'X-Api-Key': VERSO_API_KEY },
        body: JSON.stringify(bodyIn),
      });
      const started = Date.now();
      let resp = await call(payload);
      let detail = resp.ok ? '' : (await resp.text()).slice(0, 300);
      // Older builds reject the exploration option key only — that is safe to drop.
      if (resp.status === 400 && /option|x\b/i.test(detail) && !/per_km|cost/i.test(detail)) {
        resp = await call({ ...payload, options: { g: true } });
        detail = resp.ok ? '' : (await resp.text()).slice(0, 300);
      }
      debug.solve_calls += 1;
      debug.solve_ms += Date.now() - started;
      if (!resp.ok) {
        if (/per_km|per_distance|cost/i.test(detail)) {
          debug.distance_costing = false;
          debug.distance_costing_error = detail;
          const err = new Error(`Optimiser rejected distance costing: ${detail}`);
          (err as any).status = 502;
          throw err;
        }
        const err = new Error(`Route optimiser failed (${resp.status}): ${detail}`);
        (err as any).status = resp.status;
        throw err;
      }
      debug.distance_costing = debug.distance_costing !== false;
      return await resp.json();
    };

    /* ------------------------- day fleets (geography) --------------------- */

    interface Fleet {
      vehicles: any[];
      meta: Record<number, VanDay>;
      /** Skill sets offered on each date, used to decide what can be sent. */
      skillSets: Record<string, Set<number>[]>;
      groupsByDate: Record<string, { sectors: string[]; van: string }[]>;
      longByDate: Record<string, string[]>;
    }

    /** Vans offered on one date, shared out over the areas that hold real work. */
    const buildFleet = (opts: {
      pool: Leg[];
      dates: string[];
      skipVanDays?: Set<string>;   // "date:vanId"
      withVirtual?: boolean;
      /** Capacity/hours already used per "date:vanId" (grace pass top-ups). */
      used?: Record<string, { spaces: number; hours: number }>;
      dateOf?: (leg: Leg) => string[];
    }): Fleet => {
      const vehicles: any[] = [];
      const meta: Record<number, VanDay> = {};
      const skillSets: Record<string, Set<number>[]> = {};
      const groupsByDate: Record<string, { sectors: string[]; van: string }[]> = {};
      const longByDate: Record<string, string[]> = {};
      const datesOf = opts.dateOf ?? ((leg: Leg) => leg.windowDates);

      opts.dates.forEach((date, dayIdx) => {
        const shiftOpen = londonEpoch(date, shiftStart);
        const dayVans = (vansForDate[date] ?? []).filter((v) => !opts.skipVanDays?.has(`${date}:${v.id}`));
        skillSets[date] = [];
        groupsByDate[date] = [];
        longByDate[date] = [];
        if (dayVans.length === 0) return;

        const dayLegs = opts.pool.filter((l) => datesOf(l).includes(date));

        // Long days: ranked per difficult area, never all difficult work lumped
        // together, because one van cannot cover Cornwall and Carlisle.
        const areaStats: Record<number, { count: number; score: number; sectors: Set<number>; urgent: boolean }> = {};
        for (const leg of dayLegs) {
          if (leg.areaIdx === null) continue;
          const s = (areaStats[leg.areaIdx] ??= { count: 0, score: 0, sectors: new Set(), urgent: false });
          s.count += 1;
          s.score += leg.priority;
          if (leg.sector !== null) s.sectors.add(leg.sector);
          if (isUrgent(leg)) s.urgent = true;
        }
        const longAreas = Object.entries(areaStats)
          .map(([idx, s]) => ({ idx: Number(idx), ...s, rank: s.score + s.count * 10 }))
          .filter((a) => a.count >= LONG_DAY_MIN_JOBS || a.urgent)
          .sort((a, b) => b.rank - a.rank)
          .slice(0, Math.min(maxLongDays, dayVans.length));

        // Area groups: three neighbouring 22.5° areas, centred where the work is.
        const counts: number[] = new Array(SECTOR_COUNT).fill(0);
        for (const leg of dayLegs) if (leg.sector !== null && leg.areaIdx === null) counts[leg.sector] += 1;
        const remainingVans = dayVans.length - longAreas.length;
        const groups: number[][] = [];
        const left = counts.slice();
        while (groups.length < Math.max(0, remainingVans)) {
          let best = -1;
          let bestCount = 0;
          for (let i = 0; i < SECTOR_COUNT; i++) {
            const groupCount = neighbours(i).reduce((n, s) => n + left[s], 0);
            if (groupCount > bestCount) { bestCount = groupCount; best = i; }
          }
          if (best < 0 || bestCount < minJobsFloor) break;
          const sectors = neighbours(best);
          for (const s of sectors) left[s] = 0;
          groups.push(sectors);
        }

        let vanIdx = 0;
        const push = (van: typeof dayVans[number], role: VanRole, sectors: number[], areaIdx: number | null) => {
          const usedKey = `${date}:${van.id}`;
          const usedUp = opts.used?.[usedKey];
          const capUnits = Math.max(1, Math.round(van.capacity * 10)) - Math.round((usedUp?.spaces ?? 0) * 10);
          const capHours = (role === 'long' ? EXPEDITION_CAP_H : PRIMARY_CAP_H) - (usedUp?.hours ?? 0);
          if (capUnits <= 0 || capHours < 0.5) { vanIdx += 1; return; }
          const id = dayIdx * 10000 + vanIdx * 100 + (role === 'long' ? 2 : 1);
          const premium = role === 'long' ? EXPEDITION_PREMIUM : 1;
          const skills = new Set<number>([CENTRAL_SKILL, ...sectors.map(sectorSkill)]);
          if (areaIdx !== null) skills.add(difficultSkill(areaIdx));
          vehicles.push({
            id, profile: 'car',
            start: [DEPOT.lon, DEPOT.lat], end: [DEPOT.lon, DEPOT.lat],
            capacity: [capUnits],
            time_window: [shiftOpen, shiftOpen + Math.round(capHours * HOURS)],
            speed_factor: 0.95,
            costs: {
              fixed: Math.round(SHIFT_HOURS_CHARGED * DRIVER_PENCE_PER_HOUR * premium),
              per_hour: Math.round(DRIVER_PENCE_PER_HOUR * premium),
              per_km: PENCE_PER_KM,
            },
            skills: [...skills].sort((a, b) => a - b),
          });
          meta[id] = {
            vehicleId: id, date, vanId: van.id, vanName: van.name, capacity: van.capacity,
            expedition: role === 'long', virtual: false, role, sectors, areaIdx,
          };
          skillSets[date].push(skills);
          if (role === 'long') longByDate[date].push(`${van.name} — ${difficultAreas[areaIdx ?? 0]?.name ?? 'difficult area'}`);
          else if (role === 'group') groupsByDate[date].push({ sectors: sectors.map((s) => SECTOR_NAMES[s]), van: van.name });
          vanIdx += 1;
        };

        for (const area of longAreas) {
          const van = dayVans[vanIdx];
          if (!van) break;
          // A long day can fill up with ordinary work along its way out.
          const sectors = [...new Set([...area.sectors].flatMap(neighbours))];
          push(van, 'long', sectors, area.idx);
        }
        for (const sectors of groups) {
          const van = dayVans[vanIdx];
          if (!van) break;
          push(van, 'group', sectors, null);
        }
        // Vans with no area group of their own can roam anywhere; the reduction
        // loop takes them off the road if they end up thin.
        while (vanIdx < dayVans.length) {
          const van = dayVans[vanIdx];
          push(van, 'roam', Array.from({ length: SECTOR_COUNT }, (_, i) => i), null);
        }

        if (opts.withVirtual) {
          for (let i = 0; i < VIRTUAL_VANS_PER_DAY; i++) {
            const id = dayIdx * 10000 + (90 + i) * 100 + 1;
            const skills = new Set<number>([CENTRAL_SKILL, ...Array.from({ length: SECTOR_COUNT }, (_, s) => sectorSkill(s))]);
            vehicles.push({
              id, profile: 'car',
              start: [DEPOT.lon, DEPOT.lat], end: [DEPOT.lon, DEPOT.lat],
              capacity: [DEFAULT_CAPACITY * 10],
              time_window: [shiftOpen, shiftOpen + PRIMARY_CAP_H * HOURS],
              speed_factor: 0.95,
              costs: { fixed: Math.round(SHIFT_HOURS_CHARGED * DRIVER_PENCE_PER_HOUR), per_hour: DRIVER_PENCE_PER_HOUR, per_km: PENCE_PER_KM },
              skills: [...skills].sort((a, b) => a - b),
            });
            meta[id] = {
              vehicleId: id, date, vanId: `virtual-${i}`, vanName: `Extra van ${i + 1}`, capacity: DEFAULT_CAPACITY,
              expedition: false, virtual: true, role: 'roam', sectors: [], areaIdx: null,
            };
            skillSets[date].push(skills);
          }
        }
      });

      // Urgent work is never stranded because its area was quiet: widen the last
      // real van of that day so guaranteed and expiring jobs can still be taken.
      for (const date of opts.dates) {
        const dayVehicles = vehicles.filter((v) => meta[v.id]?.date === date && !meta[v.id]?.virtual);
        const target = dayVehicles[dayVehicles.length - 1];
        if (!target) continue;
        const widen = new Set<number>(target.skills as number[]);
        const sets = skillSets[date] ?? [];
        for (const leg of opts.pool) {
          if (!datesOf(leg).includes(date) || !isUrgent(leg)) continue;
          const need = legSkills(leg);
          if (sets.some((s) => need.every((k) => s.has(k)))) continue;
          for (const k of need) widen.add(k);
        }
        target.skills = [...widen].sort((a, b) => a - b);
        const slot = sets[dayVehicles.length - 1];
        if (slot) for (const k of widen) slot.add(k);
      }

      return { vehicles, meta, skillSets, groupsByDate, longByDate };
    };

    /** Skills a stop needs: its 22.5° area, and its difficult area when relevant. */
    function legSkills(leg: Leg): number[] {
      const out: number[] = [leg.sector === null ? CENTRAL_SKILL : sectorSkill(leg.sector)];
      if (leg.areaIdx !== null) out.push(difficultSkill(leg.areaIdx));
      return out;
    }

    /** A leg's window on one date: 13h normally, 15h in a difficult area. */
    const windowFor = (leg: Leg, date: string): [number, number] | null => {
      const shiftOpen = londonEpoch(date, shiftStart);
      const capH = leg.difficult ? EXPEDITION_CAP_H : PRIMARY_CAP_H;
      let window: [number, number] = [shiftOpen, shiftOpen + capH * HOURS];
      const day = leg.businessHours?.[weekdayKey(date)];
      if (day && day.open === false) return null;
      if (day && day.open && !day.is24h && day.start && day.end) {
        const open = londonEpoch(date, day.start);
        const close = londonEpoch(date, day.end) - SERVICE_S;
        if (close <= open) return null;
        window = [Math.max(open, shiftOpen), Math.min(close, shiftOpen + capH * HOURS)];
        if (window[1] <= window[0]) return null;
      }
      return window;
    };

    const buildJob = (leg: Leg, dates: string[]) => {
      const windows = dates
        .map((d) => windowFor(leg, d))
        .filter((w): w is [number, number] => !!w)
        .sort((a, b) => a[0] - b[0]);
      if (windows.length === 0) return null;
      const load = [Math.max(1, Math.round(leg.spaces * 10))];
      return {
        id: leg.jobId,
        location: [leg.lon, leg.lat],
        service: SERVICE_S,
        priority: leg.priority,
        time_windows: windows,
        ...(leg.legType === 'delivery' ? { delivery: load } : { pickup: load }),
        skills: legSkills(leg),
      };
    };

    const dateOfEpoch = (epoch: number): string =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(epoch * 1000));

    interface Placed { leg: Leg; date: string; vehicleId: number; arrival: number }

    const readSolution = (solution: any, meta: Record<number, VanDay>) => {
      const routes = Array.isArray(solution?.routes) ? solution.routes : [];
      const placed: Placed[] = [];
      const routeInfo: { meta: VanDay; route: any; stops: Placed[] }[] = [];
      for (const route of routes) {
        const m = meta[Number(route.vehicle)];
        if (!m) continue;
        const steps = Array.isArray(route.steps) ? route.steps : [];
        const stops: Placed[] = [];
        for (const s of steps) {
          if (s.type !== 'job' && s.type !== 'pickup' && s.type !== 'delivery') continue;
          const leg = legsById[Number(s.type === 'job' ? s.job : s.id)];
          if (!leg) continue;
          const entry = { leg, date: m.date, vehicleId: m.vehicleId, arrival: Number(s.arrival) || londonEpoch(m.date, shiftStart) };
          stops.push(entry);
          placed.push(entry);
        }
        if (stops.length > 0) routeInfo.push({ meta: m, route, stops });
      }
      return { placed, routeInfo };
    };

    /* ---------------- same-day collect-then-deliver pairs ------------------ */

    // A linked pair forces ONE van to do both ends, so it is only ever used when
    // the two ends are genuinely close together.
    const sameDayPairs: { c: Leg; d: Leg; dates: string[] }[] = (() => {
      const byOrder: Record<string, { c?: Leg; d?: Leg }> = {};
      for (const leg of legs) {
        const slot = (byOrder[leg.orderId] ??= {});
        if (leg.legType === 'collection') slot.c = leg; else slot.d = leg;
      }
      const out: { c: Leg; d: Leg; dates: string[] }[] = [];
      for (const { c, d } of Object.values(byOrder)) {
        if (!c || !d) continue;
        if (!d.needsUnlock || d.needsInspection || d.guaranteedDate) continue;
        const apart = milesBetween(c.lat, c.lon, d.lat, d.lon);
        if (apart > pairMaxMiles) continue;
        const shared = c.windowDates.filter((x) => d.windowDates.includes(x));
        if (shared.length > 0) out.push({ c, d, dates: shared });
      }
      return out;
    })();
    debug.pairs_considered = sameDayPairs.length;
    const pairByOrder: Record<string, { c: Leg; d: Leg; dates: string[] }> = {};
    for (const p of sameDayPairs) pairByOrder[p.c.orderId] = p;

    const buildShipment = (pair: { c: Leg; d: Leg; dates: string[] }, dates: string[]) => {
      const usable = pair.dates.filter((d) => dates.includes(d));
      const step = (leg: Leg) => {
        const windows = usable
          .map((d) => windowFor(leg, d))
          .filter((w): w is [number, number] => !!w)
          .sort((a, b) => a[0] - b[0]);
        if (windows.length === 0) return null;
        return { id: leg.jobId, location: [leg.lon, leg.lat], service: SERVICE_S, time_windows: windows };
      };
      const pickup = step(pair.c);
      const delivery = step(pair.d);
      if (!pickup || !delivery) return null;
      // A pair is never sent unrestricted: it carries both ends' area skills.
      const skills = [...new Set([...legSkills(pair.c), ...legSkills(pair.d)])].sort((a, b) => a - b);
      return {
        amount: [Math.max(1, Math.round(pair.c.spaces * 10))],
        priority: Math.max(pair.c.priority, pair.d.priority),
        skills,
        pickup, delivery,
      };
    };

    /* ------------------------------ solving ------------------------------- */

    const readyLegs = legs.filter((l) => l.legType === 'collection' || (!l.needsUnlock && !l.needsInspection));
    if (readyLegs.length === 0) {
      return json({
        plan_id: null, days: selectedDates.map((date) => ({
          date, vans_needed: 0, vans_available: (vansForDate[date] ?? []).length, van_names: [],
          variants: [{ variant: 'primary', routes: [], tradeoff_note: null }],
          infeasible_guaranteed: [], is_provisional: false, shortfall: null, spare_vans: (vansForDate[date] ?? []).length,
        })),
        at_risk: [], needs_new_dates: needsNewDates.sort((a, b) => a.severity - b.severity),
        vans: allVans, weekly: null, debug, skipped,
      });
    }

    // Dates a leg may not use any more (spread trimming pulls it off one day).
    const excluded: Record<string, Set<string>> = {};
    const datesFor = (leg: Leg, dates: string[], pinnedDate?: string) => {
      const base = pinnedDate ? [pinnedDate] : leg.windowDates.filter((d) => dates.includes(d));
      const off = excluded[leg.key];
      return off ? base.filter((d) => !off.has(d)) : base;
    };

    const runSolve = async (
      pool: Leg[],
      pinned: Record<string, string>,
      opts?: { withVirtual?: boolean; dates?: string[]; skip?: Set<string>; pairs?: boolean; used?: Record<string, { spaces: number; hours: number }>; dateOf?: (leg: Leg) => string[] },
    ) => {
      const dates = opts?.dates ?? selectedDates;
      const fleet = buildFleet({ pool, dates, skipVanDays: opts?.skip, withVirtual: opts?.withVirtual, used: opts?.used, dateOf: opts?.dateOf });
      if (fleet.vehicles.length === 0) return null;

      /** Can a stop be worked on this date by any van offered? */
      const feasible = (leg: Leg, date: string) => {
        const need = legSkills(leg);
        return (fleet.skillSets[date] ?? []).some((s) => need.every((k) => s.has(k)));
      };

      const poolKeys = new Set(pool.map((l) => l.key));
      const usablePairs = opts?.pairs
        ? sameDayPairs.filter((p) => poolKeys.has(p.c.key) && poolKeys.has(p.d.key) && !pinned[p.c.key] && !pinned[p.d.key])
        : [];
      const pairedKeys = new Set<string>();
      const shipments: any[] = [];
      for (const p of usablePairs) {
        const usable = p.dates.filter((d) => dates.includes(d) && feasible(p.c, d) && feasible(p.d, d));
        if (usable.length === 0) continue;
        const shipment = buildShipment({ ...p, dates: usable }, dates);
        if (!shipment) continue;
        shipments.push(shipment);
        pairedKeys.add(p.c.key);
        pairedKeys.add(p.d.key);
      }
      const quiet: string[] = [];
      const jobs = pool
        .filter((leg) => !pairedKeys.has(leg.key))
        .map((leg) => {
          const allowed = datesFor(leg, dates, pinned[leg.key]).filter((d) => feasible(leg, d));
          if (allowed.length === 0) quiet.push(leg.key);
          return buildJob(leg, allowed);
        })
        .filter((j): j is any => !!j);
      if (jobs.length === 0 && shipments.length === 0) return null;

      const payload: any = { vehicles: fleet.vehicles, jobs, options: { g: true, x: 5 } };
      if (shipments.length > 0) payload.shipments = shipments;
      const solution = await postSolve(payload);
      console.log('verso solve', {
        days: dates.length, jobs: jobs.length, shipments: shipments.length, vehicles: fleet.vehicles.length,
        routes: (solution?.routes || []).length, unassigned: (solution?.unassigned || []).length,
        cost: Number(solution?.summary?.cost) || null,
      });
      return { solution, meta: fleet.meta, fleet, jobCount: jobs.length, quiet, summary: solution?.summary ?? null };
    };

    let current: { placed: Placed[]; routeInfo: { meta: VanDay; route: any; stops: Placed[] }[] } = { placed: [], routeInfo: [] };
    let pool = readyLegs;
    let pinned: Record<string, string> = {};
    let displaced: Leg[] = [];
    let unlockable: Leg[] = [];
    let lastFleet: Fleet | null = null;
    let quietKeys: string[] = [];
    const protectedVanDays = new Set<string>();   // "date:vanId" — kept for urgent work
    const removedVanDays = new Set<string>();     // "date:vanId" — taken off the road

    /** Every route in the current answer, smallest first. */
    const routesBySize = () => [...current.routeInfo].sort((a, b) => a.stops.length - b.stops.length);

    /** Take thin van-days off the road until every route is a proper day's work. */
    const reduceFleet = async (opts: { dates?: string[]; pairs?: boolean; virtualOnly?: boolean }) => {
      const steps: any[] = [];
      for (let i = 0; i < MAX_REDUCTION_STEPS; i++) {
        if (budgetLeft() < 20_000) { skipped.push('van-reduction loop (ran out of time)'); break; }
        const candidates = routesBySize().filter((r) =>
          (opts.virtualOnly ? r.meta.virtual : !r.meta.virtual)
          && !protectedVanDays.has(`${r.meta.date}:${r.meta.vanId}`));
        const thinnest = candidates[0];
        if (!thinnest || thinnest.stops.length >= minJobsTarget) break;
        const key = `${thinnest.meta.date}:${thinnest.meta.vanId}`;
        const before = new Set(current.placed.map((p) => p.leg.key));
        const skip = new Set([...removedVanDays, key]);
        let retry;
        try {
          retry = await runSolve(pool, pinned, { dates: opts.dates, skip, pairs: opts.pairs, withVirtual: opts.virtualOnly });
        } catch (e) {
          steps.push({ van_day: key, outcome: 'solve failed', error: (e as Error).message });
          protectedVanDays.add(key);
          continue;
        }
        if (!retry) { protectedVanDays.add(key); continue; }
        const after = readSolution(retry.solution, retry.meta);
        const placedKeys = new Set(after.placed.map((p) => p.leg.key));
        const lostUrgent = [...before].filter((k) => !placedKeys.has(k))
          .map((k) => legs.find((l) => l.key === k))
          .filter((l): l is Leg => !!l && isUrgent(l));
        if (lostUrgent.length > 0) {
          protectedVanDays.add(key);
          steps.push({ van_day: key, stops: thinnest.stops.length, outcome: 'kept — urgent work would be lost', urgent: lostUrgent.map((l) => l.label).slice(0, 8) });
          continue;
        }
        removedVanDays.add(key);
        current = after;
        lastFleet = retry.fleet;
        quietKeys = retry.quiet;
        steps.push({ van_day: key, stops: thinnest.stops.length, outcome: 'van taken off the road' });
      }
      return steps;
    };

    /** Pull the most outlying stop off a sprawling route, then solve again. */
    const trimSpread = async (opts: { dates?: string[]; pairs?: boolean }) => {
      const steps: any[] = [];
      for (let i = 0; i < MAX_TRIM_STEPS; i++) {
        if (budgetLeft() < 20_000) { skipped.push('spread trimming (ran out of time)'); break; }
        const bad = current.routeInfo
          .map((r) => ({ r, limit: r.meta.expedition ? MAX_SPREAD_LONG_MI : MAX_SPREAD_MI, spread: spreadMiles(r.stops.map((s) => s.leg)) }))
          .filter((x) => x.spread > x.limit)
          .sort((a, b) => b.spread - a.spread)[0];
        if (!bad) break;
        const stops = bad.r.stops;
        const cLat = stops.reduce((n, s) => n + s.leg.lat, 0) / stops.length;
        const cLon = stops.reduce((n, s) => n + s.leg.lon, 0) / stops.length;
        const worst = stops.reduce((acc, s) => {
          const d = milesBetween(cLat, cLon, s.leg.lat, s.leg.lon);
          return d > acc.d ? { d, s } : acc;
        }, { d: -1, s: stops[0] }).s;
        (excluded[worst.leg.key] ??= new Set()).add(bad.r.meta.date);
        steps.push({ route_van: bad.r.meta.vanName, date: bad.r.meta.date, spread_mi: bad.spread, removed: worst.leg.label });
        try {
          const retry = await runSolve(pool, pinned, { dates: opts.dates, pairs: opts.pairs, skip: removedVanDays });
          if (!retry) break;
          current = readSolution(retry.solution, retry.meta);
          lastFleet = retry.fleet;
          quietKeys = retry.quiet;
        } catch { break; }
      }
      return steps;
    };

    if (mode === 'greedy') {
      /* --------------------- day-by-day (greedy) planning ------------------- */
      const placedKeys = new Set<string>();
      const collectedOn: Record<string, string> = {};
      for (let dayIdx = 0; dayIdx < selectedDates.length; dayIdx++) {
        const date = selectedDates[dayIdx];
        const candidates = legs.filter((leg) => {
          if (placedKeys.has(leg.key) || !leg.windowDates.includes(date)) return false;
          if (leg.legType === 'collection') return true;
          if (!leg.needsUnlock && !leg.needsInspection) return true;
          const collected = collectedOn[leg.orderId];
          if (!collected) {
            const pair = pairByOrder[leg.orderId];
            return !!pair && pair.dates.includes(date) && !placedKeys.has(pair.c.key);
          }
          if (leg.needsInspection && inspectionLeadDays === null) return false;
          const lead = leg.needsInspection ? Math.max(1, inspectionLeadDays ?? 1) : 1;
          return dayIdx - selectedDates.indexOf(collected) >= lead;
        });
        if (candidates.length === 0) continue;
        try {
          const day = await runSolve(candidates, {}, { dates: [date], pairs: true });
          if (!day) continue;
          const read = readSolution(day.solution, day.meta);
          // Same fleet discipline day by day: no 6-stop routes just because a
          // van was free.
          const before = current;
          current = read;
          pool = candidates;
          const steps = await reduceFleet({ dates: [date], pairs: true });
          (debug.reduction ??= []).push({ date, steps });
          const dayResult = current;
          current = {
            placed: [...before.placed, ...dayResult.placed],
            routeInfo: [...before.routeInfo, ...dayResult.routeInfo],
          };
          for (const p of dayResult.placed) {
            placedKeys.add(p.leg.key);
            if (p.leg.legType === 'collection') collectedOn[p.leg.orderId] = p.date;
          }
        } catch (e) {
          console.error('greedy day failed', date, (e as Error).message);
          skipped.push(`day-by-day plan for ${date} (${(e as Error).message})`);
        }
      }
      pool = legs;
      if (current.routeInfo.length === 0) {
        return json({ error: 'Nothing could be planned day by day for those days' }, 400);
      }
    } else {
      /* ---------------------------- main solve ---------------------------- */
      let passA;
      try {
        pool = [...readyLegs, ...sameDayPairs.map((p) => p.d).filter((d) => !readyLegs.includes(d))];
        passA = await runSolve(pool, {}, { pairs: true });
      } catch (e) {
        console.error('main solve failed', (e as Error).message);
        return json({ error: (e as Error).message, debug, skipped }, 502);
      }
      if (!passA) return json({ error: 'Nothing could be sent to the optimiser for those days' }, 400);

      current = readSolution(passA.solution, passA.meta);
      lastFleet = passA.fleet;
      quietKeys = passA.quiet;
      debug.main_summary = passA.summary;
      debug.main_jobs_sent = passA.jobCount;

      /* --------------------------- deliveries pass ------------------------ */

      const collectionDay: Record<string, string> = {};
      for (const p of current.placed) {
        if (p.leg.legType === 'collection') collectionDay[p.leg.orderId] = p.date;
      }
      const placedAlready = new Set(current.placed.map((p) => p.leg.key));

      unlockable = legs.filter((leg) => {
        if (leg.legType !== 'delivery' || !leg.needsUnlock) return false;
        if (placedAlready.has(leg.key)) return false;
        const collectedOn = collectionDay[leg.orderId] ?? leg.scheduledCollection;
        if (!collectedOn) return false;
        if (leg.needsInspection && inspectionLeadDays === null) return false;
        const lead = leg.needsInspection ? Math.max(1, inspectionLeadDays ?? 1) : 1;
        const earliest = selectedDates.filter((d) => d > collectedOn);
        const allowed = earliest.slice(Math.max(0, lead - 1));
        const dates = leg.windowDates.filter((d) => allowed.includes(d));
        if (dates.length === 0) return false;
        leg.windowDates = dates;
        return true;
      });

      if (unlockable.length > 0) {
        if (budgetLeft() < 25_000) {
          skipped.push('deliveries pass');
        } else {
          pinned = {};
          for (const p of current.placed) {
            if (p.leg.legType !== 'collection') continue;
            if (pairByOrder[p.leg.orderId]) continue;
            pinned[p.leg.key] = p.date;
          }
          pool = [...pool, ...unlockable.filter((l) => !pool.includes(l))];
          try {
            const passB = await runSolve(pool, pinned, { pairs: true, skip: removedVanDays });
            if (passB) {
              const after = readSolution(passB.solution, passB.meta);
              const placedKeys = new Set(after.placed.map((p) => p.leg.key));
              displaced = Object.keys(pinned).filter((k) => !placedKeys.has(k))
                .map((k) => legs.find((l) => l.key === k)).filter((l): l is Leg => !!l);
              if (displaced.length === 0) {
                current = after;
                lastFleet = passB.fleet;
                quietKeys = passB.quiet;
              }
            }
          } catch (e) {
            console.error('deliveries pass failed', (e as Error).message);
            skipped.push(`deliveries pass (${(e as Error).message})`);
          }
        }
      }

      /* ------------------------- van-reduction loop ----------------------- */

      debug.reduction = await reduceFleet({ pairs: true });
      debug.trimming = await trimSpread({ pairs: true });
    }

    /* ------------------------------ grace pass ----------------------------- */

    const gracePlaced = new Set<string>();
    if (budgetLeft() < 15_000) {
      skipped.push('grace pass for expiring jobs');
    } else {
      try {
        const assignedNow = new Set(current.placed.map((p) => p.leg.key));
        const collectedOnGrace: Record<string, string> = {};
        for (const p of current.placed) {
          if (p.leg.legType === 'collection') collectedOnGrace[p.leg.orderId] = p.date;
        }
        const graceDatesFor: Record<string, string[]> = {};
        const gracePool: Leg[] = [];
        for (const leg of legs) {
          if (leg.lapsed || !leg.expiringInPlan || assignedNow.has(leg.key)) continue;
          if (leg.guaranteedDate) continue;
          const maxReal = leg.windowDates[leg.windowDates.length - 1] ?? leg.lastDate;
          if (!maxReal) continue;
          let extended = [...leg.windowDates, ...selectedDates.filter((d) => d > maxReal)];
          if (leg.legType === 'delivery' && (leg.needsUnlock || leg.needsInspection)) {
            const collectedDay = collectedOnGrace[leg.orderId];
            if (!collectedDay) continue;
            if (leg.needsInspection && inspectionLeadDays === null) continue;
            const lead = leg.needsInspection ? Math.max(1, inspectionLeadDays ?? 1) : (leg.needsUnlock ? 1 : 0);
            const earliest = selectedDates.filter((d) => d > collectedDay);
            const allowed = earliest.slice(Math.max(0, lead - 1));
            extended = extended.filter((d) => allowed.includes(d));
            if (extended.length === 0) continue;
          }
          if (extended.length === leg.windowDates.length) continue;
          gracePool.push(leg);
          graceDatesFor[leg.key] = extended;
        }
        if (gracePool.length > 0) {
          // Only the room left on the vans already going out.
          const used: Record<string, { spaces: number; hours: number }> = {};
          for (const { meta: m, route, stops } of current.routeInfo) {
            const u = used[`${m.date}:${m.vanId}`] ??= { spaces: 0, hours: 0 };
            for (const s of stops) u.spaces += s.leg.spaces;
            u.hours += ((Number(route.duration) || 0) + (Number(route.service) || 0) + (Number(route.waiting_time) || 0)) / 3600;
          }
          const graceDates = [...new Set(Object.values(graceDatesFor).flat())].sort();
          const grace = await runSolve(gracePool, {}, {
            dates: graceDates, used, skip: removedVanDays,
            dateOf: (leg) => graceDatesFor[leg.key] ?? leg.windowDates,
          });
          if (grace) {
            const read = readSolution(grace.solution, grace.meta);
            if (read.placed.length > 0) {
              for (const p of read.placed) gracePlaced.add(p.leg.key);
              current = {
                placed: [...current.placed, ...read.placed],
                routeInfo: [...current.routeInfo, ...read.routeInfo],
              };
            }
          }
        }
      } catch (e) {
        console.error('grace pass failed', (e as Error).message);
        skipped.push(`grace pass (${(e as Error).message})`);
      }
    }

    /* ------------------- extra-van what-if (separate call) ---------------- */

    if (shortfallOnly) {
      const realByDate: Record<string, number> = {};
      for (const { meta, stops } of current.routeInfo) {
        realByDate[meta.date] = (realByDate[meta.date] ?? 0) + stops.length;
      }
      const shortfallByDate: Record<string, { extra_vans: number; extra_jobs: number; urgent: number } | null> = {};
      let placedByDate: Record<string, number> = {};
      let virtualByDate: Record<string, number> = {};
      let urgentByDate: Record<string, number> = {};
      try {
        const wi = mode === 'greedy' ? null : await runSolve(pool, pinned, { withVirtual: true, pairs: true, skip: removedVanDays });
        if (wi) {
          const read = readSolution(wi.solution, wi.meta);
          for (const { meta, stops } of read.routeInfo) {
            placedByDate[meta.date] = (placedByDate[meta.date] ?? 0) + stops.length;
            if (!meta.virtual) continue;
            const urgent = stops.filter((s) => isUrgent(s.leg)).length;
            // An imaginary van only counts as a real shortfall if it would carry
            // a proper day's work, or work that would otherwise be lost.
            if (stops.length < minJobsFloor && urgent === 0) continue;
            virtualByDate[meta.date] = (virtualByDate[meta.date] ?? 0) + 1;
            urgentByDate[meta.date] = (urgentByDate[meta.date] ?? 0) + urgent;
          }
        }
      } catch (e) {
        console.error('what-if solve failed', (e as Error).message);
      }
      for (const date of selectedDates) {
        const extraVans = virtualByDate[date] ?? 0;
        shortfallByDate[date] = extraVans > 0 ? {
          extra_vans: extraVans,
          extra_jobs: Math.max(0, (placedByDate[date] ?? 0) - (realByDate[date] ?? 0)),
          urgent: urgentByDate[date] ?? 0,
        } : null;
      }
      return json({ mode, shortfall_by_date: shortfallByDate });
    }

    /* ------------------------------ persist ------------------------------- */

    await admin.from('route_plans').update({ status: 'superseded' }).eq('status', 'active').eq('mode', mode);

    const assigned = new Set<string>();
    const routesByDate: Record<string, any[]> = {};

    const prepared = current.routeInfo.map(({ meta, route, stops }) => {
      const dayIdx = selectedDates.indexOf(meta.date);
      const isProvisional = dayIdx >= firmDays;
      let ordered = [...stops].sort((a, b) => a.arrival - b.arrival);
      const steps = Array.isArray(route.steps) ? route.steps : [];
      const maxLoadUnits = Math.max(0, ...steps.map((s: any) => Number(s?.load?.[0]) || 0));
      const duration = (Number(route.duration) || 0) + (Number(route.service) || 0) + (Number(route.waiting_time) || 0);
      // Safety net only — trimming above should have dealt with sprawl already.
      const limit = meta.expedition ? MAX_SPREAD_LONG_MI : MAX_SPREAD_MI;
      let hardTrimmed = 0;
      while (ordered.length > 1 && spreadMiles(ordered.map((s) => s.leg)) > limit) {
        const cLat = ordered.reduce((n, s) => n + s.leg.lat, 0) / ordered.length;
        const cLon = ordered.reduce((n, s) => n + s.leg.lon, 0) / ordered.length;
        let worstIdx = 0;
        let worst = -1;
        ordered.forEach((s, i) => {
          const d = milesBetween(cLat, cLon, s.leg.lat, s.leg.lon);
          if (d > worst) { worst = d; worstIdx = i; }
        });
        ordered = ordered.filter((_, i) => i !== worstIdx);
        hardTrimmed += 1;
      }
      const tally: Record<string, number> = {};
      for (const s of ordered) {
        const k = sectorLabel(s.leg.sector);
        tally[k] = (tally[k] ?? 0) + 1;
      }
      const topRegion = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Around the depot';
      const urgentLabels = ordered.filter((s) => isUrgent(s.leg)).map((s) => s.leg.label);
      return {
        meta, ordered, isProvisional, duration, hardTrimmed,
        longDay: meta.expedition && duration > PRIMARY_CAP_H * HOURS,
        miles: Math.round(((Number(route.distance) || 0) / 1609.344) * 10) / 10,
        maxLoad: Math.round((maxLoadUnits / 10) * 100) / 100,
        geometry: typeof route.geometry === 'string' ? route.geometry : null,
        region: meta.areaIdx !== null ? difficultAreas[meta.areaIdx]?.name ?? topRegion : topRegion,
        spreadMi: spreadMiles(ordered.map((s) => s.leg)),
        thin: ordered.length < minJobsTarget,
        belowFloor: ordered.length < minJobsFloor,
        urgentLabels: urgentLabels.slice(0, 10),
      };
    });

    const { data: planRow, error: planErr } = await admin.from('route_plans').insert({
      horizon_start: selectedDates[0],
      horizon_end: selectedDates[selectedDates.length - 1],
      selected_dates: selectedDates,
      shift_start: shiftStart,
      firm_days: firmDays,
      inspection_lead_days: inspectionLeadDays,
      created_by: userData.user.id,
      status: 'active',
      mode,
      generated_at: new Date().toISOString(),
    }).select('id').single();
    if (planErr) throw planErr;
    const planId = planRow.id as string;

    if (prepared.length > 0) {
      const { data: routeRows, error: routeErr } = await admin.from('route_plan_routes').insert(
        prepared.map((p) => ({
          plan_id: planId,
          route_date: p.meta.date,
          variant: 'primary',
          pass: unlockable.length > 0 ? 'B' : 'A',
          day_status: 'draft',
          is_provisional: p.isProvisional,
          van_id: p.meta.vanId,
          van_name: p.meta.vanName,
          is_expedition: p.longDay,
          total_miles: p.miles,
          total_duration_s: p.duration,
          stop_count: p.ordered.length,
          max_load: p.maxLoad,
          van_capacity: p.meta.capacity,
          geometry: p.geometry,
        })),
      ).select('id');
      if (routeErr) throw routeErr;

      const stopRows: any[] = [];
      prepared.forEach((p, idx) => {
        const routeId = (routeRows as any[])[idx]?.id;
        p.ordered.forEach((s, i) => {
          stopRows.push({
            route_id: routeId, seq: i + 1, leg_type: s.leg.legType, order_id: s.leg.orderId,
            eta: isoFromEpoch(s.arrival), service_s: SERVICE_S, lat: s.leg.lat, lon: s.leg.lon,
            is_difficult_area: s.leg.difficult,
          });
          assigned.add(s.leg.key);
        });

        (routesByDate[p.meta.date] ??= []).push({
          route_id: routeId,
          van_id: p.meta.vanId,
          van_name: p.meta.vanName,
          is_expedition: p.longDay,
          is_provisional: p.isProvisional,
          stop_count: p.ordered.length,
          duration_s: p.duration,
          miles: p.miles,
          max_load: p.maxLoad,
          van_capacity: p.meta.capacity,
          geometry: p.geometry,
          region: p.region,
          spread_mi: p.spreadMi,
          thin: p.thin,
          below_floor: p.belowFloor,
          thin_reason: p.thin
            ? (p.urgentLabels.length > 0 ? 'Thin — needed for urgent jobs' : 'Thin — no more work fitted this area')
            : null,
          urgent_labels: p.urgentLabels,
          guaranteed_count: p.ordered.filter((s) => !!s.leg.guaranteedDate).length,
          stops: p.ordered.map((s, i) => ({
            seq: i + 1, leg_type: s.leg.legType, order_id: s.leg.orderId,
            eta: isoFromEpoch(s.arrival), lat: s.leg.lat, lon: s.leg.lon,
            is_difficult_area: s.leg.difficult, label: s.leg.label, guaranteed: !!s.leg.guaranteedDate,
            planned_after_expiry: gracePlaced.has(s.leg.key),
          })),
        });
      });

      if (stopRows.length > 0) {
        const { error: stopsErr } = await admin.from('route_plan_stops').insert(stopRows);
        if (stopsErr) throw stopsErr;
      }
    }

    /* ------------------------------ response ------------------------------ */

    const quietSet = new Set(quietKeys);
    const days = selectedDates.map((date, idx) => {
      const dayRoutes = routesByDate[date] ?? [];
      const usedVans = new Set(dayRoutes.map((r) => r.van_id));
      const available = (vansForDate[date] ?? []).length;
      return {
        date,
        vans_needed: usedVans.size,
        vans_available: available,
        van_names: [...usedVans].map((id) => (vansForDate[date] ?? []).find((v) => v.id === id)?.name).filter(Boolean),
        spare_vans: Math.max(0, available - usedVans.size),
        is_provisional: idx >= firmDays,
        shortfall: null,
        variants: [{ variant: 'primary', routes: dayRoutes, tradeoff_note: null }],
        unplanned_count: legs.filter((l) => !assigned.has(l.key) && !l.lapsed && l.windowDates.includes(date)).length,
        unplanned_lapsed_count: legs.filter((l) => !assigned.has(l.key) && l.lapsed && l.windowDates.includes(date)).length,
        lapsed_count: current.routeInfo.flatMap((r) => r.stops).filter((s) => s.date === date && s.leg.lapsed).length,
        expiring_count: legs.filter((l) => !l.lapsed && l.lastDate === date).length,
        expiring_unplanned_count: legs.filter((l) => !l.lapsed && l.lastDate === date && !assigned.has(l.key)).length,
        long_days: dayRoutes.filter((r) => r.is_expedition).length,
        areas: lastFleet?.groupsByDate?.[date] ?? [],
        infeasible_guaranteed: legs
          .filter((l) => l.guaranteedDate === date && !assigned.has(l.key))
          .map((l) => ({ order_id: l.orderId, label: l.label, leg_type: l.legType, date })),
      };
    });

    const atRisk = legs
      .filter((l) => !assigned.has(l.key))
      .sort((a, b) => b.priority - a.priority)
      .map((l) => ({
        order_id: l.orderId,
        label: l.label,
        leg_type: l.legType,
        priority: l.priority,
        remaining_dates: l.allDates.filter((d) => d >= today).length,
        last_date: l.lapsed ? (l.allDates[l.allDates.length - 1] ?? null) : l.lastDate,
        guaranteed_date: l.guaranteedDate,
        reason: quietSet.has(l.key) ? 'Area too quiet this week — no viable route'
          : l.lapsed ? 'dates had expired — planned via the expired-jobs override'
          : l.expiringInPlan ? 'its last available date was full and there was no room later in the plan'
          : displaced.some((d) => d?.key === l.key) ? 'pushed out when deliveries were added'
          : l.guaranteedDate ? 'guaranteed date could not be met'
          : l.needsUnlock ? 'waiting on its collection being planned'
          : 'no feasible slot on the days you picked',
      }));

    const vanDaysAvailable = selectedDates.reduce((n, d) => n + (vansForDate[d] ?? []).length, 0);
    const vanDaysNeeded = days.reduce((n, d) => n + d.vans_needed, 0);

    const jobsPerRoute = prepared.map((p) => p.ordered.length).sort((a, b) => a - b);
    debug.jobs_per_route = jobsPerRoute;
    debug.median_jobs_per_route = jobsPerRoute.length
      ? jobsPerRoute[Math.floor(jobsPerRoute.length / 2)] : 0;
    debug.vans_offered = Object.fromEntries(selectedDates.map((d) => [d, (vansForDate[d] ?? []).length]));
    debug.vans_used = Object.fromEntries(days.map((d) => [d.date, d.vans_needed]));
    debug.van_days_removed = [...removedVanDays];
    debug.van_days_protected = [...protectedVanDays];
    debug.long_days = Object.fromEntries(selectedDates.map((d) => [d, lastFleet?.longByDate?.[d] ?? []]));
    debug.area_groups = lastFleet?.groupsByDate ?? {};
    debug.hard_trimmed_stops = prepared.reduce((n, p) => n + p.hardTrimmed, 0);
    debug.quiet_area_jobs = quietKeys.length;
    debug.settings = { min_jobs_target: minJobsTarget, min_jobs_floor: minJobsFloor, max_long_days: maxLongDays, pair_max_distance_miles: pairMaxMiles, shift_hours: PRIMARY_CAP_H };
    debug.skipped = skipped;

    await admin.from('route_plans').update({
      shortfall: { van_days_available: vanDaysAvailable, van_days_needed: vanDaysNeeded, short_days: [] },
      debug,
    }).eq('id', planId);

    return json({
      plan_id: planId,
      mode,
      unplanned_count: legs.filter((l) => !assigned.has(l.key) && !l.lapsed).length,
      unplanned_lapsed_count: legs.filter((l) => !assigned.has(l.key) && l.lapsed).length,
      expiring_in_plan_count: legs.filter((l) => l.expiringInPlan).length,
      expiring_unplanned_count: legs.filter((l) => l.expiringInPlan && !assigned.has(l.key)).length,
      generated_at: new Date().toISOString(),
      firm_days: firmDays,
      shortfall_pending: mode !== 'greedy',
      distance_costing: debug.distance_costing !== false,
      skipped,
      debug,
      days,
      at_risk: atRisk,
      needs_new_dates: needsNewDates.sort((a, b) => a.severity - b.severity),
      vans: allVans,
      weekly: { van_days_available: vanDaysAvailable, van_days_needed: vanDaysNeeded, short_days: [] },
    });
  } catch (e) {
    console.error('route-optimize error', (e as Error)?.message);
    return json({ error: (e as Error)?.message ?? 'unexpected error', debug, skipped }, 500);
  }
});
