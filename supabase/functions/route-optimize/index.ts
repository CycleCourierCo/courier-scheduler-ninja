// Generates van routes across a set of chosen days in ONE joint solve, using the
// Verso hosted VROOM API. Server-side only: Verso credentials never leave here.
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
const PRIMARY_CAP_H = 12;      // target cap for the primary joint solve
const EXPEDITION_CAP_H = 15;   // difficult-area long day
const DEFAULT_CAPACITY = 10;
const STAFF_ROLES = ['admin', 'sales', 'route_planner'];
const MAX_DAYS = 10;
const VIRTUAL_VANS_PER_DAY = 2;
// Optional extra solves are skipped once this much of the run is gone, so a big
// plan is always saved and returned instead of the run being killed mid-way.
const TIME_BUDGET_MS = 90_000;
// Money, in pence, so the solver weighs "open another van" against "drive a bit
// further" on the same scale we judge profit on. A van that rolls costs a
// driver for the whole shift; time on the road costs the same hourly rate.
const DRIVER_PENCE_PER_HOUR = 1100;
// A 15h "expedition" day is a real cost to the business, not a free upgrade, so
// it carries a premium shift cost and a dearer hourly rate. Without this the
// solver happily runs every van long because a longer window fits more work.
const EXPEDITION_PREMIUM = 1.5;
const DEFAULT_MAX_LONG_DAYS = 2;

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
   /** Customer dates had all lapsed — only in the pool via the include-expired override. */
   lapsed: boolean;
   /** Last remaining customer date falls inside this plan window — at risk of lapsing. */
   expiringInPlan: boolean;
   /** Last future customer date (null when lapsed). */
   lastDate: string | null;
   difficult: boolean;
   businessHours: Record<string, any> | null;
   label: string;
   needsUnlock: boolean;      // delivery whose bike isn't collected yet
   needsInspection: boolean;
   collectedAt: string | null;
   /** Collection already booked in for this day (kept out of planning itself). */
   scheduledCollection: string | null;
}

interface VanDay { vehicleId: number; date: string; vanId: string; vanName: string; capacity: number; expedition: boolean; virtual: boolean }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const runStarted = Date.now();
  const budgetLeft = () => TIME_BUDGET_MS - (Date.now() - runStarted);

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
    // 'joint' balances the whole horizon in one solve; 'greedy' fills each day
    // as full as it can, in order.
    const mode: 'joint' | 'greedy' = body?.mode === 'greedy' ? 'greedy' : 'joint';
    // Per-run override: plan legs whose customer dates have all lapsed anyway,
    // boosted so they are placed ahead of ordinary work.
    const includeExpired = body?.include_expired === true;
    // How many 15h long days may exist on any one day. 0 means none at all.
    const maxLongDays = Number.isFinite(Number(body?.max_long_days))
      ? Math.max(0, Math.min(4, Math.round(Number(body.max_long_days))))
      : DEFAULT_MAX_LONG_DAYS;
    // Second, lighter call: work out the "an extra van would plan N more jobs"
    // figures only, and save nothing. Keeps them off the main Generate press.
    const shortfallOnly = body?.shortfall_only === true;

    const today = todayLondon();
    const selectedDates: string[] = [...new Set(
      (Array.isArray(body?.selected_dates) ? body.selected_dates : [])
        .filter((d: unknown) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)),
    )].sort().slice(0, MAX_DAYS);
    if (selectedDates.length === 0) return json({ error: 'Pick at least one day to plan' }, 400);

    // van availability: { "YYYY-MM-DD": [vanId, ...] } or a flat van_ids list for every day
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

    const areaRings: Ring[] = [];
    for (const area of (areasRes.data as any[]) || []) {
      const coords = area?.geojson?.coordinates;
      if (Array.isArray(coords)) for (const ring of coords) if (Array.isArray(ring)) areaRings.push(ring as Ring);
    }
    const inDifficultArea = (lat: number, lon: number) => areaRings.some((r) => pointInRing(lon, lat, r));

    const allVans = ((vehiclesRes.data as any[]) || [])
      // Only vans in use or off road can be planned: ones in repair, awaiting
      // sale, sold or written off must never appear.
      .filter((v) => v.status === 'in_use' || v.status === 'off_road')
      .map((v) => ({
        id: v.id as string,
        name: (v.registration || v.make || 'Van') as string,
        capacity: Number(v.bike_spaces) > 0 ? Number(v.bike_spaces) : defaultCapacity,
      }));
    if (allVans.length === 0) return json({ error: 'No vans available for planning' }, 400);

    const blocked = new Set(((unavailRes.data as any[]) || []).map((r) => `${r.van_id}:${dateKey(r.unavailable_on) ?? r.unavailable_on}`));

    // Resolve the van set for each chosen day.
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

    // Legs already committed to a locked/confirmed day are out of the pool.
    const { data: lockedRows } = await admin
      .from('route_plan_stops')
      .select('order_id,leg_type,route_plan_routes!inner(day_status,selected)')
      .in('route_plan_routes.day_status', ['locked', 'confirmed']);
    const locked = new Set(((lockedRows as any[]) || []).map((r) => `${r.order_id}:${r.leg_type}`));

    // Existing leg availability states / priority boosts.
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

      // Safety net: ignore dates that fall on a non-working day (old or manual data).
      const clean = (values: unknown) => [...new Set((Array.isArray(values) ? values : [])
        .map(dateKey).filter((d): d is string => !!d && isWorkingDate(d)))].sort();

      const pickupDates = clean(order.pickup_date);
      const deliveryDates = clean(order.delivery_date);

      // No stored "collection completed" timestamp exists: use the scheduled
      // pickup day once collected. Never guess from the customer's first
      // offered date — that produced misleading "days in the depot" figures.
      const collectedDate = order.order_collected
        ? dateKey(order.scheduled_pickup_date)
        : null;
      // Collection booked in but not done yet: the bike joins us that day.
      const bookedCollection = !order.order_collected && order.scheduled_pickup_date
        ? dateKey(order.scheduled_pickup_date)
        : null;

      // Older bookings carry a small capped priority bump so long-waiting
      // multi-date jobs are not endlessly outrun by fresher ones.
      const createdAt = dateKey(order.created_at);
      const ageBoost = createdAt ? Math.min(10, Math.floor(daysSince(createdAt) / 7)) : 0;

      const buildPriority = (available: string[], guaranteed: string | null, boost: number) => {
        if (guaranteed) return 100;
        const future = available.filter((d) => d >= today);
        const R = Math.max(1, future.length);
        const D = Math.max(1, Math.min(...(future.length ? future.map(daysUntil) : [1])));
        return Math.max(1, Math.min(99, Math.round(60 / R + 40 / D) + boost));
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
        const boost = Number(state?.priority_boost) || 0;
        const future = dates.filter((d) => d >= today);
        const expired = dates.length > 0 && future.length === 0;
        // A job whose last remaining date falls inside the plan window is at
        // risk of lapsing during it — prioritise it, and let a grace pass
        // spill it onto a later day in the window if its own dates are full.
        const lastDate = future.length ? future[future.length - 1] : null;
        const expiringInPlan = !!(lastDate && lastDate <= lastSelectedDate);

        // Expiry bookkeeping — a leg with no future dates is never silently dropped.
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
            days_in_depot: legType === 'delivery' && collectedDate
              ? daysSince(collectedDate) : null,
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
          // The include-expired override lets lapsed legs into this run anyway;
          // legs with no dates at all still cannot be planned.
          if (!includeExpired || dates.length === 0) return;
        }

        const windowDates = lapsed
          // Lapsed legs can land on any chosen day — their stored dates are all past.
          ? selectedDates.slice()
          : future.filter((d) => selectedSet.has(d));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        if (guaranteed) {
          if (!selectedSet.has(guaranteed)) return;
        } else if (windowDates.length === 0) return;

        legs.push({
          key, jobId: nextJobId++, orderId: order.id, legType, lat, lon, spaces,
          allDates: dates,
          windowDates: guaranteed ? [guaranteed] : windowDates,
          guaranteedDate: guaranteed,
          priority: buildPriority(dates, guaranteed,
            boost + (lapsed ? 20 : 0) + (expiringInPlan ? 15 : 0) + ageBoost),
          lapsed,
          expiringInPlan: !lapsed && expiringInPlan,
          lastDate: lapsed ? null : lastDate,
          difficult: inDifficultArea(lat, lon),
          businessHours, label,
          needsUnlock: extra.needsUnlock,
          needsInspection: !!order.needs_inspection && !inspectionDone,
          collectedAt: collectedDate,
          scheduledCollection: bookedCollection,
        });
      };

      // Collection leg
      considerLeg(
        'collection', pickupDates,
        Number(order.sender?.address?.lat), Number(order.sender?.address?.lon),
        null,
        { needsUnlock: false, eligible: !order.order_collected && !order.scheduled_pickup_date },
      );

      // Delivery leg
      const guaranteed = order.guaranteed_delivery && order.guaranteed_delivery_date
        ? dateKey(order.guaranteed_delivery_date) : null;
      // A collection already booked in isn't re-planned, but its delivery can
      // still be planned: the bike will be with us from that day on.
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

    /* ---------------------------- solve helpers --------------------------- */

    const postSolve = async (payload: any) => {
      const call = (body: any) => fetch(solveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VERSO_API_KEY}`, 'X-Api-Key': VERSO_API_KEY },
        body: JSON.stringify(body),
      });
      // Read each failing reply once — cloning a large body costs real CPU.
      let resp = await call(payload);
      let detail = resp.ok ? '' : (await resp.text()).slice(0, 300);
      // Older builds reject unknown option keys, speed_factor or costs.fixed —
      // retry with progressively plainer payloads (spec §6 fallbacks).
      if (resp.status === 400 && /option|x\b/i.test(detail)) {
        resp = await call({ ...payload, options: { g: true } });
        detail = resp.ok ? '' : (await resp.text()).slice(0, 300);
      }
      if (resp.status === 400 && /speed_factor|costs|fixed|max_travel_time/i.test(detail)) {
        const plainVehicles = (payload.vehicles as any[]).map((v) => {
          const { speed_factor: _s, costs: _c, max_travel_time: _m, ...rest } = v;
          // Shorten the window instead of the 5% pessimism buffer.
          const [open, close] = rest.time_window;
          return { ...rest, time_window: [open, open + Math.round((close - open) * 0.95)] };
        });
        resp = await call({ ...payload, vehicles: plainVehicles, options: { g: true } });
        detail = resp.ok ? '' : (await resp.text()).slice(0, 300);
      }
      if (!resp.ok) {
        const err = new Error(`Route optimiser failed (${resp.status}): ${detail}`);
        (err as any).status = resp.status;
        throw err;
      }
      return await resp.json();
    };

    /** Build one vehicle per van per chosen day (+ expedition twins, + virtual vans). */
    const buildVehicles = (opts: {
      dates: string[];
      capH: number;
      /** Difficult-area legs workable on each date, used to budget long days. */
      difficultCounts: Record<string, number>;
      skipVanDays?: Set<string>;   // "date:vanId:kind"
      withVirtual?: boolean;
      /** Greedy mode: no fixed vehicle cost, so every available van is offered. */
      noFixed?: boolean;
    }) => {
      const vehicles: any[] = [];
      const meta: Record<number, VanDay> = {};
      opts.dates.forEach((date, dayIdx) => {
        const shiftOpen = londonEpoch(date, shiftStart);
        const dayVans = vansForDate[date] ?? [];
        // Only offer as many long days as the difficult-area work needs, never
        // more than the cap. Every van getting a 15h twin is why whole plans
        // used to come back as expeditions.
        let longAllowance = 0;
        const diffCount = opts.difficultCounts[date] ?? 0;
        if (diffCount > 0 && maxLongDays > 0 && dayVans.length > 0) {
          const avgCap = dayVans.reduce((s, v) => s + (v.capacity || DEFAULT_CAPACITY), 0) / dayVans.length;
          const needed = Math.max(1, Math.ceil(diffCount / Math.max(1, avgCap)));
          longAllowance = Math.min(maxLongDays, dayVans.length, needed);
        }
        dayVans.forEach((van, vanIdx) => {
          const capUnits = Math.max(1, Math.round(van.capacity * 10));
          const push = (kind: 1 | 2, capHours: number, virtual = false) => {
            const id = dayIdx * 10000 + vanIdx * 100 + kind;
            if (opts.skipVanDays?.has(`${date}:${van.id}:${kind}`)) return;
            // A long day is dearer per shift and per hour, so it is only used
            // when it rescues work a normal shift cannot reach.
            const longDay = kind === 2;
            const perHour = Math.round(DRIVER_PENCE_PER_HOUR * (longDay ? EXPEDITION_PREMIUM : 1));
            const fixed = Math.round(capHours * DRIVER_PENCE_PER_HOUR * (longDay ? EXPEDITION_PREMIUM : 1));
            vehicles.push({
              id, profile: 'car',
              start: [DEPOT.lon, DEPOT.lat], end: [DEPOT.lon, DEPOT.lat],
              capacity: [capUnits],
              time_window: [shiftOpen, shiftOpen + capHours * HOURS],
              max_travel_time: Math.max(2 * HOURS, (capHours - 2) * HOURS),
              speed_factor: 0.95,
              // Real money: a van that rolls costs a driver for the whole
              // shift, and every hour on it costs the same rate again. That
              // makes filling a van up genuinely cheaper than opening another.
              ...(opts.noFixed && !longDay
                ? { costs: { per_hour: perHour } }
                : { costs: { fixed, per_hour: perHour } }),
              ...(longDay ? { skills: [1] } : {}),
            });
            meta[id] = { vehicleId: id, date, vanId: van.id, vanName: van.name, capacity: van.capacity, expedition: kind === 2, virtual };
          };
          push(1, opts.capH);
          if (longAllowance > 0) {
            push(2, EXPEDITION_CAP_H);
            longAllowance--;
          }
        });

        if (opts.withVirtual) {
          for (let i = 0; i < VIRTUAL_VANS_PER_DAY; i++) {
            const id = dayIdx * 10000 + (90 + i) * 100 + 1;
            vehicles.push({
              id, profile: 'car',
              start: [DEPOT.lon, DEPOT.lat], end: [DEPOT.lon, DEPOT.lat],
              capacity: [DEFAULT_CAPACITY * 10],
              time_window: [shiftOpen, shiftOpen + 13 * HOURS],
              max_travel_time: 11 * HOURS,
              speed_factor: 0.95,
              // Deliberately dear: an extra van is only "worth it" when it
              // rescues a real amount of work.
              costs: { fixed: 40000, per_hour: DRIVER_PENCE_PER_HOUR },
            });
            meta[id] = { vehicleId: id, date, vanId: `virtual-${i}`, vanName: `Extra van ${i + 1}`, capacity: DEFAULT_CAPACITY, expedition: false, virtual: true };
          }
        }
      });
      return { vehicles, meta };
    };

    /** A leg's window on one date, honouring business opening hours. */
    const windowFor = (leg: Leg, date: string): [number, number] | null => {
      const shiftOpen = londonEpoch(date, shiftStart);
      let window: [number, number] = [shiftOpen, shiftOpen + EXPEDITION_CAP_H * HOURS];
      const day = leg.businessHours?.[weekdayKey(date)];
      if (day && day.open === false) return null;
      if (day && day.open && !day.is24h && day.start && day.end) {
        const open = londonEpoch(date, day.start);
        const close = londonEpoch(date, day.end) - SERVICE_S;
        if (close <= open) return null;
        window = [Math.max(open, shiftOpen), close];
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
        ...(leg.difficult ? { skills: [1] } : {}),
      };
    };

    const dateOfEpoch = (epoch: number): string =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(epoch * 1000));

    interface Placed { leg: Leg; date: string; vehicleId: number; arrival: number }

    const readSolution = (solution: any, meta: Record<number, VanDay>, legsById: Record<number, Leg>) => {
      const routes = Array.isArray(solution?.routes) ? solution.routes : [];
      const placed: Placed[] = [];
      const routeInfo: { meta: VanDay; route: any; stops: Placed[] }[] = [];
      for (const route of routes) {
        const m = meta[Number(route.vehicle)];
        if (!m) continue;
        const steps = Array.isArray(route.steps) ? route.steps : [];
        const stops: Placed[] = [];
        for (const s of steps) {
          // 'pickup'/'delivery' steps come from same-day collect-then-deliver
          // pairs, where the bike is loaded and dropped on one run.
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

    const legsById: Record<number, Leg> = {};
    for (const leg of legs) legsById[leg.jobId] = leg;

    /** How many difficult-area legs could be worked on each date. */
    const difficultCountsFor = (pool: Leg[]) => {
      const counts: Record<string, number> = {};
      for (const leg of pool) {
        if (!leg.difficult) continue;
        for (const d of leg.windowDates) counts[d] = (counts[d] ?? 0) + 1;
      }
      return counts;
    };

    /* ------------- same-day collect-then-deliver pairs -------------------- */

    // Where a bike can be collected and dropped on the same day, offer the two
    // stops as one linked pair so a van can empty out and pick more up again
    // instead of running at half capacity.
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
        const shared = c.windowDates.filter((x) => d.windowDates.includes(x));
        if (shared.length > 0) out.push({ c, d, dates: shared });
      }
      return out;
    })();
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
      return {
        amount: [Math.max(1, Math.round(pair.c.spaces * 10))],
        priority: Math.max(pair.c.priority, pair.d.priority),
        ...(pair.c.difficult || pair.d.difficult ? { skills: [1] } : {}),
        pickup, delivery,
      };
    };

    /* ------------------------------ pass A -------------------------------- */

    // Ready legs: all collections, plus deliveries whose bike is already in the depot.
    const readyLegs = legs.filter((l) => l.legType === 'collection' || (!l.needsUnlock && !l.needsInspection));
    if (readyLegs.length === 0) {
      return json({
        plan_id: null, days: selectedDates.map((date) => ({
          date, vans_needed: 0, vans_available: (vansForDate[date] ?? []).length, van_names: [],
          variants: [{ variant: 'primary', routes: [], tradeoff_note: null }],
          infeasible_guaranteed: [], is_provisional: false, shortfall: null, spare_vans: (vansForDate[date] ?? []).length,
        })),
        at_risk: [], needs_new_dates: needsNewDates.sort((a, b) => a.severity - b.severity),
        vans: allVans, weekly: null,
      });
    }

    const runSolve = async (pool: Leg[], pinned: Record<string, string>, capH: number, opts?: { withVirtual?: boolean; dates?: string[]; skip?: Set<string>; noFixed?: boolean; pairs?: boolean }) => {
      const dates = opts?.dates ?? selectedDates;
      const poolKeys = new Set(pool.map((l) => l.key));
      const usablePairs = opts?.pairs
        ? sameDayPairs.filter((p) => poolKeys.has(p.c.key) && poolKeys.has(p.d.key) && !pinned[p.c.key] && !pinned[p.d.key]
            && p.dates.some((d) => dates.includes(d)))
        : [];
      const pairedKeys = new Set<string>();
      const shipments: any[] = [];
      for (const p of usablePairs) {
        const shipment = buildShipment(p, dates);
        if (!shipment) continue;   // no workable window: leave both as plain stops
        shipments.push(shipment);
        pairedKeys.add(p.c.key);
        pairedKeys.add(p.d.key);
      }
      const jobs = pool
        .filter((leg) => !pairedKeys.has(leg.key))
        .map((leg) => buildJob(leg, pinned[leg.key] ? [pinned[leg.key]] : leg.windowDates.filter((d) => dates.includes(d))))
        .filter((j): j is any => !!j);
      if (jobs.length === 0 && shipments.length === 0) return null;
      const { vehicles, meta } = buildVehicles({
        dates, capH, difficultDates: difficultDatesFor(pool), withVirtual: opts?.withVirtual, skipVanDays: opts?.skip,
        noFixed: opts?.noFixed,
      });
      if (vehicles.length === 0) return null;
      const started = Date.now();
      const payload: any = { vehicles, jobs, options: { g: true, x: 5 } };
      if (shipments.length > 0) payload.shipments = shipments;
      let solution: any;
      try {
        solution = await postSolve(payload);
      } catch (e) {
        // If linked pairs are rejected, fall back to plain stops so a plan is
        // still produced.
        if (shipments.length === 0) throw e;
        console.error('paired solve rejected, retrying without pairs', (e as Error).message);
        return runSolve(pool, pinned, capH, { ...opts, pairs: false });
      }
      console.log('verso solve', {
        days: dates.length, jobs: jobs.length, shipments: shipments.length, vehicles: vehicles.length,
        routes: (solution?.routes || []).length,
        unassigned: (solution?.unassigned || []).length,
        cost: Number(solution?.summary?.cost) || null,
        virtual: !!opts?.withVirtual, ms: Date.now() - started,
      });
      return { solution, meta, jobCount: jobs.length };
    };

    let current: { placed: Placed[]; routeInfo: { meta: VanDay; route: any; stops: Placed[] }[] } = { placed: [], routeInfo: [] };
    let pool = readyLegs;
    let pinned: Record<string, string> = {};
    let displaced: Leg[] = [];
    // Shared with the saving step below, so it must live outside both branches.
    let unlockable: Leg[] = [];

    if (mode === 'greedy') {
      /* --------------------- day-by-day (greedy) planning ------------------- */
      // Each day is filled as full as it will go before the next day is looked at.
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
            // Collect and drop on the same run, as a linked pair.
            const pair = pairByOrder[leg.orderId];
            return !!pair && pair.dates.includes(date) && !placedKeys.has(pair.c.key);
          }
          if (leg.needsInspection && inspectionLeadDays === null) return false;
          const lead = leg.needsInspection ? Math.max(1, inspectionLeadDays ?? 1) : 1;
          return dayIdx - selectedDates.indexOf(collected) >= lead;
        });
        if (candidates.length === 0) continue;
        try {
          const day = await runSolve(candidates, {}, PRIMARY_CAP_H, { dates: [date], noFixed: true, pairs: true });
          if (!day) continue;
          const read = readSolution(day.solution, day.meta, legsById);
          for (const p of read.placed) {
            placedKeys.add(p.leg.key);
            if (p.leg.legType === 'collection') collectedOn[p.leg.orderId] = p.date;
          }
          current = {
            placed: [...current.placed, ...read.placed],
            routeInfo: [...current.routeInfo, ...read.routeInfo],
          };
        } catch (e) {
          console.error('greedy day failed', date, (e as Error).message);
        }
      }
      pool = legs;
      if (current.routeInfo.length === 0) {
        return json({ error: 'Nothing could be planned day by day for those days' }, 400);
      }
    } else {
      let passA;
      try {
        // Deliveries that can ride along on the same day as their collection
        // join pass A as linked pairs; the rest wait for pass B.
        pool = [...readyLegs, ...sameDayPairs.map((p) => p.d).filter((d) => !readyLegs.includes(d))];
        passA = await runSolve(pool, {}, PRIMARY_CAP_H, { pairs: true });
      } catch (e) {
        console.error('pass A failed', (e as Error).message);
        return json({ error: (e as Error).message }, 502);
      }
      if (!passA) return json({ error: 'Nothing could be sent to the optimiser for those days' }, 400);

      current = readSolution(passA.solution, passA.meta, legsById);

      /* ------------------------ repair (one route per van-day) ------------- */

      // One re-solve only: more than that rarely changes the answer and can
      // push the run past its time budget.
      for (let attempt = 0; attempt < 1 && budgetLeft() > 25_000; attempt++) {
        const byVanDay: Record<string, Set<boolean>> = {};
        for (const { meta } of current.routeInfo) {
          const k = `${meta.date}:${meta.vanId}`;
          (byVanDay[k] ??= new Set()).add(meta.expedition);
        }
        const clashes = Object.entries(byVanDay).filter(([, kinds]) => kinds.size > 1);
        if (clashes.length === 0) break;
        const skip = new Set<string>(clashes.map(([k]) => `${k}:1`)); // drop the normal twin
        try {
          const retry = await runSolve(pool, pinned, PRIMARY_CAP_H, { skip, pairs: true });
          if (!retry) break;
          current = readSolution(retry.solution, retry.meta, legsById);
          passA = retry;
        } catch { break; }
      }

      /* ------------------------------ pass B -------------------------------- */

      const collectionDay: Record<string, string> = {};
      for (const p of current.placed) {
        if (p.leg.legType === 'collection') collectionDay[p.leg.orderId] = p.date;
      }
      const placedAlready = new Set(current.placed.map((p) => p.leg.key));

      unlockable = legs.filter((leg) => {
        if (leg.legType !== 'delivery' || !leg.needsUnlock) return false;
        if (placedAlready.has(leg.key)) return false;   // already riding with its collection
        // A collection already booked in outside this plan still frees the bike.
        const collectedOn = collectionDay[leg.orderId] ?? leg.scheduledCollection;
        if (!collectedOn) return false;
        if (leg.needsInspection && inspectionLeadDays === null) return false;
        const lead = leg.needsInspection ? Math.max(1, inspectionLeadDays ?? 1) : 1;
        const earliest = selectedDates.filter((d) => d > collectedOn);
        const allowed = earliest.slice(Math.max(0, lead - 1)); // lead-th selected day onwards
        const dates = leg.windowDates.filter((d) => allowed.includes(d));
        if (dates.length === 0) return false;
        leg.windowDates = dates;
        return true;
      });

      if (unlockable.length > 0 && budgetLeft() > 25_000) {
        pinned = {};
        // Linked same-day pairs are left free so they stay linked in pass B.
        for (const p of current.placed) {
          if (p.leg.legType !== 'collection') continue;
          if (pairByOrder[p.leg.orderId]) continue;
          pinned[p.leg.key] = p.date;
        }
        pool = [...pool, ...unlockable.filter((l) => !pool.includes(l))];
        try {
          const passB = await runSolve(pool, pinned, PRIMARY_CAP_H, { pairs: true });
          if (passB) {
            const after = readSolution(passB.solution, passB.meta, legsById);
            const placedKeys = new Set(after.placed.map((p) => p.leg.key));
            // A pinned collection crowded out in pass B invalidates its delivery.
            displaced = Object.keys(pinned).filter((k) => !placedKeys.has(k)).map((k) => legsById[legs.find((l) => l.key === k)!.jobId]);
            if (displaced.length === 0) { current = after; passA = passB; }
          }
        } catch (e) {
          console.error('pass B failed', (e as Error).message);
        }
      }
    }

    /* ------------------------------ grace pass ----------------------------- */

    // Expiring jobs were prioritised up front; if any still didn't fit on
    // their own dates, give them one more chance to land on a later day
    // inside the same window instead of lapsing overnight.
    const gracePlaced = new Set<string>();
    try {
      const assignedNow = new Set(current.placed.map((p) => p.leg.key));
      const collectedOnGrace: Record<string, string> = {};
      for (const p of current.placed) {
        if (p.leg.legType === 'collection') collectedOnGrace[p.leg.orderId] = p.date;
      }
      const gracePool: { leg: Leg; dates: string[] }[] = [];
      for (const leg of legs) {
        if (leg.lapsed || !leg.expiringInPlan || assignedNow.has(leg.key)) continue;
        if (leg.guaranteedDate) continue; // guaranteed jobs never slide off their date
        const maxReal = leg.windowDates[leg.windowDates.length - 1] ?? leg.lastDate;
        if (!maxReal) continue;
        let extended = [...leg.windowDates, ...selectedDates.filter((d) => d > maxReal)];
        // A delivery cannot happen before its bike is collected (plus lead).
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
        if (extended.length === leg.windowDates.length) continue; // nothing new to spill onto
        gracePool.push({ leg, dates: extended });
      }
      if (gracePool.length > 0) {
        // Leftover capacity: shrink each already-used van-day by what it is
        // already carrying; unused van-days are offered in full.
        const usedByVanDay: Record<string, { spaces: number; hours: number }> = {};
        for (const { meta: m, route, stops } of current.routeInfo) {
          const k = `${m.date}:${m.vanId}:${m.expedition ? 2 : 1}`;
          const u = usedByVanDay[k] ??= { spaces: 0, hours: 0 };
          for (const s of stops) u.spaces += s.leg.spaces;
          u.hours += ((Number(route.duration) || 0) + (Number(route.service) || 0) + (Number(route.waiting_time) || 0)) / 3600;
        }
        const graceDates = [...new Set(gracePool.flatMap((g) => g.dates))].sort();
        const difficultGrace = new Set(gracePool.flatMap((g) => (g.leg.difficult ? g.dates : [])));
        const vehicles: any[] = [];
        const meta: Record<number, VanDay> = {};
        graceDates.forEach((date, dayIdx) => {
          const shiftOpen = londonEpoch(date, shiftStart);
          (vansForDate[date] ?? []).forEach((van, vanIdx) => {
            const push = (kind: 1 | 2, capHours: number) => {
              const used = usedByVanDay[`${date}:${van.id}:${kind}`];
              const remUnits = Math.round(van.capacity * 10) - Math.round((used?.spaces ?? 0) * 10);
              const remH = capHours - (used?.hours ?? 0);
              if (remUnits <= 0 || remH < 0.5) return;
              const id = dayIdx * 10000 + vanIdx * 100 + kind;
              vehicles.push({
                id, profile: 'car',
                start: [DEPOT.lon, DEPOT.lat], end: [DEPOT.lon, DEPOT.lat],
                capacity: [remUnits],
                time_window: [shiftOpen, shiftOpen + remH * HOURS],
                max_travel_time: Math.max(HOURS, remH * HOURS - HOURS),
                ...(kind === 2 ? { skills: [1] } : {}),
              });
              meta[id] = { vehicleId: id, date, vanId: van.id, vanName: van.name, capacity: van.capacity, expedition: kind === 2, virtual: false };
            };
            push(1, PRIMARY_CAP_H);
            if (difficultGrace.has(date)) push(2, EXPEDITION_CAP_H);
          });
        });
        if (vehicles.length > 0) {
          const jobs = gracePool
            .map((g) => buildJob(g.leg, g.dates))
            .filter((j): j is any => !!j);
          if (jobs.length > 0) {
            const solution = await postSolve({ vehicles, jobs, options: { g: true, x: 5 } });
            const read = readSolution(solution, meta, legsById);
            if (read.placed.length > 0) {
              for (const p of read.placed) gracePlaced.add(p.leg.key);
              current = {
                placed: [...current.placed, ...read.placed],
                routeInfo: [...current.routeInfo, ...read.routeInfo],
              };
              console.log('grace pass placed', read.placed.length, 'of', gracePool.length);
            }
          }
        }
      }
    } catch (e) {
      console.error('grace pass failed', (e as Error).message);
    }

    /* ------------------- extra-van what-if (separate call) ---------------- */

    // Only ever run on its own second call, so a heavy what-if can never break
    // the main Generate press. Nothing is saved on this path.
    const whatIf: { placedByDate: Record<string, number>; virtualByDate: Record<string, number>; urgentByDate: Record<string, number> } | null = null;

    if (shortfallOnly) {
      let wiResult = whatIf as any;
      try {
        // Day-by-day plans are deliberately unbalanced, so the "extra van"
        // what-if only applies to the balanced plan.
        const wi = mode === 'greedy' ? null : await runSolve(pool, pinned, PRIMARY_CAP_H, { withVirtual: true, pairs: true });
        if (wi) {
          const read = readSolution(wi.solution, wi.meta, legsById);
          const placedByDate: Record<string, number> = {};
          const virtualByDate: Record<string, number> = {};
          const urgentByDate: Record<string, number> = {};
          for (const { meta, stops } of read.routeInfo) {
            placedByDate[meta.date] = (placedByDate[meta.date] ?? 0) + stops.length;
            if (meta.virtual) {
              virtualByDate[meta.date] = (virtualByDate[meta.date] ?? 0) + 1;
              urgentByDate[meta.date] = (urgentByDate[meta.date] ?? 0) + stops.filter((s) => s.leg.priority >= 70).length;
            }
          }
          wiResult = { placedByDate, virtualByDate, urgentByDate };
        }
      } catch (e) {
        console.error('what-if solve failed', (e as Error).message);
      }
      const realByDate: Record<string, number> = {};
      for (const { meta, stops } of current.routeInfo) {
        realByDate[meta.date] = (realByDate[meta.date] ?? 0) + stops.length;
      }
      const shortfallByDate: Record<string, { extra_vans: number; extra_jobs: number; urgent: number } | null> = {};
      for (const date of selectedDates) {
        const extraVans = wiResult?.virtualByDate?.[date] ?? 0;
        shortfallByDate[date] = extraVans > 0 ? {
          extra_vans: extraVans,
          extra_jobs: Math.max(0, (wiResult?.placedByDate?.[date] ?? 0) - (realByDate[date] ?? 0)),
          urgent: wiResult?.urgentByDate?.[date] ?? 0,
        } : null;
      }
      return json({ mode, shortfall_by_date: shortfallByDate });
    }

    /* ------------------------------ persist ------------------------------- */

    // One active plan per way of planning, so balanced and day-by-day can sit
    // side by side.
    await admin.from('route_plans').update({ status: 'superseded' }).eq('status', 'active').eq('mode', mode);

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

    const assigned = new Set<string>();
    const routesByDate: Record<string, any[]> = {};

    // All routes in one write, then all their stops in one write.
    const prepared = current.routeInfo.map(({ meta, route, stops }) => {
      const dayIdx = selectedDates.indexOf(meta.date);
      const isProvisional = dayIdx >= firmDays;
      const ordered = [...stops].sort((a, b) => a.arrival - b.arrival);
      const steps = Array.isArray(route.steps) ? route.steps : [];
      const maxLoadUnits = Math.max(0, ...steps.map((s: any) => Number(s?.load?.[0]) || 0));
      const duration = (Number(route.duration) || 0) + (Number(route.service) || 0) + (Number(route.waiting_time) || 0);
      return {
        meta, ordered, isProvisional, duration,
        miles: Math.round(((Number(route.distance) || 0) / 1609.344) * 10) / 10,
        maxLoad: Math.round((maxLoadUnits / 10) * 100) / 100,
        geometry: typeof route.geometry === 'string' ? route.geometry : null,
      };
    });

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
          is_expedition: p.meta.expedition,
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
          is_expedition: p.meta.expedition,
          is_provisional: p.isProvisional,
          stop_count: p.ordered.length,
          duration_s: p.duration,
          miles: p.miles,
          max_load: p.maxLoad,
          van_capacity: p.meta.capacity,
          geometry: p.geometry,
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

    const days = selectedDates.map((date, idx) => {
      const dayRoutes = routesByDate[date] ?? [];
      const usedVans = new Set(dayRoutes.map((r) => r.van_id));
      const available = (vansForDate[date] ?? []).length;
      const virtualUsed = whatIf?.virtualByDate?.[date] ?? 0;
      return {
        date,
        vans_needed: usedVans.size,
        vans_available: available,
        van_names: [...usedVans].map((id) => (vansForDate[date] ?? []).find((v) => v.id === id)?.name).filter(Boolean),
        spare_vans: Math.max(0, available - usedVans.size),
        is_provisional: idx >= firmDays,
        shortfall: virtualUsed > 0 ? {
          extra_vans: virtualUsed,
          extra_jobs: Math.max(0, (whatIf?.placedByDate?.[date] ?? 0) - dayRoutes.reduce((n, r) => n + r.stop_count, 0)),
          urgent: whatIf?.urgentByDate?.[date] ?? 0,
        } : null,
        variants: [{ variant: 'primary', routes: dayRoutes, tradeoff_note: null }],
        // Jobs that could have run on this day but were left out of every route.
        unplanned_count: legs.filter((l) => !assigned.has(l.key) && !l.lapsed && l.windowDates.includes(date)).length,
        unplanned_lapsed_count: legs.filter((l) => !assigned.has(l.key) && l.lapsed && l.windowDates.includes(date)).length,
        lapsed_count: current.routeInfo.flatMap((r) => r.stops).filter((s) => s.date === date && s.leg.lapsed).length,
        expiring_count: legs.filter((l) => !l.lapsed && l.lastDate === date).length,
        expiring_unplanned_count: legs.filter((l) => !l.lapsed && l.lastDate === date && !assigned.has(l.key)).length,
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
        reason: l.lapsed ? 'dates had expired — planned via the expired-jobs override'
          : l.expiringInPlan ? 'its last available date was full and there was no room later in the plan'
          : displaced.some((d) => d?.key === l.key) ? 'pushed out when deliveries were added'
          : l.guaranteedDate ? 'guaranteed date could not be met'
          : l.needsUnlock ? 'waiting on its collection being planned'
          : 'no feasible slot on the days you picked',
      }));

    const vanDaysAvailable = selectedDates.reduce((n, d) => n + (vansForDate[d] ?? []).length, 0);
    const vanDaysNeeded = days.reduce((n, d) => n + d.vans_needed, 0);
    const shortDays = days.filter((d) => d.shortfall).map((d) => d.date);

    await admin.from('route_plans').update({
      shortfall: { van_days_available: vanDaysAvailable, van_days_needed: vanDaysNeeded, short_days: shortDays },
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
      // The "an extra van would plan N more jobs" figures load on a second call.
      shortfall_pending: mode !== 'greedy',
      days,
      at_risk: atRisk,
      needs_new_dates: needsNewDates.sort((a, b) => a.severity - b.severity),
      vans: allVans,
      weekly: { van_days_available: vanDaysAvailable, van_days_needed: vanDaysNeeded, short_days: shortDays },
    });
  } catch (e) {
    console.error('route-optimize error', (e as Error)?.message);
    return json({ error: (e as Error)?.message ?? 'unexpected error' }, 500);
  }
});
