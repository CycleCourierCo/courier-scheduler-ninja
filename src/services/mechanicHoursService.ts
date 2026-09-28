import { supabase } from '@/integrations/supabase/client';

export type StandardMinutesSource = 'catalogue' | 'labour_cost' | 'default' | 'inspection' | 'box_foam';

export const BOX_FOAM_MINUTES = 45;

/** A boxed/foamed job with no mechanic to credit. */
export interface UnallocatedBoxFoamJob {
  orderId: string;
  kind: 'box' | 'foam';
  tracking: string;
  bike: string;
  doneAt: string;
}

export interface MechanicJobRow {
  id: string;
  type: 'inspection' | 'repair' | 'box' | 'foam';
  label: string;
  minutes: number;
  source: StandardMinutesSource;
}

/** One job that was sitting in the workshop queue on a given day. */
export interface QueueItem {
  id: string;
  kind: 'inspect' | 'repair';
  label: string;
  /** Day it became available (YYYY-MM-DD). */
  since: string;
  /** Day it was closed off (inspected / resolved), if it was. */
  closedOn: string | null;
  minutes: number;
  source: StandardMinutesSource;
}

export interface MechanicHoursDaily {
  date: string;
  label: string;
  hours: number;
  standardHours: number;
  varianceHours: number;
  efficiencyPct: number;
  inspections: number;
  repairs: number;
  jobsPerHour: number;
  /** Jobs sitting in the workshop queue that day (awaiting inspection / awaiting repair). */
  availableJobs: number;
  /** Standard hours those queued jobs were worth. */
  hoursPossible: number;
  /** The individual jobs that made up that day's queue. */
  queueItems: QueueItem[];
}

export interface MechanicDayBreakdown {
  date: string;
  label: string;
  hours: number;
  standardHours: number;
  varianceHours: number;
  jobs: MechanicJobRow[];
  /** Workshop-wide queue that day. */
  availableJobs: number;
  hoursPossible: number;
  /** This mechanic's even share of that day's queue. */
  availableJobsShare: number;
  hoursPossibleShare: number;
  /** The workshop-wide jobs that made up that day's queue. */
  queueItems: QueueItem[];
}

export interface MechanicHoursPerMechanic {
  mechanicId: string;
  name: string;
  hours: number;
  standardHours: number;
  varianceHours: number;
  efficiencyPct: number;
  inspections: number;
  repairs: number;
  boxed: number;
  foamed: number;
  jobsPerHour: number;
  minutesPerJob: number;
  availableJobsShare: number;
  hoursPossibleShare: number;
  utilisationPct: number;
  days: MechanicDayBreakdown[];
}

export interface MechanicHoursResult {
  daily: MechanicHoursDaily[];
  unallocatedBoxFoam: UnallocatedBoxFoamJob[];
  perMechanic: MechanicHoursPerMechanic[];
  totals: {
    hours: number;
    standardHours: number;
    varianceHours: number;
    efficiencyPct: number;
    inspections: number;
    repairs: number;
    jobsPerHour: number;
    minutesPerJob: number;
    catalogueCoveragePct: number;
    availableJobs: number;
    hoursPossible: number;
  };
  settings: {
    hourlyRate: number;
    inspectionMinutes: number;
    defaultRepairMinutes: number;
  };
}

/** Bucket an ISO timestamp into a Europe/London YYYY-MM-DD day key. */
const londonDay = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  // en-CA gives YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
};

const labelFor = (dayKey: string): string => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Inclusive list of YYYY-MM-DD keys between two day keys. */
const dayKeysBetween = (fromKey: string, toKey: string): string[] => {
  const keys: string[] = [];
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const cursor = new Date(Date.UTC(fy, (fm || 1) - 1, fd || 1));
  let guard = 0;
  while (guard++ < 1000) {
    const key = cursor.toISOString().slice(0, 10);
    if (key > toKey) break;
    keys.push(key);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
};

/** Fetch every row of a query, paging past the 1,000-row cap. */
const fetchAll = async <T>(build: (from: number, to: number) => any): Promise<T[]> => {
  const pageSize = 1000;
  const out: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
};

const sel = (s: string): string => s;

/**
 * Compare mechanic clocked hours per day with the "standard" (earned) hours the
 * work completed that day is worth, plus the work that was actually available
 * (awaiting inspection / awaiting repair) on each day.
 */
export async function getMechanicHours(fromISO: string, toISO: string): Promise<MechanicHoursResult> {
  const dateFrom = fromISO.slice(0, 10);
  const dateTo = toISO.slice(0, 10);

  const [slipsRes, inspectionsRes, issuesRes, settingsRes, openInspections, openIssues] = await Promise.all([
    supabase
      .from('mechanic_timeslips')
      .select('driver_id, date, total_hours, status, driver:profiles!mechanic_timeslips_driver_id_fkey(id,name,email)')
      .in('status', ['closed', 'approved'])
      .gte('date', dateFrom)
      .lte('date', dateTo),
    supabase
      .from('bicycle_inspections')
      .select('id, inspected_at, inspected_by_id, inspected_by_name, bike_type')
      .not('inspected_at', 'is', null)
      .gte('inspected_at', fromISO)
      .lte('inspected_at', toISO),
    supabase
      .from('inspection_issues')
      .select('id, resolved_at, resolved_by_id, resolved_by_name, status, repair_id, labour_cost, issue_description, labour:labour_times!inspection_issues_repair_id_fkey(repair_id,repair_name,labour_minutes)')
      .in('status', ['resolved', 'repaired'])
      .not('resolved_at', 'is', null)
      .gte('resolved_at', fromISO)
      .lte('resolved_at', toISO),
    supabase
      .from('workshop_settings')
      .select('hourly_rate_gbp, inspection_standard_minutes, default_repair_minutes')
      .eq('id', 1)
      .maybeSingle(),
    // Inspections that were open (created, not yet inspected) at some point in range
    fetchAll<any>((f, t) =>
      supabase
        .from('bicycle_inspections')
        .select(sel('id, created_at, inspected_at, order_id, bike_brand, bike_model, reference, bike_type'))
        .lte('created_at', toISO)
        .or(`inspected_at.is.null,inspected_at.gte.${fromISO}`)
        .order('created_at', { ascending: true })
        .range(f, t),
    ),
    // Approved issues whose parts were ready and that were open at some point in range
    fetchAll<any>((f, t) =>
      supabase
        .from('inspection_issues')
        .select(
          sel('id, inspection_id, status, parts_arrived_at, parts_in_stock_at, resolved_at, repair_id, labour_cost, issue_description, labour:labour_times!inspection_issues_repair_id_fkey(labour_minutes,repair_name)'),
        )
        .in('status', ['approved', 'resolved', 'repaired'])
        .or(`resolved_at.is.null,resolved_at.gte.${fromISO}`)
        .or('parts_arrived_at.not.is.null,parts_in_stock_at.not.is.null')
        .order('id', { ascending: true })
        .range(f, t),
    ),
  ]);

  if (slipsRes.error) throw slipsRes.error;
  if (inspectionsRes.error) throw inspectionsRes.error;
  if (issuesRes.error) throw issuesRes.error;

  const hourlyRate = Number(settingsRes.data?.hourly_rate_gbp ?? 75) || 75;
  const inspectionMinutes = Number(settingsRes.data?.inspection_standard_minutes ?? 30) || 0;
  const defaultRepairMinutes = Number(settingsRes.data?.default_repair_minutes ?? 30) || 0;

  const repairMinutesFor = (row: any): { minutes: number; source: StandardMinutesSource } => {
    const catalogueMinutes = Number(row.labour?.labour_minutes ?? 0);
    const labourCost = Number(row.labour_cost ?? 0);
    if (catalogueMinutes > 0) return { minutes: catalogueMinutes, source: 'catalogue' };
    if (labourCost > 0 && hourlyRate > 0) return { minutes: (labourCost / hourlyRate) * 60, source: 'labour_cost' };
    return { minutes: defaultRepairMinutes, source: 'default' };
  };

  interface DayAgg {
    hours: number;
    standardMinutes: number;
    inspections: number;
    repairs: number;
    availableJobs: number;
    availableMinutes: number;
    queueItems: QueueItem[];
  }
  const QUEUE_ITEM_CAP = 300;
  const dayMap = new Map<string, DayAgg>();
  const ensureDay = (key: string): DayAgg => {
    let entry = dayMap.get(key);
    if (!entry) {
      entry = {
        hours: 0,
        standardMinutes: 0,
        inspections: 0,
        repairs: 0,
        availableJobs: 0,
        availableMinutes: 0,
        queueItems: [],
      };
      dayMap.set(key, entry);
    }
    return entry;
  };

  // Seed every day in the requested range so queue-only days still appear.
  const rangeDays = dayKeysBetween(dateFrom, dateTo);
  rangeDays.forEach((k) => ensureDay(k));

  // ---- Available work per day (queue) ----
  const addAvailability = (
    openedDay: string | null,
    closedDay: string | null,
    minutes: number,
    item: Omit<QueueItem, 'since' | 'closedOn' | 'minutes'>,
  ) => {
    if (!openedDay) return;
    for (const key of rangeDays) {
      if (key < openedDay) continue;
      if (closedDay && key > closedDay) continue;
      const d = ensureDay(key);
      d.availableJobs += 1;
      d.availableMinutes += minutes;
      if (d.queueItems.length < QUEUE_ITEM_CAP) {
        d.queueItems.push({
          ...item,
          since: openedDay,
          closedOn: closedDay,
          minutes: Math.round(minutes),
        });
      }
    }
  };

  // Bike labels for the inspections behind the queued repairs.
  const issueInspectionIds = Array.from(
    new Set((openIssues || []).map((i: any) => i.inspection_id).filter((v: any): v is string => !!v)),
  );
  const inspectionLabelById = new Map<string, string>();
  (openInspections || []).forEach((i: any) => {
    const label = [i.bike_brand, i.bike_model].filter(Boolean).join(' ').trim();
    if (label) inspectionLabelById.set(i.id, label);
  });
  const missingLabelIds = issueInspectionIds.filter((id) => !inspectionLabelById.has(id));
  for (let i = 0; i < missingLabelIds.length; i += 200) {
    const chunk = missingLabelIds.slice(i, i + 200);
    const { data: rows } = await supabase
      .from('bicycle_inspections')
      .select('id, bike_brand, bike_model, reference')
      .in('id', chunk);
    (rows || []).forEach((r: any) => {
      const label = [r.bike_brand, r.bike_model].filter(Boolean).join(' ').trim() || r.reference || '';
      if (label) inspectionLabelById.set(r.id, label);
    });
  }

  (openInspections || []).forEach((i: any) => {
    const bike =
      [i.bike_brand, i.bike_model].filter(Boolean).join(' ').trim() ||
      i.reference ||
      i.bike_type ||
      'Bike';
    addAvailability(londonDay(i.created_at), londonDay(i.inspected_at), inspectionMinutes, {
      id: i.id,
      kind: 'inspect',
      label: bike,
      source: 'inspection',
    });
  });

  (openIssues || []).forEach((iss: any) => {
    const readyCandidates = [iss.parts_arrived_at, iss.parts_in_stock_at]
      .map((v) => londonDay(v))
      .filter((v): v is string => !!v);
    if (readyCandidates.length === 0) return;
    const readyDay = readyCandidates.sort()[0];
    const { minutes, source } = repairMinutesFor(iss);
    const repairName = iss.labour?.repair_name || iss.issue_description || 'Repair';
    const bike = iss.inspection_id ? inspectionLabelById.get(iss.inspection_id) : null;
    addAvailability(readyDay, londonDay(iss.resolved_at), minutes, {
      id: iss.id,
      kind: 'repair',
      label: bike ? `${repairName} — ${bike}` : repairName,
      source,
    });
  });

  interface MechAgg extends Omit<MechanicHoursPerMechanic, 'days'> {
    standardMinutes: number;
    dayMap: Map<string, { hours: number; standardMinutes: number; jobs: MechanicJobRow[] }>;
  }
  const mechMap = new Map<string, MechAgg>();
  const ensureMech = (id: string, name: string | null | undefined): MechAgg => {
    let row = mechMap.get(id);
    if (!row) {
      row = {
        mechanicId: id,
        name: name || 'Unknown mechanic',
        hours: 0,
        standardHours: 0,
        varianceHours: 0,
        efficiencyPct: 0,
        inspections: 0,
        repairs: 0,
        boxed: 0,
        foamed: 0,
        jobsPerHour: 0,
        minutesPerJob: 0,
        availableJobsShare: 0,
        hoursPossibleShare: 0,
        utilisationPct: 0,
        standardMinutes: 0,
        dayMap: new Map(),
      };
      mechMap.set(id, row);
    } else if ((!row.name || row.name === 'Unknown mechanic') && name) {
      row.name = name;
    }
    return row;
  };
  const ensureMechDay = (mech: MechAgg, key: string) => {
    let d = mech.dayMap.get(key);
    if (!d) {
      d = { hours: 0, standardMinutes: 0, jobs: [] };
      mech.dayMap.set(key, d);
    }
    return d;
  };

  (slipsRes.data || []).forEach((s: any) => {
    const key = typeof s.date === 'string' ? s.date.slice(0, 10) : null;
    const hours = Number(s.total_hours || 0);
    if (key) ensureDay(key).hours += hours;
    if (s.driver_id) {
      const name = s.driver?.name || s.driver?.email || null;
      const mech = ensureMech(s.driver_id, name);
      mech.hours += hours;
      if (key) ensureMechDay(mech, key).hours += hours;
    }
  });

  (inspectionsRes.data || []).forEach((i: any) => {
    const key = londonDay(i.inspected_at);
    if (key) {
      const day = ensureDay(key);
      day.inspections += 1;
      day.standardMinutes += inspectionMinutes;
    }
    if (i.inspected_by_id) {
      const mech = ensureMech(i.inspected_by_id, i.inspected_by_name);
      mech.inspections += 1;
      mech.standardMinutes += inspectionMinutes;
      if (key) {
        const d = ensureMechDay(mech, key);
        d.standardMinutes += inspectionMinutes;
        d.jobs.push({
          id: i.id,
          type: 'inspection',
          label: `Inspection${i.bike_type ? ` — ${i.bike_type}` : ''}`,
          minutes: inspectionMinutes,
          source: 'inspection',
        });
      }
    }
  });

  let catalogueRepairs = 0;
  let totalRepairRows = 0;

  (issuesRes.data || []).forEach((iss: any) => {
    const key = londonDay(iss.resolved_at);
    totalRepairRows += 1;

    const { minutes, source } = repairMinutesFor(iss);
    if (source === 'catalogue') catalogueRepairs += 1;

    if (key) {
      const day = ensureDay(key);
      day.repairs += 1;
      day.standardMinutes += minutes;
    }
    if (iss.resolved_by_id) {
      const mech = ensureMech(iss.resolved_by_id, iss.resolved_by_name);
      mech.repairs += 1;
      mech.standardMinutes += minutes;
      if (key) {
        const d = ensureMechDay(mech, key);
        d.standardMinutes += minutes;
        d.jobs.push({
          id: iss.id,
          type: 'repair',
          label: iss.labour?.repair_name || iss.issue_description || 'Repair',
          minutes: Math.round(minutes),
          source,
        });
      }
    }
  });

  // ---- Box My Bike / Foam My Bike: 45 min each ----
  const unallocatedBoxFoam: UnallocatedBoxFoamJob[] = [];
  const bfOrders = await fetchAll<any>((f, t) =>
    (supabase.from('orders') as any)
      .select('id, tracking_number, bikes, bike_brand, bike_model, box_boxed_at, box_boxed_by_id, foam_foamed_at, foam_foamed_by_id')
      .or(`and(box_boxed_at.gte.${fromISO},box_boxed_at.lte.${toISO}),and(foam_foamed_at.gte.${fromISO},foam_foamed_at.lte.${toISO})`)
      .order('id', { ascending: true })
      .range(f, t),
  );
  if (bfOrders.length) {
    const ids = bfOrders.map((o: any) => o.id);
    const taskByOrder = new Map<string, { box?: string; foam?: string }>();
    const neededIds = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('linked_order_id, title, assignee_id')
        .in('linked_order_id', ids.slice(i, i + 200))
        .not('assignee_id', 'is', null);
      (tasks || []).forEach((t: any) => {
        const e = taskByOrder.get(t.linked_order_id) || {};
        const title = String(t.title || '').toLowerCase();
        if (title.startsWith('box')) e.box = e.box || t.assignee_id;
        if (title.startsWith('foam')) e.foam = e.foam || t.assignee_id;
        taskByOrder.set(t.linked_order_id, e);
      });
    }
    const resolved = bfOrders.flatMap((o: any) => {
      const bike =
        (Array.isArray(o.bikes) && o.bikes[0] ? [o.bikes[0].brand, o.bikes[0].model] : [o.bike_brand, o.bike_model])
          .filter(Boolean).join(' ').trim() || 'Bike';
      const tracking = o.tracking_number || o.id.slice(0, 8);
      const out: { o: any; kind: 'box' | 'foam'; at: string; mech: string | null; bike: string; tracking: string }[] = [];
      const inRange = (v: string | null) => !!v && v >= fromISO && v <= toISO;
      if (inRange(o.box_boxed_at)) out.push({ o, kind: 'box', at: o.box_boxed_at, mech: o.box_boxed_by_id || taskByOrder.get(o.id)?.box || null, bike, tracking });
      if (inRange(o.foam_foamed_at)) out.push({ o, kind: 'foam', at: o.foam_foamed_at, mech: o.foam_foamed_by_id || taskByOrder.get(o.id)?.foam || null, bike, tracking });
      out.forEach((r) => r.mech && !mechMap.has(r.mech) && neededIds.add(r.mech));
      return out;
    });
    const names = new Map<string, string>();
    if (neededIds.size) {
      const { data: profs } = await supabase.from('profiles').select('id, name, email').in('id', Array.from(neededIds));
      (profs || []).forEach((p: any) => names.set(p.id, p.name || p.email));
    }
    resolved.forEach((r) => {
      const key = londonDay(r.at);
      if (key) ensureDay(key).standardMinutes += BOX_FOAM_MINUTES;
      if (!r.mech) {
        unallocatedBoxFoam.push({ orderId: r.o.id, kind: r.kind, tracking: r.tracking, bike: r.bike, doneAt: r.at });
        return;
      }
      const mech = ensureMech(r.mech, names.get(r.mech));
      if (r.kind === 'box') mech.boxed += 1; else mech.foamed += 1;
      mech.standardMinutes += BOX_FOAM_MINUTES;
      if (key) {
        const d = ensureMechDay(mech, key);
        d.standardMinutes += BOX_FOAM_MINUTES;
        d.jobs.push({
          id: `${r.o.id}-${r.kind}`,
          type: r.kind,
          label: `${r.kind === 'box' ? 'Box up' : 'Foam up'} ${r.tracking} — ${r.bike}`,
          minutes: BOX_FOAM_MINUTES,
          source: 'box_foam',
        });
      }
    });
    unallocatedBoxFoam.sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  }

  // Mechanics clocked in per day — used to split the day's queue evenly.
  const clockedPerDay = new Map<string, number>();
  mechMap.forEach((m) => {
    m.dayMap.forEach((d, key) => {
      if (d.hours > 0) clockedPerDay.set(key, (clockedPerDay.get(key) || 0) + 1);
    });
  });

  const daily: MechanicHoursDaily[] = Array.from(dayMap.entries())
    .filter(
      ([, v]) =>
        v.hours > 0 || v.inspections > 0 || v.repairs > 0 || v.availableJobs > 0,
    )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => {
      const hours = round1(v.hours);
      const standardHours = round1(v.standardMinutes / 60);
      return {
        date,
        label: labelFor(date),
        hours,
        standardHours,
        varianceHours: round1(standardHours - hours),
        efficiencyPct: hours > 0 ? (standardHours / hours) * 100 : 0,
        inspections: v.inspections,
        repairs: v.repairs,
        jobsPerHour: v.hours > 0 ? (v.inspections + v.repairs) / v.hours : 0,
        availableJobs: v.availableJobs,
        hoursPossible: round1(v.availableMinutes / 60),
        queueItems: v.queueItems,
      };
    });

  const perMechanic: MechanicHoursPerMechanic[] = Array.from(mechMap.values()).map((r) => {
    const jobs = r.inspections + r.repairs + r.boxed + r.foamed;
    const hours = round1(r.hours);
    const standardHours = round1(r.standardMinutes / 60);
    let shareJobs = 0;
    let shareMinutes = 0;
    const days: MechanicDayBreakdown[] = Array.from(r.dayMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, d]) => {
        const dh = round1(d.hours);
        const dsh = round1(d.standardMinutes / 60);
        const queue = dayMap.get(date);
        const splitters = clockedPerDay.get(date) || 0;
        const dayJobsShare = queue && splitters > 0 ? queue.availableJobs / splitters : 0;
        const dayMinutesShare = queue && splitters > 0 ? queue.availableMinutes / splitters : 0;
        if (d.hours > 0) {
          shareJobs += dayJobsShare;
          shareMinutes += dayMinutesShare;
        }
        return {
          date,
          label: labelFor(date),
          hours: dh,
          standardHours: dsh,
          varianceHours: round1(dsh - dh),
          jobs: d.jobs,
          availableJobs: queue?.availableJobs ?? 0,
          hoursPossible: round1((queue?.availableMinutes ?? 0) / 60),
          availableJobsShare: Math.round(dayJobsShare * 10) / 10,
          hoursPossibleShare: round1(dayMinutesShare / 60),
          queueItems: queue?.queueItems ?? [],
        };
      });
    const hoursPossibleShare = round1(shareMinutes / 60);
    return {
      mechanicId: r.mechanicId,
      name: r.name,
      hours,
      standardHours,
      varianceHours: round1(standardHours - hours),
      efficiencyPct: hours > 0 ? (standardHours / hours) * 100 : 0,
      inspections: r.inspections,
      repairs: r.repairs,
      boxed: r.boxed,
      foamed: r.foamed,
      jobsPerHour: hours > 0 ? jobs / hours : 0,
      minutesPerJob: jobs > 0 ? (hours * 60) / jobs : 0,
      availableJobsShare: Math.round(shareJobs * 10) / 10,
      hoursPossibleShare,
      utilisationPct: hoursPossibleShare > 0 ? (standardHours / hoursPossibleShare) * 100 : 0,
      days,
    };
  });
  perMechanic.sort((a, b) => b.efficiencyPct - a.efficiencyPct);

  const totalHours = daily.reduce((s, d) => s + d.hours, 0);
  const totalStandardHours = daily.reduce((s, d) => s + d.standardHours, 0);
  const totalInspections = daily.reduce((s, d) => s + d.inspections, 0);
  const totalRepairs = daily.reduce((s, d) => s + d.repairs, 0);
  const totalJobs = totalInspections + totalRepairs;
  const totalHoursPossible = daily.reduce((s, d) => s + d.hoursPossible, 0);
  const peakAvailableJobs = daily.reduce((s, d) => Math.max(s, d.availableJobs), 0);

  return {
    daily,
    unallocatedBoxFoam,
    perMechanic,
    totals: {
      hours: round1(totalHours),
      standardHours: round1(totalStandardHours),
      varianceHours: round1(totalStandardHours - totalHours),
      efficiencyPct: totalHours > 0 ? (totalStandardHours / totalHours) * 100 : 0,
      inspections: totalInspections,
      repairs: totalRepairs,
      jobsPerHour: totalHours > 0 ? totalJobs / totalHours : 0,
      minutesPerJob: totalJobs > 0 ? (totalHours * 60) / totalJobs : 0,
      catalogueCoveragePct: totalRepairRows > 0 ? (catalogueRepairs / totalRepairRows) * 100 : 0,
      availableJobs: peakAvailableJobs,
      hoursPossible: round1(totalHoursPossible),
    },
    settings: {
      hourlyRate,
      inspectionMinutes,
      defaultRepairMinutes,
    },
  };
}
