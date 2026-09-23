// Generates van routes one day at a time using the Verso hosted VROOM API.
// Server-side only: Verso credentials never leave here.
//
// The idea, kept deliberately simple (see docs/ROUTE_PLANNING.md):
//  - our code decides which day is planned, which jobs may go, and how many vans;
//  - VROOM decides which van takes which job and in what order;
//  - only two priorities exist: must-go (100) and everything else (0);
//  - one day at a time, in date order, carrying planned collections forward.
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
const NORMAL_CAP_H = 13;   // depot to depot, including the return leg
const LONG_CAP_H = 15;     // difficult-area long day
const DEFAULT_CAPACITY = 10;
const STAFF_ROLES = ['admin', 'sales', 'route_planner'];
const MAX_DAYS = 10;
const TIME_BUDGET_MS = 90_000;
const DRIVER_PENCE_PER_HOUR = 1100;   // £11/hour
const PENCE_PER_KM = 28;              // £0.45/mile
const DRIVER_RATE = 11;
const COST_PER_MILE = 0.45;
const DEFAULT_MAX_LONG_VANS = 1;
// Rough jobs-per-van figure, used only to guess how many vans London needs.
const LONDON_JOBS_PER_VAN = 13;
const MAX_REMOVALS_PER_DAY = 6;
const LONG_DAY_MIN_JOBS = 5;
const SPREAD_WARN_MI = 150;
const LONDON_MAX_VANS = 2;      // London work is fenced to at most this many vans
const CORRIDOR_MI = 12;         // how far off the depot->London line an "on the way" job may sit
const DIFFICULT_SKILL = 1;      // London-only work
const GENERAL_SKILL = 2;        // ordinary work (London vans do not carry this)

const milesBetween = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const R = 3958.8;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Widest gap between any two stops on a route, in miles — a warning only. */
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

const daysSince = (dateStr: string): number => {
  const diff = (Date.parse(`${todayLondon()}T12:00:00Z`) - Date.parse(`${dateStr}T12:00:00Z`)) / 86_400_000;
  return Math.max(0, Math.round(diff));
};

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const SHORT_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const weekdayIdx = (dateStr: string) => (new Date(`${dateStr}T12:00:00Z`).getUTCDay() + 6) % 7;
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

/* --------------------------- spaces and money ----------------------------- */

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

// Charged price per bike type, excluding VAT, mirroring src/constants/bikePricing.ts.
const BIKE_PRICES: Record<string, number> = {
  'boxed kids bikes': 35, 'wheelset/frameset': 35, 'wheels/frame boxed or unboxed': 35,
  'kids bikes': 40, 'bmx bikes': 40, 'bike rack': 40, 'turbo trainer': 40, 'folding bikes': 40,
  'travel bike box': 50, 'travel bike boxes': 50,
  'non-electric bikes': 60, 'non-electric - mountain bike': 60, 'non-electric - road bike': 60,
  'non-electric - hybrid': 60, 'non-electric - hybrid bike': 60, 'non-electric - gravel bike': 60,
  'electric bike - under 25kg': 70, 'electric bikes under 25kg': 70,
  'stationary bike': 70, 'stationary bikes': 70,
  'electric bike - over 25kg': 99, 'electric bikes over 25kg': 99, 'electric bike - over 50kg': 99,
  'tandem': 110, 'tandem bikes': 110,
  'longtail cargo bike': 130, 'longtail cargo bikes': 130, 'recumbent': 130,
  'small trike': 150, 'trike': 150, 'large trike': 180,
  'cargo bike': 225, 'double seat/platform/cargo trikes': 225,
};

const priceForType = (bikeType: string | null | undefined): number => {
  if (!bikeType) return 60;
  const lower = norm(bikeType);
  if (BIKE_PRICES[lower] !== undefined) return BIKE_PRICES[lower];
  if (lower.startsWith('non-electric')) return 60;
  if (lower.startsWith('electric')) return 70;
  return 60;
};

/** What one leg of an order is worth: half the charged price, excluding VAT. */
const legValue = (order: any, specialRate: number | null): number => {
  if (specialRate !== null) {
    const qty = Number(order?.bike_quantity) > 0 ? Number(order.bike_quantity) : 1;
    return (specialRate / 2) * qty;
  }
  const bikes = Array.isArray(order?.bikes) ? order.bikes : null;
  if (bikes && bikes.length > 0) {
    return bikes.reduce((sum: number, bike: any) => {
      const type = bike?.bike_type ?? bike?.type ?? bike?.bikeType ?? order?.bike_type;
      const qty = Number(bike?.quantity ?? 1) || 1;
      return sum + (priceForType(type) / 2) * qty;
    }, 0);
  }
  const qty = Number(order?.bike_quantity) > 0 ? Number(order.bike_quantity) : 1;
  return (priceForType(order?.bike_type) / 2) * qty;
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
  value: number;
  allDates: string[];
  futureDates: string[];
  guaranteedDate: string | null;
  lapsed: boolean;
  lastDate: string | null;
  /** Days since the order was booked. */
  ageDays: number;
  /** Days the bike has been sitting in the depot (deliveries only). */
  depotDays: number;
  areaIdx: number | null;
  businessHours: Record<string, any> | null;
  label: string;
  needsInspection: boolean;
  inDepot: boolean;
  bookedCollection: string | null;
}

interface VanDay {
  vehicleId: number; date: string; vanId: string; vanName: string; capacity: number;
  long: boolean; spare: boolean; areaName: string | null;
}

interface Stop { leg: Leg; arrival: number }
interface SolvedRoute { meta: VanDay; route: any; stops: Stop[] }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const runStarted = Date.now();
  const budgetLeft = () => TIME_BUDGET_MS - (Date.now() - runStarted);
  const skipped: string[] = [];
  const debug: Record<string, any> = { solve_calls: 0, solve_ms: 0, days: {} };

  try {
    const VERSO_API_URL = Deno.env.get('VERSO_API_URL');
    const VERSO_API_KEY = Deno.env.get('VERSO_API_KEY');
    if (!VERSO_API_URL || !VERSO_API_KEY) return json({ error: 'Verso credentials not configured' }, 500);

    const solveUrl = (() => {
      const raw = VERSO_API_URL.trim().replace(/\/(?=\?|$)/, '');
      let url: URL;
      try { url = new URL(raw); } catch { return raw; }
      url.pathname = `${url.pathname.replace(/\/(solve|plan)$/i, '').replace(/\/$/, '')}/solve`;
      if (url.searchParams.has('api_key') && !url.searchParams.get('api_key')) {
        url.searchParams.set('api_key', VERSO_API_KEY);
      }
      return url.toString();
    })();

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
    const includeExpired = body?.include_expired === true;
    const maxLongVans = Number.isFinite(Number(body?.max_long_days))
      ? Math.max(0, Math.min(1, Math.round(Number(body.max_long_days)))) : DEFAULT_MAX_LONG_VANS;
    const minMargin = Number.isFinite(Number(body?.min_route_margin))
      ? Math.max(0, Number(body.min_route_margin)) : 0;

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
      admin.from('workshop_settings').select('van_spaces_capacity,working_days').eq('id', 1).maybeSingle(),
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

    const blocked = new Set(((unavailRes.data as any[]) || [])
      .map((r) => `${r.van_id}:${dateKey(r.unavailable_on) ?? r.unavailable_on}`));

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

    const userIds = [...new Set(((orderRows as any[]) || []).map((o) => o.user_id).filter(Boolean))];
    const hoursByUser: Record<string, any> = {};
    const rateByUser: Record<string, number | null> = {};
    if (userIds.length > 0) {
      const { data: profileRows } = await admin
        .from('profiles').select('id,is_business,opening_hours,special_rate_price').in('id', userIds);
      for (const p of (profileRows as any[]) || []) {
        if (p.is_business && p.opening_hours) hoursByUser[p.id] = p.opening_hours;
        rateByUser[p.id] = Number(p.special_rate_price) > 0 ? Number(p.special_rate_price) : null;
      }
    }

    const { data: lockedRows } = await admin
      .from('route_plan_stops')
      .select('order_id,leg_type,route_plan_routes!inner(day_status,route_date)')
      .in('route_plan_routes.day_status', ['locked', 'confirmed']);
    const locked = new Set(((lockedRows as any[]) || []).map((r) => `${r.order_id}:${r.leg_type}`));
    // A bike collected on a locked day is in the depot from the next day onwards.
    const lockedCollectionDate: Record<string, string> = {};
    for (const r of ((lockedRows as any[]) || [])) {
      if (r.leg_type !== 'collection') continue;
      const d = dateKey(r.route_plan_routes?.route_date);
      if (d) lockedCollectionDate[r.order_id] = d;
    }

    const { data: availRows } = await admin
      .from('order_leg_availability')
      .select('order_id,leg_type,availability_status');
    const availState: Record<string, any> = {};
    for (const r of (availRows as any[]) || []) availState[`${r.order_id}:${r.leg_type}`] = r;

    const lastSelectedDate = selectedDates[selectedDates.length - 1];
    const isWorkingDate = (d: string) => workingDays.includes(shortWeekday(d));

    const legs: Leg[] = [];
    const needsNewDates: any[] = [];
    const expiryUpserts: any[] = [];
    let nextJobId = 1;

    for (const order of ((orderRows as any[]) || [])) {
      if (order.ni_direction) continue;                  // NI / ferry work stays manual
      const status = String(order.status || '');
      if (status === 'cancelled' || status === 'on_hold' || status === 'pending_approval') continue;

      const spaces = orderSpaces(order, spaceMap);
      const value = legValue(order, rateByUser[order.user_id] ?? null);
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
        ? dateKey(order.scheduled_pickup_date)
        : (!order.order_collected ? lockedCollectionDate[order.id] ?? null : null);

      const considerLeg = (
        legType: 'collection' | 'delivery',
        dates: string[],
        lat: number, lon: number,
        guaranteed: string | null,
        eligible: boolean,
      ) => {
        const key = `${order.id}:${legType}`;
        if (locked.has(key) || !eligible) return;
        const state = availState[key];
        const legStatus = state?.availability_status ?? 'active';
        const future = dates.filter((d) => d >= today);
        const expired = dates.length > 0 && future.length === 0;
        const lapsed = (expired || dates.length === 0 || legStatus !== 'active') && dates.length > 0;

        if (expired || dates.length === 0 || legStatus !== 'active') {
          const neverDated = dates.length === 0;
          const guaranteedMissed = !!(guaranteed && guaranteed < today);
          const inDepot = legType === 'delivery' && !!order.order_collected;
          const legWord = legType === 'delivery' ? 'delivery' : 'collection';
          needsNewDates.push({
            order_id: order.id, label, leg_type: legType,
            severity: guaranteedMissed ? 1 : inDepot ? 2 : 3,
            date_state: guaranteedMissed ? 'guaranteed_missed' : neverDated ? 'never_provided' : 'expired',
            reason: guaranteedMissed ? 'Guaranteed date missed'
              : neverDated ? `${inDepot ? 'Bike in depot, no' : 'No'} ${legWord} dates given yet`
              : legStatus === 'awaiting_new_dates' ? 'Waiting on new dates from the customer'
              : inDepot ? 'Bike in depot, delivery dates expired'
              : `${legWord === 'delivery' ? 'Delivery' : 'Collection'} dates expired`,
            days_in_depot: legType === 'delivery' && collectedDate ? daysSince(collectedDate) : null,
            last_date: dates.length ? dates[dates.length - 1] : null,
            guaranteed_date: guaranteed,
            status: legStatus === 'awaiting_new_dates' ? 'awaiting_new_dates' : 'expired',
            linked_leg_note: legType === 'collection' && deliveryDates.some((d) => d >= today)
              ? 'Delivery dates will likely lapse too — ask for both' : null,
          });
          if (dates.length > 0 && expired && legStatus === 'active') {
            expiryUpserts.push({
              order_id: order.id, leg_type: legType,
              availability_status: 'expired', availability_expired_at: new Date().toISOString(),
            });
          }
          if (!includeExpired || dates.length === 0) return;
        }

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        if (guaranteed && !selectedDates.includes(guaranteed)) return;
        if (!lapsed && !guaranteed && !future.some((d) => selectedDates.includes(d))) return;

        legs.push({
          key, jobId: nextJobId++, orderId: order.id, legType, lat, lon, spaces, value,
          allDates: dates,
          futureDates: guaranteed ? [guaranteed] : future,
          guaranteedDate: guaranteed,
          lapsed,
          lastDate: future.length ? future[future.length - 1] : null,
          ageDays: (() => { const d = dateKey(order.created_at); return d ? daysSince(d) : 0; })(),
          depotDays: legType === 'delivery' && collectedDate ? daysSince(collectedDate) : 0,
          areaIdx: difficultAreaIdx(lat, lon),
          businessHours, label,
          needsInspection: !!order.needs_inspection && !inspectionDone,
          inDepot: legType === 'delivery' ? !!order.order_collected : false,
          bookedCollection,
        });
      };

      considerLeg(
        'collection', pickupDates,
        Number(order.sender?.address?.lat), Number(order.sender?.address?.lon),
        null,
        !order.order_collected && !order.scheduled_pickup_date,
      );

      const guaranteed = order.guaranteed_delivery && order.guaranteed_delivery_date
        ? dateKey(order.guaranteed_delivery_date) : null;
      considerLeg(
        'delivery', deliveryDates,
        Number(order.receiver?.address?.lat), Number(order.receiver?.address?.lon),
        guaranteed,
        !order.order_delivered && !order.scheduled_delivery_date && !order.is_box_my_bike,
      );
    }

    if (expiryUpserts.length > 0) {
      await admin.from('order_leg_availability').upsert(expiryUpserts, { onConflict: 'order_id,leg_type' });
    }

    const legsById: Record<number, Leg> = {};
    for (const leg of legs) legsById[leg.jobId] = leg;

    /** Work that has to go out today: guaranteed, last date, or expired override. */
    const mustGo = (leg: Leg, date: string) =>
      leg.guaranteedDate === date
      || leg.lastDate === date
      || (leg.lapsed && includeExpired);

    /**
     * How hard the optimiser should try to fit a job (VROOM priority, 0-100).
     *
     * Must-go work sits at the top. Everything else is ranked by how few dates
     * the customer has left (the stronger signal) and then by how long the job
     * has been waiting — an older job beats a fresher one all else being equal.
     */
    const legPriority = (leg: Leg, date: string) => {
      if (mustGo(leg, date)) return 100;
      const left = Math.max(1, leg.futureDates.filter((d) => d >= date).length);
      // 1 date left -> 40, 2 -> 20, 3 -> 13, 4 -> 10, tailing off after that.
      const scarcity = Math.round(40 / left);
      const waiting = Math.max(leg.ageDays, leg.depotDays);
      const age = Math.min(20, Math.round(waiting / 1.5));
      return Math.max(1, Math.min(99, 30 + scarcity + age));
    };

    /** A job that must not be lost inside this plan at all. */
    const urgentInPlan = (leg: Leg) =>
      !!leg.guaranteedDate || (leg.lapsed && includeExpired)
      || (!!leg.lastDate && leg.lastDate <= lastSelectedDate);

    /* ------------------------------ solving ------------------------------- */

    /** Deeper search is used unless the optimiser rejects the option. */
    let exploreOk = true;

    const postSolve = async (payload: any) => {
      const call = (bodyIn: any) => fetch(solveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VERSO_API_KEY}`, 'X-Api-Key': VERSO_API_KEY },
        body: JSON.stringify(bodyIn),
      });
      const started = Date.now();
      let resp = await call(payload);
      let detail = resp.ok ? '' : (await resp.text()).slice(0, 300);
      debug.solve_calls += 1;
      debug.solve_ms += Date.now() - started;
      if (!resp.ok) {
        // Distance costing is what keeps routes tight: never dropped quietly.
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

    /** A leg's single window on one day: whole shift, or the business's hours. */
    const windowFor = (leg: Leg, date: string, capH: number): [number, number] | null => {
      const shiftOpen = londonEpoch(date, shiftStart);
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

    /* ------------------------- London containment ------------------------- */

    const londonAreaIdx = difficultAreas.findIndex((a) => /london/i.test(a.name));
    const hasLondonArea = londonAreaIdx >= 0;
    const isLondonLeg = (leg: Leg) => hasLondonArea && leg.areaIdx === londonAreaIdx;

    /** Middle of the drawn London area, used as the far end of the corridor. */
    const londonCentroid = (() => {
      if (!hasLondonArea) return null;
      let lat = 0, lon = 0, n = 0;
      for (const ring of difficultAreas[londonAreaIdx].rings) {
        for (const pt of ring) {
          if (!Array.isArray(pt) || pt.length < 2) continue;
          lon += Number(pt[0]); lat += Number(pt[1]); n++;
        }
      }
      return n > 0 ? { lat: lat / n, lon: lon / n } : null;
    })();

    /**
     * True when a non-London job genuinely sits on the way to London: within
     * CORRIDOR_MI of the depot->London line, and between the depot and London
     * rather than beyond it.
     */
    const isCorridorLeg = (leg: Leg) => {
      if (!londonCentroid || isLondonLeg(leg)) return false;
      const ax = DEPOT.lon, ay = DEPOT.lat;
      const bx = londonCentroid.lon, by = londonCentroid.lat;
      const vx = bx - ax, vy = by - ay;
      const len2 = vx * vx + vy * vy;
      if (len2 === 0) return false;
      const t = ((leg.lon - ax) * vx + (leg.lat - ay) * vy) / len2;
      if (t < 0.05 || t > 1) return false;
      const px = ax + t * vx, py = ay + t * vy;
      return milesBetween(leg.lat, leg.lon, py, px) <= CORRIDOR_MI;
    };

    const buildJob = (leg: Leg, date: string, capH: number) => {
      const window = windowFor(leg, date, capH);
      if (!window) return null;
      const load = [Math.max(1, Math.round(leg.spaces * 10))];
      // London legs: London vans only. Corridor legs: any van. Everything else:
      // ordinary vans only, so the London van cannot wander off its corridor.
      const skills = isLondonLeg(leg)
        ? [DIFFICULT_SKILL]
        : isCorridorLeg(leg) ? null : [GENERAL_SKILL];
      return {
        id: leg.jobId,
        location: [leg.lon, leg.lat],
        service: SERVICE_S,
        priority: legPriority(leg, date),
        time_windows: [window],
        ...(leg.legType === 'delivery' ? { delivery: load } : { pickup: load }),
        ...(skills ? { skills } : {}),
      };
    };

    const buildVehicle = (
      van: { id: string; name: string; capacity: number },
      date: string, idx: number,
      kind: { long: boolean; spare?: boolean; areaName?: string | null; london?: boolean },
    ) => {
      const shiftOpen = londonEpoch(date, shiftStart);
      const capH = kind.long ? LONG_CAP_H : NORMAL_CAP_H;
      const id = selectedDates.indexOf(date) * 1000 + idx + 1;
      const vehicle: any = {
        id, profile: 'car',
        start: [DEPOT.lon, DEPOT.lat], end: [DEPOT.lon, DEPOT.lat],
        capacity: [Math.max(1, Math.round(van.capacity * 10))],
        time_window: [shiftOpen, shiftOpen + capH * HOURS],
        speed_factor: 0.95,
        costs: { per_hour: DRIVER_PENCE_PER_HOUR, per_km: PENCE_PER_KM },
        // London vans carry only the London skill, so they can serve London work
        // and unskilled corridor work — never ordinary jobs elsewhere.
        skills: kind.london ? [DIFFICULT_SKILL] : [GENERAL_SKILL],
      };
      const meta: VanDay = {
        vehicleId: id, date, vanId: van.id, vanName: van.name, capacity: van.capacity,
        long: kind.long, spare: !!kind.spare, areaName: kind.areaName ?? null,
      };
      return { vehicle, meta };
    };

    const readSolution = (solution: any, meta: Record<number, VanDay>): SolvedRoute[] => {
      const out: SolvedRoute[] = [];
      for (const route of (Array.isArray(solution?.routes) ? solution.routes : [])) {
        const m = meta[Number(route.vehicle)];
        if (!m) continue;
        const stops: Stop[] = [];
        for (const s of (Array.isArray(route.steps) ? route.steps : [])) {
          if (s.type !== 'job') continue;
          const leg = legsById[Number(s.job)];
          if (!leg) continue;
          stops.push({ leg, arrival: Number(s.arrival) || londonEpoch(m.date, shiftStart) });
        }
        if (stops.length > 0) out.push({ meta: m, route, stops });
      }
      return out;
    };

    const routeDuration = (route: any) =>
      (Number(route.duration) || 0) + (Number(route.service) || 0) + (Number(route.waiting_time) || 0);

    const routeMiles = (route: any) => Math.round(((Number(route.distance) || 0) / 1609.344) * 10) / 10;

    const money = (r: SolvedRoute) => {
      const revenue = r.stops.reduce((n, s) => n + s.leg.value, 0);
      const miles = routeMiles(r.route);
      const hours = routeDuration(r.route) / 3600;
      const cost = hours * DRIVER_RATE + miles * COST_PER_MILE;
      return {
        revenue: Math.round(revenue * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        margin: Math.round((revenue - cost) * 100) / 100,
      };
    };

    type Van = { id: string; name: string; capacity: number };
    type Assignment = { van: Van; london: boolean; long: boolean; spare?: boolean };

    /** One solve for one day: one open pool of work, London fenced to its own van(s). */
    const solveDay = async (
      date: string,
      pool: Leg[],
      assignments: Assignment[],
    ): Promise<SolvedRoute[] | null> => {
      const vehicles: any[] = [];
      const meta: Record<number, VanDay> = {};
      assignments.forEach((a, idx) => {
        const built = buildVehicle(a.van, date, idx, {
          long: a.long,
          spare: a.spare,
          areaName: a.london ? (difficultAreas[londonAreaIdx]?.name ?? 'London') : null,
          london: a.london,
        });
        vehicles.push(built.vehicle);
        meta[built.meta.vehicleId] = built.meta;
      });
      if (vehicles.length === 0) return null;

      const londonVans = assignments.filter((a) => a.london).length;
      const anyLong = assignments.some((a) => a.long);
      const capH = anyLong ? LONG_CAP_H : NORMAL_CAP_H;
      const jobs = pool
        .filter((leg) => (isLondonLeg(leg) ? londonVans > 0 : true))
        .map((leg) => buildJob(leg, date, capH))
        .filter((j): j is any => !!j);
      if (jobs.length === 0) return null;

      let solution: any;
      if (exploreOk) {
        try {
          solution = await postSolve({ vehicles, jobs, options: { g: true, x: 5 } });
        } catch (e) {
          if (/distance costing/i.test((e as Error).message)) throw e;
          exploreOk = false;
          debug.exploration = false;
          solution = await postSolve({ vehicles, jobs, options: { g: true } });
        }
      } else {
        solution = await postSolve({ vehicles, jobs, options: { g: true } });
      }
      console.log('verso solve', {
        date, jobs: jobs.length, vehicles: vehicles.length,
        routes: (solution?.routes || []).length, unassigned: (solution?.unassigned || []).length,
        cost: Number(solution?.summary?.cost) || null,
      });
      return readSolution(solution, meta);
    };

    /* ---------------------------- the daily loop -------------------------- */

    const placedKeys = new Set<string>();
    const collectedInRun: Record<string, string> = {};   // orderId -> date planned
    const allRoutes: SolvedRoute[] = [];
    const spareHint: Record<string, { jobs: number; revenue: number; margin: number; must_go: number } | null> = {};
    const excludedLongArea: Record<string, Leg[]> = {};

    /** Is this delivery's bike in the depot in time for `date`? */
    const deliveryReady = (leg: Leg, date: string): boolean => {
      // A bike waiting on an inspection is never auto-unlocked: staff must mark
      // the inspection done first.
      if (leg.needsInspection) return false;
      const lead = 1;
      let collected: string | null = null;
      if (leg.inDepot) return true;
      if (leg.bookedCollection) collected = leg.bookedCollection;
      const inRun = collectedInRun[leg.orderId];
      if (inRun && (!collected || inRun < collected)) collected = inRun;
      if (!collected) return false;
      const gap = (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${collected}T12:00:00Z`)) / 86_400_000;
      return gap >= lead;
    };

    for (const date of selectedDates) {
      const dayVans = vansForDate[date] ?? [];
      const dayDebug: Record<string, any> = { vans_offered: dayVans.length, removals: [] };
      debug.days[date] = dayDebug;
      spareHint[date] = null;
      if (dayVans.length === 0) continue;

      // Every selected day is planned for real; only the clock can cut work short.
      const quickOnly = budgetLeft() < 30_000;
      if (budgetLeft() < 12_000) {
        skipped.push(`plan for ${date} (ran out of time)`);
        continue;
      }

      // 3.1 the day's pool
      let pool = legs.filter((leg) => {
        if (placedKeys.has(leg.key)) return false;
        const usable = leg.lapsed && includeExpired
          ? true
          : (leg.guaranteedDate ? leg.guaranteedDate === date : leg.futureDates.includes(date));
        if (!usable) return false;
        if (leg.legType === 'delivery' && !deliveryReady(leg, date)) return false;
        return true;
      });
      dayDebug.pool = pool.length;

      excludedLongArea[date] = [];
      if (pool.length === 0) continue;

      // 3.2 London is the only fenced area — everything else is one open pool
      const londonLegs = pool.filter((l) => isLondonLeg(l));
      const londonSpaces = londonLegs.reduce((n, l) => n + l.spaces, 0);
      dayDebug.london_jobs = londonLegs.length;
      dayDebug.corridor_jobs = pool.filter((l) => isCorridorLeg(l)).length;
      dayDebug.long_area = null;

      /** London vans first (they alone may take London work), the rest roam freely. */
      const allocate = (vans: Van[]): Assignment[] => {
        const free = [...vans];
        const assigned: Assignment[] = [];
        if (londonLegs.length > 0 && free.length > 0) {
          const cap = free[0]?.capacity ?? DEFAULT_CAPACITY;
          let wanted = Math.min(
            LONDON_MAX_VANS,
            free.length,
            Math.max(1, Math.ceil(Math.max(londonLegs.length / targetJobs, londonSpaces / Math.max(1, cap)))),
          );
          // always leave a van for the rest of the country when there is other work
          if (pool.length > londonLegs.length && wanted >= free.length) wanted = Math.max(1, free.length - 1);
          for (let i = 0; i < wanted; i++) assigned.push({ van: free.shift()!, london: true, long: false });
        }
        for (const van of free) assigned.push({ van, london: false, long: false });

        // one long day, for the busiest drawn area
        if (maxLongVans > 0 && assigned.length > 0) {
          const byArea: Record<number, { jobs: number; must: number }> = {};
          for (const l of pool) {
            if (l.areaIdx === null) continue;
            const b = (byArea[l.areaIdx] ??= { jobs: 0, must: 0 });
            b.jobs++;
            if (mustGo(l, date)) b.must++;
          }
          const best = Object.entries(byArea)
            .filter(([, b]) => b.jobs >= LONG_DAY_MIN_JOBS || b.must > 0)
            .sort((a, b) => b[1].must - a[1].must || b[1].jobs - a[1].jobs)[0];
          if (best) {
            const wantLondon = hasLondonArea && Number(best[0]) === londonAreaIdx;
            const target = assigned.find((a) => a.london === wantLondon) ?? assigned[0];
            target.long = true;
            dayDebug.long_area = difficultAreas[Number(best[0])]?.name ?? null;
          }
        }
        return assigned;
      };

      let assignments = allocate([...dayVans]);
      dayDebug.assignments = assignments.map((a) => ({ van: a.van.name, london: a.london, long: a.long }));

      let solved: SolvedRoute[] | null = null;
      try {
        solved = await solveDay(date, pool, assignments);
      } catch (e) {
        const msg = (e as Error).message;
        if (/distance costing/i.test(msg)) return json({ error: msg, debug, skipped }, 502);
        skipped.push(`plan for ${date} (${msg})`);
        continue;
      }
      if (!solved) continue;

      const servedKeys = (rs: SolvedRoute[]) => new Set(rs.flatMap((r) => r.stops.map((s) => s.leg.key)));

      // 3.4 fill: put idle vans to work while jobs are still unplanned
      if (!quickOnly && budgetLeft() > 15_000) {
        const served = servedKeys(solved);
        const idle = dayVans.filter((v) => !assignments.some((a) => a.van.id === v.id));
        const leftLondon = londonLegs.filter((l) => !served.has(l.key)).length;
        const left = pool.filter((l) => !served.has(l.key)).length;
        if (idle.length > 0 && left > 0) {
          let londonVans = assignments.filter((a) => a.london).length;
          const extra: Assignment[] = idle.map((van) => {
            const takeLondon = leftLondon > 0 && londonVans < LONDON_MAX_VANS;
            if (takeLondon) londonVans++;
            return { van, london: takeLondon, long: false };
          });
          try {
            const filled = await solveDay(date, pool, [...assignments, ...extra]);
            if (filled && servedKeys(filled).size > served.size) {
              solved = filled;
              assignments = [...assignments, ...extra];
              dayDebug.filled_with_all_vans = true;
            }
          } catch {
            // filling is an improvement pass, never a reason to fail the day
          }
        }
      }

      // 3.5 van-reduction loop — only when no job at all is lost
      if (quickOnly) {
        skipped.push(`fine-tuning ${date} (ran out of time)`);
      } else {
        const protectedVans = new Set<string>();
        for (let step = 0; step < MAX_REMOVALS_PER_DAY; step++) {
          if (budgetLeft() < 15_000) { skipped.push(`fine-tuning ${date} (ran out of time)`); break; }
          const scored = solved!.map((r) => ({ r, ...money(r) }));
          const weakest = scored
            .filter((x) => !protectedVans.has(x.r.meta.vanId) && x.r.stops.length < targetJobs)
            .sort((a, b) => a.r.stops.length - b.r.stops.length)[0]
            ?? (minMargin > 0
              ? scored.filter((x) => !protectedVans.has(x.r.meta.vanId) && x.margin < minMargin)
                .sort((a, b) => a.margin - b.margin)[0]
              : undefined);
          if (!weakest) break;
          const trial = assignments.filter((a) => a.van.id !== weakest.r.meta.vanId);
          if (trial.length === 0) break;
          let retry: SolvedRoute[] | null = null;
          try {
            retry = await solveDay(date, pool, trial);
          } catch (e) {
            dayDebug.removals.push({ van: weakest.r.meta.vanName, outcome: `solve failed: ${(e as Error).message}` });
            protectedVans.add(weakest.r.meta.vanId);
            continue;
          }
          const before = servedKeys(solved!);
          const after = retry ? servedKeys(retry) : new Set<string>();
          const lost = [...before].filter((k) => !after.has(k));
          if (!retry || lost.length > 0) {
            protectedVans.add(weakest.r.meta.vanId);
            dayDebug.removals.push({
              van: weakest.r.meta.vanName, jobs: weakest.r.stops.length,
              outcome: 'kept — work would be left undone', lost_jobs: lost.length,
            });
            continue;
          }
          dayDebug.removals.push({ van: weakest.r.meta.vanName, jobs: weakest.r.stops.length, outcome: 'van taken off the road' });
          assignments = trial;
          solved = retry;
        }
        dayDebug.protected = [...protectedVans];
      }

      // 3.6 spare-van check: could one more real van clear the work that's left?
      const dayPlacedKeys = new Set(solved!.flatMap((r) => r.stops.map((s) => s.leg.key)));
      const leftovers = pool.filter((l) => !dayPlacedKeys.has(l.key));
      const unusedVan = (vansForDate[date] ?? []).find((v) => !assignments.some((a) => a.van.id === v.id));
      if (unusedVan && leftovers.length > 0 && budgetLeft() > 15_000 && !quickOnly) {
        try {
          const spareSolved = await solveDay(
            date, leftovers,
            [{ van: unusedVan, london: leftovers.some((l) => isLondonLeg(l)), long: false, spare: true }],
          );
          const spareRoute = (spareSolved ?? [])[0];
          if (spareRoute) {
            const m = money(spareRoute);
            const must = spareRoute.stops.filter((s) => mustGo(s.leg, date)).length;
            if (spareRoute.stops.length >= targetJobs || must > 0) {
              spareHint[date] = { jobs: spareRoute.stops.length, revenue: m.revenue, margin: m.margin, must_go: must };
            }
          }
        } catch {
          // a spare-van hint is nice to have, never worth failing the run for
        }
      }

      // 3.7 move on
      for (const r of solved!) {
        allRoutes.push(r);
        for (const s of r.stops) {
          placedKeys.add(s.leg.key);
          if (s.leg.legType === 'collection') collectedInRun[s.leg.orderId] = date;
        }
      }
      dayDebug.vans_used = new Set(solved!.map((r) => r.meta.vanId)).size;
      dayDebug.jobs_per_route = solved!.map((r) => r.stops.length);
      dayDebug.margin_per_route = solved!.map((r) => money(r).margin);
    }

    if (allRoutes.length === 0 && skipped.length === 0 && legs.length > 0) {
      // Nothing was plannable, but the panels still have work to show.
      console.log('route-optimize produced no routes', { legs: legs.length });
    }

    /* ------------------------------ persist ------------------------------- */

    await admin.from('route_plans').update({ status: 'superseded' }).eq('status', 'active');

    const { data: planRow, error: planErr } = await admin.from('route_plans').insert({
      horizon_start: selectedDates[0],
      horizon_end: selectedDates[selectedDates.length - 1],
      selected_dates: selectedDates,
      shift_start: shiftStart,
      firm_days: firmDays,
      inspection_lead_days: inspectionLeadDays,
      created_by: userData.user.id,
      status: 'active',
      mode: 'greedy',
      generated_at: new Date().toISOString(),
    }).select('id').single();
    if (planErr) throw planErr;
    const planId = planRow.id as string;

    const assigned = new Set<string>();
    const routesByDate: Record<string, any[]> = {};

    const prepared = allRoutes.map((r) => {
      const ordered = [...r.stops].sort((a, b) => a.arrival - b.arrival);
      const steps = Array.isArray(r.route.steps) ? r.route.steps : [];
      const maxLoadUnits = Math.max(0, ...steps.map((s: any) => Number(s?.load?.[0]) || 0));
      const duration = routeDuration(r.route);
      const m = money(r);
      const mustGoLabels = ordered.filter((s) => mustGo(s.leg, r.meta.date)).map((s) => s.leg.label);
      const thin = ordered.length < targetJobs;
      return {
        meta: r.meta, ordered, duration, ...m,
        isProvisional: selectedDates.indexOf(r.meta.date) >= firmDays,
        longDay: r.meta.long && duration > NORMAL_CAP_H * HOURS,
        miles: routeMiles(r.route),
        maxLoad: Math.round((maxLoadUnits / 10) * 100) / 100,
        geometry: typeof r.route.geometry === 'string' ? r.route.geometry : null,
        region: r.meta.areaName,
        spreadMi: spreadMiles(ordered.map((s) => s.leg)),
        thin,
        belowFloor: ordered.length < floorJobs,
        thinReason: thin
          ? (mustGoLabels.length > 0 ? 'Needed for must-go jobs' : 'Thin — no more work fitted nearby')
          : null,
        mustGoLabels: mustGoLabels.slice(0, 10),
      };
    });

    if (prepared.length > 0) {
      const { data: routeRows, error: routeErr } = await admin.from('route_plan_routes').insert(
        prepared.map((p) => ({
          plan_id: planId,
          route_date: p.meta.date,
          variant: 'primary',
          pass: 'A',
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
            is_difficult_area: s.leg.areaIdx !== null,
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
          spread_warning: p.spreadMi > SPREAD_WARN_MI,
          thin: p.thin,
          below_floor: p.belowFloor,
          thin_reason: p.thinReason,
          urgent_labels: p.mustGoLabels,
          guaranteed_count: p.ordered.filter((s) => !!s.leg.guaranteedDate).length,
          must_go_count: p.mustGoLabels.length,
          revenue: p.revenue,
          cost: p.cost,
          margin: p.margin,
          stops: p.ordered.map((s, i) => ({
            seq: i + 1, leg_type: s.leg.legType, order_id: s.leg.orderId,
            eta: isoFromEpoch(s.arrival), lat: s.leg.lat, lon: s.leg.lon,
            is_difficult_area: s.leg.areaIdx !== null, label: s.leg.label,
            guaranteed: !!s.leg.guaranteedDate,
          })),
        });
      });

      if (stopRows.length > 0) {
        const { error: stopsErr } = await admin.from('route_plan_stops').insert(stopRows);
        if (stopsErr) throw stopsErr;
      }
    }

    /* ------------------------------ response ------------------------------ */

    const unplaced = legs.filter((l) => !assigned.has(l.key));

    const days = selectedDates.map((date, idx) => {
      const dayRoutes = routesByDate[date] ?? [];
      const usedVans = new Set(dayRoutes.map((r) => r.van_id));
      const available = (vansForDate[date] ?? []).length;
      const hint = spareHint[date];
      return {
        date,
        vans_needed: usedVans.size,
        vans_available: available,
        van_names: [...usedVans].map((id) => (vansForDate[date] ?? []).find((v) => v.id === id)?.name).filter(Boolean),
        spare_vans: Math.max(0, available - usedVans.size),
        is_provisional: idx >= firmDays,
        shortfall: hint ? { extra_vans: 1, extra_jobs: hint.jobs, urgent: hint.must_go } : null,
        spare_van_hint: hint,
        variants: [{ variant: 'primary', routes: dayRoutes, tradeoff_note: null }],
        unplanned_count: unplaced.filter((l) => !l.lapsed && l.futureDates.includes(date)).length,
        unplanned_lapsed_count: unplaced.filter((l) => l.lapsed && includeExpired).length,
        lapsed_count: dayRoutes.reduce((n, r) => n + 0, 0),
        expiring_count: legs.filter((l) => l.lastDate === date).length,
        expiring_unplanned_count: unplaced.filter((l) => l.lastDate === date).length,
        long_days: dayRoutes.filter((r) => r.is_expedition).length,
        areas: dayRoutes.filter((r) => r.region).map((r) => ({ sectors: [r.region as string], van: r.van_name })),
        infeasible_guaranteed: unplaced
          .filter((l) => l.guaranteedDate === date)
          .map((l) => ({ order_id: l.orderId, label: l.label, leg_type: l.legType, date })),
      };
    });

    const excludedKeys = new Set(Object.values(excludedLongArea).flat().map((l) => l.key));
    const atRisk = unplaced
      .filter((l) => urgentInPlan(l))
      .sort((a, b) => (a.guaranteedDate ? -1 : 0) - (b.guaranteedDate ? -1 : 0))
      .map((l) => ({
        order_id: l.orderId,
        label: l.label,
        leg_type: l.legType,
        priority: l.guaranteedDate ? 100 : 50,
        remaining_dates: l.futureDates.length,
        last_date: l.lastDate ?? (l.allDates[l.allDates.length - 1] ?? null),
        guaranteed_date: l.guaranteedDate,
        reason: l.guaranteedDate ? 'Guaranteed date could not be met'
          : excludedKeys.has(l.key) ? 'Needs a long day — another difficult area was chosen'
          : l.lapsed ? 'Dates had expired — planned via the expired-jobs override'
          : l.legType === 'delivery' && !l.inDepot ? 'Waiting on its collection being planned'
          : 'Its last available date was full',
      }));

    const carried = unplaced.filter((l) => !urgentInPlan(l)).length;

    const vanDaysAvailable = selectedDates.reduce((n, d) => n + (vansForDate[d] ?? []).length, 0);
    const vanDaysNeeded = days.reduce((n, d) => n + d.vans_needed, 0);
    const jobsPerRoute = prepared.map((p) => p.ordered.length).sort((a, b) => a - b);

    debug.jobs_per_route = jobsPerRoute;
    debug.median_jobs_per_route = jobsPerRoute.length ? jobsPerRoute[Math.floor(jobsPerRoute.length / 2)] : 0;
    debug.vans_offered = Object.fromEntries(selectedDates.map((d) => [d, (vansForDate[d] ?? []).length]));
    debug.vans_used = Object.fromEntries(days.map((d) => [d.date, d.vans_needed]));
    debug.total_margin = Math.round(prepared.reduce((n, p) => n + p.margin, 0) * 100) / 100;
    debug.settings = {
      target_jobs: targetJobs, floor_jobs: floorJobs, max_long_vans: maxLongVans,
      min_route_margin: minMargin, normal_hours: NORMAL_CAP_H, long_hours: LONG_CAP_H,
    };
    debug.skipped = skipped;

    await admin.from('route_plans').update({
      shortfall: { van_days_available: vanDaysAvailable, van_days_needed: vanDaysNeeded, short_days: [] },
      debug,
    }).eq('id', planId);

    return json({
      plan_id: planId,
      mode: 'greedy',
      unplanned_count: unplaced.length,
      carried_count: carried,
      unplanned_lapsed_count: unplaced.filter((l) => l.lapsed).length,
      expiring_in_plan_count: legs.filter((l) => !!l.lastDate && l.lastDate <= lastSelectedDate).length,
      expiring_unplanned_count: unplaced.filter((l) => !!l.lastDate && l.lastDate <= lastSelectedDate).length,
      generated_at: new Date().toISOString(),
      firm_days: firmDays,
      shortfall_pending: false,
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
