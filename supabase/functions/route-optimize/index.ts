// Generates van routes for a date range using the Verso hosted VROOM API.
// Server-side only: Verso credentials never leave the edge function.
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
const PRIMARY_CAP_H = 12;
const EXPEDITION_CAP_H = 15;
const DEFAULT_CAPACITY = 10;
const STAFF_ROLES = ['admin', 'sales', 'route_planner'];

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

const dateKey = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length < 10) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);
};

const datesInRange = (start: string, end: string): string[] => {
  const out: string[] = [];
  let cur = Date.parse(`${start}T12:00:00Z`);
  const last = Date.parse(`${end}T12:00:00Z`);
  if (isNaN(cur) || isNaN(last) || last < cur) return out;
  while (cur <= last && out.length < 31) {
    out.push(new Date(cur).toISOString().slice(0, 10));
    cur += 86_400_000;
  }
  return out;
};

const daysUntil = (dateStr: string): number => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const diff = (Date.parse(`${dateStr}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000;
  return Math.max(1, Math.round(diff));
};

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const weekdayKey = (dateStr: string) => {
  const idx = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0=Sun
  return DAY_KEYS[(idx + 6) % 7];
};

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
  orderId: string;
  legType: 'collection' | 'delivery';
  lat: number;
  lon: number;
  spaces: number;
  availableDates: string[];
  guaranteedDate: string | null;
  priority: number;
  difficult: boolean;
  businessHours: Record<string, any> | null;
  label: string;
  unlockAfter: string | null; // delivery only: earliest date (exclusive) once collection is planned
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const VERSO_API_URL = Deno.env.get('VERSO_API_URL');
    const VERSO_API_KEY = Deno.env.get('VERSO_API_KEY');
    if (!VERSO_API_URL || !VERSO_API_KEY) return json({ error: 'Verso credentials not configured' }, 500);

    /* Resolve the solve endpoint from whatever shape the setting was saved in. */
    const solveUrl = (() => {
      const raw = VERSO_API_URL.trim().replace(/\/(?=\?|$)/, '');
      let url: URL;
      try { url = new URL(raw); } catch { return raw; }
      if (!/\/solve$/i.test(url.pathname)) {
        url.pathname = `${url.pathname.replace(/\/$/, '')}/solve`;
      }
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

    const body = await req.json().catch(() => ({}));
    const horizonStart = typeof body?.horizon_start === 'string' ? body.horizon_start : '';
    const horizonEnd = typeof body?.horizon_end === 'string' ? body.horizon_end : horizonStart;
    const shiftStart = /^\d{2}:\d{2}$/.test(body?.shift_start ?? '') ? body.shift_start : '09:00';
    const vanIds: string[] = Array.isArray(body?.van_ids) ? body.van_ids.filter((v: unknown) => typeof v === 'string') : [];
    const assumeNextDayInspection = body?.assume_next_day_inspection === true;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(horizonStart) || !/^\d{4}-\d{2}-\d{2}$/.test(horizonEnd)) {
      return json({ error: 'horizon_start and horizon_end must be YYYY-MM-DD' }, 400);
    }
    const horizon = datesInRange(horizonStart, horizonEnd);
    if (horizon.length === 0) return json({ error: 'invalid date range' }, 400);

    /* ---------------------------- reference data --------------------------- */

    const [spacesRes, settingsRes, areasRes, vehiclesRes] = await Promise.all([
      admin.from('bike_type_spaces').select('bike_type,spaces'),
      admin.from('workshop_settings').select('van_spaces_capacity').eq('id', 1).maybeSingle(),
      admin.rpc('difficult_areas_geojson'),
      admin.from('vehicles').select('id,registration,make,bike_spaces,status'),
    ]);

    const spaceMap: Record<string, number> = {};
    for (const row of (spacesRes.data as any[]) || []) spaceMap[row.bike_type] = Number(row.spaces);
    const defaultCapacity = Number((settingsRes.data as any)?.van_spaces_capacity) > 0
      ? Number((settingsRes.data as any).van_spaces_capacity) : DEFAULT_CAPACITY;

    const areaRings: Ring[] = [];
    for (const area of (areasRes.data as any[]) || []) {
      const coords = area?.geojson?.coordinates;
      if (Array.isArray(coords)) for (const ring of coords) if (Array.isArray(ring)) areaRings.push(ring as Ring);
    }
    const inDifficultArea = (lat: number, lon: number) => areaRings.some((r) => pointInRing(lon, lat, r));

    const allVans = ((vehiclesRes.data as any[]) || []).filter((v) => v.status !== 'sold' && v.status !== 'off_road');
    const vans = (vanIds.length > 0 ? allVans.filter((v) => vanIds.includes(v.id)) : allVans).map((v) => ({
      id: v.id as string,
      name: (v.registration || v.make || 'Van') as string,
      capacity: Number(v.bike_spaces) > 0 ? Number(v.bike_spaces) : defaultCapacity,
    }));
    if (vans.length === 0) return json({ error: 'No vans available for planning' }, 400);

    /* ------------------------------- orders ------------------------------- */

    const { data: orderRows, error: ordersErr } = await admin
      .from('orders')
      .select('id,tracking_number,user_id,status,sender,receiver,bikes,bike_type,bike_quantity,pickup_date,delivery_date,scheduled_pickup_date,scheduled_delivery_date,order_collected,order_delivered,needs_inspection,is_box_my_bike,ni_direction,guaranteed_delivery,guaranteed_delivery_date,bicycle_inspections(status)')
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
      .select('order_id,leg_type,route_plan_routes!inner(selected)')
      .eq('route_plan_routes.selected', true);
    const locked = new Set(((lockedRows as any[]) || []).map((r) => `${r.order_id}:${r.leg_type}`));

    const horizonSet = new Set(horizon);
    const legs: Leg[] = [];

    for (const order of ((orderRows as any[]) || [])) {
      if (order.ni_direction) continue; // NI / ferry work stays manual
      const status = String(order.status || '');
      if (status === 'cancelled' || status === 'on_hold' || status === 'pending_approval') continue;

      const spaces = orderSpaces(order, spaceMap);
      const inspectionStatus = (order.bicycle_inspections as any[] | null)?.[0]?.status ?? null;
      const inspectionDone = inspectionStatus === 'inspected' || inspectionStatus === 'repaired';

      const pickupDates = [...new Set((Array.isArray(order.pickup_date) ? order.pickup_date : [])
        .map(dateKey).filter((d): d is string => !!d))];
      const deliveryDates = [...new Set((Array.isArray(order.delivery_date) ? order.delivery_date : [])
        .map(dateKey).filter((d): d is string => !!d))];

      const label = `${order.tracking_number || order.id.slice(0, 8)}`;
      const businessHours = hoursByUser[order.user_id] ?? null;

      const buildPriority = (available: string[], guaranteed: string | null) => {
        if (guaranteed) return 100;
        const R = Math.max(1, available.length);
        const D = Math.max(1, Math.min(...available.map(daysUntil)));
        return Math.max(1, Math.min(99, Math.round(60 / R + 40 / D)));
      };

      // Collection leg
      if (!order.order_collected && !order.scheduled_pickup_date && !locked.has(`${order.id}:collection`)) {
        const lat = Number(order.sender?.address?.lat);
        const lon = Number(order.sender?.address?.lon);
        const inHorizon = pickupDates.filter((d) => horizonSet.has(d));
        if (Number.isFinite(lat) && Number.isFinite(lon) && inHorizon.length > 0) {
          legs.push({
            key: `${order.id}:collection`, orderId: order.id, legType: 'collection',
            lat, lon, spaces, availableDates: inHorizon,
            guaranteedDate: null,
            priority: buildPriority(pickupDates.length ? pickupDates : inHorizon, null),
            difficult: inDifficultArea(lat, lon), businessHours, label, unlockAfter: null,
          });
        }
      }

      // Delivery leg
      const deliveryEligible = !order.order_delivered && !order.scheduled_delivery_date && !order.is_box_my_bike
        && !locked.has(`${order.id}:delivery`)
        && (!order.needs_inspection || inspectionDone);
      if (deliveryEligible) {
        const lat = Number(order.receiver?.address?.lat);
        const lon = Number(order.receiver?.address?.lon);
        const inHorizon = deliveryDates.filter((d) => horizonSet.has(d));
        const guaranteed = order.guaranteed_delivery && order.guaranteed_delivery_date
          ? dateKey(order.guaranteed_delivery_date) : null;
        const dates = guaranteed && horizonSet.has(guaranteed) ? [guaranteed] : inHorizon;
        // Not collected yet: only schedulable after its collection is planned (and only when
        // inspection isn't required, unless the dispatcher assumes same-day turnaround).
        const needsUnlock = !order.order_collected;
        const unlockAllowed = !order.needs_inspection || assumeNextDayInspection;
        if (Number.isFinite(lat) && Number.isFinite(lon) && dates.length > 0 && (!needsUnlock || unlockAllowed)) {
          legs.push({
            key: `${order.id}:delivery`, orderId: order.id, legType: 'delivery',
            lat, lon, spaces, availableDates: dates,
            guaranteedDate: guaranteed,
            priority: buildPriority(guaranteed ? [guaranteed] : (deliveryDates.length ? deliveryDates : dates), guaranteed),
            difficult: inDifficultArea(lat, lon), businessHours, label,
            unlockAfter: needsUnlock ? `${order.id}:collection` : null,
          });
        }
      }
    }

    /* ------------------------------ the plan ------------------------------ */

    const { data: planRow, error: planErr } = await admin.from('route_plans').insert({
      horizon_start: horizonStart,
      horizon_end: horizonEnd,
      shift_start: shiftStart,
      assume_next_day_inspection: assumeNextDayInspection,
      created_by: userData.user.id,
      status: 'draft',
    }).select('id').single();
    if (planErr) throw planErr;
    const planId = planRow.id as string;

    const assigned = new Set<string>();           // leg keys already placed
    const collectionPlannedOn: Record<string, string> = {}; // "orderId:collection" -> date
    const days: any[] = [];

    for (const date of horizon) {
      const shiftOpen = londonEpoch(date, shiftStart);
      const weekday = weekdayKey(date);

      const pool = legs.filter((leg) => {
        if (assigned.has(leg.key)) return false;
        if (leg.guaranteedDate) return leg.guaranteedDate === date;
        if (!leg.availableDates.includes(date)) return false;
        if (leg.unlockAfter) {
          const plannedOn = collectionPlannedOn[leg.unlockAfter];
          if (!plannedOn || plannedOn >= date) return false;
        }
        return true;
      });

      if (pool.length === 0) {
        days.push({ date, vans_needed: 0, vans_available: vans.length, van_names: [], variants: [{ variant: 'primary', routes: [], tradeoff_note: null }], infeasible_guaranteed: [] });
        continue;
      }

      const hasDifficult = pool.some((l) => l.difficult);

      const vehicles: any[] = [];
      const vehicleMeta: Record<number, { vanId: string; vanName: string; capacity: number; expedition: boolean }> = {};
      // Workload balancing: cap pure driving time so one van can't absorb a
      // disproportionate share of the day while others sit idle. Leave ~2h of
      // the shift for service time and depot handling.
      const primaryTravelCap = Math.max(2 * HOURS, (PRIMARY_CAP_H - 2) * HOURS);
      const expeditionTravelCap = Math.max(2 * HOURS, (EXPEDITION_CAP_H - 2) * HOURS);
      let vid = 1;
      for (const van of vans) {
        const capUnits = Math.max(1, Math.round(van.capacity * 10));
        vehicles.push({
          id: vid, profile: 'car',
          start: [DEPOT.lon, DEPOT.lat], end: [DEPOT.lon, DEPOT.lat],
          capacity: [capUnits],
          time_window: [shiftOpen, shiftOpen + PRIMARY_CAP_H * HOURS],
          max_travel_time: primaryTravelCap,
          speed_factor: 0.95,
          costs: { fixed: 3600 },
        });
        vehicleMeta[vid] = { vanId: van.id, vanName: van.name, capacity: van.capacity, expedition: false };
        vid++;

        if (hasDifficult) {
          vehicles.push({
            id: vid, profile: 'car',
            start: [DEPOT.lon, DEPOT.lat], end: [DEPOT.lon, DEPOT.lat],
            capacity: [capUnits],
            time_window: [shiftOpen, shiftOpen + EXPEDITION_CAP_H * HOURS],
            max_travel_time: expeditionTravelCap,
            skills: [1],
            speed_factor: 0.95,
            costs: { fixed: 7200 },
          });
          vehicleMeta[vid] = { vanId: van.id, vanName: van.name, capacity: van.capacity, expedition: true };
          vid++;
        }
      }

      const jobMeta: Record<number, Leg> = {};
      const jobs = pool.map((leg, idx) => {
        const jid = idx + 1;
        jobMeta[jid] = leg;
        let window: [number, number] = [shiftOpen, shiftOpen + EXPEDITION_CAP_H * HOURS];
        const day = leg.businessHours?.[weekday];
        if (day && day.open && !day.is24h && day.start && day.end) {
          const open = londonEpoch(date, day.start);
          const close = londonEpoch(date, day.end) - SERVICE_S;
          if (close > open) window = [Math.max(open, shiftOpen), close];
        } else if (day && day.open === false) {
          window = [shiftOpen, shiftOpen]; // closed: effectively unschedulable today
        }
        const load = [Math.max(1, Math.round(leg.spaces * 10))];
        return {
          id: jid,
          location: [leg.lon, leg.lat],
          service: SERVICE_S,
          priority: leg.priority,
          time_windows: [window],
          ...(leg.legType === 'delivery' ? { delivery: load } : { pickup: load }),
          ...(leg.difficult ? { skills: [1] } : {}),
        };
      });

      const payload = { vehicles, jobs, options: { g: true } };
      const started = Date.now();
      const resp = await fetch(solveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VERSO_API_KEY}`, 'X-Api-Key': VERSO_API_KEY },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const detail = (await resp.text()).slice(0, 300);
        await admin.from('route_plans').delete().eq('id', planId);
        console.error('verso call failed', { status: resp.status, date });
        return json({ error: `Route optimiser failed (${resp.status}): ${detail}`, status: resp.status, detail }, 502);
      }
      const solution = await resp.json();
      console.log('verso solve', { date, jobs: jobs.length, vehicles: vehicles.length, ms: Date.now() - started, unassigned: (solution?.unassigned || []).length });

      const routes = Array.isArray(solution?.routes) ? solution.routes : [];
      const usedVans = new Set<string>();
      const dayRoutes: any[] = [];

      for (const route of routes) {
        const meta = vehicleMeta[Number(route.vehicle)];
        if (!meta) continue;
        const steps = Array.isArray(route.steps) ? route.steps : [];
        const stops = steps
          .filter((s: any) => s.type === 'job' && jobMeta[Number(s.job)])
          .map((s: any, i: number) => {
            const leg = jobMeta[Number(s.job)];
            return {
              seq: i + 1,
              leg_type: leg.legType,
              order_id: leg.orderId,
              eta: isoFromEpoch(Number(s.arrival) || shiftOpen),
              service_s: SERVICE_S,
              lat: leg.lat, lon: leg.lon,
              is_difficult_area: leg.difficult,
              label: leg.label,
              guaranteed: !!leg.guaranteedDate,
            };
          });
        if (stops.length === 0) continue;

        usedVans.add(meta.vanId);
        const maxLoadUnits = Math.max(0, ...steps.map((s: any) => Number(s?.load?.[0]) || 0));
        const { data: routeRow, error: routeErr } = await admin.from('route_plan_routes').insert({
          plan_id: planId,
          route_date: date,
          variant: 'primary',
          van_id: meta.vanId,
          van_name: meta.vanName,
          is_expedition: meta.expedition,
          total_miles: Math.round(((Number(route.distance) || 0) / 1609.344) * 10) / 10,
          total_duration_s: (Number(route.duration) || 0) + (Number(route.service) || 0) + (Number(route.waiting_time) || 0),
          stop_count: stops.length,
          max_load: Math.round((maxLoadUnits / 10) * 100) / 100,
          van_capacity: meta.capacity,
          geometry: typeof route.geometry === 'string' ? route.geometry : null,
        }).select('id').single();
        if (routeErr) throw routeErr;

        const { error: stopsErr } = await admin.from('route_plan_stops').insert(
          stops.map((s: any) => ({
            route_id: routeRow.id, seq: s.seq, leg_type: s.leg_type, order_id: s.order_id,
            eta: s.eta, service_s: SERVICE_S, lat: s.lat, lon: s.lon, is_difficult_area: s.is_difficult_area,
          })),
        );
        if (stopsErr) throw stopsErr;

        for (const s of stops) {
          assigned.add(`${s.order_id}:${s.leg_type}`);
          if (s.leg_type === 'collection') collectionPlannedOn[`${s.order_id}:collection`] = date;
        }

        dayRoutes.push({
          route_id: routeRow.id,
          van_id: meta.vanId,
          van_name: meta.vanName,
          is_expedition: meta.expedition,
          stop_count: stops.length,
          duration_s: (Number(route.duration) || 0) + (Number(route.service) || 0) + (Number(route.waiting_time) || 0),
          miles: Math.round(((Number(route.distance) || 0) / 1609.344) * 10) / 10,
          max_load: Math.round((maxLoadUnits / 10) * 100) / 100,
          van_capacity: meta.capacity,
          geometry: typeof route.geometry === 'string' ? route.geometry : null,
          guaranteed_count: stops.filter((s: any) => s.guaranteed).length,
          stops,
        });
      }

      const unassignedIds = new Set(((solution?.unassigned || []) as any[]).map((u) => Number(u.id)));
      const infeasibleGuaranteed = pool
        .filter((l) => l.guaranteedDate === date && !assigned.has(l.key))
        .map((l) => ({ order_id: l.orderId, label: l.label, leg_type: l.legType, date }));

      days.push({
        date,
        vans_needed: usedVans.size,
        vans_available: vans.length,
        van_names: [...usedVans].map((id) => vans.find((v) => v.id === id)?.name).filter(Boolean),
        variants: [{ variant: 'primary', routes: dayRoutes, tradeoff_note: null }],
        infeasible_guaranteed: infeasibleGuaranteed,
        unassigned_today: unassignedIds.size,
      });
    }

    const atRisk = legs
      .filter((l) => !assigned.has(l.key))
      .sort((a, b) => b.priority - a.priority)
      .map((l) => ({
        order_id: l.orderId,
        label: l.label,
        leg_type: l.legType,
        priority: l.priority,
        remaining_dates: l.availableDates.length,
        guaranteed_date: l.guaranteedDate,
        reason: l.guaranteedDate ? 'guaranteed date could not be met'
          : l.unlockAfter ? 'waiting on its collection being planned'
          : 'no feasible slot in this range',
      }));

    return json({ plan_id: planId, days, at_risk: atRisk, vans: vans.map((v) => ({ id: v.id, name: v.name, capacity: v.capacity })) });
  } catch (e) {
    console.error('route-optimize error', (e as Error)?.message);
    return json({ error: (e as Error)?.message ?? 'unexpected error' }, 500);
  }
});
